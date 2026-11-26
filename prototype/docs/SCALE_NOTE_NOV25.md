# SCALE NOTE — RightsCopilot at Scale (Data Engineering & MLOps)
**Albert Native · M2 · Target Milestone: November 25 & December 18, 2026**  
**Owner:** Ariane Boulet

---

## 1. Why Scaling Matters in Independent Music Publishing
As documented in our Market Research, independent music publishers face an exponential data volume challenge that crashes Microsoft Excel (`XLOOKUP` / VBA) and legacy 1990s desktop software (*Le Sage*, *Music Maestro / Vistex*):
* **500,000 to 5,000,000+ rows per quarterly distribution** (driven by micro-pennies from 800M+ global paid streaming subscribers across Spotify, Apple Music, TikTok, YouTube, and 228 CMOs/PROs in 111 CISAC countries).
* **12.7 million registered musical works** in the French repertoire (+9.5%/year).
* **Mandatory 2026–2027 French Electronic Invoicing (Factur-X / e-reporting)** requiring immutable, cent-accurate audit trails for every royalty payout and SSAA/IRCEC deduction.

---

## 2. Data Engineering Architecture at Scale (500k+ Rows in < 15 Seconds)

```
[Raw PRO/DSP CSV/CRD (500k–5M rows)]
        │
        ▼
[1. Streaming Chunk Ingestion & Schema Normalization (Polars / DuckDB)]
        │
        ▼
[2. Fingerprint Deduplication Layer: (normalized_title, raw_performer, iswc, isrc)]
   (Reduces 500,000 streaming rows -> ~1,500 unique work signatures = 99.7% compute reduction)
        │
        ├──► Stage A: Exact ISWC / ISRC / Learned Alias Hash Lookup (O(1) Redis / Postgres Index)
        │
        └──► Stage B: Batch Fastembed Vectorization + pgvector HNSW Cosine Search (Top-3 Candidates)
                │
                ▼
[3. Human-in-the-Loop Arbitration UI (Grouped by Unique Signature)]
        │
        ▼
[4. Set-Based Deterministic Decimal Allocation, IRCEC Précompte & Advance Recoupment Ledger]
```

### Key Data Engineering Decisions:
1. **Signature Deduplication Before Embedding (`99.7%` Compute Reduction):**
   A 500,000-row DSP statement does not contain 500,000 distinct songs; it contains ~1,500 catalog works repeated across 180 territories and 30 exploitation types. By grouping incoming rows by a deterministic SHA-256 fingerprint of `(normalized_title, normalized_performer, raw_iswc, raw_isrc)` *before* calling the embedding model, RightsCopilot runs `fastembed` and `Human-in-the-Loop` validation only once per unique signature, then fans out the validated `matched_work_id` across all 500,000 rows in $O(N)$ SQL join time.
2. **HNSW Vector Indexing in PostgreSQL (`pgvector`):**
   Instead of in-memory linear scans ($O(N \times M)$), catalog embeddings (`384`-d `intfloat/multilingual-e5-small`) are indexed with `CREATE INDEX ON works USING hnsw (title_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`, keeping Top-3 candidate retrieval under `5 ms` per query even on catalogs exceeding 1,000,000 works.
3. **Immutable Double-Entry Advance & Royalty Ledger:**
   Every royalty run writes immutable `RoyaltyAllocation` and `AuditLog` records using `NUMERIC(14, 2)` and Python `Decimal(ROUND_HALF_UP)`, ensuring strict idempotency and 2026–2027 French tax/e-invoicing compliance.

---

## 3. MLOps Pipeline: Continuous Learning, Evaluation & Drift Monitoring

1. **Active Institutional Memory (`LEARNED_ALIAS` Feedback Loop):**
   Every time a Royalty Manager validates or overrides an AI match in the UI (`POST /api/v1/statements/lines/{id}/validate`), the noisy string (e.g., `"Bohemian Rhaps - Remastered"` or `"Lumiere Noir Feat. K-Soprano"`) is appended to the canonical work’s `alternate_titles` and logged in `AuditLog`. Subsequent imports bypass fuzzy matching entirely (`MatchMethod.LEARNED_ALIAS`, confidence `1.00`).
2. **Offline Golden Dataset & CI Regression Gate (`pytest`):**
   We maintain a curated benchmark of real-world noisy French/international music publishing edge cases (missing diacritics, truncated remasters, inverted `"LastName, FirstName"` performers, 3-way splits `33.33% / 33.33% / 33.34%`, CWR v2.1 conflict detection). Every change to the hybrid weights ($\alpha \cdot \text{vector} + (1-\alpha) \cdot \text{lexical}$) must maintain `Precision@1 >= 95%` on high-confidence predictions ($\ge 0.90$) and `0` false-positive auto-validations.
3. **Confidence Calibration & Drift Monitoring:**
   In production, we track the **Human Override Rate per Confidence Bucket** (`[0.90–1.00]`, `[0.65–0.89]`, `< 0.65`) and per CMO/DSP source. If a new DSP changes its CSV title formatting and causes the `< 0.65` anomaly rate to spike above `15%`, an alert triggers a new `CSVImportProfile` rule without touching the financial engine.
