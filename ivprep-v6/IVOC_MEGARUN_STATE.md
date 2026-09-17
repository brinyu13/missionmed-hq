# IVOC final AAA production megarun state

Updated: 2026-09-17 17:31 America/New_York
Mission: `IVOC-CONVERGE-8001`
Authority: `DR-290`
Branch: `codex/ivoc-converge-8001-production`
Required terminal marker: `IVOC AAA PRODUCTION COMPLETE — FOUNDER LEDGER SATISFIED`

This is the one living requirement ledger required by the final Founder
completion directive. A status of `LIVE UNVERIFIED` means the capability is
present in the active source lineage but has not yet passed acceptance against
the actual production route and deployment.

## Canon and source lineage

- F1 canonical product commit:
  `9fb848c26f6f220b61900138acb1b51622f12b5d`.
- Founder-facing presentation: recovered Astra candidate.2, fingerprint
  `dedb726bde521a135bec2286ad4cd5a877a68fc7ecd6144fde16b76bc9c09ac4`.
- The 7002 M1 surface is diagnostic-only and is not production presentation
  canon.
- Candidate.2 presentation integration successor:
  `84e750e4540acd5479ee72291e7b9d1c38f2f351`.
- Active presentation/runtime deployment:
  `72a3867e-6f46-4c95-ad6b-2701d26cba1a`, exact commit
  `2540e448df24e026f38ac5d1fb731b14e443fb13`, image
  `sha256:7716a06f8f3d2d708f32b53d50ccddf2651a85289cca679e36456f7585c10b22`.
- GPT-Live WebRTC InterviewBrain integration:
  `0b272bbc8f1ea168b05603c0da5a0cd7f154bee3`.
- Durable authenticated recording, Analytics-result persistence, playback,
  owner library, and role-bounded views:
  `9701bb0742e65fbf2cdb210265ae4fd0d575dcc4`.
- Explicit Supabase authority binding:
  `655555a19e4e7f40a0ef5a5492b1f7b6079a24a3`.
- Opt-in sealed-recording transcription and evidence-bound Context UI:
  `8e7a76341e6b9688db11a7d8d6185ce030291f36`.
- Owner-bound transcript/Q&A/session-spine persistence and private Film Room
  traversal: `ded0c6ab3dc40f708d8002948ac6cb5698c2fa84`; truthful empty-semantic-state
  copy: `2540e448df24e026f38ac5d1fb731b14e443fb13`.
- Additive audit-recording foreign-key index:
  `cca6734a830124096e877e9bf0dbd861c0f2baff`.
- Source baseline before this completion tranche:
  `84f0adb3235d89de32478700653eec57b278097c`.

## Production data authority — LIVE VERIFIED

- Dedicated project: `missionmed-ivoc-production`.
- Project ref: `bscnrgqlwsyygyfrbhfn`.
- MissionMed organization: `jolimsgwkmssvhegrdfx`.
- Region: `us-east-2`.
- Provider status: `ACTIVE_HEALTHY`.
- Six production migrations are present:
  `ivprep_3440_admin_canary`,
  `ivprep_3472c_t1_three_test_lifecycle`,
  `ivoc_3528c_session_recording_results`,
  `ivoc_m1_event_spine`,
  `ivoc_access_log_recording_index`, and
  `ivoc_production_privilege_hardening`.
- Provider readback after the hardening migration:
  17/17 IVOC/IV Prep tables have RLS enabled and forced; browser/public table
  grants = 0; excess `service_role` grants
  (`DELETE`/`TRUNCATE`/`TRIGGER`/`REFERENCES`) = 0; the composite
  reservation foreign-key covering index is present.
- All user/session/media tables are empty. The single
  `ivprep_provider_control` row remains fail-closed:
  `paid_tests_enabled=false`, `kill_switch_tripped=true`.
- Security advisor reports only the expected informational
  `rls_enabled_no_policy` findings. Browser roles have no grants; access is
  through the server-owned least-privilege adapter. Performance advisor reports
  only unused indexes on the empty project and the Auth connection-strategy
  informational notice.
- Sanctioned development branch remains
  `ivoc-converge-8001-m1` / `mwyqdupgalpvtupceozz`. Its historical parent
  `missionmed-cam-dev` is not production IVOC authority.

## Founder requirement ledger

| Section | Major requirement | Status | Current evidence / next proof |
|---|---|---|---|
| 5 | Candidate.2 premium Home visual DNA, hierarchy, contrast, responsive composition | LIVE UNVERIFIED | Exact candidate.2 successor is live at 84e750e; Home and Practice Goal visual readback passed. Fresh independent presentation acceptance remains. |
| 5 | Six-step builder and Practice Goal modes | LIVE UNVERIFIED | All six rich step compositions passed local Chrome traversal; live Practice Goal passed. Live traversal of steps 2-6 remains. |
| 5 | Question Pool branching, persistent rail, presets, ordering, 193-question corpus | LIVE UNVERIFIED | Progressive category to subcategory to question flow, 193-source count and persistent rail passed focused tests and local Chrome; live interaction proof remains. |
| 5 | Separate Interviewer and Program steps with role/style controls | LIVE UNVERIFIED | Program Director, Faculty, Chief Resident, APD and Dove/Peacock/Owl/Eagle passed local Chrome; live interaction proof remains. |
| 5 | RISE-backed Program search, sourced highlights, people, freshness/manual fallback | NOT STARTED | Requires live owner contract and source-receipt proof. |
| 5 | Environment + Context sources and opt-in StoryForge reveal | LIVE UNVERIFIED | MissionMed/Webex/Zoom/Teams and fail-closed source cards passed local Chrome; owner projections and live opt-in behavior remain. |
| 5 | Truthful Readiness & Calibration checks | LIVE VERIFIED | Production Chrome proved physical FaceTime HD camera, built-in microphone, running audio context, live level and bound video surface. |
| 6 | Real modular camera/mic Analytics with truthful availability states | LIVE VERIFIED | Physical production rep produced real microphone PCM plus face, hands, head and framing telemetry; unavailable signals continued to fail closed. |
| 6 | Volume, pace, pauses, pitch, fillers and transcript boundaries | LIVE UNVERIFIED | Physical production reps proved live volume, variation, pitch, pace, cadence and pause states; the newest private rep persisted eight timestamped transcript segments plus its question turn and survived reload. Filler acceptance remains. |
| 6 | Admin measurement/visibility controls and prohibited-inference safeguards | LIVE VERIFIED | Production Admin and Student Coached Practice face/head, hand/finger, body/pose and framing/head-orientation overlays were visibly aligned to the real camera surface and independently toggleable; measurement continued while hidden. True eye-gaze visualization remains unsupported; the product exposes only defensible camera-facing/head-orientation proxies. |
| 7 | Canonical clock across recording, transcript, Q/A, Analytics, Results and clips | LIVE VERIFIED | A production CORE-01 rep persisted one complete session contract, nine timestamped conversation turns and one answer segment; the Film Room transcript row sought private replay to 2.26 s after reload. |
| 7 | Private durable capture, canonical transcript, answer/follow-up ranges and gaps | LIVE UNVERIFIED | Owner capture, upload, seal, canonical transcript/answer range persistence, signed playback, reload and `context_persist` audit passed. A real multi-turn follow-up/gap range remains to be accepted. |
| 8 | Evidence-grounded Results | LIVE VERIFIED | Production post-answer Results and bounded transcript/context analysis returned evidence-cited observations tied to transcript segments without unsupported scoring. |
| 8 | Film Room synchronized replay and Flight Recorder timeline | LIVE VERIFIED | A private production rep survived reload, reopened through signed owner playback, visibly rendered aligned replay overlays, and its timestamped transcript row sought replay to 2.26 s. |
| 8 | Durable student Video Library and Admin student-library access | LIVE UNVERIFIED | Owner library, transcript spine and signed private playback persisted across reload; Admin student-library and negative-role isolation remain. |
| 9 | Current supported realtime transport and contextual InterviewBrain | LIVE VERIFIED | Production `gpt-live-1` WebRTC canary created twice through the authenticated IVOC broker, reached `session.started`, exchanged native audio/transcript events, and ended with provider hangup HTTP 200. |
| 9 | Natural turns, answer-grounded follow-up, memory, move-on and barge-in | LIVE VERIFIED | Production canary retained the discharge/teach-back detail across turns, asked evidence-grounded follow-ups, honored “move to the next question,” and visibly truncated “That gives me a—” on barge-in before continuing. |
| 9 | Pool/context weighting, clean teardown, single audio authority | LIVE UNVERIFIED | Selected CORE-01 reached the room and both canaries received authoritative provider hangup; exact pool-weighting behavior and explicit single-audio telemetry remain. |
| 10 | File Vault context/performance-reference seam | EXTERNAL DEPENDENCY | Current owner source is `J1-FILEVAULT-1019`; its live `/wp-json/mmed/v2/file-vault/bootstrap` contract requires same-origin WordPress cookie + `X-WP-Nonce` and rejects authorization-header/cross-origin use. IVOC fails closed with disabled “Not connected” cards. A consented server projection must be opened through File Vault owner authority; IVOC must not weaken or mutate the owner contract. |
| 10 | StoryForge opt-in story/theme and performance evidence | LIVE UNVERIFIED | IVOC source seam exists; live sibling-owner projection remains. |
| 10 | RISE sourced/fresh program context | NOT STARTED | Exact live owner contract and freshness receipt still required. |
| 10 | MCC / Top 3 / Mentor owner projections | NOT STARTED | Exact live owner contracts still required. |
| 10 | Prior-IVOC longitudinal context | LIVE UNVERIFIED | Production schema supports it; multi-session production proof remains. |
| 10 | Calendar interview adapter | NOT STARTED | Owner capability and contract must be resolved without mutating sibling assets. |
| 10 | Match Bridge bounded consented clip seam | NOT STARTED | IVOC clip contract and live owner handoff remain. |
| 11 | Structured evidence-to-coaching pipeline | LIVE UNVERIFIED | Session/transcript/evidence tables exist; live synthesis acceptance remains. |
| 11 | Assessments, strongest moments, improvements, drills, confidence/limitations | LIVE UNVERIFIED | Results source exists; evidence-linked production output remains. |
| 12 | Longitudinal metrics, deltas, filters and prior-self comparison | LIVE VERIFIED | Evidence-backed Progress, Compare and Performance Intelligence shipped at 30fb859 and remain present in 84e750e; live authenticated readback proved honest single-attempt gating and measured duration/volume evidence. |
| 13 | Admin View / Student View presentation switch without impersonation | LIVE UNVERIFIED | Role-aware source exists; live actor/subject separation proof remains. |
| 13 | Student selector, libraries, Results, Film Room, Progress and Top 3 | LIVE UNVERIFIED | Partial source surfaces exist; full production Admin acceptance remains. |
| 13 | Usage/credits, Settings, AI controls, question governance, Match Bridge and Live Mock status | NOT STARTED | Full Admin ledger surface is incomplete. |
| 14 | Versioned question governance | NOT STARTED | Add/hide/edit/retire with preserved IDs/history remains. |
| 14 | Credits, allowances, overrides, reset and balance | NOT STARTED | Production accounting/control model remains. |
| 14 | Versioned Analytics/InterviewBrain/coaching controls | NOT STARTED | Production Admin configuration/version receipt remains. |
| 15 | Live Mock Studio Hot Seat workflow and real student media | NOT STARTED | Product surface and production workflow remain. |
| 15 | Canonical recording/Analytics/replay/overlay/scoring/library save | LIVE VERIFIED | One production Student Coached Practice rep completed the full camera/mic → Analytics → private recording → Results → Film Room overlay → Answer History → reload → signed private playback lifecycle. Overlay toggles and hidden-measurement continuity passed; true eye-gaze remains unsupported absent a defensible detector. |
| 15 | Deepest viable Webex or staged supervised adapter | NOT STARTED | Owner/provider constraint and shipped seam remain. |
| 16 | Per-question semantic Answer History | LIVE UNVERIFIED | Production CORE-01 history now reloads its private timestamped transcript and answer segment with synchronized playback. This rep truthfully produced no supported semantic observations; broader per-question semantic/filter acceptance remains. |
| 16 | Match Bridge Ready promotion with consent/audience/revocation/version | NOT STARTED | Bounded clip contract and production proof remain. |
| 17 | Provider-neutral embodiment adapter and Brain/session separation | NOT STARTED | Active provider integration remains prohibited; neutral seam is still required. |
| 17 | Flush/interruption/motion contract, Admin preview and cost controls | NOT STARTED | Neutral contract/control surface remains. |
| 17 | Fictional 10–15 avatar configuration model | NOT STARTED | Configuration/catalog only; no real-person cloning/inference. |
| 17 | Active LemonSlice provider integration | DEFERRED LEMONSLICE ONLY | Founder explicitly deferred active provider/spend. |
| 18 | Dr Brian/brinyu Admin and second authorized Admin | LIVE UNVERIFIED | `wp:1` Founder/Admin is live accepted. Current WordPress authority verifies `wp:107` (`brian_test`) as an administrator; the production IVOC allowlist and dedicated entitlement now include `wp:107`. Final acceptance still requires a genuine authenticated `wp:107` browser session; no session was forged. |
| 18 | Entitled 360 student and non-entitled/revoked/expired denials | LIVE UNVERIFIED | Fail-closed contracts exist; actual role/entitlement canaries remain. |
| 18 | Wrong-role/wrong-mentor denial and actor/subject separation | LIVE UNVERIFIED | Requires authenticated production negative-path acceptance. |
| 18 | Private media, signed/revocable playback, no public leakage, audit trail | LIVE UNVERIFIED | Owner signed playback, reload, transcript-spine authorization, `context_persist` audit and anonymous HTTP 401 passed. Wrong-owner/negative-role denial and revocation remain. |

## Current production and governance gates

- MissionMed HQ production is now Railway deployment
  `72a3867e-6f46-4c95-ad6b-2701d26cba1a` from exact product commit
  `2540e448df24e026f38ac5d1fb731b14e443fb13`; runtime source bytes match
  the commit, health is ready, repository source is disconnected, the
  unauthenticated product route remains fail-closed at HTTP 401, and the
  verified second-Admin allowlist is `wp:1,wp:107`.
- Runtime bindings point to dedicated project `bscnrgqlwsyygyfrbhfn` without
  exposing credentials. Context/transcript flags are enabled for the bounded
  production path; paid-test provider controls remain server-only and fail closed.
- Current canonical IVOC source does not contain the registered StoryForge V5
  and Timeline roots. Live checks previously found sibling-owned StoryForge,
  Timeline/USCE, and Matrix drift. No generic canonical waiver mechanism was
  found. IVOC must consume stable owner contracts and must not mutate or waive
  unrelated sibling security/privacy dependencies.
- The ten-surface Matrix lock was reconciled to verified current owner/runtime
  identities without mutating owner assets. IVOC remains a consumer; fresh
  end-to-end Matrix launch acceptance is still required.
- Root runtime dependency audit previously reported zero vulnerabilities. Default
  branch repository-security advisories remain separate security-owner work until
  re-triaged against the production commit.

## VOICE OPPORTUNITY

- NATURAL VOICE HEARD: GPT-Live native interviewer audio; synthetic applicant canary phrases separately used macOS Samantha.
- MODEL: `gpt-live-1`.
- VOICE: `marin`.
- ACTUAL IVOC PATH: YES — authenticated broker, canonical WebRTC/data-channel session, production microphone and the current InterviewBrain room.
- CURRENT VALID GPT-LIVE VOICES: `alloy`, `ash`, `ballad`, `beacon`, `bossa`, `cedar`, `cinder`, `coral`, `delta`, `echo`, `gleam`, `marin`, `meridian`, `quartz`, `ripple`, `sage`, `shimmer`, `stone`, `tempo`, `verse`, `vesper`, `willow`; the bounded audition exposes `marin`, `meridian`, `gleam`, `vesper`, `stone`, and `willow`.
- ADMIN AUDITION AVAILABLE: YES — Admin role → Interview Room → Founder / Admin voice audition; production accepted `meridian` through the same InterviewBrain session/context/audio path (1.353 s create, 363 ms confirmed hangup), and students remain pinned to `marin`.
- CURRENT ARCHITECTURE VS FABLE: Director/orchestration remains outside providers; conversation rail, canonical clock, audio authority, response/item identity, interruption/cancellation, stale-output rejection, ElevenLabs adapter, LemonSlice adapter and LiveKit coordinator/worker already exist. The new Live room currently uses the direct GPT-Live path rather than those legacy avatar/TTS rails.
- EXTERNAL TTS WORK STILL NEEDED: Deferred; only needed later if native Live voices fail persona/accent/verbatim requirements.
- RECOMMENDED NEXT ACTION AFTER RESET: Founder auditions the six native voices in the real room, selects a preferred default/profile mapping, then IVOC decides whether any TTS-mediated Actor lane is still justified.

## Next execution lanes

1. Run authenticated second-Admin, entitled-360 and negative-role/private-media
   canaries when genuine sessions are available; never manufacture identities.
2. Exercise a real multi-turn follow-up/gap range and a transcript that produces
   supported semantic evidence, without fabricating either result.
3. Continue IVOC-owned Admin question governance, Analytics/AI controls and
   credit accounting while sibling-owner projections remain fail-closed.
4. Run fresh independent acceptance against the actual production route.
5. Create `IVOC_MEGARUN_FINAL_HANDOFF.md`, release every lease, and stop only
   at `IVOC AAA PRODUCTION COMPLETE — FOUNDER LEDGER SATISFIED`.
