from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, Numeric
from sqlmodel import Field, SQLModel

from app.schemas.common import ValidationStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Contract(SQLModel, table=True):
    """Modèle SQLModel d'un contrat d'édition extrait et soumis à validation humaine."""

    __tablename__ = "contracts"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    contract_reference: str = Field(index=True, max_length=128)
    contract_type: str = Field(default="CESSION_EDITION", max_length=64)
    sacem_contract_number: str | None = Field(default=None, max_length=64, index=True)
    cwr_contract_type: str | None = Field(default=None, max_length=32)
    publisher_name: str = Field(max_length=255)
    counterparty_name: str = Field(max_length=255)
    right_holder_id: UUID | None = Field(
        default=None,
        index=True,
        description="Clé étrangère canonique vers RightHolderDirectory",
    )
    signature_date: date | None = Field(default=None)
    start_date: date | None = Field(default=None)
    end_date: date | None = Field(default=None)
    territory: str = Field(default="WORLD", max_length=64)
    duration_years: int | None = Field(default=None)
    advance_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False, default=Decimal("0.00")),
    )
    recouped_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False, default=Decimal("0.00")),
    )
    currency: str = Field(default="EUR", max_length=3)
    work_titles: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    work_subgroups: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    co_edition_alert: str | None = Field(default=None)
    requires_cession_contract: bool = Field(default=False)
    expected_cession_contracts: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    audiovisual_program: str | None = Field(default=None, max_length=255)
    parties: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    advance: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    royalty_rules: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    source_filename: str | None = Field(default=None, max_length=255)
    extracted_clauses_summary: str | None = Field(default=None)
    cwr_split_warnings: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Human-in-the-loop & IA metadata
    confidence_score: float = Field(default=0.85)
    validation_status: str = Field(default=ValidationStatus.PENDING_REVIEW.value, index=True)
    validated_by: str | None = Field(default=None)
    validated_at: datetime | None = Field(default=None)
    review_notes: str | None = Field(default=None)
    entity_id: UUID | None = Field(default=None, index=True, description="ID de l'entité éditoriale rattachée")

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AdvanceLedger(SQLModel, table=True):
    """Compte de suivi déterministe de l'amortissement d'avance par contrat et ayant droit."""

    __tablename__ = "advance_ledgers"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    contract_id: UUID = Field(index=True)
    contract_reference: str = Field(max_length=128)
    right_holder_id: UUID | None = Field(
        default=None,
        index=True,
        description="Identifiant canonique de l'ayant droit dans RightHolderDirectory",
    )
    holder_name: str = Field(index=True, max_length=255)
    ipi_number: str | None = Field(default=None, index=True, max_length=32)
    initial_advance: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False, default=Decimal("0.00")),
    )
    recouped_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False, default=Decimal("0.00")),
    )
    updated_at: datetime = Field(default_factory=utc_now)


class RoyaltyLedgerEntry(SQLModel, table=True):
    """Écriture comptable immuable du Grand Livre générée lors du verrouillage (LOCKED) d'un relevé."""

    __tablename__ = "royalty_ledger_entries"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    statement_id: UUID = Field(index=True)
    contract_id: UUID | None = Field(default=None, index=True)
    contract_reference: str | None = Field(default=None, max_length=128)
    right_holder_id: UUID | None = Field(default=None, index=True)
    holder_name: str = Field(index=True, max_length=255)
    role: str | None = Field(default=None, max_length=32)
    ipi_number: str | None = Field(default=None, index=True, max_length=32)
    gross_royalties_allocated: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    initial_advance_snapshot: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    previously_recouped_snapshot: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    recouped_in_period: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    remaining_unrecouped_balance: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    precompte_ircec_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    carried_forward_initial: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
        description="Solde de réserve ou avance reporté de la période précédente",
    )
    retained_in_reserve: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
        description="Montant retenu en réserve car inférieur au seuil minimum",
    )
    payout_status: str = Field(
        default="PAYABLE",
        max_length=32,
        description="Statut financier : PAYABLE, BELOW_THRESHOLD, RECOUPING, ZERO_BALANCE",
    )
    payout_recipient_id: UUID | None = Field(
        default=None,
        index=True,
        description="Identifiant du tiers mandataire destinataire du virement",
    )
    payout_recipient_name: str | None = Field(
        default=None,
        max_length=255,
        description="Nom du tiers mandataire / tiers payé",
    )
    is_succession_payout: bool = Field(
        default=False,
        description="Vrai si la liquidation s'applique à une succession d'auteur avec héritiers",
    )
    heirs_payout_details: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, default=list),
        description="Détail de la répartition par quote-part successorale entre héritiers",
    )
    source_currency: str = Field(
        default="EUR",
        max_length=3,
        description="Devise d'origine du relevé (USD, GBP, etc.)",
    )
    exchange_rate: Decimal = Field(
        default=Decimal("1.000000"),
        sa_column=Column(Numeric(12, 6), nullable=False, default=Decimal("1.000000")),
        description="Taux de conversion vers l'EUR appliqué lors du verrouillage",
    )
    source_gross_allocated: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(14, 2), nullable=True),
        description="Montant brut alloué dans la devise d'origine avant conversion en EUR",
    )
    net_payable_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    created_at: datetime = Field(default_factory=utc_now)
