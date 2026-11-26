import unittest
from decimal import Decimal

from app.services.royalty_engine import (
    apply_advance_recoupment,
    calculate_line_allocations,
    finalize_period_holder_totals,
    resolve_canonical_holder_key,
)


class TestRoyaltyEngine(unittest.TestCase):
    """Tests mathématiques du moteur 100 % déterministe (Splits, Micro-centimes, Largest Remainder & Avances)."""

    def test_deterministic_split_sum_equals_gross_amount_exactly(self) -> None:
        splits = [
            {
                "holder_name": "Auteur 1",
                "role": "A",
                "ipi_number": "00111111111",
                "dep_share_pct": Decimal("33.33"),
                "drm_share_pct": Decimal("33.33"),
            },
            {
                "holder_name": "Compositeur 2",
                "role": "C",
                "ipi_number": "00222222222",
                "dep_share_pct": Decimal("33.33"),
                "drm_share_pct": Decimal("33.33"),
            },
            {
                "holder_name": "Éditeur 3",
                "role": "E",
                "ipi_number": "00333333333",
                "dep_share_pct": Decimal("33.34"),
                "drm_share_pct": Decimal("33.34"),
            },
        ]
        gross = Decimal("100.00")
        allocs = calculate_line_allocations(gross_amount=gross, splits=splits, right_type="DEP")
        total_allocated = sum((a.allocated_amount for a in allocs), Decimal("0.00"))
        self.assertEqual(total_allocated, gross)

    def test_micro_cent_streaming_lines_preserved_and_aggregated_accurately(self) -> None:
        """Red Flag #1 : Vérifie que les micro-lignes DSP (< 0.005 €) ne sont jamais écrasées à 0.00 €."""
        splits = [
            {"holder_name": "Camille Moreau", "role": "AC", "ipi_number": "00458912301", "drm_share_pct": Decimal("50.00")},
            {"holder_name": "Éditions Solstices", "role": "E", "ipi_number": "00891234567", "drm_share_pct": Decimal("50.00")},
        ]
        # 1 ligne unitaire Spotify à 0.000400 €
        micro_gross = Decimal("0.000400")
        allocs = calculate_line_allocations(gross_amount=micro_gross, splits=splits, right_type="DRM")
        self.assertEqual(allocs[0].exact_allocated_amount, Decimal("0.000200"))
        self.assertEqual(allocs[1].exact_allocated_amount, Decimal("0.000200"))

        # Cumul sur 10 000 lignes de 0.000400 € = 4.00 € au total
        exact_totals = {
            "ipi:00458912301": allocs[0].exact_allocated_amount * 10000,
            "ipi:00891234567": allocs[1].exact_allocated_amount * 10000,
        }
        period_rounded = finalize_period_holder_totals(
            exact_holder_totals=exact_totals,
            target_validated_gross=Decimal("4.000000"),
        )
        self.assertEqual(period_rounded["ipi:00458912301"], Decimal("2.00"))
        self.assertEqual(period_rounded["ipi:00891234567"], Decimal("2.00"))

    def test_largest_remainder_method_avoids_single_holder_distortion(self) -> None:
        """Red Flag #1 : Sur 0.05 € partagé en 33.33 / 33.33 / 33.34, distribue 0.01, 0.02, 0.02."""
        splits = [
            {"holder_name": "A1", "role": "A", "dep_share_pct": Decimal("33.33")},
            {"holder_name": "C2", "role": "C", "dep_share_pct": Decimal("33.33")},
            {"holder_name": "E3", "role": "E", "dep_share_pct": Decimal("33.34")},
        ]
        allocs = calculate_line_allocations(gross_amount=Decimal("0.05"), splits=splits, right_type="DEP")
        amounts = sorted(a.allocated_amount for a in allocs)
        self.assertEqual(amounts, [Decimal("0.01"), Decimal("0.02"), Decimal("0.02")])
        self.assertEqual(sum(amounts, Decimal("0.00")), Decimal("0.05"))

    def test_canonical_holder_key_matches_inverted_names_and_ipi(self) -> None:
        """Red Flag #2 : Garantit qu'une inversion 'Nom Prénom' vs 'Prénom Nom' ou un code IPI résout la même clé."""
        k1 = resolve_canonical_holder_key("Camille Moreau", ipi_number=None)
        k2 = resolve_canonical_holder_key("Moreau Camille", ipi_number=None)
        self.assertEqual(k1, k2)

        k_ipi_1 = resolve_canonical_holder_key("C. Moreau", ipi_number="458912301")
        k_ipi_2 = resolve_canonical_holder_key("Camille Moreau", ipi_number="00458912301")
        self.assertEqual(k_ipi_1, k_ipi_2)

    def test_advance_recoupment_partial_and_full(self) -> None:
        # Cas 1 : Avance non amortie = 1000 €, Royalties = 1250 € -> 1000 € retenus, 250 € net à payer
        state_full = apply_advance_recoupment(
            holder_name="Camille Moreau",
            gross_royalties_allocated=Decimal("1250.00"),
            initial_advance=Decimal("1500.00"),
            previously_recouped=Decimal("500.00"),
        )
        self.assertEqual(state_full.recouped_in_period, Decimal("1000.00"))
        self.assertEqual(state_full.remaining_unrecouped_balance, Decimal("0.00"))
        self.assertEqual(state_full.net_payable_amount, Decimal("250.00"))

        # Cas 2 : Avance non amortie = 5000 €, Royalties = 1200 € -> 1200 € retenus, 3800 € restant, 0 € net
        state_partial = apply_advance_recoupment(
            holder_name="Léa Vasseur",
            gross_royalties_allocated=Decimal("1200.00"),
            initial_advance=Decimal("5000.00"),
            previously_recouped=Decimal("0.00"),
        )
        self.assertEqual(state_partial.recouped_in_period, Decimal("1200.00"))
        self.assertEqual(state_partial.remaining_unrecouped_balance, Decimal("3800.00"))
        self.assertEqual(state_partial.net_payable_amount, Decimal("0.00"))

    def test_advance_recoupment_entity_types_fiscal_rules(self) -> None:
        """Vérifie la distinction stricte des règles financières selon le statut d'entité."""
        # 1. Personne physique standard (soumise au précompte social ~11,10%)
        pp_state = apply_advance_recoupment(
            holder_name="Auteur Solo",
            gross_royalties_allocated=Decimal("2000.00"),
            initial_advance=Decimal("0.00"),
            previously_recouped=Decimal("0.00"),
            entity_type="PERSONNE_PHYSIQUE",
            ircec_precompte_applicable=True,
            urssaf_dispense_certificate=False,
        )
        self.assertEqual(pp_state.taxable_base_ht, Decimal("2000.00"))
        self.assertEqual(pp_state.precompte_social_amount, Decimal("222.00"))  # 2000 * 0.1110
        self.assertEqual(pp_state.vat_amount, Decimal("0.00"))

        # 2. Société commerciale (0% précompte, TVA 10% applicable)
        soc_state = apply_advance_recoupment(
            holder_name="Éditions Alpha SAS",
            gross_royalties_allocated=Decimal("3000.00"),
            initial_advance=Decimal("0.00"),
            previously_recouped=Decimal("0.00"),
            entity_type="SOCIETE",
            vat_applicable=True,
            vat_rate_pct=Decimal("10.00"),
            ircec_precompte_applicable=False,
        )
        self.assertEqual(soc_state.taxable_base_ht, Decimal("3000.00"))
        self.assertEqual(soc_state.precompte_social_amount, Decimal("0.00"))
        self.assertEqual(soc_state.vat_amount, Decimal("300.00"))  # 3000 * 10%
        self.assertEqual(soc_state.net_payable_amount, Decimal("3300.00"))

        # 3. Personne physique avec dispense URSSAF BNC (0% précompte)
        dispense_state = apply_advance_recoupment(
            holder_name="Compositeur BNC",
            gross_royalties_allocated=Decimal("1500.00"),
            initial_advance=Decimal("0.00"),
            previously_recouped=Decimal("0.00"),
            entity_type="PERSONNE_PHYSIQUE",
            urssaf_dispense_certificate=True,
        )
        self.assertEqual(dispense_state.precompte_social_amount, Decimal("0.00"))
        self.assertEqual(dispense_state.net_payable_amount, Decimal("1500.00"))

    def test_min_payment_threshold_and_reserve_carry_forward(self) -> None:
        """US-2.1 & US-2.2 : Seuil minimal de paiement et report à nouveau des soldes en réserve."""
        # Période 1 : Redevances de 32.50 € (inférieur au seuil de 50.00 €)
        p1 = apply_advance_recoupment(
            holder_name="Jeanne Petite",
            gross_royalties_allocated=Decimal("32.50"),
            initial_advance=Decimal("0.00"),
            previously_recouped=Decimal("0.00"),
            previous_reserve_balance=Decimal("0.00"),
            min_payment_threshold=Decimal("50.00"),
            entity_type="PERSONNE_PHYSIQUE",
            urssaf_dispense_certificate=True,
        )
        self.assertEqual(p1.payout_status, "BELOW_THRESHOLD")
        self.assertTrue(p1.is_below_payment_threshold)
        self.assertEqual(p1.retained_in_reserve, Decimal("32.50"))
        self.assertEqual(p1.net_payable_amount, Decimal("0.00"))
        self.assertEqual(p1.carried_forward_to_next, Decimal("32.50"))
        self.assertIn("50.00", p1.legal_mention_applied or "")

        # Période 2 : Nouvelles redevances de 25.00 € + report à nouveau de 32.50 € = 57.50 € >= 50.00 €
        p2 = apply_advance_recoupment(
            holder_name="Jeanne Petite",
            gross_royalties_allocated=Decimal("25.00"),
            initial_advance=Decimal("0.00"),
            previously_recouped=Decimal("0.00"),
            previous_reserve_balance=Decimal("32.50"),
            min_payment_threshold=Decimal("50.00"),
            entity_type="PERSONNE_PHYSIQUE",
            urssaf_dispense_certificate=True,
        )
        self.assertEqual(p2.payout_status, "PAYABLE")
        self.assertFalse(p2.is_below_payment_threshold)
        self.assertEqual(p2.retained_in_reserve, Decimal("0.00"))
        self.assertEqual(p2.net_payable_amount, Decimal("57.50"))
        self.assertEqual(p2.carried_forward_to_next, Decimal("0.00"))
        self.assertIn("Règlement effectué par virement bancaire", p2.legal_mention_applied or "")

    def test_conditional_legal_mentions_and_custom_templates(self) -> None:
        """US-2.3 : Messages conditionnels pour les décomptes et personnalisation."""
        custom_msgs = {
            "paid_fr": "Virement validé par la DAF.",
            "below_threshold_fr": "Solde < {threshold} EUR mis en réserve.",
            "recoupment_fr": "Amortissement contractuel de l'avance en cours.",
        }

        # 1. Cas avance en cours d'amortissement
        recoup_state = apply_advance_recoupment(
            holder_name="Artiste Avance",
            gross_royalties_allocated=Decimal("400.00"),
            initial_advance=Decimal("1000.00"),
            previously_recouped=Decimal("0.00"),
            statement_messages=custom_msgs,
        )
        self.assertEqual(recoup_state.payout_status, "RECOUPING")
        self.assertEqual(recoup_state.legal_mention_applied, "Amortissement contractuel de l'avance en cours.")
        self.assertEqual(recoup_state.carried_forward_to_next, Decimal("600.00"))

        # 2. Cas sous le seuil
        below_state = apply_advance_recoupment(
            holder_name="Artiste Réserve",
            gross_royalties_allocated=Decimal("15.00"),
            initial_advance=Decimal("0.00"),
            previously_recouped=Decimal("0.00"),
            min_payment_threshold=Decimal("75.00"),
            statement_messages=custom_msgs,
            urssaf_dispense_certificate=True,
        )
        self.assertEqual(below_state.payout_status, "BELOW_THRESHOLD")
        self.assertEqual(below_state.legal_mention_applied, "Solde < 75.00 EUR mis en réserve.")


if __name__ == "__main__":
    unittest.main()
