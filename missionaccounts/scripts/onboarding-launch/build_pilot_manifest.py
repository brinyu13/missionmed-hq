#!/usr/bin/env python3
"""Build the exact four-person, non-PII onboarding pilot send manifest."""
from __future__ import annotations
import argparse, csv, hashlib, json, os, re
from pathlib import Path

COHORT = ("Neidy", "Ana Torres", "Raghav Gupta", "Subani Dias")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
SHA = re.compile(r"^[0-9a-f]{40}$")
VERSION = "examprep-onboarding-email-2026-09-17-v2"
SUBJECT = "Your MyMissionMed Account is ready"
CTA = "https://missionmedinstitute.com/missionaccounts/#/me/onboarding"
HOLD_REASONS = {
    "canonical_identity_not_resolved",
    "canonical_wordpress_account_not_resolved",
    "account_link_not_resolved",
    "verified_email_not_resolved",
    "enrollment_not_verified",
    "authoritative_exclusion",
    "duplicate_prior_send",
}

def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def truth(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes"}

def build(rows: list[dict[str, str]], html: Path, text: Path,
          authority_commit: str | None, authorize_send: bool) -> dict:
    by_name = {str(row.get("display_name", "")).strip().casefold(): row for row in rows}
    if set(by_name) != {name.casefold() for name in COHORT} or len(rows) != 4:
        raise ValueError("pilot_cohort_must_match_exact_four")
    if authorize_send and (not authority_commit or not SHA.fullmatch(authority_commit)):
        raise ValueError("exact_send_authority_commit_required")
    items = []
    for display_name in COHORT:
        row = by_name[display_name.casefold()]
        pilot_status = str(row.get("pilot_status", "READY")).strip().upper()
        hold_reason = str(row.get("hold_reason", "")).strip().lower()
        if pilot_status == "HELD":
            if hold_reason not in HOLD_REASONS:
                raise ValueError(f"pilot_hold_reason_required:{display_name}")
            items.append({
                "display_name": display_name,
                "pilot_status": "HELD",
                "hold_reason": hold_reason,
            })
            continue
        if pilot_status != "READY" or hold_reason:
            raise ValueError(f"pilot_status_invalid:{display_name}")
        email = str(row.get("email", "")).strip().lower()
        student_id = str(row.get("student_id", "")).strip().lower()
        username = str(row.get("username", "")).strip()
        wp_user_id = str(row.get("wp_user_id", "")).strip()
        prior = str(row.get("prior_send_state", "")).strip().lower()
        if (not wp_user_id.isdigit() or not username or "@" not in email
                or not UUID.fullmatch(student_id)
                or str(row.get("sponsor_type", "")).strip().upper() != "DIRECT"
                or not truth(row.get("enrolled", ""))
                or not truth(row.get("onboarding_eligible", ""))
                or prior not in {"", "not_sent"}):
            raise ValueError(f"pilot_recipient_not_eligible:{display_name}")
        items.append({
            "display_name": display_name, "pilot_status": "READY",
            "wp_user_id": int(wp_user_id),
            "username": username, "student_id": student_id,
            "email_sha256": hashlib.sha256(email.encode()).hexdigest(),
            "sponsor_type": "DIRECT", "enrolled": True,
            "onboarding_eligible": True, "prior_send_state": "not_sent",
        })
    return {
        "schema_version": "missionaccounts-onboarding-pilot-send-v1",
        "template_version": VERSION, "template_html_sha256": file_sha(html),
        "template_text_sha256": file_sha(text), "subject": SUBJECT,
        "sender": "Dr J via MissionMed",
        "credential_method": "existing-account-or-secure-password-recovery",
        "cta_url": CTA, "completion_window_hours": 48,
        "authority_commit": authority_commit,
        "external_send_authorized": authorize_send,
        "provider": "wordpress_wp_mail", "items": items,
    }

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cohort-csv", type=Path, required=True)
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--text", type=Path, required=True)
    parser.add_argument("--authority-commit")
    parser.add_argument("--authorize-send", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with args.cohort_csv.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    payload = build(rows, args.html, args.text, args.authority_commit, args.authorize_send)
    raw = (json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n").encode()
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as handle:
        handle.write(raw)
    print(json.dumps({"built": True, "pilot_count": len(payload["items"]),
        "ready_count": sum(item["pilot_status"] == "READY" for item in payload["items"]),
        "held_count": sum(item["pilot_status"] == "HELD" for item in payload["items"]),
        "external_send_authorized": payload["external_send_authorized"],
        "manifest_sha256": hashlib.sha256(raw).hexdigest()}, sort_keys=True))

if __name__ == "__main__":
    main()
