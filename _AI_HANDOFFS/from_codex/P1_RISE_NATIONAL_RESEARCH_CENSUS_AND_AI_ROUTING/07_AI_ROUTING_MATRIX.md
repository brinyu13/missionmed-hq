# AI routing matrix

This is a recommendation only. Current production router/settings tables are empty and were not activated.

| Task class | Primary | Validator | Escalation | Why |
|---|---|---|---|---|
| Bulk full deep dossier | OpenAI Terra / gpt-5.6-terra | Codex deterministic checks + sampled human review | Claude Opus for unresolved high-consequence domains | Terra won the controlled speed/cost benchmark; validation remains mandatory. |
| Small gap fill | OpenAI Terra targeted DELTA | Codex schema/source check | Sol for unresolved critical conflict | Avoids paying for fields already known. |
| Resident roster extraction | Terra primary; reuse Sonnet/Parallel/Opus first | Codex normalization, duplicate and school-identity checks | Human/Opus for ambiguous schools | Roster facts are structured but classification errors materially affect student filters. |
| Leadership/PD verification | Reuse stored provider evidence; Terra if stale/missing | Codex role/name/source check | Human/Opus | Fast targeted official-page verification; never infer roles. |
| Ambiguous/conflicting evidence | No automatic promotion | Human review with Codex evidence packet | Claude Opus bounded synthesis | Conflict must remain conflict until resolved. |
| Adversarial validation | Codex deterministic sibling/program-ID/source mismatch rules | Human spot-check | Claude Opus independent challenge | Prior Opus fabrication was caught only through adversarial review, so no model self-approves. |
| Final normalization/promotion | Codex canonical pipeline | Database/file/provider readback | Human authority gate | Provider-neutral, reproducible, and no second truth store. |

Parallel should remain a reuse-first historical corpus, not the default new-spend route. Reconsider it only after a fresh controlled benchmark on the exact DELTA task and price structure.
