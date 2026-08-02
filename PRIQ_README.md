# PRIQ M0.75 development runtime

This branch connects the recovered frozen PRIQ presentation to the server-side MissionMed Intelligence Runtime. The development deployment is Founder/Admin only, keeps all student access off, and starts with hydration paused. It does not migrate a database, write to sibling products, publish student data, or persist private source bytes.

## Start

1. Run `npm ci`.
2. Launch from the approved MissionMed runtime so the server process inherits `OPENAI_API_KEY`. `.env.example` is documentation; a repository-local environment file is optional and is not the normal credential source.
3. Run `npm run priq:dev` and open `http://127.0.0.1:4310`. The script enables local dev auth and remains loopback-only.

The MissionMed development deployment uses `PRIQ_AUTH_MODE=supabase`. A verified Founder/Admin server-side bearer exchange can establish an eight-hour, in-memory, HttpOnly, Secure, SameSite session. Browser code does not read bearer tokens, URL fragments, session storage, or identity values. `/auth-entry` therefore fails closed until MissionMed supplies a same-origin cookie validator or a server-to-server signed POST handoff for the Railway development domain.

The provider reads `process.env.OPENAI_API_KEY` on the server. Never put its value in source, frontend configuration, handoffs, screenshots, or Git. Education records or PHI additionally need `MIR_OPENAI_RESTRICTED_DATA_APPROVED=true`, which may be set only after account and MissionMed approval.

## Current vertical-slice truth

- Ezechiel Fenelon, Brookdale Internal Medicine, and Dr. Conrad Fischer are the ticket-authorized identifiers.
- Four current primary-source records across three available source types resolve the Conrad Fischer identity.
- The required audiovisual source is absent, so research coverage is incomplete.
- No private Ezechiel packet was found. The intake manifest contract is ready, but no files were ingested.
- P1-PRIQ-M0-002A proved the inherited OpenAI route with non-sensitive synthetic text, structured output, telemetry, kill, and release. Real Ezechiel profile synthesis was not run.
- M0.75 exposes real structured-output routes for Ask PRIQ, public research, profile generation, live Copilot, debrief, Profile Lab, and the separately opted-in Founder Note surface. Video analysis is truthfully adapter-blocked until an authorized media adapter exists.
- Dr. Brian alone controls hydration through the Founder role. Admins may test hydrated features but cannot release or pause hydration. Hydration state is in-memory and returns to paused on restart.
- Student workspace, student publication, and student override switches are backend-locked off.
- RISE, StoryForge, Timeline, IV Prep, and CAM proposed endpoints do not match current canonical interfaces. Typed contracts fail closed; there were no sibling writes.
- Founder approval and explicit publication are mandatory before any student projection.

## Verification

Run `npm run priq:check`. This typechecks, runs mock-only tests, performs accessibility/frozen-visual checks, builds `apps/priq-web/dist`, and scans built assets for credential leakage. Automated real-provider proof requires the explicit spend gate: `MIR_REAL_AI_TESTS=1 npm run priq:provider-proof`. Run `npm run priq:preview` to serve the built artifact on `http://127.0.0.1:4312`.

The isolated Railway development service uses `Dockerfile.priq` and `railway.priq.json`; the root MissionMed service configuration remains untouched. The sole proposed migration sequence is `infra/priq/migrations/20260802095500_priq_foundation.sql`. It is design evidence only and has not been applied; database-owner approval is required before any application.
