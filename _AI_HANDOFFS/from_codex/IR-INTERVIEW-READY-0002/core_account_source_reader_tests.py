"""Synthetic fixtures only; no remote, installed tokenizer or actual capture."""
import ast
import base64
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('account_source',HERE/'core_account_source_reader.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

def frozen():
    return dict(schema='ir.account.fixed_source_metadata.v1',classification='FIXED_SOURCE_FACTS_NOT_APPROVAL',targets=[dict(path=p,present=False) for p in sorted(r.TARGETS)],noAutomaticAdoption=True)

def synthetic(raw,role):
    php=shutil.which('php')
    if not php:raise unittest.SkipTest('Synthetic isolated PHP unavailable')
    records=[dict(role=role,mode='config',regions=r.TARGETS[role],source=base64.b64encode(raw).decode())]
    code=r.render_template().replace('SOURCES_B64',base64.b64encode(json.dumps(records).encode()).decode())
    # Local stock -n tokenizer only, never installed-module argv or inspected source.
    result=subprocess.run([php,'-n'],input=code.encode(),capture_output=True,timeout=20)
    return result

class Fixtures(unittest.TestCase):
    def test_dormant_cli(self):
        for args,code,label in (([],0,b'DORMANT'),(['--execute'],1,b'BLOCKED')):
            result=subprocess.run([sys.executable,'-B',str(HERE/'core_account_source_reader.py'),*args],capture_output=True,timeout=20)
            self.assertEqual(result.returncode,code);self.assertIn(label,result.stdout);self.assertEqual(result.stderr,b'')
    def test_preparation_only_and_phase_custody(self):
        for phase,f in (('metadata',None),('bodies',frozen())):
            program=r.prepare_program(phase,f);compile(program,'prospective','exec')
            self.assertIn('signal.alarm(8)',program);self.assertIn('timeout=6',program)
            self.assertIn("'-n'",program);self.assertIn('child.wait(timeout=REAP_SECONDS)',program)
            self.assertNotIn('bootstrap_fixed_loader_reader',program)
        for phase,f in (('bodies',None),('metadata',frozen()),('automatic',None)):
            with self.assertRaises(r.Stop):r.prepare_program(phase,f)
        with patch.object(r,'regular',return_value=b'drift'):
            with self.assertRaises(r.Stop):r.prepare_program()
        self.assertEqual(len(r.TARGETS),11);self.assertEqual(r.REAP_SECONDS,2)
    def test_metadata_exact_paths_absence_cap(self):
        r.validate_metadata(frozen())
        for change in ('path','extra','sha','cap','bool'):
            f=frozen();row=f['targets'][0]
            if change=='path':row['path']='wp-content/private.php'
            if change=='extra':row['raw']='PRIVATE_CANARY'
            if change in ('sha','cap','bool'):row.update(present=True,bytes=12,sha256='a'*64)
            if change=='sha':row['sha256']='PRIVATE_CANARY'
            if change=='cap':row['bytes']=r.SOURCE_CAP+1
            if change=='bool':row['bytes']=True
            with self.assertRaises(r.Stop):r.validate_metadata(f)
    def test_capture_injected_finite_and_drift(self):
        p=r.prepare_program();calls=[]
        def capture(argv,source,budget,cap):calls.append((argv,source,cap));return json.dumps(frozen()).encode()
        self.assertEqual(r.capture_prepared(capture,p,SimpleNamespace(deadline=time.monotonic()+5)),frozen())
        self.assertEqual(calls[0],(r.SSH_ARGV,p.encode(),r.OUTPUT_CAP))
        for program,deadline in ((p+'x',time.monotonic()+5),(p,float('nan')),(p,time.monotonic()-1),(p,time.monotonic()+20)):
            before=len(calls)
            with self.assertRaises(r.Stop):r.capture_prepared(capture,program,SimpleNamespace(deadline=deadline))
            self.assertEqual(len(calls),before)
        with self.assertRaises(r.Stop):r.capture_prepared(lambda *a,**k:b'x'*(r.OUTPUT_CAP+1),p,SimpleNamespace(deadline=time.monotonic()+5))
    def test_regular_symlink_cap_and_drift(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t).resolve()/'source.php';p.write_bytes(b'fixture')
            self.assertEqual(r.regular(p,7),b'fixture')
            with self.assertRaises(r.Stop):r.regular(p,6)
            q=p.parent/'link.php';q.symlink_to(p)
            with self.assertRaises(r.Stop):r.regular(q,7)
            original=r.os.lstat
            def drift(path):
                s=original(path)
                if Path(path)==p:return SimpleNamespace(st_mode=s.st_mode,st_dev=s.st_dev,st_ino=s.st_ino,st_size=8,st_mtime_ns=s.st_mtime_ns,st_ctime_ns=s.st_ctime_ns)
                return s
            with patch.object(r.os,'lstat',side_effect=drift):
                with self.assertRaises(r.Stop):r.regular(p,7)
    def test_absence_refuses_symlink_parents_and_changed_target(self):
        node=next(n for n in ast.parse(r.REMOTE_MAIN).body if isinstance(n,ast.FunctionDef) and n.name=='absence')
        namespace=dict(Path=Path,os=r.os,require=r.require)
        exec(compile(ast.Module(body=[node],type_ignores=[]),'synthetic_absence','exec'),namespace)
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t).resolve();missing=folder/'missing.php'
            namespace['absence'](str(missing))
            missing.write_bytes(b'synthetic')
            with self.assertRaises(r.Stop):namespace['absence'](str(missing))
            broken=folder/'broken.php';broken.symlink_to(folder/'absent.php')
            with self.assertRaises(r.Stop):namespace['absence'](str(broken))
            parent=folder/'parent';parent.symlink_to(folder,target_is_directory=True)
            with self.assertRaises(r.Stop):namespace['absence'](str(parent/'absent.php'))
    def test_named_regions_privacy_nonexecution_and_no_adoption(self):
        raw=br'''<?php namespace PRIVATE_NAMESPACE_CANARY;
class WC_Form_Handler {function process_login(): WP_Error {/* PRIVATE_COMMENT_CANARY */
$PRIVATE_VAR_CANARY=314159;wp_signon('PRIVATE_LITERAL_CANARY');$PRIVATE_DATA_CANARY=PRIVATE_CONST_CANARY;new WP_Error();apply_filters('PRIVATE_HOOK_CANARY',$PRIVATE_VAR_CANARY);
require '/not-read/PRIVATE_INCLUDE_CANARY.php';echo "PRIVATE_INTERPOLATED_CANARY{$PRIVATE_VAR_CANARY}";
echo <<<PRIVATE_HEREDOC_CANARY
PRIVATE_BODY_CANARY
PRIVATE_HEREDOC_CANARY;
file_put_contents('/not-written/PRIVATE_EXEC_CANARY','PRIVATE_VALUE_CANARY');}
function other(){PRIVATE_SUPPRESSED_CANARY();echo "{$private}";if(true){PRIVATE_NESTED_CANARY();}}
} const PRIVATE_CONST_CANARY=true; ?>PRIVATE_INLINE_CANARY'''
        role='wp-content/plugins/woocommerce/includes/class-wc-form-handler.php'
        result=synthetic(raw,role);self.assertEqual((result.returncode,result.stderr),(0,b''));self.assertNotIn(b'PRIVATE_',result.stdout)
        item=json.loads(result.stdout)['files'][0]
        self.assertEqual(item['namedRegions'],['process_login']);self.assertEqual(item['suppressedBodies'],1)
        self.assertTrue(all(not item[k] for k in ('includeCandidates','includeSiteFacts','closedPublicRegistrations','guardFacts')))
        self.assertIn('require',item['redactedSource']);self.assertIn('process_login',item['redactedSource']);self.assertIn('WC_Form_Handler',item['redactedSource']);self.assertIn('wp_signon',item['redactedSource']);self.assertIn('file_put_contents',item['redactedSource']);self.assertIn('WP_Error',item['redactedSource']);self.assertIn('apply_filters',item['redactedSource'])
        metadata=frozen();row=next(x for x in metadata['targets'] if x['path']==role);row.update(present=True,bytes=len(raw),sha256=r.digest(raw))
        closure=dict(schema='ir.account.fixed_source_closure.v1',classification='STATIC_ACCOUNT_SOURCE_NOT_APPROVAL',metadata=metadata,files=[item],noSemanticApproval=True)
        self.assertEqual(r.validate_closure(closure,metadata,r.donor()),closure)
        program=r.prepare_program('bodies',metadata)
        self.assertEqual(r.capture_prepared(lambda *a,**k:json.dumps(closure).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata),closure)
        for mutate in ('named','include','binding','semantic'):
            bad=copy.deepcopy(closure)
            if mutate=='named':bad['files'][0]['namedRegions']=['PRIVATE_CANARY']
            if mutate=='include':bad['files'][0]['includeCandidates']=['private.php']
            if mutate=='binding':bad['files'][0]['sourceSha256']='0'*64
            if mutate=='semantic':bad['noSemanticApproval']=False
            with self.assertRaises(r.Stop):r.validate_closure(bad,metadata,r.donor())
    def test_each_named_contract_body_survives_and_unknown_body_is_suppressed(self):
        for role,names in r.TARGETS.items():
            raw=('<?php class Synthetic { '+''.join('function '+n+'(){return "PRIVATE_VALUE_CANARY";}' for n in names)+'function unrelated(){PRIVATE_CALL_CANARY();} }').encode()
            result=synthetic(raw,role);self.assertEqual(result.returncode,0)
            item=json.loads(result.stdout)['files'][0];self.assertEqual(item['namedRegions'],list(names));self.assertEqual(item['suppressedBodies'],1)
            self.assertNotIn(b'PRIVATE_',result.stdout)

if __name__=='__main__':unittest.main(verbosity=2)
