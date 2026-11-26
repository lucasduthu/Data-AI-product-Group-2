"""
Génère un fichier maître CWR v2.1 (.V21) de test contenant 1 200 œuvres musicales
pour tester la migration haute volumétrie (> 1 000 œuvres) depuis Le Sage / SACEM Pro.
"""

from pathlib import Path

TITLES_PREFIX = [
    "LUMIERE", "MINUIT", "ORAGE", "HORIZON", "TRAVERSEE", "ECHO", "SOLSTICE",
    "MIRAGE", "VELOURS", " VERTIGE", "ECLIPSE", "PARADIS", " RIVAGE", "ODYSSEE",
    "FRAGMENT", "SILENCE", "CADENCE", "PRISME", "AUBE", "CREPUSCULE", "etoile",
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
    " SOUTERRAIN", "LOINTAIN", "PROCHE", "BRULANT", "GLACE",
    "POURPRE", "AZUR", "EMERAUDE", "VERMEIL", "IVOIRE",
]

WRITERS = [
    ("CAMILLE MOREAU", "00458912301"),
    ("LEA VASSEUR", "00512398741"),
    ("JULIEN DELACROIX", "00623489120"),
    ("SAMI BENALI", "00398765432"),
    ("CLARA SILVESTRE", "00491827364"),
    ("ANTOINE GARNIER", "00734512980"),
    ("K SOPRANO", "00588123490"),
    ("INES ROCHE", "00619283746"),
    ("MAXIME LEROY", "00791827365"),
    ("CHLOE FONTAINE", "00819283744"),
]


def build_cwr_1200_file(output_path: Path, total_works: int = 1200) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = [
        "HDRPB008912345EDITIONS SOLSTICES MUSIC (EXPORT LE SAGE)    01.102026110416300020261104",
        "GRHNWR0000102.100000000000",
    ]

    record_seq = 0
    for idx in range(1, total_works + 1):
        prefix = TITLES_PREFIX[(idx - 1) % len(TITLES_PREFIX)].strip().upper()
        suffix = TITLES_SUFFIX[((idx - 1) // len(TITLES_PREFIX)) % len(TITLES_SUFFIX)].strip().upper()
        work_title = f"{prefix} {suffix} #{idx:04d}"
        work_code = f"LESAGE{idx:08d}"

        # ISWC exact 11 chars: T + 9 digits + check digit
        mid_num = 301000000 + idx
        check_digit = idx % 10
        raw_iswc = f"T{mid_num:09d}{check_digit}"

        writer_name, writer_ipi = WRITERS[(idx - 1) % len(WRITERS)]

        # Ligne NWR (pos 0..3='NWR', 19..79=Title(60), 81..95=WorkCode(14), 95..106=ISWC(11))
        nwr_line = (
            f"NWR{idx:08d}{record_seq:08d}"
            f"{work_title.ljust(60)[:60]}"
            f"  {work_code.ljust(14)[:14]}"
            f"{raw_iswc.ljust(11)[:11]}"
            f"20261104    UNC"
        )
        lines.append(nwr_line)
        record_seq += 1

        # Ligne ALT (Alias / Titre alternatif pour le Smart Matching)
        alt_title = f"{prefix} {suffix} (RADIO EDIT {idx})"
        alt_line = f"ALT{idx:08d}{record_seq:08d}{alt_title.ljust(60)[:60]}ATFR"
        lines.append(alt_line)
        record_seq += 1

        # 1 œuvre sur 100 (12 œuvres sur 1200) comporte une anomalie héritée de Le Sage (DEP 40% + 50% = 90%)
        is_legacy_anomaly = idx % 100 == 0
        writer_dep_token = "040000500000000" if is_legacy_anomaly else "050000500000000"
        pub_dep_token = "050000500000000"

        # Ligne SPU (Éditeur : pos 28..73=Name(45), suivi de Role + IPI 11 chiffres + parts 15 chiffres)
        spu_line = (
            f"SPU{idx:08d}{record_seq:08d}01{work_code[:9].ljust(9)}"
            f"{'EDITIONS SOLSTICES MUSIC'.ljust(45)[:45]}"
            f" E 00891234567 {pub_dep_token}"
        )
        lines.append(spu_line)
        record_seq += 1

        # Ligne SWR (Auteur-Compositeur)
        swr_line = (
            f"SWR{idx:08d}{record_seq:08d}01{work_code[:9].ljust(9)}"
            f"{writer_name.ljust(45)[:45]}"
            f" CA {writer_ipi} {writer_dep_token}"
        )
        lines.append(swr_line)
        record_seq += 1

    lines.append(f"GRT00001{total_works:08d}{record_seq + 2:08d}   0000000000")
    lines.append(f"TRL00001{total_works:08d}{record_seq + 4:08d}")

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    target = root / "data" / "samples" / "CW261104_LESAGE_STOCK_1200_OEUVRES.V21"
    build_cwr_1200_file(target, total_works=1200)
    print(f"Fichier généré : {target} ({target.stat().st_size} octets)")
