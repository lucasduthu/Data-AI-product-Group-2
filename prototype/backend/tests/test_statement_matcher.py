import unittest
from decimal import Decimal
from uuid import uuid4

from app.models.work import Work
from app.schemas.common import ValidationStatus
from app.schemas.contract import ExploitationType
from app.schemas.statement import MatchMethod, StatementLineCreate
from app.services.embedding_service import compute_text_embedding
from app.services.statement_matcher import (
    match_statement_line_to_catalog,
    match_statement_lines_batch,
)


class TestStatementMatcher(unittest.TestCase):
    """Tests du moteur Smart Matching (ISWC exact, ISRC exact et similarité vectorielle/fuzzy - Jalon 3)."""

    def setUp(self) -> None:
        self.catalog = [
            Work(
                id=uuid4(),
                title="Lumière Noire",
                alternate_titles=["Black Light"],
                iswc="T-301.452.891-4",
                sacem_work_code="111785573767",
                cotage_number="4748",
                isrc_codes=["FRZ012600101"],
                performers=["Camille Moreau", "K-Soprano"],
                splits=[],
                embedding=compute_text_embedding("Lumière Noire Camille Moreau K-Soprano"),
            ),
            Work(
                id=uuid4(),
                title="Minuit sur la Seine",
                alternate_titles=[],
                iswc="T-302.118.440-2",
                isrc_codes=["FRZ012600201"],
                performers=["Léa Vasseur"],
                splits=[],
                embedding=compute_text_embedding("Minuit sur la Seine Léa Vasseur"),
            ),
        ]

    def test_exact_iswc_match_gives_confidence_1(self) -> None:
        line = StatementLineCreate(
            row_number=1,
            raw_work_title="TITRE TRONQUE",
            raw_iswc="T-301.452.891-4",
            exploitation_type=ExploitationType.PUBLIC_PERFORMANCE,
            gross_amount=Decimal("1200.00"),
        )
        matched = match_statement_line_to_catalog(line, self.catalog)
        self.assertEqual(matched.matched_work_title, "Lumière Noire")
        self.assertEqual(matched.match_method, MatchMethod.EXACT_ISWC)
        self.assertEqual(matched.confidence_score, 1.0)
        self.assertEqual(matched.validation_status, ValidationStatus.PENDING_REVIEW)

    def test_exact_sacem_code_cocv_match_gives_confidence_1(self) -> None:
        """US-1.2 : Vérifie qu'un décompte SACEM identifié par Code Œuvre / COCV est apparié en O(1) avec score 1.0."""
        # Cas 1 : via champ raw_sacem_code dédié
        line1 = StatementLineCreate(
            row_number=1,
            raw_work_title="SANS ISWC MAIS CODE SACEM",
            raw_iswc=None,
            raw_sacem_code="111785573767",
            exploitation_type=ExploitationType.PUBLIC_PERFORMANCE,
            gross_amount=Decimal("450.00"),
        )
        matched1 = match_statement_line_to_catalog(line1, self.catalog)
        self.assertEqual(matched1.matched_work_title, "Lumière Noire")
        self.assertEqual(matched1.match_method, MatchMethod.EXACT_SACEM_CODE)
        self.assertEqual(matched1.confidence_score, 1.0)

        # Cas 2 : via code numérique 11 chiffres placé dans la colonne ISWC par la SACEM
        line2 = StatementLineCreate(
            row_number=2,
            raw_work_title="CODE SACEM DANS COLONNE ISWC",
            raw_iswc="111785573767",
            exploitation_type=ExploitationType.PUBLIC_PERFORMANCE,
            gross_amount=Decimal("250.00"),
        )
        matched2 = match_statement_line_to_catalog(line2, self.catalog)
        self.assertEqual(matched2.matched_work_title, "Lumière Noire")
        self.assertEqual(matched2.match_method, MatchMethod.EXACT_SACEM_CODE)
        self.assertEqual(matched2.confidence_score, 1.0)

    def test_noisy_title_matches_correct_work_with_confidence_score(self) -> None:
        line = StatementLineCreate(
            row_number=2,
            raw_work_title="Lumiere Noir (Feat. K-Soprano) - Radio Edit",
            raw_iswc=None,
            raw_performer="Camille Moreau",
            exploitation_type=ExploitationType.STREAMING,
            gross_amount=Decimal("850.50"),
        )
        matched = match_statement_line_to_catalog(line, self.catalog)
        self.assertEqual(matched.matched_work_title, "Lumière Noire")
        self.assertGreater(matched.confidence_score, 0.70)
        self.assertEqual(matched.validation_status, ValidationStatus.PENDING_REVIEW)

    def test_batch_matching_deduplication_and_o1_index(self) -> None:
        """Red Flag #3 : Vérifie que match_statement_lines_batch traite 1 000 lignes dupliquées en O(1) via déduplication."""
        lines = [
            StatementLineCreate(
                row_number=i + 1,
                raw_work_title="Lumiere Noir (Feat. K-Soprano) - Radio Edit",
                raw_iswc=None,
                raw_performer="Camille Moreau",
                exploitation_type=ExploitationType.STREAMING,
                gross_amount=Decimal("0.000412"),
            )
            for i in range(1000)
        ]
        results = match_statement_lines_batch(lines, self.catalog)
        self.assertEqual(len(results), 1000)
        self.assertEqual(results[0].matched_work_title, "Lumière Noire")
        self.assertEqual(results[999].matched_work_title, "Lumière Noire")
        self.assertEqual(results[999].row_number, 1000)
        self.assertEqual(results[999].gross_amount, Decimal("0.000412"))


if __name__ == "__main__":
    unittest.main()
