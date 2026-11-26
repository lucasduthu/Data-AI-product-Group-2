from datetime import date
from decimal import Decimal
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.database import engine
from app.main import app
from app.models.contract import RoyaltyLedgerEntry
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.schemas.common import ValidationStatus


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_succession_crud_and_summary(client: TestClient) -> None:
    """Vérifie la création, mise à jour et restitution d'un auteur décédé avec succession indivise."""
    unique_name = f"Jean Ferrat Testament-{uuid4().hex[:6]}"
    payload = {
        "full_name": unique_name,
        "stage_name_or_trade_name": "Jean Ferrat",
        "entity_type": "PERSONNE_PHYSIQUE",
        "legal_form": "Artiste-Auteur",
        "primary_role": "AC",
        "ipi_number": "00889911223",
        "coad_or_isni": "COAD-FERRAT",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "succession.ferrat@notaires.fr",
        "phone": "+33 1 42 68 00 00",
        "postal_address": "12 Rue de la Paix",
        "postal_code": "75002",
        "city": "Paris",
        "country": "FR",
        "siret": None,
        "vat_number": None,
        "vat_applicable": False,
        "vat_rate_pct": "0.00",
        "ircec_precompte_applicable": True,
        "urssaf_dispense_certificate": False,
        "iban": "FR76 3000 4000 1111 2222 3333 444",
        "bic": "BNPAFRPPXXX",
        "is_deceased": True,
        "deceased_at": "2020-03-13",
        "succession_active": True,
        "succession_notes": "Acte de notoriété SCP Notaires de France réf 2020-098",
        "heirs": [
            {
                "heir_name": "Marie Ferrat",
                "relationship": "Conjointe survivante",
                "share_pct": "50.00",
                "iban": "FR76 1111 2222 3333 4444 5555 666",
                "bic": "BNPAFRPPXXX",
            },
            {
                "heir_name": "Julien Ferrat",
                "relationship": "Enfant / Héritier réservataire",
                "share_pct": "50.00",
                "iban": "FR76 9999 8888 7777 6666 5555 444",
                "bic": "SOGEFRPPXXX",
            },
        ],
    }

    res = client.post("/api/v1/holders", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["is_deceased"] is True
    assert data["deceased_at"] == "2020-03-13"
    assert data["succession_active"] is True
    assert len(data["heirs"]) == 2
    assert "Succession active (2 héritiers)" in data["succession_summary"]

    holder_id = data["id"]

    # Test de lecture
    res_list = client.get("/api/v1/holders")
    assert res_list.status_code == 200
    item = next(h for h in res_list.json() if h["id"] == holder_id)
    assert item["is_deceased"] is True
    assert item["heirs"][0]["heir_name"] == "Marie Ferrat"
    assert item["heirs"][0]["share_pct"] == "50.00"

    # Test génération Facture / Note de droits prête à l'emploi
    res_inv = client.get(f"/api/v1/holders/{holder_id}/ready-invoice?gross_amount=1000.00&recouped_advance=0.00")
    assert res_inv.status_code == 200
    inv = res_inv.json()
    assert "Dévolution successorale indivise" in " ".join(inv["legal_mentions"])
    assert "VENTILATION SUCCESSORALE ENTRE HÉRITIERS" in inv["printable_text"]
    assert "Marie Ferrat (Conjointe survivante)" in inv["printable_text"]
    assert "Julien Ferrat" in inv["printable_text"]


def test_mandataire_tiers_paye_redirection(client: TestClient) -> None:
    """Vérifie la configuration d'un tiers payé / mandataire et sa mention sur la note."""
    unique_name = f"Artiste Mandaté-{uuid4().hex[:6]}"
    payload = {
        "full_name": unique_name,
        "entity_type": "PERSONNE_PHYSIQUE",
        "primary_role": "AC",
        "ipi_number": "00778899001",
        "postal_address": "5 Avenue Montaigne",
        "postal_code": "75008",
        "city": "Paris",
        "country": "FR",
        "payout_recipient_name": "Cabinet d'Avocats Me Dupond-Morel (Fiducie)",
        "iban": "FR76 1234 5678 9012 3456 7890 123",
        "bic": "PARBFRPPXXX",
    }
    res = client.post("/api/v1/holders", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["payout_recipient_name"] == "Cabinet d'Avocats Me Dupond-Morel (Fiducie)"
    assert "Tiers Payé ➔" in data["succession_summary"]

    holder_id = data["id"]
    res_inv = client.get(f"/api/v1/holders/{holder_id}/ready-invoice?gross_amount=2000.00")
    assert res_inv.status_code == 200
    inv = res_inv.json()
    assert "Cabinet d'Avocats Me Dupond-Morel" in " ".join(inv["legal_mentions"])
    assert "Tiers Mandataire : Cabinet d'Avocats Me Dupond-Morel" in inv["printable_text"]


def test_royalty_statement_succession_and_tiers_paye(client: TestClient) -> None:
    """Vérifie le calcul et la clôture comptable d'un relevé impliquant un auteur en succession et un tiers payé."""
    with Session(engine) as session:
        # Création de l'auteur décédé avec succession
        author = RightHolderDirectory(
            full_name=f"Compositeur Défunt-{uuid4().hex[:6]}",
            primary_role="C",
            ipi_number=f"99{uuid4().hex[:7]}",
            entity_type="PERSONNE_PHYSIQUE",
            is_deceased=True,
            deceased_at="2021-01-01",
            succession_active=True,
            heirs=[
                {"heir_name": "Héritier A", "relationship": "Enfant", "share_pct": "60.00", "iban": "FR76 111"},
                {"heir_name": "Héritier B", "relationship": "Enfant", "share_pct": "40.00", "iban": "FR76 222"},
            ],
            iban="FR76 0000",
        )
        session.add(author)

        # Création d'une œuvre
        work = Work(
            title=f"Symphonie Posthume-{uuid4().hex[:6]}",
            iswc=f"T-{uuid4().hex[:9].upper()}",
            splits=[
                {
                    "holder_name": author.full_name,
                    "role": "C",
                    "ipi_number": author.ipi_number,
                    "share_percentage": "100.00",
                    "rights_type": "DEP",
                }
            ],
        )
        session.add(work)

        # Relevé SACEM
        stmt = RoyaltyStatement(
            source_name="SACEM DÉCOMPTE 2026-S1",
            period_start=date(2026, 1, 1),
            period_end=date(2026, 6, 30),
            total_gross_amount=Decimal("1000.00"),
            accounting_status="DRAFT",
        )
        session.add(stmt)
        session.flush()

        line = StatementLine(
            statement_id=stmt.id,
            raw_work_title=work.title,
            gross_amount=Decimal("1000.00"),
            right_type="DEP",
            exploitation_type="PUBLIC_PERFORMANCE",
            matched_work_id=work.id,
            matched_work_title=work.title,
            validation_status=ValidationStatus.VALIDATED.value,
        )
        session.add(line)
        session.commit()
        stmt_id = stmt.id

    # Exécution de la simulation DRAFT
    res_calc = client.post(f"/api/v1/statements/{stmt_id}/compute-royalties")
    assert res_calc.status_code == 200
    data = res_calc.json()
    assert len(data["holder_statements"]) == 1
    h_stmt = data["holder_statements"][0]
    assert h_stmt["is_deceased"] is True
    assert h_stmt["succession_active"] is True
    assert len(h_stmt["heirs_distribution"]) == 2
    # Héritier A : 60% de 1000 = 600 € brut
    assert h_stmt["heirs_distribution"][0]["share_pct"] == "60.00"
    assert h_stmt["heirs_distribution"][0]["allocated_gross"] == "600.00"
    # Héritier B : 40% de 1000 = 400 € brut
    assert h_stmt["heirs_distribution"][1]["share_pct"] == "40.00"
    assert h_stmt["heirs_distribution"][1]["allocated_gross"] == "400.00"

    # Verrouillage comptable immuable (LOCKED)
    res_lock = client.post(
        f"/api/v1/statements/{stmt_id}/lock-and-post",
        json={"notes": "Clôture avec dévolution successorale."},
    )
    assert res_lock.status_code == 200
    lock_data = res_lock.json()
    assert lock_data["is_locked"] is True

    # Vérification dans le Grand Livre (RoyaltyLedgerEntry)
    with Session(engine) as session:
        entries = list(session.exec(select(RoyaltyLedgerEntry).where(RoyaltyLedgerEntry.statement_id == stmt_id)).all())
        assert len(entries) == 1
        entry = entries[0]
        assert entry.is_succession_payout is True
        assert len(entry.heirs_payout_details) == 2
        assert entry.heirs_payout_details[0]["heir_name"] == "Héritier A"
