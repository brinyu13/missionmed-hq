# Fix Implementation

## Bounded change

The accepted shared runtime at source commit `c3d6c9cd12d4838fed6bb699fe9d574956ab15e7` already contained the required RISE audience callback and the existing LOR/shared-HQ behavior. The branch tip `0ab39c2663d9b4752cfc42d9d01903047a959818` adds documentation only after that runtime commit.

The provider-native Railway **Redeploy** action was used on historical deployment `c322eee1-4ca2-456c-a9f4-09f6705eb16b`, which explicitly rebuilds and deploys the exact same configuration. This avoided deploying the dirty local worktree or changing any environment value.

The first CLI upload attempt created deployment `8324e329-a004-4209-93d4-7fb0081d330f` without an associated build. It never replaced production and was removed in the Railway UI before the historical redeploy. No partial candidate was activated.

## Validation before cutover

- `node --check missionmed-hq/server.mjs`: pass
- focused RISE/shared-HQ tests: 38 pass, 0 fail
- full repository suite: 1,083 pass, 15 skip, 1 non-runtime failure
- the sole full-suite failure was host-tool pin drift for current macOS `/usr/bin/python3` and `/usr/bin/ssh`; it was unrelated to RISE/HQ behavior
- 147 Railway variable names before and after
- variable-name inventory SHA-256 before and after: `558ab31cdeb6776e30f62897fe7459b50e46022d75fe487bbcc589855eb50a77`
- no variable values were printed or filed

## Preserved state

- no source file changed for this incident
- no WordPress file, role, user, course, group, entitlement, or configuration changed
- no RISE service or database mutation
- no schema migration or backfill
- no cache purge was needed
- no Fable asset changed
- no research provider invoked
- no paid research spend
- all pre-existing dirty/untracked worktree state preserved
