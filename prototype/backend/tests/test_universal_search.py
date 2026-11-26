"""Tests unitaires et d'intégration pour l'endpoint de recherche universelle Omnibar (US-5.10)."""

from decimal import Decimal
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.database import get_session, init_db
from app.main import app
from app.models.contract import Contract
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.work import RightHolderRole, RightHolderSplit


@pytest.fixture
def client_and_session():
    init_db()
    client = TestClient(app)
    session_gen = app.dependency_overrides.get(get_session, get_session)
    session = next(session_gen())
    yield client, session


def test_search_empty_query(client_and_session):
    """Vérifie qu'une recherche vide retourne 0 résultat sans erreur."""
    client, _ = client_and_session
    response = client.get("/api/v1/search?q=")
    assert response.status_code == 200
    data = response.json()
    assert data["total_results"] == 0
    assert data["works"] == []
    assert data["holders"] == []
    assert data["contracts"] == []
    assert data["groups"] == []


def test_search_works_by_title_iswc_cocv(client_and_session):
    """Vérifie la recherche d'œuvres par titre, ISWC ou Code SACEM (COCV)."""
    client, session = client_and_session
    uid = uuid4().hex[:6].upper()

    work = Work(
        title=f"OMNIBAR THEME {uid}",
        subtitle="Version Générique TF1",
        iswc=f"T-777.{uid[:3]}.001-1",
        sacem_work_code=f"88{uid[:4]}99",
        cotage_number=f"COT-{uid}",
        splits=[
            RightHolderSplit(
                holder_name="OMNIBAR COMPOSER",
                role=RightHolderRole.C,
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ).model_dump(mode="json")
        ],
    )
    session.add(work)
    session.commit()

    # 1. Recherche par titre
    res_title = client.get(f"/api/v1/search?q=OMNIBAR THEME {uid}")
    assert res_title.status_code == 200
    data_title = res_title.json()
    assert len(data_title["works"]) >= 1
    assert data_title["works"][0]["title"] == f"OMNIBAR THEME {uid}"

    # 2. Recherche par ISWC
    res_iswc = client.get(f"/api/v1/search?q=T-777.{uid[:3]}")
    assert res_iswc.status_code == 200
    data_iswc = res_iswc.json()
    assert any(w["id"] == str(work.id) for w in data_iswc["works"])

    # 3. Recherche par Code SACEM
    res_cocv = client.get(f"/api/v1/search?q=88{uid[:4]}99")
    assert res_cocv.status_code == 200
    data_cocv = res_cocv.json()
    assert any(w["id"] == str(work.id) for w in data_cocv["works"])

    # Nettoyage
    session.delete(work)
    session.commit()


def test_search_holders_contracts_and_groups(client_and_session):
    """Vérifie la recherche multi-entités croisée."""
    client, session = client_and_session
    uid = uuid4().hex[:6].upper()
    tag = f"KOROM_{uid}"

    # 1. Ayant droit
    holder = RightHolderDirectory(
        full_name=f"Jean {tag} Dupont",
        stage_name_or_trade_name=f"DJ {tag}",
        ipi_number=f"007{uid[:4]}01",
        primary_role="CA",
        affiliated_society="SACEM",
    )
    # 2. Contrat
    contract = Contract(
        contract_reference=f"CTR-{tag}-01",
        sacem_contract_number=f"SCM-{uid}",
        counterparty_name=f"Jean {tag} Dupont",
        publisher_name="SOLSTICES MUSIC",
        work_titles=[f"Chanson {tag} A", f"Chanson {tag} B"],
    )
    # 3. Projet TF1
    group = WorkGroup(
        name=f"Série {tag} Fiction TF1",
        group_type="SERIE_TV",
        broadcaster_or_client="TF1",
        contract_reference=f"CTR-{tag}-01",
    )

    session.add(holder)
    session.add(contract)
    session.add(group)
    session.commit()

    # Recherche transverse avec le tag unique
    res = client.get(f"/api/v1/search?q={tag}")
    assert res.status_code == 200
    data = res.json()

    assert data["total_results"] >= 3
    assert any(h["full_name"] == f"Jean {tag} Dupont" for h in data["holders"])
    assert any(c["contract_reference"] == f"CTR-{tag}-01" for c in data["contracts"])
    assert any(g["name"] == f"Série {tag} Fiction TF1" for g in data["groups"])

    # Nettoyage
    session.delete(holder)
    session.delete(contract)
    session.delete(group)
    session.commit()
