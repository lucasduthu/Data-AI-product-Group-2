from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import AIConfidenceMetadata
from app.schemas.work import RightHolderRole


class ExploitationType(StrEnum):
    """Types d'exploitation couverts par un contrat d'édition, synchro ou phono."""

    STREAMING = "STREAMING"
    DOWNLOAD = "DOWNLOAD"
    PHYSICAL = "PHYSICAL"
    SYNCHRONIZATION = "SYNCHRONIZATION"
    PUBLIC_PERFORMANCE = "PUBLIC_PERFORMANCE"
    PHONO_MASTER = "PHONO_MASTER"
    NEIGHBORING_RIGHTS = "NEIGHBORING_RIGHTS"
    PRINT = "PRINT"


class RoyaltySplitRule(BaseModel):
    """Règle contractuelle de répartition par type d'exploitation."""

    exploitation_type: ExploitationType = Field(
        ...,
        description="Type d'exploitation musicale concerné",
    )
    publisher_share_pct: Decimal = Field(
        ...,
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Part éditeur en pourcentage (calcul déterministe)",
    )
    writer_share_pct: Decimal = Field(
        ...,
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Part auteur/compositeur en pourcentage (calcul déterministe)",
    )
    territory: str = Field(
        default="WORLD",
        description="Territoire d'application (code ISO ou WORLD)",
    )


class ContractPartyExtraction(BaseModel):
    """Ayant droit extrait d'un contrat d'édition PDF avec ses parts DEP/DRM et code IPI."""

    party_name: str = Field(..., min_length=1, description="Nom de la partie (auteur, compositeur, éditeur)")
    role: RightHolderRole = Field(..., description="Rôle sur l'œuvre (A, C, AC, E, SE)")
    ipi_number: str | None = Field(default=None, description="Numéro IPI / CAE extrait du contrat")
    dep_share_pct: Decimal = Field(
        ...,
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Quote-part DEP extraite (0 à 100 %)",
    )
    drm_share_pct: Decimal = Field(
        ...,
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Quote-part DRM extraite (0 à 100 %)",
    )
    sync_share_pct: Decimal = Field(
        default=Decimal("50.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Quote-part SYNC (Synchronisation) extraite (0 à 100 %)",
    )
    phono_share_pct: Decimal = Field(
        default=Decimal("50.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Quote-part PHONO / Master extraite (0 à 100 %)",
    )
    source_clause_quote: str | None = Field(
        default=None,
        description="Extrait verbatim de la clause du contrat justifiant cette répartition",
    )
    postal_address: str | None = Field(
        default=None,
        description="Adresse postale extraite de l'en-tête du contrat",
    )
    postal_code: str | None = Field(
        default=None,
        description="Code postal extrait de l'en-tête du contrat",
    )
    city: str | None = Field(
        default=None,
        description="Ville extraite de l'en-tête du contrat",
    )
    country: str = Field(
        default="FR",
        description="Pays",
    )
    legal_form: str | None = Field(
        default=None,
        description="Forme juridique extraite (ex: SAS, SARL, Artiste-Auteur)",
    )
    rcs_or_siret: str | None = Field(
        default=None,
        description="Numéro RCS ou SIRET extrait de l'en-tête du contrat",
    )


class ContractWorkSubgroup(BaseModel):
    """Sous-groupe d'œuvres au sein d'un contrat (ex: Musique Originale vs Banque Originale)."""

    name: str = Field(..., description="Nom du sous-groupe (ex: 'Musique Originale', 'Banque Originale')")
    composers: list[str] = Field(default_factory=list, description="Compositeurs et auteurs de ce sous-groupe")
    work_titles: list[str] = Field(default_factory=list, description="Liste des titres des œuvres de ce sous-groupe")


class ExpectedCessionContract(BaseModel):
    """Contrat de cession et d'édition attendu pour compléter les ayants droit d'une co-édition."""

    subgroup_name: str = Field(..., description="Nom du sous-groupe d'œuvres (ex: 'Musique Originale', 'Bande Originale')")
    composers: list[str] = Field(default_factory=list, description="Compositeurs et auteurs attendus pour cette cession")
    work_count: int = Field(default=0, description="Nombre d'œuvres concernées par cette cession")
    status: str = Field(default="PENDING", description="Statut : 'PENDING' (En attente) ou 'LINKED' (Rattaché)")
    linked_contract_id: UUID | None = Field(default=None, description="Identifiant unique du contrat de cession rattaché")
    linked_contract_reference: str | None = Field(default=None, description="Référence ou cotage du contrat de cession rattaché")


class AdvanceClauseExtraction(BaseModel):
    """Clause d'avance récupérable extraite d'un contrat PDF."""

    has_advance: bool = Field(default=False, description="Indique si le contrat prévoit une avance")
    advance_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Montant initial de l'avance récupérable (en EUR)",
    )
    beneficiary_name: str | None = Field(
        default=None,
        description="Ayant droit bénéficiaire de l'avance",
    )
    recoupable_streams: list[ExploitationType] = Field(
        default_factory=lambda: [
            ExploitationType.STREAMING,
            ExploitationType.DOWNLOAD,
            ExploitationType.SYNCHRONIZATION,
            ExploitationType.PUBLIC_PERFORMANCE,
        ],
        description="Types de droits sur lesquels l'avance est amortissable (recoupable)",
    )
    source_clause_quote: str | None = Field(
        default=None,
        description="Extrait verbatim de la clause d'avance",
    )


class ContractBase(BaseModel):
    """Données métier d'un contrat d'édition."""

    contract_reference: str = Field(
        ...,
        min_length=1,
        description="Référence interne ou numéro du contrat",
    )
    contract_type: str = Field(
        default="CESSION_EDITION",
        description="Type de contrat (ex: CESSION_EDITION, CO_EDITION, SOUS_EDITION)",
    )
    sacem_contract_number: str | None = Field(
        default=None,
        description="Numéro de contrat officiel SACEM (issu du CGP1 ou de la codification SPRD)",
    )
    cwr_contract_type: str | None = Field(
        default=None,
        description="Type CWR de contrat : OG (Original General), OS (Original Specific), PG (Sub-pub General), PS (Sub-pub Specific)",
    )
    publisher_name: str = Field(..., min_length=1, description="Nom de l'éditeur principal")
    counterparty_name: str = Field(
        ...,
        min_length=1,
        description="Nom de l'auteur/compositeur ou co-éditeur",
    )
    signature_date: date | None = Field(default=None, description="Date de signature du contrat")
    start_date: date | None = Field(default=None, description="Date de début d'effet")
    end_date: date | None = Field(default=None, description="Date d'échéance")
    territory: str = Field(default="WORLD", description="Territoire contractuel (ex: WORLD, FR, EU)")
    duration_years: int | None = Field(default=None, description="Durée du contrat en années")
    advance_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Montant de l'avance récupérable en devise du contrat",
    )
    recouped_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Montant de l'avance déjà amorti (recouped)",
    )
    currency: str = Field(default="EUR", min_length=3, max_length=3, description="Devise ISO 4217")
    parties: list[ContractPartyExtraction] = Field(
        default_factory=list,
        description="Parties au contrat avec leurs quotes-parts DEP/DRM et codes IPI",
    )
    advance: AdvanceClauseExtraction | None = Field(
        default=None,
        description="Détail structuré de la clause d'avance récupérable",
    )
    royalty_rules: list[RoyaltySplitRule] = Field(
        default_factory=list,
        description="Règles de répartition extraites par type d'exploitation",
    )
    work_titles: list[str] = Field(
        default_factory=list,
        description="Titres des œuvres mentionnées dans le contrat",
    )
    work_subgroups: list[ContractWorkSubgroup] = Field(
        default_factory=list,
        description="Sous-groupes d'œuvres identifiés au contrat avec leurs compositeurs respectifs",
    )
    co_edition_alert: str | None = Field(
        default=None,
        description="Message d'alerte informant qu'il s'agit d'un contrat de co-édition nécessitant le contrat de cession",
    )
    requires_cession_contract: bool = Field(
        default=False,
        description="Indique si ce contrat requiert le téléversement d'un contrat de cession et d'édition pour les parts auteurs",
    )
    expected_cession_contracts: list[ExpectedCessionContract] = Field(
        default_factory=list,
        description="Liste des contrats de cession et d'édition attendus pour compléter les œuvres de cette co-édition",
    )
    audiovisual_program: str | None = Field(
        default=None,
        description="Programme audiovisuel, série ou film associé au contrat",
    )


class ContractExtractionResult(ContractBase, AIConfidenceMetadata):
    """Schéma strict retourné suite au parsing d'un contrat PDF via OpenRouter.

    Inclut obligatoirement un score de confiance (0 à 1) et un statut de validation
    humaine (Human-in-the-loop). Aucun calcul financier n'est réalisé par le LLM.
    """

    source_filename: str | None = Field(
        default=None,
        description="Nom du fichier PDF source analysé",
    )
    extracted_clauses_summary: str | None = Field(
        default=None,
        description="Citations brutes des clauses ayant servi à l'extraction pour vérification humaine",
    )
    cwr_split_warnings: list[str] = Field(
        default_factory=list,
        description="Alertes déterministes si la somme des splits extraits != 100%",
    )


class ContractValidationPayload(BaseModel):
    """Payload de validation humaine (Human-in-the-loop) d'un contrat extrait."""

    validated_by: str = Field(default="royalty.manager@indie-pub.fr", min_length=1)
    approve: bool = Field(default=True, description="True pour VALIDATED, False pour REJECTED")
    review_notes: str | None = None
    contract_reference: str | None = Field(default=None, description="Référence interne ou numéro de cotage (ex: KFC576-01)")
    work_titles: list[str] | None = None
    work_subgroups: list[ContractWorkSubgroup] | None = None
    co_edition_alert: str | None = None
    requires_cession_contract: bool | None = None
    expected_cession_contracts: list[ExpectedCessionContract] | None = None
    audiovisual_program: str | None = None
    advance_amount: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    parties: list[ContractPartyExtraction] | None = None


class ContractRead(ContractExtractionResult):
    """Schéma de lecture d'un contrat persisté en base."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    remaining_advance_balance: Decimal = Field(
        default=Decimal("0.00"),
        description="Solde d'avance restant à amortir (advance_amount - recouped_amount)",
    )
    created_at: datetime
    updated_at: datetime


class ContractBatchDeletePayload(BaseModel):
    """Payload de suppression groupée de contrats."""

    contract_ids: list[UUID] = Field(..., min_length=1, description="Liste des identifiants de contrats à supprimer")


class CGP1ImportReport(BaseModel):
    """Compte-rendu de l'importation de contrats généraux SACEM (format CGP1 ou CSV)."""

    filename: str
    format_detected: str
    total_records_processed: int
    contracts_created: int
    contracts_updated: int
    summary_messages: list[str]
    contracts: list[ContractRead] = Field(default_factory=list)


class ContractLinkToWorksPayload(BaseModel):
    """Payload pour lier un contrat d'édition à un ensemble d'œuvres du catalogue."""

    target_mode: str = Field(
        ...,
        description="Mode de ciblage : 'WORK_GROUP' (projet audiovisuel), 'RIGHT_HOLDER_MATCH' (œuvres de l'ayant droit) ou 'SPECIFIC_WORKS'",
    )
    work_group_id: UUID | None = Field(default=None, description="Identifiant du groupe / projet audiovisuel cible")
    right_holder_name_or_ipi: str | None = Field(default=None, description="Nom ou IPI de l'ayant droit pour cibler ses œuvres")
    work_ids: list[UUID] | None = Field(default=None, description="Liste explicite d'identifiants d'œuvres cibles")
    override_existing_contract: bool = Field(
        default=False,
        description="Si False, ne remplace pas la référence contrat si l'œuvre en a déjà une",
    )


class ContractLinkToWorksResult(BaseModel):
    """Résultat de la liaison groupée d'un contrat aux œuvres."""

    contract_id: UUID
    contract_reference: str
    linked_works_count: int
    summary_message: str


class CreateWorkGroupFromContractRequest(BaseModel):
    """Payload pour créer un groupe d'œuvres / projet audiovisuel directement à partir d'un contrat."""

    name: str | None = Field(default=None, description="Nom du projet / groupe d'œuvres")
    group_type: str = Field(default="AUDIOVISUAL", description="Type : AUDIOVISUAL ou ALBUM")
    production_company: str | None = Field(default=None, description="Société de production")
    notes: str | None = Field(default=None, description="Notes ou directives")


class CreateWorkGroupFromContractResult(BaseModel):
    """Résultat de la création d'un groupe d'œuvres depuis un contrat."""

    work_group_id: UUID
    work_group_name: str
    group_type: str
    contract_reference: str
    linked_works_count: int
    work_titles: list[str]
    summary_message: str
