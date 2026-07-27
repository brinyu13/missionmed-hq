# B1-500 Founder Gate Decision Log

All entries remain open unless explicitly marked otherwise.

| Gate | Status | Required decision/evidence |
|---|---|---|
| Retention/deletion/export/archive | `OPEN — FOUNDER` | Policy by artifact type, revocation behavior, export scope, and deletion authority. |
| Admin support/private story access | `OPEN — FOUNDER` | No-access policy or exact emergency access workflow with visible audit. Current build has no access. |
| StoryForge Supabase project | `OPEN — INFRA/FOUNDER` | Exact project ref, region, ownership, migration history, PITR, and credentials. |
| Protected Matrix source owner | `OPEN — INFRA` | Clean source worktree, current lock, integration owner, deployment procedure. |
| WordPress StoryForge claim | `OPEN — AUTH OWNER` | Additive audience and signed `cam_entitlement` propagation without a second identity system. |
| Mentor assignment source | `OPEN — PRODUCT/INFRA` | Production source of truth and synchronization contract. |
| Private audio storage | `OPEN — INFRA/FOUNDER` | Dedicated bucket, lifecycle, CORS, TTL, retention, monitoring, and credentials. |
| Production URL/path | `OPEN — FOUNDER` | Exact Matrix route/mount decision. |
| Legacy data migration | `OPEN IF DATA EXISTS` | Name a verified source or explicitly record “no legacy data.” |
| AI provider/DPA/budget | `OPEN — FOUNDER` | Provider, no-training DPA, budget/rate caps, model/prompt versions. AI stays closed. |
| Student general AI | `OPEN — POST-BETA` | Separate promotion after mentor general-suggestion beta. |
| Clinical mentor AI | `OPEN — POST-EVAL` | Eval set, hallucination test, mentor panel, documented pass. |
| Clinical student AI | `OPEN — POST-BETA` | Separate promotion after clinical mentor beta. |
| Optional email | `OPEN — POST-GA` | Founder decision; no email is implemented. |
| Stage 5 UAT | `OPEN — FOUNDER` | Sign frozen staging candidate after full student/mentor walkthrough. |
| Stage 6 go-live | `OPEN — FOUNDER` | Explicit production deploy authorization. |

No founder decision was inferred in this run.
