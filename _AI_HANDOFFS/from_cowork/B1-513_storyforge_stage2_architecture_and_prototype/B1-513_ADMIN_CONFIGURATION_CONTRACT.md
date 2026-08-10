# B1-513 — Admin Configuration Contract

**Ticket:** B1-513 StoryForge Stage 2 · **Releases:** R2 (version registry), R3/R4 (Inspiration content) per spine D7
**Authority:** `B1-513_DECISIONS_SPINE.md` (D1 registry model, D3 Inspiration data, D6 configuration decision) and `B1-513_CURRENT_CANONICAL_BASELINE.md` (§3 Content & Display, §5 B1-512 machinery).
**Demonstrated in:** `prototype/extensions.js` (`b1513VersionConfigPanel`, `b1513InspirationConfigPanel`) and `prototype/shim.js` (`/api/admin/console/content-display*`, `/api/admin/console/inspiration*`, `/api/presentation` payload).

This contract defines the **bounded** ways the Founder can shape what students see — and, just as importantly, the ways nobody can. It extends the existing B1-512 Content & Display machinery; it does not build a second configuration system.

---

## 1. Machinery reused, not reinvented

Everything below rides the B1-512 Content & Display pipeline exactly as shipped (baseline §3, §5):

| Property | Behavior (unchanged from B1-512) |
|---|---|
| Versioned payload | One configuration document with a monotonically increasing `rowVersion` and `updatedAt`; every publish is a new version. |
| Validate | `POST /api/admin/console/content-display/validate` — server-side validation of the full draft before anything else. |
| Browser-only preview | Validated draft renders in the Founder's browser only; **nothing is persisted and no student sees anything** until publish. |
| Publish | `POST /api/admin/console/content-display/publish` with optimistic `rowVersion`; compare-and-swap on the server; conflict → 409 (§7). |
| Restore defaults | `POST /api/admin/console/content-display/restore-defaults` — returns the shipped default payload as a new published version (itself audited; nothing is deleted). |
| Append-only audit | Every publish/restore appends actor, timestamp, and before/after to the existing configuration audit. |
| Independent force-off | The Content & Display env kill switch continues to bypass published configuration and serve shipped defaults, independent of DB state. |

Stage 2 adds two configuration domains to this machinery: the **version registry** (a new `b1513.versions` block inside the Content & Display payload, per D1 "configuration, not schema") and the **Inspiration content domain** (its own versioned configuration, `sf_inspiration_prompts` + config version, surfaced in Release Controls, per D6).

## 2. Version registry management

The registry governs how the story versions present to students (labels, helper, target, order, visibility). It never governs student content — bodies live in `sf_story_versions` (D1) and are untouchable from any configuration surface.

### 2.1 Managed entries

`b1513.versions[]`, one entry per configurable version key:

| Field | Constraints | Notes |
|---|---|---|
| `key` | Immutable enum: `full_story`, `thirty_second`, `nnq_setup` | Keys are identity; the Founder edits presentation, never keys. The section config key for the canonical text remains `workingVersion` (D1). |
| `label` | Plain text, 1–60 chars | e.g. "Full Story", "30-Second Version", "NNQ Setup Version". |
| `helper` | Plain text, ≤ 400 chars | Student-facing guidance under the tab. |
| `target` | Plain text, ≤ 120 chars | Recommended target, e.g. "Aim for ~75–90 spoken words (≈30 seconds)." |
| `sortOrder` | Integer | Orders the version tabs after Original telling. |
| `state` | Enum `active` \| `hidden` \| `retired` | Per-key restrictions below. |

### 2.2 Protections (server-enforced, not UI courtesy)

| Rule | Enforcement |
|---|---|
| **Original telling is provenance-protected and unmanageable.** It is not in the registry at all: no label edit, no hide, no retire, no reorder away from first position. | The Original is rendered from the immutable original path (revisions[0]/original_text, D1); validate rejects any payload containing an `original` registry entry; the config UI shows it only as a locked, explanatory row. |
| **`full_story` cannot be hidden or retired.** It is the canonical editable telling (`stories.text`). | Validate rejects `state != 'active'` for `full_story`; the UI does not offer the control. |
| **`thirty_second` / `nnq_setup`** may be `active`, `hidden` (temporarily not offered), or `retired` (not offered going forward). | Enum-validated. |
| **Hiding/retiring never touches content.** Existing version bodies and their append-only revisions in `sf_story_versions` / `sf_story_version_revisions` are preserved untouched; a re-activated version reappears with its content intact. Students who already wrote a now-hidden version keep durable server data; only the tab's availability changes. | Registry state is presentation-layer only; no configuration path issues writes to version tables. |

### 2.3 R2 acceptance touchpoints

Renaming "30-Second Version" → publishing → the student tab strip shows the new label with no redeploy; restore-defaults returns the shipped labels; the Original row is demonstrably uneditable including via direct API payload manipulation (validate rejects).

## 3. Inspiration content management

The Inspiration prompt bank is admin-governed content (D3): `sf_inspiration_prompts` with stable IDs, versioned as its own configuration domain and surfaced in Release Controls (flag `inspiration_admin`).

### 3.1 What the Founder can manage

| Capability | Detail |
|---|---|
| Stable prompt IDs | Every prompt has an immutable ID (e.g. `q-034`). Edits change wording or metadata under the same ID; IDs are never reused or renumbered. |
| Wording edits | `text` (the question) and `follow_up`, plain text, ≤ 400 chars each. |
| Active / retired state | `state ∈ {active, retired}`. Retired prompts are excluded from server-side selection (D3 scoring) immediately on publish. |
| Ordering | `sort_order` integer — a tiebreaker/priority input to selection, not a student-visible list. |
| Add new | New prompts get a freshly generated stable ID, full dimension tagging required before they can be `active`. |
| Dimension tagging | `who[]`, `who_detail[]`, `domain[]`, `energy[]`, `territory`, `interview_use` — all enum-validated against the wizard's dimension sets (D3). |
| Helper copy | Wizard step helper text (the per-step guidance strings), same plain-text rules. |
| Preview the wizard | "Preview the student wizard" switches the Founder to Student View (the existing toggle) and opens the `inspiration` route against the *published* content — a true preview of what students see, using no special rendering path. Draft-state preview is browser-only per §1. |
| Publish | Same validate → preview → publish shape, on the Inspiration domain's own `rowVersion`; every publish audited append-only. |

### 3.2 Why retiring can never orphan a student's work

Promotion snapshots. When an Inspiration answer becomes a story, the story's `origin` records `{type: 'inspiration', prompt_id, prompt_text}` — the prompt **text as asked** is copied into the story's provenance at promotion time (D3). `sf_inspiration_saved` likewise snapshots `prompt_text` at save time. Therefore:

- Retiring a prompt removes it from future selection only. Every existing story and saved-for-later item keeps the exact question its author actually answered, forever, with no join back to the live prompt row required.
- Rewording a prompt changes future askings only; historical provenance keeps the historical wording.
- Consequently there is **no delete** operation on prompts — only `retired`. The bank is append-and-retire, matching the product's append-only posture.

## 4. Validation rules (both domains)

Validation runs server-side on `validate` and again on `publish` (defense against stale/hand-built payloads):

| Rule | Detail |
|---|---|
| Plain text only | All configurable strings are plain text. Any markup — HTML tags, CSS, `javascript:`/`data:` URIs, script fragments, event-handler patterns — is rejected with a per-field error. Rendering additionally escapes everything (`esc()`/`attr()` paths) as defense in depth; validation is the contract, escaping is the seatbelt. |
| Length caps | label ≤ 60; helper ≤ 400; target ≤ 120; prompt text / follow_up ≤ 400; non-empty where required (labels, active prompt text). |
| Enum states | `versions.state` per §2.2; `prompt.state ∈ {active, retired}`; dimension values must be members of the published dimension sets; unknown enum values reject. |
| Structural | Version keys unique and drawn from the fixed key set; prompt IDs unique; `sortOrder`/`sort_order` integers; no unknown top-level fields in the payload (reject, don't ignore — unknown fields are how scope creeps in silently). |
| Protection rules | §2.2 rules re-checked at publish time regardless of what any client sent. |

Validation failures return per-field errors that the config UI renders **inline at the offending field**, with nothing published and the draft preserved.

## 5. How published payload reaches students

`GET /api/presentation` (the existing single presentation read) returns the published configuration — `taxonomy`, `sections`, `navigation`, and now `b1513` — with `rowVersion` and `updatedAt`. The student client:

1. Reads `b1513.versions`, filters `retired`, sorts by `sortOrder`, and renders the tab strip: Original telling (always, always first, outside the registry) → `full_story` → other `active` versions. `hidden` and `retired` tabs simply do not render.
2. Applies `label`, `helper`, and `target` verbatim (escaped) in the version editors and guides.
3. Falls back to shipped defaults when the payload lacks a `b1513` block (pre-publish, force-off, or flag-off states) — the client never breaks on absent configuration.
4. Inspiration wizard content (dimensions, helper copy, prompt selection inputs) is served from the published Inspiration configuration version; students never receive the retired portion of the bank.

Students receive only published state. There is no draft leakage path: previews are browser-local to the Founder (§1), and `/api/presentation` reads the published row only.

## 6. Failure modes

| Failure | Behavior |
|---|---|
| Publish conflict (`rowVersion` mismatch — e.g. two admin sessions, or Brian_test and brinyu editing concurrently) | Server refuses with 409. UI states plainly that the configuration changed since this draft was loaded, offers **Reload latest configuration**, and preserves the Founder's draft text on screen so wording is not lost while re-applying. No silent overwrite; no merge guessing. |
| Validation errors | Inline per-field messages (§4); publish button blocked until the draft revalidates; nothing partial is ever persisted. |
| Force-off engaged | Students see shipped defaults immediately; the config UI shows the force-off state honestly rather than pretending published config is live. |
| Publish succeeds but a mistake shipped | Restore defaults (one action, audited) or re-edit and publish; version history + audit make every prior state reconstructible. |

## 7. Explicit non-goals

These are boundaries, not backlog:

1. **No source editing.** No configuration surface edits code, templates, styles, or markup. The Founder shapes bounded, validated content fields — nothing else (D6: "No source-code editing").
2. **No arbitrary code or rich text.** No HTML, no CSS, no scripts, no embeds, no file uploads through configuration. Plain text with length caps is the ceiling.
3. **No student-data access from config surfaces.** Configuration screens read and write configuration only. They display no student names, stories, counts, or analytics; the operating console (`B1-513_FOUNDER_ADMIN_OPERATING_CONSOLE.md`) is the only place student data appears, under its own authorization rules. A config endpoint never joins student tables.
4. **No schema authority.** Configuration cannot add version keys, invent dimensions, or otherwise change shape — new keys/dimensions are code+migration changes with their own review.
5. **No deletion of history.** No configuration action deletes prompts, versions, revisions, audit rows, or prior configuration versions.

## 8. Acceptance criteria

1. **Round trip:** edit a version label and a prompt wording → validate → browser-only preview (student traffic unaffected, verified) → publish → `/api/presentation` serves the new payload with incremented `rowVersion` → student UI reflects it without redeploy.
2. **Protections:** attempts to hide `full_story`, edit/retire/rename the Original, or publish an `original` registry entry are rejected by the server even when submitted as a hand-built payload bypassing the UI.
3. **Retire safety:** retire a prompt that an existing story was promoted from → the story's Story Room and history still show the exact original prompt text; the wizard never offers the retired prompt again; saved-for-later items keep their snapshot text.
4. **Validation:** payloads containing HTML/script fragments, over-cap lengths, unknown enum values, duplicate IDs, or unknown fields are rejected with inline per-field errors and nothing persisted.
5. **Conflict:** two concurrent editors — second publish gets 409 with reload guidance and preserved draft; audit shows exactly one applied version.
6. **Restore defaults:** returns shipped labels/helpers/targets and the seeded prompt bank state as a new audited version; student content (version bodies, promoted stories, saved items) is untouched.
7. **Force-off:** with the kill switch engaged, students receive shipped defaults regardless of published state; disengaging restores published state with no data loss.
8. **Audit:** every publish, restore, and prompt state change appears in the append-only audit with actor and timestamp; the audit is readable from Release Controls and cannot be edited from any surface.
9. **Non-goal negative tests:** config endpoints return no student data fields under any parameters; no configuration input renders unescaped anywhere in the student or admin UI (sentinel `<script>` test); students calling any config endpoint receive 403.
