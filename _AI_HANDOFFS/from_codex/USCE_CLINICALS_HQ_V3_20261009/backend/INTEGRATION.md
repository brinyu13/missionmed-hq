# Clinicals V3 communications backend integration

Status: worker candidate only; not deployed, no production database mutation, no mail sent by this worker. Root owns server integration, canonical migration custody, sanctioned deployment and live acceptance.

## Files

- missionmed-hq/routes/usce-communications.mjs
- missionmed-hq/lib/usce-mail-sync.mjs
- missionmed-hq/lib/usce-mail-dispatch.mjs
- missionmed-hq/tests/usce-communications.test.mjs
- missionmed-hq/tests/usce-mail-sync.test.mjs
- CLI-generated migration: backend/migration/supabase/migrations/20261009090305_usce_v3_communications.sql

## Server admission and authorization

Import isUsceCommunicationsPath and handleUsceCommunicationsRoute from ./routes/usce-communications.mjs. Include isUsceCommunicationsPath(pathname) in isKnownUsceRoute. AFTER requireUsceUserSession succeeds, dispatch this route with {session,authHeaders,authorizedUsceAdmin:true}. Do not set this flag in an unauthenticated path. Existing WordPress authorization and mutation CSRF remain the authority. Gateway's existing /api/usce/admin/ prefix already admits these routes; no public webhook path is added.

Import startUsceMailWorker from ./lib/usce-mail-sync.mjs and invoke it once after server startup. It starts ONLY when MMHQ_USCE_GATEWAY_CHILD=1 and USCE_MAIL_SYNC_ENABLED=true. Personal notification dispatch additionally requires USCE_MAIL_NOTIFICATIONS_ENABLED=true. Keep both feature flags disabled/unset until reviewed migration, sender configuration and runtime are ready. Worker is one page per 30-second tick, with durable generation/lease fencing. Full baseline history is paginated, not capped and falsely called complete. Gmail watch/webhook configuration is not needed. Existing DWD readonly Clinicals credentials are reused.

Sender configuration names: USCE_POSTMARK_FROM_EMAIL and USCE_POSTMARK_REPLY_TO_EMAIL must resolve to the Founder-authorized Clinicals mailbox. Existing live/dry-run flags remain respected. No token values belong in source/evidence. No shared Postmark hook/domain change.

## Existing Offer transport hooks — Root only

Preserve existing prepareBoundPreview, approval, revision, idempotency, usce_claim_send and usce_finish_send behavior.

1. AFTER the existing live send claim and frozen sender checks, BEFORE provider network call: call public.usce_mail_prepare_offer({p_claim_id:state.id}) through existing private callOfferRpc. If it fails, keep the claim held and do not send.
2. Pass returned rfc_message_id to sendPostmarkEmail. Add Headers: [{Name: 'Message-ID', Value: rfcMessageId}] to the existing Postmark request. Header preservation must be verified on a controlled real receipt (Root reports sender probe evidence separately).
3. AFTER provider acceptance and successful existing usce_finish_send: call public.usce_mail_bind_offer({p_claim_id:state.id,p_provider_message_id:outcome.message_id}). It updates exactly the existing canonical communication row with frozen sender, full reviewed body, RFC identity and conversation identity. It does not insert a duplicate or alter Offer status/approval.
4. If bind fails, report provider submission plus history reconciliation required; never resend the message. Reconcile the existing provider claim first and repeat bind.
5. Add bind after existing provider reconciliation. Legacy claims without transport marker return offer_transport_not_instrumented: leave them unchanged. New ambiguous attempts have a marker persisted before their provider call, so reconciliation can bind correctly.

The new nullable usce_send_claims.mail_rfc_message_id is transport metadata only. Existing frozen payload, send claims, Offer state and approval engine remain authoritative. New public RPCs have explicit PUBLIC/anon/authenticated revocation and service_role-only grants.

## API

Base /api/usce/admin/communications.
GET /config returns sender {from_email,reply_to,ready}, sync_enabled. GET /status returns synchronization state.
GET root: folder=inbox|sent|drafts|unread|unassigned|all, optional intake_request_id and search; keyset pagination before+before_id. Returns max50 items newest first, counts {inbox,sent,drafts,unread,unassigned}, has_more, next_cursor or null, and sync state.
GET /messages/:id returns one full canonical message. GET /messages/:id/thread returns full student history from the SAME rows (or unassigned conversation), same keyset paging/newest-first order. body_text is null on list rows; full only on protected detail/thread.
POST /drafts accepts only id?, revision?, intake_request_id, reply_to_message_id?, subject and body_text. Recipient comes from the actual student; sender is fixed. Returns item and its revision.
POST /messages/:id/read; /assign {intake_request_id,revision}; /preview {}; /send {revision,preview_hash,idempotency_key,confirm_send:true}.
GET /dispatches exposes the oldest50 unresolved dispatches with has_more, can_retry and can_reconcile. POST /dispatches/:id/reconcile performs authenticated provider readback, never a send retry. POST /dispatches/:id/retry requires confirm_retry:true and database proof of non-acceptance; it uses a new fenced attempt ID, maximum3 attempts. A bound claimed/ambiguous dispatch cannot retry. An abandoned notification claim older than120 seconds with no bound sender/recipient is provably before provider submission and can safely retry. The operational inventory has no cursor yet: resolve older rows to reveal later issues when has_more=true.
Deep link ?conversation=UUID contains a canonical message ID. WordPress login/entry must preserve this parameter into the actual workspace and then open the protected thread. No bearer token in links.

Generic correspondence cannot carry a secure Offer URL around the existing Offer approval path. Templates remain presentation-level, populated only from verified records; no shared master-template mutation.

## Compatibility / privacy

Existing usce_comms old offer_id/thread_id foreign keys are untouched. V2 linkage remains intake_request_id and raw_json.offer_draft_id. Safe offer_draft_id is included in UI projection without raw_json.
The existing student-status summary RPC is minimally filtered to retain legacy rows and new sent/received messages. New draft/queued/ambiguous rows cannot appear as sent in student timelines. Its safe projection is unchanged.
Unread is workspace-local (read_at); Gmail mailbox labels are not mutated. Named or non-text attachment contents are not fetched or stored. Unnamed text bodies stored in Gmail attachmentId parts are retrieved only up to256000 bytes; oversized/unsupported body parts expose body_unavailable=true and require a Gmail handoff. A large body is limited to100000 characters with explicit body_truncated=true; UI must show an Open Gmail alternative rather than call it complete. Sync backfill completeness is separate from body completeness.
Automatic/bulk/list mail is retained but does not notify Phil; spam/trash/draft mailbox events are excluded. Historical baseline import sends no personal notifications. Baseline catchup safely notifies new messages even if they were first observed during import. Dedupe is based on provider message identity and one notification outbox key per canonical message.
Verified References/In-Reply-To plus matching recorded student address are required for automatic association. Email/name/subject similarity alone is never sufficient. Ambiguous and unmatched messages remain Unassigned until explicit administrative review.
Provider timeout, 5xx, unreadable success and process crash after claim remain held. There is no automatic reclaim/resend of a claimed or ambiguous attempt. Explicit proven-unsent failures can be reviewed and safely retried through the bounded retry route. Uncertain provider outcomes remain reconciliation-only; they are not falsely marked delivered. Malformed/unverified4xx and3xx replies are ambiguous, not misclassified as definitive rejection. A successful retry updates both canonical mail_state and legacy message_status so student summaries stay truthful.

## Validation

41 Node tests passed with provider calls mocked; no network sends. Covers sender/routing, revision binding, recipient stripping, authority gate, payload limits, private Offer-link separation, uncertain-send hold, idempotent retries, authenticated reconciliation, MIME text/attachment handling, baseline/cursor paging, recovery, failed persistence, worker isolation.
44 local PostgreSQL assertions passed on a synthetic fixture database: migration compilation, service-only RPC privileges, fenced concurrent claim denial, exact/conflicting/unassigned association, body preservation, backfill/history overlap, message and notification dedupe, reviewed assignment, draft revision and recipient, immutable send claims, ambiguity reconciliation, Offer instrumentation/binding, student-draft privacy and keyset pagination.
Evidence: DATABASE_TEST_RESULT.json and NODE_TEST_RESULT.txt. No API-only/local test establishes production loop acceptance. Root still needs live controlled Offer/send/reply/history/Phil notice/authenticated deep-link verification and independent review.

## Rollback

Disable worker flags before runtime rollback. Additive columns/control state and old rows remain. Do not destructively revert the migration or delete canonical messages to rollback UI/runtime. Held provider claims must remain held until exact readback. Preserve preimage runtime/CDN and source custody through Root's existing release path.
