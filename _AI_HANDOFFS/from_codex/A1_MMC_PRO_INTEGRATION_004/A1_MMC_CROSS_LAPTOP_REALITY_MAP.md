# A1 MMC Cross-Laptop Reality Map

RESULT: VERIFIED_ALL_255_MATRIX_ROWS_ACCOUNTED_FOR

## Complete row accounting

The Air change-origin matrix contains 255 data rows across four source worktrees.

| Source group | Rows | Resolution |
| --- | ---: | --- |
| mmc-canonical-discovery-002 tracked | 10 | Preserved in the verified bundle; MMC route chain selectively cherry-picked where authoritative |
| mmc-canonical-discovery-002 tracked-dirty | 7 | Five UI/test files integrated byte-exact; server ported semantically; generated Supabase CLI cache archived only |
| mmc-canonical-discovery-002 untracked | 218 | 30 executable/schema/core files integrated; 3 secret-bearing tests intentionally excluded; remaining 185 reports, demos, logs, and evidence files archived in the verified package |
| MissionMed root | 3 | Protected/ambiguous evidence, archive only |
| Claude worktree | 2 | Historical prototype/evidence, archive only |
| live-source-of-truth-reconcile-004 | 15 | Non-MMC protected runtime evidence, archive only |
| Total | 255 | Every row integrated, bundle-preserved, intentionally excluded, or archive-only |

## Authority decisions

| Evidence | Reality | Final label |
| --- | --- | --- |
| Pro branch e850386 unique guardrail and USCE history | Preserved as branch ancestry; never replaced by main | VERIFIED, UNIQUE_TO_PRO, PROTECTED |
| origin/main MMC commits 49bb583 and 7b55f04 | Clean, self-contained private route/auth chain | VERIFIED, SAFE_TO_CHERRY_PICK |
| Pro/Air commit 1be8a3d | Same SHA on origin and old-laptop refs; later MMC UI foundation | IDENTICAL, SAFE_TO_CHERRY_PICK |
| Air dirty UI | Exact patch on 1be8a3d; five final hashes verified | UNIQUE_TO_AIR, SAFE_TO_PORT |
| Air dirty server | Broad and redacted; whole file conflicts with newer Pro USCE runtime | CONFLICT, NARROW_SEMANTIC_PORT_ONLY |
| Air route/libs/prompt/tests/migrations/core | Absent on Pro and byte-verified | UNIQUE_TO_AIR, SAFE_TO_PORT_WITH_GATES |
| Partner demo and bulk handoffs | Synthetic/history/provenance, not runtime authority | SAFE_TO_ARCHIVE_ONLY |
| Three omitted tests | Deliberately excluded for secret assignments | SECRET_BEARING, DO_NOT_REINTRODUCE |
| Air archival branch b5536ab | Adds export reports only | SAFE_TO_ARCHIVE_ONLY |

No timestamp was used as sole authority. Decisions use ancestry, exact hashes, patch identity, semantics, architecture constraints, and validator outcomes.
