# B1-507 WordPress Gateway Receipt

Status: LOCAL AND DORMANT-PRODUCTION PASS.

Candidate route:

- SHA-256: `51d800dbe52e734aafadb274ec744c7dd710f601291b0ec4af05bc25b570ac3f`
- Size: 37,413 bytes

Local evidence:

- exact segment route accepts bounded multipart only;
- exact audio UUID route accepts DELETE only;
- near-miss routes remain denied;
- JSON remains required on other POST/PATCH routes;
- authorization, same-origin, feature-gate, redirect, response-size, and fail-closed controls remain;
- binary multipart reconstruction preserves bytes and excludes client metadata;
- PHP syntax passes;
- 3/3 dedicated gateway unit tests pass.

Production:

- active route SHA-256
  `51d800dbe52e734aafadb274ec744c7dd710f601291b0ec4af05bc25b570ac3f`;
- active size 37,413 bytes;
- active pointer
  `releases/09878514fff39b2d1f2ba3ee40c4c3de55ffc473`;
- exact extensionless app/auth/style aliases return 200;
- unknown/index/raw-extension aliases remain denied;
- bootstrap without a WordPress session returns 401;
- the authenticated Founder voice entrypoints return 403 `voice_disabled`
  before any upload/storage operation.

Multipart and DELETE gateway behavior is deployed but intentionally not
exercised with audio because this rung forbids uploading or retaining student
audio. Its production safety proof is the live force-off denial plus the local
3/3 route-shape suite, not a simulated upload.

The Matrix runtime guard passed all assets from the canonical source-bearing J1
worktree and public production. No recovery override was used. The B1-507 edit
is the isolated `storyforge-v5/infra/wordpress` route, not a protected
`missionmed-hub` asset.
