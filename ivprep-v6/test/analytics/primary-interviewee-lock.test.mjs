import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRIMARY_LOCK_STATE,
  PrimaryIntervieweeLock,
  faceDetectionCandidates,
  paddedPrimaryRoi,
  primaryLockDiagnostic,
} from '../../public/analytics/primary-interviewee-lock.mjs';

function face(centerX = 0.5, centerY = 0.38, width = 0.18, height = 0.24) {
  return { left: centerX - width / 2, top: centerY - height / 2, width, height };
}

function acquire(tracker, { startMs = 0, centerX = 0.5 } = {}) {
  tracker.update({ atMs: startMs, candidates: [face(centerX)] });
  tracker.update({ atMs: startMs + 325, candidates: [face(centerX + 0.005)] });
  return tracker.update({ atMs: startMs + 650, candidates: [face(centerX + 0.01)] });
}

test('initial acquisition uses elapsed stability and creates one anonymous session-local lock', () => {
  const tracker = new PrimaryIntervieweeLock();
  assert.equal(tracker.update({ atMs: 0, candidates: [face()] }).state, PRIMARY_LOCK_STATE.LOCK_CANDIDATE);
  assert.equal(tracker.update({ atMs: 649, candidates: [face(0.505)] }).primaryUsable, false);
  const locked = tracker.update({ atMs: 650, candidates: [face(0.51)] });
  assert.equal(locked.state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(locked.primaryTrackId, 'primary-1');
  assert.equal(locked.primaryUsable, true);
  assert.ok(locked.primaryRoi.width > 0.5);
  assert.deepEqual(locked.withheldIntervals, [{ startMs: 0, endMs: 650, reason: 'primary_lock_candidate' }]);
});

test('A: a three-second background bystander does not clear or steal the primary lock', () => {
  const tracker = new PrimaryIntervieweeLock();
  const original = acquire(tracker).primaryTrackId;
  for (let atMs = 800; atMs <= 3_800; atMs += 250) {
    const state = tracker.update({ atMs, candidates: [face(0.51 + (atMs % 500 ? 0.004 : 0)), face(0.82, 0.32, 0.13, 0.18)] });
    assert.equal(state.state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
    assert.equal(state.primaryTrackId, original);
    assert.equal(state.primaryUsable, true);
    assert.equal(state.bystanderCount, 1);
  }
  assert.equal(tracker.snapshot(3_800).excludedDurationMs, 650);
});

test('B: a bystander crossing the center can cause bounded ambiguity but never an identity switch', () => {
  const tracker = new PrimaryIntervieweeLock();
  const original = acquire(tracker).primaryTrackId;
  tracker.update({ atMs: 800, candidates: [face(0.515), face(0.72)] });
  const crossing = tracker.update({ atMs: 950, candidates: [face(0.52), face(0.56)] });
  assert.equal(crossing.primaryTrackId, original);
  assert.ok([PRIMARY_LOCK_STATE.PRIMARY_LOCKED, PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED].includes(crossing.state));
  const after = tracker.update({ atMs: 1_100, candidates: [face(0.525), face(0.30)] });
  const withheld = tracker.update({ atMs: 1_450, candidates: [face(0.53), face(0.20)] });
  assert.equal(withheld.state, PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(withheld.primaryUsable, false);
  assert.equal(withheld.primaryTrackId, original);
  assert.notEqual(after.state, PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
});

test('B: the nearest prior position cannot silently transfer the lock to a crossing bystander',()=>{
  const tracker=new PrimaryIntervieweeLock();
  const original=acquire(tracker).primaryTrackId;
  const crossing=tracker.update({atMs:800,candidates:[face(.65),face(.51)]});
  assert.equal(crossing.state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(crossing.primaryTrackId,original);
  assert.equal(crossing.primaryUsable,false);
  const unresolved=tracker.update({atMs:1_050,candidates:[face(.66),face(.52)]});
  assert.equal(unresolved.primaryTrackId,original);
  assert.equal(unresolved.primaryUsable,false);
});

test('B: a lone candidate descending from a crossing ambiguity cannot inherit the primary lock',()=>{
  const tracker=new PrimaryIntervieweeLock();
  const original=acquire(tracker).primaryTrackId;
  assert.equal(tracker.update({atMs:800,candidates:[face(.65),face(.51)]}).state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  const possibleBystander=tracker.update({atMs:1_050,candidates:[face(.52)]});
  assert.equal(possibleBystander.state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(possibleBystander.continuity,'crossing_reacquisition_ambiguous');
  assert.equal(possibleBystander.primaryTrackId,original);
  assert.equal(possibleBystander.primaryUsable,false);
  const held=tracker.update({atMs:1_350,candidates:[face(.525)]});
  assert.equal(held.state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(held.reacquisitionCount,0);
  const required=tracker.update({atMs:3_650,candidates:[face(.53)]});
  assert.equal(required.state,PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
  assert.equal(required.primaryTrackId,null);
  assert.equal(required.selectionRequired,true);

  const boundaryTracker=new PrimaryIntervieweeLock();
  const boundaryTrack=acquire(boundaryTracker).primaryTrackId;
  boundaryTracker.update({atMs:800,candidates:[face(.515),face(.78)]});
  boundaryTracker.update({atMs:950,candidates:[face(.78)]});
  const boundaryMove=boundaryTracker.update({atMs:1_200,candidates:[face(.57)]});
  assert.equal(boundaryMove.state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(boundaryMove.continuity,'bystander_reacquisition_unsafe');
  assert.equal(boundaryMove.primaryTrackId,boundaryTrack);
  const boundaryHold=boundaryTracker.update({atMs:1_500,candidates:[face(.565)]});
  assert.equal(boundaryHold.state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(boundaryHold.primaryUsable,false);
  assert.equal(boundaryHold.reacquisitionCount,0);
});

test('C: a primary who leans out and returns is reacquired with one exact withheld interval', () => {
  const tracker = new PrimaryIntervieweeLock();
  const original = acquire(tracker).primaryTrackId;
  const hidden = tracker.update({ atMs: 900, candidates: [] });
  assert.equal(hidden.state, PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(hidden.primaryTrackId, original);
  assert.equal(hidden.primaryUsable, false);
  assert.equal(tracker.update({ atMs: 1_200, candidates: [face(0.53)] }).state, PRIMARY_LOCK_STATE.REACQUIRING);
  const restored = tracker.update({ atMs: 1_500, candidates: [face(0.535)] });
  assert.equal(restored.state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(restored.primaryTrackId, original);
  assert.equal(restored.reacquisitionCount, 1);
  assert.deepEqual(restored.withheldIntervals.slice(-2), [
    { startMs: 900, endMs: 1_200, reason: 'temporarily_occluded' },
    { startMs: 1_200, endMs: 1_500, reason: 'primary_reacquiring' },
  ]);
  assert.equal(restored.excludedDurationMs, 1_250);
});

test('D: another remaining person is never promoted after the primary exits', () => {
  const tracker = new PrimaryIntervieweeLock();
  const original = acquire(tracker).primaryTrackId;
  assert.equal(tracker.update({ atMs: 900, candidates: [face(0.82)] }).primaryTrackId, original);
  const required = tracker.update({ atMs: 3_700, candidates: [face(0.82)] });
  assert.equal(required.state, PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
  assert.equal(required.primaryTrackId, null);
  assert.equal(required.selectionRequired, true);
  assert.equal(tracker.update({ atMs: 4_500, candidates: [face(0.5)] }).state, PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
});

test('D: a bystander who moves into the old primary geometry after loss is never promoted',()=>{
  const tracker=new PrimaryIntervieweeLock();
  const original=acquire(tracker).primaryTrackId;
  tracker.update({atMs:800,candidates:[face(.515),face(.78)]});
  const loss=tracker.update({atMs:950,candidates:[face(.78)]});
  assert.equal(loss.primaryTrackId,original);
  assert.equal(loss.primaryUsable,false);
  const impostor=tracker.update({atMs:1_200,candidates:[face(.60)]});
  assert.equal(impostor.state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(impostor.primaryTrackId,original);
  assert.equal(impostor.primaryUsable,false);
  assert.equal(impostor.continuity,'bystander_reacquisition_unsafe');
  for(const atMs of [1_500,1_800,2_100,2_400,2_700,3_000]){
    const withheld=tracker.update({atMs,candidates:[face(.60)]});
    assert.equal(withheld.state,PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
    assert.equal(withheld.primaryUsable,false);
    assert.equal(withheld.reacquisitionCount,0);
  }
  const required=tracker.update({atMs:3_800,candidates:[face(.60)]});
  assert.equal(required.state,PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
  assert.equal(required.primaryTrackId,null);
  assert.equal(required.selectionRequired,true);
});

test('C: a background bystander occlusion does not make safe original-primary return sticky',()=>{
  const tracker=new PrimaryIntervieweeLock();
  const original=acquire(tracker).primaryTrackId;
  tracker.update({atMs:800,candidates:[face(.515),face(.82)]});
  tracker.update({atMs:950,candidates:[face(.82)]});
  assert.equal(tracker.update({atMs:1_200,candidates:[face(.52)]}).state,PRIMARY_LOCK_STATE.REACQUIRING);
  const restored=tracker.update({atMs:1_500,candidates:[face(.525)]});
  assert.equal(restored.state,PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(restored.primaryTrackId,original);
  assert.equal(restored.primaryUsable,true);
});

test('E: initial two-person ambiguity requires explicit selection and never resolves automatically', () => {
  const tracker = new PrimaryIntervieweeLock();
  tracker.update({ atMs: 0, candidates: [face(0.43), face(0.57)] });
  const required = tracker.update({ atMs: 500, candidates: [face(0.44), face(0.56)] });
  assert.equal(required.state, PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
  assert.equal(tracker.update({ atMs: 1_500, candidates: [face(0.5)] }).state, PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
  tracker.restartSelection(1_600);
  tracker.update({ atMs: 1_600, candidates: [face(0.5)] });
  tracker.update({ atMs: 1_925, candidates: [face(0.505)] });
  const selected = tracker.update({ atMs: 2_250, candidates: [face(0.51)] });
  assert.equal(selected.state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(selected.primaryTrackId, 'primary-1');
});

test('F: one isolated extra-face frame does not create whole-run suppression', () => {
  const tracker = new PrimaryIntervieweeLock();
  const original = acquire(tracker).primaryTrackId;
  const extra = tracker.update({ atMs: 800, candidates: [face(0.515), face(0.84)] });
  const normal = tracker.update({ atMs: 950, candidates: [face(0.52)] });
  assert.equal(extra.state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(extra.bystanderCount, 1);
  assert.equal(normal.state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(normal.primaryTrackId, original);
  assert.equal(normal.withheldIntervals.length, 1);
});

test('elapsed-time thresholds are invariant across frame cadence', () => {
  const fast = new PrimaryIntervieweeLock();
  for (let atMs = 0; atMs <= 700; atMs += 50) fast.update({ atMs, candidates: [face(0.5 + atMs / 100_000)] });
  const slow = new PrimaryIntervieweeLock();
  for (const atMs of [0, 350, 700]) slow.update({ atMs, candidates: [face(0.5 + atMs / 100_000)] });
  assert.equal(fast.snapshot(700).state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(slow.snapshot(700).state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
});

test('the primary-lock state machine is source-agnostic for live and playback callers',()=>{
  const trace=[
    [0,[face(.5)]],[325,[face(.505)]],[650,[face(.51)]],
    [900,[face(.515),face(.82)]],[1_200,[]],[1_500,[face(.52)]],[1_800,[face(.525)]],
  ];
  const run=()=>{const tracker=new PrimaryIntervieweeLock();return trace.map(([atMs,candidates])=>{const value=tracker.update({atMs,candidates});return {state:value.state,primaryUsable:value.primaryUsable,bystanderCount:value.bystanderCount,continuity:value.continuity,excludedDurationMs:value.excludedDurationMs,reacquisitionCount:value.reacquisitionCount}})};
  assert.deepEqual(run(),run());
});

test('detector boxes normalize deterministically and the padded ROI stays in frame', () => {
  const candidates = faceDetectionCandidates([
    { boundingBox: { originX: 320, originY: 90, width: 160, height: 180 }, categories: [{ score: 0.9 }] },
    { boundingBox: { originX: 64, originY: 72, width: 128, height: 144 }, categories: [{ score: 0.8 }] },
  ], 640, 480);
  assert.deepEqual(candidates.map((item) => Number(item.box.centerX.toFixed(2))), [0.2, 0.63]);
  const roi = paddedPrimaryRoi(candidates[0].box);
  assert.ok(roi.left >= 0 && roi.top >= 0 && roi.left + roi.width <= 1 && roi.top + roi.height <= 1);
});

test('Founder diagnostic is bounded and strips track and ROI geometry', () => {
  const tracker = new PrimaryIntervieweeLock({ maximumWithheldIntervals: 2 });
  const snapshot = acquire(tracker);
  const diagnostic = primaryLockDiagnostic(snapshot);
  assert.equal('primaryTrackId' in diagnostic, false);
  assert.equal('primaryRoi' in diagnostic, false);
  assert.equal(JSON.stringify(diagnostic).includes('left'), false);
  assert.equal(diagnostic.state, PRIMARY_LOCK_STATE.PRIMARY_LOCKED);
  assert.equal(Object.isFrozen(diagnostic.withheldIntervals), true);
});

test('reset destroys track, geometry, and withheld interval state', () => {
  const tracker = new PrimaryIntervieweeLock();
  acquire(tracker);
  tracker.update({ atMs: 900, candidates: [] });
  const reset = tracker.reset();
  assert.equal(reset.state, PRIMARY_LOCK_STATE.SEARCHING);
  assert.equal(reset.primaryTrackId, null);
  assert.equal(reset.primaryRoi, null);
  assert.deepEqual(reset.withheldIntervals, []);
  assert.equal(reset.reacquisitionCount, 0);
});
