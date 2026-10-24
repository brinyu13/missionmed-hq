# I1Q-1007X Protected System Comparison

## Verdict

`PROTECTED_RUNTIME_REACHABLE, SOURCE CHECKSUM BASELINE DIVERGED`

No protected runtime, route, source file, deployment object, cache, datastore, or feature flag was changed by this comparison.

## Authority And Method

The comparison used the existing read-only `VALIDATION/validate_runtime.sh` LIVE path and independent hash, byte-count, line-count, and diff-stat checks. Runtime files were downloaded to a temporary directory. No content was copied into Git or this report.

The canonical runtime URL and WordPress wrapper routes were treated as runtime truth. The tracked `LIVE/` files in this branch were treated only as the source candidate under comparison.

## Static Source Baseline

`bash VALIDATION/validate_deploy.sh` passed before this runtime comparison. It verified the tracked Arena, STAT, Drills, and Daily documents, their route and MMOS markers, the RANKLISTIQ project pin, absence of the deprecated project ID, absence of frontend `signUp`, and absence of a service-role string.

This static result does not prove parity with production.

## LIVE Runtime Result

`bash VALIDATION/validate_runtime.sh --env LIVE` reached all four CDN artifacts, all five WordPress wrapper routes, and the auth-exchange endpoint. Runtime contract markers passed. The command failed only its four local-to-CDN checksum comparisons.

| Surface | Tracked SHA-256 | Deployed SHA-256 | Tracked bytes | Deployed bytes | Tracked lines | Deployed lines | Diff additions | Diff deletions |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arena | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` | 765,627 | 975,417 | 19,594 | 25,151 | 9,827 | 4,270 |
| STAT | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` | 344,178 | 466,902 | 10,110 | 13,148 | 3,368 | 330 |
| Drills | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` | 432,092 | 474,965 | 10,539 | 11,437 | 1,032 | 134 |
| Daily | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` | 150,069 | 167,700 | 3,619 | 3,935 | 427 | 111 |

## Runtime Contract Checks

The following deployed markers passed:

- CDN HTTP reachability for Arena, STAT, Drills, and Daily
- MMOS presence and mode registration where required
- Arena route to `/stat`
- Arena route to Daily Rounds
- Daily selected-drill payload and launch route
- Drills contract guard and query-video path
- auth exchange and bootstrap markers in Arena, STAT, and Daily
- no deprecated Supabase project marker in any runtime
- WordPress wrappers for Arena, STAT, Drills, Daily, and Daily Rounds
- auth exchange endpoint reachable with expected unauthenticated status 400

These checks do not prove authenticated workflows, answer isolation, browser behavior, or source parity.

## Risk Ruling

The mismatch is material and changes the release risk. The tracked `LIVE/` files cannot be used as a deploy or rollback baseline for current production. Any attempt to deploy them could regress functionality that exists only in the deployed runtime.

PROTECTED: no I1Q task may overwrite, promote, roll back, or certify Arena, STAT, Drills, or Daily from this branch until the consumer owners reconcile deployed bytes with an authoritative source commit and register the resulting hashes.

DO NOT TOUCH: cache purge, R2/CDN upload, WordPress wrapper changes, direct runtime replacement, and local-script promotion remain prohibited.

## Dependent Product Status

| Product | Current evidence | I1Q regression verdict |
| --- | --- | --- |
| Matrix | No Matrix path touched; live workflow not exercised | UNCHANGED, not independently smoke-tested |
| Arena | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, source authority unresolved |
| STAT | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, no I1Q consumer enabled |
| Drills | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, no I1Q consumer enabled |
| Daily Rounds | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, no I1Q consumer enabled |
| WordPress auth proxy | Endpoint reachable; authenticated flow not exercised | ACTIVE, shared auth defects remain open |

## Required Resolution

1. Identify the exact commits or external source artifacts that produced the four deployed hashes.
2. Obtain owner confirmation for each protected product.
3. Preserve current deployed bytes as rollback artifacts through the canonical process.
4. Reconcile or regenerate tracked source without overwriting deployed truth.
5. Rerun static, runtime, authenticated, browser, answer-isolation, and rollback tests on the reconciled fixed commit.

Until then, protected consumer flags remain off and this mismatch is a release blocker for State C.
