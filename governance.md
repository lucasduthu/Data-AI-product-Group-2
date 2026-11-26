# Governance — our living file

> Created for Assignment 1, one line added every session. One question at the oral is drawn from this file.
> Answers are provisional: write what you know today, and mark what you still have to check.

## Session 1 — the six questions
| # | Question | Our answer (provisional) | To check with |
|---|---|---|---|
| 1 | **EU AI Act:** which risk tier is our agent in, and why? (minimal · limited — transparency: tell the user it is an AI · high-risk · prohibited) |The system is an internal B2B back-office productivity copilot for music publishing contract data extraction and CISAC CWR formatting. It does not profile natural persons for credit, employment, or law enforcement. Users are explicitly informed when viewing AI-extracted contract fields (ConfidenceBadge + Human-in-the-loop L2 badge). | |
| 2 | **Data:** whose data does it use, and on what legal basis? (GDPR art. 6; what the B2B contract allows) |Data subjects: Songwriters, composers (Personnes Physiques), and publishing companies (Sociétés) named in music publishing agreements (names, artistic pseudonyms, 11-digit CISAC IPI codes, postal addresses, and percentage royalty splits). Legal basis: **GDPR Art. 6(1)(b) (Performance of a contract) and Art. 6(1)(c) (Legal obligation under French CPI Art. L131-3 & SACEM statutory registration).** | |
| 3 | **Accountability:** who is accountable when it is wrong — and where is the human? |**Accountability (Air Canada Principle — Moffatt v. Air Canada, 2024 BCCRT 149):** The publishing company (and Korom as B2B processor) is legally accountable for every work declaration sent to SACEM; the company can never blame the LLM for an erroneous split. **Where the human sits:** Mandatory L2 **Human Checkpoint (⊘)** on every contract (ValidationStatus.PENDING_REVIEW). No work is created in the catalog or exported to .V21 CWR without a named human operator clicking "Valider & Enregistrer au Catalogue".| |
| 4 | **Never:** what must it never do? (our first guardrail) |Never invent, infer, or silently modify a royalty split percentage (DEP, DRM, SYNC, PHONO) to force a 100.00% sum. Never copy DRM shares into SYNC shares when Synchronization is not explicitly stipulated in the contract. Never include a work in a SACEM .V21 CWR export if validate_work_cwr reports any blocking error (is_cwr_ready == False). | |
| 5 | **Explainability:** explainable to whom — the customer, the support agent, the auditor? |**To the Copyright Manager & Legal Director:** Every extracted party row displays the **exact verbatim quote (source_clause_quote)** from the PDF contract and a structured bullet summary of the financial clauses (extracted_clauses_summary). **To Co-Publishers & Songwriters:** The 1-click **Excel (.xlsx) Visibility Export** provides a human-readable table of all works, IPIs, and splits before or alongside the machine-readable .V21 CWR file. | |
| 6 | **The people it cannot serve:** what happens to them? |Contracts with unreadable/un-OCRed scans or novel multi-act clauses that fail extraction are flagged in Amber/Red (cwr_split_warnings) and completed manually in seconds using the built-in **1-click SACEM Statutory Presets (⚡ Cession 50/50, ⚡ Équilibrer solde à 100%, ⚡ Synchro LAI 11%).** | |

## Session 2 — the cost of error
- Which cost-of-error line is a **legal or reputational** risk, not just money? **A wrong split or a wrong IPI validated and sent to SACEM in the `.V21` file.** SACEM then pays the royalties to the wrong right holder until the declaration is corrected. The publisher must account for and justify these amounts (CPI art. L132-13 and L132-14), so the error becomes a dispute with a songwriter or a co-publisher, not just ~€25 of rework. An arithmetic error (sum ≠ 100.00 %) is blocked by `validate_work_cwr`; a wrong person or a wrong IPI is not, so the human checkpoint (⊘) is the only barrier.
- Who in the company **owns** that risk? **The publisher's Head of Copyright & Legal Ops**, who validates and sends every declaration. On the Korom side, the Tech Lead owns the deterministic CWR gate and the Override Switch (⏻). *To check:* how long SACEM takes to correct a wrong declaration and recover the royalties paid.

## Session 3 — data
1. **Provenance:** Synthetic & anonymized French/English publishing contracts modeled on CSDEM/SACEM standards and real industry layouts (Cession d'édition, Co-édition, Kaptain Music / TF1 audiovisual bundles, Lettre-Accord Artiste-Interprète).
2. **Volume & Labels:** 50 labelled cases in `evals/eval_set_v0.csv` (growing to 100 in S5), manually verified by two graders.
3. **Coverage by Segment:** Covers French (`FR`) and English (`EN`) contracts, single-song and multi-work tables (up to 37 works), and unbalanced adversarial contracts.
4. **Rights & Privacy:** No real confidential artist bank accounts (IBANs) or unreleased commercial PDFs are sent to external training pipelines; OpenRouter calls use zero-data-retention endpoints with SHA-256 local caching.
5. **Leakage Prevention:** `evals/eval_set_v0.csv` is strictly separated from `SYSTEM_PROMPT` examples and regex rules.
6. **Freshness & Retention:** Contract records and `AuditLog` entries are retained for the statutory duration of copyright administration (5 years minimum for tax/accounting, 70 years for catalog title registry), with strict multi-entity tenant isolation (`entity_id` / `X-Entity-Id`).

## Session 4 — human-in-the-loop points and the override switch
- **Human Checkpoints (`⊘`):**
  1. **Checkpoint `⊘1` (Approval — `L2`):** Mandatory human validation of extracted contract fields, verbatim quotes, and 100.00% split gauges (`POST /api/v1/contracts/{id}/validate`) before works are created in the catalog.
  2. **Checkpoint `⊘2` (Abstention Gate — `L4`):** `validate_work_cwr` automatically abstains from serializing any work with `DEP != 100.00%`, `DRM != 100.00%`, `Pub DEP > 50.00%`, or invalid IPI into `.V21` CWR files.
- **Override Switch (`⏻`):** Owned by the **Tech Lead / On-Call Engineer** (and exposed in the UI navbar for the Copyright Manager). Toggles `WorkspaceSettings.openrouter_model` to `"deterministic"` via `POST /api/v1/settings/override-switch`. Tested on **17 November 2026**.

## Session 5 — counter-metrics and the segments we report
- **Counter-metrics:** rubber-stamping (contracts approved in < 30 s or with 0 edits while the eval-set still shows errors) and the share of contracts pushed back to manual entry. If the primary rises while these rise too, the gain is fake.
- **Segments we report:** contract type, catalogue size, document quality (native / scanned), language, number of right holders per work — pre-registered in `05_metrics.md`, never added after the results.
- **Business metrics and their stop band (Mathilde):** handling time per contract (30 → ≤ 5 min), first-pass SACEM acceptance (85 % → ≥ 98 %), and one non-effect: the songwriter / co-publisher split dispute rate stays at its < 0.5 % baseline (± 0.2 pt). Above 0.7 % of registered works disputed over 90 days, the publisher's Head of Copyright & Legal Ops is alerted and contracts go back to field-by-field review (⏻), whatever the time saved (`05_metrics.md` §4).
## Session 6 — protected segments and the harm threshold that stops an experiment
- **Protected segments:** small publishers with scanned contracts and contracts with 4+ right holders (highest risk of a wrong payment). A guardrail breach in one of them switches that segment back to manual entry, whatever the average says.
- **Harm threshold that stops the A/B at once:** one work reaching SACEM with a split ≠ 100.00 %, or 2+ wrong-IPI declarations in a week, or > 20 % of contracts approved in under 30 s (`06_07_experiments_operations.md`, A7).
## Session 7 — accountable owner, rollback authority, incident path
- **Accountable owner:** Ariane (product); on the customer side, the publisher's copyright / legal director signs every declaration.
- **Rollback authority:** Laura or Ariane can press the Override Switch without asking anyone (< 2 min); the customer's copyright manager can press it for their own catalogue.
- **Incident path:** P1 (wrong declaration sent) → switch, correction filed with SACEM within 24 h, root cause in 5 days; P2–P4 in `06_07_experiments_operations.md`, B5.
## Session 8 — launch decision
- **Launch decision (Mathilde):** CONDITIONAL GO to production (`08_launch_memo.md` §1), on one condition: the mandatory human checkpoint (⊘) stays active on 100 % of uploaded contracts. No work reaches the catalogue or a `.V21` file without a named person validating it.
- **Who signs it:** the publisher's Head of Copyright & Legal Ops, with Korom's AI Product Manager, on the evidence in §2 (88 % un-edited extraction on 50 cases, 12/12 split errors blocked, 30 → 2.4 min per contract). If a later eval falls below the 60 % flip point, the decision goes back to NO-GO.

| Session | Who | What was added |
|---|---|---|
| S1 | Ariane | Initialisation of governance.md and 00_pitch.md|
| S1 | Emma | 01_problem_statement.md |
| S1 | Laura | EU AI Act & GDPR in governance.md |
| S2 | Mathilde | Cost of error: legal / reputational risk line and its owner |
| S3 | Emma | 03_product_brief.md |
| S3 S4 | Lucas | evals folder |
| S4 | Ariane | 04_architecture.md and prototype source code |
| S5 S6 | Lucas | 05_metrics.md & evals/README.md |
| S5 | Mathilde | Business metrics (05_metrics.md §1-3) and the dispute-rate stop band |
| S5 | Laura | Business metrics (05_metrics.md §4 & §5)|
| S6 | Laura | 06_07_experiments_operations.md |
| S7 | Laura | 06_07_experiments_operations.md |
| S8 | Mathilde | 08_launch_memo.md §1-2 (recommendation, evidence) and the launch decision line |
