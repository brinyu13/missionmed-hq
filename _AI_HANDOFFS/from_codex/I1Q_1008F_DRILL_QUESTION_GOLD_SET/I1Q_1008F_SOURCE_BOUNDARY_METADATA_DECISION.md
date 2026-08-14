# I1Q-1008F Source-Boundary Metadata Decision

## Authority and scope

Brian, through ticket I1Q-1008F-R, authorized autonomous storage recovery and continuation of the I1Q-1008F Gold Set mission while preserving the validated I1Q-1008E corpus. This decision authorizes one non-corpus metadata cleanup and nothing else.

The only authorized path is `/Users/brianb/MissionMed_AI_Sandbox/I1Q-1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/.DS_Store`. At the decision gate it was an ordinary Apple Desktop Services Store file: 8,196 bytes, inode `223973945`, device `16777234`, link count one, owner/group `501/20`, mode `0644`, and SHA-256 `468a3d03d1b6903acc737c571e2df95bdd1607b9e8c721b52b6f92babfdb6164`. It was born after the restricted boundary and had no open handle or symlink. Excluding this file, the predecessor boundary contains exactly 4,148 authoritative files, matching its accepted corpus count.

## Decision

After this record is committed and pushed, the Supervisor may revalidate every fact above and unlink only that exact file. No wildcard, recursive removal, sibling mutation, corpus rewrite, permission change, ownership change, source-artifact modification, repository cleanup, snapshot change, or production mutation is authorized.

## Required postconditions

- The exact metadata file is absent.
- The source-boundary root remains inode `221589069`, owner/group `501/20`, and mode `0700`.
- The authoritative non-metadata file count remains exactly 4,148.
- Predecessor artifact hashes, manifests, coverage roots, and processing-ledger roots remain unchanged.
- The I1Q-1008F restricted checkpoint, Git refs, worktree registry, and production systems remain unchanged.
- Finder windows targeting the 1008E or 1008F boundaries are closed before unlink and final verification; unrelated Finder windows are not changed.

Sentinel's verdict is conditional GO under these exact preconditions and postconditions. Any mismatch cancels this decision.
