import ast,copy,hashlib,importlib.util,io,json,sys,tarfile,unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parent

def load(name,file):
    s=importlib.util.spec_from_file_location(name,HERE/file);m=importlib.util.module_from_spec(s);sys.modules[name]=m;s.loader.exec_module(m);return m
runner=load('commerce_runner_pure_fixture','commerce_runtime_runner.py')
manual=load('commerce_manual_pure_fixture','commerce_manual_operations.py')

def nodes(file):
    t=ast.parse((HERE/file).read_bytes());return {n.name:n for n in t.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}

class Preparation(unittest.TestCase):
    def test_exact_package_archive_metadata_and_unchanged_gateways(self):
        for name,digest in manual.PACKAGE_FILES.items():self.assertEqual(manual.digest(manual.PACKAGE/name),digest)
        self.assertEqual((manual.PACKAGE/'interview-ready-candidate.tar.gz').stat().st_size,1034072)
        self.assertEqual(manual.PACKAGE_FILES['interview-ready-candidate.tar.gz'],'f49c31b00623f6e3ad0c6ccb5e1bbb558b62289d5c661ae22804ae641843db4b')
        manifest=json.loads((manual.PACKAGE/'release-manifest.json').read_bytes());self.assertFalse(manifest['productionApproved']);self.assertEqual(manifest['sourceCommit'],manual.SOURCE)
        self.assertEqual(manual.PACKAGE_METADATA_BYTES,{'release-manifest.json':5752,'release-plan.json':1019})
        with tarfile.open(manual.PACKAGE/'interview-ready-candidate.tar.gz','r:gz') as archive:
            entries=archive.getmembers();self.assertEqual(len(entries),7)
            self.assertEqual({e.name for e in entries},set(manual.ARTIFACTS)|set(manual.PACKAGE_METADATA_BYTES))
            for e in entries:
                data=archive.extractfile(e).read();self.assertTrue(e.isfile())
                if e.name in manual.ARTIFACTS:self.assertEqual({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},manual.ARTIFACTS[e.name])
                else:self.assertEqual(data,(manual.PACKAGE/e.name).read_bytes())
        for k in ['gateway','matrix','gate']:self.assertEqual(manual.BINDINGS[k],manual.OLD_BINDINGS[k])
    def test_full_baseline_and_all_staged_retained_layouts(self):
        baseline=json.loads((HERE/'FINISH_NOW_20261005/COMMERCE_RUNTIME_BASELINE.json').read_bytes())
        self.assertEqual(manual.LAYOUTS['OLD'],baseline['layout']);self.assertEqual(manual.LAYOUT_DIGESTS['OLD'],baseline['layoutSha256'])
        self.assertEqual(manual.LAYOUT_DIGESTS['OLD'],'1d3d599cad977e5489932f2c3866abd721c7bb2a76959d6d066486415c7ac9e4')
        for state,value in manual.LAYOUTS.items():
            self.assertLessEqual(len(value),64)
            for name,record in baseline['layout'].items():
                if name in [manual.RUNTIME,manual.RUNTIME+'/releases',manual.RUNTIME+'/current']:continue
                self.assertEqual(value[name],record,(state,name))
            for record in value.values():
                if record['type']=='directory':self.assertLessEqual(len(record['children']),16)
        payload=manual.LAYOUTS['PAYLOAD'];prefix=manual.RUNTIME+'/'+manual.STAGE+'/payload/'
        self.assertEqual(payload[prefix+'release-manifest.json']['bytes'],5752)
        self.assertEqual(payload[prefix+'release-plan.json']['bytes'],1019)
        self.assertEqual(manual.LAYOUTS['UPGRADED'][manual.RUNTIME+'/current']['literal'],manual.POINTER)
        self.assertEqual(manual.LAYOUTS['UPGRADED'][manual.RUNTIME+'/'+manual.BACKUP_POINTER]['literal'],manual.OLD_POINTER)
        self.assertEqual(manual.LAYOUTS['RESTORED'][manual.RUNTIME+'/current']['literal'],manual.OLD_POINTER)
        self.assertEqual(manual.LAYOUTS['RESTORED'][manual.RUNTIME+'/'+manual.BACKUP_POINTER]['literal'],manual.POINTER)
        retained=baseline['layout'][manual.RUNTIME+'/releases']['children']
        self.assertEqual(set(manual.RELEASE_NAMES),set(retained)|{manual.HTML})
        self.assertNotIn('unqualified',manual.RELEASE_NAMES)
    def test_install_only_and_default_dormant_before_capability(self):
        self.assertEqual(set(runner.PHASE_PATHS),{'install'});self.assertEqual(set(runner.DOMAINS),{'install'})
        with patch.object(runner,'load_module',side_effect=AssertionError('capability')),redirect_stdout(io.StringIO()):
            self.assertEqual(runner.main([]),0)
            for phase in ['auth','auth_inventory']:
                self.assertEqual(runner.main(['--execute','--phase',phase]),1)
                with self.assertRaises(runner.Stop):runner.snapshot(phase,{})
                with self.assertRaises(runner.Stop):runner.execute(phase,HERE/'absent',HERE/'absent')
        with patch.object(manual,'load_runner',side_effect=AssertionError('execute')),redirect_stdout(io.StringIO()):self.assertEqual(manual.main([]),0)
    def test_local_actual_package_snapshot_and_bad_binding_fail_closed(self):
        spec={'sourceHead':runner.head(runner.ROOT),'sourceCommit':manual.SOURCE,'packageDirectory':str(manual.PACKAGE),
              'packageFiles':manual.PACKAGE_FILES,'runtimeBindings':manual.BINDINGS,'qualifiedPreimages':manual.QUALIFIED_PREIMAGES,
              'qualifications':{k:{'qualifiedPreimages':manual.QUALIFIED_PREIMAGES} for k in ['phaseDecision','recovery','runtimeReadback']},
              'controlDirectory':str(HERE/'COMMERCE_FIXTURE_ABSENT_CONTROL')}
        # Only independent report bytes are pending; fixture bypasses report_record,
        # never execution/credential/provider gates and issues no actual approval.
        with patch.object(runner,'report_record'):
            actual=runner.snapshot('install',spec);self.assertEqual(actual['osHead'],'fe17a4ca5572aecdc2d2761e8c2d993f7aebb8bf')
            self.assertEqual(actual['authority']['DR-391_ir_phase1_public_commerce_fallback.md'],'0ac4eace2f96ccfbc10864d7a022cba1eb0c6f9c4eeb0bb668dd342e3c532982')
            for field in ['packageFiles','runtimeBindings']:
                bad=copy.deepcopy(spec);bad[field][next(iter(bad[field]))]='0'*64
                with self.assertRaises(runner.Stop):runner.snapshot('install',bad)
    def test_wrapper_all_protocol_function_ast_preserved(self):
        a=nodes('runtime_native_runner.py');b=nodes('commerce_runtime_runner.py');self.assertEqual(a.keys(),b.keys())
        for name in a:
            n=copy.deepcopy(b[name])
            if name=='main':
                for v in ast.walk(n):
                    if isinstance(v,ast.Tuple) and len(v.elts)==1 and isinstance(v.elts[0],ast.Constant) and v.elts[0].value=='install':v.elts=[ast.Constant('install'),ast.Constant('auth'),ast.Constant('auth_inventory')]
            self.assertEqual(ast.dump(a[name]),ast.dump(n),name)
    def test_manual_ledger_io_guard_and_remote_ast_minimal_delta(self):
        a=nodes('manual_runtime_operations.py');b=nodes('commerce_manual_operations.py');self.assertEqual(a.keys(),b.keys())
        for name in a:
            n=copy.deepcopy(b[name])
            for v in ast.walk(n):
                if isinstance(v,ast.Constant) and v.value=='commerce_runtime_runner.py':v.value='runtime_native_runner.py'
                if isinstance(v,ast.Constant) and v.value=='COMMERCE_RUNTIME_UPGRADE_RECOVERY_PLAN.md':v.value='EXACT_RUNTIME_UPGRADE_RECOVERY_PLAN.md'
                if isinstance(v,ast.Tuple):v.elts=[e for e in v.elts if not(isinstance(e,ast.Constant) and e.value=='RELEASE_NAMES')]
            if name=='layout_profile':
                old=next(v.iter for v in ast.walk(a[name]) if isinstance(v,ast.For) and isinstance(v.target,ast.Tuple) and ast.dump(v.target)==ast.dump(ast.parse('for name,size in []:pass').body[0].target))
                for v in ast.walk(n):
                    if isinstance(v,ast.For) and isinstance(v.iter,ast.Call) and isinstance(v.iter.func,ast.Attribute) and isinstance(v.iter.func.value,ast.Name) and v.iter.func.value.id=='PACKAGE_METADATA_BYTES':v.iter=copy.deepcopy(old)
            self.assertEqual(ast.dump(a[name]),ast.dump(n),name)
        old=load('old_manual_pure_fixture','manual_runtime_operations.py')
        normalized=manual.REMOTE_SOURCE.replace('target.name in RELEASE_NAMES','target.name in (HTML,OLD_HTML)')
        self.assertEqual(normalized,old.REMOTE_SOURCE)
        self.assertEqual(manual.CACHE_FORMS,old.CACHE_FORMS);self.assertEqual(manual.CACHE_VENDOR,old.CACHE_VENDOR)
        self.assertEqual(manual.PHASES,old.PHASES)
        self.assertEqual(manual.RUNNER_SHA,manual.digest(HERE/'commerce_runtime_runner.py'))
        self.assertEqual(manual.PLAN_SHA,manual.digest(HERE/'COMMERCE_RUNTIME_UPGRADE_RECOVERY_PLAN.md'))

if __name__=='__main__':unittest.main()
