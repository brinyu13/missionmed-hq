import assert from "node:assert/strict";
import test from "node:test";
import { CLOCK_ID, CLOCK_VERSION, MonotonicSessionClock, SegmentedSessionClock, validateClockContract, validateSessionClockContract } from "../src/clock.mjs";
import { captureClock } from "./fixtures.mjs";

test("monotonic session clock advances independently of paint cadence", () => {
  let now = 1000;
  const clock = new MonotonicSessionClock({ now: () => now });
  now = 1125.4;
  assert.equal(clock.elapsedMs(), 125);
  now = 1300;
  assert.equal(clock.mediaTimeMs(50), 250);
  assert.deepEqual(clock.contract(), {
    clock_id: CLOCK_ID,
    clock_version: CLOCK_VERSION,
    origin_kind: "monotonic",
    paint_cadence_is_evidence_clock: false,
    gaps: []
  });
});

test("clock records explicit unavailable gaps and rejects regression", () => {
  let now = 500;
  const clock = new MonotonicSessionClock({ now: () => now });
  clock.markGap("frozen", 40, 1000);
  now = 1550;
  assert.equal(clock.elapsedMs(), 1050);
  assert.equal(clock.contract().gaps[0].reason, "frozen");
  now = 1200;
  assert.throws(() => clock.elapsedMs(), { code: "CLOCK_REGRESSION" });
});

test("clock contract fails closed when paint cadence is claimed as evidence", () => {
  assert.throws(() => validateClockContract({
    clock_id: CLOCK_ID,
    clock_version: CLOCK_VERSION,
    origin_kind: "monotonic",
    paint_cadence_is_evidence_clock: true,
    gaps: []
  }), { code: "CLOCK_PAINT_DEPENDENCY_FORBIDDEN" });
});

test("segmented session clock maps multiple rep media timelines without overlap", () => {
  const clock = new SegmentedSessionClock();
  clock.addSegment({ segment_id: "s1", rep_ref: "r1", media_revision_ref: "m1", validated_duration_ms: 1000, capture_clock: captureClock });
  clock.addSegment({ segment_id: "s2", rep_ref: "r2", media_revision_ref: "m2", global_t0_ms: 1250, validated_duration_ms: 2000, capture_clock: captureClock });
  clock.addSegment({ segment_id: "s3", rep_ref: "r3", media_revision_ref: "m3", validated_duration_ms: 500, capture_clock: captureClock });
  assert.deepEqual(clock.globalToLocal(1300), { segment_id: "s2", media_revision_ref: "m2", local_ms: 50 });
  assert.equal(clock.localToGlobal("s2", 50), 1300);
  assert.equal(clock.assertRange("s2", 1300, 1500, "SPAN").media_revision_ref, "m2");
  assert.doesNotThrow(() => validateSessionClockContract(clock.contract()));
  assert.throws(() => clock.assertRange("s1", 900, 1300, "SPAN"), { code: "TIME_RANGE_OUTSIDE_SEGMENT" });
  assert.throws(() => clock.addSegment({ segment_id: "overlap", rep_ref: "r4", media_revision_ref: "m4", global_t0_ms: 100, validated_duration_ms: 100, capture_clock: captureClock }), { code: "CLOCK_SEGMENT_OVERLAP" });
});
