import unittest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.common import ValidationStatus
from app.schemas.royalty import AdvanceRecoupmentState
from app.services.holder_statement_generator import generate_individual_holder_statement


class TestAdvancedStatements(unittest.TestCase):
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

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_generator_grouping_by_project(self) -> None:
        state = AdvanceRecoupmentState(
            holder_name="Claire Fontaine",
            role="CA",
            ipi_number="00331234567",
            contract_reference="CTR-TF1-2026",
            gross_royalties_allocated=Decimal("3500.00"),
            initial_advance=Decimal("1000.00"),
            previously_recouped=Decimal("0.00"),
            recouped_in_period=Decimal("1000.00"),
            remaining_unrecouped_balance=Decimal("0.00"),
            net_payable_amount=Decimal("2500.00"),
        )
        line_details = [
            {
                "work_title": "Générique Saison 1",
                "right_type": "DEP",
                "gross_amount": "2000.00",
                "share_percentage": "50.00",
                "allocated_amount": "1000.00",
                "territory": "FR",
                "work_group_title": "Demain nous appartient (TF1)",
            },
            {
                "work_title": "Thème Amour et Drame",
                "right_type": "DRM",
                "gross_amount": "3000.00",
                "share_percentage": "50.00",
                "allocated_amount": "1500.00",
                "territory": "FR",
                "work_group_title": "Demain nous appartient (TF1)",
            },
            {
                "work_title": "Single Indépendant",
                "right_type": "DEP",
                "gross_amount": "2000.00",
                "share_percentage": "50.00",
                "allocated_amount": "1000.00",
                "territory": "FR",
                "work_group_title": "Catalogue Général / Hors Projet",
            },
        ]

        doc = generate_individual_holder_statement(
            holder_state=state,
            publisher_name="Éditions Solstices",
            publisher_ipi="00891234567",
            statement_source="SACEM_2026_Q3.csv",
            period_start="2026-07-01",
            period_end="2026-09-30",
            line_details=line_details,
            group_by="PROJECT",
            language="FR",
        )

        self.assertEqual(doc["group_by"], "PROJECT")
        self.assertEqual(len(doc["groups"]), 2)
        # Groups sorted by key
        group_tf1 = next(g for g in doc["groups"] if "TF1" in g["group_key"])
        self.assertEqual(group_tf1["total_allocated"], "2500.00")
        self.assertEqual(group_tf1["works_count"], 2)

        group_general = next(g for g in doc["groups"] if "Catalogue" in g["group_key"])
        self.assertEqual(group_general["total_allocated"], "1000.00")
        self.assertEqual(group_general["works_count"], 1)

        # Verify CSV has group header comments
        self.assertIn("# SOUS-TOTAL [Projet / Série TV : Demain nous appartient (TF1)]", doc["csv_content"])
        # Verify printable text contains project breakdown
        self.assertIn("DEMAIN NOUS APPARTIENT (TF1)", doc["printable_text"])

    def test_generator_grouping_by_territory(self) -> None:
        state = AdvanceRecoupmentState(
            holder_name="Marc Morel",
            role="C",
            gross_royalties_allocated=Decimal("800.00"),
            net_payable_amount=Decimal("800.00"),
        )
        line_details = [
            {
                "work_title": "Symphonie Urbaine",
                "right_type": "DEP",
                "gross_amount": "1000.00",
                "share_percentage": "50.00",
                "allocated_amount": "500.00",
                "territory": "FR",
                "work_group_title": "Projet A",
            },
            {
                "work_title": "Symphonie Urbaine",
                "right_type": "DEP",
                "gross_amount": "600.00",
                "share_percentage": "50.00",
                "allocated_amount": "300.00",
                "territory": "DE",
                "work_group_title": "Projet A",
            },
        ]
        doc = generate_individual_holder_statement(
            holder_state=state,
            publisher_name="Éditions Solstices",
            publisher_ipi="00891234567",
            statement_source="SACEM_2026_Q3.csv",
            period_start="2026-07-01",
            period_end="2026-09-30",
            line_details=line_details,
            group_by="TERRITORY",
            language="FR",
        )
        self.assertEqual(len(doc["groups"]), 2)
        de_group = next(g for g in doc["groups"] if g["group_key"] == "DE")
        self.assertIn("Allemagne", de_group["group_label"])
        self.assertEqual(de_group["total_allocated"], "300.00")

    def test_bilingual_english_presentation(self) -> None:
        state = AdvanceRecoupmentState(
            holder_name="John Doe",
            role="A",
            ipi_number="00112233445",
            contract_reference="CTR-EN-2026",
            gross_royalties_allocated=Decimal("1200.00"),
            net_payable_amount=Decimal("1200.00"),
        )
        line_details = [
            {
                "work_title": "London Fog",
                "right_type": "SYNC",
                "gross_amount": "2400.00",
                "share_percentage": "50.00",
                "allocated_amount": "1200.00",
                "territory": "GB",
                "work_group_title": "BBC Series",
            }
        ]
        doc = generate_individual_holder_statement(
            holder_state=state,
            publisher_name="Solstices Publishing",
            publisher_ipi="00891234567",
            statement_source="SACEM_2026_Q3.csv",
            period_start="2026-07-01",
            period_end="2026-09-30",
            line_details=line_details,
            group_by="RIGHT_TYPE",
            language="EN",
        )
        self.assertEqual(doc["language"], "EN")
        self.assertIn("INDIVIDUAL ROYALTY & COPYRIGHT STATEMENT", doc["printable_text"])
        self.assertIn("RIGHTS CATEGORY: SYNCHRONIZATION RIGHTS (SYNC)", doc["printable_text"])
        self.assertIn("NET PAYABLE AMOUNT (EUR)", doc["printable_text"])
        self.assertIn("NET PAYABLE VIA BANK WIRE", doc["csv_content"])
        self.assertIn("# INDIVIDUAL ROYALTY STATEMENT", doc["csv_content"])

    def test_zero_lines_filtering(self) -> None:
        state = AdvanceRecoupmentState(
            holder_name="Léa Vasseur",
            role="CA",
            gross_royalties_allocated=Decimal("500.00"),
            net_payable_amount=Decimal("500.00"),
        )
        line_details = [
            {
                "work_title": "Oeuvre Active",
                "right_type": "DEP",
                "gross_amount": "1000.00",
                "share_percentage": "50.00",
                "allocated_amount": "500.00",
                "territory": "FR",
            },
            {
                "work_title": "Oeuvre Inactive (Solde Nul)",
                "right_type": "DRM",
                "gross_amount": "0.00",
                "share_percentage": "50.00",
                "allocated_amount": "0.00",
                "territory": "FR",
            },
        ]
        # With hide_zero_lines=True
        doc_filtered = generate_individual_holder_statement(
            holder_state=state,
            publisher_name="Éditions Solstices",
            publisher_ipi="00891234567",
            statement_source="SACEM_2026_Q3.csv",
            period_start="2026-07-01",
            period_end="2026-09-30",
            line_details=line_details,
            hide_zero_lines=True,
        )
        self.assertEqual(doc_filtered["filtered_lines_count"], 1)
        self.assertEqual(doc_filtered["total_lines_count"], 2)

        # With hide_zero_lines=False
        doc_all = generate_individual_holder_statement(
            holder_state=state,
            publisher_name="Éditions Solstices",
            publisher_ipi="00891234567",
            statement_source="SACEM_2026_Q3.csv",
            period_start="2026-07-01",
            period_end="2026-09-30",
            line_details=line_details,
            hide_zero_lines=False,
        )
        self.assertEqual(doc_all["filtered_lines_count"], 2)

    def test_api_endpoint_advanced_statement_parameters(self) -> None:
        with Session(self.engine) as session:
            # Créer un ayant droit dans l'annuaire
            dh = RightHolderDirectory(
                full_name="Alexandre Dumas",
                ipi_number="00789012345",
                entity_type="PERSONNE_PHYSIQUE",
            )
            session.add(dh)

            # Créer un groupe d'œuvres (Projet)
            group = WorkGroup(name="Les Trois Mousquetaires (Série)")
            session.add(group)
            session.flush()

            # Créer une œuvre
            work = Work(
                title="Générique Dumas",
                iswc="T-001.002.003-4",
                splits=[
                    {"holder_name": "Alexandre Dumas", "role": "AC", "share_percentage": "50.00"},
                    {"holder_name": "Éditions Solstices", "role": "E", "share_percentage": "50.00"},
                ],
            )
            session.add(work)
            session.flush()

            # Lier l'œuvre au groupe
            link = WorkGroupLink(work_id=work.id, work_group_id=group.id)
            session.add(link)

            # Créer un relevé
            stmt = RoyaltyStatement(
                source_name="SACEM_2026_TEST.csv",
                file_type="SACEM_CSV",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 9, 30),
                total_gross_amount=Decimal("1000.00"),
                accounting_status="DRAFT",
            )
            session.add(stmt)
            session.flush()

            line = StatementLine(
                statement_id=stmt.id,
                raw_work_title="Générique Dumas",
                matched_work_id=work.id,
                matched_work_title=work.title,
                right_type="DEP",
                territory="FR",
                gross_amount=Decimal("1000.00"),
                validation_status=ValidationStatus.VALIDATED.value,
            )
            session.add(line)
            session.commit()
            stmt_id = stmt.id

        # Call endpoint with advanced parameters
        response = self.client.get(
            f"/api/v1/statements/{stmt_id}/holder-report/Alexandre Dumas?lang=EN&group_by=PROJECT&hide_zero_lines=true"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["language"], "EN")
        self.assertEqual(data["group_by"], "PROJECT")
        self.assertIn("Les Trois Mousquetaires (Série)", str(data["groups"]))
        self.assertIn("INDIVIDUAL ROYALTY & COPYRIGHT STATEMENT", data["printable_text"])
