import { sha256 } from "../src/canonical.mjs";
import { CLOCK_ID, CLOCK_VERSION, SegmentedSessionClock } from "../src/clock.mjs";

const baseUrl = new URL(process.env.CIE_FIXTURE_BASE_URL || "http://127.0.0.1:4327");
if (!process.env.CIE_FIXTURE_ALLOW || !["127.0.0.1", "localhost"].includes(baseUrl.hostname)) {
  throw new Error("Synthetic fixture seeding is restricted to an explicitly allowed loopback server");
}

const identity = Object.freeze({
  subject: "synthetic_student_browser",
  role: "student",
  session: "synthetic_local_authority_session"
});

let requestSequence = 0;
async function command(pathname, body) {
  requestSequence += 1;
  const response = await fetch(new URL(pathname, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `browser-fixture-${requestSequence}`,
      "x-request-id": `browser-fixture-request-${requestSequence}`,
      "x-cie-local-subject": identity.subject,
      "x-cie-local-role": identity.role,
      "x-cie-local-session": identity.session
    },
    body: JSON.stringify(body)
  });
  const envelope = await response.json();
  if (!response.ok || !envelope.ok) throw new Error(`Fixture command failed: ${response.status} ${envelope.error?.code || "UNKNOWN"}`);
  return envelope.data;
}

const timeline = new SegmentedSessionClock();
timeline.addSegment({
  segment_id: "segment_browser_1",
  rep_ref: "synthetic_cam_rep_browser_1",
  media_revision_ref: "synthetic_media_revision_browser_1",
  validated_duration_ms: 90_000,
  capture_clock: {
    clock_id: CLOCK_ID,
    clock_version: CLOCK_VERSION,
    origin_kind: "monotonic",
    paint_cadence_is_evidence_clock: false,
    gaps: []
  }
});

const session = await command("/v1/cie/sessions", {
  external_session_ref: "synthetic_cam_session_browser_1",
  mode_ref: "M1",
  media_revision_ref: "synthetic_media_revision_browser_1",
  clock: timeline.contract()
});
const consent = await command(`/v1/cie/sessions/${session.id}/consents`, {
  purpose: "evidence_storage",
  granted: true,
  authority_ref: "synthetic_browser_fixture",
  policy_version: "local-c0-v1",
  policy_text_hash: sha256("synthetic local C0 fixture policy"),
  locale: "en-US",
  retention_policy_ref: "synthetic-local-delete-after-test",
  scope: { device_class: "synthetic", session_only: true },
  recorded_at: new Date().toISOString()
});
const result = await command(`/v1/cie/sessions/${session.id}/moments`, {
  range_kind: "SPAN",
  t0_ms: 2_000,
  t1_ms: 11_000,
  segment_id: "segment_browser_1",
  media_revision_ref: "synthetic_media_revision_browser_1",
  source: "student",
  type: "self-selected",
  label: "Clarifying question before the counterpoint",
  note: "Synthetic local practice evidence only.",
  skill_snapshot_ids: [],
  visibility: "private",
  consent_receipt_ids: [consent.id],
  provenance: {
    tier: "L1",
    badge: "OBSERVED_ON_REPLAY",
    statement: "The selected range begins with an answerable clarifying question.",
    evidence_refs: ["synthetic_media_revision_browser_1"],
    simulated: true,
    method_status: "human_observation"
  }
});

process.stdout.write(`${JSON.stringify({
  state: "READY",
  synthetic: true,
  session_id: session.id,
  moment_id: result.moment.id,
  review_url: new URL(result.moment.deep_link, baseUrl).href,
  request_headers: {
    "x-cie-local-subject": identity.subject,
    "x-cie-local-role": identity.role,
    "x-cie-local-session": identity.session
  }
}, null, 2)}\n`);
