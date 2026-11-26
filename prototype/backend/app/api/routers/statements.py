import csv
import hashlib
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from io import StringIO
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from sqlmodel import Session, col, select

from app.api.routers.settings import get_or_create_workspace_settings
from app.core.database import get_session
from app.core.entity_utils import resolve_entity_filter
from app.models.audit_log import AuditLog
from app.models.contract import AdvanceLedger, Contract, RoyaltyLedgerEntry
from app.models.publishing_entity import PublishingEntity
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.common import ValidationStatus
from app.schemas.contract import ExploitationType
from app.schemas.right_holder import ReadyToUseInvoicePayload
from app.schemas.royalty import AdvanceRecoupmentState, HolderWorkBreakdown, RoyaltyRunReport
from app.schemas.sepa import SepaExportRequest, SepaExportResponse, SepaValidationReport
from app.schemas.statement import (
    CandidateWorkMatch,
    DeterministicSplitAllocation,
    MatchMethod,
    MarkStatementPaidPayload,
    StatementLineCreate,
    StatementLineCreateWorkAndMatchPayload,
    StatementLineMatch,
    StatementLineValidatePayload,
    StatementLockPayload,
    StatementRead,
)
from app.services.embedding_service import compute_text_embedding, normalize_music_title
from app.services.holder_statement_generator import generate_individual_holder_statement
from app.services.sepa_generator import build_sepa_validation_report, generate_sepa_pain001_xml
from app.services.royalty_engine import (
    CENT,
    MICRO_CENT,
    apply_advance_recoupment,
    calculate_line_allocations,
    finalize_period_holder_totals,
    normalize_holder_identity_name,
    normalize_ipi_code,
    resolve_canonical_holder_key,
)
from app.services.statement_matcher import match_statement_lines_batch

router = APIRouter(prefix="/api/v1/statements", tags=["Réconciliation CSV & Smart Matching"])


def _line_to_schema(line: StatementLine) -> StatementLineMatch:
    right_type_val: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
        line.right_type if line.right_type in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
    )
    method_enum = MatchMethod(line.match_method)
    if method_enum == MatchMethod.EXACT_ISWC:
        reasoning = (
            f"Identifiant ISWC exact ({line.raw_iswc}) reconnu sans ambiguïté sur '{line.matched_work_title}' "
            f"→ Clé déterministe {right_type_val} appliquée."
        )
    elif method_enum == MatchMethod.EXACT_SACEM_CODE:
        reasoning = (
            f"Code Œuvre SACEM / COCV exact ({line.raw_sacem_code or 'identifié'}) reconnu sans ambiguïté sur '{line.matched_work_title}' "
            f"→ Clé déterministe {right_type_val} appliquée."
        )
    elif method_enum == MatchMethod.EXACT_ISRC:
        reasoning = (
            f"ISWC absent • Code ISRC Master ({line.raw_isrc}) relié à '{line.matched_work_title}' "
            f"→ Clé déterministe {right_type_val} appliquée."
        )
    elif method_enum == MatchMethod.LEARNED_ALIAS:
        reasoning = (
            f"Alias mémorisé ('{line.raw_work_title}') issu d'une validation humaine antérieure "
            f"→ Rattaché à '{line.matched_work_title}' (score 100%)."
        )
    else:
        reasoning = (
            f"ISWC absent / titre bruité ('{line.raw_work_title}') • Rapprochement sémantique Fastembed + lexical "
            f"({int(round(line.confidence_score * 100))}%) vers '{line.matched_work_title or 'N/A'}' "
            f"→ Remplace la recherche XLOOKUP Excel avant import Le Sage."
        )
    try:
        exp_type = ExploitationType(line.exploitation_type)
    except (ValueError, TypeError):
        exp_type = ExploitationType.STREAMING

    return StatementLineMatch(
        id=line.id,
        statement_id=line.statement_id,
        row_number=line.row_number,
        raw_work_title=line.raw_work_title,
        raw_iswc=line.raw_iswc,
        raw_sacem_code=line.raw_sacem_code,
        raw_isrc=line.raw_isrc,
        raw_performer=line.raw_performer,
        right_type=right_type_val,
        exploitation_type=exp_type,
        territory=line.territory,
        units=line.units,
        gross_amount=Decimal(str(line.gross_amount)),
        currency=line.currency,
        source_currency=getattr(line, "source_currency", "EUR") or "EUR",
        exchange_rate=getattr(line, "exchange_rate", Decimal("1.000000")) or Decimal("1.000000"),
        source_gross_amount=Decimal(str(getattr(line, "source_gross_amount", Decimal("0.000000")) or "0.00")).quantize(CENT, rounding=ROUND_HALF_UP),
        matched_work_id=line.matched_work_id,
        matched_work_title=line.matched_work_title,
        match_method=method_enum,
        match_reasoning=reasoning,
        confidence_score=line.confidence_score,
        validation_status=ValidationStatus(line.validation_status),
        validated_by=line.validated_by,
        validated_at=line.validated_at,
        review_notes=line.review_notes,
        top_match=(
            CandidateWorkMatch.model_validate(line.top_match) if line.top_match else None
        ),
        alternatives=[
            CandidateWorkMatch.model_validate(a) for a in (line.alternatives or [])
        ],
        allocations=[
            DeterministicSplitAllocation.model_validate(al)
            for al in (line.allocations or [])
        ],
    )


def _statement_to_read(stmt: RoyaltyStatement, lines: list[StatementLine]) -> StatementRead:
    line_schemas = [_line_to_schema(ln) for ln in lines]
    validated_gross = sum(
        (
            ln.gross_amount
            for ln in line_schemas
            if ln.validation_status == ValidationStatus.VALIDATED
        ),
        Decimal("0.00"),
    ).quantize(CENT, rounding=ROUND_HALF_UP)
    pending_gross = sum(
        (
            ln.gross_amount
            for ln in line_schemas
            if ln.validation_status == ValidationStatus.PENDING_REVIEW
        ),
        Decimal("0.00"),
    ).quantize(CENT, rounding=ROUND_HALF_UP)
    validated_count = sum(
        1 for ln in line_schemas if ln.validation_status == ValidationStatus.VALIDATED
    )
    return StatementRead(
        id=stmt.id,
        source_name=stmt.source_name,
        filename=stmt.filename,
        period_start=stmt.period_start,
        period_end=stmt.period_end,
        total_gross_amount=Decimal(str(stmt.total_gross_amount)).quantize(CENT, rounding=ROUND_HALF_UP),
        validated_gross_amount=validated_gross,
        pending_gross_amount=pending_gross,
        lines_count=len(line_schemas),
        validated_lines_count=validated_count,
        currency=stmt.currency,
        source_currency=getattr(stmt, "source_currency", "EUR") or "EUR",
        exchange_rate=getattr(stmt, "exchange_rate", Decimal("1.000000")) or Decimal("1.000000"),
        source_gross_amount=Decimal(str(getattr(stmt, "source_gross_amount", Decimal("0.000000")) or "0.000000")).quantize(CENT, rounding=ROUND_HALF_UP),
        accounting_status=getattr(stmt, "accounting_status", "DRAFT") or "DRAFT",
        campaign_id=getattr(stmt, "campaign_id", None),
        locked_at=getattr(stmt, "locked_at", None),
        paid_at=getattr(stmt, "paid_at", None),
        payment_reference=getattr(stmt, "payment_reference", None),
        payment_method=getattr(stmt, "payment_method", None),
        payment_notes=getattr(stmt, "payment_notes", None),
        integrity_hash=getattr(stmt, "integrity_hash", None),
        lines=line_schemas,
        created_at=stmt.created_at,
    )


@router.get("", response_model=list[StatementRead])
def list_statements(
    entity_id: UUID | None = Query(None, description="Filtrer par entité éditoriale"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> list[StatementRead]:
    """Retourne tous les relevés de royalties avec leurs lignes en 2 requêtes SQL groupées (zéro N+1)."""
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)

    query = select(RoyaltyStatement)
    if target_entity_id:
        if is_default_entity:
            query = query.where((RoyaltyStatement.entity_id == target_entity_id) | (RoyaltyStatement.entity_id == None))  # noqa: E711
        else:
            query = query.where(RoyaltyStatement.entity_id == target_entity_id)

    statements = list(
        session.exec(
            query.order_by(RoyaltyStatement.created_at.desc())
        ).all()
    )
    if not statements:
        return []

    stmt_ids = [s.id for s in statements]
    all_lines = list(
        session.exec(
            select(StatementLine)
            .where(col(StatementLine.statement_id).in_(stmt_ids))
            .order_by(StatementLine.row_number)
        ).all()
    )
    lines_by_stmt: dict[UUID, list[StatementLine]] = {s.id: [] for s in statements}
    for ln in all_lines:
        lines_by_stmt.setdefault(ln.statement_id, []).append(ln)

    return [_statement_to_read(stmt, lines_by_stmt.get(stmt.id, [])) for stmt in statements]


@router.get("/{statement_id}", response_model=StatementRead)
def get_statement(
    statement_id: UUID, session: Session = Depends(get_session)
) -> StatementRead:
    """Retourne un relevé spécifique et ses lignes de rapprochement."""
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    lines = session.exec(
        select(StatementLine)
        .where(StatementLine.statement_id == stmt.id)
        .order_by(StatementLine.row_number)
    ).all()
    return _statement_to_read(stmt, list(lines))


@router.get("/{statement_id}/lines", response_model=list[StatementLineMatch])
def get_statement_lines(
    statement_id: UUID,
    min_confidence: float | None = None,
    max_confidence: float | None = None,
    sort_by: str | None = None,
    session: Session = Depends(get_session),
) -> list[StatementLineMatch]:
    """Retourne les lignes d'un relevé avec filtrage par confiance et tri haute priorité (ex: sort_by=gross_amount_desc pour arbitrage Pareto)."""
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    query = select(StatementLine).where(StatementLine.statement_id == statement_id)
    if sort_by == "gross_amount_desc":
        query = query.order_by(col(StatementLine.gross_amount).desc(), StatementLine.row_number)
    elif sort_by == "gross_amount_asc":
        query = query.order_by(col(StatementLine.gross_amount).asc(), StatementLine.row_number)
    else:
        query = query.order_by(StatementLine.row_number)
    lines = session.exec(query).all()
    result = [_line_to_schema(ln) for ln in lines]
    if min_confidence is not None:
        result = [r for r in result if r.confidence_score >= min_confidence]
    if max_confidence is not None:
        result = [r for r in result if r.confidence_score <= max_confidence]
    return result


@router.post("/upload", response_model=StatementRead, status_code=status.HTTP_201_CREATED)
async def upload_statement_csv(
    source_name: str = Form(default="SACEM_2026Q3"),
    currency: str = Form(default="EUR"),
    exchange_rate: str | None = Form(default=None),
    entity_id: UUID | None = Form(None),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> StatementRead:
    """Importe un relevé CSV avec précision 6 décimales (micro-centimes DSP), index O(1), conversion multi-devises déterministe et déduplication."""
    target_entity_id, is_default = resolve_entity_filter(session, entity_id, x_entity_id)

    raw_bytes = await file.read()
    csv_text = raw_bytes.decode("utf-8", errors="ignore")
    reader = csv.DictReader(StringIO(csv_text))

    catalog_works_query = select(Work)
    if target_entity_id:
        if is_default:
            catalog_works_query = catalog_works_query.where((Work.entity_id == target_entity_id) | (Work.entity_id == None))  # noqa: E711
        else:
            catalog_works_query = catalog_works_query.where(Work.entity_id == target_entity_id)
    catalog_works = list(session.exec(catalog_works_query).all())
    now = datetime.now(timezone.utc)
    ws = get_or_create_workspace_settings(session)

    source_curr = currency.strip().upper() if currency else "EUR"
    from app.models.workspace_settings import DEFAULT_CURRENCY_RATES
    rates_map = {c["currency"].upper(): c for c in (getattr(ws, "currency_rates", None) or DEFAULT_CURRENCY_RATES)}

    if exchange_rate and exchange_rate.strip():
        rate_to_eur = Decimal(exchange_rate.strip().replace(",", ".")).quantize(Decimal("0.000001"))
    elif source_curr in rates_map:
        rate_to_eur = Decimal(str(rates_map[source_curr]["rate_to_eur"])).quantize(Decimal("0.000001"))
    else:
        rate_to_eur = Decimal("1.000000")

    stmt = RoyaltyStatement(
        entity_id=target_entity_id,
        source_name=source_name,
        filename=file.filename,
        period_start=date(2026, 7, 1),
        period_end=date(2026, 9, 30),
        total_gross_amount=Decimal("0.000000"),
        currency="EUR",
        source_currency=source_curr,
        exchange_rate=rate_to_eur,
        source_gross_amount=Decimal("0.000000"),
        accounting_status="DRAFT",
        created_at=now,
    )
    session.add(stmt)
    session.commit()
    session.refresh(stmt)

    total_gross_eur = Decimal("0.000000")
    total_source_gross = Decimal("0.000000")
    lines_to_match: list[StatementLineCreate] = []

    for idx, row in enumerate(reader, start=1):
        raw_title = (
            row.get("work_title")
            or row.get("title")
            or row.get("titre")
            or f"Ligne {idx}"
        ).strip()
        raw_iswc = (row.get("iswc") or "").strip() or None
        raw_sacem_code = (
            row.get("sacem_code")
            or row.get("cocv")
            or row.get("code_sacem")
            or row.get("code_oeuvre")
            or row.get("work_code")
            or ""
        ).strip() or None
        raw_isrc = (row.get("isrc") or "").strip() or None
        raw_performer = (row.get("performer") or row.get("artist") or "").strip() or None
        right_type_raw = (row.get("right_type") or "DEP").strip().upper()
        right_type: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
            right_type_raw if right_type_raw in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
        )
        exp_raw = (row.get("exploitation_type") or "STREAMING").strip().upper()
        try:
            exp_type = ExploitationType(exp_raw)
        except ValueError:
            exp_type = ExploitationType.STREAMING

        gross_str = (row.get("gross_amount") or row.get("amount") or "0.00").replace(",", ".").strip()
        source_line_gross = Decimal(gross_str).quantize(MICRO_CENT, rounding=ROUND_HALF_UP)
        units_val = int(row.get("units") or 0)
        territory_val = (row.get("territory") or "FR").strip()

        # Détection d'une devise sur la ligne si présente dans le CSV (ex: USD, GBP)
        row_currency = (row.get("currency") or row.get("devise") or source_curr).strip().upper()
        if row_currency != "EUR":
            row_rate = rate_to_eur if row_currency == source_curr else Decimal(str(rates_map.get(row_currency, {}).get("rate_to_eur", "1.000000")))
            converted_line_gross = (source_line_gross * row_rate).quantize(MICRO_CENT, rounding=ROUND_HALF_UP)
        else:
            row_rate = Decimal("1.000000")
            converted_line_gross = source_line_gross

        total_gross_eur += converted_line_gross
        total_source_gross += source_line_gross

        lines_to_match.append(
            StatementLineCreate(
                row_number=idx,
                raw_work_title=raw_title,
                raw_iswc=raw_iswc,
                raw_sacem_code=raw_sacem_code,
                raw_isrc=raw_isrc,
                raw_performer=raw_performer,
                right_type=right_type,
                exploitation_type=exp_type,
                territory=territory_val,
                units=units_val,
                gross_amount=converted_line_gross,
                currency="EUR",
                source_currency=row_currency,
                exchange_rate=row_rate,
                source_gross_amount=source_line_gross,
            )
        )

    # Matching en batch avec index O(1) et cache de déduplication des tuples identiques
    matched_batch = match_statement_lines_batch(lines_to_match, catalog_works)

    db_lines: list[StatementLine] = []
    for line_create, matched in zip(lines_to_match, matched_batch):
        db_line = StatementLine(
            statement_id=stmt.id,
            row_number=line_create.row_number,
            raw_work_title=line_create.raw_work_title,
            raw_iswc=line_create.raw_iswc,
            raw_sacem_code=line_create.raw_sacem_code,
            raw_isrc=line_create.raw_isrc,
            raw_performer=line_create.raw_performer,
            right_type=line_create.right_type,
            exploitation_type=line_create.exploitation_type.value,
            territory=line_create.territory,
            units=line_create.units,
            gross_amount=line_create.gross_amount,
            currency="EUR",
            source_currency=line_create.source_currency,
            exchange_rate=line_create.exchange_rate,
            source_gross_amount=line_create.source_gross_amount,
            matched_work_id=matched.matched_work_id,
            matched_work_title=matched.matched_work_title,
            match_method=matched.match_method.value,
            confidence_score=matched.confidence_score,
            validation_status=ValidationStatus.PENDING_REVIEW.value,
            top_match=matched.top_match.model_dump(mode="json") if matched.top_match else None,
            alternatives=[a.model_dump(mode="json") for a in matched.alternatives],
            allocations=[],
        )
        session.add(db_line)
        db_lines.append(db_line)

    stmt.total_gross_amount = total_gross_eur
    stmt.source_gross_amount = total_source_gross
    session.add(stmt)
    session.commit()

    return _statement_to_read(stmt, db_lines)


@router.post("/stress-test-sample", response_model=StatementRead, status_code=status.HTTP_201_CREATED)
def load_stress_test_sample(
    session: Session = Depends(get_session),
) -> StatementRead:
    """Charge en 1 clic le relevé de stress-test DSP/SACEM de 5 000 lignes avec micro-centimes."""
    from pathlib import Path
    sample_path = Path(__file__).resolve().parents[3] / "data" / "samples" / "STRESS_TEST_STREAMING_SACEM_5000_LIGNES.csv"
    if not sample_path.exists():
        from scripts.generate_stress_test_5000_csv import generate_stress_test_csv
        generate_stress_test_csv(5000)

    csv_text = sample_path.read_text(encoding="utf-8")
    reader = csv.DictReader(StringIO(csv_text))
    catalog_works = list(session.exec(select(Work)).all())
    now = datetime.now(timezone.utc)

    stmt = RoyaltyStatement(
        source_name="Stress-Test DSP Spotify & SACEM (5 000 Lignes)",
        filename="STRESS_TEST_STREAMING_SACEM_5000_LIGNES.csv",
        period_start=date(2026, 7, 1),
        period_end=date(2026, 9, 30),
        total_gross_amount=Decimal("0.000000"),
        currency="EUR",
        accounting_status="DRAFT",
        created_at=now,
    )
    session.add(stmt)
    session.commit()
    session.refresh(stmt)

    total_gross = Decimal("0.000000")
    lines_to_match: list[StatementLineCreate] = []

    for idx, row in enumerate(reader, start=1):
        raw_title = (row.get("work_title") or f"Ligne {idx}").strip()
        raw_iswc = (row.get("iswc") or "").strip() or None
        raw_sacem_code = (
            row.get("sacem_code")
            or row.get("cocv")
            or row.get("code_sacem")
            or row.get("code_oeuvre")
            or row.get("work_code")
            or ""
        ).strip() or None
        raw_isrc = (row.get("isrc") or "").strip() or None
        raw_performer = (row.get("performer") or "").strip() or None
        right_type_raw = (row.get("right_type") or "DEP").strip().upper()
        right_type: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
            right_type_raw if right_type_raw in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
        )
        exp_raw = (row.get("exploitation_type") or "STREAMING").strip().upper()
        try:
            exp_type = ExploitationType(exp_raw)
        except ValueError:
            exp_type = ExploitationType.STREAMING

        gross_str = (row.get("gross_amount") or "0.00").replace(",", ".").strip()
        gross_val = Decimal(gross_str).quantize(MICRO_CENT, rounding=ROUND_HALF_UP)
        units_val = int(row.get("units") or 0)
        territory_val = (row.get("territory") or "FR").strip()

        total_gross += gross_val
        lines_to_match.append(
            StatementLineCreate(
                row_number=idx,
                raw_work_title=raw_title,
                raw_iswc=raw_iswc,
                raw_sacem_code=raw_sacem_code,
                raw_isrc=raw_isrc,
                raw_performer=raw_performer,
                right_type=right_type,
                exploitation_type=exp_type,
                territory=territory_val,
                units=units_val,
                gross_amount=gross_val,
                currency="EUR",
            )
        )

    matched_batch = match_statement_lines_batch(lines_to_match, catalog_works)

    db_lines: list[StatementLine] = []
    for line_create, matched in zip(lines_to_match, matched_batch):
        db_line = StatementLine(
            statement_id=stmt.id,
            row_number=line_create.row_number,
            raw_work_title=line_create.raw_work_title,
            raw_iswc=line_create.raw_iswc,
            raw_sacem_code=line_create.raw_sacem_code,
            raw_isrc=line_create.raw_isrc,
            raw_performer=line_create.raw_performer,
            right_type=line_create.right_type,
            exploitation_type=line_create.exploitation_type.value,
            territory=line_create.territory,
            units=line_create.units,
            gross_amount=line_create.gross_amount,
            currency="EUR",
            matched_work_id=matched.matched_work_id,
            matched_work_title=matched.matched_work_title,
            match_method=matched.match_method.value,
            confidence_score=matched.confidence_score,
            validation_status=ValidationStatus.PENDING_REVIEW.value,
            top_match=matched.top_match.model_dump(mode="json") if matched.top_match else None,
            alternatives=[a.model_dump(mode="json") for a in matched.alternatives],
            allocations=[],
        )
        session.add(db_line)
        db_lines.append(db_line)

    stmt.total_gross_amount = total_gross
    session.add(stmt)
    session.commit()

    return _statement_to_read(stmt, db_lines)


@router.post("/lines/{line_id}/validate", response_model=StatementLineMatch)
def validate_statement_line(
    line_id: UUID,
    payload: StatementLineValidatePayload,
    session: Session = Depends(get_session),
) -> StatementLineMatch:
    """Valide ou réassigne manuellement une ligne de relevé CSV et calcule sa répartition déterministe."""
    db_line = session.get(StatementLine, line_id)
    if not db_line:
        raise HTTPException(status_code=404, detail="Ligne de relevé introuvable.")

    stmt = session.get(RoyaltyStatement, db_line.statement_id)
    if stmt and getattr(stmt, "accounting_status", "DRAFT") == "LOCKED":
        raise HTTPException(
            status_code=409,
            detail="Ce relevé est déjà clôturé et verrouillé comptablement (LOCKED). Aucune modification de ligne n'est autorisée.",
        )

    now = datetime.now(timezone.utc)
    if payload.matched_work_id is not None:
        work = session.get(Work, payload.matched_work_id)
        if not work:
            raise HTTPException(status_code=404, detail="Œuvre cible introuvable.")
        db_line.matched_work_id = work.id
        db_line.matched_work_title = work.title
        db_line.match_method = MatchMethod.MANUAL.value
    else:
        work = session.get(Work, db_line.matched_work_id) if db_line.matched_work_id else None

    db_line.validation_status = (
        ValidationStatus.VALIDATED.value
        if payload.approve
        else ValidationStatus.REJECTED.value
    )
    db_line.validated_by = payload.validated_by
    db_line.validated_at = now
    db_line.review_notes = payload.review_notes

    # Apprentissage actif d'alias (Active Alias Memory) lorsque la ligne est approuvée
    if payload.approve and work:
        existing_norms = {
            normalize_music_title(t)
            for t in [work.title, *(work.alternate_titles or [])]
            if t
        }
        raw_norm = normalize_music_title(db_line.raw_work_title)
        if raw_norm and raw_norm not in existing_norms:
            updated_alts = list(work.alternate_titles or [])
            updated_alts.append(db_line.raw_work_title.strip())
            work.alternate_titles = updated_alts
            corpus = " ".join([work.title, *updated_alts, *(work.performers or [])])
            work.embedding = compute_text_embedding(corpus)
            session.add(work)

    if payload.approve and work and work.splits:
        right_type_val: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
            db_line.right_type if db_line.right_type in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
        )
        allocs = calculate_line_allocations(
            gross_amount=Decimal(str(db_line.gross_amount)),
            splits=work.splits,
            right_type=right_type_val,
        )
        db_line.allocations = [a.model_dump(mode="json") for a in allocs]
    else:
        db_line.allocations = []

    session.add(db_line)
    session.add(
        AuditLog(
            action_type="STATEMENT_LINE_VALIDATED",
            entity_type="STATEMENT_LINE",
            entity_id=str(db_line.id),
            actor=payload.validated_by,
            summary=(
                f"Ligne #{db_line.row_number} « {db_line.raw_work_title} » -> "
                f"« {db_line.matched_work_title} » ({db_line.validation_status})"
            ),
            details={
                "raw_work_title": db_line.raw_work_title,
                "matched_work_title": db_line.matched_work_title,
                "gross_amount": str(db_line.gross_amount),
            },
            created_at=now,
        )
    )
    session.commit()
    session.refresh(db_line)
    return _line_to_schema(db_line)


@router.post(
    "/{statement_id}/lines/{line_id}/create-work-and-match",
    response_model=StatementLineMatch,
)
@router.post(
    "/lines/{line_id}/create-work-and-match",
    response_model=StatementLineMatch,
)
def create_work_and_match_statement_line(
    line_id: UUID,
    payload: StatementLineCreateWorkAndMatchPayload,
    statement_id: UUID | None = None,
    session: Session = Depends(get_session),
) -> StatementLineMatch:
    """Passerelle Black Box (US-5.2) : Crée une œuvre au catalogue en 1-clic depuis une ligne orpheline
    et l'apparie immédiatement en statut VALIDATED avec calcul déterministe de la répartition."""
    db_line = session.get(StatementLine, line_id)
    if not db_line:
        raise HTTPException(status_code=404, detail="Ligne de relevé introuvable.")

    if statement_id is not None and db_line.statement_id != statement_id:
        raise HTTPException(
            status_code=404, detail="Cette ligne n'appartient pas au relevé spécifié."
        )

    stmt = session.get(RoyaltyStatement, db_line.statement_id)
    if stmt and getattr(stmt, "accounting_status", "DRAFT") in ("LOCKED", "PAID"):
        raise HTTPException(
            status_code=409,
            detail=f"Ce relevé est déjà {getattr(stmt, 'accounting_status', 'LOCKED')} comptablement. Aucune création ni modification de ligne n'est autorisée.",
        )

    if not payload.title or not payload.title.strip():
        raise HTTPException(
            status_code=400,
            detail="Le titre de l'œuvre ne peut pas être vide.",
        )

    ws = get_or_create_workspace_settings(session)
    now = datetime.now(timezone.utc)

    # 1. Gestion des titres alternatifs : inclure le titre brut de la ligne s'il est distinct
    alts = [t.strip() for t in (payload.alternate_titles or []) if t and t.strip()]
    raw_title = db_line.raw_work_title.strip()
    if raw_title and raw_title != payload.title.strip() and raw_title not in alts:
        alts.append(raw_title)

    # 2. Gestion des ISRC
    isrcs = [c.strip() for c in (payload.isrc_codes or []) if c and c.strip()]
    if db_line.raw_isrc and db_line.raw_isrc.strip() and db_line.raw_isrc.strip() not in isrcs:
        isrcs.append(db_line.raw_isrc.strip())

    # 3. Gestion des interprètes
    perfs = [p.strip() for p in (payload.performers or []) if p and p.strip()]
    if (
        db_line.raw_performer
        and db_line.raw_performer.strip()
        and db_line.raw_performer.strip() not in perfs
    ):
        perfs.append(db_line.raw_performer.strip())

    # 4. Codes ISWC, SACEM, Cotage et Sous-titre assainis (None si vide ou espaces seuls)
    iswc_val = (payload.iswc or "").strip() or (db_line.raw_iswc or "").strip() or None
    sacem_code_val = (
        (payload.sacem_work_code or "").strip()
        or (db_line.raw_sacem_code or "").strip()
        or None
    )
    cotage_val = (payload.cotage_number or "").strip() or None
    subtitle_val = (payload.subtitle or "").strip() or None

    # 5. Calcul embedding vectoriel
    corpus = " ".join(filter(None, [payload.title.strip(), *alts, *perfs]))
    embedding = compute_text_embedding(corpus)

    serialized_splits = [s.model_dump(mode="json") for s in payload.splits]
    operator_actor = payload.validated_by or ws.default_operator_email

    work = Work(
        title=payload.title.strip(),
        subtitle=subtitle_val,
        alternate_titles=alts,
        iswc=iswc_val,
        sacem_work_code=sacem_code_val,
        cotage_number=cotage_val,
        isrc_codes=isrcs,
        performers=perfs,
        genre=payload.genre,
        duration_seconds=payload.duration_seconds,
        creation_year=payload.creation_year,
        administration_status=payload.administration_status,
        contract_reference=payload.contract_reference,
        general_notes=(
            payload.general_notes
            or f"Créé via la Passerelle Black Box depuis le relevé '{stmt.source_name if stmt else 'N/A'}' (Ligne #{db_line.row_number})"
        ),
        timeline_notes=[
            {
                "id": str(uuid4()),
                "author": operator_actor,
                "text": f"Création d'œuvre 1-clic depuis la ligne orpheline #{db_line.row_number} (« {db_line.raw_work_title} »)",
                "created_at": now.isoformat(),
            }
        ],
        splits=serialized_splits,
        embedding=embedding,
        created_at=now,
        updated_at=now,
    )
    session.add(work)
    session.flush()

    # 6. Appariement et validation immédiate de la ligne orpheline
    db_line.matched_work_id = work.id
    db_line.matched_work_title = work.title
    db_line.match_method = MatchMethod.MANUAL.value
    db_line.confidence_score = 1.0
    db_line.validation_status = ValidationStatus.VALIDATED.value
    db_line.validated_by = operator_actor
    db_line.validated_at = now
    db_line.review_notes = (
        payload.review_notes
        or f"Création d'œuvre 1-clic depuis la ligne orpheline #{db_line.row_number} (Black Box)"
    )

    # 7. Calcul déterministe immédiat des royalties de la ligne
    right_type_val: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
        db_line.right_type if db_line.right_type in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
    )
    if work.splits:
        allocs = calculate_line_allocations(
            gross_amount=Decimal(str(db_line.gross_amount)),
            splits=work.splits,
            right_type=right_type_val,
        )
        db_line.allocations = [a.model_dump(mode="json") for a in allocs]
    else:
        db_line.allocations = []

    session.add(db_line)

    # 8. Journalisation d'audit
    session.add(
        AuditLog(
            action_type="WORK_CREATED",
            entity_type="WORK",
            entity_id=str(work.id),
            actor=operator_actor,
            summary=f"Passerelle Black Box : Œuvre « {work.title} » créée depuis la ligne #{db_line.row_number}.",
            details={
                "iswc": work.iswc,
                "line_id": str(db_line.id),
                "gross_amount": str(db_line.gross_amount),
            },
            created_at=now,
        )
    )
    session.add(
        AuditLog(
            action_type="STATEMENT_LINE_VALIDATED",
            entity_type="STATEMENT_LINE",
            entity_id=str(db_line.id),
            actor=operator_actor,
            summary=f"Ligne #{db_line.row_number} « {db_line.raw_work_title} » créée et validée sur « {work.title} ».",
            details={"work_id": str(work.id), "gross_amount": str(db_line.gross_amount)},
            created_at=now,
        )
    )

    session.commit()
    session.refresh(db_line)
    return _line_to_schema(db_line)


@router.post("/{statement_id}/validate-high-confidence", response_model=StatementRead)
def validate_high_confidence_lines(
    statement_id: UUID,
    threshold: float = 0.90,
    session: Session = Depends(get_session),
) -> StatementRead:
    """Valide en lot toutes les lignes en attente ayant un score de confiance >= threshold (sans N+1 SQL)."""
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    if getattr(stmt, "accounting_status", "DRAFT") == "LOCKED":
        raise HTTPException(
            status_code=409,
            detail="Ce relevé est déjà clôturé et verrouillé comptablement (LOCKED).",
        )

    lines = list(
        session.exec(
            select(StatementLine)
            .where(StatementLine.statement_id == statement_id)
            .order_by(StatementLine.row_number)
        ).all()
    )
    work_ids = list({ln.matched_work_id for ln in lines if ln.matched_work_id is not None})
    works_by_id: dict[UUID, Work] = {}
    if work_ids:
        for w in session.exec(select(Work).where(col(Work.id).in_(work_ids))).all():
            works_by_id[w.id] = w

    now = datetime.now(timezone.utc)
    for ln in lines:
        if (
            ln.validation_status == ValidationStatus.PENDING_REVIEW.value
            and ln.confidence_score >= threshold
            and ln.matched_work_id
        ):
            work = works_by_id.get(ln.matched_work_id)
            ln.validation_status = ValidationStatus.VALIDATED.value
            ln.validated_by = "royalty.manager@solstices-music.fr (Lot >= 90%)"
            ln.validated_at = now
            if work and work.splits:
                right_type_val: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
                    ln.right_type if ln.right_type in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
                )
                allocs = calculate_line_allocations(
                    gross_amount=Decimal(str(ln.gross_amount)),
                    splits=work.splits,
                    right_type=right_type_val,
                )
                ln.allocations = [a.model_dump(mode="json") for a in allocs]
            session.add(ln)

    session.commit()
    return _statement_to_read(stmt, lines)


def _execute_royalty_calculation(
    stmt: RoyaltyStatement,
    session: Session,
    lock_and_persist: bool = False,
) -> RoyaltyRunReport:
    """Moteur financier central :
    - Si le relevé est déjà LOCKED, restitue les écritures immuables du Grand Livre (`RoyaltyLedgerEntry`).
    - Sinon, cumule les allocations en haute précision 6 décimales (`MICRO_CENT`), applique la Méthode du Plus Fort Reste
      en fin de période, résout chaque ayant droit par clé canonique (`right_holder_id` -> `ipi_number` -> `nom normalisé`),
      et, si `lock_and_persist=True`, verrouille le relevé et met à jour les soldes d'avances (`AdvanceLedger` & `Contract`).
    """
    lines = list(
        session.exec(
            select(StatementLine)
            .where(StatementLine.statement_id == stmt.id)
            .order_by(StatementLine.row_number)
        ).all()
    )

    total_validated_exact = Decimal("0.000000")
    total_pending_exact = Decimal("0.000000")
    validated_count = 0
    pending_count = 0

    for ln in lines:
        line_gross_6d = Decimal(str(ln.gross_amount)).quantize(MICRO_CENT, rounding=ROUND_HALF_UP)
        if ln.validation_status == ValidationStatus.VALIDATED.value:
            total_validated_exact += line_gross_6d
            validated_count += 1
        elif ln.validation_status == ValidationStatus.PENDING_REVIEW.value:
            total_pending_exact += line_gross_6d
            pending_count += 1

    total_validated_gross = total_validated_exact.quantize(CENT, rounding=ROUND_HALF_UP)
    total_pending_gross = total_pending_exact.quantize(CENT, rounding=ROUND_HALF_UP)
    total_stmt_gross = Decimal(str(stmt.total_gross_amount)).quantize(CENT, rounding=ROUND_HALF_UP)

    ws = get_or_create_workspace_settings(session)
    min_threshold = getattr(ws, "min_payment_threshold", Decimal("50.00"))
    messages = getattr(ws, "statement_messages", None)

    # Lookup des Projets Audiovisuels / Groupes d'œuvres (WorkGroup)
    all_work_groups = {g.id: g for g in session.exec(select(WorkGroup)).all()}
    all_group_links = session.exec(select(WorkGroupLink)).all()
    work_to_group: dict[UUID, WorkGroup] = {}
    for gl in all_group_links:
        g = all_work_groups.get(gl.work_group_id)
        if g:
            work_to_group[gl.work_id] = g

    current_status = getattr(stmt, "accounting_status", "DRAFT") or "DRAFT"
    if current_status in ("LOCKED", "PAID"):
        existing_entries = list(
            session.exec(
                select(RoyaltyLedgerEntry)
                .where(RoyaltyLedgerEntry.statement_id == stmt.id)
                .order_by(RoyaltyLedgerEntry.holder_name)
            ).all()
        )
        if existing_entries:
            # Reconstitution des détails par œuvre et annuaire pour les relevés verrouillés
            directory_holders = list(session.exec(select(RightHolderDirectory)).all())
            dir_by_id: dict[UUID, RightHolderDirectory] = {d.id: d for d in directory_holders}
            dir_by_norm: dict[str, RightHolderDirectory] = {
                normalize_holder_identity_name(d.full_name): d for d in directory_holders
            }
            dir_by_ipi_num: dict[str, RightHolderDirectory] = {
                normalize_ipi_code(d.ipi_number): d
                for d in directory_holders
                if normalize_ipi_code(d.ipi_number)
            }

            # Reconstitution des breakdowns depuis les lignes validées
            works_by_holder_norm: dict[str, list[HolderWorkBreakdown]] = {}
            for ln in lines:
                if ln.validation_status != ValidationStatus.VALIDATED.value or not ln.allocations:
                    continue
                w_grp = work_to_group.get(ln.matched_work_id) if ln.matched_work_id else None
                for al in ln.allocations:
                    h_norm = normalize_holder_identity_name(str(al.get("holder_name", "")))
                    if not h_norm:
                        continue
                    works_by_holder_norm.setdefault(h_norm, []).append(
                        HolderWorkBreakdown(
                            work_id=ln.matched_work_id,
                            work_title=ln.matched_work_title or ln.raw_work_title,
                            iswc=ln.raw_iswc,
                            right_type=ln.right_type,
                            exploitation_type=ln.exploitation_type or "STREAMING",
                            gross_line_amount=Decimal(str(ln.gross_amount)).quantize(CENT),
                            share_percentage=Decimal(str(al.get("share_percentage", "0.00"))).quantize(CENT),
                            allocated_amount=Decimal(str(al.get("allocated_amount", "0.00"))).quantize(CENT),
                            territory=getattr(ln, "territory", "FR") or "FR",
                            work_group_id=w_grp.id if w_grp else None,
                            work_group_title=w_grp.name if w_grp else "Catalogue Général / Hors Projet",
                            source_currency=getattr(ln, "source_currency", "EUR") or getattr(stmt, "source_currency", "EUR") or "EUR",
                            source_gross_amount=getattr(ln, "source_gross_amount", None),
                            exchange_rate=getattr(ln, "exchange_rate", Decimal("1.000000")) or getattr(stmt, "exchange_rate", Decimal("1.000000")),
                        )
                    )

            holder_statements = []
            for e in existing_entries:
                e_norm = normalize_holder_identity_name(e.holder_name)
                norm_ipi = normalize_ipi_code(e.ipi_number)
                dh = (
                    (dir_by_id.get(e.right_holder_id) if e.right_holder_id else None)
                    or (dir_by_ipi_num.get(norm_ipi) if norm_ipi else None)
                    or dir_by_norm.get(e_norm)
                )
                gross_amt = Decimal(str(e.gross_royalties_allocated)).quantize(CENT)
                recouped_amt = Decimal(str(e.recouped_in_period)).quantize(CENT)
                taxable_ht = max(Decimal("0.00"), gross_amt - recouped_amt)
                precompte_val = Decimal(str(e.precompte_ircec_amount or "0.00")).quantize(CENT)
                w_list = works_by_holder_norm.get(e_norm, [])

                carried_init = Decimal(str(getattr(e, "carried_forward_initial", "0.00"))).quantize(CENT)
                retained_res = Decimal(str(getattr(e, "retained_in_reserve", "0.00"))).quantize(CENT)
                p_status = getattr(e, "payout_status", "PAYABLE")
                p_dest_id = getattr(e, "payout_recipient_id", None) or (getattr(dh, "payout_recipient_id", None) if dh else None)
                p_dest_name = getattr(e, "payout_recipient_name", None) or (getattr(dh, "payout_recipient_name", None) if dh else None)
                p_redir = bool(p_dest_name or p_dest_id)
                p_succ = bool(getattr(e, "is_succession_payout", False) or (dh and getattr(dh, "succession_active", False)))
                h_dist = list(getattr(e, "heirs_payout_details", []) or [])
                if not h_dist and dh and getattr(dh, "heirs", None):
                    net_to_split = Decimal(str(e.net_payable_amount)).quantize(CENT)
                    gross_to_split = gross_amt
                    for heir in dh.heirs:
                        h_pct = Decimal(str(heir.get("share_pct", "0.00")))
                        h_dist.append({
                            "heir_name": heir.get("heir_name"),
                            "relationship": heir.get("relationship", "Héritier"),
                            "share_pct": str(h_pct),
                            "allocated_gross": str((gross_to_split * h_pct / Decimal("100.00")).quantize(CENT)),
                            "net_payable": str((net_to_split * h_pct / Decimal("100.00")).quantize(CENT)),
                            "iban": heir.get("iban"),
                            "bic": heir.get("bic"),
                        })

                leg_mention = None
                if p_succ and h_dist:
                    leg_mention = f"Succession active ({len(h_dist)} héritiers) : ventilation indivise selon quotes-parts notariales."
                elif p_redir:
                    leg_mention = f"Paiement mandaté et redirigé vers le tiers désigné : {p_dest_name}."

                holder_statements.append(
                    AdvanceRecoupmentState(
                        right_holder_id=e.right_holder_id or (dh.id if dh else None),
                        holder_name=e.holder_name,
                        role=e.role,
                        ipi_number=e.ipi_number or (dh.ipi_number if dh else None),
                        contract_id=e.contract_id,
                        contract_reference=e.contract_reference,
                        entity_type=dh.entity_type if dh else "PERSONNE_PHYSIQUE",
                        legal_form=dh.legal_form if dh else None,
                        siret=dh.siret if dh else None,
                        vat_number=dh.vat_number if dh else None,
                        vat_applicable=dh.vat_applicable if dh else False,
                        vat_rate_pct=dh.vat_rate_pct if dh else Decimal("0.00"),
                        vat_amount=Decimal("0.00"),
                        ircec_precompte_applicable=dh.ircec_precompte_applicable if dh else True,
                        urssaf_dispense_certificate=dh.urssaf_dispense_certificate if dh else False,
                        iban=dh.iban if dh else None,
                        bic=dh.bic if dh else None,
                        is_deceased=getattr(dh, "is_deceased", False) if dh else False,
                        payout_recipient_id=p_dest_id,
                        payout_recipient_name=p_dest_name,
                        payout_redirected=p_redir,
                        succession_active=p_succ,
                        heirs_distribution=h_dist,
                        gross_royalties_allocated=gross_amt,
                        initial_advance=Decimal(str(e.initial_advance_snapshot)).quantize(CENT),
                        previously_recouped=Decimal(str(e.previously_recouped_snapshot)).quantize(CENT),
                        recouped_in_period=recouped_amt,
                        remaining_unrecouped_balance=Decimal(str(e.remaining_unrecouped_balance)).quantize(CENT),
                        taxable_base_ht=taxable_ht,
                        precompte_ircec_amount=precompte_val,
                        precompte_social_amount=precompte_val,
                        previous_reserve_balance=carried_init,
                        min_payment_threshold=min_threshold,
                        is_below_payment_threshold=(p_status == "BELOW_THRESHOLD"),
                        retained_in_reserve=retained_res,
                        carried_forward_to_next=retained_res if p_status == "BELOW_THRESHOLD" else Decimal(str(e.remaining_unrecouped_balance)).quantize(CENT),
                        payout_status=p_status,
                        legal_mention_applied=leg_mention,
                        net_payable_amount=Decimal(str(e.net_payable_amount)).quantize(CENT),
                        source_currency=getattr(e, "source_currency", "EUR") or getattr(stmt, "source_currency", "EUR") or "EUR",
                        source_gross_royalties_allocated=getattr(e, "source_gross_allocated", None),
                        exchange_rate=getattr(e, "exchange_rate", Decimal("1.000000")) or getattr(stmt, "exchange_rate", Decimal("1.000000")),
                        e_invoicing_status="FACTUR-X / E-REPORTING 2026 READY (LOCKED)",
                        works_count=len(w_list),
                        works_breakdown=w_list,
                    )
                )

            checksum = sum((h.gross_royalties_allocated for h in holder_statements), Decimal("0.00"))
            tot_rec = sum((h.recouped_in_period for h in holder_statements), Decimal("0.00"))
            tot_net = sum((h.net_payable_amount for h in holder_statements), Decimal("0.00"))
            tot_retained = sum((h.retained_in_reserve for h in holder_statements), Decimal("0.00"))
            below_cnt = sum(1 for h in holder_statements if h.payout_status == "BELOW_THRESHOLD")
            return RoyaltyRunReport(
                statement_id=stmt.id,
                source_name=stmt.source_name,
                accounting_status=current_status,
                is_locked=True,
                locked_at=stmt.locked_at.isoformat() if stmt.locked_at else None,
                paid_at=stmt.paid_at.isoformat() if getattr(stmt, "paid_at", None) else None,
                payment_reference=getattr(stmt, "payment_reference", None),
                payment_method=getattr(stmt, "payment_method", None),
                payment_notes=getattr(stmt, "payment_notes", None),
                integrity_hash=getattr(stmt, "integrity_hash", None),
                total_statement_gross=total_stmt_gross,
                total_validated_gross=total_validated_gross,
                total_pending_review_gross=total_pending_gross,
                total_allocated_checksum=checksum,
                total_recouped_in_period=tot_rec,
                total_net_payable=tot_net,
                total_retained_in_reserve=tot_retained,
                below_threshold_count=below_cnt,
                validated_lines_processed=validated_count,
                pending_lines_skipped=pending_count,
                holder_statements=holder_statements,
            )

    # Chargement groupé des œuvres associées en 1 seule requête SQL (zéro N+1)
    work_ids = list({ln.matched_work_id for ln in lines if ln.matched_work_id is not None})
    works_by_id: dict[UUID, Work] = {}
    if work_ids:
        for w in session.exec(select(Work).where(col(Work.id).in_(work_ids))).all():
            works_by_id[w.id] = w

    # Chargement de l'annuaire RightHolderDirectory pour résolution canonique right_holder_id / IPI / nom
    directory_holders = list(session.exec(select(RightHolderDirectory)).all())
    dir_by_id: dict[UUID, RightHolderDirectory] = {d.id: d for d in directory_holders}
    dir_by_ipi: dict[str, RightHolderDirectory] = {}
    dir_by_norm_name: dict[str, RightHolderDirectory] = {}
    for dh in directory_holders:
        norm_ipi = normalize_ipi_code(dh.ipi_number)
        if norm_ipi:
            dir_by_ipi[norm_ipi] = dh
        norm_name = normalize_holder_identity_name(dh.full_name)
        if norm_name:
            dir_by_norm_name[norm_name] = dh

    # Cumul haute précision (6 décimales) par clé canonique d'ayant droit & détail par œuvre
    holder_meta: dict[str, dict[str, Any]] = {}
    exact_holder_totals: dict[str, Decimal] = {}
    holder_works_map: dict[str, list[HolderWorkBreakdown]] = {}

    for ln in lines:
        if ln.validation_status != ValidationStatus.VALIDATED.value:
            continue
        work = works_by_id.get(ln.matched_work_id) if ln.matched_work_id else None
        if not work or not work.splits:
            continue

        line_gross_6d = Decimal(str(ln.gross_amount)).quantize(MICRO_CENT, rounding=ROUND_HALF_UP)
        right_type_val: Literal["DEP", "DRM", "SYNC", "PHONO"] = (
            ln.right_type if ln.right_type in ("DEP", "DRM", "SYNC", "PHONO") else "DEP"  # type: ignore[assignment]
        )
        allocs = calculate_line_allocations(
            gross_amount=line_gross_6d,
            splits=work.splits,
            right_type=right_type_val,
        )
        ln.allocations = [a.model_dump(mode="json") for a in allocs]
        session.add(ln)

        for alloc in allocs:
            # Résolution vers l'annuaire si disponible
            norm_ipi = normalize_ipi_code(alloc.ipi_number)
            norm_name = normalize_holder_identity_name(alloc.holder_name)
            matched_dh = (
                (dir_by_ipi.get(norm_ipi) if norm_ipi else None)
                or dir_by_norm_name.get(norm_name)
            )
            resolved_rh_id = alloc.right_holder_id or (matched_dh.id if matched_dh else None)
            resolved_ipi = alloc.ipi_number or (matched_dh.ipi_number if matched_dh else None)

            canonical_key = resolve_canonical_holder_key(
                holder_name=alloc.holder_name,
                ipi_number=resolved_ipi,
                right_holder_id=resolved_rh_id,
            )
            exact_amt = (
                alloc.exact_allocated_amount
                if alloc.exact_allocated_amount is not None
                else alloc.allocated_amount
            )
            exact_holder_totals[canonical_key] = (
                exact_holder_totals.get(canonical_key, Decimal("0.000000")) + exact_amt
            )

            # Enregistrement du détail œuvre par œuvre pour cet ayant droit
            w_grp = work_to_group.get(work.id) if work else None
            breakdown_entry = HolderWorkBreakdown(
                work_id=work.id,
                work_title=work.title,
                iswc=work.iswc,
                right_type=right_type_val,
                exploitation_type=ln.exploitation_type or "STREAMING",
                gross_line_amount=Decimal(str(ln.gross_amount)).quantize(CENT, rounding=ROUND_HALF_UP),
                share_percentage=Decimal(str(alloc.share_percentage)).quantize(CENT, rounding=ROUND_HALF_UP),
                allocated_amount=exact_amt.quantize(CENT, rounding=ROUND_HALF_UP),
                territory=getattr(ln, "territory", "FR") or "FR",
                work_group_id=w_grp.id if w_grp else None,
                work_group_title=w_grp.name if w_grp else "Catalogue Général / Hors Projet",
                source_currency=getattr(ln, "source_currency", "EUR") or getattr(stmt, "source_currency", "EUR") or "EUR",
                source_gross_amount=getattr(ln, "source_gross_amount", None),
                exchange_rate=getattr(ln, "exchange_rate", Decimal("1.000000")) or getattr(stmt, "exchange_rate", Decimal("1.000000")),
            )
            holder_works_map.setdefault(canonical_key, []).append(breakdown_entry)

            if canonical_key not in holder_meta:
                holder_meta[canonical_key] = {
                    "holder_name": alloc.holder_name,
                    "role": alloc.role,
                    "ipi_number": resolved_ipi,
                    "right_holder_id": resolved_rh_id,
                    "dh": matched_dh,
                }

    # Arrondi final de fin de période à 0.01 € par la Méthode du Plus Fort Reste (Largest Remainder Method)
    rounded_period_totals = finalize_period_holder_totals(
        exact_holder_totals=exact_holder_totals,
        target_validated_gross=total_validated_exact,
    )

    # Indexation canonique des comptes d'avances (AdvanceLedger) et contrats validés (Contract)
    ledgers = list(session.exec(select(AdvanceLedger)).all())
    ledger_by_key: dict[str, AdvanceLedger] = {}
    for lg in ledgers:
        for k in (
            resolve_canonical_holder_key(lg.holder_name, lg.ipi_number, lg.right_holder_id),
            f"ipi:{normalize_ipi_code(lg.ipi_number)}" if normalize_ipi_code(lg.ipi_number) else "",
            f"name:{normalize_holder_identity_name(lg.holder_name)}",
        ):
            if k:
                ledger_by_key[k] = lg

    contracts = list(
        session.exec(
            select(Contract).where(
                Contract.validation_status == ValidationStatus.VALIDATED.value
            )
        ).all()
    )
    contract_by_key: dict[str, Contract] = {}
    for c in contracts:
        # Extraction éventuelle de l'IPI de la contrepartie dans c.parties
        counterparty_ipi = None
        for p in c.parties or []:
            if isinstance(p, dict) and normalize_holder_identity_name(str(p.get("party_name", ""))) == normalize_holder_identity_name(c.counterparty_name):
                counterparty_ipi = p.get("ipi_number")
                break
        for k in (
            resolve_canonical_holder_key(c.counterparty_name, counterparty_ipi, c.right_holder_id),
            f"ipi:{normalize_ipi_code(counterparty_ipi)}" if normalize_ipi_code(counterparty_ipi) else "",
            f"name:{normalize_holder_identity_name(c.counterparty_name)}",
        ):
            if k:
                contract_by_key[k] = c

    holder_statements: list[AdvanceRecoupmentState] = []
    total_allocated_checksum = Decimal("0.00")
    total_recouped = Decimal("0.00")
    total_net_payable = Decimal("0.00")
    now = datetime.now(timezone.utc)

    sorted_keys = sorted(
        rounded_period_totals.keys(),
        key=lambda k: str(holder_meta[k]["holder_name"]),
    )

    for canonical_key in sorted_keys:
        meta = holder_meta[canonical_key]
        holder_name = str(meta["holder_name"])
        ipi_num = meta["ipi_number"]
        rh_id = meta["right_holder_id"]
        gross_holder = rounded_period_totals[canonical_key].quantize(CENT, rounding=ROUND_HALF_UP)
        total_allocated_checksum += gross_holder

        lookup_keys = [
            canonical_key,
            f"ipi:{normalize_ipi_code(ipi_num)}" if normalize_ipi_code(ipi_num) else "",
            f"name:{normalize_holder_identity_name(holder_name)}",
        ]
        ledger = next((ledger_by_key[lk] for lk in lookup_keys if lk and lk in ledger_by_key), None)
        contract = next((contract_by_key[lk] for lk in lookup_keys if lk and lk in contract_by_key), None)

        init_adv = Decimal("0.00")
        prev_rec = Decimal("0.00")
        c_id = None
        c_ref = None

        if ledger:
            init_adv = Decimal(str(ledger.initial_advance))
            prev_rec = Decimal(str(ledger.recouped_amount))
            c_id = ledger.contract_id
            c_ref = ledger.contract_reference
        elif contract:
            init_adv = Decimal(str(contract.advance_amount))
            prev_rec = Decimal(str(contract.recouped_amount))
            c_id = contract.id
            c_ref = contract.contract_reference

        dh = meta.get("dh")
        work_breakdown_list = holder_works_map.get(canonical_key, [])

        rec_state = apply_advance_recoupment(
            holder_name=holder_name,
            gross_royalties_allocated=gross_holder,
            initial_advance=init_adv,
            previously_recouped=prev_rec,
            previous_reserve_balance=getattr(dh, "retained_reserve_balance", Decimal("0.00")) if dh else Decimal("0.00"),
            min_payment_threshold=min_threshold,
            statement_messages=messages,
            role=str(meta["role"]) if meta["role"] else None,
            ipi_number=str(ipi_num) if ipi_num else None,
            contract_id=c_id,
            contract_reference=c_ref,
            right_holder_id=rh_id,
            entity_type=dh.entity_type if dh else "PERSONNE_PHYSIQUE",
            legal_form=dh.legal_form if dh else None,
            siret=dh.siret if dh else None,
            vat_number=dh.vat_number if dh else None,
            vat_applicable=dh.vat_applicable if dh else False,
            vat_rate_pct=dh.vat_rate_pct if dh else Decimal("0.00"),
            ircec_precompte_applicable=dh.ircec_precompte_applicable if dh else True,
            urssaf_dispense_certificate=dh.urssaf_dispense_certificate if dh else False,
            iban=dh.iban if dh else None,
            bic=dh.bic if dh else None,
            works_count=len(work_breakdown_list),
            works_breakdown=work_breakdown_list,
        )

        # Multi-devises
        src_curr = getattr(stmt, "source_currency", "EUR") or "EUR"
        ex_rate = getattr(stmt, "exchange_rate", Decimal("1.000000")) or Decimal("1.000000")
        rec_state.source_currency = src_curr
        rec_state.exchange_rate = ex_rate
        if src_curr != "EUR" and ex_rate > Decimal("0.000000"):
            rec_state.source_gross_royalties_allocated = (gross_holder / ex_rate).quantize(CENT, rounding=ROUND_HALF_UP)

        # Enrichissement Successions d'Auteurs & Redirection de paiement (Tiers Mandataires)
        heirs_payout_details: list[dict[str, Any]] = []
        is_succ_active = False
        payout_dest_id = None
        payout_dest_name = None

        if dh:
            rec_state.is_deceased = getattr(dh, "is_deceased", False)
            if getattr(dh, "payout_recipient_name", None) or getattr(dh, "payout_recipient_id", None):
                payout_dest_id = getattr(dh, "payout_recipient_id", None)
                payout_dest_name = getattr(dh, "payout_recipient_name", None)
                rec_state.payout_redirected = True
                rec_state.payout_recipient_id = payout_dest_id
                rec_state.payout_recipient_name = payout_dest_name
                # Si le tiers est un autre ayant droit de l'annuaire, on peut utiliser son IBAN/BIC
                if payout_dest_id and payout_dest_id in dir_by_id:
                    third_party = dir_by_id[payout_dest_id]
                    if third_party.iban:
                        rec_state.iban = third_party.iban
                    if third_party.bic:
                        rec_state.bic = third_party.bic

            if getattr(dh, "succession_active", False) and getattr(dh, "heirs", None):
                is_succ_active = True
                rec_state.succession_active = True
                net_to_split = rec_state.net_payable_amount
                gross_to_split = rec_state.gross_royalties_allocated
                for heir in dh.heirs:
                    h_pct = Decimal(str(heir.get("share_pct", "0.00")))
                    h_gross = (gross_to_split * h_pct / Decimal("100.00")).quantize(CENT, rounding=ROUND_HALF_UP)
                    h_net = (net_to_split * h_pct / Decimal("100.00")).quantize(CENT, rounding=ROUND_HALF_UP)
                    heirs_payout_details.append({
                        "heir_name": heir.get("heir_name"),
                        "relationship": heir.get("relationship", "Héritier"),
                        "share_pct": str(h_pct),
                        "allocated_gross": str(h_gross),
                        "net_payable": str(h_net),
                        "iban": heir.get("iban"),
                        "bic": heir.get("bic"),
                    })
                rec_state.heirs_distribution = heirs_payout_details

            # Mentions légales spécifiques
            if is_succ_active and heirs_payout_details:
                rec_state.legal_mention_applied = (
                    f"Succession active ({len(heirs_payout_details)} héritiers) : ventilation indivise selon quotes-parts notariales."
                )
            elif payout_dest_name:
                rec_state.legal_mention_applied = (
                    f"Paiement mandaté et redirigé vers le tiers désigné : {payout_dest_name}."
                )

        if lock_and_persist:
            rec_state.e_invoicing_status = "FACTUR-X / E-REPORTING 2026 READY (LOCKED)"
            # Persistance atomique du nouveau solde d'avance amortie
            new_recouped_total = (rec_state.previously_recouped + rec_state.recouped_in_period).quantize(CENT)
            if ledger:
                ledger.recouped_amount = new_recouped_total
                if rh_id and not ledger.right_holder_id:
                    ledger.right_holder_id = rh_id
                ledger.updated_at = now
                session.add(ledger)
            elif contract and rec_state.initial_advance > Decimal("0.00"):
                new_ledger = AdvanceLedger(
                    contract_id=contract.id,
                    contract_reference=contract.contract_reference,
                    right_holder_id=rh_id,
                    holder_name=holder_name,
                    ipi_number=str(ipi_num) if ipi_num else None,
                    initial_advance=rec_state.initial_advance,
                    recouped_amount=new_recouped_total,
                    updated_at=now,
                )
                session.add(new_ledger)

            if contract:
                contract.recouped_amount = new_recouped_total
                if rh_id and not contract.right_holder_id:
                    contract.right_holder_id = rh_id
                contract.updated_at = now
                session.add(contract)

            # Mise à jour du solde de réserve conservé dans l'annuaire (Report à nouveau)
            if dh:
                if rec_state.payout_status == "BELOW_THRESHOLD":
                    dh.retained_reserve_balance = rec_state.retained_in_reserve
                    dh.updated_at = now
                    session.add(dh)
                elif rec_state.payout_status == "PAYABLE":
                    dh.retained_reserve_balance = Decimal("0.00")
                    dh.updated_at = now
                    session.add(dh)

            # Écriture immuable au Grand Livre (RoyaltyLedgerEntry)
            session.add(
                RoyaltyLedgerEntry(
                    statement_id=stmt.id,
                    contract_id=c_id,
                    contract_reference=c_ref,
                    right_holder_id=rh_id,
                    holder_name=holder_name,
                    role=rec_state.role,
                    ipi_number=rec_state.ipi_number,
                    gross_royalties_allocated=rec_state.gross_royalties_allocated,
                    source_currency=src_curr,
                    exchange_rate=ex_rate,
                    source_gross_allocated=rec_state.source_gross_royalties_allocated,
                    initial_advance_snapshot=rec_state.initial_advance,
                    previously_recouped_snapshot=rec_state.previously_recouped,
                    recouped_in_period=rec_state.recouped_in_period,
                    remaining_unrecouped_balance=rec_state.remaining_unrecouped_balance,
                    precompte_ircec_amount=rec_state.precompte_ircec_amount,
                    carried_forward_initial=rec_state.previous_reserve_balance,
                    retained_in_reserve=rec_state.retained_in_reserve,
                    payout_status=rec_state.payout_status,
                    payout_recipient_id=payout_dest_id,
                    payout_recipient_name=payout_dest_name,
                    is_succession_payout=is_succ_active,
                    heirs_payout_details=heirs_payout_details,
                    net_payable_amount=rec_state.net_payable_amount,
                    created_at=now,
                )
            )

        holder_statements.append(rec_state)
        total_recouped += rec_state.recouped_in_period
        total_net_payable += rec_state.net_payable_amount

    if lock_and_persist:
        seal_raw = (
            f"KOROM-SEAL|STMT:{stmt.id}|PERIOD:{stmt.period_start}:{stmt.period_end}|"
            f"GROSS:{total_validated_gross}|CHECKSUM:{total_allocated_checksum}|"
            f"NET:{total_net_payable}|DATE:{now.isoformat()}"
        )
        computed_seal = hashlib.sha256(seal_raw.encode("utf-8")).hexdigest()
        stmt.accounting_status = "LOCKED"
        stmt.locked_at = now
        stmt.integrity_hash = computed_seal
        session.add(stmt)
        session.add(
            AuditLog(
                action_type="STATEMENT_ROYALTIES_LOCKED",
                entity_type="ROYALTY_STATEMENT",
                entity_id=str(stmt.id),
                actor="daf@solstices-music.fr",
                summary=(
                    f"Clôture comptable immuable du relevé « {stmt.source_name} » : "
                    f"{total_validated_gross} € répartis, {total_recouped} € d'avances amorties, {total_net_payable} € net à payer (Sceau SHA-256 : {computed_seal[:12]}...)."
                ),
                details={
                    "statement_id": str(stmt.id),
                    "total_validated_gross": str(total_validated_gross),
                    "total_allocated_checksum": str(total_allocated_checksum),
                    "total_recouped_in_period": str(total_recouped),
                    "total_net_payable": str(total_net_payable),
                    "integrity_hash": computed_seal,
                },
                created_at=now,
            )
        )

    session.commit()

    final_status = "LOCKED" if lock_and_persist else current_status
    tot_retained = sum((h.retained_in_reserve for h in holder_statements), Decimal("0.00"))
    below_cnt = sum(1 for h in holder_statements if h.payout_status == "BELOW_THRESHOLD")
    return RoyaltyRunReport(
        statement_id=stmt.id,
        source_name=stmt.source_name,
        accounting_status=final_status,
        is_locked=(final_status in ("LOCKED", "PAID")),
        locked_at=stmt.locked_at.isoformat() if getattr(stmt, "locked_at", None) else None,
        paid_at=stmt.paid_at.isoformat() if getattr(stmt, "paid_at", None) else None,
        payment_reference=getattr(stmt, "payment_reference", None),
        payment_method=getattr(stmt, "payment_method", None),
        payment_notes=getattr(stmt, "payment_notes", None),
        integrity_hash=getattr(stmt, "integrity_hash", None),
        total_statement_gross=total_stmt_gross,
        total_validated_gross=total_validated_gross,
        total_pending_review_gross=total_pending_gross,
        total_allocated_checksum=total_allocated_checksum,
        total_recouped_in_period=total_recouped,
        total_net_payable=total_net_payable,
        total_retained_in_reserve=tot_retained,
        below_threshold_count=below_cnt,
        validated_lines_processed=validated_count,
        pending_lines_skipped=pending_count,
        holder_statements=holder_statements,
    )


@router.post("/{statement_id}/compute-royalties", response_model=RoyaltyRunReport)
def compute_statement_royalties(
    statement_id: UUID,
    session: Session = Depends(get_session),
) -> RoyaltyRunReport:
    """Exécute une simulation idempotente (DRAFT) ou restitue le décompte figé (LOCKED/PAID) sur les lignes VALIDATED."""
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    return _execute_royalty_calculation(stmt=stmt, session=session, lock_and_persist=False)


@router.post("/{statement_id}/lock-and-post", response_model=RoyaltyRunReport)
def lock_and_post_statement_royalties(
    statement_id: UUID,
    payload: StatementLockPayload | None = None,
    session: Session = Depends(get_session),
) -> RoyaltyRunReport:
    """Clôture comptablement le relevé (statut LOCKED), génère un certificat d'intégrité (hash SHA-256),
    impute l'amortissement des avances sur AdvanceLedger et enregistre les écritures immuables au Grand Livre.
    Opération idempotente.
    """
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    if getattr(stmt, "accounting_status", "DRAFT") in ("LOCKED", "PAID"):
        return _execute_royalty_calculation(stmt=stmt, session=session, lock_and_persist=False)
    return _execute_royalty_calculation(stmt=stmt, session=session, lock_and_persist=True)


@router.post("/{statement_id}/mark-as-paid", response_model=RoyaltyRunReport)
def mark_statement_as_paid(
    statement_id: UUID,
    payload: MarkStatementPaidPayload,
    session: Session = Depends(get_session),
) -> RoyaltyRunReport:
    """Enregistre le règlement bancaire effectif des décomptes d'ayants droit (statut PAID).
    Nécessite que le relevé soit préalablement clôturé et verrouillé (LOCKED).
    Bascule les lignes de Grand Livre en statut PAID et enregistre la référence de transaction.
    """
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    if getattr(stmt, "accounting_status", "DRAFT") == "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Le relevé doit être préalablement clôturé et verrouillé (statut LOCKED) avant d'enregistrer les paiements bancaires.",
        )

    now = datetime.now(timezone.utc)
    if payload.payment_date:
        pay_dt = datetime.combine(payload.payment_date, datetime.min.time(), tzinfo=timezone.utc)
    else:
        pay_dt = now

    stmt.accounting_status = "PAID"
    stmt.paid_at = pay_dt
    stmt.payment_reference = payload.payment_reference.strip()
    stmt.payment_method = payload.payment_method
    stmt.payment_notes = payload.payment_notes
    session.add(stmt)

    # Basculer les écritures de Grand Livre en statut PAID
    ledger_entries = list(
        session.exec(
            select(RoyaltyLedgerEntry).where(RoyaltyLedgerEntry.statement_id == stmt.id)
        ).all()
    )
    paid_count = 0
    total_paid_net = Decimal("0.00")
    for entry in ledger_entries:
        if entry.payout_status == "PAYABLE":
            entry.payout_status = "PAID"
            paid_count += 1
            total_paid_net += entry.net_payable_amount
            session.add(entry)

    session.add(
        AuditLog(
            action_type="STATEMENT_ROYALTIES_PAID",
            entity_type="ROYALTY_STATEMENT",
            entity_id=str(stmt.id),
            actor=payload.operator_email or "tresorerie@solstices-music.fr",
            summary=(
                f"Règlement bancaire exécuté ({payload.payment_method}) pour le relevé « {stmt.source_name} » : "
                f"Réf. {stmt.payment_reference}, {paid_count} ayant(s) droit réglé(s) pour un total net de {total_paid_net} €."
            ),
            details={
                "statement_id": str(stmt.id),
                "payment_reference": stmt.payment_reference,
                "payment_method": stmt.payment_method,
                "paid_at": pay_dt.isoformat(),
                "paid_beneficiaries_count": paid_count,
                "total_paid_net": str(total_paid_net),
            },
            created_at=now,
        )
    )
    session.commit()
    return _execute_royalty_calculation(stmt=stmt, session=session, lock_and_persist=False)


@router.post("/{statement_id}/reopen-draft", response_model=RoyaltyRunReport)
def reopen_statement_to_draft(
    statement_id: UUID,
    session: Session = Depends(get_session),
) -> RoyaltyRunReport:
    """Rouvre un relevé verrouillé (LOCKED) en mode simulation (DRAFT).
    Impossible si les règlements bancaires ont déjà été exécutés (PAID).
    Rétablit les soldes d'avances et de réserve dans leur état initial.
    """
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    if getattr(stmt, "accounting_status", "DRAFT") == "PAID":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Impossible de rouvrir un relevé dont les règlements bancaires ont déjà été exécutés (statut PAID).",
        )
    if getattr(stmt, "accounting_status", "DRAFT") == "DRAFT":
        return _execute_royalty_calculation(stmt=stmt, session=session, lock_and_persist=False)

    now = datetime.now(timezone.utc)
    # Rétablir les contrats et soldes
    ledger_entries = list(
        session.exec(
            select(RoyaltyLedgerEntry).where(RoyaltyLedgerEntry.statement_id == stmt.id)
        ).all()
    )
    for entry in ledger_entries:
        if entry.contract_id:
            c = session.get(Contract, entry.contract_id)
            if c and entry.previously_recouped_snapshot is not None:
                c.recouped_amount = entry.previously_recouped_snapshot
                session.add(c)
            al = session.exec(
                select(AdvanceLedger).where(AdvanceLedger.contract_id == entry.contract_id)
            ).first()
            if al and entry.previously_recouped_snapshot is not None:
                al.recouped_amount = entry.previously_recouped_snapshot
                session.add(al)
        if entry.right_holder_id:
            dh = session.get(RightHolderDirectory, entry.right_holder_id)
            if dh and entry.carried_forward_initial is not None:
                dh.retained_reserve_balance = entry.carried_forward_initial
                session.add(dh)
        session.delete(entry)

    stmt.accounting_status = "DRAFT"
    stmt.locked_at = None
    stmt.integrity_hash = None
    stmt.paid_at = None
    stmt.payment_reference = None
    stmt.payment_method = None
    stmt.payment_notes = None
    session.add(stmt)

    session.add(
        AuditLog(
            action_type="STATEMENT_ROYALTIES_REOPENED",
            entity_type="ROYALTY_STATEMENT",
            entity_id=str(stmt.id),
            actor="daf@solstices-music.fr",
            summary=(
                f"Réouverture comptable en mode simulation (DRAFT) du relevé « {stmt.source_name} ». "
                f"Les écritures du Grand Livre ont été annulées et les avances rétablies."
            ),
            details={"statement_id": str(stmt.id)},
            created_at=now,
        )
    )
    session.commit()
    return _execute_royalty_calculation(stmt=stmt, session=session, lock_and_persist=False)


@router.get("/{statement_id}/holder-report/{holder_name}")
def export_holder_individual_statement(
    statement_id: UUID,
    holder_name: str,
    lang: str = Query(default="FR", description="Langue du décompte : FR ou EN"),
    group_by: str = Query(default="WORK", description="Regroupement : WORK, PROJECT, TERRITORY, RIGHT_TYPE"),
    hide_zero_lines: bool = Query(default=False, description="Masquer les lignes sans montant exigible"),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    """Génère le relevé de compte individuel déterministe (JSON + CSV) pour un ayant droit."""
    ws = get_or_create_workspace_settings(session)
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")

    run_report = compute_statement_royalties(statement_id=statement_id, session=session)
    target_norm = normalize_holder_identity_name(holder_name)
    target_holder = next(
        (
            h
            for h in run_report.holder_statements
            if normalize_holder_identity_name(h.holder_name) == target_norm
        ),
        None,
    )
    if not target_holder:
        raise HTTPException(status_code=404, detail="Ayant droit absent de ce décompte.")

    # Lookup des Projets Audiovisuels / Groupes d'œuvres
    all_work_groups = {g.id: g for g in session.exec(select(WorkGroup)).all()}
    all_group_links = session.exec(select(WorkGroupLink)).all()
    work_to_group: dict[UUID, WorkGroup] = {}
    for gl in all_group_links:
        g = all_work_groups.get(gl.work_group_id)
        if g:
            work_to_group[gl.work_id] = g

    lines = list(
        session.exec(
            select(StatementLine).where(
                StatementLine.statement_id == statement_id,
                StatementLine.validation_status == ValidationStatus.VALIDATED.value,
            )
        ).all()
    )
    line_details = []
    for ln in lines:
        w_grp = work_to_group.get(ln.matched_work_id) if ln.matched_work_id else None
        for alloc in ln.allocations or []:
            if normalize_holder_identity_name(str(alloc.get("holder_name", ""))) == target_norm:
                line_details.append(
                    {
                        "work_title": ln.matched_work_title or ln.raw_work_title,
                        "right_type": ln.right_type,
                        "gross_amount": str(ln.gross_amount),
                        "share_percentage": str(alloc.get("share_percentage", "0.00")),
                        "allocated_amount": str(alloc.get("allocated_amount", "0.00")),
                        "territory": getattr(ln, "territory", "FR") or "FR",
                        "work_group_title": w_grp.name if w_grp else "Catalogue Général / Hors Projet",
                        "source_currency": getattr(ln, "source_currency", "EUR") or getattr(stmt, "source_currency", "EUR") or "EUR",
                        "source_gross_amount": str(getattr(ln, "source_gross_amount", ln.gross_amount) or ln.gross_amount),
                        "exchange_rate": str(getattr(ln, "exchange_rate", Decimal("1.000000")) or "1.000000"),
                    }
                )

    return generate_individual_holder_statement(
        holder_state=target_holder,
        publisher_name=ws.publisher_name,
        publisher_ipi=ws.publisher_ipi,
        statement_source=stmt.source_name,
        period_start=str(stmt.period_start),
        period_end=str(stmt.period_end),
        vat_rate_pct=Decimal(str(ws.vat_rate_pct)),
        line_details=line_details,
        language=lang,
        group_by=group_by,
        hide_zero_lines=hide_zero_lines,
    )


@router.get("/{statement_id}/holder-invoice/{holder_name}", response_model=ReadyToUseInvoicePayload)
def get_statement_holder_invoice(
    statement_id: UUID,
    holder_name: str,
    session: Session = Depends(get_session),
) -> ReadyToUseInvoicePayload:
    """Génère directement en 1 clic la Facture (Société) ou Note de Droits d'Auteur (Personne Physique)
    pour un ayant droit sur une répartition de décompte SACEM spécifique.
    """
    ws = get_or_create_workspace_settings(session)
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")

    run_report = compute_statement_royalties(statement_id=statement_id, session=session)
    target_norm = normalize_holder_identity_name(holder_name)
    target_holder = next(
        (
            h
            for h in run_report.holder_statements
            if normalize_holder_identity_name(h.holder_name) == target_norm
        ),
        None,
    )
    if not target_holder:
        raise HTTPException(status_code=404, detail="Ayant droit absent de ce décompte.")

    # Trouver ou reconstituer la fiche annuaire
    directory_holders = list(session.exec(select(RightHolderDirectory)).all())
    dh = next(
        (
            d
            for d in directory_holders
            if (target_holder.right_holder_id and d.id == target_holder.right_holder_id)
            or (target_holder.ipi_number and normalize_ipi_code(d.ipi_number) == normalize_ipi_code(target_holder.ipi_number))
            or (normalize_holder_identity_name(d.full_name) == target_norm)
        ),
        None,
    )

    is_company = (dh.entity_type if dh else target_holder.entity_type) == "SOCIETE"
    doc_type = "FACTURE_REDEVANCES_FACTURX" if is_company else "NOTE_DROITS_AUTEUR"
    inv_prefix = "FAC-2026" if is_company else "NDA-2026"
    short_id = str(dh.id if dh else target_holder.right_holder_id or uuid4())[:6].upper()
    invoice_number = f"{inv_prefix}-{short_id}"
    issue_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    period_label = f"{stmt.source_name} ({stmt.period_start} au {stmt.period_end})"

    gross = target_holder.gross_royalties_allocated
    recouped = target_holder.recouped_in_period
    taxable_ht = target_holder.taxable_base_ht
    vat_rate = target_holder.vat_rate_pct
    vat_amount = target_holder.vat_amount
    precompte = target_holder.precompte_social_amount
    net_payable = target_holder.net_payable_amount

    holder_addr = (
        ", ".join(
            filter(None, [dh.postal_address if dh else None, f"{dh.postal_code or ''} {dh.city or ''}".strip() if dh else None, dh.country if dh else "FR"])
        )
        or "Adresse renseignée sur la fiche ayant droit"
    )

    if is_company:
        legal_mentions = [
            f"Facture de redevances d'édition / coédition émise par une personne morale ({dh.legal_form if dh else 'Société commerciale'}).",
            f"SIRET Ayant Droit : {dh.siret if dh and dh.siret else 'Non renseigné'} • N° TVA Intracommunautaire : {dh.vat_number if dh and dh.vat_number else 'Non renseigné'}.",
            "Aucun précompte social IRCEC/URSSAF applicable aux personnes morales.",
            "Document structuré conforme aux exigences de la Facturation Électronique 2026–2027 (Factur-X / EN 16931).",
        ]
    elif dh and dh.urssaf_dispense_certificate:
        legal_mentions = [
            f"Personne physique déclarée en BNC (SIRET : {dh.siret or 'Renseigné'}).",
            "Dispense de précompte social URSSAF Artiste-Auteur fournie (0,00 € retenu à la source).",
            "TVA applicable au taux réduit de 10,00 % sur les cessions de droits patrimoniaux (Art. 279 g du CGI)."
            if dh.vat_applicable
            else "TVA non applicable, art. 293 B du CGI (Franchise en base de TVA).",
        ]
    else:
        legal_mentions = [
            "Note de droits d'auteur établie par l'Éditeur par mandat d'autofacturation.",
            "Personne physique soumise au Précompte Social Artiste-Auteur (URSSAF Limousin / CSG-CRDS / CFP ~11,10%) retenu et reversé par l'Éditeur.",
            "TVA non applicable, art. 293 B du CGI (Franchise en base de TVA)."
            if not (dh and dh.vat_applicable)
            else f"TVA sur droits d'auteur ({vat_rate:.2f} %).",
        ]

    printable_lines = [
        "================================================================================",
        f"  {'FACTURE DE REDEVANCES (FACTUR-X 2026)' if is_company else 'NOTE DE DROITS D AUTEUR (AUTOFACTURATION)'}",
        f"  N° Document : {invoice_number}   |   Date d'émission : {issue_date}",
        f"  Période de répartition SACEM : {period_label}",
        "================================================================================",
        "",
        "ÉMETTEUR (AYANT DROIT) :",
        f"  Nom / Raison Sociale : {target_holder.holder_name}",
        f"  Statut Juridique     : {'SOCIETE' if is_company else 'PERSONNE PHYSIQUE'} ({dh.legal_form if dh and dh.legal_form else 'Standard'})",
        f"  Code IPI / OGC       : {target_holder.ipi_number or 'N/A'} ({dh.affiliated_society if dh else 'SACEM'})",
        f"  SIRET / TVA Intra.   : {dh.siret if dh and dh.siret else 'Sans SIRET'} / {dh.vat_number if dh and dh.vat_number else 'Franchise Art. 293 B CGI'}",
        f"  Adresse              : {holder_addr}",
        f"  Email                : {dh.email if dh and dh.email else 'N/A'}",
        "",
        "DESTINATAIRE (MAISON D'ÉDITION PAYEUSE) :",
        f"  Raison Sociale       : {ws.publisher_name}",
        f"  Code IPI Éditeur     : {ws.publisher_ipi}",
        f"  SIRET Éditeur        : {ws.publisher_siret or '89123456700014'}",
        f"  N° TVA Éditeur       : {ws.publisher_vat or 'FR64891234567'}",
        f"  Adresse Éditeur      : {ws.publisher_address or '24 Rue de Paradis, 75010 Paris, France'}",
        "",
        "DÉCOMPTE FINANCIER DÉTERMINISTE (RÉPARTITION SACEM) :",
        "--------------------------------------------------------------------------------",
        f"  1. Redevances Brutes SACEM Allouées               :   {gross:>10.2f} EUR",
        f"  2. Amortissement sur Avance Récupérable (Recoupment): - {recouped:>10.2f} EUR",
        "  ------------------------------------------------------------------------------",
        f"  3. Assiette Payable Hors Taxes (Base HT)           :   {taxable_ht:>10.2f} EUR",
        f"  4. TVA ({vat_rate:.2f} %)                                   : + {vat_amount:>10.2f} EUR",
        f"  5. Précompte Social URSSAF / IRCEC (~11,10 %)      : - {precompte:>10.2f} EUR",
        "================================================================================",
        f"  NET À PAYER PAR VIREMENT SEPA (EUR)                :   {net_payable:>10.2f} EUR",
        "================================================================================",
        f"  Coordonnées Bancaires (IBAN) : {dh.iban if dh and dh.iban else target_holder.iban or 'IBAN à renseigner'} ({dh.bic if dh and dh.bic else target_holder.bic or 'BIC'})",
        "",
        "MENTIONS LÉGALES & FISCALES :",
        *[f"  • {m}" for m in legal_mentions],
        "================================================================================",
    ]

    return ReadyToUseInvoicePayload(
        invoice_number=invoice_number,
        document_type=doc_type,
        issue_date=issue_date,
        period_label=period_label,
        publisher_name=ws.publisher_name,
        publisher_siret=ws.publisher_siret or "89123456700014",
        publisher_vat=ws.publisher_vat or "FR64891234567",
        publisher_address=ws.publisher_address or "24 Rue de Paradis, 75010 Paris, France",
        holder_id=dh.id if dh else target_holder.right_holder_id or uuid4(),
        holder_name=target_holder.holder_name,
        entity_type="SOCIETE" if is_company else "PERSONNE_PHYSIQUE",
        legal_form=dh.legal_form if dh else None,
        holder_ipi=target_holder.ipi_number,
        holder_siret=dh.siret if dh else None,
        holder_vat_number=dh.vat_number if dh else None,
        holder_address=holder_addr,
        holder_email=dh.email if dh else None,
        holder_iban=dh.iban if dh else target_holder.iban,
        gross_royalties_eur=str(gross),
        recouped_advance_eur=str(recouped),
        taxable_base_ht_eur=str(taxable_ht),
        vat_rate_pct=str(vat_rate),
        vat_amount_eur=str(vat_amount),
        ircec_raap_cotisation_eur=str((taxable_ht * Decimal("0.0110")).quantize(CENT)) if not is_company and not (dh and dh.urssaf_dispense_certificate) else "0.00",
        csg_crds_cotisation_eur=str((taxable_ht * Decimal("0.1000")).quantize(CENT)) if not is_company and not (dh and dh.urssaf_dispense_certificate) else "0.00",
        total_precompte_social_eur=str(precompte),
        net_payable_to_holder_eur=str(net_payable),
        legal_mentions=legal_mentions,
        printable_text="\n".join(printable_lines),
    )


@router.get("/{statement_id}/sepa-preview", response_model=SepaValidationReport)
def preview_sepa_credit_transfers(
    statement_id: UUID,
    execution_date: str | None = Query(default=None, description="Date d'exécution au format AAAA-MM-JJ"),
    remittance_prefix: str = Query(default="KOROM ROYALTIES", description="Préfixe du libellé de virement"),
    allow_unverified_ibans: bool = Query(default=False, description="Tolérance IBANs pour données de test"),
    session: Session = Depends(get_session),
) -> SepaValidationReport:
    """Audit préalable de conformité bancaire avant émission du virement groupé SEPA XML ISO 20022."""
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")

    ws = get_or_create_workspace_settings(session)
    report = _execute_royalty_calculation(stmt, session, lock_and_persist=False)

    debtor_name = getattr(ws, "publisher_name", "Éditions Solstices Music")
    debtor_iban = getattr(ws, "publisher_iban", None) or "FR0830004019920005554443210"
    debtor_bic = getattr(ws, "publisher_bic", None) or "BNPAFRPPXXX"
    period_label = f"{stmt.period_start} au {stmt.period_end}"

    return build_sepa_validation_report(
        statement_id=str(stmt.id),
        source_name=stmt.source_name,
        period_label=period_label,
        holder_statements=report.holder_statements,
        debtor_name=debtor_name,
        debtor_iban=debtor_iban,
        debtor_bic=debtor_bic,
        execution_date=execution_date,
        remittance_prefix=remittance_prefix,
        allow_unverified_ibans=allow_unverified_ibans,
    )


@router.post("/{statement_id}/export-sepa", response_model=SepaExportResponse)
def export_sepa_credit_transfers(
    statement_id: UUID,
    payload: SepaExportRequest,
    session: Session = Depends(get_session),
) -> SepaExportResponse:
    """Génère le fichier XML SEPA pain.001.001.03 prêt à être télétransmis sur la banque de l'éditeur."""
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")

    ws = get_or_create_workspace_settings(session)
    report = _execute_royalty_calculation(stmt, session, lock_and_persist=False)

    debtor_name = payload.debtor_name or getattr(ws, "publisher_name", "Éditions Solstices Music")
    debtor_iban = payload.debtor_iban or getattr(ws, "publisher_iban", None) or "FR0830004019920005554443210"
    debtor_bic = payload.debtor_bic or getattr(ws, "publisher_bic", None) or "BNPAFRPPXXX"
    period_label = f"{stmt.period_start} au {stmt.period_end}"

    result = generate_sepa_pain001_xml(
        statement_id=str(stmt.id),
        source_name=stmt.source_name,
        period_label=period_label,
        holder_statements=report.holder_statements,
        debtor_name=debtor_name,
        debtor_iban=debtor_iban,
        debtor_bic=debtor_bic,
        execution_date=payload.execution_date,
        remittance_prefix=payload.remittance_prefix,
        allow_unverified_ibans=payload.allow_unverified_ibans,
    )

    now = datetime.now(timezone.utc)
    session.add(
        AuditLog(
            action_type="SEPA_FILE_GENERATED",
            entity_type="STATEMENT",
            entity_id=str(statement_id),
            actor=ws.default_operator_email,
            summary=f"Fichier de virement bancaire SEPA pain.001 généré : {result.total_transactions} virement(s) pour {result.total_amount_eur} €.",
            details={
                "filename": result.filename,
                "message_id": result.message_id,
                "total_transactions": result.total_transactions,
                "total_amount_eur": str(result.total_amount_eur),
                "execution_date": result.execution_date,
            },
            created_at=now,
        )
    )
    session.commit()

    return result


@router.delete("/{statement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_statement(statement_id: UUID, session: Session = Depends(get_session)) -> None:
    """Supprime un relevé de royalties importé ainsi que ses lignes et écritures associées."""
    ws = get_or_create_workspace_settings(session)
    stmt = session.get(RoyaltyStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Relevé introuvable.")
    if getattr(stmt, "accounting_status", "DRAFT") == "PAID":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Impossible de supprimer un relevé de royalties dont les règlements bancaires ont été exécutés (statut PAID).",
        )

    lines = session.exec(select(StatementLine).where(StatementLine.statement_id == statement_id)).all()
    for ln in lines:
        session.delete(ln)

    entries = session.exec(select(RoyaltyLedgerEntry).where(RoyaltyLedgerEntry.statement_id == statement_id)).all()
    for ent in entries:
        session.delete(ent)

    source_name = stmt.source_name
    session.delete(stmt)

    now = datetime.now(timezone.utc)
    session.add(
        AuditLog(
            action_type="STATEMENT_DELETED",
            entity_type="STATEMENT",
            entity_id=str(statement_id),
            actor=ws.default_operator_email,
            summary=f"Relevé « {source_name} » supprimé ({len(lines)} ligne(s)).",
            details={"source_name": source_name, "lines_deleted": len(lines)},
            created_at=now,
        )
    )
    session.commit()
