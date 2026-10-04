# Dormant native account QA runner handoff

2026-10-04. Builder `/root/phase1_native_qa_runner`, Sol6.1 High. **LOCAL PREPARATION ONLY. Native execution remains BLOCKED.** No SSH/HTTPS/provider call, fixture creation, runtime write, deployment, stage, commit, cleanup or HEAD mutation occurred. HEAD remained `0566cf093aaa0058632c7ca2b4e09c0ecef8b075`. Only the three assigned orchestration paths were written. Disk-capacity stop was honored; work resumed only after Foreman clearance. No temporary directories were created.

## Exact implementation

| File | SHA256 | Bytes |
| --- | --- | ---: |
| `native_account_qa.py` | `a6f94593ee60b3f01031954f1594eff0a9edbadb3109581e272e8a6e7ed8b6cf` | 31535 |
| `native_account_qa_tests.py` | `f26e1b6864cda582ac388de7c6ff1585d9e80adea58da02032638c330938e51e` | 12588 |

The accepted account six-file commit `a7adc5eb4107dc26d3dce38cae7195ad8b9868f3` and its independent implementation review are lineage, not native acceptance. Donor hashes are recorded in code only as lineage; a later integration must obtain its own exact independently reviewed source/package/admission hashes. No donor approval silently admits changed integration bytes.

## Local checks

`python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_account_qa_tests.py`: **11 tests PASS**. Fixtures remain in memory. Coverage: zero transport calls from dormant/blocked entry points; exact source/test/authority/package drift; fresh healthy/fenced/current/independent guard proof before each action; collision stop without modification; credentials only in private stdin; constant sanitized errors; normal WooCommerce login form and canonical app return; same-origin/path restrictions; request-only mail/WordPress HTTP suppression; private read-only callback/file-digest inventory; bounded QA lock and isolated connection-loss code. Local PHP `-l` accepted creation/lock/connection-loss snippets without executing WordPress. Python AST syntax passed for both files.

Default runner invocation returned `NO_RUNTIME_CALLS`. `--execute` returned exit2 / `FOREMAN_CONTROL_ADAPTER_NOT_ADMITTED`, as required. No native assertion is claimed from these fixtures.

## Required Foreman execution gates

The command-line entry point intentionally has no live adapter. Native execution requires the Foreman to import `execute_native(Gate(...))` inside a newly independently reviewed control artifact. Approval must bind the runner/tests bytes, independent approval report digest, exact control-adapter digest, final source and DR-375/376 preimages, immutable runtime package/gateway/HTML/current-pointer digest tuple, exact admitted action list, and independently qualified creation-hook inventory digest. No credentials or private account values belong in that artifact.

For EVERY read or mutation, `Gate.require(action)` rechecks local bytes and asks the reviewed adapter for actual current canonical STATUS/runtime readback. It requires the exact admission fingerprint/runtime tuple plus boolean healthy/fenced/current-binding/independent-admission and a monotonic proof age of at most two seconds. Missing adapter, drift, expired proof or unknown action stops. The adapter must serialize binding changes, maintain its canonical keeper for the whole run, and serialize/validate concurrent checks. The library does not retrieve coordinator credentials or claim a lease itself.

Foreman supplied the prospective native claim: after installation lease release, `SHARED:AUTH`, `shared_domains=[AUTH]`, API anchors `wp-includes/user.php`, `wp-includes/meta.php`, and `wp-content/mu-plugins/missionmed-interview-ready.php`. These are canonical API anchors only: **no core/gateway edits**. The adapter must bind the independently admitted claim and status schema; this report does not issue or acquire that claim. Exact final source/package/runtime and native execution approval remain mandatory. Dedicated-only Matrix guard and sibling bytes remain outside this runner.

Creation admission must qualify actual loaded callbacks, including `user_register`/metadata/role/filter effects, direct transports, external dispatch, provisioning and enrollment. `creation_inventory_read()` returns the complete loaded callback identifiers and callback source-file hashes only through a private pipe. Each single creation repeats that inventory in its own WordPress process and rejects a digest mismatch before `wp_insert_user`. Unknown or unqualified callbacks must BLOCK admission. Request-local `pre_wp_mail` and `pre_http_request` suppression do not prove the absence of direct curl/SQL or dynamic hook effects. Root must qualify the actual callback allowlist; no such inventory was fetched here.

## Prospective commands and bounded mutations

Local review commands above are repeatable. `python3 -B .../native_account_qa.py --execute` remains deliberately blocked. The reviewed in-process adapter, not an invented CLI flag or approval bypass, is the prospective native entry point.

Every PHP operation uses fixed argv, private SSH stdin and privately captured bounded output:

`ssh -T -o BatchMode=yes -o ConnectTimeout=10 missionmed-kinsta wp --path=/www/theresidencyacademy_209/public eval-file /dev/stdin`

Passwords never enter argv. Single bounded processes create exactly `mm_ir_phase1_qa_a_20261004` and `mm_ir_phase1_qa_b_20261004`, respectively `...@fictional.example`, through `wp_insert_user` with role `subscriber`. A collision stops; no existing identity is modified. Creation verifies exact role/email, absent IR metadata and no LearnDash enrollment through its canonical read API; missing API or nonempty enrollment stops and retains the newly created identity. No enrollment or course grant API is called.

HTTPS uses TLS, memory-only cookie jars, fixed same-origin route allowlists and normal `/my-account/` WooCommerce login forms/nonces with an actual return to `/interview-ready/app/`. No direct auth-cookie construction, frontend grant or identity bypass exists. Login/logout POST/GET and every self API POST are individually guarded. Native tests use actual gateway GET/POST, REST nonce/Origin/Fetch Metadata/subject, A/B isolation, CAS, first-insert/revision races via two separately logged HTTP sessions, identical-command discarded-acknowledgement retry, wrong nonce/cross origin/anonymous/query and body-owner rejection, logout/new-login persistence and canonical user-meta readback. State writes affect only new QA identities' `_mmed_ir_state_v1` via the existing gateway and canonical APIs.

The lock-denial diagnostic holds only a named QA user's `mmed_ir_v1:<server UID>` advisory lock on an isolated WP-CLI original mysqli handle for six seconds, while the separately authenticated HTTPS gateway must reject its valid POST with 503 and preserve revision. The lifecycle releases in `finally`, then a subsequent save verifies usability. Admission must cover the entire bounded acquire/hold/finally-release lifecycle with a healthy keeper. Lock denial establishes a real independent MySQL holder versus gateway connection; concurrent HTTP sessions alone do not expose their database connection IDs or prove overlap timing.

Optional separately admitted `native_connection_loss` closes only the isolated WP-CLI process's own QA-lock mysqli handle and tests the existing `MMed_IR_Locked_DB` query/reconnect guards. It writes no metadata, changes no core, and restores the owner object in `finally`. Its result is explicitly `ISOLATED_DRIVER_SEAM_ONLY`, never full HTTP POST disconnect/cache-hook proof.

## Privacy, recovery and acceptance limits

Credentials, cookie jars, nonce, subject, command and state remain in process memory/private pipes. No private child output or exception detail is printed; the native return value is a fixed aggregate report. No secret/env retrieval, file-based credential transfer or private-value logging is implemented. The calling adapter must catch `Stop` and report only its fixed category. Callback inventory is private and never included in the aggregate report. Credential references/cookie jars are discarded at function exit; Python memory clearing is not a cryptographic erasure claim.

On any failure the runner stops without automatic creation/auth/POST retries or cleanup. Partially created identities and existing QA metadata/history are retained. There is no delete, reset, reseed, restore, enrollment mutation, cache-wide purge, table/schema write, production credential operation or shared Matrix change. A process exit loses private credentials; a later run collides and stops. Recovery must preserve identity/history and requires a separately admitted plan, not password reset or deletion by this runner. Code rollback remains the dedicated gateway/pointer only under the separate release plan.

Visible browser journeys, real mobile/BFCache behavior, provider/CDN private cache separation, full HTTP disconnect and hook/cache-driver compatibility, corrupt/duplicate record preservation and admin/MR/sibling regression remain separate acceptance gates. This runner never deliberately corrupts native history. Existing 56 PHP fixtures cover mock failures; they are not recast as native proof. Discarding a received acknowledgement tests identical-command retry without claiming an actual lost network response. Final release stays conditional on independent adjudication of those limits and actual native evidence.

**STOP:** three-file preparation complete; uncommitted bytes await independent harness review. No native execution permission is inferred from this handoff.
