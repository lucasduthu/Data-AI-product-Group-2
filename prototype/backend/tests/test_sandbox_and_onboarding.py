import unittest
from fastapi.testclient import TestClient

from app.main import app


class TestSandboxAndOnboarding(unittest.TestCase):
    """Tests unitaires pour l'Assistant d'Onboarding et le Bac à sable réinitialisable (US-5.6)."""

    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_sandbox_reset_and_status(self) -> None:
        # Purge complète du bac à sable
        resp_reset = self.client.post("/api/v1/sandbox/reset")
        self.assertEqual(resp_reset.status_code, 200)
        data_reset = resp_reset.json()
        self.assertEqual(data_reset["status"], "success")
        self.assertEqual(data_reset["works_count"], 0)
        self.assertEqual(data_reset["contracts_count"], 0)

        # Vérification du statut sur base vierge
        resp_status = self.client.get("/api/v1/sandbox/status")
        self.assertEqual(resp_status.status_code, 200)
        status_data = resp_status.json()
        self.assertTrue(status_data["is_empty"])
        self.assertEqual(status_data["total_works"], 0)
        self.assertEqual(status_data["total_contracts"], 0)
        self.assertEqual(status_data["total_holders"], 0)
        self.assertFalse(status_data["onboarding_completed"])
        self.assertFalse(status_data["onboarding_dismissed"])
        self.assertEqual(status_data["onboarding_completed_steps"], [])

    def test_sandbox_load_demo_and_reset(self) -> None:
        # 1. Chargement du catalogue démo
        resp_load = self.client.post("/api/v1/sandbox/load-demo")
        self.assertEqual(resp_load.status_code, 200)
        data_load = resp_load.json()
        self.assertEqual(data_load["status"], "success")
        self.assertGreaterEqual(data_load["works_count"], 30)
        self.assertGreaterEqual(data_load["contracts_count"], 4)
        self.assertGreaterEqual(data_load["holders_count"], 9)
        self.assertGreaterEqual(data_load["work_groups_count"], 3)
        self.assertGreaterEqual(data_load["statements_count"], 1)

        # 2. Vérification que le statut n'est plus vide
        resp_status = self.client.get("/api/v1/sandbox/status")
        self.assertEqual(resp_status.status_code, 200)
        status_data = resp_status.json()
        self.assertFalse(status_data["is_empty"])
        self.assertGreaterEqual(status_data["total_works"], 30)
        self.assertTrue(status_data["onboarding_completed"])
        self.assertIn("step_catalog", status_data["onboarding_completed_steps"])

        # 3. Vérification des œuvres et groupes TF1
        resp_works = self.client.get("/api/v1/works")
        self.assertEqual(resp_works.status_code, 200)
        works = resp_works.json()
        self.assertGreaterEqual(len(works), 30)
        dna_work = next((w for w in works if "DNA" in w["title"]), None)
        self.assertIsNotNone(dna_work)
        self.assertEqual(dna_work["cotage_number"], "KFC674-01")

        # 4. Vérification des contrats
        resp_contracts = self.client.get("/api/v1/contracts")
        self.assertEqual(resp_contracts.status_code, 200)
        contracts = resp_contracts.json()
        self.assertGreaterEqual(len(contracts), 4)

        # 5. Purge finale du bac à sable pour laisser la base vierge
        resp_reset2 = self.client.post("/api/v1/sandbox/reset")
        self.assertEqual(resp_reset2.status_code, 200)

        resp_status_after = self.client.get("/api/v1/sandbox/status")
        self.assertTrue(resp_status_after.json()["is_empty"])

    def test_onboarding_persistence_endpoint(self) -> None:
        # Mise à jour des étapes d'onboarding
        payload = {
            "completed": False,
            "dismissed": True,
            "completed_steps": ["step_identity", "step_catalog"],
        }
        resp = self.client.post("/api/v1/settings/onboarding", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["onboarding_completed"])
        self.assertTrue(data["onboarding_dismissed"])
        self.assertEqual(data["onboarding_completed_steps"], ["step_identity", "step_catalog"])

        # Vérification via GET /api/v1/settings
        resp_get = self.client.get("/api/v1/settings")
        self.assertEqual(resp_get.status_code, 200)
        get_data = resp_get.json()
        self.assertTrue(get_data["onboarding_dismissed"])
        self.assertEqual(get_data["onboarding_completed_steps"], ["step_identity", "step_catalog"])

    def test_sandbox_load_demo_is_idempotent(self) -> None:
        # Premier chargement
        resp1 = self.client.post("/api/v1/sandbox/load-demo")
        self.assertEqual(resp1.status_code, 200)
        data1 = resp1.json()
        self.assertEqual(data1["works_count"], 30)

        # Deuxième chargement immédiat (idempotence)
        resp2 = self.client.post("/api/v1/sandbox/load-demo")
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertEqual(data2["works_count"], 30)
        self.assertEqual(data2["contracts_count"], 4)
        self.assertEqual(data2["holders_count"], 9)
        self.assertEqual(data2["work_groups_count"], 3)
        self.assertEqual(data2["statements_count"], 1)

        # Remise à zéro
        self.client.post("/api/v1/sandbox/reset")

    def test_settings_iban_and_bic_update_empty_or_custom(self) -> None:
        # 1. Mise à jour avec IBAN et BIC personnalisés
        custom_payload = {
            "publisher_name": "Éditions Test Alpha",
            "publisher_ipi": "00998877665",
            "cwr_sender_code": "TESTALPHA",
            "publisher_iban": "FR7612345678901234567890123",
            "publisher_bic": "TESTFRPPXXX",
        }
        resp = self.client.put("/api/v1/settings", json=custom_payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["publisher_iban"], "FR7612345678901234567890123")
        self.assertEqual(data["publisher_bic"], "TESTFRPPXXX")
        self.assertIn("step_identity", data["onboarding_completed_steps"])

        # 2. Mise à jour avec IBAN vide pour vérifier qu'il ne se fait pas écraser par la valeur par défaut
        empty_iban_payload = {
            "publisher_name": "Éditions Test Alpha",
            "publisher_ipi": "00998877665",
            "cwr_sender_code": "TESTALPHA",
            "publisher_iban": "",
            "publisher_bic": "",
        }
        resp2 = self.client.put("/api/v1/settings", json=empty_iban_payload)
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertEqual(data2["publisher_iban"], "")
        self.assertEqual(data2["publisher_bic"], "")

        # 3. Restauration de l'identité par défaut
        restore_payload = {
            "publisher_name": "Éditions Solstices Music",
            "publisher_ipi": "00891234567",
            "cwr_sender_code": "SOLSTICES",
            "publisher_iban": "FR0830004019920005554443210",
            "publisher_bic": "BNPAFRPPXXX",
            "onboarding_completed_steps": [],
        }
        self.client.put("/api/v1/settings", json=restore_payload)


if __name__ == "__main__":
    unittest.main()
