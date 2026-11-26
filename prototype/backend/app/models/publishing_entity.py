from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlmodel import Column, Field, SQLModel
from sqlalchemy import JSON


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PublishingEntity(SQLModel, table=True):
    """Entité éditoriale juridique gérant un catalogue distinct (ex: KAPTAIN MUSIC, UNE MUSIQUE)."""

    __tablename__ = "publishing_entities"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(index=True, max_length=255, description="Nom d'usage / Marque éditoriale (ex: KAPTAIN MUSIC)")
    legal_name: str | None = Field(default=None, max_length=255, description="Dénomination sociale officielle (ex: KAPTAIN MUSIC SAS)")
    sacem_ipi: str = Field(max_length=32, description="Code IPI Éditeur SACEM (11 chiffres)")
    sacem_account_number: str | None = Field(default=None, max_length=64, description="Numéro de compte sociétaire SACEM")
    cwr_sender_code: str = Field(default="KAPTAIN", max_length=32, description="Code émetteur CWR (max 8-32 car)")
    color: str = Field(default="#3B82F6", max_length=32, description="Code couleur UI (hex)")
    description: str | None = Field(default=None, description="Spécialité / Descriptif du catalogue")
    iban: str | None = Field(default=None, max_length=64, description="IBAN éditeur")
    bic: str | None = Field(default=None, max_length=16, description="Code BIC/SWIFT")
    default_currency: str = Field(default="EUR", max_length=3)
    is_default: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
