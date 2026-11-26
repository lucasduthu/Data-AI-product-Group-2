from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON, Numeric
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RightHolderDirectory(SQLModel, table=True):
    """
    Répertoire / Annuaire centralisé des Ayants Droit (Auteurs, Compositeurs, Éditeurs, Producteurs, Interprètes).
    Stocke le statut juridique (PERSONNE_PHYSIQUE vs SOCIETE), les coordonnées de contact, les identifiants
    IPI/SIRET/TVA, le régime fiscal (Précompte IRCEC/URSSAF vs Facturation Société Factur-X) et le RIB/IBAN.
    """

    __tablename__ = "right_holders_directory"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    full_name: str = Field(index=True, max_length=255, description="Nom complet ou Raison sociale")
    stage_name_or_trade_name: str | None = Field(
        default=None, max_length=255, description="Pseudonyme artistique ou Nom commercial"
    )
    entity_type: str = Field(
        default="PERSONNE_PHYSIQUE",
        index=True,
        max_length=32,
        description="PERSONNE_PHYSIQUE (Auteur/Interprète) ou SOCIETE (Éditeur/Label/Société d'auteur)",
    )
    legal_form: str | None = Field(
        default=None,
        max_length=64,
        description="Forme juridique : Particulier, Artiste-Auteur BNC, SAS, SARL, SA, Association...",
    )
    primary_role: str = Field(
        default="AC",
        max_length=16,
        description="Rôle principal : AC, A, C, E, SE, P, I",
    )
    ipi_number: str | None = Field(default=None, index=True, max_length=32, description="Code IPI (9-11 chiffres)")
    coad_or_isni: str | None = Field(default=None, max_length=64, description="Code COAD SACEM ou ISNI")
    affiliated_society: str = Field(
        default="SACEM", max_length=64, description="OGC d'affiliation : SACEM, SCPP, SPPF, ADAMI, SABAM, PRS..."
    )
    society_de: str = Field(
        default="SACEM", max_length=64, description="Société d'affiliation Droit d'Exécution (DE) : SACEM, ASCAP, BMI, PRS, GEMA..."
    )
    society_dr: str = Field(
        default="SACEM", max_length=64, description="Société d'affiliation Droit de Reproduction (DR) : SDRM, SACEM, MCPS, Harry Fox..."
    )

    # Coordonnées de contact & adresse de facturation
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    postal_address: str | None = Field(default=None, max_length=512)
    postal_code: str | None = Field(default=None, max_length=32)
    city: str | None = Field(default=None, max_length=128)
    country: str = Field(default="FR", max_length=8)

    # Informations fiscales, sociales & bancaires (pour Facturation Prête à l'Emploi)
    siret: str | None = Field(default=None, max_length=32, description="Numéro SIRET (14 chiffres) ou SIREN")
    vat_number: str | None = Field(default=None, max_length=64, description="N° TVA Intracommunautaire (ex: FR...)")
    vat_applicable: bool = Field(
        default=True,
        description="Assujetti à la TVA (True) ou Franchise en base de TVA Art. 293 B CGI (False)",
    )
    vat_rate_pct: Decimal = Field(
        default=Decimal("10.00"),
        sa_column=Column(Numeric(5, 2), nullable=False, default=Decimal("10.00")),
    )
    ircec_precompte_applicable: bool = Field(
        default=True,
        description="Soumis au Précompte Social Auteur IRCEC/URSSAF (~11.10%) si PERSONNE_PHYSIQUE sans dispense",
    )
    urssaf_dispense_certificate: bool = Field(
        default=False,
        description="Attestation de dispense de précompte URSSAF (Siret BNC) fournie",
    )
    iban: str | None = Field(default=None, max_length=64, description="IBAN pour virement SEPA des redevances")
    bic: str | None = Field(default=None, max_length=32, description="Code BIC / SWIFT")

    # Clôture comptable & réserve sous-seuil (Report à nouveau)
    retained_reserve_balance: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False, default=Decimal("0.00")),
        description="Solde de royalties conservé en réserve pour les montants inférieurs au seuil minimum",
    )

    # Successions d'auteurs, Héritiers & Tiers Mandataires (Redirection de paiement)
    is_deceased: bool = Field(
        default=False,
        description="Auteur décédé (protection post-mortem 70 ans)",
    )
    deceased_at: str | None = Field(
        default=None,
        max_length=32,
        description="Date du décès (AAAA-MM-JJ)",
    )
    payout_recipient_id: UUID | None = Field(
        default=None,
        index=True,
        description="Identifiant du tiers mandataire / notaire / ayant droit destinataire du virement",
    )
    payout_recipient_name: str | None = Field(
        default=None,
        max_length=255,
        description="Nom ou raison sociale du tiers payé / mandataire (ex: Étude Notariale, Mandataire, Agence)",
    )
    succession_active: bool = Field(
        default=False,
        description="Indivision successorale active avec quotes-parts réparties entre héritiers",
    )
    succession_notes: str | None = Field(
        default=None,
        max_length=512,
        description="Références de l'acte de notoriété notariée, nom du liquidateur ou généalogiste",
    )
    heirs: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, default=list),
        description="Liste des héritiers avec quote-part %, lien de parenté, rôle, coordonnées bancaires",
    )

    notes: str | None = Field(default=None, max_length=1024)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
