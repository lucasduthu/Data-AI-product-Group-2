import unittest
from decimal import Decimal
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.core.database import get_session
from app.models.work import Work
from app.services.cwr_exporter import generate_cwr_v21_content


class TestCWRExporter(unittest.TestCase):
    """Tests déterministes de l'exportateur CWR v2.1 (Sacem / CISAC)."""

    def test_cwr_export_includes_valid_works_and_skips_conflicts(self) -> None:
        valid_work = Work(
            id=uuid4(),
            title="Lumière Noire",
            subtitle="Black Light Subtitle",
            alternate_titles=["Black Light"],
            iswc="T-301.452.891-4",
            isrc_codes=["FRZ012600101"],
            performers=["Camille Moreau"],
            splits=[
                {
                    "holder_name": "Camille Moreau",
                    "role": "AC",
                    "ipi_number": "00458912301",
                    "dep_share_pct": str(Decimal("50.00")),
                    "drm_share_pct": str(Decimal("50.00")),
                },
                {
                    "holder_name": "Éditions Solstices Music",
                    "role": "E",
                    "ipi_number": "00891234567",
                    "dep_share_pct": str(Decimal("50.00")),
                    "drm_share_pct": str(Decimal("50.00")),
                },
            ],
        )
        invalid_work = Work(
            id=uuid4(),
            title="Orage d'Octobre",
            alternate_titles=[],
            iswc="T-304.901.223-1",
            isrc_codes=[],
            performers=["Sami Benali"],
            splits=[
                {
                    "holder_name": "Sami Benali",
                    "role": "AC",
                    "ipi_number": "00398765432",
                    "dep_share_pct": str(Decimal("40.00")),
                    "drm_share_pct": str(Decimal("50.00")),
                },
                {
                    "holder_name": "Éditions Solstices Music",
                    "role": "E",
                    "ipi_number": "00891234567",
                    "dep_share_pct": str(Decimal("50.00")),
                    "drm_share_pct": str(Decimal("50.00")),
                },
            ],
        )

        res = generate_cwr_v21_content([valid_work, invalid_work])
        self.assertEqual(res["included_works_count"], 1)
        self.assertEqual(res["skipped_works_count"], 1)
        self.assertIn("HDRPB", res["content"])
        self.assertIn("NWR00000000", res["content"])
        self.assertIn("BLACK LIGHT SUBTITLE", res["content"])
        self.assertIn("TEFR", res["content"])
        self.assertIn("0500005000", res["content"])
        self.assertIn("TRL00001", res["content"])

    def test_cwr_export_serializes_distinct_cisac_de_and_dr_societies(self) -> None:
        """Vérifie que les codes CISAC DE et DR (ex: ASCAP 010 et SDRM 058) sont correctement formatés."""
        international_work = Work(
            id=uuid4(),
            title="Atlantic Sunset",
            iswc="T-999.888.777-1",
            splits=[
                {
                    "holder_name": "John Doe",
                    "role": "AC",
                    "ipi_number": "00112233445",
                    "society_name": "ASCAP",
                    "society_de": "ASCAP",
                    "society_dr": "SDRM",
                    "dep_share_pct": str(Decimal("50.00")),
                    "drm_share_pct": str(Decimal("50.00")),
                },
                {
                    "holder_name": "Éditions Solstices Music",
                    "role": "E",
                    "ipi_number": "00891234567",
                    "society_name": "SACEM",
                    "society_de": "SACEM",
                    "society_dr": "SACEM",
                    "dep_share_pct": str(Decimal("50.00")),
                    "drm_share_pct": str(Decimal("50.00")),
                },
            ],
        )
        res = generate_cwr_v21_content([international_work])
        self.assertEqual(res["included_works_count"], 1)
        # SWR doit contenir le code ASCAP 010 pour DE et SDRM 058 pour DR
        self.assertIn("0100500005805000", res["content"])
        # SPU doit contenir SACEM 058 pour DE et DR
        self.assertIn("0580500005805000", res["content"])

    def test_cwr_export_endpoint_filters_by_work_ids(self) -> None:
        """Vérifie que l'endpoint GET /api/v1/works/export/cwr?work_ids=... filtre uniquement les œuvres ciblées."""
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)

        def get_test_session():
            with Session(engine) as session:
                yield session

        app.dependency_overrides[get_session] = get_test_session
        client = TestClient(app)

        try:
            # Création de 3 œuvres
            w1 = client.post("/api/v1/works", json={
                "title": "Oeuvre 1 Ciblee",
                "iswc": "T-111.111.111-1",
                "splits": [
                    {"holder_name": "Artiste", "role": "C", "ipi_number": "00123456789", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                    {"holder_name": "Editeur", "role": "E", "ipi_number": "00987654321", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                ]
            }).json()
            w2 = client.post("/api/v1/works", json={
                "title": "Oeuvre 2 Ciblee",
                "iswc": "T-222.222.222-2",
                "splits": [
                    {"holder_name": "Artiste", "role": "C", "ipi_number": "00123456789", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                    {"holder_name": "Editeur", "role": "E", "ipi_number": "00987654321", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                ]
            }).json()
            w3 = client.post("/api/v1/works", json={
                "title": "Oeuvre 3 Ignoree",
                "iswc": "T-333.333.333-3",
                "splits": [
                    {"holder_name": "Artiste", "role": "C", "ipi_number": "00123456789", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                    {"holder_name": "Editeur", "role": "E", "ipi_number": "00987654321", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                ]
            }).json()

            # Export filtré sur w1 et w2
            target_ids = f"{w1['id']},{w2['id']}"
            resp = client.get(f"/api/v1/works/export/cwr?work_ids={target_ids}")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            self.assertEqual(data["included_works_count"], 2)
            self.assertIn("OEUVRE 1 CIBLEE", data["included_works"][0].upper() + data["included_works"][1].upper())
            self.assertIn("OEUVRE 2 CIBLEE", data["included_works"][0].upper() + data["included_works"][1].upper())
            self.assertNotIn("OEUVRE 3 IGNOREE", data["content"])
            self.assertEqual(data["filtered_by_selection"], 2)
            self.assertIn("SELECTION", data["filename"])
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    unittest.main()
