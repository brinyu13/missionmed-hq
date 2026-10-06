# Exact state — verified audit snapshot

Fresh read-only checks2026-10-06 around14:14–14:23 UTC. Revalidate once on takeover; newer Git/runtime/OS outrank this snapshot.

| Identity | Verified value |
|---|---|
| Repository | https://github.com/brinyu13/missionmed-hq.git |
| Assigned Foreman worktree | /Users/brianb/.codex/worktrees/ivoc-foreman-9200/ivoc-master-8000 |
| Other supplied cwd, NOT interchangeable | /Users/brianb/MissionMed_worktrees/ivoc-master-8000 |
| Branch | codex/ivoc-foreman-9200 |
| Audit SOURCE HEAD / remote branch HEAD | 64f3dc920b41f863112d8422e79ca791c4e806e6 |
| DEPLOYED SOURCE | 89a9235e4150db66be82a1e8d80f668f5ac229c1 |
| Source/deployment relation | 64f3dc9 is a ledger-only child of89a9235 |
| Railway deployment | 85abc7a8-fae3-4cce-a490-ae6a5f39967b, SUCCESS |
| Image | sha256:48cdd366f3447b4562fd31a4880db93ae9d17df0ec90e689afc073e5cf2dd472 |
| Project | missionmed-hq-fix005 /29afe885-b9b1-425d-8fd8-8611cd275409 |
| Service | missionmed-hq /3d18b017-4fc9-4b22-b097-ba879816d374 |
| Environment | production /ed3353f7-bcc7-4e25-a000-3c9fc628a9a7 |
| Health / anonymous product / bootstrap | 200 /401 /401, checked this audit |
| Runtime provider module hash | df4123ef6e87c9ea961bfc27e3e4a47a29a153436a8b8b2c98b972d3e6eec58e |
| LemonSlice activation | OFF, verified runtime, consumed reservation unchanged |
| Consumed reservation | 7ab0402b-0ee6-4265-b3e9-4de2938225f3 |
| Current rollback | SAME healthy OFF deployment85abc7a8 / source89a9235 / image above; infrastructure baseline, NOT complete product |
| Earlier rollback identity | ba1094842e7283632ba4e3e2851e555e09818c27 /f0e29ddc-af9c-4993-a8ad-249a6fd49ab7, now REMOVED |
| Earlier OFF image | sha256:a8f88ab997e3525d02dadfdd4bd301f97d4d19e8025dec20d5dd02dbc26017df |

Before package creation, tracked tree clean. Preserved untracked directory:
_AI_HANDOFFS/from_fable/IVOC_LEMONSLICE_FORENSIC_RECOVERY_20261004/
Do not clean, stage, stash, overwrite or use that dirty donor as release input.

Any later package-filing commit changes documentation HEAD only. The head above is the implementation/ledger snapshot being handed over, not a claim that a self-containing package commit already existed at audit time. Use git log/status/readback to identify later commits.

## Authority and leases

MissionMed OS /Users/brianb/MissionMed_OS, repo brinyu13/missionmed-os, HEAD+remote main49873d8b187a75e9aa3da7b4d007c42f0044480b. CURRENT generated2026-10-06T08:33:14-04:00. MissionIVOC-CONVERGE-8001. BOOT validator PASS this audit.

Relevant DR290/350/361/392/394; DR393 paid canary consumed; DR340 temporary QA grant revoked. Current BOOT roles still name Codex builder. Founder routing decision and canonical authority must precede a different protected production integrator.

Read-only canonical query: zero unexpired unreleased IVOC leases. Last releases:
REGISTRY5159 at12:34:03.226362 UTC; PRODUCT5160 at12:44:13.489067; SHARED5161 at12:44:13.478892. No audit lease acquired; do not reuse released handles.

## Database / provider / authenticated context

Dedicated Supabase production project missionmed-ivoc-production, ref bscnrgqlwsyygyfrbhfn, regionus-east-2. Prior security acceptance14migrations/25forced-RLS tables/browser grants denied remains ratcheted; not a new schema audit. Media belongs to private Cloudflare R2, not an invented Supabase Storage bucket. Historical development refs are not production authority.

Native GPT-Live remains the engine. No GPT or LemonSlice session started in this audit. Latest exact provider canary terminal COMPLETED and room0 is dated ledger evidence, not a newly polled provider event. See06.

Most recent prior UI readback: brinyu/wp:1 ADMIN authenticated through Matrix, owned Chrome cold reload and Mock→Room READY00:00, no auto-start/no avatar checkbox. This audit did not reauthenticate or perform physical/acoustic POV. Browser handles are ephemeral; inspect available authorized tabs rather than copying tokens.

Entry: https://missionmedinstitute.com/member-dashboard/ → normal IVOC launch → https://missionmed-hq-production.up.railway.app/iv-prep-on-call/#/home .
