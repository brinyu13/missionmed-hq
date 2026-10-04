# Independent render-fix INSTALL pre-admission refresh
Verdict: APPROVE for the exact prior INSTALL release/provider-clear and present old-pilot preimages observed below. Reviewer /root/phase1_release_verifier, independent of native/wrapper/helper/product builders and Foreman. This is a time-bound pre-admission observation, not acquisition, deployment, AUTH admission or LIVE acceptance.

Frozen local custody HEAD f47c6ee83d31776a97dccb3572216956efc65a1b; package sourceCommit8717ebd04ad1cd60e66ef197b55080d58492e2be/archivea93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3. Exact native containment8c714, product4f298 and helper c1d997 qualification reports remain applicable, with AUTH blocked. Source/package/helper bytes unchanged.

## Fresh independent provider facts
One fixed aggregate SELECT on project brxqytrfdisrgakrxkhd returned actual observation 2026-10-04 23:00:47.551329+00 / observedUnix 1791154847.551329. Counts are integers: own INSTALL claims2/released2; exact owner/source lease1f98d831-0a5e-42cc-a99a-18331f49ca10 epoch4813 claims1/released1/active0; activeIR0/pendingIR0/activeMatrix0/activeAUTH0. This establishes released=true for prior INSTALL, with no raw rows/nonces/keys selected. It is neither a global clearance nor future authorization.

```sql
SELECT now() AS observed_at, extract(epoch FROM now()) AS observed_unix, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%') AS install_claims, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND released_at IS NOT NULL) AS released_install_claims, count(*) FILTER (WHERE lease_id='1f98d831-0a5e-42cc-a99a-18331f49ca10'::uuid AND fencing_epoch=4813 AND owner_id='codex-ir-phase1-foreman') AS exact_source_claims, count(*) FILTER (WHERE lease_id='1f98d831-0a5e-42cc-a99a-18331f49ca10'::uuid AND fencing_epoch=4813 AND owner_id='codex-ir-phase1-foreman' AND released_at IS NOT NULL) AS exact_source_released, count(*) FILTER (WHERE lease_id='1f98d831-0a5e-42cc-a99a-18331f49ca10'::uuid AND fencing_epoch=4813 AND owner_id='codex-ir-phase1-foreman' AND released_at IS NULL AND expires_at>now()) AS exact_source_active, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND released_at IS NULL AND expires_at>now()) AS active_ir, (SELECT count(*) FROM missionmed_ops.engineering_registry_waiters WHERE owner_id='codex-ir-phase1-foreman' AND granted_at IS NULL AND deadline_at>now()) AS pending_ir, count(*) FILTER (WHERE released_at IS NULL AND expires_at>now() AND 'MATRIX-SHELL'=ANY(shared_domains)) AS active_matrix_shell, count(*) FILTER (WHERE released_at IS NULL AND expires_at>now() AND 'AUTH'=ANY(shared_domains)) AS active_auth FROM missionmed_ops.engineering_resource_leases
```

## Fresh fixed read-only runtime facts
One SSH request used fixed missionmed-kinsta/python3 stdin and webroot /www/theresidencyacademy_209/public. BatchMode/StrictHostKeyChecking and ConnectTimeout8; remote alarm8, local receiving-time stdout32768/stderr4096 caps, total I/O10seconds plus finite reap2seconds. No WP bootstrap, credentials, private state/history, cache or mutation. Only fixed owner/shared regular byte hashes, lengths/types, immediate child sets and the exact current symlink literal were examined. The safe observation was at observedUnix 1791154846.3314023.

The seven old bindings match OLD_BINDINGS; all15 pinned shared files match; layoutSha256 c07522fc030cf916529d5d58d44cd5f507b052a93c24f1ce572a8243c94427ac equals the SHA256 of canonical JSON of the measured exact OLD inventory. The dictionary below was returned only after every measured entry equaled its sealed expected record; it is a fresh readback, not a relabeled historical report. Current is still the exact73-byte relative old target with no LF. Runtime root/stage/releases are PRESENT; only the enumerated old temporary pointer is ABSENT. No newstage/newrelease/helper execution is inferred.

```json
{
  "layout": {
    "wp-content/mu-plugins/missionmed-interview-ready-runtime": {
      "children": [
        ".candidate-16f8f5795b1f54eb",
        "current",
        "releases"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb": {
      "children": [
        "interview-ready-candidate.tar.gz",
        "payload"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/interview-ready-candidate.tar.gz": {
      "bytes": 1029475,
      "sha256": "16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload": {
      "children": [
        "release-manifest.json",
        "release-plan.json",
        "wp-content"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/release-manifest.json": {
      "bytes": 5752,
      "sha256": "9c009a2192b00721fe41b0791f63678b7c7d9664f89627200a8d6234f1265f40",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/release-plan.json": {
      "bytes": 1019,
      "sha256": "d9e030122831401a895e9f415d35e06ea4c09a4b348c593dede5e191c8d822c2",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content": {
      "children": [
        "mu-plugins"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins": {
      "children": [
        "missionmed-interview-ready-runtime",
        "missionmed-interview-ready.php"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins/missionmed-interview-ready-runtime": {
      "children": [
        "releases"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins/missionmed-interview-ready-runtime/releases": {
      "children": [],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins/missionmed-interview-ready.php": {
      "bytes": 20727,
      "sha256": "819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.current-16f8f5795b1f54eb": {
      "type": "ABSENT"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/current": {
      "bytes": 73,
      "literal": "releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e",
      "sha256": "81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e",
      "type": "symlink"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases": {
      "children": [
        "158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e": {
      "children": [
        "account-gate.html",
        "build-manifest.json",
        "interview-ready.html",
        "matrix-entry.js"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/account-gate.html": {
      "bytes": 36683,
      "sha256": "da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/build-manifest.json": {
      "bytes": 3946,
      "sha256": "b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/interview-ready.html": {
      "bytes": 1464240,
      "sha256": "158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/matrix-entry.js": {
      "bytes": 2839,
      "sha256": "238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready.php": {
      "bytes": 20727,
      "sha256": "819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5",
      "type": "regular"
    }
  },
  "layoutSha256": "c07522fc030cf916529d5d58d44cd5f507b052a93c24f1ce572a8243c94427ac",
  "observedUnix": 1791154846.3314023,
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

Use the actual provider observation time for priorInstallProviderClear, phase=install, released=true, integer activeIR=0/pendingIR=0; age must be<300seconds at admission and every operation. Runtime facts use their distinct actual observation time. Freshness expires; control/report write time never refreshes observation. Source/provider/runtime drift or elapsed freshness stops. The corrected new package is prospective and not installed by this observation. No public-cache/served-JavaScript/browser/role/native/mobile/LIVE acceptance is supplied.

Write set in this pass is only the separately authorized INSTALL refresh/execution/read reports, two controls and the private temporary spec. No provider DML/RPC/lease/key/native/identity/runtime/cache/source/OS/HEAD/stage/commit operation. No automatic retry or stale report reuse.
