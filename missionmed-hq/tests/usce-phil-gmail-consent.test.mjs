import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {PHIL_GMAIL_PATH as path,handlePhilGmail,philAccessToken} from '../routes/usce-phil-gmail.mjs';

const site='https://missionmed-usce-gateway-production.up.railway.app';
const account='philaperri@gmail.com';
const scope='https://www.googleapis.com/auth/gmail.readonly';
function harness({profile=account,permission=scope,save=true,grant=true}={}) {
  const env={MMHQ_USCE_GATEWAY_CHILD:'1',USCE_PHIL_GOOGLE_CLIENT_ID:'123-test.apps.googleusercontent.com',
    USCE_PHIL_GOOGLE_CLIENT_SECRET:'synthetic-client',USCE_PHIL_GRANT_KEY:randomBytes(32).toString('base64url')};
  const writes=[],requests=[];let used=false,clock=Date.now();
  const fetchImpl=async(url,options)=>{
    requests.push(url);
    if(url.endsWith('/token')){
      if(options.body.get('grant_type')==='authorization_code'){
        assert.equal(options.body.get('redirect_uri'),site+path+'/callback');
        if(used)return Response.json({}, {status:400}); used=true;
      }
      return Response.json({scope:permission,access_token:'synthetic-access',refresh_token:grant?'synthetic-refresh':null,token_type:'Bearer',expires_in:3600});
    }
    assert.equal(url,'https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=emailAddress');
    return Response.json({emailAddress:profile});
  };
  const rpc=async(name,data)=>{assert.equal(name,'usce_phil_case_mail');writes.push(data);return {ok:save};};
  async function request(method,subpath,headers={},form) {
    const req=Readable.from(form===undefined?[]:[new URLSearchParams(form).toString()]);
    Object.assign(req,{method,headers});const output={};
    const res={writeHead(status,headers){Object.assign(output,{status,headers});},end(text=''){output.text=text;}};
    await handlePhilGmail(req,res,new URL(site+path+subpath),{env,fetchImpl,rpc,now:()=>clock});
    return output;
  }
  async function start(){const r=await request('POST','/start',{origin:site,'content-type':'application/x-www-form-urlencoded'},{account});assert.equal(r.status,303);
    const auth=new URL(r.headers.Location);return {auth,cookie:r.headers['Set-Cookie'].split(';')[0],attributes:r.headers['Set-Cookie']};}
  const finish=(session,overrides={})=>request('POST','/callback',{'content-type':'application/x-www-form-urlencoded',cookie:session.cookie},{code:'synthetic-code',state:session.auth.searchParams.get('state'),...overrides});
  return {env,request,start,finish,writes,requests,fetchImpl,advance:ms=>{clock+=ms;}};
}

test('disclosure precedes consent; public reads and foreign POSTs make zero provider calls',async()=>{
  const h=harness(),r=await h.request('GET','');
  assert.equal(r.status,200);assert.match(r.text,/read-only access/);assert.match(r.text,/authorized Clinicals HQ staff/);assert.match(r.text,/deletion/);
  assert.ok(!r.text.includes(account));assert.match(r.text,/Limited Use/);
  assert.equal((await h.request('POST','/start',{origin:site,'content-type':'application/x-www-form-urlencoded'},{account:'someone@example.org'})).status,400);
  assert.match(r.headers['Content-Security-Policy'],/form-action 'self' https:\/\/accounts\.google\.com/);
  assert.equal((await h.request('POST','/start',{origin:'https://elsewhere.example'})).status,400);
  assert.equal((await h.request('GET','/callback?code=test')).status,400);
  assert.deepEqual(h.requests,[]);assert.deepEqual(h.writes,[]);
});

test('authorization pins the mailbox, web callback, single read scope, browser session and PKCE',async()=>{
  const h=harness(),session=await h.start(),a=session.auth;
  assert.equal(a.origin,'https://accounts.google.com');assert.equal(a.searchParams.get('redirect_uri'),site+path+'/callback');
  assert.equal(a.searchParams.get('response_mode'),'form_post');assert.equal(a.searchParams.get('scope'),scope);
  assert.equal(a.searchParams.get('access_type'),'offline');assert.equal(a.searchParams.get('login_hint'),account);
  assert.equal(a.searchParams.get('code_challenge_method'),'S256');assert.match(a.searchParams.get('code_challenge'),/^[\w-]{43}$/);
  assert.match(session.attributes,/__Host-/);for(const attr of ['HttpOnly','Secure','SameSite=None','Path=/'])assert.ok(session.attributes.includes(attr));
  assert.equal((await h.finish({...session,cookie:''})).status,400);
  assert.equal((await h.finish(session,{state:'x'.repeat(43)})).status,400);
  h.advance(901000);assert.equal((await h.finish(session)).status,400);
  assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
});

test('only verified Google mailbox and refreshable exact scope yield a private encrypted binding',async()=>{
  const h=harness(),s=await h.start(),r=await h.finish(s);
  assert.equal(r.status,200);assert.match(r.text,/connection is active/);assert.match(r.headers['Set-Cookie'],/Max-Age=0/);
  assert.equal(h.writes.length,1);const entry=h.writes[0];assert.equal(entry.p_action,'bind');assert.equal(entry.p_data.account,account);
  assert.equal(entry.p_data.scope,scope);assert.match(entry.p_data.encrypted_grant,/^v1\./);
  assert.ok(!JSON.stringify([entry,r]).includes('synthetic-refresh'));
  assert.equal(await philAccessToken(entry.p_data.encrypted_grant,h.env,h.fetchImpl),'synthetic-access');
  await assert.rejects(philAccessToken(entry.p_data.encrypted_grant,{...h.env,USCE_PHIL_GRANT_KEY:randomBytes(32).toString('base64url')},h.fetchImpl));
  assert.equal((await h.finish(s)).status,400);assert.equal(h.writes.length,1);
});

test('wrong account, broader scopes, denied consent and missing offline token do not bind a mailbox',async()=>{
  for(const setup of [{profile:'other@example.org'},{permission:scope+' https://mail.google.com/'},{grant:false}]){
    const h=harness(setup);assert.equal((await h.finish(await h.start())).status,400);assert.equal(h.writes.length,0);
  }
  const h=harness();assert.equal((await h.finish(await h.start(),{error:'access_denied'})).status,400);assert.deepEqual(h.requests,[]);
  assert.deepEqual(h.writes,[]);
  const failed=harness({save:false});assert.equal((await failed.finish(await failed.start())).status,400);
});
