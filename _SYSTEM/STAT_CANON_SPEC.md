# STAT CANON SPEC

**Version:** 1.0
**Date:** 2026-04-20
**Authority:** MR-702 v1.1
**Prompt ID:** (B3)-STAT-PH4-CLAUDE-MED-001
**Scope:** Canonical contract between the STAT duel client (stat_latest.html) and server-side duel RPCs. This spec is frozen for Phase 4 cutover and governs every implementation that touches the duel pack path.

This document defines the shared contract only. It does not specify storage layout, UI, or scoring math beyond what the contract requires.

---

## 1. Pack Envelope Schema

Every `get_duel_pack(duel_id)` response MUST contain exactly these 7 fields. Extra fields are a schema violation.

| Field | Type | Description |
|-------|------|-------------|
| `duel_id` | uuid | Canonical identifier of the duel. Matches the key used by `create_bot_duel` / `create_duel`. |
| `dataset_version` | text | Dataset version label. Must match `window.MM_DUEL_DATASET_VERSION` on the client. Current value: `'v4'`. |
| `question_ids` | text[] | Ordered list of question identifiers. Order is canonical and must not be reshuffled client-side. Length MUST match `choices_order` length. |
| `choices_order` | text[][] | Array of arrays. Outer index aligns with `question_ids`. Each inner array is the locked presentation order of answer option labels for that question (e.g. `['A','B','C','D']`). Cardinality of each inner array is fixed at pack seal time. |
| `content_hash` | text | SHA-256 hex (lowercase, 64 chars) of the canonical pre-image defined in section 4. Computed server-side at seal time. Opaque to the client except for parity verification. |
| `sealed_at` | timestamptz | UTC timestamp at which the pack envelope was frozen. Set exactly once by `create_duel` / `create_bot_duel`. |
| `finalized_at` | timestamptz \| null | UTC timestamp at which both players submitted and the duel moved to `finalized`. Null until finalization. |

Client validation rules:
1. Reject the pack if any of the 7 fields is missing or of the wrong JS type.
2. Reject if `question_ids.length !== choices_order.length`.
3. Reject if any entry in `choices_order` is empty or contains duplicates.
4. Recompute the hash (section 4) and compare byte-for-byte against `content_hash`.

---

## 2. Named Error Catalog

All server-raised duel errors use the `DUEL_` / `idempotency_` prefix and are returned as structured codes, never as free-text only. Clients MUST switch on the code, not the message.

### Server-side codes

| Code | Meaning |
|------|---------|
| `idempotency_key_required` | Mutating RPC called without an idempotency key header or parameter. |
| `duel_not_found` | `duel_id` does not resolve to a row, or caller lacks access. |
| `duel_pack_unsealed` | Pack envelope has not been sealed yet. Retry only after `create_duel` / `create_bot_duel` returns. |
| `duel_state_invalid` | Requested transition is illegal from the current state (e.g. submit on `finalized`). |
| `duel_not_finalized` | Consumer requested scored output before both sides finalized. |
| `dataset_version_unknown` | `dataset_version` supplied by caller is not in the server registry. |
| `dataset_version_mismatch` | `dataset_version` on the pack does not match the version bound at duel creation. |
| `insufficient_questions` | Question pool for the requested dataset cannot satisfy the required pack size. |
| `answer_count_mismatch` | Submitted answer array length does not equal `question_ids.length`. |

### Client-side gate errors

Raised locally by the canon gate module before any RPC leaves the browser.

| Code | Meaning |
|------|---------|
| `DUEL_ID_MISSING` | Duel URL parsed but no `duel_id` present and no `match` param to fall back on. |
| `DUEL_PACK_RPC_ERROR` | `get_duel_pack` returned a non-2xx response or threw. Preserve the server code if present. |
| `DUEL_PACK_MISSING` | RPC succeeded but response did not contain a pack envelope. |
| `DUEL_PACK_HASH_MISMATCH` | Recomputed client hash does not equal `content_hash`. Halt play; do not submit answers. |

Behavior on client-side gate error: the canon gate halts the duel bootstrap, logs the code, and surfaces a blocking UI state. It does NOT fall back to any legacy local generator.

---

## 3. State Machine

```
         create_duel / create_bot_duel
                     |
                     v
                 [ pending ]
                     |
                submit_ready (both)
                     |
                     v
                 [ active ]
                     |
              both submit_answers
                     |
                     v
                [ finalized ]
```

`void` is a terminal sink reachable from ANY state on rejection, expiry, anti-abuse flag, or admin cancel:

```
  [ pending ] --\
  [ active  ] ---> [ void ]   (terminal)
  [finalized] --/
```

Transition rules:
- `pending -> active`: both players acknowledged the pack; irreversible.
- `active -> finalized`: both answer submissions accepted server-side; irreversible.
- `* -> void`: allowed from any non-void state. Once `void`, no further transitions. Score requests return `duel_not_finalized`.
- No direct `pending -> finalized` path.
- `finalized -> *` is disallowed (finalization is a write-once terminal, barring `void` on anti-abuse).

Clients MUST treat `void` identically to an error condition for all scoring UIs.

---

## 4. Hash Canonicalization Rules

### 4.1 Server canonical pre-image (pg)

Exact concatenation, produced in Postgres during `create_duel` / `create_bot_duel`:

```
'dataset_version=' || ds
|| '|question_ids='  || qids.join(',')
|| '|choices_order=' || groups.join(';')
```

Where:
- `ds` is the literal `dataset_version` text (no quoting, no trimming).
- `qids` is the `question_ids` array in canonical order, joined by a literal comma `,` with no surrounding whitespace.
- `groups` is built per question by joining its `choices_order[i]` with a literal comma `,`. The per-question groups are then joined by a literal semicolon `;`.

The digest call:

```
encode(digest(pre_image, 'sha256'), 'hex')
```

Output: 64-character lowercase hex string. This value is stored in `content_hash`.

### 4.2 Pre-image delimiters and order

Fixed order:
1. `dataset_version=<ds>`
2. `|question_ids=<q1>,<q2>,...`
3. `|choices_order=<c1a,c1b,...>;<c2a,c2b,...>;...`

Delimiters are literal ASCII characters:
- `|` separates the three segments.
- `,` separates elements inside `question_ids` and inside a single question's choices.
- `;` separates per-question choice groups.
- `=` follows each segment name.

No trailing delimiter. No leading delimiter. No surrounding whitespace. No URL-encoding. No quoting. Labels are case-sensitive.

### 4.3 Encoding

UTF-8 bytes in, SHA-256 out, hex-encoded lowercase. The server uses `digest(text, 'sha256')` from pgcrypto. The client uses `crypto.subtle.digest('SHA-256', new TextEncoder().encode(preImage))` and converts the resulting ArrayBuffer to lowercase hex.

### 4.4 Client parity requirement

The client pre-image byte sequence MUST be identical, byte-for-byte, to the server pre-image. Any difference (including an extra trailing newline, case change, or whitespace) produces a different hash and triggers `DUEL_PACK_HASH_MISMATCH`.

---

## 5. Fixed Hash Test Vector

Used by Phase 4 parity probe and Phase 5 contract smoke. Do not modify.

| Field | Value |
|-------|-------|
| `dataset_version` | `v4` |
| `question_ids` | `['Q1','Q2','Q3']` |
| `choices_order` | `[['A','B','C','D'],['A','B','C','D'],['A','B','C','D']]` |
| Canonical pre-image | `dataset_version=v4\|question_ids=Q1,Q2,Q3\|choices_order=A,B,C,D;A,B,C,D;A,B,C,D` |
| Expected SHA-256 hex | `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f` |

Reproduce on server:

```sql
SELECT encode(
  digest(
    'dataset_version=v4|question_ids=Q1,Q2,Q3|choices_order=A,B,C,D;A,B,C,D;A,B,C,D',
    'sha256'
  ),
  'hex'
);
-- expected: 9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f
```

Reproduce on client (browser console):

```js
await api.verifyPackHash({
  dataset_version: 'v4',
  question_ids: ['Q1','Q2','Q3'],
  choices_order: [['A','B','C','D'],['A','B','C','D'],['A','B','C','D']]
});
// expected: '9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f'
```

Both must return the same 64-character lowercase hex string. Any divergence is a parity failure and blocks Phase 5.

---

## 6. Feature Flag Lifecycle

### 6.1 MM_DUEL_CANON_GATE_ENABLED

- Set to `true` in the MVP bootstrap block of `stat_latest.html` in Phase 4.1 (this task).
- Stays `true` permanently after Phase 4 completes. There is no off ramp after Phase 4.2 retires the legacy inline ext block.
- When `true`, all duel bootstraps MUST flow through `mm_duel_ext_120_gate.js`; local generation is disallowed.
- Must be present before any `url.searchParams` parsing in the bootstrap so downstream modules observe the flag deterministically.

### 6.2 MM_DUEL_DATASET_VERSION

- Pinned to `'v4'` for the Phase 4 cutover.
- Any change requires a coordinated server migration and a bump of this constant in the same release.
- Must NEVER diverge from the `dataset_version` field returned by `get_duel_pack`. A mismatch surfaces as server code `dataset_version_mismatch`.

### 6.3 __MM_DUEL_LEGACY_EXT_RETIRED

- Set to `true` in Phase 4.1 alongside the gate enable. Guards the legacy inline ext block by short-circuiting it to an early return.
- Phase 4.2 physically removes the inline block. Once removed, the guard remains in code history only; current code must not reference it except in tests that assert the retirement.

---

## 7. Backfill Policy

Phase 2.3 (already executed) performed the pack and state reconciliation for historical rows:
- Every pre-existing duel row was rewritten with a sealed pack matching the canonical schema in section 1.
- State values were normalized to the enum in section 3.
- Rows that could not be repaired were moved to `void` with a backfill reason code.

Post-Phase-2.3 contract:
- NEW rows created through `create_duel` / `create_bot_duel` always include a sealed pack at insert time. There is no legacy unsealed path.
- Any row observed with `duel_pack_unsealed` after Phase 2.3 is a regression and must be triaged before Phase 5 proceeds.

---

## 8. Protected Systems

Phase 4 and Phase 5 MUST NOT touch any of the following:

| System | File / Module | Reason |
|--------|----------------|--------|
| Arena | `arena.html` | Separate deployment under MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001. |
| Drills | `drills.html` | Separate deployment under MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001. |
| RankListIQ | `ranklistiq.html` | Separate deployment under MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001. |
| MVP module methods | `window.MM_DUEL.*` method bodies inside `stat_latest.html` | Phase 4 adds the gate, but does not rewrite existing method implementations. |
| Solo mode scoring | Solo practice scoring functions in `stat_latest.html` | Out of duel scope. Solo does not consume `get_duel_pack`. |

Any change proposed against these systems during Phase 4 or Phase 5 is out of scope and must be rejected or logged as a recommendation for a separate authority.

---

END OF STAT CANON SPEC
