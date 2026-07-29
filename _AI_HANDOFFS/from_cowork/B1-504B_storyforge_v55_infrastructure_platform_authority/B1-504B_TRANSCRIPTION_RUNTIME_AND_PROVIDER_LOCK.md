# B1-504B · Transcription Runtime and Provider Lock

Labels and ladder per the Infrastructure Authority Lock.

## 1. Incumbent reconciliation (VST, line-verified this run)

`missionmed-hq/server.mjs` `transcribeDbocAudio()`: OpenAI `POST https://api.openai.com/v1/audio/transcriptions`, `model: whisper-1`, multipart complete-file, 30 s abort, key `OPENAI_API_KEY` / `MMHQ_OPENAI_API_KEY`, MOCK transcript when the key is absent, safe-mode MOCK on error. Runtime/config status of the hq pipeline itself: UNKNOWN beyond source (captured during RP-7/RP-11 as context evidence only).
Binding consequences (AA): StoryForge never calls hq code; StoryForge never mocks (mock output in production StoryForge is forbidden; failures surface truthfully); whisper-1 is the incumbent baseline and the wired FALLBACK model behind the StoryForge adapter; StoryForge uses its own scoped key `STORYFORGE_OPENAI_API_KEY` owned by the Railway API service.

## 2. Provider lock (AA, with the bake-off as a gate, not a choice)

- Primary: OpenAI `gpt-transcribe` (batch per segment; `prompt` + `keywords` + `languages` parameters; accepts webm/m4a/wav; 25 MB/request; pricing snapshot $0.0045/min retrieved 2026-07-28; re-verified at RP-7).
- Fallback: OpenAI `whisper-1` (batch; `prompt` tail only).
- Anthropic: no transcription product; no Phase 1 role (VST/vendor surface). New vendors (Deepgram, AssemblyAI, any other): FOUNDER GATE; the bake-off may cite their published capabilities but may not call their APIs without that gate.
- RP-11 (bake-off) is the activation gate. Thresholds: WER <= 12% and <= baseline; medical-term recall >= 92% and >= baseline + 10; substitution <= 3%; accent degradation <= 8 points; first-text p95 <= 10 s; final p95 <= 8 s; failure < 1% after one retry; cost <= $0.01/min. SINGLE OUTCOME TABLE, keyed by which gate class misses (no Codex judgment, no contradictory branches):

| Miss class (after `gpt-transcribe` full run) | Deterministic outcome |
|---|---|
| No misses | `gpt-transcribe` primary; `whisper-1` fallback; proceed |
| Medical/accuracy gates only (WER, recall, substitution, accent) | One keywords-enrichment retest. Still missing: `whisper-1` becomes launch primary ONLY IF whisper-1 itself passes the accuracy gates; otherwise activation BLOCKED and FG-3 (new vendor) goes to the founder with the C4 evidence. |
| Latency gates only (first-text or final p95) | Activation BLOCKED for the batch path. The Realtime lane is PRE-AUTHORIZED for exactly this outcome: build the `openai-realtime` driver (`gpt-live-transcribe`, WS, PCM16), re-run the latency gates. Still missing: activation BLOCKED, founder decision. `whisper-1` never becomes primary on a latency miss (a slower batch model cannot cure latency). |
| Reliability or cost gates | Activation BLOCKED; evidence to Fable (config or provider-side causes are facts, not architecture). |

## 3. Adapter contract (AA; module `storyforge-v5/server/transcription/`)

Files: `adapter.mjs` (selection, failover, taxonomy), `openai-gpt-transcribe.mjs`, `openai-whisper1.mjs`, `lexicon.mjs` (versioned medical lexicon + fuzzy matcher), `keywords.mjs` (lexicon + draft-title term injection).

`transcribeSegment({ buffer, mimeType, seq, keywords, promptTail, languageHint }) ->`
`{ text, words?, confidence?, flaggedTerms, providerId, modelId, latencyMs }`
plus `capabilities() -> { keywords: bool, confidence: bool }`.

Request behavior (binding): multipart file upload named `seg-{seq}.{ext}`; `model` per driver; `prompt` = last 200 characters of the previous segment's final text (context continuity); `keywords` = medical lexicon terms + tokenized draft title (gpt-transcribe driver only; whisper-1 driver folds top terms into the prompt tail); `language` = `en` unless the session carries an explicit hint; timeout 30 s with AbortController (house pattern); retry: one immediate retry on 5xx/timeout, then `transcribe_failed` with `retry_count` incremented; segment retries via E6 capped at 3; backoff 2 s then 8 s; rate limiting: at most 2 concurrent provider calls per session, queue FIFO; idempotency: a segment in `transcribed` state is never re-submitted.
Failover: primary hard-fails (auth error, 4xx model error, 3 consecutive 5xx across segments) -> adapter switches the SESSION to fallback and audits `provider_failover`; empty-speech results are NOT failures.
Confidence: if RP-7 evidence shows usable confidence/logprobs from the primary, low-confidence spans feed `flaggedTerms` source 1; otherwise `flaggedTerms` comes from the lexicon pass only; absent both, no chips (never invented uncertainty; carried conformance law).
Error taxonomy (returned upward, never vendor-branded): `transcribe_unavailable`, `transcribe_timeout`, `transcribe_rejected_format`, `transcribe_failed_permanent`. User copy for each is fixed in the Frontend Map (truthful states; typing always available; "record now, transcribe later" via E6 retry from review).
Provider outage: both drivers failing -> session continues recording and uploading; dock shows the truthful cannot-transcribe state; transcript arrives later via retry. Format routing: a segment whose mimeType the primary rejects (`audio/ogg` edge) routes directly to the fallback driver rather than surfacing `transcribe_rejected_format` to the student. Kill-switch interaction, stated precisely: while `STORYFORGE_VOICE_FORCE_OFF=1` is set, E6 retries are refused like every voice endpoint, so untranscribed uploaded segments WAIT, intact, and become retryable the moment the kill lifts; the kill never deletes or strands data permanently.

## 4. Privacy and data handling (binding; evidence duties)

Audio leaves MissionMed only to the locked provider. RP-12 captures, from current official OpenAI policy pages at run time: API training-use posture, retention window, ZDR/BAA availability; evidence filed; a material conflict with the approved retention policy stops the release lane (carried rule). No transcript text, audio bytes, names, tokens, or signed URLs in logs, audits, metrics, or error reports. The consent notice discloses processing by "MissionMed's transcription service" (PA strings; no vendor names anywhere user-facing).

## 5. Segmentation runtime (AA; carried and pinned)

`segmentPlanMs = [4000, 15000]` (4 s opener, 15 s steady state; boundaries also at pause and stop); segment-scoped MediaRecorder instances; per-segment `isTypeSupported` selection in the fixed order `audio/webm;codecs=opus`, `audio/mp4`, `audio/webm`, `audio/ogg`; overlap-merge of finalized text (prototype algorithm is the authority); interim ghost line; poll cadence 2 s (E3); duplicate prevention is the overlap-merge plus segment idempotency; punctuation and casing come from the provider (no post-processing in Phase 1).

## 6. Cost guardrails

Per-student daily ceiling 60 recording minutes (env `STORYFORGE_VOICE_DAILY_MINUTES`); cohort-scale forecast at primary pricing recorded in evidence at RP-11; alert at 3x forecast (Observability Runbook). Secrets: `STORYFORGE_OPENAI_API_KEY` in Railway only; never client-side; never in WP; scan-secrets gate must pass.
