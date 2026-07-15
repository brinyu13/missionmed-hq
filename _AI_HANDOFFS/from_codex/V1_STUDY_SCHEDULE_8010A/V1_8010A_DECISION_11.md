# V1-8010A Decision 11 — Settings and Governed Content

**Status:** ACCEPTED

## Decision

V1 owns versioned Study-specific settings through its repository. Server state
is canonical; browser storage is a recoverable cache only. Defaults and every
migration are versioned.

- Sound defaults off.
- Motion obeys operating-system reduced-motion and cannot override it.
- Settings failure falls back to safe defaults without enabling sound, motion,
  sharing, or writes.
- Privacy consent, mentor visibility, notifications, and retention are separate
  versioned policy/consent records, not generic preferences.
- Quotes remain disabled until governed content rights and attribution pass
  Decision 02.

If quotes are later enabled, one learner-local daily assignment is reused across
surfaces. No quote repeats before a 45-day local-date difference; day 44 is
ineligible and day 45 eligible. Exhaustion omits the module with
`cooldown_exhausted`; the cooldown is never relaxed and favorites do not bypass
it. This ruling supersedes conflicting D9-350 reset/oldest-first behavior.

## Verification

Tests cover default migration, corrupt cache, concurrent tabs, reduced-motion,
sound consent, day 44/45, exhaustion, context suppression, and single daily
assignment. No raw quote content is required for the core release.
