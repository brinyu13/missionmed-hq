# Darwin Report — Minimal Founder-Only Candidate Repair

Date: 2026-07-27

Scope: local B1-502 StoryForge candidate only

Disposition: **PASS — SCOPED LOCAL REPAIR VERIFIED**

## Authority boundary

Darwin changed only the isolated StoryForge WordPress seam, application/edge cache and route handling, focused tests, the missing bundle scanner, and this report. No production system, remote, MissionMed OS authority record, protected `missionmed-hub` asset, database provider, Cloudflare account, Git branch, or deployment was mutated. Nothing was staged, committed, pushed, or deployed.

## Verified defects repaired

### 1. Exact founder-only WordPress boundary

The plugin now has:

- `allowed_user_ids`, defaulting to an empty array;
- `app_role_overrides`, defaulting to an empty array;
- sanitized positive WordPress IDs and restricted `student`, `mentor`, or `admin` app-role values;
- a central exact-ID check in `mmsf_access_state()`.

The central access state is used by navigation, dashboard tiles, WordPress menu output, AJAX bootstrap, and REST token issuance. With the default empty list, all authenticated users are denied even if they have `manage_options`.

### 2. Exact founder student-workflow override

An exact allowlisted WordPress administrator can be explicitly mapped to the StoryForge `student` app role. The resulting JWT carries `app_role=student`; the database session therefore remains governed by student owner-only RLS. This does not add an admin private-story support override and does not enable any other administrator.

The existing administrator entitlement is used only for the exact allowlisted pilot identity. The override source is recorded as `wordpress_exact_user_pilot_override`. Production still must pin one exact founder WordPress ID, one unique StoryForge UUID, and a matching eligible `sf_users` row with role `student`.

### 3. Private API cache policy

The application server and edge worker now explicitly enforce:

`Cache-Control: no-store, private`

and:

`Pragma: no-cache`

for `/storyforge/api/*` success and error responses. The edge overwrites unsafe upstream cache directives rather than weakening the application policy.

The local Matrix/WordPress router applies the same exact private policy to the
StoryForge REST token endpoint and exact StoryForge AJAX bootstrap action,
including non-2xx responses. It also forwards WordPress's multiple
`Set-Cookie` headers as an array instead of flattening them, preserving both
administrator-auth and logged-in cookies.

### 4. Slashless canonical route

Both the production Worker candidate and local edge router now return a query-preserving HTTP `308` from `/storyforge` to `/storyforge/`. Requests outside the exact mount remain outside StoryForge ownership.

### 5. Missing bundle scanner

`package.json` and the integration harness already required `scripts/scan-bundle-secrets.mjs`, but the file was absent in B1-502. Darwin restored the narrow scanner from the verified B1-501 source. Both copies have SHA-256:

`d1fcd9f36de511ad7f7bef1d87b0bdf72cbbc37486e78c691e733de73afcb320`

It scans only the built `dist` tree for service-role markers, StoryForge JWT secret names, Supabase service-role key names, private-key blocks, and OpenAI-style secret keys.

### 6. Zero-mentor submission truth gate

The additive B1-502 migration replaces `sf_submit_story()` so a student must
have at least one active `sf_mentor_assignments` row before submission. The
story row is locked first, the assignment is checked with `FOR SHARE`, and a
missing assignment raises SQLSTATE `42501` before any story state, revision,
or audit event can change.

The story-detail API reports `mentor_review_available` from the same active
assignment source of truth. When false, the V5 workspace keeps the private
story editable, disables the submission control as `Mentor review
unavailable`, and states that mentor review is not enabled yet. The assigned
student lifecycle remains unchanged.

### 7. WordPress-to-database identity binding

Database authorization now binds all four live identity facts:

- canonical StoryForge subject UUID;
- positive WordPress user ID;
- application role;
- current eligibility.

The server writes the validated JWT `wp_user_id` into a transaction-local
PostgreSQL claim. `sf_has_live_identity()` requires it to match the
`sf_users.wp_user_id` row alongside subject, role, and eligibility. A signed
token with a correct subject but another WordPress ID therefore sees no
private rows and cannot invoke state-changing RPCs.

The local integration founder uses a unique StoryForge UUID and the actual
ephemeral founder WordPress ID; it no longer shares the seeded student UUID.

### 8. Collision-safe local verification

The integration harness now selects free, distinct app and edge ports, derives
browser assertions from the selected base URL, and waits for a verified
WordPress post-login destination. Its receipts are written only beneath:

`_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/local-integration/`

No B1-501 receipt is overwritten.

## Focused verification

- PHP syntax: **PASS**
  - `php -l wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- JavaScript unit suite: **PASS — 22/22**
  - includes canonical redirect;
  - includes API success and error cache-policy enforcement;
  - includes malformed and signed-invalid identity claim handling;
  - includes bounded client recovery and runtime-contract checks.
- Static build: **PASS**
- Bundle secret scan: **PASS**
  - result: `{"ok":true,"scanned":"dist"}`
- PostgreSQL authorization and lifecycle suite: **PASS**
  - terminal marker: `STORYFORGE_POSTGRES_SUITE_PASS`;
  - includes mismatched WordPress-ID denial;
  - includes zero-assignment submission denial with private state preserved.
- Browser suite: **PASS — 7/7**
  - includes raw API privacy, owner-bound background persistence, reduced-motion rendering, responsive Matrix return paths, actionable startup failure, zero-assignment UI truth, assigned two-mentor lifecycle, and the existing Axe accessibility check.
- WordPress/PostgreSQL/browser integration: **PASS — 6/6**
  - founder administrator is accepted as app-role `student`;
  - second administrator is denied with `user_not_enabled`;
  - non-allowlisted student is denied with `user_not_enabled`;
  - non-allowlisted mentor is denied with `user_not_enabled`;
  - founder navigation and tile are present;
  - denied identities receive neither navigation nor tile;
  - `/storyforge` returns the canonical `308`;
  - API, REST-token, and AJAX-bootstrap success and error responses carry exact private no-store caching;
  - nonce, signature, origin, session-loss, and eligibility-revocation checks remain green;
  - founder zero-assignment submission is denied without changing the private story;
  - mentor reconciliation is clean at `0/0`;
  - rollback checks remain green.
- `git diff --check`: **PASS**

Docker Desktop was initially stopped, so the first full integration attempt could not contact the local Docker socket. Darwin started Docker Desktop locally. A later retry detected and removed one exact stale local StoryForge application process before the final clean run; dynamic harness ports now prevent silent reuse. These were local test-environment actions only.

## Canonical dark V5 visual and accessibility reconciliation

Disposition: **PASS — LOCAL CANDIDATE RECONCILED AND VERIFIED**

The canonical V5 authority was re-hashed before this repair:

`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`

This exactly matches:

`_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`

### Visual system and navigation

The parchment/wine presentation was replaced with the canonical dark V5
system:

- base surfaces `#0a0d14` and `#0f1522`;
- card surfaces `#121927` and `#161f31`;
- light foreground text;
- amber/orange student accents;
- cyan/blue mentor accents;
- restrained ambient aurora layers;
- complete still-frame behavior under `prefers-reduced-motion: reduce`.

The authenticated Settings view offers exactly six background environments:
Emberlight (default), Aurora, Night Constellation, Deep Tide, Meridian, and
Static Dark. No background selection, role, story, or authorization fact is
stored in `localStorage`.

The student navigation now has exactly this order:

1. Home
2. Story Library
3. Interview Prep
4. Notifications
5. Settings

Quick capture is a primary action rather than a navigation item. The signed
founder override remains a database-authorized student workflow; no client
role toggle or UI-only authority was introduced. A visible functional Back to
Matrix path is retained at desktop, tablet, and mobile widths.

### Owner-bound background preference

The additive migration
`20260727190000_b1_502_storyforge_background_preference.sql` adds one
constrained `sf_users.background_preference` field with a default of `ember`.
Its security-definer RPC accepts no target user identifier, requires the full
live subject/WordPress-ID/role/eligibility binding, validates the six canonical
values, and updates only the authenticated actor.

`PATCH /api/preferences/background` invokes that RPC. `/api/session` returns
the persisted value. PostgreSQL and browser/API tests prove that:

- the signed user can update their own preference;
- another user's row remains unchanged;
- the preference survives a new authenticated session and browser reload;
- an invalid environment is rejected;
- a mismatched WordPress identity cannot change preferences.

Migration SHA-256:

`ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405`

### Accessibility and bounded failures

The reconciliation also adds:

- persistent accessible names on icon-only responsive navigation;
- `aria-pressed` state on backgrounds, capture modes, library filters, and
  mentor queue buckets;
- focus transfer to the new primary heading after SPA navigation;
- focus restoration after a background choice or queue-filter rerender;
- live status semantics while booting and alert semantics for lockouts or
  startup failure;
- a plain-language startup failure with Retry and Back to Matrix;
- no raw `Failed to fetch` exposure;
- a 320 px six-item mentor mobile navigation proof with no horizontal
  overflow.

### Production route invariant

An adversarial probe found that configuration parsing could explicitly disable
API-only origin mode or change the production base path. Production validation
now fails closed unless:

- `STORYFORGE_ORIGIN_API_ONLY=true`; and
- `STORYFORGE_BASE_PATH=/storyforge/`.

The local integration router now mirrors the production topology: it serves
fingerprinted assets from the built static directory while forwarding only
`/healthz` and `/api*` to the API-only origin. The full Matrix/WordPress
integration suite verifies this split.

### Final local validation and deterministic build

- Unit suite: **PASS — 22/22**
- Browser/API suite: **PASS — 7/7**
- WordPress/Matrix integration suite: **PASS — 6/6**
- PostgreSQL authorization/lifecycle suite: **PASS**
  - terminal marker: `STORYFORGE_POSTGRES_SUITE_PASS`
- Bundle secret scan: **PASS**
  - `{"ok":true,"scanned":"dist"}`
- `npm audit --omit=dev`: **PASS — 0 vulnerabilities**
- PHP syntax: **PASS**
- `git diff --check`: **PASS**

Final deterministic build:

- `dist/index.html`
  - SHA-256 `1ac23a36a4f6e55914918d48945ef8a323ab6fc5e182af140321a4dcbd930f0b`
- `dist/assets/app.51e3263110e8.js`
  - SHA-256 `51e3263110e82f2962227763514e93d62112ab40ad28d5a5fc1403ff391cedd6`
- `dist/assets/auth.960289f115f2.js`
  - SHA-256 `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`
- `dist/assets/styles.736a5a89e690.css`
  - SHA-256 `736a5a89e690f52e5a99711131de4de6b4540e34bee452099043f7471542990f`

Visually inspected receipts are isolated under:

`_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/visual-reconciliation/`

They cover student home, approved mentor workspace, the six-environment
Settings view at desktop and tablet sizes, student mobile, and the six-item
mentor navigation at 320 px.

This reconciliation used real API and PostgreSQL state throughout. It added no
demo authority, fake AI result, fake audio success, role switch, provider
mutation, deployment, stage, commit, push, pull request, or protected
`missionmed-hub` edit.

## Revocation boundary

No revocation service or new infrastructure was added. The existing short JWT TTL remains bounded to 60–300 seconds in non-local environments, with WordPress access rechecked on every bootstrap/token exchange. Removing the exact user from the allowlist prevents new bootstrap and token issuance; already issued authority expires at the bounded token TTL.

## Files in Darwin scope

- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- `wp-content/plugins/missionmed-storyforge-sso/README.md`
- `storyforge-v5/infra/edge/worker.mjs`
- `storyforge-v5/infra/edge/local-router.mjs`
- `storyforge-v5/infra/postgres/migrations/20260727170000_b1_502_storyforge_submit_assignment_gate.sql`
- `storyforge-v5/infra/postgres/migrations/20260727190000_b1_502_storyforge_background_preference.sql`
- `storyforge-v5/server/app.mjs`
- `storyforge-v5/server/config.mjs`
- `storyforge-v5/server/db.mjs`
- `storyforge-v5/public/app.js`
- `storyforge-v5/public/index.html`
- `storyforge-v5/public/styles.css`
- `storyforge-v5/scripts/run-e2e.sh`
- `storyforge-v5/scripts/run-integration.sh`
- `storyforge-v5/scripts/run-local.sh`
- `storyforge-v5/scripts/run-postgres-tests.sh`
- `storyforge-v5/scripts/scan-bundle-secrets.mjs`
- `storyforge-v5/tests/e2e/storyforge.spec.mjs`
- `storyforge-v5/tests/integration/storyforge-sso.spec.mjs`
- `storyforge-v5/tests/postgres/authorization_matrix.sql`
- `storyforge-v5/tests/unit/edge.test.mjs`
- `storyforge-v5/tests/unit/runtime-contracts.test.mjs`
- `_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/local-integration/*`
- `_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/visual-reconciliation/*`
- `_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/agents/DARWIN_REPORT.md`

`storyforge-v5/scripts/scan-bundle-secrets.mjs` is intentionally restored but
matches the repository's broad `*secret*` ignore rule. The Supervisor must
force-add that exact verified file when staging the candidate.

## Remaining production prerequisites

This local repair does not prove production readiness. The Supervisor must still establish authenticated provider targets, protected restore points, the exact redacted founder mapping, a matching database role/row, protected deployment authority, and production validation before any enablement.
