# Timeline RC1 Production Defect Report

| Severity | Defect | Reproduction/result | RC1 status |
|---|---|---|---|
| P0 | Preview could fail after media upload | A media hydration failure could reach the protected renderer as an unrecoverable aggregate failure. | Fixed and regression-tested fail-soft. |
| P0 | Temporary `blob:` references could survive in working state | Local uploads used object URLs for preview and lacked a production durable-object handoff. | Fixed: browser object URLs are transient; persistent remote state uses opaque durable object IDs. |
| P0 | One failed media item could suppress the timeline | Media resolution was not isolated per item. | Fixed: invalid/unavailable media is omitted with `MEDIA_OMITTED:<path>` while valid events/media remain. |
| P1 | Home and Builder previews rebuilt after ordinary state events | Preview invalidation was broader than presentation-changing state. | Fixed: render signatures and scoped scheduling avoid unchanged presentation rebuilds. |
| P1 | Initial payload and preview readiness were slow | The release shipped an unnecessarily large unminified production bundle. | Fixed: production minification reduced the final raw bundle to 1,189,312 bytes and gzip to 463,643 bytes. |
| P1 | Session became read-only during ordinary work | Token refresh was not scheduled against expiry and did not recover on visibility change. | Fixed: refresh is scheduled 30 seconds before expiry, renewed on visibility, and account-switch/revocation still fail closed. |
| P1 | Save/autosave/version state was difficult to distinguish | Local durability and cloud acknowledgement were collapsed into less precise states. | Fixed: `LOCAL_SAVED`, `SYNC_PENDING`, `SYNCING`, `SYNCED`, `CONFLICT`, `ERROR`, `OFFLINE`, and `LOCAL_ONLY`. |
| P0 found during canary | R2 signed PUT returned `403 SignatureDoesNotMatch` | AWS SDK hoisted integrity metadata/checksum into the query string; R2 rejected that signature form. | Fixed in `f4e9b09`; exact production upload/download/delete canary passed. |
| Operational | First Railway upload used repository-root `railway.json` | Health returned an HQ-shaped 404 rather than Timeline health. | Automatically rolled back to the accepted API, verified, then redeployed with `--path-as-root`. |
| Operational | Provider UI exposed the first staged R2 credentials during inspection | The dashboard unexpectedly unmasked values. | Credentials were treated as compromised, replaced, old token revoked before production use, and values excluded from evidence. |
| P1 found by independent verification | Approved administrators could enter an impossible remote-media path | Client/store admitted `PROGRAM_ADMIN`, but domain document creation and `media_owner_write` RLS are student-only. The first database custody insert would fail. | Fixed in `e685e94`: administrator authoring/media remains durable on-device, remote sync is not queued, and server media signing rejects admin before any custody write. |

No remaining verified P0 or P1 Timeline production defect is open. Separate native Safari, Edge, and Firefox production automation is a follow-up verification improvement, not evidence of a current defect.
