# I1Q-1008A Workflow Audit

## Status

`SIMULATED LOCAL AND STATIC EVIDENCE ONLY`

Refreshed on 2026-07-15 against exact candidate commit `fd7ddcd7688a0fc89cc4fc1320806220221046ae`. No authenticated staging session, real identity, real role fixture, assistive technology, production record, raw transcript, student data, or human participant was used.

## Audited Candidate

Candidate state: `IMMUTABLE PRODUCT COMMIT`

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `src/server.mjs` | `f0088ad814e3747bfe1316bc41a7c2f86b70f5ec3aceb51c22417a8d6135d6aa` |
| `src/platform.mjs` | `7cef0f9132822bb918df5f8be02d4a5a9ed4d057389ad79abde7f545638512ba` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |
| `tests/api.test.mjs` | `855905f3566d91abb18d023a1411ba80f01d34194ff6ba2c781f923d6a00ff16` |

## Executive Verdict

The exact candidate closes the prior page-root overflow, duplicate physician-hash, and mobile environment-spacing findings. The full 17 by 11 workflow matrix and 16 by 11 state matrix are locally clean for root overflow, visible clipping, WCAG 2.2 AA target minimums, heading count, duplicate IDs, and broken ARIA references.

Current simulated aggregate: `8.21 / 10`. Minimum category: `6.8 / 10` for task speed. The target of 9.0 aggregate and 8.5 minimum category is not met.

`WORKFLOW RELEASE VERDICT: BLOCK`

The remaining blockers are incomplete governed workflows, non-role-specific navigation, unproven durable scale and recovery, canonical authenticated staging, real synthetic identity and role fixtures, cross-browser execution, assistive-technology execution, and human validation.

## Evidence Executed

- `npm test`: 287 total, 285 passed, 0 failed, 2 expected disposable-database skips.
- `node --test tests/ui.test.mjs`: 19 of 19 passed.
- Local real-browser workflow matrix: 17 workflows by 11 viewports, 187 cells.
- Local real-browser state matrix: 16 states by 11 viewports, 176 cells.
- Mobile context submatrix: 17 workflows by 4 phone viewports, 68 cells.
- Width-equivalent reflow simulation: 34 workflow cells and 32 state cells at 640 and 320 CSS pixels.
- Semantic scan: 17 workflows with zero H1, main landmark, navigation landmark, unnamed visible control, unnamed region, heading-level, focus, or busy-state failures.
- Browser console: zero warnings or errors during the exact-byte run.
- Visual spot checks: 320 by 844 and 1440 by 900 with no incoherent overlap.
- Direct 320-pixel Inventory gestures: page root stayed at `scrollX=0`; the independent table moved to `scrollLeft=300`.

All browser evidence used the local synthetic demo. The width-equivalent checks are `SIMULATED` and are not native browser zoom evidence.

## Matrix Results

| Check | Result |
| --- | ---: |
| Workflow cells | 187 |
| Root-overflow failures | 0 |
| Visible content outside its permitted scroller | 0 |
| Clipped visible controls | 0 |
| Targets below the WCAG 2.2 AA 24-pixel minimum | 0 |
| H1 or workflow-title failures | 0 |
| Duplicate-ID cells | 0 |
| Broken-ARIA-reference cells | 0 |
| Refresh controls below 44 by 44 | 0 |
| Search pagination clipping or target failures | 0 |
| Title-bearing hash fields | 0 |
| Abbreviated exact physician hashes | 0 |
| Independent scrolling table cells | 40 |
| State cells | 176 |
| State rendering, role, focus, busy, clipping, or ARIA failures | 0 |
| Mobile workflow context cells | 68 |
| Missing mobile actor or environment context | 0 |

At both 320 and 768 pixels, Corpus inventory, Extraction runs, Search and filters, and Audit trail measured document and body width exactly equal to viewport width. Their table scrollers retained wider content:

| Workflow | 320 client / scroll | 768 client / scroll |
| --- | ---: | ---: |
| Corpus inventory | 256 / 644 | 444 / 644 |
| Extraction runs | 256 / 764 | 444 / 764 |
| Search and filters | 256 / 597 | 444 / 597 |
| Audit trail | 256 / 628 | 444 / 628 |

## Requested Repair Disposition

| Finding | Exact-commit verdict | Evidence |
| --- | --- | --- |
| Root/page horizontal overflow | `CLOSED LOCALLY` | Zero failures in 187 workflow and 176 state cells. `.table-wrap` is now the containing block at `public/styles.css:516-525`. All eight targeted 320 and 768 checks preserved independent table overflow without root movement. |
| Pagination clipping or shrinking | `CLOSED LOCALLY` | Previous and Next measured 82 by 44 and 56 by 44, respectively, with no clipping in all 11 Search viewports. Rules are at `public/styles.css:672-689`. |
| Mobile actor and environment context | `CLOSED LOCALLY` | Actor and environment context were present in all 68 phone workflow cells. The expanded 17-item menu had zero horizontal clips at 320, 375, 390, and 430. |
| Title-only or abbreviated exact hash | `CLOSED LOCALLY` | Zero `.hash-text[title]` instances. Physician review displayed a complete 64-character SHA-256 at 320 pixels from `public/app.js:1423-1427`. |
| Mobile environment spacing | `CLOSED LOCALLY` | Computed layout was wrapping flex with 4-pixel row gap and 8-pixel column gap at all four phone widths from `public/styles.css:155-161`. |

## Required Workflow Matrix

| # | Required workflow | Current local result | Evidence and remaining gap |
| ---: | --- | --- | --- |
| 1 | Authenticated entry | `PARTIAL, FAIL-CLOSED CONTRACT` | Static access, readiness, session, and distinct auth failures exist in `src/server.mjs:285-372` and `public/app.js:521-560`. Canonical staging entry was not exercised. |
| 2 | Role-specific dashboard | `PARTIAL` | Dashboard renders at `public/app.js:626-681`, but every actor receives the same navigation at `public/index.html:28-45`. |
| 3 | Candidate queue | `LOCAL PASS, EMPTY FIXTURE` | Candidate triage renders at `public/app.js:998-1047`. The demo fixture has zero candidates. |
| 4 | Candidate details and disposition | `PARTIAL, READ ONLY` | Detail selection exists, while assignment, quarantine, and rejection remain disabled at `public/app.js:1006-1028`. |
| 5 | Source status without raw source | `LOCAL PASS` | Identity, lineage, rights, privacy, and restricted-source boundaries render at `public/app.js:729-792`. |
| 6 | Privacy status and decision | `PARTIAL, READ ONLY` | Class results render at `public/app.js:794-846`; the decision command remains disabled. |
| 7 | Rights status and resolution | `PARTIAL, READ ONLY` | Rights status is visible in Source detail, but no governed resolution workflow exists. |
| 8 | Question authoring | `LOCAL PASS` | Correct-option clearing and exact `If-Match` save are implemented at `public/app.js:343-356`, `1049-1105`, and `1910`. A real-browser check at 390 pixels selected A and confirmed all three A-only distractor fields were empty, disabled, and not required while B, C, and D remained enabled and required. |
| 9 | Distractor editing and verdict | `PARTIAL, READ ONLY` | Review rows render at `public/app.js:1108-1151`; verdict recording is disabled at `public/app.js:1146`. |
| 10 | Evidence claim review | `PARTIAL, READ ONLY` | Claim wording, authority, expiry, and status render at `public/app.js:1153-1194`; no governed claim-review mutation exists. |
| 11 | Editorial assignment | `PARTIAL` | Seeded exact assignments can be accepted and reviewed at `public/app.js:1250-1344`; creation, reassignment, decline, and queue work remain absent. |
| 12 | Physician assignment | `CORRECTLY BLOCKED, INCOMPLETE` | Role, credential, governance, evidence, and exact-hash gates render at `public/app.js:1346-1450`. No real credentialed identity journey was run. |
| 13 | Review event creation | `PARTIAL` | Editorial and medical decisions exist, but there is no final immutable-decision confirmation step. |
| 14 | Revision comparison | `LOCAL PASS` | One item and an exact same-item pair are enforced at `public/app.js:1452-1553`; protected differences remain omitted. |
| 15 | Release assembly | `LOCAL PASS, GATED` | Deliberate exact revision selection is at `public/app.js:1598-1665`; submission rechecks the selection at `public/app.js:2069-2078`. |
| 16 | Validation results | `MISSING CLIENT WORKFLOW` | The server accepts validation, but the client lacks validation list, detail, artifact hash, validator, and inspection tasks. |
| 17 | Incident creation | `MISSING` | Incident records are read only and creation remains disabled at `public/app.js:1667-1681`. |
| 18 | Audit trail | `LOCAL PASS` | Filters, sequence links, actor, object, and integrity disclaimer render at `public/app.js:1683-1740`. Persistence and scale were not exercised in a browser. |
| 19 | Logout | `LOCAL CONTRACT PASS` | Server composition is at `src/server.mjs:382-392`; client clearing and signed-out focus are at `public/app.js:574-624` and `2204-2218`. Canonical revocation and browser Back remain open. |
| 20 | Unauthorized, expired, revoked, and outage states | `LOCAL CONTRACT PASS, STAGING OPEN` | Distinct focused states are at `public/app.js:521-560`; natural staging conditions were not run. |

## State And Role Coverage

All 17 current screens rendered at all 11 viewports. All deterministic states rendered at all 11 viewports: `loading`, `empty`, `blocked`, `unauthorized`, `error`, `partial-source`, `privacy-blocked`, `rights-blocked`, `expired-evidence`, `review-conflict`, `stale-edit`, `concurrent-edit`, `extraction-queued`, `extraction-running`, `extraction-failed`, and `extraction-resumable`.

Every state cell ended with `aria-busy="false"`, used an alert or status role, focused its labelled H2, and exposed at least one recovery action. This proves deterministic local rendering only.

| Persona | Local strength | Remaining gap |
| --- | --- | --- |
| Physician reviewer | Explicit credential, assignment, evidence, conflict, governance, and full exact-hash gates | No canonical credentialed identity or real assignment queue |
| Medical educator | Correct-option safety and stale-write prevention | No protected compare-and-reapply recovery |
| Editorial reviewer | Purpose-scoped content and exact assignment gates | No role dashboard, reassignment, decline, or immutable confirmation |
| Assessment scientist | Clear distractor and evidence criteria | No distractor verdict or validation-results workflow |
| Privacy officer | Complete privacy-class and source-boundary presentation | No privacy or rights decision workflow |
| Release manager | Deliberate exact revision selection and visible gates | No validation-results journey or staging release evidence |
| Novice operator | Stable labels, focus, and recovery copy | Seventeen destinations remain visible without role guidance |
| Power operator | Cursor draining removes silent 200-row truncation | No server-side search, saved views, deep links, cancellation, or bulk work |
| Assistive-technology user | Strong native semantics and deterministic focus | No real AT, magnification, voice, switch, or full keyboard task validation |
| Incident responder | Read-only incident and audit context | No incident creation or containment action |

Client role labels are descriptive only and must never be treated as authority.

## Source, Evidence, And Scale

Source lineage remains exact and raw source stays absent from the generic shell. Transcript availability is explicit. Claims expose authority, expiry, and status. Full exact hashes wrap at 320 pixels without title reliance.

Resource reads drain cursor pages with snapshot, duplicate, loop, completeness, and 50,000-row fail-closed checks at `public/app.js:382-424`. A 250-row regression passes at `tests/ui.test.mjs:470-508`. This closes silent 200-row truncation. It does not prove usable performance at 1,000, 10,000, or 50,000 rows because the client still aggregates all returned rows in memory and lacks server-side query, request cancellation, safe deep links, and durable return-to-queue state.

## Workflow Verdict

`BLOCK FOR AUTHENTICATED STAGING AND HUMAN CERTIFICATION`

The candidate is locally coherent and the requested responsive repairs are closed. Product workflow completeness and external validation still prevent release certification.
