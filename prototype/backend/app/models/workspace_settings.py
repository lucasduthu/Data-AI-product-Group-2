from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, Numeric
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_SPLIT_PRESETS: list[dict[str, Any]] = [
    {
        "id": "sacem-statutaire-1-3-dep-50-dr",
        "name": "Barème Statutaire Sacem (1/3 DEP, 50% DR)",
        "description": "Répartition statutaire officielle Sacem (Statuts art. 9, RG art. 57 & 76) : 33.33% Éditeur en DEP (1/3) et 50% Éditeur en DR.",
        "admin_fee_pct": "0.00",
        "splits": [
            {
                "holder_name": "Auteur-Compositeur",
                "role": "AC",
                "ipi_number": "00458912301",
                "dep_share_pct": "66.67",
                "drm_share_pct": "50.00",
                "sync_share_pct": "50.00",
                "phono_share_pct": "50.00",
                "share_percentage": "66.67",
            },
            {
                "holder_name": "Éditions Solstices Music",
                "role": "E",
                "ipi_number": "00891234567",
                "dep_share_pct": "33.33",
                "drm_share_pct": "50.00",
                "sync_share_pct": "50.00",
                "phono_share_pct": "50.00",
                "share_percentage": "33.33",
            },
        ],
    },
    {
        "id": "cession-standard-50-50",
        "name": "Cession d'Édition Standard / Sous-Édition (50/50)",
        "description": "Répartition 50% Auteur-Compositeur / 50% Éditeur en DEP (plafond R-306), DRM et SYNC.",
        "admin_fee_pct": "0.00",
        "splits": [
            {
                "holder_name": "Camille Moreau",
                "role": "AC",
                "ipi_number": "00458912301",
                "dep_share_pct": "50.00",
                "drm_share_pct": "50.00",
                "sync_share_pct": "50.00",
                "phono_share_pct": "20.00",
                "share_percentage": "50.00",
            },
            {
                "holder_name": "Éditions Solstices Music",
                "role": "E",
                "ipi_number": "00891234567",
                "dep_share_pct": "50.00",
                "drm_share_pct": "50.00",
                "sync_share_pct": "50.00",
                "phono_share_pct": "80.00",
                "share_percentage": "50.00",
            },
        ],
    },
    {
        "id": "coedition-50-25-25",
        "name": "Coédition 50 / 25 / 25",
        "description": "50% Auteur-Compositeur, 25% Éditeur principal, 25% Co-Éditeur.",
        "admin_fee_pct": "0.00",
        "splits": [
            {
                "holder_name": "Antoine Garnier",
                "role": "AC",
                "ipi_number": "00734512980",
                "dep_share_pct": "50.00",
                "drm_share_pct": "50.00",
                "sync_share_pct": "50.00",
                "phono_share_pct": "20.00",
                "share_percentage": "50.00",
            },
            {
                "holder_name": "Éditions Solstices Music",
                "role": "E",
                "ipi_number": "00891234567",
                "dep_share_pct": "25.00",
                "drm_share_pct": "25.00",
                "sync_share_pct": "25.00",
                "phono_share_pct": "40.00",
                "share_percentage": "25.00",
            },
            {
                "holder_name": "Belleville Publishing",
                "role": "E",
                "ipi_number": "00911223344",
                "dep_share_pct": "25.00",
                "drm_share_pct": "25.00",
                "sync_share_pct": "25.00",
                "phono_share_pct": "40.00",
                "share_percentage": "25.00",
            },
        ],
    },
    {
        "id": "contrat-gestion-admin-90-10",
        "name": "Contrat de Gestion / Administration (90/10)",
        "description": "Catalogue administré avec commission d'administration éditoriale déterministe de 10%.",
        "admin_fee_pct": "10.00",
        "splits": [
            {
                "holder_name": "Léa Vasseur",
                "role": "AC",
                "ipi_number": "00512398741",
                "dep_share_pct": "90.00",
                "drm_share_pct": "90.00",
                "sync_share_pct": "90.00",
                "phono_share_pct": "90.00",
                "share_percentage": "90.00",
            },
            {
                "holder_name": "Éditions Solstices Music",
                "role": "E",
                "ipi_number": "00891234567",
                "dep_share_pct": "10.00",
                "drm_share_pct": "10.00",
                "sync_share_pct": "10.00",
                "phono_share_pct": "10.00",
                "share_percentage": "10.00",
            },
        ],
    },
    {
        "id": "master-phono-80-20",
        "name": "Master Phono & Droits Voisins (80/20)",
        "description": "Répartition Producteur Phonographique (80% Master) / Artiste-Interprète (20% Royalties).",
        "admin_fee_pct": "0.00",
        "splits": [
            {
                "holder_name": "Éditions Solstices Music",
                "role": "P",
                "ipi_number": "00891234567",
                "dep_share_pct": "50.00",
                "drm_share_pct": "50.00",
                "sync_share_pct": "50.00",
                "phono_share_pct": "80.00",
                "share_percentage": "50.00",
            },
            {
                "holder_name": "Camille Moreau",
                "role": "I",
                "ipi_number": "00458912301",
                "dep_share_pct": "50.00",
                "drm_share_pct": "50.00",
                "sync_share_pct": "50.00",
                "phono_share_pct": "20.00",
                "share_percentage": "50.00",
            },
        ],
    },
]

DEFAULT_CURRENCY_RATES: list[dict[str, Any]] = [
    {
        "currency": "EUR",
        "label": "Euro (€)",
        "symbol": "€",
        "rate_to_eur": "1.000000",
        "rate_bce": "1.000000",
        "effective_date": "2026-01-01",
        "source": "Monnaie de référence légale (Pivot)",
    },
    {
        "currency": "USD",
        "label": "Dollar Américain ($)",
        "symbol": "$",
        "rate_to_eur": "0.921659",
        "rate_bce": "1.085000",
        "effective_date": "2026-06-30",
        "source": "Banque Centrale Européenne (BCE S1 2026)",
    },
    {
        "currency": "GBP",
        "label": "Livre Sterling (£)",
        "symbol": "£",
        "rate_to_eur": "1.169591",
        "rate_bce": "0.855000",
        "effective_date": "2026-06-30",
        "source": "Banque Centrale Européenne (BCE S1 2026)",
    },
    {
        "currency": "CAD",
        "label": "Dollar Canadien (C$)",
        "symbol": "C$",
        "rate_to_eur": "0.675676",
        "rate_bce": "1.480000",
        "effective_date": "2026-06-30",
        "source": "Banque Centrale Européenne (BCE S1 2026)",
    },
    {
        "currency": "CHF",
        "label": "Franc Suisse (CHF)",
        "symbol": "CHF",
        "rate_to_eur": "1.036269",
        "rate_bce": "0.965000",
        "effective_date": "2026-06-30",
        "source": "Banque Centrale Européenne (BCE S1 2026)",
    },
    {
        "currency": "JPY",
        "label": "Yen Japonais (¥)",
        "symbol": "¥",
        "rate_to_eur": "0.006042",
        "rate_bce": "165.500000",
        "effective_date": "2026-06-30",
        "source": "Banque Centrale Européenne (BCE S1 2026)",
    },
    {
        "currency": "AUD",
        "label": "Dollar Australien (A$)",
        "symbol": "A$",
        "rate_to_eur": "0.611621",
        "rate_bce": "1.635000",
        "effective_date": "2026-06-30",
        "source": "Banque Centrale Européenne (BCE S1 2026)",
    },
]


DEFAULT_STATEMENT_MESSAGES: dict[str, str] = {
    "paid_fr": "Règlement effectué par virement bancaire sous réserve d'encaissement et déduction faite des cotisations sociales et précomptes légaux.",
    "paid_en": "Payment processed by bank transfer subject to clearance and deduction of statutory social contributions.",
    "below_threshold_fr": "Le montant net étant inférieur au seuil de paiement minimum de {threshold} €, ce solde est conservé en réserve et reporté à nouveau au décompte de la période suivante.",
    "below_threshold_en": "As the net amount is below the minimum payment threshold of {threshold} €, this balance is held in reserve and carried forward to the next period.",
    "recoupment_fr": "Solde débiteur reporté à nouveau sur les prochaines répartitions conformément aux conditions particulières du contrat de cession.",
    "recoupment_en": "Debit balance carried forward to upcoming distributions in accordance with the terms of the publishing agreement.",
}


class WorkspaceSettings(SQLModel, table=True):
    """Paramètres personnalisables de la structure éditoriale, des règles CWR et des seuils IA."""

    __tablename__ = "workspace_settings"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    publisher_name: str = Field(default="Éditions Solstices Music", max_length=255)
    publisher_ipi: str = Field(default="00891234567", max_length=32)
    cwr_sender_code: str = Field(default="SOLSTICES", max_length=32)
    affiliated_societies: list[str] = Field(
        default_factory=lambda: ["SACEM", "SDRM", "SCPP"],
        sa_column=Column(JSON),
    )
    default_currency: str = Field(default="EUR", max_length=3)
    default_operator_email: str = Field(
        default="royalty.manager@solstices-music.fr",
        max_length=255,
    )
    publisher_iban: str = Field(
        default="FR0830004019920005554443210",
        max_length=64,
    )
    publisher_bic: str = Field(
        default="BNPAFRPPXXX",
        max_length=16,
    )

    # Règles métier déterministes configurables
    max_publisher_dep_pct: Decimal = Field(
        default=Decimal("50.00"),
        sa_column=Column(Numeric(6, 2), nullable=False, default=Decimal("50.00")),
    )
    default_admin_fee_pct: Decimal = Field(
        default=Decimal("10.00"),
        sa_column=Column(Numeric(6, 2), nullable=False, default=Decimal("10.00")),
    )
    vat_rate_pct: Decimal = Field(
        default=Decimal("10.00"),
        sa_column=Column(Numeric(6, 2), nullable=False, default=Decimal("10.00")),
    )
    min_payment_threshold: Decimal = Field(
        default=Decimal("50.00"),
        sa_column=Column(Numeric(10, 2), nullable=False, default=Decimal("50.00")),
    )
    statement_messages: dict[str, str] = Field(
        default_factory=lambda: dict(DEFAULT_STATEMENT_MESSAGES),
        sa_column=Column(JSON),
    )
    currency_rates: list[dict[str, Any]] = Field(
        default_factory=lambda: list(DEFAULT_CURRENCY_RATES),
        sa_column=Column(JSON),
    )

    # Paramètres IA & Seuils Human-in-the-loop
    openrouter_model: str = Field(default="anthropic/claude-3.5-sonnet", max_length=128)
    high_confidence_threshold: float = Field(default=0.90)
    anomaly_threshold: float = Field(default=0.65)
    vector_weight: float = Field(default=0.45)
    lexical_weight: float = Field(default=0.55)

    # Assistant d'onboarding & guide de démarrage
    onboarding_completed: bool = Field(default=False)
    onboarding_dismissed: bool = Field(default=False)
    onboarding_completed_steps: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON),
    )

    # Templates de splits favoris personnalisables
    split_presets: list[dict[str, Any]] = Field(
        default_factory=lambda: DEFAULT_SPLIT_PRESETS,
        sa_column=Column(JSON),
    )
    updated_at: datetime = Field(default_factory=utc_now)
