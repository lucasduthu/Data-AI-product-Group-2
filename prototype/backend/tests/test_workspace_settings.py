import unittest
from decimal import Decimal
from uuid import uuid4

from app.models.work import Work
from app.schemas.contract import ExploitationType
from app.schemas.royalty import AdvanceRecoupmentState
from app.schemas.statement import MatchMethod, StatementLineCreate
from app.schemas.workspace_settings import WorkspaceSettingsUpdate
from app.services.cwr_validator import validate_work_cwr
from app.services.embedding_service import compute_text_embedding
from app.services.holder_statement_generator import generate_individual_holder_statement
from app.services.statement_matcher import match_statement_line_to_catalog


class TestWorkspaceSettingsAndPhase2(unittest.TestCase):
    """Tests unitaires pour les Jalons 6 à 9 (Configuration, Alias appris, Édition CWR, Relevé individuel)."""

    def test_workspace_settings_normalizes_matching_weights(self) -> None:
        ws = WorkspaceSettingsUpdate(
            publisher_name="Éditions Solstices Music",
            publisher_ipi="00891234567",
            cwr_sender_code="SOLSTICES",
            max_publisher_dep_pct=Decimal("60.00"),
            min_payment_threshold=Decimal("75.00"),
            statement_messages={"paid_fr": "Règlement OK"},
            vector_weight=0.60,
            lexical_weight=0.60,
        )
        self.assertAlmostEqual(ws.vector_weight + ws.lexical_weight, 1.0, places=2)
        self.assertEqual(ws.max_publisher_dep_pct, Decimal("60.00"))
        self.assertEqual(ws.min_payment_threshold, Decimal("75.00"))
        self.assertEqual(ws.statement_messages["paid_fr"], "Règlement OK")

    def test_custom_max_publisher_dep_pct_is_respected_by_cwr_validator(self) -> None:
        splits = [
            {
                "holder_name": "Auteur",
                "role": "A",
                "ipi_number": "00458912301",
                "dep_share_pct": Decimal("40.00"),
                "drm_share_pct": Decimal("40.00"),
            },
            {
                "holder_name": "Éditeur Anglo-Saxon",
                "role": "E",
                "ipi_number": "00891234567",
                "dep_share_pct": Decimal("60.00"),
                "drm_share_pct": Decimal("60.00"),
            },
        ]
        # Avec plafond standard 50% -> bloqué
        rep_default = validate_work_cwr(
            work_title="Work UK",
            splits=splits,
            iswc="T-301.452.891-4",
            max_publisher_dep_pct=Decimal("50.00"),
        )
        self.assertFalse(rep_default.is_cwr_ready)

        # Avec plafond personnalisé 60% -> prêt CWR
        rep_custom = validate_work_cwr(
            work_title="Work UK",
            splits=splits,
            iswc="T-301.452.891-4",
            max_publisher_dep_pct=Decimal("60.00"),
        )
        self.assertTrue(rep_custom.is_cwr_ready)

    def test_learned_alias_gives_high_confidence_match(self) -> None:
        work = Work(
            id=uuid4(),
            title="Lumière Noire",
            alternate_titles=["LUMIERE NOIR (VERSION TIKTOK 2026)"],
            iswc="T-301.452.891-4",
            isrc_codes=[],
            performers=["Camille Moreau"],
            splits=[],
            embedding=compute_text_embedding("Lumière Noire LUMIERE NOIR (VERSION TIKTOK 2026)"),
        )
        line = StatementLineCreate(
            row_number=1,
            raw_work_title="LUMIERE NOIR (VERSION TIKTOK 2026)",
            exploitation_type=ExploitationType.STREAMING,
            gross_amount=Decimal("500.00"),
        )
        matched = match_statement_line_to_catalog(line, [work])
        self.assertEqual(matched.match_method, MatchMethod.LEARNED_ALIAS)
        self.assertEqual(matched.confidence_score, 0.98)

    def test_individual_holder_statement_generator_computes_vat_and_csv(self) -> None:
        state = AdvanceRecoupmentState(
            holder_name="Léa Vasseur",
            role="A",
            ipi_number="00512398741",
            contract_reference="CTR-2026-MS02",
            gross_royalties_allocated=Decimal("2000.00"),
            initial_advance=Decimal("500.00"),
            previously_recouped=Decimal("0.00"),
            recouped_in_period=Decimal("500.00"),
            remaining_unrecouped_balance=Decimal("0.00"),
            net_payable_amount=Decimal("1500.00"),
        )
        doc = generate_individual_holder_statement(
            holder_state=state,
            publisher_name="Éditions Solstices Music",
            publisher_ipi="00891234567",
            statement_source="SACEM Q3",
            period_start="2026-07-01",
            period_end="2026-09-30",
            vat_rate_pct=Decimal("10.00"),
        )
        self.assertEqual(doc["net_payable_ht"], "1500.00")
        self.assertEqual(doc["vat_amount"], "150.00")
        self.assertEqual(doc["net_payable_ttc"], "1650.00")
        self.assertIn("Net a Payer TTC,1650.00", doc["csv_content"])


if __name__ == "__main__":
    unittest.main()
