# CX-OFFER-322 Gmail Workspace Auth Setup Handoff

Date: 2026-05-05
Worktree: `/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-auth-setup`
Branch: `codex/cx-offer-322-gmail-auth-setup`

## Summary

Codex inspected the current Postmark/Gmail coordination state, verified MissionMed Google Workspace Admin access, created the dedicated Google Cloud project, enabled Gmail API, and created the service account needed for future Gmail API sync. The final Workspace Domain-wide Delegation authorization is pending Brian's passkey / Touch ID approval.

## Completed Google Setup

- Google Cloud project:
  - Name: `MissionMed Communications Sync`
  - Project ID: `missionmed-communications-sync`
  - Project number: `43059686118`
- Gmail API:
  - Enabled
- Service account:
  - Name: `MissionMed Gmail Sync`
  - Email: `missionmed-gmail-sync@missionmed-communications-sync.iam.gserviceaccount.com`
  - OAuth 2 Client ID / Unique ID: `106640946052586220628`
  - Keys: none created

## Verified Workspace Mailboxes

- `clinicals@missionmedinstitute.com`
- `drj@missionmedinstitute.com`
- `drbrian@missionmedinstitute.com`
- `info@missionmedinstitute.com`

## Pending Workspace Admin Action

After Brian completes passkey / Touch ID for `brianbolantenj@gmail.com`, add a Google Workspace Domain-wide Delegation API client:

- Client ID: `106640946052586220628`
- OAuth scope: `https://www.googleapis.com/auth/gmail.readonly`

Do not authorize broader scopes yet.

## Auth Model Recommendation

Use phased approach:

1. Current: Postmark + Gmail visibility, no Gmail API sync.
2. Next: DWD with `gmail.readonly`, app-side mailbox allowlist, dry-run metadata-only proof.
3. Later: message body ingestion and Gmail-only thread sync only after a privacy/compliance gate.

Allowlisted future mailboxes:

- `clinicals@missionmedinstitute.com`
- `drj@missionmedinstitute.com`
- `drbrian@missionmedinstitute.com`

## Security Notes

- No live emails were sent.
- No Gmail messages were read.
- No secrets were viewed, copied, stored, or reported.
- No service account private key was created or downloaded.
- No source/runtime auth changes were made.
- No Railway/Supabase/Postmark/WooCommerce/LearnDash/WordPress/Arena/STAT/Daily/Drills changes were made.

## Next Step

Run `CX-OFFER-323-GMAIL-DWD-FINISH-AND-DRY-RUN-PROOF` after Brian is ready to complete the passkey prompt.
