import unittest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.core.database import _apply_incremental_column_migrations, get_session
from app.main import app
from app.models.work import Work


class TestCatalogDisplayAndMigrations(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)

        def get_test_session():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[get_session] = get_test_session
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_incremental_migrations_and_catalog_endpoint(self) -> None:
        """Vérifie que les migrations incrémentales s'appliquent sans erreur et que le catalogue s'affiche sans régression."""
        # 1. Vérification que la fonction de migration est idempotente et s'exécute proprement
        _apply_incremental_column_migrations()

        # 2. Création de 5 œuvres de test
        with Session(self.engine) as session:
            for i in range(5):
                work = Work(
                    title=f"Oeuvre Test Migration {i+1}",
                    sacem_work_code=f"1117855737{i}",
                    cotage_number=f"47{i:02d}",
                    splits=[
                        {
                            "holder_name": "Auteur Test",
                            "role": "AC",
                            "dep_share_pct": "50.00",
                            "drm_share_pct": "50.00",
                            "sync_share_pct": "50.00",
                            "phono_share_pct": "50.00",
                            "share_percentage": "50.00",
                        },
                        {
                            "holder_name": "Éditions Solstices Music",
                            "role": "E",
                            "dep_share_pct": "50.00",
                            "drm_share_pct": "50.00",
                            "sync_share_pct": "50.00",
                            "phono_share_pct": "50.00",
                            "share_percentage": "50.00",
                        },
                    ],
                )
                session.add(work)
            session.commit()

        # 3. Appel de l'endpoint GET /api/v1/works
        response = self.client.get("/api/v1/works")
        self.assertEqual(response.status_code, 200)
        works_data = response.json()
        self.assertIsInstance(works_data, list)
        self.assertEqual(len(works_data), 5)
        self.assertEqual(works_data[0]["title"], "Oeuvre Test Migration 1")

        # 4. Vérification CORS pour 127.0.0.1 et localhost
        for origin in ["http://localhost:3000", "http://127.0.0.1:3000"]:
            cors_resp = self.client.options(
                "/api/v1/works",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            self.assertEqual(cors_resp.status_code, 200)
            self.assertEqual(cors_resp.headers.get("access-control-allow-origin"), origin)

    def test_work_lifecycle_status_resolution(self) -> None:
        """Vérifie la résolution déterministe des états métier (US-5.16)."""
        with Session(self.engine) as session:
            # 1. Œuvre complète à déposer
            w1 = Work(
                title="Titre À Déposer",
                splits=[
                    {"holder_name": "Auteur", "role": "AC", "ipi_number": "00123456789", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "sync_share_pct": "50.00", "phono_share_pct": "50.00", "share_percentage": "50.00"},
                    {"holder_name": "Editeur", "role": "E", "ipi_number": "00987654321", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "sync_share_pct": "50.00", "phono_share_pct": "50.00", "share_percentage": "50.00"},
                ],
            )
            # 2. Œuvre avec informations manquantes (DEP != 100%)
            w2 = Work(
                title="Titre Incomplet",
                splits=[
                    {"holder_name": "Auteur", "role": "AC", "dep_share_pct": "40.00", "drm_share_pct": "50.00", "sync_share_pct": "50.00", "phono_share_pct": "50.00", "share_percentage": "40.00"},
                ],
            )
            # 3. Œuvre déposée et exploitée
            w3 = Work(
                title="Titre Enregistré",
                sacem_work_code="123456789",
                sacem_registration_status="REGISTERED",
                splits=[
                    {"holder_name": "Auteur", "role": "AC", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "sync_share_pct": "50.00", "phono_share_pct": "50.00", "share_percentage": "50.00"},
                    {"holder_name": "Editeur", "role": "E", "dep_share_pct": "50.00", "drm_share_pct": "50.00", "sync_share_pct": "50.00", "phono_share_pct": "50.00", "share_percentage": "50.00"},
                ],
            )
            # 4. Œuvre rejetée
            w4 = Work(
                title="Titre Rejeté",
                sacem_registration_status="REJECTED",
                sacem_rejection_reason="IPI manquant pour le coéditeur",
                splits=[],
            )
            # 5. Œuvre avec statut explicitement choisi par l'utilisateur
            w5 = Work(
                title="Titre Choix Utilisateur",
                lifecycle_status="ARCHIVE",
                splits=[],
            )
            session.add_all([w1, w2, w3, w4, w5])
            session.commit()

        resp = self.client.get("/api/v1/works")
        self.assertEqual(resp.status_code, 200)
        works_by_title = {item["title"]: item for item in resp.json()}

        # Vérifications
        self.assertEqual(works_by_title["Titre À Déposer"]["lifecycle_status"], "A_DEPOSER")
        self.assertEqual(works_by_title["Titre À Déposer"]["lifecycle_status_label"], "À déposer")

        self.assertEqual(works_by_title["Titre Incomplet"]["lifecycle_status"], "INFORMATIONS_MANQUANTES")
        self.assertEqual(works_by_title["Titre Incomplet"]["lifecycle_status_label"], "Informations manquantes")
        self.assertTrue(len(works_by_title["Titre Incomplet"]["lifecycle_status_issues"]) > 0)

        self.assertEqual(works_by_title["Titre Enregistré"]["lifecycle_status"], "DEPOSE_ET_EXPLOITE")
        self.assertEqual(works_by_title["Titre Enregistré"]["lifecycle_status_label"], "Déposé & Exploité")

        self.assertEqual(works_by_title["Titre Rejeté"]["lifecycle_status"], "REJET_SACEM")
        self.assertEqual(works_by_title["Titre Rejeté"]["lifecycle_status_label"], "Rejet SACEM")
        self.assertIn("IPI manquant pour le coéditeur", works_by_title["Titre Rejeté"]["lifecycle_status_issues"])

        self.assertEqual(works_by_title["Titre Choix Utilisateur"]["lifecycle_status"], "ARCHIVE")
        self.assertEqual(works_by_title["Titre Choix Utilisateur"]["lifecycle_status_label"], "Archivé / Non administré")

    def test_cwr_v21_coedition_and_exact_shares_parsing(self) -> None:
        """Vérifie le parsing fidèle du format CWR v2.1 avec coédition multi-éditeurs (SPU + OPU) et consolidation des auteurs (SWR + OWR)."""
        from decimal import Decimal
        from app.services.catalog_migration_service import _parse_cwr_v21_file

        sample_cwr = (
            "HDRPB146348565UNE MUSIQUE                                  01.102026060314564820260603UTF-8          \n"
            "GRHNWR0000102.100000000001  \n"
            "NWR00000003000000007 ANS PLUS TARD GIULIA THEME                                  8CANNw51613   T338589021700000000            UNC000000UMUS   ORI                                                   N00000000000U                                                  N\n"
            "SPU0000000300000001012        SOC UNE MUSIQUE                               E          00146348565              0580166705801667   00000   0000000000000                               \n"
            "SPT00000003000000022              016670166700000I0056N001\n"
            "OPU0000000300000003022415     CRISTAL PUBLISHING                           NE          00150590196              0580166705801667   00000   0000000000000                               \n"
            "OPU0000000300000004034456     EMPREINTE DIGITALE                           NE          01012579290              0580166605801666   00000   0000000000000                               \n"
            "SWR00000003000000054457     D'AMARIO                                     ANTHONY                        C          000000000000580083305802500   00000  N                           \n"
            "SWT00000003000000064457     008330250000000I0056N001\n"
            "PWR00000003000000072        SOC UNE MUSIQUE                                                          4457     \n"
            "SWR00000003000000084233     RIGAUDIERE                                   EDOUARD                        C          000000000000580083305802500   00000  N                           \n"
            "SWT00000003000000094233     008330250000000I0056N001\n"
            "PWR00000003000000102        SOC UNE MUSIQUE                                                          4233     \n"
            "OWR00000003000000114457     D'AMARIO                                     ANTHONY                       NC          000000000000580083405800000   00000  N                           \n"
            "OWR00000003000000124233     RIGAUDIERE                                   EDOUARD                       NC          000000000000580083405800000   00000  N                           \n"
            "OWR00000003000000134457     D'AMARIO                                     ANTHONY                       NC          000000000000580083305800000   00000  N                           \n"
            "OWR00000003000000144233     RIGAUDIERE                                   EDOUARD                       NC          000000000000580083305800000   00000  N                           \n"
            "ALT0000000300000015GIULIA THEME                                                AT  \n"
            "ALT00000003000000167 ANS PLUS TARD                                             AT  \n"
            "ALT0000000300000017BO SERIE INTRACABLES                                        AT  \n"
            "ORN0000000300000018TELBO série INTRACABLES (EX : LOG OUT)                                                                                                                                                                                                                                                    \n"
            "TRL0000100000021000000000001\n"
        )

        works = _parse_cwr_v21_file(sample_cwr)
        self.assertEqual(len(works), 1)
        w = works[0]
        self.assertEqual(w["title"], "7 Ans Plus Tard Giulia Theme")
        self.assertEqual(w["iswc"], "T-338.589.021-7")
        self.assertEqual(w["cotage_number"], "8CANNw51613")
        self.assertIn("GIULIA THEME", w["alternate_titles"])
        self.assertIn("BO série INTRACABLES (EX : LOG OUT)", w["alternate_titles"])

        # Doit contenir exactement 5 ayants droit (3 éditeurs + 2 compositeurs)
        self.assertEqual(len(w["splits"]), 5)
        splits_by_name = {s.holder_name: s for s in w["splits"]}

        # 1. Éditeurs
        self.assertIn("Soc Une Musique", splits_by_name)
        une_musique = splits_by_name["Soc Une Musique"]
        self.assertEqual(une_musique.role, "E")
        self.assertEqual(une_musique.ipi_number, "00146348565")
        self.assertEqual(une_musique.dep_share_pct, Decimal("16.67"))
        self.assertEqual(une_musique.drm_share_pct, Decimal("16.67"))

        self.assertIn("Cristal Publishing", splits_by_name)
        cristal = splits_by_name["Cristal Publishing"]
        self.assertEqual(cristal.role, "E")
        self.assertEqual(cristal.ipi_number, "00150590196")
        self.assertEqual(cristal.dep_share_pct, Decimal("16.67"))
        self.assertEqual(cristal.drm_share_pct, Decimal("16.67"))

        self.assertIn("Empreinte Digitale", splits_by_name)
        empreinte = splits_by_name["Empreinte Digitale"]
        self.assertEqual(empreinte.role, "E")
        self.assertEqual(empreinte.ipi_number, "01012579290")
        self.assertEqual(empreinte.dep_share_pct, Decimal("16.66"))
        self.assertEqual(empreinte.drm_share_pct, Decimal("16.66"))

        # 2. Compositeurs
        self.assertIn("D'Amario Anthony", splits_by_name)
        damario = splits_by_name["D'Amario Anthony"]
        self.assertEqual(damario.role, "C")
        self.assertIsNone(damario.ipi_number)  # 00000000000 dans le CWR doit être None, pas corrompu
        self.assertEqual(damario.dep_share_pct, Decimal("25.00"))
        self.assertEqual(damario.drm_share_pct, Decimal("25.00"))
        # Contrôle / Mandat d'encaissement via PWR
        self.assertTrue(damario.is_controlled)
        self.assertEqual(damario.controlled_by_name, "Soc Une Musique")

        self.assertIn("Rigaudiere Edouard", splits_by_name)
        rigaudiere = splits_by_name["Rigaudiere Edouard"]
        self.assertEqual(rigaudiere.role, "C")
        self.assertIsNone(rigaudiere.ipi_number)
        self.assertEqual(rigaudiere.dep_share_pct, Decimal("25.00"))
        self.assertEqual(rigaudiere.drm_share_pct, Decimal("25.00"))
        self.assertTrue(rigaudiere.is_controlled)
        self.assertEqual(rigaudiere.controlled_by_name, "Soc Une Musique")

        # 3. Équilibre strict à 100.00 %
        total_dep = sum(s.dep_share_pct for s in w["splits"])
        total_drm = sum(s.drm_share_pct for s in w["splits"])
        self.assertEqual(total_dep, Decimal("100.00"))
        self.assertEqual(total_drm, Decimal("100.00"))

    def test_multiple_subtitles_and_alternate_titles_semicolon_delimited(self) -> None:
        """Vérifie que plusieurs sous-titres et alias séparés par ';' avec espaces variables sont correctement nettoyés et stockés."""
        from app.api.routers.catalog import _normalize_subtitles_and_aliases

        # 1. Test unitaire de la fonction de normalisation
        sub_raw = "Thème Giulia ; 7 Ans Plus Tard ;  BO Série Intracables;Version Instrumentale "
        alt_raw = ["Générique Fin ;  Radio Edit", " Club Mix;Slow Version "]
        primary_sub, cleaned_alts = _normalize_subtitles_and_aliases(sub_raw, alt_raw)

        self.assertEqual(primary_sub, "Thème Giulia")
        self.assertEqual(
            cleaned_alts,
            [
                "7 Ans Plus Tard",
                "BO Série Intracables",
                "Version Instrumentale",
                "Générique Fin",
                "Radio Edit",
                "Club Mix",
                "Slow Version",
            ],
        )

        # 2. Test via l'API POST /api/v1/works
        res = self.client.post(
            "/api/v1/works",
            json={
                "title": "Oeuvre Test Multi Sous-titres",
                "subtitle": "Sous-titre 1 ; Sous-titre 2 ;  Sous-titre 3",
                "alternate_titles": ["Alias A ; Alias B"],
                "splits": [
                    {
                        "holder_name": "Auteur Test",
                        "role": "AC",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "share_percentage": "50.00",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "share_percentage": "50.00",
                    },
                ],
            },
        )
        self.assertEqual(res.status_code, 201)
        created_work = res.json()
        self.assertEqual(created_work["subtitle"], "Sous-titre 1")
        self.assertEqual(
            created_work["alternate_titles"],
            ["Sous-titre 2", "Sous-titre 3", "Alias A", "Alias B"],
        )

    def test_controlled_copublishing_mandates_and_perception(self) -> None:
        """US-5.15 : Vérifie la gestion des droits contrôlés, coédition et mandats d'encaissement."""
        res = self.client.post(
            "/api/v1/works",
            json={
                "title": "Oeuvre Test Mandat Coedition",
                "splits": [
                    {
                        "holder_name": "Auteur Mandaté",
                        "role": "AC",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "share_percentage": "50.00",
                        "is_controlled": True,
                        "controlled_by_name": "Éditions Solstices Music",
                    },
                    {
                        "holder_name": "Coéditeur Direct",
                        "role": "E",
                        "dep_share_pct": "25.00",
                        "drm_share_pct": "25.00",
                        "share_percentage": "25.00",
                        "is_controlled": False,
                        "controlled_by_name": None,
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "dep_share_pct": "25.00",
                        "drm_share_pct": "25.00",
                        "share_percentage": "25.00",
                        "is_controlled": True,
                        "controlled_by_name": "Éditions Solstices Music",
                    },
                ],
            },
        )
        self.assertEqual(res.status_code, 201)
        work_data = res.json()
        work_id = work_data["id"]

        splits = {s["holder_name"]: s for s in work_data["splits"]}
        self.assertTrue(splits["Auteur Mandaté"]["is_controlled"])
        self.assertEqual(splits["Auteur Mandaté"]["controlled_by_name"], "Éditions Solstices Music")

        self.assertFalse(splits["Coéditeur Direct"]["is_controlled"])
        self.assertIsNone(splits["Coéditeur Direct"]["controlled_by_name"])

        self.assertTrue(splits["Éditions Solstices Music"]["is_controlled"])
        self.assertEqual(splits["Éditions Solstices Music"]["controlled_by_name"], "Éditions Solstices Music")

        # Test de mise à jour des mandats via PUT /api/v1/works/{id}
        update_res = self.client.put(
            f"/api/v1/works/{work_id}",
            json={
                "title": "Oeuvre Test Mandat Coedition",
                "splits": [
                    {
                        "holder_name": "Auteur Mandaté",
                        "role": "AC",
                        "dep_share_pct": "50.00",
                        "drm_share_pct": "50.00",
                        "share_percentage": "50.00",
                        "is_controlled": False,
                        "controlled_by_name": None,
                    },
                    {
                        "holder_name": "Coéditeur Direct",
                        "role": "E",
                        "dep_share_pct": "25.00",
                        "drm_share_pct": "25.00",
                        "share_percentage": "25.00",
                        "is_controlled": True,
                        "controlled_by_name": "Éditions Solstices Music",
                    },
                    {
                        "holder_name": "Éditions Solstices Music",
                        "role": "E",
                        "dep_share_pct": "25.00",
                        "drm_share_pct": "25.00",
                        "share_percentage": "25.00",
                        "is_controlled": True,
                        "controlled_by_name": "Éditions Solstices Music",
                    },
                ],
            },
        )
        self.assertEqual(update_res.status_code, 200)
        updated_data = update_res.json()
        updated_splits = {s["holder_name"]: s for s in updated_data["splits"]}

        self.assertFalse(updated_splits["Auteur Mandaté"]["is_controlled"])
        self.assertIsNone(updated_splits["Auteur Mandaté"]["controlled_by_name"])
        self.assertTrue(updated_splits["Coéditeur Direct"]["is_controlled"])
        self.assertEqual(updated_splits["Coéditeur Direct"]["controlled_by_name"], "Éditions Solstices Music")
