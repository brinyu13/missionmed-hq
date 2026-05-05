# CX-OFFER-324 Gmail Metadata Proof Handoff

Worktree:
- `/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-324-gmail-metadata-proof`

Branch:
- `cx-offer-324-gmail-metadata-proof`

Implemented:
- Added backend-only Gmail metadata proof route.
- Mounted it under the existing privileged HQ API auth gate.

Endpoint:
- `GET /api/integrations/gmail/metadata-proof?mailbox=<allowlisted mailbox>`

Allowlisted mailboxes:
- `clinicals@missionmedinstitute.com`
- `drj@missionmedinstitute.com`
- `drbrian@missionmedinstitute.com`

Security model:
- Protected by existing `requireAuthenticatedApiSession(...)` gate in `server.mjs`.
- That gate uses `isPrivilegedWordPressUser(...)`.
- No `MMHQ_ALLOWED_WP_ROLES` admin authorization was added.
- No frontend Gmail credentials.
- No service-role data in browser.
- No Gmail message bodies.
- No Gmail writes.
- No Supabase writes.
- No live email.

Railway env required before live proof:
- `MISSIONMED_GMAIL_AUTH_MODEL=domain_wide_delegation`
- `MISSIONMED_GMAIL_ALLOWED_MAILBOXES=clinicals@missionmedinstitute.com,drj@missionmedinstitute.com,drbrian@missionmedinstitute.com`
- `MISSIONMED_GMAIL_SYNC_ENABLED=false`
- `MISSIONMED_GMAIL_SYNC_DRY_RUN=true`
- `GOOGLE_GMAIL_SCOPES=https://www.googleapis.com/auth/gmail.readonly`
- `GOOGLE_GMAIL_SERVICE_ACCOUNT_EMAIL=missionmed-gmail-sync@missionmed-communications-sync.iam.gserviceaccount.com`
- `GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON=[Brian enters securely into Railway only]`

Local validation completed:
- `node --check missionmed-hq/server.mjs`
- `node --check missionmed-hq/routes/gmail-metadata-proof.mjs`
- missing secret returns setup-required
- out-of-allowlist mailbox rejected
- broader Gmail scope rejected
- malformed service account JSON rejected

Live Gmail proof:
- Not run yet because the Railway-only service account JSON secret is pending.

Next:
- Deploy the route.
- Brian enters the service account JSON directly into Railway.
- Run metadata-only proof with `users.getProfile` and `users.labels.list`.
