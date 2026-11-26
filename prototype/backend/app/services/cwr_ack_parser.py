"""Service d'ingestion et d'analyse des accusés de réception CWR ACK / NACK SACEM.

Conforme aux spécifications CISAC CWR v2.1 / v2.2 (Acknowledgement Transaction Record 'ACK'
et Exception Record 'EXC') et aux rapports tabulaires de dépôt de l'extranet SACEM.
"""

from datetime import datetime, timezone
import re
import unicodedata
from typing import Any
from uuid import UUID

from sqlmodel import Session, select

from app.models.work import Work
from app.schemas.work import CwrAckItem, CwrAckReport

# Dictionnaire de référence des codes d'erreurs et rejets CISAC CWR
CISAC_ERROR_CODES: dict[str, str] = {
    "101": "Caractère invalide dans le titre de l'œuvre",
    "102": "Titre de l'œuvre manquant ou non conforme",
    "104": "Code ISWC invalide ou clé de contrôle incorrecte",
    "105": "Titre déjà déposé avec des ayants droit différents",
    "201": "Code IPI créateur (A/C) manquant, invalide ou non affilié",
    "202": "Auteur/Compositeur inconnu ou non membre de la société",
    "203": "Code IPI éditeur (E) manquant ou invalide",
    "204": "Incohérence de société de gestion DE/DR pour l'éditeur",
    "301": "Déséquilibre des quotes-parts : somme != 100.00 %",
    "302": "Part éditeur supérieure au plafond statutaire de 50.00 %",
    "303": "Discordance entre part d'exécution (DEP) et de reproduction (DRM)",
    "401": "Œuvre doublon déjà enregistrée à la SACEM",
    "501": "Référence de contrat d'édition générale ou sous-édition invalide",
}


def _normalize_title(val: str | None) -> str:
    """Normalise un titre pour comparaison insensible aux accents, ponctuation et casse."""
    if not val:
        return ""
    # Retirer les accents
    nfkd = unicodedata.normalize("NFKD", val.strip().upper())
    cleaned = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Ne garder que lettres et chiffres
    return re.sub(r"[^A-Z0-9]", "", cleaned)


def _clean_str(val: str | None) -> str | None:
    if not val:
        return None
    s = val.strip()
    return s if s else None


def _clean_iswc(val: str | None) -> str | None:
    if not val:
        return None
    cleaned = re.sub(r"[\s\-\.]", "", val).upper()
    return cleaned if cleaned else None


def parse_cisac_cwr_ack_text(content: str) -> list[dict[str, Any]]:
    """Parse un fichier texte au format fixe CISAC CWR v2.1 ACK.
    
    Structure CISAC standard :
    - Ligne ACK :
      ACK + 8 car (trans_seq) + 8 car (rec_seq) + 8 car (orig_group) + 8 car (orig_trans_seq)
      + 3 car (orig_rec_type, ex: NWR) + 2 car (trans_status: RA, AS, RE, DU, NP)
      + 8 car (date) + champs de travail (work title, submitter work #, recipient work #/COCV)
    - Ligne EXC (optionnelle sous ACK si rejet ou avertissement) :
      EXC + 8 car + 8 car + 3 car (error_code) + 1 car (severity) + texte d'erreur
    """
    lines = content.splitlines()
    parsed_transactions: list[dict[str, Any]] = []
    current_tx: dict[str, Any] | None = None

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line:
            continue

        rec_type = line[:3].upper()

        if rec_type == "ACK":
            if current_tx:
                parsed_transactions.append(current_tx)

            # Lecture des positions CISAC CWR 2.1
            trans_seq_str = line[3:11].strip()
            trans_seq = int(trans_seq_str) if trans_seq_str.isdigit() else len(parsed_transactions) + 1
            orig_trans_seq_str = line[27:35].strip() if len(line) >= 35 else ""
            orig_trans_seq = int(orig_trans_seq_str) if orig_trans_seq_str.isdigit() else None
            status_code = line[38:40].strip().upper() if len(line) >= 40 else "RA"
            
            # Découpage robuste de la ligne ACK
            # Norme CISAC :
            # 0:3 ACK, 3:11 trans_seq, 11:19 rec_seq, 19:27 orig_group, 27:35 orig_trans_seq,
            # 35:38 orig_rec_type, 38:40 trans_status, 40:48 proc_date, 48:56 proc_time...
            recipient_work_number = None
            iswc = None
            work_title = ""

            rest = line[40:] if len(line) > 40 else ""

            # Extraction par regex tolérante
            # 1. COCV SACEM (10-12 chiffres consécutifs)
            cocv_match = re.search(r"\b(\d{10,12})\b", rest)
            if cocv_match:
                recipient_work_number = cocv_match.group(1)

            # 2. ISWC : commence par T et contient 9 à 11 chiffres/tirets
            iswc_match = re.search(r"(T[-\s\.]?[0-9A-Z]{9,11}[-\s\.]?[0-9A-Z]?)", rest)
            if iswc_match:
                iswc = iswc_match.group(1).strip()

            # 3. Titre de l'œuvre : retirer les dates, codes ISWC et COCV de rest pour isoler le titre
            cleaned_rest = rest
            if recipient_work_number:
                cleaned_rest = cleaned_rest.replace(recipient_work_number, " ")
            if iswc:
                cleaned_rest = cleaned_rest.replace(iswc, " ")
            # Retirer les timestamps YYYYMMDD ou HHMMSS au début
            cleaned_rest = re.sub(r"^\s*\d{6,16}\s*", " ", cleaned_rest)

            # Isoler la plus longue chaîne textuelle alphabétique restante
            title_tokens = [tok.strip() for tok in cleaned_rest.split("  ") if tok.strip()]
            for tok in title_tokens:
                if len(tok) >= 3 and re.search(r"[A-Z]{2,}", tok):
                    work_title = tok
                    break
            if not work_title and title_tokens:
                work_title = title_tokens[0]

            current_tx = {
                "transaction_number": trans_seq,
                "orig_trans_seq": orig_trans_seq,
                "status_code": status_code,
                "is_accepted": status_code in ("RA", "AS", "AC"),
                "recipient_work_number": recipient_work_number,
                "iswc": iswc,
                "work_title": work_title,
                "raw_text": line,
                "exceptions": [],
            }

        elif rec_type == "EXC" and current_tx is not None:
            # Enregistrement d'exception rattaché à l'ACK précédent
            err_code = line[19:22].strip() if len(line) >= 22 else ""
            err_msg = line[23:].strip() if len(line) > 23 else ""
            desc = CISAC_ERROR_CODES.get(err_code, err_msg or f"Erreur de règle CISAC code {err_code}")
            current_tx["exceptions"].append({
                "code": err_code,
                "message": desc,
            })
            # Si une exception bloquante est présente, forcer le rejet
            current_tx["is_accepted"] = False

    if current_tx:
        parsed_transactions.append(current_tx)

    return parsed_transactions


def parse_sacem_csv_ack_text(content: str) -> list[dict[str, Any]]:
    """Parse un rapport d'accusé de déclaration tabulaire (CSV/TSV de l'Espace Membre SACEM)."""
    import csv
    import io

    # Détecter le délimiteur (, ; ou \t)
    sample = content[:4096]
    delimiter = ";"
    if "\t" in sample and sample.count("\t") > sample.count(";"):
        delimiter = "\t"
    elif "," in sample and sample.count(",") > sample.count(";"):
        delimiter = ","

    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
    headers: list[str] = []
    parsed_transactions: list[dict[str, Any]] = []

    for idx, row in enumerate(reader):
        if not row or not any(field.strip() for field in row):
            continue

        if not headers:
            headers = [h.strip().upper() for h in row]
            continue

        row_dict = {headers[i]: row[i].strip() for i in range(min(len(headers), len(row)))}

        # Recherche des colonnes clés
        work_title = ""
        status_val = "RA"
        cocv = None
        iswc = None
        rejection_reason = None
        cotage = None

        for k, v in row_dict.items():
            k_upper = k.upper()
            if "TITRE" in k_upper or "OEUVRE" in k_upper or "WORK" in k_upper:
                if not work_title:
                    work_title = v
            elif "STATUT" in k_upper or "STATUS" in k_upper or "DECISION" in k_upper or "ETAT" in k_upper:
                v_clean = v.upper()
                if any(ok in v_clean for ok in ("VALID", "ACCEPT", "ENREGISTR", "OK", "RA")):
                    status_val = "RA"
                elif any(ko in v_clean for ko in ("REJET", "REFUS", "REJECT", "RE", "ERREUR", "ANOMALIE")):
                    status_val = "RE"
                else:
                    status_val = v_clean
            elif "SACEM" in k_upper or "COCV" in k_upper or "RECIPIENT" in k_upper or "CODE OEUVRE" in k_upper:
                digits = re.sub(r"\D", "", v)
                if len(digits) >= 8:
                    cocv = digits
            elif "ISWC" in k_upper:
                iswc = _clean_iswc(v)
            elif "COTAGE" in k_upper or "COT" in k_upper:
                cotage = v.strip()
            elif "MOTIF" in k_upper or "ERREUR" in k_upper or "REJET" in k_upper or "MESSAGE" in k_upper or "REASON" in k_upper:
                if v:
                    rejection_reason = v.strip()

        if work_title or cocv or iswc:
            is_accepted = status_val in ("RA", "AS", "AC", "VALIDÉ", "VALIDE", "ACCEPTÉ", "ACCEPTE")
            exceptions = []
            if rejection_reason:
                exceptions.append({"code": "ERR", "message": rejection_reason})
            
            parsed_transactions.append({
                "transaction_number": idx,
                "orig_trans_seq": None,
                "status_code": status_val,
                "is_accepted": is_accepted,
                "recipient_work_number": cocv,
                "iswc": iswc,
                "cotage": cotage,
                "work_title": work_title,
                "raw_text": "; ".join(f"{k}:{v}" for k, v in row_dict.items() if v),
                "exceptions": exceptions,
            })

    return parsed_transactions


def process_cwr_ack(
    content: str,
    filename: str,
    session: Session,
    auto_commit: bool = True,
) -> CwrAckReport:
    """Ingère un fichier d'accusé de réception CWR ACK ou CSV SACEM et synchronise le catalogue."""
    # 1. Détection du format (CWR texte fixe vs CSV)
    content_clean = content.strip()
    is_cwr_fixed = "HDR" in content_clean[:200] or "\nACK" in content_clean or content_clean.startswith("ACK")

    if is_cwr_fixed:
        raw_txs = parse_cisac_cwr_ack_text(content_clean)
    else:
        raw_txs = parse_sacem_csv_ack_text(content_clean)

    # Récupérer toutes les œuvres en base pour le matching
    existing_works = session.exec(select(Work)).all()

    # Indexations mémoires rapides pour un matching déterministe en O(1)
    works_by_id: dict[str, Work] = {str(w.id).lower(): w for w in existing_works}
    works_by_clean_id: dict[str, Work] = {str(w.id).replace("-", "").upper()[:14]: w for w in existing_works}
    works_by_iswc: dict[str, Work] = {}
    works_by_cocv: dict[str, Work] = {}
    works_by_cotage: dict[str, Work] = {}
    works_by_norm_title: dict[str, Work] = {}

    for w in existing_works:
        if w.iswc:
            cleaned = _clean_iswc(w.iswc)
            if cleaned:
                works_by_iswc[cleaned] = w
        if w.sacem_work_code:
            digits = re.sub(r"\D", "", w.sacem_work_code)
            if digits:
                works_by_cocv[digits] = w
        if w.cotage_number:
            works_by_cotage[w.cotage_number.strip().upper()] = w
        if w.title:
            norm = _normalize_title(w.title)
            if norm:
                works_by_norm_title[norm] = w
        for alt in w.alternate_titles or []:
            norm_alt = _normalize_title(alt)
            if norm_alt and norm_alt not in works_by_norm_title:
                works_by_norm_title[norm_alt] = w

    items: list[CwrAckItem] = []
    registered_count = 0
    rejected_count = 0
    unmatched_count = 0
    now_utc = datetime.now(timezone.utc)
    now_str = now_utc.strftime("%d/%m/%Y à %H:%M")

    for tx in raw_txs:
        # Trouver l'œuvre correspondante
        matched_work: Work | None = None
        raw_title = tx.get("work_title") or ""
        cocv = tx.get("recipient_work_number")
        iswc = tx.get("iswc")
        cotage = tx.get("cotage")

        # 1. Matching par COCV s'il était déjà en base
        if cocv and cocv in works_by_cocv:
            matched_work = works_by_cocv[cocv]

        # 2. Matching par ISWC
        if not matched_work and iswc:
            cleaned_iswc = _clean_iswc(iswc)
            if cleaned_iswc and cleaned_iswc in works_by_iswc:
                matched_work = works_by_iswc[cleaned_iswc]

        # 3. Matching par Cotage
        if not matched_work and cotage:
            cot_upper = cotage.strip().upper()
            if cot_upper in works_by_cotage:
                matched_work = works_by_cotage[cot_upper]

        # 4. Matching par Titre normalisé
        if not matched_work and raw_title:
            norm_t = _normalize_title(raw_title)
            if norm_t in works_by_norm_title:
                matched_work = works_by_norm_title[norm_t]
            else:
                # Tentative de sous-chaîne ou matching partiel
                for norm_key, candidate in works_by_norm_title.items():
                    if len(norm_key) >= 5 and (norm_key in norm_t or norm_t in norm_key):
                        matched_work = candidate
                        break

        # 5. Matching par code d'œuvre court dans raw_text
        if not matched_work and tx.get("raw_text"):
            for clean_id, candidate in works_by_clean_id.items():
                if clean_id in tx["raw_text"].upper():
                    matched_work = candidate
                    break

        is_accepted = tx.get("is_accepted", False)
        rejection_reason = None
        cisac_code = None
        if tx.get("exceptions"):
            rejection_reason = " | ".join(e["message"] for e in tx["exceptions"])
            cisac_code = tx["exceptions"][0].get("code")

        if matched_work:
            work_display_title = matched_work.title
            work_id = matched_work.id

            if is_accepted:
                matched_work.sacem_registration_status = "REGISTERED"
                matched_work.sacem_registered_at = now_utc
                matched_work.sacem_ack_reference = filename
                matched_work.sacem_rejection_reason = None
                
                # Mise à jour du COCV officiel attribué par la SACEM
                if cocv:
                    matched_work.sacem_work_code = cocv

                # Timeline note
                note_text = f"Accusé SACEM ({filename}) : Dépôt accepté avec succès le {now_str}."
                if cocv:
                    note_text += f" Code SACEM attribué : {cocv}."
                
                matched_work.timeline_notes = list(matched_work.timeline_notes or []) + [
                    {
                        "id": f"ack-{int(now_utc.timestamp())}-{len(matched_work.timeline_notes)}",
                        "author": "SACEM Extranet (ACK)",
                        "text": note_text,
                        "created_at": now_utc.isoformat(),
                    }
                ]
                registered_count += 1
                status_str = "REGISTERED"
            else:
                matched_work.sacem_registration_status = "REJECTED"
                matched_work.sacem_ack_reference = filename
                matched_work.sacem_rejection_reason = rejection_reason or "Rejet notifié dans le fichier d'accusé"
                
                note_text = f"Rejet SACEM ({filename}) le {now_str} : {matched_work.sacem_rejection_reason}"
                matched_work.timeline_notes = list(matched_work.timeline_notes or []) + [
                    {
                        "id": f"nack-{int(now_utc.timestamp())}-{len(matched_work.timeline_notes)}",
                        "author": "SACEM Extranet (NACK)",
                        "text": note_text,
                        "created_at": now_utc.isoformat(),
                    }
                ]
                rejected_count += 1
                status_str = "REJECTED"

            matched_work.updated_at = now_utc
            session.add(matched_work)

            items.append(
                CwrAckItem(
                    transaction_number=tx.get("transaction_number"),
                    work_id=work_id,
                    work_title=work_display_title,
                    matched=True,
                    status=status_str,
                    sacem_work_code=cocv or matched_work.sacem_work_code,
                    iswc=iswc or matched_work.iswc,
                    cotage_number=cotage or matched_work.cotage_number,
                    rejection_reason=rejection_reason,
                    cisac_error_code=cisac_code,
                )
            )
        else:
            unmatched_count += 1
            items.append(
                CwrAckItem(
                    transaction_number=tx.get("transaction_number"),
                    work_id=None,
                    work_title=raw_title or f"Transaction #{tx.get('transaction_number')}",
                    matched=False,
                    status="UNMATCHED",
                    sacem_work_code=cocv,
                    iswc=iswc,
                    cotage_number=cotage,
                    rejection_reason=rejection_reason or ("Non trouvée au catalogue"),
                    cisac_error_code=cisac_code,
                )
            )

    if auto_commit:
        session.commit()

    summary_messages = [
        f"Fichier analysé : {filename} ({len(raw_txs)} transactions)",
        f"✅ {registered_count} œuvre(s) validée(s) et confirmée(s) par la SACEM",
    ]
    if rejected_count > 0:
        summary_messages.append(f"⚠️ {rejected_count} œuvre(s) rejetée(s) avec notification de motif")
    if unmatched_count > 0:
        summary_messages.append(f"ℹ️ {unmatched_count} transaction(s) sans correspondance catalogue")

    return CwrAckReport(
        filename=filename,
        total_transactions=len(raw_txs),
        registered_count=registered_count,
        rejected_count=rejected_count,
        unmatched_count=unmatched_count,
        items=items,
        summary_messages=summary_messages,
    )
