import { performance } from "node:perf_hooks";
import { sha256 } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

export const CLOCK_ID = "missionmed.cie.monotonic-session-clock";
export const CLOCK_VERSION = 1;
export const SESSION_CLOCK_ID = "missionmed.cie.segmented-session-timeline";
export const SESSION_CLOCK_VERSION = 1;

export class MonotonicSessionClock {
  #now;
  #origin;
  #last = 0;
  #gaps = [];

  constructor(options = {}) {
    this.#now = options.now || (() => performance.now());
    this.#origin = Number(options.originMonotonicMs ?? this.#now());
    invariant(Number.isFinite(this.#origin), 500, "CLOCK_ORIGIN_INVALID", "Clock origin must be finite");
  }

  elapsedMs() {
    const current = Math.round(this.#now() - this.#origin);
    invariant(Number.isSafeInteger(current) && current >= 0, 500, "CLOCK_REGRESSION", "Monotonic clock moved before its origin");
    invariant(current >= this.#last, 500, "CLOCK_REGRESSION", "Monotonic clock moved backwards");
    this.#last = current;
    return current;
  }

  markGap(reason, startedAtMs, endedAtMs) {
    const start = Number(startedAtMs);
    const end = Number(endedAtMs);
    invariant(Number.isSafeInteger(start) && start >= 0, 400, "CLOCK_GAP_INVALID", "Gap start must be a non-negative integer");
    invariant(Number.isSafeInteger(end) && end >= start, 400, "CLOCK_GAP_INVALID", "Gap end must be at or after its start");
    invariant(["hidden", "frozen", "interrupted", "unavailable"].includes(reason), 400, "CLOCK_GAP_REASON_INVALID", "Gap reason is not recognized");
    const gap = Object.freeze({ reason, t0_ms: start, t1_ms: end });
    this.#gaps.push(gap);
    return gap;
  }

  mediaTimeMs(mediaOriginMs = 0) {
    const origin = Number(mediaOriginMs);
    invariant(Number.isSafeInteger(origin) && origin >= 0, 400, "MEDIA_ORIGIN_INVALID", "Media origin must be a non-negative integer");
    return Math.max(0, this.elapsedMs() - origin);
  }

  contract(extra = {}) {
    return Object.freeze({
      clock_id: CLOCK_ID,
      clock_version: CLOCK_VERSION,
      origin_kind: "monotonic",
      paint_cadence_is_evidence_clock: false,
      gaps: this.#gaps.map((gap) => ({ ...gap })),
      ...extra
    });
  }
}

export function validateClockContract(value) {
  invariant(value && typeof value === "object" && !Array.isArray(value), 400, "CLOCK_CONTRACT_INVALID", "Clock contract is required");
  invariant(value.clock_id === CLOCK_ID, 400, "CLOCK_ID_INVALID", "Clock identifier is not supported");
  invariant(value.clock_version === CLOCK_VERSION, 400, "CLOCK_VERSION_INVALID", "Clock version is not supported");
  invariant(value.origin_kind === "monotonic", 400, "CLOCK_ORIGIN_KIND_INVALID", "Evidence timing must use a monotonic origin");
  invariant(value.paint_cadence_is_evidence_clock === false, 400, "CLOCK_PAINT_DEPENDENCY_FORBIDDEN", "Paint cadence cannot be an evidence clock");
  const gaps = Array.isArray(value.gaps) ? value.gaps : [];
  for (const gap of gaps) {
    invariant(["hidden", "frozen", "interrupted", "unavailable"].includes(gap.reason), 400, "CLOCK_GAP_REASON_INVALID", "Clock gap reason is invalid");
    invariant(Number.isSafeInteger(gap.t0_ms) && gap.t0_ms >= 0, 400, "CLOCK_GAP_INVALID", "Clock gap start is invalid");
    invariant(Number.isSafeInteger(gap.t1_ms) && gap.t1_ms >= gap.t0_ms, 400, "CLOCK_GAP_INVALID", "Clock gap end is invalid");
  }
  return value;
}

export class SegmentedSessionClock {
  #segments = [];

  addSegment(input) {
    const duration = Number(input.validated_duration_ms);
    invariant(Number.isSafeInteger(duration) && duration > 0, 400, "CLOCK_SEGMENT_DURATION_INVALID", "Segment duration must be a positive integer");
    const previous = this.#segments.at(-1) || null;
    const globalStart = input.global_t0_ms === undefined ? (previous?.global_t1_ms || 0) : Number(input.global_t0_ms);
    invariant(Number.isSafeInteger(globalStart) && globalStart >= 0, 400, "CLOCK_SEGMENT_RANGE_INVALID", "Segment global start is invalid");
    invariant(!previous || globalStart >= previous.global_t1_ms, 409, "CLOCK_SEGMENT_OVERLAP", "Clock segments cannot overlap");
    const segment = {
      segment_id: String(input.segment_id || "").trim(),
      rep_ref: String(input.rep_ref || "").trim(),
      media_revision_ref: String(input.media_revision_ref || "").trim(),
      global_t0_ms: globalStart,
      global_t1_ms: globalStart + duration,
      local_t0_ms: 0,
      local_t1_ms: duration,
      validated_duration_ms: duration,
      capture_clock: validateClockContract(input.capture_clock)
    };
    invariant(segment.segment_id && segment.rep_ref && segment.media_revision_ref, 400, "CLOCK_SEGMENT_REFERENCE_REQUIRED", "Segment identity, rep, and media revision are required");
    invariant(!this.#segments.some((value) => value.segment_id === segment.segment_id), 409, "CLOCK_SEGMENT_EXISTS", "Segment already exists");
    const immutable = Object.freeze({ ...segment, content_hash: sha256(segment) });
    this.#segments.push(immutable);
    return immutable;
  }

  globalToLocal(globalMs) {
    const value = Number(globalMs);
    invariant(Number.isSafeInteger(value) && value >= 0, 400, "CLOCK_POSITION_INVALID", "Global clock position is invalid");
    const segment = this.#segments.find((entry) => value >= entry.global_t0_ms && value < entry.global_t1_ms);
    invariant(segment, 404, "CLOCK_POSITION_UNMAPPED", "Global clock position is not mapped to media");
    return Object.freeze({ segment_id: segment.segment_id, media_revision_ref: segment.media_revision_ref, local_ms: value - segment.global_t0_ms });
  }

  localToGlobal(segmentId, localMs) {
    const segment = this.#segments.find((entry) => entry.segment_id === segmentId);
    invariant(segment, 404, "CLOCK_SEGMENT_NOT_FOUND", "Clock segment was not found");
    const value = Number(localMs);
    invariant(Number.isSafeInteger(value) && value >= 0 && value < segment.validated_duration_ms, 400, "CLOCK_POSITION_INVALID", "Local clock position is outside its half-open media segment");
    return segment.global_t0_ms + value;
  }

  assertRange(segmentId, t0Ms, t1Ms, rangeKind) {
    const segment = this.#segments.find((entry) => entry.segment_id === segmentId);
    invariant(segment, 404, "CLOCK_SEGMENT_NOT_FOUND", "Clock segment was not found");
    const t0 = Number(t0Ms);
    const t1 = Number(t1Ms);
    invariant(Number.isSafeInteger(t0) && Number.isSafeInteger(t1), 400, "TIME_RANGE_INVALID", "Timeline range must use integer milliseconds");
    invariant(t0 >= segment.global_t0_ms && t1 <= segment.global_t1_ms, 422, "TIME_RANGE_OUTSIDE_SEGMENT", "Timeline range is outside its media segment");
    if (rangeKind === "POINT") invariant(t0 === t1 && t0 < segment.global_t1_ms, 400, "POINT_RANGE_INVALID", "Point events require an in-segment position with equal boundaries");
    else invariant(rangeKind === "SPAN" && t1 > t0 && t0 < segment.global_t1_ms, 400, "SPAN_RANGE_INVALID", "Span ranges are half-open and require t1_ms greater than t0_ms");
    return segment;
  }

  contract(extra = {}) {
    const contract = {
      clock_id: SESSION_CLOCK_ID,
      clock_version: SESSION_CLOCK_VERSION,
      range_semantics: "half_open",
      time_unit: "integer_ms",
      segments: this.#segments.map((segment) => ({ ...segment })),
      ...extra
    };
    return Object.freeze({ ...contract, content_hash: sha256(contract) });
  }
}

export function validateSessionClockContract(value) {
  invariant(value && typeof value === "object" && !Array.isArray(value), 400, "SESSION_CLOCK_REQUIRED", "Session clock contract is required");
  invariant(value.clock_id === SESSION_CLOCK_ID, 400, "SESSION_CLOCK_ID_INVALID", "Session clock identifier is not supported");
  invariant(value.clock_version === SESSION_CLOCK_VERSION, 400, "SESSION_CLOCK_VERSION_INVALID", "Session clock version is not supported");
  invariant(value.range_semantics === "half_open" && value.time_unit === "integer_ms", 400, "SESSION_CLOCK_RANGE_CONTRACT_INVALID", "Session clock must use half-open integer-millisecond ranges");
  invariant(Array.isArray(value.segments) && value.segments.length > 0, 400, "SESSION_CLOCK_SEGMENTS_REQUIRED", "At least one media segment is required");
  let previousEnd = 0;
  const ids = new Set();
  for (const segment of value.segments) {
    invariant(segment && typeof segment === "object", 400, "CLOCK_SEGMENT_INVALID", "Clock segment is invalid");
    invariant(!ids.has(segment.segment_id), 409, "CLOCK_SEGMENT_EXISTS", "Clock segment identity is duplicated");
    ids.add(segment.segment_id);
    invariant(Number.isSafeInteger(segment.global_t0_ms) && Number.isSafeInteger(segment.global_t1_ms), 400, "CLOCK_SEGMENT_RANGE_INVALID", "Clock segment range is invalid");
    invariant(segment.global_t0_ms >= previousEnd && segment.global_t1_ms > segment.global_t0_ms, 409, "CLOCK_SEGMENT_OVERLAP", "Clock segments must be ordered and non-overlapping");
    invariant(segment.local_t0_ms === 0 && segment.local_t1_ms === segment.validated_duration_ms, 400, "CLOCK_SEGMENT_MAPPING_INVALID", "Clock segment local mapping is invalid");
    validateClockContract(segment.capture_clock);
    const unhashed = { ...segment };
    delete unhashed.content_hash;
    invariant(segment.content_hash === sha256(unhashed), 409, "CLOCK_SEGMENT_HASH_MISMATCH", "Clock segment hash is invalid");
    previousEnd = segment.global_t1_ms;
  }
  const contract = { ...value };
  delete contract.content_hash;
  invariant(value.content_hash === sha256(contract), 409, "SESSION_CLOCK_HASH_MISMATCH", "Session clock hash is invalid");
  return value;
}
