import os
from decimal import Decimal
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.database import engine
from app.main import app
from app.models.contract import Contract
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.contract import ContractValidationPayload
from app.services.contract_ai_parser import _deterministic_regex_fallback_parse
from app.services.pdf_extractor import extract_text_from_pdf_bytes

PDF_PATH = "/Users/ariane/.gemini/antigravity/brain/1cc26313-45fe-48ab-8cdf-517779644d5e/.user_uploaded/media_1794816068761_395b00a2.pdf"
PDF_CESSION_INSTRU_PATH = "/Users/ariane/.gemini/antigravity/brain/1cc26313-45fe-48ab-8cdf-517779644d5e/.user_uploaded/media_1794821121637_8dc648c1.pdf"
PDF_CESSION_SCORE_PATH = "/Users/ariane/.gemini/antigravity/brain/1cc26313-45fe-48ab-8cdf-517779644d5e/.user_uploaded/media_1794821121637_e9e70fb2.pdf"
PDF_LAI_PATH = "/Users/ariane/.gemini/antigravity/brain/1cc26313-45fe-48ab-8cdf-517779644d5e/.user_uploaded/media_1794828701733_826b3a03.pdf"


class TestCoeditionParser(TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_coedition_contract_parsing(self) -> None:
        self.assertTrue(os.path.exists(PDF_PATH), f"PDF file not found at {PDF_PATH}")
        with open(PDF_PATH, "rb") as f:
            pdf_bytes = f.read()

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        result = _deterministic_regex_fallback_parse(raw_text, source_filename="CTR-0001-ERICA_S2_-_SCORE_ET_INSTRU.pdf")

        # Vérifications principales
        self.assertEqual(result.contract_reference, "4770")
        self.assertEqual(result.contract_type, "CO_EDITION")
        self.assertEqual(result.publisher_name, "UNE MUSIQUE")
        self.assertEqual(result.counterparty_name, "LVA MUSIQUE")
        self.assertTrue(result.requires_cession_contract)
        self.assertIsNotNone(result.co_edition_alert)
        self.assertIn("UNE MUSIQUE et LVA MUSIQUE", result.co_edition_alert or "")
        self.assertIn("cession et d'édition", result.co_edition_alert or "")
        self.assertIn("Deux contrats de cession et d'édition distincts sont attendus", result.co_edition_alert or "")
        self.assertEqual(result.audiovisual_program, "ERICA (2ème saison)")

        # Vérifications des contrats de cession attendus (2 contrats distincts)
        self.assertEqual(len(result.expected_cession_contracts), 2)
        exp1 = result.expected_cession_contracts[0]
        self.assertEqual(exp1.subgroup_name, "Musique Originale")
        self.assertEqual(exp1.composers, ["Fabien NATAF", "Alain MOUYSSET"])
        self.assertEqual(exp1.work_count, 6)
        self.assertEqual(exp1.status, "PENDING")

        exp2 = result.expected_cession_contracts[1]
        self.assertEqual(exp2.subgroup_name, "Banque Originale")
        self.assertEqual(exp2.composers, ["Fabien NATAF"])
        self.assertEqual(exp2.work_count, 31)
        self.assertEqual(exp2.status, "PENDING")

        # Vérifications des œuvres et des deux sous-groupes
        self.assertEqual(len(result.work_titles), 37)
        self.assertEqual(len(result.work_subgroups), 2)

        sg_musique_orig = result.work_subgroups[0]
        self.assertEqual(sg_musique_orig.name, "Musique Originale")
        self.assertEqual(sg_musique_orig.composers, ["Fabien NATAF", "Alain MOUYSSET"])
        self.assertEqual(len(sg_musique_orig.work_titles), 6)
        self.assertIn("L'OISEAU DE MAUVAISE AUGURE PARTIE 1", sg_musique_orig.work_titles)
        self.assertIn("LA SIRENE PARTIE 2", sg_musique_orig.work_titles)

        sg_banque_orig = result.work_subgroups[1]
        self.assertEqual(sg_banque_orig.name, "Banque Originale")
        self.assertEqual(sg_banque_orig.composers, ["Fabien NATAF"])
        self.assertEqual(len(sg_banque_orig.work_titles), 31)
        self.assertIn("ERC FN ACCIDENT", sg_banque_orig.work_titles)
        self.assertIn("ERC FN WEEDING DRESS", sg_banque_orig.work_titles)

        # Vérifier qu'aucun terme juridique parasite n'est pris comme titre
        banned = ["EDITEUR", "CO-EDITEUR", "RGPD", "LIL", "e-Privacy", "TF1", "Partie", "Parties", "dans"]
        for b in banned:
            self.assertNotIn(b, result.work_titles)

        # Vérification des quotes-parts globales (100% CWR)
        dep_sum = sum(p.dep_share_pct for p in result.parties)
        drm_sum = sum(p.drm_share_pct for p in result.parties)
        phono_sum = sum(p.phono_share_pct for p in result.parties)
        self.assertEqual(dep_sum, Decimal("100.00"))
        self.assertEqual(drm_sum, Decimal("100.00"))
        self.assertEqual(phono_sum, Decimal("100.00"))

    def test_coedition_validation_and_workgroup_sync(self) -> None:
        with open(PDF_PATH, "rb") as f:
            pdf_bytes = f.read()

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        extracted = _deterministic_regex_fallback_parse(raw_text, source_filename="CTR-0001-ERICA_S2.pdf")

        # Création du contrat en base
        with Session(engine) as session:
            contract = Contract(
                contract_reference=f"4770-TEST-{uuid4().hex[:6]}",
                contract_type=extracted.contract_type,
                publisher_name=extracted.publisher_name,
                counterparty_name=extracted.counterparty_name,
                work_titles=extracted.work_titles,
                work_subgroups=[sg.model_dump(mode="json") for sg in extracted.work_subgroups],
                co_edition_alert=extracted.co_edition_alert,
                requires_cession_contract=extracted.requires_cession_contract,
                audiovisual_program=extracted.audiovisual_program,
                parties=[p.model_dump(mode="json") for p in extracted.parties],
                confidence_score=0.95,
            )
            session.add(contract)
            session.commit()
            session.refresh(contract)
            contract_id = contract.id

        # Validation via API endpoint
        resp = self.client.post(
            f"/api/v1/contracts/{contract_id}/validate",
            json={"approve": True, "validated_by": "juriste@korom.fr"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["validation_status"], "VALIDATED")
        self.assertTrue(data["requires_cession_contract"])
        self.assertEqual(data["audiovisual_program"], "ERICA (2ème saison)")

        with Session(engine) as session:
            # Vérifier que le WorkGroup a bien été créé
            wg = session.exec(select(WorkGroup).where(WorkGroup.name == "ERICA (2ème saison)")).first()
            self.assertIsNotNone(wg)
            self.assertEqual(wg.group_type, "AUDIOVISUAL")

            # Vérifier une oeuvre de Musique Originale (4 parties : 2 compositeurs + 2 éditeurs)
            w_orig = session.exec(select(Work).where(Work.title == "L'OISEAU DE MAUVAISE AUGURE PARTIE 1")).first()
            self.assertIsNotNone(w_orig)
            self.assertEqual(len(w_orig.splits), 4)
            holders = {s["holder_name"]: Decimal(s["dep_share_pct"]) for s in w_orig.splits}
            self.assertEqual(holders["UNE MUSIQUE"], Decimal("25.00"))
            self.assertEqual(holders["LVA MUSIQUE"], Decimal("25.00"))
            self.assertEqual(holders["Fabien NATAF"], Decimal("25.00"))
            self.assertEqual(holders["Alain MOUYSSET"], Decimal("25.00"))

            # Vérifier une oeuvre de Banque Originale (3 parties : 1 compositeur + 2 éditeurs)
            w_banque = session.exec(select(Work).where(Work.title == "ERC FN ACCIDENT")).first()
            self.assertIsNotNone(w_banque)
            self.assertEqual(len(w_banque.splits), 3)
            holders_b = {s["holder_name"]: Decimal(s["dep_share_pct"]) for s in w_banque.splits}
            self.assertEqual(holders_b["UNE MUSIQUE"], Decimal("25.00"))
            self.assertEqual(holders_b["LVA MUSIQUE"], Decimal("25.00"))
            self.assertEqual(holders_b["Fabien NATAF"], Decimal("50.00"))
            # Vérifier l'équilibre des parts PHONO à 100.00% exact (25% UNE + 25% LVA + 50% NATAF)
            phono_b_sum = sum(Decimal(s["phono_share_pct"]) for s in w_banque.splits)
            self.assertEqual(phono_b_sum, Decimal("100.00"))

            # Vérifier le lien WorkGroupLink
            link = session.exec(
                select(WorkGroupLink).where(
                    WorkGroupLink.work_group_id == wg.id,
                    WorkGroupLink.work_id == w_orig.id,
                )
            ).first()
            self.assertIsNotNone(link)

    def test_cession_contract_instru_parsing(self) -> None:
        """Teste l'extraction du contrat de cession d'édition Instru Originales (Fabien NATAF)."""
        self.assertTrue(os.path.exists(PDF_CESSION_INSTRU_PATH), f"File not found: {PDF_CESSION_INSTRU_PATH}")
        with open(PDF_CESSION_INSTRU_PATH, "rb") as f:
            pdf_bytes = f.read()

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        result = _deterministic_regex_fallback_parse(raw_text, source_filename="CTR-0002-INSTRU ERICA S2 (signé) (1).pdf")

        # 1. Vérification des titres extraits de l'Article 1 (31 œuvres)
        self.assertEqual(len(result.work_titles), 31)
        self.assertIn("ERC FN ACCIDENT", result.work_titles)
        self.assertIn("ERC FN WEEDING DRESS", result.work_titles)
        self.assertNotIn("Partie(s)", result.work_titles)
        self.assertNotIn("Partie(s )", result.work_titles)

        # 2. Vérification des ayants droit et parts extraits de l'Article XIX
        self.assertEqual(len(result.parties), 3)
        parties_by_name = {p.party_name: p for p in result.parties}

        self.assertIn("Fabien NATAF", parties_by_name)
        nataf = parties_by_name["Fabien NATAF"]
        self.assertEqual(nataf.role, "C")
        self.assertEqual(nataf.dep_share_pct, Decimal("66.66"))
        self.assertEqual(nataf.drm_share_pct, Decimal("50.00"))
        self.assertEqual(nataf.phono_share_pct, Decimal("50.00"))

        self.assertIn("LVA MUSIQUE", parties_by_name)
        lva = parties_by_name["LVA MUSIQUE"]
        self.assertEqual(lva.role, "E")
        self.assertEqual(lva.dep_share_pct, Decimal("16.67"))
        self.assertEqual(lva.drm_share_pct, Decimal("25.00"))
        self.assertEqual(lva.phono_share_pct, Decimal("25.00"))

        self.assertIn("UNE MUSIQUE", parties_by_name)
        une = parties_by_name["UNE MUSIQUE"]
        self.assertEqual(une.role, "E")
        self.assertEqual(une.dep_share_pct, Decimal("16.67"))
        self.assertEqual(une.drm_share_pct, Decimal("25.00"))
        self.assertEqual(une.phono_share_pct, Decimal("25.00"))

        # Vérification des équilibres à 100%
        self.assertEqual(sum(p.dep_share_pct for p in result.parties), Decimal("100.00"))
        self.assertEqual(sum(p.drm_share_pct for p in result.parties), Decimal("100.00"))
        self.assertEqual(sum(p.phono_share_pct for p in result.parties), Decimal("100.00"))

    def test_lai_contract_parsing_and_sync_propagation(self) -> None:
        self.assertTrue(os.path.exists(PDF_LAI_PATH), f"PDF file not found at {PDF_LAI_PATH}")
        with open(PDF_LAI_PATH, "rb") as f:
            pdf_bytes = f.read()

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        result = _deterministic_regex_fallback_parse(raw_text, source_filename="LAI - Erica S2 x Fabien Nataf.pdf")

        # 1. Vérification des métadonnées LAI
        self.assertEqual(result.contract_type, "LETTRE_ACCORD_INTERPRETE")
        self.assertEqual(result.counterparty_name, "Fabien NATAF")
        self.assertEqual(result.publisher_name, "UNE MUSIQUE")
        self.assertEqual(result.audiovisual_program, "ERICA (Saison 2)")
        self.assertEqual(result.work_titles, [])

        # 2. Vérification des quotes-parts (11% Artiste-Interprète synchro & phono)
        parties_by_name = {p.party_name: p for p in result.parties}
        self.assertIn("Fabien NATAF", parties_by_name)
        artist = parties_by_name["Fabien NATAF"]
        self.assertEqual(artist.role, "I")
        self.assertEqual(artist.sync_share_pct, Decimal("11.00"))
        self.assertEqual(artist.phono_share_pct, Decimal("11.00"))
        self.assertEqual(artist.dep_share_pct, Decimal("0.00"))
        self.assertEqual(artist.drm_share_pct, Decimal("0.00"))

        self.assertIn("UNE MUSIQUE", parties_by_name)
        une = parties_by_name["UNE MUSIQUE"]
        self.assertEqual(une.sync_share_pct, Decimal("44.50"))
        self.assertEqual(une.phono_share_pct, Decimal("44.50"))

        self.assertIn("MRRAZ", parties_by_name)
        mrraz = parties_by_name["MRRAZ"]
        self.assertEqual(mrraz.sync_share_pct, Decimal("44.50"))
        self.assertEqual(mrraz.phono_share_pct, Decimal("44.50"))

        # Vérification des équilibres à 100%
        self.assertEqual(sum(p.sync_share_pct for p in result.parties), Decimal("100.00"))
        self.assertEqual(sum(p.phono_share_pct for p in result.parties), Decimal("100.00"))

        # 3. Test de validation et propagation de la synchro à un WorkGroup
        with Session(engine) as session:
            # Créer un WorkGroup audiovisuel pour ERICA
            wg = WorkGroup(
                name="ERICA (Saison 2)",
                group_type="AUDIOVISUAL",
            )
            session.add(wg)
            session.flush()

            # Créer une œuvre avec parts en attente de synchro (0%)
            test_work = Work(
                title=f"TEST_SYNCHRO_{uuid4().hex[:6]}",
                splits=[
                    {
                        "holder_name": "Fabien NATAF",
                        "role": "C",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "0.00",
                        "phono_share_pct": "50.00",
                    },
                    {
                        "holder_name": "UNE MUSIQUE",
                        "role": "E",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "0.00",
                        "phono_share_pct": "50.00",
                    },
                ],
            )
            session.add(test_work)
            session.flush()
            test_work_id = test_work.id

            link = WorkGroupLink(work_group_id=wg.id, work_id=test_work_id)
            session.add(link)

            # Créer le contrat LAI
            lai_contract = Contract(
                contract_reference=f"LAI-TEST-{uuid4().hex[:6]}",
                contract_type="LETTRE_ACCORD_INTERPRETE",
                publisher_name="UNE MUSIQUE",
                counterparty_name="Fabien NATAF",
                audiovisual_program="ERICA (Saison 2)",
                parties=[p.model_dump(mode="json") for p in result.parties],
                confidence_score=0.98,
            )
            session.add(lai_contract)
            session.commit()
            session.refresh(lai_contract)
            lai_id = lai_contract.id

        # Valider le contrat LAI via API
        resp = self.client.post(
            f"/api/v1/contracts/{lai_id}/validate",
            json={"approve": True, "validated_by": "juriste@korom.fr"},
        )
        self.assertEqual(resp.status_code, 200)

        # Vérifier que l'œuvre a reçu la quote-part synchro de 11% pour l'artiste et le solde pour l'éditeur
        with Session(engine) as session:
            updated_w = session.get(Work, test_work_id)
            self.assertIsNotNone(updated_w)
            splits_by_name = {s["holder_name"]: s for s in updated_w.splits}
            self.assertEqual(splits_by_name["Fabien NATAF"]["sync_share_pct"], "11.00")
            self.assertEqual(splits_by_name["UNE MUSIQUE"]["sync_share_pct"], "89.00")
            # Somme SYNC égale à 100.00%
            total_sync = sum(Decimal(s["sync_share_pct"]) for s in updated_w.splits)
            self.assertEqual(total_sync, Decimal("100.00"))

    def test_cession_contract_score_parsing(self) -> None:
        """Teste l'extraction du contrat de cession d'édition Musique Originale (Fabien NATAF & Alain MOUYSSET)."""
        self.assertTrue(os.path.exists(PDF_CESSION_SCORE_PATH), f"File not found: {PDF_CESSION_SCORE_PATH}")
        with open(PDF_CESSION_SCORE_PATH, "rb") as f:
            pdf_bytes = f.read()

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        result = _deterministic_regex_fallback_parse(raw_text, source_filename="CTR-0003-SCORE ERICA S2 (signé).pdf")

        # 1. Vérification des titres extraits de l'Article 1 (6 œuvres)
        self.assertEqual(len(result.work_titles), 6)
        self.assertIn("L'OISEAU DE MAUVAISE AUGURE PARTIE 1", result.work_titles)
        self.assertIn("LA SIRENE PARTIE 2", result.work_titles)
        self.assertNotIn("Partie(s)", result.work_titles)
        self.assertNotIn("Partie(s )", result.work_titles)

        # 2. Vérification des ayants droit et parts extraits de l'Article XIX
        self.assertEqual(len(result.parties), 4)
        parties_by_name = {p.party_name: p for p in result.parties}

        self.assertIn("Fabien NATAF", parties_by_name)
        nataf = parties_by_name["Fabien NATAF"]
        self.assertEqual(nataf.role, "C")
        self.assertEqual(nataf.dep_share_pct, Decimal("33.33"))
        self.assertEqual(nataf.drm_share_pct, Decimal("25.00"))
        self.assertEqual(nataf.phono_share_pct, Decimal("25.00"))

        self.assertIn("Alain MOUYSSET", parties_by_name)
        mouysset = parties_by_name["Alain MOUYSSET"]
        self.assertEqual(mouysset.role, "C")
        self.assertEqual(mouysset.dep_share_pct, Decimal("33.33"))
        self.assertEqual(mouysset.drm_share_pct, Decimal("25.00"))
        self.assertEqual(mouysset.phono_share_pct, Decimal("25.00"))

        self.assertIn("LVA MUSIQUE", parties_by_name)
        lva = parties_by_name["LVA MUSIQUE"]
        self.assertEqual(lva.role, "E")
        self.assertEqual(lva.dep_share_pct, Decimal("16.67"))
        self.assertEqual(lva.drm_share_pct, Decimal("25.00"))
        self.assertEqual(lva.phono_share_pct, Decimal("25.00"))

        self.assertIn("UNE MUSIQUE", parties_by_name)
        une = parties_by_name["UNE MUSIQUE"]
        self.assertEqual(une.role, "E")
        self.assertEqual(une.dep_share_pct, Decimal("16.67"))
        self.assertEqual(une.drm_share_pct, Decimal("25.00"))
        self.assertEqual(une.phono_share_pct, Decimal("25.00"))

        # Vérification des équilibres à 100%
        self.assertEqual(sum(p.dep_share_pct for p in result.parties), Decimal("100.00"))
        self.assertEqual(sum(p.drm_share_pct for p in result.parties), Decimal("100.00"))
        self.assertEqual(sum(p.phono_share_pct for p in result.parties), Decimal("100.00"))

    def test_lai_contract_parsing_and_sync_propagation(self) -> None:
        self.assertTrue(os.path.exists(PDF_LAI_PATH), f"PDF file not found at {PDF_LAI_PATH}")
        with open(PDF_LAI_PATH, "rb") as f:
            pdf_bytes = f.read()

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        result = _deterministic_regex_fallback_parse(raw_text, source_filename="LAI - Erica S2 x Fabien Nataf.pdf")

        # 1. Vérification des métadonnées LAI
        self.assertEqual(result.contract_type, "LETTRE_ACCORD_INTERPRETE")
        self.assertEqual(result.counterparty_name, "Fabien NATAF")
        self.assertEqual(result.publisher_name, "UNE MUSIQUE")
        self.assertEqual(result.audiovisual_program, "ERICA (Saison 2)")
        self.assertEqual(result.work_titles, [])

        # 2. Vérification des quotes-parts (11% Artiste-Interprète synchro & phono)
        parties_by_name = {p.party_name: p for p in result.parties}
        self.assertIn("Fabien NATAF", parties_by_name)
        artist = parties_by_name["Fabien NATAF"]
        self.assertEqual(artist.role, "I")
        self.assertEqual(artist.sync_share_pct, Decimal("11.00"))
        self.assertEqual(artist.phono_share_pct, Decimal("11.00"))
        self.assertEqual(artist.dep_share_pct, Decimal("0.00"))
        self.assertEqual(artist.drm_share_pct, Decimal("0.00"))

        self.assertIn("UNE MUSIQUE", parties_by_name)
        une = parties_by_name["UNE MUSIQUE"]
        self.assertEqual(une.sync_share_pct, Decimal("44.50"))
        self.assertEqual(une.phono_share_pct, Decimal("44.50"))

        self.assertIn("MRRAZ", parties_by_name)
        mrraz = parties_by_name["MRRAZ"]
        self.assertEqual(mrraz.sync_share_pct, Decimal("44.50"))
        self.assertEqual(mrraz.phono_share_pct, Decimal("44.50"))

        # Vérification des équilibres à 100%
        self.assertEqual(sum(p.sync_share_pct for p in result.parties), Decimal("100.00"))
        self.assertEqual(sum(p.phono_share_pct for p in result.parties), Decimal("100.00"))

        # 3. Test de validation et propagation de la synchro à un WorkGroup
        with Session(engine) as session:
            # Créer un WorkGroup audiovisuel pour ERICA
            wg = WorkGroup(
                name="ERICA (Saison 2)",
                group_type="AUDIOVISUAL",
            )
            session.add(wg)
            session.flush()

            # Créer une œuvre avec parts en attente de synchro (0%)
            test_work = Work(
                title=f"TEST_SYNCHRO_{uuid4().hex[:6]}",
                splits=[
                    {
                        "holder_name": "Fabien NATAF",
                        "role": "C",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "0.00",
                        "phono_share_pct": "50.00",
                    },
                    {
                        "holder_name": "UNE MUSIQUE",
                        "role": "E",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "0.00",
                        "phono_share_pct": "50.00",
                    },
                ],
            )
            session.add(test_work)
            session.flush()
            test_work_id = test_work.id

            link = WorkGroupLink(work_group_id=wg.id, work_id=test_work_id)
            session.add(link)

            # Créer le contrat LAI
            lai_contract = Contract(
                contract_reference=f"LAI-TEST-{uuid4().hex[:6]}",
                contract_type="LETTRE_ACCORD_INTERPRETE",
                publisher_name="UNE MUSIQUE",
                counterparty_name="Fabien NATAF",
                audiovisual_program="ERICA (Saison 2)",
                parties=[p.model_dump(mode="json") for p in result.parties],
                confidence_score=0.98,
            )
            session.add(lai_contract)
            session.commit()
            session.refresh(lai_contract)
            lai_id = lai_contract.id

        # Valider le contrat LAI via API
        resp = self.client.post(
            f"/api/v1/contracts/{lai_id}/validate",
            json={"approve": True, "validated_by": "juriste@korom.fr"},
        )
        self.assertEqual(resp.status_code, 200)

        # Vérifier que l'œuvre a reçu la quote-part synchro de 11% pour l'artiste et le solde pour l'éditeur
        with Session(engine) as session:
            updated_w = session.get(Work, test_work_id)
            self.assertIsNotNone(updated_w)
            splits_by_name = {s["holder_name"]: s for s in updated_w.splits}
            self.assertEqual(splits_by_name["Fabien NATAF"]["sync_share_pct"], "11.00")
            self.assertEqual(splits_by_name["UNE MUSIQUE"]["sync_share_pct"], "89.00")
            # Somme SYNC égale à 100.00%
            total_sync = sum(Decimal(s["sync_share_pct"]) for s in updated_w.splits)
            self.assertEqual(total_sync, Decimal("100.00"))

    def test_contact_info_extraction_and_work_group_creation(self) -> None:
        self.assertTrue(os.path.exists(PDF_CESSION_INSTRU_PATH), f"PDF not found at {PDF_CESSION_INSTRU_PATH}")
        with open(PDF_CESSION_INSTRU_PATH, "rb") as f:
            pdf_bytes = f.read()

        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
        result = _deterministic_regex_fallback_parse(raw_text, source_filename="CTR-0002-INSTRU.pdf")

        # 1. Vérification de l'extraction des coordonnées
        parties_by_name = {p.party_name: p for p in result.parties}
        self.assertIn("Fabien NATAF", parties_by_name)
        nataf = parties_by_name["Fabien NATAF"]
        self.assertEqual(nataf.city, "PARIS")
        self.assertEqual(nataf.postal_code, "75016")
        self.assertIn("Jean de la Fontaine", nataf.postal_address or "")

        self.assertIn("UNE MUSIQUE", parties_by_name)
        une_musique = parties_by_name["UNE MUSIQUE"]
        self.assertEqual(une_musique.legal_form, "SAS")
        self.assertIn("BOULOGNE", (une_musique.city or "").upper())
        self.assertIn("Point du Jour", une_musique.postal_address or "")

        unique_suffix = uuid4().hex[:6]
        test_w1 = f"ERC TEST WORK 1 {unique_suffix}"
        test_w2 = f"ERC TEST WORK 2 {unique_suffix}"
        wg_name = f"Projet Erica Score {unique_suffix}"

        # 2. Persistance dans la base et validation (remplissage automatique du répertoire des ayants-droit)
        with Session(engine) as session:
            contract = Contract(
                contract_reference=f"CTR-GRP-{unique_suffix}",
                contract_type="CESSION_EDITION",
                publisher_name="UNE MUSIQUE",
                counterparty_name="Fabien NATAF",
                work_titles=[test_w1, test_w2],
                parties=[p.model_dump(mode="json") for p in result.parties],
                confidence_score=0.95,
            )
            session.add(contract)
            session.commit()
            session.refresh(contract)
            c_id = contract.id

        val_resp = self.client.post(
            f"/api/v1/contracts/{c_id}/validate",
            json={"approve": True, "validated_by": "juriste@korom.fr"},
        )
        self.assertEqual(val_resp.status_code, 200)

        # Vérifier que le répertoire RightHolderDirectory a bien été enrichi avec les coordonnées
        with Session(engine) as session:
            holders = list(session.exec(select(RightHolderDirectory)).all())
            nataf_dir = next((h for h in holders if "nataf" in h.full_name.lower()), None)
            self.assertIsNotNone(nataf_dir)
            self.assertEqual(nataf_dir.city, "PARIS")
            self.assertEqual(nataf_dir.postal_code, "75016")
            self.assertIn("Jean de la Fontaine", nataf_dir.postal_address or "")

            une_dir = next((h for h in holders if "musique" in h.full_name.lower()), None)
            self.assertIsNotNone(une_dir)
            self.assertEqual(une_dir.legal_form, "SAS")
            self.assertEqual(une_dir.postal_code, "92100")

        # 3. Test de création de groupe d'œuvres via l'endpoint dédié
        create_wg_resp = self.client.post(
            f"/api/v1/contracts/{c_id}/create-work-group",
            json={"name": wg_name, "group_type": "AUDIOVISUAL"},
        )
        self.assertEqual(create_wg_resp.status_code, 201)
        wg_data = create_wg_resp.json()
        self.assertEqual(wg_data["work_group_name"], wg_name)
        self.assertEqual(wg_data["group_type"], "AUDIOVISUAL")
        self.assertEqual(wg_data["linked_works_count"], 2)

        # Vérifier en base que les œuvres créées sont rattachées au WorkGroup
        with Session(engine) as session:
            wg = session.exec(select(WorkGroup).where(WorkGroup.name == wg_name)).first()
            self.assertIsNotNone(wg)
            links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == wg.id)).all()
            self.assertEqual(len(links), 2)

            w1 = session.exec(select(Work).where(Work.title == test_w1)).first()
            self.assertIsNotNone(w1)
            linked_work_ids = [l.work_id for l in links]
            self.assertIn(w1.id, linked_work_ids)

            # Vérifier que les quotes-parts de l'œuvre respectent strictement le contrat (66.66% DEP pour le créateur)
            splits_by_holder = {s["holder_name"]: Decimal(s["dep_share_pct"]) for s in w1.splits}
            self.assertEqual(splits_by_holder["Fabien NATAF"], Decimal("66.66"))
            self.assertEqual(splits_by_holder["LVA MUSIQUE"], Decimal("16.67"))
            self.assertEqual(splits_by_holder["UNE MUSIQUE"], Decimal("16.67"))
            self.assertEqual(sum(splits_by_holder.values()), Decimal("100.00"))
