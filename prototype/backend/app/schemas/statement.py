from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import AIConfidenceMetadata
from app.schemas.contract import ExploitationType
from app.schemas.work import RightHolderSplit


class MatchMethod(StrEnum):
    """Méthode ayant permis de relier une ligne de relevé CSV à une œuvre du catalogue."""

    EXACT_ISWC = "EXACT_ISWC"
    EXACT_SACEM_CODE = "EXACT_SACEM_CODE"
    EXACT_ISRC = "EXACT_ISRC"
    EXACT_TITLE = "EXACT_TITLE"
    LEARNED_ALIAS = "LEARNED_ALIAS"
    FUZZY_STRING = "FUZZY_STRING"
    EMBEDDING_VECTOR = "EMBEDDING_VECTOR"
    MANUAL = "MANUAL"


class CandidateWorkMatch(BaseModel):
    """Candidat d'œuvre proposé par le moteur Smart Matching (Fastembed + similarité cosinus/lexicale)."""

    work_id: UUID
    work_title: str
    iswc: str | None = None
    performers: list[str] = Field(default_factory=list)
    cosine_similarity: float = Field(..., ge=0.0, le=1.0)
    lexical_similarity: float = Field(..., ge=0.0, le=1.0)
    combined_confidence: float = Field(..., ge=0.0, le=1.0)
    match_method: MatchMethod = MatchMethod.EMBEDDING_VECTOR


class StatementLineCreate(BaseModel):
    """Ligne brute issue d'un relevé de royalties CSV importé."""

    row_number: int = Field(..., ge=1, description="Numéro de ligne dans le CSV source")
    raw_work_title: str = Field(..., min_length=1, description="Titre brut présent dans le CSV")
    raw_iswc: str | None = Field(default=None, description="ISWC brut éventuel")
    raw_sacem_code: str | None = Field(default=None, description="Code SACEM / COCV brut éventuel (10-11 chiffres)")
    raw_isrc: str | None = Field(default=None, description="ISRC brut éventuel")
    raw_performer: str | None = Field(default=None, description="Interprète brut éventuel")
    right_type: Literal["DEP", "DRM", "SYNC", "PHONO"] = Field(
        default="DEP",
        description="Famille de droit applicable pour la clé de répartition (DEP, DRM, SYNC ou PHONO)",
    )
    exploitation_type: ExploitationType = Field(
        default=ExploitationType.STREAMING,
        description="Type d'exploitation déclaré sur la ligne",
    )
    territory: str = Field(default="FR", description="Territoire d'exploitation")
    units: int = Field(default=0, ge=0, description="Nombre d'écoutes / actes / exemplaires")
    gross_amount: Decimal = Field(
        ...,
        description="Montant brut reçu sur la ligne (Decimal strict)",
    )
    currency: str = Field(default="EUR", min_length=3, max_length=3, description="Devise ISO 4217")
    source_currency: str = Field(default="EUR", min_length=3, max_length=3, description="Devise d'origine (ex: USD, GBP)")
    exchange_rate: Decimal = Field(default=Decimal("1.000000"), description="Taux de conversion appliqué vers l'EUR")
    source_gross_amount: Decimal = Field(default=Decimal("0.000000"), description="Montant brut d'origine dans la devise source")


class DeterministicSplitAllocation(BaseModel):
    """Résultat d'un calcul de répartition 100 % déterministe (aucun LLM impliqué)."""

    right_holder_id: UUID | None = None
    holder_name: str
    role: str | None = None
    ipi_number: str | None = None
    right_type: Literal["DEP", "DRM", "SYNC", "PHONO"] = "DEP"
    share_percentage: Decimal = Field(..., ge=Decimal("0.00"), le=Decimal("100.00"))
    allocated_amount: Decimal
    exact_allocated_amount: Decimal | None = Field(
        default=None,
        description="Montant exact haute précision (6 décimales) conservé avant arrondi final du décompte",
    )
    recouped_amount: Decimal = Field(default=Decimal("0.00"))
    net_payable_amount: Decimal = Field(default=Decimal("0.00"))

    @classmethod
    def compute(
        cls,
        holder_name: str,
        gross_amount: Decimal,
        share_percentage: Decimal,
        role: str | None = None,
        ipi_number: str | None = None,
        right_type: Literal["DEP", "DRM", "SYNC", "PHONO"] = "DEP",
        right_holder_id: UUID | None = None,
        precision: Decimal = Decimal("0.01"),
    ) -> "DeterministicSplitAllocation":
        """Calcule de manière déterministe le montant alloué à un ayant droit (avec conservation haute précision 6 décimales)."""
        exact_6d = (gross_amount * share_percentage / Decimal("100.00")).quantize(
            Decimal("0.000001"),
            rounding=ROUND_HALF_UP,
        )
        allocated = (gross_amount * share_percentage / Decimal("100.00")).quantize(
            precision,
            rounding=ROUND_HALF_UP,
        )
        return cls(
            right_holder_id=right_holder_id,
            holder_name=holder_name,
            role=role,
            ipi_number=ipi_number,
            right_type=right_type,
            share_percentage=share_percentage,
            allocated_amount=allocated,
            exact_allocated_amount=exact_6d,
            recouped_amount=Decimal("0.00"),
            net_payable_amount=allocated,
        )


class StatementLineMatch(StatementLineCreate, AIConfidenceMetadata):
    """Ligne de relevé enrichie par le matching avec le catalogue et validation humaine."""

    id: UUID | None = None
    statement_id: UUID | None = None
    matched_work_id: UUID | None = Field(
        default=None,
        description="Identifiant de l'œuvre du catalogue proposée par le moteur de matching",
    )
    matched_work_title: str | None = Field(
        default=None,
        description="Titre de l'œuvre correspondante dans le catalogue",
    )
    match_method: MatchMethod = Field(
        default=MatchMethod.EMBEDDING_VECTOR,
        description="Méthode utilisée pour identifier l'œuvre",
    )
    match_reasoning: str | None = Field(
        default=None,
        description="Justification explicite du rapprochement et de la clé de répartition applicable",
    )
    top_match: CandidateWorkMatch | None = Field(
        default=None,
        description="Meilleur candidat identifié par le moteur Smart Matching",
    )
    alternatives: list[CandidateWorkMatch] = Field(
        default_factory=list,
        description="Top 3 des candidats alternatifs pour arbitrage humain",
    )
    allocations: list[DeterministicSplitAllocation] = Field(
        default_factory=list,
        description="Répartition financière déterministe calculée après validation du match",
    )


class StatementLineValidatePayload(BaseModel):
    """Payload de validation ou réassignation humaine d'une ligne de relevé."""

    approve: bool = Field(default=True, description="True pour VALIDATED, False pour REJECTED")
    matched_work_id: UUID | None = Field(
        default=None,
        description="Permet à l'opérateur humain de forcer l'association avec une autre œuvre du catalogue",
    )
    validated_by: str = Field(default="royalty.manager@indie-pub.fr")
    review_notes: str | None = None


class StatementLineCreateWorkAndMatchPayload(BaseModel):
    """Payload pour créer une œuvre en 1-clic depuis une ligne orpheline (Black Box) et l'apparier immédiatement (US-5.2)."""

    title: str = Field(..., min_length=1, max_length=255, description="Titre principal de l'œuvre")
    subtitle: str | None = Field(default=None, max_length=255, description="Sous-titre officiel")
    alternate_titles: list[str] = Field(
        default_factory=list,
        description="Titres alternatifs ou versions facilitant le matching",
    )
    iswc: str | None = Field(default=None, description="Code ISWC normalisé")
    sacem_work_code: str | None = Field(default=None, description="Code SACEM / COCV")
    cotage_number: str | None = Field(default=None, description="Numéro de cotage éditeur")
    isrc_codes: list[str] = Field(default_factory=list, description="Codes ISRC des enregistrements liés")
    performers: list[str] = Field(default_factory=list, description="Artistes-interprètes déclarés")
    genre: str | None = Field(default=None, description="Genre musical")
    duration_seconds: int | None = Field(default=None, description="Durée en secondes")
    creation_year: int | None = Field(default=None, description="Année de composition / création")
    administration_status: str = Field(default="ACTIVE", description="Statut d'administration")
    contract_reference: str | None = Field(default=None, description="Référence du contrat d'édition associé")
    general_notes: str | None = Field(default=None, description="Mémo éditeur libre")
    splits: list[RightHolderSplit] = Field(
        default_factory=list,
        description="Répartition des quotes-parts d'ayants droit (DEP, DRM, SYNC, PHONO)",
    )
    validated_by: str = Field(default="Opérateur Black Box", description="Identité de l'arbitre")
    review_notes: str | None = Field(default=None, description="Notes d'arbitrage éventuelles")


class StatementLockPayload(BaseModel):
    """Payload optionnel lors de la clôture périodique comptable (LOCKED)."""

    notes: str | None = Field(default=None, description="Notes ou observations de clôture")
    operator_email: str | None = Field(default="daf@solstices-music.fr", description="Opérateur validant la clôture")


class MarkStatementPaidPayload(BaseModel):
    """Payload pour enregistrer l'exécution du règlement bancaire des décomptes (PAID)."""

    payment_date: date | None = Field(default=None, description="Date effective du règlement bancaire (défaut : aujourd'hui)")
    payment_method: str = Field(
        default="VIREMENT_SEPA",
        description="Mode de règlement : VIREMENT_SEPA, VIREMENT_BANCAIRE, CHEQUE, AUTRE",
    )
    payment_reference: str = Field(..., description="Référence du virement SEPA ou de la transaction")
    payment_notes: str | None = Field(default=None, description="Observations ou références de compte bancaire")
    operator_email: str | None = Field(default="tresorerie@solstices-music.fr", description="Opérateur trésorerie")


class StatementRead(BaseModel):
    """Relevé de royalties complet avec ses lignes et son état de réconciliation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_name: str = Field(..., description="Organisme ou plateforme source (ex: SACEM, Spotify)")
    filename: str | None = None
    period_start: date
    period_end: date
    total_gross_amount: Decimal
    validated_gross_amount: Decimal = Decimal("0.00")
    pending_gross_amount: Decimal = Decimal("0.00")
    lines_count: int = 0
    validated_lines_count: int = 0
    currency: str = "EUR"
    source_currency: str = "EUR"
    exchange_rate: Decimal = Decimal("1.000000")
    source_gross_amount: Decimal = Decimal("0.000000")
    accounting_status: str = "DRAFT"
    campaign_id: UUID | None = None
    locked_at: datetime | None = None
    paid_at: datetime | None = None
    payment_reference: str | None = None
    payment_method: str | None = None
    payment_notes: str | None = None
    integrity_hash: str | None = None
    lines: list[StatementLineMatch] = Field(default_factory=list)
    created_at: datetime
