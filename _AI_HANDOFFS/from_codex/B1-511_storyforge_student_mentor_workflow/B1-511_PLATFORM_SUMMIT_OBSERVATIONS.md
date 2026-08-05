# B1-511 Platform Summit Observations

These are observations only; B1-511 did not implement platform-wide changes.

1. The product-owned WordPress route, short-lived signed identity, same-origin
   gateway, isolated Railway API, least-privilege PostgreSQL role, RLS, immutable
   frontend pointer, and per-feature rollback controls form a proven Matrix app
   pattern.
2. Product domains should reuse the pattern, not StoryForge tables, routes,
   services, secrets, storage namespaces, identity namespace, or release pointer.
3. The release tool should make deployment root explicit and refuse repository
   root uploads; the B1-511 Railway packaging incident shows why.
4. Kinsta promotion evidence should rely on exact readback and live hashes while
   its WP-CLI/cache-helper instability is repaired separately.
5. Human-perceptual audio gates should be scheduled with a consenting synthetic
   record before population activation; automation cannot legitimately replace
   the judgment.
6. Critical Systems reconciliation should remain a narrow post-promotion change
   to the exact new immutable aliases/hashes.
