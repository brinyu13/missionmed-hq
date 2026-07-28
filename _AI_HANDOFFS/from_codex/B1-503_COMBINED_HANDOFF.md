# B1-503 StoryForge Product Recovery — Combined Handoff

Status: **COMPLETE — LIVE FOUNDER PILOT VERIFIED**

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

Final gates:

- canonical SHA-256 and 23-surface evidence contract: PASS;
- unit suite: 44/44;
- PostgreSQL authorization suite: PASS;
- B1-503 PostgreSQL conformance suite: PASS;
- browser E2E suite: 16/16;
- canonical comparisons: 72/72 across desktop, tablet, and mobile;
- narrow navigation, keyboard modal behavior, horizontal overflow, and serious
  accessibility checks: PASS;
- API-only Railway build, secret scan, npm audit, and `git diff --check`: PASS;
- deterministic release and exact live runtime hashes: PASS;
- authenticated Founder production validation: PASS.

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

Final recovered production:

| Layer | Identity |
|---|---|
| Source conformance | `36e823da7be1b436e336bfa9a9997611e6449117` |
| Generated release | `5141939b6c7dc3d0d415e28899777dab372180c2` |
| Deployed cutover | `6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Railway deployment | `fa7ad084-4dae-4039-a154-2250a407d95e` (`SUCCESS`) |
| Railway image | `sha256:fa952146914f1eb4ab3cdfd6ccfe7f2d0d69c1638f6de59668f2272443500d2b` |
| Kinsta pointer | `releases/6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Release ID | `v-0912286e7dfc2327` |

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

## Historical production prestate

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

## Completed cutover

Every mandatory gate completed in order:

1. exact source and deterministic release committed and pushed;
2. MyKinsta manual, private Kinsta, PostgreSQL 18 logical, and locked Railway
   recovery points created and verified;
3. PostgreSQL 18 isolated restore rehearsal passed;
4. rollback packet and sealed Kinsta receipt established;
5. StoryForge switched off at `2026-07-28T08:45:08Z`, one token TTL plus margin
   elapsed, and feature-off was reverified;
6. exactly two B1-503 migrations applied in one transaction;
7. API-only Railway deployment
   `fa7ad084-4dae-4039-a154-2250a407d95e` reached `SUCCESS`;
8. immutable Kinsta release and isolated route installed and the pointer
   atomically advanced;
9. all feature-off route, alias, hash, cache, protected-asset, API, database,
   Matrix, WordPress, and unrelated-route gates passed;
10. only the exact one-Founder student pilot was re-enabled;
11. authenticated production validation passed without fabricated data.

After the two B1-503 migrations, the old B1-502 product may be contained by
feature-off, but must not be re-enabled against the new schema. Full old-product
restoration requires the fresh database backup plus the prior runtime pointer.

## Evidence

Evidence root:
`_AI_HANDOFFS/from_codex/B1-503_evidence/`

It contains:

- browser-chrome-free production-before comparisons and runtime identities;
- canonical reference screenshots;
- local candidate screenshots and 72-surface canonical comparison receipts;
- final authenticated production screenshots and hashes;
- backup, database, cutover/rollback, and production deployment receipts.

## Final deployment receipt

Canonical receipt:
`_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_PRODUCTION_DEPLOYMENT_RECEIPT.md`

- source commit:
  `36e823da7be1b436e336bfa9a9997611e6449117`;
- release commit:
  `5141939b6c7dc3d0d415e28899777dab372180c2`;
- deployed cutover commit:
  `6f45dbbd2150ba11000236a4959f70434f6edb77`;
- Railway deployment:
  `fa7ad084-4dae-4039-a154-2250a407d95e`;
- Kinsta release:
  `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`;
- generated release ID:
  `v-0912286e7dfc2327`;
- runtime index/app/auth/CSS:
  `ade2b1...`, `71f618...`, `960289...`, `41e546...`;
- route/release:
  `1cf024...`, `3215ee...`;
- rollback receipt:
  `a2f4cf3638e2356ae68037fc44ec102a67c841d80b5861d8d8ff066c1acd390b`;
- exact Founder pilot:
  enabled, one allowlist entry, one student override, zero cohorts, 60-second
  token TTL, exact WordPress/database mapping;
- final database:
  five migration rows, one user, zero stories/drafts/notifications/audit,
  26 questions, zero active assignments, 25 RLS tables;
- authenticated production:
  Home, Library, Interview Prep, Notifications, Settings, Quick Capture, and
  Question Workshop PASS; fresh later token exchange PASS; no data mutation;
- cache:
  three live passes with exact hashes, Cloudflare `DYNAMIC`, Kinsta `BYPASS`,
  no `Age`;
- protected assets:
  unchanged;
- remaining material differences:
  **NONE**.

The Kinsta install finished publication and verification before WP-CLI exited
`139` on its scoped site-cache command. The provider accepted that request, the
separate scoped CDN purge returned HTTP `200` with the exact success body, and
the repeated live checks above proved the final state. Install and rollback
tooling now uses only Kinsta's separate scoped PHP site/CDN methods with strict
response validation. No broad or object-cache purge occurred.

Railway emitted one non-material `pg` deprecation warning for parallel queries
on one client. The pinned driver handled the calls, authenticated behavior
passed, and no HTTP `5xx` occurred. This is a forward-compatibility cleanup,
not a release blocker.

The one-Founder acceptance remains valid only for the exact student pilot and
expires before non-Founder/mentor enablement or a hosting-principal change.
AI and audio remain truthful gated states; neither is simulated.

## Permanent prevention

The pinned canonical artifact is now a mandatory release input. Any future
Founder revision must be an immutable artifact with a new hash, explicit
supersession record, and changed-screen inventory. Release provenance binds
canonical hash, evidence contract, source commit, deterministic dist, generated
WordPress manifest/runtime, deployed pointer, and live hashes. Integration-only
acceptance can no longer satisfy product conformance.
