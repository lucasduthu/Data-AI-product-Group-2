import unittest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.task import DashboardTask


class TestDashboardTasksAndDeadlines(unittest.TestCase):
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

    def test_tasks_crud_and_toggle(self) -> None:
        """Vérifie la création, récupération, bascule et suppression des tâches (US-5.17)."""
        # 1. Premier appel : auto-initialisation avec les tâches par défaut
        resp = self.client.get("/api/v1/dashboard/tasks")
        self.assertEqual(resp.status_code, 200)
        tasks = resp.json()
        self.assertGreaterEqual(len(tasks), 3)

        # 2. Création d'une tâche personnalisée
        new_task_payload = {
            "title": "Vérifier dispense URSSAF compositeur Marc",
            "category": "CONTRAT",
            "priority": "HIGH",
            "due_date": "2026-12-15",
        }
        create_resp = self.client.post("/api/v1/dashboard/tasks", json=new_task_payload)
        self.assertEqual(create_resp.status_code, 201)
        created_task = create_resp.json()
        self.assertEqual(created_task["title"], "Vérifier dispense URSSAF compositeur Marc")
        self.assertFalse(created_task["is_completed"])
        task_id = created_task["id"]

        # 3. Bascule (toggle)
        toggle_resp = self.client.patch(f"/api/v1/dashboard/tasks/{task_id}/toggle")
        self.assertEqual(toggle_resp.status_code, 200)
        self.assertTrue(toggle_resp.json()["is_completed"])

        # Re-toggle
        toggle_resp2 = self.client.patch(f"/api/v1/dashboard/tasks/{task_id}/toggle")
        self.assertEqual(toggle_resp2.status_code, 200)
        self.assertFalse(toggle_resp2.json()["is_completed"])

        # 4. Suppression
        del_resp = self.client.delete(f"/api/v1/dashboard/tasks/{task_id}")
        self.assertEqual(del_resp.status_code, 204)

        # Vérification qu'elle n'existe plus
        get_resp = self.client.get("/api/v1/dashboard/tasks")
        ids = [t["id"] for t in get_resp.json()]
        self.assertNotIn(task_id, ids)

    def test_dashboard_deadlines(self) -> None:
        """Vérifie le calcul de l'échéancier réglementaire SACEM et sous-édition (US-5.17)."""
        resp = self.client.get("/api/v1/dashboard/deadlines")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertIn("next_sacem_distribution", data)
        self.assertIn("name", data["next_sacem_distribution"])
        self.assertIn("days_remaining", data["next_sacem_distribution"])
        self.assertGreaterEqual(data["next_sacem_distribution"]["days_remaining"], 0)

        self.assertIn("subpublisher_deadlines", data)
        self.assertGreaterEqual(len(data["subpublisher_deadlines"]), 2)
