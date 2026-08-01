# B1-510H Deployment Receipt

## Deployment status

**Not deployed.**

No Kinsta, Railway, PostgreSQL, WordPress metadata, Cloudflare, R2, provider,
cache, or protected Matrix write occurred.

## Why deployment stopped

1. Three Founder-supplied usernames do not resolve exactly in production.
2. All 439 currently entitled non-admin students lack the required durable
   StoryForge UUID mapping; PostgreSQL contains only the two pilot identities.
3. No binding authority selects a durable identity-population mechanism.
   A redirect-only deployment would replace the legacy UI with
   `storyforge_identity_unmapped`, not a working product.
4. Fresh Kinsta, WordPress-meta, and PostgreSQL backup/restore receipts do not
   yet exist for a 439-identity write.

## Prepared candidate

- commit: `a8a156e4b6c213bb667cc6b0959be90692e4b8b9`;
- branch: `codex/b1-503-storyforge-product-recovery`;
- production product bytes: unchanged;
- Critical Systems: zero failures;
- Matrix protected source: unchanged and guard-passing.

## Smallest external actions

1. Founder confirms the correct existing identifiers for S03, S06, and S10.
2. Binding authority chooses either:
   - a backup-bound, repeatable current-entitlement identity synchronization
     into existing WordPress UUID metadata and `sf_users`; or
   - an explicitly authorized just-in-time provisioning design.
3. After that ruling, create fresh backups, run dry-run conflict checks, apply
   only exact eligible student mappings, deploy the two-file SSO seam, and run
   the live acceptance matrix.
