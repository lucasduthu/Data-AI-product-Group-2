import unittest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink


class TestCatalogAuditAndRepair(unittest.TestCase):
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

    def test_catalog_audit_and_auto_repair(self) -> None:
        # 1. Préparer l'annuaire des ayants droit avec l'IPI de Clara Silvestre
        with Session(self.engine) as session:
            holder = RightHolderDirectory(
                full_name="Clara Silvestre",
                stage_name_or_trade_name="Clara S.",
                ipi_number="00789456123",
                society_de="SACEM",
                society_dr="SACEM",
            )
            session.add(holder)

            # Créer un projet audiovisuel avec contrat de référence
            group = WorkGroup(
                name="Série TF1 Demain Nous Appartient",
                group_type="SÉRIE TV",
                contract_reference="CTR-TF1-DNA-2026",
            )
            session.add(group)
            session.commit()
            session.refresh(group)
            group_id = group.id

        # 2. Créer une œuvre avec anomalies :
        # - Clara Silvestre SANS IPI
        # - Somme des clés légèrement déséquilibrée (99.99 % due à un arrondi)
        # - Rattachée au projet TF1 mais sans contract_reference
        w_resp = self.client.post(
            "/api/v1/works",
            json={
                "title": "Générique DNA Version 1",
                "splits": [
                    {
                        "holder_name": "Clara Silvestre",
                        "role": "AC",
                        "ipi_number": "",  # Manquant !
                        "dep_share_pct": "49.99",
                        "drm_share_pct": "49.99",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "ipi_number": "00891234567",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                    },
                ],
            },
        )
        self.assertEqual(w_resp.status_code, 201)
        work_id = w_resp.json()["id"]

        # Rattacher l'œuvre au groupe
        from uuid import UUID
        with Session(self.engine) as session:
            link = WorkGroupLink(work_id=UUID(work_id), work_group_id=group_id)
            session.add(link)
            session.commit()

        # 3. Lancer l'audit du catalogue
        audit_resp = self.client.get("/api/v1/works/audit")
        self.assertEqual(audit_resp.status_code, 200)
        audit_data = audit_resp.json()

        self.assertEqual(audit_data["total_works"], 1)
        self.assertEqual(audit_data["blocking_works_count"], 1)
        self.assertEqual(audit_data["healthy_works_count"], 0)
        self.assertEqual(audit_data["issues_by_category"]["MISSING_IPI"], 1)
        self.assertEqual(audit_data["issues_by_category"]["EQUILIBRIUM_ERROR"], 1)

        # 4. Exécuter l'auto-réparation
        repair_resp = self.client.post(
            "/api/v1/works/audit/auto-repair",
            json={
                "auto_fill_ipis_from_directory": True,
                "auto_balance_splits": True,
                "auto_inherit_project_contracts": True,
            },
        )
        self.assertEqual(repair_resp.status_code, 200)
        repair_data = repair_resp.json()

        self.assertEqual(repair_data["repaired_works_count"], 1)
        self.assertEqual(repair_data["repaired_ipis_count"], 1)
        self.assertEqual(repair_data["repaired_splits_count"], 2)  # DEP and DRM adjusted
        self.assertEqual(repair_data["repaired_contracts_count"], 1)  # Inherited from group

        # 5. Vérifier que l'œuvre a bien été mise à jour en base
        updated_w_resp = self.client.get(f"/api/v1/works/{work_id}")
        self.assertEqual(updated_w_resp.status_code, 200)
        w_data = updated_w_resp.json()

        # IPI Clara Silvestre injecté
        clara_split = [s for s in w_data["splits"] if s["holder_name"] == "Clara Silvestre"][0]
        self.assertEqual(clara_split["ipi_number"], "00789456123")

        # Contrat hérité du groupe TF1
        self.assertEqual(w_data["contract_reference"], "CTR-TF1-DNA-2026")

        # Clés DEP et DRM rééquilibrées à 100%
        dep_total = sum(Decimal(s["dep_share_pct"]) for s in w_data["splits"])
        drm_total = sum(Decimal(s["drm_share_pct"]) for s in w_data["splits"])
        self.assertEqual(dep_total, Decimal("100.00"))
        self.assertEqual(drm_total, Decimal("100.00"))

        # 6. Relancer l'audit : l'œuvre ne doit plus avoir d'erreur bloquante
        audit_resp2 = self.client.get("/api/v1/works/audit")
        self.assertEqual(audit_resp2.status_code, 200)
        audit_data2 = audit_resp2.json()
        self.assertEqual(audit_data2["blocking_works_count"], 0)
        self.assertEqual(audit_data2["issues_by_category"]["MISSING_IPI"], 0)
        self.assertEqual(audit_data2["issues_by_category"]["EQUILIBRIUM_ERROR"], 0)
