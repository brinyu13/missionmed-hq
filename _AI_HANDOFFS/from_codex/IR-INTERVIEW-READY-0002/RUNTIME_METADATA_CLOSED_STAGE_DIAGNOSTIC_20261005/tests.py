"""Fake subprocess fixtures only; no SSH/PHP/provider or default reader run."""
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import threading
import time
import unittest

sys.dont_write_bytecode = True
path = Path(__file__).with_name('reader.py')
spec = importlib.util.spec_from_file_location('closed_stage_candidate', path)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class Child:
    def __init__(self, out=b'', err=b'', code=0, fail_wait=False):
        input_read, input_write = os.pipe()
        output_read, output_write = os.pipe()
        error_read, error_write = os.pipe()
        self.stdin = os.fdopen(input_write, 'wb', buffering=0)
        self.stdout = os.fdopen(output_read, 'rb', buffering=0)
        self.stderr = os.fdopen(error_read, 'rb', buffering=0)
        self.stop = threading.Event()
        self.done = threading.Event()
        self.returncode = None
        self.code = code
        self.fail_wait = fail_wait

        def worker():
            try:
                while not self.stop.is_set():
                    ready, _, _ = select.select([input_read], [], [], .01)
                    if ready and not os.read(input_read, 8192):
                        break
                for descriptor, data in ((output_write, out), (error_write, err)):
                    os.set_blocking(descriptor, False)
                    offset = 0
                    while offset < len(data) and not self.stop.is_set():
                        try:
                            offset += os.write(descriptor, data[offset:offset + 8192])
                        except BlockingIOError:
                            self.stop.wait(.001)
            except OSError:
                pass
            finally:
                for descriptor in (input_read, output_write, error_write):
                    try:
                        os.close(descriptor)
                    except OSError:
                        pass
                self.returncode = -9 if self.stop.is_set() else self.code
                self.done.set()
        self.thread = threading.Thread(target=worker, daemon=True)
        self.thread.start()

    def poll(self):
        return self.returncode if self.done.is_set() else None

    def kill(self):
        self.stop.set()

    def wait(self, timeout):
        if self.fail_wait or not self.done.wait(timeout):
            raise subprocess.TimeoutExpired('SYNTHETIC', timeout)
        return self.returncode


class Fixtures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.program, cls.helper = reader.prepare()
        h = cls.helper
        cls.value = {'schema': 'ir.independent.runtime_public_metadata.v1',
                     'observedUnix': 1.0, 'layoutSha256': h.LAYOUT_DIGESTS['UPGRADED'],
                     'layout': h.LAYOUTS['UPGRADED'], 'runtimeBindings': h.BINDINGS,
                     'retainedOldBindings': h.OLD_BINDINGS, 'shared': h.SHARED,
                     'sharedChecked': 15, 'result': 'PASS'}

    def check_private(self, facts):
        self.assertEqual(set(facts), {'schema', 'result', 'stage', 'childSpawned',
            'childExitObserved', 'childExit', 'stdoutPresent', 'stderrPresent',
            'remoteConstantStop', 'deadlineExceeded', 'stdoutCapExceeded',
            'stderrCapExceeded', 'killAttempted', 'reapCompleted', 'published'})
        self.assertEqual(facts['schema'], 'ir.runtime.metadata.closed_stage.v1')
        self.assertIn(facts['stage'], reader.STAGES)
        self.assertIn(facts['result'], {'PASS', 'STOP'})
        for name in set(facts) - {'schema', 'result', 'stage', 'childExit'}:
            self.assertIs(type(facts[name]), bool)
        code = facts['childExit']
        self.assertTrue(code is None or (type(code) is int and -255 <= code <= 255))
        text = json.dumps(facts)
        self.assertNotIn('PRIVATE_SENTINEL', text)
        self.assertNotIn('SYNTHETIC', text)

    def case(self, *, value=None, out=None, err=b'', code=0,
             fail_wait=False, clock=time.monotonic, publish_fn=None):
        child = Child(json.dumps(self.value if value is None else value).encode()
                      if out is None else out, err, code, fail_wait)
        def popen(argv, **kwargs):
            self.assertEqual(argv, list(reader.ARGV))
            self.assertEqual(kwargs, {'stdin': subprocess.PIPE,
                                     'stdout': subprocess.PIPE, 'stderr': subprocess.PIPE})
            return child
        result = reader.run(prepare_fn=lambda: (self.program, self.helper),
                            popen_fn=popen, clock=clock,
                            publish_fn=publish_fn or (lambda value: None))
        self.assertTrue(child.done.wait(.5))
        self.assertTrue(child.stdin.closed and child.stdout.closed and child.stderr.closed)
        self.check_private(result)
        return result

    def test_exact_local_prepare_without_transport(self):
        import hashlib
        self.assertEqual(hashlib.sha256(self.program).hexdigest(), reader.PROGRAM_SHA)
        self.assertEqual(len(self.program), 80885)
        self.assertEqual(reader.IO_SECONDS, 10)
        self.assertEqual(reader.REAP_SECONDS, 2)
        self.assertEqual((reader.STDOUT_CAP, reader.STDERR_CAP), (131072, 4096))

    def test_preparation_failure_no_child_or_private_exception(self):
        def fail():
            raise RuntimeError('PRIVATE_SENTINEL')
        def forbidden(*args, **kwargs):
            self.fail('fixture unexpectedly requested a child')
        facts = reader.run(prepare_fn=fail, popen_fn=forbidden)
        self.check_private(facts)
        self.assertEqual((facts['result'], facts['stage'], facts['childSpawned']),
                         ('STOP', 'PREPARATION', False))

    def test_spawn_failure_only_closed_facts(self):
        def fail(*args, **kwargs):
            raise OSError('PRIVATE_SENTINEL')
        facts = reader.run(prepare_fn=lambda: (self.program, self.helper), popen_fn=fail)
        self.check_private(facts)
        self.assertEqual((facts['result'], facts['stage'], facts['childSpawned']),
                         ('STOP', 'SPAWN', False))

    def test_success_only_after_bindings_and_publication(self):
        published = []
        facts = self.case(publish_fn=lambda value: published.append(value))
        self.assertEqual((facts['result'], facts['stage'], facts['published']),
                         ('PASS', 'PUBLICATION', True))
        self.assertEqual(published, [self.value])
        self.assertEqual((facts['childExit'], facts['reapCompleted']), (0, True))

    def test_exact_remote_constant_vs_unknown_nonzero_private_output(self):
        facts = self.case(out=reader.REMOTE_STOP, code=1)
        self.assertEqual((facts['result'], facts['stage'], facts['remoteConstantStop']),
                         ('STOP', 'CHILD_RESULT', True))
        self.assertEqual(facts['childExit'], 1)
        for out in (b'PRIVATE_SENTINEL', reader.REMOTE_STOP + b'PRIVATE_SENTINEL',
                    reader.REMOTE_STOP.replace(b'\n', b'\r\n')):
            with self.subTest(shape=bool(out)):
                facts = self.case(out=out, code=255)
                self.assertEqual(facts['stage'], 'CHILD_RESULT')
                self.assertFalse(facts['remoteConstantStop'])

    def test_unrepresentable_or_noninteger_exit_is_closed_stop(self):
        for code in (300, False):
            facts = self.case(code=code)
            self.assertEqual((facts['result'], facts['stage']), ('STOP', 'CHILD_RESULT'))
            self.assertIsNone(facts['childExit'])

    def test_stderr_always_rejects_before_json(self):
        facts = self.case(err=b'Warning: PRIVATE_SENTINEL\n')
        self.assertEqual((facts['result'], facts['stage'], facts['stderrPresent']),
                         ('STOP', 'CHILD_RESULT', True))

    def test_json_schema_and_binding_failures_are_distinct(self):
        facts = self.case(out=b'PRIVATE_SENTINEL')
        self.assertEqual(facts['stage'], 'JSON')
        facts = self.case(value={'result': 'PASS', 'extra': 'PRIVATE_SENTINEL'})
        self.assertEqual(facts['stage'], 'SCHEMA')
        value = copy.deepcopy(self.value)
        value['shared'] = {}
        facts = self.case(value=value)
        self.assertEqual(facts['stage'], 'BINDINGS')
        for facts in (facts, self.case(value={'result': 'STOP'})):
            self.assertEqual(facts['result'], 'STOP')
            self.assertFalse(facts['published'])

    def test_schema_literal_rejects_before_publication(self):
        for malformed in ('PRIVATE_SENTINEL', '', None, False, {}):
            value = copy.deepcopy(self.value)
            value['schema'] = malformed
            published = []
            facts = self.case(value=value, publish_fn=published.append)
            self.assertEqual((facts['result'], facts['stage']), ('STOP', 'SCHEMA'))
            self.assertEqual(published, [])
            self.assertFalse(facts['published'])

    def test_shared_count_exact_integer_fifteen_before_publication(self):
        for malformed in (True, 15.0, '15', 14, 16, None):
            value = copy.deepcopy(self.value)
            value['sharedChecked'] = malformed
            published = []
            facts = self.case(value=value, publish_fn=published.append)
            self.assertEqual((facts['result'], facts['stage']), ('STOP', 'SCHEMA'))
            self.assertEqual(published, [])
            self.assertFalse(facts['published'])

    def test_observed_time_exact_numeric_finite_positive_before_publication(self):
        for malformed in (True, False, '1', None, 0, -1, float('nan'),
                          float('inf'), float('-inf'), 10 ** 1000):
            value = copy.deepcopy(self.value)
            value['observedUnix'] = malformed
            published = []
            facts = self.case(value=value, publish_fn=published.append)
            self.assertEqual((facts['result'], facts['stage']), ('STOP', 'SCHEMA'))
            self.assertEqual(published, [])
            self.assertFalse(facts['published'])

    def test_cap_flags_kill_reap_and_closed_stdout_stderr_presence(self):
        for out, err, flag in ((b'X' * (reader.STDOUT_CAP + 1), b'', 'stdoutCapExceeded'),
                               (b'', b'X' * (reader.STDERR_CAP + 1), 'stderrCapExceeded')):
            facts = self.case(out=out, err=err)
            self.assertEqual((facts['result'], facts['stage']), ('STOP', 'FINITE_IO'))
            self.assertTrue(facts[flag])
            self.assertTrue(facts['reapCompleted'])

    def test_deadline_stops_and_reaps_without_output(self):
        ticks = iter((0, 11))
        facts = self.case(clock=lambda: next(ticks, 11))
        self.assertEqual((facts['result'], facts['stage']), ('STOP', 'FINITE_IO'))
        self.assertTrue(facts['deadlineExceeded'])
        self.assertTrue(facts['killAttempted'])
        self.assertTrue(facts['reapCompleted'])
        self.assertFalse(facts['remoteConstantStop'])

    def test_reap_unknown_does_not_approve(self):
        facts = self.case(code=1, fail_wait=True)
        self.assertEqual((facts['result'], facts['stage']), ('STOP', 'CHILD_RESULT'))
        self.assertFalse(facts['childExitObserved'])
        self.assertFalse(facts['reapCompleted'])

    def test_publication_failure_no_paths_or_values(self):
        def fail(value):
            raise FileExistsError('PRIVATE_SENTINEL')
        facts = self.case(publish_fn=fail)
        self.assertEqual((facts['result'], facts['stage']), ('STOP', 'PUBLICATION'))
        self.assertFalse(facts['published'])

    def test_publisher_exclusive_and_only_qualified_metadata(self):
        class Sink:
            @contextlib.contextmanager
            def open(sink, mode):
                self.assertEqual(mode, 'x')
                stream = io.StringIO()
                yield stream
                self.assertEqual(json.loads(stream.getvalue()), self.value)
        previous = reader.PUBLIC_READBACK
        try:
            reader.PUBLIC_READBACK = Sink()
            reader.publish(self.value)
        finally:
            reader.PUBLIC_READBACK = previous


if __name__ == '__main__':
    unittest.main()
