import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseSavedReviewRoute, resolveOwnSavedReview, resolveReviewDestination, savedReviewHash, isAdminReview} from '../../public/studio/review-scope.mjs';

const source=readFileSync(new URL('../../public/studio/studio.mjs',import.meta.url),'utf8');
const bootCode=source.slice(source.indexOf('async function boot()'),source.indexOf('\nvoid boot();'));
const viewCode=source.slice(source.indexOf('function setView('),source.indexOf('\nfunction renderAdminFacts('));
const roleCode=source.slice(source.indexOf('function applyRole('),source.indexOf('/* ------------------------------------------------------------------ router */'));
const id='4f708360-6a76-477d-a927-caca2989800d';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture({view='postanswer',mount=async()=>{},member=true,readDetail}={}){
  const calls=[],nodes=new Map(),panels=['home','postanswer','filmroom','vault'].map(view=>({dataset:{viewPanel:view,active:String(view==='home')}}));
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{dataset:{active:'false'},textContent:'',hidden:false,replaceChildren(){}});return nodes.get(selector);};
  const location={hash:`#${view}?session=${id}`,pathname:'/iv-prep-on-call/advanced/'};
  const detail={id,results:{payload:{analytics:{answerId:id}}}};
  const state={role:'student',view:'home',session:{state:'IDLE'},lastSaved:null,filmGroups:{ingestResult:()=>calls.push('analytics')},
    durable:{ready:true,bootstrap:async()=>{},library:async scope=>{calls.push(`library:${scope}`);return {sessions:member?[{id,results:{}}]:[]};},
      api:{session:async value=>{calls.push(`session:${value}`);return readDetail?readDetail():detail;}}}};
  const noop=()=>{};
  const context={state,location,adminReviewViewGeneration:0,signalPreviewGeneration:0,signalPreview:null,
    vaultActionId:0,adminStudentLibraryRenderId:0,adminOverviewRenderId:0,compareRenderId:0,
    adminReviewGate:{invalidate:noop},isAdminReview,clearAdminReviewMedia:noop,
    parseSavedReviewRoute,resolveOwnSavedReview,resolveReviewDestination,savedReviewHash,
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
    renderFilmRoomSpine:noop,invalidateLongitudinalHistory:noop,advancedEntryRole:()=> 'student',permittedRoles:()=>new Set(['student','mentor','admin']),
    openLastSavedFilmRoom:async(_,options)=>{calls.push(['filmroom',options.autoplay,options.expectedSaved.session.id]);context.setView('filmroom');},
    CRUMBS:{home:'Home',postanswer:'Results',filmroom:'Film Room',vault:'Recordings'},
  };
  runInNewContext(`${viewCode};${roleCode};${bootCode};this.boot=boot;this.setView=setView;this.applyRole=applyRole;`,context);
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
