import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {createCommittedResearchProof} from '../adapters/interviewiq-job-auth.mjs';
import {evaluateInterviewiqResearchEligibility} from '../src/interviewiq-research-policy.mjs';
import {evaluateResearchEligibility,normalizeResearchControls} from '../src/research-router.mjs';
const secret='synthetic-proof-only-never-production-12345';
const binding={requestId:randomUUID(),ownerId:randomUUID(),demandId:randomUUID(),interviewId:randomUUID(),programId:'test-program',registryReleaseId:'synthetic-release'};
const bodyHash='b'.repeat(64),subjectHash='a'.repeat(64);
const program={programSpecialtyId:binding.programId,designation:'Neurology',display:{state:'TX'},identifiers:[{namespace:'ACGME_PROGRAM',value:'1854831078'}]};
const controls=normalizeResearchControls({globalEnabled:true,studentEnabled:true,emergencyKillSwitch:false});
async function grant(role='student',tier='360') {
  return createCommittedResearchProof({enabled:true,requestSecret:'synthetic-request-only-never-production-67890',proofSecret:secret},{fetchImpl:async(_url,init)=>{
    const r=JSON.parse(init.body),payload=JSON.stringify({...r,allowed:true,reason:'current_committed_demand',exp:r.iat+30,wpUserId:90001,role,tier});
    return new Response(JSON.stringify({payload,signature:createHmac('sha256',secret).update(`iiq-job-proof-v1\nresponse\n${payload}`).digest('hex')}),{headers:{'Content-Type':'application/json'}});
  }})({binding,bodyHash,phase:'reserve'});
}
for(const [role,tier] of [['student','360'],['student','ivprep_complete'],['admin','admin']])test(`${role}/${tier} uses the same student research controls`,async()=>{
  const proof=await grant(role,tier),args={program,subjectHash,proof,binding,bodyHash};
  for(const change of [{},{studentEnabled:false},{globalEnabled:false},{emergencyKillSwitch:true},{canaryProgramIds:['1851113100']},
    {subjectAllowlistHashes:['c'.repeat(64)]},{canaryMode:'SPECIALTY_SCOPE',specialtyScope:['Internal Medicine'],stateScope:['NY']}]) {
    const c={...controls,...change};assert.deepEqual(evaluateInterviewiqResearchEligibility({...args,controls:c}),
      evaluateResearchEligibility({program,subjectHash,controls:c,session:{capabilities:['rise:private-beta']},source:'STUDENT'}));
  }
});
test('unknown entitlement policy cannot gain a fabricated RISE capability',async()=>{
  const proof=await grant();for(const entitlementScope of [['rise:operator'],['rise:private-beta','new-policy']]) {
    const result=evaluateInterviewiqResearchEligibility({program,subjectHash,proof,binding,bodyHash,controls:{...controls,entitlementScope}});
    assert.equal(result.eligible,false);assert.ok(result.reasons.includes('IIQ_ENTITLEMENT_SCOPE_UNREVIEWED'));
  }
});
test('caller-created principal is not admission authority',()=>assert.throws(()=>evaluateInterviewiqResearchEligibility({
  program,subjectHash,controls,binding,bodyHash,proof:{principal:{wpUserId:1,role:'admin',tier:'admin'},assertFresh(){}}
})));
