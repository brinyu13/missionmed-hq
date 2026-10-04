/* Local real-browser fixtures with observed sidebar markup; no live origin calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.IR_PLAYWRIGHT_MODULE || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const script = fs.readFileSync(path.join(__dirname, 'matrix-entry.js'), 'utf8');
const shell = '<section class="sos-nav-section"><div class="sos-nav-label">MATCH TOOLS</div><div class="sos-nav-list"><a class="sos-nav-item active" href="#rise" data-sibling="rise">RISE</a><a href="/interviewiq/" data-sibling="iiq">InterviewIQ</a></div></section>';
(async () => {
  const browser = await chromium.launch({headless:true});
  let checks = 0;
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.fulfill({contentType:'text/html', body:'<!doctype html><body>'+shell+'</body>'}));
    await page.goto('https://missionmedinstitute.com/member-dashboard/#rise');
    await page.evaluate(() => {window.MMED_OS={sentinel:'preserved'}; window.fixtureObserver = new MutationObserver(() => window.fixtureMutations=(window.fixtureMutations||0)+1);window.fixtureObserver.observe(document.body,{childList:true,subtree:true});window.fixtureClicks=0;document.querySelector('[data-sibling="rise"]').addEventListener('click',()=>window.fixtureClicks++);});
    const before = await page.locator('[data-sibling]').evaluateAll(nodes=>nodes.map(node=>node.outerHTML));
    await page.addScriptTag({content:script});
    await page.waitForSelector('.sos-nav-list > [data-mmed-ir-matrix-entry]');
    const link = page.locator('[data-mmed-ir-matrix-entry]');
    assert.equal(await link.count(),1);assert.equal(await link.getAttribute('href'),'/interview-ready/app/');assert.equal(await link.getAttribute('role'),null);checks++;
    await page.addScriptTag({content:script});await page.waitForTimeout(40);assert.equal(await link.count(),1);checks++;
    assert.deepEqual(await page.locator('[data-sibling]').evaluateAll(nodes=>nodes.map(node=>node.outerHTML)),before);
    assert.equal(await page.evaluate(()=>MMED_OS.sentinel),'preserved');assert.equal(new URL(page.url()).hash,'#rise');
    await page.locator('[data-sibling="rise"]').click();assert.equal(await page.evaluate(()=>fixtureClicks),1);checks++;
    await page.evaluate(markup=>document.querySelector('.sos-nav-section').outerHTML=markup,shell);
    await page.waitForSelector('.sos-nav-list > [data-mmed-ir-matrix-entry]');assert.equal(await link.count(),1);assert.deepEqual(await page.locator('[data-sibling]').evaluateAll(nodes=>nodes.map(node=>node.outerHTML)),before);checks++;
    await page.evaluate(()=>document.querySelector('.sos-nav-section').remove());
    await page.waitForSelector('#mmed-ir-matrix-fallback');assert.equal(await link.count(),1);assert.equal(await link.innerText(),'Interview Ready');checks++;
    await page.evaluate(markup=>document.body.insertAdjacentHTML('afterbegin',markup),shell);
    await page.waitForSelector('.sos-nav-list > [data-mmed-ir-matrix-entry]');assert.equal(await page.locator('#mmed-ir-matrix-fallback').count(),0);checks++;
    await page.evaluate(()=>{document.querySelector('[data-mmed-ir-matrix-entry]').remove();window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
    await page.waitForTimeout(60);assert.equal(await link.count(),0);
    await page.evaluate(()=>{document.querySelector('.sos-nav-list').appendChild(document.createElement('span'));});await page.waitForTimeout(40);assert.equal(await link.count(),0);checks++;
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await page.waitForSelector('.sos-nav-list > [data-mmed-ir-matrix-entry]');assert.equal(await link.count(),1);assert(await page.evaluate(()=>fixtureMutations>0));checks++;
    await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await link.focus();assert.equal(await link.evaluate(node=>node===document.activeElement),true);checks++;
    await link.click();assert.equal(new URL(page.url()).pathname,'/interview-ready/app/');checks++;
    const other = await browser.newPage();await other.route('**/*',route=>route.fulfill({contentType:'text/html',body:shell}));await other.goto('https://missionmedinstitute.com/unrelated/');await other.addScriptTag({content:script});await other.waitForTimeout(40);assert.equal(await other.locator('[data-mmed-ir-matrix-entry]').count(),0);checks++;
    assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',scenarios:checks,scope:'local intercepted markup; no live Matrix acceptance'}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
