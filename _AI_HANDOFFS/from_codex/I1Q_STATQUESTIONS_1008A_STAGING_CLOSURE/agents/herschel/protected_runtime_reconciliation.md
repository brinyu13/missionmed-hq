# I1Q-1008A Protected Runtime Reconciliation

## Verdict

`FOUR LIVE RUNTIMES RECONFIRMED; CURRENT DEPLOYED SOURCE COMMITS REMAIN UNKNOWN`

Arena, STAT, Drills, and Daily live CDN hashes were re-read on 2026-07-15 and match the 1007X runtime evidence. All four differ from tracked `LIVE/` files. None of the four live hashes appears in the path history or any same-named Git blob reachable from current local refs. The current deployed source commit cannot be identified from repository evidence.

No runtime bytes were written to Git or retained by this lane. No upload, cache purge, object mutation, wrapper change, or deployment occurred.

## Runtime Truth Rule

The Critical Systems Contract establishes this order for deploy readiness:

1. production runtime behavior;
2. approved manifest pin;
3. committed source;
4. uncommitted source;
5. prose.

The current live bytes are therefore runtime truth, but they are not automatically approved source or a safe rollback artifact. The mismatch blocks use of tracked files as deployment baselines.

## Current Hash Reconciliation

| Surface | Tracked source | Tracked SHA-256 | Live object and URL | Live SHA-256 | Current source commit |
| --- | --- | --- | --- | --- | --- |
| Arena | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/arena.html` | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `html-system/LIVE/arena.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` | `UNKNOWN` |
| STAT | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/stat.html` | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `html-system/LIVE/stat.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` | `UNKNOWN` |
| Drills | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/drills.html` | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `html-system/LIVE/drills.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` | `UNKNOWN` |
| Daily | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/daily.html` | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `html-system/LIVE/daily.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` | `UNKNOWN` |

The direct live reads reproduced every 1007X deployed hash exactly.

## Size And Diff Evidence From 1007X

| Surface | Tracked bytes | Live bytes | Tracked lines | Live lines | Diff additions | Diff deletions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arena | 765,627 | 975,417 | 19,594 | 25,151 | 9,827 | 4,270 |
| STAT | 344,178 | 466,902 | 10,110 | 13,148 | 3,368 | 330 |
| Drills | 432,092 | 474,965 | 10,539 | 11,437 | 1,032 | 134 |
| Daily | 150,069 | 167,700 | 3,619 | 3,935 | 427 | 111 |

These are material differences, not line-ending noise.

## Git Provenance Search

For each live hash, read-only Git searches checked:

- every commit in that `LIVE/<surface>.html` path history across local refs;
- every reachable Git blob whose path ends with the same filename.

Results:

| Surface | Path-history hash match | Same-named blob match | Latest tracked source change |
| --- | --- | --- | --- |
| Arena | None | None | `fa83922ef20f8af288540487e33e3c25d4807a79`, 2026-06-16, `MM-LAUNCH-SEV1: launch readiness fixes and validation` |
| STAT | None | None | `f4a07e06f8e37cfd1e2c6537c39fa3628d5b2053`, 2026-04-27, `(E8)-STAT+Async-codex-high-500-b - apply and deploy human async STAT duel contract repair` |
| Drills | None | None | `909b3133c108965b23eb333c54673ea7427d6b40`, 2026-04-27, `MR-CDN-PREFIX-NORMALIZATION-031 - normalize runtime asset references to LIVE CDN` |
| Daily | None | None | `909b3133c108965b23eb333c54673ea7427d6b40`, 2026-04-27, same message |

The latest tracked source change is not proof of current deployment. Even STAT's commit message mentions deployment, but that commit's tracked bytes do not match the current live hash.

## Manifest Coverage

| Surface | Critical Systems Manifest state | Reconciliation consequence |
| --- | --- | --- |
| Arena | Manifest-approved live SHA-256 is `19a519f583439056af56bcf513f2fb26f872369c458ac958093bde48d9acb12a`; current live is `7bb0...`. The approved hash also has no same-named reachable blob match. | Three-way divergence exists among manifest, tracked source, and runtime. Deploy is stop-the-line until owner reconciliation. |
| STAT | No approved asset hash entry in Critical Systems Manifest. `_SYSTEM/DEPLOY_MANIFEST.json` maps the object key only. | Owner, approved source hash, browser expectation, and rollback artifact need registration. |
| Drills | No approved asset hash entry in Critical Systems Manifest. Deploy Manifest maps the object key only. | Same gap. |
| Daily | No approved asset hash entry in Critical Systems Manifest. Deploy Manifest maps the object key only. | Same gap; named human owner is also unclear. |

The Critical Systems known-good commit `3f0c27aac55dbf82748b3eaba360006d4041b539` contains Arena SHA-256 `1657c2ab29af86836262fdd27b92402f738c202e6d96f75b3ec440bf16ca12be`, which matches neither the manifest-approved Arena hash nor current live bytes.

## Ownership And Drift Classification

| Surface | Authority owner | Operational owner evidence | Drift classification |
| --- | --- | --- | --- |
| Arena | Arena owner; Brian/Root for protected deploy | Critical Manifest names Arena; R2/CDN deploy is Root-controlled | `UNKNOWN`, not safe to call expected or accidental |
| STAT | STAT owner; Brian/Root for protected deploy | STAT Canon and DR-006 | `UNKNOWN` |
| Drills | Drills/MMVS ingestion owner; Brian/Root for protected deploy | Exact named human owner not found | `UNKNOWN` |
| Daily | Daily with Drills/Arena integration ownership | Exact named human owner not found | `UNKNOWN` |

No current owner attestation ties any live hash to a commit, build, source archive, deployment event, or rollback artifact.

## Runtime Dependencies And Impact

| Surface | Current dependencies visible in runtime evidence | Risk of deploying tracked file |
| --- | --- | --- |
| Arena | WordPress wrapper, HQ exchange/bootstrap, RANKLISTIQ, routes to STAT and Daily/Drills | Could remove runtime-only auth, profile, routing, or mode behavior. |
| STAT | WordPress wrapper, HQ exchange/bootstrap, RANKLISTIQ duels, sealed packs, answer-map secrecy, historical joins | Could regress sealed-pack behavior, current UI, auth, or active duel compatibility. |
| Drills | WordPress wrapper, MMVS registry, playback, nodes, transcript availability, Daily return | Could regress source normalization, selected-drill launch, playback, or return navigation. |
| Daily | WordPress wrapper, MMVS registry, RANKLISTIQ drill control, Drills launch | Could regress active filtering, selected-drill payload, launch, or Arena return. |

I1Q consumer flags are off. The source mismatch does not prove a present I1Q regression, but it prevents a trustworthy before-and-after baseline for later integration.

## Safe Reconciliation Path

1. Each product owner confirms responsibility for the exact live URL and object key.
2. Root captures the current live bytes into an access-controlled rollback archive through the canonical protected process. HERSCHEL did not retain them.
3. Deployment owner obtains R2 object metadata, Cloudflare deployment evidence, GitHub deployment evidence, and activity-log evidence for each current hash without exposing credentials.
4. Search authoritative external source archives and owner worktrees for the exact live SHA-256. Current local Git refs do not contain it under a matching filename.
5. If no source exists, recover live bytes into a quarantined reconciliation branch without replacing tracked `LIVE/` files.
6. Perform semantic and security diffs against both tracked and live variants. Identify auth, bootstrap, routing, data pin, answer/source isolation, and accessibility differences.
7. Product owner classifies drift as expected or accidental and selects the authoritative source. Runtime truth alone does not decide which source should be promoted next.
8. Register exact source commit or immutable external artifact, live hash, rollback hash, owner, runtime owner, browser expectations, and rollback path in the controlling manifest.
9. Rerun static validation, live marker checks, authenticated browser journeys, answer/source isolation, dependent-product tests, rollback, and post-rollback checks on the reconciled baseline.
10. Only a later owner-authorized deployment may change live bytes. I1Q-1008A must not deploy these runtimes.

## Formal Reconciliation Records Required

Each owner record must include:

- surface and owner;
- tracked path and SHA-256;
- live URL, object key, SHA-256, byte count, and observation time;
- manifest-approved hash, if any;
- authoritative source commit or immutable artifact;
- deployment event or build identifier;
- drift classification and rationale;
- auth, routing, boot, Supabase, and consumer dependencies;
- preserved rollback artifact and hash;
- static, runtime, browser, security, and rollback evidence;
- owner approval and expiry or supersession rule.

## Current Blockers

| Blocker | Impact |
| --- | --- |
| No live hash maps to reachable same-named Git source | Current deployed source cannot be rebuilt from known repository evidence. |
| No current deployment event or build ID | Last deployment cannot be attributed. |
| Arena manifest hash differs from both source and runtime | Manifest cannot authorize deploy readiness. |
| STAT, Drills, and Daily lack critical asset hash entries | Protected registration and rollback are incomplete. |
| Drills and Daily named human ownership is unclear | Required attestation cannot be routed precisely. |
| No authenticated before baseline | Later I1Q dependent-system regression cannot be certified yet. |

## Protected No-Touch Boundary

No CDN/R2 object, cache, deploy script, LIVE file, WordPress wrapper, feature flag, manifest, protected consumer, or rollback artifact was modified.
