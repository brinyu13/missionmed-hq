"""Small memory-only fixtures. Never import transport or retrieve credentials."""
import copy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import threading
import unittest
from unittest.mock import patch, Mock
import source_lease_runner as runner


class FakeClient:
    def __init__(self, fail_at=0, release_fail=False):
        self.calls = []
        self.fail_at = fail_at
        self.release_fail = release_fail

    def heartbeat(self, handle):
        self.calls.append('heartbeat')
        if self.calls.count('heartbeat') == self.fail_at:
            raise RuntimeError('fixture-private-error')
        value = copy.copy(handle)
        value.heartbeat_at = datetime.now(timezone.utc).isoformat()
        return value

    def release(self, handle):
        self.calls.append('release')
        if self.release_fail:
            raise RuntimeError('fixture-private-error')


class FastEvent:
    """Keeper takes one immediate renewal, main loop then sees failure."""
    def __init__(self):
        self.event = threading.Event()
        self.renew = True

    def wait(self, seconds):
        if seconds == runner.INTERVAL and self.renew:
            self.renew = False
            return False
        return self.event.wait(min(seconds, .01))

    def is_set(self):
        return self.event.is_set()

    def set(self):
        self.event.set()


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.actual = runner.snapshot()
        self.binding = 'f' * 64
        self.handle = SimpleNamespace(lease_id='fixture-lease', fencing_epoch=42,
            nonce='fixture-private-nonce', heartbeat_at='2026-10-04T00:00:00Z',
            expires_at=(datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat(),
            resource_key='PATH:fixture')

    def tearDown(self):
        self.temp.cleanup()

    def approval(self):
        return {'schema': 'ir.source_lease.approval.v1', 'verdict': 'APPROVE',
                'independentReviewer': 'fixture-independent', 'contract': copy.deepcopy(self.actual),
                'expiresUnix': 2000}

    def test_approval_hash_paths_base_fail_before_credential_capability(self):
        with patch.object(runner, 'load_module', side_effect=AssertionError('must not import')):
            for field in ('runnerSha256', 'transportSha256', 'workerPacketSha256',
                          'canonicalClientSha256', 'sourceBASE', 'sourceHead', 'osHead', 'writePaths'):
                approval = self.approval()
                approval['contract'][field] = 'mismatch'
                with self.assertRaises(runner.Stop):
                    runner.validate_approval(approval, self.actual, now=1000)
            altered = copy.deepcopy(self.actual)
            altered['sourcePreimages'][runner.PATHS[0]] = 'a' * 64
            with self.assertRaises(runner.Stop):
                runner.validate_approval(self.approval(), altered, now=1000)
            with self.assertRaises(FileNotFoundError):
                runner.execute(self.directory / 'missing', self.directory / 'missing2', self.directory / 'new')

    def test_valid_approval_and_expiry(self):
        value = runner.validate_approval(self.approval(), self.actual, now=1000)
        self.assertEqual(len(value), 64)
        with self.assertRaises(runner.Stop):
            runner.validate_approval(self.approval(), self.actual, now=2000)

    def stop_file(self, action='DONE'):
        runner.atomic(self.directory, 'SOURCE_LEASE_STOP.json',
            {'owner': runner.OWNER, 'action': action, 'leaseId': self.handle.lease_id,
             'bindingSha256': self.binding})

    def test_immediate_heartbeat_ready_and_release(self):
        self.stop_file()
        client = FakeClient()
        self.assertTrue(runner.orchestrate(client, self.handle, self.actual, self.binding,
                                           self.directory, max_seconds=1))
        self.assertEqual(client.calls, ['heartbeat', 'release'])
        ready = runner.read_json(self.directory / 'SOURCE_LEASE_READY.json')
        self.assertEqual(ready['state'], 'SOURCE_LEASE_READY')
        self.assertEqual(ready['sourceHead'], self.actual['sourceHead'])
        self.assertEqual(runner.read_json(self.directory / 'SOURCE_LEASE_STATUS.json')['state'], 'STOP')
        for path in self.directory.iterdir():
            data = path.read_text()
            self.assertNotIn('fixture-private-nonce', data)
            self.assertNotIn('fixture-private-error', data)
            self.assertNotIn('sb_secret_', data)

    def test_initial_renewal_fail_no_ready_finally_release(self):
        client = FakeClient(fail_at=1)
        self.assertFalse(runner.orchestrate(client, self.handle, self.actual, self.binding,
                                            self.directory, max_seconds=1))
        self.assertFalse((self.directory / 'SOURCE_LEASE_READY.json').exists())
        self.assertEqual(client.calls, ['heartbeat', 'release'])

    def test_keeper_failure_stop_finally_release(self):
        client = FakeClient(fail_at=2)
        self.assertFalse(runner.orchestrate(client, self.handle, self.actual, self.binding,
            self.directory, max_seconds=1, stop_event=FastEvent()))
        self.assertEqual(client.calls, ['heartbeat', 'heartbeat', 'release'])
        self.assertEqual(runner.read_json(self.directory / 'SOURCE_LEASE_STATUS.json')['state'], 'STOP')

    def test_wait_bound_and_release_failure_not_success(self):
        client = FakeClient()
        self.assertFalse(runner.orchestrate(client, self.handle, self.actual, self.binding,
                                            self.directory, max_seconds=.02))
        self.assertEqual(client.calls[-1], 'release')
        self.stop_file()
        client = FakeClient(release_fail=True)
        self.assertFalse(runner.orchestrate(client, self.handle, self.actual, self.binding,
                                            self.directory, max_seconds=1))
        self.assertEqual(runner.read_json(self.directory / 'SOURCE_LEASE_RESULT.json')['release'],
                         'RELEASE_FAILED')
        for invalid in (0, 3601, float('nan'), True):
            with self.assertRaises(runner.Stop):
                runner.orchestrate(client, self.handle, self.actual, self.binding,
                                   self.directory, max_seconds=invalid)

    def test_execute_once_and_separate_read_admission(self):
        report = self.directory / 'review.md'
        report.write_text('independent fixture report')
        approval = self.approval()
        approval.update(expiresUnix=__import__('time').time() + 60,
                        reportFile=report.name, reportSha256=runner.digest(report))
        approval_path = self.directory / 'approval.json'
        approval_path.write_bytes(runner.canonical(approval))
        binding = runner.validate_approval(approval, self.actual)
        admission = {'schema': 'ir.source_lease.read_admission.v1', 'verdict': 'APPROVE',
            'independentReviewer': 'fixture-independent', 'bindingSha256': binding,
            'approvalSha256': runner.digest(approval_path), 'maxSeconds': 1,
            'expiresUnix': __import__('time').time() + 60,
            'reportFile': report.name, 'reportSha256': runner.digest(report)}
        admission_path = self.directory / 'admission.json'
        admission_path.write_bytes(runner.canonical(admission))
        client = Mock()
        client.acquire_writer.return_value = self.handle
        constructor = Mock(return_value=client)
        constructor._open_no_redirect = Mock()
        canonical_client = SimpleNamespace(SupabaseLeaseClient=constructor,
                                           path_scope=Mock(return_value='PATH:fixture'))
        transport = SimpleNamespace(retrieve_existing_key=Mock(return_value='fixture-key'),
            authentication_probe=Mock(return_value=200), ApikeyOnlyLeaseOpener=Mock(),
            BASE_URL='fixture-url', PROJECT='fixture-project')
        with patch.object(runner, 'HERE', self.directory), patch.object(runner, 'snapshot', return_value=self.actual), \
             patch.object(runner, 'load_module', side_effect=[transport, canonical_client]) as modules, \
             patch.object(runner, 'orchestrate', return_value=True):
            bad = dict(admission, bindingSha256='wrong')
            admission_path.write_bytes(runner.canonical(bad))
            with self.assertRaises(runner.Stop):
                runner.execute(approval_path, admission_path, self.directory / 'bad', 1)
            modules.assert_not_called()
            admission_path.write_bytes(runner.canonical(admission))
            self.assertTrue(runner.execute(approval_path, admission_path, self.directory / 'run', 1))
            transport.retrieve_existing_key.assert_called_once_with()
            transport.authentication_probe.assert_called_once_with('fixture-key')
            self.assertEqual(client.acquire_writer.call_args.kwargs['write_paths'], runner.PATHS)
            self.assertEqual(client.acquire_writer.call_args.kwargs['binding'], binding)
            with self.assertRaises(FileExistsError):
                runner.execute(approval_path, admission_path, self.directory / 'retry', 1)
            self.assertEqual(modules.call_count, 2)

    def test_worker_guard_stale_terminal_or_wrong_binding_stop(self):
        value = {'state': 'HEALTHY', 'bindingSha256': self.binding,
                 'sourceHead': self.actual['sourceHead'], 'updatedUnix': 1000,
                 'expiresAt': '2099-01-01T00:00:00Z'}
        runner.atomic(self.directory, 'SOURCE_LEASE_STATUS.json', value)
        runner.check_worker_guard(self.directory, self.binding, self.actual['sourceHead'], now=1001)
        for now, binding in ((1010, self.binding), (1001, 'wrong')):
            with self.assertRaises(runner.Stop):
                runner.check_worker_guard(self.directory, binding, self.actual['sourceHead'], now=now)
        value['state'] = 'STOP'
        runner.atomic(self.directory, 'SOURCE_LEASE_STATUS.json', value)
        with self.assertRaises(runner.Stop):
            runner.check_worker_guard(self.directory, self.binding, self.actual['sourceHead'], now=1001)


if __name__ == '__main__':
    unittest.main()
