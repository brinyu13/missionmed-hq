# B1-510G Final Complete Combined Handoff

## Final verdict

**STORYFORGE FIRST-NAME GREETING HOTFIX BLOCKED — FOUNDER ACTION REQUIRED**

The corrected Founder authority has been implemented, fully verified across all
locally executable suites, committed, and packaged as deterministic release
`v-21d896bc96f9c454`. It was not deployed because the protected
critical-systems manifest is stale relative to the already accepted B1-510 live
release, and the real local WordPress integration runner lacks its configured
container socket. No release safety gate was bypassed.

## Product result

The student homepage greeting now uses the authenticated WordPress core
`first_name` exactly as stored. `Dr` remains `Dr`; StoryForge does not split,
correct, normalize, or infer it. Only a genuinely absent/blank first name falls
back first to the trusted display-name first token, then to the signed username.
Email, last name, title, UUID, and hardcoded names are excluded.

The same WordPress SSO plugin remains the identity authority, the same JWT
remains the signed bridge, the same `/api/session` endpoint remains the
authenticated payload, and the same escaped homepage renderer remains the only
consumer. Authentication, authorization, roles, LearnDash eligibility, cohorts,
voice, transcription, persistence, layout, styling, and every non-homepage
workflow are unchanged.

## Root cause

The existing homepage helper used the first token of `display_name`. Founder
WordPress user 1 has `display_name=brinyu` and authoritative core
`first_name=Dr`, but the signed bridge did not carry first name. The server
therefore had no authoritative WordPress first name to give the browser.

## Files and commits

Hand-authored implementation/test commit:

- `d88d320561f31680f6f252160e45b6402d184587` — 9 files, signed field
  pass-through, homepage selector, and focused tests.

Deterministic release commit and final release HEAD:

- `0250ab7591518c2a0589c377e4862bcd82c2e1b3` — 5 generated release paths,
  including the fingerprinted app rename.

See `B1-510G_ZERO_BLAST_RADIUS_REPORT.md` for the exact file inventory and why
each path was necessary.

## Verification summary

- Focused: 23/23.
- Complete unit: 224/224.
- PostgreSQL 18 authorization/conformance: PASS.
- PostgreSQL runtime/RLS: 12/12.
- Acceptance: 130/130.
- Browser E2E: 59/59.
- Conformance/accessibility: 72/72.
- Deterministic release and route-manifest provenance: PASS.
- API-only build, secret scan, PHP/JS syntax, diff check: PASS.
- npm audit: zero vulnerabilities.
- Local desktop and 390px mobile greeting/layout smoke: PASS.
- Real local WordPress bridge: STOPPED before tests because the configured
  container socket is unavailable; no container troubleshooting was attempted.

## Release identity

- Release ID: `v-21d896bc96f9c454`.
- App SHA-256:
  `0dd4ed77dc52731cf49e95033c6962ad371cec2c3db3cc1248d5fa71c6b03176`.
- Index SHA-256:
  `ffeb8b5f603d3c6113bca008cc2647fde8b7f17175ba268d6293d0c05349d93a`.
- Route SHA-256:
  `e673ed291b5fc070330d3c3b30a7ff7b267a7d8ce46f98ab9db8a8f854553925`.
- Release PHP SHA-256:
  `3afec2a55716420b616d4dabd4c35baed741e2e88a219592f0690235d940b147`.

## Visual evidence

- Current live before: existing
  `../B1-507_storyforge_phase1_launch/screenshots/007-live-storyforge-dormant-founder-home-after.png`
  showing `Good morning, brinyu.`
- Local after desktop:
  `evidence/B1-510G_after_desktop_2048x1216.png`.
- Local after mobile:
  `evidence/B1-510G_after_mobile_390x844.png`.

## Deployment, rollback, and external action

Deployment ID: **none**. Live Founder result: **not run**, because the candidate
was not deployed. Representative local student result: `Good morning, Maya.`
with unchanged desktop/mobile layout. Existing production remains on
`v-a790ce4e3168384f` and no remote system was changed.

The protected critical-systems manifest still points to pre-B1-510
StoryForge bytes and produces three FAIL results against the current accepted
B1-510 production baseline. This hotfix's no-unrelated-file rule does not permit
silently rewriting that authority. The Founder must route a manifest-owner
reconciliation of the current B1-510 live index/app baseline and either restore
the local WordPress integration runner or approve an evidence substitution.
After those two gates clear, the existing guarded backup, Railway, WordPress
plugin, Kinsta immutable-release, live Founder smoke, monitoring, and rollback
preflight sequence can proceed without any product redesign.

## Worktree and remote-mutation status

The release commits are clean. The handoff/evidence package is stored under the
required ignored `_AI_HANDOFFS/from_codex/B1-510G_first_name_greeting_hotfix/`
path. No push, pull request, deployment, cache clear, profile write, provider
call, R2 operation, database write, or other remote mutation occurred.
