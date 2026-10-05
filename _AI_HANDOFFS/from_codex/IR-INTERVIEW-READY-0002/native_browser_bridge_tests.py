"""Injected private bridge fixtures only: no listener, HTTP, WP or provider."""
import copy
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
from unittest.mock import Mock,patch
sys.dont_write_bytecode=True
s=importlib.util.spec_from_file_location('private_bridge_fixture',Path(__file__).with_name('native_browser_bridge.py'))
b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
CANARY='private-fixture-&"<>-password'

class Gate:
    def __init__(self):self.deadline=time.monotonic()+5;self.lock=threading.RLock();self.active={};self.threads=[];self.closed=False;self.calls=[];self.reject=False
    def require(self,action):
        self.calls.append(action)
        if self.closed or self.reject or time.monotonic()>=self.deadline:raise b.Stop()
    def open_check(self):
        if self.closed or time.monotonic()>=self.deadline:raise b.Stop()
    def close(self):self.closed=True

class Connection:
    def __init__(self,raw):self.raw=raw;self.sent=bytearray();self.closed=False;self.timeouts=[]
    def recv(self,n):value=self.raw[:n];self.raw=self.raw[n:];return value
    def sendall(self,value):self.sent.extend(value)
    def settimeout(self,value):self.timeouts.append(value)
    def close(self):self.closed=True
    def fileno(self):return -1 if self.closed else 5

class Listener:
    def __init__(self,connection=None):self.connection=connection;self.closed=False;self.bound=None;self.timeouts=[]
    def bind(self,value):self.bound=value
    def listen(self,n):assert n==1
    def getsockname(self):return ('127.0.0.1',43210)
    def settimeout(self,value):self.timeouts.append(value)
    def accept(self):
        if self.connection is not None:
            value=self.connection;self.connection=None;return value,('127.0.0.1',54321)
        time.sleep(.001)
        if self.closed:raise OSError()
        raise b.socket.timeout()
    def close(self):self.closed=True
    def fileno(self):return -1 if self.closed else 6

class Fixtures(unittest.TestCase):
    def identities(self):return [SimpleNamespace(username=n,email=n+'@fictional.example',uid=i+1,password=CANARY) for i,n in enumerate(b.NAMES)]
    def custodian(self):
        value=b.Custodian()
        for identity in self.identities():value.capture(identity)
        return value
    def request(self,path='/qa-a',**changes):
        headers={'Host':'127.0.0.1:43210','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document','Sec-Fetch-Site':'none'};headers.update(changes)
        return ('GET '+path+' HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k,v in headers.items())+'\r\n').encode()
    def test_closed_adapter_calls_normal_super_and_retains_only_exact_private_pair(self):
        calls=[]
        class CookieClient:
            def __init__(self,gate):self.gate=gate
            def login(self,identity):calls.append(identity.username)
        qa=SimpleNamespace(CookieClient=CookieClient);gate=Gate();c=b.Custodian();factory=b.adapter_factory(qa,gate,c)
        identities=self.identities()
        for identity in identities:factory(gate).login(identity);identity.password=''
        self.assertEqual(calls,list(b.NAMES));self.assertEqual(set(c.values),set(b.NAMES))
        self.assertNotIn(CANARY,repr(c));self.assertIn(b'form method="post"',c.form('/qa-a'))
        for delta in [dict(username='other'),dict(email='other@example.invalid'),dict(uid=0),dict(password='different')]:
            identity=self.identities()[0];identity.__dict__.update(delta)
            with self.assertRaises(b.Stop):c.capture(identity)
        c.clear();self.assertFalse(c.values)
        with self.assertRaises(b.Stop):c.form('/qa-a')
    def test_private_form_exact_normal_origin_fields_escaping_and_no_auto_submit(self):
        body=self.custodian().form('/qa-a').decode()
        self.assertIn('action="'+b.LOGIN+'"',body);self.assertIn('name="redirect_to" value="'+b.RETURN+'"',body)
        self.assertIn('value="private-fixture-&amp;&quot;&lt;&gt;-password"',body)
        self.assertNotIn(CANARY,body);self.assertNotIn('testcookie',body);self.assertNotIn('<script',body)
        self.assertIn('Sign in to QA A',body);self.assertIn(b'Cache-Control: no-store, private',b.response(body.encode()))
        self.assertNotIn('cookie',body.lower());self.assertEqual(body.count('type="hidden"'),3)
    def test_strict_navigation_host_path_headers_and_caps(self):
        self.assertEqual(b.request_path(self.request(),43210),'/qa-a')
        for raw in [self.request('/qa-a?x=1'),self.request('/qa-c'),self.request(Host='localhost:43210'),self.request(**{'Sec-Fetch-Mode':'cors'}),self.request(**{'Sec-Fetch-Dest':'iframe'}),self.request(**{'Sec-Fetch-Site':'cross-site'}),self.request(Cookie='fixture'),self.request(Origin='https://other.invalid'),self.request(**{'Content-Length':'1'}),self.request(**{'Transfer-Encoding':'chunked'}),self.request().replace(b'GET',b'POST',1),self.request().replace(b'\r\n\r\n',b'\r\nHost: 127.0.0.1:43210\r\n\r\n'),b'x'*4097]:
            with self.assertRaises(b.Stop):b.request_path(raw,43210)
    def test_four_private_responses_and_guard_before_each_no_public_leak(self):
        g=Gate();bridge=b.Bridge(g,self.custodian());bridge.port=43210
        for path in ['/qa-a','/qa-b','/qa-a','/qa-b']:
            conn=Connection(self.request(path));bridge.handle(conn)
            self.assertIn(b'200 OK',conn.sent);self.assertLess(len(conn.sent),10000)
        self.assertEqual(g.calls,['login']*4)
        with self.assertRaises(b.Stop):bridge.handle(Connection(self.request()))
        self.assertEqual(bridge.forms,4)
    def test_expired_stop_source_fence_fail_closed_without_credential_response(self):
        for condition in ['expired','stop','source','fence']:
            g=Gate();bridge=b.Bridge(g,self.custodian());bridge.port=43210;conn=Connection(self.request())
            if condition=='expired':bridge.deadline=time.monotonic()-1
            elif condition=='stop':bridge.stopped.set()
            else:g.reject=True
            with self.assertRaises(b.Stop):bridge.handle(conn)
            self.assertFalse(conn.sent);self.assertEqual(bridge.forms,0)
    def test_finite_lifetime_request_body_limit_and_closed_drain(self):
        g=Gate();g.deadline=time.monotonic()+1000;bridge=b.Bridge(g,self.custodian())
        self.assertLessEqual(bridge.deadline,time.monotonic()+600)
        g.deadline=time.monotonic()+.1;short=b.Bridge(g,self.custodian());self.assertLessEqual(short.deadline,g.deadline)
        bridge.port=43210
        with self.assertRaises(b.Stop):bridge.handle(Connection(b'x'*4097))
        with self.assertRaises(b.Stop):b.response(b'x'*8193)
        with patch.object(b.time,'monotonic',side_effect=[10,12]):
            with self.assertRaises(b.Stop):bridge.handle(Connection(self.request()))
        self.assertTrue(bridge.close());self.assertFalse(bridge.custodian.values)
    def test_actual_injected_server_thread_registered_and_ends_before_resource_release(self):
        g=Gate();conn=Connection(self.request());listener=Listener(conn);c=self.custodian();bridge=b.Bridge(g,c,socket_factory=lambda *a:listener)
        bridge.arm();bridge.start();self.assertEqual(listener.bound,('127.0.0.1',0));self.assertIn(bridge.thread,g.threads);self.assertIn(bridge.key,g.active)
        limit=time.monotonic()+.2
        while not conn.closed and time.monotonic()<limit:time.sleep(.001)
        self.assertTrue(conn.closed);self.assertIn(b'200 OK',conn.sent)
        self.assertTrue(bridge.close());self.assertFalse(bridge.thread.is_alive());self.assertFalse(g.active);self.assertFalse(c.values)
    def test_unresolved_endpoint_thread_or_launch_keeps_native_custody(self):
        for mode in ['close','thread','launch']:
            g=Gate();listener=Listener();bridge=b.Bridge(g,self.custodian(),socket_factory=lambda *a:listener)
            with patch.object(b.threading,'Thread') as thread:
                thread.return_value.is_alive.return_value=mode=='thread'
                if mode=='launch':bridge.socket_factory=Mock(side_effect=OSError(CANARY))
                try:bridge.arm();bridge.start()
                except OSError:pass
                if mode=='close':listener.close=Mock(side_effect=OSError(CANARY))
                self.assertFalse(bridge.close());self.assertIn(bridge.key,g.active);self.assertFalse(bridge.custodian.values)
                if mode!='launch':
                    self.assertTrue(thread.return_value.join.call_count>=1)
                    self.assertTrue(all(0<=call.args[0]<=2 for call in thread.return_value.join.call_args_list))
    def test_watchdog_closes_endpoint_and_private_refs_at_deadline_even_if_guard_busy(self):
        g=Gate();g.deadline=time.monotonic()+.04;listener=Listener();c=self.custodian();bridge=b.Bridge(g,c,socket_factory=lambda *a:listener)
        bridge.arm();bridge.start();bridge.watchdog.join(.2)
        self.assertFalse(bridge.watchdog.is_alive());self.assertTrue(listener.closed);self.assertFalse(c.values);self.assertTrue(g.closed)
        self.assertTrue(bridge.close());self.assertFalse(g.active)

    def test_watchdog_precedes_capture_and_clears_during_003_lifetime_007_protocol(self):
        gate=Gate();identities=self.identities();observed={};captured=[]
        class CookieClient:
            def __init__(self,gate):pass
            def login(self,identity):pass
        def native(gate,client_factory):
            self.assertEqual(len(gate.threads),1);self.assertTrue(gate.threads[0].is_alive());self.assertTrue(gate.active)
            custodian=None
            for identity in identities:client_factory(gate).login(identity)
            # The actual adapter closes over the exact privately captured owner.
            with patch.object(b.Custodian,'form',side_effect=AssertionError('no listener before native pass')):
                time.sleep(.07)
            observed['closed']=gate.closed
            observed['empty']=all(not c.values and c.closed for c in captured)
            with self.assertRaises(b.Stop):client_factory(gate).login(self.identities()[0])
            return {'protocol':'fixture'}
        original=b.Custodian
        def capture_owner():value=original();captured.append(value);return value
        qa=SimpleNamespace(CookieClient=CookieClient,execute_native=native);listener=Mock(side_effect=AssertionError('no late listener'));publish=Mock()
        with patch.object(b,'LIFETIME',.03),patch.object(b,'Custodian',side_effect=capture_owner):
            with self.assertRaises(b.Stop):b.run(qa,gate,directory=Path('/unused'),binding='1'*64,fence='2'*64,owner='owner',deadline_unix=time.time()+1,publish=publish,socket_factory=listener)
        self.assertEqual(observed,{'closed':True,'empty':True});listener.assert_not_called();publish.assert_not_called()
        self.assertFalse(gate.active);self.assertTrue(all(not t.is_alive() for t in gate.threads))
    def test_pre_capture_expiry_and_watchdog_start_unknown_stop_no_native_no_release(self):
        for mode in ['expired','start']:
            gate=Gate();qa=SimpleNamespace(CookieClient=object,execute_native=Mock(side_effect=AssertionError('no capture')))
            if mode=='expired':gate.deadline=time.monotonic()-1
            with patch.object(b.threading,'Thread') as thread:
                thread.return_value.start.side_effect=OSError(CANARY);thread.return_value.ident=None;thread.return_value.is_alive.return_value=False
                with self.assertRaises(b.Stop) as error:b.run(qa,gate,directory=Path('/unused'),binding='1'*64,fence='2'*64,owner='owner',deadline_unix=time.time()+1,publish=Mock(),socket_factory=Mock())
                self.assertNotIn(CANARY,str(error.exception));qa.execute_native.assert_not_called()
            self.assertTrue(gate.closed);self.assertEqual(bool(gate.active),mode=='start')
    def test_custodian_deadline_rejects_capture_even_without_scheduled_watchdog(self):
        gate=Gate();custodian=b.Custodian();bridge=b.Bridge(gate,custodian)
        custodian.deadline=time.monotonic()-1
        with self.assertRaises(b.Stop):custodian.capture(self.identities()[0])
        self.assertFalse(custodian.values);self.assertTrue(bridge.close())

    def test_done_is_closed_owner_binding_fence_actual_report_not_invented_pass(self):
        with tempfile.TemporaryDirectory(prefix='ir-bridge-fixture-') as tmp:
            root=Path(tmp);d=root/'control';d.mkdir();report=root/'BROWSER_EVIDENCE.md';report.write_text('Root actual fixture evidence; no values.')
            value={'schema':'ir.native.browser_done.v1','owner':'owner','bindingSha256':'1'*64,'fenceSha256':'2'*64,'evidenceReportFile':report.name,'evidenceReportSha256':hashlib.sha256(report.read_bytes()).hexdigest(),'status':'ROOT_EVIDENCE_RECORDED'}
            p=d/'BROWSER_DONE.json';p.write_text(json.dumps(value));self.assertEqual(b.done_record(d,'1'*64,'2'*64,'owner'),value)
            for delta in [{'owner':'other'},{'bindingSha256':'3'*64},{'status':'PASS'},{'evidenceReportFile':'../other.md'},{'extra':True},{'evidenceReportSha256':'0'*64}]:
                changed=copy.deepcopy(value);changed.update(delta);p.write_text(json.dumps(changed))
                with self.assertRaises(b.Stop):b.done_record(d,'1'*64,'2'*64,'owner')
    def test_fixed_run_ready_only_public_and_retained_native_cleared_own_refs(self):
        with tempfile.TemporaryDirectory(prefix='ir-bridge-fixture-') as tmp:
            root=Path(tmp);d=root/'control';d.mkdir();g=Gate();identities=self.identities();published={};listener=Listener()
            class CookieClient:
                def __init__(self,gate):pass
                def login(self,identity):pass
            def native(gate,client_factory):
                for identity in identities:client_factory(gate).login(identity)
                for identity in identities:identity.password=''
                return {'result':'protocol_fixture'}
            qa=SimpleNamespace(CookieClient=CookieClient,execute_native=native)
            def publish(directory,name,value):published[name]=value
            def wait(seconds):
                report=root/'BROWSER_EVIDENCE.md';report.write_text('Actual Root fixture evidence.')
                (d/'BROWSER_DONE.json').write_text(json.dumps({'schema':'ir.native.browser_done.v1','owner':'owner','bindingSha256':'1'*64,'fenceSha256':'2'*64,'evidenceReportFile':report.name,'evidenceReportSha256':hashlib.sha256(report.read_bytes()).hexdigest(),'status':'ROOT_EVIDENCE_RECORDED'}))
            result=b.run(qa,g,directory=d,binding='1'*64,fence='2'*64,owner='owner',deadline_unix=time.time()+5,publish=publish,socket_factory=lambda *a:listener,wait=wait)
            self.assertEqual(result,{'result':'protocol_fixture'});self.assertEqual(set(published['BROWSER_READY.json']),{'schema','port','paths','bindingSha256','fenceSha256','deadlineUnix'})
            self.assertNotIn(CANARY,json.dumps(published));self.assertFalse(g.active);self.assertTrue(all(not t.is_alive() for t in g.threads));self.assertTrue(listener.closed)
            for file in root.rglob('*'):
                if file.is_file():self.assertNotIn(CANARY,file.read_text())
    def test_run_errors_sanitize_private_detail_and_no_unqualified_standalone(self):
        g=Gate();qa=SimpleNamespace(CookieClient=object,execute_native=Mock(side_effect=OSError(CANARY)))
        with self.assertRaises(b.Stop) as error:b.run(qa,g,directory=Path('/unused'),binding='1'*64,fence='2'*64,owner='owner',deadline_unix=time.time()+5,publish=Mock(),socket_factory=Mock())
        self.assertNotIn(CANARY,str(error.exception));self.assertTrue(g.closed)

if __name__=='__main__':unittest.main()
