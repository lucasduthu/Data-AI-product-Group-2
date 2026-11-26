import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def _parse_sacem_date(raw: str) -> date | None:
    raw = (raw or "").strip()
    if not raw or raw == "00000000" or len(raw) != 8:
        return None
    try:
        return datetime.strptime(raw, "%Y%m%d").date()
    except Exception:
        return None


def parse_cgp1_fixed_width(content: str) -> list[dict[str, Any]]:
    """
    Parseur déterministe pour le format officiel SACEM « CGP1 Détail ».
    Lit les enregistrements de type 30 (en-tête contrat), 31 (droits & territoires) et 40 (commentaires).
    """
    lines = [line.rstrip("\r\n") for line in content.splitlines() if line.strip()]
    contracts: list[dict[str, Any]] = []
    current_contract: dict[str, Any] | None = None

    for line in lines:
        if line.startswith("0000000000000000") or line.startswith("9999999999999999"):
            # En-tête ou pied de fichier SACEM
            continue

        # Détection du code d'enregistrement : positions 8-10 (ex: "0000000130000001" -> "30")
        record_type = None
        if len(line) >= 10:
            rec_chunk = line[8:10]
            if rec_chunk in ("30", "31", "40"):
                record_type = rec_chunk

        if not record_type:
            # Fallback regex si décalage
            if re.search(r"^\d{8}30\d{6}", line):
                record_type = "30"
            elif re.search(r"^\d{8}31\d{6}", line):
                record_type = "31"
            elif re.search(r"^\d{8}40\d{6}", line):
                record_type = "40"

        if record_type == "30":
            if current_contract:
                contracts.append(current_contract)

            # Record 30 : Décomposition de la ligne
            # Exemple : 0000000130000001 000053065 00293192352 002681650522002120400000000 SHUT UP AND LISTEN MUSIC 072072072 BCORE DISC S L 072072072 G2002120400000005 000053065
            after_prefix = line[16:].strip()
            tokens = after_prefix.split()

            sacem_num = tokens[0].lstrip("0") or tokens[0] if len(tokens) > 0 else "INCONNU"
            assignor_ipi = tokens[1] if len(tokens) > 1 and tokens[1].isdigit() else None
            
            # Dans certains fichiers, l'IPI cessionnaire et la date sont accolés : "002681650522002120400000000"
            assignee_ipi = None
            start_dt = None
            end_dt = None

            if len(tokens) > 2:
                t2 = tokens[2]
                if len(t2) >= 27 and t2.isdigit():
                    assignee_ipi = t2[:11]
                    start_dt = _parse_sacem_date(t2[11:19])
                    end_dt = _parse_sacem_date(t2[19:27])
                elif t2.isdigit() and len(t2) == 11:
                    assignee_ipi = t2
                    if len(tokens) > 3 and len(tokens[3]) == 8 and tokens[3].isdigit():
                        start_dt = _parse_sacem_date(tokens[3])

            # Extraction des noms Cédant et Cessionnaire
            # Le reste de la ligne contient : Nom Cédant, code société, Nom Cessionnaire, etc.
            # Recherche de la référence CWR éventuelle (ex: G20021204... ou OG... ou PG...)
            cwr_match = re.search(r"\b([GOP][SGA]?\d{8,16})\b", after_prefix)
            cwr_type = "SOUS_EDITION_GENERALE"
            if cwr_match:
                cwr_code = cwr_match.group(1)
                if cwr_code.startswith("O"):
                    cwr_type = "ORIGINAL_GENERAL"
                elif cwr_code.startswith("P") or cwr_code.startswith("G"):
                    cwr_type = "SOUS_EDITION_GENERALE"

            # Recherche des noms par segments textuels
            names_text = re.sub(r"^\d+\s+\d+\s+[\d\s]+", "", after_prefix)
            names_text = re.sub(r"[GOP][SGA]?\d{8,16}.*$", "", names_text).strip()
            # Séparateurs de codes société à 9 chiffres (ex: 072072072 ou 058058058)
            parts_split = re.split(r"\s+\d{9}\s+", names_text)
            
            assignor_name = "Cédant Inconnu"
            assignee_name = "Éditions Solstices Music"
            if len(parts_split) >= 2:
                assignor_name = parts_split[0].strip()
                assignee_name = parts_split[1].strip()
            elif len(parts_split) == 1 and parts_split[0]:
                assignor_name = parts_split[0].strip()

            current_contract = {
                "contract_reference": f"CTR-SACEM-{sacem_num}",
                "sacem_contract_number": sacem_num,
                "contract_type": cwr_type,
                "publisher_name": assignee_name,
                "counterparty_name": assignor_name,
                "signature_date": start_dt,
                "start_date": start_dt,
                "end_date": end_dt,
                "territory": "WORLD",
                "assignor_ipi": assignor_ipi,
                "assignee_ipi": assignee_ipi,
                "parties": [
                    {
                        "party_name": assignor_name,
                        "role": "E",
                        "ipi_number": assignor_ipi,
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                        "source_clause_quote": "Cédant au contrat général SACEM",
                    },
                    {
                        "party_name": assignee_name,
                        "role": "SE",
                        "ipi_number": assignee_ipi,
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                        "source_clause_quote": "Cessionnaire au contrat général SACEM",
                    },
                ],
                "comments": "",
                "extracted_clauses_summary": f"Contrat Général SACEM n° {sacem_num} entre {assignor_name} et {assignee_name}.",
                "cwr_split_warnings": [],
                "confidence_score": 1.0,
            }

        elif record_type == "31" and current_contract:
            # Record 31 : Territoire et quote-part de droits
            # Exemple : 0000000231000001 + PR * WLMONDE ENTIER 001 VOOOALLALL0250000 NO N
            # Exemple : 0000000331000001 + MR * WLMONDE ENTIER 001 VOOOALLALL0500000 NO N
            right_type = None
            if " PR " in line:
                right_type = "DEP"
            elif " MR " in line:
                right_type = "DRM"

            pct = Decimal("50.00")
            pct_match = re.search(r"ALLALL0(\d{2})(\d{4})", line)
            if pct_match:
                pct = Decimal(f"{pct_match.group(1)}.{pct_match.group(2)[:2]}")

            if "MONDE ENTIER" in line or " WL" in line:
                current_contract["territory"] = "MONDE ENTIER"
            elif "FRANCE" in line:
                current_contract["territory"] = "FRANCE"

            # Mise à jour des parts dans parties
            if right_type == "DEP":
                current_contract["parties"][1]["dep_share_pct"] = str(pct)
                current_contract["parties"][0]["dep_share_pct"] = str(Decimal("100.00") - pct)
            elif right_type == "DRM":
                current_contract["parties"][1]["drm_share_pct"] = str(pct)
                current_contract["parties"][0]["drm_share_pct"] = str(Decimal("100.00") - pct)

        elif record_type == "40" and current_contract:
            # Record 40 : Commentaire officiel SACEM
            comment_text = line[16:].strip()
            # Nettoyage prefixe "COM"
            if comment_text.startswith("COM"):
                comment_text = comment_text[3:].strip()
            current_contract["comments"] = comment_text
            if "CO EDITION" in comment_text.upper():
                current_contract["contract_type"] = "CO_EDITION"
            current_contract["extracted_clauses_summary"] = (
                f"Contrat Général SACEM n° {current_contract['sacem_contract_number']} : {comment_text}"
            )

    if current_contract:
        contracts.append(current_contract)

    return contracts


def parse_contracts_csv(content: str) -> list[dict[str, Any]]:
    """
    Parseur déterministe pour listes de contrats exportées au format CSV ou tableur.
    Détecte automatiquement le délimiteur (;, ,, \t) et mappe les colonnes usuelles.
    """
    sample = content[:4096]
    delimiter = ";"
    if sample.count("\t") > sample.count(";") and sample.count("\t") > sample.count(","):
        delimiter = "\t"
    elif sample.count(",") > sample.count(";"):
        delimiter = ","

    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    contracts: list[dict[str, Any]] = []

    for row in reader:
        # Nettoyage des clés de colonnes en minuscules sans accents
        clean_row = {}
        for k, v in row.items():
            if k:
                norm_k = re.sub(r"[^a-z0-9]", "_", k.strip().lower())
                clean_row[norm_k] = (v or "").strip()

        # Recherche de référence ou numéro de contrat
        ref = (
            clean_row.get("numero_contrat")
            or clean_row.get("reference")
            or clean_row.get("reference_contrat")
            or clean_row.get("code_contrat")
            or clean_row.get("contract_reference")
            or clean_row.get("n_contrat")
        )
        if not ref:
            continue

        sacem_num = clean_row.get("code_sacem") or clean_row.get("sacem_contract_number") or ref
        contract_type = clean_row.get("type_contrat") or clean_row.get("contract_type") or "CESSION_EDITION"
        counterparty = (
            clean_row.get("cedant")
            or clean_row.get("cocontractant")
            or clean_row.get("auteur")
            or clean_row.get("ayant_droit")
            or clean_row.get("counterparty_name")
            or "Cédant"
        )
        publisher = (
            clean_row.get("cessionnaire")
            or clean_row.get("editeur")
            or clean_row.get("publisher_name")
            or "Éditions Solstices Music"
        )
        assignor_ipi = clean_row.get("ipi_cedant") or clean_row.get("ipi_auteur") or clean_row.get("ipi_counterparty")
        assignee_ipi = clean_row.get("ipi_cessionnaire") or clean_row.get("ipi_editeur") or clean_row.get("publisher_ipi")

        start_raw = clean_row.get("date_debut") or clean_row.get("date_signature") or clean_row.get("start_date")
        end_raw = clean_row.get("date_fin") or clean_row.get("end_date") or clean_row.get("date_echeance")

        start_dt = None
        if start_raw:
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y%m%d"):
                try:
                    start_dt = datetime.strptime(start_raw, fmt).date()
                    break
                except Exception:
                    pass

        end_dt = None
        if end_raw:
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y%m%d"):
                try:
                    end_dt = datetime.strptime(end_raw, fmt).date()
                    break
                except Exception:
                    pass

        territory = clean_row.get("territoire") or clean_row.get("territory") or "WORLD"
        comment = clean_row.get("commentaire") or clean_row.get("notes") or clean_row.get("description") or ""

        dep_str = clean_row.get("part_dep") or clean_row.get("dep_share_pct") or "50.00"
        drm_str = clean_row.get("part_drm") or clean_row.get("drm_share_pct") or "50.00"

        try:
            dep_pct = Decimal(dep_str.replace(",", "."))
        except Exception:
            dep_pct = Decimal("50.00")

        try:
            drm_pct = Decimal(drm_str.replace(",", "."))
        except Exception:
            drm_pct = Decimal("50.00")

        contracts.append(
            {
                "contract_reference": ref if ref.startswith("CTR") else f"CTR-{ref}",
                "sacem_contract_number": sacem_num,
                "contract_type": contract_type.upper(),
                "publisher_name": publisher,
                "counterparty_name": counterparty,
                "signature_date": start_dt,
                "start_date": start_dt,
                "end_date": end_dt,
                "territory": territory.upper(),
                "assignor_ipi": assignor_ipi,
                "assignee_ipi": assignee_ipi,
                "parties": [
                    {
                        "party_name": counterparty,
                        "role": "E",
                        "ipi_number": assignor_ipi,
                        "dep_share_pct": str(Decimal("100.00") - dep_pct),
                        "drm_share_pct": str(Decimal("100.00") - drm_pct),
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                        "source_clause_quote": f"Cédant au contrat {ref}",
                    },
                    {
                        "party_name": publisher,
                        "role": "SE",
                        "ipi_number": assignee_ipi,
                        "dep_share_pct": str(dep_pct),
                        "drm_share_pct": str(drm_pct),
                        "sync_share_pct": "50.00",
                        "phono_share_pct": "50.00",
                        "source_clause_quote": f"Cessionnaire au contrat {ref}",
                    },
                ],
                "comments": comment,
                "extracted_clauses_summary": comment or f"Contrat {ref} entre {counterparty} et {publisher}.",
                "cwr_split_warnings": [],
                "confidence_score": 1.0,
            }
        )

    return contracts


def parse_cgp1_or_csv_contracts(content: str, filename: str = "") -> tuple[str, list[dict[str, Any]]]:
    """
    Point d'entrée universel :
    Détecte automatiquement si le contenu est un fichier SACEM CGP1 ou un fichier CSV.
    Retourne le format détecté ('SACEM_CGP1' ou 'CONTRACTS_CSV') et la liste des contrats extraits.
    """
    clean_sample = content[:2000].strip()
    if "CGP1SACEM" in clean_sample or re.search(r"^\d{8}30\d{6}", clean_sample, re.MULTILINE):
        format_detected = "SACEM_CGP1"
        contracts = parse_cgp1_fixed_width(content)
    else:
        format_detected = "CONTRACTS_CSV"
        contracts = parse_contracts_csv(content)

    return format_detected, contracts
