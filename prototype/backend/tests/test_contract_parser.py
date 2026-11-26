import asyncio
import unittest
from decimal import Decimal

from app.schemas.common import ValidationStatus
from app.services.contract_ai_parser import parse_contract_text_with_ai


class TestContractParser(unittest.TestCase):
    """Tests d'extraction structurée de contrats PDF vers Pydantic v2 (Jalon 2)."""

    def test_contract_extraction_produces_strict_schema_and_pending_review(self) -> None:
        sample_contract_text = """
        CONTRAT DE COEDITION MUSICALE
        Référence : CTR-2026-LN01
        Œuvre : « Lumière Noire »
        Article 4 - Clé de répartition des droits :
        - Camille Moreau (Auteur-Compositeur, IPI : 00458912301) : DEP = 50.00 % | DRM = 50.00 %
        - Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50.00 % | DRM = 50.00 %
        Article 6 - Avance récupérable :
        L'Éditeur verse à Camille Moreau une avance récupérable de 15000 EUR HT.
        """
        result = asyncio.run(
            parse_contract_text_with_ai(
                sample_contract_text,
                source_filename="contrat_coedition_lumiere_noire.pdf",
            )
        )
        self.assertEqual(result.contract_reference, "CTR-2026-LN01")
        self.assertEqual(result.validation_status, ValidationStatus.PENDING_REVIEW)
        self.assertGreaterEqual(result.confidence_score, 0.0)
        self.assertLessEqual(result.confidence_score, 1.0)
        self.assertEqual(result.advance_amount, Decimal("15000.00"))
        self.assertEqual(len(result.parties), 2)
        self.assertEqual(len(result.cwr_split_warnings), 0)

    def test_contract_extraction_flags_incomplete_splits_without_altering_numbers(self) -> None:
        anomalous_contract_text = """
        CONTRAT DE CESSION D'EDITION
        Référence : CTR-2026-OO04
        Œuvre : « Orage d'Octobre »
        Article 4 :
        - Sami Benali (Auteur-Compositeur, IPI : 00398765432) : DEP = 40.00 % | DRM = 50.00 %
        - Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50.00 % | DRM = 50.00 %
        """
        result = asyncio.run(
            parse_contract_text_with_ai(
                anomalous_contract_text,
                source_filename="contrat_pacte_orage_octobre_anomalie.pdf",
            )
        )
        # Vérifie que le parser ne modifie pas le 40% en 50%, mais génère une alerte CWR
        self.assertEqual(result.parties[0].dep_share_pct, Decimal("40.00"))
        self.assertGreater(len(result.cwr_split_warnings), 0)

    def test_kfc576_multicontract_bundle_extraction(self) -> None:
        kfc_text = """
        CONTRACT – GRANT AND PUBLISHING OF A MUSICAL WORK
        INTENDED TO MUSICAL SCORE AND MUSIC BACKGROUND FOR AUDIOVISUAL PRODUCTIONS
        N° KFC576 dated July 19th, 2023
        BETWEEN THE UNDERSIGNED:
        Mr. Jonathan DUPONT Address: 14 rue de la Pompe, 75016 Paris, FRANCEIPI Number: 891 83 70 97
        And,
        Mr. Albert BERNSTEIN Address: 19 rue Victor Considérant, 75014 Paris, FRANCEIPI Number: 1106 27 90 84
        AND:
        KAPTAIN MUSIC, a trademark of UNE MUSIQUE, French Simplified Company...
        Title: KFC HAVE NO FEAR
        Subtitle: HAVE NO FEAR
        Song: No
        Recording N°: KFC576-01
        Music: Jonathan DUPONT {50% (fifty per cent)} & Albert BERNSTEIN {50% (fifty per cent)}
        ARTICLE 11
        11.3 - at least one third (1/3) of all royalties received by said body in connection with the communication of the WORK to the public,
        - 50% (fifty per cent) of all royalties received by said body for mechanical reproductions of the WORK
        APPENDIX 1 / CONTRACT – GRANT OF NEIGHBORING/RELATED RIGHTS ON A RECORDING N° KFC576
        ARTICLE 3 – ROYALTIES
        3.1 20% (twenty per cent), divided as follows:
        - Mr. Jonathan DUPONT: 10% (ten per cent);
        - Mr. Albert BERNSTEIN: 10% (ten per cent);
        CONTRACT – ASSIGNMENT OF AUDIOVISUAL ADAPTATION RIGHT
        """
        result = asyncio.run(parse_contract_text_with_ai(kfc_text, source_filename="KFC576_HAVE_NO_FEAR.pdf"))
        self.assertEqual(result.contract_reference, "KFC576-01")
        self.assertIn("KFC HAVE NO FEAR", result.work_titles)
        self.assertEqual(len(result.parties), 3)

        # Vérifie Jonathan Dupont
        dupont = next(p for p in result.parties if "DUPONT" in p.party_name)
        self.assertEqual(dupont.dep_share_pct, Decimal("25.00"))
        self.assertEqual(dupont.drm_share_pct, Decimal("25.00"))
        self.assertEqual(dupont.phono_share_pct, Decimal("10.00"))
        self.assertEqual(dupont.ipi_number, "00891837097")

        # Vérifie Albert Bernstein
        bernstein = next(p for p in result.parties if "BERNSTEIN" in p.party_name)
        self.assertEqual(bernstein.dep_share_pct, Decimal("25.00"))
        self.assertEqual(bernstein.drm_share_pct, Decimal("25.00"))
        self.assertEqual(bernstein.phono_share_pct, Decimal("10.00"))
        self.assertEqual(bernstein.ipi_number, "01106279084")

        # Vérifie Kaptain Music / Une Musique
        publisher = next(p for p in result.parties if "KAPTAIN" in p.party_name)
        self.assertEqual(publisher.dep_share_pct, Decimal("50.00"))
        self.assertEqual(publisher.drm_share_pct, Decimal("50.00"))
        self.assertEqual(publisher.phono_share_pct, Decimal("80.00"))

        # Vérifie qu'il y a 1 warning CWR signalant l'IPI manquant de Kaptain Music (non mentionné sur la page 1 du PDF)
        self.assertEqual(len(result.cwr_split_warnings), 1)
        self.assertIn("Code IPI manquant", result.cwr_split_warnings[0])
        self.assertIn("KAPTAIN", result.cwr_split_warnings[0])

    def test_kfc674_multi_works_and_unstructured_extraction(self) -> None:
        # 1. Test table multi-œuvres (KFC674 avec Antoine Verse & Julie Dumonnet)
        kfc674_text = """
        CONTRACT – GRANT AND PUBLISHING OF A MUSICAL WORK
        N° KFC674 dated July 19th, 2026
        BETWEEN THE UNDERSIGNED:
        Mr. Antoine VERSE Address: 5 rue Georges Pompidou, 75016 Paris, FRANCE IPI Number: 891 83 70 97
        And,
        Mrs. Julie DUMONNET Address: 58 rue de Vienne, 75008 Paris, France IPI Number: 1106 27 90 84
        AND:
        KAPTAIN MUSIC, a trademark of UNE MUSIQUE...
        Title Subtitle Song Recording N°
        KFC LOOK BEHIND LOOK BEHIND No KFC674-01
        KFC SHOWER TIME SHOWER TIME No KFC674-02
        KFC TRY AGAIN TRY AGAIN No KFC674-03
        KFC USED TO IT USED TO IT No KFC674-04
        o Music: Antoine VERSE {50% (fifty per cent)} & Julie DUMONNET {50% (fifty per cent)}
        ARTICLE 11
        11.3 - at least one third (1/3) of all royalties received by said body in connection with the communication of the WORK to the public,
        - 50% (fifty per cent) of all royalties received by said body for mechanical reproductions of the WORK
        APPENDIX 1 / CONTRACT – GRANT OF NEIGHBORING/RELATED RIGHTS ON A RECORDING N° KFC674
        ARTICLE 3 – ROYALTIES
        3.1 20% (twenty per cent), divided as follows:
        - Mr. Antoine VERSE: 10% (ten per cent);
        - Mr. Julie DUMONNET: 10% (ten per cent);
        """
        result = asyncio.run(parse_contract_text_with_ai(kfc674_text, source_filename="Contract_KFC674.pdf"))
        self.assertEqual(result.contract_reference, "KFC674-01")
        self.assertEqual(
            result.work_titles,
            ["KFC LOOK BEHIND", "KFC SHOWER TIME", "KFC TRY AGAIN", "KFC USED TO IT"],
        )
        self.assertEqual(len(result.parties), 3)

        verse = next(p for p in result.parties if "VERSE" in p.party_name)
        self.assertEqual(verse.dep_share_pct, Decimal("25.00"))
        self.assertEqual(verse.drm_share_pct, Decimal("25.00"))
        self.assertEqual(verse.phono_share_pct, Decimal("10.00"))
        self.assertEqual(verse.ipi_number, "00891837097")

        dumonnet = next(p for p in result.parties if "DUMONNET" in p.party_name)
        self.assertEqual(dumonnet.dep_share_pct, Decimal("25.00"))
        self.assertEqual(dumonnet.drm_share_pct, Decimal("25.00"))
        self.assertEqual(dumonnet.phono_share_pct, Decimal("10.00"))
        self.assertEqual(dumonnet.ipi_number, "01106279084")

        # 2. Test liste d'œuvres non structurée avec retours à la ligne
        unstructured_text = """
        CONTRAT DE CESSION ÉDITORIALE
        N° CTR-2026-UNSTRUCT
        Entre les soussignés :
        - Marie Curie (Auteur-Compositeur, IPI : 00458912301) : DEP = 50% | DRM = 50%
        - Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50% | DRM = 50%
        over the following WORKS of which the author is the owner:
        Eclat Lunaire
        Sillage Doré
        Reflet d'Ambre
        ARTICLE 2
        """
        res_unstruct = asyncio.run(parse_contract_text_with_ai(unstructured_text, source_filename="contrat_unstruct.pdf"))
        self.assertEqual(
            res_unstruct.work_titles,
            ["Eclat Lunaire", "Sillage Doré", "Reflet d'Ambre"],
        )

    def test_override_switch_and_xlsx_cwr_exports(self) -> None:
        from fastapi.testclient import TestClient
        from app.main import app

        with TestClient(app) as client:
            # 1. Test Override Switch toggle
            sw_resp = client.post("/api/v1/settings/override-switch", json={"deterministic_only": True})
            self.assertEqual(sw_resp.status_code, 200)
            self.assertTrue(sw_resp.json()["deterministic_only"])
            self.assertEqual(sw_resp.json()["active_model"], "deterministic")

            # 2. Test Excel (.xlsx) visibility export
            xlsx_resp = client.get("/api/v1/works/export/xlsx")
            self.assertEqual(xlsx_resp.status_code, 200)
            self.assertEqual(
                xlsx_resp.headers["content-type"],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            self.assertTrue(xlsx_resp.content.startswith(b"PK\x03\x04"))

            # Restore Override Switch
            client.post("/api/v1/settings/override-switch", json={"deterministic_only": False})



if __name__ == "__main__":
    unittest.main()
