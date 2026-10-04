"""Local, dormant credential transport. Importing this module performs no lookup.

Execution requires independent review of these exact bytes. Never log a request,
response, credential, worker output or caught exception. No retries or key fallback.
"""
import base64
import copy
from contextlib import contextmanager
import hmac
import json
import math
import os
import re
import selectors
import stat
import subprocess
import sys
import time
import urllib.request

PROJECT = 'brxqytrfdisrgakrxkhd'
BASE_URL = 'https://' + PROJECT + '.supabase.co'
REVEAL_URL = 'https://api.supabase.com/v1/projects/' + PROJECT + '/api-keys?reveal=true'
HEALTH_URL = BASE_URL + '/rest/v1/'
TOKEN_FILE = '/Users/brianb/.supabase/access-token'
MAX_BYTES = 256 * 1024
TOTAL_SECONDS = 60.0
TOKEN_RE = re.compile(r'sbp_(?:oauth_)?[a-f0-9]{40}\Z', re.ASCII)
# Nonempty suffix plus local shape guards cannot prove a complete key or REST authentication.
SECRET_RE = re.compile(r'sb_secret_[A-Za-z0-9_-]{1,128}\Z', re.ASCII)
RPC_URLS = frozenset(BASE_URL + '/rest/v1/rpc/' + name for name in (
    'mmos_acquire_lease', 'mmos_acquire_product_lease',
    'mmos_acquire_registry_lease', 'mmos_acquire_scoped_lease_v2',
    'mmos_heartbeat_lease', 'mmos_release_lease'))


class TransportError(RuntimeError):
    """Only constant value-free error messages are admitted."""


class DeadlineExceeded(TransportError):
    """Constant deadline classification; no deadline or clock value is exposed."""


PHASES = frozenset(('management_token_lookup', 'keychain_supabase',
                   'keychain_access_token', 'exact_existing_file',
                   'management_reveal', 'authentication_probe'))


# Compare only admitted constant messages; never format an exception.
_ERROR_KINDS = {
    'existing keychain custody requires owner action': 'custody_requires_owner_action',
    'existing credential file requires owner action': 'custody_requires_owner_action',
    'existing management credential custody requires owner action': 'custody_requires_owner_action',
    'existing management credential custody unavailable': 'custody_unavailable',
    'existing keychain custody unavailable': 'custody_unavailable',
    'existing credential file unavailable': 'custody_unavailable',
    'existing management credential format unavailable': 'management_format_unavailable',
    'existing coordination credential format unavailable': 'coordination_format_unavailable',
    'existing coordination credential unavailable': 'coordination_unavailable',
    'existing management identity or permission denied': 'management_denied',
    'existing coordination authentication denied': 'coordination_denied',
    'transport size bound exceeded': 'size_bound_exceeded',
}


class PhaseError(TransportError):
    """Only constant phase/kind and monotonic elapsed seconds are public."""
    def __init__(self, phase, started, *, kind='failed_closed'):
        self.phase = phase if phase in PHASES else 'unknown'
        self.kind = kind if kind in {*_ERROR_KINDS.values(), 'deadline_exceeded'} else 'failed_closed'
        elapsed = time.monotonic() - started
        self.elapsed_seconds = elapsed if math.isfinite(elapsed) and elapsed >= 0 else 0.0
        super().__init__('transport deadline exceeded' if self.kind == 'deadline_exceeded'
                         else 'transport phase failed closed')

    def public_status(self):
        return (f'phase={self.phase}; error={self.kind}; '
                f'elapsed_seconds={self.elapsed_seconds:.3f}')


@contextmanager
def _phase(name):
    # Call sites supply literals only. Inner phases retain their own timing.
    started = time.monotonic()
    try:
        yield
    except (AbsentCredential, PhaseError):
        raise
    except Exception as error:
        kind = 'failed_closed'
        if isinstance(error, DeadlineExceeded):
            kind = 'deadline_exceeded'
        elif isinstance(error, TransportError) and len(error.args) == 1 and type(error.args[0]) is str:
            kind = _ERROR_KINDS.get(error.args[0], kind)
        elif name in ('keychain_supabase', 'keychain_access_token', 'exact_existing_file'):
            kind = 'custody_requires_owner_action'
        raise PhaseError(name, started, kind=kind) from None


class AbsentCredential(Exception):
    """Confirmed missing custody slot only; never denial or locked custody."""


def _remaining(deadline, ceiling=TOTAL_SECONDS):
    remaining = deadline - time.monotonic()
    if not math.isfinite(remaining) or remaining <= 0:
        raise DeadlineExceeded('transport deadline exceeded')
    return min(remaining, ceiling)


def _token(value):
    if not isinstance(value, str) or TOKEN_RE.fullmatch(value) is None:
        raise TransportError('existing management credential format unavailable')
    return value


# Go strings.TrimSpace uses Unicode White_Space, excluding Python's U+001C–001F.
_GO_WHITESPACE = '\u0009\u000a\u000b\u000c\u000d\u0020\u0085\u00a0\u1680' + \
                 '\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a' + \
                 '\u2028\u2029\u202f\u205f\u3000'
_STD_BASE64_RE = re.compile(r'(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?\Z', re.ASCII)
_HEX_RE = re.compile(r'(?:[0-9a-fA-F]{2})*\Z', re.ASCII)


def _decode_keychain_value(value):
    """One go-keyring v0.2.6 Get decode; token validation remains the caller's."""
    try:
        value = value.strip(_GO_WHITESPACE)
        if value.startswith('go-keyring-encoded:'):
            payload = value[len('go-keyring-encoded:'):]
            if _HEX_RE.fullmatch(payload) is None:
                raise ValueError()
            return bytes.fromhex(payload).decode('utf-8')
        if value.startswith('go-keyring-base64:'):
            payload = value[len('go-keyring-base64:'):].replace('\r', '').replace('\n', '')
            if _STD_BASE64_RE.fullmatch(payload) is None:
                raise ValueError()
            # StdEncoding is non-Strict: do not require zero unused padding bits.
            return base64.b64decode(payload, validate=True).decode('utf-8')
        return value
    except Exception:
        raise TransportError('existing management credential format unavailable') from None


def _secret(value):
    if not isinstance(value, str) or SECRET_RE.fullmatch(value) is None:
        raise TransportError('existing coordination credential format unavailable')
    suffix = value[len('sb_secret_'):]
    if len(set(suffix)) < 4 or any(word in suffix.lower() for word in (
            'redacted', 'masked', 'placeholder', 'unrevealed')):
        raise TransportError('existing coordination credential format unavailable')
    return value


# Security.framework does the exact generic-password lookup with authentication
# UI prohibited. Worker exit 3 means ONLY errSecItemNotFound; all others stop.
# No credential values are passed in argv or inherited environment.
_KEYCHAIN_WORKER = r'''
import ctypes as c, sys
try:
    cf = c.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
    sec = c.CDLL('/System/Library/Frameworks/Security.framework/Security')
    ptr = c.c_void_p
    cf.CFDictionaryCreateMutable.argtypes = [ptr, c.c_long, ptr, ptr]
    cf.CFDictionaryCreateMutable.restype = ptr
    cf.CFDictionarySetValue.argtypes = [ptr, ptr, ptr]
    cf.CFStringCreateWithCString.argtypes = [ptr, c.c_char_p, c.c_uint32]
    cf.CFStringCreateWithCString.restype = ptr
    cf.CFDataGetLength.argtypes = [ptr]; cf.CFDataGetLength.restype = c.c_long
    cf.CFDataGetBytePtr.argtypes = [ptr]; cf.CFDataGetBytePtr.restype = ptr
    cf.CFRelease.argtypes = [ptr]
    sec.SecItemCopyMatching.argtypes = [ptr, c.POINTER(ptr)]
    sec.SecItemCopyMatching.restype = c.c_int32
    symbol = lambda library, name: ptr.in_dll(library, name)
    query = cf.CFDictionaryCreateMutable(None, 0, None, None)
    strings = []
    def set_value(key, value):
        cf.CFDictionarySetValue(query, symbol(sec, key), value)
    set_value('kSecClass', symbol(sec, 'kSecClassGenericPassword'))
    for key, text in [('kSecAttrService', 'Supabase CLI'), ('kSecAttrAccount', sys.argv[1])]:
        value = cf.CFStringCreateWithCString(None, text.encode(), 0x08000100)
        strings.append(value); set_value(key, value)
    set_value('kSecReturnData', symbol(cf, 'kCFBooleanTrue'))
    set_value('kSecMatchLimit', symbol(sec, 'kSecMatchLimitOne'))
    set_value('kSecUseAuthenticationUI', symbol(sec, 'kSecUseAuthenticationUIFail'))
    result = ptr()
    code = sec.SecItemCopyMatching(query, c.byref(result))
    if code == -25300: sys.exit(3)
    if code != 0: sys.exit(4)
    length = cf.CFDataGetLength(result)
    if length <= 0 or length > 262144: sys.exit(5)
    sys.stdout.buffer.write(c.string_at(cf.CFDataGetBytePtr(result), length))
    cf.CFRelease(result); cf.CFRelease(query)
    for value in strings: cf.CFRelease(value)
except Exception:
    sys.exit(6)
'''


# A separate private GET worker permits hard parent-enforced wall-clock limits,
# including DNS and trickle reads. Fixed destinations, verified TLS, no redirect
# handler, no proxy, no retries, and no raw exception or HTTP error output.
_GET_WORKER = r'''
import http.client, ssl, sys
try:
    mode = sys.argv[1]
    credential = sys.stdin.buffer.read(262145).decode('ascii')
    if mode == 'reveal':
        host = 'api.supabase.com'
        path = '/v1/projects/brxqytrfdisrgakrxkhd/api-keys?reveal=true'
        headers = {'Authorization': 'Bearer ' + credential, 'Accept': 'application/json'}
    elif mode == 'health':
        host = 'brxqytrfdisrgakrxkhd.supabase.co'
        path = '/rest/v1/'
        headers = {'apikey': credential, 'Accept': 'application/json'}
    else: sys.exit(5)
    connection = http.client.HTTPSConnection(host, timeout=10, context=ssl.create_default_context())
    connection.request('GET', path, headers=headers)
    response = connection.getresponse()
    # Authentication needs status only; do not read the private REST root schema.
    if mode == 'health' or response.status != 200:
        sys.stdout.buffer.write(str(response.status).encode() + b'\n')
    else:
        body = response.read(262145)
        if len(body) > 262144: sys.exit(5)
        sys.stdout.buffer.write(b'200\n' + body)
    connection.close()
except Exception:
    sys.exit(6)
'''


def _private_worker(source, arguments, deadline, *, input_bytes=None, limit=MAX_BYTES):
    """All worker output stays in private pipes; stderr counts toward the cap."""
    process = None
    output = bytearray()
    total = 0
    try:
        process = subprocess.Popen([sys.executable, '-I', '-S', '-c', source, *arguments],
            stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd='/tmp',
            env={'PATH': '/usr/bin:/bin'}, close_fds=True)
        # Validated inputs are under 150 bytes, comfortably below pipe capacity.
        if input_bytes is not None:
            process.stdin.write(input_bytes)
            process.stdin.close()
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ, True)
            selector.register(process.stderr, selectors.EVENT_READ, False)
            while selector.get_map():
                for key, _ in selector.select(_remaining(deadline, 0.25)):
                    chunk = os.read(key.fileobj.fileno(), 8192)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    total += len(chunk)
                    if total > limit:
                        raise TransportError('transport size bound exceeded')
                    if key.data:
                        output.extend(chunk)
        code = process.wait(timeout=_remaining(deadline))
        return code, bytes(output)
    except TransportError:
        raise
    except Exception:
        raise TransportError('private transport failed closed') from None
    finally:
        output.clear()
        if process is not None:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=1)
            for stream in (process.stdin, process.stdout, process.stderr):
                if stream is not None:
                    stream.close()


def _read_keychain(account, deadline):
    if account not in ('supabase', 'access-token') or sys.platform != 'darwin':
        raise TransportError('existing keychain custody unavailable')
    code, raw = _private_worker(_KEYCHAIN_WORKER, [account],
                                min(deadline, time.monotonic() + 10))
    if code == 3:
        raise AbsentCredential()
    if code != 0:
        raise TransportError('existing keychain custody requires owner action')
    try:
        return _decode_keychain_value(raw.decode('utf-8'))
    except Exception:
        raise TransportError('existing management credential format unavailable') from None


def _read_token_file(deadline):
    descriptor = None
    try:
        descriptor = os.open(TOKEN_FILE, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
            raise TransportError('existing credential file unavailable')
        _remaining(deadline)
        raw = os.read(descriptor, MAX_BYTES + 1)
        _remaining(deadline)
        if len(raw) > MAX_BYTES:
            raise TransportError('transport size bound exceeded')
        return raw.decode('utf-8')
    except FileNotFoundError:
        raise AbsentCredential() from None
    except TransportError:
        raise
    except Exception:
        raise TransportError('existing credential file requires owner action') from None
    finally:
        if descriptor is not None:
            os.close(descriptor)


def load_existing_management_token(*, deadline=None, environment=None,
                                   keychain_reader=None, file_reader=None):
    """Only confirmed absence advances; invalid selected values fail closed."""
    deadline = time.monotonic() + TOTAL_SECONDS if deadline is None else deadline
    environment = os.environ if environment is None else environment
    keychain_reader = _read_keychain if keychain_reader is None else keychain_reader
    file_reader = _read_token_file if file_reader is None else file_reader
    try:
        _remaining(deadline)
        value = environment.get('SUPABASE_ACCESS_TOKEN', '')
        if value:
            return _token(value)
        for account in ('supabase', 'access-token'):
            _remaining(deadline)
            try:
                with _phase('keychain_supabase' if account == 'supabase'
                            else 'keychain_access_token'):
                    value = keychain_reader(account, deadline)
                    _remaining(deadline)
                    value = _token(value)
            except AbsentCredential:
                continue
            return value
        with _phase('exact_existing_file'):
            value = file_reader(deadline)
            _remaining(deadline)
            return _token(value)
    except TransportError:
        raise
    except AbsentCredential:
        raise TransportError('existing management credential custody unavailable') from None
    except Exception:
        raise TransportError('existing management credential custody requires owner action') from None


def _private_get(mode, credential, deadline):
    code, raw = _private_worker(_GET_WORKER, [mode], deadline,
                               input_bytes=credential.encode('ascii'), limit=MAX_BYTES + 4)
    if code != 0:
        raise TransportError('private HTTPS transport failed closed')
    status, separator, body = raw.partition(b'\n')
    if not separator or len(status) != 3 or not status.isdigit() or len(body) > MAX_BYTES:
        raise TransportError('private HTTPS response unavailable')
    _remaining(deadline)
    return int(status), body


def _select_existing_key(raw):
    if len(raw) > MAX_BYTES:
        raise TransportError('transport size bound exceeded')
    try:
        rows = json.loads(raw)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise TransportError('existing coordination credential response unavailable')
        matching = [row for row in rows if row.get('name') == 'missionmed_lease_runtime_v5'
                    and row.get('type') == 'secret']
        if len(matching) != 1:
            raise TransportError('existing coordination credential unavailable')
        return _secret(matching[0].get('api_key'))
    except TransportError:
        raise
    except Exception:
        raise TransportError('existing coordination credential response unavailable') from None


def retrieve_existing_key(*, token_loader=None, get=None):
    """Dormant until exact independent approval; no real lookup at import."""
    deadline = time.monotonic() + TOTAL_SECONDS
    token_loader = load_existing_management_token if token_loader is None else token_loader
    get = _private_get if get is None else get
    try:
        with _phase('management_token_lookup'):
            token = _token(token_loader(deadline=deadline))
        with _phase('management_reveal'):
            status, raw = get('reveal', token, deadline)
            _remaining(deadline)
            if status in (401, 403):
                raise TransportError('existing management identity or permission denied')
            if status != 200:
                raise TransportError('existing key reveal failed closed')
            return _select_existing_key(raw)
    except TransportError:
        raise
    except Exception:
        raise TransportError('existing key reveal failed closed') from None


def authentication_probe(api_key, *, get=None):
    """One separately admitted GET to REST root. Returns only HTTP status."""
    deadline = time.monotonic() + TOTAL_SECONDS
    get = _private_get if get is None else get
    try:
        with _phase('authentication_probe'):
            key = _secret(api_key)
            status, body = get('health', key, deadline)
            _remaining(deadline)
            if len(body) > MAX_BYTES:
                raise TransportError('transport size bound exceeded')
            if status != 200:
                raise TransportError('existing coordination authentication denied')
            return status
    except TransportError:
        raise
    except Exception:
        raise TransportError('authentication probe failed closed') from None


class ApikeyOnlyLeaseOpener:
    """Six canonical RPCs only; actual HTTPS opener is the canonical callable."""
    def __init__(self, api_key, canonical_opener):
        self._key = _secret(api_key)
        self._canonical = canonical_opener

    def __call__(self, request, timeout):
        try:
            if (not isinstance(request, urllib.request.Request)
                    or request.full_url not in RPC_URLS or request.get_method() != 'POST'
                    or request.type != 'https' or request.host != PROJECT + '.supabase.co'
                    or request.selector != request.full_url[len(BASE_URL):]
                    or not isinstance(timeout, (int, float)) or isinstance(timeout, bool)
                    or not math.isfinite(timeout) or not 0 < timeout <= 3.0):
                raise TransportError('lease transport boundary denied')
            entries = list(request.headers.items()) + list(request.unredirected_hdrs.items())
            keys = [value for name, value in entries if name.lower() == 'apikey']
            auth = [value for name, value in entries if name.lower() == 'authorization']
            if (len(keys) != 1 or len(auth) != 1
                    or any(name.lower() in ('proxy-authorization', 'host') for name, _ in entries)
                    or not isinstance(keys[0], str) or not isinstance(auth[0], str)
                    or not hmac.compare_digest(keys[0], self._key)
                    or not hmac.compare_digest(auth[0], 'Bearer ' + self._key)):
                raise TransportError('lease credential header identity denied')
            adapted = copy.copy(request)
            adapted.headers = request.headers.copy()
            adapted.unredirected_hdrs = request.unredirected_hdrs.copy()
            for headers in (adapted.headers, adapted.unredirected_hdrs):
                for name in list(headers):
                    if name.lower() == 'authorization':
                        del headers[name]
            return self._canonical(adapted, timeout)
        except TransportError:
            raise
        except Exception:
            raise TransportError('lease transport failed closed') from None


def existing_lease_client(client_type):
    key = retrieve_existing_key()
    return client_type(base_url=BASE_URL, project_ref=PROJECT, api_key=key,
        opener=ApikeyOnlyLeaseOpener(key, client_type._open_no_redirect))
