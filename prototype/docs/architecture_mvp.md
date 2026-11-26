# Architecture MVP - Hackathon 8 Semaines

## Scope strict du MVP
1. **Document AI (FastAPI + OpenRouter LLM) :**
   - Upload PDF de contrats d'édition.
   - Extraction structurée vers un schéma Pydantic strict (titre, parties, codes IPI, parts DEP/DRM, avance).
2. **Smart Matching (pgvector / Fastembed) :**
   - Upload de fichiers de ventes CSV bruts.
   - Embeddings sémantiques et similarité cosinus pour associer les titres sales au catalogue d'œuvres internes avec score de confiance (0 à 1).
3. **Moteur déterministe & Interface (Next.js / Tailwind) :**
   - Calcul mathématique strict des quotes-parts et recoupement d'avances.
   - Validation humaine (« Human-in-the-loop ») avant enregistrement final.
   - Validation syntaxique pré-CWR (somme des splits = 100 %).
