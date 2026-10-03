"""Optimize already-researched manufacturer PNGs. No network or new rights assumptions."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parent
path=ROOT/'evidence/product-media.json';rows=json.loads(path.read_text())
for row in rows:
 source=ROOT/row['localSource'];assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256']
 im=Image.open(source).convert('RGBA');box=im.getbbox();im=im.crop(box);im.thumbnail((900,700));pad=max(8,int(max(im.size)*.03))
 out=Image.new('RGBA',(im.width+pad*2,im.height+pad*2));out.paste(im,(pad,pad));target=ROOT/row['derivative'];out.save(target,'WEBP',quality=91)
 row.update(crop=box,derivativeSha256=hashlib.sha256(target.read_bytes()).hexdigest())
path.write_text(json.dumps(rows,indent=2)+'\n')
print(f'Optimized {len(rows)} exact-model editorial product images.')
