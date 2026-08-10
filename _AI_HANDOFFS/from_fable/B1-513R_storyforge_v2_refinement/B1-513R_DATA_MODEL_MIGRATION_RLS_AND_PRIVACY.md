# B1-513R Data Model, Migration, RLS, and Privacy

Delta over the inherited B1-513 plan (docs 10/11 in `_AI_HANDOFFS/from_cowork/B1-513_…`), which remains authoritative for R1–R3 schema (visibility/consent/review-checks/activity; story versions; inspiration). All additions below are additive, NULL-safe, RLS + FORCE RLS, guarded-runner-applied, and gated by the Survival Contract (doc 03).

## 1. New objects (V2 delta)

### Request a Story (release RA — see doc 14)
```sql
CREATE TABLE sf_story_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  contributor_name text NOT NULL,          -- display first name only
  relationship text NOT NULL,              -- stable ID from contributor library
  email text NOT NULL,                     -- delivery only; masked in every read model
  token_hash bytea NOT NULL UNIQUE,        -- SHA-256 of ≥128-bit CSPRNG token; raw token never stored
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','opened','contributed','revoked','expired')),
  personal_message text NOT NULL DEFAULT '',
  video_greeting_media_id uuid NULL,       -- deferred Story Media design; force-off
  disclosure_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  reminders_sent integer NOT NULL DEFAULT 0,
  created_at/sent_at/opened_at/contributed_at/revoked_at timestamptz,
  row_version integer NOT NULL DEFAULT 1
);
CREATE TABLE sf_story_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES sf_story_invitations(id),
  kind text NOT NULL CHECK (kind IN ('text','voice')),
  transcript text NOT NULL,
  recording_id uuid NULL, audio_asset_id uuid NULL,   -- existing pipeline refs
  state text NOT NULL DEFAULT 'new' CHECK (state IN ('new','favorite','archived','promoted')),
  promoted_story_id uuid NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
```
RLS: owner-student policies through invitation join; **no authenticated-role guest access at all** — the guest surface runs through a dedicated bounded route class that resolves token_hash and can only (a) read the greeting payload, (b) insert a contribution within caps. Admin: counts/status via bounded function only; never contribution content (mentor sees a contribution only after the student promotes it into an observable story). `stories.origin` (existing jsonb) gains the `contribution` type: {type, invitation_id, relationship, contributor first name} — no email, ever (probes 21).

### Inspiration favorites (release RB)
```sql
CREATE TABLE sf_inspiration_favorites (
  user_id uuid NOT NULL, prompt_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, prompt_id)
);
```
Owner-only RLS; contributor prompt library seeded as a second content domain beside inspiration prompts (same governance columns).

### No schema: admin mirror, Content Studio/System split, avatars, Library/Story-Detail refinements, save triad, time guidance.

## 2. Guest privacy boundary (summary; full contract doc 09)

Token hashed + constant-time; expiry/revocation/cap enforced server-side (410/410/429 — probes 16–17, 23); guest payload PII-minimal (probe 18); rate limits per IP + token; contributions size-bounded; contributor PII minimized to first name + masked email held student-side only; promotions start Private (probe 22); guest surface can reach no authenticated API (401 class).

## 3. Migration & rollback

One additive migration per release (RA/RB), guarded runner, fresh backups + isolated PG18 restore rehearsal + **pre/post Survival Manifest** (doc 03) around every apply. Rollback: flags off → surfaces vanish, rows dormant; pre-activation empty-object rollback scripts (guarded: refuse when rows exist); never destructive on student or contributor data — dismissed contributions archive, revoked invitations retain their audit trail.

## 4. Privacy review summary

New personal data introduced by V2: contributor first name + email (student-entered, delivery-scoped, masked in UI, excluded from provenance) and contributor story content (private to the inviting student until promotion; promotion starts Private). Consent surfaces: student consent (inherited, FD-1) + contributor disclosure (versioned, FD-R2). No new analytics capture; no avatar persistence; red team: 0 P0, all 4 P1 gaps closed in this package (verify/REDTEAM.md + changelog).
