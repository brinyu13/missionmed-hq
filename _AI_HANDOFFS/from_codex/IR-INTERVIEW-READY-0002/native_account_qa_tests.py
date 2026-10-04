"""Small in-memory fixtures. Never create a native identity or call a provider."""
import contextlib
import dataclasses
import hashlib
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('native_account_qa', Path(__file__).with_name('native_account_qa.py'))
qa = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = qa
spec.loader.exec_module(qa)


class SpyGate:
    def __init__(self):
        self.actions = []
        self.admission = type('FixtureAdmission', (), {'creation_hook_inventory_sha256': '3' * 64})()

    def require(self, action):
        self.actions.append(action)


class Fixtures(unittest.TestCase):
    def gate_fixture(self):
        authorities = (
            '/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2/decisions/DR-375_ir_phase1_production_authority.md',
            '/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2/decisions/DR-376_ir_phase1_bounded_execution_annex.md',
        )
        files = {str(qa.HERE / 'native_account_qa.py'): b'runner-fixture',
                 str(qa.HERE / 'native_account_qa_tests.py'): b'tests-fixture'}
        expected = {}
        for path in qa.EXPECTED_SOURCE:
            files[str(qa.ROOT / path)] = path.encode()
            expected[path] = hashlib.sha256(path.encode()).hexdigest()
        for path in authorities:
            files[path] = path.encode()
        digest = lambda value: hashlib.sha256(value).hexdigest()
        local = tuple(expected.items()) + tuple((p, digest(files[p])) for p in authorities)
        runtime = tuple((name, digest(name.encode())) for name in ('package', 'gateway', 'html', 'pointer'))
        a = qa.Admission('1' * 64, '2' * 64, digest(b'runner-fixture'), digest(b'tests-fixture'),
                         local, runtime, qa.ALLOWED_ACTIONS, '3' * 64)
        calls = []
        def control(action, binding):
            calls.append(action)
            return qa.SafeStatus(binding, runtime, time.monotonic(), True, True, True, True)
        return a, files, expected, calls, control

    def test_dormant_and_execute_have_zero_transport_calls(self):
        with mock.patch.object(qa.subprocess, 'Popen', side_effect=AssertionError('no transport')), \
             mock.patch.object(qa.urllib.request.OpenerDirector, 'open', side_effect=AssertionError('no transport')):
            for argv, status in (([], 0), (['--execute'], 2), (['--password=fixture'], 2)):
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    self.assertEqual(qa.main(argv), status)
                self.assertNotIn('fixture', output.getvalue())
            with self.assertRaisesRegex(qa.Stop, '^dormant$'):
                qa.Gate(None, None).require('create_a')

    def test_binding_and_fresh_guard_before_each_action(self):
        a, files, expected, calls, control = self.gate_fixture()
        with mock.patch.dict(qa.EXPECTED_SOURCE, expected, clear=True), \
             mock.patch.object(Path, 'is_symlink', return_value=False), \
             mock.patch.object(Path, 'read_bytes', lambda p: files[str(p)]):
            gate = qa.Gate(a, control, a.control_contract_sha256)
            gate.require('create_a'); gate.require('state_post'); gate.require('logout')
            self.assertEqual(calls, ['create_a', 'state_post', 'logout'])
            files[str(qa.HERE / 'native_account_qa.py')] = b'drift'
            with self.assertRaisesRegex(qa.Stop, '^drift$'):
                gate.require('state_post')
            self.assertEqual(len(calls), 3)

    def test_unhealthy_stale_wrong_binding_and_unreviewed_adapter_stop(self):
        a, files, expected, _, control = self.gate_fixture()
        good = control('state_post', a.fingerprint())
        failures = (dataclasses.replace(good, healthy=False), dataclasses.replace(good, fenced=False),
                    dataclasses.replace(good, current_binding=False),
                    dataclasses.replace(good, independent_admission=False),
                    dataclasses.replace(good, checked_monotonic=time.monotonic() - 10),
                    dataclasses.replace(good, binding_sha256='9' * 64),
                    dataclasses.replace(good, runtime_preimages=(('package', '9' * 64),)))
        with mock.patch.dict(qa.EXPECTED_SOURCE, expected, clear=True), \
             mock.patch.object(Path, 'is_symlink', return_value=False), \
             mock.patch.object(Path, 'read_bytes', lambda p: files[str(p)]):
            for proof in failures:
                with self.assertRaisesRegex(qa.Stop, '^guard$'):
                    qa.Gate(a, lambda *args: proof, a.control_contract_sha256).require('state_post')
            with self.assertRaisesRegex(qa.Stop, '^not_admitted$'):
                qa.Gate(a, control, '0' * 64).require('create_a')

    def test_exact_authority_and_runtime_package_are_required(self):
        a, _, expected, _, _ = self.gate_fixture()
        with mock.patch.dict(qa.EXPECTED_SOURCE, expected, clear=True):
            a.validate()
            for wrong in (dataclasses.replace(a, local_preimages=a.local_preimages[:-1]),
                          dataclasses.replace(a, runtime_preimages=a.runtime_preimages[:-1]),
                          dataclasses.replace(a, actions=frozenset({'grant_course'}))):
                with self.assertRaisesRegex(qa.Stop, '^admission$'):
                    wrong.validate()

    def test_collision_stops_without_creating_or_modifying(self):
        gate = SpyGate(); codes = []
        def pipe(code):
            codes.append(code)
            return {'collision': True}
        with self.assertRaisesRegex(qa.Stop, '^collision$'):
            qa.collision_read(gate, pipe)
        self.assertEqual(gate.actions, ['collision_read'])
        self.assertNotIn('wp_insert_user', codes[0])
        identity = qa.Identity('a', qa.NAMES[0], qa.EMAILS[0], 'fixture-private-password')
        with self.assertRaisesRegex(qa.Stop, '^collision$'):
            qa.create_identity(gate, identity, pipe)
        self.assertEqual(identity.uid, 0)
        self.assertNotIn('wp_update_user', codes[1])

    def test_private_create_uses_named_subscriber_stdin_only(self):
        gate = SpyGate(); codes = []
        identity = qa.Identity('a', qa.NAMES[0], qa.EMAILS[0], 'fixture-private-password')
        def pipe(code):
            codes.append(code)
            return {'ok': True, 'uid': 123}
        qa.create_identity(gate, identity, pipe)
        self.assertEqual(gate.actions, ['create_a'])
        self.assertEqual(identity.uid, 123)
        self.assertEqual(repr(identity), '<Identity private>')
        self.assertIn('wp_insert_user', codes[0])
        self.assertIn('pre_wp_mail', codes[0])
        self.assertIn('pre_http_request', codes[0])
        self.assertIn("hash_equals($expected,$inventory['sha256'])", codes[0])
        self.assertIn('learndash_user_get_enrolled_courses', codes[0])
        self.assertIn('subscriber', codes[0])
        self.assertNotIn(identity.password, str(qa.SSH_ARGV))
        self.assertNotIn("'user_pass'=>", codes[0].split('echo wp_json_encode')[-1])
        self.assertNotIn('wp_delete_user', codes[0])
        # Syntax only, via local PHP stdin; no WordPress or provider execution.
        php = shutil.which('php') or '/opt/homebrew/bin/php'
        if Path(php).exists():
            result = subprocess.run([php, '-l'], input=codes[0].encode(), capture_output=True)
            self.assertEqual(result.returncode, 0, 'fixed PHP syntax failure')

    def test_inventory_remains_private_and_is_read_only(self):
        gate = SpyGate(); codes = []
        private = {'sha256': '3' * 64, 'callbacks': [['user_register', 10, 'fixture_callback', 1, '4' * 64]]}
        def pipe(code):
            codes.append(code); return private
        self.assertTrue(qa.creation_inventory_read(gate, pipe) == private)
        self.assertEqual(gate.actions, ['creation_inventory_read'])
        self.assertNotIn('wp_insert_user(', codes[0])
        self.assertIn('ReflectionFunction', codes[0])
        self.assertIn("hash_file('sha256'", codes[0])

    def test_transport_errors_and_repr_never_echo_private_values(self):
        secret = 'fixture-private-value'
        with mock.patch.object(qa.subprocess, 'Popen', side_effect=RuntimeError(secret)):
            with self.assertRaises(qa.Stop) as caught:
                qa.private_pipe(secret)
        self.assertEqual(str(caught.exception), 'private_operation_failed')
        self.assertNotIn(secret, repr(caught.exception))
        client = qa.CookieClient(SpyGate())
        self.assertEqual(repr(client), '<CookieClient private>')
        with mock.patch.object(client.opener, 'open', side_effect=RuntimeError(secret)):
            with self.assertRaises(qa.Stop) as caught:
                client.request('app_get', qa.APP)
        self.assertNotIn(secret, str(caught.exception))

    def test_normal_login_form_return_and_context_remain_private(self):
        gate = SpyGate(); client = qa.CookieClient(gate); seen = []
        identity = qa.Identity('a', qa.NAMES[0], qa.EMAILS[0], 'fixture-private-password')
        html = b'<form method="post"><input name="username"><input name="password"><input name="woocommerce-login-nonce" value="fixture-nonce"><button name="login"></button></form>'
        context = {'subject': 'a' * 64, 'nonce': 'fixture-rest-nonce', 'endpoint': qa.ORIGIN + qa.ENDPOINT}
        app = ('const context = ' + json.dumps(context) + ';').encode()
        responses = iter([qa.Reply(200, {}, html, qa.ORIGIN + qa.ACCOUNT),
                          qa.Reply(302, {'Location': qa.APP}, b'', qa.ORIGIN + qa.ACCOUNT),
                          qa.Reply(200, {'Cache-Control': 'private, no-store'}, app, qa.ORIGIN + qa.APP)])
        def request(*args, **kwargs):
            seen.append((args, kwargs)); return next(responses)
        with mock.patch.object(client, 'request', request):
            client.login(identity)
        fields = qa.urllib.parse.parse_qs(seen[1][0][3].decode())
        self.assertTrue(fields['username'] == [identity.username] and fields['password'] == [identity.password])
        self.assertTrue(client.context == context)
        self.assertNotIn('wp_set_auth_cookie', Path(qa.__file__).read_text())

    def test_wrong_endpoint_or_cross_origin_redirect_stops_before_transport(self):
        client = qa.CookieClient(SpyGate())
        with mock.patch.object(client.opener, 'open', side_effect=AssertionError('no transport')):
            for action, target in (('login', '/unrelated/'), ('logout', '/wp-admin/'),
                                   ('state_post', '/wp-json/other/'), ('app_get', 'https://fictional.example/')):
                with self.assertRaises(qa.Stop):
                    client.request(action, target)

    def test_lock_and_optional_connection_loss_are_qa_only_and_no_table_writes(self):
        gate = SpyGate(); identity = qa.Identity('a', qa.NAMES[0], qa.EMAILS[0], 'fixture-private-password', 123)
        codes = []
        def pipe(code, **kwargs):
            codes.append(code)
            if kwargs.get('on_line'):
                kwargs['on_line'](); return {'released': True}
            return {'isolated_seam': True}
        class Client:
            def state(self, cmd=None):
                return (503, None) if cmd else (200, {'revision': 3})
        qa.lock_denial(gate, identity, Client(), 3, pipe)
        qa.native_connection_loss(gate, identity, pipe)
        self.assertEqual(gate.actions, ['lock_lifecycle', 'native_connection_loss'])
        for code in codes:
            self.assertIn('ir_owner($name,$uid)', code)
            self.assertIn('finally', code)
            self.assertNotIn('add_user_meta', code)
            self.assertNotIn('update_user_meta', code)
            self.assertNotIn('DELETE ', code)
        self.assertIn('mysqli_close($h)', codes[1])
        self.assertIn('MMed_IR_Locked_DB', codes[1])
        php = shutil.which('php') or '/opt/homebrew/bin/php'
        if Path(php).exists():
            for code in codes:
                result = subprocess.run([php, '-l'], input=code.encode(), capture_output=True)
                self.assertEqual(result.returncode, 0, 'fixed PHP diagnostic syntax failure')


if __name__ == '__main__':
    # unittest output contains only fixed test identifiers/status; no native data.
    unittest.main(verbosity=1)
