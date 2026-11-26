import csv
import hashlib
import io
import re
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.models.audit_log import AuditLog
from app.models.contract import AdvanceLedger, Contract
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.schemas.common import ValidationStatus
from app.schemas.work import CWRValidationReport, RightHolderSplit, WorkRead
from app.services.cwr_validator import validate_work_cwr
from app.services.embedding_service import compute_text_embedding

TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")

SAMPLE_LE_SAGE_EXPORT_CSV = """work_title;alternate_titles;iswc;isrc;performers;holders_splits;contract_reference;counterparty_name;initial_advance;recouped_amount
Étoiles de Belleville;Etoiles de Belleville|Belleville Stars;T-308.410.112-5;FRZ012601101;Clara Silvestre;Clara Silvestre:AC:00491827364:50.00:50.00:50.00:20.00|Éditions Solstices Music:E:00891234567:50.00:50.00:50.00:80.00;CTR-LESAGE-2024-08;Clara Silvestre;6000.00;1500.00
Valparaiso Nocturne;Valparaiso Night;T-308.512.908-3;FRZ012601102;Antoine Garnier;Antoine Garnier:A:00734512980:33.33:33.33:33.33:15.00|Julien Delacroix:C:00623489120:33.33:33.33:33.33:15.00|Éditions Solstices Music:E:00891234567:33.34:33.34:33.34:70.00;CTR-LESAGE-2025-14;Antoine Garnier;4000.00;1200.00
Gare du Nord 4h;Gare du Nord 04h00;T-308.771.304-9;FRZ012601103;K-Soprano;K-Soprano:AC:00588123490:50.00:50.00:50.00:25.00|Éditions Solstices Music:E:00891234567:50.00:50.00:50.00:75.00;CTR-LESAGE-2025-19;K-Soprano;0.00;0.00
Mirage Analoge (Anomalie Héritée Le Sage);Mirage Analogue;T-308.990.114-2;FRZ012601104;Sami Benali;Sami Benali:AC:00398765432:45.00:50.00:50.00:20.00|Éditions Solstices Music:E:00891234567:50.00:50.00:50.00:80.00;CTR-LESAGE-2023-02;Sami Benali;2500.00;2500.00
"""


class MigratedWorkPreview(BaseModel):
    """Prévisualisation d'une œuvre analysée dans le sas Dry-Run de migration."""

    title: str
    subtitle: str | None = None
    alternate_titles: list[str] = Field(default_factory=list)
    iswc: str | None = None
    sacem_work_code: str | None = None
    genre: str | None = None
    isrc_codes: list[str] = Field(default_factory=list)
    performers: list[str] = Field(default_factory=list)
    migration_action: str = Field(
        description="NEW (création) ou UPSERT_ISWC (fusion anti-doublon sur ISWC/Code SACEM existant)"
    )
    holders_count: int
    dep_total_pct: str
    drm_total_pct: str
    sync_total_pct: str
    phono_total_pct: str
    is_cwr_ready: bool
    blocking_errors: list[str] = Field(default_factory=list)
    contract_reference: str | None = None
    initial_advance_eur: str = "0.00"
    recouped_advance_eur: str = "0.00"
    remaining_advance_eur: str = "0.00"


class CatalogMigrationReport(BaseModel):
    """Rapport complet du Sas de Migration Sécurisée (Dry-Run ou Exécution Atomique)."""

    dry_run: bool
    source_system: str
    source_filename: str
    sha256_integrity_hash: str
    total_works_parsed: int
    new_works_count: int
    upserted_existing_iswc_count: int
    cwr_ready_works_count: int
    cwr_conflict_works_count: int
    contracts_migrated_count: int
    holders_synced_count: int = 0
    total_initial_advances_eur: str
    total_recouped_advances_eur: str
    total_remaining_advances_eur: str
    items: list[MigratedWorkPreview]
    migrated_works: list[WorkRead] = Field(default_factory=list)


def _safe_dec(raw: str | None, default: str = "0.00") -> Decimal:
    if not raw:
        return Decimal(default)
    cleaned = (
        str(raw)
        .strip()
        .replace("€", "")
        .replace("%", "")
        .replace(" ", "")
        .replace(",", ".")
    )
    try:
        return Decimal(cleaned).quantize(TWO_PLACES)
    except (InvalidOperation, ValueError):
        return Decimal(default)


def _safe_dec_raw(raw: str | None, default: str = "0") -> Decimal:
    if not raw:
        return Decimal(default)
    cleaned = (
        str(raw)
        .strip()
        .replace("€", "")
        .replace("%", "")
        .replace(" ", "")
        .replace(",", ".")
    )
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return Decimal(default)


def _normalize_sacem_shares_to_100(raw_vals: list[Decimal]) -> list[Decimal]:
    """
    Normalise des quotes-parts SACEM à 4 décimales (ex: 33,3330 x 3 = 99,9990% ou 16,6670 x 4 + 33,3330 = 100,0010%)
    vers 2 décimales exactes (0.01) totalisant 100.00 % lorsque la somme d'origine est à 100 % ± 0.05 %.
    """
    if not raw_vals:
        return []
    raw_sum = sum(raw_vals, Decimal("0"))
    rounded = [v.quantize(TWO_PLACES, rounding=ROUND_HALF_UP) for v in raw_vals]
    if abs(raw_sum - Decimal("100")) <= Decimal("0.05"):
        diff = Decimal("100.00") - sum(rounded, Decimal("0.00"))
        if diff != Decimal("0.00"):
            max_idx = max(range(len(rounded)), key=lambda i: (rounded[i], i))
            rounded[max_idx] = (rounded[max_idx] + diff).quantize(TWO_PLACES)
    return rounded


def _is_sacem_portal_csv(content: str, source_system: str) -> bool:
    """Détecte automatiquement un export CSV issu de l'Espace Membre SACEM (Mes_oeuvres_*.csv)."""
    clean = content.lstrip("\ufeff")
    if clean.startswith(("HDR", "GRH", "NWR")):
        return False
    first_line = clean.splitlines()[0] if clean.splitlines() else ""
    if "Code oeuvre" in first_line and ("Part DEP" in first_line or "Titre de l" in first_line):
        return True
    if source_system == "SACEM_CSV" and ";" in first_line:
        return True
    return False


def _parse_sacem_portal_csv(content: str) -> list[dict[str, Any]]:
    """
    Parse un fichier CSV d'export officiel Espace Membre SACEM (Mes_oeuvres_*.csv).
    Colonnes SACEM :
    Code oeuvre;Titre de l'oeuvre;Sous-titre(s);Genre de l'oeuvre;ISWC;Date de déclaration;
    Rôle;Nom de l'ayant-droit;COAD;Nom au fichier IPI;Code IPI;Société en DE;Société en DR;
    Part DEP;Part DR;Part PHONO;Commentaire
    """
    clean_content = content.lstrip("\ufeff")
    first_line = clean_content.splitlines()[0] if clean_content.splitlines() else ""
    delimiter = ";" if ";" in first_line else ","
    reader = csv.DictReader(io.StringIO(clean_content), delimiter=delimiter)

    works_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in reader:
        code = (row.get("Code oeuvre") or row.get("code_oeuvre") or "").strip()
        title = (
            row.get("Titre de l'oeuvre")
            or row.get("Titre de l’oeuvre")
            or row.get("titre")
            or ""
        ).strip()
        iswc = (row.get("ISWC") or "").strip()
        key = code or iswc or title.upper()
        if not key:
            continue
        works_rows[key].append(row)

    parsed_works: list[dict[str, Any]] = []
    valid_roles = {"A", "C", "AC", "AR", "AD", "E", "SE", "P", "I"}

    for work_key, rows in works_rows.items():
        first = rows[0]
        sacem_code = (first.get("Code oeuvre") or first.get("code_oeuvre") or "").strip() or None
        title = (
            first.get("Titre de l'oeuvre")
            or first.get("Titre de l’oeuvre")
            or first.get("titre")
            or work_key
        ).strip()
        subtitle = (first.get("Sous-titre(s)") or "").strip() or None
        alternate_titles = (
            [subtitle]
            if subtitle and subtitle.upper() != title.upper()
            else []
        )
        genre = (
            first.get("Genre de l'oeuvre")
            or first.get("Genre de l’oeuvre")
            or ""
        ).strip() or None
        iswc = (first.get("ISWC") or "").strip() or None
        date_decl = (first.get("Date de déclaration") or "").strip()
        creation_year = (
            int(date_decl[:4])
            if len(date_decl) >= 4 and date_decl[:4].isdigit()
            else None
        )
        comment = (first.get("Commentaire") or "").strip() or None

        merged_splits: dict[tuple[str, str], dict[str, Any]] = {}
        for r in rows:
            dep_raw = _safe_dec_raw(r.get("Part DEP"), "0")
            dr_raw = _safe_dec_raw(r.get("Part DR"), "0")
            phono_raw = _safe_dec_raw(r.get("Part PHONO"), "0")
            # Ignorer les lignes "Pas de société" à 0,0000 % générées par l'export SACEM
            if dep_raw == Decimal("0") and dr_raw == Decimal("0") and phono_raw == Decimal("0"):
                continue

            raw_role = (r.get("Rôle") or "AC").strip().upper()
            role = raw_role if raw_role in valid_roles else "AC"

            raw_ipi = (r.get("Code IPI") or "").strip()
            ipi = (
                raw_ipi.zfill(11)
                if raw_ipi.isdigit() and len(raw_ipi) <= 11
                else (raw_ipi or None)
            )
            coad = (r.get("COAD") or "").strip() or None

            name_ipi = (r.get("Nom au fichier IPI") or "").strip()
            name_ad = (
                r.get("Nom de l'ayant-droit")
                or r.get("Nom de l’ayant-droit")
                or ""
            ).strip()
            name_ad_clean = re.sub(
                r"\s*\((?:SACEM|Pas de soci[é|e]t[é|e])\)\s*$",
                "",
                name_ad,
                flags=re.IGNORECASE,
            ).strip()
            holder_name = name_ipi or name_ad_clean or "Ayant Droit"

            raw_soc_de = (r.get("Société en DE") or "").strip()
            raw_soc_dr = (r.get("Société en DR") or "").strip()
            soc_de = (
                None
                if (not raw_soc_de or "pas de soci" in raw_soc_de.lower())
                else raw_soc_de.upper()
            )
            soc_dr = (
                None
                if (not raw_soc_dr or "pas de soci" in raw_soc_dr.lower())
                else raw_soc_dr.upper()
            )

            merge_key = (ipi or holder_name.upper(), role)
            if merge_key not in merged_splits:
                merged_splits[merge_key] = {
                    "holder_name": holder_name,
                    "role": role,
                    "ipi_number": ipi,
                    "coad": coad,
                    "society_de": soc_de,
                    "society_dr": soc_dr,
                    "dep_raw": Decimal("0"),
                    "dr_raw": Decimal("0"),
                    "phono_raw": Decimal("0"),
                }
            entry = merged_splits[merge_key]
            entry["dep_raw"] += dep_raw
            entry["dr_raw"] += dr_raw
            entry["phono_raw"] += phono_raw
            if soc_de and not entry["society_de"]:
                entry["society_de"] = soc_de
            if soc_dr and not entry["society_dr"]:
                entry["society_dr"] = soc_dr
            if coad and not entry["coad"]:
                entry["coad"] = coad

        split_entries = list(merged_splits.values())
        norm_deps = _normalize_sacem_shares_to_100([e["dep_raw"] for e in split_entries])
        norm_drs = _normalize_sacem_shares_to_100([e["dr_raw"] for e in split_entries])
        norm_phonos = _normalize_sacem_shares_to_100([e["phono_raw"] for e in split_entries])

        splits: list[RightHolderSplit] = []
        holders_metadata: list[dict[str, Any]] = []
        for idx, e in enumerate(split_entries):
            final_soc_de = e["society_de"] or "SACEM"
            final_soc_dr = e["society_dr"] or final_soc_de
            dep_val = norm_deps[idx]
            drm_val = norm_drs[idx]
            phono_val = norm_phonos[idx]
            splits.append(
                RightHolderSplit(
                    holder_name=e["holder_name"],
                    role=e["role"],  # type: ignore[arg-type]
                    ipi_number=e["ipi_number"],
                    dep_share_pct=dep_val,
                    drm_share_pct=drm_val,
                    sync_share_pct=drm_val,
                    phono_share_pct=phono_val,
                    share_percentage=dep_val,
                    society_name=final_soc_de,
                    society_de=final_soc_de,
                    society_dr=final_soc_dr,
                )
            )
            holders_metadata.append(
                {
                    "holder_name": e["holder_name"],
                    "role": e["role"],
                    "ipi_number": e["ipi_number"],
                    "coad": e["coad"],
                    "society_de": final_soc_de,
                    "society_dr": final_soc_dr,
                }
            )

        parsed_works.append(
            {
                "title": title,
                "subtitle": subtitle,
                "alternate_titles": alternate_titles,
                "iswc": iswc,
                "sacem_work_code": sacem_code,
                "genre": genre,
                "creation_year": creation_year,
                "general_notes": comment,
                "isrc_codes": [],
                "performers": [],
                "splits": splits,
                "holders_metadata": holders_metadata,
                "contract_reference": None,
                "counterparty_name": None,
                "initial_advance": Decimal("0.00"),
                "recouped_amount": Decimal("0.00"),
            }
        )

    return parsed_works


def _parse_holders_splits_string(raw_splits: str) -> list[RightHolderSplit]:
    """
    Parse une chaîne compacte d'export Le Sage / Vistex :
    'Nom:ROLE:IPI:DEP:DRM:SYNC:PHONO|Nom2:ROLE2:IPI2:DEP:DRM:SYNC:PHONO'
    """
    splits: list[RightHolderSplit] = []
    if not raw_splits or not raw_splits.strip():
        return splits

    for chunk in raw_splits.split("|"):
        parts = [p.strip() for p in chunk.split(":")]
        if len(parts) < 5:
            continue
        holder_name = parts[0]
        role = parts[1] or "AC"
        ipi = parts[2] or None
        dep_pct = _safe_dec(parts[3], "50.00")
        drm_pct = _safe_dec(parts[4], "50.00")
        sync_pct = _safe_dec(parts[5], str(drm_pct)) if len(parts) > 5 else drm_pct
        phono_pct = _safe_dec(parts[6], str(drm_pct)) if len(parts) > 6 else drm_pct
        splits.append(
            RightHolderSplit(
                holder_name=holder_name,
                role=role,  # type: ignore[arg-type]
                ipi_number=ipi,
                dep_share_pct=dep_pct,
                drm_share_pct=drm_pct,
                sync_share_pct=sync_pct,
                phono_share_pct=phono_pct,
                share_percentage=dep_pct,
            )
        )
    return splits


CISAC_SOCIETY_MAP: dict[str, str] = {
    "058": "SACEM",
    "006": "SDRM",
    "055": "GEMA",
    "052": "PRS",
    "021": "BMI",
    "010": "ASCAP",
    "070": "SABAM",
    "088": "SUISA",
    "079": "SIAE",
    "023": "BUMA",
}


def _clean_cwr_name(last: str, first: str = "") -> str:
    raw = f"{last.strip()} {first.strip()}".strip() if first and first.strip() else last.strip()
    if raw.isupper():
        words = raw.split()
        cleaned_words = []
        for w in words:
            if "'" in w:
                parts = w.split("'")
                cleaned_words.append("'".join(p.capitalize() for p in parts))
            else:
                cleaned_words.append(w.capitalize())
        return " ".join(cleaned_words)
    return raw


def _parse_cwr_v21_file(content: str) -> list[dict[str, Any]]:
    """
    Lecteur inverse de fichier maître CWR v2.1 / v2.2 (.V21 CISAC / SACEM / Le Sage).
    Extrait les enregistrements NWR/REV (œuvres), ALT/ORN (alias/titres audiovisuels),
    SPU/OPU (éditeurs déclarant et coéditeurs), SWR/OWR (auteurs, compositeurs, adaptateurs).
    Reconstitue fidèlement les 100.00 % de quotes-parts statutaires & contractuelles (DEP, DRM, SYNC, PHONO).
    """
    parsed_works: list[dict[str, Any]] = []
    current_work: dict[str, Any] | None = None

    def _flush_work(w: dict[str, Any] | None) -> None:
        if not w or not w.get("title"):
            return
        splits: list[RightHolderSplit] = []
        # 1. Éditeurs déclarants et co-éditeurs (SPU + OPU)
        for pub in w["publishers"].values():
            splits.append(
                RightHolderSplit(
                    holder_name=pub["holder_name"],
                    role="E",
                    ipi_number=pub["ipi_number"],
                    dep_share_pct=pub["dep_share_pct"].quantize(TWO_PLACES),
                    drm_share_pct=pub["drm_share_pct"].quantize(TWO_PLACES),
                    sync_share_pct=pub["sync_share_pct"].quantize(TWO_PLACES),
                    phono_share_pct=pub["phono_share_pct"].quantize(TWO_PLACES),
                    share_percentage=pub["dep_share_pct"].quantize(TWO_PLACES),
                    society_name=pub["society_name"],
                    society_de=pub["society_de"],
                    society_dr=pub["society_dr"],
                    is_controlled=bool(pub.get("is_controlled", False)),
                    controlled_by_name=pub.get("controlled_by_name"),
                )
            )
        # 2. Auteurs, Compositeurs, Adaptateurs (SWR + OWR consolidés)
        for wrt in w["writers"].values():
            splits.append(
                RightHolderSplit(
                    holder_name=wrt["holder_name"],
                    role=wrt["role"],
                    ipi_number=wrt["ipi_number"],
                    dep_share_pct=wrt["dep_share_pct"].quantize(TWO_PLACES),
                    drm_share_pct=wrt["drm_share_pct"].quantize(TWO_PLACES),
                    sync_share_pct=wrt["sync_share_pct"].quantize(TWO_PLACES),
                    phono_share_pct=wrt["phono_share_pct"].quantize(TWO_PLACES),
                    share_percentage=wrt["dep_share_pct"].quantize(TWO_PLACES),
                    society_name=wrt["society_name"],
                    society_de=wrt["society_de"],
                    society_dr=wrt["society_dr"],
                    is_controlled=bool(wrt.get("is_controlled", False)),
                    controlled_by_name=wrt.get("controlled_by_name"),
                )
            )

        if not splits:
            splits = [
                RightHolderSplit(
                    holder_name="Auteur Compositeur Inconnu",
                    role="AC",
                    ipi_number=None,
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    sync_share_pct=Decimal("50.00"),
                    phono_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                    society_name="SACEM",
                ),
                RightHolderSplit(
                    holder_name="Éditeur Principal",
                    role="E",
                    ipi_number=None,
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    sync_share_pct=Decimal("50.00"),
                    phono_share_pct=Decimal("50.00"),
                    share_percentage=Decimal("50.00"),
                    society_name="SACEM",
                ),
            ]

        parsed_works.append(
            {
                "title": w["title"],
                "alternate_titles": w["alternate_titles"],
                "iswc": w["iswc"],
                "cotage_number": w.get("cotage_number"),
                "isrc_codes": w.get("isrc_codes", []),
                "performers": w.get("performers", []),
                "splits": splits,
                "contract_reference": None,
                "counterparty_name": None,
                "initial_advance": Decimal("0.00"),
                "recouped_amount": Decimal("0.00"),
            }
        )

    for raw_line in content.splitlines():
        line = raw_line.rstrip("\r\n")
        if len(line) < 3:
            continue
        rec_type = line[:3].upper()

        if rec_type in ("NWR", "REV"):
            _flush_work(current_work)
            title = line[19:79].strip() if len(line) >= 79 else line[19:].strip()
            submitter_work_num = line[81:95].strip() if len(line) >= 95 else ""
            raw_iswc = line[95:106].strip() if len(line) >= 106 else ""
            formatted_iswc = None
            if len(raw_iswc) == 11 and raw_iswc.startswith("T"):
                formatted_iswc = f"T-{raw_iswc[1:4]}.{raw_iswc[4:7]}.{raw_iswc[7:10]}-{raw_iswc[10]}"

            current_work = {
                "title": title.title() if title.isupper() else title,
                "alternate_titles": [],
                "iswc": formatted_iswc,
                "cotage_number": submitter_work_num or None,
                "isrc_codes": [],
                "performers": [],
                "publishers": {},
                "writers": {},
                "contract_reference": None,
                "counterparty_name": None,
                "initial_advance": Decimal("0.00"),
                "recouped_amount": Decimal("0.00"),
            }

        elif rec_type == "ALT" and current_work is not None:
            alt_title = line[19:79].strip() if len(line) >= 79 else line[19:].strip()
            if alt_title and alt_title not in current_work["alternate_titles"]:
                current_work["alternate_titles"].append(alt_title)

        elif rec_type == "ORN" and current_work is not None:
            orn_title = line[22:].strip() if len(line) >= 22 else line[19:].strip()
            if orn_title and orn_title not in current_work["alternate_titles"]:
                current_work["alternate_titles"].append(orn_title)

        elif rec_type in ("SPU", "OPU") and current_work is not None:
            pub_name = line[30:75].strip() if len(line) >= 75 else line[30:].strip()
            if not pub_name and len(line) >= 28:
                pub_name = line[28:75].strip()
            if not pub_name:
                continue

            ipi_raw = line[87:98].strip() if len(line) >= 98 else ""
            clean_ipi = ipi_raw if (ipi_raw and not re.match(r"^0+$", ipi_raw)) else None

            pr_soc_code = line[112:115].strip() if len(line) >= 115 else ""
            mr_soc_code = line[120:123].strip() if len(line) >= 123 else ""
            soc_de = CISAC_SOCIETY_MAP.get(pr_soc_code, pr_soc_code or "SACEM")
            soc_dr = CISAC_SOCIETY_MAP.get(mr_soc_code, mr_soc_code or soc_de)

            pr_share_str = line[115:120].strip() if len(line) >= 120 else ""
            mr_share_str = line[123:128].strip() if len(line) >= 128 else ""

            pr_pct = (Decimal(pr_share_str) / Decimal("100")).quantize(TWO_PLACES) if pr_share_str.isdigit() else Decimal("0.00")
            mr_pct = (Decimal(mr_share_str) / Decimal("100")).quantize(TWO_PLACES) if mr_share_str.isdigit() else Decimal("0.00")

            norm_name = _clean_cwr_name(pub_name)
            key = pub_name.upper()
            is_ctrl = (rec_type == "SPU")
            if key not in current_work["publishers"]:
                current_work["publishers"][key] = {
                    "holder_name": norm_name,
                    "role": "E",
                    "ipi_number": clean_ipi,
                    "society_name": soc_de,
                    "society_de": soc_de,
                    "society_dr": soc_dr,
                    "dep_share_pct": pr_pct,
                    "drm_share_pct": mr_pct,
                    "sync_share_pct": mr_pct,
                    "phono_share_pct": mr_pct,
                    "is_controlled": is_ctrl,
                    "controlled_by_name": norm_name if is_ctrl else None,
                }
            else:
                current_work["publishers"][key]["dep_share_pct"] += pr_pct
                current_work["publishers"][key]["drm_share_pct"] += mr_pct
                current_work["publishers"][key]["sync_share_pct"] += mr_pct
                current_work["publishers"][key]["phono_share_pct"] += mr_pct
                if not current_work["publishers"][key]["ipi_number"] and clean_ipi:
                    current_work["publishers"][key]["ipi_number"] = clean_ipi
                if is_ctrl:
                    current_work["publishers"][key]["is_controlled"] = True
                    current_work["publishers"][key]["controlled_by_name"] = norm_name

        elif rec_type in ("SWR", "OWR") and current_work is not None:
            writer_id = line[19:28].strip() if len(line) >= 28 else ""
            last_name = line[28:73].strip() if len(line) >= 73 else line[28:].strip()
            first_name = line[73:103].strip() if len(line) >= 103 else ""
            if not last_name and not first_name:
                continue

            cap = line[104:106].strip() if len(line) >= 106 else ""
            role = "AC" if cap == "CA" else (cap if cap in ("C", "A", "AC", "AR", "AD") else "C")

            ipi_raw = line[115:126].strip() if len(line) >= 126 else ""
            clean_ipi = ipi_raw if (ipi_raw and not re.match(r"^0+$", ipi_raw)) else None

            pr_soc_code = line[126:129].strip() if len(line) >= 129 else ""
            mr_soc_code = line[134:137].strip() if len(line) >= 137 else ""
            soc_de = CISAC_SOCIETY_MAP.get(pr_soc_code, pr_soc_code or "SACEM")
            soc_dr = CISAC_SOCIETY_MAP.get(mr_soc_code, mr_soc_code or soc_de)

            pr_share_str = line[129:134].strip() if len(line) >= 134 else ""
            mr_share_str = line[137:142].strip() if len(line) >= 142 else ""

            pr_pct = (Decimal(pr_share_str) / Decimal("100")).quantize(TWO_PLACES) if pr_share_str.isdigit() else Decimal("0.00")
            mr_pct = (Decimal(mr_share_str) / Decimal("100")).quantize(TWO_PLACES) if mr_share_str.isdigit() else Decimal("0.00")

            norm_name = _clean_cwr_name(last_name, first_name)
            key = f"{last_name} {first_name}".strip().upper()
            if key not in current_work["writers"]:
                current_work["writers"][key] = {
                    "writer_id": writer_id,
                    "holder_name": norm_name,
                    "role": role,
                    "ipi_number": clean_ipi,
                    "society_name": soc_de,
                    "society_de": soc_de,
                    "society_dr": soc_dr,
                    "dep_share_pct": pr_pct,
                    "drm_share_pct": mr_pct,
                    "sync_share_pct": mr_pct,
                    "phono_share_pct": mr_pct,
                    "is_controlled": False,
                    "controlled_by_name": None,
                }
            else:
                current_work["writers"][key]["dep_share_pct"] += pr_pct
                current_work["writers"][key]["drm_share_pct"] += mr_pct
                current_work["writers"][key]["sync_share_pct"] += mr_pct
                current_work["writers"][key]["phono_share_pct"] += mr_pct
                if not current_work["writers"][key]["ipi_number"] and clean_ipi:
                    current_work["writers"][key]["ipi_number"] = clean_ipi
                if not current_work["writers"][key].get("writer_id") and writer_id:
                    current_work["writers"][key]["writer_id"] = writer_id
                if {current_work["writers"][key]["role"], role} == {"C", "A"}:
                    current_work["writers"][key]["role"] = "AC"

        elif rec_type == "PWR" and current_work is not None:
            pub_name = line[28:73].strip() if len(line) >= 73 else line[21:73].strip()
            if not pub_name and len(line) >= 21:
                pub_name = line[21:].strip()
            writer_id_raw = line[73:].strip() if len(line) >= 73 else ""
            clean_pub = _clean_cwr_name(pub_name)
            matched = False
            for wrt in current_work["writers"].values():
                if writer_id_raw and wrt.get("writer_id") and wrt["writer_id"] == writer_id_raw:
                    wrt["is_controlled"] = True
                    wrt["controlled_by_name"] = clean_pub
                    matched = True
            if not matched and clean_pub and current_work["writers"]:
                for wrt in current_work["writers"].values():
                    if not wrt.get("controlled_by_name"):
                        wrt["is_controlled"] = True
                        wrt["controlled_by_name"] = clean_pub
                        break

    _flush_work(current_work)
    return parsed_works


def _parse_csv_migration_file(content: str) -> list[dict[str, Any]]:
    """Parse un fichier CSV d'export Le Sage (Improvize) ou Music Maestro (Vistex)."""
    first_line = content.splitlines()[0] if content.splitlines() else ""
    delimiter = ";" if ";" in first_line else ","
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    parsed_works: list[dict[str, Any]] = []

    for row in reader:
        title = (
            row.get("work_title")
            or row.get("titre")
            or row.get("title")
            or ""
        ).strip()
        if not title:
            continue
        alt_raw = row.get("alternate_titles") or row.get("alias") or row.get("sous_titre") or row.get("subtitles") or ""
        alternate_titles = [a.strip() for a in re.split(r"[|;]", alt_raw) if a.strip()]
        iswc = (row.get("iswc") or row.get("code_iswc") or "").strip() or None
        isrc_raw = (row.get("isrc") or row.get("code_isrc") or "").strip()
        isrc_codes = [c.strip() for c in isrc_raw.split("|") if c.strip()]
        perf_raw = (row.get("performers") or row.get("interpretes") or "").strip()
        performers = [p.strip() for p in perf_raw.split("|") if p.strip()]

        splits = _parse_holders_splits_string(row.get("holders_splits") or "")
        if not splits:
            splits = [
                RightHolderSplit(
                    holder_name=performers[0] if performers else "Auteur-Compositeur",
                    role="AC",
                    ipi_number="00458912301",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    sync_share_pct=Decimal("50.00"),
                    phono_share_pct=Decimal("20.00"),
                    share_percentage=Decimal("50.00"),
                ),
                RightHolderSplit(
                    holder_name="Éditions Solstices Music",
                    role="E",
                    ipi_number="00891234567",
                    dep_share_pct=Decimal("50.00"),
                    drm_share_pct=Decimal("50.00"),
                    sync_share_pct=Decimal("50.00"),
                    phono_share_pct=Decimal("80.00"),
                    share_percentage=Decimal("50.00"),
                ),
            ]

        parsed_works.append(
            {
                "title": title,
                "alternate_titles": alternate_titles,
                "iswc": iswc,
                "isrc_codes": isrc_codes,
                "performers": performers,
                "splits": splits,
                "contract_reference": (row.get("contract_reference") or "").strip() or None,
                "counterparty_name": (row.get("counterparty_name") or "").strip() or None,
                "initial_advance": _safe_dec(row.get("initial_advance"), "0.00"),
                "recouped_amount": _safe_dec(row.get("recouped_amount"), "0.00"),
            }
        )
    return parsed_works


def run_catalog_migration(
    session: Session,
    content: str,
    source_filename: str,
    source_system: str = "SACEM_CSV",
    dry_run: bool = True,
    max_publisher_dep_pct: Decimal = Decimal("50.00"),
    operator_email: str = "royalty.manager@solstices-music.fr",
    publisher_name: str = "Éditions Solstices Music",
) -> CatalogMigrationReport:
    """
    Exécute soit le Sas de Pré-Validation (dry_run=True, aucune écriture en base),
    soit la Migration Atomique (dry_run=False) avec dédoublonnage ISWC / Code œuvre SACEM,
    synchronisation automatique du Répertoire des Ayants Droit (RightHolderDirectory),
    contrôle Decimal des avances et vectorisation Fastembed.
    """
    sha256_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

    clean = content.lstrip("\ufeff")
    is_cwr = (
        source_filename.upper().endswith((".V21", ".V22", ".CWR"))
        or source_system in ("CWR_V21", "CWR")
        or clean.startswith(("HDR", "GRH", "NWR"))
    )

    if is_cwr:
        source_system = "CWR_V21"
        raw_items = _parse_cwr_v21_file(content)
    elif _is_sacem_portal_csv(clean, source_system):
        source_system = "SACEM_CSV"
        raw_items = _parse_sacem_portal_csv(content)
    else:
        raw_items = _parse_csv_migration_file(content)

    existing_works = list(session.exec(select(Work)).all())
    existing_by_iswc = {w.iswc: w for w in existing_works if w.iswc}
    existing_by_sacem_code = {w.sacem_work_code: w for w in existing_works if w.sacem_work_code}

    # Collecte de tous les ayants droit uniques découverts dans le fichier
    discovered_holders: dict[str, dict[str, Any]] = {}
    for item in raw_items:
        meta_list = item.get("holders_metadata") or [
            {
                "holder_name": s.holder_name,
                "role": str(s.role.value if hasattr(s.role, "value") else s.role),
                "ipi_number": s.ipi_number,
                "coad": None,
                "society_de": getattr(s, "society_de", None) or getattr(s, "society_name", None) or "SACEM",
                "society_dr": getattr(s, "society_dr", None) or getattr(s, "society_name", None) or "SACEM",
            }
            for s in item["splits"]
        ]
        for hm in meta_list:
            h_key = (hm.get("ipi_number") or hm.get("holder_name", "").upper()).strip()
            if not h_key:
                continue
            if h_key not in discovered_holders:
                discovered_holders[h_key] = dict(hm)
            else:
                if hm.get("coad") and not discovered_holders[h_key].get("coad"):
                    discovered_holders[h_key]["coad"] = hm["coad"]

    holders_by_key: dict[str, RightHolderDirectory] = {}
    if not dry_run and discovered_holders:
        now_holder = datetime.now(timezone.utc)
        existing_holders = list(session.exec(select(RightHolderDirectory)).all())
        by_ipi = {}
        by_name = {}
        for eh in existing_holders:
            if eh.ipi_number:
                by_ipi[eh.ipi_number.strip()] = eh
                if eh.ipi_number.strip().isdigit():
                    by_ipi[eh.ipi_number.strip().zfill(11)] = eh
            if eh.full_name:
                by_name[eh.full_name.strip().upper()] = eh

        company_keywords = (
            "MUSIC",
            "AGENCY",
            "PUBLISHING",
            "EDITION",
            "ÉDITION",
            "RECORDS",
            "PROD",
            "SAS",
            "SARL",
            "STUDIO",
        )
        for h_key, hm in discovered_holders.items():
            h_name = (hm.get("holder_name") or "Ayant Droit").strip()
            h_ipi = (hm.get("ipi_number") or "").strip() or None
            h_coad = (hm.get("coad") or "").strip() or None
            h_role = (hm.get("role") or "AC").strip()
            h_soc_de = (hm.get("society_de") or "SACEM").strip()
            h_soc_dr = (hm.get("society_dr") or h_soc_de).strip()

            is_company = h_role in ("E", "SE", "PUBLISHER", "SUB_PUBLISHER", "P") or any(
                kw in h_name.upper() for kw in company_keywords
            )

            existing_h = (by_ipi.get(h_ipi) if h_ipi else None) or by_name.get(h_name.upper())
            if existing_h:
                if h_ipi and not existing_h.ipi_number:
                    existing_h.ipi_number = h_ipi
                if h_coad and not existing_h.coad_or_isni:
                    existing_h.coad_or_isni = h_coad
                if h_soc_de:
                    existing_h.society_de = h_soc_de
                    existing_h.affiliated_society = h_soc_de
                if h_soc_dr:
                    existing_h.society_dr = h_soc_dr
                existing_h.updated_at = now_holder
                session.add(existing_h)
                holders_by_key[h_key] = existing_h
            else:
                new_h = RightHolderDirectory(
                    full_name=h_name,
                    entity_type="SOCIETE" if is_company else "PERSONNE_PHYSIQUE",
                    legal_form="SAS / Société d'Édition" if is_company else "Artiste-Auteur (BNC)",
                    primary_role=h_role,
                    ipi_number=h_ipi,
                    coad_or_isni=h_coad,
                    affiliated_society=h_soc_de,
                    society_de=h_soc_de,
                    society_dr=h_soc_dr,
                    vat_applicable=is_company,
                    vat_rate_pct=Decimal("10.00"),
                    ircec_precompte_applicable=not is_company,
                    notes=f"Importé depuis {source_system} ({source_filename})",
                    created_at=now_holder,
                    updated_at=now_holder,
                )
                session.add(new_h)
                holders_by_key[h_key] = new_h
                if h_ipi:
                    by_ipi[h_ipi] = new_h
                by_name[h_name.upper()] = new_h
        session.flush()

    previews: list[MigratedWorkPreview] = []
    migrated_work_reads: list[WorkRead] = []

    new_count = 0
    upsert_count = 0
    ready_count = 0
    conflict_count = 0
    contracts_count = 0

    total_init_adv = Decimal("0.00")
    total_rec_adv = Decimal("0.00")
    total_rem_adv = Decimal("0.00")

    now = datetime.now(timezone.utc)

    for item in raw_items:
        splits: list[RightHolderSplit] = item["splits"]
        if not dry_run and holders_by_key:
            for s in splits:
                s_key = (s.ipi_number or s.holder_name.upper()).strip()
                if s_key in holders_by_key:
                    s.right_holder_id = holders_by_key[s_key].id

        cwr_report: CWRValidationReport = validate_work_cwr(
            work_title=item["title"],
            splits=splits,
            iswc=item["iswc"],
            max_publisher_dep_pct=max_publisher_dep_pct,
        )
        if cwr_report.is_cwr_ready:
            ready_count += 1
        else:
            conflict_count += 1

        sacem_code = item.get("sacem_work_code")
        existing_work_match = (
            (existing_by_sacem_code.get(sacem_code) if sacem_code else None)
            or (existing_by_iswc.get(item["iswc"]) if item.get("iswc") else None)
        )
        is_existing = existing_work_match is not None
        if is_existing:
            upsert_count += 1
            action_label = "UPSERT_ISWC"
        else:
            new_count += 1
            action_label = "NEW"

        init_adv: Decimal = item["initial_advance"]
        rec_adv: Decimal = item["recouped_amount"]
        rem_adv: Decimal = max(Decimal("0.00"), (init_adv - rec_adv).quantize(TWO_PLACES))

        if item.get("contract_reference"):
            contracts_count += 1
            total_init_adv = (total_init_adv + init_adv).quantize(TWO_PLACES)
            total_rec_adv = (total_rec_adv + rec_adv).quantize(TWO_PLACES)
            total_rem_adv = (total_rem_adv + rem_adv).quantize(TWO_PLACES)

        sync_sum = sum(
            (Decimal(str(s.sync_share_pct if s.sync_share_pct is not None else s.drm_share_pct)) for s in splits),
            Decimal("0.00"),
        ).quantize(TWO_PLACES)
        phono_sum = sum(
            (Decimal(str(s.phono_share_pct if s.phono_share_pct is not None else s.drm_share_pct)) for s in splits),
            Decimal("0.00"),
        ).quantize(TWO_PLACES)

        previews.append(
            MigratedWorkPreview(
                title=item["title"],
                subtitle=item.get("subtitle"),
                alternate_titles=item["alternate_titles"],
                iswc=item["iswc"],
                sacem_work_code=sacem_code,
                genre=item.get("genre"),
                isrc_codes=item["isrc_codes"],
                performers=item["performers"],
                migration_action=action_label,
                holders_count=len(splits),
                dep_total_pct=f"{cwr_report.dep_total_pct:.2f}",
                drm_total_pct=f"{cwr_report.drm_total_pct:.2f}",
                sync_total_pct=f"{sync_sum:.2f}",
                phono_total_pct=f"{phono_sum:.2f}",
                is_cwr_ready=cwr_report.is_cwr_ready,
                blocking_errors=cwr_report.blocking_errors,
                contract_reference=item.get("contract_reference"),
                initial_advance_eur=f"{init_adv:.2f}",
                recouped_advance_eur=f"{rec_adv:.2f}",
                remaining_advance_eur=f"{rem_adv:.2f}",
            )
        )

        if not dry_run:
            corpus = " ".join([item["title"], *item["alternate_titles"], *item["performers"]])
            embedding = compute_text_embedding(corpus)
            serialized_splits = [s.model_dump(mode="json") for s in splits]

            if existing_work_match is not None:
                work_obj = existing_work_match
                work_obj.title = item["title"]
                if item.get("subtitle") is not None:
                    work_obj.subtitle = item.get("subtitle")
                work_obj.alternate_titles = item["alternate_titles"]
                if item.get("iswc"):
                    work_obj.iswc = item["iswc"]
                if sacem_code:
                    work_obj.sacem_work_code = sacem_code
                if item.get("genre"):
                    work_obj.genre = item.get("genre")
                if item.get("cotage_number"):
                    work_obj.cotage_number = item["cotage_number"]
                if item.get("creation_year"):
                    work_obj.creation_year = item.get("creation_year")
                if item.get("general_notes"):
                    work_obj.general_notes = item.get("general_notes")
                work_obj.isrc_codes = item["isrc_codes"]
                work_obj.performers = item["performers"]
                work_obj.splits = serialized_splits
                work_obj.embedding = embedding
                work_obj.updated_at = now
                session.add(work_obj)
            else:
                work_obj = Work(
                    title=item["title"],
                    subtitle=item.get("subtitle"),
                    alternate_titles=item["alternate_titles"],
                    iswc=item["iswc"],
                    sacem_work_code=sacem_code,
                    cotage_number=item.get("cotage_number"),
                    genre=item.get("genre"),
                    creation_year=item.get("creation_year"),
                    general_notes=item.get("general_notes"),
                    isrc_codes=item["isrc_codes"],
                    performers=item["performers"],
                    splits=serialized_splits,
                    embedding=embedding,
                    created_at=now,
                    updated_at=now,
                )
                session.add(work_obj)
                if sacem_code:
                    existing_by_sacem_code[sacem_code] = work_obj
                if item.get("iswc"):
                    existing_by_iswc[item["iswc"]] = work_obj

            if item.get("contract_reference"):
                existing_ctr = session.exec(
                    select(Contract).where(
                        Contract.contract_reference == item["contract_reference"]
                    )
                ).first()
                counterparty = item.get("counterparty_name") or (
                    splits[0].holder_name if splits else "Ayant Droit"
                )
                if not existing_ctr:
                    ctr = Contract(
                        contract_reference=item["contract_reference"],
                        contract_type="CESSION_EDITION",
                        publisher_name=publisher_name,
                        counterparty_name=counterparty,
                        territory="WORLD",
                        duration_years=10,
                        advance_amount=init_adv,
                        recouped_amount=rec_adv,
                        currency="EUR",
                        work_titles=[item["title"]],
                        parties=[
                            {
                                "party_name": s.holder_name,
                                "role": s.role,
                                "ipi_number": s.ipi_number,
                                "dep_share_pct": str(s.dep_share_pct),
                                "drm_share_pct": str(s.drm_share_pct),
                                "source_clause_quote": f"Migré depuis {source_system} ({source_filename})",
                            }
                            for s in splits
                        ],
                        advance={
                            "has_advance": init_adv > Decimal("0.00"),
                            "advance_amount": f"{init_adv:.2f}",
                            "beneficiary_name": counterparty,
                            "recoupable_streams": ["STREAMING", "PUBLIC_PERFORMANCE", "SYNCHRONIZATION"],
                            "source_clause_quote": f"Solde d'avance repris de {source_system} : {rem_adv:.2f} € restants sur {init_adv:.2f} €.",
                        },
                        source_filename=source_filename,
                        extracted_clauses_summary=(
                            f"Contrat migré depuis {source_system} ({source_filename}). "
                            f"Avance initiale : {init_adv:.2f} € | Déjà amorti : {rec_adv:.2f} € | Solde à recouvrer : {rem_adv:.2f} €."
                        ),
                        cwr_split_warnings=cwr_report.blocking_errors,
                        confidence_score=1.0 if cwr_report.is_cwr_ready else 0.78,
                        validation_status=(
                            ValidationStatus.VALIDATED.value
                            if cwr_report.is_cwr_ready
                            else ValidationStatus.PENDING_REVIEW.value
                        ),
                        validated_by=operator_email if cwr_report.is_cwr_ready else None,
                        validated_at=now if cwr_report.is_cwr_ready else None,
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(ctr)
                    session.flush()
                    if init_adv > Decimal("0.00"):
                        holder_ipi = splits[0].ipi_number if splits else None
                        ledger = AdvanceLedger(
                            contract_id=ctr.id,
                            contract_reference=ctr.contract_reference,
                            holder_name=counterparty,
                            ipi_number=holder_ipi,
                            initial_advance=init_adv,
                            recouped_amount=rec_adv,
                            updated_at=now,
                        )
                        session.add(ledger)

            migrated_work_reads.append(
                WorkRead(
                    id=work_obj.id,
                    title=work_obj.title,
                    subtitle=work_obj.subtitle,
                    alternate_titles=work_obj.alternate_titles or [],
                    iswc=work_obj.iswc,
                    sacem_work_code=work_obj.sacem_work_code,
                    genre=work_obj.genre,
                    creation_year=work_obj.creation_year,
                    general_notes=work_obj.general_notes,
                    isrc_codes=work_obj.isrc_codes or [],
                    performers=work_obj.performers or [],
                    splits=splits,
                    cwr_validation=cwr_report,
                    created_at=work_obj.created_at,
                    updated_at=work_obj.updated_at,
                )
            )

    if not dry_run:
        session.add(
            AuditLog(
                action_type="CATALOG_MIGRATION_COMPLETED",
                entity_type="CATALOG_MIGRATION",
                entity_id=f"MIG-{sha256_hash[:8].upper()}",
                actor=operator_email,
                summary=(
                    f"Migration sécurisée depuis {source_system} ({source_filename}) : "
                    f"{len(raw_items)} œuvres traitées ({new_count} créées, {upsert_count} mises à jour), "
                    f"{len(discovered_holders)} ayants droit synchronisés, "
                    f"solde d'avances repris = {total_rem_adv:.2f} € (hash SHA-256 {sha256_hash})."
                ),
                details={
                    "source_system": source_system,
                    "source_filename": source_filename,
                    "sha256_integrity_hash": sha256_hash,
                    "total_works_parsed": len(raw_items),
                    "holders_synced_count": len(discovered_holders),
                    "total_remaining_advances_eur": f"{total_rem_adv:.2f}",
                },
                created_at=now,
            )
        )
        session.commit()

    return CatalogMigrationReport(
        dry_run=dry_run,
        source_system=source_system,
        source_filename=source_filename,
        sha256_integrity_hash=sha256_hash,
        total_works_parsed=len(raw_items),
        new_works_count=new_count,
        upserted_existing_iswc_count=upsert_count,
        cwr_ready_works_count=ready_count,
        cwr_conflict_works_count=conflict_count,
        contracts_migrated_count=contracts_count,
        holders_synced_count=len(discovered_holders),
        total_initial_advances_eur=f"{total_init_adv:.2f}",
        total_recouped_advances_eur=f"{total_rec_adv:.2f}",
        total_remaining_advances_eur=f"{total_rem_adv:.2f}",
        items=previews,
        migrated_works=migrated_work_reads,
    )
