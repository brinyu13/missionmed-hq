# MR-WEB-0912 Zelle reactivation checkpoint - 2026-10-04

Status: IN PROGRESS. NOT DEPLOYED. NOT READY FOR A REAL TEST PAYMENT.
This is a resumable implementation checkpoint, not a launch verdict.

## Founder objective and scope

Read `/Users/brianb/.codex/attachments/2f3b3f88-b1bf-4d74-95e8-acff9f3bea88/goal-objective.md` in full. Restore automated authentic Chase-email reconciliation as primary, preserve secure administrator fallback, prove one real controlled lifecycle, independently accept, and preserve commerce/entitlements. Stop before the external Founder payment until a clean controlled order and every nonfinancial gate are ready.

The current Founder resumption restores the email-destination authority and renews the bounded DR-338 lifecycle task; it does not authorize unrelated work or synthetic financial acceptance. DR-247/338 and current BOOT/mission/passport gates remain controlling. A new source/runtime deployment must refresh authority/provider custody and recovery before mutation.

## Source custody

- Original worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`, branch `codex/mr-web-0912-interview-week`, HEAD `88f03e5f21c0c5f3601f4128ef6ae3db6669452d`. Its three dirty B handoff files and unrelated untracked artifacts were not edited, staged or committed.
- Preserved old matcher worktree: `/Users/brianb/.codex/worktrees/mr-zelle-verifier/mr-web-0912-interview-week`, clean at `ab78c6e571b192cb33f394db3910f92b81c465c6`. This is NOT a safe whole-service deployment base.
- New isolated worktree: `/Users/brianb/.codex/worktrees/mr-zelle-reactivation/mr-web-0912-interview-week`, branch `codex/mr-zelle-reactivation-1004`, based on currently observed HQ source `b745a31bc156158c8cc5c0de4d6bfc2a4811d98a`.
- Local edit scope now also includes `wp-content/mu-plugins/missionmed-mr-zelle-verifier.php`, exact new QR `wp-content/mu-plugins/missionmed-mr-0912-assets/media/missionmed-zelle-email-qr.gif`, and `missionmed-hq/tests/mr-zelle-verifier.test.php`. The WordPress file started as a hash-verified exact copy of the current live baseline below, then was modified locally; it is not deployed.
- Narrow provider PATH lease epoch 4589 held during this edit/test tranche; no GLOBAL or application database writes.

## Verified current production (read-only)

- Universal/MR-WEB-0912 BOOT PASS; canonical HQ tip used by dependency validator `0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- Kinsta MU verifier SHA256 `b4813d439bcf78f61ca362d77db61211abb6f90dce8931353f4999fe93d02e1d`; mode `admin_confirmation`. Rechecked after local tests; unchanged.
- Existing QR SHA256 `7e1f116daf0b0dd23b66db87073b5db2df77d049535603a9abb8a21545ad6b15` is the old temporary destination asset, not the new email QR.
- HQ Railway deployment `3f15a2bb-c639-4888-a2bd-ddcc9efe1b76`, service `3d18b017-4fc9-4b22-b097-ba879816d374`, project `29afe885-b9b1-425d-8fd8-8611cd275409`, environment `ed3353f7-bcc7-4e25-a000-3c9fc628a9a7`; SUCCESS at 2026-10-04T13:44:27.098Z, description `IVOC b745a31 device conversation-state fix-forward`.
- Railway image `sha256:916208aae87b80038cb625d0e64804789aefdfe51eb1b3df1a7c30c51f417a6f`; `/health` healthy. Actual matcher hash `57d2a6aa2f0861ad1b35d8902070e7fffca7bb51417fc0776f48b0e6c9a3763e`, equal to b745a31 source.
- Other IVOC source work is active on shared HQ; fresh deployment readback and three-way integration are mandatory before any Railway deployment. Never deploy a stale whole checkout over unrelated work.
- Fresh Woo readback: 5504 variable / 5867 variation parent5504, instock, $549 card, `_related_course=[3646]`; 3576 variable / 5865 variation parent3576, instock, current $3099, regular $3499 on variation, `_related_course=[5227]`. No prices/mappings changed. Actual Zelle totals and Matrix cascade still require this run's further verification.

## Current Chase recipient and QR evidence

Authenticated Chase settings visibly show Mission Global Group LLC with BOTH active email `info@missionmedinstitute.com` and tag `missionmed`, attached to the same bank account with no outstanding verification action. Restore email as primary; retain tag as secondary. No bank settings changed.

Exact inline GIF bytes were captured from the EMAIL QR in the bank's QR dialog, without re-encoding or editing:

- Temporary local custody: `/tmp/mr-zelle-evidence-mxKP6N/chase-email-qr.gif`
- 6383 bytes, 399 x 399 pixels
- SHA256 `5c7adbb1fde34302e4c15d4f7fbfaa6d1efb1c09c6e1b0510d70028d62b3a838`
- Native Vision decoder confirms Zelle's official enroll QR URL with payload name `Mission Global Group LLC`, token `info@missionmedinstitute.com`, action `payment`.
- Native toolchain default SDK was incompatible; Objective-C Vision decode succeeded using installed MacOSX15.4.sdk. No QR artwork altered.
- Browser download of a data-URL image timed out. A local receiver captured the exact bytes; Chrome blocked its response page but filesystem hash/decoder prove successful capture. Do not repeat the download or bypass the browser warning.
- Exact GIF copied into the scoped asset path above, byte-identical SHA256 verified. Do not use the old QR.

## Minimum payment evidence

Chase's current signed-in Zelle amount field rejected $0.01 with `Please tell us an amount of at least $1.00.` Entering $1.00 removed that amount error. No Next/Send action was taken; the unsent form was cancelled and Leave confirmed. This proves Chase's currently observed send-form minimum, not every possible sender bank's policy or a settled receipt. Intended controlled test amount is $1.00, subject to the actual sender's bank confirmation. No new order or financial transaction has been created in this resume.

## Genuine Gmail schema / authentication audit

The approved runtime DWD integration successfully read an existing genuine Chase received-money notification in the authorized info mailbox. No credential, full body or unrelated student record was saved. Observed schema includes `Amount $1000.00` (no comma), `Sent on <date>`, and `Transaction number <actual bank reference>`.

The first Gmail receiver `Authentication-Results` identifies `mx.google.com` and contains both Chase-domain DKIM pass and Chase-domain DMARC pass. Forwarder authentication also exists later in headers, so flattening headers with Object.fromEntries would lose provenance. The historical notification was addressed to the old missionresidency.com alias; it is schema evidence ONLY, never candidate financial evidence for a new order.

## Local matcher hardening completed

49 Node synthetic tests PASS, plus 26 PHP state-machine cases / 142 assertions and PHP syntax. NOT live financial acceptance. PHP test doubles model payment/entitlement events only; they do not establish the installed Woo/LearnDash/Matrix cascade.

- Require exact Chase sender/subject, first receiver-added Gmail authentication, Chase DKIM and DMARC passes, exact current To and Delivered-To mailbox.
- Require exact labeled amount, real transaction-number field, valid sent date, and bounded current-order timing. Support legitimate comma and no-comma dollar formats; reject rounding/overprecision.
- Stable transaction fingerprint excludes Gmail message ID/time so a duplicate notification cannot become a second financial identity.
- Require protocol v2, USD, and a single exact eligible order supplied by canonical Woo; sign all matching dimensions including consumed fingerprints. WordPress still needs to compute/recheck the complete candidate set under locking.
- Incomplete/paginated Gmail search, stale/future orders, provider failure and ambiguous payments fail closed to review/waiting.
- Case/whitespace normalization only; no fuzzy names or deleting accents/punctuation to collapse identities.
- Additional route tests prove method/body/HMAC timestamp/tamper/nonce-replay rejection before Gmail access. Conflicting genuine-looking receipts sharing one bank reference are held even if the conflicting amount would otherwise be filtered out.

## WordPress candidate / continuation 2026-10-04

Scoped source custody: epoch 4593 expired after interrupted keeper; handle was confirmed missing before reacquisition. New exact six-path lease epoch 4596 owns only verifier, QR, PHP test, matcher, Node test and this checkpoint. REGISTRY has no active writer. Active IVOC source work remains separate. Two read-only custody mistakes were diagnosed without mutation: the lease table lives in `missionmed_ops.engineering_resource_leases`, not `public.mmos_leases`; acquire scope requires `PATH:<digest>`, not bare `PATH`. Correct calls then succeeded; no validator weakened.

- BOOT revalidated PASS at the same canonical HQ tip. Live WP SHA remains `b4813d439bcf78f61ca362d77db61211abb6f90dce8931353f4999fe93d02e1d`, global mode still `admin_confirmation`. Runtime has both intl and mbstring for cross-language normalized names. Unrelated existing WP translation-load warnings observed, not modified.
- Candidate strictly validates current USD/customer/one-item/quantity/product+variation identity, canonical amount and pending state.
- Connection-owned MySQL advisory lock serializes claim/verification/approval. Permanent atomic transaction-fingerprint option is shared by both providers; no invented transaction ID is passed to Woo.
- Complete eligible-order scan includes matching unclaimed billing identities; incomplete scans and ambiguity fail closed. Protocol-v2 request signs all matching fields, validates trusted response, and rechecks pending/amount/uniqueness before canonical `payment_complete()`.
- Genuine verification metadata is recorded before completion, but `verified` is set only after canonical paid-state readback. Course result is observed, not directly granted.
- Secure admin fallback remains available without a Gmail candidate, requiring existing capability/nonce plus actual bank reference and bank-receipt attestation. Same receipt cannot be reused across providers/orders or after refund.
- Changed payer, ambiguity and administrator decisions hold automatic processing durably; duplicate requests or scheduled retries cannot clear that hold. Only authenticated bank-evidence fallback may complete the held order.
- Bounded retries, global admin default and exact admin-option-only canary preserve gradual deployment. Customer QR/email UI changes remain local; no prices, checkout architecture or public access changed.
- PHP cases cover both identities, claim-only containment, duplicates, automatic canonical-call/replay, fallback permissions/attestation/reference, cross-provider replay, pending/terminal states, cancellation during provider read, amount drift, outage/retry cap, lock loss, malformed proof, completion failure, order-key/owner access, and isolated canary. These are synthetic-only gates.

HTTP-handler negative tests now pass for customer wrong method/nonce/ownership and admin non-admin/GET/nonce/missing bank attestation. Actual installed LearnDash source confirms status-driven grant hooks, `_related_course` variation mapping, and `auto_complete_transaction` rejects unpaid orders and does not independently complete bacs orders. Current access-grant/deny settings, full Matrix cascade and actual customer proof still require runtime checks.

New verified HQ deployment during this tranche: `7c7ed32e-3725-43b5-9236-4b9c378e8ce0`, SUCCESS, 2026-10-04T14:41:42.839Z, description `IVOC mobile Room 4c732a3; retained rollback 686dd8a / 42225458; candidate-only`, image `sha256:aff633855fcdaa1a01e4a9483917367d4be41ae105bfb2ca1d0380d0709fc1f5`. Exact Git `4c732a3` differs from old base only in nine IVOC source/test/state files; matcher and Gmail integration/server seams remain old baseline. Preserve those IVOC changes when composing deployment. The 13:44 deployment above is now historical, NOT the current deploy target.

Next: finish real-hook compatibility/settings checks; integrate only scoped matcher delta onto the current HQ deployment lineage; obtain fresh native recovery and exact runtime/config preimages, then guarded deployment with public automation dormant and exact controlled canary. Do not request payment yet.

### Fresh read-only runtime evidence after candidate commit f888294

- Installed LearnDash settings: grant only `processing` and `completed`; deny `pending`, `on-hold`, `cancelled`, `refunded`, `failed`, `checkout-draft`.
- Current product readback: variation 5867 -> parent5504, card549, nonvirtual, course3646; variation5865 -> parent3576, card3099, nonvirtual, course5227. Thus canonical Woo completion may yield processing, which is an explicit allowed enrollment status; do not force completed or change virtual flags merely for testing.
- Matrix `MMED_Access_Gate` uses current LearnDash courses; enrolled course options [3646,5227,3893,3848], full-access programs [3893,5227]. Registered baseline apps exist independently of purchase. Prepayment acceptance must prove ZERO purchase-derived protected access, not incorrectly demand removal of baseline registered access. Existing enrolled access remains preserved.
- Matrix direct-route/REST guard calls that same resolver. LearnDash access change clears tier cache. No separate Matrix permission write is appropriate.
- Hub course-specific welcome templates for Complete/foundation are disabled historical placeholders. Do not activate stale Match Prep Pro/Masterclass templates. Inspect canonical Woo customer email/receipt and actual postpayment state during controlled acceptance rather than asserting those disabled templates send.
- MyKinsta Chrome tab 315031696 is at login; current session expired. Founder sign-in requested through an asynchronous question; tab marked handoff. Fresh provider-native recovery gate remains UNVERIFIED, so no production mutation permitted yet.
- Railway runtime read-only SSH session 84879 terminated with connection failure after polling; no remote command output/mutation. Latest deployment-list readback above remains valid for its time, but current runtime byte readback still needed before deployment. Do not treat this failed session as alive or restart a deployment.

Current next actions: wait for requested MyKinsta sign-in while completing remaining source/runtime checks; refresh Railway runtime access and current deploy lineage; obtain exact preimages, deploy reversible candidate, complete nonfinancial production QA and then prepare the one real-payment boundary. No new real controlled order exists yet.

## Critical remaining implementation (do not skip)

1. WordPress integration and HTTP-handler security are locally synthetic-tested as above, but actual installed Woo hook/settings compatibility, source review and production acceptance remain mandatory.
2. Live admin fallback still uses a per-request token; the candidate replaces it with a shared bank-reference fingerprint and removes the Gmail-candidate dependency. Deploy and verify that change without fabricating a payment or removing administrator review.
3. Preserve one canonical Woo payment_complete() cascade; do not directly grant LearnDash/Matrix. Verify actual integration and customer notifications. Do not label verified before canonical completion succeeds, and do not invent a transaction ID from a hash.
4. Capture fresh Kinsta native recovery and exact runtime/object/config preimages before production changes. Record canonical authority continuation/readback and fresh leases for the expanded exact paths.
5. Integrate current email/secondary tag/current QR and accessible responsive instructions; scan current active destination references without rewriting history.
6. Deploy behind reversible automatic gating; prepare only the sanctioned controlled test identity/order with unchanged public prices; verify no prepayment entitlement, request security, both product mappings, QR/copy/contrast at 1440/1024/430/390 and nonfinancial Stripe checkout.
7. Stop at ONE concise Founder-send boundary only when ready. After actual transfer, prove genuine receipt -> matcher -> Woo -> LearnDash/Matrix -> customer state, independent acceptance, cleanup, rollout, final state delta. Never report launch approval from these fixtures.

## State delta

Isolated matcher/WordPress candidate/tests/checkpoint and exact QR asset only, plus preserved temporary evidence/decoder files. Production code, config, orders, prices, payment state, entitlements, bank settings and customer communications unchanged by this tranche. Automation remains dormant behind live admin_confirmation. Goal remains active.
