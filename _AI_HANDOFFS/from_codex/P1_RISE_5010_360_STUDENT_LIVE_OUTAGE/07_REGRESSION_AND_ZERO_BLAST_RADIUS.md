# Data, Security, and Zero-Blast-Radius Validation

## Live student-visible registry

Authenticated production status and catalog readback:

- 6,139 unique program-specialty identities
- 31 specialty tabs
- 57 exact specialty designations
- 6,139 source documents
- 708,788 total claims
- 701,858 known claims
- 670,663 evidence-labeled claims
- 38,125 quarantined claims
- 883 historical SOAP programs
- canonical evidence mode `durable`
- research-factory mode `canonical_sink_zero_spend`
- Student Intel persistence `durable`
- My Programs persistence `durable`

The authenticated UI exposed every current registry identity regardless of research depth. Program Files retained explicit pending, unknown, not-published, and not-yet-researched states rather than hiding incomplete programs or fabricating data.

## Production PostgreSQL evidence subset

The provider-neutral research/evidence store remains intact and was not changed during this incident:

- 886 canonical evidence identities
- 883 private-beta identities
- 3 review-required identities
- 23 specialties represented in the evidence-identity table
- 542 evidence sources
- 3,965 canonical evidence claims
- 883 approved current facts
- 542 provider ingest runs
- new provider spend recorded by those runs: `$0.0000`

Provider distribution:

| Provider | Sources/runs | Claims | New spend |
|---|---:|---:|---:|
| Claude/Opus | 270 | 977 | $0.0000 |
| Parallel | 271 | 2,063 | $0.0000 |
| NRMP SOAP closure | 1 | 925 | $0.0000 |

The live 6,139-program catalog is the current registry artifact. The PostgreSQL `registry_releases` table still records the earlier 909-program rights-safe projection, and the canonical evidence tables contain only the 886 identities currently bound to research/SOAP evidence. This is a pre-existing two-plane model, not an incident regression: every 6,139 identity is live in the catalog, while the smaller PostgreSQL subset is the durable evidence bridge. It was recorded explicitly and not widened during an auth-only incident.

## RLS readback

RLS is enabled and forced on:

- `student_program_states`
- `canonical_evidence_sources`
- `canonical_evidence_claims`
- `canonical_program_identities`
- `provider_ingest_runs`
- `student_intel_submissions`

Policy inventory includes subject isolation for My Programs; private-beta/admin projection policies for evidence and identities; admin-only ingest; and owner/visible/admin policies for Student Intel.

A provider transaction changed role to `rise_app_runtime`, set an unused subject key, and observed:

- total persistence rows as provider owner: 1
- foreign-subject rows visible to the application role: 0
- private-beta evidence identities visible: 883
- approved current facts visible: 883
- Student Intel rows visible: 0

The transaction was rolled back.

## Unrelated-system smoke checks

| Surface | Result |
|---|---|
| MissionMed homepage | HTTP 200 |
| WordPress login | HTTP 200 |
| Matrix, real 360 session | HTTP 200, no login redirect |
| StoryForge, administrator session | HTTP 200, StoryForge marker present |
| File Vault, administrator Matrix mode | HTTP 200, File Vault marker present |
| Arena | HTTP 200 |
| RankListIQ | `/ranklistiq/` 301 to `/rank-list-engine/`, final HTTP 200 |
| LOR Studio / shared HQ | `/health/lor-studio` HTTP 200 `ready` |
| HQ API | `/api/health` HTTP 200 |
| RISE isolated service | health HTTP 200 |
| LearnDash 360 course | ID 3893 published; 441 eligible non-admin identities |
| WooCommerce / IV Prep | Store API product 5504 HTTP 200; product remains published |
| RISE PostgreSQL | deployment `SUCCESS`, one running instance |
| Shared-HQ PostgreSQL | deployment `SUCCESS`, one running instance |

The shared project also reports `ivprep-profile-b-worker` deployment `271d3953-3a2e-483a-9419-b89b9ed97038` as `CRASHED`, created 2026-08-17. That condition predates this 2026-09-08 RISE repair and was neither caused nor changed by it. The IV Prep commerce/product and Matrix surfaces tested above remain available.

```text
RESEARCH_HYDRATION_REGRESSION = NO
SOAP_REGRESSION = NO
MY_PROGRAMS_REGRESSION = NO
FABLE_UI_PRESERVED = YES
NEW_PARALLEL_SPEND = $0.00
ZERO_BLAST_RADIUS_PASS = YES
```
