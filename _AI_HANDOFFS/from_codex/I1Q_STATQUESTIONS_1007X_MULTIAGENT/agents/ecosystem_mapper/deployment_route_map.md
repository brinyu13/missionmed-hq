# I1Q-1007X Deployment Route Map

## Authority Snapshot

| Evidence | Verified state |
| --- | --- |
| MissionMed OS | Clean `main` at `93c0404794fe105235b80514c75fffc3177f140b`; local `origin/main` points to the same commit |
| Current mission | `I1Q-1006` is active; its next action is execution of `I1Q-1007X-MA` with student, STAT, and Drills consumer flags off |
| Integration authority | DR-006 is merged and indexed as `I1Q_DR_006`; SHA-256 `8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae` |
| Missing authority | `MM-AUTH-ARCH-001` is referenced by MR-078B and MR-079 but no matching authority file exists in the canonical local trees |
| Production rule | Runtime truth wins; manifest pins determine deploy readiness; protected deployment requires the Critical Systems Contract gate |

No deployment, migration, feature-flag change, cache operation, or live probe was performed by this mapper.

## Route Summary

| Surface | Current source | Control plane | Runtime destination | Current I1Q status |
| --- | --- | --- | --- | --- |
| MissionMed HQ | `missionmed-hq/server.mjs` | External GitHub-to-Railway binding is implied by the protected runtime, but its branch/service configuration is not stored here | Railway, start command `node missionmed-hq/server.mjs` | Protected dependency only; not an I1Q deployment target |
| WordPress auth and wrappers | `wp-content/mu-plugins/*.php` | Kinsta/WordPress deployment mechanism is not represented in this worktree | WordPress first-party routes and auth relay | Protected dependency; no I1Q route registered |
| Arena/STAT/Drills/Daily HTML | `LIVE/{arena,stat,drills,daily}.html` | `_SYSTEM/deploy.sh` with Git upstream gate, validation, R2 staging, promotion, cache handling, and runtime checks | R2/CDN `html-system/STAGING/*` then `html-system/LIVE/*`; WordPress proxies preserve first-party routes | Existing consumers only; I1Q must not use this path without a new manifest mapping and approval |
| RANKLISTIQ data | Separate protected migration route required by MR-078B/DR-006 | Canonical GitHub preview/staging process; exact workflow not found locally | RANKLISTIQ additive `i1q` schema | Authorized target, but no apply-ready migration or route evidence exists |
| Growth Engine data | Root `supabase/migrations/` per MR-078B | MR-078A-governed migration process | Growth Engine project | Not the I1Q datastore target |
| I1Q service | `i1q-question-platform/` | No workflow, Railway service declaration, host registration, or production manifest entry found | Dedicated authenticated internal app required by DR-006 | Not deployed |

## HQ Production Route

The verified repository route is:

```text
reviewed Git commit
  -> externally configured Railway source binding (branch and trigger UNKNOWN)
  -> Nixpacks build from repository root
  -> railway.json deploy.startCommand
  -> node missionmed-hq/server.mjs
  -> HQ health/auth/bootstrap/media/API routes
```

Verified files:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/package.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/railway.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/missionmed-hq/server.mjs`
- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`

`app/api/**` is an inactive lookalike for current Railway production. It must not be edited to repair HQ.

Deploy-readiness blockers:

- The Critical Systems Manifest pins known-good commit `3f0c27aac55dbf82748b3eaba360006d4041b539`; current `missionmed-hq/server.mjs` differs from that pin. Production parity was not queried.
- The manifest requires `.railwayignore`, but no such file exists in this worktree.
- The repository has no `.github/workflows/` directory, so the DR-006 canonical GitHub promotion route is not auditable from local files.
- Root `railway.json` always starts HQ. Deploying the repository as-is does not start the I1Q package.
- The exact Railway project, production branch, automatic-deploy trigger, environment binding, and rollback selector are external configuration and remain UNKNOWN.

## WordPress And CDN Routes

| First-party route | Runtime source | Verified proxy |
| --- | --- | --- |
| `/arena` | `html-system/LIVE/arena.html` | `wp-content/mu-plugins/arena-route-proxy.php` |
| `/stat` | `html-system/LIVE/stat.html` | `wp-content/mu-plugins/stat-route-proxy.php` |
| `/drills` | Drills or Daily artifact selected from request state | `wp-content/mu-plugins/drills-route-proxy.php` |
| `/daily` | `html-system/LIVE/daily.html` | `wp-content/mu-plugins/drills-route-proxy.php` |
| `/api/drills` | MMVS Railway registry | `wp-content/mu-plugins/mmvs-drills-proxy.php`; GET only |
| `/api/auth/*` | MissionMed HQ Railway | `wp-content/mu-plugins/missionmed-hq-proxy.php` |

The current HTML promotion implementation is:

```text
LIVE source files
  -> VALIDATION/validate_deploy.sh
  -> Git HEAD/upstream equality gate
  -> local rollback snapshot
  -> R2 STAGING upload
  -> VALIDATION/validate_runtime.sh --env STAGING
  -> R2 server-side copy to LIVE
  -> cache purge or cache-busted verification fallback
  -> VALIDATION/validate_runtime.sh --env LIVE
  -> CDN checksum and WordPress wrapper probes
```

The older `_SYSTEM/PRIMER_EXT_HTML_DEPLOY.md` names legacy local source paths and describes direct upload. Current `LIVE/*`, `_SYSTEM/DEPLOY_MANIFEST.json`, `_SYSTEM/deploy.sh`, and runtime behavior take precedence. The documentation drift requires owner reconciliation before extending the route.

## Supabase Promotion Boundary

DR-006 requires a new additive `i1q` schema in RANKLISTIQ, preview/staging first, through the canonical GitHub route. It prohibits manual production SQL, migration-history rewrites, and destructive rollback.

Current local state:

- `i1q-question-platform/db/migrations/0001_i1q_question_platform.sql` is a design artifact. Its filename and missing MR-078A header make it non-apply-ready.
- The design uses forced RLS and default-off flags, but it has not been run against preview, staging, or production Postgres.
- Root `supabase/migrations/` is declared by MR-078B to target Growth Engine even though it also contains historical STAT/RANKLISTIQ artifacts. It is not a safe location for an I1Q migration without an explicit route decision.
- No local workflow pins the RANKLISTIQ project, migration set, preview environment, approval gate, or promotion evidence.
- Growth Engine migration history is documented as desynchronized. No I1Q action may attempt to repair or reuse that history.

Required route before any database claim:

```text
reviewed, correctly named forward migration
  -> explicit RANKLISTIQ project/schema/object pin
  -> isolated preview apply and lint
  -> forced-RLS denial matrix and pooled-context tests
  -> forward compensating disable and reapply proof
  -> protected Arena/STAT regression baseline
  -> reviewed staging promotion
  -> internal production promotion with consumer flags off
```

## Required I1Q Route

No current route satisfies this sequence. Root must register one before deployment:

1. Pin one reviewed source commit and a dedicated I1Q build context.
2. Run unit, adapter, auth, privacy, accessibility, dependency, and evidence validation.
3. Apply only the reviewed RANKLISTIQ migration in preview; preserve migration history.
4. Validate canonical WordPress/HQ identity, app-owned role assignments, transaction-local database context, forced RLS, and negative authorization.
5. Deploy a dedicated internal service or a separately authorized HQ module; never silently replace HQ.
6. Run staging browser journeys and protected-consumer tests with internal platform, internal review, STAT, Drills, and student flags off.
7. Exercise feature-flag disable, known-good application rollback, forward database compensation, and post-rollback tests.
8. Promote only authenticated internal access after independent release review. Consumer and student activation remain separate decisions.

## Rollback Route

DR-006 defines the controlling rollback behavior:

- Disable internal platform and consumer flags.
- Redeploy the last known-good application artifact through the canonical GitHub route.
- Use only a reviewed forward compensating migration for datastore disablement.
- Preserve audit events, source hashes, immutable revisions, release evidence, sealed packs, and historical joins.
- Never rewrite migration history, mutate frozen STAT datasets, force-push, use `railway up`, replace runtime files directly, or make undocumented cache changes.

The candidate compensating SQL exists at `i1q-question-platform/db/rollback/0001_compensating_disable.sql`, but execution has not been proven on an authorized database.

## Deployment Verdict

`BLOCKED_FOR_I1Q_DEPLOYMENT`. Authority exists for a gated internal path, but the local repository does not contain a complete I1Q GitHub workflow, dedicated runtime registration, apply-ready RANKLISTIQ migration route, protected manifest coverage, or rollback/reapply evidence. Existing HQ, WordPress, Supabase, and CDN routes remain protected and unchanged.
