# HomeBase V1 — MissionMed Matrix 360 Session HomeBase

**Ticket:** HB-360A-001 · **Base:** StoryForge V5 live commit `084ce55c1ce377595314580ab979c213f1c0405f`

HomeBase is the session-specific command center for MissionMed students and Dr Brian.
First deployment: **360 Match Mentorship — Session A**.

It answers, at a glance: Where am I? Who has the ball? What do I still owe?
What is Dr B working on? What happens next? What is due this week?

## Architecture

- **Shell/UI:** forked byte-for-byte from live StoryForge V5 (`public/styles.css`,
  fonts, logo, interaction grammar). HomeBase-specific vocabulary is appended at
  the end of the stylesheet under the `HomeBase V1 additions` banner.
- **API:** isolated Node runtime (`server/app.mjs`) in the StoryForge idiom —
  WordPress-signed bearer identity, per-request database identity, additive
  activity records. Deploys as its **own Railway service** with its **own
  PostgreSQL database**. It never touches the StoryForge service or database.
- **Data model:** PROGRAM → SESSION → STUDENT ENROLLMENT
  (`infra/postgres/migrations/`). Checklist categories/items are fully
  admin-editable; per-student state carries the nine operational statuses and
  "who has the ball".
- **Roster gate:** the only automatic hydration source is the HB-360A-001
  hard allowlist (12 people, seeded with missing fields flagged — never
  guessed). Students resolve to enrollments by signed WordPress user id, then
  signed email, then signed username. Name-only matches require admin review.
  `+ ADD STUDENT` in the admin roster is the only post-hydration add path.
- **WordPress seam:** `infra/wordpress/missionmed-homebase-route.php` (route +
  release gateway for `/homebase/`, forked from the StoryForge route adapter)
  and `wp-content/plugins/missionmed-homebase-sso` (bootstrap + token issuer,
  forked from the StoryForge SSO plugin; audience `homebase`, claim
  `homebase_eligible`).
- **File Vault / Calendar:** reused, never rebuilt. The frontend calls the
  same-origin `/mmed/v2` File Vault and `/mmed/v1/events` Calendar REST
  contracts with the WordPress cookie session; HomeBase stores only metadata
  links (`hb_files`).

## Environment

`HOMEBASE_*` mirrors the StoryForge configuration surface: `DATABASE_URL`,
`PUBLIC_ORIGIN`, `BASE_PATH` (`/homebase/` in production), `JWT_ISSUER`,
`JWT_AUDIENCE` (`homebase`), `JWT_SECRET`/`JWKS_URL`, `ALLOWED_ORIGINS`,
`ORIGIN_API_ONLY`, `DEV_AUTH`/`DEV_JWT_SECRET` for local fixtures.
Secrets live only in the provider environment — never in this repository.

## Local fixtures

```
HOMEBASE_DEV_AUTH=1 HOMEBASE_DEV_JWT_SECRET=local-fixture-secret-24ch \
HOMEBASE_JWT_ISSUER=http://127.0.0.1:4190 \
HOMEBASE_DATABASE_URL=postgres://... npm start
```

Personas: `admin` (Dr Brian lens), `student` (Afthab fixture), `studentOther`,
`studentOutsideRoster` (proves the roster gate denies non-Session-A students).

## Waves

Wave 1 (this package): shell, roster, admin/student views, Home, editable
checklist, progress, PS tracker, tasks, priorities/alerts, ownership,
deadlines, activity, File Vault linkage, live Matrix route.
Waves 2–4 (queued): richer Calendar/Vault integration, headshot pipeline +
Avatar Studio, notification bus/WhatsApp adapter, replay library, Webex → R2.
