import unittest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.core.database import get_session
from app.models.work import Work


class TestWorkNotesAndMetadata(unittest.TestCase):
    def setUp(self) -> None:
        # Configuration base SQLite en mémoire isolée pour les tests
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)

        def get_test_session():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[get_session] = get_test_session
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_create_work_with_rich_metadata_and_notes(self) -> None:
        payload = {
            "title": "Symphonie Urbaine",
            "subtitle": "Urban Symphony (Sacem Subtitle)",
            "alternate_titles": ["Urban Symphony", "Radio Mix"],
            "iswc": "T-309.112.334-8",
            "isrc_codes": ["FRZ012609999"],
            "performers": ["Camille Moreau"],
            "genre": "Électro / Symphonique",
            "duration_seconds": 245,
            "creation_year": 2025,
            "administration_status": "ACTIVE",
            "contract_reference": "CTR-ED-2025-099",
            "general_notes": "Note éditoriale initiale : dépôt CWR programmé.",
            "splits": [
                {
                    "holder_name": "Camille Moreau",
                    "role": "AC",
                    "ipi_number": "00458912301",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "sync_share_pct": "50.00",
                    "phono_share_pct": "20.00",
                    "share_percentage": "50.00",
                },
                {
                    "holder_name": "Éditions Solstices Music",
                    "role": "E",
                    "ipi_number": "00891234567",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "sync_share_pct": "50.00",
                    "phono_share_pct": "80.00",
                    "share_percentage": "50.00",
                },
            ],
        }

        # 1. Création de l'œuvre
        response = self.client.post("/api/v1/works", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        created = response.json()
        work_id = created["id"]
        self.assertEqual(created["title"], "Symphonie Urbaine")
        self.assertEqual(created["subtitle"], "Urban Symphony (Sacem Subtitle)")
        self.assertEqual(created["genre"], "Électro / Symphonique")
        self.assertEqual(created["duration_seconds"], 245)
        self.assertEqual(created["creation_year"], 2025)
        self.assertEqual(created["administration_status"], "ACTIVE")
        self.assertEqual(created["contract_reference"], "CTR-ED-2025-099")
        self.assertEqual(created["general_notes"], "Note éditoriale initiale : dépôt CWR programmé.")
        self.assertEqual(created["timeline_notes"], [])

        # 2. Ajout d'une annotation au fil chronologique
        note_payload = {
            "author": "Sophie Laurent (Directrice Juridique)",
            "text": "Contrat de cession contresigné et archivé. Dépôt Sacem validé.",
        }
        note_resp = self.client.post(f"/api/v1/works/{work_id}/notes", json=note_payload)
        self.assertEqual(note_resp.status_code, 200, note_resp.text)
        updated_work = note_resp.json()
        self.assertEqual(len(updated_work["timeline_notes"]), 1)
        first_note = updated_work["timeline_notes"][0]
        self.assertEqual(first_note["author"], "Sophie Laurent (Directrice Juridique)")
        self.assertEqual(first_note["text"], "Contrat de cession contresigné et archivé. Dépôt Sacem validé.")
        self.assertIn("created_at", first_note)
        self.assertIn("id", first_note)

        # 3. Ajout d'une deuxième annotation et vérification de l'ordre antéchronologique
        note_payload_2 = {
            "author": "Marc Duval (A&R)",
            "text": "Demande de synchronisation reçue pour une série Netflix.",
        }
        note_resp_2 = self.client.post(f"/api/v1/works/{work_id}/notes", json=note_payload_2)
        self.assertEqual(note_resp_2.status_code, 200, note_resp_2.text)
        updated_work_2 = note_resp_2.json()
        self.assertEqual(len(updated_work_2["timeline_notes"]), 2)
        # La plus récente est en premier
        self.assertEqual(updated_work_2["timeline_notes"][0]["author"], "Marc Duval (A&R)")
        self.assertEqual(updated_work_2["timeline_notes"][1]["author"], "Sophie Laurent (Directrice Juridique)")


if __name__ == "__main__":
    unittest.main()
