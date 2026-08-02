AVATAR ADAPTER READY — PROVIDER BLOCKED

# Y1-Y2-CAM-V6-3402 complete combined handoff

Generated: 2026-08-02T19:44:07Z

## Inherited authority and isolation

- Accepted predecessor: Y1-Y2-CAM-V6-3401 commit `9b5f99006f4d2d089e381b13101e30928ba86c00` and tag `y1-y2-cam-v6-3401-ai-voice-ready-v2`.
- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3402`.
- Branch: `codex/y1-y2-cam-v6-3402-live-avatar-founder-alpha`.
- Immutable inherited rollback tag: `y1-y2-cam-v6-3402-inherited-3401`.
- Accepted Fable baseline remains byte-for-byte unchanged at SHA-256 `3053cf7747a1c27c3ca77ec669849b437f4e2d2d00a754c4cff89ecd5dffd5d4`.
- Canonical MissionMed, Kinsta, Matrix, the donor POC, and unrelated worktrees were not modified.
- Allowed paths: `ivprep-v6/**` and this 3402 handoff directory.

## Provider and identity truth

- Visual provider: LiveAvatar, LITE mode only.
- Verified stock visual: `Dexter Doctor Sitting`.
- Exact verified visual avatar ID: `bd43ce31-7425-4379-8407-60f029548e61`.
- The founder-supplied `a33a57ab-8388-49fc-a069-dbcfd1bc5405` is not a visual avatar ID. Authenticated LiveAvatar UI verifies it as voice `W. Clint Oxley`.
- `Dr Bastos` is a LiveAvatar Voice Agent, not a custom visual avatar.
- Dr Bastos Voice Agent ID: `dfa595da-e6a8-4a84-b155-a2da830c4e67`.
- Dr Bastos context ID: `4ff68f63-bf6e-4bcc-8d8d-64506c34d90d`.
- Authenticated provider UI showed zero custom avatars and no API key configured.
- No API key, session token, agent token, cookie, nonce, or browser storage was exposed or retained.

## Exact avatar architecture

The locked canonical flow is preserved:

`student answer -> gpt-5.6-terra Responses interviewer -> completed natural utterance -> OpenAI Speech cedar PCM16/24 kHz -> LiveAvatarProvider LITE speak stream -> LiveKit synchronized video/audio -> separate gpt-5.6-luna instructor observer record`

LiveAvatar does not own intelligence, conversation memory, MissionMed context, pedagogy, voice choice, evidence, results, persistence, or entitlement. Dr Bastos's provider-managed Voice Agent is recorded as truthful provider evidence but is not connected to the canonical flow.

Implemented provider boundary:

- `createSession`
- `start`
- `enqueueAudio` / `attachAudioStream`
- `interrupt`
- `stop`
- `reconnect`
- `health`
- `usage`
- `close`

The server creates and owns provider sessions. The browser receives only the scoped LiveKit client token required to join the media room. PCM is chunked to 48,000-byte packets under request/provider limits, shares one utterance event ID, and waits for the provider's real speech-ended event before yielding the floor. Stop, failure, reconnect, emergency disable, exit, and close paths clean up provider sessions. LiveKit CSP access requires one exact configured signaling origin; wildcards are rejected.

## Founder Alpha product integration

- Existing V6 screens and flow are preserved.
- The room mounts real subscribed LiveKit video/audio tracks in the existing interviewer tile only after a verified media connection.
- Missing provider authorization produces an explicit avatar-unavailable state and continues with the same intelligence and OpenAI voice; no fake video is substituted.
- Avatar on/off, mute, interruption, end, and abandonment controls are present.
- Founder diagnostics show model, voice, avatar state, latency, round trip, stream state, and provider health; normal student mode hides them.
- Founder Faculty Roster contains all 16 requested categories.
- Only the verified Dexter visual record can become available, and only when both OpenAI and LiveAvatar server configuration are present. All other records truthfully display Coming Later or Custom Avatar Required.
- Indian faculty placeholders do not fabricate an accent. Doc Hollywood placeholders are non-explicit and make no superiority claim.
- Surprise Me selects only eligible, available, specialty-compatible, licensed alpha records and discloses the assignment shortly before launch without exposing future questions.

## Exact defaults

- Architecture: Responses + OpenAI Speech.
- Interviewer model: `gpt-5.6-terra`.
- Observer model: `gpt-5.6-luna`.
- Speech model: `gpt-4o-mini-tts`.
- Canonical OpenAI Speech voice: `cedar`.
- Verified but not canonical LiveAvatar voice: `W. Clint Oxley`, ID `a33a57ab-8388-49fc-a069-dbcfd1bc5405`.
- Visual avatar: `Dexter Doctor Sitting`, ID `bd43ce31-7425-4379-8407-60f029548e61`.

## Persistence and usage truth

- Durable isolated-alpha adapter: atomic JSON store at ignored `ivprep-v6/.alpha-data/sessions.json`, mode 0600.
- Stored: session/test identity, selected interviewer, model, voice, avatar, behavior, transcript, instructor record, termination state, timestamps, usage metadata, and only real replay/media references.
- Browser evidence created two completed local sessions. After a real server stop/start, both sessions, both transcripts, both instructor records, both termination states, and both usage entries remained present.
- One active session per test identity is enforced.
- Default duration is 15 minutes; hard maximum is 20 minutes.
- LiveAvatar also receives a server-owned 1,200-second maximum.
- Emergency disable returned 200, a new start failed closed with 503 `alpha_disabled`, and re-enable returned 200.
- Commercial minute limits, threshold warnings, overrides, and top-up interfaces remain inactive; billing is not implemented.

## Environment and secret boundary

- `OPENAI_API_KEY` was present in the inherited server process and was used successfully; it is not stored in Git.
- `LIVEAVATAR_API_KEY` was absent.
- Ignored `.env.local` loading never overrides parent-process variables and never prints values.
- `npm run probe:liveavatar-origin` is ready. Once authorized, it starts and closes one bounded LITE session and prints only the exact LiveKit origin needed for CSP configuration.
- API requests are loopback-only, same-origin, JSON-only for POST, bounded, rate-limited, and provider-concurrency-limited.
- Founder request headers in this local proof are capability gates, not identity authentication. This is not safe online auth.

## Files changed

- `ivprep-v6/.env.template`
- `ivprep-v6/.gitignore`
- `ivprep-v6/ALLOWED_PATHS.txt`
- `ivprep-v6/README.md`
- `ivprep-v6/config/faculty-roster.mjs`
- `ivprep-v6/config/load-environment.mjs`
- `ivprep-v6/config/voices.mjs`
- `ivprep-v6/package.json`
- `ivprep-v6/package-lock.json`
- `ivprep-v6/persistence/alpha-store.mjs`
- `ivprep-v6/providers/avatar-provider.mjs`
- `ivprep-v6/providers/liveavatar-provider.mjs`
- `ivprep-v6/public/avatar-provider.mjs`
- `ivprep-v6/public/v6-integration.mjs`
- `ivprep-v6/scripts/probe-liveavatar-origin.mjs`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/test/avatar-provider.test.mjs`
- `ivprep-v6/test/environment-loader.test.mjs`
- `ivprep-v6/test/faculty-persistence.test.mjs`
- `ivprep-v6/test/liveavatar-provider.test.mjs`
- `ivprep-v6/test/provider-config.test.mjs`
- `ivprep-v6/test/server-alpha-control.test.mjs`

## Verification evidence

- `npm run check`: PASS.
- `npm test`: 49/49 PASS, 0 failed.
- Production dependency audit: 0 known vulnerabilities across 15 dependencies.
- Expected unconfigured provider probe: failed closed without making a provider session and without exposing credentials.
- Secret scan: no credential value in source; the only token-shaped match is a deliberately fake unit-test fixture.
- Protected Fable baseline hash: unchanged.
- Local browser journey: PASS through student entry, Instant Interview, device permission failure, truthful SIM typed fallback, room entry, spoken OpenAI interviewer, contextual answer exchange, separate observer, voice-only avatar notice, end, self-rating, results, transcript, and instructor evidence.
- Browser-rendered exact evidence: interviewer question `Tell me about yourself.`, a completed applicant answer, generated next utterance `Your Step 2 score improved substantially from Step 1. What changed?`, observer action `PLAN_QUESTION`, exact model `gpt-5.6-terra`, exact voice `cedar`, provider `openai`.
- Replay truth: results showed `NO MEDIA`; no fake replay was offered.
- Microphone permission in the in-app browser was denied by the browser, and the visible recovery/typed path worked. Continuous microphone, five-second silence, natural pause, and barge-in contracts remain covered by inherited and retained automated tests.
- A genuinely live synchronized avatar was not observed and is not claimed.

## Launch command

```bash
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3402/ivprep-v6
npm install
npm start
```

Open `http://127.0.0.1:8343/`.

## Blocker and exact next action

Human-only blocker: the authenticated LiveAvatar account has no API key. The founder must use LiveAvatar's API Keys screen to create one, save it directly as `LIVEAVATAR_API_KEY` in ignored `ivprep-v6/.env.local`, and must not paste it into chat. Then run `npm run probe:liveavatar-origin`, save the returned origin as `LIVEAVATAR_LIVEKIT_ORIGIN`, restart, and run one real provider smoke. Provider billing or credit purchase is not authorized.

Exact 3403 continuation: branch only from the sealed 3402 commit/tag, read this handoff plus 3401 first, retain the local fail-closed behavior, run the remaining stress/security/private-preview audit, and deploy only to an existing authenticated founder/private-staging route with explicit routing authority. If that route or real auth remains unavailable, finish as local Founder Alpha and issue `NO-GO — PROVIDER/AUTH BLOCKER`; do not use a public tunnel or mutate Kinsta production.
