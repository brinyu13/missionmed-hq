# HB-360A-005R Provider Truth

Classification vocabulary: CONFIRMED, STRONG INFERENCE, UNKNOWN, BLOCKED. No secrets, meeting titles, recording bodies, transcript text, student rows, private object keys, or credential values are retained.

Observed on `2026-09-05` through native provider consoles/APIs and safe unauthenticated endpoint tests.

## Webex

| Item | Classification | Evidence |
|---|---|---|
| Personal meeting site and scheduling | CONFIRMED | Authenticated Webex Meetings UI; schedule capability and recurring meetings visible. No meeting titles retained. |
| Recording transcripts | CONFIRMED | Site recording setting enabled. |
| AI notes/action items and chapters | CONFIRMED | Site recording settings enabled. |
| Automatic Cisco AI Assistant | CONFIRMED | Scheduling setting enabled. |
| Invitee post-meeting content sharing | CONFIRMED OFF | Scheduling setting. |
| Delegate automatic sharing | CONFIRMED OFF | Scheduling setting. |
| Integration vs service app | UNKNOWN | Meetings site does not expose developer/Control Hub application state. |
| Granted scopes | UNKNOWN | Developer application state not available in the observed site. |
| Webhook subscriptions/secrets | UNKNOWN | No developer webhook readback was available. |
| Automatic recording policy | UNKNOWN | Transcript enablement does not prove every intended meeting auto-records. |
| Recording ownership, retention, consent/notice | UNKNOWN | Not exposed in the observed site settings. |
| Intended-host webhook creation and deterministic multi-host schedule registration | BLOCKED | Requires Control Hub/developer-app readback with the intended host model. |

Least-privilege 005D proposal: use a Webex Service App authorized by a Full Admin, scoped only to schedules, participants, recordings, and transcripts required by the ingestion worker; register and reconcile deterministic meeting/series IDs; authenticate and verify webhook signatures/secrets; never persist meeting titles in governance evidence.

Official references: [Service Apps](https://developer.webex.com/create/docs/service-apps), [Meetings scopes](https://developer.webex.com/meeting/docs/meetings), [Webhooks](https://developer.webex.com/messaging/docs/api/guides/webhooks), [Meeting transcripts](https://developer.webex.com/meeting/docs/api/v1/meeting-transcripts), [accessing meeting resources](https://developer.webex.com/meeting/docs/api/guides/access-meeting-resources-guide).

## Cloudflare R2 and Stream

| Item | Classification | Evidence |
|---|---|---|
| Account and R2 inventory | CONFIRMED | Authenticated R2 console: 6 buckets total. Relevant aggregate counts only retained. |
| `missionmed-videos` inventory | CONFIRMED | 1.37k objects / 30.03 GB. |
| Custom domain | CONFIRMED ACTIVE | `cdn.missionmedinstitute.com`; TLS 1.3. |
| Public development URL | CONFIRMED DISABLED | Bucket settings. |
| Read CORS | CONFIRMED | Wildcard origins for GET/HEAD and wildcard headers. |
| Write CORS | CONFIRMED | MissionMed origin PUT rule with a bounded header list. |
| Lifecycle/retention | CONFIRMED PARTIAL | Abort incomplete multipart uploads after 7 days; no deletion-retention rule observed. |
| Bucket lock and data-access logs | CONFIRMED ABSENT/OFF | No lock rule; data access logs disabled. |
| Stream availability and plan usage | CONFIRMED | 40 videos and 2028/4000 stored minutes in authenticated Stream UI. |
| Clip-by-range creates a distinct video UID | CONFIRMED CAPABILITY | Cloudflare Stream documentation/API. |
| Signed playback and allowed origins | CONFIRMED CAPABILITY | Cloudflare Stream documentation. |
| Signing keys currently configured | UNKNOWN | No account-native key-list readback was obtained. |
| Watermark profiles currently configured | UNKNOWN | No account-native watermark-list readback was obtained. |
| Per-video `requireSignedURLs` and `allowedOrigins` | UNKNOWN | No privacy-safe aggregate readback was obtained. |

005D proposal: keep R2 source objects private, create separately materialized Stream clip UIDs per authorized parent range, require signed playback, set explicit allowed origins, apply the approved watermark profile, and record revocation/retention. A separate launch Delivery Gateway is not required unless later evidence creates a separately authorized need.

Official references: [video clipping](https://developers.cloudflare.com/stream/edit-videos/video-clipping/), [clip API](https://developers.cloudflare.com/api/resources/stream/subresources/clip/), [secure Stream playback](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/), [signing keys API](https://developers.cloudflare.com/api/resources/stream/subresources/keys/), [watermarks API](https://developers.cloudflare.com/api/resources/stream/subresources/watermarks/), [applying watermarks](https://developers.cloudflare.com/stream/edit-videos/applying-watermarks/).

## CIE / Studio

| Item | Classification | Evidence |
|---|---|---|
| Hosted backend | CONFIRMED | Railway project/service and `https://cie-backend-production.up.railway.app`. |
| Health | CONFIRMED | `/api/health` returned 200, version 0.14.0, video index loaded, 40,207 segments, and zero entry/access counts; no content inspected. |
| Unified endpoints protected | CONFIRMED | `/api/unified` and `/api/unified/stats` returned 403 without credentials. |
| Hosted frontend | CONFIRMED | Frontend root returned 200. |
| HQ routing | CONFIRMED | Production `MMHQ_CIE_BASE` points to the hosted backend; absent Studio/upload overrides intentionally fall back to CIE in source. |
| Health metadata disclosure | CONFIRMED | Public health exposes an internal local database path. Path not retained here. |

Gate G-CIE: CLOSED for existence/routing/auth-negative-test. Recommended follow-up: remove the internal filesystem path from public health metadata.

## Supabase donors and security findings

| Project | Classification | Evidence |
|---|---|---|
| Coordination `brxqytrfdisrgakrxkhd` | CONFIRMED HEALTHY | Lease V2 registration/release and final zero active leases/waiters. |
| Growth Engine `plgndqcplokwiuimwhzh` | CONFIRMED UNSAFE CURRENT POSTURE | Eight media tables RLS disabled; broad anon/authenticated DML; critical advisor findings. |
| RankListIQ `fglyvdykwgbuivikqoah` | CONFIRMED UNSAFE RESOLVER POSTURE | SECURITY DEFINER resolver executable by PUBLIC/anon/authenticated. |
| Scheduler staging `avpdetdkpwmqqxtvomix` | CONFIRMED CONDITIONAL DONOR | 19 public tables have RLS, but broad table grants remain and policy correctness is essential. |
| CAM dev `tufzqxeucfugdovtjyqk` | CONFIRMED STRONGER DONOR | Target tables have RLS; anon CRUD denied; core service-only tables lack direct authenticated privileges. |

No Supabase schema, grant, policy, function, key, or row was changed by the provider-truth audit.
