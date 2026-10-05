# Independent fresh PUBLISHED resume admission observation
Verdict: APPROVE exact prior expiry retirement/provider absence and PUBLISHED preimages for a separately admitted INSTALL-only upgrade-resume. Reviewer /root/phase1_release_verifier, independent of current helper/wrapper/product builders and Foreman. No execution or release RPC occurred.

Frozen sourceHead956d99717a9fe46968dccf4b3d94cfa17d0955a4 (Root confirms canonical non-force push/readback), sourceCommit8717/packagea93 unchanged. Helper8ab2/plan80e8/review653761 and wrapper4aab/report8c714 independently hash-matched. AUTH remains blocked. This observation replaces no historical report/marker/control.

One fixed aggregate SELECT on brxqytrfdisrgakrxkhd at 2026-10-04 23:38:32.487986+00 / observedUnix1791157112.487986 returned exact prior claim c04b13d8-46bc-492c-8d23-081de278ea3f epoch4839, exactclaims1/released0/active0/expired-unreleased1, expiresUnix1791155296.586786; activeIR0/pendingIR0/activeMatrix0. Retirement=RETIRED_BY_EXPIRY, released=false, expired=true. No nonce/private row/key selected. Expiry never supplies released=true or remote completion.

The independent interruption report00f2 binds exact original claim/bindingcba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2 and original prepare-pointer marker. Its causal guard2NotDispatched qualification follows actual helper ordering/markerstart5148.155753 versus strict old-clear cutoff5147.551329, with stated nondecreasing-wall-clock condition and actual guarded fixture SSH Popen0. This report preserves that explicit meaning; it does not derive nondispatch from absence/timeout or rewrite UNCERTAIN.

```json
{
  "active_ir": 0,
  "active_matrix_shell": 0,
  "exact_active": 0,
  "exact_claims": 1,
  "exact_epoch": 4839,
  "exact_expired_unreleased": 1,
  "exact_expires_at": "2026-10-04 23:08:16.586786+00",
  "exact_lease_id": "c04b13d8-46bc-492c-8d23-081de278ea3f",
  "exact_released": 0,
  "observed_at": "2026-10-04 23:38:32.487986+00",
  "observed_unix": "1791157112.487986",
  "pending_ir": 0
}
```
```sql
SELECT now() AS observed_at, extract(epoch FROM now()) AS observed_unix, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND binding_sha256='cba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2') AS exact_claims, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND binding_sha256='cba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2' AND released_at IS NOT NULL) AS exact_released, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND binding_sha256='cba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2' AND released_at IS NULL AND expires_at>now()) AS exact_active, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND binding_sha256='cba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2' AND released_at IS NULL AND expires_at<=now()) AS exact_expired_unreleased, min(lease_id::text) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND binding_sha256='cba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2') AS exact_lease_id, min(fencing_epoch) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND binding_sha256='cba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2') AS exact_epoch, min(expires_at) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND session_id LIKE 'ir-phase1-install-20261004-%' AND binding_sha256='cba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2') AS exact_expires_at, count(*) FILTER (WHERE owner_id='codex-ir-phase1-foreman' AND released_at IS NULL AND expires_at>now()) AS active_ir, (SELECT count(*) FROM missionmed_ops.engineering_registry_waiters WHERE owner_id='codex-ir-phase1-foreman' AND granted_at IS NULL AND deadline_at>now()) AS pending_ir, count(*) FILTER (WHERE released_at IS NULL AND expires_at>now() AND 'MATRIX-SHELL'=ANY(shared_domains)) AS active_matrix_shell FROM missionmed_ops.engineering_resource_leases
```

One fixed read-only SSH metadata program, locally compiled against the actual helper sealed PUBLISHED dictionary, observed Unix1791157111.5962005. BatchMode/StrictHostKeyChecking/ConnectTimeout8, remote alarm8, receiving-time stdout128KiB/stderr4096 caps, total I/O10seconds+reap2seconds; no bootstrap/raw errors/private state/process inventory or mutation. Actual PUBLISHED4fd4af873d6ac04fc79e86907fd48a1dc0b048eac0480f0a4679b4e17410598d exact types/children/regular sizes/hashes/pointer literal PASS. Old current81dd remains, new temp/backup absent; both old/new archives/stages/metadata/immutable assets and15shared exact. New release exists but is not selected.

```json
{
  "layout": {
    "wp-content/mu-plugins/missionmed-interview-ready-runtime": {
      "children": [
        ".candidate-16f8f5795b1f54eb",
        ".candidate-a93cb2e0be061ca1",
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
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1": {
      "children": [
        "interview-ready-candidate.tar.gz",
        "payload"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/interview-ready-candidate.tar.gz": {
      "bytes": 1029472,
      "sha256": "a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload": {
      "children": [
        "release-manifest.json",
        "release-plan.json",
        "wp-content"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload/release-manifest.json": {
      "bytes": 5752,
      "sha256": "4d4d9977163180c748282f94446fe900f75b0d5df2fff7d247f99f24c5367f33",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload/release-plan.json": {
      "bytes": 1019,
      "sha256": "44ab7337ba0b82e350658bd14c07ae550985197b5fbdafcf4c7b18f179d4e037",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload/wp-content": {
      "children": [
        "mu-plugins"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload/wp-content/mu-plugins": {
      "children": [
        "missionmed-interview-ready-runtime",
        "missionmed-interview-ready.php"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload/wp-content/mu-plugins/missionmed-interview-ready-runtime": {
      "children": [
        "releases"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload/wp-content/mu-plugins/missionmed-interview-ready-runtime/releases": {
      "children": [],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-a93cb2e0be061ca1/payload/wp-content/mu-plugins/missionmed-interview-ready.php": {
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
        "158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e",
        "456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c"
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
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c": {
      "children": [
        "account-gate.html",
        "build-manifest.json",
        "interview-ready.html",
        "matrix-entry.js"
      ],
      "type": "directory"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/account-gate.html": {
      "bytes": 36683,
      "sha256": "da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/build-manifest.json": {
      "bytes": 3946,
      "sha256": "f142c8255a9cd93fbb8567cba3b323327fe3e8cd20491ece6565b7b2750c4ffe",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/interview-ready.html": {
      "bytes": 1464240,
      "sha256": "456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c",
      "type": "regular"
    },
    "wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/matrix-entry.js": {
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
  "layoutSha256": "4fd4af873d6ac04fc79e86907fd48a1dc0b048eac0480f0a4679b4e17410598d",
  "newFileBindings": {
    "buildManifest": "f142c8255a9cd93fbb8567cba3b323327fe3e8cd20491ece6565b7b2750c4ffe",
    "gate": "da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff",
    "gateway": "819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5",
    "html": "456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c",
    "matrix": "238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad",
    "package": "a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3"
  },
  "observedUnix": 1791157111.5962005,
  "oldFileBindings": {
    "buildManifest": "b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006",
    "gate": "da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff",
    "gateway": "819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5",
    "html": "158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e",
    "matrix": "238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad",
    "package": "16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa"
  },
  "pointers": {
    ".current-a93cb2e0be061ca1": {
      "type": "ABSENT"
    },
    ".previous-16f8f5795b1f54eb-to-a93cb2e0be061ca1": {
      "type": "ABSENT"
    },
    "current": {
      "bytes": 73,
      "literal": "releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e",
      "sha256": "81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e",
      "type": "symlink"
    }
  },
  "profile": "PUBLISHED",
  "result": "PASS",
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

Freshness must hold at new actual immutable initial READY: finite observedUnix<=READY.updatedUnix<observedUnix+300. Each operation still requires current own healthy unexpired same source/binding/fence/deadline/marker and exact remote custody. READY must not be rewritten to refresh history. This pre-acquisition zero-count record does not assert no active own lease after normal acquisition. No public/cache/grammar/browser/native/LIVE acceptance follows. Exact fields retirement/released/expired/guard2NotDispatched/priorClaimId/priorBindingSha256/expiresUnix/qualifiedPreimages remain bound to this hashed report and original causal report.

Only separately authorized new resume reports/controls/public-metadata spec are written; no provider DML/RPC/retrieval/acquisition/runtime/cache/native/bootstrap/source/HEAD/stage/commit. Original history untouched.
