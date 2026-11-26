"""Service de lecture déterministe de classeurs Excel (.xlsx / .xlsm) pour Korom.

Conçu avec les bibliothèques standard Python (zipfile, xml.etree.ElementTree)
pour une fiabilité absolue, une vitesse maximale et zéro dépendance externe.
Prend en charge les exports officiels de l'Espace Membre SACEM (Mes_oeuvres_*.xlsx).
"""

from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET
from typing import Any


def col_ref_to_idx(cell_ref: str) -> int:
    """Convertit une coordonnée de colonne Excel (ex: 'A', 'B', 'Z', 'AA') en index 0-based.

    Exemples :
        'A1'  -> 0
        'B2'  -> 1
        'Z1'  -> 25
        'AA1' -> 26
    """
    m = re.match(r"^([A-Za-z]+)", cell_ref.strip())
    if not m:
        return 0
    letters = m.group(1).upper()
    idx = 0
    for char in letters:
        idx = idx * 26 + (ord(char) - ord("A") + 1)
    return idx - 1


def read_xlsx_as_csv(raw_bytes: bytes, delimiter: str = ";") -> str:
    """Lit un fichier Excel .xlsx brut et le convertit en flux textuel CSV délimité.

    - Extrait la table de chaînes partagées (sharedStrings.xml)
    - Analyse la première feuille de calcul (sheet1.xml)
    - Conserve l'alignement strict des colonnes même en présence de cellules vides.
    """
    with zipfile_open(raw_bytes) as z:
        # 1. Extraction des chaînes partagées (sharedStrings)
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            ns = {"ns": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            si_elements = tree.findall("ns:si", ns)
            if not si_elements:
                si_elements = tree.findall("si")
            for si in si_elements:
                t_elements = si.findall(".//ns:t", ns)
                if not t_elements:
                    t_elements = si.findall(".//t")
                texts = [t.text or "" for t in t_elements]
                shared_strings.append("".join(texts))

        # 2. Localisation de la première feuille de calcul
        sheets = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
        if not sheets:
            raise ValueError("Feuille de calcul introuvable dans le fichier Excel .xlsx.")
        # Trier pour prioriser sheet1.xml
        sheets.sort(key=lambda s: (0 if "sheet1.xml" in s else 1, s))
        sheet_path = sheets[0]

        tree = ET.fromstring(z.read(sheet_path))
        ns = {"ns": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

        rows_output: list[str] = []
        row_elements = tree.findall(".//ns:row", ns)
        if not row_elements:
            row_elements = tree.findall(".//row")

        for row_el in row_elements:
            row_dict: dict[int, str] = {}
            max_col = -1

            cell_elements = row_el.findall("ns:c", ns)
            if not cell_elements:
                cell_elements = row_el.findall("c")
            for c in cell_elements:
                ref = c.get("r", "")
                c_idx = col_ref_to_idx(ref) if ref else len(row_dict)
                t = c.get("t")

                v_el = c.find("ns:v", ns)
                if v_el is None:
                    v_el = c.find("v")
                val = v_el.text if v_el is not None and v_el.text else ""

                if t == "s" and val.isdigit() and int(val) < len(shared_strings):
                    val = shared_strings[int(val)]
                elif t == "inlineStr":
                    is_t = c.find(".//ns:t", ns)
                    if is_t is None:
                        is_t = c.find(".//t")
                    val = is_t.text if is_t is not None and is_t.text else ""
                elif t == "b":
                    val = "1" if val == "1" else "0"

                # Nettoyage et assainissement
                val = val.replace("\r", " ").replace("\n", " ").strip()
                # Échappement des délimiteurs
                if delimiter in val:
                    val = f'"{val}"'

                row_dict[c_idx] = val
                if c_idx > max_col:
                    max_col = c_idx

            if row_dict and max_col >= 0:
                cells = [row_dict.get(i, "") for i in range(max_col + 1)]
                # Ne pas inclure les lignes entièrement vides
                if any(c.strip() for c in cells):
                    rows_output.append(delimiter.join(cells))

        return "\n".join(rows_output)


def zipfile_open(raw_bytes: bytes):
    import zipfile

    return zipfile.ZipFile(io.BytesIO(raw_bytes))
