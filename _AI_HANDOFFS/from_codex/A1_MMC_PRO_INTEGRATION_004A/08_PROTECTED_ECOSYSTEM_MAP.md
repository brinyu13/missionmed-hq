# 08 Protected Ecosystem Map

RESULT: `MMC_BOUNDARIES_MAPPED_AND_PRESERVED`

## Operating rule

MMC shares a process and surrounding infrastructure with other MissionMed products. The reconciliation therefore treats every shared runtime, credential boundary, media system, schedule system, and protected application as an external consumer until proven otherwise. Prompt 004A makes no production mutation, deployment, schema application, remote media transfer, environment-variable change, authentication change, or RLS change.

## Shared runtime and security consumers

| System or boundary | Relationship to MMC | Protection applied in this run | Evidence/status |
| --- | --- | --- | --- |
| `missionmed-hq/server.mjs` | Shared HQ entry point for authentication, APIs, media, payments, USCE, email, and MMC | No Prompt 004A server change. The existing semantic MMC integration is preserved instead of replacing the server with an Air copy or merging `origin/main` wholesale. | Syntax, private-mount, persistence-contract, MMC route, and broader deployment validators pass. |
| HQ authentication | Supplies the session used by `/mmc-private/` and API routes | No bypass or weakening. Unauthenticated private-page request redirects to auth; unauthenticated MMC API requests return unauthorized. | Local unauthenticated route checks confirmed redirect/401 behavior. |
| Private MMC authorization | Limits the console and pipeline to configured operator roles/capabilities | Kept intact. Pipeline also checks the route-specific private authorization model, with admin gates for privileged operations. | Private mount and coaching contract validators pass. |
| CSRF | Protects authenticated mutations in shared HQ | No change. Browser audit used a synthetic local session only to inspect local UI; no real credentials or external writes were used. | Persistence integration and mount contracts pass. |
| Static serving | Serves the synthetic partner artifact | Generic existing static serving is reused; no server route or deployment wiring added. | `/mmc-partner-demo/` returns 200 locally and deterministic validation confirms synthetic-only behavior. |

## Data, identity, and deployment boundaries

| System | Permitted relationship | Explicit prohibition/status |
| --- | --- | --- |
| Supabase | Unapplied `mmc.*` schema and RLS evidence; same-origin persistence candidate restricted to an explicitly allowed non-production project and RLS-scoped runtime | No migration run, production query, RLS bypass, service-role browser use, or production mutation. Persistence remained disabled during local audit. |
| WordPress | Existing HQ authentication/identity source and a possible future evidence source | No WordPress mutation, credential change, plugin change, or unverified profile hydration. |
| LearnDash | Potential enrollment/program evidence only after field and assignment authority are approved | No read or write integration added in this run. Fixture program labels do not prove LearnDash truth. |
| Railway | Existing deployment environment for HQ | No deploy, restart, environment edit, variable readout, or production probe. |
| Environment configuration | Feature gates for persistence, AI, Webex, and session runtime | No secret value is copied into code, reports, screenshots, or git. Local runtime used sanitized non-secret settings with integrations disabled. |
| Public Git remote | Final branch publication target | Raw historical reports with personal/operational metadata remain local-only; only commit-safe hash metadata is eligible for push. |

## Media, Webex, and scheduling boundaries

| System | MMC dependency | Protection applied |
| --- | --- | --- |
| Webex | Read-only recording inventory and title-triggered local staging candidate | No account mutation, recording deletion, title change, token change, or real pull. Token-missing and pull-gate-closed states were inspected locally. |
| Scheduler | Potential appointment/session reference | Read-only reference only. No booking, cancellation, reschedule, payment, or configuration mutation. |
| Calendar | Potential no-sync meeting reference | Read-only protected reference only. No event mutation or sync activation. |
| `MissionMed-Webex` and Webex worktrees | Architecture/configuration evidence | Inspected only as protected references. Dirty or credential-sensitive files were not imported. |
| VIDEO_SYSTEM registry | Read-only candidate-pointer source for the coaching pipeline | The MMC pipeline may read a configured registry path; this run did not write `video_registry.json`. |
| Daily Drills watcher and ingestion | Separate media ingestion owner | Never started, modified, reused, or imported into the MMC worker. The MMC worker is intentionally dedicated. |
| R2 and Cloudflare Stream | Existing media storage/delivery systems | Not read, written, uploaded, or configured by this reconciliation. |
| File Vault | Potential protected document owner | No private-object read or write; only synthetic file metadata appears in demo fixtures. |

## Product ecosystem map

| Product/system | Shared concern | Prompt 004A treatment |
| --- | --- | --- |
| Matrix runtime | Protected runtime and known-good lock boundary | Matrix preflight in this worktree reports missing/mismatched protected assets and exits with its strict warning code. MMC treats Matrix as an external protected reference and changes zero Matrix runtime assets. No Matrix deployment claim is made. |
| Arena | Shared launch/auth contracts | No source changes. Existing deployment validator passes. |
| STAT | Shared launch/auth contracts | No source changes. Existing deployment validator passes. |
| Drills | Shared launch and media contract | No source changes; no watcher operation. Existing deployment validator passes. |
| Daily | Shared launch and selected-drill contract | No source changes. Existing deployment validator passes. |
| USCE | Shared server and student/admin route consumers | Prompt 004A leaves all USCE files and shared server behavior untouched. A wholesale `origin/main` merge was rejected partly because it would conflict with the later protected USCE/runtime lineage. |
| StoryForge | Referenced in synthetic student/product fixtures | No StoryForge API, storage, or production mutation. |
| Scheduler and Calendar | Potential meeting context | Protected references only; no hydration or mutation. |
| ACTN | Unrelated historical reports discovered in the archive | Explicitly excluded from the MMC corpus and current branch. |
| Email, payments, Stripe, media, CIE, Studio, DBOC | Other HQ server consumers | No related route, auth, config, or source change. Local startup warnings for absent optional integrations were expected in the sanitized offline audit. |

## Shared-file consumer decisions

### `missionmed-hq/server.mjs`

This file is the highest-risk overlap because it registers multiple MissionMed applications and security layers. Prompt 004A therefore applies a no-touch decision: retain the Prompt 004 semantic integration, validate it, and refuse both the full Air server and a broad main merge. No current MMC repair required a server edit.

### Private client files

The selected-student repair is contained inside the private MMC document and client script. It does not change API payloads, shared exports, route names, authentication, CSRF, schema, or other applications. The corresponding validator checks this narrow contract.

### Partner demo

The partner demo is a single static, synthetic file. It does not call APIs, persist data, use cookies, request analytics, or contain operational endpoints. It is visibly labeled as a partner demo and synthetic data. Its generic static route does not affect the private mount.

## Local audit isolation

The private console was launched through the real local HQ process with production-like authentication behavior and a synthetic, local-only inspection proxy. Persistence, AI, and Webex were disabled. This allowed browser inspection of protected UI states without using real credentials or changing remote systems. The partner demo was inspected directly as a public static route. Browser console error and warning logs were empty for both surfaces.

## Regression boundary conclusion

Applicable MMC and shared deployment validators are green. The final diff must continue to show no Matrix-protected path, Scheduler/Calendar/Webex workspace, Daily Drills watcher/registry, production configuration, secret, raw media, or unrelated application change. These are hard scope boundaries, not deferred cleanup items.
