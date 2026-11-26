from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RightHolderRole(StrEnum):
    """Rôle d'un ayant droit sur une œuvre musicale (Édition, Synchro & Phono/Master)."""

    AUTHOR = "AUTHOR"
    COMPOSER = "COMPOSER"
    AUTHOR_COMPOSER = "AUTHOR_COMPOSER"
    ARRANGER = "ARRANGER"
    ADAPTOR = "ADAPTOR"
    PUBLISHER = "PUBLISHER"
    SUB_PUBLISHER = "SUB_PUBLISHER"
    PRODUCER = "PRODUCER"
    PERFORMER = "PERFORMER"
    # Codes courts CWR / Industrie
    A = "A"
    C = "C"
    AC = "AC"
    AR = "AR"
    AD = "AD"
    E = "E"
    SE = "SE"
    P = "P"    # Producteur Phonographique (Master)
    I = "I"    # Artiste-Interprète (Droits voisins / Phono)


class RightHolderSplit(BaseModel):
    """Quote-part déterministe d'un ayant droit par famille de droits (DEP, DRM, SYNC, PHONO)."""

    right_holder_id: UUID | None = Field(
        default=None,
        description="Identifiant canonique de l'ayant droit dans RightHolderDirectory",
    )
    holder_name: str = Field(..., min_length=1, description="Nom de l'ayant droit")
    ipi_number: str | None = Field(
        default=None,
        description="Identifiant IPI / CAE (9 à 11 chiffres) ou code ISNI/SCPP",
    )
    role: RightHolderRole = Field(..., description="Rôle sur l'œuvre (AC, A, C, E, SE, P, I)")
    dep_share_pct: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Part DEP (Droit d'Exécution Publique) en pourcentage (0 à 100)",
    )
    drm_share_pct: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Part DRM (Droit de Reproduction Mécanique) en pourcentage (0 à 100)",
    )
    sync_share_pct: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Part SYNC (Droit de Synchronisation audiovisuelle/pub) en pourcentage (0 à 100)",
    )
    phono_share_pct: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Part PHONO / Master & Droits voisins en pourcentage (0 à 100)",
    )
    share_percentage: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Part générale en pourcentage (par défaut égale à dep_share_pct)",
    )
    society_name: str | None = Field(
        default="SACEM",
        description="Société de gestion collective principale (ex: SACEM)",
    )
    society_de: str | None = Field(
        default=None,
        description="Société pour Droit d'Exécution (DE) : SACEM, ASCAP, BMI, PRS, GEMA...",
    )
    society_dr: str | None = Field(
        default=None,
        description="Société pour Droit de Reproduction (DR) : SDRM, SACEM, MCPS, Harry Fox...",
    )
    is_controlled: bool = Field(
        default=False,
        description="Indique si la part de cet ayant droit est contrôlée/collectée par un éditeur mandataire en coédition",
    )
    controlled_by_name: str | None = Field(
        default=None,
        description="Nom de l'éditeur contrôleur / mandataire d'encaissement (ex: SOC UNE MUSIQUE)",
    )

    @model_validator(mode="after")
    def sync_share_percentages(self) -> "RightHolderSplit":
        """Synchronise les parts par défaut si seules certaines colonnes sont fournies."""
        if not self.society_de:
            self.society_de = self.society_name or "SACEM"
        if not self.society_dr:
            self.society_dr = self.society_name or "SACEM"
        if not self.society_name:
            self.society_name = self.society_de or self.society_dr or "SACEM"

        if self.controlled_by_name and self.controlled_by_name.strip():
            self.is_controlled = True

        if (
            self.dep_share_pct == Decimal("0.00")
            and self.drm_share_pct == Decimal("0.00")
            and self.share_percentage > Decimal("0.00")
        ):
            self.dep_share_pct = self.share_percentage
            self.drm_share_pct = self.share_percentage
        elif self.share_percentage == Decimal("0.00") and self.dep_share_pct > Decimal("0.00"):
            self.share_percentage = self.dep_share_pct

        return self


class CWRValidationReport(BaseModel):
    """Rapport déterministe de pré-validation CWR et contrôle des clés DEP, DRM, SYNC et PHONO."""

    work_id: UUID | None = None
    work_title: str
    is_cwr_ready: bool = Field(
        ...,
        description="True uniquement s'il n'existe aucune erreur bloquante pour l'export CWR",
    )
    dep_total_pct: Decimal = Field(
        ...,
        description="Somme exacte des parts DEP (doit valoir 100.00 %)",
    )
    drm_total_pct: Decimal = Field(
        ...,
        description="Somme exacte des parts DRM (doit valoir 100.00 %)",
    )
    sync_total_pct: Decimal = Field(
        default=Decimal("100.00"),
        description="Somme exacte des parts SYNC (doit valoir 100.00 %)",
    )
    phono_total_pct: Decimal = Field(
        default=Decimal("100.00"),
        description="Somme exacte des parts PHONO / Master (doit valoir 100.00 %)",
    )
    publisher_dep_pct: Decimal = Field(
        default=Decimal("0.00"),
        description="Somme des parts éditeur/sous-éditeur en DEP (plafond statutaire Sacem <= 50 %)",
    )
    blocking_errors: list[str] = Field(
        default_factory=list,
        description="Anomalies bloquantes empêchant l'enregistrement CWR (ex: somme != 100%, IPI invalide)",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Avertissements non bloquants (ex: ISWC en attente d'attribution)",
    )


class WorkTimelineNote(BaseModel):
    """Note horodatée ajoutée au fil d'activité d'une œuvre."""

    id: str
    author: str
    text: str
    created_at: str


class WorkTimelineNoteCreate(BaseModel):
    """Payload d'ajout d'une note horodatée."""

    author: str = Field(default="Éditeur / Royalty Manager")
    text: str = Field(..., min_length=1, description="Contenu de la note / remarque libre")


class WorkBase(BaseModel):
    """Schéma de base pour une œuvre du catalogue."""

    title: str = Field(..., min_length=1, max_length=255, description="Titre principal de l'œuvre")
    subtitle: str | None = Field(default=None, max_length=255, description="Sous-titre officiel pour dépôt Sacem / CWR")
    alternate_titles: list[str] = Field(
        default_factory=list,
        description="Titres alternatifs ou traduits facilitant le matching",
    )
    iswc: str | None = Field(
        default=None,
        description="Code ISWC normalisé (ex: T-123.456.789-0)",
    )
    sacem_work_code: str | None = Field(
        default=None,
        description="Code Œuvre SACEM / COCV (ex: 111785573767)",
    )
    cotage_number: str | None = Field(
        default=None,
        description="Numéro de cotage éditorial / librairie musicale (ex: 4748, COT-001)",
    )
    isrc_codes: list[str] = Field(
        default_factory=list,
        description="Liste des codes ISRC des enregistrements (masters phono) liés à l'œuvre",
    )
    performers: list[str] = Field(
        default_factory=list,
        description="Interprètes principaux associés à l'œuvre",
    )
    genre: str | None = Field(default=None, description="Genre musical")
    duration_seconds: int | None = Field(default=None, description="Durée en secondes")
    creation_year: int | None = Field(default=None, description="Année de composition / création")
    administration_status: str = Field(
        default="ACTIVE",
        description="Statut : ACTIVE, IN_DISPUTE, UNDER_ADMIN, ARCHIVED",
    )
    contract_reference: str | None = Field(default=None, description="Référence du contrat associé")
    general_notes: str | None = Field(default=None, description="Mémo général / bloc-notes éditeur libre")
    timeline_notes: list[WorkTimelineNote] = Field(default_factory=list, description="Fil d'annotations horodatées")
    rights_managed: list[str] = Field(
        default_factory=lambda: ["DEP", "DRM", "SYNC", "PHONO"],
        description="Types de droits administrés sur l'œuvre (DEP, DRM, SYNC, PHONO)",
    )
    splits: list[RightHolderSplit] = Field(
        default_factory=list,
        description="Répartition des droits DEP / DRM / SYNC / PHONO par ayant droit",
    )
    sacem_registration_status: str | None = Field(
        default=None,
        description="Statut officiel SACEM : NOT_SUBMITTED, PENDING_ACK, REGISTERED, REJECTED",
    )
    sacem_ack_reference: str | None = Field(
        default=None,
        description="Référence du fichier ou lot d'accusé de réception SACEM (ex: ACK_20261116_01.V21)",
    )
    sacem_registered_at: datetime | None = Field(
        default=None,
        description="Date et heure d'enregistrement officiel par la SACEM",
    )
    sacem_rejection_reason: str | None = Field(
        default=None,
        description="Motifs de rejet ou codes d'erreurs CISAC notifiés par la SACEM",
    )
    lifecycle_status: str | None = Field(
        default=None,
        description="État métier choisi manuellement ou null pour déduction par défaut (INFORMATIONS_MANQUANTES, A_DEPOSER, DEPOSE_EN_ATTENTE, DEPOSE_ET_EXPLOITE, REJET_SACEM, ARCHIVE)",
    )
    entity_id: UUID | None = Field(
        default=None,
        description="Identifiant de l'entité éditoriale rattachée",
    )


class WorkCreate(WorkBase):
    """Schéma de création d'une œuvre au catalogue."""

    enforce_strict_100_pct: bool = Field(
        default=False,
        description="Si True, rejette à la création toute œuvre dont les splits != 100%",
    )

    @model_validator(mode="after")
    def validate_strict_splits_if_requested(self) -> "WorkCreate":
        if self.enforce_strict_100_pct and self.splits:
            dep_total = sum((s.dep_share_pct for s in self.splits), Decimal("0.00"))
            drm_total = sum((s.drm_share_pct for s in self.splits), Decimal("0.00"))
            if dep_total != Decimal("100.00"):
                raise ValueError(
                    f"La somme des parts DEP doit être égale à 100.00 % (actuel: {dep_total} %)."
                )
            if drm_total != Decimal("100.00"):
                raise ValueError(
                    f"La somme des parts DRM doit être égale à 100.00 % (actuel: {drm_total} %)."
                )
        return self


class WorkGroupReadSummary(BaseModel):
    """Résumé d'un groupe / projet auquel une œuvre est rattachée."""

    id: UUID
    name: str
    group_type: str
    production_company: str | None = None
    broadcaster_or_client: str | None = None
    contract_reference: str | None = None
    cue_usage_type: str | None = None
    track_or_cue_number: str | None = None


class WorkGroupBase(BaseModel):
    """Schéma de base pour un groupe d'œuvres / projet audiovisuel ou album."""

    name: str = Field(..., min_length=1, max_length=255, description="Nom du projet ou album (ex: Demain nous appartient)")
    group_type: str = Field(default="SERIE_TV", description="Type : SERIE_TV, FILM_CINEMA, DOCUMENTAIRE, EMISSION_TV, ALBUM, AUTRE")
    production_company: str | None = Field(default=None, description="Société de production (ex: TF1 Production, Newen)")
    broadcaster_or_client: str | None = Field(default=None, description="Diffuseur ou commanditaire (ex: TF1, Netflix)")
    release_year: int | None = Field(default=None, description="Année de diffusion ou sortie")
    director_or_producer: str | None = Field(default=None, description="Réalisateur ou Producteur")
    notes: str | None = Field(default=None, description="Notes sur le projet ou directives de cue-sheet")
    contract_id: UUID | None = Field(default=None, description="Contrat d'édition rattaché au projet")
    contract_reference: str | None = Field(default=None, description="Référence du contrat rattaché (ex: CTR-2026-DNA-01)")
    default_splits: list[RightHolderSplit] = Field(default_factory=list, description="Clés de répartition par défaut du projet")


class WorkGroupCreate(WorkGroupBase):
    """Création d'un groupe d'œuvres / projet."""

    initial_work_ids: list[UUID] = Field(default_factory=list, description="Œuvres à rattacher immédiatement au projet")


class WorkGroupUpdate(BaseModel):
    """Mise à jour d'un groupe d'œuvres / projet."""

    name: str | None = None
    group_type: str | None = None
    production_company: str | None = None
    broadcaster_or_client: str | None = None
    release_year: int | None = None
    director_or_producer: str | None = None
    notes: str | None = None
    contract_id: UUID | None = None
    contract_reference: str | None = None
    default_splits: list[RightHolderSplit] | None = None


class WorkGroupRead(WorkGroupBase):
    """Lecture d'un groupe d'œuvres avec nombre d'œuvres rattachées."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    works_count: int = 0
    created_at: datetime
    updated_at: datetime


class TargetHolderBatchUpdate(BaseModel):
    """Modification ciblée d'un ayant droit spécifique sur un lot d'œuvres."""

    target_holder_name_or_ipi: str = Field(..., description="Nom ou IPI de l'ayant droit ciblé dans les œuvres du lot")
    new_holder_name: str | None = Field(default=None, description="Nouveau nom si remplacement ou correction")
    new_ipi_number: str | None = Field(default=None, description="Nouvel IPI si régularisation")
    new_role: RightHolderRole | None = Field(default=None, description="Nouveau rôle (ex: E, SE, AC)")
    new_dep_share_pct: Decimal | None = Field(default=None, description="Nouvelle part DEP %")
    new_drm_share_pct: Decimal | None = Field(default=None, description="Nouvelle part DRM %")
    new_sync_share_pct: Decimal | None = Field(default=None, description="Nouvelle part SYNC %")
    new_phono_share_pct: Decimal | None = Field(default=None, description="Nouvelle part PHONO %")


class WorkBatchUpdatePayload(BaseModel):
    """Opérations appliquées par lot (batch) sur une sélection d'œuvres."""

    work_ids: list[UUID] = Field(..., min_length=1, description="Liste des identifiants d'œuvres à modifier en masse")
    assign_to_group_id: UUID | None = Field(default=None, description="Rattacher le lot à ce groupe / projet audiovisuel")
    inherit_group_contract: bool = Field(default=True, description="Hériter de la référence contrat du groupe si l'œuvre n'en a pas")
    inherit_group_splits: bool = Field(default=False, description="Écraser les splits des œuvres rattachées avec les splits par défaut du groupe")
    remove_from_group_id: UUID | None = Field(default=None, description="Retirer le lot de ce groupe / projet")
    cue_usage_type: str | None = Field(default=None, description="Usage audiovisuel (GÉNÉRIQUE, FOND, THEME, etc.)")
    administration_status: str | None = Field(default=None, description="Nouveau statut : ACTIVE, IN_DISPUTE, UNDER_ADMIN, ARCHIVED")
    lifecycle_status: str | None = Field(default=None, description="Nouvel état métier dans le cycle de vie éditorial")
    entity_id: UUID | None = Field(default=None, description="Réassigner le lot à une autre entité éditoriale")
    contract_reference: str | None = Field(default=None, description="Nouvelle référence contrat associée au lot")
    cotage_number: str | None = Field(default=None, description="Nouveau numéro de cotage pour le lot")
    genre: str | None = Field(default=None, description="Nouveau genre musical pour le lot")
    append_timeline_note: WorkTimelineNoteCreate | None = Field(default=None, description="Ajouter une annotation au fil de toutes les œuvres")
    append_general_notes: str | None = Field(default=None, description="Texte à ajouter au mémo éditeur de chaque œuvre")
    splits_preset: str | None = Field(default=None, description="Preset de splits à appliquer (ex: CESSION_50_50)")
    target_holder_update: TargetHolderBatchUpdate | None = Field(default=None, description="Mise à jour d'un ayant droit ciblé sur le lot")


class WorkBatchUpdateResult(BaseModel):
    """Résultat synthétique d'une modification par lot."""

    updated_works_count: int
    work_ids: list[UUID]
    summary_messages: list[str]


class WorkGroupBatchDeletePayload(BaseModel):
    """Payload de suppression groupée de groupes d'œuvres / projets."""

    group_ids: list[UUID] = Field(..., min_length=1, description="Liste des identifiants des groupes à supprimer")


class WorkBatchDeletePayload(BaseModel):
    """Payload de suppression groupée d'œuvres."""

    work_ids: list[UUID] = Field(..., min_length=1, description="Liste des identifiants d'œuvres à supprimer")


class WorkAuditIssueSeverity(StrEnum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class WorkAuditIssueCategory(StrEnum):
    MISSING_IPI = "MISSING_IPI"
    EQUILIBRIUM_ERROR = "EQUILIBRIUM_ERROR"
    NO_CONTROLLED_PUBLISHER = "NO_CONTROLLED_PUBLISHER"
    ORPHAN_COEDITION = "ORPHAN_COEDITION"
    MISSING_SACEM_CODE = "MISSING_SACEM_CODE"
    MISSING_ISWC = "MISSING_ISWC"
    MISSING_COTAGE = "MISSING_COTAGE"


class WorkAuditIssueItem(BaseModel):
    category: WorkAuditIssueCategory
    severity: WorkAuditIssueSeverity
    label: str
    details: str
    can_auto_repair: bool = False


class WorkAuditReportItem(BaseModel):
    work_id: UUID
    title: str
    iswc: str | None = None
    sacem_work_code: str | None = None
    cotage_number: str | None = None
    contract_reference: str | None = None
    has_blocking_errors: bool
    issues: list[WorkAuditIssueItem] = Field(default_factory=list)


class WorkLifeCycleStatus(StrEnum):
    """Cycle de vie métier d'une œuvre au sein de la maison d'édition (US-5.16)."""

    INFORMATIONS_MANQUANTES = "INFORMATIONS_MANQUANTES"  # Données incomplètes (IPI manquant, splits != 100%)
    A_DEPOSER = "A_DEPOSER"                              # Prête à 100% CWR, en attente de premier export
    DEPOSE_EN_ATTENTE = "DEPOSE_EN_ATTENTE"              # Fichier CWR transmis à la SACEM, en attente d'ACK
    DEPOSE_ET_EXPLOITE = "DEPOSE_ET_EXPLOITE"            # Enregistrée officiellement auprès de la SACEM (Code COCV) et active
    REJET_SACEM = "REJET_SACEM"                          # Rejet notifié par accusé de réception CWR NACK
    ARCHIVE = "ARCHIVE"                                  # Sortie de mandat ou archivée


class CatalogAuditReport(BaseModel):
    total_works: int
    healthy_works_count: int
    health_score_pct: Decimal
    blocking_works_count: int
    warning_works_count: int
    issues_by_category: dict[str, int]
    items: list[WorkAuditReportItem] = Field(default_factory=list)


class CatalogAutoRepairPayload(BaseModel):
    auto_fill_ipis_from_directory: bool = True
    auto_balance_splits: bool = True
    auto_inherit_project_contracts: bool = True
    target_work_ids: list[UUID] | None = None


class CatalogAutoRepairResult(BaseModel):
    repaired_works_count: int
    repaired_ipis_count: int
    repaired_splits_count: int
    repaired_contracts_count: int
    summary_messages: list[str]


class WorkRead(WorkBase):
    """Schéma de lecture d'une œuvre enregistrée au catalogue avec son statut pré-CWR."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    groups: list[WorkGroupReadSummary] = Field(default_factory=list, description="Groupes et projets audiovisuels associés")
    cwr_validation: CWRValidationReport | None = None
    lifecycle_status: WorkLifeCycleStatus = Field(
        default=WorkLifeCycleStatus.A_DEPOSER,
        description="État métier éloquent dans le cycle de vie éditorial",
    )
    lifecycle_status_label: str = Field(
        default="À déposer",
        description="Libellé du statut métier",
    )
    lifecycle_status_issues: list[str] = Field(
        default_factory=list,
        description="Liste explicative des informations manquantes",
    )
    created_at: datetime
    updated_at: datetime


class CwrAckItem(BaseModel):
    """Détail d'une transaction analysée dans l'accusé de réception CWR ACK SACEM."""

    transaction_number: int | None = None
    work_id: UUID | None = None
    work_title: str
    matched: bool = False
    status: str = Field(..., description="Statut : REGISTERED, REJECTED, DUPLICATE, UNMATCHED")
    sacem_work_code: str | None = Field(default=None, description="Code SACEM attribué ou confirmé")
    iswc: str | None = None
    cotage_number: str | None = None
    rejection_reason: str | None = Field(default=None, description="Motif de rejet ou libellé d'erreur CISAC")
    cisac_error_code: str | None = Field(default=None, description="Code d'erreur CISAC (ex: 201, 104)")


class CwrAckReport(BaseModel):
    """Rapport de traitement de l'ingestion d'un fichier d'accusé de réception CWR ACK."""

    filename: str
    total_transactions: int
    registered_count: int
    rejected_count: int
    unmatched_count: int
    items: list[CwrAckItem] = Field(default_factory=list)
    summary_messages: list[str] = Field(default_factory=list)
