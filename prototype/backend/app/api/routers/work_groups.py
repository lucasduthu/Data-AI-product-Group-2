from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlmodel import Session, select

from app.api.routers.settings import get_or_create_workspace_settings
from app.core.database import get_session
from app.core.entity_utils import resolve_entity_filter
from app.models.audit_log import AuditLog
from app.models.publishing_entity import PublishingEntity
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.work import (
    RightHolderSplit,
    WorkGroupBatchDeletePayload,
    WorkGroupCreate,
    WorkGroupRead,
    WorkGroupUpdate,
)

router = APIRouter(prefix="/api/v1/work-groups", tags=["Groupes d'œuvres & Projets"])


def _group_to_read(group: WorkGroup, count: int = 0) -> WorkGroupRead:
    parsed_splits = [
        s if isinstance(s, RightHolderSplit) else RightHolderSplit.model_validate(s)
        for s in (group.default_splits or [])
    ]
    return WorkGroupRead(
        id=group.id,
        name=group.name,
        group_type=group.group_type,
        production_company=group.production_company,
        broadcaster_or_client=group.broadcaster_or_client,
        release_year=group.release_year,
        director_or_producer=group.director_or_producer,
        notes=group.notes,
        contract_id=group.contract_id,
        contract_reference=group.contract_reference,
        default_splits=parsed_splits,
        works_count=count,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("", response_model=list[WorkGroupRead])
def list_work_groups(
    entity_id: UUID | None = Query(None, description="Filtrer par entité éditoriale"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> list[WorkGroupRead]:
    """Liste tous les groupes d'œuvres / projets audiovisuels / albums avec leur nombre d'œuvres."""
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)

    query = select(WorkGroup)
    if target_entity_id:
        if is_default_entity:
            query = query.where((WorkGroup.entity_id == target_entity_id) | (WorkGroup.entity_id == None))  # noqa: E711
        else:
            query = query.where(WorkGroup.entity_id == target_entity_id)

    groups = session.exec(query.order_by(WorkGroup.name)).all()
    links = session.exec(select(WorkGroupLink)).all()
    counts: dict[UUID, int] = {}
    for link in links:
        counts[link.work_group_id] = counts.get(link.work_group_id, 0) + 1
    return [_group_to_read(g, count=counts.get(g.id, 0)) for g in groups]


@router.post("", response_model=WorkGroupRead, status_code=status.HTTP_201_CREATED)
def create_work_group(
    payload: WorkGroupCreate,
    entity_id: UUID | None = Query(None, description="Entité éditoriale cible"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> WorkGroupRead:
    """Crée un nouveau groupe d'œuvres ou projet audiovisuel / album avec son contrat d'édition."""
    target_entity_id, _ = resolve_entity_filter(session, entity_id, x_entity_id)
    if not target_entity_id:
        default_ent = session.exec(select(PublishingEntity).where(PublishingEntity.is_default == True)).first()  # noqa: E712
        if default_ent:
            target_entity_id = default_ent.id

    ws = get_or_create_workspace_settings(session)
    now = datetime.now(timezone.utc)
    raw_splits = [
        s.model_dump(mode="json") if hasattr(s, "model_dump") else s
        for s in (payload.default_splits or [])
    ]
    group = WorkGroup(
        name=payload.name.strip(),
        group_type=payload.group_type,
        production_company=payload.production_company.strip() if payload.production_company else None,
        broadcaster_or_client=payload.broadcaster_or_client.strip() if payload.broadcaster_or_client else None,
        release_year=payload.release_year,
        director_or_producer=payload.director_or_producer.strip() if payload.director_or_producer else None,
        notes=payload.notes.strip() if payload.notes else None,
        contract_id=payload.contract_id,
        contract_reference=payload.contract_reference.strip() if payload.contract_reference else None,
        default_splits=raw_splits,
        entity_id=target_entity_id,
        created_at=now,
        updated_at=now,
    )
    session.add(group)
    session.flush()

    # Rattacher les œuvres initiales si fournies et propager la référence contrat
    added_count = 0
    for wid in payload.initial_work_ids:
        link = WorkGroupLink(work_id=wid, work_group_id=group.id, added_at=now)
        session.add(link)
        w = session.get(Work, wid)
        if w:
            changed = False
            if group.contract_reference and not w.contract_reference:
                w.contract_reference = group.contract_reference
                changed = True
            if group.default_splits and not w.splits:
                w.splits = raw_splits
                changed = True
            if changed:
                w.updated_at = now
                session.add(w)
        added_count += 1

    session.add(
        AuditLog(
            action_type="WORK_GROUP_CREATED",
            entity_type="WORK_GROUP",
            entity_id=str(group.id),
            actor=ws.default_operator_email,
            summary=f"Projet / Groupe « {group.name} » ({group.group_type}) créé avec {added_count} œuvre(s).",
            details={
                "group_type": group.group_type,
                "contract_reference": group.contract_reference,
                "works_count": added_count,
            },
            created_at=now,
        )
    )
    session.commit()
    session.refresh(group)
    return _group_to_read(group, count=added_count)


@router.get("/{group_id}", response_model=WorkGroupRead)
def get_work_group(group_id: UUID, session: Session = Depends(get_session)) -> WorkGroupRead:
    """Récupère les détails d'un groupe d'œuvres."""
    group = session.get(WorkGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Groupe d'œuvres introuvable.")
    links_count = len(session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == group_id)).all())
    return _group_to_read(group, count=links_count)


@router.put("/{group_id}", response_model=WorkGroupRead)
def update_work_group(
    group_id: UUID, payload: WorkGroupUpdate, session: Session = Depends(get_session)
) -> WorkGroupRead:
    """Met à jour les informations d'un projet / groupe d'œuvres."""
    ws = get_or_create_workspace_settings(session)
    group = session.get(WorkGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Groupe d'œuvres introuvable.")

    now = datetime.now(timezone.utc)
    if payload.name is not None:
        group.name = payload.name.strip()
    if payload.group_type is not None:
        group.group_type = payload.group_type
    if payload.production_company is not None:
        group.production_company = payload.production_company.strip() if payload.production_company else None
    if payload.broadcaster_or_client is not None:
        group.broadcaster_or_client = payload.broadcaster_or_client.strip() if payload.broadcaster_or_client else None
    if payload.release_year is not None:
        group.release_year = payload.release_year
    if payload.director_or_producer is not None:
        group.director_or_producer = payload.director_or_producer.strip() if payload.director_or_producer else None
    if payload.notes is not None:
        group.notes = payload.notes.strip() if payload.notes else None
    if payload.contract_id is not None:
        group.contract_id = payload.contract_id
    if payload.contract_reference is not None:
        group.contract_reference = payload.contract_reference.strip() if payload.contract_reference else None
    if payload.default_splits is not None:
        group.default_splits = [
            s.model_dump(mode="json") if hasattr(s, "model_dump") else s
            for s in payload.default_splits
        ]

    group.updated_at = now
    session.add(group)
    session.add(
        AuditLog(
            action_type="WORK_GROUP_UPDATED",
            entity_type="WORK_GROUP",
            entity_id=str(group.id),
            actor=ws.default_operator_email,
            summary=f"Projet / Groupe « {group.name} » mis à jour.",
            details={"name": group.name, "contract_reference": group.contract_reference},
            created_at=now,
        )
    )
    session.commit()
    session.refresh(group)
    links_count = len(session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == group_id)).all())
    return _group_to_read(group, count=links_count)


@router.post("/{group_id}/apply-inheritance", response_model=dict[str, Any])
def apply_work_group_inheritance(
    group_id: UUID,
    apply_contract_ref: bool = True,
    apply_default_splits: bool = False,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Applique rétroactivement la référence contrat et/ou les splits du projet à toutes ses œuvres rattachées."""
    ws = get_or_create_workspace_settings(session)
    group = session.get(WorkGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Groupe d'œuvres introuvable.")

    links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == group_id)).all()
    work_ids = [l.work_id for l in links]
    works = session.exec(select(Work).where(Work.id.in_(work_ids))).all() if work_ids else []

    updated_count = 0
    now = datetime.now(timezone.utc)
    for w in works:
        changed = False
        if apply_contract_ref and group.contract_reference and not w.contract_reference:
            w.contract_reference = group.contract_reference
            changed = True
        if apply_default_splits and group.default_splits:
            w.splits = group.default_splits
            changed = True
        if changed:
            w.updated_at = now
            session.add(w)
            updated_count += 1

    if updated_count > 0:
        session.add(
            AuditLog(
                action_type="WORK_GROUP_INHERITANCE_APPLIED",
                entity_type="WORK_GROUP",
                entity_id=str(group.id),
                actor=ws.default_operator_email,
                summary=f"Héritage contrat/splits appliqué depuis « {group.name} » sur {updated_count} œuvre(s).",
                details={"updated_count": updated_count},
                created_at=now,
            )
        )
        session.commit()

    return {
        "group_id": str(group.id),
        "group_name": group.name,
        "contract_reference": group.contract_reference,
        "affected_works_count": updated_count,
        "total_group_works": len(works),
    }


@router.post("/batch-delete", status_code=status.HTTP_200_OK)
def batch_delete_work_groups(
    payload: WorkGroupBatchDeletePayload,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Supprime un lot de groupes d'œuvres / projets audiovisuels / albums et détache les œuvres sans les supprimer."""
    if not payload.group_ids:
        return {"deleted_count": 0, "deleted_ids": [], "detached_works_count": 0, "message": "Aucun groupe sélectionné."}

    ws = get_or_create_workspace_settings(session)
    groups = session.exec(select(WorkGroup).where(WorkGroup.id.in_(payload.group_ids))).all()
    if not groups:
        return {"deleted_count": 0, "deleted_ids": [], "detached_works_count": 0, "message": "Aucun groupe trouvé."}

    deleted_ids = [str(g.id) for g in groups]
    deleted_names = [g.name for g in groups]

    # Supprimer les liens associés (détachement sans suppression des œuvres)
    links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id.in_(payload.group_ids))).all()
    detached_count = len(links)
    for link in links:
        session.delete(link)

    for group in groups:
        session.delete(group)

    summary_names = ", ".join(f"« {n} »" for n in deleted_names[:5])
    if len(deleted_names) > 5:
        summary_names += f" et {len(deleted_names) - 5} autre(s)"

    now = datetime.now(timezone.utc)
    session.add(
        AuditLog(
            action_type="WORK_GROUPS_BATCH_DELETED",
            entity_type="WORK_GROUP",
            entity_id=deleted_ids[0] if deleted_ids else "",
            actor=ws.default_operator_email,
            summary=f"Suppression groupée de {len(deleted_ids)} groupe(s)/projet(s) : {summary_names} ({detached_count} œuvre(s) détachée(s)).",
            details={
                "deleted_count": len(deleted_ids),
                "deleted_ids": deleted_ids,
                "deleted_names": deleted_names,
                "detached_works_count": detached_count,
            },
            created_at=now,
        )
    )
    session.commit()
    return {
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "detached_works_count": detached_count,
        "message": f"{len(deleted_ids)} projet(s) / groupe(s) supprimé(s) avec succès ({detached_count} œuvre(s) détachée(s)).",
    }


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_group(group_id: UUID, session: Session = Depends(get_session)) -> None:
    """Supprime un groupe d'œuvres et détache les œuvres sans les supprimer."""
    ws = get_or_create_workspace_settings(session)
    group = session.get(WorkGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Groupe d'œuvres introuvable.")

    links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == group_id)).all()
    detached_count = len(links)
    for link in links:
        session.delete(link)

    group_name = group.name
    session.delete(group)

    now = datetime.now(timezone.utc)
    session.add(
        AuditLog(
            action_type="WORK_GROUP_DELETED",
            entity_type="WORK_GROUP",
            entity_id=str(group_id),
            actor=ws.default_operator_email,
            summary=f"Projet / Groupe « {group_name} » supprimé ({detached_count} œuvre(s) détachée(s)).",
            details={"group_name": group_name, "detached_works_count": detached_count},
            created_at=now,
        )
    )
    session.commit()
