# 06_07 — Experiments & Operation · Korom · Contract-to-CWR Copilot

> Every number traces to [`02_sizing.xlsx`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/korom-ai-product/02_sizing.xlsx), [`05_metrics.md`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/korom-ai-product/05_metrics.md) or [`evals/report_v0.md`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/korom-ai-product/evals/report_v0.md). Every owner is a named role. Every threshold has a clock.

---

## §1 Prove the Effect — Hypothesis, Unit, Design

**Hypotheses (for our three business metrics of `05_metrics.md §4`):**
1. **BM1 (Efficiency):** If we enable the **Korom AI Contract-to-CWR Copilot** (`Rung 3 LLM + Rung 1 CWR Gate + 1-click .V21/.xlsx export`) for Copyright Managers on incoming PDF publishing contracts, **median contract-to-registration handling time** moves from **30.0 minutes** to **$\le 5.0$ minutes** within **2 weeks** — without the **Human Rubber-Stamping Rate (`< 10s` review)** exceeding **5%**.
2. **BM2 (Quality / SACEM Acceptance):** If we enforce the deterministic CWR v2.1 policy gate (`validate_work_cwr`) before `.V21` export, the **First-Pass SACEM CWR Acceptance Rate (`ACK`)** moves from **85.0%** to **$\ge 98.0\%$** at the **Week-4 SACEM ACK read** — without `0` arithmetic split breaches.
3. **BM3 (Safety Non-Effect):** Over the 4-week trial, the **Co-Publisher / Songwriter Split Dispute Rate** remains unchanged within **$0.5\% \pm 0.2\%$** (verified via the exported `.xlsx` visibility sheets).

**Unit of Randomisation:** **The incoming Contract PDF (`contract_id`), stratified by contract complexity (`Single-Work` vs `Multi-Work Bundle`)** — *Why:* Within a publisher, if we randomised by Copyright Manager, sample size would be too small ($2\text{–}4$ managers per firm); if we randomised at the individual *Work* level inside a 37-work contract, the treatment would leak because a single contract PDF defines the shared clauses for all 37 works.
- **Design:** **Contract-level randomized A/B test (50% AI Copilot Assisted `L2` vs. 50% Control Manual Entry + Standard CWR Export)** across 15 pilot publishers.
- **What this design cannot see:** Copyright Manager **learning/fatigue carryover** across contracts on the same day, and **shared `RightHolderDirectory` IPI enrichment** (when the AI treatment enriches an author's 11-digit IPI on Contract A, a subsequent Control Contract B with the same author benefits from the stored IPI, slightly making Control look better — a conservative bias).

---

## §2 Decide Before — Duration and Decision Rule

- **Smallest improvement that still justifies the agent (MDE):** Reducing median contract handling time from **30.0 min to 16.0 min** (`-14 min` saved per contract = our **60% accuracy flip point** in `02_sizing.xlsx`), and raising First-Pass CWR Acceptance from **85.0% to 93.0%** (`+8 pts`).
- **Slowest guardrail to read $\rightarrow$ how long we run:** **SACEM Official `ACK/NACK` return file**, which takes **2 to 4 weeks** to be processed and returned by SACEM. Therefore, even though sample size for handling time is reached in Week 2, **the experiment runs for a fixed 4 weeks** (no early stopping for a good number).

| Input (`evals/sample_size.xlsx`) | Value (BM2: First-Pass CWR Ready/ACK Rate) | Value (BM1: Continuous Handling Time) | Source |
|---|---|---|---|
| **Baseline ($p_0$ / $\mu_0$)** | `85.0%` first-pass acceptance | `30.0 min` ($\sigma = 10\text{ min}$) | `02_sizing.xlsx` / Le Sage sample |
| **Smallest rise worth acting on (MDE)** | `+8.0 pts` (`85%` $\rightarrow$ `93%`) | `-14.0 min` (`30 min` $\rightarrow$ `16 min`) | Flip point in `02_sizing.xlsx` |
| **Two risks accepted ($\alpha$ · $\beta$)** | `1 in 20 (5%)` · `1 in 5 (20% = 80% power)` | `5%` · `20%` | Preset in calculator |
| **Units per group ($n$)** | **`238 contracts / group` (476 total)** | **`12 contracts / group` (24 total)** | `evals/sample_size.xlsx` |
| **Volume per week (15 pilot publishers)** | `~120 contracts / week` (`60 / group / week`) | `~120 contracts / week` | `02_sizing.xlsx` |
| **Duration actually run** | **4 full weeks** (~480 contracts total) | Read at **Week 4** alongside BM2 | Dictated by slowest guardrail (SACEM ACK) |

- **Pre-registered segments (`05_metrics.md §3`):** `FR` vs `EN` contracts; `Single-Work` vs `Multi-Work Audiovisual Bundles`; `Cession` vs `Co-édition` vs `LAI`.
- **Decision Rule (written before the first contract is randomised):**
  - **SHIP** if median handling time $\le 10.0\text{ min}$, First-Pass CWR Acceptance $\ge 93.0\%$ across all pre-registered segments, and CWR Arithmetic Breach Rate $= 0.0\%$.
  - **ITERATE** if global handling time $\le 10.0\text{ min}$ and CWR Breach $= 0.0\%$, but English (`EN`) or Multi-Work (`> 10 works`) contracts have $> 25\%$ human split-edit rate (fix parser rules for that segment and re-test on `eval_set_v1.csv`).
  - **KILL / REVERT TO RUNG 1** if handling time $> 16.0\text{ min}$ (flip point missed) or if human split-edit rate $> 40\%$.
  - **STOP EARLY ONLY IF (Harm Threshold):** Even **1 exported `.V21` CWR file** contains an arithmetic split breach (`DEP/DRM != 100.00%`) or if $> 35\%$ of contracts require full manual re-entry over 48h.

---

## §3 Watch the Four Layers — Monitoring, Tools & Drift

| Layer | Metric (`05_metrics.md`) | Threshold that pages someone | Clock | Owner | Tool — Startup (Korom MVP) | Tool — Large Company |
|---|---|---|---|---|---|---|
| **1 · Infrastructure** | OpenRouter LLM latency (`p95`) & HTTP 5xx / Fallback rate | `p95 > 18s` or Fallback rate `> 10%` over 1h | **15 min** | Backend / Infra Lead | FastAPI `/health` + `/api/v1/settings/openrouter-status` + Sentry | Datadog APM + PagerDuty |
| **2 · Model Quality** | Mean `confidence_score` & Verbatim Citation Groundedness rate | Mean confidence `< 0.78` or Missing quote rate `> 5%` | **24 hours** | AI / ML Engineer | SQLite `AuditLog` + Langfuse `@observe()` trace | Arize Phoenix / Datadog LLM Obs |
| **3 · Product & Guardrails** | **CWR Arithmetic Breach Rate** & **Human Split-Edit Rate at `⊘`** | Breach `> 0%` (Immediate) · Edit rate `> 30%` (Daily) | **Immediate (Breach) / 24h (Edit)** | Tech & Legal Ops Lead | `validate_work_cwr` assertions + PostgreSQL Metabase | Grafana + BigQuery + PagerDuty |
| **4 · Business** | Median Registration Time & SACEM `.ACK` Rejection Rate | Time `> 12 min` or SACEM `NACK > 3%` | **Weekly** | AI Product Manager | Korom Dashboard KPIs (`/`) + `.ACK` parser | Looker / Tableau Executive BI |

- **Where FastAPI & Next.js run + Release Path:**
  - *Hosting:* Next.js 15 frontend on **Vercel**; FastAPI backend + PostgreSQL on **Render / Railway** (local demo via `./start_poc.sh`).
  - *Release Path:* `dev (feature branch)` ──*(Gate 1: `pytest` 99 unit tests + `tsc --noEmit` + 100% pass on `eval_set_v0.csv`)*──▶ `staging` ──*(Gate 2: Manual test of `⏻ Override Switch` and `.V21`/`.xlsx` export)*──▶ `production`.
- **First Drift Expected:**
  - *Drift Type:* **Data / Covariate Drift** — Onboarding a new publisher whose law firm uses a previously unseen contract layout (e.g., German/English sub-publishing schedules or scanned 2-column tables).
  - *Signal that shows it:* Spike in the proportion of contracts triggering `cwr_split_warnings` (`> 25%`) and increase in the **Human Split-Edit Rate** at the `⊘` review screen (`PSI > 0.25` on extracted party count / confidence score).
  - *What we re-run:* Anonymize 10 representative missed contracts, add them to `evals/eval_set_v1.csv`, update the extraction prompt/regex, and replay the entire frozen `eval_set_v1.csv` regression suite before deploying.

---

## §4 Contain the Incident — Trace, Dashboard, Classes & Rollback Plan

### OpenTelemetry / Langfuse Trace (4 Spans per Contract Upload & Export)
1. **`span_1: pdf_ingest_and_route`** — *Attributes:* `contract.filename`, `pdf.byte_size`, `pdf.extracted_char_count`, `router.detected_type` (`CESSION_EDITION` | `CO_EDITION` | `LAI`), `latency_ms`.
2. **`span_2: contract_extraction_llm_or_fallback`** — *Attributes:* `ai.mode` (`OPENROUTER_LLM` | `DETERMINISTIC_REGEX_FALLBACK`), `ai.model` (`anthropic/claude-3.5-sonnet`), `cache.sha256_hit` (`bool`), `extracted.works_count`, `extracted.parties_count`, `extracted.has_verbatim_quotes` (`bool`), `confidence_score`.
3. **`span_3: cwr_policy_gate_check`** — *Attributes:* `cwr.is_ready` (`bool`), `cwr.dep_sum_pct`, `cwr.drm_sum_pct`, `cwr.publisher_dep_pct`, `cwr.blocking_errors_count`, `cwr.missing_ipi_count`.
4. **`span_4: human_checkpoint_and_export`** — *Attributes:* `human.action` (`VALIDATED` | `REJECTED`), `human.edited_splits` (`bool`), `human.review_duration_sec`, `export.format` (`CWR_V21` | `XLSX_VISIBILITY`), `export.included_works_count`, `export.skipped_works_count`.

### One-Page Operational Dashboard (5 Panels)
1. **Panel 1 — CWR Gate Integrity (`0%` Breaches):** *"Did any invalid split (`DEP/DRM != 100%`) slip into a `.V21` export today?"*
2. **Panel 2 — Human-in-the-Loop Edit vs. Approval Rate:** *"What % of AI-extracted contracts are approved at `⊘` without manual split edits (by segment `FR` vs `EN`)?"*
3. **Panel 3 — Contract-to-CWR Time Distribution (`p50` / `p95`):** *"Are Copyright Managers completing contract registration in `< 3 minutes`?"*
4. **Panel 4 — Rubber-Stamping & Warning Override Watch:** *"Is any operator approving multi-work contracts in `< 10 seconds`?"*
5. **Panel 5 — Infrastructure, Cost & `⏻` Switch Status:** *"What is OpenRouter `p95` latency, SHA-256 cache hit rate, remaining $10 budget, and is the `⏻` Switch in Nominal or Deterministic mode?"*

### The Four Incident Classes
| Class | Example on Korom Contract-to-CWR Copilot | Action Taken |
|---|---|---|
| **1 · Caught (Pre-User)** | LLM extracts `DEP = 40%` Creator + `50%` Publisher (`90%` total). `validate_work_cwr` catches the `-10%` gap before `⊘`. | Red badge displayed on `/contracts`; `.V21` export blocked until operator clicks `⚡ Équilibrer solde à 100%`. Logged in trace. |
| **2 · Sent Wrong (Non-Harmful)** | LLM misses a secondary work subtitle on a 10-work contract; operator corrects the subtitle text at `⊘` in 15 seconds. | Operator edit is saved; case is flagged (`human.edited_splits = true`) for weekly eval-set review. |
| **3 · Harmful (Crosses Harm Threshold)** | A bug in a prompt/schema update causes > 35% of uploaded contracts to swap Author (`A`) and Composer (`C`) roles, or an invalid `.V21` file is generated. | **Immediate Rollback (`⏻` Switch):** On-Call toggles `⏻ Mode Déterministe`, halts `.V21` batch exports, and runs post-mortem. |
| **4 · Outage (Provider Down)** | OpenRouter API returns HTTP 503 or times out (`> 25s`). | Automatic zero-downtime fallback to `_deterministic_regex_fallback_parse` (`Rung 1`) + banner notification. |

### The Rollback Plan (6 Fields)
- **Trigger:** CWR Arithmetic Breach Rate `> 0%`, Human Split-Edit Rate `> 35%` over 48h, or OpenRouter API error rate `> 15%`.
- **Who decides:** **Ariane Boulet (Tech & Product Lead)** during business hours; **On-Call Backend Engineer** at night/weekends (or any Copyright Manager via the navbar button).
- **The action (including the suggest-only / deterministic position):** Click **`⏻ Switch : Mode Déterministe (Rung 1)`** in the top navbar (or `POST /api/v1/settings/override-switch` with `{"deterministic_only": true}`). This disables all LLM calls and uses the deterministic regex parser + 1-click SACEM statutory presets (`50/50`, `25/25/50`).
- **Time to execute:** **`< 15 seconds`** (1 click in UI, no container redeploy required).
- **What people see:** The navbar badge turns Amber (**`⏻ Switch : Mode Déterministe (Rung 1)`**) and newly uploaded contracts display extracted regex fields with SACEM preset buttons ready for human completion.
- **Last tested:** **17 November 2026** on the local staging prototype (`http://localhost:3000`) by Ariane Boulet — verified in `AuditLog`.

---

## §5 Own the System — The Five Named Owners

| Responsibility | Named Role in Organization | Where it lives in the Repo |
|---|---|---|
| **1 · Signs an experiment on real users** | **Head of Copyright & Legal Ops** (with AI Product Manager) | `governance.md` & `06_07_experiments_operations.md §2` |
| **2 · Reads the weekly numbers** | **AI Product Manager** | `05_metrics.md §1` & Dashboard (`/`) |
| **3 · Presses the `⏻` switch (day and night)** | **On-Call Backend Engineer / Tech Lead** (and Copyright Manager in-app) | `prototype/frontend/src/components/navbar.tsx` & `settings.py` |
| **4 · Approves a release to production** | **Tech & Legal Ops Lead** (requires 100% pass on `pytest` + `eval_set_v0.csv`) | `prototype/backend/tests/` & `evals/report_v0.md` |
| **5 · Keeps the trace and answers a customer or SACEM** | **Data Protection & Compliance Officer (DPO / Legal Lead)** | `prototype/backend/app/models/audit_log.py` & `governance.md` |
