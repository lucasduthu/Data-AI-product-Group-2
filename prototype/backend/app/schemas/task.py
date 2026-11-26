from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class DashboardTaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Intitulé de la tâche")
    category: str = Field(default="AUTRE", description="Catégorie : SACEM, CONTRAT, CATALOGUE, RELEVE, AUTRE")
    priority: str = Field(default="NORMAL", description="Priorité : HIGH, NORMAL, LOW")
    due_date: str | None = Field(default=None, description="Échéance (ex: 2026-12-31)")


class DashboardTaskCreate(DashboardTaskBase):
    pass


class DashboardTaskUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    priority: str | None = None
    due_date: str | None = None
    is_completed: bool | None = None


class DashboardTaskRead(DashboardTaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_completed: bool
    created_at: datetime
    updated_at: datetime


class SacemDistributionInfo(BaseModel):
    name: str
    target_date: str
    days_remaining: int
    rights_covered: str
    is_next: bool = False


class SubpublisherDeadlineInfo(BaseModel):
    partner: str
    territory: str
    expected_period: str
    notes: str


class DashboardDeadlinesReport(BaseModel):
    current_date: str
    next_sacem_distribution: SacemDistributionInfo
    all_sacem_distributions: list[SacemDistributionInfo]
    subpublisher_deadlines: list[SubpublisherDeadlineInfo]
