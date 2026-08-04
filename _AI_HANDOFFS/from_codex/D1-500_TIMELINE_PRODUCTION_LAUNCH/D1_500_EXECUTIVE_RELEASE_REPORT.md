# D1-500 Executive Release Report

Status as of 2026-08-04: **PARTIAL — production activation blocked at the
pre-mutation gate**.

The accepted Timeline Builder has been converted into a clean, deterministic,
default-off production candidate and pushed for review. The application and
security core pass 614 automated tests, API-only packaging, PHP lint, dependency
audit, and a disposable PostgreSQL forced-RLS proof. The isolated Railway
project, production/staging environments, API service, and PostgreSQL service
exist. No user access is enabled and no Kinsta/WordPress application bytes have
been changed.

The Critical Systems reconciliation and protected Timeline registration are now
applied on `codex/d1-500-critical-registration` at commit `b75c789` and pushed
for review in draft PR 22. The full protected-systems gate passes 140 checks
with 0 failures. Immutable Matrix commit `60e7169b...` contains all ten approved
source bytes, and the controlling Matrix guard passes local/source/origin/public
verification without override. The Critical Systems production block is closed.

The mandatory pre-mutation backup/access gate is still open. A verified,
mode-restricted Timeline-scoped Kinsta snapshot exists at
`/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`, but all
five provider-native Kinsta manual slots are occupied. Railway CLI topology
access works, while Railway SSH requires Founder reauthorization. No provider
backup was deleted, no database migration ran, and no Kinsta application byte
was installed.

One consolidated Founder intervention is required before execution can resume:

1. reauthorize Railway CLI/SSH with `railway login`;
2. install the named Railway and Kinsta/WordPress secrets without exposing their
   values to Git, terminal output, evidence, or chat;
3. authorize removal of one existing Kinsta manual backup, or increase provider
   backup capacity, so a fresh `D1-500-PRE-<UTC>` backup can be created; and
4. provide or authorize controlled fixtures for the remaining canary personas:
   Founder, second eligible student, non-360 student, and expired/revoked
   student. One administrator and one active 360 test identity are verified
   directly in production and are referenced only by opaque handles; no
   password is stored in this package.

Consent version `d1-500-v1` and PostgreSQL service ID
`134e537e-d48b-4452-acf6-8c3af2ce03db` are Founder-approved. After the remaining
actions, the saved checkpoint resumes at provider backups, database migration,
feature-off deployment, Kinsta install, Founder/admin canary, 360 rollout,
independent verification, and release seal.
