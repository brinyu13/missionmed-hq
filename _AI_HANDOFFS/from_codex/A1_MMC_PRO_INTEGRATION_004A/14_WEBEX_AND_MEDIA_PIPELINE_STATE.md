# 14 Webex and Media Pipeline State

RESULT: `WEBEX_READ_ONLY_FOUNDATION_AND_MEDIA_IMPORT_PIPELINE_VERIFIED`

## Current state

The reconciled branch contains a complete engineering foundation for discovering explicitly triggered Webex recordings, staging immutable source artifacts, importing stable recording/transcript pairs, resolving the student under review, and running an evidence-bound analysis. It is deliberately disabled without approved configuration and is not a claim of live Webex connectivity.

Prompt 004A performed no Webex account mutation, meeting mutation, recording mutation, token change, Scheduler/Calendar mutation, media upload, R2 write, Stream write, Daily Drills watcher start, or `video_registry.json` write.

## Canonical implementation files

- `missionmed-hq/lib/mmc-webex-triggered-pull.mjs`
- `missionmed-hq/lib/mmc-coaching-import-worker.mjs`
- `missionmed-hq/routes/mmc-coaching-pipeline.mjs`
- `missionmed-hq/prompts/mmc-meeting-analysis-default.md`
- `missionmed-hq/public/mmc-private/src/app.js`
- `missionmed-hq/tests/mmc-coaching-import-worker-validation.mjs`
- `missionmed-hq/tests/mmc-coaching-import-worker-route-validation.mjs`
- `missionmed-hq/tests/mmc-webex-trigger-policy-validation.mjs`
- `missionmed-hq/tests/mmc-webex-trigger-route-validation.mjs`
- `missionmed-hq/tests/mmc-webex-trigger-browser-smoke.mjs`

The browser evidence for the local fail-closed state is:

- `screenshots/12_pipeline_admin_webex_controls.png`
- `screenshots/13_identity_roster_review_lanes.png`

## End-to-end intended flow

```text
Webex recording title
  -> classify explicit MMC trigger
  -> GET recording inventory (read-only source operation)
  -> ignore missing/disallowed/[MM-IGNORE] titles
  -> on explicit authorized pull, GET recording and transcript bytes
  -> atomically stage files plus metadata in the MMC coaching drop zone
  -> dedicated worker scans for stable video + transcript pairs
  -> SHA-256 + deterministic idempotency key + source provenance
  -> source asset imported into mmc.coaching_source_assets
  -> student resolution and roster verification review
  -> approved session/subject attachment
  -> versioned structured analysis
  -> MMC-owned artifacts, actions, loops, memory, and snapshot readback
```

No part of this flow changes a Webex recording or meeting. The only source-account operations implemented are HTTP `GET` inventory/detail/download requests. Local staging writes occur only after the authenticated admin route receives an explicit pull request and all configuration gates pass.

## Trigger policy

Supported title codes are:

- `[MM-ADV]` — default allowed advanced/coaching trigger
- `[MM-GRP]`
- `[MM-MOCK]`
- `[MM-PS]`
- `[MM-IGNORE]` — explicit exclusion with precedence over allowed codes

The default allowed list is only `[MM-ADV]`. Other supported codes do not become allowed merely because the parser recognizes them; an administrator must supply a scoped allowed-trigger list in the local Pipeline Admin/configuration contract. Unknown, missing, or disallowed triggers are ignored. `[MM-IGNORE]` always produces an ignored result.

The UI stores the local allowed-trigger preference for review, but changing that browser preference does not change Webex or any production setting.

## Webex safety gates

`getWebexTriggerPullConfig()` and the pull function enforce:

| Gate | Behavior |
| --- | --- |
| Access token absent | Inventory returns `UNVERIFIED`; pull returns `webex_token_missing` |
| Pull enablement absent | Pull returns `webex_pull_not_enabled` |
| Trigger absent/disallowed | Recording is ignored |
| `[MM-IGNORE]` present | Recording is ignored even if another recognized code is present |
| Private session absent | Coaching route returns `403` |
| Pipeline-admin role absent | Pull/import/approval operations are denied |
| Persistence gate absent | Coaching route fails closed before data handling |
| CSRF absent on POST | Existing HQ mutation guard denies the request |

The implementation can read a token from established environment variable names, but this report never records a token value. Returned inventories redact source download URLs before reaching the browser.

## Local staging contract

For an allowed recording, the pull module:

1. Fetches recording detail through Webex using `GET`.
2. Downloads the video through `GET`.
3. Downloads the transcript through `GET` when available.
4. Derives a sanitized local stem.
5. Writes each asset atomically using a temporary file and rename.
6. Computes SHA-256 for video and transcript.
7. Writes metadata containing source identity, hashes, trigger classification, and pair state.

The staging files retain source IDs and provenance; copied bytes are never represented as a newly authored source.

## Dedicated coaching import worker

The worker is an isolated scanner, not a daemon and not the Daily Drills watcher. It supports:

- Video: `.mp4`, `.mov`, `.m4v`
- Transcript: `.vtt`, `.txt`, `.json`
- Optional metadata: `.metadata.json`, `__metadata.json`, `_metadata.json`
- Default stability age: 30 seconds
- Deterministic grouping by relative stem
- SHA-256 for non-empty video and transcript files
- Deterministic lineage/idempotency key
- Complete-pair and incomplete-pair classification
- Filename and metadata parsing without silently declaring identity

A complete candidate requires both a non-empty stable video and a non-empty stable transcript. Missing or unstable pairs remain review/incomplete records. A date and meeting kind can improve meeting confidence; a name in a filename does not verify student identity.

Worker status explicitly reports the following protections:

- Daily Drills watcher not imported
- Daily Drills watcher not started
- `video_registry.json` not written
- R2 not touched
- Cloudflare Stream not touched
- Scheduler not touched
- Calendar not touched

## Protected video-registry relationship

The pipeline inventory endpoint can read the existing video registry as an informational source. This is not ownership. The current branch must never:

- write `VIDEO_SYSTEM/video_registry.json`;
- start or modify the Daily Drills watcher;
- change Daily Drills ingestion;
- use the registry as proof of canonical student identity;
- upload media to R2 or Stream through MMC;
- claim a registry pointer is an MMC-owned media asset.

## Drop-zone spelling conflict

Two historical defaults coexist:

- Webex pull staging default: `MissionWebexVidoes`
- Coaching worker default: `MissionWebexVideos`

The worker detects the historical typo sibling, and explicit route/test options can align the paths. This preserves discoverability without guessing which existing directory is authoritative. It is technical debt, not a reason to mutate either path in this reconciliation run.

The post-Fable implementation plan includes a compatibility-first normalization ticket that must:

1. inventory both directories without writing;
2. choose one canonical configuration key;
3. preserve read compatibility with the typo path;
4. add deterministic tests for both paths;
5. avoid moving or deleting any media;
6. avoid starting any watcher.

## Source-asset persistence

Imported candidates persist only into MMC-owned tables through the RLS context. A source asset includes:

- source system and immutable source ID;
- asset title/date;
- media and transcript pointers;
- source references;
- meeting and subject match status/confidence;
- idempotency and worker metadata;
- review-required reasons;
- provenance and audit events.

The worker does not itself declare a student or run analysis when identity is unresolved. Attach/analyze operations remain explicit Pipeline Admin decisions.

## Analysis handoff

After student/session attachment, the pipeline can create an analysis run. Real analysis requires:

- the provider gate explicitly enabled;
- an approved provider credential available at runtime;
- a readable transcript pointer;
- a prompt body from an active version or repository default;
- valid structured output matching the evidence schema.

The output persists as MMC-owned records and preserves source-asset and analysis-run IDs. Source media remains externally owned/read-only.

## Pipeline Admin reality

The implemented admin panel exposes:

- worker/drop-zone status and scan;
- complete and incomplete-pair counts;
- Webex token/pull gate status;
- editable local allowed-trigger filter;
- read-only Webex inventory;
- explicit triggered pull;
- source-asset inventory/search;
- student resolution queue;
- roster evidence verification and approval;
- session selection;
- explicit source attachment and real-analysis action.

In the Prompt 004A local evidence run, the UI correctly showed Webex as unconfigured and kept pull disabled. No attempt was made to work around that state.

## Validation status

The deterministic local validators covering the worker and Webex contract pass in the reconciliation run:

- coaching import worker validation
- coaching worker route validation
- Webex trigger policy validation
- Webex trigger route validation
- coaching pipeline contract validation
- private mount validation

Credentialed staging and browser smokes were not necessary to establish migration completeness and were not invoked because they require separately approved external configuration and may perform real writes. Their presence is preserved for a future scoped non-production validation run.

## Operational readiness classification

| Capability | Current status |
| --- | --- |
| Trigger parser/policy | Verified locally |
| Read-only inventory contract | Verified with deterministic route tests |
| Download/staging implementation | Present and gated |
| Recording/transcript pair worker | Verified locally |
| Idempotency and hashing | Verified locally |
| Source-asset schema contract | Present and validated |
| Identity/review handoff | Present and validated |
| Structured analysis handoff | Present and validated |
| Live Webex token | Not inspected or configured by this run |
| Live account inventory | Not claimed |
| Real media transfer | Not performed |
| Staging schema application | Not performed |
| Production operation | Not authorized and not performed |

## Fable design requirements for this pipeline

Fable should represent the lifecycle visibly and without collapsing distinct states:

`discovered -> trigger-allowed -> downloaded -> pair-complete -> imported -> identity-review -> attached -> analyzed -> human-reviewed -> student-approved`

The UX must show:

- immutable source provenance;
- trigger and ignore reason;
- pair completeness/stability;
- student-resolution and roster-confidence state;
- human approval actor/time;
- prompt/model/version;
- evidence references;
- mentor-only versus student-approved output;
- retry/failure state without duplicate import.

## Conclusion

The Webex/media pipeline is a safe, review-gated engineering foundation with deliberate external-system isolation. It is ready for Fable to redesign as a comprehensible operational lifecycle and for Codex to refine under later scoped tickets. It is not a live integration certificate, and nothing in this report authorizes credentials, production data, media movement, watcher operation, deployment, or shared-system mutation.
