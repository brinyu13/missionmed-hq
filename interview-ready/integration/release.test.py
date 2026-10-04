"""Focused reproducible local package gates; temporary source fixture, no runtime calls."""
from pathlib import Path
import hashlib, importlib.util, json, shutil, subprocess, sys, tarfile, tempfile, unittest
from unittest import mock
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ir_release', HERE/'release.py')
release = importlib.util.module_from_spec(spec); spec.loader.exec_module(release)
REAL_ROOT = release.ROOT


class PackageFixtures(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ir-release-qa-')
        self.base = Path(self.temp.name).resolve()
        self.repo = self.base/'source'; self.root = self.repo/'interview-ready'
        self.root.mkdir(parents=True)
        inputs = ['src.html','editorial.css','editorial.js','catalog.json','completion.css','completion.js','fashion.json','phase1.json','phase1.css','phase1.js','production-assets.json','account.js','integration/missionmed-interview-ready.php','integration/matrix-entry.js','integration/release.py','build.py']
        assets = json.loads((REAL_ROOT/'production-assets.json').read_text())['assets']
        for name in inputs + [asset['path'] for asset in assets]:
            target=self.root/name; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(REAL_ROOT/name,target)
        self.git('init','-q');self.git('add','interview-ready');self.git('-c','user.name=IR local fixture','-c','user.email=ir@fictional.example','commit','-qm','fixture')
        self.patch = mock.patch.multiple(release,ROOT=self.root,REPOSITORY=self.repo);self.patch.start()

    def tearDown(self): self.patch.stop();self.temp.cleanup()
    def git(self,*args): return subprocess.run(['git','-C',str(self.repo),*args],check=True,capture_output=True)
    def expect_failure(self,name,pattern):
        with self.assertRaisesRegex((ValueError,AssertionError),pattern): release.prepare(self.base/name)
        self.assertFalse((self.base/name).exists())

    def test_deterministic_committed_package_and_exact_mappings(self):
        first=release.prepare(self.base/'one');second=release.prepare(self.base/'two')
        self.assertEqual(first,second);self.assertEqual(first['sourceState'],'EXACT_COMMITTED_INPUTS');self.assertFalse(first['productionApproved'])
        archive=self.base/'one/interview-ready-candidate.tar.gz'
        self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),first['archiveSha256'])
        manifest=json.loads((self.base/'one/release-manifest.json').read_text())
        self.assertEqual(len(manifest['artifacts']),5)
        with tarfile.open(archive) as bundle:
            self.assertEqual(set(bundle.getnames()),set(manifest['artifacts'])|{'release-manifest.json','release-plan.json'})
            for name,details in manifest['artifacts'].items():
                value=bundle.extractfile(name).read();self.assertEqual(hashlib.sha256(value).hexdigest(),details['sha256']);self.assertEqual(len(value),details['bytes'])
                self.assertEqual(bundle.getmember(name).mtime,0)
            htmlpath=next(name for name in manifest['artifacts'] if name.endswith('/interview-ready.html'))
            html=bundle.extractfile(htmlpath).read()
            self.assertEqual(hashlib.sha256(html).hexdigest(),manifest['htmlSha256'])
            self.assertIn(manifest['htmlSha256'],htmlpath)
            self.assertEqual(bundle.extractfile('wp-content/mu-plugins/missionmed-interview-ready.php').read(),(self.root/'integration/missionmed-interview-ready.php').read_bytes())
        plan=json.loads((self.base/'one/release-plan.json').read_text());self.assertFalse(plan['executable']);self.assertFalse(plan['productionApproval'])
        self.assertIn('_mmed_ir_state_v1',plan['rollback']);self.assertIn('matrix-entry.js',manifest['sourceMappings'])

    def test_uncommitted_candidate_is_explicit_and_default_blocks(self):
        p=self.root/'integration/matrix-entry.js';p.write_text(p.read_text()+'\n/* local draft */\n')
        self.expect_failure('blocked','Exact committed inputs required')
        receipt=release.prepare(self.base/'candidate',candidate_working_tree=True)
        self.assertEqual(receipt['sourceState'],'UNCOMMITTED_LOCAL_CANDIDATE_REPACK_FROM_COMMIT_REQUIRED')
        manifest=json.loads((self.base/'candidate/release-manifest.json').read_text())
        self.assertIn('integration/matrix-entry.js',manifest['uncommittedInputs'])
        self.assertFalse(manifest['productionApproved'])
        with self.assertRaisesRegex(ValueError,'reference unavailable'): release.prepare(self.base/'bad-ref','nonexistent',True)

    def test_allowlist_and_required_marker_fail_closed(self):
        path=self.root/'img/hero-online-photo.webp';path.write_bytes(path.read_bytes()+b'drift')
        self.expect_failure('asset-drift','Approved media changed')
        shutil.copyfile(REAL_ROOT/'img/hero-online-photo.webp',path)
        source=self.root/'src.html';source.write_text(source.read_text().replace('<!-- EDITORIAL_SCRIPTS -->',''))
        self.expect_failure('marker-missing','Unbundled|marker|seams')

    def test_symlink_collision_and_input_drift_are_denied(self):
        p=self.root/'integration/matrix-entry.js';p.unlink();p.symlink_to(REAL_ROOT/'integration/matrix-entry.js')
        self.expect_failure('symlink','symlink|Symlink')
        p.unlink();shutil.copyfile(REAL_ROOT/'integration/matrix-entry.js',p)
        output=self.base/'collision';output.mkdir()
        with self.assertRaisesRegex(ValueError,'collision'): release.prepare(output)
        # Source read/commit comparison cannot accept a mismatched gateway even if rendering succeeds.
        p=self.root/'integration/missionmed-interview-ready.php';p.write_text(p.read_text()+'\n/* drift */\n')
        self.expect_failure('source-drift','Exact committed inputs required')

    def test_production_approval_guard_and_original_source_preservation(self):
        before={str(p.relative_to(self.root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.rglob('*') if p.is_file()}
        release.prepare(self.base/'candidate')
        after={str(p.relative_to(self.root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before,after)
        result=subprocess.run([sys.executable,'-B',str(self.root/'build.py'),'--production','--output-dir',str(self.base/'production')],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('Production build blocked',result.stderr);self.assertFalse((self.base/'production').exists())
        phase=self.root/'phase1.json';state=json.loads(phase.read_text());state['releaseState']='production-approved';phase.write_text(json.dumps(state))
        self.expect_failure('false-approval','candidates only')


if __name__ == '__main__': unittest.main(verbosity=1)
