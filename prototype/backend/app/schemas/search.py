"""Schémas Pydantic pour la Recherche Universelle Omnibar (US-5.10)."""

from uuid import UUID
from pydantic import BaseModel, Field


class UnifiedSearchWorkItem(BaseModel):
    """Résultat œuvre dans la recherche globale."""

    id: UUID
    title: str
    subtitle: str | None = None
    iswc: str | None = None
    sacem_work_code: str | None = None
    cotage_number: str | None = None
    contract_reference: str | None = None
    performers: list[str] = Field(default_factory=list)
    is_cwr_ready: bool = False
    sacem_registration_status: str | None = None


class UnifiedSearchHolderItem(BaseModel):
    """Résultat ayant droit dans la recherche globale."""

    id: UUID
    full_name: str
    stage_name_or_trade_name: str | None = None
    primary_role: str = "AC"
    ipi_number: str | None = None
    entity_type: str = "PERSONNE_PHYSIQUE"
    affiliated_society: str = "SACEM"
    is_deceased: bool = False


class UnifiedSearchContractItem(BaseModel):
    """Résultat contrat dans la recherche globale."""

    id: UUID
    contract_reference: str
    counterparty_name: str
    publisher_name: str
    contract_type: str
    sacem_contract_number: str | None = None
    works_count: int = 0


class UnifiedSearchGroupItem(BaseModel):
    """Résultat projet audiovisuel / album dans la recherche globale."""

    id: UUID
    name: str
    group_type: str
    broadcaster_or_client: str | None = None
    contract_reference: str | None = None
    works_count: int = 0


class UnifiedSearchResponse(BaseModel):
    """Réponse consolidée de la recherche globale multi-entités."""

    query: str
    total_results: int
    works: list[UnifiedSearchWorkItem] = Field(default_factory=list)
    holders: list[UnifiedSearchHolderItem] = Field(default_factory=list)
    contracts: list[UnifiedSearchContractItem] = Field(default_factory=list)
    groups: list[UnifiedSearchGroupItem] = Field(default_factory=list)
