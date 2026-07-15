# 16 Security, Privacy, RLS, and Protected Ecosystem

RESULT: `SENTINEL_ARCHITECTURE_APPROVED_WITH_IMPLEMENTATION_GATES`

## Security posture

Preserve the existing fail-closed private route, capability checks, no-index behavior, disabled-by-default persistence, anon-key plus short-lived RLS principal, active assignment scoping, and forced RLS. Replace unsafe MMC-specific boundaries without broad shared rewiring.

Current production blockers include: first-host-label Supabase allowlisting, non-terminating shared JSON size handling, AI enabled by shared-key fallback, broad local transcript path/symlink access, caller-controlled import/download roots, Webex shared-token fallback/weak host suffix/unbounded buffering/force, browser-authored identity proof, fixture/live mixing, unreviewed AI promotion, non-idempotent writes, and no student publication isolation.

## Required controls

### Authentication, authorization, and CSRF

- HQ session auth remains the gateway; every MMC query/command independently enforces route capability plus the current role-specific authority: active assignment for mentor operations; exact-subject `publication_read`, typed `self_author`, or `respond` capability for the applicable student operation; and current job lease/workload capability for worker RPCs.
- Mutation CSRF is required whenever session/cookie auth is used, independent of a global development flag.
- Operations, identity override, prompt activation, AI run, sensitive read/export, and publication use distinct capabilities.
- Assignment revocation is checked at execution, job lease/retry, and new publication—not only page load. It terminates the mentor's authority but does not silently terminate an exact student's separately authorized entitlement to an existing projection; that lifecycle uses publication withdrawal/correction/expiry policy.
- Distinct principals are mandatory: mentor/operator JWTs identify issuer/audience/tenant/environment/principal/capabilities and rely on server/DB assignment lookup; student JWTs require an unresolved-until-approved student-auth mapping and exact-subject `publication_read`, typed `self_author`, and `respond` capabilities; worker workload tokens bind deployment tenant/environment, workload identity, queue/job capability, audience, expiry, and replay identity. No runtime principal uses `service_role` or `BYPASSRLS`.
- Tenant, environment, actor, effective role, assignment lookup, and worker scope are derived from authenticated server/deployment context—never request fields. Break-glass access is time-bounded, purpose-bound, separately approved, and fully audited.

### Credential/origin boundary

- Supabase REST origin is an exact approved HTTPS origin/project, not first hostname label.
- Webex/OpenAI use MMC-specific credentials and affirmative enablement; no Scheduler/global fallback.
- Redirects and every token-bearing request revalidate exact origin; secrets never enter browser, report, URL, error, or audit payload.
- Environment/project identity is verified before any authorized staging mutation; production remains denied until a separate prompt.

### Request and storage boundary

- Bounded JSON parser terminates with 413; malformed JSON returns 400, never an empty default payload.
- Schema validation rejects extra/path/force/policy-broadening fields.
- Browser uses opaque asset IDs. For local sources, the broker anchors at an approved root directory descriptor and walks every component with `openat` + `O_NOFOLLOW` (or `openat2 RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS`), then validates the held final descriptor's type/device/inode/size/stability/MIME/hash before streaming. Realpath or final-component checks alone are insufficient. Object-storage prefixes use exact configured tenant/environment scope. No absolute path is logged.
- Rate limits, timeouts, quotas, idempotency, optimistic versions, durable jobs/outbox, and transactional promotion are mandatory.
- Private responses use `Cache-Control: no-store` initially; no Service Worker or durable browser storage holds student publications, transcripts, mentor notes, or sensitive state. A later encrypted-offline ADR is separate authority.
- Strict CSP uses nonces/hashes and approved origins, `frame-ancestors` deny/approved same-origin policy, `X-Content-Type-Options: nosniff`, restrictive Referrer Policy, same-origin CORS, Origin and Fetch-Metadata validation, and escaped text/no AI-generated HTML. Session cookies remain `Secure`, `HttpOnly`, appropriately `SameSite`, scoped, rotated, and timeout warning/reauth are tested.
- Media/temp/database/object storage use TLS and approved encryption at rest/KMS, environment/tenant-scoped keys, rotation, least privilege, access audit, restore proof, and explicit retention/legal-hold/purge policies.

### Privacy and consent

- Separate server-attested Authority Grants for source acquisition, transcript processing, AI-provider transfer, and publication policy are required before each stage and rechecked after lease/revocation races. Trigger/title/browser input supplies no authority.
- Recording/transcript collection, AI transfer, retention, disposition/legal hold, jurisdiction, and provider terms require an explicit approved policy before live enablement.
- Purpose limitation and minimization apply per job; raw transcripts/private notes are excluded from general logs/metrics.
- Student projection is separate, deny-by-default, field allowlisted, versioned, reviewable, and retractable.
- Sensitive reads, exports, identity overrides, publication, and denials receive complete audit.

## RLS architecture

Additive migrations—not edits to historical migrations—introduce command/idempotency/version, evidence/claim/review, publication, job/outbox/inbox, authority/policy, lineage, and audit fields/tables. Every new table enables and forces RLS before grants. Composite tenant/environment/subject foreign keys and kind-specific checks prevent invalid envelope combinations. Policies use both `USING` and `WITH CHECK` and cover least-privilege administrator, assigned mentor, unassigned mentor, former mentor under expired/revoked assignment, exact-student `publication_read`, exact-student typed `self_author`, exact-student `respond`, other student, anonymous, job-scoped worker identity, and tenant/environment isolation. Negative cases prove capability separation: publication read cannot self-author/respond, self-author cannot read mentor-private sources or publish, and respond cannot mutate source/publication objects.

The worker does not receive a general browser/service-role path. Prefer invoker functions under forced RLS; any definer function has a fixed safe `search_path`, exact claims/arguments, narrow ownership, no dynamic SQL, and complete audit. Worker RPCs require current job lease generation and capability. RLS is the final line, not the only line.

Audit storage is append-only: runtime roles receive no UPDATE/DELETE, integrity uses keyed or signed chaining appropriate to threat model (never bare hashes of low-entropy sensitive values), telemetry is redacted, and backup/WAL restore evidence must reproduce acknowledged commands, audit, and publication state before an RPO 0 claim is earned.

## Protected-system change matrix

| System/boundary | CAM v2 need | Allowed future impact | This run |
| --- | --- | --- | --- |
| `missionmed-hq/server.mjs` | auth gateway + route registration | Minimal MMC-scoped module mount after decision record; preserve exports/middleware/routes | Read only |
| Shared auth / WordPress | mentor/student principal | Reuse approved session adapter; no weakening or WP write | No mutation |
| Shared CSRF | command protection | Preserve/strengthen MMC enforcement; broad parser/auth change needs ecosystem review | No mutation |
| Supabase/RLS | canonical MMC data | Additive authorized migrations and complete role matrix in staging only | No apply/write |
| Production Supabase | eventual live store | Separate production authority, backup/rollback/preflight | Denied |
| Railway/shared manifests | gateway/worker deployment | Separate topology/deploy decision; scoped services/vars | No mutation/deploy |
| Matrix runtime | read evidence only if approved | Adapter contract after Matrix authority; no runtime touch | DO NOT TOUCH |
| Scheduler / Calendar | future read evidence | Least-privilege read adapters; no writes or shared tokens | No mutation |
| Webex account/recordings | GET-only discovery/download | Dedicated MMC credential, exact policy, no source mutation | No live access/mutation |
| Daily Drills watcher / ingestion | none | No coupling | DO NOT TOUCH |
| `video_registry.json` | none | No read/write dependency | DO NOT TOUCH |
| R2 / Cloudflare Stream | possible future storage only | Separate storage authority and adapter | No access/write |
| File Vault | future approved artifact refs | Read-only opaque references; remains source owner | No mutation |
| LearnDash / CRM | future roster/milestone evidence | Attested least-privilege read envelopes | No mutation |
| Arena / STAT / RISE / StoryForge / ACTN | context only if separately approved | No shared runtime/code/data change | No mutation |
| Email / notifications | future notification delivery | Separate consent/template/delivery authority; generic sensitive bodies | No send |
| Payments | none | No dependency | DO NOT TOUCH |
| Production media paths | historical source evidence | Dual-path read compatibility only under ingest authority; no move/delete | No mutation |
| Secrets/env values | future configuration | Names/contracts only; values remain secret manager owned | Not read/written |

## Threat cases that block release

Symlink/TOCTOU transcript to `.env`; attacker-suffix Supabase/Webex host; redirect with bearer token; oversized JSON/video; malformed JSON; request path/force/trigger broadening; fabricated roster anchors; fixture subject with real media; stale page after assignment/authority revocation; injected transcript; AI quote absent/wrong speaker/contradicted; stale worker generation; idempotency replay after revocation; retry after partial writes; cross-student/free-text publication reference; withdrawn item in cache/notification; XSS/AI HTML; CSRF without global auth flag; aggregate/timing/pagination/storage-metadata leak; log/error containing path/token/private note.

## Rollback and incident rules

Every schema release has target proof, transaction/rollback plan, and RLS test. Every app release has prior artifact/commit, feature-specific kill switches (ingest, AI, operational promotion, publication), and no shared-auth bypass. Wrong identity or publication leak triggers immediate relevant kill switch, projection withdrawal, access/token review, preserved evidence, incident owner, and correction—not destructive cleanup.

## Sentinel release verdict

Architecture safety score after mandatory red-team repair: **9.3/10**. This is a specification score, not an earned implementation certification. Approval is conditional: implementation cannot enable live AI/Webex/student publication or apply any schema until exact-origin, consent sequencing, distinct principals, identity attestation, transactional idempotency, RLS isolation, tamper-evident audit/restore, and rollback gates pass under explicit environment authority.
