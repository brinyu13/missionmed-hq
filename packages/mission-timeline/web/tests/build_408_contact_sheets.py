#!/usr/bin/env python3
"""Build labeled D1-408 visual evidence sheets from Playwright screenshots."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


EVIDENCE = Path("/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/408")
BG = (9, 14, 24)
PANEL = (18, 27, 43)
TEXT = (226, 235, 247)
MUTED = (132, 151, 180)
ACCENT = (255, 112, 42)


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def sheet(name: str, title: str, items: list[tuple[str, str]], columns: int = 2, cell_width: int = 720, cell_height: int = 500):
    rows = (len(items) + columns - 1) // columns
    gap = 18
    header = 72
    canvas = Image.new("RGB", (columns * cell_width + (columns + 1) * gap, header + rows * cell_height + (rows + 1) * gap), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((gap, 18), title, fill=TEXT, font=font(24, True))
    draw.text((gap, 47), "D1-408 - synthetic fixtures only - local browser evidence", fill=MUTED, font=font(11))
    for index, (label, filename) in enumerate(items):
        row, column = divmod(index, columns)
        x = gap + column * (cell_width + gap)
        y = header + gap + row * (cell_height + gap)
        draw.rounded_rectangle((x, y, x + cell_width, y + cell_height), radius=6, fill=PANEL, outline=(49, 67, 93))
        source = Image.open(EVIDENCE / filename).convert("RGB")
        max_width, max_height = cell_width - 18, cell_height - 54
        source.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        image_x = x + (cell_width - source.width) // 2
        image_y = y + 38 + (max_height - source.height) // 2
        canvas.paste(source, (image_x, image_y))
        draw.rectangle((x + 9, y + 9, x + 15, y + 27), fill=ACCENT)
        draw.text((x + 23, y + 10), label, fill=TEXT, font=font(13, True))
    output = EVIDENCE / name
    canvas.save(output, quality=94)
    return output


def main():
    sheet(
        "intake_review_contact_sheet_408.png",
        "D1-408 Local Document Intake And Review",
        [
            ("Pre-408 simulated Upload", "before_upload_simulated_407.png"),
            ("408 Intake empty", "intake_empty_408.png"),
            ("408 native PDF processing", "intake_processing_408.png"),
            ("Source type correction", "intake_source_type_correction_408.png"),
            ("408 Extraction Review", "extraction_review_populated_408.png"),
            ("Provenance drawer", "provenance_drawer_408.png"),
            ("Accepted candidates on canvas", "accepted_candidates_canvas_408.png"),
            ("OCR required", "ocr_required_408.png"),
            ("Corrupted PDF recovery", "corrupted_pdf_state_408.png"),
        ],
    )
    sheet(
        "candidate_state_contact_sheet_408.png",
        "D1-408 Candidate Review States",
        [
            ("Duplicate group", "duplicate_card_408.png"),
            ("Date conflict", "conflict_card_408.png"),
            ("Privacy review", "privacy_card_408.png"),
            ("Dense 18-page CV", "dense_candidate_list_408.png"),
        ],
    )
    sheet(
        "responsive_contact_sheet_408.png",
        "D1-408 Responsive Extraction Review",
        [
            ("1280 x 800", "responsive_review_1280x800_408.png"),
            ("1440 x 900", "responsive_review_1440x900_408.png"),
            ("1728 x 1117", "responsive_review_1728x1117_408.png"),
            ("1920 x 1080", "responsive_review_1920x1080_408.png"),
            ("2560 x 1440", "responsive_review_2560x1440_408.png"),
            ("900 x 1100 constrained", "responsive_review_900x1100_408.png"),
        ],
    )
    sheet(
        "before_after_ingestion_408.png",
        "D1-408 Before And After",
        [
            ("Before: simulated Upload", "before_upload_simulated_407.png"),
            ("After: real local Intake", "intake_empty_408.png"),
            ("After: quarantined Review", "extraction_review_populated_408.png"),
            ("After: exact provenance", "provenance_drawer_408.png"),
        ],
    )


if __name__ == "__main__":
    main()
