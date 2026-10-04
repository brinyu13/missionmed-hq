# Opaque-key guard and status-only probe review

Verdict: **APPROVE ONE FRESH BOUNDED READ/PROBE ATTEMPT**, independently reviewed by `phase1_registration_contract_review` (Sol6.1 High), at product base `0313098b7e6022ea91041821bd6941fb7f36ac7e`. Earlier admissions are consumed. This admits the unchanged wrapper's native identity read, one fixed existing-key reveal GET, and one fixed read-only health GET. It does not admit Registry acquisition/staging, protected product work, or release.

Exact independently verified SHA-256 inputs:

| File in this handoff directory | SHA-256 |
| --- | --- |
| `lease_transport.py` | `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad` |
| `lease_transport_tests.py` | `b6ae9a554a34c6cc81232b7d1933ff59847f01ce0c602158bc360a2dab9e62a2` |
| Unchanged `run_authenticated_registration.py` | `46c3668665bdfcdc293d7ebfe9af16b75b1fa0b0eeb69dad6a0ce5a793d0f6a5` |
| Unchanged `register_phase1.py` | `82cc46596206bd3f69caa75b442738647d446d26644a21f9dc6695974ea62a0f` |

Read the value-free `KEY_METADATA_OBSERVATION_20261004.json`, source-bound `MANAGEMENT_KEY_REPRESENTATION_DIAGNOSIS.md`, final helper/test diff, implementation handoff, and updated packet. The admitted metadata result selected exactly the existing named secret and reported a string with the exact prefix, ASCII suffix alphabet, sufficient diversity, and no reported masks/placeholder words/whitespace/control characters. Its suffix bucket was below 32; length alone failed the former validator. This is shape evidence, not authentication proof. The pinned official OpenAPI schema has no `minLength`; the unsupported minimum is therefore not a provider validity requirement.

The exact diff changes only the suffix regex quantifier from `{32,128}` to `{1,128}` and the health worker's response handling. String-only acceptance, exact `sb_secret_` prefix, ASCII alphabet, maximum 128, diversity threshold, placeholder rejection, constant failures, unique fixed name/type selection, and all custody/transport guards remain intact. No trimming, decoding, normalization, alternative record selection, default key, or credential transformation was added. The new lower bound does not claim provider validity for arbitrary short strings.

Health mode now reads the actual HTTPS response status, emits that status privately, and closes the connection without reading the body, for both 200 and rejection statuses. This preserves the pre-existing status-based acceptance rule and avoids consuming an unnecessary REST-root schema. Exact host/path, GET method, apikey-only header, verified TLS, socket timeout, parent-enforced deadline, and no-redirect/no-proxy behavior remain unchanged. Management reveal still reads bounded JSON under its existing 256-KiB cap. Canonical lease RPC payloads, full response validation, fencing, keeper, and six-URL adapter are unchanged and remain outside this attempt's authority. HTTP 200 is the bounded health result; it is not proof of successful lease RPCs or their authorization.

Independent focused verification: **30 mock tests passed**. Added coverage confirms fabricated short suffix acceptance, retained negative guards and constant errors, and 200/401 health status output with zero body reads, connection closure, and exact endpoint/TLS/header behavior. No actual credential environment, Keychain item, token file, or provider was read in this review.

Admission conditions: execute only these exact bytes once; retain the existing identity precedence and key name `missionmed_lease_runtime_v5` / type `secret`, coordination project `brxqytrfdisrgakrxkhd`, native 10-second no-UI Keychain budget, 60-second retrieval deadline and separate 60-second probe deadline, private bounded memory/pipes, and value-free errors. Fallback remains permitted only after confirmed custody-slot absence, never after denial, invalid selected data, or timeout. No retry, UI grant acceptance, CLI upgrade, new key/token/grant, rotation, provider mutation, OS edit, or broadened endpoint is admitted. Any failure stops.

On success, the unchanged wrapper may retain the same key only in its private process while awaiting separately reviewed normal Registry admission; its existing 600-second wait remains bounded. No `REGISTRY_ADMISSION_APPROVAL.json` is supplied by this review. Do not start the registrar or acquire a lease without that separate exact-source admission. Product persistence remains the accepted WordPress user metadata contract; Supabase remains coordination only.

Only this report is committed locally. Existing dirty packet/checkpoint, CLI scratch, and unrelated inputs are preserved. Stop after the report commit; no push or merge.
