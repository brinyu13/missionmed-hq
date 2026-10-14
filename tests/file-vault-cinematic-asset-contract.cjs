'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const origin = 'http://127.0.0.1:8782';
const fixture = origin + '/tests/fixtures/file-vault-v2-harness.html?visual=1';
const assetPath = '/wp-content/plugins/missionmed-hub/assets/';
const mediaBase = origin + assetPath + 'file-vault-cinematic/';
const out = path.resolve('_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_MEDIA_RESOLVER/renewal-DR-444');
const sourcePath = 'wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.js';
const source = fs.readFileSync(sourcePath, 'utf8');
const baseline = cp.execFileSync('git', ['show', '20fbdc38a48b92535214c79c738b0fbc141f8c16:' + sourcePath], {encoding:'utf8'});
const html = fs.readFileSync('tests/fixtures/file-vault-v2-harness.html', 'utf8');
const originalTag = '<script src="../../wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.js"></script>';
const checks = [];
const results = [];
function check(condition, label) { assert(condition, label); checks.push(label); }
function fence() {
  const status = JSON.parse(fs.readFileSync('/tmp/filevault-media-dr444-status.json', 'utf8'));
  assert(status.state === 'healthy' && Date.now()/1000-status.at_unix >= 0 && Date.now()/1000-status.at_unix < 15, 'Healthy evidence fence required');
  assert(status.mission === 'J1-FILEVAULT-1022-PIXEL-FIDELITY');
  assert.deepEqual(status.scopes.map(x => x.epoch), [5965,5966,5967,5968,5969,5970]);
}
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  async function load(name, options={}) {
    const width = options.width || 1280;
    const page = await browser.newPage({viewport:{width,height:844}, reducedMotion:'reduce'});
    const errors = []; const mediaResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/file-vault-cinematic/')) mediaResponses.push({url:response.url(),status:response.status(),mime:response.headers()['content-type']}); });
    const scriptPath = options.direct ? assetPath + (options.immutable ? 'student-os-file-vault-v2.0123456789abcdef.js' : 'student-os-file-vault-v2.js') : '/wp-content/cache/autoptimize/js/autoptimize-fv-media-contract.js';
    const body = options.baseline ? baseline : source;
    let documentHtml = html;
    let setup = '';
    if (options.noConfig) setup += 'delete window.mmedFileVaultV2Config.cinematicAssetsUrl;';
    if (options.invalid) setup += 'window.mmedFileVaultV2Config.cinematicAssetsUrl="javascript:alert(1)";';
    if (options.noSlash) setup += 'window.mmedFileVaultV2Config.cinematicAssetsUrl=' + JSON.stringify(mediaBase.slice(0,-1)) + ';';
    if (options.nullScript) setup += 'Object.defineProperty(document,"currentScript",{configurable:true,get:()=>null});';
    if (options.override) {
      setup += 'window.mmedFileVaultV2Config.cinematicAssetsUrl="https://wrong.fixture.invalid/";';
      documentHtml = documentHtml.replace('config: window.mmedFileVaultV2Config', 'config: Object.assign({},window.mmedFileVaultV2Config,{cinematicAssetsUrl:' + JSON.stringify(mediaBase) + '})');
    }
    if (options.deferred) {
      assert(!body.toLowerCase().includes('</script'));
      documentHtml = documentHtml.replace(originalTag + '\n\t<script>', '<script>' + setup + '\nsetTimeout(function(){\n' + body + '\n');
      documentHtml = documentHtml.replace('\n\t</script>\n</body>', '\n},0);\n\t</script>\n</body>');
    } else {
      documentHtml = documentHtml.replace(originalTag, '<script>' + setup + '</script><script src="' + scriptPath + '"></script>');
      await page.route(origin + scriptPath, route => route.fulfill({contentType:'application/javascript',body}));
    }
    await page.route('**/tests/fixtures/file-vault-v2-harness.html?*', route => route.fulfill({contentType:'text/html',body:documentHtml}));
    await page.goto(fixture);
    await page.waitForSelector('html[data-harness-ready]', {timeout:10000});
    if (options.reject) {
      const result = await page.evaluate(() => ({ready:document.documentElement.dataset.harnessReady,errors:__FV2_HARNESS__.errors}));
      check(result.ready === 'error' && result.errors.includes('File Vault image configuration is unavailable.'), name + ': clear rejected mount');
      check(errors.length === 0, name + ': Promise rejection handled without uncaught exception');
      check(await page.locator('img[src*="/wp-content/cache/autoptimize/js/file-vault-cinematic/"]').count() === 0, name + ': never requests optimizer-relative media');
      results.push({name,result}); await page.close(); return;
    }
    check(await page.getAttribute('html','data-harness-ready') === 'true', name + ': mounted');
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.querySelectorAll('.fv2-mobile-brand,.fv2-rail-brand img,.fv2-category-card img')];
      images.forEach(image => image.loading='eager');
      await Promise.all(images.map(image => image.decode().catch(()=>{})));
      const backgrounds = new Set();
      for (const element of document.querySelectorAll('.fv2-atmosphere,.fv2-rail')) {
        for (const pseudo of [null,'::before','::after']) {
          for (const match of getComputedStyle(element,pseudo).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) backgrounds.add(match[1]);
        }
      }
      await Promise.all([...backgrounds].map(async url => { const image=new Image();image.src=url;await image.decode(); }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const images = await page.locator('.fv2-mobile-brand,.fv2-rail-brand img,.fv2-category-card img').evaluateAll(nodes => nodes.map(image => ({url:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight,visible:!!image.getClientRects().length})));
    check(images.length === 10 && await page.locator('.fv2-category-card').count() === 8, name + ': two responsive logos and all eight category images');
    check(images.every(image => image.url.startsWith(mediaBase) && image.width>0 && image.height>0), name + ': canonical URLs and successful image decode');
    check(mediaResponses.filter(r => images.some(i => i.url===r.url)).every(r => r.status===200 && /^image\//.test(r.mime)), name + ': image HTTP200 and MIME');
    check(!mediaResponses.some(r => r.status>=400) && errors.length===0, name + ': no media errors or uncaught exceptions');
    check(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth), name + ': no horizontal overflow');
    check(await page.locator('.fv2-matrix-return').getAttribute('href')==='https://missionmedinstitute.com/member-dashboard/#dashboard', name + ': exact Return destination preserved');
    if (options.shot) {
      let previous, stable;
      for (let attempt=0;attempt<12;attempt++) {
        const current=await page.screenshot({animations:'disabled'});
        if (previous && previous.equals(current)) { stable=current;break; }
        previous=current;await new Promise(resolve=>setTimeout(resolve,100));
      }
      assert(stable,'Screenshot compositor must settle before comparison: '+name);
      fence();fs.writeFileSync(path.join(out,options.shot),stable);
    }
    results.push({name,images,mediaResponses}); await page.close();
  }
  try {
    for (const width of [1280,768,390]) {
      await load('approved direct baseline '+width,{width,direct:true,baseline:true,shot:'approved-baseline-'+width+'.png'});
      await load('optimized delivery '+width,{width,shot:'repaired-optimized-'+width+'.png'});
    }
    await load('direct mutable fallback',{direct:true,noConfig:true});
    await load('direct immutable fallback',{direct:true,immutable:true,noConfig:true});
    await load('null currentScript with explicit server config',{nullScript:true});
    await load('deferred execution with explicit server config',{deferred:true});
    await load('server directory without trailing slash',{noSlash:true});
    await load('per-instance override wins over global config',{override:true});
    await load('unsafe explicit config',{invalid:true,reject:true});
    await load('optimized script without server config',{noConfig:true,reject:true});
    await load('missing script and config',{nullScript:true,noConfig:true,reject:true});
    fence();fs.writeFileSync(path.join(out,'cinematic-tests.json'),JSON.stringify({result:'PASS',count:checks.length,checks,results},null,2)+'\n');
    console.log('PASS '+checks.length+' cinematic media contracts');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exit(1);});
