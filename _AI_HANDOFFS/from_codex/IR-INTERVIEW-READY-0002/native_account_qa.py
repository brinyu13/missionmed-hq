"""Dormant IR native QA preparation. No CLI execution adapter is admitted.

All native transports are private pipes/in-memory TLS cookie jars. A Foreman-owned,
independently reviewed adapter must supply fresh canonical lease/status/readback
checks to execute_native(); this file never retrieves coordination credentials.
"""
from __future__ import annotations

import concurrent.futures
import dataclasses
import hashlib
import html.parser
import http.cookiejar
import json
import re
import secrets
import select
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Callable

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
ORIGIN = 'https://missionmedinstitute.com'
APP = '/interview-ready/app/'
ACCOUNT = '/my-account/'
ENDPOINT = '/wp-json/missionmed-ir/v1/state'
SSH_ARGV = ('ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
            'missionmed-kinsta', 'wp', '--path=/www/theresidencyacademy_209/public',
            'eval-file', '/dev/stdin')
NAMES = ('mm_ir_phase1_qa_a_20261004', 'mm_ir_phase1_qa_b_20261004')
EMAILS = tuple(name + '@fictional.example' for name in NAMES)
META = '_mmed_ir_state_v1'
# Donor lineage only. Final integration may change reviewed source bytes; the
# independent admission seals its complete new local preimages, never inherits
# these old hashes as live/source approval.
EXPECTED_SOURCE = {
    'interview-ready/integration/missionmed-interview-ready.php': 'f32df31e1c20af86d4c6fe48ee380832dbc2dc6d60a107e58bb7bc11f7a20243',
    'interview-ready/account.js': '018a0e2f3706f2f5cbe64ddb8b8fb2cf2b07b640730c7b3211cbc4397b17518a',
    'interview-ready/qa-account.py': '393fdd686a8670ce81373aca5d086f22886d0e1cfd010cde7e7a60ce6eeeaff6',
}
ALLOWED_ACTIONS = frozenset({
    'collision_read', 'creation_inventory_read', 'create_a', 'create_b', 'login', 'logout', 'app_get',
    'state_get', 'state_post', 'rejection_post', 'metadata_read', 'lock_lifecycle',
    'native_connection_loss',
})
SHA = re.compile(r'[0-9a-f]{64}\Z')


class Stop(Exception):
    """Only fixed, non-sensitive failure categories can escape private transports."""
    def __init__(self, category='private_operation_failed'):
        if category not in {'dormant', 'admission', 'guard', 'drift', 'collision',
                            'private_operation_failed', 'native_assertion', 'not_admitted'}:
            category = 'private_operation_failed'
        self.category = category
        super().__init__(category)


@dataclasses.dataclass(frozen=True, repr=False)
class Admission:
    """Safe reviewed bindings only. No credentials/nonces/state belong here.

    control_contract_sha256 binds the reviewed Foreman adapter implementation.
    review_sha256 binds independent exact-byte approval; it is never self-issued.
    runtime binds the entire approved package and current gateway/HTML/pointer
    readback digest via the Foreman's adapter, not a builder assertion.
    """
    review_sha256: str
    control_contract_sha256: str
    runner_sha256: str
    tests_sha256: str
    local_preimages: tuple[tuple[str, str], ...]
    runtime_preimages: tuple[tuple[str, str], ...]
    actions: frozenset[str]
    creation_hook_inventory_sha256: str

    def fingerprint(self):
        return hashlib.sha256(json.dumps(dataclasses.asdict(self), sort_keys=True,
            default=lambda value: sorted(value), separators=(',', ':')).encode()).hexdigest()

    def validate(self):
        for value in (self.review_sha256, self.control_contract_sha256,
                      self.runner_sha256, self.tests_sha256, self.creation_hook_inventory_sha256):
            if not SHA.fullmatch(value):
                raise Stop('admission')
        if not self.actions or not self.actions <= ALLOWED_ACTIONS:
            raise Stop('admission')
        local = dict(self.local_preimages)
        if len(local) != len(self.local_preimages) or not EXPECTED_SOURCE.keys() <= local.keys():
            raise Stop('admission')
        required_authority = {
            '/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2/decisions/DR-375_ir_phase1_production_authority.md',
            '/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2/decisions/DR-376_ir_phase1_bounded_execution_annex.md',
        }
        if not required_authority <= local.keys() or not self.runtime_preimages:
            raise Stop('admission')
        runtime = dict(self.runtime_preimages)
        if len(runtime) != len(self.runtime_preimages) or not {'package', 'gateway', 'html', 'pointer'} <= runtime.keys():
            raise Stop('admission')
        if any(not SHA.fullmatch(digest) for _, digest in self.local_preimages + self.runtime_preimages):
            raise Stop('admission')


@dataclasses.dataclass(frozen=True, repr=False)
class SafeStatus:
    """Adapter returns status-only values after real canonical validation/readback."""
    binding_sha256: str
    runtime_preimages: tuple[tuple[str, str], ...]
    checked_monotonic: float
    healthy: bool
    fenced: bool
    current_binding: bool
    independent_admission: bool


class Gate:
    def __init__(self, admission: Admission | None, control: Callable | None,
                 control_contract_sha256: str | None = None):
        self.admission = admission
        self.control = control
        self.control_contract_sha256 = control_contract_sha256

    def require(self, action):
        if self.admission is None or self.control is None:
            raise Stop('dormant')
        a = self.admission
        a.validate()
        if self.control_contract_sha256 != a.control_contract_sha256 or action not in a.actions:
            raise Stop('not_admitted')
        bindings = ((str(HERE / 'native_account_qa.py'), a.runner_sha256),
                    (str(HERE / 'native_account_qa_tests.py'), a.tests_sha256)) + a.local_preimages
        try:
            for name, expected in bindings:
                path = Path(name)
                if not path.is_absolute():
                    path = ROOT / path
                if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                    raise Stop('drift')
            proof = self.control(action, a.fingerprint())
            age = time.monotonic() - proof.checked_monotonic
            if (type(proof) is not SafeStatus or not 0 <= age <= 2 or
                    proof.binding_sha256 != a.fingerprint() or
                    proof.runtime_preimages != a.runtime_preimages or
                    not all(value is True for value in (proof.healthy, proof.fenced,
                        proof.current_binding, proof.independent_admission))):
                raise Stop('guard')
        except Stop:
            raise
        except Exception:
            raise Stop('guard') from None


@dataclasses.dataclass(repr=False)
class Identity:
    label: str
    username: str
    email: str
    password: str
    uid: int = 0

    def __repr__(self):
        return '<Identity private>'


def require(condition):
    if not condition:
        raise Stop('native_assertion')


def private_pipe(code: str, *, on_line=None, timeout=20):
    """Fixed argv; private stdin/stdout/stderr, bounded memory, no temp files.

    Never print a child exception/output. No process environment is constructed,
    exported or used to carry a QA credential. PHP receives only SSH stdin.
    """
    child = None
    try:
        child = subprocess.Popen(SSH_ARGV, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE)
        child.stdin.write(code.encode())
        child.stdin.close()
        buffers = {child.stdout: bytearray(), child.stderr: bytearray()}
        active = list(buffers)
        deadline = time.monotonic() + timeout
        notified = False
        while active:
            left = deadline - time.monotonic()
            if left <= 0:
                raise Stop()
            readable, _, _ = select.select(active, [], [], min(left, 1))
            for pipe in readable:
                block = pipe.read1(8192)
                if not block:
                    active.remove(pipe)
                    continue
                buffers[pipe].extend(block)
                if len(buffers[pipe]) > 65536:
                    raise Stop()
                if on_line and pipe is child.stdout and not notified and b'\n' in buffers[pipe]:
                    line = bytes(buffers[pipe]).split(b'\n', 1)[0]
                    require(line == b'{"held":true}')
                    notified = True
                    on_line()
        child.wait(timeout=max(0.1, deadline - time.monotonic()))
        require(child.returncode == 0 and not buffers[child.stderr])
        result = bytes(buffers[child.stdout]).decode()
        if on_line:
            require(notified)
            result = result.split('\n', 1)[1]
        return json.loads(result)
    except Stop:
        raise
    except Exception:
        raise Stop() from None
    finally:
        if child:
            if child.poll() is None:
                child.kill()
                child.wait()
            for pipe in (child.stdin, child.stdout, child.stderr):
                if pipe:
                    pipe.close()


def php_preamble():
    # Process-local mail suppression: does not change a WP option or shared hook.
    return "<?php\nini_set('display_errors','0'); error_reporting(0);\n" + """
function mmed_ir_qa_no_mail(){return false;}
function mmed_ir_qa_no_http(){return new WP_Error('ir_qa_outbound_blocked','Blocked.');}
add_filter('pre_wp_mail','mmed_ir_qa_no_mail',PHP_INT_MAX);
add_filter('pre_http_request','mmed_ir_qa_no_http',PHP_INT_MAX);
function ir_fail(){throw new RuntimeException('ir_private_failure');}
function ir_inventory(){
 global $wp_filter;$rows=[];
 foreach($wp_filter as $tag=>$hook){
  if(!is_object($hook)||!isset($hook->callbacks)){ir_fail();}
  foreach($hook->callbacks as $priority=>$callbacks){foreach($callbacks as $entry){
   $f=$entry['function'];
   if(is_string($f)&&in_array($f,['mmed_ir_qa_no_mail','mmed_ir_qa_no_http'],true)){continue;}
   if(is_array($f)&&count($f)===2){$class=is_object($f[0])?get_class($f[0]):$f[0];$id=$class.'::'.$f[1];$r=new ReflectionMethod($f[0],$f[1]);}
   elseif($f instanceof Closure){$r=new ReflectionFunction($f);$id='closure:'.$r->getFileName().':'.$r->getStartLine();}
   elseif(is_string($f)&&strpos($f,'::')!==false){$r=new ReflectionMethod($f);$id=$f;}
   elseif(is_string($f)){$id=$f;$r=new ReflectionFunction($f);}
   elseif(is_object($f)&&is_callable($f)){$id=get_class($f).'::__invoke';$r=new ReflectionMethod($f,'__invoke');}
   else{ir_fail();}
   $file=$r->getFileName();$digest=$file&&is_file($file)?hash_file('sha256',$file):'internal_or_eval';
   $rows[]=[$tag,(int)$priority,$id,(int)$entry['accepted_args'],$digest];
  }}
 }
 usort($rows,function($a,$b){return strcmp(wp_json_encode($a),wp_json_encode($b));});
 return ['sha256'=>hash('sha256',wp_json_encode($rows)),'callbacks'=>$rows];
}
function ir_owner($name,$uid){
 $u=get_user_by('login',$name);
 if(!$u || (int)$u->ID!==$uid || $u->user_email!==$name.'@fictional.example' ||
    $u->roles!==['subscriber']){ir_fail();}
 return $u;
}
"""


def collision_read(gate, pipe=private_pipe):
    gate.require('collision_read')
    code = php_preamble() + '$names=' + json.dumps(list(NAMES)) + ';\n' + """
foreach($names as $n){if(username_exists($n)||email_exists($n.'@fictional.example')){echo '{"collision":true}';return;}}
echo '{"collision":false}';
"""
    response = pipe(code)
    if response != {'collision': False}:
        raise Stop('collision')


def creation_inventory_read(gate, pipe=private_pipe):
    """Private prospective inventory for independent callback qualification.

    Suppression covers wp_mail/WordPress HTTP API only. Approval must qualify
    callback effects including direct transports, provisioning and enrollment;
    unknown callbacks are never admitted by this fixture or by a digest alone.
    """
    gate.require('creation_inventory_read')
    result = pipe(php_preamble() + "echo wp_json_encode(ir_inventory());\n")
    require(type(result) is dict and set(result) == {'sha256', 'callbacks'} and
            type(result['sha256']) is str and SHA.fullmatch(result['sha256']) and
            type(result['callbacks']) is list)
    return result


def create_identity(gate, identity, pipe=private_pipe):
    require(identity.username in NAMES and identity.email == identity.username + '@fictional.example')
    gate.require('create_a' if identity.username == NAMES[0] else 'create_b')
    # JSON is decoded by PHP from a private literal. Password is never argv/output.
    payload = json.dumps({'user_login': identity.username, 'user_email': identity.email,
                          'user_pass': identity.password, 'role': 'subscriber'}, separators=(',', ':'))
    literal = json.dumps(payload).replace('$', '\\u0024')
    inventory_digest = gate.admission.creation_hook_inventory_sha256
    require(SHA.fullmatch(inventory_digest) is not None)
    code = php_preamble() + '$expected=' + json.dumps(inventory_digest) + ';\n' + '$p=json_decode(' + literal + ',true);\n' + """
if(username_exists($p['user_login'])||email_exists($p['user_email'])){echo '{"collision":true}';return;}
$inventory=ir_inventory();if(!hash_equals($expected,$inventory['sha256'])){ir_fail();}
$id=wp_insert_user($p);if(is_wp_error($id)){ir_fail();}
$u=ir_owner($p['user_login'],(int)$id);
if(metadata_exists('user',$id,'_mmed_ir_state_v1')){ir_fail();}
if(!function_exists('learndash_user_get_enrolled_courses')||learndash_user_get_enrolled_courses($id)){ir_fail();}
echo wp_json_encode(['ok'=>true,'uid'=>(int)$id]);
"""
    response = pipe(code)
    if response == {'collision': True}:
        raise Stop('collision')
    require(type(response) is dict and set(response) == {'ok', 'uid'} and
            response['ok'] is True and type(response['uid']) is int and response['uid'] > 0)
    identity.uid = response['uid']


class FormParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.links = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'form':
            self.current = {'action': values.get('action', ''), 'method': values.get('method', 'get').lower(), 'fields': {}}
            self.forms.append(self.current)
        elif tag in {'input', 'button'} and self.current and values.get('name'):
            if values.get('type', '').lower() not in {'checkbox', 'radio'} or 'checked' in values:
                self.current['fields'][values['name']] = values.get('value', '')
        elif tag == 'a' and 'href' in values:
            self.links.append(values['href'])

    def handle_endtag(self, tag):
        if tag == 'form':
            self.current = None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


@dataclasses.dataclass(repr=False)
class Reply:
    status: int
    headers: object
    body: bytes
    url: str


class CookieClient:
    def __init__(self, gate):
        self.gate = gate
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPCookieProcessor(self.jar))
        self.context = None

    def __repr__(self):
        return '<CookieClient private>'

    def url(self, target):
        result = urllib.parse.urljoin(ORIGIN + '/', target)
        parts = urllib.parse.urlsplit(result)
        require(parts.scheme == 'https' and parts.netloc == urllib.parse.urlsplit(ORIGIN).netloc and
                not parts.username and not parts.password and not parts.fragment)
        return result

    def request(self, action, target, method='GET', body=None, headers=None):
        url = self.url(target)
        parts = urllib.parse.urlsplit(url)
        try:
            query = urllib.parse.parse_qs(parts.query, strict_parsing=True) if parts.query else {}
        except Exception:
            raise Stop() from None
        if action == 'login':
            require(parts.path in {ACCOUNT, APP} and set(query) <= {'redirect', 'redirect_to'} and
                    all(values == [ORIGIN + APP] for values in query.values()) and
                    (method == 'GET' or (method == 'POST' and parts.path == ACCOUNT)))
        elif action == 'logout':
            require(method == 'GET' and parts.path in {ACCOUNT, ACCOUNT + 'customer-logout/'} and
                    set(query) <= {'_wpnonce'} and all(len(v) == 1 for v in query.values()))
        elif action == 'app_get':
            require(parts.path == APP and not query and method == 'GET')
        else:
            require(action in {'state_get', 'state_post', 'rejection_post'} and
                    parts.path == ENDPOINT and query in ({}, {'owner': ['other']}) and method in {'GET', 'POST'})
        # The guard's real runtime readback precedes every read and mutation.
        self.gate.require(action)
        request_headers = {'User-Agent': 'MissionMed-IR-bounded-native-QA',
                           'Referer': ORIGIN + APP, 'Sec-Fetch-Site': 'same-origin'}
        request_headers.update(headers or {})
        try:
            request = urllib.request.Request(url, data=body, method=method, headers=request_headers)
            try:
                response = self.opener.open(request, timeout=12)
            except urllib.error.HTTPError as e:
                response = e
            with response:
                data = response.read(2 * 1024 * 1024 + 1)
                require(len(data) <= 2 * 1024 * 1024)
                return Reply(response.status, response.headers, data, url)
        except Stop:
            raise
        except Exception:
            raise Stop() from None

    def redirects(self, action, response):
        for _ in range(4):
            if response.status not in {301, 302, 303}:
                return response
            response = self.request(action, response.headers.get('Location', ''))
        raise Stop()

    def login(self, identity):
        target = ACCOUNT + '?' + urllib.parse.urlencode({'redirect_to': ORIGIN + APP, 'redirect': ORIGIN + APP})
        page = self.request('login', target)
        require(page.status == 200)
        parser = FormParser()
        parser.feed(page.body.decode())
        candidates = [f for f in parser.forms if 'username' in f['fields'] and 'password' in f['fields']
                      and 'woocommerce-login-nonce' in f['fields'] and f['method'] == 'post']
        require(len(candidates) == 1)
        form = candidates[0]
        fields = {k: v for k, v in form['fields'].items() if k in {'woocommerce-login-nonce', '_wp_http_referer', 'redirect'}}
        fields.update(username=identity.username, password=identity.password, login='Log in', redirect=ORIGIN + APP)
        reply = self.request('login', form['action'] or target, 'POST',
            urllib.parse.urlencode(fields).encode(),
            {'Content-Type': 'application/x-www-form-urlencoded', 'Origin': ORIGIN})
        reply = self.redirects('login', reply)
        require(reply.status == 200 and urllib.parse.urlsplit(reply.url).path == APP)
        self.bootstrap(reply)

    def bootstrap(self, reply=None):
        reply = reply or self.request('app_get', APP)
        require(reply.status == 200 and 'no-store' in reply.headers.get('Cache-Control', '').lower())
        text = reply.body.decode()
        match = re.search(r'const context =\s*', text)
        require(match is not None)
        try:
            value, _ = json.JSONDecoder().raw_decode(text[match.end():])
            require(type(value) is dict and set(value) == {'subject', 'nonce', 'endpoint'} and
                    SHA.fullmatch(value['subject']) and type(value['nonce']) is str and
                    1 <= len(value['nonce']) <= 128 and value['endpoint'] == ORIGIN + ENDPOINT)
            self.context = value
        except Stop:
            raise
        except Exception:
            raise Stop() from None

    def state(self, command=None, *, action=None, bad_nonce=False, cross_origin=False, owner=False):
        context = self.context or {'nonce': 'invalid', 'subject': '0' * 64}
        headers = {'X-WP-Nonce': 'invalid' if bad_nonce else context['nonce'],
                   'X-IR-Subject': context['subject'], 'Origin': 'https://fictional.example' if cross_origin else ORIGIN}
        if cross_origin:
            headers['Sec-Fetch-Site'] = 'cross-site'
        body = None if command is None else json.dumps(command, separators=(',', ':')).encode()
        if body is not None:
            headers['Content-Type'] = 'application/json'
        reply = self.request(action or ('state_get' if command is None else 'state_post'),
                             ENDPOINT + ('?owner=other' if owner else ''),
                             'GET' if command is None else 'POST', body, headers)
        require('no-store' in reply.headers.get('Cache-Control', '').lower())
        require(not reply.headers.get('Access-Control-Allow-Origin'))
        if reply.status != 200:
            return reply.status, None
        try:
            value = json.loads(reply.body)
            require(type(value) is dict and set(value) == {'subject', 'state'} and
                    value['subject'] == context['subject'] and type(value['state']) is dict)
            return reply.status, value['state']
        except Stop:
            raise
        except Exception:
            raise Stop() from None

    def logout(self):
        reply = self.request('logout', ACCOUNT)
        require(reply.status == 200)
        parser = FormParser()
        parser.feed(reply.body.decode())
        links = [link for link in parser.links if '/customer-logout/' in link]
        require(len(set(links)) == 1)
        reply = self.redirects('logout', self.request('logout', links[0]))
        require(reply.status == 200)
        self.context = None
        require(self.request('app_get', APP).status == 401)
        self.jar.clear()


def command(revision, marker):
    require(marker in {'online:0:1', 'online:0:2', 'online:0:3', 'online:0:4'})
    return {'expectedRevision': revision, 'commandId': str(uuid.uuid4()),
            'state': {'done': {marker: True}, 'auto': {'cam': False, 'mic': False, 'env': False},
                      'kit': ['online:webcam:bc:B09NBWWP79'], 'mode': 'online'}}


def metadata_read(gate, identity, pipe=private_pipe):
    gate.require('metadata_read')
    code = php_preamble() + '$name=' + json.dumps(identity.username) + ';$uid=' + str(identity.uid) + ';\n' + """
ir_owner($name,$uid);wp_cache_delete($uid,'user_meta');
$rows=get_user_meta($uid,'_mmed_ir_state_v1',false);
if(!is_array($rows)){ir_fail();}
echo wp_json_encode(['count'=>count($rows),'state'=>count($rows)===1?$rows[0]:null]);
"""
    result = pipe(code)
    require(type(result) is dict and set(result) == {'count', 'state'})
    return result


def lock_denial(gate, identity, client, revision, pipe=private_pipe):
    """Original isolated WP-CLI handle competes with HTTPS gateway for QA lock.

    Admission must cover entire bounded acquire/hold/finally-release lifecycle.
    No table write. Holder cannot specify a real/non-QA UID or arbitrary lock.
    """
    gate.require('lock_lifecycle')
    code = php_preamble() + '$name=' + json.dumps(identity.username) + ';$uid=' + str(identity.uid) + ';\n' + """
ir_owner($name,$uid);global $wpdb;$h=$wpdb->dbh;$held=false;
if(!($h instanceof mysqli)){ir_fail();}$lock='mmed_ir_v1:'.$uid;
try{
 $r=mysqli_query($h,"SELECT GET_LOCK('".$lock."',0)");$v=$r?mysqli_fetch_row($r):null;
 if($r){mysqli_free_result($r);}if(!$v||(string)$v[0]!=='1'){ir_fail();}$held=true;
 echo '{"held":true}'."\n";flush();sleep(6);
}finally{if($held){$r=mysqli_query($h,"SELECT RELEASE_LOCK('".$lock."')");$v=$r?mysqli_fetch_row($r):null;if($r){mysqli_free_result($r);}if(!$v||(string)$v[0]!=='1'){ir_fail();}}}
echo '{"released":true}';
"""
    def compete():
        status, _ = client.state(command(revision, 'online:0:4'))
        require(status == 503)
    require(pipe(code, on_line=compete, timeout=20) == {'released': True})
    require(client.state()[1]['revision'] == revision)


def native_connection_loss(gate, identity, pipe=private_pipe):
    """Optional driver-seam proof, never a full HTTP disconnect/cache-hook PASS."""
    gate.require('native_connection_loss')
    code = php_preamble() + '$name=' + json.dumps(identity.username) + ';$uid=' + str(identity.uid) + ';\n' + r"""
ir_owner($name,$uid);global $wpdb;$owner=$wpdb;$h=$owner->dbh;$held=false;$closed=false;
if(!($h instanceof mysqli)){ir_fail();}$lock='mmed_ir_v1:'.$uid;
try{
 $r=mysqli_query($h,"SELECT CONNECTION_ID(), GET_LOCK('".$lock."',0)");$v=$r?mysqli_fetch_row($r):null;
 if($r){mysqli_free_result($r);}if(!$v||(string)$v[1]!=='1'){ir_fail();}$held=true;
 $db=new \MissionMed\InterviewReady\MMed_IR_Locked_DB($owner,$h,$v[0],$lock);
 if(!$db->intact()){ir_fail();}mysqli_close($h);$closed=true;
 $blocked=false;try{$db->query('SELECT 1');}catch(Throwable $e){$blocked=true;}
 if(!$blocked||$db->intact()||$db->check_connection(false)!==false||$db->db_connect(false)!==false){ir_fail();}
}finally{$wpdb=$owner;if($held&&!$closed){try{$r=mysqli_query($h,"SELECT RELEASE_LOCK('".$lock."')");if($r){mysqli_free_result($r);}}catch(Throwable $e){}}}
echo '{"isolated_seam":true}';
"""
    require(pipe(code) == {'isolated_seam': True})


def race(gate, sessions, revision):
    commands = [command(revision, marker) for marker in ('online:0:1', 'online:0:2')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(session.state, cmd) for session, cmd in zip(sessions, commands)]
        results = [future.result() for future in futures]
    require(sorted(status for status, _ in results) == [200, 409])
    winner = next(state for status, state in results if status == 200)
    require(winner['revision'] == revision + 1)
    return winner


def execute_native(gate, *, pipe=private_pipe, client_factory=CookieClient):
    """Call only from exact independently reviewed Foreman control adapter.

    The same adapter must serialize local binding changes and keep its canonical
    lease keeper healthy for the entire run. A failure stops; never automatically
    retries create/login/POST, modifies collisions, or cleans retained fixtures.
    """
    gate.require('collision_read')
    identities = [Identity(label, name, email, secrets.token_urlsafe(36))
                  for label, name, email in zip(('a', 'b'), NAMES, EMAILS)]
    counts = {'checks': 0}
    clients = []
    try:
        collision_read(gate, pipe)
        for identity in identities:
            create_identity(gate, identity, pipe)
        a, b = identities
        a1, a2, b1, anon = [client_factory(gate) for _ in range(4)]
        clients = [a1, a2, b1, anon]
        a1.login(a); a2.login(a); b1.login(b)
        require(a1.context['subject'] == a2.context['subject'] != b1.context['subject'])
        require(all(session.state()[1]['revision'] == 0 for session in (a1, a2, b1)))
        counts['checks'] += 1
        # A's first write races through two independent HTTP cookie sessions.
        saved = race(gate, (a1, a2), 0)
        require(metadata_read(gate, a, pipe) == {'count': 1, 'state': saved})
        counts['checks'] += 1
        saved = race(gate, (a1, a2), saved['revision'])
        require(metadata_read(gate, a, pipe) == {'count': 1, 'state': saved})
        counts['checks'] += 1
        retry = command(saved['revision'], 'online:0:3')
        status, saved = a1.state(retry); require(status == 200)
        # Deliberately disregard acknowledgement, then resend exact private command.
        require(a2.state(retry) == (200, saved))
        changed = json.loads(json.dumps(retry)); changed['state']['done'] = {'online:0:4': True}
        require(a2.state(changed)[0] == 409)
        require(a2.state(command(0, 'online:0:1'))[0] == 409)
        counts['checks'] += 1
        bcommand = command(0, 'online:0:4')
        require(b1.state(bcommand)[0] == 200)
        bstate = b1.state()[1]
        require(a1.state()[1] == saved and bstate != saved)
        counts['checks'] += 1
        negative = command(saved['revision'], 'online:0:1')
        require(anon.state()[0] in {401, 403})
        require(anon.state(negative, action='rejection_post')[0] in {401, 403})
        require(a1.state(negative, action='rejection_post', bad_nonce=True)[0] in {401, 403})
        require(a1.state(negative, action='rejection_post', cross_origin=True)[0] == 403)
        require(a1.state(negative, action='rejection_post', owner=True)[0] == 400)
        owner_body = json.loads(json.dumps(negative)); owner_body['owner'] = 'other'
        require(a1.state(owner_body, action='rejection_post')[0] == 400)
        require(a1.state()[1] == saved and b1.state()[1] == bstate)
        counts['checks'] += 1
        lock_denial(gate, a, a1, saved['revision'], pipe)
        require(metadata_read(gate, a, pipe) == {'count': 1, 'state': saved})
        counts['checks'] += 1
        # Confirm finally released lock by completing one valid subsequent save.
        status, saved = a1.state(command(saved['revision'], 'online:0:1')); require(status == 200)
        a1.logout(); a1.login(a)
        require(a1.state()[1] == saved)
        a1.logout(); a1.login(b)
        require(a1.context['subject'] == b1.context['subject'] and a1.state()[1] == bstate)
        require(metadata_read(gate, a, pipe) == {'count': 1, 'state': saved})
        require(metadata_read(gate, b, pipe) == {'count': 1, 'state': bstate})
        counts['checks'] += 1
        seam = 'NOT_ADMITTED'
        if 'native_connection_loss' in gate.admission.actions:
            native_connection_loss(gate, a, pipe)
            seam = 'ISOLATED_DRIVER_SEAM_ONLY'
        return {'mode': 'native', 'result': 'PASS_BOUNDED_PROTOCOL_CHECKS',
                'checks': counts['checks'], 'identities_retained': 2,
                'connection_loss': seam,
                'limits': ['VISIBLE_BROWSER_JOURNEY_PENDING', 'FULL_HTTP_DISCONNECT_PENDING',
                           'CORRUPT_DUPLICATE_HISTORY_FIXTURE_ONLY', 'PROVIDER_CACHE_ACCEPTANCE_PENDING',
                           'ADMIN_MR_REGRESSION_PENDING']}
    except Stop:
        raise
    except Exception:
        raise Stop() from None
    finally:
        # Clear references; no deletion, logout-on-failure or further mutation.
        for identity in identities:
            identity.password = ''
        for client in clients:
            client.context = None
            client.jar.clear()


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv == ['--execute']:
        # Exact review and canonical control contract must be wired by Foreman.
        print(json.dumps({'result': 'BLOCKED', 'reason': 'FOREMAN_CONTROL_ADAPTER_NOT_ADMITTED'}))
        return 2
    if argv:
        print(json.dumps({'result': 'BLOCKED', 'reason': 'UNSUPPORTED_ARGUMENT'}))
        return 2
    print(json.dumps({'mode': 'dormant', 'result': 'NO_RUNTIME_CALLS',
                      'next': 'RUN_LOCAL_FIXTURES_THEN_INDEPENDENT_BYTE_REVIEW'}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
