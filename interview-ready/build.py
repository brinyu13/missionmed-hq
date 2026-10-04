"""Reproducible single-file candidate; media selection never authorizes release."""
from pathlib import Path
import argparse, base64, hashlib, json, mimetypes, re

ROOT = Path(__file__).resolve().parent


def build(asset_profile='preview', output_dir=None, production=False):
    phase1 = json.loads((ROOT/'phase1.json').read_text())
    if production:
        blockers = []
        if phase1['releaseState'] != 'production-approved': blockers.append('protected release acceptance has not been recorded')
        if not phase1['associates']['siteRegistrationComplete']: blockers.append('the production site is not registered with Amazon Associates')
        if not phase1['accountPersistenceReady']: blockers.append('account-backed personal tools have not passed isolation and persistence QA')
        if not phase1.get('commercialMediaComplete'): blockers.append('commercial product-image rights are incomplete')
        if blockers: raise ValueError('Production build blocked: '+'; '.join(blockers))
        asset_profile = 'production'
    permitted = asset_profile == 'production'
    policy = json.loads((ROOT/'production-assets.json').read_text())
    allowed = {entry['path']: entry for entry in policy['assets']}
    assert policy['defaultPolicy'] == 'deny'
    assert len(allowed) == len(policy['assets']), 'Duplicate media approval'
    for path, entry in allowed.items():
        assert path.startswith('img/') and Path(path).name == path[4:], 'Invalid media approval path'
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == entry['sha256'], 'Approved media changed: '+path

    def uri(path):
        if permitted and path not in allowed:
            raise ValueError('Unapproved production media reference: '+path)
        p = ROOT / path
        mime = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
        return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()

    old = {'CREST':'crest.png','HERO_ONLINE':'hero-online.jpg','HERO_INPERSON':'hero-inperson.jpg',
           'TILE_CAMERA':'tile-camera.jpg','TILE_MIC':'tile-mic.jpg','TILE_LIGHT':'tile-light.jpg',
           'TILE_ACC':'tile-accessories.jpg','TILE_TRAVEL':'tile-travel.jpg','TILE_KIT':'tile-kit.jpg',
           'MOUNTAIN':'mountain-band.jpg','DRBRIAN':'dr-brian.jpg'}
    source = (ROOT / 'src.html').read_text()
    editorial = (ROOT/'editorial.js').read_text()
    completion = (ROOT/'completion.js').read_text()
    research = json.loads((ROOT/'catalog.json').read_text())
    account_keys = [f"{group}:{category['id']}:{item['t']}:{item.get('asin') or 'plan'}"
                    for group, key in [('online', 'online'), ('in-person', 'inperson')]
                    for category in research[key] for item in category['items']]
    account = (ROOT/'account.js').read_text()
    fashion = json.loads((ROOT/'fashion.json').read_text())
    if permitted:
        # Deferred sources remain on disk, but no Phase 2 research enters the payload.
        research['inperson'] = []
        research['reviews'].pop('cubes', None)
        research['held'] = [i for i in research['held'] if not re.search('Samsonite|Travelpro', i['name'])]
        fashion = {'observedOn':None, 'products':[], 'outfits':[]}
        def sanitize(value):
            if isinstance(value, dict):
                if 'image' in value and value['image'] not in allowed:
                    value.pop('image'); value.pop('imageCredit', None)
                # Reviews remain linked; thumbnail reuse is not an approved media source.
                value.pop('video', None)
                for child in value.values(): sanitize(child)
            elif isinstance(value, list):
                for child in value: sanitize(child)
        sanitize(research)
        phase1['assetProfile'] = 'production'
        old['CREST'] = 'mountain-mark.webp'
        editorial = re.sub(r'<img src="img/product-facecam-mk2.webp"[^>]*>',
                          '<span class="product-wordmark">Elgato<small>Facecam MK.2 · researched selection</small></span>', editorial)
        editorial = re.sub(r'<img src="\{\{DRBRIAN\}\}"[^>]*>', '<span class="product-wordmark" aria-hidden="true">Dr. Brian</span>', editorial)
        completion = completion.replace("ASSET[(p||'').split('/').pop()]||p", "ASSET[(p||'').split('/').pop()]||(Object.values(ASSET).includes(p)?p:'')")
        completion = completion.replace('Product image for written review: ', 'Interview preparation scene accompanying review: ')
        # Phase 1 installs its deferred-route wrapper last. Avoid booting Phase 2
        # renderers against intentionally empty data on a direct initial deep link.
        early_route = "if (!PHASE1.deferredRoutes.includes((location.hash||'#home').slice(1).split('/')[0])) route();"
        editorial = editorial.replace('renderChecklist();renderKitCount();route();', 'renderChecklist();renderKitCount();'+early_route)
        completion = completion.replace('syncMotion();route();', 'syncMotion();'+early_route)
    source = source.replace('<!-- EDITORIAL_CSS -->', '<style>'+(ROOT/'editorial.css').read_text()+'\n'+(ROOT/'completion.css').read_text()+'\n'+(ROOT/'phase1.css').read_text()+'</style>')
    paths = sorted(allowed) if permitted else [str(p.relative_to(ROOT)) for p in sorted((ROOT/'img').glob('*.webp'))]
    assets = {Path(path).name:uri(path) for path in paths}
    def js(value): return json.dumps(value, ensure_ascii=False).replace('</','<\\/')
    # Install the account-owned store before any existing engine can read progress.
    store_pattern = r"const store = \{\n  get\(k,d\).*?\n\};"
    source, replaced = re.subn(store_pattern, 'const store = IRAccount.store;', source, count=1, flags=re.S)
    assert replaced == 1, 'Store seam changed; review required'
    assert account.count('/* MMED_IR_ACCOUNT_CONTEXT */ null') == 1
    account = account.replace('/* MMED_IR_KIT_KEYS */ []', js(account_keys))
    privacy_css = "html[data-ir-personal='blocked'] #page-checklist,html[data-ir-personal='blocked'] #page-kit,html[data-ir-personal='blocked'] #kitCountRail {visibility:hidden} html[data-ir-personal='blocked'] [data-kit],html[data-ir-personal='blocked'] [data-remove-kit] {visibility:hidden}"
    source = source.replace('</head>', '<style>'+privacy_css+'</style><script>document.documentElement.dataset.irPersonal=\"blocked\";\n'+account+'</script></head>')
    source = source.replace("connect-src 'none'", "connect-src 'self'")
    attach = "\nIRAccount.attach({catalog:CATALOG,checklist:CHECKLIST,mode:value=>{mode=value;},reset:()=>{mode='online';},render:()=>{renderChecklist();renderKitCount();renderKit();document.querySelectorAll('[data-kit]').forEach(b=>{const saved=kit.has(b.dataset.kit);b.textContent=saved?IRAccount.kitLabel():'Save to kit';b.setAttribute('aria-pressed',saved);});},route,wrapRoute:fn=>{route=fn;},runRoute:()=>route()});"
    scripts = '<script>const ASSET = '+js(assets)+'; const RESEARCH = '+js(research)+'; const FASHION = '+js(fashion)+'; const PHASE1 = '+js(phase1)+';\n'+editorial+'\n'+completion+'\n'+(ROOT/'phase1.js').read_text()+attach+'</script>'
    source = source.replace('<!-- EDITORIAL_SCRIPTS -->', scripts)
    for key, value in old.items():
        if '{{'+key+'}}' in source:
            source = source.replace('{{'+key+'}}', uri('img/'+value))
    source = re.sub(r'(?<![A-Za-z0-9/])img/[A-Za-z0-9_.-]+\.(?:webp|jpg|png)', lambda m: uri(m[0]), source)
    assert '{{' not in source and '<!-- EDITORIAL_' not in source
    assert 'img/' not in source, 'Unbundled local asset'
    out_dir = Path(output_dir) if output_dir else ROOT/'dist'
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir/'interview-ready.html'
    out.write_text(source)
    inputs = ['src.html','editorial.css','editorial.js','catalog.json','completion.css','completion.js','fashion.json','phase1.json','phase1.css','phase1.js','production-assets.json','account.js','integration/missionmed-interview-ready.php','build.py']
    manifest = {'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,
                'assetProfile':asset_profile, 'releaseApproved':production,
                'accountContextMarker':'/* MMED_IR_ACCOUNT_CONTEXT */ null',
                'gatewayStorageOwner':'WP self-only _mmed_ir_state_v1',
                'embeddedAssets':{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in paths},
                'inputs':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in inputs}}
    (out_dir/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--production', action='store_true', help='Require release approval and all existing account/site/media gates; never authorizes deployment.')
    parser.add_argument('--asset-profile', choices=['preview','production'], default='preview', help='Production selects only approved Phase 1 media/data; it is still a local candidate.')
    parser.add_argument('--output-dir', type=Path, help='Build outside tracked dist for focused verification.')
    args = parser.parse_args()
    try: result = build(args.asset_profile, args.output_dir, args.production)
    except ValueError as error: parser.error(str(error))
    print(json.dumps(result,indent=2))
