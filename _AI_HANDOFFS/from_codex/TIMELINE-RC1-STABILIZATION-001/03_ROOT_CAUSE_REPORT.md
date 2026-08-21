# Timeline RC1 Root Cause Report

## Media and renderer

The browser adapter owned temporary `blob:` URLs but had no production durable-object lifecycle. Renderer hydration accepted a collection-level failure path, so one missing or invalid media reference could reject the complete render. The repair adds durable private object IDs, bounded object-URL ownership/revocation, per-item failure isolation, and visible omission warnings while preserving the protected presentation kernel.

## Excessive rendering

Ordinary persistence and route events could invoke broad `renderAll()`/preview paths even when the canonical presentation input had not changed. RC1 uses a stable presentation signature and scheduled/scoped preview updates. Presentation-changing edits still render; save-status-only events do not rebuild protected output.

## Session expiry

The production client held a short-lived JWT but did not proactively renew against its `exp` claim. RC1 schedules renewal 30 seconds before expiry, refreshes when the document becomes visible, retries one authenticated API request after a `401`, and locks on genuine revocation/account switching.

## Save-state ambiguity

The persistence adapter reported transport events but did not provide one deterministic status model. RC1 maps local commit, queue, remote acknowledgement, conflict, offline, no-consent, and terminal error into explicit states without weakening local-first durability.

## R2 canary failure

Credentials, bucket permissions, and direct SDK PUT were valid. The failing presigned request had custom integrity values hoisted into the query while `X-Amz-SignedHeaders` contained only `host`. Cloudflare R2 returned `SignatureDoesNotMatch`. Keeping checksum and metadata as unhoistable signed headers, and explicitly signing `content-type`, produced a successful `200` PUT with signed headers:

`content-length;content-type;host;x-amz-checksum-sha256;x-amz-meta-expected-sha256;x-amz-meta-object-class;x-amz-meta-object-id`

The production code now applies that exact signing policy and verifies length, MIME, checksum, object ID, class, and metadata again with `HEAD` before confirming custody.

## Administrator custody mismatch

The production entitlement correctly allows an approved administrator to open and use Timeline, but remote document ownership is intentionally student-scoped unless a separate resource grant exists. The browser nevertheless enabled remote sync for any identity with `remote_sync_allowed`, and the R2 object store admitted `PROGRAM_ADMIN`. PostgreSQL then enforced the real authority: `media_owner_write` permits active student owners only. The mismatch created a late database failure instead of an intentional device-local administrator workflow. RC1 now derives remote persistence from both role and consent, keeps approved-administrator saves/media in the principal-scoped IndexedDB cache, and denies direct administrator media signing before the repository is called. No RLS widening or new administrator ownership model was introduced.

## Production failure recovery 002 root cause

The first failing boundary was principal resolution after a valid WordPress consent and gateway exchange. D1-500 had manually seeded selected principals, but the eligible-360 rollout did not provision every eligible student. The API therefore rejected a valid eligible student with `TimelineProductionAuthError: Timeline identity is not provisioned`. The repair derives the deterministic principal from the immutable WordPress user ID, takes a per-user advisory transaction lock, switches only to `timeline_identity_sync`, inserts the active principal and `missionmed-360:3893` membership under narrow RLS policies, writes an auditable first-use event, restores `timeline_authenticated`, and re-reads the identity before commit. Ineligible users remain fail-closed and no frontend identity is trusted.

The first contextual-consent production attempt then failed at the form POST CSRF boundary. The replacement uses WordPress’s authenticated `admin-ajax.php` action with the same nonce and all prior policy checks. The browser submits `FormData` once, shows bounded progress, reloads only after JSON success, and retains a retryable inline failure state.

The final log warning was caused by `Promise.all` issuing three queries concurrently on one `pg` Client. The queries now run sequentially on that same client; using separate clients would have lost the transaction-local role, JWT claims, RLS state, and snapshot consistency.
