"""Build inert release assets. Does not approve a manifest or deploy."""
from pathlib import Path
import shutil,json,hashlib
R=Path(__file__).resolve().parent;P=R/'public';A=R/'release-candidate/proof-app/missionmed-proof-intelligence-assets'
A.mkdir(exist_ok=True);url='/wp-content/mu-plugins/missionmed-proof-intelligence-assets/'
for p in P.iterdir():
 if p.name in ('data','stories.json','integration.html','mr-integration.html'):continue
 if p.is_dir():
  videos={s['video'] for s in json.loads((R/'ingestion/archive.release.json').read_text())['stories'] if s.get('video')}
  (A/p.name).mkdir(exist_ok=True)
  for asset in p.iterdir():
   media_id=asset.stem if asset.suffix=='.mp4' else asset.stem.removeprefix('frame-').removesuffix('-aaa') if asset.name.startswith('frame-') else None
   target=A/p.name/asset.name
   if media_id is not None and media_id not in videos:
    if target.exists():
     assert target.read_bytes()==asset.read_bytes(), 'Unexpected generated asset drift'
     target.unlink() # Remove only this builder's redundant copy; source and donors are preserved.
    continue
   shutil.copy2(asset,target)
 else:shutil.copy2(p,A/p.name)
h=(P/'index.html').read_text()
for p in P.iterdir():
 if p.suffix in ('.css','.js'):h=h.replace('"'+p.name+'"','"'+url+p.name+'"')
h=h.replace('<meta name="robots" content="noindex,nofollow">','<link rel="canonical" href="https://missionmedinstitute.com/testimonials/">')
(A/'index.html').write_text(h)
j=(P/'hybrid.js').read_text().replace('"assets/','"'+url+'assets/');(A/'hybrid.js').write_text(j)
manifest={str(p.relative_to(A)):hashlib.sha256(p.read_bytes()).hexdigest() for p in A.rglob('*') if p.is_file()}
(R/'release-candidate/proof-app/ASSET_SHA256.json').write_text(json.dumps(manifest,indent=2))
print('Prepared',len(manifest),'assets; manifest stays NOT APPROVED; dataset remains outside asset tree.')
