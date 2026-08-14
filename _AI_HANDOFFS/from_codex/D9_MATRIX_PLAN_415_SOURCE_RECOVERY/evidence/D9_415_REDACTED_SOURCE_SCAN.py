#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

HIGH_RULES = {
    "private_key_marker": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----", re.I),
    "aws_access_key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "stripe_secret_key": re.compile(r"\b(?:sk_(?:live|test)|rk_live)_[A-Za-z0-9]{16,}\b"),
    "github_token": re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
    "slack_token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    "google_api_key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    "basic_auth_url": re.compile(r"https?://[^\s/:@]+:[^\s/@]+@", re.I),
}

CREDENTIAL_LITERAL = re.compile(
    r"(?ix)\b(?P<name>api[_-]?key|client[_-]?secret|webhook[_-]?secret|"
    r"signing[_-]?secret|private[_-]?key|password|passwd|access[_-]?token|"
    r"refresh[_-]?token|auth[_-]?token)\b\s*(?:=>|=|:)\s*"
    r"(?P<q>['\"])(?P<value>[^'\"\r\n]{8,})(?P=q)"
)
EMAIL = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
DATA_LITERAL = re.compile(
    r"(?ix)\b(?P<name>student[_-]?id|user[_-]?email|student[_-]?email|"
    r"patient[_-]?id|first[_-]?name|last[_-]?name)\b\s*(?:=>|=|:)\s*"
    r"(?P<q>['\"])(?P<value>[^'\"\r\n]{2,})(?P=q)"
)
STRING_LITERAL = re.compile(r"(?s)(?P<q>['\"])(?P<value>(?:\\.|(?!\1).)*?)(?P=q)")
TOKENISH = re.compile(r"^[A-Za-z0-9+/_=.-]{24,256}$")
FORBIDDEN_SUFFIXES = {".env", ".pem", ".key", ".p12", ".pfx", ".sql", ".db", ".sqlite", ".csv", ".log", ".session"}


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="surrogatepass")).hexdigest()


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def entropy(value: str) -> float:
    counts = Counter(value)
    length = len(value)
    return -sum((count / length) * math.log2(count / length) for count in counts.values())


def character_classes(value: str) -> int:
    return sum(
        bool(pattern.search(value))
        for pattern in (re.compile(r"[a-z]"), re.compile(r"[A-Z]"), re.compile(r"[0-9]"), re.compile(r"[^A-Za-z0-9]"))
    )


def main() -> int:
    if len(sys.argv) < 3:
        raise SystemExit("usage: scanner ROOT RELATIVE_PATH [RELATIVE_PATH ...]")
    root = Path(sys.argv[1]).resolve()
    requested = [Path(item) for item in sys.argv[2:]]
    files: list[Path] = []
    for item in requested:
        path = (root / item).resolve()
        if root not in path.parents and path != root:
            raise ValueError("scan path escapes root")
        if path.is_dir():
            files.extend(candidate for candidate in path.rglob("*") if candidate.is_file() and not candidate.is_symlink())
        elif path.is_file() and not path.is_symlink():
            files.append(path)
        else:
            raise FileNotFoundError(item)
    files = sorted(set(files))
    result: dict[str, object] = {
        "schema_version": "1.0",
        "root": "sealed_forensic_snapshot/wp-content",
        "scanned_file_count": len(files),
        "scanned_byte_count": sum(path.stat().st_size for path in files),
        "binary_file_count": 0,
        "forbidden_filename_candidates": [],
        "high_confidence_candidates": [],
        "credential_literal_candidates": [],
        "entropy_review_candidates": [],
        "email_literal_candidates": [],
        "private_data_literal_candidates": [],
    }
    seen_entropy: set[tuple[str, str]] = set()
    for path in files:
        rel = path.relative_to(root).as_posix()
        lower_name = path.name.lower()
        if any(lower_name.endswith(suffix) for suffix in FORBIDDEN_SUFFIXES) or any(term in lower_name for term in ("credential", "secret", "session")):
            result["forbidden_filename_candidates"].append({"path": rel})  # type: ignore[index]
        raw = path.read_bytes()
        binary = False
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            binary = True
            result["binary_file_count"] = int(result["binary_file_count"]) + 1
            # Secret markers and email addresses are ASCII, so a Latin-1 view
            # safely preserves byte offsets without emitting binary content.
            text = raw.decode("latin-1")
        for rule, pattern in HIGH_RULES.items():
            for match in pattern.finditer(text):
                value = match.group(0)
                result["high_confidence_candidates"].append(  # type: ignore[index]
                    {"path": rel, "line": line_number(text, match.start()), "rule": rule, "length": len(value), "sha256": fingerprint(value)}
                )
        if binary:
            continue
        for match in CREDENTIAL_LITERAL.finditer(text):
            value = match.group("value")
            placeholder_like = bool(re.search(r"(?i)(placeholder|replace[_ -]?me|your[_ -]?|example|dummy|xxxx|changeme|not[_ -]?set)", value))
            result["credential_literal_candidates"].append(  # type: ignore[index]
                {"path": rel, "line": line_number(text, match.start()), "identifier": match.group("name"), "length": len(value), "sha256": fingerprint(value), "placeholder_like": placeholder_like}
            )
        for match in EMAIL.finditer(text):
            value = match.group(0)
            local = value.split("@", 1)[0].lower()
            role_address = local in {"admin", "billing", "contact", "help", "info", "noreply", "privacy", "security", "support"}
            result["email_literal_candidates"].append(  # type: ignore[index]
                {"path": rel, "line": line_number(text, match.start()), "length": len(value), "sha256": fingerprint(value), "role_address": role_address}
            )
        for match in DATA_LITERAL.finditer(text):
            value = match.group("value")
            result["private_data_literal_candidates"].append(  # type: ignore[index]
                {"path": rel, "line": line_number(text, match.start()), "identifier": match.group("name"), "length": len(value), "sha256": fingerprint(value)}
            )
        for match in STRING_LITERAL.finditer(text):
            value = match.group("value")
            if not TOKENISH.fullmatch(value):
                continue
            if value.startswith(("http://", "https://")):
                continue
            if re.fullmatch(r"[0-9a-fA-F]{32,64}", value):
                continue
            score = entropy(value)
            if score < 4.25 or character_classes(value) < 3:
                continue
            key = (rel, fingerprint(value))
            if key in seen_entropy:
                continue
            seen_entropy.add(key)
            result["entropy_review_candidates"].append(  # type: ignore[index]
                {"path": rel, "line": line_number(text, match.start()), "length": len(value), "entropy": round(score, 3), "sha256": key[1]}
            )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
