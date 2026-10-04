"""Fixture-only tests: never read real environment, keychain, token file or APIs."""
import io
import json
import sys
import unittest
import urllib.request
from unittest.mock import patch

sys.dont_write_bytecode = True
import lease_transport as transport

# Deliberately fictional fixture values; never usable provider credentials.
TOKEN = 'sbp_' + '0123456789abcdef' * 2 + '01234567'
KEY = 'sb_secret_' + 'FictionalFixtureNeverAProviderKey_123456789'


def rows(key=KEY, **overrides):
    row = {'name': 'missionmed_lease_runtime_v5', 'type': 'secret', 'api_key': key}
    row.update(overrides)
    return json.dumps([row]).encode()


class TransportTests(unittest.TestCase):
    def load(self, environment, keychain, file):
        return transport.load_existing_management_token(environment=environment,
            keychain_reader=keychain, file_reader=file)

    def test_lookup_precedence_and_confirmed_absence(self):
        calls = []
        def keychain(account, deadline):
            calls.append(account)
            if account == 'supabase':
                raise transport.AbsentCredential()
            return TOKEN
        def file(deadline):
            calls.append('file')
            return TOKEN
        self.assertEqual(self.load({'SUPABASE_ACCESS_TOKEN': TOKEN}, keychain, file), TOKEN)
        self.assertEqual(calls, [])
        self.assertEqual(self.load({}, keychain, file), TOKEN)
        self.assertEqual(calls, ['supabase', 'access-token'])
        calls.clear()
        def absent(account, deadline):
            calls.append(account)
            raise transport.AbsentCredential()
        self.assertEqual(self.load({}, absent, file), TOKEN)
        self.assertEqual(calls, ['supabase', 'access-token', 'file'])
        calls.clear()
        self.assertEqual(self.load({}, lambda account, deadline: TOKEN, file), TOKEN)
        self.assertEqual(calls, [])

    def test_denied_locked_cancelled_and_invalid_never_fallback(self):
        def forbidden(*args):
            self.fail('fallback must not run')
        for failure in (PermissionError(KEY), RuntimeError('locked ' + KEY),
                        RuntimeError('cancelled ' + KEY)):
            def denied(*args):
                raise failure
            with self.subTest(type=type(failure).__name__), self.assertRaises(transport.TransportError) as caught:
                self.load({}, denied, forbidden)
            self.assertNotIn(KEY, str(caught.exception))
        for selected in ('invalid', TOKEN + '\n', '', 'sbp_' + 'g' * 40):
            with self.subTest(selected='fictional malformed'), self.assertRaises(transport.TransportError):
                self.load({}, lambda *args: selected, forbidden)
        with self.assertRaises(transport.TransportError):
            self.load({'SUPABASE_ACCESS_TOKEN': 'malformed'}, forbidden, forbidden)

    def test_all_absent_and_oauth_pattern(self):
        def absent(*args):
            raise transport.AbsentCredential()
        with self.assertRaisesRegex(transport.TransportError, 'custody unavailable'):
            self.load({}, absent, absent)
        oauth = TOKEN.replace('sbp_', 'sbp_oauth_')
        self.assertEqual(self.load({'SUPABASE_ACCESS_TOKEN': oauth}, absent, absent), oauth)

    def test_lookup_deadline(self):
        with patch.object(transport.time, 'monotonic', return_value=61):
            with self.assertRaisesRegex(transport.TransportError, 'deadline'):
                transport.load_existing_management_token(deadline=60,
                    environment={}, keychain_reader=lambda *args: TOKEN)

    def test_key_selector_rejects_partial_masked_missing_ambiguous(self):
        self.assertEqual(transport._select_existing_key(rows()), KEY)
        for value in (None, '', 'sb_secret_short', 'sb_secret_' + '*' * 40,
                      'sb_secret_' + 'a' * 40, 'sb_secret_' + 'masked' + '1Ab_' * 10,
                      'sb_secret_' + 'redacted' + 'Ab12' * 10, KEY + '\n'):
            with self.subTest(shape='fictional invalid'), self.assertRaises(transport.TransportError):
                transport._select_existing_key(rows(value))
        for raw in (b'[]', rows(type='legacy'), rows(name='default'),
                    json.dumps([json.loads(rows())[0]] * 2).encode(),
                    b'{"api_keys": []}', b'[null]', b'not json', b'x' * (transport.MAX_BYTES + 1)):
            with self.subTest(shape='invalid response'), self.assertRaises(transport.TransportError):
                transport._select_existing_key(raw)

    def test_reveal_single_fixed_operation_and_private_failure(self):
        calls = []
        def get(mode, token, deadline):
            calls.append((mode, token))
            return 200, rows()
        self.assertEqual(transport.retrieve_existing_key(token_loader=lambda **kwargs: TOKEN, get=get), KEY)
        self.assertEqual(calls, [('reveal', TOKEN)])
        for status in (301, 302, 307, 308, 401, 403, 500):
            with self.subTest(status=status), self.assertRaises(transport.TransportError):
                transport.retrieve_existing_key(token_loader=lambda **kwargs: TOKEN,
                    get=lambda *args: (status, rows()))
        def leak(*args):
            raise RuntimeError(KEY)
        with self.assertRaises(transport.TransportError) as caught:
            transport.retrieve_existing_key(token_loader=lambda **kwargs: TOKEN, get=leak)
        self.assertNotIn(KEY, str(caught.exception))

    def test_reveal_and_probe_size_and_total_deadline(self):
        def slow(mode, token, deadline):
            with patch.object(transport.time, 'monotonic', return_value=deadline + 1):
                transport._remaining(deadline)
        for operation in (
            lambda: transport.retrieve_existing_key(token_loader=lambda **kwargs: TOKEN, get=slow),
            lambda: transport.authentication_probe(KEY, get=slow),
            lambda: transport.authentication_probe(KEY, get=lambda *args: (200, b'x' * (transport.MAX_BYTES + 1)))):
            with self.assertRaises(transport.TransportError):
                operation()

    def test_probe_is_separate_single_health_get(self):
        calls = []
        def get(mode, key, deadline):
            calls.append((mode, key))
            return 200, b'private response discarded'
        self.assertEqual(transport.authentication_probe(KEY, get=get), 200)
        self.assertEqual(calls, [('health', KEY)])
        with self.assertRaises(transport.TransportError):
            transport.authentication_probe(KEY, get=lambda *args: (401, b'private'))

    def request(self, url=None, method='POST', key=KEY, auth=None):
        return urllib.request.Request(url or sorted(transport.RPC_URLS)[0], data=b'{"fictional":true}',
            method=method, headers={'apikey': key, 'Authorization': auth or 'Bearer ' + key,
                'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Fixture': 'same'})

    def test_all_six_rpc_payload_headers_response_unchanged(self):
        response = object()
        for url in transport.RPC_URLS:
            request = self.request(url)
            before = request.header_items()
            def canonical(adapted, timeout):
                self.assertEqual(timeout, 3.0)
                self.assertIs(adapted.data, request.data)
                self.assertEqual(adapted.full_url, url)
                self.assertEqual(adapted.get_method(), 'POST')
                self.assertEqual(adapted.header_items(), [(n, v) for n, v in before if n.lower() != 'authorization'])
                return response
            opener = transport.ApikeyOnlyLeaseOpener(KEY, canonical)
            self.assertIs(opener(request, 3.0), response)
            self.assertEqual(request.header_items(), before)

    def test_pinned_method_destination_timeout(self):
        def forbidden(*args):
            self.fail('canonical opener must not run')
        opener = transport.ApikeyOnlyLeaseOpener(KEY, forbidden)
        good = sorted(transport.RPC_URLS)[0]
        for url in (good.replace('https:', 'http:'), good.replace('.co/', '.co:443/'),
                    good.replace('.co/', '.co:8443/'), good.replace('https://', 'https://u:p@'),
                    good + '?x=1', good + '#x', good + '/', transport.HEALTH_URL,
                    good.replace(transport.PROJECT, 'otherproject'), good.replace('mmos_acquire', 'other_acquire')):
            with self.subTest(url='unapproved shape'), self.assertRaises(transport.TransportError):
                opener(self.request(url), 3)
        for method in ('GET', 'PUT', 'DELETE'):
            with self.assertRaises(transport.TransportError):
                opener(self.request(method=method), 3)
        for timeout in (0, -1, 3.1, float('inf'), float('nan'), True, '3'):
            with self.assertRaises(transport.TransportError):
                opener(self.request(), timeout)

    def test_missing_mismatched_duplicate_credential_headers(self):
        opener = transport.ApikeyOnlyLeaseOpener(KEY, lambda *args: self.fail('must not open'))
        requests = [self.request(auth='Bearer different'), self.request(key=KEY + 'different')]
        missing_auth = self.request(); missing_auth.remove_header('Authorization'); requests.append(missing_auth)
        missing_key = self.request(); missing_key.remove_header('Apikey'); requests.append(missing_key)
        duplicate = self.request(); duplicate.add_unredirected_header('Authorization', 'Bearer ' + KEY); requests.append(duplicate)
        proxy = self.request(); proxy.add_header('Proxy-Authorization', 'Bearer ' + KEY); requests.append(proxy)
        host = self.request(); host.add_header('Host', 'other.example'); requests.append(host)
        changed_host = self.request(); changed_host.host = 'other.example'; requests.append(changed_host)
        for request in requests:
            with self.assertRaises(transport.TransportError):
                opener(request, 3)

    def test_adapter_real_response_and_value_free_exception(self):
        response = type('Response', (), {'status': 401})()
        opener = transport.ApikeyOnlyLeaseOpener(KEY, lambda *args: response)
        self.assertIs(opener(self.request(), 3), response)
        def raw_failure(*args):
            raise RuntimeError(KEY)
        with self.assertRaises(transport.TransportError) as caught:
            transport.ApikeyOnlyLeaseOpener(KEY, raw_failure)(self.request(), 3)
        self.assertNotIn(KEY, str(caught.exception))
        self.assertTrue(caught.exception.__suppress_context__)

    def test_native_keychain_no_ui_exact_slots_and_absence_classification(self):
        self.assertIn('kSecUseAuthenticationUIFail', transport._KEYCHAIN_WORKER)
        self.assertIn('kSecClassGenericPassword', transport._KEYCHAIN_WORKER)
        self.assertIn("code == -25300", transport._KEYCHAIN_WORKER)
        with patch.object(transport.sys, 'platform', 'darwin'), patch.object(transport, '_private_worker') as worker:
            for account in ('supabase', 'access-token'):
                worker.return_value = (0, TOKEN.encode())
                self.assertEqual(transport._read_keychain(account, transport.time.monotonic() + 60), TOKEN)
                self.assertEqual(worker.call_args.args[1], [account])
            worker.return_value = (3, b'')
            with self.assertRaises(transport.AbsentCredential):
                transport._read_keychain('supabase', transport.time.monotonic() + 60)
            for code in (1, 4, 5, 6):
                worker.return_value = (code, KEY.encode())
                with self.assertRaises(transport.TransportError):
                    transport._read_keychain('supabase', transport.time.monotonic() + 60)

    def test_file_reader_exact_path_no_symlinks_size_and_absence(self):
        with patch.object(transport.os, 'open', return_value=7) as opened, \
             patch.object(transport.os, 'fstat', return_value=type('Stat', (), {'st_mode': 0o100600, 'st_size': len(TOKEN)})()), \
             patch.object(transport.os, 'read', return_value=TOKEN.encode()), patch.object(transport.os, 'close') as close:
            self.assertEqual(transport._read_token_file(transport.time.monotonic() + 60), TOKEN)
            self.assertEqual(opened.call_args.args[0], transport.TOKEN_FILE)
            self.assertTrue(opened.call_args.args[1] & transport.os.O_NOFOLLOW)
            close.assert_called_once_with(7)
        with patch.object(transport.os, 'open', side_effect=FileNotFoundError):
            with self.assertRaises(transport.AbsentCredential):
                transport._read_token_file(transport.time.monotonic() + 60)
        with patch.object(transport.os, 'open', side_effect=PermissionError(KEY)):
            with self.assertRaises(transport.TransportError) as caught:
                transport._read_token_file(transport.time.monotonic() + 60)
            self.assertNotIn(KEY, str(caught.exception))

    def test_private_worker_hard_deadline_kills_without_real_launch(self):
        process = type('Process', (), {})()
        process.stdout = io.BytesIO(); process.stderr = io.BytesIO(); process.stdin = None
        process.poll = lambda: None
        process.kill = unittest.mock.Mock()
        process.wait = unittest.mock.Mock(return_value=0)
        selector = unittest.mock.MagicMock()
        selector.__enter__.return_value = selector
        selector.get_map.return_value = {'fixture': True}
        with patch.object(transport.subprocess, 'Popen', return_value=process) as launch, \
             patch.object(transport.selectors, 'DefaultSelector', return_value=selector), \
             patch.object(transport.time, 'monotonic', return_value=61):
            with self.assertRaisesRegex(transport.TransportError, 'deadline'):
                transport._private_worker('fixture source', ['supabase'], 60)
            process.kill.assert_called_once()
            self.assertEqual(launch.call_args.kwargs['env'], {'PATH': '/usr/bin:/bin'})

    def test_fixed_get_worker_no_redirect_or_raw_errors(self):
        self.assertIn("connection.request('GET'", transport._GET_WORKER)
        self.assertIn('ssl.create_default_context()', transport._GET_WORKER)
        self.assertNotIn('redirect', transport._GET_WORKER)
        self.assertIn('/v1/projects/' + transport.PROJECT + '/api-keys?reveal=true', transport._GET_WORKER)
        self.assertNotIn('print(', transport._GET_WORKER + transport._KEYCHAIN_WORKER)
        with patch.object(transport, '_private_worker', return_value=(0, b'302\n')) as worker:
            self.assertEqual(transport._private_get('reveal', TOKEN, transport.time.monotonic() + 60), (302, b''))
            self.assertEqual(worker.call_args.kwargs['input_bytes'], TOKEN.encode())
        with patch.object(transport, '_private_worker', return_value=(6, KEY.encode())):
            with self.assertRaises(transport.TransportError) as caught:
                transport._private_get('reveal', TOKEN, transport.time.monotonic() + 60)
            self.assertNotIn(KEY, str(caught.exception))

    def test_private_worker_output_cap_kills_without_real_launch(self):
        stream = unittest.mock.Mock()
        process = unittest.mock.Mock(stdout=stream, stderr=unittest.mock.Mock(), stdin=None)
        process.poll.return_value = None
        selector = unittest.mock.MagicMock()
        selector.__enter__.return_value = selector
        selector.get_map.return_value = {'fixture': True}
        selector.select.return_value = [(type('Event', (), {'fileobj': stream, 'data': True})(), 1)]
        with patch.object(transport.subprocess, 'Popen', return_value=process), \
             patch.object(transport.selectors, 'DefaultSelector', return_value=selector), \
             patch.object(transport.os, 'read', return_value=b'x' * 11):
            with self.assertRaisesRegex(transport.TransportError, 'size bound'):
                transport._private_worker('fixture source', [], transport.time.monotonic() + 60, limit=10)
            process.kill.assert_called_once()


if __name__ == '__main__':
    unittest.main()
