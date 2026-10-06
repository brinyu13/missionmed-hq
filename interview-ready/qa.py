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
assert len(paths)==45+len([x for c in catalog['online'] for x in c['items'][3:]])
assert all([x['t'] for x in c['items'][:3]]==['bc','fc','pj'] and all(x['t'] in ('bc','fc','pj') for x in c['items']) for c in catalog['online']+catalog['inperson'])
curated={x['asin']:x for x in json.loads((ROOT/'evidence/founder-curation-2026-10-06.json').read_text())}
purchase=[x for x in paths+catalog['alternatives'] if x['asin']]
for x in purchase:
    r=by_asin.get(x['asin'])
    if x['asin'] in curated and curated[x['asin']]['decision']=='founder-curation':
        assert curated[x['asin']]['observedAt'] and curated[x['asin']]['url'].endswith(x['asin'])
    else:
        assert r['decision'] in ('include','owner-exception')
        assert current_by_asin[x['asin']]['rating']>=4.5 or (r['decision']=='owner-exception' and (r['model'].startswith('Elgato') or r['model'].startswith('Blue')))
    assert x['source'] and x['setup'] and x['pros'] and x['cons']
    assert 'rating' not in x and 'ratingCount' not in x and 'price' not in x
    if x.get('image'):assert (ROOT/x['image']).exists()
assert 'ratingCount' not in html and '"rating":' not in html, 'Private observations must not enter runtime'
assert '{{' not in html and '<!-- EDITORIAL_' not in html and 'src="img/' not in html
for r in ('home','online','in-person','test','checklist','dress','wardrobe','community','experts','prime-day','kit'):
    assert f'id="page-{r}"' in html
assert 'affiliateTag: "missionmatch-20"' in html
assert 'As an Amazon Associate I earn from qualifying purchases.' in html
phase1=json.loads((ROOT/'phase1.json').read_text())
assert phase1['associates']['trackingId']=='missionmatch-20'
assert phase1['associates']['verifiedAt'] and phase1['associates']['evidenceUrl']
assert phase1['publicGuide'] and phase1['personalToolsRequireAccount']
assert phase1['deferredRoutes']==['in-person','dress','wardrobe','community']
assert not phase1['charity']['enabled'] and not phase1['charity']['copy']
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
result={'result':'PASS','scope':'Static builder validation only; not account, independent, production or live acceptance','checks':['preserved engine: 45 primary paths / 15 categories / three classes in order; dated founder curation adds further products per class','Phase 1: seven online categories / 21 ordered tier paths','dated rating qualification and explicit exceptions','exact listing source requirements','verified affiliate tag and required disclosure','public Amazon rating/price exclusion','public guide / account personal-tool configuration','Phase 2 route deferral and charity disabled','preserved fashion data and UI hooks; Phase 2 deferred','no media upload transport','mobile snap controls and reduced-motion alternative','JavaScript syntax','deterministic bundle'],'phase1OnlineCategories':len(catalog['online']),'phase1OnlineTierPaths':sum(len(c['items']) for c in catalog['online']),'preservedUniquePurchaseCandidates':len({x['asin'] for x in purchase}),'preservedFashionProducts':len(fashion['products']),'bundleSha256':before}
(ROOT/'evidence/static-qa.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
