import importlib.util
import pathlib
import unittest


SCRIPT = pathlib.Path(__file__).parents[2] / "tools" / "mm-sev1-504-health-check.py"
SPEC = importlib.util.spec_from_file_location("health_check", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class HealthCheckTests(unittest.TestCase):
    def test_cross_matrix_timeout_storm_is_incident(self):
        lines = [
            '2026/09/09 02:30:00 [error] request: "GET /api/auth/session HTTP/2.0", upstream timed out',
            '2026/09/09 02:30:01 [error] request: "GET /api/auth/session HTTP/2.0", upstream timed out',
            '2026/09/09 02:30:02 [error] request: "GET /wp-json/mmed/v1/user/profile HTTP/2.0", upstream timed out',
            '2026/09/09 02:30:03 [error] request: "GET /wp-json/mmed/v1/events HTTP/2.0", upstream timed out',
            '2026/09/09 02:30:04 [error] request: "GET /api/scheduler/calendar-feed HTTP/2.0", upstream timed out',
        ]
        total, families = MODULE.analyze(lines, "2026/09/09 02:30:00")
        self.assertEqual(total, 5)
        self.assertEqual(set(families), {"auth", "matrix-api", "scheduler"})

    def test_old_and_unrelated_lines_do_not_trigger(self):
        lines = [
            '2026/09/09 01:00:00 [error] request: "GET /api/auth/session HTTP/2.0", upstream timed out',
            '2026/09/09 03:00:00 [error] request: "GET / HTTP/2.0", upstream timed out',
        ]
        total, families = MODULE.analyze(lines, "2026/09/09 02:00:00")
        self.assertEqual(total, 1)
        self.assertEqual(families["other"], 1)


if __name__ == "__main__":
    unittest.main()
