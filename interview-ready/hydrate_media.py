"""Dated manufacturer/retailer media acquisition for the local editorial review.
Never takes an Amazon image, review, price, or credential. Source originals remain intact.
Re-running is explicit network research, not part of the reproducible build.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from urllib.request import urlopen
from urllib.parse import urlparse,parse_qs
import re,json,hashlib,io,datetime
from PIL import Image,ImageChops,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parent
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(b):return hashlib.sha256(b).hexdigest()
def get(u):
    with urlopen(u,timeout=20) as r:return r.read()
def meta(s,prop):
    for tag in re.findall(r'<meta\b[^>]+>',s):
        if re.search(r'(?:property|name)=["\']'+re.escape(prop)+r'["\']',tag):
            m=re.search(r'content=["\'](.*?)["\']',tag)
            if m:return unescape(m[1])
    return None
def save_image(key,url,source,model,asin=None):
    b=get(url);im=Image.open(io.BytesIO(b));im=ImageOps.exif_transpose(im).convert('RGBA')
    ext=Image.open(io.BytesIO(b)).format.lower().replace('jpeg','jpg')
    raw=ROOT/'sources'/('product-'+key+'.'+ext);raw.write_bytes(b)
    box=im.getbbox()
    if im.getextrema()[3][0]==255:
        diff=ImageChops.difference(im.convert('RGB'),Image.new('RGB',im.size,im.getpixel((0,0))[:3]))
        box=diff.point(lambda x:255 if x>25 else 0).getbbox() or box
    # Retailer photographs remain photographs; do not cut out the model or invent a garment.
    if asin and box:im=im.crop(box)
    im.thumbnail((720,880))
    out=ROOT/'img'/('product-'+key+'.webp');im.save(out,'WEBP',quality=84,method=6)
    return dict(model=model,asin=asin,source=source,url=url,observedAt=NOW,localSource=str(raw.relative_to(ROOT)),derivative=str(out.relative_to(ROOT)),sha256=digest(b),derivativeSha256=digest(out.read_bytes()),crop=box,rights='Public manufacturer/retailer product asset used in the local editorial founder-review candidate. Commercial publication permission is not asserted; review the applicable source rights before publication.')
def refresh_selected_media(only=None):
    """Refresh exact approved source URLs, preserving accepted model/variant data.
    Availability and prices require separate visible-page research; an image download
    does not reverify them. Missing/held media is never fetched or silently substituted.
    """
    media_path=ROOT/'evidence/product-media.json'
    fashion_path=ROOT/'evidence/fashion-sources.json'
    media=json.loads(media_path.read_text()); fashion=json.loads(fashion_path.read_text())
    selected=[('gear',i,r) for i,r in enumerate(media) if r.get('derivative')]
    selected += [('fashion',i,r['evidence']) for i,r in enumerate(fashion) if r.get('evidence',{}).get('derivative')]
    for kind,i,record in selected:
        key=Path(record['derivative']).stem.removeprefix('product-')
        if only and key not in only:continue
        try:
            renewed=save_image(key,record['url'],record['source'],record['model'],record.get('asin'))
            if kind=='gear':media[i]={**record,**renewed}
            else:fashion[i]['evidence']={**record,**renewed}
            print(key,renewed['derivative'],renewed['derivativeSha256'])
        except Exception as e:
            print(key,'HELD: existing accepted asset retained; '+type(e).__name__)
    media_path.write_text(json.dumps(media,ensure_ascii=False,indent=2)+'\n')
    fashion_path.write_text(json.dumps(fashion,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser(description='Deliberate image-only refresh from the dated source ledgers. Does not refresh product availability or pricing.')
    ap.add_argument('--only',nargs='+',help='Source keys, such as brio or ann-jacket; default is all previously verified assets.')
    args=ap.parse_args();refresh_selected_media(set(args.only) if args.only else None)
