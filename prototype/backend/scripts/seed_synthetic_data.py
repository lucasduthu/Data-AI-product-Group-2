import csv
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.models.contract import AdvanceLedger, Contract
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.schemas.common import ValidationStatus
from app.schemas.contract import ExploitationType
from app.schemas.statement import StatementLineCreate
from app.services.cwr_validator import validate_work_cwr
from app.services.embedding_service import compute_text_embedding
from app.services.royalty_engine import calculate_line_allocations
from app.services.statement_matcher import match_statement_line_to_catalog

ROOT_DIR = Path(__file__).resolve().parents[2]
CONTRACTS_DIR = ROOT_DIR / "data" / "synthetic" / "contracts"
STATEMENTS_DIR = ROOT_DIR / "data" / "synthetic" / "statements"


def _build_minimal_pdf_bytes(text_lines: list[str]) -> bytes:
    """Génère un fichier PDF 1.4 valide contenant les lignes de texte fournies (sans dépendance externe obligatoire)."""
    try:
        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        y = 800
        for line in text_lines:
            c.drawString(45, y, line)
            y -= 18
            if y < 50:
                c.showPage()
                y = 800
        c.save()
        return buf.getvalue()
    except Exception:
        # Fallback PDF 1.4 standard lisible par pypdf et par notre extracteur
        escaped_lines = []
        for idx, ln in enumerate(text_lines):
            safe = (
                ln.replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)")
            )
            dy = -20 if idx > 0 else 0
            escaped_lines.append(f"0 {dy} Td ({safe}) Tj")
        stream_body = "BT /F1 11 Tf 50 780 Td " + " ".join(escaped_lines) + " ET"
        stream_bytes = stream_body.encode("latin-1", errors="replace")

        pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
            + f"4 0 obj << /Length {len(stream_bytes)} >> stream\n".encode("ascii")
            + stream_bytes
            + b"\nendstream endobj\n"
            b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
            b"trailer << /Root 1 0 R >>\n%%EOF\n"
        )
        return pdf


SYNTHETIC_WORKS: list[dict[str, Any]] = [
    {
        "title": "Lumière Noire",
        "alternate_titles": ["Lumiere Noire", "Black Light (French Edit)"],
        "iswc": "T-301.452.891-4",
        "isrc_codes": ["FRZ012600101", "FRZ012600102"],
        "performers": ["Camille Moreau", "K-Soprano"],
        "splits": [
            {"holder_name": "Camille Moreau", "role": "AC", "ipi_number": "00458912301", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
    {
        "title": "Minuit sur la Seine",
        "alternate_titles": ["Minuit Sur Seine", "Midnight on the Seine"],
        "iswc": "T-302.118.440-2",
        "isrc_codes": ["FRZ012600201"],
        "performers": ["Léa Vasseur"],
        "splits": [
            {"holder_name": "Léa Vasseur", "role": "A", "ipi_number": "00512398741", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Julien Delacroix", "role": "C", "ipi_number": "00623489120", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
    {
        "title": "Horizon Véloce",
        "alternate_titles": ["Horizon Veloce", "Horizon Veloce (Club Mix)"],
        "iswc": "T-303.774.129-8",
        "isrc_codes": ["FRZ012600301"],
        "performers": ["Nova Pulse"],
        "splits": [
            {"holder_name": "antoine garnier".title(), "role": "AC", "ipi_number": "00734512980", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Belleville Publishing", "role": "E", "ipi_number": "00911223344", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
        ],
    },
    {
        "title": "Orage d'Octobre",
        "alternate_titles": ["Orage Octobre"],
        "iswc": "T-304.901.223-1",
        "isrc_codes": ["FRZ012600401"],
        "performers": ["Sami Benali"],
        # Conflit volontaire pré-CWR : Somme DEP = 90.00% (manque 10%)
        "splits": [
            {"holder_name": "Sami Benali", "role": "AC", "ipi_number": "00398765432", "dep_share_pct": "40.00", "drm_share_pct": "50.00", "share_percentage": "40.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
    {
        "title": "Les Étoiles de Paname",
        "alternate_titles": ["Etoiles de Paname", "Paname Stars"],
        "iswc": "T-305.612.334-7",
        "isrc_codes": ["FRZ012600501"],
        "performers": ["Inès K", "Malo"],
        # Conflit volontaire pré-CWR : IPI manquant sur Malo
        "splits": [
            {"holder_name": "Inès K", "role": "A", "ipi_number": "00411223399", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Malo Mercier", "role": "C", "ipi_number": None, "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
]

# Ajout de 20 œuvres supplémentaires pour atteindre les 25 œuvres réalistes du catalogue
EXTRA_TITLES = [
    ("Traversée Nocturne", "T-306.100.201-1", "FRZ012600601", "Clara Silvestre"),
    ("L'Écho des Falaises", "T-306.100.202-2", "FRZ012600602", "Théo Marchand"),
    ("Soleil Acide", "T-306.100.203-3", "FRZ012600603", "Néon Bleu"),
    ("Mémoire Magnétique", "T-306.100.204-4", "FRZ012600604", "Julien Delacroix"),
    ("Rue des Martyrs", "T-306.100.205-5", "FRZ012600605", "Camille Moreau"),
    ("Vagues Synthétiques", "T-306.100.206-6", "FRZ012600606", "Nova Pulse"),
    ("Un Été à Marseille", "T-306.100.207-7", "FRZ012600607", "Sami Benali"),
    ("Fleurs de Béton", "T-306.100.208-8", "FRZ012600608", "K-Soprano"),
    ("Passager de l'Aube", "T-306.100.209-9", "FRZ012600609", "Léa Vasseur"),
    ("Dernier Métro Bastille", "T-306.100.210-0", "FRZ012600610", "Inès K"),
    ("Vertige Boréal", "T-306.100.211-1", "FRZ012600611", "Antoine Garnier"),
    ("Poussière d'Or", "T-306.100.212-2", "FRZ012600612", "Clara Silvestre"),
    ("Mirage Urbain", "T-306.100.213-3", "FRZ012600613", "K-Soprano"),
    ("Séquence Cinéma", "T-306.100.214-4", "FRZ012600614", "Julien Delacroix"),
    ("Sous les Toits de Zinc", "T-306.100.215-5", "FRZ012600615", "Camille Moreau"),
    ("Lignes de Fuite", "T-306.100.216-6", "FRZ012600616", "Théo Marchand"),
    ("Rivage Électrique", "T-306.100.217-7", "FRZ012600617", "Néon Bleu"),
    ("Nuit Blanche à Lyon", "T-306.100.218-8", "FRZ012600618", "Nova Pulse"),
    ("Cœur Battant (BOF)", "T-306.100.219-9", "FRZ012600619", "Léa Vasseur"),
    ("Après la Pluie", "T-306.100.220-0", "FRZ012600620", "Clara Silvestre"),
]

for t_title, t_iswc, t_isrc, t_perf in EXTRA_TITLES:
    SYNTHETIC_WORKS.append(
        {
            "title": t_title,
            "alternate_titles": [],
            "iswc": t_iswc,
            "isrc_codes": [t_isrc],
            "performers": [t_perf],
            "splits": [
                {
                    "holder_name": t_perf,
                    "role": "AC",
                    "ipi_number": "00458912301",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "share_percentage": "50.00",
                },
                {
                    "holder_name": "Éditions Solstices Music",
                    "role": "E",
                    "ipi_number": "00891234567",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "share_percentage": "50.00",
                },
            ],
        }
    )


SYNTHETIC_PDF_CONTRACTS = [
    (
        "contrat_coedition_lumiere_noire.pdf",
        [
            "CONTRAT DE COEDITION MUSICALE",
            "Référence : CTR-2026-LN01",
            "Œuvre : « Lumière Noire »",
            "Article 4 - Clé de répartition des droits :",
            "- Camille Moreau (Auteur-Compositeur, IPI : 00458912301) : DEP = 50.00 % | DRM = 50.00 %",
            "- Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50.00 % | DRM = 50.00 %",
            "Article 6 - Avance récupérable :",
            "L'Éditeur verse à Camille Moreau une avance récupérable de 15000 EUR HT amortissable sur tous droits.",
        ],
    ),
    (
        "contrat_cession_minuit_seine.pdf",
        [
            "CONTRAT DE CESSION ET D'EDITION D'OEUVRE MUSICALE",
            "Référence : CTR-2026-MS02",
            "Œuvre : « Minuit sur la Seine »",
            "Article 4 - Clé de répartition des droits :",
            "- Léa Vasseur (Auteur, IPI : 00512398741) : DEP = 25.00 % | DRM = 25.00 %",
            "- Julien Delacroix (Compositeur, IPI : 00623489120) : DEP = 25.00 % | DRM = 25.00 %",
            "- Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50.00 % | DRM = 50.00 %",
            "Article 6 - Avance récupérable :",
            "Une avance récupérable de 5000 EUR HT est consentie à la signature.",
        ],
    ),
    (
        "contrat_coedition_horizon_veloce.pdf",
        [
            "CONTRAT DE COEDITION 50/50",
            "Référence : CTR-2026-HV03",
            "Œuvre : « Horizon Véloce »",
            "Article 4 - Clé de répartition des droits :",
            "- Antoine Garnier (Auteur-Compositeur, IPI : 00734512980) : DEP = 50.00 % | DRM = 50.00 %",
            "- Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 25.00 % | DRM = 25.00 %",
            "- Belleville Publishing (Co-Éditeur, IPI : 00911223344) : DEP = 25.00 % | DRM = 25.00 %",
            "Article 6 - Avance récupérable :",
            "Avance récupérable de 8000 EUR HT.",
        ],
    ),
    (
        "contrat_pacte_orage_octobre_anomalie.pdf",
        [
            "CONTRAT DE CESSION D'EDITION (ANOMALIE SPLITS)",
            "Référence : CTR-2026-OO04",
            "Œuvre : « Orage d'Octobre »",
            "Article 4 - Clé de répartition des droits :",
            "- Sami Benali (Auteur-Compositeur, IPI : 00398765432) : DEP = 40.00 % | DRM = 50.00 %",
            "- Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50.00 % | DRM = 50.00 %",
            "Article 6 - Avance récupérable :",
            "Avance récupérable de 3000 EUR HT.",
        ],
    ),
    (
        "contrat_sous_edition_export.pdf",
        [
            "CONTRAT DE SOUS-EDITION INTERNATIONALE",
            "Référence : CTR-2026-SE05",
            "Œuvre : « Traversée Nocturne »",
            "Article 4 - Clé de répartition des droits :",
            "- Clara Silvestre (Auteur-Compositeur, IPI : 00458912301) : DEP = 50.00 % | DRM = 50.00 %",
            "- Éditions Solstices Music (Éditeur, IPI : 00891234567) : DEP = 50.00 % | DRM = 50.00 %",
        ],
    ),
]


SACEM_CSV_ROWS = [
    {
        "work_title": "LUMIERE NOIRE",
        "iswc": "T-301.452.891-4",
        "isrc": "FRZ012600101",
        "performer": "Camille Moreau",
        "right_type": "DEP",
        "exploitation_type": "PUBLIC_PERFORMANCE",
        "territory": "FR",
        "units": 48200,
        "gross_amount": "4250.00",
    },
    {
        "work_title": "Lumiere Noir (Feat. K-Soprano) - Radio Edit",
        "iswc": "",
        "isrc": "",
        "performer": "Camille Moreau feat K",
        "right_type": "DRM",
        "exploitation_type": "STREAMING",
        "territory": "FR",
        "units": 915000,
        "gross_amount": "3180.50",
    },
    {
        "work_title": "Minuit s/ la Seine (Live TV)",
        "iswc": "",
        "isrc": "",
        "performer": "Lea Vasseur",
        "right_type": "DEP",
        "exploitation_type": "PUBLIC_PERFORMANCE",
        "territory": "FR",
        "units": 12400,
        "gross_amount": "1890.00",
    },
    {
        "work_title": "HORIZON VELOCE - CLUB MIX",
        "iswc": "",
        "isrc": "FRZ012600301",
        "performer": "Nova Pulse",
        "right_type": "DEP",
        "exploitation_type": "STREAMING",
        "territory": "EU",
        "units": 540000,
        "gross_amount": "2400.00",
    },
    {
        "work_title": "Traversee Nocturn",
        "iswc": "",
        "isrc": "",
        "performer": "Clara Silvestre",
        "right_type": "DRM",
        "exploitation_type": "DOWNLOAD",
        "territory": "FR",
        "units": 3200,
        "gross_amount": "960.25",
    },
    {
        "work_title": "Coeur Battant (BOF Film)",
        "iswc": "",
        "isrc": "",
        "performer": "Lea Vasseur",
        "right_type": "SYNC",
        "exploitation_type": "SYNCHRONIZATION",
        "territory": "WORLD",
        "units": 1,
        "gross_amount": "6500.00",
    },
]


def generate_synthetic_files() -> None:
    """Crée les fichiers PDF et CSV synthétiques dans data/synthetic/."""
    CONTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    STATEMENTS_DIR.mkdir(parents=True, exist_ok=True)

    for filename, lines in SYNTHETIC_PDF_CONTRACTS:
        pdf_path = CONTRACTS_DIR / filename
        pdf_path.write_bytes(_build_minimal_pdf_bytes(lines))

    fieldnames = [
        "work_title",
        "iswc",
        "isrc",
        "performer",
        "right_type",
        "exploitation_type",
        "territory",
        "units",
        "gross_amount",
    ]
    for csv_name in (
        "sacem_repartition_2026Q3.csv",
        "spotify_multi_territorial.csv",
        "synchro_direct_fr.csv",
    ):
        csv_path = STATEMENTS_DIR / csv_name
        with csv_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(SACEM_CSV_ROWS)


def seed_database() -> None:
    """Peuple la base de données avec les 25 œuvres, les contrats et un relevé de démonstration."""
    init_db()
    generate_synthetic_files()
    now = datetime.now(timezone.utc)

    with Session(engine) as session:
        existing_works = session.exec(select(Work)).all()
        if not existing_works:
            for w_data in SYNTHETIC_WORKS:
                corpus = " ".join(
                    [w_data["title"], *w_data["alternate_titles"], *w_data["performers"]]
                )
                work = Work(
                    title=w_data["title"],
                    alternate_titles=w_data["alternate_titles"],
                    iswc=w_data["iswc"],
                    isrc_codes=w_data["isrc_codes"],
                    performers=w_data["performers"],
                    splits=w_data["splits"],
                    embedding=compute_text_embedding(corpus),
                    created_at=now,
                    updated_at=now,
                )
                session.add(work)
            session.commit()

        existing_contracts = session.exec(select(Contract)).all()
        if not existing_contracts:
            # Contrat 1 : Validé avec avance de 15 000 € (déjà amortie à hauteur de 3 200 €)
            c1 = Contract(
                contract_reference="CTR-2026-LN01",
                contract_type="CO_EDITION",
                publisher_name="Éditions Solstices Music",
                counterparty_name="Camille Moreau",
                signature_date=date(2026, 1, 15),
                start_date=date(2026, 1, 15),
                territory="WORLD",
                duration_years=10,
                advance_amount=Decimal("15000.00"),
                recouped_amount=Decimal("3200.00"),
                currency="EUR",
                work_titles=["Lumière Noire"],
                parties=[
                    {
                        "party_name": "Camille Moreau",
                        "role": "AC",
                        "ipi_number": "00458912301",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "source_clause_quote": "Article 4 : Camille Moreau (AC, IPI 00458912301) : DEP 50.00% / DRM 50.00%",
                    },
                    {
                        "party_name": "Éditions Solstices Music",
                        "role": "E",
                        "ipi_number": "00891234567",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "source_clause_quote": "Article 4 : Éditions Solstices Music (E, IPI 00891234567) : DEP 50.00% / DRM 50.00%",
                    },
                ],
                advance={
                    "has_advance": True,
                    "advance_amount": "15000.00",
                    "beneficiary_name": "Camille Moreau",
                    "recoupable_streams": ["STREAMING", "SYNCHRONIZATION", "PUBLIC_PERFORMANCE"],
                    "source_clause_quote": "Article 6 : Avance récupérable de 15 000 EUR HT amortissable sur tous revenus.",
                },
                royalty_rules=[],
                source_filename="contrat_coedition_lumiere_noire.pdf",
                extracted_clauses_summary=(
                    "Article 4 - Répartition DEP 50/50 & DRM 50/50 entre Camille Moreau et Éditions Solstices Music.\n"
                    "Article 6 - Avance récupérable de 15 000,00 EUR HT."
                ),
                cwr_split_warnings=[],
                confidence_score=0.96,
                validation_status=ValidationStatus.VALIDATED.value,
                validated_by="directeur.juridique@solstices-music.fr",
                validated_at=now,
                created_at=now,
                updated_at=now,
            )
            session.add(c1)
            session.commit()
            session.refresh(c1)

            session.add(
                AdvanceLedger(
                    contract_id=c1.id,
                    contract_reference=c1.contract_reference,
                    holder_name="Camille Moreau",
                    ipi_number="00458912301",
                    initial_advance=Decimal("15000.00"),
                    recouped_amount=Decimal("3200.00"),
                    updated_at=now,
                )
            )

            # Contrat 2 : En attente de validation humaine (PENDING_REVIEW) avec conflit de splits CWR
            c2_parties = [
                {
                    "party_name": "Sami Benali",
                    "role": "AC",
                    "ipi_number": "00398765432",
                    "dep_share_pct": "40.00",
                    "drm_share_pct": "50.00",
                    "source_clause_quote": "Article 4 : Sami Benali (AC, IPI 00398765432) : DEP 40.00% | DRM 50.00%",
                },
                {
                    "party_name": "Éditions Solstices Music",
                    "role": "E",
                    "ipi_number": "00891234567",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "source_clause_quote": "Article 4 : Éditions Solstices Music (E, IPI 00891234567) : DEP 50.00% | DRM 50.00%",
                },
            ]
            c2_rep = validate_work_cwr(
                work_title="Orage d'Octobre",
                splits=[
                    {
                        "holder_name": p["party_name"],
                        "role": p["role"],
                        "ipi_number": p["ipi_number"],
                        "dep_share_pct": p["dep_share_pct"],
                        "drm_share_pct": p["drm_share_pct"],
                    }
                    for p in c2_parties
                ],
            )
            c2 = Contract(
                contract_reference="CTR-2026-OO04",
                contract_type="CESSION_EDITION",
                publisher_name="Éditions Solstices Music",
                counterparty_name="Sami Benali",
                signature_date=date(2026, 9, 10),
                start_date=date(2026, 9, 10),
                territory="WORLD",
                duration_years=15,
                advance_amount=Decimal("3000.00"),
                recouped_amount=Decimal("0.00"),
                currency="EUR",
                work_titles=["Orage d'Octobre"],
                parties=c2_parties,
                advance={
                    "has_advance": True,
                    "advance_amount": "3000.00",
                    "beneficiary_name": "Sami Benali",
                    "recoupable_streams": ["STREAMING", "PUBLIC_PERFORMANCE"],
                    "source_clause_quote": "Article 6 : Avance de 3 000 EUR HT.",
                },
                royalty_rules=[],
                source_filename="contrat_pacte_orage_octobre_anomalie.pdf",
                extracted_clauses_summary=(
                    "Article 4 - Sami Benali (40% DEP / 50% DRM) et Éditions Solstices Music (50% DEP / 50% DRM).\n"
                    "Attention : Total DEP extrait = 90.00% (10% non attribués dans le PDF scanné)."
                ),
                cwr_split_warnings=c2_rep.blocking_errors,
                confidence_score=0.74,
                validation_status=ValidationStatus.PENDING_REVIEW.value,
                created_at=now,
                updated_at=now,
            )
            session.add(c2)
            session.commit()

        existing_stmts = session.exec(select(RoyaltyStatement)).all()
        if not existing_stmts:
            catalog_works = list(session.exec(select(Work)).all())
            stmt = RoyaltyStatement(
                source_name="SACEM Répartition 2026-Q3 & DSP",
                filename="sacem_repartition_2026Q3.csv",
                period_start=date(2026, 7, 1),
                period_end=date(2026, 9, 30),
                total_gross_amount=Decimal("0.00"),
                currency="EUR",
                created_at=now,
            )
            session.add(stmt)
            session.commit()
            session.refresh(stmt)

            total_gross = Decimal("0.00")
            for idx, r in enumerate(SACEM_CSV_ROWS, start=1):
                gross_val = Decimal(r["gross_amount"])
                total_gross += gross_val
                line_in = StatementLineCreate(
                    row_number=idx,
                    raw_work_title=r["work_title"],
                    raw_iswc=r["iswc"] or None,
                    raw_isrc=r["isrc"] or None,
                    raw_performer=r["performer"] or None,
                    right_type=r["right_type"],  # type: ignore[arg-type]
                    exploitation_type=ExploitationType(r["exploitation_type"]),
                    territory=r["territory"],
                    units=int(r["units"]),
                    gross_amount=gross_val,
                    currency="EUR",
                )
                matched = match_statement_line_to_catalog(line_in, catalog_works)
                # Pré-valide la ligne 1 (ISWC exact) pour montrer immédiatement un calcul déterministe
                is_first = idx == 1
                allocs = []
                if is_first and matched.matched_work_id:
                    w_obj = session.get(Work, matched.matched_work_id)
                    if w_obj and w_obj.splits:
                        allocs = [
                            a.model_dump(mode="json")
                            for a in calculate_line_allocations(
                                gross_amount=gross_val,
                                splits=w_obj.splits,
                                right_type="DEP",
                            )
                        ]

                db_line = StatementLine(
                    statement_id=stmt.id,
                    row_number=idx,
                    raw_work_title=r["work_title"],
                    raw_iswc=r["iswc"] or None,
                    raw_isrc=r["isrc"] or None,
                    raw_performer=r["performer"] or None,
                    right_type=r["right_type"],
                    exploitation_type=r["exploitation_type"],
                    territory=r["territory"],
                    units=int(r["units"]),
                    gross_amount=gross_val,
                    currency="EUR",
                    matched_work_id=matched.matched_work_id,
                    matched_work_title=matched.matched_work_title,
                    match_method=matched.match_method.value,
                    confidence_score=matched.confidence_score,
                    validation_status=(
                        ValidationStatus.VALIDATED.value
                        if is_first
                        else ValidationStatus.PENDING_REVIEW.value
                    ),
                    validated_by="royalty.manager@solstices-music.fr" if is_first else None,
                    validated_at=now if is_first else None,
                    top_match=matched.top_match.model_dump(mode="json") if matched.top_match else None,
                    alternatives=[a.model_dump(mode="json") for a in matched.alternatives],
                    allocations=allocs,
                )
                session.add(db_line)

            stmt.total_gross_amount = total_gross
            session.add(stmt)
            session.commit()


if __name__ == "__main__":
    seed_database()
    print(
        f"✅ Seed terminé : {len(SYNTHETIC_WORKS)} œuvres, "
        f"{len(SYNTHETIC_PDF_CONTRACTS)} contrats PDF dans {CONTRACTS_DIR} "
        f"et 3 relevés CSV dans {STATEMENTS_DIR}."
    )
