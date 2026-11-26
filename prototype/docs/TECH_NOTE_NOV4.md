# TECH NOTE — RightsCopilot (*"Copyrights and royalties, streamlined."*)
**Albert Native · M2 · Session 3 · November 4, 2026 (Due 11:59 PM)**  
**Team / Owner:** Ariane Boulet

---

## 0 · Nadia’s Key Question: How severe and frequent is the pain point for your main ICP?
* **Main ICP:**
  * **Active User:** Copyrights & Royalties Managers (or Head of Copyrights/Royalties) at independent music publishers in France and Europe (4,500 indie publishers in our EU SAM; ~800 in France across CSDEM/CEMF/ULM, where 62.5% generate < €1M revenue and have no data engineering team).
  * **Economic Buyer:** The **CEO** (in small/medium indie publishers) or **CTO / Finance+IT Director**, currently paying **€3,000 to €23,000/year** for legacy tools plus maintenance fees.
* **Frequency (High & Mandatory):** Recurring **4 to 12+ times per year** — at every quarterly SACEM/SDRM distribution (Jan, Apr, Jul, Oct), monthly DSP/sub-publisher statements across **228 CMOs/PROs in 111 CISAC countries**, and every new catalog signing or CWR registration batch.
* **Severity (Mission-Critical — Zero Room for Error):**
  1. **Legacy Software Failure on Real-World Data:** Incumbent 1990s desktop tools like **Le Sage (Improvize, ~€8,500/yr)** and **Music Maestro (Vistex, ~€23,000/yr)** rely on rigid deterministic rules with zero typo tolerance. When incoming DSP/PRO CSV lines contain truncated titles or spelling variations (e.g., `"Bohemian Rhaps - Remastered"` / `"Qn"` or `"Lumiere Noir (Feat. K-Soprano) - Radio Edit"`), legacy systems reject them.
  2. **The Fragile Excel Workaround:** Royalty managers are forced to export raw statements into giant Microsoft Excel spreadsheets using nested `XLOOKUP`/`VLOOKUP` and VBA macros before re-importing into *Le Sage*. Excel crashes beyond **500,000+ streaming rows**, introduces rounding errors on 3-way splits (`33.33% / 33.33% / 33.34%`), and loses institutional memory.
  3. **Financial & Regulatory Risk:** Unmatched lines fall into the **6-to-18-month "Black Box"**, while French publishers face a **+22.5% surge in unrecouped catalog advances** (€91M cumulative unrecouped advances in a €597M French market). Meanwhile, US/UK administrators (*Songtrust*, *Notes.fm*) take **5%–15%+ gross commission** and lack mandatory French **SSAA / IRCEC social security deductions (précompte)** and **2026–2027 French electronic invoicing (Factur-X / e-reporting)** compliance.

---

## 1 · Hypothesis (ICP, Pain, and Our One Core Feature)

> **Core Feature Formula:**  
> **If** an independent music publisher’s **Royalty & Copyright Manager (ICP)** uses **RightsCopilot’s Hybrid Statement Reconciliation & Deterministic Royalty Engine** **when** importing messy multi-territory PRO/DSP CSV statements with truncated titles, missing ISWCs, and complex splits (`33.33% / 33.33% / 33.34%` or `50% / 50%`), **they get** an **audit-ready, SACEM/IRCEC-compliant payout and advance-recoupment plan in under 3 minutes—with the exact matching and financial reason behind every single line** (eliminating 80%+ of manual Excel `XLOOKUP` workarounds and recovering Black Box royalties at a flat **€3,600/year SaaS** price with **0% commission**).

---

## 2 · Interface: The Three-Minute Journey (Inputs & Outputs)

Can a target user or advisor try it without us via a shareable link? **Yes — through the built-in 3-Minute Self-Serve POC Mode:**

| Step | User Action (Input) | System Output ("With the reason behind every line") |
| :--- | :--- | :--- |
| **Minute 1 · Ingest Messy Statement** | User clicks **"Load Noisy SACEM/DSP Statement (3-Min Demo)"** (or uploads any `;` or `,` CSV file exported from SACEM, Believe, or DSPs). | Raw lines are parsed and normalized (`raw_work_title`, `raw_iswc`, `raw_isrc`, `right_type` [`DEP`, `DRM`, `SYNC`, `PHONO`], `gross_amount`). |
| **Minute 2 · Explainable AI Match & Human-in-the-Loop** | User reviews the color-coded Confidence Badges (`≥ 90%` Green, `65–89%` Amber, `< 65%` Red), clicks **"Approve Batch ≥ 90%"**, and arbitrates ambiguous lines in 1 click. | Every row displays **the exact reason behind the line** (e.g., *"Missing ISWC → Fastembed semantic vector cosine 92% + lexical 90% on 'Lumiere Noir' & performer 'Camille Moreau'"*). Human validation automatically saves the noisy title into `LEARNED_ALIAS` institutional memory (`100%` confidence on future imports). |
| **Minute 3 · Deterministic Payout, IRCEC & Advance Plan** | User clicks **"Compute Royalties"** and exports either the global ledger or individual holder statements (`.CSV` / `.V21` CWR). | **100% deterministic `Decimal` engine** computes exact splits (`33.33% / 33.33% / 33.34%` or `50/50`), deducts **French SSAA/IRCEC social contributions (précompte)**, recoups unamortized advances per contract, and outputs **2026 e-invoicing ready** statements. |

---

## 3 · Architecture: What Really Runs vs. What Is Mocked

```
[Next.js 15 App Router UI]  <--REST JSON-->  [FastAPI Backend (Python 3.11+ / Pydantic v2)]
   │ (Self-serve 3-min flow)                    ├── 1. AI Hybrid Matcher (Fastembed cosine + RapidFuzz + Learned Alias)
   │                                            ├── 2. AI PDF Contract Parser (pypdf + OpenRouter LLM -> Strict Schema)
   └── Offline Resilience Fallback              └── 3. Deterministic Financial Engine (Python Decimal, CWR 2.1, IRCEC, Advances)
```

* **What REALLY runs in the codebase today:**
  1. **Hybrid Smart Matching Engine (`statement_matcher.py`)**: Real multi-stage cascade (`EXACT_ISWC` $\rightarrow$ `EXACT_ISRC` $\rightarrow$ `LEARNED_ALIAS` $\rightarrow$ `fastembed` `intfloat/multilingual-e5-small` cosine similarity + `RapidFuzz` token ratio) generating a $[0, 1]$ confidence score and line-by-line `match_reasoning`.
  2. **100% Deterministic Royalty, Advance & CWR Engine (`royalty_engine.py`, `cwr_validator.py`, `cwr_exporter.py`)**: Zero LLM involvement in math. Uses Python `Decimal` (`ROUND_HALF_UP` to `0.01`) to verify `100.00%` splits across `DEP`, `DRM`, `SYNC`, `PHONO`, calculate French **SSAA/IRCEC précompte**, recoup contract advances, and generate CISAC CWR v2.1 (`.V21`) files.
  3. **Active Institutional Memory (`LEARNED_ALIAS`) & Immutable `AuditLog`**: Validating a noisy CSV line persists the alias in PostgreSQL/SQLite and re-computes the work embedding.
  4. **PDF Contract Extractor (`contract_extractor.py`)**: Extracts text with `pypdf` and queries OpenRouter LLM into a strict Pydantic v2 schema.
* **What has a Controlled Mock / Fallback (for zero-downtime self-serve demos):**
  1. If the user tests the Vercel frontend link when the backend container is spun down, the frontend seamlessly falls back to an embedded deterministic replica of the *Éditions Solstices Music* catalog and statements so the 3-minute journey never breaks.
  2. If `OPENROUTER_API_KEY` is not set during PDF upload, the backend falls back to a deterministic heuristic extractor flagged with `"extraction_mode": "DEMO_FALLBACK"`.

---

## 4 · Stack and Owner

* **Tech & Product Lead:** **Ariane Boulet**
* **Why this stack (Fast to ship by Nov 18, built to scale by Dec 18 — no throwaway vibe-coding):**
  * **Interface:** **Next.js 15 (App Router, TypeScript, Tailwind CSS)** — deployed on **Vercel** for an instant, zero-install shareable link (`< 3 min` self-serve test for the 5 target users).
  * **Backend & Financial Core:** **Python 3.11+, FastAPI, SQLModel, Pydantic v2, `Decimal`** — strict separation between probabilistic AI (matching/extraction) and deterministic accounting (splits, advances, IRCEC précompte, CWR v2.1).
  * **AI & Vector Layer:** **`fastembed` (`multilingual-e5-small`) + `RapidFuzz` + `pgvector`** for sub-second multilingual title matching without per-row LLM latency or cost, paired with **OpenRouter API** for structured PDF contract extraction.

---

## 5 · Advisor Takeaways (Nov 4) & 5-User Testing Protocol (Before Nov 25)

* **Target User Cohort (5 Music Publishing Professionals before Nov 25):**
  * Sourced directly from Ariane Boulet’s personal network in the French independent music publishing industry (Copyright Managers, Royalty Managers, and Indie Publisher CEOs currently using *Le Sage*, *Music Maestro/Vistex*, or *Excel XLOOKUP*).
* **3 Key Questions Tested in the Live 3-Minute Demo (Captured in-app via the Feedback Modal):**
  1. *Does the line-by-line matching explanation give you enough trust to stop pre-cleaning statements with Excel `XLOOKUP`?*
  2. *Which edge case in your last SACEM/DSP distribution (e.g., 3-way splits `33.33/33.33/33.34`, sub-publishing admin fees, IRCEC précompte, CWR rejection) took you the longest?*
  3. *At €3,600/year (0% commission), what is the single blocker preventing your CEO from switching away from Le Sage / Excel?*
* **Advisor Rounds Synthesis (3:00–5:00 PM Slot):**
  * *Takeaway 1 (What works):*Strict separation between AI matching (with confidence scores + line-by-line reason) and 100% deterministic `Decimal` math reassures zero-error-tolerance royalty teams.
  * *Takeaway 2 (What to cut for Nov 18):* Keep the Nov 18 demo laser-focused on the **3-minute messy CSV $\rightarrow$ explainable match $\rightarrow$ advance-recouped payout** loop rather than showing 10 screens at once.
  * *Takeaway 3 (What to prove first):* Prove on real noisy publisher CSV lines that `LEARNED_ALIAS` + semantic matching eliminates the manual Excel `XLOOKUP` step before CWR/royalty accounting.
