#!/usr/bin/env python3
"""MX-DASH-6021 popup aspect-ratio regression checks."""

from pathlib import Path
import re
import struct
import unittest


ROOT = Path(__file__).resolve().parents[5]
ASSETS = ROOT / "wp-content/plugins/missionmed-hub/assets/dashboard-v2"
CSS = ASSETS / "mmed-dashboard-v2.6010b-true-morph.css"
CINEMATIC = ASSETS / "locked-art/founder-approved/cinematic"
EXPECTED = (
    "homebase-cinematic-approved.png",
    "calendar-cinematic-approved.png",
    "scheduler-cinematic-approved.png",
    "storyforge-cinematic-approved.png",
    "iv-prep-on-call-cinematic-approved.png",
    "rise-cinematic-approved.png",
    "ranklist-iq-cinematic-approved.png",
    "lor-studio-cinematic-approved.png",
)


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise AssertionError(f"not a PNG with an IHDR header: {path}")
    return struct.unpack(">II", data[16:24])


class PopupAspectRatioTests(unittest.TestCase):
    def test_shared_locked_detail_rule_contains_and_centers_foreground(self):
        css = CSS.read_text(encoding="utf-8")
        match = re.search(r"\.mmdv2-locked-detail img\{([^}]*)\}", css)
        self.assertIsNotNone(match)
        declarations = match.group(1)
        self.assertIn("object-fit:contain", declarations)
        self.assertIn("object-position:center center", declarations)
        self.assertNotIn("object-fit:fill", declarations)
        self.assertIn("-webkit-mask-image:none", declarations)
        self.assertIn("mask-image:none", declarations)

    def test_all_eight_approved_cinematic_sources_have_intrinsic_ratios(self):
        observed = {}
        for name in EXPECTED:
            path = CINEMATIC / name
            self.assertTrue(path.is_file(), name)
            width, height = png_dimensions(path)
            self.assertGreater(width, 0, name)
            self.assertGreater(height, 0, name)
            observed[name] = round(width / height, 6)
        self.assertEqual(len(observed), 8)
        self.assertEqual(len(set(observed.values())), 8)
        self.assertTrue(all(0.89 < ratio < 0.94 for ratio in observed.values()))


if __name__ == "__main__":
    unittest.main()
