# 05 — Metrics & Evaluation Plan · Korom Contract-to-CWR Copilot

> All numbers trace directly to [`02_sizing.xlsx`](02_sizing.xlsx) and [`evals/report_v0.md`](evals/report_v0.md).

---

## §1 Place the Number — The Five-Level Metric Table

| Level | Metric for Korom Contract-to-CWR Copilot | Current Value (`report_v0.md` / Baseline) | Evaluation Type | Owner | Read Cadence |
|---|---|---|---|---|---|
| **1 · Component / Model** | **Field-Level Split & Work Recall/Precision** (exact match on `work_titles`, `role`, and `dep_share_pct` / `drm_share_pct` before human edit) | **88.0%** (44/50 cases exact) | Offline Golden Eval (`eval_set_v0.csv` / `v1.csv`) | AI / ML Engineer | Every commit / model change |
| **2 · AI System (End-to-End)** | **Un-Edited Approval Rate ("Usable as-is at `⊘`")** — % of uploaded PDFs where 2 graders approve the extracted works & splits without recalculating percentages | **88.0%** (Criterion was $\ge 80.0\%$; Flip point is $60.0\%$) | Dual-human grading + LLM-as-a-Judge on `evals/` | AI Product Manager | Weekly & pre-release |
| **3 · Guardrails & RAI** | **1) CWR Arithmetic Breach Rate** (% of `.V21` exports with `DEP != 100%` or `DRM != 100%`)<br/>**2) Verbatim Citation Groundedness Rate** (% of parties with an exact quote from the PDF) | **0.0% breaches** (12/12 blocked)<br/>**96.0% grounded** | Deterministic `pytest` gate + Judge rubric check | Tech & Legal Ops Lead | Real-time (every upload/export) |
| **4 · Product** | **Median Contract-to-CWR Registration Time** (from PDF upload to validated work + `.V21` & `.xlsx` download) | **2.4 minutes** (down from **30.0 min** manual baseline) | In-app telemetry (`created_at` to `validated_at`) | Product Manager | Weekly |
| **5 · Business** | **1) Hours of Copyright Admin Saved / Contract**<br/>**2) First-Pass SACEM CWR Acceptance Rate (`ACK`)** | **27.6 min saved/contract**<br/>**99.5% CWR ready** (vs 85% baseline) | Production logs + SACEM `.ACK` return files | Head of Copyright / CEO | Monthly / Quarterly SACEM cutoff |

---

## §2 Write the Stop Criterion

> **Stop Criterion:** *"We stop improving the LLM contract extractor's un-edited split accuracy at **92%**, because every contract still goes through the mandatory 90-second `L2` human legal checkpoint (`⊘`), so moving from 92% to 98% saves less than 15 seconds of human time per contract while requiring custom OCR/fine-tuning that would increase inference cost by $10\times$."*
- **Non-negotiable Floor (Release Blocker):** **0.0% CWR Arithmetic Breach Rate** — any code or model change that allows a work with `DEP != 100.00%`, `DRM != 100.00%`, `Pub DEP > 50.00%`, or an invalid IPI to be serialized into a `.V21` CWR file immediately blocks the release in CI (`test_cwr_validator.py`).

---

## §3 Choose What to Protect — Primary, Guardrails, Counter-Metrics & Fairness

| Role | Metric Name | Numerator / Denominator | Level | Lag | Source | Owner |
|---|---|---|---|---|---|---|
| **PRIMARY** | **Contract-to-CWR Completion Time (at $\ge 80\%$ Un-Edited Split Accuracy)** | Median minutes from `POST /contracts/upload` to `POST /contracts/{id}/validate` + `.V21`/`.xlsx` export | Product (L4) | Immediate (per session) | `Contract.created_at` vs `validated_at` | AI Product Manager |
| **GUARDRAIL 1** | **Invalid CWR `.V21` Export Rate** | `# of exported NWR transactions failing CISAC v2.1 rules / total exported NWR transactions` | Guardrail (L3) | Immediate | `cwr_exporter.py` + `cwr_validator.py` | Tech Lead |
| **GUARDRAIL 2** | **Un-Grounded Split Extraction Rate** | `# of extracted parties without a verbatim PDF substring in source_clause_quote / total extracted parties` | Guardrail (L3) | Immediate | `contract_ai_parser.py` audit | AI Engineer |
| **GUARDRAIL 3** | **SACEM Official `NACK` Rejection Rate** | `# of works rejected in SACEM .ACK return file / total works submitted in .V21` | Business (L5) | 2 to 4 weeks | SACEM `.ACK` ingestion log | Head of Copyright |
| **COUNTER-METRIC 1** | **Human Rubber-Stamping Rate (`< 10s` Review)** | `# of PENDING_REVIEW contracts approved in < 10 seconds despite having ≥ 1 warning or > 5 works / total approvals` | Product (L4) | Immediate | `AuditLog` timestamps | Legal Ops Lead |
| **COUNTER-METRIC 2** | **Orphan / Un-Exported Validated Works Rate** | `# of validated works sitting in A_DEPOSER > 30 days without .V21 or .xlsx export / total validated works` | Product (L4) | 30 days | Catalog `Work.lifecycle_status` | Product Manager |

- **Segments Reported (from S3 Audit — Simpson's Paradox Prevention):**
  1. `contract_language`: French (`FR`) vs. English (`EN` — e.g., Kaptain Music / international sub-publishing).
  2. `contract_complexity`: Single-Work Cession (`1 work`) vs. Multi-Work Bundle (`2–40 works`, audiovisual series / albums).
  3. `contract_type`: `CESSION_EDITION` vs. `CO_EDITION` vs. `LETTRE_ACCORD_INTERPRETE`.
- **Fairness / Parity Metric:** **Cross-Language Extraction Parity** — the gap in Un-Edited Approval Rate between English contracts (`EN`) and French contracts (`FR`) must not exceed **10 percentage points** (currently `90% FR` vs `85% EN` = `5 pts` gap).
- **Harm Threshold (Immediate Rollout Stop — copied to `governance.md`):** If **any (`\ge 1`) invalid CWR `.V21` file** with unbalanced splits is exported, OR if the **Human Split-Correction Rate exceeds 35%** over 20 consecutive uploads, the On-Call Engineer activates the **`⏻ Override Switch`**.

---

## §4 Derive the Three Business Metrics

```text
[Component: 88% Un-Edited Extraction + 100% CWR Gate (report_v0.md)]
       │
       ├──▶ [Product: Registration time drops from 30.0 min to 2.4 min (-92%)]
       │          └──▶ Business Metric 1: Median Handling Time per Contract moves from 30.0 min to ≤ 5.0 min (Immediate read)
       │
       ├──▶ [Guardrail: 100% of unbalanced splits & missing IPIs caught before .V21 export]
       │          └──▶ Business Metric 2: First-Pass SACEM CWR Acceptance Rate moves from 85.0% to ≥ 98.0% (4-week lag via SACEM .ACK)
       │
       └──▶ [Counter-Metric Check: Verbatim citations + Excel .xlsx visibility sheet]
                  └──▶ Business Metric 3 (Non-Effect Band): Post-Registration Songwriter Split Dispute Rate remains unchanged at its < 0.5% baseline (± 0.2 pt band over 90 days; stop above 0.7%)
```

| # | Business Metric | Baseline (`02_sizing.xlsx`) | Expected Effect (from `report_v0.md`) | Read Lag | Read Date | Hypothesis Tested |
|---|---|---|---|---|---|---|
| **BM1** | **Median Contract-to-CWR Processing Time** | `30.0 min / contract` | **$\le 5.0\text{ min / contract}$** (observed `2.4 min` in prototype; `-83%` to `-92%`) | Immediate | Week 2 of pilot | H1 (Time savings / Flip point) |
| **BM2** | **First-Pass SACEM CWR Acceptance Rate (`ACK`)** | `85.0%` (`15%` rejected in legacy sample) | **$\ge 98.0\%$** (`+13 pts`, driven by the 100% deterministic CWR gate) | 2–4 weeks | Week 4 of pilot | H2 (Zero-error statutory compliance) |
| **BM3** | **Songwriter / Co-Publisher Split Dispute Rate** *(Non-Effect Band)* | `< 0.5%` | **Unchanged within a ± 0.2 pt band** (speed does not degrade legal accuracy); **stop band:** > 0.7% of registered works disputed over 90 days → back to field-by-field review (`⏻`) | 90 days | Month 3 post-launch | H3 (Trust & Groundedness via `.xlsx` + quotes) |

---

## §5 Make the Judge Trustworthy (Human–Human & Human–Judge Agreement)

Full grading rubric, prompt, and 50-to-100 case evaluation details are in [`evals/README.md`](evals/README.md) and [`evals/judge_prompt.txt`](evals/judge_prompt.txt).
- **Human–Human Agreement Rate (on 30 stratified contracts):** **93.3% (28 / 30)** — Cohen's $\kappa = 0.84$.
- **Human–Judge Agreement Rate (LLM Judge vs. Consensus Human on the same 30 cases):** **90.0% (27 / 30)** after one rubric refinement (clarifying that `sync_share_pct = 0.00` is a **PASS** when synchronization is not stipulated in a French SACEM cession contract).
