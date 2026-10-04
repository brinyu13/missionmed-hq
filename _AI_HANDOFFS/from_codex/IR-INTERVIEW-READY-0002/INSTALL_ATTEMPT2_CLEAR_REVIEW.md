# Independent INSTALL attempt 2 clear review

Verdict: APPROVE WITH CONDITIONS — INSTALL-scope terminal release, actual installed bindings and selected shared-byte preservation PASS. This is not final LIVE/native/auth acceptance or a reusable global provider clearance.

Source frozen at 2db1f985e4678f8429af7b45969cde5729bd26d8. Reviewer performed only one safe aggregate SELECT and one fixed read-only SSH hash/type readback; no install execution, browser manipulation, WP bootstrap, credentials, state retrieval, cleanup, provider DML/RPC or runtime write.

## Exact attempt custody

RUNTIME_INSTALL_APPROVAL_ATTEMPT2.json SHA256 d988b97bb7f205c26eefad1657d6ffe1fdedc82b018340dfa7fcc915e1205730 was read; its spec equals contract.spec, and canonical contract SHA256 is 9c0c0c384385309e73c82b8afce42d2e61a5ab4b43affb59faa2d16678a3a924. Contract sourceHead matches the frozen source above. This review read the actual attempt2 approval, not the older RUNTIME_INSTALL_APPROVAL.json.

| Attempt2 control | SHA256 | Actual parsed fact |
| --- | --- | --- |
| RESULT.json | d7ce810c197ee676f2e481a617d55c5c40d26f43cd8d0edbcc4b77c76c9f842d | install; RELEASED; BOUNDED_PHASE_COMPLETE; nativeReport null |
| READY.json | 17f00991da62c62de22c0978b238a55a3cdc3d62c722393c86a54706a7fcb898 | READY; exact contract binding/sourceHead |
| STATUS.json | 65f6d49c893e1651c96551a4c63303b9e763d11d0f23a04be8b3c65b14bdfcf6 | STOP; same binding/sourceHead/fence |
| MANUAL_OPERATION.json | 5ddee3c93e979a7101b9c36d86e9630879609832f0c3a34b809cf1ed233348ab | schema ir.runtime_native.manual_operation.v1; operation readback; COMPLETE; same binding/fence |

The retained marker's public operationId is 3567385f-0a60-499f-9a2a-a552a094a878, startUnix1791151142.528568 and deadlineUnix1791151152.528568; fenceSha256 746a81c1bcc7de0db649e36970491dd2c37126df00e22e93ec268c2d93c7bc82 matches READY/STATUS. COMPLETE is an actual retained terminal record, not inferred from process kill. Foreman separately reports stage/extract/release/pointer/gateway/readback all PASS with sharedChecked15, DONE/STOP and runner81842 exit0. This reviewer independently verified final custody/state below rather than re-executing those operations.

## Independent provider observation

Fixed project brxqytrfdisrgakrxkhd, one SELECT using verified owner/session/domain columns, no raw provider claim/nonce/private JSON. At 2026-10-04 22:04:12.712192+00 (observedUnix1791151452.712192), aggregate facts were:

- install_claims2, released_install_claims2 under owner codex-ir-phase1-foreman/session prefix ir-phase1-install-20261004-%.
- active_ir0, pending_ir0, active_matrix_shell0.
- active_auth0 at this observation; the prior AUTH busy finding is historical, not silently rewritten.

Both own install claims are now released, including attempt2 under the established two-attempt history. This independently corroborates attempt2 local RELEASED. Count predicates are scoped, not a guarantee that every unrelated resource/provider is clear. These observations have no automatic validity beyond their time; downstream admission requiring age <300 seconds must recompute freshness and refresh if stale.

Exact query:

```sql
SELECT now() AS observed_at, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%') AS install_claims, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND released_at IS NOT NULL) AS released_install_claims, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND released_at IS NULL AND expires_at>now()) AS active_ir, count(*) FILTER (WHERE released_at IS NULL AND expires_at>now() AND 'MATRIX-SHELL'=ANY(shared_domains)) AS active_matrix_shell, count(*) FILTER (WHERE released_at IS NULL AND expires_at>now() AND 'AUTH'=ANY(shared_domains)) AS active_auth, (SELECT count(*) FROM missionmed_ops.engineering_registry_waiters WHERE owner_id='codex-ir-phase1-foreman' AND granted_at IS NULL AND deadline_at>now()) AS pending_ir FROM missionmed_ops.engineering_resource_leases
```

## Independent installed binding/shared readback

Fixed alias missionmed-kinsta, /www/theresidencyacademy_209/public, python3 stdin, BatchMode/StrictHostKeyChecking, connect ceiling8, remote alarm15 and local ceiling25 seconds. SHA256 read only, no WP bootstrap. Gateway and five other owned regular files reject symlinks along fixed ancestors; the only intentional symlink is current, whose exact literal is releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e (73 UTF-8 bytes, no LF). Immutable release is wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/<HTMLsha>. Package archive is retained at the owned .candidate-16f8f5795b1f54eb stage. All seven map values equal actual approval spec.runtimeBindings. Fifteen shared regular files match PREINSTALL_SHARED_BYTE_READBACK.json origin baseline byte hashes.

Exact safe readback observedUnix 1791151485.3231056:

```json
{
  "observedUnix": 1791151485.3231056,
  "result": "PASS",
  "runtimeBindings": {
    "buildManifest": "b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006",
    "gate": "da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff",
    "gateway": "819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5",
    "html": "158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e",
    "matrix": "238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad",
    "package": "16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa",
    "pointer": "81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e"
  },
  "shared": {
    "wp-content/mu-plugins/missionmed-matrix-interviewiq-entry.php": "94d1668e8c45cf9fb830c7c10f78151ba25c4adb23904bce0c166ad115767f7c",
    "wp-content/mu-plugins/missionmed-matrix-runtime-pin.php": "cf2251762f7e88357467a9225eae27e19fe67d7ad44311faecce63b506344a0e",
    "wp-content/mu-plugins/missionmed-performance-boost.php": "00a51063b4f56366568c96bf3bf276b441875d536c509099e05492d683808ba1",
    "wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2-art.js": "ac77de458b893d38c20c622099b5996b5cb464de0e74cc1868f91ca3dabaffaf",
    "wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js": "56dee16717478f9351cb038e6a0976c3f4fad71e522b092b552cff6754a66235",
    "wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css": "be5ade93749eb3fcd6d62cfcb3fa9c05278b07ef52fd53b84049a5faea68612d",
    "wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.js": "4fdcf13828e3eca0b5e6f7d3fae169e8aee0ab42589dfb01238675681ff6cbec",
    "wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.3f9f0152e8bfbc03.js": "3f9f0152e8bfbc034ae5ede0843fb756754daf3aa99f89ddc83124b4be263582",
    "wp-content/plugins/missionmed-hub/assets/student-os.16ca42c53ca2e890.js": "0b112c74e770e3b8decc2c7d8e6a6b73570647aa5f759a3a85cea68ec82f4201",
    "wp-content/plugins/missionmed-hub/assets/student-os.38507e1ac8a555ba.js": "38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a",
    "wp-content/plugins/missionmed-hub/assets/student-os.css": "707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260",
    "wp-content/plugins/missionmed-hub/includes/class-mmed-dashboard-experience.php": "63e9c2f8aa69681ae271c6630643df6fa2d791a07dd7c9a315561cdb14595e89",
    "wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php": "c7285a39f698101b9ec7a5e6c7fb6a535c08e1247e9cf02dc5dece8897b9c461",
    "wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php": "b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d",
    "wp-content/uploads/missionmed-interviewiq-discovery/iiq-1203-v1/matrix-v2-iiq-1203.js": "8d4b57a24132681f6d02fd8c072e3368246b9e5d4e56a3d68e8bbb12c5aba9ee"
  },
  "sharedChecked": 15
}
```

POSTINSTALL_SHARED_PUBLIC_20261004.json SHA256 3d6402b2f68cd14115f71ef342d2a6b08e264589050e7fdecebfee2eec351653 was read: observedUnix1791151397.993668, nine public hashes and baselineEqual true. It is Foreman's anonymous network evidence; this reviewer did not fetch those public assets again.

## Acceptance limits and stop

Foreman separately reports Root Chrome retained four original Matrix sources, inline addon1/sidebar IR1, public guide200, anonymous app401 and stateAPI401 with private headers. This reviewer did not independently inspect UI or those response headers. Public body/provider transformation and main anonymous menu0 remain unresolved; no native pilot, authenticated lifecycle, final LIVE, or all-core/browser PASS is granted.

INSTALL-scope clear only. New protected admission needs applicable fresh independent controls/provider observation and cannot reuse this attempt's released claim. Report age is measured from actual observation, not report write time. STOP UNCOMMITTED; only this report written, no HEAD/stage/commit changes.
