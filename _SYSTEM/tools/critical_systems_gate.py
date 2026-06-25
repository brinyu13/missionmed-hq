#!/usr/bin/env python3
"""Report-only critical systems gate for MissionMed protected routes/assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "_SYSTEM" / "CRITICAL_SYSTEMS_MANIFEST.json"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def run(cmd: list[str], cwd: Path = ROOT) -> tuple[int, str]:
    proc = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def load_manifest(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def result(results: list[dict], level: str, check: str, message: str, details: dict | None = None) -> None:
    results.append({
        "level": level,
        "check": check,
        "message": message,
        "details": details or {},
    })


def check_protected_paths(manifest: dict, results: list[dict]) -> None:
    for item in manifest.get("protected_paths", []):
        path = ROOT / item
        if not path.exists():
            result(results, "FAIL", "protected_path_exists", f"Missing protected path: {item}")
            continue

        code, output = run(["git", "ls-files", "--error-unmatch", item])
        if code != 0:
            result(results, "FAIL", "protected_path_tracked", f"Protected path is not tracked: {item}", {"git": output})
            continue

        code, output = run(["git", "status", "--short", "--", item])
        if output:
            result(results, "WARN", "protected_path_dirty", f"Protected path has uncommitted changes: {item}", {"git": output})
        else:
            result(results, "PASS", "protected_path_clean", f"Tracked and clean: {item}")


def parse_node_start_file(command: str) -> Path | None:
    parts = command.split()
    if len(parts) >= 2 and parts[0] == "node":
        return ROOT / parts[1]
    return None


def resolve_import_path(source: Path, specifier: str) -> Path | None:
    if not specifier.startswith("."):
        return None

    base = (source.parent / specifier).resolve()
    candidates = [base]
    if base.suffix == "":
        candidates.extend([
            base.with_suffix(".mjs"),
            base.with_suffix(".js"),
            base / "index.mjs",
            base / "index.js",
        ])
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return base


def check_imports(start_file: Path, results: list[dict]) -> None:
    seen: set[Path] = set()
    pending = [start_file.resolve()]
    import_re = re.compile(r"^\s*import\s+(?:[^'\";]+?\s+from\s+)?['\"]([^'\"]+)['\"]", re.MULTILINE)

    while pending:
        source = pending.pop()
        if source in seen or not source.exists() or source.suffix not in {".mjs", ".js"}:
            continue
        seen.add(source)

        try:
            text = source.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = source.read_text(errors="ignore")

        for specifier in import_re.findall(text):
            resolved = resolve_import_path(source, specifier)
            if resolved is None:
                continue
            if not resolved.exists():
                result(results, "FAIL", "relative_import_exists", f"Missing relative import {specifier} from {rel(source)}", {"resolved": rel(resolved)})
                continue
            if resolved.suffix in {".mjs", ".js"} and resolved.resolve() not in seen:
                pending.append(resolved.resolve())

    result(results, "PASS", "relative_import_scan", f"Scanned {len(seen)} local JS/MJS files for relative imports")


def check_runtime_owners(manifest: dict, results: list[dict]) -> None:
    for owner_id, owner in manifest.get("runtime_owners", {}).items():
        command = str(owner.get("start_command", "")).strip()
        start_file = parse_node_start_file(command)
        if not start_file:
            result(results, "WARN", "runtime_start_command", f"{owner_id} has unsupported start command: {command}")
            continue
        if not start_file.exists():
            result(results, "FAIL", "runtime_start_file", f"Start file missing for {owner_id}: {rel(start_file)}")
            continue

        code, output = run(["node", "--check", str(start_file)])
        if code == 0:
            result(results, "PASS", "node_check", f"node --check passed for {rel(start_file)}")
        else:
            result(results, "FAIL", "node_check", f"node --check failed for {rel(start_file)}", {"output": output})

        check_imports(start_file, results)


def fetch(url: str, method: str = "GET", headers: dict | None = None, timeout: int = 20) -> tuple[int, dict, bytes]:
    request_headers = {
        "User-Agent": "MissionMedCriticalSystemsGate/1.0 (+https://missionmedinstitute.com)",
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        **(headers or {}),
    }
    request = urllib.request.Request(url, method=method, headers=request_headers)
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.status, {k.lower(): v for k, v in response.headers.items()}, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, {k.lower(): v for k, v in exc.headers.items()}, exc.read()


def check_routes(manifest: dict, results: list[dict]) -> None:
    for check in manifest.get("route_checks", []):
        check_id = check.get("id", "(unnamed)")
        status, headers, body = fetch(
            check["url"],
            method=check.get("method", "GET"),
            headers=check.get("headers", {}),
        )
        expected = int(check.get("expected_status", 0))
        forbidden = set(int(value) for value in check.get("must_not_status", []))
        body_text = body.decode("utf-8", errors="ignore")

        if status in forbidden:
            result(results, "FAIL", "route_status", f"{check_id} returned forbidden status {status}", {"url": check["url"]})
            continue
        if expected and status != expected:
            result(results, "FAIL", "route_status", f"{check_id} expected {expected}, got {status}", {"url": check["url"]})
            continue

        missing_headers = []
        for header, value in check.get("expected_headers", {}).items():
            actual = headers.get(header.lower())
            if actual != value:
                missing_headers.append({"header": header, "expected": value, "actual": actual})

        for header, value in check.get("expected_headers_contains", {}).items():
            actual = headers.get(header.lower(), "")
            if value not in actual:
                missing_headers.append({"header": header, "expected_contains": value, "actual": actual})

        if missing_headers:
            result(results, "FAIL", "route_headers", f"{check_id} header expectation failed", {"headers": missing_headers})
            continue

        marker = check.get("body_contains")
        if marker and marker not in body_text:
            result(results, "FAIL", "route_body", f"{check_id} missing body marker", {"marker": marker})
            continue

        result(results, "PASS", "route", f"{check_id} passed with status {status}")


def check_assets(manifest: dict, results: list[dict]) -> None:
    for asset in manifest.get("asset_checks", []):
        asset_id = asset.get("id", "(unnamed)")
        status, _headers, body = fetch(asset["url"])
        if status != 200:
            result(results, "FAIL", "asset_fetch", f"{asset_id} expected 200, got {status}", {"url": asset["url"]})
            continue

        digest = hashlib.sha256(body).hexdigest()
        expected = str(asset.get("approved_sha256", "")).strip()
        if expected and digest != expected:
            result(results, "FAIL", "asset_hash", f"{asset_id} SHA256 mismatch", {"expected": expected, "actual": digest})
            continue

        text = body.decode("utf-8", errors="ignore")
        missing = [marker for marker in asset.get("required_markers", []) if marker not in text]
        if missing:
            result(results, "FAIL", "asset_markers", f"{asset_id} missing required markers", {"missing": missing})
            continue

        result(results, "PASS", "asset", f"{asset_id} passed SHA256 and marker checks", {"sha256": digest})


def print_results(results: list[dict], as_json: bool) -> None:
    if as_json:
        print(json.dumps(results, indent=2, sort_keys=True))
        return
    for item in results:
        print(f"{item['level']:4} {item['check']}: {item['message']}")
        if item.get("details"):
            print(f"     {json.dumps(item['details'], sort_keys=True)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="MissionMed critical systems report-only gate.")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--skip-network", action="store_true", help="Skip route and asset HTTP checks.")
    parser.add_argument("--json", action="store_true", help="Print JSON results.")
    parser.add_argument("--enforce", action="store_true", help="Exit non-zero on FAIL results.")
    args = parser.parse_args()

    results: list[dict] = []
    manifest = load_manifest(Path(args.manifest))

    check_protected_paths(manifest, results)
    check_runtime_owners(manifest, results)
    if args.skip_network:
        result(results, "WARN", "network", "Network checks skipped by flag")
    else:
        check_routes(manifest, results)
        check_assets(manifest, results)

    skipped_browser = len(manifest.get("browser_journeys", []))
    if skipped_browser:
        result(results, "WARN", "browser_journeys", f"{skipped_browser} browser journeys require Browser/Playwright validation outside this report-only script")

    print_results(results, args.json)
    if args.enforce and any(item["level"] == "FAIL" for item in results):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
