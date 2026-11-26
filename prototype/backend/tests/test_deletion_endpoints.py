import unittest
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app
from app.models.contract import AdvanceLedger, Contract, RoyaltyLedgerEntry
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink


class TestDeletionEndpoints(unittest.TestCase):
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

    def test_delete_work_cascades_work_group_links(self) -> None:
        with Session(self.engine) as session:
            work = Work(
                title="Test Work Deletion",
                splits=[],
            )
            session.add(work)
            group = WorkGroup(
                name="Projet Deletion Test",
                group_type="SERIE_TV",
            )
            session.add(group)
            session.commit()
            session.refresh(work)
            session.refresh(group)

            link = WorkGroupLink(work_id=work.id, work_group_id=group.id)
            session.add(link)
            session.commit()
            work_id = work.id

        resp = self.client.delete(f"/api/v1/works/{work_id}")
        self.assertEqual(resp.status_code, 204)

        with Session(self.engine) as session:
            self.assertIsNone(session.get(Work, work_id))
            links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_id == work_id)).all()
            self.assertEqual(len(links), 0)

    def test_delete_holder_decouples_contracts_and_ledgers(self) -> None:
        with Session(self.engine) as session:
            holder = RightHolderDirectory(
                full_name="Jean Dupont Test",
                entity_type="PERSONNE_PHYSIQUE",
            )
            session.add(holder)
            session.commit()
            session.refresh(holder)
            holder_id = holder.id

            contract = Contract(
                contract_reference="CTR-TEST-DEL-01",
                publisher_name="Editions Test",
                counterparty_name="Jean Dupont Test",
                right_holder_id=holder_id,
            )
            session.add(contract)

            ledger = AdvanceLedger(
                contract_id=uuid4(),
                contract_reference="CTR-TEST-DEL-01",
                right_holder_id=holder_id,
                holder_name="Jean Dupont Test",
                initial_advance=Decimal("1000.00"),
                recouped_amount=Decimal("0.00"),
            )
            session.add(ledger)
            session.commit()
            session.refresh(contract)
            session.refresh(ledger)
            contract_id = contract.id
            ledger_id = ledger.id

        resp = self.client.delete(f"/api/v1/holders/{holder_id}")
        self.assertEqual(resp.status_code, 204)

        with Session(self.engine) as session:
            self.assertIsNone(session.get(RightHolderDirectory, holder_id))
            updated_contract = session.get(Contract, contract_id)
            self.assertIsNotNone(updated_contract)
            self.assertIsNone(updated_contract.right_holder_id)
            updated_ledger = session.get(AdvanceLedger, ledger_id)
            self.assertIsNotNone(updated_ledger)
            self.assertIsNone(updated_ledger.right_holder_id)

    def test_delete_contract_cleans_advance_ledgers(self) -> None:
        with Session(self.engine) as session:
            contract = Contract(
                contract_reference="CTR-TEST-DEL-02",
                publisher_name="Editions Test",
                counterparty_name="Artiste Test",
                advance_amount=Decimal("5000.00"),
            )
            session.add(contract)
            session.commit()
            session.refresh(contract)
            contract_id = contract.id

            ledger = AdvanceLedger(
                contract_id=contract_id,
                contract_reference="CTR-TEST-DEL-02",
                holder_name="Artiste Test",
                initial_advance=Decimal("5000.00"),
                recouped_amount=Decimal("0.00"),
            )
            session.add(ledger)

            entry = RoyaltyLedgerEntry(
                statement_id=uuid4(),
                contract_id=contract_id,
                contract_reference="CTR-TEST-DEL-02",
                holder_name="Artiste Test",
            )
            session.add(entry)
            session.commit()
            session.refresh(ledger)
            session.refresh(entry)
            ledger_id = ledger.id
            entry_id = entry.id

        resp = self.client.delete(f"/api/v1/contracts/{contract_id}")
        self.assertEqual(resp.status_code, 204)

        with Session(self.engine) as session:
            self.assertIsNone(session.get(Contract, contract_id))
            self.assertIsNone(session.get(AdvanceLedger, ledger_id))
            updated_entry = session.get(RoyaltyLedgerEntry, entry_id)
            self.assertIsNotNone(updated_entry)
            self.assertIsNone(updated_entry.contract_id)

    def test_batch_delete_works(self) -> None:
        """Vérifie la suppression par lot de plusieurs œuvres en une transaction."""
        with Session(self.engine) as session:
            w1 = Work(title="Batch Work 1", splits=[])
            w2 = Work(title="Batch Work 2", splits=[])
            w3 = Work(title="Batch Work 3 (Keep)", splits=[])
            session.add_all([w1, w2, w3])
            session.commit()
            session.refresh(w1)
            session.refresh(w2)
            session.refresh(w3)
            ids_to_delete = [str(w1.id), str(w2.id)]
            keep_id = w3.id

        resp = self.client.post("/api/v1/works/batch-delete", json={"work_ids": ids_to_delete})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["deleted_count"], 2)
        self.assertEqual(len(data["deleted_ids"]), 2)

        with Session(self.engine) as session:
            self.assertIsNone(session.get(Work, UUID(ids_to_delete[0])))
            self.assertIsNone(session.get(Work, UUID(ids_to_delete[1])))
            self.assertIsNotNone(session.get(Work, keep_id))

    def test_batch_delete_holders(self) -> None:
        """Vérifie la suppression par lot d'ayants droit avec découplage relationnel."""
        with Session(self.engine) as session:
            h1 = RightHolderDirectory(full_name="Holder Batch 1", entity_type="PERSONNE_PHYSIQUE")
            h2 = RightHolderDirectory(full_name="Holder Batch 2", entity_type="SOCIETE")
            session.add_all([h1, h2])
            session.commit()
            session.refresh(h1)
            session.refresh(h2)
            ids_to_delete = [str(h1.id), str(h2.id)]

        resp = self.client.post("/api/v1/holders/batch-delete", json={"holder_ids": ids_to_delete})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["deleted_count"], 2)

        with Session(self.engine) as session:
            self.assertIsNone(session.get(RightHolderDirectory, UUID(ids_to_delete[0])))
            self.assertIsNone(session.get(RightHolderDirectory, UUID(ids_to_delete[1])))

    def test_batch_delete_contracts(self) -> None:
        """Vérifie la suppression par lot de contrats et le nettoyage des registres associés."""
        with Session(self.engine) as session:
            c1 = Contract(contract_reference="CTR-BATCH-01", publisher_name="Pub", counterparty_name="Writer 1")
            c2 = Contract(contract_reference="CTR-BATCH-02", publisher_name="Pub", counterparty_name="Writer 2")
            session.add_all([c1, c2])
            session.commit()
            session.refresh(c1)
            session.refresh(c2)
            ids_to_delete = [str(c1.id), str(c2.id)]

        resp = self.client.post("/api/v1/contracts/batch-delete", json={"contract_ids": ids_to_delete})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["deleted_count"], 2)

        with Session(self.engine) as session:
            self.assertIsNone(session.get(Contract, UUID(ids_to_delete[0])))
            self.assertIsNone(session.get(Contract, UUID(ids_to_delete[1])))

    def test_delete_work_group_detaches_works(self) -> None:
        """Vérifie la suppression unitaire d'un projet/groupe et le détachement de ses œuvres sans suppression de ces dernières."""
        with Session(self.engine) as session:
            w = Work(title="Oeuvre Projet Test", splits=[])
            g = WorkGroup(name="Projet Unitaire Test", group_type="SERIE_TV")
            session.add_all([w, g])
            session.commit()
            session.refresh(w)
            session.refresh(g)
            link = WorkGroupLink(work_id=w.id, work_group_id=g.id)
            session.add(link)
            session.commit()
            group_id = g.id
            work_id = w.id

        resp = self.client.delete(f"/api/v1/work-groups/{group_id}")
        self.assertEqual(resp.status_code, 204)

        with Session(self.engine) as session:
            # Le groupe est supprimé
            self.assertIsNone(session.get(WorkGroup, group_id))
            # Le lien est supprimé
            links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == group_id)).all()
            self.assertEqual(len(links), 0)
            # L'œuvre existe toujours dans le catalogue
            self.assertIsNotNone(session.get(Work, work_id))

    def test_batch_delete_work_groups(self) -> None:
        """Vérifie la suppression par lot de groupes d'œuvres / projets."""
        with Session(self.engine) as session:
            w = Work(title="Oeuvre Batch Projets", splits=[])
            g1 = WorkGroup(name="Projet Batch 1", group_type="SERIE_TV")
            g2 = WorkGroup(name="Projet Batch 2", group_type="ALBUM")
            session.add_all([w, g1, g2])
            session.commit()
            session.refresh(w)
            session.refresh(g1)
            session.refresh(g2)
            l1 = WorkGroupLink(work_id=w.id, work_group_id=g1.id)
            l2 = WorkGroupLink(work_id=w.id, work_group_id=g2.id)
            session.add_all([l1, l2])
            session.commit()
            ids_to_delete = [str(g1.id), str(g2.id)]
            work_id = w.id

        resp = self.client.post("/api/v1/work-groups/batch-delete", json={"group_ids": ids_to_delete})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["deleted_count"], 2)
        self.assertEqual(data["detached_works_count"], 2)

        with Session(self.engine) as session:
            self.assertIsNone(session.get(WorkGroup, UUID(ids_to_delete[0])))
            self.assertIsNone(session.get(WorkGroup, UUID(ids_to_delete[1])))
            # Les liens vers ces groupes sont supprimés
            links = session.exec(select(WorkGroupLink).where(WorkGroupLink.work_id == work_id)).all()
            self.assertEqual(len(links), 0)
            # L'œuvre elle-même est intacte
            self.assertIsNotNone(session.get(Work, work_id))
