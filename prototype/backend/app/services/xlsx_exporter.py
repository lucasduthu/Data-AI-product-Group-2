"""Générateur OpenXML Excel (.xlsx) déterministe avec zéro dépendance externe.

Conçu exclusivement à partir des modules standard Python (zipfile, xml.etree.ElementTree)
pour une portabilité et une fiabilité absolues sur tout environnement.
Génère des classeurs Excel .xlsx complets et stylés pour la livraison aux sous-éditeurs (US-5.18).
"""

from __future__ import annotations

import io
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from app.models.work import Work
from app.schemas.work import RightHolderSplit


def _escape_xml(text: str) -> str:
    """Échappe les caractères réservés XML."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _col_idx_to_ref(idx: int) -> str:
    """Convertit un index 0-based en coordonnée de colonne Excel (0 -> A, 1 -> B, 26 -> AA)."""
    col_str = ""
    idx += 1
    while idx > 0:
        idx, remainder = divmod(idx - 1, 26)
        col_str = chr(65 + remainder) + col_str
    return col_str


def build_raw_xlsx_bytes(
    sheet_data_dict: dict[str, list[list[Any]]],
) -> bytes:
    """Construit un classeur Excel .xlsx complet sous forme de flux binaire (bytes).

    `sheet_data_dict` mappe le nom de chaque feuille (ex: 'Bordereau', 'Catalogue')
    à une liste de lignes, où chaque ligne est une liste de valeurs scalaires.
    """
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        # 1. [Content_Types].xml
        types_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
            '  <Default Extension="xml" ContentType="application/xml"/>',
            '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
            '  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        ]
        for i in range(1, len(sheet_data_dict) + 1):
            types_lines.append(
                f'  <Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            )
        types_lines.append("</Types>")
        z.writestr("[Content_Types].xml", "\n".join(types_lines))

        # 2. _rels/.rels
        z.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n'
            "</Relationships>",
        )

        # 3. xl/_rels/workbook.xml.rels
        wb_rels_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        ]
        r_id = 1
        for i in range(1, len(sheet_data_dict) + 1):
            wb_rels_lines.append(
                f'  <Relationship Id="rId{r_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
            )
            r_id += 1
        wb_rels_lines.append(
            f'  <Relationship Id="rId{r_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        )
        wb_rels_lines.append("</Relationships>")
        z.writestr("xl/_rels/workbook.xml.rels", "\n".join(wb_rels_lines))

        # 4. xl/workbook.xml
        wb_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
            "  <sheets>",
        ]
        sheet_idx = 1
        for sheet_name in sheet_data_dict.keys():
            safe_name = _escape_xml(sheet_name)[:31]
            wb_lines.append(f'    <sheet name="{safe_name}" sheetId="{sheet_idx}" r:id="rId{sheet_idx}"/>')
            sheet_idx += 1
        wb_lines.append("  </sheets>")
        wb_lines.append("</workbook>")
        z.writestr("xl/workbook.xml", "\n".join(wb_lines))

        # 5. xl/styles.xml (styles professionnels : en-tête colorée violet/indigo Korom, quadrillage propre)
        styles_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n'
            '  <fonts count="3">\n'
            '    <font><name val="Segoe UI"/><sz val="10"/><color rgb="FF1F2937"/></font>\n'
            '    <font><b/><name val="Segoe UI"/><sz val="11"/><color rgb="FFFFFFFF"/></font>\n'
            '    <font><b/><name val="Segoe UI"/><sz val="10"/><color rgb="FF4F46E5"/></font>\n'
            "  </fonts>\n"
            '  <fills count="4">\n'
            '    <fill><patternFill patternType="none"/></fill>\n'
            '    <fill><patternFill patternType="gray125"/></fill>\n'
            '    <fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill>\n'
            '    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>\n'
            "  </fills>\n"
            '  <borders count="2">\n'
            "    <border><left/><right/><top/><bottom/></border>\n"
            "    <border>\n"
            '      <left style="thin"><color rgb="FFE5E7EB"/></left>\n'
            '      <right style="thin"><color rgb="FFE5E7EB"/></right>\n'
            '      <top style="thin"><color rgb="FFE5E7EB"/></top>\n'
            '      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>\n'
            "    </border>\n"
            "  </borders>\n"
            '  <cellStyleXfs count="1">\n'
            '    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>\n'
            "  </cellStyleXfs>\n"
            '  <cellXfs count="4">\n'
            '    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>\n'
            '    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">\n'
            '      <alignment horizontal="center" vertical="center" wrapText="1"/>\n'
            "    </xf>\n"
            '    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>\n'
            '    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>\n'
            "  </cellXfs>\n"
            "</styleSheet>"
        )
        z.writestr("xl/styles.xml", styles_xml)

        # 6. xl/worksheets/sheet{i}.xml
        sheet_idx = 1
        for sheet_rows in sheet_data_dict.values():
            sheet_lines = [
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
                "  <sheetData>",
            ]
            for row_idx, row in enumerate(sheet_rows, start=1):
                is_header = (row_idx == 1)
                sheet_lines.append(f'    <row r="{row_idx}">')
                for col_idx, val in enumerate(row):
                    col_letter = _col_idx_to_ref(col_idx)
                    cell_ref = f"{col_letter}{row_idx}"
                    style_id = 1 if is_header else 0

                    if val is None:
                        val_str = ""
                    elif isinstance(val, (int, float, Decimal)):
                        val_str = str(val)
                    else:
                        val_str = str(val)

                    clean_val = _escape_xml(val_str)
                    sheet_lines.append(
                        f'      <c r="{cell_ref}" t="inlineStr" s="{style_id}"><is><t>{clean_val}</t></is></c>'
                    )
                sheet_lines.append("    </row>")

            sheet_lines.append("  </sheetData>")
            sheet_lines.append("</worksheet>")
            z.writestr(f"xl/worksheets/sheet{sheet_idx}.xml", "\n".join(sheet_lines))
            sheet_idx += 1

    buf.seek(0)
    return buf.getvalue()


def generate_works_visibility_xlsx(
    works: list[Work],
) -> bytes:
    """Génère un classeur Excel .xlsx de visibilité avec 1 ligne par œuvre et les colonnes dépliées par ayant droit :
    - Date de création
    - Titre de l'œuvre
    - Pour chaque ayant droit k (1, 2, 3...) :
      - Nom ayant-droit k
      - Rôle ayant-droit k
      - Code IPI ayant-droit k
      - Part DEP (%) ayant-droit k
      - Part DRM (%) ayant-droit k
      - Part Sync (%) ayant-droit k
      - Part Phono (%) ayant-droit k
    """
    parsed_works_splits: list[list[RightHolderSplit]] = []
    max_holders = 1

    for w in works:
        splits = [
            s if isinstance(s, RightHolderSplit) else RightHolderSplit.model_validate(s)
            for s in (w.splits or [])
        ]
        parsed_works_splits.append(splits)
        if len(splits) > max_holders:
            max_holders = len(splits)

    headers: list[str] = [
        "Date de création",
        "Titre de l'œuvre",
    ]
    for k in range(1, max_holders + 1):
        headers.extend(
            [
                f"Nom ayant-droit {k}",
                f"Rôle ayant-droit {k}",
                f"Code IPI ayant-droit {k}",
                f"Part DEP (%) ayant-droit {k}",
                f"Part DRM (%) ayant-droit {k}",
                f"Part Sync (%) ayant-droit {k}",
                f"Part Phono (%) ayant-droit {k}",
            ]
        )

    rows: list[list[Any]] = [headers]

    for w, splits in zip(works, parsed_works_splits):
        if getattr(w, "created_at", None):
            created_str = w.created_at.strftime("%d/%m/%Y")
        elif getattr(w, "creation_year", None):
            created_str = str(w.creation_year)
        else:
            created_str = datetime.now(timezone.utc).strftime("%d/%m/%Y")

        row: list[Any] = [
            created_str,
            w.title,
        ]

        for k in range(max_holders):
            if k < len(splits):
                sp = splits[k]
                role_str = sp.role.value if hasattr(sp.role, "value") else str(sp.role)
                row.extend(
                    [
                        sp.holder_name or "",
                        role_str,
                        sp.ipi_number or "",
                        f"{Decimal(str(sp.dep_share_pct or 0)):.2f}",
                        f"{Decimal(str(sp.drm_share_pct or 0)):.2f}",
                        f"{Decimal(str(sp.sync_share_pct or 0)):.2f}",
                        f"{Decimal(str(sp.phono_share_pct or 0)):.2f}",
                    ]
                )
            else:
                row.extend(["", "", "", "", "", "", ""])

        rows.append(row)

    return build_raw_xlsx_bytes({"Oeuvres": rows})


def generate_subpublishing_delivery_xlsx(
    works: list[Work],
    sub_publisher_name: str = "Sous-Éditeur International",
    territory: str = "Monde entier hors France",
    delivery_ref: str = "LIV-SUB-001",
    publisher_name: str = "Éditions Solstices Music",
    publisher_ipi: str = "00891234567",
    notes: str | None = None,
) -> bytes:
    """Génère le bordereau de livraison Excel .xlsx complet et normé pour les sous-éditeurs."""
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y")

    # Feuille 1 : Bordereau de Transmission
    summary_rows: list[list[Any]] = [
        ["BORDEREAU DE LIVRAISON SOUS-ÉDITION INTERNATIONALE", ""],
        ["Référence du bordereau", delivery_ref],
        ["Date d'export & transmission", now_str],
        ["Maison d'édition cédante / déclarante", publisher_name],
        ["Code IPI de l'éditeur déclarant", publisher_ipi],
        ["Sous-éditeur concessionnaire / partenaire", sub_publisher_name],
        ["Territoire concédé / mandaté", territory],
        ["Nombre total de titres livrés", len(works)],
        ["Statut de conformité", "Titres vérifiés et consolidés avec la SACEM"],
        ["Notes & Clauses particulières", notes or "Livraison semestrielle standard - Décomptes et reversements selon contrat de sous-édition."],
    ]

    # Feuille 2 : Catalogue Détaillé des Œuvres
    headers = [
        "N°",
        "Titre Principal",
        "Sous-Titres & Alias",
        "Cotage Éditorial",
        "Code Œuvre SACEM (COCV)",
        "Code ISWC",
        "Genre Musical",
        "Durée",
        "Ayants Droit & Rôles",
        "Codes IPI",
        "DEP % (Exécution)",
        "DRM % (Mécanique)",
        "SYNC % (Audiovisuel)",
        "PHONO % (Master)",
        "Droits Contrôlés & Mandat",
        "Statut Korom",
    ]

    catalog_rows: list[list[Any]] = [headers]

    for idx, w in enumerate(works, start=1):
        alts = " ; ".join(w.alternate_titles or [])
        if getattr(w, "subtitle", None) and w.subtitle not in (w.alternate_titles or []):
            alts = f"{w.subtitle} ; {alts}" if alts else w.subtitle

        splits = [
            s if isinstance(s, RightHolderSplit) else RightHolderSplit.model_validate(s)
            for s in (w.splits or [])
        ]

        holders_str = " | ".join(f"{s.holder_name} ({s.role})" for s in splits)
        ipis_str = " | ".join(f"{s.holder_name}: {s.ipi_number or 'Inconnu'}" for s in splits)

        dep_str = " | ".join(f"{s.holder_name}: {s.dep_share_pct:.2f}%" for s in splits)
        drm_str = " | ".join(f"{s.holder_name}: {s.drm_share_pct:.2f}%" for s in splits)
        sync_str = " | ".join(f"{s.holder_name}: {s.sync_share_pct:.2f}%" for s in splits)
        phono_str = " | ".join(f"{s.holder_name}: {s.phono_share_pct:.2f}%" for s in splits)

        controls_list = []
        for s in splits:
            if s.is_controlled:
                controls_list.append(f"{s.holder_name} (Contrôlé par {s.controlled_by_name or publisher_name})")
            else:
                controls_list.append(f"{s.holder_name} (Perception directe)")
        controls_str = " | ".join(controls_list)

        duration_formatted = ""
        if w.duration_seconds:
            mins, secs = divmod(w.duration_seconds, 60)
            duration_formatted = f"{mins:02d}:{secs:02d}"

        catalog_rows.append(
            [
                idx,
                w.title,
                alts,
                w.cotage_number or "",
                w.sacem_work_code or "",
                w.iswc or "",
                w.genre or "",
                duration_formatted,
                holders_str,
                ipis_str,
                dep_str,
                drm_str,
                sync_str,
                phono_str,
                controls_str,
                w.lifecycle_status or "A_DEPOSER",
            ]
        )

    sheet_dict = {
        "Bordereau Transmission": summary_rows,
        "Catalogue Sous-Édition": catalog_rows,
    }

    return build_raw_xlsx_bytes(sheet_dict)
