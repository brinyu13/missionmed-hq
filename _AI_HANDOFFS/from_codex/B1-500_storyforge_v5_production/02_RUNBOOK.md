# StoryForge V5 Local Verification Runbook

This runbook is for the isolated B1-500 source package. It is not production deployment authority.

## Preconditions

- Run from the repository root.
- Verify the canonical artifact hash:

```sh
sha256sum _AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html
```

- Verify the current branch and worktree:

```sh
git branch --show-current
git status --short
```

- Before any protected integration, run:

```sh
python3 _SYSTEM/tools/matrix_runtime_guard.py preflight --assets all --verify-public
```

A blocked guard means no protected edit or deployment.

## Install isolated dependencies

```sh
npm install --prefix storyforge-v5
```

## Real PostgreSQL suite

```sh
npm run test:postgres --prefix storyforge-v5
```

The script creates an ephemeral PostgreSQL 16 cluster under `/tmp`, applies the candidate migration, executes the authorization matrix and lifecycle checks, and destroys only its own temporary cluster.

## Browser suite

```sh
npm run test:e2e --prefix storyforge-v5
```

The browser suite uses installed Google Chrome, an ephemeral real PostgreSQL cluster, and locally signed fixture identities that are enabled only by `STORYFORGE_DEV_AUTH=1`.

## Local manual browser

```sh
npm run dev:db --prefix storyforge-v5
```

Use the printed loopback URL. Local fixture identity is not production WordPress SSO.

## Production hard stops

Do not apply a migration, mount the app, create a bucket, change shared auth, stage, or deploy until all of the following are pinned:

- StoryForge Supabase project ref and migration history;
- verified protected Matrix source worktree and owner;
- StoryForge auth audience plus server-signed eligibility claim;
- mentor-assignment source and synchronization owner;
- private audio bucket, lifecycle, CORS, signed URL TTL, and retention policy;
- staging credentials and rollback point;
- required founder policy/UAT/go-live approvals.
