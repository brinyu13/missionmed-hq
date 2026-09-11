#!/usr/bin/env python3
"""Build the sealed, non-PII WordPress invitation controller payload."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
from pathlib import Path

AUTHORITY_COMMIT = "e4c9ff1497788588986e659ccd344920d8615398"
MANIFEST_SHA256 = "709632b3527c3138e30ea6eac4b068872841a50c00b076d6265dc2f0140b529c"
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(manifest_path: Path, plan_path: Path, request_id: str) -> dict:
    if sha256(manifest_path) != MANIFEST_SHA256:
        raise ValueError("frozen_invite_manifest_sha256_mismatch")
    if not re.fullmatch(r"[A-Za-z0-9._:-]{8,200}", request_id):
        raise ValueError("invalid_request_id")
    with manifest_path.open(newline="", encoding="utf-8") as handle:
        manifest = list(csv.DictReader(handle))
    if len(manifest) != 40:
        raise ValueError("frozen_invite_population_must_equal_40")
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    by_wp_id = {str(row.get("wp_user_id")): row for row in plan.get("humans", []) if row.get("wp_user_id")}
    items = []
    for row in manifest:
        wp_id = str(row.get("wp_user_id", "")).strip()
        human = by_wp_id.get(wp_id)
        sponsor = str(row.get("sponsor", "")).strip().upper()
        email = str(row.get("registered_email", "")).strip().lower()
        username = str(row.get("username", "")).strip()
        student_id = str((human or {}).get("canonical_student_id") or "")
        if not human or human.get("wp_conflict") or not UUID.fullmatch(student_id):
            raise ValueError("invite_not_bound_to_nonconflicting_canonical_student")
        if sponsor not in {"DIRECT", "UCC", "MUL"}:
            raise ValueError("invalid_invite_sponsor")
        if row.get("account_readiness") != "READY - INVITE REQUIRED" or row.get("password_set_reset_eligibility") != "ELIGIBLE - NOT SENT" or row.get("missionaccounts_readiness") != "READY" or row.get("invitation_required") != "YES":
            raise ValueError("invite_readiness_mismatch")
        if not wp_id.isdigit() or not username or "@" not in email:
            raise ValueError("invalid_invite_identity")
        items.append({
            "wp_user_id": int(wp_id),
            "username": username,
            "expected_email_sha256": hashlib.sha256(email.encode()).hexdigest(),
            "expected_student_id": student_id,
            "sponsor": sponsor,
        })
    if len({item["wp_user_id"] for item in items}) != 40 or len({item["username"].lower() for item in items}) != 40:
        raise ValueError("duplicate_invite_identity")
    return {
        "schema_version": "missionaccounts-secure-invites-v1",
        "authority": ["DR-226", "DR-227"],
        "authority_commit": AUTHORITY_COMMIT,
        "manifest_sha256": MANIFEST_SHA256,
        "request_id": request_id,
        "items": items,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--request-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = build(args.manifest, args.plan, args.request_id)
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, sort_keys=True, separators=(",", ":"))
        handle.write("\n")
    print(json.dumps({"built": True, "invite_count": len(payload["items"]), "manifest_sha256": MANIFEST_SHA256}))


if __name__ == "__main__":
    main()
