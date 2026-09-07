import assert from 'node:assert/strict';
import test from 'node:test';
import {TimelineProductionAuthClient} from '../web/js/production/timeline-auth-client.js';

const actor='10000000-0000-4000-8000-000000022003';
const student='10000000-0000-4000-8000-000000022001';
const locationObject={origin:'https://synthetic.test',pathname:'/timeline/',search:'?student=422001',hash:''};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=()=>`${encode({alg:'HS256'})}.${encode({sub:actor,wp_user_id:422003,timeline_role:'PROGRAM_ADMIN',timeline_admin_workspace:true,exp:Math.floor(Date.now()/1000)+120})}.synthetic`;
async function harness(){
  let now=Date.now(),openCount=0,renewResponse=null;
  const requests=[];
  const grant=()=>({documentId:'document022a',studentPrincipalId:student,canEdit:true,
    grantExpiresAt:new Date(now+600000).toISOString(),subject:{wpUserId:422001,principalId:student,canEdit:true}});
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,globalObject:{},clock:()=>now,
    fetchImpl:async(url,options={})=>{
      const path=new URL(String(url)).pathname;
      if(path.endsWith('admin-ajax.php'))return response({success:true,data:{nonce:'synthetic-nonce',token_endpoint:'/token',api_base:'/api/v1',matrix_url:'/member-dashboard/',admin_endpoint:'/admin',user:{principal_id:actor,wp_user_id:422003,role:'PROGRAM_ADMIN'}}});
      if(path==='/token')return response({token:token()});
      if(path==='/admin/students/422001/open'){openCount++;return openCount>1&&renewResponse?await renewResponse(grant()):response(grant());}
      requests.push({path,options});return response({ok:true});
    }});
  await client.initialize();await client.openAdminStudent(422001);client.setAdminSubject(422001);
  return {client,requests,grant,advance(ms){now+=ms;},setRenew(fn){renewResponse=fn;},get opens(){return openCount;}};
}

test('selected-student saves renew a ten-minute grant through the dedicated server open endpoint',async()=>{
  const h=await harness();try{
    await h.client.createVersion('document022a',1,{title:'Preserved edit'},'Before expiry');assert.equal(h.opens,1);
    h.advance(601000);
    await h.client.createVersion('document022a',2,{title:'Continued edit'},'After expiry');
    assert.equal(h.opens,2);assert.equal(h.requests.length,2);
    assert.equal(h.requests[1].options.headers['x-timeline-subject-wp-user-id'],'422001');
    assert.deepEqual(JSON.parse(h.requests[1].options.body),{baseRevision:2,snapshot:{title:'Continued edit'},label:'After expiry'});
  }finally{h.client.close();}
});

test('concurrent expired-grant operations share one verified renewal',async()=>{
  const h=await harness();try{
    h.advance(601000);let release;const gate=new Promise(resolve=>{release=resolve;});
    h.setRenew(async grant=>{await gate;return response(grant);});
    const first=h.client.getDocument('document022a');const second=h.client.getDocument('document022a');
    await new Promise(resolve=>setImmediate(resolve));assert.equal(h.opens,2);assert.equal(h.requests.length,0);
    release();await Promise.all([first,second]);assert.equal(h.opens,2);assert.equal(h.requests.length,2);
  }finally{h.client.close();}
});

for(const change of ['document','principal','capability'])test(`renewal with changed ${change} stops without switching the open document or changing pending edits`,async()=>{
  const h=await harness();try{
    const snapshot={id:'document022a',title:'Unsynced administrator edit',events:[{id:'event1',title:'Keep this'}]};
    const original=structuredClone(snapshot),binding=h.client.adminSubjectGrant;
    h.advance(601000);h.setRenew(grant=>{
      if(change==='document')grant.documentId='document022b';
      if(change==='principal'){grant.studentPrincipalId='other-principal';grant.subject.principalId='other-principal';}
      if(change==='capability'){grant.canEdit=false;grant.subject.canEdit=false;}
      return response(grant);
    });
    await assert.rejects(h.client.createVersion('document022a',2,snapshot,'Pending'),{code:'ADMIN_SUBJECT_CHANGED'});
    await assert.rejects(h.client.createVersion('document022a',2,snapshot,'Retry'),{code:'ADMIN_SUBJECT_CHANGED'});
    assert.deepEqual(snapshot,original);assert.equal(h.client.adminSubjectGrant,binding);
    assert.equal(h.client.subjectWpUserId,422001);assert.equal(h.opens,2);assert.equal(h.requests.length,0);
  }finally{h.client.close();}
});

test('temporary renewal failure preserves binding and retries through current server authority',async()=>{
  const h=await harness();try{
    const binding=h.client.adminSubjectGrant;h.advance(601000);
    h.setRenew(()=>response({code:'directory_unavailable',message:'Try again'},503));
    await assert.rejects(h.client.createVersion('document022a',1,{title:'Pending'},'Pending'),{code:'directory_unavailable'});
    assert.equal(h.requests.length,0);assert.equal(h.client.adminSubjectGrant,binding);
    h.setRenew(grant=>response(grant));await h.client.createVersion('document022a',1,{title:'Pending'},'Pending');
    assert.equal(h.opens,3);assert.equal(h.requests.length,1);
  }finally{h.client.close();}
});

test('revoked eligibility blocks renewal and prevents the pending document request',async()=>{
  const h=await harness();try{
    h.advance(601000);h.setRenew(()=>response({code:'eligibility_required',message:'Access revoked'},403));
    await assert.rejects(h.client.createVersion('document022a',1,{title:'Pending'},'Pending'),{code:'eligibility_required'});
    assert.equal(h.requests.length,0);assert.equal(h.client.locked,true);
  }finally{h.client.close();}
});

test('client cannot bind an unverified subject or request another document in this workspace',async()=>{
  const h=await harness();try{
    assert.throws(()=>h.client.setAdminSubject(422002),{code:'ADMIN_SUBJECT_INVALID'});
    await assert.rejects(h.client.createVersion('document022b',1,{},'Wrong subject'),{code:'ADMIN_DOCUMENT_MISMATCH'});
    assert.equal(h.requests.length,0);
  }finally{h.client.close();}
});

test('renewal cannot use a near-expired returned grant',async()=>{
  const h=await harness();try{
    h.advance(601000);h.setRenew(grant=>response({...grant,grantExpiresAt:new Date(Date.parse(grant.grantExpiresAt)-590000).toISOString()}));
    await assert.rejects(h.client.getDocument('document022a'),{code:'ADMIN_GRANT_RENEWAL_REQUIRED'});
    assert.equal(h.requests.length,0);
  }finally{h.client.close();}
});

test('closing a workspace during renewal prevents late document requests and timer reactivation',async()=>{
  const h=await harness();try{
    h.advance(601000);let release;const gate=new Promise(resolve=>{release=resolve;});
    h.setRenew(async grant=>{await gate;return response(grant);});
    const pending=h.client.createVersion('document022a',1,{title:'Pending local edit'},'Pending');
    await new Promise(resolve=>setImmediate(resolve));h.client.close();release();
    await assert.rejects(pending,{code:'ADMIN_SUBJECT_CHANGED'});
    assert.equal(h.requests.length,0);assert.equal(h.client.adminGrantTimer,null);
  }finally{h.client.close();}
});
