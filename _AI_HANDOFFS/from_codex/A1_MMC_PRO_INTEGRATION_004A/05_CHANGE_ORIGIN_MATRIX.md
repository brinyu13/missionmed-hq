# 05 — Change-Origin Matrix

RESULT: `RELEVANT_ORIGINS_CLASSIFIED_NO_AVOIDABLE_UNKNOWN`

## Original Air matrix accounting

The archive matrix contains 255 data rows. Its exporter classifications were preservation instructions, not merge authority.

| Air source group | Rows | Recorded states | Goal 004A disposition |
| --- | ---: | --- | --- |
| MMC canonical-discovery worktree | 235 | 10 tracked, 7 tracked-dirty, 218 untracked | Runtime selectively integrated; product history hash-preserved; unrelated/sensitive material excluded |
| Canonical MissionMed checkout | 3 | 1 tracked-dirty, 2 untracked | One MMC architecture record hash-preserved; protected logs not imported |
| Claude prototype worktree | 2 | 2 untracked | MMC prototype hash-preserved; machine launch file excluded |
| Live-source reconciliation worktree | 15 | 13 tracked, 2 untracked | Non-MMC shared runtime and reports treated as protected/unrelated references |
| Total | 255 | 23 tracked, 8 tracked-dirty, 224 untracked | All rows resolved |

The original destination treatments were 209 full-file preservation rows, 10 bundle-preservation rows, 5 patch rows, 3 secret exclusions, and 28 rows marked for review. Goal 004/004A resolved those 28 through scope, ancestry, content, and runtime ownership; none remains an actionable MMC unknown.

## Final origin and authority decisions

| Asset family | Origin classification | Final treatment and authority |
| --- | --- | --- |
| Prompt 004 branch history and Pro guardrail/USCE ancestry | `MACBOOK_PRO_NEWER`, `PROTECTED_REFERENCE` | Preserved; branch history never rebased or replaced |
| Private MMC route/auth chain | `MACBOOK_PRO/ORIGIN_MAIN_COMPLEMENTARY` | Three self-contained commits integrated by Prompt 004 |
| MMC-019 private-console foundation | `IDENTICAL` across Pro/Air ref at `1be8a3d` | Integrated once; no duplicate copy |
| Five Air dirty UI/test files | `MACBOOK_AIR_UNIQUE` | Byte-exact recovery in Prompt 004 |
| Air `server.mjs` delta | `CONFLICT` with newer shared Pro server | Whole file rejected; five reviewed MMC concerns ported semantically |
| Thirty Air route/lib/prompt/test/core/schema files | `MACBOOK_AIR_UNIQUE` | Byte-exact selective integration; migrations retained but never applied |
| Synthetic partner demo | `MACBOOK_AIR_UNIQUE` | Exact source preserved in Goal 004A with deterministic no-network/no-persistence validation |
| Current selection/session continuity fixes and validator | `MACBOOK_PRO_NEWER` | Goal 004A local repair after browser reality audit; no Air file overwritten |
| Prompt 004 leading-`x` report anomaly | `MACBOOK_PRO_POSTRUN_CONTAMINATION` | One-character repair restored exact committed SHA; historical report content unchanged |
| 178 selected MMC product-history documents | `REPORT_ONLY`, `HISTORICAL` | Raw bodies remain local; SHA/archive-relative-path metadata preserved publicly |
| 10 selected export-provenance documents | `REPORT_ONLY`, `HISTORICAL` | Included in the same 188-row sanitized manifest |
| Three source tests excluded by exporter | `SECRET_EXCLUDED` | Not reconstructed, imported, or represented as runnable coverage |
| Supabase `.temp`, generated caches, raw media, local credentials | `SECRET_EXCLUDED` or `OBSOLETE_TRANSIENT` | Excluded |
| Five ACTN reports and unrelated application changes | `OBSOLETE_FOR_MMC` / `UNRELATED` | Excluded from branch; remain in archive evidence |
| Matrix, Scheduler, Calendar, Webex live/runtime implementations | `PROTECTED_REFERENCE` | Inspected for compatibility only; no mutation or direct import |
| Current `origin/main` as a whole | `COMPLEMENTARY_WITH_CONFLICTS` | Compared semantically; no wholesale merge due ownership, nine conflicts, and unrelated changes |
| Air bundle and old-laptop refs as a whole | `HISTORICAL_EVIDENCE` | Preserved locally/isolated; never merged wholesale |

## Public historical-evidence decision

The repository is public, so copying 188 raw reports would unnecessarily publish operational and personal metadata. The branch instead commits one byte-verifiable manifest with hashes and archive-relative paths only. Its 188 entries are all unique. This preserves evidence of the Air-only historical corpus without making an old report current authority or exposing report bodies.

## No-wholesale-merge finding

Neither the Air repository nor `origin/main` is an authoritative replacement for the target worktree. The target carries newer protected Pro history and the selectively reconciled MMC runtime; main carries other newer shared-system work plus overlapping MMC files. Reconciliation therefore occurs at the semantic/file level, with validators and protected boundaries, never by replacing the tree or accepting a broad merge result.

## Final classification rule

Current MissionMed authority and protected-system records outrank current code; current validated code outranks Goal 004A reports; Goal 004A reports outrank sanitized historical hashes; raw Air documents remain provenance only. Under that hierarchy, every relevant implementation, report, schema, demo, branch, bundle, patch, and protected reference has a deliberate disposition, and no avoidable `UNKNOWN_REQUIRES_RESOLUTION` remains.
