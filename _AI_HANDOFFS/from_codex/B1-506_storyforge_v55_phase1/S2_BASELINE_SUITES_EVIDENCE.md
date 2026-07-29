# B1-506 S2 Baseline Suites Evidence

Outcome: **PASS**

Historical receipt: this S2 result belongs to baseline commit
`6e630df672e47e50ae5e14592c8455979e2b1dac`; it is not the current candidate,
build, or release verdict.

All commands were run from the StoryForge application root:
`/Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5`.

| Gate | Command | Result |
|---|---|---|
| Existing unit suite | `npm test` | PASS — 44/44 |
| PostgreSQL authorization/conformance suite | `npm run test:postgres` | PASS — `STORYFORGE_B1_503_CONFORMANCE_SUITE_PASS` |
| Existing browser suite | `npm run test:e2e` | PASS — 16/16 in 45.3 s |
| Canonical product conformance | `bash scripts/run-conformance.sh` | PASS — 72/72 in 2.6 min |

The browser suite covered the existing privacy, authorization, durable-draft,
student/mentor, mobile-routing, configuration-failure, and accessibility
behavior. The canonical comparison covered all desktop, tablet, and mobile
surfaces plus keyboard focus, narrow shells, and accessibility.

Command-context note: the two remaining commands were first invoked from the
repository root, one directory above the application. That root package has no
`test:e2e` script and no root `scripts/run-conformance.sh`, so those invocations
returned command-not-found/missing-script without starting a test. The commands
were immediately rerun unchanged from `storyforge-v5/`, their authoritative
application root, and both passed. No code, configuration, database, or remote
state changed during the correction.

S2 baseline verdict: **GREEN — implementation discovery may proceed.**
