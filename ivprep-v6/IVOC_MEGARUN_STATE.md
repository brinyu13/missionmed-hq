# IVOC final AAA production megarun state

Updated: 2026-09-20 12:51 America/New_York
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
- Durable presentation boundary: Astra canonical components consume stable
  view-model/capability adapters; canonical business, session, database and
  provider behavior remains below that boundary. Current page composition is
  not presentation canon merely because a capability is wired into it.
- Active presentation/runtime deployment:
  `00913b6e-71c8-46f7-a19d-46acba43c7e7`, exact commit
  `feb19f06651c7d9da27d930cf5495b218f9625ab`, image
  `sha256:a6a7387a880c7d6afe399040bf3f0887687a13a03d56b2f8eeb5288e6fe50deb`.
- GPT-Live presentation boundary extraction: `feb19f06651c7d9da27d930cf5495b218f9625ab`.
  The proven browser WebRTC transport now lives in
  `public/capabilities/live-interview.mjs`; the active presentation imports that
  adapter rather than owning provider/session logic. Production authenticated
  `wp:1` readback returned the candidate.2 fingerprint, compatibility module,
  shared capability export and `liveInterviewAvailable=true`, all at HTTP 200.
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
- Application Intelligence pure domain core:
  `8b52db79fab6cfc50c94624ca08656d0c9cf22a9`; 47/47 focused tests and
  10/10 F1 regression tests pass. Server-only Context Pack persistence and
  ready-check receipt hydration are production-deployed. The bounded Actor
  block is resolved server-side and injected into GPT-Live at
  `16b3284adea43ff4bfe320f1d71544710856b631`; it and the private receipt never
  cross the browser boundary. Owner projections remain.

## Production data authority — LIVE VERIFIED

- Dedicated project: `missionmed-ivoc-production`.
- Project ref: `bscnrgqlwsyygyfrbhfn`.
- MissionMed organization: `jolimsgwkmssvhegrdfx`.
- Region: `us-east-2`.
- Provider status: `ACTIVE_HEALTHY`.
- Fourteen production migrations are present:
  `ivprep_3440_admin_canary`,
  `ivprep_3472c_t1_three_test_lifecycle`,
  `ivoc_3528c_session_recording_results`,
  `ivoc_m1_event_spine`,
  `ivoc_access_log_recording_index`, and
  `ivoc_production_privilege_hardening`,
  `ivoc_question_governance`,
  `ivoc_application_intelligence_context_packs`,
  `ivoc_question_governance_fail_fast`,
  `ivoc_mentor_priorities`,
  `ivoc_admin_config`,
  `ivoc_user_credits`,
  `ivoc_user_credits_conflict_fix`, and
  `ivoc_answer_assets`.
- Provider readback after the credit migrations:
  25/25 IVOC/IV Prep tables have RLS enabled and forced; browser/public table
  grants = 0; excess `service_role` grants
  (`DELETE`/`TRUNCATE`/`TRIGGER`/`REFERENCES`) = 0; the composite
  reservation foreign-key covering index is present.
- Bounded acceptance rows now exist: all GPT-Live canary sessions are
  abandoned, and one clearly labeled retired Admin-governance canary preserves
  four immutable versions. The Mentor Top 3 canary preserves one populated and
  one cleared append-only version, both actor-stamped `wp:1`; both associated
  sessions are abandoned. The Admin-config canary preserves baseline v1,
  bounded pressure-policy v2 and restored-baseline v3; its session is
  abandoned. The credit canary preserves eleven immutable actor-stamped events
  covering allowance, override, consumption, idempotent replay, insufficient-
  balance denial, reset and zero-balance restore. One real saved `CORE-01`
  answer produced a bounded AnswerAsset canary with private v1, explicitly
  consented `match_bridge_ready` v2 and terminal revoked v3; stale mutation
  failed at HTTP 409 and revoked playback failed closed at HTTP 404. No new
  production recording/media was created by these canaries. The single
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
| 10 | Server-owned Application Intelligence Context Pack hydration | LIVE VERIFIED | Genuine `brinyu` production session `1b973235-de3b-4d2c-a39a-c51e49df38e8` persisted one owner-bound private pack and `ctxpack:` receipt. Two authenticated `gpt-live-1` WebRTC canaries resolved that same server-only contract, reached live audio/transcript exchange and clean teardown; neither Actor block nor receipt crossed the browser boundary. |
| 10 | File Vault context/performance-reference seam | EXTERNAL DEPENDENCY | Current owner source is `J1-FILEVAULT-1019`; its live `/wp-json/mmed/v2/file-vault/bootstrap` contract requires same-origin WordPress cookie + `X-WP-Nonce` and rejects authorization-header/cross-origin use. IVOC fails closed with disabled “Not connected” cards. A consented server projection must be opened through File Vault owner authority; IVOC must not weaken or mutate the owner contract. |
| 10 | StoryForge opt-in story/theme and performance evidence | LIVE UNVERIFIED | IVOC source seam exists; live sibling-owner projection remains. |
| 10 | RISE sourced/fresh program context | NOT STARTED | Exact live owner contract and freshness receipt still required. |
| 10 | MCC / Top 3 / Mentor owner projections | LIVE VERIFIED | With no MCC owner authority present, IVOC now owns the versioned Mentor Top 3 contract. Genuine `brinyu` production v1 generated one `ivoc.mentor_priorities` receipt, two bounded facts and one `AIS-R09` signal in session `4e275dac-a613-45a2-85d5-1d35413c8e47`; the Actor received the shared priority and not the mentor-only note. Append-only v2 cleared the projection, a stale write returned 409, and cleared-state session `f378c2a0-0cc0-4422-b042-f4cbfe334261` had zero leaked inputs. |
| 10 | Prior-IVOC longitudinal context | LIVE UNVERIFIED | Production schema supports it; multi-session production proof remains. |
| 10 | Calendar interview adapter | NOT STARTED | Owner capability and contract must be resolved without mutating sibling assets. |
| 10 | Match Bridge bounded consented clip seam | LIVE VERIFIED | Real saved `CORE-01` media was bound only to a 0–14 s answer range, promoted from private v1 to consented `match_bridge_ready` v2, then revoked at v3. Whole-mock sharing remains prohibited by the contract; cross-product pickup is an external owner integration, not an IVOC clip-seam gap. |
| 11 | Structured evidence-to-coaching pipeline | LIVE UNVERIFIED | Session/transcript/evidence tables exist; live synthesis acceptance remains. |
| 11 | Assessments, strongest moments, improvements, drills, confidence/limitations | LIVE UNVERIFIED | Results source exists; evidence-linked production output remains. |
| 12 | Longitudinal metrics, deltas, filters and prior-self comparison | LIVE VERIFIED | Evidence-backed Progress, Compare and Performance Intelligence shipped at 30fb859 and remain present in 84e750e; live authenticated readback proved honest single-attempt gating and measured duration/volume evidence. |
| 13 | Admin View / Student View presentation switch without impersonation | LIVE UNVERIFIED | Role-aware source exists; live actor/subject separation proof remains. |
| 13 | Student selector, libraries, Results, Film Room, Progress and Top 3 | LIVE UNVERIFIED | Versioned Top 3 write/read/redaction and Context Pack binding are production accepted. Student selector and full production Admin traversal remain. |
| 13 | Usage/credits, Settings, AI controls, question governance, Match Bridge and Live Mock status | LIVE UNVERIFIED | Question governance, versioned Analytics/InterviewBrain/AIS/pressure/default-credit configuration, per-user credit accounting, and the owner-consented Match Bridge clip lifecycle are production accepted. Consolidated Settings presentation and Live Mock status remain. |
| 14 | Versioned question governance | LIVE VERIFIED | Genuine `brinyu` production canary `CANARY-ADMIN-20260920-E92A09` completed active v1 → edited v2 → hidden v3 → retired v4 with immutable `wp:1` actor-stamped history. Stale version and retired-reactivation writes fail fast at HTTP 409; the retry-class SQLSTATE defect found during the canary was corrected by `ivoc_question_governance_fail_fast`. |
| 14 | Credits, allowances, overrides, reset and balance | LIVE VERIFIED | Genuine `brinyu` production acceptance exercised allowance, override, atomic server-only consumption, idempotent replay, insufficient-balance denial, reset and zero-balance restoration. The authenticated Admin API advanced `wp:1` from v6 through v11, owner readback returned zero, and a stale write failed at HTTP 409. Eleven append-only events remain actor-stamped `wp:1`; browser clients cannot invoke consumption. |
| 14 | Versioned Analytics/InterviewBrain/coaching controls | LIVE VERIFIED | Genuine `brinyu` production writes created bounded v2 and restored-baseline v3 with stale-write HTTP 409. Session `66a60fec-398f-413b-a74c-3d0d8d3168da` pinned Admin config v2, `ivoc.analytics.v1`, `gpt-live-1:marin`, AIS `2026-09-18.1`, and follow-up intensity 2; the active configuration is restored v3. |
| 15 | Live Mock Studio Hot Seat workflow and real student media | NOT STARTED | Product surface and production workflow remain. |
| 15 | Canonical recording/Analytics/replay/overlay/scoring/library save | LIVE VERIFIED | One production Student Coached Practice rep completed the full camera/mic → Analytics → private recording → Results → Film Room overlay → Answer History → reload → signed private playback lifecycle. Overlay toggles and hidden-measurement continuity passed; true eye-gaze remains unsupported absent a defensible detector. |
| 15 | Deepest viable Webex or staged supervised adapter | NOT STARTED | Owner/provider constraint and shipped seam remain. |
| 16 | Per-question semantic Answer History | LIVE UNVERIFIED | Production CORE-01 history now reloads its private timestamped transcript and answer segment with synchronized playback. This rep truthfully produced no supported semantic observations; broader per-question semantic/filter acceptance remains. |
| 16 | Match Bridge Ready promotion with consent/audience/revocation/version | LIVE VERIFIED | Genuine `brinyu` production lifecycle used saved session `4571e86c-3d99-4ba4-bf19-bee1f972a699`: private v1 playback returned 200, explicit bounded-clip consent plus `student`/`match_bridge` audience produced v2, stale mutation returned 409, and owner revocation produced v3 with empty audience and playback 404. |
| 17 | Provider-neutral embodiment adapter and Brain/session separation | LIVE VERIFIED | Production Admin readback returns `missionmed.ivoc.embodiment.v1`: MissionMed InterviewBrain is the Director, providers are Actor-only, students select profiles rather than engines, and the adapter contract requires one audio authority plus generation/response identities. |
| 17 | Flush/interruption/motion contract, Admin preview and cost controls | LIVE UNVERIFIED | The deployed neutral gate rejects stale generations and regressing session-clock events, flushes audio/motion and cancels the provider response on interruption, and exposes Admin-only 45 s/no-retry/reservation controls. Real embodiment motion/preview execution remains unverified while external activation is deferred. |
| 17 | Fictional 10–15 avatar configuration model | LIVE VERIFIED | Authenticated `brinyu` Admin readback returned 12 fictional profiles spanning Program Director, Faculty and Chief Resident with Dove/Peacock/Owl/Eagle styles; every entry explicitly forbids person cloning and carries no provider voice or avatar asset identity. |
| 17 | Active LemonSlice provider integration | DEFERRED LEMONSLICE ONLY | Founder explicitly deferred active provider/spend. |
| 18 | Dr Brian/brinyu Admin and second authorized Admin | LIVE UNVERIFIED | `wp:1` Founder/Admin is live accepted. Current WordPress authority verifies `wp:107` (`brian_test`) as an administrator; the production IVOC allowlist and dedicated entitlement now include `wp:107`. Final acceptance still requires a genuine authenticated `wp:107` browser session; no session was forged. |
| 18 | Entitled 360 student and non-entitled/revoked/expired denials | LIVE UNVERIFIED | Fail-closed contracts exist; actual role/entitlement canaries remain. |
| 18 | Wrong-role/wrong-mentor denial and actor/subject separation | LIVE UNVERIFIED | Requires authenticated production negative-path acceptance. |
| 18 | Private media, signed/revocable playback, no public leakage, audit trail | LIVE UNVERIFIED | Owner signed playback, reload, transcript-spine authorization, `context_persist` audit and anonymous HTTP 401 passed. Wrong-owner/negative-role denial and revocation remain. |

## Current production and governance gates

- MissionMed HQ production is now Railway deployment
  `b4af1d5e-49c4-421c-9986-b7ba7af53ded` from exact product commit
  `5f07f288a7bcf60c778276dff1d55dc70b164bd5`; `/health` is HTTP 200, the
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
- Application Intelligence contracts, provenance, signals, Context Pack and
  Director arbitration are integrated. Production now builds and persists a
  server-only Context Pack during session creation, preserves its receipt
  across Spine/context writes, never returns the full pack or Actor block to
  the browser, and resolves the bounded Actor block directly into the trusted
  GPT-Live startup path. Genuine authenticated session/readback and live native
  audio acceptance passed. IVOC-owned Mentor Top 3 is now a live versioned
  projection; File Vault, StoryForge and RISE owner projections remain explicit
  external gates.
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

1. Resolve owner projection contracts in dependency order: File Vault/CV,
   StoryForge, then RISE; keep unavailable sources fail-closed.
2. Run authenticated second-Admin, entitled-360 and negative-role/private-media
   canaries when genuine sessions are available; never manufacture identities.
3. Exercise a real multi-turn follow-up/gap range and a transcript that produces
   supported semantic evidence, without fabricating either result.
4. Complete remaining Admin control presentation, then run fresh independent
   acceptance against the actual production route.
5. Create `IVOC_MEGARUN_FINAL_HANDOFF.md`, release every lease, and stop only
   at `IVOC AAA PRODUCTION COMPLETE — FOUNDER LEDGER SATISFIED`.
