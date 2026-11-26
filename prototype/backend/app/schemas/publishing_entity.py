from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PublishingEntityBase(BaseModel):
    name: str = Field(..., max_length=255, description="Marque / Nom d'usage éditeur (ex: KAPTAIN MUSIC)")
    legal_name: str | None = Field(default=None, max_length=255, description="Raison sociale officielle")
    sacem_ipi: str = Field(..., max_length=32, description="Code IPI Éditeur SACEM (11 chiffres)")
    sacem_account_number: str | None = Field(default=None, max_length=64, description="Numéro de compte sociétaire SACEM")
    cwr_sender_code: str = Field(default="KAPTAIN", max_length=32, description="Code émetteur CWR")
    color: str = Field(default="#3B82F6", max_length=32, description="Code couleur UI (hex)")
    description: str | None = Field(default=None, description="Descriptif du catalogue")
    iban: str | None = Field(default=None, max_length=64)
    bic: str | None = Field(default=None, max_length=16)
    default_currency: str = Field(default="EUR", max_length=3)
    is_default: bool = Field(default=False)


class PublishingEntityCreate(PublishingEntityBase):
    pass


class PublishingEntityUpdate(BaseModel):
    name: str | None = None
    legal_name: str | None = None
    sacem_ipi: str | None = None
    sacem_account_number: str | None = None
    cwr_sender_code: str | None = None
    color: str | None = None
    description: str | None = None
    iban: str | None = None
    bic: str | None = None
    default_currency: str | None = None
    is_default: bool | None = None


class PublishingEntityRead(PublishingEntityBase):
    id: UUID
    works_count: int = 0
    contracts_count: int = 0
    cwr_ready_works: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
