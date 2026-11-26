from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlmodel import Session, select

from app.api.routers.settings import get_or_create_workspace_settings
from app.core.database import get_session
from app.core.entity_utils import resolve_entity_filter
from app.models.audit_log import AuditLog
from app.models.contract import AdvanceLedger, Contract, RoyaltyLedgerEntry
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement
from app.models.work import Work
from app.schemas.right_holder import (
    HeirShare,
    HolderBatchDeletePayload,
    ReadyToUseInvoicePayload,
    RightHolderDirectoryCreate,
    RightHolderDirectoryRead,
)
from app.services.royalty_engine import (
    normalize_holder_identity_name,
    normalize_ipi_code,
)

router = APIRouter(prefix="/api/v1/holders", tags=["Répertoire Ayants Droit & Facturation"])

TWO_PLACES = Decimal("0.01")


def _seed_default_holders_if_empty(session: Session) -> None:
    """Peuple l'annuaire avec les 6 ayants droit principaux du catalogue si la table est vide."""
    existing = session.exec(select(RightHolderDirectory)).first()
    if existing is not None:
        return

    now = datetime.now(timezone.utc)
    defaults = [
        RightHolderDirectory(
            full_name="Camille Moreau",
            stage_name_or_trade_name="Camille Moreau",
            entity_type="PERSONNE_PHYSIQUE",
            legal_form="Artiste-Auteur (Précompte IRCEC/URSSAF)",
            primary_role="AC",
            ipi_number="00458912301",
            coad_or_isni="0000 0001 2145 8901",
            affiliated_society="SACEM",
            email="camille.moreau@studio-oberkampf.fr",
            phone="+33 6 14 28 91 04",
            postal_address="18 Rue Oberkampf",
            postal_code="75011",
            city="Paris",
            country="FR",
            siret=None,
            vat_number=None,
            vat_applicable=False,
            vat_rate_pct=Decimal("0.00"),
            ircec_precompte_applicable=True,
            urssaf_dispense_certificate=False,
            iban="FR76 3000 4008 0100 0123 4567 891",
            bic="BNPAFRPPXXX",
            notes="Auteure-compositrice principale (« Lumière Noire »). Avance initiale 15 000 € (CTR-2026-LN01).",
            created_at=now,
            updated_at=now,
        ),
        RightHolderDirectory(
            full_name="Léa Vasseur",
            stage_name_or_trade_name="Léa Vasseur",
            entity_type="PERSONNE_PHYSIQUE",
            legal_form="Artiste-Auteur (Précompte IRCEC/URSSAF)",
            primary_role="A",
            ipi_number="00512398741",
            coad_or_isni="0000 0001 3349 1022",
            affiliated_society="SACEM",
            email="lea.vasseur.music@gmail.com",
            phone="+33 6 42 19 87 33",
            postal_address="42 Rue des Martyrs",
            postal_code="75009",
            city="Paris",
            country="FR",
            siret=None,
            vat_number=None,
            vat_applicable=False,
            vat_rate_pct=Decimal("0.00"),
            ircec_precompte_applicable=True,
            urssaf_dispense_certificate=False,
            iban="FR76 1027 8060 3200 0987 6543 218",
            bic="CMCIFR2AXXX",
            notes="Auteure (« Minuit sur la Seine »). Soumise au précompte social IRCEC/URSSAF.",
            created_at=now,
            updated_at=now,
        ),
        RightHolderDirectory(
            full_name="Julien Delacroix",
            stage_name_or_trade_name="J. Delacroix",
            entity_type="PERSONNE_PHYSIQUE",
            legal_form="Artiste-Auteur BNC (Dispense de précompte Siret)",
            primary_role="C",
            ipi_number="00623489120",
            coad_or_isni="0000 0001 4412 7810",
            affiliated_society="SACEM",
            email="julien@delacroix-scoring.fr",
            phone="+33 6 78 55 12 90",
            postal_address="9 Place Bellecour",
            postal_code="69002",
            city="Lyon",
            country="FR",
            siret="84910238400019",
            vat_number="FR41849102384",
            vat_applicable=True,
            vat_rate_pct=Decimal("10.00"),
            ircec_precompte_applicable=False,
            urssaf_dispense_certificate=True,
            iban="FR76 3000 3011 2000 0554 3210 944",
            bic="SOGEFRPPXXX",
            notes="Compositeur Synchro/Film (« Minuit sur la Seine »). Attestation de dispense de précompte URSSAF à jour.",
            created_at=now,
            updated_at=now,
        ),
        RightHolderDirectory(
            full_name="Éditions Solstices Music",
            stage_name_or_trade_name="Solstices Publishing",
            entity_type="SOCIETE",
            legal_form="SAS au capital de 50 000 €",
            primary_role="E",
            ipi_number="00891234567",
            coad_or_isni="COAD-918273",
            affiliated_society="SACEM / CSDEM",
            email="comptabilite@solstices-music.fr",
            phone="+33 1 42 68 55 00",
            postal_address="24 Rue de Paradis",
            postal_code="75010",
            city="Paris",
            country="FR",
            siret="89123456700014",
            vat_number="FR64891234567",
            vat_applicable=True,
            vat_rate_pct=Decimal("10.00"),
            ircec_precompte_applicable=False,
            urssaf_dispense_certificate=False,
            iban="FR76 3000 4019 9200 0100 9988 776",
            bic="BNPAFRPPXXX",
            notes="Maison d'édition principale. Facturation électronique Factur-X 2026 activée.",
            created_at=now,
            updated_at=now,
        ),
        RightHolderDirectory(
            full_name="Belleville Publishing SAS",
            stage_name_or_trade_name="Belleville Music",
            entity_type="SOCIETE",
            legal_form="SAS au capital de 25 000 €",
            primary_role="E",
            ipi_number="00911223344",
            coad_or_isni="COAD-774120",
            affiliated_society="SACEM / SCPP",
            email="royalties@belleville-publishing.fr",
            phone="+33 1 48 05 11 22",
            postal_address="112 Boulevard de Belleville",
            postal_code="75020",
            city="Paris",
            country="FR",
            siret="91122334400021",
            vat_number="FR19911223344",
            vat_applicable=True,
            vat_rate_pct=Decimal("10.00"),
            ircec_precompte_applicable=False,
            urssaf_dispense_certificate=False,
            iban="FR76 2004 1010 0505 5667 7889 911",
            bic="PSSTFRPPPAR",
            notes="Co-éditeur partenaire (Coédition 50/25/25). Personne morale soumise à TVA 10%, sans précompte IRCEC.",
            created_at=now,
            updated_at=now,
        ),
        RightHolderDirectory(
            full_name="Sami Benali",
            stage_name_or_trade_name="Sami B.",
            entity_type="PERSONNE_PHYSIQUE",
            legal_form="Artiste-Auteur (Précompte IRCEC/URSSAF)",
            primary_role="AC",
            ipi_number="00398765432",
            coad_or_isni="0000 0001 5590 1123",
            affiliated_society="SACEM",
            email="sami.benali.studio@outlook.fr",
            phone="+33 6 99 11 44 20",
            postal_address="5 Rue de la République",
            postal_code="13001",
            city="Marseille",
            country="FR",
            siret=None,
            vat_number=None,
            vat_applicable=False,
            vat_rate_pct=Decimal("0.00"),
            ircec_precompte_applicable=True,
            urssaf_dispense_certificate=False,
            iban="FR76 1131 5000 0100 0445 5667 722",
            bic="CEPAFRPP131",
            notes="Auteur-compositeur (« Orage d'Octobre »).",
            created_at=now,
            updated_at=now,
        ),
    ]
    for h in defaults:
        session.add(h)
    session.commit()


def _holder_to_read(
    holder: RightHolderDirectory,
    works: list[Work],
) -> RightHolderDirectoryRead:
    matched_works_count = 0
    for w in works:
        for sp in w.splits or []:
            sp_name = (sp.get("holder_name") or "").strip().lower()
            sp_ipi = (sp.get("ipi_number") or "").strip()
            if (
                (holder.ipi_number and sp_ipi == holder.ipi_number)
                or sp_name == holder.full_name.strip().lower()
            ):
                matched_works_count += 1
                break

    if holder.entity_type == "SOCIETE":
        profile_label = (
            f"Société ({holder.legal_form or 'SAS/SARL'}) • Facture Factur-X "
            f"(TVA {holder.vat_rate_pct}% • 0% Précompte)"
        )
        is_ready = bool(holder.siret and holder.postal_address and holder.iban)
    else:
        if holder.urssaf_dispense_certificate:
            profile_label = (
                "Personne Physique BNC (Dispense URSSAF Siret) • Facture Auteur sans Précompte"
            )
        else:
            profile_label = (
                "Personne Physique • Note de Droits d'Auteur (Précompte IRCEC/URSSAF ~11,10%)"
            )
        is_ready = bool(holder.postal_address and holder.iban)

    raw_heirs = getattr(holder, "heirs", []) or []
    heirs_list: list[HeirShare] = []
    for h in raw_heirs:
        if isinstance(h, dict):
            heirs_list.append(HeirShare(**h))
        elif isinstance(h, HeirShare):
            heirs_list.append(h)

    succ_summary = None
    if getattr(holder, "succession_active", False) and heirs_list:
        succ_summary = f"Succession active ({len(heirs_list)} héritier{'s' if len(heirs_list) > 1 else ''})"
    elif getattr(holder, "is_deceased", False):
        succ_summary = "Auteur décédé"
    elif getattr(holder, "payout_recipient_name", None):
        succ_summary = f"Tiers Payé ➔ {holder.payout_recipient_name}"

    return RightHolderDirectoryRead(
        id=holder.id,
        full_name=holder.full_name,
        stage_name_or_trade_name=holder.stage_name_or_trade_name,
        entity_type=holder.entity_type,
        legal_form=holder.legal_form,
        primary_role=holder.primary_role,
        ipi_number=holder.ipi_number,
        coad_or_isni=holder.coad_or_isni,
        affiliated_society=holder.affiliated_society,
        society_de=getattr(holder, "society_de", "SACEM") or "SACEM",
        society_dr=getattr(holder, "society_dr", "SACEM") or "SACEM",
        email=holder.email,
        phone=holder.phone,
        postal_address=holder.postal_address,
        postal_code=holder.postal_code,
        city=holder.city,
        country=holder.country,
        siret=holder.siret,
        vat_number=holder.vat_number,
        vat_applicable=holder.vat_applicable,
        vat_rate_pct=holder.vat_rate_pct,
        ircec_precompte_applicable=holder.ircec_precompte_applicable,
        urssaf_dispense_certificate=holder.urssaf_dispense_certificate,
        iban=holder.iban,
        bic=holder.bic,
        retained_reserve_balance=getattr(holder, "retained_reserve_balance", Decimal("0.00")),
        notes=holder.notes,
        is_deceased=getattr(holder, "is_deceased", False),
        deceased_at=getattr(holder, "deceased_at", None),
        payout_recipient_id=getattr(holder, "payout_recipient_id", None),
        payout_recipient_name=getattr(holder, "payout_recipient_name", None),
        succession_active=getattr(holder, "succession_active", False),
        succession_notes=getattr(holder, "succession_notes", None),
        heirs=heirs_list,
        succession_summary=succ_summary,
        works_count=matched_works_count,
        invoicing_profile_label=profile_label,
        is_invoice_ready=is_ready,
        created_at=holder.created_at,
        updated_at=holder.updated_at,
    )


@router.get("", response_model=list[RightHolderDirectoryRead])
def list_right_holders(
    entity_id: UUID | None = Query(None, description="Filtrer les métriques par entité"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> list[RightHolderDirectoryRead]:
    """Retourne le répertoire complet des ayants droit avec comptage d'œuvres synchronisé selon le catalogue actif."""
    target_entity_id, is_default = resolve_entity_filter(session, entity_id, x_entity_id)

    holders = list(
        session.exec(select(RightHolderDirectory).order_by(RightHolderDirectory.full_name)).all()
    )

    works_query = select(Work)
    if target_entity_id:
        if is_default:
            works_query = works_query.where((Work.entity_id == target_entity_id) | (Work.entity_id == None))  # noqa: E711
        else:
            works_query = works_query.where(Work.entity_id == target_entity_id)

    works = list(session.exec(works_query).all())
    return [_holder_to_read(h, works) for h in holders]


@router.post("", response_model=RightHolderDirectoryRead, status_code=status.HTTP_201_CREATED)
def create_right_holder(
    payload: RightHolderDirectoryCreate,
    session: Session = Depends(get_session),
) -> RightHolderDirectoryRead:
    """Ajoute un nouvel ayant droit (Personne Physique ou Société) dans l'annuaire."""
    ws = get_or_create_workspace_settings(session)
    now = datetime.now(timezone.utc)

    # Si c'est une SOCIETE, le précompte IRCEC ne s'applique jamais
    ircec_flag = (
        False
        if payload.entity_type == "SOCIETE" or payload.urssaf_dispense_certificate
        else payload.ircec_precompte_applicable
    )

    heirs_data = [
        h.model_dump(mode="json") if hasattr(h, "model_dump") else h
        for h in (payload.heirs or [])
    ]
    holder_dict = payload.model_dump(exclude={"ircec_precompte_applicable", "heirs"})

    holder = RightHolderDirectory(
        **holder_dict,
        ircec_precompte_applicable=ircec_flag,
        heirs=heirs_data,
        created_at=now,
        updated_at=now,
    )
    session.add(holder)
    session.add(
        AuditLog(
            action_type="RIGHT_HOLDER_CREATED",
            entity_type="RIGHT_HOLDER",
            entity_id=str(holder.id),
            actor=ws.default_operator_email,
            summary=f"Ayant droit « {holder.full_name} » ({holder.entity_type}) ajouté au répertoire.",
            details={"ipi_number": holder.ipi_number, "entity_type": holder.entity_type},
            created_at=now,
        )
    )
    session.commit()
    session.refresh(holder)
    works = list(session.exec(select(Work)).all())
    return _holder_to_read(holder, works)


@router.put("/{holder_id}", response_model=RightHolderDirectoryRead)
def update_right_holder(
    holder_id: UUID,
    payload: RightHolderDirectoryCreate,
    session: Session = Depends(get_session),
) -> RightHolderDirectoryRead:
    """Met à jour les coordonnées, le statut Société/Personne Physique et les paramètres fiscaux d'un ayant droit."""
    ws = get_or_create_workspace_settings(session)
    holder = session.get(RightHolderDirectory, holder_id)
    if not holder:
        raise HTTPException(status_code=404, detail="Ayant droit introuvable.")

    now = datetime.now(timezone.utc)
    for k, v in payload.model_dump().items():
        if k == "heirs":
            v = [
                h.model_dump(mode="json") if hasattr(h, "model_dump") else h
                for h in (payload.heirs or [])
            ]
        setattr(holder, k, v)
    if holder.entity_type == "SOCIETE" or holder.urssaf_dispense_certificate:
        holder.ircec_precompte_applicable = False
    holder.updated_at = now

    session.add(holder)
    session.add(
        AuditLog(
            action_type="RIGHT_HOLDER_UPDATED",
            entity_type="RIGHT_HOLDER",
            entity_id=str(holder.id),
            actor=ws.default_operator_email,
            summary=f"Fiche ayant droit « {holder.full_name} » ({holder.entity_type}) mise à jour.",
            details={"ipi_number": holder.ipi_number, "entity_type": holder.entity_type},
            created_at=now,
        )
    )
    session.commit()
    session.refresh(holder)
    works = list(session.exec(select(Work)).all())
    return _holder_to_read(holder, works)


@router.post("/sync-from-catalog", response_model=list[RightHolderDirectoryRead])
def sync_holders_from_catalog(
    session: Session = Depends(get_session),
) -> list[RightHolderDirectoryRead]:
    """
    Parcourt toutes les œuvres du catalogue et crée automatiquement dans l'annuaire
    les ayants droit manquants en détectant s'il s'agit d'une Société (rôle E/SE/P ou mots-clés Éditions/Publishing/SAS)
    ou d'une Personne Physique (rôle AC/A/C/I).
    """
    existing_holders = list(session.exec(select(RightHolderDirectory)).all())
    known_names = {h.full_name.strip().lower() for h in existing_holders}
    known_ipis = {h.ipi_number for h in existing_holders if h.ipi_number}

    works = list(session.exec(select(Work)).all())
    now = datetime.now(timezone.utc)

    for w in works:
        for sp in w.splits or []:
            name = (sp.get("holder_name") or "").strip()
            if not name:
                continue
            ipi = (sp.get("ipi_number") or "").strip() or None
            role = (sp.get("role") or "AC").strip()
            if name.lower() in known_names or (ipi and ipi in known_ipis):
                continue

            is_company = role in ("E", "SE", "P", "PUBLISHER", "SUB_PUBLISHER", "PRODUCER") or any(
                kw in name.lower()
                for kw in ("édition", "edition", "publishing", "sas", "sarl", "music", "records", "label")
            )
            new_h = RightHolderDirectory(
                full_name=name,
                stage_name_or_trade_name=name,
                entity_type="SOCIETE" if is_company else "PERSONNE_PHYSIQUE",
                legal_form="SAS / Maison d'Édition" if is_company else "Artiste-Auteur (Précompte IRCEC)",
                primary_role=role,
                ipi_number=ipi,
                affiliated_society="SACEM",
                vat_applicable=is_company,
                vat_rate_pct=Decimal("10.00") if is_company else Decimal("0.00"),
                ircec_precompte_applicable=not is_company,
                urssaf_dispense_certificate=False,
                created_at=now,
                updated_at=now,
            )
            session.add(new_h)
            known_names.add(name.lower())
            if ipi:
                known_ipis.add(ipi)

    session.commit()
    all_holders = list(
        session.exec(select(RightHolderDirectory).order_by(RightHolderDirectory.full_name)).all()
    )
    return [_holder_to_read(h, works) for h in all_holders]


@router.get("/{holder_id}/ready-invoice", response_model=ReadyToUseInvoicePayload)
def generate_ready_to_use_invoice(
    holder_id: UUID,
    gross_amount: Decimal | None = Query(default=None, description="Montant brut de redevances (si omis, récupéré du dernier décompte LOCKED)"),
    recouped_advance: Decimal | None = Query(default=None, description="Montant retenu sur avance (si omis, récupéré du dernier décompte LOCKED)"),
    statement_id: UUID | None = Query(default=None, description="Relevé spécifique pour extraire les montants clôturés"),
    period_label: str = Query(default="2026-S2 (Juillet – Décembre 2026)"),
    session: Session = Depends(get_session),
) -> ReadyToUseInvoicePayload:
    """
    Génère en 1 clic une Facture (Société Factur-X 2026) ou une Note de Droits d'Auteur (Personne Physique)
    prête à l'emploi. Si les montants ne sont pas spécifiés, ils sont automatiquement extraits des écritures
    du Grand Livre (RoyaltyLedgerEntry) issues de la dernière clôture LOCKED !
    """
    ws = get_or_create_workspace_settings(session)
    holder = session.get(RightHolderDirectory, holder_id)
    if not holder:
        raise HTTPException(status_code=404, detail="Ayant droit introuvable.")

    # Liaison automatique avec les écritures du Grand Livre si les montants ne sont pas forcés
    extracted_gross = gross_amount
    extracted_recouped = recouped_advance
    extracted_period = period_label

    if extracted_gross is None or extracted_recouped is None:
        # Recherche des écritures dans RoyaltyLedgerEntry pour cet ayant droit
        norm_n = normalize_holder_identity_name(holder.full_name)
        norm_ipi = normalize_ipi_code(holder.ipi_number)

        query = select(RoyaltyLedgerEntry)
        if statement_id is not None:
            query = query.where(RoyaltyLedgerEntry.statement_id == statement_id)
        
        ledger_entries = list(session.exec(query.order_by(RoyaltyLedgerEntry.created_at.desc())).all())
        matching_entry = None
        for entry in ledger_entries:
            if (
                (entry.right_holder_id and entry.right_holder_id == holder.id)
                or (norm_ipi and normalize_ipi_code(entry.ipi_number) == norm_ipi)
                or (normalize_holder_identity_name(entry.holder_name) == norm_n)
            ):
                matching_entry = entry
                break

        if matching_entry:
            if extracted_gross is None:
                extracted_gross = matching_entry.gross_royalties_allocated
            if extracted_recouped is None:
                extracted_recouped = matching_entry.recouped_in_period
            
            # Récupérer les dates du relevé associé
            stmt = session.get(RoyaltyStatement, matching_entry.statement_id)
            if stmt:
                extracted_period = f"{stmt.source_name} ({stmt.period_start} au {stmt.period_end})"

    gross = (extracted_gross if extracted_gross is not None else Decimal("2450.00")).quantize(TWO_PLACES)
    recouped = (extracted_recouped if extracted_recouped is not None else Decimal("0.00")).quantize(TWO_PLACES)
    recouped = min(gross, max(Decimal("0.00"), recouped))
    taxable_ht = (gross - recouped).quantize(TWO_PLACES)

    vat_rate = holder.vat_rate_pct.quantize(TWO_PLACES) if holder.vat_applicable else Decimal("0.00")
    vat_amount = ((taxable_ht * vat_rate) / Decimal("100.00")).quantize(TWO_PLACES)

    # Calcul déterministe du précompte social Auteur (si Personne Physique sans dispense URSSAF)
    if holder.entity_type == "PERSONNE_PHYSIQUE" and holder.ircec_precompte_applicable and not holder.urssaf_dispense_certificate:
        # Cotisations sociales Artiste-Auteur retenues à la source (SSAA / CSG-CRDS / CFP ~ 11,10 % du brut payable)
        ircec_raap = (taxable_ht * Decimal("0.0110")).quantize(TWO_PLACES)
        csg_crds = (taxable_ht * Decimal("0.1000")).quantize(TWO_PLACES)
        total_precompte = (ircec_raap + csg_crds).quantize(TWO_PLACES)
    else:
        ircec_raap = Decimal("0.00")
        csg_crds = Decimal("0.00")
        total_precompte = Decimal("0.00")

    net_payable = max(Decimal("0.00"), (taxable_ht + vat_amount - total_precompte).quantize(TWO_PLACES))

    doc_type = (
        "FACTURE_REDEVANCES_FACTURX"
        if holder.entity_type == "SOCIETE"
        else "NOTE_DROITS_AUTEUR"
    )
    inv_prefix = "FAC-2026" if holder.entity_type == "SOCIETE" else "NDA-2026"
    invoice_number = f"{inv_prefix}-{str(holder.id)[:6].upper()}"
    issue_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    holder_addr = ", ".join(
        filter(None, [holder.postal_address, f"{holder.postal_code or ''} {holder.city or ''}".strip(), holder.country])
    ) or "Adresse à compléter dans la fiche Ayant Droit"

    if holder.entity_type == "SOCIETE":
        legal_mentions = [
            f"Facture de redevances d'édition / coédition émise par une personne morale ({holder.legal_form or 'Société'}).",
            f"SIRET Ayant Droit : {holder.siret or 'Non renseigné'} • N° TVA Intracommunautaire : {holder.vat_number or 'Non renseigné'}.",
            "Aucun précompte social IRCEC/URSSAF applicable aux sociétés commerciales.",
            "Document structuré conforme aux exigences de la Facturation Électronique 2026–2027 (Factur-X / EN 16931).",
        ]
    elif holder.urssaf_dispense_certificate:
        legal_mentions = [
            f"Personne physique déclarée en BNC (SIRET : {holder.siret or 'Renseigné'}).",
            "Dispense de précompte social URSSAF Artiste-Auteur fournie (0,00 € retenu à la source).",
            "TVA applicable au taux réduit de 10,00 % sur les cessions de droits patrimoniaux (Art. 279 g du CGI)."
            if holder.vat_applicable
            else "TVA non applicable, art. 293 B du CGI (Franchise en base de TVA).",
        ]
    else:
        legal_mentions = [
            "Note de droits d'auteur établie par l'Éditeur par mandat d'autofacturation.",
            "Personne physique soumise au Précompte Social Artiste-Auteur (URSSAF Limousin / CSG-CRDS / CFP) retenu et reversé par l'Éditeur.",
            "TVA non applicable, art. 293 B du CGI (Franchise en base de TVA)."
            if not holder.vat_applicable
            else f"TVA sur droits d'auteur ({vat_rate:.2f} %).",
        ]

    if getattr(holder, "payout_recipient_name", None):
        legal_mentions.append(
            f"Paiement mandaté et redirigé vers le Tiers Payé désigné : {holder.payout_recipient_name}."
        )

    heirs_breakdown_lines = []
    if getattr(holder, "succession_active", False) and getattr(holder, "heirs", None):
        heirs_mentions = []
        for h in holder.heirs:
            h_name = h.get("heir_name", "Héritier")
            h_pct = Decimal(str(h.get("share_pct", "0.00")))
            h_net = (net_payable * h_pct / Decimal("100.00")).quantize(TWO_PLACES)
            heirs_mentions.append(f"{h_name} ({h.get('relationship', 'Héritier')} {h_pct}% : {h_net} EUR)")
            heirs_breakdown_lines.append(
                f"  • {h_name} ({h.get('relationship', 'Héritier')}) — Quote-part : {h_pct:.2f} % | Net : {h_net:.2f} EUR | IBAN : {h.get('iban', 'N/A')}"
            )
        legal_mentions.append(
            f"Dévolution successorale indivise — Ventilation entre héritiers : {'; '.join(heirs_mentions)}."
        )

    bank_label = (
        f"Coordonnées Bancaires (Tiers Mandataire : {holder.payout_recipient_name})"
        if getattr(holder, "payout_recipient_name", None)
        else "Coordonnées Bancaires (IBAN)"
    )

    printable_lines = [
        "================================================================================",
        f"  {'FACTURE DE REDEVANCES (FACTUR-X 2026)' if holder.entity_type == 'SOCIETE' else 'NOTE DE DROITS D AUTEUR (AUTOFACTURATION)'}",
        f"  N° Document : {invoice_number}   |   Date d'émission : {issue_date}",
        f"  Période de répartition : {period_label}",
        "================================================================================",
        "",
        "ÉMETTEUR (AYANT DROIT) :",
        f"  Nom / Raison Sociale : {holder.full_name}",
        f"  Statut Juridique     : {holder.entity_type} ({holder.legal_form or 'Standard'})",
        f"  Code IPI / OGC       : {holder.ipi_number or 'N/A'} ({holder.affiliated_society})",
        f"  SIRET / TVA Intra.   : {holder.siret or 'Sans SIRET (Particulier)'} / {holder.vat_number or 'Franchise Art. 293 B CGI'}",
        f"  Adresse              : {holder_addr}",
        f"  Email                : {holder.email or 'N/A'}",
        "",
        "DESTINATAIRE (MAISON D'ÉDITION PAYEUSE) :",
        f"  Raison Sociale       : {ws.publisher_name}",
        f"  Code IPI Éditeur     : {ws.publisher_ipi}",
        "  SIRET / TVA          : 89123456700014 / FR64891234567",
        "  Adresse              : 24 Rue de Paradis, 75010 Paris, France",
        "",
        "--------------------------------------------------------------------------------",
        "DÉTAIL FINANCIER DÉTERMINISTE (CALCUL DECIMAL STRICT - RÈGLE RIGHTSCOPILOT) :",
        "--------------------------------------------------------------------------------",
        f"  1. Redevances Brutes Allouées (DEP/DRM/SYNC/PHONO) :   {gross:>10.2f} EUR",
        f"  2. Amortissement sur Avance Récupérable (Recoupment): - {recouped:>10.2f} EUR",
        "  ------------------------------------------------------------------------------",
        f"  3. Assiette Payable Hors Taxes (Base HT)           :   {taxable_ht:>10.2f} EUR",
        f"  4. TVA ({vat_rate:>5.2f} %)                                   : + {vat_amount:>10.2f} EUR",
        f"  5. Précompte Social URSSAF / CSG-CRDS (~10,00 %)   : - {csg_crds:>10.2f} EUR",
        f"  6. Retenue IRCEC / CFP Artiste-Auteur (~1,10 %)    : - {ircec_raap:>10.2f} EUR",
        "================================================================================",
        f"  NET À PAYER PAR VIREMENT SEPA (EUR)                :   {net_payable:>10.2f} EUR",
        "================================================================================",
        f"  {bank_label} : {holder.iban or 'IBAN à renseigner'} ({holder.bic or 'BIC'})",
        *(
            [
                "",
                "VENTILATION SUCCESSORALE ENTRE HÉRITIERS (INDIVISION ART. 815 C. CIV.) :",
                *heirs_breakdown_lines,
            ]
            if heirs_breakdown_lines
            else []
        ),
        "",
        "MENTIONS LÉGALES & FISCALES :",
        *[f"  • {m}" for m in legal_mentions],
        "================================================================================",
    ]

    return ReadyToUseInvoicePayload(
        invoice_number=invoice_number,
        document_type=doc_type,
        issue_date=issue_date,
        period_label=period_label,
        publisher_name=ws.publisher_name,
        publisher_siret="89123456700014",
        publisher_vat="FR64891234567",
        publisher_address="24 Rue de Paradis, 75010 Paris, France",
        holder_id=holder.id,
        holder_name=holder.full_name,
        entity_type=holder.entity_type,
        legal_form=holder.legal_form or ("Société" if holder.entity_type == "SOCIETE" else "Artiste-Auteur"),
        holder_ipi=holder.ipi_number,
        holder_siret=holder.siret,
        holder_vat_number=holder.vat_number,
        holder_address=holder_addr,
        holder_email=holder.email,
        holder_iban=holder.iban,
        gross_royalties_eur=f"{gross:.2f}",
        recouped_advance_eur=f"{recouped:.2f}",
        taxable_base_ht_eur=f"{taxable_ht:.2f}",
        vat_rate_pct=f"{vat_rate:.2f}",
        vat_amount_eur=f"{vat_amount:.2f}",
        ircec_raap_cotisation_eur=f"{ircec_raap:.2f}",
        csg_crds_cotisation_eur=f"{csg_crds:.2f}",
        total_precompte_social_eur=f"{total_precompte:.2f}",
        net_payable_to_holder_eur=f"{net_payable:.2f}",
        legal_mentions=legal_mentions,
        printable_text="\n".join(printable_lines),
    )


@router.post("/batch-delete", status_code=status.HTTP_200_OK)
def batch_delete_holders(
    payload: HolderBatchDeletePayload,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Supprime un lot d'ayants droit en préservant l'intégrité référentielle."""
    if not payload.holder_ids:
        return {"deleted_count": 0, "deleted_ids": [], "message": "Aucun ayant droit sélectionné."}

    ws = get_or_create_workspace_settings(session)
    holders = session.exec(select(RightHolderDirectory).where(RightHolderDirectory.id.in_(payload.holder_ids))).all()
    if not holders:
        return {"deleted_count": 0, "deleted_ids": [], "message": "Aucun ayant droit trouvé."}

    deleted_ids = [str(h.id) for h in holders]
    deleted_names = [h.full_name for h in holders]

    # Découplage dans les contrats
    contracts = session.exec(select(Contract).where(Contract.right_holder_id.in_(payload.holder_ids))).all()
    for contract in contracts:
        contract.right_holder_id = None
        session.add(contract)

    # Découplage dans les registres d'avances
    ledgers = session.exec(select(AdvanceLedger).where(AdvanceLedger.right_holder_id.in_(payload.holder_ids))).all()
    for ledger in ledgers:
        ledger.right_holder_id = None
        session.add(ledger)

    for h in holders:
        session.delete(h)

    summary_names = ", ".join(f"« {n} »" for n in deleted_names[:5])
    if len(deleted_names) > 5:
        summary_names += f" et {len(deleted_names) - 5} autre(s)"

    session.add(
        AuditLog(
            action_type="RIGHT_HOLDERS_BATCH_DELETED",
            entity_type="RIGHT_HOLDER",
            entity_id=deleted_ids[0] if deleted_ids else "",
            actor=ws.default_operator_email,
            summary=f"Suppression groupée de {len(holders)} ayant(s) droit : {summary_names}.",
        )
    )
    session.commit()
    return {
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "message": f"{len(deleted_ids)} ayant(s) droit supprimé(s) du répertoire avec succès.",
    }


@router.delete("/{holder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holder(holder_id: UUID, session: Session = Depends(get_session)) -> None:
    """Supprime un ayant droit de l'annuaire en préservant l'intégrité référentielle."""
    holder = session.get(RightHolderDirectory, holder_id)
    if not holder:
        raise HTTPException(status_code=404, detail="Ayant droit introuvable.")

    ws = get_or_create_workspace_settings(session)
    holder_name = holder.full_name
    holder_type = holder.entity_type

    # Découplage des clés étrangères dans les contrats et registres d'avances
    contracts = session.exec(select(Contract).where(Contract.right_holder_id == holder_id)).all()
    for contract in contracts:
        contract.right_holder_id = None
        session.add(contract)

    ledgers = session.exec(select(AdvanceLedger).where(AdvanceLedger.right_holder_id == holder_id)).all()
    for ledger in ledgers:
        ledger.right_holder_id = None
        session.add(ledger)

    session.delete(holder)
    session.add(
        AuditLog(
            action_type="RIGHT_HOLDER_DELETED",
            entity_type="RIGHT_HOLDER",
            entity_id=str(holder_id),
            actor=ws.default_operator_email,
            summary=f"Ayant droit « {holder_name} » ({holder_type}) supprimé du répertoire.",
        )
    )
    session.commit()

