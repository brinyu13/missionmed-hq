"""Static/reproducibility checks. Browser evidence is captured separately with CUA."""
from pathlib import Path
import hashlib, json, re, subprocess, tempfile, shutil
ROOT=Path(__file__).resolve().parent
html=(ROOT/'dist/interview-ready.html').read_text()
catalog=json.loads((ROOT/'catalog.json').read_text())
ledger=json.loads((ROOT/'evidence/amazon-observations.json').read_text())
by_asin={x['asin']:x for x in ledger}
paths=[x for c in catalog['online']+catalog['inperson'] for x in c['items']]
assert len(paths)==60
assert all({x['t'] for x in c['items']}=={'pe','bc','fc','pj'} for c in catalog['online']+catalog['inperson'])
purchase=[x for x in paths+catalog['alternatives'] if x['asin']]
for x in purchase:
    r=by_asin[x['asin']]
    assert r['decision'] in ('include','owner-exception')
    assert r['rating']>=4.5 or (r['decision']=='owner-exception' and (r['model'].startswith('Elgato') or r['model'].startswith('Blue')))
    assert x['source'] and x['setup'] and x['pros'] and x['cons']
    assert 'rating' not in x and 'ratingCount' not in x and 'price' not in x
    if x.get('image'):assert (ROOT/x['image']).exists()
assert 'ratingCount' not in html and '"rating":' not in html, 'Private observations must not enter runtime'
assert '{{' not in html and '<!-- EDITORIAL_' not in html and 'src="img/' not in html
for r in ('home','online','in-person','test','checklist','dress','wardrobe','community','experts','prime-day','kit'):
    assert f'id="page-{r}"' in html
assert 'affiliateTag: ""' in html or "affiliateTag: ''" in html
assert 'fetch(' not in html and 'XMLHttpRequest' not in html, 'No media upload transport'
assert 'FASHN' in html and 'Photorealistic virtual try-on is not available' in html
node=shutil.which('node') or '/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
for script in re.findall(r'<script>(.*?)</script>',html,flags=re.S):
    with tempfile.NamedTemporaryFile('w',suffix='.js') as f:
        f.write(script);f.flush();subprocess.run([node,'--check',f.name],check=True,capture_output=True)
before=hashlib.sha256((ROOT/'dist/interview-ready.html').read_bytes()).hexdigest()
subprocess.run(['python3',str(ROOT/'build.py')],check=True,capture_output=True)
assert before==hashlib.sha256((ROOT/'dist/interview-ready.html').read_bytes()).hexdigest(), 'Build must be deterministic'
result={'result':'PASS','checks':['60 paths / 15 categories / four tiers','rating qualification and explicit exceptions','exact listing source requirements','public rating/price exclusion','11 routes','no media upload transport','JavaScript syntax','deterministic bundle'],'uniquePurchaseCandidates':len({x['asin'] for x in purchase}),'bundleSha256':before}
(ROOT/'evidence/static-qa.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
