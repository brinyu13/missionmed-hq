# B1-504A · StoryForge V5.5 Product Authority Lock

Date: 2026-07-28 · Author: Claude Cowork (Fable 5, xhigh) · Status: LOCKED, pending one founder approval gate (retention copy, Section 6)

Evidence discipline used throughout B1-504A: every material statement is labeled
[VERIFIED] verified current truth (checked directly this run),
[AUTHORITY] approved product authority (the founder-approved V5.5 prototype),
[RECOMMENDED] recommended architecture,
[CODEX] Codex discovery or implementation requirement,
[GATE] founder approval gate.

Readiness ladder, applied to every existing capability claim in B1-504A: code presence is not production readiness. Each existing audio or R2 capability is scored on five distinct levels, and no level is inferred from a lower one:
L1 present in source · L2 included in the currently deployed runtime · L3 enabled by production configuration · L4 reachable by the authorized user population · L5 verified end-to-end in production (real recording, upload, authorization, playback, deletion, and failure testing).
A [VERIFIED] tag on an existing capability means verified at the stated level only. Anything at L1 or L2 is candidate infrastructure to preserve or repair, never automatically accepted production functionality. The full ladder scoring lives in the Blueprint, Section 1.

## 1. Immutable artifact identities [VERIFIED]

All hashes below were computed on the founder's Mac during this run (sha256sum, 2026-07-28).

| Artifact | Location | SHA-256 |
|---|---|---|
| Canonical V5 parent authority | `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html` (in worktree `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`) | `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` |
| V5.5 prototype (product authority for this release) | `CLAUDE_FILES/B1-504_STORYFORGE_V5.5_PROTOTYPE/storyforge-v5.5-prototype.html` | `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90` |
| V5.5 decision brief | `CLAUDE_FILES/B1-504_STORYFORGE_V5.5_PROTOTYPE/B1-504_STORYFORGE_V5.5_DECISION_BRIEF.md` | `0eb7687a8619ab6c4922f5b47b4a18f9c3a7a43bc14ab5e35a638f65cdd83c56` |
| V5.5 prototype revision r2 (retention copy only; activates only on founder approval of the retention policy, Section 6) | `B1-504A .../storyforge-v5.5-prototype-r2.html` | `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b` |

r2 change record [VERIFIED, produced this run]: exactly two lines differ from the locked prototype, both retention copy.
Line 2503: `Original audio · preserved forever <span>— your spoken telling, separate from any later editing</span>` becomes `Original audio · kept with your story <span>· heard by your mentor only when you submit · delete anytime</span>`.
Line 2530: audio chip tooltip `Original audio preserved — m:ss` becomes `Original audio kept with this story · m:ss`.
No other bytes differ (full diff captured during production of r2). No design, layout, interaction, or behavioral change. The subtext states mentor audibility on submission explicitly so the visible promise and the access model (Storage doc Section 6) agree; an unconditional "private to you" was rejected during fresh-context verification for contradicting mentor playback on submitted stories.

### Bounded design delegation for policy-required surfaces [AUTHORITY-EXTENSION, approved with the retention gate]

The recommended retention policy requires two small student-facing surfaces that the prototype does not contain. To keep the conformance law intact (Codex must not design), their placement, exact strings, and behavior are fixed here and become product authority the moment the founder approves the retention gate:

1. Delete-audio control: a quiet text button labeled `Delete audio` at the right edge of the audio-card label row in the story workspace (and in the Quick Look compact audio card). Tap opens an inline confirm: "Delete this recording? The transcript stays. This cannot be undone." with buttons `Delete audio` and `Keep it`. On delete: the audio card disappears, toast "Audio deleted. Your transcript is untouched." Styling follows the existing quiet rowBtn/ghost-button vocabulary of the audio card; no new visual language.
2. First-recording consent notice: a one-time dismissible inline strip inside the capture sheet, directly above the voice dock, shown on the account's first voice use: "First time using voice: recording uses your microphone. Your audio and transcript are stored privately to your account, processed by MissionMed's transcription service to create your transcript, and you can delete the audio anytime. Please avoid patient names or identifying details." Dismiss button `Got it`. Never a modal wall; never repeated after dismissal.

If the founder amends the retention policy, these strings are amended in the same decision; Codex implements exactly what is approved and may not invent alternatives.

## 2. Hierarchy of authority

1. Canonical V5 HTML (hash above): the parent product. Everything V5.5 does not explicitly change remains governed by it, per the existing worktree `AGENTS.md` contract [VERIFIED: contract read this run].
2. V5.5 prototype (hash above): the product authority for every changed surface listed in Section 4 and for the Phase 1 interaction model. If the founder approves the recommended retention policy, the r2 revision supersedes it for the two copy lines only; all other bytes of the original V5.5 prototype remain authoritative.
3. B1-504A documents (this set): production architecture, contracts, rollout, and the Codex mission. They never override the prototype on product behavior; where the prototype simulates (demo dictation, simulated transcript-check terms, simulated flags), Sections in `B1-504A_PHASE1_PRODUCTION_BLUEPRINT.md` define the production-truthful equivalent.
4. B1-503 combined handoff and deployment receipt [VERIFIED: read this run]: production baseline, infrastructure seams, and domain invariants. They remain binding.
5. B1-505 (360 beta access): NOT PRESENT AT THE TIME OF THIS RUN, AND THAT ABSENCE IS NOT FINAL. [VERIFIED this run: no `B1-505_360_BETA_ACCESS_COMBINED_HANDOFF.md` and no `B1-505_evidence/` existed under `_AI_HANDOFFS/from_codex/` in the worktree at inspection time; B1-505 may still be running.] Binding rule [CODEX]: Codex performs a FRESH read of the COMPLETED B1-505 authority (`B1-505_360_BETA_ACCESS_COMBINED_HANDOFF.md` plus `B1-505_evidence/B1-505_PRODUCTION_ACCESS_RECEIPT.md`) at its own run time. Partial files, in-progress evidence folders, or a moving worktree state do not satisfy this gate. Exact stop scope, stated identically here, in the Blueprint (R-2), and in the MegaRun: without the completed B1-505 authority, stages S0 through S6 may proceed (build, dormant backend and hidden frontend deployment with scope off, and the staging bake-off), and S7 founder-only validation may proceed (the founder account is defined by B1-503's exact-account binding, not by B1-505); every allowlist or cohort activation (S8 onward) and every change to the WordPress access policy is hard-stopped until the completed authority is read and reports success. "Access-policy change" means changes to `allowed_user_ids` membership, `allowed_roles`, or `allowed_cohorts`; the R-8 founder-account role override (which grants no student any access) is exempt, so S7 founder-only validation cannot deadlock on this gate. No parallel definition of 360 eligibility is created anywhere in B1-504A; every reference to the 360 cohort defers to B1-505's final authority.

## 3. The product-conformance law

> The prototype is product authority, not a production bundle. Implement its approved behavior faithfully inside the existing live StoryForge system. Do not reinterpret, simplify, redesign, or deploy the self-contained HTML as a replacement application.

Conformance is judged the way B1-503 judged V5 conformance: surface-by-surface comparison against the authority artifact, with evidence. Integration-only acceptance cannot satisfy product conformance [VERIFIED: B1-503 permanent-prevention rule].

Prototype simulations that production must replace with truth (never imitate):

| Prototype simulation | Production truth |
|---|---|
| Demo dictation script (`SIM_SCRIPT`) | Real microphone audio transcribed by the MissionMed transcription adapter. The words "Demo dictation, simulated" must never appear in production. |
| Simulated transcript-check terms (`wipple`, `lack tate`) | Real low-confidence or lexicon-flagged terms from actual transcription output; if the provider gives no reliable confidence signal, the transcript check renders only lexicon-based suggestions, or not at all (Blueprint Section 6). Never fabricate uncertainty. |
| `localStorage` flags and Release Controls panel | Server-enforced feature scopes (Contracts doc Section 5) with a real admin surface; frontend visibility is never the enforcement layer. |
| `localStorage` durable draft | The existing server-side durable draft (`/api/drafts/story-builder`, `sf_story_drafts`), extended per the Contracts doc; localStorage may remain only as a same-device supplement. |
| Simulated audio playback bar | Real signed playback through the existing `/api/audio/:id/playback` seam. |
| Simulated interruption recovery | Real recovery from the server-side draft plus uploaded segments (Blueprint Section 7). |

## 4. Changed-surface inventory (V5 to V5.5) [AUTHORITY]

Only these surfaces change. Everything else is untouched V5 behavior and remains bound to the canonical hash.

1. Home: hero mic starts recording (it was inert in V5); placeholder gains "…or just talk"; one-time NEW pulse and discovery toast. All three are removed when the voice flag is off.
2. New Story capture sheet: voice dock below the story field with states idle, arming, recording, paused, review; live transcript streams into the same textarea used for typing; in-flight "ghost line"; overlap-merge of finalized text; transcript check chips; durable draft and interruption recovery banner; typing path unchanged.
3. Story workspace: no layout change; the pre-existing original-audio card activates for voiced stories.
4. Mentor Full Review: Socratic co-pilot card. Phase 2 only. NOT part of the Phase 1 deployment (Section 5).
5. Settings, Mentor View only: Release Controls panel. In production this is the admin feature-scope surface defined in the Contracts doc; the prototype's panel is its interaction authority.
6. Mobile bottom navigation: clip fix at 390 px (carried V5 defect, corrected).

## 5. Phase boundaries

Phase 1 [AUTHORITY, authorized for production now]: microphone recording; near-live transcription; pause, resume, stop; transcript review and editing; medical-term uncertainty support where technically reliable; interruption recovery; durable draft recovery; save into the existing private story workflow; optional playback of retained original audio under the approved retention policy; controlled activation for the verified 360 beta cohort per B1-505; founder and administrator controls; instant feature-off rollback; zero disruption to typing-only use.

Phase 1 must not expose: AI story assessment, AI writing, AI scoring, AI coaching, AI Socratic questions, AI themes, AI specialty connections, or any Phase 2 mentor intelligence. The transcription service uses machine intelligence internally; the student experience is capture and transcription only.

Note on pre-existing AI flags [VERIFIED]: the recovered production system already carries `/api/ai/suggest` behind `STORYFORGE_AI_*` flags (default off) from the canonical V5 Interview Prep feature. Phase 1 does not touch these flags; they remain off unless separately authorized. They are prior V5 scope, not V5.5 scope.

Phase 2 [AUTHORITY, boundary only]: mentor-only Socratic co-pilot behind a review-then-send gate; drafts arrive to students as the mentor, never as AI. Phase 1 ships none of it: no Phase 2 endpoint, schema, or frontend code is deployed in the Phase 1 release. The durable boundary that lets Phase 2 plug in later is defined in the Blueprint Section 10; it consists of contracts, not code.

Phase 3 [AUTHORITY]: locked. No student-facing intelligence exists, and no toggle can enable it. Unlocking requires a founder decision and a new release with its own review.

## 6. The single founder approval gate in this authority [GATE]

Retention policy and its visible copy (full analysis in `B1-504A_R2_AUDIO_STORAGE_PRIVACY_LIFECYCLE.md`, Section 7):

Recommended default: retain original audio, private to the student, deletable by the student at any time, deleted when the story is deleted, with the r2 copy revision. The founder approves or amends this before cohort activation. Codex may build everything, including founder-only validation, while this gate is open, but must not activate the 360 cohort until the policy and the visible copy agree and the founder has approved (deployment gate G7 in the Acceptance doc).

## 7. Supersession rules

- The V5.5 prototype supersedes canonical V5 for the changed surfaces in Section 4 only, upon founder approval of this authority set.
- The r2 revision supersedes the V5.5 prototype for its two copy lines only, and only if the founder approves the recommended retention policy; if the founder chooses permanent retention instead, the original copy stands and r2 is discarded unused.
- Any future founder revision must follow the B1-503 permanent-prevention rule [VERIFIED]: an immutable artifact with a new hash, an explicit supersession record, and a changed-screen inventory.
- No agent may modify `storyforge-v5.html` or `storyforge-v5.5-prototype.html` in place. Ever.
