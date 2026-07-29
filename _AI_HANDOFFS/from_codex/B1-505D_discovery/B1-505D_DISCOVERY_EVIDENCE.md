# B1-505D Discovery Evidence

Captured: 2026-07-29 UTC
Repository: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
Scope: read-only discovery under the B1-504B packet. No secret values are recorded.

## Summary

| Probe | Outcome | Consequence |
|---|---|---|
| RP-1 B1-505 authority | `ABSENT` | S18+ cohort activation remains blocked. |
| RP-2 git health | `HEALTHY` | Implementation may proceed in the existing worktree. |
| RP-3 live baseline | `MATCH` | The B1-503 production baseline remains authoritative. |
| RP-4 Cloudflare routes | `INSPECTION_BLOCKED_NO_AUTH` | S10 remains gated; no topology conclusion was inferred. |
| RP-5 Railway inventory | `INVENTORY_CAPTURED_NO_CONTRADICTION` | Exact StoryForge production services and names-only variables recorded. |
| RP-6 R2 state | `INSPECTION_BLOCKED_NO_AUTH` | R2 provisioning/deployment remains gated; no bucket state was inferred. |
| RP-7 OpenAI access | `NO_AUTHORIZED_KEY_MODEL_PROBE_DEFERRED` | No model-list call was made. |
| RP-8 ffmpeg feasibility | `BLOCKED_DOCKER_CAPACITY_NO_OPTION_SELECTED` | The binding container probe could not complete; assembly remains fail-closed. |
| RP-9 staging and harness | `STAGING_ABSENT_LOCAL_HARNESS_PASS` | No controlled remote environment exists; the repaired local harness boots and shuts down cleanly. |
| RP-10 WordPress identity | `MATCH_NO_IFRAME` | Plugin identity and current one-founder policy match the baseline. |
| RP-11 bake-off | `DEFERRED_BY_AUTHORITY` | Requires adapter, scoped key, and founder-provided human corpus. |
| RP-12 provider data handling | `NO_MATERIAL_POLICY_CONFLICT_FOUND` | Endpoint posture is compatible with the proposed policy; actual MissionMed contractual status remains unproven. |
| RP-13 PostgreSQL facts | `COMPLETE_WITH_AUDIT_AUTHORITY_CONTRADICTION` | Mechanical selections are resolved, but the locked grants cannot perform mandatory audit writes. |
| Additional provider-contract check | `TECHNICAL_AUTHORITY_CONTRADICTION` | Only the provider-driver lane is stopped pending a Fable amendment. |
| Additional E7 attach check | `ASSEMBLY_ATTACH_CONTRACT_UNRESOLVED` | No assembly option was selected and the asynchronous finish/transactional-attach boundary cannot be invented. |

## RP-1 — B1-505 authority

Outcome: `ABSENT`

Neither required final artifact exists:

- `_AI_HANDOFFS/from_codex/B1-505_360_BETA_ACCESS_COMBINED_HANDOFF.md`
- `_AI_HANDOFFS/from_codex/B1-505_evidence/B1-505_PRODUCTION_ACCESS_RECEIPT.md`

No eligibility or cohort policy was reconstructed from another source. S18 and later cohort activation remain blocked.

## RP-2 — Worktree git health

Outcome: `HEALTHY`

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Initial implementation-run authority commit: `a3255ad`
- B1-505C authority-record commit: `6e630df672e47e50ae5e14592c8455979e2b1dac`

Git traversal, status, and log inspection succeeded. No reset, clean, stash, rebase, or destructive normalization occurred.

## RP-3 — Live production baseline identity

Outcome: `MATCH`

Read-only identities:

- Railway API deployment: `fa7ad084-4dae-4039-a154-2250a407d95e` (`SUCCESS`)
- Railway API image digest: `sha256:fa952146914f1eb4ab3cdfd6ccfe7f2d0d69c1638f6de59668f2272443500d2b`
- Railway PostgreSQL deployment: `f5c7179e-b805-4e82-b080-d2349a0a47cf`
- Kinsta release pointer: `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`
- Kinsta route hash: `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61`
- Deployed WordPress plugin hash: `eaf740af712ec5ef94415bae78c3107b751977f74f413b3d60a8533202e120d7`
- Runtime application asset: `71f618e9afac78d13c1b22d30b0ad43e2b2c7ab162b6e1d92ae607b3b853f3fb` (214651 bytes)
- Runtime stylesheet asset: `41e546d34bfd73f0f9f446047640ba2cf7c303b092841b9f5115911293e7ddf1` (97142 bytes)
- Runtime auth asset: `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e` (7159 bytes)

An authenticated founder-pilot browser session opened `https://missionmedinstitute.com/storyforge/` as the expected signed student and displayed the recovered V5 product. The three runtime hashes match the B1-503 production receipt.

## RP-4 — Cloudflare routes

Outcome: `INSPECTION_BLOCKED_NO_AUTH`

The local Wrangler client is installed but has no authenticated Cloudflare session. No Cloudflare connector or environment credential was available. The Workers route/DNS inspection therefore did not run, and this document does **not** infer that a Worker route is absent from HTTP behavior. S10 remains gated on a successful read-only route audit.

## RP-5 — Railway inventory

Outcome: `INVENTORY_CAPTURED_NO_CONTRADICTION`

- Project `missionmed-storyforge-v5`: `875e7c17-d06f-4301-a4bb-e61016f153cf`
- Environment `production`: `bcef8734-e42b-44df-8488-c2a3de68213f`
- Service `storyforge-v5-api`: `dab015bf-15ef-4698-9f16-cbf8cf23de7a`
- Service `Postgres`: `a4a66362-c3ba-475a-ae21-2aa46624bafe`

Names-only inspection found the existing `STORYFORGE_*`, Railway, and runtime variables expected by the V5 baseline. No `SUPABASE*` variable name was present. No secret values were printed or stored.

## RP-6 — R2 state

Outcome: `INSPECTION_BLOCKED_NO_AUTH`

The names-only Railway inventory confirms that the current StoryForge service does not have the B1-506 R2 variables installed. Cloudflare authentication was unavailable, so bucket existence, public-access, CORS, and lifecycle state could not be inspected. No bucket was created and no absence conclusion was inferred.

## RP-7 — OpenAI access

Outcome: `NO_AUTHORIZED_KEY_MODEL_PROBE_DEFERRED`

- `STORYFORGE_OPENAI_API_KEY`: absent from the StoryForge service.
- The two specifically permitted hq variable names were checked names-only on the exact production hq service; neither was present.
- `GET /v1/models` was not called.

This is not evidence that any model is unavailable. Scoped-key provisioning and a real account model-list probe remain deferred.

## RP-8 — ffmpeg feasibility

Outcome: `BLOCKED_DOCKER_CAPACITY_NO_OPTION_SELECTED`

The binding local Nixpacks-container probe did not produce a valid Option A/B
result. The Docker VM reported hard-link I/O failures, a
`metadata_v2.db` I/O failure, and `no space left on device`. No Docker reset,
prune, image deletion, or other destructive recovery was authorized or
performed.

The Nixpacks plan confirms that ffmpeg can be declared, but that is not the
required container execution result. A supplemental host-only probe concatenated
forty 15-second WebM segments in 0.11 seconds and M4A segments in 0.12 seconds;
full playback passed in Chrome and Safari, while the M4A run emitted 39 DTS
warnings. These supplemental observations do not select Option A or Option B.
Assembly remains behind a fail-closed injected boundary.

## RP-9 — staging and local harness

Outcome: `STAGING_ABSENT_LOCAL_HARNESS_PASS`

The exact StoryForge Railway project has one environment (`production`) and two services (API and PostgreSQL). No StoryForge staging environment, service, or database exists.

The first `bash storyforge-v5/scripts/run-local.sh` probe booted and `/healthz`
returned HTTP 200, but interruption exposed a deterministic cleanup defect: the
script installed an `EXIT` trap and then `exec`ed Node, replacing the
trap-owning shell. The probe-created PostgreSQL instance was stopped and only
the probe-created temporary root was moved to Trash.

The script was then repaired without changing product behavior. PostgreSQL 18
boot, `/healthz`, the runtime database identity
(`storyforge_app`, non-superuser, non-BYPASSRLS, NOINHERIT), Ctrl-C shutdown,
and cleanup all passed. No residual process or temporary directory remained.

## RP-10 — WordPress production identity and embedding

Outcome: `MATCH_NO_IFRAME`

Summary-only production settings:

- `storyforge_enabled=true`
- allowed user IDs: 1
- mapped allowlisted users: 1
- exact founder pilot mapped: yes
- app role overrides: 1
- role histogram: `student=1`
- allowed roles: `student`
- allowed cohorts: empty
- token TTL: 60 seconds

The deployed and worktree WordPress plugin hashes match exactly. The authenticated application has no iframe; microphone permission does not require an iframe `allow` repair. No WordPress setting was changed.

## RP-11 — provider bake-off

Outcome: `DEFERRED_BY_AUTHORITY`

The bake-off requires the real adapter, a scoped StoryForge key, the founder-side human corpus, and clean RP-12 evidence. Synthetic audio will not substitute for human accent scoring.

## RP-12 — provider data handling

Outcome: `NO_MATERIAL_POLICY_CONFLICT_FOUND`

Official OpenAI materials accessed 2026-07-29 state that API inputs/outputs are not used for training by default; the audio transcription endpoint is listed as Zero Data Retention eligible with no abuse-monitoring or application-state retention; ZDR/Modified Abuse Monitoring requires approval; and eligible API use can be covered by the applicable healthcare agreement. This is compatible with the proposed StoryForge retention boundary. It is not evidence that MissionMed currently has ZDR, Modified Abuse Monitoring, or a BAA/Healthcare Addendum in force.

Official references:

- `https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint`
- `https://openai.com/policies/how-your-data-is-used-to-improve-model-performance/`
- `https://help.openai.com/en/articles/20001069`

## RP-13 — PostgreSQL and runner facts

Outcome: `COMPLETE_WITH_AUDIT_AUTHORITY_CONTRADICTION`

- Exact service connection role: `storyforge_app`
- Attributes: LOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT
- The role is dedicated rather than a shared login.
- The migration runner executes one transaction and strips top-level migration `BEGIN`/`COMMIT`.
- Story removal is soft archive through `archived_at`/`archived_by`; there is no hard-delete handler or `deleted` story status.
- `sf_audit_events.id` is a monotonic bigint identity backed by `sf_audit_events_id_seq`.
- `sf_audit_events` has no `metadata` column.
- Existing `sf_stories` and `sf_audio_assets` are owned by `postgres`; `authenticated` has SELECT only and `storyforge_app` has no existing direct DML grant.

Mechanical consequences:

1. M1 service grants use `storyforge_app` exactly.
2. Migration source retains the authority transaction markers; the guarded runner strips them for its single-transaction stream.
3. Archive handling cancels/purges voice sessions and objects; no hard-delete/410 branch is invented.
4. Phase-1 platform CI keeps the specified opaque composite cursor unless separately amended; production platform exposure remains forced off.

The B1-504B observability SQL references a nonexistent `metadata` column. Per authority, corrected operational SQL requires Fable confirmation before S14 and is not improvised here.

The same catalog/grant inspection found a consequential contradiction not
resolved by the four mechanical selections:

- B1-503 revokes `EXECUTE` on `public.sf_append_audit(...)` from `PUBLIC`.
- Existing domain functions may call it internally, but neither
  `authenticated` nor `storyforge_app` receives direct execute authority.
- The locked M1/M2 migrations grant `storyforge_app` access only to the new
  recording tables and read access to the feature-flag table.
- Neither locked migration grants `INSERT` on `sf_audit_events` or introduces
  approved recording/flag SECURITY DEFINER domain functions.

Therefore the mandatory in-transaction audit events for recording transitions,
feature changes, denials, deletion, and sweeps cannot execute under the actual
service or end-user roles. Skipping those events or broadening grants would
violate the locked authority. Audit-dependent mutations remain fail-closed and
this exact grant/function amendment is returned to Fable.

E13 has a second, narrower contradiction: the locked schema has no recording
`error_category` field, `sf_audit_events` has no `metadata` field, and
`storyforge_app` has no cross-student audit-table SELECT grant. Session-state
counts are implementable, but the mandated last-24-hour cross-student
`errorCategory` aggregation is not. The injected E13 category seam returns
`voice_health_audit_unavailable` rather than exposing content or inventing
access.

## Additional provider-contract contradiction

Outcome: `TECHNICAL_AUTHORITY_CONTRADICTION`

The B1-504B transcription lock names `gpt-transcribe`, request fields `keywords` and `languages`, and a future `gpt-live-transcribe` model. Current official API documentation instead documents:

- batch transcription model `gpt-4o-transcribe`;
- request field `language` (singular) and `prompt`, with no separate `keywords` or `languages` fields;
- current realtime transcription models under different identifiers.

Official references:

- `https://developers.openai.com/api/docs/models/gpt-4o-transcribe`
- `https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create`
- `https://developers.openai.com/api/docs/models`
- `https://developers.openai.com/api/docs/guides/realtime-transcription`

This discrepancy is outside the kickoff's pre-authorized mechanical substitutions. The transcription provider-driver lane is stopped and returned to Fable for amendment. Provider-neutral recording, persistence, flags, privacy, UI, and adapter-boundary work may continue. Codex will not silently select a different model or request schema.

## Additional E7 assembly/attach contradiction

Outcome: `ASSEMBLY_ATTACH_CONTRACT_UNRESOLVED`

The authority requires E4 to trigger assembly asynchronously, while the
frontend saves by calling E4 and then E7. E7 is allowed to receive a session in
`finishing` or `assembled`, yet is also required to commit story creation,
immutable original transcript, session attachment, and audio-asset linkage in
one transaction. A `finishing` session has no assembled asset to link, and the
binding RP-8 probe did not select either authorized assembly implementation.

No third assembly path, synchronous conversion, partial attachment, fake asset,
or post-commit repair was invented. The ordinary typing-only story-create path
remains intact; the voice attach path remains fail-closed behind the injected
assembly boundary until RP-8 can be rerun and Fable confirms the finishing-state
transaction sequence.

## Mutation statement

All probes in this file were read-only except local disposable harness resources created for RP-8/RP-9. No production database, Railway variable, Cloudflare setting, R2 bucket, WordPress setting, DNS record, deployment, or remote Git state was changed.
