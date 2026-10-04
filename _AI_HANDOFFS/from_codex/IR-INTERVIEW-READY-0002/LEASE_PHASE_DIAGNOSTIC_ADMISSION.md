APPROVE — one new, separately admitted phase-instrumented diagnostic attempt using the exact bytes below. Approval is limited to existing-identity/key retrieval and one read-only authentication-health probe; it does not admit REGISTRY acquisition, canonical writes or protected implementation.

Independent reviewer: `/root/phase1_registration_contract_review`, Sol6.1 High. Date: 2026-10-04. Reviewed base `d695f1598eb7b72679541eeb79dba01def693c93`. Only this report is written. No real environment value, keychain item, token-file content, credential process or provider endpoint was accessed by this reviewer.

Exact SHA256 inputs independently confirmed:

| Input | SHA256 |
| --- | --- |
| `lease_transport.py` | `995334b55423ce6c0dc571893f64fdfd699539a744df90afd046b9afbfa0604d` |
| `run_authenticated_registration.py` | `46c3668665bdfcdc293d7ebfe9af16b75b1fa0b0eeb69dad6a0ce5a793d0f6a5` |
| `register_phase1.py` | `82cc46596206bd3f69caa75b442738647d446d26644a21f9dc6695974ea62a0f` |
| `lease_transport_tests.py` | `0c1d91cdda1a30aff883941cbcb2898d639d0daae8daa3af6bbf1165ac3132c5` |
| Locally updated `PHASE1_REGISTRATION_REQUEST.md` | `d86c7958b5ec8f9b5c1ca636a79ed554bde3c361d5e853c28befd595cd7576a3` |

The exact diff, wrapper, focused mock tests and `LEASE_PHASE_TIMING_HANDOFF.md` were inspected. All 21 fixture/mock tests independently passed in 0.008 seconds; wrapper AST is unchanged outside the transport-failure reporting handler. Fixture execution used fictional values and mocked credential/provider/subprocess seams only. It proves diagnostic behavior, not live custody, authentication or timeout cause.

The added diagnostic output consists solely of allowlisted phase/error labels and nonnegative finite monotonic elapsed seconds. Private exception text, credentials, paths, URLs, payloads, responses, absolute clocks and deadline values are not formatted. Nested failures retain the inner phase. Unknown failures emit a constant category. Existing fixed destinations, exact key selector, absence-only custody fallback, native no-UI behavior, private pipes, TLS/no redirects, output caps and deadlines are unchanged; no retry or default/other-key branch was added. The canonical RPC adapter and registrar bytes remain unchanged.

Permitted execution is one invocation of the exact private wrapper: existing CLI production identity lookup through only the previously admitted slots; at most one fixed reveal GET for the existing `missionmed_lease_runtime_v5`/`secret` key; then, only if retrieval succeeds, at most one fixed apikey-only REST-root health GET. Management lookup/reveal retains its 60-second total ceiling and each keychain worker its 10-second ceiling; the separate health probe retains its 60-second ceiling. Private response cap remains 256KiB. No key creation, rotation, other-key trial, grant, UI approval, store enumeration or provider/client reconfiguration is authorized. This is a new diagnostic admission under existing Founder registration scope, not reuse of the earlier consumed authorization.

Any failure stops the attempt. Record only its safe phase/error/elapsed output. Do not infer that `custody_requires_owner_action` proves a locked keychain or specific permission denial: it classifies a failed custody path, and several native/transport errors share that label. A phase-specific timeout identifies the failing stage, not its root cause. Further reads/probes or correction require concrete evidence and separate admission; no automatic repeat.

If authentication succeeds, retain the key only in the same private process while awaiting separate independent approval for normal REGISTRY admission. No `REGISTRY_ADMISSION_APPROVAL.json` or staged-approval JSON is created by this review. The wrapper refuses a pre-existing admission receipt; its waiting branch must remain gated. Success alone permits no registrar activation. Exact staged nine-file review, canonical custody/readback, fresh BOOT, healthy keeper/fence and release/provider-clear remain required. If the wait expires, exit without writing credential values or re-retrieving the key.

The earlier `REGISTRY_AUTHENTICATION_STOP_REVIEW.md` remains the historical HOLD on its failed attempt; this report does not claim that failure was repaired or revoke any stop. This admission is void if the hashed code/packet changes, scope widens, credentials leak or a new authority conflict appears. Scoped Git preflight passed; concurrent packet changes, CLI scratch and preserved `_AI_INPUTS/` were untouched. Commit this report only, then stop without push/merge.
