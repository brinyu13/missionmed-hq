# Y1-Y2-CAM-V6-3526 Rollback

## Boundary

- Product commit: `aac89b5fc066558dc1d01b23bca782b4057562fa`
- Branch: `codex/y1-y2-cam-v6-3521-live-analytics-runtime`
- Database migrations: none
- Production deployment: none
- Paid provider sessions: zero

## Local/feature rollback

The safest rollback is a normal Git revert of `aac89b5fc066558dc1d01b23bca782b4057562fa` on a clean integration branch. Do not reset the 3521 worktree because it contains unrelated staged and untracked Founder/Fable material. Do not force push.

```sh
git revert aac89b5fc066558dc1d01b23bca782b4057562fa
```

Run the same focused and combined analytics suites after the revert. If the commit has not been merged, simply omit it from the integration operation rather than mutating this preserved worktree.

## Production rollback

No 3526 production revision exists, so no production rollback was executed. A later authorized deploy must record the previous immutable MissionMed HQ revision before activation. Rollback is then a redeploy of that recorded immutable revision followed by route, admission, anonymous denial, student/admin access, and camera/microphone smoke tests.

## Data rollback

None. This convergence introduced no schema change, durable data migration, provider session, or production database mutation.

## Supabase CLI side effect

During local tooling, Supabase CLI automatically changed `supabase/.temp/cli-latest` from the tracked `v2.95.4` to `v2.116.0`. Founder authorization explicitly covered restoring that one unintended temp-file drift. It is restored byte-for-byte to the tracked value and is not part of the product commit.
