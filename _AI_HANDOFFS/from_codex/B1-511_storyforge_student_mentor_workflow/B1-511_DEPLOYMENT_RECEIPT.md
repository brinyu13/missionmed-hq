# B1-511 Deployment Receipt

## Frontend

- release ID: `v-312210a91ba0e46f`
- exact release source: `35ca96434f3d42feb236b78479007588d152404a`
- Kinsta pointer: `releases/35ca96434f3d42feb236b78479007588d152404a`
- route SHA-256: `744c8f859d4112cbc3a1eef6232dfaa6318bd21147c20ae3501d4f69eba6bd0e`
- generated runtime SHA-256:
  `ca8322dba846d0b22aacf5fde586ea4752268fd18fdee26412cb83d7269898dc`
- public index SHA-256:
  `e95bc125769a19098b2709850652b4c486ad1123a286495f2840a1f8cb45a4ca`
- public app SHA-256:
  `965df7cfd44f0beaa428e8628819eaacf4d446bb7e5b80e46da95a3bea3b4c55`
- public styles SHA-256:
  `dddc33507fd06073e5063f81c678e10f977a9dcd07d397b194f3222f3000f518`
- public auth SHA-256 unchanged:
  `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6`

All four live bytes were independently downloaded and hashed. The previous app
alias returns 404, as required for the immutable current-release map.

## Backend

- Railway deployment `7b5a73e6-280f-4b7c-ac47-efd56c82a565`
- status `SUCCESS`, one `us-west2` replica
- image digest
  `sha256:31ce410c322872a238d9c20324a29f621d3529eaa37d804cbf27abc0f8f5133f`
- build `npm run build:api`; start `npm start`; health `/healthz`

One incorrect repository-root upload was detected before acceptance and
canceled/removed. During correction, `railway down` removed the prior active
deployment instead of the unwanted build, causing a brief API gap. The exact
StoryForge package was immediately deployed and health, one-replica topology,
authenticated student recovery, and zero post-deploy 5xx were verified. This
incident is not omitted from the receipt.

## Database and flags

Migration ledger records exact migration SHA, source commit `ded8852...`, and
backup ID `9d5468b6-d9c5-4c86-913b-9faeed7aa6c5`.

Current live scope:

- `story_workflow`, `story_taxonomy`, `inline_priority`, `story_search`:
  `allowlist`, 3 exact UUIDs, 0 cohorts
- `mentor_notes`: `off`, empty allowlist/cohorts
- `STORYFORGE_MENTOR_NOTES_FORCE_OFF=1`

This is a controlled canary, not population-wide mentor-note activation.

## Kinsta operational note

Kinsta WP-CLI segfaulted after otherwise successful option writes and its cache
helper returned an unexpected body. Exact option readback, pointer, route, and
public byte hashes proved the promotion. The known CLI/cache anomaly remains
documented; it did not justify a false rollback.
