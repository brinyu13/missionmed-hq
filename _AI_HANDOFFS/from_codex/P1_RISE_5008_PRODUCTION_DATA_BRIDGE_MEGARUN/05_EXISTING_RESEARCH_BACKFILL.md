# Existing Research Backfill

The live production backfill consumed only completed, validated research inputs. It found 811 completed files, removed 270 exact duplicate Claude/Opus inputs, and ingested 541 unique runs: 271 Parallel and 270 Claude/Opus.

Provider-native production readback:

- `CLAUDE_OPUS`: 270 runs / 977 claims.
- `PARALLEL`: 271 runs / 2,063 claims.
- `NRMP_SOAP_CLOSURE`: 1 run / 925 claims.
- Total: 542 runs / 3,965 claims / 886 identities.
- New spend: `0.0000`.
- Research claims: 3,015 `REVIEW_REQUIRED / PENDING` plus 25 `REVIEW_REQUIRED / PENDING_RIGHTS_AND_FIELD_REVIEW`.
- SOAP claims: 922 `PRIVATE_BETA / APPROVED` and 3 `INTERNAL_ONLY / REVIEW_REQUIRED`.

Dry-run and replay validation remained idempotent. Existing Parallel and Claude/Opus research converged into the same canonical evidence tables. No producer, queue, sprint script, or reserved tranche was changed.
