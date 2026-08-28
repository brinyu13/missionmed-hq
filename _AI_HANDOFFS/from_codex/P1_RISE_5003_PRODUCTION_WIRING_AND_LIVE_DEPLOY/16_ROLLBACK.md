# 16 — Rollback

No live/provider change was made, so production rollback is presently a no-op. The public site remains in its pre-ticket state.

## Preserved Points

- Assigned pre-work baseline: `4d1a8f5950668eed35a619f9a17aca7553c8308c`
- UI lock checkpoint: `f738f58003859b6d21fae1d12f5b48f79bc7166f`
- Architecture checkpoint: `41946a4`
- Production-safe implementation checkpoint: `52f85f8b8764c993a114bb07880c1f51b94d0b3b`

## Non-Destructive Local Recovery

Create a separate recovery worktree at an exact checkpoint instead of resetting or cleaning this worktree:

```sh
git -C /Users/brianb/MissionMed_worktrees/p1-rise-5003-production-wiring worktree add /Users/brianb/MissionMed_worktrees/p1-rise-5003-recovery 4d1a8f5950668eed35a619f9a17aca7553c8308c
```

Do not overwrite `_UI_LOCKS`. Do not run proposed down migrations: they intentionally refuse destructive deletion. Student program-state rows and immutable evidence must survive application rollback.

## Future Provider Rollback Gate

Before any later activation, authority must record the exact prior service/artifact version, route target, active registry release, database checkpoint, secrets/config version, and provider command. A failed post-deploy smoke must restore those recorded pointers atomically. No provider-specific rollback command is invented here because no provider target is authorized or pinned.

```text
ROLLBACK_READY = YES
```

This means the current worktree has exact recovery checkpoints and no live mutation to undo. Live deployment rollback remains a prerequisite for any future activation.
