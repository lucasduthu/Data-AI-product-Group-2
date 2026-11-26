from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Work(SQLModel, table=True):
    """Modèle SQLModel représentant une œuvre musicale du catalogue."""

    __tablename__ = "works"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    title: str = Field(index=True, max_length=255)
    subtitle: str | None = Field(default=None, max_length=255, description="Sous-titre officiel pour dépôt Sacem / CWR")
    alternate_titles: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    iswc: str | None = Field(default=None, index=True, max_length=32)
    sacem_work_code: str | None = Field(
        default=None,
        index=True,
        max_length=32,
        description="Code Œuvre SACEM (COCV) à 10-11 chiffres",
    )
    cotage_number: str | None = Field(
        default=None,
        index=True,
        max_length=64,
        description="Numéro de cotage éditorial / musique de librairie",
    )
    isrc_codes: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    performers: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    
    # Nouveaux détails éditoriaux & métadonnées
    genre: str | None = Field(default=None, max_length=64, description="Genre musical (ex: Pop, Hip-Hop, Électro, BOF)")
    duration_seconds: int | None = Field(default=None, description="Durée de l'œuvre en secondes")
    creation_year: int | None = Field(default=None, description="Année de création / composition")
    administration_status: str = Field(
        default="ACTIVE",
        index=True,
        max_length=32,
        description="Statut : ACTIVE (Actif), IN_DISPUTE (En litige), UNDER_ADMIN (Sous contrat admin), ARCHIVED (Archivé)",
    )
    contract_reference: str | None = Field(
        default=None,
        max_length=128,
        description="Référence du contrat d'édition rattaché (ex: CTR-2026-LN01)",
    )
    
    # Notes & Fil chronologique d'annotations
    general_notes: str | None = Field(default=None, description="Mémo général / bloc-notes éditeur libre")
    timeline_notes: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON),
        description="Fil chronologique d'annotations horodatées : [{id, author, text, created_at}]",
    )
    
    # Suivi des dépôts SACEM & Accusés de réception CWR (ACK / NACK)
    sacem_registration_status: str | None = Field(
        default=None,
        index=True,
        max_length=32,
        description="Statut de dépôt SACEM : NOT_SUBMITTED, PENDING_ACK, REGISTERED, REJECTED",
    )
    sacem_ack_reference: str | None = Field(
        default=None,
        max_length=128,
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
        index=True,
        max_length=64,
        description="État métier éditorial choisi ou résolu : INFORMATIONS_MANQUANTES, A_DEPOSER, DEPOSE_EN_ATTENTE, DEPOSE_ET_EXPLOITE, REJET_SACEM, ARCHIVE",
    )
    entity_id: UUID | None = Field(
        default=None,
        index=True,
        description="ID de l'entité éditoriale rattachée (Kaptain Music, Une Musique...)",
    )
    
    splits: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    embedding: list[float] | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
