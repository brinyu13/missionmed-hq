# B1-513R2 — Data / Migration / RLS / Privacy Contract (pass-2 delta)

Authority: B1-513R doc 13 plus the inherited B1-513 satellites remain binding. This document adds the pass-2 schema delta and the red-team-derived RLS requirements. All migrations additive; every migration rides the Survival Manifest STOP-SAFE cycle.

## 1. Schema delta (additive only)

**Users:** `theme_preference` ('dark'|'light'|'auto', default 'dark') · `inspiration_layout` ('list'|'grid', default 'list').

**Inspiration questions** (existing governed table from R3 scope): + `recommended boolean default false` · + `imported boolean default false` (provenance of bulk import) · state machine unchanged (`active`/`retired`); stable IDs server-generated ALWAYS.

**Inspiration pins (new):** `(user_id, question_id, position, created_at)` PK `(user_id, question_id)`. Favorites table as R1. `answeredStoryId` is a read-time join on story origin provenance — deliberately NOT a column (no denormalized story references to keep consistent).

**Invitations** (RA scope): + `delivered_at` · `link_visited_at` · `started_at` · `bounced_at` · `bounce_reason` · `revoked_at`; status enum extended to `draft|sent|delivered|link_visited|started|story_shared|expired|revoked|bounced` (plus `opened` only if the open-pixel signal is surfaced, always labeled approximate). Transitions: monotone toward `story_shared`; `bounced`/`revoked` terminal for send/resend (409 `invitation_terminal`); `started` never demotes `story_shared`. `delivered`/`bounced` are written **only** by the signed Postmark webhook handler, never optimistically.

**V2.1 prewiring** (rides V2-R2): authored-segment `segment_id` + `source_role` enum (`student_spoken|student_typed|ai_question|mentor_content|guest_contributor`) per `B1-513R2_V21_PREWIRING_CONTRACT.md`. `story_followup` flag registered, off, unwired.

**Sessions/groups (§19):** verify the canonical MissionMed 360 session source at Codex time and *consume* it (view or read-time join). Only if it does not exist: a minimal `storyforge_groups(id, label)` + membership table, explicitly non-authoritative for access. LearnDash entitlement remains the sole access truth. Saved views: per-admin rows storing filter/sort state only — never student lists.

## 2. RLS requirements added by pass 2 (each has a passing prototype probe)

1. **Active-only exposure through every student path.** Students may select questions only where `state='active'` — including via the pin join. A retired/unpublished draft must be invisible even if already pinned. (Red-team A; probes RT-A ×2.)
2. **Pins are self-scoped.** Insert/delete/reorder `WHERE user_id = auth.uid()`; pin insert requires an active question. (Probes 24/25.)
3. **Bulk import is admin-only, server-validated, server-identified.** Client-supplied IDs are discarded; rows re-validated regardless of client `ok` flags; inserts land `retired`. (Red-team B; probes RT-B ×2, 26–28.)
4. **Invitation ops are owner-scoped** (404 otherwise, unchanged), `update` draft-only (409 `invitation_locked`), send/resend refuse terminal states (409 `invitation_terminal`). (Probes 19, 29, RT-C.)
5. **Guest endpoints are token-scoped and bounded**: constant-time token lookup, hash-stored CSPRNG tokens (pass-1), server-enforced expiry 410, contribution cap 3 → 429, transcript ≤ 20k chars, duration ≤ 30 min, relationship fixed at create from the governed library (400 `relationship_invalid`). Guest payload carries first name + avatar asset only — no user id, email, stories, or cohort. (Probes 16–23, 31, RT-E, RT-F.)
6. **Identity from the signed session only.** The prototype's ambient-persona fallback is a file:// affordance; production must never resolve identity from anything but the verified session (no last-identity fallback, no header-less inference). (Red-team G — contract, not code.)
7. **Answered-state joins are self-scoped**: `answeredStoryId` resolves only within the requesting student's own stories. (Probe 39.)
8. **Directory/queue remain admin-gated with clamped pagination** (`pageSize ≤ 50`) and never serialize private story content — counts only. (Probes 3–6, 36–37.)

## 3. Privacy posture summary (unchanged laws, new surfaces audited)

Visibility stays orthogonal to submission; historical V1 stories never silently widen (probe 12). Contribution promotion starts Private regardless of consent (probe 22) with first-name-only provenance (probe 21). Mentor/admin surfaces list private work as counts only (probe 4). All untrusted text — CSV imports, guest transcripts, personal messages — is escaped at render (red-team verified: no stored XSS path). Audit remains append-only; truthful receipts only.
