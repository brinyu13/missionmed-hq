# B1-507A Provider and Privacy Readiness

Date: 2026-07-29

## Verdict

The provider boundary and exact model pair are implemented. StoryForge provider readiness is not complete: no StoryForge-scoped OpenAI project/key is verified, no production provider call has been made, the human medical/accent corpus does not exist, and MissionMed’s organization-level contractual/privacy posture has not been evidenced for this workload.

## Binding provider definition

- Provider mode: `openai` only after activation; otherwise `none`.
- Primary model: `gpt-4o-transcribe`.
- Fallback model: `whisper-1`.
- Endpoint: `/v1/audio/transcriptions`.
- Client-visible branding: none; the product is StoryForge.
- Adapter: `storyforge-v5/server/transcription/adapter.mjs`.
- Driver: `storyforge-v5/server/transcription/openai-gpt-4o-transcribe.mjs`.
- Timeout: 30 seconds per provider request.
- The fallback is bounded and observable; it is not silent model drift.

B1-504B’s older `gpt-transcribe` wording is superseded by B1-506A and the current source.

## RP-7

**Definition:** provider-account, project, key, privacy, model, and human-corpus bakeoff evidence required before StoryForge sends production voice traffic.

**Why it exists:** repository tests use fakes and cannot establish medical terminology accuracy, accent fairness, latency, cost, contractual posture, or real account capacity.

**Completed evidence:**

- OpenAI platform session is authenticated.
- The organization is currently labeled Personal.
- Only the Default project was observed.
- Six active keys exist, all with broad permissions in the Default project; none is StoryForge-scoped.
- A separate `missionmed-video-transcription` key exists and must not be reused as StoryForge authority.
- API call logging is “Enabled per call.”
- Organization audit logging is not enabled.
- OpenAI states API data is not used for training by default, and the transcription endpoint may be zero-data-retention eligible; this does not prove MissionMed’s actual organization/project contractual posture.

**Missing evidence:**

- StoryForge-specific project and least-privilege key.
- Confirmed billing/capacity/limits for that project.
- MissionMed BAA/Healthcare Addendum and actual ZDR/retention configuration as required by the governing privacy decision.
- Approved human corpus and secured corpus location.
- Real primary/fallback calls and full bakeoff report.
- Production secret custody and rotation receipt.

**Launch status:** RP-7 is a real voice-activation blocker, not merely documentation. It can be completed during a final production megarun if the Founder can complete any account/MFA/contract action and the human corpus already exists. The corpus cannot be invented autonomously.

## Human bakeoff

Binding minimum:

- 40 scripted medical passages.
- At least six accent groups.
- Three runs.
- Word error rate no worse than 12% and no worse than the baseline.
- Medical-term recall at least 92% and at least ten percentage points above baseline where specified.
- Medical substitution rate no worse than 3%.
- Accent-group degradation no greater than eight percentage points.
- First-text p95 no greater than ten seconds.
- Finalization p95 no greater than eight seconds.
- Failure rate below 1% after one retry.
- Cost no greater than $0.01 per minute.

Synthetic voices cannot replace the required human accent/medical corpus. The present corpus location is unavailable because the corpus has not been evidenced as existing.

## Privacy and retention requirements

- No public audio objects.
- No storage credentials in browser code.
- Provider requests carry the minimum audio/content needed for transcription.
- Provider/project logging and retention must match the Founder-approved privacy posture.
- Patient identifiers must be addressed in the first-recording notice and operating policy.
- Original audio and transcript retention must follow FG-1 and the approved lifecycle.
- Audit logs must exclude raw audio, transcripts, tokens, secret values, and signed URLs.
- Temporary uploads, failed sessions, account closure, story deletion, and explicit audio deletion must have evidence-backed cleanup.
- Students must be able to understand recording state, retention, and failure without provider jargon.

## Required secret/configuration names

No values are recorded in this dossier.

- `STORYFORGE_TRANSCRIBE_PROVIDER`
- `OPENAI_API_KEY`
- `STORYFORGE_TRANSCRIBE_PRIMARY_MODEL`
- `STORYFORGE_TRANSCRIBE_FALLBACK_MODEL`
- project/account identifiers held in the deployment secret manager as operational metadata, not client configuration

Production must remain `STORYFORGE_TRANSCRIBE_PROVIDER=none` until RP-7, R2, gateway, assembly, migrations, and acceptance gates pass.

## Computer Use feasibility

Computer Use can:

- create or inspect a dedicated OpenAI project, subject to current permissions/MFA;
- create a scoped key and place it in the authorized secret manager without echoing it;
- inspect logging/retention settings;
- execute test calls through the approved harness;
- collect usage/latency receipts.

Computer Use cannot:

- manufacture a signed BAA/Healthcare Addendum;
- invent Founder privacy policy;
- generate a qualifying human corpus;
- decide that a Personal organization is acceptable for medical-student production data.

Those require Founder/legal/privacy inputs, after which Codex can execute the technical steps.
