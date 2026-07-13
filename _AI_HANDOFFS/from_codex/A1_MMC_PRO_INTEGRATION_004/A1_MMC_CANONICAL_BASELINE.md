# A1 MMC Canonical Baseline

RESULT: MACBOOK_PRO_CANONICAL_MMC_CODE_BASELINE_READY

## Baseline construction

- Starting integration tip: e8503866bce9cb941dd8f2dc38f39e62bd21e316.
- Pro main comparison tip: 9c1fa72e6b056db8b6fe0e17031fcaa688f78569.
- Current validated code tip: bbdcd96d859b3eae2a04390d3500633b3961fff0.
- The branch retains all five unique Pro guardrail/USCE commits from e850386.
- Instead of broadly merging thirteen unrelated main-side commits and creating protected USCE/server conflicts, the clean MMC-only chain was cherry-picked: 49bb583 -> 7b55f04 -> 1be8a3d.
- The verified Air UI patch, 30 complete Air files, and five reviewed server hunks were then integrated in three provenance-scoped commits.

## Why this is authoritative

This is the only branch that simultaneously preserves the Pro's current protected runtime history, the clean Pro MMC private-route ancestry, the shared Pro/Air MMC-019 foundation, the Air-only evolved UI, the coaching/identity/roster/Webex modules, schema evidence, validators, and final migration reports. No old branch, whole server, whole repository, unrelated main history, cache, or secret-bearing artifact was merged.

Authority is limited to the engineering baseline. Persistence remains disabled by default, schema work remains unapplied, production is unchanged, and live /mmc-private/ currently returns 404. Production architecture/deployment requires a later explicit task.
