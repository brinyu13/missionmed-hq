"""Dormant, fixed private-memory normal-login bridge. No capability on import."""
import hashlib
import html
import json
import math
import re
import socket
import sys
import threading
import time
import uuid
from pathlib import Path

NAMES=('mm_ir_phase1_qa_a_20261004','mm_ir_phase1_qa_b_20261004')
PATHS=('/qa-a','/qa-b')
LOGIN='https://missionmedinstitute.com/wp-login.php'
RETURN='https://missionmedinstitute.com/interview-ready/app/'
LIFETIME=600
FORM_LIMIT=4
REQUEST_LIMIT=16
REQUEST_CAP=4096
BODY_CAP=8192
SOCKET_SECONDS=1
JOIN_SECONDS=2
SHA=re.compile(r'[0-9a-f]{64}\Z')
REPORT=re.compile(r'[A-Z0-9_]+\.md\Z')

class Stop(RuntimeError):
    def __init__(self):super().__init__('NATIVE_BROWSER_STOP')

def check(value):
    if not value:raise Stop()

class Custodian:
    def __init__(self):self.lock=threading.Lock();self.values={};self.closed=False;self.deadline=None;self.gate=None
    def __repr__(self):return '<Custodian private>'
    def capture(self, identity):
        check(identity.username in NAMES and identity.email==identity.username+'@fictional.example' and
              type(identity.uid) is int and identity.uid>0 and type(identity.password) is str and
              1<=len(identity.password)<=256 and not any(ord(c)<32 for c in identity.password))
        with self.lock:
            check(not self.closed and (self.deadline is None or time.monotonic()<self.deadline) and
                  (self.gate is None or not self.gate.closed))
            old=self.values.get(identity.username)
            value=(identity.uid,identity.password)
            check(old is None or old==value)
            self.values[identity.username]=value
    def form(self, path):
        check(path in PATHS)
        with self.lock:
            check(not self.closed and set(self.values)==set(NAMES) and
                  (self.deadline is None or time.monotonic()<self.deadline) and (self.gate is None or not self.gate.closed))
            index=PATHS.index(path);name=NAMES[index];password=self.values[name][1]
            fields={'log':name,'pwd':password,'redirect_to':RETURN}
            hidden=''.join('<input type="hidden" name="'+k+'" value="'+html.escape(v,quote=True)+'">' for k,v in fields.items())
            body=('<!doctype html><meta charset="utf-8"><title>QA sign in</title>'+
                  '<form method="post" action="'+LOGIN+'" autocomplete="off">'+hidden+
                  '<button type="submit" name="wp-submit" value="Log In">Sign in to QA '+('A' if index==0 else 'B')+'</button></form>').encode()
            check(len(body)<=BODY_CAP);return body
    def clear(self):
        with self.lock:self.closed=True;self.values.clear()

def adapter_factory(qa, gate, custodian):
    """Closed subclass only; unchanged normal CookieClient.login owns auth."""
    class RetainedCookieClient(qa.CookieClient):
        def __init__(self, admitted_gate):
            check(admitted_gate is gate);super().__init__(admitted_gate)
        def login(self, identity):
            custodian.capture(identity)
            return super().login(identity)
    return RetainedCookieClient

def request_path(raw, port):
    check(type(raw) is bytes and len(raw)<=REQUEST_CAP and raw.endswith(b'\r\n\r\n'))
    try:text=raw.decode('ascii')
    except Exception:raise Stop() from None
    lines=text[:-4].split('\r\n');check(1<=len(lines)<=33)
    parts=lines[0].split(' ')
    check(len(parts)==3 and parts[0]=='GET' and parts[1] in PATHS and parts[2]=='HTTP/1.1')
    headers={}
    for line in lines[1:]:
        check(':' in line and len(line)<=2048)
        name,value=line.split(':',1);name=name.lower();value=value.strip()
        check(re.fullmatch(r'[a-z0-9-]+',name) is not None and name not in headers and
              not any(ord(c)<32 or ord(c)==127 for c in value))
        headers[name]=value
    check(headers.get('host')=='127.0.0.1:'+str(port) and headers.get('sec-fetch-mode')=='navigate' and
          headers.get('sec-fetch-dest')=='document' and headers.get('sec-fetch-site') in {'none','same-origin'} and
          not {'authorization','cookie','transfer-encoding','origin'}&headers.keys() and
          headers.get('content-length','0')=='0')
    return parts[1]

def response(body, accepted=True):
    check(type(body) is bytes and len(body)<=BODY_CAP)
    status=b'200 OK' if accepted else b'403 Forbidden'
    return (b'HTTP/1.1 '+status+b'\r\nContent-Type: text/html; charset=utf-8\r\n'+
            b'Cache-Control: no-store, private\r\nPragma: no-cache\r\nReferrer-Policy: no-referrer\r\n'+
            b'Content-Security-Policy: default-src \'none\'; form-action https://missionmedinstitute.com; frame-ancestors \'none\'; base-uri \'none\'\r\n'+
            b'X-Content-Type-Options: nosniff\r\nConnection: close\r\nContent-Length: '+str(len(body)).encode()+b'\r\n\r\n'+body)

class Bridge:
    def __init__(self, gate, custodian, *, socket_factory=socket.socket):
        self.gate=gate;self.custodian=custodian;self.socket_factory=socket_factory
        self.lock=threading.Lock();self.stopped=threading.Event();self.listener=None;self.connection=None;self.thread=None;self.watchdog=None
        self.deadline=min(gate.deadline,time.monotonic()+LIFETIME);self.port=None;self.forms=0;self.requests=0;self.failed=False
        self.key=uuid.uuid4().hex;self.registered=False;self.attempted=False;self.unresolved=False
        self.custodian.deadline=self.deadline;self.custodian.gate=gate
    def __repr__(self):return '<Bridge private>'
    def guard(self):
        check(not self.stopped.is_set() and time.monotonic()<self.deadline)
        self.gate.require('login')
        check(not self.stopped.is_set() and time.monotonic()<self.deadline)
    def arm(self):
        """Register/start custody deadline before the fixed native protocol."""
        self.guard()
        with self.lock:
            check(not self.registered and self.watchdog is None and not self.stopped.is_set())
            with self.gate.lock:
                self.gate.open_check();self.gate.active[self.key]=self;self.registered=True
            self.watchdog=threading.Thread(target=self.expire,daemon=True,name='ir-private-browser-deadline')
            self.gate.threads.append(self.watchdog)
            try:self.watchdog.start()
            except BaseException:self.unresolved=True;raise Stop() from None
    def start(self):
        self.guard()
        with self.lock:
            check(self.registered and self.watchdog is not None and self.listener is None and not self.stopped.is_set())
            self.attempted=True
            listener=self.socket_factory(socket.AF_INET,socket.SOCK_STREAM);self.listener=listener
            listener.bind(('127.0.0.1',0));listener.listen(1);listener.settimeout(.25)
            host,port=listener.getsockname();check(host=='127.0.0.1' and type(port) is int and 0<port<65536)
            self.port=port
            self.thread=threading.Thread(target=self.serve,daemon=True,name='ir-private-browser-bridge')
            self.gate.threads.append(self.thread)
            try:self.thread.start()
            except BaseException:self.unresolved=True;raise Stop() from None
    def expire(self):
        if not self.stopped.wait(max(0,self.deadline-time.monotonic())):
            self.failed=True;self.interrupt();self.gate.close()
    def serve(self):
        try:
            while not self.stopped.is_set() and time.monotonic()<self.deadline:
                try:connection,address=self.listener.accept()
                except socket.timeout:continue
                check(address[0]=='127.0.0.1')
                with self.lock:self.connection=connection
                try:self.handle(connection)
                finally:
                    connection.close()
                    with self.lock:self.connection=None
        except BaseException:
            if not self.stopped.is_set():self.failed=True;self.gate.close()
        finally:self.custodian.clear()
    def handle(self, connection):
        deadline=min(self.deadline,time.monotonic()+SOCKET_SECONDS)
        raw=bytearray();self.requests+=1;check(self.requests<=REQUEST_LIMIT)
        while not raw.endswith(b'\r\n\r\n'):
            check(not self.stopped.is_set() and time.monotonic()<deadline)
            connection.settimeout(max(.001,deadline-time.monotonic()))
            block=connection.recv(min(1024,REQUEST_CAP+1-len(raw)));check(block)
            raw.extend(block);check(len(raw)<=REQUEST_CAP)
        try:path=request_path(bytes(raw),self.port)
        except Stop:
            connection.sendall(response(b'',False));return
        self.guard()
        with self.lock:
            check(not self.stopped.is_set() and time.monotonic()<self.deadline and self.forms<FORM_LIMIT)
            body=self.custodian.form(path);self.forms+=1
        # Already admitted response may finish; no new response after closure.
        connection.settimeout(max(.001,min(SOCKET_SECONDS,self.deadline-time.monotonic())))
        connection.sendall(response(body))
    def interrupt(self):
        self.stopped.set();self.custodian.clear()
        with self.lock:
            for owned in (self.connection,self.listener):
                if owned is not None:
                    try:owned.close()
                    except Exception:self.failed=True;self.unresolved=True
            try:
                ended=(self.listener is not None and self.listener.fileno()==-1 and
                       (self.connection is None or self.connection.fileno()==-1)) if self.attempted else True
            except BaseException:ended=False
        return ended
    def close(self):
        ended=self.interrupt();limit=time.monotonic()+JOIN_SECONDS
        try:
            for worker in (self.thread,self.watchdog):
                if worker is not None and worker.ident is not None:worker.join(max(0,limit-time.monotonic()))
            ended=ended and not self.unresolved and all(worker is None or not worker.is_alive() for worker in (self.thread,self.watchdog))
        except BaseException:self.unresolved=True;ended=False
        if ended and self.registered:
            with self.gate.lock:self.gate.active.pop(self.key,None)
        return ended

def done_record(directory, binding, fence, owner):
    path=Path(directory)/'BROWSER_DONE.json'
    if not path.exists():return None
    check(not path.is_symlink() and path.is_file() and path.stat().st_size<=4096)
    try:value=json.loads(path.read_bytes())
    except Exception:raise Stop() from None
    check(type(value) is dict and set(value)=={'schema','owner','bindingSha256','fenceSha256','evidenceReportFile','evidenceReportSha256','status'} and
          value['schema']=='ir.native.browser_done.v1' and value['owner']==owner and
          value['bindingSha256']==binding and value['fenceSha256']==fence and
          value['status']=='ROOT_EVIDENCE_RECORDED' and type(value['evidenceReportFile']) is str and
          REPORT.fullmatch(value['evidenceReportFile']) and type(value['evidenceReportSha256']) is str and SHA.fullmatch(value['evidenceReportSha256']))
    report=Path(directory).parent/value['evidenceReportFile']
    check(not report.is_symlink() and report.is_file() and report.stat().st_size<=65536 and
          hashlib.sha256(report.read_bytes()).hexdigest()==value['evidenceReportSha256'])
    return value

def run(qa, gate, *, directory, binding, fence, owner, deadline_unix, publish, socket_factory=socket.socket, wait=None):
    """Only the reviewed wrapper may call this; no standalone execution."""
    custodian=Custodian();bridge=Bridge(gate,custodian,socket_factory=socket_factory)
    wait=wait or bridge.stopped.wait
    try:
        bridge.arm()
        bridge.guard()
        result=qa.execute_native(gate,client_factory=adapter_factory(qa,gate,custodian))
        bridge.start()
        publish(Path(directory),'BROWSER_READY.json',{'schema':'ir.native.browser_ready.v1','port':bridge.port,'paths':list(PATHS),
            'bindingSha256':binding,'fenceSha256':fence,'deadlineUnix':min(deadline_unix,time.time()+max(0,bridge.deadline-time.monotonic()))})
        while True:
            bridge.guard()
            check(not bridge.failed)
            if done_record(directory,binding,fence,owner) is not None:return result
            wait(min(.5,max(0,bridge.deadline-time.monotonic())))
    except BaseException:
        gate.close();raise Stop() from None
    finally:
        if not bridge.close():gate.close()

if __name__=='__main__':
    if len(sys.argv)!=1:
        print('NATIVE_BROWSER_STOP');raise SystemExit(1)
    print('DORMANT: reviewed wrapper/private AUTH admission required')
