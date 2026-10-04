"""Reproducible single-file candidate; media selection never authorizes release."""
from pathlib import Path
import argparse, base64, hashlib, json, mimetypes, re

ROOT = Path(__file__).resolve().parent


def build(asset_profile='preview', output_dir=None, production=False):
    inputs = ['src.html','editorial.css','editorial.js','catalog.json','completion.css','completion.js','fashion.json','phase1.json','phase1.css','phase1.js','production-assets.json','account.js','integration/missionmed-interview-ready.php','integration/matrix-entry.js','build.py']
    def fixed_bytes(name):
        path = ROOT/name
        if any(part.is_symlink() for part in [path, *path.parents]) or not path.is_file():
            raise ValueError('Non-regular or symlink build input: '+name)
        return path.read_bytes()
    input_data = {name:fixed_bytes(name) for name in inputs}
    before = {name:hashlib.sha256(value).hexdigest() for name,value in input_data.items()}
    phase1 = json.loads(input_data['phase1.json'])
    if production:
        blockers = []
        if phase1['releaseState'] != 'production-approved': blockers.append('protected release acceptance has not been recorded')
        if not phase1['associates']['siteRegistrationComplete']: blockers.append('the production site is not registered with Amazon Associates')
        if not phase1['accountPersistenceReady']: blockers.append('account-backed personal tools have not passed isolation and persistence QA')
        if not phase1.get('commercialMediaComplete'): blockers.append('commercial product-image rights are incomplete')
        if blockers: raise ValueError('Production build blocked: '+'; '.join(blockers))
        asset_profile = 'production'
    permitted = asset_profile == 'production'
    policy = json.loads(input_data['production-assets.json'])
    allowed = {entry['path']: entry for entry in policy['assets']}
    assert policy['defaultPolicy'] == 'deny'
    assert len(allowed) == len(policy['assets']), 'Duplicate media approval'
    for path, entry in allowed.items():
        assert path.startswith('img/') and Path(path).name == path[4:], 'Invalid media approval path'
        assert hashlib.sha256(fixed_bytes(path)).hexdigest() == entry['sha256'], 'Approved media changed: '+path

    def uri(path):
        if permitted and path not in allowed:
            raise ValueError('Unapproved production media reference: '+path)
        p = ROOT / path
        mime = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
        value = fixed_bytes(path)
        if permitted and hashlib.sha256(value).hexdigest()!=allowed[path]['sha256']:
            raise ValueError('Approved media changed during render: '+path)
        return f'data:{mime};base64,' + base64.b64encode(value).decode()

    old = {'CREST':'crest.png','HERO_ONLINE':'hero-online.jpg','HERO_INPERSON':'hero-inperson.jpg',
           'TILE_CAMERA':'tile-camera.jpg','TILE_MIC':'tile-mic.jpg','TILE_LIGHT':'tile-light.jpg',
           'TILE_ACC':'tile-accessories.jpg','TILE_TRAVEL':'tile-travel.jpg','TILE_KIT':'tile-kit.jpg',
           'MOUNTAIN':'mountain-band.jpg','DRBRIAN':'dr-brian.jpg'}
    source = input_data['src.html'].decode()
    if any(source.count(marker)!=1 for marker in ['<!-- EDITORIAL_CSS -->','<!-- EDITORIAL_SCRIPTS -->']):
        raise ValueError('Required editorial build marker missing or duplicated')
    matrix = input_data['integration/matrix-entry.js'].decode()
    if '</script' in matrix.lower() or 'data-mmed-ir-matrix-entry' not in matrix:
        raise ValueError('Matrix artifact marker or inline-script boundary changed')
    editorial = input_data['editorial.js'].decode()
    completion = input_data['completion.js'].decode()
    research = json.loads(input_data['catalog.json'])
    account_keys = [f"{group}:{category['id']}:{item['t']}:{item.get('asin') or 'plan'}"
                    for group, key in [('online', 'online'), ('in-person', 'inperson')]
                    for category in research[key] for item in category['items']]
    account = input_data['account.js'].decode()
    # Keep this inline comparison from becoming a false tag during host HTML processing.
    if account.count('s.revision<0') != 1:
        raise ValueError('Account comparison seam changed; review required')
    account = account.replace('s.revision<0', '0>s.revision')
    fashion = json.loads(input_data['fashion.json'])
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
    source = source.replace('<!-- EDITORIAL_CSS -->', '<style>'+input_data['editorial.css'].decode()+'\n'+input_data['completion.css'].decode()+'\n'+input_data['phase1.css'].decode()+'</style>')
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
    scripts = '<script>const ASSET = '+js(assets)+'; const RESEARCH = '+js(research)+'; const FASHION = '+js(fashion)+'; const PHASE1 = '+js(phase1)+';\n'+editorial+'\n'+completion+'\n'+input_data['phase1.js'].decode()+attach+'</script>'
    source = source.replace('<!-- EDITORIAL_SCRIPTS -->', scripts)
    for key, value in old.items():
        if '{{'+key+'}}' in source:
            source = source.replace('{{'+key+'}}', uri('img/'+value))
    source = re.sub(r'(?<![A-Za-z0-9/])img/[A-Za-z0-9_.-]+\.(?:webp|jpg|png)', lambda m: uri(m[0]), source)
    assert '{{' not in source and '<!-- EDITORIAL_' not in source
    assert 'img/' not in source, 'Unbundled local asset'
    gate = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Interview Ready account · MissionMed</title><style>
*{box-sizing:border-box}body{margin:0;background:#f8f4e9;color:#17283c;font:17px/1.65 Georgia,serif}.ir-gate{min-height:100svh;display:grid;grid-template-columns:1fr 1fr}.ir-gate-copy{padding:clamp(28px,7vw,100px);align-self:center}.ir-eyebrow{font:600 12px/1.5 system-ui;letter-spacing:.18em;text-transform:uppercase;color:#8b703c}h1{font-weight:400;line-height:1.12;font-size:clamp(38px,4.5vw,66px);margin:20px 0}p{max-width:38em}.ir-gate-photo{background:#17283c url(GATE_IMAGE) center/cover;min-height:320px}.ir-gate-cta{display:inline-block;padding:15px 22px;margin:16px 0;background:#17283c;color:#fffaf0;border:1px solid #b99a58;text-decoration:none;font:600 15px/1.4 system-ui}.ir-gate-guide{color:#17283c;text-underline-offset:4px}a:focus-visible{outline:3px solid #b99a58;outline-offset:5px}@media(max-width:720px){.ir-gate{grid-template-columns:1fr}.ir-gate-photo{grid-row:1;min-height:240px}.ir-gate-copy{padding:32px 26px}}
</style></head><body><main class="ir-gate"><div class="ir-gate-copy"><div class="ir-eyebrow">MissionMed · Interview Ready</div><h1>Your preparation.<br>Your own space.</h1><p>Keep your interview checklist and researched gear kit together, ready whenever you return.</p><p>Sign in or create a free MissionMed account to save across devices. No course enrollment is required.</p><a class="ir-gate-cta" href="{{MMED_IR_ACCOUNT_URL}}">Sign in or create your free account</a><p><a class="ir-gate-guide" href="{{MMED_IR_GUIDE_URL}}">Explore the public buying guide</a></p></div><div class="ir-gate-photo" role="img" aria-label="A calm, prepared interview setting"></div></main></body></html>""".replace('GATE_IMAGE', uri('img/hero-online-photo.webp'))
    fixed = {'matrix-entry.js': matrix, 'account-gate.html': gate}
    for name, marker in [('matrix-entry.js','MATRIX'),('account-gate.html','GATE')]:
        digest = hashlib.sha256(fixed[name].encode()).hexdigest()
        source = source.replace('</head>', '<!-- MMED_IR_'+marker+'_SHA256:'+digest+' -->\n</head>', 1)
    out_dir = Path(output_dir) if output_dir else ROOT/'dist'
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir/'interview-ready.html'
    out.write_text(source)
    for name, value in fixed.items(): (out_dir/name).write_text(value)
    if any(hashlib.sha256(fixed_bytes(name)).hexdigest()!=expected for name,expected in before.items()):
        raise ValueError('Build input drift during render')
    if permitted and any(hashlib.sha256(fixed_bytes(path)).hexdigest()!=allowed[path]['sha256'] for path in paths):
        raise ValueError('Approved media drift during render')
    manifest = {'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,
                'assetProfile':asset_profile, 'releaseApproved':production,
                'accountContextMarker':'/* MMED_IR_ACCOUNT_CONTEXT */ null',
                'gatewayStorageOwner':'WP self-only _mmed_ir_state_v1',
                'fixedArtifacts':{name:{'sha256':hashlib.sha256(value.encode()).hexdigest(),'bytes':len(value.encode())} for name,value in fixed.items()},
                'embeddedAssets':{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in paths},
                'inputs':before}
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
