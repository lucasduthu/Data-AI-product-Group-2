import re
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Response, UploadFile, status
from sqlmodel import Session, select

from app.api.routers.settings import get_or_create_workspace_settings
from app.core.database import get_session
from app.core.entity_utils import resolve_entity_filter
from app.models.audit_log import AuditLog
from app.models.contract import Contract
from app.models.publishing_entity import PublishingEntity
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.services.royalty_engine import normalize_holder_identity_name, normalize_ipi_code
from app.schemas.work import (
    CWRValidationReport,
    CatalogAuditReport,
    CatalogAutoRepairPayload,
    CatalogAutoRepairResult,
    CwrAckItem,
    CwrAckReport,
    RightHolderSplit,
    WorkAuditIssueCategory,
    WorkAuditIssueItem,
    WorkAuditIssueSeverity,
    WorkAuditReportItem,
    WorkBatchDeletePayload,
    WorkBatchUpdatePayload,
    WorkBatchUpdateResult,
    WorkCreate,
    WorkGroupReadSummary,
    WorkLifeCycleStatus,
    WorkRead,
    WorkTimelineNote,
    WorkTimelineNoteCreate,
)
from app.services.catalog_migration_service import (
    SAMPLE_LE_SAGE_EXPORT_CSV,
    CatalogMigrationReport,
    run_catalog_migration,
)
from app.services.cwr_ack_parser import process_cwr_ack
from app.services.cwr_exporter import generate_cwr_v21_content
from app.services.cwr_validator import validate_work_cwr
from app.services.embedding_service import compute_text_embedding
from app.services.xlsx_exporter import generate_subpublishing_delivery_xlsx, generate_works_visibility_xlsx
from app.services.xlsx_parser import read_xlsx_as_csv

router = APIRouter(prefix="/api/v1/works", tags=["Catalogue & CWR"])


def _get_work_group_summaries(work_id: UUID, session: Session) -> list[WorkGroupReadSummary]:
    links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_id == work_id)).all()
    if not links:
        return []
    group_ids = [link.work_group_id for link in links]
    groups = session.exec(select(WorkGroup).where(WorkGroup.id.in_(group_ids))).all()
    groups_by_id = {g.id: g for g in groups}
    summaries: list[WorkGroupReadSummary] = []
    for link in links:
        if link.work_group_id in groups_by_id:
            g = groups_by_id[link.work_group_id]
            summaries.append(
                WorkGroupReadSummary(
                    id=g.id,
                    name=g.name,
                    group_type=g.group_type,
                    production_company=g.production_company,
                    broadcaster_or_client=g.broadcaster_or_client,
                    contract_reference=g.contract_reference,
                    cue_usage_type=link.cue_usage_type,
                    track_or_cue_number=link.track_or_cue_number,
                )
            )
    return summaries


def _normalize_subtitles_and_aliases(
    subtitle: str | None,
    alternate_titles: list[str] | None,
) -> tuple[str | None, list[str]]:
    """
    Normalise les sous-titres et titres alternatifs.
    Permet à l'utilisateur d'inscrire plusieurs sous-titres / titres alternatifs séparés par ';'
    (ou retours à la ligne), sans tenir compte des espaces (' ; ', '; ', ' ;').
    Le premier élément reste le sous-titre officiel, les éléments suivants ou additionnels
    sont automatiquement intégrés et dédoublonnés dans les titres alternatifs.
    """
    cleaned_alts: list[str] = []
    seen: set[str] = set()

    def _add_token(t: str) -> None:
        token = t.strip()
        if token and token.upper() not in seen:
            seen.add(token.upper())
            cleaned_alts.append(token)

    primary_sub: str | None = None
    if subtitle:
        sub_tokens = [s.strip() for s in re.split(r"[;\n]", subtitle) if s.strip()]
        if sub_tokens:
            primary_sub = sub_tokens[0]
            for extra in sub_tokens[1:]:
                _add_token(extra)

    if alternate_titles:
        for item in alternate_titles:
            if not item:
                continue
            for piece in re.split(r"[;\n]", item):
                _add_token(piece)

    return primary_sub, cleaned_alts


def resolve_work_lifecycle_status(
    work: Work,
    cwr_ready: bool,
    cwr_errors: list[str],
) -> tuple[WorkLifeCycleStatus, str, list[str]]:
    """Résout l'état métier éloquent de l'œuvre (US-5.16).
    Si l'utilisateur a choisi un état explicite, on respecte son choix.
    Sinon on applique l'état par défaut : INFORMATIONS_MANQUANTES si incomplet, A_DEPOSER si complet.
    """
    labels = {
        WorkLifeCycleStatus.INFORMATIONS_MANQUANTES.value: "Informations manquantes",
        WorkLifeCycleStatus.A_DEPOSER.value: "À déposer",
        WorkLifeCycleStatus.DEPOSE_EN_ATTENTE.value: "Déposé (En attente d'ACK)",
        WorkLifeCycleStatus.DEPOSE_ET_EXPLOITE.value: "Déposé & Exploité",
        WorkLifeCycleStatus.REJET_SACEM.value: "Rejet SACEM",
        WorkLifeCycleStatus.ARCHIVE.value: "Archivé / Non administré",
    }

    user_status = getattr(work, "lifecycle_status", None)
    if user_status:
        try:
            enum_status = WorkLifeCycleStatus(user_status)
        except ValueError:
            enum_status = WorkLifeCycleStatus.INFORMATIONS_MANQUANTES
        issues = cwr_errors if not cwr_ready else []
        return enum_status, labels.get(enum_status.value, user_status), issues

    admin_status = (getattr(work, "administration_status", "ACTIVE") or "ACTIVE").upper()
    if admin_status == "ARCHIVED":
        return WorkLifeCycleStatus.ARCHIVE, "Archivé / Non administré", []

    sacem_status = getattr(work, "sacem_registration_status", None)
    if sacem_status == "REJECTED":
        reason = getattr(work, "sacem_rejection_reason", None)
        return WorkLifeCycleStatus.REJET_SACEM, "Rejet SACEM", [reason] if reason else ["Rejet notifié par accusé SACEM"]

    if sacem_status == "REGISTERED" or (work.sacem_work_code and cwr_ready):
        return WorkLifeCycleStatus.DEPOSE_ET_EXPLOITE, "Déposé & Exploité", []

    if sacem_status == "PENDING_ACK":
        ref = getattr(work, "sacem_ack_reference", None)
        issues = [f"Lot CWR transmis : {ref}"] if ref else ["Fichier CWR transmis à la SACEM"]
        return WorkLifeCycleStatus.DEPOSE_EN_ATTENTE, "Déposé (En attente d'ACK)", issues

    if not cwr_ready:
        return WorkLifeCycleStatus.INFORMATIONS_MANQUANTES, "Informations manquantes", cwr_errors

    return WorkLifeCycleStatus.A_DEPOSER, "À déposer", []


def _work_to_read(
    work: Work,
    max_publisher_dep_pct: Decimal = Decimal("50.00"),
    groups: list[WorkGroupReadSummary] | None = None,
) -> WorkRead:
    splits = [RightHolderSplit.model_validate(s) for s in (work.splits or [])]
    cwr_report = validate_work_cwr(
        work_title=work.title,
        splits=splits,
        iswc=work.iswc,
        work_id=work.id,
        max_publisher_dep_pct=max_publisher_dep_pct,
    )
    timeline_notes = [
        WorkTimelineNote.model_validate(n) for n in (work.timeline_notes or [])
    ]
    lifecycle_status, lifecycle_label, lifecycle_issues = resolve_work_lifecycle_status(
        work=work,
        cwr_ready=cwr_report.is_cwr_ready,
        cwr_errors=cwr_report.blocking_errors,
    )
    return WorkRead(
        id=work.id,
        title=work.title,
        subtitle=work.subtitle,
        alternate_titles=work.alternate_titles or [],
        iswc=work.iswc,
        sacem_work_code=work.sacem_work_code,
        cotage_number=work.cotage_number,
        isrc_codes=work.isrc_codes or [],
        performers=work.performers or [],
        genre=work.genre,
        duration_seconds=work.duration_seconds,
        creation_year=work.creation_year,
        administration_status=work.administration_status or "ACTIVE",
        contract_reference=work.contract_reference,
        general_notes=work.general_notes,
        timeline_notes=timeline_notes,
        groups=groups or [],
        splits=splits,
        cwr_validation=cwr_report,
        lifecycle_status=lifecycle_status,
        lifecycle_status_label=lifecycle_label,
        lifecycle_status_issues=lifecycle_issues,
        created_at=work.created_at,
        updated_at=work.updated_at,
    )


@router.get("", response_model=list[WorkRead])
def list_works(
    group_id: UUID | None = Query(None, description="Filtrer par projet audiovisuel ou album"),
    entity_id: UUID | None = Query(None, description="Filtrer par entité éditoriale"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> list[WorkRead]:
    """Retourne l'ensemble des œuvres du catalogue avec leurs groupes/projets et leur pré-validation CWR."""
    ws = get_or_create_workspace_settings(session)
    max_pub = Decimal(str(ws.max_publisher_dep_pct))
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)

    links = session.exec(select(WorkGroupLink)).all()
    groups_by_id = {g.id: g for g in session.exec(select(WorkGroup)).all()}
    groups_by_work_id: dict[UUID, list[WorkGroupReadSummary]] = {}
    for link in links:
        if link.work_group_id in groups_by_id:
            g = groups_by_id[link.work_group_id]
            summary = WorkGroupReadSummary(
                id=g.id,
                name=g.name,
                group_type=g.group_type,
                production_company=g.production_company,
                broadcaster_or_client=g.broadcaster_or_client,
                cue_usage_type=link.cue_usage_type,
                track_or_cue_number=link.track_or_cue_number,
            )
            groups_by_work_id.setdefault(link.work_id, []).append(summary)

    query = select(Work)
    if group_id:
        target_work_ids = {link.work_id for link in links if link.work_group_id == group_id}
        if not target_work_ids:
            return []
        query = query.where(Work.id.in_(target_work_ids))

    if target_entity_id:
        if is_default_entity:
            query = query.where((Work.entity_id == target_entity_id) | (Work.entity_id == None))  # noqa: E711
        else:
            query = query.where(Work.entity_id == target_entity_id)

    works = session.exec(query.order_by(Work.title)).all()

    return [
        _work_to_read(
            w,
            max_publisher_dep_pct=max_pub,
            groups=groups_by_work_id.get(w.id, []),
        )
        for w in works
    ]


@router.post("", response_model=WorkRead, status_code=status.HTTP_201_CREATED)
def create_work(
    payload: WorkCreate,
    entity_id: UUID | None = Query(None, description="Entité éditoriale cible"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> WorkRead:
    """Crée une nouvelle œuvre au catalogue, calcule son embedding 384d et valide sa syntaxe CWR."""
    ws = get_or_create_workspace_settings(session)
    max_pub = Decimal(str(ws.max_publisher_dep_pct))
    target_entity_id, _ = resolve_entity_filter(session, entity_id or payload.entity_id, x_entity_id)
    if not target_entity_id:
        default_ent = session.exec(select(PublishingEntity).where(PublishingEntity.is_default == True)).first()  # noqa: E712
        if default_ent:
            target_entity_id = default_ent.id

    norm_sub, norm_alts = _normalize_subtitles_and_aliases(payload.subtitle, payload.alternate_titles)
    corpus = " ".join(filter(None, [payload.title, norm_sub, *norm_alts, *payload.performers]))
    embedding = compute_text_embedding(corpus)
    serialized_splits = [s.model_dump(mode="json") for s in payload.splits]

    # Statut métier choisi ou défaut déterministe
    initial_lifecycle_status = payload.lifecycle_status
    if not initial_lifecycle_status:
        cwr_report = validate_work_cwr(
            work_title=payload.title,
            splits=payload.splits,
            iswc=payload.iswc,
            max_publisher_dep_pct=max_pub,
        )
        initial_lifecycle_status = (
            WorkLifeCycleStatus.A_DEPOSER.value
            if cwr_report.is_cwr_ready
            else WorkLifeCycleStatus.INFORMATIONS_MANQUANTES.value
        )

    now = datetime.now(timezone.utc)
    work = Work(
        title=payload.title,
        subtitle=norm_sub,
        alternate_titles=norm_alts,
        iswc=payload.iswc,
        sacem_work_code=payload.sacem_work_code,
        cotage_number=payload.cotage_number,
        isrc_codes=payload.isrc_codes,
        performers=payload.performers,
        genre=payload.genre,
        duration_seconds=payload.duration_seconds,
        creation_year=payload.creation_year,
        administration_status=payload.administration_status,
        lifecycle_status=initial_lifecycle_status,
        entity_id=target_entity_id,
        contract_reference=payload.contract_reference,
        general_notes=payload.general_notes,
        timeline_notes=[n.model_dump(mode="json") for n in payload.timeline_notes],
        splits=serialized_splits,
        embedding=embedding,
        created_at=now,
        updated_at=now,
    )
    session.add(work)
    session.add(
        AuditLog(
            action_type="WORK_CREATED",
            entity_type="WORK",
            entity_id=str(work.id),
            actor=ws.default_operator_email,
            summary=f"Œuvre « {work.title} » créée au catalogue ({len(serialized_splits)} ayants droit).",
            details={"iswc": work.iswc},
            created_at=now,
        )
    )
    session.commit()
    session.refresh(work)
    return _work_to_read(
        work,
        max_publisher_dep_pct=max_pub,
        groups=_get_work_group_summaries(work.id, session),
    )


@router.post("/batch", response_model=WorkBatchUpdateResult)
def batch_update_works(
    payload: WorkBatchUpdatePayload,
    session: Session = Depends(get_session),
) -> WorkBatchUpdateResult:
    """Applique des modifications par lot sur un ensemble d'œuvres sélectionnées :
    - Rattachement ou retrait d'un projet audiovisuel / album (WorkGroup)
    - Modification de statut d'administration (ACTIVE, IN_DISPUTE, UNDER_ADMIN, ARCHIVED)
    - Association en masse d'un contrat juridique (ex: contrat de commande TF1)
    - Mise à jour du genre musical
    - Ajout d'une annotation horodatée simultanément à tout le lot
    - Ajout ou mise à jour du mémo éditeur
    - Application d'un preset de clés de répartition (ex: Cession 50/50)
    - Modification ciblée d'un ayant droit spécifique sur le lot (nom, IPI, rôle, parts DEP/DRM/SYNC/PHONO).
    """
    ws = get_or_create_workspace_settings(session)
    now = datetime.now(timezone.utc)
    works = session.exec(select(Work).where(Work.id.in_(payload.work_ids))).all()
    if not works:
        raise HTTPException(status_code=400, detail="Aucune œuvre valide trouvée.")

    summary_messages: list[str] = []

    # 1. Rattachement à un groupe / projet audiovisuel
    if payload.assign_to_group_id:
        group = session.get(WorkGroup, payload.assign_to_group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Groupe d'œuvres cible introuvable.")
        existing_links = session.exec(
            select(WorkGroupLink).where(WorkGroupLink.work_group_id == payload.assign_to_group_id)
        ).all()
        already_linked_wids = {link.work_id for link in existing_links}
        newly_linked = 0
        for w in works:
            if w.id not in already_linked_wids:
                link = WorkGroupLink(
                    work_id=w.id,
                    work_group_id=payload.assign_to_group_id,
                    cue_usage_type=payload.cue_usage_type,
                    added_at=now,
                )
                session.add(link)
                newly_linked += 1
        summary_messages.append(f"{newly_linked} œuvre(s) rattachée(s) au projet « {group.name} ».")

    # 2. Retrait d'un groupe
    if payload.remove_from_group_id:
        links_to_remove = session.exec(
            select(WorkGroupLink).where(
                WorkGroupLink.work_group_id == payload.remove_from_group_id,
                WorkGroupLink.work_id.in_(payload.work_ids),
            )
        ).all()
        for link in links_to_remove:
            session.delete(link)
        summary_messages.append(f"{len(links_to_remove)} œuvre(s) retirée(s) du projet.")

    # 3. Modifications directes sur les œuvres
    updated_count = 0
    assigned_group = session.get(WorkGroup, payload.assign_to_group_id) if payload.assign_to_group_id else None

    for w in works:
        modified = False

        if assigned_group:
            if payload.inherit_group_contract and assigned_group.contract_reference and not w.contract_reference:
                w.contract_reference = assigned_group.contract_reference
                modified = True
            if payload.inherit_group_splits and assigned_group.default_splits:
                w.splits = assigned_group.default_splits
                modified = True

        if payload.administration_status:
            w.administration_status = payload.administration_status
            modified = True

        if payload.lifecycle_status is not None:
            w.lifecycle_status = payload.lifecycle_status.strip() or None
            modified = True

        if payload.contract_reference is not None:
            w.contract_reference = payload.contract_reference.strip() or None
            modified = True

        if payload.cotage_number is not None:
            w.cotage_number = payload.cotage_number.strip() or None
            modified = True

        if payload.genre is not None:
            w.genre = payload.genre.strip() or None
            modified = True

        if payload.append_general_notes:
            note_text = payload.append_general_notes.strip()
            if w.general_notes:
                w.general_notes = f"{w.general_notes}\n{note_text}"
            else:
                w.general_notes = note_text
            modified = True

        if payload.append_timeline_note:
            note = {
                "id": str(now.timestamp()),
                "author": payload.append_timeline_note.author or ws.default_operator_email,
                "text": payload.append_timeline_note.text.strip(),
                "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
            }
            existing_timeline = list(w.timeline_notes or [])
            existing_timeline.insert(0, note)
            w.timeline_notes = existing_timeline
            modified = True

        if payload.splits_preset:
            if payload.splits_preset == "CESSION_50_50":
                author_name = w.splits[0].get("holder_name") if (w.splits and len(w.splits) > 0) else "Auteur-Compositeur"
                author_ipi = w.splits[0].get("ipi_number") if (w.splits and len(w.splits) > 0) else None
                w.splits = [
                    {
                        "holder_name": author_name,
                        "role": "AC",
                        "ipi_number": author_ipi,
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "20.00",
                        "share_percentage": "50.00",
                    },
                    {
                        "holder_name": ws.publisher_name,
                        "role": "E",
                        "ipi_number": ws.publisher_ipi,
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "80.00",
                        "share_percentage": "50.00",
                    },
                ]
                modified = True

        # 4. Modification ciblée d'un ayant droit spécifique
        if payload.target_holder_update:
            target_query = payload.target_holder_update.target_holder_name_or_ipi.strip().lower()
            new_splits = []
            holder_matched = False
            for s in (w.splits or []):
                s_name = str(s.get("holder_name") or "").lower()
                s_ipi = str(s.get("ipi_number") or "").lower()
                if target_query in s_name or target_query == s_ipi:
                    holder_matched = True
                    item = dict(s)
                    if payload.target_holder_update.new_holder_name:
                        item["holder_name"] = payload.target_holder_update.new_holder_name.strip()
                    if payload.target_holder_update.new_ipi_number is not None:
                        item["ipi_number"] = payload.target_holder_update.new_ipi_number.strip() or None
                    if payload.target_holder_update.new_role:
                        item["role"] = str(payload.target_holder_update.new_role)
                    if payload.target_holder_update.new_dep_share_pct is not None:
                        item["dep_share_pct"] = str(payload.target_holder_update.new_dep_share_pct)
                        item["share_percentage"] = str(payload.target_holder_update.new_dep_share_pct)
                    if payload.target_holder_update.new_drm_share_pct is not None:
                        item["drm_share_pct"] = str(payload.target_holder_update.new_drm_share_pct)
                    if payload.target_holder_update.new_sync_share_pct is not None:
                        item["sync_share_pct"] = str(payload.target_holder_update.new_sync_share_pct)
                    if payload.target_holder_update.new_phono_share_pct is not None:
                        item["phono_share_pct"] = str(payload.target_holder_update.new_phono_share_pct)
                    new_splits.append(item)
                else:
                    new_splits.append(s)
            if holder_matched:
                w.splits = new_splits
                modified = True

        if modified:
            w.updated_at = now
            session.add(w)
            updated_count += 1

    if payload.administration_status:
        summary_messages.append(f"Statut d'administration mis à jour vers « {payload.administration_status} ».")
    if payload.contract_reference:
        summary_messages.append(f"Référence contrat « {payload.contract_reference} » appliquée.")
    if payload.append_timeline_note:
        summary_messages.append("Annotation d'activité horodatée ajoutée sur les œuvres.")
    if payload.target_holder_update:
        summary_messages.append(f"Ayant droit cible « {payload.target_holder_update.target_holder_name_or_ipi} » mis à jour sur les œuvres concernées.")

    session.add(
        AuditLog(
            action_type="WORKS_BATCH_UPDATED",
            entity_type="WORK",
            entity_id=str(works[0].id) if works else "",
            actor=ws.default_operator_email,
            summary=f"Modification groupée appliquée sur {len(works)} œuvre(s) : " + "; ".join(summary_messages),
            details={"work_ids": [str(w.id) for w in works]},
            created_at=now,
        )
    )
    session.commit()

    return WorkBatchUpdateResult(
        updated_works_count=updated_count,
        work_ids=[w.id for w in works],
        summary_messages=summary_messages or [f"{len(works)} œuvre(s) mises à jour."],
    )


@router.get("/audit", response_model=CatalogAuditReport)
def audit_catalog(
    session: Session = Depends(get_session),
) -> CatalogAuditReport:
    """
    Atelier de Diagnostic & Audit Express du Catalogue (US-4.4) :
    Analyse l'intégralité du répertoire pour détecter :
    - Codes IPI manquants (Erreur bloquante CWR/Sacem)
    - Clés de répartition déséquilibrées (!= 100.00 %)
    - Éditeur non contrôlé ou quote-part nulle
    - Co-éditions orphelines sans contrat d'édition
    - Codes SACEM (COCV), ISWC et Cotages manquants
    """
    works = list(session.exec(select(Work).order_by(Work.title)).all())
    items: list[WorkAuditReportItem] = []

    issues_by_cat = {
        WorkAuditIssueCategory.MISSING_IPI.value: 0,
        WorkAuditIssueCategory.EQUILIBRIUM_ERROR.value: 0,
        WorkAuditIssueCategory.NO_CONTROLLED_PUBLISHER.value: 0,
        WorkAuditIssueCategory.ORPHAN_COEDITION.value: 0,
        WorkAuditIssueCategory.MISSING_SACEM_CODE.value: 0,
        WorkAuditIssueCategory.MISSING_ISWC.value: 0,
        WorkAuditIssueCategory.MISSING_COTAGE.value: 0,
    }

    blocking_count = 0
    warning_count = 0
    healthy_count = 0

    # Pre-fetch Directory IPIs to know if missing IPI can be auto-repaired
    directory_holders = session.exec(select(RightHolderDirectory)).all()
    dir_ipis_by_name = {}
    for h in directory_holders:
        if h.ipi_number and h.ipi_number.strip():
            dir_ipis_by_name[h.full_name.strip().lower()] = h.ipi_number.strip()
            if h.stage_name_or_trade_name and h.stage_name_or_trade_name.strip():
                dir_ipis_by_name[h.stage_name_or_trade_name.strip().lower()] = h.ipi_number.strip()

    for w in works:
        issues: list[WorkAuditIssueItem] = []
        splits = w.splits or []

        # 1. Missing IPI
        missing_ipi_holders = []
        has_auto_repairable_ipi = False
        for s in splits:
            ipi = (s.get("ipi_number") or "").strip()
            if not ipi:
                h_name = (s.get("holder_name") or "").strip()
                missing_ipi_holders.append(f"{h_name} ({s.get('role', 'AC')})")
                if h_name.lower() in dir_ipis_by_name:
                    has_auto_repairable_ipi = True

        if missing_ipi_holders:
            issues_by_cat[WorkAuditIssueCategory.MISSING_IPI.value] += 1
            issues.append(
                WorkAuditIssueItem(
                    category=WorkAuditIssueCategory.MISSING_IPI,
                    severity=WorkAuditIssueSeverity.ERROR,
                    label="Code(s) IPI manquant(s)",
                    details=f"Ayant(s) droit sans code IPI : {', '.join(missing_ipi_holders)}",
                    can_auto_repair=has_auto_repairable_ipi,
                )
            )

        # 2. Key Equilibrium
        dep_sum = sum(Decimal(str(s.get("dep_share_pct", 0) or 0)) for s in splits)
        drm_sum = sum(Decimal(str(s.get("drm_share_pct", 0) or 0)) for s in splits)
        sync_sum = sum(Decimal(str(s.get("sync_share_pct", 0) or 0)) for s in splits)
        phono_sum = sum(Decimal(str(s.get("phono_share_pct", 0) or 0)) for s in splits)

        eq_errors = []
        if abs(dep_sum - Decimal("100.00")) >= Decimal("0.01"):
            eq_errors.append(f"DEP: {dep_sum:.2f}%")
        if abs(drm_sum - Decimal("100.00")) >= Decimal("0.01"):
            eq_errors.append(f"DRM: {drm_sum:.2f}%")
        if abs(sync_sum - Decimal("100.00")) >= Decimal("0.01"):
            eq_errors.append(f"SYNC: {sync_sum:.2f}%")
        if abs(phono_sum - Decimal("100.00")) >= Decimal("0.01"):
            eq_errors.append(f"PHONO: {phono_sum:.2f}%")

        if eq_errors:
            issues_by_cat[WorkAuditIssueCategory.EQUILIBRIUM_ERROR.value] += 1
            can_auto_bal = all(abs(s - Decimal("100.00")) <= Decimal("0.10") for s in [dep_sum, drm_sum, sync_sum, phono_sum])
            issues.append(
                WorkAuditIssueItem(
                    category=WorkAuditIssueCategory.EQUILIBRIUM_ERROR,
                    severity=WorkAuditIssueSeverity.ERROR,
                    label="Déséquilibre de clés de répartition",
                    details=f"Écarts constatés : {', '.join(eq_errors)} (attendu : 100.00 %)",
                    can_auto_repair=can_auto_bal,
                )
            )

        # 3. Publisher control
        publishers = [s for s in splits if s.get("role") in ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"]]
        pub_dep_total = sum(Decimal(str(p.get("dep_share_pct", 0) or 0)) for p in publishers)
        if not publishers or pub_dep_total <= Decimal("0.00"):
            issues_by_cat[WorkAuditIssueCategory.NO_CONTROLLED_PUBLISHER.value] += 1
            issues.append(
                WorkAuditIssueItem(
                    category=WorkAuditIssueCategory.NO_CONTROLLED_PUBLISHER,
                    severity=WorkAuditIssueSeverity.WARNING,
                    label="Éditeur non contrôlé ou quote-part nulle",
                    details="Aucun éditeur assigné ou quote-part d'édition totale à 0.00 %",
                    can_auto_repair=False,
                )
            )
        elif len(publishers) > 1 and not (w.contract_reference or "").strip():
            issues_by_cat[WorkAuditIssueCategory.ORPHAN_COEDITION.value] += 1
            issues.append(
                WorkAuditIssueItem(
                    category=WorkAuditIssueCategory.ORPHAN_COEDITION,
                    severity=WorkAuditIssueSeverity.WARNING,
                    label="Co-édition sans référence contrat",
                    details=f"{len(publishers)} éditeurs présents sans référence contrat ou accord de co-édition rattaché",
                    can_auto_repair=True,
                )
            )

        # 4. SACEM code
        if not (w.sacem_work_code or "").strip():
            issues_by_cat[WorkAuditIssueCategory.MISSING_SACEM_CODE.value] += 1
            issues.append(
                WorkAuditIssueItem(
                    category=WorkAuditIssueCategory.MISSING_SACEM_CODE,
                    severity=WorkAuditIssueSeverity.WARNING,
                    label="Code SACEM (COCV) absent",
                    details="L'œuvre n'a pas de numéro COCV enregistré (recommandé pour les flux Sacem)",
                    can_auto_repair=False,
                )
            )

        # 5. ISWC
        if not (w.iswc or "").strip():
            issues_by_cat[WorkAuditIssueCategory.MISSING_ISWC.value] += 1
            issues.append(
                WorkAuditIssueItem(
                    category=WorkAuditIssueCategory.MISSING_ISWC,
                    severity=WorkAuditIssueSeverity.INFO,
                    label="Code ISWC absent",
                    details="Aucun identifiant ISWC international renseigné",
                    can_auto_repair=False,
                )
            )

        # 6. Cotage
        if not (w.cotage_number or "").strip():
            issues_by_cat[WorkAuditIssueCategory.MISSING_COTAGE.value] += 1
            issues.append(
                WorkAuditIssueItem(
                    category=WorkAuditIssueCategory.MISSING_COTAGE,
                    severity=WorkAuditIssueSeverity.INFO,
                    label="Numéro de Cotage absent",
                    details="Pas de référence éditoriale ou numéro de cotage librairie",
                    can_auto_repair=False,
                )
            )

        has_blocking = any(i.severity == WorkAuditIssueSeverity.ERROR for i in issues)
        has_warning = any(i.severity == WorkAuditIssueSeverity.WARNING for i in issues)

        if has_blocking:
            blocking_count += 1
        elif has_warning:
            warning_count += 1
        else:
            healthy_count += 1

        if issues:
            items.append(
                WorkAuditReportItem(
                    work_id=w.id,
                    title=w.title,
                    iswc=w.iswc,
                    sacem_work_code=w.sacem_work_code,
                    cotage_number=w.cotage_number,
                    contract_reference=w.contract_reference,
                    has_blocking_errors=has_blocking,
                    issues=issues,
                )
            )

    total_w = len(works)
    health_score = Decimal("100.00") if total_w == 0 else Decimal(str(round((healthy_count / total_w) * 100, 2)))

    return CatalogAuditReport(
        total_works=total_w,
        healthy_works_count=healthy_count,
        health_score_pct=health_score,
        blocking_works_count=blocking_count,
        warning_works_count=warning_count,
        issues_by_category=issues_by_cat,
        items=items,
    )


@router.post("/audit/auto-repair", response_model=CatalogAutoRepairResult)
def auto_repair_catalog(
    payload: CatalogAutoRepairPayload,
    session: Session = Depends(get_session),
) -> CatalogAutoRepairResult:
    """
    Atelier de Réparation Express (US-4.4) :
    Applique les réparations sécurisées et déterministes sur le catalogue :
    1. Injection automatique des codes IPI depuis le Répertoire des Ayants Droit.
    2. Héritage des références contrats depuis les Projets Audiovisuels (WorkGroups) associés.
    3. Rééquilibrage déterministe des micro-écarts d'arrondis sur les clés (sommes à 99.99% ou 100.01%).
    """
    stmt = select(Work)
    if payload.target_work_ids:
        stmt = stmt.where(Work.id.in_(payload.target_work_ids))
    works = list(session.exec(stmt).all())

    repaired_ipis_count = 0
    repaired_splits_count = 0
    repaired_contracts_count = 0
    repaired_works_set = set()
    summary_messages = []

    # 1. Prepare Directory lookup
    dir_holders = session.exec(select(RightHolderDirectory)).all()
    dir_lookup = {}
    for h in dir_holders:
        if h.ipi_number and h.ipi_number.strip():
            clean_ipi = h.ipi_number.strip()
            dir_lookup[h.full_name.strip().lower()] = (clean_ipi, h.society_de, h.society_dr)
            if h.stage_name_or_trade_name and h.stage_name_or_trade_name.strip():
                dir_lookup[h.stage_name_or_trade_name.strip().lower()] = (clean_ipi, h.society_de, h.society_dr)

    # 2. Prepare WorkGroup contracts lookup
    links = session.exec(select(WorkGroupLink)).all()
    work_to_groups = {}
    for l in links:
        work_to_groups.setdefault(l.work_id, []).append(l.work_group_id)

    all_groups = {g.id: g for g in session.exec(select(WorkGroup)).all()}

    for w in works:
        work_modified = False
        splits = [dict(s) for s in (w.splits or [])]

        # A. Auto-fill IPIs
        if payload.auto_fill_ipis_from_directory:
            for s in splits:
                cur_ipi = (s.get("ipi_number") or "").strip()
                if not cur_ipi:
                    name_key = (s.get("holder_name") or "").strip().lower()
                    if name_key in dir_lookup:
                        matched_ipi, soc_de, soc_dr = dir_lookup[name_key]
                        s["ipi_number"] = matched_ipi
                        if not s.get("society_de") and soc_de:
                            s["society_de"] = soc_de
                        if not s.get("society_dr") and soc_dr:
                            s["society_dr"] = soc_dr
                        repaired_ipis_count += 1
                        work_modified = True

        # B. Auto-balance splits rounding
        if payload.auto_balance_splits and splits:
            for family in ["dep_share_pct", "drm_share_pct", "sync_share_pct", "phono_share_pct"]:
                fam_sum = sum(Decimal(str(s.get(family, 0) or 0)) for s in splits)
                diff = Decimal("100.00") - fam_sum
                if Decimal("0.00") < abs(diff) <= Decimal("0.10"):
                    # Find last publisher, or first creator
                    target_idx = None
                    for idx, s in enumerate(splits):
                        if s.get("role") in ["E", "SE"]:
                            target_idx = idx
                    if target_idx is None:
                        target_idx = 0
                    cur_val = Decimal(str(splits[target_idx].get(family, 0) or 0))
                    splits[target_idx][family] = str((cur_val + diff).quantize(Decimal("0.01")))
                    repaired_splits_count += 1
                    work_modified = True

        # C. Auto-inherit project contracts
        if payload.auto_inherit_project_contracts and not (w.contract_reference or "").strip():
            g_ids = work_to_groups.get(w.id, [])
            for gid in g_ids:
                grp = all_groups.get(gid)
                if grp and grp.contract_reference and grp.contract_reference.strip():
                    w.contract_reference = grp.contract_reference.strip()
                    repaired_contracts_count += 1
                    work_modified = True
                    break

        if work_modified:
            w.splits = splits
            w.updated_at = datetime.now(timezone.utc)
            session.add(w)
            repaired_works_set.add(w.id)

    if repaired_works_set:
        session.commit()
        if repaired_ipis_count > 0:
            summary_messages.append(f"{repaired_ipis_count} code(s) IPI injecté(s) depuis l'annuaire des ayants droit.")
        if repaired_splits_count > 0:
            summary_messages.append(f"{repaired_splits_count} clé(s) de répartition rééquilibrée(s) à 100.00 %.")
        if repaired_contracts_count > 0:
            summary_messages.append(f"{repaired_contracts_count} référence(s) contrat héritée(s) des projets audiovisuels.")
    else:
        summary_messages.append("Aucune anomalie éligible à la réparation automatique n'a été détectée.")

    return CatalogAutoRepairResult(
        repaired_works_count=len(repaired_works_set),
        repaired_ipis_count=repaired_ipis_count,
        repaired_splits_count=repaired_splits_count,
        repaired_contracts_count=repaired_contracts_count,
        summary_messages=summary_messages,
    )


def _resolve_and_enrich_works_for_export(
    session: Session,
    works: list[Work],
    contract_reference: str | None = None,
) -> list[Work]:
    """Résout les œuvres d'un contrat (même en PENDING_REVIEW avant validation) et enrichit les codes IPI depuis le répertoire."""
    if not works and contract_reference and contract_reference.strip():
        ref_clean = contract_reference.strip()
        contract = session.exec(
            select(Contract).where(Contract.contract_reference == ref_clean)
        ).first()
        if contract:
            if contract.work_titles:
                matched_by_title = list(
                    session.exec(
                        select(Work).where(Work.title.in_(contract.work_titles)).order_by(Work.title)
                    ).all()
                )
                if matched_by_title:
                    works = matched_by_title
            if not works and contract.work_titles:
                from uuid import uuid4

                synth_splits = [
                    {
                        "holder_name": p.get("party_name", ""),
                        "role": p.get("role", "C"),
                        "ipi_number": p.get("ipi_number"),
                        "dep_share_pct": str(p.get("dep_share_pct", "0.00")),
                        "drm_share_pct": str(p.get("drm_share_pct", "0.00")),
                        "sync_share_pct": str(p.get("sync_share_pct") or "0.00"),
                        "phono_share_pct": str(p.get("phono_share_pct") or "0.00"),
                        "share_percentage": str(p.get("dep_share_pct", "0.00")),
                    }
                    for p in (contract.parties or [])
                ]
                works = [
                    Work(
                        id=uuid4(),
                        title=t,
                        contract_reference=contract.contract_reference,
                        splits=[dict(s) for s in synth_splits],
                        created_at=contract.created_at,
                        updated_at=contract.updated_at,
                    )
                    for t in contract.work_titles
                ]

    # Enrichissement automatique des IPIs manquants depuis RightHolderDirectory & PublishingEntity
    ipi_by_norm_name: dict[str, str] = {}
    for dh in session.exec(select(RightHolderDirectory)).all():
        norm_ipi = normalize_ipi_code(dh.ipi_number)
        if not norm_ipi:
            continue
        norm_n = normalize_holder_identity_name(dh.full_name)
        if norm_n:
            ipi_by_norm_name[norm_n] = norm_ipi
        stripped = re.sub(r"^(?:soc|societe|editions|edition)\s+", "", dh.full_name.strip(), flags=re.IGNORECASE)
        norm_s = normalize_holder_identity_name(stripped)
        if norm_s and norm_s not in ipi_by_norm_name:
            ipi_by_norm_name[norm_s] = norm_ipi

    for ent in session.exec(select(PublishingEntity)).all():
        norm_ipi = normalize_ipi_code(ent.sacem_ipi)
        if norm_ipi:
            norm_en = normalize_holder_identity_name(ent.name)
            if norm_en and norm_en not in ipi_by_norm_name:
                ipi_by_norm_name[norm_en] = norm_ipi

    for w in works:
        new_splits = []
        changed = False
        for sp in (w.splits or []):
            sp_dict = sp.model_dump(mode="json") if hasattr(sp, "model_dump") else dict(sp)
            if not sp_dict.get("ipi_number"):
                h_name = str(sp_dict.get("holder_name") or "").strip()
                norm_h = normalize_holder_identity_name(h_name)
                stripped_h = re.sub(r"^(?:soc|societe|editions|edition)\s+", "", h_name, flags=re.IGNORECASE)
                norm_sh = normalize_holder_identity_name(stripped_h)
                resolved_ipi = ipi_by_norm_name.get(norm_h) or ipi_by_norm_name.get(norm_sh)
                if resolved_ipi:
                    sp_dict["ipi_number"] = resolved_ipi
                    changed = True
            new_splits.append(sp_dict)
        if changed:
            w.splits = new_splits

    return works


@router.get("/export/cwr")
def export_catalog_cwr(
    work_group_id: UUID | None = Query(default=None, description="Filtrer les œuvres d'un projet / groupe"),
    date_from: date | None = Query(default=None, description="Filtrer les œuvres créées ou modifiées à partir de cette date"),
    date_to: date | None = Query(default=None, description="Filtrer les œuvres créées ou modifiées jusqu'à cette date"),
    work_ids: str | None = Query(default=None, description="Liste d'identifiants d'œuvres ciblées séparés par des virgules"),
    contract_reference: str | None = Query(default=None, description="Filtrer par référence de contrat"),
    entity_id: UUID | None = Query(default=None, description="Entité éditoriale émettrice"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Génère un fichier CWR v2.1 (CISAC / Sacem) personnalisé, avec filtres par sélection d'œuvres, contrat, projet audiovisuel et dates."""
    ws = get_or_create_workspace_settings(session)
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)

    sender_ipi = ws.publisher_ipi
    sender_name = ws.publisher_name.upper()
    if target_entity_id:
        ent = session.get(PublishingEntity, target_entity_id)
        if ent:
            sender_ipi = ent.sacem_ipi
            sender_name = ent.name.upper()

    stmt = select(Work).order_by(Work.title)
    if target_entity_id:
        if is_default_entity:
            stmt = stmt.where((Work.entity_id == target_entity_id) | (Work.entity_id == None))  # noqa: E711
        else:
            stmt = stmt.where(Work.entity_id == target_entity_id)

    parsed_work_ids: list[UUID] = []
    if work_ids:
        for raw_id in work_ids.split(","):
            raw_id = raw_id.strip()
            if raw_id:
                try:
                    parsed_work_ids.append(UUID(raw_id))
                except ValueError:
                    pass
        if parsed_work_ids:
            stmt = stmt.where(Work.id.in_(parsed_work_ids))

    group_name = None
    if work_group_id:
        group = session.get(WorkGroup, work_group_id)
        if group:
            group_name = group.name
        links = session.exec(
            select(WorkGroupLink).where(WorkGroupLink.work_group_id == work_group_id)
        ).all()
        wids = [l.work_id for l in links]
        stmt = stmt.where(Work.id.in_(wids))

    if contract_reference and contract_reference.strip() and not parsed_work_ids:
        stmt = stmt.where(Work.contract_reference == contract_reference.strip())

    if date_from:
        start_dt = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
        stmt = stmt.where(Work.created_at >= start_dt)
    if date_to:
        end_dt = datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc)
        stmt = stmt.where(Work.created_at <= end_dt)

    works = list(session.exec(stmt).all())
    works = _resolve_and_enrich_works_for_export(session, works, contract_reference=contract_reference)
    result = generate_cwr_v21_content(
        works,
        sender_ipi=sender_ipi,
        sender_name=sender_name,
    )
    if parsed_work_ids and not group_name:
        clean_tag = "SELECTION"
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        result["filename"] = f"CW26{now_str[-4:]}001_{clean_tag}.V21"
        result["filtered_by_selection"] = len(parsed_work_ids)
    elif group_name:
        clean_tag = "".join(c for c in group_name if c.isalnum()).upper()[:12]
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        result["filename"] = f"CW26{now_str[-4:]}001_{clean_tag}.V21"
        result["filtered_by_group"] = {"id": str(work_group_id), "name": group_name}
    if date_from or date_to:
        result["filtered_by_dates"] = {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
        }
    return result


@router.get("/export/xlsx")
def export_catalog_xlsx(
    work_group_id: UUID | None = Query(default=None, description="Filtrer les œuvres d'un projet / groupe"),
    work_ids: str | None = Query(default=None, description="Liste d'identifiants d'œuvres ciblées séparés par des virgules"),
    contract_reference: str | None = Query(default=None, description="Filtrer par référence de contrat"),
    entity_id: UUID | None = Query(default=None, description="Entité éditoriale émettrice"),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> Response:
    """Génère un classeur Excel .xlsx de visibilité catalogue & pré-dépôt CWR (Titres, Cotages, Ayants Droit, IPI, DEP/DRM/SYNC/PHONO, Statut CWR)."""
    ws = get_or_create_workspace_settings(session)
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)

    sender_ipi = ws.publisher_ipi
    sender_name = ws.publisher_name
    if target_entity_id:
        ent = session.get(PublishingEntity, target_entity_id)
        if ent:
            sender_ipi = ent.sacem_ipi
            sender_name = ent.name

    stmt = select(Work).order_by(Work.title)
    if target_entity_id:
        if is_default_entity:
            stmt = stmt.where((Work.entity_id == target_entity_id) | (Work.entity_id == None))  # noqa: E711
        else:
            stmt = stmt.where(Work.entity_id == target_entity_id)

    parsed_wids: list[UUID] = []
    if work_ids:
        for raw_id in work_ids.split(","):
            raw_id = raw_id.strip()
            if raw_id:
                try:
                    parsed_wids.append(UUID(raw_id))
                except ValueError:
                    pass
        if parsed_wids:
            stmt = stmt.where(Work.id.in_(parsed_wids))

    if work_group_id:
        links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == work_group_id)).all()
        wids = [l.work_id for l in links]
        stmt = stmt.where(Work.id.in_(wids))

    if contract_reference and contract_reference.strip() and not parsed_wids:
        stmt = stmt.where(Work.contract_reference == contract_reference.strip())

    works = list(session.exec(stmt).all())
    works = _resolve_and_enrich_works_for_export(session, works, contract_reference=contract_reference)
    xlsx_bytes = generate_works_visibility_xlsx(works=works)
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    tag = (contract_reference or "CATALOGUE").replace(" ", "_")[:20]
    filename = f"KOROM_VISIBILITE_OEUVRES_{tag}_{now_str}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/import-cwr-ack", response_model=CwrAckReport)
async def import_cwr_ack(
    file: UploadFile | None = File(default=None),
    raw_content: str | None = Form(default=None),
    dry_run: bool = Form(default=False),
    session: Session = Depends(get_session),
) -> CwrAckReport:
    """Ingère un fichier d'accusé de réception CWR ACK/NACK (CISAC CWR 2.1 / 2.2 ou CSV SACEM).
    
    - Met à jour le statut officiel de dépôt de l'œuvre (`REGISTERED` / `REJECTED`).
    - Enregistre et confirme le Code Œuvre SACEM (COCV) officiel attribué par la société d'auteurs.
    - Notifie et consigne les motifs de rejets et codes d'erreurs CISAC éventuels.
    - Ajoute automatiquement une note horodatée dans le fil chronologique (Timeline) de l'œuvre.
    """
    if file is None and not raw_content:
        raise HTTPException(
            status_code=400,
            detail="Veuillez fournir un fichier d'accusé de réception ou un contenu texte brut.",
        )

    filename = "ack_cwr.ack"
    if file is not None:
        filename = file.filename or "ack_cwr.ack"
        raw_bytes = await file.read()
        filename_lower = filename.lower()
        if filename_lower.endswith(".xlsx") or filename_lower.endswith(".xlsm") or raw_bytes[:4] == b"PK\x03\x04":
            try:
                text_content = read_xlsx_as_csv(raw_bytes)
            except Exception as err:
                raise HTTPException(
                    status_code=400,
                    detail=f"Impossible de décoder le classeur Excel « {filename} » : {err}",
                )
        else:
            try:
                text_content = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text_content = raw_bytes.decode("latin-1", errors="replace")
    else:
        text_content = raw_content or ""

    return process_cwr_ack(
        content=text_content,
        filename=filename,
        session=session,
        auto_commit=not dry_run,
    )


@router.post("/migrate", response_model=CatalogMigrationReport)
async def migrate_catalog_file(
    file: UploadFile = File(...),
    source_system: str = Form("LE_SAGE_CSV"),
    dry_run: bool = Form(True),
    session: Session = Depends(get_session),
) -> CatalogMigrationReport:
    """
    Sas de Migration Sécurisée (SACEM XLSX/CSV, Le Sage, Music Maestro, CWR .V21) :
    - Détecte et convertit automatiquement les fichiers Excel .xlsx de l'Espace Membre SACEM.
    - dry_run=True : Analyse l'intégralité du fichier sans écriture en base et vérifie les sommes Decimal.
    - dry_run=False : Importe de façon atomique les œuvres, les splits et les soldes d'avances avec vectorisation Fastembed.
    """
    ws = get_or_create_workspace_settings(session)
    raw_bytes = await file.read()
    filename_lower = (file.filename or "").lower()

    # Détection native des classeurs Excel .xlsx
    if filename_lower.endswith(".xlsx") or filename_lower.endswith(".xlsm") or raw_bytes[:4] == b"PK\x03\x04":
        try:
            text_content = read_xlsx_as_csv(raw_bytes)
            if source_system == "LE_SAGE_CSV":
                source_system = "SACEM_CSV"
        except Exception as err:
            raise HTTPException(
                status_code=400,
                detail=f"Impossible de lire le fichier Excel .xlsx « {file.filename} » : {err}",
            )
    else:
        try:
            text_content = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text_content = raw_bytes.decode("latin-1", errors="replace")

    return run_catalog_migration(
        session=session,
        content=text_content,
        source_filename=file.filename or "migration_catalogue.csv",
        source_system=source_system,
        dry_run=dry_run,
        max_publisher_dep_pct=Decimal(str(ws.max_publisher_dep_pct)),
        operator_email=ws.default_operator_email,
        publisher_name=ws.publisher_name,
    )


@router.post("/migrate-demo", response_model=CatalogMigrationReport)
def migrate_catalog_demo(
    dry_run: bool = True,
    source_system: str = "LE_SAGE_CSV",
    session: Session = Depends(get_session),
) -> CatalogMigrationReport:
    """Exécute en 1 clic le Sas Dry-Run ou la Migration Atomique d'un export Le Sage (Improvize) de démonstration."""
    ws = get_or_create_workspace_settings(session)
    return run_catalog_migration(
        session=session,
        content=SAMPLE_LE_SAGE_EXPORT_CSV,
        source_filename="export_catalogue_lesage_improvize_2026.csv",
        source_system=source_system,
        dry_run=dry_run,
        max_publisher_dep_pct=Decimal(str(ws.max_publisher_dep_pct)),
        operator_email=ws.default_operator_email,
        publisher_name=ws.publisher_name,
    )


@router.get("/{work_id}", response_model=WorkRead)
def get_work(work_id: UUID, session: Session = Depends(get_session)) -> WorkRead:
    """Récupère une œuvre par son identifiant avec son diagnostic CWR."""
    ws = get_or_create_workspace_settings(session)
    work = session.get(Work, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Œuvre introuvable.")
    return _work_to_read(
        work,
        max_publisher_dep_pct=Decimal(str(ws.max_publisher_dep_pct)),
        groups=_get_work_group_summaries(work.id, session),
    )


@router.put("/{work_id}", response_model=WorkRead)
def update_work(
    work_id: UUID,
    payload: WorkCreate,
    session: Session = Depends(get_session),
) -> WorkRead:
    """Met à jour une œuvre existante (titre, codes ISWC/ISRC, splits DEP/DRM/SYNC/PHONO) et recalcule le CWR."""
    ws = get_or_create_workspace_settings(session)
    work = session.get(Work, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Œuvre introuvable.")

    now = datetime.now(timezone.utc)
    norm_sub, norm_alts = _normalize_subtitles_and_aliases(payload.subtitle, payload.alternate_titles)
    work.title = payload.title
    work.subtitle = norm_sub
    work.alternate_titles = norm_alts
    work.iswc = payload.iswc
    work.sacem_work_code = payload.sacem_work_code
    work.cotage_number = payload.cotage_number
    work.isrc_codes = payload.isrc_codes
    work.performers = payload.performers
    work.genre = payload.genre
    work.duration_seconds = payload.duration_seconds
    work.creation_year = payload.creation_year
    work.administration_status = payload.administration_status
    if payload.lifecycle_status is not None:
        work.lifecycle_status = payload.lifecycle_status.strip() or None
    work.contract_reference = payload.contract_reference
    work.general_notes = payload.general_notes
    work.timeline_notes = [n.model_dump(mode="json") for n in payload.timeline_notes]
    work.splits = [s.model_dump(mode="json") for s in payload.splits]
    corpus = " ".join(filter(None, [payload.title, norm_sub, *norm_alts, *payload.performers]))
    work.embedding = compute_text_embedding(corpus)
    work.updated_at = now

    session.add(work)
    session.add(
        AuditLog(
            action_type="WORK_UPDATED",
            entity_type="WORK",
            entity_id=str(work.id),
            actor=ws.default_operator_email,
            summary=f"Œuvre « {work.title} » modifiée et re-validée pré-CWR.",
            details={"iswc": work.iswc, "splits_count": len(work.splits)},
            created_at=now,
        )
    )
    session.commit()
    session.refresh(work)
    return _work_to_read(
        work,
        max_publisher_dep_pct=Decimal(str(ws.max_publisher_dep_pct)),
        groups=_get_work_group_summaries(work.id, session),
    )


@router.post("/{work_id}/notes", response_model=WorkRead)
def add_work_timeline_note(
    work_id: UUID,
    payload: WorkTimelineNoteCreate,
    session: Session = Depends(get_session),
) -> WorkRead:
    """Ajoute une nouvelle note horodatée au fil d'activité de l'œuvre."""
    ws = get_or_create_workspace_settings(session)
    work = session.get(Work, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Œuvre introuvable.")

    now = datetime.now(timezone.utc)
    new_note = {
        "id": str(now.timestamp()),
        "author": payload.author or ws.default_operator_email,
        "text": payload.text.strip(),
        "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
    }
    existing_timeline = list(work.timeline_notes or [])
    existing_timeline.insert(0, new_note)  # Plus récent en premier
    work.timeline_notes = existing_timeline
    work.updated_at = now

    session.add(work)
    session.add(
        AuditLog(
            action_type="WORK_NOTE_ADDED",
            entity_type="WORK",
            entity_id=str(work.id),
            actor=new_note["author"],
            summary=f"Note ajoutée à l'œuvre « {work.title} » : {new_note['text'][:80]}...",
            details={"work_id": str(work.id), "note": new_note},
            created_at=now,
        )
    )
    session.commit()
    session.refresh(work)
    return _work_to_read(
        work,
        max_publisher_dep_pct=Decimal(str(ws.max_publisher_dep_pct)),
        groups=_get_work_group_summaries(work.id, session),
    )


@router.post("/batch-delete", status_code=status.HTTP_200_OK)
def batch_delete_works(
    payload: WorkBatchDeletePayload,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Supprime un lot d'œuvres du catalogue et leurs liaisons de groupes."""
    if not payload.work_ids:
        return {"deleted_count": 0, "deleted_ids": [], "message": "Aucune œuvre sélectionnée."}

    ws = get_or_create_workspace_settings(session)
    works = session.exec(select(Work).where(Work.id.in_(payload.work_ids))).all()
    if not works:
        return {"deleted_count": 0, "deleted_ids": [], "message": "Aucune œuvre trouvée."}

    deleted_ids = [str(w.id) for w in works]
    deleted_titles = [w.title for w in works]

    # Supprimer les liens de projet/groupe associés
    links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_id.in_(payload.work_ids))).all()
    for link in links:
        session.delete(link)

    for work in works:
        session.delete(work)

    summary_titles = ", ".join(f"« {t} »" for t in deleted_titles[:5])
    if len(deleted_titles) > 5:
        summary_titles += f" et {len(deleted_titles) - 5} autre(s)"

    session.add(
        AuditLog(
            action_type="WORKS_BATCH_DELETED",
            entity_type="WORK",
            entity_id=deleted_ids[0] if deleted_ids else "",
            actor=ws.default_operator_email,
            summary=f"Suppression groupée de {len(works)} œuvre(s) du catalogue : {summary_titles}.",
        )
    )
    session.commit()
    return {
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "message": f"{len(deleted_ids)} œuvre(s) supprimée(s) du catalogue avec succès.",
    }


@router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work(work_id: UUID, session: Session = Depends(get_session)) -> None:
    """Supprime une œuvre du catalogue et ses liens de groupes."""
    work = session.get(Work, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Œuvre introuvable.")
    ws = get_or_create_workspace_settings(session)
    work_title = work.title
    links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_id == work_id)).all()
    for link in links:
        session.delete(link)
    session.delete(work)
    session.add(
        AuditLog(
            action_type="WORK_DELETED",
            entity_type="WORK",
            entity_id=str(work_id),
            actor=ws.default_operator_email,
            summary=f"Œuvre « {work_title} » supprimée du catalogue.",
        )
    )
    session.commit()


@router.get("/{work_id}/cwr-check", response_model=CWRValidationReport)
def check_work_cwr(work_id: UUID, session: Session = Depends(get_session)) -> CWRValidationReport:
    """Exécute la validation syntaxique et statutaire pré-CWR (Sacem) sur une œuvre."""
    ws = get_or_create_workspace_settings(session)
    work = session.get(Work, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Œuvre introuvable.")
    return validate_work_cwr(
        work_title=work.title,
        splits=work.splits or [],
        iswc=work.iswc,
        work_id=work.id,
        max_publisher_dep_pct=Decimal(str(ws.max_publisher_dep_pct)),
    )
