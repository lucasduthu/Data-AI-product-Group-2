import unittest
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.schemas.common import ValidationStatus


class TestBlackBoxGateway(unittest.TestCase):
    """Tests US-5.2 : Passerelle Black Box (Création d'œuvre 1-clic & Tri par montant décroissant)."""

    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)

        def get_session_override():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[get_session] = get_session_override
        self.client = TestClient(app)

        self.statement_id = uuid4()
        self.line1_id = uuid4()
        self.line2_id = uuid4()
        self.line3_id = uuid4()

        with Session(self.engine) as session:
            statement = RoyaltyStatement(
                id=self.statement_id,
                source_name="SACEM T1 2026 Test",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 3, 31),
                total_gross_amount=Decimal("4500.00"),
                currency="EUR",
                accounting_status="DRAFT",
            )
            session.add(statement)

            line1 = StatementLine(
                id=self.line1_id,
                statement_id=self.statement_id,
                row_number=1,
                raw_work_title="PETIT TITRE STREAM",
                raw_iswc=None,
                raw_isrc="FRZ012609999",
                raw_performer="Artiste Inconnu",
                right_type="DEP",
                gross_amount=Decimal("15.50"),
                validation_status=ValidationStatus.PENDING_REVIEW.value,
            )
            line2 = StatementLine(
                id=self.line2_id,
                statement_id=self.statement_id,
                row_number=2,
                raw_work_title="GROS HIT ORPHELIN RADIO",
                raw_iswc=None,
                raw_isrc="FRZ012608888",
                raw_performer="Star Du Moment",
                right_type="DEP",
                gross_amount=Decimal("3800.00"),
                validation_status=ValidationStatus.PENDING_REVIEW.value,
            )
            line3 = StatementLine(
                id=self.line3_id,
                statement_id=self.statement_id,
                row_number=3,
                raw_work_title="TITRE MOYEN SYNCHRO",
                raw_iswc=None,
                raw_isrc=None,
                raw_performer="Indie Band",
                right_type="SYNC",
                gross_amount=Decimal("684.50"),
                validation_status=ValidationStatus.PENDING_REVIEW.value,
            )
            session.add(line1)
            session.add(line2)
            session.add(line3)
            session.commit()

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_get_statement_lines_sorted_by_gross_amount_desc(self) -> None:
        """Vérifie que sort_by=gross_amount_desc retourne les lignes par montant décroissant (loi de Pareto)."""
        res = self.client.get(
            f"/api/v1/statements/{self.statement_id}/lines?sort_by=gross_amount_desc"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 3)
        self.assertEqual(data[0]["raw_work_title"], "GROS HIT ORPHELIN RADIO")
        self.assertEqual(float(data[0]["gross_amount"]), 3800.00)
        self.assertEqual(data[1]["raw_work_title"], "TITRE MOYEN SYNCHRO")
        self.assertEqual(float(data[1]["gross_amount"]), 684.50)
        self.assertEqual(data[2]["raw_work_title"], "PETIT TITRE STREAM")
        self.assertEqual(float(data[2]["gross_amount"]), 15.50)

    def test_create_work_and_match_statement_line_success(self) -> None:
        """Vérifie la création 1-clic d'une œuvre depuis une ligne orpheline et validation immédiate."""
        payload = {
            "title": "Gros Hit Orphelin Radio",
            "performers": ["Star Du Moment"],
            "genre": "Pop / Variété",
            "isrc_codes": ["FRZ012608888"],
            "splits": [
                {
                    "holder_name": "Star Du Moment",
                    "role": "AC",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "sync_share_pct": "50.00",
                    "phono_share_pct": "50.00",
                    "share_percentage": "50.00",
                },
                {
                    "holder_name": "TF1 DROITS AUDIOVISUELS",
                    "role": "E",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "sync_share_pct": "50.00",
                    "phono_share_pct": "50.00",
                    "share_percentage": "50.00",
                },
            ],
            "validated_by": "alice@editions-tf1.fr",
        }

        res = self.client.post(
            f"/api/v1/statements/{self.statement_id}/lines/{self.line2_id}/create-work-and-match",
            json=payload,
        )
        self.assertEqual(res.status_code, 200)
        matched_line = res.json()

        self.assertEqual(matched_line["validation_status"], "VALIDATED")
        self.assertEqual(matched_line["confidence_score"], 1.0)
        self.assertEqual(matched_line["match_method"], "MANUAL")
        self.assertEqual(matched_line["matched_work_title"], "Gros Hit Orphelin Radio")
        self.assertIsNotNone(matched_line["matched_work_id"])

        # Vérifie le calcul déterministe des allocations (50% de 3800 = 1900€ par ayant droit)
        allocations = matched_line["allocations"]
        self.assertEqual(len(allocations), 2)
        star_alloc = next(a for a in allocations if a["holder_name"] == "Star Du Moment")
        tf1_alloc = next(a for a in allocations if a["holder_name"] == "TF1 DROITS AUDIOVISUELS")
        self.assertEqual(float(star_alloc["allocated_amount"]), 1900.00)
        self.assertEqual(float(tf1_alloc["allocated_amount"]), 1900.00)

        # Vérifie que l'œuvre a été persistée au catalogue avec son embedding et son titre alternatif
        with Session(self.engine) as session:
            work = session.get(Work, UUID(matched_line["matched_work_id"]))
            self.assertIsNotNone(work)
            self.assertEqual(work.title, "Gros Hit Orphelin Radio")
            self.assertIn("GROS HIT ORPHELIN RADIO", work.alternate_titles)
            self.assertIn("Star Du Moment", work.performers)

    def test_create_work_and_match_on_locked_statement_returns_409(self) -> None:
        """Vérifie qu'un décompte LOCKED refuse la création d'œuvre et la mutation de ligne."""
        with Session(self.engine) as session:
            stmt = session.get(RoyaltyStatement, self.statement_id)
            stmt.accounting_status = "LOCKED"
            session.add(stmt)
            session.commit()

        payload = {
            "title": "Titre Rejeté",
            "splits": [],
        }
        res = self.client.post(
            f"/api/v1/statements/{self.statement_id}/lines/{self.line1_id}/create-work-and-match",
            json=payload,
        )
        self.assertEqual(res.status_code, 409)
        self.assertIn("LOCKED", res.json()["detail"])

    def test_create_work_and_match_on_paid_statement_returns_409(self) -> None:
        """Vérifie qu'un décompte PAID refuse la création d'œuvre et la mutation de ligne."""
        with Session(self.engine) as session:
            stmt = session.get(RoyaltyStatement, self.statement_id)
            stmt.accounting_status = "PAID"
            session.add(stmt)
            session.commit()

        payload = {
            "title": "Titre Rejeté Paid",
            "splits": [],
        }
        res = self.client.post(
            f"/api/v1/statements/{self.statement_id}/lines/{self.line1_id}/create-work-and-match",
            json=payload,
        )
        self.assertEqual(res.status_code, 409)
        self.assertIn("PAID", res.json()["detail"])

    def test_create_work_and_match_empty_title_returns_400(self) -> None:
        """Vérifie qu'un titre vide ou constitué uniquement d'espaces retourne une erreur 400."""
        res = self.client.post(
            f"/api/v1/statements/{self.statement_id}/lines/{self.line1_id}/create-work-and-match",
            json={"title": "   ", "splits": []},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("titre", res.json()["detail"].lower())

    def test_create_work_and_match_sanitizes_whitespace_to_none(self) -> None:
        """Vérifie que les chaînes vides ou espaces sur ISWC, SACEM, Cotage et Subtitle sont bien stockées en None."""
        payload = {
            "title": "Titre Avec Espaces Vides",
            "subtitle": "   ",
            "iswc": "   ",
            "sacem_work_code": "   ",
            "cotage_number": "   ",
            "splits": [],
        }
        res = self.client.post(
            f"/api/v1/statements/{self.statement_id}/lines/{self.line1_id}/create-work-and-match",
            json=payload,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        with Session(self.engine) as session:
            work = session.get(Work, UUID(data["matched_work_id"]))
            self.assertIsNotNone(work)
            self.assertIsNone(work.subtitle)
            self.assertIsNone(work.iswc)
            self.assertIsNone(work.sacem_work_code)
            self.assertIsNone(work.cotage_number)

    def test_create_work_and_match_mismatched_statement_id_returns_404(self) -> None:
        """Vérifie qu'un appel avec un statement_id incohérent avec la ligne retourne 404."""
        other_statement_id = uuid4()
        res = self.client.post(
            f"/api/v1/statements/{other_statement_id}/lines/{self.line1_id}/create-work-and-match",
            json={"title": "Titre Incohérent"},
        )
        self.assertEqual(res.status_code, 404)

    def test_create_work_and_match_not_found(self) -> None:
        """Vérifie le retour 404 sur ligne inexistante."""
        res = self.client.post(
            f"/api/v1/statements/{self.statement_id}/lines/{uuid4()}/create-work-and-match",
            json={"title": "N'importe quoi"},
        )
        self.assertEqual(res.status_code, 404)
