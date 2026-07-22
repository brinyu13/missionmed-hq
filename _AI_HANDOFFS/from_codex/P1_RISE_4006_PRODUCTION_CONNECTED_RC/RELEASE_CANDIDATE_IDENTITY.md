# P1-RISE-4006 Release Candidate Identity

## Classification

**FOUNDER REVIEW CANDIDATE - NOT PRODUCTION CONNECTED**

This identity names the exact executable candidate. It is not a deployment receipt.

| Identity field | Value |
| --- | --- |
| Ticket | `P1-RISE-4006` |
| Repository | `brinyu13/missionmed-hq` |
| Branch | `codex/p1-rise-4006-production` |
| Implementation commit | `7c415489bdfacf596778d54eb07b050f5c8e94b9` |
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

The digest was resolved from the registry. No local image digest exists because the Docker daemon was unavailable, so an image build is not part of this candidate identity.

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
