from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DistributionCampaign(SQLModel, table=True):
    """Campagne de répartition consolidée regroupant plusieurs relevés (SACEM, DSPs)."""

    __tablename__ = "distribution_campaigns"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(index=True, max_length=128, description="Libellé de la campagne (ex: '2026-S1 Consolidée')")
    period_start: date | None = Field(default=None, description="Date de début de la période semestrielle")
    period_end: date | None = Field(default=None, description="Date de fin de la période semestrielle")
    accounting_status: str = Field(
        default="DRAFT",
        index=True,
        max_length=32,
        description="Statut comptable : DRAFT (simulation consolidée), LOCKED (clôturée avec empreinte SHA-256), PAID (règlements exécutés)",
    )
    locked_at: datetime | None = Field(default=None)
    paid_at: datetime | None = Field(default=None)
    payment_reference: str | None = Field(default=None, max_length=128)
    payment_method: str | None = Field(default=None, max_length=64)
    payment_notes: str | None = Field(default=None, max_length=512)
    integrity_hash: str | None = Field(
        default=None,
        max_length=128,
        description="Empreinte cryptographique SHA-256 scellant l'ensemble des décomptes et calculs consolidés de la campagne",
    )
    notes: str | None = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
