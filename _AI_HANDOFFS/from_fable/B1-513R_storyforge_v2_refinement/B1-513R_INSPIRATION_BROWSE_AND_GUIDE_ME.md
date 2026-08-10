# B1-513R Inspiration — Browse and Guide Me

Founder direction: the one-question-at-a-time wizard is NOT the default; Inspiration is a browsable library with an optional guided mode. The B1-513 pedagogy (81-prompt research-grounded bank, follow-up reveal, "why this works in an interview", change-note → Learning Lesson, promotion into the canonical Library) is fully inherited — this document covers the reworked presentation and its two modes.

## Browse (default — shots 10–13)

- **"How this works" at the top**, in plain warm language: browse real memory questions, answer by typing or talking (🎤), answers become ordinary StoryForge stories in *your Library* — same privacy, same review flow, no separate pile; Guide Me exists for the unsure.
- Mode strip (voiceTabs pattern): **Browse questions · ✨ Guide Me · Saved & unfinished (N)**.
- Search ("food, travel, first job…"), filter chips for who (You/Family/Someone Else) · domain (Personal/School/Medicine) · energy (Serious/Fun/Emotional), **★ Favorites** toggle with count, live results count.
- Prompt cards: question text (Lora voice type), territory tag, ★ favorite (server-persisted, cross-device), **Answer now** and **Save for later**.
- **Answer now** expands the card in place (full-width): follow-up reveal on first input, 🎤 Talk instead, the conversion row (💡 why-this-works + "What did it change?" → Learning Lesson), **Add to StoryForge Library**, Save for later, Close. Focus moves to the answer box; typing never re-renders.
- **Saved & unfinished**: saved prompts, sparked ideas, and unfinished drafts with Answer now / Remove — the resume surface.

## Guide Me (optional — shots 14–15)

The B1-513 wizard, refined per the Founder note: **no "Who is at the center?" gate when the student is the subject.** The guide opens at **"Where should we look?"** (domain) with the subject defaulted to *You* and a compact inline switch — "This story is about: **You** [You|Family|Someone Else]". Choosing Family/Someone Else inserts the relationship step (2 primary + More…); then energy; then one question at a time with the full inherited card (Answer/Skip/Give me another/Save for later/✧ Sparked/Prefer lighter questions, agency footer, typed-draft protection on Back). Steps renumber accordingly (3 steps for self, 4 otherwise) — ≤3 primary choices per step throughout.

## Data & flags (delta only)

Reuses the R3 prompt bank, selection function, save-later, events, and promotion path unchanged. New: `sf_inspiration_favorites (user_id, prompt_id, created_at, PK(user_id, prompt_id))` with owner-only RLS, and a browse read function (active prompts filtered by q/who/domain/energy/favorites, bounded page size). Same `inspiration` flag; favorites degrade gracefully when absent. Governance unchanged: stable IDs, retire/restore, versioned audited publish via Content Studio; the add-question path still requires a follow-up and lands Retired pending completion (B1-513 verifier fix, inherited).

## Pedagogy note

Browse-first strengthens P9 (agency) and P13 (structure beats blank pages) — students choose their own door — while Guide Me preserves the escalation ramp for students who need to be walked in. The follow-up/conversion mechanics (P7/P10) are identical in both modes, so the interview-usefulness pipeline does not depend on which door the student uses.
