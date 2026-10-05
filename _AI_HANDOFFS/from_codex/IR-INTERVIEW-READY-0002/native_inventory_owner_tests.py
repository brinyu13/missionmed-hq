"""Synthetic fixtures only: private canaries, local pipes/threads, no provider."""
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('ir_owner_fixtures', Path(__file__).with_name('native_inventory_owner.py'))
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)
CANARY = 'private_inventory_canary_DO_NOT_PUBLISH'


class Fixtures(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='ir-owner-fixture-')
        self.root = Path(self.tmp.name).resolve()
        self.here = patch.object(owner, 'HERE', self.root)
        self.here.start()
        self.fds = []
        self.source_sha = '1' * 64
        self.source = {'localTransportEnded': True, 'capture': {'files': [
            {'role': 'user.php', 'sourceSha256': self.source_sha},
            {'role': 'launcher:/usr/local/bin/wp', 'sourceSha256': '2' * 64}]}}
        self.write('SOURCE.json', self.source)
        for name in ['OWNER_REVIEW.md', 'OWNER_READ_REVIEW.md', 'MAPPING_REVIEW.md', 'SELECTION_REVIEW.md', 'CLEAR_REVIEW.md',
                     'UPDATE_REVIEW.md', 'UPDATE_READ_REVIEW.md', 'UPDATE_MAPPING_REVIEW.md', 'UPDATE_CLOSURE_REVIEW.md']:
            (self.root / name).write_text('Synthetic independent fixture only; not a live approval.')
        self.approval = {'sourceEvidenceFile': 'SOURCE.json', 'sourceEvidenceSha256': owner.digest(self.root / 'SOURCE.json'),
                         'sourceMappings': [{'sha256': self.source_sha, 'role': 'user.php', 'functions': ['safe_func', 'SafeClass::safe_method']}],
                         'hookSelection': dict(self.record('SELECTION_REVIEW.md'), hooks=['user_register', 'get_user_metadata', 'authenticate'],
                                               sourceEvidenceSha256=owner.digest(self.root / 'SOURCE.json'), closedReachableHookNamesQualified=True)}

    def tearDown(self):
        for fd in self.fds:
            try:
                os.close(fd)
            except OSError:
                pass
        self.here.stop()
        self.tmp.cleanup()

    def write(self, name, value):
        path = self.root / name
        path.write_bytes(owner.canonical(value))
        return path

    def record(self, name):
        return {'verdict': 'APPROVE', 'independentReviewer': 'fixture-distinct-reviewer', 'reportFile': name,
                'reportSha256': owner.digest(self.root / name)}

    def inventory(self, rows=None):
        rows = rows if rows is not None else [
            ['user_register', 10, 'safe_func', 1, self.source_sha],
            ['authenticate', 10, 'SafeClass::safe_method', 1, self.source_sha],
            [CANARY, 10, CANARY, 1, '3' * 64]]
        # Only the synthetic fixture builds private wire data. Owner never does.
        encoded = json.dumps(rows, ensure_ascii=True, separators=(',', ':')).replace('/', '\\/').encode()
        return {'schema': 'ir.native.hook_inventory.v1', 'sha256': hashlib.sha256(encoded).hexdigest(),
                'count': len(rows), 'callbacks': rows}

    def pipe(self, content=b''):
        read, write = os.pipe()
        self.fds.extend([read, write])
        if content:
            os.write(write, content)
        return read, write

    def pair_bytes(self, a='INV_APPROVAL.json', r='INV_READ.json'):
        return owner.canonical({'approvalFile': a, 'readAdmissionFile': r}) + b'\n'

    def controls(self, phase, stem, qualifications=None):
        spec = {'controlDirectory': str(self.root / (stem + '_CONTROL')),
                'qualifications': qualifications or {}}
        if phase == 'auth':
            spec['hookInventorySha256'] = self.private['sha256']
        contract = {'phase': phase, 'spec': spec}
        approval = {'schema': 'ir.runtime_native.approval.v1', 'phase': phase, 'spec': spec, 'contract': contract,
                    'expiresUnix': time.time() + 10}
        ap = self.write(stem + '_APPROVAL.json', approval)
        binding = hashlib.sha256(owner.canonical(contract)).hexdigest()
        admission = {'schema': 'ir.runtime_native.read_admission.v1', 'phase': phase,
                     'approvalSha256': owner.digest(ap), 'bindingSha256': binding, 'maxSeconds': 1,
                     'expiresUnix': time.time() + 10}
        rp = self.write(stem + '_READ.json', admission)
        return (ap, rp), approval, binding

    def fake_wrapper(self, release='RELEASED', native_failure=False):
        calls = []
        private = self.private
        def inv_report(value):
            return {'mode': 'inventory', 'result': 'PASS_PRIVATE_INVENTORY_READ',
                    'inventorySha256': value['sha256'], 'callbacksCount': value['count']}
        def execute(phase, ap, rp, seconds):
            calls.append(phase)
            if phase == 'auth' and native_failure:
                raise OSError(CANARY)
            a = owner.public_json(ap)
            r = owner.public_json(rp)
            result = inv_report(private) if phase == 'auth_inventory' else {'result': 'synthetic_protocol'}
            d = Path(a['spec']['controlDirectory'])
            d.mkdir()
            self.write(str(d.name + '/RESULT.json'), {'phase': phase, 'bindingSha256': r['bindingSha256'],
                'result': 'BOUNDED_PHASE_COMPLETE', 'release': release, 'nativeReport': result})
            value = {'phase': phase, 'result': 'BOUNDED_PHASE_COMPLETE', 'nativeReport': result}
            if phase == 'auth_inventory':
                value['privateInventory'] = private
            else:
                self.assertFalse(private, 'Inventory references must clear before AUTH')
            return value
        return SimpleNamespace(execute=execute, safe_inventory_report=inv_report,
                               safe_native_report=lambda value: value, read_json=owner.public_json), calls

    def auth_qualification(self, facts, binding, released_unix):
        result = {**self.record('MAPPING_REVIEW.md'), 'hookInventorySha256': facts['inventorySha256'], 'inventoryBindingSha256': binding,
                'inventoryReadReleased': True, 'reachableEffectsQualified': True, 'bootstrapEffectsQualified': True,
                'ownerFactsSha256': hashlib.sha256(owner.canonical(facts)).hexdigest(),
                'ownerSourceEvidenceSha256': facts['sourceEvidenceSha256'],
                'ownerHookSelectionSha256': facts['hookSelectionSha256'], 'ownerReviewedUnix': time.time(),
                'inventoryProviderClear': dict(self.record('CLEAR_REVIEW.md'), bindingSha256=binding, released=True,
                                             activeIR=0, pendingIR=0, observedUnix=time.time())}
        if 'classificationChain' in facts:
            result['ownerClassificationChainSha256'] = hashlib.sha256(owner.canonical(facts['classificationChain'])).hexdigest()
        return result

    def update_controls(self, facts, binding, released_unix, descriptors=None):
        mappings = [{'sha256': self.source_sha, 'role': 'user.php', 'functions': ['safe_func', 'SafeClass::safe_method']},
                    {'sha256': '4' * 64, 'role': 'formatting.php', 'functions': ['new_public_function']}]
        self.write('UPDATE_SOURCE.json', {'localTransportEnded': True, 'capture': {'files': [
            {'role': m['role'], 'sourceSha256': m['sha256']} for m in mappings]}})
        source_hash = owner.digest(self.root / 'UPDATE_SOURCE.json')
        descriptors = descriptors or []
        update = dict(self.record('UPDATE_REVIEW.md'), schema='ir.native.inventory_owner.classification_update.v1',
            inventorySha256=facts['inventorySha256'], inventoryBindingSha256=binding, inventoryReleasedUnix=released_unix,
            previousFactsSha256=hashlib.sha256(owner.canonical(facts)).hexdigest(),
            ownerSourceEvidenceSha256=self.approval['sourceEvidenceSha256'],
            ownerSourceMappingsSha256=hashlib.sha256(owner.canonical(self.approval['sourceMappings'])).hexdigest(),
            ownerHookSelectionSha256=facts['hookSelectionSha256'], sourceEvidenceFile='UPDATE_SOURCE.json',
            sourceEvidenceSha256=source_hash, sourceMappings=mappings,
            mappingReview=dict(self.record('UPDATE_MAPPING_REVIEW.md'), sourceEvidenceSha256=source_hash,
                sourceMappingsSha256=hashlib.sha256(owner.canonical(mappings)).hexdigest(), publicCodeIdentifiersQualified=True),
            closureDescriptors=descriptors,
            closureReview=dict(self.record('UPDATE_CLOSURE_REVIEW.md'), sourceEvidenceSha256=source_hash,
                closureDescriptorsSha256=hashlib.sha256(owner.canonical(descriptors)).hexdigest(),
                selectedClosureDescriptorsQualified=True, unambiguousSourceClosuresQualified=True),
            controlDirectory=str(self.root / 'NATIVE_INVENTORY_OWNER_UPDATE'), maxSeconds=1,
            expiresUnix=time.time() + 10, reviewedUnix=time.time())
        ap = self.write('UPDATE_APPROVAL.json', update)
        rp = self.update_read(ap)
        return (ap, rp), update

    def update_read(self, ap):
        return self.write('UPDATE_READ.json', dict(self.record('UPDATE_READ_REVIEW.md'),
            schema='ir.native.inventory_owner.classification_read_admission.v1', approvalSha256=owner.digest(ap),
            maxSeconds=1, expiresUnix=time.time() + 10))

    def closure_descriptor(self, identifier='closure:/private/' + CANARY + '.php:123'):
        return {'hook': 'user_register', 'sha256': self.source_sha, 'role': 'user.php', 'line': 123,
                'identifierSha256': hashlib.sha256(identifier.encode()).hexdigest()}

    def test_default_and_bad_arguments_never_import_or_execute(self):
        with patch.object(owner, 'load_wrapper') as load, patch.object(owner, 'qualify') as qualify, patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(owner.main([]), 0)
            self.assertEqual(owner.main(['--execute']), 1)
            self.assertEqual(owner.main(['--execute', '--approval', CANARY, '--read-admission', 'READ.json']), 1)
        load.assert_not_called()
        qualify.assert_not_called()

    def test_selection_has_only_qualified_symbols_no_nonpublic_or_closure_paths(self):
        rows = self.inventory()['callbacks'] + [
            ['user_register', 1, 'closure:/private/' + CANARY + '.php:123', 1, self.source_sha],
            ['authenticate', 1, CANARY, 1, self.source_sha],
            ['get_user_metadata', 1, CANARY, 1, '4' * 64]]
        private = self.inventory(rows)
        store = owner.PrivateInventory(time.monotonic() + 1)
        store.retain(private)
        facts = owner.selected_facts(store, self.approval)
        text = owner.canonical(facts).decode()
        self.assertNotIn(CANARY, text)
        self.assertNotIn('/private/', text)
        self.assertEqual(len(facts['facts']), 2)
        self.assertEqual({x['reason'] for x in facts['unresolved']}, {'closure', 'unmapped_callable', 'unmapped_source'})
        self.assertNotIn('priority', text)
        store.close()
        self.assertFalse(private)

    def test_full_registry_is_not_serialized_by_owner(self):
        private = self.inventory()
        store = owner.PrivateInventory(time.monotonic() + 1)
        store.retain(private)
        original = owner.json.dumps
        def guarded(value, *args, **kwargs):
            self.assertIsNot(value, private)
            self.assertIsNot(value, private['callbacks'])
            return original(value, *args, **kwargs)
        with patch.object(owner.json, 'dumps', side_effect=guarded):
            owner.validate_inventory(private)
            owner.selected_facts(store, self.approval)
        store.close()

    def test_watchdog_clears_actual_private_references_while_waiting(self):
        private = self.inventory()
        aliases = list(private['callbacks'])
        store = owner.PrivateInventory(time.monotonic() + .1)
        store.arm()
        store.retain(private)
        store.worker.join(.3)
        self.assertTrue(store.closed)
        self.assertFalse(private)
        self.assertTrue(all(not row for row in aliases))
        with self.assertRaises(owner.Stop):
            store.require()
        store.close()

    def test_late_return_clears_without_adopting_or_renewing(self):
        private = self.inventory()
        store = owner.PrivateInventory(time.monotonic() - 1)
        with self.assertRaises(owner.Stop):
            store.retain(private)
        self.assertFalse(private)
        store.close()

    def test_stdin_only_closed_public_pairs_caps_and_deadline(self):
        good, write = self.pipe(self.pair_bytes())
        store = owner.PrivateInventory(time.monotonic() + 1)
        self.assertEqual(owner.read_pair(good, store), (self.root / 'INV_APPROVAL.json', self.root / 'INV_READ.json'))
        for value in [self.pair_bytes('../BAD.json'), owner.canonical({'approvalFile': 'A.json', 'readAdmissionFile': 'B.json', 'privateInventory': CANARY}) + b'\n', b'x' * 1025]:
            fd, _ = self.pipe(value)
            with self.assertRaises(owner.Stop):
                owner.read_pair(fd, store)
        fd, _ = self.pipe()
        short = owner.PrivateInventory(time.monotonic() + .025)
        short.arm()
        with self.assertRaises(owner.Stop):
            owner.read_pair(fd, short)
        short.close()
        store.close()

    def test_owner_external_qualification_consumes_once_and_checks_closed_mapping(self):
        a = dict(self.record('OWNER_REVIEW.md'), **self.approval, schema='ir.native.inventory_owner.approval.v1',
                 ownerSha256='5' * 64, ownerTestsSha256='6' * 64, dependencyPins=owner.PINS,
                 maxSeconds=10, expiresUnix=time.time() + 10, controlDirectory=str(self.root / 'NATIVE_INVENTORY_OWNER_FIXTURE'),
                 mappingReview=dict(self.record('MAPPING_REVIEW.md'), sourceEvidenceSha256=self.approval['sourceEvidenceSha256'],
                     sourceMappingsSha256=hashlib.sha256(owner.canonical(self.approval['sourceMappings'])).hexdigest(),
                     publicCodeIdentifiersQualified=True))
        ap = self.write('OWNER_APPROVAL.json', a)
        rp = self.write('OWNER_READ.json', dict(self.record('OWNER_READ_REVIEW.md'), schema='ir.native.inventory_owner.read_admission.v1',
                    approvalSha256=owner.digest(ap), maxSeconds=10, expiresUnix=time.time() + 10))
        with patch.object(owner, 'check_pins'):
            accepted, deadline = owner.qualify(ap, rp)
            self.assertLessEqual(deadline, time.monotonic() + 10)
            with self.assertRaises(owner.Stop):
                owner.qualify(ap, rp)
        self.assertNotIn(CANARY, (self.root / 'NATIVE_INVENTORY_OWNER_FIXTURE/CONSUMED.json').read_text())

    def test_unqualified_or_private_hook_and_self_review_precede_consumption(self):
        for record in [dict(self.record('MAPPING_REVIEW.md'), independentReviewer=owner.BUILDER),
                       dict(self.record('MAPPING_REVIEW.md'), verdict='BLOCK')]:
            with self.assertRaises(owner.Stop):
                owner.report(record)
        self.assertNotIn(CANARY, owner.STANDARD_HOOKS)
        for symbol in [CANARY + '/path', 'closure:/private/path:12', 'bad=value']:
            self.assertFalse(owner.CALLABLE.fullmatch(symbol))
        self.assertTrue(owner.CALLABLE.fullmatch('PublicNamespace\\PublicClass::public_method'))

    def test_bad_closed_hook_mapping_expiry_and_foreman_stop_before_consumption(self):
        base = dict(self.record('OWNER_REVIEW.md'), **self.approval, schema='ir.native.inventory_owner.approval.v1',
                    ownerSha256='5' * 64, ownerTestsSha256='6' * 64, dependencyPins=owner.PINS,
                    maxSeconds=10, expiresUnix=time.time() + 10, controlDirectory=str(self.root / 'NATIVE_INVENTORY_OWNER_BAD'),
                    mappingReview=dict(self.record('MAPPING_REVIEW.md'), sourceEvidenceSha256=self.approval['sourceEvidenceSha256'],
                        sourceMappingsSha256=hashlib.sha256(owner.canonical(self.approval['sourceMappings'])).hexdigest(),
                        publicCodeIdentifiersQualified=True))
        for mode in ['private_hook', 'unqualified_selector', 'wrong_source_map', 'expired', 'self_review']:
            a = copy.deepcopy(base)
            if mode == 'private_hook':
                a['hookSelection']['hooks'] = [CANARY]
            elif mode == 'unqualified_selector':
                a['hookSelection']['closedReachableHookNamesQualified'] = False
            elif mode == 'wrong_source_map':
                a['sourceMappings'][0]['sha256'] = '9' * 64
            elif mode == 'expired':
                a['expiresUnix'] = time.time() - 1
            else:
                a['independentReviewer'] = owner.OWNER
            ap = self.write('BAD_APPROVAL.json', a)
            rp = self.write('BAD_READ.json', dict(self.record('OWNER_READ_REVIEW.md'), schema='ir.native.inventory_owner.read_admission.v1',
                approvalSha256=owner.digest(ap), maxSeconds=10, expiresUnix=time.time() + 10))
            with patch.object(owner, 'check_pins'):
                with self.assertRaises(owner.Stop):
                    owner.qualify(ap, rp)
            self.assertFalse((self.root / 'NATIVE_INVENTORY_OWNER_BAD').exists())

    def test_watchdog_launch_and_join_errors_are_private_and_no_wrapper_load(self):
        fd, _ = self.pipe()
        with patch.object(owner.PrivateInventory, 'arm', side_effect=OSError(CANARY)), patch.object(owner, 'load_wrapper') as load:
            with self.assertRaises(owner.Stop) as error:
                owner.run(self.approval, time.monotonic() + 1, fd, Mock())
        load.assert_not_called()
        self.assertNotIn(CANARY, str(error.exception))
        store = owner.PrivateInventory(time.monotonic() + 1)
        store.worker = Mock(ident=1)
        store.worker.join.side_effect = RuntimeError(CANARY)
        with self.assertRaises(owner.Stop) as error:
            store.close()
        self.assertNotIn(CANARY, str(error.exception))

    def test_phase_paths_are_distinct_one_use_and_remaining_deadline_bound(self):
        paths, a, binding = self.controls('auth_inventory', 'INV')
        store = owner.PrivateInventory(time.monotonic() + 3)
        used = set()
        owner.phase_controls(paths, 'auth_inventory', store, used)
        with self.assertRaises(owner.Stop):
            owner.phase_controls(paths, 'auth_inventory', store, used)
        with self.assertRaises(owner.Stop):
            owner.phase_controls(paths, 'auth', store, set())
        short = owner.PrivateInventory(time.monotonic() + .05)
        with self.assertRaises(owner.Stop):
            owner.phase_controls(paths, 'auth_inventory', short, set())
        store.close()
        short.close()

    def test_release_deferred_clears_private_no_facts_no_auth(self):
        self.private = self.inventory()
        self.controls('auth_inventory', 'INV')
        fd, _ = self.pipe(self.pair_bytes())
        wrapper, calls = self.fake_wrapper(release='RELEASE_DEFERRED')
        published = []
        with patch.object(owner, 'load_wrapper', return_value=wrapper), patch.object(owner, 'check_pins'):
            with self.assertRaises(owner.Stop) as error:
                owner.run(self.approval, time.monotonic() + 3, fd, published.append)
        self.assertEqual(calls, ['auth_inventory'])
        self.assertFalse(self.private)
        self.assertFalse(published)
        self.assertNotIn(CANARY, str(error.exception))

    def test_complete_retained_sequence_auth_newer_controls_and_clear_before_auth(self):
        self.private = self.inventory()
        paths, first, binding = self.controls('auth_inventory', 'INV')
        fd, writer = self.pipe(self.pair_bytes())
        wrapper, calls = self.fake_wrapper()
        published = []
        observed = {}
        def publish(value):
            published.append(value)
            if value['phase'] == 'auth_inventory':
                observed['releasedUnix'] = value['inventoryReleasedUnix']
            if value['phase'] == 'inventory_facts':
                self.assertTrue(self.private)
                q = self.auth_qualification(value, binding, observed['releasedUnix'])
                self.controls('auth', 'AUTH', {'reachableHooks': q})
                os.write(writer, self.pair_bytes('AUTH_APPROVAL.json', 'AUTH_READ.json'))
        with patch.object(owner, 'load_wrapper', return_value=wrapper), patch.object(owner, 'check_pins'):
            self.assertTrue(owner.run(self.approval, time.monotonic() + 3, fd, publish))
        self.assertEqual(calls, ['auth_inventory', 'auth'])
        self.assertFalse(self.private)
        self.assertNotIn(CANARY, owner.canonical(published).decode())
        for path in self.root.rglob('*'):
            if path.is_file():
                self.assertNotIn(CANARY, path.read_text())

    def test_unknown_semantics_old_review_wrong_binding_and_unreleased_provider_refuse_auth(self):
        self.private = self.inventory()
        store = owner.PrivateInventory(time.monotonic() + 1)
        store.retain(self.private)
        facts = owner.selected_facts(store, self.approval)
        binding = '7' * 64
        reviewed_after = time.time() - .01
        q = self.auth_qualification(facts, binding, reviewed_after)
        _, a, _ = self.controls('auth', 'AUTH', {'reachableHooks': q})
        fact_hash = hashlib.sha256(owner.canonical(facts)).hexdigest()
        owner.auth_semantics(a, binding, fact_hash, facts, reviewed_after)
        for delta in [{'ownerReviewedUnix': reviewed_after - 1}, {'inventoryBindingSha256': '8' * 64},
                      {'reachableEffectsQualified': False}, {'ownerFactsSha256': '9' * 64},
                      {'independentReviewer': owner.BUILDER}]:
            changed = copy.deepcopy(a)
            changed['spec']['qualifications']['reachableHooks'].update(delta)
            with self.assertRaises(owner.Stop):
                owner.auth_semantics(changed, binding, fact_hash, facts, reviewed_after)
        changed = copy.deepcopy(a)
        changed['spec']['qualifications']['reachableHooks']['inventoryProviderClear']['released'] = False
        with self.assertRaises(owner.Stop):
            owner.auth_semantics(changed, binding, fact_hash, facts, reviewed_after)
        unknown = dict(facts, unresolved=[{'hook': 'user_register', 'sha256': '1' * 64, 'reason': 'closure', 'count': 1}])
        with self.assertRaises(owner.Stop):
            owner.auth_semantics(a, binding, fact_hash, unknown, reviewed_after)
        store.close()

    def test_exact_update_extends_facts_preserves_inventory_deadline_and_consumes_once(self):
        closure = 'closure:/private/' + CANARY + '.php:123'
        private = self.inventory(self.inventory()['callbacks'] + [
            ['user_register', 1, closure, 1, self.source_sha],
            ['authenticate', 1, 'new_public_function', 1, '4' * 64]])
        store = owner.PrivateInventory(time.monotonic() + 3)
        store.retain(private)
        facts = owner.selected_facts(store, self.approval)
        old_hash = hashlib.sha256(owner.canonical(facts)).hexdigest()
        binding, released = '7' * 64, time.time() - .01
        paths, update = self.update_controls(facts, binding, released, [self.closure_descriptor(closure)])
        used, deadline = set(), store.deadline
        next_facts, directory, seals = owner.classification_update(paths, store, used, self.approval, facts, binding, released, set())
        self.assertEqual(store.deadline, deadline)
        self.assertEqual(old_hash, hashlib.sha256(owner.canonical(facts)).hexdigest())
        self.assertTrue(private)
        self.assertFalse(next_facts['unresolved'])
        self.assertEqual(len(next_facts['facts']), 4)
        self.assertEqual(next_facts['inventorySha256'], facts['inventorySha256'])
        self.assertEqual(next_facts['classificationChain']['previousFactsSha256'], old_hash)
        self.assertTrue(all(owner.digest(p) == h for p, h in seals))
        self.assertTrue((directory / 'CONSUMED.json').is_file())
        self.private = private
        q = self.auth_qualification(next_facts, binding, released)
        _, auth, _ = self.controls('auth', 'FINAL', {'reachableHooks': q})
        owner.auth_semantics(auth, binding, hashlib.sha256(owner.canonical(next_facts)).hexdigest(), next_facts, released)
        q['ownerReviewedUnix'] = released
        with self.assertRaises(owner.Stop):
            owner.auth_semantics(auth, binding, hashlib.sha256(owner.canonical(next_facts)).hexdigest(), next_facts, released)
        with self.assertRaises(owner.Stop):
            owner.classification_update(paths, store, used, self.approval, facts, binding, released, set())
        with self.assertRaises(owner.Stop):
            owner.classification_update(paths, store, set(), self.approval, facts, binding, released, set())
        text = owner.canonical([facts, next_facts]).decode()
        self.assertNotIn(CANARY, text)
        self.assertNotIn('/private/', text)
        store.close()
        self.assertFalse(private)

    def test_update_bad_seals_bindings_private_descriptors_and_expiry_stop_before_consumption(self):
        store = owner.PrivateInventory(time.monotonic() + 10)
        store.retain(self.inventory())
        facts = owner.selected_facts(store, self.approval)
        binding, released = '7' * 64, time.time() - .01
        _, good = self.update_controls(facts, binding, released, [self.closure_descriptor()])
        modes = ['inventory', 'binding', 'previous', 'source', 'mapping', 'selector', 'old_review', 'expired',
                 'self_review', 'unqualified_mapping', 'unqualified_closure', 'ambiguous_review', 'bad_line',
                 'private_role', 'raw_identifier', 'changed_old_map', 'unknown_key', 'used_directory', 'bad_read']
        for mode in modes:
            with self.subTest(mode=mode):
                update = copy.deepcopy(good)
                if mode in {'inventory', 'binding', 'previous', 'source', 'mapping', 'selector'}:
                    key = {'inventory': 'inventorySha256', 'binding': 'inventoryBindingSha256', 'previous': 'previousFactsSha256',
                           'source': 'ownerSourceEvidenceSha256', 'mapping': 'ownerSourceMappingsSha256',
                           'selector': 'ownerHookSelectionSha256'}[mode]
                    update[key] = '9' * 64
                elif mode == 'old_review': update['reviewedUnix'] = released - 1
                elif mode == 'expired': update['expiresUnix'] = time.time() - 1
                elif mode == 'self_review': update['independentReviewer'] = owner.DELTA_BUILDER
                elif mode == 'unqualified_mapping': update['mappingReview']['publicCodeIdentifiersQualified'] = False
                elif mode == 'unqualified_closure': update['closureReview']['selectedClosureDescriptorsQualified'] = False
                elif mode == 'ambiguous_review': update['closureReview']['unambiguousSourceClosuresQualified'] = False
                elif mode == 'bad_line': update['closureDescriptors'][0]['line'] = True
                elif mode == 'private_role': update['closureDescriptors'][0]['role'] = '/private/' + CANARY + '.php'
                elif mode == 'raw_identifier': update['closureDescriptors'][0]['identifier'] = CANARY
                elif mode == 'changed_old_map': update['sourceMappings'][0]['functions'] = []
                elif mode == 'unknown_key': update['extra'] = CANARY
                ap = self.write('UPDATE_APPROVAL.json', update)
                rp = self.update_read(ap)
                if mode == 'bad_read':
                    value = owner.public_json(rp)
                    value['approvalSha256'] = '9' * 64
                    self.write('UPDATE_READ.json', value)
                forbidden = {Path(update['controlDirectory'])} if mode == 'used_directory' else set()
                with self.assertRaises(owner.Stop):
                    owner.classification_update((ap, rp), store, set(), self.approval, facts, binding, released, forbidden)
                self.assertFalse(Path(update['controlDirectory']).exists())
        store.close()

    def test_ambiguous_or_nonmatching_closures_remain_unresolved(self):
        closure = 'closure:/private/' + CANARY + '.php:123'
        for mode in ('duplicate', 'different_path_same_line', 'wrong_identifier', 'wrong_line'):
            with self.subTest(mode=mode):
                rows = [['user_register', 1, closure, 1, self.source_sha]]
                descriptor = self.closure_descriptor(closure)
                if mode == 'duplicate': rows.append(list(rows[0]))
                elif mode == 'different_path_same_line': rows.append(['authenticate', 1, 'closure:/other/path.php:123', 1, self.source_sha])
                elif mode == 'wrong_identifier': descriptor['identifierSha256'] = '9' * 64
                else: descriptor['line'] = 124
                store = owner.PrivateInventory(time.monotonic() + 3)
                store.retain(self.inventory(rows))
                facts = owner.selected_facts(store, dict(self.approval, closureDescriptors=[descriptor], classificationChain={}))
                self.assertTrue(facts['unresolved'])
                self.assertFalse(facts['facts'])
                self.assertNotIn(CANARY, owner.canonical(facts).decode())
                store.close()

    def test_update_cannot_use_expired_custody_or_extend_deadline(self):
        private = self.inventory()
        store = owner.PrivateInventory(time.monotonic() + .15)
        store.retain(private)
        facts = owner.selected_facts(store, self.approval)
        released = time.time() - .01
        paths, _ = self.update_controls(facts, '7' * 64, released)
        with self.assertRaises(owner.Stop):
            owner.classification_update(paths, store, set(), self.approval, facts, '7' * 64, released, set())
        store.arm()
        store.worker.join(.4)
        self.assertFalse(private)
        with self.assertRaises(owner.Stop):
            owner.classification_update(paths, store, set(), self.approval, facts, '7' * 64, released, set())
        store.close()

    def test_retained_update_flow_no_rerun_or_invocation_final_auth_chain_and_drift_gates(self):
        for mode in ('success', 'old_chain', 'source_drift', 'report_drift', 'second_update'):
            with self.subTest(mode=mode):
                # Each case gets its own directory, receipts and immutable original facts.
                with tempfile.TemporaryDirectory(dir=self.root) as case:
                    case_root = Path(case)
                    with patch.object(owner, 'HERE', case_root):
                        for p in self.root.iterdir():
                            if p.is_file(): (case_root / p.name).write_bytes(p.read_bytes())
                        saved_root = self.root
                        self.root = case_root
                        try:
                            closure = 'closure:/private/' + CANARY + '.php:123'
                            self.private = self.inventory(self.inventory()['callbacks'] + [
                                ['user_register', 1, closure, 1, self.source_sha],
                                ['authenticate', 1, 'new_public_function', 1, '4' * 64]])
                            _, first, binding = self.controls('auth_inventory', 'INV')
                            fd, writer = self.pipe(self.pair_bytes())
                            wrapper, calls = self.fake_wrapper()
                            published, observed = [], {}
                            def publish(value):
                                published.append(value)
                                if value['phase'] == 'auth_inventory': observed['released'] = value['inventoryReleasedUnix']
                                elif value['phase'] == 'inventory_facts' and 'classificationChain' not in value:
                                    self.update_controls(value, binding, observed['released'], [self.closure_descriptor(closure)])
                                    os.write(writer, self.pair_bytes('UPDATE_APPROVAL.json', 'UPDATE_READ.json'))
                                elif value['phase'] == 'inventory_facts':
                                    q = self.auth_qualification(value, binding, observed['released'])
                                    if mode == 'old_chain': q['ownerClassificationChainSha256'] = '9' * 64
                                    if mode == 'source_drift': (self.root / 'UPDATE_SOURCE.json').write_text('{}')
                                    if mode == 'report_drift': (self.root / 'UPDATE_CLOSURE_REVIEW.md').write_text('drift')
                                    self.controls('auth', 'AUTH', {'reachableHooks': q})
                                    names = ('UPDATE_APPROVAL.json', 'UPDATE_READ.json') if mode == 'second_update' else ('AUTH_APPROVAL.json', 'AUTH_READ.json')
                                    os.write(writer, self.pair_bytes(*names))
                            with patch.object(owner, 'load_wrapper', return_value=wrapper), patch.object(owner, 'check_pins'):
                                if mode == 'success':
                                    self.assertTrue(owner.run(self.approval, time.monotonic() + 5, fd, publish))
                                else:
                                    with self.assertRaises(owner.Stop): owner.run(self.approval, time.monotonic() + 5, fd, publish)
                            self.assertEqual(calls, ['auth_inventory', 'auth'] if mode == 'success' else ['auth_inventory'])
                            self.assertFalse(self.private)
                            self.assertNotIn(CANARY, owner.canonical(published).decode())
                            for p in self.root.rglob('*'):
                                if p.is_file(): self.assertNotIn(CANARY, p.read_text())
                        finally: self.root = saved_root

    def test_concretely_reachable_cache_and_login_hooks_in_selector_ceiling(self):
        self.assertTrue({'illegal_user_logins', 'sanitize_title', 'clean_user_cache', 'auth_cookie_expiration',
            'session_token_manager', 'attach_session_information', 'random_password', 'nonce_life', 'nonce_user_logged_out',
            'wp_verify_nonce_failed', 'salt', 'woocommerce_process_login_errors', 'woocommerce_login_credentials',
            'woocommerce_login_redirect', 'login_errors', 'woocommerce_login_failed', 'wp_hash_password_algorithm',
            'wp_hash_password_options'} <= owner.STANDARD_HOOKS)

    def test_actual_core_report_23_additions_select_exactly_and_unknown_callbacks_remain_unresolved(self):
        additions = '''allowed_redirect_hosts logout_url password_needs_rehash rest_allowed_cors_headers
rest_dispatch_request rest_enabled rest_endpoints rest_exposed_cors_headers rest_json_encode_options
rest_jsonp_enabled rest_pre_echo_response rest_request_parameter_order rest_send_nocache_headers
rest_url rest_url_prefix sanitize_key secure_signon_cookie set_current_user
woocommerce_logout_default_redirect_url wp_redirect wp_redirect_status wp_safe_redirect_fallback x_redirect_by'''.split()
        self.assertEqual(len(additions), 23)
        self.assertEqual(len(owner.STANDARD_HOOKS), 139)
        self.assertEqual(hashlib.sha256(owner.canonical(sorted(owner.STANDARD_HOOKS))).hexdigest(),
                         '005887497738cd12c6c07c9f3ae33f9bf0574cd3dc4b00c9fc106aa5e125518d')
        approved = dict(self.approval, hookSelection=dict(self.approval['hookSelection'], hooks=additions))
        rows = [[tag, 1, 'safe_func', 1, self.source_sha] for tag in additions]
        rows += [[tag, 1, CANARY, 1, self.source_sha] for tag in additions]
        rows += [['rest_endpoints', 1, CANARY, 1, '4' * 64], [CANARY, 1, CANARY, 1, '4' * 64]]
        private = self.inventory(rows)
        store = owner.PrivateInventory(time.monotonic() + 3)
        store.retain(private)
        deadline = store.deadline
        facts = owner.selected_facts(store, approved)
        self.assertEqual({f['hook'] for f in facts['facts']}, set(additions))
        self.assertEqual(len(facts['facts']), 23)
        self.assertEqual({f['hook'] for f in facts['unresolved']}, set(additions))
        self.assertEqual({f['reason'] for f in facts['unresolved']}, {'unmapped_callable', 'unmapped_source'})
        self.assertEqual(store.deadline, deadline)
        self.assertTrue(private)
        self.assertNotIn(CANARY, owner.canonical(facts).decode())
        self.assertEqual(facts['result'], 'FACTS_ONLY')
        store.close()
        self.assertFalse(private)

    def test_closed_dynamic_family_variants_private_tags_and_callbacks_never_publish(self):
        rows = [[tag, 1, 'safe_func' if i < 2 else CANARY, 1, self.source_sha] for i, tag in enumerate([
            'sanitize_user_meta_' + CANARY, 'sanitize_user_meta_' + CANARY + '_for_user',
            'sanitize_user_meta_other_' + CANARY + '_for_user'])]
        store = owner.PrivateInventory(time.monotonic() + 3)
        store.retain(self.inventory(rows))
        with self.assertRaises(owner.Stop): owner.selected_facts(store, self.approval)
        approved = dict(self.approval, hookSelection=dict(self.approval['hookSelection'],
            hookFamilies=['sanitize_user_meta'], closedDynamicHookFamiliesQualified=True))
        facts = owner.selected_facts(store, approved)
        self.assertEqual({f['hook'] for f in facts['facts'] + facts['unresolved']}, {'sanitize_user_meta_*'})
        self.assertEqual(facts['unresolved'][0]['reason'], 'unmapped_callable')
        self.assertEqual(facts['unresolved'][0]['count'], 1)
        self.assertNotIn(CANARY, owner.canonical(facts).decode())
        for delta in [{'hookFamilies': [CANARY]}, {'hookFamilies': ['sanitize_user_meta'], 'closedDynamicHookFamiliesQualified': False},
                      {'hookFamilies': []}, {'closedDynamicHookFamiliesQualified': True}]:
            bad = dict(self.approval, hookSelection=dict(self.approval['hookSelection'], **delta))
            with self.assertRaises(owner.Stop): owner.selected_facts(store, bad)
        store.close()

    def test_update_preserves_closed_family_selector_and_unknowns_remain_unresolved(self):
        selection = dict(self.approval['hookSelection'], hookFamilies=['sanitize_user_meta'], closedDynamicHookFamiliesQualified=True)
        self.approval = dict(self.approval, hookSelection=selection)
        closure = 'closure:/private/' + CANARY + '.php:123'
        rows = [['sanitize_user_meta_' + CANARY + '_for_user', 1, closure, 1, self.source_sha],
                ['sanitize_user_meta_other_' + CANARY, 1, CANARY, 1, self.source_sha]]
        store = owner.PrivateInventory(time.monotonic() + 3)
        store.retain(self.inventory(rows))
        facts = owner.selected_facts(store, self.approval)
        descriptor = dict(self.closure_descriptor(closure), hook='sanitize_user_meta_*')
        released, binding = time.time() - .01, '7' * 64
        paths, _ = self.update_controls(facts, binding, released, [descriptor])
        next_facts, _, _ = owner.classification_update(paths, store, set(), self.approval, facts, binding, released, set())
        self.assertEqual(next_facts['hookSelectionSha256'], facts['hookSelectionSha256'])
        self.assertEqual(next_facts['facts'][0]['hook'], 'sanitize_user_meta_*')
        self.assertEqual(next_facts['facts'][0]['type'], 'closure')
        self.assertTrue(next_facts['unresolved'])
        self.assertNotIn(CANARY, owner.canonical(next_facts).decode())
        store.close()


if __name__ == '__main__':
    unittest.main()
