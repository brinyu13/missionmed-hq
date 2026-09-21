# RLQ-DUALMODE-0921A state ledger

- Updated UTC: `2026-09-21T14:11:33Z`
- Outcome: `IMPLEMENTED_LOCALLY; CANARY_FAILED_AND_WITHDRAWN; PRODUCTION_UNCHANGED`
- Mission: `RLQ-DUALMODE-0921A`
- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Worktree: `/Users/brianb/MissionMed_worktrees/RankListIQ-RLQ-DUALMODE-0921A`
- Branch: `codex/rlq-dualmode-0921a`
- Base: `origin/main@0feee579b0a9f2c90529220899f6cf6d21b8cd05`
- Implementation head before this ledger: `2d12fb9c487cbfaed9c1cb5573a1460668189ee2`
- Original stale worktree preserved: `/Users/brianb/MissionMed_worktrees/RankListIQ`, branch `fable/ranklistiq-resurrection`, head `4d1a8f5`
- Workers/subagents: `0`

## Authority and coordination

- Canonical mission registration commit: `b90b76a6222d839d603cf77c23b39aa0b4ac54fc`
- Brief SHA-256: `1b628fc1af586494236345a157a916d1a10b0791a22ef080f74908b266fa402e`
- Decision records: `DR-329`, `DR-330`
- Source-path lease: acquired and released after source/dist commits
- Handoff-path lease: owner `codex-rlq-0921a`, fencing epoch `3594`, lease id `a389c3b5-8d7b-4268-ae85-8df8d703df9e`

## Live baseline (read-only)

- Route: `https://missionmedinstitute.com/rank-list-engine/`
- WordPress post: `4216`, slug `rank-list-engine`, status `publish`
- Embed: `https://missionmedinstitute.com/wp-content/uploads/2026/03/rank_list_engine_WORKING.html`
- `post_content` SHA-256: `80c80ef3940721997b7015e0d3b32dbb92a703fcfb367007e9544c1ad8f8a280`
- Elementor data SHA-256: `cdaa08c4502467dde515889fc20fe5826788a9d38addba85d09fc0caed4070cc`
- Template metadata SHA-256: `00a40f6db844500dd573014f85eb29b2e9766245947c1c5e3673c0929ce865cd`
- Exact live artifact SHA-256: `f00a07d1943d53f471a0597c4d1f54b7c696cc0aa73074e4efa8c245b13011d9`
- Exact live artifact bytes: `1808811`
- Private provider backup: `/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z`
- Backup controls: directory mode `0700`, files mode `0600`, `SHA256SUMS` verified
- Production mutation: `NONE`

## Build custody

- Build id: `20260921T140832Z-g2a8749d2`
- Source commit: `2a8749d2c09a335ab80d658b9e0d73db14cf7d28`
- Output: `ranklistiq/dist/rank_list_engine.20260921T140832Z-g2a8749d2.html`
- Output SHA-256: `7aa96d0a79342e32645fc774a05ceff27eac28cbf858ff3fa48d7bdfa4dd55a0`
- Rules/config SHA-256: `1e7005447672cbd60728dd45e796e89bc6267bf903b19665da44d05087593ea9`
- Git-safe base SHA-256: `1766f21de2bfbffe2d5e70e999757fad6be38dd572ff5081a21550b6224756ec`
- Test result: `25/25 PASS`
- Inline script parse check: `PASS`
- Local application-mode render: `PASS`
- Local rank-mode preservation: `PASS`
- Mobile viewport horizontal overflow check (`390x844`): `PASS`

## Accepted capabilities

- Query-driven mode boot with rank mode as the default
- Isolated application-mode storage namespace; rank-mode keys remain unchanged
- Two application-mode cloud slots using the existing BFF snapshot envelope
- Read-only RISE adapter with fail-closed auth/error handling and bounded concurrency
- 2027 ERAS specialty signal rules with tier-aware allocation checks
- Planning-only wording; no claim that a plan submits to MyERAS or NRMP
- Application-mode UI hides rank-only Oracle, supplemental, and finalization surfaces

## BFF and Supabase boundary

- Production BFF file SHA-256: `c76fff0117ceac00e587fcdb0b8f77019b5bbfb782923738e087aeb9c089a14f`
- Production guard file SHA-256: `67b264386046379f25d556fbe314f9c921d8449099fea94ba6b27842ee7d3be7`
- Founder access check: `PASS` (`administrator`)
- Authenticated bootstrap: `200 PASS`; profile and Supabase identity present
- Authenticated load: `200 PASS`; rank-list snapshot envelope present
- Save roundtrip: `UNVERIFIED`; not triggered because it would transmit the authenticated user's existing workspace data to the production BFF/Supabase row and needs explicit just-in-time confirmation
- Schema/RLS/Edge Function changes: `NONE`

## AAMC signal-rule evidence

- Machine reconciliation against the official 2027 AAMC table: `PASS` for all 29 specialty rows
- Human policy/content confirmation: `UNVERIFIED`
- Ambiguous genetics names: left unmapped rather than guessed

## RISE evidence

- Adapter fixture/contract tests: `PASS`
- Live authenticated RISE read and mapping: `UNVERIFIED`; browser control disconnected before a fresh no-write acceptance run
- RISE mutation: `NONE`

## Canary and production decision

- Temporary child page: post `9174`, route `/rank-list-engine/next/`
- Expected result: authenticated/entitled protected canary
- Observed result: anonymous request received the iframe shell (`200`)
- Decision: `FAIL; WITHDRAWN IMMEDIATELY`
- Current route state: `404`
- Current canary asset URL state: `404`
- Canary post state: `draft`
- Canary artifact: moved to the private backup directory, SHA-256 `46e22f86296bf0313d2ddf44b9e94ace164a92044d7cb3d18f9a5feaa4b904d5`
- Production promotion: `NOT ATTEMPTED`
- Production page `4216`: `UNCHANGED`
- Existing production guard interpretation: it gates logged-in unauthorized users but does not itself deny anonymous access; guard changes are outside this mission's authority

## Security observation

The exact public frontend contains hard-coded developer-unlock credentials and
historical plaintext references. The values are intentionally omitted from Git
and this ledger. The Git-safe base removes every plaintext occurrence and makes
all three executable checks fail closed. The live production
artifact remains unchanged, so remediation of that separate production issue
is still required under explicit authority.

## Rollback

- No production rollback is required because production was not changed.
- The exact live page wrapper, Elementor data, template metadata, WordPress JSON,
  exact iframe bytes, and withdrawn canary build are retained in the private
  provider backup above.
- The canary rollback was completed by drafting post `9174` and moving the
  public canary asset into the private backup directory.

## Waiting / next path

1. Obtain explicit confirmation before the authenticated production Save
   Progress roundtrip because it transmits the user's existing workspace data.
2. Restore reliable authenticated browser control and run a no-write RISE import
   acceptance check.
3. Resolve the protected-canary route boundary through the owning entitlement /
   routing mission; do not broaden this mission to edit the guard.
4. Complete independent human confirmation of the AAMC specialty rule table.
5. Only after all gates pass, request separate promotion authority and perform
   production deployment with preimage verification and rollback custody.
