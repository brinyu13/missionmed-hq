import assert from 'node:assert/strict';
import test from 'node:test';
import {familyHomeContinuation} from '../web/js/family-022.js';

function pendingReview(){return {events:[],intake:{stage:'review',approval:{applied:false},candidates:Array.from({length:9},(_,index)=>({id:`synthetic-${index}`,decision:'undecided'}))}};}

test('Home continues nine saved unapplied CV candidates without requiring events',()=>{
  const document=pendingReview(),original=structuredClone(document);
  const continuation=familyHomeContinuation(document);
  assert.equal(continuation.enabled,true);
  assert.equal(continuation.label,'Continue review');
  assert.equal(continuation.route,'intake');
  assert.equal(continuation.candidateCount,9);
  assert.deepEqual(document,original);
});

test('Home still resumes review after all decisions are made but before Apply',()=>{
  const document=pendingReview();document.intake.candidates.forEach((item)=>item.decision='accepted');
  assert.equal(familyHomeContinuation(document).route,'intake');
});

test('Home prioritizes an unapplied source review alongside existing Timeline events',()=>{
  const document=pendingReview();document.events=[{id:'existing'}];
  assert.equal(familyHomeContinuation(document).route,'intake');
});

test('Home returns to Timeline continuation after a review is applied',()=>{
  const document=pendingReview();document.intake.approval.applied=true;document.events=[{id:'applied'}];
  const continuation=familyHomeContinuation(document);
  assert.equal(continuation.enabled,true);assert.equal(continuation.route,'builder');
  assert.equal(continuation.label,'Continue my Timeline');assert.equal(continuation.candidateCount,0);
});

for(const [label,document] of [
  ['new draft',{}],
  ['empty review',{events:[],intake:{stage:'review',candidates:[]}}],
  ['upload stage',{...pendingReview(),intake:{...pendingReview().intake,stage:'upload'}}],
  ['incomplete extraction',{...pendingReview(),intake:{...pendingReview().intake,stage:'extraction'}}],
  ['already applied with no events',{...pendingReview(),intake:{...pendingReview().intake,approval:{applied:true}}}],
  ['malformed candidate collection',{events:[],intake:{stage:'review',candidates:{length:9}}}]
])test(`Home does not advertise a pending review for ${label}`,()=>{
  const continuation=familyHomeContinuation(document);
  assert.equal(continuation.enabled,false);assert.equal(continuation.candidateCount,0);
  assert.equal(continuation.route,'builder');
});
