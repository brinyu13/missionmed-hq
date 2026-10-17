# Y1-Y2-CAM-V6-3494A — QUESTION ENGINE SPEC

Extends 3494 (nothing replaced). Question sourcing becomes a cartridge family under the same hot-swap law as Delivery Intelligence.

## 1. Question record (canonical)

```ts
interface Question {
  question_id: QId;                 // CORE-xx | MR142-xxx | BEH-xxx | CVQ-xxx | MENT-xxx | CUST-xxx — permanent
  canonical_text: string;           // verbatim source wording; revisions are new versioned records w/ provenance
  source: 'founder_core'|'mr142'|'mr_behavioral'|'cv_generated'|'mentor'|'custom'|'rise_future';
  source_number?: number;
  tags: Tag[];                      // MULTIPLE — never exactly one (taxonomy doc)
  style: ('behavioral'|'situational'|'traditional'|'creative')[];
  difficulty: 1|2|3;
  core_priority: boolean;           // CORE collection pin
  specialties?: string[];           // applicability; empty = all
  storyforge_relevance?: StoryTag[];
  cv_relevance: boolean;
  behavioral: boolean;
  followup_eligible: boolean;
  assets: { [interviewerId]: PrerecordedAssetStatus };  // 'available'|'planned'|'none'
  links?: {rel:'equivalent'|'compound'|'near_duplicate', to:QId}[];   // duplicate-review output
  // joined at read time from AnswerRecords (never denormalized copies):
  stats?: { attempts, lastPracticed, personalBest, mentorReviewed };
}
```

## 2. Provider cartridges (registry pattern, same as DIRegistry)

`QuestionProviderRegistry`: `MissionResidencyQuestionProvider` (manifest seed: CORE + MR142 + BEH) · `CVQuestionProvider` (CV spec) · `MentorQuestionProvider` · `CustomQuestionProvider` · future `RISEQuestionProvider`. Providers emit Question records into one store; UI enumerates the registry — no hardcoded source lists. Adding/replacing a provider touches zero drawer/loadout/engine code.

## 3. Question Drawer (major interaction)

Slide-out over any setup context (wizard STEP 2, Pro Loadout, mid-session "add question" where allowed) — **never navigates away; setup state untouched**. Contents: instant search (canonical_text + tags), filter rail (collections: CORE ★ first, BEHAVIORAL, CV-DERIVED, FAVORITES, PREVIOUS, NEVER PRACTICED, NEEDS WORK; then tag chips), sort (frequency of practice, difficulty, recency, source order), per-question row: text · tags · difficulty pips · asset badge (🎬 prerecorded available) · living stats (attempts/last/PB/reviews) → click stats = question history (all answer videos). Interactions: desktop **drag → drop into set**; mobile **ADD +** and tap-reorder; keyboard accessible. 3492 visual system (chamfered rows, gold selected).

## 4. Interview Set (playlist/loadout)

Ordered stack showing ORDER · QUESTION · TYPE · SOURCE · EXPECTED STYLE · OPTIONAL FOLLOW-UP toggle · PRERECORDED ASSET STATUS per selected interviewer. Operations: drag reorder, remove, duplicate, replace, shuffle (constraint-aware: keeps opener/closer pins), randomize from filter, SAVE LOADOUT (named), START. Saved sets are user objects; MissionMed presets are the same object type flagged `official`.

## 5. Presets = configuration, not a parallel system

`CORE 10 · TRADITIONAL · BEHAVIORAL · CV-HEAVY · CONVERSATIONAL · PROGRAM DIRECTOR · FACULTY · PRESSURE · RAPID FIRE · CUSTOM` — each populates SessionConfiguration (question strategy, interviewer strategy, follow-up strategy, difficulty, etc.) and nothing else. One session engine (3494 law).

## 6. History join

Question ↔ AnswerRecord join is computed (question_id foreign key). The drawer's living stats and the Library's question-centric view read the same join — no duplicate storage.
