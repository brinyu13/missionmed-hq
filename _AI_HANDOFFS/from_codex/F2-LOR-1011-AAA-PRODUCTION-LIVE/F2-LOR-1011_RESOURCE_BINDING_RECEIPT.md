# F2-LOR-1011 Resource Binding Receipt

> Current control, 2026-08-10: F2-LOR-1011 is paused for a temporary serialization yield. DR-033 is canonically `PUSHED_FILED / INDEPENDENTLY_VERIFIED` at `c0f664e63e26eb83e97c5e64742862d493332e4b`. Safe Supabase project and preview-branch inventories ran; project `fglyvdykwgbuivikqoah` / `missionmed-ranklistiq` was identified, the preview registry returned zero rows, and no branch was created. DR-034 is preserved at checkpoint `491d941e967971e4eac89a7c6ca134ba101bde9c` and canonical two-parent merge `9304e3ad100a1537d3593b8eefdcee2e7459adda`; fresh post-push review returned `PASS — INDEPENDENTLY_VERIFIED` and confirmed a tracked-clean synchronized OS writer surface. The exact pause/resume protocol is in `F2-LOR-1011_PAUSE_RESUME_CHECKPOINT.md`. Every migration, Storage, connection, deployment, Matrix, production, user, email, and data gate remains closed.

## Historical pre-DR-034 receipt preserved below

The remainder is retained verbatim as time-bounded evidence from before DR-033 filing and the safe Supabase inventories. Where it conflicts with the current-control notice above, the notice and pause/resume checkpoint control.

Status: PARTIAL — RAILWAY EMPTY STAGING RESOURCES CREATED; BOUNDED SUPABASE AND WORDPRESS EVIDENCE RECORDED; INDEPENDENT BINDING PASS NOT YET OBTAINED

Date: 2026-08-10

Mission: F2-LOR-1011

Authority: DR-032

Scope: Record the exact authority activation, the bounded creation state of the empty, source-disconnected Railway staging environment and service, the unauthenticated Supabase and Postmark access outcomes, the installed Supabase CLI `2.75.0` source-safety findings, and the bounded live WordPress/LearnDash presence evidence. This receipt does not establish a Supabase branch, live LOR entitlement behavior, Postmark identity, Matrix binding, migration, deployment, production, data, user, or resource-binding PASS, and it is not a staging or production readiness verdict.

## Evidence classification

- `VERIFIED`: reproduced by the named fresh independent authority verifier or reported from the bounded primary Railway, browser, or WordPress inspection summarized by the coordinating parent task.
- `SOURCE-VERIFIED`: established from the official tagged Supabase CLI `v2.75.0` source without running the CLI against a provider.
- `UNRESOLVED`: required evidence has not been bound and independently passed.
- `CLOSED`: the corresponding mutation or activation gate remains closed.

This evidence writer did not access Railway, Supabase, WordPress, Postmark, Matrix, environment values, credentials, or secrets. The bounded provider/browser observations below are transcribed from the coordinating parent task's evidence, and the CLI findings are transcribed from official tagged source. No configuration value is recorded here.

## DR-032 authority activation

- Canonical MissionMed OS authority commit: `40be76cfc46083bc6eeb3b90aeb85ab04792b699`.
- Sole parent: `2aad1067a2360b1e1d5468e6653c4f2ff3bac2d3`.
- Fresh non-builder verifier: `/root/fresh_dr032_postpush_verifier`.
- Formal verdict: `PASS — INDEPENDENTLY_VERIFIED`.
- Current authority axes: `PUSHED_FILED / INDEPENDENTLY_VERIFIED`.

This closes DR-032 Tranche 0 only. It opens the conditional Tranche 1 resource-binding path; it does not advance any later gate by implication.

## DR-033 command-authority state

- DR-033 is a staged local draft with record state `LOCAL_DRAFT / NOT_VERIFIED`.
- It is not canonically filed, independently verified, or active.
- No Supabase command named by DR-033 was run, and no Supabase branch was listed, inspected, or created.
- Every migration, Storage, connection, deployment, data, production-main, and later resource gate remains `CLOSED`.

The DR-032 authority PASS does not activate the staged DR-033 draft by implication.

## Product custody baseline

- Repository: `brinyu13/missionmed-hq`.
- Product head: `bc6169fd0b20fad48e822183c175cf4d9039dae7`.
- Branch: `codex/f2-lor-1009-production-release`.
- Draft PR: <https://github.com/brinyu13/missionmed-hq/pull/24>.
- PR state at the coordinating inspection: open draft, exact product head, no comments, no reviews, and no workflow runs.

This is a local/product custody baseline only. It is not deployment or runtime evidence.

## Railway staging resources

### Parent project

- Project name: `missionmed-hq-fix005`.
- Project ID: `29afe885-b9b1-425d-8fd8-8611cd275409`.

### Staging environment

- Environment name: `lor-staging`.
- Environment ID: `f5705d38-393c-4176-9cc2-0d1dbad42c93`.

### Empty staging service

- Service name: `missionmed-hq-lor-staging`.
- Service ID: `bf0e291c-c90b-4bd9-8319-b249a7d02ad0`.
- Service instance ID: `5aa74ba5-399f-4836-b10e-921e7bc5ab32`.
- `activeDeployments`: `[]`.
- `latestDeployment`: `null`.
- `domains`: `[]`.
- `source.image`: `null`.
- `source.repo`: `null`.
- `startCommand`: `null`.
- Auto-deploy: absent; the service is source-disconnected and empty.

The coordinating CLI context remained linked to the staging environment after creation. That context state is an operational caution, not permission to run a provider command or mutate staging.

Counts recorded by this receipt: one staging environment, one empty staging service, zero active deployments, zero latest deployment, zero domains, and zero source bindings.

## Supabase access and CLI source evidence

### Browser access outcome

- The Supabase in-app browser path was unauthenticated.
- It redirected to GitHub login.
- No credentials were entered.
- No Supabase account, organization, project, branch, health, region, history, storage, configuration, or data was inspected through that path.

### Installed CLI `2.75.0` source findings

- `branches list` default `pretty` output is limited to `ID` (`project_ref`), `NAME`, `DEFAULT`, `GIT BRANCH`, `WITH DATA`, `STATUS`, `CREATED AT (UTC)`, and `UPDATED AT (UTC)`.
- `branches create <name>` default `pretty` output adds `Created preview branch:` and then the same eight metadata columns. Its output shape is bounded, but the command creates provider state and remains inactive while DR-033 is not verified.
- Every `branches get` form is prohibited. Default output can print live database `HOST`, `PORT`, `USER`, `PASSWORD`, `JWT SECRET`, `POSTGRES VERSION`, and `STATUS`; non-pretty output additionally builds password-bearing connection strings and API-key environment fields.
- CLI `2.75.0` has no supported update-check disable flag, environment variable, or configuration key. After successful commands it may fetch the latest release and, when a relative `supabase` directory exists, write `supabase/.temp/cli-latest`.
- For a future expressly authorized provider command, exact workdir `/Users/brianb/MissionMed_OS` plus a freshly proved absence of `/Users/brianb/MissionMed_OS/supabase` prevents that cache write, although it does not suppress the incidental GitHub release request.
- `--help` and `--version` bypass the CLI workdir pre-run path; `--version` forces the update fetch. Both probe forms remain prohibited.

These are static source-safety findings, not proof of authentication, project identity, branch existence, branch health, or command authority. RankListIQ candidate `fglyvdykwgbuivikqoah` and candidate branch name `lor-staging` remain unbound; no Supabase command ran and no branch exists by claim of this receipt.

## WordPress, LearnDash, and Postmark evidence

- Live WordPress core reports version `7.0.3`.
- LearnDash version `5.0.4` is active.
- The MissionMed HQ auth-handoff MU plugin version `1.0.4` is live.
- The LOR MU plugin is absent from the live MU-plugin surface.
- The live entitlement-producer bytes and the behavior of candidate function `mmhq_cam_build_entitlement()` remain unbound.
- The repository LOR contract candidate is canary-only and is not live installation or live producer-behavior evidence.
- Postmark access remained unauthenticated. No account, sender, template, configuration presence, delivery route, email, OTP, or faculty identity was inspected or exercised.

These facts bind only the named version/activity/absence observations. They do not bind course IDs, product IDs, eligibility, freshness, expiry, restriction, revocation, LOR enablement, consent, producer return shape, configuration values, or admission behavior.

## Binding matrix

| Resource or gate | State | Evidence boundary |
| --- | --- | --- |
| DR-032 authority | `VERIFIED / PASS` | Canonical commit and fresh formal authority verdict recorded above. |
| Product custody | `VERIFIED BASELINE` | Exact pushed product head and open draft PR recorded above. |
| Railway parent identity | `VERIFIED, INDEPENDENT BINDING REVIEW PENDING` | Exact project name and ID recorded. |
| Railway staging environment | `CREATED EMPTY, INDEPENDENT BINDING REVIEW PENDING` | Exact generated environment ID recorded. |
| Railway staging service | `CREATED EMPTY AND SOURCE-DISCONNECTED, INDEPENDENT BINDING REVIEW PENDING` | Exact service and instance IDs plus null/empty deployment state recorded. |
| Railway region, cost/expiry, deletion, backup, restore, and rollback behavior | `UNRESOLVED / CLOSED` | No claim is made. |
| Railway configuration presence and future source binding | `UNRESOLVED / CLOSED` | No environment value or secret was inspected or recorded. |
| DR-033 Supabase command authority | `LOCAL_DRAFT / NOT_VERIFIED / CLOSED` | Staged local draft only; no named command is active. |
| Supabase browser access | `VERIFIED UNAUTHENTICATED / CLOSED` | Redirected to GitHub login; no credentials entered and no project evidence obtained. |
| Supabase CLI output safety | `SOURCE-VERIFIED` | Default list/create metadata is bounded; all `branches get` forms are prohibited for credential leakage; update-check/cache behavior is recorded above. |
| Supabase staging branch, schema, migration history, health, data-copy state, Storage, backup, restore, and deletion | `UNRESOLVED / CLOSED` | No Supabase command ran; no branch or other resource was created, connected, migrated, or written. |
| WordPress core, LearnDash, and auth-handoff plugin presence | `VERIFIED OBSERVATION; INDEPENDENT BINDING REVIEW PENDING` | WordPress `7.0.3`, active LearnDash `5.0.4`, and live auth-handoff MU plugin `1.0.4` recorded. |
| WordPress LOR plugin and producer behavior | `ABSENT / UNRESOLVED / CLOSED` | Live LOR MU plugin is absent; live producer bytes/function behavior, identifiers, and admission semantics are unbound. |
| Postmark account, sender, template, configuration presence, and delivery | `UNAUTHENTICATED / CLOSED` | No account binding, email, or OTP delivery is claimed. |
| Matrix source, live hashes, manifests, backup, launch route, or deployment | `UNRESOLVED / CLOSED` | No Matrix preflight, mutation, or deployment is claimed. |
| LOR migration ledger or database connection | `UNRESOLVED / CLOSED` | No migration was created, applied, listed, repaired, or connected. |
| Staging deployment or domain | `CLOSED` | The Railway service has no source, start command, domain, or deployment. |
| Production resources or deployment | `UNRESOLVED / CLOSED` | No production inspection or mutation is claimed. |
| Users, test identities, consent, email, protected content, or data | `UNRESOLVED / CLOSED` | No user or data operation occurred. |

## Independent binding gate still required

This receipt is deliberately not a binding PASS. Before any migration, Storage creation, connection, source binding, configuration write, or deployment, a fresh non-builder must verify the exact Railway identities and empty state from primary evidence and must close or explicitly preserve as unresolved every DR-032 Tranche 1 field, including region, source/deploy behavior, configuration presence without values, accountable owner, cost/expiry, deletion, backup, restore, and rollback.

Supabase, the live WordPress entitlement producer and LOR contract, Postmark, and Matrix require their own exact primary binding evidence and independent gates. The WordPress version/activity observations do not substitute for producer-byte, function-behavior, identifier, revocation, or admission binding. A missing or failed binding remains fail-closed and does not authorize selection by inference.

## Mutation and privacy receipt

- Evidence files written by this evidence writer: this receipt and the paired complete handoff only.
- Product code, packages, Git index, commits, providers, deployments, migrations, production, users, and data changed by this evidence writer: none.
- Secrets, tokens, keys, credentials, environment values, protected content, or personal data read or recorded by this evidence writer: none.
