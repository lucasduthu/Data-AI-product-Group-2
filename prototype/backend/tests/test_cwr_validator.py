import unittest
from decimal import Decimal

from app.schemas.work import RightHolderRole, RightHolderSplit
from app.services.cwr_validator import validate_work_cwr


class TestCWRValidator(unittest.TestCase):
    """Tests déterministes du validateur pré-CWR (Jalon 1)."""

    def test_valid_work_is_cwr_ready(self) -> None:
        splits = [
            RightHolderSplit(
                holder_name="Camille Moreau",
                role=RightHolderRole.AC,
                ipi_number="00458912301",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ),
            RightHolderSplit(
                holder_name="Éditions Solstices Music",
                role=RightHolderRole.E,
                ipi_number="00891234567",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ),
        ]
        report = validate_work_cwr(
            work_title="Lumière Noire",
            splits=splits,
            iswc="T-301.452.891-4",
        )
        self.assertTrue(report.is_cwr_ready)
        self.assertEqual(report.dep_total_pct, Decimal("100.00"))
        self.assertEqual(report.drm_total_pct, Decimal("100.00"))
        self.assertEqual(len(report.blocking_errors), 0)

    def test_invalid_dep_split_sum_blocks_cwr(self) -> None:
        splits = [
            RightHolderSplit(
                holder_name="Sami Benali",
                role=RightHolderRole.AC,
                ipi_number="00398765432",
                dep_share_pct=Decimal("40.00"),
                drm_share_pct=Decimal("50.00"),
            ),
            RightHolderSplit(
                holder_name="Éditions Solstices Music",
                role=RightHolderRole.E,
                ipi_number="00891234567",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ),
        ]
        report = validate_work_cwr(
            work_title="Orage d'Octobre",
            splits=splits,
            iswc="T-304.901.223-1",
        )
        self.assertFalse(report.is_cwr_ready)
        self.assertEqual(report.dep_total_pct, Decimal("90.00"))
        self.assertTrue(any("-10.00 %" in err for err in report.blocking_errors))

    def test_missing_ipi_or_publisher_over_50_blocks_cwr(self) -> None:
        splits = [
            RightHolderSplit(
                holder_name="Auteur Sans IPI",
                role=RightHolderRole.A,
                ipi_number=None,
                dep_share_pct=Decimal("40.00"),
                drm_share_pct=Decimal("40.00"),
            ),
            RightHolderSplit(
                holder_name="Éditeur Majoritaire",
                role=RightHolderRole.E,
                ipi_number="00891234567",
                dep_share_pct=Decimal("60.00"),
                drm_share_pct=Decimal("60.00"),
            ),
        ]
        report = validate_work_cwr(
            work_title="Test Plafond Sacem",
            splits=splits,
            iswc="T-111.222.333-4",
        )
        self.assertFalse(report.is_cwr_ready)
        self.assertTrue(any("plafond éditorial" in err for err in report.blocking_errors))
        self.assertTrue(any("Code IPI manquant" in err for err in report.blocking_errors))

    def test_sacem_statutory_rule_r300_warning(self) -> None:
        """Vérifie l'avertissement informatif Sacem R-300 / R-306 lorsque la part éditeur dépasse 1/3 (33.34%) jusqu'à 50%."""
        splits = [
            RightHolderSplit(
                holder_name="Auteur Compositeur",
                role=RightHolderRole.AC,
                ipi_number="00112233445",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ),
            RightHolderSplit(
                holder_name="Éditeur",
                role=RightHolderRole.E,
                ipi_number="00891234567",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            ),
        ]
        report = validate_work_cwr(
            work_title="Œuvre Sous-Édition",
            splits=splits,
            iswc="T-999.888.777-6",
        )
        self.assertTrue(report.is_cwr_ready)
        self.assertTrue(any("R-300 / R-306" in w for w in report.warnings))

    def test_sacem_adaptation_and_arranger_roles(self) -> None:
        """Vérifie la conformité des rôles AD (Adaptateur) et AR (Arrangeur) selon RG art. 66-70 bis et 76."""
        splits = [
            RightHolderSplit(
                holder_name="Auteur Paroles",
                role=RightHolderRole.A,
                ipi_number="00112233401",
                dep_share_pct=Decimal("16.67"),
                drm_share_pct=Decimal("18.75"),
            ),
            RightHolderSplit(
                holder_name="Adaptateur Texte",
                role=RightHolderRole.AD,
                ipi_number="00112233402",
                dep_share_pct=Decimal("16.67"),
                drm_share_pct=Decimal("12.50"),
            ),
            RightHolderSplit(
                holder_name="Compositeur Musique",
                role=RightHolderRole.C,
                ipi_number="00112233403",
                dep_share_pct=Decimal("33.33"),
                drm_share_pct=Decimal("18.75"),
            ),
            RightHolderSplit(
                holder_name="Éditeur Original",
                role=RightHolderRole.E,
                ipi_number="00891234567",
                dep_share_pct=Decimal("33.33"),
                drm_share_pct=Decimal("50.00"),
            ),
        ]
        report = validate_work_cwr(
            work_title="Chanson Adaptée en Français",
            splits=splits,
            iswc="T-123.456.789-0",
        )
        self.assertTrue(report.is_cwr_ready)
        self.assertEqual(len(report.blocking_errors), 0)

    def test_sacem_portal_csv_migration_and_holders_sync(self) -> None:
        """Vérifie l'importation d'un export CSV de l'Espace SACEM (Mes_oeuvres_*.csv) avec fusion DE/DR, filtrage 0% et synchro Ayants Droit."""
        from sqlmodel import Session, SQLModel, create_engine, select
        from app.models.right_holder import RightHolderDirectory
        from app.models.work import Work
        from app.services.catalog_migration_service import run_catalog_migration

        sacem_csv_sample = (
            "\ufeffCode oeuvre;Titre de l'oeuvre;Sous-titre(s);Genre de l'oeuvre;ISWC;Date de déclaration;"
            "Rôle;Nom de l'ayant-droit;COAD;Nom au fichier IPI;Code IPI;Société en DE;Société en DR;"
            "Part DEP;Part DR;Part PHONO;Commentaire\n"
            "111779466467;ADK ABYSS;ABYSS;Instrumental;T-339.249.058-9;2026-03-16;C;PERON JOAN;752167;PERON JOAN;451389839;SACEM;SACEM;33,3300;25,0000;25,0000;\n"
            "111779466467;ADK ABYSS;ABYSS;Instrumental;T-339.249.058-9;2026-03-16;C;MARTIN DELION ALEXANDRE;328910;MARTIN DELION ALEXANDRE;418114682;SACEM;SACEM;33,3300;25,0000;25,0000;\n"
            "111779466467;ADK ABYSS;ABYSS;Instrumental;T-339.249.058-9;2026-03-16;E;KAPTAIN MUSIC (SACEM);2115892;KAPTAIN MUSIC;1325089654;SACEM;SACEM;33,3400;50,0000;50,0000;\n"
            "111779466467;ADK ABYSS;ABYSS;Instrumental;T-339.249.058-9;2026-03-16;E;KAPTAIN MUSIC (Pas de société);2115888;KAPTAIN MUSIC;1325089654;Pas de société;Pas de société;0,0000;0,0000;0,0000;\n"
            "111779443567;KTRL DOUBLE DOWN;;Musique illustrative;T-339.249.555-1;2026-03-16;C;;2652198;ROSLYN STUART ANDREW;265219857;PRS;Pas de Société;33,3330;0,0000;0,0000;\n"
            "111779443567;KTRL DOUBLE DOWN;;Musique illustrative;T-339.249.555-1;2026-03-16;C;;2652198;ROSLYN STUART ANDREW;265219857;Pas de Société;MCPS;0,0000;25,0000;25,0000;\n"
            "111779443567;KTRL DOUBLE DOWN;;Musique illustrative;T-339.249.555-1;2026-03-16;C;PERON JOAN;752167;PERON JOAN;451389839;SACEM;SACEM;33,3330;25,0000;25,0000;\n"
            "111779443567;KTRL DOUBLE DOWN;;Musique illustrative;T-339.249.555-1;2026-03-16;E;KAPTAIN MUSIC (SACEM);2115892;KAPTAIN MUSIC;1325089654;SACEM;SACEM;33,3330;50,0000;50,0000;\n"
        )

        engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            rep = run_catalog_migration(
                session=session,
                content=sacem_csv_sample,
                source_filename="Mes_oeuvres_20261110_2115892.csv",
                source_system="SACEM_CSV",
                dry_run=False,
            )
            self.assertEqual(rep.total_works_parsed, 2)
            self.assertEqual(rep.cwr_ready_works_count, 2)
            self.assertEqual(rep.cwr_conflict_works_count, 0)
            self.assertEqual(rep.holders_synced_count, 4)

            works = list(session.exec(select(Work)).all())
            self.assertEqual(len(works), 2)
            ktrl = next(w for w in works if w.title == "KTRL DOUBLE DOWN")
            self.assertEqual(ktrl.sacem_work_code, "111779443567")
            self.assertEqual(len(ktrl.splits), 3)
            roslyn = next(s for s in ktrl.splits if "ROSLYN" in s["holder_name"])
            self.assertEqual(roslyn["society_de"], "PRS")
            self.assertEqual(roslyn["society_dr"], "MCPS")

            holders = list(session.exec(select(RightHolderDirectory)).all())
            self.assertEqual(len(holders), 4)
            kaptain = next(h for h in holders if h.full_name == "KAPTAIN MUSIC")
            self.assertEqual(kaptain.entity_type, "SOCIETE")
            self.assertEqual(kaptain.coad_or_isni, "2115892")

    def test_cwr_v21_mandatory_work_title_and_length(self) -> None:
        """Vérifie la conformité CWR v2.1 (NWR) sur le titre obligatoire et la limite de 60 caractères."""
        splits = [
            RightHolderSplit(
                holder_name="Jean Dupont",
                role=RightHolderRole.AC,
                ipi_number="00123456789",
                dep_share_pct=Decimal("100.00"),
                drm_share_pct=Decimal("100.00"),
            )
        ]
        # Titre vide
        rep_empty = validate_work_cwr(work_title="", splits=splits)
        self.assertFalse(rep_empty.is_cwr_ready)
        self.assertTrue(any("titre de l'œuvre est obligatoire" in e for e in rep_empty.blocking_errors))

        # Titre > 60 caractères
        too_long = "A" * 65
        rep_long = validate_work_cwr(work_title=too_long, splits=splits)
        self.assertFalse(rep_long.is_cwr_ready)
        self.assertTrue(any("limite CWR v2.1 de 60 caractères" in e for e in rep_long.blocking_errors))

    def test_cwr_v21_mandatory_composer_rule(self) -> None:
        """Vérifie la règle CISAC R36 & Sacem Edit 41 : une œuvre doit contenir un compositeur (C ou CA/AC)."""
        # Seulement un auteur de texte (A) sans compositeur
        author_only_splits = [
            RightHolderSplit(
                holder_name="Poète Parolier",
                role=RightHolderRole.A,
                ipi_number="00123456789",
                dep_share_pct=Decimal("100.00"),
                drm_share_pct=Decimal("100.00"),
            )
        ]
        rep = validate_work_cwr(work_title="Poème Sans Musique", splits=author_only_splits)
        self.assertFalse(rep.is_cwr_ready)
        self.assertTrue(any("Compositeur (C) ou Auteur-Compositeur" in e for e in rep.blocking_errors))

    def test_cwr_v21_publisher_shares_without_publisher_party(self) -> None:
        """Vérifie le blocage si des parts éditeurs existent alors qu'aucun ayant droit éditeur n'est déclaré."""
        # Un ayant droit avec rôle Auteur mais une part éditoriale non rattachée à un SPU
        splits = [
            RightHolderSplit(
                holder_name="Artiste Soliste",
                role=RightHolderRole.AC,
                ipi_number="00123456789",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
            )
        ]
        # Ici dep_total = 50.00% != 100%, et pas d'éditeur
        rep = validate_work_cwr(work_title="Solo Work", splits=splits)
        self.assertFalse(rep.is_cwr_ready)

    def test_sacem_publisher_drm_and_phono_capped_at_50(self) -> None:
        """Vérifie que l'éditeur est strictement plafonné à 50.00% max sur le DRM et le PHONO."""
        # Éditeur à 60% en DRM -> Bloquant
        splits_drm_over = [
            RightHolderSplit(
                holder_name="Compositeur",
                role=RightHolderRole.C,
                ipi_number="00123456789",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("40.00"),
            ),
            RightHolderSplit(
                holder_name="Éditeur Gourmand",
                role=RightHolderRole.E,
                ipi_number="00987654321",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("60.00"),
            ),
        ]
        rep_drm = validate_work_cwr(work_title="Over DRM Pub", splits=splits_drm_over)
        self.assertFalse(rep_drm.is_cwr_ready)
        self.assertTrue(any("plafond éditorial Sacem DRM" in e for e in rep_drm.blocking_errors))

        # Éditeur à 60% en PHONO -> Bloquant
        splits_phono_over = [
            RightHolderSplit(
                holder_name="Compositeur",
                role=RightHolderRole.C,
                ipi_number="00123456789",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
                phono_share_pct=Decimal("40.00"),
            ),
            RightHolderSplit(
                holder_name="Éditeur Gourmand",
                role=RightHolderRole.E,
                ipi_number="00987654321",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
                phono_share_pct=Decimal("60.00"),
            ),
        ]
        rep_phono = validate_work_cwr(work_title="Over Phono Pub", splits=splits_phono_over)
        self.assertFalse(rep_phono.is_cwr_ready)
        self.assertTrue(any("plafond éditorial Sacem PHONO" in e for e in rep_phono.blocking_errors))

    def test_sacem_sync_excluded_from_validation(self) -> None:
        """Vérifie que le SYNC est exclu de la validation Sacem/CWR et ne bloque pas l'enregistrement même si sync != 100%."""
        splits = [
            RightHolderSplit(
                holder_name="Compositeur",
                role=RightHolderRole.C,
                ipi_number="00123456789",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
                sync_share_pct=Decimal("30.00"),  # Total SYNC = 30% != 100%
            ),
            RightHolderSplit(
                holder_name="Éditeur",
                role=RightHolderRole.E,
                ipi_number="00987654321",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("50.00"),
                sync_share_pct=Decimal("0.00"),
            ),
        ]
        rep = validate_work_cwr(work_title="Sync Free Work", splits=splits)
        # Ne doit pas avoir d'erreur de conflit de split SYNC
        self.assertTrue(rep.is_cwr_ready)
        self.assertFalse(any("SYNC" in e for e in rep.blocking_errors))

    def test_sacem_statutory_dep_one_third_rule_alert(self) -> None:
        """Vérifie l'alerte sur la clé statutaire standard Sacem DEP (1/3 Auteur, 1/3 Compositeur, 1/3 Éditeur)."""
        # Répartition standard 1/3 - 1/3 - 1/3 (33.33 / 33.33 / 33.34)
        splits_standard = [
            RightHolderSplit(
                holder_name="Parolier",
                role=RightHolderRole.A,
                ipi_number="00111111111",
                dep_share_pct=Decimal("33.33"),
                drm_share_pct=Decimal("25.00"),
            ),
            RightHolderSplit(
                holder_name="Mélodiste",
                role=RightHolderRole.C,
                ipi_number="00222222222",
                dep_share_pct=Decimal("33.33"),
                drm_share_pct=Decimal("25.00"),
            ),
            RightHolderSplit(
                holder_name="Éditeur",
                role=RightHolderRole.E,
                ipi_number="00333333333",
                dep_share_pct=Decimal("33.34"),
                drm_share_pct=Decimal("50.00"),
            ),
        ]
        rep_std = validate_work_cwr(work_title="Standard Sacem Chanson", splits=splits_standard)
        self.assertTrue(rep_std.is_cwr_ready)
        # Pas d'alerte sur la clé 1/3
        self.assertFalse(any("Alerte répartition statutaire Sacem DEP" in w for w in rep_std.warnings))

        # Répartition dérogatoire (ex: Auteur 50%, Compositeur 20%, Éditeur 30%)
        splits_derogatoire = [
            RightHolderSplit(
                holder_name="Parolier",
                role=RightHolderRole.A,
                ipi_number="00111111111",
                dep_share_pct=Decimal("50.00"),
                drm_share_pct=Decimal("25.00"),
            ),
            RightHolderSplit(
                holder_name="Mélodiste",
                role=RightHolderRole.C,
                ipi_number="00222222222",
                dep_share_pct=Decimal("20.00"),
                drm_share_pct=Decimal("25.00"),
            ),
            RightHolderSplit(
                holder_name="Éditeur",
                role=RightHolderRole.E,
                ipi_number="00333333333",
                dep_share_pct=Decimal("30.00"),
                drm_share_pct=Decimal("50.00"),
            ),
        ]
        rep_derog = validate_work_cwr(work_title="Derogatoire Chanson", splits=splits_derogatoire)
        self.assertTrue(rep_derog.is_cwr_ready)
        self.assertTrue(any("Alerte répartition statutaire Sacem DEP" in w for w in rep_derog.warnings))


if __name__ == "__main__":
    unittest.main()
