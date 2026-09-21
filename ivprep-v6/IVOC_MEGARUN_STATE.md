# IVOC final AAA production megarun state

Updated: 2026-09-21 14:27 America/New_York
Mission: `IVOC-CONVERGE-8001`
Authority: `DR-290`
Branch: `codex/ivoc-converge-8001-production`
Required terminal marker: `IVOC AAA PRODUCTION COMPLETE — FOUNDER LEDGER SATISFIED`
Current terminal status: `ACTIVE P0 RUNTIME PRESENTATION RECOVERY — NOT COMPLETE`

This is the one living requirement ledger required by the final Founder
completion directive. A status of `LIVE UNVERIFIED` means the capability is
present in the active source lineage but has not yet passed acceptance against
the actual production route and deployment.

## Founder POV production acceptance — current

- **Sign-in recovery — LIVE VERIFIED (2026-09-21).** A valid RISE cookie was
  incorrectly denied access to `/api/auth/start`, preventing fresh HQ sign-in.
  DR-333 authorizes the exact shared-auth guard correction only. The existing
  WordPress handoff now remains reachable; RISE sessions gain no HQ permission
  or cookie at start. Red-before/green-after regression and independent review:
  33/33 focused auth/IVOC route tests pass. The RISE fixture was aligned to the
  existing owner `programSpecialtyId` contract; no runtime projection changed.
  Source `4b5b33b56d0fa3debbfa0e732687f281ef31e28e`, deployment
  `94a0c8ea-da4d-4068-9193-8436ce52b6f7`, image
  `sha256:3d549c6826941b9be171fbaf6834a08140a8964c6940f1d2d714d8c0e5041117`.
  Reloading the actual blocked Chrome handoff tab completed fresh sign-in and
  rendered production IVOC Home as Dr Brian / FOUNDER / ADMIN (`wp:1`). Health
  is 200; anonymous product access remains 401. Rollback: source
  `bb39367fc8e3b4f03b034893f519e7b27db7a494`, deployment
  `d4885074-1e2c-4a9b-9b5c-1cbdec476980`, image
  `sha256:3a2127783c087ea63493a2bbac9fe8f779868e09e21baacc4d716f7dcd788a6b`.
  Isolated source custody: `/Users/brianb/MissionMed_worktrees/ivoc-auth-handoff-fix`;
  released source remains on `codex/ivoc-converge-8001-production`. This narrow
  access repair does not change the remaining multi-turn/barge-in/two-sided
  audible replay or overall Founder-ledger acceptance states below.

- Founder production POV reopens Runtime Interview Room presentation acceptance:
  working camera/overlays/native conversation must transition out of readiness.
  Candidate.2 + amendments remain canon. One read-only Astra 6 runtime director
  reviewed current source and production baseline: realistic interviewer-primary
  with self-view; coached candidate-primary with delivery/voice rails; compact
  runtime header; persistent End; collapsed transcript; no default debug controls.
  No backend/provider/recording/detector replacement is authorized or needed.
- Current fix-forward implements a pure lifecycle-first presentation projector,
  retains exact mounted media anchors, guards camera callbacks from rewinding
  live state, preserves failed-save retry, shows live device/connection failures,
  and prevents saved Results from borrowing current live metrics. Independent
  Astra code review raised four concrete issues; these were corrected before
  release. Code is deployed; production Home → readiness → Joining → distinct
  live Interview Room → Saving → Results was traversed twice using the physical
  FaceTime camera. Realistic mode removes preflight/Start/navigation; coached
  mode places live delivery/voice rails around the candidate. A compact-video
  overlay alignment defect found during that POV was corrected and reverified
  visually. Hidden guides leave measurements updating. No new provider/capture
  graph was introduced. Transcript remains collapsed by default.
- Runtime source `b3902a6b3441e8ccabe794369e8dfaee64a0dd7e` passed 7/7 final
  room regressions; preceding focused presentation/media/durable suite passed
  47/47. Save retry now retains the already-sealed recording receipt if Results
  filing fails. Astra's independent source review found no remaining blocking
  presentation issue; narrow instrument-caption clipping is nonblocking polish.
- Production recordings created at 07:07 and 07:13 saved successfully and opened
  Results/Film Room. The 07:07 recording reopened from Answer Library after cold
  reload and its video playback advanced. These canaries each contain only the
  interviewer's opening transcript turn; they do NOT establish spoken multi-turn,
  barge-in or audible two-sided replay acceptance. Screenshots of the live room,
  aligned guides and full Results were attached directly in the task.
- Immediate rollback before this presentation release: commit
  `279abfaad13906647f3304a647179d5a624550ea`, deployment
  `950cecdb-8430-4a68-8efe-e3732133f8f0`, image
  `sha256:d39d999cdf03fea7c59296ad061362e1f1e4af197dbda3436755e73ae7c8484d`.

- Current healthy production runtime: commit
  `b3902a6b3441e8ccabe794369e8dfaee64a0dd7e`, Railway deployment
  `a64b0e7e-8f63-4492-8769-61e3f8090a7a`, image
  `sha256:64053433049e9121a1cc468bba738ff06ac2472f0a74aa15afc8dc5b1015eb76`;
  `/health` is HTTP 200 and anonymous product access fails closed at HTTP 401.
- **Journey A — SELF PRACTICE: PASS.** The production UI reached Question Pool,
  Device Check and Coached Practice; FaceTime HD Camera visibly rendered at
  640x480; the physical microphone and live Analytics ran; the account recording
  saved; Results, Film Room and Library reopened the signed private recording
  after a cold reload.
- **Journey B — AI MOCK INTERVIEW: LIVE DEPLOYED / TWO-SIDED REPLAY POV
  WAITING.** The normal production UI reached the actual Interview Room; the
  `gpt-live-1` interviewer audibly asked the selected question, heard a physical
  microphone answer, asked contextual follow-ups, maintained the recording and
  tore down cleanly. The saved session reopened through Results, Film Room and
  Library, but the Founder subsequently proved that replay preserved only the
  candidate microphone and omitted the audible interviewer. Commit `bc47ec9`
  corrects the production graph by mixing the candidate microphone with a silent
  tap of the one authoritative GPT-Live remote track; the opening question is now
  gated until playback and the recorder tap are both bound. The correction is
  healthy in production and its focused suite passes 85/85. Actual audible
  two-sided replay after save and cold reload, deliberate physical barge-in and a
  physical pool-ordered next-question exchange remain external POV evidence
  waiting.
- **Journey C — PROGRAM-AWARE INTERVIEW: PASS.** Searching `SUNY` returned 44
  readable authorized RISE results; SUNY Downstate Primary Care was selected and
  retained; the Context Pack contains the selected program/specialty and RISE
  receipt; the production interviewer used that context in its follow-up.
- **Journey D — ADMIN STUDENT LIBRARY: PASS for Founder/Admin traversal.** Admin
  selected `brinyu`, opened that student's Results and transcript-backed Film
  Room, and played the signed private recording without actor/subject confusion.
  Genuine second-Admin, entitled-360, negative-role and cross-subject identities
  remain external acceptance evidence waiting; no identity was forged.
- Session `40ff8df2-58df-4b00-ae67-24c0da959f7f` remains the current physical
  program-aware interview record: 74.06 seconds, sealed private recording of
  16,661,773 bytes, 11 conversation turns, 8 canonical transcript turns, one
  answer range and 8 persisted coaching-evidence observations. Cold reload
  reconstructed the transcript and evidence without a provider re-call. It is
  not accepted as two-sided replay evidence because its persisted media omitted
  interviewer audio.
- The current source makes builder/readiness progression truthful, blocks Review
  until at least one question is selected, preserves the visible camera binding
  across calibration/practice/interview transitions, and replaces student-facing
  engineering terms and raw segment IDs with plain evidence language. Admin
  diagnostics remain available. The changed focused suite passes 25/25.
- The prior `ACCOUNT SAVE UNAVAILABLE FOR THIS REP — IVOC_INTERNAL_ERROR` path is
  resolved. Unverified manual RISE text no longer creates a false provider
  dependency, and the accepted physical rep proves save, reload and signed
  private playback through the Founder-facing production UI.

## Canon and source lineage

- F1 canonical product commit:
  `9fb848c26f6f220b61900138acb1b51622f12b5d`.
- Founder-facing presentation: recovered Astra candidate.2, fingerprint
  `dedb726bde521a135bec2286ad4cd5a877a68fc7ecd6144fde16b76bc9c09ac4`.
- The 7002 M1 surface is diagnostic-only and is not production presentation
  canon.
- Candidate.2 presentation integration successor:
  `84e750e4540acd5479ee72291e7b9d1c38f2f351`.
  The final bounded presentation reconciliation is
  `2e06b59fc9a156c966dcd7574cc2a7c6fbea1924`. Authenticated production
  independently accepted the distinct six-step composition, separate
  StoryForge reveal/inclusion consent, rich signal-specific readiness panels,
  plain student copy, and adapter-owned media/Analytics boundary. At 1158 by
  502 pixels, the readiness stage is contained at x319.801–532.883 inside its
  x306.896–545.788 preview, before the x559.787 workspace and x812.188
  Question Pool.
- Durable presentation boundary: Astra canonical components consume stable
  view-model/capability adapters; canonical business, session, database and
  provider behavior remains below that boundary. Current page composition is
  not presentation canon merely because a capability is wired into it.
- Latest functionality-accepted presentation/runtime deployment:
  `d843d3dd-7263-4013-a7e5-d49dce63825d`, exact commit
  `2e06b59fc9a156c966dcd7574cc2a7c6fbea1924`, image
  `sha256:3f2f8ce2ce6b5730eaa7e2f87ecceaa0a8ae2330a9742646d45fc94310981556`.
  `/health` is HTTP 200, anonymous `/iv-prep-on-call/` fails closed at HTTP
  401, and authenticated production passed live visual plus exact DOM-geometry
  acceptance for the final Candidate.2 presentation correction.
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
- File Vault current-CV projection and IVOC consumer:
  owner source commit `9ba360b294436ef4860a25c07043fd512316eb61`, exact
  live-baseline runtime commit `2587f3cba1dda48732cedbace09cbed44257a175`,
  and IVOC commits `c8043a6dfd59f9e57e1c85ce5aa5a69dd4aceb31` plus
  `a2e945c391043218a0544c55220b69027440f6ba`. File Vault now exposes only a
  session-consented, immutable-version-bound, reviewed structured CV projection
  through its existing owner/entitlement boundary; raw bytes, object identity
  and signed URLs never cross it. IVOC fetches that projection server-side only
  when CV/File Vault is explicitly selected, requires the same WordPress
  subject and session consent receipt, and fails closed on missing auth,
  unavailable owner data, malformed data or source drift. Owner and consumer
  focused suites pass. The minimized owner runtime and IVOC consumer are live;
  anonymous owner/API access and the product route fail closed. One genuine
  current-CV positive projection/readback remains external evidence waiting.
- StoryForge approved-story projection and IVOC consumer:
  owner commit `3cffc77f84dd48cec956fec72ec80a2487357dba`, Railway deployment
  `6393da35-c0ad-4d56-be6e-e5f912703344`, and IVOC commit
  `14f115c0c17e8c15054e05fe6ad1537f923e1fb0`. The owner publishes only
  consented, versioned, minimized story summaries/themes through a bounded
  server token exchange; IVOC reads them only when StoryForge is explicitly
  selected. Anonymous owner/API access fails closed. Live Builder readback at
  `f87f572` shows StoryForge available and opt-in selection works. A genuine
  consented positive story remains external evidence waiting.
- RISE program projection and IVOC consumer:
  owner source `e0f9eb0` and IVOC source `5824268` implement the minimized
  authenticated `rise.program_cheat_sheet` projection, exact program/release
  binding, provenance, sourced highlights and role presence without names.
  The exact active 6,245-program release artifacts were recovered from their
  verified clean-start owner lineage without changing owner data or hashes.
  RISE deployment `6d1fd003-49a5-4696-978b-fbf357272e2f`, image
  `sha256:31165b23e8c6720acc28d9a5c657f5bca9a222691532d8477eac1ec2e603af78`,
  and HQ deployment `2ee15d42-2ec8-4342-87ae-a91056853265` are healthy. Real
  production canary session `3a6637db-4051-407a-9679-b18a45290e7e` received
  owner HTTP 200, persisted exactly one RISE projection input, one source
  receipt and one `ctxpack:` receipt, with zero documents, stories or people;
  it was then abandoned normally without recording.
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

## Founder blocker reclassification

- **A — ENGINEERING-EXECUTABLE NOW:** Application Intelligence, deterministic
  multi-turn capture, single-audio teardown, prior-session aggregation,
  prior-self comparison, the presentation-adapter correction, StoryForge
  owner/consumer wiring, RISE owner/consumer source, the live non-secret
  capability manifest and the two-sided AI recording mix are implemented. The
  Founder-reopened distinct runtime-room presentation and save-retry defects
  have now been fixed forward and deployed. This does not make the complete AI
  journey accepted. No additional blocking source defect was identified by the
  bounded Astra review; any new genuine POV defect reopens engineering.
- **B — EXTERNAL EVIDENCE WAITING:** one genuine saved AI Mock must audibly replay
  interviewer → candidate → contextual follow-up → candidate after cold reload;
  one deliberate physical barge-in and pool-ordered next-question exchange;
  genuine multi-session recurrence;
  authenticated second-Admin, entitled-360 and negative/wrong-owner/cross-subject
  role evidence; positive current-CV and consented-story owner data; and completed
  Webex media while its owner reports `RECORDING PROCESSING`. Recheck only after
  the relevant user, provider or session event changes.
- **C — OWNER-SCOPED INTEGRATION REQUIRED:** no currently authorized owner-side
  engineering remains. File Vault, StoryForge and RISE projections plus IVOC
  consumers are deployed through their owner boundaries. Genuine current-CV
  and consented-story positive data remain category B, not engineering stops.
- **D — EXPLICITLY DEFERRED:** active LemonSlice/provider execution. Match
  Bridge cross-product pickup remains low priority because the IVOC-owned
  consent/version/revocation clip seam is already live accepted.
- **Prior 96% estimate withdrawn:** the rejected runtime composition showed that
  component completion overstated user-journey acceptance. Distinct-room visual
  transitions, save and reload are verified above; the full AI journey remains
  open until actual spoken follow-up/interruption and audible two-sided replay
  pass. No replacement percentage is claimed from component/test counts.
- **Exact next executable acceptance:** on the current production Home choose
  AI Mock Interview, connect FaceTime camera + physical microphone, Start,
  answer aloud, respond to the follow-up, interrupt once, finish/save, then
  listen to both voices in Film Room and repeat playback after reload. Browser
  control can navigate this path, but current tooling does not supply genuine
  human microphone speech or independently hear output; no synthetic substitute
  is accepted. Other identity/data/provider waits above recheck only on change.

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
| 5 | Candidate.2 premium Home visual DNA, hierarchy, contrast, responsive composition | LIVE VERIFIED | Exact candidate.2 successor plus the bounded reconciliation at `2e06b59` is live on `d843d3dd…`. Authenticated production and a fresh independent read-only verifier accepted the six distinct compositions, StoryForge consent/reveal, plain student copy, dark signal controls and 1158 by 502 readiness geometry with zero stage/workspace/Question Pool overlap. |
| 5 | Six-step builder and Practice Goal modes | LIVE VERIFIED | Authenticated production Chrome traversed all six distinct candidate.2 step compositions without collapsing them into the rejected generic-card builder. |
| 5 | Question Pool branching, persistent rail, presets, ordering, 193-question corpus | LIVE VERIFIED | Deployment `d94bf8fa…` visibly preserved the right rail on Practice Goal and Question Pool, enforced category → subcategory → question progression for Behavioral, selected real `BEH-001` from the 193-question corpus, and exposed ordered move/remove controls in the rail. |
| 5 | Separate Interviewer and Program steps with role/style controls | LIVE VERIFIED | Authenticated production traversed the independent Program and Interviewer compositions with Program Director, Faculty, Chief Resident, APD and Dove/Peacock/Owl/Eagle controls. RISE hydration remains a separate owner projection. |
| 5 | RISE-backed Program search, sourced highlights, people, freshness/manual fallback | LIVE VERIFIED | RISE owner `e0f9eb0` and IVOC `5824268` are live at deployments `6d1fd003…` and `2ee15d42…`. Production canary `3a6637db…` bound the exact 6,245-program release, received owner HTTP 200 and persisted only the minimized `rise.program_cheat_sheet` input plus versioned source/Context Pack receipts. |
| 5 | Environment + Context sources and opt-in StoryForge reveal | LIVE VERIFIED | Authenticated production visibly renders MissionMed/Webex/Zoom/Teams, enables StoryForge/CV/File Vault/RISE from the server capability manifest, keeps MCC disabled, truthfully shows empty Top 3, keeps Prior IVOC available, and exposes separate StoryForge suggestion and inclusion consent. With no positive owner data, the reveal truthfully reports no verified match and leaves inclusion off. |
| 5 | Truthful Readiness & Calibration checks | LIVE VERIFIED | Deployment `d843d3dd…` presents Devices, Visual signals, Voice signals and Signal health with per-signal guidance over the real capability adapter. Live unloaded states remain truthful; 70 focused tests pass. Independent 1158 by 502 readback measured the stage fully inside its preview with no overlap against the workspace or persistent Question Pool. |
| 6 | Real modular camera/mic Analytics with truthful availability states | LIVE VERIFIED | Physical production rep produced real microphone PCM plus face, hands, head and framing telemetry; unavailable signals continued to fail closed. |
| 6 | Volume, pace, pauses, pitch, fillers and transcript boundaries | LIVE VERIFIED | Physical production reps proved live volume, variation, pitch, pace, cadence and pause states. Authenticated saved session `0d250e0c-1011-48bc-a416-f9ae4c2c735f` then cold-reconstructed three canonical transcript segments, 36 words, the 0 s–18 s capture-owner boundary and zero bounded filler candidates on deployment `6b5bad11…`; the UI discloses the bounded lexicon and explicitly rejects hidden-trait inference. |
| 6 | Admin measurement/visibility controls and prohibited-inference safeguards | LIVE VERIFIED | Production Admin and Student Coached Practice face/head, hand/finger, body/pose and framing/head-orientation overlays were visibly aligned to the real camera surface and independently toggleable; measurement continued while hidden. True eye-gaze visualization remains unsupported; the product exposes only defensible camera-facing/head-orientation proxies. |
| 7 | Canonical clock across recording, transcript, Q/A, Analytics, Results and clips | LIVE VERIFIED | A production CORE-01 rep persisted one complete session contract, nine timestamped conversation turns and one answer segment; the Film Room transcript row sought private replay to 2.26 s after reload. |
| 7 | Private durable capture, canonical transcript, answer/follow-up ranges and gaps | LIVE DEPLOYED / TWO-SIDED REPLAY WAITING | Physical production AI session `40ff8df2…` persisted the candidate microphone, 11 conversation turns, 8 canonical transcript turns, one answer range and 8 coaching-evidence observations, but Founder playback proved its media omitted interviewer audio. Commit `bc47ec9` now records candidate mic plus a silent tap of the sole authoritative GPT-Live track and is live on `2442f856…`; actual two-sided audible replay after cold reload remains required. |
| 8 | Evidence-grounded Results | LIVE VERIFIED | Production post-answer Results and bounded transcript/context analysis returned evidence-cited observations tied to transcript segments without unsupported scoring. |
| 8 | Film Room synchronized replay and Flight Recorder timeline | LIVE DEPLOYED / TWO-SIDED REPLAY WAITING | Signed owner playback, overlays and transcript seeking remain accepted. AI Mock media now receives both candidate mic and the authoritative interviewer track, but actual production playback must still audibly prove question → answer → follow-up → response after reload. |
| 8 | Durable student Video Library and Admin student-library access | LIVE VERIFIED | Cold production reload returned 14 owner-bound sessions to authenticated Admin `wp:1`; the semantic CORE-01 answer reopened through signed private playback with its timestamped transcript spine and three persisted observations. Student view still hides the Admin selector. Negative-role isolation remains tracked separately. |
| 9 | Current supported realtime transport and contextual InterviewBrain | LIVE VERIFIED | Production `gpt-live-1` WebRTC canary created twice through the authenticated IVOC broker, reached `session.started`, exchanged native audio/transcript events, and ended with provider hangup HTTP 200. |
| 9 | Natural turns, answer-grounded follow-up, memory, move-on and barge-in | LIVE VERIFIED / PHYSICAL BARGE-IN WAITING | The actual production Interview Room audibly asked the selected question, heard the physical applicant answer and asked contextually grounded follow-ups. Provider canary evidence still proves move-on and response truncation; one deliberate human interruption during interviewer speech remains external acceptance evidence waiting. |
| 9 | Pool/context weighting, clean teardown, single audio authority | LIVE VERIFIED / PHYSICAL NEXT-QUESTION WAITING | The physical program-aware session used the selected canonical question and RISE Context Pack, persisted a single native-audio authority and tore down cleanly. The deployed contract and canary prove exact pool order and move-on; one physical pool-ordered next-question exchange remains external acceptance evidence waiting. |
| 10 | Server-owned Application Intelligence Context Pack hydration | LIVE VERIFIED | Genuine `brinyu` production session `1b973235-de3b-4d2c-a39a-c51e49df38e8` persisted one owner-bound private pack and `ctxpack:` receipt. Two authenticated `gpt-live-1` WebRTC canaries resolved that same server-only contract, reached live audio/transcript exchange and clean teardown; neither Actor block nor receipt crossed the browser boundary. |
| 10 | File Vault context/performance-reference seam | LIVE DEPLOYED / POSITIVE EVIDENCE WAITING | Mission `J1-FILEVAULT-1021-IVOC-CV-PROJECTION` implemented the minimal S2S projection at owner source `9ba360b…` and deployed only that projection from exact live baseline commit `2587f3c…`; IVOC's selected-source, server-authenticated consumer is live at `a2e945c…`. Anonymous projection/bootstrap access is 401, direct object-root access is 403, product health is 200 and anonymous IVOC access is 401. A genuine authorized reviewed current-CV positive projection is not presently available and remains external evidence waiting. |
| 10 | StoryForge opt-in story/theme and performance evidence | LIVE DEPLOYED / POSITIVE EVIDENCE WAITING | StoryForge's consented, versioned projection is live at `3cffc77` / `6393da35…`; IVOC's selected-source server consumer is live at `14f115c`. Anonymous access is 401 and malformed/cross-subject/absent data fails closed. A genuine consented positive story projection remains external evidence waiting. |
| 10 | RISE sourced/fresh program context | LIVE VERIFIED | Exact current owner release `rise_registry_acgme_2026-09-20_50d08ea6f2da` is live behind the minimized server-only projection. Session `3a6637db…` proved authenticated owner HTTP 200, exact program/release binding, source-version/hash provenance and a single private `ctxpack:` receipt; no raw corpus or people crossed into IVOC. |
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

- Latest healthy MissionMed HQ production is Railway deployment
  `2442f856-4e56-4371-a327-5dcb63f6b303` from exact product commit
  `bc47ec996d05759bc5507fa9b27ba36cb961fc68`; `/health` is HTTP 200, the
  unauthenticated product route fails closed at HTTP 401, and the verified
  second-Admin allowlist remains `wp:1,wp:107`.
- Runtime bindings point to dedicated project `bscnrgqlwsyygyfrbhfn` without
  exposing credentials. Context/transcript flags are enabled for the bounded
  production path; paid-test provider controls remain server-only and fail closed.
- Current canonical IVOC source does not contain the registered StoryForge V5
  and Timeline roots. Live checks previously found sibling-owned StoryForge,
  Timeline/USCE, and Matrix drift. No generic canonical waiver mechanism was
  found. IVOC must consume stable owner contracts and must not mutate or waive
  unrelated sibling security/privacy dependencies.
- The ten-surface Matrix lock was reconciled to verified current owner/runtime
  identities without mutating owner assets. Authenticated production `wp:1`
  completed Founder-facing IVOC → canonical WordPress Matrix → the existing
  Matrix `IV Prep On-Call` module → Founder-facing IVOC. The stale Matrix final
  path is adapted inside IVOC with an authenticated no-store redirect; the
  sibling Matrix source remains untouched. Entitled-360 launch acceptance
  remains tracked with the role canaries.
- Application Intelligence contracts, provenance, signals, Context Pack and
  Director arbitration are integrated. Production now builds and persists a
  server-only Context Pack during session creation, preserves its receipt
  across Spine/context writes, never returns the full pack or Actor block to
  the browser, and resolves the bounded Actor block directly into the trusted
  GPT-Live startup path. Genuine authenticated session/readback and live native
  audio acceptance passed. IVOC-owned Mentor Top 3 is now a live versioned
  projection. File Vault's owner projection and IVOC consumer are live with
  fail-closed negative-path acceptance; positive current-CV evidence waits on
  genuine owner data. StoryForge owner/consumer wiring is live with positive
  consented data waiting. RISE owner/consumer wiring is live verified against
  the exact current owner release and a real production Context Pack receipt.
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

1. When a genuine human session becomes available, accept deliberate physical
   barge-in and the pool-ordered next-question path once.
2. Recheck File Vault and StoryForge positive projections only after genuine
   authorized current-CV or consented-story data exists.
3. Run second-Admin, entitled-360 and negative/wrong-owner acceptance only from
   genuine authenticated sessions; do not forge identity evidence.
4. Recheck Webex only when the owner changes from `RECORDING PROCESSING` to a
   completed private recording.
5. Accept longitudinal recurrence only after enough genuine saved sessions
   exist. Do not manufacture recurrence.
6. Active LemonSlice execution remains deferred. Create the final handoff only
   after the external evidence above closes and the terminal marker is true.
