# B1-514 Production Preflight and Blockers

Verdict: **NO-GO FOR CUTOVER — EXTERNAL GATES ONLY**

## Completed without production mutation

1. Authority, repository, branch, clean-state, Railway target, and live release identities verified.
2. Sealed candidate built deterministically.
3. Full local unit, PostgreSQL/RLS, browser, conformance, accessibility, API-only, security, dependency, Critical Systems, and provenance evidence completed as recorded in `B1-514_TEST_RESULTS.md`.
4. Fresh read-only production database inventory completed.
5. Fresh PG18 logical recovery copy created and restored in isolation.
6. The complete additive migration and seed sequence passed in the isolated restored database.
7. Privacy-safe production PRE survival manifest passed all 48 stories and all nine permanent objects.
8. Exact production migration runner preflight passed with nine migrations pending.
9. Current live assets, current Railway deployment, and prior rollback deployment were reverified.

## Exact external gates

### Gate E1 — fresh provider-native recovery points

Required immediately before any production write:

- create and lock a new Railway PostgreSQL provider-native backup;
- create a fresh MyKinsta Live-site manual backup and verify Restore control;
- create the approved private Kinsta StoryForge route/pointer snapshot;
- record the provider IDs/timestamps/retention and bind them to the PG18 dump and current production system identifier.

These were intentionally not created after the no-go became certain, avoiding expiring or misleading pre-cutover receipts. The fresh PG18 logical dump and isolated restore are already complete.

### Gate E2 — WordPress integration runtime

The Docker-backed WordPress integration runner cannot connect to the unavailable local Docker/OrbStack socket. Earlier steering forbids destructive Docker/runtime repair. The exact remaining action is to run `npm run test:integration` in an authorized healthy container runner and require all cases pass, especially the guest-token, webhook, PUT/DELETE, JWT, content-type, and near-miss gateway matrix.

### Gate E3 — Postmark production contract and canary

The current Railway service has none of the new Postmark configuration names. Required inputs/actions:

- verified Postmark server token;
- verified From and Reply-To identities;
- canonical `STORYFORGE_PUBLIC_URL`;
- signed webhook ingress secret and proof that Postmark metadata survives Delivery, Bounce, SpamComplaint, and Open events;
- dry-run preview proof, then one non-private controlled Founder invitation canary;
- delivery-attempt/outbox, revocation, expiry, complaint suppression, no-resend ambiguity, and audit receipts.

Until then `request_a_story`, `guest_contributions`, and every Postmark live-send control remain off.

### Gate E4 — staged authenticated production canaries

After E1-E3 and deployment: Founder student, Founder administrator, controlled eligible student, second eligible student, ineligible user, anonymous user, assigned mentor, private-story/direct-ID denial, mentor audio, guest link, and Matrix navigation canaries. No canary may widen the population until the prior rung passes.

## Exact next production-preflight task

Run the Docker-backed gateway suite in a healthy authorized runner and establish the verified Postmark sender/webhook contract. When both pass, create the fresh Railway/MyKinsta/Kinsta recovery points, freeze StoryForge writes, recapture PRE if any production count/hash changed, run the already-passing guarded migration preflight, and only then request the sole-writer cutover decision.

## Safety state

- No migration applied.
- No Railway deployment created.
- No Kinsta release uploaded or pointer changed.
- No WordPress option/plugin changed.
- No R2 object written, copied, or deleted.
- No Postmark call made.
- No feature flag changed.
- No production or remote system mutated except the authorized Git branch push.

