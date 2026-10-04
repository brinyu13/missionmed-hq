#!/usr/bin/env python3
"""Dormant, anonymous fixed-origin GET checks; never a LIVE acceptance claim."""
import argparse
import hashlib
import html
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import signal
import socket
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ORIGIN = 'https://missionmedinstitute.com'
PACKAGE = Path('/private/tmp/ir-phase1-qualified-fullref-20261004/interview-ready-candidate.tar.gz')
PACKAGE_SHA = '16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa'
GATEWAY_SHA = '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5'
BASELINE_SHA = '10883816955c03507d8b5c25e40e2eeb00d255b0ac578a7aca8beef0d1b3d28a'
CAP = 2 * 1024 * 1024
TIMEOUT = 12
MARKER = b'/* MMED_IR_ACCOUNT_CONTEXT */ null'
RELEASE = 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/'

class Stop(Exception):
    pass


def require(condition):
    if not condition:
        raise Stop('EXPECTATION')


def digest(body):
    return hashlib.sha256(body).hexdigest()


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.nav_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a':
            if 'href' in attrs:
                self.links.append(attrs['href'])
            if 'data-mmed-ir-nav' in attrs and attrs.get('href') == ORIGIN + '/interview-ready/':
                self.nav_count += 1


def parse_html(body):
    parser = Links()
    parser.feed(body.decode('utf-8', errors='strict'))
    return parser


def bounded_read(response):
    body = response.read(CAP + 1)
    if len(body) > CAP:
        raise Stop('CAP')
    return body


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Stop('REDIRECT')


def alarm_handler(signum, frame):
    raise Stop('TIMEOUT')


def fetch(path):
    require(path.startswith('/') and not path.startswith('//'))
    request = urllib.request.Request(ORIGIN + path, method='GET', headers={
        'User-Agent': 'MissionMed-NativeQA/1.0', 'Accept': '*/*',
        'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache'})
    # No proxy environment, cookie jar, authentication handler, or redirect following.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    signal.signal(signal.SIGALRM, alarm_handler)
    signal.setitimer(signal.ITIMER_REAL, TIMEOUT)
    try:
        try:
            response = opener.open(request, timeout=TIMEOUT)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.code, response.headers, bounded_read(response)
    except Stop:
        raise
    except (socket.timeout, TimeoutError):
        raise Stop('TIMEOUT') from None
    except Exception:
        raise Stop('TRANSPORT') from None
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)


def safe_facts(label, status, headers, body):
    # Do not output arbitrary headers, Set-Cookie, body, JSON values, links, or exceptions.
    cc = {x.strip().lower() for x in headers.get('Cache-Control', '').split(',')}
    vary = {x.strip().lower() for x in headers.get('Vary', '').split(',')}
    return {'endpoint': label, 'status': status, 'sha256': digest(body), 'bytes': len(body),
            'cachePolicy': {'private': 'private' in cc, 'noStore': 'no-store' in cc,
                            'maxAgeZero': 'max-age=0' in cc, 'varyCookie': 'cookie' in vary}}


def private_policy(facts):
    return all(facts['cachePolicy'][x] for x in ('private', 'noStore', 'maxAgeZero', 'varyCookie'))


def state_denial(body):
    data = json.loads(body.decode('utf-8'))
    require(isinstance(data, dict) and set(data) == {'code', 'message', 'data'})
    require(data['code'] == 'ir_login_required')
    require(data['message'] == 'Interview Ready request could not be completed.')
    require(isinstance(data['data'], dict) and data['data'] == {'status': 401})
    return True


def expectations():
    gateway = ROOT / 'interview-ready/integration/missionmed-interview-ready.php'
    require(digest(gateway.read_bytes()) == GATEWAY_SHA)
    baseline_bytes = (HERE / 'PREINSTALL_SHARED_BYTE_READBACK.json').read_bytes()
    require(digest(baseline_bytes) == BASELINE_SHA)
    baseline = json.loads(baseline_bytes)['public']
    require(len(baseline) == 9)
    require(all(p.startswith('wp-content/') and '..' not in p and len(h) == 64 for p, h in baseline.items()))
    require(digest(PACKAGE.read_bytes()) == PACKAGE_SHA)
    with tarfile.open(PACKAGE, 'r:gz') as archive:
        public = archive.extractfile(RELEASE + 'interview-ready.html').read()
        gate = archive.extractfile(RELEASE + 'account-gate.html').read()
    require(public.count(MARKER) == 1)
    public = public.replace(MARKER, b'null')
    require(gate.count(b'{{MMED_IR_ACCOUNT_URL}}') == 1 and gate.count(b'{{MMED_IR_GUIDE_URL}}') == 1)
    return baseline, public, gate


def execute():
    baseline, public, gate = expectations()
    output = []
    status, headers, body = fetch('/interview-ready/')
    facts = safe_facts('public-guide', status, headers, body)
    require(status == 200 and body == public)
    facts['exactAnonymousBody'] = True
    facts['accountContextAbsent'] = True  # exact source-derived null substitution
    output.append(facts)
    status, headers, body = fetch('/interview-ready/app/')
    facts = safe_facts('anonymous-app', status, headers, body)
    require(status == 401 and private_policy(facts))
    # Match complete source gate after entity normalization, only the two gateway substitutions.
    account = ORIGIN + '/my-account/?' + urllib.parse.urlencode({
        'redirect_to': ORIGIN + '/interview-ready/app/', 'redirect': ORIGIN + '/interview-ready/app/'})
    expected_gate = gate.decode().replace('{{MMED_IR_ACCOUNT_URL}}', account).replace('{{MMED_IR_GUIDE_URL}}', ORIGIN + '/interview-ready/')
    require(html.unescape(body.decode()) == html.unescape(expected_gate))
    require(parse_html(body).links == [account, ORIGIN + '/interview-ready/'])
    facts['exactAnonymousGate'] = True
    output.append(facts)
    status, headers, body = fetch('/wp-json/missionmed-ir/v1/state')
    facts = safe_facts('anonymous-state-denial', status, headers, body)
    require(status == 401 and private_policy(facts) and state_denial(body))
    require(not headers.get('Access-Control-Allow-Origin') and not headers.get('Access-Control-Allow-Credentials'))
    facts['loginRequiredSchema'] = True
    output.append(facts)
    status, headers, body = fetch('/')
    facts = safe_facts('main-menu', status, headers, body)
    require(status == 200)
    count = parse_html(body).nav_count
    require(count > 0)
    facts['publicGuideMenuLinks'] = count
    output.append(facts)
    for index, (path, expected) in enumerate(sorted(baseline.items()), 1):
        status, headers, body = fetch('/' + path + '?ir_public_qa=' + str(time.time_ns()))
        facts = safe_facts('shared-public-asset-' + str(index), status, headers, body)
        require(status == 200 and facts['sha256'] == expected)
        facts['baselineEqual'] = True
        output.append(facts)
    return {'schema': 'ir.postinstall.public_qa.v1', 'result': 'ENDPOINT_FACTS_PASS',
            'endpointCount': len(output), 'facts': output, 'finalLiveAcceptance': False}


def self_test():
    require(parse_html(b'<a data-mmed-ir-nav href="https://missionmedinstitute.com/interview-ready/">x</a>').nav_count == 1)
    require(parse_html(b'<a href="https://other.test/interview-ready/">x</a>').nav_count == 0)
    denial = b'{"code":"ir_login_required","message":"Interview Ready request could not be completed.","data":{"status":401}}'
    require(state_denial(denial))
    try:
        state_denial(denial[:-1] + b',"state":{"nonce":"SECRET"}}')
        raise AssertionError('schema fixture accepted')
    except Stop:
        pass
    facts = safe_facts('fixture', 401, {'Set-Cookie': 'SECRET', 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie', 'X-Secret': 'SECRET'}, b'SECRET')
    require('SECRET' not in json.dumps(facts) and private_policy(facts))
    require(len(bounded_read(io.BytesIO(b'x' * CAP))) == CAP)
    try:
        bounded_read(io.BytesIO(b'x' * (CAP + 1)))
        raise AssertionError('cap fixture accepted')
    except Stop as error:
        require(str(error) == 'CAP')
    try:
        alarm_handler(None, None)
    except Stop as error:
        require(str(error) == 'TIMEOUT')
    return {'result': 'LOCAL_FIXTURES_PASS', 'checks': 6, 'networkExecuted': False}


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--execute', action='store_true')
    group.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if not args.execute and not args.self_test:
        print('DORMANT: separately reviewed post-install anonymous GET checks required')
        return 0
    try:
        result = self_test() if args.self_test else execute()
        print(json.dumps(result, sort_keys=True))
        return 0
    except Stop as error:
        print(json.dumps({'result': 'STOP', 'classification': str(error)}))
    except Exception:
        print(json.dumps({'result': 'STOP', 'classification': 'VALIDATION'}))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
