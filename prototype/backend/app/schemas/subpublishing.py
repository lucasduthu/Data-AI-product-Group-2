"""Schémas Pydantic pour le bac à sable de comparaison différentielle SACEM vs Korom
et les exports de livraison de sous-édition internationale (US-5.18).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.work import RightHolderSplit


class ComparisonStatus(StrEnum):
    """Statut de la comparaison différentielle entre l'export SACEM et Korom."""

    SYNCHRONIZED = "SYNCHRONIZED"   # Concordance exacte (COCV, ISWC, Titre et Splits alignés)
    DISCREPANCY = "DISCREPANCY"     # Divergence constatée (Écart de quote-part, IPI manquant, identifiants non concordants)
    KOROM_ONLY = "KOROM_ONLY"       # Œuvre présente sur Korom mais non trouvée dans l'export SACEM
    SACEM_ONLY = "SACEM_ONLY"       # Œuvre répertoriée à la SACEM mais absente de Korom


class DiscrepancySeverity(StrEnum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class DiscrepancyDetail(BaseModel):
    """Détail d'un écart identifié lors du rapprochement."""

    field: str = Field(..., description="Champ concerné (sacem_work_code, iswc, title, splits_dep, splits_drm, missing_holder...)")
    severity: DiscrepancySeverity = Field(default=DiscrepancySeverity.WARNING)
    korom_value: str | None = None
    sacem_value: str | None = None
    message: str = Field(..., description="Explication en français clair de la divergence")
    can_auto_sync: bool = Field(default=False, description="True si le champ peut être synchronisé automatiquement")


class CatalogDiffItem(BaseModel):
    """Ligne de comparaison différentielle côte-à-côte."""

    id: str = Field(..., description="Identifiant unique de la comparaison")
    korom_work_id: UUID | None = None
    title_korom: str | None = None
    title_sacem: str | None = None
    sacem_work_code_korom: str | None = None
    sacem_work_code_sacem: str | None = None
    iswc_korom: str | None = None
    iswc_sacem: str | None = None
    cotage_korom: str | None = None
    splits_korom: list[RightHolderSplit] = Field(default_factory=list)
    splits_sacem: list[RightHolderSplit] = Field(default_factory=list)
    status: ComparisonStatus
    status_label: str
    discrepancies: list[DiscrepancyDetail] = Field(default_factory=list)
    can_apply_sacem_codes: bool = False


class CatalogDiffReport(BaseModel):
    """Rapport global du bac à sable de comparaison différentielle."""

    total_compared: int
    synchronized_count: int
    discrepancy_count: int
    korom_only_count: int
    sacem_only_count: int
    health_score_pct: Decimal
    items: list[CatalogDiffItem] = Field(default_factory=list)
    summary_messages: list[str] = Field(default_factory=list)


class ApplySacemCodesItem(BaseModel):
    work_id: UUID
    sacem_work_code: str | None = None
    iswc: str | None = None


class ApplySacemCodesPayload(BaseModel):
    """Payload pour synchroniser les codes officiels SACEM sur Korom en 1 clic."""

    items: list[ApplySacemCodesItem] = Field(..., min_length=1)


class ApplySacemCodesResult(BaseModel):
    updated_works_count: int
    updated_work_ids: list[UUID]
    messages: list[str] = Field(default_factory=list)


class SubpublishingDeliveryPayload(BaseModel):
    """Paramètres de génération du bordereau de livraison pour les sous-éditeurs."""

    work_ids: list[UUID] = Field(..., min_length=1, description="Œuvres sélectionnées pour la livraison")
    sub_publisher_name: str = Field(default="Sous-Éditeur Partenaire International", description="Nom du sous-éditeur étranger")
    sub_publisher_ipi: str | None = Field(default=None, description="IPI du sous-éditeur étranger si connu")
    territory: str = Field(default="Monde entier hors France", description="Territoire concédé")
    territory_code: str = Field(default="2136", description="Code territoire CISAC (2136 = Monde)")
    delivery_reference: str = Field(default="LIV-SUB-001", description="Référence du bordereau de livraison")
    notes: str | None = Field(default=None, description="Notes d'accompagnement ou spécificités du contrat de sous-édition")
