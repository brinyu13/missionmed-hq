"""Fixture-only admission/document race checks; no provider or credential calls."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
import register_phase1 as registrar
import run_authenticated_registration as wrapper

OLD_ARTIFACTS = ('REGISTRY_ADMISSION_APPROVAL.json', 'NORMAL_REGISTRY_ADMISSION_REVIEW.md',
                 'REGISTRY_STAGED_CANDIDATE.json', 'REGISTRY_STAGED_APPROVAL.json',
                 'REGISTRY_CUSTODY_RECEIPT.json')


class SealingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.here = Path(self.temp.name)
        for name in registrar.INITIAL_SOURCE_NAMES:
            text = 'fixture ' + name + '\n'
            if name == registrar.DOCUMENT_NAMES[0]:
                text += 'APPROVE WITH CONDITIONS\ncurrent supersession: fictional fixture\n'
            if name == 'PHASE1_REGISTRATION_REQUEST.md':
                text += '## Continuation and prospective exact execution contract\nfixture contract\n'
            (self.here / name).write_text(text)
        for name in OLD_ARTIFACTS:
            (self.here / name).write_bytes(b'old frozen fixture\r\n')
        self.old_hashes = {name: registrar.digest(self.here / name) for name in OLD_ARTIFACTS}
        self.sources = wrapper.initial_capture(self.here)
        self.authenticated_at = 1
        self.write_admission()
        self.evidence = registrar.capture_evidence(self.here)
        self.expected = {name: item.sha256 for name, item in self.evidence.items()}
        self.refresh = Mock()
        self.begin = Mock(side_effect=AssertionError('fixture must never acquire Registry'))
        self.client_factory = Mock(return_value=object())
        self.canonical = types.SimpleNamespace(
            refresh_canonical=self.refresh, canonical_decision_numbers=lambda _: {374},
            MissionRegistryRegistrar=Mock(return_value=types.SimpleNamespace(begin=self.begin)))
        self.lease = types.SimpleNamespace(SupabaseLeaseClient=object)

    def write_admission(self, **changes):
        report = self.here / registrar.NORMAL_REVIEW_NAME
        report.write_text('APPROVE NORMAL REGISTRY ACQUISITION AND EXACT CANDIDATE STAGING ONLY\nfixture report\n')
        approved = {'schema': 'missionmed.ir.registry.admission.r2.v1', 'verdict': 'APPROVE',
                    'reviewer': 'phase1_registration_contract_review', 'sources': self.sources,
                    'normalReviewSha256': registrar.digest(report)}
        approved.update(changes)
        (self.here / registrar.ADMISSION_NAME).write_text(json.dumps(approved))

    def call_main(self):
        with patch.object(registrar, 'HANDOFF', self.here), \
             patch.object(registrar, 'ROOT', self.here / 'canonical-fixture'), \
             patch.object(sys, 'argv', ['fixture', '--execute']), \
             patch.dict(sys.modules, {'mission_registry_registrar': self.canonical,
                                      'engineering_os_lease': self.lease}):
            registrar.main(expected_evidence_hashes=self.expected,
                           initial_sources=self.sources, client_factory=self.client_factory)

    def assert_no_acquisition(self):
        self.begin.assert_not_called()
        self.canonical.MissionRegistryRegistrar.assert_not_called()

    def test_each_initial_document_change_fails_before_registry_rpc(self):
        for name in registrar.DOCUMENT_NAMES:
            with self.subTest(document=name):
                path = self.here / name
                original = path.read_bytes()
                path.write_bytes(original + b'late addendum\n')
                with self.assertRaises(RuntimeError):
                    self.call_main()
                self.refresh.assert_not_called()
                self.client_factory.assert_not_called()
                self.assert_no_acquisition()
                path.write_bytes(original)

    def test_report_digest_mismatch_fails_before_registry_rpc(self):
        self.write_admission(normalReviewSha256='0' * 64)
        self.evidence = registrar.capture_evidence(self.here)
        self.expected = {name: item.sha256 for name, item in self.evidence.items()}
        with self.assertRaisesRegex(RuntimeError, 'independent admission'):
            self.call_main()
        self.refresh.assert_not_called()
        self.assert_no_acquisition()

    def test_late_normal_report_change_fails_before_registry_rpc(self):
        (self.here / registrar.NORMAL_REVIEW_NAME).write_text('late changed report\n')
        with self.assertRaisesRegex(RuntimeError, 'immutable evidence digest mismatch'):
            self.call_main()
        self.refresh.assert_not_called()
        self.client_factory.assert_not_called()
        self.assert_no_acquisition()

    def test_initial_source_mismatch_fails_before_registry_rpc(self):
        changed = dict(self.sources)
        changed['register_phase1.py'] = '0' * 64
        self.write_admission(sources=changed)
        self.evidence = registrar.capture_evidence(self.here)
        self.expected = {name: item.sha256 for name, item in self.evidence.items()}
        with self.assertRaisesRegex(RuntimeError, 'independent admission'):
            self.call_main()
        self.refresh.assert_not_called()
        self.assert_no_acquisition()

    def test_late_document_change_during_refresh_fails_before_keeper(self):
        path = self.here / 'MATRIX_LINEAGE_REVIEW.md'
        self.refresh.side_effect = lambda _: path.write_text('late fixture mutation\n')
        with self.assertRaisesRegex(RuntimeError, 'initial source evidence changed'):
            self.call_main()
        self.refresh.assert_called_once()
        self.assert_no_acquisition()

    def test_snapshot_hash_and_copy_share_immutable_bytes(self):
        copied = registrar.copied_evidence(self.evidence)
        for name, item in self.evidence.items():
            self.assertEqual(hashlib.sha256(item.data).hexdigest(), item.sha256)
            self.assertIn('SHA256 ' + item.sha256 + '\n\n' + item.data.decode('utf-8'), copied)
        (self.here / registrar.DOCUMENT_NAMES[0]).write_text('late different content\n')
        self.assertEqual(copied, registrar.copied_evidence(self.evidence))
        with self.assertRaisesRegex(RuntimeError, 'sealed admission evidence changed'):
            registrar.assert_evidence_current(self.evidence, self.here)

    def test_after_auth_report_and_json_validate_and_old_artifacts_stay_frozen(self):
        self.assertEqual(wrapper.validate_admission(self.sources, self.authenticated_at, self.here), self.expected)
        self.assertTrue(all(name.endswith('_R2.json') or name.endswith('_R2.md')
                            for name in registrar.R2_ARTIFACT_NAMES))
        self.assertTrue(registrar.ROOT.name.endswith('-R2'))
        self.assertEqual(self.old_hashes, {name: registrar.digest(self.here / name) for name in OLD_ARTIFACTS})

    def test_pre_auth_report_fails_closed(self):
        report = self.here / registrar.NORMAL_REVIEW_NAME
        os.utime(report, ns=(1, 1))
        with self.assertRaisesRegex(RuntimeError, 'predates authentication'):
            wrapper.validate_admission(self.sources, self.authenticated_at, self.here)
        self.assert_no_acquisition()

    def test_initial_capture_rejects_existing_r2_artifact_without_credentials(self):
        with patch.object(wrapper.transport, 'retrieve_existing_key', side_effect=AssertionError('no credential reads')) as read:
            with self.assertRaisesRegex(RuntimeError, 'pre-existing R2'):
                wrapper.initial_capture(self.here)
            read.assert_not_called()
        self.assertEqual(self.old_hashes, {name: registrar.digest(self.here / name) for name in OLD_ARTIFACTS})


if __name__ == '__main__':
    unittest.main()
