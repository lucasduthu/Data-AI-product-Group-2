# Evaluation Suite — Korom Contract-to-CWR Copilot

This folder contains the evaluation dataset, grading rubric, LLM-as-a-Judge prompt, and evaluation report for **Korom Contract-to-CWR Copilot** (Sessions 3, 4, and 5).

---

## 1. Grading Guideline (Rubric) — Written Before Grading

Each case in `eval_set_v0.csv` represents a music publishing contract PDF snippet (`input_the_agent_receives`) uploaded by a Copyright Manager. Two human graders (and the LLM Judge) evaluate the copilot's `ContractExtractionResult` + `CWRValidationReport` output as **PASS**, **FAIL**, or **ESCALATE (Block `.V21`)**:

1. **PASS (Sendable / Usable for CWR `.V21` & `.xlsx` without split recalculation):**
   - **Work Titles (`work_titles`):** 100% of ceded musical works in the contract are extracted (no truncation on multi-work tables).
   - **Parties & Roles (`parties`):** All signatory creators (`A`, `C`, `AC`, `AR`, `AD`) and publishers (`E`, `SE`) are identified with their exact role.
   - **Royalty Splits (`dep_share_pct`, `drm_share_pct`, `sync_share_pct`, `phono_share_pct`):** Extracted percentages match the contract clauses within `0.00%` tolerance. *Important French SACEM Rule:* If `SYNC` is not explicitly stipulated in a standard cession/co-édition contract, `sync_share_pct` **must** remain `0.00%` ("En attente LAI") and must **not** copy `drm_share_pct`.
   - **Groundedness (`source_clause_quote`):** Every party has a verbatim quote citing the exact article from the contract.
2. **ESCALATE / GATE BLOCK (Expected for Adversarial / Incomplete Contracts):**
   - If the contract PDF itself has unbalanced splits (`sum(DEP) != 100.00%` or `sum(DRM) != 100.00%`), exceeds the 50% publisher `DEP` cap without justification, or lacks a creator's 9–11 digit IPI number, the copilot **MUST** extract the exact numbers written in the PDF (never inventing numbers to force 100%) AND `validate_work_cwr` **MUST** attach a blocking error in `cwr_split_warnings` (`is_cwr_ready == False`) so it cannot be exported to a SACEM `.V21` file until human correction.
3. **FAIL:**
   - The LLM hallucinates a split percentage, invents a right holder not in the PDF, misses works in a multi-work table, copies `DRM` into `SYNC` without contractual basis, or fails to block an invalid split from `.V21` export.

---

## 2. Agreement Rates (30 Stratified Cases — Session 5)

- **Human–Human Agreement Rate (Grader A vs. Grader B, independent):** **93.3% (28 / 30 cases)** — Cohen's $\kappa = 0.84$.
- **Human–Judge Agreement Rate (LLM Judge `judge_prompt.txt` vs. Human Consensus):**
  - *Initial Run:* **83.3% (25 / 30 cases)** — The judge initially penalized 3 French co-publishing contracts for having `sync_share_pct = 0.00%`.
  - *After 1 Guideline & Prompt Refinement:* **90.0% (27 / 30 cases)** — Added explicit instruction in `judge_prompt.txt` that un-stipulated synchronization rights in French SACEM contracts must remain `0.00%` ("En attente LAI").
