# StoryForge Request-a-Story Live Delivery Recovery

## Result

**DEPLOYED — VERIFIED WITH A DROP-ONLY PRODUCTION CANARY**

StoryForge Request-a-Story production delivery is live. A production application
canary created a draft, previewed it, sent it through the normal StoryForge API,
received Postmark acceptance, processed the signed delivery webhook, and was then
revoked. The only recipient was Postmark's official drop-only test address; no
person received the canary.

## Root cause

The screenshot's dry-run message was truthful: Railway had
`STORYFORGE_POSTMARK_DRY_RUN=1` and
`STORYFORGE_POSTMARK_LIVE_SEND_ENABLED=0`.

Before enabling live delivery, an exact provider replay proved a latent payload
defect in `storyforge-v5/server/requests.mjs`:

- `storyforgeDeliveryAttemptId` and `storyforgeInvitationId` exceeded Postmark's
  20-character metadata-key limit;
- `ordinal` was sent as a number instead of a string.

Postmark returned HTTP 422 / ErrorCode 300 and no MessageID. StoryForge correctly
treated the non-2xx result as ambiguous and refused to retry automatically, which
left the invitation draft private.

## Surgical fix

Runtime file:

- `storyforge-v5/server/requests.mjs`
  - sends `sfDeliveryAttemptId` and `sfInvitationId`;
  - sends `ordinal` as a string;
  - parses the same bounded keys from signed Postmark webhooks.

No database, RLS, WordPress, frontend, Matrix, LearnDash, role, identity, or
enrollment code changed.

Tests updated:

- `storyforge-v5/tests/unit/b1-514-request-lifecycle.test.mjs`
- `storyforge-v5/tests/unit/b1-514-delivery-attempts.test.mjs`

## Verification

- Focused Request-a-Story send/webhook tests: 18/18 PASS.
- Full unit suite: 503/503 PASS.
- `node --check server/requests.mjs`: PASS.
- `git diff --check`: PASS.
- `npm run build:api`: PASS.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Clean-commit release/provenance build: PASS.
- Secret scan: PASS.
- PostgreSQL 18 integration migration train: PASS.
- Disposable WordPress integration: PASS.
- Full Playwright integration: 8/8 PASS.
- Exact provider-contract replay with the corrected metadata: HTTP 200,
  ErrorCode 0, MessageID present.

The critical-systems report also recorded pre-existing unrelated USCE/static
manifest drift. This ticket did not alter or waive those assets. Its StoryForge
health and anonymous-denial checks passed.

## Git and artifact identity

- Worktree: `/Users/brianb/MissionMed_worktrees/SF-REQUEST-A-STORY-5017`
- Branch: `codex/sf-request-a-story-live-delivery`
- Base: `d53d7a411522bdf7c52e63b63a8af54524e18bb0`
- Implementation commit: `a80d1de69dd2c8845c5acc9ab0e7ace91becb9e9`
- Live/runtime `server/requests.mjs` SHA-256:
  `49a53ea2ffb92a6f126b513bc420984a56aaec63bda647b2fdb18b2ba0c56bc6`

## Rollback evidence

API predecessor archive:

- path:
  `/Users/brianb/MissionMed_recovery/SF-REQUEST-A-STORY-RUNdcX/api-predecessor-d53d7a411522.tar.gz`
- SHA-256:
  `20e2debf1123bed91e8462500732616bc146543ddd463e33e071b74fd6232e4a`
- size: 2,160,971 bytes
- owner/group: `brianb:staff`
- mode: `0600`

Database backup captured before the live-send attempt:

- path:
  `/Users/brianb/MissionMed_recovery/SF-REQUEST-A-STORY-RUNdcX/storyforge-production-before-live-send.dump`
- SHA-256:
  `18a0f48a723822becf5ced5f523a19517f0be3d412a742ec33158f6b67669930`
- size: 1,498,921 bytes
- mode: `0600`
- `pg_restore --list`: PASS

Rollback is: first restore `STORYFORGE_POSTMARK_DRY_RUN=1` and
`STORYFORGE_POSTMARK_LIVE_SEND_ENABLED=0`; then deploy the predecessor archive
to the exact StoryForge API service if runtime rollback is required.

## Deployment

- Railway project: `875e7c17-d06f-4301-a4bb-e61016f153cf`
- Environment: `bcef8734-e42b-44df-8488-c2a3de68213f`
- API service: `dab015bf-15ef-4698-9f16-cbf8cf23de7a`
- Code deployment: `396d690c-d37e-4d26-8716-e2dde39be1f2`
- Final configuration deployment: `01308d3b-6a91-4b4b-aced-0eb9e98b2ef8`
- Final image:
  `sha256:99ca9c08db8b46c450bf67d4b227593a457ed32e19e572e63b2443d8a953591f`
- Final flags: enabled `1`, dry-run `0`, live-send `1`.

## Production canary and stability

The production application canary proved:

- authenticated StoryForge session: HTTP 200;
- Request-a-Story capability: true;
- initial state: draft;
- preview: successful;
- send response: `dryRun=false`, `deliveryPending=false`;
- provider accepted: true;
- signed delivery webhook observed: true;
- provider message status: Sent;
- provider tag: `storyforge-request-a-story`;
- final synthetic invitation state: revoked;
- unresolved delivery attempts after the canary: zero.

Post-canary checks:

- public `/storyforge/healthz`: HTTP 200;
- direct Railway `/healthz`: HTTP 200;
- anonymous `/storyforge/api/session`: HTTP 401;
- attributable HTTP 5xx: zero;
- application error-level lines were only the existing Node/AWS SDK startup
  version warning and npm production-config warning;
- PostgreSQL migration ledger: 32 rows, unchanged;
- public RLS policies: 75, unchanged;
- frontend aliases unchanged: `03dfd2fc42f0`, `6bc7f9341a22`,
  `f091d62ac584`;
- WordPress SSO SHA-256 unchanged:
  `f3d34519f78cda688e4225cefb6ce9e1432fb7f3d4e9a28a490baae29c79f5c7`.

The first pre-fix application canary left one truthful append-only `abandoned`
delivery-attempt audit row after revocation. The successful final canary left one
`delivered` attempt and a revoked synthetic invitation. Neither targeted a real
person, and neither remains active or retryable.

## Student action

Existing drafts were deliberately not auto-sent. The student should reopen the
draft shown in the screenshot, preview it, and press **Confirm & Send** again.

## Residual uncertainty

The production path is proven through provider acceptance and the signed delivery
webhook using a drop-only address. Actual delivery to a particular relative's
mailbox depends on that recipient domain and inbox; no real recipient was used for
the safety canary.
