from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.royalty import HolderWorkBreakdown


class StatementSummary(BaseModel):
    id: UUID
    source_name: str
    filename: str | None = None
    period_start: date
    period_end: date
    total_gross_amount: Decimal
    currency: str = "EUR"
    source_currency: str = "EUR"
    exchange_rate: Decimal = Decimal("1.000000")
    source_gross_amount: Decimal = Decimal("0.00")
    accounting_status: str
    integrity_hash: str | None = None


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    period_start: date | None = None
    period_end: date | None = None
    notes: str | None = None
    statement_ids: list[UUID] = Field(default_factory=list)


class CampaignUpdate(BaseModel):
    name: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    notes: str | None = None


class CampaignRead(BaseModel):
    id: UUID
    name: str
    period_start: date | None = None
    period_end: date | None = None
    accounting_status: str
    locked_at: datetime | None = None
    paid_at: datetime | None = None
    payment_reference: str | None = None
    payment_method: str | None = None
    payment_notes: str | None = None
    integrity_hash: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    statements_count: int = 0
    total_gross_amount: Decimal = Decimal("0.00")
    statements: list[StatementSummary] = Field(default_factory=list)


class AttachStatementsPayload(BaseModel):
    statement_ids: list[UUID]


class ConsolidatedSourceBreakdown(BaseModel):
    statement_id: UUID
    source_name: str
    filename: str | None = None
    allocated_gross: Decimal
    source_gross_amount: Decimal | None = None
    source_currency: str = "EUR"
    exchange_rate: Decimal = Decimal("1.000000")


class ConsolidatedHolderPayout(BaseModel):
    right_holder_id: UUID | None = None
    holder_name: str
    role: str | None = None
    ipi_number: str | None = None
    entity_type: str = "PERSONNE_PHYSIQUE"
    legal_form: str | None = None
    siret: str | None = None
    vat_number: str | None = None
    vat_applicable: bool = False
    vat_rate_pct: Decimal = Decimal("0.00")
    vat_amount: Decimal = Decimal("0.00")
    precompte_social_amount: Decimal = Decimal("0.00")
    iban: str | None = None
    bic: str | None = None
    total_gross_allocated: Decimal = Decimal("0.00")
    initial_advance: Decimal = Decimal("0.00")
    previously_recouped: Decimal = Decimal("0.00")
    recouped_in_period: Decimal = Decimal("0.00")
    remaining_unrecouped_balance: Decimal = Decimal("0.00")
    taxable_base_ht: Decimal = Decimal("0.00")
    previous_reserve_balance: Decimal = Decimal("0.00")
    min_payment_threshold: Decimal = Decimal("50.00")
    is_below_payment_threshold: bool = False
    retained_in_reserve: Decimal = Decimal("0.00")
    carried_forward_to_next: Decimal = Decimal("0.00")
    payout_status: str = "PAYABLE"
    legal_mention_applied: str | None = None
    net_payable_amount: Decimal = Decimal("0.00")
    e_invoicing_status: str | None = None
    sources_breakdown: list[ConsolidatedSourceBreakdown] = Field(default_factory=list)
    works_count: int = 0
    works_breakdown: list[HolderWorkBreakdown] = Field(default_factory=list)
    is_deceased: bool = False
    payout_recipient_id: UUID | None = None
    payout_recipient_name: str | None = None
    payout_redirected: bool = False
    succession_active: bool = False
    heirs_distribution: list[dict[str, Any]] = Field(default_factory=list)


class ConsolidatedCampaignReport(BaseModel):
    campaign_id: UUID
    campaign_name: str
    period_start: date | None = None
    period_end: date | None = None
    accounting_status: str
    is_locked: bool
    locked_at: str | None = None
    paid_at: str | None = None
    payment_reference: str | None = None
    payment_method: str | None = None
    payment_notes: str | None = None
    integrity_hash: str | None = None
    total_statements_count: int
    total_campaign_gross: Decimal
    total_allocated_checksum: Decimal
    total_recouped_in_period: Decimal
    total_net_payable: Decimal
    total_retained_in_reserve: Decimal
    payable_holders_count: int
    below_threshold_count: int
    recouping_count: int
    sources_summary: list[dict[str, Any]] = Field(default_factory=list)
    holders_payouts: list[ConsolidatedHolderPayout] = Field(default_factory=list)


class CampaignLockPayload(BaseModel):
    payment_reference: str | None = None
    payment_method: str | None = "VIREMENT_SEPA"
    payment_notes: str | None = None
