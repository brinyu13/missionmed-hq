# B1-503 StoryForge Product Recovery — Combined Handoff

Status: LOCAL CANDIDATE VERIFIED; PRODUCTION CUTOVER PENDING

Production URL: `https://missionmedinstitute.com/storyforge/`

Canonical Founder authority:
`_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`

Required and observed SHA-256:
`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`

This document is the canonical B1-503 handoff. It combines the investigation,
repair, validation, release, rollback, deployment, and closeout record. The
detailed forensic narrative is retained in
`_AI_HANDOFFS/from_codex/B1-503_PRODUCT_RECOVERY_REPORT.md`.

## Executive result

The production infrastructure was healthy, but the deployed product was a
faithful deployment of the wrong source authority: a partial manual port made
under B1-500 and operationally accepted by B1-501. The Founder-approved HTML
never entered the build graph. B1-503 makes the pinned canonical artifact a
mandatory build/test input, restores the missing product surfaces and
workflows without seeded production data, and preserves the working
WordPress/Matrix/JWT/Railway/Kinsta seams.

Current local gates:

- canonical SHA-256 and 23-surface evidence contract: PASS;
- unit suite: 41/41;
- PostgreSQL authorization suite: PASS;
- B1-503 PostgreSQL conformance suite: PASS;
- browser E2E suite: 16/16;
- canonical comparisons: 72/72 across desktop, tablet, and mobile;
- narrow navigation, keyboard modal behavior, horizontal overflow, and serious
  accessibility checks: PASS;
- API-only Railway build, secret scan, npm audit, and `git diff --check`: PASS.

No B1-503 product bytes have been deployed at this checkpoint.

## Root cause and exact trace

| Layer | Identity |
|---|---|
| Founder canonical | SHA-256 `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` |
| B1-500 manual foundation | `be43c6d0a4520ed761a3d112a25452f26683f9ca` |
| B1-501 authority drift | `5ba56c7e3dd4f251ef4fc66c9de5fc4300c8acbc` |
| B1-502 source baseline | `f23d7daeb289c7340ec4ab1903956cc4cfec282a` |
| Existing deployed commit/pointer | `4bd956b6ea222d20428c41415236a73b93576447` |
| Existing live app hash | `3a60a405a47d78d943d507720a9c3f0b91198876a9194d8046e5fe292cdcc82b` |
| Existing live CSS hash | `c4724118cf635c83c2451e6cef4f84edab69cf03ed446c3c5a13227e909dee1d` |
| Existing live release ID | `v-963b8f5eb4d8c727` |

There was no live byte drift. The deployed bytes matched the B1-502 generated
release exactly; the source product itself was incomplete.

## Recovered product

All Founder-requested surfaces now have a locally verified PASS:

- Home;
- Library;
- Story Detail and Working Version;
- Notifications;
- Quick Capture;
- Interview Prep and Question Coverage;
- Question Workshop and Question Library;
- Review and Quick Look;
- Reflection;
- Story Classification;
- canonical Program Fit facets;
- Mentor Notes;
- Mentor Home, Students, per-student workspace, Review Queue, My Activity,
  Teaching Mode, and active 1:1 Session;
- Settings.

Key domain guarantees:

- private-by-default stories and direct-ID privacy;
- immutable original telling plus append-only revisions/audit;
- account-scoped durable drafts consumed atomically on creation;
- student/mentor field ownership and version-zero optimistic concurrency;
- opening a story records first-open without changing review status;
- revision or answered mentor ask returns requested changes to Awaiting review;
- independent student/mentor scores and stars;
- multi-select Birds and Ideal-for-position classification;
- exact preferred, mentor-confirmed, mentor-strength-at-least-3 readiness;
- pair-scoped follow-ups with source, clinical flag, preparation, notes, order,
  and reversible archive behavior;
- governed question drafts, explicit approval, bounded import, server-rechecked
  preview fingerprint, audited rollback, and no rollback after approval/use;
- assigned-mentor boundaries, revocation closure, and no admin story override;
- transaction-bound notifications and durable 1:1 agendas.

## Infrastructure preserved

Unchanged/protected:

- WordPress authentication and token exchange;
- JWT validation and founder-only student pilot policy;
- Matrix navigation and `/storyforge/` routing;
- isolated StoryForge MU route/runtime ownership;
- protected `missionmed-hub` and legacy Matrix assets;
- Cloudflare and DNS;
- Kinsta cache-bypass behavior;
- Railway API-only origin;
- immutable prior releases and rollback pointer.

The B1-503 governance authority is committed and pushed separately as:
`c043ad162fbd6d5d7c3a2d71641f0e55fab07e3e`.

## Production prestate

- feature enabled;
- allowlist count 1;
- role override count 1;
- allowed role exactly `student`;
- cohort allowlist count 0;
- mentor access disabled;
- token TTL 60 seconds;
- StoryForge database: 1 user, 0 stories, 0 questions, 0 audit events;
- existing Railway API deployment
  `fb43a551-04c8-41f7-a6e6-fb16aae3894e`;
- existing Railway PostgreSQL deployment
  `f5c7179e-b805-4e82-b080-d2349a0a47cf`;
- live pointer:
  `missionmed-storyforge-runtime/current -> releases/4bd956b6ea222d20428c41415236a73b93576447`.

## Cutover gates

Before production mutation:

1. commit and push exact source;
2. generate, verify, commit, and push the deterministic release;
3. create a fresh MyKinsta manual backup;
4. create a private Kinsta SSH backup of WordPress DB/config/options, route,
   runtime pointer/tree, SSO integration, and protected hub assets;
5. create and restore-rehearse a PostgreSQL 18 custom dump;
6. create and lock a Railway volume backup;
7. write and verify the scoped rollback packet;
8. switch StoryForge feature off and wait one token TTL;
9. apply exactly two forward-only migrations;
10. deploy the API-only package and verify origin `/` remains denied;
11. install an immutable commit-named Kinsta release and atomically move only
    the StoryForge pointer/route;
12. verify all feature-off routes, aliases, hashes, caches, protected assets,
    API, and database;
13. re-enable only the exact one-Founder student pilot;
14. validate authenticated production without creating fabricated student data.

After the two B1-503 migrations, the old B1-502 product may be contained by
feature-off, but must not be re-enabled against the new schema. Full old-product
restoration requires the fresh database backup plus the prior runtime pointer.

## Evidence

Evidence root:
`_AI_HANDOFFS/from_codex/B1-503_evidence/`

It contains:

- production-before screenshots and runtime identities;
- canonical reference screenshots;
- local candidate screenshots and canonical comparison receipts;
- final production-after screenshots and hashes after cutover.

## Final deployment receipt

Pending guarded production cutover:

- source commit:
- release commit:
- closeout evidence commit:
- Railway deployment ID:
- Kinsta release directory:
- generated release ID:
- runtime index/app/auth/CSS hashes:
- route/release hashes:
- backup IDs and checksums:
- final feature/access configuration:
- final authenticated production result:
- remaining material differences:

Target remaining material differences: NONE.

## Permanent prevention

The pinned canonical artifact is now a mandatory release input. Any future
Founder revision must be an immutable artifact with a new hash, explicit
supersession record, and changed-screen inventory. Release provenance binds
canonical hash, evidence contract, source commit, deterministic dist, generated
WordPress manifest/runtime, deployed pointer, and live hashes. Integration-only
acceptance can no longer satisfy product conformance.
