import hashlib
import math
import re
import unicodedata
from difflib import SequenceMatcher

EMBEDDING_DIM = 384
DEFAULT_FASTEMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

_fastembed_model = None
_fastembed_checked = False


def normalize_music_title(text: str) -> str:
    """Normalise un titre d'œuvre ou un nom d'interprète (accents, feat., versions, ponctuation)."""
    if not text:
        return ""
    lowered = text.lower().strip()
    decomposed = unicodedata.normalize("NFKD", lowered)
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    # Retire les mentions bruitées fréquentes dans les CSV DSP/Sacem
    cleaned = re.sub(
        r"\b(feat\.?|ft\.?|featuring|radio edit|remaster(?:ed)?|live|version|original mix|official video)\b.*$",
        "",
        without_accents,
    )
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _character_ngram_embedding(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Vecteur déterministe de n-grammes (384d normalisé L2) utilisé si le modèle Fastembed n'est pas en cache."""
    norm = normalize_music_title(text)
    if not norm:
        return [0.0] * dim

    vec = [0.0] * dim
    padded = f"  {norm}  "
    tokens = norm.split()

    # N-grammes de caractères (2, 3, 4) + mots entiers pour capturer sémantique & fautes de frappe
    features: list[tuple[str, float]] = []
    for tok in tokens:
        features.append((f"w:{tok}", 2.2))
        if len(tok) >= 4:
            features.append((f"p:{tok[:4]}", 1.5))
    for n in (2, 3, 4):
        for i in range(max(0, len(padded) - n + 1)):
            features.append((f"c{n}:{padded[i:i+n]}", 1.0))

    for feat, weight in features:
        digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if (digest[4] & 1) == 0 else -1.0
        vec[idx] += sign * weight

    norm_l2 = math.sqrt(sum(v * v for v in vec))
    if norm_l2 == 0.0:
        return vec
    return [round(v / norm_l2, 6) for v in vec]


def compute_text_embedding(text: str) -> list[float]:
    """Calcule l'embedding 384d d'une chaîne via Fastembed (ou vecteur n-gram L2 déterministe hors-ligne)."""
    global _fastembed_model, _fastembed_checked

    if not _fastembed_checked:
        _fastembed_checked = True
        try:
            import os

            if os.environ.get("USE_FASTEMBED_DOWNLOAD", "0") == "1":
                from fastembed import TextEmbedding

                _fastembed_model = TextEmbedding(model_name=DEFAULT_FASTEMBED_MODEL)
        except Exception:
            _fastembed_model = None

    if _fastembed_model is not None:
        try:
            vectors = list(_fastembed_model.embed([normalize_music_title(text)]))
            if vectors:
                return [float(x) for x in vectors[0]]
        except Exception:
            pass

    return _character_ngram_embedding(text, dim=EMBEDDING_DIM)


def cosine_similarity(vec_a: list[float] | None, vec_b: list[float] | None) -> float:
    """Calcule la similarité cosinus bornée dans [0.0, 1.0] entre deux vecteurs."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    raw = dot / (norm_a * norm_b)
    return round(max(0.0, min(1.0, raw)), 4)


def lexical_similarity(title_a: str, title_b: str) -> float:
    """Calcule la similarité lexicale normalisée [0.0, 1.0] entre deux titres d'œuvres."""
    norm_a = normalize_music_title(title_a)
    norm_b = normalize_music_title(title_b)
    if not norm_a or not norm_b:
        return 0.0
    if norm_a == norm_b:
        return 1.0
    ratio = SequenceMatcher(None, norm_a, norm_b).ratio()
    return round(max(0.0, min(1.0, ratio)), 4)


def reindex_all_works() -> int:
    """Recalcule et persiste les vecteurs d'embeddings 384d pour toutes les œuvres du catalogue."""
    from sqlmodel import Session, select

    from app.core.database import engine, init_db
    from app.models.work import Work

    init_db()
    updated_count = 0
    with Session(engine) as session:
        works = list(session.exec(select(Work)).all())
        for work in works:
            corpus = " ".join(
                [work.title, *(work.alternate_titles or []), *(work.performers or [])]
            )
            work.embedding = compute_text_embedding(corpus)
            session.add(work)
            updated_count += 1
        session.commit()
    return updated_count
