# IVOC final AAA production megarun state

Updated: 2026-09-17 12:13 America/New_York
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
- Active presentation deployment:
  `2317c290-ff6d-4c71-8e1f-400c67a558e5`, image
  `sha256:b705fc8786e33c5f9071c569af75642bdada2dc167e56372419869cc9c846487`.
- GPT-Live WebRTC InterviewBrain integration:
  `0b272bbc8f1ea168b05603c0da5a0cd7f154bee3`.
- Durable authenticated recording, Analytics-result persistence, playback,
  owner library, and role-bounded views:
  `9701bb0742e65fbf2cdb210265ae4fd0d575dcc4`.
- Explicit Supabase authority binding:
  `655555a19e4e7f40a0ef5a5492b1f7b6079a24a3`.
- Opt-in sealed-recording transcription and evidence-bound Context UI:
  `8e7a76341e6b9688db11a7d8d6185ce030291f36`.
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
| 5 | Truthful Readiness & Calibration checks | LIVE UNVERIFIED | Real capability-state composition passed local Chrome; physical live camera/mic acceptance remains. |
| 6 | Real modular camera/mic Analytics with truthful availability states | LIVE UNVERIFIED | Real signal registry/source tests exist; production physical-device acceptance remains. |
| 6 | Volume, pace, pauses, pitch, fillers and transcript boundaries | LIVE UNVERIFIED | Analytics/transcript source exists; live calibration and limitations proof remain. |
| 6 | Admin measurement/visibility controls and prohibited-inference safeguards | LIVE UNVERIFIED | Source controls/contracts exist; live Admin/student proof remains. |
| 7 | Canonical clock across recording, transcript, Q/A, Analytics, Results and clips | LIVE UNVERIFIED | Durable event/session spine is migrated; end-to-end reload proof remains. |
| 7 | Private durable capture, canonical transcript, answer/follow-up ranges and gaps | LIVE UNVERIFIED | Production schema is live; signed playback, seal, reload and explicit-gap acceptance remain. |
| 8 | Evidence-grounded Results | LIVE UNVERIFIED | Source capability and production tables exist; production session proof remains. |
| 8 | Film Room synchronized replay and Flight Recorder timeline | LIVE UNVERIFIED | Source surfaces exist; synchronized production-media proof remains. |
| 8 | Durable student Video Library and Admin student-library access | LIVE UNVERIFIED | Source storage/library paths exist; role/private-media proof remains. |
| 9 | Current supported realtime transport and contextual InterviewBrain | LIVE UNVERIFIED | WebRTC integration is in source; current official API revalidation and paid canary remain. |
| 9 | Natural turns, answer-grounded follow-up, memory, move-on and barge-in | LIVE UNVERIFIED | Requires bounded production conversation canary. |
| 9 | Pool/context weighting, clean teardown, single audio authority | LIVE UNVERIFIED | Requires production telemetry and teardown proof. |
| 10 | File Vault context/performance-reference seam | NOT STARTED | Exact live owner contract and consented projection still required. |
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
| 15 | Canonical recording/Analytics/replay/overlay/scoring/library save | NOT STARTED | Full Studio lifecycle remains. |
| 15 | Deepest viable Webex or staged supervised adapter | NOT STARTED | Owner/provider constraint and shipped seam remain. |
| 16 | Per-question semantic Answer History | NOT STARTED | Ranges exist in schema; product history surface and proof remain. |
| 16 | Match Bridge Ready promotion with consent/audience/revocation/version | NOT STARTED | Bounded clip contract and production proof remain. |
| 17 | Provider-neutral embodiment adapter and Brain/session separation | NOT STARTED | Active provider integration remains prohibited; neutral seam is still required. |
| 17 | Flush/interruption/motion contract, Admin preview and cost controls | NOT STARTED | Neutral contract/control surface remains. |
| 17 | Fictional 10–15 avatar configuration model | NOT STARTED | Configuration/catalog only; no real-person cloning/inference. |
| 17 | Active LemonSlice provider integration | DEFERRED LEMONSLICE ONLY | Founder explicitly deferred active provider/spend. |
| 18 | Dr Brian/brinyu Admin and second authorized Admin | LIVE UNVERIFIED | Requires actual authenticated production acceptance. |
| 18 | Entitled 360 student and non-entitled/revoked/expired denials | LIVE UNVERIFIED | Fail-closed contracts exist; actual role/entitlement canaries remain. |
| 18 | Wrong-role/wrong-mentor denial and actor/subject separation | LIVE UNVERIFIED | Requires authenticated production negative-path acceptance. |
| 18 | Private media, signed/revocable playback, no public leakage, audit trail | LIVE UNVERIFIED | Production RLS/grants are verified; storage/playback/audit canary remains. |

## Current production and governance gates

- MissionMed HQ production is now Railway deployment
  `2317c290-ff6d-4c71-8e1f-400c67a558e5` from exact product commit
  `84e750e4540acd5479ee72291e7b9d1c38f2f351`; health is ready and the
  unauthenticated product route remains fail-closed at HTTP 401.
- Runtime bindings must be moved from the historical development target to
  `bscnrgqlwsyygyfrbhfn` without exposing credentials. Context/transcript flags
  and paid-test provider control remain fail-closed until the bounded canary.
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

## Next execution lanes

1. Commit and remotely read back this migration/state tranche; release its lease.
2. Under a fresh narrow lease, bind the dedicated production project and deploy a
   canary from the exact remotely read-back IVOC commit with rollback identity.
3. Run physical camera/mic Analytics, authenticated role/privacy/private-media,
   durable session/reload, Results/Film Room/Library, and bounded GPT-Live canaries.
4. Continue fix-forward implementation across every `NOT STARTED` or
   `LIVE UNVERIFIED` ledger row, respecting sibling-owner boundaries.
5. Run fresh independent acceptance against the actual production route.
6. Create `IVOC_MEGARUN_FINAL_HANDOFF.md`, release every lease, and stop only
   at `IVOC AAA PRODUCTION COMPLETE — FOUNDER LEDGER SATISFIED`.
