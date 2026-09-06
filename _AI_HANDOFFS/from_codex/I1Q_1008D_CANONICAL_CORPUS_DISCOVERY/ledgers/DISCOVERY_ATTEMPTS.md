# Discovery-attempt ledger

Abbreviations: content delivery network (CDN), Web Video Text Tracks (VTT), Cloudflare R2
object storage (R2), and MissionMed Headquarters/Content Intelligence Engine (HQ/CIE).

| Surface class | Method class | Result | Follow-up |
|---|---|---|---|
| Governing mission/passport/authority records | Local read-only | Current scope and safety rules established | Applied throughout |
| Full runtime registry | Two bounded GETs | 313 rows; byte/set stable | Used as current universe-candidate surface |
| Consumer projection | Two bounded GETs | 97 rows; byte/set stable | Classified as projection |
| Canonical CDN artifacts | Pinned HEAD then bounded GET | 196 available; 14 not found | Missing pairs routed to owner |
| Local runtime registry | Read-only local input | 303 rows; all live; 10 live-only | Classified lower authority |
| Local transcript store | Hash/count only | 286 transcript JSON; 87 Nodes JSON | No content retained |
| Question-named export | Hash/count only | 19 JSON, 2 VTT; 18 JSON overlaps | Not treated as extra universe |
| Historical master/index/database | Size/count/hash; immutable SQL | 509 sources; 40,197 entries/segments | Historical only |
| First-party consumer proxy | Read-only request | Redirected to HTML consumer surface | Not retried after shape mismatch |
| HQ health | Read-only request | Observed | No authority effect |
| HQ protected media inventory | Unauthenticated read | Denied | External scoped-auth blocker |
| In-app browser | View-only attempt | No session; API view blocked by client | No cookie/credential bypass |
| Supabase media/index | Documentation/code mapping | Owner project conflict | No direct query |
| R2 listing | Authority review | No mediated listing authority | Individual object checks completed only |
| Repository predecessor scan | Historical evidence review | Zero in-repository transcript candidates | Correctly bounded; not repeated as universe proof |

Every safe alternative was attempted or documented. Remaining work requires authority, not more unauthenticated probing.
