# 00 — Bring-Your-Own Pitch: Korom Contract-to-CWR Copilot

**The company:** **Korom**, a B2B SaaS platform serving independent music publishers in France and Europe (~800 indie publishers in France across CSDEM/CEMF/ULM; typical mid-size publisher manages 1,500–10,000 works, signs 40–120 multi-work publishing/co-publishing contracts per year, and operates with a 2-to-4-person Copyright & Legal team).

**The pain, as a cost:** Reading a 15-to-25-page French or English music publishing contract PDF (cession d'édition, co-édition, audiovisual commission, or Lettre-Accord Artiste-Interprète), manually keying every work title, right holder, role (`A`, `C`, `AC`, `E`), 11-digit IPI number, and 4-dimensional split (`DEP`, `DRM`, `SYNC`, `PHONO`) into legacy software (*Le Sage* / Excel), and formatting a CISAC CWR v2.1 file takes **25 to 35 minutes per contract** (~300 hours/year across an active roster). Furthermore, **12% to 18% of manual CWR submissions are rejected by SACEM (`NACK`)** due to rounding discrepancies (`33.33% × 3 = 99.99% != 100.00%`), exceeded statutory publisher caps (`> 50% DEP`), or missing IPI numbers—delaying royalty collection by 6 to 12 months.

**Do-nothing baseline:** If nothing is built over the next 12 months, catalog signing volumes grow by **+7% to +9.5%/year** (source: CSDEM / SACEM annual report) while audiovisual cue-sheet contracts increasingly bundle 15 to 40 works per PDF. Copyright managers slightly improve their Excel templates (~5% speed gain), but SACEM CWR rejection rates remain around 15% and backlogs accumulate before each quarterly SACEM distribution cutoff (Jan 15, Apr 15, Jul 15, Oct 15).

**The agent's job:** When a copyright manager uploads a signed music publishing contract PDF, the copilot extracts all works, right holders, IPI numbers, and royalty splits (`DEP`, `DRM`, `SYNC`, `PHONO`) with verbatim clause citations, checks 100.00% CISAC/SACEM compliance via a deterministic policy gate, and—upon human validation (`⊘`)—creates the works in the catalog and exports a SACEM-ready **CWR v2.1 (`.V21`)** file and a structured **Excel (`.xlsx`)** visibility sheet.

**Trust level per step:**
- **Step 1 (PDF text extraction & contract type routing):** `L4` (Autonomous pre-processing)
- **Step 2 (LLM structured extraction + verbatim clause citation):** `L2` (Drafts structured record in `PENDING_REVIEW`; human reviews every contract)
- **Step 3 (Deterministic CWR 2.1 arithmetic & statutory policy checker):** `L4` (Hard gate blocking any non-100.00% split or missing IPI from CWR export)
- **Step 4 (Catalog registration & CWR `.V21` / Excel `.xlsx` export):** `L2` / `Person only` (Explicit human approval required)

**One thing it must never do:** It must **never** invent or silently adjust a royalty split percentage to make a sum equal `100.00%`, nor ever export a work in a SACEM CWR `.V21` file if the deterministic policy checker flags a blocking error.

**Why it is a product decision:** The VP of Product & Legal Ops must decide whether to ship an LLM-backed contract extraction workflow into a zero-error-tolerance legal/copyright registration pipeline, where a hallucinated split or wrong IPI number creates a binding statutory dispute with songwriters or an official SACEM CWR rejection.

## Checklist
- [x] A named company type, a contract/work volume and a team size
- [x] A pain expressed as a cost (minutes per contract, SACEM rejection rate, delayed collection)
- [x] A do-nothing baseline (non-zero volume growth and template learning curve)
- [x] One job in one sentence ("When [trigger], the agent [does], producing [outcome]")
- [x] A trust level per step, at least one below L4 (`L2` mandatory human review before catalog creation & CWR export)
- [x] One thing it must never do (never invent splits or bypass the CWR 100.00% deterministic gate)
- [x] A real decision: someone must decide whether to ship it
