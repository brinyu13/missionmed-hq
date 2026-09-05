# Rollback WP-1 — Matrix Runtime Lock

Status: PREWRITTEN; NOT EXECUTED because no Matrix mutation occurred.

Pre-state is the public hash set recorded in `HB-360A-005R_REPORT.md`, with divergent canonical/branch manifests and an unresolved deployment receipt. Before any future mutation, capture exact public bytes, source blobs, manifest, CDN headers, deployment identity, and the approved asset-key set.

If a future manifest-forward change fails, restore the previous tracked manifest through a normal forward revert, purge only the affected cache keys if separately authorized, and verify public bytes, manifest, and receipt converge. If a locked-byte redeploy fails, redeploy the captured pre-state bytes for only the approved asset keys and repeat public hash/browser/runtime checks.

Never reset, force-push, overwrite unrelated Matrix assets, or use the dirty root as a donor. The exact Founder override phrase remains mandatory.
