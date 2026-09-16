# Tests and Live QA

## Automated

- `npm test` in `rise`: 230 tests PASS, 0 fail, 0 skip.
- Includes auth/runtime, canonical promotion, provider-neutral research, depth, filters, SOAP, My Programs, Student Intel, Fable, registry, worker, spend, and RLS contract tests.
- Four CSV outputs imported with Artifact Tool and structurally inspected.
- CSV row/identity validation: 695 IM, 809 FM, 325 IM queue, 668 FM queue; no duplicate program-specialty IDs; no blank canonical/ACGME IDs; queue routes are Terra only.

## Provider readback

- Railway deployment: `ede2968f-cceb-4bd1-8de3-6a229f0cc926` = SUCCESS.
- Image: `sha256:c1faeb3fd40aed9b59d026d90bb5fa39b221991a1d63dfc23c78e8ef61408b77`.
- Health: `ok=true`, `activationStatus=active`, `sourceRightsCurrent=true`.
- On-demand infrastructure remains deployed but `globalEnabled=false`, `studentEnabled=false`, `emergencyKillSwitch=true`.
- Startup loaded SOAP 2026 with 883 exact programs.
- Runtime used the existing verified file-level source-rights fallback; no source-rights mutation occurred.

## Authenticated live browser

Normal entry: `https://missionmedinstitute.com/rise/`

- Founder/Matrix session rendered normally after deployment.
- Full catalog: 6,139.
- Student-facing specialty tabs: 31.
- Internal Medicine: 695.
- Internal Medicine + Deep Research: 126.
- Global depth counts: Deep 375, Enriched 598, Basic 5,165, Pending 1.
- SOAP Explorer: 883 historical SOAP 2026 programs.
- My Programs: existing saved program persisted and rendered.
- Program File opened and rendered At a Glance, Program profile, Why this program, and Student Intel.
- Evidence-backed visa, resident composition, resident-school, and research-depth content rendered.
- Admin tools remained visible to the Founder control identity.

## Anonymous negative control

Direct requests without session to session, bootstrap, catalog, and My Programs endpoints each returned HTTP 401. The public `/rise/` path redirected to WordPress login. No catalog or private state leaked.

## Zero-blast checks

- Auth/session: PASS.
- Fable shell: preserved.
- Registry 6,139 / 31: PASS.
- SOAP: PASS.
- My Programs: PASS.
- Student Intel: PASS.
- Research controls: fail-closed/OFF.
- No paid research and no student quota use.

