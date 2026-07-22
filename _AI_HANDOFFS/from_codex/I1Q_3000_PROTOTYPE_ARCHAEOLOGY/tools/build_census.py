#!/usr/bin/env python3
"""Privacy-safe, read-only candidate census for I1Q-3000 design archaeology.

The walker records metadata and semantic hit labels only. It never emits source
snippets, and it does not read known raw/corpus/transcript/question-data zones.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


OUTPUT_ROOT = Path(
    "/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008B-SourceFactory/"
    "_AI_HANDOFFS/from_codex/I1Q_3000_PROTOTYPE_ARCHAEOLOGY"
)
EVIDENCE = OUTPUT_ROOT / "evidence"

ROOTS = [
    Path("/Users/brianb/MissionMed_AI_Sandbox"),
    Path("/Users/brianb/MissionMed_worktrees"),
    Path("/Users/brianb/MissionMed"),
    Path("/Users/brianb/MissionMed_OS"),
    Path("/Users/brianb/CLAUDE_FILES"),
    Path("/Users/brianb/Downloads"),
    Path("/Users/brianb/Desktop"),
    Path("/Users/brianb/Documents"),
]

PRUNE_NAMES = {
    ".git",
    ".svn",
    "node_modules",
    ".next",
    ".cache",
    ".venv",
    "venv",
    "vendor",
    "Pods",
    "DerivedData",
    "__pycache__",
    ".Trash",
}

# These zones may contain learner identities, raw transcripts, questions, or
# large source media. Their existence is logged but their contents are not read.
PROTECTED_DIR_NAMES = {
    "raw",
    "transcript",
    "transcripts",
    "metadata",
    "processed",
    "drop_zone",
    "_safe_backups",
    "drj_drills",
    "question transcript jsons",
    "full_transcript_master",
    "parsed-nodes",
    "occurrences",
    "gold_set",
    "gold-set",
    "restricted",
    "source_corpus",
    "_source_corpus",
    "question_database",
    "i1q-1008g_question_database",
    "i1q-1008g_question_database_quarantine",
    "i1q-1008e_restricted_full_corpus_extraction",
}

TEXT_EXTS = {
    ".html", ".htm", ".md", ".txt", ".json", ".js", ".mjs", ".cjs",
    ".jsx", ".ts", ".tsx", ".css", ".scss", ".php", ".py", ".yaml", ".yml",
}
ARTIFACT_EXTS = TEXT_EXTS | {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".docx", ".zip"}
HASH_EXTS = {".html", ".htm", ".css", ".js", ".mjs", ".jsx", ".ts", ".tsx"}
USER_ROOTS = {
    Path("/Users/brianb/Downloads"),
    Path("/Users/brianb/Desktop"),
    Path("/Users/brianb/Documents"),
}
USER_SAFE_EXTS = {".html", ".htm", ".css", ".js", ".mjs", ".jsx", ".ts", ".tsx", ".md"}

TERM_PATTERNS = {
    "i1q": re.compile(r"\bi1q(?:[-_ ]?\d+[a-z]*)?\b", re.I),
    "question_factory": re.compile(r"question\s*factory", re.I),
    "learning_studio": re.compile(r"learning\s*studio", re.I),
    "dr_j": re.compile(r"\bdr[._ -]*j\b|doctor\s+j", re.I),
    "daily_drills": re.compile(r"daily[ _-]*drills?", re.I),
    "question_ladder": re.compile(r"question[ _-]*ladder|\bladder\b", re.I),
    "question_replay": re.compile(r"question[ _-]*replay|\breplay\b", re.I),
    "rounds": re.compile(r"clinical[ _-]*rounds|grand[ _-]*rounds|\brounds\b", re.I),
    "bakeoff": re.compile(r"bake[ _-]*off", re.I),
    "assessment": re.compile(r"assessment|board[ _-]*style|qbank|question[ _-]*bank", re.I),
    "arena": re.compile(r"assessment[ _-]*arena|question[ _-]*arena|\barena\b", re.I),
    "question_flow": re.compile(r"question[ _-]*flow|student[ _-]*sequence", re.I),
    "zoom_notes": re.compile(r"zoom[ _-]*notes?|drill[ _-]*notes?", re.I),
    "usmle_comlex": re.compile(r"\busmle\b|\bcomlex\b", re.I),
    "prototype": re.compile(r"prototype|mockup|concept|candidate|gallery", re.I),
}

LAUNCH_SIGNALS = re.compile(
    r"<!doctype\s+html|<html\b|<script\b|<button\b|role=[\"'](?:button|tab|dialog)",
    re.I,
)


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00", "Z")


def term_hits(value: str) -> list[str]:
    return [name for name, pattern in TERM_PATTERNS.items() if pattern.search(value)]


def is_protected(path: Path) -> bool:
    lowered = {part.lower() for part in path.parts}
    if lowered & PROTECTED_DIR_NAMES:
        return True
    joined = str(path).lower()
    return any(
        marker in joined
        for marker in (
            "/drj_drills/raw/",
            "/drj_drills/transcripts/",
            "/working/occurrences/",
            "/working/parsed-nodes/",
        )
    )


def is_dataless(st: os.stat_result) -> bool:
    return st.st_size > 0 and getattr(st, "st_blocks", 1) == 0


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def safe_text_probe(path: Path, st: os.stat_result) -> tuple[list[str], bool, str | None]:
    if path.suffix.lower() not in TEXT_EXTS:
        return [], False, None
    if st.st_size > 2_000_000 or is_dataless(st) or is_protected(path):
        return [], False, "size_dataless_or_protected"
    try:
        data = path.read_bytes()
    except (OSError, PermissionError) as exc:
        return [], False, f"read_error:{type(exc).__name__}"
    if b"\x00" in data[:8192]:
        return [], False, "binary"
    text = data.decode("utf-8", errors="replace")
    return term_hits(text), bool(LAUNCH_SIGNALS.search(text[:250_000])), None


def walk_root(root: Path, records: list[dict], exclusions: list[dict]) -> dict:
    stats = Counter()
    if not root.exists():
        return {"root": str(root), "status": "absent"}
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            entries = list(os.scandir(current))
        except (OSError, PermissionError) as exc:
            exclusions.append({"path": str(current), "reason": f"scan_error:{type(exc).__name__}"})
            stats["scan_errors"] += 1
            continue
        for entry in entries:
            path = Path(entry.path)
            try:
                if entry.is_symlink():
                    stats["symlinks_skipped"] += 1
                    continue
                if entry.is_dir(follow_symlinks=False):
                    name_lower = entry.name.lower()
                    if path == OUTPUT_ROOT or entry.name in PRUNE_NAMES:
                        exclusions.append({"path": str(path), "reason": "technical_prune"})
                        stats["technical_prunes"] += 1
                        continue
                    if name_lower in PROTECTED_DIR_NAMES:
                        exclusions.append({"path": str(path), "reason": "protected_content_prune"})
                        stats["protected_prunes"] += 1
                        continue
                    stack.append(path)
                    stats["directories_seen"] += 1
                    continue
                if not entry.is_file(follow_symlinks=False):
                    continue
                stats["files_seen"] += 1
                suffix = path.suffix.lower()
                if root in USER_ROOTS and suffix not in USER_SAFE_EXTS:
                    continue
                path_labels = term_hits(str(path))
                if not path_labels and suffix not in TEXT_EXTS:
                    continue
                st = entry.stat(follow_symlinks=False)
                content_labels: list[str] = []
                launch_signal = False
                probe_skip = None
                if suffix in TEXT_EXTS:
                    content_labels, launch_signal, probe_skip = safe_text_probe(path, st)
                labels = sorted(set(path_labels + content_labels))
                # Require a strong semantic signal. Generic prototype/assessment alone
                # is retained only for an HTML-like launch candidate.
                strong = set(labels) - {"prototype", "assessment", "arena", "rounds", "question_replay"}
                if not labels or (not strong and suffix not in {".html", ".htm"}):
                    continue
                record = {
                    "path": str(path),
                    "root": str(root),
                    "extension": suffix,
                    "size_bytes": st.st_size,
                    "allocated_bytes": getattr(st, "st_blocks", 0) * 512,
                    "mtime_utc": iso(st.st_mtime),
                    "birthtime_utc": iso(getattr(st, "st_birthtime", st.st_ctime)),
                    "path_terms": sorted(path_labels),
                    "content_terms": sorted(content_labels),
                    "launch_signal": launch_signal,
                    "protected_content": is_protected(path),
                    "dataless": is_dataless(st),
                    "probe_skip": probe_skip,
                }
                if (
                    suffix in HASH_EXTS
                    and not record["protected_content"]
                    and not record["dataless"]
                    and st.st_size <= 10_000_000
                ):
                    try:
                        record["sha256"] = sha256(path)
                    except OSError as exc:
                        record["hash_error"] = type(exc).__name__
                records.append(record)
                stats["candidates"] += 1
            except (OSError, PermissionError) as exc:
                exclusions.append({"path": str(path), "reason": f"entry_error:{type(exc).__name__}"})
                stats["entry_errors"] += 1
    return {"root": str(root), "status": "scanned", **dict(stats)}


def git_history() -> dict:
    repo = Path("/Users/brianb/MissionMed")
    branches = [
        "origin/i1q-question-platform-ultra-1007x-ma",
        "origin/i1q-statquestions-1008a",
        "origin/i1q-statquestions-1008b-source-factory",
        "origin/i1q-statquestions-1008d-canonical-corpus-discovery",
        "origin/codex/i1q-1008f-drill-question-gold-set",
        "origin/codex/i1q-1008g-question-database-builder",
        "origin/md-daily-drills-sot-recon-004",
        "origin/md-daily-drills-nonwiring-megarun-007",
        "origin/md-daily-drills-single-html-t16-011",
        "origin/md-daily-drills-v3-side-by-side-014",
    ]
    out = []
    for branch in branches:
        proc = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", branch],
            cwd=repo,
            text=True,
            capture_output=True,
            check=False,
        )
        paths = []
        for line in proc.stdout.splitlines():
            labels = term_hits(line)
            suffix = Path(line).suffix.lower()
            if labels and suffix in ARTIFACT_EXTS:
                paths.append({"path": line, "terms": labels, "extension": suffix})
        meta = subprocess.run(
            ["git", "show", "-s", "--format=%H|%aI|%an|%s", branch],
            cwd=repo,
            text=True,
            capture_output=True,
            check=False,
        ).stdout.strip()
        out.append(
            {
                "branch": branch,
                "tip": meta,
                "status": "ok" if proc.returncode == 0 else "missing",
                "matching_paths": paths,
            }
        )
    return {"repository": str(repo), "branches": out}


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    exclusions: list[dict] = []
    coverage = [walk_root(root, records, exclusions) for root in ROOTS]
    records.sort(key=lambda row: row["path"].casefold())

    sha_groups: dict[str, list[str]] = defaultdict(list)
    for row in records:
        if digest := row.get("sha256"):
            sha_groups[digest].append(row["path"])
    duplicate_groups = [
        {"sha256": digest, "count": len(paths), "paths": paths}
        for digest, paths in sorted(sha_groups.items())
        if len(paths) > 1
    ]

    payload = {
        "schema_version": "i1q-3000-census-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "privacy_contract": "metadata and semantic hit labels only; no source snippets",
        "coverage": coverage,
        "candidate_count": len(records),
        "candidates": records,
    }
    (EVIDENCE / "filesystem_candidate_census.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (EVIDENCE / "filesystem_scan_exclusions.json").write_text(
        json.dumps(
            {
                "generated_at_utc": payload["generated_at_utc"],
                "exclusion_count": len(exclusions),
                "exclusions": exclusions,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    (EVIDENCE / "byte_duplicate_groups.json").write_text(
        json.dumps(
            {
                "generated_at_utc": payload["generated_at_utc"],
                "group_count": len(duplicate_groups),
                "groups": duplicate_groups,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    (EVIDENCE / "git_branch_candidate_census.json").write_text(
        json.dumps(git_history(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps({"coverage": coverage, "candidate_count": len(records), "duplicate_groups": len(duplicate_groups)}, indent=2))


if __name__ == "__main__":
    main()
