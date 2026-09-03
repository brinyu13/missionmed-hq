#!/usr/bin/env python3
"""Deterministically extract and verify MX-DASH-6010B locked PNG crops.

Uses only the Python standard library. The approved sources are 8-bit RGB,
non-interlaced PNGs. Extraction writes filter-0 RGB PNGs whose decoded pixels
are byte-for-byte source rectangles.
"""

from __future__ import annotations

import argparse
import binascii
import hashlib
import json
import struct
import sys
import zlib
from pathlib import Path

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def paeth(a: int, b: int, c: int) -> int:
    estimate = a + b - c
    da, db, dc = abs(estimate - a), abs(estimate - b), abs(estimate - c)
    return a if da <= db and da <= dc else b if db <= dc else c


def read_rgb_png(path: Path) -> tuple[int, int, bytes]:
    payload = path.read_bytes()
    if not payload.startswith(PNG_SIGNATURE):
        raise ValueError(f"{path}: invalid PNG signature")
    pos = len(PNG_SIGNATURE)
    width = height = None
    compressed = bytearray()
    while pos < len(payload):
        if pos + 12 > len(payload):
            raise ValueError(f"{path}: truncated PNG chunk")
        length = struct.unpack(">I", payload[pos : pos + 4])[0]
        kind = payload[pos + 4 : pos + 8]
        data = payload[pos + 8 : pos + 8 + length]
        expected_crc = struct.unpack(">I", payload[pos + 8 + length : pos + 12 + length])[0]
        actual_crc = binascii.crc32(kind + data) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise ValueError(f"{path}: corrupt {kind.decode('ascii', 'replace')} chunk")
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", data)
            if (depth, color, compression, filtering, interlace) != (8, 2, 0, 0, 0):
                raise ValueError(f"{path}: expected 8-bit RGB non-interlaced PNG")
        elif kind == b"IDAT":
            compressed.extend(data)
        elif kind == b"IEND":
            break
    if width is None or height is None:
        raise ValueError(f"{path}: missing IHDR")
    raw = zlib.decompress(bytes(compressed))
    stride, bpp = width * 3, 3
    if len(raw) != height * (stride + 1):
        raise ValueError(f"{path}: decoded payload length mismatch")
    pixels = bytearray(height * stride)
    previous = bytearray(stride)
    cursor = 0
    for y in range(height):
        method = raw[cursor]
        cursor += 1
        encoded = raw[cursor : cursor + stride]
        cursor += stride
        row = bytearray(stride)
        for x, value in enumerate(encoded):
            left = row[x - bpp] if x >= bpp else 0
            up = previous[x]
            upper_left = previous[x - bpp] if x >= bpp else 0
            if method == 0:
                decoded = value
            elif method == 1:
                decoded = value + left
            elif method == 2:
                decoded = value + up
            elif method == 3:
                decoded = value + ((left + up) // 2)
            elif method == 4:
                decoded = value + paeth(left, up, upper_left)
            else:
                raise ValueError(f"{path}: unsupported PNG filter {method}")
            row[x] = decoded & 0xFF
        start = y * stride
        pixels[start : start + stride] = row
        previous = row
    return width, height, bytes(pixels)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    checksum = binascii.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def write_rgb_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    stride = width * 3
    scanlines = b"".join(b"\x00" + pixels[y * stride : (y + 1) * stride] for y in range(height))
    encoded = PNG_SIGNATURE
    encoded += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    encoded += png_chunk(b"IDAT", zlib.compress(scanlines, 9))
    encoded += png_chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded)


def crop_rgb(width: int, pixels: bytes, rect: dict[str, int]) -> bytes:
    x, y, crop_w, crop_h = (rect[key] for key in ("x", "y", "width", "height"))
    stride = width * 3
    return b"".join(
        pixels[(y + row) * stride + x * 3 : (y + row) * stride + (x + crop_w) * 3]
        for row in range(crop_h)
    )


def run(manifest_path: Path, source_dir: Path, output_dir: Path, extract: bool) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    decoded: dict[str, tuple[int, int, bytes]] = {}
    failures: list[str] = []
    for key, record in manifest["sources"].items():
        path = source_dir / record["file"]
        if sha256(path) != record["sha256"]:
            failures.append(f"{key}: source SHA-256 mismatch")
            continue
        image = read_rgb_png(path)
        if image[:2] != (record["width"], record["height"]):
            failures.append(f"{key}: source dimensions mismatch")
            continue
        decoded[key] = image
    for card in manifest["cards"]:
        for state in ("pencil", "cinematic"):
            mapping = card[state]
            source = decoded.get(mapping["source"])
            if source is None:
                continue
            width, height, pixels = source
            rect = mapping["rect"]
            if rect["x"] < 0 or rect["y"] < 0 or rect["x"] + rect["width"] > width or rect["y"] + rect["height"] > height:
                failures.append(f"{card['id']}/{state}: crop is outside source")
                continue
            expected_pixels = crop_rgb(width, pixels, rect)
            output = output_dir / mapping["output"]
            if extract:
                write_rgb_png(output, rect["width"], rect["height"], expected_pixels)
            try:
                out_w, out_h, actual_pixels = read_rgb_png(output)
            except (OSError, ValueError) as error:
                failures.append(f"{card['id']}/{state}: {error}")
                continue
            if (out_w, out_h) != (rect["width"], rect["height"]) or actual_pixels != expected_pixels:
                failures.append(f"{card['id']}/{state}: decoded pixels differ from exact source crop")
                continue
            print(json.dumps({
                "card": card["id"], "state": state, "output": mapping["output"],
                "png_sha256": sha256(output),
                "pixel_sha256": hashlib.sha256(actual_pixels).hexdigest(),
                "size": [out_w, out_h], "source_rect": rect,
            }, sort_keys=True))
    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print(f"LOCKED_ART_{'EXTRACT' if extract else 'VERIFY'}_PASS cards={len(manifest['cards'])} endpoints={len(manifest['cards']) * 2}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("extract", "verify"))
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    return run(args.manifest, args.source_dir, args.output_dir, args.mode == "extract")


if __name__ == "__main__":
    raise SystemExit(main())
