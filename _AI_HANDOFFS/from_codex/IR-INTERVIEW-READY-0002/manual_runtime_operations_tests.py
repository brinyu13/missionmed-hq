"""Injected local remote-program/coordination fixtures; no SSH/cache/provider capability."""
import base64, contextlib, copy, hashlib, importlib.util, io, json, os, subprocess, sys, tarfile, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, Mock
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('manual_upgrade_fixture',HERE/'manual_runtime_operations.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class UpgradeFixtures(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='ir-upgrade-fixture-');self.root=Path(self.temp.name).resolve()/'webroot';self.root.mkdir()
        self.old_package=Path('/private/tmp/ir-phase1-qualified-fullref-20261004')
        self.archive=(m.PACKAGE/'interview-ready-candidate.tar.gz').read_bytes()
        oldstage=self.root/m.RUNTIME/m.OLD_STAGE;payload=oldstage/'payload';payload.mkdir(parents=True)
        with tarfile.open(self.old_package/'interview-ready-candidate.tar.gz') as bundle:
            for member in bundle.getmembers():
                target=payload/member.name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(bundle.extractfile(member).read())
        (oldstage/'interview-ready-candidate.tar.gz').write_bytes((self.old_package/'interview-ready-candidate.tar.gz').read_bytes())
        release=self.root/m.RUNTIME/'releases'/m.OLD_HTML;release.parent.mkdir();os.rename(payload/m.RUNTIME/'releases'/m.OLD_HTML,release)
        (self.root/m.GATEWAY).write_bytes((payload/m.GATEWAY).read_bytes())
        (self.root/m.RUNTIME/'current').symlink_to(m.OLD_POINTER)
        self.shared={}
        for name in m.SHARED:
            value=('public fixture '+name).encode();target=self.root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(value);self.shared[name]=hashlib.sha256(value).hexdigest()
        self.vendor={}
        for name in m.CACHE_VENDOR:
            value=('vendor fixture '+name).encode();target=self.root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(value);self.vendor[name]=hashlib.sha256(value).hexdigest()
        self.exchange=[];self.fail_backup=False
        self.ns={k:copy.deepcopy(getattr(m,k)) for k in ('RUNTIME','GATEWAY','HTML','OLD_HTML','POINTER','OLD_POINTER','STAGE','TEMP_POINTER','BACKUP_POINTER','POINTER_SHA','PACKAGE_FILES','BINDINGS','OLD_BINDINGS','SOURCE','ARTIFACTS','ARCHIVE_BYTES','LAYOUTS','LAYOUT_DIGESTS','CACHE_FORMS','CACHE_ENDPOINT')}
        self.ns.update(WEBROOT=str(self.root),SHARED=self.shared,CACHE_VENDOR=self.vendor,MODE='upgrade',RECOVERY_LAYOUT='UPGRADED',ARCHIVE_DATA=base64.b64encode(self.archive).decode())
        exec(compile(m.REMOTE_SOURCE.split('class RemoteDeadline')[0],'actual-fixed-remote-program','exec'),self.ns)
        self.ns['renameat2']=self.rename_fixture
        self.before={name:(self.root/name).read_bytes() for name,record in m.OLD_LAYOUT.items() if record['type']=='regular'}
    def tearDown(self):self.temp.cleanup()
    def rename_fixture(self,source,destination,flags):
        self.exchange.append(flags)
        self.assertEqual(source.parent.stat().st_dev,destination.parent.stat().st_dev)
        if flags==1:
            self.assertFalse(os.path.lexists(destination))
            if self.fail_backup and destination.name==m.BACKUP_POINTER:raise RuntimeError('STOP')
            os.rename(source,destination)
        else:
            self.assertEqual(flags,2);self.assertTrue(os.path.lexists(source));self.assertTrue(os.path.lexists(destination))
            # Fixture seam only: platform-independent simulation of Linux atomic exchange.
            holding=source.parent/'.fixture-exchange';self.assertFalse(os.path.lexists(holding))
            os.rename(source,holding);os.rename(destination,source);os.rename(holding,destination)
    def run_op(self,op,mode='upgrade',recovery='UPGRADED'):
        self.ns.update(OP=op,MODE=mode,RECOVERY_LAYOUT=recovery)
        with contextlib.redirect_stdout(io.StringIO()) as output:self.ns['main']()
        return json.loads(output.getvalue())
    def upgrade(self):
        for op in ('mkdir-stage','transfer','extract','lint','publish-release','prepare-pointer','publish-pointer'):self.run_op(op)
    def assert_old_preserved(self):
        for name,value in self.before.items():self.assertEqual((self.root/name).read_bytes(),value)
        for name,value in self.shared.items():self.assertEqual(hashlib.sha256((self.root/name).read_bytes()).hexdigest(),value)

    def test_exact_observed_old_inventory_and_successful_upgrade_recovery(self):
        self.assertEqual(m.LAYOUT_DIGESTS['OLD'],'c07522fc030cf916529d5d58d44cd5f507b052a93c24f1ce572a8243c94427ac')
        self.assertEqual(self.run_op('readback')['runtimeBindings'],m.OLD_BINDINGS)
        self.upgrade();self.assertEqual(os.readlink(self.root/m.RUNTIME/'current'),m.POINTER)
        self.assertEqual(os.readlink(self.root/m.RUNTIME/m.BACKUP_POINTER),m.OLD_POINTER)
        self.assertEqual(self.run_op('readback')['runtimeBindings'],m.BINDINGS);self.assert_old_preserved()
        self.run_op('restore-pointer','upgrade-recovery');self.assertEqual(os.readlink(self.root/m.RUNTIME/'current'),m.OLD_POINTER)
        self.assertEqual(os.readlink(self.root/m.RUNTIME/m.BACKUP_POINTER),m.POINTER);self.assert_old_preserved()
        self.assertEqual(self.run_op('readback','upgrade-recovery')['runtimeBindings'],m.OLD_BINDINGS)
        self.assertEqual(self.exchange,[1,2,1,2])

    def test_exact_published_resume_preserves_old_objects_and_cannot_republish(self):
        for op in ('mkdir-stage','transfer','extract','lint','publish-release'):self.run_op(op)
        self.assertEqual(self.run_op('readback','upgrade-resume')['runtimeBindings'],m.OLD_BINDINGS)
        for op in ('mkdir-stage','transfer','extract','lint','publish-release','restore-pointer'):
            with self.assertRaises(RuntimeError):self.run_op(op,'upgrade-resume')
        self.run_op('prepare-pointer','upgrade-resume');self.run_op('publish-pointer','upgrade-resume')
        self.assertEqual(self.run_op('readback','upgrade-resume')['runtimeBindings'],m.BINDINGS)
        self.assert_old_preserved();self.assertEqual(self.exchange,[1,2,1])
        self.assertEqual(os.readlink(self.root/m.RUNTIME/m.BACKUP_POINTER),m.OLD_POINTER)

    def test_resume_pointer_requires_exact_published_not_old_prepared_or_drift(self):
        with self.assertRaises((RuntimeError,FileNotFoundError)):self.run_op('prepare-pointer','upgrade-resume')
        for op in ('mkdir-stage','transfer','extract','lint','publish-release'):self.run_op(op)
        archive=self.root/m.RUNTIME/m.STAGE/'interview-ready-candidate.tar.gz';value=archive.read_bytes();archive.write_bytes(value+b'drift')
        with self.assertRaises(RuntimeError):self.run_op('prepare-pointer','upgrade-resume')
        archive.write_bytes(value);self.run_op('prepare-pointer','upgrade-resume')
        with self.assertRaises(RuntimeError):self.run_op('prepare-pointer','upgrade-resume')
        self.assertEqual(self.exchange,[1]);self.assert_old_preserved()

    def test_new_collision_wrong_pointer_and_unknown_layout_stop_before_mutation(self):
        runtime=self.root/m.RUNTIME
        (runtime/m.STAGE).mkdir()
        with self.assertRaises(RuntimeError):self.run_op('mkdir-stage')
        (runtime/m.STAGE).rmdir();current=runtime/'current';current.unlink();current.symlink_to('releases/not-qualified')
        with self.assertRaises((RuntimeError,FileNotFoundError)):self.run_op('mkdir-stage')
        current.unlink();current.symlink_to(m.OLD_POINTER);(runtime/'unknown').mkdir()
        with self.assertRaises(RuntimeError):self.run_op('mkdir-stage')
        self.assertEqual(self.exchange,[]);self.assert_old_preserved()

    def test_gateway_or_old_stage_drift_and_initial_absence_are_not_adopted(self):
        gateway=self.root/m.GATEWAY;old=gateway.read_bytes();gateway.write_bytes(old+b'drift')
        with self.assertRaises(RuntimeError):self.run_op('mkdir-stage')
        gateway.write_bytes(old);stage=self.root/m.RUNTIME/m.OLD_STAGE/'interview-ready-candidate.tar.gz'
        stage.write_bytes(stage.read_bytes()+b'drift')
        with self.assertRaises(RuntimeError):self.run_op('mkdir-stage')
        gateway.unlink()
        with self.assertRaises(RuntimeError):self.run_op('mkdir-stage')
        self.assertEqual(self.exchange,[])

    def test_exchange_interruption_retains_old_pointer_for_fresh_recovery(self):
        for op in ('mkdir-stage','transfer','extract','lint','publish-release','prepare-pointer'):self.run_op(op)
        self.fail_backup=True
        with self.assertRaises(RuntimeError):self.run_op('publish-pointer')
        self.assertEqual(os.readlink(self.root/m.RUNTIME/'current'),m.POINTER)
        self.assertEqual(os.readlink(self.root/m.RUNTIME/m.TEMP_POINTER),m.OLD_POINTER)
        self.assertFalse(os.path.lexists(self.root/m.RUNTIME/m.BACKUP_POINTER))
        self.fail_backup=False;self.run_op('restore-pointer','upgrade-recovery','EXCHANGED')
        self.assertEqual(os.readlink(self.root/m.RUNTIME/'current'),m.OLD_POINTER)
        self.assertEqual(os.readlink(self.root/m.RUNTIME/m.BACKUP_POINTER),m.POINTER);self.assert_old_preserved()

    def test_recovery_rejects_altered_backup_and_wrong_mode(self):
        self.upgrade();backup=self.root/m.RUNTIME/m.BACKUP_POINTER;backup.unlink();backup.symlink_to(m.POINTER)
        with self.assertRaises(RuntimeError):self.run_op('restore-pointer','upgrade-recovery')
        with self.assertRaises(RuntimeError):self.run_op('restore-pointer','upgrade')
        self.assertEqual(os.readlink(self.root/m.RUNTIME/'current'),m.POINTER);self.assert_old_preserved()

    def test_archive_members_caps_and_digests_fail_closed(self):
        self.run_op('mkdir-stage');self.run_op('transfer');archive=self.root/m.RUNTIME/m.STAGE/'interview-ready-candidate.tar.gz'
        archive.write_bytes(self.archive+b'drift')
        with self.assertRaises(RuntimeError):self.run_op('extract')
        self.assertFalse((archive.parent/'payload').exists());self.assert_old_preserved()

    def test_cache_exact_loopback_form_no_proxy_redirect_auth_and_ack_only(self):
        self.upgrade();requests=[]
        class Response:
            status=204
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def geturl(self):return m.CACHE_ENDPOINT
            def read(self,cap):selfcap=cap;assert selfcap==65537;return b'ack fixture'
        class Opener:
            def open(inner,request,timeout):
                self.assertEqual(timeout,5);self.assertEqual(request.full_url,m.CACHE_ENDPOINT);self.assertEqual(request.get_method(),'POST')
                self.assertEqual(dict(request.header_items()),{'Content-type':'application/x-www-form-urlencoded'})
                requests.append(request.data);return Response()
        def build(*handlers):
            self.assertEqual(handlers[0].proxies,{})
            with self.assertRaises(RuntimeError):handlers[2].redirect_request(None,None,None,None,None,None)
            self.assertFalse(handlers[1]._context.check_hostname);self.assertEqual(handlers[1]._context.verify_mode,0)
            return Opener()
        with patch.object(self.ns['urllib'].request,'build_opener',side_effect=build):
            for op in ('refresh-ir-html','refresh-home-html'):
                receipt=self.run_op(op)['cacheReceipt'];self.assertEqual(receipt,{'status':204,'bytes':11,'responseSha256':hashlib.sha256(b'ack fixture').hexdigest()})
        self.assertEqual(requests,[b'single%7Cir_route=missionmedinstitute.com%2Finterview-ready%2F',b'single%7Cir_home=missionmedinstitute.com%2F']);self.assert_old_preserved()

    def test_cache_redirect_non2xx_oversize_vendor_drift_stop(self):
        self.upgrade()
        for status,url,body in [(302,m.CACHE_ENDPOINT,b''),(200,'https://other.invalid/',b''),(200,m.CACHE_ENDPOINT,b'x'*65537)]:
            response=SimpleNamespace(status=status,geturl=lambda u=url:u,read=lambda cap,b=body:b)
            class Context:
                def __enter__(self):return response
                def __exit__(self,*a):pass
            with patch.object(self.ns['urllib'].request,'build_opener',return_value=SimpleNamespace(open=lambda *a,**k:Context())):
                with self.assertRaises(RuntimeError):self.run_op('refresh-ir-html')
        vendor=self.root/next(iter(self.vendor));vendor.write_bytes(b'drift')
        with patch.object(self.ns['urllib'].request,'build_opener',side_effect=AssertionError('network must not start')):
            with self.assertRaises(RuntimeError):self.run_op('refresh-home-html')
        self.assert_old_preserved()

    def test_guard2_closure_never_dispatches_ssh_and_completes_cancelled_marker(self):
        runner=m.load_runner();directory=Path(self.temp.name).resolve()/'control';directory.mkdir()
        args=SimpleNamespace(control_directory=directory,binding='1'*64,operation='stage')
        contract={'spec':{'qualifications':{'phaseDecision':{'manualOperationMode':'upgrade'}},'qualifiedPreimages':m.QUALIFIED_PREIMAGES}}
        status={'fenceSha256':'2'*64}
        with patch.object(m,'local_guard',side_effect=[(contract,status),m.Stop()]),patch.object(m.subprocess,'Popen') as popen:
            with self.assertRaises(m.Stop):m.remote_step(args,runner,'mkdir-stage')
            popen.assert_not_called()
        marker=runner.manual_operation_record(directory,args.binding,status['fenceSha256']);self.assertEqual(marker['state'],'COMPLETE')

    def test_popen_attempt_failure_stays_uncertain(self):
        runner=m.load_runner();directory=Path(self.temp.name).resolve()/'control';directory.mkdir()
        args=SimpleNamespace(control_directory=directory,binding='1'*64,operation='stage')
        contract={'spec':{'qualifications':{'phaseDecision':{'manualOperationMode':'upgrade'}},'qualifiedPreimages':m.QUALIFIED_PREIMAGES}}
        status={'fenceSha256':'2'*64}
        with patch.object(m,'local_guard',return_value=(contract,status)),patch.object(m.subprocess,'Popen',side_effect=OSError('private suppressed')) as popen:
            with self.assertRaises(m.Stop):m.remote_step(args,runner,'mkdir-stage')
            self.assertEqual(popen.call_count,1)
        self.assertEqual(runner.manual_operation_record(directory,args.binding,status['fenceSha256'])['state'],'UNCERTAIN')

    def test_actual_remote_ack_complete_precedes_closing_postguard(self):
        runner=m.load_runner();directory=Path(self.temp.name).resolve()/'control';directory.mkdir()
        args=SimpleNamespace(control_directory=directory,binding='1'*64,operation='stage')
        contract={'spec':{'qualifications':{'phaseDecision':{'manualOperationMode':'upgrade'}},'qualifiedPreimages':m.QUALIFIED_PREIMAGES}}
        status={'fenceSha256':'2'*64};outer=self
        class Child:
            returncode=0
            def communicate(self,code,timeout):
                selftest=outer;selftest.assertTrue(0<timeout<=10)
                ns={};exec(compile(code.decode().split('class RemoteDeadline')[0],'serialized-fixed-program','exec'),ns)
                ns['renameat2']=selftest.rename_fixture
                with contextlib.redirect_stdout(io.StringIO()) as output:ns['main']()
                return output.getvalue().encode(),None
            def poll(self):return 0
        with patch.object(m,'WEBROOT',str(self.root)),patch.object(m,'SHARED',self.shared),patch.object(m,'CACHE_VENDOR',self.vendor),patch.object(m,'local_guard',side_effect=[(contract,status),(contract,status),m.Stop()]),patch.object(m.subprocess,'Popen',return_value=Child()) as popen:
            with self.assertRaises(m.Stop):m.remote_step(args,runner,'mkdir-stage')
            self.assertEqual(popen.call_args.args[0],['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8','missionmed-kinsta','python3','-'])
        self.assertEqual(runner.manual_operation_record(directory,args.binding,status['fenceSha256'])['state'],'COMPLETE')
        self.ns['layout_check']('STAGE');self.assert_old_preserved()

    def test_nonack_retains_uncertain_without_completion_inference(self):
        runner=m.load_runner();directory=Path(self.temp.name).resolve()/'control';directory.mkdir()
        args=SimpleNamespace(control_directory=directory,binding='1'*64,operation='stage')
        contract={'spec':{'qualifications':{'phaseDecision':{'manualOperationMode':'upgrade'}},'qualifiedPreimages':m.QUALIFIED_PREIMAGES}}
        status={'fenceSha256':'2'*64}
        child=SimpleNamespace(returncode=0,communicate=lambda *a,**k:(b'{"result":"PASS"}',None),poll=lambda:0)
        with patch.object(m,'local_guard',return_value=(contract,status)),patch.object(m.subprocess,'Popen',return_value=child):
            with self.assertRaises(m.Stop):m.remote_step(args,runner,'mkdir-stage')
        self.assertEqual(runner.manual_operation_record(directory,args.binding,status['fenceSha256'])['state'],'UNCERTAIN');self.assert_old_preserved()

    def test_actual_helper_wrapper_pair_rejects_absent_mode_selfreview_and_margins(self):
        import time
        from datetime import datetime,timezone,timedelta
        runner=m.load_runner();directory=Path(self.temp.name).resolve()/'guard';directory.mkdir();control=directory/'control';control.mkdir()
        for name in ('EXACT_RUNTIME_UPGRADE_RECOVERY_PLAN.md','NARROW_ROUTE_CACHE_MECHANISM.md'):(directory/name).write_bytes((HERE/name).read_bytes())
        def record(filename,reviewer='fixture-independent'):
            (directory/filename).write_text('local protocol fixture')
            return {'verdict':'APPROVE','independentReviewer':reviewer,'reportFile':filename,'reportSha256':hashlib.sha256((directory/filename).read_bytes()).hexdigest()}
        phase=record('PHASE.md');phase.update(manualOperationsSha256=m.digest(Path(m.__file__)),installPlanSha256=m.PLAN_SHA,manualOperationMode='upgrade')
        clear=record('CLEAR.md');clear.update(phase='install',released=True,activeIR=0,pendingIR=0,observedUnix=time.time())
        recovery=record('RECOVERY.md');recovery.update(oldRuntimeBindings=m.OLD_BINDINGS,upgradeRuntimeBindings=m.BINDINGS,qualifiedPreimages=m.QUALIFIED_PREIMAGES,priorInstallProviderClear=clear)
        spec={'sourceCommit':m.SOURCE,'packageDirectory':str(m.PACKAGE),'packageFiles':m.PACKAGE_FILES,'runtimeBindings':m.BINDINGS,'controlDirectory':str(control),'qualifiedPreimages':m.QUALIFIED_PREIMAGES,'qualifications':{'phaseDecision':phase,'recovery':recovery}}
        contract={'phase':'install','sourceHead':'1'*40,'spec':spec};binding=hashlib.sha256(runner.canonical(contract)).hexdigest()
        approval=record('EXECUTION.md');approval.update(schema='ir.runtime_native.approval.v1',phase='install',expiresUnix=time.time()+60,spec=spec,contract=contract)
        path=directory/'APPROVAL.json';path.write_bytes(m.canonical(approval));args=SimpleNamespace(approval=path,approval_sha256=m.digest(path),binding=binding,control_directory=control,operation='stage')
        status={'phase':'install','sourceHead':contract['sourceHead'],'bindingSha256':binding,'state':'HEALTHY','fenceSha256':'2'*64,'deadlineUnix':time.time()+60,'expiresAt':(datetime.now(timezone.utc)+timedelta(seconds=25)).isoformat(),'updatedUnix':time.time()}
        runner.atomic(control,'READY.json',dict(status,state='READY'));runner.atomic(control,'STATUS.json',status)
        with patch.object(m,'HERE',directory),patch.object(runner,'HERE',directory),patch.object(runner,'snapshot',side_effect=lambda *a:contract):
            self.assertEqual(m.local_guard(args,runner)[0],contract)
            for edit in ('absent','mode','self','server','session'):
                saved=copy.deepcopy(approval);saved_status=dict(status)
                if edit=='absent':spec['qualifiedPreimages']={m.GATEWAY:'ABSENT',m.RUNTIME:'ABSENT',m.RUNTIME+'/current':'ABSENT'}
                elif edit=='mode':phase['manualOperationMode']='install'
                elif edit=='self':approval['independentReviewer']=m.BUILDER
                elif edit=='server':status['expiresAt']=(datetime.now(timezone.utc)+timedelta(seconds=19)).isoformat()
                else:status['deadlineUnix']=time.time()+29;runner.atomic(control,'READY.json',dict(status,state='READY'))
                path.write_bytes(m.canonical(approval));args.approval_sha256=m.digest(path)
                args.binding=hashlib.sha256(runner.canonical(contract)).hexdigest();runner.atomic(control,'STATUS.json',status)
                with self.assertRaises((m.Stop,runner.Stop)):m.local_guard(args,runner)
                approval=saved;contract=approval['contract'];spec=contract['spec'];phase=spec['qualifications']['phaseDecision'];status=saved_status
                path.write_bytes(m.canonical(approval));args.approval_sha256=m.digest(path);args.binding=hashlib.sha256(runner.canonical(contract)).hexdigest()
                runner.atomic(control,'READY.json',dict(status,state='READY'));runner.atomic(control,'STATUS.json',status)

            # The clear was fresh at initial READY, while a later own HEALTHY
            # operation can safely occur >300s later inside unchanged deadline.
            clear=spec['qualifications']['recovery']['priorInstallProviderClear']
            clear['observedUnix']=time.time()-400
            initial=time.time()-399
            ready=dict(status,state='READY',updatedUnix=initial)
            def seal():
                path.write_bytes(m.canonical(approval));args.approval_sha256=m.digest(path)
                args.binding=hashlib.sha256(runner.canonical(contract)).hexdigest()
                status['bindingSha256']=args.binding;ready['bindingSha256']=args.binding
                runner.atomic(control,'READY.json',ready);runner.atomic(control,'STATUS.json',status)
            seal();self.assertEqual(m.local_guard(args,runner)[0],contract)
            for observed in (initial-300,initial+1,float('inf')):
                clear['observedUnix']=observed
                if observed==float('inf'):
                    with self.assertRaises(ValueError):m.canonical(approval)
                else:
                    seal()
                    with self.assertRaises((m.Stop,runner.Stop)):m.local_guard(args,runner)
            clear['observedUnix']=initial-1
            # Resume needs an exact PUBLISHED initial preimage and explicit
            # retirement evidence; expiry never becomes released=true.
            phase['manualOperationMode']='upgrade-resume';args.operation='publish-pointer'
            spec['qualifiedPreimages']=m.RESUME_PREIMAGES;recovery=spec['qualifications']['recovery'];recovery['qualifiedPreimages']=m.RESUME_PREIMAGES
            clear.update(retirement='RETIRED_BY_EXPIRY',released=False,expired=True,guard2NotDispatched=True,priorClaimId='12345678-1234-4234-8234-123456789abc',priorBindingSha256='3'*64,expiresUnix=initial-2,qualifiedPreimages=m.RESUME_PREIMAGES)
            seal();self.assertEqual(m.local_guard(args,runner)[0],contract)
            for field,bad in [('released',True),('expired',False),('guard2NotDispatched',False),('expiresUnix',initial),('priorClaimId','not-uuid'),('priorBindingSha256','bad'),('retirement','UNKNOWN'),('qualifiedPreimages',m.QUALIFIED_PREIMAGES)]:
                old=clear[field];clear[field]=bad;seal()
                with self.assertRaises((m.Stop,runner.Stop)):m.local_guard(args,runner)
                clear[field]=old
            for operation in ('stage','extract','publish-release','restore-pointer'):
                args.operation=operation;seal()
                with self.assertRaises((m.Stop,runner.Stop)):m.local_guard(args,runner)
            args.operation='publish-pointer'
            for preimages in (m.QUALIFIED_PREIMAGES,m.preimage_for('PREPARED',m.OLD_BINDINGS['pointer']),m.RECOVERY_PREIMAGES):
                spec['qualifiedPreimages']=preimages;recovery['qualifiedPreimages']=preimages;seal()
                with self.assertRaises((m.Stop,runner.Stop)):m.local_guard(args,runner)
            spec['qualifiedPreimages']=m.RESUME_PREIMAGES;recovery['qualifiedPreimages']=m.RESUME_PREIMAGES
            clear.update(retirement='RELEASED',released=True);seal();self.assertEqual(m.local_guard(args,runner)[0],contract)

    def test_default_dormant_and_compile_without_capability(self):
        for path in (HERE/'manual_runtime_operations.py',Path(__file__)):compile(path.read_bytes(),str(path),'exec')
        with patch.object(m,'load_runner',side_effect=AssertionError('no import')),patch.object(m.subprocess,'Popen',side_effect=AssertionError('no SSH')):
            with contextlib.redirect_stdout(io.StringIO()) as output:self.assertEqual(m.main([]),0)
            self.assertIn('DORMANT',output.getvalue())
        self.assertEqual(m.QUALIFIED_PREIMAGES[m.RUNTIME]['schema'],'ir.runtime_native.layout_preimage.v1')
        self.assertIn('restore-pointer',m.load_runner().MANUAL_OPERATIONS)

if __name__=='__main__':unittest.main(verbosity=1)
