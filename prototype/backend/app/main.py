from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.routers import (
    campaigns,
    catalog,
    contracts,
    dashboard_tasks,
    entities,
    holders,
    royalties,
    sandbox,
    search,
    settings as settings_router,
    statements,
    subpublishing,
    work_groups,
)
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialise les tables SQLModel et applique les migrations incrémentales."""
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "API RightsCopilot : Gestion de catalogue d'œuvres, extraction structurée de contrats "
        "d'édition via OpenRouter, réconciliation par embeddings et calculs de splits déterministes."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog.router)
app.include_router(work_groups.router)
app.include_router(contracts.router)
app.include_router(holders.router)
app.include_router(statements.router)
app.include_router(campaigns.router)
app.include_router(royalties.router)
app.include_router(settings_router.router)
app.include_router(dashboard_tasks.router)
app.include_router(entities.router)
app.include_router(sandbox.router)
app.include_router(subpublishing.router)
app.include_router(search.router)


class HealthCheckResponse(BaseModel):
    """Schéma de réponse du healthcheck de l'API."""

    status: str
    service: str
    version: str
    environment: str
    openrouter_configured: bool
    openrouter_model: str
    timestamp: datetime


@app.get("/health", response_model=HealthCheckResponse, tags=["System"])
def healthcheck() -> HealthCheckResponse:
    """Vérifie l'état de santé de l'API et la présence de la configuration OpenRouter."""
    return HealthCheckResponse(
        status="ok",
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        openrouter_configured=settings.is_openrouter_configured,
        openrouter_model=settings.OPENROUTER_MODEL,
        timestamp=datetime.now(timezone.utc),
    )
