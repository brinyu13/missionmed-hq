# Matrix Calendar Live Schedule Integration

## Endpoint

`GET /wp-json/missionmed/v1/examprep/live-schedule`

## Selection contract

- Table: `wp_mmed_events`.
- `user_id = 0`.
- `source = system`.
- `status = active`.
- type/category restricted to `drill_step1` or `drill_step23`.
- parsed metadata must include `drj_default=true`.
- time window: now through 32 days; maximum 40 events.

## Public response

Only `id`, `title`, `topic`, `track`, `start`, and `end` are returned. Meeting URLs, descriptions, attendees, user identity, and raw metadata are excluded. Responses are cached for 60 seconds and rendered in the browser’s local time.

## Acceptance

- 20 current events returned.
- First accepted event: `Dr. J Drill: Onc by systems`, Step 1 / COMLEX Level 1, `2026-09-21T13:00:00+00:00`.
- Public response key audit contained only the six allowed event fields.
- Existing protected Matrix event endpoint remains protected; this integration is a narrow sanitized projection.
