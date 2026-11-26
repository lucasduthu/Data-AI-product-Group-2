import io
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.database import engine
from app.main import app
from app.models.work import Work
from app.schemas.subpublishing import ComparisonStatus
from app.schemas.work import RightHolderSplit
from app.services.catalog_comparator import (
    apply_sacem_codes_to_works,
    compare_catalog_with_sacem,
)
from app.services.xlsx_exporter import (
    build_raw_xlsx_bytes,
    generate_subpublishing_delivery_xlsx,
)
from app.services.xlsx_parser import read_xlsx_as_csv


class TestSubpublishingDiffAndExport(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_xlsx_exporter_generation_and_roundtrip(self) -> None:
        """Vérifie la génération OpenXML .xlsx pure standard library et sa relecture déterministe."""
        w1 = Work(
            title="L'Hymne du Solstice",
            subtitle="Theme Version",
            alternate_titles=["Solstice Hymn"],
            sacem_work_code="111785573767",
            iswc="T-338.589.021-7",
            cotage_number="SOL-001",
            duration_seconds=195,
            genre="Musique de film",
            splits=[
                RightHolderSplit(
                    holder_name="Solstices Music Publishing",
                    role="E",
                    ipi_number="00891234567",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                    is_controlled=True,
                    controlled_by_name="Solstices Music Publishing",
                ),
                RightHolderSplit(
                    holder_name="Alexandre Composer",
                    role="C",
                    ipi_number="00150250028",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                    is_controlled=False,
                ),
            ],
        )

        xlsx_bytes = generate_subpublishing_delivery_xlsx(
            works=[w1],
            sub_publisher_name="Budde Music Germany",
            territory="GSA (Germany, Austria, Switzerland)",
            delivery_ref="LIV-2026-GSA-01",
            publisher_name="Solstices Music Publishing",
            publisher_ipi="00891234567",
        )

        self.assertIsInstance(xlsx_bytes, bytes)
        self.assertTrue(xlsx_bytes.startswith(b"PK\x03\x04"))

        # Relecture via notre parseur xlsx_parser
        csv_text = read_xlsx_as_csv(xlsx_bytes)
        self.assertIn("BORDEREAU DE LIVRAISON SOUS-ÉDITION INTERNATIONALE", csv_text)
        self.assertIn("Budde Music Germany", csv_text)
        self.assertIn("LIV-2026-GSA-01", csv_text)

    def test_catalog_comparator_and_diff_report(self) -> None:
        """Vérifie le rapprochement différentiel déterministe entre SACEM et Korom."""
        unique_suffix = uuid4().hex[:6]
        now = datetime.now(timezone.utc)

        cocv_sync = f"99{unique_suffix[:4]}1"
        cocv_disc = f"88{unique_suffix[:4]}2"
        cocv_sacem = f"77{unique_suffix[:4]}3"
        iswc_sync = "T-123.456.789-1"
        iswc_disc = "T-987.654.321-0"
        iswc_sacem = "T-555.444.333-2"

        # 1. Œuvre synchronisée exacte
        w_sync = Work(
            title=f"Sync Track {unique_suffix}",
            sacem_work_code=cocv_sync,
            iswc=iswc_sync,
            cotage_number="COT-SYNC",
            splits=[
                RightHolderSplit(
                    holder_name="Editions Solstices",
                    role="E",
                    ipi_number="00891234567",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                ).model_dump(mode="json"),
                RightHolderSplit(
                    holder_name="Auteur Un",
                    role="AC",
                    ipi_number="00112233445",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                ).model_dump(mode="json"),
            ],
            created_at=now,
        )

        # 2. Œuvre avec écart (code SACEM manquant sur Korom + écart de splits)
        w_disc = Work(
            title=f"Discrepancy Track {unique_suffix}",
            sacem_work_code=None,  # Manquant sur Korom
            iswc=None,             # Manquant sur Korom
            splits=[
                RightHolderSplit(
                    holder_name="Editions Solstices",
                    role="E",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                ).model_dump(mode="json"),
                RightHolderSplit(
                    holder_name="Auteur Deux",
                    role="AC",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                ).model_dump(mode="json"),
            ],
            created_at=now,
        )

        # 3. Œuvre locale Korom uniquement
        w_korom_only = Work(
            title=f"Korom Only Track {unique_suffix}",
            sacem_work_code=None,
            splits=[
                RightHolderSplit(
                    holder_name="Editions Solstices",
                    role="E",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                ).model_dump(mode="json"),
            ],
            created_at=now,
        )

        with Session(engine) as session:
            session.add_all([w_sync, w_disc, w_korom_only])
            session.commit()
            session.refresh(w_sync)
            session.refresh(w_disc)
            session.refresh(w_korom_only)

        # Simulation d'un fichier export SACEM contenant:
        # - w_sync (identique)
        # - w_disc (avec COCV '9998887771', ISWC 'T-987.654.321-0', et part DEP différente: 33.32%)
        # - un titre 'Sacem Only Extra Track'
        sacem_csv = (
            "Code oeuvre;Titre de l'oeuvre;Genre de l'oeuvre;Sous-titre(s);Nom de l'ayant-droit;Rôle;Statuts;Code IPI;Part DEP;Part DR;ISWC\n"
            f"{cocv_sync};Sync Track {unique_suffix};Variété;;Editions Solstices;E;Assujetti TVA;00891234567;50.00%;50.00%;{iswc_sync}\n"
            f"{cocv_sync};Sync Track {unique_suffix};Variété;;Auteur Un;AC;Précompte;00112233445;50.00%;50.00%;{iswc_sync}\n"
            f"{cocv_disc};Discrepancy Track {unique_suffix};B.O.;;Editions Solstices;E;Assujetti TVA;00891234567;33.32%;33.32%;{iswc_disc}\n"
            f"{cocv_disc};Discrepancy Track {unique_suffix};B.O.;;Auteur Deux;AC;Précompte;00998877665;66.68%;66.68%;{iswc_disc}\n"
            f"{cocv_sacem};Sacem Only Extra Track {unique_suffix};B.O.;;Autre Editeur;E;Assujetti TVA;00991122334;50.00%;50.00%;{iswc_sacem}\n"
        )

        with Session(engine) as session:
            report = compare_catalog_with_sacem(
                raw_data=sacem_csv,
                session=session,
            )

        # Vérification des statistiques
        self.assertGreaterEqual(report.total_compared, 4)
        items_by_title = {
            (item.title_korom or item.title_sacem): item for item in report.items
        }

        # 1. Vérification Sync
        sync_item = items_by_title.get(f"Sync Track {unique_suffix}")
        self.assertIsNotNone(sync_item)
        self.assertEqual(sync_item.status, ComparisonStatus.SYNCHRONIZED)
        self.assertEqual(len(sync_item.discrepancies), 0)

        # 2. Vérification Discrepancy
        disc_item = items_by_title.get(f"Discrepancy Track {unique_suffix}")
        self.assertIsNotNone(disc_item)
        self.assertEqual(disc_item.status, ComparisonStatus.DISCREPANCY)
        self.assertTrue(disc_item.can_apply_sacem_codes)
        self.assertEqual(disc_item.sacem_work_code_sacem, cocv_disc)
        self.assertEqual(disc_item.iswc_sacem, iswc_disc)

        # 3. Vérification Korom Only
        ko_item = items_by_title.get(f"Korom Only Track {unique_suffix}")
        self.assertIsNotNone(ko_item)
        self.assertEqual(ko_item.status, ComparisonStatus.KOROM_ONLY)

        # 4. Vérification SACEM Only
        so_item = items_by_title.get(f"Sacem Only Extra Track {unique_suffix}")
        self.assertIsNotNone(so_item)
        self.assertEqual(so_item.status, ComparisonStatus.SACEM_ONLY)

    def test_apply_sacem_codes_endpoint(self) -> None:
        """Vérifie l'application 1-clic des identifiants officiels SACEM sur une œuvre."""
        with Session(engine) as session:
            work = Work(
                title=f"Work To Enrich {uuid4().hex[:6]}",
                sacem_work_code=None,
                iswc=None,
                splits=[],
            )
            session.add(work)
            session.commit()
            session.refresh(work)
            w_id = work.id

        resp = self.client.post(
            "/api/v1/subpublishing/apply-sacem-codes",
            json={
                "items": [
                    {
                        "work_id": str(w_id),
                        "sacem_work_code": "111736844967",
                        "iswc": "T-338.589.021-7",
                    }
                ]
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["updated_works_count"], 1)

        # Vérification en base
        with Session(engine) as session:
            updated = session.get(Work, w_id)
            self.assertIsNotNone(updated)
            self.assertEqual(updated.sacem_work_code, "111736844967")
            self.assertEqual(updated.iswc, "T-338.589.021-7")
            self.assertTrue(len(updated.timeline_notes) > 0)
            self.assertIn("Atelier Synchronisation SACEM", updated.timeline_notes[0]["author"])

    def test_subpublishing_delivery_exports_api(self) -> None:
        """Vérifie les deux formats de livraison sous-édition (Excel .xlsx et CWR v2.1)."""
        with Session(engine) as session:
            w1 = Work(
                title=f"Track For SubPub {uuid4().hex[:6]}",
                sacem_work_code="1112223334",
                iswc="T-001.002.003-4",
                cotage_number="SUB-COT-01",
                splits=[
                    RightHolderSplit(
                        holder_name="Solstices Music",
                        role="E",
                        ipi_number="00891234567",
                        dep_share_pct=Decimal("50.00"),
                        drm_share_pct=Decimal("50.00"),
                        share_percentage=Decimal("50.00"),
                    ).model_dump(mode="json"),
                    RightHolderSplit(
                        holder_name="Compositeur Sub",
                        role="C",
                        ipi_number="00112233445",
                        dep_share_pct=Decimal("50.00"),
                        drm_share_pct=Decimal("50.00"),
                        share_percentage=Decimal("50.00"),
                    ).model_dump(mode="json"),
                ],
            )
            session.add(w1)
            session.commit()
            session.refresh(w1)
            w1_id = str(w1.id)

        # 1. Test Export Excel .xlsx
        xlsx_resp = self.client.post(
            "/api/v1/subpublishing/export-delivery-xlsx",
            json={
                "work_ids": [w1_id],
                "sub_publisher_name": "Kassner Music UK",
                "territory": "United Kingdom & Eire",
                "delivery_reference": "LIV-UK-2026-01",
            },
        )
        self.assertEqual(xlsx_resp.status_code, 200)
        self.assertIn(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            xlsx_resp.headers["content-type"],
        )
        self.assertTrue(xlsx_resp.content.startswith(b"PK\x03\x04"))

        # 2. Test Export CWR v2.1
        cwr_resp = self.client.post(
            "/api/v1/subpublishing/export-delivery-cwr",
            json={
                "work_ids": [w1_id],
                "sub_publisher_name": "Kassner Music UK",
                "territory": "United Kingdom & Eire",
                "delivery_reference": "LIV-UK-2026-01",
            },
        )
        self.assertEqual(cwr_resp.status_code, 200)
        cwr_data = cwr_resp.json()
        self.assertEqual(cwr_data["cwr_version"], "2.1")
        self.assertIn("content", cwr_data)
        self.assertIn("NWR", cwr_data["content"])
        self.assertIn("Kassner Music UK", cwr_data["sub_publisher"]["name"])
