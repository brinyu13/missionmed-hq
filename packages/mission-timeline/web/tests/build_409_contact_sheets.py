from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE")
EVIDENCE = ROOT / "evidence/409"


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def contact_sheet(filename: str, title: str, items, columns: int = 2, cell=(840, 520)):
    margin, gap, title_h, label_h = 36, 24, 74, 42
    rows = (len(items) + columns - 1) // columns
    width = margin * 2 + columns * cell[0] + (columns - 1) * gap
    height = title_h + margin + rows * (cell[1] + label_h) + max(0, rows - 1) * gap + margin
    sheet = Image.new("RGB", (width, height), "#090e18")
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, 24), title, fill="#f1f5ff", font=font(30, True))
    for index, (label, source) in enumerate(items):
        row, col = divmod(index, columns)
        x = margin + col * (cell[0] + gap)
        y = title_h + row * (cell[1] + label_h + gap)
        draw.rounded_rectangle((x, y, x + cell[0], y + cell[1]), radius=6, fill="#111a2a", outline="#263856", width=2)
        image = Image.open(EVIDENCE / source).convert("RGB")
        image.thumbnail((cell[0] - 12, cell[1] - 12), Image.Resampling.LANCZOS)
        ix, iy = x + (cell[0] - image.width) // 2, y + (cell[1] - image.height) // 2
        sheet.paste(image, (ix, iy))
        draw.text((x + 4, y + cell[1] + 10), label, fill="#ffb340", font=font(18, True))
    sheet.save(EVIDENCE / filename, optimize=True)


contact_sheet(
    "core_workflows_contact_sheet_409.png",
    "D1-409 Core Local Workflows",
    [
        ("Persisted reload", "persisted_draft_reload_409.png"),
        ("Crash recovery", "crash_recovery_409.png"),
        ("Media editor", "media_editor_modal_409.png"),
        ("Advisor changes requested", "advisor_changes_requested_409.png"),
        ("Advisor approved", "advisor_approved_scoped_409.png"),
        ("Version comparison", "version_comparison_409.png"),
        ("Migration warning", "migration_warning_409.png"),
        ("Deletion preview", "entire_draft_delete_preview_409.png"),
    ],
)

contact_sheet(
    "filevault_states_contact_sheet_409.png",
    "D1-409 Mock FileVault Bridge States",
    [
        ("Disabled and mock-only", "filevault_mock_status_409.png"),
        ("Legacy only", "filevault_legacy_only_409.png"),
        ("V2 only", "filevault_v2_only_409.png"),
        ("Dual write synchronized", "filevault_dual_sync_success_409.png"),
        ("Dual write partial failure", "filevault_partial_sync_failure_409.png"),
    ],
)

contact_sheet(
    "responsive_contact_sheet_409.png",
    "D1-409 Responsive and Zoom Evidence",
    [
        ("1280 x 800 Command", "empty_command_1280x800_409.png"),
        ("1440 x 900 Media", "media_1440x900_409.png"),
        ("1728 x 1117 Advisor", "advisor_1728x1117_409.png"),
        ("1920 x 1080 Export", "export_1920x1080_409.png"),
        ("2560 x 1440 Dense canvas", "dense_canvas_2560x1440_409.png"),
        ("900 x 1100 Versions", "versions_900x1100_409.png"),
        ("768 x 1024 Review", "review_768x1024_409.png"),
        ("200 percent zoom", "zoom_200_versions_409.png"),
    ],
)

contact_sheet(
    "export_previews_contact_sheet_409.png",
    "D1-409 Real Local Export Previews",
    [
        ("Interviewer-safe PNG 1920 x 1080", "exports/interviewer_safe_1920x1080_409.png"),
        ("Full-story PNG 1920 x 1080", "exports/full_story_1920x1080_409.png"),
        ("Interviewer-safe PNG 2560 x 1440", "exports/interviewer_safe_2560x1440_409.png"),
    ],
)

print("Created 4 D1-409 contact sheets")
