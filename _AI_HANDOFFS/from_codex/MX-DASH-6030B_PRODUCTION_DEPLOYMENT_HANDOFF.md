# MX-DASH-6030B production deployment handoff

Date: 2026-09-08
Verdict: **COMPLETE — LIVE**

## Authority and source

- Mission: `MX-DASH-6030B-PROD`
- Decision records: `DR-206`, `DR-207`
- MissionMed OS registration commit: `07ccb5acae065002673a6dc89948c2a99ef57141`
- Approved source branch: `codex/mx-dash-6030b-option-c`
- Approved source commit: `2a56d7b80ddaf21bd46b1e4b217995bb1c5eebe9`
- Founder runtime-drift approval was applied only as authority to preserve the six named live runtime assets. No such asset was changed.

## Exact production deployment

| File | Before SHA-256 | After/live SHA-256 |
| --- | --- | --- |
| `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js` | `8f216228f56d44a46c64ff10aacdbfa9cb38420afaf96ee20ea7a1546a14e6ac` | `56dee16717478f9351cb038e6a0976c3f4fad71e522b092b552cff6754a66235` |
| `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css` | `4f78078ebd65d2966322ce283ee6a78e8693b450e3d136c56f2c0670034b57ed` | `be5ade93749eb3fcd6d62cfcb3fa9c05278b07ef52fd53b84049a5faea68612d` |

Rollback is verified at `/www/theresidencyacademy_209/private/mx-dash-6030b-prod-rollback-20260908T085545Z`; its two `preimage-*` files reproduce the exact before hashes. Directory mode is `0700`; preimages are `0600`.

## Cache and production proof

- Autoptimize, WordPress/Kinsta site cache, Kinsta CDN, and object cache were purged.
- MyKinsta provider-native CDN purge completed. Both immutable asset URLs then returned the approved bytes; subsequent CDN hits retained the approved hashes.
- An authenticated production Matrix dashboard visibly rendered Option C. The former default enterprise/spec-sheet panel is absent. HomeBase, Calendar, Scheduler, StoryForge, IV Prep On-Call, RISE, RankList IQ, and LOR Studio were checked in one compact pass.
- Live HomeBase showed the exact Founder-approved cinematic asset, full-bleed art, large title, one promise, three chips, payoff, CTA, quiet `How it works`, and quiet admin pencil.
- Exact `390x844` live unlocked composition passed with no horizontal overflow. Approved predeployment mixed-access QA remains valid for locked `390x844` and locked drawer rendering; the Founder also visually accepted the student side before this release.

## Verification and regressions

- Unlocked state: PASS (`Included`, launch CTA).
- Locked state/security: PASS. Fresh resolver for restricted user `43` returned RankList IQ visible but not allowed; direct route returned `403` plus `X-MissionMed-Matrix-Access: entitlement-denied`; REST returned `403` plus `mmed_matrix_entitlement_required`.
- Admin edit: PASS. The quiet pencil opened the editor; it was closed without saving.
- Progressive disclosure: PASS (`aria-expanded=true`, drawer `aria-hidden=false`, no horizontal overflow).
- 6010B morph: PASS. Pencil/cinematic endpoints remained present, morph progress reached `1.0000`, and focus returned to the invoking card.
- 6021 aspect ratio: PASS. Live image computed `object-fit: cover`; static regression ran 2 tests and passed.
- Classic/reduced motion: PASS. Classic control remains present and untouched; approved reduced-motion QA was reused because neither deployed file changed after that exact commit.
- JavaScript syntax and `git diff --check`: PASS.
- Existing cinematic artwork: unchanged.
- Runtime lock: UNCHANGED. The two deployed Option C assets are not runtime-lock keys; the six Founder-approved drift keys were preserved byte-for-byte.

## Evidence

- `MX-DASH-6030B_PROD_EVIDENCE/desktop-admin-homebase-option-c.png` — authenticated live production desktop.
- `MX-DASH-6030B_PROD_EVIDENCE/mobile-unlocked-homebase-390x844.png` — authenticated live production at exact viewport.
- `MX-DASH-6030B_PROD_EVIDENCE/candidate-mobile-locked-contact-sheet.png` — approved exact-commit mixed-access QA reused as authorized.
- `MX-DASH-6030B_PROD_EVIDENCE/candidate-mobile-locked-drawer.png` — approved exact-commit locked drawer QA reused as authorized.
- `MX-DASH-6030B_PROD_EVIDENCE/production-verification.json` — production checks and hashes.

## Governance closeout

- Lease scope: `SHARED:MATRIX-SHELL`, bound to the two deployed files and this handoff/evidence only.
- Runtime lock: unchanged.
- Task-owned leases/waiters: provider-native final readback `0 / 0`.
- No temporary credentials or session values were written to files. Temporary deployment processes and registry clone were removed.

**OPTION C IS LIVE IN PRODUCTION — THE OLD ENTERPRISE APP-DETAIL POPUP IS GONE.**
