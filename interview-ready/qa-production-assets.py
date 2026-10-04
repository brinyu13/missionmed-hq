"""Focused payload/rights guard verification; no tracked dist writes or release claim."""
from pathlib import Path
import argparse, base64, hashlib, importlib.util, json, re, shutil, subprocess, sys, tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--browser', action='store_true', help='Also smoke-test local rendering with the bundled Playwright browser.')
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('ir_build', ROOT/'build.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
policy = json.loads((ROOT/'production-assets.json').read_text())
allowed = {entry['path'] for entry in policy['assets']}
node = shutil.which('node')
assert node, 'Node is required for script syntax/asset resolver checks'
with tempfile.TemporaryDirectory(prefix='ir-assets-qa-') as tmp:
    tmp = Path(tmp)
    first = module.build('production', tmp/'safe')
    html = (tmp/'safe/interview-ready.html').read_text()
    assert first['sha256'] == module.build('production', tmp/'repeat')['sha256'], 'Nondeterministic safe build'
    def constant(name):
        return json.JSONDecoder().raw_decode(html.split('const '+name+' = ', 1)[1])[0]
    assets, research, fashion = [constant(name) for name in ('ASSET','RESEARCH','FASHION')]
    assert set(assets) == {Path(path).name for path in allowed}
    assert not research['inperson'] and not fashion['products'] and not fashion['outfits']
    assert 'cubes' not in research['reviews'] and not fashion['observedOn']
    denied = [p for p in (ROOT/'img').iterdir() if 'img/'+p.name not in allowed]
    for path in denied:
        assert base64.b64encode(path.read_bytes()).decode() not in html, 'Denied bytes embedded: '+path.name
        assert path.name not in html, 'Denied reference leaked: '+path.name
    for path in allowed:
        assert base64.b64encode((ROOT/path).read_bytes()).decode() in html, 'Approved image missing: '+path
    for category in research['online']:
        for item in category['items']:
            if item.get('image'):
                assert item['image'] in assets.values() and item.get('imageCredit'), 'Product photo lacks approval/credit'
    for path in json.loads((ROOT/'fashion.json').read_text())['products']:
        assert path['url'] not in html, 'Deferred retailer data leaked'
    for script in re.findall(r'<script>(.*?)</script>', html, re.S):
        check = tmp/'syntax.js'; check.write_text(script)
        subprocess.run([node,'--check',str(check)], check=True, capture_output=True)
    resolver = re.search(r'const assetFor=.*?;', html)[0]
    check.write_text('const ASSET='+json.dumps(assets)+';\n'+resolver+"\nconst assert=require('assert'); for(const [key,uri] of Object.entries(ASSET)){assert.equal(assetFor(key),uri);assert.equal(assetFor(uri),uri);} assert.equal(assetFor('img/product-brio.webp'),''); assert.equal(assetFor('https://example.invalid/uncleared.jpg'),'');")
    subprocess.run([node,str(check)], check=True, capture_output=True)
    preview = module.build(output_dir=tmp/'preview')
    assert preview['sha256'] == module.build(output_dir=tmp/'preview-repeat')['sha256'], 'Nondeterministic preview build'
    preview_html = (tmp/'preview/interview-ready.html').read_text()
    assert 'product-brio.webp' in preview_html and json.loads((ROOT/'fashion.json').read_text())['products'][0]['url'] in preview_html
    guard = subprocess.run(['python3',str(ROOT/'build.py'),'--production','--output-dir',str(tmp/'release')], capture_output=True,text=True)
    assert guard.returncode != 0 and 'Production build blocked:' in guard.stderr and not (tmp/'release').exists()
    assert 'protected release acceptance' in guard.stderr and 'account-backed' in guard.stderr
    if not json.loads((ROOT/'phase1.json').read_text())['associates']['siteRegistrationComplete']:
        assert 'not registered' in guard.stderr
    browser_result = None
    if args.browser:
        playwright = Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
        assert playwright.exists(), 'Bundled Playwright not available'
        smoke = tmp/'smoke.js'
        smoke.write_text('const {chromium}=require('+json.dumps(str(playwright))+');\n'+r'''
const assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext();
  await context.route('https://**',route=>route.abort());
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=process.argv[2];
  for(const initial of ['home','in-person','dress','wardrobe','community']){
   await page.goto(url+'#'+initial);await page.waitForTimeout(80);
   assert.equal(errors.length,0,errors.join('; '));
   assert(await page.locator('.page.active h1').count()>0);
  }
  for(const category of ['webcam','mic','accessories']){
   await page.goto(url+'#online/'+category);await page.waitForTimeout(80);
   assert.equal(await page.locator('.tier-deck .tier').count(),3);
   const photos=await page.locator('.tier-deck .product-visual img').evaluateAll(xs=>xs.map(x=>({ok:x.complete&&x.naturalWidth>0,src:x.src})));
   assert(photos.length>0,'Licensed product photo missing for '+category);
   assert(photos.every(p=>p.ok&&p.src.startsWith('data:image/webp;base64,')));
   assert(await page.locator('.tier-deck .product-wordmark').count()>0,'Information treatment missing');
  }
  for(const route of ['experts','prime-day','kit']){await page.goto(url+'#'+route);await page.waitForTimeout(80);}
  assert.equal(errors.length,0,errors.join('; '));
  await page.goto(process.argv[3]+'#online/webcam');await page.waitForTimeout(80);
  assert.equal(await page.locator('.tier-deck .tier').count(),3);
  assert.equal(errors.length,0,errors.join('; '));
  console.log(JSON.stringify({render:'PASS',routes:12,scope:'Local headless builder smoke only'}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
''')
        run = subprocess.run([node,str(smoke),(tmp/'safe/interview-ready.html').as_uri(),(tmp/'preview/interview-ready.html').as_uri()],check=True,capture_output=True,text=True)
        browser_result = json.loads(run.stdout)
    print(json.dumps({'result':'PASS','scope':'Local builder payload/render checks; not independent, account, site, production or live acceptance','permittedAssets':len(allowed),'deniedAssets':len(denied),'productionCandidateSha256':first['sha256'],'productionCandidateBytes':first['bytes'],'previewSha256':preview['sha256'],'releaseGuard':'BLOCKED as required','browser':browser_result},indent=2))
