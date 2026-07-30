# B1-507A Production Infrastructure Inventory

Date: 2026-07-29
Method: repository inspection plus authenticated, read-only browser/CLI checks. No remote writes occurred.

## Systems

| System | Exact role and current environment | Current StoryForge state/health | Required launch writes | Access/MFA | Backup and rollback | Blockers |
|---|---|---|---|---|---|---|
| GitHub `brinyu13/missionmed-hq` | Source/release custody; public repo; default `main` | Local branch upstream is 18 commits behind local candidate; upstream branch unprotected; no StoryForge PR/check/release found | Push exact commit, protect/review branch, record immutable SHA and release evidence | Current viewer has admin capability; no write used | Git history/revert and retained release archive | Candidate not in remote custody; no required checks/protection |
| Railway project `missionmed-storyforge-v5` (`875e7c17-d06f-4301-a4bb-e61016f153cf`) | API runtime and production PostgreSQL | API deployment `fa7ad084-4dae-4039-a154-2250a407d95e` successful; one observed US West instance; B1-503 commit/release; health 200 | Deploy candidate image/source, add Phase 1 secrets/config, wire selected assembly, keep force-off until gated | Authenticated current session/CLI evidence; write authorization not granted in B1-507A | Railway deployment rollback; force-off/provider-none/reconciliation-off | Candidate/wiring/gates/config absent |
| Railway PostgreSQL service `a4a66362-c3ba-475a-ae21-2aa46624bafe` | Canonical StoryForge data/RLS/audit | PostgreSQL 18.4; five migrations; Phase 1 tables absent; one user and no story content | Fresh backup; restore rehearsal; guarded three-migration apply; post-apply RLS/TAP verification | Read-only access succeeded; migration apply needs explicit authorization and complete env contract | Snapshot/backup plus additive-schema rollback plan | Fresh recovery point and production apply not done |
| MyKinsta live MissionMed site | WordPress/PHP runtime, immutable StoryForge shell/release pointer | Live site healthy; current pointer B1-503; automatic backups available; screenshot shows normal live environment | Fresh site backup; immutable V5.5 release; gateway/plugin update; pointer cutover | Authenticated session exists; cutover/backup may require confirmation/MFA | Kinsta backup plus previous release pointer/plugin hashes | Gateway code gap, fresh backup/restore rehearsal, deployment authority |
| WordPress administration | SSO plugin, entitlement/bootstrap, site integration | `missionmed-storyforge-sso` active; Founder allowlist/student-view works; text route healthy | Deploy updated route/plugin; validate 360 entitlement; activate scoped flags only after gates | Authenticated administrator session exists; no settings mutated | Previous plugin/route release and option export | Final 360 authority/receipt absent; gateway methods incompatible |
| Cloudflare Workers/routes | Edge inventory and DNS/CDN evidence | No StoryForge Worker and no StoryForge Worker route found; old Worker is gone | No Worker needed under current architecture; refresh system manifest | Authenticated account session exists | Existing DNS/CDN configuration; no StoryForge Worker rollback needed | `_SYSTEM` manifest is stale |
| Cloudflare R2 | Private temporary/permanent audio storage | Buckets found: `missionmed-cam-dev`, `missionmed-cam-production`, `missionmed-videos`; no StoryForge bucket | Create prod/staging StoryForge buckets, scoped token, CORS, lifecycle/control object; validate signed URLs and cleanup | Authenticated session exists; token creation may require MFA/secret handoff | Object version/retention policy as approved; keep buckets private; force voice off on rollback | Entire StoryForge storage plane absent; FG-1/C1-C5 |
| OpenAI platform | Replaceable transcription infrastructure | Personal organization; Default project only; no StoryForge project/key; logging per-call; audit logging off | Create scoped project/key, verify data controls/contract, run bakeoff, install Railway secret | Authenticated session exists; billing/security/MFA or contract action may require Founder | Provider mode `none`, key revoke/rotate, fallback bounded | RP-7, human corpus, privacy/BAA/ZDR evidence |

## Railway identifiers and topology

- Environment: production `bcef8734-e42b-44df-8488-c2a3de68213f`
- API service: `dab015bf-15ef-4698-9f16-cbf8cf23de7a`
- API domain: `storyforge-v5-api-production.up.railway.app`
- API deployment: `fa7ad084-4dae-4039-a154-2250a407d95e`
- Database service: `a4a66362-c3ba-475a-ae21-2aa46624bafe`
- Database deployment receipt: `f5c7179…`
- One API instance was observed. This does not prove a locked one-replica invariant for reconciliation.

## Current nonsecret runtime posture

- `STORYFORGE_TRANSCRIBE_PROVIDER` is absent; source defaults to `none`.
- `STORYFORGE_AUDIO_RECONCILIATION` is absent; source defaults to `off`.
- No R2 credential/bucket variables are configured.
- No OpenAI StoryForge key is configured.
- Existing base path is `/storyforge/`.
- Existing public origin is `https://missionmedinstitute.com`.
- Origin-API-only mode is true.
- All student/mentor AI feature flags report false.

## Production backup posture

B1-503 has historical Kinsta, database, and rollback receipts. They prove rollback was previously prepared, not that a current Phase 1 recovery point exists. The final launch requires:

1. fresh Kinsta backup ID/time/receipt;
2. fresh PostgreSQL backup ID plus checksum-bound receipt;
3. an isolated restore rehearsal proving the backup is readable and the expected database identity/counts;
4. current immutable release/pointer/plugin/route hashes;
5. Railway current deployment and variable-name inventory;
6. R2 configuration/object inventory before any audio traffic;
7. a timed rollback rehearsal with no student audio.

## Current production claims allowed

- Healthy authenticated B1-503 text StoryForge pilot: **yes**.
- Hidden/default-off V5.5 code deployed: **no**.
- Provider configured: **no**.
- Voice recording/transcription live: **no**.
- Permanent audio/replay live: **no**.
- Automatic deletion live: **no**.
