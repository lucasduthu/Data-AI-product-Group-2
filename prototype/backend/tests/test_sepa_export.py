from datetime import date
from decimal import Decimal
import unittest
import xml.etree.ElementTree as ET

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.contract import Contract
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.models.workspace_settings import WorkspaceSettings
from app.schemas.common import ValidationStatus
from app.schemas.work import RightHolderRole, RightHolderSplit
from app.services.sepa_generator import (
    clean_iban,
    format_iban,
    sanitize_xml_text,
    validate_bic,
    validate_iban,
)


class TestSepaExport(unittest.TestCase):
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

    def test_iban_and_bic_validation(self) -> None:
        """Vérifie la conformité de l'algorithme de contrôle de clé modulo-97 et des codes BIC."""
        # IBANs valides réels/mathématiques (modulo 97 == 1)
        valid_fr = "FR0830004019920005554443210"
        self.assertTrue(validate_iban(valid_fr))
        self.assertTrue(validate_iban("FR08 3000 4019 9200 0555 4443 210"))

        # IBAN invalide (clé modifiée)
        invalid_fr = "FR7630004019920005554443210"
        self.assertFalse(validate_iban(invalid_fr))

        # IBAN invalide trop court ou trop long
        self.assertFalse(validate_iban("FR1234"))
        self.assertFalse(validate_iban("FR" + "0" * 35))

        # Nettoyage et formatage
        self.assertEqual(clean_iban("fr08 3000-4019"), "FR0830004019")
        self.assertEqual(format_iban("FR0830004019920005554443210"), "FR08 3000 4019 9200 0555 4443 210")

        # Validation BIC / SWIFT
        self.assertTrue(validate_bic("BNPAFRPPXXX"))
        self.assertTrue(validate_bic("BNPAFRPP"))
        self.assertTrue(validate_bic(None))
        self.assertTrue(validate_bic(""))
        self.assertFalse(validate_bic("INVALID_BIC_TOO_LONG"))
        self.assertFalse(validate_bic("1234"))

    def test_sanitize_xml_text(self) -> None:
        """Vérifie l'échappement des entités XML et le nettoyage des caractères diacritiques."""
        raw = "Éditions & Cie <L'Héritier> \"Successeur\""
        sanitized = sanitize_xml_text(raw, max_length=50)
        self.assertIn("&amp;", sanitized)
        self.assertIn("&lt;", sanitized)
        self.assertIn("&gt;", sanitized)
        self.assertIn("&quot;", sanitized)
        self.assertIn("&apos;", sanitized)
        # Les accents sont normalisés en ASCII
        self.assertIn("Editions", sanitized)

    def test_sepa_preview_and_xml_export_workflow(self) -> None:
        """Vérifie le cycle complet d'audit préalable et de génération du fichier SEPA XML pain.001."""
        with Session(self.engine) as session:
            # 1. Configuration de l'éditeur
            ws = session.exec(select(WorkspaceSettings)).first()
            if not ws:
                ws = WorkspaceSettings(publisher_name="Éditions Solstices Music")
                session.add(ws)
            ws.publisher_iban = "FR0830004019920005554443210"
            ws.publisher_bic = "BNPAFRPPXXX"
            ws.min_payment_threshold = Decimal("50.00")
            session.add(ws)

            # 2. Création d'œuvres au catalogue
            work = Work(
                title="Lumière Noire SEPA",
                iswc="T-301.999.888-1",
                splits=[
                    {
                        "holder_name": "Camille Moreau",
                        "role": "AC",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                        "share_percentage": "50.00",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                        "share_percentage": "50.00",
                    },
                ],
            )
            session.add(work)

            work2 = Work(
                title="Micro Oeuvre",
                splits=[
                    {
                        "holder_name": "Artiste Sous Seuil",
                        "role": "A",
                        "dep_share_pct": "100.00",
                        "drm_share_pct": "100.00",
                        "sync_share_pct": "100.00",
                        "phono_share_pct": "100.00",
                        "share_percentage": "100.00",
                    }
                ],
            )
            session.add(work2)

            # 3. Ayants droit dans l'annuaire
            holder = RightHolderDirectory(
                full_name="Camille Moreau",
                primary_role="AC",
                iban="FR0830004019920005554443210",
                bic="BNPAFRPPXXX",
                vat_applicable=False,
                urssaf_dispense_certificate=True,
            )
            session.add(holder)

            holder_below = RightHolderDirectory(
                full_name="Artiste Sous Seuil",
                primary_role="A",
                iban="FR0830004019920005554443210",
                bic="BNPAFRPPXXX",
            )
            session.add(holder_below)

            # 4. Création d'un relevé
            stmt = RoyaltyStatement(
                source_name="Relevé SEPA Test Q3 2026",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 9, 30),
                total_gross_amount=Decimal("1030.00"),
                accounting_status="DRAFT",
            )
            session.add(stmt)
            session.commit()
            session.refresh(stmt)

            line1 = StatementLine(
                statement_id=stmt.id,
                row_number=1,
                raw_work_title="Lumière Noire SEPA",
                raw_iswc="T-301.999.888-1",
                right_type="DEP",
                exploitation_type="PUBLIC_PERFORMANCE",
                gross_amount=Decimal("1000.000000"),
                matched_work_id=work.id,
                matched_work_title=work.title,
                validation_status=ValidationStatus.VALIDATED.value,
                allocations=[
                    {
                        "holder_name": "Camille Moreau",
                        "role": "AC",
                        "share_percentage": "50.00",
                        "allocated_amount": "500.00",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "share_percentage": "50.00",
                        "allocated_amount": "500.00",
                    },
                ],
            )
            line2 = StatementLine(
                statement_id=stmt.id,
                row_number=2,
                raw_work_title="Micro Oeuvre",
                right_type="DRM",
                exploitation_type="STREAMING",
                gross_amount=Decimal("30.000000"),
                matched_work_id=work2.id,
                matched_work_title=work2.title,
                validation_status=ValidationStatus.VALIDATED.value,
                allocations=[
                    {
                        "holder_name": "Artiste Sous Seuil",
                        "role": "A",
                        "share_percentage": "100.00",
                        "allocated_amount": "30.00",
                    }
                ],
            )
            session.add(line1)
            session.add(line2)
            session.commit()
            stmt_id = stmt.id

        # 5. Appel de l'audit pré-vol GET /sepa-preview
        preview_res = self.client.get(
            f"/api/v1/statements/{stmt_id}/sepa-preview",
            params={"allow_unverified_ibans": "true"},
        )
        self.assertEqual(preview_res.status_code, 200)
        preview_data = preview_res.json()

        self.assertEqual(preview_data["statement_id"], str(stmt_id))
        self.assertTrue(preview_data["is_ready_for_export"])
        self.assertEqual(preview_data["total_valid_recipients"], 1)  # Camille Moreau
        self.assertEqual(Decimal(str(preview_data["total_amount_eur"])), Decimal("500.00"))

        skipped = preview_data["skipped"]
        self.assertTrue(any("Artiste Sous Seuil" in s["name"] for s in skipped))

        # 6. Appel de la génération POST /export-sepa
        export_payload = {
            "execution_date": "2026-11-15",
            "remittance_prefix": "KOROM EDITIONS Q3",
            "allow_unverified_ibans": True,
        }
        export_res = self.client.post(
            f"/api/v1/statements/{stmt_id}/export-sepa",
            json=export_payload,
        )
        self.assertEqual(export_res.status_code, 200)
        export_data = export_res.json()

        self.assertTrue(export_data["filename"].startswith("SEPA_PAIN001_"))
        self.assertEqual(export_data["total_transactions"], 1)
        self.assertEqual(Decimal(str(export_data["total_amount_eur"])), Decimal("500.00"))
        self.assertEqual(export_data["execution_date"], "2026-11-15")

        xml_text = export_data["xml_content"]
        self.assertIn('<?xml version="1.0" encoding="UTF-8"?>', xml_text)
        self.assertIn('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"', xml_text)
        self.assertIn("<NbOfTxs>1</NbOfTxs>", xml_text)
        self.assertIn("<CtrlSum>500.00</CtrlSum>", xml_text)
        self.assertIn("<ReqdExctnDt>2026-11-15</ReqdExctnDt>", xml_text)
        self.assertIn("FR0830004019920005554443210", xml_text)
        self.assertIn("Camille Moreau", xml_text)
        self.assertIn("500.00", xml_text)
        self.assertIn("KOROM EDITIONS Q3", xml_text)

        # Validation que le XML est bien formé (parsable par ElementTree)
        root = ET.fromstring(xml_text)
        self.assertTrue(root.tag.endswith("Document"))

    def test_sepa_export_with_succession_heirs(self) -> None:
        """Vérifie que la dévolution successorale (US-4.2) ventile automatiquement les virements par héritier."""
        with Session(self.engine) as session:
            ws = session.exec(select(WorkspaceSettings)).first()
            if not ws:
                ws = WorkspaceSettings(publisher_name="Éditions Solstices Music")
                session.add(ws)
            ws.publisher_iban = "FR0830004019920005554443210"
            session.add(ws)

            # Auteur décédé avec 2 héritiers (50% / 50%)
            deceased_holder = RightHolderDirectory(
                full_name="Jean Auteur Décédé",
                primary_role="C",
                is_deceased=True,
                succession_active=True,
                vat_applicable=False,
                urssaf_dispense_certificate=True,
                heirs=[
                    {
                        "heir_name": "Paul Auteur",
                        "relationship": "Fils",
                        "share_pct": "50.00",
                        "iban": "FR0830004019920005554443210",
                        "bic": "BNPAFRPPXXX",
                    },
                    {
                        "heir_name": "Marie Auteur",
                        "relationship": "Fille",
                        "share_pct": "50.00",
                        "iban": "FR0830004019920005554443210",
                        "bic": "BNPAFRPPXXX",
                    },
                ],
            )
            session.add(deceased_holder)

            work_succ = Work(
                title="Symphonie Posthume",
                splits=[
                    {
                        "holder_name": "Jean Auteur Décédé",
                        "role": "C",
                        "dep_share_pct": "100.00",
                        "drm_share_pct": "100.00",
                        "share_percentage": "100.00",
                    }
                ],
            )
            session.add(work_succ)

            stmt_succ = RoyaltyStatement(
                source_name="Relevé Succession",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("1000.00"),
                accounting_status="DRAFT",
            )
            session.add(stmt_succ)
            session.commit()
            session.refresh(stmt_succ)

            line = StatementLine(
                statement_id=stmt_succ.id,
                row_number=1,
                raw_work_title="Symphonie Posthume",
                right_type="DEP",
                exploitation_type="CONCERT",
                gross_amount=Decimal("1000.000000"),
                matched_work_id=work_succ.id,
                matched_work_title=work_succ.title,
                validation_status=ValidationStatus.VALIDATED.value,
                allocations=[
                    {
                        "holder_name": "Jean Auteur Décédé",
                        "role": "C",
                        "share_percentage": "100.00",
                        "allocated_amount": "1000.00",
                    }
                ],
            )
            session.add(line)
            session.commit()
            stmt_id = stmt_succ.id

        # Génération SEPA
        res = self.client.post(
            f"/api/v1/statements/{stmt_id}/export-sepa",
            json={"allow_unverified_ibans": True},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Doit contenir 2 virements distincts de 500 € chacun pour les deux héritiers
        self.assertEqual(data["total_transactions"], 2)
        self.assertEqual(Decimal(str(data["total_amount_eur"])), Decimal("1000.00"))
        payee_names = [p["name"] for p in data["included_payees"]]
        self.assertIn("Paul Auteur", payee_names)
        self.assertIn("Marie Auteur", payee_names)

        xml_text = data["xml_content"]
        self.assertIn("<NbOfTxs>2</NbOfTxs>", xml_text)
        self.assertIn("<CtrlSum>1000.00</CtrlSum>", xml_text)
        self.assertIn("Paul Auteur", xml_text)
        self.assertIn("Marie Auteur", xml_text)
