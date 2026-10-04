"""Reproducible, dependency-free single-file STAGING candidate build."""
from pathlib import Path
import argparse, base64, hashlib, json, mimetypes, re

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--production', action='store_true', help='Require a release-ready configuration; never authorizes deployment.')
args = parser.parse_args()
phase1 = json.loads((ROOT/'phase1.json').read_text())
if args.production:
    blockers = []
    if phase1['releaseState'] != 'production-approved': blockers.append('protected release acceptance has not been recorded')
    if not phase1['associates']['siteRegistrationComplete']: blockers.append('the production site is not registered with Amazon Associates')
    if not phase1['accountPersistenceReady']: blockers.append('account-backed personal tools have not passed isolation and persistence QA')
    if not phase1.get('commercialMediaComplete'): blockers.append('commercial product-image rights are incomplete')
    if blockers: parser.error('Production build blocked: '+'; '.join(blockers))
def uri(path):
    p = ROOT / path
    mime = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()

old = {'CREST':'crest.png','HERO_ONLINE':'hero-online.jpg','HERO_INPERSON':'hero-inperson.jpg',
       'TILE_CAMERA':'tile-camera.jpg','TILE_MIC':'tile-mic.jpg','TILE_LIGHT':'tile-light.jpg',
       'TILE_ACC':'tile-accessories.jpg','TILE_TRAVEL':'tile-travel.jpg','TILE_KIT':'tile-kit.jpg',
       'MOUNTAIN':'mountain-band.jpg','DRBRIAN':'dr-brian.jpg'}
source = (ROOT / 'src.html').read_text()
for key, value in old.items():
    source = source.replace('{{'+key+'}}', uri('img/'+value))
source = source.replace('<!-- EDITORIAL_CSS -->', '<style>'+(ROOT/'editorial.css').read_text()+'\n'+(ROOT/'completion.css').read_text()+'\n'+(ROOT/'phase1.css').read_text()+'</style>')
assets={p.name:uri(str(p.relative_to(ROOT))) for p in (ROOT/'img').glob('*.webp')}
source = source.replace('<!-- EDITORIAL_SCRIPTS -->', '<script>const ASSET = '+json.dumps(assets)+'; const RESEARCH = '+(ROOT/'catalog.json').read_text().replace('</','<\\/')+'; const FASHION = '+(ROOT/'fashion.json').read_text().replace('</','<\\/')+'; const PHASE1 = '+(ROOT/'phase1.json').read_text().replace('</','<\\/')+';\n'+(ROOT/'editorial.js').read_text()+'\n'+(ROOT/'completion.js').read_text()+'\n'+(ROOT/'phase1.js').read_text()+'</script>')
source = re.sub(r'(?<![A-Za-z0-9/])img/[A-Za-z0-9_.-]+\.(?:webp|jpg|png)', lambda m: uri(m[0]), source)
for key, value in old.items():
    source = source.replace('{{'+key+'}}', uri('img/'+value))
assert '{{' not in source and '<!-- EDITORIAL_' not in source
assert 'img/' not in source, 'Unbundled local asset'
out = ROOT/'dist/interview-ready.html'
out.parent.mkdir(exist_ok=True)
out.write_text(source)
manifest = {'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,
            'inputs':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'src.html', ROOT/'editorial.css', ROOT/'editorial.js', ROOT/'catalog.json', ROOT/'completion.css', ROOT/'completion.js', ROOT/'fashion.json', ROOT/'phase1.json', ROOT/'phase1.css', ROOT/'phase1.js']}}
(ROOT/'dist/build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
