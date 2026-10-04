# Existing-key metadata read admission

Verdict: **APPROVE ONE METADATA-ONLY ATTEMPT**, reviewed independently by `phase1_registration_contract_review` (Sol6.1 High), against product base `8a76f26e7704bf1b483a8da180debd8c441d9f02`. This is fresh, bounded admission; earlier read/probe approvals are consumed. It does not approve authentication, Registry acquisition or canonical staging, protected implementation, or release.

Exact reviewed inputs (SHA-256):

| Input in this handoff directory | SHA-256 |
| --- | --- |
| `inspect_existing_key_metadata.py` | `c38165dd2f765c669f0628d6dfc055afd5b7dc0c6e989a124457fd7a9f1676cf` |
| `inspect_existing_key_metadata_tests.py` | `f7f8c40e27f3154a428739cba3e1dfea276307be36f4e0d03b8a570a04895f38` |
| Unchanged `lease_transport.py` | `2f762bb056ab6febdb9df0671d0c6598c2338209ecd42d829d236bfff9207261` |

The preceding attempt stopped at `management_reveal / coordination_format_unavailable` after 1.070 seconds, before the health probe. `MANAGEMENT_KEY_REPRESENTATION_DIAGNOSIS.md` binds the official schema snapshot: `api_key` is optional and nullable, with no specified minimum length. Therefore that failure alone proves neither credential custody denial nor an invalid provider key. It supports this narrow representation diagnostic; it does not justify weakening the existing validator.

Static inspection confirms import and default invocation are inert. Only exact `--execute` admits the private pipeline. Existing identity lookup remains unchanged: the same process environment identity, exact no-UI Keychain slots with a 10-second budget and absence-only fallback, and exact existing token-file fallback. No UI permission acceptance or fallback after denial/timeout is admitted. The attempt has the existing shared 60-second deadline, 256-KiB bounded private pipes, TLS, no proxy, no redirects, and no retries. It permits exactly one fixed GET to `https://api.supabase.com/v1/projects/brxqytrfdisrgakrxkhd/api-keys?reveal=true`, with the existing identity and existing secret-read entitlement. It creates, rotates, grants, or updates nothing.

Selection requires exactly one record named `missionmed_lease_runtime_v5` with type `secret`; absent, multiple, malformed, duplicate-field, non-finite, oversized, and non-200 responses fail closed. Only the selected record's `api_key` representation is classified. Output uses fixed presence/null/type enums, coarse length buckets, prefix/ASCII/character-class/mask/placeholder/diversity booleans, and unchanged-validator flags. It emits no raw credential or response, substring, exact length, hash, record dump, unapproved field, or other record metadata. Exceptions produce only fixed allowlisted phase/error/elapsed output, or a constant failure. The helper releases private references on exit; no immutable-buffer zeroization is claimed.

Independent verification: all **11 focused mock tests passed**. Tests cover inert invocation, unique selection and schema failures, classification boundaries, private-error suppression, fixed output vocabulary, and one mocked GET with the shared deadline. No real environment credential, Keychain item, token file, or provider was read during this review.

Admission ends after this single invocation and its fixed metadata result. Any failure stops; there is no automated retry. A successful diagnostic exit means only that one matching record was classified, including when its key field is absent or null. Even `passes_unchanged_validation=true` is not authentication proof. No `_secret` acceptance, health probe, client/registrar activation, validation relaxation, approval JSON, or Registry write follows automatically. Any proposed continuation requires review of the actual fixed result and its concrete remaining condition. No new credential, grant, default-key fallback, or owner-permission failure is inferred from this metadata admission.

Only this review artifact is committed. Existing dirty packet/checkpoint, CLI scratch, and unrelated inputs are preserved; no push or merge is authorized here.
