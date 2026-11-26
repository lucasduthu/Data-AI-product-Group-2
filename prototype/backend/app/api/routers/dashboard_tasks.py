from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.entity_utils import resolve_entity_filter
from app.models.publishing_entity import PublishingEntity
from app.models.task import DashboardTask
from app.schemas.task import (
    DashboardDeadlinesReport,
    DashboardTaskCreate,
    DashboardTaskRead,
    DashboardTaskUpdate,
    SacemDistributionInfo,
    SubpublisherDeadlineInfo,
)

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard & Todo List"])


DEFAULT_SEED_TASKS = [
    {
        "title": "Exporter le lot CWR pour les œuvres prêtes à déposer",
        "category": "SACEM",
        "priority": "HIGH",
        "due_date": "Semaine en cours",
    },
    {
        "title": "Compléter les identifiants IPI manquants sur les nouveaux contrats",
        "category": "CONTRAT",
        "priority": "HIGH",
        "due_date": "Avant prochain CWR",
    },
    {
        "title": "Vérifier la réception des statements des sous-éditeurs allemands (GEMA)",
        "category": "RELEVE",
        "priority": "NORMAL",
        "due_date": "31 Mars",
    },
    {
        "title": "Auditer les quotes-parts DRM & DEP sur les séries TV TF1",
        "category": "CATALOGUE",
        "priority": "NORMAL",
        "due_date": "Fin de mois",
    },
]


@router.get("/tasks", response_model=list[DashboardTaskRead])
def list_dashboard_tasks(
    entity_id: UUID | None = Query(None, description="Filtrer par entité éditoriale"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> list[DashboardTaskRead]:
    """Récupère la liste des tâches du tableau de bord (avec auto-initialisation si vierge)."""
    target_entity_id, is_default_entity = resolve_entity_filter(session, entity_id, x_entity_id)

    query = select(DashboardTask)
    if target_entity_id:
        if is_default_entity:
            query = query.where((DashboardTask.entity_id == target_entity_id) | (DashboardTask.entity_id == None))  # noqa: E711
        else:
            query = query.where(DashboardTask.entity_id == target_entity_id)

    tasks = session.exec(
        query.order_by(DashboardTask.is_completed.asc(), DashboardTask.created_at.desc())
    ).all()

    if not tasks:
        # Initialisation bienveillante avec les rappels métier par défaut
        now = datetime.now(timezone.utc)
        for seed_data in DEFAULT_SEED_TASKS:
            t = DashboardTask(
                title=seed_data["title"],
                category=seed_data["category"],
                priority=seed_data["priority"],
                due_date=seed_data["due_date"],
                is_completed=False,
                entity_id=target_entity_id,
                created_at=now,
                updated_at=now,
            )
            session.add(t)
        session.commit()
        tasks = session.exec(
            query.order_by(DashboardTask.is_completed.asc(), DashboardTask.created_at.desc())
        ).all()

    return list(tasks)


@router.post("/tasks", response_model=DashboardTaskRead, status_code=status.HTTP_201_CREATED)
def create_dashboard_task(
    payload: DashboardTaskCreate,
    entity_id: UUID | None = Query(None, description="Entité éditoriale cible"),
    x_entity_id: str | None = Header(None, alias="X-Entity-Id"),
    session: Session = Depends(get_session),
) -> DashboardTaskRead:
    """Crée une nouvelle tâche manuelle sur la Todo List du tableau de bord."""
    target_entity_id, _ = resolve_entity_filter(session, entity_id, x_entity_id)
    if not target_entity_id:
        default_ent = session.exec(select(PublishingEntity).where(PublishingEntity.is_default == True)).first()  # noqa: E712
        if default_ent:
            target_entity_id = default_ent.id

    now = datetime.now(timezone.utc)
    task = DashboardTask(
        title=payload.title.strip(),
        category=(payload.category or "AUTRE").strip().upper(),
        priority=(payload.priority or "NORMAL").strip().upper(),
        due_date=payload.due_date.strip() if payload.due_date else None,
        is_completed=False,
        entity_id=target_entity_id,
        created_at=now,
        updated_at=now,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.patch("/tasks/{task_id}/toggle", response_model=DashboardTaskRead)
def toggle_dashboard_task(task_id: UUID, session: Session = Depends(get_session)) -> DashboardTaskRead:
    """Bascule l'état d'accomplissement (terminé / en cours) d'une tâche."""
    task = session.get(DashboardTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")

    task.is_completed = not task.is_completed
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=DashboardTaskRead)
def update_dashboard_task(
    task_id: UUID, payload: DashboardTaskUpdate, session: Session = Depends(get_session)
) -> DashboardTaskRead:
    """Met à jour une tâche existante."""
    task = session.get(DashboardTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.category is not None:
        task.category = payload.category.strip().upper()
    if payload.priority is not None:
        task.priority = payload.priority.strip().upper()
    if payload.due_date is not None:
        task.due_date = payload.due_date.strip() or None
    if payload.is_completed is not None:
        task.is_completed = payload.is_completed

    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard_task(task_id: UUID, session: Session = Depends(get_session)) -> None:
    """Supprime une tâche de la Todo List."""
    task = session.get(DashboardTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")

    session.delete(task)
    session.commit()


@router.get("/deadlines", response_model=DashboardDeadlinesReport)
def get_dashboard_deadlines() -> DashboardDeadlinesReport:
    """Calcule l'échéancier officiel des 4 répartitions SACEM et des statements de sous-édition."""
    today = date.today()
    current_year = today.year

    # Les 4 dates pivots de répartition SACEM :
    # 15 Janvier, 15 Avril, 15 Juillet, 15 Octobre
    candidates = [
        (date(current_year, 1, 15), "Répartition SACEM de Janvier", "Droits d'exécution étrangers & streaming DSP Q3"),
        (date(current_year, 4, 15), "Répartition SACEM d'Avril", "Droits Phonographiques (DRM), Télévision & Radio"),
        (date(current_year, 7, 15), "Répartition SACEM de Juillet", "Droits Généraux, Concerts, Festivals & Spectacle vivant"),
        (date(current_year, 10, 15), "Répartition SACEM d'Octobre", "Télévision, Radio & Copie Privée sonore"),
        (date(current_year + 1, 1, 15), "Répartition SACEM de Janvier", "Droits d'exécution étrangers & streaming DSP Q3"),
        (date(current_year + 1, 4, 15), "Répartition SACEM d'Avril", "Droits Phonographiques (DRM), Télévision & Radio"),
    ]

    # Détection de la prochaine répartition dans le futur
    future_candidates = [c for c in candidates if c[0] >= today]
    next_dist = future_candidates[0] if future_candidates else candidates[0]
    next_days = (next_dist[0] - today).days

    sacem_list: list[SacemDistributionInfo] = []
    for d, name, desc in future_candidates[:4]:
        is_next = (d == next_dist[0])
        sacem_list.append(
            SacemDistributionInfo(
                name=f"{name} {d.year}",
                target_date=d.strftime("%d/%m/%Y"),
                days_remaining=(d - today).days,
                rights_covered=desc,
                is_next=is_next,
            )
        )

    next_sacem = SacemDistributionInfo(
        name=f"{next_dist[1]} {next_dist[0].year}",
        target_date=next_dist[0].strftime("%d/%m/%Y"),
        days_remaining=next_days,
        rights_covered=next_dist[2],
        is_next=True,
    )

    subpub_deadlines = [
        SubpublisherDeadlineInfo(
            partner="Sous-éditeurs Territoires GAS (GEMA, AKM, SUISA)",
            territory="Allemagne, Autriche, Suisse",
            expected_period="31 Mars (Semestre 2)",
            notes="Décomptes semestriels radio/TV & streaming",
        ),
        SubpublisherDeadlineInfo(
            partner="Sous-éditeurs Royaume-Uni & Irlande (PRS, MCPS, IMRO)",
            territory="UK & Irlande",
            expected_period="30 Avril (Semestre 2)",
            notes="Décomptes exécution publique & mécanique",
        ),
        SubpublisherDeadlineInfo(
            partner="Sous-éditeurs Amérique du Nord (BMI, ASCAP, SOCAN)",
            territory="États-Unis & Canada",
            expected_period="30 Septembre (Semestre 1)",
            notes="Décomptes semestriels audiovisuels & synchro",
        ),
        SubpublisherDeadlineInfo(
            partner="Sous-éditeurs Amérique Latine & Asie (UBC, JASRAC)",
            territory="Brésil, Japon, Asie-Pacifique",
            expected_period="31 Octobre (Semestre 1)",
            notes="Décomptes consolidés annuels ou semestriels",
        ),
    ]

    return DashboardDeadlinesReport(
        current_date=today.strftime("%d/%m/%Y"),
        next_sacem_distribution=next_sacem,
        all_sacem_distributions=sacem_list,
        subpublisher_deadlines=subpub_deadlines,
    )
