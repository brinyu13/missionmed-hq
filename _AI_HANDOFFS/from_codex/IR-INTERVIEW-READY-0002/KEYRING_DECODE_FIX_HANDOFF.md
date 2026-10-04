# Keyring envelope decode fix handoff

Date: 2026-10-04. Assigned and verified base HEAD: `0e08e083316cc560482c6587451c6e4d9cbde99b`. Scope: pure local decoder, fixture tests, this handoff; scoped commit only, no push.

## Result

Implemented the source-confirmed missing go-keyring v0.2.6 macOS Get envelope transformation described in `CLI_CUSTODY_ENCODING_DIAGNOSIS.md`. `_read_keychain` calls `_decode_keychain_value` exactly once after successful strict UTF-8 conversion. Both existing accounts use that call site. The caller's existing management-token regex remains unchanged and validates last.

The pure helper trims the exact Go Unicode White_Space set once, decodes the case-sensitive legacy hex or standard Base64 envelope once, and otherwise returns the trimmed plain legacy value. Base64 ignores CR/LF only, requires proper padding and the standard alphabet, rejects trailing garbage, and permits nonzero unused padding bits like Go's non-Strict StdEncoding. Hex accepts either letter case and requires complete byte pairs. Recognized malformed envelopes and invalid decoded UTF-8 raise the existing constant management-format error with suppressed exception context. Decoded values are never trimmed again or recursively decoded.

Environment and exact token-file values receive no decoding or trimming. Custody precedence, absence-only fallback, native worker, UI prohibition, 10-second native ceiling, total deadline, private pipes, read cap, endpoints, retries, wrapper and registrar remain unchanged. No actual environment, Keychain, credential file, provider, reveal, probe, wrapper or registrar operation was invoked. No authentication or live custody acceptance is claimed.

## Validation and exact bytes

`python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/lease_transport_tests.py`: **27 tests passed**, comprising all 21 existing tests and six focused decoder test methods. Fixture coverage includes Base64/OAuth, mixed-case hex, plain legacy values, exact Go whitespace, excluded Python-only whitespace/BOM, CR/LF, standard alphabet and non-Strict bits, empty envelopes followed by token rejection, malformed padding/alphabet/hex, invalid UTF-8, nested envelopes, decoded whitespace, unchanged regex rejection, both account paths with one decode, selected-slot stops, constant public errors, unchanged native deadlines/size classifications, and direct environment/file behavior. Focused tests guard real process launch, file opening and network operations and inject an empty environment. Existing tests retain their synthetic custody/network replacements. `git diff --check` passed.

- `lease_transport.py` SHA256: `2f762bb056ab6febdb9df0671d0c6598c2338209ecd42d829d236bfff9207261`.
- `lease_transport_tests.py` SHA256: `ca16a422c59356f5147a5f5ead87b88ca21f69422c29083edd9eb20e264bb235`.

The exact pinned source contract and source hashes remain in the read-only diagnosis report. This handoff does not repeat source/binary discovery or access a real credential.

## Authority and stop

Reused Foreman's fresh universal BOOT PASS and supplied OS main `1e8374664751ad911280d83d8c60e200a224245d`, HQ canonical `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; no OS sync or rediscovery. Protected IR registration remains held. Prior live-read admissions remain consumed; this patch grants no renewed custody/authentication admission. Exact-byte independent review remains required before any separately admitted live use.

Only `lease_transport.py`, `lease_transport_tests.py` and this new report are authorized writes/staging/commit paths. Pre-existing dirty `IR_PHASE1_EXECUTION_CHECKPOINT_2026-10-04.md`, `supabase/.temp/cli-latest`, and untracked `_AI_INPUTS/` are preserved outside the commit. Stop after the scoped local commit; no push.
