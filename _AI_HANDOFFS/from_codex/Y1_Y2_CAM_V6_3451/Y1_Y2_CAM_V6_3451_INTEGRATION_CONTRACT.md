# Y1-Y2-CAM-V6-3451 Integration Contract

## Purpose

This is the binding contract for future `Y1-Y2-CAM-V6-3440 — Unified Founder Alpha Integration & Reconciliation`. 3451 owns the accepted presentation and product journey. It does not own the already-proven AI, analytics, avatar, persistence, or provider implementations.

## Immutable custody inputs

| Lane | Accepted source | Accepted commit | Role in 3440 |
|---|---|---:|---|
| 3451 | `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3451` | final 3451 commit recorded at closeout | Presentation shell and product state orchestration |
| 3410 | `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3410` | `75c7d1a2cf96568f6520e7ca9af281c11e402104` | Continuous conversation, microphone, model/voice, observer, persistence, usage |
| 3420R | `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3420R` | `7ae4a8e42ea3f4edd80a8a7848ed5b8a14da2af1` | Browser-local observable analytics and safe projections |
| 3430 | `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3430` | `fcdf36af33a9a1eb507b0b9f1ad4f8bc17810b4f` | AvatarProvider, LiveAvatar lifecycle, audio sink, interruption contract |

Do not merge these branches wholesale. Create a new explicitly authorized 3440 integration worktree from an accepted baseline, then transplant only the contracts and files required by the mapping below.

## 3410 continuous-conversation contract

Preserve exactly:

- One long-lived same-origin server relay per alpha session.
- Exact model `gpt-realtime-2.1` as the accepted Founder default.
- PCM16 mono, 24 kHz input/output.
- `gpt-4o-mini-transcribe` input transcription.
- Semantic VAD with low eagerness, provider interruption, response cancellation, audio truncation, stale-event rejection, and explicit cleanup.
- OpenAI Realtime voice `cedar`, speed `0.92`, reasoning `low` as the current accepted rail configuration.
- Responses + Speech as an explicit user-selected fallback; never a silent substitution.
- Separate instructor-observer pass after a completed interviewer utterance.
- Server-owned 120-second beta cap, usage ledger, emergency disable, single active session per test identity, and durable alpha store.

### 3451 insertion points

- `#room-start`: create/start the existing 3410 alpha session and rail only after explicit user activation.
- `#room-mute`: delegate to the existing microphone/rail controller.
- `#room-type` and `#send-room-answer`: delegate to typed fallback without creating a second conversation.
- `#room-interrupt`: perform the existing response cancel/truncate sequence and stop current playback immediately.
- `#room-end`: close rail, provider, audio, microphone, avatar, persistence session, and timers idempotently.
- `#room-status`: consume normalized rail states only: ready, listening, thinking, interviewer speaking, muted, attention required, ended.
- `#room-prompt`: render only confirmed transcript/output events from the live rail.
- Results/Vault: render only durable events emitted by the accepted persistence/evidence adapters.

The 3451 simulated room timer and scripted replies must be removed when this adapter is active. There must be one audio output owner.

## 3420R analytics contract

Preserve 3420R's isolated event families and browser-local processing. The only student-safe validated fields at lane closeout were:

- `answer_duration_ms`
- `captured_level_dbfs`
- `digital_clipping_fraction`

Other experimental metrics remain Founder-only and bounded. Do not persist raw frames, raw audio, landmarks, or biometric templates. Do not add emotion, personality, deception, confidence, anxiety, accent-quality, eye-contact-quality, gesture-quality, posture, readiness, Match, or fit judgments.

### 3451 insertion points

- Results analysis drawer receives a safe projection derived from normalized completed-turn events.
- Room may display low-risk setup guidance only; it must not recreate the cluttered telemetry wall.
- Evidence timestamps must join on the 3410 durable session/turn identifiers, not browser clock guesses.

### Overlapping files requiring deliberate reconciliation

- `ivprep-v6/public/index.html`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/package.json`
- `ivprep-v6/package-lock.json`
- `ivprep-v6/README.md`

Do not select one branch's entire version of these files.

## 3430 avatar contract

Provider truth at accepted 3430 closeout:

- Visual target: Dexter Doctor Sitting
- Exact avatar ID: `bd43ce31-7425-4379-8407-60f029548e61`
- Preferred provider voice display: W. Clint Oxley
- Exact provider voice ID: `a33a57ab-8388-49fc-a069-dbcfd1bc5405`
- LITE supplied-PCM transport was implemented and offline-tested.
- A real LiveAvatar session was not accepted because the provider returned `4033 Insufficient credits for session`.
- In LITE supplied-PCM mode, the audible voice remains OpenAI `cedar`; W. Clint is metadata-only until a provider mode that actually selects it is verified.

### Output sink

Use one normalized stream contract:

```text
{
  eventId,
  pcm16,
  sampleRateHz: 24000,
  channels: 1,
  final
}
```

The avatar is a replaceable visual-performance sink. It must not own interviewer intelligence, context, prompt, model, voice choice, observer, evidence, persistence, entitlement, or results.

### Barge-in order

1. 3410 rail response cancel/truncate.
2. Invalidate the active utterance generation/event ID.
3. Call avatar interrupt with the same event ID.
4. Observe media and mouth motion stop.
5. Transition to listening.
6. Resume from the live rail without replaying stale PCM.

If avatar startup or playback fails, show the unavailable state before continuing voice-only. Never loop fake video or claim synchronized Dexter media without direct observation.

## 3451 application contract

Retain the AAA route initially while 3440 integrates. Move presentation sections into the canonical V6 only after their real adapters pass acceptance. Keep fixture data behind one clearly removable fixture layer (`public/aaa/fixtures.mjs`) until live sources replace it.

### State ownership

| State | Temporary 3451 owner | 3440 owner |
|---|---|---|
| Current view and dialogs | `public/aaa/app.mjs` | Integrated client router/controller |
| Interview plan | Browser memory | Canonical setup/session contract |
| Conversation | Simulated | 3410 rail and durable alpha store |
| Analytics | Fixture | 3420R normalized safe projection |
| Avatar | Placeholder | 3430 AvatarProvider |
| Results/Vault | Fixture | Durable session/evidence adapters |
| Cross-product sources | Disclosure only | Explicit Matrix/File Vault/Timeline/StoryForge/RISE adapters |
| Debrief playbook | Browser memory | New separately authorized durable configuration adapter |

## Overlap resolution order for 3440

1. Freeze the exact accepted 3451 commit and protected hashes.
2. Create a new isolated 3440 branch/worktree; never merge into canonical V6 directly.
3. Adopt the 3451 shell as the presentation target.
4. Bind the 3410 rail to room controls and normalized states.
5. Bind persistence/results/Vault to real session records; remove fake replay where media is absent.
6. Add 3420R safe projections without restoring room clutter.
7. Add 3430 as an optional output sink with truthful fallback.
8. Replace fixture sources one adapter at a time.
9. Run full desktop, 390 × 844, 320px, keyboard, reduced-motion, provider-failure, barge-in, cleanup, restart, persistence, secrets, allowed-path, and rollback acceptance.

## Non-negotiable truth rules

- No silent model, rail, voice, avatar, media, or data-source fallback.
- No browser access to server credentials.
- No replay label without real media.
- No fabricated provider availability.
- No student-facing inferred traits or readiness claims.
- No production deployment, migration, or Matrix/StoryForge/Timeline mutation under 3451 authority.
