from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CSVImportProfile(SQLModel, table=True):
    """Profil de mapping de colonnes CSV personnalisable par source (Sacem, Spotify, Believe, Synchro)."""

    __tablename__ = "csv_import_profiles"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    profile_name: str = Field(index=True, max_length=128)
    source_organism: str = Field(default="SACEM", max_length=64)
    delimiter: str = Field(default=",", max_length=4)
    decimal_separator: str = Field(default=".", max_length=4)
    default_right_type: str = Field(default="DEP", max_length=16)

    # Noms des colonnes dans le CSV source
    title_column: str = Field(default="work_title", max_length=128)
    iswc_column: str = Field(default="iswc", max_length=128)
    isrc_column: str = Field(default="isrc", max_length=128)
    performer_column: str = Field(default="performer", max_length=128)
    right_type_column: str = Field(default="right_type", max_length=128)
    exploitation_type_column: str = Field(default="exploitation_type", max_length=128)
    gross_amount_column: str = Field(default="gross_amount", max_length=128)
    units_column: str = Field(default="units", max_length=128)
    territory_column: str = Field(default="territory", max_length=128)

    created_at: datetime = Field(default_factory=utc_now)
