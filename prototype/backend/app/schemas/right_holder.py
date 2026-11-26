from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class HeirShare(BaseModel):
    """Quote-part d'un héritier dans le cadre d'une indivision successorale d'auteur."""

    heir_name: str
    share_pct: Decimal = Field(
        default=Decimal("100.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Quote-part en pourcentage (ex: 50.00)",
    )
    relationship: str = Field(
        default="Héritier",
        description="Lien de parenté : Conjoint survivant, Enfant, Légataire universel, Mandataire...",
    )
    heir_id: UUID | None = None
    ipi_number: str | None = None
    iban: str | None = None
    bic: str | None = None
    tax_notes: str | None = None


class RightHolderDirectoryCreate(BaseModel):
    """Schéma de création ou mise à jour d'un ayant droit dans l'annuaire."""

    full_name: str
    stage_name_or_trade_name: str | None = None
    entity_type: str = Field(
        default="PERSONNE_PHYSIQUE",
        description="PERSONNE_PHYSIQUE ou SOCIETE",
    )
    legal_form: str | None = None
    primary_role: str = "AC"
    ipi_number: str | None = None
    coad_or_isni: str | None = None
    affiliated_society: str = "SACEM"
    society_de: str = "SACEM"
    society_dr: str = "SACEM"
    email: str | None = None
    phone: str | None = None
    postal_address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str = "FR"
    siret: str | None = None
    vat_number: str | None = None
    vat_applicable: bool = True
    vat_rate_pct: Decimal = Decimal("10.00")
    ircec_precompte_applicable: bool = True
    urssaf_dispense_certificate: bool = False
    iban: str | None = None
    bic: str | None = None
    retained_reserve_balance: Decimal = Decimal("0.00")
    notes: str | None = None
    is_deceased: bool = False
    deceased_at: str | None = None
    payout_recipient_id: UUID | None = None
    payout_recipient_name: str | None = None
    succession_active: bool = False
    succession_notes: str | None = None
    heirs: list[HeirShare] = Field(default_factory=list)


class RightHolderDirectoryRead(BaseModel):
    """Schéma de lecture d'un ayant droit enrichi du nombre d'œuvres et du statut de facturation."""

    id: UUID
    full_name: str
    stage_name_or_trade_name: str | None = None
    entity_type: str
    legal_form: str | None = None
    primary_role: str
    ipi_number: str | None = None
    coad_or_isni: str | None = None
    affiliated_society: str
    society_de: str = "SACEM"
    society_dr: str = "SACEM"
    email: str | None = None
    phone: str | None = None
    postal_address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str
    siret: str | None = None
    vat_number: str | None = None
    vat_applicable: bool
    vat_rate_pct: Decimal
    ircec_precompte_applicable: bool
    urssaf_dispense_certificate: bool
    iban: str | None = None
    bic: str | None = None
    retained_reserve_balance: Decimal = Decimal("0.00")
    notes: str | None = None
    is_deceased: bool = False
    deceased_at: str | None = None
    payout_recipient_id: UUID | None = None
    payout_recipient_name: str | None = None
    succession_active: bool = False
    succession_notes: str | None = None
    heirs: list[HeirShare] = Field(default_factory=list)
    succession_summary: str | None = None
    works_count: int = 0
    invoicing_profile_label: str
    is_invoice_ready: bool
    created_at: datetime
    updated_at: datetime


class ReadyToUseInvoicePayload(BaseModel):
    """Document de Facture (Société) ou Note de Droits d'Auteur (Personne Physique) prêt à l'emploi."""

    invoice_number: str
    document_type: str = Field(
        description="NOTE_DROITS_AUTEUR (Personne Physique) ou FACTURE_REDEVANCES_FACTURX (Société)"
    )
    issue_date: str
    period_label: str
    publisher_name: str
    publisher_siret: str
    publisher_vat: str
    publisher_address: str
    holder_id: UUID
    holder_name: str
    entity_type: str
    legal_form: str
    holder_ipi: str | None = None
    holder_siret: str | None = None
    holder_vat_number: str | None = None
    holder_address: str
    holder_email: str | None = None
    holder_iban: str | None = None
    gross_royalties_eur: str
    recouped_advance_eur: str
    taxable_base_ht_eur: str
    vat_rate_pct: str
    vat_amount_eur: str
    ircec_raap_cotisation_eur: str
    csg_crds_cotisation_eur: str
    total_precompte_social_eur: str
    net_payable_to_holder_eur: str
    legal_mentions: list[str]
    printable_text: str


class HolderBatchDeletePayload(BaseModel):
    """Payload de suppression groupée d'ayants droit."""

    holder_ids: list[UUID] = Field(..., min_length=1, description="Liste des identifiants d'ayants droit à supprimer")
