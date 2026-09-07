import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");
const adapter=await readFile(
  new URL("js/407f-engineering-adapter.js",webRoot),
  "utf8"
);
const server=await readFile(new URL("../scripts/serve.mjs",import.meta.url),"utf8");
const runner=await readFile(
  new URL("tests/run_d1_405_m12_hardening.mjs",webRoot),
  "utf8"
);

test("M12 self-hosts the exact 407F fonts and performs no third-party font request",()=>{
  assert.doesNotMatch(index,/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(index,/archivo-latin-wght-normal\.woff2/);
  assert.match(index,/archivo-latin-800-italic\.woff2/);
  assert.match(index,/rajdhani-latin-400\.woff2/);
  assert.match(index,/rajdhani-latin-600\.woff2/);
  assert.match(index,/rajdhani-latin-700\.woff2/);
  assert.match(index,/<link rel="icon" href="data:,">/);
});

test("M12 local server supplies framing, CSP, permission, MIME, and referrer defenses",()=>{
  assert.match(server,/"content-security-policy"/);
  assert.match(server,/frame-ancestors 'none'/);
  assert.match(server,/"x-frame-options": "DENY"/);
  assert.match(server,/"permissions-policy"/);
  assert.match(server,/"x-content-type-options": "nosniff"/);
  assert.match(server,/"referrer-policy": "no-referrer"/);
});

test("M12 all active standard dialogs share focus trap, inert background, Escape, and restoration",()=>{
  assert.match(adapter,/const openStandardModal=/);
  assert.match(adapter,/standardModalTrap=installFocusTrap/);
  assert.match(adapter,/standardModalBackgroundInert\(true\)/);
  assert.match(adapter,/onEscape:\(\)=>closeStandardModal\(\)/);
  assert.match(adapter,/if\(restoreFocus\)standardModalOpener\?\.focus\?\.\(\)/);
  assert.match(adapter,/openStandardModal\([\s\S]*?\[data-advanced-dialog\]/);
  assert.match(adapter,/openStandardModal\(`<section class="export407FSuggestionDialog"/);
  assert.match(adapter,/openStandardModal\(`<section class="intake407FDialog"/);
});

test("M12 conceals prototype state until canonical hydration completes",()=>{
  assert.match(
    index,
    /<html lang="en">\s*<head>[\s\S]*?document\.documentElement\.classList\.add\('d1-hydrating'\)/
  );
  assert.match(index,/html\.d1-hydrating body>\*\{visibility:hidden\}/);
  assert.match(
    index,
    /<div id="d1HydrationGate" role="status" aria-live="polite">Getting your timeline ready…<\/div>/
  );
  const awaitedRestore=adapter.indexOf("initialGuardianRestore022=await restoreAuthenticatedGuardianOnBoot022");
  const reconcileSubscription=adapter.indexOf('document.addEventListener("d1:407f-rendered",reconcile)');
  const publicApi=adapter.indexOf("window.D1_407F_ENGINEERING=api;");
  const reveal=adapter.indexOf('document.documentElement.classList.remove("d1-hydrating")');
  assert.ok(awaitedRestore>0&&awaitedRestore<reconcileSubscription,
    "Authenticated Guardian restoration completes before render callbacks can save");
  assert.ok(reconcileSubscription<publicApi&&publicApi<reveal,
    "Canonical callbacks and the public API initialize while prototype content is hidden");
  assert.match(adapter,/Your Timeline needs a fresh connection\./);
  assert.match(adapter,/retry\.textContent="Retry"/);
  assert.match(adapter,/back\.textContent="Return to Matrix"/);
});

// Execute the production boot tail so readiness depends on successful rendering and
// the final baseline, without coupling the contract to adjacent source lines.
function runHydrationCompletion({renderFails=false}={}){
  const start=adapter.indexOf("  window.D1_407F_ENGINEERING=api;");
  const end=adapter.indexOf("\n  return api;\n}",start);
  assert.ok(start>0&&end>start,"The actual boot completion block must be found");
  const events=[];
  const context={
    window:{},api:{},productionRuntime:{},store:{document:{id:"controlled-document"},adapter:{kind:"controlled-adapter"}},
    init:{restored:true},matrixAppMode:{mode:"CONTROLLED"},booting:true,lastState:"stale-prototype",
    installFamilyRuntime022(){events.push("family-installed");return {};},
    bridge:{state:{title:"canonical"},renderAll(){events.push("render");if(renderFails)throw new Error("controlled render failure");this.state.rendered=true;}},
    stableState(state){assert.equal(state.rendered,true);events.push("baseline");return JSON.stringify(state);},
    document:{documentElement:{classList:{remove(name){
      assert.equal(name,"d1-hydrating");assert.equal(context.booting,false);
      assert.equal(context.lastState,JSON.stringify(context.bridge.state));events.push("revealed");
    }}},dispatchEvent(event){assert.equal(event.type,"d1:407f-engineering-ready");events.push("ready");}},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}
  };
  const run=()=>vm.runInNewContext(`(function(){${adapter.slice(start,end)}\nreturn api;})()`,context);
  return {run,context,events};
}

test("M12 hydration reveal follows successful final render and canonical baseline capture",()=>{
  const {run,context,events}=runHydrationCompletion();
  assert.equal(run(),context.api);
  assert.deepEqual(events,["family-installed","render","baseline","revealed","ready"]);
  assert.equal(context.window.D1_407F_ENGINEERING,context.api);
});

test("M12 a failed final render keeps prototype content hidden and emits no ready event",()=>{
  const {run,context,events}=runHydrationCompletion({renderFails:true});
  assert.throws(run,/controlled render failure/);
  assert.deepEqual(events,["family-installed","render"]);
  assert.equal(context.booting,true);
  assert.equal(context.lastState,"stale-prototype");
});

test("M12 re-arms exit persistence after a BFCache restore",()=>{
  assert.match(
    adapter,
    /window\.addEventListener\("pagehide",flushExitPersistence,\{capture:true\}\)/
  );
  assert.match(
    adapter,
    /window\.addEventListener\("pageshow",\(event\)=>\{\s*if\(event\.persisted\)exitPersistenceStarted=false/
  );
  assert.doesNotMatch(
    adapter,
    /window\.addEventListener\("pagehide",flushExitPersistence,\{\s*once:true/
  );
});

test("M12 reduced motion stops the animated background loop and coarse targets override 42px rules",()=>{
  assert.match(index,/const\[w,h\]=sizeC\(c\),t=rm\?0:/);
  assert.match(index,/if\(!rm\)requestAnimationFrame\(fr\)/);
  assert.match(css,/@media\(pointer:coarse\)\{[\s\S]*?min-height:44px!important/);
  assert.match(css,/@media\(pointer:coarse\)\{[\s\S]*?min-width:44px!important/);
});

test("M12 clean-browser gate rejects warnings, HTTP errors, unhandled promises, unsafe methods, and every external origin",()=>{
  assert.match(runner,/browserWarnings/);
  assert.match(runner,/unhandledRejections/);
  assert.match(runner,/httpErrors\.length===0/);
  assert.match(runner,/unsafeRequests\.length===0/);
  assert.doesNotMatch(runner,/fonts\.googleapis\.com|fonts\.gstatic\.com/);
});
