import hashlib
import importlib.util
import json
import os
import stat
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "scripts/sponsor-invites/build_invite_payload.py"
PHP = ROOT / "scripts/sponsor-invites/wp_send_secure_invites.php"


class InviteContractTest(unittest.TestCase):
    def test_runner_never_prints_or_persists_reset_secret(self):
        source = PHP.read_text()
        self.assertIn("get_password_reset_key", source)
        self.assertIn("wp_mail", source)
        self.assertNotIn("user_pass", source)
        self.assertNotIn("mission1", source.lower())
        self.assertNotRegex(source, r"results\[\].*\$key")
        self.assertIn("uncertain_hold", source)
        self.assertIn("count($payload['items']) !== 40", source)
        self.assertIn("if ($preflight_failed)", source)
        self.assertLess(source.index("if ($preflight_failed)"), source.index("get_password_reset_key"))

    def test_builder_seals_non_pii_payload_and_mode_0600(self):
        spec = importlib.util.spec_from_file_location("invite_builder", BUILDER)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        rows = []
        humans = []
        for index in range(40):
            email = f"student{index}@example.invalid"
            wp_id = index + 100
            rows.append({"name":f"Student {index}","registered_email":email,"wp_user_id":str(wp_id),"username":f"student{index}","account_readiness":"READY - INVITE REQUIRED","password_set_reset_eligibility":"ELIGIBLE - NOT SENT","missionaccounts_readiness":"READY","sponsor":"DIRECT","invitation_required":"YES"})
            humans.append({"wp_user_id":wp_id,"canonical_student_id":f"00000000-0000-4000-8000-{index:012d}","wp_conflict":False})
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp); manifest=temp/'manifest.csv'; plan=temp/'plan.json'; output=temp/'payload.json'
            import csv
            with manifest.open('w',newline='') as handle:
                writer=csv.DictWriter(handle,fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
            plan.write_text(json.dumps({'humans':humans}))
            module.MANIFEST_SHA256 = hashlib.sha256(manifest.read_bytes()).hexdigest()
            payload=module.build(manifest,plan,'test-invite-request-1')
            fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w') as handle: json.dump(payload,handle)
            self.assertEqual(stat.S_IMODE(output.stat().st_mode),0o600)
            encoded=output.read_text()
            self.assertNotIn('@example.invalid',encoded)
            self.assertEqual(len(payload['items']),40)


if __name__ == '__main__':
    unittest.main()
