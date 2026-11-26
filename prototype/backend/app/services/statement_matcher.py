from dataclasses import dataclass

from app.models.work import Work
from app.schemas.common import ValidationStatus
from app.schemas.statement import (
    CandidateWorkMatch,
    MatchMethod,
    StatementLineCreate,
    StatementLineMatch,
)
from app.services.embedding_service import (
    compute_text_embedding,
    cosine_similarity,
    lexical_similarity,
    normalize_music_title,
)


def _format_splits_summary(work: Work, right_type: str) -> str:
    """Formate un résumé déterministe de la clé de répartition applicable pour l'explicabilité ligne par ligne."""
    splits = work.splits or []
    if not splits:
        return f"Clé {right_type} catalogue"
    parts: list[str] = []
    for sp in splits:
        name = sp.get("holder_name", "Ayant droit") if isinstance(sp, dict) else getattr(sp, "holder_name", "Ayant droit")
        role = sp.get("role", "") if isinstance(sp, dict) else getattr(sp, "role", "")
        if right_type == "DRM":
            pct = sp.get("drm_share_pct") if isinstance(sp, dict) else getattr(sp, "drm_share_pct", "50.00")
        elif right_type == "SYNC":
            pct = sp.get("sync_share_pct") if isinstance(sp, dict) else getattr(sp, "sync_share_pct", "50.00")
        elif right_type == "PHONO":
            pct = sp.get("phono_share_pct") if isinstance(sp, dict) else getattr(sp, "phono_share_pct", "50.00")
        else:
            pct = sp.get("dep_share_pct") if isinstance(sp, dict) else getattr(sp, "dep_share_pct", "50.00")
        parts.append(f"{pct}% {name} ({role})")
    return f"Clé déterministe {right_type} : " + " / ".join(parts)


@dataclass
class _PrecomputedWorkEntry:
    work: Work
    norm_title: str
    norm_alt_titles: list[str]
    all_raw_titles: list[str]
    embedding: list[float]


class CatalogMatchIndex:
    """Index en mémoire O(1) + vecteurs pré-calculés pour éliminer la complexité O(N × M) lors de l'import de relevés massifs."""

    def __init__(self, catalog_works: list[Work]) -> None:
        self.works = catalog_works
        self.by_id: dict = {}
        self.by_iswc: dict[str, Work] = {}
        self.by_sacem_code: dict[str, Work] = {}
        self.by_isrc: dict[str, Work] = {}
        self.by_exact_norm_title: dict[str, Work] = {}
        self.by_learned_alias: dict[str, Work] = {}
        self.entries: list[_PrecomputedWorkEntry] = []

        for work in catalog_works:
            self.by_id[work.id] = work
            if work.iswc:
                norm_iswc = work.iswc.strip().upper()
                if norm_iswc:
                    self.by_iswc[norm_iswc] = work

            if getattr(work, "sacem_work_code", None):
                norm_sacem = work.sacem_work_code.strip().replace(" ", "").replace(".", "")
                if norm_sacem:
                    self.by_sacem_code[norm_sacem] = work

            for isrc in work.isrc_codes or []:
                norm_isrc = isrc.strip().upper()
                if norm_isrc:
                    self.by_isrc[norm_isrc] = work

            norm_title = normalize_music_title(work.title)
            if norm_title and norm_title not in self.by_exact_norm_title:
                self.by_exact_norm_title[norm_title] = work

            norm_alts: list[str] = []
            for alt in work.alternate_titles or []:
                if alt:
                    na = normalize_music_title(alt)
                    if na:
                        norm_alts.append(na)
                        if na not in self.by_learned_alias:
                            self.by_learned_alias[na] = work

            vec = work.embedding
            if not vec:
                corpus = " ".join([work.title, *(work.alternate_titles or []), *(work.performers or [])])
                vec = compute_text_embedding(corpus)

            self.entries.append(
                _PrecomputedWorkEntry(
                    work=work,
                    norm_title=norm_title,
                    norm_alt_titles=norm_alts,
                    all_raw_titles=[work.title, *(work.alternate_titles or [])],
                    embedding=vec,
                )
            )


def match_statement_line_to_catalog(
    line: StatementLineCreate,
    catalog_works: list[Work],
    vector_weight: float = 0.45,
    lexical_weight: float = 0.55,
    catalog_index: CatalogMatchIndex | None = None,
) -> StatementLineMatch:
    """Associe une ligne de relevé CSV au catalogue d'œuvres avec score de confiance [0.0, 1.0].

    Étapes :
    1. Correspondance O(1) exacte sur code ISWC (confidence = 1.00).
    2. Correspondance O(1) exacte sur code ISRC (confidence = 0.99).
    3. Correspondance O(1) sur alias appris (confidence = 0.98) ou titre normalisé exact (confidence = 0.96).
    4. Rapprochement hybride (similarité cosinus d'embeddings pré-calculés + similarité lexicale).
    Toutes les lignes restent en statut PENDING_REVIEW pour validation humaine (Human-in-the-loop).
    """
    if not catalog_works:
        return StatementLineMatch(
            **line.model_dump(),
            matched_work_id=None,
            matched_work_title=None,
            match_method=MatchMethod.EMBEDDING_VECTOR,
            match_reasoning="Aucune œuvre présente dans le catalogue.",
            confidence_score=0.0,
            validation_status=ValidationStatus.PENDING_REVIEW,
            top_match=None,
            alternatives=[],
        )

    idx = catalog_index or CatalogMatchIndex(catalog_works)
    raw_iswc = (line.raw_iswc or "").strip().upper()
    raw_isrc = (line.raw_isrc or "").strip().upper()
    norm_raw_title = normalize_music_title(line.raw_work_title)

    # 1. Exact ISWC en O(1)
    if raw_iswc and raw_iswc in idx.by_iswc:
        work = idx.by_iswc[raw_iswc]
        candidate = CandidateWorkMatch(
            work_id=work.id,
            work_title=work.title,
            iswc=work.iswc,
            performers=work.performers or [],
            cosine_similarity=1.0,
            lexical_similarity=1.0,
            combined_confidence=1.0,
            match_method=MatchMethod.EXACT_ISWC,
        )
        return StatementLineMatch(
            **line.model_dump(),
            matched_work_id=work.id,
            matched_work_title=work.title,
            match_method=MatchMethod.EXACT_ISWC,
            match_reasoning=(
                f"Identifiant ISWC exact ({raw_iswc}) reconnu sans ambiguïté → "
                f"{_format_splits_summary(work, line.right_type)}"
            ),
            confidence_score=1.0,
            validation_status=ValidationStatus.PENDING_REVIEW,
            top_match=candidate,
            alternatives=[candidate],
        )

    # 1b. Exact Code SACEM / COCV en O(1)
    raw_sacem = (getattr(line, "raw_sacem_code", None) or "").strip().replace(" ", "").replace(".", "")
    # Fallback : si raw_iswc est en fait un code numérique SACEM à 10-11 chiffres
    if not raw_sacem and raw_iswc and raw_iswc.isdigit() and len(raw_iswc) in (10, 11, 12):
        raw_sacem = raw_iswc

    if raw_sacem and raw_sacem in idx.by_sacem_code:
        work = idx.by_sacem_code[raw_sacem]
        candidate = CandidateWorkMatch(
            work_id=work.id,
            work_title=work.title,
            iswc=work.iswc,
            performers=work.performers or [],
            cosine_similarity=1.0,
            lexical_similarity=1.0,
            combined_confidence=1.0,
            match_method=MatchMethod.EXACT_SACEM_CODE,
        )
        return StatementLineMatch(
            **line.model_dump(),
            matched_work_id=work.id,
            matched_work_title=work.title,
            match_method=MatchMethod.EXACT_SACEM_CODE,
            match_reasoning=(
                f"Code Œuvre SACEM / COCV exact ({raw_sacem}) reconnu sans ambiguïté → "
                f"{_format_splits_summary(work, line.right_type)}"
            ),
            confidence_score=1.0,
            validation_status=ValidationStatus.PENDING_REVIEW,
            top_match=candidate,
            alternatives=[candidate],
        )

    # 2. Exact ISRC en O(1)
    if raw_isrc and raw_isrc in idx.by_isrc:
        work = idx.by_isrc[raw_isrc]
        candidate = CandidateWorkMatch(
            work_id=work.id,
            work_title=work.title,
            iswc=work.iswc,
            performers=work.performers or [],
            cosine_similarity=1.0,
            lexical_similarity=0.99,
            combined_confidence=0.99,
            match_method=MatchMethod.EXACT_ISRC,
        )
        return StatementLineMatch(
            **line.model_dump(),
            matched_work_id=work.id,
            matched_work_title=work.title,
            match_method=MatchMethod.EXACT_ISRC,
            match_reasoning=(
                f"ISWC absent • Code ISRC Master ({raw_isrc}) relié à '{work.title}' → "
                f"{_format_splits_summary(work, line.right_type)}"
            ),
            confidence_score=0.99,
            validation_status=ValidationStatus.PENDING_REVIEW,
            top_match=candidate,
            alternatives=[candidate],
        )

    # 3a. Alias mémorisé exact en O(1)
    if norm_raw_title and norm_raw_title in idx.by_learned_alias and norm_raw_title not in idx.by_exact_norm_title:
        work = idx.by_learned_alias[norm_raw_title]
        candidate = CandidateWorkMatch(
            work_id=work.id,
            work_title=work.title,
            iswc=work.iswc,
            performers=work.performers or [],
            cosine_similarity=0.98,
            lexical_similarity=1.0,
            combined_confidence=0.98,
            match_method=MatchMethod.LEARNED_ALIAS,
        )
        return StatementLineMatch(
            **line.model_dump(),
            matched_work_id=work.id,
            matched_work_title=work.title,
            match_method=MatchMethod.LEARNED_ALIAS,
            match_reasoning=(
                f"Alias mémorisé ('{line.raw_work_title}') issu d'une validation humaine antérieure → "
                f"{_format_splits_summary(work, line.right_type)}"
            ),
            confidence_score=0.98,
            validation_status=ValidationStatus.PENDING_REVIEW,
            top_match=candidate,
            alternatives=[candidate],
        )

    # 3b. Titre principal normalisé exact en O(1)
    if norm_raw_title and norm_raw_title in idx.by_exact_norm_title:
        work = idx.by_exact_norm_title[norm_raw_title]
        candidate = CandidateWorkMatch(
            work_id=work.id,
            work_title=work.title,
            iswc=work.iswc,
            performers=work.performers or [],
            cosine_similarity=0.96,
            lexical_similarity=1.0,
            combined_confidence=0.96,
            match_method=MatchMethod.EXACT_TITLE,
        )
        return StatementLineMatch(
            **line.model_dump(),
            matched_work_id=work.id,
            matched_work_title=work.title,
            match_method=MatchMethod.EXACT_TITLE,
            match_reasoning=(
                f"Titre normalisé exact sans code ISWC → Rattaché à '{work.title}' ({work.iswc or 'N/A'}) → "
                f"{_format_splits_summary(work, line.right_type)}"
            ),
            confidence_score=0.96,
            validation_status=ValidationStatus.PENDING_REVIEW,
            top_match=candidate,
            alternatives=[candidate],
        )

    # 4. Évaluation vectorielle + lexicale sur les entrées pré-indexées
    query_text = f"{line.raw_work_title} {line.raw_performer or ''}".strip()
    query_vec = compute_text_embedding(query_text)

    candidates: list[CandidateWorkMatch] = []
    for entry in idx.entries:
        work = entry.work
        best_lex = max((lexical_similarity(line.raw_work_title, t) for t in entry.all_raw_titles), default=0.0)
        cos_sim = cosine_similarity(query_vec, entry.embedding)

        if entry.norm_title == norm_raw_title:
            method = MatchMethod.EXACT_TITLE
            combined = 0.96
        elif norm_raw_title in entry.norm_alt_titles:
            method = MatchMethod.LEARNED_ALIAS
            combined = 0.98
        else:
            combined = round(min(0.95, vector_weight * cos_sim + lexical_weight * best_lex), 4)
            method = (
                MatchMethod.EMBEDDING_VECTOR
                if cos_sim >= best_lex
                else MatchMethod.FUZZY_STRING
            )

        candidates.append(
            CandidateWorkMatch(
                work_id=work.id,
                work_title=work.title,
                iswc=work.iswc,
                performers=work.performers or [],
                cosine_similarity=cos_sim,
                lexical_similarity=best_lex,
                combined_confidence=combined,
                match_method=method,
            )
        )

    candidates.sort(key=lambda c: c.combined_confidence, reverse=True)
    top_candidates = candidates[:3]
    best = top_candidates[0]
    best_work = idx.by_id.get(best.work_id)
    splits_summary = _format_splits_summary(best_work, line.right_type) if best_work else f"Clé {line.right_type}"

    reasoning = (
        f"ISWC manquant / titre bruité → Similarité sémantique Fastembed {int(round(best.cosine_similarity * 100))}% "
        f"+ lexicale {int(round(best.lexical_similarity * 100))}% avec '{best.work_title}' → "
        f"{splits_summary}"
    )

    return StatementLineMatch(
        **line.model_dump(),
        matched_work_id=best.work_id,
        matched_work_title=best.work_title,
        match_method=best.match_method,
        match_reasoning=reasoning,
        confidence_score=best.combined_confidence,
        validation_status=ValidationStatus.PENDING_REVIEW,
        top_match=best,
        alternatives=top_candidates,
    )


def match_statement_lines_batch(
    lines: list[StatementLineCreate],
    catalog_works: list[Work],
) -> list[StatementLineMatch]:
    """Exécute le Smart Matching en lot avec indexation O(1) et déduplication des tuples identiques.

    Sur un relevé DSP/DSR où le même titre apparaît sur 150 territoires et 20 offres d'abonnement,
    le calcul de matching n'est exécuté qu'une seule fois par signature unique `(iswc, isrc, norm_title, norm_performer, right_type)`.
    """
    catalog_index = CatalogMatchIndex(catalog_works)
    dedup_cache: dict[tuple[str, str, str, str, str], StatementLineMatch] = {}
    results: list[StatementLineMatch] = []

    for line in lines:
        sig = (
            (line.raw_iswc or "").strip().upper(),
            (line.raw_isrc or "").strip().upper(),
            normalize_music_title(line.raw_work_title),
            normalize_music_title(line.raw_performer or ""),
            line.right_type,
        )
        cached = dedup_cache.get(sig)
        if cached is not None:
            results.append(
                StatementLineMatch(
                    **line.model_dump(),
                    matched_work_id=cached.matched_work_id,
                    matched_work_title=cached.matched_work_title,
                    match_method=cached.match_method,
                    match_reasoning=cached.match_reasoning,
                    confidence_score=cached.confidence_score,
                    validation_status=ValidationStatus.PENDING_REVIEW,
                    top_match=cached.top_match,
                    alternatives=cached.alternatives,
                )
            )
        else:
            matched = match_statement_line_to_catalog(
                line=line,
                catalog_works=catalog_works,
                catalog_index=catalog_index,
            )
            dedup_cache[sig] = matched
            results.append(matched)

    return results
