# D1 Timeline Founder Re-anchor 015 — Integration, Build, and Local Release-Candidate Receipt

Generated: 2026-08-25

## Verdict

Unit 22 is complete. The integrated local candidate passes the affected full test, type, package, protected-visual, browser-interaction, durability, and opened-export gates. Production was not modified.

## Regression and static verification

- TypeScript tests: 173/173 PASS.
- JavaScript tests: 669/669 PASS.
- Combined automated tests: 842/842 PASS.
- Typecheck: PASS.
- Package verifier: 23/23 PASS.
- Canonical visual release test: 4/4 PASS.
- `git diff --check`: PASS.
- Independent stale-assertion review: the five updated presentation assertions correctly follow the one shared Founder serializer; no implementation defect found.

Logs:

- `/private/tmp/d1-founder-reanchor-015-npm-test.log`
  - SHA-256 `4453c723c82688a910aa510f0e529b3799177b62ecc861dca21337f5b1aed77c`
- `/private/tmp/d1-founder-reanchor-015-typecheck.log`
  - SHA-256 `a061fcde3c377171bf4c0cffde52127b08fd3011e11e23605349b1bfc7325735`

## Accepted presentation-asset custody

Read-only authoritative root:

`/Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001/packages/mission-timeline/dist`

Authority manifest:

`/Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001/packages/mission-timeline/release/manifest.json`

- authority manifest SHA-256: `0a49773ce353cb48cb9337214f2060eb934921db2d5396779d48565424a4e325`
- 29/29 accepted 402A binary assets matched byte count and SHA-256
- 9/9 protected D1-409H texture/photo assets matched `PROTECTED_HASHES.sha256`
- no dirty/concurrent source was imported
- no custody gap remains

The new global medical-school dataset is separately source-bound by:

`packages/mission-timeline/release/d1-timeline-founder-reanchor-015-source-assets.json`

- manifest SHA-256: `aff0a41ce5c3a34c57e6324a75c33987b9086430cc7981252812d3f861ff7f86`
- dataset SHA-256: `c8a4c4be87b154a997e3b42dc76937baf7f31ee58e63e61ebaeb15caa3379beb`

## Local immutable package identities

Static candidate:

- release ID: `timeline-ed2f23826d136536`
- source HEAD recorded by local build: `a6165951d3e3f2aa5150f68223dac283880b8e7d`
- accepted base: `49ba56dacd2cddfc2fb2241839d54a03e85bc271`
- files: 66
- file hashes verified: 66/66
- runtime-critical assets verified: 24/24
- release manifest SHA-256: `acca842837e090ee3439fd6c9321401bf5372c2b418f2942fd88075a629b9c75`

WordPress runtime:

- release ID: `timeline-wp-bc3f6d5dcc0157dc`
- asset count: 66
- index SHA-256: `6cdeb1e18c4c790db4692ccc2b6893dc0374137b60199fd2c21114fab11184db`
- release payload SHA-256: `a5929f9502d45c2dcf68fb5eabdccd1ca481c4ab3739f0f1becae30f25bfc361`

These are local candidate identities, not a final production release receipt. The final release build must occur from the committed clean source after Founder acceptance.

## Packaging defect repaired

The WordPress packager normalized top-level asset literals to `assets/...`, but its private-fixture exclusion recognized only nested paths ending in `/assets/...`. The result was a false build failure for five intentionally excluded Founder private-photo demo fixtures.

Repair:

- recognize both exact top-level `assets/photos/<fixture>` and nested `.../assets/photos/<fixture>`
- retain fail-closed behavior for every other unresolved asset
- continue to exclude all private Founder photo fixtures
- add a focused regression assertion

The repaired focused WordPress gateway suite passes 11/11.

## Human-equivalent evidence retained

- shared Advanced Studio Chrome receipt: `/private/tmp/d1-founder-shared-editor-proof-015-r9/D1_FOUNDER_SHARED_EDITOR_BROWSER_RECEIPT.json`
- opened export receipt: `/private/tmp/d1-founder-shared-export-015/RC1_EXPORT_BROWSER_RECEIPT.json`
- opened PNG, Letter PDF, and A4 PDF visual artifacts: `/private/tmp/d1-founder-shared-export-015/`
- durability receipt: `/private/tmp/d1-founder-durability-015/D1_FOUNDER_DURABILITY_015_RECEIPT.json`
- visible CV apply/reload receipt: `04_CV_INTELLIGENCE_AND_BROWSER_RECEIPT.md`

## Remaining release law

1. Unit 23: explicit Founder visual/product acceptance of the integrated candidate.
2. Unit 24: commit/clean-source release build, provider-native backup, bounded immutable deployment, production canary, security/persona checks, eligible rollout, rollback proof, and final evidence seal.

No production mutation is authorized before unit 23 passes.
