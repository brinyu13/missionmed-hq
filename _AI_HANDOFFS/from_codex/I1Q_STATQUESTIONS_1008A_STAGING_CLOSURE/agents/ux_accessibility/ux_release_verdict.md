# I1Q-1008A UX And Accessibility Release Verdict

## Verdict

`BLOCK`

`EVIDENCE CLASS: SIMULATED LOCAL AND STATIC ONLY`

The exact candidate passes the complete assigned local responsive, state, and semantic matrices. It is suitable for continued engineering and synthetic internal review. It is not cleared by this lane for authenticated staging certification, internal production, a responsive certification claim, or a WCAG 2.2 AA claim.

## Exact Candidate

Commit: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `src/server.mjs` | `f0088ad814e3747bfe1316bc41a7c2f86b70f5ec3aceb51c22417a8d6135d6aa` |
| `src/platform.mjs` | `7cef0f9132822bb918df5f8be02d4a5a9ed4d057389ad79abde7f545638512ba` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |
| `tests/api.test.mjs` | `855905f3566d91abb18d023a1411ba80f01d34194ff6ba2c781f923d6a00ff16` |

## Score Verdict

All scores are `SIMULATED`.

| Measure | Immediate predecessor `483b0f7` | Exact candidate `fd7ddcd` | Target | Result |
| --- | ---: | ---: | ---: | --- |
| Aggregate | 8.04 | 8.21 | At least 9.0 | Fail |
| Minimum category | 6.8 task speed | 6.8 task speed | At least 8.5 | Fail |

The 0.17-point increase reflects observed table containment, full physician attestation identity, and mobile environment-spacing repairs. It does not credit external evidence.

## Exact Local Evidence

- `npm test`: 287 total, 285 passed, 0 failed, 2 expected database skips.
- Focused UI suite: 19 of 19 passed.
- Workflow matrix: 17 workflows by 11 viewports, 187 cells.
- State matrix: 16 states by 11 viewports, 176 cells.
- Mobile context matrix: 17 workflows by 4 phone viewports, 68 cells.
- Width-equivalent reflow simulation: 34 workflow and 32 state cells.
- Root horizontal overflow: 0 cells.
- Non-table outside content and clipped visible controls: 0 cells.
- State rendering, role, focus, busy, root, clipping, and ARIA failures: 0 cells.
- Semantic scan: zero H1, main, navigation, naming, region, heading, focus, or busy failures.
- Refresh geometry: 44 by 44 in all 187 workflow cells.
- Pagination: zero clipping or shrink failures in all 11 Search viewports.
- Mobile actor and environment context: zero missing cells.
- Title-only or abbreviated exact hash presentation: zero failures.
- Browser console: zero warnings or errors.

All browser evidence used the local synthetic demo. The 640 and 320 CSS-pixel reflow checks are width-equivalent simulations, not native browser zoom.

## Requested Repair Verdicts

| Finding | Exact-commit verdict | Basis |
| --- | --- | --- |
| Root overflow | `CLOSED LOCALLY` | Zero failures across 187 workflow and 176 state cells. All eight 320 and 768 table-route checks kept root width equal to viewport and retained wider independent table scrollers. |
| Pagination clipping | `CLOSED LOCALLY` | Previous and Next remained fully visible and 44 pixels high in all 11 Search viewports. |
| Mobile context | `CLOSED LOCALLY` | Actor and environment context were present in all 68 phone workflow cells; expanded menu had zero horizontal clips. |
| Title-only hash disclosure | `CLOSED LOCALLY` | No `.hash-text[title]`; exact hashes wrap visibly. |
| Physician attestation hash | `CLOSED LOCALLY` | Full 64-character SHA-256 rendered at 320 pixels. |
| Mobile environment spacing | `CLOSED LOCALLY` | Computed wrapping gap was 4 pixels vertically and 8 pixels horizontally at every phone width. |

## Safety-Positive Findings

- Static access and readiness fail closed.
- Student and consumer release controls remain visibly off.
- Protected answer and rationale content remains purpose scoped.
- Draft, comparison, and release operations bind exact immutable identity.
- Correct-option distractor-only controls clear, disable, and stop being required.
- Expired, revoked, outage, generic unauthorized, and signed-out states are distinct and focused.
- Cursor reads fail closed on overlap, snapshot drift, cursor loops, incompleteness, and more than 50000 rows.
- Source detail exposes lineage, rights, privacy, and availability without raw source.
- Audit UI distinguishes sequence-link continuity from cryptographic release proof.
- Wide tables now stay inside named independent scrollers without moving the page root.

## Blocking Findings

### 1. The governed workflow contract is incomplete

Candidate disposition, privacy decision, rights resolution, distractor verdict, assignment creation and reassignment, validation-result inspection, and incident creation remain missing or read only.

### 2. Role-specific UX is incomplete

All actors receive the same 17 navigation destinations. Client role labels are descriptive and do not establish authority.

### 3. Scale and durable recovery remain unproven

Cursor draining removes silent truncation but can aggregate up to 50000 rows in browser memory. Server-side search, request cancellation, deep links, saved views, return-to-queue state, protected compare-and-reapply, and immutable-decision confirmation remain open.

### 4. Canonical authenticated staging has not run

No canonical entry, real synthetic role fixture, expiry, revocation, reauthentication, logout invalidation, browser Back, persistent adapter, RLS denial, or staging write journey was executed by this lane.

### 5. External accessibility and human evidence is absent

No VoiceOver, NVDA, JAWS, full real keyboard task matrix, magnification, switch, voice, native 200 or 400 percent zoom, text-spacing, forced-colors, cross-browser, real-device, or human participant run exists.

### 6. Score thresholds are not met

The SIMULATED aggregate is 8.21, below 9.0. Task speed is 6.8, below the 8.5 category floor. A clean responsive matrix cannot offset missing workflows and scale evidence.

## Clearance Conditions

1. Complete all twenty workflows against one exact authenticated staging build.
2. Run positive and adversarial real synthetic role fixtures.
3. Prove bounded 1000, 10000, and 50000-row task performance and recovery.
4. Complete supported-browser, native zoom, text-spacing, forced-colors, keyboard, and assistive-technology testing.
5. Pass `human_validation_protocol.md` with zero critical or high finding.
6. Reach an independent 9.0 aggregate with no category below 8.5.
7. Keep student and consumer flags false throughout validation.

## Final Statement

`LOCAL RESPONSIVE REPAIR RETEST: PASS`

`UX AND ACCESSIBILITY RELEASE: BLOCKED`

Commit `fd7ddcd7688a0fc89cc4fc1320806220221046ae` closes all requested local responsive and exact-identity findings. Product-completeness and external-certification gates still prevent a production claim.
