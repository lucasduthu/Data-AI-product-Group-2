from uuid import UUID
from sqlmodel import Session
from app.models.publishing_entity import PublishingEntity


def resolve_entity_filter(
    session: Session,
    query_entity_id: UUID | None = None,
    header_entity_id: str | None = None,
) -> tuple[UUID | None, bool]:
    """Résout l'ID de l'entité et indique s'il s'agit de l'entité par défaut (qui englobe les données orphelines)."""
    target_id: UUID | None = query_entity_id
    if not target_id and header_entity_id:
        try:
            target_id = UUID(header_entity_id.strip())
        except Exception:
            target_id = None

    if not target_id:
        return None, False

    ent = session.get(PublishingEntity, target_id)
    is_default = bool(ent and ent.is_default)
    return target_id, is_default
