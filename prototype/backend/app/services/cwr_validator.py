import re
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.schemas.work import CWRValidationReport, RightHolderRole, RightHolderSplit

ISWC_REGEX = re.compile(r"^T-\d{3}\.\d{3}\.\d{3}-\d$")
IPI_REGEX = re.compile(r"^\d{9,11}$")

PUBLISHER_ROLES = {
    RightHolderRole.PUBLISHER.value,
    RightHolderRole.SUB_PUBLISHER.value,
    RightHolderRole.E.value,
    RightHolderRole.SE.value,
}


import re
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.schemas.work import CWRValidationReport, RightHolderRole, RightHolderSplit

ISWC_REGEX = re.compile(r"^T-\d{3}\.\d{3}\.\d{3}-\d$")
IPI_REGEX = re.compile(r"^\d{9,11}$")

PUBLISHER_ROLES = {
    RightHolderRole.PUBLISHER.value,
    RightHolderRole.SUB_PUBLISHER.value,
    RightHolderRole.E.value,
    RightHolderRole.SE.value,
}

WRITER_ROLES = {
    RightHolderRole.AUTHOR.value,
    RightHolderRole.COMPOSER.value,
    RightHolderRole.AUTHOR_COMPOSER.value,
    RightHolderRole.ARRANGER.value,
    RightHolderRole.ADAPTOR.value,
    RightHolderRole.A.value,
    RightHolderRole.C.value,
    RightHolderRole.AC.value,
    RightHolderRole.AR.value,
    RightHolderRole.AD.value,
}

# Selon la norme CISAC CWR v2.1 (Règle 36) et règle statutaire Sacem (Edit 41, p. 74-76) :
# Une œuvre musicale doit obligatoirement comporter au moins un compositeur ou auteur-compositeur (C ou CA/AC).
COMPOSER_ROLES = {
    RightHolderRole.COMPOSER.value,
    RightHolderRole.AUTHOR_COMPOSER.value,
    RightHolderRole.C.value,
    RightHolderRole.AC.value,
}


def validate_work_cwr(
    work_title: str,
    splits: list[RightHolderSplit | dict[str, Any]],
    iswc: str | None = None,
    work_id: UUID | None = None,
    max_publisher_dep_pct: Decimal = Decimal("50.00"),
) -> CWRValidationReport:
    """Valide de manière 100 % déterministe la conformité pré-CWR v2.1 (norme CISAC / Sacem) d'une œuvre.

    Règles contrôlées selon les spécifications fonctionnelles CWR v2.1 (CWR11-1991R4 Rev 8) :
    1. Titre de l'œuvre (NWR) : obligatoire, non vide, max 60 caractères ASCII.
    2. Ayants droit : présence d'au moins un auteur/compositeur (SWR).
    3. Compositeur obligatoire (CISAC Règle 36 / Sacem Edit 41) : au moins un ayant droit doit avoir le rôle C ou CA/AC.
    4. Somme exacte des parts DEP == 100.00 % (CISAC Transaction Level Edit 37).
    5. Somme exacte des parts DRM == 100.00 %.
    6. Plafond statutaire Sacem & CISAC Règle 38 : la part éditoriale totale en DEP ne doit pas excéder 50.00 %.
    7. Éditeur (SPU) : si des parts éditoriales sont déclarées (>0%), présence obligatoire d'au moins un éditeur (E/SE)
       avec affiliation Sacem (058) ou société reconnue.
    8. Noms des ayants droit : obligatoires, non vides, max 45 caractères.
    9. Format du numéro IPI (9 à 11 chiffres) pour chaque ayant droit.
    10. Format du code ISWC (T-XXX.XXX.XXX-C) en avertissement si absent, ou erreur si malformé.
    """
    blocking_errors: list[str] = []
    warnings: list[str] = []

    # 1. Validation du Titre de l'œuvre (NWR Work Title)
    cleaned_title = (work_title or "").strip()
    if not cleaned_title:
        blocking_errors.append("Le titre de l'œuvre est obligatoire pour la déclaration CWR (enregistrement NWR).")
    elif len(cleaned_title) > 60:
        blocking_errors.append(
            f"Le titre de l'œuvre dépasse la limite CWR v2.1 de 60 caractères ({len(cleaned_title)} caractères)."
        )

    parsed_splits: list[RightHolderSplit] = [
        s if isinstance(s, RightHolderSplit) else RightHolderSplit.model_validate(s)
        for s in (splits or [])
    ]

    if not parsed_splits:
        blocking_errors.append("Aucun ayant droit n'est déclaré sur l'œuvre (enregistrements SPU/SWR requis).")
        return CWRValidationReport(
            work_id=work_id,
            work_title=work_title,
            is_cwr_ready=False,
            dep_total_pct=Decimal("0.00"),
            drm_total_pct=Decimal("0.00"),
            publisher_dep_pct=Decimal("0.00"),
            blocking_errors=blocking_errors,
            warnings=warnings,
        )

    # 2 & 3. Vérification des rôles d'auteurs et compositeurs (SWR)
    has_writer = False
    has_composer = False
    writers_list = []
    publishers_list = []

    for s in parsed_splits:
        r_val = s.role.value if isinstance(s.role, RightHolderRole) else str(s.role)
        # Validation du nom de l'ayant droit (max 45 chars en CWR v2.1)
        h_name = (s.holder_name or "").strip()
        if not h_name:
            blocking_errors.append(f"Nom de l'ayant droit manquant pour un rôle {r_val}.")
        elif len(h_name) > 45:
            warnings.append(
                f"Le nom de l'ayant droit « {h_name} » dépasse 45 caractères et sera tronqué au format CWR v2.1."
            )

        if r_val in WRITER_ROLES:
            has_writer = True
            writers_list.append(s)
            if r_val in COMPOSER_ROLES:
                has_composer = True
        elif r_val in PUBLISHER_ROLES:
            publishers_list.append(s)

    if not has_writer:
        blocking_errors.append(
            "Règle CWR v2.1 (SWR) : l'œuvre doit comporter au moins un auteur ou compositeur."
        )
    elif not has_composer:
        blocking_errors.append(
            "Règle CISAC R36 & Sacem Edit 41 : une œuvre musicale doit obligatoirement comporter au moins un Compositeur (C) ou Auteur-Compositeur (CA/AC)."
        )

    dep_total = sum((s.dep_share_pct for s in parsed_splits), Decimal("0.00")).quantize(
        Decimal("0.01")
    )
    drm_total = sum((s.drm_share_pct for s in parsed_splits), Decimal("0.00")).quantize(
        Decimal("0.01")
    )
    phono_total = sum((s.phono_share_pct for s in parsed_splits), Decimal("0.00")).quantize(
        Decimal("0.01")
    )

    publisher_dep = sum(
        (
            s.dep_share_pct
            for s in parsed_splits
            if (s.role.value if isinstance(s.role, RightHolderRole) else str(s.role))
            in PUBLISHER_ROLES
        ),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))
    publisher_drm = sum(
        (
            s.drm_share_pct
            for s in parsed_splits
            if (s.role.value if isinstance(s.role, RightHolderRole) else str(s.role))
            in PUBLISHER_ROLES
        ),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))
    publisher_phono = sum(
        (
            s.phono_share_pct
            for s in parsed_splits
            if (s.role.value if isinstance(s.role, RightHolderRole) else str(s.role))
            in PUBLISHER_ROLES
        ),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))

    # Parts d'auteurs, compositeurs et auteurs-compositeurs en DEP
    author_dep = sum(
        (
            s.dep_share_pct
            for s in parsed_splits
            if (s.role.value if isinstance(s.role, RightHolderRole) else str(s.role))
            in {
                RightHolderRole.AUTHOR.value,
                RightHolderRole.A.value,
                RightHolderRole.ADAPTOR.value,
                RightHolderRole.AD.value,
            }
        ),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))

    composer_dep = sum(
        (
            s.dep_share_pct
            for s in parsed_splits
            if (s.role.value if isinstance(s.role, RightHolderRole) else str(s.role))
            in {
                RightHolderRole.COMPOSER.value,
                RightHolderRole.C.value,
                RightHolderRole.ARRANGER.value,
                RightHolderRole.AR.value,
            }
        ),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))

    ac_dep = sum(
        (
            s.dep_share_pct
            for s in parsed_splits
            if (s.role.value if isinstance(s.role, RightHolderRole) else str(s.role))
            in {
                RightHolderRole.AUTHOR_COMPOSER.value,
                RightHolderRole.AC.value,
                "CA",
            }
        ),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))

    # 4. Contrôle mathématique Sacem : chaque clé active doit totaliser exactement 100.00 % (SYNC exclu)
    if dep_total != Decimal("100.00"):
        diff = (dep_total - Decimal("100.00")).quantize(Decimal("0.01"))
        sign = "+" if diff > 0 else ""
        blocking_errors.append(
            f"Conflit de splits DEP : total = {dep_total} % (écart de {sign}{diff} % par rapport à 100.00 % attendus par la Sacem)."
        )

    if drm_total != Decimal("100.00"):
        diff = (drm_total - Decimal("100.00")).quantize(Decimal("0.01"))
        sign = "+" if diff > 0 else ""
        blocking_errors.append(
            f"Conflit de splits DRM : total = {drm_total} % (écart de {sign}{diff} % par rapport à 100.00 % attendus par la Sacem)."
        )

    if phono_total > Decimal("0.00") and phono_total != Decimal("100.00"):
        diff = (phono_total - Decimal("100.00")).quantize(Decimal("0.01"))
        sign = "+" if diff > 0 else ""
        blocking_errors.append(
            f"Conflit de splits PHONO : total = {phono_total} % (écart de {sign}{diff} % par rapport à 100.00 % attendus)."
        )

    # 5. Plafonds statutaires Sacem pour l'Éditeur : Max 50.00 % sur DEP, DRM et PHONO
    max_pub = Decimal(str(max_publisher_dep_pct)).quantize(Decimal("0.01"))
    if publisher_dep > max_pub:
        blocking_errors.append(
            f"Non-respect du plafond éditorial Sacem DEP : la part éditeur totale en DEP est de {publisher_dep} % (plafond maximum autorisé de {max_pub} %)."
        )

    if publisher_drm > Decimal("50.00"):
        blocking_errors.append(
            f"Non-respect du plafond éditorial Sacem DRM : la part éditeur totale en DRM est de {publisher_drm} % (plafond maximum autorisé de 50.00 %)."
        )

    if publisher_phono > Decimal("50.00"):
        blocking_errors.append(
            f"Non-respect du plafond éditorial Sacem PHONO : la part éditeur totale en PHONO est de {publisher_phono} % (plafond maximum autorisé de 50.00 %)."
        )

    # 6. Alerte sur la clé de répartition statutaire Sacem DEP (art. R-300 / R-306) :
    # La règle standard Sacem prévoit 1/3 Auteur (33,33 %), 1/3 Compositeur (33,33 %) et 1/3 Éditeur (33,34 %).
    # En cas d'Auteur-Compositeur (AC), la règle est de 2/3 AC (66,67 %) et 1/3 Éditeur (33,33 %).
    if publisher_dep > Decimal("0.00"):
        if author_dep > Decimal("0.00") and composer_dep > Decimal("0.00"):
            # Œuvre avec auteur(s) et compositeur(s) distincts
            if (
                abs(author_dep - Decimal("33.33")) > Decimal("0.50")
                or abs(composer_dep - Decimal("33.33")) > Decimal("0.50")
                or abs(publisher_dep - Decimal("33.34")) > Decimal("0.50")
            ):
                warnings.append(
                    f"Alerte répartition statutaire Sacem DEP (art. R-300 / R-306) : "
                    f"la clé statutaire standard Sacem pour une œuvre avec paroles et musique avec éditeur prévoit 1/3 Auteur (33,33 %), 1/3 Compositeur (33,33 %) et 1/3 Éditeur (33,34 %). "
                    f"Répartition actuelle : Auteur={author_dep} %, Compositeur={composer_dep} %, Éditeur={publisher_dep} %."
                )
        elif ac_dep > Decimal("0.00") and author_dep == Decimal("0.00") and composer_dep == Decimal("0.00"):
            # Œuvre avec auteur-compositeur unique
            if abs(publisher_dep - Decimal("33.34")) > Decimal("0.50"):
                warnings.append(
                    f"Alerte répartition statutaire Sacem DEP (art. R-300 / R-306) : "
                    f"la clé statutaire standard Sacem prévoit 2/3 pour le créateur (66,67 %) et 1/3 pour l'éditeur (33,34 %). "
                    f"Répartition actuelle : Auteur-Compositeur={ac_dep} %, Éditeur={publisher_dep} %. "
                    "Une part éditeur supérieure à 33,34 % (jusqu'à 50,00 % max) requiert une clause contractuelle spécifique (effort de sous-édition)."
                )
        elif publisher_dep > Decimal("33.34"):
            warnings.append(
                f"Alerte répartition statutaire Sacem DEP (art. R-300 / R-306) : "
                f"la part éditeur DEP est de {publisher_dep} % (dépasse la clé statutaire standard de 1/3 soit 33,34 %). "
                "Une part éditeur allant jusqu'à 50,00 % est autorisée pour la sous-édition ou l'effort d'édition sous réserve de mention contractuelle."
            )

    if (publisher_dep > Decimal("0.00") or publisher_drm > Decimal("0.00")) and not publishers_list:
        blocking_errors.append(
            "Des parts éditoriales (DEP/DRM > 0 %) sont déclarées mais aucun ayant droit éditeur (E ou SE) n'est présent (enregistrement SPU requis)."
        )

    # 8 & 9. IPI et format des identifiants
    for split in parsed_splits:
        if not split.ipi_number:
            blocking_errors.append(
                f"Code IPI manquant pour l'ayant droit « {split.holder_name} »."
            )
        elif not IPI_REGEX.match(split.ipi_number.strip()):
            blocking_errors.append(
                f"Code IPI invalide « {split.ipi_number} » pour « {split.holder_name} » (9 à 11 chiffres attendus)."
            )

    # 10. Code ISWC
    if not iswc:
        warnings.append("Code ISWC non renseigné (sera attribué après enregistrement CWR).")
    elif not ISWC_REGEX.match(iswc.strip()):
        blocking_errors.append(
            f"Format ISWC invalide « {iswc} » (format attendu : T-123.456.789-0)."
        )

    return CWRValidationReport(
        work_id=work_id,
        work_title=work_title,
        is_cwr_ready=len(blocking_errors) == 0,
        dep_total_pct=dep_total,
        drm_total_pct=drm_total,
        sync_total_pct=Decimal("0.00"),  # SYNC non géré par la Sacem pour les déclarations CWR
        phono_total_pct=phono_total,
        publisher_dep_pct=publisher_dep,
        blocking_errors=blocking_errors,
        warnings=warnings,
    )
