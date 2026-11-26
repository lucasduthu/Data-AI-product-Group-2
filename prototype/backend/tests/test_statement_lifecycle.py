import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.contract import Contract, RoyaltyLedgerEntry
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work


class TestStatementLifecycle(unittest.TestCase):
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

        # Créer une œuvre et un ayant droit pour le test
        with Session(self.engine) as session:
            work = Work(
                title="Clara Theme",
                iswc="T-999.001.001-1",
                splits=[
                    {
                        "holder_name": "Sami Benali",
                        "role": "AC",
                        "ipi_number": "00398765432",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "share_percentage": "50.00",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "ipi_number": "00268165052",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "share_percentage": "50.00",
                    },
                ],
            )
            session.add(work)

            holder = RightHolderDirectory(
                full_name="Sami Benali",
                ipi_number="00398765432",
                entity_type="PERSONNE_PHYSIQUE",
                iban="FR7630006000011234567890189",
            )
            session.add(holder)

            stmt = RoyaltyStatement(
                source_name="Relevé SACEM 2026-S1",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("200.00"),
                currency="EUR",
                accounting_status="DRAFT",
            )
            session.add(stmt)
            session.commit()
            session.refresh(stmt)
            session.refresh(work)

            line = StatementLine(
                statement_id=stmt.id,
                row_number=1,
                raw_work_title="Clara Theme",
                raw_iswc="T-999.001.001-1",
                gross_amount=Decimal("200.00"),
                currency="EUR",
                right_type="DEP",
                exploitation_type="PUBLIC_PERFORMANCE",
                matched_work_id=work.id,
                matched_work_title=work.title,
                validation_status="VALIDATED",
                allocations=[
                    {
                        "holder_name": "Sami Benali",
                        "role": "AC",
                        "ipi_number": "00398765432",
                        "right_type": "DEP",
                        "share_percentage": "50.00",
                        "allocated_amount": "100.00",
                        "recouped_amount": "0.00",
                        "net_payable_amount": "100.00",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "ipi_number": "00268165052",
                        "right_type": "DEP",
                        "share_percentage": "50.00",
                        "allocated_amount": "100.00",
                        "recouped_amount": "0.00",
                        "net_payable_amount": "100.00",
                    },
                ],
            )
            session.add(line)
            session.commit()
            self.statement_id = str(stmt.id)
            self.line_id = str(line.id)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_complete_accounting_lifecycle(self) -> None:
        # 1. Vérification de l'état initial DRAFT
        resp = self.client.get(f"/api/v1/statements/{self.statement_id}")
        self.assertEqual(resp.status_code, 200)
        stmt_data = resp.json()
        self.assertEqual(stmt_data["accounting_status"], "DRAFT")
        self.assertIsNone(stmt_data["locked_at"])
        self.assertIsNone(stmt_data["integrity_hash"])

        # 2. Simulation idempotente (DRAFT)
        calc_resp = self.client.post(f"/api/v1/statements/{self.statement_id}/compute-royalties")
        self.assertEqual(calc_resp.status_code, 200)
        calc_data = calc_resp.json()
        self.assertEqual(calc_data["accounting_status"], "DRAFT")
        self.assertFalse(calc_data["is_locked"])

        # 3. Clôture comptable (DRAFT ➔ LOCKED) avec génération du certificat d'intégrité
        lock_resp = self.client.post(f"/api/v1/statements/{self.statement_id}/lock-and-post")
        self.assertEqual(lock_resp.status_code, 200)
        lock_data = lock_resp.json()
        self.assertEqual(lock_data["accounting_status"], "LOCKED")
        self.assertTrue(lock_data["is_locked"])
        self.assertIsNotNone(lock_data["locked_at"])
        self.assertIsNotNone(lock_data["integrity_hash"])
        self.assertEqual(len(lock_data["integrity_hash"]), 64)  # SHA-256 hexdigest

        # Vérifier que les écritures ont été créées au Grand Livre
        with Session(self.engine) as session:
            entries = list(session.exec(select(RoyaltyLedgerEntry)).all())
            self.assertGreaterEqual(len(entries), 1)

        # 4. Modification de ligne bloquée en mode LOCKED
        mod_resp = self.client.post(
            f"/api/v1/statements/lines/{self.line_id}/validate",
            json={"approve": True},
        )
        self.assertEqual(mod_resp.status_code, 409)

        # 5. Réouverture en DRAFT (LOCKED ➔ DRAFT)
        reopen_resp = self.client.post(f"/api/v1/statements/{self.statement_id}/reopen-draft")
        self.assertEqual(reopen_resp.status_code, 200)
        reopen_data = reopen_resp.json()
        self.assertEqual(reopen_data["accounting_status"], "DRAFT")
        self.assertFalse(reopen_data["is_locked"])
        self.assertIsNone(reopen_data["integrity_hash"])

        # Vérifier que le Grand Livre a été purgé
        with Session(self.engine) as session:
            entries_after = list(session.exec(select(RoyaltyLedgerEntry)).all())
            self.assertEqual(len(entries_after), 0)

        # 6. Re-verrouillage (DRAFT ➔ LOCKED)
        lock_again = self.client.post(f"/api/v1/statements/{self.statement_id}/lock-and-post")
        self.assertEqual(lock_again.status_code, 200)
        self.assertEqual(lock_again.json()["accounting_status"], "LOCKED")

        # 7. Règlement bancaire effectif (LOCKED ➔ PAID)
        pay_payload = {
            "payment_date": "2026-11-10",
            "payment_method": "VIREMENT_SEPA",
            "payment_reference": "VIR-SEPA-2026-S1-001",
            "payment_notes": "Règlements SEPA validés par la banque",
        }
        pay_resp = self.client.post(
            f"/api/v1/statements/{self.statement_id}/mark-as-paid",
            json=pay_payload,
        )
        self.assertEqual(pay_resp.status_code, 200)
        pay_data = pay_resp.json()
        self.assertEqual(pay_data["accounting_status"], "PAID")
        self.assertTrue(pay_data["is_locked"])
        self.assertIsNotNone(pay_data["paid_at"])
        self.assertEqual(pay_data["payment_reference"], "VIR-SEPA-2026-S1-001")
        self.assertEqual(pay_data["payment_method"], "VIREMENT_SEPA")

        # 8. Réouverture interdite une fois PAID (409 Conflict)
        reopen_paid_resp = self.client.post(f"/api/v1/statements/{self.statement_id}/reopen-draft")
        self.assertEqual(reopen_paid_resp.status_code, 409)

        # 9. Suppression interdite une fois PAID (409 Conflict)
        del_resp = self.client.delete(f"/api/v1/statements/{self.statement_id}")
        self.assertEqual(del_resp.status_code, 409)
