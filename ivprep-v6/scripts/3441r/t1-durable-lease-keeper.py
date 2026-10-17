#!/usr/bin/env python3
"""Fail-closed PRODUCT lease keeper for the Founder-observed T1 harness."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import select
import signal
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_REF = "brxqytrfdisrgakrxkhd"
SUPABASE_URL = f"https://{PROJECT_REF}.supabase.co"
SUPABASE_CLI = "/opt/homebrew/bin/supabase"
DEPENDENCY = Path("/Users/brianb/MissionMed_OS/tools/engineering_os_lease.py")
DEPENDENCY_SHA256 = "0dd13f92dee57a55d4210f64b02662ef47c209d66f1e24efde002e2e3eda1275"
PRODUCT_ROOT = Path("/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440")
AUTHORITY_COMMIT = "3f5c48f40b1e645bd25977bc76f333d6d99a747e"
SCOPE = "PRODUCT:IV-PREP-ON-CALL"
OWNER_ID = "codex-founder-proof"
SESSION_ID = "y1-y2-cam-v6-3441r-t1-r3-founder-harness"
HEARTBEAT_SECONDS = 5.0
STABILITY_SECONDS = 30.0
MINIMUM_HEARTBEATS = 3
MAX_CLI_OUTPUT_BYTES = 65_536

WRITE_PATHS = tuple(sorted((
    "ivprep-v6/ALLOWED_PATHS_3440.txt",
    "ivprep-v6/ALLOWED_PATHS_3441R.txt",
    "ivprep-v6/package.json",
    "ivprep-v6/scripts/3441r/t1-durable-lease-keeper.py",
    "ivprep-v6/scripts/3441r/start-founder-proof-harness.mjs",
    "ivprep-v6/public/aaa/api-client.mjs",
    "ivprep-v6/public/aaa/app.mjs",
    "ivprep-v6/public/aaa/index.html",
    "ivprep-v6/public/aaa/styles.css",
    "ivprep-v6/test/3441r/t1-durable-lease-keeper.test.mjs",
    "ivprep-v6/test/3441r/founder-proof-runtime.test.mjs",
    "ivprep-v6/test/3441r/founder-proof-ui.test.mjs",
    "ivprep-v6/handoffs/Y1_Y2_CAM_V6_3441R_T1_R3/T1_DURABLE_HARNESS_COMPLETE_COMBINED_HANDOFF.md",
    "ivprep-v6/handoffs/Y1_Y2_CAM_V6_3441R_T1_R3/T1_DURABLE_HARNESS_EVIDENCE.json",
)))


class KeeperFailure(RuntimeError):
    pass


@dataclass
class SyntheticHandle:
    lease_id: str
    fencing_epoch: int
    nonce: str
    binding_sha256: str

    def receipt(self) -> dict[str, Any]:
        return {
            "lease_id": self.lease_id,
            "fencing_epoch": self.fencing_epoch,
            "nonce_sha256": hashlib.sha256(self.nonce.encode("utf-8")).hexdigest(),
            "binding_sha256": self.binding_sha256,
        }


class SyntheticBackend:
    def __init__(self, *, fail_after: int | None = None) -> None:
        self.fail_after = fail_after
        self.heartbeats = 0
        self.released = False

    def acquire(self) -> SyntheticHandle:
        return SyntheticHandle(
            lease_id=str(uuid.uuid4()),
            fencing_epoch=1,
            nonce=str(uuid.uuid4()),
            binding_sha256="a" * 64,
        )

    def heartbeat(self, handle: SyntheticHandle) -> SyntheticHandle:
        if self.released or (self.fail_after is not None and self.heartbeats >= self.fail_after):
            raise KeeperFailure("synthetic heartbeat denied")
        self.heartbeats += 1
        return handle

    def release(self, _handle: SyntheticHandle) -> None:
        self.released = True


def load_lease_module() -> Any:
    source = DEPENDENCY.read_bytes()
    if hashlib.sha256(source).hexdigest() != DEPENDENCY_SHA256:
        raise KeeperFailure("dependency mismatch")
    spec = importlib.util.spec_from_loader("ivprep_pinned_engineering_os_lease", loader=None)
    if spec is None:
        raise KeeperFailure("dependency unavailable")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    exec(compile(source, str(DEPENDENCY), "exec"), module.__dict__)
    return module


def load_service_role_key() -> str:
    completed = subprocess.run(
        [
            SUPABASE_CLI,
            "--profile", "supabase",
            "--output", "json",
            "projects", "api-keys",
            "--project-ref", PROJECT_REF,
        ],
        cwd="/tmp",
        env={
            "PATH": "/opt/homebrew/bin:/usr/bin:/bin",
            "HOME": os.environ.get("HOME", ""),
            "TMPDIR": os.environ.get("TMPDIR", "/tmp"),
            "LANG": "en_US.UTF-8",
        },
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=15,
        check=False,
    )
    if completed.returncode != 0 or len(completed.stdout) > MAX_CLI_OUTPUT_BYTES:
        raise KeeperFailure("credential bridge unavailable")
    try:
        rows = json.loads(completed.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError, RecursionError, OverflowError):
        raise KeeperFailure("credential bridge malformed") from None
    if not isinstance(rows, list):
        raise KeeperFailure("credential bridge malformed")
    matches = [
        row.get("api_key") for row in rows
        if isinstance(row, dict)
        and row.get("name") == "service_role"
        and isinstance(row.get("api_key"), str)
        and row.get("api_key")
    ]
    if len(matches) != 1:
        raise KeeperFailure("credential bridge ambiguous")
    return matches[0]


class RealBackend:
    def __init__(self) -> None:
        module = load_lease_module()
        self.module = module
        self.client = module.SupabaseLeaseClient(
            base_url=SUPABASE_URL,
            api_key=load_service_role_key(),
            project_ref=PROJECT_REF,
        )

    def acquire(self) -> Any:
        completed = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=PRODUCT_ROOT,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=5,
            check=True,
            text=True,
        )
        product_head = completed.stdout.strip()
        binding = self.module.binding_sha256({
            "mission_id": "Y1-Y2-CAM-V6-3441R-T1-R3",
            "authority_commit": AUTHORITY_COMMIT,
            "owner_id": OWNER_ID,
            "session_id": SESSION_ID,
            "scope": SCOPE,
            "write_paths": WRITE_PATHS,
            "product_head": product_head,
        })
        return self.client.acquire_writer(
            scope=SCOPE,
            write_paths=WRITE_PATHS,
            owner_id=OWNER_ID,
            session_id=SESSION_ID,
            binding=binding,
        )

    def heartbeat(self, handle: Any) -> Any:
        return self.client.heartbeat(handle)

    def release(self, handle: Any) -> None:
        self.client.release(handle)


class DurableKeeper:
    def __init__(self, backend: Any, *, heartbeat_seconds: float, stability_seconds: float) -> None:
        self.backend = backend
        self.heartbeat_seconds = heartbeat_seconds
        self.stability_seconds = stability_seconds
        self.state = "NOT_ACQUIRED"
        self.handle: Any = None
        self.heartbeat_count = 0
        self.acquired_monotonic: float | None = None
        self.stop_requested = False
        self.released = False

    def public_state(self) -> dict[str, Any]:
        stable_seconds = 0
        receipt: dict[str, Any] = {}
        if self.acquired_monotonic is not None:
            stable_seconds = max(0, int(time.monotonic() - self.acquired_monotonic))
        if self.handle is not None:
            receipt = self.handle.receipt()
        return {
            "state": self.state,
            "leaseId": receipt.get("lease_id"),
            "fencingEpoch": receipt.get("fencing_epoch"),
            "heartbeatCount": self.heartbeat_count,
            "stableSeconds": stable_seconds,
            "nonceSha256": receipt.get("nonce_sha256"),
        }

    def emit(self) -> None:
        print(json.dumps(self.public_state(), sort_keys=True, separators=(",", ":")), flush=True)

    def acquire(self) -> None:
        if self.state != "NOT_ACQUIRED" or self.handle is not None:
            raise KeeperFailure("acquire replay denied")
        self.handle = self.backend.acquire()
        self.acquired_monotonic = time.monotonic()
        self.state = "STABILIZING"
        self.emit()

    def heartbeat(self) -> None:
        if self.state not in {"STABILIZING", "READY"} or self.handle is None:
            raise KeeperFailure("heartbeat without ownership")
        self.handle = self.backend.heartbeat(self.handle)
        self.heartbeat_count += 1
        elapsed = time.monotonic() - (self.acquired_monotonic or time.monotonic())
        if self.heartbeat_count >= MINIMUM_HEARTBEATS and elapsed >= self.stability_seconds:
            self.state = "READY"
        self.emit()

    def release(self) -> None:
        if self.released:
            return
        if self.handle is not None:
            self.backend.release(self.handle)
        self.released = True
        self.state = "RELEASED"
        self.emit()

    def lose(self) -> None:
        self.state = "LOST"
        self.emit()

    def run(self) -> int:
        self.emit()
        next_heartbeat: float | None = None
        while not self.stop_requested:
            timeout = 0.25
            if next_heartbeat is not None:
                timeout = max(0.0, min(timeout, next_heartbeat - time.monotonic()))
            ready, _, _ = select.select([sys.stdin], [], [], timeout)
            if ready:
                command = sys.stdin.readline()
                if command == "":
                    self.release()
                    return 0
                command = command.strip()
                if command == "ACQUIRE":
                    self.acquire()
                    next_heartbeat = time.monotonic() + self.heartbeat_seconds
                elif command == "RELEASE":
                    self.release()
                    return 0
                else:
                    raise KeeperFailure("unknown command")
            if next_heartbeat is not None and time.monotonic() >= next_heartbeat:
                self.heartbeat()
                next_heartbeat = time.monotonic() + self.heartbeat_seconds
        self.release()
        return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--heartbeat-seconds", type=float, default=HEARTBEAT_SECONDS)
    parser.add_argument("--stability-seconds", type=float, default=STABILITY_SECONDS)
    parser.add_argument("--synthetic-fail-after", type=int)
    args = parser.parse_args()
    if not args.synthetic and (
        args.heartbeat_seconds != HEARTBEAT_SECONDS
        or args.stability_seconds != STABILITY_SECONDS
        or args.synthetic_fail_after is not None
    ):
        raise KeeperFailure("live timing override denied")
    if not 0.02 <= args.heartbeat_seconds <= HEARTBEAT_SECONDS:
        raise KeeperFailure("invalid heartbeat interval")
    if not 0.05 <= args.stability_seconds <= STABILITY_SECONDS:
        raise KeeperFailure("invalid stability interval")
    if args.synthetic_fail_after is not None and args.synthetic_fail_after < 0:
        raise KeeperFailure("invalid synthetic failure point")
    return args


def main() -> int:
    keeper: DurableKeeper | None = None
    try:
        args = parse_args()
        backend = SyntheticBackend(fail_after=args.synthetic_fail_after) if args.synthetic else RealBackend()
        keeper = DurableKeeper(
            backend,
            heartbeat_seconds=args.heartbeat_seconds,
            stability_seconds=args.stability_seconds,
        )

        def stop(_signum: int, _frame: object) -> None:
            keeper.stop_requested = True

        signal.signal(signal.SIGINT, stop)
        signal.signal(signal.SIGTERM, stop)
        return keeper.run()
    except (KeeperFailure, OSError, subprocess.SubprocessError, ValueError):
        if keeper is not None:
            try:
                keeper.lose()
            except Exception:
                pass
            if keeper.handle is not None and not keeper.released:
                try:
                    keeper.backend.release(keeper.handle)
                    keeper.released = True
                except Exception:
                    pass
        else:
            print('{"state":"LOST"}', flush=True)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
