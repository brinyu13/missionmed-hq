import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).parents[2] / "scripts" / "provision-01" / "provision01.py"
SPEC = importlib.util.spec_from_file_location("provision01", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def test_normalize_name_is_exact_and_accent_insensitive():
    assert MODULE.normalize_name(" Dr. José  Ng ") == "drjoseng"


def test_split_emails_accepts_only_individual_valid_addresses():
    assert MODULE.split_emails("A@Example.com; bad ; b@example.org") == [
        "a@example.com",
        "b@example.org",
    ]


def test_username_progression_and_collision_are_deterministic():
    occupied = {"johnb", "johnbr", "johnbri", "johnbrig"}
    assert MODULE.username_for("john", "brig", occupied) == "JohnBrig2"


def test_mask_email_preserves_only_first_character_and_domain():
    assert MODULE.mask_email("sample@example.com") == "s***@example.com"
