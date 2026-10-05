"""Focused local mocks only; no SSH/provider/native creation or product writes."""
import concurrent.futures
import contextlib
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
import os
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


class ReadbackPipeChild:
    """Injected pipe/thread fixture only; never creates a subprocess or SSH."""
    def __init__(self, chunks=(), delay=0, code=0, *, stderr=False):
        r,w=os.pipe();self.stdin=os.fdopen(w,'wb',buffering=0);self.input_fd=r
        r,w=os.pipe();self.stdout=os.fdopen(r,'rb',buffering=0);self.output_fd=w
        r,w=os.pipe();self.stderr=os.fdopen(r,'rb',buffering=0);self.error_fd=w
        self.returncode=None;self.stopped=threading.Event();self.done=threading.Event();self.private_input=bytearray()
        def work():
            try:
                while True:
                    value=os.read(self.input_fd,8192)
                    if not value:break
                    self.private_input.extend(value)
                destination=self.error_fd if stderr else self.output_fd
                os.set_blocking(destination,False)
                for chunk in chunks:
                    if self.stopped.wait(delay):break
                    pending=memoryview(chunk)
                    while pending and not self.stopped.is_set():
                        try:pending=pending[os.write(destination,pending[:8192]):]
                        except BlockingIOError:self.stopped.wait(.001)
                self.returncode=code if not self.stopped.is_set() else -9
            except (OSError,ValueError):self.returncode=-9
            finally:
                for fd in (self.input_fd,self.output_fd,self.error_fd):
                    try:os.close(fd)
                    except OSError:pass
                self.done.set()
        self.worker=threading.Thread(target=work,daemon=True);self.worker.start()

    def poll(self):
        if not self.done.is_set():return None
        self.worker.join();return self.returncode
    def kill(self):self.stopped.set()
    def wait(self,timeout=None):
        if not self.done.wait(timeout):raise runner.subprocess.TimeoutExpired('local-fixture',timeout)
        self.worker.join();return self.returncode


class Fixtures(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='ir-runtime-native-fixture-')
        self.directory=Path(self.tmp.name).resolve()
        # Existing AUTH protocol fixtures inject the newly mandatory bridge;
        # never start a real localhost listener during local regression.
        original_load=runner.load_module
        def local_load(name,path,expected):
            if name=='ir_reviewed_browser_bridge':
                return SimpleNamespace(run=lambda qa,gate,**kwargs:qa.execute_native(gate))
            return original_load(name,path,expected)
        self.bridge_load_patch=patch.object(runner,'load_module',side_effect=local_load)
        self.bridge_load_patch.start()
        self.handle=SimpleNamespace(lease_id='fixture-private-id',fencing_epoch=1,nonce='fixture-private-nonce',
            expires_at=(datetime.now(timezone.utc)+timedelta(seconds=30)).isoformat())
        self.contract={'phase':'install','sourceHead':'1'*40,'runnerSha256':'2'*64,'testsSha256':'3'*64,
            'sourcePreimages':{},'authority':runner.AUTHORITY,
            'spec':{'controlDirectory':str(self.directory/'control'),
                    'runtimeBindings':{k:'4'*64 for k in runner.RUNTIME_KEYS}}}

    def tearDown(self):self.bridge_load_patch.stop();self.tmp.cleanup()

    def session(self, phase='install', client=None, readback=None, seconds=5):
        contract=copy.deepcopy(self.contract);contract['phase']=phase
        if phase!='install':
            contract['spec']['qualifications']={'installProviderClear':{'phase':'install','released':True,
                'activeIR':0,'pendingIR':0,'observedUnix':time.time()}}
            if phase=='auth':contract['spec']['qualifications']['browserBridge']=self.bridge_record()
        return runner.Session(client or Client(),self.handle,contract,'5'*64,self.directory,seconds,
            actual_snapshot=lambda *args:contract,readback=readback or Mock(return_value=contract['spec']['runtimeBindings']))

    def bridge_record(self):
        # Synthetic injected contract only, not actual report semantics/controls.
        name='NATIVE_READBACK_FINITE_INDEPENDENT_REVIEW.md'
        return {'verdict':'APPROVE','independentReviewer':'fixture-independent','reportFile':name,
            'reportSha256':runner.digest(runner.HERE/name),'schema':'ir.native.browser_bridge.qualification.v1',
            'bridgeSha256':runner.digest(runner.HERE/'native_browser_bridge.py'),
            'bridgeTestsSha256':runner.digest(runner.HERE/'native_browser_bridge_tests.py'),
            'privateMemoryQualified':True,'normalFrontendLoginQualified':True,
            'finiteLifetimeQualified':True,'custodyAndDrainQualified':True}

    def test_browser_qualification_closed_typed_and_independent_before_create(self):
        record=self.bridge_record();runner.validate_browser_bridge(record)
        for delta in [{'extra':True},{'bridgeSha256':'BAD'},{'privateMemoryQualified':1},
                      {'normalFrontendLoginQualified':False},{'schema':'other'},
                      {'independentReviewer':runner.BUILDER}]:
            with self.assertRaises(runner.Stop):runner.validate_browser_bridge(dict(record,**delta))
        qa=runner.load_module('browser_missing_qual_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        session=self.session('auth');session.contract['spec']['qualifications'].pop('browserBridge')
        session.contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        session.contract['runnerSha256']=runner.digest(Path(runner.__file__))
        session.contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        session.contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        with patch.object(qa,'execute_native',side_effect=AssertionError('create must not precede reviewed bridge')) as native:
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64));native.assert_not_called()
        self.assertEqual(session.client.calls[-1],'release')

    def test_auth_fixed_bridge_called_and_private_bridge_threads_end_before_release(self):
        qa=runner.load_module('browser_pair_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        session=self.session('auth');session.contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        for name in ('native_browser_bridge.py','native_browser_bridge_tests.py'):
            path=str((runner.HERE/name).relative_to(runner.ROOT));session.contract['sourcePreimages'][path]=runner.digest(runner.HERE/name)
        session.contract['runnerSha256']=runner.digest(Path(runner.__file__));session.contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        session.contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        admitted=runner.native_admission(qa,session.contract,'d'*64)
        for name in ('native_browser_bridge.py','native_browser_bridge_tests.py'):
            self.assertIn((str((runner.HERE/name).relative_to(runner.ROOT)),runner.digest(runner.HERE/name)),admitted.local_preimages)
        ended=threading.Event();trace=[]
        def bridge_run(module,gate,**kwargs):
            self.assertEqual(module,qa);self.assertEqual(kwargs['binding'],session.binding)
            def worker():time.sleep(.05);trace.append('bridge-end');ended.set()
            t=threading.Thread(target=worker);gate.threads.append(t);t.start()
            return {'mode':'native','result':'PASS_BOUNDED_PROTOCOL_CHECKS','checks':8,'identities_retained':2,
                    'connection_loss':'NOT_ADMITTED','limits':['VISIBLE_BROWSER_JOURNEY_PENDING','FULL_HTTP_DISCONNECT_PENDING','CORRUPT_DUPLICATE_HISTORY_FIXTURE_ONLY','PROVIDER_CACHE_ACCEPTANCE_PENDING','ADMIN_MR_REGRESSION_PENDING']}
        original_release=session.client.release
        def release(handle):self.assertTrue(ended.is_set());trace.append('release');original_release(handle)
        session.client.release=release
        original_load=runner.load_module
        with patch.object(runner,'load_module',side_effect=lambda name,path,sha:SimpleNamespace(run=bridge_run) if name=='ir_reviewed_browser_bridge' else original_load(name,path,sha)):
            self.assertIsNotNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertEqual(trace,['bridge-end','release'])

    def stop_file(self, session):
        runner.atomic(self.directory,'STOP.json',{'action':'DONE','owner':runner.OWNER,'phase':'install',
            'bindingSha256':session.binding,'fenceSha256':session.initial_fence})

    def private_readback_session(self, seconds=2):
        qa=runner.load_module('readback_native_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        session=self.session('auth',seconds=seconds);session.readback=None;session.qa=qa
        output=json.dumps({k:v for k,v in session.contract['spec']['runtimeBindings'].items() if k!='package'}).encode()
        return session,qa,output

    def test_runtime_readback_actual_stream_capture_registers_before_gate_and_releases_after_reap(self):
        session,qa,output=self.private_readback_session();children=[];trace=[]
        def popen(argv,**kwargs):
            self.assertIsNone(session.native_gate);self.assertEqual(len(session.readback_active),1)
            budget=next(iter(session.readback_active.values()))
            self.assertTrue(budget.started);self.assertLessEqual(budget.deadline,session.deadline)
            self.assertLessEqual(budget.deadline-time.monotonic(),10)
            self.assertEqual(argv,['ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=8','missionmed-kinsta','python3','-'])
            self.assertEqual(kwargs['env'],qa.PRIVATE_ENV)
            child=ReadbackPipeChild([output]);children.append(child);return child
        original=session.client.release
        def release(handle):
            self.assertTrue(children[0].done.is_set());self.assertFalse(children[0].worker.is_alive())
            trace.append('release');original(handle)
        session.client.release=release
        # Synthetic contract stops at admission after successful initial read;
        # this exercises the real before-Gate release path, not native work.
        with patch.object(qa.subprocess,'Popen',side_effect=popen):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertTrue(session.readbacks_drained());self.assertEqual(trace,['release'])
        self.assertEqual(len(children),1);self.assertIn(b"files={'gateway'",children[0].private_input)

    def test_runtime_readback_stream_deadline_caps_and_errors_stop_private_without_retry(self):
        for mode in ('slow-drip','dns','stdout-cap','stderr-cap','nonzero','malformed','extra-key','hash-drift'):
            with self.subTest(mode=mode):
                session,qa,output=self.private_readback_session(seconds=.04);children=[]
                chunks=[output];delay=0;code=0;stderr=False
                if mode=='slow-drip':chunks=[b'x']*100;delay=.01
                elif mode=='dns':delay=.2
                elif mode=='stdout-cap':chunks=[b'x'*4097]
                elif mode=='stderr-cap':chunks=[b'fixture-private-error'*4000];stderr=True
                elif mode=='nonzero':code=7
                elif mode=='malformed':chunks=[b'fixture-private-secret']
                elif mode=='extra-key':chunks=[output[:-1]+b',"private":"fixture-private-secret"}']
                elif mode=='hash-drift':chunks=[output.replace(b'4'*64,b'6'*64)]
                def popen(*args,**kwargs):
                    child=ReadbackPipeChild(chunks,delay,code,stderr=stderr);children.append(child);return child
                started=time.monotonic();captured=io.StringIO()
                with patch.object(qa.subprocess,'Popen',side_effect=popen) as launch,contextlib.redirect_stdout(captured),contextlib.redirect_stderr(captured):
                    self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
                self.assertEqual(launch.call_count,1);self.assertLess(time.monotonic()-started,.5)
                self.assertTrue(session.readbacks_drained());self.assertFalse(children[0].worker.is_alive())
                self.assertNotIn('fixture-private',captured.getvalue())
                self.assertEqual(runner.read_json(session.directory/'RESULT.json')['release'],'RELEASED')

    def test_runtime_readback_initial_unreaped_child_sticky_before_gate_defers_release(self):
        session,qa,_=self.private_readback_session();child=Mock();child.poll.return_value=None
        child.stdin=io.BytesIO();child.stdout=io.BytesIO();child.stderr=io.BytesIO()
        child.wait.side_effect=runner.subprocess.TimeoutExpired('fixture-private',2)
        with patch.object(qa.subprocess,'Popen',return_value=child),patch.object(qa.os,'set_blocking',side_effect=OSError('fixture-private')):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertIsNone(session.native_gate);child.kill.assert_called_once();child.wait.assert_called_once_with(timeout=2)
        self.assertTrue(session.readback_unresolved);self.assertEqual(len(session.readback_active),1)
        self.assertNotIn('release',session.client.calls)
        self.assertEqual(runner.read_json(session.directory/'RESULT.json')['release'],'RELEASE_DEFERRED')
        child.poll.return_value=0  # Later exit cannot silently clear sticky custody.
        self.assertFalse(session.readbacks_drained())

    def test_runtime_readback_attempted_launch_unknown_defers_without_gate_or_retry(self):
        session,qa,_=self.private_readback_session()
        with patch.object(qa.subprocess,'Popen',side_effect=OSError('fixture-private-launch')) as launch:
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertEqual(launch.call_count,1);self.assertIsNone(session.native_gate)
        self.assertTrue(session.readback_unresolved);self.assertFalse(session.readbacks_drained())
        self.assertNotIn('release',session.client.calls)
        self.assertEqual(runner.read_json(session.directory/'RESULT.json')['release'],'RELEASE_DEFERRED')

    def test_runtime_readback_unreaped_control_after_gate_cannot_release(self):
        session,qa,output=self.private_readback_session();children=[]
        contract=session.contract;contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['runnerSha256']=runner.digest(Path(runner.__file__));contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        unresolved=Mock();unresolved.poll.return_value=None
        unresolved.stdin=io.BytesIO();unresolved.stdout=io.BytesIO();unresolved.stderr=io.BytesIO()
        unresolved.wait.side_effect=runner.subprocess.TimeoutExpired('fixture-private',2)
        def popen(*args,**kwargs):
            child=ReadbackPipeChild([output]) if not children else unresolved
            children.append(child);return child
        with patch.object(qa.subprocess,'Popen',side_effect=popen),patch.object(qa,'execute_native',side_effect=lambda gate:gate.require('state_post')):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertEqual(len(children),2);self.assertTrue(session.native_gate.closed)
        unresolved.wait.assert_called_once_with(timeout=2)
        self.assertFalse(session.readbacks_drained());self.assertNotIn('release',session.client.calls)
        self.assertEqual(runner.read_json(session.directory/'RESULT.json')['release'],'RELEASE_DEFERRED')

    def test_runtime_readback_begin_rejects_stop_expired_fence_and_expired_budget_without_popen(self):
        for mode in ('closing','failed','fence','expiry','deadline','stop-between-registration-and-begin'):
            with self.subTest(mode=mode):
                session,qa,_=self.private_readback_session()
                if mode=='closing':session.closing=True
                elif mode=='failed':session.failed=True
                elif mode=='fence':session.handle=copy.copy(session.handle);session.handle.fencing_epoch+=1
                elif mode=='expiry':session.handle=copy.copy(session.handle);session.handle.expires_at='2000-01-01T00:00:00Z'
                elif mode=='deadline':session.deadline=time.monotonic()-1
                capture=qa.private_capture
                def closing_capture(*args,**kwargs):
                    self.assertEqual(len(session.readback_active),1);session.stop();return capture(*args,**kwargs)
                with patch.object(qa.subprocess,'Popen') as launch,patch.object(qa,'private_capture',side_effect=closing_capture if mode=='stop-between-registration-and-begin' else capture):
                    with self.assertRaises(runner.Stop):session.checked_readback()
                launch.assert_not_called();self.assertTrue(session.readbacks_drained())

    def test_runtime_readback_closed_drain_uses_only_existing_deadline_and_stop(self):
        session,qa,output=self.private_readback_session();children=[]
        session.native_gate=qa.Gate(None,None,deadline=session.deadline);session.native_gate.close()
        session.native_gate.drain_deadline=time.monotonic()+.08;session.deadline=time.monotonic()-1
        original_deadline=session.deadline;original_drain=session.native_gate.drain_deadline
        def popen(*args,**kwargs):
            budget=next(iter(session.readback_active.values()))
            self.assertLessEqual(budget.deadline,original_drain)
            self.assertEqual(runner.read_json(session.directory/'STATUS.json')['state'],'STOP')
            child=ReadbackPipeChild([output]);children.append(child);return child
        with patch.object(qa.subprocess,'Popen',side_effect=popen):session.renew_native_drain()
        self.assertTrue(session.native_gate.closed);self.assertEqual(session.deadline,original_deadline)
        self.assertEqual(session.native_gate.drain_deadline,original_drain);self.assertTrue(session.readbacks_drained())
        self.assertEqual(runner.read_json(session.directory/'STATUS.json')['state'],'STOP')
        session.native_gate.drain_deadline=time.monotonic()-1
        with patch.object(qa.subprocess,'Popen') as launch:
            with self.assertRaises(runner.Stop):session.checked_readback(drain=True)
        launch.assert_not_called()

    def test_runtime_readback_private_control_worker_ends_before_canonical_release(self):
        session,qa,output=self.private_readback_session();trace=[];entered=threading.Event();children=[]
        contract=session.contract;contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['runnerSha256']=runner.digest(Path(runner.__file__));contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        def popen(*args,**kwargs):
            child=ReadbackPipeChild([output],.08 if len(children)==1 else 0);children.append(child)
            if len(children)==2:entered.set()
            return child
        def native(gate):
            def worker():
                try:session.renew(verify_runtime=True)
                finally:trace.append('worker-end')
            thread=threading.Thread(target=worker);gate.threads.append(thread);thread.start()
            self.assertTrue(entered.wait(1));raise qa.Stop('native_assertion')
        release=session.client.release
        def finish(handle):
            self.assertIn('worker-end',trace);self.assertTrue(session.readbacks_drained())
            self.assertTrue(all(c.done.is_set() for c in children));trace.append('release');release(handle)
        session.client.release=finish
        with patch.object(qa.subprocess,'Popen',side_effect=popen),patch.object(qa,'execute_native',side_effect=native):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertEqual(trace,['worker-end','release']);self.assertNotIn('release',trace[:-1])
        self.assertFalse(any(t.is_alive() for t in session.native_gate.threads))

    def test_runtime_readback_inflight_keeper_finishes_before_release(self):
        session,qa,output=self.private_readback_session();children=[];entered=threading.Event();trace=[]
        contract=session.contract;contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['runnerSha256']=runner.digest(Path(runner.__file__));contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        def popen(*args,**kwargs):
            child=ReadbackPipeChild([output],.08 if children else 0);children.append(child)
            if len(children)==2:entered.set()
            return child
        def keeper():
            try:session.checked_readback()
            except runner.Stop:session.stop()
            finally:trace.append('keeper-end')
        session.keeper=keeper
        def native(gate):self.assertTrue(entered.wait(1));raise qa.Stop('native_assertion')
        release=session.client.release
        def finish(handle):
            self.assertTrue(all(c.done.is_set() for c in children));self.assertTrue(session.readbacks_drained())
            self.assertEqual(trace,['keeper-end']);trace.append('release');release(handle)
        session.client.release=finish
        with patch.object(qa.subprocess,'Popen',side_effect=popen),patch.object(qa,'execute_native',side_effect=native):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertEqual(trace,['keeper-end','release']);self.assertEqual(len(children),2)

    def test_prior_install_clear_initial_freshness_boundaries_and_expiry_not_release(self):
        session=self.session('auth');clear=session.contract['spec']['qualifications']['installProviderClear']
        now=1791158000.0
        with patch.object(runner.time,'time',return_value=now):
            for age,accepted in ((0,True),(299.999,True),(300,False),(-.001,False)):
                clear['observedUnix']=now-age
                if accepted:runner.install_clear_fresh(session.contract)
                else:
                    with self.assertRaises(runner.Stop):runner.install_clear_fresh(session.contract)
            clear.update(observedUnix=now,released=False,expired=True)
            with self.assertRaises(runner.Stop):runner.install_clear_fresh(session.contract)
            clear.update(released=True,observedUnix=float('inf'))
            with self.assertRaises(runner.Stop):runner.install_clear_fresh(session.contract)
            clear['observedUnix']=now-300
            runner.install_clear_fresh(session.contract,admitted_unix=now-.001)
            with self.assertRaises(runner.Stop):runner.install_clear_fresh(session.contract,admitted_unix=now)
            clear['observedUnix']=now
            with self.assertRaises(runner.Stop):runner.install_clear_fresh(session.contract,admitted_unix=now+.001)

    def test_stale_auth_clear_precedes_control_consumption_and_private_module_load(self):
        contract=self.session('auth').contract;contract['spec']['qualifications']['installProviderClear']['observedUnix']=time.time()-301
        approval={'schema':'ir.runtime_native.approval.v1','phase':'auth','spec':contract['spec'],'contract':contract,
            'reportFile':'IMPLEMENTATION.md','reportSha256':'6'*64,'verdict':'APPROVE','independentReviewer':'fixture-independent','expiresUnix':time.time()+60}
        binding=hashlib.sha256(runner.canonical(contract)).hexdigest()
        runner.atomic(self.directory,'approval.json',approval);approval_path=self.directory/'approval.json'
        admission={'schema':'ir.runtime_native.read_admission.v1','phase':'auth','bindingSha256':binding,
            'approvalSha256':runner.digest(approval_path),'maxSeconds':1,'reportFile':'READ.md',
            'reportSha256':'7'*64,'verdict':'APPROVE','independentReviewer':'fixture-independent','expiresUnix':time.time()+60}
        runner.atomic(self.directory,'read.json',admission)
        with patch.object(runner,'HERE',self.directory),patch.object(runner,'snapshot',return_value=contract),patch.object(runner,'report_record'),patch.object(runner,'load_module') as load:
            with self.assertRaises(runner.Stop):runner.execute('auth',approval_path,self.directory/'read.json',1)
        load.assert_not_called();self.assertFalse((self.directory/'control').exists())
        self.assertEqual(list(self.directory.glob('RUNTIME_NATIVE_READ_CONSUMED_*')),[])

    def test_clear_expiring_during_private_probe_prevents_canonical_acquire(self):
        contract=self.session('auth_inventory').contract;start=time.time();clock=[start]
        contract['spec']['qualifications']['installProviderClear']['observedUnix']=start
        approval={'schema':'ir.runtime_native.approval.v1','phase':'auth_inventory','spec':contract['spec'],'contract':contract,
            'reportFile':'IMPLEMENTATION.md','reportSha256':'6'*64,'verdict':'APPROVE','independentReviewer':'fixture-independent','expiresUnix':start+1000}
        binding=hashlib.sha256(runner.canonical(contract)).hexdigest()
        runner.atomic(self.directory,'approval.json',approval);approval_path=self.directory/'approval.json'
        admission={'schema':'ir.runtime_native.read_admission.v1','phase':'auth_inventory','bindingSha256':binding,
            'approvalSha256':runner.digest(approval_path),'maxSeconds':1,'reportFile':'READ.md',
            'reportSha256':'7'*64,'verdict':'APPROVE','independentReviewer':'fixture-independent','expiresUnix':start+1000}
        runner.atomic(self.directory,'read.json',admission)
        client=SimpleNamespace(acquire_writer=Mock())
        canonical_client=SimpleNamespace(validate_writer_scope=Mock(),SupabaseLeaseClient=Mock(return_value=client))
        def probe(value):clock[0]=start+300;return 200
        private=SimpleNamespace(retrieve_existing_key=Mock(return_value='public-local-fixture'),authentication_probe=Mock(side_effect=probe),
            BASE_URL='https://fixture.invalid',PROJECT='fixture',ApikeyOnlyLeaseOpener=Mock())
        canonical_client.SupabaseLeaseClient._open_no_redirect=Mock()
        with patch.object(runner,'HERE',self.directory),patch.object(runner,'snapshot',return_value=contract),patch.object(runner,'report_record'), \
             patch.object(runner,'load_module',side_effect=[canonical_client,private]) as load,patch.object(runner.time,'time',side_effect=lambda:clock[0]):
            with self.assertRaises(runner.Stop):runner.execute('auth_inventory',approval_path,self.directory/'read.json',1)
        self.assertEqual(load.call_count,2);private.authentication_probe.assert_called_once();client.acquire_writer.assert_not_called()
        self.assertEqual(len(list(self.directory.glob('RUNTIME_NATIVE_READ_CONSUMED_*'))),1)

    def test_initial_stale_clear_stops_before_readback_and_preserves_drained_release(self):
        for age in (300,-1):
            with self.subTest(age=age),tempfile.TemporaryDirectory(prefix='ir-clear-initial-') as tmp:
                session,qa,_=self.private_readback_session();session.directory=Path(tmp).resolve()
                session.contract['spec']['qualifications']['installProviderClear']['observedUnix']=time.time()-age
                with patch.object(qa.subprocess,'Popen') as launch:
                    self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
                launch.assert_not_called();self.assertEqual(session.client.calls,['release'])
                self.assertEqual(runner.read_json(session.directory/'RESULT.json')['release'],'RELEASED')

    def test_initial_clear_crossing_ready_boundary_stops_after_reap_without_age_deferred_release(self):
        session,qa,output=self.private_readback_session();start=time.time();clock=[start];children=[]
        session.handle.expires_at=datetime.fromtimestamp(start+1000,timezone.utc).isoformat()
        def heartbeat(handle):session.client.calls.append('heartbeat');return handle
        session.client.heartbeat=heartbeat
        session.contract['spec']['qualifications']['installProviderClear']['observedUnix']=start
        def popen(*args,**kwargs):
            child=ReadbackPipeChild([output]);children.append(child);clock[0]=start+301;return child
        with patch.object(qa.subprocess,'Popen',side_effect=popen),patch.object(runner.time,'time',side_effect=lambda:clock[0]):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertEqual(len(children),1);self.assertTrue(children[0].done.is_set());self.assertTrue(session.readbacks_drained())
        self.assertFalse((session.directory/'READY.json').exists())
        self.assertEqual(runner.read_json(session.directory/'RESULT.json')['release'],'RELEASED')

    def test_later_owned_healthy_readback_and_drain_do_not_age_historical_install_clear(self):
        session,qa,output=self.private_readback_session();children=[]
        clear=session.contract['spec']['qualifications']['installProviderClear'];clear['observedUnix']=time.time()-400
        admitted=time.time()-399
        runner.atomic(session.directory,'READY.json',dict(session.status('READY'),updatedUnix=admitted))
        ready=(session.directory/'READY.json').read_bytes();deadline=session.deadline;deadline_unix=session.deadline_unix
        def popen(*args,**kwargs):
            child=ReadbackPipeChild([output]);children.append(child);return child
        with patch.object(qa.subprocess,'Popen',side_effect=popen):
            session.renew(verify_runtime=True)
            session.native_gate=qa.Gate(None,None,deadline=session.deadline);session.native_gate.close()
            session.renew_native_drain()
        self.assertEqual(len(children),2);self.assertTrue(session.readbacks_drained())
        self.assertEqual((session.directory/'READY.json').read_bytes(),ready)
        self.assertEqual(session.deadline,deadline);self.assertEqual(session.deadline_unix,deadline_unix)
        self.assertEqual(runner.read_json(session.directory/'STATUS.json')['state'],'STOP')
        session.closing=True
        with patch.object(qa.subprocess,'Popen') as launch:
            with self.assertRaises(runner.Stop):session.renew(verify_runtime=True)
        launch.assert_not_called()

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
        self.assertEqual(runner.MANUAL_BUILDER,'/root/phase1_matrix_release_implementation')
        record={'verdict':'APPROVE','independentReviewer':runner.BUILDER,'reportFile':'REVIEW.md','reportSha256':'6'*64}
        with patch.object(runner,'digest',return_value='6'*64):
            with self.assertRaises(runner.Stop):runner.report_record(record)
            runner.report_record(record,role='install_artifact')
            # Historical donor helper author is not the current helper builder.
            runner.report_record(dict(record,independentReviewer='/root/integration_lease_runner'))
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

    def test_real_native_admission_types_and_auth_failure_drains_before_release(self):
        qa=runner.load_module('native_type_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        session=self.session('auth');contract=session.contract
        contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['runnerSha256']=runner.digest(Path(runner.__file__))
        contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        value=runner.native_admission(qa,contract,'d'*64)
        self.assertIs(type(value),qa.Admission)
        value.validate()
        gate=qa.Gate(value,lambda action,binding:session.native_control(qa,value,action,binding),contract['runnerSha256'],deadline=session.deadline)
        gate.require('state_get')  # Real consumer accepts the adapter's actual SafeStatus type.
        session.client.calls.clear()
        with patch.object(qa,'execute_native',side_effect=AssertionError('no native execution')) as native:
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
            native.assert_called_once()
        self.assertEqual(session.client.calls[-1],'release');self.assertTrue(session.native_gate.drain())

    def test_missing_auth_or_inventory_qualification_precedes_consumption_and_capabilities(self):
        with patch.object(runner,'read_json',return_value={'spec':{}}), \
             patch.object(runner,'load_module',side_effect=AssertionError('no private capability')) as load, \
             patch.object(runner.subprocess,'Popen',side_effect=AssertionError('no SSH')) as ssh:
            for phase in ('auth','auth_inventory'):
                with self.assertRaises(runner.Stop):runner.execute(phase,self.directory/'approval',self.directory/'read',1)
            load.assert_not_called();ssh.assert_not_called()
        self.assertEqual(list(self.directory.iterdir()),[])

    def test_real_fullref_candidate_snapshot_all_35_committed_inputs(self):
        # Actual immutable product archive/source/authority, not a patched
        # snapshot or miniature synthetic package. Reports are local fixture
        # attestations only; no approval/read controls or capability invocation.
        package=Path('/private/tmp/ir-phase1-renderfix-20261004')
        manifest=runner.read_json(package/'release-manifest.json')
        self.assertEqual(len(manifest['buildInputs']),35)
        self.assertIn('integration/release.py',manifest['buildInputs'])
        self.assertEqual(runner.digest(package/runner.PACKAGE_FILES[0]),'a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3')
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
        for phase in ('auth_inventory','auth'):
            auth=copy.deepcopy(exact);q=auth['qualifications']
            for kind in ('installProviderClear','nativeContainment','bootstrapSafety' if phase=='auth_inventory' else 'reachableHooks'):
                name=kind.upper()+'.md';(fixture/name).write_text('LOCAL FIXTURE ONLY: '+kind+'\n')
                q[kind]={'verdict':'APPROVE','independentReviewer':'fixture-independent',
                    'reportFile':name,'reportSha256':runner.digest(fixture/name)}
            q['runtimeReadback']['runtimeBindings']=bindings
            q['installProviderClear'].update(phase='install',released=True,activeIR=0,pendingIR=0,observedUnix=time.time())
            q['nativeContainment'].update(nativeSha256=runner.NATIVE_SHA,nativeTestsSha256=runner.NATIVE_TESTS_SHA,
                transport='curl-stdin-v1',finiteContainmentQualified=True,curlExecutable='/usr/bin/curl',
                curlVersion='8.7.1',curlAsynchDNS=True)
            if phase=='auth_inventory':
                auth['nativeActions']=['creation_inventory_read']
                q['bootstrapSafety'].update(bootstrapEffectsQualified=True,reachableInventoryEffectsQualified=True)
            else:
                q['browserBridge']=self.bridge_record()
                report=q['browserBridge']['reportFile']
                (fixture/report).write_bytes(runner.safe_file(runner.HERE/report))
                auth.update(hookInventorySha256='c'*64,nativeActions=['collision_read','create_a','create_b','login','logout',
                    'app_get','state_get','state_post','rejection_post','metadata_read','lock_lifecycle'])
                q['reachableHooks'].update(hookInventorySha256='c'*64,reachableEffectsQualified=True,
                    bootstrapEffectsQualified=True,inventoryReadReleased=True,inventoryBindingSha256='d'*64)
            with patch.object(runner,'HERE',fixture),patch.object(runner,'load_module',side_effect=AssertionError('no private capability')):
                qualified=runner.snapshot(phase,auth)
                self.assertEqual(qualified['spec'],auth)
                q['nativeContainment']['finiteContainmentQualified']=False
                with self.assertRaises(runner.Stop):runner.snapshot(phase,auth)

    def test_auth_real_race50ms311ms_workers_end_before_release_with_stop_drain_keeper(self):
        qa=runner.load_module('native_race_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        session=self.session('auth',seconds=.05);contract=session.contract;trace=[]
        contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['runnerSha256']=runner.digest(Path(runner.__file__));contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        original=session.client.release
        def release(handle):trace.append('release');original(handle)
        session.client.release=release;heartbeat=session.client.heartbeat
        def renew(handle):
            if session.native_gate is not None and session.native_gate.closed:
                self.assertEqual(runner.read_json(self.directory/'STATUS.json')['state'],'STOP');trace.append('drain-renew')
            return heartbeat(handle)
        session.client.heartbeat=renew
        def native(gate):
            class Client:
                def __init__(self,status):self.status=status
                def state(self,cmd):
                    with gate.dispatch('state_post'):
                        trace.append('start');time.sleep(.311);trace.append('end')
                        return self.status,{'revision':1}
            return qa.race(gate,(Client(200),Client(409)),0)
        with patch.object(qa,'execute_native',side_effect=native),patch.object(runner,'MANUAL_RENEW_SECONDS',.02):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertEqual(trace.count('start'),2);self.assertEqual(trace.count('end'),2)
        self.assertIn('drain-renew',trace);self.assertEqual(trace[-1],'release')
        self.assertFalse(any(t.is_alive() for t in session.native_gate.threads))
        self.assertEqual(runner.read_json(self.directory/'RESULT.json')['release'],'RELEASED')

    def test_native_unresolved_dispatch_defers_release_and_inventory_receipt_is_aggregate_only(self):
        qa=runner.load_module('native_unresolved_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        session=self.session('auth');contract=session.contract
        contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['runnerSha256']=runner.digest(Path(runner.__file__));contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
        def unresolved(gate):
            gate.active['fixture']=qa.Dispatch(time.monotonic()+1,child=Mock(poll=Mock(return_value=None)))
            raise qa.Stop('containment')
        with patch.object(qa,'execute_native',side_effect=unresolved):
            self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
        self.assertNotIn('release',session.client.calls)
        self.assertEqual(runner.read_json(self.directory/'RESULT.json')['release'],'RELEASE_DEFERRED')
        value={'schema':'ir.native.hook_inventory.v1','sha256':'a'*64,'count':1,'callbacks':[['fixture-private-callback']]}
        safe=runner.safe_inventory_report(value)
        self.assertNotIn('fixture-private',json.dumps(safe));self.assertNotIn('callbacks',safe)

    def test_native_receipt_or_drain_fence_failure_never_releases_before_worker_end(self):
        qa=runner.load_module('native_failure_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        for mode in ('receipt','fence'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory(prefix='ir-native-failure-fixture-') as tmp:
                session=self.session('auth');session.directory=Path(tmp).resolve();trace=[];entered=threading.Event()
                contract=session.contract;contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
                contract['runnerSha256']=runner.digest(Path(runner.__file__));contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
                contract['spec'].update(nativeActions=sorted(qa.ALLOWED_ACTIONS-{'creation_inventory_read'}),hookInventorySha256='c'*64)
                original=session.client.release
                def release(handle):trace.append('release');original(handle)
                session.client.release=release;beat=session.client.heartbeat
                def heartbeat(handle):
                    if mode=='fence' and session.native_gate is not None and session.native_gate.closed:session.client.changed=True
                    return beat(handle)
                session.client.heartbeat=heartbeat
                def native(gate):
                    def work():
                        with gate.dispatch('state_post'):entered.set();time.sleep(.08);trace.append('end')
                    worker=threading.Thread(target=work);gate.threads.append(worker);worker.start()
                    self.assertTrue(entered.wait(1));raise qa.Stop()
                writer=runner.atomic
                def write(directory,name,value):
                    if mode=='receipt' and name=='STATUS.json' and value.get('state')=='STOP':raise OSError('fixture-private')
                    return writer(directory,name,value)
                with patch.object(qa,'execute_native',side_effect=native),patch.object(runner,'atomic',side_effect=write), \
                     patch.object(runner,'MANUAL_RENEW_SECONDS',.01):
                    self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
                self.assertIn('end',trace);self.assertFalse(any(t.is_alive() for t in session.native_gate.threads))
                if 'release' in trace:self.assertLess(trace.index('end'),trace.index('release'))
                if mode=='fence':self.assertNotIn('release',trace)

    def test_inventory_failure_receipts_fixed_stage_category_and_drain_before_release(self):
        qa=runner.load_module('native_stage_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        cases=[('gate','INVENTORY_GATE_CHECK','guard'),('dispatch','INVENTORY_DISPATCH_CHECK','guard'),
            ('child','INVENTORY_CAPTURE','child_exit'),('stderr','INVENTORY_CAPTURE','stderr_present'),
            ('json','INVENTORY_JSON','json_decode'),('schema','INVENTORY_SCHEMA','native_assertion'),
            ('rows','INVENTORY_ROWS','native_assertion'),('digest','INVENTORY_DIGEST','native_assertion'),
            ('unknown','INVENTORY_CAPTURE','private_operation_failed'),('success','INVENTORY_COMPLETE',None)]
        closed={'HOOK_SHAPE':'php_hook_shape','CALLBACK_SHAPE':'php_callback_shape',
            'REFLECTION_FUNCTION':'php_reflection_function','REFLECTION_METHOD':'php_reflection_method',
            'FILE_DIGEST':'php_file_digest','ENCODE':'php_encode'}
        for step,category in closed.items():
            cases.append((step,'INVENTORY_CAPTURE',category))
        cases.extend((mode,'INVENTORY_CAPTURE','child_exit') for mode in ('mixed_php','unknown_php','malformed_php'))
        child_messages={'php_fatal_error':b'PHP Fatal error: PRIVATE_SENTINEL\nStack trace:\n#0 PRIVATE_SENTINEL\n  thrown in PRIVATE_SENTINEL on line 7',
            'php_parse_error':b'PHP Parse error: PRIVATE_SENTINEL',
            'wp_cli_bootstrap_error':b'Error: This does not seem to be a WordPress installation.',
            'wp_cli_command_error':b"Error: The file '/dev/stdin' doesn't exist.",
            'ssh_transport_error':b'ssh: connect to host PRIVATE_SENTINEL port 22: Connection refused',
            'shell_command_error':b'sh: 1: wp: not found'}
        cases.extend((category,'INVENTORY_CAPTURE',category) for category in child_messages)
        cases.append(('quiet255','INVENTORY_CAPTURE','child_exit'))
        for mode,stage,category in cases:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory(prefix='ir-stage-fixture-') as tmp:
                session=self.session('auth_inventory');session.directory=Path(tmp).resolve();trace=[];children=[]
                contract=session.contract;contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
                contract['runnerSha256']=runner.digest(Path(runner.__file__));contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
                contract['spec']['nativeActions']=['creation_inventory_read']
                admitted=runner.native_admission(qa,contract,'d'*64);count=[0]
                def checked(gate,action):
                    count[0]+=1
                    if count[0]==(2 if mode=='dispatch' else 1) and mode in {'gate','dispatch'}:
                        raise qa.Stop('guard')
                rows=[['PRIVATE_SENTINEL',1,'PRIVATE_SENTINEL',0,'internal_or_eval']]
                encoded=json.dumps(rows,separators=(',',':')).encode()
                payload={'schema':'ir.native.hook_inventory.v1','sha256':hashlib.sha256(encoded).hexdigest(),'count':1,'callbacks':rows}
                if mode=='schema':payload['PRIVATE_SENTINEL']=True
                if mode=='rows':rows[0][3]=-1
                if mode=='digest':payload['sha256']='0'*64
                data=b'PRIVATE_SENTINEL invalid json' if mode=='json' else json.dumps(payload).encode()
                scope={'HOOK_SHAPE':'ACCOUNT_STANDARD','CALLBACK_SHAPE':'ACCOUNT_META',
                    'REFLECTION_FUNCTION':'OTHER','REFLECTION_METHOD':'ACCOUNT_STANDARD','FILE_DIGEST':'ACCOUNT_META','ENCODE':'OTHER'}.get(mode)
                if mode in closed:
                    data=json.dumps({'schema':'ir.native.hook_inventory.failure.v1','step':mode,'hookScope':scope}).encode()
                if mode in {'mixed_php','unknown_php','malformed_php'}:
                    data=b'{"schema":"ir.native.hook_inventory.failure.v1","step":"REFLECTION_METHOD"}'
                    if mode=='mixed_php':data+=b'PRIVATE_SENTINEL'
                    if mode=='unknown_php':data=data.replace(b'REFLECTION_METHOD',b'PRIVATE_SENTINEL')
                    if mode=='malformed_php':data=data[:-1]
                if mode in child_messages:data=child_messages[mode]
                if mode=='quiet255':data=b''
                nonzero=mode=='child' or mode in closed or mode in {'mixed_php','unknown_php','malformed_php','quiet255'} or mode in child_messages
                code=255 if mode=='quiet255' else 7 if nonzero else 0
                def popen(*args,**kwargs):
                    if mode=='unknown':raise RuntimeError('PRIVATE_SENTINEL')
                    child=ReadbackPipeChild([data],code=code,stderr=mode=='stderr' or mode in child_messages)
                    children.append(child);return child
                original_drain=qa.Gate.drain;original_release=session.client.release
                def drain(gate):
                    outcome=original_drain(gate);trace.append('drain');return outcome
                def release(handle):
                    self.assertTrue(all(c.done.is_set() for c in children));trace.append('release');original_release(handle)
                session.client.release=release
                with patch.object(runner,'native_admission',return_value=admitted),patch.object(qa.Gate,'require',checked), \
                     patch.object(qa.Gate,'drain',drain),patch.object(qa.subprocess,'Popen',side_effect=popen):
                    result=runner.run_session(session,qa=qa,native_review_digest='d'*64)
                    if mode=='success':self.assertEqual(result,payload)
                    else:self.assertIsNone(result)
                receipt=runner.read_json(session.directory/'NATIVE_PHASE.json')
                expected={'schema':'ir.native.phase.v1','bindingSha256':session.binding,'stage':stage}
                if category is not None:expected['category']=category
                if scope is not None:expected['hookScope']=scope
                if nonzero:expected['childExit']={'exitCode':code,'stdoutPresent':bool(data) and mode not in child_messages,'stderrPresent':mode in child_messages}
                self.assertEqual(receipt,expected)
                self.assertLess(trace.index('drain'),trace.index('release'))
                report=runner.read_json(session.directory/'RESULT.json')['nativeReport']
                if mode=='success':self.assertEqual(report['result'],'PASS_PRIVATE_INVENTORY_READ')
                else:self.assertIsNone(report)
                for path in session.directory.iterdir():
                    if path.is_file():self.assertNotIn('PRIVATE_SENTINEL',path.read_text())

    def test_inventory_phase_receipt_write_failure_and_unknown_category_fail_closed(self):
        qa=runner.load_module('native_phase_write_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        for mode in ('write','category','scope','nonstring_scope','subclass','child_extra','child_type','child_range'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory(prefix='ir-phase-write-fixture-') as tmp:
                session=self.session('auth_inventory');session.directory=Path(tmp).resolve();trace=[]
                writer=runner.atomic;original_drain=qa.Gate.drain;release=session.client.release
                def write(directory,name,value):
                    if mode=='write' and name=='NATIVE_PHASE.json':raise OSError('PRIVATE_SENTINEL')
                    return writer(directory,name,value)
                def inventory(gate):
                    gate.inventory_progress('INVENTORY_CAPTURE')
                    if mode=='subclass':
                        class PrivateStop(qa.Stop):pass
                        error=PrivateStop('php_hook_shape',hookScope='ACCOUNT_META')
                    else:
                        error=qa.Stop('php_hook_shape',hookScope='ACCOUNT_META',childExit={'exitCode':7,'stdoutPresent':True,'stderrPresent':False})
                        if mode in {'write','category'}:error.category='PRIVATE_SENTINEL'
                        if mode=='scope':error.hookScope='PRIVATE_SENTINEL'
                        if mode=='nonstring_scope':error.hookScope=['PRIVATE_SENTINEL']
                        if mode.startswith('child_'):
                            error.hookScope=None
                            if mode=='child_extra':error.childExit['private']='PRIVATE_SENTINEL'
                            if mode=='child_type':error.childExit['stderrPresent']='PRIVATE_SENTINEL'
                            if mode=='child_range':error.childExit['exitCode']=256
                    raise error
                def drain(gate):outcome=original_drain(gate);trace.append('drain');return outcome
                def released(handle):trace.append('release');release(handle)
                session.client.release=released
                admitted=SimpleNamespace(mode='inventory')
                with patch.object(runner,'native_admission',return_value=admitted),patch.object(qa,'creation_inventory_read',side_effect=inventory), \
                     patch.object(qa.Gate,'drain',drain),patch.object(runner,'atomic',side_effect=write):
                    self.assertIsNone(runner.run_session(session,qa=qa,native_review_digest='d'*64))
                self.assertLess(trace.index('drain'),trace.index('release'))
                self.assertIsNone(runner.read_json(session.directory/'RESULT.json')['nativeReport'])
                if mode!='write':
                    receipt=runner.read_json(session.directory/'NATIVE_PHASE.json')
                    self.assertEqual(receipt['category'],'php_hook_shape' if mode in {'scope','nonstring_scope','child_extra','child_type','child_range'} else 'private_operation_failed')
                    self.assertNotIn('hookScope',receipt)
                    if mode in {'category','subclass','child_extra','child_type','child_range'}:self.assertNotIn('childExit',receipt)
                for path in session.directory.iterdir():
                    if path.is_file():self.assertNotIn('PRIVATE_SENTINEL',path.read_text())

    def test_inventory_mode_has_only_read_action_and_cli_omits_private_registry(self):
        qa=runner.load_module('native_inventory_fixture',runner.HERE/'native_account_qa.py',runner.NATIVE_SHA)
        contract=copy.deepcopy(self.contract);contract['phase']='auth_inventory'
        contract['sourcePreimages']={p:runner.digest(runner.ROOT/p) for p in qa.EXPECTED_SOURCE}
        contract['spec']['nativeActions']=['creation_inventory_read'];contract['testsSha256']=runner.digest(runner.HERE/'runtime_native_runner_tests.py')
        inventory=runner.native_admission(qa,contract,'d'*64)
        self.assertEqual(inventory.mode,'inventory');self.assertIsNone(inventory.creation_hook_inventory_sha256)
        self.assertEqual(inventory.actions,frozenset({'creation_inventory_read'}))
        private={'phase':'auth_inventory','result':'BOUNDED_PHASE_COMPLETE','nativeReport':{'inventorySha256':'a'*64},
            'privateInventory':{'callbacks':[['fixture-private-callback']]}}
        output=io.StringIO()
        with patch.object(runner,'execute',return_value=private),contextlib.redirect_stdout(output):
            self.assertEqual(runner.main(['--execute','--phase','auth_inventory','--approval','fixture','--read-admission','fixture']),0)
        self.assertNotIn('fixture-private',output.getvalue());self.assertNotIn('privateInventory',output.getvalue())

    def test_only_admitted_route_refresh_and_pointer_restore_markers_use_install_guard_and_drain(self):
        session=self.session(seconds=60);session.renew();session.closing=True
        runner.atomic(self.directory,'READY.json',session.status('READY'))
        with patch.object(runner,'snapshot',return_value=session.contract):
            runner.check_install_guard(self.directory,session.binding,session.contract)
            for name in ('refresh-ir-html','refresh-home-html','restore-pointer'):
                marker=dict(self.operation(session,'COMPLETE'),operation=name)
                runner.atomic(self.directory,'MANUAL_OPERATION.json',marker)
                self.assertEqual(runner.manual_operation_record(self.directory,session.binding,session.initial_fence),marker)
                self.assertTrue(runner.drain_manual_operation(session,seconds=.01))
            for name in ('refresh-all','purge-site-cache','refresh-matrix'):
                runner.atomic(self.directory,'MANUAL_OPERATION.json',dict(marker,operation=name))
                with self.assertRaises(runner.Stop):runner.manual_operation_record(self.directory,session.binding,session.initial_fence)
        self.assertNotIn('release',session.client.calls)

    def test_typed_layout_preimage_is_runtime_only_closed_and_lowerhex64(self):
        value={'schema':'ir.runtime_native.layout_preimage.v1','sha256':'a'*64}
        self.assertTrue(runner.valid_preimage(runner.RUNTIME,value))
        for path in (runner.GATEWAY,runner.RUNTIME+'/current','other'):
            self.assertFalse(runner.valid_preimage(path,value))
        for wrong in ({'schema':'other','sha256':'a'*64},{**value,'extra':'private'},
                      {'schema':value['schema']},{**value,'sha256':'A'*64},{**value,'sha256':True},[],None):
            self.assertFalse(runner.valid_preimage(runner.RUNTIME,wrong))
        for path in (runner.GATEWAY,runner.RUNTIME,runner.RUNTIME+'/current'):
            self.assertTrue(runner.valid_preimage(path,'ABSENT'));self.assertTrue(runner.valid_preimage(path,'b'*64))

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
