# PSV direct ROOT upload and session recovery · guarded deployment report

Date: 2026-09-21  
Mission: `PSV-PROTOTYPE-0001`  
Authority: DR-311, DR-312, DR-313, DR-314, DR-315, DR-324, DR-326, DR-327 and additive DR-328  
Product source: `10290aaff62a1f72a2e87ecf5a459d5f384f8a89`  
Live version: `0.6.2`

## Outcome

PSV now offers four ROOT sources: owner-scoped File Vault, direct document upload, synthetic test ROOT and paste text. Direct upload accepts a clean DOCX or UTF-8 TXT up to 5 MB, validates and reads the request-transient source once, persists only the normalized owner-scoped ROOT plus source/text hashes and a private label, and never writes the source file into File Vault. Pages and PDF are intentionally rejected with export-to-DOCX guidance.

The exact WordPress `rest_cookie_invalid_nonce` response now receives one no-store, same-page nonce refresh and one retry. If the fresh page is no longer an authorized private PSV page, the request fails closed with a session-changed message while retaining all text already present in the browser.

The reported production failure was reproduced before release. The old PSV tab had been loaded as `brinyu`, but Chrome's current WordPress account had later changed to a separate `MR0912 Live Acceptance Complete early card PIF` test account. The old page therefore held a nonce and authorization context for a different session. That account is not entitled to PSV, so a fresh direct PSV request correctly returned the normal home page. This was a real session-identity transition, not permission weakening or a reason to admit the test account.

## Safety and privacy

- Uploaded ROOTs are always marked real and remain subject to the existing server-side privacy gate.
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` remains undefined; production testing constants remain undefined.
- No uploaded statement, pasted statement or File Vault source was sent to OpenAI during this release.
- JSON `/roots` cannot spoof the `UPLOADED` source kind.
- DOCX extraction now fails closed above 512 archive entries or an 8 MB uncompressed `word/document.xml` body.
- File Vault, RISE, Matrix membership and existing PSV data contracts were not changed.

## Verification

- Canonical DR-328 commit: `21e5f0bfe870325e2e01812d2602ec5569f5a21e`; universal and exact PSV BOOT passed.
- Standalone upload/session runtime: 21/21 PASS.
- Focused Chrome browser acceptance: 6/6 PASS, including unsaved-text preservation after cookie invalidation.
- Disposable WordPress API acceptance: 129/129 PASS, including owner scoping, PDF rejection and the real-ROOT AI privacy gate.
- Access/menu regression: 24/24 PASS. Version-collision regression: PASS.
- Release ZIP SHA-256: `0185c26ba8abc7d8f60beb94ce87ecea049abefb692bba932c767e3179901b18`.
- Release manifest SHA-256: `03154d4b17269752d8a38253873603275c31e1ef40e51633b8a627da60b500f1`.
- Local package and deployed production directory: exact 25/25 PASS.
- Production PHP lint: 22/22 PASS.
- Live readback: v0.6.2 active, `members` mode, schema 6, POST `/roots/upload` registered, dedicated key present as a boolean only, broad privacy/testing flags absent.
- Data counts remained roots 4, runs 27, library 8, audit 68, provider attempts 16 and edit revisions 2.
- Anonymous bootstrap and namespace remain 404; public home and login remain 200.
- File Vault sentinels were captured immediately before and after release and remained byte-identical. The current JS sentinel `3f9f0152…` matches the current File Vault owner worktree; PSV did not replace it.
- Supabase PATH lease fencing epoch 3574 released successfully; active PSV lease count is zero.

## Deployment and rollback

- Private package: `/www/theresidencyacademy_209/private/psv-deploy-10290aa-0.6.2/`.
- Immediate byte-exact preimage: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.6.2-10290aa-20260921/live-retired`.
- Only `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-file-vault-ps/` was atomically replaced.
- Normal documented containment remains: soft off, hard-off constant, native deactivation, then removal of only the PSV plugin path. No data purge is authorized.

## Browser handoff

The original PSV tab containing the pasted statement was deliberately not reloaded. A separate Chrome reauthentication tab is open, prefilled with username `brinyu`, and redirects to the live PSV page after successful login. Once `brinyu` authenticates, the fresh v0.6.2 page will expose the new Upload document option. No credential was requested, read or transmitted by Codex.
