import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  resolveStudentForSourceAsset,
  STUDENT_RESOLUTION_STATUS,
} from '../lib/mmc-student-resolution-engine.mjs';

const ignacioAsset = {
  id: randomUUID(),
  source_system: 'coaching_drop_zone',
  source_id: 'ignacio-real-asset',
  asset_title: 'Ignacio Anzola & Dr. Brian - Mission Residency 1-on-1 Advising-20260605 1705-1',
  media_url: '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVidoes/Ignacio Anzola.mp4',
  transcript_pointer: '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVidoes/Ignacio Anzola.vtt',
  metadata: {
    worker: {
      runtime: 'MMC-502',
      parsed_name: {
        raw: 'Ignacio Anzola & Dr. Brian - Mission Residency 1-on-1 Advising-20260605 1705-1',
        studentName: '',
        preferredPattern: false,
      },
    },
  },
};

const ignacioReferenceId = randomUUID();
const ignacioAssignmentId = randomUUID();
const verifiedIgnacioContext = {
  identityReferences: [{
    id: ignacioReferenceId,
    primary_anchor_type: 'mmc_reviewed_subject',
    primary_anchor_hash: 'ignacio-anzola',
    reference_status: 'verified',
    review_status: 'verified',
    metadata: {
      student_id: 'ignacio-anzola',
      student_name: 'Ignacio Anzola',
      canonical_student_identity: false,
    },
  }],
  mentorAssignments: [{
    id: ignacioAssignmentId,
    subject_ref_id: ignacioReferenceId,
    status: 'active',
    review_status: 'verified',
  }],
};

const manualIgnacioContext = {
  identityReferences: [{
    ...verifiedIgnacioContext.identityReferences[0],
    reference_status: 'unverified',
    review_status: 'unreviewed',
  }],
  mentorAssignments: verifiedIgnacioContext.mentorAssignments,
};

const manualResult = resolveStudentForSourceAsset(ignacioAsset, manualIgnacioContext);
assert.equal(manualResult.autoAttach, false, 'Unverified Ignacio identity must not auto-attach.');
assert.equal(manualResult.student.suggested.studentId, 'ignacio-anzola');
assert.equal(manualResult.student.status, STUDENT_RESOLUTION_STATUS.MANUAL_REVIEW);
assert.ok(manualResult.review.required, 'Unverified name evidence must stay in review queue.');
assert.ok(manualResult.review.reasons.includes('strong_identity_evidence_missing'));

const verifiedResult = resolveStudentForSourceAsset({
  ...ignacioAsset,
  meeting_match_status: 'verified',
}, verifiedIgnacioContext);
assert.equal(verifiedResult.status, STUDENT_RESOLUTION_STATUS.VERIFIED);
assert.equal(verifiedResult.autoAttach, true, 'Verified identity reference plus active assignment should auto-attach.');
assert.equal(verifiedResult.student.suggested.subjectRefId, ignacioReferenceId);
assert.equal(verifiedResult.student.suggested.assignmentId, ignacioAssignmentId);

const fixtureReferenceId = randomUUID();
const fixtureResult = resolveStudentForSourceAsset({
  ...ignacioAsset,
  asset_title: 'Amara Okafor & Dr. Brian - Mission Residency 1-on-1 Advising-20260605 1705-1',
  meeting_match_status: 'verified',
}, {
  identityReferences: [{
    id: fixtureReferenceId,
    primary_anchor_type: 'mmc_fixture_student',
    primary_anchor_hash: 'amara',
    reference_status: 'verified',
    review_status: 'verified',
    metadata: {
      student_id: 'amara',
      student_name: 'Amara Okafor',
    },
  }],
  mentorAssignments: [{
    id: randomUUID(),
    subject_ref_id: fixtureReferenceId,
    status: 'active',
    review_status: 'verified',
  }],
});
assert.equal(fixtureResult.autoAttach, false, 'Demo fixture students must never auto-attach from coaching recording evidence.');
assert.ok(fixtureResult.student.suggested.fixtureBlocked);
assert.ok(fixtureResult.review.reasons.includes('demo_fixture_auto_attach_blocked'));

const secondIgnacioReferenceId = randomUUID();
const conflictResult = resolveStudentForSourceAsset({
  ...ignacioAsset,
  meeting_match_status: 'verified',
}, {
  identityReferences: [
    verifiedIgnacioContext.identityReferences[0],
    {
      ...verifiedIgnacioContext.identityReferences[0],
      id: secondIgnacioReferenceId,
      primary_anchor_hash: 'ignacio-anzola-alt',
    },
  ],
  mentorAssignments: [
    verifiedIgnacioContext.mentorAssignments[0],
    {
      id: randomUUID(),
      subject_ref_id: secondIgnacioReferenceId,
      status: 'active',
      review_status: 'verified',
    },
  ],
});
assert.equal(conflictResult.autoAttach, false);
assert.notEqual(conflictResult.status, STUDENT_RESOLUTION_STATUS.VERIFIED);

console.log('MMC-504 student resolution engine validation passed.');
