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
import math
import struct
import sys
import zlib
from pathlib import Path

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
DERIVATION_VERSION = "mx-dash-6010b-registered-graphite-v5"
BAKEOFF_VERSION = "mx-dash-6010b-registered-graphite-v6-bakeoff"


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


def weighted_blur(values: list[int], width: int, height: int, kernel: tuple[int, ...]) -> list[int]:
    """Deterministic separable Gaussian approximation with edge-clamped samples."""
    radius, scale = len(kernel) // 2, sum(kernel)
    horizontal = [0] * (width * height)
    for y in range(height):
        base = y * width
        for x in range(width):
            total = sum(values[base + min(width - 1, max(0, x + k - radius))] * weight for k, weight in enumerate(kernel))
            horizontal[base + x] = (total + scale // 2) // scale
    output = [0] * (width * height)
    for y in range(height):
        for x in range(width):
            total = sum(horizontal[min(height - 1, max(0, y + k - radius)) * width + x] * weight for k, weight in enumerate(kernel))
            output[y * width + x] = (total + scale // 2) // scale
    return output


def smoothstep(low: float, high: float, value: float) -> float:
    value = max(0.0, min(1.0, (value - low) / max(0.00001, high - low)))
    return value * value * (3.0 - 2.0 * value)


def luma_pixels(pixels: bytes) -> list[int]:
    return [(13933 * pixels[p] + 46871 * pixels[p + 1] + 4732 * pixels[p + 2] + 32768) >> 16 for p in range(0, len(pixels), 3)]


def paper_residuals(board_width: int, board_pixels: bytes) -> tuple[tuple[int, int, int], list[int]]:
    """Sample approved-board paper and retain its actual high-frequency tooth."""
    tile = crop_rgb(board_width, board_pixels, {"x": 960, "y": 80, "width": 64, "height": 64})
    tone = tuple(sum(tile[p + c] for p in range(0, len(tile), 3)) // 4096 for c in range(3))
    values = luma_pixels(tile)
    low_pass = box_blur(values, 64, 64, 4)
    return tone, [max(-6, min(6, value - low_pass[i])) for i, value in enumerate(values)]


def source_gradients(values: list[int], width: int, height: int) -> tuple[list[int], list[int], list[int]]:
    gx, gy, magnitude = [0] * (width * height), [0] * (width * height), [0] * (width * height)
    for y in range(height):
        ym, yp = max(0, y - 1), min(height - 1, y + 1)
        for x in range(width):
            xm, xp, i = max(0, x - 1), min(width - 1, x + 1), y * width + x
            dx = values[ym * width + xp] + 2 * values[y * width + xp] + values[yp * width + xp]
            dx -= values[ym * width + xm] + 2 * values[y * width + xm] + values[yp * width + xm]
            dy = values[yp * width + xm] + 2 * values[yp * width + x] + values[yp * width + xp]
            dy -= values[ym * width + xm] + 2 * values[ym * width + x] + values[ym * width + xp]
            gx[i], gy[i], magnitude[i] = dx, dy, min(1020, abs(dx) + abs(dy))
    return gx, gy, magnitude


def hatch_mark(x: int, y: int, gx: int, gy: int, spacing: int, width: float, phase: int) -> float:
    """Choose a structure-tangent hatch family without moving source geometry."""
    family = int(round((math.atan2(gy, gx) + math.pi / 2.0) / (math.pi / 12.0))) % 12
    angle = family * math.pi / 12.0
    coordinate = x * math.cos(angle) + y * math.sin(angle) + phase
    distance = abs((coordinate % spacing) - spacing / 2.0)
    return max(0.0, min(1.0, (width + 0.75 - distance) / 0.75))


def fixed_hatch(x: int, y: int, spacing: int, width: float, angle: float, phase: int, seed: int) -> float:
    coordinate = x * math.cos(angle) + y * math.sin(angle) + phase
    distance = abs((coordinate % spacing) - spacing / 2.0)
    line = max(0.0, min(1.0, (width + 0.70 - distance) / 0.70))
    segment = noise_byte(x // 28, y // 18, seed) / 255.0
    if segment < .09:
        return 0.0
    return line * (.88 + .16 * segment)


def draw_graphite_stroke(field: list[float], width: int, height: int, x: float, y: float, angle: float, length: float, opacity: float, radius: int) -> None:
    steps = max(2, round(length))
    start_x, start_y = x - math.cos(angle) * length / 2.0, y - math.sin(angle) * length / 2.0
    for step in range(steps + 1):
        center_x = round(start_x + math.cos(angle) * length * step / steps)
        center_y = round(start_y + math.sin(angle) * length * step / steps)
        for oy in range(-radius, radius + 1):
            for ox in range(-radius, radius + 1):
                px, py = center_x + ox, center_y + oy
                if px < 0 or py < 0 or px >= width or py >= height:
                    continue
                falloff = max(0.0, 1.0 - math.hypot(ox, oy) / (radius + .75))
                index = py * width + px
                field[index] = 1.0 - (1.0 - field[index]) * (1.0 - opacity * falloff)


def derive_bakeoff_variant(width: int, height: int, pixels: bytes, paper_tone: tuple[int, int, int], paper_residual: list[int], seed: int, variant: str) -> bytes:
    """Render A/B/C concept-art candidates from one immutable cinematic geometry."""
    raw_source = luma_pixels(pixels)
    ordered = sorted(raw_source)
    low, high = ordered[len(ordered) * 2 // 100], ordered[len(ordered) * 98 // 100]
    span = max(32, high - low)
    source = [round(255.0 * (max(0.0, min(1.0, (value - low) / span)) ** .55)) for value in raw_source]
    paper_tone = (234, 229, 223)
    cleaned = weighted_blur(source, width, height, (1, 4, 6, 4, 1))
    fine = weighted_blur(cleaned, width, height, (1, 2, 1))
    medium = weighted_blur(cleaned, width, height, (1, 4, 6, 4, 1))
    broad = weighted_blur(cleaned, width, height, (1, 8, 28, 56, 70, 56, 28, 8, 1))
    very_broad = weighted_blur(broad, width, height, (1, 4, 6, 4, 1))
    scene_field = box_blur(broad, width, height, 21)
    gx, gy, gradients = source_gradients(broad, width, height)
    _, _, detail_gradients = source_gradients(medium, width, height)
    settings = {
        "a": {"edge_low": .105, "edge_high": .330, "fine_low": .080, "fine_high": .285, "tone_cut": .69, "tone_max": .055, "grain": .45, "graphite": (39, 38, 36), "line": .96, "under": .020, "cell": 11, "stroke": .17},
        "b": {"edge_low": .078, "edge_high": .285, "fine_low": .060, "fine_high": .245, "tone_cut": .64, "tone_max": .085, "grain": .82, "graphite": (52, 49, 46), "line": .86, "under": .042, "cell": 7, "stroke": .14},
        "c": {"edge_low": .088, "edge_high": .302, "fine_low": .067, "fine_high": .255, "tone_cut": .58, "tone_max": .15, "grain": .62, "graphite": (42, 41, 39), "line": .93, "under": .036, "cell": 7, "stroke": .21},
    }[variant]
    structure_field = [0.0] * (width * height)
    for i in range(width * height):
        fine_ridge = abs(fine[i] - medium[i]) / 255.0
        broad_ridge = abs(medium[i] - very_broad[i]) / 255.0
        broad_signal = broad_ridge * 1.85 + gradients[i] / 1020.0 * .82
        fine_signal = fine_ridge * 2.65 + detail_gradients[i] / 1020.0 * .62
        broad_line = smoothstep(settings["edge_low"], settings["edge_high"], broad_signal)
        fine_line = smoothstep(settings["fine_low"], settings["fine_high"], fine_signal)
        structure_field[i] = max(broad_line, fine_line * (.70 if variant != "b" else .62))
    if variant == "c":
        thinned = [0.0] * (width * height)
        for y in range(height):
            for x in range(width):
                i = y * width + x
                if abs(gx[i]) >= abs(gy[i]):
                    before, after = structure_field[y * width + max(0, x - 1)], structure_field[y * width + min(width - 1, x + 1)]
                else:
                    before, after = structure_field[max(0, y - 1) * width + x], structure_field[min(height - 1, y + 1) * width + x]
                if structure_field[i] >= before and structure_field[i] >= after:
                    thinned[i] = structure_field[i]
        structure_field = thinned
    weighted_structure = weighted_blur([round(value * 255) for value in structure_field], width, height, (1, 2, 1))
    structure_neighborhood = box_blur([round(value * 255) for value in structure_field], width, height, 15)
    dilated_structure = [0.0] * (width * height)
    for y in range(height):
        for x in range(width):
            dilated_structure[y * width + x] = max(
                structure_field[yy * width + xx]
                for yy in range(max(0, y - 1), min(height, y + 2))
                for xx in range(max(0, x - 1), min(width, x + 2))
            ) * .68
    stroke_field = [0.0] * (width * height)
    cell = settings["cell"]
    for y in range(cell // 2, height, cell):
        for x in range(cell // 2, width, cell):
            i = y * width + x
            shade = 1.0 - broad[i] / 255.0
            relative_dark = smoothstep(.015, .16, (scene_field[i] - broad[i]) / 255.0)
            local_structure = smoothstep(.08, .28, gradients[i] / 1020.0 + abs(medium[i] - very_broad[i]) / 255.0 * 1.5)
            density = smoothstep(.24, .90, shade) * local_structure * (.30 + .70 * relative_dark)
            if variant == "c":
                density = smoothstep(.25, .86, shade) * (.14 + .86 * relative_dark)
            if noise_byte(x // cell, y // cell, seed + 701) / 255.0 > density * (.80 if variant == "c" else (.76 if variant == "b" else .62)):
                continue
            angle = math.atan2(gy[i], gx[i]) + math.pi / 2.0 if gradients[i] > 22 else 2.08
            angle += (noise_byte(x // cell, y // cell, seed + 809) / 255.0 - .5) * (.34 if variant == "b" else .22)
            length = (12 if variant == "a" else 13) + noise_byte(x // cell, y // cell, seed + 907) / 255.0 * (12 if variant != "b" else 17)
            draw_graphite_stroke(stroke_field, width, height, x, y, angle, length, settings["stroke"] * (.72 + density * .42), 1 if variant == "b" else 0)
            if shade > .61 and noise_byte(x // cell, y // cell, seed + 1013) / 255.0 < density * (.52 if variant == "c" else .38):
                draw_graphite_stroke(stroke_field, width, height, x, y, angle + 1.16, length * .78, settings["stroke"] * .72, 0)
            if variant == "c" and structure_neighborhood[i] > 13 and noise_byte(x // cell, y // cell, seed + 1109) < 24:
                draw_graphite_stroke(stroke_field, width, height, x, y, angle, 24, .055, 0)
    output = bytearray(width * height * 3)
    for y in range(height):
        for x in range(width):
            i = y * width + x
            broad_ridge = abs(medium[i] - very_broad[i]) / 255.0
            coherence = smoothstep(.045, .19, broad_ridge * 1.5 + gradients[i] / 1020.0 * .8)
            structure = max(structure_field[i], weighted_structure[i] / 255.0 * (.42 if variant == "c" else .52))
            if variant != "c":
                structure = max(structure, dilated_structure[i])
            shade = 1.0 - broad[i] / 255.0
            local_model = .14 + .86 * smoothstep(.018, .105, broad_ridge)
            if variant == "c":
                coarse_shade = 1.0 - scene_field[i] / 255.0
                base_tone = smoothstep(.34, .82, coarse_shade) * .032
                form_tone = smoothstep(.50, .89, shade) * .023
                texture = .78 + .22 * noise_byte(x // 3, y // 3, seed + 1217) / 255.0
                tone = min(.050, base_tone + form_tone) * texture
            else:
                tone = smoothstep(settings["tone_cut"], .94, shade) * local_model
                bands = 4 if variant == "a" else 5
                tone = round(tone * bands) / bands * settings["tone_max"]
            bright_ridge = smoothstep(.17, .54, (cleaned[i] - very_broad[i]) / 255.0)
            text_band = y < height * .24 or y > height * .83
            if text_band:
                structure *= 1.0 - smoothstep(.10, .52, bright_ridge)
            fill_mark = bright_ridge * (.62 if variant == "b" else (.84 if text_band else .72))
            hatch = stroke_field[i]
            construction = max(0.0, 1.0 - abs(((x + 2 * y + seed % 31) % 71) - 35) / 1.4)
            under = smoothstep(.055, .19, broad_ridge) * (.55 + .45 * construction) * settings["under"]
            jitter = .94 + noise_byte(x // 5, y // 5, seed + 71) / 255.0 * .12
            ink = 1.0 - (1.0 - min(.96, structure * settings["line"] * jitter + fill_mark)) * (1.0 - tone) * (1.0 - hatch) * (1.0 - under)
            tooth = paper_residual[(y % 64) * 64 + x % 64] * settings["grain"]
            for channel in range(3):
                paper = max(0, min(255, round(paper_tone[channel] + tooth)))
                output[i * 3 + channel] = max(0, min(255, round(paper * (1.0 - ink) + settings["graphite"][channel] * ink)))
    return bytes(output)


def percentile(values: list[int], fraction: float) -> int:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round((len(ordered) - 1) * fraction)))]


def variant_metrics(width: int, height: int, pixels: bytes) -> dict[str, object]:
    values = luma_pixels(pixels)
    _, _, gradients = source_gradients(values, width, height)
    return {
        "q01": percentile(values, .01), "q05": percentile(values, .05), "median": percentile(values, .50), "q95": percentile(values, .95),
        "paper_pct_gte_225": round(sum(v >= 225 for v in values) * 100.0 / len(values), 3),
        "graphite_pct_lte_110": round(sum(v <= 110 for v in values) * 100.0 / len(values), 3),
        "midtone_pct_175_220": round(sum(175 <= v <= 220 for v in values) * 100.0 / len(values), 3),
        "edge_density": round(sum(v >= 92 for v in gradients) / len(gradients), 4),
    }


def blit(canvas: bytearray, canvas_width: int, source: bytes, width: int, height: int, left: int, top: int) -> None:
    for row in range(height):
        dst, src = ((top + row) * canvas_width + left) * 3, row * width * 3
        canvas[dst : dst + width * 3] = source[src : src + width * 3]


def run_bakeoff(manifest_path: Path, source_dir: Path, output_dir: Path, evidence_dir: Path) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    board_w, _, board_pixels = read_rgb_png(source_dir / manifest["sources"]["pencil"]["file"])
    paper_tone, residual = paper_residuals(board_w, board_pixels)
    metrics: dict[str, object] = {"version": BAKEOFF_VERSION, "paper_rgb": list(paper_tone), "cards": {}}
    rows: list[list[tuple[int, int, bytes]]] = []
    for card_id in ("homebase", "storyforge"):
        card = next(item for item in manifest["cards"] if item["id"] == card_id)
        p_w, p_h, approved = read_rgb_png(output_dir / card["pencil"]["output"])
        c_w, c_h, cinema = read_rgb_png(output_dir / card["cinematic"]["output"])
        seed = int(hashlib.sha256(("MX-DASH-6010B:" + card_id + ":" + hashlib.sha256(cinema).hexdigest()).encode()).hexdigest()[:8], 16)
        images = [(p_w, p_h, approved)]
        card_metrics: dict[str, object] = {"approved": variant_metrics(p_w, p_h, approved)}
        for variant in ("a", "b", "c"):
            derived = derive_bakeoff_variant(c_w, c_h, cinema, paper_tone, residual, seed, variant)
            write_rgb_png(evidence_dir / f"{card_id}-variant-{variant}.png", c_w, c_h, derived)
            images.append((c_w, c_h, derived))
            card_metrics[variant] = variant_metrics(c_w, c_h, derived)
        images.append((c_w, c_h, cinema))
        card_metrics["cinematic_sha256"] = sha256(output_dir / card["cinematic"]["output"])
        metrics["cards"][card_id] = card_metrics
        rows.append(images)
    gap, row_gap = 12, 34
    cell_w = max(image[0] for images in rows for image in images)
    cell_h = max(image[1] for images in rows for image in images)
    sheet_w, sheet_h = cell_w * 5 + gap * 6, cell_h * 2 + row_gap * 3
    sheet = bytearray((246, 242, 234) * (sheet_w * sheet_h))
    for row_index, images in enumerate(rows):
        top = row_gap + row_index * (cell_h + row_gap)
        for column, (width, height, pixels) in enumerate(images):
            left = gap + column * (cell_w + gap) + (cell_w - width) // 2
            blit(sheet, sheet_w, pixels, width, height, left, top + (cell_h - height) // 2)
    write_rgb_png(evidence_dir / "variant-contact-sheet.png", sheet_w, sheet_h, bytes(sheet))
    evidence_dir.mkdir(parents=True, exist_ok=True)
    (evidence_dir / "variant-metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2, sort_keys=True))
    print("PENCIL_BAKEOFF_PASS cards=2 variants=3 columns=approved,A,B,C,cinematic")
    return 0


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
    parser.add_argument("mode", choices=("extract", "verify", "derive", "verify-derived", "bakeoff"))
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--derived-manifest", type=Path)
    parser.add_argument("--evidence-dir", type=Path)
    args = parser.parse_args()
    if args.mode == "bakeoff":
        if args.evidence_dir is None:
            parser.error("--evidence-dir is required for bakeoff mode")
        return run_bakeoff(args.manifest, args.source_dir, args.output_dir, args.evidence_dir)
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
