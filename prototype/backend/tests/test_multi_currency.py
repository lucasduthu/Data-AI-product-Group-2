import io
import unittest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.contract import RoyaltyLedgerEntry
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.models.workspace_settings import DEFAULT_CURRENCY_RATES, WorkspaceSettings
from app.schemas.common import ValidationStatus
from app.schemas.royalty import AdvanceRecoupmentState
from app.services.holder_statement_generator import generate_individual_holder_statement


class TestMultiCurrency(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)

        def get_session_override():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[get_session] = get_session_override
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_currency_parities_endpoints(self) -> None:
        # 1. GET /currencies
        response = self.client.get("/api/v1/settings/currencies")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data), 5)
        usd = next(c for c in data if c["currency"] == "USD")
        self.assertEqual(usd["symbol"], "$")
        self.assertIn("1.085", str(usd["rate_bce"]))

        # 2. PUT /currencies (Add or update currency)
        new_rate = {
            "currency": "SEK",
            "label": "Couronne Suédoise (SEK)",
            "symbol": "kr",
            "rate_to_eur": "0.088000",
            "rate_bce": "11.363636",
            "effective_date": "2026-06-30",
            "source": "Sveriges Riksbank",
        }
        put_resp = self.client.put("/api/v1/settings/currencies", json=new_rate)
        self.assertEqual(put_resp.status_code, 200)
        updated_data = put_resp.json()
        self.assertTrue(any(c["currency"] == "SEK" for c in updated_data))

        # 3. POST /convert
        conv_req = {
            "amount": "1000.00",
            "from_currency": "USD",
            "to_currency": "EUR",
        }
        conv_resp = self.client.post("/api/v1/settings/convert", json=conv_req)
        self.assertEqual(conv_resp.status_code, 200)
        conv_data = conv_resp.json()
        self.assertEqual(conv_data["source_currency"], "USD")
        self.assertEqual(conv_data["target_currency"], "EUR")
        # 1000 * 0.921659 = 921.66 EUR
        self.assertEqual(conv_data["target_amount"], "921.66")
        self.assertIn("921.66 EUR", conv_data["formula"])

        # 4. POST /currencies/reset-bce
        reset_resp = self.client.post("/api/v1/settings/currencies/reset-bce")
        self.assertEqual(reset_resp.status_code, 200)
        reset_data = reset_resp.json()
        # SEK should no longer be present in default BCE
        self.assertFalse(any(c["currency"] == "SEK" for c in reset_data))

    def test_statement_upload_usd_currency_conversion(self) -> None:
        with Session(self.engine) as session:
            # Créer une œuvre
            work = Work(
                title="Atlantic Sunset",
                iswc="T-999.888.777-1",
                splits=[
                    {"holder_name": "Léa Vasseur", "role": "AC", "share_percentage": "50.00"},
                    {"holder_name": "Éditions Solstices", "role": "E", "share_percentage": "50.00"},
                ],
            )
            session.add(work)
            session.commit()

        # CSV en USD
        csv_content = (
            "work_title,iswc,right_type,exploitation_type,territory,gross_amount\n"
            "Atlantic Sunset,T-999.888.777-1,DEP,STREAMING,US,1000.00\n"
            "Atlantic Sunset,T-999.888.777-1,DRM,STREAMING,US,2000.00\n"
        )
        file_obj = io.BytesIO(csv_content.encode("utf-8"))

        # Upload en spécifiant USD et taux personnalisé (ex: 0.900000 pour 1 USD = 0.90 EUR)
        upload_resp = self.client.post(
            "/api/v1/statements/upload",
            data={
                "source_name": "Spotify US 2026",
                "currency": "USD",
                "exchange_rate": "0.900000",
            },
            files={"file": ("spotify_us.csv", file_obj, "text/csv")},
        )
        self.assertEqual(upload_resp.status_code, 201)
        data = upload_resp.json()
        self.assertEqual(data["source_currency"], "USD")
        self.assertEqual(data["exchange_rate"], "0.900000")
        self.assertEqual(data["source_gross_amount"], "3000.00")
        # 3000 USD * 0.90 = 2700.00 EUR
        self.assertEqual(data["total_gross_amount"], "2700.00")

        # Vérification des lignes
        lines = data["lines"]
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[0]["source_currency"], "USD")
        self.assertEqual(Decimal(str(lines[0]["source_gross_amount"])), Decimal("1000.00"))
        self.assertEqual(Decimal(str(lines[0]["gross_amount"])), Decimal("900.00"))
        self.assertEqual(Decimal(str(lines[1]["source_gross_amount"])), Decimal("2000.00"))
        self.assertEqual(Decimal(str(lines[1]["gross_amount"])), Decimal("1800.00"))

    def test_locked_statement_records_multi_currency_on_ledger(self) -> None:
        with Session(self.engine) as session:
            work = Work(
                title="London Underground",
                iswc="T-123.456.789-0",
                splits=[
                    {"holder_name": "Arthur Pendelton", "role": "AC", "share_percentage": "50.00"},
                    {"holder_name": "Éditions Solstices", "role": "E", "share_percentage": "50.00"},
                ],
            )
            session.add(work)
            session.flush()

            stmt = RoyaltyStatement(
                source_name="PRS for Music (UK)",
                file_type="CSV",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 9, 30),
                source_currency="GBP",
                exchange_rate=Decimal("1.169591"),
                source_gross_amount=Decimal("1000.00"),
                total_gross_amount=Decimal("1169.59"),
                accounting_status="DRAFT",
            )
            session.add(stmt)
            session.flush()

            line = StatementLine(
                statement_id=stmt.id,
                raw_work_title="London Underground",
                matched_work_id=work.id,
                matched_work_title=work.title,
                right_type="DEP",
                territory="GB",
                source_currency="GBP",
                exchange_rate=Decimal("1.169591"),
                source_gross_amount=Decimal("1000.00"),
                gross_amount=Decimal("1169.59"),
                validation_status=ValidationStatus.VALIDATED.value,
            )
            session.add(line)
            session.commit()
            stmt_id = stmt.id

        # Clôture du relevé (POST /lock-and-post)
        lock_resp = self.client.post(f"/api/v1/statements/{stmt_id}/lock-and-post")
        self.assertEqual(lock_resp.status_code, 200)

        # Vérification des écritures Grand Livre (RoyaltyLedgerEntry)
        with Session(self.engine) as session:
            entries = session.exec(
                select(RoyaltyLedgerEntry).where(RoyaltyLedgerEntry.statement_id == stmt_id)
            ).all()
            self.assertGreaterEqual(len(entries), 1)
            arthur_entry = next(e for e in entries if "Arthur" in e.holder_name)
            self.assertEqual(arthur_entry.source_currency, "GBP")
            self.assertEqual(str(arthur_entry.exchange_rate), "1.169591")
            self.assertIsNotNone(arthur_entry.source_gross_allocated)

    def test_generator_multi_currency_statement(self) -> None:
        state = AdvanceRecoupmentState(
            holder_name="Bob Marley",
            role="AC",
            ipi_number="00012345678",
            contract_reference="CTR-INT-2026",
            source_currency="USD",
            exchange_rate=Decimal("0.921659"),
            source_gross_royalties_allocated=Decimal("2000.00"),
            gross_royalties_allocated=Decimal("1843.32"),
            net_payable_amount=Decimal("1843.32"),
        )
        doc = generate_individual_holder_statement(
            holder_state=state,
            publisher_name="Éditions Solstices",
            publisher_ipi="00891234567",
            statement_source="Spotify US Q3.csv",
            period_start="2026-07-01",
            period_end="2026-09-30",
            language="FR",
        )
        self.assertEqual(doc["source_currency"], "USD")
        self.assertEqual(doc["exchange_rate"], "0.921659")
        self.assertIn("Devise d'origine : USD | Taux de change appliqué : 1 USD = 0.921659 EUR", doc["csv_content"])
        self.assertIn("Devise d'origine   : USD (Taux BCE appliqué : 1 USD = 0.921659 EUR)", doc["printable_text"])


if __name__ == "__main__":
    unittest.main()
