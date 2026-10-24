# I1Q-1008F Nested Metadata Cleanup Addendum

## Authority and bindings

This addendum is governed by Brian's I1Q-1008F-R authority and the filed source-boundary metadata decision. `SOURCE_BOUNDARY` means the approved I1Q-1008E restricted boundary, root inode `221589069`; `TARGET_BOUNDARY` means the approved I1Q-1008F restricted boundary, root inode `222894551`. Both roots are device `16777234`, owner/group `501/20`, and mode `0700`.

The accepted Gold candidate is contract `de31610de045da1ea217a19dc4420e07c3deee9cf533482d3eeff301492d52ff` with shard-set root `4d906f3825cac5e8190bd8d379e512bcfb339fa2e4489a2bdceb7cd0eb7ff978`. It has 97 validated shards, orders 1–97, and zero files in `TARGET_BOUNDARY/raw`. `SOURCE_BOUNDARY` has exactly 4,148 authoritative files when Finder metadata is excluded.

## Exact authorized metadata files

Only the six alias-relative files below are authorized for unlink. Each independently verified as a regular Apple Desktop Services Store, device `16777234`, owner/group `501/20`, link count one, mode `0644`, without an open handle or symlink.

| Boundary | Relative path | Inode | Bytes | SHA-256 |
|---|---|---:|---:|---|
| `SOURCE_BOUNDARY` | `audit/.DS_Store` | 223973943 | 8,196 | `36970abd0b6197a2c68d3ca0afc92530a1763d32cb5b5382a01b0dcf28c695d3` |
| `SOURCE_BOUNDARY` | `quarantine/.DS_Store` | 223973946 | 10,244 | `d227ba2271f6f0589b3181d6987b66aa5e951f31f72f647acefe7eba32a38484` |
| `SOURCE_BOUNDARY` | `reviews/.DS_Store` | 223973942 | 8,196 | `c9a440b62fe77d06718175507f3a6f72b927957271ae3e56e8aef191aff75168` |
| `SOURCE_BOUNDARY` | `working/.DS_Store` | 223973944 | 8,196 | `0a756bd706e0c87a032f8cd54dd6154ce16208e9101fe37a9f8bc64070bf1618` |
| `TARGET_BOUNDARY` | `quarantine/.DS_Store` | 223973924 | 12,292 | `6f6f236e9ac2f139c3e292259c6cb1535c0c1739f1f60bdb9bc5afdeda4573c8` |
| `TARGET_BOUNDARY` | `working/.DS_Store` | 224030945 | 6,148 | `c07ec15742402a559afabe7ee1aad5f827e509b916cbef0d9552c64947c9408e` |

No wildcard, recursive removal, sibling mutation, source-artifact change, Gold-shard change, permission/ownership change, or production mutation is authorized. Preflight must reverify every path, inode, size, hash, type, link count, owner, mode, absence of handles, absence of targeted Finder windows, and at least 15 GiB available.

## Required postconditions

- All six exact files are absent and no other path was unlinked.
- Boundary root inodes, ownership, and modes are unchanged.
- `SOURCE_BOUNDARY` still has exactly 4,148 authoritative files.
- The accepted contract, shard-set root, 97-shard count, source hashes, and empty `TARGET_BOUNDARY/raw` invariant are unchanged.
- Available space remains at least 15 GiB; Git HEAD and upstream integrity remain unchanged by the unlink operation.

Sentinel's verdict is conditional GO only under these exact constraints. Any mismatch cancels the operation.
