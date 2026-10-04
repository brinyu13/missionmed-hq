import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectInterviewiqResearchResults,createInterviewiqResearchResultsReader} from '../adapters/interviewiq-research-results.mjs';
import {DEEP_RESEARCH_DOSSIER_V2} from '../src/research-router.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const context={programId:'synthetic-program',registryReleaseId:'synthetic-release'};
function fixture(){const at=new Date().toISOString(),fields=DEEP_RESEARCH_DOSSIER_V2.domains.flatMap(d=>d.fields.map(field=>({area:d.key,field,state:field==='research.visa'?'SUPPORTED':'UNKNOWN'}))).sort((a,b)=>a.field.localeCompare(b.field,'en'));const c={...context,observedAt:at,fields},coverage={...c,receipt:{sha256:sha(JSON.stringify(c)),publicRef:'rise-coverage-v1'}};const body={schema:'rise-interviewiq-research-results-v1',coverage,facts:[{area:'visa',field:'research.visa',state:'SUPPORTED',claimRef:'rise-claim:'+sha('claim'),value:{j1:true,summary:'Published J1 sponsorship'},retrievedAt:at,asOf:null,sources:[{claimRef:'rise-claim:'+sha('original'),reviewRef:'rise-review:'+sha('review'),urls:['https://program.hospital.edu/visa'],retrievedAt:at,reviewedAt:at}]}]};return {...body,receipt:{publicRef:'rise-results-v1',sha256:sha(JSON.stringify(body))}};}
test('explicit public projection preserves exact fact and source while dropping row metadata',()=>{const v=fixture();assert.deepEqual(projectInterviewiqResearchResults({...v,ownerId:'PRIVATE',raw:'PRIVATE',facts:v.facts.map(f=>({...f,metadata:'PRIVATE'}))},context),v);});
for(const [name,edit] of Object.entries({
 program:v=>v.coverage.programId='other',release:v=>v.coverage.registryReleaseId='other',
 hash:v=>v.receipt.sha256='0'.repeat(64),unknown:v=>v.facts[0].field='research.curriculum',duplicate:v=>v.facts.push(v.facts[0]),
 privateValue:v=>v.facts[0].value={private_note:'PRIVATE'},unsafeUrl:v=>v.facts[0].sources[0].urls=['https://127.0.0.1/private'],
 future:v=>v.facts[0].retrievedAt=new Date(Date.now()+60000).toISOString(),oversize:v=>v.facts[0].value='x'.repeat(8001),
 absentSource:v=>v.facts[0].sources=[],arbitraryClaim:v=>v.facts[0].claimRef='private/internal/path',
}))test('result projector denies '+name,()=>{const v=fixture();edit(v);assert.throws(()=>projectInterviewiqResearchResults(v,context));});
test('default-off factual reader has no pool fallback',async()=>{let connected=0;const read=createInterviewiqResearchResultsReader({pool:{options:{connectionTimeoutMillis:5000},async connect(){connected++;}}});await assert.rejects(read(context));assert.equal(connected,0);});

for(const key of ['WPUserID','ownerId','wpUserId','subjectKey','privateNotes','rawBody','secretKey','metadataBlob','studentId'])test('nested camelCase private value blocked '+key,()=>{const v=fixture();v.facts[0].value={public_fact:{[key]:'PRIVATE'}};assert.throws(()=>projectInterviewiqResearchResults(v,context));});
