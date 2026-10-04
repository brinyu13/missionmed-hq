# IR local lease transport candidate — exact implementation handoff

Date: 2026-10-04. Builder: `/root/lease_transport_implementation`, Sol6.1 High.
Assigned base: `0579e8bbaaa0dcfc8d38fafc71081f9d5d31c34a`. The independent
prospective reveal addendum advanced the same branch to
`1f23afb3ed8f9504936cb575d704491bff9092a9` before edits. Branch:
`codex/ir-interview-ready-0002-storyforge`. Root:
`/Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002`.

## Outcome and scope

LOCAL CANDIDATE, FIXTURE TESTS PASS; REAL AUTHENTICATION UNVERIFIED.
Changed only `register_phase1.py`'s `client()` retrieval and added
`lease_transport.py`, `lease_transport_tests.py`, and this report in this folder.
No real environment credential value, keychain item, token file, credential-bearing
provider API, lease operation or registrar execution was read or run. No OS,
shared runtime, provider, schema, grant, identity or key mutation; no push, merge
or deployment. Unrelated `supabase/.temp/cli-latest` and `_AI_INPUTS/` preserved.

Universal BOOT validation passed with HQ tip
`0feee579b0a9f2c90529220899f6cf6d21b8cd05`; IR canonical mission/passport/profile
remain pending. No OS pull/fetch under the explicit no-OS-write assignment.
Fresh canonical custody/admission remains a Foreman prerequisite.

## Implemented boundary

- Exact installed CLI token pattern `sbp_(oauth_)?[a-f0-9]{40}` and precedence:
  existing current-process `SUPABASE_ACCESS_TOKEN`, exact generic-password service
  `Supabase CLI`/account `supabase`, then account `access-token`, then only
  `/Users/brianb/.supabase/access-token`. Invalid selected values stop. Only
  native `errSecItemNotFound` or file-not-found advances; denial, lock, cancellation,
  UI requirement or other errors fail closed. No store enumeration or writes.
- macOS Security.framework `SecItemCopyMatching` runs in an isolated stdlib Python
  worker with `kSecUseAuthenticationUIFail`. This prevents unlock/permission UI.
  Each keychain operation has a ten-second bound within the total sixty seconds.
  Private stdout/stderr pipes have a combined 256KiB cap; errors are value-free.
  The token file is opened read-only, no-follow/nonblocking and regular-file checked.
- Management retrieval is exactly read-only HTTPS GET
  `https://api.supabase.com/v1/projects/brxqytrfdisrgakrxkhd/api-keys?reveal=true`.
  A private bounded worker receives the token only on stdin, never argv/environment,
  uses verified TLS, no proxy or redirect machinery, fixed method/host/path,
  ten-second socket timeout and a parent-enforced sixty-second total deadline,
  including lookup/DNS/body reads. Body cap is 256KiB; four private framing bytes
  carry status. No retry. 401/403 is the existing identity/permission gate.
- Selection requires exactly one existing named/type row
  `missionmed_lease_runtime_v5`/`secret`; malformed/null/missing/ambiguous/masked or
  obviously partial values fail. The shape predicate cannot prove completeness,
  gateway validity or revocation status. No default or alternate key fallback.
- The injected opener admits only the six exact canonical HTTPS RPC POST URLs,
  checks canonical host/selector, absence of Host/Proxy-Authorization overrides,
  and identical `apikey` plus its duplicate `Authorization: Bearer` value. It
  removes only Authorization on a copied request, preserves body/method/all other
  headers, preserves the canonical three-second ceiling, delegates to unchanged
  `SupabaseLeaseClient._open_no_redirect`, and returns the real response object.
  Canonical status/JSON/size/handle validation and registrar/keeper remain intact.
- `authentication_probe()` is a separate, dormant one-call apikey-only GET to
  `https://brxqytrfdisrgakrxkhd.supabase.co/rest/v1/`. It returns only status 200
  or a value-free failure; it does not acquire a lease or run automatically in
  `client()`. Importing the helper performs no lookup/probe.

Python immutable strings cannot promise forensic memory zeroization; this code
retains values only in live private process objects/pipes, clears mutable pipe
buffers and kills/closes bounded workers. It writes no credential values.

## Validation and exact source custody

Commands run locally (no real credential operations):

```text
python3 /Users/brianb/MissionMed_OS/tools/validate_boot_dependencies.py --hq-git-dir /Users/brianb/MissionMed/.git --os-root /Users/brianb/MissionMed_OS
bash _SYSTEM/scripts/mm-preflight.sh --edit-scope <the four exact assigned paths>
python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/lease_transport_tests.py
git diff --check
```

Result: universal BOOT PASS; scoped preflight PASS with expected assigned-worktree
location warning and nonoverlapping dirty-state triage; 17 focused stdlib fixture
tests passed in 0.004s; diff whitespace check passed. AST parse passed for all
three Python sources. Comparing registrar AST against `1f23afb` after excluding
only `client()` returned `NON_CLIENT_REGISTRAR_AST_UNCHANGED`.
All environment/keychain/file/provider and subprocess seams in tests use fictional
fixtures or mocks; no actual credential reader or HTTPS worker was launched.

SHA-256 for exact implementation bytes:

| File | SHA-256 |
| --- | --- |
| `register_phase1.py` | `82cc46596206bd3f69caa75b442738647d446d26644a21f9dc6695974ea62a0f` |
| `lease_transport.py` | `bfa43334e4065b33705b1c6192a60e28333c011587f4e421a34802e144111d79` |
| `lease_transport_tests.py` | `19bf5095385aa6ab6ef5c60f2c5e3fab81909b7d303ad0987b1e2898e1a20695` |

Read-only contract/engine dependencies:

| File | SHA-256 |
| --- | --- |
| `LEASE_AUTH_DIAGNOSIS.md` | `5360f8b7d62146cf2849d85f610e480428589260c7a4bfc447fb84577be0dc20` |
| `PHASE1_INDEPENDENT_CONTRACT_REVIEW.md` | `788fb6d7c65212809dbc1f8a13279a4aeeb9a5fde97325f50497a68291158fe1` |
| `/Users/brianb/MissionMed_OS/tools/engineering_os_lease.py` | `36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431` |
| `/Users/brianb/MissionMed_OS/tools/mission_registry_registrar.py` | `ae7f68d0c14211fee9e091ff8e97b7e6daf2fff68e91b322d2bfa2810a928a3d` |

Official [pinned CLI token lookup](https://github.com/supabase/cli/blob/v2.75.0/internal/utils/access_token.go)
and [Management API reference](https://supabase.com/docs/reference/api/v1-get-project-api-keys)
were refreshed read-only. The [Supabase changelog](https://supabase.com/changelog)
index was scanned: the REST-root OpenAPI change concerns anon keys, whereas this
candidate selects the existing secret key. No applicable change established the
cause of the earlier reported 401s. The [API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys)
does not substitute for actual authentication or independent implementation approval.

## Required next gate

Fresh independent inspection must approve these exact helper/adapter bytes before
any real lookup/reveal or the newly authorized single probe. Native no-interaction
keychain behavior and real provider authentication remain unexecuted/unverified.
After successful reveal and one admitted probe, exact helper/adapter plus updated
prospective packet/annex review must precede normal canonical REGISTRY acquisition.
The normal same-process keeper, allocation, staged-byte independent review,
canonical custody/readback, release/provider-clear and product release gates remain
mandatory. Probe success cannot retrospectively establish masking as the earlier
401 cause. A failed probe stops this branch without retry or alternate key trials.

Stop this builder after its scoped local commit. This candidate is not canonical
filing, provider authentication, lease admission, staged authority approval or release.
