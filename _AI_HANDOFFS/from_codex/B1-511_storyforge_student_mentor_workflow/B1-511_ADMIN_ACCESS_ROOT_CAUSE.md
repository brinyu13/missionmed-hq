# B1-511 Administrator Access Root Cause

## Finding

The Founder identity was not missing and was not converted into a student. The
existing signed identity for WordPress user `107` mapped to StoryForge UUID
`56bb6d8a-4957-4ba6-abe1-7f77046061c8` with role `admin`. The practical defect
was that the already bounded administrator-console capability did not provide a
clear, persistent administrator landing path in the sole V5 renderer.

## Repair

- `storyforge-v5/public/app.js` now renders the existing administrator
  capability as `Administrator View` with persistent `Admin Home`, `Students`,
  `Review Queue`, and `Release Controls` navigation.
- `storyforge-v5/server/admin-console.mjs` extends only submitted-story search,
  queue, review, and taxonomy projections.
- `storyforge-v5/server/app.mjs` keeps the existing authenticated routes and
  delegates to the bounded admin service.
- Private and archived stories are omitted server-side. The UI cannot obtain
  them and merely explains the enforced boundary.

## Production evidence

At deployment `7b5a73e6-280f-4b7c-ac47-efd56c82a565`, a fresh 60-second token
for the existing Founder identity returned HTTP 200 from
`GET /api/admin/console/home`. No secret or token was printed or retained.
The payload contained only submitted-story metrics and returned zero private
records. A fresh authenticated Founder browser session was not available in
this run, so visual Founder acceptance remains a production-canary gate; it was
not fabricated from the API result.

## Blast radius

No WordPress user data, role, LearnDash enrollment, identity UUID, JWT contract,
route, or protected `missionmed-hub` asset changed.
