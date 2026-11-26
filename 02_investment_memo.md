# 02 — Investment Memo: Korom Contract-to-CWR Copilot

**Decision:** **CONDITIONAL GO** — Proceed to pilot rollout **on condition that** our Session 4 prototype achieves **$\ge 75\%$ exact split & work extraction rate** on the 50-case evaluation set (`eval_set_v0.csv`) with **$0\%$ arithmetic CWR policy breaches** (`DEP/DRM != 100.00%`).

---

## 1. How much? (Bottom-Up Upside vs. 7-Line Cost Model — 12-Month Horizon, Per 100 Publisher Customers)

*All numbers trace to `02_sizing.xlsx` (Base Case: 100 indie publishers onboarded progressively over Q1–Q4: 15% ➔ 35% ➔ 65% ➔ 85% adoption ramp; average 60 contracts/publisher/year = 6,000 contracts/year at full run-rate; 3,300 contracts processed in Year 1).*

- **Gross Upside (Year 1 Base Case): €89,100**
  1. **Legal & Copyright Admin Time Saved (€54,450):** 3,300 contracts × 25 minutes saved per contract (from 30 min manual entry down to 5 min review & export) = 1,375 hours saved × €39.60/h loaded copyright manager cost.
  2. **Avoided SACEM CWR Rework & Faster Royalty Collection (€34,650):** Preventing the 15% baseline CWR rejection rate on 3,300 contracts (~495 rejected registrations avoided × €70 combined rework + cash-flow delay cost).
- **Total 7-Line AI & Operations Cost (Year 1 Base Case): €26,820**
  1. *Tokens & Inference (€99):* 3,300 contracts × ~15k input tokens + 1.5k output tokens on Claude 3.5 Sonnet (~$0.03/contract, reduced by SHA-256 caching on repeated uploads).
  2. *Integration & Engineering Build (€12,000):* 3 person-weeks of initial engineering (PDF parser, Pydantic schema, CWR v2.1 `.V21` & `.xlsx` generators).
  3. *Evaluation & Golden Dataset Maintenance (€2,400):* Building and grading the 100-case stratified contract dataset.
  4. *Human-in-the-Loop Supervision Cost (€8,250):* Mandatory `L2` human review: 3,300 contracts × 3.8 minutes average review time × €39.60/h.
  5. *Monitoring & On-Call (€1,800):* Tracking extraction confidence, CWR warning rates, and OpenRouter latency.
  6. *Re-evaluation at Model Changes (€1,200):* Running regression evals twice a year when upgrading LLM checkpoints.
  7. *Expected Cost of Error (€1,071):* $3,300 \times 1.5\%$ residual human-missed metadata error rate (e.g., typo in work subtitle or non-blocking role code) $\times €21.60$ correction cost. *(Catastrophic split sum errors are $0\%$ thanks to the deterministic Rung 1 CWR gate).*
- **Net Year-1 Value (Base Case):** **+€62,280** (Net value per processed contract: **+€18.87**).

---

## 2. How sure? (Three Scenarios & Expected Value)

| Scenario | Probability | Adoption & Extraction Accuracy | Net Year-1 Value | Key Driver |
|---|---|---|---|---|
| **Low (Bear)** | **25%** | Slow adoption (avg 30%), LLM struggles on complex multi-act TV bundles (55% accuracy ➔ 12 min human review) | **+€11,400** | High human-in-the-loop editing time eats 65% of time savings; `⏻` regex fallback used frequently. |
| **Base (Modal)** | **55%** | Staged adoption (avg 55%), **82% extraction accuracy**, 3.8 min human review, 0% CWR gate breach | **+€62,280** | Eliminates manual typing on standard Cessions & Co-éditions; 1-click `.V21` and `.xlsx` export. |
| **High (Bull)** | **20%** | Fast adoption (avg 75%), **90%+ accuracy** including multi-work tables (37 works/contract), < 2 min review | **+€118,500** | Massive time multiplier on audiovisual cue-sheet contracts (TF1/Newen series bundles). |
| **Expected Value (EV)** | **100%** | $0.25(11.4\text{k}) + 0.55(62.28\text{k}) + 0.20(118.5\text{k})$ | **+€60,804** | Positive across all three scenarios because the deterministic CWR gate caps the downside cost of error. |

- **The Flip Point:** Our sensitivity table flips from GO to NO-GO if **un-edited work & split extraction accuracy drops below 60%** (or if human review + correction time exceeds **14 minutes per contract**). Our Session 4 prototype must prove **$\ge 75\%$** on `eval_set_v0.csv`.

---

## 3. What if we're wrong? (Tail Risk & Containment)
If the LLM hallucinates royalty splits on a newly encountered contract template:
1. **Hard Containment (Rung 1 Gate):** `validate_work_cwr` checks $\sum \text{DEP} = 100.00\%$ and $\sum \text{DRM} = 100.00\%$ in `Decimal` and blocks `.V21` CWR generation if any error exists.
2. **Visual Grounding (`L2` Checkpoint `⊘`):** Every extracted party displays its **verbatim PDF clause quote** (`source_clause_quote`). If the quote is missing or the sum is unbalanced, red badges alert the operator, who can apply a **1-click SACEM statutory preset (50/50 or Balance Remainder)**.
3. **Kill Switch (`⏻`):** One click in the navbar disables the LLM and routes PDFs to the local deterministic regex parser (`_deterministic_regex_fallback_parse`).

---

## 4. Compared to what? (Do-Nothing Baseline & Next-Best Project Hurdle)
- **vs. Do-Nothing Baseline (-€18,500/yr degradation):** Manual contract volume grows +8%/yr while SACEM enforces stricter CWR v2.1/v2.2 electronic validation, increasing uncollected royalty delays.
- **vs. Next-Best Project Hurdle (+€38,000/yr EV):** Our alternative engineering project with the same team is building a **purely deterministic SACEM CGP1 CSV importer & manual form wizard** (no PDF AI extraction). While lower risk, CGP1 only covers general representation agreements, leaving 100% of individual work cession PDFs manually typed. **Korom Contract-to-CWR Copilot beats the hurdle by +€22,804/yr (+60% higher EV).**

---

## 5. Build, Buy, or Orchestrate?
**Decision: ORCHESTRATE (FastAPI + OpenRouter API for LLM Rung 3 + In-House Deterministic CWR & XLSX Engine).**  
We **build** our core domain IP (the CISAC CWR v2.1 serializer, SACEM statutory validator, and `.xlsx` exporter) and **orchestrate** commodity frontier LLM inference via OpenRouter (`claude-3.5-sonnet`) with a local deterministic regex fallback. We would only switch to **Buy** if a vertical music-tech vendor offered a SACEM-certified French/English contract parser under **€1.50 per contract** with native CWR `.V21` output (none exists today; *Le Sage* and *Vistex* have zero PDF AI).
