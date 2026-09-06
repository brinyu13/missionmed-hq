# HB-360A-005R MMVS public GitHub containment

Status: COMPLETE — visibility containment verified; `G-MMVS` remains open

Date: 2026-09-05 (America/New_York)
Target: GitHub repository `brinyu13/missionmed-mmvs`, repository id `1197817111` / GraphQL id `R_kgDOR2U9Fw`
Lease: `PATH:2eae4273a7430ab2cd60d52a7d2efc79aecb8513f7a233edc3ba32e2c578c9db`, id `dd56d1f2-201f-477f-9905-6c6d28a3e37c`, fencing epoch `1335`
Expired unused lease attempt: id `b8621a40-5a30-46eb-a61d-272ae98fdae7`, fencing epoch `1334`; no provider mutation occurred under it.
Evidence-edit lease: id `43e8e545-41ce-4cef-aed1-405730e99298`, fencing epoch `1336`; edit occurred during its valid window and it later expired inactive before commit.
Evidence commit/push lease: id `5310bf8d-a912-4155-a224-8c559d2a10a0`, fencing epoch `1337`.
Authority: DR-196/197; Founder prompt SHA-256 `d626905093b6c02e990082f0047aa739afd914343bdfd551d3a804c29bae7282`

## Read-before-write

- Visibility: `PUBLIC`; `isPrivate=false`; active, unarchived, default branch `main`.
- Provider reports zero forks. This does not prove the repository was never cloned or cached.
- Anonymous raw `app.py`: HTTP 200, SHA-256 `7b9864c094be22bf87e5229bc35db8dcfc3eb0eb3715c898d7f385061e371806`.
- Anonymous raw `video_registry.json`: HTTP 200, SHA-256 `44f7a5b92d1e4ea6fafd88fb45a2660c8334f4cb57a121020ba881ce0fd7a99c`.
- The registry contains 193 historical IDs, all still present in the 313-ID live registry. No title, note, path, filename, transcript, object, or student value is retained here.
- Fresh consumer discovery found active Arena, Drills, and Daily clients using the Railway MMVS origin, not anonymous GitHub raw URLs. No current production caller of this repository was proven.

## Executed action

Changed only repository visibility from public to private through GitHub's official provider interface. The repository, branch, commit, files, and history were preserved. Nothing was archived, deleted, rewritten, edited, rotated, or deployed.

This is immediate exposure containment, not `G-MMVS` closure. Prior public disclosure remains an incident-assessment item, and raw caches or clones cannot be recalled by a visibility change.

## Predeclared safe rollback

Automatic rollback to public is prohibited because it would re-expose the exact registry. If a legitimate consumer fails, keep the repository private, disable only that dependent feature if necessary, and migrate the consumer to a least-privilege authenticated source. Restoring public visibility requires a new explicit Founder/security decision after sensitive-history removal or a safe replacement repository is proven. GitHub retains the unchanged source/history, so the containment itself is non-destructive.

## Verification

1. Provider-native readback reports `PRIVATE` and `isPrivate=true` for repository id `1197817111` / `R_kgDOR2U9Fw`; default branch remains `main`.
2. Provider `updated_at=2026-09-06T03:30:02Z`, inside epoch 1335's server window `2026-09-06T03:29:38.782562Z` through `2026-09-06T03:30:08.782562Z`.
3. Anonymous GitHub REST contents requests returned HTTP 404 immediately. Raw CDN requests initially returned cached HTTP 200, then both the bare and cache-busted `app.py` and `video_registry.json` requests returned HTTP 404 at `2026-09-06T03:39:02Z`. No cached payload was retained.
4. Branch head remains `6d71c7dfe3a0047d75c28caa1fe9228f921d7ce0`. Authenticated object metadata remains: `app.py` Git blob `263e92e13c1228f2538a8981e55611de9d246784`, 4,370 bytes; `video_registry.json` Git blob `fd9825046847ce14eb5bbcfc77696c319ec89eee`, 571,934 bytes.
5. Authenticated content SHA-256 values remain `7b9864c094be22bf87e5229bc35db8dcfc3eb0eb3715c898d7f385061e371806` and `44f7a5b92d1e4ea6fafd88fb45a2660c8334f4cb57a121020ba881ce0fd7a99c` respectively.
6. Provider readback reports `archived=false`, `disabled=false`, `fork=false`, `forks_count=0`; source push time and head remain unchanged.
7. The Railway MMVS origin remained available after containment: `/health`, `/videos`, and `/api/drills` each returned HTTP 200. Current Arena, Drills, and Daily source continues to use that Railway origin; no production caller of anonymous GitHub raw content was proven.
8. Epochs 1334 and 1335 expired with `released_at=null`; neither is active. The provider mutation occurred during the valid 1335 window. This is recorded truthfully instead of claiming an explicit release that did not occur. Epoch 1336 covers final evidence custody and is released separately after commit/push.

## Final classification

`G-MMVS = OPEN — PUBLIC GITHUB CONTAINMENT COMPLETE, CORE SECURITY HARD STOP REMAINS`.

Post-write provider state: PASS — private, same repository id and default branch
Anonymous raw negative tests: PASS — HTTP 404 after propagation
Source/history preservation: PASS — head, object identity, and content hashes unchanged
Lease protocol: PASS FOR PROVIDER WRITE — mutation timestamp fenced by epoch 1335; evidence edit fenced by epoch 1336; commit/push fenced by epoch 1337
Provider-clear state: REQUIRED after epoch 1337 release
Incident assessment: REQUIRED — prior public disclosure cannot be recalled

This containment does not solve current runtime custody, anonymous Railway APIs and mutations, object authorization, reflective credentialed CORS, same-origin consumer migration, playback authorization, or independent post-repair verification. The 313-ID live registry and ten live-only IDs were not changed.
