# B1-503 Production Deployment Receipt

Status: **PASS — LIVE FOUNDER PILOT ENABLED AND VERIFIED**

Production URL: `https://missionmedinstitute.com/storyforge/`

This receipt contains no credentials, tokens, connection strings, WordPress
numeric user IDs, or database passwords.

## Release identity

| Field | Exact value |
|---|---|
| Canonical Founder HTML SHA-256 | `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` |
| Source-conformance commit | `36e823da7be1b436e336bfa9a9997611e6449117` |
| Generated-release commit | `5141939b6c7dc3d0d415e28899777dab372180c2` |
| Deployed cutover commit | `6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Release ID | `v-0912286e7dfc2327` |
| Kinsta release target | `releases/6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Railway deployment ID | `fa7ad084-4dae-4039-a154-2250a407d95e` |
| Railway image digest | `sha256:fa952146914f1eb4ab3cdfd6ccfe7f2d0d69c1638f6de59668f2272443500d2b` |
| Railway deployment state | `SUCCESS` |

The deployed cutover commit was clean, pushed, archived, and used consistently
for the database migration receipt, Railway deployment, Kinsta commit-named
release, and live pointer.

## Exact source archive

- Archive:
  `/Users/brianb/MissionMed_private_backups/B1-503/storyforge-v5-6f45dbbd2150ba11000236a4959f70434f6edb77.tar`
- SHA-256:
  `dd9452428631297cab15cc48304ed3f317eecb492801c5e5be6427f080668870`
- Size: `2,703,360` bytes
- Local mode: `0600`

## Runtime hashes

| Runtime object | SHA-256 | Bytes |
|---|---|---:|
| `dist/index.html` | `ade2b11958fa70305e6bb5a99e08f1e9621a37cb3cf7df5ce4af964016fee27b` | 1,397 |
| App asset | `71f618e9afac78d13c1b22d30b0ad43e2b2c7ab162b6e1d92ae607b3b853f3fb` | 214,651 |
| Auth asset | `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e` | 7,159 |
| Stylesheet | `41e546d34bfd73f0f9f446047640ba2cf7c303b092841b9f5115911293e7ddf1` | 97,142 |
| Kinsta route | `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61` | 30,530 |
| Generated `release.php` | `3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e` | 741,148 |

The live Kinsta pointer targets the exact commit-named release. The release
directory is mode `0555`; `release.php` and the isolated route are regular
mode-`0444` files owned by `theresidencyacademy:www-data`. The private cutover
lock is absent.

## Backups and rollback

| Recovery boundary | Exact identity |
|---|---|
| MyKinsta manual backup | `B1-503 pre product recovery 2026-07-28T08:03:10Z` |
| Private Kinsta recovery point | `B1-503-RP-KINSTA-PRE-20260728T080310Z` |
| PostgreSQL logical recovery point | `B1-503-RP-PG-PRE-20260728T080310Z` |
| PostgreSQL dump SHA-256 | `18d737fba373c0a5da0cd43874601a0cecd2a81a9c1c9ad40d55febdd9ccea6c` |
| PostgreSQL 18 restore rehearsal | `PASS` |
| Locked Railway volume backup | `59a491f8-ecb2-4fc8-b5b3-da43ccada133` |
| Kinsta rollback receipt SHA-256 | `a2f4cf3638e2356ae68037fc44ec102a67c841d80b5861d8d8ff066c1acd390b` |

The sealed rollback receipt is preserved locally at
`_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_KINSTA_ROLLBACK_RECEIPT.tsv`
and remotely under
`/www/theresidencyacademy_209/private/b1-503/rollback/B1-503-6f45dbbd-20260728T084409Z/`.
It pins the prior pointer
`releases/4bd956b6ea222d20428c41415236a73b93576447` and prior route hash
`23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88`.
No rollback was required or executed.

The corrected recovery scripts were atomically restaged at the existing
private commit-named staging path after local verification:

- install script:
  `b29550c0741301d30b7bfed9ce74fd3f41f0f9d1156a3b4a13d0c8ed044b8197`;
- rollback script:
  `86622d6a291f396b6d8195c2ea67f96dae28d997481671d87da167dde8f54d8e`.

Both are mode `0700`, owned by `theresidencyacademy:www-data`. The exact prior
WP-CLI-based script bytes were preserved beside them under fixed
`.wp-cli-cache-v1` recovery names. No public runtime, feature setting,
database, cache, or production data was changed by this private restaging.

## Cutover sequence

- Feature-off began at `2026-07-28T08:45:08Z`.
- The full 60-second token TTL plus safety margin elapsed and feature-off was
  reverified before protected mutation.
- Exactly two B1-503 forward-only migrations were applied in one transaction.
- The Railway API-only package was deployed from the pinned commit.
- The immutable Kinsta release and isolated route were published, then the
  StoryForge pointer was atomically advanced.
- Feature-off route, alias, cache, API, database, protected-asset, and shared
  Matrix/WordPress checks passed.
- The exact one-Founder student pilot was re-enabled only after those gates.

The install script completed all product publication, pointer, route, hash,
mode, owner, and feature-off checks, then exited `139` while invoking Kinsta's
WP-CLI site-cache command. Provider UI state showed that the request had been
accepted. A separate scoped CDN purge returned HTTP `200` with the exact body
`Cache has been cleared.` The live StoryForge routes were immediately and
repeatedly exact, `CF-Cache-Status: DYNAMIC`, `X-Kinsta-Cache: BYPASS`, with no
`Age`. No broad, object-cache, `--all`, or `purge_complete_caches(true)` purge
was performed. The cutover and rollback scripts were subsequently hardened to
use only Kinsta's separate scoped site/CDN PHP methods with strict
`WP_Error`/HTTP/body validation.

## Database and API poststate

- Migration ledger: exactly 5 known rows.
- StoryForge users: 1.
- Stories: 0.
- Story drafts: 0.
- Questions: 26.
- Notifications: 0.
- Audit events: 0.
- Active mentor assignments: 0.
- RLS-enabled StoryForge tables: 25.
- Least-privilege application role: present.
- No application data was created or modified during authenticated validation.

Railway origin checks:

- `/healthz`: HTTP `200`,
  `{"ok":true,"service":"storyforge-v5"}`;
- `/`: HTTP `404`;
- `/api/config`: HTTP `200`;
- unauthenticated `/api/stories`: HTTP `401`;
- unapproved origin: HTTP `403`;
- observed HTTP `5xx`: 0.

Runtime logs contained one non-material `pg` deprecation warning caused by
parallel queries on one connected client. The pinned driver accepts the calls,
all live operations passed, and no user-visible failure or HTTP `5xx` occurred.
This is a forward-compatibility cleanup item, not a production blocker.

## Founder pilot configuration

- `storyforge_enabled=true`
- allowlist count: 1
- role-override count: 1
- allowed roles: exactly `student`
- cohort allowlist count: 0
- token TTL: 60 seconds
- WordPress-to-database Founder mapping: exact
- active mentor assignments: 0
- development authentication: disabled
- origin API-only policy: enabled

This acceptance remains limited to the exact one-Founder pilot. It expires
before non-Founder enablement, mentor enablement, or any hosting-principal
change.

## Live validation

An authenticated Founder session opened and visually verified:

- Home;
- Library;
- Interview Prep;
- Notifications;
- Settings;
- Quick Capture;
- Question Workshop.

A fresh authenticated tab later completed a new token exchange and reopened
StoryForge successfully. The checks did not type, save, import, record, assign,
review, or otherwise fabricate production data. Data-dependent Story Detail
and Review states and mentor-only production screens therefore were not opened
live; their exact deployed bytes are covered by the 72/72 canonical browser
gate, and their server authorization is covered by the PostgreSQL suite.

All 13 public asset aliases passed three enabled validation passes with exact
hashes and types, `CF-Cache-Status: DYNAMIC`, `X-Kinsta-Cache: BYPASS`, and no
`Age`. Raw asset paths, invalid aliases, and direct release paths remained
denied. Shared homepage, member-login routing, and WordPress REST remained
healthy.

## Protected assets

The protected assets were not edited and their remote/public hashes remained:

| Protected object | SHA-256 |
|---|---|
| Legacy StoryForge JavaScript | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` |
| Legacy StoryForge CSS | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` |
| Matrix PHP | `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95` |
| Matrix shell | `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a` |

## Production screenshot hashes

Browser-chrome-free initial-production comparisons:

| Screenshot | SHA-256 |
|---|---|
| `comparison-before/01-library.png` | `028482be7d176df0659e58d09b6f804597987c7ad5b3fbc3966e4ad805cada98` |
| `comparison-before/02-interview-prep.png` | `f7a81ceb3ef490b52c596ae540da93642e9e48f5cfa6aeb0ff0e9d0758ec6e47` |

Authenticated final-production screenshots:

| Screenshot | SHA-256 |
|---|---|
| `01-home-desktop.png` | `6495bc48791471727d8802c0057901dfa2fedd38c7a012450c628dbb8276e62b` |
| `02-library-desktop.png` | `434230830752b5333862ce2b5f6098b83a3af8eddefb9ce3bd1fb0805dd4e663` |
| `03-interview-prep-desktop.png` | `3ac2a2ec6bddb4c0659b7ac05ad844817512ba76694e1b426e0fd22b9d27d423` |
| `04-notifications-desktop.png` | `e38620e0285948e18bf4c6a81f39785fe3decbd188e7629c10dabf7d3cc27f25` |
| `05-settings-desktop.png` | `45a5c3299d9fd02f7af9cd94372e579e89c62f0fa5db2a78e0aacabda3597ec4` |
| `06-quick-capture-desktop.png` | `09e3ee28792855c5848f117809c3da62e05fc0b17dcd1e6919ab5f810f0703e5` |
| `07-question-workshop-desktop.png` | `674dd62993b40224069b270828ed7c5f0c1fc7472d4d34865757185d5fce7905` |

The complete canonical, local-after, before-comparison, and live-production
inventory is `B1-503_SCREENSHOT_MANIFEST.tsv`, SHA-256
`bdedc236ac57a7b20c0a5c0bbdfe28ef907a1cd221d2f2c5e651887f29a9b5b6`.

## Final product result

The deployed production bytes are the exact locally verified B1-503 release.
All material product differences identified against the Founder-approved
StoryForge V5 authority are repaired. Infrastructure-dependent features remain
truthful: AI is not simulated, audio reports unavailable unless its real chain
is configured, and mentor surfaces remain inaccessible in the student-only
Founder pilot.

**Remaining material product differences: NONE.**
