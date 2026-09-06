# MissionAccounts production activation packet

## Fixed architecture

- Application: one new isolated Railway project and service named `missionaccounts-production`; never reuse the currently linked shared MissionMed project.
- Database: one new isolated Supabase project named `missionaccounts-production` in `us-east-2`. This is the intended region because the current MissionMed Supabase estate is predominantly in `us-east-2` and the user population is East-coast centered.
- Runtime: the Railway service runs the committed `missionaccounts/Dockerfile` as non-root `node` and exposes only the MissionAccounts service.
- Database access: server-side PostgREST uses the project URL and service-role key; migration/import use a direct TLS PostgreSQL URL. Browser code receives neither.
- Auth: the Matrix/WordPress bridge issues a product-scoped signed JWT. PostgreSQL RLS is forced; browser requests never receive the service-role key.

## Gate and values

`BLOCKS APP DEPLOYMENT: YES` until governance registration plus the two isolated targets exist.

Provider administrator creates:

1. Railway project/service/environment `missionaccounts-production`, with a private service-to-worker origin and a public domain reserved but not routed from Matrix yet.
2. Supabase project `missionaccounts-production`, region `us-east-2`, with backups/PITR configured to the selected Supabase plan before import.
3. A private secret path for the Railway service. No secret is pasted into a ticket, commit, or handoff.

Non-secret values Codex can bind after provider readback:

- `MISSIONACCOUNTS_SUPABASE_PROJECT_REF`
- public Railway project/service/environment IDs and domain
- `MISSIONACCOUNTS_SUPABASE_URL`
- `MISSIONACCOUNTS_INTERNAL_BASE_URL`
- all feature flags, initially `0`
- `MISSIONACCOUNTS_TIME_ZONE=America/New_York`
- `MISSIONACCOUNTS_INVOICE_DUE_DAYS` after Founder approval

Secret values supplied only through the approved Railway environment-variable UI:

- `MISSIONACCOUNTS_SUPABASE_SERVICE_KEY`
- `MISSIONACCOUNTS_DATABASE_URL` for the one-shot migration/import operator, not the app runtime
- `MISSIONACCOUNTS_JWT_SECRET` or the approved JWKS binding
- `MISSIONACCOUNTS_WORKER_TOKEN`
- provider credentials listed in `PROVIDER_ACTIVATION_PACKET.md`

## Migration and import

1. Set the exact new Supabase project ref and direct TLS database URL in a private operator shell.
2. Run `MISSIONACCOUNTS_MIGRATION_APPROVAL=MX-MISSIONACCOUNTS-5301P-SCHEMA npm run migrate:production`.
3. Verify the returned migration digest, 11 disabled flags, three cycles, and zero students/invoices/charges.
4. Run `MISSIONACCOUNTS_IMPORT_APPROVAL=MX-MISSIONACCOUNTS-5301P-REAL-DATA npm run import:historical:production` with `MISSIONACCOUNTS_IMPORT_MANIFEST_OUTPUT` pointing to an approved private evidence path.
5. The import verifies source hashes, imports all real READY and held rows, replays as a no-op, then runs `scripts/verify-historical-import.sql`.

Expected import controls: 271 students; 419 meeting instances; 100 confirmed Drills sessions; 5,498 raw source rows; 3,941 attendance events; 3,264 attendance days; 498 human-cycle rows split into 320 READY, 107 IDENTITY_HOLD, 69 CAP_HOLD, 2 SOURCE_LINK_HOLD, and 0 OTHER_REVIEW; zero billing decisions, invoices, charges, Matrix links, or enabled flags.

## Backup and rollback

- Before schema/import: record the new project ref, backup/PITR state, migration digest, and an empty-database control query.
- Migration is one PostgreSQL transaction; any error rolls back the entire schema release.
- Import is one PostgreSQL transaction; any source/control failure rolls back the entire import.
- After commit: take a provider-native Supabase backup/PITR marker and retain the private import manifest.
- Rollback before any user/provider activity: restore the pre-import backup or replace the isolated project. Do not issue broad deletes against a mixed/shared database.
- Rollback after user/provider activity: restore to a new isolated project and perform an audited cutover; never discard post-launch corrections, identity decisions, invoices, or signed provider events.
