# Dormant post-install anonymous public QA helper

Prepared against source base 6f1c2c8c8b61226258e0038974f4ead25056a7c9. This helper reports endpoint facts, not final LIVE, native/auth behavior, or all-core acceptance. No network operation was executed by this builder.

Helper postinstall_public_qa.py SHA256 36a5cdef43f5cbb2d1f9a334704117d7b50d9c24feff94ed35fb3acc00efb465. Local source gateway pin 819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5; accepted full-reference archive pin 16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa; PREINSTALL_SHARED_BYTE_READBACK.json pin 10883816955c03507d8b5c25e40e2eeb00d255b0ac578a7aca8beef0d1b3d28a. These three actual local byte pins are checked before any network dispatch. A changed source/baseline/package stops.

Default invocation prints DORMANT and exits 0. --execute is prospective only, for Foreman after protected installation and separate review. No execution approval, lease acquisition, provider or SSH function is included. Fixed HTTPS origin https://missionmedinstitute.com; urllib/stdlib GET only; User-Agent MissionMed-NativeQA/1.0. No caller URL, authentication cookie/nonce, environment proxy, credential, redirect following or form submission. Each endpoint has socket timeout 12 seconds plus process SIGALRM wall deadline 12 seconds, response cap 2 MiB (read at most cap+1), identity encoding and no-cache request. This is a sequential finite set of thirteen requests, not a global twelve-second run deadline. HTTPError responses are examined as responses; redirects, timeout, transport, cap and validation surprises stop with constant classifications.

Gateway-derived checks:

- /interview-ready/: HTTP200 and exact accepted HTML after the single account-context marker becomes null. This establishes anonymous context absence for these exact response bytes. Public route does not require an invented no-store policy; safe observed cache booleans are reported.
- /interview-ready/app/: HTTP401, private/no-store/max-age=0/Vary Cookie, exact accepted account-gate HTML after entity normalization and the two fixed account/public guide URL substitutions. Both parsed links must match the gateway's same-origin return URL contract.
- /wp-json/missionmed-ir/v1/state: HTTP401, exact login-required error code/message/data status schema, private/no-store/max-age=0/Vary Cookie, no CORS allow-origin/credentials headers. GET is unauthenticated, so permission rejects before state retrieval. No JSON value is emitted.
- /: HTTP200 and at least one gateway-injected data-mmed-ir-nav anchor pointing to the public guide. This is parsed HTML discovery, not actual DOM/browser menu visibility or navigation acceptance.
- Nine cache-busted fixed public static paths from the pinned baseline: HTTP200 and exact corresponding SHA256. They establish these selected bytes only, not all core assets or all route behavior.

Output is a closed helper-produced schema containing fixed endpoint labels, HTTP status, body SHA256, byte counts, safe cache-policy booleans, selected source-derived booleans/counts and finalLiveAcceptance false. No body, raw HTML/JSON, Set-Cookie, arbitrary header value, link, cookie, nonce, key, credential or exception text is output. Requests hold response bytes only in process memory; no response/body files are created. On any surprise, the helper emits only STOP plus a constant classification and exits 1; preceding endpoint results are not emitted as a partial pass.

Local checks executed: compile PASS; pinned local expectations PASS (nine public baseline entries, package/public/gate within cap); --self-test reports six focused fixture checks PASS for positive/negative menu parsing, exact anonymous denial schema rejection, output/header redaction, exact-cap and cap+1 rejection, and timeout-handler classification. Default dormant invocation PASS exit0. These fixtures do not claim real transport timeout, runtime installation, production headers or network acceptance. No browser, native, auth, provider, SSH, runtime, broader test suite, stage or commit was performed.

Commands executed locally only:

    python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/postinstall_public_qa.py --self-test
    python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/postinstall_public_qa.py

STOP UNCOMMITTED. Only postinstall_public_qa.py and this handoff were written. Existing helpers, native/auth/tests, controls, product/package files and HEAD were untouched. Foreman owns separate review and any later execution.
