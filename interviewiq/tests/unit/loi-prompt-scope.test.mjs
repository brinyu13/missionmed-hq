import test from 'node:test';import assert from 'node:assert/strict';
import{buildLoiProseRequest,LOI_MODEL,SYNTHETIC_LOI_DIAGNOSTIC_REQUEST}from'../../server/loi-openai.mjs';
const input=(extra={})=>({program:{id:'qa',name:'Synthetic Program'},refs:[{ref:'program',kind:'identity',text:'Synthetic Program'},{ref:'reason:0',kind:'reason',text:'I value understanding program leadership before an interview.'}],approaches:['DIRECT_CONCISE'],positionType:null,advancedProgramName:null,...extra});
const body=x=>JSON.parse(buildLoiProseRequest(x,4096));
test('ordinary direct request contains only the selected strategy and no injected training pathway',()=>{
 const b=body(input());assert.match(b.instructions,/exactly ONE complete letter/);assert.match(b.instructions,/DIRECT_CONCISE:/);
 for(const label of ['WARM_PERSONAL','ACADEMIC_PROGRAM','POST_INTERVIEW','UPDATE_LED','STRONG_INTEREST','PGY-1','Advanced program pathway'])assert.ok(!b.instructions.includes(label),label);
 assert.match(b.instructions,/Instructions describe writing behavior and are NEVER evidence/);assert.match(b.instructions,/Do not print strategy labels/);
 assert.equal(b.model,LOI_MODEL);assert.equal(b.store,false);assert.deepEqual(b.tools,[]);assert.deepEqual(b.reasoning,{effort:'minimal'});
});
test('explicit three request scopes each complete composition to the three selected approaches',()=>{
 const approaches=['WARM_PERSONAL','DIRECT_CONCISE','ACADEMIC_PROGRAM'],b=body(input({approaches}));assert.match(b.instructions,/explicitly requested THREE complete letters/);
 for(const a of approaches)assert.ok(b.instructions.includes(a+':'));for(const a of ['POST_INTERVIEW','UPDATE_LED','STRONG_INTEREST'])assert.ok(!b.instructions.includes(a));
 assert.deepEqual(JSON.parse(b.input[0].content[0].text).approaches,approaches);
});
test('program type alone or stray reference alone cannot inject position instructions',()=>{
 assert.ok(!body(input({positionType:'PRELIMINARY'})).instructions.includes('PGY-1'));
 assert.ok(!body(input({refs:[...input().refs,{ref:'positionContext',kind:'context',text:'This is a Preliminary (PGY-1) program.'}]})).instructions.includes('PGY-1'));
});
test('confirmed prelim context keeps PGY-1 without inventing an Advanced relationship',()=>{
 const refs=[...input().refs,{ref:'positionContext',kind:'context',text:'This is a Preliminary (PGY-1) program.'}],b=body(input({refs,positionType:'PRELIMINARY'}));assert.match(b.instructions,/PGY-1 qualifying year/);assert.ok(!b.instructions.includes('Advanced program pathway'));
});
test('confirmed linked Advanced relationship retains its conditional instruction',()=>{
 const refs=[...input().refs,{ref:'positionContext',kind:'context',text:'This is a Transitional Year (PGY-1) program. The applicant is pursuing the prerequisite year for Example Advanced Program.'}],b=body(input({refs,positionType:'TRANSITIONAL_YEAR',advancedProgramName:'Example Advanced Program'}));assert.match(b.instructions,/confirmed Advanced program pathway/);
});
test('consumed diagnostic request is not reused',()=>assert.notEqual(SYNTHETIC_LOI_DIAGNOSTIC_REQUEST,'8806fffb-6f9b-4768-8389-442d9798220f'));
