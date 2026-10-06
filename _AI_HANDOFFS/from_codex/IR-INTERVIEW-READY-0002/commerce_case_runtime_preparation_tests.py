import ast,copy,hashlib,importlib.util,io,json,sys,tarfile,unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parent

def load(name,file):
    s=importlib.util.spec_from_file_location(name,HERE/file);m=importlib.util.module_from_spec(s);sys.modules[name]=m;s.loader.exec_module(m);return m

runner=load('commerce_case_runner_pure_fixture','commerce_case_runtime_runner.py')
manual=load('commerce_case_manual_pure_fixture','commerce_case_manual_operations.py')
old=load('commerce_retained_manual_pure_fixture','commerce_manual_operations.py')

def nodes(file):
    t=ast.parse((HERE/file).read_bytes());return {n.name:n for n in t.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}

def spec():
    return {'sourceHead':runner.head(runner.ROOT),'sourceCommit':manual.SOURCE,'packageDirectory':str(manual.PACKAGE),
        'packageFiles':manual.PACKAGE_FILES,'runtimeBindings':manual.BINDINGS,'qualifiedPreimages':manual.QUALIFIED_PREIMAGES,
        'qualifications':{k:{'qualifiedPreimages':manual.QUALIFIED_PREIMAGES} for k in ['phaseDecision','recovery','runtimeReadback']},
        'controlDirectory':str(HERE/'COMMERCE_CASE_FIXTURE_ABSENT_CONTROL')}

class Preparation(unittest.TestCase):
    def test_exact_package_archive_metadata_and_unchanged_gateways(self):
        packet=json.loads((HERE/'COMMERCE_CASE_INSTALL_PREPARATION_PACKET.json').read_bytes())
        self.assertEqual(packet['packageFiles'],manual.PACKAGE_FILES)
        self.assertEqual(packet['sourceCommit'],manual.SOURCE)
        for name,digest in manual.PACKAGE_FILES.items():self.assertEqual(manual.digest(manual.PACKAGE/name),digest)
        self.assertEqual((manual.PACKAGE/'interview-ready-candidate.tar.gz').stat().st_size,manual.ARCHIVE_BYTES)
        manifest=json.loads((manual.PACKAGE/'release-manifest.json').read_bytes())
        self.assertFalse(manifest['productionApproved']);self.assertEqual(manifest['sourceCommit'],manual.SOURCE)
        self.assertEqual(manifest['sourceRef'],manual.SOURCE);self.assertEqual(manifest['sourceState'],'EXACT_COMMITTED_INPUTS')
        self.assertEqual(manifest['uncommittedInputs'],[])
        self.assertEqual(manual.PACKAGE_METADATA_BYTES,{name:(manual.PACKAGE/name).stat().st_size for name in ['release-manifest.json','release-plan.json']})
        with tarfile.open(manual.PACKAGE/'interview-ready-candidate.tar.gz','r:gz') as archive:
            entries=archive.getmembers();self.assertEqual(len(entries),7)
            self.assertEqual({e.name for e in entries},set(manual.ARTIFACTS)|set(manual.PACKAGE_METADATA_BYTES))
            for e in entries:
                data=archive.extractfile(e).read();self.assertTrue(e.isfile())
                self.assertEqual((e.mode,e.mtime,e.uid,e.gid,e.uname,e.gname),(0o644,0,0,0,'',''))
                if e.name in manual.ARTIFACTS:self.assertEqual({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},manual.ARTIFACTS[e.name])
                else:self.assertEqual(data,(manual.PACKAGE/e.name).read_bytes())
        for k in ['gateway','matrix','gate']:self.assertEqual(manual.BINDINGS[k],manual.OLD_BINDINGS[k])

    def test_actual_guarded_baseline_receipt_and_all_retained_layouts(self):
        path=HERE/'FINISH_NOW_20261005/COMMERCE_CASE_RUNTIME_BASELINE.json'
        self.assertEqual(manual.digest(path),'8773c374318318e1bf90faf4f8cf9a7d8784fd7acd62733adf61a24bc98d4067')
        baseline=json.loads(path.read_bytes());receipt_path=HERE/'FINISH_NOW_COMMERCE_INSTALL_CONTROL_1/ROOT_READBACK_RECEIPT.json'
        self.assertEqual(manual.digest(receipt_path),baseline['readbackReceiptSha256'])
        receipt=json.loads(receipt_path.read_bytes())
        self.assertEqual(manual.LAYOUTS['OLD'],baseline['layout']);self.assertEqual(manual.LAYOUTS['OLD'],old.LAYOUTS['UPGRADED'])
        self.assertEqual(manual.LAYOUT_DIGESTS['OLD'],baseline['layoutSha256'])
        self.assertEqual(manual.LAYOUT_DIGESTS['OLD'],receipt['layoutSha256'])
        self.assertEqual(manual.LAYOUT_DIGESTS['OLD'],'c801fff2e8671348e321c5089f2b03e8b8798f7b8728cd666321b5009bbcab0a')
        self.assertEqual(manual.OLD_BINDINGS,baseline['runtimeBindings']);self.assertEqual(manual.OLD_BINDINGS,receipt['runtimeBindings'])
        self.assertEqual(manual.SHARED,baseline['shared']);self.assertEqual(receipt['sharedChecked'],15)
        self.assertEqual(len(manual.LAYOUTS['OLD']),52)
        self.assertEqual(max(map(len,manual.LAYOUTS.values())),68)
        for state,value in manual.LAYOUTS.items():
            self.assertLessEqual(len(value),68)
            for name,record in baseline['layout'].items():
                if name in [manual.RUNTIME,manual.RUNTIME+'/releases',manual.RUNTIME+'/current']:continue
                self.assertEqual(value[name],record,(state,name))
            for record in value.values():
                if record['type']=='directory':self.assertLessEqual(len(record['children']),16)
        payload=manual.LAYOUTS['PAYLOAD'];prefix=manual.RUNTIME+'/'+manual.STAGE+'/payload/'
        for name,size in manual.PACKAGE_METADATA_BYTES.items():self.assertEqual(payload[prefix+name]['bytes'],size)
        self.assertEqual(manual.LAYOUTS['UPGRADED'][manual.RUNTIME+'/current']['literal'],manual.POINTER)
        self.assertEqual(manual.LAYOUTS['UPGRADED'][manual.RUNTIME+'/'+manual.BACKUP_POINTER]['literal'],manual.OLD_POINTER)
        self.assertEqual(manual.LAYOUTS['RESTORED'][manual.RUNTIME+'/current']['literal'],manual.OLD_POINTER)
        self.assertEqual(manual.LAYOUTS['RESTORED'][manual.RUNTIME+'/'+manual.BACKUP_POINTER]['literal'],manual.POINTER)
        retained=baseline['layout'][manual.RUNTIME+'/releases']['children']
        self.assertEqual(set(manual.RELEASE_NAMES),set(retained)|{manual.HTML});self.assertEqual(len(manual.RELEASE_NAMES),4)
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

    def test_self_review_is_denied_before_report_file_read(self):
        self.assertEqual(manual.BUILDER,'/root/commerce_release_pin_worker')
        self.assertEqual(runner.MANUAL_BUILDER,manual.BUILDER)
        self.assertEqual(runner.BUILDER,'/root/native_stage_diagnostics')
        for role in ['wrapper','install_artifact']:
            for reviewer in [runner.OWNER,manual.BUILDER]:
                with patch.object(runner,'digest',side_effect=AssertionError('report-read')):
                    with self.assertRaises(runner.Stop):runner.report_record({'verdict':'APPROVE','independentReviewer':reviewer,'reportFile':'ABSENT.md','reportSha256':'0'*64},role=role)

    def test_local_actual_package_snapshot_and_bad_binding_fail_closed(self):
        actual_spec=spec()
        # Pending independent report bytes only; never bypass execution/provider gates.
        with patch.object(runner,'report_record'):
            actual=runner.snapshot('install',actual_spec);self.assertEqual(actual['osHead'],'fe17a4ca5572aecdc2d2761e8c2d993f7aebb8bf')
            self.assertEqual(actual['authority']['DR-391_ir_phase1_public_commerce_fallback.md'],'0ac4eace2f96ccfbc10864d7a022cba1eb0c6f9c4eeb0bb668dd342e3c532982')
            for field in ['packageFiles','runtimeBindings']:
                bad=copy.deepcopy(actual_spec);bad[field][next(iter(bad[field]))]='0'*64
                with self.assertRaises(runner.Stop):runner.snapshot('install',bad)

    def test_tampered_exact_archive_artifact_is_denied_in_memory(self):
        real_open=tarfile.open;buffer=io.BytesIO()
        with real_open(manual.PACKAGE/'interview-ready-candidate.tar.gz','r:gz') as original,real_open(fileobj=buffer,mode='w:gz') as changed:
            for member in original.getmembers():
                data=original.extractfile(member).read()
                if member.name==manual.GATEWAY:data=bytes([data[0]^1])+data[1:]
                changed.addfile(member,io.BytesIO(data))
        with patch.object(runner,'report_record'),patch.object(runner.tarfile,'open',side_effect=lambda *a,**k:real_open(fileobj=io.BytesIO(buffer.getvalue()),mode='r:gz')):
            with self.assertRaises(runner.Stop):runner.snapshot('install',spec())

    def test_whole_wrapper_protocol_function_ast_preserved(self):
        a=nodes('commerce_runtime_runner.py');b=nodes('commerce_case_runtime_runner.py');self.assertEqual(a.keys(),b.keys())
        for name in a:self.assertEqual(ast.dump(a[name]),ast.dump(b[name]),name)

    def test_manual_whole_ledger_io_guard_ast_and_fixed_cap_delta(self):
        a=nodes('commerce_manual_operations.py');b=nodes('commerce_case_manual_operations.py');self.assertEqual(a.keys(),b.keys())
        for name in a:
            n=copy.deepcopy(b[name])
            for v in ast.walk(n):
                if isinstance(v,ast.Constant) and v.value=='commerce_case_runtime_runner.py':v.value='commerce_runtime_runner.py'
                if isinstance(v,ast.Constant) and v.value=='COMMERCE_CASE_RUNTIME_UPGRADE_RECOVERY_PLAN.md':v.value='COMMERCE_RUNTIME_UPGRADE_RECOVERY_PLAN.md'
            self.assertEqual(ast.dump(a[name]),ast.dump(n),name)
        self.assertEqual(manual.REMOTE_SOURCE.replace('len(expected)<=68','len(expected)<=64'),old.REMOTE_SOURCE)
        self.assertEqual(manual.REMOTE_SOURCE.count('len(expected)<=68'),1)
        self.assertEqual(manual.CACHE_FORMS,old.CACHE_FORMS);self.assertEqual(manual.CACHE_VENDOR,old.CACHE_VENDOR)
        self.assertEqual(manual.PHASES,old.PHASES);self.assertEqual(manual.SHARED,old.SHARED)
        self.assertEqual(manual.RUNNER_SHA,manual.digest(HERE/'commerce_case_runtime_runner.py'))
        self.assertEqual(manual.PLAN_SHA,manual.digest(HERE/'COMMERCE_CASE_RUNTIME_UPGRADE_RECOVERY_PLAN.md'))

if __name__=='__main__':unittest.main()
