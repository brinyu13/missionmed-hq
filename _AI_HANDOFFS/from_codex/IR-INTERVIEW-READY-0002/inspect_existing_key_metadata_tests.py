"""Synthetic fixtures only. Real custody/network/process entrypoints are guarded."""
import contextlib
import importlib
import io
import json
import unittest
from unittest.mock import patch

import inspect_existing_key_metadata as diagnostic
import lease_transport as transport

TOKEN = 'sbp_' + '0123456789abcdef' * 2 + '01234567'
KEY = 'sb_secret_' + 'FictionalFixtureNeverAProviderKey_123456789'


def response(value=KEY, *, missing=False, name='missionmed_lease_runtime_v5', kind='secret'):
    row = {'name': name, 'type': kind, 'unapproved_field': 'PRIVATE_SENTINEL'}
    if not missing:
        row['api_key'] = value
    return json.dumps([row]).encode()


class MetadataTests(unittest.TestCase):
    def setUp(self):
        for owner, name in ((transport, '_private_get'),
                            (transport, 'load_existing_management_token'),
                            (transport, '_read_keychain'), (transport, '_read_token_file'),
                            (transport, '_secret'), (transport, 'authentication_probe'),
                            (transport, 'retrieve_existing_key'),
                            (transport.subprocess, 'Popen'), (transport.os, 'open'),
                            (transport.urllib.request, 'urlopen')):
            guard = patch.object(owner, name, side_effect=AssertionError('real operation forbidden'))
            guard.start()
            self.addCleanup(guard.stop)
        environment = patch.object(transport.os, 'environ', {})
        environment.start()
        self.addCleanup(environment.stop)

    def project(self, value=KEY, **kwargs):
        result = diagnostic.project_response(200, response(value, **kwargs))
        self.assert_fixed(result)
        return result

    def assert_fixed(self, result):
        fixed_keys = {'http_outcome', 'response_schema', 'match_count', 'api_key_class',
                      'exact_secret_prefix', 'ascii_only', 'whitespace_or_control_present',
                      'mask_glyph_present', 'suffix_length_bucket', 'suffix_alphabet_member',
                      'distinct_at_least_4', 'placeholder_word_present', 'validation'}
        fixed_values = {'200', 'non_200', 'invalid', 'oversized', 'array_of_objects',
                        'none', 'one', 'multiple', 'absent', 'null', 'string', 'other',
                        'below_32', '32_to_128', 'above_128', 'not_applicable'}
        self.assertLessEqual(result.keys(), fixed_keys)
        for value in result.values():
            if type(value) is dict:
                self.assertEqual(set(value), set(diagnostic._REJECTIONS))
                self.assertTrue(all(type(flag) is bool for flag in value.values()))
            else:
                self.assertTrue(type(value) is bool or value in fixed_values)
        encoded = json.dumps(result)
        for private in (KEY, TOKEN, 'PRIVATE_SENTINEL', 'unapproved_field',
                        'missionmed_lease_runtime_v5', 'PRIVATE_OTHER_NAME'):
            self.assertNotIn(private, encoded)

    def test_absent_null_and_every_nonstring_class(self):
        for value, missing, expected in ((None, True, 'absent'), (None, False, 'null'),
                                        (42, False, 'other'), (True, False, 'other'),
                                        ([], False, 'other'), ({'private': KEY}, False, 'other')):
            with self.subTest(expected=expected):
                result = self.project(value, missing=missing)
                self.assertEqual(result['api_key_class'], expected)
                self.assertTrue(result['validation']['non_string'])
                self.assertEqual(set(result), {'http_outcome', 'response_schema',
                                               'match_count', 'api_key_class', 'validation'})

    def test_full_string_passes_without_secret_acceptance_or_value(self):
        result = self.project()
        self.assertTrue(result['validation']['passes_unchanged_validation'])
        self.assertEqual(result['suffix_length_bucket'], '32_to_128')
        self.assertTrue(result['ascii_only'])
        self.assertFalse(result['mask_glyph_present'])

    def test_prefix_is_exact_and_no_suffix_is_guessed(self):
        for value in ('', 'private', 'SB_SECRET_' + 'Ab12' * 10, ' ' + KEY, 'sb_secret'):
            result = self.project(value)
            self.assertTrue(result['validation']['prefix'])
            self.assertEqual(result['suffix_length_bucket'], 'not_applicable')
            for key in ('suffix_alphabet_member', 'distinct_at_least_4', 'placeholder_word_present'):
                self.assertNotIn(key, result)
            self.assertFalse(result['validation']['passes_unchanged_validation'])

    def test_length_buckets_and_boundaries(self):
        for size, bucket in ((0, 'below_32'), (31, 'below_32'), (32, '32_to_128'),
                             (128, '32_to_128'), (129, 'above_128')):
            result = self.project('sb_secret_' + ('Ab1_' * 33)[:size])
            self.assertEqual(result['suffix_length_bucket'], bucket)
            self.assertEqual(result['validation']['length'], bucket != '32_to_128')

    def test_mask_glyph_alphabet_whitespace_control_and_unicode(self):
        for glyph in diagnostic._MASK_GLYPHS:
            result = self.project('sb_secret_' + glyph * 40)
            self.assertTrue(result['mask_glyph_present'])
            self.assertTrue(result['validation']['alphabet'])
        for char in (' ', '\n', '\t', '\x00', '\x1f', '\x7f'):
            result = self.project(KEY + char)
            self.assertTrue(result['whitespace_or_control_present'])
            self.assertFalse(result['suffix_alphabet_member'])
        result = self.project(KEY + 'é')
        self.assertFalse(result['ascii_only'])
        self.assertTrue(result['validation']['alphabet'])
        self.assertFalse(result['whitespace_or_control_present'])

    def test_diversity_placeholder_and_overlapping_failures(self):
        result = self.project('sb_secret_' + 'a' * 40)
        self.assertFalse(result['distinct_at_least_4'])
        self.assertTrue(result['validation']['diversity'])
        for word in diagnostic._PLACEHOLDERS:
            result = self.project('sb_secret_' + word.upper() + 'Ab12' * 10)
            self.assertTrue(result['placeholder_word_present'])
            self.assertTrue(result['validation']['placeholder_word'])
        result = self.project('sb_secret_***')
        for flag in ('length', 'alphabet', 'diversity'):
            self.assertTrue(result['validation'][flag])

    def test_unknown_schema_nonunique_and_non200_stop_before_classification(self):
        raw_cases = (b'not json', b'{}', b'[null]', b'[{}]', b'[{"name": 1}]',
                     b'[{"name":"fixture","type":"unknown"}]',
                     b'[{"name":"fixture","type":3}]',
                     b'[{"name":"fixture","api_key":NaN}]',
                     b'[{"name":"fixture","name":"duplicate"}]', b'\xff')
        for raw in raw_cases:
            result = diagnostic.project_response(200, raw)
            self.assertEqual(result, {'http_outcome': '200', 'response_schema': 'invalid'})
        self.assertEqual(diagnostic.project_response(200, b'x' * (transport.MAX_BYTES + 1)),
                         {'http_outcome': '200', 'response_schema': 'oversized'})
        for raw, match in ((b'[]', 'none'), (response(name='PRIVATE_OTHER_NAME'), 'none'),
                           (response(kind='publishable'), 'none'),
                           (json.dumps(json.loads(response()) * 2).encode(), 'multiple')):
            result = diagnostic.project_response(200, raw)
            self.assertEqual(result['match_count'], match)
            self.assertNotIn('api_key_class', result)
            self.assert_fixed(result)
        for status in (301, 401, 403, 500, None, True):
            self.assertEqual(diagnostic.project_response(status, response()), {'http_outcome': 'non_200'})

    def test_import_default_and_arbitrary_arguments_are_dormant(self):
        importlib.reload(diagnostic)
        for args in ([], ['private argument'], ['--execute', 'private argument']):
            stdout, stderr = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                self.assertEqual(diagnostic.main(args), 2)
            self.assertEqual(stdout.getvalue(), '{"diagnostic":"dormant"}\n')
            self.assertEqual(stderr.getvalue(), '')

    def test_execution_fixture_single_reveal_shared_deadline_only_projection(self):
        calls = []
        def loader(*, deadline):
            calls.append(('loader', deadline))
            return TOKEN
        def getter(mode, credential, deadline):
            self.assertEqual(mode, 'reveal')
            self.assertEqual(credential, TOKEN)
            calls.append(('get', deadline))
            return 200, response()
        with patch.object(transport, 'load_existing_management_token', side_effect=loader), \
             patch.object(transport, '_private_get', side_effect=getter), \
             patch.object(diagnostic.time, 'monotonic', return_value=10):
            stdout, stderr = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                self.assertEqual(diagnostic.main(['--execute']), 0)
        self.assertEqual(calls, [('loader', 70.0), ('get', 70.0)])
        self.assertEqual(stderr.getvalue(), '')
        self.assert_fixed(json.loads(stdout.getvalue()))

    def test_private_exceptions_never_format_and_no_retry(self):
        class PrivateFailure(Exception):
            def __str__(self):
                raise AssertionError('exception formatting forbidden')
            def __repr__(self):
                raise AssertionError('exception repr forbidden')
        for stage in ('lookup', 'reveal'):
            stdout, stderr = io.StringIO(), io.StringIO()
            with patch.object(transport, 'load_existing_management_token',
                              side_effect=PrivateFailure(KEY) if stage == 'lookup' else None,
                              return_value=TOKEN) as loader, \
                 patch.object(transport, '_private_get', side_effect=PrivateFailure(KEY)) as getter, \
                 contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                self.assertEqual(diagnostic.main(['--execute']), 1)
            self.assertIn('error=failed_closed;', stdout.getvalue())
            self.assertEqual(stderr.getvalue(), '')
            self.assertEqual(loader.call_count, 1)
            self.assertEqual(getter.call_count, 0 if stage == 'lookup' else 1)
            self.assertNotIn(KEY, stdout.getvalue())

    def test_deadline_fixed_enum_and_non200_no_fallback(self):
        def expired(*args):
            raise transport.DeadlineExceeded('transport deadline exceeded')
        with patch.object(transport, 'load_existing_management_token', return_value=TOKEN), \
             patch.object(transport, '_private_get', side_effect=expired), \
             contextlib.redirect_stdout(io.StringIO()) as stdout:
            self.assertEqual(diagnostic.main(['--execute']), 1)
        self.assertIn('phase=management_reveal; error=deadline_exceeded;', stdout.getvalue())
        with patch.object(transport, 'load_existing_management_token', return_value=TOKEN), \
             patch.object(transport, '_private_get', return_value=(403, response())) as getter, \
             contextlib.redirect_stdout(io.StringIO()) as stdout:
            self.assertEqual(diagnostic.main(['--execute']), 1)
        getter.assert_called_once()
        self.assertEqual(json.loads(stdout.getvalue()), {'http_outcome': 'non_200'})


if __name__ == '__main__':
    unittest.main()
