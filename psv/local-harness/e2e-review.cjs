// Synthetic-only candidate review acceptance against the disposable WordPress harness.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8088';
let passed = 0;
function ok(name, value) { assert.ok(value, name); console.log('PASS ' + name); passed++; }
(async () => {
 const browser = await chromium.launch({channel:'chrome'});
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 const page = await context.newPage(); const errors=[]; const writes=[];
 page.on('pageerror', e=>errors.push(e.message));
 page.on('request', r=>{if(r.method()!=='GET') writes.push(r.url());});
 await page.goto(base+'/wp-login.php'); await page.fill('#user_login','tester'); await page.fill('#user_pass','Tester-Local-1!');
 await Promise.all([page.waitForNavigation(),page.click('#wp-submit')]);
 await context.addCookies([{name:'mmhq_rise_session',value:'good-session',url:base}]);
 await page.goto(base+'/?mmed_ps_proto=1'); await page.click('button:has-text("Start a new ROOT")');
 await page.click('[data-source="SYNTHETIC"]'); await page.click('[data-act="create-root"]');
 await page.waitForSelector('[data-act="save-region"]'); await page.click('[data-act="save-region"]');
 await page.click('[data-act="cat"][data-key="fellowship"][data-on="1"]');
 await page.click('[data-act="term"][data-key="fellowship"][data-term="Cardiology"]');
 await page.click('[data-act="save-prefs"]'); await page.click('[data-act="toggle-program"][data-id="ps_deep_001"]');
 await page.click('button:has-text("Choose tiers")'); await page.click('[data-act="generate-all"]');
 await page.waitForSelector('[data-act="open-run"][data-id="ps_deep_001"]',{timeout:60000});
 await page.click('[data-act="open-run"][data-id="ps_deep_001"]');
 await page.waitForSelector('[data-act="edit-paragraph"]:not([disabled])');
 const runId=await page.locator('[data-review-run]').getAttribute('data-review-run');
 const protectedTexts=await page.locator('[data-protected-index]').allTextContents();
 const originals = await page.evaluate(()=>Array.from(document.querySelectorAll('[data-protected-index]')).map(n=>{n._proof=true;return n.textContent;}));
 const originalId=await page.locator('[data-review-select]').inputValue();
 await page.click('[data-act="jump"]');
 await page.screenshot({path:'/tmp/psv-review-after.png'});
 let writeBaseline=writes.length;
 const seen=new Set();
 for(let i=0;i<5;i++) {
  const before=await page.locator('.reviewRegion').boundingBox();
  seen.add(await page.locator('[data-review-select]').inputValue());
  await page.locator('[data-act="candidate-next"]').first().click();
  const after=await page.locator('.reviewRegion').boundingBox();
  ok('candidate '+i+' anchor <=2px',Math.abs(before.y-after.y)<=2);
 }
 ok('all five candidates and wrap',seen.size===5 && await page.locator('[data-review-select]').inputValue()===originalId);
 ok('switching performs no write',writes.length===writeBaseline);
 ok('protected nodes stay mounted',await page.evaluate(()=>Array.from(document.querySelectorAll('[data-protected-index]')).every(n=>n._proof)));
 assert.deepEqual(await page.locator('[data-protected-index]').allTextContents(),originals);
 const rail=page.locator('.reviewChoices .candidateChoice'); await rail.nth(1).click();
 ok('rail shares inline selection',await rail.nth(1).getAttribute('aria-checked')==='true' && (await page.locator('[data-review-ordinal]').textContent()).startsWith('2'));
 await rail.nth(1).press('End'); ok('radio End key',await rail.nth(4).getAttribute('aria-checked')==='true');
 await page.locator('.reviewActions [data-act="compare-all"]').click();
 ok('compare shows five complete texts',await page.locator('.compareProse').count()===5 && (await page.locator('.compareProse').first().textContent()).length>100);
 const selected=await page.locator('[data-review-select]').inputValue(); await page.keyboard.press('Escape');
 ok('Compare Escape preserves selection',await page.locator('[data-review-select]').inputValue()===selected);
 await page.locator('.reviewActions [data-act="compare-all"]').click(); await page.locator('[data-act="compare-read"]').nth(2).click();
 ok('Compare Read in statement selects exact third',(await page.locator('[data-review-ordinal]').textContent()).startsWith('3'));
 await page.click('[data-act="edit-paragraph"]');
 const aiText=await page.locator('[data-review-editor]').inputValue(); const edited=aiText+' I value careful listening.';
 await page.fill('[data-review-editor]',edited);
 ok('only authorized paragraph editable',await page.locator('.paper textarea').count()===1 && await page.locator('[contenteditable=true]').count()===0);
 ok('dirty edits remove annotations and disable approval',await page.locator('.reviewText .seg-fact').count()===0 && await page.locator('[data-status="APPROVED"]').isDisabled());
 await page.locator('[data-act="candidate-next"]').first().click(); await page.locator('[data-act="candidate-prev"]').first().click();
 ok('switch away/back retains draft',await page.locator('[data-review-editor]').inputValue()===edited);
 await page.route('**/runs/*/edits',route=>route.request().method()==='POST'?route.abort():route.continue(),{times:1});
 await page.click('[data-act="save-edits"]'); await page.waitForSelector('text=Couldn’t save edits. Your changes are still here.');
 ok('failed save retains text',await page.locator('[data-review-editor]').inputValue()===edited);
 await page.click('[data-act="save-edits"]'); await page.waitForSelector('text=Edits saved · Not approved.');
 ok('acknowledged edit remains unapproved',await page.locator('[data-status="APPROVED"]').isDisabled());
 const api=async(method,path,body)=>page.evaluate(async({method,path,body})=>{const c=JSON.parse(document.getElementById('mmps-config').textContent);const r=await fetch(c.restUrl.replace(/\/$/,'')+path,{method,headers:{'X-WP-Nonce':c.nonce,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};},{method,path,body});
 const revisions=await api('GET','/runs/'+runId+'/edits'); const heads=revisions.body.heads; const editedHead=Object.values(heads).find(h=>h && h.action==='SAVE');
 ok('actual DB saved private revision',!!editedHead && editedHead.text===edited && !editedHead.validation.canApprove && editedHead.validation.segments.length===0);
 const conflict=await api('POST','/runs/'+runId+'/edits',{candidateId:editedHead.candidateId,text:edited,action:'SAVE',baseRevisionId:'',requestId:crypto.randomUUID()});
 ok('actual DB stale parent denied',conflict.status===409);
 const blocked=await api('POST','/library',{runId,candidateId:editedHead.candidateId,editRevisionId:editedHead.id,status:'APPROVED'});
 ok('changed unverified revision cannot approve',blocked.status===409);
 await page.click('[data-act="restore-ai"]'); await page.click('[data-act="confirm-restore"]'); await page.waitForSelector('text=AI version active.');
 ok('restore returns immutable text',await page.locator('.reviewProse').textContent()===aiText);
 await page.click('[data-act="edit-paragraph"]'); await page.fill('[data-review-editor]',edited); await page.click('[data-act="go"][data-view="home"]');
 await page.waitForSelector('text=Keep your paragraph edits?'); await page.click('[data-act="leave-keep"]');
 ok('leave guard keeps draft',await page.locator('[data-review-editor]').inputValue()===edited);
 await page.click('[data-act="discard-edits"]');
 for(const width of [1440,1024,820,390,320]) {
  await page.setViewportSize({width,height:1000}); await page.click('[data-act="jump"]');
  const b=await page.locator('.reviewRegion').boundingBox(); await page.locator('[data-act="candidate-next"]').first().click(); const a=await page.locator('.reviewRegion').boundingBox();
  ok(width+'px anchor stable',Math.abs(a.y-b.y)<=2);
  const overflow=await page.evaluate(()=>({ok:document.documentElement.scrollWidth<=innerWidth+1,items:Array.from(document.querySelectorAll('body *')).filter(n=>n.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(n).visibility!=='hidden').map(n=>[n.tagName,n.className,Math.round(n.getBoundingClientRect().right)]).slice(0,15)}));
  if(!overflow.ok) console.log(JSON.stringify(overflow.items));
  ok(width+'px no horizontal overflow',overflow.ok);
  await page.locator('.reviewActions [data-act="compare-all"]').click();
  ok(width+'px modal Close visible',await page.locator('[data-act="close-review-dialog"]').isVisible()); await page.keyboard.press('Escape');
 }
 // A 1440px display at browser 200% has a 720 CSS-pixel layout viewport.
 // Do not substitute CSS zoom (which deliberately leaves media queries unchanged).
 await page.emulateMedia({reducedMotion:'reduce'}); await page.setViewportSize({width:720,height:500}); await page.click('[data-act="jump"]');
 ok('200%-equivalent 720 CSS-pixel layout has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(await page.locator('[data-protected-index]').allTextContents(),protectedTexts);
 ok('protected ROOT unchanged after edits/restore/all widths',true); ok('no JavaScript exceptions',errors.length===0);
 console.log('REVIEW_ACCEPTANCE_PASS '+passed); await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
