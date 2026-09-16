#!/usr/bin/env python3
"""MissionMed Matrix runtime lock guard.

This tool prevents protected Matrix runtime assets from being edited or deployed
from stale worktrees without an explicit Brian override. It also performs guarded
Kinsta backups/uploads for scoped Matrix runtime assets.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request


ROOT = Path("/Users/brianb/MissionMed")
DEFAULT_MANIFEST = ROOT / "_SYSTEM" / "KNOWN_GOOD" / "MATRIX_RUNTIME_LOCK_MANIFEST.json"
DEFAULT_REPORT_DIR = ROOT / "_SYSTEM_REPORTS"
STALE_WARNING = "WARNING: You are about to work from an old Matrix runtime version. Do not edit or deploy without Brian approval."


class GuardError(RuntimeError):
    pass


def utc_stamp() -> str:
    return _dt.datetime.now(_dt.UTC).strftime("%Y%m%dT%H%M%SZ")


def read_manifest(path: Path) -> dict:
    if not path.exists():
        raise GuardError(f"Manifest missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def selected_assets(manifest: dict, spec: str) -> dict:
    assets = manifest.get("assets", {})
    if spec == "all":
        return assets
    keys = [item.strip() for item in spec.split(",") if item.strip()]
    missing = [key for key in keys if key not in assets]
    if missing:
        raise GuardError(f"Unknown Matrix asset key(s): {', '.join(missing)}")
    return {key: assets[key] for key in keys}


def sha256_path(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str], *, capture: bool = True) -> str:
    proc = subprocess.run(cmd, text=True, capture_output=capture, check=False)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise GuardError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{err}")
    return (proc.stdout or "").strip()


def ssh(alias: str, command: str) -> str:
    return run(["ssh", alias, command])


def remote_sha(manifest: dict, asset: dict) -> str:
    prod = manifest["production"]
    alias = prod["ssh_alias"]
    root = prod["plugin_root"]
    remote_path = f"{root}/{asset['production_path']}"
    out = ssh(alias, f"shasum -a 256 {shell_quote(remote_path)}")
    return out.split()[0]


def remote_version(manifest: dict, asset: dict) -> str:
    prod = manifest["production"]
    alias = prod["ssh_alias"]
    root = prod["plugin_root"]
    remote_path = f"{root}/{asset['production_path']}"
    return ssh(alias, f"stat -c %Y {shell_quote(remote_path)}").strip()


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def public_sha(asset: dict, version_hint: str | None = None) -> str | None:
	url = asset.get("public_url")
	if not url:
		return None
	version = version_hint or asset.get("approved_version") or "matrix-guard"
	sep = "&" if "?" in url else "?"
	fetch_url = f"{url}{sep}ver={version}&matrix_guard_cb={utc_stamp()}"
	request = urllib.request.Request(
		fetch_url,
		headers={
			"Accept": "*/*",
			"User-Agent": "MissionMed-Matrix-Runtime-Guard/1.0",
		},
	)
	with urllib.request.urlopen(request, timeout=20) as response:
		data = response.read()
	return hashlib.sha256(data).hexdigest()


def local_path(worktree: Path, asset: dict) -> Path:
    return worktree / asset["source_path"]


def print_asset_row(key: str, asset: dict, local: str | None, remote: str | None, public: str | None) -> None:
    approved = asset.get("approved_sha256")
    print(f"\n[{key}] {asset.get('app')} :: {asset.get('role')}")
    print(f"  approved: {approved}")
    if local is not None:
        print(f"  local:    {local}")
    if remote is not None:
        print(f"  origin:   {remote}")
    if public is not None:
        print(f"  public:   {public}")


def preflight(args: argparse.Namespace) -> int:
    manifest = read_manifest(Path(args.manifest))
    worktree = Path(args.worktree).resolve()
    assets = selected_assets(manifest, args.assets)
    failures: list[str] = []
    warnings: list[str] = []

    print("MATRIX RUNTIME LOCK PREFLIGHT")
    print(f"manifest: {args.manifest}")
    print(f"worktree: {worktree}")

    for key, asset in assets.items():
        approved = asset.get("approved_sha256")
        lp = local_path(worktree, asset)
        local = None
        remote = None
        pub = None

        if not lp.exists():
            failures.append(f"{key}: missing local source {lp}")
        else:
            local = sha256_path(lp)
            if approved and local != approved:
                warnings.append(f"{key}: local source hash differs from approved lock")

        if not args.skip_production:
            try:
                remote = remote_sha(manifest, asset)
                if approved and remote != approved:
                    failures.append(f"{key}: production origin hash differs from approved lock")
            except GuardError as exc:
                failures.append(f"{key}: production origin check failed: {exc}")

        if args.verify_public and asset.get("public_url"):
            try:
                pub = public_sha(asset)
                if approved and pub != approved:
                    failures.append(f"{key}: public cache-busted hash differs from approved lock")
            except Exception as exc:  # noqa: BLE001 - print exact guard failure
                failures.append(f"{key}: public cache-busted check failed: {exc}")

        print_asset_row(key, asset, local, remote, pub)

    if warnings:
        print("\n" + STALE_WARNING)
        for item in warnings:
            print(f"  - {item}")

    if failures:
        print("\nBLOCKED:")
        for item in failures:
            print(f"  - {item}")

    if (warnings or failures) and not args.brian_approved:
        print("\nRequired override phrase:")
        print("Brian explicitly approves Matrix runtime lock override for <ticket> and <asset keys>.")
        return 42

    if warnings or failures:
        print("\nOverride accepted by --brian-approved. Proceed only if Brian explicitly approved this exact drift.")
    else:
        print("\nPASS: local/source, production origin, and requested public checks match the Matrix runtime lock.")
    return 0


def list_assets(args: argparse.Namespace) -> int:
    manifest = read_manifest(Path(args.manifest))
    for key, asset in manifest.get("assets", {}).items():
        print(f"{key}\t{asset.get('app')}\t{asset.get('source_path')}\t{asset.get('approved_sha256')}")
    return 0


def backup_remote_assets(manifest: dict, assets: dict, ticket: str) -> str:
    prod = manifest["production"]
    alias = prod["ssh_alias"]
    plugin_root = prod["plugin_root"]
    backup_root = f"/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/{ticket}/{utc_stamp()}"
    commands = [f"mkdir -p {shell_quote(backup_root)}"]
    for asset in assets.values():
        rel = asset["production_path"]
        dest_dir = str(Path(backup_root) / str(Path(rel).parent))
        commands.append(f"mkdir -p {shell_quote(dest_dir)}")
        commands.append(f"cp {shell_quote(plugin_root + '/' + rel)} {shell_quote(backup_root + '/' + rel)}")
    commands.append(f"shasum -a 256 {shell_quote(backup_root)}/*/* 2>/dev/null || true")
    ssh(alias, "set -e; " + "; ".join(commands))
    return backup_root


def upload_asset(manifest: dict, worktree: Path, asset: dict) -> None:
    prod = manifest["production"]
    alias = prod["ssh_alias"]
    plugin_root = prod["plugin_root"]
    local = local_path(worktree, asset)
    rel = asset["production_path"]
    remote = f"{plugin_root}/{rel}"
    ssh(alias, f"mkdir -p {shell_quote(str(Path(remote).parent))}")
    run(["scp", str(local), f"{alias}:{remote}"], capture=True)


def guarded_deploy(args: argparse.Namespace) -> int:
    if not args.brian_approved:
        print("BLOCKED: guarded-deploy requires --brian-approved and explicit Brian authorization for this exact ticket/assets.")
        return 44

    manifest = read_manifest(Path(args.manifest))
    worktree = Path(args.worktree).resolve()
    assets = selected_assets(manifest, args.assets)
    ticket = args.ticket.strip()
    if not ticket:
        raise GuardError("--ticket is required")

    print("MATRIX RUNTIME GUARDED DEPLOY")
    print(f"ticket: {ticket}")
    print(f"worktree: {worktree}")
    print(f"assets: {', '.join(assets.keys())}")

    local_hashes = {}
    for key, asset in assets.items():
        lp = local_path(worktree, asset)
        if not lp.exists():
            raise GuardError(f"Missing local source for {key}: {lp}")
        local_hashes[key] = sha256_path(lp)

    backup_root = backup_remote_assets(manifest, assets, ticket)
    print(f"backup: {backup_root}")

    for key, asset in assets.items():
        upload_asset(manifest, worktree, asset)
        origin = remote_sha(manifest, asset)
        if origin != local_hashes[key]:
            raise GuardError(f"{key}: deployed origin hash mismatch: {origin} != {local_hashes[key]}")
        print(f"{key}: origin verified {origin}")

        if asset.get("public_url"):
            version = remote_version(manifest, asset)
            pub = public_sha(asset, version)
            if pub != local_hashes[key]:
                raise GuardError(f"{key}: public cache-busted hash mismatch: {pub} != {local_hashes[key]}")
            print(f"{key}: public verified {pub} version={version}")

    report = write_deploy_report(args, manifest, assets, local_hashes, backup_root)
    print(f"report: {report}")
    print("PASS: guarded deploy completed with backup, origin hash proof, and public hash proof where applicable.")
    return 0


def write_deploy_report(
    args: argparse.Namespace,
    manifest: dict,
    assets: dict,
    local_hashes: dict,
    backup_root: str,
) -> Path:
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    report = report_dir / f"MATRIX_RUNTIME_GUARD_{args.ticket}_{utc_stamp()}.md"
    lines = [
        f"# Matrix Runtime Guard Deploy Report - {args.ticket}",
        "",
        "RESULT: DEPLOYED",
        "",
        f"Manifest: `{args.manifest}`",
        f"Worktree: `{Path(args.worktree).resolve()}`",
        f"Backup: `{backup_root}`",
        "",
        "## Assets",
        "",
    ]
    for key, asset in assets.items():
        lines.extend(
            [
                f"### {key}",
                f"- App: {asset.get('app')}",
                f"- Source: `{asset.get('source_path')}`",
                f"- Production: `{asset.get('production_path')}`",
                f"- Local/deployed SHA256: `{local_hashes[key]}`",
                "",
            ]
        )
    lines.extend(
        [
            "## Rollback",
            "",
            "Restore the corresponding files from:",
            f"`{backup_root}`",
            "",
            "Do not rollback with broad git reset/clean. Restore only the scoped protected assets.",
        ]
    )
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


def verify_public(args: argparse.Namespace) -> int:
    manifest = read_manifest(Path(args.manifest))
    assets = selected_assets(manifest, args.assets)
    failed = False
    for key, asset in assets.items():
        if not asset.get("public_url"):
            print(f"{key}: public check skipped (no public URL)")
            continue
        pub = public_sha(asset)
        approved = asset.get("approved_sha256")
        print(f"{key}: public={pub} approved={approved}")
        if approved and pub != approved:
            failed = True
    return 45 if failed else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="MissionMed Matrix runtime lock guard")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("list-assets", help="List protected Matrix asset keys")
    p.set_defaults(func=list_assets)

    p = sub.add_parser("preflight", help="Check local/source and deployed state against the lock manifest")
    p.add_argument("--worktree", required=True)
    p.add_argument("--assets", default="all")
    p.add_argument("--skip-production", action="store_true")
    p.add_argument("--verify-public", action="store_true")
    p.add_argument("--brian-approved", action="store_true")
    p.set_defaults(func=preflight)

    p = sub.add_parser("verify-public", help="Verify public cache-busted assets against the lock manifest")
    p.add_argument("--assets", default="all")
    p.set_defaults(func=verify_public)

    p = sub.add_parser("guarded-deploy", help="Backup, upload, and verify scoped protected Matrix assets")
    p.add_argument("--worktree", required=True)
    p.add_argument("--assets", required=True)
    p.add_argument("--ticket", required=True)
    p.add_argument("--brian-approved", action="store_true")
    p.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    p.set_defaults(func=guarded_deploy)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except GuardError as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
