# Supabase CLI custody encoding diagnosis

Date: 2026-10-04. Assigned base: `ae2025b9a2610a74b3eb6d30fe08ea88f063c57d`. Reviewer: `/root/cli_custody_encoding`. Scope: source-only diagnosis, synthetic fixtures, this report-only local commit; stop after commit. No push.

## Verdict

**A keyring decoding step is missing from the helper.** The exact installed official Supabase CLI 2.75.0 uses `github.com/zalando/go-keyring v0.2.6`. Its macOS writer stores a prefixed Base64 envelope; its reader removes that envelope before the CLI validates the management token. `lease_transport.py` returns raw native password bytes as UTF-8 directly to `_token`, so a correctly stored CLI envelope fails the helper's token regex.

This is a proven source/fixture incompatibility and a plausible explanation for the supplied `AUTHENTICATION_STOP phase=keychain_supabase; error=management_format_unavailable; elapsed_seconds=4.763`, exit 1, following owner-interactive `supabase projects list` success. Those live observations were supplied by Foreman and were not repeated. The actual stored value was not inspected; this report does not prove its encoding, which custody source the successful CLI selected, invalid identity, permission failure, or provider authentication. The supplied failure is local format rejection before reveal, not evidence of Management API rejection.

## Exact installed release and primary sources

- `/opt/homebrew/bin/supabase` points to `/opt/homebrew/Cellar/supabase/2.75.0/bin/supabase`. Installed executable SHA256: `e4c3a5d90e4ebb1782459a50d5cedac2fc6512c9cdc228bf73d80deea34d3c43`.
- The [official v2.75.0 release](https://github.com/supabase/cli/releases/tag/v2.75.0) resolves to commit `e07c7ea15b842e9bb45c79518a5f20cea84fc753`. The [official Darwin ARM64 archive](https://github.com/supabase/cli/releases/download/v2.75.0/supabase_darwin_arm64.tar.gz) has SHA256 `6618736487287a9f0835c44a7101694deb4ca1192852a070a93014437641cea3`, matching the release API digest and installed Homebrew formula. Retrieved into memory only, its checksum passed and its executable was byte-for-byte equal to the installed executable. No extraction to disk, execution, installation or upgrade occurred.
- Installed executable build metadata identifies Go `1.25.5`, `GOOS=darwin`, `GOARCH=arm64`, `CGO_ENABLED=0`, and keyring dependency `v0.2.6`, module checksum `h1:r7Yc3+H+Ux0+M72zacZoItR3UDxeWfKTcabvkI8ua9s=`. Main-module metadata is `v1.226.6-0.20260202144646-e07c7ea15b84+dirty`, `vcs.modified=true`. Exact official-release equality resolves that marker: it is embedded in the released executable and does not establish a local binary modification.
- [CLI v2.75.0 go.mod, line 54](https://github.com/supabase/cli/blob/v2.75.0/go.mod#L54) pins keyring `v0.2.6`. [Credential store, lines 12–50](https://github.com/supabase/cli/blob/v2.75.0/internal/utils/credentials/store.go#L12) delegates Get/Set to that dependency under service `Supabase CLI`. [Profile source](https://github.com/supabase/cli/blob/v2.75.0/internal/utils/profile.go) defines production profile `supabase`.
- [go-keyring v0.2.6 macOS implementation, lines 31–67](https://github.com/zalando/go-keyring/blob/v0.2.6/keyring_darwin.go#L31) defines two literal envelope markers and Get decoding. [Lines 69–100](https://github.com/zalando/go-keyring/blob/v0.2.6/keyring_darwin.go#L69) show Set encoding and native storage. The [generic dispatcher](https://github.com/zalando/go-keyring/blob/v0.2.6/keyring.go#L33) invokes that platform reader; this is not a JSON container or an additional keychain dependency.
- [CLI access-token source, lines 15–54](https://github.com/supabase/cli/blob/v2.75.0/internal/utils/access_token.go#L15) validates the returned authentication value with `^sbp_(oauth_)?[a-f0-9]{40}$`. Helper pattern `sbp_(?:oauth_)?[a-f0-9]{40}\Z` plus ASCII `fullmatch` accepts the same complete ASCII strings. Capturing versus noncapturing groups do not change acceptance. The regex requires no change.

Pinned raw-source SHA256 values: CLI `go.mod` `edb5f3d01fe6b489e5aaa96a9d60cd6db15444c1c78932b0cae758405ecb36e0`; CLI `credentials/store.go` `bac6eccccdc0dbcb2189c1d6d2bd8b41395da2e443003cb8326f299d1384b4e0`; CLI `access_token.go` `9d4474fa4fe5047d3c7eccab87c0691b075c68df00838fcb4c07f72b4bad52de`; keyring `keyring_darwin.go` `0516b74c846627914d5a78dc92abaec122404a9fa461301ea68ab5f310439434`. Public source was read in memory. The public Supabase changelog index was also scanned; it did not supersede this pinned-version finding.

## Raw native bytes to authentication value

For a token `T`, the dependency's Set writes the text `go-keyring-base64:` followed by standard padded Base64 of the UTF-8 bytes of `T`. Native `SecItemCopyMatching` returns that stored data. The CLI dependency instead obtains the password through `/usr/bin/security find-generic-password`, then performs these transformations:

1. Apply Go `strings.TrimSpace` once to the outer stored text/output. It removes leading/trailing Unicode White_Space, including the command's output newline; it does not remove interior whitespace.
2. If the trimmed text begins with exact, case-sensitive `go-keyring-encoded:`, hex-decode the remaining suffix once. Accept either hex letter case, require even length and hex digits only. Any decoder error rejects the result; partial decoded output is unusable.
3. Else, if it begins with exact `go-keyring-base64:`, apply `base64.StdEncoding.DecodeString` once to the suffix. Use the standard `+/` alphabet and required `=` padding for incomplete final groups. Ignore CR/LF within the suffix, reject other interior whitespace, URL-safe alphabet, missing required padding, excess padding and trailing garbage. StdEncoding is non-Strict: unused padding bits need not be zero; do not add a canonical re-encoding equality check.
4. Else, return the trimmed plain text, preserving the dependency's legacy unwrapped-value behavior.
5. Validate the resulting string with the existing `_token`. Do not trim after decoding, recursively decode, parse JSON, repair padding, replace prefixes or accept partial decodes. Malformed recognized envelopes fail closed; do not retry them as plain tokens or advance to another custody slot.

Go 1.25.5 [TrimSpace](https://github.com/golang/go/blob/go1.25.5/src/strings/strings.go#L1090), [IsSpace](https://github.com/golang/go/blob/go1.25.5/src/unicode/graphic.go#L120), and [White_Space table](https://github.com/golang/go/blob/go1.25.5/src/unicode/tables.go#L8570) define the exact trim set: U+0009–000D, U+0020, U+0085, U+00A0, U+1680, U+2000–200A, U+2028–2029, U+202F, U+205F, U+3000. Python `str.strip()` without an explicit set also strips U+001C–001F, which Go does not; use the explicit set. U+FEFF is not whitespace here. [Go Base64 decoder](https://github.com/golang/go/blob/go1.25.5/src/encoding/base64/base64.go#L294) and [hex decoder](https://github.com/golang/go/blob/go1.25.5/src/encoding/hex/hex.go#L73) establish the error/padding rules.

The existing helper's strict UTF-8 handling can remain. A value that is not valid UTF-8 cannot be an accepted ASCII management token; Go's byte-preserving string conversion does not justify loosening helper validation. Decoder exceptions must become the existing constant `existing management credential format unavailable`, without the suffix, input, decoded value or native exception text.

## Narrow fix contract — not implemented here

Add a pure, bounded Get-equivalent container decoder only at `_read_keychain`'s successful raw UTF-8 return, before the caller's existing `_token` validation. Apply the transformation above to both already admitted keychain accounts through that one function. Preserve the native worker, exact service/accounts, authentication-UI prohibition, 10-second keychain ceiling, 60-second total bound, 256KiB cap, UTF-8 rejection, private pipes and value-free phase/kind output. Keep all decoder inputs/results in process memory.

Do not apply envelope decoding or trimming to the environment or exact token-file path: CLI reads those as direct values. Do not expand credential selection, lookup precedence or fallback on a selected malformed/denied value. The CLI itself advances on broader Get errors; that behavior is outside this separately reviewed helper's fail-closed custody contract and is not part of this fix. No token-format relaxation, endpoint/header/client/registrar changes, key creation/rotation, grants, profile discovery, CLI upgrade or new live attempt follows from this report.

## Synthetic reproduction and acceptance checks

Ran one in-memory Python fixture session with the unchanged helper compiled from its source bytes, an explicitly empty injected environment, synthetic `_private_worker` output, and a file-reader guard. No native worker, actual environment lookup, credential-file read, HTTPS request or provider operation ran. Synthetic token constructors were `"sbp_" + "0123456789" * 4` and the OAuth variant; no real credential or its shape was inspected.

**36 checks passed:**

- Existing helper with a fabricated standard Base64 envelope reproduced `phase=keychain_supabase`, `management_format_unavailable` (1 check). It stopped in that selected slot.
- Fixture-only proposed decoder plus unchanged `_token` accepted standard Base64, OAuth Base64, legacy lowercase/uppercase hex, plain token, outer Unicode whitespace around plain/enveloped values, and embedded CR/LF in Base64 (8).
- It rejected invalid Base64, missing/excess padding, interior payload space, URL-safe alphabet, odd/invalid/space-containing hex, nested envelopes, decoded leading/trailing whitespace/newline, JSON, unknown prefix, uppercase token, wrong length, empty envelope/plain values, NUL, U+001C outer text, BOM, invalid UTF-8 raw/decoded data (24). Every failure retained the selected keychain phase and constant format classification.
- Decoder-only synthetic `go-keyring-base64:Zh==` returned `f`, confirming non-Strict padding-bit compatibility (1).
- Direct synthetic environment token succeeded; an environment envelope failed without either custody reader being invoked (2).

For the implementation review, retain these fixture categories, assert both account paths use exactly one decoder invocation, and guard all real readers/network functions. Add fixture checks that environment/file values receive no decoding, malformed recognized envelopes never fall through, native worker deadline/size/error classifications remain unchanged, and no fixture input/value/native exception appears in public output. These are prospective implementation acceptance checks, not claims of live acceptance.

Reviewed helper SHA256: `995334b55423ce6c0dc571893f64fdfd699539a744df90afd046b9afbfa0604d`. No helper bytes changed.

## Authority and stop state

Foreman supplied refreshed universal BOOT PASS, unchanged remote OS main `1e8374664751ad911280d83d8c60e200a224245d`, HQ canonical `0feee579b0a9f2c90529220899f6cf6d21b8cd05`, and immutable MR079 SHA256 `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`. No repeat OS synchronization occurred. IR registration remains absent; protected work remains held. Previously admitted live read approvals are consumed. This diagnosis grants no fresh credential read, reveal, probe, registrar/lease invocation, publication or deployment authority.

Existing dirty `supabase/.temp/cli-latest` and untracked `_AI_INPUTS/` were preserved. Only this new report was written and committed. Next work is the separately assigned pure decoder implementation and fixture review; any real custody/authentication validation requires its own fresh admission. Stop after this report-only commit.
