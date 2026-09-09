import pathlib
import re
import unittest


PLUGIN = pathlib.Path(__file__).parents[2] / "wp-content" / "plugins" / "missionmed-storyforge-sso" / "missionmed-storyforge-sso.php"
SOURCE = PLUGIN.read_text()


class StoryForgeCookiePathTests(unittest.TestCase):
    def test_bootstrap_and_token_exchange_share_admin_ajax_cookie_context(self):
        bootstrap = re.search(
            r"function mmsf_bootstrap_payload\([^}]+\n}",
            SOURCE,
            re.DOTALL,
        )
        self.assertIsNotNone(bootstrap)
        self.assertIn("missionmed_storyforge_token", bootstrap.group(0))
        self.assertIn("admin_url('admin-ajax.php')", bootstrap.group(0))
        self.assertNotIn("rest_url(", bootstrap.group(0))

    def test_ajax_exchange_preserves_all_security_gates(self):
        handler = re.search(r"function mmsf_ajax_token\(\) \{(.+?)\n}", SOURCE, re.DOTALL)
        self.assertIsNotNone(handler)
        body = handler.group(1)
        for required in (
            "mmsf_send_private_no_store_headers()",
            "REQUEST_METHOD",
            "mmsf_verify_origin_value",
            "HTTP_X_WP_NONCE",
            "wp_verify_nonce",
            "mmsf_access_state",
            "mmsf_rate_limit",
            "mmsf_issue_jwt",
            "wp_send_json($issued, 200)",
        ):
            self.assertIn(required, body)
        self.assertIn("wp_ajax_missionmed_storyforge_token", SOURCE)
        self.assertIn("wp_ajax_nopriv_missionmed_storyforge_token", SOURCE)

    def test_existing_rest_exchange_remains_for_compatibility(self):
        self.assertIn("register_rest_route(MMSF_REST_NAMESPACE, MMSF_REST_ROUTE", SOURCE)
        self.assertIn("function mmsf_token_endpoint($request)", SOURCE)


if __name__ == "__main__":
    unittest.main()
