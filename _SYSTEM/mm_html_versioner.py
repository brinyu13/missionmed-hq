#!/usr/bin/env python3
"""
mm_html_versioner.py
MissionMed HTML Deployment Versioner

Authority: MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001
Status: LOCKED - PERMANENT
Scope: arena.html, drills.html, ranklistiq.html (single-file HTML applications)

Function:
  1. Loads the current production HTML file
  2. Creates a timestamped backup copy ({system}_BACKUP_YYYY-MM-DD_HHMM.html)
  3. Inserts or updates a versioning header comment at the top of the file
  4. Writes the updated file in-place, ready for upload to WordPress Media Library

Usage:
  python3 mm_html_versioner.py arena.html
  python3 mm_html_versioner.py drills.html
  python3 mm_html_versioner.py ranklistiq.html
  python3 mm_html_versioner.py arena.html "Fix lobby avatar scaling"
  python3 mm_html_versioner.py /absolute/path/to/arena.html "Change note"

Rules enforced:
  - NEVER recreate from scratch - file must exist
  - Backup is created BEFORE any modification
  - Version header is placed at the very top of the file
  - Full file is preserved (no truncation, no "rest unchanged")
"""

from __future__ import annotations

import os
import re
import sys
import shutil
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# Canonical system registry - the ONLY files this tool is allowed to version
# ---------------------------------------------------------------------------
CANONICAL_SYSTEMS = {
    "arena.html":      "ARENA",
    "drills.html":     "DRILLS",
    "ranklistiq.html": "RANKLISTIQ",
}

# Existing version header block (inserted/updated by this script)
VERSION_HEADER_RE = re.compile(
    r"<!--\s*\n\s*SYSTEM:\s*(ARENA|DRILLS|RANKLISTIQ).*?-->\s*\n?",
    re.DOTALL | re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def fail(msg: str, code: int = 1) -> None:
    print(f"[mm_html_versioner] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def log(msg: str) -> None:
    print(f"[mm_html_versioner] {msg}")


def resolve_system(path: Path) -> str:
    """Return the canonical SYSTEM tag (ARENA/DRILLS/RANKLISTIQ)."""
    name = path.name.lower()
    if name not in CANONICAL_SYSTEMS:
        fail(
            f"'{name}' is not a canonical system file. "
            f"Allowed: {', '.join(CANONICAL_SYSTEMS.keys())}"
        )
    return CANONICAL_SYSTEMS[name]


def make_backup(path: Path) -> Path:
    """Create a timestamped backup in the same directory as the source file."""
    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    system_stub = path.stem  # arena / drills / ranklistiq
    backup_name = f"{system_stub}_BACKUP_{ts}.html"
    backup_path = path.with_name(backup_name)

    # If a backup with the same minute already exists, append seconds
    if backup_path.exists():
        ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        backup_name = f"{system_stub}_BACKUP_{ts}.html"
        backup_path = path.with_name(backup_name)

    shutil.copy2(path, backup_path)
    log(f"Backup created: {backup_path.name}")
    return backup_path


def build_version_header(system: str, change: str) -> str:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    return (
        "<!--\n"
        f"SYSTEM: {system}\n"
        f"VERSION: {ts}\n"
        f"CHANGE: {change}\n"
        "AUTHORITY: MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001\n"
        "SOURCE OF TRUTH: This file. Do NOT edit in Elementor or WordPress.\n"
        "-->\n"
    )


def update_version_header(content: str, system: str, change: str) -> str:
    """Insert or replace the version header at the top of the file."""
    new_header = build_version_header(system, change)

    # If an existing versioner block is present, replace the first occurrence.
    if VERSION_HEADER_RE.search(content):
        content = VERSION_HEADER_RE.sub(new_header, content, count=1)
        return content

    # Otherwise, prepend. Preserve DOCTYPE if present so browsers still parse
    # in standards mode.
    stripped = content.lstrip()
    if stripped.lower().startswith("<!doctype"):
        # Find end of DOCTYPE line
        end = content.find(">", content.lower().find("<!doctype")) + 1
        doctype = content[:end]
        rest = content[end:]
        if not rest.startswith("\n"):
            rest = "\n" + rest
        return f"{doctype}\n{new_header}{rest.lstrip(chr(10))}"

    return new_header + content


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        fail("Missing required argument: target HTML file", code=2)

    target_arg = argv[1]
    change_note = argv[2] if len(argv) > 2 else "Routine production update"

    target = Path(target_arg).expanduser()
    if not target.is_absolute():
        target = Path.cwd() / target
    target = target.resolve()

    if not target.exists():
        fail(f"File does not exist: {target}")
    if not target.is_file():
        fail(f"Target is not a file: {target}")

    system = resolve_system(target)
    log(f"Target file      : {target}")
    log(f"System           : {system}")
    log(f"Change note      : {change_note}")

    # Step 1: Backup BEFORE any modification
    backup_path = make_backup(target)

    # Step 2: Read current contents
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = target.read_text(encoding="latin-1")

    original_len = len(content)

    # Step 3: Insert or update the version header
    updated = update_version_header(content, system, change_note)

    # Step 4: Safety check - NEVER allow catastrophic content loss.
    # The only delta should come from adding or replacing the header block.
    # An existing header can be up to ~2000 bytes (very large change notes),
    # so we allow shrinkage up to 2000 bytes. Anything more is suspicious.
    MAX_HEADER_DELTA = 2000
    if len(updated) < original_len - MAX_HEADER_DELTA:
        # Undo: restore from backup
        shutil.copy2(backup_path, target)
        fail(
            "Safety abort: updated file shrank unexpectedly "
            f"(delta={original_len - len(updated)} bytes). "
            f"Restored from backup {backup_path.name}"
        )

    # Step 5: Write back to the same path (production file ready for upload)
    target.write_text(updated, encoding="utf-8")

    log(f"Version header   : updated")
    log(f"File written     : {target.name}")
    log(f"Size before      : {original_len} bytes")
    log(f"Size after       : {len(updated)} bytes")
    log("")
    log("DEPLOYMENT INSTRUCTIONS:")
    log("  1) Upload the updated HTML to WordPress Media Library")
    log("  2) Replace the existing file (same filename)")
    log("  3) Clear CDN/browser cache if needed")
    log("")
    log("STATUS: OK - production file is ready for upload.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
