from io import BytesIO
import re


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extrait le texte structuré d'un fichier PDF (avec numérotation des pages).

    Si le flux fourni est déjà du texte brut (utile en test unitaire), le décode directement.
    """
    if not pdf_bytes:
        return ""

    if pdf_bytes.startswith(b"%PDF"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(pdf_bytes))
            pages_text: list[str] = []
            for idx, page in enumerate(reader.pages, start=1):
                page_content = page.extract_text() or ""
                pages_text.append(f"--- [PAGE {idx}] ---\n{page_content.strip()}")
            full_text = "\n\n".join(pages_text).strip()
            if full_text:
                return full_text
        except Exception:
            pass

    return pdf_bytes.decode("utf-8", errors="ignore").strip()


def validate_is_music_publishing_contract(text: str, filename: str = "") -> tuple[bool, str]:
    """Guardrail d'entrée (Input Validation & Safety Gate).
    
    Vérifie qu'un document téléversé est bien un contrat d'édition / cession musicale
    (ou de co-édition, ou lettre-accord d'artiste-interprète) avant d'engager
    le traitement LLM ou l'enregistrement en base.
    
    Retourne (is_valid, reason).
    """
    if not text or len(text.strip()) < 50:
        return (
            False,
            "Le document PDF est vide ou illisible (aucun texte textuel extrait). "
            "S'il s'agit d'un scan papier, veuillez vous assurer qu'il est OCRisé."
        )

    text_lower = text.lower()
    
    # 1. Vérification des signaux clés du droit d'auteur musical / contrats d'édition
    music_publishing_signals = [
        "cession",
        "edition",
        "édition",
        "co-edition",
        "coédition",
        "co-édition",
        "oeuvre",
        "œuvre",
        "compositeur",
        "auteur",
        "parolier",
        "editeur",
        "éditeur",
        "publishing",
        "songwriter",
        "composer",
        "musical work",
        "sacem",
        "csdem",
        "droits voisins",
        "reproduction mecanique",
        "reproduction mécanique",
        "sdrm",
        "lettre-accord",
        "cotage",
        "royalties",
        "redevance",
        "synchronisation",
        "phono",
    ]

    matched_signals = [sig for sig in music_publishing_signals if sig in text_lower]

    # Il faut au moins 3 termes juridiques / musicaux distincts caractéristiques d'un contrat musical
    if len(matched_signals) < 3:
        return (
            False,
            "Le document téléversé ne semble pas être un contrat de cession ou d'édition musicale valide "
            "(aucun terme caractéristique d'auteur, compositeur, éditeur, œuvre ou Sacem détecté). "
            "Par sécurité (Guardrail), le document n'a pas été traité pour éviter d'altérer le catalogue."
        )

    # 2. Rejet des documents manifestement hors sujet (ex: factures d'énergie, relevés bancaires, CV, etc.)
    non_contract_negative_patterns = [
        (r"\bfacture\s+d['’]electricite\b", "Facture d'électricité"),
        (r"\bfacture\s+edf\b", "Facture EDF"),
        (r"\breleve\s+d['’]identite\s+bancaire\b", "Relevé d'Identité Bancaire (RIB)"),
        (r"\bquittance\s+de\s+loyer\b", "Quittance de loyer"),
        (r"\bbulletin\s+de\s+(?:paie|salaire)\b", "Bulletin de paie"),
        (r"\bcurriculum\s+vitae\b", "Curriculum Vitae (CV)"),
    ]
    for pattern, label in non_contract_negative_patterns:
        if re.search(pattern, text_lower):
            return (
                False,
                f"Le document téléversé a été identifié comme un document non contractuel ({label}). "
                "Le système n'accepte que les contrats de cession, co-édition et liasses contractuelles musicales."
            )

    return (True, "Document valide.")

