"""Small in-memory fixtures. Never create a native identity or call a provider."""
import ast
import base64
import contextlib
import dataclasses
import concurrent.futures
import os
import threading
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

ABSENT=['PAYLOAD_NOT_OBSERVED','PAYLOAD_SHUTDOWN_NOT_OBSERVED']
ENTRY=b'IR_INVENTORY_BOUNDARY_V1 ENTERED\n'
NORMAL=ENTRY+b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN NONFATAL UNKNOWN\n'

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('native_account_qa', Path(__file__).with_name('native_account_qa.py'))
qa = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = qa
spec.loader.exec_module(qa)


class SpyGate:
    def __init__(self):
        self.actions = []
        self.admission = type('FixtureAdmission', (), {'creation_hook_inventory_sha256': '3' * 64,'mode':'native'})()

    def require(self, action):
        self.actions.append(action)

    @contextlib.contextmanager
    def dispatch(self,action):
        yield qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action=action)


class PipeChild:
    """Injected local pipes only; never starts a process or network request."""
    def __init__(self,chunks=(),delay=0,code=0,*,stderr=False,error_chunks=()):
        r,w=os.pipe();self.stdin=os.fdopen(w,'wb',buffering=0);self.input_fd=r
        r,w=os.pipe();self.stdout=os.fdopen(r,'rb',buffering=0);self.output_fd=w
        r,w=os.pipe();self.stderr=os.fdopen(r,'rb',buffering=0);self.error_fd=w
        self.returncode=None;self.stopped=threading.Event();self.done=threading.Event();self.private_input=bytearray()
        def run():
            try:
                while True:
                    block=os.read(self.input_fd,8192)
                    if not block:break
                    self.private_input.extend(block)
                for chunk in chunks:
                    if self.stopped.wait(delay):break
                    os.write(self.error_fd if stderr else self.output_fd,chunk)
                for chunk in error_chunks:os.write(self.error_fd,chunk)
                self.returncode=code if not self.stopped.is_set() else -9
            finally:
                for fd in (self.input_fd,self.output_fd,self.error_fd):os.close(fd)
                self.done.set()
        self.worker=threading.Thread(target=run,daemon=True);self.worker.start()
    def poll(self):
        if not self.done.is_set():return None
        self.worker.join();return self.returncode
    def kill(self):self.stopped.set()
    def wait(self,timeout=None):
        if not self.done.wait(timeout):raise subprocess.TimeoutExpired('fixture',timeout)
        self.worker.join();return self.returncode


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
                         local, runtime, qa.ALLOWED_ACTIONS-{'creation_inventory_read'}, '3' * 64)
        calls = []
        def control(action, binding):
            calls.append(action)
            return qa.SafeStatus(binding, runtime, time.monotonic(), True, True, True, True)
        return a, files, expected, calls, control

    def test_inventory_optional_progress_has_exact_order_and_two_controls(self):
        a, files, _, calls, control = self.gate_fixture()
        a=dataclasses.replace(a,mode='inventory',actions=frozenset({'creation_inventory_read'}),creation_hook_inventory_sha256=None)
        stages=[];gate=qa.Gate(a,control,a.control_contract_sha256,deadline=time.monotonic()+60,progress=stages.append)
        payload={'schema':'ir.native.hook_inventory.v1','sha256':hashlib.sha256(b'[]').hexdigest(),'count':0,'callbacks':[]}
        with mock.patch.object(Path,'read_bytes',lambda path: files[str(path)]), \
             mock.patch.object(qa,'private_capture',return_value=json.dumps(payload).encode()):
            result=qa.creation_inventory_read(gate)
        self.assertEqual(result,payload)
        self.assertEqual(calls,['creation_inventory_read']*2)
        self.assertEqual(stages,['INVENTORY_GATE_CHECK','INVENTORY_DISPATCH_CHECK','INVENTORY_CAPTURE',
            'INVENTORY_JSON','INVENTORY_SCHEMA','INVENTORY_ROWS','INVENTORY_DIGEST','INVENTORY_COMPLETE'])
        with self.assertRaises(qa.Stop):gate.inventory_progress('PRIVATE_SENTINEL')
        native=qa.Gate(dataclasses.replace(a,mode='native'),None,progress=stages.append)
        native.inventory_progress('INVENTORY_JSON');self.assertEqual(len(stages),8)

    def test_inventory_control_failure_marks_actual_first_or_second_check(self):
        for failure_at in (1,2):
            with self.subTest(failure_at=failure_at):
                a, files, _, calls, control=self.gate_fixture()
                a=dataclasses.replace(a,mode='inventory',actions=frozenset({'creation_inventory_read'}),creation_hook_inventory_sha256=None)
                stages=[];count=[0]
                def failing_control(action,binding):
                    count[0]+=1
                    if count[0]==failure_at:raise RuntimeError('PRIVATE_SENTINEL')
                    return control(action,binding)
                gate=qa.Gate(a,failing_control,a.control_contract_sha256,deadline=time.monotonic()+60,progress=stages.append)
                with mock.patch.object(Path,'read_bytes',lambda path: files[str(path)]), \
                     mock.patch.object(qa.subprocess,'Popen',side_effect=AssertionError('no capture')) as transport:
                    with self.assertRaises(qa.Stop) as caught:qa.creation_inventory_read(gate)
                self.assertEqual(caught.exception.category,'guard');self.assertTrue(gate.closed)
                self.assertEqual(stages[-1],'INVENTORY_GATE_CHECK' if failure_at==1 else 'INVENTORY_DISPATCH_CHECK')
                self.assertNotIn('PRIVATE_SENTINEL',str(caught.exception));transport.assert_not_called()

    def test_inventory_deadline_and_json_categories_never_include_private_data(self):
        budget=qa.Dispatch(time.monotonic()-1,action='creation_inventory_read')
        with self.assertRaises(qa.Stop) as caught:budget.remaining()
        self.assertEqual(caught.exception.category,'io_deadline')
        budget=qa.Dispatch(time.monotonic()+1,action='creation_inventory_read')
        with mock.patch.object(qa,'private_capture',return_value=b'PRIVATE_SENTINEL invalid json'):
            with self.assertRaises(qa.Stop) as caught:qa.private_pipe('private',budget=budget)
        self.assertEqual(caught.exception.category,'json_decode')
        self.assertNotIn('PRIVATE_SENTINEL',str(caught.exception))
        self.assertEqual(qa.Stop('PRIVATE_SENTINEL').category,'private_operation_failed')

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
            gate = qa.Gate(a, control, a.control_contract_sha256,deadline=time.monotonic()+60)
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
                    qa.Gate(a, lambda *args: proof, a.control_contract_sha256,deadline=time.monotonic()+60).require('state_post')
            with self.assertRaisesRegex(qa.Stop, '^not_admitted$'):
                qa.Gate(a, control, '0' * 64,deadline=time.monotonic()+60).require('create_a')

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
        def pipe(code,**kwargs):
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
        def pipe(code,**kwargs):
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
        gate.admission.mode='inventory'
        rows=[['user_register',10,'fixture_callback',1,'4'*64]]
        private={'schema':'ir.native.hook_inventory.v1','sha256':hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest(),'count':1,'callbacks':rows}
        def pipe(code,**kwargs):
            codes.append(code); return private
        self.assertTrue(qa.creation_inventory_read(gate, pipe) == private)
        self.assertEqual(gate.actions, ['creation_inventory_read'])
        self.assertNotIn('wp_insert_user(', codes[0])
        self.assertIn('ReflectionFunction', codes[0])
        self.assertIn("hash_file('sha256'", codes[0])

    def test_inventory_closed_php_failures_never_publish_private_child_output(self):
        expected={'HOOK_SHAPE':'php_hook_shape','CALLBACK_SHAPE':'php_callback_shape',
            'REFLECTION_FUNCTION':'php_reflection_function','REFLECTION_METHOD':'php_reflection_method',
            'FILE_DIGEST':'php_file_digest','ENCODE':'php_encode'}
        for step,category in expected.items():
            for scope in (None,'ACCOUNT_STANDARD','ACCOUNT_META','OTHER'):
                with self.subTest(step=step,scope=scope):
                    payload={'schema':'ir.native.hook_inventory.failure.v1','step':step}
                    if scope is not None:payload['hookScope']=scope
                    child=PipeChild([json.dumps(payload).encode()],code=7)
                    budget=qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action='creation_inventory_read')
                    captured=io.StringIO()
                    with mock.patch.object(qa.subprocess,'Popen',return_value=child), \
                         contextlib.redirect_stdout(captured),contextlib.redirect_stderr(captured),self.assertRaises(qa.Stop) as caught:
                        qa.private_capture(qa.SSH_ARGV,b'fixture-private-input',budget)
                    self.assertEqual(caught.exception.category,category)
                    self.assertEqual(caught.exception.hookScope,scope)
                    self.assertEqual(str(caught.exception),category)
                    self.assertNotIn('schema',repr(caught.exception))
                    self.assertEqual(captured.getvalue(),'')
                    self.assertTrue(child.done.is_set())
                    self.assertTrue(all(s.closed for s in (child.stdin,child.stdout,child.stderr)))

    def test_inventory_failure_marker_rejects_mixed_unknown_malformed_and_success_children(self):
        sentinel=b'{"schema":"ir.native.hook_inventory.failure.v1","step":"REFLECTION_METHOD"}'
        invalid=[b'',b'PRIVATE_SENTINEL',sentinel+b'PRIVATE_SENTINEL',b'PRIVATE_SENTINEL'+sentinel,
            sentinel+b'{}',sentinel[:-1],sentinel.replace(b'REFLECTION_METHOD',b'PRIVATE_SENTINEL'),
            sentinel.replace(b'failure.v1',b'failure.v2'),sentinel[:-1]+b',"private":"PRIVATE_SENTINEL"}',
            sentinel[:-1]+b',"hookScope":"PRIVATE_SENTINEL"}',sentinel[:-1]+b',"hookScope":null}',
            sentinel[:-1]+b',"hookScope":[]}',sentinel[:-1]+b',"step":"REFLECTION_METHOD"}',
            b'['+sentinel+b']',sentinel.replace(b'"REFLECTION_METHOD"',b'[]'),sentinel+b' '*257,
            b'\xff'+sentinel]
        for data in invalid:
            child=PipeChild([data],code=7)
            budget=qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action='creation_inventory_read')
            captured=io.StringIO()
            with mock.patch.object(qa.subprocess,'Popen',return_value=child), \
                 contextlib.redirect_stdout(captured),contextlib.redirect_stderr(captured),self.assertRaises(qa.Stop) as caught:
                qa.private_capture(qa.SSH_ARGV,b'private',budget)
            self.assertEqual(caught.exception.category,'child_exit')
            self.assertIsNone(caught.exception.hookScope)
            self.assertNotIn('PRIVATE_SENTINEL',repr(caught.exception))
            self.assertEqual(captured.getvalue(),'');self.assertTrue(child.done.is_set())
        child=PipeChild([sentinel],code=0,error_chunks=[NORMAL])
        with mock.patch.object(qa.subprocess,'Popen',return_value=child):
            gate=SpyGate();gate.admission.mode='inventory'
            with self.assertRaisesRegex(qa.Stop,'^native_assertion$'):
                qa.creation_inventory_read(gate)
        child=PipeChild([sentinel],code=7)
        with mock.patch.object(qa.subprocess,'Popen',return_value=child):
            with self.assertRaisesRegex(qa.Stop,'^native_assertion$'):
                qa.private_capture(qa.SSH_ARGV,b'private',qa.Dispatch(time.monotonic()+qa.IO_SECONDS))
        for invalid_scope in (None,[],{},'PRIVATE_SENTINEL',3):
            self.assertIsNone(qa.Stop('php_hook_shape',hookScope=invalid_scope).hookScope)
        self.assertIsNone(qa.Stop('PRIVATE_SENTINEL',hookScope='ACCOUNT_META').hookScope)

    def test_inventory_known_error_shapes_keep_only_closed_status_and_presence(self):
        samples=[(b'PHP Fatal error: PRIVATE_SENTINEL in /fixture/private.php on line 7','php_fatal_error'),
            (b'Parse error: PRIVATE_SENTINEL','php_parse_error'),
            (b'Error: Error establishing a database connection.','wp_cli_bootstrap_error'),
            (b"Error: The file '/dev/stdin' doesn't exist.",'wp_cli_command_error'),
            (b'ssh: connect to host PRIVATE_SENTINEL port 22: Connection refused','ssh_transport_error'),
            (b'bash: line 1: wp: command not found','shell_command_error')]
        for message,category in samples:
            for stderr in (False,True):
                child=PipeChild([message+b'\n'],code=255,stderr=stderr)
                budget=qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action='creation_inventory_read')
                public=io.StringIO()
                with mock.patch.object(qa.subprocess,'Popen',return_value=child), \
                     contextlib.redirect_stdout(public),contextlib.redirect_stderr(public),self.assertRaises(qa.Stop) as caught:
                    qa.private_capture(qa.SSH_ARGV,b'private',budget)
                self.assertEqual(caught.exception.category,category)
                self.assertEqual(caught.exception.childExit,{'exitCode':255,'stdoutPresent':not stderr,'stderrPresent':stderr})
                self.assertNotIn('PRIVATE_SENTINEL',repr(caught.exception));self.assertEqual(public.getvalue(),'')
                self.assertTrue(child.done.is_set())
        message=samples[0][0]
        trace=message+b'\nStack trace:\n#0 /fixture/PRIVATE_SENTINEL.php(7): PRIVATE_SENTINEL()\n  thrown in PRIVATE_SENTINEL on line 7\n'
        error=qa.inventory_child_failure(b'',trace,255)
        self.assertEqual(error.category,'php_fatal_error')
        self.assertNotIn('PRIVATE_SENTINEL',repr(error))
        self.assertEqual(qa.inventory_child_failure(b'PRIVATE_SENTINEL',trace,255).category,'child_exit')
        self.assertEqual(qa.inventory_child_failure(b'',b'PRIVATE_SENTINEL\n'+trace,255).category,'php_fatal_error')
        self.assertEqual(qa.inventory_child_failure(b'',trace+b'\n'*4096,255).category,'php_fatal_error')
        for action,code,category in (('creation_inventory_read',0,'stderr_present'),('state_post',7,'native_assertion')):
            child=PipeChild([trace],code=code,stderr=True)
            with mock.patch.object(qa.subprocess,'Popen',return_value=child),self.assertRaises(qa.Stop) as caught:
                qa.private_capture(qa.SSH_ARGV,b'private',qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action=action))
            self.assertEqual(caught.exception.category,category)
            self.assertIsNone(caught.exception.childExit)
        invalid=[(message+b'\nPRIVATE_SENTINEL',b''),(b'PRIVATE_SENTINEL\n'+message,b''),
            (message,b'PRIVATE_SENTINEL'),(message+b'\x00PRIVATE_SENTINEL',b''),
            (b'Error: PRIVATE_SENTINEL',b''),(b'',b''),(b'',b'PRIVATE_SENTINEL'),
            (b'PHP Fatal error: '+b'PRIVATE_SENTINEL'*400,b'')]
        for stdout,stderr in invalid:
            error=qa.inventory_child_failure(stdout,stderr,255)
            self.assertEqual(error.category,'child_exit')
            self.assertEqual(error.childExit,{'exitCode':255,'stdoutPresent':bool(stdout),'stderrPresent':bool(stderr)})
            self.assertNotIn('PRIVATE_SENTINEL',repr(error))
        closed={'exitCode':1,'stdoutPresent':False,'stderrPresent':True}
        for invalid in (dict(closed,private='PRIVATE_SENTINEL'),dict(closed,exitCode=True),
            dict(closed,exitCode=0),dict(closed,exitCode=256),dict(closed,stderrPresent='PRIVATE_SENTINEL'),
            dict(closed,stdoutPresent=1),[],None):
            self.assertIsNone(qa.Stop('child_exit',childExit=invalid).childExit)
        self.assertIsNone(qa.Stop('PRIVATE_SENTINEL',childExit=closed).childExit)

    def test_inventory_stderr_marker_scan_complete_stream_privacy_and_ambiguity(self):
        warning=b'PHP Warning: PHP Startup: PRIVATE_SENTINEL\n'
        cases=[(warning+b'PHP Fatal error: Uncaught Error: PRIVATE_SENTINEL\nStack trace:\n#0 PRIVATE_SENTINEL',
            'php_fatal_error',['PHP_FATAL','PHP_WARNING','UNCAUGHT_ERROR']),
            (warning+b'[05-Oct-2026 08:00:00 UTC] PHP Parse error: PRIVATE_SENTINEL',
            'php_parse_error',['PHP_PARSE','PHP_WARNING']),
            (warning+b'Error: There has been a critical error on this website.',
            'wp_cli_bootstrap_error',['PHP_WARNING','WPCLI_ERROR']),
            (warning+b'Error: Cannot read input file /dev/stdin PRIVATE_SENTINEL',
            'wp_cli_command_error',['PHP_WARNING','STDIN','WPCLI_ERROR']),
            (warning+b'Error: PRIVATE_SENTINEL stdin handling failed',
            'child_exit',['PHP_WARNING','STDIN','WPCLI_ERROR']),
            (b'PRIVATE_SENTINEL: Permission denied (publickey).\nConnection closed by PRIVATE_SENTINEL',
            'child_exit',['CONNECTION_CLOSED','PERMISSION_DENIED']),
            (warning+b'PHP Fatal error: PRIVATE_SENTINEL\nPHP Parse error: PRIVATE_SENTINEL',
            'child_exit',['PHP_FATAL','PHP_PARSE','PHP_WARNING']),
            (warning+b'PRIVATE_SENTINEL','child_exit',['PHP_WARNING'])]
        for stderr,category,markers in cases:
            child=PipeChild([stderr],code=255,stderr=True);public=io.StringIO()
            with mock.patch.object(qa.subprocess,'Popen',return_value=child), \
                 contextlib.redirect_stdout(public),contextlib.redirect_stderr(public),self.assertRaises(qa.Stop) as caught:
                qa.private_capture(qa.SSH_ARGV,b'private',qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action='creation_inventory_read'))
            self.assertEqual(caught.exception.category,category)
            self.assertEqual(caught.exception.stderrMarkers,sorted(markers+ABSENT))
            self.assertEqual(caught.exception.childExit,{'exitCode':255,'stdoutPresent':False,'stderrPresent':True})
            self.assertNotIn('PRIVATE_SENTINEL',repr(caught.exception));self.assertEqual(public.getvalue(),'')
            self.assertTrue(child.done.is_set())
        # A marker beyond the old 4096-byte threshold is scanned, never truncation-admitted.
        stderr=warning+b'PRIVATE_SENTINEL'*400+b'\nError: Cannot read input file /dev/stdin'
        self.assertEqual(qa.inventory_child_failure(b'',stderr,255).stderrMarkers,sorted(['PHP_WARNING','STDIN','WPCLI_ERROR']+ABSENT))
        oversized=b'PHP Fatal error: PRIVATE_SENTINEL\n'+b'X'*65536
        error=qa.inventory_child_failure(b'',oversized,255)
        self.assertEqual(error.category,'child_exit');self.assertIsNone(error.stderrMarkers)
        mixed=qa.inventory_child_failure(b'PRIVATE_SENTINEL',warning+b'PHP Fatal error: PRIVATE_SENTINEL',255)
        self.assertEqual(mixed.category,'child_exit');self.assertEqual(mixed.stderrMarkers,sorted(['PHP_FATAL','PHP_WARNING']+ABSENT))
        for malformed in (['PRIVATE_SENTINEL'],['PHP_FATAL','PHP_FATAL'],['STDIN','PHP_FATAL'],[1],{},None):
            self.assertIsNone(qa.Stop('child_exit',stderrMarkers=malformed).stderrMarkers)
        self.assertIsNone(qa.Stop('PRIVATE_SENTINEL',stderrMarkers=['PHP_FATAL']).stderrMarkers)

    def test_inventory_stderr_ansi_fatal_kinds_and_closed_marker_schema(self):
        kinds=[(b'Call to undefined function PRIVATE_SENTINEL()', 'UNDEFINED_FUNCTION'),
            (b'Class "PRIVATE_SENTINEL" not found', 'CLASS_NOT_FOUND'),
            (b'Cannot redeclare PRIVATE_SENTINEL()', 'REDECLARE'),
            (b'Undefined constant "PRIVATE_SENTINEL"', 'UNDEFINED_CONSTANT'),
            (b'Uncaught TypeError: PRIVATE_SENTINEL', 'TYPE_ERROR'),
            (b'Uncaught ArgumentCountError: PRIVATE_SENTINEL', 'ARGUMENT_COUNT_ERROR')]
        for message,kind in kinds:
            stderr=b'\x1b[33mPHP Warning: PRIVATE_SENTINEL\x1b[0m\n'+b'\x1b[31m[05-Oct-2026 08:00:00 UTC] PHP Fatal error: '+message+b'\x1b[0m\nStack trace:\n#0 PRIVATE_SENTINEL'
            error=qa.inventory_child_failure(b'',stderr,255)
            expected=sorted(['PHP_FATAL','PHP_WARNING',kind]+(['UNCAUGHT_ERROR'] if message.startswith(b'Uncaught ') else []))
            self.assertEqual(error.category,'php_fatal_error');self.assertEqual(error.stderrMarkers,sorted(expected+ABSENT))
            self.assertNotIn('PRIVATE_SENTINEL',str(error)+repr(error)+repr(vars(error)))
        for message,kind in [(b'Error: Your PHP installation appears to be missing the MySQL extension PRIVATE_SENTINEL','MYSQL_EXTENSION_MISSING'),
                (b'Error: WP-CLI requires PHP version 5.6 or newer. PRIVATE_SENTINEL','PHP_VERSION_REQUIREMENT')]:
            error=qa.inventory_child_failure(b'',message,255)
            self.assertEqual(error.category,'child_exit');self.assertEqual(error.stderrMarkers,sorted([kind,'WPCLI_ERROR']+ABSENT))
        all_markers=sorted(qa.STDERR_MARKERS)
        self.assertEqual(len(all_markers),29)
        self.assertEqual(qa.Stop('child_exit',stderrMarkers=all_markers).stderrMarkers,all_markers)
        for malformed in (all_markers+['STDIN'],tuple(all_markers),['PHP_FATAL',{}],['PHP_FATAL',False]):
            self.assertIsNone(qa.Stop('child_exit',stderrMarkers=malformed).stderrMarkers)
        sentinel=json.dumps({'schema':qa.PHP_FAILURE_SCHEMA,'step':'FILE_DIGEST','hookScope':'OTHER'}).encode()
        error=qa.inventory_child_failure(sentinel,b'PHP Fatal error: PRIVATE_SENTINEL',255)
        self.assertEqual(error.category,'php_file_digest');self.assertEqual(error.stderrMarkers,sorted(['PHP_FATAL']+ABSENT))

    def test_inventory_stderr_fixed_families_normalization_and_unknown(self):
        cases=[(b' \t\x1b[31mssh: connect to host PRIVATE_SENTINEL port 22: Connection refused\x1b[0m\r', 'ssh_transport_error',['SSH_MESSAGE']),
            (b'\rkex_exchange_identification: Connection closed by remote host','ssh_transport_error',['CONNECTION_CLOSED','SSH_MESSAGE']),
            (b'  sh: 1: wp: not found','shell_command_error',['SHELL_MESSAGE']),
            (b'\tWarning: PRIVATE_SENTINEL','child_exit',['PHP_WARNING','WPCLI_WARNING']),
            (b'  PHP Notice: PRIVATE_SENTINEL','child_exit',['PHP_NOTICE']),
            (b' \t[05-Oct-2026 08:00:00 UTC] PHP Fatal error: PRIVATE_SENTINEL','php_fatal_error',['PHP_FATAL'])]
        cases.extend([(b'Host key verification failed.','ssh_transport_error',['SSH_MESSAGE']),
            (b'client_loop: send disconnect: Broken pipe','ssh_transport_error',['CONNECTION_CLOSED','SSH_MESSAGE'])])
        for raw in (b'PRIVATE_SENTINEL',b'\xffPRIVATE_SENTINEL',
                b'\x1b[2JPHP Fatal error: PRIVATE_SENTINEL',b'\x01Error: PRIVATE_SENTINEL',b' '*65536):
            cases.append((raw,'child_exit',['STDERR_UNCLASSIFIED']))
        cases.extend((raw,'child_exit',['PHP_FATAL']) for raw in (b'PHP Fatal error: PRIVATE_SENTINEL\x00',b'PHP Fatal error: PRIVATE_SENTINEL\xff',b'PHP Fatal error: PRIVATE_SENTINEL\xe2\x98\x83'))
        for raw,category,markers in cases:
            error=qa.inventory_child_failure(b'',raw,255)
            self.assertEqual(error.category,category);self.assertEqual(error.stderrMarkers,sorted(markers+ABSENT))
            self.assertNotIn('PRIVATE_SENTINEL',json.dumps(vars(error))+str(error)+repr(error))
        error=qa.inventory_child_failure(b'',b'X'*65537,255)
        self.assertEqual(error.category,'child_exit');self.assertIsNone(error.stderrMarkers)
        # Mixed stdout cannot promote a stderr family into a causal category.
        error=qa.inventory_child_failure(b'PRIVATE_SENTINEL',cases[0][0],255)
        self.assertEqual(error.category,'child_exit');self.assertEqual(error.stderrMarkers,sorted(['SSH_MESSAGE']+ABSENT))

    def test_inventory_boundary_exact_grammar_absence_caps_and_privacy(self):
        cases=[(b'',ABSENT,False),
            (b'PRIVATE_SENTINEL\n',ABSENT,False),
            (ENTRY,['PAYLOAD_ENTERED','PAYLOAD_SHUTDOWN_NOT_OBSERVED'],False),
            (NORMAL,['PAYLOAD_ENTERED','PAYLOAD_SHUTDOWN_NONFATAL'],True)]
        for kind in ('UNKNOWN','UNDEFINED_FUNCTION','CLASS_NOT_FOUND','REDECLARE',
                'UNDEFINED_CONSTANT','TYPE_ERROR','ARGUMENT_COUNT_ERROR','MEMORY','TIME'):
            raw=ENTRY+b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN FATAL '+kind.encode()+b'\n'
            cases.append((raw,sorted(['PAYLOAD_ENTERED','PAYLOAD_SHUTDOWN_FATAL']+([] if kind=='UNKNOWN' else [kind])),False))
        for raw,markers,normal in cases:
            residual,observations,complete=qa.inventory_boundary(raw)
            self.assertEqual(sorted(observations),markers);self.assertEqual(complete,normal)
            self.assertEqual(residual,b'PRIVATE_SENTINEL\n' if raw==b'PRIVATE_SENTINEL\n' else b'')
            self.assertNotIn('PRIVATE_SENTINEL',json.dumps(sorted(observations)))
        invalid=[NORMAL+ENTRY,ENTRY+ENTRY,NORMAL+NORMAL,NORMAL[len(ENTRY):],
            ENTRY+b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN FATAL PRIVATE_SENTINEL\n',
            ENTRY+b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN NONFATAL TYPE_ERROR\n',
            NORMAL.replace(b'V1',b'V2'),NORMAL[:-1],NORMAL.replace(b'ENTERED\n',b'ENTERED\r\n'),
            b'\x00'+NORMAL,b' '+NORMAL,NORMAL.replace(b'ENTERED',b'ENTERED\x1b[0m')]
        for raw in invalid:
            residual,observations,normal=qa.inventory_boundary(raw)
            self.assertEqual(residual,raw);self.assertEqual(observations,{'BOUNDARY_INVALID'});self.assertFalse(normal)
        # Exact frames are the only bytes removed; unsupported/ordinary bytes survive.
        raw=ENTRY+b'\xffPHP Notice: PRIVATE_SENTINEL\x00\r\n'+NORMAL[len(ENTRY):]
        residual,observations,normal=qa.inventory_boundary(raw)
        self.assertEqual(residual,b'\xffPHP Notice: PRIVATE_SENTINEL\x00\r\n');self.assertTrue(normal)
        at_cap=NORMAL+b'X'*(65536-len(NORMAL))
        self.assertTrue(qa.inventory_boundary(at_cap)[2])
        over=at_cap+b'X';self.assertEqual(qa.inventory_boundary(over),(over,set(),False))

    def test_inventory_boundary_capture_success_warning_invalid_and_nonzero(self):
        for raw,category in ((NORMAL,None),(NORMAL+b'PHP Notice: PRIVATE_SENTINEL\n','stderr_present'),
                (NORMAL+b'Warning: PRIVATE_SENTINEL\n','stderr_present'),
                (NORMAL+b'\x00PRIVATE_SENTINEL','stderr_present'),(ENTRY,'native_assertion'),
                (b'','native_assertion'),(NORMAL+ENTRY,'native_assertion'),
                (ENTRY+b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN FATAL UNKNOWN\n','native_assertion')):
            child=PipeChild([b'{}'],error_chunks=[raw]);public=io.StringIO()
            with mock.patch.object(qa.subprocess,'Popen',return_value=child),contextlib.redirect_stdout(public),contextlib.redirect_stderr(public):
                budget=qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action='creation_inventory_read')
                if category is None:self.assertEqual(qa.private_capture(qa.SSH_ARGV,b'private',budget),b'{}')
                else:
                    with self.assertRaises(qa.Stop) as caught:qa.private_capture(qa.SSH_ARGV,b'private',budget)
                    self.assertEqual(caught.exception.category,category)
                    self.assertNotIn('PRIVATE_SENTINEL',json.dumps(vars(caught.exception)))
            self.assertEqual(public.getvalue(),'');self.assertTrue(child.done.is_set())
        sentinel=json.dumps({'schema':qa.PHP_FAILURE_SCHEMA,'step':'FILE_DIGEST','hookScope':'OTHER'}).encode()
        fatal=ENTRY+b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN FATAL TYPE_ERROR\n'
        error=qa.inventory_child_failure(sentinel,fatal,255)
        self.assertEqual(error.category,'php_file_digest');self.assertEqual(error.hookScope,'OTHER')
        self.assertEqual(error.stderrMarkers,['PAYLOAD_ENTERED','PAYLOAD_SHUTDOWN_FATAL','TYPE_ERROR'])
        self.assertEqual(error.childExit,{'exitCode':255,'stdoutPresent':True,'stderrPresent':True})
        self.assertEqual(qa.inventory_child_failure(sentinel+b'PRIVATE_SENTINEL',fatal,255).category,'child_exit')
        self.assertEqual(qa.inventory_child_failure(b'PHP Fatal error: PRIVATE_SENTINEL',NORMAL,255).category,'php_fatal_error')
        child=PipeChild([b'{}'],error_chunks=[b'X'*65537])
        with mock.patch.object(qa.subprocess,'Popen',return_value=child),self.assertRaises(qa.Stop) as caught:
            qa.private_capture(qa.SSH_ARGV,b'private',qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action='creation_inventory_read'))
        self.assertEqual(caught.exception.category,'native_assertion');self.assertTrue(child.done.is_set())

    def test_inventory_boundary_actual_php_method_scope_normal_and_suppressed_fatal(self):
        php=shutil.which('php') or '/opt/homebrew/bin/php'
        if not Path(php).exists():self.skipTest('local PHP unavailable')
        gate=SpyGate();gate.admission.mode='inventory';program=[]
        def pipe(code,**kwargs):program.append(code);raise qa.Stop('child_exit')
        with self.assertRaises(qa.Stop):qa.creation_inventory_read(gate,pipe)
        code=program[0]
        self.assertTrue(code.startswith('<?php\nfwrite(STDERR,"IR_INVENTORY_BOUNDARY_V1 ENTERED'))
        self.assertNotIn('IR_INVENTORY_BOUNDARY',qa.php_preamble())
        self.assertIn('global $ir_inventory_step,$ir_inventory_hook_scope;\n$ir_inventory_step=',code)
        lint=subprocess.run([php,'-n','-l'],input=code.encode(),capture_output=True,timeout=2)
        self.assertEqual(lint.returncode,0,'fixed inventory PHP syntax failure')
        stubs="<?php function add_filter(...$args){} function wp_json_encode($v){return json_encode($v);} "
        # Method eval executes actual inventory payload with isolated synthetic hooks.
        for malformed,expected_step,rc in ((False,None,0),(True,'HOOK_SHAPE',1)):
            hooks="$wp_filter=['fixture'=>new stdClass];" if malformed else '$wp_filter=[];'
            fixture=stubs+hooks+"class FixtureEval{static function run($code){eval('?>'.$code);}} FixtureEval::run("+"base64_decode('"+base64.b64encode(code.encode()).decode()+"')"+");"
            result=subprocess.run([php,'-n'],input=fixture.encode(),capture_output=True,timeout=2)
            self.assertEqual(result.returncode,rc,'isolated method eval failure')
            self.assertEqual(result.stderr,NORMAL)
            if expected_step:self.assertEqual(json.loads(result.stdout)['step'],expected_step)
            else:self.assertEqual(json.loads(result.stdout)['count'],0)
        shapes=[('Call to undefined function PRIVATE_SENTINEL()','UNDEFINED_FUNCTION'),
            ('Class "PRIVATE_SENTINEL" not found','CLASS_NOT_FOUND'),('Cannot redeclare PRIVATE_SENTINEL()','REDECLARE'),
            ('Undefined constant "PRIVATE_SENTINEL"','UNDEFINED_CONSTANT'),('Uncaught TypeError: PRIVATE_SENTINEL','TYPE_ERROR'),
            ('Uncaught ArgumentCountError: PRIVATE_SENTINEL','ARGUMENT_COUNT_ERROR'),
            ('Allowed memory size of 123 bytes exhausted (tried to allocate 4 bytes)','MEMORY'),
            ('Maximum execution time of 1 seconds exceeded','TIME'),('PRIVATE_SENTINEL','UNKNOWN'),
            ('Uncaught TypeError: Call to undefined function PRIVATE_SENTINEL()','UNKNOWN'),
            ('Uncaught TypeError: PRIVATE_SENTINEL\x00','UNKNOWN'),('Uncaught TypeError: PRIVATE_SENTINEL☃','UNKNOWN'),('Uncaught TypeError: '+'X'*65537,'UNKNOWN')]
        for message,kind in shapes:
            fixture=stubs+"?>"+qa.inventory_boundary_preamble()+"trigger_error("+"base64_decode('"+base64.b64encode(message.encode()).decode()+"')"+",E_USER_ERROR);"
            result=subprocess.run([php,'-n'],input=fixture.encode(),capture_output=True,timeout=2)
            self.assertEqual(result.returncode,255,'isolated suppressed fatal fixture failure');self.assertEqual(result.stdout,b'')
            self.assertEqual(result.stderr,ENTRY+b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN FATAL '+kind.encode()+b'\n')
            self.assertNotIn(b'PRIVATE_SENTINEL',result.stderr)

    def test_inventory_diagnostic_public_hook_ceiling_and_exact_program_syntax(self):
        owner=ast.parse(Path(qa.__file__).with_name('native_inventory_owner.py').read_text())
        node=next(n for n in owner.body if isinstance(n,ast.Assign) and
            any(isinstance(t,ast.Name) and t.id=='STANDARD_HOOKS' for t in n.targets))
        public=frozenset(node.value.args[0].func.value.value.split())
        self.assertEqual(qa.STANDARD_HOOKS,public)
        canonical=json.dumps(sorted(public),sort_keys=True,separators=(',',':')).encode()
        self.assertEqual(hashlib.sha256(canonical).hexdigest(),'005887497738cd12c6c07c9f3ae33f9bf0574cd3dc4b00c9fc106aa5e125518d')
        self.assertEqual(qa.ACCOUNT_META_PREFIX,'sanitize_user_meta_')
        gate=SpyGate();gate.admission.mode='inventory';program=[]
        def pipe(code,**kwargs):program.append(code);raise qa.Stop('child_exit')
        with self.assertRaises(qa.Stop):qa.creation_inventory_read(gate,pipe)
        php=shutil.which('php') or '/opt/homebrew/bin/php'
        if Path(php).exists():
            result=subprocess.run([php,'-n','-l'],input=program[0].encode(),capture_output=True)
            self.assertEqual(result.returncode,0,'fixed inventory PHP syntax failure')
        else:self.skipTest('local PHP parser unavailable')

    def test_transport_errors_and_repr_never_echo_private_values(self):
        secret = 'fixture-private-value'
        with mock.patch.object(qa.subprocess, 'Popen', side_effect=RuntimeError(secret)):
            with self.assertRaises(qa.Stop) as caught:
                qa.private_pipe(secret)
        self.assertEqual(str(caught.exception), 'private_operation_failed')
        self.assertNotIn(secret, repr(caught.exception))
        client = qa.CookieClient(SpyGate())
        self.assertEqual(repr(client), '<CookieClient private>')
        with mock.patch.object(qa, 'curl_reply', side_effect=RuntimeError(secret)):
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
        with mock.patch.object(qa, 'curl_reply', side_effect=AssertionError('no transport')):
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
            self.assertNotRegex(code, r'\badd_user_meta\s*\(')
            self.assertNotRegex(code, r'\bupdate_user_meta\s*\(')
            self.assertNotIn('DELETE ', code)
        self.assertIn('mysqli_close($h)', codes[1])
        self.assertIn('MMed_IR_Locked_DB', codes[1])
        php = shutil.which('php') or '/opt/homebrew/bin/php'
        if Path(php).exists():
            for code in codes:
                result = subprocess.run([php, '-l'], input=code.encode(), capture_output=True)
                self.assertEqual(result.returncode, 0, 'fixed PHP diagnostic syntax failure')

    def test_private_curl_config_cookie_and_post_have_no_argv_env_files_or_retry(self):
        gate=qa.Gate(None,None,deadline=time.monotonic()+60);gate.require=mock.Mock()
        client=qa.CookieClient(gate);children=[]
        response=b'HTTP/1.1 200 OK\r\nSet-Cookie: session=fixture-private-cookie; Path=/; Secure\r\n\r\n{}'
        def popen(argv,**kwargs):
            self.assertEqual(tuple(argv),qa.CURL_ARGV);self.assertEqual(argv[1],'-q')
            self.assertEqual(kwargs['env'],qa.PRIVATE_ENV)
            child=PipeChild([response]);children.append(child);return child
        with mock.patch.object(qa.subprocess,'Popen',side_effect=popen):
            client.request('state_post',qa.ENDPOINT,'POST',b'fixture-private-body',{'X-WP-Nonce':'fixture-private-nonce'})
            client.request('state_get',qa.ENDPOINT)
        self.assertEqual(len(children),2)
        config=bytes(children[0].private_input).decode()
        self.assertIn('data-raw = "fixture-private-body"',config)
        self.assertIn('fixture-private-nonce',config)
        self.assertIn('fixture-private-cookie',bytes(children[1].private_input).decode())
        self.assertIn('proto = "=https"',config);self.assertIn('max-redirs = 0',config)
        self.assertIn('proxy = ""',config);self.assertIn('noproxy = "*"',config)
        self.assertNotIn('cookie-jar',config);self.assertNotIn('location',config)
        self.assertTrue(gate.drain())

    def test_actual_capture_slow_drip_dns_caps_and_nonzero_are_finite_private_stop(self):
        for mode in ('header-drip','body-drip','dns','body-cap','header-cap','nonzero'):
            with self.subTest(mode=mode):
                gate=qa.Gate(None,None,deadline=time.monotonic()+.04);gate.require=mock.Mock()
                chunks=[b'x']*100;delay=.01;code=0
                if mode=='body-drip':chunks=[b'HTTP/1.1 200 OK\r\n\r\n']+[b'x']*100
                elif mode=='dns':chunks=[b'HTTP/1.1 200 OK\r\n\r\n'];delay=.2
                elif mode=='body-cap':chunks=[b'HTTP/1.1 200 OK\r\n\r\n'+b'x'*65];delay=0
                elif mode=='header-cap':chunks=[b'HTTP/1.1 200 OK\r\nX: '+b'x'*100];delay=0
                elif mode=='nonzero':chunks=[b'fixture-private-error'];delay=0;code=6
                child=None;started=time.monotonic()
                def popen(*args,**kwargs):
                    nonlocal child
                    child=PipeChild(chunks,delay,code);return child
                with mock.patch.object(qa.subprocess,'Popen',side_effect=popen) as launch, \
                     mock.patch.object(qa,'BODY_CAP',64),mock.patch.object(qa,'HEADER_CAP',64):
                    client=qa.CookieClient(gate)
                    with self.assertRaises(qa.Stop) as caught:client.request('state_post',qa.ENDPOINT,'POST',b'{}')
                    with self.assertRaises(qa.Stop):client.request('state_post',qa.ENDPOINT,'POST',b'{}')
                    self.assertEqual(launch.call_count,1)  # Explicit second call is blocked; no transport retry.
                self.assertLess(time.monotonic()-started,.5)
                self.assertNotIn('fixture-private',str(caught.exception));self.assertIsNotNone(child.poll())
                self.assertFalse(child.worker.is_alive());self.assertTrue(gate.drain())

    def test_expired_admission_has_no_transport_and_nested_budget_is_smaller(self):
        gate=qa.Gate(None,None,deadline=time.monotonic()+60);gate.require=mock.Mock()
        with gate.dispatch('lock_lifecycle') as outer:
            outer.deadline=time.monotonic()+.02
            with gate.dispatch('state_post') as inner:self.assertLessEqual(inner.deadline,outer.deadline)
        gate.deadline=time.monotonic()-1
        with mock.patch.object(qa.subprocess,'Popen',side_effect=AssertionError('no I/O')) as launch:
            with self.assertRaises(qa.Stop):qa.CookieClient(gate).request('state_post',qa.ENDPOINT,'POST',b'{}')
            launch.assert_not_called()
        queued=qa.Gate(None,None,deadline=time.monotonic()+60);queued.require=mock.Mock()
        with queued.dispatch('state_post') as budget:
            queued.close()
            with mock.patch.object(qa.subprocess,'Popen',side_effect=AssertionError('no I/O')) as launch:
                with self.assertRaises(qa.Stop):qa.private_capture(qa.CURL_ARGV,b'private',budget)
                launch.assert_not_called()

    def test_real_race_deadline50ms_drains311ms_workers_and_cancels_queued_dispatch(self):
        gate=qa.Gate(None,None,deadline=time.monotonic()+.05);gate.require=mock.Mock();trace=[]
        class Client:
            def __init__(self,status):self.status=status
            def state(self,cmd):
                with gate.dispatch('state_post'):
                    trace.append('start');time.sleep(.311);trace.append('end')
                    return self.status,{'revision':1}
        with self.assertRaises(qa.Stop):qa.race(gate,(Client(200),Client(409)),0)
        self.assertEqual(trace.count('end'),2);self.assertTrue(gate.closed);self.assertTrue(gate.drain())
        self.assertFalse(any(t.is_alive() for t in gate.threads))
        queue=qa.Gate(None,None,deadline=time.monotonic()+.05);queue.require=mock.Mock();entered=threading.Event();seen=[]
        def first():
            with queue.dispatch('state_post'):entered.set();time.sleep(.1);seen.append('ended')
        pool=concurrent.futures.ThreadPoolExecutor(max_workers=1)
        queue.submit(pool,first);self.assertTrue(entered.wait(1))
        later=queue.submit(pool,lambda:seen.append('queued-dispatch'))
        time.sleep(.06);queue.close();pool.shutdown(wait=False,cancel_futures=True);queue.threads.extend(pool._threads)
        self.assertTrue(queue.drain());self.assertTrue(later.cancelled());self.assertEqual(seen,['ended'])

    def test_inventory_entry_is_separate_strict_and_inventory_only_capture_cap(self):
        gate=SpyGate();gate.admission.mode='inventory';rows=[['user_register',10,'fixture',1,'4'*64]]
        value={'schema':'ir.native.hook_inventory.v1','sha256':hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest(),'count':1,'callbacks':rows}
        def pipe(code,**kwargs):
            self.assertEqual(kwargs['max_bytes'],qa.INVENTORY_CAP);self.assertLessEqual(kwargs['timeout'],qa.IO_SECONDS)
            self.assertNotIn('wp_insert_user(',code);return value
        self.assertEqual(qa.creation_inventory_read(gate,pipe),value)
        for override in ({'extra':'private'},{'count':2},{'sha256':'0'*64},{'callbacks':[['x',True,'f',1,'4'*64]]}):
            with self.assertRaises(qa.Stop):qa.creation_inventory_read(gate,lambda *a,**kw:dict(value,**override))
        identity=qa.Identity('a',qa.NAMES[0],qa.EMAILS[0],'fixture-private')
        with self.assertRaises(qa.Stop):qa.create_identity(gate,identity,pipe)

    def test_unreaped_private_process_keeps_dispatch_active_and_prevents_release_eligibility(self):
        gate=qa.Gate(None,None,deadline=time.monotonic()+60);gate.require=mock.Mock()
        child=mock.Mock();child.poll.return_value=None;child.wait.side_effect=subprocess.TimeoutExpired('fixture',1)
        child.stdin=io.BytesIO();child.stdout=io.BytesIO();child.stderr=io.BytesIO()
        with mock.patch.object(qa.subprocess,'Popen',return_value=child),mock.patch.object(qa.os,'set_blocking',side_effect=OSError('fixture-private')):
            with self.assertRaisesRegex(qa.Stop,'^containment$'):
                with gate.dispatch('state_post') as budget:qa.private_capture(qa.CURL_ARGV,b'private',budget)
        self.assertFalse(gate.drain());self.assertEqual(len(gate.active),1)


if __name__ == '__main__':
    # unittest output contains only fixed test identifiers/status; no native data.
    unittest.main(verbosity=1)
