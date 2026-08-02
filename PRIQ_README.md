# PRIQ local production foundation

This branch adds an isolated, local-only PRIQ/MIR foundation. It does not deploy, migrate a database, write to sibling products, or persist private source bytes.

## Start

1. Run `npm ci`.
2. Copy `.env.example` into an ignored environment source.
3. For the local shell only, set `PRIQ_DEV_AUTH=true`. Do not bind beyond loopback.
4. Run `npm run priq:dev` and open `http://127.0.0.1:4310`.

The existing `OPENAI_API_KEY` is intentionally ignored. A real provider call needs a separately authorized `MIR_OPENAI_API_KEY`. Education records or PHI additionally need `MIR_OPENAI_RESTRICTED_DATA_APPROVED=true`, which may be set only after account and MissionMed approval.

## Current vertical-slice truth

- Ezechiel Fenelon, Brookdale Internal Medicine, and Dr. Conrad Fischer are the ticket-authorized identifiers.
- Four current primary-source records across three available source types resolve the Conrad Fischer identity.
- The required audiovisual source is absent, so research coverage is incomplete.
- No private Ezechiel packet was found. The intake manifest contract is ready, but no files were ingested.
- No `MIR_OPENAI_API_KEY` was available. Real AI profile synthesis was not run.
- RISE, StoryForge, Timeline, IV Prep, and CAM proposed endpoints do not match current canonical interfaces. Typed contracts fail closed; there were no sibling writes.
- Founder approval and explicit publication are mandatory before any student projection.

## Verification

Run `npm run priq:check`. This typechecks, tests, performs static accessibility and frozen-visual contract checks, and builds `apps/priq-web/dist`. Run `npm run priq:preview` to serve that built artifact on `http://127.0.0.1:4312`.

The sole proposed migration sequence is `infra/priq/migrations/20260802095500_priq_foundation.sql`. It is design evidence only and has not been applied; database-owner approval is required before any application.
