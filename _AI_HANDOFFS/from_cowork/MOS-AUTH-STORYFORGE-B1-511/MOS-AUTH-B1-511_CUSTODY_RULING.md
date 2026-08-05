# B1-511 Custody Ruling

Authority: DR-021 B1-511 StoryForge Founder-authorized bounded product enhancement
Date: 2026-08-05
StoryForge worktree HEAD: 0271dd7b232db58cda2a81a2132b6a508b7da48a
Local commits ahead of upstream: 47 (B1-507B through B1-510K accepted production lineage)

## Ruling: OPTION 2 — Temporary Custody Exception

### Rationale

This Cowork verification environment cannot independently verify the StoryForge worktree's git state. The worktree at `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` is a git worktree of the parent repository at `/Users/brianb/MissionMed`, and the parent `.git` directory at `/Users/brianb/MissionMed/.git/worktrees/B1-StoryForge-502` is not accessible from the Cowork device bridge sandbox. Specifically:

1. **Cannot verify local/upstream divergence**: Cannot run `git log origin/branch..HEAD` to confirm the exact 47-commit delta.
2. **Cannot run secret scan**: Cannot run `git log -p` or equivalent to verify no secrets in the commit history.
3. **Cannot verify no unrelated private files**: Cannot run `git diff --stat` against the upstream to confirm scope.
4. **Cannot verify clean worktree state independently**: The ticket asserts clean worktree and PASS for `git diff --check`, but this environment cannot confirm.

OPTION 1 (authorize push) requires all four verifications. Since none can be performed from this environment, OPTION 1 is NOT SAFE to authorize.

### Custody Exception Terms

B1-511 local implementation MAY continue on the clean existing worktree under these conditions:

1. **No force-push**: The 47 existing local commits must not be force-pushed, rebased, or amended.
2. **No history rewrite**: `git rebase -i`, `git filter-branch`, `git reset --hard` to before the 47 commits, and similar history-altering operations are prohibited.
3. **No merge**: No merge of upstream into the local branch or vice versa until custody is formally established.
4. **Deterministic source archive**: Before B1-511 implementation begins, Codex must create a deterministic source archive of the current worktree state:
   - `git archive --format=tar HEAD | sha256sum` to produce a SHA-256 receipt of the exact tree at HEAD `0271dd7b`.
   - Store the receipt in `_AI_HANDOFFS/from_codex/B1-511_CUSTODY/B1-511_CUSTODY_ARCHIVE_RECEIPT.txt`.
5. **Private backup custody**: The 47 local commits must be backed up through one of:
   - A local bare clone: `git clone --bare /path/to/worktree /path/to/backup/B1-StoryForge-502-custody-backup.git`
   - A deterministic bundle: `git bundle create /path/to/backup/B1-StoryForge-502-custody.bundle HEAD`
   - The backup path and its SHA-256 must be recorded in the custody receipt.
6. **Remote custody before production**: Remote custody (push to origin) MUST be completed before any B1-511 production deployment. This is a hard gate.

### Verification Requirements for Future OPTION 1 Transition

When a Codex session with access to the full git repository is available, the following must be verified before pushing:

1. `git log --oneline origin/<branch>..HEAD` confirms exactly the expected commit count and no unexpected commits.
2. `git log -p --diff-filter=A -- '*.env' '*.key' '*.pem' '*.secret*' '*credential*' '*token*'` returns empty (no secret files added).
3. `grep -r 'PRIVATE KEY\|sk_live\|password.*=\|api_key.*=' --include='*.ts' --include='*.js' --include='*.json' --include='*.env'` returns no actual secrets (false positives from schema/type definitions are acceptable).
4. `git diff --stat origin/<branch>..HEAD` shows only StoryForge-scoped files.
5. The push is a fast-forward only: `git push origin <branch>` without `--force`.
6. Post-push: `git rev-parse origin/<branch>` matches the local HEAD SHA.
7. Do not merge. Do not create a PR. Document custody with the remote SHA.

### Recording

This custody ruling must be recorded in the Codex continuation directive and in the B1-511 mission entry. The custody state is:

```
custody_state: LOCAL_ONLY_OPTION_2_TEMPORARY_EXCEPTION
remote_custody: REQUIRED_BEFORE_PRODUCTION_DEPLOYMENT
backup_custody: REQUIRED_BEFORE_B1_511_IMPLEMENTATION
push_authorized: NO_UNTIL_INDEPENDENT_VERIFICATION
force_push: PROHIBITED
history_rewrite: PROHIBITED
merge: PROHIBITED
```
