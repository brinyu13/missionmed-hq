# MX-APPT-5003G authority and runtime evidence

Captured: 2026-09-02 UTC

## Canonical authority

- MissionMed OS origin/main: 214f1a989ebb67e179614b4b41b54698340227ef
- Universal BOOT: PASS
- MX-APPT-5003G mission-profile BOOT: PASS
- Product passport: PRODUCT_PASSPORTS/scheduler.md
- Founder authority: decisions/DR-164_mx_appt_5003g_appointments_storyforge_v2_production_authority.md
- Bounded MR-079 authority: decisions/DR-165_mx_appt_5003g_bounded_mr_079_production_execution_amendment.md
- MR-079 canonical hash: 9638e678f8f33a2877428bf1f254737118ec48592557034f1c902c614ea0357
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

The live browser bootstrap reported authenticated readiness and real booking, cancellation, reschedule, provider, admin, and meeting-link capability flags. The backend route table was verified from recovered production source rather than guessed endpoint names.

## Real catalogue and entitlement truth

- Live appointment catalogue count: 14
- Five entries lack confirmed entitlement rules and are fail-closed: Dr J Consult; Dr J Drill Help; Dr. Brian Mock Interview; Dr. Brian Strategy Call; Phil USCE Consult.
- mm_scheduler_settings and eligibility rule tables were empty at observation time.

The candidate never fabricates divisions, providers, availability, appointment records, meeting URLs, or entitlement rules.

## Shared-runtime custody

The authenticated Matrix route exposes the WordPress REST nonce needed for a legitimate account-preference route, but no Appointments preference route currently exists. DR-164 permits a bounded shared seam when proven and leased. SHARED:MISSIONMED-HUB is actively held and renewed by MX-CAL-4200C; V2 shared-domain conflict rules correctly prevent concurrent mutation. No shared PHP change was made.
