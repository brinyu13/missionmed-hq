# 10 Validation and Regression

RESULT: `APPLICABLE_LOCAL_MMC_VALIDATION_PASS_WITH_EXPLICIT_EXTERNAL_GAPS`

## Validation posture

Validation was run against the reconciled local worktree after the scoped private-client repairs and partner-demo recovery. Deterministic MMC contracts, syntax, historical-core parity, shared deployment contracts, real local server startup, route authorization behavior, browser flows, responsive measurements, and basic accessibility structure were checked.

This result is a local engineering-baseline result. It does not claim a production deployment, applied schema, live persistence, real AI analysis, real Webex transfer, credentialed roster proof, or WCAG certification.

## Syntax validation

`node --check` passed for:

- `missionmed-hq/server.mjs`;
- `missionmed-hq/routes/mmc-coaching-pipeline.mjs`;
- the four MMC libraries;
- `missionmed-hq/public/mmc-private/src/app.js`;
- both private MMC adapter/ownership modules.

## Deterministic MMC matrix

| Validator | Result | What it proves |
| --- | --- | --- |
| `mmc-private-mount-validation.mjs` | PASS | Private mount, role/capability authorization, redirect/forbidden behavior, no-index headers, and static asset routing remain intact. |
| `mmc-coaching-pipeline-contract-validation.mjs` | PASS | Route contracts, pipeline boundaries, analysis structure, source provenance, and protection declarations remain present. |
| `mmc-persistence-integration-validation.mjs` | PASS | Disabled-by-default persistence, allowed-project checks, RLS-scoped integration, and same-origin client contract remain intact. |
| `mmc-coaching-import-worker-validation.mjs` | PASS | Dedicated stable media/transcript pairing, incomplete-pair review, and protected-system isolation. |
| `mmc-coaching-import-worker-route-validation.mjs` | PASS | Worker status/scan/import/process route behavior and admin boundary. |
| `mmc-student-resolution-engine-validation.mjs` | PASS | Deterministic evidence/confidence classifications and no silent ambiguous match. |
| `mmc-roster-identity-bridge-validation.mjs` | PASS | Roster bridge integration contract. |
| `mmc-roster-verification-lane-validation.mjs` | PASS | Independent-anchor verification and explicit approval lane. |
| `mmc-webex-trigger-policy-validation.mjs` | PASS | Allowed title triggers, explicit ignore policy, read-only inventory protections, and closed-gate behavior. |
| `mmc-webex-trigger-route-validation.mjs` | PASS | Webex status/inventory/pull route contract and worker handoff boundary. |
| `mmc-partner-demo-validation.mjs` | PASS | Eleven synthetic screens, no external calls, no persistence, and static demonstration boundary. |
| `mmc-selection-continuity-validation.mjs` | PASS | Selected student propagates to Meeting, full Call Prep, session notes, and post-session flow. |
| `mmc-v1-core/tests/mmc-core-validation.mjs` | PASS | Current branch retains the standalone MMC-005A fixture/test oracle. |

## Repository and shared-system checks

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm test` | PASS, 0 tests discovered | The root script exits cleanly but provides no substantive coverage; the explicit MMC validators above are the meaningful tests. |
| `npm run build` | PASS, placeholder only | Confirms the configured script, not a compiled production artifact. |
| `npm run typecheck` | NON-PASS: compiler help/exit 1 | The root script runs `tsc --noEmit`, but this repository has no root `tsconfig.json` or input files. No MMC type error was reported. This is a pre-existing validator-configuration gap, not a corrected pass. |
| `VALIDATION/validate_deploy.sh` | PASS | Arena, STAT, Drills, Daily, auth bootstrap, launch contracts, and forbidden-key/sign-up checks remain intact. |
| Critical Systems gate with network skipped/enforced local checks | PASS with expected skip warnings | Local protected-system contracts pass; it is not a network or browser certification. |
| `git diff --check` before report assembly | PASS | Runtime/test changes had no whitespace errors; final publication must rerun after report/combined generation. |
| Matrix all-assets preflight | Strict warning/exit 42 | This worktree does not contain a fully matching Matrix protected runtime. The result triggers zero-touch treatment, not a claim that MMC repaired or certified Matrix. Final diff must contain no Matrix protected paths. |

## Local runtime and route checks

The real MissionMed HQ server was launched locally with a non-secret synthetic session configuration. Persistence, AI, and Webex were disabled. A local-only inspection proxy supplied a synthetic authorized session and CSRF value for UI inspection; it did not grant external authority or write to production.

| Probe | Result |
| --- | --- |
| Health route | 200 |
| Unauthenticated `/mmc-private/` | 302 to `/api/auth/start` |
| Unauthenticated persistence endpoint | 401 |
| Unauthenticated coaching pipeline status | 401 |
| Authorized synthetic local private UI | Rendered and navigable |
| Partner demo route | 200 |
| Private browser console errors/warnings | 0 / 0 |
| Partner browser console errors/warnings | 0 / 0 |

The private Pipeline Admin displayed the expected local-safe states: persistence disabled, worker path absent, no imported assets, Webex token missing, pull gate closed, zero allowed/ignored remote items, unresolved identity, and an unverified roster lane. No real import, analysis, roster approval, or Webex pull was invoked.

## Browser workflow coverage

Verified by browser interaction and screenshot evidence:

- Today, Actions, Directory, Profile, Meeting Intelligence, Mentor Memory/Call Prep, Session Command, Post-Session Capture, and Student View Preview;
- selected-student propagation from Profile into Meeting, full briefing, Session Command, and Post-Session Capture;
- populated meeting state and a student with no meeting state;
- Pipeline Admin worker, Webex controls, source selection, student resolution, roster verification, review/approval controls, and disabled persistence state;
- all eleven partner-demo screens by click;
- partner-demo keyboard Tab reached a named button with a visible focus outline;
- private, laptop, tablet, and narrow-mobile viewports.

## Responsive measurements

| Surface/viewport | Document width | Content width | Result |
| --- | ---: | ---: | --- |
| Private 1440 x 900 | 1440 client / 1440 scroll | 1194 client / 1194 scroll | PASS: no horizontal overflow |
| Private 1280 x 800 | 1280 / 1280 | 1034 / 1034 | PASS: no horizontal overflow |
| Private 1024 x 768 | 1024 / 1024 | 778 / 778; 240 sidebar | PASS: no horizontal overflow |
| Private 390 x 844 | 390 / 390 | 144 client / 470 scroll; 240 sidebar; 150 topbar | KNOWN DEBT: internal content horizontally overflows by 326 px |
| Partner 390 x 844 | 390 client / 980 scroll | computed body minimum 980 | KNOWN DEBT: 590 px document overflow; desktop/laptop-only layout |

## Basic accessibility observations

These are static/basic audit counts, not WCAG certification.

| Surface | Buttons | Fields | Landmarks/headings | Finding |
| --- | ---: | ---: | --- | --- |
| Private | 47, none unnamed | 28; 23 lack an associated label, ARIA label, or placeholder | 1 navigation, 0 main landmarks | Button names are present, but form labeling and landmark structure are insufficient. Several navigation/filter controls are clickable `div` elements rather than keyboard-native controls. |
| Partner | 25, none unnamed | 19 unlabelled fields | 1 navigation, 1 main, 0 `h1` | Better landmark baseline and visible keyboard focus, but form labeling and heading hierarchy remain incomplete. |

## Explicitly unexecuted or incomplete validation

- Credentialed persistence staging smoke.
- Roster identity and roster verification staging/browser smokes against real staging data.
- A real Webex account inventory or recording download.
- Real OpenAI structured analysis and prompt-version persistence.
- Any production route, database, migration, RLS, Railway, WordPress, Scheduler, Calendar, R2, Stream, File Vault, or Webex mutation.
- Long-transcript stress, very large action/review queues, repeated-meeting volume, offline retry, timeout, and server-500 simulations.
- Full keyboard traversal of the private console, screen-reader audit, contrast measurement, 200% zoom, touch-target audit, or automated WCAG suite.
- Production deployment and production smoke.

These gaps do not invalidate the local canonical engineering baseline. They are mandatory future release gates wherever the corresponding live capability is required.

## Regression conclusion

All applicable deterministic MMC validators and shared local deployment contracts pass after reconciliation. The known non-pass is the repository's inputless root TypeScript command, and the known protected warning is Matrix's expected mismatch in this non-Matrix worktree. Production mutations: **zero**. Deployments: **zero**.
