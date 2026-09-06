# 3528C Results and Library Acceptance

## Implemented permanent contracts

- Durable sessions: `ivoc_sessions`.
- Private recording metadata: `ivoc_recordings`.
- Versioned structured results: `ivoc_results`, schema `ivoc.analytics.v1`; no DOM scraping.
- Mentor assignments/review state: `ivoc_reviews`.
- Personal calibration/visibility/coaching/recording defaults: `ivoc_preferences`.
- Access audit: `ivoc_access_log`.
- Results, Library, Recording Detail, Progress, Settings, and Mentor/Admin screens consume the server API.
- Results export is a structured JSON download; video export uses a server-authorized expiring media URL.
- Result events/history share the analytics/recording time basis for seekable moments.

## Acceptance

Schema, ownership behavior, API projection, result serialization, library scope, preferences, and recording-detail contracts pass automated tests. Production authenticated session creation was exercised. End-to-end production Results -> saved Library -> reopen -> replay -> timestamp seek -> downloads is **not accepted**, because private media cannot be sealed while the CDN signing mismatch returns `401`.

No placeholder recording or fake Results row was inserted to manufacture a pass.
