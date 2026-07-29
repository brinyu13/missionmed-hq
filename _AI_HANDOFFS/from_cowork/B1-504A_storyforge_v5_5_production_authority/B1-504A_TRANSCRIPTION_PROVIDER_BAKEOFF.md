# B1-504A · Transcription Provider Bake-off

Labels: [VERIFIED] checked this run · [RECOMMENDED] · [CODEX] Codex requirement · [GATE] founder approval. Web facts cited to official documentation retrieved 2026-07-28.

## 1. The incumbent, located and characterized [VERIFIED at source level]

Readiness-ladder note (per the Authority Lock convention): everything in this section is verified at L1, present in source, by direct inspection this run. Whether the hq runtime currently deployed matches this source, whether `OPENAI_API_KEY` is present in the hq production environment (the mock fallback fires without it), and whether the DBOC transcription path is exercised end-to-end in production today are separate facts that Codex must capture as evidence during the bake-off, not assume [CODEX].

`MissionMed/missionmed-hq/server.mjs`, `transcribeDbocAudio()` (Drills / Daily Rounds "DBOC" flow, job queue at `/api/dboc/transcribe`):

- Provider: OpenAI, `POST https://api.openai.com/v1/audio/transcriptions`, `model: 'whisper-1'`, multipart file upload (`audio/mp4`), Bearer `OPENAI_API_KEY` (fallback `MMHQ_OPENAI_API_KEY`).
- Behavior: batch only, complete file in, text out; 30 s abort timeout; mock-transcript fallback when the key is absent; safe-mode mock on error (`DBOC_TRANSCRIBE_SAFE_MODE`).
- No `prompt`, no keywords, no interim results, no confidence surfaced, no diarization.
- Adjacent evidence: `MissionMed/VIDEO_SYSTEM/transcripts/` holds a real transcript corpus of MissionMed sessions (Dr. J drills with multiple international-accented student speakers), including whisper-produced case files. This is directly reusable evaluation material (Section 5).

Assessment: the incumbent proves the OpenAI account and the pattern, and is a legitimate fallback provider. It cannot satisfy V5.5 as-is: no near-live path, no medical-vocabulary boosting, and mock fallbacks would violate the StoryForge no-fake-audio-success contract [VERIFIED: worktree AGENTS.md forbids fake AI or audio success]. The StoryForge adapter must fail closed and truthfully, never mock.

Decision on the five options the founder listed: wrap and upgrade. The Drills pipeline is used as one bake-off candidate and as the configured fallback provider behind a StoryForge-owned adapter; it is not reused unchanged, not replaced blindly, and StoryForge does not call `missionmed-hq` code paths at runtime (no new coupling between services). [RECOMMENDED]

## 2. Candidate set [RECOMMENDED, current official documentation]

All OpenAI facts from developers.openai.com (models, speech-to-text guide, realtime-transcription guide, pricing), retrieved 2026-07-28.

| Candidate | Mode | Medical-term support | Interim behavior | Price | Role in bake-off |
|---|---|---|---|---|---|
| C1 `whisper-1` (incumbent) | batch | `prompt` only (last 224 tokens) | none | $0.006/min | baseline; fallback provider |
| C2 `gpt-transcribe` | batch per segment; `stream=true` text deltas | `prompt` + `keywords` + `languages` (documented for acronyms and literal terms) | segment-level finals; deltas during processing | $0.0045/min | recommended primary |
| C3 `gpt-live-transcribe` via Realtime API | true streaming, WebSocket (server-side pipelines documented), PCM16 24 kHz | `prompt` + `keywords` + `delay` tuning | `...transcription.delta` then `.completed` per committed turn | $0.017/min | OPTIONAL and deferrable: benchmark only if C2 misses the latency thresholds. Building the Realtime WS/PCM driver solely to benchmark a not-required-for-cutover path is out of the time-box otherwise |
| C4 Deepgram `nova-3-medical` (optional external benchmark) | batch + WS streaming | Keyterm Prompting, up to 100 terms; medical-tuned model | `interim_results` with `is_final` | streaming nova-3 from $0.0048/min (medical price not published on the pricing page) | comparison only; adopting it means a NEW VENDOR [GATE] |

Notes with sources retained in the research record: OpenAI accepts webm/m4a/wav directly for batch (25 MB per request, chunk larger); Realtime requires PCM16 24k mono; Deepgram and AssemblyAI both publish BAA availability statements, OpenAI signs BAAs per its enterprise-privacy page (no compliance claim is made here; see Storage doc Section 8). AssemblyAI (Universal-3.5 Pro, streaming medical mode) is noted for completeness and may be added to the bake-off only if C1 to C3 all miss the medical-term threshold, to keep Phase 1 from becoming a vendor survey.

Anthropic offers no speech-to-text API; it plays no role in Phase 1. The two vendors are not forced into one release. [VERIFIED against Anthropic's product surface; role separation per founder instruction.]

## 3. Adapter contract (the product never sees a vendor)

`server/transcription/adapter.mjs` [CODEX implement]:

- `transcribeSegment({ buffer, mimeType, keywords, promptTail, languageHint }) -> { text, words?, confidence?, providerId, modelId, latencyMs }`
- `capabilities() -> { streaming: bool, keywords: bool, confidence: bool }`
- Provider drivers: `openai-gpt-transcribe.mjs`, `openai-whisper1.mjs` (fallback), optional `openai-realtime.mjs` (upgrade path), each selected by `STORYFORGE_TRANSCRIBE_PROVIDER` with automatic failover order `primary -> fallback` on hard provider errors (never on empty speech).
- Hard rules: no vendor or model name in any user-facing string [AUTHORITY]; no mock output ever; provider errors surface as the truthful "unable to transcribe right now" state with retry; the audio and the student's words never enter logs (Observability rules, Acceptance doc).
- StoryForge gets its own scoped OpenAI API key (`STORYFORGE_OPENAI_API_KEY`), separate from the hq key, so usage, limits, and revocation are independent [RECOMMENDED; CODEX provision].

## 4. Metrics and acceptance thresholds

Measured per candidate on the corpus (Section 5), on the production account, from the production region:

| Metric | Definition | PASS threshold (cutover) |
|---|---|---|
| WER overall | word error rate vs reference | <= 12% and <= C1 baseline |
| Medical-term recall | share of corpus medical terms transcribed exactly (post keywords) | >= 92%, and >= C1 + 10 points |
| Medical-term substitution rate | medical term replaced by a wrong word | <= 3% |
| Accent robustness | max WER degradation across the corpus accent groups vs corpus mean | <= 8 points |
| Interim-to-final stability | for streaming candidates: share of interim words unchanged in final | report only (no gate; batch path has stable finals by construction) |
| Punctuation/segmentation | subjective 1 to 5 rubric, two graders, blinded | >= 4.0 |
| Latency: first text | speech start to first merged text (segment path) | p95 <= 10 s |
| Latency: stable final | stop to final full transcript | p95 <= 8 s |
| Failure rate | provider 5xx/timeout per 100 segment calls, with retry | < 1% after one retry |
| Cost per recording minute | provider list price + measured overhead | <= $0.01/min at cutover scope |
| Operational complexity | new infrastructure required (0 = none) | prefer lowest; realtime path scores its WS burden honestly |

Cutover rule: C2 must PASS all gated thresholds to become primary. If C2 fails only medical-term thresholds, retest with an enriched keywords list once; if it still fails, escalate with C4 evidence and the new-vendor gate to the founder. C1 remains the wired fallback regardless.

## 5. Evaluation corpus [CODEX build; privacy-safe by construction]

No real student data. Sources:

1. Scripted read corpus (new recordings by consenting adults on the team or synthetic TTS where accents are unavailable): 40 passages, 30 to 90 s each, written to be dense in: common medical words; specialty terminology (at minimum: internal medicine, EM, OB-GYN, surgery, pediatrics, psychiatry); medication names (including enoxaparin, metoprolol, Lasix, troponin-adjacent lab context); procedure names (including Whipple, paracentesis, anastomosis); abbreviations spoken naturally (CBC, NSTEMI, PEA, OR, ICU); numbers and lab values (creatinine 2.1, hemoglobin dropped two grams, 3/6 systolic murmur).
2. Accent coverage: recordings by speakers representative of the MissionMed population (South Asian, West African, East Asian, Latin American, Middle Eastern, and North American English at minimum). PEOPLE DEPENDENCY, surfaced explicitly: Codex cannot record human speakers; the founder/team schedules the consenting readers, and this is listed as a founder-side dependency in the Combined Handoff Section 10. Where a group has no available speaker, the existing VIDEO_SYSTEM corpus [VERIFIED it exists] may supply supplemental accented material with hand-corrected references and a recorded consent basis; unclear consent means exclude and note the gap. Synthetic TTS may fill vocabulary-coverage rows only and is EXCLUDED from accent-robustness scoring (TTS biases ASR evaluation).
3. Conditions: quiet room; ordinary laptop microphone; phone microphone (real iPhone and Android captures via the actual product capture path); realistic background noise (ward-like ambience mixed at low SNR); one whisper-quiet take per accent group.
4. References: human-verified ground-truth transcripts, stored with the corpus in the repository evidence folder, hashed.

Reference vocabulary doubles as the seed for the production medical lexicon (Blueprint Section 6).

## 6. Bake-off procedure [CODEX]

1. Freeze corpus + references; hash the set.
2. Run every candidate through the real adapter code path (not ad-hoc scripts) with production-equivalent configuration; three runs per candidate; record raw outputs, latencies, and costs.
3. Score with a deterministic scorer committed to the repo (WER via standard normalization; medical-term scoring against the tagged vocabulary list).
4. Produce `BAKEOFF_DECISION_RECORD.md` with per-metric tables, threshold verdicts, the cutover decision, and every raw artifact archived under the B1-504A evidence folder.
5. Wire the chosen primary + fallback into configuration; re-run the acceptance subset once on the wired configuration.

Time-box: one focused day for candidate runs, scoring, and the decision record. Corpus creation (which includes the founder/team-scheduled human recordings) sits outside the time-box and can proceed in parallel with build stages. The bake-off gates cohort activation, not building (sequence in the Acceptance doc).

## 7. Research record (provider facts, official sources, retrieved 2026-07-28)

OpenAI models and STT guide: https://developers.openai.com/api/docs/models · https://developers.openai.com/api/docs/guides/speech-to-text · Realtime transcription: https://developers.openai.com/api/docs/guides/realtime-transcription · Pricing: https://developers.openai.com/api/docs/pricing · Enterprise privacy/BAA and API training-use posture: https://openai.com/enterprise-privacy/ · Deepgram models: https://developers.deepgram.com/docs/models-languages-overview · Keyterm prompting: https://developers.deepgram.com/docs/keyterm · Interim results: https://developers.deepgram.com/docs/interim-results · Pricing: https://deepgram.com/pricing · AssemblyAI pricing/models: https://www.assemblyai.com/pricing · Streaming: https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio · Medical mode: https://www.assemblyai.com/docs/streaming/medical-mode · Data controls/BAA: https://www.assemblyai.com/docs/data-controls
Codex re-verifies model availability and prices against these sources at run time (R-3); prices and model names in this document are the retrieved-date snapshot, not permanent facts.
