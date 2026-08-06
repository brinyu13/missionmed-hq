# B1-511 Administrator Access Root Cause

## Corrected finding (B1-511A, 2026-08-06)

The earlier identity attribution in this receipt was wrong. WordPress user `1`,
username `brinyu`, is the Founder and has WordPress `manage_options`. Its
StoryForge UUID is `09c3b822-75e7-4f3f-bd3f-58afc0865a78`. Its persisted
StoryForge role correctly remains `student`, because that identity owns the
Founder's seven existing stories and student voice workflow. WordPress user
`107`, username `Brian_test`, maps to StoryForge UUID
`56bb6d8a-4957-4ba6-abe1-7f77046061c8` with role `admin` and remains an
additional administrator.

The actual defect was an authority-boundary error: the StoryForge application
treated its persisted product role as the only source of administrator
authority and did not carry the signed WordPress `manage_options` capability
through the bootstrap token. That hid Administrator View from `brinyu` even
though WordPress authoritatively grants the Founder global administration.

## Corrected repair

- WordPress signs a strict `wordpress_admin` claim directly from
  `user_can($user, 'manage_options')`.
- The API verifies that claim and selects bounded administrator mode only for
  administrator operations. Browser input cannot create that mode.
- PostgreSQL preserves the persisted base role while deriving an effective
  administrator role only when both the signed WordPress claim and the
  server-selected administrator mode are present.
- `storyforge-v5/public/app.js` gives `brinyu` an explicit Student View /
  Administrator View switch. Student View remains the default and keeps all
  existing stories, recording, transcription, and ownership paths unchanged.
- `Brian_test` remains an additional administrator.
- Private and archived stories are omitted server-side. The UI cannot obtain
  them and merely explains the enforced boundary.

## Superseded production evidence

Deployment `7b5a73e6-280f-4b7c-ac47-efd56c82a565` proved the bounded admin API
using WordPress user `107` (`Brian_test`); it did not prove Founder `brinyu`
administrator access. The B1-511A receipt records the corrected live canary.

## Blast radius

No WordPress user profile, stored WordPress role, LearnDash enrollment,
StoryForge UUID, persisted StoryForge role, story ownership, route, or protected
`missionmed-hub` asset changed. The JWT contract changed additively by one
server-signed Boolean authority claim.
