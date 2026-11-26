import unittest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.contract import Contract
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink


class TestCGP1AndContractLinking(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)

        def get_test_session():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[get_session] = get_test_session
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_import_sacem_cgp1_file(self) -> None:
        cgp1_content = (
            "0000000000000000 CGP1SACEM 201402132014021320140213 N\n"
            "0000000130000001 000053065 00293192352 002681650522002120400000000 SHUT UP AND LISTEN MUSIC 072072072 BCORE DISC S L 072072072 G2002120400000005 000053065\n"
            "0000000231000001 + PR * WLMONDE ENTIER 001 VOOOALLALL0250000 NO N\n"
            "0000000331000001 + MR * WLMONDE ENTIER 001 VOOOALLALL0500000 NO N\n"
            "0000000540000001 COMCT DE CO EDITION AVEC BCORE DISC SL ET FREAK ZONE MUSIC\n"
            "9999999999999999 000001000005\n"
        )

        resp = self.client.post(
            "/api/v1/contracts/import-cgp1",
            files={"file": ("cgp1_detail_sacem.txt", cgp1_content.encode("utf-8"), "text/plain")},
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()

        self.assertEqual(data["format_detected"], "SACEM_CGP1")
        self.assertEqual(data["contracts_created"], 1)
        self.assertEqual(len(data["contracts"]), 1)

        c = data["contracts"][0]
        self.assertEqual(c["contract_reference"], "CTR-SACEM-53065")
        self.assertEqual(c["sacem_contract_number"], "53065")
        self.assertEqual(c["counterparty_name"], "SHUT UP AND LISTEN MUSIC")
        self.assertEqual(c["territory"], "MONDE ENTIER")
        self.assertEqual(c["validation_status"], "VALIDATED")

    def test_link_contract_to_work_group_and_holder_works(self) -> None:
        # 1. Créer un contrat
        with Session(self.engine) as session:
            contract = Contract(
                contract_reference="CTR-TF1-SERIES-2026",
                sacem_contract_number="891234",
                contract_type="CESSION_EDITION",
                publisher_name="Éditions Solstices Music",
                counterparty_name="Clara Silvestre",
            )
            session.add(contract)

            # Créer un projet audiovisuel
            group = WorkGroup(
                name="Série TF1 Clara Silvestre",
                group_type="SÉRIE TV",
            )
            session.add(group)

            # Créer deux œuvres
            w1 = Work(
                title="Générique TF1",
                splits=[{"holder_name": "Clara Silvestre", "role": "AC", "dep_share_pct": "50.00"}],
            )
            w2 = Work(
                title="Cue Suspense",
                splits=[{"holder_name": "Autre Artiste", "role": "AC", "dep_share_pct": "50.00"}],
            )
            session.add(w1)
            session.add(w2)
            session.commit()
            session.refresh(contract)
            session.refresh(group)
            session.refresh(w1)
            session.refresh(w2)

            # Lier w2 au groupe
            link = WorkGroupLink(work_id=w2.id, work_group_id=group.id)
            session.add(link)
            session.commit()

            contract_id = contract.id
            group_id = group.id
            w1_id = w1.id
            w2_id = w2.id

        # 2. Lier le contrat au WorkGroup
        resp_grp = self.client.post(
            f"/api/v1/contracts/{contract_id}/link-works",
            json={"target_mode": "WORK_GROUP", "work_group_id": str(group_id)},
        )
        self.assertEqual(resp_grp.status_code, 200)
        self.assertEqual(resp_grp.json()["linked_works_count"], 1)

        # Vérifier que w2 a hérité du contrat
        with Session(self.engine) as session:
            refreshed_w2 = session.get(Work, w2_id)
            self.assertEqual(refreshed_w2.contract_reference, "CTR-TF1-SERIES-2026")

        # 3. Lier le contrat via RIGHT_HOLDER_MATCH (sur Clara Silvestre)
        resp_holder = self.client.post(
            f"/api/v1/contracts/{contract_id}/link-works",
            json={"target_mode": "RIGHT_HOLDER_MATCH", "right_holder_name_or_ipi": "Clara Silvestre"},
        )
        self.assertEqual(resp_holder.status_code, 200)
        self.assertEqual(resp_holder.json()["linked_works_count"], 1)

        # Vérifier que w1 a été liée
        with Session(self.engine) as session:
            refreshed_w1 = session.get(Work, w1_id)
            self.assertEqual(refreshed_w1.contract_reference, "CTR-TF1-SERIES-2026")
