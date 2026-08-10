# B1-513 Platform Summit Observations

Date: 2026-08-07 (America/New_York)
Audience: MissionMed Platform v1 Summit. Authority: `B1-513_DECISIONS_SPINE.md` D9. This document records observations only — nothing here is a build commitment, and nothing in Stage 2 waits on it.

StoryForge Stage 2 implements six patterns that are platform-shaped. In each case StoryForge deliberately built the smallest local version that is correct, auditable, and disposable — so a future platform service can absorb it with a small, mechanical migration rather than a rewrite.

| Pattern | StoryForge builds (bounded) | Platform v1 would generalize | StoryForge migrates later (explicitly small) |
|---|---|---|---|
| **Consent/receipt registry** | `sf_mentorship_consent`: versioned policy text, affirmative accept/defer decisions, append-only rows, audit receipt ids surfaced to the student and re-readable in Settings | A cross-app consent service: policy documents as versioned artifacts, decision records keyed by (user, policy, version), receipts as first-class objects any app can display | Point the consent read/write RPCs at the platform service; keep local rows as historical record. One table, two RPCs, one Settings panel |
| **Notification service** | Review Check writes into the existing StoryForge-owned sf notifications domain: truth-branched content, timestamps, read/dismiss, per-student history, 24h dedupe, sender delivery status | A universal notification bus with per-app channels, delivery/read receipts, rate policies, and user-level preferences across MissionMed apps | Swap the insert call for a bus publish; notification schema already carries kind/read/timestamps, so mapping is field-for-field |
| **Activity heartbeat + truthful-boundary analytics** | `sf_activity_sessions`/`sf_activity_counters`: foreground+interaction heartbeat, aggregated sessions, content-free counters, and the `available_from` rule — every metric names the date tracking began; nothing is fabricated | A shared engagement service with the same two primitives (session aggregate, named counter) and the truthful-boundary rule as a platform-wide invariant, feeding any app's admin views | Redirect the heartbeat endpoint and counter increments; aggregates export cleanly because no content was ever captured |
| **Entitlement-backed directory** | `/api/admin/console/directory`: bounded read over the canonical LearnDash entitlement listing all trusted, verified, active eligible students — including zero-activity — with per-app counts and warnings, private content never listed | A platform people-directory service owning "who is entitled to what," with per-app enrichment (counts, activity, warnings) contributed through narrow adapters | Replace the entitlement query with a directory-service call; keep the StoryForge enrichment adapter. The drawer UI is untouched |
| **Versioned config registry** | The B1-512 Content & Display machinery extended to the version registry and the Inspiration prompt bank: stable IDs, validate → preview → publish, optimistic versions, append-only history, restore defaults, force-off | A config registry service: named configuration domains per app, the same publish/version/audit lifecycle as a platform primitive, with server-side payload validation hooks | Register the existing domains; the payloads are already self-contained JSON with stable IDs and versions |
| **Signed-media access** | One short-lived signed URL path for all audio playback, extended by RLS claim functions (owner / reviewer / assigned mentor over observable stories only); no public URLs | A media gateway: claim-based authorization delegated to the owning app, signing/expiry/CDN handled centrally | Keep the claim functions (they are the authorization truth); delegate signing to the gateway. URLs change, policy does not |

## What Stage 2 deliberately does NOT solve

Stage 2 stays inside StoryForge's walls. It does not attempt, prototype, or pre-empt:

- Global identity or authentication — the WordPress session + LearnDash entitlement → signed JWT chain is consumed, not redesigned.
- LearnDash architecture, WordPress topology, or the Matrix shell.
- An app registry, global routing, or cross-app navigation beyond the existing "Back to Matrix" link.
- Universal notifications, a global event bus, a shared media service, or an AI gateway — each local pattern above is bounded precisely so those can be designed once, properly, at platform scope.
- Cross-app hydration or shared persistence — every Stage 2 table is StoryForge-owned, RLS-forced, and reachable only through StoryForge's API.
- Deployment topology — one renderer, immutable Kinsta pointers, Railway rollback, unchanged.

## The one-sentence summit ask

When Platform v1 defines consent, notifications, engagement, directory, configuration, and media as services, use these six bounded StoryForge implementations as the shape of the first client — each was built so the migration is a re-pointing exercise, not a rescue.
