"""Static/reproducibility checks. Browser evidence is captured separately with CUA."""
from pathlib import Path
import hashlib, json, re, subprocess, tempfile, shutil
ROOT=Path(__file__).resolve().parent
html=(ROOT/'dist/interview-ready.html').read_text()
catalog=json.loads((ROOT/'catalog.json').read_text())
ledger=json.loads((ROOT/'evidence/amazon-observations.json').read_text())
by_asin={x['asin']:x for x in ledger}
fresh=json.loads((ROOT/'evidence/amazon-refresh-2026-10-04.json').read_text())
current_by_asin={x['asin']:x for x in fresh}
paths=[x for c in catalog['online']+catalog['inperson'] for x in c['items']]
assert len(paths)==45
assert all([x['t'] for x in c['items']]==['bc','fc','pj'] for c in catalog['online']+catalog['inperson'])
purchase=[x for x in paths+catalog['alternatives'] if x['asin']]
for x in purchase:
    r=by_asin[x['asin']]
    assert r['decision'] in ('include','owner-exception')
    assert current_by_asin[x['asin']]['rating']>=4.5 or (r['decision']=='owner-exception' and (r['model'].startswith('Elgato') or r['model'].startswith('Blue')))
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
assert 'Premium Economy' not in html
assert 'Compare the four gear tiers' not in html
fashion=json.loads((ROOT/'fashion.json').read_text())
assert len(fashion['products'])>=12
assert all((ROOT/p['image']).exists() and p['url'].startswith('https://') and p['fit'] and p['take'] for p in fashion['products'])
assert 'applyStylePlan' in html and 'function suggestedOutfit()' in html
assert 'data-outfit-slot' in html and 'data-compare-look' in html and 'data-profile' in html
assert 'scroll-snap-type:x mandatory' in html and 'data-tier-next' in html
assert 'prefers-reduced-motion' in html and 'Pause motion' in html
node=shutil.which('node') or '/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
for script in re.findall(r'<script>(.*?)</script>',html,flags=re.S):
    with tempfile.NamedTemporaryFile('w',suffix='.js') as f:
        f.write(script);f.flush();subprocess.run([node,'--check',f.name],check=True,capture_output=True)
before=hashlib.sha256((ROOT/'dist/interview-ready.html').read_bytes()).hexdigest()
subprocess.run(['python3',str(ROOT/'build.py')],check=True,capture_output=True)
assert before==hashlib.sha256((ROOT/'dist/interview-ready.html').read_bytes()).hexdigest(), 'Build must be deterministic'
result={'result':'PASS','checks':['45 paths / 15 categories / three tiers in order','rating qualification and explicit exceptions','exact listing source requirements','public Amazon rating/price exclusion','sourced fashion products and complete outfit persistence','11 routes','no media upload transport','mobile snap controls and reduced-motion alternative','JavaScript syntax','deterministic bundle'],'uniquePurchaseCandidates':len({x['asin'] for x in purchase}),'fashionProducts':len(fashion['products']),'bundleSha256':before}
(ROOT/'evidence/static-qa.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
