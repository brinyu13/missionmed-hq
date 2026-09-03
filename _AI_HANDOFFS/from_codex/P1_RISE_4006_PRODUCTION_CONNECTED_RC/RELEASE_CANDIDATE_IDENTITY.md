# P1-RISE-4006 Release Candidate Identity

## Classification

**FOUNDER REVIEW CANDIDATE - NOT PRODUCTION CONNECTED**

This identity names the exact executable candidate. It is not a deployment receipt.

| Identity field | Value |
| --- | --- |
| Ticket | `P1-RISE-4006` |
| Repository | `brinyu13/missionmed-hq` |
| Branch | `codex/p1-rise-4006-production` |
| Implementation commit | `f99e126399508d2630e9b2a17b8671d87cff1ca2` |
| Parent rollback point | `54d0090b35340180bdc6699ff9131c9268840e22` |
| Build ID | `rise_web_8d2c636a88b7` |
| Runtime package | `rise/` |
| Intended route | `https://missionmedinstitute.com/rise/` |
| Current intended-route status | HTTP 404 |
| Local review route | `http://127.0.0.1:4178/rise/` |
| Data class | `synthetic_test_fixture` |
| Activation class | `offline_shadow_only` |
| Deployment | None |
| Database migration | None outside disposable local rehearsal |
| Draft PR | [#15](https://github.com/brinyu13/missionmed-hq/pull/15) |

## Asset Identity

| File | SHA-256 |
| --- | --- |
| `index.html` | `d1adca99bfb7b8d7177327f9676f8af675375d36e26ca7f04134472600a36132` |
| `styles.css` | `3e2321722e66fc693a94564b851c1acc666c1ab4d8ecf8878ce1678a1c5ea696` |
| `app.js` | `6d32344f610979cd2ceb0d72d309bb669f476e9fa7d33c06623a219674a595f3` |
| `vendor/lucide.js` | `f586795cb401e516e22377ce6dde1bb3cb047190bd57e7acd4971872298ea306` |

The complete manifest is `artifacts/build-manifest.json`.

## Container Identity

The Dockerfile pins Node 22 Alpine by multiarch digest:

`sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2`

The local image built from the committed candidate with:

- image ID: `sha256:244ee6e217f4aaeacadb25464b3b82b1f23f1d3e61f87447f7947fd190e63461`;
- architecture: `linux/arm64`;
- size: 58,181,739 bytes;
- runtime user: `node`;
- command: `node tools/start-production.mjs`;
- build warnings: zero;
- web build: `rise_web_8d2c636a88b7`;
- SPDX SBOM: `artifacts/container-sbom.spdx.json`, 20 packages, SHA-256 `fdee20b81f774277d96529b4b860a5765d6f351c3ee191d309965546f87f940c`;
- Trivy 0.72.0 report: `artifacts/container-vulnerability-scan.trivy.json`, zero findings across all severities, SHA-256 `1056ba5b02b6bf97204d2c8a288426c5e945e00855deadd387ccfe306ed75a5c`.

This is a scanned local arm64 image identity, not a pushed production registry digest. Approved CI or staging must rebuild and scan the exact immutable target-architecture registry image.

## Registry Identity

There is deliberately no production registry release ID, API-index hash, activation receipt, or source-authorization set in this candidate. The local review fixture identifies itself as:

- registry: `rise_registry_synthetic_browser_fixture`;
- build environment: test;
- classification: synthetic test fixture;
- activation: never deployable.

Any production identity must replace these values with an independently validated source-controlled release and exact governance pins. Renaming the fixture or changing environment variables cannot satisfy the gate.

## Reproduction

```bash
cd /Users/brianb/MissionMed_worktrees/P1-RISE-4006-production/rise
npm ci
npm test
npm run build
npm run test:browser
```

The expected build ID is `rise_web_8d2c636a88b7`. A different source tree or dependency graph must produce a different authenticated manifest and must not be represented as this candidate.
