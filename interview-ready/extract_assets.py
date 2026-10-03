"""Reproducible, owner-authorized crops. Originals are preserved in sources/."""
from pathlib import Path
import hashlib, json
from PIL import Image

ROOT = Path(__file__).resolve().parent
SPECS = {
    'hero-online-board': (2, (0, 72, 806, 437)),
    'hero-inperson-board': (2, (810, 72, 1448, 437)),
    'interview-portrait': (2, (405, 82, 680, 326)),
    'style-portrait': (1, (422, 94, 665, 406)),
    'travel-detail': (2, (1000, 206, 1438, 433)),
    'purpose-landscape': (2, (1214, 437, 1448, 590)),
    'mountain-panorama': (2, (0, 896, 1448, 929)),
    'category-camera': (2, (29, 456, 188, 546)),
    'category-microphone': (2, (202, 452, 357, 546)),
    'category-lighting': (2, (374, 457, 529, 546)),
    'category-accessories': (2, (546, 457, 702, 546)),
    'category-travel': (2, (718, 450, 874, 546)),
    'category-emergency': (2, (887, 458, 1042, 546)),
    'mountain-mark': (2, (78, 10, 185, 49)),
}
records = []
for name, (board, bounds) in SPECS.items():
    source = ROOT / 'sources' / f'gear-guide-{board}.png'
    with Image.open(source) as im:
        # Coordinates were measured against the exact supplied 1448x1086 boards.
        assert im.size == (1448, 1086), im.size
        crop = im.crop(bounds).convert('RGB')
        out = ROOT / 'img' / f'{name}.webp'
        crop.save(out, 'WEBP', quality=91, method=6)
    records.append({'output':str(out.relative_to(ROOT)), 'source':str(source.relative_to(ROOT)),
                    'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'bounds':bounds,
                    'sha256':hashlib.sha256(out.read_bytes()).hexdigest(), 'bytes':out.stat().st_size})
(ROOT/'evidence/asset-provenance.json').write_text(json.dumps(records,indent=2)+'\n')
print(f'Extracted {len(records)} owner-supplied derivatives; originals preserved.')
