# State Delta

## Before

- Live product already served 6,139 programs and 31 specialty tabs.
- Post-5012K live UI already displayed nonzero depth counts, but the durable Postgres depth projection still depended on the literal `completed_research_factory` source type.
- The 909-row legacy rights-safe DB release was not explicitly reconciled against the live file catalog.
- The national census matrices existed, but no exact post-current-state IM/FM matrices or authorization-ready Terra queues existed.

## After

- Durable depth coverage reads approved current canonical facts, independent of provider/source labels.
- Pending signals remain review-gated and cannot inflate depth.
- Full test suite and live authenticated/anonymous QA pass.
- Registry persistence roles are explicitly resolved: 6,139 file catalog is browse authority; DB 909 release is a retained legacy partial snapshot; DB identity/evidence tables are additive evidence stores.
- Exact post-zero-spend matrices exist for all 695 IM and 809 FM programs.
- 511 programs are excluded from paid work.
- Exact Terra queues are prepared: 672 DELTA and 321 FULL; none launched.
- Research controls remain OFF with emergency kill switch ON.
- Paid spend remains `$0.00`; student quota use remains `0`.

## Git and deployment

- Branch: `codex/p1-rise-5007-private-beta-full-registry-student-intel`.
- Code commit: `65f9edc44f5ecfa20af96e976146aeb9afad27bb`.
- Code files committed: `rise/adapters/postgres-runtime.mjs`, `rise/tests/filter-intelligence.test.mjs`.
- Remote divergence after code push: 0 ahead / 0 behind.
- Live deployment: `ede2968f-cceb-4bd1-8de3-6a229f0cc926`.
- One preflight deployment `2d012a38-497b-43d9-aff0-2b4d48bf463c` failed before build because the archive root omitted `/rise/railway.json`; production stayed on the prior healthy deployment. The corrected repository-root archive succeeded.
- Deployment PATH lease epoch 2719 was normally released; provider readback showed released=true, expired=true, active=false, global active lease count=0.

## Preserved state

All unrelated pre-existing dirty files remain untouched. The deployment used the established repository-root archive shape so the existing full-registry production overlay remained intact; a clean-HEAD-only archive would have regressed the uncommitted 6,139 release assets and was not used.

