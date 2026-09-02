# MX-APPT-5003G authority and runtime evidence

Captured: 2026-09-02 UTC

## Canonical authority

- MissionMed OS origin/main: 214f1a989ebb67e179614b4b41b54698340227ef
- Universal BOOT: PASS
- MX-APPT-5003G mission-profile BOOT: PASS
- Product passport: PRODUCT_PASSPORTS/scheduler.md
- Founder authority: decisions/DR-164_mx_appt_5003g_appointments_storyforge_v2_production_authority.md
- Bounded MR-079 authority: decisions/DR-165_mx_appt_5003g_bounded_mr_079_production_execution_amendment.md
- MR-079 canonical hash: 9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357
- MissionMed HQ origin/main: 4c86e85c186c01561ded81e1927842cd2ce0e5fc
- Candidate branch: codex/mx-appt-5003g-production

The authority permits the Scheduler/Appointments implementation and guarded deployment. It does not waive leases, provider readback, rollback, designated-student QA, or independent verification.

## Production runtime discovery

- Public Scheduler route: https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler_v1.html
- Current public Scheduler SHA-256: 98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195
- Current public adapter SHA-256: 2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578
- Current adapter version: 1781804754
- Railway project/environment/service: 29afe147-3635-4d2d-a8fc-57383f972c83 / ed335cd7-c469-4da0-8536-52f47e1f3026 / 3d18b94f-7a70-40e8-a310-b8a9bd2f1ddb
- Railway domain: missionmed-hq-production.up.railway.app
- Scheduler Supabase project: fglyvdykwgbuivikqoah
- Scheduler database schema was inspected read-only. No migration was made.
- Immutable rollback URL: https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.98f87f6998eb.html
- Immutable rollback readback: HTTP 200, SHA-256 98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195

The approved R2 environment in the primary checkout was sourced in process without copying or printing credentials. The guarded publisher fetched the current public LIVE alias, required its full hash to equal the adopted source lock, wrote only the missing content-addressed rollback object, and verified it over the public CDN. It did not change the LIVE alias.

The live browser bootstrap reported authenticated readiness and real booking, cancellation, reschedule, provider, admin, and meeting-link capability flags. The backend route table was verified from recovered production source rather than guessed endpoint names.

## Real catalogue and entitlement truth

- Live appointment catalogue count: 14
- Five entries lack confirmed entitlement rules and are fail-closed: Dr J Consult; Dr J Drill Help; Dr. Brian Mock Interview; Dr. Brian Strategy Call; Phil USCE Consult.
- mm_scheduler_settings and eligibility rule tables were empty at observation time.

The candidate never fabricates divisions, providers, availability, appointment records, meeting URLs, or entitlement rules.

## Shared-runtime custody

- MX-CAL-4200C released `SHARED:MISSIONMED-HUB` and `SHARED:MATRIX-SHELL` with provider-clear readback before this continuation.
- The live preimages were re-read before custody: `class-mmed-rest-api.php` SHA-256 `70e7bae598a804f547425085e90e2b4e52d659c2c41755d124184619b92c29da`; `class-mmed-feature-flags.php` SHA-256 `587c83235032490f03485932dc0e305bbad06627743b1bcc529cd037c16c40ab`.
- Those hashes exactly matched the preserved local preimages.
- `SHARED:MISSIONMED-HUB` was acquired for only those two PHP paths through the Keychain-backed Lease V2 loader. Nine exact PATH scopes cover the Scheduler source, source lock, deploy manifest, test, handoff, and evidence paths. Heartbeat interval: 8 seconds.
- `class-mmed-student-os.php`, `student-os.js`, `student-os.css`, `scheduler-mount.js`, and the Matrix runtime lock were not changed. The existing `window.MMED_OS.api` object already supplies the authenticated WordPress REST base, same-origin credentials, and REST nonce.
- Candidate PHP hashes: REST API `2e1c2edbd1f2cb5903708bd951205be510dcc7a33608fb23bc36ce2d997aa5b9`; feature flags `21fd47015a0b1e9a2721c419d3a33da7c81391c5ddebf9396f4612a9c5cb478a`.

The shared change adds no schema migration. It uses one WordPress user-meta key for the account preference, one existing feature-flag option entry for Force Classic, and one bounded 50-entry admin audit option. The live WordPress files remain on their preimages until every deployment gate passes.
