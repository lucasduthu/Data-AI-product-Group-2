# Governance — our living file

> Created for Assignment 1, one line added every session. One question at the oral is drawn from this file.
> Answers are provisional: write what you know today, and mark what you still have to check.

## Session 1 — the six questions
| # | Question | Our answer (provisional) | To check with |
|---|---|---|---|
| 1 | **EU AI Act:** which risk tier is our agent in, and why? (minimal · limited — transparency: tell the user it is an AI · high-risk · prohibited) | | |
| 2 | **Data:** whose data does it use, and on what legal basis? (GDPR art. 6; what the B2B contract allows) | | |
| 3 | **Accountability:** who is accountable when it is wrong — and where is the human? | | |
| 4 | **Never:** what must it never do? (our first guardrail) | | |
| 5 | **Explainability:** explainable to whom — the customer, the support agent, the auditor? | | |
| 6 | **The people it cannot serve:** what happens to them? | | |

## Session 2 — the cost of error
- Which cost-of-error line is a **legal or reputational** risk, not just money? …
- Who in the company **owns** that risk? …

## Session 3 — data (to come)
## Session 4 — human-in-the-loop points and the override switch (to come)
## Session 5 — counter-metrics and the segments we report
- **Counter-metrics:** rubber-stamping (contracts approved in < 30 s or with 0 edits while the eval-set still shows errors) and the share of contracts pushed back to manual entry. If the primary rises while these rise too, the gain is fake.
- **Segments we report:** contract type, catalogue size, document quality (native / scanned), language, number of right holders per work — pre-registered in `05_metrics.md`, never added after the results.
## Session 6 — protected segments and the harm threshold that stops an experiment
- **Protected segments:** small publishers with scanned contracts and contracts with 4+ right holders (highest risk of a wrong payment). A guardrail breach in one of them switches that segment back to manual entry, whatever the average says.
- **Harm threshold that stops the A/B at once:** one work reaching SACEM with a split ≠ 100.00 %, or 2+ wrong-IPI declarations in a week, or > 20 % of contracts approved in under 30 s (`06_07_experiments_operations.md`, A7).
## Session 7 — accountable owner, rollback authority, incident path
- **Accountable owner:** Ariane (product); on the customer side, the publisher's copyright / legal director signs every declaration.
- **Rollback authority:** Laura or Ariane can press the Override Switch without asking anyone (< 2 min); the customer's copyright manager can press it for their own catalogue.
- **Incident path:** P1 (wrong declaration sent) → switch, correction filed with SACEM within 24 h, root cause in 5 days; P2–P4 in `06_07_experiments_operations.md`, B5.

| Session | Who | What was added |
|---|---|---|
| S1 | Ariane | Initialisation of governance.md |
