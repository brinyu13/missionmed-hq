import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseSavedReviewRoute, resolveOwnSavedReview, resolveReviewDestination, savedReviewHash, isAdminReview, createAdminReviewGate, mayPresentSavedReview, clearAdminReviewMedia} from '../../public/studio/review-scope.mjs';
import * as reviewScope from '../../public/studio/review-scope.mjs';

const source=readFileSync(new URL('../../public/studio/studio.mjs',import.meta.url),'utf8');
const routes=readFileSync(new URL('../../../missionmed-hq/ivoc/routes.mjs',import.meta.url),'utf8');
const bootstrapRoute=routes.slice(routes.indexOf("pathname === `${API_PREFIX}/bootstrap`"));
const identityCode=bootstrapRoute.match(/identity: (\{[^\n]+\}),/u)[1];
// Execute the actual server identity projection so fixtures cannot invent a
// differently named subject field while masking a broken production consumer.
const identityFor=(subject,admin=true)=>runInNewContext(`(${identityCode})`,{actor:subject,hqSession:{},admission:{},
  displayName:()=> 'Test actor',rolesOf:()=> admin?['administrator']:['student'],isAdmin:()=>admin,isMentor:()=>false});
const bootCode=source.slice(source.indexOf('async function boot()'),source.indexOf('\nvoid boot();'));
const viewCode=source.slice(source.indexOf('function setView('),source.indexOf('\nfunction renderAdminFacts('));
const roleCode=source.slice(source.indexOf('function applyRole('),source.indexOf('/* ------------------------------------------------------------------ router */'));
const playbackCode=source.slice(source.indexOf('async function openLastSavedFilmRoom('),source.indexOf('\nasync function analyzeLastAnswer('));
const id='4f708360-6a76-477d-a927-caca2989800d';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture({view='postanswer',mount=async()=>{},member=true,readDetail,admin=false,authorized=true,overview,playback}={}){
  const calls=[],nodes=new Map(),panels=['home','postanswer','filmroom','vault'].map(view=>({dataset:{viewPanel:view,active:String(view==='home')}}));
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{dataset:{active:'false'},textContent:'',hidden:false,replaceChildren(){},pause(){},removeAttribute(name){delete this[name];},load(){},append(){}});return nodes.get(selector);};
  const location={hash:`#${view}?session=${id}${admin?'&review=admin':''}`,pathname:'/iv-prep-on-call/advanced/'};
  const detail={id,ownerSubject:'wp:142',recording:{id:'recording',status:'saved'},results:{payload:{analytics:{answerId:id}}}};
  const state={role:'student',view:'home',session:{state:'IDLE'},lastSaved:null,filmGroups:{ingestResult:()=>calls.push('analytics')},
    durable:{ready:true,bootstrapPayload:{identity:identityFor('wp:1',authorized)},bootstrap:async()=>{},playback:async()=>({url:'authorized-own-url'}),library:async scope=>{calls.push(`library:${scope}`);return {sessions:member?[{id,results:{}}]:[]};},
      api:{identity:identityFor('wp:1',authorized),session:async value=>{calls.push(`session:${value}`);return readDetail?readDetail():detail;}}},
    adminLibrary:{overview:async()=>{calls.push('admin:overview');return overview?overview():{students:member?[{subject:'wp:142',displayName:'Selected student',sessions:[{id,ownerSubject:'wp:142',resultsAvailable:true,recording:detail.recording}]}]:[]};},
      sessionForStudent:async args=>{calls.push(['admin:detail',args.subject,args.sessionId]);return readDetail?readDetail():detail;},
      playback:async value=>{calls.push(['admin:playback',value]);if(playback)await playback();return {url:'authorized-private-url'};}}};
  const noop=()=>{};
  const context={state,location,adminReviewViewGeneration:0,signalPreviewGeneration:0,signalPreview:null,
    vaultActionId:0,adminStudentLibraryRenderId:0,adminOverviewRenderId:0,compareRenderId:0,
    adminReviewGate:createAdminReviewGate(),isAdminReview,clearAdminReviewMedia,mayPresentSavedReview,playbackReviewRequest:0,el:()=>({}),
    parseSavedReviewRoute,resolveOwnSavedReview,resolveReviewDestination,savedReviewHash,
    parseAdminSavedReviewRoute:reviewScope.parseAdminSavedReviewRoute,resolveAdminSavedReview:reviewScope.resolveAdminSavedReview,
    $:node,$$:selector=>selector==='[data-view-panel]'?panels:[],
    wireChrome:noop,wireCockpit:noop,startAudioDebug:noop,
    collectionChips:noop,renderQuestions:noop,renderSet:noop,renderWizard:noop,renderLoadoutConfig:noop,
    renderPostAnswer:()=>calls.push('results'),renderHomeCorpus:noop,renderDeviceCheck:noop,refreshDevices:async()=>{},
    navigator:{},window:{addEventListener:noop,scrollTo:noop},document:{addEventListener:noop,body:{dataset:{}}},
    history:{replaceState:(_,__,hash)=>{location.hash=hash;}},
    loadIvPrepSession:async()=>({admitted:true,identity:{subject:'wp:1'},runtime:{mode:'hosted'}}),
    applyIdentity:noop,applyHomeModel:noop,refreshQuestionGovernance:async()=>{},hydrateHome:async()=>{},
    wireLiveInterview:noop,mountAnalytics:mount,presentFilmRoomAnalytics:value=>value,
    renderContextEvidence:value=>calls.push(['context',value]),contextResultFromSessionSpine:value=>value,
    renderInterviewRoom:noop,renderAdminReviewControl:noop,renderReviewScopeLabel:noop,renderVault:noop,
    renderFilmRoomSpine:noop,invalidateLongitudinalHistory:noop,renderAdminOverview:noop,advancedEntryRole:()=> 'student',permittedRoles:()=>new Set(authorized?['student','mentor','admin']:['student']),
    CRUMBS:{home:'Home',postanswer:'Results',filmroom:'Film Room',vault:'Recordings',mentor:'Admin'},
  };
  runInNewContext(`${viewCode};${roleCode};${playbackCode};${bootCode};this.boot=boot;this.setView=setView;this.applyRole=applyRole;`,context);
  const open=context.openLastSavedFilmRoom;
  context.openLastSavedFilmRoom=async(button,options)=>{calls.push(['filmroom',options.autoplay,options.expectedSaved.session.id]);return open(button,options);};
  return {state,calls,panels,node,location,context,boot:context.boot,navigate:context.setView};
}
test('saved-review boot shows a review loading state instead of Home while live Analytics mounts',async()=>{
  const pending=deferred(),h=fixture({mount:()=>pending.promise}),boot=h.boot();
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(h.node('#saved-review-loading').dataset.active,'true');
  assert.ok(h.panels.every(panel=>panel.dataset.active==='false'));
  assert.equal(h.node('#crumb').textContent,'Loading saved review');
  pending.resolve();await boot;
  assert.equal(h.state.lastSaved.session.id,id);assert.equal(h.state.view,'postanswer');
  assert.equal(h.node('#saved-review-loading').dataset.active,'false');
});
test('Admin cold restore denies Student, missing membership and mismatched detail without own fallback',async()=>{
  for(const options of [{authorized:false},{member:false},{readDetail:()=>({id,ownerSubject:'wp:1'})},
    {readDetail:()=>({id:'foreign',ownerSubject:'wp:142'})},{readDetail:()=>{throw new Error('revoked');}}]){
    const h=fixture({admin:true,...options});await h.boot();
    assert.equal(h.state.lastSaved,null);assert.equal(h.state.adminCreditSubject??null,null);
    assert.ok(!h.calls.includes('library:own'));assert.equal(h.node('#saved-review-loading').dataset.active,'false');
    assert.equal(h.state.view,options.authorized===false?'vault':'mentor');
    if(options.authorized===false||options.member===false)assert.ok(!h.calls.some(call=>Array.isArray(call)&&call[0]==='admin:detail'));
  }
});
test('actual cold Admin boot cancels overview, detail or playback on navigation, role and account/runtime changes',async()=>{
  for(const stage of ['overview','detail','playback'])for(const change of [h=>h.navigate('vault'),
    h=>h.context.applyRole('student'),h=>{h.state.admission={...h.state.admission,identity:{subject:'wp:2'}};},
    h=>{h.state.durable={...h.state.durable};},h=>{h.state.durable.bootstrapPayload={identity:identityFor('wp:2')};},
    h=>{h.state.durable.api={...h.state.durable.api};},h=>{h.state.durable.api.identity=identityFor('wp:2');},
    h=>{h.state.adminLibrary={...h.state.adminLibrary};}]){
    const pending=deferred(),entered=deferred(),h=fixture({admin:true,view:'filmroom'});
    const target=stage==='overview'?'overview':stage==='detail'?'sessionForStudent':'playback';
    const original=h.state.adminLibrary[target];
    h.state.adminLibrary[target]=async(...args)=>{entered.resolve();await pending.promise;return original(...args);};
    const boot=h.boot();await entered.promise;change(h);pending.resolve();await boot;
    assert.notEqual(h.state.view,'filmroom');assert.equal(h.node('#playback').src,undefined);
    assert.equal(h.node('#saved-review-loading').dataset.active,'false');
    if(stage!=='playback'||h.state.role==='student'||h.state.admission.identity.subject!=='wp:1'
      ||h.state.durable.bootstrapPayload.identity.subject!=='wp:1')assert.equal(h.state.lastSaved,null);
    assert.ok(!h.calls.includes('library:own'));
  }
});
test('Admin Results and paused Film cold reload restore exact fresh authorized owner without own fallback',async()=>{
  for(const view of ['postanswer','filmroom']){
    const h=fixture({admin:true,view});await h.boot();
    assert.equal(h.state.view,view);assert.equal(h.state.role,'admin');
    assert.equal(h.state.lastSaved?.session?.id,id);assert.equal(h.state.lastSaved?.reviewScope,'admin');
    assert.equal(h.state.adminCreditSubject?.subject,'wp:142');
    assert.ok(h.calls.includes('admin:overview'));assert.ok(!h.calls.includes('library:own'));
    assert.equal(h.location.hash,`#${view}?session=${id}&review=admin`);
    if(view==='filmroom')assert.ok(h.calls.some(call=>Array.isArray(call)&&call[0]==='filmroom'&&call[1]===false));
  }
});
test('a live Analytics mount failure cannot strand exact authorized Results or paused Film Room',async()=>{
  for(const view of ['postanswer','filmroom']){
    const h=fixture({view,mount:async()=>{throw new Error('module unavailable');}});
    await h.boot();assert.equal(h.state.view,view);assert.equal(h.state.lastSaved.session.id,id);
    assert.ok(h.calls.includes('library:own'));assert.ok(h.calls.includes(`session:${id}`));
    assert.equal(h.state.analytics,undefined);
    if(view==='filmroom')assert.ok(h.calls.some(call=>Array.isArray(call)&&call[0]==='filmroom'&&call[1]===false&&call[2]===id));
  }
});
test('leaving or selecting another role during pending boot prevents saved data from replacing the current surface',async()=>{
  for(const change of [h=>h.navigate('vault'),h=>h.context.applyRole('admin'),h=>{h.context.applyRole('admin');h.context.applyRole('student');}]){
    const pending=deferred(),h=fixture({mount:()=>pending.promise}),boot=h.boot();
    for(let i=0;i<10;i++)await Promise.resolve();
    change(h);pending.resolve();await boot;
    assert.equal(h.state.lastSaved,null);assert.ok(!h.calls.includes('library:own'));
    assert.equal(h.node('#saved-review-loading').dataset.active,'false');
    if(h.state.role==='admin')assert.equal(h.location.hash,'#home');
  }
});
test('mount failure never skips own-library membership or exact returned session identity',async()=>{
  for(const options of [{member:false},{readDetail:()=>({id:'foreign'})},{readDetail:()=>{throw new Error('expired');}}]){
    const h=fixture({...options,mount:async()=>{throw new Error('module unavailable');}});
    await h.boot();assert.equal(h.state.lastSaved,null);assert.equal(h.state.view,'vault');
    if(options.member===false)assert.ok(!h.calls.includes(`session:${id}`));
    assert.equal(h.node('#saved-review-loading').dataset.active,'false');
  }
});
