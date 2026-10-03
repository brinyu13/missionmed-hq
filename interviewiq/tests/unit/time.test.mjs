import test from 'node:test';
import assert from 'node:assert/strict';
import {schedule,resolveWall,conflicts} from '../../server/time.mjs';
test('New York spring gap rejects without mutating submitted object',()=>{
  const input={wall:'2027-03-14T02:30',zone:'America/New_York',duration:60,format:'virtual',joining:'Private joining note'};
  const before=structuredClone(input);
  assert.throws(()=>schedule(input),{code:'dst_gap'});assert.deepEqual(input,before);
});
test('New York overlap requires explicit fold and resolves distinct instants',()=>{
  const x={wall:'2026-11-01T01:30',zone:'America/New_York'};
  assert.throws(()=>schedule(x),{code:'dst_fold_required'});
  assert.equal(schedule({...x,fold:0}).instant,'2026-11-01T05:30:00.000Z');
  assert.equal(schedule({...x,fold:1}).instant,'2026-11-01T06:30:00.000Z');
});
test('non-hour transition and non-US zones preserve actual offset',()=>{
  assert.equal(schedule({wall:'2026-10-20T09:00',zone:'Asia/Kolkata'}).instant,'2026-10-20T03:30:00.000Z');
  const candidates=resolveWall('2027-04-04T01:45','Australia/Lord_Howe');
  assert.equal(candidates.length,2);assert.equal(Date.parse(candidates[1].instant)-Date.parse(candidates[0].instant),30*60000);
});
test('undated and date-only offers do not fabricate an instant',()=>{
  assert.equal(schedule({zone:'UTC'}).instant,null);
  const x=schedule({date:'2026-10-20',zone:'America/Chicago'});
  assert.equal(x.date,'2026-10-20');assert.equal(x.instant,null);assert.equal(x.duration,null);
});
test('invalid dates, zones, duration, time and fold fail validation',()=>{
  for(const value of [{date:'2026-02-30'},{wall:'2026-10-20T24:00'},{wall:'2026-10-20T09:00junk'},{zone:'invalid'},{duration:0},{duration:-1},{duration:10.5},{duration:'60'},{fold:1},{wall:'2026-10-20T09:00',fold:2},{date:'2026-10-21',wall:'2026-10-20T09:00'}])assert.throws(()=>schedule(value));
});
test('conflict distinguishes overlap, travel and unknown duration without week-wide false conflicts',()=>{
  const a={instant:'2026-10-20T14:00:00Z',duration:60,format:'virtual',travel_minutes:null};
  assert.equal(conflicts(a,{...a,instant:'2026-10-20T14:30:00Z'}).kind,'overlap');
  assert.equal(conflicts(a,{...a,instant:'2026-10-20T15:30:00Z',format:'in person',travel_minutes:60}).kind,'travel');
  assert.equal(conflicts({...a,duration:null},{...a,instant:'2026-10-20T16:00:00Z'}).kind,'possible');
  assert.equal(conflicts({...a,duration:null},{...a,instant:'2026-10-28T16:00:00Z',duration:null}).kind,'none');
});
