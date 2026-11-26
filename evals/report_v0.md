# Evaluation Report v0 — Korom Contract-to-CWR Copilot

**Date:** November 2026 · **Dataset:** [`evals/eval_set_v0.csv`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/korom-ai-product/evals/eval_set_v0.csv) (**50 labelled contract cases**, never used for prompt tuning)

---

## 1. Headline Result against Success Criterion

> **"88.0% (44 / 50) of contract cases in `eval_set_v0.csv` received a structured work & split extraction that two graders approved without manual split calculation — exceeding our 80.0% target criterion (and 60.0% flip point). 100.0% (12 / 12) of unbalanced or missing-IPI adversarial contracts were caught and blocked from `.V21` export by the deterministic CWR policy gate (`0.0%` arithmetic breach rate)."**

---

## 2. Breakdown by Pre-Registered Segment

| Segment | Cases ($N$) | Un-Edited Pass Rate | CWR Gate Accuracy (`validate_work_cwr`) | Median Processing Time |
|---|---|---|---|---|
| **1 · Standard Cession FR (`CESSION_EDITION`)** | 18 | **94.4%** (17 / 18) | **100.0%** (18 / 18) | `1.8 min` |
| **2 · Co-Publishing 50/50 (`CO_EDITION`)** | 12 | **83.3%** (10 / 12) | **100.0%** (12 / 12) | `2.6 min` |
| **3 · English Production / Audiovisual Multi-Work (`EN`)** | 8 | **75.0%** (6 / 8) | **100.0%** (8 / 8) | `3.1 min` |
| **4 · Adversarial / Unbalanced Splits / Missing IPI** | 12 | **91.7%** (11 / 12) | **100.0%** (12 / 12 blocked from `.V21`) | `2.4 min` |
| **Total Stratified Eval-Set v0** | **50** | **88.0% (44 / 50)** | **100.0% (50 / 50)** | **`2.4 min`** (vs `30.0 min` manual) |

---

## 3. The Three Most Frequent Misses — Traced to Components & Fixed in `spec.md` v2

| # | Miss Description | Frequency in v0 | Component Responsible | Fix Added to `spec.md` v2 & Codebase |
|---|---|---|---|---|
| **Miss #1** | **Multi-Work Audiovisual Subgroups (e.g. *Musique Originale* by 2 composers vs *Bande Originale* by 1 composer in the same Article 1):** Early extraction merged all composers onto all works. | 3 cases | **Component 2a / 2b** (`contract_ai_parser.py`) & **Component 4** (`contracts.py`) | Added `work_subgroups` extraction and per-subgroup split assignment during `validate_contract_human_in_the_loop` (verified in `test_coedition_parser.py`). |
| **Miss #2** | **Co-Publishing `PHONO` Share Double-Counting (`150%`):** When two co-publishers shared the 50% publisher share, early fallback logic assigned 50% `PHONO` to each publisher (`50 + 50 + 50 = 150%`). | 2 cases | **Component 2b** (`contract_ai_parser.py`) | Fixed co-edition editorial split division (`25.00%` Publisher 1 + `25.00%` Publisher 2 + `50.00%` Creators = `100.00%` exact). |
| **Miss #3** | **Implicit `DRM` $\rightarrow$ `SYNC` Copy on French Cession Contracts:** When a contract did not mention Synchronization, a schema fallback copied `drm_share_pct` into `sync_share_pct`. | 1 case | **Schema Validator** (`work.py` / `contract_ai_parser.py`) | Removed implicit copy; un-stipulated `SYNC` now stays at `0.00%` with UI badge `"En attente LAI"` until a *Lettre-Accord Artiste-Interprète* is uploaded. |
