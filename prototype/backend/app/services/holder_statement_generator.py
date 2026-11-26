from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

from app.schemas.royalty import AdvanceRecoupmentState

CENT = Decimal("0.01")

TERRITORY_NAMES: dict[str, dict[str, str]] = {
    "FR": {"fr": "France", "en": "France"},
    "US": {"fr": "États-Unis", "en": "United States"},
    "GB": {"fr": "Royaume-Uni", "en": "United Kingdom"},
    "UK": {"fr": "Royaume-Uni", "en": "United Kingdom"},
    "DE": {"fr": "Allemagne", "en": "Germany"},
    "IT": {"fr": "Italie", "en": "Italy"},
    "ES": {"fr": "Espagne", "en": "Spain"},
    "CA": {"fr": "Canada", "en": "Canada"},
    "JP": {"fr": "Japon", "en": "Japan"},
    "BE": {"fr": "Belgique", "en": "Belgium"},
    "CH": {"fr": "Suisse", "en": "Switzerland"},
    "NL": {"fr": "Pays-Bas", "en": "Netherlands"},
    "WW": {"fr": "Monde (International)", "en": "Worldwide (International)"},
    "EU": {"fr": "Union Européenne", "en": "European Union"},
}

RIGHT_TYPE_NAMES: dict[str, dict[str, str]] = {
    "DEP": {"fr": "Droits d'Exécution Publique (DEP)", "en": "Public Performance Rights (DEP)"},
    "DRM": {"fr": "Droits de Reproduction Mécanique (DRM)", "en": "Mechanical Reproduction Rights (DRM)"},
    "SYNC": {"fr": "Synchronisation Audiovisuelle (SYNC)", "en": "Synchronization Rights (SYNC)"},
    "PHONO": {"fr": "Master Phonographique / Droits Voisins", "en": "Master Recording Rights (Phono)"},
    "DSN": {"fr": "Droits Numériques & Streaming (DSN)", "en": "Digital & Streaming Rights (DSN)"},
}


def generate_individual_holder_statement(
    holder_state: AdvanceRecoupmentState,
    publisher_name: str,
    publisher_ipi: str,
    statement_source: str,
    period_start: str,
    period_end: str,
    vat_rate_pct: Decimal = Decimal("10.00"),
    line_details: list[dict[str, Any]] | None = None,
    language: str = "FR",
    group_by: str = "WORK",
    hide_zero_lines: bool = False,
) -> dict[str, Any]:
    """
    Génère de manière 100 % déterministe un relevé individuel de royalties enrichi (JSON + CSV + Texte imprimable).
    Supporte les options avancées US-4.6 :
    - Regroupement par Projet Audiovisuel / Album ('PROJECT'), par Territoire ('TERRITORY'), par Famille de Droits ('RIGHT_TYPE') ou par Œuvre ('WORK').
    - Présentation bilingue Français ('FR') ou Anglais ('EN').
    - Masquage des lignes à solde nul ('hide_zero_lines').
    """
    is_en = language.strip().upper() == "EN"
    lang_key = "en" if is_en else "fr"
    group_mode = group_by.strip().upper()
    if group_mode not in ("PROJECT", "TERRITORY", "RIGHT_TYPE", "WORK"):
        group_mode = "WORK"

    vat_rate = Decimal(str(vat_rate_pct)).quantize(CENT)
    gross_allocated = Decimal(str(holder_state.gross_royalties_allocated)).quantize(CENT)
    recouped_adv = Decimal(str(holder_state.recouped_in_period)).quantize(CENT)
    taxable_ht = max(Decimal("0.00"), gross_allocated - recouped_adv).quantize(CENT)
    vat_amount = (taxable_ht * vat_rate / Decimal("100.00")).quantize(CENT, rounding=ROUND_HALF_UP)
    net_payable_ttc = (taxable_ht + vat_amount).quantize(CENT)
    precompte_social = Decimal(str(holder_state.precompte_social_amount or holder_state.precompte_ircec_amount or "0.00")).quantize(CENT)
    net_payable = Decimal(str(holder_state.net_payable_amount)).quantize(CENT)
    retained_reserve = Decimal(str(getattr(holder_state, "retained_in_reserve", "0.00"))).quantize(CENT)
    carried_prev = Decimal(str(getattr(holder_state, "previous_reserve_balance", "0.00"))).quantize(CENT)

    source_curr = getattr(holder_state, "source_currency", "EUR") or "EUR"
    ex_rate = Decimal(str(getattr(holder_state, "exchange_rate", "1.000000") or "1.000000"))
    source_gross_allocated = getattr(holder_state, "source_gross_royalties_allocated", None)

    # Récupération et filtrage des lignes
    raw_lines = line_details or []
    if not raw_lines and getattr(holder_state, "works_breakdown", None):
        for wb in holder_state.works_breakdown:
            raw_lines.append({
                "work_title": wb.work_title,
                "iswc": wb.iswc,
                "right_type": wb.right_type,
                "exploitation_type": wb.exploitation_type,
                "territory": getattr(wb, "territory", "FR") or "FR",
                "work_group_title": getattr(wb, "work_group_title", None) or "Catalogue Général / Hors Projet",
                "gross_amount": str(wb.gross_line_amount),
                "share_percentage": str(wb.share_percentage),
                "allocated_amount": str(wb.allocated_amount),
            })

    total_lines_count = len(raw_lines)
    filtered_lines: list[dict[str, Any]] = []
    for ld in raw_lines:
        alloc_dec = Decimal(str(ld.get("allocated_amount", "0.00"))).quantize(CENT)
        if hide_zero_lines and alloc_dec <= Decimal("0.00"):
            continue
        filtered_lines.append(ld)

    # Regroupement avec sous-totaux
    groups_dict: dict[str, dict[str, Any]] = {}
    for ld in filtered_lines:
        w_title = str(ld.get("work_title") or "Sans titre")
        rt = str(ld.get("right_type") or "DEP").upper()
        terr = str(ld.get("territory") or "FR").upper()
        proj = str(ld.get("work_group_title") or "Catalogue Général / Hors Projet")

        if group_mode == "PROJECT":
            g_key = proj
            g_label = (f"Projet / Série TV : {proj}") if not is_en else (f"Audiovisual Project / Series: {proj}")
        elif group_mode == "TERRITORY":
            g_key = terr
            terr_label = TERRITORY_NAMES.get(terr, {}).get(lang_key, terr)
            g_label = (f"Territoire : {terr_label} ({terr})") if not is_en else (f"Territory: {terr_label} ({terr})")
        elif group_mode == "RIGHT_TYPE":
            g_key = rt
            rt_label = RIGHT_TYPE_NAMES.get(rt, {}).get(lang_key, rt)
            g_label = (f"Famille de Droits : {rt_label}") if not is_en else (f"Rights Category: {rt_label}")
        else:
            g_key = w_title
            g_label = w_title

        if g_key not in groups_dict:
            groups_dict[g_key] = {
                "group_key": g_key,
                "group_label": g_label,
                "lines": [],
                "total_gross": Decimal("0.00"),
                "total_allocated": Decimal("0.00"),
                "works_set": set(),
            }

        line_gross = Decimal(str(ld.get("gross_amount", "0.00"))).quantize(CENT)
        line_alloc = Decimal(str(ld.get("allocated_amount", "0.00"))).quantize(CENT)
        groups_dict[g_key]["lines"].append(ld)
        groups_dict[g_key]["total_gross"] += line_gross
        groups_dict[g_key]["total_allocated"] += line_alloc
        groups_dict[g_key]["works_set"].add(w_title)

    # Conversion en liste de groupes triée
    statement_groups: list[dict[str, Any]] = []
    for g_key in sorted(groups_dict.keys()):
        g_data = groups_dict[g_key]
        statement_groups.append({
            "group_key": g_data["group_key"],
            "group_label": g_data["group_label"],
            "total_gross": str(g_data["total_gross"].quantize(CENT)),
            "total_allocated": str(g_data["total_allocated"].quantize(CENT)),
            "works_count": len(g_data["works_set"]),
            "lines": g_data["lines"],
        })

    # Génération du CSV structuré avec sous-totaux par groupe
    csv_header_title = (
        f"# RELEVÉ INDIVIDUEL DE REDEVANCES D'AUTEUR - {publisher_name.upper()} (IPI {publisher_ipi})"
        if not is_en
        else f"# INDIVIDUAL ROYALTY STATEMENT - {publisher_name.upper()} (IPI {publisher_ipi})"
    )
    csv_holder_line = (
        f"# Ayant droit : {holder_state.holder_name} (IPI {holder_state.ipi_number or 'N/A'})"
        if not is_en
        else f"# Right Holder: {holder_state.holder_name} (IPI {holder_state.ipi_number or 'N/A'})"
    )
    csv_period_line = (
        f"# Source : {statement_source} | Période : {period_start} au {period_end} | Regroupement : {group_mode} | Langue : {language}"
        if not is_en
        else f"# Source: {statement_source} | Period: {period_start} to {period_end} | Grouping: {group_mode} | Language: {language}"
    )

    csv_columns = (
        "group,work_title,iswc,right_type,territory,work_group,gross_line_amount,share_pct,allocated_royalty"
        if not is_en
        else "group,work_title,iswc,right_type,territory,audiovisual_project,gross_amount,share_percentage,allocated_amount"
    )

    csv_lines = [
        csv_header_title,
        csv_holder_line,
        csv_period_line,
    ]
    if source_curr != "EUR":
        currency_line = (
            f"# Devise d'origine : {source_curr} | Taux de change appliqué : 1 {source_curr} = {ex_rate} EUR"
            if not is_en
            else f"# Source Currency: {source_curr} | Applied Exchange Rate: 1 {source_curr} = {ex_rate} EUR"
        )
        csv_lines.append(currency_line)
    csv_lines.append(csv_columns)

    for grp in statement_groups:
        grp_lbl = grp["group_label"].replace('"', '""')
        for ld in grp["lines"]:
            csv_lines.append(
                f'"{grp_lbl}",'
                f'"{str(ld.get("work_title", "")).replace(chr(34), chr(34)+chr(34))}",'
                f'"{ld.get("iswc") or ""}",'
                f'"{ld.get("right_type", "DEP")}",'
                f'"{ld.get("territory", "FR")}",'
                f'"{str(ld.get("work_group_title") or "").replace(chr(34), chr(34)+chr(34))}",'
                f'{ld.get("gross_amount", "0.00")},'
                f'{ld.get("share_percentage", "0.00")},'
                f'{ld.get("allocated_amount", "0.00")}'
            )
        if group_mode != "WORK":
            sub_label = f"# SOUS-TOTAL [{grp_lbl}]" if not is_en else f"# SUB-TOTAL [{grp_lbl}]"
            csv_lines.append(f'{sub_label},,,,,,,{grp["total_gross"]},{grp["total_allocated"]}')

    # Synthèse financière dans le CSV
    csv_lines.extend([
        "",
        "SYNTHESE_COMPTE,MONTANT_EUR" if not is_en else "ACCOUNT_SYNTHESIS,AMOUNT_EUR",
        f"{'Royalties Brutes Allouées' if not is_en else 'Gross Royalties Allocated'},{gross_allocated}",
        f"{'Avance Initiale Contractuelle' if not is_en else 'Initial Contractual Advance'},{holder_state.initial_advance}",
        f"{'Déjà Amorti Périodes Précédentes' if not is_en else 'Previously Recouped Balance'},{holder_state.previously_recouped}",
        f"{'Retenu sur Avance (Période)' if not is_en else 'Recouped in Period'},-{recouped_adv}",
        f"{'Solde Avance Restant à Amortir' if not is_en else 'Remaining Unrecouped Advance'},{holder_state.remaining_unrecouped_balance}",
        f"{'Assiette Payable Hors Taxes (Base HT)' if not is_en else 'Taxable Base (Excl. Tax)'},{taxable_ht}",
        f"{f'TVA ({vat_rate}%)' if not is_en else f'VAT ({vat_rate}%)'},{vat_amount}",
        f"{'Net a Payer TTC' if not is_en else 'Net Payable Incl. VAT'},{net_payable_ttc}",
        f"{'Précompte Social Artiste-Auteur (~11,10 %)' if not is_en else 'Social & Tax Withholdings'},-{precompte_social}",
        f"{'Report de Réserve Période Précédente' if not is_en else 'Carried Reserve Balance (Previous)'},+{carried_prev}",
        f"{'Mis en Réserve sous-seuil (< 50 €)' if not is_en else 'Retained in Reserve (< 50 €)'},-{retained_reserve}",
        f"{'NET À PAYER PAR VIREMENT SEPA' if not is_en else 'NET PAYABLE VIA BANK WIRE'},{net_payable}",
    ])

    # Génération du document imprimable formaté (ASCII haute fidélité)
    doc_title = (
        "DÉCOMPTE INDIVIDUEL DE REDEVANCES D'AUTEUR"
        if not is_en
        else "INDIVIDUAL ROYALTY & COPYRIGHT STATEMENT"
    )
    subtitle = (
        f"Période de répartition : {period_start} au {period_end}  •  Source : {statement_source}"
        if not is_en
        else f"Accounting Distribution Period: {period_start} to {period_end}  •  Source: {statement_source}"
    )

    printable_lines = [
        "=" * 80,
        f"  {doc_title}",
        f"  {subtitle}",
        f"  Option d'affichage : {group_mode}  •  Langue : {'FR (Français)' if not is_en else 'EN (English)'}",
    ]
    if source_curr != "EUR":
        printable_lines.append(
            f"  Devise d'origine   : {source_curr} (Taux BCE appliqué : 1 {source_curr} = {ex_rate} EUR)"
            if not is_en
            else f"  Source Currency    : {source_curr} (Applied ECB Rate: 1 {source_curr} = {ex_rate} EUR)"
        )
    printable_lines.extend([
        "=" * 80,
        "",
        "ÉMETTEUR (MAISON D'ÉDITION) :" if not is_en else "PUBLISHER / PAYING ENTITY:",
        f"  Nom / Raison Sociale : {publisher_name}",
        f"  Code IPI Éditeur     : {publisher_ipi}",
        "  Adresse              : 24 Rue de Paradis, 75010 Paris, France",
        "",
        "BÉNÉFICIAIRE (AYANT DROIT) :" if not is_en else "BENEFICIARY / RIGHT HOLDER:",
        f"  Nom & Prénom / Société : {holder_state.holder_name}",
        f"  Rôle & Code IPI        : {holder_state.role or 'AC'} • IPI {holder_state.ipi_number or 'N/A'}",
        f"  Statut Juridique       : {holder_state.entity_type} ({holder_state.legal_form or 'Standard'})",
        f"  Contrat d'Édition      : {holder_state.contract_reference or 'Contrat général de gestion'}",
    ])

    # Mention Succession ou Tiers Payé
    if getattr(holder_state, "payout_redirected", False) and getattr(holder_state, "payout_recipient_name", None):
        printable_lines.extend([
            "",
            "*** REDIRECTION DE PAIEMENT (TIERS MANDATAIRE) ***" if not is_en else "*** PAYMENT REDIRECTION (DESIGNATED THIRD PARTY) ***",
            f"  Paiement mandaté à l'ordre de : {holder_state.payout_recipient_name}" if not is_en else f"  Payment mandated to the order of: {holder_state.payout_recipient_name}",
            f"  IBAN Destinataire : {holder_state.iban or 'À renseigner'} ({holder_state.bic or 'BIC'})" if not is_en else f"  Recipient IBAN: {holder_state.iban or 'To be provided'} ({holder_state.bic or 'BIC'})",
        ])

    if getattr(holder_state, "succession_active", False) and getattr(holder_state, "heirs_distribution", None):
        printable_lines.extend([
            "",
            "*** VENTILATION SUCCESSORALE ENTRE HÉRITIERS (INDIVISION) ***" if not is_en else "*** ESTATE & HEIRSHIP SUCCESSION DISTRIBUTION ***",
            *(
                [
                    f"  • {hr.get('heir_name')} ({hr.get('relationship', 'Héritier')}) — Quote-part : {hr.get('share_pct')} % | Net dévolu : {hr.get('net_payable')} EUR | IBAN : {hr.get('iban', 'N/A')}"
                    for hr in holder_state.heirs_distribution
                ]
                if not is_en
                else [
                    f"  • {hr.get('heir_name')} ({hr.get('relationship', 'Heir')}) — Share: {hr.get('share_pct')} % | Net Payable: {hr.get('net_payable')} EUR | IBAN: {hr.get('iban', 'N/A')}"
                    for hr in holder_state.heirs_distribution
                ]
            ),
        ])

    printable_lines.extend([
        "",
        "-" * 80,
        (
            f"VENTILATION DES DROITS PAR ŒUVRE (REGROUPEMENT : {group_mode})"
            if not is_en
            else f"ROYALTY ALLOCATION BREAKDOWN (GROUPED BY: {group_mode})"
        ),
        "-" * 80,
    ])

    for grp in statement_groups:
        if group_mode != "WORK":
            printable_lines.append("")
            printable_lines.append(f"▶ {grp['group_label'].upper()}")
            printable_lines.append(f"  ({grp['works_count']} œuvre(s) • Sous-total alloué : {grp['total_allocated']} EUR)")

        for ld in grp["lines"]:
            w_tit = str(ld.get("work_title") or "Sans titre")
            w_iswc = ld.get("iswc") or "ISWC N/A"
            w_rt = ld.get("right_type") or "DEP"
            w_terr = ld.get("territory") or "FR"
            w_gross = Decimal(str(ld.get("gross_amount", "0.00"))).quantize(CENT)
            w_pct = Decimal(str(ld.get("share_percentage", "0.00"))).quantize(CENT)
            w_alloc = Decimal(str(ld.get("allocated_amount", "0.00"))).quantize(CENT)

            line_str = (
                f"  • {w_tit:<32} [{w_rt} | {w_terr}] "
                f"Brut: {w_gross:>8.2f} €  x  {w_pct:>5.2f} %  =  {w_alloc:>8.2f} €"
                if not is_en
                else f"  • {w_tit:<32} [{w_rt} | {w_terr}] "
                f"Gross: {w_gross:>8.2f} €  x  {w_pct:>5.2f} %  =  {w_alloc:>8.2f} €"
            )
            printable_lines.append(line_str)

        if group_mode != "WORK":
            printable_lines.append(f"  >> {'Sous-total' if not is_en else 'Sub-total'} {grp['group_key']} : {grp['total_allocated']} EUR")

    printable_lines.extend([
        "",
        "=" * 80,
        "SYNTHÈSE COMPTABLE DÉTERMINISTE (CALCUL STRICT MICRO-CENTIME) :" if not is_en else "DETERMINISTIC FINANCIAL SYNTHESIS (STRICT ACCURACY):",
        "=" * 80,
        f"  1. {'Redevances Brutes Allouées' if not is_en else 'Gross Royalties Allocated'}        : {gross_allocated:>10.2f} EUR",
        f"  2. {'Amortissement sur Avance Récupérable' if not is_en else 'Contractual Advance Recoupment'}   : -{recouped_adv:>10.2f} EUR",
        "  " + "-" * 40,
        f"  3. {'Assiette Payable Hors Taxes (Base HT)' if not is_en else 'Net Taxable Base (Excl. VAT)'}   : {taxable_ht:>10.2f} EUR",
        f"  4. {f'TVA ({vat_rate:.2f} %)' if not is_en else f'VAT ({vat_rate:.2f} %)'}                                : +{vat_amount:>10.2f} EUR",
        f"  5. {'Retenues Sociales & Précompte IRCEC' if not is_en else 'Social & Copyright Withholdings'}   : -{precompte_social:>10.2f} EUR",
        f"  6. {'Report de Réserve Période Précédente' if not is_en else 'Carried Reserve from Previous'}  : +{carried_prev:>10.2f} EUR",
        f"  7. {'Montant mis en réserve (< seuil 50 €)' if not is_en else 'Retained in Reserve (< threshold)'} : -{retained_reserve:>10.2f} EUR",
        "=" * 80,
        f"  {'NET EXIGIBLE À PAYER (EUR)' if not is_en else 'NET PAYABLE AMOUNT (EUR)'}                  : {net_payable:>10.2f} EUR",
        "=" * 80,
        f"  {'Coordonnées Bancaires' if not is_en else 'Bank Details'} : {holder_state.iban or 'IBAN à renseigner'} ({holder_state.bic or 'BIC'})",
        "",
        "MENTIONS LÉGALES & CONFORMITÉ :" if not is_en else "LEGAL NOTICE & COMPLIANCE:",
        *(
            [
                f"  • {holder_state.legal_mention_applied}" if holder_state.legal_mention_applied else "  • Décompte conforme aux dispositions de l'article L. 132-13 du Code de la Propriété Intellectuelle.",
                "  • Calcul déterministe certifié et scellé par Korom Rights Copilot.",
            ]
            if not is_en
            else [
                f"  • {holder_state.legal_mention_applied}" if holder_state.legal_mention_applied else "  • Royalty distribution statement issued in compliance with Intellectual Property legislation.",
                "  • Deterministic accounting calculation certified and sealed by Korom Rights Copilot.",
            ]
        ),
        "=" * 80,
    ])

    safe_holder = holder_state.holder_name.lower().replace(" ", "_")
    return {
        "filename": f"releve_{group_mode.lower()}_{language.lower()}_{safe_holder}_{period_end}.csv",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "publisher_name": publisher_name,
        "publisher_ipi": publisher_ipi,
        "holder_name": holder_state.holder_name,
        "holder_ipi": holder_state.ipi_number,
        "contract_reference": holder_state.contract_reference,
        "period_start": period_start,
        "period_end": period_end,
        "language": language.upper(),
        "source_currency": source_curr,
        "exchange_rate": str(ex_rate),
        "source_gross_royalties_allocated": str(source_gross_allocated) if source_gross_allocated else None,
        "group_by": group_mode,
        "hide_zero_lines": hide_zero_lines,
        "total_lines_count": total_lines_count,
        "filtered_lines_count": len(filtered_lines),
        "gross_royalties_allocated": str(gross_allocated),
        "initial_advance": str(holder_state.initial_advance),
        "previously_recouped": str(holder_state.previously_recouped),
        "recouped_in_period": str(recouped_adv),
        "remaining_unrecouped_balance": str(holder_state.remaining_unrecouped_balance),
        "taxable_base_ht": str(taxable_ht),
        "net_payable_ht": str(taxable_ht),
        "vat_rate_pct": str(vat_rate),
        "vat_amount": str(vat_amount),
        "net_payable_ttc": str(net_payable_ttc),
        "precompte_social": str(precompte_social),
        "previous_reserve_balance": str(carried_prev),
        "retained_in_reserve": str(retained_reserve),
        "net_payable_amount": str(net_payable),
        "groups": statement_groups,
        "line_details": filtered_lines,
        "csv_content": "\n".join(csv_lines),
        "printable_text": "\n".join(printable_lines),
    }
