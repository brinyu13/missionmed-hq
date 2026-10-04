# Lease transport phase timing handoff

Date: 2026-10-04. Builder: `/root/lease_phase_timing`.
Base HEAD: `b91f0ad88676fc4246d542f060eecc7ab8e45c46`, verified before editing.
Scope: dormant local helper, fixture tests, wrapper failure report, this handoff.

The actual timeout stage/cause remains unproven. This is diagnostic instrumentation,
not a timeout repair or renewed credential approval. The previous single read/probe
admission is consumed; no real retry is authorized by these bytes or tests.

`PhaseError.public_status()` exposes only an allowlisted constant phase, constant
error classification, and monotonic elapsed seconds for the failing phase (not
absolute clock/deadline or overall wrapper duration). The two exact keychain
accounts have separate labels; exact existing file, management-token lookup,
management reveal and authentication probe have distinct labels. Nested custody
errors retain the innermost stage/timing. Deadline expiry uses a dedicated constant
class; known safe custody/format/denial/size distinctions use constant allowlisted
message comparisons without formatting caught exceptions. Unknown failures close
with a generic constant classification. Nonfinite/negative elapsed values sanitize
to zero. The wrapper reports only these fields; other transport errors have a
constant unknown-phase fallback.

Lookup precedence and confirmed-absence-only fallback, token/key names, pinned
endpoints, ten/sixty-second deadlines, caps, no UI/proxy/redirect/retry, private pipe
custody and canonical RPC adapter remain unchanged. Wrapper AST comparison against
base passes outside its authentication-failure print. The one-reveal/one-probe,
same-process retained key and independently gated registrar branch are unchanged.
No packet or canonical OS/client edit was made. Foreman must update packet source
hash binding and obtain independent exact-byte review before any separately admitted
new bounded credential attempt or normal registrar admission.

Validation: `python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/lease_transport_tests.py`
passes **21 tests** (17 existing, 4 focused). Added mocked fixtures cover six distinct
phase deadlines with deterministic 2.500-second duration, no private exception
formatting/credential or URL echo, safe known failure categories, and stdin closure
before private worker output collection. Syntax AST parsing and wrapper AST comparison
pass. All executable operations were fixture/mock-only: no real environment-token,
keychain or token-file read, provider call, subprocess worker launch, authenticated
wrapper invocation, registrar/lease/production/runtime operation. Builder tests do
not establish actual custody, network responsiveness, timeout cause or live success.

Exact source SHA-256:

| File | SHA-256 |
| --- | --- |
| `lease_transport.py` | `995334b55423ce6c0dc571893f64fdfd699539a744df90afd046b9afbfa0604d` |
| `lease_transport_tests.py` | `0c1d91cdda1a30aff883941cbcb2898d639d0daae8daa3af6bbf1165ac3132c5` |
| `run_authenticated_registration.py` | `46c3668665bdfcdc293d7ebfe9af16b75b1fa0b0eeb69dad6a0ce5a793d0f6a5` |

Read-only authority: BOOT plus `LEASE_TRANSPORT_TIMEOUT_DIAGNOSIS.md`,
`REGISTRY_AUTHENTICATION_STOP_REVIEW.md` and `PHASE1_INDEPENDENT_CONTRACT_REVIEW.md`.
Foreman supplied current universal boot PASS and canonical guardrail custody; IR
canonical registration remains absent. Pre-existing CLI scratch and `_AI_INPUTS/`
were preserved. Commit only the four assigned files locally; no push. Stop after
commit. No renewed credential or protected execution approval is claimed.
