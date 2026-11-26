import re
import unicodedata
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from typing import Any, Literal
from uuid import UUID

from app.schemas.royalty import AdvanceRecoupmentState, HolderWorkBreakdown, RoyaltyRunReport
from app.schemas.statement import DeterministicSplitAllocation
from app.schemas.work import RightHolderSplit

CENT = Decimal("0.01")
MICRO_CENT = Decimal("0.000001")


def normalize_holder_identity_name(name: str) -> str:
    """Normalise un nom d'ayant droit (sans accents, minuscule, tokens triés) pour éviter les échecs 'Nom Prénom' vs 'Prénom Nom'."""
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFKD", name.lower().strip())
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    tokens = [t for t in re.split(r"[^a-z0-9]+", without_accents) if t]
    return " ".join(sorted(tokens))


def normalize_ipi_code(ipi_number: str | None) -> str | None:
    """Extrait les chiffres canoniques d'un code IPI (9 à 11 chiffres)."""
    if not ipi_number:
        return None
    digits = "".join(ch for ch in str(ipi_number) if ch.isdigit())
    return digits.zfill(11) if len(digits) >= 9 else None


def resolve_canonical_holder_key(
    holder_name: str,
    ipi_number: str | None = None,
    right_holder_id: UUID | str | None = None,
) -> str:
    """Retourne une clé d'identité canonique déterministe pour relier Œuvres, Contrats, Avances et Annuaire."""
    if right_holder_id:
        return f"id:{str(right_holder_id).lower()}"
    norm_ipi = normalize_ipi_code(ipi_number)
    if norm_ipi:
        return f"ipi:{norm_ipi}"
    return f"name:{normalize_holder_identity_name(holder_name)}"


def _distribute_by_largest_remainder(
    target_total: Decimal,
    exact_amounts: list[Decimal],
    weights: list[Decimal],
    unit: Decimal,
) -> list[Decimal]:
    """Algorithme de Hare-Niemeyer (Méthode du Plus Fort Reste / Largest Remainder Method).

    Garantit que la somme des montants arrondis au pas `unit` (0.01 ou 0.000001) est strictement
    égale à `target_total`, en distribuant chaque unité résiduelle unitairement aux parts ayant
    le plus grand reste fractionnaire (sans biais cumulatif vers l'actionnaire majoritaire).
    """
    if not exact_amounts:
        return []

    quantized_target = target_total.quantize(unit, rounding=ROUND_HALF_UP)
    floored = [amt.quantize(unit, rounding=ROUND_DOWN) for amt in exact_amounts]
    remainders = [exact_amounts[i] - floored[i] for i in range(len(exact_amounts))]

    current_sum = sum(floored, Decimal("0"))
    diff = quantized_target - current_sum
    steps = int((diff / unit).to_integral_value(rounding=ROUND_HALF_UP))

    if steps > 0:
        ranked_indices = sorted(
            range(len(exact_amounts)),
            key=lambda i: (remainders[i], weights[i], -i),
            reverse=True,
        )
        for k in range(steps):
            idx = ranked_indices[k % len(ranked_indices)]
            floored[idx] = (floored[idx] + unit).quantize(unit)
    elif steps < 0:
        ranked_indices = sorted(
            range(len(exact_amounts)),
            key=lambda i: (remainders[i], weights[i], -i),
        )
        for k in range(abs(steps)):
            idx = ranked_indices[k % len(ranked_indices)]
            if floored[idx] >= unit:
                floored[idx] = (floored[idx] - unit).quantize(unit)

    return floored


def calculate_line_allocations(
    gross_amount: Decimal,
    splits: list[RightHolderSplit | dict[str, Any]],
    right_type: Literal["DEP", "DRM", "SYNC", "PHONO"] = "DEP",
) -> list[DeterministicSplitAllocation]:
    """Calcule de manière 100 % déterministe la répartition d'une ligne de relevé validée.

    - Préserve les micro-redevances de streaming jusqu'à 6 décimales (`0.000001 €`) dans `exact_allocated_amount`
      et sur `allocated_amount` dès que la ligne comporte des sous-centimes (ex: `0.000412 €`).
    - Applique la Méthode du Plus Fort Reste (Largest Remainder Method) lorsque la somme des parts vaut 100.00 %.
    """
    raw_gross = Decimal(str(gross_amount))
    gross_6d = raw_gross.quantize(MICRO_CENT, rounding=ROUND_HALF_UP)
    is_whole_cents = gross_6d == gross_6d.quantize(CENT, rounding=ROUND_HALF_UP)
    unit = CENT if is_whole_cents else MICRO_CENT
    gross = gross_6d.quantize(unit, rounding=ROUND_HALF_UP)

    parsed_splits: list[RightHolderSplit] = [
        s if isinstance(s, RightHolderSplit) else RightHolderSplit.model_validate(s)
        for s in splits
    ]
    if not parsed_splits or gross_6d == Decimal("0.000000"):
        return []

    allocations: list[DeterministicSplitAllocation] = []
    exact_shares: list[Decimal] = []
    pct_weights: list[Decimal] = []

    for split in parsed_splits:
        if right_type == "DRM":
            pct = split.drm_share_pct if split.drm_share_pct > Decimal("0.00") else split.share_percentage
        elif right_type == "SYNC":
            pct = split.sync_share_pct if split.sync_share_pct > Decimal("0.00") else split.drm_share_pct
        elif right_type == "PHONO":
            pct = split.phono_share_pct if split.phono_share_pct > Decimal("0.00") else split.drm_share_pct
        else:
            pct = split.dep_share_pct if split.dep_share_pct > Decimal("0.00") else split.share_percentage

        role_str = split.role.value if hasattr(split.role, "value") else str(split.role)
        exact_val = gross_6d * pct / Decimal("100.00")
        exact_shares.append(exact_val)
        pct_weights.append(pct)

        alloc = DeterministicSplitAllocation.compute(
            holder_name=split.holder_name,
            gross_amount=gross_6d,
            share_percentage=pct,
            role=role_str,
            ipi_number=split.ipi_number,
            right_type=right_type,
            right_holder_id=split.right_holder_id,
            precision=unit,
        )
        allocations.append(alloc)

    total_pct = sum(pct_weights, Decimal("0.00"))
    if total_pct == Decimal("100.00") and allocations:
        distributed = _distribute_by_largest_remainder(
            target_total=gross,
            exact_amounts=exact_shares,
            weights=pct_weights,
            unit=unit,
        )
        for idx, val in enumerate(distributed):
            allocations[idx].allocated_amount = val
            allocations[idx].net_payable_amount = val

    return allocations


def finalize_period_holder_totals(
    exact_holder_totals: dict[str, Decimal],
    target_validated_gross: Decimal,
) -> dict[str, Decimal]:
    """Arrondit les totaux périodiques haute précision (6 décimales) par ayant droit à 0.01 €
    via la Méthode du Plus Fort Reste (Largest Remainder Method) uniquement en fin de période.
    """
    if not exact_holder_totals:
        return {}
    keys = list(exact_holder_totals.keys())
    exact_vals = [exact_holder_totals[k] for k in keys]
    total_exact_allocated = sum(exact_vals, Decimal("0.000000"))
    target_cents = target_validated_gross.quantize(CENT, rounding=ROUND_HALF_UP)

    # Si toutes les lignes validées avaient des clés totalisant 100%, on réconcilie au centime près sur target_cents
    if abs(total_exact_allocated - target_validated_gross) <= Decimal("0.05"):
        rounded_vals = _distribute_by_largest_remainder(
            target_total=target_cents,
            exact_amounts=exact_vals,
            weights=exact_vals,
            unit=CENT,
        )
    else:
        rounded_vals = [v.quantize(CENT, rounding=ROUND_HALF_UP) for v in exact_vals]

    return {keys[i]: rounded_vals[i] for i in range(len(keys))}


DEFAULT_STATEMENT_MESSAGES: dict[str, str] = {
    "paid_fr": "Règlement effectué par virement bancaire sous réserve d'encaissement et déduction faite des cotisations sociales et précomptes légaux.",
    "paid_en": "Payment processed by bank transfer subject to clearance and deduction of statutory social contributions.",
    "below_threshold_fr": "Le montant net étant inférieur au seuil de paiement minimum de {threshold} €, ce solde est conservé en réserve et reporté au décompte de la période suivante.",
    "below_threshold_en": "As the net amount is below the minimum payment threshold of {threshold} €, this balance is held in reserve and carried forward to the next period.",
    "recoupment_fr": "Solde débiteur reporté à nouveau sur les prochaines répartitions conformément aux conditions particulières du contrat de cession.",
    "recoupment_en": "Debit balance carried forward to upcoming distributions in accordance with the terms of the publishing agreement.",
}


def apply_advance_recoupment(
    holder_name: str,
    gross_royalties_allocated: Decimal,
    initial_advance: Decimal,
    previously_recouped: Decimal,
    previous_reserve_balance: Decimal = Decimal("0.00"),
    min_payment_threshold: Decimal = Decimal("50.00"),
    statement_messages: dict[str, str] | None = None,
    role: str | None = None,
    ipi_number: str | None = None,
    contract_id: UUID | None = None,
    contract_reference: str | None = None,
    right_holder_id: UUID | None = None,
    entity_type: str = "PERSONNE_PHYSIQUE",
    legal_form: str | None = None,
    siret: str | None = None,
    vat_number: str | None = None,
    vat_applicable: bool = False,
    vat_rate_pct: Decimal = Decimal("0.00"),
    ircec_precompte_applicable: bool = True,
    urssaf_dispense_certificate: bool = False,
    iban: str | None = None,
    bic: str | None = None,
    works_count: int = 0,
    works_breakdown: list[HolderWorkBreakdown] | None = None,
) -> AdvanceRecoupmentState:
    """Calcule de manière 100 % déterministe l'amortissement d'avance, le seuil de paiement et la fiscalité.

    - Solde amortissable avant décompte = max(0, initial_advance - previously_recouped)
    - Montant retenu sur la période = min(gross_royalties_allocated, solde amortissable)
    - Nouveau solde restant = solde amortissable - montant retenu
    - Assiette HT imposable = gross_royalties_allocated - montant retenu
    - Si Personne Physique sans dispense URSSAF : précompte social auteur français (~11,10 % brut payable)
    - Si Société ou Dispense : 0 % précompte, application de la TVA si assujetti
    - Seuil de paiement minimum (min_payment_threshold, ex 50 €) :
      - Si en cours d'amortissement (avance restante > 0) -> RECOUPING (solde débiteur reporté à nouveau)
      - Si net exigible (< seuil) -> BELOW_THRESHOLD (conservé en réserve et reporté à nouveau)
      - Si net exigible (>= seuil) -> PAYABLE (autorisé au règlement avec report de réserve préalable apuré)
    """
    gross = Decimal(str(gross_royalties_allocated)).quantize(CENT, rounding=ROUND_HALF_UP)
    init_adv = Decimal(str(initial_advance)).quantize(CENT, rounding=ROUND_HALF_UP)
    prev_rec = Decimal(str(previously_recouped)).quantize(CENT, rounding=ROUND_HALF_UP)
    prev_reserve = Decimal(str(previous_reserve_balance)).quantize(CENT, rounding=ROUND_HALF_UP)
    threshold = Decimal(str(min_payment_threshold)).quantize(CENT, rounding=ROUND_HALF_UP)

    unrecouped_before = max(Decimal("0.00"), (init_adv - prev_rec).quantize(CENT))
    recouped_now = min(gross, unrecouped_before).quantize(CENT)
    remaining_after = (unrecouped_before - recouped_now).quantize(CENT)
    taxable_base_ht = (gross - recouped_now).quantize(CENT)

    # Calcul de la TVA
    vat_pct = Decimal(str(vat_rate_pct)).quantize(CENT) if vat_applicable else Decimal("0.00")
    vat_amount = (
        (taxable_base_ht * vat_pct / Decimal("100.00")).quantize(CENT, rounding=ROUND_HALF_UP)
        if vat_applicable and vat_pct > Decimal("0.00")
        else Decimal("0.00")
    )

    # Calcul déterministe du Précompte Social Artiste-Auteur français (CSG/CRDS + IRCEC/CFP ~ 11,10 %)
    is_personne_physique = str(entity_type).upper() == "PERSONNE_PHYSIQUE"
    if is_personne_physique and ircec_precompte_applicable and not urssaf_dispense_certificate:
        precompte = (taxable_base_ht * Decimal("0.1110")).quantize(CENT, rounding=ROUND_HALF_UP)
    elif (role or "").upper() in {"A", "C", "AC"} and is_personne_physique and not urssaf_dispense_certificate:
        precompte = (taxable_base_ht * Decimal("0.0915")).quantize(CENT, rounding=ROUND_HALF_UP)
    else:
        precompte = Decimal("0.00")

    # Net périodique après fiscalité
    period_net = (taxable_base_ht + vat_amount).quantize(CENT)

    # Messages légaux et templates configurés
    msgs = {**DEFAULT_STATEMENT_MESSAGES, **(statement_messages or {})}

    # Gestion de la clôture comptable, seuil minimum de paiement et reports à nouveau
    if remaining_after > Decimal("0.00"):
        # Avance non amortie : solde débiteur reporté à nouveau
        payout_status = "RECOUPING"
        is_below_threshold = False
        retained_in_reserve = Decimal("0.00")
        carried_forward_to_next = remaining_after
        net_payable = Decimal("0.00")
        legal_mention = msgs.get("recoupment_fr", DEFAULT_STATEMENT_MESSAGES["recoupment_fr"])
    else:
        # Avance amortie (ou sans avance) : cumul avec la réserve reportée de la période précédente
        total_available = (period_net + prev_reserve).quantize(CENT)

        if total_available == Decimal("0.00"):
            payout_status = "ZERO_BALANCE"
            is_below_threshold = False
            retained_in_reserve = Decimal("0.00")
            carried_forward_to_next = Decimal("0.00")
            net_payable = Decimal("0.00")
            legal_mention = None
        elif total_available < threshold:
            payout_status = "BELOW_THRESHOLD"
            is_below_threshold = True
            retained_in_reserve = total_available
            carried_forward_to_next = total_available
            net_payable = Decimal("0.00")
            raw_tmpl = msgs.get("below_threshold_fr", DEFAULT_STATEMENT_MESSAGES["below_threshold_fr"])
            legal_mention = raw_tmpl.replace("{threshold}", f"{threshold:.2f}")
        else:
            payout_status = "PAYABLE"
            is_below_threshold = False
            retained_in_reserve = Decimal("0.00")
            carried_forward_to_next = Decimal("0.00")
            net_payable = total_available
            legal_mention = msgs.get("paid_fr", DEFAULT_STATEMENT_MESSAGES["paid_fr"])

    status_str = (
        "FACTURE FACTUR-X 2026 (SOCIÉTÉ)"
        if str(entity_type).upper() == "SOCIETE"
        else "NOTE DROITS D'AUTEUR (DISPENSE BNC)"
        if urssaf_dispense_certificate
        else "NOTE DROITS D'AUTEUR (PRÉCOMPTE SOCIAL)"
    )

    return AdvanceRecoupmentState(
        right_holder_id=right_holder_id,
        holder_name=holder_name,
        role=role,
        ipi_number=ipi_number,
        contract_id=contract_id,
        contract_reference=contract_reference,
        entity_type=entity_type,
        legal_form=legal_form,
        siret=siret,
        vat_number=vat_number,
        vat_applicable=vat_applicable,
        vat_rate_pct=vat_pct,
        vat_amount=vat_amount,
        ircec_precompte_applicable=ircec_precompte_applicable,
        urssaf_dispense_certificate=urssaf_dispense_certificate,
        iban=iban,
        bic=bic,
        gross_royalties_allocated=gross,
        initial_advance=init_adv,
        previously_recouped=prev_rec,
        recouped_in_period=recouped_now,
        remaining_unrecouped_balance=remaining_after,
        taxable_base_ht=taxable_base_ht,
        precompte_ircec_amount=precompte,
        precompte_social_amount=precompte,
        previous_reserve_balance=prev_reserve,
        min_payment_threshold=threshold,
        is_below_payment_threshold=is_below_threshold,
        retained_in_reserve=retained_in_reserve,
        carried_forward_to_next=carried_forward_to_next,
        payout_status=payout_status,
        legal_mention_applied=legal_mention,
        net_payable_amount=net_payable,
        e_invoicing_status=status_str,
        works_count=works_count or len(works_breakdown or []),
        works_breakdown=works_breakdown or [],
    )


__all__ = [
    "AdvanceRecoupmentState",
    "CENT",
    "DEFAULT_STATEMENT_MESSAGES",
    "MICRO_CENT",
    "RoyaltyRunReport",
    "apply_advance_recoupment",
    "calculate_line_allocations",
    "finalize_period_holder_totals",
    "normalize_holder_identity_name",
    "normalize_ipi_code",
    "resolve_canonical_holder_key",
]
