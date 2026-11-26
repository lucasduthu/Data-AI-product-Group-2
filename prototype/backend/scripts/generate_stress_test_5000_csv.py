"""
Génère un fichier de stress-test CSV volumineux et réaliste (5 000 lignes)
calibré sur le catalogue CWR de 1 200 œuvres (Le Sage) pour démontrer :
1. La rapidité d'ingestion et de matching en mémoire (O(1) + déduplication)
2. La précision à 6 décimales sur les micro-redevances de streaming (ex: 0.000318 €)
3. La reconnaissance de titres bruités (sans ISWC, fautes de frappe, feat., radio edit)
4. L'invariant mathématique et l'amortissement d'avance en direct lors de la démo.
"""

import csv
import random
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
OUTPUT_FILE = ROOT_DIR / "data" / "samples" / "STRESS_TEST_STREAMING_SACEM_5000_LIGNES.csv"

TITLES_PREFIX = [
    "LUMIERE", "MINUIT", "ORAGE", "HORIZON", "TRAVERSEE", "ECHO", "SOLSTICE",
    "MIRAGE", "VELOURS", "VERTIGE", "ECLIPSE", "PARADIS", "RIVAGE", "ODYSSEE",
    "FRAGMENT", "SILENCE", "CADENCE", "PRISME", "AUBE", "CREPUSCULE", "ETOILE",
    "MEMOIRE", "SILLAGE", "BRUME", "VAGUE", "TONNERRE", "COMETE", "NEBULEUSE",
    "ARCHIPEL", "METEORE",
]

TITLES_SUFFIX = [
    "DE BELLEVILLE", "SUR LA SEINE", "D OCTOBRE", "VELOCE", "NOCTURNE",
    "DE MONTMARTRE", "ATLANTIQUE", "MAGNETIQUE", "SOLAIRE", "ELECTRIQUE",
    "D HIVER", "DE PRINTEMPS", "D ETE", "D AUTOMNE", "SUR MER",
    "DE PARIS", "DE LYON", "DE MARSEILLE", "INFINI", "SECRET",
    "PERDU", "RETROUVE", "SAUVAGE", "MODERNE", "CLASSIQUE",
    "ACOUSTIQUE", "SYMPHONIQUE", "ANALOGIQUE", "DIGITAL", "CELESTE",
    "SOUTERRAIN", "LOINTAIN", "PROCHE", "BRULANT", "GLACE",
    "POURPRE", "AZUR", "EMERAUDE", "VERMEIL", "IVOIRE",
]

PERFORMERS = [
    "Camille Moreau", "Léa Vasseur", "Julien Delacroix", "Sami Benali",
    "Clara Silvestre", "Antoine Garnier", "Nova Pulse", "K-Soprano",
    "Inès Roche", "Maxime Leroy", "Chloé Fontaine", "Néon Bleu",
]

TERRITORIES = ["FR", "FR", "FR", "DE", "GB", "US", "BE", "CH", "CA", "JP", "IT", "ES", "NL"]
EXPLOITATIONS = ["STREAMING", "STREAMING", "STREAMING", "PUBLIC_PERFORMANCE", "DOWNLOAD", "SYNCHRONIZATION"]
RIGHT_TYPES = ["DEP", "DRM", "DRM", "DEP", "SYNC"]

NOISE_VARIATIONS = [
    lambda t, p: f"{t} - Radio Edit",
    lambda t, p: f"{t} (Remastered 2026)",
    lambda t, p: f"{t.lower()} feat. k",
    lambda t, p: f"{t} (Live in Paris)",
    lambda t, p: f"{t} - Club Mix",
    lambda t, p: f"{t.replace(' ', ' s/ ')}",
    lambda t, p: t,
]


def generate_stress_test_csv(num_rows: int = 5000) -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    random.seed(42)  # Déterministe et reproductible

    rows: list[dict[str, object]] = []
    
    # 1. Quelques titres phares très répétés (comme dans la réalité d'un relevé DSP Spotify de 5 000 lignes)
    flagship_works = [
        {"title": "Lumière Noire", "iswc": "T-301.452.891-4", "isrc": "FRZ012600101", "performer": "Camille Moreau"},
        {"title": "Minuit sur la Seine", "iswc": "T-302.118.440-2", "isrc": "FRZ012600201", "performer": "Léa Vasseur"},
        {"title": "Horizon Véloce", "iswc": "T-303.774.129-8", "isrc": "FRZ012600301", "performer": "Nova Pulse"},
        {"title": "Traversée Nocturne", "iswc": "T-306.100.201-1", "isrc": "FRZ012600601", "performer": "Clara Silvestre"},
    ]

    for i in range(1, num_rows + 1):
        is_flagship = random.random() < 0.40  # 40% des streams concentrés sur les titres majeurs
        if is_flagship:
            work_meta = random.choice(flagship_works)
            clean_title = work_meta["title"]
            base_iswc = work_meta["iswc"]
            base_isrc = work_meta["isrc"]
            performer = work_meta["performer"]
        else:
            # Œuvres piochées dans le catalogue CWR 1200
            work_idx = random.randint(1, 1200)
            prefix = TITLES_PREFIX[(work_idx - 1) % len(TITLES_PREFIX)].title()
            suffix = TITLES_SUFFIX[((work_idx - 1) // len(TITLES_PREFIX)) % len(TITLES_SUFFIX)].title()
            clean_title = f"{prefix} {suffix} #{work_idx:04d}"
            mid_num = 301000000 + work_idx
            check_digit = work_idx % 10
            base_iswc = f"T-{mid_num // 1000000}.{(mid_num // 1000) % 1000:03d}.{mid_num % 1000:03d}-{check_digit}"
            base_isrc = f"FRZ0126{work_idx:05d}"
            performer = PERFORMERS[(work_idx - 1) % len(PERFORMERS)]

        # Bruitage réaliste DSP : 30% des lignes n'ont pas d'ISWC
        has_iswc = random.random() > 0.30
        has_isrc = random.random() > 0.20
        raw_iswc = base_iswc if has_iswc else ""
        raw_isrc = base_isrc if has_isrc else ""

        # Variation de titre bruitée
        noise_fn = random.choice(NOISE_VARIATIONS)
        raw_title = noise_fn(clean_title, performer)

        exp_type = random.choice(EXPLOITATIONS)
        territory = random.choice(TERRITORIES)
        right_type = "SYNC" if exp_type == "SYNCHRONIZATION" else ("DRM" if exp_type == "STREAMING" and random.random() > 0.5 else "DEP")

        # Micro-montants de streaming réalistes (ex: 0.000318 €) ou montants de synchro/perf
        if exp_type == "STREAMING":
            units = random.randint(10, 50000)
            # Taux unitaire par stream typique : entre 0.00025 € et 0.0035 €
            unit_rate = random.uniform(0.00025, 0.0035)
            gross_amt = round(units * unit_rate, 6)
        elif exp_type == "SYNCHRONIZATION":
            units = 1
            gross_amt = round(random.choice([1200.00, 2500.00, 4500.00, 8000.00]), 2)
        elif exp_type == "PUBLIC_PERFORMANCE":
            units = random.randint(100, 5000)
            gross_amt = round(random.uniform(15.00, 850.00), 2)
        else:
            units = random.randint(1, 150)
            gross_amt = round(units * random.uniform(0.40, 1.20), 2)

        rows.append({
            "work_title": raw_title,
            "iswc": raw_iswc,
            "isrc": raw_isrc,
            "performer": performer,
            "right_type": right_type,
            "exploitation_type": exp_type,
            "territory": territory,
            "units": units,
            "gross_amount": f"{gross_amt:.6f}" if exp_type == "STREAMING" else f"{gross_amt:.2f}",
        })

    fieldnames = [
        "work_title", "iswc", "isrc", "performer", "right_type",
        "exploitation_type", "territory", "units", "gross_amount",
    ]

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅ Fichier de stress-test généré avec succès : {OUTPUT_FILE} ({len(rows)} lignes).")


if __name__ == "__main__":
    generate_stress_test_csv(5000)
