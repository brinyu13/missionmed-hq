"""Dormant IR native QA preparation. No CLI execution adapter is admitted.

All native transports are private pipes/in-memory TLS cookie jars. A Foreman-owned,
independently reviewed adapter must supply fresh canonical lease/status/readback
checks to execute_native(); this file never retrieves coordination credentials.
"""
from __future__ import annotations

import concurrent.futures
import contextlib
import dataclasses
import email.parser
import hashlib
import html.parser
import http.cookiejar
import json
import math
import os
import re
import secrets
import select
import subprocess
import sys
import threading
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
            '-o', 'StrictHostKeyChecking=yes',
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
IO_SECONDS = 12
REAP_SECONDS = 2
DRAIN_SECONDS = 15
BODY_CAP = 2 * 1024 * 1024
HEADER_CAP = 65536
INVENTORY_CAP = 1024 * 1024
CURL_ARGV = ('/usr/bin/curl', '-q', '--config', '-')
PRIVATE_ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'}


INVENTORY_STAGES = frozenset({'INVENTORY_GATE_CHECK', 'INVENTORY_DISPATCH_CHECK',
    'INVENTORY_CAPTURE', 'INVENTORY_JSON', 'INVENTORY_SCHEMA', 'INVENTORY_ROWS',
    'INVENTORY_DIGEST', 'INVENTORY_COMPLETE'})
STOP_CATEGORIES = frozenset({'dormant', 'admission', 'guard', 'drift', 'collision',
    'private_operation_failed', 'native_assertion', 'not_admitted', 'containment',
    'io_deadline', 'child_exit', 'stderr_present', 'json_decode',
    'php_hook_shape', 'php_callback_shape', 'php_reflection_function',
    'php_reflection_method', 'php_file_digest', 'php_encode',
    'php_fatal_error', 'php_parse_error', 'wp_cli_bootstrap_error',
    'wp_cli_command_error', 'ssh_transport_error', 'shell_command_error'})
CHILD_ERROR_PATTERNS = (
    (rb'(?:PHP )?Fatal error: [ -~]+', 'php_fatal_error'),
    (rb'(?:PHP )?Parse error: [ -~]+', 'php_parse_error'),
    (rb'Error: (?:This does not seem to be a WordPress installation\.|Error establishing a database connection\.)[ -~]*', 'wp_cli_bootstrap_error'),
    (rb"Error: (?:The file '/dev/stdin' doesn't exist\.|'eval-file' is not a registered wp command\.[ -~]*)", 'wp_cli_command_error'),
    (rb'ssh: (?:Could not resolve hostname [ -~]+: (?:Name or service not known|Temporary failure in name resolution|nodename nor servname provided, or not known)|connect to host [ -~]+ port [0-9]+: (?:Connection refused|Connection timed out|No route to host))', 'ssh_transport_error'),
    (rb'Host key verification failed\.', 'ssh_transport_error'),
    (rb'(?:kex_exchange_identification: (?:Connection closed by remote host|read: Connection reset by peer)|client_loop: send disconnect: Broken pipe)', 'ssh_transport_error'),
    (rb'(?:bash: line [0-9]+: |sh: [0-9]+: )?(?:wp|php): (?:command not found|not found)', 'shell_command_error'),
    (rb'Error: There has been a critical error on this website\.[ -~]*', 'wp_cli_bootstrap_error'),
    (rb'Error: (?:(?:Could not|Cannot|Unable to) (?:open|read|evaluate|eval) (?:the )?(?:input )?file|syntax error|Error reading (?:file|stdin))[ -~]*', 'wp_cli_command_error'),
)
STDERR_MARKERS = frozenset({'PHP_WARNING','PHP_FATAL','PHP_PARSE','WPCLI_ERROR',
    'UNCAUGHT_ERROR','PERMISSION_DENIED','CONNECTION_CLOSED','STDIN',
    'UNDEFINED_FUNCTION','CLASS_NOT_FOUND','REDECLARE','UNDEFINED_CONSTANT',
    'TYPE_ERROR','ARGUMENT_COUNT_ERROR','MYSQL_EXTENSION_MISSING','PHP_VERSION_REQUIREMENT',
    'SSH_MESSAGE','SHELL_MESSAGE','WPCLI_WARNING','PHP_NOTICE','STDERR_UNCLASSIFIED',
    'PAYLOAD_ENTERED','PAYLOAD_NOT_OBSERVED','PAYLOAD_SHUTDOWN_FATAL',
    'PAYLOAD_SHUTDOWN_NONFATAL','PAYLOAD_SHUTDOWN_NOT_OBSERVED','BOUNDARY_INVALID','MEMORY','TIME'})
PHP_FAILURE_SCHEMA = 'ir.native.hook_inventory.failure.v1'
PHP_FAILURE_CATEGORIES = {'HOOK_SHAPE':'php_hook_shape', 'CALLBACK_SHAPE':'php_callback_shape',
    'REFLECTION_FUNCTION':'php_reflection_function', 'REFLECTION_METHOD':'php_reflection_method',
    'FILE_DIGEST':'php_file_digest', 'ENCODE':'php_encode'}
HOOK_SCOPES = frozenset({'ACCOUNT_STANDARD', 'ACCOUNT_META', 'OTHER'})
# Public owner selector ceiling only; never used to prune the full inventory.
STANDARD_HOOKS = frozenset('''sanitize_user validate_username username_exists email_exists illegal_user_logins
pre_user_login pre_user_nicename pre_user_email pre_user_url pre_user_display_name
pre_user_nickname pre_user_first_name pre_user_last_name pre_user_description pre_user_pass
pre_user_registered wp_pre_insert_user_data insert_user_meta insert_custom_user_meta
user_register profile_update clean_user_cache set_user_role add_user_role remove_user_role user_contactmethods
get_user_metadata get_user_metadata_by_mid add_user_metadata add_user_meta added_user_meta
update_user_metadata update_user_metadata_by_mid update_user_meta updated_user_meta
delete_user_metadata delete_user_metadata_by_mid delete_user_meta deleted_user_meta
default_option_default_role option_default_role default_option_users_can_register option_users_can_register
authenticate wp_authenticate wp_authenticate_user wp_login wp_login_failed wp_logout
login_redirect logout_redirect clear_auth_cookie set_auth_cookie set_logged_in_cookie
send_auth_cookies secure_auth_cookie secure_logged_in_cookie auth_cookie auth_cookie_valid
auth_cookie_bad_username auth_cookie_bad_hash auth_cookie_bad_session_token auth_cookie_malformed
auth_cookie_expired check_password password_hash wp_set_password determine_current_user
user_has_cap map_meta_cap rest_authentication_errors rest_pre_dispatch rest_post_dispatch
rest_request_before_callbacks rest_request_after_callbacks rest_pre_serve_request
pre_wp_mail wp_mail wp_mail_from wp_mail_from_name wp_mail_content_type wp_mail_charset
phpmailer_init wp_mail_failed wp_mail_succeeded pre_http_request http_request_args
http_api_debug http_response http_request_host_is_external pre_http_send_through_proxy
http_api_curl http_api_transports pre_user_query pre_get_users users_pre_query
sanitize_title auth_cookie_expiration session_token_manager attach_session_information random_password
nonce_life nonce_user_logged_out wp_verify_nonce_failed salt woocommerce_process_login_errors
woocommerce_login_credentials woocommerce_login_redirect login_errors woocommerce_login_failed
wp_hash_password_algorithm wp_hash_password_options
allowed_redirect_hosts logout_url password_needs_rehash rest_allowed_cors_headers
rest_dispatch_request rest_enabled rest_endpoints rest_exposed_cors_headers rest_json_encode_options
rest_jsonp_enabled rest_pre_echo_response rest_request_parameter_order rest_send_nocache_headers
rest_url rest_url_prefix sanitize_key secure_signon_cookie set_current_user
woocommerce_logout_default_redirect_url wp_redirect wp_redirect_status wp_safe_redirect_fallback x_redirect_by
sanitize_user_meta__mmed_ir_state_v1 auth_user_meta__mmed_ir_state_v1
sanitize_user_meta__mmed_ir_state_v1_for_user auth_user_meta__mmed_ir_state_v1_for_user
'''.split())
ACCOUNT_META_PREFIX = 'sanitize_user_meta_'


def inventory_progress(gate, stage):
    callback = getattr(gate, 'inventory_progress', None)
    if callback is not None:
        callback(stage)


class Stop(Exception):
    """Only fixed, non-sensitive failure categories can escape private transports."""
    def __init__(self, category='private_operation_failed', *, hookScope=None, childExit=None, stderrMarkers=None):
        if type(category) is not str or category not in STOP_CATEGORIES:
            category = 'private_operation_failed'
            hookScope = None
            childExit = None
            stderrMarkers = None
        self.category = category
        self.hookScope = hookScope if type(hookScope) is str and hookScope in HOOK_SCOPES else None
        self.childExit = None
        if (type(childExit) is dict and set(childExit)=={'exitCode','stdoutPresent','stderrPresent'} and
            type(childExit['exitCode']) is int and -255<=childExit['exitCode']<=255 and childExit['exitCode']!=0 and
            type(childExit['stdoutPresent']) is bool and type(childExit['stderrPresent']) is bool):
            self.childExit = dict(childExit)
        self.stderrMarkers = None
        if (type(stderrMarkers) is list and len(stderrMarkers)<=len(STDERR_MARKERS) and
            all(type(m) is str and m in STDERR_MARKERS for m in stderrMarkers) and
            stderrMarkers==sorted(set(stderrMarkers))):
            self.stderrMarkers = list(stderrMarkers)
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
    creation_hook_inventory_sha256: str | None
    mode: str = 'native'

    def fingerprint(self):
        return hashlib.sha256(json.dumps(dataclasses.asdict(self), sort_keys=True,
            default=lambda value: sorted(value), separators=(',', ':')).encode()).hexdigest()

    def validate(self):
        for value in (self.review_sha256, self.control_contract_sha256,
                      self.runner_sha256, self.tests_sha256):
            if not SHA.fullmatch(value):
                raise Stop('admission')
        if not self.actions or not self.actions <= ALLOWED_ACTIONS:
            raise Stop('admission')
        if self.mode == 'inventory':
            require(self.actions == frozenset({'creation_inventory_read'}) and
                    self.creation_hook_inventory_sha256 is None)
        else:
            require(self.mode == 'native' and isinstance(self.creation_hook_inventory_sha256,str) and
                    SHA.fullmatch(self.creation_hook_inventory_sha256) and
                    'creation_inventory_read' not in self.actions)
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
                 control_contract_sha256: str | None = None, *, deadline=None, progress=None):
        self.admission = admission
        self.control = control
        self.control_contract_sha256 = control_contract_sha256
        self.deadline = deadline
        self.progress = progress
        self.lock = threading.RLock(); self.local = threading.local()
        self.closed = False; self.active = {}; self.futures = []; self.threads = []
        self.drain_deadline = None

    def inventory_progress(self, stage):
        if type(stage) is not str or stage not in INVENTORY_STAGES:
            raise Stop('not_admitted')
        if self.admission is not None and self.admission.mode == 'inventory' and self.progress is not None:
            self.progress(stage)

    def close(self):
        with self.lock:
            self.closed = True
            if self.drain_deadline is None:self.drain_deadline=time.monotonic()+DRAIN_SECONDS
            for future in self.futures:future.cancel()

    def open_check(self):
        if self.closed or type(self.deadline) not in (int,float) or not math.isfinite(self.deadline) or time.monotonic()>=self.deadline:
            self.close();raise Stop('guard')

    def require(self, action):
        if self.admission is None or self.control is None:
            raise Stop('dormant')
        with self.lock:self.open_check()
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
            self.close()
            raise
        except Exception:
            self.close()
            raise Stop('guard') from None
        with self.lock:self.open_check()

    @contextlib.contextmanager
    def dispatch(self, action):
        self.require(action)
        with self.lock:
            self.open_check()
            parent=getattr(self.local,'budget',None)
            limit=min(self.deadline,time.monotonic()+IO_SECONDS,parent.deadline if parent else self.deadline)
            budget=Dispatch(limit,action=action,gate=self);key=uuid.uuid4().hex;self.active[key]=budget
            self.local.budget=budget
        try:yield budget
        except BaseException:
            self.close();raise
        finally:
            self.local.budget=parent
            with self.lock:
                if budget.child is None or budget.child.poll() is not None:self.active.pop(key,None)

    def submit(self, pool, function, *args):
        with self.lock:
            self.open_check();future=pool.submit(function,*args);self.futures.append(future);return future

    def drain(self):
        self.close()
        for thread in self.threads:
            thread.join(max(0,self.drain_deadline-time.monotonic()))
        with self.lock:
            return not self.active and all(f.done() for f in self.futures) and not any(t.is_alive() for t in self.threads)


@dataclasses.dataclass(repr=False)
class Dispatch:
    deadline: float
    child: object = None
    action: str | None = None
    gate: object = None
    started: bool = False

    def remaining(self):
        left=self.deadline-time.monotonic()
        if left<=0 and self.action=='creation_inventory_read':raise Stop('io_deadline')
        require(left>0);return left

    def begin(self):
        if self.gate is not None:
            with self.gate.lock:
                self.gate.open_check();self.remaining();self.started=True
        else:self.remaining();self.started=True


def inventory_failure(output):
    """Interpret only a closed, small private sentinel; never retain raw output."""
    def unique_object(pairs):
        value = dict(pairs)
        if len(value) != len(pairs):
            raise ValueError()
        return value
    try:
        if len(output) > 256:
            return None
        value = json.loads(output.decode('ascii'), object_pairs_hook=unique_object)
        if type(value) is not dict or set(value) not in ({'schema','step'}, {'schema','step','hookScope'}):
            return None
        if value['schema'] != PHP_FAILURE_SCHEMA or type(value['step']) is not str or value['step'] not in PHP_FAILURE_CATEGORIES:
            return None
        scope = value.get('hookScope')
        if 'hookScope' in value and (type(scope) is not str or scope not in HOOK_SCOPES):
            return None
        return Stop(PHP_FAILURE_CATEGORIES[value['step']], hookScope=scope)
    except (ValueError, UnicodeError, TypeError):
        return None


def inventory_stderr_markers(stderr):
    """Scan complete bounded stderr for public fixed markers; retain no lines."""
    if len(stderr)>65536:
        return None, set()
    markers=set();categories=set()
    for raw_line in stderr.split(b'\n'):
        line=re.sub(rb'\x1b\[[0-9;]*m',b'',raw_line.rstrip(b'\r')).lstrip(b' \t\r')
        # PHP logging can prepend a timestamp; the prefix is discarded privately.
        line=re.sub(rb'^\[[0-9]{2}-[A-Za-z]{3}-[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}(?: [A-Za-z0-9_+:/-]{1,32})?\] ',b'',line)
        line=line.lstrip(b' \t\r')
        if re.match(rb'(?:ssh: |kex_exchange_identification: |client_loop: )',line) or line==b'Host key verification failed.':markers.add('SSH_MESSAGE')
        if re.match(rb'(?:bash: (?:line [0-9]+: )?|sh: [0-9]+: |zsh: )',line) or re.fullmatch(rb'(?:wp|php): (?:command not found|not found)',line):markers.add('SHELL_MESSAGE')
        if line.startswith(b'Warning:'):markers.add('WPCLI_WARNING')
        if re.match(rb'(?:PHP )?(?:Notice|Deprecated):',line):markers.add('PHP_NOTICE')
        if re.match(rb'(?:PHP )?(?:Warning|Startup):',line):markers.add('PHP_WARNING')
        if re.match(rb'(?:PHP )?Fatal error:',line):
            markers.add('PHP_FATAL')
        if re.match(rb'(?:PHP )?Parse error:',line):
            markers.add('PHP_PARSE')
        if line.startswith(b'Error:'):markers.add('WPCLI_ERROR')
        # Fixed ASCII prefixes can identify a family despite an opaque tail;
        # unsupported controls/encoding never promote that tail to a category/kind.
        if any(byte<32 or byte>126 for byte in line):continue
        # Finite kinds only: no captured function/class names or other text escapes.
        if re.match(rb'(?:PHP )?Fatal error:',line):
            for pattern,marker in (
                (rb'\bCall to undefined function ', 'UNDEFINED_FUNCTION'),
                (rb'\bClass [ -~]+ not found\b', 'CLASS_NOT_FOUND'),
                (rb'\bCannot (?:redeclare|declare class) ', 'REDECLARE'),
                (rb'\bUndefined constant ', 'UNDEFINED_CONSTANT'),
                (rb'\bUncaught TypeError:', 'TYPE_ERROR'),
                (rb'\bUncaught ArgumentCountError:', 'ARGUMENT_COUNT_ERROR')):
                if re.search(pattern,line):markers.add(marker)
        if re.match(rb'(?:Error: )?Your PHP installation appears to be missing the MySQL extension',line):
            markers.add('MYSQL_EXTENSION_MISSING')
        if re.match(rb'(?:Error: )?(?:WP-CLI requires PHP (?:version )?|Your server is running PHP version [0-9.]+ but WordPress [0-9.]+ requires at least )',line):
            markers.add('PHP_VERSION_REQUIREMENT')
        if re.search(rb'\bUncaught ',line):markers.add('UNCAUGHT_ERROR')
        if re.search(rb'\bPermission denied\b',line,re.I):markers.add('PERMISSION_DENIED')
        if re.search(rb'\bConnection (?:closed|reset)\b|\bBroken pipe\b',line,re.I):markers.add('CONNECTION_CLOSED')
        if re.search(rb'/dev/stdin|\bstdin\b|\bstandard input\b',line,re.I):markers.add('STDIN')
        for pattern,category in CHILD_ERROR_PATTERNS:
            if re.fullmatch(pattern,line):categories.add(category)
    if stderr and not markers:markers.add('STDERR_UNCLASSIFIED')
    return sorted(markers), categories


def inventory_boundary(stderr):
    """Exact two-frame private protocol; return all nonprotocol bytes unchanged."""
    if len(stderr)>65536:
        return stderr, set(), False
    prefix=b'IR_INVENTORY_BOUNDARY'
    entry=b'IR_INVENTORY_BOUNDARY_V1 ENTERED\n'
    shutdown=b'IR_INVENTORY_BOUNDARY_V1 SHUTDOWN '
    kinds={'UNKNOWN','UNDEFINED_FUNCTION','CLASS_NOT_FOUND','REDECLARE',
        'UNDEFINED_CONSTANT','TYPE_ERROR','ARGUMENT_COUNT_ERROR','MEMORY','TIME'}
    frames=[];remaining=[];invalid=False
    lines=stderr.split(b'\n')
    for index,line in enumerate(lines):
        raw=line+(b'\n' if index<len(lines)-1 else b'')
        if prefix not in raw:
            remaining.append(raw);continue
        if raw==entry:
            frames.append(('ENTERED','UNKNOWN'))
        elif raw==shutdown+b'NONFATAL UNKNOWN\n':
            frames.append(('NONFATAL','UNKNOWN'))
        elif raw.startswith(shutdown+b'FATAL ') and raw.endswith(b'\n'):
            value=raw[len(shutdown+b'FATAL '):-1]
            # Compare exact encoded literals; never decode/capture arbitrary values.
            match=next((kind for kind in kinds if value==kind.encode('ascii')),None)
            if match is None:invalid=True
            else:frames.append(('FATAL',match))
        else:invalid=True
    if (invalid or len(frames)>2 or (frames and frames[0][0]!='ENTERED')
            or (len(frames)==2 and frames[1][0] not in {'FATAL','NONFATAL'})):
        return stderr, {'BOUNDARY_INVALID'}, False
    observations={'PAYLOAD_ENTERED' if frames else 'PAYLOAD_NOT_OBSERVED'}
    if len(frames)<2:
        observations.add('PAYLOAD_SHUTDOWN_NOT_OBSERVED')
    else:
        family,kind=frames[1]
        observations.add('PAYLOAD_SHUTDOWN_'+family)
        if kind!='UNKNOWN':observations.add(kind)
    return b''.join(remaining), observations, len(frames)==2 and frames[1][0]=='NONFATAL'


def inventory_child_failure(stdout, stderr, returncode):
    """Closed message-shape categories, with private buffers discarded on exit."""
    diagnostic = inventory_failure(stdout)
    residual,boundary,_=inventory_boundary(stderr)
    markers,stderr_categories=inventory_stderr_markers(residual)
    if markers is not None:markers=sorted(set(markers)|boundary)
    if diagnostic is None:
        category = 'child_exit'
        # Complete stderr lines tolerate preceding warnings/trace; ambiguity stays closed.
        if not stdout and len(stderr_categories)==1:
            category=next(iter(stderr_categories))
        elif stdout and not residual:
            raw = stdout
            message = raw.rstrip(b'\r\n')
            if len(raw)<=4096:
                for pattern, fixed_category in CHILD_ERROR_PATTERNS:
                    if re.fullmatch(pattern,message):
                        category=fixed_category;break
        diagnostic = Stop(category)
    return Stop(diagnostic.category,hookScope=diagnostic.hookScope,childExit={
        'exitCode':returncode,'stdoutPresent':bool(stdout),'stderrPresent':bool(stderr)},stderrMarkers=markers)


def private_capture(argv, data, budget, *, cap=65536, on_line=None, header_cap=None):
    """Finite nonblocking stdin/capture/reap; unresolved child remains owned."""
    child=None
    try:
        budget.begin()
        child=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                               env=PRIVATE_ENV)
        budget.child=child
        streams={child.stdout:bytearray(),child.stderr:bytearray()};readers=list(streams)
        for stream in (*readers,child.stdin):os.set_blocking(stream.fileno(),False)
        pending=memoryview(data);notified=False
        while readers or pending:
            left=budget.remaining()
            readable,writable,_=select.select(readers,[child.stdin] if pending else [],[],min(left,.1))
            if writable:
                count=os.write(child.stdin.fileno(),pending[:8192]);pending=pending[count:]
                if not pending:child.stdin.close()
            for stream in readable:
                block=os.read(stream.fileno(),8192)
                if not block:readers.remove(stream);continue
                streams[stream].extend(block)
                require(len(streams[stream])<=(cap if stream is child.stdout else 65536))
                if header_cap is not None and stream is child.stdout:
                    head=bytes(streams[stream]);offset=0
                    while True:
                        end=head.find(b'\r\n\r\n',offset)
                        if end<0:require(len(head)-offset<=header_cap);break
                        require(end+4<=header_cap)
                        if head[offset:offset+12].startswith(b'HTTP/') and re.match(rb'HTTP/[^ ]+ 1\d\d ',head[offset:]):
                            offset=end+4;continue
                        require(len(head)-(end+4)<=BODY_CAP);break
                if on_line and stream is child.stdout and not notified and b'\n' in streams[stream]:
                    require(bytes(streams[stream]).split(b'\n',1)[0]==b'{"held":true}')
                    notified=True;on_line()
        child.wait(timeout=budget.remaining())
        if budget.action=='creation_inventory_read':
            if child.returncode!=0:
                raise inventory_child_failure(bytes(streams[child.stdout]),bytes(streams[child.stderr]),child.returncode)
            residual,boundary,normal=inventory_boundary(bytes(streams[child.stderr]))
            markers,_=inventory_stderr_markers(residual)
            observations=sorted(set(markers or [])|boundary)
            if 'BOUNDARY_INVALID' in boundary:raise Stop('native_assertion',stderrMarkers=observations)
            if residual:raise Stop('stderr_present',stderrMarkers=observations)
            if not normal:raise Stop('native_assertion',stderrMarkers=observations)
            streams[child.stderr]=bytearray(residual)
        require(child.returncode==0 and not streams[child.stderr] and (not on_line or notified))
        return bytes(streams[child.stdout])
    except Stop:raise
    except subprocess.TimeoutExpired:
        raise Stop('io_deadline' if budget.action=='creation_inventory_read' else 'private_operation_failed') from None
    except Exception:raise Stop() from None
    finally:
        if child:
            if child.poll() is None:
                try:child.kill();child.wait(timeout=REAP_SECONDS)
                except Exception:raise Stop('containment') from None
            for stream in (child.stdin,child.stdout,child.stderr):
                if stream:stream.close()


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


def private_pipe(code: str, *, on_line=None, timeout=12, max_bytes=65536, budget=None):
    """Fixed argv; private stdin/stdout/stderr, bounded memory, no temp files.

    Never print a child exception/output. No process environment is constructed,
    exported or used to carry a QA credential. PHP receives only SSH stdin.
    """
    try:
        require(0<timeout<=IO_SECONDS and max_bytes in {65536,INVENTORY_CAP})
        budget=budget or Dispatch(time.monotonic()+timeout)
        require(max_bytes==65536 or budget.action=='creation_inventory_read')
        captured=private_capture(SSH_ARGV,code.encode(),budget,cap=max_bytes,on_line=on_line)
        if budget.action=='creation_inventory_read':inventory_progress(budget.gate,'INVENTORY_JSON')
        result=captured.decode()
        if on_line:
            result = result.split('\n', 1)[1]
        try:return json.loads(result)
        except json.JSONDecodeError:
            raise Stop('json_decode' if budget.action=='creation_inventory_read' else 'private_operation_failed') from None
    except Stop:
        raise
    except Exception:
        raise Stop() from None


def owner_pipe(gate, action, pipe, code, **kwargs):
    if action=='creation_inventory_read':inventory_progress(gate,'INVENTORY_DISPATCH_CHECK')
    with gate.dispatch(action) as budget:
        if action=='creation_inventory_read':inventory_progress(gate,'INVENTORY_CAPTURE')
        return pipe(code,timeout=budget.remaining(),budget=budget,**kwargs)


def php_preamble():
    # Process-local mail suppression: does not change a WP option or shared hook.
    return "<?php\nini_set('display_errors','0'); error_reporting(0);\n" + """
function mmed_ir_qa_no_mail(){return false;}
function mmed_ir_qa_no_http(){return new WP_Error('ir_qa_outbound_blocked','Blocked.');}
add_filter('pre_wp_mail','mmed_ir_qa_no_mail',PHP_INT_MAX);
add_filter('pre_http_request','mmed_ir_qa_no_http',PHP_INT_MAX);
function ir_fail(){throw new RuntimeException('ir_private_failure');}
function ir_inventory(){
 global $wp_filter,$ir_inventory_step,$ir_inventory_hook_scope;$rows=[];
 $ir_inventory_step='HOOK_SHAPE';$ir_inventory_hook_scope='OTHER';
 $ir_standard_hooks=__IR_STANDARD_HOOKS__;
 foreach($wp_filter as $tag=>$hook){
  $ir_inventory_step='HOOK_SHAPE';
  $ir_inventory_hook_scope=is_string($tag)?(in_array($tag,$ir_standard_hooks,true)?'ACCOUNT_STANDARD':
   (strpos($tag,__IR_ACCOUNT_META_PREFIX__)===0?'ACCOUNT_META':'OTHER')):'OTHER';
  if(!is_object($hook)||!isset($hook->callbacks)){ir_fail();}
  $ir_inventory_step='CALLBACK_SHAPE';
  foreach($hook->callbacks as $priority=>$callbacks){foreach($callbacks as $entry){
   $ir_inventory_step='CALLBACK_SHAPE';
   $f=$entry['function'];
   if(is_string($f)&&in_array($f,['mmed_ir_qa_no_mail','mmed_ir_qa_no_http'],true)){continue;}
   if(is_array($f)&&count($f)===2){$ir_inventory_step='REFLECTION_METHOD';$class=is_object($f[0])?get_class($f[0]):$f[0];$id=$class.'::'.$f[1];$r=new ReflectionMethod($f[0],$f[1]);}
   elseif($f instanceof Closure){$ir_inventory_step='REFLECTION_FUNCTION';$r=new ReflectionFunction($f);$id='closure:'.$r->getFileName().':'.$r->getStartLine();}
   elseif(is_string($f)&&strpos($f,'::')!==false){$ir_inventory_step='REFLECTION_METHOD';$r=new ReflectionMethod($f);$id=$f;}
   elseif(is_string($f)){$ir_inventory_step='REFLECTION_FUNCTION';$id=$f;$r=new ReflectionFunction($f);}
   elseif(is_object($f)&&is_callable($f)){$ir_inventory_step='REFLECTION_METHOD';$id=get_class($f).'::__invoke';$r=new ReflectionMethod($f,'__invoke');}
   else{ir_fail();}
   $ir_inventory_step='FILE_DIGEST';
   $file=$r->getFileName();$digest=$file&&is_file($file)?hash_file('sha256',$file):'internal_or_eval';
   $rows[]=[$tag,(int)$priority,$id,(int)$entry['accepted_args'],$digest];
  }}
 }
 $ir_inventory_step='ENCODE';$ir_inventory_hook_scope='OTHER';
 usort($rows,function($a,$b){return strcmp(wp_json_encode($a),wp_json_encode($b));});
 return ['schema'=>'ir.native.hook_inventory.v1','sha256'=>hash('sha256',wp_json_encode($rows)),
         'count'=>count($rows),'callbacks'=>$rows];
}
function ir_owner($name,$uid){
 $u=get_user_by('login',$name);
 if(!$u || (int)$u->ID!==$uid || $u->user_email!==$name.'@fictional.example' ||
    $u->roles!==['subscriber']){ir_fail();}
 return $u;
}
""".replace('__IR_STANDARD_HOOKS__', json.dumps(sorted(STANDARD_HOOKS),separators=(',',':'))).replace(
    '__IR_ACCOUNT_META_PREFIX__', json.dumps(ACCOUNT_META_PREFIX))


def inventory_boundary_preamble():
    """Inventory-only fixed entry/shutdown observations before suppression."""
    boundary = r"""fwrite(STDERR,"IR_INVENTORY_BOUNDARY_V1 ENTERED\n");
register_shutdown_function(function(){
 $ir_last=error_get_last();$ir_type=is_array($ir_last)&&isset($ir_last['type'])?$ir_last['type']:0;
 $ir_fatal=in_array($ir_type,[E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR,E_USER_ERROR,E_RECOVERABLE_ERROR],true);
 $ir_kind='UNKNOWN';
 if($ir_fatal&&isset($ir_last['message'])&&is_string($ir_last['message'])&&strlen($ir_last['message'])<=65536){
  $ir_line=explode("\n",$ir_last['message'],2)[0];
  if(preg_match('/^[\x20-\x7e]*$/D',$ir_line)){
   $ir_kinds=[];
   foreach([
    'UNDEFINED_FUNCTION'=>'/\bCall to undefined function /',
    'CLASS_NOT_FOUND'=>'/\bClass [ -~]+ not found\b/',
    'REDECLARE'=>'/\bCannot (?:redeclare|declare class) /',
    'UNDEFINED_CONSTANT'=>'/\bUndefined constant /',
    'TYPE_ERROR'=>'/\bUncaught TypeError:/',
    'ARGUMENT_COUNT_ERROR'=>'/\bUncaught ArgumentCountError:/',
    'MEMORY'=>'/^Allowed memory size of [0-9]+ bytes exhausted \(tried to allocate [0-9]+ bytes\)$/D',
    'TIME'=>'/^Maximum execution time of [0-9]+ seconds exceeded$/D'
   ] as $ir_name=>$ir_pattern){if(preg_match($ir_pattern,$ir_line)){$ir_kinds[]=$ir_name;}}
   if(count($ir_kinds)===1){$ir_kind=$ir_kinds[0];}
   unset($ir_kinds,$ir_name,$ir_pattern);
  }
  unset($ir_line);
 }
 unset($ir_last,$ir_type);
 @fwrite(STDERR,"IR_INVENTORY_BOUNDARY_V1 SHUTDOWN ".($ir_fatal?'FATAL '.$ir_kind:'NONFATAL UNKNOWN')."\n");
});
"""
    return "<?php\n" + boundary + php_preamble().removeprefix("<?php\n")


def collision_read(gate, pipe=private_pipe):
    gate.require('collision_read')
    code = php_preamble() + '$names=' + json.dumps(list(NAMES)) + ';\n' + """
foreach($names as $n){if(username_exists($n)||email_exists($n.'@fictional.example')){echo '{"collision":true}';return;}}
echo '{"collision":false}';
"""
    response = owner_pipe(gate,'collision_read',pipe,code)
    if response != {'collision': False}:
        raise Stop('collision')


def creation_inventory_read(gate, pipe=private_pipe):
    """Private prospective inventory for independent callback qualification.

    Suppression covers wp_mail/WordPress HTTP API only. Approval must qualify
    callback effects including direct transports, provisioning and enrollment;
    unknown callbacks are never admitted by this fixture or by a digest alone.
    """
    inventory_progress(gate,'INVENTORY_GATE_CHECK')
    gate.require('creation_inventory_read')
    require(gate.admission.mode=='inventory')
    result = owner_pipe(gate,'creation_inventory_read',pipe,inventory_boundary_preamble() + """
global $ir_inventory_step,$ir_inventory_hook_scope;
$ir_inventory_step='ENCODE';$ir_inventory_hook_scope='OTHER';
try{echo wp_json_encode(ir_inventory());}
catch(Throwable $ir_inventory_error){
 echo '{"schema":"ir.native.hook_inventory.failure.v1","step":"'.$ir_inventory_step.'","hookScope":"'.$ir_inventory_hook_scope.'"}';
 exit(1);
}
""",max_bytes=INVENTORY_CAP)
    inventory_progress(gate,'INVENTORY_SCHEMA')
    require(type(result) is dict and set(result) == {'schema','sha256','count','callbacks'} and
            result['schema']=='ir.native.hook_inventory.v1' and
            type(result['sha256']) is str and SHA.fullmatch(result['sha256']) and
            type(result['callbacks']) is list and type(result['count']) is int and
            0<=result['count']<=10000 and result['count']==len(result['callbacks']))
    inventory_progress(gate,'INVENTORY_ROWS')
    for row in result['callbacks']:
        require(type(row) is list and len(row)==5 and type(row[0]) is str and 0<len(row[0])<=256 and
                type(row[1]) is int and -(2**31)<=row[1]<2**31 and
                type(row[2]) is str and 0<len(row[2])<=2048 and type(row[3]) is int and 0<=row[3]<=1000 and
                type(row[4]) is str and (SHA.fullmatch(row[4]) or row[4]=='internal_or_eval') and
                not any(ord(c)<32 for c in row[0]+row[2]))
    inventory_progress(gate,'INVENTORY_DIGEST')
    encoded=json.dumps(result['callbacks'],ensure_ascii=True,separators=(',',':')).replace('/','\\/').encode()
    require(hashlib.sha256(encoded).hexdigest()==result['sha256'])
    inventory_progress(gate,'INVENTORY_COMPLETE')
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
    require(gate.admission.mode=='native')
    response = owner_pipe(gate,'create_a' if identity.username==NAMES[0] else 'create_b',pipe,code)
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
        require(set(headers or {})<={'Content-Type','Origin','X-WP-Nonce','X-IR-Subject','Sec-Fetch-Site'})
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
        request_headers = {'User-Agent': 'MissionMed-IR-bounded-native-QA',
                           'Referer': ORIGIN + APP, 'Sec-Fetch-Site': 'same-origin'}
        request_headers.update(headers or {})
        try:
            request = urllib.request.Request(url, data=body, method=method, headers=request_headers)
            self.jar.add_cookie_header(request)
            with self.gate.dispatch(action) as budget:
                reply=curl_reply(request,budget)
                response=type('PrivateCookieResponse',(),{'info':lambda _:reply.headers})()
                self.jar.extract_cookies(response,request)
                return reply
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


def curl_quote(value):
    require(type(value) is str and '\x00' not in value)
    return '"'+value.replace('\\','\\\\').replace('"','\\"').replace('\r','\\r').replace('\n','\\n').replace('\t','\\t')+'"'


def curl_reply(request, budget, capture=private_capture):
    """No redirect/retry/file jar. Private URL, headers and body use stdin."""
    parts=urllib.parse.urlsplit(request.full_url)
    require(parts.scheme=='https' and parts.netloc==urllib.parse.urlsplit(ORIGIN).netloc and
            not parts.username and not parts.password and request.get_method() in {'GET','POST'})
    config=['silent','show-error','include','no-netrc','proxy = ""','noproxy = "*"',
            'proto = "=https"','proto-redir = "=https"','max-redirs = 0',
            'connect-timeout = '+curl_quote(str(min(8,budget.remaining()))),
            'max-time = '+curl_quote(str(budget.remaining())),
            'url = '+curl_quote(request.full_url),'request = '+curl_quote(request.get_method())]
    for name,value in request.header_items():
        require(not any(c in name+value for c in '\r\n\x00'))
        config.append('header = '+curl_quote(name+': '+value))
    if request.data is not None:
        require(len(request.data)<=BODY_CAP)
        config.append('data-raw = '+curl_quote(request.data.decode('utf-8')))
    data=capture(CURL_ARGV,('\n'.join(config)+'\n').encode(),budget,
                 cap=BODY_CAP+HEADER_CAP,header_cap=HEADER_CAP)
    offset=0
    while True:
        end=data.find(b'\r\n\r\n',offset)
        require(0<=end<HEADER_CAP)
        head=data[offset:end];line,_,fields=head.partition(b'\r\n')
        match=re.fullmatch(rb'HTTP/(?:1\.[01]|2|3) (\d{3})(?: [^\r\n]*)?',line)
        require(match is not None);status=int(match[1]);offset=end+4
        if 100<=status<200:continue
        headers=email.parser.BytesParser().parsebytes(fields+b'\r\n\r\n')
        require(200<=status<=599 and len(data)-offset<=BODY_CAP)
        return Reply(status,headers,data[offset:],request.full_url)


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
    result = owner_pipe(gate,'metadata_read',pipe,code)
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
    require(owner_pipe(gate,'lock_lifecycle',pipe,code,on_line=compete) == {'released': True})
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
    require(owner_pipe(gate,'native_connection_loss',pipe,code) == {'isolated_seam': True})


def race(gate, sessions, revision):
    commands = [command(revision, marker) for marker in ('online:0:1', 'online:0:2')]
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=2);results=[]
    try:
        futures=[gate.submit(pool,session.state,cmd) for session,cmd in zip(sessions,commands)]
        results=[future.result(timeout=max(.001,gate.deadline-time.monotonic())) for future in futures]
    except BaseException:
        gate.close();raise Stop() from None
    finally:
        pool.shutdown(wait=False,cancel_futures=True)
        gate.threads.extend(pool._threads)
        # Normal completed races retain admission for subsequent fixed work.
        limit=gate.drain_deadline if gate.closed else time.monotonic()+DRAIN_SECONDS
        for thread in pool._threads:thread.join(max(0,limit-time.monotonic()))
        if any(thread.is_alive() for thread in pool._threads):
            gate.close();raise Stop('containment')
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
    require(gate.admission.mode=='native')
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
