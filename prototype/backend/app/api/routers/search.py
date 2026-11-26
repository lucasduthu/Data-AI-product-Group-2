"""Router API pour la Recherche Universelle Omnibar (US-5.10)."""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, col, select

from app.core.database import get_session
from app.models.contract import Contract
from app.models.right_holder import RightHolderDirectory
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.schemas.search import (
    UnifiedSearchContractItem,
    UnifiedSearchGroupItem,
    UnifiedSearchHolderItem,
    UnifiedSearchResponse,
    UnifiedSearchWorkItem,
)
from app.services.cwr_validator import validate_work_cwr

router = APIRouter(prefix="/api/v1/search", tags=["Recherche Universelle"])


@router.get("", response_model=UnifiedSearchResponse)
def unified_search(
    q: str = Query(default="", description="Terme de recherche universel"),
    limit_per_category: int = Query(default=8, ge=1, le=50, description="Nombre max de résultats par catégorie"),
    session: Session = Depends(get_session),
) -> UnifiedSearchResponse:
    """Recherche globale multi-entités en temps réel pour l'Omnibar Cmd+K.
    
    Indexe simultanément :
    - Œuvres : titre, sous-titre, ISWC, code SACEM (COCV), cotage, ISRC, interprètes, ayants droit
    - Ayants Droit : nom, nom de scène, IPI, COAD, société, statut fiscal
    - Contrats : référence, cotage, numéro SACEM, cocontractant, éditeur, titres cédés
    - Projets TF1 / Albums : titre du projet, diffuseur, type, référence contrat
    """
    cleaned_query = q.strip()
    if not cleaned_query:
        return UnifiedSearchResponse(query="", total_results=0)

    pattern = f"%{cleaned_query}%"
    lower_query = cleaned_query.lower()

    # 1. Recherche dans les Œuvres (Works)
    work_stmt = (
        select(Work)
        .where(
            col(Work.title).ilike(pattern)
            | col(Work.subtitle).ilike(pattern)
            | col(Work.iswc).ilike(pattern)
            | col(Work.sacem_work_code).ilike(pattern)
            | col(Work.cotage_number).ilike(pattern)
            | col(Work.contract_reference).ilike(pattern)
        )
        .limit(limit_per_category * 2)
    )
    found_works = list(session.exec(work_stmt).all())

    # Recherche complémentaire en mémoire sur les champs JSON (performers, alternate_titles, splits)
    if len(found_works) < limit_per_category:
        all_works = session.exec(select(Work)).all()
        existing_work_ids = {w.id for w in found_works}
        for w in all_works:
            if w.id in existing_work_ids:
                continue
            matches_alt = any(lower_query in alt.lower() for alt in (w.alternate_titles or []))
            matches_perf = any(lower_query in p.lower() for p in (w.performers or []))
            matches_split = any(
                lower_query in (s.get("holder_name", "") or "").lower()
                or lower_query in (s.get("ipi_number", "") or "")
                for s in (w.splits or [])
            )
            if matches_alt or matches_perf or matches_split:
                found_works.append(w)
                if len(found_works) >= limit_per_category:
                    break

    work_items: list[UnifiedSearchWorkItem] = []
    for w in found_works[:limit_per_category]:
        report = validate_work_cwr(
            work_title=w.title,
            splits=w.splits or [],
            iswc=w.iswc,
            work_id=w.id,
        )
        work_items.append(
            UnifiedSearchWorkItem(
                id=w.id,
                title=w.title,
                subtitle=w.subtitle,
                iswc=w.iswc,
                sacem_work_code=w.sacem_work_code,
                cotage_number=w.cotage_number,
                contract_reference=w.contract_reference,
                performers=w.performers or [],
                is_cwr_ready=report.is_cwr_ready,
                sacem_registration_status=w.sacem_registration_status,
            )
        )

    # 2. Recherche dans le Répertoire des Ayants Droit (Right Holders)
    holder_stmt = (
        select(RightHolderDirectory)
        .where(
            col(RightHolderDirectory.full_name).ilike(pattern)
            | col(RightHolderDirectory.stage_name_or_trade_name).ilike(pattern)
            | col(RightHolderDirectory.ipi_number).ilike(pattern)
            | col(RightHolderDirectory.coad_or_isni).ilike(pattern)
            | col(RightHolderDirectory.affiliated_society).ilike(pattern)
        )
        .limit(limit_per_category)
    )
    found_holders = list(session.exec(holder_stmt).all())
    holder_items: list[UnifiedSearchHolderItem] = [
        UnifiedSearchHolderItem(
            id=h.id,
            full_name=h.full_name,
            stage_name_or_trade_name=h.stage_name_or_trade_name,
            primary_role=h.primary_role,
            ipi_number=h.ipi_number,
            entity_type=h.entity_type,
            affiliated_society=h.affiliated_society,
            is_deceased=bool(h.is_deceased),
        )
        for h in found_holders
    ]

    # 3. Recherche dans les Contrats (Contracts)
    contract_stmt = (
        select(Contract)
        .where(
            col(Contract.contract_reference).ilike(pattern)
            | col(Contract.sacem_contract_number).ilike(pattern)
            | col(Contract.counterparty_name).ilike(pattern)
            | col(Contract.publisher_name).ilike(pattern)
        )
        .limit(limit_per_category)
    )
    found_contracts = list(session.exec(contract_stmt).all())

    # Complément sur work_titles JSON
    if len(found_contracts) < limit_per_category:
        all_contracts = session.exec(select(Contract)).all()
        existing_contract_ids = {c.id for c in found_contracts}
        for c in all_contracts:
            if c.id in existing_contract_ids:
                continue
            if any(lower_query in t.lower() for t in (c.work_titles or [])):
                found_contracts.append(c)
                if len(found_contracts) >= limit_per_category:
                    break

    contract_items: list[UnifiedSearchContractItem] = [
        UnifiedSearchContractItem(
            id=c.id,
            contract_reference=c.contract_reference,
            counterparty_name=c.counterparty_name,
            publisher_name=c.publisher_name,
            contract_type=c.contract_type,
            sacem_contract_number=c.sacem_contract_number,
            works_count=len(c.work_titles or []),
        )
        for c in found_contracts[:limit_per_category]
    ]

    # 4. Recherche dans les Projets TF1 & Albums (WorkGroups)
    group_stmt = (
        select(WorkGroup)
        .where(
            col(WorkGroup.name).ilike(pattern)
            | col(WorkGroup.broadcaster_or_client).ilike(pattern)
            | col(WorkGroup.production_company).ilike(pattern)
            | col(WorkGroup.contract_reference).ilike(pattern)
        )
        .limit(limit_per_category)
    )
    found_groups = list(session.exec(group_stmt).all())
    
    group_items: list[UnifiedSearchGroupItem] = []
    for g in found_groups:
        links_count = len(
            session.exec(select(WorkGroupLink).where(WorkGroupLink.work_group_id == g.id)).all()
        )
        group_items.append(
            UnifiedSearchGroupItem(
                id=g.id,
                name=g.name,
                group_type=g.group_type,
                broadcaster_or_client=g.broadcaster_or_client,
                contract_reference=g.contract_reference,
                works_count=links_count,
            )
        )

    total = len(work_items) + len(holder_items) + len(contract_items) + len(group_items)

    return UnifiedSearchResponse(
        query=cleaned_query,
        total_results=total,
        works=work_items,
        holders=holder_items,
        contracts=contract_items,
        groups=group_items,
    )
