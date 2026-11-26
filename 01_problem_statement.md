# 01 — Problem statement

Team: Korom AI Product Team · Agent: Korom Contract-to-CWR Copilot · Last updated: 26 November 2026

## 1. The problem in one sentence
**Copyright Managers at independent music publishers** (~800 publishers in France, managing 12.7M works) experience **slow, error-prone manual data entry and SACEM registration rejections** when **converting signed PDF publishing contracts (10–25 pages, multi-work tables, co-publishing & neighboring rights annexes) into compliant CISAC CWR v2.1 work declarations**, costing **~30 minutes of legal admin time per contract and a ~15% CWR rejection/discrepancy rate**; today they **read PDFs line-by-line, type splits manually into 1990s desktop software (*Le Sage*) or Excel spreadsheets, and fix rejected CWR batches by hand**. Success looks like **reducing contract-to-work registration time to under 3 minutes per contract (≥ 80% time reduction), achieving ≥ 85% field extraction accuracy without human split edits, and 0% invalid CWR files exported**.

| Number in the sentence | Value | Measured / analogy / guess | Source or test |
|---|---|---|---|
| French independent publishers | ~800 (62.5% < €1M revenue) | **Measured** | CSDEM / CEMF / SACEM Market Report |
| Musical works in French repertoire | 12.7M (+9.5%/year) | **Measured** | SACEM Annual Key Figures |
| Manual time per contract PDF | 30 minutes (15–45 min range) | **Guess / Analogy** | Validated in S3 Mom Test user interviews with Copyright Managers |
| Baseline CWR / split anomaly rate | ~15% (12 anomalies / 100 works) | **Measured** on sample | Measured on legacy *Le Sage* CWR stock export sample (`CW261104_LESAGE_STOCK_1200_OEUVRES.V21`) |
| Target time per contract | < 3 minutes | **Measured** on prototype | Tested in S4 3-minute live prototype benchmark |

---

## 2. Problem tree — from symptom to cause
- **Symptom (what people complain about):** *"We spend days before every SACEM deadline typing contract splits into Excel and Le Sage, and SACEM still rejects our CWR files for 0.01% rounding errors or missing IPIs."*
- **Problem (what is actually going wrong):** Translating unstructured legal prose and multi-column work tables from PDF agreements into fixed-width CISAC CWR v2.1 records (`HDR`, `NWR`, `SPU`, `SWR`, `SPT`, `SWT`) and internal Excel trackers is done entirely by hand without automated pre-validation.
- **Root cause (5 Whys):**
  1. *Why do CWR registrations take 30 minutes and suffer 15% rejections?* Because Copyright Managers manually re-key titles, IPI numbers, and percentages from PDFs into rigid legacy forms.
  2. *Why do they re-key them manually?* Because legacy tools (*Le Sage*, *Music Maestro*) only accept structured manual entry or pre-formatted CSV/CGP1 files, not signed PDF agreements.
  3. *Why can't a simple script parse the PDFs?* Because music contracts vary wildly in structure: French vs. English, single work vs. 37-work audiovisual tables (e.g., TF1 series), standard 50/50 cession vs. 50/50 co-publishing (`25% / 25% / 50%`), and prose-defined prorata splits across separate articles (Article 1 + Article 11.3 + Appendix 1).
  4. *Why do errors still slip through after manual entry?* Because calculating 3-way statutory splits (`1/3 Author (33.33%) + 1/3 Composer (33.33%) + 1/3 Publisher (33.34%) = 100.00%`) and verifying SACEM publisher caps (`Publisher <= 50.00%` on DEP, DRM, and PHONO) by hand in Excel is cognitively exhausting, while managing separate non-SACEM synchronization (`SYNC`) clauses.
  5. *Why hasn't an AI chatbot solved this?* Because a raw LLM hallucinates numbers and cannot be trusted with legal percentages or fixed-width CWR formatting unless paired with **verbatim clause grounding** and a **100% deterministic `Decimal` policy checker**.
- **What would fix the cause:** A **Hybrid AI Workflow** combining:
  - **AI (Rung 3 Pretrained LLM with structured output):** To extract works, parties, IPIs, splits, and verbatim clause citations from unstructured PDFs.
  - **Deterministic Rule Gate (Rung 1):** To verify `Decimal` 100.00% sums and IPI formats, and serialize valid works into CWR v2.1 (`.V21`) and Excel (`.xlsx`).

---

## 3. Is AI the right tool?
| Question | Our answer |
|---|---|
| **Is there a rule that solves 80 % of it?** | **No for PDF extraction; Yes for CWR validation & export.** Regex rules (Rung 1) solve ~40% of standardized template contracts, but fail on complex multi-act bundles, prose-defined prorata shares, and varied table layouts. Conversely, CWR validation and `.V21`/`.xlsx` generation are 100% solved by deterministic rules. |
| **Is it a prediction / generation problem, or an organisational decision?** | **Structured information extraction & grounded synthesis** (turning unstructured legal text into a strict Pydantic schema with verbatim evidence), followed by a human legal approval decision (`⊘`). |
| **Do we have the data — which, how much, who owns it?** | **Yes:** anonymized/synthetic French & English publishing contracts (`Cession`, `Co-édition`, `LAI`), official CISAC CWR v2.1 specifications, and SACEM statutory distribution rules (`Règles de répartition SACEM.json`). |
| **What does one error cost — and who pays it?** | If caught at the `⊘` human review screen: **~30 seconds** of operator correction. If an invalid split bypassed review and reached SACEM: **~€25 in admin rework** + **6-month delay** in royalty collection or reputational friction with the songwriter. |

**Level chosen:** **Hybrid Workflow (Rung 3 Pretrained LLM for Extraction + Rung 1 Deterministic Rules for CWR Gate & Export)** — **and why not the level below:** Pure Rung 1 (Regex) breaks whenever a publisher or law firm changes clause numbering, language (FR/EN), or table formatting; pure Rung 2 (Classical ML/NER) requires thousands of token-annotated legal PDFs and cannot compute cross-clause prorata shares (e.g. *50% composer share split equally between two co-composers = 25% each*). We do **not** use an autonomous Rung 4 Agent because the sequence of steps is known in advance and legal compliance requires a fixed, auditable pipeline.

---

## 4. Why this agent — the four selection questions
| Criterion | Our answer, one line |
|---|---|
| **High frequency** | Every new song signing, album release, or TV series cue-sheet requires registering 1 to 40+ works before the quarterly SACEM deadlines. |
| **Bounded decision space** | The copilot only maps a PDF to a fixed `ContractExtractionResult` schema (`work_titles`, `parties`, `role`, `ipi_number`, `dep/drm/sync/phono_share_pct`, `source_clause_quote`) and runs `validate_work_cwr`. |
| **Measurable success** | On one contract, success is: all works and parties extracted with exact splits matching the PDF, verbatim quote attached, and CWR validation status accurately flagged. |
| **Recoverable failure** | Every extraction lands in `PENDING_REVIEW` (`⊘` L2 checkpoint) with red/green equilibrium gauges and 1-click SACEM presets before any work is created or exported. |

---

## 5. Press release (Working Backwards)
**PARIS — November 2026 —** Korom today launched the **Contract-to-CWR Copilot**, an AI-powered work registration tool for independent music publishers that turns signed PDF publishing agreements into SACEM-compliant CISAC CWR v2.1 (`.V21`) files and Excel (`.xlsx`) visibility sheets in under 3 minutes. Until now, copyright managers spent 30 minutes per contract manually copying work titles, IPI codes, and 4-dimensional royalty splits (`DEP`, `DRM`, `SYNC`, `PHONO`) from 20-page PDFs into legacy software, suffering a 15% SACEM rejection rate due to rounding and missing-metadata errors. With Korom, copyright managers drag-and-drop a PDF contract, verify the AI-extracted splits alongside verbatim clause citations and deterministic 100.00% SACEM gauges, and export both their official `.V21` registration batch and an `.xlsx` summary in one click. *"What used to take me a full Friday afternoon before the SACEM registration cutoff now takes ten minutes—and the 100% CWR gate means zero rejected declarations,"* said Sophie Laurent, Head of Copyright at Éditions Solstices Music.

---

## 6. What would have to be true?
| # | Hypothesis | Measured / analogy / guess | How we will test it | Session |
|---|---|---|---|---|
| **H1 (Value / Flip Point)** | At least **75% of contract PDFs** have their works, parties, and `DEP`/`DRM` splits extracted accurately enough that the Copyright Manager approves them in **< 3 minutes** (vs. 30 min manual baseline). | **Guess** (flip point from `02_sizing.xlsx`) | Evaluated on our 50-case `eval_set_v0.csv` in Session 4 and timed during user testing. | **S4 Prototype** |
| **H2 (Zero-Error Guardrail)** | The deterministic `validate_work_cwr` policy checker catches **100% of statutory breaches** (`DEP != 100%`, `DRM != 100%`, `PHONO != 100%`, publisher cap `> 50.00%` on DEP/DRM/PHONO, missing Composer `C`/`CA`, or missing IPI, while excluding SYNC) so **0 invalid works** are ever written to a `.V21` CWR export. | **Measured** (deterministic code + unit tests) | Automated unit tests (`test_cwr_validator.py`, `test_cwr_exporter.py`) + adversarial split cases in `eval_set_v0.csv`. | **S4 & S5 Metrics** |
| **H3 (Trust via Groundedness)** | Displaying the **verbatim contract clause quote** (`source_clause_quote`) next to each extracted split plus an **Excel `.xlsx` visibility export** gives copyright managers enough confidence to adopt the workflow without double-checking the full 20-page PDF. | **Guess** | Tested in 3 Mom-Test user sessions (S3) and A/B / shadow evaluation protocol (S6). | **S3 & S6 A/B** |

---

## 7. Do-nothing baseline

If no copilot is built, Copyright Managers will continue to process signed publishing contracts manually. With an estimated 10–30 contracts per month and around 10 works per contract, that means entering and checking roughly 100–300 works each month. Using the 30-minute baseline stated above, the current registration work represents about 5–15 hours per month (60–180 hours per year), before time spent correcting rejected or inconsistent declarations. Contract volumes and manual effort would continue without the proposed time reduction.

---

## 8. Trust levels per step and what the agent must NEVER do

| # | Step of the Contract-to-CWR workflow | Trust level | Where the human sits | Why not one level higher |
|---|---|---|---|---|
| 1 | PDF ingestion, text extraction and contract-type routing (cession, co-édition, commande audiovisuelle, LAI) | **L4** | Monitoring only (fallback rate, unreadable scans) | — no legal effect, a failure simply falls back to manual entry |
| 2 | LLM extraction of works, right holders, roles (`A`, `C`, `AC`, `E`), splits (`DEP`, `DRM`, `SYNC`, `PHONO`) with a verbatim clause citation | **L2** | Every contract lands in `PENDING_REVIEW`; a named copyright manager approves each extracted party row | a hallucinated split becomes a binding statutory dispute with a songwriter |
| 3 | IPI resolution against the directory | **L3** on a unique exact match (name + role) · **L2** as soon as there is a homonym, several candidate IPIs or no match | Ambiguous cases are shown to the human with the candidates; no match = empty field + flag | a wrong IPI pays the wrong person and is hard to recover after a SACEM distribution |
| 4 | Deterministic CWR v2.1 / SACEM policy checker (sum = 100.00 %, statutory caps, mandatory fields) | **L4 hard gate** (abstention ⊘) | Nobody can bypass it: a blocking error removes the work from the export | — it is a rule, not a model: it can only block, never "fix" |
| 5 | Catalog registration + generation of the `.V21` CWR file + `.xlsx` visibility export | **L2** | Explicit click "Valider & Enregistrer au Catalogue" by a named operator | the export is the legal declaration of the publisher |
| 6 | Sending the declaration to SACEM | **L1 — person only** | The copyright manager uploads the file to SACEM themselves | out of scope for the agent by design |

**What the agent must NEVER do** (our non-negotiable guardrails — each one is enforced in code and tested in `evals/`):

1. **Never send a declaration to SACEM (or any other CMO) without the explicit validation of a named human.** The agent produces files; only a person transmits them.
2. Never invent, infer or silently adjust a split percentage to make a total reach `100.00 %` (e.g. turning `33.33 × 3` into `33.34 + 33.33 + 33.33` without the human seeing it).
3. Never invent an IPI number: no certain match → empty field, red flag, human choice.
4. Never include in a `.V21` export a work for which the policy checker reports a blocking error.
5. Never copy `DRM` shares into `SYNC` when synchronisation is not explicitly stipulated in the contract.
6. Never show an extracted clause or split without the verbatim quote of the contract it comes from.
7. Never reuse a customer's contracts to train or fine-tune a model, or put them in the eval-set, without the customer's written agreement.

| Guardrail | How it is enforced | How it is tested |
|---|---|---|
| 1 — no sending without a human | No SACEM connector in the product; export requires an authenticated human action, logged with the user's name | Audit of the export logs: 100 % of exports carry a named validator |
| 2 — no invented split | Policy checker refuses any sum ≠ 100.00 %; the "⚡ Équilibrer" preset is a visible human action, never automatic | Eval cases with 3-way and 7-way splits (`evals/eval_set_v0.csv`) |
| 3 — no invented IPI | IPI field only filled from the directory; the LLM output for IPI is ignored if it is not in the directory | Eval cases with homonyms and authors without an IPI |
| 4 — gate | `is_cwr_ready == False` → work excluded from the file | Unit tests on the CWR generator |
| 5, 6 | Extraction schema requires a `source_clause_quote` per row; `SYNC` empty unless quoted | LLM-as-a-judge rubric (`evals/judge_prompt.txt`) |
| 7 | Data-processing agreement + eval data kept synthetic or consented | Provenance column in the eval-set |
