# B1-513 Multi-Version Story Contract

Binding contract for Product System A. Decisions inherit from the spine (D1); this document is the implementation-grade elaboration.

## 1. Model

One canonical StoryForge story contains up to four purposeful tellings of the same underlying experience:

| Version | Storage | Mutability | Authority |
|---|---|---|---|
| Original Telling | Existing immutable original (first revision / original text path) — unchanged | Never editable; never silently overwritten; protected server-side | Existing B1-50x provenance model |
| Full Story | Existing `stories` working text/title/lesson — **zero-copy adoption** | Existing PATCH path, unchanged semantics | Existing working-version contract |
| 30-Second Version | New `sf_story_versions` row, `version_key='thirty_second'` | Student-editable via new bounded API | This contract |
| NNQ Setup Version | New `sf_story_versions` row, `version_key='nnq_setup'` | Student-editable via new bounded API | This contract |

The decisive property: **existing production data is never migrated, copied, or rewritten.** "Full Story" is a published *label* on the existing `workingVersion` section (Content & Display), not a new storage location. A student's working text on the day R2 ships is byte-identical before and after. Rollback of R2 is therefore a pure UI/flag rollback with dormant additive tables.

### 1.1 Why not a generic N-version table for all four

Considered and rejected: migrating original/working into `sf_story_versions` for uniformity. It would rewrite every production story row's read path, invalidate the immutable-original provenance chain, enlarge blast radius from "additive" to "core", and buy only aesthetic uniformity. The two legacy versions stay where 441 users' data already lives; the registry unifies them at the presentation layer only.

## 2. Schema (additive only)

```sql
CREATE TABLE sf_story_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES sf_stories(id),
  version_key text NOT NULL CHECK (version_key IN ('thirty_second','nnq_setup')),
  body text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','voice')),
  recording_id uuid NULL,          -- provenance: existing recording session, when voice
  audio_asset_id uuid NULL,        -- provenance: existing permanent audio, when voice
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, version_key)
);

CREATE TABLE sf_story_version_revisions (   -- append-only
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES sf_story_versions(id),
  body text NOT NULL,
  source text NOT NULL,
  recording_id uuid NULL,
  audio_asset_id uuid NULL,
  saved_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Both tables: RLS + FORCE RLS; owner-only student policies; reviewer read via bounded SECURITY DEFINER limited to mentor-visible/submitted parent stories (doc 11). The `version_key` CHECK deliberately excludes `original` and `full_story`: the database itself cannot represent an overwrite of the protected tellings. New version keys require a migration — a Founder-level product act, not a config act; the config registry can only relabel/hide what exists.

## 3. Mutation contract

All mutations via `PATCH /api/stories/:id/versions/:key` (owner-only, row-versioned, audited) with `mode`:

- `save` — replace body. If body changed, prior body is snapshotted to `sf_story_version_revisions` first, atomically in the same transaction.
- `append` — client submits the composed full body (prior + new material); server snapshots prior, saves whole. Append is a UX concept; storage is whole-body + snapshot, which keeps recovery trivially correct.
- `retell` — explicit fresh start after client-side confirm. Prior body snapshotted; new body may be empty (a blank page is a valid retell start).

`POST /api/stories/:id/version-restore {versionKey, revisionId}` — restore is symmetric: current body becomes a revision, revision body becomes current. **No operation deletes text.** History is monotone.

Optimistic concurrency: `expectedVersion` on every write; conflict returns `version_conflict` with the server body so the client can offer "keep mine / take theirs" — same pattern as B1-512 Content & Display. Server-side write conflicts can never lose a telling because every transition snapshots first.

### 3.1 Voice per version

Production reuses the **existing** recorder pipeline unchanged: same `/api/recordings` session lifecycle, segment upload, IndexedDB offline durability, transcription provider path, permanent-audio retention. The only new element is the sink: transcript text streams into the version editor instead of `#capBody`, and on save the version revision records `recording_id`/`audio_asset_id` provenance. No second audio system, no new provider path, no new R2 namespace. (The prototype simulates this sink with a scripted transcript; the recorder architecture reference is B1-510K/B1-511 evidence.)

Retention: version-linked audio follows the existing permanent-audio retention rules. Version revisions are capped at 50 per version; beyond that the oldest revisions are compacted (removed with an audit event recording count and span). Original Telling audio is untouched by any version operation.

## 4. Student experience (must not feel like Git)

- The existing `.voiceTabs` strip grows from two tabs to four. Original Telling keeps its 🔒 framing and exact preserved-forever copy. Tabs for unstarted versions show a subtle `+` and reduced emphasis.
- A one-line strip states the model in product language: *"One story · N of 4 tellings. Every version belongs to '[title]' — the Original telling is preserved untouched."*
- Each editable version shows: label, helper, recommended target (e.g. *"Aim for ~75–90 spoken words (≈30 seconds)"*), started/last-saved timestamps, source (⌨/🎙), live word count with target feedback, explicit Save with the existing durable-save language, Append-with-voice, Retell-with-voice, Start-a-fresh-retelling.
- History is one expander — *"Show earlier tellings of this version (N)"* — listing timestamped snippets with a single **Restore this telling** action and the reassurance that restoring loses nothing. Vocabulary is "earlier tellings," never "revisions/commits/branches/diffs."
- Completion ("Finish it") and submission contracts are **unchanged** and keyed to the Full Story + Learning Lesson exactly as B1-512 shipped them. 30-Second/NNQ never gate completion or submission in Stage 2.
- Mentor/admin view: read-only rendering of each version with student attribution; absent versions state plainly that the student hasn't written one.

## 5. Configuration (Founder-governed, doc 09)

The Content & Display payload gains a `versions` registry: per key — label, helper, target, sortOrder, state (`active|hidden|retired`). Constraints enforced at validate/publish: `full_story` cannot be hidden or retired; `original` is not in the registry at all (rendered unconditionally, provenance copy fixed); labels are plain text ≤60 chars; helpers ≤400. Hidden versions keep their data and reappear intact when reactivated; a hidden version with existing content still renders read-only for that story (no data trapdoors).

## 6. NNQ Setup Version guidance (canonical terminology verified)

Production already owns the term: the Interview Prep workshop's **Next Natural Questions** panel — *"Your answer creates the interviewer's next question. Map them here, prepare each one, and you become difficult to surprise."* (app.js 5462–5464). The NNQ Setup Version guidance uses the same method language: *"Shaped for MissionMed's Next Natural Questions method: end this telling so the interviewer's next question is one you have already prepared."* Target ~60–120 words, finishing "on a door you want opened." When Interview Prep is later unhidden, an NNQ Setup telling is the natural input to the existing pairing workshop — noted as a future bridge, not built in Stage 2.

## 7. Story-level effects

- Library rows gain a quiet `N tellings` tag only when N > 2; no other row change.
- Story history gains `story.version_edited` / `story.version_restored` events (existing audit stream, new action labels).
- Story Media, when activated, remains attached to the canonical story only. Versions never own media.

## 8. Acceptance gate (R2)

R2 ships when: all §3 mutations pass PostgreSQL tests incl. conflict/snapshot/restore invariants ("no transition reduces total stored text"); cross-student and anonymous negative tests return 404/401; Original-protection tests prove the API and config layers both reject any original/full_story mutation through version paths; the four-tab Story Room passes axe (0 serious/critical), keyboard-only operation, 390×844 zero-overflow, and all three text sizes; voice append/retell works end-to-end in a Founder canary with real microphone; and disabling `story_versions` returns the Story Room to the exact two-tab B1-512 rendering with zero data loss.
