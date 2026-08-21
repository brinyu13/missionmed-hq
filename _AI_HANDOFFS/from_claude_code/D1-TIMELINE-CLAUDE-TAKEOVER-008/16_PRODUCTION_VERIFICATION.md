# 16 — Production Verification (read-only)

An SSH host `missionmed-kinsta` is configured on this machine and reachable, which made the
P0 asset question answerable at last. **Everything below is read-only. Nothing on production
was created, modified, moved or deleted.**

Host: `theresidencyacademy@35.236.219.140:54154`, docroot `/www/theresidencyacademy_209`.

## P0 — Asset integrity: RESOLVED, and the risk does not exist

The live Timeline runtime is installed as an atomic symlink:

```
wp-content/mu-plugins/missionmed-timeline-runtime/current
  -> releases/timeline-wp-9f88e80b177b8268
```

`current/release.php` — 10,424,176 bytes, installed **Aug 17 10:18** — was checked for the
nine runtime-critical binaries:

| Asset | In live release |
|---|---|
| board_denim.jpg, paper_bond.png, leather_pebble.png | PRESENT |
| paper_hotpress.png, paper_rc.png, print_grain.png | PRESENT |
| satin.png, sticky_pulp.jpg | PRESENT |
| us_flag.png | PRESENT |

65 alias entries in total. **All three textures the protected kernel probes before it will
render anything are present in production.** The "every student's timeline could be blank"
risk I carried through two previous handoffs as the highest-severity unknown **is not
present**. The earlier unauthenticated `404` on the raw texture path was a red herring:
production serves assets from the alias route (`/timeline/_asset/…`, which returns 303 to
the login gate), not from the raw relative path.

## The live release is byte-identical to my local build

```
local  dist-wordpress/release.php  sha256 7d96a7f0ce9f9eaaacddb74f26d56021bbcb137f357d3bb36dcbe083c8618a1e
live   current/release.php         sha256 7d96a7f0ce9f9eaaacddb74f26d56021bbcb137f357d3bb36dcbe083c8618a1e
```

Both are `timeline-wp-9f88e80b177b8268`. This is worth stating plainly: **none of this
run's repairs are in production.** The live release was built from the `dist/` tree dated
Aug 17, which predates every fix in commits `b8b871d` through `dcf68af`. Deploying them
requires rebuilding the static release from current source and installing it.

## Rollback position — strong and verified

- 33 installed releases are retained under `releases/`.
- Current: `timeline-wp-9f88e80b177b8268`.
- Immediately previous: `timeline-wp-0bcab7adfa597ceb`.
- Also retained: `timeline-wp-016c3b15ba41af31`, `timeline-wp-67baa5e53274acd0`,
  `timeline-wp-fc10bb67802a8888`, `timeline-wp-ed84301a63d1ed11` (the release named in the
  original Codex handoff).
- Rollback is an atomic symlink repoint — no file copying, no schema reversal (this work adds
  no migration).
- Timeline-scoped recovery snapshots already exist on disk under `private/`:
  `timeline-rc1-recovery-backups`, `timeline-rc1-backups`, `timeline-ux-007`,
  `timeline-rc1-staging`, `timeline-rc1-recovery-deploy`.

## Why I did not deploy

The ticket conditions deployment on first reading the **current Kinsta manual backup
inventory** and stopping at the deletion authorization if capacity is still 5/5.

**I could not read that inventory.** Kinsta manual backups are a hosting-panel feature, not
a filesystem object; SSH gives me the docroot, not the panel. There is no `kinsta` CLI and no
stored panel credential on this machine. So I cannot confirm whether capacity is still 5/5,
cannot confirm whether the oldest manual backup is still `Post Timeline Builder Success`
(Aug 4 2026, 10:08 PM), and therefore cannot satisfy the precondition the ticket sets.

Reporting the August 4 inventory as if it were current is exactly what the ticket forbids, so
I am not doing it. What I can say is that the *inventory is stale by more than two weeks* and
must be read in the panel.

I also did not create a scoped filesystem snapshot, even though I have the access and prior
runs used that pattern (`private/timeline-rc1-recovery-backups/<utc>-…`), because writing to
production before the authorized backup step would invert the very sequence the gate exists
to enforce. Say the word and it is a one-command operation.
