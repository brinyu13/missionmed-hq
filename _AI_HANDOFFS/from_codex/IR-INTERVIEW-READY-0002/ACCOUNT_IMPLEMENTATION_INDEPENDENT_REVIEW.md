# Independent account implementation review

Verdict: **APPROVE WITH CONDITIONS — exact source implementation; production release remains HOLD pending live acceptance.** Reviewer `phase1_registration_contract_review` (Sol6.1 High), 2026-10-04. No confirmed source-level security blocker was found in the six-path commit `a7adc5eb4107dc26d3dce38cae7195ad8b9868f3`, based on admitted source HEAD `99e83447896c9450c2275b4e4dad2fbfaf16b31f`. This is independent acceptance of the bounded implementation, not builder self-approval or authority to install it.

Authority remains filed DR-375/376 at canonical OS `84754150b8c834ac25466860ab98600b5d5c1b9e`, the accepted Phase1 independent contract, and the exact source-worker admission. Public guide, free canonical WP accounts, self-only metadata, CAS/idempotency, privacy and no enrollment/identity/schema mutation remain binding. Foreman reported fresh mission-profile BOOT PASS and stopped the worker before this review's report commit. No new authority or transport exception is introduced.

## Exact custody and findings

The commit changes exactly the admitted six paths, 881 insertions and two deletions. Independent hashes matched both worker handoff and committed/worktree bytes:

| Path | SHA256 |
| --- | --- |
| `interview-ready/integration/missionmed-interview-ready.php` | `f32df31e1c20af86d4c6fe48ee380832dbc2dc6d60a107e58bb7bc11f7a20243` |
| `interview-ready/account.js` | `018a0e2f3706f2f5cbe64ddb8b8fb2cf2b07b640730c7b3211cbc4397b17518a` |
| `interview-ready/build.py` | `ab463c64dbe9fef819183508480a31769fae331b8a2b720c0aaef7f7bbf115ad` |
| `interview-ready/integration/gateway.test.php` | `ba23b7d6bdedce44a85db34d4a4411513d4cb4067dd63cbe67cbfc970b19cc90` |
| `interview-ready/qa-account.py` | `393fdd686a8670ce81373aca5d086f22886d0e1cfd010cde7e7a60ce6eeeaff6` |
| `interview-ready/evidence/account-worker-handoff.md` | `b6b758ded6de05e39f1dbfafe07e8e281fa3520bded22dca37c1ae9a7621327f` |

**No confirmed critical/high defect.** The server derives the owner from WP's authenticated session and checks REST nonce, same-origin proof, same-origin Fetch Metadata and a server-derived subject on every request. Query/route owner parameters reject. POST is bounded to 8KiB and exact typed state/command keys, canonical checklist/kit identifiers and unique kit values. Existing malformed/duplicate records are preserved with recovery failure. The subject is an identity/cache fence, not an access grant. The permission implementation also permits same-origin Referer plus Fetch Metadata when POST Origin is absent; nonce and server subject remain mandatory. This is scope-equivalent browser-origin proof, not cross-origin permission.

**Persistence fence accepted at source level.** POST acquires its server-UID advisory lock on the original mysqli handle, confirms connection ID and lock ownership, clears canonical metadata cache, rereads inside the lock, and uses unique first insert or previous-value user-meta CAS. Matching UUID/digest retries acknowledge the existing revision; changed payload or stale revision rejects. The temporary `wpdb` subclass reuses the original handle, overrides reconnect paths to fail, and checks the lock before inherited metadata queries. It restores the original global object in `finally`; release uses only the original handle. It neither edits core nor creates another database connection. Failed acknowledgement after a committed write remains ambiguous and is handled by identical-command retry, rather than falsely claiming rollback.

**Privacy and isolation accepted at source level.** Public HTML has no account context or private state; private HTML injects only subject, nonce and fixed self endpoint. HTML/API private and error paths apply no-store/cookie separation and remove generic credentialed CORS for this endpoint. Personal browser state remains memory-only, legacy anonymous progress is cleared rather than imported, hydration conceals personal surfaces, and subject/auth failures discard it. Pagehide/BFCache, visibility and focus revalidation prevent reuse of an unverified private view. Pending network edits remain explicit and memory-only; conflicts load authoritative state before user-directed reapplication. No personal media, free text, identity or course enrollment is persisted.

**Dedicated routing and asset boundary accepted.** Only exact public/app routes and exact same-origin IR login/registration returns are handled. Normal WP/WooCommerce account owners remain in control; no course is required by this gateway. Menu hooks append only on resolved term35/57 and do not write menu tables. Runtime lookup is fixed to the dedicated owner directory, requires a direct immutable digest release, rejects outward pointers/HTML symlinks, and checks actual HTML digest plus the unique context marker. Build changes preserve the original engine/catalog/approved assets and retain the release gate. This commit contains no Matrix addon; the separately qualified Matrix baseline is committed after worker stop and does not admit shared-shell edits.

## Independent focused verification

- PHP lint and Node syntax checks passed; `git diff <admitted-base> <exact-commit> --check` passed.
- Independent replay of `qa-account.py` passed 56 PHP assertions and 12 real-browser scenarios with intercepted synthetic HTTP ownership. This covers schema/auth rejection, lock and connection failures, CAS/retry, hydration/identity/BFCache concealment, explicit conflicts, unsaved labels, public account navigation and mobile/motion behavior. It does not exercise live WordPress, native database concurrency or a provider cache.
- Independent temporary asset replay passed: 19 approved assets included, 35 denied assets excluded, deterministic production/preview candidates, inline syntax and release BLOCKED as required. Production-media HTML is SHA256 `3d4313fb8b5c4850aa119e4760ab1cd7a48858087ced939ead3757cf8fdd65f1`, 1463667 bytes; preview SHA256 `ece5a1d0c0a4013cda1ed824cbe5f8508f0db9fe02b57863460e770a46ca4909`. These remain unapproved local candidates.

## Mandatory release conditions

These are material outstanding acceptance gates, not defects proven by the local fixtures:

1. **High — actual owner/driver/cache compatibility:** qualify the request-scoped property copy against deployed native WP/PHP8.2, existing metadata hooks/drop-ins and the actual object-cache backend. Verify two real independent MySQL connections racing first inserts and revisions, lock denial/timeout, query disconnect/reconnect suppression, idempotent lost-response retry, corrupt/duplicate preservation, and original-owner restoration. A mocked metadata API and reentrant fixture are not native concurrency proof. Concurrent GET/cache population must not let a stale cache bypass CAS or falsely certify acknowledgement.
2. **High — production private-response separation:** verify provider-specific HTML/API cache exclusions and actual browser nonce/Origin/Referer/Fetch Metadata acceptance, including error responses and logout/account changes. PHP headers alone do not prove CDN/provider exclusion. Prove A/B account and device isolation with native state readback, BFCache/session transitions, no-course login/free-registration return and persistence; exercise existing MR/admin/sibling behavior without granting enrollment.
3. **Required custody/recovery:** register the exact new owner/runtime manifest seam, qualify absent/new-path preimages, package committed gateway plus exact immutable HTML/manifest, independently accept those bytes and rollback, and obtain fresh scoped healthy runtime leases before installation. Rollback changes only the dedicated gateway/current pointer; preserve `_mmed_ir_state_v1`, identities, history, enrollment and sibling runtimes. Later Matrix work must satisfy DR-376's refreshed shared-byte/selection preservation gate separately.

Source approval is void on changed bytes, authority, owner/storage contract or unresolved runtime drift. Only this report, the provider-clear report and previously prepared Matrix baseline are committed by this reviewer; no product/provider/credential/OS change, deployment, push or merge occurred. Unrelated dirty scratch remains preserved.
