#!/usr/bin/env python3
"""Extract, derive, and verify MX-DASH-6010B locked-art PNGs.

Uses only the Python standard library. The approved sources are 8-bit RGB,
non-interlaced PNGs. Extraction writes filter-0 RGB PNGs whose decoded pixels
are byte-for-byte source rectangles. Registered pencil endpoints are a
deterministic graphite rendering of the exact cinematic crop, so subject
geometry, scale, position, perspective, and framing match by construction.
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
DERIVATION_VERSION = "mx-dash-6010b-registered-graphite-v5"


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


def box_blur(values: list[int], width: int, height: int, radius: int) -> list[int]:
    """Integer, edge-clamped separable box blur for reproducible output."""
    horizontal = [0] * (width * height)
    for y in range(height):
        base = y * width
        for x in range(width):
            total = 0
            for offset in range(-radius, radius + 1):
                total += values[base + min(width - 1, max(0, x + offset))]
            horizontal[base + x] = total // (radius * 2 + 1)
    output = [0] * (width * height)
    for y in range(height):
        for x in range(width):
            total = 0
            for offset in range(-radius, radius + 1):
                total += horizontal[min(height - 1, max(0, y + offset)) * width + x]
            output[y * width + x] = total // (radius * 2 + 1)
    return output


def paper_profile(pixels: bytes) -> tuple[tuple[int, int, int], int]:
    """Measure ivory tone and restrained grain amplitude from bright paper."""
    bright: list[tuple[int, int, int]] = []
    for pos in range(0, len(pixels), 3):
        r, g, b = pixels[pos : pos + 3]
        if (54 * r + 183 * g + 19 * b) // 256 >= 212:
            bright.append((r, g, b))
    if not bright:
        return (244, 240, 230), 4
    mean = tuple(sum(pixel[channel] for pixel in bright) // len(bright) for channel in range(3))
    lumas = [(54 * r + 183 * g + 19 * b) // 256 for r, g, b in bright]
    average = sum(lumas) // len(lumas)
    variance = sum((value - average) ** 2 for value in lumas) // len(lumas)
    return mean, max(2, min(6, int(variance ** 0.5) // 2))


def noise_byte(x: int, y: int, seed: int) -> int:
    value = (x * 374761393 + y * 668265263 + seed * 69069) & 0xFFFFFFFF
    value = ((value ^ (value >> 13)) * 1274126177) & 0xFFFFFFFF
    return (value ^ (value >> 16)) & 0xFF


def derive_registered_pencil(
    width: int,
    height: int,
    pixels: bytes,
    paper_tone: tuple[int, int, int],
    grain_amplitude: int,
    seed: int,
) -> bytes:
    """Render premium graphite without changing a single source coordinate."""
    luminance = [
        (54 * pixels[pos] + 183 * pixels[pos + 1] + 19 * pixels[pos + 2]) // 256
        for pos in range(0, len(pixels), 3)
    ]
    ordered = sorted(luminance)
    low = ordered[len(ordered) * 2 // 100]
    high = ordered[len(ordered) * 98 // 100]
    span = max(32, high - low)
    lifted = [
        round(255.0 * (max(0.0, min(1.0, (value - low) / span)) ** 0.58))
        for value in luminance
    ]
    soft = box_blur(lifted, width, height, 1)
    broad = box_blur(lifted, width, height, 5)
    output = bytearray(width * height * 3)
    for y in range(height):
        for x in range(width):
            index = y * width + x
            left = soft[y * width + max(0, x - 1)]
            right = soft[y * width + min(width - 1, x + 1)]
            above = soft[max(0, y - 1) * width + x]
            below = soft[min(height - 1, y + 1) * width + x]
            gradient = min(255, abs(right - left) + abs(below - above)) / 255.0
            dog = max(0.0, min(1.0, (broad[index] - soft[index]) / 48.0))
            darkness = max(0.0, min(1.0, 1.0 - lifted[index] / 255.0))
            jitter = noise_byte(x // 3, y // 3, seed) / 255.0
            hatch_a = 1.0 if ((x + y * 3 + int(jitter * 4)) % 19) == 0 else 0.0
            hatch_b = 1.0 if ((x * 2 - y + int(jitter * 5)) % 29) == 0 else 0.0
            hatch = hatch_a * max(0.0, darkness - 0.42) + hatch_b * max(0.0, darkness - 0.64)
            contour = min(1.0, dog * 0.94 + gradient * 0.16)
            tonal = darkness ** 1.55
            tonal_band = round(tonal * 5.0) / 5.0
            ink = min(0.64, tonal_band * 0.22 + contour * 0.54 + hatch * 0.035)
            fine_grain = (noise_byte(x, y, seed + 97) - 127.5) / 127.5
            coarse_grain = (noise_byte(x // 4, y // 4, seed + 193) - 127.5) / 127.5
            paper_variation = fine_grain * grain_amplitude * 0.55 + coarse_grain * grain_amplitude * 0.45
            graphite = (63, 62, 60)
            for channel in range(3):
                paper = max(0, min(255, paper_tone[channel] + round(paper_variation)))
                value = round(paper * (1.0 - ink) + graphite[channel] * ink)
                output[index * 3 + channel] = max(0, min(255, value))
    return bytes(output)


def registered_record(
    card: dict[str, object],
    output_dir: Path,
    source_pixels: bytes,
    paper_tone: tuple[int, int, int],
    grain_amplitude: int,
    seed: int,
    write: bool,
) -> tuple[dict[str, object], str | None]:
    cinematic = card["cinematic"]
    cinematic_path = output_dir / cinematic["output"]
    width, height, actual_cinematic = read_rgb_png(cinematic_path)
    if actual_cinematic != source_pixels:
        return {}, f"{card['id']}: cinematic crop no longer matches its locked source pixels"
    derived = derive_registered_pencil(width, height, actual_cinematic, paper_tone, grain_amplitude, seed)
    derived_path = output_dir / "pencil-registered" / f"{card['id']}.png"
    if write:
        write_rgb_png(derived_path, width, height, derived)
    try:
        out_w, out_h, actual_derived = read_rgb_png(derived_path)
    except (OSError, ValueError) as error:
        return {}, f"{card['id']}: {error}"
    if (out_w, out_h) != (width, height) or actual_derived != derived:
        return {}, f"{card['id']}: registered pencil output is not reproducible"
    record = {
        "id": card["id"],
        "cinematic": {
            "source_crop": cinematic["rect"],
            "output": cinematic["output"],
            "png_sha256": sha256(cinematic_path),
            "pixel_sha256": hashlib.sha256(actual_cinematic).hexdigest(),
        },
        "derived_pencil": {
            "output": f"pencil-registered/{card['id']}.png",
            "png_sha256": sha256(derived_path),
            "pixel_sha256": hashlib.sha256(actual_derived).hexdigest(),
            "width": width,
            "height": height,
            "derived_from": cinematic["output"],
        },
        "registration": {
            "pixel_dimensions_identical": True,
            "coordinate_transform": "identity",
            "subject_bounds": "identical-by-construction",
            "framing": "identical-by-construction",
        },
    }
    return record, None


def run_derived(
    manifest_path: Path,
    source_dir: Path,
    output_dir: Path,
    derived_manifest_path: Path,
    write: bool,
) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    pencil_source = manifest["sources"]["pencil"]
    pencil_path = source_dir / pencil_source["file"]
    if sha256(pencil_path) != pencil_source["sha256"]:
        print("FAIL pencil style-source SHA-256 mismatch", file=sys.stderr)
        return 1
    _, _, pencil_pixels = read_rgb_png(pencil_path)
    paper_tone, grain_amplitude = paper_profile(pencil_pixels)
    cinematic_source = manifest["sources"]["cinematic"]
    cinematic_path = source_dir / cinematic_source["file"]
    if sha256(cinematic_path) != cinematic_source["sha256"]:
        print("FAIL cinematic source SHA-256 mismatch", file=sys.stderr)
        return 1
    source_width, _, source_pixels = read_rgb_png(cinematic_path)
    failures: list[str] = []
    records: list[dict[str, object]] = []
    seed_base = int(pencil_source["sha256"][:8], 16)
    for order, card in enumerate(manifest["cards"]):
        crop = crop_rgb(source_width, source_pixels, card["cinematic"]["rect"])
        record, failure = registered_record(
            card, output_dir, crop, paper_tone, grain_amplitude, seed_base + order * 7919, write
        )
        if failure:
            failures.append(failure)
        else:
            records.append(record)
            print(json.dumps(record, sort_keys=True))
    derived_manifest = {
        "schema_version": "missionmed.mx-dash-6010b.registered-pencil.v2",
        "ticket": "MX-DASH-6010B",
        "derivation": {
            "version": DERIVATION_VERSION,
            "implementation": "tests/mx-dash-6010b/locked_art_tool.py",
            "method": "BT.709 luminance; deterministic q02/q98 shadow lift; multi-scale dark-line extraction; six-band tonal graphite; restrained directional hatching; pencil-board-calibrated ivory paper and grain",
            "geometry_policy": "identity transform over exact decoded cinematic crop pixels",
            "ai_generation": False,
            "paper_hatch_style_source": {
                "file": pencil_source["file"],
                "sha256": pencil_source["sha256"],
                "role": "approved style reference; bright-paper tone and grain statistics only",
                "measured_ivory_rgb": list(paper_tone),
                "grain_amplitude": grain_amplitude,
            },
        },
        "cinematic_source": cinematic_source,
        "cards": records,
    }
    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    encoded = json.dumps(derived_manifest, indent=2, sort_keys=True) + "\n"
    if write:
        derived_manifest_path.parent.mkdir(parents=True, exist_ok=True)
        derived_manifest_path.write_text(encoded, encoding="utf-8")
    else:
        try:
            if derived_manifest_path.read_text(encoding="utf-8") != encoded:
                print("FAIL derived manifest is stale", file=sys.stderr)
                return 1
        except OSError as error:
            print(f"FAIL {error}", file=sys.stderr)
            return 1
    print(f"REGISTERED_PENCIL_{'DERIVE' if write else 'VERIFY'}_PASS cards={len(records)} identity-registered={len(records)}")
    return 0


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
    parser.add_argument("mode", choices=("extract", "verify", "derive", "verify-derived"))
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--derived-manifest", type=Path)
    args = parser.parse_args()
    if args.mode in {"derive", "verify-derived"}:
        if args.derived_manifest is None:
            parser.error("--derived-manifest is required for derived-pencil modes")
        return run_derived(
            args.manifest,
            args.source_dir,
            args.output_dir,
            args.derived_manifest,
            args.mode == "derive",
        )
    return run(args.manifest, args.source_dir, args.output_dir, args.mode == "extract")


if __name__ == "__main__":
    raise SystemExit(main())
