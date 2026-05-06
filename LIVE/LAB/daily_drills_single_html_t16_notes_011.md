# Daily + Drills Single HTML T16 Candidate 011

## Source

- Donor file: `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/T-16_DailyDrills_Production_013.html`
- Donor SHA256: `e27a996307c9df2fd9d352cd44ad120a7d2d79d16a6ecbe9ba93128693abf286`
- Target candidate: `LIVE/drills.html`
- LAB mirror: `LIVE/LAB/daily_drills_single_html_t16_candidate_011.html`

## Purpose

This candidate converts the T-16 Daily + Drills frontend concept into a single-file `LIVE/drills.html` candidate.

Expected routes:

- `/drills?entry=daily_rounds` opens the Daily/menu state inside `drills.html`.
- `/drills?video_id=...&origin_mode=daily_rounds` opens the Drills runtime state inside `drills.html`.

## Preserved Contracts

- Selection key: `sessionStorage.mm_selected_drill`
- Result key: `sessionStorage.mm_daily_drill_result`
- Bridge object: `window.MMDailyDrillsBridge`
- Query params: `entry`, `video_id`, `origin_mode`
- Result payload normalizes to:
  - `source: "daily_rounds"`
  - `video_id`
  - `drill_id`
  - `title`
  - `score`
  - `correct_count`
  - `total_count`
  - `completed_at`
  - `launch_id`
  - `persistence: "session_only"`

## Non-Wiring Boundaries

No auth, Railway, Supabase, WordPress, STAT, Arena, R2/CDN, or deploy wiring was changed.

The candidate is not deployed and not promoted.

## Runtime Data Model

T-16 hardcoded Neurology records are now fallback data only. The candidate first attempts to use:

- `sessionStorage.mm_selected_drill`
- `video_id` from the URL
- injected registry arrays such as `window.MISSIONMED_DAILY_DRILLS_REGISTRY`
- prompt arrays on the selected drill
- `nodes_url` on the selected drill, if browser fetch succeeds

If no runtime data exists, it falls back to the T-16 demo prompt set with session-only labeling.

## LAB / Operator Controls

The statebar, operator panel, and mobile preview tabs are hidden from normal runtime. They are available only with `?lab=1` or `#lab`.

## Known Candidate Limits

- This is a single-file frontend candidate, not a final live artifact.
- Browser validation has not been run in this thread.
- Real media playback from the prior Drills engine was not fully ported into this T-16 shell.
- Dashboard sync is not implemented.
- Wiring authority must review and validate before any promotion.

## Parity Patch 012 Notes

The follow-up parity pass kept the single-file T-16 shell and added small non-wiring compatibility hardening in `LIVE/drills.html`:

- Reads legacy `sessionStorage.mm.launch` payloads in addition to `mm_selected_drill`.
- Unwraps nested selected-drill/launch payloads while preserving `origin_mode`, `return_url`, `launch_id`, and metadata.
- Preserves media metadata fields such as `stream_id`, `playback_url`, `poster_url`, `media_timecode`, and `nodes_url` for Wiring Authority/media validation.
- Adds a safe HTTPS allowlist before fetching `nodes_url` prompt data.
- Expands prompt normalization for common node fields such as `topic_hint`, `answer_text`, and `expected`.
- Emits completion results with both T-16 fields and the existing Daily bridge fields.
- Normalizes the visible summary card from the bridge payload so `score`, `correct_count`, `missed_count`, and `out_of_time_count` display correctly.

Remaining limit: the prior large Drills video/media runtime was not fully reintroduced. This candidate is now stronger for bridge/runtime parity, but media playback and production registry validation still require Wiring Authority review before deploy or promotion.
