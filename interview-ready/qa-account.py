"""Focused builder fixtures and real local-browser rendering; no live account/API access."""
from pathlib import Path
import hashlib, importlib.util, json, re, shutil, subprocess, sys, tempfile
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
NODE = shutil.which('node') or '/usr/local/bin/node'
PHP = shutil.which('php') or '/opt/homebrew/bin/php'
PLAYWRIGHT = Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
assert PLAYWRIGHT.exists(), 'Bundled Playwright required for local browser fixtures'
spec = importlib.util.spec_from_file_location('ir_build', ROOT/'build.py')
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
php = subprocess.run([PHP,str(ROOT/'integration/gateway.test.php')],check=True,capture_output=True,text=True)
php_result=json.loads(php.stdout)
with tempfile.TemporaryDirectory(prefix='ir-account-qa-') as location:
    tmp=Path(location)
    manifest=builder.build('production',tmp/'one')
    assert manifest['sha256']==builder.build('production',tmp/'two')['sha256'], 'Deterministic production media build'
    html=(tmp/'one/interview-ready.html').read_text()
    assert html.count('/* MMED_IR_ACCOUNT_CONTEXT */ null')==1
    assert "connect-src 'self'" in html and "connect-src *" not in html
    assert 'const store = IRAccount.store;' in html
    assert manifest['inputs']['account.js']==hashlib.sha256((ROOT/'account.js').read_bytes()).hexdigest()
    for script in re.findall(r'<script>(.*?)</script>',html,re.S):
        syntax=tmp/'syntax.js'; syntax.write_text(script)
        subprocess.run([NODE,'--check',str(syntax)],check=True,capture_output=True)
    guarded=subprocess.run([sys.executable,str(ROOT/'build.py'),'--production','--output-dir',str(tmp/'release')],capture_output=True,text=True)
    assert guarded.returncode and 'account-backed' in guarded.stderr and not (tmp/'release').exists()
    smoke=tmp/'browser.js'
    smoke.write_text('const {chromium}=require('+json.dumps(str(PLAYWRIGHT))+');\n'+r"""
const assert=require('assert'), fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8');
const origin='https://missionmedinstitute.com', app=origin+'/interview-ready/app/';
const key='online:webcam:bc:B09NBWWP79';
const uuid='11111111-1111-4111-8111-111111111111';
const initial=()=>({revision:1,lastCommandId:uuid,lastCommandDigest:'1'.repeat(64),done:{'online:0:1':true},auto:{cam:false,mic:false,env:false},kit:[key],mode:'online'});
(async()=>{
 const browser=await chromium.launch({headless:true});
 let count=0;
 try {
  let subject='account-a', state=initial(), commands=[], failAfterWrite=false, conflictOnce=false, holdGet=true, initialFail=false;
  let releaseGet; const gate=new Promise(resolve=>{releaseGet=resolve});
  const context=await browser.newContext();
  const errors=[];
  await context.addInitScript(()=>{
   localStorage.setItem('ir:done',JSON.stringify({'online:0:2':true}));
   localStorage.setItem('ir:kit',JSON.stringify([{key:'anonymous-secret',name:'OTHER ACCOUNT'}]));
   localStorage.setItem('ir:auto',JSON.stringify({cam:true}));
  });
  await context.route('**/*',async route=>{
   const request=route.request(), u=new URL(request.url());
   if (u.origin!==origin) { await route.abort(); return; }
   if (u.pathname==='/wp-json/missionmed-ir/v1/state') {
    const headers=await request.allHeaders();
    assert.equal(headers['x-wp-nonce'],'fixture-nonce');
    assert.equal(new URL(headers.referer).origin,origin); // Interception precedes Fetch Metadata headers.
    if(headers['x-ir-subject']!==subject) { await route.fulfill({status:401,body:'{}'}); return; }
    if(request.method()==='GET') {
     if(holdGet) await gate;
     if(initialFail) { await route.abort(); return; }
     await route.fulfill({contentType:'application/json',body:JSON.stringify({subject,state})}); return;
    }
    const c=JSON.parse(request.postData()); commands.push(c);
    assert(!JSON.stringify(c).includes('anonymous-secret') && !JSON.stringify(c).includes('OTHER ACCOUNT'));
    assert.deepEqual(Object.keys(c).sort(),['commandId','expectedRevision','state']);
    assert.deepEqual(Object.keys(c.state.auto).sort(),['cam','env','mic']);
    if(conflictOnce) {
     conflictOnce=false;state={...state,revision:state.revision+1,done:{...state.done,'online:0:4':true}};
     await route.fulfill({status:409,body:'{}'});return;
    }
    if(c.commandId!==state.lastCommandId) {
     assert.equal(c.expectedRevision,state.revision);
     state={...c.state,revision:state.revision+1,lastCommandId:c.commandId,lastCommandDigest:'2'.repeat(64)};
    }
    if(failAfterWrite) { failAfterWrite=false;await route.abort();return; }
    await route.fulfill({contentType:'application/json',body:JSON.stringify({subject,state})});return;
   }
   const privateRoute=u.pathname==='/interview-ready/app/';
   const body=html.replace('/* MMED_IR_ACCOUNT_CONTEXT */ null', privateRoute?JSON.stringify({subject,nonce:'fixture-nonce',endpoint:origin+'/wp-json/missionmed-ir/v1/state'}):'null');
   await route.fulfill({contentType:'text/html',body});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app+'#checklist');
  await page.waitForFunction(()=>document.body.dataset.irAccountState==='loading');
  assert.equal(await page.locator('#page-checklist').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  assert.equal(await page.evaluate(()=>IRAccount.store.get('kit',[]).length),0);count++;
  holdGet=false;releaseGet();await page.waitForFunction(()=>document.body.dataset.irAccountState==='saved');
  assert(await page.locator('#c-online-0-1').isChecked());assert(!(await page.locator('#c-online-0-2').isChecked()));
  assert.equal(await page.evaluate(()=>localStorage.getItem('ir:kit')),null);count++;
  await page.locator('#c-online-0-2').check();await page.waitForFunction(()=>document.body.dataset.irAccountState==='saved');
  assert(state.done['online:0:2'] && state.done['online:0:1']);assert.equal(state.revision,2);count++;
  failAfterWrite=true;await page.locator('#c-online-0-3').check();await page.waitForFunction(()=>document.body.dataset.irAccountState==='error');
  assert(await page.getByText('Changes are unsaved.',{exact:false}).isVisible());const failed=commands.at(-1), revision=state.revision;
  await page.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.irAccountState==='saved');
  assert.equal(commands.at(-1).commandId,failed.commandId);assert.equal(state.revision,revision);count++;
  conflictOnce=true;await page.locator('#c-online-0-5').check();await page.waitForFunction(()=>document.body.dataset.irAccountState==='conflict');
  assert(await page.locator('#c-online-0-4').isChecked());assert(!(await page.locator('#c-online-0-5').isChecked()));
  await page.getByRole('button',{name:'Reapply my unsaved edits'}).click();await page.waitForFunction(()=>document.body.dataset.irAccountState==='saved');
  assert(state.done['online:0:4'] && state.done['online:0:5']);count++;
  await page.evaluate(()=>{location.hash='#online/webcam'});await page.waitForSelector('.tier-deck .tier');
  assert.equal(await page.locator('.tier-deck .tier').count(),3);
  failAfterWrite=true;await page.locator('.tier-deck [data-kit]').nth(1).click();await page.waitForFunction(()=>document.body.dataset.irAccountState==='error');
  assert.equal(await page.locator('.tier-deck [data-kit]').nth(1).textContent(),'In kit · unsaved');count++;
  await page.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.irAccountState==='saved');
  await page.evaluate(()=>{location.hash='#test'});await page.waitForSelector('#page-test.active');
  assert(await page.locator('#camStart').count() || await page.locator('#startCam').count() || await page.locator('#video').count());
  await page.locator('#motionToggle').click();assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');count++;
  await page.evaluate(()=>{location.hash='#checklist';window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
  assert.equal(await page.evaluate(()=>IRAccount.store.get('kit',[]).length),0);
  assert.equal(await page.locator('#page-checklist').evaluate(el=>getComputedStyle(el).visibility),'hidden');count++;
  subject='account-b';await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForFunction(()=>document.body.dataset.irAccountState==='login');
  assert.equal(await page.evaluate(()=>Object.keys(IRAccount.store.get('done',{})).length),0);count++;
  assert.equal(errors.length,0,errors.join('; '));
  // New page bootstrap binds B, while failed hydration never reveals B's state.
  state=initial();initialFail=true;
  const fresh=await context.newPage();fresh.on('pageerror',e=>errors.push(e.message));await fresh.goto(app+'#kit');
  await fresh.waitForFunction(()=>document.body.dataset.irAccountState==='error');
  assert.equal(await fresh.locator('#page-kit').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  initialFail=false;await fresh.getByRole('button',{name:'Retry',exact:true}).click();await fresh.waitForFunction(()=>document.body.dataset.irAccountState==='saved');count++;
  const before=commands.length;
  const publicPage=await context.newPage();publicPage.on('pageerror',e=>errors.push(e.message));
  await publicPage.goto(origin+'/interview-ready/#online/webcam');
  assert.equal(await publicPage.evaluate(()=>IRAccount.store.get('kit',[]).length),0);
  await publicPage.locator('.tier-deck [data-kit]').first().click();
  await publicPage.waitForURL('**/interview-ready/app/**');
  assert.equal(commands.length,before);count++;
  // Mobile and reduced-motion reuse the same existing three-tier renderer.
  await fresh.setViewportSize({width:390,height:844});await fresh.emulateMedia({reducedMotion:'reduce'});
  await fresh.evaluate(()=>{location.hash='#online/webcam'});await fresh.waitForSelector('.tier-deck .tier');
  assert.equal(await fresh.locator('.tier-deck .tier').count(),3);
  assert(await fresh.locator('.tier-deck').evaluate(el=>el.scrollWidth>el.clientWidth));count++;
  assert.equal(errors.length,0,errors.join('; '));
  console.log(JSON.stringify({result:'PASS',focusedBrowserScenarios:count,scope:'Local browser plus mock HTTP owner; no live WP or MySQL'}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
""")
    run=subprocess.run([NODE,str(smoke),str(tmp/'one/interview-ready.html')],capture_output=True,text=True)
    if run.returncode:
        print(run.stderr,file=sys.stderr); raise SystemExit(run.returncode)
    browser_result=json.loads(run.stdout)
    print(json.dumps({'result':'PASS','php':php_result,'browser':browser_result,
        'productionMediaCandidateSha256':manifest['sha256'],'bytes':manifest['bytes'],
        'releaseGuard':'BLOCKED as required','scope':'Builder evidence only; independent and live release acceptance outstanding'},indent=2))
