from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CSVImportProfileBase(BaseModel):
    """Profil de mapping de colonnes CSV pour l'ingestion de relevés hétérogènes."""

    profile_name: str = Field(..., min_length=1, max_length=128)
    source_organism: str = Field(default="SACEM", max_length=64)
    delimiter: str = Field(default=",", max_length=4)
    decimal_separator: str = Field(default=".", max_length=4)
    default_right_type: str = Field(default="DEP", max_length=16)

    title_column: str = Field(default="work_title")
    iswc_column: str = Field(default="iswc")
    isrc_column: str = Field(default="isrc")
    performer_column: str = Field(default="performer")
    right_type_column: str = Field(default="right_type")
    exploitation_type_column: str = Field(default="exploitation_type")
    gross_amount_column: str = Field(default="gross_amount")
    units_column: str = Field(default="units")
    territory_column: str = Field(default="territory")


class CSVImportProfileCreate(CSVImportProfileBase):
    """Création d'un profil de mapping CSV."""


class CSVImportProfileRead(CSVImportProfileBase):
    """Lecture d'un profil de mapping CSV."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
