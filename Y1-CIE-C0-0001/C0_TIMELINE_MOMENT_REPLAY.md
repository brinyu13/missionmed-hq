# Y1-CIE-C0-0001 Timeline, Moment, and Replay

## Canonical Time

The C0 session clock is monotonic and segmented. Wall time is audit metadata only. Paint cadence is explicitly rejected as evidence time. Each segment maps one local media interval into a non-overlapping global session interval with equal duration.

Tests cover backward wall time, explicit gaps, duration mismatch, multi-rep mapping, every half-open boundary, out-of-range events, and local-to-global round trips.

## Track Queries

Track items are append-only versions ordered by integer millisecond ranges and stable event sequence. Point events require `t0_ms == t1_ms`; spans require `t1_ms > t0_ms`. Missing, negative, non-integer, cross-segment, or duration-exceeding ranges fail closed.

Range queries are deterministic and pagination is snapshot-bound. Stress tests persist and query 10,000 versioned items and allocate 250 concurrent unique sequences with exact retry behavior.

## Moments

A Moment is a replayable span bound to one track revision, segment, media revision, author, consent set, visibility, provenance, and hash. A mentor-authored Moment must fit inside and reference a student-authored source Moment covered by the mentor's exact grant.

The route grammar is `/review/:session/:moment`. The URL carries no bearer, identity, provider ID, email, or media secret. Every fetch rechecks the authenticated principal, session/Moment binding, consent, deletion state, and current grant.

## Replay

The browser surface consumes only a range-enforced playback capability. It does not place a full asset URL into the video element. Seeking below `t0` or beyond `t1` is clamped by the authorized range, and authorization polling clears playback when access ends.

The replay synchronization controller validates immutable manifests, exact player membership, evidence hashes, media/range consistency, and session-clock binding. Play, pause, seek, buffering, end, and close use an operation epoch so concurrent play or late async completion cannot resurrect a closed group.

## Browser Evidence

- Desktop authorized projection: `evidence/c0_review_desktop.png`.
- Mobile 390 px projection: `evidence/c0_review_mobile.png`.
- Unauthorized direct route displayed only the non-enumerating unavailable message.
- Local fixture intentionally returned no playback URL, proving the truthful unavailable state rather than optimistic success.
