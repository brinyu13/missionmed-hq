# I1Q-1008A Baseline

## Ticket And Risk

- Ticket: `I1Q-1008A`
- Mission: `I1Q-1006`
- Product: MissionMed Question Platform
- Risk: `HIGH`
- Track: local protected integration
- Primary target: `AUTHENTICATED_STAGING_LIVE`
- Production migration and production deployment: prohibited by this ticket

## Source Integrity

| Check | Verified result |
| --- | --- |
| Worktree | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A` |
| Branch | `i1q-statquestions-1008a` |
| Source ref | `origin/i1q-question-platform-ultra-1007x-ma` |
| Source commit | `81273add2c0fe350d330902d229683662896a1b1` |
| Frozen engineering ancestor | `ba17e22` |
| Initial status | clean |
| Active Git lock | none |
| 1007X combined SHA-256 | `8fdc2acc486cbd220eaac573e766693e06084b70b4338709092e9bbd53b48a73` |

The required `I1Q_1007X_COMBINED_HANDOFF.md`, `I1Q_1006_COMBINED_HANDOFF.md`, and `_SYSTEM/STAT_CANON_SPEC.md` are tracked at the source commit. The prompt-referenced 1005 Foundation and 1004C Architecture Amendment handoffs are not tracked at the source commit. Read-only copies exist as pre-existing untracked material in the 1000 worktree and must not be silently adopted as release evidence.

## MissionMed OS

| Check | Verified result |
| --- | --- |
| MissionMed OS branch | `main` |
| MissionMed OS HEAD | `0e47d39d79edd9891896eb41e65183e855573cc1` |
| `origin/main` | same commit |
| Status | clean |
| Mission | `I1Q-1006`, active |
| Product registration | active internal build, student release blocked |
| Decision | DR-006 effective |

`CURRENT.md` was generated on 2026-07-15 and lists I1Q-1006 active with no MissionMed OS blocker. The mission record still points to the 1000 source worktree and 1007X branch. Brian's I1Q-1008A order explicitly creates this disposable continuation worktree; canonical mission routing must be updated before filing a production or staging-complete claim if authority requires the new branch to become the mission home.

## Authority Read

The following authorities were loaded before writes:

- MissionMed OS `BOOT.md`, `CURRENT.md`, mission record, product passport, authority index, and DR-006
- MR-079 Codex Execution Guardrails
- MR-078A Supabase Migration Protocol
- MR-078B Data Flow Contract
- Critical Systems Contract
- Matrix Runtime Lock Protocol
- STAT Canon Spec

`MM-AUTH-ARCH-001.md` is referenced by MR-078A, MR-078B, and MR-079 but is absent from its canonical path. This blocks any claim that a new identity contract is a completed canonical global auth architecture. DR-006 authorizes a dedicated additive I1Q adapter using the observed MissionMed identity chain without shared-auth weakening.

## Current Product Baseline

- The local application candidate exists and exposes 17 synthetic internal workflows.
- The additive I1Q PostgreSQL candidate contains 52 tables.
- The disposable PostgreSQL suite previously passed 13 of 13 and must be reproduced in this worktree.
- No preview or staging migration has been applied by I1Q-1008A.
- No authenticated staging URL has been established.
- No production URL is authorized for this ticket.
- The six existing I1Q feature flags are seeded false.
- Student release, STAT consumer, Drills consumer, transcript extraction, public access, and automated publication remain closed.

## Protected Baseline Hashes

| Protected input | SHA-256 |
| --- | --- |
| MissionMed OS `BOOT.md` | `59427f152e76c44ee0099d85d9974b7b9fd385614a1ca53628456da0cb65786d` |
| MissionMed OS `CURRENT.md` | `26534508f8cb6e1f3c7e3c5c58f319976c3e3fd1c49990697847cf6f559dd809` |
| MissionMed OS `missions.json` | `010a09de0595cd3c6d6245cd5936df34e32db21fbfb108d951f9ce425479f674` |
| MissionMed OS `authority_index.json` | `89d665d28ec722487e65dab48dcbf2664e9949ac4fa9bc6c595b9aed9d45a12d` |
| DR-006 | `8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae` |
| MR-079 | `c9968defe0fd55a6f8857cd05b1fc38f86bc7b6eb90c1486c90d5e106b0855ab` |
| MR-078B | `7aee8a4b282b1067b0979b8c7fdab536b719e0759101aa3a1dba3d438234879d` |
| MR-078A | `d86f6b869507e64a064aebb781aca448663a3ab245f03000aede22971b364d79` |
| Critical Systems Contract | `3d9074bf3ba663ae8c5c43f8ef565364098ab8fc238cc0308475bdceb75f1585` |
| Critical Systems Manifest | `c924788a9d433137609861b30a8ff572ddabfbdbdec44d90f703409c6f0d81c9` |
| Matrix Runtime Lock Protocol | `52552ac452aff1db7bb23cccf8a0d219802475c7813b71a72f729798592d1a3a` |
| Matrix Runtime Lock Manifest | `a357d5650e8523350d2842771cf2fd9080e117c72293d93d31dffb73f9bf396f` |
| STAT Canon Spec | `9b6956ea68ad7f51e64f4cf618ba4f1d332eefe6e546c5a22abda82d6d3590dc` |
| `missionmed-hq/server.mjs` | `870e6065fe8f19849d1dfc6484478d66b2ac6d74ee9e1db4fcda9be89b3a2db8` |
| WordPress auth handoff | `e1a68de6de4c4909598d7b2adc3da540d67c858a240d51c607b8d65d2199c9cf` |
| WordPress HQ proxy | `ac01316fe6d0877410054874e7caa69900be641cb799c4aadace40481e44b229` |
| Tracked Arena runtime | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` |
| Tracked STAT runtime | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` |
| Tracked Drills runtime | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` |
| Tracked Daily runtime | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` |
| I1Q 1007X migration candidate | `0c2ca0c48436c7684b97ce88d6b7d518b0780c3e336ad1b5bfd457c4fd60b5e3` |

## Baseline Ruling

No shared auth file, protected runtime, migration history, database, deployment, secret, environment value, feature flag, or production system has been modified. Identity and datastore discovery may proceed. Shared-system and database writes remain gated on exact authority, target, backup, rollback, and dependency evidence.
