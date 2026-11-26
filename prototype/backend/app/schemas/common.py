from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class ValidationStatus(StrEnum):
    """Statut de validation humaine (Human-in-the-loop)."""

    PENDING_REVIEW = "PENDING_REVIEW"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"


class AIConfidenceMetadata(BaseModel):
    """Métadonnées obligatoires pour toute proposition issue de l'IA (parsing ou matching)."""

    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Score de confiance entre 0.0 et 1.0 attribué au parsing ou au matching",
    )
    validation_status: ValidationStatus = Field(
        default=ValidationStatus.PENDING_REVIEW,
        description="Statut de validation humaine (Human-in-the-loop)",
    )
    validated_by: str | None = Field(
        default=None,
        description="Identifiant ou email de l'opérateur ayant validé ou rejeté l'entrée",
    )
    validated_at: datetime | None = Field(
        default=None,
        description="Horodatage de la validation humaine",
    )
    review_notes: str | None = Field(
        default=None,
        description="Commentaire optionnel lors de la revue humaine",
    )
