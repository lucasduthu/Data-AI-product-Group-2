import hashlib
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, col, select

from app.api.routers.settings import get_or_create_workspace_settings
from app.core.database import get_session
from app.models.audit_log import AuditLog
from app.models.campaign import DistributionCampaign
from app.models.contract import AdvanceLedger, Contract, RoyaltyLedgerEntry
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.campaign import (
    AttachStatementsPayload,
    CampaignCreate,
    CampaignLockPayload,
    CampaignRead,
    CampaignUpdate,
    ConsolidatedCampaignReport,
    ConsolidatedHolderPayout,
    ConsolidatedSourceBreakdown,
    StatementSummary,
)
from app.schemas.common import ValidationStatus
from app.schemas.royalty import AdvanceRecoupmentState, HolderWorkBreakdown
from app.schemas.sepa import SepaExportRequest, SepaExportResponse, SepaValidationReport
from app.services.royalty_engine import (
    CENT,
    MICRO_CENT,
    apply_advance_recoupment,
    calculate_line_allocations,
    finalize_period_holder_totals,
    normalize_holder_identity_name,
    normalize_ipi_code,
    resolve_canonical_holder_key,
)
from app.services.sepa_generator import build_sepa_validation_report, generate_sepa_pain001_xml

router = APIRouter(prefix="/api/v1/campaigns", tags=["Campagnes de Répartition Multi-Relevés"])


def _statement_to_summary(stmt: RoyaltyStatement) -> StatementSummary:
    return StatementSummary(
        id=stmt.id,
        source_name=stmt.source_name,
        filename=stmt.filename,
        period_start=stmt.period_start,
        period_end=stmt.period_end,
        total_gross_amount=Decimal(str(stmt.total_gross_amount)).quantize(CENT, rounding=ROUND_HALF_UP),
        currency=stmt.currency,
        source_currency=stmt.source_currency,
        exchange_rate=Decimal(str(stmt.exchange_rate)),
        source_gross_amount=Decimal(str(stmt.source_gross_amount)).quantize(CENT, rounding=ROUND_HALF_UP),
        accounting_status=stmt.accounting_status,
        integrity_hash=stmt.integrity_hash,
    )


def _campaign_to_read(campaign: DistributionCampaign, session: Session) -> CampaignRead:
    stmts = session.exec(
        select(RoyaltyStatement)
        .where(RoyaltyStatement.campaign_id == campaign.id)
        .order_by(RoyaltyStatement.period_start)
    ).all()
    summaries = [_statement_to_summary(s) for s in stmts]
    total_gross = sum((s.total_gross_amount for s in summaries), Decimal("0.00")).quantize(CENT, rounding=ROUND_HALF_UP)

    return CampaignRead(
        id=campaign.id,
        name=campaign.name,
        period_start=campaign.period_start,
        period_end=campaign.period_end,
        accounting_status=campaign.accounting_status,
        locked_at=campaign.locked_at,
        paid_at=campaign.paid_at,
        payment_reference=campaign.payment_reference,
        payment_method=campaign.payment_method,
        payment_notes=campaign.payment_notes,
        integrity_hash=campaign.integrity_hash,
        notes=campaign.notes,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        statements_count=len(summaries),
        total_gross_amount=total_gross,
        statements=summaries,
    )


@router.get("", response_model=list[CampaignRead])
def list_campaigns(session: Session = Depends(get_session)) -> list[CampaignRead]:
    """Liste l'ensemble des campagnes de répartition multi-relevés."""
    campaigns = session.exec(
        select(DistributionCampaign).order_by(DistributionCampaign.created_at.desc())
    ).all()
    return [_campaign_to_read(c, session) for c in campaigns]


@router.post("", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreate,
    session: Session = Depends(get_session),
) -> CampaignRead:
    """Crée une nouvelle campagne de répartition semestrielle ou multi-relevés."""
    campaign = DistributionCampaign(
        name=payload.name.strip(),
        period_start=payload.period_start,
        period_end=payload.period_end,
        notes=payload.notes.strip() if payload.notes else None,
        accounting_status="DRAFT",
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    # Rattacher les relevés initiaux si fournis
    if payload.statement_ids:
        stmts = session.exec(
            select(RoyaltyStatement).where(col(RoyaltyStatement.id).in_(payload.statement_ids))
        ).all()
        for s in stmts:
            s.campaign_id = campaign.id
            session.add(s)

        # Si les dates de période ne sont pas fournies, déduire automatiquement des relevés
        if not campaign.period_start and stmts:
            min_start = min(s.period_start for s in stmts)
            max_end = max(s.period_end for s in stmts)
            campaign.period_start = min_start
            campaign.period_end = max_end
            session.add(campaign)

        session.commit()
        session.refresh(campaign)

    return _campaign_to_read(campaign, session)


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign(
    campaign_id: UUID,
    session: Session = Depends(get_session),
) -> CampaignRead:
    """Récupère une campagne de répartition par son identifiant."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")
    return _campaign_to_read(campaign, session)


@router.put("/{campaign_id}", response_model=CampaignRead)
def update_campaign(
    campaign_id: UUID,
    payload: CampaignUpdate,
    session: Session = Depends(get_session),
) -> CampaignRead:
    """Met à jour les métadonnées d'une campagne de répartition non clôturée."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")
    if campaign.accounting_status in ("LOCKED", "PAID"):
        raise HTTPException(status_code=400, detail="Une campagne clôturée ne peut plus être modifiée.")

    if payload.name is not None:
        campaign.name = payload.name.strip()
    if payload.period_start is not None:
        campaign.period_start = payload.period_start
    if payload.period_end is not None:
        campaign.period_end = payload.period_end
    if payload.notes is not None:
        campaign.notes = payload.notes.strip() if payload.notes else None

    campaign.updated_at = datetime.now(timezone.utc)
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    return _campaign_to_read(campaign, session)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(
    campaign_id: UUID,
    session: Session = Depends(get_session),
) -> None:
    """Supprime une campagne en statut DRAFT et détache tous les relevés associés."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")
    if campaign.accounting_status in ("LOCKED", "PAID"):
        raise HTTPException(status_code=400, detail="Une campagne clôturée ou payée ne peut pas être supprimée.")

    # Détacher les relevés
    stmts = session.exec(
        select(RoyaltyStatement).where(RoyaltyStatement.campaign_id == campaign.id)
    ).all()
    for s in stmts:
        s.campaign_id = None
        session.add(s)

    session.delete(campaign)
    session.commit()


@router.post("/{campaign_id}/statements", response_model=CampaignRead)
def attach_statements(
    campaign_id: UUID,
    payload: AttachStatementsPayload,
    session: Session = Depends(get_session),
) -> CampaignRead:
    """Rattache une liste de relevés à la campagne de répartition."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")
    if campaign.accounting_status in ("LOCKED", "PAID"):
        raise HTTPException(status_code=400, detail="Une campagne clôturée ne peut plus être modifiée.")

    stmts = session.exec(
        select(RoyaltyStatement).where(col(RoyaltyStatement.id).in_(payload.statement_ids))
    ).all()
    for s in stmts:
        s.campaign_id = campaign.id
        session.add(s)

    session.commit()
    session.refresh(campaign)
    return _campaign_to_read(campaign, session)


@router.delete("/{campaign_id}/statements/{statement_id}", response_model=CampaignRead)
def detach_statement(
    campaign_id: UUID,
    statement_id: UUID,
    session: Session = Depends(get_session),
) -> CampaignRead:
    """Détache un relevé de la campagne de répartition."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")
    if campaign.accounting_status in ("LOCKED", "PAID"):
        raise HTTPException(status_code=400, detail="Une campagne clôturée ne peut plus être modifiée.")

    stmt = session.get(RoyaltyStatement, statement_id)
    if stmt and stmt.campaign_id == campaign.id:
        stmt.campaign_id = None
        session.add(stmt)
        session.commit()
        session.refresh(campaign)

    return _campaign_to_read(campaign, session)


def _compute_campaign_report(
    campaign: DistributionCampaign,
    session: Session,
    lock_and_persist: bool = False,
    lock_payload: CampaignLockPayload | None = None,
) -> ConsolidatedCampaignReport:
    """Moteur central d'agrégation multi-relevés de la campagne de répartition.

    Calcule la consolidation financière de tous les relevés rattachés :
    1. Agrège les redevances brutes allouées par ayant droit à travers l'ensemble des sources (SACEM, Spotify, Apple, etc.).
    2. Impute l'amortissement d'avance de manière consolidée UNE SEULE FOIS par ayant droit.
    3. Applique le seuil unique de 50.00 € sur le NET CUMULÉ : un ayant droit percevant 30 € de SACEM et 30 € de DSP
       dépasse 50 € et devient PAYABLE (au lieu de 2 x BELOW_THRESHOLD isolés).
    4. Construit la ventilation multi-sources détaillée pour chaque ayant droit.
    """
    statements = list(
        session.exec(
            select(RoyaltyStatement)
            .where(RoyaltyStatement.campaign_id == campaign.id)
            .order_by(RoyaltyStatement.period_start)
        ).all()
    )

    ws = get_or_create_workspace_settings(session)
    min_threshold = getattr(ws, "min_payment_threshold", Decimal("50.00"))
    messages = getattr(ws, "statement_messages", None)

    # Projets Audiovisuels
    all_work_groups = {g.id: g for g in session.exec(select(WorkGroup)).all()}
    all_group_links = session.exec(select(WorkGroupLink)).all()
    work_to_group: dict[UUID, WorkGroup] = {}
    for gl in all_group_links:
        g = all_work_groups.get(gl.work_group_id)
        if g:
            work_to_group[gl.work_id] = g

    # Annuaire
    directory_holders = list(session.exec(select(RightHolderDirectory)).all())
    dir_by_id: dict[UUID, RightHolderDirectory] = {d.id: d for d in directory_holders}
    dir_by_ipi: dict[str, RightHolderDirectory] = {
        normalize_ipi_code(d.ipi_number): d for d in directory_holders if normalize_ipi_code(d.ipi_number)
    }
    dir_by_norm_name: dict[str, RightHolderDirectory] = {
        normalize_holder_identity_name(d.full_name): d for d in directory_holders if normalize_holder_identity_name(d.full_name)
    }

    # Contrats & Avances
    contracts = list(session.exec(select(Contract)).all())
    ledgers = list(session.exec(select(AdvanceLedger)).all())
    contracts_by_ref = {c.contract_reference: c for c in contracts if c.contract_reference}
    contracts_by_holder_id = {c.right_holder_id: c for c in contracts if c.right_holder_id}
    ledgers_by_holder_id = {l.right_holder_id: l for l in ledgers if l.right_holder_id}
    ledgers_by_norm = {normalize_holder_identity_name(l.holder_name): l for l in ledgers}
    ledgers_by_ipi = {normalize_ipi_code(l.ipi_number): l for l in ledgers if normalize_ipi_code(l.ipi_number)}

    # Structures d'agrégation multi-relevés
    holder_meta: dict[str, dict[str, Any]] = {}
    holder_exact_totals: dict[str, Decimal] = {}
    holder_sources_map: dict[str, dict[UUID, ConsolidatedSourceBreakdown]] = {}
    holder_works_map: dict[str, list[HolderWorkBreakdown]] = {}

    total_campaign_gross = Decimal("0.00")
    sources_summary: list[dict[str, Any]] = []

    for stmt in statements:
        stmt_gross = Decimal(str(stmt.total_gross_amount)).quantize(CENT, rounding=ROUND_HALF_UP)
        total_campaign_gross += stmt_gross

        lines = list(
            session.exec(
                select(StatementLine)
                .where(StatementLine.statement_id == stmt.id)
                .order_by(StatementLine.row_number)
            ).all()
        )

        work_ids = list({ln.matched_work_id for ln in lines if ln.matched_work_id is not None})
        works_by_id: dict[UUID, Work] = {}
        if work_ids:
            for w in session.exec(select(Work).where(col(Work.id).in_(work_ids))).all():
                works_by_id[w.id] = w

        stmt_allocated_gross = Decimal("0.00")

        for ln in lines:
            if ln.validation_status != ValidationStatus.VALIDATED.value:
                continue
            work = works_by_id.get(ln.matched_work_id) if ln.matched_work_id else None
            if not work or not work.splits:
                continue

            line_gross_6d = Decimal(str(ln.gross_amount)).quantize(MICRO_CENT, rounding=ROUND_HALF_UP)
            right_type_val: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
                ln.right_type if ln.right_type in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
            )
            allocs = calculate_line_allocations(
                gross_amount=line_gross_6d,
                splits=work.splits,
                right_type=right_type_val,
            )

            for alloc in allocs:
                norm_ipi = normalize_ipi_code(alloc.ipi_number)
                norm_name = normalize_holder_identity_name(alloc.holder_name)
                matched_dh = (
                    (dir_by_ipi.get(norm_ipi) if norm_ipi else None)
                    or dir_by_norm_name.get(norm_name)
                )
                resolved_rh_id = alloc.right_holder_id or (matched_dh.id if matched_dh else None)
                resolved_ipi = alloc.ipi_number or (matched_dh.ipi_number if matched_dh else None)

                canonical_key = resolve_canonical_holder_key(
                    holder_name=alloc.holder_name,
                    ipi_number=resolved_ipi,
                    right_holder_id=resolved_rh_id,
                )
                exact_amt = (
                    alloc.exact_allocated_amount
                    if alloc.exact_allocated_amount is not None
                    else alloc.allocated_amount
                )
                amt_cents = exact_amt.quantize(CENT, rounding=ROUND_HALF_UP)
                holder_exact_totals[canonical_key] = (
                    holder_exact_totals.get(canonical_key, Decimal("0.000000")) + exact_amt
                )
                stmt_allocated_gross += amt_cents

                # Détail par source pour cet ayant droit
                sources_dict = holder_sources_map.setdefault(canonical_key, {})
                if stmt.id not in sources_dict:
                    sources_dict[stmt.id] = ConsolidatedSourceBreakdown(
                        statement_id=stmt.id,
                        source_name=stmt.source_name,
                        filename=stmt.filename,
                        allocated_gross=amt_cents,
                        source_gross_amount=getattr(stmt, "source_gross_amount", None),
                        source_currency=getattr(stmt, "source_currency", "EUR") or "EUR",
                        exchange_rate=getattr(stmt, "exchange_rate", Decimal("1.000000")) or Decimal("1.000000"),
                    )
                else:
                    sources_dict[stmt.id].allocated_gross += amt_cents

                # Détail par œuvre pour cet ayant droit
                w_grp = work_to_group.get(work.id) if work else None
                holder_works_map.setdefault(canonical_key, []).append(
                    HolderWorkBreakdown(
                        work_id=work.id,
                        work_title=work.title,
                        iswc=work.iswc,
                        right_type=right_type_val,
                        exploitation_type=ln.exploitation_type or "STREAMING",
                        gross_line_amount=Decimal(str(ln.gross_amount)).quantize(CENT, rounding=ROUND_HALF_UP),
                        share_percentage=Decimal(str(alloc.share_percentage)).quantize(CENT, rounding=ROUND_HALF_UP),
                        allocated_amount=amt_cents,
                        territory=getattr(ln, "territory", "FR") or "FR",
                        work_group_id=w_grp.id if w_grp else None,
                        work_group_title=w_grp.name if w_grp else "Catalogue Général / Hors Projet",
                        source_currency=getattr(ln, "source_currency", "EUR") or getattr(stmt, "source_currency", "EUR") or "EUR",
                        source_gross_amount=getattr(ln, "source_gross_amount", None),
                        exchange_rate=getattr(ln, "exchange_rate", Decimal("1.000000")) or getattr(stmt, "exchange_rate", Decimal("1.000000")),
                    )
                )

                if canonical_key not in holder_meta:
                    holder_meta[canonical_key] = {
                        "holder_name": alloc.holder_name,
                        "role": alloc.role,
                        "ipi_number": resolved_ipi,
                        "right_holder_id": resolved_rh_id,
                    }

        sources_summary.append({
            "statement_id": str(stmt.id),
            "source_name": stmt.source_name,
            "filename": stmt.filename,
            "period_start": stmt.period_start.isoformat() if stmt.period_start else None,
            "period_end": stmt.period_end.isoformat() if stmt.period_end else None,
            "total_gross_amount": str(stmt_gross),
            "allocated_gross": str(stmt_allocated_gross),
            "accounting_status": stmt.accounting_status,
        })

    # Arrondi au centime près via Méthode du Plus Fort Reste
    final_holder_gross = finalize_period_holder_totals(
        exact_holder_totals=holder_exact_totals,
        target_validated_gross=sum(
            (v.quantize(CENT, rounding=ROUND_HALF_UP) for v in holder_exact_totals.values()),
            Decimal("0.00"),
        ),
    )

    holders_payouts: list[ConsolidatedHolderPayout] = []
    holder_rec_states: list[AdvanceRecoupmentState] = []
    total_allocated_checksum = Decimal("0.00")
    total_recouped_in_period = Decimal("0.00")
    total_net_payable = Decimal("0.00")
    total_retained_in_reserve = Decimal("0.00")
    payable_count = 0
    below_threshold_count = 0
    recouping_count = 0

    now = datetime.now(timezone.utc)

    for canonical_key, gross_holder in sorted(
        final_holder_gross.items(),
        key=lambda item: (-item[1], item[0]),
    ):
        meta = holder_meta.get(canonical_key, {})
        holder_name = meta.get("holder_name") or canonical_key
        rh_id = meta.get("right_holder_id")
        ipi_num = meta.get("ipi_number")
        norm_name = normalize_holder_identity_name(holder_name)
        norm_ipi = normalize_ipi_code(ipi_num)

        dh = (
            (dir_by_id.get(rh_id) if rh_id else None)
            or (dir_by_ipi.get(norm_ipi) if norm_ipi else None)
            or dir_by_norm_name.get(norm_name)
        )
        if dh:
            rh_id = dh.id
            if not ipi_num and dh.ipi_number:
                ipi_num = dh.ipi_number

        contract = (
            (contracts_by_holder_id.get(rh_id) if rh_id else None)
            or contracts_by_ref.get(norm_name)
        )
        c_id = contract.id if contract else None
        c_ref = contract.contract_reference if contract else None

        ledger = (
            (ledgers_by_holder_id.get(rh_id) if rh_id else None)
            or (ledgers_by_ipi.get(norm_ipi) if norm_ipi else None)
            or ledgers_by_norm.get(norm_name)
        )

        init_adv = Decimal("0.00")
        prev_rec = Decimal("0.00")
        if ledger:
            init_adv = Decimal(str(ledger.initial_advance)).quantize(CENT)
            prev_rec = Decimal(str(ledger.recouped_amount)).quantize(CENT)
        elif contract and contract.advance_amount:
            init_adv = Decimal(str(contract.advance_amount)).quantize(CENT)
            prev_rec = Decimal(str(contract.recouped_amount or "0.00")).quantize(CENT)

        work_breakdown_list = holder_works_map.get(canonical_key, [])
        sources_list = list(holder_sources_map.get(canonical_key, {}).values())

        # Application déterministe de l'amortissement d'avance et du seuil consolidé
        rec_state = apply_advance_recoupment(
            holder_name=holder_name,
            gross_royalties_allocated=gross_holder,
            initial_advance=init_adv,
            previously_recouped=prev_rec,
            previous_reserve_balance=getattr(dh, "retained_reserve_balance", Decimal("0.00")) if dh else Decimal("0.00"),
            min_payment_threshold=min_threshold,
            statement_messages=messages,
            role=str(meta.get("role")) if meta.get("role") else None,
            ipi_number=str(ipi_num) if ipi_num else None,
            contract_id=c_id,
            contract_reference=c_ref,
            right_holder_id=rh_id,
            entity_type=dh.entity_type if dh else "PERSONNE_PHYSIQUE",
            legal_form=dh.legal_form if dh else None,
            siret=dh.siret if dh else None,
            vat_number=dh.vat_number if dh else None,
            vat_applicable=dh.vat_applicable if dh else False,
            vat_rate_pct=dh.vat_rate_pct if dh else Decimal("0.00"),
            ircec_precompte_applicable=dh.ircec_precompte_applicable if dh else True,
            urssaf_dispense_certificate=dh.urssaf_dispense_certificate if dh else False,
            iban=dh.iban if dh else None,
            bic=dh.bic if dh else None,
            works_count=len(work_breakdown_list),
            works_breakdown=work_breakdown_list,
        )

        # Enrichissement Tiers Mandataire et Successions
        is_succ_active = False
        payout_dest_id = None
        payout_dest_name = None
        heirs_payout_details: list[dict[str, Any]] = []

        if dh:
            rec_state.is_deceased = getattr(dh, "is_deceased", False)
            if getattr(dh, "payout_recipient_name", None) or getattr(dh, "payout_recipient_id", None):
                payout_dest_id = getattr(dh, "payout_recipient_id", None)
                payout_dest_name = getattr(dh, "payout_recipient_name", None)
                rec_state.payout_redirected = True
                rec_state.payout_recipient_id = payout_dest_id
                rec_state.payout_recipient_name = payout_dest_name
                if payout_dest_id and payout_dest_id in dir_by_id:
                    third_party = dir_by_id[payout_dest_id]
                    if third_party.iban:
                        rec_state.iban = third_party.iban
                    if third_party.bic:
                        rec_state.bic = third_party.bic

            if getattr(dh, "succession_active", False) and getattr(dh, "heirs", None):
                is_succ_active = True
                rec_state.succession_active = True
                net_to_split = rec_state.net_payable_amount
                gross_to_split = rec_state.gross_royalties_allocated
                for heir in dh.heirs:
                    h_pct = Decimal(str(heir.get("share_pct", "0.00")))
                    h_gross = (gross_to_split * h_pct / Decimal("100.00")).quantize(CENT, rounding=ROUND_HALF_UP)
                    h_net = (net_to_split * h_pct / Decimal("100.00")).quantize(CENT, rounding=ROUND_HALF_UP)
                    heirs_payout_details.append({
                        "heir_name": heir.get("heir_name"),
                        "relationship": heir.get("relationship", "Héritier"),
                        "share_pct": str(h_pct),
                        "allocated_gross": str(h_gross),
                        "net_payable": str(h_net),
                        "iban": heir.get("iban"),
                        "bic": heir.get("bic"),
                    })
                rec_state.heirs_distribution = heirs_payout_details

            if is_succ_active and heirs_payout_details:
                rec_state.legal_mention_applied = (
                    f"Succession active ({len(heirs_payout_details)} héritiers) : ventilation indivise selon quotes-parts notariales."
                )
            elif payout_dest_name:
                rec_state.legal_mention_applied = (
                    f"Paiement mandaté et redirigé vers le tiers désigné : {payout_dest_name}."
                )

        if lock_and_persist:
            rec_state.e_invoicing_status = "FACTUR-X / E-REPORTING 2026 READY (CAMPAIGN LOCKED)"
            new_recouped_total = (rec_state.previously_recouped + rec_state.recouped_in_period).quantize(CENT)
            if ledger:
                ledger.recouped_amount = new_recouped_total
                if rh_id and not ledger.right_holder_id:
                    ledger.right_holder_id = rh_id
                ledger.updated_at = now
                session.add(ledger)
            elif contract and rec_state.initial_advance > Decimal("0.00"):
                new_ledger = AdvanceLedger(
                    contract_id=contract.id,
                    contract_reference=contract.contract_reference,
                    right_holder_id=rh_id,
                    holder_name=holder_name,
                    ipi_number=str(ipi_num) if ipi_num else None,
                    initial_advance=rec_state.initial_advance,
                    recouped_amount=new_recouped_total,
                    updated_at=now,
                )
                session.add(new_ledger)

            if contract:
                contract.recouped_amount = new_recouped_total
                if rh_id and not contract.right_holder_id:
                    contract.right_holder_id = rh_id
                contract.updated_at = now
                session.add(contract)

            if dh:
                if rec_state.payout_status == "BELOW_THRESHOLD":
                    dh.retained_reserve_balance = rec_state.retained_in_reserve
                    dh.updated_at = now
                    session.add(dh)
                elif rec_state.payout_status == "PAYABLE":
                    dh.retained_reserve_balance = Decimal("0.00")
                    dh.updated_at = now
                    session.add(dh)

        holder_rec_states.append(rec_state)

        payout_entry = ConsolidatedHolderPayout(
            right_holder_id=rh_id,
            holder_name=holder_name,
            role=rec_state.role,
            ipi_number=rec_state.ipi_number,
            entity_type=rec_state.entity_type,
            legal_form=rec_state.legal_form,
            siret=rec_state.siret,
            vat_number=rec_state.vat_number,
            vat_applicable=rec_state.vat_applicable,
            vat_rate_pct=rec_state.vat_rate_pct,
            vat_amount=rec_state.vat_amount,
            precompte_social_amount=rec_state.precompte_social_amount,
            iban=rec_state.iban,
            bic=rec_state.bic,
            total_gross_allocated=rec_state.gross_royalties_allocated,
            initial_advance=rec_state.initial_advance,
            previously_recouped=rec_state.previously_recouped,
            recouped_in_period=rec_state.recouped_in_period,
            remaining_unrecouped_balance=rec_state.remaining_unrecouped_balance,
            taxable_base_ht=rec_state.taxable_base_ht,
            previous_reserve_balance=rec_state.previous_reserve_balance,
            min_payment_threshold=min_threshold,
            is_below_payment_threshold=rec_state.is_below_payment_threshold,
            retained_in_reserve=rec_state.retained_in_reserve,
            carried_forward_to_next=rec_state.carried_forward_to_next,
            payout_status=rec_state.payout_status,
            legal_mention_applied=rec_state.legal_mention_applied,
            net_payable_amount=rec_state.net_payable_amount,
            e_invoicing_status=rec_state.e_invoicing_status,
            sources_breakdown=sources_list,
            works_count=rec_state.works_count,
            works_breakdown=work_breakdown_list,
            is_deceased=rec_state.is_deceased,
            payout_recipient_id=rec_state.payout_recipient_id,
            payout_recipient_name=rec_state.payout_recipient_name,
            payout_redirected=rec_state.payout_redirected,
            succession_active=rec_state.succession_active,
            heirs_distribution=heirs_payout_details,
        )
        holders_payouts.append(payout_entry)

        total_allocated_checksum += rec_state.gross_royalties_allocated
        total_recouped_in_period += rec_state.recouped_in_period
        total_net_payable += rec_state.net_payable_amount
        total_retained_in_reserve += rec_state.retained_in_reserve

        if rec_state.payout_status == "PAYABLE":
            payable_count += 1
        elif rec_state.payout_status == "BELOW_THRESHOLD":
            below_threshold_count += 1
        elif rec_state.payout_status == "RECOUPING":
            recouping_count += 1

    if lock_and_persist:
        # Clôturer l'ensemble des relevés rattachés
        for stmt in statements:
            if stmt.accounting_status != "LOCKED":
                stmt.accounting_status = "LOCKED"
                stmt.locked_at = now
                session.add(stmt)

        seal_raw = (
            f"KOROM-CAMPAIGN-SEAL|CAMPAIGN:{campaign.id}|NAME:{campaign.name}|"
            f"PERIOD:{campaign.period_start}:{campaign.period_end}|"
            f"STATEMENTS:{','.join(str(s.id) for s in statements)}|"
            f"GROSS:{total_campaign_gross}|CHECKSUM:{total_allocated_checksum}|"
            f"NET:{total_net_payable}|DATE:{now.isoformat()}"
        )
        computed_seal = hashlib.sha256(seal_raw.encode("utf-8")).hexdigest()

        campaign.accounting_status = "LOCKED"
        campaign.locked_at = now
        campaign.integrity_hash = computed_seal
        if lock_payload:
            campaign.payment_reference = lock_payload.payment_reference
            campaign.payment_method = lock_payload.payment_method
            campaign.payment_notes = lock_payload.payment_notes

        session.add(campaign)

        # Enregistrement Audit Log
        session.add(
            AuditLog(
                action_type="CAMPAIGN_LOCKED",
                entity_type="DISTRIBUTION_CAMPAIGN",
                entity_id=str(campaign.id),
                actor="royalty.manager@solstices-music.fr",
                summary=f"Clôture définitive de la campagne '{campaign.name}' avec scellement SHA-256",
                details={
                    "campaign_id": str(campaign.id),
                    "campaign_name": campaign.name,
                    "statements_count": len(statements),
                    "total_campaign_gross": str(total_campaign_gross),
                    "total_net_payable": str(total_net_payable),
                    "integrity_hash": computed_seal,
                },
            )
        )
        session.commit()
        session.refresh(campaign)

    return ConsolidatedCampaignReport(
        campaign_id=campaign.id,
        campaign_name=campaign.name,
        period_start=campaign.period_start,
        period_end=campaign.period_end,
        accounting_status=campaign.accounting_status,
        is_locked=campaign.accounting_status in ("LOCKED", "PAID"),
        locked_at=campaign.locked_at.isoformat() if campaign.locked_at else None,
        paid_at=campaign.paid_at.isoformat() if campaign.paid_at else None,
        payment_reference=campaign.payment_reference,
        payment_method=campaign.payment_method,
        payment_notes=campaign.payment_notes,
        integrity_hash=campaign.integrity_hash,
        total_statements_count=len(statements),
        total_campaign_gross=total_campaign_gross.quantize(CENT, rounding=ROUND_HALF_UP),
        total_allocated_checksum=total_allocated_checksum.quantize(CENT, rounding=ROUND_HALF_UP),
        total_recouped_in_period=total_recouped_in_period.quantize(CENT, rounding=ROUND_HALF_UP),
        total_net_payable=total_net_payable.quantize(CENT, rounding=ROUND_HALF_UP),
        total_retained_in_reserve=total_retained_in_reserve.quantize(CENT, rounding=ROUND_HALF_UP),
        payable_holders_count=payable_count,
        below_threshold_count=below_threshold_count,
        recouping_count=recouping_count,
        sources_summary=sources_summary,
        holders_payouts=holders_payouts,
    )


@router.get("/{campaign_id}/consolidated-payouts", response_model=ConsolidatedCampaignReport)
def get_campaign_consolidated_payouts(
    campaign_id: UUID,
    session: Session = Depends(get_session),
) -> ConsolidatedCampaignReport:
    """Calcule la simulation consolidée ou restitue le décompte verrouillé de la campagne multi-relevés."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")
    return _compute_campaign_report(campaign=campaign, session=session, lock_and_persist=False)


@router.post("/{campaign_id}/lock", response_model=ConsolidatedCampaignReport)
def lock_campaign(
    campaign_id: UUID,
    payload: CampaignLockPayload | None = None,
    session: Session = Depends(get_session),
) -> ConsolidatedCampaignReport:
    """Clôture définitivement la campagne de répartition multi-relevés avec scellement SHA-256."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")
    if campaign.accounting_status in ("LOCKED", "PAID"):
        return _compute_campaign_report(campaign=campaign, session=session, lock_and_persist=False)
    return _compute_campaign_report(campaign=campaign, session=session, lock_and_persist=True, lock_payload=payload)


def _build_campaign_advance_states(report: ConsolidatedCampaignReport) -> list[AdvanceRecoupmentState]:
    """Convertit les ConsolidatedHolderPayout du rapport en AdvanceRecoupmentState pour le moteur SEPA."""
    states: list[AdvanceRecoupmentState] = []
    for p in report.holders_payouts:
        states.append(
            AdvanceRecoupmentState(
                right_holder_id=p.right_holder_id,
                holder_name=p.holder_name,
                role=p.role,
                ipi_number=p.ipi_number,
                entity_type=p.entity_type,
                legal_form=p.legal_form,
                siret=p.siret,
                vat_number=p.vat_number,
                vat_applicable=p.vat_applicable,
                vat_rate_pct=p.vat_rate_pct,
                vat_amount=p.vat_amount,
                precompte_social_amount=p.precompte_social_amount,
                iban=p.iban,
                bic=p.bic,
                gross_royalties_allocated=p.total_gross_allocated,
                initial_advance=p.initial_advance,
                previously_recouped=p.previously_recouped,
                recouped_in_period=p.recouped_in_period,
                remaining_unrecouped_balance=p.remaining_unrecouped_balance,
                taxable_base_ht=p.taxable_base_ht,
                previous_reserve_balance=p.previous_reserve_balance,
                min_payment_threshold=p.min_payment_threshold,
                is_below_payment_threshold=p.is_below_payment_threshold,
                retained_in_reserve=p.retained_in_reserve,
                carried_forward_to_next=p.carried_forward_to_next,
                payout_status=p.payout_status,
                legal_mention_applied=p.legal_mention_applied,
                net_payable_amount=p.net_payable_amount,
                works_count=p.works_count,
                works_breakdown=p.works_breakdown,
                is_deceased=p.is_deceased,
                payout_recipient_id=p.payout_recipient_id,
                payout_recipient_name=p.payout_recipient_name,
                payout_redirected=p.payout_redirected,
                succession_active=p.succession_active,
                heirs_distribution=p.heirs_distribution,
            )
        )
    return states


@router.get("/{campaign_id}/sepa-preview", response_model=SepaValidationReport)
def preview_campaign_sepa(
    campaign_id: UUID,
    session: Session = Depends(get_session),
) -> SepaValidationReport:
    """Pré-vol d'audit SEPA avant émission du virement groupé consolidé."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")

    ws = get_or_create_workspace_settings(session)
    debtor_name = getattr(ws, "publisher_legal_name", "KOROM PUBLISHING SAS") or "KOROM PUBLISHING SAS"
    debtor_iban = getattr(ws, "publisher_iban", "FR0830004019920005554443210") or "FR0830004019920005554443210"
    debtor_bic = getattr(ws, "publisher_bic", "BNPAFRPPXXX") or "BNPAFRPPXXX"

    report = _compute_campaign_report(campaign=campaign, session=session, lock_and_persist=False)
    holder_states = _build_campaign_advance_states(report)

    period_lbl = f"{campaign.period_start or 'Pér'} au {campaign.period_end or 'Pér'}"
    return build_sepa_validation_report(
        statement_id=f"CAMP-{str(campaign.id)[:8]}",
        source_name=campaign.name,
        period_label=period_lbl,
        holder_statements=holder_states,
        debtor_name=debtor_name,
        debtor_iban=debtor_iban,
        debtor_bic=debtor_bic,
        remittance_prefix="KOROM ROYALTIES",
    )


@router.post("/{campaign_id}/export-sepa", response_model=SepaExportResponse)
def export_campaign_sepa(
    campaign_id: UUID,
    payload: SepaExportRequest,
    session: Session = Depends(get_session),
) -> SepaExportResponse:
    """Génère le fichier XML SEPA ISO 20022 pain.001.001.03 consolidé pour la campagne."""
    campaign = session.get(DistributionCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne de répartition introuvable.")

    report = _compute_campaign_report(campaign=campaign, session=session, lock_and_persist=False)
    holder_states = _build_campaign_advance_states(report)

    period_lbl = f"{campaign.period_start or 'Pér'} au {campaign.period_end or 'Pér'}"
    return generate_sepa_pain001_xml(
        statement_id=f"CAMP-{str(campaign.id)[:8]}",
        source_name=campaign.name,
        period_label=period_lbl,
        holder_statements=holder_states,
        debtor_name=payload.debtor_name,
        debtor_iban=payload.debtor_iban,
        debtor_bic=payload.debtor_bic,
        execution_date=payload.execution_date,
        remittance_prefix=payload.remittance_prefix,
        allow_unverified_ibans=payload.allow_unverified_ibans,
    )
