# Korom — Contract-to-CWR AI Copilot

**Course:** Data & AI Product: From Diagnosis to Delivery (MSA-DAT07-04) · Albert School · shared project with Agentic Workflows  
**Cohort:** M2-INTER-1  

---

## Environment configuration
Requires Python 3.14.

```bash
python3.14 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Team

| Name | Git handle | Also in the Agentic Workflows team? |
|---|---|---|
| Lucas Duthu-Paloumet | lucasduthu | yes |
| Mathilde Maudet | mathmdt | yes |
| Emma Neumayer | eneumayer-lang | yes |
| Ariana Boulet | aboulet13 | no |
| Laura Oldakowski | loldakowski | yes |

---

## Our agent

- **Starting point:** Bring your own idea (see [`00_pitch.md`](00_pitch.md))
- **The company:** **Korom**, a B2B SaaS platform for independent music publishers in France and Europe (~800 indie publishers in France across CSDEM, CEMF, and ULM; typical mid-size publisher manages 1,500–10,000 works, signs 40–120 contracts per year, with a 2-to-4-person Copyright & Legal team).
- **The job, in one sentence:** When a copyright manager uploads a signed music publishing or co-publishing contract PDF, the copilot extracts all musical works, right holders, IPI numbers, and statutory royalty splits (`DEP`, `DRM`, `PHONO`, with `SYNC` as an unregulated contractual note) with verbatim clause citations, verifies 100.00% CISAC/SACEM compliance via a deterministic policy gate, and—after human approval (`⊘`)—generates an official **CISAC CWR v2.1 (`.V21`)** registration file for SACEM alongside a structured **Excel (`.xlsx`)** visibility workbook.
- **Trust level per step:**
  - **Step 1 (PDF Ingestion, Input Guardrail & Type Router):** `L4` (Autonomous pre-processing + deterministic guardrail immediately rejecting non-publishing PDFs with HTTP 422 to prevent token waste).
  - **Step 2 (LLM Structured Extraction with Verbatim Grounding):** `L2` (Drafts structured works, parties, and splits in `PENDING_REVIEW`; human review mandatory).
  - **Step 3 (Deterministic CWR 2.1 & SACEM Policy Gate):** `L4` (Hard gate blocking any split where `DEP != 100.00%`, `DRM != 100.00%`, `PHONO != 100.00%`, publisher share `> 50.00%`, missing Composer `C`/`CA`, or invalid IPI format; `SYNC` is excluded from collective CWR enforcement).
  - **Step 4 (Work Creation & Export to CWR `.V21` and Excel `.xlsx`):** `L2` / `Person only` (A named human operator must click *"Valider & Enregistrer au Catalogue"* before any work is registered or exported).
- **One thing it must never do:** It must **never** process or send non-publishing files to the LLM (blocked at HTTP 422), **never** invent or silently alter a royalty split percentage or IPI to force a `100.00%` sum, **never** allow publisher shares to exceed the statutory 50.00% ceiling on DEP, DRM, or PHONO, and **never** export a work to SACEM without explicit human validation (`⊘`).

---

## Repository structure

One numbered file per session. Every member authors commits in at least four of the numbered files.

| File | Session | Description | Status |
|---|---|---|---|
| [`00_pitch.md`](00_pitch.md) | before S3 | Bring-your-own pitch passing the 7-point checklist | Complete |
| [`01_problem_statement.md`](01_problem_statement.md) | S1–S2 — Assignment 1 | Problem statement, 5 Whys, "Is AI the right tool?", Working Backwards press release | Complete |
| [`governance.md`](governance.md) | S1–S7 | Responsible AI register: EU AI Act tier, GDPR basis, human checkpoints `⊘`, override switch `⏻`, owners | Complete |
| [`02_sizing.xlsx`](02_sizing.xlsx) | S2 — Assignment 2 | Bottom-up opportunity sizing, 7 cost lines, 3 scenarios (Bear/Base/Bull), and flip point | Complete |
| [`02_investment_memo.md`](02_investment_memo.md) | S2 — Assignment 2 | CFO investment memo: CONDITIONAL GO, hurdle comparison, Build vs. Buy analysis | Complete |
| [`03_product_brief.md`](03_product_brief.md) | S3 | As-Is / To-Be workflows, RICE & MoSCoW prioritization, Model Ladder, Success Criterion | Complete |
| [`04_architecture.md`](04_architecture.md) | S4 | Decoded AI architecture diagram with `⊘` and `⏻`, component table, fallbacks | Complete |
| [`spec.md`](spec.md) | S3–S4 | Executable technical specification (inputs, outputs, edge cases, fallbacks) | Complete |
| [`05_metrics.md`](05_metrics.md) | S5 | 5-level metric hierarchy, Stop Criterion, 1 Primary / 3 Guardrails / 2 Counter-metrics | Complete |
| [`06_07_experiments_operations.md`](06_07_experiments_operations.md) | S6–S7 | A/B evaluation protocol (sample size calculation), 4-layer monitoring, OTel trace & rollback | Complete |
| [`08_launch_memo.md`](08_launch_memo.md) | S8 | Final launch memo: Conditional GO, operational thresholds, kill switches | Complete |
| [`evals/`](evals/) | S4–S5 | Golden evaluation dataset (`eval_set_v0.csv`), LLM-as-a-Judge rubric & `report_v0.md` | Complete |
| [`prototype/`](prototype/) | S4–S7 | Fully functional FastAPI backend + Next.js 15 frontend prototype with test suite | Complete |

---

## Quick start — Run the working prototype (`/prototype`)

To launch both the **FastAPI Backend** (`http://127.0.0.1:8000`) and the **Next.js 15 Frontend** (`http://localhost:3000`):

```bash
cd prototype
./start_poc.sh
```

### 2-Minute Demo Flow (PDF Contract ➔ Work Creation ➔ CWR `.V21` & Excel `.xlsx`)
1. Open **`http://localhost:3000/contracts`** (or click **"1. Contrats PDF & IA"** in the top navigation bar).
2. Upload a PDF publishing contract (or click **"Simuler Contrat Démo"**).
3. Inspect the **AI extraction**: work titles, right holders, roles (`A`, `C`, `AC`, `E`), IPI numbers, `DEP` / `DRM` / `PHONO` splits, unregulated `SYNC` notes, **verbatim clause quotes**, and the **100.00% deterministic CWR equilibrium gauges**.
4. Click **"Valider & Enregistrer au Catalogue"** (`⊘` Human-in-the-loop checkpoint): works are registered in the catalog.
5. Click **"Exporter CWR (.V21 SACEM)"** to download the official CISAC CWR v2.1 file, or **"Exporter Visibilité (.xlsx)"** to download the formatted Excel workbook.
6. Toggle the **`⏻ Override Switch`** in the top navbar at any time to switch between **Nominal AI Mode (OpenRouter LLM Rung 3)** and **Safe Deterministic Mode (Regex Rung 1)**.

---

## Rules

- Commit with your own Git account: the individual question at the oral is about a commit you signed.
- Tag the final version `v1.0` before the first oral of your cohort. No commits after the first oral starts.