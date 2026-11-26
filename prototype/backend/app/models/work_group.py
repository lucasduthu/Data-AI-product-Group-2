from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlmodel import Column, Field, JSON, SQLModel


class WorkGroup(SQLModel, table=True):
    """Regroupement d'œuvres par Projet Audiovisuel (Séries TV TF1, Films, Docs, Flux) ou Album."""

    __tablename__ = "work_groups"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True)
    group_type: str = Field(default="SERIE_TV", index=True)
    production_company: Optional[str] = Field(default=None)
    broadcaster_or_client: Optional[str] = Field(default=None)
    release_year: Optional[int] = Field(default=None)
    director_or_producer: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    contract_id: Optional[UUID] = Field(default=None, foreign_key="contracts.id", index=True)
    contract_reference: Optional[str] = Field(default=None, max_length=128)
    default_splits: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    entity_id: Optional[UUID] = Field(default=None, index=True, description="ID de l'entité éditoriale rattachée")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WorkGroupLink(SQLModel, table=True):
    """Table de liaison many-to-many entre une œuvre et un groupe d'œuvres / projet."""

    __tablename__ = "work_group_links"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    work_id: UUID = Field(foreign_key="works.id", index=True)
    work_group_id: UUID = Field(foreign_key="work_groups.id", index=True)
    cue_usage_type: Optional[str] = Field(default=None)
    track_or_cue_number: Optional[str] = Field(default=None)
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
