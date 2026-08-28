# Independent Release Review — P1-RISE-5005

Ticket: P1-RISE-5005-INDEPENDENT-RELEASE-VERIFICATION-001
Reviewed: 2026-08-28
Method: repository evidence + independently executed local suites + read-only
provider listing. No builder conclusion was accepted without re-derivation.
No deploy, no provider mutation, no WordPress change, no /rise/ activation.

```text
REVIEWER_ROLE                = INDEPENDENT_NON_BUILDER
RELEASE_COMMIT_REVIEWED      = 152c0f06ee5ef126c315a8707499a0d477d2867f
AUTHORITY_SCOPE_VALID        = YES
UI_LOCK_PRESERVED            = YES
RIGHTS_SAFE_RELEASE_VALID    = YES
RESTRICTED_DATA_LEAK         = NO
ENTITLEMENTS_FAIL_CLOSED     = YES
AUTH_ISOLATION_PASS          = YES
MATRIX_FAIL_CLOSED_OR_VALID  = YES
PROVIDER_ISOLATION_PASS      = PARTIAL (see C2)
DATABASE_ISOLATION_PASS      = PARTIAL (see C4)
PAID_RESEARCH_FAIL_CLOSED    = YES
DEMO_DATA_LEAK               = NO
TESTS_PASS                   = YES
ZERO_BLAST_RADIUS_PASS       = YES
ROLLBACK_READY               = PARTIAL (see C3, C7)
VERDICT                      = APPROVE WITH CONDITIONS
```

---

## 1. Release integrity — PASS

| Check | Result |
|---|---|
| HEAD | `152c0f06ee5ef126c315a8707499a0d477d2867f` |
| Parent | `6965d96c8231d8210e1e06fe2780304cd82f01c5` (present, linear) |
| Working tree | clean |
| Remote `refs/heads/codex/p1-rise-5005-rights-safe-production-unblock` | `152c0f06…` — byte-equal |
| Divergence vs `origin/main` | 2 ahead, 0 behind |
| History rewrite / merge conflict / uncommitted release dependency | none |

Web assets are byte-reproducible: a clean `npm run build` from the UI lock
produced **zero** diff against the committed `rise/web/*`.

## 2. Controlling authority — PASS

DR-140, DR-141, DR-142 and `PRODUCT_PASSPORTS/rise.md` were **not** present in
the local `~/MissionMed_OS` checkout, which was 8 commits behind. They exist
canonically on `origin/main` (DR-140/141/142 plus the `ui_authority_marker:
FABLE_5002` correction). Authority was read from `origin/main`.

All 143 changed files fall inside the DR-141 envelope:

```text
rise/**                                            92
_AI_HANDOFFS/from_codex/P1_RISE_500*/**            38
_UI_LOCKS/RISE_FABLE_5002_FOUNDER_APPROVED/**       8   (UI contract source; added in 6965d96)
missionmed-hq/server.mjs                            1
missionmed-hq/tests/rise-auth.test.mjs              1
wp-content/mu-plugins/missionmed-{rise-route,rise-sso,matrix-rise-entry}.php   3
UNCLASSIFIED                                        0
```

## 3. Fable UI lock — PASS

Independently hashed
`_UI_LOCKS/RISE_FABLE_5002_FOUNDER_APPROVED/source/RISE_NEXTGEN_FABLE_FOUNDER_SHELL.html`:

```text
1e1a16aa630449c9e763a04f6f720b51df0afa46822044de165687d7f8758987   MATCH
```

Unmodified by the release commit. `rise/tests/fable-lock.test.mjs` binds
`web/styles.css` byte-for-byte to the locked `<style>` block and asserts the
Fable landmarks (`#hdr`, `#rail`, `#main`, `#file`, `#srcPanel`,
`#filterDrawer`, `--em`, `--hdr:64px`, `--rail:232px`, `.heroCapture`,
`.tabStrip`, `.stateTag`). Twelve Playwright acceptance tests confirm the four
feature doors, list/grid Find, the six-tab Program File overlay, the
Sources & Freshness drawer, and the four-program Compare cap. Preservation
verified.

## 4. Rights-safe data release — PASS

Published student projection contains exactly the four authorized columns.
Verified across all 26 records:

- `fields` is `{}` on **26/26** programs — zero legacy field values published.
- Only identifier namespace is `MISSIONMED_RISE_ID`. **No ACGME_ID.**
- Only source authority is `HRSA_THCGME`; only two URLs, both `bhw.hrsa.gov`.
- `display.hospital` and `display.zip` are `null` on 26/26.
- Designations: Family Medicine, Internal Medicine, Psychiatry. 16 states.
- `selectedFields: []`, `matchableClaims: 0`, `quarantinedSourceRows: 0`.
- No award amount, narrative, logo, photo, or official program URL.

`sourcePolicy` records `freida: excluded_no_written_authorization`,
`residencyExplorer: excluded_no_written_authorization`,
`acgmeIdentifiers: internal_only_not_in_projection`.

`internal-full-rise-manifest.json` binds the FREIDA-derived corpus by hash only
with `publication: "prohibited"` and `copiedIntoStudentRelease: false`. The
restricted workbook is **not in Git** (`rise/data/` is gitignored, only
`.gitignore` tracked) and **not in the image** (`.dockerignore` is a deny-all
allowlist that admits only `server.mjs`, `src/`, `adapters/`, `releases/`,
three tool files, and `web/`; `tests/`, `data/`, `governance/`, `sql/`, and
`data-sources/` are all excluded).

`RIGHTS_REVIEW_REQUIRED.csv` = 200 rows, `FIELD_PROVENANCE_AUDIT.csv` = 204
rows, `rightsBlockedFieldCount` = 196. Every blocked row is marked
`INTERNAL_FULL_RISE only` / `EXCLUDE`.

```text
RIGHTS_SAFE_PROGRAMS_VERIFIED = 26
RIGHTS_BLOCKED_FIELDS_VERIFIED = 196
RIGHTS_REVIEW_REQUIRED_VERIFIED = 200
```

Runtime enforcement is layered and fail-closed: `RISE_INDEX_SHA256`,
`RISE_INDEX_MANIFEST_SHA256`, `RISE_ACTIVATION_RECEIPT_SHA256`, and
`RISE_ASSET_MANIFEST_SHA256` are all mandatory lowercase SHA-256 in production;
`activationStatus` is promoted from `offline_shadow_only` to `active` **only**
after `validateActivationReceipt()` binds the receipt to the release id, index
hash, and manifest hash and confirms `revoked !== true`. Every authenticated
request re-runs `assertLiveSourceRights()` against the database; an unavailable
or revoked authorization returns 503, not data.

## 5. Entitlements — FAIL CLOSED (PASS)

`rise/config/entitlements.v1.json`: core `default: deny`, premium
`default: deny`, `mappingStatus: unresolved_fail_closed`.

`rise/adapters/hq-auth.mjs` is the only production capability minter. It emits
`["rise:read"]` for students and `["rise:read","rise:operator","rise:admin"]`
for WordPress administrators. **`rise:premium` is never minted by any code path
in the release.** No server route is gated on `rise:premium`; the client's
`state.member` flag can only ever be false in production, and there is no
premium payload behind it — all 26 records carry `fields: {}`.

Deferred features confirmed inert: Mission Alumni Connections, Letter of
Interest, Match Bridge, RankList IQ, premium depth, CV/File Vault
(`INTEGRATION_DISABLED` 409, honest locked modal).

The adapter additionally rejects the HQ session unless
`revoked === false`, `revokedAt === null`, and `authAudience === "rise"`.

## 6. Matrix profile — PASS

`rise/adapters/http-matrix-profile.mjs`:

- Endpoint pinned to exactly `/wp-json/mmed/v1/profile/me`, HTTPS enforced, no
  user/pass/query/fragment permitted.
- **No second truth** — read and write both proxy the canonical owner; write
  performs a canonical readback.
- **No anonymous access** — missing WordPress cookies or an invalid REST nonce
  raise `MATRIX_AUTH_REQUIRED` → 401.
- **No client-side privileged credential** — the transport is server-mediated
  and forwards only the requester's own WordPress cookies.
- **Cross-user read prevented** — `verifiedCredentials()` calls
  `/wp-json/wp/v2/users/me` and rejects `MATRIX_SUBJECT_MISMATCH` (403) unless
  the owner id equals the `wp:<id>` RISE subject.
- **Fail-closed transport** — upstream unavailable/rejected → 503; the adapter
  is mandatory in production (`resolveMatrixProfileAdapter` throws otherwise).
- **Honest degradation** — the shell renders "Profile unavailable" and
  `available: false`; no profile state is fabricated.

## 7. Auth / HQ audience — PASS

`missionmed-hq/server.mjs` changes are additive and audience-scoped:

- `normalizeAuthAudience()` admits only `missionmed-hq` and `rise`; anything
  else is `400 invalid_auth_audience`.
- Absent `auth_audience` normalizes to `missionmed-hq`, so existing StoryForge
  / Matrix / Arena / CAM / USCE handoffs are byte-unaffected.
- `parseWordPressHandoffToken()` rejects `handoff_audience_mismatch` (401) when
  the token audience differs from the requested audience — a RISE token cannot
  mint an HQ session and vice versa, despite the shared HMAC secret.
- A RISE-audience session receives `403 rise_audience_isolated` on every HQ
  application API except `/api/auth/session`, `/api/auth/logout`,
  `/api/health`.
- `/api/auth/session` returns an unauthenticated payload when the cookie's
  audience does not match the requested audience.
- Supabase bootstrap is skipped for RISE — no cross-product privilege.
- `/mmc-private` remains independently role-gated by
  `isAuthorizedMmcPrivateUser()`; a student RISE session cannot reach it.

Anonymous denial holds at three layers: the WordPress proxy
(`is_user_logged_in()` + `mmhq_session` → 401/redirect), HQ, and RISE itself
(`401 UNAUTHENTICATED`, then `403 FORBIDDEN` without `rise:read`).

Note: `isAuthorizedWordPressUser(user, "rise")` grants core RISE access to any
WordPress user with an id and email. This matches the documented policy
(`grantRule: "authenticated MissionMed learner session with audience rise"`)
and is bounded by the 403 isolation gate.

## 8. Paid research — FAIL CLOSED (PASS)

No Parallel key, endpoint, or client reference exists anywhere in
`server.mjs`, `web/app.js`, `adapters/`, `tools/`, or `config/`. There is **no
research submission route at all**. `/api/rise/v1/handoffs/{actn,cam,storyforge}`
return `409 INTEGRATION_DISABLED`. `/api/rise/v1/operator/queue` returns
`409 OPERATOR_BACKEND_DISABLED` behind `rise:operator`. `runCampaign()` is a
toast: "Research submission is disabled". `status.researchFactory = "disabled"`.
Zero automatic spend is reachable.

## 9. Demo data — NO LEAK (PASS)

Zero hits across `web/index.html`, `web/app.js`, `web/styles.css` for
`demo-brookdale`, `Ignacio`, `495 alumni`, `IMG 61`, `Viren Kaul`,
`Representative preview`, `window.RISE_DATA`, `Math.random`, `localStorage`,
`lorem`. No source maps in `dist/`. Fixtures and tests are excluded from the
image. `syntheticRegistryProhibitedInProduction` is enforced at three points
(manifest pre-read, index load, server construction).

## 10. Tests — independently executed

| Suite | Command | Result |
|---|---|---|
| RISE unit/contract | `node --test tests/*.test.mjs` | **110 pass / 0 fail** |
| Browser acceptance | `npx playwright test` | **12 passed** (46.9s) |
| HQ audience isolation | `node --test tests/rise-auth.test.mjs` | **1 pass / 0 fail** |
| PHP lint (3 seams) | `php -l` | **3/3 no syntax errors** |
| Dependency audit | `npm audit` | **0 vulnerabilities** |

Not run, stated explicitly:
- **HQ cross-product regression cannot be proven locally.** `missionmed-hq/`
  contains no regression suite beyond the new `rise-auth.test.mjs`;
  `tests/mmc-private-mount-validation.mjs` fails on a pre-existing path bug
  (`missionmed-hq/missionmed-hq/server.mjs`) unrelated to and unchanged by this
  release. Sibling-audience non-regression rests on code reading, above.
- Live provider and database gates cannot be run without deploying.

## 11. Security — PASS with conditions

No committed secrets. All matches in the diff are dummy test values
(`rise:secret@postgres.railway.internal`, `abuse-test-token-0000…`) inside
`tests/`, which is excluded from the image. No client-side provider secret, no
service-role key, no Parallel key.

`validateProductionEnvironment()` is strict: it pins `NODE_ENV`,
`RISE_ENVIRONMENT`, `RISE_AUTH_MODE=injected`, `RISE_ARTIFACT_MODE=bundled`,
`RISE_DATABASE_SSL_MODE=require`, four mandatory SHA-256 values, absolute
adapter/artifact paths, and their exact expected values; it prohibits all six
`RISE_ALLOW_INSECURE_LOOPBACK_*` escapes. `local-preview` auth throws in
production and may bind only to loopback. Bearer credentials are rejected
outright (`if (request.headers.authorization) return null`).

The application escapes consistently — `esc()` is applied at 126 interpolation
sites and no unescaped program field reaches `innerHTML`. Registry content is
hash-pinned and HRSA-derived, so no untrusted input reaches the renderer.

## 12. Zero blast radius — PASS

No StoryForge, Arena, File Vault, CAM, RankList IQ, LOR, or unrelated
WordPress route source is touched. `missionmed-matrix-rise-entry.php` appends a
sidebar `<li>` on `/member-dashboard/` by DOM injection only; the pinned
`student-os.809093d2b5b2bc05.js` bundle is untouched. The single shared-HQ file
change is audience-scoped and defaults to existing behavior.

Two USCE public route families (`/api/usce/public/*`, `/api/usce/offer/*`) are
dispatched before the RISE isolation gate, but they are anonymous-public
already, so a RISE session gains nothing.

---

## CONDITIONS

All conditions are objective, bounded, and testable during final activation.

### C1 — Restore security headers through the WordPress proxy (MANDATORY)

`wp-content/mu-plugins/missionmed-rise-route.php:130` forwards only
`content-type`, `cache-control`, `etag`, `x-request-id`. RISE's
`securityHeaders()` emits Content-Security-Policy, X-Frame-Options: DENY,
X-Content-Type-Options: nosniff, Referrer-Policy, Cross-Origin-Opener-Policy,
Cross-Origin-Resource-Policy, and Permissions-Policy — **none of which reach
the student browser** on the same-origin `/rise/` path. The release ships a CSP
it does not deliver, and `/rise/` is framable.

**Satisfy by:** adding those header names to the forward list (or re-emitting
them in the proxy), then verifying with
`curl -sI https://missionmedinstitute.com/rise/ | grep -i 'content-security-policy\|x-frame-options\|x-content-type-options'`.

### C2 — Re-link the Railway CLI before any deploy (MANDATORY)

`railway list` confirms `missionmed-rise-production` exists as a separate
project. However, `railway status --json` run from `rise/` reports the linked
project as:

```text
missionmed-hq-fix005   29afe885-b9b1-425d-8fd8-8611cd275409
```

Not `missionmed-rise-production` (`c0113625-951e-46ab-939b-dd57acc0e87c`). A
`railway up` from this directory would deploy RISE into the **shared HQ
project** — a DR-141 hard stop ("provider target guessing, reuse of another
product's database/service").

**Satisfy by:** re-linking to project `c0113625-951e-46ab-939b-dd57acc0e87c`,
environment `549d6597-1962-44cb-b0f5-7d88bd025e31`, service
`9bce2090-ce45-4572-8291-e8da5d42acb6`, and pasting the `railway status`
readback before the first deploy.

I did **not** relink, because that would mutate the builder's ambient CLI
state. Consequently the isolated project's internals (service health, database
attachment, current release marker) were **not** inspected; only its existence
and separateness were verified.

### C3 — Supply a down script for migration 005 (MANDATORY)

`rise/sql/005_rights_safe_runtime.sql` has no paired `.down` file; 001–004 all
do. The migration is additive (`CREATE SCHEMA` / `CREATE TABLE`) and therefore
non-destructive, but the documented rollback pattern is broken and
`sql-contract.test.mjs` asserts down-script safety for 001–004 only.

**Satisfy by:** adding `005_rights_safe_runtime.down.sql` that drops only the
`rise_runtime` schema objects it created and refuses to touch student rows,
covered by the existing sql-contract test pattern.

### C4 — Provision a LOGIN role so RLS is actually enforced (MANDATORY)

`005` creates `rise_app_runtime` as **NOLOGIN** and scopes the FORCE-RLS policy
`TO rise_app_runtime`. The recorded provider readback
(`08_PRODUCTION_STORAGE.md`) shows the only database role is superuser
`postgres`. A superuser bypasses row-level security entirely, and a NOLOGIN
role cannot be connected to — so as provisioned, the RLS policy would never be
evaluated.

**Mitigating fact:** `adapters/postgres-runtime.mjs` filters
`WHERE subject_key = $1` in every `list`/`delete` and keys `put` on the HMAC
subject, so **My Programs isolation holds at the application layer regardless
of RLS** and no cross-user leakage path exists. This is why the finding is a
condition, not a rejection.

**Satisfy by:** creating a LOGIN role granted `rise_app_runtime`, pointing
`RISE_DATABASE_URL` at it, and proving with
`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;`
plus a two-subject cross-read denial test.

### C5 — Database TLS is unauthenticated (SHOULD)

`buildDatabasePoolConfiguration()` sets `ssl: { rejectUnauthorized: false }`.
The adjacent comment claims "RISE validates TLS independently"; no such
validation exists in the code. Traffic is encrypted but the server certificate
is unverified. Bounded by Railway private networking.

**Satisfy by:** pinning the Railway CA and setting `rejectUnauthorized: true`,
or correcting the comment to state the actual posture.

### C6 — Register the 5005 rights decision in canonical authority (SHOULD)

`activation-receipt.json` and `hrsa-source-authorization.json` cite
`P1-RISE-5005-RIGHTS-SAFE-CORE-ACTIVATION` and
`P1-RISE-5005-HRSA-PUBLIC-FACT-PROJECTION`, approved by
`founder-ticket:P1-RISE-5005`. Neither identifier is a filed MissionMed OS
decision record (the canonical chain for this work is DR-140/141/142 for
P1-RISE-5004; `origin/main` ends at DR-144). The rights basis **is** documented
in-repo, hash-bound, and reviewed — this is a registration gap, not a
rights-content gap — but DR-140 names "unresolved source rights" as an expiry
trigger.

**Satisfy by:** filing the 5005 rights-safe projection decision through the
normal `REGISTRY:MISSIONMED-OS` transaction, or having the Founder confirm the
5005 ticket is itself the governing record. Per the ticket I am not making a
new legal conclusion; the implementation matches the documented policy exactly.

### C7 — Refresh the rollback and deployment handoff before exposure (MANDATORY)

`12_DEPLOYMENT_REPORT.md` and `14_ROLLBACK.md` are stale 5004 artifacts still
asserting `DEPLOYMENT_STATUS = BLOCKED` and "no RISE application deployment,
domain, WordPress seam, HQ audience, Matrix entry, schema, data, or frontend
pointer exists to roll back." This release requires a **shared missionmed-hq
redeploy**, and no HQ rollback deployment id or recovery identifier is recorded
anywhere.

Route rollback is genuinely simple and reversible (remove the three mu-plugins
→ `/rise/` returns to the pre-existing WordPress 404, the recorded exact
preimage). Application rollback has no prior deployment to select, which is
expected for a first release.

**Satisfy by:** recording, before student exposure — the pre-change HQ
deployment id to redeploy on failure; the exact mu-plugin preimage state; the
RISE first deployment id; and the database backup identifier.

### C8 — Unauthenticated health disclosure (ACCEPT OR TRIM)

`/api/rise/v1/health` is deliberately proxied without login and discloses
`registryReleaseId`, `buildId`, `environment`, `activationStatus`, and
`sourceRightsCurrent` to anonymous callers. No program or student data. Accept
as an intentional probe, or trim the body to `{ok}` for anonymous callers.

---

## UNRESOLVED MANDATORY RELEASE GAPS

C1, C2, C3, C4, C7 — each objective, bounded, testable, and satisfiable during
final activation without changing the release's data, UI, or access model.

## VERDICT

```text
VERDICT = APPROVE WITH CONDITIONS
```

The released 26 HRSA THCGME programs are rights-safe and correctly represented.
No restricted or uncertain field can reach a student through the API, HTML,
JavaScript, source maps, debug or admin endpoints, fallbacks, or fixtures.
Entitlements, paid research, source rights, Matrix transport, and authentication
all fail closed. The founder-approved Fable UI is preserved bit-exactly and the
production shell is mechanically derived from it. Blast radius is confined to
the DR-141 envelope.

The conditions are activation-time operational gaps — a header-forwarding
omission, a mis-linked provider CLI context, a missing down script, an
unenforceable-as-provisioned RLS role, and stale rollback records — not defects
in the release's data, rights posture, or access model.

`BUILDER_MAY_ACTIVATE_PUBLIC_RISE = NO` until C1, C2, C3, C4, and C7 are
satisfied and re-evidenced. On satisfaction of those five, this review's
approval stands with no further independent re-review required.
