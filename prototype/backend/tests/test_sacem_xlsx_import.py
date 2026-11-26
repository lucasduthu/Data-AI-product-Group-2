import io
import unittest
import zipfile
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.main import app
from app.core.database import get_session
from app.models.work import Work
from app.models.right_holder import RightHolderDirectory
from app.services.xlsx_parser import read_xlsx_as_csv, col_ref_to_idx


def build_test_sacem_xlsx(
    works_data: list[dict[str, str]] | None = None
) -> bytes:
    """Génère un classeur Excel .xlsx valide en mémoire selon le gabarit officiel SACEM."""
    if works_data is None:
        works_data = [
            {
                "code": "111779466467",
                "title": "ADK ABYSS",
                "subtitle": "ABYSS",
                "genre": "Pop / Variété",
                "iswc": "T-339.249.058-9",
                "date": "2026-01-15",
                "role": "C",
                "name": "PERON JOAN",
                "coad": "12345",
                "name_ipi": "PERON JOAN",
                "ipi": "00451389839",
                "de": "SACEM",
                "dr": "SACEM",
                "dep": "50,0000",
                "drm": "50,0000",
                "phono": "0,0000",
                "comment": "Enregistrement conforme",
            },
            {
                "code": "111779466467",
                "title": "ADK ABYSS",
                "subtitle": "ABYSS",
                "genre": "Pop / Variété",
                "iswc": "T-339.249.058-9",
                "date": "2026-01-15",
                "role": "E",
                "name": "ÉDITIONS SOLSTICES MUSIC",
                "coad": "67890",
                "name_ipi": "SOLSTICES MUSIC",
                "ipi": "00891234567",
                "de": "SACEM",
                "dr": "SACEM",
                "dep": "50,0000",
                "drm": "50,0000",
                "phono": "0,0000",
                "comment": "Part éditoriale",
            },
        ]

    headers = [
        "Code oeuvre",
        "Titre de l'oeuvre",
        "Sous-titre(s)",
        "Genre de l'oeuvre",
        "ISWC",
        "Date de déclaration",
        "Rôle",
        "Nom de l'ayant-droit",
        "COAD",
        "Nom au fichier IPI",
        "Code IPI",
        "Société en DE",
        "Société en DR",
        "Part DEP",
        "Part DR",
        "Part PHONO",
        "Commentaire",
    ]

    all_strings: list[str] = list(headers)
    rows_cells: list[list[tuple[str, str]]] = []

    for item in works_data:
        row_vals = [
            item.get("code", ""),
            item.get("title", ""),
            item.get("subtitle", ""),
            item.get("genre", ""),
            item.get("iswc", ""),
            item.get("date", ""),
            item.get("role", ""),
            item.get("name", ""),
            item.get("coad", ""),
            item.get("name_ipi", ""),
            item.get("ipi", ""),
            item.get("de", ""),
            item.get("dr", ""),
            item.get("dep", ""),
            item.get("drm", ""),
            item.get("phono", ""),
            item.get("comment", ""),
        ]
        cells = []
        for col_idx, val in enumerate(row_vals):
            if val:
                if val not in all_strings:
                    all_strings.append(val)
                str_idx = str(all_strings.index(val))
                col_letter = chr(ord("A") + col_idx)
                cells.append((col_letter, str_idx))
        rows_cells.append(cells)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        # sharedStrings.xml
        sst = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        for s in all_strings:
            clean = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            sst += f"<si><t>{clean}</t></si>"
        sst += "</sst>"
        z.writestr("xl/sharedStrings.xml", sst)

        # sheet1.xml
        sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        sheet += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
        # Header row (r=1)
        sheet += '<row r="1">'
        for i, h in enumerate(headers):
            sheet += f'<c r="{chr(ord("A") + i)}1" t="s"><v>{i}</v></c>'
        sheet += "</row>"
        # Data rows
        for r_num, row_data in enumerate(rows_cells, start=2):
            sheet += f'<row r="{r_num}">'
            for col_letter, s_idx in row_data:
                sheet += f'<c r="{col_letter}{r_num}" t="s"><v>{s_idx}</v></c>'
            sheet += "</row>"
        sheet += "</sheetData></worksheet>"
        z.writestr("xl/worksheets/sheet1.xml", sheet)

    return buf.getvalue()


class TestSacemXlsxImport(unittest.TestCase):
    """Vérification déterministe de l'importation native des classeurs Excel SACEM (.xlsx) (US-5.4)."""

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

    def test_col_ref_to_idx(self) -> None:
        self.assertEqual(col_ref_to_idx("A1"), 0)
        self.assertEqual(col_ref_to_idx("B2"), 1)
        self.assertEqual(col_ref_to_idx("Z99"), 25)
        self.assertEqual(col_ref_to_idx("AA10"), 26)

    def test_read_xlsx_as_csv_aligns_columns(self) -> None:
        xlsx_bytes = build_test_sacem_xlsx()
        csv_text = read_xlsx_as_csv(xlsx_bytes)
        lines = csv_text.splitlines()

        self.assertGreaterEqual(len(lines), 3)
        self.assertIn("Code oeuvre;Titre de l'oeuvre", lines[0])
        self.assertIn("111779466467;ADK ABYSS;ABYSS;Pop / Variété;T-339.249.058-9", lines[1])
        self.assertIn("PERON JOAN;12345;PERON JOAN;00451389839", lines[1])

    def test_api_migrate_accepts_xlsx_file_dry_run(self) -> None:
        xlsx_bytes = build_test_sacem_xlsx()
        response = self.client.post(
            "/api/v1/works/migrate",
            data={"source_system": "SACEM_CSV", "dry_run": "true"},
            files={
                "file": (
                    "Mes_oeuvres_2026.xlsx",
                    xlsx_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        self.assertEqual(response.status_code, 200)
        report = response.json()

        self.assertEqual(report["total_works_parsed"], 1)
        self.assertEqual(report["cwr_ready_works_count"], 1)
        self.assertEqual(report["items"][0]["title"], "ADK ABYSS")
        self.assertEqual(report["items"][0]["iswc"], "T-339.249.058-9")
        self.assertEqual(report["items"][0]["sacem_work_code"], "111779466467")
        self.assertTrue(report["items"][0]["is_cwr_ready"])

    def test_api_migrate_xlsx_executes_atomically_in_database(self) -> None:
        xlsx_bytes = build_test_sacem_xlsx()
        response = self.client.post(
            "/api/v1/works/migrate",
            data={"source_system": "SACEM_CSV", "dry_run": "false"},
            files={
                "file": (
                    "Mes_oeuvres_SACEM_Export.xlsx",
                    xlsx_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["total_works_parsed"], 1)

        # Vérification en base de données
        works_resp = self.client.get("/api/v1/works")
        self.assertEqual(works_resp.status_code, 200)
        db_works = works_resp.json()
        self.assertEqual(len(db_works), 1)
        self.assertEqual(db_works[0]["title"], "ADK ABYSS")
        self.assertEqual(db_works[0]["sacem_work_code"], "111779466467")

        # Vérification synchronisation répertoire des ayants droit
        holders_resp = self.client.get("/api/v1/holders")
        self.assertEqual(holders_resp.status_code, 200)
        holders = holders_resp.json()
        names = [h["full_name"] for h in holders]
        self.assertIn("PERON JOAN", names)
        self.assertIn("SOLSTICES MUSIC", names)


if __name__ == "__main__":
    unittest.main()
