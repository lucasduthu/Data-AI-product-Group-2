import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from sqlmodel import Session, select

from app.api.routers.settings import get_or_create_workspace_settings
from app.core.database import get_session
from app.core.entity_utils import resolve_entity_filter
from app.models.publishing_entity import PublishingEntity
from app.models.audit_log import AuditLog
from app.models.contract import AdvanceLedger, Contract, RoyaltyLedgerEntry
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.common import ValidationStatus
from app.schemas.contract import (
    AdvanceClauseExtraction,
    CGP1ImportReport,
    ContractBatchDeletePayload,
    ContractLinkToWorksPayload,
    ContractLinkToWorksResult,
    ContractPartyExtraction,
    ContractRead,
    ContractValidationPayload,
    ContractWorkSubgroup,
    CreateWorkGroupFromContractRequest,
    CreateWorkGroupFromContractResult,
    ExpectedCessionContract,
    RoyaltySplitRule,
)
from app.services.cgp1_parser import parse_cgp1_or_csv_contracts
from app.services.contract_ai_parser import parse_contract_text_with_ai
from app.services.cwr_validator import validate_work_cwr
from app.services.embedding_service import compute_text_embedding
from app.services.pdf_extractor import extract_text_from_pdf_bytes, validate_is_music_publishing_contract
from app.services.royalty_engine import (
    normalize_holder_identity_name,
    normalize_ipi_code,
    resolve_canonical_holder_key,
)

router = APIRouter(prefix="/api/v1/contracts", tags=["Contrats & Document AI"])


def _contract_to_read(contract: Contract) -> ContractRead:
    adv_amt = Decimal(str(contract.advance_amount or "0.00"))
    rec_amt = Decimal(str(contract.recouped_amount or "0.00"))
    remaining = max(Decimal("0.00"), adv_amt - rec_amt)

    return ContractRead(
        id=contract.id,
        contract_reference=contract.contract_reference,
        contract_type=contract.contract_type,
        sacem_contract_number=contract.sacem_contract_number,
        cwr_contract_type=contract.cwr_contract_type,
        publisher_name=contract.publisher_name,
        counterparty_name=contract.counterparty_name,
        signature_date=contract.signature_date,
        start_date=contract.start_date,
        end_date=contract.end_date,
        territory=contract.territory,
        duration_years=contract.duration_years,
        advance_amount=adv_amt,
        recouped_amount=rec_amt,
        remaining_advance_balance=remaining,
        currency=contract.currency,
        parties=[ContractPartyExtraction.model_validate(p) for p in (contract.parties or [])],
        advance=(
            AdvanceClauseExtraction.model_validate(contract.advance)
            if contract.advance
            else None
        ),
        royalty_rules=[
            RoyaltySplitRule.model_validate(r) for r in (contract.royalty_rules or [])
        ],
        work_titles=contract.work_titles or [],
        work_subgroups=[
            ContractWorkSubgroup.model_validate(sg) for sg in (contract.work_subgroups or [])
        ],
        co_edition_alert=contract.co_edition_alert,
        requires_cession_contract=bool(contract.requires_cession_contract),
        expected_cession_contracts=[
            ExpectedCessionContract.model_validate(c) for c in (contract.expected_cession_contracts or [])
        ],
        audiovisual_program=contract.audiovisual_program,
        source_filename=contract.source_filename,
        extracted_clauses_summary=contract.extracted_clauses_summary,
        cwr_split_warnings=contract.cwr_split_warnings or [],
        confidence_score=contract.confidence_score,
        validation_status=ValidationStatus(contract.validation_status),
        validated_by=contract.validated_by,
        validated_at=contract.validated_at,
        review_notes=contract.review_notes,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


def _autolink_cession_to_coedition(session: Session, cession_contract: Contract) -> None:
    """Rattache automatiquement un contrat de cession d'édition au contrat de coédition parent."""
    if cession_contract.contract_type != "CESSION_EDITION" or not cession_contract.work_titles:
        return

    new_titles_set = set(t.strip().upper() for t in cession_contract.work_titles)
    coed_contracts = session.exec(
        select(Contract).where(Contract.contract_type == "CO_EDITION")
    ).all()

    for coed in coed_contracts:
        updated = False
        curr_expected = [dict(c) for c in (coed.expected_cession_contracts or [])]
        for exp in curr_expected:
            if exp.get("status") == "LINKED":
                continue
            sg_name = exp.get("subgroup_name", "")
            exp_comps = [c.upper() for c in exp.get("composers", [])]
            contract_writers = [
                p["party_name"].upper()
                for p in (cession_contract.parties or [])
                if p.get("role") != "E"
            ]
            comp_match = any(
                c in contract_writers or any(w in c for w in contract_writers)
                for c in exp_comps
            )

            # Match par œuvres
            overlap = 0
            for sg in (coed.work_subgroups or []):
                if sg.get("name") == sg_name:
                    sg_titles = set(st.strip().upper() for st in sg.get("work_titles", []))
                    overlap = len(new_titles_set.intersection(sg_titles))

            if comp_match or overlap > 0:
                exp["status"] = "LINKED"
                exp["linked_contract_id"] = str(cession_contract.id)
                exp["linked_contract_reference"] = cession_contract.contract_reference
                updated = True
                break

        if updated:
            coed.expected_cession_contracts = curr_expected
            session.add(coed)
    session.commit()


@router.get("", response_model=list[ContractRead])
def list_contracts(
    entity_id: UUID | None = Query(None, description="Filtrer par entité éditoriale"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> list[ContractRead]:
    """Liste tous les contrats d'édition et leur statut de validation humaine."""
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)
    query = select(Contract)
    if target_entity_id:
        if is_default_entity:
            query = query.where((Contract.entity_id == target_entity_id) | (Contract.entity_id == None))  # noqa: E711
        else:
            query = query.where(Contract.entity_id == target_entity_id)

    contracts = session.exec(query.order_by(Contract.created_at.desc())).all()
    return [_contract_to_read(c) for c in contracts]


@router.get("/{contract_id}", response_model=ContractRead)
def get_contract(contract_id: UUID, session: Session = Depends(get_session)) -> ContractRead:
    """Récupère le détail d'un contrat d'édition."""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    return _contract_to_read(contract)


def _enrich_extracted_ipis_from_directory(
    session: Session,
    parties: list[ContractPartyExtraction],
) -> None:
    """Enrichit automatiquement les codes IPI manquants lors de l'extraction d'un contrat PDF
    à partir du Répertoire des Ayants Droit (RightHolderDirectory) et des Entités Éditoriales (PublishingEntity).
    """
    all_holders = list(session.exec(select(RightHolderDirectory)).all())
    ipi_by_norm_name: dict[str, str] = {}
    for h in all_holders:
        norm_ipi = normalize_ipi_code(h.ipi_number)
        if not norm_ipi:
            continue
        norm_n = normalize_holder_identity_name(h.full_name)
        if norm_n:
            ipi_by_norm_name[norm_n] = norm_ipi
        if h.stage_name_or_trade_name:
            norm_s = normalize_holder_identity_name(h.stage_name_or_trade_name)
            if norm_s:
                ipi_by_norm_name[norm_s] = norm_ipi
        # Variante sans préfixe "Soc " ou "Editions "
        stripped = re.sub(r"^(?:soc|societe|editions|edition)\s+", "", h.full_name.strip(), flags=re.IGNORECASE)
        norm_stripped = normalize_holder_identity_name(stripped)
        if norm_stripped and norm_stripped not in ipi_by_norm_name:
            ipi_by_norm_name[norm_stripped] = norm_ipi

    for ent in session.exec(select(PublishingEntity)).all():
        norm_ipi = normalize_ipi_code(ent.sacem_ipi)
        if norm_ipi:
            norm_en = normalize_holder_identity_name(ent.name)
            if norm_en and norm_en not in ipi_by_norm_name:
                ipi_by_norm_name[norm_en] = norm_ipi

    for p in parties:
        if not p.ipi_number or not str(p.ipi_number).strip():
            norm_p = normalize_holder_identity_name(p.party_name)
            if norm_p in ipi_by_norm_name:
                p.ipi_number = ipi_by_norm_name[norm_p]
            else:
                stripped_p = re.sub(r"^(?:soc|societe|editions|edition)\s+", "", p.party_name.strip(), flags=re.IGNORECASE)
                norm_sp = normalize_holder_identity_name(stripped_p)
                if norm_sp in ipi_by_norm_name:
                    p.ipi_number = ipi_by_norm_name[norm_sp]


@router.post("/upload", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
async def upload_contract_pdf(
    file: UploadFile = File(...),
    entity_id: UUID | None = Query(None, description="Entité éditoriale cible"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> ContractRead:
    """Extrait la structure d'un contrat PDF via OpenRouter et l'enregistre en PENDING_REVIEW."""
    target_entity_id, _ = resolve_entity_filter(session, entity_id, x_entity_id)
    if not target_entity_id:
        default_ent = session.exec(select(PublishingEntity).where(PublishingEntity.is_default == True)).first()  # noqa: E712
        if default_ent:
            target_entity_id = default_ent.id

    pdf_bytes = await file.read()
    raw_text = extract_text_from_pdf_bytes(pdf_bytes)

    # Guardrail d'entrée (RAI / Input Validation Gate) :
    # Vérifie que le document est un vrai contrat musical avant d'appeler le LLM ou de créer un contrat
    is_valid_contract, rejection_reason = validate_is_music_publishing_contract(raw_text, filename=file.filename or "")
    if not is_valid_contract:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=rejection_reason,
        )

    ws = get_or_create_workspace_settings(session)
    extracted = await parse_contract_text_with_ai(
        raw_text,
        source_filename=file.filename,
        model_override=ws.openrouter_model,
    )
    _enrich_extracted_ipis_from_directory(session, extracted.parties)
    if extracted.contract_type != "LETTRE_ACCORD_INTERPRETE" and extracted.parties:
        cwr_rep = validate_work_cwr(
            work_title=extracted.work_titles[0] if extracted.work_titles else extracted.contract_reference,
            splits=[
                {
                    "holder_name": p.party_name,
                    "role": p.role,
                    "ipi_number": p.ipi_number,
                    "dep_share_pct": p.dep_share_pct,
                    "drm_share_pct": p.drm_share_pct,
                }
                for p in extracted.parties
            ],
        )
        extracted.cwr_split_warnings = cwr_rep.blocking_errors

    now = datetime.now(timezone.utc)
    contract = Contract(
        contract_reference=extracted.contract_reference,
        contract_type=extracted.contract_type,
        publisher_name=extracted.publisher_name,
        counterparty_name=extracted.counterparty_name,
        signature_date=extracted.signature_date,
        start_date=extracted.start_date,
        end_date=extracted.end_date,
        territory=extracted.territory,
        duration_years=extracted.duration_years,
        advance_amount=extracted.advance_amount,
        recouped_amount=Decimal("0.00"),
        currency=extracted.currency,
        work_titles=extracted.work_titles,
        work_subgroups=[sg.model_dump(mode="json") for sg in extracted.work_subgroups],
        co_edition_alert=extracted.co_edition_alert,
        requires_cession_contract=extracted.requires_cession_contract,
        expected_cession_contracts=[c.model_dump(mode="json") for c in extracted.expected_cession_contracts],
        audiovisual_program=extracted.audiovisual_program,
        parties=[p.model_dump(mode="json") for p in extracted.parties],
        advance=extracted.advance.model_dump(mode="json") if extracted.advance else None,
        royalty_rules=[r.model_dump(mode="json") for r in extracted.royalty_rules],
        source_filename=extracted.source_filename,
        extracted_clauses_summary=extracted.extracted_clauses_summary,
        cwr_split_warnings=extracted.cwr_split_warnings,
        confidence_score=extracted.confidence_score,
        validation_status=ValidationStatus.PENDING_REVIEW.value,
        entity_id=target_entity_id,
        created_at=now,
        updated_at=now,
    )
    session.add(contract)
    session.commit()
    session.refresh(contract)

    _autolink_cession_to_coedition(session, contract)
    return _contract_to_read(contract)


@router.post("/{contract_id}/validate", response_model=ContractRead)
def validate_contract_human_in_the_loop(
    contract_id: UUID,
    payload: ContractValidationPayload,
    session: Session = Depends(get_session),
) -> ContractRead:
    """Validation humaine (Human-in-the-loop) d'un contrat extrait.

    Si approuvé :
    - Applique les corrections éventuelles de l'opérateur (parties, splits DEP/DRM, avance).
    - Passe le contrat à VALIDATED.
    - Synchronise les œuvres concernées au Catalogue avec leurs splits validés.
    - Crée ou met à jour le compte d'avance récupérable (AdvanceLedger).
    """
    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")

    now = datetime.now(timezone.utc)
    if payload.contract_reference is not None and payload.contract_reference.strip():
        contract.contract_reference = payload.contract_reference.strip()
    if payload.work_titles is not None:
        contract.work_titles = payload.work_titles
    if payload.advance_amount is not None:
        contract.advance_amount = payload.advance_amount
    if payload.parties is not None:
        contract.parties = [p.model_dump(mode="json") for p in payload.parties]
    if payload.work_subgroups is not None:
        contract.work_subgroups = [sg.model_dump(mode="json") for sg in payload.work_subgroups]
    if payload.co_edition_alert is not None:
        contract.co_edition_alert = payload.co_edition_alert
    if payload.requires_cession_contract is not None:
        contract.requires_cession_contract = payload.requires_cession_contract
    if payload.expected_cession_contracts is not None:
        contract.expected_cession_contracts = [c.model_dump(mode="json") for c in payload.expected_cession_contracts]
    if payload.audiovisual_program is not None:
        contract.audiovisual_program = payload.audiovisual_program

    # Recalcule les alertes CWR déterministes après édition humaine
    report = validate_work_cwr(
        work_title=contract.work_titles[0] if contract.work_titles else contract.contract_reference,
        splits=[
            {
                "holder_name": p["party_name"],
                "role": p["role"],
                "ipi_number": p.get("ipi_number"),
                "dep_share_pct": p["dep_share_pct"],
                "drm_share_pct": p["drm_share_pct"],
            }
            for p in (contract.parties or [])
        ],
    )
    contract.cwr_split_warnings = report.blocking_errors

    contract.validation_status = (
        ValidationStatus.VALIDATED.value
        if payload.approve
        else ValidationStatus.REJECTED.value
    )
    contract.validated_by = payload.validated_by
    contract.validated_at = now
    contract.review_notes = payload.review_notes
    contract.updated_at = now

    if payload.approve:
        # 1. Résolution et synchronisation avec RightHolderDirectory (Annuaire Ayants Droit)
        all_directory_holders = list(session.exec(select(RightHolderDirectory)).all())
        holder_by_ipi: dict[str, RightHolderDirectory] = {}
        holder_by_norm_name: dict[str, RightHolderDirectory] = {}
        for dh in all_directory_holders:
            norm_ipi = normalize_ipi_code(dh.ipi_number)
            if norm_ipi:
                holder_by_ipi[norm_ipi] = dh
            norm_n = normalize_holder_identity_name(dh.full_name)
            if norm_n and (norm_n not in holder_by_norm_name or norm_ipi):
                holder_by_norm_name[norm_n] = dh
            stripped_dh = re.sub(r"^(?:soc|societe|editions|edition)\s+", "", dh.full_name.strip(), flags=re.IGNORECASE)
            norm_stripped_dh = normalize_holder_identity_name(stripped_dh)
            if norm_stripped_dh and (norm_stripped_dh not in holder_by_norm_name or norm_ipi):
                holder_by_norm_name[norm_stripped_dh] = dh

        party_to_holder_id: dict[str, UUID] = {}
        for p in contract.parties or []:
            p_name = p.get("party_name", "").strip()
            p_ipi = p.get("ipi_number")
            p_role = p.get("role", "AC")
            norm_ipi = normalize_ipi_code(p_ipi)
            norm_n = normalize_holder_identity_name(p_name)
            stripped_p = re.sub(r"^(?:soc|societe|editions|edition)\s+", "", p_name, flags=re.IGNORECASE)
            norm_stripped_p = normalize_holder_identity_name(stripped_p)
            
            existing_holder = (
                (holder_by_ipi.get(norm_ipi) if norm_ipi else None)
                or holder_by_norm_name.get(norm_n)
                or holder_by_norm_name.get(norm_stripped_p)
            )
            if existing_holder:
                party_to_holder_id[p_name] = existing_holder.id
                changed = False
                if not p_ipi and existing_holder.ipi_number:
                    p["ipi_number"] = existing_holder.ipi_number
                    p_ipi = existing_holder.ipi_number
                elif not existing_holder.ipi_number and p_ipi:
                    existing_holder.ipi_number = p_ipi
                    changed = True
                if not existing_holder.postal_address and p.get("postal_address"):
                    existing_holder.postal_address = p.get("postal_address")
                    existing_holder.postal_code = p.get("postal_code")
                    existing_holder.city = p.get("city")
                    changed = True
                if not existing_holder.siret and p.get("rcs_or_siret"):
                    existing_holder.siret = p.get("rcs_or_siret")
                    changed = True
                if p.get("legal_form") and (not existing_holder.legal_form or "Particulier" in existing_holder.legal_form):
                    existing_holder.legal_form = p.get("legal_form")
                    changed = True
                if changed:
                    session.add(existing_holder)
            else:
                is_company = p_role in ("E", "SE", "P", "PUBLISHER", "SUB_PUBLISHER", "PRODUCER") or any(
                    kw in p_name.lower() for kw in ("édition", "edition", "publishing", "sas", "sarl", "music", "records", "label")
                )
                legal_form_val = p.get("legal_form") or ("SAS" if is_company else "Artiste-Auteur (Précompte IRCEC)")
                new_h = RightHolderDirectory(
                    full_name=p_name,
                    stage_name_or_trade_name=p_name,
                    entity_type="SOCIETE" if is_company else "PERSONNE_PHYSIQUE",
                    legal_form=legal_form_val,
                    primary_role=p_role,
                    ipi_number=p_ipi,
                    affiliated_society="SACEM",
                    postal_address=p.get("postal_address"),
                    postal_code=p.get("postal_code"),
                    city=p.get("city"),
                    country=p.get("country", "FR"),
                    siret=p.get("rcs_or_siret"),
                    vat_applicable=is_company,
                    vat_rate_pct=Decimal("10.00") if is_company else Decimal("0.00"),
                    ircec_precompte_applicable=not is_company,
                    urssaf_dispense_certificate=False,
                    created_at=now,
                    updated_at=now,
                )
                session.add(new_h)
                session.commit()
                session.refresh(new_h)
                party_to_holder_id[p_name] = new_h.id
                if norm_ipi:
                    holder_by_ipi[norm_ipi] = new_h
                if norm_n:
                    holder_by_norm_name[norm_n] = new_h

        # Lier le contrat à la contrepartie principale si trouvée
        if contract.counterparty_name in party_to_holder_id:
            contract.right_holder_id = party_to_holder_id[contract.counterparty_name]
        else:
            cp_norm = normalize_holder_identity_name(contract.counterparty_name)
            if cp_norm in holder_by_norm_name:
                contract.right_holder_id = holder_by_norm_name[cp_norm].id

        # 2. Synchronisation Catalogue
        default_splits = [
            {
                "right_holder_id": str(party_to_holder_id.get(p["party_name"])) if party_to_holder_id.get(p["party_name"]) else None,
                "holder_name": p["party_name"],
                "role": p["role"],
                "ipi_number": p.get("ipi_number"),
                "dep_share_pct": str(p["dep_share_pct"]),
                "drm_share_pct": str(p["drm_share_pct"]),
                "sync_share_pct": str(p.get("sync_share_pct") or "0.00"),
                "phono_share_pct": str(p.get("phono_share_pct") or "0.00"),
                "share_percentage": str(p["dep_share_pct"]),
            }
            for p in (contract.parties or [])
        ]
        validation_note = {
            "id": str(UUID(int=0)),  # placeholder remplacé dynamiquement
            "author": payload.validated_by or "Juridique",
            "text": f"Contrat validé : {contract.contract_reference} ({contract.publisher_name}). Clés de répartition synchronisées.",
            "created_at": now.isoformat(),
        }
        from uuid import uuid4

        # Indexer les sous-groupes d'œuvres s'ils existent
        subgroup_by_title: dict[str, dict[str, Any]] = {}
        for sg in (contract.work_subgroups or []):
            sg_name = sg.get("name", "")
            sg_comps = sg.get("composers", [])
            for wt in sg.get("work_titles", []):
                subgroup_by_title[wt.strip()] = {
                    "name": sg_name,
                    "composers": sg_comps,
                }

        editor_parties = [p for p in (contract.parties or []) if p.get("role") in ("E", "SE", "PUBLISHER")]
        creator_parties = [p for p in (contract.parties or []) if p.get("role") not in ("E", "SE", "PUBLISHER", "SUB_PUBLISHER")]
        has_creator_parties = len(creator_parties) > 0

        synced_works: list[Work] = []
        for title in contract.work_titles or []:
            # En CO_EDITION sans cession détaillée, découpage par sous-groupe (Musique Originale vs Bande Originale)
            if (
                contract.contract_type == "CO_EDITION"
                and title in subgroup_by_title
                and subgroup_by_title[title]["composers"]
            ):
                sg_info = subgroup_by_title[title]
                sg_composers = sg_info["composers"]
                c_count = max(len(sg_composers), 1)

                splits_for_work = []
                ep_count = max(len(editor_parties), 1)
                default_ep_phono = (Decimal("50.00") / Decimal(str(ep_count))).quantize(Decimal("0.01"))

                # Somme des parts éditoriales stipulées
                sum_ep_dep = sum(Decimal(str(ep.get("dep_share_pct", "25.00"))) for ep in editor_parties)
                sum_ep_drm = sum(Decimal(str(ep.get("drm_share_pct", "25.00"))) for ep in editor_parties)

                # Part restante pour les créateurs (pour garantir 100.00% exact)
                comp_dep = (max(Decimal("0.00"), Decimal("100.00") - sum_ep_dep) / Decimal(str(c_count))).quantize(Decimal("0.01"))
                comp_drm = (max(Decimal("0.00"), Decimal("100.00") - sum_ep_drm) / Decimal(str(c_count))).quantize(Decimal("0.01"))
                comp_phono = (Decimal("50.00") / Decimal(str(c_count))).quantize(Decimal("0.01"))

                # Éditeurs contractuels
                for ep in editor_parties:
                    ep_phono_val = ep.get("phono_share_pct")
                    # En coédition, éviter de dépasser 50% au total pour les éditeurs
                    if ep_phono_val and Decimal(str(ep_phono_val)) > Decimal("25.00") and ep_count > 1:
                        ep_phono_val = default_ep_phono
                    splits_for_work.append({
                        "right_holder_id": str(party_to_holder_id.get(ep["party_name"])) if party_to_holder_id.get(ep["party_name"]) else None,
                        "holder_name": ep["party_name"],
                        "role": ep.get("role", "E"),
                        "ipi_number": ep.get("ipi_number"),
                        "dep_share_pct": str(ep.get("dep_share_pct", "25.00")),
                        "drm_share_pct": str(ep.get("drm_share_pct", "25.00")),
                        "sync_share_pct": str(ep.get("sync_share_pct") or "0.00"),
                        "phono_share_pct": str(ep_phono_val or default_ep_phono),
                        "share_percentage": str(ep.get("dep_share_pct", "25.00")),
                    })
                # Compositeurs du sous-groupe
                for c_name in sg_composers:
                    splits_for_work.append({
                        "right_holder_id": str(party_to_holder_id.get(c_name)) if party_to_holder_id.get(c_name) else None,
                        "holder_name": c_name,
                        "role": "C",
                        "ipi_number": None,
                        "dep_share_pct": str(comp_dep),
                        "drm_share_pct": str(comp_drm),
                        "sync_share_pct": "0.00",
                        "phono_share_pct": str(comp_phono),
                        "share_percentage": str(comp_dep),
                    })
                work_performers = sg_composers
            else:
                splits_for_work = default_splits
                work_performers = (
                    [p["party_name"] for p in creator_parties]
                    if creator_parties
                    else (sg_composers if (title in subgroup_by_title and subgroup_by_title[title]["composers"]) else [contract.counterparty_name])
                )

            existing_work = session.exec(select(Work).where(Work.title == title)).first()
            if existing_work:
                existing_work.splits = splits_for_work
                existing_work.contract_reference = contract.contract_reference
                curr_notes = list(existing_work.timeline_notes or [])
                curr_notes.insert(0, {**validation_note, "id": str(uuid4())})
                existing_work.timeline_notes = curr_notes
                existing_work.updated_at = now
                session.add(existing_work)
                synced_works.append(existing_work)
            else:
                new_work = Work(
                    title=title,
                    alternate_titles=[],
                    iswc=None,
                    isrc_codes=[],
                    contract_reference=contract.contract_reference,
                    performers=work_performers,
                    splits=splits_for_work,
                    timeline_notes=[{**validation_note, "id": str(uuid4())}],
                    embedding=compute_text_embedding(f"{title} {' '.join(work_performers)}"),
                    created_at=now,
                    updated_at=now,
                )
                session.add(new_work)
                synced_works.append(new_work)

        session.flush()

        # Association automatique au projet audiovisuel / WorkGroup
        if contract.audiovisual_program and contract.audiovisual_program.strip():
            prog_name = contract.audiovisual_program.strip()
            wg = session.exec(select(WorkGroup).where(WorkGroup.name == prog_name)).first()
            if not wg:
                wg = WorkGroup(
                    name=prog_name,
                    group_type="AUDIOVISUAL",
                    description=f"Série / projet audiovisuel lié au contrat {contract.contract_reference} ({contract.publisher_name})",
                    created_at=now,
                    updated_at=now,
                )
                session.add(wg)
                session.flush()

            for w in synced_works:
                link_exists = session.exec(
                    select(WorkGroupLink).where(
                        WorkGroupLink.work_group_id == wg.id,
                        WorkGroupLink.work_id == w.id,
                    )
                ).first()
                if not link_exists:
                    wgl = WorkGroupLink(
                        work_group_id=wg.id,
                        work_id=w.id,
                        created_at=now,
                    )
                    session.add(wgl)

        # 2b. Propagation des quotes-parts de synchronisation si LETTRE-ACCORD ARTISTE-INTERPRÈTE (LAI)
        if contract.contract_type == "LETTRE_ACCORD_INTERPRETE" and contract.audiovisual_program:
            artist_party = next(
                (p for p in (contract.parties or []) if p.get("role") in ("I", "PERFORMER") or p.get("party_name") == contract.counterparty_name),
                None,
            )
            sync_rate_str = str(artist_party.get("sync_share_pct", "11.00")) if artist_party else "11.00"
            artist_name = artist_party.get("party_name") if artist_party else contract.counterparty_name

            prog_norm = contract.audiovisual_program.split("(")[0].strip()
            wgs = session.exec(
                select(WorkGroup).where(WorkGroup.name.ilike(f"%{prog_norm}%"))
            ).all()

            for wg in wgs:
                links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == wg.id)).all()
                for link in links:
                    w = session.get(Work, link.work_id)
                    if not w or not w.splits:
                        continue
                    new_splits = []
                    editors = [s for s in w.splits if s.get("role") in ("E", "SE", "PUBLISHER")]
                    ed_count = max(len(editors), 1)
                    rem_sync = (Decimal("100.00") - Decimal(sync_rate_str)) / Decimal(str(ed_count))

                    has_artist = False
                    for s in w.splits:
                        s_copy = dict(s)
                        if s.get("holder_name") == artist_name:
                            s_copy["sync_share_pct"] = sync_rate_str
                            has_artist = True
                        elif s.get("role") in ("E", "SE", "PUBLISHER"):
                            s_copy["sync_share_pct"] = str(rem_sync.quantize(Decimal("0.01")))
                        new_splits.append(s_copy)

                    if not has_artist and artist_name:
                        new_splits.append({
                            "right_holder_id": str(party_to_holder_id.get(artist_name)) if party_to_holder_id.get(artist_name) else None,
                            "holder_name": artist_name,
                            "role": "I",
                            "ipi_number": None,
                            "dep_share_pct": "0.00",
                            "drm_share_pct": "0.00",
                            "sync_share_pct": sync_rate_str,
                            "phono_share_pct": sync_rate_str,
                            "share_percentage": "0.00",
                        })

                    w.splits = new_splits
                    w_notes = list(w.timeline_notes or [])
                    w_notes.insert(0, {
                        "id": str(uuid4()),
                        "author": payload.validated_by or "Juridique",
                        "text": f"Lettre-Accord Artiste-Interprète (LAI) appliquée : {sync_rate_str}% SYNC alloués à {artist_name} (Art. 2.2 ii sonorisation/synchronisation), solde de {100 - Decimal(sync_rate_str):.2f}% aux éditeurs/producteurs.",
                        "created_at": now.isoformat(),
                    })
                    w.timeline_notes = w_notes
                    w.updated_at = now
                    session.add(w)

        # 3. Initialisation / mise à jour de l'AdvanceLedger si avance > 0
        adv_amt = Decimal(str(contract.advance_amount or "0.00"))
        if adv_amt > Decimal("0.00"):
            existing_ledger = session.exec(
                select(AdvanceLedger).where(AdvanceLedger.contract_id == contract.id)
            ).first()
            if existing_ledger:
                existing_ledger.initial_advance = adv_amt
                existing_ledger.holder_name = contract.counterparty_name
                if contract.right_holder_id:
                    existing_ledger.right_holder_id = contract.right_holder_id
                existing_ledger.updated_at = now
                session.add(existing_ledger)
            else:
                ledger = AdvanceLedger(
                    contract_id=contract.id,
                    contract_reference=contract.contract_reference,
                    right_holder_id=contract.right_holder_id,
                    holder_name=contract.counterparty_name,
                    initial_advance=adv_amt,
                    recouped_amount=Decimal(str(contract.recouped_amount or "0.00")),
                    updated_at=now,
                )
                session.add(ledger)

    session.add(contract)
    session.commit()
    session.refresh(contract)

    _autolink_cession_to_coedition(session, contract)
    return _contract_to_read(contract)


DEMO_CONTRACT_SAMPLES: dict[str, tuple[str, str]] = {
    "minuit_seine": (
        "contrat_cession_minuit_seine.pdf",
        """CONTRAT DE CESSION ET D'EDITION D'OEUVRE MUSICALE
Référence : CTR-2026-MS02
Œuvre : « Minuit sur la Seine »
Article 4 - Clé de répartition des droits :
- Léa Vasseur (Auteur, IPI : 00512398741) : DEP = 25.00 % | DRM = 25.00 %
- Julien Delacroix (Compositeur, IPI : 00623489120) : DEP = 25.00 % | DRM = 25.00 %
- Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50.00 % | DRM = 50.00 %
Article 6 - Avance récupérable :
Une avance récupérable de 5000 EUR HT est consentie à la signature.""",
    ),
    "horizon_veloce": (
        "contrat_coedition_horizon_veloce.pdf",
        """CONTRAT DE COEDITION 50/50
Référence : CTR-2026-HV03
Œuvre : « Horizon Véloce »
Article 4 - Clé de répartition des droits :
- Antoine Garnier (Auteur-Compositeur, IPI : 00734512980) : DEP = 50.00 % | DRM = 50.00 %
- Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 25.00 % | DRM = 25.00 %
- Belleville Publishing (Co-Éditeur, IPI : 00911223344) : DEP = 25.00 % | DRM = 25.00 %
Article 6 - Avance récupérable :
Avance récupérable de 8000 EUR HT.""",
    ),
}


@router.post("/demo/{sample_key}", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
async def extract_demo_contract(
    sample_key: str,
    session: Session = Depends(get_session),
) -> ContractRead:
    """Simule en 1 clic l'upload et l'extraction IA d'un des contrats PDF synthétiques du projet."""
    filename, raw_text = DEMO_CONTRACT_SAMPLES.get(
        sample_key, DEMO_CONTRACT_SAMPLES["minuit_seine"]
    )
    ws = get_or_create_workspace_settings(session)
    extracted = await parse_contract_text_with_ai(
        raw_text,
        source_filename=filename,
        model_override=ws.openrouter_model,
    )

    now = datetime.now(timezone.utc)
    contract = Contract(
        contract_reference=extracted.contract_reference,
        contract_type=extracted.contract_type,
        publisher_name=extracted.publisher_name,
        counterparty_name=extracted.counterparty_name,
        signature_date=extracted.signature_date,
        start_date=extracted.start_date,
        end_date=extracted.end_date,
        territory=extracted.territory,
        duration_years=extracted.duration_years,
        advance_amount=extracted.advance_amount,
        recouped_amount=Decimal("0.00"),
        currency=extracted.currency,
        work_titles=extracted.work_titles,
        work_subgroups=[sg.model_dump(mode="json") for sg in extracted.work_subgroups],
        co_edition_alert=extracted.co_edition_alert,
        requires_cession_contract=extracted.requires_cession_contract,
        expected_cession_contracts=[c.model_dump(mode="json") for c in extracted.expected_cession_contracts],
        audiovisual_program=extracted.audiovisual_program,
        parties=[p.model_dump(mode="json") for p in extracted.parties],
        advance=extracted.advance.model_dump(mode="json") if extracted.advance else None,
        royalty_rules=[r.model_dump(mode="json") for r in extracted.royalty_rules],
        source_filename=extracted.source_filename,
        extracted_clauses_summary=extracted.extracted_clauses_summary,
        cwr_split_warnings=extracted.cwr_split_warnings,
        confidence_score=extracted.confidence_score,
        validation_status=ValidationStatus.PENDING_REVIEW.value,
        created_at=now,
        updated_at=now,
    )
    session.add(contract)
    session.commit()
    session.refresh(contract)

    _autolink_cession_to_coedition(session, contract)
    return _contract_to_read(contract)


@router.post("/batch-delete", status_code=status.HTTP_200_OK)
def batch_delete_contracts(
    payload: ContractBatchDeletePayload,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Supprime un lot de contrats et nettoie les registres d'avances associés."""
    if not payload.contract_ids:
        return {"deleted_count": 0, "deleted_ids": [], "message": "Aucun contrat sélectionné."}

    ws = get_or_create_workspace_settings(session)
    contracts = session.exec(select(Contract).where(Contract.id.in_(payload.contract_ids))).all()
    if not contracts:
        return {"deleted_count": 0, "deleted_ids": [], "message": "Aucun contrat trouvé."}

    deleted_ids = [str(c.id) for c in contracts]
    deleted_refs = [c.contract_reference for c in contracts]

    # Nettoyage des registres d'avances liés
    ledgers = session.exec(select(AdvanceLedger).where(AdvanceLedger.contract_id.in_(payload.contract_ids))).all()
    for ledger in ledgers:
        session.delete(ledger)

    # Découplage dans le grand livre
    entries = session.exec(select(RoyaltyLedgerEntry).where(RoyaltyLedgerEntry.contract_id.in_(payload.contract_ids))).all()
    for entry in entries:
        entry.contract_id = None
        session.add(entry)

    for c in contracts:
        session.delete(c)

    summary_refs = ", ".join(f"« {r} »" for r in deleted_refs[:5])
    if len(deleted_refs) > 5:
        summary_refs += f" et {len(deleted_refs) - 5} autre(s)"

    session.add(
        AuditLog(
            action_type="CONTRACTS_BATCH_DELETED",
            entity_type="CONTRACT",
            entity_id=deleted_ids[0] if deleted_ids else "",
            actor=ws.default_operator_email,
            summary=f"Suppression groupée de {len(contracts)} contrat(s) : {summary_refs}.",
        )
    )
    session.commit()
    return {
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "message": f"{len(deleted_ids)} contrat(s) supprimé(s) avec succès.",
    }


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(contract_id: UUID, session: Session = Depends(get_session)) -> None:
    """Supprime un contrat et nettoie les registres d'avances associés."""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")

    ws = get_or_create_workspace_settings(session)
    contract_ref = contract.contract_reference

    # Nettoyage des registres d'avances liés à ce contrat
    ledgers = session.exec(select(AdvanceLedger).where(AdvanceLedger.contract_id == contract_id)).all()
    for ledger in ledgers:
        session.delete(ledger)

    # Découplage dans le grand livre comptable si existant
    entries = session.exec(select(RoyaltyLedgerEntry).where(RoyaltyLedgerEntry.contract_id == contract_id)).all()
    for entry in entries:
        entry.contract_id = None
        session.add(entry)

    session.delete(contract)
    session.add(
        AuditLog(
            action_type="CONTRACT_DELETED",
            entity_type="CONTRACT",
            entity_id=str(contract_id),
            actor=ws.default_operator_email,
            summary=f"Contrat « {contract_ref} » supprimé.",
        )
    )
    session.commit()


@router.post("/import-cgp1", response_model=CGP1ImportReport, status_code=status.HTTP_201_CREATED)
async def import_sacem_cgp1_or_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> CGP1ImportReport:
    """
    Ingestion Native des Contrats Généraux SACEM (format CGP1 Détail ou tableur CSV) - US-4.1 :
    1. Parse automatiquement le format SACEM CGP1 ou les colonnes CSV de contrats.
    2. Crée ou met à jour les fiches de contrats avec leur numéro officiel SACEM et parties prenantes.
    3. Synchronise automatiquement les intervenants dans l'annuaire des ayants droit.
    """
    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = raw_bytes.decode("latin-1", errors="replace")

    format_detected, parsed_items = parse_cgp1_or_csv_contracts(content, file.filename or "")
    if not parsed_items:
        raise HTTPException(
            status_code=400,
            detail="Aucun contrat valide détecté dans le fichier importé. Vérifiez qu'il s'agit d'un fichier SACEM CGP1 ou d'un fichier CSV avec références contrats.",
        )

    now = datetime.now(timezone.utc)
    contracts_created = 0
    contracts_updated = 0
    imported_reads = []

    # Pre-load existing contracts
    existing_contracts = {
        c.contract_reference.strip().upper(): c
        for c in session.exec(select(Contract)).all()
    }
    existing_by_sacem_num = {
        c.sacem_contract_number.strip(): c
        for c in session.exec(select(Contract)).all()
        if c.sacem_contract_number
    }

    # Pre-load right holders directory
    existing_holders = {
        h.full_name.strip().lower(): h
        for h in session.exec(select(RightHolderDirectory)).all()
    }

    for item in parsed_items:
        ref = item["contract_reference"]
        ref_key = ref.strip().upper()
        sacem_num = item.get("sacem_contract_number")

        contract = existing_contracts.get(ref_key) or (
            existing_by_sacem_num.get(sacem_num.strip()) if sacem_num else None
        )

        if contract:
            contract.sacem_contract_number = sacem_num or contract.sacem_contract_number
            contract.contract_type = item.get("contract_type") or contract.contract_type
            contract.cwr_contract_type = item.get("cwr_type") or contract.cwr_contract_type
            contract.counterparty_name = item.get("counterparty_name") or contract.counterparty_name
            contract.publisher_name = item.get("publisher_name") or contract.publisher_name
            if item.get("start_date"):
                contract.start_date = item["start_date"]
                contract.signature_date = item["start_date"]
            if item.get("end_date"):
                contract.end_date = item["end_date"]
            if item.get("territory"):
                contract.territory = item["territory"]
            if item.get("parties"):
                contract.parties = item["parties"]
            if item.get("extracted_clauses_summary"):
                contract.extracted_clauses_summary = item["extracted_clauses_summary"]
            contract.updated_at = now
            session.add(contract)
            contracts_updated += 1
            imported_reads.append(_contract_to_read(contract))
        else:
            new_contract = Contract(
                contract_reference=ref,
                sacem_contract_number=sacem_num,
                contract_type=item.get("contract_type", "CGP1_SOUS_EDITION"),
                cwr_contract_type=item.get("cwr_type"),
                publisher_name=item.get("publisher_name", "Éditions Solstices Music"),
                counterparty_name=item.get("counterparty_name", "Cédant"),
                signature_date=item.get("signature_date") or item.get("start_date"),
                start_date=item.get("start_date"),
                end_date=item.get("end_date"),
                territory=item.get("territory", "WORLD"),
                duration_years=item.get("duration_years"),
                advance_amount=Decimal("0.00"),
                recouped_amount=Decimal("0.00"),
                currency="EUR",
                work_titles=[],
                parties=item.get("parties", []),
                royalty_rules=[],
                source_filename=file.filename,
                extracted_clauses_summary=item.get("extracted_clauses_summary"),
                cwr_split_warnings=[],
                confidence_score=1.0,
                validation_status=ValidationStatus.VALIDATED.value,
                created_at=now,
                updated_at=now,
            )
            session.add(new_contract)
            session.flush()
            existing_contracts[ref_key] = new_contract
            if sacem_num:
                existing_by_sacem_num[sacem_num.strip()] = new_contract
            contracts_created += 1
            imported_reads.append(_contract_to_read(new_contract))

        # Synchronisation annuaire ayants droit pour le cédant et cessionnaire
        for p in item.get("parties", []):
            p_name = (p.get("party_name") or "").strip()
            p_ipi = (p.get("ipi_number") or "").strip() or None
            p_role = p.get("role", "E")
            if p_name and p_name.lower() not in existing_holders:
                new_h = RightHolderDirectory(
                    full_name=p_name,
                    entity_type="SOCIETE",
                    legal_form="Société d'Édition",
                    primary_role=p_role,
                    ipi_number=p_ipi,
                    affiliated_society="SACEM",
                    society_de="SACEM",
                    society_dr="SACEM",
                )
                session.add(new_h)
                existing_holders[p_name.lower()] = new_h
            elif p_name and p_name.lower() in existing_holders:
                cur_h = existing_holders[p_name.lower()]
                if not cur_h.ipi_number and p_ipi:
                    cur_h.ipi_number = p_ipi
                    cur_h.updated_at = now
                    session.add(cur_h)

    session.commit()

    summary_messages = [
        f"Format détecté : {'Fichier officiel SACEM CGP1 Détail' if format_detected == 'SACEM_CGP1' else 'Tableur CSV de Contrats'}.",
        f"{contracts_created} contrat(s) créé(s) et {contracts_updated} contrat(s) actualisé(s).",
    ]

    return CGP1ImportReport(
        filename=file.filename or "cgp1_import.txt",
        format_detected=format_detected,
        total_records_processed=len(parsed_items),
        contracts_created=contracts_created,
        contracts_updated=contracts_updated,
        summary_messages=summary_messages,
        contracts=imported_reads,
    )


@router.post("/{contract_id}/link-works", response_model=ContractLinkToWorksResult)
def link_contract_to_works(
    contract_id: UUID,
    payload: ContractLinkToWorksPayload,
    session: Session = Depends(get_session),
) -> ContractLinkToWorksResult:
    """
    Liaison Groupée d'un Contrat aux Œuvres du Catalogue (US-4.1) :
    - 'WORK_GROUP' : Lie le contrat à un Projet Audiovisuel (Série TF1, Album) et propage la référence contrat à toutes les œuvres du projet.
    - 'RIGHT_HOLDER_MATCH' : Lie le contrat à toutes les œuvres du catalogue où le cocontractant intervient.
    - 'SPECIFIC_WORKS' : Lie le contrat aux œuvres désignées par leurs identifiants.
    """
    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")

    linked_works_count = 0
    now = datetime.now(timezone.utc)
    summary_message = ""

    if payload.target_mode == "WORK_GROUP":
        if not payload.work_group_id:
            raise HTTPException(status_code=400, detail="work_group_id obligatoire pour le mode WORK_GROUP.")
        group = session.get(WorkGroup, payload.work_group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Groupe d'œuvres introuvable.")

        group.contract_id = contract.id
        group.contract_reference = contract.contract_reference
        group.updated_at = now
        session.add(group)

        links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == group.id)).all()
        work_ids = [l.work_id for l in links]
        if work_ids:
            works = session.exec(select(Work).where(Work.id.in_(work_ids))).all()
            for w in works:
                if payload.override_existing_contract or not (w.contract_reference or "").strip():
                    w.contract_reference = contract.contract_reference
                    w.updated_at = now
                    session.add(w)
                    linked_works_count += 1

        summary_message = f"Contrat {contract.contract_reference} lié au projet « {group.name} » ({linked_works_count} œuvre(s) mise(s) à jour)."

    elif payload.target_mode == "RIGHT_HOLDER_MATCH":
        target_name_or_ipi = (payload.right_holder_name_or_ipi or contract.counterparty_name or "").strip().lower()
        if not target_name_or_ipi:
            raise HTTPException(status_code=400, detail="Nom ou IPI d'ayant droit requis.")

        all_works = session.exec(select(Work)).all()
        for w in all_works:
            splits = w.splits or []
            matches = any(
                (s.get("holder_name") or "").strip().lower() == target_name_or_ipi
                or (s.get("ipi_number") or "").strip().lower() == target_name_or_ipi
                for s in splits
            )
            if matches:
                if payload.override_existing_contract or not (w.contract_reference or "").strip():
                    w.contract_reference = contract.contract_reference
                    w.updated_at = now
                    session.add(w)
                    linked_works_count += 1

        summary_message = f"Contrat {contract.contract_reference} lié à {linked_works_count} œuvre(s) associées à « {target_name_or_ipi} »."

    elif payload.target_mode == "SPECIFIC_WORKS":
        if not payload.work_ids:
            raise HTTPException(status_code=400, detail="work_ids requis pour le mode SPECIFIC_WORKS.")
        works = session.exec(select(Work).where(Work.id.in_(payload.work_ids))).all()
        for w in works:
            w.contract_reference = contract.contract_reference
            w.updated_at = now
            session.add(w)
            linked_works_count += 1

        summary_message = f"Contrat {contract.contract_reference} lié à {linked_works_count} œuvre(s) sélectionnée(s)."

    else:
        raise HTTPException(status_code=400, detail=f"Mode de ciblage non supporté : {payload.target_mode}")

    session.commit()

    return ContractLinkToWorksResult(
        contract_id=contract.id,
        contract_reference=contract.contract_reference,
        linked_works_count=linked_works_count,
        summary_message=summary_message,
    )


@router.post(
    "/{id}/create-work-group",
    response_model=CreateWorkGroupFromContractResult,
    status_code=status.HTTP_201_CREATED,
    summary="Crée un groupe d'œuvres / projet à partir d'un contrat d'édition et y rattache ses œuvres",
)
def create_work_group_from_contract(
    id: UUID,
    payload: CreateWorkGroupFromContractRequest,
    session: Session = Depends(get_session),
) -> CreateWorkGroupFromContractResult:
    contract = session.get(Contract, id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contrat {id} introuvable.",
        )

    now = datetime.now(timezone.utc)
    suggested_name = (
        payload.name.strip()
        if payload.name and payload.name.strip()
        else (contract.audiovisual_program or f"Projet {contract.contract_reference}")
    )

    # Vérifier si un groupe existe déjà sous ce nom
    existing_wg = session.exec(select(WorkGroup).where(WorkGroup.name == suggested_name)).first()
    if existing_wg:
        wg = existing_wg
        if not wg.contract_id:
            wg.contract_id = contract.id
            wg.contract_reference = contract.contract_reference
            session.add(wg)
    else:
        wg = WorkGroup(
            name=suggested_name,
            group_type=payload.group_type or "AUDIOVISUAL",
            production_company=payload.production_company.strip() if payload.production_company else None,
            notes=payload.notes.strip() if payload.notes else f"Créé depuis le contrat {contract.contract_reference} ({contract.publisher_name})",
            contract_id=contract.id,
            contract_reference=contract.contract_reference,
            created_at=now,
            updated_at=now,
        )
        session.add(wg)
        session.flush()

    linked_count = 0
    work_titles_linked: list[str] = []
    for title in contract.work_titles or []:
        w = session.exec(select(Work).where(Work.title == title)).first()
        if not w:
            # Créer l'œuvre si elle n'existait pas encore
            splits_for_work = [
                {
                    "holder_name": p["party_name"],
                    "role": p["role"],
                    "ipi_number": p.get("ipi_number"),
                    "dep_share_pct": str(p["dep_share_pct"]),
                    "drm_share_pct": str(p["drm_share_pct"]),
                    "sync_share_pct": str(p.get("sync_share_pct", "0.00")),
                    "phono_share_pct": str(p.get("phono_share_pct", "0.00")),
                    "share_percentage": str(p["dep_share_pct"]),
                }
                for p in (contract.parties or [])
            ]
            w = Work(
                title=title,
                contract_reference=contract.contract_reference,
                splits=splits_for_work,
                created_at=now,
                updated_at=now,
            )
            session.add(w)
            session.flush()
        else:
            if not w.contract_reference:
                w.contract_reference = contract.contract_reference
            session.add(w)

        # Lier au WorkGroup
        exists_link = session.exec(
            select(WorkGroupLink).where(
                WorkGroupLink.work_group_id == wg.id,
                WorkGroupLink.work_id == w.id,
            )
        ).first()
        if not exists_link:
            link = WorkGroupLink(work_group_id=wg.id, work_id=w.id, added_at=now)
            session.add(link)
            linked_count += 1
        work_titles_linked.append(w.title)

    contract.audiovisual_program = wg.name
    contract.updated_at = now
    session.add(contract)
    session.commit()

    return CreateWorkGroupFromContractResult(
        work_group_id=wg.id,
        work_group_name=wg.name,
        group_type=wg.group_type,
        contract_reference=contract.contract_reference,
        linked_works_count=len(work_titles_linked),
        work_titles=work_titles_linked,
        summary_message=f"Groupe « {wg.name} » rattaché avec succès ({len(work_titles_linked)} œuvre(s)).",
    )

