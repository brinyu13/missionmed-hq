import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeLoi,loiChecks} from '../../server/private-commands.mjs';
function fixture(){
 const actor={id:randomUUID(),role:'student',tier:'360',eligible:true},id=randomUUID(),program={id:'canonical-program',name:'Example Program',track:'',registryReleaseId:'registry-release'};
 const row={id,owner_id:actor.id,program_id:program.id,program_name:program.name,program_track:''},anchors=[];let reads=0;
 const db={async query(sql,args){if(sql.startsWith('SELECT * FROM iiq.interviews'))return {rows:args[1]===actor.id?[row]:[]};if(sql.includes('FROM iiq.preparation'))return {rows:[{anchors:structuredClone(anchors)}]};if(sql.includes('FROM iiq.consents'))return {rows:[]};if(sql.startsWith('INSERT INTO iiq.preparation')){anchors.push(...JSON.parse(args[2]));return {rows:[{id:randomUUID()}]};}assert.fail(sql);}};
 const owners={async getProgram(){return {...program};},async getProgramResearch(){reads++;throw Error('RISE unavailable');}};
 const data={letterId:null,expectedHead:null,expectedLetterVersion:0,text:'My genuine interest and my own words.',context:{whyNow:'',applicationState:'',interviewState:''},motivations:[],facts:[],selectedEvidence:[],studentFactualConfirmation:false,studentSpecificityConfirmation:false};
 return {ctx:{db,actor,interviewId:id,owners,config:{loi:{enabled:true,mode:'ELIGIBLE'}},command:'loi.save',data},anchors,program,reads:()=>reads};
}
test('uncited draft save checks canonical program binding without requesting research',async()=>{
 const x=fixture();await writeLoi(x.ctx);assert.equal(x.reads(),0);const saved=x.anchors.at(-1);assert.equal(saved.text,x.ctx.data.text);assert.deepEqual(saved.evidence,[]);assert.equal(saved.evidenceDigest,null);assert.equal(saved.program.registryReleaseId,'registry-release');assert.ok(loiChecks(saved).reasons.length,'draft cannot pass approval without current evidence');
});
test('uncited save still rejects changed canonical binding and cited save still requires research',async()=>{
 const x=fixture();x.program.name='Changed identity';await assert.rejects(writeLoi(x.ctx),{code:'loi_binding_changed'});assert.equal(x.anchors.length,0);
 const y=fixture();y.ctx.data.selectedEvidence=[{field:'research.curriculum',claimRef:'claim-reference'}];await assert.rejects(writeLoi(y.ctx),/RISE unavailable/);assert.equal(y.reads(),1);assert.equal(y.anchors.length,0);
});
