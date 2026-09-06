# Y1-Y2-CAM-V6-3494 — RECORDING + EVIDENCE SPEC

One AnswerRecord; every surface consumes it; no parallel records.

## 1. AnswerRecord (canonical)

```ts
interface AnswerRecord {
  id: AnswerId;                    // canonical; Film Room, Library, Review, Compare all key on this
  studentId; questionId; sessionId; sessionConfigId; attempt: number;
  t0: ISO; durationSec: number;
  media: { videoRef?: BlobRef; audioRef?: BlobRef; consentAt: ISO };
  transcript?: { tokens: [{w, t0, t1, conf}], ref };
  evidence: EvidenceBundle;        // §2 — the Film Room's food
  safe: { notes: SAFeNote[] };     // qualitative only, never numeric
  di: { summary: {masterId→bucketed value}, limiting?: MetricId, coverage: CoverageMap };
  storyforge: { used?: StoryId; candidates?: StoryId[] };
  review: { status:'unreviewed'|'reviewed'|'needs_work'; marks: Mark[]; notes: ReviewNote[]; by?; at? };
  personalBest: boolean;
  sharing: { state:'private'|'share_eligible'|'share_approved';
             approvedAt?; revokedAt?; scope?: 'matchbridge'; audit: AuditEntry[] };  // default private
}
```

MatchBridge seam: state transitions only via explicit student action + consent dialog; every transition audited; revocation immediate; **nothing shares automatically**; no downstream consumer built in this phase.

## 2. EvidenceBundle — persist / ephemeral / regenerable

**PERSISTED (compact, replay-grade):**
- Metric lanes: per enabled module, downsampled `MetricSample` series at ≤2 Hz for traces (value/norm/state/conf) — a 3-minute answer ≈ tens of KB.
- Events: all `MetricEvent`s (pauses, landings, gesture candidates, opportunities ≤4, corrections fired, mentor marks, provider/system transitions) with timestamps + confidence.
- Landmark evidence (privacy-authorized): downsampled to 5 Hz — hand centers (L/R), face box center+size, shoulder anchor points, per-frame conf. **No meshes, no finger landmarks, no raw frames, no raw audio buffers, no embeddings** (3471C persistence law upheld).
- Coverage map: per-lane availability segments (the hatched bands are first-class data).
- Phase markers (manual/assisted) and answer boundaries.

**EPHEMERAL (session buffer only):** full-rate AudioFrames, full LandmarkFrames (meshes/fingers), raw pixel data, worklet internals.

**REGENERABLE (never persisted):** composite masters (recompute from persisted lanes via capMaster — enables retroactive weight tuning after human validation), overlay renderings (re-drawn from landmark evidence via the same VisionOverlayEngine), NL-search indexes.

Rationale: Film Room never recomputes video; replay wireframes come from the 5 Hz evidence stream; storage stays small; composite weight changes reprocess history honestly.

## 3. Recorder service

`RecorderService.begin(config)` → MediaRecorder (video+audio per consent) + EvidenceRecorder (bus subscribers) on the shared SessionClock → `commit()` builds the AnswerRecord atomically (media upload + evidence + metadata or nothing) → `abort()` discards buffers. A/V–evidence skew budget ≤50ms; skew beyond budget marks lanes `MISALIGNED` visibly rather than silently shifting (3472 honesty law).

## 4. Consumers

Film Room (lanes/chips/coverage from EvidenceBundle; seek = video time = lane time) · Compare (two AnswerRecords, phase-aligned via markers) · Answer Library views (ALL/SESSIONS/QUESTIONS/PB/MENTOR/SAVED/FAV are indexes over the same records) · Mentor Review (adds review fields; separate write scope) · StoryForge (usage relationships from `storyforge.used`) · Progression (PB flags, mission progress from events). Exports: timeline PNG + events CSV (3472 §10.3).

## 5. Retention & privacy

Recordings retained per MissionMed policy with student-visible retention copy (3493 Device Room language); delete = media + evidence + indexes, audit stub retained; mentor artifacts attributed; student can view everything a mentor wrote about them except mentor-private live-rail annotations, which are scoped MENTOR-only by API design.
