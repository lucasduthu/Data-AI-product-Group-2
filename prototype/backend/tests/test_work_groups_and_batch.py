import unittest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.core.database import get_session
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink


class TestWorkGroupsAndBatch(unittest.TestCase):
    def setUp(self) -> None:
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

    def test_work_groups_and_batch_operations_flow(self) -> None:
        # 1. Créer 2 œuvres tests
        w1_resp = self.client.post(
            "/api/v1/works",
            json={
                "title": "Générique Début DNA",
                "splits": [
                    {
                        "holder_name": "Julien Delacroix",
                        "role": "C",
                        "ipi_number": "00623489120",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                    },
                    {
                        "holder_name": "Ancien Éditeur",
                        "role": "E",
                        "ipi_number": "00111111111",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                    },
                ],
            },
        )
        self.assertEqual(w1_resp.status_code, 201)
        w1_id = w1_resp.json()["id"]

        w2_resp = self.client.post(
            "/api/v1/works",
            json={
                "title": "Thème Chloé & Alex",
                "splits": [
                    {
                        "holder_name": "Julien Delacroix",
                        "role": "C",
                        "ipi_number": "00623489120",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                    },
                    {
                        "holder_name": "Ancien Éditeur",
                        "role": "E",
                        "ipi_number": "00111111111",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                    },
                ],
            },
        )
        self.assertEqual(w2_resp.status_code, 201)
        w2_id = w2_resp.json()["id"]

        # 2. Créer un groupe / projet audiovisuel TF1
        group_resp = self.client.post(
            "/api/v1/work-groups",
            json={
                "name": "Demain Nous Appartient - Saison 8",
                "group_type": "SERIE_TV",
                "production_company": "Telfrance / Newen Studios",
                "broadcaster_or_client": "TF1",
                "release_year": 2025,
                "notes": "Feuilleton quotidien TF1 - Diffusion 19h10",
            },
        )
        self.assertEqual(group_resp.status_code, 201)
        group_id = group_resp.json()["id"]
        self.assertEqual(group_resp.json()["broadcaster_or_client"], "TF1")

        # 3. Effectuer une modification par batch :
        # - Rattachement au projet TF1
        # - Statut d'administration vers UNDER_ADMIN
        # - Référence contrat CTR-TF1-2025-DNA
        # - Ajout d'une annotation collective
        # - CIBLAGE D'AYANT DROIT : Remplacer "Ancien Éditeur" par "Éditions Solstices Music" avec le bon IPI
        batch_resp = self.client.post(
            "/api/v1/works/batch",
            json={
                "work_ids": [w1_id, w2_id],
                "assign_to_group_id": group_id,
                "cue_usage_type": "GÉNÉRIQUE",
                "administration_status": "UNDER_ADMIN",
                "contract_reference": "CTR-TF1-2025-DNA",
                "append_timeline_note": {
                    "author": "Juridique TF1 / Solstices",
                    "text": "Rachat de catalogue éditorial validé par avenant n°2.",
                },
                "target_holder_update": {
                    "target_holder_name_or_ipi": "Ancien Éditeur",
                    "new_holder_name": "Éditions Solstices Music",
                    "new_ipi_number": "00891234567",
                },
            },
        )
        self.assertEqual(batch_resp.status_code, 200)
        batch_result = batch_resp.json()
        self.assertEqual(batch_result["updated_works_count"], 2)

        # 4. Vérifier les œuvres après modification par batch
        w1_after = self.client.get(f"/api/v1/works/{w1_id}").json()
        self.assertEqual(w1_after["administration_status"], "UNDER_ADMIN")
        self.assertEqual(w1_after["contract_reference"], "CTR-TF1-2025-DNA")
        self.assertEqual(len(w1_after["groups"]), 1)
        self.assertEqual(w1_after["groups"][0]["name"], "Demain Nous Appartient - Saison 8")
        self.assertEqual(w1_after["groups"][0]["broadcaster_or_client"], "TF1")
        self.assertEqual(len(w1_after["timeline_notes"]), 1)
        self.assertEqual(w1_after["timeline_notes"][0]["author"], "Juridique TF1 / Solstices")

        # Vérifier que l'ayant droit cible a été mis à jour sur l'œuvre 1
        splits_1 = w1_after["splits"]
        publisher_split_1 = [s for s in splits_1 if s["role"] == "E"][0]
        self.assertEqual(publisher_split_1["holder_name"], "Éditions Solstices Music")
        self.assertEqual(publisher_split_1["ipi_number"], "00891234567")

        # Vérifier que l'ayant droit cible a été mis à jour sur l'œuvre 2
        w2_after = self.client.get(f"/api/v1/works/{w2_id}").json()
        splits_2 = w2_after["splits"]
        publisher_split_2 = [s for s in splits_2 if s["role"] == "E"][0]
        self.assertEqual(publisher_split_2["holder_name"], "Éditions Solstices Music")
        self.assertEqual(publisher_split_2["ipi_number"], "00891234567")

        # 5. Vérifier le filtrage du catalogue par groupe
        filter_resp = self.client.get(f"/api/v1/works?group_id={group_id}")
        self.assertEqual(filter_resp.status_code, 200)
        filtered_works = filter_resp.json()
        self.assertEqual(len(filtered_works), 2)

    def test_work_group_contract_inheritance_and_cwr_filtering(self) -> None:
        """Vérifie l'héritage de contrat vers les œuvres d'un projet et le filtrage CWR."""
        # 1. Créer une œuvre sans contrat
        w_resp = self.client.post(
            "/api/v1/works",
            json={
                "title": "Thème Principal Série Policière",
                "splits": [
                    {
                        "holder_name": "Alice Martin",
                        "role": "AC",
                        "ipi_number": "00123456789",
                        "society_name": "SACEM",
                        "society_de": "SACEM",
                        "society_dr": "SDRM",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "ipi_number": "00891234567",
                        "society_name": "SACEM",
                        "society_de": "SACEM",
                        "society_dr": "SACEM",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                    },
                ],
            },
        )
        self.assertEqual(w_resp.status_code, 201)
        w_id = w_resp.json()["id"]

        # 2. Créer un WorkGroup avec contrat cadre
        group_resp = self.client.post(
            "/api/v1/work-groups",
            json={
                "name": "Engrenages Saison 9",
                "group_type": "SERIE_TV",
                "contract_reference": "CTR-CANAL-ENG-09",
                "broadcaster_or_client": "CANAL+",
                "initial_work_ids": [w_id],
            },
        )
        self.assertEqual(group_resp.status_code, 201)
        group_id = group_resp.json()["id"]
        self.assertEqual(group_resp.json()["contract_reference"], "CTR-CANAL-ENG-09")

        # Vérifier que l'œuvre a hérité du contrat du groupe
        w_after = self.client.get(f"/api/v1/works/{w_id}").json()
        self.assertEqual(w_after["contract_reference"], "CTR-CANAL-ENG-09")

        # 3. Tester l'application rétroactive d'héritage
        retro_resp = self.client.post(
            f"/api/v1/work-groups/{group_id}/apply-inheritance",
            params={"apply_contract_ref": True, "apply_default_splits": False},
        )
        self.assertEqual(retro_resp.status_code, 200)
        self.assertEqual(retro_resp.json()["contract_reference"], "CTR-CANAL-ENG-09")

        # 4. Tester l'export CWR filtré par groupe
        cwr_resp = self.client.get(f"/api/v1/works/export/cwr?work_group_id={group_id}")
        self.assertEqual(cwr_resp.status_code, 200)
        cwr_data = cwr_resp.json()
        self.assertEqual(cwr_data["included_works_count"], 1)
        self.assertIn("ENGRENAGES", cwr_data["filename"])
        self.assertIn("THÈME PRINCIPAL SÉRIE POLICIÈRE", cwr_data["content"].upper())


if __name__ == "__main__":
    unittest.main()
