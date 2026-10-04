"""Focused local mocks only; no SSH/provider/native creation or product writes."""
import concurrent.futures
import contextlib
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('runtime_native_fixture',Path(__file__).with_name('runtime_native_runner.py'))
runner=importlib.util.module_from_spec(spec);sys.modules[spec.name]=runner;spec.loader.exec_module(runner)


class Client:
    def __init__(self):
        self.calls=[];self.changed=False;self.expired=False;self.active=0;self.max_active=0

    def heartbeat(self, handle):
        self.calls.append('heartbeat');self.active+=1;self.max_active=max(self.max_active,self.active)
        try:
            time.sleep(.005)
            value=copy.copy(handle)
            value.expires_at=(datetime.now(timezone.utc)+timedelta(seconds=30)).isoformat()
            if self.changed:value.fencing_epoch+=1
            if self.expired:value.expires_at='2000-01-01T00:00:00Z'
            return value
        finally:self.active-=1

    def release(self, handle):self.calls.append('release')


class Fixtures(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='ir-runtime-native-fixture-')
        self.directory=Path(self.tmp.name).resolve()
        self.handle=SimpleNamespace(lease_id='fixture-private-id',fencing_epoch=1,nonce='fixture-private-nonce',
            expires_at=(datetime.now(timezone.utc)+timedelta(seconds=30)).isoformat())
        self.contract={'phase':'install','sourceHead':'1'*40,'runnerSha256':'2'*64,'testsSha256':'3'*64,
            'sourcePreimages':{},'authority':runner.AUTHORITY,
            'spec':{'controlDirectory':str(self.directory/'control'),
                    'runtimeBindings':{k:'4'*64 for k in runner.RUNTIME_KEYS}}}

    def tearDown(self):self.tmp.cleanup()

    def session(self, phase='install', client=None, readback=None, seconds=5):
        contract=copy.deepcopy(self.contract);contract['phase']=phase
        return runner.Session(client or Client(),self.handle,contract,'5'*64,self.directory,seconds,
            actual_snapshot=lambda *args:contract,readback=readback or Mock(return_value=contract['spec']['runtimeBindings']))

    def stop_file(self, session):
        runner.atomic(self.directory,'STOP.json',{'action':'DONE','owner':runner.OWNER,'phase':'install',
            'bindingSha256':session.binding,'fenceSha256':session.initial_fence})

    def test_default_missing_final_artifacts_and_bad_phase_have_no_capability(self):
        with patch.object(runner,'load_module',side_effect=AssertionError('no provider')), \
             patch.object(runner.subprocess,'Popen',side_effect=AssertionError('no SSH')):
            output=io.StringIO()
            with contextlib.redirect_stdout(output):self.assertEqual(runner.main([]),0)
            self.assertIn('DORMANT',output.getvalue())
            for phase in ('install','auth','other'):
                with self.assertRaises(runner.Stop):runner.snapshot(phase,{})
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(runner.main(['--execute','--phase','auth']),1)
            output=io.StringIO()
            with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):
                self.assertEqual(runner.main(['--private=fixture-private-value']),1)
            self.assertNotIn('fixture-private',output.getvalue())

    def test_exact_canonical_phase_scopes_and_no_other_domain(self):
        module=runner.load_module('runtime_native_canonical_fixture',runner.OS_ROOT/'tools/engineering_os_lease.py',runner.CLIENT_SHA)
        self.assertTrue(runner.scope_for(module,'install').startswith('PATH:'))
        self.assertEqual(runner.scope_for(module,'auth'),'SHARED:AUTH')
        self.assertEqual(runner.DOMAINS['install'],('MATRIX-SHELL',))
        self.assertEqual(runner.DOMAINS['auth'],('AUTH',))
        with self.assertRaises(runner.Stop):runner.scope_for(module,'global')
        with self.assertRaises(module.LeaseDenied):
            module.validate_writer_scope('SHARED:AUTH',runner.PHASE_PATHS['auth'],shared_domains=['AUTH','MATRIX-SHELL'])

    def test_approval_read_binding_expiry_and_independence(self):
        contract=self.contract
        approval={'schema':'ir.runtime_native.approval.v1','phase':'install','contract':contract,
            'reportFile':'IMPLEMENTATION.md','verdict':'APPROVE','independentReviewer':'fixture-independent',
            'reportSha256':'6'*64,'expiresUnix':time.time()+60}
        binding=hashlib.sha256(runner.canonical(contract)).hexdigest()
        admission={'schema':'ir.runtime_native.read_admission.v1','phase':'install','bindingSha256':binding,
            'approvalSha256':'7'*64,'maxSeconds':1,'reportFile':'READ.md','verdict':'APPROVE',
            'independentReviewer':'fixture-independent','reportSha256':'8'*64,'expiresUnix':time.time()+60}
        with patch.object(runner,'digest',return_value='6'*64):runner.report_record(approval)
        for reviewer in (runner.OWNER,runner.BUILDER,''):
            with self.assertRaises(runner.Stop):runner.report_record(dict(approval,independentReviewer=reviewer))
        with patch.object(runner,'report_record',side_effect=lambda v:v):
            self.assertEqual(runner.validate_controls('install',approval,admission,contract,'7'*64,1),binding)
            for wrong in (dict(admission,bindingSha256='wrong'),dict(admission,approvalSha256='wrong'),
                          dict(admission,expiresUnix=time.time()-1),dict(admission,phase='auth'),
                          dict(admission,reportFile='IMPLEMENTATION.md')):
                with self.assertRaises(runner.Stop):runner.validate_controls('install',approval,wrong,contract,'7'*64,1)

    def test_renewal_detects_expiry_fence_and_source_drift(self):
        for field in ('changed','expired'):
            client=Client();setattr(client,field,True);session=self.session(client=client)
            with self.assertRaises(runner.Stop):session.renew()
        session=self.session();session.actual_snapshot=lambda *args:{'drift':True}
        with self.assertRaises(runner.Stop):session.renew()
        self.assertEqual(session.client.calls,[])

    def test_install_stop_and_receipt_failure_still_release(self):
        for failure in (None,'READY.json','STATUS.json','RESULT.json'):
            with self.subTest(failure=failure),tempfile.TemporaryDirectory(prefix='ir-runtime-receipt-fixture-') as tmp:
                session=self.session();session.directory=Path(tmp).resolve()
                runner.atomic(session.directory,'STOP.json',{'action':'DONE','owner':runner.OWNER,'phase':'install',
                    'bindingSha256':session.binding,'fenceSha256':session.initial_fence})
                original=runner.atomic
                def write(directory,name,value):
                    if name==failure and (name!='STATUS.json' or value['state']=='STOP'):
                        raise OSError(28,'fixture-private-nonce')
                    return original(directory,name,value)
                with patch.object(runner,'atomic',side_effect=write):result=runner.run_session(session)
                self.assertEqual(session.client.calls[-1],'release')
                self.assertTrue((result is not None)==(failure is None))
                for path in session.directory.iterdir():
                    self.assertNotIn('fixture-private',path.read_text())

    def test_all_receipts_fail_attempts_release_and_leaks_no_private_values(self):
        session=self.session()
        with patch.object(runner,'atomic',side_effect=OSError(28,'fixture-private-nonce')):
            self.assertIsNone(runner.run_session(session))
        self.assertEqual(session.client.calls,['release'])
        self.assertEqual(repr(session),'<Session private>')

    def test_pure_install_guard_current_binding_and_failure_marker(self):
        session=self.session(seconds=60);session.renew()
        runner.atomic(self.directory,'READY.json',session.status('READY'))
        with patch.object(runner,'snapshot',return_value=session.contract):
            runner.check_install_guard(self.directory,session.binding,session.contract)
            with self.assertRaises(runner.Stop):runner.check_install_guard(self.directory,'wrong',session.contract)
            runner.atomic(self.directory,'FAILURE.json',{'state':'STOP'})
            with self.assertRaises(runner.Stop):runner.check_install_guard(self.directory,session.binding,session.contract)

    def operation(self,session,state='ACTIVE'):
        start=time.time()
        return {'schema':runner.MANUAL_SCHEMA,'bindingSha256':session.binding,'fenceSha256':session.initial_fence,
            'operation':'publish-pointer','operationId':'11111111-1111-4111-8111-111111111111',
            'startUnix':start,'deadlineUnix':start+10,'state':state}

    def test_install_deadline_stable_and_dispatch_margin_stop(self):
        session=self.session(seconds=60);session.renew()
        ready=session.status('READY');runner.atomic(self.directory,'READY.json',ready)
        with patch.object(runner,'snapshot',return_value=session.contract):
            status=runner.check_install_guard(self.directory,session.binding,session.contract)
            self.assertEqual(status['deadlineUnix'],ready['deadlineUnix'])
            session.renew();self.assertEqual(session.status('HEALTHY')['deadlineUnix'],ready['deadlineUnix'])
            for override in ({'deadlineUnix':time.time()+1},{'expiresAt':(datetime.now(timezone.utc)+timedelta(seconds=1)).isoformat()},
                             {'fenceSha256':'0'*64},{'state':'STOP'}):
                runner.atomic(self.directory,'STATUS.json',dict(status,**override))
                with self.assertRaises(runner.Stop):runner.check_install_guard(self.directory,session.binding,session.contract)

    def test_actual_delayed_operation_finishes_before_install_release(self):
        trace=[];client=Client();original=client.release
        def release(handle):trace.append('release');original(handle)
        client.release=release;session=self.session(client=client,seconds=.05)
        errors=[]
        def delayed():
            try:
                limit=time.monotonic()+1
                while not (self.directory/'READY.json').exists():
                    if time.monotonic()>limit:raise AssertionError('fixture readiness')
                    time.sleep(.002)
                marker=self.operation(session);runner.atomic(self.directory,'MANUAL_OPERATION.json',marker)
                trace.append('dispatch');time.sleep(.4);trace.append('complete')
                runner.atomic(self.directory,'MANUAL_OPERATION.json',dict(marker,state='COMPLETE'))
            except BaseException as error:errors.append(error)
        worker=threading.Thread(target=delayed);worker.start()
        self.assertIsNone(runner.run_session(session));worker.join(1)
        self.assertFalse(worker.is_alive());self.assertEqual(errors,[])
        self.assertEqual(trace,['dispatch','complete','release'])
        self.assertEqual(runner.read_json(self.directory/'RESULT.json')['release'],'RELEASED')
        self.assertEqual(runner.read_json(self.directory/'STATUS.json')['state'],'STOP')

    def test_canonical_ttl30_accepts25_server_remaining_but_requires30_session(self):
        session=self.session(seconds=60);session.renew()
        ready=session.status('READY');runner.atomic(self.directory,'READY.json',ready)
        status=session.status('HEALTHY')
        status['expiresAt']=(datetime.now(timezone.utc)+timedelta(seconds=25)).isoformat()
        runner.atomic(self.directory,'STATUS.json',status)
        with patch.object(runner,'snapshot',return_value=session.contract):
            self.assertEqual(runner.check_install_guard(self.directory,session.binding,session.contract),status)
            for remaining in (19,9,-1):
                runner.atomic(self.directory,'STATUS.json',dict(status,
                    expiresAt=(datetime.now(timezone.utc)+timedelta(seconds=remaining)).isoformat()))
                with self.assertRaises(runner.Stop):runner.check_install_guard(self.directory,session.binding,session.contract)
            short=time.time()+29
            runner.atomic(self.directory,'READY.json',dict(ready,deadlineUnix=short))
            runner.atomic(self.directory,'STATUS.json',dict(status,deadlineUnix=short))
            with self.assertRaises(runner.Stop):runner.check_install_guard(self.directory,session.binding,session.contract)

    def test_owned_active_drain_renews_same_ttl30_fence_with_stop_only(self):
        session=self.session(seconds=.05);trace=[];errors=[];original=session.client.heartbeat
        def heartbeat(handle):
            self.assertEqual(runner.fence(handle),session.initial_fence)
            if session.closing:
                self.assertEqual(runner.read_json(self.directory/'STATUS.json')['state'],'STOP')
                trace.append('drain-renew')
                with patch.object(runner,'snapshot',return_value=session.contract):
                    with self.assertRaises(runner.Stop):runner.check_install_guard(self.directory,session.binding,session.contract)
            return original(handle)
        session.client.heartbeat=heartbeat
        original_release=session.client.release
        def release(handle):trace.append('release');original_release(handle)
        session.client.release=release
        def delayed():
            try:
                limit=time.monotonic()+1
                while not (self.directory/'READY.json').exists():
                    if time.monotonic()>limit:raise AssertionError('fixture readiness')
                    time.sleep(.002)
                marker=self.operation(session);runner.atomic(self.directory,'MANUAL_OPERATION.json',marker)
                time.sleep(.4)
                runner.atomic(self.directory,'MANUAL_OPERATION.json',dict(marker,state='COMPLETE'));trace.append('complete')
            except BaseException as error:errors.append(error)
        worker=threading.Thread(target=delayed);worker.start()
        # Accelerate the five-second renewal cadence, not operation/lease time.
        with patch.object(runner,'MANUAL_RENEW_SECONDS',.05):self.assertIsNone(runner.run_session(session))
        worker.join(1);self.assertFalse(worker.is_alive());self.assertEqual(errors,[])
        self.assertGreaterEqual(trace.count('drain-renew'),2)
        self.assertEqual(trace[-2:],['complete','release'])
        self.assertEqual(runner.read_json(self.directory/'STATUS.json')['state'],'STOP')
        self.assertEqual(runner.read_json(self.directory/'RESULT.json')['release'],'RELEASED')
        self.assertEqual(runner.manual_operation_record(self.directory,session.binding,session.initial_fence)['state'],'COMPLETE')

    def test_drain_failed_renewal_or_prior_drift_defers_without_reviving_lease(self):
        for mode in ('failure','fence','expired','prior-expiry','source'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory(prefix='ir-drain-renew-fixture-') as tmp:
                session=self.session();session.directory=Path(tmp).resolve();session.closing=True
                marker=self.operation(session);runner.atomic(session.directory,'MANUAL_OPERATION.json',marker)
                runner.atomic(session.directory,'STATUS.json',session.status('STOP'))
                if mode=='failure':session.client.heartbeat=Mock(side_effect=runner.Stop())
                elif mode=='fence':session.client.changed=True
                elif mode=='expired':session.client.expired=True
                elif mode=='prior-expiry':session.handle.expires_at='2000-01-01T00:00:00Z'
                else:session.actual_snapshot=lambda *a:{'drift':True}
                self.assertFalse(runner.drain_manual_operation(session,seconds=.1))
                self.assertNotIn('release',session.client.calls)
                if mode in {'prior-expiry','source'}:self.assertEqual(session.client.calls,[])
                self.assertEqual(runner.read_json(session.directory/'STATUS.json')['state'],'STOP')
                self.assertEqual(runner.read_json(session.directory/'MANUAL_OPERATION.json'),marker)

    def test_uncertain_invalid_and_active_timeout_defer_release_without_cleanup(self):
        for state in ('UNCERTAIN','ACTIVE','invalid'):
            with self.subTest(state=state),tempfile.TemporaryDirectory(prefix='ir-drain-fixture-') as tmp:
                session=self.session();session.directory=Path(tmp).resolve()
                marker=self.operation(session,state if state!='invalid' else 'COMPLETE')
                if state=='invalid':marker['private_extra']='fixture-private-value'
                runner.atomic(session.directory,'MANUAL_OPERATION.json',marker)
                self.stop_file_for(session)
                with patch.object(runner,'MANUAL_DRAIN_SECONDS',.05):self.assertIsNone(runner.run_session(session))
                self.assertNotIn('release',session.client.calls)
                self.assertEqual(runner.read_json(session.directory/'RESULT.json')['release'],'RELEASE_DEFERRED')
                self.assertEqual(runner.read_json(session.directory/'MANUAL_OPERATION.json'),marker)
                self.assertNotIn('fixture-private', (session.directory/'RESULT.json').read_text())

    def stop_file_for(self,session):
        runner.atomic(session.directory,'STOP.json',{'action':'DONE','owner':runner.OWNER,'phase':'install',
            'bindingSha256':session.binding,'fenceSha256':session.initial_fence})

    def test_closed_marker_schema_and_drift_defer(self):
        session=self.session();valid=self.operation(session,'COMPLETE')
        for override in ({'schema':'other'},{'bindingSha256':'0'*64},{'fenceSha256':'0'*64},
                         {'operation':'unknown'},{'operationId':'private'}, {'startUnix':True},
                         {'deadlineUnix':float('inf')},{'deadlineUnix':valid['startUnix']+11}):
            marker=dict(valid,**override)
            if override.get('deadlineUnix')==float('inf'):
                # Bad external JSON may contain nonfinite values; normal atomic
                # writer deliberately refuses these itself.
                (self.directory/'MANUAL_OPERATION.json').write_text(json.dumps(marker))
            else:runner.atomic(self.directory,'MANUAL_OPERATION.json',marker)
            with self.assertRaises(runner.Stop):runner.manual_operation_record(self.directory,session.binding,session.initial_fence)
        runner.atomic(self.directory,'MANUAL_OPERATION.json',valid)
        session.actual_snapshot=lambda *a:{'changed':True}
        self.assertFalse(runner.drain_manual_operation(session,seconds=.01))
        session.actual_snapshot=lambda *a:session.contract;session.handle=copy.copy(session.handle);session.handle.fencing_epoch+=1
        self.assertFalse(runner.drain_manual_operation(session,seconds=.01))

    def test_per_artifact_review_roles_preserve_wrapper_independence(self):
        record={'verdict':'APPROVE','independentReviewer':runner.BUILDER,'reportFile':'REVIEW.md','reportSha256':'6'*64}
        with patch.object(runner,'digest',return_value='6'*64):
            with self.assertRaises(runner.Stop):runner.report_record(record)
            runner.report_record(record,role='install_artifact')
            for role in ('wrapper','install_artifact'):
                for author in (runner.OWNER,runner.MANUAL_BUILDER):
                    with self.assertRaises(runner.Stop):runner.report_record(dict(record,independentReviewer=author),role=role)

    def test_closing_prevents_inflight_keeper_healthy_republication(self):
        entered=threading.Event();finish=threading.Event();client=Client();errors=[]
        def heartbeat(handle):entered.set();finish.wait(1);return handle
        client.heartbeat=heartbeat;session=self.session(client=client)
        def renew():
            try:session.renew()
            except runner.Stop:errors.append('STOP')
        worker=threading.Thread(target=renew);worker.start();self.assertTrue(entered.wait(1))
        session.closing=True;runner.atomic(self.directory,'STATUS.json',session.status('STOP'));finish.set();worker.join(1)
        self.assertFalse(worker.is_alive());self.assertEqual(errors,['STOP'])
        self.assertEqual(runner.read_json(self.directory/'STATUS.json')['state'],'STOP')

    def test_actual_active_marker_disappearance_defers_release(self):
        session=self.session();marker=self.operation(session)
        runner.atomic(self.directory,'MANUAL_OPERATION.json',marker);self.stop_file_for(session)
        observed=threading.Event();errors=[];original=runner.manual_operation_record
        def read_marker(*args):
            value=original(*args)
            if value is not None and value['state']=='ACTIVE':observed.set()
            return value
        def lose_marker():
            try:
                if not observed.wait(1):raise AssertionError('ACTIVE not observed')
                (self.directory/'MANUAL_OPERATION.json').unlink()
            except BaseException as error:errors.append(error)
        worker=threading.Thread(target=lose_marker);worker.start()
        with patch.object(runner,'manual_operation_record',side_effect=read_marker):
            self.assertIsNone(runner.run_session(session))
        worker.join(1);self.assertFalse(worker.is_alive());self.assertEqual(errors,[])
        self.assertNotIn('release',session.client.calls)
        self.assertEqual(runner.read_json(self.directory/'RESULT.json')['release'],'RELEASE_DEFERRED')

    def test_native_adapter_serializes_guard_only_and_stamps_actual_readback(self):
        session=self.session('auth');reads=[]
        def readback(value):reads.append(value);return value
        session.readback=readback
        native=SimpleNamespace(actions={'state_post'},fingerprint=lambda:'a'*64,runtime_preimages=(('html','b'*64),))
        qa=SimpleNamespace(SafeStatus=lambda *args:SimpleNamespace(values=args))
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:session.native_control(qa,native,'state_post','a'*64),range(2)))
        self.assertEqual(session.client.max_active,1)
        self.assertEqual(len(reads),2)
        for result in results:
            self.assertEqual(result.values[0],'a'*64)
            self.assertEqual(result.values[1],native.runtime_preimages)
            self.assertTrue(all(value is True for value in result.values[3:]))
            self.assertLess(time.monotonic()-result.values[2],2)
        with self.assertRaises(runner.Stop):session.native_control(qa,native,'create_other','a'*64)
        session.readback=lambda _: {'wrong':True}
        with self.assertRaises(runner.Stop):session.native_control(qa,native,'state_post','a'*64)

    def test_real_native_admission_types_and_auth_block_release(self):
        qa=runner.load_module('native_type_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        session=self.session('auth');contract=session.contract
        contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['runnerSha256']=runner.digest(Path(runner.__file__))
        contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        value=runner.native_admission(qa,contract,'d'*64)
        self.assertIs(type(value),qa.Admission)
        value.validate()
        gate=qa.Gate(value,lambda action,binding:session.native_control(qa,value,action,binding),contract['runnerSha256'])
        gate.require('state_get')  # Real consumer accepts the adapter's actual SafeStatus type.
        session.client.calls.clear()
        with patch.object(qa,'execute_native',side_effect=AssertionError('no native execution')) as native:
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
            native.assert_not_called()
        self.assertEqual(session.client.calls,['release'])

    def test_auth_block_precedes_controls_consumption_and_capabilities(self):
        with patch.object(runner,'read_json',side_effect=AssertionError('no control read')) as read, \
             patch.object(runner,'load_module',side_effect=AssertionError('no private capability')) as load, \
             patch.object(runner.subprocess,'Popen',side_effect=AssertionError('no SSH')) as ssh:
            with self.assertRaises(runner.Stop):runner.execute('auth',self.directory/'approval',self.directory/'read',1)
            read.assert_not_called();load.assert_not_called();ssh.assert_not_called()
        self.assertEqual(list(self.directory.iterdir()),[])

    def test_real_fullref_candidate_snapshot_all_35_committed_inputs(self):
        # Actual immutable product archive/source/authority, not a patched
        # snapshot or miniature synthetic package. Reports are local fixture
        # attestations only; no approval/read controls or capability invocation.
        package=Path('/private/tmp/ir-phase1-qualified-fullref-20261004')
        manifest=runner.read_json(package/'release-manifest.json')
        self.assertEqual(len(manifest['buildInputs']),35)
        self.assertIn('integration/release.py',manifest['buildInputs'])
        self.assertEqual(runner.digest(package/runner.PACKAGE_FILES[0]),'16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa')
        fixture=self.directory/'snapshot-reports';fixture.mkdir()
        for name in ('lease_transport.py','native_account_qa.py','native_account_qa_tests.py',
                     'NATIVE_QA_INDEPENDENT_REVIEW.md','runtime_native_runner_tests.py'):
            (fixture/name).write_bytes(runner.safe_file(runner.HERE/name))
        qualifications={}
        for kind in ('phaseDecision','recovery','runtimeReadback'):
            name=kind.upper()+'.md';(fixture/name).write_text('LOCAL FIXTURE ONLY: '+kind+'\n')
            qualifications[kind]={'verdict':'APPROVE','independentReviewer':'fixture-independent',
                'reportFile':name,'reportSha256':runner.digest(fixture/name)}
        preimages={runner.GATEWAY:'ABSENT',runner.RUNTIME:'ABSENT',runner.RUNTIME+'/current':'ABSENT'}
        qualifications['recovery']['qualifiedPreimages']=preimages
        release=runner.RUNTIME+'/releases/'+manifest['htmlSha256']+'/'
        bindings={'package':runner.digest(package/runner.PACKAGE_FILES[0]),'html':manifest['htmlSha256'],
            'gateway':manifest['artifacts'][runner.GATEWAY]['sha256'],
            **{key:manifest['artifacts'][release+name]['sha256'] for key,name in
               (('matrix','matrix-entry.js'),('gate','account-gate.html'),('buildManifest','build-manifest.json'))},
            'pointer':hashlib.sha256(('releases/'+manifest['htmlSha256']).encode()).hexdigest()}
        exact={'sourceHead':runner.head(runner.ROOT),'sourceCommit':manifest['sourceCommit'],
            'packageDirectory':str(package),'packageFiles':{n:runner.digest(package/n) for n in runner.PACKAGE_FILES},
            'runtimeBindings':bindings,'qualifiedPreimages':preimages,'qualifications':qualifications,
            'controlDirectory':str(fixture/'control')}
        with patch.object(runner,'HERE',fixture), \
             patch.object(runner,'load_module',side_effect=AssertionError('no private capability')):
            actual=runner.snapshot('install',exact)
        self.assertEqual(actual['spec'],exact)
        self.assertEqual(actual['sourcePreimages']['interview-ready/integration/release.py'],manifest['buildInputs']['integration/release.py'])
        self.assertGreaterEqual(len(actual['sourcePreimages']),35)
        self.assertFalse((fixture/'control').exists())

    def test_native_report_is_closed_status_only(self):
        value={'mode':'native','result':'PASS_BOUNDED_PROTOCOL_CHECKS','checks':8,'identities_retained':2,
            'connection_loss':'NOT_ADMITTED','limits':['VISIBLE_BROWSER_JOURNEY_PENDING','FULL_HTTP_DISCONNECT_PENDING',
            'CORRUPT_DUPLICATE_HISTORY_FIXTURE_ONLY','PROVIDER_CACHE_ACCEPTANCE_PENDING','ADMIN_MR_REGRESSION_PENDING']}
        self.assertEqual(runner.safe_native_report(value),value)
        with self.assertRaises(runner.Stop):runner.safe_native_report(dict(value,password='fixture-private-value'))

    def test_one_use_consumption_before_private_transport_and_no_retry(self):
        contract=copy.deepcopy(self.contract);approval={'spec':contract['spec'],'reportSha256':'f'*64}
        approval_path=self.directory/'approval.json';read_path=self.directory/'read.json'
        runner.atomic(self.directory,'approval.json',approval);runner.atomic(self.directory,'read.json',{})
        canonical_client=SimpleNamespace(path_scope=Mock(return_value='PATH:'+'0'*64),validate_writer_scope=Mock())
        private=SimpleNamespace(retrieve_existing_key=Mock(side_effect=RuntimeError('fixture-private-key')))
        with patch.object(runner,'HERE',self.directory),patch.object(runner,'snapshot',return_value=contract), \
             patch.object(runner,'validate_controls',return_value='e'*64), \
             patch.object(runner,'load_module',side_effect=[canonical_client,private]) as modules:
            with self.assertRaises(RuntimeError):runner.execute('install',approval_path,read_path,1)
            private.retrieve_existing_key.assert_called_once_with()
            markers=list(self.directory.glob('RUNTIME_NATIVE_READ_CONSUMED_*.json'))
            self.assertEqual(len(markers),1)
            self.assertNotIn('fixture-private',markers[0].read_text())
            with self.assertRaises(runner.Stop):runner.execute('install',approval_path,read_path,1)
            self.assertEqual(modules.call_count,2)


if __name__=='__main__':unittest.main(verbosity=1)
