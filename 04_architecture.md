# 04 · Architecture — Korom · Contract-to-CWR Copilot

> Describes the working prototype in [`/prototype`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype). Every component maps directly to a Python service in `prototype/backend/app/services/` and a Next.js screen in `prototype/frontend/src/app/`.

---

## 1. One-line description
A B2B music-tech copilot that extracts musical works, right holders, IPI numbers, and statutory royalty splits (`DEP`, `DRM`, `SYNC`, `PHONO`) with verbatim clause citations from signed PDF publishing contracts, enforces 100.00% CISAC/SACEM compliance via a deterministic policy gate, and—after human approval (`⊘`)—exports official **CWR v2.1 (`.V21`)** files for SACEM and **Excel (`.xlsx`)** visibility workbooks.

---

## 2. The Diagram (with Human Checkpoints `⊘` and Override Switch `⏻`)

```text
Signed Contract PDF
  │
  ▼
[1. Input Guardrail & PDF Router] ──(Not a contract)──▶ [HTTP 422 Rejection] (Zero token waste) (validate_is_music_publishing_contract)
  │
  ├──(if ⏻ Switch ON or API down)──▶ [2b. Deterministic Regex Parser] (_deterministic_regex_fallback_parse · Rung 1)
  │                                               │
  ▼                                               ▼
[2a. Structured LLM Extractor] ──────────▶ [3. CWR 2.1 Policy Gate] (validate_work_cwr · Rung 1 Decimal)
(Rung 3 · Claude 3.5 Sonnet, temp=0,          │ Checks: ∑DEP=100%, ∑DRM=100%, Pub DEP≤50%, 11-digit IPI
 Pydantic schema + Verbatim quotes)           │
                                              ├──▶ If blocking error: attaches red CWR warnings (cannot export .V21)
                                              ▼
                                    ⊘ [4. Human-in-the-Loop Review] (L2 Approval + 1-click SACEM presets)
                                              │
                              ┌───────────────┴───────────────┐
                              ▼ (Approved)                    ▼ (Rejected)
               [5. Work Catalog Registration]          [Marked REJECTED]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   [Export CISAC CWR v2.1 (.V21)]    [Export Visibility Excel (.xlsx)]
   (cwr_exporter.py · SACEM norm)    (xlsx_exporter.py · OpenXML)

⏻ OVERRIDE SWITCH: Navbar toggle button (`POST /api/v1/settings/override-switch`) or `.env` config.
   Switches `openrouter_model` to `"deterministic"`, bypassing the LLM immediately and routing 100% of uploads to Step 2b.
```

---

## 3. Component Table

| # | Component | Code Location | Rung (1–4) | Pattern | Trust Level | Checkpoint `⊘` | Metric Observed |
|---|---|---|---|---|---|---|---|
| **1** | **PDF Text Extractor & Document Router** | [`pdf_extractor.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/services/pdf_extractor.py), [`contract_ai_parser.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/services/contract_ai_parser.py) | **Rung 1** (Rules) | Routing | `L4` | `none` | Non-empty text extraction rate (%) |
| **2a** | **Structured LLM Contract Extractor** | [`contract_ai_parser.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/services/contract_ai_parser.py) (`parse_contract_text_with_ai`) | **Rung 3** (Pretrained LLM) | Structured Output + Grounding | `L2` | `approval` (lands in `PENDING_REVIEW`) | Work & Split Exact Match Rate (%), Verbatim Quote Groundedness (%) |
| **2b** | **Deterministic Regex Fallback Parser** | [`contract_ai_parser.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/services/contract_ai_parser.py) (`_deterministic_regex_fallback_parse`) | **Rung 1** (Rules / Regex) | Fallback | `L2` | `approval` | Fallback recovery rate (100% uptime) |
| **3** | **CWR 2.1 Statutory Policy Checker** | [`cwr_validator.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/services/cwr_validator.py) (`validate_work_cwr`) | **Rung 1** (`Decimal` Rules) | Policy Gate | `L4` | `abstention` (blocks CWR `.V21` export on error) | Statutory & arithmetic breach rate (= 0.0% on DEP, DRM, PHONO & Publisher <= 50%) |
| **4** | **Human-in-the-Loop Arbitration UI** | [`contracts/page.tsx`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/frontend/src/app/contracts/page.tsx), [`contracts.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/api/routers/contracts.py) | **Human (`⊘`)** | Human-in-the-loop | `L2` | `approval` | Human edit rate (%) & review duration (sec) |
| **5** | **CWR v2.1 (`.V21`) & Excel (`.xlsx`) Exporters** | [`cwr_exporter.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/services/cwr_exporter.py), [`xlsx_exporter.py`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/prototype/backend/app/services/xlsx_exporter.py) | **Rung 1** (Deterministic Serializers) | Chaining | `L4` | `none` (post-approval) | CWR syntax compliance (100%) |

---

## 4. Workflow or Agent?
We deliberately built a **fixed, deterministic Workflow with a single bounded Rung 3 LLM step**, **not** an open-ended autonomous agent that chooses its own tools in a loop. In music copyright registration, the legal rules (French Intellectual Property Code Art. L131-3 and CISAC CWR v2.1 fixed-width record specs) are strict and invariant: every contract must go through text extraction ➔ structured party/split extraction ➔ `Decimal` 100.00% validation ➔ human sign-off (`⊘`) ➔ `.V21` / `.xlsx` serialization. Giving an agent autonomy to decide whether to run the CWR validator or to "fix" an unbalanced split on its own would create severe legal and financial liability. To move one step up in autonomy (from `L2` to `L3` auto-registration on high-confidence contracts), we would need $\ge 99.5\%$ precision on `eval_set_v1.csv` across 6 months of production shadow logs and pre-existing IPI verification against the official SACEM directory.

---

## 5. Fallbacks
- **When PDF text extraction finds nothing (e.g., un-OCRed image scan):** `extract_text_from_pdf_bytes` returns an empty string; the contract is flagged with `confidence_score < 0.50` and routed to manual entry with 1-click SACEM statutory presets (`50/50`, `Co-édition 25/25/50`).
- **When the model's confidence is below threshold (`< 0.80`) or clauses are missing:** The UI highlights the contract in Amber (`À auditer`), displays `"En attente LAI (0%)"` for un-stipulated `SYNC` rights, and requires explicit human completion.
- **When the CWR policy checker blocks the draft (`DEP != 100%`, `DRM != 100%`, or missing IPI):** `validate_work_cwr` attaches `blocking_errors` (`cwr_split_warnings`). Even if the work is saved to the catalog, `generate_cwr_v21_content` **automatically skips** any work where `is_cwr_ready == False` and lists it in `skipped_works` with the exact blocking reason so it can never corrupt a SACEM `.V21` batch.
- **When the OpenRouter LLM API is down, times out, or exceeds budget:** `parse_contract_text_with_ai` catches the exception (or checks the SHA-256 cache first) and immediately falls back to `_deterministic_regex_fallback_parse` (`Rung 1`).

---

## 6. The Override Switch `⏻`
- **Who can switch it off:** Any Copyright Manager or On-Call Engineer directly from the top navigation bar button (**`⏻ IA Active / Mode Déterministe`**) or via `POST /api/v1/settings/override-switch`.
- **Scope:** Workspace-wide (`WorkspaceSettings.openrouter_model = "deterministic"`), logged immutably in `AuditLog` (`action_type = "AI_OVERRIDE_SWITCH_TOGGLED"`).
- **Tested on:** Tested on **17 November 2026** by Ariane Boulet on the local staging prototype (`http://localhost:3000/contracts`). Execution time: **< 2 seconds**.

---

## 7. Data
- **Demo / synthetic data (`prototype/data/`):** Synthetic French and English music publishing agreements (single-song cession, 50/50 co-edition, multi-work Kaptain Music / TF1 audiovisual bundles, Lettre-Accord Artiste-Interprète) and a 1,200-work CWR v2.1 test file.
- **Evaluation data (`evals/eval_set_v0.csv`):** **50 labelled contract extraction cases** covering 4 segments (*Standard Cession FR*, *Co-édition 50/50*, *English Production Music*, *Adversarial / Unbalanced / Missing IPI*). Labelled before evaluation and **never used for prompt tuning**.
- **Personal data & governance:** Signatory names, postal addresses, and 11-digit IPI codes are processed under GDPR Art. 6(1)(b) (performance of a publishing contract). Full details in [`governance.md`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/governance.md).

---

## 8. Eval Result v0
From [`evals/report_v0.md`](file:///Users/ariane/Desktop/Obsidian%20vault/98%20%F0%9F%8E%93%20Albert%20School%20-%20class%20materials/MSA-DAT07-04_Data%20&%20AI%20Product%20-%20From%20Diagnosis%20to%20Delivery/Data-AI-product-Group-2/evals/report_v0.md):  
> **"88.0% (44 / 50) of contract cases in `eval_set_v0.csv` got a structured extraction that two graders approved without split calculation edits — criterion was 80.0%. 100% (12 / 12) of unbalanced/missing-IPI adversarial cases were caught and blocked by the deterministic CWR policy gate (`0%` false-pass rate)."**

---

## 9. What we would build next (3 lines max)
1. **OCR Pre-Processing Layer (Rung 2 Document Layout/OCR):** Add local OCR (`Tesseract` / `Docling`) before Step 1 to handle old 1990s scanned image-only PDFs that currently lack selectable text.
2. **SACEM IPI Directory Auto-Lookup:** Connect Step 3 to the CISAC/SACEM IPI registry to suggest missing 11-digit IPI numbers automatically during the `⊘` review step.
3. **CWR ACK/NACK Loop Closure:** Automatically parse SACEM's return `.ACK` files to transition works from `A_DEPOSER` to `DEPOSE_ET_EXPLOITE`.
