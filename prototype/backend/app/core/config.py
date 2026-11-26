from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration globale de l'application RightsCopilot (Pydantic v2)."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "RightsCopilot API"
    APP_VERSION: str = "0.1.0"
    APP_ENV: Literal["development", "staging", "production"] = "development"

    # Base de données PostgreSQL (+ pgvector)
    DATABASE_URL: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/rightscopilot",
        description="URL de connexion SQLAlchemy/SQLModel vers PostgreSQL",
    )

    # Configuration OpenRouter (LLM uniquement pour parsing de contrats PDF / matching)
    OPENROUTER_API_KEY: SecretStr | None = Field(
        default=None,
        description="Clé d'API OpenRouter",
    )
    OPENROUTER_BASE_URL: str = Field(
        default="https://openrouter.ai/api/v1",
        description="Endpoint compatible OpenAI pour OpenRouter",
    )
    OPENROUTER_MODEL: str = Field(
        default="anthropic/claude-3.5-sonnet",
        description="Modèle par défaut utilisé pour l'extraction structurée de contrats",
    )
    OPENROUTER_TIMEOUT_SECONDS: float = Field(
        default=60.0,
        ge=1.0,
        description="Timeout HTTP pour les appels OpenRouter",
    )

    # CORS
    CORS_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ],
        description="Origines autorisées pour le frontend Next.js",
    )

    @property
    def is_openrouter_configured(self) -> bool:
        """Vérifie si une clé OpenRouter valide est configurée."""
        if not self.OPENROUTER_API_KEY:
            return False
        secret = self.OPENROUTER_API_KEY.get_secret_value().strip()
        return bool(secret and secret != "sk-or-v1-your-api-key-here")


@lru_cache
def get_settings() -> Settings:
    """Retourne une instance mise en cache de Settings."""
    return Settings()


settings = get_settings()
