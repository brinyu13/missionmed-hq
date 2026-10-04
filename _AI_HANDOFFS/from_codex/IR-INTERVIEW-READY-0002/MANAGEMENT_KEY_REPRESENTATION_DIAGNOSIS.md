# Management key representation diagnosis

Date: 2026-10-04. Assigned base: `c9a25abc6cae287310a5ea5ff59aff5e5ea9d066`. Reviewer: `/root/cli_custody_encoding`. Scope: one bounded inspection of public primary sources and the helper; report-only local commit, no push, stop after commit.

## Verdict

**The exact rejection cause remains unresolved. No static response-decoding bug is established.** Foreman supplied the independently admitted corrected-helper result: `phase=management_reveal; error=coordination_format_unavailable; elapsed_seconds=1.070`, exit 1. Management-token decoding passed; the fixed Management GET returned HTTP 200; the helper uniquely selected the existing `name=missionmed_lease_runtime_v5`, `type=secret`, then `_secret` rejected its `api_key`. No health or lease request followed. This reviewer did not repeat that attempt or inspect the hidden response/value.

HTTP 200 establishes successful response transport for that supplied attempt. It does not establish a non-null revealed key, the specific failing predicate, secret-read permission, gateway acceptance, or invalid identity. The existing selection agrees with the documented array/object/name/type contract. There is no public evidence requiring keyring-style decoding, Base64 decoding, JSON extraction inside `api_key`, trimming, or another transformation of this API field.

## Public contract versus helper restrictions

- [Official GET reference](https://supabase.com/docs/reference/api/v1-get-project-api-keys): `GET /v1/projects/{ref}/api-keys`; optional `reveal` is a boolean **string** and `true` is accepted. The documented OAuth scope is `secrets:read`; fine-grained permission alternatives include key-read alone and key-read with secret-read. A 200 response alone does not identify which permission alternative the caller holds.
- The current official [OpenAPI snapshot](https://github.com/supabase/supabase/blob/cc31e2bd7493aee5cb3a0317805a072de8859a37/apps/docs/spec/api_v1_openapi.json), operation `v1-get-project-api-keys`, declares HTTP 200 as an array of `ApiKeyResponse_Output`. Its `name` is a required string; `type` is optional/nullable with enum `legacy`, `publishable`, `secret`, null. **`api_key` is an optional, nullable string**, with no pattern, minLength, maxLength, format or encoded-container specification. Only `name` is required. The public schema does not guarantee a populated `api_key` whenever `reveal=true` is requested.
- [Official API-key guide](https://supabase.com/docs/guides/getting-started/api-keys) identifies secret keys by `sb_secret_...` and describes new keys as short strings rather than JWTs. It does not specify a 32–128 character suffix, the helper's exact suffix alphabet, minimum distinct-character count, or banned substrings. Do not interpret documentation ellipses as a usable credential example or normalize an opaque value from that illustration.
- Helper `_select_existing_key` requires a list of objects and exactly one object with the approved name/type; it passes `matching[0].get('api_key')` to `_secret`. Missing and null fields both fail `_secret`'s string requirement. Strings must exactly match `sb_secret_[A-Za-z0-9_-]{32,128}` through end-of-string, then have at least four distinct suffix characters and exclude the case-insensitive substrings `redacted`, `masked`, `placeholder`, `unrevealed`. Whitespace, padding, punctuation, Unicode, wrong prefix/length, low diversity and those substrings all reach the same constant error.

The helper restrictions exceed the public schema. That is a static fact, **not proof that the hidden value violates a valid provider format**. The schema is intentionally broad enough to permit missing/null values; it also supplies no guarantee that arbitrary strings satisfying it are valid secret keys. Placeholder-word and diversity checks are local heuristics, not provider validity rules. Their theoretical false positives do not establish that either occurred here. Keep existing validation unchanged pending evidence.

Public docs source snapshot: `cc31e2bd7493aee5cb3a0317805a072de8859a37`; OpenAPI raw-byte SHA256 `07794504b6bba2d61bf088b4e093101b2054c7da9e46514ed5eff1be08adbb23`. Public source was read in memory; no provider response was read. Installed CLI and token decoder were not changed or re-audited.

## Minimal next diagnostic contract — requires fresh independent admission

Review exact diagnostic worker bytes before permitting **one** private GET to the same pinned endpoint:

`https://api.supabase.com/v1/projects/brxqytrfdisrgakrxkhd/api-keys?reveal=true`

Use the same approved management identity/custody path, fixed name/type selection, verified TLS, no redirects/proxies/retries, 60-second total deadline and 256KiB response bound. Do not change endpoint, token/key selection, provider permissions, headers or validator. A successful diagnostic ends after classifying the selected record; it must not return the key to another caller or proceed to health/RPC/registrar/lease work. Existing read approvals are consumed; this report does not authorize that GET or any fresh custody access needed for it.

The reviewed projection may emit only a fixed allowlist of value-free metadata for the exact matching record:

1. HTTP outcome and fixed response-schema classifications; approved match-count class `none`, `one`, `multiple`. No other record names, values, IDs, hashes, prefixes or field lists.
2. `api_key` presence/type class `absent`, `null`, `string`, `other`. For strings only, booleans for exact `sb_secret_` prefix and suffix alphabet membership; length buckets `below_32`, `32_to_128`, `above_128` after that exact prefix. A missing prefix gets `not_applicable`, not a guessed suffix. These buckets identify the existing length predicate without printing exact lengths or a credential shape.
3. Existing suffix diversity predicate `distinct_at_least_4` and existing placeholder-word predicate `placeholder_word_present`, as booleans only. Character-class metadata is limited to booleans for ASCII-only, whitespace/control presence, and conventional mask glyph presence; never emit an offending character, position, excerpt, substring or encoded value. A mask indicator is not proof the provider masked the key.
4. Fixed `_secret` rejection classifications, computed without changing its acceptance: `non_string`, `prefix`, `length`, `alphabet`, `diversity`, `placeholder_word`, or `passes_unchanged_validation`. Permit multiple booleans where predicates overlap; avoid implying that a single reported reason establishes provider validity.

Compute only these predicates on the one selected record in memory. Suppress raw body, credential, headers, response/exception repr, tracebacks, arbitrary field types/names and child stdout/stderr. Never write raw or decoded key/token values to files, environment, argv, chat or logs. Discard buffers and stop at the diagnostic result. A non-200 response, malformed/oversized response or nonunique match stops without retry, alternative selection or value classification. Test the projection first with fabricated records, including absent/null, malformed strings and each predicate failure; guard real custody/network readers and confirm output contains only the fixed allowlist.

If the field is absent/null, stop at the owner/provider representation or permission gate; do not label it a proven permission failure. If a string fails a predicate, use the metadata to request the exact corresponding public format contract or owner verification before proposing any validator change. If it passes unchanged validation, the prior failure remains unreconciled; do not silently continue to authentication. Metadata classification is not gateway validation and grants no product/lease authority.

## Preservation and stop

No actual environment/token-file/keychain/credential or provider read occurred; no new key/grant, health/RPC, helper change, validation weakening or fallback expansion occurred. Existing dirty checkpoint, registration request, CLI scratch and untracked `_AI_INPUTS/` were preserved. Only this new report was written and committed. Protected work remains held. Stop after this local report-only commit; no push.
