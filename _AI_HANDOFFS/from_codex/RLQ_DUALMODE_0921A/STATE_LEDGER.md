# RLQ-DUALMODE-0921A state ledger

- Updated UTC: `2026-09-21T15:40:00Z`
- Outcome: `PRODUCTION_PROMOTED_AND_ACCEPTED; TEMPORARY CANARY WITHDRAWN; INDEPENDENT VERIFICATION APPROVE_WITH_CONDITIONS`
- Mission: `RLQ-DUALMODE-0921A`
- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Worktree: `/Users/brianb/MissionMed_worktrees/RankListIQ-RLQ-DUALMODE-0921A`
- Branch: `codex/rlq-dualmode-0921a`
- Pull request: `https://github.com/brinyu13/missionmed-hq/pull/34`
- Base: `origin/main@0feee579b0a9f2c90529220899f6cf6d21b8cd05`
- Final implementation head before this ledger: `3147ca27`
- Scoring-control repair source commit: `d4553ab1405628551ae6e0dc3b6fdec79efbb9fa`
- Original stale worktree preserved: `/Users/brianb/MissionMed_worktrees/RankListIQ`, branch `fable/ranklistiq-resurrection`, head `4d1a8f5`
- Fresh independent verifier: read-only `APPROVE WITH CONDITIONS`; all requested hashes/tests/withdrawal checks passed, with one non-functional build-label caveat and no duplicate authenticated browser write

## Authority and coordination

- Canonical mission registration commit: `b90b76a6222d839d603cf77c23b39aa0b4ac54fc`
- Brief SHA-256: `1b628fc1af586494236345a157a916d1a10b0791a22ef080f74908b266fa402e`
- Decision records: `DR-329`, `DR-330`
- Production Save Progress and reload acceptance: explicitly authorized by the Founder for only the authenticated Founder RankListIQ workspace
- Production promotion: authorized only after a protected acceptance path preserved the existing entitlement boundary; that gate passed before promotion
- Source-path lease owner: `codex-rlq-0921a`
- Final handoff-path lease: fencing epoch `3607`, lease id `4e36e6c4-120e-4607-aa5f-a1c46c22f075`

## Pre-deployment custody and unchanged boundaries

- Production route: `https://missionmedinstitute.com/rank-list-engine/`
- WordPress post: `4216`, slug `rank-list-engine`, status `publish`
- Embed path: `/www/theresidencyacademy_209/public/wp-content/uploads/2026/03/rank_list_engine_WORKING.html`
- Pre-deployment live artifact SHA-256: `f00a07d1943d53f471a0597c4d1f54b7c696cc0aa73074e4efa8c245b13011d9`
- Exact pre-deployment rollback: `/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z/rank_list_engine_WORKING.pre-production-promotion-20260921T152314Z.html`
- Pre-deployment rollback mode: `0600`
- `post_content` SHA-256 before and after: `80c80ef3940721997b7015e0d3b32dbb92a703fcfb367007e9544c1ad8f8a280`
- Elementor data SHA-256 before and after: `cdaa08c4502467dde515889fc20fe5826788a9d38addba85d09fc0caed4070cc`
- Template metadata SHA-256 before and after: `00a40f6db844500dd573014f85eb29b2e9766245947c1c5e3673c0929ce865cd`
- BFF SHA-256 before and after: `c76fff0117ceac00e587fcdb0b8f77019b5bbfb782923738e087aeb9c089a14f`
- Entitlement guard SHA-256 before and after: `67b264386046379f25d556fbe314f9c921d8449099fea94ba6b27842ee7d3be7`
- Supabase schema, RLS, Edge Functions, BFF, guard, entitlements, RISE, and Matrix mutations: `NONE`

## Final build custody

- Build id: `20260921T152727Z-gd4553ab1`
- Source commit: `d4553ab1405628551ae6e0dc3b6fdec79efbb9fa`
- HTML: `ranklistiq/dist/rank_list_engine.20260921T152727Z-gd4553ab1.html`
- HTML SHA-256: `c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`
- Protected runtime: `ranklistiq/dist/rank_list_engine.20260921T152727Z-gd4553ab1.runtime.php`
- Protected runtime SHA-256: `946efe66183e1cab82702e02ec24f54494503ebfbe177fdf98886957f0df133e`
- Git-safe base SHA-256: `1766f21de2bfbffe2d5e70e999757fad6be38dd572ff5081a21550b6224756ec`
- Signal rules/config SHA-256: `1e7005447672cbd60728dd45e796e89bc6267bf903b19665da44d05087593ea9`
- Automated tests: `26/26 PASS`
- Executable inline-script parse check: `17/17 PASS`
- Known plaintext credential regression check: `PASS`

## Protected acceptance path

- Protected QA route: `/qa-0921a/`, temporary WordPress post `9174`
- Anonymous `/qa-0921a/`: `404`
- Anonymous protected runtime wrapper: `404`
- Authenticated Founder `/qa-0921a/`: `200`, exact candidate bytes and final build source marker observed
- The protected runtime wrapper failed closed outside WordPress and was served only after the existing WordPress entitlement boundary
- The original failed child canary `/rank-list-engine/next/` remained `404` throughout and was never recreated as an anonymous surface

## RISE acceptance

- Adapter transport: authenticated `GET` only
- Live programs returned: `5`
- Source order: `[1,2,3,4,5]`
- First-20 behavior: all five available programs selected
- Import result: five programs with preserved RISE order
- RISE writes: `NONE`

## Authorized Save Progress acceptance

- Pre-save cloud version: `12b192bf-d496-4f30-a064-2cc14e2b677f`
- Pre-save `saved_at`: `2026-02-18T12:45:06.963712-05:00`
- Rank-slot SHA-256 before and after: `9688d47e6e7ffbb10f474290a148e5e2a6c6442300170c7ef44a1ee2fe740bcd`
- Rank programs before and after: `7`
- Final accepted version id: `2a0d567a-ec97-4acb-b895-62dafb3dc38c`
- Final `saved_at`: `2026-09-21T11:12:09-04:00`
- Intermediate version id created by the normal retry/autosave sequence: `56bd76ff-2b56-4568-b00f-55dde473c81e`
- Request audit: three `POST /wp-json/rlq/v1/save` responses were `200`; the version count increased by two because one request deduplicated/idempotently resolved
- Request-scope audit: no program-interview write and no unrelated RankListIQ POST occurred
- Reload result: exact Application workspace round-trip, five programs, RISE `[1,2,3,4,5]`, two decisions, one Gold and one Silver signal
- Stable Application-domain SHA-256: `13faf819b0a34d9d0c8788d2f5d30d2a313527b8b8285f9b6bad15d374f8c357`
- Final post-QA reload returned the accepted version id above and restored the probe score to `0`; the scoring probe created no later cloud version
- Other-user data touched: `NONE`

## Production deployment and genuine live acceptance

- Live iframe SHA-256: `c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`
- Live file mode/owner: `0644`, `theresidencyacademy:www-data`
- Production route: `200`
- Application mode: final build source marker present; five imported programs, five RISE tags, two decisions, one Gold and one Silver signal restored from cloud
- Signal budgets: Internal Medicine `Gold 1/3`, `Silver 0/12`; Anesthesiology `Gold 0/5`, `Silver 1/10`
- Limit probe: fourth Internal Medicine Gold after three assigned failed closed with `LIMIT_REACHED`, used `3`, limit `3`
- Genuine scoring interaction: first score `0 -> 4`, weighted total `0 -> 12.0`
- A production-only re-render defect discovered by that interaction removed Application controls; source commit `d4553ab1` added a MutationObserver repair
- Protected retest and final live retest: all five RISE tags and Decision/Signal controls survived the scoring re-render; no duplicates or repair-triggered autosave
- Rank mode preservation: seven original programs restored, no Application state or controls shown, Oracle and supplemental surfaces retained
- Desktop: no horizontal overflow; Save, RISE import, mode switch, and all five cards visible
- Mobile `390x844`: document/frame width `390`, no horizontal overflow; Save, RISE import, mode chip, all five cards and all five control sets visible

## Canary withdrawal and rollback

- Post `9174`: `draft`
- All temporary public QA files: absent
- Anonymous URLs returning `404`: `/qa-0921a/`, `/rank-list-engine/next/`, protected runtime wrapper, `/rlq-preview-0921a.php`, `/rlq-dualmode-0921a-canary.php`
- Recoverable quarantine: `/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z/final-withdrawal-20260921T153515Z`
- Quarantined files: four, each mode `0600`, hashes independently reverified
- First promoted candidate rollback: `/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z/rank_list_engine_WORKING.pre-scoring-fix-20260921T152849Z.html`, SHA-256 `66fbaa3d86dcbcf8a1f2615c82ca0d5ca2f412756d78d82c3cb5a2d9cf39f701`

## Security scope

The Git-safe candidate and promoted live artifact remove the known plaintext
developer-unlock values and fail closed when no unlock credential exists. No
credential was copied into Git or this ledger. Credential rotation or auditing
outside this exact frontend artifact remains a separate security-remediation
mission and was not performed.

## Independent verifier conclusion

The fresh verifier independently confirmed the clean implementation lineage,
26/26 tests, 17/17 executable inline scripts, local and live artifact hashes,
fail-closed credential checks, the scoring-control repair behavior, unchanged
WordPress/BFF/guard hashes, draft post 9174, private canary custody, production
route `200`, and all five anonymous QA/canary URLs `404`.

The read-only verifier did not repeat the authenticated Founder browser write or
claim learner-persona acceptance; those are covered by the root production
acceptance evidence above. One non-functional provenance caveat remains: the
generated file embeds the correct build metadata at the top, but a legacy base
assignment later shadows the runtime `window.__RANKLISTIQ_BUILD__` global.
Artifact hashes and the source marker remain authoritative; no product behavior
or saved workspace data is affected.
