from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, Numeric
from sqlmodel import Field, SQLModel

from app.schemas.common import ValidationStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RoyaltyStatement(SQLModel, table=True):
    """Modèle SQLModel d'un relevé de ventes/royalties importé (CSV)."""

    __tablename__ = "royalty_statements"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    source_name: str = Field(index=True, max_length=128)
    filename: str | None = Field(default=None, max_length=255)
    period_start: date
    period_end: date
    total_gross_amount: Decimal = Field(
        default=Decimal("0.000000"),
        sa_column=Column(Numeric(18, 6), nullable=False, default=Decimal("0.000000")),
        description="Montant brut total converti en EUR pour la comptabilité française",
    )
    currency: str = Field(default="EUR", max_length=3)
    source_currency: str = Field(
        default="EUR",
        max_length=3,
        description="Devise d'origine du relevé (USD, GBP, CAD, etc.)",
    )
    exchange_rate: Decimal = Field(
        default=Decimal("1.000000"),
        sa_column=Column(Numeric(12, 6), nullable=False, default=Decimal("1.000000")),
        description="Taux de conversion vers l'EUR (1 devise source = X EUR, ou taux BCE)",
    )
    source_gross_amount: Decimal = Field(
        default=Decimal("0.000000"),
        sa_column=Column(Numeric(18, 6), nullable=False, default=Decimal("0.000000")),
        description="Montant brut total dans la devise d'origine",
    )
    accounting_status: str = Field(
        default="DRAFT",
        index=True,
        max_length=32,
        description="Statut comptable du décompte : DRAFT (simulation), LOCKED (clôturé et imputé au Grand Livre), ou PAID (règlements bancaires exécutés)",
    )
    campaign_id: UUID | None = Field(
        default=None,
        foreign_key="distribution_campaigns.id",
        index=True,
        description="ID de la campagne de répartition multi-relevés à laquelle est rattaché ce relevé",
    )
    locked_at: datetime | None = Field(default=None)
    paid_at: datetime | None = Field(default=None)
    payment_reference: str | None = Field(default=None, max_length=128, description="Référence du virement SEPA ou de la transaction")
    payment_method: str | None = Field(default=None, max_length=64, description="Mode de règlement (VIREMENT_SEPA, VIREMENT_BANCAIRE, CHEQUE, AUTRE)")
    payment_notes: str | None = Field(default=None, max_length=512, description="Observations et références de trésorerie")
    integrity_hash: str | None = Field(default=None, max_length=128, description="Empreinte SHA-256 du certificat d'intégrité comptable lors de la clôture")
    entity_id: UUID | None = Field(default=None, index=True, description="ID de l'entité éditoriale")
    created_at: datetime = Field(default_factory=utc_now)


class StatementLine(SQLModel, table=True):
    """Modèle SQLModel d'une ligne de relevé CSV soumise au Smart Matching et au calcul déterministe."""

    __tablename__ = "statement_lines"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    statement_id: UUID = Field(index=True, foreign_key="royalty_statements.id")
    row_number: int = Field(default=1)
    raw_work_title: str = Field(max_length=255)
    raw_iswc: str | None = Field(default=None, max_length=32)
    raw_sacem_code: str | None = Field(default=None, max_length=32, description="Code SACEM / COCV brut de la ligne")
    raw_isrc: str | None = Field(default=None, max_length=32)
    raw_performer: str | None = Field(default=None, max_length=255)
    right_type: str = Field(default="DEP", max_length=16)
    exploitation_type: str = Field(default="STREAMING", max_length=64)
    territory: str = Field(default="FR", max_length=16)
    units: int = Field(default=0)
    gross_amount: Decimal = Field(
        default=Decimal("0.000000"),
        sa_column=Column(Numeric(18, 6), nullable=False, default=Decimal("0.000000")),
        description="Montant brut de la ligne converti en EUR",
    )
    currency: str = Field(default="EUR", max_length=3)
    source_currency: str = Field(
        default="EUR",
        max_length=3,
        description="Devise d'origine de la ligne (USD, GBP, etc.)",
    )
    exchange_rate: Decimal = Field(
        default=Decimal("1.000000"),
        sa_column=Column(Numeric(12, 6), nullable=False, default=Decimal("1.000000")),
        description="Taux de change appliqué pour la conversion vers l'EUR",
    )
    source_gross_amount: Decimal = Field(
        default=Decimal("0.000000"),
        sa_column=Column(Numeric(18, 6), nullable=False, default=Decimal("0.000000")),
        description="Montant brut d'origine avant conversion",
    )

    # Smart Matching & Human-in-the-loop
    matched_work_id: UUID | None = Field(default=None, index=True)
    matched_work_title: str | None = Field(default=None, max_length=255)
    match_method: str = Field(default="EMBEDDING_VECTOR", max_length=64)
    confidence_score: float = Field(default=0.0)
    validation_status: str = Field(default=ValidationStatus.PENDING_REVIEW.value, index=True)
    validated_by: str | None = Field(default=None)
    validated_at: datetime | None = Field(default=None)
    review_notes: str | None = Field(default=None)

    top_match: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    alternatives: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    allocations: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
