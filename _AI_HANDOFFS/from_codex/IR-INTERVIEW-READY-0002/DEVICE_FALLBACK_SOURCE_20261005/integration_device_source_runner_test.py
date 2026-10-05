import ast,copy,hashlib,importlib.util,json,time,unittest
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('device_source_fixture',HERE/'integration_device_source_runner.py')
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class Focused(unittest.TestCase):
    def setUp(self):
        self.actual=runner.snapshot()
    def approval(self):
        return {'schema':'ir.device_fallback_source_lease.approval.v1','verdict':'APPROVE','independentReviewer':'fixture-independent',
          'contract':copy.deepcopy(self.actual),'expiresUnix':2000,'deviceReview':{'schema':'ir.device_fallback_source_lease.device_review.v1',
          'verdict':'APPROVE','independentReviewer':'fixture-recovery','bindingSha256':hashlib.sha256(runner.canonical(self.actual)).hexdigest(),
          'expiresUnix':2000,'reportFile':'fixture-recovery.md','reportSha256':'fixture'}}
    def test_actual_snapshot_exact_preimages_scope_custody_and_valid_typed_control(self):
        self.assertEqual(self.actual['sourcePreimages'],runner.BASE_PREIMAGES)
        self.assertEqual(self.actual['originalSourcePreimages'],runner.BASE_PREIMAGES)
        self.assertEqual(self.actual['osHead'],runner.OS_HEAD)
        self.assertEqual(self.actual['supplementSha256'],runner.SUPPLEMENT_SHA)
        self.assertEqual(self.actual['supplementHandoffSha256'],runner.SUPPLEMENT_HANDOFF_SHA)
        self.assertEqual(self.actual['sharedDomains'],[])
        self.assertEqual(runner.validate_approval(self.approval(),self.actual,now=1000),hashlib.sha256(runner.canonical(self.actual)).hexdigest())
    def test_old_schemas_builder_stale_and_mismatched_contract_deny(self):
        for schema in ['ir.shopping_source_lease.approval.v1','ir.integration_source_lease.approval.v1','ir.production_lease.approval.v1']:
            a=self.approval();a['schema']=schema
            with self.assertRaises(runner.Stop):runner.validate_approval(a,self.actual,now=1000)
        for who in [runner.OWNER,runner.BUILDER,'',None]:
            a=self.approval();a['independentReviewer']=who
            with self.assertRaises(runner.Stop):runner.validate_approval(a,self.actual,now=1000)
        for expiry in [999,4601,float('nan')]:
            a=self.approval();a['expiresUnix']=expiry
            with self.assertRaises(runner.Stop):runner.validate_approval(a,self.actual,now=1000)
        a=self.approval();a['contract']['sourceHead']='0'*40
        with self.assertRaises(runner.Stop):runner.validate_approval(a,self.actual,now=1000)
    def test_pins_preimages_paths_authority_and_private_scope_changes_deny(self):
        for key in ['fallbackPatchSha256','fallbackTestsSha256','fallbackManifestSha256','fallbackReceiptSha256','fallbackHandoffSha256',
                    'supplementSha256','supplementHandoffSha256','decisionSha256','dr375Sha256','canonicalClientSha256']:
            x=copy.deepcopy(self.actual);x[key]='0'*64;a=self.approval();a['contract']=x
            with self.assertRaises(runner.Stop):runner.validate_approval(a,x,now=1000)
        for key,val in [('sourcePreimages',{}),('originalSourcePreimages',{}),('sharedDomains',['SHARED:AUTH']),('writePaths',runner.PATHS+['interview-ready/account-extra.js'])]:
            x=copy.deepcopy(self.actual);x[key]=val;a=self.approval();a['contract']=x
            with self.assertRaises(runner.Stop):runner.validate_approval(a,x,now=1000)
    def test_missing_or_wrong_review_and_patch_sequence_account_claim_deny(self):
        for mutation in ['missing','binding','schema','builder']:
            a=self.approval()
            if mutation=='missing':del a['deviceReview']
            elif mutation=='binding':a['deviceReview']['bindingSha256']='0'*64
            elif mutation=='schema':a['deviceReview']['schema']='ir.shopping_source_lease.shopping_review.v1'
            else:a['deviceReview']['independentReviewer']=runner.BUILDER
            with self.assertRaises(runner.Stop):runner.validate_approval(a,self.actual,now=1000)
        for key,val in [('patchSequence',[]),('accountReady',True),('releaseApproved',True),('namespace','ir:')]:
            x=copy.deepcopy(self.actual);x['devicePacket'][key]=val;a=self.approval();a['contract']=x
            with self.assertRaises(runner.Stop):runner.validate_approval(a,x,now=1000)
    def test_missing_authority_is_closed_before_snapshot_or_controls(self):
        with patch.object(runner,'SUPPLEMENT_SHA',None):
            with self.assertRaises(runner.Stop):runner.snapshot()
            with self.assertRaises(runner.Stop):runner.validate_approval(self.approval(),self.actual,now=1000)
    def test_old_read_schema_and_wrong_bound_max_deny_before_capability(self):
        a=self.approval();a['expiresUnix']=a['deviceReview']['expiresUnix']=time.time()+60
        for schema,maxsec in [('ir.shopping_source_lease.read_admission.v1',1800),('ir.device_fallback_source_lease.read_admission.v1',3600)]:
            admission={'schema':schema,'verdict':'APPROVE','independentReviewer':'fixture-reader','bindingSha256':hashlib.sha256(runner.canonical(self.actual)).hexdigest(),'approvalSha256':'fixture','maxSeconds':maxsec,'expiresUnix':time.time()+60}
            with patch.object(runner,'snapshot',return_value=self.actual),patch.object(runner,'read_json',side_effect=[a,admission]),patch.object(runner,'digest',return_value='fixture'),patch.object(runner,'load_module',side_effect=AssertionError('capability')):
                with self.assertRaises(runner.Stop):runner.execute(HERE/'fixture-approval.json',HERE/'fixture-read.json',HERE/'fixture-absent-control',1800)
    def test_guard_keeper_release_and_normalized_execute_equal_reviewed_controller(self):
        donor=runner.ARTIFACT_ROOT/'SHOPPING_COMBINED_SOURCE_ADMISSION_20261005/integration_shopping_source_runner.py'
        self.assertEqual(hashlib.sha256(donor.read_bytes()).hexdigest(),'c902e9c484bc6122bb559a730d1b79cdda0b3e1289420d643c25a3bc05c882bf')
        old=ast.parse(donor.read_bytes());new=ast.parse((HERE/'integration_device_source_runner.py').read_bytes())
        om={n.name:n for n in old.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))};nm={n.name:n for n in new.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        changed={'snapshot','validate_approval','execute'};removed={'shopping_packet','combined_source_evidence'}
        for name in om.keys()-changed-removed:self.assertEqual(ast.dump(om[name]),ast.dump(nm[name]),name)
        # Four prospective string substitutions; all execution control flow remains identical.
        node=copy.deepcopy(nm['execute'])
        replacements={'ir.device_fallback_source_lease.read_admission.v1':'ir.shopping_source_lease.read_admission.v1','deviceReview':'shoppingReview','SOURCE_DEVICE_LEASE_READ_CONSUMED_':'SOURCE_SHOPPING_LEASE_READ_CONSUMED_','ir-phase1-device-source-20261005-':'ir-phase1-shopping-source-20261005-'}
        for n in ast.walk(node):
            if isinstance(n,ast.Constant) and isinstance(n.value,str):n.value=replacements.get(n.value,n.value)
        self.assertEqual(ast.dump(node),ast.dump(om['execute']))
        self.assertEqual(nm.keys()-om.keys(),{'device_packet','fallback_source_evidence'})

if __name__=='__main__':unittest.main()
