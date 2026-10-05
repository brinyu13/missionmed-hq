"""Dormant private inventory owner; no capability on import/default."""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import select
import sys
import threading
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
BUILDER = '/root/native_bridge_review'
DELTA_BUILDER = '/root/owner_classification_fix'
OWNER = 'codex-ir-phase1-foreman'
PINS = {
    'runtime_native_runner.py': '6a28f83a11e3b9c769b8473691ffcac10c1c4e5c8bd5a844b2585442280cc757',
    'native_account_qa.py': 'f64534309958e97aded039ca5e6fee65f49cf4140abafa13db4987c89222a8bb',
    'native_browser_bridge.py': '70db84535b5c0172fa162fe553de021e25c7e3363714a807ac0f676c7191658c',
    'NATIVE_BROWSER_BRIDGE_WATCHDOG_DELTA_REVIEW.md': '39b9050fef08035a5bbbcf8d6c9b377e1e59fa168d9079ee085a9ff1f870dbb3',
}
SHA = re.compile(r'[0-9a-f]{64}\Z')
JSON_NAME = re.compile(r'[A-Z0-9_]+\.json\Z')
REPORT_NAME = re.compile(r'[A-Z0-9_]+\.md\Z')
DIRECTORY_NAME = re.compile(r'NATIVE_INVENTORY_OWNER_[A-Z0-9_]+\Z')
IDENT = r'[A-Za-z_][A-Za-z0-9_]*'
CALLABLE = re.compile(r'(?:' + IDENT + r'\\)*' + IDENT + r'(?::' + ':' + IDENT + r')?\Z')
ROLE = re.compile(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*\.php\Z')
# A selector ceiling, not a claim that these names prove reachable closure.
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
MAX_SECONDS = 1800
MAX_FACTS = 256
HOOK_FAMILY = 'sanitize_user_meta'
PUBLIC_FAMILY_HOOK = 'sanitize_user_meta_*'


class Stop(RuntimeError):
    def __init__(self):
        super().__init__('NATIVE_INVENTORY_OWNER_STOP')


def check(value):
    if not value:
        raise Stop()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def safe_bytes(path, cap=262144):
    path = Path(path)
    check(not any(p.is_symlink() for p in (path, *path.parents)) and path.is_file() and path.stat().st_size <= cap)
    value = path.read_bytes()
    check(len(value) <= cap)
    return value


def digest(path):
    return hashlib.sha256(safe_bytes(path, 8 * 1024 * 1024)).hexdigest()


def public_json(path):
    try:
        return json.loads(safe_bytes(path))
    except BaseException:
        raise Stop() from None


def control_file(name):
    check(type(name) is str and JSON_NAME.fullmatch(name))
    return HERE / name


def report(record, extra=()):
    keys = {'verdict', 'independentReviewer', 'reportFile', 'reportSha256'} | set(extra)
    check(type(record) is dict and set(record) == keys and record['verdict'] == 'APPROVE' and
          type(record['independentReviewer']) is str and 0 < len(record['independentReviewer']) <= 128 and
          record['independentReviewer'] not in {BUILDER, DELTA_BUILDER, OWNER, '/root', '/root/phase1_native_qa_runner'} and
          type(record['reportFile']) is str and REPORT_NAME.fullmatch(record['reportFile']) and
          type(record['reportSha256']) is str and SHA.fullmatch(record['reportSha256']) and
          digest(HERE / record['reportFile']) == record['reportSha256'])


def future(value):
    return type(value) in (int, float) and math.isfinite(value) and time.time() < value <= time.time() + MAX_SECONDS


def check_pins(approval):
    check(approval['dependencyPins'] == PINS and all(digest(HERE / n) == h for n, h in PINS.items()))
    check(digest(Path(__file__)) == approval['ownerSha256'] and
          digest(HERE / 'native_inventory_owner_tests.py') == approval['ownerTestsSha256'])
    check(digest(control_file(approval['sourceEvidenceFile'])) == approval['sourceEvidenceSha256'])
    for record in (approval, approval['mappingReview'], approval['hookSelection']):
        check(digest(HERE / record['reportFile']) == record['reportSha256'])


def public_source(path, sha):
    check(digest(path) == sha)
    try:
        value = json.loads(safe_bytes(path, 8 * 1024 * 1024))
    except BaseException:
        raise Stop() from None
    check(type(value) is dict and value.get('localTransportEnded') is True and type(value.get('capture')) is dict)
    files = value['capture'].get('files')
    check(type(files) is list and 1 <= len(files) <= 128)
    result = set()
    for entry in files:
        check(type(entry) is dict and type(entry.get('sourceSha256')) is str and SHA.fullmatch(entry['sourceSha256']) and
              type(entry.get('role')) is str and 0 < len(entry['role']) <= 256 and
              not any(ord(c) < 32 for c in entry['role']))
        result.add((entry['sourceSha256'], entry['role']))
    return result


def selection_families(selection):
    """Only this source-qualified fixed family; keys and concrete tags stay private."""
    present = {'hookFamilies', 'closedDynamicHookFamiliesQualified'} & set(selection)
    if not present:
        return []
    check(present == {'hookFamilies', 'closedDynamicHookFamiliesQualified'} and
          selection['hookFamilies'] == [HOOK_FAMILY] and selection['closedDynamicHookFamiliesQualified'] is True)
    return selection['hookFamilies']


def qualify(approval_path, read_path):
    """External independent records only; no control issuance or secret access."""
    check(approval_path != read_path)
    approval = public_json(approval_path)
    admission = public_json(read_path)
    base = {'verdict', 'independentReviewer', 'reportFile', 'reportSha256'}
    required = base | {'schema', 'ownerSha256', 'ownerTestsSha256', 'dependencyPins', 'sourceEvidenceFile',
                       'sourceEvidenceSha256', 'sourceMappings', 'mappingReview', 'hookSelection', 'controlDirectory',
                       'maxSeconds', 'expiresUnix'}
    check(type(approval) is dict and set(approval) == required and approval['schema'] == 'ir.native.inventory_owner.approval.v1')
    report({k: approval[k] for k in base})
    check(type(admission) is dict and set(admission) == base | {'schema', 'approvalSha256', 'maxSeconds', 'expiresUnix'} and
          admission['schema'] == 'ir.native.inventory_owner.read_admission.v1')
    report({k: admission[k] for k in base})
    check(approval['reportFile'] != admission['reportFile'] and admission['approvalSha256'] == digest(approval_path) and
          type(approval['maxSeconds']) is int and 1 <= approval['maxSeconds'] <= MAX_SECONDS and
          admission['maxSeconds'] == approval['maxSeconds'] and future(approval['expiresUnix']) and future(admission['expiresUnix']))
    check_pins(approval)
    check(type(approval['sourceEvidenceSha256']) is str and SHA.fullmatch(approval['sourceEvidenceSha256']))
    sources = public_source(control_file(approval['sourceEvidenceFile']), approval['sourceEvidenceSha256'])
    mappings = approval['sourceMappings']
    check(type(mappings) is list and len(mappings) <= 128)
    seen = set()
    for mapping in mappings:
        check(type(mapping) is dict and set(mapping) == {'sha256', 'role', 'functions'} and
              (mapping['sha256'], mapping['role']) in sources and mapping['sha256'] not in seen and
              type(mapping['role']) is str and ROLE.fullmatch(mapping['role']) and '..' not in mapping['role'].split('/') and
              type(mapping['functions']) is list and len(mapping['functions']) <= 256 and
              len(mapping['functions']) == len(set(mapping['functions'])) and
              all(type(f) is str and len(f) <= 256 and CALLABLE.fullmatch(f) for f in mapping['functions']))
        seen.add(mapping['sha256'])
    report(approval['mappingReview'], {'sourceEvidenceSha256', 'sourceMappingsSha256', 'publicCodeIdentifiersQualified'})
    check(approval['mappingReview']['sourceEvidenceSha256'] == approval['sourceEvidenceSha256'] and
          approval['mappingReview']['sourceMappingsSha256'] == hashlib.sha256(canonical(mappings)).hexdigest() and
          approval['mappingReview']['publicCodeIdentifiersQualified'] is True)
    selection = approval['hookSelection']
    families = selection_families(selection)
    report(selection, {'hooks', 'sourceEvidenceSha256', 'closedReachableHookNamesQualified'} |
           ({'hookFamilies', 'closedDynamicHookFamiliesQualified'} if families else set()))
    check(type(selection['hooks']) is list and selection['hooks'] and len(selection['hooks']) == len(set(selection['hooks'])) and
          all(type(h) is str and h in STANDARD_HOOKS for h in selection['hooks']) and
          selection['sourceEvidenceSha256'] == approval['sourceEvidenceSha256'] and
          selection['closedReachableHookNamesQualified'] is True)
    directory = Path(approval['controlDirectory'])
    check(directory.is_absolute() and directory.parent == HERE and DIRECTORY_NAME.fullmatch(directory.name) and
          not directory.exists() and not directory.is_symlink())
    deadline = time.monotonic() + min(approval['maxSeconds'], approval['expiresUnix'] - time.time(), admission['expiresUnix'] - time.time())
    check(deadline > time.monotonic())
    # Atomic absent directory consumes this exact pair before wrapper import.
    directory.mkdir(mode=0o700)
    with (directory / 'CONSUMED.json').open('xb') as stream:
        stream.write(canonical({'schema': 'ir.native.inventory_owner.consumed.v1',
                               'approvalSha256': digest(approval_path), 'readAdmissionSha256': digest(read_path)}))
    return approval, deadline


def wipe(value):
    if isinstance(value, dict):
        for child in list(value.values()):
            wipe(child)
        value.clear()
    elif isinstance(value, list):
        for child in value:
            wipe(child)
        value.clear()


class PrivateInventory:
    def __init__(self, deadline):
        self.deadline = deadline
        self.lock = threading.RLock()
        self.value = None
        self.closed = False
        self.ended = threading.Event()
        self.worker = threading.Thread(target=self.expire, daemon=True, name='ir-inventory-private-deadline')

    def __repr__(self):
        return '<PrivateInventory private>'

    def arm(self):
        self.worker.start()

    def require(self):
        check(not self.closed and time.monotonic() < self.deadline)

    def retain(self, value):
        with self.lock:
            if self.closed or time.monotonic() >= self.deadline:
                wipe(value)
                raise Stop()
            check(self.value is None)
            self.value = value

    def clear(self):
        with self.lock:
            self.closed = True
            wipe(self.value)
            self.value = None
        self.ended.set()

    def expire(self):
        if not self.ended.wait(max(0, self.deadline - time.monotonic())):
            self.clear()

    def close(self):
        self.clear()
        try:
            if self.worker.ident is not None:
                self.worker.join(2)
            check(not self.worker.is_alive())
        except BaseException:
            raise Stop() from None


def validate_inventory(value):
    check(type(value) is dict and set(value) == {'schema', 'sha256', 'count', 'callbacks'} and
          value['schema'] == 'ir.native.hook_inventory.v1' and type(value['sha256']) is str and SHA.fullmatch(value['sha256']) and
          type(value['count']) is int and type(value['callbacks']) is list and 0 <= value['count'] <= 10000 and
          value['count'] == len(value['callbacks']))
    for row in value['callbacks']:
        check(type(row) is list and len(row) == 5 and type(row[0]) is str and 0 < len(row[0]) <= 256 and
              type(row[1]) is int and -(2**31) <= row[1] < 2**31 and type(row[2]) is str and 0 < len(row[2]) <= 2048 and
              type(row[3]) is int and 0 <= row[3] <= 1000 and type(row[4]) is str and
              (SHA.fullmatch(row[4]) or row[4] == 'internal_or_eval') and not any(ord(c) < 32 for c in row[0] + row[2]))
    # Full-row digest/capture cap was validated in the exact native engine.
    # The owner never serializes or copies the full private registry.


def selected_facts(store, approval):
    """Only qualified standard tags/symbols; never raw closure IDs or other rows."""
    with store.lock:
        store.require()
        value = store.value
        validate_inventory(value)
        mappings = {m['sha256']: m for m in approval['sourceMappings']}
        hooks = set(approval['hookSelection']['hooks'])
        families = selection_families(approval['hookSelection'])
        facts = set()
        closures = set()
        unknown = {}
        descriptors = approval.get('closureDescriptors', [])
        descriptor_map = {(d['hook'], d['sha256'], d['identifierSha256']): d for d in descriptors}
        closure_counts = {}
        for row in value['callbacks']:
            store.require()
            if row[2].startswith('closure:'):
                key = (row[4], row[2].rsplit(':', 1)[-1])
                closure_counts[key] = closure_counts.get(key, 0) + 1
        for tag, priority, identifier, args, sha in value['callbacks']:
            store.require()
            if tag.startswith('sanitize_user_meta_'):
                check(HOOK_FAMILY in families)
                tag = PUBLIC_FAMILY_HOOK
            if tag not in hooks and tag != PUBLIC_FAMILY_HOOK:
                continue
            mapping = mappings.get(sha)
            reason = 'unmapped_source' if mapping is None else 'closure' if identifier.startswith('closure:') else 'unmapped_callable'
            descriptor = descriptor_map.get((tag, sha, hashlib.sha256(identifier.encode()).hexdigest()))
            # Reflection exposes only file/start-line, so duplicate records remain ambiguous.
            if identifier.startswith('closure:') and descriptor is not None and mapping is not None and \
                    closure_counts.get((sha, str(descriptor['line']))) == 1 and \
                    identifier.rsplit(':', 1)[-1] == str(descriptor['line']):
                d = descriptor
                closures.add((tag, sha, d['role'], d['line']))
            elif mapping is not None and CALLABLE.fullmatch(identifier) and identifier in mapping['functions']:
                facts.add((tag, identifier, 'method' if '::' in identifier else 'function', sha, mapping['role']))
            else:
                key = (tag, sha, reason)
                unknown[key] = unknown.get(key, 0) + 1
            check(len(facts) + len(closures) <= MAX_FACTS and len(unknown) <= MAX_FACTS)
        result = {'schema': 'ir.native.inventory_owner.facts.v1', 'phase': 'inventory_facts', 'result': 'FACTS_ONLY',
                  'inventorySha256': value['sha256'], 'callbacksCount': value['count'],
                  'sourceEvidenceSha256': approval['sourceEvidenceSha256'],
                  'hookSelectionSha256': hashlib.sha256(canonical(approval['hookSelection'])).hexdigest(),
                  'facts': [dict(zip(('hook', 'callable', 'type', 'sha256', 'role'), fact)) for fact in sorted(facts)],
                  'unresolved': [{'hook': k[0], 'sha256': k[1], 'reason': k[2], 'count': n} for k, n in sorted(unknown.items())]}
        if 'classificationChain' in approval:
            result['facts'].extend(dict(zip(('hook', 'sha256', 'role', 'line'), fact), type='closure') for fact in sorted(closures))
            result['classificationChain'] = approval['classificationChain']
        store.require()
        return result


def classification_update(paths, store, used, original, facts, binding, released_unix, forbidden_directories):
    """One sealed local reclassification; never calls the wrapper or renews custody."""
    store.require()
    check(not set(paths) & used and paths[0] != paths[1])
    used.update(paths)
    sealed_controls = [safe_bytes(p) for p in paths]
    update, admission = (json.loads(data) for data in sealed_controls)
    control_hashes = [hashlib.sha256(data).hexdigest() for data in sealed_controls]
    base = {'verdict', 'independentReviewer', 'reportFile', 'reportSha256'}
    required = base | {'schema', 'inventorySha256', 'inventoryBindingSha256', 'inventoryReleasedUnix',
        'previousFactsSha256', 'ownerSourceEvidenceSha256', 'ownerSourceMappingsSha256', 'ownerHookSelectionSha256',
        'sourceEvidenceFile', 'sourceEvidenceSha256', 'sourceMappings', 'mappingReview', 'closureDescriptors',
        'closureReview', 'controlDirectory', 'maxSeconds', 'expiresUnix', 'reviewedUnix'}
    check(type(update) is dict and set(update) == required and
          update['schema'] == 'ir.native.inventory_owner.classification_update.v1')
    report({k: update[k] for k in base})
    check(type(admission) is dict and set(admission) == base | {'schema', 'approvalSha256', 'maxSeconds', 'expiresUnix'} and
          admission['schema'] == 'ir.native.inventory_owner.classification_read_admission.v1')
    report({k: admission[k] for k in base})
    check(update['reportFile'] != admission['reportFile'] and admission['approvalSha256'] == control_hashes[0] and
          type(update['maxSeconds']) is int and 0 < update['maxSeconds'] <= store.deadline - time.monotonic() and
          admission['maxSeconds'] == update['maxSeconds'] and future(update['expiresUnix']) and future(admission['expiresUnix']) and
          update['inventorySha256'] == facts['inventorySha256'] and update['inventoryBindingSha256'] == binding and
          update['inventoryReleasedUnix'] == released_unix and
          update['previousFactsSha256'] == hashlib.sha256(canonical(facts)).hexdigest() and
          update['ownerSourceEvidenceSha256'] == original['sourceEvidenceSha256'] and
          update['ownerSourceMappingsSha256'] == hashlib.sha256(canonical(original['sourceMappings'])).hexdigest() and
          update['ownerHookSelectionSha256'] == facts['hookSelectionSha256'])
    reviewed = update['reviewedUnix']
    check(type(reviewed) in (int, float) and math.isfinite(reviewed) and released_unix <= reviewed <= time.time())
    round_deadline = min(store.deadline, time.monotonic() + update['maxSeconds'],
                         time.monotonic() + min(update['expiresUnix'], admission['expiresUnix']) - time.time())
    check(type(update['sourceEvidenceSha256']) is str and SHA.fullmatch(update['sourceEvidenceSha256']))
    sources = public_source(control_file(update['sourceEvidenceFile']), update['sourceEvidenceSha256'])
    mappings = update['sourceMappings']
    check(type(mappings) is list and len(mappings) <= 128)
    combined = {m['sha256']: m for m in original['sourceMappings']}
    seen = set()
    for mapping in mappings:
        check(type(mapping) is dict and set(mapping) == {'sha256', 'role', 'functions'} and
              (mapping['sha256'], mapping['role']) in sources and mapping['sha256'] not in seen and
              type(mapping['role']) is str and ROLE.fullmatch(mapping['role']) and '..' not in mapping['role'].split('/') and
              type(mapping['functions']) is list and len(mapping['functions']) <= 256 and
              len(mapping['functions']) == len(set(mapping['functions'])) and
              all(type(f) is str and len(f) <= 256 and CALLABLE.fullmatch(f) for f in mapping['functions']))
        old = combined.get(mapping['sha256'])
        check(old is None or (old['role'] == mapping['role'] and set(old['functions']) <= set(mapping['functions'])))
        seen.add(mapping['sha256'])
        combined[mapping['sha256']] = mapping
    check(len(combined) <= 128)
    mapping_hash = hashlib.sha256(canonical(mappings)).hexdigest()
    report(update['mappingReview'], {'sourceEvidenceSha256', 'sourceMappingsSha256', 'publicCodeIdentifiersQualified'})
    check(update['mappingReview']['sourceEvidenceSha256'] == update['sourceEvidenceSha256'] and
          update['mappingReview']['sourceMappingsSha256'] == mapping_hash and
          update['mappingReview']['publicCodeIdentifiersQualified'] is True)
    descriptors = update['closureDescriptors']
    check(type(descriptors) is list and len(descriptors) <= MAX_FACTS)
    descriptor_keys = set()
    for d in descriptors:
        check(type(d) is dict and set(d) == {'hook', 'sha256', 'role', 'line', 'identifierSha256'} and
              type(d['hook']) is str and (d['hook'] in original['hookSelection']['hooks'] or
                  (d['hook'] == PUBLIC_FAMILY_HOOK and HOOK_FAMILY in selection_families(original['hookSelection']))) and
              type(d['sha256']) is str and type(d['role']) is str and (d['sha256'], d['role']) in sources and
              d['sha256'] in combined and combined[d['sha256']]['role'] == d['role'] and
              type(d['line']) is int and 1 <= d['line'] <= 10000000 and
              type(d['identifierSha256']) is str and SHA.fullmatch(d['identifierSha256']))
        key = (d['hook'], d['sha256'], d['identifierSha256'])
        check(key not in descriptor_keys)
        descriptor_keys.add(key)
    descriptor_hash = hashlib.sha256(canonical(descriptors)).hexdigest()
    report(update['closureReview'], {'sourceEvidenceSha256', 'closureDescriptorsSha256',
                                   'selectedClosureDescriptorsQualified', 'unambiguousSourceClosuresQualified'})
    check(update['closureReview']['sourceEvidenceSha256'] == update['sourceEvidenceSha256'] and
          update['closureReview']['closureDescriptorsSha256'] == descriptor_hash and
          update['closureReview']['selectedClosureDescriptorsQualified'] is True and
          update['closureReview']['unambiguousSourceClosuresQualified'] is True)
    directory = Path(update['controlDirectory'])
    check(directory.is_absolute() and directory.parent == HERE and DIRECTORY_NAME.fullmatch(directory.name) and
          directory not in forbidden_directories and not directory.exists() and not directory.is_symlink())
    updated = dict(original, sourceMappings=list(combined.values()), closureDescriptors=descriptors,
                   classificationChain={'previousFactsSha256': update['previousFactsSha256'],
                       'classificationUpdateSha256': control_hashes[0], 'classificationReadAdmissionSha256': control_hashes[1],
                       'sourceEvidenceSha256s': [original['sourceEvidenceSha256'], update['sourceEvidenceSha256']],
                       'sourceMappingsSha256': hashlib.sha256(canonical(list(combined.values()))).hexdigest(),
                       'closureDescriptorsSha256': descriptor_hash})
    seals = list(zip(paths, control_hashes)) + [(control_file(update['sourceEvidenceFile']), update['sourceEvidenceSha256'])]
    seals += [(HERE / r['reportFile'], r['reportSha256']) for r in
              (update, admission, update['mappingReview'], update['closureReview'])]
    check(all(digest(p) == h for p, h in seals))
    store.require()
    check(time.monotonic() < round_deadline)
    directory.mkdir(mode=0o700)
    with (directory / 'CONSUMED.json').open('xb') as stream:
        stream.write(canonical({'schema': 'ir.native.inventory_owner.classification_consumed.v1',
                               'approvalSha256': control_hashes[0], 'readAdmissionSha256': control_hashes[1]}))
    next_facts = selected_facts(store, updated)
    # Existing published facts are immutable and may only be extended.
    check(all(f in next_facts['facts'] for f in facts['facts']))
    check(time.monotonic() < round_deadline)
    next_facts['classificationChain']['classificationUpdatedUnix'] = time.time()
    return next_facts, directory, seals


def read_pair(fd, store):
    raw = bytearray()
    while True:
        store.require()
        remaining = store.deadline - time.monotonic()
        check(remaining > 0)
        ready, _, _ = select.select([fd], [], [], min(.25, remaining))
        if not ready:
            continue
        block = os.read(fd, 1)
        check(block)
        raw.extend(block)
        check(len(raw) <= 1024)
        if block == b'\n':
            break
    try:
        value = json.loads(raw)
    except BaseException:
        raise Stop() from None
    check(type(value) is dict and set(value) == {'approvalFile', 'readAdmissionFile'})
    paths = (control_file(value['approvalFile']), control_file(value['readAdmissionFile']))
    check(paths[0] != paths[1])
    return paths


def load_wrapper(approval):
    check_pins(approval)
    path = HERE / 'runtime_native_runner.py'
    data = safe_bytes(path)
    check(hashlib.sha256(data).hexdigest() == PINS[path.name])
    spec = importlib.util.spec_from_file_location('ir_inventory_owner_exact_wrapper', path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    exec(compile(data, str(path), 'exec'), module.__dict__)
    return module


def phase_controls(paths, phase, store, used):
    store.require()
    check(not set(paths) & used)
    used.update(paths)
    approval = public_json(paths[0])
    admission = public_json(paths[1])
    check(type(approval) is dict and type(admission) is dict and approval.get('phase') == admission.get('phase') == phase and
          approval.get('schema') == 'ir.runtime_native.approval.v1' and admission.get('schema') == 'ir.runtime_native.read_admission.v1' and
          future(approval.get('expiresUnix')) and future(admission.get('expiresUnix')) and
          admission.get('approvalSha256') == digest(paths[0]) and type(admission.get('maxSeconds')) is int and
          0 < admission['maxSeconds'] <= min(MAX_SECONDS, store.deadline - time.monotonic()))
    contract = approval.get('contract')
    check(type(contract) is dict and type(approval.get('spec')) is dict and contract.get('spec') == approval['spec'])
    binding = hashlib.sha256(canonical(contract)).hexdigest()
    check(admission.get('bindingSha256') == binding)
    return approval, admission['maxSeconds'], binding


def released(wrapper, approval, binding, phase, aggregate):
    receipt = wrapper.read_json(Path(approval['spec']['controlDirectory']) / 'RESULT.json')
    check(type(receipt) is dict and receipt.get('phase') == phase and receipt.get('bindingSha256') == binding and
          receipt.get('result') == 'BOUNDED_PHASE_COMPLETE' and receipt.get('release') == 'RELEASED' and
          receipt.get('nativeReport') == aggregate)


def auth_semantics(approval, inventory_binding, facts_hash, facts, released_unix):
    hooks = approval['spec'].get('qualifications', {}).get('reachableHooks', {})
    report({k: hooks.get(k) for k in ('verdict', 'independentReviewer', 'reportFile', 'reportSha256')})
    check(not facts['unresolved'] and approval['spec'].get('hookInventorySha256') == facts['inventorySha256'] and
          hooks.get('hookInventorySha256') == facts['inventorySha256'] and hooks.get('inventoryBindingSha256') == inventory_binding and
          hooks.get('inventoryReadReleased') is True and hooks.get('reachableEffectsQualified') is True and
          hooks.get('bootstrapEffectsQualified') is True and hooks.get('ownerFactsSha256') == facts_hash and
          hooks.get('ownerSourceEvidenceSha256') == facts['sourceEvidenceSha256'] and
          hooks.get('ownerHookSelectionSha256') == facts['hookSelectionSha256'])
    if 'classificationChain' in facts:
        check(hooks.get('ownerClassificationChainSha256') == hashlib.sha256(canonical(facts['classificationChain'])).hexdigest())
    reviewed = hooks.get('ownerReviewedUnix')
    review_after = max(released_unix, facts.get('classificationChain', {}).get('classificationUpdatedUnix', released_unix))
    check(type(reviewed) in (int, float) and math.isfinite(reviewed) and review_after <= reviewed <= time.time())
    clear = hooks.get('inventoryProviderClear')
    report(clear, {'bindingSha256', 'released', 'activeIR', 'pendingIR', 'observedUnix'})
    observed = clear['observedUnix']
    check(clear['bindingSha256'] == inventory_binding and clear['released'] is True and
          type(clear['activeIR']) is int and clear['activeIR'] == 0 and type(clear['pendingIR']) is int and clear['pendingIR'] == 0 and
          type(observed) in (int, float) and math.isfinite(observed) and 0 <= time.time() - observed < 300)


def run(approval, deadline, fd, publish):
    store = PrivateInventory(deadline)
    returned = None
    private = None
    used = {control_file(approval['sourceEvidenceFile'])}
    used_directories = {Path(approval['controlDirectory'])} if 'controlDirectory' in approval else set()
    finished = False
    try:
        store.arm()
        store.require()
        wrapper = load_wrapper(approval)
        paths = read_pair(fd, store)
        first, seconds, binding = phase_controls(paths, 'auth_inventory', store, used)
        check_pins(approval)
        returned = wrapper.execute('auth_inventory', paths[0], paths[1], seconds)
        check(type(returned) is dict and returned.get('phase') == 'auth_inventory' and returned.get('result') == 'BOUNDED_PHASE_COMPLETE')
        private = returned.pop('privateInventory', None)
        store.retain(private)
        private = None
        with store.lock:
            store.require()
            validate_inventory(store.value)
            aggregate = wrapper.safe_inventory_report(store.value)
        check(returned.get('nativeReport') == aggregate)
        released(wrapper, first, binding, 'auth_inventory', aggregate)
        used_directories.add(Path(first['spec']['controlDirectory']))
        returned = None
        released_unix = time.time()
        facts = selected_facts(store, approval)
        facts_hash = hashlib.sha256(canonical(facts)).hexdigest()
        publish({'phase': 'auth_inventory', 'result': 'BOUNDED_PHASE_COMPLETE', 'inventorySha256': facts['inventorySha256'],
                 'callbacksCount': facts['callbacksCount'], 'released': True, 'bindingSha256': binding,
                 'inventoryReleasedUnix': released_unix})
        store.require()
        publish(facts)
        paths2 = read_pair(fd, store)
        update_seals = []
        if public_json(paths2[0]).get('schema') == 'ir.native.inventory_owner.classification_update.v1':
            check_pins(approval)
            facts, update_directory, update_seals = classification_update(paths2, store, used, approval, facts, binding,
                                                                          released_unix, used_directories)
            used_directories.add(update_directory)
            facts_hash = hashlib.sha256(canonical(facts)).hexdigest()
            publish(facts)
            paths2 = read_pair(fd, store)
        second, seconds2, binding2 = phase_controls(paths2, 'auth', store, used)
        check(second['contract'] != first['contract'] and Path(second['spec']['controlDirectory']) not in used_directories)
        auth_semantics(second, binding, facts_hash, facts, released_unix)
        check_pins(approval)
        check(all(digest(p) == h for p, h in update_seals))
        store.require()
        # Independently bound effects review completed; no further row use.
        store.clear()
        returned = wrapper.execute('auth', paths2[0], paths2[1], seconds2)
        check(type(returned) is dict and returned.get('phase') == 'auth' and returned.get('result') == 'BOUNDED_PHASE_COMPLETE')
        aggregate = wrapper.safe_native_report(returned.get('nativeReport'))
        released(wrapper, second, binding2, 'auth', aggregate)
        publish({'phase': 'auth', 'result': 'BOUNDED_PHASE_COMPLETE', 'released': True})
        finished = True
    except BaseException:
        raise Stop() from None
    finally:
        wipe(private)
        if isinstance(returned, dict):
            wipe(returned.pop('privateInventory', None))
        store.close()
    return finished


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print('DORMANT: independent owner/read and separate inventory/auth controls required')
        return 0
    try:
        check(len(argv) == 5 and argv[0] == '--execute' and argv[1] == '--approval' and argv[3] == '--read-admission')
        approval, deadline = qualify(control_file(argv[2]), control_file(argv[4]))
        run(approval, deadline, sys.stdin.fileno(), lambda value: print(canonical(value).decode(), flush=True))
        return 0
    except BaseException:
        print('NATIVE_INVENTORY_OWNER_STOP')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
