"""Service de génération et validation de virements groupés SEPA XML ISO 20022 (pain.001.001.03).

Conforme aux normes du Conseil Européen des Paiements (EPC - European Payments Council)
et aux standards interbancaires SEPA Credit Transfer (SCT).
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import re
import unicodedata
from uuid import uuid4

from app.schemas.royalty import AdvanceRecoupmentState
from app.schemas.sepa import (
    SepaExportRequest,
    SepaExportResponse,
    SepaPayeeSummary,
    SepaSkippedPayeeSummary,
    SepaValidationReport,
)

CENT = Decimal("0.01")

# Longueurs officielles d'IBAN par code pays ISO 3166-1 alpha-2
IBAN_COUNTRY_LENGTHS: dict[str, int] = {
    "FR": 27,
    "MC": 27,
    "DE": 22,
    "GB": 22,
    "BE": 16,
    "ES": 24,
    "IT": 27,
    "CH": 21,
    "NL": 18,
    "LU": 20,
    "AT": 20,
    "PT": 25,
    "IE": 22,
    "SE": 24,
    "NO": 15,
    "DK": 18,
    "FI": 18,
    "PL": 28,
}

BIC_REGEX = re.compile(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$")


def clean_iban(iban: str | None) -> str:
    """Nettoie l'IBAN de tout espace, tiret ou caractère non alphanumérique."""
    if not iban:
        return ""
    return "".join(c for c in iban if c.isalnum()).upper()


def format_iban(iban: str | None) -> str:
    """Formate un IBAN en blocs lisibles de 4 caractères (ex: FR76 3000 4019 ...)."""
    cleaned = clean_iban(iban)
    if not cleaned:
        return ""
    return " ".join(cleaned[i : i + 4] for i in range(0, len(cleaned), 4))


def validate_iban(iban: str | None) -> bool:
    """Valide rigoureusement un IBAN selon la norme ISO 13616 (contrôle de longueur et clé modulo-97)."""
    cleaned = clean_iban(iban)
    if len(cleaned) < 15 or len(cleaned) > 34:
        return False

    country = cleaned[:2]
    if not country.isalpha():
        return False

    expected_len = IBAN_COUNTRY_LENGTHS.get(country)
    if expected_len and len(cleaned) != expected_len:
        return False

    # Calcul de la clé de contrôle modulo-97
    rearranged = cleaned[4:] + cleaned[:4]
    numeric_string = "".join(
        str(ord(c) - 55) if c.isalpha() else c for c in rearranged
    )
    try:
        return int(numeric_string) % 97 == 1
    except ValueError:
        return False


def validate_bic(bic: str | None) -> bool:
    """Valide la syntaxe d'un code BIC / SWIFT (8 ou 11 caractères)."""
    if not bic:
        return True  # Optionnel dans l'espace SEPA (règlement 260/2012)
    cleaned = bic.strip().upper()
    return bool(BIC_REGEX.match(cleaned))


def sanitize_xml_text(text: str | None, max_length: int = 70) -> str:
    """Normalise une chaîne pour inclusion sécurisée dans un élément XML SEPA :
    - Supprime les accents pour compatibilité interbancaire stricte EPC
    - Échappe les caractères réservés XML (&, <, >, ", ')
    - Limite à la longueur maximale autorisée
    """
    if not text:
        return ""

    # Décomposition des accents (NFD) et suppression des marques diacritiques
    nfkd_form = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in nfkd_form if not unicodedata.combining(c))

    # Suppression des caractères non autorisés
    cleaned = re.sub(r"[^a-zA-Z0-9\s\-\.\,\/\+\?\:\(\)\&\'\<\>\"\@]", " ", ascii_text).strip()
    cleaned = " ".join(cleaned.split())  # Dé-doublonnage des espaces

    # Tronquature
    truncated = cleaned[:max_length].strip()

    # Échappement des entités XML
    escaped = (
        truncated.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
    return escaped


def resolve_default_execution_date() -> str:
    """Calcule la date d'exécution par défaut (demain ouvré)."""
    today = date.today()
    tomorrow = today + timedelta(days=1)
    # Si le lendemain est un samedi ou dimanche, décaler au lundi
    if tomorrow.weekday() == 5:
        tomorrow += timedelta(days=2)
    elif tomorrow.weekday() == 6:
        tomorrow += timedelta(days=1)
    return tomorrow.isoformat()


def extract_sepa_payees_and_skipped(
    holder_statements: list[AdvanceRecoupmentState],
    period_label: str,
    remittance_prefix: str = "KOROM ROYALTIES",
    allow_unverified_ibans: bool = False,
) -> tuple[list[SepaPayeeSummary], list[SepaSkippedPayeeSummary]]:
    """Analyse l'ensemble des ayants droit et produit la liste des virements éligibles
    et la liste des ayants droit exclus avec justification métier.
    """
    payees: list[SepaPayeeSummary] = []
    skipped: list[SepaSkippedPayeeSummary] = []

    for idx, h in enumerate(holder_statements, start=1):
        net_payable = Decimal(str(h.net_payable_amount or "0.00")).quantize(CENT, rounding=ROUND_HALF_UP)
        p_status = getattr(h, "payout_status", "PAYABLE") or "PAYABLE"

        # Cas 1 : Ayants droit sans solde exigible ou non payables
        if net_payable <= Decimal("0.00") or p_status != "PAYABLE":
            reason = "Solde exigible nul (0.00 €)"
            if p_status == "BELOW_THRESHOLD" or getattr(h, "is_below_payment_threshold", False):
                threshold = h.min_payment_threshold or "50.00"
                reason = f"Sous le seuil minimal ({threshold} €) — Conservé en réserve pour le décompte suivant"
            elif p_status == "RECOUPING" or Decimal(str(h.remaining_unrecouped_balance or "0.00")) > Decimal("0.00"):
                reason = f"Avance en cours d'amortissement (solde résiduel : {h.remaining_unrecouped_balance} €)"

            skipped.append(
                SepaSkippedPayeeSummary(
                    holder_id=str(h.right_holder_id) if h.right_holder_id else None,
                    name=h.holder_name,
                    role=h.role,
                    amount_eur=net_payable,
                    reason=reason,
                    payout_status=p_status,
                )
            )
            continue

        # Cas 2 : Succession active avec ventilation notariale entre héritiers (US-4.2)
        if getattr(h, "succession_active", False) and getattr(h, "heirs_distribution", None):
            heirs = h.heirs_distribution
            for h_idx, heir in enumerate(heirs, start=1):
                heir_name = heir.get("heir_name", f"Héritier #{h_idx} de {h.holder_name}")
                heir_net = Decimal(str(heir.get("net_payable", "0.00"))).quantize(CENT, rounding=ROUND_HALF_UP)
                if heir_net <= Decimal("0.00"):
                    continue

                raw_iban = clean_iban(heir.get("iban"))
                is_valid = validate_iban(raw_iban)
                if not raw_iban:
                    skipped.append(
                        SepaSkippedPayeeSummary(
                            holder_id=str(h.right_holder_id) if h.right_holder_id else None,
                            name=f"{heir_name} (Héritier de {h.holder_name})",
                            role="HEIR",
                            amount_eur=heir_net,
                            reason="IBAN non renseigné sur la fiche héritier de la succession",
                            payout_status="MISSING_IBAN",
                        )
                    )
                    continue

                if not is_valid and not allow_unverified_ibans:
                    skipped.append(
                        SepaSkippedPayeeSummary(
                            holder_id=str(h.right_holder_id) if h.right_holder_id else None,
                            name=f"{heir_name} (Héritier de {h.holder_name})",
                            role="HEIR",
                            amount_eur=heir_net,
                            reason=f"IBAN invalide ({format_iban(raw_iban)}) — Échec contrôle de clé modulo-97",
                            payout_status="INVALID_IBAN",
                        )
                    )
                    continue

                raw_bic = (heir.get("bic") or "").strip().upper() or None
                clean_end_to_end = f"KRM-SUCC-{str(h.right_holder_id or idx)[:8]}-{h_idx}"[:35]
                remittance_text = f"{remittance_prefix} SUCC {h.holder_name} - {heir_name} ({period_label})"[:140]

                payees.append(
                    SepaPayeeSummary(
                        holder_id=str(h.right_holder_id) if h.right_holder_id else None,
                        name=heir_name,
                        role="HEIR",
                        amount_eur=heir_net,
                        iban=raw_iban,
                        formatted_iban=format_iban(raw_iban),
                        bic=raw_bic,
                        is_valid_iban=is_valid,
                        is_valid_bic=validate_bic(raw_bic),
                        remittance_info=remittance_text,
                        end_to_end_id=clean_end_to_end,
                        is_heir=True,
                        heir_relationship=heir.get("relationship", "Héritier"),
                        is_mandated=False,
                    )
                )
            continue

        # Cas 3 : Tiers payé / Mandataire désigné (US-4.2)
        payout_name = h.holder_name
        is_mandated = False
        mandated_original = None
        if getattr(h, "payout_recipient_name", None):
            payout_name = h.payout_recipient_name
            is_mandated = True
            mandated_original = h.holder_name

        raw_iban = clean_iban(h.iban)
        is_valid = validate_iban(raw_iban)
        if not raw_iban:
            skipped.append(
                SepaSkippedPayeeSummary(
                    holder_id=str(h.right_holder_id) if h.right_holder_id else None,
                    name=payout_name,
                    role=h.role,
                    amount_eur=net_payable,
                    reason="IBAN manquant sur la fiche de l'ayant droit",
                    payout_status="MISSING_IBAN",
                )
            )
            continue

        if not is_valid and not allow_unverified_ibans:
            skipped.append(
                SepaSkippedPayeeSummary(
                    holder_id=str(h.right_holder_id) if h.right_holder_id else None,
                    name=payout_name,
                    role=h.role,
                    amount_eur=net_payable,
                    reason=f"IBAN invalide ({format_iban(raw_iban)}) — Échec contrôle de clé modulo-97",
                    payout_status="INVALID_IBAN",
                )
            )
            continue

        raw_bic = (h.bic or "").strip().upper() or None
        clean_end_to_end = f"KRM-ROY-{str(h.right_holder_id or idx)[:12]}-{idx}"[:35]
        label_holder = f"MANDAT {mandated_original}" if is_mandated else payout_name
        remittance_text = f"{remittance_prefix} {label_holder} ({period_label})"[:140]

        payees.append(
            SepaPayeeSummary(
                holder_id=str(h.right_holder_id) if h.right_holder_id else None,
                name=payout_name,
                role=h.role,
                amount_eur=net_payable,
                iban=raw_iban,
                formatted_iban=format_iban(raw_iban),
                bic=raw_bic,
                is_valid_iban=is_valid,
                is_valid_bic=validate_bic(raw_bic),
                remittance_info=remittance_text,
                end_to_end_id=clean_end_to_end,
                is_heir=False,
                is_mandated=is_mandated,
                mandated_original_holder=mandated_original,
            )
        )

    return payees, skipped


def build_sepa_validation_report(
    statement_id: str,
    source_name: str,
    period_label: str,
    holder_statements: list[AdvanceRecoupmentState],
    debtor_name: str,
    debtor_iban: str,
    debtor_bic: str | None = None,
    execution_date: str | None = None,
    remittance_prefix: str = "KOROM ROYALTIES",
    allow_unverified_ibans: bool = False,
) -> SepaValidationReport:
    """Produit un rapport d'audit pré-vol complet pour la modale frontend avant émission."""
    exec_date = execution_date or resolve_default_execution_date()
    payees, skipped = extract_sepa_payees_and_skipped(
        holder_statements=holder_statements,
        period_label=period_label,
        remittance_prefix=remittance_prefix,
        allow_unverified_ibans=allow_unverified_ibans,
    )

    clean_deb_iban = clean_iban(debtor_iban)
    is_deb_valid = validate_iban(clean_deb_iban) or (allow_unverified_ibans and bool(clean_deb_iban))
    total_amount = sum((p.amount_eur for p in payees), Decimal("0.00"))

    invalid_count = sum(1 for s in skipped if s.payout_status in ("MISSING_IBAN", "INVALID_IBAN"))

    is_ready = bool(payees) and is_deb_valid

    return SepaValidationReport(
        statement_id=statement_id,
        source_name=source_name,
        period_label=period_label,
        execution_date=exec_date,
        is_ready_for_export=is_ready,
        total_payable_recipients=len(payees) + invalid_count,
        total_valid_recipients=len(payees),
        total_invalid_recipients=invalid_count,
        total_amount_eur=total_amount,
        debtor_name=debtor_name,
        debtor_iban=format_iban(clean_deb_iban),
        debtor_bic=debtor_bic,
        is_valid_debtor_iban=is_deb_valid,
        payees=payees,
        skipped=skipped,
    )


def generate_sepa_pain001_xml(
    statement_id: str,
    source_name: str,
    period_label: str,
    holder_statements: list[AdvanceRecoupmentState],
    debtor_name: str,
    debtor_iban: str,
    debtor_bic: str | None = None,
    execution_date: str | None = None,
    remittance_prefix: str = "KOROM ROYALTIES",
    allow_unverified_ibans: bool = False,
) -> SepaExportResponse:
    """Génère le document officiel XML SEPA ISO 20022 pain.001.001.03 avec sommes de contrôle."""
    exec_date = execution_date or resolve_default_execution_date()
    payees, skipped = extract_sepa_payees_and_skipped(
        holder_statements=holder_statements,
        period_label=period_label,
        remittance_prefix=remittance_prefix,
        allow_unverified_ibans=allow_unverified_ibans,
    )

    clean_deb_iban = clean_iban(debtor_iban)
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%S")
    timestamp_compact = now_dt.strftime("%Y%m%d%H%M%S")
    unique_suffix = uuid4().hex[:6].upper()

    message_id = f"KOROM-MSG-{timestamp_compact}-{unique_suffix}"[:35]
    payment_info_id = f"KOROM-PMT-{statement_id[:8]}-{timestamp_compact[:8]}"[:35]

    total_amount = sum((p.amount_eur for p in payees), Decimal("0.00")).quantize(CENT, rounding=ROUND_HALF_UP)
    total_txs = len(payees)

    sanitized_debtor_name = sanitize_xml_text(debtor_name, max_length=70)

    # Construction du document XML
    xml_lines: list[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"',
        '          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
        '  <CstmrCdtTrfInitn>',
        '    <GrpHdr>',
        f'      <MsgId>{message_id}</MsgId>',
        f'      <CreDtTm>{now_iso}</CreDtTm>',
        f'      <NbOfTxs>{total_txs}</NbOfTxs>',
        f'      <CtrlSum>{total_amount:.2f}</CtrlSum>',
        '      <InitgPty>',
        f'        <Nm>{sanitized_debtor_name}</Nm>',
        '      </InitgPty>',
        '    </GrpHdr>',
        '    <PmtInf>',
        f'      <PmtInfId>{payment_info_id}</PmtInfId>',
        '      <PmtMtd>TRF</PmtMtd>',
        '      <BtchBookg>true</BtchBookg>',
        f'      <NbOfTxs>{total_txs}</NbOfTxs>',
        f'      <CtrlSum>{total_amount:.2f}</CtrlSum>',
        '      <PmtTpInf>',
        '        <SvcLvl>',
        '          <Cd>SEPA</Cd>',
        '        </SvcLvl>',
        '      </PmtTpInf>',
        f'      <ReqdExctnDt>{exec_date}</ReqdExctnDt>',
        '      <Dbtr>',
        f'        <Nm>{sanitized_debtor_name}</Nm>',
        '      </Dbtr>',
        '      <DbtrAcct>',
        '        <Id>',
        f'          <IBAN>{clean_deb_iban}</IBAN>',
        '        </Id>',
        '      </DbtrAcct>',
        '      <DbtrAgt>',
        '        <FinInstnId>',
    ]

    if debtor_bic and validate_bic(debtor_bic):
        clean_bic = debtor_bic.strip().upper()
        xml_lines.append(f'          <BIC>{clean_bic}</BIC>')
    else:
        xml_lines.extend([
            '          <Othr>',
            '            <Id>NOTPROVIDED</Id>',
            '          </Othr>',
        ])

    xml_lines.extend([
        '        </FinInstnId>',
        '      </DbtrAgt>',
        '      <ChrgBr>SLEV</ChrgBr>',
    ])

    # Transactions individuelles de crédit
    for p in payees:
        sanitized_payee_name = sanitize_xml_text(p.name, max_length=70)
        sanitized_remittance = sanitize_xml_text(p.remittance_info, max_length=140)
        clean_payee_iban = clean_iban(p.iban)

        xml_lines.extend([
            '      <CdtTrfTxInf>',
            '        <PmtId>',
            f'          <EndToEndId>{p.end_to_end_id}</EndToEndId>',
            '        </PmtId>',
            '        <Amt>',
            f'          <InstdAmt Ccy="EUR">{p.amount_eur:.2f}</InstdAmt>',
            '        </Amt>',
        ])

        if p.bic and validate_bic(p.bic):
            clean_bic = p.bic.strip().upper()
            xml_lines.extend([
                '        <CdtrAgt>',
                '          <FinInstnId>',
                f'            <BIC>{clean_bic}</BIC>',
                '          </FinInstnId>',
                '        </CdtrAgt>',
            ])
        else:
            xml_lines.extend([
                '        <CdtrAgt>',
                '          <FinInstnId>',
                '            <Othr>',
                '              <Id>NOTPROVIDED</Id>',
                '            </Othr>',
                '          </FinInstnId>',
                '        </CdtrAgt>',
            ])

        xml_lines.extend([
            '        <Cdtr>',
            f'          <Nm>{sanitized_payee_name}</Nm>',
            '        </Cdtr>',
            '        <CdtrAcct>',
            '          <Id>',
            f'            <IBAN>{clean_payee_iban}</IBAN>',
            '          </Id>',
            '        </CdtrAcct>',
            '        <RmtInf>',
            f'          <Ustrd>{sanitized_remittance}</Ustrd>',
            '        </RmtInf>',
            '      </CdtTrfTxInf>',
        ])

    xml_lines.extend([
        '    </PmtInf>',
        '  </CstmrCdtTrfInitn>',
        '</Document>',
    ])

    xml_content = "\n".join(xml_lines)
    clean_src = re.sub(r"[^a-zA-Z0-9]+", "_", source_name).strip("_")
    filename = f"SEPA_PAIN001_{clean_src}_{now_dt.strftime('%Y%m%d')}.xml"

    return SepaExportResponse(
        filename=filename,
        xml_content=xml_content,
        message_id=message_id,
        payment_info_id=payment_info_id,
        total_transactions=total_txs,
        total_amount_eur=total_amount,
        execution_date=exec_date,
        debtor_name=debtor_name,
        debtor_iban=format_iban(clean_deb_iban),
        debtor_bic=debtor_bic,
        included_payees=payees,
        skipped_payees=skipped,
    )
