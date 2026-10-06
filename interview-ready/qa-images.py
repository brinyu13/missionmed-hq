"""Image audit gate (Founder directive 2026-10-06 §17): every ACTIVE shopping product must carry an exact-product image
from an authorized source. Writes evidence/image-audit-<date>.json and exits non-zero on any failure."""
from pathlib import Path
import hashlib, json, sys
from datetime import date
ROOT = Path(__file__).resolve().parent
cat = json.loads((ROOT/'catalog.json').read_text())
policy = {e['path']: e for e in json.loads((ROOT/'production-assets.json').read_text())['assets']}
ledgers = {}
for f in ('evidence/manufacturer-images-2026-10-06.json','evidence/product-media.json'):
    p = ROOT/f
    if p.exists():
        for r in json.loads(p.read_text()):
            if r.get('derivative'): ledgers[r['derivative']] = (f, r)
rows, failures = [], []
def audit(item, scope):
    asin = item.get('asin'); status = item.get('status')
    row = {'product': item['name'], 'asin': asin, 'scope': scope, 'class': item.get('t')}
    if not asin:
        row.update(imageSource='n/a', imageRef=None, status='PLAN_NO_PURCHASE'); rows.append(row); return
    if status in ('archived','image-hold'):
        row.update(imageSource='none', imageRef=None, status=('ARCHIVED' if status=='archived' else 'IMAGE_NOT_PRODUCTION_READY'), reason=item.get('holdReason') or item.get('archivedReason')); rows.append(row); return
    img = item.get('image')
    if not img:
        row.update(imageSource='none', imageRef=None, status='FAIL_GLYPH_PLACEHOLDER'); failures.append(row); rows.append(row); return
    path = ROOT/img
    ok = path.exists() and img in policy and hashlib.sha256(path.read_bytes()).hexdigest() == policy[img]['sha256']
    led = ledgers.get(img)
    src = (item.get('imageSource') or ('manufacturer' if led and 'manufacturer' in led[0] else 'cc-licensed'))
    mapped = led and (led[1].get('asin') == asin)
    row.update(imageSource=src, imageRef=(led[1].get('url') if led else img), derivative=img, allowlisted=bool(img in policy), hashOk=bool(ok), exactAsinMapping=bool(mapped),
               status='OK' if (ok and mapped and item.get('imageCredit')) else 'FAIL_' + ('BROKEN_IMAGE' if not ok else 'WRONG_MODEL' if not mapped else 'MISSING_CREDIT'))
    if row['status'] != 'OK': failures.append(row)
    rows.append(row)
for c in cat['online']:
    for i in c['items']: audit(i, 'online:'+c['id'])
for i in cat['alternatives']: audit(i, 'alternative')
out = {'auditedOn': date.today().isoformat(), 'scope': 'online catalog + alternatives (in-person deferred)', 'activeWithImage': sum(1 for r in rows if r['status']=='OK'), 'held': sum(1 for r in rows if r['status']=='IMAGE_NOT_PRODUCTION_READY'), 'archived': sum(1 for r in rows if r['status']=='ARCHIVED'), 'plans': sum(1 for r in rows if r['status']=='PLAN_NO_PURCHASE'), 'failures': len(failures), 'rows': rows}
(ROOT/'evidence'/f'image-audit-{out["auditedOn"]}.json').write_text(json.dumps(out, indent=2, ensure_ascii=False)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='rows'}, indent=2))
for r in failures: print('FAIL', r)
sys.exit(1 if failures else 0)
