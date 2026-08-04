# D1-500 Identity, Entitlement, Authorization, and RLS

Identity is an immutable mapping from WordPress numeric user ID to a UUID
Timeline principal. The browser cannot supply or change that identity. Tokens
are short lived, bind issuer, audience, key ID, WordPress user, Timeline role,
course access, rollout stage, entitlement version, consent version, and remote
sync authority. Account or persona changes lock the local production client.

Student authorization requires all of: authenticated WordPress session, current
LearnDash access to course 3893, enabled rollout stage, immutable principal
mapping, and current consent version. Administrators require explicit canary
allowlisting and do not gain student-document access merely from the WordPress
administrator role. Access to a student record requires a separate exact,
time-bounded, audited resource grant.

Disposable PostgreSQL proof result: PASS.

- schema `d1-timeline-db-500.1`;
- 3 safe runtime roles;
- 0 least-privilege leaks;
- 0 public access surfaces;
- 0 tables without forced RLS;
- owner read/write: PASS;
- cross-student read/write denial: PASS;
- absent-course-entitlement denial: PASS;
- administrator without grant denial: PASS;
- exact administrator read grant: PASS;
- grant mutation, reuse, deletion, and missing-audit denial: PASS;
- grant revocation: PASS;
- immutable identity update denial: PASS.

Production result remains NOT RUN because the provider database migration and
principal fixtures are blocked before secret binding and canary identity
approval.
