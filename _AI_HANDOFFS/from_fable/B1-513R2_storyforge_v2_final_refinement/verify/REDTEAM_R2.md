# RED-TEAM REPORT — MissionMed StoryForge V2, Refinement Pass 2 (B1-513R2)

Fresh-context adversarial review. Scope = the pass-2 surface (inspiration pins/favorites/recommends, admin bulk import, Request-a-Story truthful lifecycle, relationship-aware guest journeys, guest `started` signal, admin scale, theme/layout preferences). Everything below was **verified against the running prototype**, not inferred. Files cited are authoritative; probe output is reproduced inline.

Reproduction harness: `/home/claude/b1-513r/rt-probe.mjs` and `rt-probe2.mjs` (Playwright against `B1-513R2_FINAL_WORKING_PROTOTYPE.html`, personas via `Bearer proto-token.<persona>`).

Classification: **P0** = must fix before Founder approval · **P1** = fix in-package · **P2** = note for Codex.

---

## P1-A — Retired / unpublished Inspiration prompts leak to students through the pinned list

**What breaks.** `GET /api/inspiration/browse` builds two arrays. `prompts[]` correctly filters `state === 'active'` (shim.js:1441). But `pinned[]` resolves each pinned id with a bare lookup that **does not check state** (shim.js:1453):

```js
pinned: pinned.map((p) => { const src = db.inspirationAdmin.prompts.find((x) => x.id === p.promptId); return src ? { ...src, ... } : null; }).filter(Boolean),
```

And the pin endpoint itself validates nothing — it will pin any string (shim.js:1456–1463). So a prompt that is `retired` (the exact state bulk-imported drafts land in, shim.js:1157) is served to the student in full, with text, follow-up, and metadata.

**Attack / failure narrative (no enumeration needed).**
1. Student pins a normal active prompt — e.g. `q-002` (pinning is the feature the UI pushes).
2. Admin later **retires** that prompt (poor wording, seasonal, pulled for sensitivity): `POST /api/admin/console/inspiration/save {prompt:{id:'q-002',state:'retired'}}`.
3. The prompt correctly disappears from `prompts[]`, but the student's `pinned[]` **still returns it with full text**. "Retire" does not retire.

Second vector (imported drafts): imported rows get sequential ids `q-imp-1001, q-imp-1002…` (confirmed below). A student can `POST /api/inspiration/pin/q-imp-1001` and read a question Dr Brian has **not approved for students** — directly falsifying the headline pass-2 guarantee that imported drafts are "invisible to students until published."

**Evidence (rt-probe.mjs):**
```
A2 after retire: q-002 in prompts list (should be gone)?  false
A3 after retire: q-002 STILL in pinned[] (LEAK if true)?  true
A3b leaked pinned entry                                   { state:'retired', text:'What did you and your friends do for fun when you were about…' }
A4 pin arbitrary fake id 'q-TOTALLY-FAKE-999'             { status:200, pinned:true }   // no validation
B2 imported draft id                                      q-imp-1001                    // sequential/enumerable
```

**Why it matters.** This crosses an authorization boundary (admin-controlled, unpublished/retired content → student surface) and contradicts a stated pass-2 invariant that the Founder is being asked to approve. It is user-visible: the frontend renders `pinned[]` verbatim (`b1513r2PinnedSection`, extensions3.js:174–193). Content is admin question text, not student PII — hence P1, **but treat as P0 if "imported drafts invisible until published" is a launch gate**, because this makes that claim false.

**Bounded fix.** (a) In the `pinned[]` mapper (shim.js:1453) filter the source to `state === 'active'` — drop or mark-stale otherwise. (b) At pin time (shim.js:1457) reject ids that are not a currently-active prompt. Production (RLS) must gate the pinned-prompt read on the same publish-state predicate as browse, not just on ownership of the pin row.

---

## P1-B — `bulk-commit` trusts client rows and lets a client-supplied `prompt.id` clobber a stable prompt ID

**What breaks.** `bulk-commit` re-validates nothing: it takes the client's `rows`, keeps whatever is flagged `ok`, and unshifts them (shim.js:1154–1162):

```js
const rows = (body?.rows || []).filter((r) => r.ok);
rows.forEach(...) => db.inspirationAdmin.prompts.unshift({ id: `q-imp-${db.auditSeq += 1}`, ...r.prompt, state: 'retired', imported: true, sortOrder: 1 });
```

Two defects compound: (1) the server trusts the client `ok` flag and `prompt` payload, so the entire `bulk-parse` validation/dedupe is bypassable; (2) `...r.prompt` is spread **after** the generated `id`, so a client-supplied `prompt.id` **overrides** it. The normal parse→commit path is safe (parse never emits an `id`), but the endpoint accepts a hand-crafted body.

**Attack / failure narrative (admin-gated, but a real data-integrity/stable-ID clobber).**
`POST /api/admin/console/inspiration/bulk-commit` with `rows:[{ok:true, prompt:{id:'q-012', text:'CLOBBERED SHADOW ENTRY', ...}}]`. Result: **two prompts now share id `q-012`**, the injected `retired` shadow unshifted to the front. Every id-keyed lookup — `find(x=>x.id===...)` in pinned resolution, `/inspiration/save`, restore — resolves to the shadow, not the real prompt. Subsequent admin edits silently mutate the invisible shadow.

**Evidence (rt-probe2.mjs):**
```
after clobber: q-012 entries (dup id!)  [ {state:'retired', imported:true, text:'CLOBBERED SHADOW ENTRY'},
                                          {state:'active',  imported:false, text:'Tell me about a small act of kindness fr'} ]
after clobber: FIRST find() match       { state:'retired', text:'CLOBBERED SHADOW ENTRY' }
after admin 'save recommended' on q-012  -> mutated the RETIRED shadow, not the real active prompt
```

Also confirmed: a row that would fail parse (empty follow-up, `<img onerror=…>` text) commits fine with `ok:true` (rt-probe.mjs `B1 committed=1`). Stored verbatim — safe today only because render escapes (see "What's solid"), but it is a defense-in-depth hole.

**Why it matters.** This is exactly the "bulk import clobbering stable IDs" risk the ticket named. A real Postgres PK would reject the duplicate insert — the *contract* demonstrated here (client authors the id, server unshifts) is the thing that must not survive to production. P1 (admin-gated, no student escalation, but corrupts the prompt table's ID stability and defeats parse-time validation).

**Bounded fix.** Server generates the id and **ignores any client `id`** (put `...r.prompt` *before* the fixed fields, or destructure and drop `id`). Re-run validation/dedup server-side inside `bulk-commit` instead of trusting client `ok`/`duplicate`. Enforce id uniqueness on insert.

*Sub-note (P2):* `bulk-parse` dedupes only against **existing** prompts, not within the same CSV batch (shim.js:1149) — two identical new rows both pass `ok` and both commit.

---

## P1-C — A `bounced` invitation can be re-sent to `delivered`, leaving a stale bounce reason — the lifecycle lies

**What breaks.** `send`/`resend` only guards against `story_shared` (shim.js:1365–1372):

```js
if (invitation.status !== 'story_shared') invitation.status = 'sent';
...
invitation.deliveredAt = new Date().toISOString();
if (invitation.status === 'sent') invitation.status = 'delivered';
```

A terminal `bounced` invitation is flipped to `sent` → `delivered` with a fresh `deliveredAt`, while `bounceReason` is never cleared. And the email address of a bounced invite **cannot be corrected** — `update` is draft-only (shim.js:1376) — so the resend goes to the same dead address yet is reported as delivered.

**Evidence (rt-probe.mjs):**
```
C0 inv-4 before   { status:'bounced',   bounceReason:'Hard bounce — address not found' }
C1 resend inv-4   -> status 'delivered'
C2 inv-4 after    { status:'delivered', bounceReason:'Hard bounce — address not found', deliveredAt:true }   // internally contradictory
```

**Why it matters.** Truthful invitation lifecycle is the explicit pass-2 feature (#3). This produces a state that is both a lie ("delivered" over a known-dead address the user can't fix) and internally inconsistent (`delivered` + populated `bounceReason`). P1 at the contract level.

**Bounded fix.** Reject `send`/`resend` when `status === 'bounced'` (require a new invitation, or a re-validated address) and clear/guard conflicting delivery fields on any legitimate re-send. Do not treat `sent`/`delivered` as reachable from a terminal failure state.

---

## P2-D — `revoke` unconditionally overwrites terminal states (`story_shared`, `bounced`)

`revoke` sets `status='revoked'` with no state guard (shim.js:1374). Revoking a `story_shared` invitation flips the student's own record to `revoked` (losing the truthful "a story was shared" state, though the contribution row survives) **and** kills the guest link — a returning contributor who already gave a story now sees "This invitation was cancelled by the student" (410).

**Evidence (rt-probe.mjs):** `D1 revoke inv-1 (story_shared) -> revoked`; `D2 guest link -> 410`.

**Fix.** Disallow revoke on `story_shared` (offer "close"/"archive" instead); don't overwrite terminal truthful states with `revoked`.

---

## P2-E — Guest contribution transcript is unbounded on a token-only unauthenticated write

The guest `contribution` endpoint (shim.js:1303–1318) caps count at 3 per invitation but does **not** bound transcript size. A 500,000-char transcript is accepted and stored intact.

**Evidence (rt-probe.mjs):** `E1 500k-char contribution -> 200`; `E2 stored transcript length 5e5`.

**Why it matters.** Only auth is the magic-link token, so this is a storage-amplification / abuse vector in the production contract (and the text is later promoted into a story and rendered). **Fix.** Enforce a server-side max length (e.g. a few KB) on `transcript` and reject oversize; keep the 3-per-invite cap.

---

## P2-F — No relationship allowlist; unmapped relationships fall back to leaking parent-targeted prompts

`POST /api/requests` accepts any `relationship` string (shim.js:1350 — `String(body?.relationship || 'best_friend')`, no allowlist). For a relationship with no `JOURNEYS` entry and no matching library prompts, the guest handler falls back to `CONTRIB_LIBRARY.prompts.slice(0, 6)` regardless of relationship (shim.js:1334), with an **empty** `journeyLine`.

**Evidence (rt-probe.mjs):** an invite with `relationship:'landlord'` →
```
F1 journeyLine: (empty)
F2 first prompt rel: ['parent']   // e.g. "the first moment you thought this child will take care of people?"
```

This silently breaks the pass-2 guarantee that a journey exposes "only that relationship's prompts" (probe 31) whenever the relationship is off-list. Prompts aren't PII, hence P2. **Fix.** Validate `relationship` against `CONTRIB_LIBRARY.relationships` at create/update; on any legitimate fallback use relationship-agnostic prompts + a generic line, not the parent-ordered first-6.

---

## P2-G — Ambient `currentPersona` fallback: requests with no `Authorization` header are served as the last-used identity

`route` (shim.js:576) and `routeR` (shim.js:1280) resolve identity as `tokenPersona || currentPersona`, a module-global. A request with **no** auth header is served as whoever was last active. In-browser this is benign (single logged-in session, so it always resolves to the current user — no cross-user leak). But "the API semantics become the production contract," and an ambient/session-global identity fallback is exactly the anti-pattern RLS/Postgres must forbid: every endpoint must require an explicit verified identity and deny when absent (the `Bearer proto-token.nobody` → 401 path in probe 5 only covers a *present-but-unknown* token, not a *missing* one). **Fix / note for Codex:** production must have no ambient-session fallback; unauthenticated → 401 unconditionally.

---

## What's solid (verified, not padding)

- **Stored-content injection is properly escaped.** `esc()`/`attr()` are correct HTML escapers, and every untrusted field on the pass-2 surface is escaped at render: CSV-imported `prompt.text`/`followUp`/`interviewUse` (extensions3.js:148,121,129,844,854), guest `transcript`, `contributorName`, `personalMessage`, `journeyLine`, `disclosure`, `emailMasked` (extensions3.js:360–511). The `<img onerror>` text injected via P1-B renders inert. No stored-XSS path found.
- **`pin-order` does not drop entries.** It sorts in place (shim.js:1467); ids absent from the payload sort stably to the front but are never lost. The specific data-loss the ticket worried about is not present.
- **Student↔student isolation holds** across the new surfaces: pins, favorites, and `answeredStoryId` are per-user (`INSPIRATION_PINNED[me.id]`, `INSPIRATION_FAVORITES[me.id]`; answered map built only from `me.id`'s stories, shim.js:1449). Probes 24/25/39 pass and I could not cross them.
- **Guest payload is minimal** — first name + synthetic avatar only, no story/library/id leakage (probe 18), and guest ops act on the invitation owner, never the caller.
- **Admin scale endpoints are correctly gated and bounded** — students get 403 on directory/queue (probes 6/37), `pageSize` capped at 50, out-of-range pages return empty with sane totals (probe 36).
- **Bulk import cannot auto-publish** — committed rows are forced to `state:'retired'` (shim.js:1157); the only student-visibility leak of that content is via P1-A, not via a publish path.

---

## Summary table

| ID | Sev | Finding |
|----|-----|---------|
| A | P1 | Retired/unpublished prompts leak to students via `pinned[]` (no state filter; pin unvalidated) |
| B | P1 | `bulk-commit` trusts client rows + client `prompt.id` clobbers stable prompt IDs (dup-id shadow) |
| C | P1 | `bounced` invitation re-sendable to `delivered` with stale bounce reason — lifecycle lies |
| D | P2 | `revoke` overwrites terminal `story_shared`/`bounced`; kills already-shared guest link |
| E | P2 | Unbounded guest contribution transcript on token-only write (storage abuse) |
| F | P2 | No relationship allowlist; unmapped relationship falls back to parent-targeted prompts |
| G | P2 | Ambient `currentPersona` fallback serves header-less requests as last identity (contract anti-pattern) |

No P0 that firmly blocks approval; **A is the top priority and borders P0** because it falsifies the stated "imported drafts invisible until published" pass-2 guarantee.

---

## RESOLUTION ADDENDUM (fixed in-package after this report)

| # | Sev | Resolution | Regression probe |
|---|-----|-----------|------------------|
| A | P1 | `pinned[]` now serves only `state === 'active'` prompts; `POST /inspiration/pin/:id` refuses non-active prompts with 404 `prompt_not_available` (shim.js) | `RT-A` ×2 — PASS |
| B | P1 | `bulk-commit` re-validates every row server-side (length, follow-up, duplicate, dimension allowlists) and the server-generated stable ID is applied AFTER the spread, so client IDs are discarded and existing questions can never be shadowed | `RT-B` ×2 — PASS |
| C | P1 | `send`/`resend` refuse `bounced`/`revoked` invitations with 409 `invitation_terminal`; the UI replaces "Try again" with **Re-invite with a new address** (fresh invitation, fresh token, bounced link stays dead) | `RT-C` — PASS |
| D | P2 | `revoke` records `revokedAt` and its response states that already-received contributions are kept (revoke-anytime remains deliberate, per pass-1 P1-3) | covered by probe 17 |
| E | P2 | Guest transcript bounded to 20,000 chars, duration to 30 min, on the token-only write | `RT-E` — PASS |
| F | P2 | Invitation `relationship` validated against the governed contributor library at create (400 `relationship_invalid`) | `RT-F` — PASS |
| G | P2 | Deliberate prototype affordance for file:// persona switching. Carried as a **production contract requirement** in the RLS doc: production derives identity exclusively from the signed session; ambient/last-identity fallback is forbidden | contract item, doc 07 |

Post-fix probe suite: **61/61 PASS** (27 inherited B1-513/R probes + 27 R2 probes + 7 red-team regressions).
