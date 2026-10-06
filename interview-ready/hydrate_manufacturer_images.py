#!/usr/bin/env python3
"""Manufacturer product-image hydration (Founder directive 2026-10-06, §6 second-choice authority).
Downloads official manufacturer/press-kit imagery for the exact listed product, writes originals to
sources/, optimized derivatives to img/, provenance to evidence/manufacturer-images-2026-10-06.json,
admits derivatives in production-assets.json, and binds catalog image/imageCredit.
Run in the cloud workspace against a staged copy of interview-ready/; outputs are committed back."""
import hashlib, io, json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageOps

IR = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve(); (OUT/'sources').mkdir(parents=True, exist_ok=True); (OUT/'img').mkdir(exist_ok=True); (OUT/'evidence').mkdir(exist_ok=True)
NOW = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/128 Safari/537.36'
KEY = 'https://keystone.corsair.com/en/%s/press-kit/'

def keystone(slug, pick):
    d = json.loads(subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,'https://keystone.corsair.com/api/public/en/%s/press-kit/'%slug],capture_output=True,text=True,check=True).stdout)
    assert d['kit']['press_kit_access_mode']=='public', slug
    urls=[a.get('download_url','') for s in d['sections'] for a in s.get('assets',[])]
    hit=[u for u in urls if pick in u]
    assert hit, (slug, pick)
    return hit[0], KEY%slug, d['kit']['title']

# asin -> record
R = []
def rec(asin, model, brand, url, source, basis, note='', local=None, slug=None):
    R.append(dict(asin=asin, model=model, brand=brand, url=url, source=source, basis=basis, note=note, local=local, slug=slug))

# Elgato / Corsair public press kits (exact-listing "ASIN.Main" images where the kit publishes them)
for asin, model, slug, pick in [
    ('B0CW1S7XP5','Elgato Facecam MK.2','Facecam_MK_2','B0CW1S7XP5.Main'),
    ('B0DVZG36J8','Elgato Facecam 4K','Facecam_4K','B0DVZG36J8.'),
    ('B0GGYLFHPS','Elgato Wave:3 MK.2','Wave_3_MK_2','B0GGYLFHPS.Main'),
    ('B07L755X9G','Elgato Key Light','Key_Light_MK_2','B07L755X9G.main'),
    ('B0FHQSVPVL','Elgato Key Light Neo (no mount)','Key_Light_Neo','Key_Light_Neo_Front.jpg'),
    ('B0GYDFGCCQ','Elgato Key Light Air MK.2','Key_Light_Air_MK_2','Key_Light__Air_MK2_Device_Shot_00_gudxqv.png'),
    ('B097376LKF','Elgato Wave Mic Arm LP','Wave_Mic_Arm_LP','B097376LKF.Main'),
    ('B07K3FN5MR','Elgato Cam Link 4K','Cam_Link_4K','B07K3FN5MR.MAIN'),
    ('B0CVY4566H','Elgato Stream Deck Neo','Stream_Deck_Neo','B0CVY4566H.Main'),
    ('B09738CV2G','Elgato Stream Deck MK.2','Stream_Deck_MK_2','B09738CV2G.Main'),
    ('B0BJL8SJ59','Elgato Stream Deck +','Stream_Deck_Plus','B0BJL8SJ59.Main'),
]:
    url, src, title = keystone(slug, pick)
    note = 'Exact-listing main image published in the manufacturer press kit.' if asin in url else 'Manufacturer press-kit device render of the exact model.'
    if asin=='B0FHQSVPVL': note='Press-kit render of the Key Light Neo light itself (the verified listing is the no-mount variant; the kit indexes the clamp SKU B0CVYD9HB4).'
    if asin=='B07L755X9G': note='The Key Light MK.2 press kit publishes this listing’s own main image (B07L755X9G), i.e. the current product sold under the ASIN.'
    rec(asin, model, 'Elgato (Corsair Keystone public press kit)', url, src, 'Manufacturer public press-kit media', note, slug=slug)

# Logitech official product galleries (resource CDN) — Brio Ultra and Litra Glow reuse the already-captured originals
rec('B09NBWWP79','Logitech Brio Ultra 4K','Logitech', 'https://resource.logitech.com/w_1800,h_1800,c_limit,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio/gallery/brio-gallery-1.png','https://www.logitech.com/en-us/products/webcams/brio-4k-hdr-webcam.html','Manufacturer product-page media', local='product-brio.png')
rec('B097QZGRCQ','Logitech Litra Glow','Logitech','https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/lighting/litra-glow/gallery/litra-glow-streaming-light-gallery-1.png','https://www.logitech.com/en-us/products/lighting/litra-glow.html','Manufacturer product-page media', local='product-litra.png')
rec('B0BFJ4CRKD','Logitech MX Brio Ultra HD 4K (Graphite)','Logitech','https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/mx-brio/buy/migration-assets-for-delorean-2025/gallery/mx-brio-3qtr-front-left-close-graphite.png','https://www.logitech.com/en-us/products/webcams/mx-brio-4k-webcam.html','Manufacturer product-page media','Graphite colourway matches the verified listing.')
rec('B00N1YPXW2','Blue Yeti USB (Blackout)','Logitech G','https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/streaming-gear/yeti-premium-usb-microphone/2025/gallery/yeti-3qtr-left-angle-blackout-gallery-4.png','https://www.logitechg.com/en-us/products/streaming-gear/yeti-premium-usb-microphone.html','Manufacturer product-page media','Blackout colourway matches the verified listing.')
# Shure, Samson, Sony, Anker, DJI
rec('B0CTJ7PVN1','Shure MV7+ (black)','Shure','https://products.shureweb.eu/shure_product_db/product_main_images/files/700/ead/89-/large_transparent/fe71d068e73acc951e1c9a0458a7093c.png','https://www.shure.com/en-US/products/microphones/mv7?variant=MV7PLUS-K','Manufacturer product-page media','Variant MV7+-K main image from Shure’s product database.')
rec('B07FKG8PGZ','Samson Q2U','Samson','https://storage.googleapis.com/samson-production/uploads/original_images/Q2U-on-Stand-1.jpg','https://samsontech.com/products/microphones/usb-microphones/q2u/','Manufacturer product-page media')
rec('B08DP4NKGN','Sony α7S III body (ILCE-7SM3)','Sony','https://sony.scene7.com/is/image/sonyglobalsolutions/ILCE-7SM3?fmt=png-alpha&wid=1200','https://electronics.sony.com/imaging/interchangeable-lens-cameras/full-frame/p/ilce7sm3-b','Manufacturer product image (Sony global image server)')
rec('B08CK9X9Z8','Anker PowerExpand A8313 USB-C to Gigabit Ethernet','Anker','https://cdn.shopify.com/s/files/1/0493/9834/9974/files/A83130A2_TD01_V1_d4d9a09b-8ea1-4229-81ec-2f167b4e9a4f.png?v=1730775320','https://www.anker.com/products/a8313','Manufacturer product-page media')
rec('B0CG19QXWD','DJI Osmo Pocket 3','DJI','https://www-cdn.djiits.com/cms/uploads/8c6ec9b0dc4e170120dfd4ebf9f0ffd6.png','https://www.dji.com/osmo-pocket-3','Manufacturer product-page media')

slug_by_asin = {'B0CW1S7XP5':'facecam-mk2','B0DVZG36J8':'facecam-4k','B0GGYLFHPS':'wave3-mk2','B07L755X9G':'key-light','B0FHQSVPVL':'key-light-neo','B0GYDFGCCQ':'key-light-air-mk2','B097376LKF':'arm-lp','B07K3FN5MR':'camlink','B0CVY4566H':'stream-deck-neo','B09738CV2G':'stream-deck-mk2','B0BJL8SJ59':'stream-deck-plus','B09NBWWP79':'brio','B097QZGRCQ':'litra','B0BFJ4CRKD':'mx-brio','B00N1YPXW2':'yeti','B0CTJ7PVN1':'mv7plus','B07FKG8PGZ':'q2u','B08DP4NKGN':'a7s3','B08CK9X9Z8':'anker-a8313','B0CG19QXWD':'osmo-pocket-3'}

ledger=[]; assets=[]
for r in R:
    name = slug_by_asin[r['asin']]
    if r['local'] and (IR/'sources'/r['local']).exists():
        raw = (IR/'sources'/r['local']).read_bytes(); ext = r['local'].rsplit('.',1)[1]
    else:
        raw = subprocess.run(['curl','-sS','-L','--max-time','60','-A',('Mozilla/5.0' if 'shureweb' in r['url'] else UA),r['url']],capture_output=True,check=True).stdout
        ext = 'png' if raw[:4]==b'\x89PNG' else 'jpg' if raw[:2]==b'\xff\xd8' else 'webp'
    assert len(raw) > 5000, r['asin']
    original = OUT/'sources'/f'product-{name}-mfg.{ext}'
    original.write_bytes(raw)
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
    im = im.convert('RGBA') if im.mode in ('RGBA','LA','P') else im.convert('RGB')
    if im.mode=='RGBA':  # trim transparent margins so products share a visual scale
        bbox = im.getchannel('A').getbbox()
        if bbox: im = im.crop(bbox)
    im.thumbnail((640, 560), Image.Resampling.LANCZOS)
    deriv = OUT/'img'/f'product-{name}-mfg.webp'
    im.save(deriv, 'WEBP', quality=84, method=6)
    sha = hashlib.sha256(deriv.read_bytes()).hexdigest()
    ledger.append({**{k:v for k,v in r.items() if k!='local'}, 'observedAt':NOW, 'localSource':f'sources/{original.name}', 'derivative':f'img/{deriv.name}', 'sha256':hashlib.sha256(raw).hexdigest(), 'derivativeSha256':sha, 'width':im.width, 'height':im.height,
                   'changes':'Resized, '+('transparent margins trimmed, ' if im.mode=='RGBA' else '')+'metadata removed and WebP encoded; no retouching.',
                   'rights':'Official manufacturer product/press media of the exact listed product, used to depict the product in an affiliate buying guide. Founder directive 2026-10-06 §6 names this as the second-choice image authority; provenance recorded. No endorsement implied. (Note: Corsair Keystone and the brand product pages publish no explicit licence text; see HANDOFF for the legal note.)'})
    assets.append({'path':f'img/{deriv.name}','sha256':sha,'basis':r['basis'],'evidence':'evidence/manufacturer-images-2026-10-06.json','author':r['brand'],'licenseUrl':r['source'],'source':r['url']})
    print('ok', r['asin'], deriv.name, im.size)

(OUT/'evidence'/'manufacturer-images-2026-10-06.json').write_text(json.dumps(ledger, indent=2, ensure_ascii=False)+'\n')

# production-assets.json: admit derivatives (append; keep existing entries)
policy = json.loads((IR/'production-assets.json').read_text())
existing = {e['path'] for e in policy['assets']}
policy['assets'] += [a for a in assets if a['path'] not in existing]
(OUT/'production-assets.json').write_text(json.dumps(policy, indent=2, ensure_ascii=False)+'\n')

# catalog: bind images + credits; hold products with no authorized image
cat = json.loads((IR/'catalog.json').read_text())
by_asin = {l['asin']:l for l in ledger}
HOLD = {'B085TFF7M1':'IMAGE_NOT_PRODUCTION_READY: Logitech publishes no C920x (no-shutter, Amazon-exclusive) product image; only C920s media exists. Held until an Amazon Creators API image is authorized.',
        'B0CYQ5P6T7':'IMAGE_NOT_PRODUCTION_READY: no EMEET manufacturer page or image for the S600 was located. Held until an Amazon Creators API image is authorized.',
        'B017D7W57S':'IMAGE_NOT_PRODUCTION_READY: no NEEWER manufacturer page or image for this kit was located. Held until an Amazon Creators API image is authorized.'}
for cat_group in ('online',):
    for c in cat[cat_group]:
        for i in c['items']:
            a = i.get('asin')
            if a in by_asin:
                l = by_asin[a]
                i['image'] = l['derivative']
                i['imageCredit'] = {'author':l['brand'],'license':l['basis'],'licenseUrl':l['source'],'source':l['url'],'caption':'Manufacturer product image of the exact model.','changes':l['changes']}
                i['imageSource'] = 'manufacturer'
            elif a in HOLD and i.get('status') != 'archived':
                i['status'] = 'image-hold'; i['holdReason'] = HOLD[a]
for i in cat['alternatives']:
    a = i.get('asin')
    if a in by_asin:
        l = by_asin[a]; i['image']=l['derivative']; i['imageCredit']={'author':l['brand'],'license':l['basis'],'licenseUrl':l['source'],'source':l['url'],'caption':'Manufacturer product image of the exact model.','changes':l['changes']}; i['imageSource']='manufacturer'
(OUT/'catalog.json').write_text(json.dumps(cat, indent=2, ensure_ascii=False)+'\n')
print('ledger', len(ledger), 'assets admitted', len(policy['assets']))
