# B1-513R2 — V2.1 Context-Aware Story Follow-Up: Prewiring Contract

**RESEARCH COMPLETE · IMPLEMENTATION DEFERRED · MINIMAL V2 PREWIRING INCLUDED · NO IV PREP RUNTIME DEPENDENCY · NO PROVIDER IMPLEMENTATION IN V2**

SF-IVPOC-001's verdict is adopted: StoryForge V2.1 SHOULD adapt the IV Prep On-Call *pattern* — a frontier model asks one natural, context-specific next question — with bounded changes, owned entirely by StoryForge. V2 implements **none** of it. V2 implements exactly the five seams below, so V2.1 can arrive later as an additive release instead of a re-architecture.

## Product law carried dormant

Future capability = **CONTEXT-AWARE STORY ELICITATION**, not interview simulation. **AI MAY ASK. AI MAY NOT INVENT.** AI never authors dialogue, actions, emotions, motives, outcomes, clinical facts, patient details, events, reflections, or Learning Lessons into the canonical story. If something is missing: it asks. Only student/contributor-authored answers become canonical source material, and AI questions remain permanently distinguishable from human words.

## The five seams (the ONLY V2.1 work permitted in V2)

1. **Stable `story_id` + `story_version_id`.** Already real: stories carry stable IDs; the version engine (Original / Full / 30-Second / NNQ) gives every version a stable key and every revision an immutable ID (`versions[key].revisions[].id` — demonstrated in the prototype and probed: retell/restore is monotone, nothing is ever overwritten). Codex carries the same shape into `story_versions` (R1/R2 migration, doc 13 of B1-513R).
2. **Stable transcript `segment_id` capability.** The recorder pipeline's assembled transcripts gain segment identity: each finalized student-authored capture (voice or typed) is addressable as `(story_id, story_version_id, segment_id)`. V2 needs no UI for this — it is a column + write-path discipline on the existing capture tables. No re-chunking of historical text is performed; legacy bodies are one implicit segment.
3. **Source-role provenance.** A `source_role` enum on authored segments distinguishing at minimum: `student_spoken`, `student_typed`, `ai_question`, `mentor_content`, `guest_contributor`. V2 writes the first two on capture, `mentor_content` on mentor notes/feedback, `guest_contributor` on promoted contributions (the prototype already records contribution provenance in `story.origin` — probed: first-name only, no email). `ai_question` is **reserved and unused** in V2.
4. **Dormant capability seam.** A named, flag-gated capability (`story_followup`, default off, no scope ladder wired) whose future contract is: input = one authorized `(story_id, story_version_id)` snapshot for the signed student; output = one contextual question. In V2 this is a registered flag + a server-side interface stub that always reports `unavailable`. **No provider adapter, no model call, no UI, no prompt assets** ship in V2.
5. **Canonical student-answer append path.** A future follow-up answer enters through the *same* voice/text capture path as any other student words — producing a normal authored segment (seam 2) with `student_spoken`/`student_typed` provenance — while the question that elicited it is stored separately as `ai_question`, never merged into story prose. V2 guarantees this by construction: the capture path is already the only write path for story text.

## Explicitly NOT prebuilt (verified absent from the prototype and forbidden to Codex)

Narrative-completeness database · universal AI context store · cross-app AI service · IV Prep runtime dependency, persona, pressure logic, reaction trees, session persistence, continuous-mic semantics, silence behavior, Realtime voice rail, or model-selector UI · follow-up session engine · provider-specific implementation · automatic story rewriting · AI-authored prose · speculative schema beyond the five seams.

## Dormant security carry-forward (from §40F, binding on V2.1 whenever it starts)

P0: fabricated facts contaminating the canonical story (structural separation, seam 5) · cross-story/cross-student leakage (authorize exactly one student+story+version context) · sensitive clinical over-sharing (data minimization; finalized transcript, not audio, when sufficient; never unrelated stories). P1: leading questions introducing unsupported facts · endless interrogation (bounded depth ≈3 with Answer / Type / Skip / Ask Something Else / Stop) · repetition (track asked questions) · AI replacing the student's voice · prompt injection (story content is untrusted data, never instructions) · provider lock-in (StoryForge-owned contract behind a replaceable adapter). Future audit rows may carry followup_session_id, story/version IDs, question id/text, target dimension, source segment refs, provider/model, prompt/policy version, timestamp, user action, resulting authored-segment ID — and never chain-of-thought.

## Codex instruction

Implement the five seams exactly as scoped above during the release that touches versions/provenance (V2-R2), and nothing else from this document. Do not opportunistically build V2.1 AI. Any ambiguity between this contract and convenience resolves to *less* prebuild.
