from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.entity_utils import resolve_entity_filter
from app.models.contract import Contract
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.schemas.common import ValidationStatus
from app.services.cwr_validator import validate_work_cwr

router = APIRouter(prefix="/api/v1/royalties", tags=["Royalties & Synthèse Financière"])


class DashboardSummaryResponse(BaseModel):
    """KPIs globaux pour le tableau de bord RightsCopilot."""

    total_works: int
    cwr_ready_works: int
    cwr_conflict_works: int
    total_contracts: int
    pending_contracts: int
    validated_contracts: int
    total_advances_granted: Decimal
    total_advances_recouped: Decimal
    total_advances_remaining: Decimal
    total_statements: int
    total_statement_lines: int
    validated_statement_lines: int
    pending_statement_lines: int
    total_gross_reconciled: Decimal
    total_gross_pending_blackbox: Decimal


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    entity_id: UUID | None = Query(None, description="Filtrer par entité éditoriale"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> DashboardSummaryResponse:
    """Retourne les indicateurs temps réel du catalogue, des contrats, avances et réconciliations pour l'entité active."""
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)

    if target_entity_id:
        if is_default_entity:
            works = list(session.exec(select(Work).where((Work.entity_id == target_entity_id) | (Work.entity_id == None))).all())  # noqa: E711
            contracts = list(session.exec(select(Contract).where((Contract.entity_id == target_entity_id) | (Contract.entity_id == None))).all())  # noqa: E711
            statements = list(session.exec(select(RoyaltyStatement).where((RoyaltyStatement.entity_id == target_entity_id) | (RoyaltyStatement.entity_id == None))).all())  # noqa: E711
        else:
            works = list(session.exec(select(Work).where(Work.entity_id == target_entity_id)).all())
            contracts = list(session.exec(select(Contract).where(Contract.entity_id == target_entity_id)).all())
            statements = list(session.exec(select(RoyaltyStatement).where(RoyaltyStatement.entity_id == target_entity_id)).all())
    else:
        works = list(session.exec(select(Work)).all())
        contracts = list(session.exec(select(Contract)).all())
        statements = list(session.exec(select(RoyaltyStatement)).all())

    stmt_ids = [s.id for s in statements]
    lines = list(session.exec(select(StatementLine).where(StatementLine.statement_id.in_(stmt_ids))).all()) if stmt_ids else []
    val_lines = [
        ln for ln in lines if ln.validation_status == ValidationStatus.VALIDATED.value
    ]
    pend_lines = [
        ln for ln in lines if ln.validation_status == ValidationStatus.PENDING_REVIEW.value
    ]

    gross_reconciled = sum(
        (Decimal(str(ln.gross_amount)) for ln in val_lines), Decimal("0.00")
    )
    gross_pending = sum(
        (Decimal(str(ln.gross_amount)) for ln in pend_lines), Decimal("0.00")
    )

    return DashboardSummaryResponse(
        total_works=len(works),
        cwr_ready_works=cwr_ready,
        cwr_conflict_works=len(works) - cwr_ready,
        total_contracts=len(contracts),
        pending_contracts=pending_contracts,
        validated_contracts=validated_contracts,
        total_advances_granted=total_adv,
        total_advances_recouped=recouped_adv,
        total_advances_remaining=max(Decimal("0.00"), total_adv - recouped_adv),
        total_statements=len(statements),
        total_statement_lines=len(lines),
        validated_statement_lines=len(val_lines),
        pending_statement_lines=len(pend_lines),
        total_gross_reconciled=gross_reconciled,
        total_gross_pending_blackbox=gross_pending,
    )
