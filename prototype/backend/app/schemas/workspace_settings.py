from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.work import RightHolderSplit


class SplitPresetSchema(BaseModel):
    """Modèle de répartition réutilisable en 1 clic lors de la création ou modification d'œuvre."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: str = ""
    admin_fee_pct: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("50.00"))
    splits: list[RightHolderSplit] = Field(default_factory=list)


class CurrencyRateItem(BaseModel):
    """Parité de change officielle (BCE / fixing semestriel) pour conversion des relevés étrangers."""

    currency: str = Field(..., min_length=3, max_length=3, description="Code ISO 4217 (ex: USD, GBP)")
    label: str = Field(default="", description="Libellé complet de la devise")
    symbol: str = Field(default="", description="Symbole monétaire ($, £, etc.)")
    rate_to_eur: Decimal = Field(..., gt=Decimal("0.000000"), description="Valeur de 1 unité étrangère en EUR (multiplicateur)")
    rate_bce: Decimal = Field(..., gt=Decimal("0.000000"), description="Taux BCE officiel : 1 EUR = X devises étrangères")
    effective_date: str = Field(default="", description="Date ou période d'effet (ex: 2026-06-30)")
    source: str = Field(default="BCE", description="Source officielle de la parité")


class CurrencyConvertRequest(BaseModel):
    """Requête de conversion déterministe entre devises."""

    amount: Decimal = Field(..., description="Montant en devise source")
    from_currency: str = Field(..., min_length=3, max_length=3)
    to_currency: str = Field(default="EUR", min_length=3, max_length=3)
    custom_rate: Decimal | None = Field(default=None, description="Taux personnalisé optionnel")


class CurrencyConvertResponse(BaseModel):
    """Résultat certifié et formule de calcul de la conversion monétaire."""

    source_amount: Decimal
    source_currency: str
    target_amount: Decimal
    target_currency: str
    rate_to_eur: Decimal
    rate_bce: Decimal
    formula: str


class WorkspaceSettingsBase(BaseModel):
    """Schéma de configuration personnalisable de l'espace éditeur."""

    publisher_name: str = Field(default="Éditions Solstices Music", min_length=1, max_length=255)
    publisher_ipi: str = Field(default="00891234567", pattern=r"^\d{9,11}$")
    cwr_sender_code: str = Field(default="SOLSTICES", min_length=2, max_length=32)
    affiliated_societies: list[str] = Field(
        default_factory=lambda: ["SACEM", "SDRM", "SCPP"],
    )
    default_currency: str = Field(default="EUR", min_length=3, max_length=3)
    default_operator_email: str = Field(default="royalty.manager@solstices-music.fr")
    publisher_iban: str = Field(
        default="FR0830004019920005554443210",
        description="IBAN bancaire officiel de l'éditeur émetteur pour les virements SEPA",
    )
    publisher_bic: str = Field(
        default="BNPAFRPPXXX",
        description="Code BIC/SWIFT de la banque de l'éditeur",
    )

    # Règles métier déterministes
    max_publisher_dep_pct: Decimal = Field(
        default=Decimal("50.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Plafond éditorial DEP (50.00 % par défaut en gestion collective Sacem)",
    )
    default_admin_fee_pct: Decimal = Field(
        default=Decimal("10.00"),
        ge=Decimal("0.00"),
        le=Decimal("50.00"),
        description="Commission d'administration par défaut pour les contrats de gestion",
    )
    vat_rate_pct: Decimal = Field(
        default=Decimal("10.00"),
        ge=Decimal("0.00"),
        le=Decimal("30.00"),
        description="Taux de TVA applicable sur les états de royalties",
    )
    min_payment_threshold: Decimal = Field(
        default=Decimal("50.00"),
        ge=Decimal("0.00"),
        description="Seuil minimum de paiement en € (en-deçà, mis en réserve et reporté à nouveau)",
    )
    statement_messages: dict[str, str] = Field(
        default_factory=dict,
        description="Mentions légales et messages conditionnels en FR et EN pour les décomptes",
    )

    # Paramètres IA & Seuils Human-in-the-loop
    openrouter_model: str = Field(default="anthropic/claude-3.5-sonnet")
    high_confidence_threshold: float = Field(default=0.90, ge=0.50, le=1.00)
    anomaly_threshold: float = Field(default=0.65, ge=0.10, le=0.90)
    vector_weight: float = Field(default=0.45, ge=0.0, le=1.0)
    lexical_weight: float = Field(default=0.55, ge=0.0, le=1.0)

    # Assistant d'onboarding & guide de démarrage
    onboarding_completed: bool = Field(default=False, description="Indicateur d'achèvement de l'onboarding")
    onboarding_dismissed: bool = Field(default=False, description="Masquage de la bannière d'onboarding sur le Dashboard")
    onboarding_completed_steps: list[str] = Field(
        default_factory=list,
        description="Liste des étapes d'onboarding validées ('step_identity', 'step_catalog', 'step_contracts', 'step_simulation')",
    )

    split_presets: list[SplitPresetSchema] = Field(default_factory=list)
    currency_rates: list[CurrencyRateItem] = Field(
        default_factory=list,
        description="Table des parités de change officielles (USD, GBP, CAD, CHF, etc.) vers EUR",
    )


    @model_validator(mode="after")
    def normalize_matching_weights(self) -> "WorkspaceSettingsBase":
        total_w = self.vector_weight + self.lexical_weight
        if total_w <= 0:
            self.vector_weight = 0.45
            self.lexical_weight = 0.55
        elif abs(total_w - 1.0) > 0.001:
            self.vector_weight = round(self.vector_weight / total_w, 2)
            self.lexical_weight = round(1.0 - self.vector_weight, 2)
        return self


class OnboardingStateUpdate(BaseModel):
    """Payload de mise à jour rapide de l'état d'onboarding utilisateur."""

    completed: bool | None = None
    dismissed: bool | None = None
    completed_steps: list[str] | None = None


class WorkspaceSettingsUpdate(WorkspaceSettingsBase):
    """Payload de mise à jour de la configuration utilisateur."""

    onboarding_completed: bool | None = None
    onboarding_dismissed: bool | None = None
    onboarding_completed_steps: list[str] | None = None
    publisher_iban: str | None = None
    publisher_bic: str | None = None


class WorkspaceSettingsRead(WorkspaceSettingsBase):
    """Schéma de lecture de la configuration utilisateur."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    updated_at: datetime


class AuditLogRead(BaseModel):
    """Entrée du journal d'audit Human-in-the-loop."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    action_type: str
    entity_type: str
    entity_id: str
    actor: str
    summary: str
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
