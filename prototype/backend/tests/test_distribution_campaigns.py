from datetime import date
from decimal import Decimal
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.campaign import DistributionCampaign
from app.models.contract import AdvanceLedger, Contract
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.schemas.common import ValidationStatus


class TestDistributionCampaigns(unittest.TestCase):
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

    def test_campaign_crud_and_attachment(self):
        with Session(self.engine) as session:
            stmt1 = RoyaltyStatement(
                source_name="SACEM S1 2026",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("1500.00"),
            )
            stmt2 = RoyaltyStatement(
                source_name="Spotify Jan-Jun 2026",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("2300.00"),
            )
            session.add(stmt1)
            session.add(stmt2)
            session.commit()
            session.refresh(stmt1)
            session.refresh(stmt2)
            s1_id = str(stmt1.id)
            s2_id = str(stmt2.id)

        # 1. Créer la campagne avec rattachement
        res = self.client.post(
            "/api/v1/campaigns",
            json={
                "name": "Campagne Semestrielle 2026-S1",
                "period_start": "2026-01-01",
                "period_end": "2026-06-30",
                "notes": "Clôture semestrielle consolidée SACEM + Spotify",
                "statement_ids": [s1_id, s2_id],
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        campaign_id = data["id"]
        self.assertEqual(data["name"], "Campagne Semestrielle 2026-S1")
        self.assertEqual(data["statements_count"], 2)
        self.assertEqual(Decimal(str(data["total_gross_amount"])), Decimal("3800.00"))
        self.assertEqual(data["accounting_status"], "DRAFT")

        # 2. Vérifier le get
        res_get = self.client.get(f"/api/v1/campaigns/{campaign_id}")
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(len(res_get.json()["statements"]), 2)

        # 3. Détacher un relevé
        res_detach = self.client.delete(f"/api/v1/campaigns/{campaign_id}/statements/{s2_id}")
        self.assertEqual(res_detach.status_code, 200)
        self.assertEqual(res_detach.json()["statements_count"], 1)
        self.assertEqual(Decimal(str(res_detach.json()["total_gross_amount"])), Decimal("1500.00"))

        # 4. Rattacher à nouveau
        res_attach = self.client.post(
            f"/api/v1/campaigns/{campaign_id}/statements",
            json={"statement_ids": [s2_id]},
        )
        self.assertEqual(res_attach.status_code, 200)
        self.assertEqual(res_attach.json()["statements_count"], 2)

    def test_consolidated_payout_multi_source_threshold_aggregation(self):
        """Vérifie la règle métier fondamentale :
        Un ayant droit percevant 30 € de SACEM et 30 € de Spotify (chacun < 50 € isolément)
        cumule 60 € dans la campagne consolidée et devient PAYABLE (> 50 €).
        """
        with Session(self.engine) as session:
            # 1. Créer l'ayant droit dans l'annuaire
            holder = RightHolderDirectory(
                full_name="Thomas Bangalter",
                role="AC",
                ipi_number="00123456789",
                entity_type="PERSONNE_PHYSIQUE",
                urssaf_dispense_certificate=True,
                vat_applicable=False,
                iban="FR0830004019920005554443210",
                bic="BNPAFRPPXXX",
            )
            session.add(holder)

            # 2. Créer une œuvre avec 100% de split pour Thomas Bangalter
            work = Work(
                title="Consolidated Hit",
                iswc="T-999.888.777-1",
                splits=[
                    {
                        "holder_name": "Thomas Bangalter",
                        "role": "AC",
                        "ipi_number": "00123456789",
                        "dep_share_pct": "100.00",
                        "drm_share_pct": "100.00",
                        "sync_share_pct": "100.00",
                        "phono_share_pct": "100.00",
                        "share_percentage": "100.00",
                    }
                ],
            )
            session.add(work)
            session.commit()
            session.refresh(holder)
            session.refresh(work)

            # 3. Créer relevé 1 (SACEM) avec 30.00 €
            stmt_sacem = RoyaltyStatement(
                source_name="SACEM",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("30.00"),
            )
            session.add(stmt_sacem)
            session.commit()
            session.refresh(stmt_sacem)

            line1 = StatementLine(
                statement_id=stmt_sacem.id,
                row_number=1,
                raw_work_title="Consolidated Hit",
                gross_amount=Decimal("30.00"),
                matched_work_id=work.id,
                matched_work_title=work.title,
                validation_status=ValidationStatus.VALIDATED.value,
                allocations=[
                    {
                        "holder_name": "Thomas Bangalter",
                        "role": "AC",
                        "ipi_number": "00123456789",
                        "share_percentage": "100.00",
                        "allocated_amount": "30.00",
                        "net_payable_amount": "30.00",
                    }
                ],
            )
            session.add(line1)

            # 4. Créer relevé 2 (Spotify) avec 30.00 €
            stmt_spotify = RoyaltyStatement(
                source_name="Spotify",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("30.00"),
            )
            session.add(stmt_spotify)
            session.commit()
            session.refresh(stmt_spotify)

            line2 = StatementLine(
                statement_id=stmt_spotify.id,
                row_number=1,
                raw_work_title="Consolidated Hit",
                gross_amount=Decimal("30.00"),
                matched_work_id=work.id,
                matched_work_title=work.title,
                validation_status=ValidationStatus.VALIDATED.value,
                allocations=[
                    {
                        "holder_name": "Thomas Bangalter",
                        "role": "AC",
                        "ipi_number": "00123456789",
                        "share_percentage": "100.00",
                        "allocated_amount": "30.00",
                        "net_payable_amount": "30.00",
                    }
                ],
            )
            session.add(line2)
            session.commit()

            sacem_id = stmt_sacem.id
            spotify_id = stmt_spotify.id

        # Vérification : Sur le relevé SACEM isolé, 30 € < 50 € -> BELOW_THRESHOLD
        res_iso = self.client.post(f"/api/v1/statements/{sacem_id}/compute-royalties")
        self.assertEqual(res_iso.status_code, 200)
        iso_report = res_iso.json()
        self.assertEqual(iso_report["below_threshold_count"], 1)
        self.assertEqual(iso_report["holder_statements"][0]["payout_status"], "BELOW_THRESHOLD")
        self.assertEqual(Decimal(str(iso_report["holder_statements"][0]["net_payable_amount"])), Decimal("0.00"))

        # 5. Créer la campagne consolidée avec les 2 relevés
        with Session(self.engine) as session:
            campaign = DistributionCampaign(
                name="Campagne Test 2026-S1",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
            )
            session.add(campaign)
            session.commit()
            session.refresh(campaign)

            s_sacem = session.get(RoyaltyStatement, sacem_id)
            s_spotify = session.get(RoyaltyStatement, spotify_id)
            s_sacem.campaign_id = campaign.id
            s_spotify.campaign_id = campaign.id
            session.add(s_sacem)
            session.add(s_spotify)
            session.commit()
            camp_id = campaign.id

        # 6. Interroger les décomptes consolidés
        res_camp = self.client.get(f"/api/v1/campaigns/{camp_id}/consolidated-payouts")
        self.assertEqual(res_camp.status_code, 200)
        camp_report = res_camp.json()

        self.assertEqual(camp_report["total_statements_count"], 2)
        self.assertEqual(Decimal(str(camp_report["total_campaign_gross"])), Decimal("60.00"))
        self.assertEqual(camp_report["payable_holders_count"], 1)
        self.assertEqual(camp_report["below_threshold_count"], 0)

        payout = camp_report["holders_payouts"][0]
        self.assertEqual(payout["holder_name"], "Thomas Bangalter")
        self.assertEqual(Decimal(str(payout["total_gross_allocated"])), Decimal("60.00"))
        self.assertEqual(Decimal(str(payout["net_payable_amount"])), Decimal("60.00"))
        self.assertEqual(payout["payout_status"], "PAYABLE")
        self.assertFalse(payout["is_below_payment_threshold"])

        # Vérifier le détail par source (SACEM + Spotify)
        sources = payout["sources_breakdown"]
        self.assertEqual(len(sources), 2)
        source_names = {s["source_name"] for s in sources}
        self.assertEqual(source_names, {"SACEM", "Spotify"})
        for s in sources:
            self.assertEqual(Decimal(str(s["allocated_gross"])), Decimal("30.00"))

        # 7. Clôturer et sceller la campagne
        res_lock = self.client.post(
            f"/api/v1/campaigns/{camp_id}/lock",
            json={
                "payment_reference": "SEPA-2026-S1-BATCH-001",
                "payment_method": "VIREMENT_SEPA",
                "payment_notes": "Règlement consolidé semestriel SACEM + Spotify",
            },
        )
        self.assertEqual(res_lock.status_code, 200)
        lock_data = res_lock.json()
        self.assertTrue(lock_data["is_locked"])
        self.assertEqual(lock_data["accounting_status"], "LOCKED")
        self.assertIsNotNone(lock_data["integrity_hash"])
        self.assertEqual(len(lock_data["integrity_hash"]), 64)  # SHA-256

        # 8. Prévisualiser le virement SEPA consolidé
        res_sepa_prev = self.client.get(f"/api/v1/campaigns/{camp_id}/sepa-preview")
        self.assertEqual(res_sepa_prev.status_code, 200)
        sepa_prev = res_sepa_prev.json()
        self.assertEqual(sepa_prev["total_valid_recipients"], 1)
        self.assertEqual(Decimal(str(sepa_prev["total_amount_eur"])), Decimal("60.00"))

        # 9. Exporter le fichier XML SEPA pain.001 consolidé
        res_sepa_xml = self.client.post(
            f"/api/v1/campaigns/{camp_id}/export-sepa",
            json={
                "debtor_name": "KOROM PUBLISHING SAS",
                "debtor_iban": "FR0830004019920005554443210",
                "debtor_bic": "BNPAFRPPXXX",
                "remittance_prefix": "KOROM ROYALTIES 2026-S1",
            },
        )
        self.assertEqual(res_sepa_xml.status_code, 200)
        sepa_xml_data = res_sepa_xml.json()
        self.assertEqual(sepa_xml_data["total_transactions"], 1)
        self.assertEqual(Decimal(str(sepa_xml_data["total_amount_eur"])), Decimal("60.00"))
        self.assertIn("<Document xmlns=", sepa_xml_data["xml_content"])
        self.assertIn("pain.001.001.03", sepa_xml_data["xml_content"])
        self.assertTrue("Thomas Bangalter" in sepa_xml_data["xml_content"] or "THOMAS BANGALTER" in sepa_xml_data["xml_content"])

    def test_consolidated_advance_recoupment_and_contract_sync(self):
        """Vérifie que l'avance de 70 € est amortie sur le cumul des redevances brutes (50 € SACEM + 50 € Spotify = 100 €),
        laissant un net imposable de 30 € (< 50 € seuil) -> BELOW_THRESHOLD, et que le solde est mis à jour lors du lock.
        """
        with Session(self.engine) as session:
            holder = RightHolderDirectory(
                full_name="Guy-Manuel de Homem-Christo",
                role="AC",
                ipi_number="00987654321",
                entity_type="PERSONNE_PHYSIQUE",
                urssaf_dispense_certificate=True,
                vat_applicable=False,
                iban="FR0830004019920005554443210",
                bic="BNPAFRPPXXX",
            )
            session.add(holder)

            contract = Contract(
                contract_reference="CTR-GUYMAN-2026",
                contract_type="CESSION_EDITION",
                publisher_name="KOROM PUBLISHING",
                counterparty_name="Guy-Manuel de Homem-Christo",
                advance_amount=Decimal("70.00"),
                recouped_amount=Decimal("0.00"),
                work_titles=["One More Time"],
            )
            session.add(contract)

            work = Work(
                title="One More Time",
                iswc="T-123.456.789-0",
                contract_reference="CTR-GUYMAN-2026",
                splits=[
                    {
                        "holder_name": "Guy-Manuel de Homem-Christo",
                        "role": "AC",
                        "ipi_number": "00987654321",
                        "dep_share_pct": "100.00",
                        "drm_share_pct": "100.00",
                        "sync_share_pct": "100.00",
                        "phono_share_pct": "100.00",
                        "share_percentage": "100.00",
                    }
                ],
            )
            session.add(work)
            session.commit()
            session.refresh(holder)
            session.refresh(contract)
            session.refresh(work)

            contract.right_holder_id = holder.id
            session.add(contract)

            # Relevé 1 : SACEM 50 €
            stmt1 = RoyaltyStatement(
                source_name="SACEM S1",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("50.00"),
            )
            session.add(stmt1)
            session.commit()
            session.refresh(stmt1)

            l1 = StatementLine(
                statement_id=stmt1.id,
                row_number=1,
                raw_work_title="One More Time",
                gross_amount=Decimal("50.00"),
                matched_work_id=work.id,
                matched_work_title=work.title,
                validation_status=ValidationStatus.VALIDATED.value,
                allocations=[
                    {
                        "holder_name": "Guy-Manuel de Homem-Christo",
                        "role": "AC",
                        "ipi_number": "00987654321",
                        "share_percentage": "100.00",
                        "allocated_amount": "50.00",
                    }
                ],
            )
            session.add(l1)

            # Relevé 2 : Spotify 50 €
            stmt2 = RoyaltyStatement(
                source_name="Spotify S1",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                total_gross_amount=Decimal("50.00"),
            )
            session.add(stmt2)
            session.commit()
            session.refresh(stmt2)

            l2 = StatementLine(
                statement_id=stmt2.id,
                row_number=1,
                raw_work_title="One More Time",
                gross_amount=Decimal("50.00"),
                matched_work_id=work.id,
                matched_work_title=work.title,
                validation_status=ValidationStatus.VALIDATED.value,
                allocations=[
                    {
                        "holder_name": "Guy-Manuel de Homem-Christo",
                        "role": "AC",
                        "ipi_number": "00987654321",
                        "share_percentage": "100.00",
                        "allocated_amount": "50.00",
                    }
                ],
            )
            session.add(l2)

            # Campagne
            campaign = DistributionCampaign(
                name="Campagne Avance 2026-S1",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
            )
            session.add(campaign)
            session.commit()
            session.refresh(campaign)

            stmt1.campaign_id = campaign.id
            stmt2.campaign_id = campaign.id
            session.add(stmt1)
            session.add(stmt2)
            session.commit()
            c_id = campaign.id
            contract_id = contract.id

        # Calcul consolidé
        res = self.client.get(f"/api/v1/campaigns/{c_id}/consolidated-payouts")
        self.assertEqual(res.status_code, 200)
        report = res.json()
        self.assertEqual(len(report["holders_payouts"]), 1)
        p = report["holders_payouts"][0]
        # Brut total = 100.00 €
        self.assertEqual(Decimal(str(p["total_gross_allocated"])), Decimal("100.00"))
        # Avance = 70.00 €, amortie en totalité
        self.assertEqual(Decimal(str(p["recouped_in_period"])), Decimal("70.00"))
        self.assertEqual(Decimal(str(p["remaining_unrecouped_balance"])), Decimal("0.00"))
        # Net après avance = 30.00 € (< 50 € seuil) -> BELOW_THRESHOLD
        self.assertEqual(p["payout_status"], "BELOW_THRESHOLD")
        self.assertEqual(Decimal(str(p["retained_in_reserve"])), Decimal("30.00"))
        self.assertEqual(Decimal(str(p["net_payable_amount"])), Decimal("0.00"))

        # Clôture
        res_lock = self.client.post(f"/api/v1/campaigns/{c_id}/lock")
        self.assertEqual(res_lock.status_code, 200)

        # Vérifier que le contrat a bien été mis à jour avec les 70.00 € amortis
        with Session(self.engine) as session:
            ctr = session.get(Contract, contract_id)
            self.assertEqual(Decimal(str(ctr.recouped_amount)), Decimal("70.00"))

