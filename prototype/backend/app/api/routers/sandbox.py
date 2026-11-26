from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlmodel import Session, delete, select

from app.api.routers.settings import get_or_create_workspace_settings
from app.core.database import get_session
from app.models.audit_log import AuditLog
from app.models.contract import AdvanceLedger, Contract, RoyaltyLedgerEntry
from app.models.publishing_entity import PublishingEntity
from app.models.right_holder import RightHolderDirectory
from app.models.statement import RoyaltyStatement, StatementLine
from app.models.work import Work
from app.models.work_group import WorkGroup, WorkGroupLink
from app.models.workspace_settings import WorkspaceSettings
from app.schemas.common import ValidationStatus
from app.schemas.contract import ExploitationType
from app.schemas.statement import StatementLineCreate
from app.services.embedding_service import compute_text_embedding
from app.services.royalty_engine import calculate_line_allocations
from app.services.statement_matcher import match_statement_line_to_catalog

router = APIRouter(prefix="/api/v1/sandbox", tags=["Mode Démonstration & Bac à Sable"])


class SandboxStatusResponse(BaseModel):
    """État actuel des volumétries du bac à sable et de l'onboarding."""

    total_works: int
    total_contracts: int
    total_holders: int
    total_work_groups: int
    total_statements: int
    is_empty: bool
    onboarding_completed: bool
    onboarding_dismissed: bool
    onboarding_completed_steps: list[str]


class SandboxActionResponse(BaseModel):
    """Résultat certifié d'une action sur le bac à sable (chargement démo ou purge vierge)."""

    status: str
    message: str
    works_count: int = 0
    contracts_count: int = 0
    holders_count: int = 0
    work_groups_count: int = 0
    statements_count: int = 0


DEMO_HOLDERS_DATA: list[dict[str, Any]] = [
    {
        "full_name": "Camille Moreau",
        "stage_name_or_trade_name": "Camille Moreau",
        "entity_type": "PERSONNE_PHYSIQUE",
        "legal_form": "Artiste-Auteur (Précompte IRCEC/URSSAF)",
        "primary_role": "AC",
        "ipi_number": "00458912301",
        "coad_or_isni": "0000 0001 2145 8901",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "camille.moreau@studio-oberkampf.fr",
        "phone": "+33 6 14 28 91 04",
        "city": "Paris",
        "country": "FR",
        "bank_iban": "FR7630004019920005554441001",
        "bank_bic": "BNPAFRPPXXX",
        "ircec_precompte_applicable": True,
        "urssaf_dispense_certificate": False,
    },
    {
        "full_name": "Léa Vasseur",
        "stage_name_or_trade_name": "Léa Vasseur",
        "entity_type": "PERSONNE_PHYSIQUE",
        "legal_form": "Artiste-Auteur (Précompte IRCEC/URSSAF)",
        "primary_role": "A",
        "ipi_number": "00512398741",
        "coad_or_isni": "0000 0002 9841 5520",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "lea.vasseur@auteur-sacem.fr",
        "city": "Lyon",
        "country": "FR",
        "bank_iban": "FR7630004019920005554441002",
        "bank_bic": "BNPAFRPPXXX",
        "ircec_precompte_applicable": True,
        "urssaf_dispense_certificate": False,
    },
    {
        "full_name": "Julien Delacroix",
        "stage_name_or_trade_name": "Julien Delacroix",
        "entity_type": "PERSONNE_PHYSIQUE",
        "legal_form": "Artiste-Auteur (BNC Dispensé)",
        "primary_role": "C",
        "ipi_number": "00623489120",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "julien.delacroix@sound-design.fr",
        "city": "Paris",
        "country": "FR",
        "bank_iban": "FR7630004019920005554441003",
        "bank_bic": "BNPAFRPPXXX",
        "ircec_precompte_applicable": False,
        "urssaf_dispense_certificate": True,
    },
    {
        "full_name": "Antoine Garnier",
        "stage_name_or_trade_name": "Antoine Garnier",
        "entity_type": "PERSONNE_PHYSIQUE",
        "legal_form": "Artiste-Auteur (Précompte IRCEC/URSSAF)",
        "primary_role": "AC",
        "ipi_number": "00734512980",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "antoine.garnier@pulsar-records.fr",
        "city": "Marseille",
        "country": "FR",
        "bank_iban": "FR7630004019920005554441004",
        "bank_bic": "BNPAFRPPXXX",
        "ircec_precompte_applicable": True,
        "urssaf_dispense_certificate": False,
    },
    {
        "full_name": "Sami Benali",
        "stage_name_or_trade_name": "Sami Benali",
        "entity_type": "PERSONNE_PHYSIQUE",
        "legal_form": "Artiste-Auteur (Précompte IRCEC/URSSAF)",
        "primary_role": "AC",
        "ipi_number": "00398765432",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "sami.benali@urban-tracks.fr",
        "city": "Toulouse",
        "country": "FR",
        "bank_iban": "FR7630004019920005554441005",
        "bank_bic": "BNPAFRPPXXX",
        "ircec_precompte_applicable": True,
        "urssaf_dispense_certificate": False,
    },
    {
        "full_name": "Clara Silvestre",
        "stage_name_or_trade_name": "Clara Silvestre",
        "entity_type": "PERSONNE_PHYSIQUE",
        "legal_form": "Artiste-Auteur (Précompte IRCEC/URSSAF)",
        "primary_role": "AC",
        "ipi_number": "00458912301",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "clara.silvestre@acoustic-line.fr",
        "city": "Bordeaux",
        "country": "FR",
        "bank_iban": "FR7630004019920005554441006",
        "bank_bic": "BNPAFRPPXXX",
        "ircec_precompte_applicable": True,
        "urssaf_dispense_certificate": False,
    },
    {
        "full_name": "Éditions Solstices Music",
        "stage_name_or_trade_name": "Solstices Music",
        "entity_type": "SOCIETE",
        "legal_form": "SAS (Société par Actions Simplifiée)",
        "primary_role": "E",
        "ipi_number": "00891234567",
        "coad_or_isni": "0000 0003 4412 9901",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "royalty.manager@solstices-music.fr",
        "phone": "+33 1 42 68 00 12",
        "postal_address": "14 Rue de la Paix",
        "postal_code": "75002",
        "city": "Paris",
        "country": "FR",
        "siret": "89123456700012",
        "vat_number": "FR12891234567",
        "vat_applicable": True,
        "vat_rate_pct": Decimal("20.00"),
        "bank_iban": "FR7630004019920005554443210",
        "bank_bic": "BNPAFRPPXXX",
    },
    {
        "full_name": "UNE MUSIQUE (TF1 Droits Audiovisuels)",
        "stage_name_or_trade_name": "UNE MUSIQUE / TF1",
        "entity_type": "SOCIETE",
        "legal_form": "SA (Société Anonyme)",
        "primary_role": "E",
        "ipi_number": "00789012345",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "contracts.music@tf1.fr",
        "city": "Boulogne-Billancourt",
        "country": "FR",
        "siret": "78901234500023",
        "vat_number": "FR34789012345",
        "vat_applicable": True,
        "vat_rate_pct": Decimal("20.00"),
    },
    {
        "full_name": "Belleville Publishing",
        "stage_name_or_trade_name": "Belleville Publishing",
        "entity_type": "SOCIETE",
        "legal_form": "SARL",
        "primary_role": "E",
        "ipi_number": "00911223344",
        "affiliated_society": "SACEM",
        "society_de": "SACEM",
        "society_dr": "SACEM",
        "email": "contact@belleville-publishing.fr",
        "city": "Paris",
        "country": "FR",
        "siret": "91122334400034",
        "vat_number": "FR56911223344",
        "vat_applicable": True,
        "vat_rate_pct": Decimal("20.00"),
    },
]

DEMO_WORKS_DATA: list[dict[str, Any]] = [
    {
        "title": "Générique DNA (Thème Principal)",
        "alternate_titles": ["Demain Nous Appartient Opening", "DNA Main Theme"],
        "iswc": "T-301.450.001-1",
        "isrc_codes": ["FRZ012600001"],
        "performers": ["Camille Moreau", "Orchestre TF1"],
        "sacem_work_code": "0012345671",
        "cotage_number": "KFC674-01",
        "genre": "Bande Originale TV",
        "creation_year": 2026,
        "contract_reference": "CTR-2026-TF1-01",
        "splits": [
            {"holder_name": "Camille Moreau", "role": "AC", "ipi_number": "00458912301", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "UNE MUSIQUE (TF1 Droits Audiovisuels)", "role": "E", "ipi_number": "00789012345", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
        ],
    },
    {
        "title": "Lumière Noire",
        "alternate_titles": ["Lumiere Noire", "Black Light (French Edit)"],
        "iswc": "T-301.452.891-4",
        "isrc_codes": ["FRZ012600101", "FRZ012600102"],
        "performers": ["Camille Moreau", "K-Soprano"],
        "sacem_work_code": "0012345672",
        "cotage_number": "KFC674-02",
        "genre": "Électro Pop",
        "creation_year": 2026,
        "contract_reference": "CTR-2026-LN01",
        "splits": [
            {"holder_name": "Camille Moreau", "role": "AC", "ipi_number": "00458912301", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
    {
        "title": "Minuit sur la Seine",
        "alternate_titles": ["Minuit Sur Seine", "Midnight on the Seine"],
        "iswc": "T-302.118.440-2",
        "isrc_codes": ["FRZ012600201"],
        "performers": ["Léa Vasseur"],
        "sacem_work_code": "0012345673",
        "cotage_number": "KFC674-03",
        "genre": "Chanson Française",
        "creation_year": 2026,
        "contract_reference": "CTR-2026-MS02",
        "splits": [
            {"holder_name": "Léa Vasseur", "role": "A", "ipi_number": "00512398741", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Julien Delacroix", "role": "C", "ipi_number": "00623489120", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
    {
        "title": "Horizon Véloce",
        "alternate_titles": ["Horizon Veloce", "Horizon Veloce (Club Mix)"],
        "iswc": "T-303.774.129-8",
        "isrc_codes": ["FRZ012600301"],
        "performers": ["Nova Pulse", "Antoine Garnier"],
        "sacem_work_code": "0012345674",
        "cotage_number": "KFC576-01",
        "genre": "Synthwave",
        "creation_year": 2026,
        "contract_reference": "CTR-2026-HV03",
        "splits": [
            {"holder_name": "Antoine Garnier", "role": "AC", "ipi_number": "00734512980", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Belleville Publishing", "role": "E", "ipi_number": "00911223344", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
        ],
    },
    {
        "title": "Poursuite au Port (ITC)",
        "alternate_titles": ["Poursuite ITC", "Chasing at Port"],
        "iswc": "T-303.774.130-9",
        "isrc_codes": ["FRZ012600302"],
        "performers": ["Julien Delacroix"],
        "sacem_work_code": "0012345675",
        "cotage_number": "KFC576-02",
        "genre": "Suspense / Tension",
        "creation_year": 2026,
        "contract_reference": "CTR-2026-HV03",
        "splits": [
            {"holder_name": "Julien Delacroix", "role": "C", "ipi_number": "00623489120", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
    {
        "title": "Orage d'Octobre",
        "alternate_titles": ["Orage Octobre"],
        "iswc": "T-304.901.223-1",
        "isrc_codes": ["FRZ012600401"],
        "performers": ["Sami Benali"],
        "sacem_work_code": "0012345676",
        "genre": "Rap / R&B",
        "creation_year": 2026,
        "contract_reference": "CTR-2026-OO04",
        # Conflit volontaire pré-CWR : Somme DEP = 90.00% (manque 10%) pour illustrer l'arbitrage
        "splits": [
            {"holder_name": "Sami Benali", "role": "AC", "ipi_number": "00398765432", "dep_share_pct": "40.00", "drm_share_pct": "50.00", "share_percentage": "40.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
    {
        "title": "Les Étoiles de Paname",
        "alternate_titles": ["Etoiles de Paname", "Paname Stars"],
        "iswc": "T-305.612.334-7",
        "isrc_codes": ["FRZ012600501"],
        "performers": ["Léa Vasseur", "Camille Moreau"],
        "sacem_work_code": "0012345677",
        "genre": "Chanson",
        "creation_year": 2026,
        "splits": [
            {"holder_name": "Léa Vasseur", "role": "A", "ipi_number": "00512398741", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Camille Moreau", "role": "C", "ipi_number": "00458912301", "dep_share_pct": "25.00", "drm_share_pct": "25.00", "share_percentage": "25.00"},
            {"holder_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "share_percentage": "50.00"},
        ],
    },
]

EXTRA_DEMO_TITLES = [
    ("Traversée Nocturne", "T-306.100.201-1", "FRZ012600601", "Clara Silvestre", "0012345678", "Électro"),
    ("L'Écho des Falaises", "T-306.100.202-2", "FRZ012600602", "Camille Moreau", "0012345679", "Ambient"),
    ("Soleil Acide", "T-306.100.203-3", "FRZ012600603", "Antoine Garnier", "0012345680", "Club"),
    ("Mémoire Magnétique", "T-306.100.204-4", "FRZ012600604", "Julien Delacroix", "0012345681", "Bande Originale"),
    ("Rue des Martyrs", "T-306.100.205-5", "FRZ012600605", "Camille Moreau", "0012345682", "Chanson"),
    ("Vagues Synthétiques", "T-306.100.206-6", "FRZ012600606", "Antoine Garnier", "0012345683", "Synthwave"),
    ("Un Été à Marseille", "T-306.100.207-7", "FRZ012600607", "Sami Benali", "0012345684", "Urbain"),
    ("Fleurs de Béton", "T-306.100.208-8", "FRZ012600608", "Sami Benali", "0012345685", "Rap"),
    ("Passager de l'Aube", "T-306.100.209-9", "FRZ012600609", "Léa Vasseur", "0012345686", "Chanson"),
    ("Dernier Métro Bastille", "T-306.100.210-0", "FRZ012600610", "Léa Vasseur", "0012345687", "Pop"),
    ("Vertige Boréal", "T-306.100.211-1", "FRZ012600611", "Antoine Garnier", "0012345688", "Électro"),
    ("Poussière d'Or", "T-306.100.212-2", "FRZ012600612", "Clara Silvestre", "0012345689", "Acoustique"),
    ("Mirage Urbain", "T-306.100.213-3", "FRZ012600613", "Sami Benali", "0012345690", "R&B"),
    ("Séquence Cinéma", "T-306.100.214-4", "FRZ012600614", "Julien Delacroix", "0012345691", "Cinéma"),
    ("Sous les Toits de Zinc", "T-306.100.215-5", "FRZ012600615", "Camille Moreau", "0012345692", "Chanson"),
    ("Lignes de Fuite", "T-306.100.216-6", "FRZ012600616", "Julien Delacroix", "0012345693", "Soundtrack"),
    ("Rivage Électrique", "T-306.100.217-7", "FRZ012600617", "Antoine Garnier", "0012345694", "Électro"),
    ("Nuit Blanche à Lyon", "T-306.100.218-8", "FRZ012600618", "Antoine Garnier", "0012345695", "Deep House"),
    ("Cœur Battant (BOF)", "T-306.100.219-9", "FRZ012600619", "Léa Vasseur", "0012345696", "Cinéma"),
    ("Après la Pluie", "T-306.100.220-0", "FRZ012600620", "Clara Silvestre", "0012345697", "Folk"),
    ("Mélancolie d'Automne", "T-306.100.221-1", "FRZ012600621", "Camille Moreau", "0012345698", "Néo-classique"),
    ("Comète Filante", "T-306.100.222-2", "FRZ012600622", "Julien Delacroix", "0012345699", "Électro"),
    ("Aurore Acoustique", "T-306.100.223-3", "FRZ012600623", "Clara Silvestre", "0012345700", "Acoustique"),
]

for t_title, t_iswc, t_isrc, t_perf, t_cocv, t_genre in EXTRA_DEMO_TITLES:
    DEMO_WORKS_DATA.append(
        {
            "title": t_title,
            "alternate_titles": [],
            "iswc": t_iswc,
            "isrc_codes": [t_isrc],
            "performers": [t_perf],
            "sacem_work_code": t_cocv,
            "genre": t_genre,
            "creation_year": 2026,
            "splits": [
                {
                    "holder_name": t_perf,
                    "role": "AC",
                    "ipi_number": "00458912301",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "share_percentage": "50.00",
                },
                {
                    "holder_name": "Éditions Solstices Music",
                    "role": "E",
                    "ipi_number": "00891234567",
                    "dep_share_pct": "50.00",
                    "drm_share_pct": "50.00",
                    "share_percentage": "50.00",
                },
            ],
        }
    )

DEMO_STATEMENT_ROWS = [
    {
        "work_title": "LUMIERE NOIRE",
        "iswc": "T-301.452.891-4",
        "isrc": "FRZ012600101",
        "performer": "Camille Moreau",
        "right_type": "DEP",
        "exploitation_type": "PUBLIC_PERFORMANCE",
        "territory": "FR",
        "units": 48200,
        "gross_amount": "4250.00",
    },
    {
        "work_title": "Lumiere Noir (Feat. K-Soprano) - Radio Edit",
        "iswc": "",
        "isrc": "",
        "performer": "Camille Moreau feat K",
        "right_type": "DRM",
        "exploitation_type": "STREAMING",
        "territory": "FR",
        "units": 915000,
        "gross_amount": "3180.50",
    },
    {
        "work_title": "Minuit s/ la Seine (Live TV)",
        "iswc": "",
        "isrc": "",
        "performer": "Lea Vasseur",
        "right_type": "DEP",
        "exploitation_type": "PUBLIC_PERFORMANCE",
        "territory": "FR",
        "units": 12400,
        "gross_amount": "1890.00",
    },
    {
        "work_title": "HORIZON VELOCE - CLUB MIX",
        "iswc": "",
        "isrc": "FRZ012600301",
        "performer": "Nova Pulse",
        "right_type": "DEP",
        "exploitation_type": "STREAMING",
        "territory": "EU",
        "units": 540000,
        "gross_amount": "2400.00",
    },
    {
        "work_title": "Traversee Nocturn",
        "iswc": "",
        "isrc": "",
        "performer": "Clara Silvestre",
        "right_type": "DRM",
        "exploitation_type": "DOWNLOAD",
        "territory": "FR",
        "units": 3200,
        "gross_amount": "960.25",
    },
    {
        "work_title": "Coeur Battant (BOF Film)",
        "iswc": "",
        "isrc": "",
        "performer": "Lea Vasseur",
        "right_type": "SYNC",
        "exploitation_type": "SYNCHRONIZATION",
        "territory": "WORLD",
        "units": 1,
        "gross_amount": "6500.00",
    },
]


@router.get("/status", response_model=SandboxStatusResponse)
def get_sandbox_status(
    session: Session = Depends(get_session),
) -> SandboxStatusResponse:
    """Retourne la volumétrie complète de la base de données et l'état d'onboarding."""
    works_count = len(list(session.exec(select(Work.id)).all()))
    contracts_count = len(list(session.exec(select(Contract.id)).all()))
    holders_count = len(list(session.exec(select(RightHolderDirectory.id)).all()))
    groups_count = len(list(session.exec(select(WorkGroup.id)).all()))
    stmts_count = len(list(session.exec(select(RoyaltyStatement.id)).all()))

    ws = session.exec(select(WorkspaceSettings)).first()
    onboarding_completed = bool(getattr(ws, "onboarding_completed", False)) if ws else False
    onboarding_dismissed = bool(getattr(ws, "onboarding_dismissed", False)) if ws else False
    completed_steps = list(getattr(ws, "onboarding_completed_steps", None) or []) if ws else []

    is_empty = works_count == 0 and contracts_count == 0 and holders_count == 0

    return SandboxStatusResponse(
        total_works=works_count,
        total_contracts=contracts_count,
        total_holders=holders_count,
        total_work_groups=groups_count,
        total_statements=stmts_count,
        is_empty=is_empty,
        onboarding_completed=onboarding_completed,
        onboarding_dismissed=onboarding_dismissed,
        onboarding_completed_steps=completed_steps,
    )


@router.post("/load-demo", response_model=SandboxActionResponse)
def load_sandbox_demo(
    session: Session = Depends(get_session),
) -> SandboxActionResponse:
    """
    Charge un catalogue de démonstration complet et réaliste :
    - 30 œuvres avec identifiants SACEM, cotages et clés conformes.
    - 3 projets audiovisuels / albums (TF1 Demain Nous Appartient, Ici Tout Commence, Album Solstices).
    - 9 ayants droit dans le répertoire (statuts fiscaux et coordonnées bancaires SEPA).
    - 4 contrats d'édition & liasses contractuelles avec avances.
    - 1 relevé de redevances SACEM & streaming DSP pré-rapproché.
    """
    now = datetime.now(timezone.utc)

    # 1. Ayants Droit
    existing_holders_by_name = {
        h.full_name.strip().lower(): h
        for h in session.exec(select(RightHolderDirectory)).all()
    }
    created_holders = 0
    for h_data in DEMO_HOLDERS_DATA:
        key = h_data["full_name"].strip().lower()
        if key not in existing_holders_by_name:
            holder = RightHolderDirectory(**h_data)
            session.add(holder)
            existing_holders_by_name[key] = holder
            created_holders += 1
    session.commit()

    # 2. Projets Audiovisuels / WorkGroups
    existing_groups = {g.name.strip().lower(): g for g in session.exec(select(WorkGroup)).all()}
    demo_groups_specs = [
        {
            "name": "Demain Nous Appartient - Saison 9 (TF1)",
            "group_type": "SERIE_TV",
            "broadcaster_or_client": "TF1 Production",
            "release_year": 2026,
            "contract_reference": "CTR-2026-TF1-01",
            "notes": "Musiques originales et thèmes de la série quotidienne TF1.",
        },
        {
            "name": "Ici Tout Commence - B.O. (TF1)",
            "group_type": "SERIE_TV",
            "broadcaster_or_client": "TF1 Production",
            "release_year": 2026,
            "contract_reference": "CTR-2026-HV03",
            "notes": "Bande originale et musiques de scène ITC.",
        },
        {
            "name": "Solstices Electro Pop - Album Vol. 1",
            "group_type": "ALBUM",
            "broadcaster_or_client": "Solstices Music",
            "release_year": 2026,
            "notes": "Compilation électro-pop estivale de Solstices Music.",
        },
    ]

    default_ent = session.exec(select(PublishingEntity).where(PublishingEntity.is_default == True)).first()  # noqa: E712
    default_ent_id = default_ent.id if default_ent else None

    for g_spec in demo_groups_specs:
        g_key = g_spec["name"].strip().lower()
        if g_key not in existing_groups:
            grp = WorkGroup(**g_spec, entity_id=default_ent_id, created_at=now, updated_at=now)
            session.add(grp)
            existing_groups[g_key] = grp
    session.commit()

    # 3. Contrats
    existing_contracts_by_ref = {
        c.contract_reference.strip().upper(): c
        for c in session.exec(select(Contract)).all()
    }

    if "CTR-2026-TF1-01" not in existing_contracts_by_ref:
        c_tf1 = Contract(
            contract_reference="CTR-2026-TF1-01",
            sacem_contract_number="SACEM-CGP-2026-TF1",
            cwr_contract_type="CO_EDITION",
            contract_type="CO_EDITION",
            publisher_name="Éditions Solstices Music",
            counterparty_name="UNE MUSIQUE (TF1 Droits Audiovisuels)",
            signature_date=date(2026, 1, 10),
            start_date=date(2026, 1, 10),
            territory="WORLD",
            duration_years=10,
            advance_amount=Decimal("0.00"),
            recouped_amount=Decimal("0.00"),
            currency="EUR",
            work_titles=["Générique DNA (Thème Principal)"],
            parties=[
                {"party_name": "Camille Moreau", "role": "AC", "ipi_number": "00458912301", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                {"party_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "25.00", "drm_share_pct": "25.00"},
                {"party_name": "UNE MUSIQUE (TF1 Droits Audiovisuels)", "role": "E", "ipi_number": "00789012345", "dep_share_pct": "25.00", "drm_share_pct": "25.00"},
            ],
            advance={"has_advance": False, "advance_amount": "0.00"},
            royalty_rules=[],
            source_filename="contrat_tf1_dna_kfc674.pdf",
            extracted_clauses_summary="Coédition 50% Camille Moreau / 25% Solstices / 25% TF1 UNE MUSIQUE sur cotage KFC674.",
            confidence_score=0.98,
            validation_status=ValidationStatus.VALIDATED.value,
            validated_by="directeur.juridique@solstices-music.fr",
            validated_at=now,
            entity_id=default_ent_id,
            created_at=now,
            updated_at=now,
        )
        session.add(c_tf1)
        session.commit()
        session.refresh(c_tf1)
        existing_contracts_by_ref["CTR-2026-TF1-01"] = c_tf1

        # Lier au groupe TF1
        g_dna = existing_groups.get("demain nous appartient - saison 9 (tf1)")
        if g_dna:
            g_dna.contract_id = c_tf1.id
            g_dna.contract_reference = c_tf1.contract_reference
            session.add(g_dna)
            session.commit()

    if "CTR-2026-LN01" not in existing_contracts_by_ref:
        c_ln = Contract(
            contract_reference="CTR-2026-LN01",
            contract_type="CO_EDITION",
            publisher_name="Éditions Solstices Music",
            counterparty_name="Camille Moreau",
            signature_date=date(2026, 1, 15),
            start_date=date(2026, 1, 15),
            territory="WORLD",
            duration_years=10,
            advance_amount=Decimal("15000.00"),
            recouped_amount=Decimal("3200.00"),
            currency="EUR",
            work_titles=["Lumière Noire"],
            parties=[
                {"party_name": "Camille Moreau", "role": "AC", "ipi_number": "00458912301", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
                {"party_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
            ],
            advance={
                "has_advance": True,
                "advance_amount": "15000.00",
                "beneficiary_name": "Camille Moreau",
                "recoupable_streams": ["STREAMING", "SYNCHRONIZATION", "PUBLIC_PERFORMANCE"],
            },
            royalty_rules=[],
            source_filename="contrat_coedition_lumiere_noire.pdf",
            extracted_clauses_summary="Coédition 50/50 Camille Moreau & Solstices Music avec avance de 15 000 €.",
            confidence_score=0.96,
            validation_status=ValidationStatus.VALIDATED.value,
            validated_by="directeur.juridique@solstices-music.fr",
            validated_at=now,
            entity_id=default_ent_id,
            created_at=now,
            updated_at=now,
        )
        session.add(c_ln)
        session.commit()
        session.refresh(c_ln)
        existing_contracts_by_ref["CTR-2026-LN01"] = c_ln

        session.add(
            AdvanceLedger(
                contract_id=c_ln.id,
                contract_reference=c_ln.contract_reference,
                holder_name="Camille Moreau",
                ipi_number="00458912301",
                initial_advance=Decimal("15000.00"),
                recouped_amount=Decimal("3200.00"),
                updated_at=now,
            )
        )
        session.commit()

    if "CTR-2026-MS02" not in existing_contracts_by_ref:
        c_ms = Contract(
            contract_reference="CTR-2026-MS02",
            contract_type="CESSION_EDITION",
            publisher_name="Éditions Solstices Music",
            counterparty_name="Léa Vasseur",
            signature_date=date(2026, 2, 1),
            start_date=date(2026, 2, 1),
            territory="WORLD",
            duration_years=15,
            advance_amount=Decimal("5000.00"),
            recouped_amount=Decimal("0.00"),
            currency="EUR",
            work_titles=["Minuit sur la Seine"],
            parties=[
                {"party_name": "Léa Vasseur", "role": "A", "ipi_number": "00512398741", "dep_share_pct": "25.00", "drm_share_pct": "25.00"},
                {"party_name": "Julien Delacroix", "role": "C", "ipi_number": "00623489120", "dep_share_pct": "25.00", "drm_share_pct": "25.00"},
                {"party_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
            ],
            advance={
                "has_advance": True,
                "advance_amount": "5000.00",
                "beneficiary_name": "Léa Vasseur",
                "recoupable_streams": ["STREAMING", "PUBLIC_PERFORMANCE"],
            },
            royalty_rules=[],
            source_filename="contrat_cession_minuit_seine.pdf",
            extracted_clauses_summary="Cession 25% Léa Vasseur / 25% Julien Delacroix / 50% Solstices avec avance de 5 000 €.",
            confidence_score=0.94,
            validation_status=ValidationStatus.VALIDATED.value,
            validated_by="directeur.juridique@solstices-music.fr",
            validated_at=now,
            entity_id=default_ent_id,
            created_at=now,
            updated_at=now,
        )
        session.add(c_ms)
        session.commit()
        session.refresh(c_ms)
        existing_contracts_by_ref["CTR-2026-MS02"] = c_ms

        session.add(
            AdvanceLedger(
                contract_id=c_ms.id,
                contract_reference=c_ms.contract_reference,
                holder_name="Léa Vasseur",
                ipi_number="00512398741",
                initial_advance=Decimal("5000.00"),
                recouped_amount=Decimal("0.00"),
                updated_at=now,
            )
        )
        session.commit()

    if "CTR-2026-OO04" not in existing_contracts_by_ref:
        c_oo = Contract(
            contract_reference="CTR-2026-OO04",
            contract_type="CESSION_EDITION",
            publisher_name="Éditions Solstices Music",
            counterparty_name="Sami Benali",
            signature_date=date(2026, 9, 10),
            start_date=date(2026, 9, 10),
            territory="WORLD",
            duration_years=15,
            advance_amount=Decimal("3000.00"),
            recouped_amount=Decimal("0.00"),
            currency="EUR",
            work_titles=["Orage d'Octobre"],
            parties=[
                {"party_name": "Sami Benali", "role": "AC", "ipi_number": "00398765432", "dep_share_pct": "40.00", "drm_share_pct": "50.00"},
                {"party_name": "Éditions Solstices Music", "role": "E", "ipi_number": "00891234567", "dep_share_pct": "50.00", "drm_share_pct": "50.00"},
            ],
            advance={
                "has_advance": True,
                "advance_amount": "3000.00",
                "beneficiary_name": "Sami Benali",
                "recoupable_streams": ["STREAMING"],
            },
            royalty_rules=[],
            source_filename="contrat_orage_octobre.pdf",
            extracted_clauses_summary="Extraction IA : Sami Benali 40% DEP / 50% DRM, Solstices 50% DEP / 50% DRM. Attention : 10% non attribués.",
            confidence_score=0.74,
            validation_status=ValidationStatus.PENDING_REVIEW.value,
            entity_id=default_ent_id,
            created_at=now,
            updated_at=now,
        )
        session.add(c_oo)
        session.commit()
        session.refresh(c_oo)
        existing_contracts_by_ref["CTR-2026-OO04"] = c_oo

    # 4. Œuvres (30 œuvres)
    existing_works_by_title = {
        w.title.strip().lower(): w
        for w in session.exec(select(Work)).all()
    }
    created_works: list[Work] = []

    for w_data in DEMO_WORKS_DATA:
        t_key = w_data["title"].strip().lower()
        if t_key in existing_works_by_title:
            created_works.append(existing_works_by_title[t_key])
            continue

        corpus = " ".join([w_data["title"], *w_data.get("alternate_titles", []), *w_data.get("performers", [])])
        work = Work(
            title=w_data["title"],
            alternate_titles=w_data.get("alternate_titles", []),
            iswc=w_data.get("iswc"),
            isrc_codes=w_data.get("isrc_codes", []),
            performers=w_data.get("performers", []),
            sacem_work_code=w_data.get("sacem_work_code"),
            cotage_number=w_data.get("cotage_number"),
            genre=w_data.get("genre"),
            creation_year=w_data.get("creation_year", 2026),
            contract_reference=w_data.get("contract_reference"),
            splits=w_data["splits"],
            entity_id=default_ent_id,
            embedding=compute_text_embedding(corpus),
            created_at=now,
            updated_at=now,
        )
        session.add(work)
        session.commit()
        session.refresh(work)
        created_works.append(work)
        existing_works_by_title[t_key] = work

    # 5. Lier les œuvres aux Projets TF1 & Albums
    g_dna = existing_groups.get("demain nous appartient - saison 9 (tf1)")
    g_itc = existing_groups.get("ici tout commence - b.o. (tf1)")
    g_alb = existing_groups.get("solstices electro pop - album vol. 1")

    existing_links = {
        (str(lnk.work_id), str(lnk.work_group_id))
        for lnk in session.exec(select(WorkGroupLink)).all()
    }

    for w in created_works:
        target_group = None
        if "dna" in w.title.lower() or w.title in ["Lumière Noire", "Minuit sur la Seine"]:
            target_group = g_dna
        elif "itc" in w.title.lower() or "horizon" in w.title.lower() or "poursuite" in w.title.lower():
            target_group = g_itc
        elif w.title in ["Traversée Nocturne", "L'Écho des Falaises", "Soleil Acide"]:
            target_group = g_alb

        if target_group:
            link_key = (str(w.id), str(target_group.id))
            if link_key not in existing_links:
                session.add(WorkGroupLink(work_id=w.id, work_group_id=target_group.id))
                existing_links.add(link_key)

    session.commit()

    # 6. Relevé de Démonstration (Royalty Statement)
    existing_demo_stmt = session.exec(
        select(RoyaltyStatement).where(RoyaltyStatement.filename == "sacem_repartition_2026Q3_demo.csv")
    ).first()

    if not existing_demo_stmt:
        catalog_works = list(session.exec(select(Work)).all())
        stmt = RoyaltyStatement(
            source_name="SACEM Répartition 2026-Q3 & DSP (Démo)",
            filename="sacem_repartition_2026Q3_demo.csv",
            period_start=date(2026, 1, 1),
            period_end=date(2026, 6, 30),
            total_gross_amount=Decimal("0.00"),
            currency="EUR",
            accounting_status="DRAFT",
            entity_id=default_ent_id,
            created_at=now,
        )
        session.add(stmt)
        session.commit()
        session.refresh(stmt)

        total_gross = Decimal("0.00")
        for idx, r in enumerate(DEMO_STATEMENT_ROWS, start=1):
            gross_val = Decimal(r["gross_amount"])
            total_gross += gross_val
            line_in = StatementLineCreate(
                row_number=idx,
                raw_work_title=r["work_title"],
                raw_iswc=r["iswc"] or None,
                raw_isrc=r["isrc"] or None,
                raw_performer=r["performer"] or None,
                right_type=r["right_type"],
                exploitation_type=ExploitationType(r["exploitation_type"]),
                territory=r["territory"],
                units=int(r["units"]),
                gross_amount=gross_val,
                currency="EUR",
            )
            matched = match_statement_line_to_catalog(line_in, catalog_works)
            is_first = idx == 1
            allocs = []
            if is_first and matched.matched_work_id:
                w_obj = session.get(Work, matched.matched_work_id)
                if w_obj and w_obj.splits:
                    allocs = [
                        a.model_dump(mode="json")
                        for a in calculate_line_allocations(
                            gross_amount=gross_val,
                            splits=w_obj.splits,
                            right_type="DEP",
                        )
                    ]

            db_line = StatementLine(
                statement_id=stmt.id,
                row_number=idx,
                raw_work_title=r["work_title"],
                raw_iswc=r["iswc"] or None,
                raw_isrc=r["isrc"] or None,
                raw_performer=r["performer"] or None,
                right_type=r["right_type"],
                exploitation_type=r["exploitation_type"],
                territory=r["territory"],
                units=int(r["units"]),
                gross_amount=gross_val,
                currency="EUR",
                matched_work_id=matched.matched_work_id,
                matched_work_title=matched.matched_work_title,
                match_method=matched.match_method.value,
                confidence_score=matched.confidence_score,
                validation_status=(
                    ValidationStatus.VALIDATED.value
                    if is_first
                    else ValidationStatus.PENDING_REVIEW.value
                ),
                validated_by="royalty.manager@solstices-music.fr" if is_first else None,
                validated_at=now if is_first else None,
                top_match=matched.top_match.model_dump(mode="json") if matched.top_match else None,
                alternatives=[a.model_dump(mode="json") for a in matched.alternatives],
                allocations=allocs,
            )
            session.add(db_line)

        stmt.total_gross_amount = total_gross
        session.add(stmt)
        session.commit()

    # 7. Mettre à jour l'onboarding dans WorkspaceSettings
    ws = get_or_create_workspace_settings(session)
    ws.onboarding_completed_steps = [
        "step_identity",
        "step_catalog",
        "step_contracts",
        "step_simulation",
    ]
    ws.onboarding_completed = True
    ws.updated_at = now
    session.add(ws)
    session.commit()

    # 8. Journaliser dans l'Audit Trail
    total_w = len(list(session.exec(select(Work.id)).all()))
    total_c = len(list(session.exec(select(Contract.id)).all()))
    total_h = len(list(session.exec(select(RightHolderDirectory.id)).all()))
    total_g = len(list(session.exec(select(WorkGroup.id)).all()))
    total_s = len(list(session.exec(select(RoyaltyStatement.id)).all()))

    session.add(
        AuditLog(
            action_type="SANDBOX_DEMO_LOADED",
            entity_type="SANDBOX",
            entity_id="GLOBAL",
            actor="royalty.manager@solstices-music.fr",
            summary=(
                f"Mode Démonstration chargé : {total_w} œuvres, {total_c} contrats, "
                f"{total_g} projets TF1/Albums, {total_h} ayants droit et {total_s} relevé DSP."
            ),
            details={
                "works_count": total_w,
                "contracts_count": total_c,
                "holders_count": total_h,
                "work_groups_count": total_g,
                "statements_count": total_s,
            },
            created_at=now,
        )
    )
    session.commit()

    return SandboxActionResponse(
        status="success",
        message="Catalogue de démonstration chargé avec succès (30 œuvres & projets TF1).",
        works_count=total_w,
        contracts_count=total_c,
        holders_count=total_h,
        work_groups_count=total_g,
        statements_count=total_s,
    )


@router.post("/reset", response_model=SandboxActionResponse)
def reset_sandbox(
    session: Session = Depends(get_session),
) -> SandboxActionResponse:
    """
    Réinitialise intégralement le bac à sable en 1 clic :
    - Purge toutes les écritures de redevances et lignes de relevés.
    - Supprime tous les relevés de royalties.
    - Supprime tous les comptes d'avances et contrats.
    - Supprime toutes les liaisons et groupes d'œuvres / projets audiovisuels.
    - Supprime toutes les œuvres du catalogue.
    - Supprime tous les ayants droit du répertoire.
    - Réinitialise l'état d'onboarding à l'état vierge.
    """
    now = datetime.now(timezone.utc)

    # 1. Écritures de Grand Livre & Lignes de relevés
    session.exec(delete(RoyaltyLedgerEntry))
    session.exec(delete(StatementLine))
    session.exec(delete(RoyaltyStatement))

    # 2. Avances & Contrats
    session.exec(delete(AdvanceLedger))
    session.exec(delete(Contract))

    # 3. Liaisons & Groupes de projets
    session.exec(delete(WorkGroupLink))
    session.exec(delete(WorkGroup))

    # 4. Catalogue d'œuvres & Ayants Droit
    session.exec(delete(Work))
    session.exec(delete(RightHolderDirectory))

    # 5. Réinitialisation de l'onboarding
    ws = get_or_create_workspace_settings(session)
    ws.onboarding_completed = False
    ws.onboarding_dismissed = False
    ws.onboarding_completed_steps = []
    ws.updated_at = now
    session.add(ws)

    # 6. Audit Trail
    session.add(
        AuditLog(
            action_type="SANDBOX_RESET",
            entity_type="SANDBOX",
            entity_id="GLOBAL",
            actor="royalty.manager@solstices-music.fr",
            summary="Bac à sable réinitialisé en 1 clic : retour à une base de données 100 % vierge.",
            details={"action": "RESET_TO_BLANK_CANVAS"},
            created_at=now,
        )
    )
    session.commit()

    return SandboxActionResponse(
        status="success",
        message="Bac à sable réinitialisé avec succès : base de données remise à l'état vierge.",
        works_count=0,
        contracts_count=0,
        holders_count=0,
        work_groups_count=0,
        statements_count=0,
    )
