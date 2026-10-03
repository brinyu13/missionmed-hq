import test from 'node:test';
import assert from 'node:assert/strict';
import {writeInterview} from '../../server/records.mjs';
const actor={id:'3f9984b5-1aa1-4e6d-9778-d6a7a3346036',role:'student'};
const id='f4c830d0-482d-46a6-a342-df8a4a61ce40',eventId='c45fbdc7-1c6b-41b6-bf13-baa07d97ca2c';
function harness(row={}){
  const record={id,owner_id:actor.id,status:'scheduled',start_at:'2026-10-20T14:00:00Z',previous_schedule:null,...row},calls=[];
  const db={async query(sql,values){calls.push({sql,values});if(sql.startsWith('SELECT * FROM iiq.interviews'))return {rows:[record]};if(sql.startsWith('UPDATE iiq.related_events'))return {rowCount:1,rows:[{id:eventId}]};return {rowCount:1,rows:[]};}};
  return {calls,run:(command,data)=>writeInterview({db,actor,command,data,interviewId:id,owners:{}})};
}
test('postpone and waitlist preserve the original disposition without inventing attendance',async()=>{
  for(const [action,status] of [['postpone','postponed'],['waitlist','waitlisted']]){
    const h=harness();await h.run('interview.lifecycle',{action});
    const update=h.calls.find(x=>x.sql.startsWith('UPDATE iiq.interviews'));
    assert.equal(update.values[2],status);assert.deepEqual(JSON.parse(update.values[3]),{status:'scheduled'});
    assert.doesNotMatch(update.sql,/confirmed_occurred|start_at=/);
  }
  const restore=harness({status:'waitlisted',previous_schedule:{status:'offered'}});await restore.run('interview.lifecycle',{action:'restore'});
  assert.equal(restore.calls.find(x=>x.sql.startsWith('UPDATE iiq.interviews')).values[2],'offered');
  await assert.rejects(harness({status:'completed'}).run('interview.lifecycle',{action:'postpone'}),/Correct whether/);
});
test('related-event cancellation and restoration are owner/interview scoped and preserve timing',async()=>{
  for(const [action,status] of [['cancel','cancelled'],['restore','scheduled']]){
    const h=harness();await h.run('event.update',{eventId,action});const update=h.calls.find(x=>x.sql.startsWith('UPDATE iiq.related_events'));
    assert.deepEqual(update.values,[actor.id,id,eventId,status]);assert.match(update.sql,/owner_id=\$1 AND interview_id=\$2 AND id=\$3/);assert.doesNotMatch(update.sql,/start_at|local_date/);
    assert.ok(h.calls.some(x=>x.sql.startsWith('INSERT INTO iiq.interview_history')));
  }
  await assert.rejects(harness().run('event.update',{eventId,action:'cancel',owner_id:'foreign'}),/unsupported/);
});
test('related event reschedules preserve date-only unknowns and reject an unselected DST fold',async()=>{
  const data={eventId,kind:'resident social',date:'2026-11-01',time:'01:30',zone:'America/New_York',fold:null,duration_minutes:45,note:'From invitation'};
  const rejected=harness();await assert.rejects(rejected.run('event.update',data),/occurs twice/);assert.equal(rejected.calls.filter(x=>x.sql.startsWith('UPDATE')).length,0);
  const chosen=harness();await chosen.run('event.update',{...data,fold:1});assert.equal(chosen.calls.find(x=>x.sql.startsWith('UPDATE iiq.related_events')).values[7],'2026-11-01T06:30:00.000Z');
  const unknown=harness();await unknown.run('event.update',{...data,time:null,duration_minutes:null});const values=unknown.calls.find(x=>x.sql.startsWith('UPDATE iiq.related_events')).values;assert.equal(values[4],'2026-11-01');assert.equal(values[5],null);assert.equal(values[7],null);assert.equal(values[10],null);
});
