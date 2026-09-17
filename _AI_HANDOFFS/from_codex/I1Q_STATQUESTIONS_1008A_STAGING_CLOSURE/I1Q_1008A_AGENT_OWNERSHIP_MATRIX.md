# I1Q-1008A Agent Ownership Matrix

## Root-Only Authority

Root Supervisor alone may edit root reports, product code, I1Q migrations, MissionMed OS authority, shared auth contracts, deployment definitions, feature-flag workflows, or integration manifests. Root alone may apply a preview migration, execute rollback or reapplication, deploy staging, push, or declare a state.

## Disjoint Agent Paths

| Owner | Exclusive write scope | Initial status |
| --- | --- | --- |
| Herschel | `agents/herschel/**` | Wave 1 assigned |
| Lorentz | `agents/lorentz/**` | Wave 1 assigned |
| Security | `agents/security/**` | Wave 1 assigned |
| UX and Accessibility | `agents/ux_accessibility/**` | Wave 1 assigned |
| Avicenna | `agents/avicenna/**` | Wave 2 pending |
| Darwin | `agents/darwin/**` | Correctness gate pending |
| Release Reliability | `agents/release_reliability/**` | Infrastructure gate pending |
| Independent Red Team | `agents/red_team/**` | Integrated-candidate gate pending |

## Root Paths

Root owns the 29 required `I1Q_1008A_*.md` reports, `i1q-question-platform/**`, any new I1Q-specific workflow or migration candidate, and final combined-handoff generation.

## Protected No-Touch Paths For Agents

- `/Users/brianb/MissionMed_OS/**`
- `/Users/brianb/MissionMed/_SYSTEM/**`
- `missionmed-hq/**`
- `wp-content/mu-plugins/**`
- `LIVE/**`
- production, preview, and staging databases
- GitHub workflows and deployment providers
- feature flags and secrets

Agents may inspect these paths read-only only where their charter requires it. Any proposed change is returned to Root with impact, tests, rollback, and authority evidence.

## Collision Rule

One writer owns each path at a time. Root does not edit an agent-owned report while that agent is active. Agents do not edit files outside their assigned directory.
