"""Service de comparaison différentielle déterministe entre le catalogue Korom et la SACEM.

Prend en charge les exports officiels de l'Espace Membre SACEM (.xlsx ou .csv) et les CWR.
Détecte les concordances exactes, les écarts de quotes-parts et les identifiants manquants (US-5.18).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlmodel import Session, select

from app.models.work import Work
from app.schemas.subpublishing import (
    ApplySacemCodesItem,
    ApplySacemCodesResult,
    CatalogDiffItem,
    CatalogDiffReport,
    ComparisonStatus,
    DiscrepancyDetail,
    DiscrepancySeverity,
)
from app.schemas.work import RightHolderSplit
from app.services.catalog_migration_service import (
    _parse_csv_migration_file,
    _parse_cwr_v21_file,
    _parse_sacem_portal_csv,
)
from app.services.xlsx_parser import read_xlsx_as_csv

TWO_PLACES = Decimal("0.01")


def _normalize_title_for_matching(title: str | None) -> str:
    """Normalise un titre pour le matching robuste (minuscules, sans accents, sans BO/THEME entre parenthèses)."""
    if not title:
        return ""
    # Enlever les parenthèses d'alias comme (BO SERIE), (THEME), (EX : LOG OUT)
    clean = re.sub(r"\(.*?\)", "", title)
    # Décomposer les accents (NFKD) et retirer les marques diacritiques
    clean = unicodedata.normalize("NFKD", clean)
    clean = "".join(c for c in clean if not unicodedata.combining(c))
    # Ne garder que les caractères alphanumériques
    clean = re.sub(r"[^a-zA-Z0-9]", "", clean)
    return clean.lower().strip()


def _normalize_iswc(iswc: str | None) -> str | None:
    """Normalise un code ISWC pour comparaison (ex: T-338.589.021-7 -> T3385890217)."""
    if not iswc:
        return None
    raw = iswc.replace("-", "").replace(".", "").replace(" ", "").upper().strip()
    return raw or None


def _extract_sacem_works(raw_data: bytes | str) -> list[dict[str, Any]]:
    """Détecte et extrait les œuvres depuis un classeur .xlsx, un fichier CSV ou un CWR."""
    text_content = ""
    if isinstance(raw_data, bytes):
        if raw_data[:4] == b"PK\x03\x04":
            text_content = read_xlsx_as_csv(raw_data)
        else:
            text_content = raw_data.decode("utf-8", errors="replace")
    else:
        text_content = raw_data

    clean = text_content.lstrip("\ufeff")
    if clean.startswith(("HDR", "GRH", "NWR")):
        return _parse_cwr_v21_file(clean)

    first_line = clean.splitlines()[0] if clean.splitlines() else ""
    if "Code oeuvre" in first_line or "Titre de l" in first_line or "Part DEP" in first_line:
        return _parse_sacem_portal_csv(clean)

    # Fallback générique
    return _parse_csv_migration_file(clean)


def compare_catalog_with_sacem(
    raw_data: bytes | str,
    session: Session,
    entity_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> CatalogDiffReport:
    """Effectue la comparaison différentielle entre l'export SACEM et le catalogue Korom."""
    sacem_works = _extract_sacem_works(raw_data)

    # Récupérer les œuvres de la base Korom
    stmt = select(Work).order_by(Work.title)
    if entity_id:
        stmt = stmt.where((Work.entity_id == entity_id) | (Work.entity_id == None))  # noqa: E711
    if date_from:
        start_dt = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
        stmt = stmt.where(Work.created_at >= start_dt)
    if date_to:
        end_dt = datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc)
        stmt = stmt.where(Work.created_at <= end_dt)

    korom_works = list(session.exec(stmt).all())

    # Indexation de Korom pour recherche rapide
    korom_by_cocv: dict[str, Work] = {}
    korom_by_iswc: dict[str, Work] = {}
    korom_by_norm_title: dict[str, Work] = {}

    for kw in korom_works:
        if kw.sacem_work_code:
            korom_by_cocv[kw.sacem_work_code.strip()] = kw
        norm_iswc = _normalize_iswc(kw.iswc)
        if norm_iswc:
            korom_by_iswc[norm_iswc] = kw
        norm_t = _normalize_title_for_matching(kw.title)
        if norm_t and norm_t not in korom_by_norm_title:
            korom_by_norm_title[norm_t] = kw
        for alt in kw.alternate_titles or []:
            norm_alt = _normalize_title_for_matching(alt)
            if norm_alt and norm_alt not in korom_by_norm_title:
                korom_by_norm_title[norm_alt] = kw

    matched_korom_ids: set[UUID] = set()
    diff_items: list[CatalogDiffItem] = []

    for s_idx, sw in enumerate(sacem_works):
        s_title = sw.get("title", "").strip()
        s_cocv = (sw.get("sacem_work_code") or "").strip() or None
        s_iswc = sw.get("iswc")
        s_norm_iswc = _normalize_iswc(s_iswc)
        s_norm_title = _normalize_title_for_matching(s_title)

        matched_korom: Work | None = None

        if s_cocv and s_cocv in korom_by_cocv:
            matched_korom = korom_by_cocv[s_cocv]
        elif s_norm_iswc and s_norm_iswc in korom_by_iswc:
            matched_korom = korom_by_iswc[s_norm_iswc]
        elif s_norm_title and s_norm_title in korom_by_norm_title:
            matched_korom = korom_by_norm_title[s_norm_title]

        s_splits = [
            sp if isinstance(sp, RightHolderSplit) else RightHolderSplit.model_validate(sp)
            for sp in (sw.get("splits") or [])
        ]

        if matched_korom:
            matched_korom_ids.add(matched_korom.id)
            k_splits = [
                sp if isinstance(sp, RightHolderSplit) else RightHolderSplit.model_validate(sp)
                for sp in (matched_korom.splits or [])
            ]

            discrepancies: list[DiscrepancyDetail] = []
            can_apply_codes = False

            # 1. Vérification du code COCV
            if not matched_korom.sacem_work_code and s_cocv:
                discrepancies.append(
                    DiscrepancyDetail(
                        field="sacem_work_code",
                        severity=DiscrepancySeverity.INFO,
                        korom_value=None,
                        sacem_value=s_cocv,
                        message=f"Code officiel SACEM manquant sur Korom : trouvé {s_cocv} dans l'export SACEM.",
                        can_auto_sync=True,
                    )
                )
                can_apply_codes = True
            elif (
                matched_korom.sacem_work_code
                and s_cocv
                and matched_korom.sacem_work_code.strip() != s_cocv
            ):
                discrepancies.append(
                    DiscrepancyDetail(
                        field="sacem_work_code",
                        severity=DiscrepancySeverity.WARNING,
                        korom_value=matched_korom.sacem_work_code,
                        sacem_value=s_cocv,
                        message=f"Code SACEM divergent : Korom ({matched_korom.sacem_work_code}) vs SACEM ({s_cocv}).",
                        can_auto_sync=True,
                    )
                )
                can_apply_codes = True

            # 2. Vérification de l'ISWC
            k_norm_iswc = _normalize_iswc(matched_korom.iswc)
            if not k_norm_iswc and s_iswc:
                discrepancies.append(
                    DiscrepancyDetail(
                        field="iswc",
                        severity=DiscrepancySeverity.INFO,
                        korom_value=None,
                        sacem_value=s_iswc,
                        message=f"Code ISWC manquant sur Korom : trouvé {s_iswc} dans l'export SACEM.",
                        can_auto_sync=True,
                    )
                )
                can_apply_codes = True
            elif k_norm_iswc and s_norm_iswc and k_norm_iswc != s_norm_iswc:
                discrepancies.append(
                    DiscrepancyDetail(
                        field="iswc",
                        severity=DiscrepancySeverity.WARNING,
                        korom_value=matched_korom.iswc,
                        sacem_value=s_iswc,
                        message=f"Code ISWC divergent : Korom ({matched_korom.iswc}) vs SACEM ({s_iswc}).",
                        can_auto_sync=True,
                    )
                )
                can_apply_codes = True

            # 3. Vérification des parts totales DEP et DRM
            k_total_dep = sum((s.dep_share_pct for s in k_splits), Decimal("0.00"))
            s_total_dep = sum((s.dep_share_pct for s in s_splits), Decimal("0.00"))
            if abs(k_total_dep - s_total_dep) > Decimal("0.05"):
                discrepancies.append(
                    DiscrepancyDetail(
                        field="splits_dep_total",
                        severity=DiscrepancySeverity.ERROR,
                        korom_value=f"{k_total_dep:.2f}%",
                        sacem_value=f"{s_total_dep:.2f}%",
                        message=f"Total DEP différent : Korom ({k_total_dep:.2f}%) vs SACEM ({s_total_dep:.2f}%).",
                    )
                )

            k_total_drm = sum((s.drm_share_pct for s in k_splits), Decimal("0.00"))
            s_total_drm = sum((s.drm_share_pct for s in s_splits), Decimal("0.00"))
            if abs(k_total_drm - s_total_drm) > Decimal("0.05"):
                discrepancies.append(
                    DiscrepancyDetail(
                        field="splits_drm_total",
                        severity=DiscrepancySeverity.ERROR,
                        korom_value=f"{k_total_drm:.2f}%",
                        sacem_value=f"{s_total_drm:.2f}%",
                        message=f"Total DRM différent : Korom ({k_total_drm:.2f}%) vs SACEM ({s_total_drm:.2f}%).",
                    )
                )

            # 4. Vérification détaillée ayant droit par ayant droit
            k_holders = {s.holder_name.upper(): s for s in k_splits}
            s_holders = {s.holder_name.upper(): s for s in s_splits}

            for s_name, s_split in s_holders.items():
                # Chercher par nom partiel ou IPI
                matched_kh: RightHolderSplit | None = k_holders.get(s_name)
                if not matched_kh and s_split.ipi_number:
                    for kh in k_splits:
                        if kh.ipi_number and kh.ipi_number.lstrip("0") == s_split.ipi_number.lstrip("0"):
                            matched_kh = kh
                            break

                if not matched_kh:
                    discrepancies.append(
                        DiscrepancyDetail(
                            field="missing_holder",
                            severity=DiscrepancySeverity.WARNING,
                            korom_value=None,
                            sacem_value=f"{s_split.holder_name} ({s_split.role} - DEP {s_split.dep_share_pct:.2f}%)",
                            message=f"Ayant droit « {s_split.holder_name} » présent sur SACEM mais non identifié dans Korom.",
                        )
                    )
                else:
                    if abs(matched_kh.dep_share_pct - s_split.dep_share_pct) > Decimal("0.05"):
                        discrepancies.append(
                            DiscrepancyDetail(
                                field="holder_dep_share",
                                severity=DiscrepancySeverity.WARNING,
                                korom_value=f"{matched_kh.dep_share_pct:.2f}%",
                                sacem_value=f"{s_split.dep_share_pct:.2f}%",
                                message=f"Part DEP de {matched_kh.holder_name} : Korom ({matched_kh.dep_share_pct:.2f}%) vs SACEM ({s_split.dep_share_pct:.2f}%).",
                            )
                        )

            status = ComparisonStatus.SYNCHRONIZED if not discrepancies else ComparisonStatus.DISCREPANCY
            status_lbl = "Concordance exacte" if status == ComparisonStatus.SYNCHRONIZED else "Écarts détectés"

            diff_items.append(
                CatalogDiffItem(
                    id=f"diff-{matched_korom.id}-{s_idx}",
                    korom_work_id=matched_korom.id,
                    title_korom=matched_korom.title,
                    title_sacem=s_title,
                    sacem_work_code_korom=matched_korom.sacem_work_code,
                    sacem_work_code_sacem=s_cocv,
                    iswc_korom=matched_korom.iswc,
                    iswc_sacem=s_iswc,
                    cotage_korom=matched_korom.cotage_number,
                    splits_korom=k_splits,
                    splits_sacem=s_splits,
                    status=status,
                    status_label=status_lbl,
                    discrepancies=discrepancies,
                    can_apply_sacem_codes=can_apply_codes,
                )
            )
        else:
            # Présente sur SACEM mais non trouvée dans Korom
            diff_items.append(
                CatalogDiffItem(
                    id=f"diff-sacem-only-{s_idx}",
                    korom_work_id=None,
                    title_korom=None,
                    title_sacem=s_title,
                    sacem_work_code_korom=None,
                    sacem_work_code_sacem=s_cocv,
                    iswc_korom=None,
                    iswc_sacem=s_iswc,
                    cotage_korom=None,
                    splits_korom=[],
                    splits_sacem=s_splits,
                    status=ComparisonStatus.SACEM_ONLY,
                    status_label="Présent SACEM uniquement",
                    discrepancies=[
                        DiscrepancyDetail(
                            field="work_missing_in_korom",
                            severity=DiscrepancySeverity.INFO,
                            korom_value=None,
                            sacem_value=s_title,
                            message="Titre répertorié à la SACEM mais absent de la base Korom active.",
                        )
                    ],
                    can_apply_sacem_codes=False,
                )
            )

    # Ajouter les œuvres Korom non trouvées dans l'export SACEM
    for kw in korom_works:
        if kw.id not in matched_korom_ids:
            k_splits = [
                sp if isinstance(sp, RightHolderSplit) else RightHolderSplit.model_validate(sp)
                for sp in (kw.splits or [])
            ]
            diff_items.append(
                CatalogDiffItem(
                    id=f"diff-korom-only-{kw.id}",
                    korom_work_id=kw.id,
                    title_korom=kw.title,
                    title_sacem=None,
                    sacem_work_code_korom=kw.sacem_work_code,
                    sacem_work_code_sacem=None,
                    iswc_korom=kw.iswc,
                    iswc_sacem=None,
                    cotage_korom=kw.cotage_number,
                    splits_korom=k_splits,
                    splits_sacem=[],
                    status=ComparisonStatus.KOROM_ONLY,
                    status_label="Présent Korom uniquement",
                    discrepancies=[
                        DiscrepancyDetail(
                            field="work_missing_in_sacem",
                            severity=DiscrepancySeverity.INFO,
                            korom_value=kw.title,
                            sacem_value=None,
                            message="Œuvre créée dans Korom mais non identifiée dans l'export SACEM (dépôt récent ou nom divergent).",
                        )
                    ],
                    can_apply_sacem_codes=False,
                )
            )

    sync_cnt = sum(1 for item in diff_items if item.status == ComparisonStatus.SYNCHRONIZED)
    disc_cnt = sum(1 for item in diff_items if item.status == ComparisonStatus.DISCREPANCY)
    k_only_cnt = sum(1 for item in diff_items if item.status == ComparisonStatus.KOROM_ONLY)
    s_only_cnt = sum(1 for item in diff_items if item.status == ComparisonStatus.SACEM_ONLY)
    total_cnt = len(diff_items)

    score_pct = (
        Decimal(str(round((sync_cnt / total_cnt) * 100, 2)))
        if total_cnt > 0
        else Decimal("100.00")
    )

    summary_messages = [
        f"{total_cnt} œuvre(s) analysée(s) lors du rapprochement différentiel.",
        f"{sync_cnt} œuvre(s) parfaitement synchronisée(s) (100% conformes).",
        f"{disc_cnt} œuvre(s) avec divergences de clés ou identifiants manquants.",
        f"{k_only_cnt} œuvre(s) locale(s) Korom non trouvée(s) à la SACEM.",
        f"{s_only_cnt} œuvre(s) SACEM absente(s) de Korom.",
    ]

    return CatalogDiffReport(
        total_compared=total_cnt,
        synchronized_count=sync_cnt,
        discrepancy_count=disc_cnt,
        korom_only_count=k_only_cnt,
        sacem_only_count=s_only_cnt,
        health_score_pct=score_pct,
        items=diff_items,
        summary_messages=summary_messages,
    )


def apply_sacem_codes_to_works(
    items: list[ApplySacemCodesItem],
    session: Session,
) -> ApplySacemCodesResult:
    """Met à jour en masse les identifiants officiels SACEM (COCV / ISWC) sur les œuvres Korom."""
    updated_ids: list[UUID] = []
    now = datetime.now(timezone.utc)

    for item in items:
        work = session.get(Work, item.work_id)
        if not work:
            continue

        changed = False
        log_parts = []
        if item.sacem_work_code and work.sacem_work_code != item.sacem_work_code:
            work.sacem_work_code = item.sacem_work_code
            log_parts.append(f"Code SACEM COCV défini : {item.sacem_work_code}")
            changed = True

        if item.iswc and work.iswc != item.iswc:
            work.iswc = item.iswc
            log_parts.append(f"Code ISWC défini : {item.iswc}")
            changed = True

        if changed:
            notes = list(work.timeline_notes or [])
            notes.insert(
                0,
                {
                    "id": str(uuid4()),
                    "author": "Atelier Synchronisation SACEM",
                    "text": f"Identifiants officiels appliqués depuis le bac à sable : {', '.join(log_parts)}.",
                    "created_at": now.isoformat(),
                },
            )
            work.timeline_notes = notes
            work.updated_at = now
            session.add(work)
            updated_ids.append(work.id)

    session.commit()
    return ApplySacemCodesResult(
        updated_works_count=len(updated_ids),
        updated_work_ids=updated_ids,
        messages=[f"{len(updated_ids)} œuvre(s) enrichie(s) avec succès des identifiants officiels SACEM."],
    )
