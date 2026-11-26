"""Tests unitaires et d'intégration pour l'ingestion des accusés de réception CWR ACK/NACK (US-5.8)."""

from decimal import Decimal
import io
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.core.database import get_session
from app.models.work import Work
from app.schemas.work import RightHolderRole, RightHolderSplit
from app.services.cwr_ack_parser import (
    parse_cisac_cwr_ack_text,
    parse_sacem_csv_ack_text,
    process_cwr_ack,
)


@pytest.fixture
def client_and_session():
    from app.core.database import init_db
    init_db()
    client = TestClient(app)
    session_gen = app.dependency_overrides.get(get_session, get_session)
    session = next(session_gen())
    yield client, session


def test_parse_cisac_cwr_ack_text_registration_accepted():
    """Vérifie le parsing d'une ligne ACK CISAC acceptée avec attribution de code SACEM."""
    ack_content = (
        "HDRPB008912345EDITIONS SOLSTICES MUSIC                      01.102026111617000020261116\n"
        "GRHACK0000102.100000000000\n"
        "ACK00000001000000010000000100000000NWRRA2026111612000020261116  111785573767  ERC FN ACCIDENT                       T1234567890\n"
        "GRT000010000000100000003\n"
        "TRL000010000000100000004\n"
    )
    txs = parse_cisac_cwr_ack_text(ack_content)
    assert len(txs) == 1
    tx = txs[0]
    assert tx["status_code"] == "RA"
    assert tx["is_accepted"] is True
    assert tx["recipient_work_number"] == "111785573767"
    assert "ACCIDENT" in tx["work_title"]


def test_parse_cisac_cwr_ack_with_exc_rejection():
    """Vérifie le parsing d'une ligne ACK CISAC avec enregistrement d'exception (EXC)."""
    ack_content = (
        "ACK00000001000000010000000100000000NWRRE2026111612000020261116                ERC FN THEME PERDU                    \n"
        "EXC0000000100000002201TWRITER IPI NUMBER INVALID OR MISSING\n"
    )
    txs = parse_cisac_cwr_ack_text(ack_content)
    assert len(txs) == 1
    tx = txs[0]
    assert tx["status_code"] == "RE"
    assert tx["is_accepted"] is False
    assert len(tx["exceptions"]) == 1
    assert "IPI" in tx["exceptions"][0]["message"]


def test_parse_sacem_csv_ack_text():
    """Vérifie le parsing d'un tableau CSV d'accusé de déclaration SACEM."""
    csv_content = (
        "Date de dépôt;Titre de l'oeuvre;Code SACEM;Statut;Motif de rejet\n"
        "16/11/2026;ERC FN ACCIDENT;111785573767;Validé;\n"
        "16/11/2026;ERC FN BD THEME;;Rejeté;Code IPI compositeur manquant\n"
    )
    txs = parse_sacem_csv_ack_text(csv_content)
    assert len(txs) == 2
    assert txs[0]["is_accepted"] is True
    assert txs[0]["recipient_work_number"] == "111785573767"
    assert txs[1]["is_accepted"] is False
    assert len(txs[1]["exceptions"]) == 1
    assert "IPI" in txs[1]["exceptions"][0]["message"]


def test_endpoint_import_cwr_ack(client_and_session):
    """Vérifie l'endpoint POST /api/v1/works/import-cwr-ack avec synchronisation en base."""
    from uuid import uuid4
    client, session = client_and_session

    unique_suffix = uuid4().hex[:8].upper()
    title1 = f"ACK WORK {unique_suffix}"
    title2 = f"ACK WORK REJET {unique_suffix}"
    iswc1 = f"T-888.{unique_suffix[:3]}.{unique_suffix[3:6]}-1"
    iswc2 = f"T-888.{unique_suffix[:3]}.{unique_suffix[3:6]}-2"

    # Créer deux œuvres de test
    work1 = Work(
        title=title1,
        iswc=iswc1,
        splits=[
            RightHolderSplit(
                holder_name="TEST COMPOSER",
                role=RightHolderRole.C,
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ).model_dump(mode="json")
        ],
    )
    work2 = Work(
        title=title2,
        iswc=iswc2,
        splits=[
            RightHolderSplit(
                holder_name="TEST COMPOSER 2",
                role=RightHolderRole.C,
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ).model_dump(mode="json")
        ],
    )
    session.add(work1)
    session.add(work2)
    session.commit()

    iswc1_clean = iswc1.replace("-", "").replace(".", "")
    iswc2_clean = iswc2.replace("-", "").replace(".", "")
    cocv1 = f"99{int(unique_suffix, 16) % 10000000000:010d}"

    # Créer un contenu ACK CWR
    ack_content = (
        "HDRPB008912345EDITIONS SOLSTICES MUSIC                      01.102026111617000020261116\n"
        "GRHACK0000102.100000000000\n"
        f"ACK00000001000000010000000100000000NWRRA2026111612000020261116  {cocv1}  {title1:<36}  {iswc1_clean}\n"
        f"ACK00000002000000010000000100000001NWRRE2026111612000020261116                {title2:<36}  {iswc2_clean}\n"
        "EXC0000000200000002301TDISCORDANCE DES REPARTITIONS CWR\n"
        "ACK00000003000000010000000100000002NWRRA2026111612000020261116  123123123123  INCONNUE AU CATALOGUE                 \n"
        "TRL000010000000300000006\n"
    )

    response = client.post(
        "/api/v1/works/import-cwr-ack",
        data={"raw_content": ack_content, "dry_run": "false"},
    )
    assert response.status_code == 200
    report = response.json()

    # Re-requêter depuis la base
    session.rollback()
    session.expire_all()

    assert report["items"][0]["work_id"] == str(work1.id)
    assert report["total_transactions"] == 3
    assert report["registered_count"] == 1
    assert report["rejected_count"] == 1
    assert report["unmatched_count"] == 1

    # Re-requêter depuis une nouvelle session
    from app.core.database import engine
    with Session(engine) as fresh_session:
        w1_db = fresh_session.get(Work, work1.id)
        w2_db = fresh_session.get(Work, work2.id)

        assert w1_db.sacem_registration_status == "REGISTERED"
        assert w1_db.sacem_work_code == cocv1
        assert w1_db.sacem_registered_at is not None
        assert len(w1_db.timeline_notes) >= 1
        assert "accepté" in w1_db.timeline_notes[-1]["text"].lower()

        assert w2_db.sacem_registration_status == "REJECTED"
        assert "Déséquilibre" in (w2_db.sacem_rejection_reason or "")
        assert len(w2_db.timeline_notes) >= 1
        assert "rejet" in w2_db.timeline_notes[-1]["text"].lower()

        # Nettoyage
        fresh_session.delete(w1_db)
        fresh_session.delete(w2_db)
        fresh_session.commit()
