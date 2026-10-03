# IIQ recording orchestration evidence and wiring

Source-only implementation. No production DDL, actual R2 or OpenAI call, secret lookup, provider spend, or real microphone acceptance occurred in this work.

## Factories

`createPrivateAudioStorage({endpoint,region,bucket,accessKeyId,secretAccessKey,prefix})` in `server/storage.mjs` is asynchronous and loads `@aws-sdk/client-s3`. Endpoint must be the approved HTTPS R2 endpoint. A dedicated explicit InterviewIQ bucket and prefix are required; no StoryForge defaults. Keys include exact owner/session/segment identity. Objects use conditional immutable puts, SHA/size/type validation, private no-store metadata and bounded server-only reads. No signed/public URL is returned.

`createPostgresRecordingStore({database,limits?,clock?})` in `server/recordings.mjs` uses `database.withActor`, least-privilege runtime RLS and short transactions. `createRecordingTranscription({apiKey,fetchImpl?,timeoutMs?})` composes the copied fixed `gpt-4o-transcribe` primary and `whisper-1` fallback drivers. Hard authentication/format failures do not trigger fallback. No invented transcript is returned when unavailable.

`createRecordingsService({store,storage,transcription,bootstrap,clock?})` returns:

- `available` (actual configured storage and transcription dependencies)
- `create(actor,{interviewId,requestId,mimeType})`
- `segment(actor,recordingId,{segmentId,seq,contentType,audioBase64,durationMs},{revalidateActor})`
- `status(actor,recordingId)`
- `action(actor,recordingId,'pause'|'resume'|'finish'|'cancel'|'retry',{requestId},{revalidateActor})`

Root's HTTP router must pass `revalidateActor: () => authorize(request, 'POST '+actualApiPath)`. It is called before provider work, between primary/fallback and before transcript commit. Identity mismatch, revoked/expired session, inactive interview, changed occurrence, abandoned recording or superseded chunk fence prevents transcript commit. No positive authorization cache or background impersonation is used. Without a callback, an in-request actor context older than fifteen seconds fails closed before provider use.

Response: `{recordingId,status,mimeType,nextSeq,segments:[{id,seq,text,status,recordingId,attempts,error}],bootstrap}` plus `segment` and transient `transcription` metadata on segment completion. Status reads include canonical bootstrap for recovery. No object key, bucket, credential, raw audio or claim-fencing token is exposed. `speech.recordingId` in bootstrap lets the UI recover the same session, sequence and original MIME format after reload.

## Durability and bounds

Metadata reserves before storage upload and before any provider call. The immutable object is written outside the transaction. Provider claims use `recording_chunks.version` as a fence. Another process may recover a claim stale for 90 seconds; an older provider response cannot commit after recovery. At most three claims per chunk are allowed. Successful segments append immutable raw provider text to `speech_segments`; no operation updates `debriefs.edited_text`.

A metadata-only pending row can exist if the object upload fails. Resending the same segment ID and bytes is safe; different bytes/timing/sequence conflict. If the browser closes before failed audio uploads, that unuploaded audio can be lost: the UI keeps pending audio in memory, not IndexedDB. Already uploaded segments survive service/browser restart and can be retried through the durable status/recording API.

Default resource ceilings: decoded chunk 1 MiB, declared chunk duration 30 seconds, recording 20 minutes/300 segments/50 MiB, daily account capture 60 minutes (each chunk counts at least four seconds). These are protective technical limits, not a commercial access policy or permission for provider spend. The gateway needs a 1.5 MiB JSON segment body ceiling. Each browser chunk starts a fresh MediaRecorder container; continuation-only bytes are rejected. Cancel marks the session abandoned and fences provider results; it does not claim deletion of historical private raw text.

Provider confidence/flag metadata is returned on the immediate segment response only; the frozen schema has no persistent confidence column. Reloaded transcript retains exact stored text/provider/model, not transient confidence details. Provider content does not enter operational audit metadata.

## Donor custody

Read-only donor `/Users/brianb/MissionMed_worktrees/b1-storyforge-5021-ivoc-projection`, HEAD `3cffc77f84dd48cec956fec72ec80a2487357dba`, `storyforge-v5/server/recordings.mjs`, `server/storage.mjs`, transcription drivers and orchestration tests. IIQ ports use isolated tables/storage and preserve actor checks, independent containers, immutable provider text and retries. The donor's network call inside an open database transaction was not carried forward; IIQ uses committed metadata plus fenced claims around outside-transaction provider/storage work. Existing copied transcription drivers remain untouched.

## Tests

- `node --test interviewiq/tests/recordings/*.test.mjs`: **19/19 pass**, controlled provider/storage/device inputs. Covers identity, duplicate/different replay, raw/edited separation, size/base64/container checks, interrupted/cancelled/expired contexts, provider outage/retry, safe primary/fallback, private immutable object scope and no public URLs.
- `bash interviewiq/scripts/run-postgres-tests.sh --keep` creates a new disposable Unix-socket PostgreSQL 18 database. Pass its exact returned `/tmp/iiq-pg18.*/connection.json` through `IIQ_RECORDING_TEST_CONNECTION` to `node interviewiq/tests/recordings/postgres.mjs`.
- Recording integration: **21/21 real-PostgreSQL assertions pass**, with object storage and provider doubles. Covers owner/current-occurrence gating, session replay, cross-role denials, immutable raw text, sequence gaps, pause/resume, durable pending metadata, concurrent claim winner, stale fence recovery, finish idempotency and cancellation. Earlier retained harness also passed 7 migration +115 baseline security assertions; a newer DB candidate has additional checks owned by its author.
- Tests cannot establish actual R2 confidentiality/configuration, provider transcription quality/latency, WordPress browser session behavior, device capture quality, deployment or Founder acceptance. Those remain separate production gates.
