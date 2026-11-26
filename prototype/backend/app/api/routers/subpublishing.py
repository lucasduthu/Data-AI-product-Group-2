"""Router FastAPI pour le Bac à Sable de Comparaison Différentielle SACEM vs Korom
et les exports de livraison Sous-Édition Internationale (US-5.18).
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.publishing_entity import PublishingEntity
from app.models.work import Work
from app.models.workspace_settings import WorkspaceSettings
from app.schemas.subpublishing import (
    ApplySacemCodesPayload,
    ApplySacemCodesResult,
    CatalogDiffReport,
    SubpublishingDeliveryPayload,
)
from app.services.catalog_comparator import (
    apply_sacem_codes_to_works,
    compare_catalog_with_sacem,
)
from app.services.cwr_exporter import generate_cwr_v21_content
from app.services.xlsx_exporter import generate_subpublishing_delivery_xlsx

router = APIRouter(prefix="/api/v1/subpublishing", tags=["Sous-Édition & Bac à Sable SACEM"])


def _get_active_publisher_info(session: Session, entity_id: UUID | None = None) -> tuple[str, str]:
    """Résout le nom de l'éditeur et l'IPI déclarant selon l'entité active."""
    if entity_id:
        ent = session.get(PublishingEntity, entity_id)
        if ent:
            return ent.name, ent.sacem_ipi or "00891234567"

    ws = session.exec(select(WorkspaceSettings)).first()
    if ws and ws.publisher_name:
        return ws.publisher_name, ws.publisher_ipi or "00891234567"

    return "Éditions Solstices Music", "00891234567"


@router.post("/compare-sacem", response_model=CatalogDiffReport)
async def compare_sacem_with_catalog(
    file: UploadFile = File(...),
    entity_id: UUID | None = Form(default=None),
    date_from: date | None = Form(default=None),
    date_to: date | None = Form(default=None),
    session: Session = Depends(get_session),
) -> CatalogDiffReport:
    """Analyse un fichier d'export SACEM (.xlsx, .csv ou CWR) et le compare aux œuvres de Korom."""
    try:
        raw_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier téléversé : {exc}")

    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Le fichier téléversé est vide.")

    try:
        report = compare_catalog_with_sacem(
            raw_data=raw_bytes,
            session=session,
            entity_id=entity_id,
            date_from=date_from,
            date_to=date_to,
        )
        return report
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Erreur lors du traitement différentiel : {exc}")


@router.post("/apply-sacem-codes", response_model=ApplySacemCodesResult)
def apply_sacem_codes(
    payload: ApplySacemCodesPayload,
    session: Session = Depends(get_session),
) -> ApplySacemCodesResult:
    """Enrichit en 1 clic les œuvres Korom avec les identifiants officiels SACEM (COCV / ISWC)."""
    return apply_sacem_codes_to_works(payload.items, session)


@router.post("/export-delivery-xlsx")
def export_delivery_xlsx(
    payload: SubpublishingDeliveryPayload,
    session: Session = Depends(get_session),
) -> Response:
    """Génère un classeur Excel .xlsx normé pour la livraison d'un catalogue à un sous-éditeur international."""
    if not payload.work_ids:
        raise HTTPException(status_code=400, detail="Aucune œuvre sélectionnée pour la livraison.")

    stmt = select(Work).where(Work.id.in_(payload.work_ids)).order_by(Work.title)
    works = list(session.exec(stmt).all())
    if not works:
        raise HTTPException(status_code=404, detail="Aucune œuvre correspondante trouvée en base.")

    pub_name, pub_ipi = _get_active_publisher_info(session)

    xlsx_bytes = generate_subpublishing_delivery_xlsx(
        works=works,
        sub_publisher_name=payload.sub_publisher_name,
        territory=payload.territory,
        delivery_ref=payload.delivery_reference,
        publisher_name=pub_name,
        publisher_ipi=pub_ipi,
        notes=payload.notes,
    )

    clean_ref = "".join(c for c in payload.delivery_reference if c.isalnum() or c in ("-", "_"))
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"LIVRAISON_SOUS_EDITION_{clean_ref or 'EXPORT'}_{now_str}.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/export-delivery-cwr")
def export_delivery_cwr(
    payload: SubpublishingDeliveryPayload,
    session: Session = Depends(get_session),
) -> dict:
    """Génère un fichier d'échange CWR v2.1 dédié à la livraison d'un catalogue sous-éditeur."""
    if not payload.work_ids:
        raise HTTPException(status_code=400, detail="Aucune œuvre sélectionnée pour la livraison.")

    stmt = select(Work).where(Work.id.in_(payload.work_ids)).order_by(Work.title)
    works = list(session.exec(stmt).all())
    if not works:
        raise HTTPException(status_code=404, detail="Aucune œuvre correspondante trouvée en base.")

    pub_name, pub_ipi = _get_active_publisher_info(session)

    cwr_result = generate_cwr_v21_content(
        works=works,
        sender_ipi=pub_ipi,
        sender_name=pub_name,
    )

    clean_ref = "".join(c for c in payload.delivery_reference if c.isalnum() or c in ("-", "_"))
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    cwr_result["filename"] = f"CW26{now_str[-4:]}001_SUB_{clean_ref or 'DELIV'}.V21"
    cwr_result["sub_publisher"] = {
        "name": payload.sub_publisher_name,
        "ipi": payload.sub_publisher_ipi,
        "territory": payload.territory,
        "reference": payload.delivery_reference,
    }

    return cwr_result
