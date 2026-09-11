# Provider Router Readback

Final live router revision: `15`.

| Control | Final value |
|---|---|
| Global enabled | false |
| Student enabled | false |
| Emergency kill switch | true |
| Default quota/window | 30 / 30 days |
| Global cap / actual / reserved | $12.0000 / $7.6593 / $0.0000 |
| Concurrency | 1 |
| Canary mode | `PROGRAM_ID_ALLOWLIST` |
| Canary IDs | `1854831078`, `1851113100` |
| Primary / fallback / escalation | `OPENAI_TERRA` / none / none |

| Provider | Model | Lifecycle | Network/spend | Actual / reserved | Cap |
|---|---|---|---|---:|---:|
| OPENAI_TERRA | gpt-5.6-terra | PRODUCTION_APPROVED | enabled / enabled | $2.9532 / $0.0000 | $6.00 |
| OPENAI_SOL | gpt-5.6-sol | PAUSED | off / off | $4.7061 / $0.0000 | $6.00 |
| PARALLEL | unconfigured | PAUSED | off / off | $0.0000 / $0.0000 | $0.00 |
| CLAUDE_OPUS | unconfigured | PAUSED | off / off | $0.0000 / $0.0000 | $0.00 |
| RISE_REPLAY_TEST | deterministic-private-replay-v1 | TEST_ONLY | network off / spend off | $0.0000 / $0.0000 | $0.00 |

The live admin UI displayed revision 15, the $7.6593/$12.00 ledger, quota 30, exact two-ID canary, Terra approved, Sol paused, and emergency kill active. Provider secrets are environment-only and never enter browser payloads, logs, or this evidence package.

One immutable audit reason created during a shell-driven configuration update displays `/bin/zsh.30` and `/bin/zsh.2435` where `$0.30` and `$0.2435` were intended; shell expansion affected only the descriptive reason string. Provider rows, reservations, hard caps, spend reconciliation, and all numeric ledger values are correct and independently read back.
