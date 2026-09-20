# IVOC final AAA production megarun state

Updated: 2026-09-20 18:06 America/New_York
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
- Latest functionality-accepted presentation/runtime deployment:
  `6b5bad11-590b-4646-b470-71d233fafea4`, exact commit
  `d1be75bec0de35c86bdec05557776833cab9edc9`, image
  `sha256:84b5d6cb2f634b6736efcdb0e2747c5df2fda2adc87e2ead94d6f3853b1c962a`.
  `/health` is HTTP 200 and anonymous `/iv-prep-on-call/` remains fail-closed
  at HTTP 401. Authenticated production Results reconstructed three canonical
  transcript segments, 36 words and a 0 s–18 s capture-owner boundary, then
  truthfully rendered zero bounded filler candidates from its disclosed
  lexicon without a provider re-call or hidden-trait inference.
- Admin operational-control presentation: `268cd4be2265e7cd1ee6b05247ab5e148312a260`.
  The existing candidate.2 Mentor & Admin surface now consumes the versioned
  Admin-config, authenticated credit-account and governed-question adapters,
  while showing Match Bridge, Live Mock, owner-projection and LemonSlice states
  without inventing availability. Authenticated production `wp:1` visual
  traversal passed through the candidate.2 Admin surface.
  Protected custody was forward-reconciled without history rewrite as
  `aa425b6` → `3f4d9bd` under confirmed product lease epoch `3191`; the final
  product bytes and focused-test result are identical to the accepted source.
- Question-bound Answer History projection and evidence filters:
  `d5c502ef8c47623a09979e014ca27db1fdaa5b80`; authenticated production found
  one concurrent-render race during rollout, corrected at
  `331b049318e17fd0d5e823ae3fbba8033f90e1ce`. Production now filters 14
  owner-bound answers to the one answer with supported semantic evidence and
  truthfully displays its three persisted observations.
- Live Mock Studio owner adapter: `c9b88701ca29e63b7d2faac2bf3b243ddaf8b39b`.
  The browser-native fetch receiver correction and honest owner-declared
  recording-state mapping were forward-reconciled as `6049a9c` → `cfdf742`
  under continuously confirmed product lease epoch `3206`, followed by exact
  remote readback and normal release. Production `wp:1` lists 11 authorized
  Webex appointments and the first readiness lookup truthfully reports
  `RECORDING PROCESSING`; IVOC never receives or exposes a playback/download
  URL in that state.
- Calendar owner adapter: `c8e473aadb2abec8e9fe6bb33af58dda2e733a19`.
  The candidate.2 Program step consumes only the minimized Scheduler projection;
  production authenticated readback returned seven authorized appointments and
  zero upcoming interviews, without exposing owner URLs or inventing an event.
- Admin student-library adapter: `759cca71f4203569dba3cde99f9a18060c05e376`.
  Production Admin `wp:1` grouped 14 authorized sessions under the stable
  student identity, opened the persisted Results surface, then opened the
  transcript-backed Film Room through a signed private-media URL. Playback
  reached ready state 4 and advanced; switching to Student view hid both the
  selector and Mentor/Admin navigation while retaining the same actor identity.
- GPT-Live presentation boundary extraction: `feb19f06651c7d9da27d930cf5495b218f9625ab`.
  The proven browser WebRTC transport now lives in
  `public/capabilities/live-interview.mjs`; the active presentation imports that
  adapter rather than owning provider/session logic. Production authenticated
  `wp:1` readback returned the candidate.2 fingerprint, compatibility module,
  shared capability export and `liveInterviewAvailable=true`, all at HTTP 200.
- Private GPT-Live turn-sequence persistence: `6d28af1a6cc39f466c0893d0703b955e690961aa`.
  Final provider transcript events now cross the presentation boundary through
  the durable session adapter, are timed on the recording-observed clock, and
  persist as explicitly provisional private turns. Server transcription remains
  the only canonical transcript authority. Production canary session
  `f89dc627-965a-48fb-9181-0b4681916dfd` round-tripped five synthetic contract
  turns as opening → answer → follow-up → answer → follow-up with zero canonical
  references; this proves deployment/persistence, not a real applicant exchange.
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
- Evidence-bound prior-IVOC runtime projection:
  `23d119076768a6c6eb19153a0a6e3c69e1f15539`. New semantic analyses persist
  only structured, transcript-cited `structure`, `evidence`, `specificity` or
  `concision` patterns with explicit strength/weakness polarity. Context Packs
  read only the same owner's prior saved sessions, exclude the active session,
  require score and coverage of at least 0.65, and require the same facet in at
  least two distinct sessions. Production currently has zero qualifying rows,
  so the runtime emits no longitudinal claim rather than manufacturing one.
- Canonical coaching-evidence score contract repair:
  `7145a88406e7d5e9c4978d952f0ba9d10aae3460`. Production session
  `4571e86c-3d99-4ba4-bf19-bee1f972a699` persisted the real sealed transcript,
  one answer-structure row and two coaching-pattern rows whose score is the
  required JSON object. Results rendered cited observations; cold reload,
  Answer History and signed Film Room playback all read them back.
- Cold-reload evidence-grounded Results reconstruction:
  `875637536f7ada69ccb06c7bc8a96466aa6d44bc`. Production Admin `wp:1`
  reopened saved session `0d250e0c-1011-48bc-a416-f9ae4c2c735f` without a
  provider re-call. The live Results surface reconstructed the canonical
  transcript, four evidence-cited observations, Structure as the strongest
  supported moment, Specificity as the highest-value improvement, a cited next
  drill, and MODERATE confidence with 61% score, 90% coverage and explicit
  limitations.

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
| 5 | Six-step builder and Practice Goal modes | LIVE VERIFIED | Authenticated production Chrome traversed all six distinct candidate.2 step compositions without collapsing them into the rejected generic-card builder. |
| 5 | Question Pool branching, persistent rail, presets, ordering, 193-question corpus | LIVE VERIFIED | Authenticated production traversed category → subcategory → question, retained the persistent right rail, and read the canonical 193-question corpus. |
| 5 | Separate Interviewer and Program steps with role/style controls | LIVE VERIFIED | Authenticated production traversed the independent Program and Interviewer compositions with Program Director, Faculty, Chief Resident, APD and Dove/Peacock/Owl/Eagle controls. RISE hydration remains a separate owner projection. |
| 5 | RISE-backed Program search, sourced highlights, people, freshness/manual fallback | EXTERNAL DEPENDENCY | IVOC's fail-closed `rise.program_cheat_sheet` normalizer and UI seam are complete. Current RISE program/research routes require RISE-owned auth and program identity; the visible “Use for Interview Prep” control is still a toast-only CAM handoff and no minimized, signed WP-subject projection/source receipt exists for IVOC. RISE owner authority must publish that contract. |
| 5 | Environment + Context sources and opt-in StoryForge reveal | LIVE UNVERIFIED | MissionMed/Webex/Zoom/Teams and fail-closed source cards passed local Chrome; owner projections and live opt-in behavior remain. |
| 5 | Truthful Readiness & Calibration checks | LIVE VERIFIED | Production Chrome proved physical FaceTime HD camera, built-in microphone, running audio context, live level and bound video surface. |
| 6 | Real modular camera/mic Analytics with truthful availability states | LIVE VERIFIED | Physical production rep produced real microphone PCM plus face, hands, head and framing telemetry; unavailable signals continued to fail closed. |
| 6 | Volume, pace, pauses, pitch, fillers and transcript boundaries | LIVE VERIFIED | Physical production reps proved live volume, variation, pitch, pace, cadence and pause states. Authenticated saved session `0d250e0c-1011-48bc-a416-f9ae4c2c735f` then cold-reconstructed three canonical transcript segments, 36 words, the 0 s–18 s capture-owner boundary and zero bounded filler candidates on deployment `6b5bad11…`; the UI discloses the bounded lexicon and explicitly rejects hidden-trait inference. |
| 6 | Admin measurement/visibility controls and prohibited-inference safeguards | LIVE VERIFIED | Production Admin and Student Coached Practice face/head, hand/finger, body/pose and framing/head-orientation overlays were visibly aligned to the real camera surface and independently toggleable; measurement continued while hidden. True eye-gaze visualization remains unsupported; the product exposes only defensible camera-facing/head-orientation proxies. |
| 7 | Canonical clock across recording, transcript, Q/A, Analytics, Results and clips | LIVE VERIFIED | A production CORE-01 rep persisted one complete session contract, nine timestamped conversation turns and one answer segment; the Film Room transcript row sought private replay to 2.26 s after reload. |
| 7 | Private durable capture, canonical transcript, answer/follow-up ranges and gaps | LIVE UNVERIFIED | Owner capture, upload, seal, canonical transcript/answer range persistence, signed playback, reload and `context_persist` audit passed. Deployed canary `f89dc627…` proved five provisional GPT-Live turns and structural follow-up linkage survive private reload without becoming canonical. A real recorded multi-turn exchange with canonical answer/follow-up/gap ranges remains to be accepted. |
| 8 | Evidence-grounded Results | LIVE VERIFIED | Production post-answer Results and bounded transcript/context analysis returned evidence-cited observations tied to transcript segments without unsupported scoring. |
| 8 | Film Room synchronized replay and Flight Recorder timeline | LIVE VERIFIED | A private production rep survived reload, reopened through signed owner playback, visibly rendered aligned replay overlays, and its timestamped transcript row sought replay to 2.26 s. |
| 8 | Durable student Video Library and Admin student-library access | LIVE VERIFIED | Cold production reload returned 14 owner-bound sessions to authenticated Admin `wp:1`; the semantic CORE-01 answer reopened through signed private playback with its timestamped transcript spine and three persisted observations. Student view still hides the Admin selector. Negative-role isolation remains tracked separately. |
| 9 | Current supported realtime transport and contextual InterviewBrain | LIVE VERIFIED | Production `gpt-live-1` WebRTC canary created twice through the authenticated IVOC broker, reached `session.started`, exchanged native audio/transcript events, and ended with provider hangup HTTP 200. |
| 9 | Natural turns, answer-grounded follow-up, memory, move-on and barge-in | LIVE VERIFIED | Production canary retained the discharge/teach-back detail across turns, asked evidence-grounded follow-ups, honored “move to the next question,” and visibly truncated “That gives me a—” on barge-in before continuing. |
| 9 | Pool/context weighting, clean teardown, single audio authority | LIVE UNVERIFIED | Production deployment `db562b38…` at source `b6b0a92` resolves the selected canonical corpus entries into an exact ordered server prompt, keeps pressure as a modifier instead of replacing interviewer identity, rejects a surplus provider audio track, and persists the strict `configured -> bound -> released` `ivoc.audio-authority.v1` lifecycle. Deployed synthetic contract canary `f89dc627…` returned `audioAuthorityVerified=true`; authenticated reload preserved five turns, and provider readback plus `audio_authority_persist` audit confirmed single native audio. One real recorded, pool-ordered multi-question exchange remains for behavioral acceptance. |
| 10 | Server-owned Application Intelligence Context Pack hydration | LIVE VERIFIED | Genuine `brinyu` production session `1b973235-de3b-4d2c-a39a-c51e49df38e8` persisted one owner-bound private pack and `ctxpack:` receipt. Two authenticated `gpt-live-1` WebRTC canaries resolved that same server-only contract, reached live audio/transcript exchange and clean teardown; neither Actor block nor receipt crossed the browser boundary. |
| 10 | File Vault context/performance-reference seam | EXTERNAL DEPENDENCY | Current owner source is `J1-FILEVAULT-1019`; its live `/wp-json/mmed/v2/file-vault/bootstrap` contract requires same-origin WordPress cookie + `X-WP-Nonce` and rejects authorization-header/cross-origin use. IVOC fails closed with disabled “Not connected” cards. A consented server projection must be opened through File Vault owner authority; IVOC must not weaken or mutate the owner contract. |
| 10 | StoryForge opt-in story/theme and performance evidence | EXTERNAL DEPENDENCY | IVOC's fail-closed `storyforge.approved_stories` normalizer and presentation seam are complete. Current owner `/api/interview-intelligence` returns question-readiness metadata, requires a StoryForge-signed JWT plus StoryForge UUID identity, and does not expose a consented approved-story/theme projection bound to the IVOC WordPress subject. StoryForge owner authority must publish that minimized projection. |
| 10 | RISE sourced/fresh program context | EXTERNAL DEPENDENCY | IVOC's normalizer and fail-closed Program/context surfaces are complete. Current owner program and research routes remain RISE-authenticated and the CAM handoff is nonfunctional toast copy; no signed `rise.program_cheat_sheet` projection with freshness/source receipts and WP-subject binding exists. RISE owner authority must publish it. |
| 10 | MCC / Top 3 / Mentor owner projections | LIVE VERIFIED | With no MCC owner authority present, IVOC now owns the versioned Mentor Top 3 contract. Genuine `brinyu` production v1 generated one `ivoc.mentor_priorities` receipt, two bounded facts and one `AIS-R09` signal in session `4e275dac-a613-45a2-85d5-1d35413c8e47`; the Actor received the shared priority and not the mentor-only note. Append-only v2 cleared the projection, a stale write returned 409, and cleared-state session `f378c2a0-0cc0-4422-b042-f4cbfe334261` had zero leaked inputs. |
| 10 | Prior-IVOC longitudinal context | LIVE UNVERIFIED | Deployment `7ad89899…` persists and projects only structured, transcript-cited patterns from prior saved owner sessions, excluding the active session and requiring the same bounded facet in at least two sessions. Production readback found 0 qualifying rows, so no recurring claim was emitted; real multi-session proof remains. |
| 10 | Calendar interview adapter | LIVE VERIFIED | The deployed stable adapter consumes the Scheduler owner projection, strips owner URLs and rendered the authenticated connected state: seven authorized appointments, none upcoming. |
| 10 | Match Bridge bounded consented clip seam | LIVE VERIFIED | Real saved `CORE-01` media was bound only to a 0–14 s answer range, promoted from private v1 to consented `match_bridge_ready` v2, then revoked at v3. Whole-mock sharing remains prohibited by the contract; cross-product pickup is an external owner integration, not an IVOC clip-seam gap. |
| 11 | Structured evidence-to-coaching pipeline | LIVE VERIFIED | Deployment `68a57f16…` accepted real sealed session `4571e86c-3d99-4ba4-bf19-bee1f972a699`, rendered transcript-cited semantic observations, and persisted one answer-structure plus two confidence-bounded coaching-pattern rows. Canonical readback proved object-shaped `score.value=0.02`, eight segment references per row and clean cold-reload synthesis. |
| 11 | Assessments, strongest moments, improvements, drills, confidence/limitations | LIVE VERIFIED | Production Admin `wp:1` cold-opened saved session `0d250e0c-1011-48bc-a416-f9ae4c2c735f` after deployment `cd7195da…`; the live Results surface reconstructed four cited observations, strongest Structure, Specificity improvement, the cited next drill, MODERATE confidence, 61% score, 90% coverage and explicit limitations without a provider re-call. |
| 12 | Longitudinal metrics, deltas, filters and prior-self comparison | LIVE VERIFIED | Evidence-backed Progress, Compare and Performance Intelligence shipped at 30fb859 and remain present in 84e750e; live authenticated readback proved honest single-attempt gating and measured duration/volume evidence. |
| 13 | Admin View / Student View presentation switch without impersonation | LIVE VERIFIED | Authenticated production `wp:1` switched Student → Admin while retaining the same actor/subject identity; Admin-only navigation and diagnostics appeared without impersonating another user. |
| 13 | Student selector, libraries, Results, Film Room, Progress and Top 3 | LIVE VERIFIED | Production Admin `wp:1` selected the authorized student library, traversed Results and transcript-backed Film Room, and played the signed private recording. Student view hid the selector without actor impersonation. Top 3, Progress and longitudinal views retain their separately accepted evidence. |
| 13 | Usage/credits, Settings, AI controls, question governance, Match Bridge and Live Mock status | LIVE VERIFIED | Authenticated production `wp:1` visibly read policy v3, `ivoc.analytics.v1`, `gpt-live-1:marin`, follow-up intensity 1, credit account v11, governed catalog status, Match Bridge readiness, owner-projection requirements, deferred LemonSlice and `SCHEDULER CONNECTED · 11 WEBEX` through the candidate.2 Admin surface. |
| 14 | Versioned question governance | LIVE VERIFIED | Genuine `brinyu` production canary `CANARY-ADMIN-20260920-E92A09` completed active v1 → edited v2 → hidden v3 → retired v4 with immutable `wp:1` actor-stamped history. Stale version and retired-reactivation writes fail fast at HTTP 409; the retry-class SQLSTATE defect found during the canary was corrected by `ivoc_question_governance_fail_fast`. |
| 14 | Credits, allowances, overrides, reset and balance | LIVE VERIFIED | Genuine `brinyu` production acceptance exercised allowance, override, atomic server-only consumption, idempotent replay, insufficient-balance denial, reset and zero-balance restoration. The authenticated Admin API advanced `wp:1` from v6 through v11, owner readback returned zero, and a stale write failed at HTTP 409. Eleven append-only events remain actor-stamped `wp:1`; browser clients cannot invoke consumption. |
| 14 | Versioned Analytics/InterviewBrain/coaching controls | LIVE VERIFIED | Genuine `brinyu` production writes created bounded v2 and restored-baseline v3 with stale-write HTTP 409. Session `66a60fec-398f-413b-a74c-3d0d8d3168da` pinned Admin config v2, `ivoc.analytics.v1`, `gpt-live-1:marin`, AIS `2026-09-18.1`, and follow-up intensity 2; the active configuration is restored v3. |
| 15 | Live Mock Studio Hot Seat workflow and real student media | LIVE UNVERIFIED | Production Admin now lists 11 authorized Webex appointments through the stable owner adapter and reads recording readiness without claiming sibling media. End-to-end supervised Hot Seat execution with real student media remains. |
| 15 | Canonical recording/Analytics/replay/overlay/scoring/library save | LIVE VERIFIED | One production Student Coached Practice rep completed the full camera/mic → Analytics → private recording → Results → Film Room overlay → Answer History → reload → signed private playback lifecycle. Overlay toggles and hidden-measurement continuity passed; true eye-gaze remains unsupported absent a defensible detector. |
| 15 | Deepest viable Webex or staged supervised adapter | LIVE UNVERIFIED | The same-origin Scheduler/Webex adapter is deployed, authenticated and visibly lists owner appointments; the first production readiness check truthfully returned `RECORDING PROCESSING`. A completed owner recording with private playback pickup remains required for promotion. |
| 16 | Per-question semantic Answer History | LIVE VERIFIED | After a cold production reload, authenticated `wp:1` selected “Supported semantic evidence” and the projection filtered 14 owner answers to the one CORE-01 answer with three persisted supported observations. The list remains question-bound and does not leak raw private interpretation data. |
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

- Latest functionality-accepted MissionMed HQ production is Railway deployment
  `6b5bad11-590b-4646-b470-71d233fafea4` from exact product commit
  `d1be75bec0de35c86bdec05557776833cab9edc9`; `/health` is HTTP 200, the
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

1. Monitor the exact File Vault, StoryForge and RISE owner-contract gaps; keep
   their completed IVOC projection seams fail-closed and do not mutate siblings.
2. Run authenticated second-Admin, entitled-360 and negative-role/private-media
   canaries when genuine sessions are available; never manufacture identities.
3. Exercise a real multi-turn follow-up/gap range and a transcript that produces
   supported semantic evidence, without fabricating either result.
4. Exercise one completed owner-backed Webex mock through recording pickup and
   private IVOC review; keep unavailable provider capabilities fail closed.
5. Create `IVOC_MEGARUN_FINAL_HANDOFF.md`, release every lease, and stop only
   at `IVOC AAA PRODUCTION COMPLETE — FOUNDER LEDGER SATISFIED`.
