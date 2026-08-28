# 15 — Security Review

## Local Passes

- production refuses preview/test authentication and synthetic source material;
- issuer/audience/expiry/revocation/capability-bound host sessions;
- server-side CSRF enforcement for mutations;
- no browser provider/service-role/Parallel secrets;
- source-rights authorization and revocation checks on authenticated reads;
- artifact/index/build SHA-256 verification;
- production requires durable shared abuse and student-state adapters;
- student-state subject is HMAC-pseudonymized and response-bound;
- proposed table enables and forces RLS, revokes `PUBLIC`, and uses a no-login least-privilege runtime role;
- immutable release/audit controls and non-destructive rollback;
- bounded request bodies, notes length, catalog/read rate cost, and response adapter size/time limits;
- npm audit reports zero known vulnerabilities.

The proposed RLS/role design follows the reviewed Supabase/Postgres guidance: RLS plus table privileges, indexed policy columns, and migration custody. No Supabase project was touched.

## Known Compatibility Tradeoff

The locked Fable markup uses inline `onclick` and inline style attributes. To preserve it without a redesign, CSP allows `script-src-attr 'unsafe-inline'` and `style-src-attr 'unsafe-inline'`; external script/style sources remain self-only and module code is not inline. Replacing the attribute handlers would be an engineering refactor that requires a new preservation proof before production acceptance.

## Provider-Level Result

`SECURITY_GATES_PASS = NO` because live auth, routing, registry source rights, database/RLS application, secrets, shared controllers, backup/restore, and provider smoke tests are absent. This does not negate the local test result; it prevents activation.
