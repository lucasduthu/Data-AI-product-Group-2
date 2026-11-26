from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(SQLModel, table=True):
    """Journal d'audit immuable des validations humaines (Human-in-the-loop) et changements de configuration."""

    __tablename__ = "audit_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    action_type: str = Field(index=True, max_length=64)
    entity_type: str = Field(index=True, max_length=64)
    entity_id: str = Field(max_length=128)
    actor: str = Field(default="royalty.manager@solstices-music.fr", max_length=255)
    summary: str = Field(max_length=512)
    details: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now, index=True)
