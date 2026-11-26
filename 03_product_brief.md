# 03 — Product Brief: Korom Contract-to-CWR Copilot (v2)

**Team:** Korom AI Product Team · **Starting point:** Bring your own (`00_pitch.md`) · **Version:** v2 (post-user research)

---

## 1. Problem, user, do-nothing *(from `01_problem_statement.md`)*
- **Problem in one sentence:** Copyright Managers at independent French music publishers (~800 publishers) lose ~30 minutes per signed PDF contract manually keying work titles, right holders, IPI codes, and 4-dimensional splits (`DEP`, `DRM`, `SYNC`, `PHONO`) into legacy software, suffering a ~15% SACEM CWR rejection rate; success is cutting registration time to < 3 minutes with $\ge 80\%$ extraction accuracy and $0\%$ invalid CWR exports.
- **User (persona):** **Sophie, Copyright & Catalogue Manager** at an independent publisher (3,000 works, 80 new contracts/year) — *Goal:* Register all signed works with SACEM before the quarterly distribution cutoff without CWR rejections, and share a clean Excel summary with the CEO/accounting team. *Pain:* Reading 20-page PDFs and typing splits into *Le Sage* by hand.
- **Do-nothing baseline:** Contract volumes grow +8%/year (especially multi-work audiovisual cue-sheet contracts); manual Excel/Le Sage entry continues to cost ~300 hours/year and leaves 15% of CWR batches rejected on first submission.

---

## 2. The process — as-is and to-be
| # | Step | Who today | Minutes | Error rate | Cost of an error | Automate / augment / keep human (Brynjolfsson test) | Trust level | Minutes after | Metric for this step |
|---|---|---|---|---|---|---|---|---|---|
| **1** | Read PDF & identify contract type (Cession, Co-édition, LAI) + work titles | Copyright Manager | 8 min | 5% (missed work in table) | Missing work = 0 royalties collected | **Automate** (`pypdf` + type router + LLM multi-work list extraction) | **L4** (routed to L2 screen) | 0.2 min | Multi-work recall (%) |
| **2** | Locate financial clauses & compute `DEP`, `DRM`, `SYNC`, `PHONO` splits + IPIs | Copyright Manager | 12 min | 12% (prorata or rounding mistake) | SACEM CWR rejection or songwriter dispute | **Augment** (LLM extracts structured JSON + **verbatim clause quote**; fails full automation due to legal liability) | **L2** (Drafts, human approves) | 1.5 min | Exact split match rate (%) & Groundedness |
| **3** | Check CISAC/SACEM statutory rules ($\sum=100\%$, Pub DEP $\le 50\%$, 11-digit IPI) | Copyright Manager (mental / calculator) | 4 min | 8% (3-way split `99.99%` slip) | Official SACEM `NACK` rejection | **Automate** (100% deterministic `Decimal` rule in `cwr_validator.py`) | **L4** (Hard blocking gate) | 0.0 min | CWR gate false-negative rate (= 0%) |
| **4** | Arbitrate anomalies, approve & create works in catalog (`⊘`) | Copyright Manager | — | — | Legal accountability | **Keep Human** (Human-in-the-loop review with 1-click SACEM presets) | **Person (`⊘` L2)** | 1.0 min | Time-to-validate (seconds) & Edit rate |
| **5** | Format & export CISAC CWR v2.1 (`.V21`) + internal Excel (`.xlsx`) tracker | Copyright Manager | 6 min | 5% (column alignment) | Corrupted CWR batch or stale Excel | **Automate** (`cwr_exporter.py` + `xlsx_exporter.py`) | **L4** (after `⊘` approval) | 0.1 min | Export validity rate (100%) |

- **Where the pain sits (the two steps):** **Step 2** (extracting & computing prorata splits across 20 pages of legal prose) and **Step 5** (formatting error-free CWR `.V21` and Excel `.xlsx` files).
- **The way back to a person (designed first):** Every extracted contract starts in `PENDING_REVIEW`. If confidence is low or `validate_work_cwr` detects an imbalance (e.g. `DEP = 90.00%`), a red warning banner blocks CWR export and provides 1-click SACEM statutory presets (`⚡ Cession 50/50`, `⚡ Équilibrer solde à 100%`) plus full inline editing.
- **Where the governance line sits:** Between **Step 3** and **Step 5** — no work is created in the active catalog or exported to SACEM `.V21` without explicit human validation (`POST /api/v1/contracts/{id}/validate`).

---

## 3. Features — RICE and MoSCoW (Strict Scope Cutting from Full Korom ERP)
| Feature | Reach / mo | Impact (0.25–3) | Confidence | Effort (p-w) | RICE | MoSCoW |
|---|---|---|---|---|---|---|
| **F1 · AI PDF Contract Extractor (Multi-work + Splits + Verbatim Quotes)** | 500 contracts | 3.0 | 80% | 1.5 | **800** | **MUST** *(Tests Flip Point)* |
| **F2 · Deterministic CWR 2.1 Policy Gate (`DEP/DRM = 100%`, IPI check)** | 500 contracts | 3.0 | 100% | 0.5 | **3000** | **MUST** *(Core Guardrail)* |
| **F3 · One-Click CISAC CWR v2.1 (`.V21`) & Visibility Excel (`.xlsx`) Exporter** | 500 contracts | 3.0 | 100% | 0.8 | **1875** | **MUST** *(Core Output)* |
| **F4 · Human-in-the-Loop Review UI (`⊘`) + 1-Click SACEM Presets + `⏻` Switch** | 500 contracts | 2.0 | 90% | 1.0 | **900** | **MUST** *(Safety & UX)* |
| **F5 · Audio-Visual Sub-Group & Co-Publishing Handler (TF1 Series)** | 150 contracts | 2.0 | 80% | 1.0 | **240** | **SHOULD** |
| **F6 · Right-Holder Directory Auto-Enrichment (Address, SIRET, IPI)** | 300 contracts | 1.0 | 80% | 0.8 | **300** | **COULD** |
| **F7 · DSP Streaming CSV Statement Reconciliation & Fuzzy Matching** | — | — | — | — | — | **WON'T** *(Out of scope — separate product)* |
| **F8 · SEPA XML ISO 20022 (`pain.001`) Bank Wire Generation** | — | — | — | — | — | **WON'T** *(Out of scope — accounting ERP)* |
| **F9 · Author Estate Successions (Indivision Notariale) & Mandataires** | — | — | — | — | — | **WON'T** *(Out of scope — legal edge case)* |
| **F10 · Multi-Currency BCE Exchange Rate Tables (USD/GBP/JPY)** | — | — | — | — | — | **WON'T** *(Out of scope — royalty accounting)* |
| **F11 · Quarterly Royalty Ledger Locking & Factur-X Self-Billing** | — | — | — | — | — | **WON'T** *(Out of scope — financial ERP)* |

- **The feature that tests our flip assumption, and why it is a MUST:** **F1 (AI PDF Contract Extractor)** tests whether an LLM can reliably extract multi-work titles and 4-dimensional splits from real French/English contracts to cut entry time from 30 min to < 3 min.
- **The cut that hurt the most:** Cutting **F7 (DSP Statement Reconciliation)** from the final course scope so the product is 100% laser-focused on a single, end-to-end atomic loop: **PDF Contract ➔ Validated Work ➔ CWR `.V21` + Excel `.xlsx`**.

---

## 4. Data *(Summary of 6-Question Audit — full details in `governance.md`)*
- **Sources:** Synthetic and anonymized French/English music publishing contracts (`data/synthetic/contracts/`), CISAC CWR v2.1 specification, and SACEM statutory rules (`Règles de répartition SACEM.json`).
- **Volume & Labels:** 50 labelled contract cases in `evals/eval_set_v0.csv` (growing to 100 in S5), stratified across 4 segments: *Standard Cession FR*, *Co-édition 50/50*, *English Production Music (Kaptain/TF1)*, and *Adversarial / Unbalanced Contracts*.
- **Leakage & Isolation:** `eval_set_v0.csv` is strictly held out from prompt engineering. SHA-256 cache is scoped per tenant.

---

## 5. Model — One Rung Per Part
| Part | Rung (1 rules · 2 classical ML · 3 pretrained model · 4 hybrid) | Why the rung below fails |
|---|---|---|
| **1. PDF Text & Document Type Router** | **Rung 1** (`pypdf` + Regex keyword router) | N/A — Deterministic text extraction and header keyword matching (`CO-EDITION`, `LETTRE-ACCORD`) is fast, free, and 100% repeatable. |
| **2. Contract Clause & Split Extractor** | **Rung 3** (Pretrained LLM `claude-3.5-sonnet` via OpenRouter, `temp=0.0`, JSON schema + verbatim citations) + **Rung 1 Fallback** | **Rung 1 (Regex)** fails when clauses are phrased in prose, split across appendices (e.g., Art. 11.3 + Appendix 1), or formatted as multi-column tables. **Rung 2 (Classical NER)** cannot compute implied prorata shares across co-composers in zero-shot. |
| **3. CWR 2.1 Statutory Policy Checker** | **Rung 1** (Strict Python `Decimal` rules in `cwr_validator.py`) | LLMs are probabilistic and fail at exact decimal arithmetic (`33.33 + 33.33 + 33.34 = 100.00`). Only a deterministic `Decimal` gate guarantees $0\%$ invalid CWR exports. |
| **4. CWR `.V21` & Excel `.xlsx` Generators** | **Rung 1** (`cwr_exporter.py` fixed-width serializer + `xlsx_exporter.py` OpenXML builder) | SACEM's CWR parser rejects a file if a single character column is shifted by 1 byte. Fixed-width serialization must be 100% deterministic. |

---

## 6. Where it lives (Integration Surface)
- **Surface:** Web application (`Next.js 15` frontend + `FastAPI` REST backend), accessible on desktop by the Copyright Manager.
- **Speed needed:** `< 5 seconds` for PDF extraction; `< 200 ms` for CWR validation, `.V21` export, and `.xlsx` export.
- **Fallback:** If OpenRouter API times out (`> 25s`), returns HTTP 5xx, or if the **`⏻ Override Switch`** is toggled on, `contract_ai_parser.py` seamlessly executes `_deterministic_regex_fallback_parse` so the user never faces a dead screen.

---

## 7. Success Criterion — One Sentence
> **By November 15, on our 50-case stratified contract evaluation set (`evals/eval_set_v0.csv`), at least 80% of contracts have all work titles and `DEP`/`DRM` splits extracted accurately enough that two graders approve them without manual split calculation, 100% of unbalanced splits (`!= 100.00%`) are caught by the deterministic CWR gate, and 0% of exported `.V21` files violate CISAC formatting.**

---

## 8. Risks and Rollback Trigger
- **Top risks:** (1) LLM misinterprets a co-publishing 50/50 share of the publisher half (`25%` each) as `50%` each (`150%` total); (2) Multi-page audiovisual tables truncate after the first work; (3) Operator rubber-stamps a missing IPI warning.
- **Rollback trigger:** If the human split-correction rate exceeds **30% of uploaded contracts** over a 48-hour window or if **any (`> 0`) invalid CWR `.V21` file** is generated, the Tech Lead toggles the **`⏻ Override Switch`** to `deterministic` mode in `< 1 minute`.

---

## 9. What the Users Changed *(Post-Mom Test Research)*
| Change made to the product | Evidence (who said / did what during user testing) |
|---|---|
| **Added 1-Click Excel (`.xlsx`) Visibility Export alongside `.V21` CWR** | Copyright managers told us: *"CWR `.V21` is unreadable ASCII code for SACEM's machine. Before I send a CWR batch or archive a contract, I always need a clean `.xlsx` table so my CEO or co-publisher can visually check the titles, IPIs, and splits."* |
| **Replaced raw PDF page dump with Targeted Financial Clause Summary + Verbatim Quotes** | Users ignored the raw text dump on the left panel; they asked to see **only the exact sentence** justifying each person's percentage (`Article 4`, `Article XIX`, `Appendix 1`). |
| **Stopped auto-filling `SYNC` from `DRM` when Synchronization is not in the contract** | Legal managers pointed out that French SACEM cession contracts often leave `SYNC` to a separate *Lettre-Accord Artiste-Interprète (LAI)*; auto-copying `DRM` to `SYNC` was a legal hallucination. We changed `SYNC` to display *"En attente LAI (0%)"* without false error alerts. |
