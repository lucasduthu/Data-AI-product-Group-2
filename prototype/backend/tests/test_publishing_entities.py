from uuid import uuid4
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.database import engine
from app.main import app
from app.models.publishing_entity import PublishingEntity
from app.models.work import Work

client = TestClient(app)


def test_list_and_seed_entities():
    """Vérifie la présence de l'entité éditoriale initiale par défaut configurée."""
    response = client.get("/api/v1/entities")
    assert response.status_code == 200
    entities = response.json()
    assert len(entities) >= 1

    default_ent = next(e for e in entities if e["is_default"] is True)
    assert default_ent["sacem_ipi"] in ("00891234567", "146348565", "00146348565")
    assert any(n in default_ent["name"] for n in ("Solstices", "KAPTAIN", "UNE MUSIQUE"))


def test_create_and_partition_works_by_entity():
    """Vérifie le cloisonnement étanche des œuvres selon l'entité active."""
    # 1. Créer une nouvelle entité tierce
    res_create = client.post(
        "/api/v1/entities",
        json={
            "name": "TF1 DROITS AUDIOVISUELS",
            "legal_name": "TF1 DROITS AUDIOVISUELS SAS",
            "sacem_ipi": "00998877665",
            "cwr_sender_code": "TF1AUDIO",
            "color": "#10B981",
            "description": "Production exécutive et musiques de commande TF1",
            "is_default": False,
        },
    )
    assert res_create.status_code == 201
    new_entity = res_create.json()
    new_entity_id = new_entity["id"]

    # 2. Récupérer l'entité par défaut
    entities = client.get("/api/v1/entities").json()
    default_ent = next(e for e in entities if e["is_default"] is True)
    default_id = default_ent["id"]

    # 3. Créer une œuvre sur TF1 DROITS AUDIOVISUELS
    res_work = client.post(
        "/api/v1/works",
        headers={"X-Entity-Id": new_entity_id},
        json={
            "title": "Thème TF1 Édition Spéciale",
            "splits": [
                {
                    "holder_name": "Compositeur TF1",
                    "role": "C",
                    "ipi_number": "00458912301",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                },
                {
                    "holder_name": "TF1 DROITS AUDIOVISUELS",
                    "role": "E",
                    "ipi_number": "00998877665",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                },
            ],
        },
    )
    assert res_work.status_code == 201
    created_work = res_work.json()
    assert created_work["title"] == "Thème TF1 Édition Spéciale"

    # 4. Vérifier que l'œuvre apparaît quand on filtre par la nouvelle entité
    res_filtered = client.get(f"/api/v1/works?entity_id={new_entity_id}")
    assert res_filtered.status_code == 200
    works_in_entity = res_filtered.json()
    assert any(w["title"] == "Thème TF1 Édition Spéciale" for w in works_in_entity)

    # 5. Créer une seconde entité tierce et vérifier que l'œuvre n'y apparaît PAS
    res_second = client.post(
        "/api/v1/entities",
        json={
            "name": "UNE MUSIQUE",
            "sacem_ipi": "00123456789",
            "is_default": False,
        },
    )
    assert res_second.status_code == 201
    second_ent_id = res_second.json()["id"]

    res_second_works = client.get(f"/api/v1/works?entity_id={second_ent_id}")
    assert res_second_works.status_code == 200
    assert not any(w["title"] == "Thème TF1 Édition Spéciale" for w in res_second_works.json())

    # 6. Vérifier l'adaptation CWR de l'entité émettrice
    cwr_export = client.get(
        f"/api/v1/works/export/cwr?entity_id={new_entity_id}&work_ids={created_work['id']}"
    )
    assert cwr_export.status_code == 200
    cwr_data = cwr_export.json()
    assert "content" in cwr_data
    # L'en-tête HDR ou le split SPU doit porter l'IPI 00998877665 de TF1 DROITS AUDIOVISUELS
    assert "00998877665" in cwr_data["content"]
