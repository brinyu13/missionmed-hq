# F2-LOR-1012 Founder-approved UI reconciliation 021 — production release receipt

Sealed: `2026-08-31T23:26:12Z`

## Result

`RESULT: COMPLETE — FOUNDER-APPROVED LOR STUDIO LIVE`

The Founder-approved LOR Studio product experience has replaced the stripped engineering projection in the live MissionMed HQ runtime. The production backend, authorization, PostgreSQL/RLS, AI, Postmark invitation/OTP, private storage, final-document release/export, and Matrix return contracts were preserved. Ticket 021 changed only the product presentation adapter, its stylesheet, and its focused regression contract.

Live authenticated route:

`https://missionmed-hq-production.up.railway.app/lor-studio/`

Anonymous access correctly redirects to the MissionMed authentication entrypoint.

## Founder-approved fidelity anchor

- Preserved Founder-review artifact: `/Users/brianb/Dropbox (Personal)/SCREENSHOTS/F2-LOR-1012_LOR_STUDIO_STANDALONE_REVIEW_2026-08-24.html`
- Anchor SHA-256: `c249373619a45c31a1b895363fb1d3806d966c8fc413e0acdc4df0870c5a51b7`
- Reconciliation law: restore the approved information architecture and design language while rendering only canonical production state and preserving all server-owned role/privacy boundaries.

## Exact source custody

- Branch: `codex/f2-lor-1012-founder-approved-ui-reconciliation-021`
- Source commit: `a66510115cd322723b47446b9f1ce29c0c046a0f`
- Commit subject: `Restore Founder-approved LOR Studio experience`
- Remote state at source-release boundary: exact
- Base commit: `f742720a91806cb35c1c801a96d44a9463a7588d`

Exact changed source paths and hashes:

| Path | SHA-256 |
|---|---|
| `missionmed-hq/public/lor-studio/production-projection-ui.js` | `e8a2d1a5b700194b1e91169489fc3a031d749766d2bf295dd7c5fa1622a03758` |
| `missionmed-hq/public/lor-studio/production-adapter.css` | `e5c550ef9e7fa7f14b24217c43396a46678be06c46278dd58203535c91054061` |
| `missionmed-hq/tests/lor-studio/production-projection-ui.test.mjs` | `75a82de6ee14ed717ec760989b0eefe96cde32e06bc32ddf6819a395043191b4` |

No backend, migration, authorization, invitation, AI, storage, release, Matrix, or IV Prep source file changed in ticket 021.

## Restored production experience

The live application now contains:

- Founder-approved LOR Studio home and global navigation;
- Build My LOR with the eight evidence-first steps and durable live case state;
- 50 clearly labeled synthetic teaching examples with search, filters, favorites, complete-sample view, comparison, and structure handoff;
- Writer Depot with the live writer-specific handoff preview and recipient/private-workspace boundaries;
- My Letters with the authorized recommendation plan, journey, final release state, and permitted download;
- Intelligence with explainable readiness, grounded evidence, provenance, gaps, and no invented score;
- Settings with workspace continuity, reversible consent/waiver controls, Matrix return, and explicit role boundaries;
- the production mentor projection and faculty-private workspace renderers used by the existing canonical role projections.

The educational examples are deliberately labeled `Synthetic example`; they do not masquerade as live student data and do not copy example facts into a production case.

## Validation

Focused and affected-source validation:

- `106/106 PASS` — combined frontend adapter and production projection suites;
- `71/71 PASS` — focused production projection suite;
- `npm run lint` — PASS;
- `npm run typecheck` — PASS;
- `npm run lor:check` — PASS;
- `git diff --check` — PASS;
- independent review — `APPROVE`, P0 `0`, P1 `0`.

The test contract covers role-specific student, mentor, and faculty renderers; production-only canonical state; 50-example filtering/search/favorites/open/compare/structure use; privacy/provenance language; no browser persistence/network side effects in the renderer; and rejection of placeholder/stub/fake-live presentation.

## Production release identity

Final rollout:

- Railway deployment ID: `2f0ec2e6-a274-4a9c-9f10-1f1e0730cbc8`
- Deployment reference: `120262309bc1910ed9e88fbcde5d6f19c93576696dbce2972525552d411d54a3`
- Created: `2026-08-31T23:21:08.306Z`
- Provider status: `SUCCESS`
- Release commit binding: `a66510115cd322723b47446b9f1ce29c0c046a0f`
- Release-variable manifest SHA-256: `1424677c30c1eaea1fab858faf959268b1c8dccdfd461e14869747a1f5b8d8ae`
- Release-variable count: `55`
- Remote variable keys, shapes, and hashes: `VERIFIED`
- LOR enabled: yes
- kill switch: off
- named-canary requirement: disabled by verified remote binding
- rollout result: `NAMED_ROLLOUT_ACTIVATED_VERIFIED`

The successful canary deployment immediately preceding rollout was `01ae639b-2cd6-47a2-be3d-7666361b1546`, reference `d55a11118b3d8aea8644f5565864d26c2d6dd1ac305a8f2e86a69c64e6858ac6`.

## Production smoke

Final provider/HTTP checks:

| Probe | Result |
|---|---|
| HQ `/health` | `200` |
| LOR `/health/lor-studio` | `200` |
| Anonymous `/lor-studio/` | `302` to authentication |
| Unauthorized candidate-start POST | `403` |
| IV Prep anonymous route | `401` protected, runtime healthy |
| Authenticated LOR case hydration | PASS |
| Matrix return control | present, exact MissionMed Matrix route |

Fresh authenticated production browser smoke used the named synthetic student canary case `case_631c974a-89a6-468e-ae84-b4dff9cb8f25`. It hydrated as Student with `8 of 8 sections complete`, `Faculty verified`, and `Version 24`. The live browser exercised Home, Build My LOR, Examples & Templates, a complete teaching sample, Writer Depot, My Letters, Intelligence, and Settings. The final letter remained released under the recorded `Keep access` decision and the download control remained visible.

Ticket 021 did not repeat credential-bearing mentor/faculty sign-in, invitation, OTP, AI, or final-release mutations: those production workflows were already proven on the same preserved backend/case sequence before the visual re-anchor, and ticket 021 changed none of their source. Their current role renderers were independently reviewed and covered by the focused production projection suite. This distinction prevents a presentation-only change from manufacturing a second invitation, OTP, AI run, signature, or final release merely to claim freshness.

## Safety, kill switch, and rollback custody

Original preimage captured before deployment:

- Deployment ID: `a4be041f-c462-4cbf-aa17-88edf21a90b1`
- Deployment reference: `c9db3d14c570cf9d856ccd80d85139a604de5b90d9b7ad94a58e5786fa990837`
- Created: `2026-08-31T22:32:10.172Z`
- Image digest: `sha256:1c2643348affbfe165fc99d23bf9bb460e98c39ac5a067a8afbc428a52cc4aa2`

The first rollout promotion returned the governed fail-closed outcome `ROLLOUT_ACTIVATION_FAILED_DARK_RESTORED`. The orchestrator restored dark mode; HQ health remained `200`, LOR public access became `404`, and IV Prep remained protected at `401`. The named canary was then reactivated and verified. A sanitized stage trace recorded only command labels, byte counts, URLs, and status codes; the repeat promotion succeeded with all provider queries, remote-binding probes, `/health`, `/health/lor-studio`, and unauthorized-candidate checks green. No secret value was emitted.

This proves the operational kill switch and dark recovery path. The exact preimage remains recorded for provider rollback. An additional live old-image rollback was intentionally not performed after the new release-commit privacy attestation was signed, because the previous image and the new commit-bound attestation are not a safe compatible pair; the governed dark restore is the minimal truthful safety proof for this presentation-only release.

## Production screenshots

| Screen | File | SHA-256 |
|---|---|---|
| Home | `F2-LOR-1012_UI_021_01_HOME.png` | `0f6a17f734e8ea834fe1eb7dc2ddce5a36c92eb73d8615fa472e571ea1c381cb` |
| Build My LOR | `F2-LOR-1012_UI_021_02_BUILD_MY_LOR.png` | `eceec7261ebaa265e6e90edc85a5e620c36844dcb0d36d95fa678c30b7ad11e5` |
| Examples & Templates | `F2-LOR-1012_UI_021_03_EXAMPLES_TEMPLATES.png` | `7b7aa2964c0497a68c408cd3a8d623040b8603a1aeba30548ba56f8614e90104` |
| Writer Depot | `F2-LOR-1012_UI_021_04_WRITER_DEPOT.png` | `beff225be1415f1d03cf45f7a4e006af7d5f4c0448a174411fd7daded887168d` |
| My Letters | `F2-LOR-1012_UI_021_05_MY_LETTERS.png` | `377bbb00464d072409beba6307f8e9dff69c4cecfc43db44091efd41f4e573bb` |
| Intelligence | `F2-LOR-1012_UI_021_06_INTELLIGENCE.png` | `e451d491fe288a28e7c0223ae88efdc4882719fca88754aa4ecd9c2e8d790c35` |
| Settings | `F2-LOR-1012_UI_021_07_SETTINGS.png` | `e4313bcfa81f2c8acb40368150860f73cb026400b8e3ff278cf29894a70cfe8a` |
| Complete sample | `F2-LOR-1012_UI_021_08_COMPLETE_SAMPLE.png` | `bbc19717d5e9f60873853866b9c0deead4bd416b3e1a8036e8fb813ff6036b81` |
| Final rollout home | `F2-LOR-1012_UI_021_09_FINAL_ROLLOUT_HOME.png` | `0f6a17f734e8ea834fe1eb7dc2ddce5a36c92eb73d8615fa472e571ea1c381cb` |

## Final acceptance

- Founder-approved information architecture: restored
- live canonical case data: preserved
- student production presentation: fresh browser PASS
- mentor/faculty presentation contracts: focused suite and independent review PASS; backend unchanged
- placeholder/stub/fake-live presentation: `0`
- P0: `0`
- P1: `0`
- HQ health: PASS
- IV Prep coexistence: PASS
- anonymous/unauthorized containment: PASS
- kill switch/dark recovery: PASS
- exact source and provider identities: sealed

`RESULT: COMPLETE — FOUNDER-APPROVED LOR STUDIO LIVE`
