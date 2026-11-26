# 08 — Launch Memo · Korom Contract-to-CWR Copilot (`v1.0`)

**To:** Executive Committee (CEO, Head of Copyright & Legal Ops, CTO)  
**From:** Korom AI Product Team  
**Date:** November 2026  
**Subject:** Launch Decision — Korom Contract-to-CWR AI Copilot (`v1.0`)

---

## 1. Executive Recommendation: **CONDITIONAL GO TO PRODUCTION**
We recommend launching **Korom Contract-to-CWR Copilot v1.0** to our initial cohort of independent music publishers, **conditional on keeping the mandatory `L2` Human-in-the-Loop approval checkpoint (`⊘`) active on 100% of uploaded PDF contracts**.

## 2. Supporting Evidence
1. **Validated Problem & Business Case (`01`, `02`):** Independent publishers lose ~30 minutes per contract manually keying works, IPIs, and 4-dimensional splits (`DEP`, `DRM`, `SYNC`, `PHONO`) into legacy tools (*Le Sage* / Excel) with a 15% SACEM CWR rejection rate. Our bottom-up model shows **+€60,804 Year-1 Expected Value** per 100 publishers, beating our next-best deterministic CGP1 project hurdle by **+60%**.
2. **Offline Evaluation Exceeds Flip Point (`04`, `evals/report_v0.md`):** On our 50-case stratified evaluation set (`eval_set_v0.csv`), the copilot achieved **88.0% un-edited extraction accuracy** (exceeding our 60% flip point and 80% target criterion) and reduced median registration time from **30.0 minutes to 2.4 minutes**.
3. **Zero-Error Arithmetic Containment (`cwr_validator.py`):** 100% (12 / 12) of unbalanced splits (`DEP != 100%`, `DRM != 100%`, `Pub DEP > 50%`, missing IPI) were intercepted by the deterministic Rung 1 gate (`0.0%` false-pass rate into `.V21` CWR files).
4. **Dual Export Delivered from User Research (`03`):** Validated contracts export in 1 click to both **CISAC CWR v2.1 (`.V21`)** for SACEM machine registration and **OpenXML Excel (`.xlsx`)** for human/executive visibility.
