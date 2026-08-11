# B1-514 Production Preflight and External Gates

## Verdict

**STOP-SAFE FOR CUTOVER — LOCAL CANDIDATE COMPLETE; EXTERNAL GO INPUTS ABSENT**

## Completed preflight

- Clean, deterministic release `v-06c677f9362ced63` from commit `0d1db330713a94051301ec94d4c7c7dc96a1486c`.
- Final ten-migration train `3c3f02099c3d47a549582c417cab9e27e68c6f48bbf4f854838a63285f9e25a1`.
- Exact isolated PostgreSQL 18 V1 survival PASS with zero differences and real R2 HEAD verification.
- Full unit, PostgreSQL/RLS, enabled browser, full E2E, conformance/accessibility, API, secret, dependency, provenance, and Critical Systems gates passed.
- Railway project and service access remain authenticated read-only.
- Kinsta SSH and current pointer identity were independently reverified; live still points to the B1-512C release.
- Production variable-name audit confirms the new gateway/Postmark/request configuration is absent. No secret values were printed.

## External Gate E1 — healthy WordPress integration runner

The local Docker/OrbStack runtime is unavailable, and binding steering prohibits further container-runtime troubleshooting. Run this exact candidate in an authorized healthy container environment:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5
PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH \
STORYFORGE_EXPECTED_COMMIT=0d1db330713a94051301ec94d4c7c7dc96a1486c \
npm run test:integration
```

Require the complete JWT, guest-token, signed-pseudonym, webhook custom-header-to-HMAC, PUT/DELETE, multipart, body-limit, and near-miss denial matrix to pass.

## External Gate E2 — Postmark account facts and controlled canary

The following Railway variable names are absent: `STORYFORGE_POSTMARK_ENABLED`, `STORYFORGE_POSTMARK_DRY_RUN`, `STORYFORGE_POSTMARK_LIVE_SEND_ENABLED`, `STORYFORGE_POSTMARK_FROM`, `STORYFORGE_POSTMARK_REPLY_TO`, `STORYFORGE_POSTMARK_SERVER_TOKEN`, `STORYFORGE_POSTMARK_WEBHOOK_SECRET`, and `STORYFORGE_PUBLIC_URL`. `STORYFORGE_GATEWAY_SHARED_SECRET`, `STORYFORGE_REQUEST_A_STORY_FORCE_OFF`, and `STORYFORGE_GUEST_FORCE_OFF` are also absent.

Required actions:

1. Verify the Postmark From and Reply-To identities and exact message stream.
2. Configure one high-entropy custom webhook header named `x-storyforge-webhook-token` at the canonical WordPress webhook URL.
3. Set the same secret in WordPress as `MISSIONMED_STORYFORGE_POSTMARK_WEBHOOK_SECRET` and Railway as `STORYFORGE_POSTMARK_WEBHOOK_SECRET`.
4. Set a separate high-entropy WordPress/Railway gateway secret pair.
5. Keep live send disabled; verify dry-run preview first.
6. Perform one non-private Founder canary and require Delivery, Open, Bounce, and SpamComplaint reconciliation behavior without resend or PII logging.

## External Gate E3 — fresh recovery points

Immediately before any production write:

- create and lock a fresh Railway PostgreSQL provider-native backup;
- create a fresh MyKinsta Live-site backup and verify Restore;
- create a private Kinsta route/pointer snapshot;
- bind provider IDs, timestamps, retention, current system identifier, the PG18 dump hash, source commit, release ID, and migration-train hash in one receipt.

The existing locked Railway backup and Kinsta backup are historical B1-512 evidence and are not represented as fresh B1-514 recovery points.

## External Gate E4 — production canary ladder

After E1-E3, deploy with all V2 features off. Then verify, in order: Founder student, Founder administrator, two eligible students, ineligible user, anonymous user, assigned mentor, private/direct-ID denial, mentor audio, guest link, Postmark lifecycle, Matrix navigation, zero Bootstrap Demo, zero HTTP 5xx, zero R2 orphan, and rollback preflight. Widen one feature rung only after the prior rung passes.

## Precise next action

Run E1 on a healthy authorized container host and provide an authenticated Postmark account/session or scoped credential for E2 read-only verification. Only after both pass should the operator create E3's fresh expiring recovery points and proceed to the guarded default-off cutover.

## No mutation statement

No production migration, Railway deployment, Kinsta upload or pointer change, WordPress option change, R2 write/delete, Postmark call, feature activation, or pull request occurred. Repository custody was committed and pushed normally; no force push or history rewrite occurred.
