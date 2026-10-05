"""Dormant fixed read-only metadata diagnostic; Root grants one actual invocation."""
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import os
import selectors
import subprocess
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
HELPER = HERE.parent / 'manual_runtime_operations.py'
PUBLIC_READBACK = HERE.parent / 'NATIVE_INVENTORY_20261005_18_INDEPENDENT_RUNTIME_PUBLIC_READBACK.json'
HELPER_SHA = '8ab2d30b5bd5b8170250e124dd6c8bdf6268915d4ff62002eb857aa68a747389'
PROGRAM_SHA = 'd3ae38047f07c00e1e879549e66ef57339122a616c01dedcbde148c5ceb8d0b0'
ARGV = ('ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'ConnectTimeout=8', 'missionmed-kinsta', 'python3', '-')
STAGES = frozenset({'PREPARATION', 'SPAWN', 'FINITE_IO', 'CHILD_RESULT',
                   'JSON', 'SCHEMA', 'BINDINGS', 'PUBLICATION'})
REMOTE_STOP = b'INDEPENDENT_RUNTIME_STOP\n'
IO_SECONDS = 10
REAP_SECONDS = 2
STDOUT_CAP = 131072
STDERR_CAP = 4096
REMOTE_TAIL = "\nimport time\ndef observe():\n layoutSha=layout_check('UPGRADED');shared_check()\n shared={name:sha(regular(root/name)) for name in SHARED}\n new={'package':sha(regular(archive)),'gateway':sha(regular(gateway)),'pointer':sha(os.readlink(current).encode())}\n old={'package':sha(regular(runtime/OLD_STAGE/'interview-ready-candidate.tar.gz')),'gateway':sha(regular(gateway)),'pointer':sha(os.readlink(backup).encode())}\n for key,file in [('html','interview-ready.html'),('matrix','matrix-entry.js'),('gate','account-gate.html'),('buildManifest','build-manifest.json')]:\n  new[key]=sha(regular(release/file));old[key]=sha(regular(runtime/'releases'/OLD_HTML/file))\n require(new==BINDINGS and old==OLD_BINDINGS)\n value={'schema':'ir.independent.runtime_public_metadata.v1','observedUnix':time.time(),'layoutSha256':layoutSha,'layout':LAYOUTS['UPGRADED'],'runtimeBindings':new,'retainedOldBindings':old,'shared':shared,'sharedChecked':15,'result':'PASS'}\n print(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False))\nclass Deadline(BaseException):pass\ndef alarm(a,b):raise Deadline()\nsignal.signal(signal.SIGALRM,alarm);signal.setitimer(signal.ITIMER_REAL,8)\ntry:observe()\nexcept BaseException:print('INDEPENDENT_RUNTIME_STOP');raise SystemExit(1)\n"


class Stop(Exception):
    pass


def require(value):
    if not value:
        raise Stop()


def prepare():
    require(hashlib.sha256(HELPER.read_bytes()).hexdigest() == HELPER_SHA)
    spec = importlib.util.spec_from_file_location('readonly_frozen_helper', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    names = ('WEBROOT', 'RUNTIME', 'GATEWAY', 'HTML', 'OLD_HTML', 'STAGE',
             'TEMP_POINTER', 'BACKUP_POINTER', 'PACKAGE_FILES', 'ARTIFACTS',
             'SHARED', 'LAYOUTS', 'LAYOUT_DIGESTS', 'BINDINGS', 'OLD_BINDINGS')
    prefix = '\n'.join(n + ' = ' + repr(getattr(helper, n)) for n in names)
    prefix += '\nOLD_STAGE = ' + repr(helper.OLD_STAGE)
    code = prefix + '\n' + helper.REMOTE_SOURCE.split('def find_layout')[0] + REMOTE_TAIL
    compile(code, 'fixed_readonly_runtime', 'exec')
    require(hashlib.sha256(code.encode()).hexdigest() == PROGRAM_SHA)
    return code.encode(), helper


def publish(value):
    with PUBLIC_READBACK.open('x') as stream:
        stream.write(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                allow_nan=False) + '\n')


def run(*, prepare_fn=prepare, popen_fn=subprocess.Popen,
        selector_factory=selectors.DefaultSelector, clock=time.monotonic,
        publish_fn=publish):
    facts = {'schema': 'ir.runtime.metadata.closed_stage.v1', 'result': 'STOP',
             'stage': 'PREPARATION', 'childSpawned': False,
             'childExitObserved': False, 'childExit': None,
             'stdoutPresent': False, 'stderrPresent': False,
             'remoteConstantStop': False, 'deadlineExceeded': False,
             'stdoutCapExceeded': False, 'stderrCapExceeded': False,
             'killAttempted': False, 'reapCompleted': False, 'published': False}
    child = None
    selector = None
    out = bytearray()
    err = bytearray()
    stdout_eof = False
    try:
        data, helper = prepare_fn()
        facts['stage'] = 'SPAWN'
        child = popen_fn(list(ARGV), stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        facts['childSpawned'] = True
        start = clock()
        selector = selector_factory()
        for stream, kind in ((child.stdout, 'out'), (child.stderr, 'err'),
                             (child.stdin, 'in')):
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_WRITE if kind == 'in'
                              else selectors.EVENT_READ, kind)
        facts['stage'] = 'FINITE_IO'
        sent = 0
        while selector.get_map():
            remaining = IO_SECONDS - (clock() - start)
            if remaining <= 0:
                facts['deadlineExceeded'] = True
                raise Stop()
            for key, _ in selector.select(min(.1, remaining)):
                stream = key.fileobj
                if key.data == 'in':
                    sent += os.write(stream.fileno(), data[sent:sent + 8192])
                    if sent == len(data):
                        selector.unregister(stream)
                        stream.close()
                else:
                    block = os.read(stream.fileno(), 8192)
                    if not block:
                        if key.data == 'out':
                            stdout_eof = True
                        selector.unregister(stream)
                        stream.close()
                        continue
                    target = out if key.data == 'out' else err
                    target.extend(block)
                    cap = STDOUT_CAP if key.data == 'out' else STDERR_CAP
                    if len(target) > cap:
                        facts['stdoutCapExceeded' if key.data == 'out'
                              else 'stderrCapExceeded'] = True
                        raise Stop()
        facts['stage'] = 'CHILD_RESULT'
        try:
            code = child.wait(timeout=max(.001, IO_SECONDS - (clock() - start)))
        except subprocess.TimeoutExpired:
            facts['deadlineExceeded'] = True
            raise Stop() from None
        facts['childExitObserved'] = True
        facts['childExit'] = code if type(code) is int and -255 <= code <= 255 else None
        facts['reapCompleted'] = True
        require(type(code) is int and code == 0 and not err)
        facts['stage'] = 'JSON'
        value = json.loads(out)
        facts['stage'] = 'SCHEMA'
        require(type(value) is dict and set(value) == {
            'schema', 'observedUnix', 'layoutSha256', 'layout', 'runtimeBindings',
            'retainedOldBindings', 'shared', 'sharedChecked', 'result'}
            and value['result'] == 'PASS'
            and value['schema'] == 'ir.independent.runtime_public_metadata.v1'
            and type(value['sharedChecked']) is int and value['sharedChecked'] == 15
            and type(value['observedUnix']) in (int, float)
            and math.isfinite(value['observedUnix']) and value['observedUnix'] > 0)
        facts['stage'] = 'BINDINGS'
        require(value['layout'] == helper.LAYOUTS['UPGRADED']
                and value['runtimeBindings'] == helper.BINDINGS
                and value['retainedOldBindings'] == helper.OLD_BINDINGS
                and value['shared'] == helper.SHARED
                and value['layoutSha256'] == helper.LAYOUT_DIGESTS['UPGRADED'])
        facts['stage'] = 'PUBLICATION'
        publish_fn(value)
        facts['published'] = True
        facts['result'] = 'PASS'
    except BaseException:
        pass
    finally:
        if child is not None:
            try:
                if child.poll() is None:
                    facts['killAttempted'] = True
                    child.kill()
                code = child.wait(timeout=REAP_SECONDS)
                facts['reapCompleted'] = True
                if not facts['childExitObserved']:
                    facts['childExitObserved'] = True
                    facts['childExit'] = code if type(code) is int and -255 <= code <= 255 else None
            except BaseException:
                pass
        if selector is not None:
            try:
                selector.close()
            except BaseException:
                pass
        if child is not None:
            for stream in (child.stdin, child.stdout, child.stderr):
                try:
                    stream.close()
                except BaseException:
                    pass
        facts['stdoutPresent'] = bool(out)
        facts['stderrPresent'] = bool(err)
        facts['remoteConstantStop'] = stdout_eof and bytes(out) == REMOTE_STOP
        out.clear()
        err.clear()
    return facts


def main():
    value = run()
    print(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False))
    return 0 if value['result'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
