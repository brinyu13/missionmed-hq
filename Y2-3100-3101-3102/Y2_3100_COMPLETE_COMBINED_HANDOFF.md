# Y2-3100 Complete Combined Handoff

- Contract: `missionmed.y2.combined-handoff.v1`
- Source files: `10`
- Inclusion law: every primary source report below is unabridged exactly once.
- Derived subgroup combined handoffs are not nested into the master because nesting would duplicate primary report contents.

<!-- BEGIN Y2_3100_DISCOVERY_EXECUTIVE_SUMMARY.md -->
# Y2-3100 Discovery Executive Summary

## Verdict

Read-only discovery is complete. The MissionMed Interviewer Brain is compatible with Y1 only as an additive, default-off capability behind the existing CAM gateway, authentication, entitlement, session, grant, audit, and deletion boundaries. Phase 0 must remain an isolated synthetic text harness.

## Verified Y1 State

- The public CAM dispatcher mounts 40 core contracts and no interview, transcript, or RISE routes: `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/server.mjs:42` and `src/routes/contracts.mjs:3`.
- JWT signature, issuer, audience, expiry, and subject are validated, followed by active CAM-session enforcement: `src/auth/verifyJwt.mjs:30` and `src/auth/requireCamSession.mjs:40`.
- Entitlement derives from trusted WordPress-originated `app_metadata`; launchers, URLs, and `user_metadata` cannot grant access: `src/routes/entitlements.mjs:48`.
- Mentor access is explicit-grant scoped, and only a human reviewer can author an Order: `src/routes/reviews.mjs:187` and `migrations/20260715190000_y1_cam_4008a_integrity_expand.sql:371`.
- CAM deletion establishes durable intent and requires provider-absence evidence: `src/lib/deletionOrchestrator.mjs:95` and `:334`.
- CIE C0 supplies compatible local session, consent, track-item, Moment, deep-link, and replay contracts, but its production command adapter is absent.

## Contradictions And Gaps

- The Y2 combined handoff is a synopsis, not an unabridged combined package; all five exact sibling documents remain controlling inputs.
- CAM does not have purpose-specific AI consent. Current media provenance says `analysis_consent: not_granted` at `src/routes/media.mjs:227`.
- Current Stream intake is a short video contract capped at 150 seconds; it cannot be assumed to support a 15-25 minute future voice session.
- There is no adaptive interviewer view, long-session audio lifecycle, LiveKit rail, ElevenLabs rail, model adapter, or `CAM_INTERVIEWER_*` feature set in accepted CAM.
- The current MissionMed OS product index has no CAM/IV Prep On-Call passport.

## Decision

Proceed with the isolated Phase 0 Brain harness. Do not mount it into CAM, implement voice, create a provider account, or claim pilot readiness for real learners. Phase 1 requires separate consent, long-session media, device coordination, provider retention/deletion evidence, human IMG accent testing, network impairment, and identical-Brain two-rail comparison.
<!-- END Y2_3100_DISCOVERY_EXECUTIVE_SUMMARY.md -->

<!-- BEGIN Y2_3100_SOURCE_AND_AUTHORITY_MAP.md -->
# Y2-3100 Source And Authority Map

## Canonical Roots

| Authority | Root | Classification |
|---|---|---|
| Founder ticket | `/Users/brianb/.codex/attachments/13bc2e3f-94b6-4a67-b2c1-1cfd9afe84fc/pasted-text.txt` | Active execution authorization |
| Y2 decision package | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/outputs/Y2-3100/` | Exact decisions and research inputs |
| CIE constitution | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CIE-5000/` | Proposed constitution |
| CIE amendment | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CIE-5000A/` | Ready-for-ratification amendment; explicit errata control |
| CIE atlas | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CIE-9000/` | Living planning registry |
| CIE C0 | `/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/` at `5b28931ea8250c385a4184e05725fbceb8282709` | Certified isolated executable foundation |
| Accepted CAM | `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/` | Current accepted scoped runtime evidence |
| CAM lineage | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CAM-3023/` and `Y1-CAM-3024/` | Accepted predecessor lineage |

## Precedence Applied

1. MissionMed Engineering OS and current runtime authority.
2. Founder ticket.
3. Exact Y2 decision and blueprint siblings.
4. CIE 5000A explicit amendments and errata.
5. CIE 5000.
6. Certified C0 executable contracts.
7. CIE 9000 living registry.
8. Accepted CAM runtime contracts.

## Package Integrity

- CIE 5000: all 5 individual files occur unabridged exactly once in its combined handoff.
- CIE 5000A: all 14 individual files occur unabridged exactly once.
- CIE 9000: all 10 individual files occur unabridged exactly once.
- CIE C0: all 15 individual reports occur unabridged exactly once; canonical and mirror combined handoffs are byte-identical at SHA-256 `dbdc0419da1290d422600b7448a22286d925f6fd043647caa05578d35e79222c`.
- Y2-3100: none of the five sibling documents occurs unabridged in `Y2-3100_COMPLETE_COMBINED_HANDOFF.md`; exact decision and blueprint siblings take precedence.

The complete 89-source path, hash, size, modification-time, classification, and conflict ledger is in `Y2_3100_3101_CONTEXT_SOURCE_INVENTORY.json`.
<!-- END Y2_3100_SOURCE_AND_AUTHORITY_MAP.md -->

<!-- BEGIN Y2_3100_SESSION_API_AUTH_AND_RLS.md -->
# Y2-3100 Session, API, Auth, And RLS

## Verified Boundaries

| Boundary | Current authority | Future Y2 rule |
|---|---|---|
| Public API | `cam-api/server.mjs:42` dispatches accepted CAM routes | Additive interview routes may mount only through this gateway under a separate release ticket |
| JWT | `src/auth/verifyJwt.mjs:30-86` verifies JOSE signature, issuer, audience, expiry, and subject | Never accept launcher, URL, or model claims as identity |
| Session | `src/auth/requireCamSession.mjs:40-98` requires an active CAM authority session | Future Brain work must bind to the same session authority |
| Entitlement | `src/routes/entitlements.mjs:48-252` uses trusted `app_metadata` and fails revoked/restricted/expired states closed | Interviewer admission remains server-derived and default-off |
| RLS | `20260714203000_y1_cam_4005r_auth_session_enforcement.sql:142-213` requires fresh entitlement and active session | Every future Y2 table needs FORCE RLS and no direct authenticated lifecycle writes |
| Mentor access | `20260713120000_y1_cam_4004_runtime_closure.sql:617-740` requires an exact active grant | No session-wide or cohort-wide review shortcut |

## CIE Attachment

CIE C0 locally defines the compatible session-clock, track-item, Moment, visibility, grant, and deep-link concepts in `/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/cie/src/`. It is not production authority. Future integration must adapt Y2 turn events onto that spine after a separately reviewed production adapter exists.

## Closed Phase 0 Boundary

The harness has no HTTP public service, JWT acceptance, database role, Supabase key, WordPress handoff, Matrix launch, Arena launch, or production endpoint. Synthetic session IDs are local fixture identifiers and cannot be treated as authentication.
<!-- END Y2_3100_SESSION_API_AUTH_AND_RLS.md -->

<!-- BEGIN Y2_3100_MEDIA_CONSENT_DELETION_AND_PROVENANCE.md -->
# Y2-3100 Media, Consent, Deletion, And Provenance

## Media

- Accepted Stream intake is video-only and capped at 150 seconds: `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/cloudflareStreamProvider.mjs:4-10`.
- R2 currently stores replay JSON sidecars, not long-session audio: `src/lib/r2Provider.mjs:93-125`.
- Phase 0 therefore uses text only. It creates no audio, video, provider object, upload intent, playback capability, or recording.

## Consent

CAM has no mounted purpose-specific AI consent store. `src/routes/media.mjs:227` records `analysis_consent: not_granted`. Membership, entitlement, or mentor sharing cannot be interpreted as AI-processing consent.

Future consent must be separate for live AI processing, recording, transcript, applicant-material grounding, instructor focus items, mentor sharing, research reuse, physiology, and retention. Withdrawal must stop new processing and inherit source-level access and deletion rules.

## Deletion

CAM's accepted pattern creates durable deletion intent before provider mutation and verifies absence before completion at `src/lib/deletionOrchestrator.mjs:95` and `:334`. Future Y2 artifact classes must register in that closure before any learner write.

MissionMed-controlled artifacts require verified absence. In-flight processors that expose no absence API may use only a clearly labeled contractual zero-retention evidence class after founder approval; it must never be called cryptographic or verified deletion.

## Provenance

Every Phase 0 decision records synthetic status, persona/plan/policy/model-adapter versions, evidence references, grounding source IDs and hashes, guard outcomes, event order, and a bounded instructor rationale. It stores no private chain-of-thought and no unrestricted prompt log.
<!-- END Y2_3100_MEDIA_CONSENT_DELETION_AND_PROVENANCE.md -->

<!-- BEGIN Y2_3100_REVIEW_UI_FLAGS_AND_ATTACHMENT_POINTS.md -->
# Y2-3100 Review, UI, Flags, And Attachment Points

## Review

Reviewer identity is directory-derived and write authority is grant-bound at `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/reviews.mjs:187`. The database enforces one human Order per lawful review context at `migrations/20260715190000_y1_cam_4008a_integrity_expand.sql:371`.

The Brain may produce evidence-linked turn decisions and an instructor summary. It cannot create an Order, convert an observation into coaching, or publish a learner judgment.

## UI

Current `cast`, `meet`, and `room` surfaces are scripted at `candidates/cam-hq/public/cam/index.html:651`; the shell owns a single media stream at `:1418`. There is no accepted adaptive interviewer surface. Phase 0 therefore exposes only a local instructor-readable report, with no student UI.

## Flags

`candidates/cam-api/src/config.mjs:151-178` explicitly marks transcript and AI storage unimplemented. No `CAM_INTERVIEWER_*`, LiveKit, ElevenLabs, STT, TTS, model-provider, voice, or avatar runtime exists.

Any later flags must be server-side, false when absent or unknown, and incapable of activation from a URL, frontend state, Matrix, Arena, or user metadata. Rollback must disable acceptance and publication while deletion remains active.

## Future Attachment Points

1. Existing CAM API gateway and authority session.
2. Purpose-specific consent receipt.
3. CIE clock/track-item/Moment adapter.
4. Private Brain worker with least-privilege job contract.
5. Explicit mentor review grant and safe projection.
6. Existing audit/deletion orchestrator.
<!-- END Y2_3100_REVIEW_UI_FLAGS_AND_ATTACHMENT_POINTS.md -->

<!-- BEGIN Y2_3100_REUSABLE_AND_PROHIBITED_COMPONENTS.md -->
# Y2-3100 Reusable And Prohibited Components

## Reuse

- CAM JOSE verification and active authority-session check.
- WordPress-derived entitlement evaluation.
- CAM mutation, ownership, explicit-grant, audit, one-Order, provider-capability, and deletion patterns.
- CIE C0 segmented clock, versioned track item, Moment, consent, per-artifact visibility, deep-link, and replay-sync contracts after production adaptation.
- Existing CAM availability-honesty and redacted-error conventions.

## Prohibited Donors

- The rejected 3031P artifact.
- HQ DBOC transcript/scoring functions or numeric SAF feedback.
- Unmounted CAM transcript placeholder routes.
- Direct Supabase service-role access for a Brain worker.
- Current short-video Stream intake as an assumed long-session voice contract.
- Matrix, Arena, URL parameters, or `user_metadata` as authorization.
- Any prototype, stale duplicate, provider SDK, dead endpoint, learner teaser, or reserved UI surface.

## Phase 0 Isolation

The harness implements local deterministic contracts and adapters only. Its future voice and avatar interfaces are inactive declarations with no provider import, network call, credential field, or accepted write path.
<!-- END Y2_3100_REUSABLE_AND_PROHIBITED_COMPONENTS.md -->

<!-- BEGIN Y2_3100_BLUEPRINT_SOURCE_CONTRADICTIONS.md -->
# Y2-3100 Blueprint And Source Contradictions

| Issue | Evidence | Resolution |
|---|---|---|
| Combined handoff is incomplete | Y2 combined embeds 0/5 sibling documents unabridged | Exact decision and blueprint siblings control |
| AI Interviewer is C10/V2 | CIE 5000A places activation after C2 review quality, C3 transcript, and consent review | Founder ticket authorizes isolated synthetic Phase 0 only, not C10 activation |
| Probe cap differs | Y2 allows 1-3 probes; accepted IVOC law allows 1 at rungs 0-1 and 2 at rung 2+ | Apply stricter 1/2 cap; T1 floors cannot force redundant probes |
| T1 probe floor can conflict with educational utility | Complete answers should transition | Use a rung-balanced fixture set and count only substantive incomplete answers for cap-compatible probing; never over-probe to game T1 |
| Purpose-specific consent assumed by future plan | CAM has no mounted AI consent and records `analysis_consent: not_granted` | No real data or provider work in Phase 0; consent is a Phase 1 prerequisite |
| Voice rail assumes media path | CAM Stream path is video-only and <=150 seconds | Design a separate future long-session contract; do not reuse by assumption |
| CIE contracts exist | C0 is certified locally, but has no production command adapter | Use compatible shapes locally; production attachment requires separate review |
| Skill `version` is overloaded | CIE sources use semantic version and integer publication version | Use distinct `contract_version`, `policy_version`, `skill_version`, and `publication_seq` fields |
| T6 contains voice requirements | Dead-air and rail-kill requirements are voice-phase concerns | Phase 0 tests silence-equivalent, malformed input, reconnect, and ledger restoration; voice claims remain unavailable |

No contradiction requires weakening auth, consent, deletion, evidence, review, or deployment law.
<!-- END Y2_3100_BLUEPRINT_SOURCE_CONTRADICTIONS.md -->

<!-- BEGIN Y2_3100_SMALLEST_SAFE_INTEGRATION_SEQUENCE.md -->
# Y2-3100 Smallest Safe Integration Sequence

1. Qualify the isolated synthetic text-first Brain against exact T1-T7, adversarial fixtures, a frozen holdout, and the kill rule.
2. Obtain founder decisions for D3, D4, D5, D6, D7, and D9 before any real learner or provider processing.
3. Build a separately reviewed CIE production adapter; mount turn decisions as versioned events on the existing session clock and evidence spine.
4. Add purpose-specific consent and Y2 artifact classes to the existing server-owned audit/deletion closure before writes.
5. Add default-off interview session, turn event, transcript revision, capability, usage, and deletion contracts through the sole CAM API gateway. Keep routes unmounted during schema qualification.
6. Add a private Brain worker boundary using job-scoped authority, never a general service-role key.
7. Design a distinct long-session voice-media and device-handoff lifecycle; do not assume the 150-second Stream path is sufficient.
8. Exercise the identical frozen Brain behind LiveKit and ElevenLabs only in a separately authorized Phase 1 rig.
9. Pass consented human IMG accent, network impairment, interruption/reconnect, browser/device, processor-retention, transcript fidelity, spend, and withdrawal/deletion gates.
10. Request an independent release decision before any learner-visible flag, staging mount, or production route.

Rollback at every future step must disable new acceptance and publication without disabling audit or deletion.
<!-- END Y2_3100_SMALLEST_SAFE_INTEGRATION_SEQUENCE.md -->

<!-- BEGIN Y2_3100_D3_D9_RATIFICATION_NOTE.md -->
# Y2-3100 D3 And D9 Ratification Note

## Exact D3 Source

> Approve the grounding extension of IVOC-017 §2: follow-ups may ground on (a) consented applicant-materials packs and (b) instructor-set focus items, in addition to the live transcript. Both consent-gated, both evidence-linked.

Source: `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/outputs/Y2-3100/Y2-3100_AI_INTERVIEWER_DECISION.md:196`.

## D3 Recommendation

Ratify with conditions. Permit approved MissionMed domain packs, explicitly authorized applicant-material packs, and instructor-set focus items. Every source must be purpose-scoped, allowlisted, evidence-linked, revocable, access-controlled, and deletion-inheriting. Instructor focus may direct attention but is not evidence that an applicant has a weakness. Prohibit unrelated records, silent profile construction, and cross-session reuse.

D3 is not required for the synthetic Phase 0 harness. It is required before real applicant-material grounding.

## Exact D9 Source

> Deletion evidence-class ruling: 4008A law requires provider absence proof, but in-flight processors (STT, LLM, TTS) expose no absence-verification API; their deletion guarantee is contractual zero-data-retention, a weaker evidence class. Brian must either accept contractual ZDR in lieu of absence proof for in-flight processors (recorded as such in the deletion closure, never presented as verified absence) or constrain the vendor set to options where verification exists.

Source: `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/outputs/Y2-3100/Y2-3100_AI_INTERVIEWER_DECISION.md:202`.

## D9 Recommendation

Accept only as an explicitly weaker evidence class. MissionMed-controlled artifacts require verified absence or existing Y1 closure proof. A transient processor requires vendor-specific contractual retention/ZDR evidence, configuration proof, contract version, and a recorded limitation. Never label contractual ZDR as cryptographic proof or verified absence.

D9 does not block the synthetic local harness. Unresolved vendor-specific D9 evidence blocks any real-learner processing.
<!-- END Y2_3100_D3_D9_RATIFICATION_NOTE.md -->

<!-- BEGIN Y2_3100_UNKNOWN_AND_BLOCKER_REGISTER.md -->
# Y2-3100 Unknown And Blocker Register

## Phase 0

No external blocker prevents the isolated synthetic text harness. The frozen holdout, evaluator, policy, ledger, fixtures, and local report remain fully local.

## Future Phase 1 Unknowns

- Vendor-specific contractual retention, no-training, region, and deletion evidence.
- LiveKit-to-R2 egress suitability and archival transcript fidelity.
- Long-session media contract, device handoff, and browser support.
- Human IMG accent and code-switching performance.
- TURN/TCP, 100-150 ms RTT, packet-loss, barge-in, and recovery behavior.
- Exact rail cost and usage reconciliation under abandoned/duplicate sessions.
- Production CIE adapter and CAM purpose-specific consent authority.
- Entitlement tier and learner-facing lock copy.
- Stock voice/persona licensing and D4 approval.

## Human Decisions Before Real Processing

- D3 grounding extension.
- D4 voice/persona law.
- D5 entitlement placement.
- D6 consent copy.
- D7 rail checkpoint after mandatory evidence.
- D9 deletion evidence class.

## Hard Blockers To Learner Release

No production adapter; no AI consent; no long-session media; no provider-retention evidence; no human accent benchmark; no network-impairment result; no two-rail result; no real-data deletion closure; no independent release decision. The Arena logging issue recorded by 4008A is external to this read-only mission and remains a broader ecosystem release condition until separately closed.
<!-- END Y2_3100_UNKNOWN_AND_BLOCKER_REGISTER.md -->
