from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent

FIXTURES = [
    ("synthetic_profile.jpg", (720, 720), "#16566d", "#f2a13b", "PROFILE"),
    ("synthetic_story_1.png", (960, 640), "#234a35", "#ffd76a", "STORY 01"),
    ("synthetic_story_2.webp", (900, 600), "#4a315f", "#39d6ff", "STORY 02"),
    ("synthetic_program_logo.png", (800, 240), "#101623", "#ff7a3d", "PROGRAM"),
    ("synthetic_personal.png", (840, 620), "#633744", "#4ade9d", "PERSONAL"),
]


def build(name, size, background, accent, label):
    image = Image.new("RGB", size, background)
    draw = ImageDraw.Draw(image)
    width, height = size
    draw.rectangle((width * 0.06, height * 0.08, width * 0.94, height * 0.92), outline=accent, width=max(4, width // 100))
    draw.line((width * 0.08, height * 0.78, width * 0.92, height * 0.22), fill=accent, width=max(5, width // 80))
    draw.ellipse((width * 0.36, height * 0.24, width * 0.64, height * 0.66), outline="#f6efe1", width=max(4, width // 120))
    draw.text((width * 0.1, height * 0.82), label, fill="#f6efe1")
    target = ROOT / name
    options = {"quality": 90} if target.suffix.lower() in {".jpg", ".jpeg", ".webp"} else {}
    image.save(target, **options)


for fixture in FIXTURES:
    build(*fixture)

