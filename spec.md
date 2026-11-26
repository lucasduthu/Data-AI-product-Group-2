# `spec.md` — Executable Specification · Korom Contract-to-CWR Copilot · v2

> Completed in Session 4 after running the evaluation suite (`evals/eval_set_v0.csv`) and incorporating fixes for the 3 primary failure modes ("the 3 misses").

---

## `problem`
Copyright Managers at independent music publishers spend ~30 minutes per signed PDF agreement manually extracting work titles, right holders, roles (`A`, `C`, `AC`, `E`, `SE`), 11-digit IPI numbers, and 4-dimensional royalty splits (`DEP`, `DRM`, `SYNC`, `PHONO`), suffering a ~15% SACEM CWR rejection rate due to rounding discrepancies and missing IPIs. Korom automates extraction with verbatim clause citations, enforces 100.00% deterministic CWR validation, and exports both a SACEM-compliant CISAC **CWR v2.1 (`.V21`)** file and a structured **Excel (`.xlsx`)** visibility workbook after human approval (`⊘`).

---

## `user_workflow`
```text
- ingest_pdf   : PDF bytes + filename        -> raw_text, contract_type_hint          (L4 — automatic)
- extract_ai   : raw_text + system_prompt    -> ContractExtractionResult (JSON)       (L2 — lands in PENDING_REVIEW)
- check_cwr    : extracted parties & splits  -> CWRValidationReport (blocking_errors) (L4 — deterministic Decimal gate)
- review_human : draft + verbatim quotes     -> validated Contract + created Works    (⊘ Person only — L2 approval)
- export_files : validated Works             -> CWR v2.1 (.V21) + Visibility (.xlsx)  (L4 post-approval)
```

---

## `io_contracts`
```json
{
  "input_contract_upload": {
    "file": "binary PDF (.pdf) or text (.txt), up to 120,000 characters",
    "entity_id": "UUID (optional publishing entity scope)"
  },
  "output_contract_extraction_result": {
    "contract_reference": "string (prioritizes Recording/Cotage N° e.g. 'KFC674-01' or 'CTR-2026-MS02')",
    "contract_type": "CESSION_EDITION | CO_EDITION | LETTRE_ACCORD_INTERPRETE",
    "publisher_name": "string",
    "counterparty_name": "string",
    "work_titles": ["string (all ceded works extracted from tables or lists)"],
    "work_subgroups": [
      {
        "name": "string (e.g. 'Musique Originale' vs 'Bande Originale')",
        "composers": ["string"],
        "work_titles": ["string"]
      }
    ],
    "parties": [
      {
        "party_name": "string",
        "role": "A | C | AC | E | SE | AD | AR | P | I",
        "ipi_number": "string (9-11 digits) | null",
        "dep_share_pct": "Decimal(5,2)",
        "drm_share_pct": "Decimal(5,2)",
        "sync_share_pct": "Decimal(5,2)",
        "phono_share_pct": "Decimal(5,2)",
        "source_clause_quote": "string (verbatim quote from the PDF)"
      }
    ],
    "extracted_clauses_summary": "string (bulleted synthesis of financial articles)",
    "cwr_split_warnings": ["string (deterministic blocking errors from validate_work_cwr)"],
    "confidence_score": "float [0.0, 1.0]",
    "validation_status": "PENDING_REVIEW | VALIDATED | REJECTED"
  },
  "output_exports": {
    "cwr_v21": "Fixed-width ASCII CISAC CWR v2.1 (.V21) with HDR, GRH, NWR, SPU, SPT, SWR, SWT, ALT, GRT, TRL records",
    "xlsx_visibility": "OpenXML Excel workbook (.xlsx) with Sheet 1 (Bordereau) and Sheet 2 (Catalogue Détaillé: Titles, Cotages, IPIs, DEP/DRM/SYNC/PHONO, CWR Status)"
  }
}
```

---

## `edge_cases` *(Updated in v2 from Session 4 Eval Misses)*
1. **Miss #1 fixed in v2 — Un-stipulated Synchronization (`SYNC`) rights in standard SACEM Cession contracts:**
   - *Rule:* Never copy `drm_share_pct` into `sync_share_pct` by default. If `SYNC` is not explicitly stipulated in the PDF, set `sync_share_pct = "0.00"` and display `"En attente LAI (0%)"` in the UI without triggering a false CWR blocking error.
2. **Miss #2 fixed in v2 — Multi-work audiovisual contracts with distinct composer sub-groups (e.g., Article 1 splitting *Musique Originale* vs. *Bande Originale*):**
   - *Rule:* Extract all works into `work_subgroups` with their respective composer lists, and during `validate_contract_human_in_the_loop`, assign splits per sub-group so Composer B is not falsely credited on Composer A's solo cues.
3. **Miss #3 fixed in v2 — Co-publishing (`CO_EDITION`) double-counting `PHONO` shares to 150%:**
   - *Rule:* In a 50/50 co-publishing agreement between two publishers, split the 50.00% editorial share into `25.00%` Publisher 1 + `25.00%` Publisher 2 + `50.00%` Creators = `100.00%` exact.
4. **Missing or malformed IPI number (`null` or `< 9` digits):**
   - *Rule:* Flagged as a blocking error in `validate_work_cwr`. During catalog audit or validation, if the right holder already exists in `RightHolderDirectory` with a verified 11-digit IPI, inject it deterministically.

---

## `fallbacks`
- **OpenRouter API unreachable, timeout (`> 25s`), or `⏻ Override Switch` set to `"deterministic"`:** Immediately execute `_deterministic_regex_fallback_parse(raw_text, source_filename)` in `contract_ai_parser.py`.
- **Work fails `validate_work_cwr` (`is_cwr_ready == False`):** Work is saved in the catalog with status `INFORMATIONS_MANQUANTES`, included in the `.xlsx` visibility export (so the team can see what is missing), but **strictly excluded** from the `.V21` SACEM CWR file (`skipped_works`).

---

## `done_criteria`
- $\ge 80\%$ of contracts in `evals/eval_set_v0.csv` pass human grading without split calculation edits (achieved **88.0%**).
- 100% of statutory breaches (`DEP/DRM/PHONO != 100%`, `Publisher > 50%` on DEP/DRM/PHONO, missing Composer R36, missing IPI, non-contract PDF upload) are intercepted by automated gates (achieved **100%** across 15 unit tests).
- Automated backend test suite passes (`pytest` / `unittest`).

---

## `out_of_scope` *(The WON'T column from `03_product_brief.md`)*
- Streaming DSP / SACEM royalty statement CSV reconciliation.
- SEPA XML ISO 20022 (`pain.001`) bank transfer generation.
- Author estate successions (*indivisions notariales*) and third-party payment mandataires.
- Multi-currency BCE exchange rate conversions.
- Self-billing invoice generation (Factur-X / IRCEC social security deductions).
