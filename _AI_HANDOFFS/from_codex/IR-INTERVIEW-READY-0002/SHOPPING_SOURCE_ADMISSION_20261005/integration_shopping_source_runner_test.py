"""Small memory-only fixtures. Never import transport or retrieve credentials."""
import copy
import contextlib
from datetime import datetime, timedelta, timezone
import json
import io
from pathlib import Path
from types import SimpleNamespace
import tempfile
import threading
import unittest
from unittest.mock import patch, Mock
import integration_shopping_source_runner as runner


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
        self.directory = Path(self.temp.name).resolve()
        self.actual = runner.snapshot()
        self.binding = 'f' * 64
        self.handle = SimpleNamespace(lease_id='fixture-lease', fencing_epoch=42,
            nonce='fixture-private-nonce', heartbeat_at='2026-10-04T00:00:00Z',
            expires_at=(datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat(),
            resource_key='PATH:fixture')

    def tearDown(self):
        self.temp.cleanup()

    def approval(self):
        return {'schema': 'ir.shopping_source_lease.approval.v1', 'verdict': 'APPROVE',
                'independentReviewer': 'fixture-independent', 'contract': copy.deepcopy(self.actual),
                'expiresUnix': 2000,
                'shoppingReview': {'schema': 'ir.shopping_source_lease.shopping_review.v1',
                    'verdict': 'APPROVE', 'independentReviewer': 'fixture-recovery-reviewer',
                    'expiresUnix': 2000,
                    'bindingSha256': runner.hashlib.sha256(runner.canonical(self.actual)).hexdigest(),
                    'reportFile': 'recovery.md', 'reportSha256': 'fixture'}}

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
            with self.assertRaises(runner.Stop):
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
        recovery_report = self.directory / 'recovery.md'
        recovery_report.write_text('separate independent recovery fixture report')
        admission_report = self.directory / 'admission.md'
        admission_report.write_text('separate fresh read admission fixture report')
        approval = self.approval()
        approval['shoppingReview'].update(expiresUnix=__import__('time').time() + 60,
            reportSha256=runner.digest(recovery_report))
        approval.update(expiresUnix=__import__('time').time() + 60,
                        reportFile=report.name, reportSha256=runner.digest(report))
        approval_path = self.directory / 'approval.json'
        approval_path.write_bytes(runner.canonical(approval))
        binding = runner.validate_approval(approval, self.actual)
        admission = {'schema': 'ir.shopping_source_lease.read_admission.v1', 'verdict': 'APPROVE',
            'independentReviewer': 'fixture-independent', 'bindingSha256': binding,
            'approvalSha256': runner.digest(approval_path), 'maxSeconds': 1,
            'expiresUnix': __import__('time').time() + 60,
            'reportFile': admission_report.name, 'reportSha256': runner.digest(admission_report)}
        admission_path = self.directory / 'admission.json'
        admission_path.write_bytes(runner.canonical(admission))
        client = Mock()
        client.acquire_writer.return_value = self.handle
        constructor = Mock(return_value=client)
        constructor._open_no_redirect = Mock()
        canonical_client = SimpleNamespace(SupabaseLeaseClient=constructor,
                                           path_scope=Mock(return_value=runner.SCOPE))
        transport = SimpleNamespace(retrieve_existing_key=Mock(return_value='fixture-key'),
            authentication_probe=Mock(return_value=200), ApikeyOnlyLeaseOpener=Mock(),
            BASE_URL='fixture-url', PROJECT='fixture-project')
        with patch.object(runner, 'HERE', self.directory), patch.object(runner, 'snapshot', return_value=self.actual), \
             patch.object(runner, 'load_module', side_effect=[canonical_client, transport, canonical_client]) as modules, \
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
            self.assertEqual(modules.call_count, 3)
            kwargs = client.acquire_writer.call_args.kwargs
            self.assertEqual(kwargs['shared_domains'], [])
            self.assertTrue(kwargs['session_id'].startswith('ir-phase1-shopping-source-20261005-'))

    def test_actual_canonical_scope_before_credential_capability(self):
        canonical_client = runner.load_module('fixture_actual_canonical_lease',
            runner.OS_ROOT / 'tools/engineering_os_lease.py', self.actual['canonicalClientSha256'])
        scope = canonical_client.path_scope(runner.ORIGIN, runner.REF, 'interview-ready')
        self.assertTrue(scope.startswith('PATH:'))
        self.assertEqual(len(scope), 69)
        with self.assertRaises(canonical_client.LeaseDenied):
            canonical_client.path_scope(runner.ORIGIN, 'codex/bare-ref', 'interview-ready')
        approval = self.approval()
        approval['shoppingReview'].update(expiresUnix=__import__('time').time() + 60)
        approval.update(expiresUnix=__import__('time').time() + 60,
                        reportFile='fixture.md', reportSha256='fixture')
        admission = {'schema': 'ir.shopping_source_lease.read_admission.v1', 'verdict': 'APPROVE',
            'independentReviewer': 'fixture-independent',
            'bindingSha256': runner.validate_approval(approval, self.actual),
            'approvalSha256': 'fixture', 'maxSeconds': 1,
            'expiresUnix': __import__('time').time() + 60,
            'reportFile': 'admission.md', 'reportSha256': 'fixture'}
        # Gate fixtures admit only local controls; actual canonical helper rejects ref.
        with patch.object(runner, 'snapshot', return_value=self.actual), \
             patch.object(runner, 'read_json', side_effect=[approval, admission]), \
             patch.object(runner, 'digest', return_value='fixture'), \
             patch.object(runner, 'REF', 'codex/bare-ref'), \
             patch.object(runner, 'load_module', return_value=canonical_client) as modules:
            with self.assertRaises(runner.Stop):
                runner.execute(self.directory / 'approval.json', self.directory / 'admission.json',
                               self.directory / 'must-not-exist', 1)
            modules.assert_not_called()
            self.assertFalse((self.directory / 'must-not-exist').exists())

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

    def test_terminal_status_or_result_write_failure_releases_and_stops(self):
        original = runner.atomic
        for failed_name in ('SOURCE_LEASE_STATUS.json', 'SOURCE_LEASE_RESULT.json'):
            with self.subTest(failed_name=failed_name), tempfile.TemporaryDirectory() as name:
                directory = Path(name)
                runner.atomic(directory, 'SOURCE_LEASE_STOP.json',
                    {'owner': runner.OWNER, 'action': 'DONE', 'leaseId': self.handle.lease_id,
                     'bindingSha256': self.binding})
                def fault(location, filename, value):
                    if filename == failed_name and (filename.endswith('RESULT.json') or value['state'] == 'STOP'):
                        raise OSError(28, 'fixture-key fixture-private-nonce fixture-private-error')
                    return original(location, filename, value)
                client = FakeClient()
                output = io.StringIO()
                with patch.object(runner, 'atomic', side_effect=fault), contextlib.redirect_stderr(output):
                    self.assertFalse(runner.orchestrate(client, self.handle, self.actual,
                        self.binding, directory, max_seconds=1))
                self.assertEqual(client.calls, ['heartbeat', 'release'])
                self.assertIn('"errno":28', output.getvalue())
                self.assertNotIn('fixture-', output.getvalue())
                self.assertTrue((directory / 'SOURCE_LEASE_FAILURE.json').is_file())
                with self.assertRaises(runner.Stop):
                    runner.check_worker_guard(directory, self.binding, self.actual['sourceHead'])
                if failed_name.endswith('STATUS.json'):
                    result = runner.read_json(directory / 'SOURCE_LEASE_RESULT.json')
                    self.assertEqual(result['outcome'], 'STOP')
                    self.assertEqual(result['release'], 'RELEASED')
                else:
                    self.assertFalse((directory / 'SOURCE_LEASE_RESULT.json').exists())
                for path in directory.iterdir():
                    self.assertNotIn('fixture-private-', path.read_text())
                    self.assertNotIn('fixture-key', path.read_text())

    def test_all_receipt_writes_fail_still_attempts_release(self):
        client = FakeClient(release_fail=True)
        with patch.object(runner, 'atomic', side_effect=OSError(28, 'fixture-private-secret')), \
             contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertFalse(runner.orchestrate(client, self.handle, self.actual,
                self.binding, self.directory, max_seconds=1))
        self.assertEqual(client.calls, ['release'])
        self.assertIn('"phase":"RELEASE"', output.getvalue())
        self.assertNotIn('fixture-private-secret', output.getvalue())
        self.assertFalse((self.directory / 'SOURCE_LEASE_READY.json').exists())
        self.assertFalse((self.directory / 'SOURCE_LEASE_RESULT.json').exists())

    def test_healthy_status_write_failure_stops_before_ready_and_releases(self):
        original = runner.atomic
        def fault(directory, filename, value):
            if filename == 'SOURCE_LEASE_STATUS.json' and value['state'] == 'HEALTHY':
                raise OSError(28, 'fixture-key fixture-private-nonce')
            return original(directory, filename, value)
        client = FakeClient()
        with patch.object(runner, 'atomic', side_effect=fault), contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertFalse(runner.orchestrate(client, self.handle, self.actual,
                self.binding, self.directory, max_seconds=1))
        self.assertEqual(client.calls, ['heartbeat', 'release'])
        self.assertFalse((self.directory / 'SOURCE_LEASE_READY.json').exists())
        self.assertEqual(runner.read_json(self.directory / 'SOURCE_LEASE_STATUS.json')['state'], 'STOP')
        self.assertIn('"phase":"HEALTHY_STATUS"', output.getvalue())
        self.assertNotIn('fixture-', output.getvalue())

    def test_fresh_repair_requires_independent_review_and_exact_base(self):
        self.assertEqual(self.actual['sourceBASE'], '3c72c5b8399d2bc8ab7e849052230cbf80d33da8')
        self.assertEqual(self.actual['originalSourcePreimages'], runner.BASE_PREIMAGES)
        self.assertEqual(self.actual['sourcePreimages'], runner.BASE_PREIMAGES)
        self.assertEqual(self.actual['writePaths'], [
            'interview-ready/completion.js', 'interview-ready/completion.css',
            'interview-ready/phase1.js', 'interview-ready/phase1.css'])
        runner.validate_approval(self.approval(), self.actual, now=1000)
        for change in ('missing', 'stale', 'owner', 'builder', 'binding'):
            approval = self.approval()
            if change == 'missing':
                approval.pop('shoppingReview')
            elif change == 'stale':
                approval['shoppingReview']['expiresUnix'] = 999
            elif change == 'owner':
                approval['shoppingReview']['independentReviewer'] = runner.OWNER
            elif change == 'builder':
                approval['shoppingReview']['independentReviewer'] = runner.BUILDER
            else:
                approval['shoppingReview']['bindingSha256'] = 'wrong'
            with self.assertRaises(runner.Stop):
                runner.validate_approval(approval, self.actual, now=1000)
        for field in ('sourcePreimages', 'originalSourcePreimages'):
            altered = copy.deepcopy(self.actual)
            altered[field]['interview-ready/completion.js'] = 'wrong'
            with self.assertRaises(runner.Stop):
                runner.validate_approval(self.approval(), altered, now=1000)

    def test_old_recovery_controls_and_packet_rejected(self):
        approval = self.approval()
        approval['schema'] = 'ir.integration_source_lease.approval.v1'
        approval['recoveryReview'] = approval.pop('shoppingReview')
        with self.assertRaises(runner.Stop):
            runner.validate_approval(approval, self.actual, now=1000)
        altered = copy.deepcopy(self.actual)
        altered['shoppingPacket']['writePaths'].append('_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json')
        approval = self.approval()
        approval['contract'] = altered
        with self.assertRaises(runner.Stop):
            runner.validate_approval(approval, altered, now=1000)

    def test_old_read_admission_rejected_before_any_capability(self):
        now = __import__('time').time()
        approval = self.approval()
        approval['expiresUnix'] = now + 60
        approval['shoppingReview']['expiresUnix'] = now + 60
        admission = {'schema': 'ir.live_render_source_lease.read_admission.v1',
            'verdict': 'APPROVE', 'independentReviewer': 'fixture-independent',
            'bindingSha256': runner.validate_approval(approval, self.actual),
            'approvalSha256': 'fixture', 'maxSeconds': 1, 'expiresUnix': now + 60}
        with patch.object(runner, 'snapshot', return_value=self.actual), \
             patch.object(runner, 'read_json', side_effect=[approval, admission]), \
             patch.object(runner, 'digest', return_value='fixture'), \
             patch.object(runner, 'load_module') as modules:
            with self.assertRaises(runner.Stop):
                runner.execute(self.directory / 'approval.json', self.directory / 'read.json',
                               self.directory / 'no-controls', 1)
            modules.assert_not_called()
            self.assertFalse((self.directory / 'no-controls').exists())

    def test_cancellation_attempts_release_without_false_ready(self):
        client = FakeClient()
        with patch.object(client, 'heartbeat', side_effect=KeyboardInterrupt()), \
             contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertFalse(runner.orchestrate(client, self.handle, self.actual,
                self.binding, self.directory, max_seconds=1))
        self.assertEqual(client.calls, ['release'])
        self.assertFalse((self.directory / 'SOURCE_LEASE_READY.json').exists())
        self.assertIn('"errorClass":"INTERRUPTED"', output.getvalue())
        self.assertEqual(runner.read_json(self.directory / 'SOURCE_LEASE_RESULT.json')['release'], 'RELEASED')

    def test_actual_new_custody_head_is_bound_without_fixed_self_hash_loop(self):
        actual = copy.deepcopy(self.actual)
        actual['sourceHead'] = 'c' * 40
        approval = self.approval()
        approval['contract'] = actual
        approval['shoppingReview']['bindingSha256'] = runner.hashlib.sha256(runner.canonical(actual)).hexdigest()
        runner.validate_approval(approval, actual, now=1000)
        with self.assertRaises(runner.Stop):
            runner.validate_approval(self.approval(), actual, now=1000)

    def test_changed_worker_head_stops_even_with_healthy_receipt(self):
        runner.atomic(self.directory, 'SOURCE_LEASE_STATUS.json',
            {'state': 'HEALTHY', 'bindingSha256': self.binding,
             'sourceHead': self.actual['sourceHead'], 'updatedUnix': 1000,
             'expiresAt': '2099-01-01T00:00:00Z'})
        with patch.object(runner, 'head', return_value='changed-head'):
            with self.assertRaises(runner.Stop):
                runner.check_worker_guard(self.directory, self.binding, self.actual['sourceHead'], now=1001)


    def test_shopping_evidence_scope_and_original_product_pins(self):
        self.assertEqual(self.actual['scope'], runner.SCOPE)
        self.assertEqual(self.actual['sharedDomains'], [])
        self.assertEqual(self.actual['acceptedProductPreimages'], runner.BASE_PREIMAGES)
        self.assertEqual(self.actual['patternRunnerSha256'], runner.PATTERN_SHA)
        for field in ('acceptedProductCommit','acceptedProductPreimages','patternRunnerSha256',
                      'shoppingPatchSha256','shoppingReviewSha256','shoppingTestsSha256',
                      'founderSteerSha256','scope','sharedDomains','origin','ref','owner','relativePath'):
            altered = copy.deepcopy(self.actual)
            altered[field] = 'wrong'
            with self.subTest(field=field), self.assertRaises(runner.Stop):
                runner.validate_approval(self.approval(), altered, now=1000)

    def test_all_old_controls_and_expanded_path_scope_fail(self):
        for schema in ('ir.integration_source_lease.approval.v1',
                       'ir.live_render_source_lease.approval.v1',
                       'ir.production_lease.approval.v1'):
            approval = self.approval()
            approval['schema'] = schema
            with self.assertRaises(runner.Stop):
                runner.validate_approval(approval,self.actual,now=1000)
        for extra in ('interview-ready/account.js','interview-ready/dist/interview-ready.html',
                      'interview-ready/integration/missionmed-interview-ready.php'):
            actual=copy.deepcopy(self.actual);actual['writePaths'].append(extra)
            with self.assertRaises(runner.Stop):
                runner.validate_approval(self.approval(),actual,now=1000)

    def test_control_expiry_nan_and_custody_binding(self):
        for expiry in (999,1000,4601,float('nan'),float('inf'),True):
            approval=self.approval();approval['expiresUnix']=expiry
            with self.assertRaises(runner.Stop):
                runner.validate_approval(approval,self.actual,now=1000)
        actual=copy.deepcopy(self.actual);actual['sourceHead']='0'*40
        with self.assertRaises(runner.Stop):
            runner.validate_approval(self.approval(),actual,now=1000)

    def test_direct_child_control_directory_checked_before_any_import(self):
        with patch.object(runner,'load_module') as modules:
            with self.assertRaises(runner.Stop):
                runner.execute(self.directory/'missing',self.directory/'missing2',
                               self.directory/'not-authorized-here',1)
            modules.assert_not_called()

    def test_execute_invalid_wait_rejected_before_any_capability(self):
        with patch.object(runner,'load_module') as modules:
            for wait in (0,3601,True,float('nan'),1.5):
                with self.assertRaises(runner.Stop):
                    runner.execute(self.directory/'a',self.directory/'r',self.directory/'new',wait)
            modules.assert_not_called()

    def test_guard_and_orchestration_function_bytes_match_immutable_pattern(self):
        import subprocess
        old=subprocess.check_output(['git','--no-replace-objects','-C',str(runner.ROOT),'show',
            runner.ACCEPTED_PRODUCT+':_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner.py']).decode()
        new=Path(runner.__file__).read_text()
        for function,next_function in [('check_worker_guard','orchestrate'),('orchestrate','execute')]:
            original=old[old.index('def '+function+'('):old.index('def '+next_function+'(')]
            candidate=new[new.index('def '+function+'('):new.index('def '+next_function+'(')]
            self.assertEqual(original,candidate)

    def test_foreman_drains_cooperative_worker_before_done_and_release(self):
        import time
        stopped=threading.Event();drained=threading.Event();started=threading.Event();mutations=[]
        def worker():
            try:
                while not stopped.is_set():
                    if (self.directory/'SOURCE_LEASE_STATUS.json').exists():
                        runner.check_worker_guard(self.directory,self.binding,self.actual['sourceHead'])
                        mutations.append('fixture-memory-only-write');started.set()
                    stopped.wait(.01)
            finally:drained.set()
        class DrainClient(FakeClient):
            def release(client,handle):
                self.assertTrue(drained.is_set(),'Foreman must observe worker drained before release')
                super().release(handle)
        client=DrainClient();result=[]
        coordinator=threading.Thread(target=lambda:result.append(runner.orchestrate(client,self.handle,
            self.actual,self.binding,self.directory,max_seconds=2)))
        work=threading.Thread(target=worker);coordinator.start();work.start()
        self.assertTrue(started.wait(1));stopped.set();work.join(1);self.assertTrue(drained.is_set())
        before=len(mutations);self.stop_file();coordinator.join(2)
        self.assertFalse(coordinator.is_alive());self.assertEqual(result,[True]);self.assertEqual(len(mutations),before)
        with self.assertRaises(runner.Stop):
            runner.check_worker_guard(self.directory,self.binding,self.actual['sourceHead'])
        self.assertEqual(client.calls,['heartbeat','release'])

    def test_read_reports_require_distinct_actual_digests_before_capability(self):
        now=__import__('time').time();approval=self.approval()
        approval['expiresUnix']=approval['shoppingReview']['expiresUnix']=now+60
        approval.update(reportFile='implementation.md',reportSha256='same')
        approval['shoppingReview'].update(reportFile='shopping.md',reportSha256='same')
        admission={'schema':'ir.shopping_source_lease.read_admission.v1','verdict':'APPROVE',
            'independentReviewer':'fixture-independent','bindingSha256':runner.validate_approval(approval,self.actual),
            'approvalSha256':'fixture','maxSeconds':1,'expiresUnix':now+60,
            'reportFile':'read.md','reportSha256':'same'}
        with patch.object(runner,'HERE',self.directory),patch.object(runner,'snapshot',return_value=self.actual), \
             patch.object(runner,'read_json',side_effect=[approval,admission]), \
             patch.object(runner,'digest',return_value='fixture'),patch.object(runner,'load_module') as modules:
            with self.assertRaises(runner.Stop):
                runner.execute(self.directory/'a',self.directory/'r',self.directory/'new',1)
            modules.assert_not_called()
            self.assertFalse((self.directory/'new').exists())


if __name__ == '__main__':
    unittest.main()
