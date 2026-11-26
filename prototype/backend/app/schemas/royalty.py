from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class HolderWorkBreakdown(BaseModel):
    """Détail d'une œuvre créditrice pour un ayant droit dans un décompte SACEM."""

    work_id: UUID | None = None
    work_title: str
    iswc: str | None = None
    right_type: str = "DEP"  # DEP, DRM, SYNC, PHONO
    exploitation_type: str = "STREAMING"
    gross_line_amount: Decimal = Decimal("0.00")
    share_percentage: Decimal = Decimal("0.00")
    allocated_amount: Decimal = Decimal("0.00")
    territory: str = "FR"
    work_group_id: UUID | None = None
    work_group_title: str | None = None
    source_currency: str = "EUR"
    source_gross_amount: Decimal | None = None
    exchange_rate: Decimal | None = None


class AdvanceRecoupmentState(BaseModel):
    """État détaillé de répartition, statut fiscal et amortissement d'avance par ayant droit (100 % déterministe)."""

    right_holder_id: UUID | None = None
    holder_name: str
    role: str | None = None
    ipi_number: str | None = None
    contract_id: UUID | None = None
    contract_reference: str | None = None

    # Profil juridique, fiscal & bancaire (Annuaire Ayants Droit)
    entity_type: str = Field(
        default="PERSONNE_PHYSIQUE",
        description="PERSONNE_PHYSIQUE ou SOCIETE",
    )
    legal_form: str | None = None
    siret: str | None = None
    vat_number: str | None = None
    vat_applicable: bool = False
    vat_rate_pct: Decimal = Field(default=Decimal("0.00"))
    vat_amount: Decimal = Field(default=Decimal("0.00"))
    ircec_precompte_applicable: bool = True
    urssaf_dispense_certificate: bool = False
    iban: str | None = None
    bic: str | None = None

    # Successions & Redirection de paiement (Tiers Mandataires)
    is_deceased: bool = Field(default=False, description="Auteur décédé")
    payout_recipient_id: UUID | None = Field(default=None, description="ID du tiers mandataire")
    payout_recipient_name: str | None = Field(default=None, description="Nom du tiers mandataire")
    payout_redirected: bool = Field(default=False, description="Vrai si les fonds sont redirigés vers un tiers")
    succession_active: bool = Field(default=False, description="Vrai si succession avec répartition indivise")
    heirs_distribution: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Ventilation déterministe entre les héritiers",
    )

    # Montants financiers déterministes
    gross_royalties_allocated: Decimal = Field(
        default=Decimal("0.00"),
        description="Montant total des royalties allouées sur la période (en EUR)",
    )
    source_currency: str = Field(
        default="EUR",
        description="Devise source du décompte si relevé étranger (USD, GBP, etc.)",
    )
    source_gross_royalties_allocated: Decimal | None = Field(
        default=None,
        description="Montant brut alloué dans la devise d'origine",
    )
    exchange_rate: Decimal = Field(
        default=Decimal("1.000000"),
        description="Taux de conversion vers l'EUR",
    )
    initial_advance: Decimal = Field(
        default=Decimal("0.00"),
        description="Montant initial de l'avance contractuelle",
    )
    previously_recouped: Decimal = Field(
        default=Decimal("0.00"),
        description="Montant déjà amorti avant ce décompte",
    )
    recouped_in_period: Decimal = Field(
        default=Decimal("0.00"),
        description="Montant retenu au titre de l'amortissement de l'avance sur la période",
    )
    remaining_unrecouped_balance: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Solde d'avance restant à amortir après ce décompte",
    )
    taxable_base_ht: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Assiette soumise à rémunération après amortissement de l'avance (Brut - Retenu)",
    )
    precompte_ircec_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Retenue déterministe Précompte Social Auteur français (SSAA / IRCEC) - alias rétro-compatible",
    )
    precompte_social_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Cotisations sociales globales Artiste-Auteur retenues à la source (CSG-CRDS + IRCEC/CFP ~11,10 %)",
    )

    # Clôture comptable, seuil minimum de paiement et report à nouveau
    previous_reserve_balance: Decimal = Field(
        default=Decimal("0.00"),
        description="Solde en réserve reporté de la période précédente",
    )
    min_payment_threshold: Decimal = Field(
        default=Decimal("50.00"),
        description="Seuil minimal de paiement configuré",
    )
    is_below_payment_threshold: bool = Field(
        default=False,
        description="True si le net exigible est inférieur au seuil minimum",
    )
    retained_in_reserve: Decimal = Field(
        default=Decimal("0.00"),
        description="Montant retenu en réserve pour report à la période suivante",
    )
    carried_forward_to_next: Decimal = Field(
        default=Decimal("0.00"),
        description="Montant total reporté à nouveau (avance résiduelle ou réserve)",
    )
    payout_status: str = Field(
        default="PAYABLE",
        description="Statut financier : PAYABLE, BELOW_THRESHOLD, RECOUPING, ZERO_BALANCE",
    )
    legal_mention_applied: str | None = Field(
        default=None,
        description="Mention légale ou message de clôture appliqué au décompte",
    )

    net_payable_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Net à payer à l'ayant droit une fois l'avance amortie et les taxes/retenues appliquées",
    )
    e_invoicing_status: str = Field(
        default="FACTUR-X / E-REPORTING 2026 READY",
        description="Statut de conformité Facturation Électronique française 2026-2027",
    )

    # Ventilation détaillée par œuvre dans le décompte SACEM
    works_count: int = 0
    works_breakdown: list[HolderWorkBreakdown] = Field(default_factory=list)


class RoyaltyRunReport(BaseModel):
    """Rapport financier déterministe généré pour un relevé de royalties."""

    statement_id: UUID
    source_name: str
    accounting_status: str = Field(
        default="DRAFT",
        description="Statut comptable : DRAFT (simulation idempotente), LOCKED (clôturé et imputé au Grand Livre), ou PAID (règlements bancaires exécutés)",
    )
    is_locked: bool = Field(
        default=False,
        description="True si le relevé est verrouillé et que l'amortissement d'avance a été comptabilisé",
    )
    locked_at: str | None = Field(default=None)
    paid_at: str | None = Field(default=None)
    payment_reference: str | None = Field(default=None)
    payment_method: str | None = Field(default=None)
    payment_notes: str | None = Field(default=None)
    integrity_hash: str | None = Field(default=None)
    total_statement_gross: Decimal
    total_validated_gross: Decimal
    total_pending_review_gross: Decimal
    total_allocated_checksum: Decimal = Field(
        ...,
        description="Somme de contrôle stricte : doit être égale à total_validated_gross",
    )
    total_recouped_in_period: Decimal = Decimal("0.00")
    total_net_payable: Decimal = Decimal("0.00")
    total_retained_in_reserve: Decimal = Decimal("0.00")
    below_threshold_count: int = 0
    validated_lines_processed: int = 0
    pending_lines_skipped: int = 0
    holder_statements: list[AdvanceRecoupmentState] = Field(default_factory=list)
