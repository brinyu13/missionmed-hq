# Security, RLS, and Privacy Review

Result: **LOCAL PASS / PRODUCTION UNAPPLIED**

Controls implemented and tested:

- exact signed WordPress-to-HQ audience binding;
- exact beta cohort and entitlement checks at WordPress, HQ, and RISE;
- no public or anonymous contribution;
- CSRF on all mutations;
- server-side validation and request-size limits;
- HTTPS-only online source URLs;
- HMAC-pseudonymous runtime subjects;
- private contributor identity table and explicit public/admin SQL projections;
- forced RLS on all Student Intel tables;
- PUBLIC schema/table denial;
- nonsuperuser, no-BYPASSRLS runtime role;
- cross-user identity denial;
- public report visibility without identity exposure;
- hidden-record denial;
- student moderation/update denial;
- admin identity access;
- immutable audit and promotion ledgers;
- no frontend Parallel/service-role/database key.

Physical disposable PostgreSQL rehearsal applied migrations 005 and 006, connected as `rise_app_login`, and passed every hostile verifier check. Its transaction rolled back both synthetic Student Intel and My Programs rows to zero.

The first `/tmp` rehearsal attempt failed during `initdb` with a host `No space left on device` report and created no database. A second no-sync rehearsal under `/Users/brianb/Downloads/rise-5007-pg.jmgSml` passed and was stopped; the directory remains as inspectable local test residue.

The production database was not touched.

