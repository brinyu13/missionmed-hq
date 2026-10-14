// Exact-source, synthetic offline regression. No providers, accounts or real DB.
// Usage: node avatar-integrity-path.test.cjs --source /path/to/LIVE/arena.html
// Optional: --report /path/results.json; --baseline records expected failures.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const option = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const sourcePath = option('--source') || path.resolve(__dirname, '../../LIVE/arena.html');
const html = fs.readFileSync(sourcePath, 'utf8');
const between = (a, b) => {
  const start = html.indexOf(a);
  const end = html.indexOf(b, start + a.length);
  assert(start >= 0 && end > start, `Exact source boundary unavailable: ${a}`);
  return html.slice(start, end);
};
const upload = between('  async function uploadArenaAvatar(file){', '\n  async function handleAvatarSubmit');
const exact = [
  between('  async function sha256HexOfBlob(', '\n  window.refreshArenaAvatarFeatureCard'),
  between('  function extractAvatarUrlFromPayload(', '\n  function stripAvatarUrl'),
  between('  function normalizeAvatarLockerRecord(', '\n  function sortAvatarLockerRecords'),
  between('  function getActiveAvatarRecord(', '\n  function getActiveAvatarThumbnailUrl'),
  between('  async function hydrateAvatarState(', '\n  async function loadAvatarLockerFromSupabase'),
  between('  async function persistAvatarRecord(', '\n  async function persistAvatarV3Record'),
  between('  async function persistActiveAvatarSelection(', '\n  async function captureMatchAvatarSnapshot'),
  between('  function applyResolvedAvatarResult(', '\n  function setAvatarModalUploading'),
  between('  function setAvatarStep(', '\n  function unlockAvatarRequestLock'),
  between('  function unlockAvatarRequestLock(', '\n  function syncAvatarLimitsPanel'),
  upload
];
const USER = '00000000-0000-4000-8000-000000000001';
const OLD = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000003';
const NEW = '00000000-0000-4000-8000-000000000004';
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const photo = bytes => ({size:Buffer.byteLength(bytes),type:'image/png',name:'synthetic.png',arrayBuffer:async()=>Uint8Array.from(Buffer.from(bytes)).buffer});
const synthetic = photo('synthetic-photo-bytes');
const HASH = crypto.createHash('sha256').update('synthetic-photo-bytes').digest('hex');
const valid = () => ({success:true,avatar_url:'https://stub.invalid/generated.png',source_photo_sha256:HASH,source_photo_bytes:synthetic.size,identity_conditioned:true,engine:'identity_openai'});
const clone = x => JSON.parse(JSON.stringify(x));
function initialStore() {
  return {rows:[
    {id:OLD,user_id:USER,avatar_url:'https://stub.invalid/existing.png',thumbnail_url:'https://stub.invalid/existing.png',gender:'male',is_active:true,created_at:'2026-01-01T00:00:00Z'},
    {id:OTHER,user_id:USER,avatar_url:'https://stub.invalid/other.png',thumbnail_url:'https://stub.invalid/other.png',gender:'female',is_active:false,created_at:'2026-01-02T00:00:00Z'}
  ],profile:{player_id:USER,active_avatar_id:OLD},storage:{full:'https://stub.invalid/existing.png',thumb:'https://stub.invalid/existing.png'}};
}
function environment(spec, store=initialStore()) {
  const calls={persist:0,activate:0,fallback:0,fetch:0,rpc:[],toasts:[],status:[],steps:[],resolved:0,sentFields:[]};
  const elements=new Map();
  function element(id) {
    if(!elements.has(id)) {
      const classes=new Set();
      elements.set(id,{id,textContent:'',className:'',disabled:false,style:{},src:'',classList:{toggle:(name,on)=>on ? classes.add(name) : classes.delete(name),contains:name=>classes.has(name)},removeAttribute(name){delete this[name];}});
    }
    return elements.get(id);
  }
  function query(table) {
    const filters=[];
    const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},maybeSingle(){return Promise.resolve(read(true));},single(){return Promise.resolve(read(true));},then(resolve,reject){return Promise.resolve(read(false)).then(resolve,reject);},upsert(){throw new Error('Unexpected table write; successful RPC path should be used.');},update(){throw new Error('Unexpected table activation fallback.');}};
    function read(single) {
      const rows=(table==='user_avatars' ? store.rows : [store.profile]).filter(r=>filters.every(([k,v])=>r[k]===v));
      return {data:clone(single ? rows[0] || null : rows),error:null};
    }
    return q;
  }
  const noop=()=>{};
  const ctx={
    console:{log:noop,info:noop,warn:noop,error:noop},URL,Date,Number,Promise,
    window:{crypto:spec.noCrypto ? null : crypto.webcrypto,MM_USER:{avatar:{id:OLD,avatar_url:store.storage.full}}},
    document:{getElementById:element},
    FormData:class {append(k,v){calls.sentFields.push([k,v]);}},
    setTimeout:()=>1,clearTimeout:noop,
    AVATAR_API_ENDPOINT:spec.noEndpoint ? '' : 'https://stub.invalid/api/avatar',
    ArenaUser:{id:USER,wpUserId:'1',username:'synthetic',displayName:'synthetic',activeAvatarId:store.profile.active_avatar_id},
    avatarState:{gender:'male',file:synthetic,step:'ready',previewUrl:'blob:synthetic'},
    avatarLockerRecords:clone(store.rows),avatarLockerLoaded:false,avatarHydrationPromise:null,
    avatarRequestInFlight:false,avatarUploadInFlight:false,avatarRequestSafetyTimer:null,
    latestGeneratedAvatarUrl:'https://stub.invalid/stale-modal-result.png',avatarModalStatusMessage:'',avatarModalStatusTone:'',
    normalizeAvatarUploadInput:f=>spec.normalize ? photo('processed-photo-bytes') : f,
    normalizeAvatarGender:g=>g,createAvatarUuid:()=>NEW,isUuid:uuid,
    ensureAvatarSupabaseIdentity:async()=>USER,
    stopAvatarExecution:(code)=>{throw new Error(code);},serializeSupabaseError:e=>e,
    setAvatarLockerRecords:(rows,opts)=>{ctx.avatarLockerRecords=clone(rows).map(r=>({...r,is_active:r.id===opts.activeId}));ctx.ArenaUser.activeAvatarId=opts.activeId;},
    fetch:async()=>{calls.fetch++;if(spec.networkError)throw new Error('Synthetic provider unavailable');return {ok:!spec.httpFailure,status:spec.httpFailure ? 503 : 200,json:async()=>{if(spec.invalidJson)throw new SyntaxError('Invalid JSON');return clone(spec.payload);}};},
    uploadAvatarAssetToR2ViaBackend:async()=>{calls.fallback++;return {avatar_url:'https://stub.invalid/raw-photo.png',avatar_id:NEW};},
    arenaSupabase:{auth:{getUser:async()=>({data:{user:{id:USER}},error:null})},from:query,rpc:async(name,p)=>{
      calls.rpc.push(name);
      if(name==='upsert_user_avatar_record') {
        const row={id:p.p_avatar_id,user_id:USER,avatar_url:p.p_avatar_url,thumbnail_url:p.p_thumbnail_url,gender:p.p_gender,is_active:false,created_at:'2026-10-14T00:00:00Z'};
        store.rows.push(row);return {data:clone(row),error:null};
      }
      if(name==='set_active_user_avatar') {
        store.rows.forEach(r=>{r.is_active=r.id===p.p_avatar_id;});store.profile.active_avatar_id=p.p_avatar_id;
        return {data:true,error:null};
      }
      throw new Error('Unexpected RPC: '+name);
    }},
    showToast:(message,tone)=>calls.toasts.push({message,tone}),logAvatarSupabase:noop,
    setAvatarModalUploading:noop,setNavUploading:noop,startAvatarGeneratingUI:noop,stopAvatarGeneratingUI:noop,
    saveAvatarToStorage:(full,thumb)=>{store.storage={full,thumb};},saveAvatarGenderPreference:noop,
    incrementAvatarAttempts:noop,updateMMUserAvatarObject:r=>{ctx.window.MM_USER.avatar=clone(r);},
    resolveUserAvatarUrl:noop,applyAvatarUrls:noop,refreshArenaAvatarFeatureCard:noop,flashNavSuccess:noop,
    setPendingAvatarFile:f=>{ctx.avatarState.file=f;}
  };
  vm.createContext(ctx);
  vm.runInContext(exact.join('\n'),ctx);
  for(const [name,key] of [['persistAvatarRecord','persist'],['persistActiveAvatarSelection','activate'],['applyResolvedAvatarResult','resolved']]) {
    const fn=ctx[name];ctx[name]=function(...a){calls[key]++;return fn(...a);};
  }
  const setStatus=ctx.setAvatarModalStatus;
  ctx.setAvatarModalStatus=(message,tone)=>{calls.status.push({message,tone});return setStatus(message,tone);};
  const setStep=ctx.setAvatarStep;
  ctx.setAvatarStep=step=>{calls.steps.push(step);return setStep(step);};
  return {ctx,calls,store,elements};
}
const cases=[
  ['photo_hash_mismatch',{source_photo_sha256:'b'.repeat(64)}],
  ['identity_false',{identity_conditioned:false}],
  ['identity_missing',{identity_conditioned:undefined}],
  ['identity_wrong_type',{identity_conditioned:'true'}],
  ['hash_missing',{source_photo_sha256:undefined}],
  ['hash_wrong_type',{source_photo_sha256:123}],
  ['hash_bad_format',{source_photo_sha256:'not-a-sha256'}],
  ['hash_whitespace',{source_photo_sha256:' '+HASH}],
  ['bytes_missing',{source_photo_bytes:undefined}],
  ['bytes_wrong_type',{source_photo_bytes:String(synthetic.size)}],
  ['bytes_mismatch',{source_photo_bytes:synthetic.size+1}],
  ['bytes_zero',{source_photo_bytes:0}],
  ['success_false',{success:false}],
  ['success_missing',{success:undefined}],
  ['success_wrong_type',{success:'true'}],
  ['provider_error_with_success',{error:'Provider rejected request'}],
  ['url_missing',{avatar_url:undefined}],
  ['url_wrong_type',{avatar_url:{url:'https://stub.invalid/image.png'}}],
  ['url_invalid',{avatar_url:'not-a-url'}],
  ['url_non_https',{avatar_url:'http://stub.invalid/image.png'}],
  ['url_credentials',{avatar_url:'https://user:password@stub.invalid/image.png'}],
  ['thumbnail_invalid',{thumbnail_url:{url:'https://stub.invalid/image.png'}}]
].map(([name,patch])=>({name,payload:{...valid(),...patch}})).concat([
  {name:'null_payload',payload:null}, {name:'array_payload',payload:[]}, {name:'string_payload',payload:'success'},
  {name:'malformed_json',payload:null,invalidJson:true},
  {name:'provider_http_failure',payload:{success:false,message:'Unavailable'},httpFailure:true},
  {name:'provider_network_failure',payload:null,networkError:true},
  {name:'endpoint_missing',payload:valid(),noEndpoint:true},
  {name:'browser_hash_unavailable',payload:valid(),noCrypto:true}
]);
function rejectedViolations(env,before,result) {
  const {ctx,calls,store,elements}=env;const violations=[];
  if(calls.persist)violations.push('persistence called');
  if(calls.activate)violations.push('activation called');
  if(calls.fallback)violations.push('raw-photo fallback called');
  if(calls.resolved || calls.steps.includes('done'))violations.push('success-result state reached');
  if(calls.toasts.some(x=>x.tone==='success') || calls.status.some(x=>x.tone==='success'))violations.push('success notification emitted');
  if(JSON.stringify(store)!==JSON.stringify(before))violations.push('existing records/selection/storage changed');
  if(ctx.avatarState.step!=='preview' || !ctx.avatarState.file || ctx.latestGeneratedAvatarUrl)violations.push('recoverable preview state not restored');
  if(ctx.avatarRequestInFlight || ctx.avatarUploadInFlight)violations.push('request lock not released');
  if(ctx.avatarModalStatusTone!=='error' || !ctx.avatarModalStatusMessage)violations.push('clear error missing');
  if(!/try again/i.test(ctx.avatarModalStatusMessage) || !/different photo/i.test(ctx.avatarModalStatusMessage))violations.push('recovery guidance missing');
  if(elements.get('arenaAvatarPrimaryBtn')?.disabled || elements.get('arenaAvatarSecondaryBtn')?.style.display==='none')violations.push('recovery controls unavailable');
  if(elements.get('arenaAvatarModalTitle')?.textContent==='Avatar Ready' || elements.get('arenaAvatarStepDone')?.classList.contains('active'))violations.push('Avatar Ready UI still active');
  if(result.avatar_url)violations.push('rejected URL returned');
  return violations;
}
async function validFlow(spec= {payload:valid()}) {
  const env=environment(spec);const before=clone(env.store);const result=await env.ctx.uploadArenaAvatar(synthetic);
  assert.equal(env.calls.persist,1);assert.equal(env.calls.activate,1);assert.equal(env.calls.fallback,0);
  assert.equal(env.calls.fetch,1);assert.equal(env.ctx.avatarState.step,'done');assert.equal(env.ctx.avatarModalStatusTone,'success');
  assert.equal(env.elements.get('arenaAvatarModalTitle').textContent,'Avatar Ready');assert.equal(env.calls.resolved,1);
  assert.equal(result.avatar_url,spec.payload.avatar_url);assert.equal(env.store.profile.active_avatar_id,NEW);
  const sentPhoto=env.calls.sentFields.find(([k])=>k==='photo')[1];
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await sentPhoto.arrayBuffer())).digest('hex'),spec.payload.source_photo_sha256.toLowerCase());
  assert.equal(sentPhoto.size,spec.payload.source_photo_bytes);
  for(const [field,expected] of [['user_id',USER],['wp_user_id','1'],['avatar_id',NEW],['source','arena_v1'],['gender','male']]) {
    assert.equal(env.calls.sentFields.find(([k])=>k===field)[1],expected);
  }
  for(const old of before.rows)assert.equal(env.store.rows.find(r=>r.id===old.id).avatar_url,old.avatar_url);
  assert.equal(env.store.rows.length,before.rows.length+1);
  const fresh=environment(spec,env.store);const hydrated=await fresh.ctx.hydrateAvatarState({force:true,source:'synthetic_fresh_context_reload'});
  assert.equal(hydrated.active.id,NEW);assert.equal(hydrated.active.avatar_url,spec.payload.avatar_url);assert.equal(hydrated.count,3);
  assert.equal(fresh.calls.fetch,0);assert.equal(fresh.calls.persist,0);assert.equal(fresh.calls.activate,0);
  return {name:spec.name||'valid_save_activate_fresh_context_reload',status:'PASS',persist:1,activate:1,reloadActiveId:hydrated.active.id};
}
(async()=>{
  const results=[];
  for(const spec of cases) {
    const env=environment(spec);const before=clone(env.store);const result=await env.ctx.uploadArenaAvatar(synthetic);
    const violations=rejectedViolations(env,before,result);
    results.push({name:spec.name,status:violations.length ? 'FAIL' : 'PASS',violations,persist:env.calls.persist,activate:env.calls.activate,fallback:env.calls.fallback,fetch:env.calls.fetch,finalStep:env.ctx.avatarState.step,errorMessage:env.ctx.avatarModalStatusMessage});
  }
  for(const spec of [
    {name:'valid_save_activate_fresh_context_reload',payload:valid()},
    {name:'valid_uppercase_sha',payload:{...valid(),source_photo_sha256:HASH.toUpperCase()}},
    {name:'valid_explicit_thumbnail',payload:{...valid(),thumbnail_url:'https://stub.invalid/thumbnail.png'}},
    {name:'valid_normalized_submitted_bytes',normalize:true,payload:{...valid(),source_photo_sha256:crypto.createHash('sha256').update('processed-photo-bytes').digest('hex'),source_photo_bytes:Buffer.byteLength('processed-photo-bytes')}}
  ]) {
    try{results.push(await validFlow(spec));}catch(e){results.push({name:spec.name,status:'FAIL',violations:[String(e)]});}
  }
  if(!args.includes('--baseline')) {
    const spec={payload:{...valid(),identity_conditioned:false}};
    const env=environment(spec);const before=clone(env.store);const rejection=await env.ctx.uploadArenaAvatar(synthetic);
    assert.deepEqual(rejectedViolations(env,before,rejection),[]);
    spec.payload=valid();const recovery=await env.ctx.uploadArenaAvatar(synthetic);
    assert.equal(recovery.avatar_url,valid().avatar_url);assert.equal(env.calls.persist,1);assert.equal(env.calls.activate,1);assert.equal(env.calls.fetch,2);
    results.push({name:'retry_after_rejection',status:'PASS',persist:1,activate:1});
  }
  const failures=results.filter(r=>r.status==='FAIL');
  const report={utc:new Date().toISOString(),sourcePath,sourceSha256:crypto.createHash('sha256').update(html).digest('hex'),uploadFunctionSha256:crypto.createHash('sha256').update(upload).digest('hex'),mode:args.includes('--baseline')?'BEFORE_REPAIR':'CANDIDATE',scope:'Exact upload/real SHA/real persistence/selection/hydration/render functions in VM; synthetic provider and in-memory Supabase transport. Reload means fresh JS context against retained synthetic store, not production reload.',total:results.length,passed:results.length-failures.length,failed:failures.length,results};
  if(option('--report'))fs.writeFileSync(option('--report'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({mode:report.mode,total:report.total,passed:report.passed,failed:report.failed,failedCases:failures.map(r=>r.name)},null,2));
  if(failures.length && !args.includes('--baseline'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
