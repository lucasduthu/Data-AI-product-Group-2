from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from app.models.work import Work
from app.schemas.work import RightHolderRole, RightHolderSplit
from app.services.cwr_validator import PUBLISHER_ROLES, validate_work_cwr

CISAC_SOCIETY_CODES: dict[str, str] = {
    "SACEM": "058",
    "SDRM": "058",
    "ASCAP": "010",
    "BMI": "021",
    "SESAC": "071",
    "PRS": "052",
    "MCPS": "044",
    "GEMA": "035",
    "SGAE": "070",
    "SIAE": "073",
    "SABAM": "026",
    "SUISA": "077",
    "STIM": "076",
    "TONO": "083",
    "TEOSTO": "081",
    "KODA": "055",
    "NCB": "047",
    "BUMA": "023",
    "STEMRA": "074",
    "SOCAN": "075",
    "CMRRA": "028",
    "APRA": "014",
    "AMCOS": "014",
    "JASRAC": "050",
    "UBC": "088",
    "SCPP": "058",
    "SPPF": "058",
    "ADAMI": "058",
}


def resolve_cisac_society_code(name_or_code: str | None, default: str = "058") -> str:
    """Résout le code CISAC standard à 3 chiffres d'une société de gestion collective."""
    if not name_or_code:
        return default
    cleaned = name_or_code.strip().upper()
    if cleaned.isdigit() and len(cleaned) == 3:
        return cleaned
    for k, code in CISAC_SOCIETY_CODES.items():
        if k in cleaned:
            return code
    return default


def _fmt_cwr_share(pct: Decimal) -> str:
    """Formate un pourcentage Decimal (ex: 50.00) sur 5 chiffres CWR (ex: '05000' pour 50,00%)."""
    val = int((pct * Decimal("100")).to_integral_value())
    return f"{max(0, min(10000, val)):05d}"


def generate_cwr_v21_content(
    works: list[Work],
    sender_ipi: str = "00891234567",
    sender_name: str = "EDITIONS SOLSTICES MUSIC",
) -> dict[str, Any]:
    """Génère de manière 100 % déterministe un fichier CWR v2.1 (norme CISAC / Sacem).

    Les œuvres dont les parts DEP/DRM totalisent 100,00 % (et part éditoriale DEP <= 50,00 %)
    sont incluses dans les enregistrements NWR/SPU/SWR, même lorsqu'un code IPI n'était pas
    imprimé sur le contrat PDF (remplacé par '00000000000' avec avertissement non bloquant).
    Seules les œuvres présentant un conflit mathématique de clés (DEP/DRM != 100 % ou > plafond)
    sont rejetées dans `skipped_works`.
    """
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    time_str = datetime.now(timezone.utc).strftime("%H%M%S")

    # Détection automatique de l'éditeur émetteur réel depuis les œuvres si l'émetteur par défaut est générique
    effective_sender_name = (sender_name or "EDITIONS SOLSTICES MUSIC").strip().upper()
    effective_sender_ipi = "".join(ch for ch in str(sender_ipi or "00891234567") if ch.isdigit()).zfill(11)

    if "SOLSTICES" in effective_sender_name and works:
        has_solstices_in_works = False
        best_pub_name: str | None = None
        best_pub_ipi: str | None = None
        for w in works:
            for raw_sp in (w.splits or []):
                sp_obj = raw_sp if isinstance(raw_sp, RightHolderSplit) else RightHolderSplit.model_validate(raw_sp)
                r_val = sp_obj.role.value if isinstance(sp_obj.role, RightHolderRole) else str(sp_obj.role)
                if r_val in PUBLISHER_ROLES:
                    h_up = (sp_obj.holder_name or "").strip().upper()
                    if "SOLSTICES" in h_up:
                        has_solstices_in_works = True
                        break
                    clean_p_ipi = "".join(ch for ch in str(sp_obj.ipi_number or "") if ch.isdigit())
                    if not best_pub_name or (clean_p_ipi and not best_pub_ipi):
                        best_pub_name = h_up
                        if clean_p_ipi:
                            best_pub_ipi = clean_p_ipi.zfill(11)
            if has_solstices_in_works:
                break
        if not has_solstices_in_works and best_pub_name:
            effective_sender_name = best_pub_name
            if best_pub_ipi:
                effective_sender_ipi = best_pub_ipi

    lines: list[str] = []
    included_works: list[str] = []
    skipped_works: list[dict[str, Any]] = []
    cwr_warnings: list[dict[str, Any]] = []

    # Enregistrement HDR (Header)
    hdr = f"HDRPB{effective_sender_ipi[-9:]:<9}{effective_sender_name[:45]:<45}01.10{now_str}{time_str}{now_str}"
    lines.append(hdr)

    # Enregistrement GRH (Group Header - New Works Registration)
    lines.append("GRHNWR0000102.100000000000")

    transaction_seq = 0
    record_seq = 2  # Compte HDR + GRH

    for work in works:
        report = validate_work_cwr(
            work_title=work.title,
            splits=work.splits or [],
            iswc=work.iswc,
            work_id=work.id,
        )
        # On distingue les erreurs mathématiques bloquantes (somme DEP/DRM != 100%, plafond éditeur dépassé)
        # des simples codes IPI non imprimés sur le contrat PDF
        math_blocking_errors = [
            err for err in report.blocking_errors if not err.startswith("Code IPI manquant")
        ]
        missing_ipi_warnings = [
            err for err in report.blocking_errors if err.startswith("Code IPI manquant")
        ]

        if math_blocking_errors:
            skipped_works.append(
                {
                    "work_id": str(work.id),
                    "work_title": work.title,
                    "blocking_errors": report.blocking_errors,
                }
            )
            continue

        if missing_ipi_warnings or report.warnings:
            cwr_warnings.append(
                {
                    "work_id": str(work.id),
                    "work_title": work.title,
                    "warnings": missing_ipi_warnings + report.warnings,
                }
            )

        included_works.append(work.title)
        raw_iswc = (work.iswc or "").replace("-", "").replace(".", "").strip()
        iswc_field = f"{raw_iswc:<11}"[:11]
        title_field = f"{work.title.upper()[:60]:<60}"
        if getattr(work, "cotage_number", None) and str(work.cotage_number).strip():
            raw_code = str(work.cotage_number).strip().upper()
        elif getattr(work, "sacem_work_code", None) and str(work.sacem_work_code).strip():
            raw_code = str(work.sacem_work_code).strip().upper()
        elif getattr(work, "contract_reference", None) and str(work.contract_reference).strip():
            raw_code = f"{str(work.contract_reference).strip().upper()}-{transaction_seq + 1:03d}"
        else:
            raw_code = str(work.id).replace("-", "")[:14].upper()
        work_code = f"{raw_code[:14]:<14}"
        work_date_str = (
            work.created_at.strftime("%Y%m%d")
            if getattr(work, "created_at", None)
            else "00000000"
        )

        # Transaction NWR (New Work Registration)
        lines.append(
            f"NWR{transaction_seq:08d}{0:08d}{title_field}  {work_code}{iswc_field}{work_date_str}    UNC"
        )
        record_seq += 1
        sub_rec_seq = 1

        parsed_splits = [
            s if isinstance(s, RightHolderSplit) else RightHolderSplit.model_validate(s)
            for s in (work.splits or [])
        ]

        # Séparation Éditeurs (SPU/SPT) et Auteurs/Compositeurs (SWR/SWT)
        pub_idx = 1
        writer_idx = 1
        for sp in parsed_splits:
            role_val = sp.role.value if isinstance(sp.role, RightHolderRole) else str(sp.role)
            ipi_field = f"{(sp.ipi_number or '00000000000')[:11]:>11}"
            name_field = f"{sp.holder_name.upper()[:45]:<45}"
            dep_cwr = _fmt_cwr_share(sp.dep_share_pct)
            drm_cwr = _fmt_cwr_share(sp.drm_share_pct)
            soc_de = resolve_cisac_society_code(getattr(sp, "society_de", None) or getattr(sp, "society_name", None))
            soc_dr = resolve_cisac_society_code(getattr(sp, "society_dr", None) or getattr(sp, "society_name", None))

            if role_val in PUBLISHER_ROLES:
                cwr_role = "E " if role_val in ("E", "PUBLISHER") else "SE"
                lines.append(
                    f"SPU{transaction_seq:08d}{sub_rec_seq:08d}{pub_idx:02d}{work_code[:9]:<9}{name_field} {cwr_role}000000000{ipi_field}{soc_de}{dep_cwr}{soc_dr}{drm_cwr}   00000"
                )
                sub_rec_seq += 1
                lines.append(
                    f"SPT{transaction_seq:08d}{sub_rec_seq:08d}{work_code[:9]:<9}      {dep_cwr}{drm_cwr}00000I2136N001"
                )
                sub_rec_seq += 1
                record_seq += 2
                pub_idx += 1
            else:
                cwr_role = (
                    "CA"
                    if role_val in ("AC", "AUTHOR_COMPOSER")
                    else "AR"
                    if role_val in ("AR", "ARRANGER")
                    else "AD"
                    if role_val in ("AD", "ADAPTOR")
                    else "A "
                    if role_val in ("A", "AUTHOR")
                    else "C "
                )
                lines.append(
                    f"SWR{transaction_seq:08d}{sub_rec_seq:08d}{work_code[:9]:<9}{name_field} {cwr_role}000000000{ipi_field}{soc_de}{dep_cwr}{soc_dr}{drm_cwr}   00000"
                )
                sub_rec_seq += 1
                lines.append(
                    f"SWT{transaction_seq:08d}{sub_rec_seq:08d}{work_code[:9]:<9}{dep_cwr}{drm_cwr}00000I2136N001"
                )
                sub_rec_seq += 1
                record_seq += 2
                writer_idx += 1

        for alt in work.alternate_titles or []:
            alt_field = f"{alt.upper()[:60]:<60}"
            lines.append(f"ALT{transaction_seq:08d}{sub_rec_seq:08d}{alt_field}ATFR")
            sub_rec_seq += 1
            record_seq += 1

        # Si l'œuvre a un sous-titre officiel pour la Sacem/CWR, on l'exporte en ALT type 'TE' (Sous-titre / Translation / Extra)
        if getattr(work, "subtitle", None):
            sub_field = f"{work.subtitle.upper()[:60]:<60}"
            lines.append(f"ALT{transaction_seq:08d}{sub_rec_seq:08d}{sub_field}TEFR")
            sub_rec_seq += 1
            record_seq += 1

        transaction_seq += 1

    # Enregistrements GRT (Group Trailer) et TRL (Transmission Trailer)
    record_seq += 2
    lines.append(f"GRT00001{transaction_seq:08d}{record_seq:08d}   0000000000")
    lines.append(f"TRL00001{transaction_seq:08d}{record_seq:08d}")

    sender_tag = (
        "SOLSTICES"
        if "SOLSTICES" in effective_sender_name
        else "".join(c for c in effective_sender_name if c.isalnum())[:12] or "SACEM"
    )

    return {
        "filename": f"CW26{now_str[-4:]}001_{sender_tag}.V21",
        "cwr_version": "2.1",
        "included_works_count": len(included_works),
        "included_works": included_works,
        "skipped_works_count": len(skipped_works),
        "skipped_works": skipped_works,
        "cwr_warnings": cwr_warnings,
        "content": "\n".join(lines),
    }
