# STORYFORGE_V5_CANONICAL_LOCK
B1-500 · StoryForge V5 · Canonical Product Lock · July 26, 2026

## 1. Canonical declaration

> **"StoryForge V5 is the only approved product, UI, UX, visual-design, interaction, navigation, and workflow authority. No earlier StoryForge prototype may be used to determine product behavior."**

The file **`storyforge-v5.html`** is STORYFORGE V5 — SOLE CANONICAL PRODUCT AUTHORITY. Where any document in this package, any historical document, or any code comment conflicts with the behavior of `storyforge-v5.html`, the canonical artifact wins automatically. One code-level caveat: the artifact contains superseded internal layers that are overridden at load time (notably a dead v2-era `renderPrep` near line 1381, shadowed by the live Interview Intelligence `renderPrep` near line 2642, and v2-era `rowHTML`/`renderQuick`/`renderSettings`/`persist` definitions replaced by later script blocks). **The behavior that actually executes in a browser is canon; dead code is not.** When in doubt, run the file and observe.

## 2. Revoked authority declarations

The following canonicity statements found in historical materials are **revoked**:
- `COMPLETE_COMBINED_HANDOFF.md` header: "Prototype: `storyforge.html` (v1, canonical, untouched) → `storyforge-v2.html` (this run's deliverable)" — revoked.
- `COMPLETE_COMBINED_HANDOFF.md` §7: "The prototype (`storyforge-v2.html`) is the behavioral spec: reproduce its labels, states, transitions, notification texts, and role rules exactly." — the rule survives, re-pointed: the behavioral spec is **`storyforge-v5.html`**.
- `STORYFORGE-HANDOFF.md` (v1) and `MENTOR-ENGINEERING-HANDOFF.md` (v1): all references to `storyforge.html` as entry file or "canonical" — revoked. These two documents are historical-only in their entirety.
- `09-V5-ADDENDUM.md` line "Supersedes nothing; extends the v2 handoff set" — struck. The addendum does supersede v2 statements; where the addendum and v2 text conflict, the addendum wins, and `storyforge-v5.html` wins over both.

## 3. Source hierarchy

1. **`storyforge-v5.html`** — sole product authority (executed behavior).
2. **`09-V5-ADDENDUM.md`** — supporting V5 product/engineering authority.
3. **This B1-500 package** — production engineering authority (never overrides 1–2 on product behavior).
4. **`COMPLETE_COMBINED_HANDOFF.md` §§4–7 (v2 sections)** — reusable engineering base **as amended** in §5 below; product/UI descriptions in §§1–2 are historical.
5. **v1 documents** — history only.

## 4. Product invariants (system laws — binding on all implementation)

1. Stories are private by default.
2. Student View and Mentor View are different authorized perspectives on the same underlying records.
3. Changing browser state cannot grant mentor or administrator permissions.
4. The student's original telling is preserved.
5. Original Audio, Original Transcript, and Working Version are separate concepts.
6. Later editing cannot silently overwrite the authentic original.
7. The lesson or learned strength is a first-class output that travels with the story.
8. Student and mentor scores are independent.
9. Student and mentor stars are independent.
10. Opening a story is not the same as reviewing it.
11. Every important mentor or student action is attributable and timestamped.
12. Story strength can differ by interview question; the rating belongs to the story–question relationship.
13. Student-proposed mappings and mentor-confirmed mappings remain distinguishable.
14. Follow-up questions belong to a specific story used for a specific interview question.
15. AI suggestions are optional, reviewable, editable, rejectable, and never silently authoritative.
16. Clinical follow-up intelligence must be medically aware and must not masquerade as validated clinical truth.
17. Imported questions do not become institutional authority without review.
18. Background preference applies across the application and persists.
19. Reduced-motion behavior preserves visual identity while stopping nonessential motion.
20. Every live control must work genuinely or display a truthful unavailable state.

Scope walls: do not reduce StoryForge to a generic story notebook or question list; do not expand into Personal Statement Studio, LOR Studio, MSPE generation, a full mock-interview platform, or a board-review product.

## 5. Rules for interpreting historical material (amendment register)

When mining `COMPLETE_COMBINED_HANDOFF.md` for engineering value, apply these amendments (each verified against the canonical artifact):

| Historical statement | V5 amendment |
|---|---|
| Quick Look / Quick Review is a right-hand drawer | Centered modal over the dimmed, visible library (student ≈780px, mentor ≈940px); footer Prev/Next + fixed side chevrons. The **Assign Questions** surface remains a right-side drawer — do not confuse the two. |
| Scores display as "4/5" text | Five-position stoplight dots (`red #ff5470 → green #4ade9d`), S/M keys (round student, square mentor), trailing numeral + full tooltip/aria; numeric 1–5 buttons are input-only. Numeric text survives only inside notification/history sentences. |
| Story rows: title/excerpt/scores/status | Rows additionally carry the audio chip (🎙 + duration), first-class gold Lesson line ("Not written yet" quiet state), roman titles. |
| "Prepare/Interview Prep = coverage ring + chips" | Superseded by Interview Intelligence: readiness strip, 7 family cards as filters, question rows → Question Workshop (pairs, per-pair dual strengths, preferred answer, why-it-works, coaching notes, gaps checklist), Next Natural Questions (`fups` with student/mentor/AI sources, clinical flags, prepared state, notes), AI tray, clinical mode, Question Library view + mentor import. |
| 12-question library | 26 seeded MissionMed questions across 6 families + Custom; questions carry `family` and `source`; production schema needs both plus import provenance. |
| "Keep the ember canvas as implemented" | Six-environment system: Emberlight (default), Aurora, Night Constellation, Deep Tide, Meridian, Static Dark; Settings picker; persisted (`storyforge-bg` in the prototype); reduced-motion = one still frame per environment; canvas requires explicit `width:100%;height:100%`. |
| Italic-heavy typography | Italics reserved for authentic quotations, full-story title, brand hero headings. Production should not carry neutralized `<em>` markup. |
| No audio playback | Original Audio (immutable) → Original Transcript (immutable) → Working Version (editable); mini-player in Quick Look + workspace; production stores real files. |
| `qa[]` = `{q, by, confirmed, sStudent, sMentor, t}` | Extended: pair `why` and `fups[]`; student `qpref[qid]` and `qcoach[qid]`. |
| Coalesced notifications take "newest text" | Full branch rule: newest text replaces, except status→non-status within the window, where the status wording is kept and "New feedback is attached." is appended once; timestamp refreshed either way. |
| localStorage keys `storyforge-proto3` / `storyforge-v2` | Dead. The prototype uses `storyforge-v5` + `storyforge-bg`. No production migration reads any of these keys. |
| v1 concepts: Spark/Forged stages, Desk, attention weights, Signature/Strong assessments, persona pill | Fully revoked vocabulary and mechanics. The surviving *principles* (opening ≠ reviewing; share ≠ consent-to-project; mentor writes are additive) are carried as rationale with V5 mechanics. |

**Carried forward unamended:** the v2 review-lifecycle state machine and transition/timestamp/notification table (§7.2), the nine-instant timestamp model, the role/permission ownership rules (§5) extended with V5 field ownership, the audit-event shape (§7.3) with an extended action enum, the notification trigger table (§4) with V5 additions, the Mentor Activity spec (§7.4), and the mentor workflow model (§6, with "drawer" → "centered modal").

## 6. Contradiction audit (this package)

A final contradiction audit was run across all B1-500 documents (see `STORYFORGE_V5_INDEPENDENT_VERIFICATION.md`). No document in this package identifies any artifact other than `storyforge-v5.html` as product authority. Any future document that does so is void on that point by this lock.
