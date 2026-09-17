import pathlib
import re
import unittest


PLUGIN = pathlib.Path(__file__).parents[2] / "wp-content" / "plugins" / "mm-scheduler-route-proxy" / "mm-scheduler-route-proxy.php"
SOURCE = PLUGIN.read_text()


class SchedulerSessionReuseTests(unittest.TestCase):
    def test_auth_session_reuses_existing_hq_session_before_new_handoff(self):
        handler = re.search(
            r"function mm_scheduler_proxy_auth_api\(\$path\) \{(.+?)\n}",
            SOURCE,
            re.DOTALL,
        )
        self.assertIsNotNone(handler)
        body = handler.group(1)
        session_check = body.index("mm_scheduler_proxy_session_cookie_header()")
        handoff = body.index("mm_scheduler_proxy_current_user_handoff_token()")
        self.assertLess(session_check, handoff)
        self.assertIn("'' === $token && '' === $session_cookie", body)
        self.assertIn("$cookie_mode = 'session'", body)
        self.assertIn("$cookie_mode = 'wordpress'", body)

    def test_proxy_remains_private_and_versioned(self):
        self.assertIn("Version: 1.0.16", SOURCE)
        self.assertIn("X-MissionMed-Proxy-Version: 1.0.16", SOURCE)
        self.assertIn("Cache-Control: no-store, no-cache", SOURCE)


if __name__ == "__main__":
    unittest.main()
