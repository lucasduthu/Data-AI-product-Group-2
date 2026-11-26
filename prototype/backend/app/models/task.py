from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DashboardTask(SQLModel, table=True):
    """Tâche personnalisée ou rappel métier affiché sur le Dashboard (US-5.17)."""

    __tablename__ = "dashboard_tasks"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    title: str = Field(..., max_length=255, description="Intitulé de la tâche ou action requise")
    category: str = Field(
        default="AUTRE",
        max_length=64,
        description="Catégorie métier : SACEM, CONTRAT, CATALOGUE, RELEVE, AUTRE",
    )
    priority: str = Field(
        default="NORMAL",
        max_length=32,
        description="Niveau d'urgence : HIGH (Urgent), NORMAL, LOW",
    )
    due_date: str | None = Field(
        default=None,
        max_length=32,
        description="Date d'échéance cible (YYYY-MM-DD ou texte libre)",
    )
    is_completed: bool = Field(default=False, index=True, description="Statut réalisé / validé")
    entity_id: UUID | None = Field(default=None, index=True, description="ID de l'entité éditoriale")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
