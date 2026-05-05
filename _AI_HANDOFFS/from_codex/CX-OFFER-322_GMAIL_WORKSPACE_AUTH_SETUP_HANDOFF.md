# CX-OFFER-322 Gmail Workspace Auth Setup Handoff

Date: 2026-05-05
Worktree: `/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-auth-setup`
Branch: `codex/cx-offer-322-gmail-auth-setup`

## Summary

Codex inspected the latest CX-OFFER-321/322 comms reports and the live Google Workspace Admin Console. The safest architecture remains Postmark-first for app email, Gmail as human mailbox visibility, and future Gmail API sync only after Google auth is configured with strict mailbox allowlisting.

## Verified Workspace Mailboxes

Active users observed:

- `clinicals@missionmedinstitute.com`
- `drj@missionmedinstitute.com`
- `drbrian@missionmedinstitute.com`
- `info@missionmedinstitute.com`

## Admin API Controls

Observed:

- API Controls page accessible.
- Domain-wide Delegation page accessible.
- No existing DWD API client rows visible.

## Blocker

Google Cloud Console required password re-auth for `info@missionmedinstitute.com`. Codex did not enter a password and did not proceed.

## Auth Model Recommendation

Use phased approach:

1. Current: Postmark + Gmail visibility, no Gmail API sync.
2. Future: domain-wide delegation with only `gmail.readonly` initially, plus app-side mailbox allowlist.

Allowlisted future mailboxes:

- `clinicals@missionmedinstitute.com`
- `drj@missionmedinstitute.com`
- `drbrian@missionmedinstitute.com`

## Security Notes

- No live emails were sent.
- No Gmail messages were read.
- No secrets were viewed, copied, stored, or reported.
- No source/runtime auth changes were made.
- No Railway/Supabase/Postmark/WooCommerce/LearnDash/WordPress/Arena/STAT/Daily/Drills changes were made.

## Next Step

Brian should complete Google Cloud re-auth manually, then run `CX-OFFER-323-GMAIL-CLOUD-REAUTH-CONTINUE`.

