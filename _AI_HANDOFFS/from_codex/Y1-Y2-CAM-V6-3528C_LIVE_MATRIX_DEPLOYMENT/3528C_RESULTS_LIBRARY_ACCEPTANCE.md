# 3528C Results and Library Acceptance

## Permanent contracts

- Durable sessions: `ivoc_sessions`.
- Private recording metadata: `ivoc_recordings`.
- Versioned structured results: `ivoc_results`, schema `ivoc.analytics.v1`; no DOM scraping.
- Mentor assignments/review state: `ivoc_reviews`.
- Personal calibration/visibility/coaching/recording defaults: `ivoc_preferences`.
- Access audit: `ivoc_access_log`.
- Results, Library, Recording Detail, Progress, Settings, and Mentor/Admin screens consume the server API.
- Results export is structured JSON; video export uses a server-authorized expiring same-origin media URL.
- Result events/history share the analytics/recording time basis for seekable moments.

## Production acceptance

| Vertical-slice step | Result |
|---|---|
| Authenticated session creation | PASS |
| Real recording persistence | PASS |
| Structured Results persistence | PASS |
| Library list after save | PASS |
| Reopen recording detail | PASS |
| Request scoped playback URL | PASS |
| Stream private recording after reopen | PASS — `206 video/webm` |
| Timestamp seek interaction | Present; not separately physically exercised |
| JSON/video download controls | Present; not separately physically exercised |

Two real production sessions completed the durable save path. No placeholder recording or fake Results row was inserted.
