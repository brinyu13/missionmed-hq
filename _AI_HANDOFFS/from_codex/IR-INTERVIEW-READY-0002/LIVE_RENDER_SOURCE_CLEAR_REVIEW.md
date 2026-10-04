# Independent live-render source release and PRESENT pilot custody

Verdict: APPROVE WITH CONDITIONS for exact source lease release and observed old installed pilot preimages; no upgrade/runtime/native/cache admission is granted. Current local source HEAD independently matched 8717ebd04ad1cd60e66ef197b55080d58492e2be. OS custody is Foreman's qualified bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2; this review did not re-run broad OS preflight.

## Terminal source lease evidence

Exact binding 154bae1c4cf8b974656b761ddcd85d2b32f9ec130899d33ca38ff05032119f40, lease 1f98d831-0a5e-42cc-a99a-18331f49ca10, epoch 4813; owner codex-ir-phase1-foreman. Safe fields only were parsed, no raw nonce/key was selected or output.

| SOURCE_LIVE_RENDER_REPAIR_LEASE_20261004_1 receipt | SHA256 | Actual safe fact |
| --- | --- | --- |
| SOURCE_LEASE_READY.json | c3e9ade5e57925205fa25a6743af2798fe28bc54c73853effe6a521b4ad2acb6 | renewed READY; original admitted custody HEAD 8348dc35beffa11cdb2796b7c58fcc68a7355c1b |
| SOURCE_LEASE_STATUS.json | 6a8cee5be94449fb21768e710579b3a161a8e62057b489b0ff2060a014ed704a | STOP/DONE, same binding/lease/epoch |
| SOURCE_LEASE_RESULT.json | 80797af23f27ac4b8c0ca06ee14a651a511dc003b5cfe51664babd175c0d1764 | outcome DONE; release RELEASED; diagnostics[] |
| SOURCE_LEASE_STOP.json | fe2af8b4d62a5e8dfe6ded52b53ac03ce5dd166383d569229e973d1374054953 | exact owned DONE instruction |

READY/STATUS approve BASE 2db1f985e4678f8429af7b45969cde5729bd26d8, exact three repair paths and packet a59585b87eb4119bdf848de69080c6c949d0449e4be1c3f0d323e80e2760a79f. Source now 8717 is subsequent local committed repair custody, not automatically a new execution contract or installed payload. Foreman reports actual runner exited 0 SOURCE_LEASE_RELEASED after DONE; this reviewer did not execute it.

## Independent provider observation

One fixed project brxqytrfdisrgakrxkhd aggregate SELECT observed 2026-10-04 22:34:03.389627+00 (observedUnix 1791153243.389627): exact_source_claims1/exact_source_released1/exact_source_active0; active_ir0/pending_ir0; active_matrix_shell0/active_auth0. Exact claim owner/UUID/epoch predicates establish actual release independently of local receipts. No unrelated raw rows, nonce/private JSON, credential, RPC/DML or acquisition was accessed.

```sql
SELECT now() AS observed_at, count(*) FILTER (WHERE lease_id='1f98d831-0a5e-42cc-a99a-18331f49ca10'::uuid AND fencing_epoch=4813 AND owner_id='codex-ir-phase1-foreman') AS exact_source_claims, count(*) FILTER (WHERE lease_id='1f98d831-0a5e-42cc-a99a-18331f49ca10'::uuid AND fencing_epoch=4813 AND owner_id='codex-ir-phase1-foreman' AND released_at IS NOT NULL) AS exact_source_released, count(*) FILTER (WHERE lease_id='1f98d831-0a5e-42cc-a99a-18331f49ca10'::uuid AND fencing_epoch=4813 AND released_at IS NULL AND expires_at>now()) AS exact_source_active, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND released_at IS NULL AND expires_at>now()) AS active_ir, (SELECT count(*) FROM missionmed_ops.engineering_registry_waiters WHERE owner_id='codex-ir-phase1-foreman' AND granted_at IS NULL AND deadline_at>now()) AS pending_ir, count(*) FILTER (WHERE released_at IS NULL AND expires_at>now() AND 'MATRIX-SHELL'=ANY(shared_domains)) AS active_matrix_shell, count(*) FILTER (WHERE released_at IS NULL AND expires_at>now() AND 'AUTH'=ANY(shared_domains)) AS active_auth FROM missionmed_ops.engineering_resource_leases
```

Provider freshness is calculated from 1791153243.389627, not report creation; downstream <300-second contracts require refresh once stale. Counts are scoped, time-specific observations, not global or permanent clearance.

## Independently observed PRESENT old pilot

One fixed no-bootstrap read-only SSH query used missionmed-kinsta and /www/theresidencyacademy_209/public. Fixed old seven bindings came from actual INSTALL attempt2 spec; fifteen known shared hashes came from the fixed preinstall baseline. It read hashes/type/size and immediate child names only for enumerated dedicated owner paths. No broad filesystem recursion, user state/history, wp-config/options, bootstrap or credential was read. SSH timeout25/remote alarm15/connect8; no remote mutation.

ObservedUnix 1791153287.15858. Gateway remains regular old 819dd7, immutable HTML remains 158080, Matrix/gate/build-manifest/archive remain old exact bytes, and current remains the 73-byte relative literal releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e with no LF. Its SHA256 is 81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e. Runtime root/releases/old release/stage are directories, not ABSENT preimages; gateway is regular, current intentionally symlink. Old stage 16f8 is retained with archive/metadata/staged gateway and empty former payload releases directory after publication. Old .current-16f8f5795b1f54eb temporary is lexically ABSENT.

layoutSha256 c07522fc030cf916529d5d58d44cd5f507b052a93c24f1ce572a8243c94427ac is SHA256 of UTF-8 canonical JSON of the exact layout dictionary only (sort_keys true, separators comma/colon, allow_nan false), excluding observedUnix and provider data. It binds the enumerated types, immediate-directory child names, regular sizes/hashes and exact symlink literal/bytes/hash. It is a structural custody digest, not a generic recursive directory hash or replacement permission. Present upgrade preimages must name these types and old pointer literally; never use initial three-ABSENT install preimages. Any later additions/pointer/type/byte drift require fresh qualification.

Safe exact readback:

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
  "observedUnix": 1791153287.15858,
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

All 15 selected shared byte hashes PASS. Runtime directory lists only oldstage 16f8, current and releases; releases contains only old 158080. Therefore the newly committed source 8717/candidate a93cb... is NOT the installed release observed here; no newstage/release adoption is asserted. Actual corrected served JavaScript/browser behavior requires later independent admission/verification and remains outside this custody check.

STOP UNCOMMITTED. Only this report written; no provider DML/acquisition, credential/secret/native/runtime/cache/source/OS/Git mutation, cleanup, stage or commit. Matrix High owns the separately admitted PRESENT pointer-upgrade helper; this reviewer performs no helper edits.
