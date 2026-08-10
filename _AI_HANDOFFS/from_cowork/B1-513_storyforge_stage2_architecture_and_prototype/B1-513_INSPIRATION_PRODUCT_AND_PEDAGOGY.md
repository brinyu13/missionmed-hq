# B1-513 Inspiration — Product & Pedagogy Specification

Ticket: B1-513 (StoryForge Stage 2) · Date: 2026-08-07 · Status: Production specification for release R3
Canonical authority: `B1-513_DECISIONS_SPINE.md` (D3, D6, D7, D8, D11) and `B1-513_CURRENT_CANONICAL_BASELINE.md`. This document elaborates those decisions; where any wording differs, the spine governs. Research evidence and source provenance live in `B1-513_INSPIRATION_RESEARCH_APPENDIX.md`. Prompt content is canonical in `research/PROMPT_LIBRARY.json`. Working reference implementation: `prototype/extensions.js` (`renderInspiration`, `b1513WizardStepMarkup`, wizard handlers) and `prototype/shim.js` (`/api/inspiration*`, story creation with `origin`).

---

## 1. Purpose

Residency applicants — US graduates and IMGs alike — suffer from autobiographical tunnel vision: asked for stories, they reach for the same rehearsed leadership/conflict/failure set pieces, all of which begin in a hospital. Memory research explains why: people cannot browse their past; retrieval is cue-driven, and "tell me an important story" cues the clichéd life script. Inspiration is StoryForge's answer — a guided, one-question-at-a-time conversation that uses concrete memory cues (a dish, a bus ride, a teacher, a saying) to surface real, specific, interview-usable episodes from the student's whole life.

Two product boundaries are binding (spine D3):

1. **Inspiration is a destination, not a second story product.** It is an entry point into the canonical Story Library. Answers become ordinary StoryForge stories through the existing story-creation path. There is no parallel story store, no separate review flow, no second pile.
2. **Inspiration is not Interview Prep.** Interview Prep remains hidden by reversible configuration and is not merged into this feature (spine D11). Inspiration surfaces raw story material; what Interview Prep does with questions stays its own archived concern.

The student-facing framing (exact prototype copy, canonical for production):

> "Find the stories you *forgot you had*."
> "Interviews aren't won with rehearsed 'leadership stories.' They're won with real, specific memories — a meal, a bus ride, a person who surprised you. A few gentle questions will take you there."

## 2. Placement and entry points

- Route: `inspiration`, a student destination in the existing left rail (one renderer, `renderInspiration`). Visible only to students, only when the `inspiration` flag admits them (D7).
- Home entry point: a single low-pressure link on the student Home — "✧ Can't think of a story? Open **Inspiration** ▸" (`b1513HomeInspirationLink`). It never nags, never counts, never gates anything.
- The page layout: the wizard panel on the left; a right column with "Sparked this visit," "Saved for later," and a "How this works" panel whose copy makes the Library contract explicit: *"One question at a time, built from research on how memory actually works. Answers become ordinary StoryForge stories in your Library — same privacy, same review flow, no separate pile."*

## 3. The wizard flow

The wizard is a short funnel of at most three primary choices per step, then exactly one question at a time. Steps, in order (spine D3):

| Step | Question shown | Choices (exact ids → labels from `PROMPT_LIBRARY.json` `dimensions`) |
|---|---|---|
| 1. WHO | "Who is at the center of the story we're looking for?" | `you` → You · `family` → Family · `someone_else` → Someone Else |
| 2. Relationship (only when WHO ≠ You) | "Which part of your family?" / "Who, more specifically?" | Progressive disclosure: **2 primary** relationship choices + a "More…" button (see below) |
| 3. DOMAIN | "Where does this story live?" | `personal` → Personal Life · `academic` → School & Studies · `medical_clinical` → Medicine & Clinical Life |
| 4. ENERGY | "What kind of story are you in the mood to find?" | `serious` → Serious & Meaningful · `light` → Fun & Lighthearted · `moving` → Emotional & Moving |
| 5. Question | One prompt card at a time | Five actions (§4) |

Flow rules, all implemented in the prototype and binding for production:

- **Progress honesty.** The eyebrow reads "A guided conversation · step N of M" where M = 4 when WHO = You (the relationship step is skipped) and 5 otherwise. A "‹ Back" button appears on every step after the first; going back never loses selections.
- **WHO step pedagogy.** Helper copy under the question: *"Good interview stories aren't only about you. Some of your best material is about the people around you."* Family and Someone Else are equal-weight primary choices, not an afterthought (principle P12, §8).
- **Progressive relationship disclosure.** The relationship step shows the first two `whoDetail` entries whose `parent` matches the WHO selection, plus a third button, "More…" ("See other relationships"), which expands the remaining relationships in place. Family expands to Parents, Siblings, Spouse / Partner, Extended Family; Someone Else expands to A Friend, A Teacher / Mentor, A Colleague / Teammate, A Patient (shared respectfully). A separate escape — "It doesn't matter — surprise me" — records an empty `whoDetail` and moves on. The screen therefore never presents more than three primary choices (spine D3).
- **ENERGY step pedagogy.** Helper copy: *"Light stories are real interview material too — they're often where your personality lives."* Light is a first-class destination, not filler (P5), and the default session ramp is light → serious → moving (P4); the UI encourages the ramp through copy and the lighter-questions switch (§7) rather than by renaming or restricting choices.
- **One question at a time.** The question step renders exactly one prompt card (`aria-live="polite"`), tagged with the canonical **Memory prompt** vocabulary (baseline §4) and the prompt's `territory` (underscores rendered as spaces). Nothing else competes for attention.
- **The follow-up reveal.** Every prompt carries a `followUp`, rendered hidden and revealed on the first character typed or spoken — without re-rendering, so typing focus is never lost. Alongside it, a conversion row appears: the prompt's "💡 Why this works in an interview" line (`interviewUse`, now student-visible) and an optional one-sentence "What did it change?" input that becomes the promoted story's Learning Lesson. The scaffold deepens the scene only after a scene exists (P7), never as a second simultaneous question (P2), and the change question gives every answer a stakes-and-change vector before it reaches the Library (P10).
- **Path exhaustion.** When no unseen active prompt matches, the card is replaced with: *"No more questions match this path — try another combination."* Back navigation re-opens the funnel.

## 4. The five student actions

Every question card offers exactly these actions (spine D3):

| Action | Behavior | Copy / notes |
|---|---|---|
| **Answer** | Type into the answer box, or record voice (§5). A non-empty answer enables "Add to StoryForge Library" (§6). | Placeholder with voice available: "Type here — or tap the mic and just talk…"; without: "Type what this brings back…" |
| **Skip** | Discards nothing the student typed elsewhere; requests the next prompt (current prompt joins the seen set). | Always visible. No confirmation, no guilt copy. |
| **Give me another** | Same mechanics as Skip — a no-fault reroll for "wrong question, right mood." | Distinct button because the intent differs; analytics records the distinction content-free (§11). |
| **Save for later** | Persists the prompt (id + text snapshot) and any draft answer to `sf_inspiration_saved`; confirms "Saved for later — it will be waiting on the Inspiration page."; serves the next prompt. | The saved list shows "Saved {ago} · has a draft" and offers "Answer now" / "Remove." |
| **This sparked another story** | One-line capture of the *different* story this question surfaced ("What story did this spark? One line is enough — StoryForge will keep it."). Stored via the same saved-for-later domain with a "✧ Sparked:" snapshot prefix; listed under "Sparked this visit." | Confirmation: "Spark saved. Finish this question, or chase the new one — your call." Sparks are the feature working as designed — cues igniting adjacent memories. |

Beneath the actions, the standing agency line (exact copy, binding): *"You're in charge here. Skip anything, stop any time — your progress is saved, and nothing is shared unless you add it to your Library."*

## 5. Typing and voice; editable transcript

- **Production voice reuses the existing StoryForge recorder pipeline** — `/api/recordings` sessions, segment upload, provider transcription (GPT-4o primary, Whisper fallback), immutable provider original, IndexedDB offline durability — with a new bounded sink target: the Inspiration answer box instead of `#capBody` (same reuse pattern the spine mandates for version voice, D1). No second audio system is built.
- **The prototype simulates this.** `b1513StartInspRecorder`/`b1513StopInspRecorder` in `extensions.js` fake a ticking recorder that types canned sentences into the answer box. This is a demonstration of the interaction contract only; production wires the real pipeline.
- **Interaction contract:** a "🎙 Talk instead" button starts recording; the familiar voxDock shows timer, waveform, Done, and Discard; status copy reads *"StoryForge types while you talk — edit anything after."* The transcript lands in the same textarea the student types in and is **fully editable** before any save or promotion — identical to the Quick Capture editing promise. Discard clears only the recorded text.
- When the recorder pipeline's `voice_capture` capability is off for the account, the mic affordances simply do not render; typing is always available.

## 6. Draft capture, resume, and the promotion contract

**Draft capture and resume.** Save for later persists `{prompt_id, prompt_text snapshot, draft, saved_at}` per student (`sf_inspiration_saved`, owner-scoped RLS). "Answer now" on a saved item reopens the question step with the snapshot text and the draft restored into the answer box. The server also keeps a lightweight session record (last selections + last served prompt) so a returning student can be offered their place back; prompt-text snapshots make saved items immune to later prompt retirement or rewording.

**"Add to StoryForge Library" — the promotion contract.** Promotion calls the **existing** story-creation endpoint (`POST /api/stories`) — the same path Quick Capture uses — with:

- `title`: seeded from the first six words of the answer (fallback "A story from Inspiration"); normal "The One Where" title rules apply thereafter.
- `text`: the full answer (typed, voice-transcribed, or both — whatever is in the box).
- `origin`: `{ type: 'inspiration', prompt_id, prompt_text }` — the prompt text is a **snapshot**, so the story's provenance survives any future change to the prompt bank.

Server-side consequences, none of them new machinery:

- **Visibility default comes from consent state (spine D2):** `mentor_visible` if the student has accepted the mentorship policy, otherwise `private`. Inspiration adds no visibility rules of its own.
- The story's history opens with the existing `story.captured` event carrying "from Inspiration — "{prompt text, truncated}"".
- The Library row shows a small ✧ badge ("Born in Inspiration"); everything else — Original telling immutability, Working/Full Story editing, Learning Lesson, submission and review workflow, versions (R2), story-level media — applies exactly as to any other story.

The post-promotion panel closes the loop in product vocabulary: *""The One Where {title}" is now a StoryForge story."* with the visibility state stated plainly, plus "Open the story" and "Keep exploring — another question." Toast: *"Added to your Story Library — same story, same privacy, ready to grow."*

## 7. Safety and agency rules

These are product rules, not tone suggestions. They bind prompt authoring (enforced at admin review, §12) and UI behavior alike. Evidence basis: appendix P9 and the safety-by-design gaps section.

1. **No trauma pressure.** No prompt demands grief, loss, discrimination, or medical-error confession — such prompts do not exist in the bank. Emotional territory is reachable only by invitation, and every `moving` prompt that approaches sensitive ground carries its exit *in the prompt text itself* ("Share only what feels comfortable," "Skip freely if you'd rather," "Only go where you're glad to go").
2. **Easy exits, always.** Skip and Give me another are permanently visible; Back works on every step; leaving the route mid-question loses nothing (drafts persist via Save for later; the session record preserves the path). No modal traps, no completion streaks, no "are you sure?" friction on exits.
3. **Lighter-questions switch.** Whenever the current energy is not `light`, a "Prefer lighter questions" button is present; one press re-cues the session to Fun & Lighthearted and serves a new prompt immediately. De-escalation is one tap, escalation is always the student's choice.
4. **No psychological diagnosis or therapy framing.** Inspiration never characterizes the student, scores their disclosure, labels memories, or claims therapeutic benefit. It is a memory-cueing and storytelling tool; copy stays in the storytelling register throughout.
5. **IMG-inclusive language.** Prompts avoid US-centric cultural anchors (no prom, Thanksgiving, Little League, SAT); migration and starting-over prompts are framed as adaptability and courage, never deficit; family prompts assume no particular family structure, religion, or country of training; health-system prompts say "anywhere in the world."
6. **Clinical ethics in the text.** Patient-related prompts require de-identification in the prompt wording itself ("No identifying details, please," "with details changed") — the guardrail travels with the question, not a separate policy page.
7. **Nothing is shared implicitly.** Answers, drafts, and sparks are private to the student. The only route to mentor observability is explicit promotion into the Library, where the D2 consent-derived default and the per-story Visibility card govern — and the agency line on every card says so.

## 8. How the 14 evidence-backed design principles map to the product

Principles P1–P14 are synthesized and sourced in the research appendix. Each maps to at least one concrete, inspectable UI or copy decision:

| # | Principle (short) | Concrete product decision |
|---|---|---|
| P1 | Cue the episode, not the trait | Every prompt asks for one particular occasion ("Take me back to the last time…", "Describe one afternoon…"). Zero "greatest achievement / biggest weakness / most important experience" prompts exist in the bank — excluded as life-script bait. |
| P2 | One question at a time | The question step renders a single Memory prompt card; the follow-up stays hidden until the student starts answering; steps never bundle questions. |
| P3 | Warm up episodically first | The lead copy primes concrete recent scenes ("a meal, a bus ride"); the library's `recommended_flow` opens sessions on a low-stakes prompt; the ENERGY helper steers first-timers light. A dedicated one-tap "picture one recent moment" warm-up micro-step is a documented R4 candidate, not in R3. |
| P4 | Escalate light → serious → moving | ENERGY is an explicit chosen dimension; default guidance ramps upward; "Prefer lighter questions" makes the ramp reversible at any moment; sessions never force escalation. |
| P5 | Light questions are retrieval tools | 27 of 81 prompts are `light`; Fun & Lighthearted is a primary choice with encouraging copy, and light prompts carry `interviewUse` lines proving their interview value (e.g., q-003's getting-lost adaptability story). |
| P6 | Ordinary moments reveal character | Territories like `ordinary_clinical`, `objects`, `food`, `first_jobs`; q-028 explicitly asks for a shift where "nothing dramatic happened." Prompt copy never asks for "impressive." |
| P7 | Fixed detail scaffold | Each prompt carries ONE authored `followUp` probe, revealed after the first answer, that pulls toward the scene, the stakes, or the change. A full staged scaffold (place → senses → thought/feeling → meaning) is an R4 candidate; R3 ships the single probe plus the conversion row below. |
| P8 | Trivial details are retrieval routes | Prompts anchor on dishes, kept objects, sayings, rituals, home remedies; follow-ups ask "What could you see and hear?" — minutiae welcomed as doors, not noise. |
| P9 | Agency and easy exits | The five-action row, the always-available Skip, the lighter switch, exits written into prompt text, and the standing agency line (§4). Oral-history ethics as UI. |
| P10 | Stories need stakes and change | Every prompt carries `interviewUse` naming the change/insight it yields; follow-ups nudge toward the shift ("What did you learn about yourself on the other side of it?"). |
| P11 | Target the reminiscence bump and pre-medicine life | Heavy coverage of childhood, school, exams, first jobs, migration, university territories; Personal Life and School & Studies stand equal to Medicine & Clinical Life in the DOMAIN step. |
| P12 | Other people are first-class material | WHO makes Family and Someone Else primary choices; 48 of 81 prompts center someone other than the student; the WHO helper copy states the principle outright. |
| P13 | Structure beats blank pages | The wizard *is* the scaffold (territory → episode → detail → meaning); placeholders model expected depth; promotion hands off to the Library's further structure (Learning Lesson, review feedback). |
| P14 | Ask for stories, not opinions; start broad | No prompt asks what the student believes or values in the abstract — every one asks what happened; the DOMAIN list leads with Personal Life, reaching medicine last. |

## 9. Example prompts (quoted from `PROMPT_LIBRARY.json`)

Ten of the 81, chosen to span the space and make the pedagogy concrete. Text quoted verbatim; each shows `territory` and `interviewUse`.

**q-001** (You · Personal Life · Fun & Lighthearted · territory `food`)
"What's a dish you could eat a hundred times and never get tired of? Take me back to the last time you had it — where were you, and who made it?"
*interviewUse:* "Food memories carry culture, family, and place — warm 'tell me about yourself' material that makes an applicant instantly relatable."

**q-010** (You · Personal Life · Serious & Meaningful · territory `migration`)
"Tell me about a time you had to start over somewhere new — a city, a school, a country. What did the first week actually look like?"
*interviewUse:* "Starting-over stories reframe an IMG's move as demonstrated adaptability and courage — central to 'why should we bet on you?'"

**q-020** (You · School & Studies · Serious & Meaningful · territory `failure`)
"Tell me about an exam, match cycle, or project that didn't go the way you wanted. What did the following week look like, hour by hour if you can?"
*interviewUse:* "Focusing on the week after a setback — not the setback itself — yields the recovery detail 'tell me about a failure' answers usually lack."

**q-028** (You · Medicine & Clinical Life · Serious & Meaningful · territory `ordinary_clinical`)
"Tell me about an ordinary shift you can still replay in detail — nothing dramatic happened, but it stuck with you. What made it stick?"
*interviewUse:* "Ordinary-shift stories show what an applicant actually notices and values at work — deeper than any peak-event answer."

**q-035** (Family: Parents/Siblings/Extended Family · Personal Life · Fun & Lighthearted · territory `family_lore`)
"What's a story your family tells about you that you'll never live down? Tell it the way they tell it."
*interviewUse:* "Family-lore stories are instantly likable and show an applicant who can be the punchline — warmth interviewers remember."

**q-043** (Family: Parents/Extended Family · Personal Life · Emotional & Moving · territory `seeing_anew`)
"Tell me about a moment when you suddenly saw a parent or grandparent as a person with their own story — not just your parent. What prompted it? Share at whatever depth feels right."
*interviewUse:* "Seeing-a-parent-anew stories demonstrate empathy's real mechanism: recognizing a full person — the same skill patients need from doctors."

**q-058** (Family · Medicine & Clinical Life · Emotional & Moving · territory `caregiving`)
"Tell me about a time you helped look after someone at home — even just bringing tea, translating at an appointment, or sitting with them. What do you remember actually doing? Skip freely if you'd rather."
*interviewUse:* "Small-caregiving stories show service before any title — humble, credible evidence of a caring disposition."

**q-067** (Someone Else: A Teacher / Mentor · School & Studies · Fun & Lighthearted · territory `role_models`)
"Tell me about the most memorable teacher you ever had — not the best, the most memorable. What was a typical class with them like?"
*interviewUse:* "Memorable-teacher stories are charming and safe openers that still reveal what captures this applicant's attention."

**q-077** (Someone Else: A Colleague / Teammate · Medicine & Clinical Life · Serious & Meaningful · territory `being_taught`)
"Tell me about a time a nurse, technician, or other non-physician colleague taught you something important. What was it, and how did they teach it?"
*interviewUse:* "Learning-from-the-team stories signal interprofessional respect — a trait residency programs screen for explicitly."

**q-081** (Someone Else: A Patient (shared respectfully) · Medicine & Clinical Life · Emotional & Moving · territory `patients`)
"Was there a patient or family who taught you something about what good care really means? Tell me one small scene you're comfortable sharing, with details changed."
*interviewUse:* "Patient-as-teacher stories close the loop between experience and philosophy of care — capstone personal statement material."

## 10. Prompt selection (server-side)

Selection is server-side, deterministic, and auditable (spine D3). Contract, as demonstrated by the prototype shim (`/api/inspiration/next`) and hardened for production:

- **Request:** `{ who, whoDetail, domain, energy, excludeIds }` — the student's dimension selections plus the ids already seen this session.
- **Candidate set:** prompts with `state = 'active'` in the current published bank, minus `excludeIds`.
- **Dimension scoring:** additive match score — WHO match +4, `whoDetail` match +3, DOMAIN match +2, ENERGY match +2 (empty selections contribute nothing, which is how "surprise me" widens the pool). Candidates sort by score descending, then stable prompt id.
- **Serving band:** candidates within 1 point of the top score form the serving band, so equally-good prompts rotate instead of one prompt monopolizing a path.
- **Determinism (production requirement):** the pick within the band is a pure function of (student id, exclude set, bank `row_version`) — e.g., a stable hash — so the same request state reproduces the same prompt, and any served prompt can be re-derived after the fact. The prototype shim's random tie-break is explicitly *not* the production behavior.
- **Exclude-seen:** every served id joins the session's seen set; the server session record persists selections + last prompt for resume. Exhaustion returns `prompt: null` (§3).
- Every serve is recorded as a content-free `shown` event (§11), completing the audit trail: bank version + request + deterministic function → served prompt.

## 11. Analytics events (content-free)

`sf_inspiration_events` (spine D3) records usage, never content. Event set: **shown, answered, skipped, promoted.**

| Event | Fired when | Content-free payload |
|---|---|---|
| `shown` | A prompt is served to the question step | prompt_id, selections (dimension ids), session id, timestamp |
| `skipped` | Student leaves a prompt unanswered via Skip, Give me another, or the lighter switch | prompt_id, reason ∈ {skip, another, lighter}, timestamp |
| `answered` | Student leaves a prompt having produced a non-empty answer (promoted, or saved with a draft) | prompt_id, input source ∈ {typed, voice, mixed}, coarse length bucket, timestamp |
| `promoted` | "Add to StoryForge Library" succeeds | prompt_id, story_id, timestamp |

Rules: no answer text, draft text, spark text, or transcript fragment ever appears in an event. Save-for-later and spark inventories live in `sf_inspiration_saved` rows (student-owned data, not analytics) and need no event. Aggregates roll up into the D5 activity counters (e.g., `inspirationAnswers`) under the truthful-boundary rule — every metric carries `available_from`, and history is never fabricated.

## 12. Admin governance touchpoint

The prompt bank (`sf_inspiration_prompts`: stable id, text, dimension arrays, territory, follow_up, interview_use, state active|retired, sort_order, row_version) is its own versioned, audited configuration domain surfaced in Release Controls, managed through the existing Content & Display machinery pattern — validate → preview → publish with optimistic version, restore defaults, append-only audit, force-off kill switch (spine D6). Retiring a prompt stops it being served immediately without a deploy; saved-for-later items and story `origin` provenance are unaffected because both hold text snapshots. Prompt authoring standards, the admin editing UI (R4 depth), review workflow for new prompts, and the safety checklist live in **Doc 09 (admin configuration & governance)** and are not duplicated here. Flags: `inspiration` (student surface), `inspiration_admin` (admin surface), each with an independent env kill switch, default off (D7).

## 13. Acceptance criteria — R3 (Inspiration MVP)

R3 ships the student wizard + promotion + save-for-later with the seeded 81-prompt bank (D7). Gate list; all must pass before widening past the Founder canary (brinyu → one consenting student → `eligible_all`):

**Flags and rollout**
1. With `inspiration` off (DB flag or env kill switch), the route, Home entry point, and all `/api/inspiration*` endpoints are absent/403; no student-visible residue.
2. Enabling/disabling the flag requires no deploy and leaves R1/R2 behavior untouched.

**Wizard**
3. Step order and skip logic exact per §3, including the 4-step path for WHO = You; progress label counts honestly.
4. No step ever presents more than three primary choices; the relationship step shows 2 primary + "More…" with in-place expansion and the "surprise me" escape.
5. Exactly one prompt card renders at the question step; follow-up appears only after the answer box is non-empty; exhaustion message renders when the path is spent.

**Actions and safety**
6. All five actions present and functional; Skip and Give me another never require confirmation; "Prefer lighter questions" appears whenever energy ≠ `light` and re-cues in one tap.
7. The agency line renders on every question card; no copy anywhere in the surface pressures disclosure, claims therapeutic benefit, or characterizes the student psychologically.

**Voice and transcript**
8. Production voice runs through the existing recorder pipeline (sessions, segments, transcription, IndexedDB durability) sinking into the answer box; the transcript is editable before save/promotion; Discard clears only recorded text; mic affordances absent when `voice_capture` is off.

**Promotion**
9. Promotion uses the existing `POST /api/stories` path; the created story carries `origin {type: 'inspiration', prompt_id, prompt_text snapshot}`, a history line naming the prompt, and appears in the Library immediately with the ✧ badge.
10. Visibility default follows consent state exactly (D2): consented → `mentor_visible`, otherwise `private`; the post-promotion panel states the resulting visibility truthfully.
11. No parallel store exists: deleting/archiving/reviewing the promoted story follows only existing story rules.

**Save for later and resume**
12. Saved items persist prompt id + text snapshot + draft; "Answer now" restores the draft into the answer box; snapshots survive prompt retirement; Remove deletes only the student's own row.

**Selection**
13. Selection is server-side with the §10 scoring, exclude-seen, and deterministic band pick; the same request state reproduces the same prompt; served prompts always come from `state = 'active'` in the current bank version.

**Analytics**
14. Events limited to shown/answered/skipped/promoted with content-free payloads; a review of stored events confirms zero student text; aggregates carry `available_from` (D5).

**Authorization (D8)**
15. RLS + FORCE RLS on `sf_inspiration_saved` and `sf_inspiration_events`; negative tests pass: cross-student direct-ID access to saved prompts → 404/P0002; anonymous → 401; ineligible → 403; students cannot reach `/api/admin/console/inspiration*` (403).

**Accessibility and regression**
16. Full keyboard operability; `aria-pressed` on choice buttons; `aria-live` on the question card and recorder status; focus lands on the step heading after transitions; reduced-motion honored (no new motion primitives).
17. Critical Systems remains zero-failure; all R1/R2 acceptance gates still pass; production-shaped tests cover the promotion contract end to end.

## 14. Out of scope for R3

Admin content-manager UI depth, richer analytics views, and any Inspiration/Interview-Prep bridge are R4-or-later (D7, D11). The episodic warm-up micro-step (§8, P3) is recorded as an R4 candidate. Nothing in this document authorizes new audio, media, or story-storage architecture.
