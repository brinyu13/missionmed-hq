"""Fixture-only tests: never read real environment, keychain, token file or APIs."""
import io
import base64
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

    def test_private_stdin_is_closed_before_output_collection(self):
        process = unittest.mock.Mock(stdin=io.BytesIO(), stdout=io.BytesIO(), stderr=io.BytesIO())
        process.poll.return_value = 0
        process.wait.return_value = 0
        selector = unittest.mock.MagicMock()
        def enter():
            self.assertTrue(process.stdin.closed)
            return selector
        selector.__enter__.side_effect = enter
        selector.get_map.return_value = {}
        with patch.object(transport.subprocess, 'Popen', return_value=process), \
             patch.object(transport.selectors, 'DefaultSelector', return_value=selector), \
             patch.object(transport.time, 'monotonic', return_value=10.0):
            self.assertEqual(transport._private_worker('fixture', [], 11.0,
                input_bytes=b'fictional input'), (0, b''))
        process.kill.assert_not_called()

    def test_phase_deadlines_are_distinct_and_elapsed_only(self):
        clock = [10.0]
        calls = []
        def fail(*args):
            clock[0] = 12.5
            transport._remaining(12.0)
        def absent(*args):
            calls.append(args[0] if len(args) == 2 else 'file')
            raise transport.AbsentCredential()
        def second(account, deadline):
            if account == 'supabase':
                return absent(account, deadline)
            return fail(account, deadline)
        cases = (
            ('keychain_supabase', lambda: self.load({}, fail, absent)),
            ('keychain_access_token', lambda: self.load({}, second, absent)),
            ('exact_existing_file', lambda: self.load({}, absent, fail)),
            ('management_token_lookup', lambda: transport.retrieve_existing_key(
                token_loader=lambda **kwargs: fail(), get=fail)),
            ('management_reveal', lambda: transport.retrieve_existing_key(
                token_loader=lambda **kwargs: TOKEN, get=fail)),
            ('authentication_probe', lambda: transport.authentication_probe(KEY, get=fail)),
        )
        with patch.object(transport.time, 'monotonic', side_effect=lambda: clock[0]):
            for phase, operation in cases:
                clock[0] = 10.0
                with self.subTest(phase=phase), self.assertRaises(transport.PhaseError) as caught:
                    operation()
                error = caught.exception
                self.assertEqual(error.public_status(),
                    f'phase={phase}; error=deadline_exceeded; elapsed_seconds=2.500')
                self.assertEqual(error.elapsed_seconds, 2.5)
                self.assertTrue(error.__suppress_context__)
        self.assertEqual(calls, ['supabase', 'supabase', 'access-token'])

    def test_phase_failure_never_formats_private_exception(self):
        class PrivateFailure(Exception):
            def __str__(self):
                raise AssertionError('private exception must never be formatted')
        def fail(*args):
            raise PrivateFailure(KEY, TOKEN, transport.REVEAL_URL)
        with patch.object(transport.time, 'monotonic', return_value=10.0):
            with self.assertRaises(transport.PhaseError) as caught:
                transport.retrieve_existing_key(token_loader=lambda **kwargs: TOKEN, get=fail)
        self.assertEqual(caught.exception.public_status(),
            'phase=management_reveal; error=failed_closed; elapsed_seconds=0.000')
        self.assertNotIn(KEY, str(caught.exception))
        self.assertNotIn(TOKEN, str(caught.exception))
        self.assertNotIn(transport.REVEAL_URL, str(caught.exception))

    def test_known_safe_failure_classifications(self):
        def denied(*args):
            raise PermissionError(KEY)
        cases = (
            (lambda: self.load({}, denied, denied), 'custody_requires_owner_action'),
            (lambda: transport.retrieve_existing_key(token_loader=lambda **kwargs: 'invalid'),
             'management_format_unavailable'),
            (lambda: transport.retrieve_existing_key(token_loader=lambda **kwargs: TOKEN,
                get=lambda *args: (403, b'private')), 'management_denied'),
            (lambda: transport.authentication_probe(KEY, get=lambda *args: (401, b'private')),
             'coordination_denied'),
        )
        for operation, kind in cases:
            with self.subTest(kind=kind), self.assertRaises(transport.PhaseError) as caught:
                operation()
            self.assertEqual(caught.exception.kind, kind)
            self.assertNotIn(KEY, caught.exception.public_status())

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


class KeyringDecodeTests(unittest.TestCase):
    def setUp(self):
        # Any accidental real custody or network operation fails the fixture run.
        for owner, name in ((transport.subprocess, 'Popen'), (transport.os, 'open'),
                            (transport.urllib.request, 'urlopen'), (transport, '_private_get')):
            guard = patch.object(owner, name, side_effect=AssertionError('real operation forbidden'))
            guard.start()
            self.addCleanup(guard.stop)
        empty_environment = patch.object(transport.os, 'environ', {})
        empty_environment.start()
        self.addCleanup(empty_environment.stop)

    def envelope(self, value):
        return 'go-keyring-base64:' + base64.b64encode(value.encode()).decode('ascii')

    def test_encodings_plain_legacy_and_non_strict_padding_bits(self):
        oauth = TOKEN.replace('sbp_', 'sbp_oauth_')
        for value, expected in ((TOKEN, TOKEN), (self.envelope(TOKEN), TOKEN),
                                (self.envelope(oauth), oauth),
                                ('go-keyring-encoded:' + TOKEN.encode().hex(), TOKEN),
                                ('go-keyring-encoded:' + TOKEN.encode().hex().upper(), TOKEN)):
            with self.subTest(shape='synthetic accepted'):
                self.assertEqual(transport._token(transport._decode_keychain_value(value)), expected)
        self.assertEqual(transport._decode_keychain_value('go-keyring-base64:Zh=='), 'f')
        self.assertEqual(transport._decode_keychain_value('go-keyring-base64:Zm9='), 'fo')
        self.assertEqual(transport._decode_keychain_value('go-keyring-base64:77+/'), '\uffff')
        for prefix in ('go-keyring-base64:', 'go-keyring-encoded:'):
            self.assertEqual(transport._decode_keychain_value(prefix), '')

    def test_exact_go_whitespace_and_base64_crlf(self):
        whitespace = ''.join(chr(code) for code in (
            *range(9, 14), 32, 0x85, 0xa0, 0x1680, *range(0x2000, 0x200b),
            0x2028, 0x2029, 0x202f, 0x205f, 0x3000))
        for value in (TOKEN, self.envelope(TOKEN), 'go-keyring-encoded:' + TOKEN.encode().hex()):
            self.assertEqual(transport._decode_keychain_value(whitespace + value + whitespace), TOKEN)
        payload = self.envelope(TOKEN).split(':', 1)[1]
        self.assertEqual(transport._decode_keychain_value(
            'go-keyring-base64:\r\n' + '\r\n'.join(payload) + '\r\n'), TOKEN)
        for char in ('\x1c', '\x1d', '\x1e', '\x1f', '\ufeff'):
            self.assertEqual(transport._decode_keychain_value(char + TOKEN + char), char + TOKEN + char)
            with self.assertRaises(transport.TransportError):
                transport._token(transport._decode_keychain_value(char + TOKEN + char))

    def test_malformed_and_decoded_invalid_values_fail_closed(self):
        malformed = ('!', 'Zg', 'Zg=', 'Zg===', 'Zm9v=', 'Zg==AAAA', 'Zg==!',
                     'Z g==', 'Z\t g==', '-_8=', '====', 'A===', 'A', 'é', '/w==')
        values = ['go-keyring-base64:' + value for value in malformed]
        values += ['go-keyring-encoded:' + value for value in ('a', 'gg', '61 62', 'ff')]
        for value in values:
            with self.subTest(shape='synthetic malformed'), self.assertRaises(transport.TransportError) as caught:
                transport._decode_keychain_value(value)
            self.assertEqual(str(caught.exception), 'existing management credential format unavailable')
            self.assertTrue(caught.exception.__suppress_context__)
        for value in (self.envelope(TOKEN), ' ' + TOKEN, TOKEN + '\n', '\x00',
                      '{"token":"fictional"}', TOKEN.upper(), 'sbp_' + 'a' * 39):
            with self.assertRaises(transport.TransportError):
                transport._token(transport._decode_keychain_value(self.envelope(value)))
        for value in ('', 'unknown:' + TOKEN, 'GO-KEYRING-BASE64:' + TOKEN):
            with self.assertRaises(transport.TransportError):
                transport._token(transport._decode_keychain_value(value))

    def test_both_native_slots_decode_once_and_malformed_stops_selected_slot(self):
        for selected in ('supabase', 'access-token'):
            def worker(source, accounts, deadline):
                return (3, b'') if accounts[0] != selected else (0, self.envelope(TOKEN).encode())
            with patch.object(transport.sys, 'platform', 'darwin'), \
                 patch.object(transport, '_private_worker', side_effect=worker) as native, \
                 patch.object(transport, '_decode_keychain_value', wraps=transport._decode_keychain_value) as decode:
                self.assertEqual(transport.load_existing_management_token(environment={},
                    file_reader=lambda *args: self.fail('file fallback forbidden')), TOKEN)
                decode.assert_called_once()
                self.assertEqual([call.args[1][0] for call in native.call_args_list],
                                 ['supabase'] if selected == 'supabase' else ['supabase', 'access-token'])
            for raw in (b'go-keyring-base64:PRIVATE_FIXTURE!', b'\xff',
                        self.envelope(self.envelope(TOKEN)).encode()):
                def malformed(source, accounts, deadline):
                    return (3, b'') if accounts[0] != selected else (0, raw)
                with patch.object(transport.sys, 'platform', 'darwin'), \
                     patch.object(transport, '_private_worker', side_effect=malformed) as native:
                    with self.assertRaises(transport.PhaseError) as caught:
                        transport.load_existing_management_token(environment={},
                            file_reader=lambda *args: self.fail('file fallback forbidden'))
                    self.assertEqual(caught.exception.phase,
                        'keychain_supabase' if selected == 'supabase' else 'keychain_access_token')
                    self.assertEqual(caught.exception.kind, 'management_format_unavailable')
                    public = str(caught.exception) + caught.exception.public_status()
                    for private in ('PRIVATE_FIXTURE', TOKEN, self.envelope(TOKEN), 'UnicodeDecodeError'):
                        self.assertNotIn(private, public)
                    self.assertEqual(native.call_count, 1 if selected == 'supabase' else 2)

    def test_native_custody_deadline_errors_and_size_classifications_unchanged(self):
        with patch.object(transport.sys, 'platform', 'darwin'), \
             patch.object(transport.time, 'monotonic', return_value=10), \
             patch.object(transport, '_private_worker', return_value=(0, TOKEN.encode())) as worker:
            self.assertEqual(transport._read_keychain('supabase', 70), TOKEN)
            self.assertEqual(worker.call_args.args[2], 20)
            self.assertEqual(transport._read_keychain('supabase', 15), TOKEN)
            self.assertEqual(worker.call_args.args[2], 15)
        for failure, kind in (
            (transport.DeadlineExceeded('transport deadline exceeded'), 'deadline_exceeded'),
            (transport.TransportError('transport size bound exceeded'), 'size_bound_exceeded')):
            with patch.object(transport.sys, 'platform', 'darwin'), \
                 patch.object(transport, '_private_worker', side_effect=failure), \
                 patch.object(transport, '_decode_keychain_value') as decode:
                with self.assertRaises(transport.PhaseError) as caught:
                    transport.load_existing_management_token(environment={},
                        file_reader=lambda *args: self.fail('file fallback forbidden'))
                self.assertEqual(caught.exception.kind, kind)
                decode.assert_not_called()
        for code in (3, 4, 5, 6):
            with patch.object(transport.sys, 'platform', 'darwin'), \
                 patch.object(transport, '_private_worker', return_value=(code, b'PRIVATE_FIXTURE')), \
                 patch.object(transport, '_decode_keychain_value') as decode:
                with self.assertRaises(transport.AbsentCredential if code == 3 else transport.TransportError):
                    transport._read_keychain('supabase', transport.time.monotonic() + 60)
                decode.assert_not_called()

    def test_environment_and_file_values_are_never_decoded_or_trimmed(self):
        def absent(*args):
            raise transport.AbsentCredential()
        with patch.object(transport, '_decode_keychain_value', side_effect=AssertionError('decode forbidden')):
            self.assertEqual(transport.load_existing_management_token(environment={'SUPABASE_ACCESS_TOKEN': TOKEN}), TOKEN)
            for value in (self.envelope(TOKEN), ' ' + TOKEN, TOKEN + '\n'):
                with self.assertRaises(transport.TransportError):
                    transport.load_existing_management_token(environment={'SUPABASE_ACCESS_TOKEN': value},
                        keychain_reader=lambda *args: self.fail('keychain forbidden'))
                with self.assertRaises(transport.PhaseError) as caught:
                    transport.load_existing_management_token(environment={}, keychain_reader=absent,
                        file_reader=lambda *args: value)
                self.assertEqual(caught.exception.phase, 'exact_existing_file')
            with patch.object(transport.os, 'open', return_value=7), \
                 patch.object(transport.os, 'fstat', return_value=type('Stat', (), {'st_mode': 0o100600, 'st_size': 100})()), \
                 patch.object(transport.os, 'read', return_value=self.envelope(TOKEN).encode()), \
                 patch.object(transport.os, 'close'):
                self.assertEqual(transport._read_token_file(transport.time.monotonic() + 60), self.envelope(TOKEN))


if __name__ == '__main__':
    unittest.main()
