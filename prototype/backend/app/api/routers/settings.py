from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.models.audit_log import AuditLog
from app.models.csv_profile import CSVImportProfile
from app.models.workspace_settings import (
    DEFAULT_CURRENCY_RATES,
    DEFAULT_SPLIT_PRESETS,
    WorkspaceSettings,
)
from app.schemas.csv_profile import CSVImportProfileCreate, CSVImportProfileRead
from app.schemas.workspace_settings import (
    AuditLogRead,
    CurrencyConvertRequest,
    CurrencyConvertResponse,
    CurrencyRateItem,
    OnboardingStateUpdate,
    SplitPresetSchema,
    WorkspaceSettingsRead,
    WorkspaceSettingsUpdate,
)


class UserFeedbackCreate(BaseModel):
    """Retour structuré d'un des 5 utilisateurs cibles (Royalty Manager / CEO Éditeur) sur le POC v1."""

    tester_name: str
    tester_role: str = "Royalty & Copyright Manager"
    current_tool: str = "Excel XLOOKUP + Le Sage (Improvize)"
    pain_severity_score: int = 5
    verdict: str
    edge_case_notes: str | None = None

router = APIRouter(prefix="/api/v1/settings", tags=["Configuration Éditeur & Audit"])


def get_or_create_workspace_settings(session: Session) -> WorkspaceSettings:
    """Récupère ou initialise les paramètres personnalisables de l'espace éditeur."""
    ws = session.exec(select(WorkspaceSettings)).first()
    if not ws:
        ws = WorkspaceSettings(
            publisher_name="Éditions Solstices Music",
            publisher_ipi="00891234567",
            cwr_sender_code="SOLSTICES",
            affiliated_societies=["SACEM", "SDRM", "SCPP"],
            default_currency="EUR",
            default_operator_email="royalty.manager@solstices-music.fr",
            max_publisher_dep_pct=Decimal("50.00"),
            default_admin_fee_pct=Decimal("10.00"),
            vat_rate_pct=Decimal("10.00"),
            openrouter_model="anthropic/claude-3.5-sonnet",
            high_confidence_threshold=0.90,
            anomaly_threshold=0.65,
            vector_weight=0.45,
            lexical_weight=0.55,
            split_presets=DEFAULT_SPLIT_PRESETS,
            updated_at=datetime.now(timezone.utc),
        )
        session.add(ws)
        session.commit()
        session.refresh(ws)
    return ws


def _ws_to_read(ws: WorkspaceSettings) -> WorkspaceSettingsRead:
    presets = [SplitPresetSchema.model_validate(p) for p in (ws.split_presets or [])]
    currencies = [CurrencyRateItem.model_validate(c) for c in (getattr(ws, "currency_rates", None) or DEFAULT_CURRENCY_RATES)]
    return WorkspaceSettingsRead(
        id=ws.id,
        publisher_name=ws.publisher_name,
        publisher_ipi=ws.publisher_ipi,
        cwr_sender_code=ws.cwr_sender_code,
        affiliated_societies=ws.affiliated_societies or ["SACEM", "SDRM", "SCPP"],
        default_currency=ws.default_currency,
        default_operator_email=ws.default_operator_email,
        publisher_iban=ws.publisher_iban if getattr(ws, "publisher_iban", None) is not None else "FR0830004019920005554443210",
        publisher_bic=ws.publisher_bic if getattr(ws, "publisher_bic", None) is not None else "BNPAFRPPXXX",
        max_publisher_dep_pct=Decimal(str(ws.max_publisher_dep_pct)),
        default_admin_fee_pct=Decimal(str(ws.default_admin_fee_pct)),
        vat_rate_pct=Decimal(str(ws.vat_rate_pct)),
        min_payment_threshold=Decimal(str(getattr(ws, "min_payment_threshold", Decimal("50.00")))),
        statement_messages=getattr(ws, "statement_messages", None) or {},
        onboarding_completed=bool(getattr(ws, "onboarding_completed", False)),
        onboarding_dismissed=bool(getattr(ws, "onboarding_dismissed", False)),
        onboarding_completed_steps=list(getattr(ws, "onboarding_completed_steps", None) or []),
        openrouter_model=ws.openrouter_model,
        high_confidence_threshold=ws.high_confidence_threshold,
        anomaly_threshold=ws.anomaly_threshold,
        vector_weight=ws.vector_weight,
        lexical_weight=ws.lexical_weight,
        split_presets=presets,
        currency_rates=currencies,
        updated_at=ws.updated_at,
    )


@router.get("", response_model=WorkspaceSettingsRead)
def read_workspace_settings(
    session: Session = Depends(get_session),
) -> WorkspaceSettingsRead:
    """Retourne la configuration active de l'éditeur (profil CWR, seuils IA, presets de splits)."""
    ws = get_or_create_workspace_settings(session)
    return _ws_to_read(ws)


@router.put("", response_model=WorkspaceSettingsRead)
def update_workspace_settings(
    payload: WorkspaceSettingsUpdate,
    session: Session = Depends(get_session),
) -> WorkspaceSettingsRead:
    """Met à jour les préférences de l'éditeur et journalise la modification dans l'Audit Trail."""
    ws = get_or_create_workspace_settings(session)
    now = datetime.now(timezone.utc)

    ws.publisher_name = payload.publisher_name
    ws.publisher_ipi = payload.publisher_ipi
    ws.cwr_sender_code = payload.cwr_sender_code
    ws.affiliated_societies = payload.affiliated_societies
    ws.default_currency = payload.default_currency
    ws.default_operator_email = payload.default_operator_email
    if payload.publisher_iban is not None:
        ws.publisher_iban = payload.publisher_iban
    if payload.publisher_bic is not None:
        ws.publisher_bic = payload.publisher_bic
    ws.max_publisher_dep_pct = payload.max_publisher_dep_pct
    ws.default_admin_fee_pct = payload.default_admin_fee_pct
    ws.vat_rate_pct = payload.vat_rate_pct
    ws.openrouter_model = payload.openrouter_model
    ws.high_confidence_threshold = payload.high_confidence_threshold
    ws.anomaly_threshold = payload.anomaly_threshold
    ws.vector_weight = payload.vector_weight
    ws.lexical_weight = payload.lexical_weight
    if payload.split_presets:
        ws.split_presets = [p.model_dump(mode="json") for p in payload.split_presets]
    if payload.currency_rates:
        ws.currency_rates = [c.model_dump(mode="json") for c in payload.currency_rates]
    if payload.onboarding_completed is not None:
        ws.onboarding_completed = payload.onboarding_completed
    if payload.onboarding_dismissed is not None:
        ws.onboarding_dismissed = payload.onboarding_dismissed
    if payload.onboarding_completed_steps is not None:
        ws.onboarding_completed_steps = payload.onboarding_completed_steps
    elif ws.publisher_name and ws.publisher_ipi:
        current_steps = list(getattr(ws, "onboarding_completed_steps", None) or [])
        if "step_identity" not in current_steps:
            current_steps.append("step_identity")
            ws.onboarding_completed_steps = current_steps
    ws.updated_at = now

    session.add(ws)
    session.add(
        AuditLog(
            action_type="SETTINGS_UPDATED",
            entity_type="WORKSPACE_SETTINGS",
            entity_id=str(ws.id),
            actor=payload.default_operator_email,
            summary=(
                f"Configuration mise à jour : Éditeur={ws.publisher_name} (IPI {ws.publisher_ipi}), "
                f"Plafond DEP={ws.max_publisher_dep_pct}%, Seuil Haute Confiance={int(ws.high_confidence_threshold*100)}%"
            ),
            details={
                "max_publisher_dep_pct": str(ws.max_publisher_dep_pct),
                "high_confidence_threshold": ws.high_confidence_threshold,
                "vector_weight": ws.vector_weight,
                "lexical_weight": ws.lexical_weight,
            },
            created_at=now,
        )
    )
    session.commit()
    session.refresh(ws)
    return _ws_to_read(ws)


@router.post("/onboarding", response_model=WorkspaceSettingsRead)
def update_onboarding_status(
    payload: OnboardingStateUpdate,
    session: Session = Depends(get_session),
) -> WorkspaceSettingsRead:
    """Met à jour spécifiquement la progression ou la visibilité de l'assistant d'onboarding."""
    ws = get_or_create_workspace_settings(session)
    now = datetime.now(timezone.utc)

    if payload.completed is not None:
        ws.onboarding_completed = payload.completed
    if payload.dismissed is not None:
        ws.onboarding_dismissed = payload.dismissed
    if payload.completed_steps is not None:
        ws.onboarding_completed_steps = payload.completed_steps

    ws.updated_at = now
    session.add(ws)
    session.commit()
    session.refresh(ws)
    return _ws_to_read(ws)


DEFAULT_CSV_PROFILES = [
    {
        "profile_name": "Standard SACEM / DSP (Virgule)",
        "source_organism": "SACEM",
        "delimiter": ",",
        "decimal_separator": ".",
        "default_right_type": "DEP",
        "title_column": "work_title",
        "iswc_column": "iswc",
        "isrc_column": "isrc",
        "performer_column": "performer",
        "right_type_column": "right_type",
        "exploitation_type_column": "exploitation_type",
        "gross_amount_column": "gross_amount",
        "units_column": "units",
        "territory_column": "territory",
    },
    {
        "profile_name": "Export Français Point-Virgule (SACEM / SCPP)",
        "source_organism": "SCPP",
        "delimiter": ";",
        "decimal_separator": ",",
        "default_right_type": "PHONO",
        "title_column": "titre",
        "iswc_column": "code_iswc",
        "isrc_column": "code_isrc",
        "performer_column": "interprete",
        "right_type_column": "type_droit",
        "exploitation_type_column": "exploitation",
        "gross_amount_column": "montant_brut",
        "units_column": "quantite",
        "territory_column": "territoire",
    },
]


@router.get("/csv-profiles", response_model=list[CSVImportProfileRead])
def list_csv_profiles(
    session: Session = Depends(get_session),
) -> list[CSVImportProfileRead]:
    """Retourne les profils de mapping de colonnes CSV personnalisés."""
    profiles = list(session.exec(select(CSVImportProfile)).all())
    if not profiles:
        for p_data in DEFAULT_CSV_PROFILES:
            prof = CSVImportProfile(**p_data)
            session.add(prof)
        session.commit()
        profiles = list(session.exec(select(CSVImportProfile)).all())
    return [CSVImportProfileRead.model_validate(p) for p in profiles]


@router.post(
    "/csv-profiles",
    response_model=CSVImportProfileRead,
    status_code=status.HTTP_201_CREATED,
)
def create_csv_profile(
    payload: CSVImportProfileCreate,
    session: Session = Depends(get_session),
) -> CSVImportProfileRead:
    """Enregistre un nouveau profil de mapping de colonnes CSV."""
    prof = CSVImportProfile(**payload.model_dump())
    session.add(prof)
    session.commit()
    session.refresh(prof)
    return CSVImportProfileRead.model_validate(prof)


@router.get("/audit-logs", response_model=list[AuditLogRead])
def list_audit_logs(
    limit: int = 50,
    session: Session = Depends(get_session),
) -> list[AuditLogRead]:
    """Retourne l'historique d'audit immuable des validations humaines et configurations."""
    logs = list(
        session.exec(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        ).all()
    )
    return [AuditLogRead.model_validate(lg) for lg in logs]


@router.post(
    "/user-feedback",
    response_model=AuditLogRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_poc_user_feedback(
    payload: UserFeedbackCreate,
    session: Session = Depends(get_session),
) -> AuditLogRead:
    """Enregistre le retour d'un des 5 utilisateurs cibles (avant le 25 novembre) dans le journal d'audit."""
    log_entry = AuditLog(
        action_type="POC_USER_FEEDBACK",
        entity_type="TARGET_USER_INTERVIEW",
        entity_id=payload.tester_name,
        actor=f"{payload.tester_name} ({payload.tester_role})",
        summary=(
            f"[Sévérité {payload.pain_severity_score}/5 • Outil actuel: {payload.current_tool}] "
            f"{payload.verdict}"
        ),
        details=payload.model_dump(),
        created_at=datetime.now(timezone.utc),
    )
    session.add(log_entry)
    session.commit()
    session.refresh(log_entry)
    return AuditLogRead.model_validate(log_entry)


@router.get("/openrouter-status")
async def get_openrouter_status(
    session: Session = Depends(get_session),
) -> dict:
    """Vérifie sans consommer de tokens l'état de la clé OpenRouter et le budget restant (plafond 10 € / ~$11.13)."""
    ws = get_or_create_workspace_settings(session)
    if not settings.is_openrouter_configured:
        return {
            "configured": False,
            "base_url": settings.OPENROUTER_BASE_URL,
            "active_model": ws.openrouter_model or settings.OPENROUTER_MODEL,
            "status_message": "Clé OPENROUTER_API_KEY absente ou de démonstration — Fallback déterministe actif.",
            "usage_usd": None,
            "limit_usd": 11.13,
            "remaining_usd": None,
        }

    api_key = settings.OPENROUTER_API_KEY.get_secret_value()  # type: ignore[union-attr]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/key",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                key_data = resp.json().get("data", {})
                usage = key_data.get("usage", 0.0)
                limit = key_data.get("limit") or 11.13
                remaining = key_data.get("limit_remaining")
                if remaining is None and limit is not None and usage is not None:
                    remaining = round(max(0.0, float(limit) - float(usage)), 4)
                return {
                    "configured": True,
                    "base_url": settings.OPENROUTER_BASE_URL,
                    "active_model": ws.openrouter_model or settings.OPENROUTER_MODEL,
                    "status_message": "Clé OpenRouter active et opérationnelle (Cache SHA-256 anti-gaspillage activé).",
                    "usage_usd": usage,
                    "limit_usd": limit,
                    "remaining_usd": remaining,
                }
    except Exception:
        pass

    return {
        "configured": True,
        "base_url": settings.OPENROUTER_BASE_URL,
        "active_model": ws.openrouter_model or settings.OPENROUTER_MODEL,
        "status_message": "Clé OpenRouter détectée dans .env (Cache SHA-256 anti-gaspillage activé).",
        "usage_usd": None,
        "limit_usd": 11.13,
        "remaining_usd": None,
    }


@router.get("/currencies", response_model=list[CurrencyRateItem])
def get_currency_parities(
    session: Session = Depends(get_session),
) -> list[CurrencyRateItem]:
    """Retourne la table active des parités de change officielles (BCE / fixing) pour les devises étrangères."""
    ws = get_or_create_workspace_settings(session)
    rates = getattr(ws, "currency_rates", None) or DEFAULT_CURRENCY_RATES
    return [CurrencyRateItem.model_validate(c) for c in rates]


@router.put("/currencies", response_model=list[CurrencyRateItem])
def update_currency_parity(
    payload: CurrencyRateItem,
    session: Session = Depends(get_session),
) -> list[CurrencyRateItem]:
    """Met à jour ou ajoute une parité de change officielle et l'enregistre avec traçabilité."""
    ws = get_or_create_workspace_settings(session)
    current_rates = list(getattr(ws, "currency_rates", None) or DEFAULT_CURRENCY_RATES)

    curr_code = payload.currency.strip().upper()
    found = False
    new_rates = []
    for item in current_rates:
        if item.get("currency", "").strip().upper() == curr_code:
            new_rates.append(payload.model_dump(mode="json"))
            found = True
        else:
            new_rates.append(item)

    if not found:
        new_rates.append(payload.model_dump(mode="json"))

    ws.currency_rates = new_rates
    ws.updated_at = datetime.now(timezone.utc)
    session.add(ws)
    session.commit()
    session.refresh(ws)
    return [CurrencyRateItem.model_validate(c) for c in ws.currency_rates]


@router.post("/currencies/reset-bce", response_model=list[CurrencyRateItem])
def reset_currency_parities_to_bce(
    session: Session = Depends(get_session),
) -> list[CurrencyRateItem]:
    """Réinitialise la table des devises aux taux officiels BCE de référence."""
    ws = get_or_create_workspace_settings(session)
    ws.currency_rates = list(DEFAULT_CURRENCY_RATES)
    ws.updated_at = datetime.now(timezone.utc)
    session.add(ws)
    session.commit()
    session.refresh(ws)
    return [CurrencyRateItem.model_validate(c) for c in ws.currency_rates]


@router.post("/convert", response_model=CurrencyConvertResponse)
def convert_currency_amount(
    payload: CurrencyConvertRequest,
    session: Session = Depends(get_session),
) -> CurrencyConvertResponse:
    """Convertit de manière 100 % déterministe un montant en devise étrangère vers l'EUR selon les parités BCE."""
    ws = get_or_create_workspace_settings(session)
    from_curr = payload.from_currency.strip().upper()
    to_curr = payload.to_currency.strip().upper()

    if from_curr == to_curr:
        return CurrencyConvertResponse(
            source_amount=payload.amount,
            source_currency=from_curr,
            target_amount=payload.amount,
            target_currency=to_curr,
            rate_to_eur=Decimal("1.000000"),
            rate_bce=Decimal("1.000000"),
            formula=f"{payload.amount} {from_curr} = {payload.amount} {to_curr} (Parité 1:1)",
        )

    rates = {c["currency"].upper(): c for c in (getattr(ws, "currency_rates", None) or DEFAULT_CURRENCY_RATES)}
    rate_info = rates.get(from_curr)
    if not rate_info and not payload.custom_rate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parité de change non configurée pour la devise {from_curr}. Veuillez définir son taux dans les réglages.",
        )

    rate_to_eur = payload.custom_rate or Decimal(str(rate_info["rate_to_eur"]))
    rate_bce = Decimal(str(rate_info.get("rate_bce", Decimal("1.000000") / rate_to_eur))) if rate_info else (Decimal("1.000000") / rate_to_eur)

    target_amount = (payload.amount * rate_to_eur).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    formula = f"{payload.amount} {from_curr} * {rate_to_eur} = {target_amount} EUR (BCE: 1 EUR = {rate_bce} {from_curr})"

    return CurrencyConvertResponse(
        source_amount=payload.amount,
        source_currency=from_curr,
        target_amount=target_amount,
        target_currency="EUR",
        rate_to_eur=rate_to_eur,
        rate_bce=rate_bce,
        formula=formula,
    )


class OverrideSwitchPayload(BaseModel):
    """Activation / désactivation de l'interrupteur d'urgence IA (⏻ Override Switch)."""
    deterministic_only: bool
    actor: str = "Copyright Manager (On-Call)"


@router.post("/override-switch")
def toggle_ai_override_switch(
    payload: OverrideSwitchPayload,
    session: Session = Depends(get_session),
) -> dict:
    """Bascule en 1 clic entre le mode IA (OpenRouter LLM + Fallback) et le mode Déterministe Seul (⏻ Override Switch)."""
    ws = get_or_create_workspace_settings(session)
    now = datetime.now(timezone.utc)
    ws.openrouter_model = "deterministic" if payload.deterministic_only else "anthropic/claude-3.5-sonnet"
    ws.updated_at = now
    session.add(ws)
    session.add(
        AuditLog(
            action_type="AI_OVERRIDE_SWITCH_TOGGLED",
            entity_type="WORKSPACE_SETTINGS",
            entity_id=str(ws.id),
            actor=payload.actor,
            summary=(
                "⏻ Override Switch ACTIVÉ : Mode Déterministe Seul (LLM désactivé, extraction regex Rung 1)."
                if payload.deterministic_only
                else "⏻ Override Switch DÉSACTIVÉ : Mode Copilot IA OpenRouter actif (Rung 3 + Gate Rung 1)."
            ),
            details={"deterministic_only": payload.deterministic_only, "openrouter_model": ws.openrouter_model},
            created_at=now,
        )
    )
    session.commit()
    return {
        "deterministic_only": payload.deterministic_only,
        "active_model": ws.openrouter_model,
        "updated_at": now.isoformat(),
    }

