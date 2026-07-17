import { immutableCopy, sha256 } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

export function createReplaySyncManifest(session, members) {
  invariant(session?.clock?.content_hash, 409, "REPLAY_CLOCK_UNSEALED", "Replay requires a sealed session clock");
  invariant(Array.isArray(members) && members.length > 0, 400, "REPLAY_MEMBERS_REQUIRED", "At least one replay member is required");
  const memberIds = new Set();
  const normalized = members.map((member) => {
    invariant(typeof member.member_id === "string" && member.member_id.length > 0 && !memberIds.has(member.member_id), 400, "REPLAY_MEMBER_ID_INVALID", "Replay member IDs must be nonempty and unique");
    invariant(/^[a-f0-9]{64}$/u.test(String(member.content_hash || "")), 409, "REPLAY_EVIDENCE_HASH_INVALID", "Replay member requires an immutable evidence hash");
    memberIds.add(member.member_id);
    const segment = session.clock.segments.find((entry) => entry.segment_id === member.segment_id);
    invariant(segment && segment.media_revision_ref === member.media_revision_ref, 409, "REPLAY_MEDIA_BINDING_INVALID", "Replay member does not match the sealed media segment");
    invariant(Number.isSafeInteger(member.t0_ms) && Number.isSafeInteger(member.t1_ms) && member.t0_ms >= segment.global_t0_ms && member.t1_ms <= segment.global_t1_ms && member.t1_ms > member.t0_ms, 422, "REPLAY_RANGE_INVALID", "Replay member range is outside its media segment");
    return {
      member_id: member.member_id,
      segment_id: segment.segment_id,
      media_revision_ref: segment.media_revision_ref,
      range_t0_ms: member.t0_ms,
      range_t1_ms: member.t1_ms,
      media_t0_ms: member.t0_ms - segment.global_t0_ms,
      media_t1_ms: member.t1_ms - segment.global_t0_ms,
      evidence_hash: member.content_hash
    };
  });
  const body = {
    contract_version: "cie.replay-sync-manifest.v1",
    session_id: session.id,
    session_clock_hash: session.clock.content_hash,
    members: normalized
  };
  return immutableCopy({ ...body, content_hash: sha256(body) });
}

export class ReplaySyncController {
  #players;
  #manifest;
  #state = "IDLE";
  #groupElapsedMs = 0;
  #toleranceMs;
  #durationMs;
  #operationEpoch = 0;

  constructor(manifest, players, options = {}) {
    invariant(manifest?.contract_version === "cie.replay-sync-manifest.v1" && Array.isArray(manifest.members) && manifest.members.length > 0, 400, "REPLAY_MANIFEST_INVALID", "Replay manifest contract is invalid");
    invariant(typeof manifest.session_id === "string" && manifest.session_id.length > 0 && /^[a-f0-9]{64}$/u.test(String(manifest.session_clock_hash || "")), 400, "REPLAY_MANIFEST_INVALID", "Replay manifest session binding is invalid");
    const manifestBody = { ...manifest };
    delete manifestBody.content_hash;
    invariant(manifest.content_hash === sha256(manifestBody), 409, "REPLAY_MANIFEST_HASH_MISMATCH", "Replay manifest integrity check failed");
    const memberIds = new Set();
    for (const member of manifest.members) {
      invariant(member && typeof member === "object" && typeof member.member_id === "string" && member.member_id.length > 0 && !memberIds.has(member.member_id), 400, "REPLAY_MANIFEST_INVALID", "Replay manifest member identity is invalid");
      memberIds.add(member.member_id);
      invariant(typeof member.segment_id === "string" && member.segment_id.length > 0 && typeof member.media_revision_ref === "string" && member.media_revision_ref.length > 0, 400, "REPLAY_MANIFEST_INVALID", "Replay manifest media binding is invalid");
      invariant(/^[a-f0-9]{64}$/u.test(String(member.evidence_hash || "")), 400, "REPLAY_MANIFEST_INVALID", "Replay manifest evidence hash is invalid");
      invariant([member.range_t0_ms, member.range_t1_ms, member.media_t0_ms, member.media_t1_ms].every((value) => Number.isSafeInteger(value) && value >= 0), 400, "REPLAY_MANIFEST_INVALID", "Replay manifest range must use non-negative integer milliseconds");
      invariant(member.range_t1_ms > member.range_t0_ms && member.media_t1_ms > member.media_t0_ms && member.range_t1_ms - member.range_t0_ms === member.media_t1_ms - member.media_t0_ms, 400, "REPLAY_MANIFEST_INVALID", "Replay manifest range mapping is invalid");
    }
    this.#manifest = manifest;
    this.#players = new Map(players.map((player) => [player.memberId, player]));
    invariant(this.#players.size === players.length && this.#players.size === manifest.members.length, 400, "REPLAY_PLAYER_SET_INVALID", "Replay players must match the manifest exactly");
    this.#toleranceMs = Number(options.toleranceMs ?? 100);
    invariant(Number.isFinite(this.#toleranceMs) && this.#toleranceMs >= 0 && this.#toleranceMs <= 1000, 400, "REPLAY_TOLERANCE_INVALID", "Replay drift tolerance is invalid");
    invariant(manifest.members.every((member) => this.#players.has(member.member_id)), 400, "REPLAY_PLAYER_MISSING", "Every replay member requires a player adapter");
    this.#durationMs = Math.max(...manifest.members.map((member) => member.media_t1_ms - member.media_t0_ms));
    this.#state = "READY";
  }

  get state() { return this.#state; }
  get groupElapsedMs() { return this.#groupElapsedMs; }

  seek(groupElapsedMs) {
    invariant(["READY", "PLAYING", "PAUSED"].includes(this.#state), 409, "REPLAY_STATE_INVALID", "Replay group cannot seek from its current state");
    const elapsed = Math.max(0, Number(groupElapsedMs));
    invariant(Number.isFinite(elapsed), 400, "REPLAY_SEEK_INVALID", "Replay seek position is invalid");
    this.#state = "SEEKING";
    this.#groupElapsedMs = Math.min(elapsed, this.#durationMs);
    for (const member of this.#manifest.members) {
      const duration = member.media_t1_ms - member.media_t0_ms;
      const local = member.media_t0_ms + Math.min(this.#groupElapsedMs, duration);
      this.#players.get(member.member_id).seek(local / 1000);
    }
    this.#state = "PAUSED";
  }

  async play() {
    invariant(["READY", "PAUSED"].includes(this.#state), 409, "REPLAY_STATE_INVALID", "Replay group cannot play from its current state");
    const operationEpoch = ++this.#operationEpoch;
    this.#state = "STARTING";
    const results = await Promise.allSettled(
      [...this.#players.values()].map((player) => Promise.resolve().then(() => player.play()))
    );
    if (operationEpoch !== this.#operationEpoch || this.#state !== "STARTING") {
      for (const player of this.#players.values()) player.pause();
      invariant(false, 409, "REPLAY_OPERATION_CANCELLED", "Replay start was cancelled");
    }
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) {
      for (const player of this.#players.values()) player.pause();
      this.#state = "PAUSED";
      throw rejected.reason;
    }
    this.#state = "PLAYING";
  }

  pause() {
    invariant(this.#state === "PLAYING", 409, "REPLAY_STATE_INVALID", "Replay group is not playing");
    for (const player of this.#players.values()) player.pause();
    this.#state = "PAUSED";
  }

  correctDrift(leaderMemberId) {
    invariant(this.#state === "PLAYING", 409, "REPLAY_STATE_INVALID", "Drift correction requires active playback");
    const leaderMember = this.#manifest.members.find((member) => member.member_id === leaderMemberId);
    invariant(leaderMember, 400, "REPLAY_LEADER_INVALID", "Replay leader is invalid");
    const leader = this.#players.get(leaderMemberId);
    const leaderDurationMs = leaderMember.media_t1_ms - leaderMember.media_t0_ms;
    const elapsedMs = Math.min(leaderDurationMs, Math.max(0, leader.currentTime() * 1000 - leaderMember.media_t0_ms));
    this.#groupElapsedMs = elapsedMs;
    const leaderExpectedMs = leaderMember.media_t0_ms + elapsedMs;
    if (Math.abs(leader.currentTime() * 1000 - leaderExpectedMs) > this.#toleranceMs) leader.seek(leaderExpectedMs / 1000);
    for (const member of this.#manifest.members) {
      if (member.member_id === leaderMemberId) continue;
      const player = this.#players.get(member.member_id);
      const duration = member.media_t1_ms - member.media_t0_ms;
      const expectedMs = member.media_t0_ms + Math.min(elapsedMs, duration);
      if (Math.abs(player.currentTime() * 1000 - expectedMs) > this.#toleranceMs) player.seek(expectedMs / 1000);
    }
  }

  close() {
    if (this.#state === "CLOSED") return;
    this.#operationEpoch += 1;
    for (const player of this.#players.values()) player.pause();
    this.#state = "CLOSED";
  }
}
