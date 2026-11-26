from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.models.contract import Contract
from app.models.publishing_entity import PublishingEntity
from app.models.statement import RoyaltyStatement
from app.models.task import DashboardTask
from app.models.work import Work
from app.models.work_group import WorkGroup
from app.schemas.publishing_entity import (
    PublishingEntityCreate,
    PublishingEntityRead,
    PublishingEntityUpdate,
)
from app.services.cwr_validator import validate_work_cwr

router = APIRouter(prefix="/api/v1/entities", tags=["Entités Éditoriales & Multi-Catalogues"])


def _to_read_dto(entity: PublishingEntity, session: Session) -> PublishingEntityRead:
    works = session.exec(select(Work).where(Work.entity_id == entity.id)).all()
    contracts_count = len(session.exec(select(Contract).where(Contract.entity_id == entity.id)).all())
    
    # Si c'est l'entité par défaut, inclure aussi les enregistrements sans entity_id
    if entity.is_default:
        orphan_works = session.exec(select(Work).where(Work.entity_id == None)).all()  # noqa: E711
        orphan_contracts_count = len(session.exec(select(Contract).where(Contract.entity_id == None)).all())  # noqa: E711
        works = list(works) + list(orphan_works)
        contracts_count += orphan_contracts_count

    cwr_ready_count = sum(
        1 for w in works if validate_work_cwr(work_title=w.title, splits=w.splits or [], iswc=w.iswc, work_id=w.id).is_cwr_ready
    )

    return PublishingEntityRead(
        id=entity.id,
        name=entity.name,
        legal_name=entity.legal_name,
        sacem_ipi=entity.sacem_ipi,
        sacem_account_number=entity.sacem_account_number,
        cwr_sender_code=entity.cwr_sender_code,
        color=entity.color,
        description=entity.description,
        iban=entity.iban,
        bic=entity.bic,
        default_currency=entity.default_currency,
        is_default=entity.is_default,
        works_count=len(works),
        contracts_count=contracts_count,
        cwr_ready_works=cwr_ready_count,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


@router.get("", response_model=list[PublishingEntityRead])
def list_publishing_entities(session: Session = Depends(get_session)) -> list[PublishingEntityRead]:
    """Récupère l'ensemble des entités éditoriales (ex: KAPTAIN MUSIC, UNE MUSIQUE) avec leurs volumes de catalogue."""
    entities = session.exec(select(PublishingEntity).order_by(PublishingEntity.created_at.asc())).all()
    return [_to_read_dto(e, session) for e in entities]


@router.post("", response_model=PublishingEntityRead, status_code=status.HTTP_201_CREATED)
def create_publishing_entity(
    payload: PublishingEntityCreate,
    session: Session = Depends(get_session),
) -> PublishingEntityRead:
    """Crée une nouvelle entité éditoriale avec son code IPI SACEM et code émetteur CWR."""
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Le nom de l'entité éditoriale est requis.")

    existing = session.exec(select(PublishingEntity)).all()
    is_first = len(existing) == 0

    entity = PublishingEntity(
        name=clean_name,
        legal_name=payload.legal_name.strip() if payload.legal_name else None,
        sacem_ipi=payload.sacem_ipi.strip(),
        sacem_account_number=payload.sacem_account_number.strip() if payload.sacem_account_number else None,
        cwr_sender_code=payload.cwr_sender_code.strip() if payload.cwr_sender_code else clean_name[:8].upper(),
        color=payload.color or "#3B82F6",
        description=payload.description.strip() if payload.description else None,
        iban=payload.iban.strip() if payload.iban else None,
        bic=payload.bic.strip() if payload.bic else None,
        default_currency=payload.default_currency or "EUR",
        is_default=payload.is_default or is_first,
    )

    if entity.is_default:
        for other in existing:
            other.is_default = False
            session.add(other)

    session.add(entity)
    session.commit()
    session.refresh(entity)

    return _to_read_dto(entity, session)


@router.get("/{entity_id}", response_model=PublishingEntityRead)
def get_publishing_entity(
    entity_id: UUID,
    session: Session = Depends(get_session),
) -> PublishingEntityRead:
    """Récupère les détails d'une entité éditoriale spécifique."""
    entity = session.get(PublishingEntity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entité éditoriale introuvable.")
    return _to_read_dto(entity, session)


@router.patch("/{entity_id}", response_model=PublishingEntityRead)
def update_publishing_entity(
    entity_id: UUID,
    payload: PublishingEntityUpdate,
    session: Session = Depends(get_session),
) -> PublishingEntityRead:
    """Met à jour les coordonnées et identifiants SACEM/CWR d'une entité éditoriale."""
    entity = session.get(PublishingEntity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entité éditoriale introuvable.")

    updates = payload.model_dump(exclude_unset=True)
    if "is_default" in updates and updates["is_default"]:
        all_entities = session.exec(select(PublishingEntity)).all()
        for other in all_entities:
            if other.id != entity.id:
                other.is_default = False
                session.add(other)

    for field, value in updates.items():
        setattr(entity, field, value)

    entity.updated_at = datetime.now(timezone.utc)
    session.add(entity)
    session.commit()
    session.refresh(entity)

    return _to_read_dto(entity, session)


@router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_publishing_entity(
    entity_id: UUID,
    session: Session = Depends(get_session),
) -> None:
    """Supprime une entité éditoriale si ce n'est pas la seule entité existante."""
    entity = session.get(PublishingEntity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entité éditoriale introuvable.")

    all_entities = session.exec(select(PublishingEntity)).all()
    if len(all_entities) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer la seule entité éditoriale du système.",
        )

    # Réassigner les œuvres vers l'entité restante par défaut
    remaining = [e for e in all_entities if e.id != entity.id]
    fallback = next((e for e in remaining if e.is_default), remaining[0])
    fallback.is_default = True
    session.add(fallback)

    # Re-rattacher les œuvres, contrats, groupes, tâches et relevés orphelins vers fallback
    for model_cls in (Work, Contract, WorkGroup, DashboardTask, RoyaltyStatement):
        items = session.exec(select(model_cls).where(model_cls.entity_id == entity.id)).all()
        for it in items:
            it.entity_id = fallback.id
            session.add(it)

    session.delete(entity)
    session.commit()


@router.post("/{entity_id}/set-default", response_model=PublishingEntityRead)
def set_default_publishing_entity(
    entity_id: UUID,
    session: Session = Depends(get_session),
) -> PublishingEntityRead:
    """Définit cette entité comme le catalogue éditorial par défaut."""
    entity = session.get(PublishingEntity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entité éditoriale introuvable.")

    all_entities = session.exec(select(PublishingEntity)).all()
    for e in all_entities:
        e.is_default = e.id == entity.id
        session.add(e)

    session.commit()
    session.refresh(entity)
    return _to_read_dto(entity, session)
