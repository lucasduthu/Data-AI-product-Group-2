from collections.abc import Generator
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

FALLBACK_SQLITE_PATH = Path(__file__).resolve().parents[2] / "rightscopilot_local.db"


def _build_engine() -> Engine:
    """Crée le moteur SQLModel avec support PostgreSQL (pgvector) et fallback SQLite local."""
    db_url = settings.DATABASE_URL
    try:
        eng = create_engine(
            db_url,
            echo=False,
            pool_pre_ping=True,
        )
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
            if db_url.startswith("postgresql"):
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                    conn.commit()
                except Exception:
                    conn.rollback()
        return eng
    except Exception:
        sqlite_url = f"sqlite:///{FALLBACK_SQLITE_PATH}"
        return create_engine(
            sqlite_url,
            echo=False,
            connect_args={"check_same_thread": False},
        )


engine = _build_engine()


def init_db() -> None:
    """Initialise toutes les tables SQLModel et applique les migrations incrémentales de colonnes."""
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _apply_incremental_column_migrations()
    _seed_default_publishing_entities()


def _apply_incremental_column_migrations() -> None:
    """Garantit la présence des colonnes ajoutées sur une base existante sans perte de données."""
    migrations = [
        "ALTER TABLE royalty_statements ADD COLUMN accounting_status VARCHAR(32) DEFAULT 'DRAFT'",
        "ALTER TABLE royalty_statements ADD COLUMN locked_at TIMESTAMP",
        "ALTER TABLE royalty_statements ADD COLUMN paid_at TIMESTAMP",
        "ALTER TABLE royalty_statements ADD COLUMN payment_reference VARCHAR(128)",
        "ALTER TABLE royalty_statements ADD COLUMN payment_method VARCHAR(64)",
        "ALTER TABLE royalty_statements ADD COLUMN payment_notes VARCHAR(512)",
        "ALTER TABLE royalty_statements ADD COLUMN integrity_hash VARCHAR(128)",
        "ALTER TABLE contracts ADD COLUMN right_holder_id CHAR(32)",
        "ALTER TABLE contracts ADD COLUMN sacem_contract_number VARCHAR(64)",
        "ALTER TABLE contracts ADD COLUMN cwr_contract_type VARCHAR(32)",
        "ALTER TABLE advance_ledgers ADD COLUMN right_holder_id CHAR(32)",
        "ALTER TABLE works ADD COLUMN subtitle VARCHAR(255)",
        "ALTER TABLE works ADD COLUMN sacem_work_code VARCHAR(32)",
        "ALTER TABLE works ADD COLUMN cotage_number VARCHAR(64)",
        "ALTER TABLE works ADD COLUMN genre VARCHAR(64)",
        "ALTER TABLE works ADD COLUMN duration_seconds INTEGER",
        "ALTER TABLE works ADD COLUMN creation_year INTEGER",
        "ALTER TABLE works ADD COLUMN administration_status VARCHAR(32) DEFAULT 'ACTIVE'",
        "ALTER TABLE works ADD COLUMN contract_reference VARCHAR(128)",
        "ALTER TABLE works ADD COLUMN general_notes TEXT",
        "ALTER TABLE works ADD COLUMN timeline_notes JSON DEFAULT '[]'",
        "ALTER TABLE workspace_settings ADD COLUMN min_payment_threshold NUMERIC(10, 2) DEFAULT 50.00",
        "ALTER TABLE workspace_settings ADD COLUMN statement_messages JSON DEFAULT '{}'",
        "ALTER TABLE right_holders_directory ADD COLUMN society_de VARCHAR(64) DEFAULT 'SACEM'",
        "ALTER TABLE right_holders_directory ADD COLUMN society_dr VARCHAR(64) DEFAULT 'SACEM'",
        "ALTER TABLE right_holders_directory ADD COLUMN retained_reserve_balance NUMERIC(12, 2) DEFAULT 0.00",
        "ALTER TABLE work_groups ADD COLUMN contract_id CHAR(32)",
        "ALTER TABLE work_groups ADD COLUMN contract_reference VARCHAR(128)",
        "ALTER TABLE work_groups ADD COLUMN default_splits JSON DEFAULT '[]'",
        "ALTER TABLE statement_lines ADD COLUMN raw_sacem_code VARCHAR(32)",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN carried_forward_initial NUMERIC(14, 2) DEFAULT 0.00",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN retained_in_reserve NUMERIC(14, 2) DEFAULT 0.00",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN payout_status VARCHAR(32) DEFAULT 'PAYABLE'",
        "ALTER TABLE right_holders_directory ADD COLUMN is_deceased BOOLEAN DEFAULT 0",
        "ALTER TABLE right_holders_directory ADD COLUMN deceased_at VARCHAR(32)",
        "ALTER TABLE right_holders_directory ADD COLUMN payout_recipient_id CHAR(32)",
        "ALTER TABLE right_holders_directory ADD COLUMN payout_recipient_name VARCHAR(255)",
        "ALTER TABLE right_holders_directory ADD COLUMN succession_active BOOLEAN DEFAULT 0",
        "ALTER TABLE right_holders_directory ADD COLUMN succession_notes VARCHAR(512)",
        "ALTER TABLE right_holders_directory ADD COLUMN heirs JSON DEFAULT '[]'",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN payout_recipient_id CHAR(32)",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN payout_recipient_name VARCHAR(255)",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN is_succession_payout BOOLEAN DEFAULT 0",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN heirs_payout_details JSON DEFAULT '[]'",
        "ALTER TABLE workspace_settings ADD COLUMN currency_rates JSON DEFAULT '[]'",
        "ALTER TABLE royalty_statements ADD COLUMN source_currency VARCHAR(3) DEFAULT 'EUR'",
        "ALTER TABLE royalty_statements ADD COLUMN exchange_rate NUMERIC(12, 6) DEFAULT 1.000000",
        "ALTER TABLE royalty_statements ADD COLUMN source_gross_amount NUMERIC(18, 6) DEFAULT 0.000000",
        "ALTER TABLE statement_lines ADD COLUMN source_currency VARCHAR(3) DEFAULT 'EUR'",
        "ALTER TABLE statement_lines ADD COLUMN exchange_rate NUMERIC(12, 6) DEFAULT 1.000000",
        "ALTER TABLE statement_lines ADD COLUMN source_gross_amount NUMERIC(18, 6) DEFAULT 0.000000",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN source_currency VARCHAR(3) DEFAULT 'EUR'",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN exchange_rate NUMERIC(12, 6) DEFAULT 1.000000",
        "ALTER TABLE royalty_ledger_entries ADD COLUMN source_gross_allocated NUMERIC(14, 2)",
        "ALTER TABLE workspace_settings ADD COLUMN publisher_iban VARCHAR(64) DEFAULT 'FR0830004019920005554443210'",
        "ALTER TABLE workspace_settings ADD COLUMN publisher_bic VARCHAR(16) DEFAULT 'BNPAFRPPXXX'",
        "ALTER TABLE workspace_settings ADD COLUMN onboarding_completed BOOLEAN DEFAULT 0",
        "ALTER TABLE workspace_settings ADD COLUMN onboarding_dismissed BOOLEAN DEFAULT 0",
        "ALTER TABLE workspace_settings ADD COLUMN onboarding_completed_steps JSON DEFAULT '[]'",
        "ALTER TABLE contracts ADD COLUMN work_subgroups JSON DEFAULT '[]'",
        "ALTER TABLE contracts ADD COLUMN co_edition_alert TEXT",
        "ALTER TABLE contracts ADD COLUMN requires_cession_contract BOOLEAN DEFAULT 0",
        "ALTER TABLE contracts ADD COLUMN expected_cession_contracts JSON DEFAULT '[]'",
        "ALTER TABLE contracts ADD COLUMN audiovisual_program VARCHAR(255)",
        "ALTER TABLE works ADD COLUMN sacem_registration_status VARCHAR(32)",
        "ALTER TABLE works ADD COLUMN sacem_ack_reference VARCHAR(128)",
        "ALTER TABLE works ADD COLUMN sacem_registered_at TIMESTAMP",
        "ALTER TABLE works ADD COLUMN sacem_rejection_reason TEXT",
        "ALTER TABLE works ADD COLUMN lifecycle_status VARCHAR(64)",
        "ALTER TABLE royalty_statements ADD COLUMN campaign_id CHAR(32)",
        "ALTER TABLE works ADD COLUMN entity_id CHAR(32)",
        "ALTER TABLE contracts ADD COLUMN entity_id CHAR(32)",
        "ALTER TABLE work_groups ADD COLUMN entity_id CHAR(32)",
        "ALTER TABLE dashboard_tasks ADD COLUMN entity_id CHAR(32)",
        "ALTER TABLE royalty_statements ADD COLUMN entity_id CHAR(32)",
    ]
    for ddl in migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(ddl))
                conn.commit()
        except Exception:
            pass

    # Réparation idempotente des splits d'œuvres depuis les contrats validés
    try:
        from decimal import Decimal
        from sqlmodel import select
        from app.models.work import Work
        from app.models.contract import Contract

        with Session(engine) as session:
            contracts = session.exec(
                select(Contract).where(Contract.validation_status == "VALIDATED")
            ).all()
            for contract in contracts:
                creator_parties = [
                    p for p in (contract.parties or [])
                    if p.get("role") not in ("E", "SE", "PUBLISHER", "SUB_PUBLISHER")
                ]
                if not creator_parties or not contract.work_titles:
                    continue

                contract_splits = [
                    {
                        "right_holder_id": str(p.get("right_holder_id")) if p.get("right_holder_id") else None,
                        "holder_name": p["party_name"],
                        "role": p["role"],
                        "ipi_number": p.get("ipi_number"),
                        "dep_share_pct": str(p["dep_share_pct"]),
                        "drm_share_pct": str(p["drm_share_pct"]),
                        "sync_share_pct": str(p.get("sync_share_pct", "0.00")),
                        "phono_share_pct": str(p.get("phono_share_pct", "0.00")),
                        "share_percentage": str(p["dep_share_pct"]),
                    }
                    for p in contract.parties
                ]
                total_dep = sum(Decimal(str(s["dep_share_pct"])) for s in contract_splits)
                if abs(total_dep - Decimal("100.00")) > Decimal("0.05"):
                    continue

                for title in contract.work_titles:
                    w = session.exec(select(Work).where(Work.title == title)).first()
                    if not w:
                        continue
                    w_dep_sum = sum(Decimal(str(s.get("dep_share_pct", 0))) for s in (w.splits or []))
                    if abs(w_dep_sum - Decimal("100.00")) > Decimal("0.05"):
                        w.splits = contract_splits
                        w.contract_reference = contract.contract_reference
                        session.add(w)
            session.commit()
    except Exception:
        pass


def _seed_default_publishing_entities() -> None:
    """Garantit l'existence du profil éditorial principal configuré (ex: Éditions Solstices Music) et migre les données orphelines."""
    try:
        from sqlmodel import select
        from app.models.publishing_entity import PublishingEntity
        from app.models.workspace_settings import WorkspaceSettings
        from app.models.work import Work
        from app.models.contract import Contract
        from app.models.work_group import WorkGroup
        from app.models.task import DashboardTask
        from app.models.statement import RoyaltyStatement

        with Session(engine) as session:
            existing = session.exec(select(PublishingEntity)).all()
            if not existing:
                ws = session.exec(select(WorkspaceSettings)).first()
                pub_name = ws.publisher_name if ws else "Éditions Solstices Music"
                pub_ipi = ws.publisher_ipi if ws else "00891234567"
                pub_cwr = ws.cwr_sender_code if ws else "SOLSTICES"
                pub_iban = ws.publisher_iban if ws else "FR0830004019920005554443210"
                pub_bic = ws.publisher_bic if ws else "BNPAFRPPXXX"

                default_ent = PublishingEntity(
                    name=pub_name,
                    legal_name=f"{pub_name} SAS",
                    sacem_ipi=pub_ipi,
                    sacem_account_number="SC-SOLSTICES-01",
                    cwr_sender_code=pub_cwr,
                    color="#8B5CF6",
                    description="Maison d'édition musicale principale (Catalogue général & Synchronisation)",
                    iban=pub_iban,
                    bic=pub_bic,
                    default_currency="EUR",
                    is_default=True,
                )
                session.add(default_ent)
                session.commit()
                session.refresh(default_ent)
                default_entity_id = default_ent.id
            else:
                default_ent = next((e for e in existing if e.is_default), existing[0])
                default_entity_id = default_ent.id

            # Rapprochement des enregistrements orphelins (entity_id IS NULL) vers l'entité par défaut
            for model_cls in (Work, Contract, WorkGroup, DashboardTask, RoyaltyStatement):
                items = session.exec(select(model_cls).where(model_cls.entity_id == None)).all()  # noqa: E711
                for it in items:
                    it.entity_id = default_entity_id
                    session.add(it)
            session.commit()
    except Exception:
        pass


def get_session() -> Generator[Session, None, None]:
    """Dépendance FastAPI fournissant une session de base de données."""
    with Session(engine) as session:
        yield session
