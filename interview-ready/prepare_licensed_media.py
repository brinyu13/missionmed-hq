"""Optimize licensed, exact-model photographs; preserve source originals."""
from pathlib import Path
from PIL import Image, ImageOps
import hashlib, json

ROOT = Path(__file__).resolve().parent
records = [
    dict(model='Canon EOS R50', asin='B0BTTV6CT1',
         original='product-canon-r50-cc.jpg', derivative='product-canon-r50-cc.webp',
         source='https://commons.wikimedia.org/wiki/File:Canon_EOS_R50_Black.jpg',
         url='https://upload.wikimedia.org/wikipedia/commons/6/62/Canon_EOS_R50_Black.jpg',
         author='CNEcija12345', license='CC BY-SA 4.0',
         licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',
         caption='R50 with a lens; confirm the RF-S 18–45mm kit contents on Amazon.', crop=None),
    dict(model='Shure SM7B', asin='B0002E4Z8M',
         original='product-shure-sm7b-cc.jpg', derivative='product-shure-sm7b-cc.webp',
         source='https://commons.wikimedia.org/wiki/File:Marius_Bear_SM7B.jpg',
         url='https://upload.wikimedia.org/wikipedia/commons/c/c9/Marius_Bear_SM7B.jpg',
         author='Christoph Soltmannowski', license='CC BY 3.0',
         licenseUrl='https://creativecommons.org/licenses/by/3.0/',
         caption='SM7B in use; arm and accessories are separate.', crop=(0, 140, 595, 750)),
    dict(model='Elgato Stream Deck +', asin='B0BJL8SJ59',
         original='product-stream-plus-cc.jpg', derivative='product-stream-plus-cc.webp',
         source='https://commons.wikimedia.org/wiki/File:Elgato_Stream_Deck_%2B.jpg',
         url='https://upload.wikimedia.org/wikipedia/commons/6/67/Elgato_Stream_Deck_%2B.jpg',
         author='TaurusEmerald', license='CC BY-SA 4.0',
         licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',
         caption='Stream Deck + photographed in use; key layouts are customizable.',
         observedAt='2026-10-04T13:40:27Z', crop=None)
]
ledger_path = ROOT/'evidence/product-media.json'
ledger = json.loads(ledger_path.read_text())
catalog_path = ROOT/'catalog.json'
catalog = json.loads(catalog_path.read_text())
for record in records:
    original = ROOT/'sources'/record['original']
    output = ROOT/'img'/record['derivative']
    im = ImageOps.exif_transpose(Image.open(original)).convert('RGB')
    if record['crop']:
        im = im.crop(record['crop'])
    im.thumbnail((1000, 800), Image.Resampling.LANCZOS)
    im.save(output, 'WEBP', quality=87, method=6)
    evidence = {**record, 'observedAt':record.get('observedAt','2026-10-04T13:19:13Z'),
                'localSource':'sources/'+record['original'], 'derivative':'img/'+record['derivative'],
                'sha256':hashlib.sha256(original.read_bytes()).hexdigest(),
                'derivativeSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                'changes':'EXIF orientation normalized, resized, metadata removed and WebP encoded'+('; cropped to the microphone, excluding the person' if record['crop'] else ''),
                'rights':'Commercial reuse permitted by the stated Creative Commons license. The photograph derivative retains that license; no endorsement is implied.'}
    ledger = [r for r in ledger if r.get('derivative') != evidence['derivative']] + [evidence]
    for category in catalog['online']:
        for item in category['items']:
            if item.get('asin') == record['asin']:
                item['image'] = evidence['derivative']
                item['imageCredit'] = {k:evidence[k] for k in ('author','license','licenseUrl','source','caption','changes')}
ledger_path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False)+'\n')
catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False)+'\n')
print('Prepared licensed Canon R50, Shure SM7B and Stream Deck + photographs with custody.')
