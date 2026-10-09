#!/usr/bin/env python3
"""Exact-package guarded release. Independent approval mandatory; defaults to validation only."""
import argparse,datetime,hashlib,json,os,subprocess,sys,tempfile,threading,time
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent;REPO=ROOT.parents[2]
OS_ROOT=Path('/Users/brianb/MissionMed_OS_registrars/PROOF-INTEL-1300-recovery')
sys.path.insert(0,str(OS_ROOT/'tools'));sys.path.insert(0,str(ROOT/'registration-packet-r3'))
from engineering_os_lease import binding_sha256,validate_writer_scope
from execute_registration import private_client
from seal_release import source_ready
HOST='missionmed-kinsta';PUBLIC='/www/theresidencyacademy_209/public'
RELEASE='PROOF-INTEL-1300-20261009-r2';PRIVATE='/www/theresidencyacademy_209/private/proof-intelligence/'+RELEASE
ASSETS='wp-content/mu-plugins/missionmed-proof-intelligence-assets';PLUGIN='wp-content/mu-plugins/missionmed-proof-intelligence.php'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(v,m):
    if not v:raise RuntimeError(m)
def run(args,**kwargs):
    r=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kwargs)
    check(r.returncode==0,'bounded command failed; no raw credential output');return r.stdout
def git(*args):return run(['git',*args],cwd=REPO).decode().strip()
def record(data):
    (ROOT/'evidence/DEPLOYMENT_TRANSACTION.json').write_text(json.dumps(data,indent=2)+'\n')
def monitored_run(keeper,args,*,input=None,timeout=25):
    """Stop the SSH/SCP channel promptly if the official keeper loses its fence."""
    process=subprocess.Popen(args,stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    started=time.monotonic();first=True
    try:
        while True:
            check(keeper.error is None,'keeper lost during subprocess')
            check(time.monotonic()-started<timeout,'bounded subprocess timed out; inspect partial state')
            try:
                out,_=process.communicate(input=input if first else None,timeout=0.25)
                check(process.returncode==0,'bounded subprocess failed; inspect partial state');return out
            except subprocess.TimeoutExpired:first=False
    finally:
        if process.poll() is None:process.kill();process.communicate()

class WriterKeeper:
    """Unchanged official client/TTL and exact handle identity; no registry-only scope adapter."""
    def __init__(self,client,handle):
        self.client=client;self.handle=handle;self.lock=threading.Lock();self.stop=threading.Event();self.error=None
        self.beat();self.thread=threading.Thread(target=self.loop,daemon=True);self.thread.start()
    def beat(self):
        with self.lock:
            check(self.error is None,'writer keeper unhealthy')
            try:
                new=self.client.heartbeat(self.handle)
                check((new.lease_id,new.fencing_epoch,new.nonce,new.binding_sha256)==(self.handle.lease_id,self.handle.fencing_epoch,self.handle.nonce,self.handle.binding_sha256),'writer fence changed')
                self.handle=new
            except Exception as exc:
                status=getattr(exc,'status_code',getattr(exc,'code',None))
                self.error={'category':type(exc).__name__,'statusCode':status if isinstance(status,int) else None}
                raise RuntimeError('writer heartbeat failed closed') from None
    def loop(self):
        while not self.stop.wait(5):
            try:self.beat()
            except Exception:return
    def guarded(self,operation):
        self.beat();result=operation();self.beat();return result
    def release(self):
        self.stop.set();self.thread.join(timeout=6);check(not self.thread.is_alive() and self.error is None,'writer unhealthy; provider expiry/readback required')
        self.client.release(self.handle)

def main():
    a=argparse.ArgumentParser();a.add_argument('--manifest',type=Path,default=HERE/'SEALED_RELEASE.json');a.add_argument('--execute',action='store_true');a.add_argument('--rollback',action='store_true');a.add_argument('--approval',type=Path);a.add_argument('--approval-sha256');args=a.parse_args()
    m=json.loads(args.manifest.read_text());mh=sha(args.manifest);eh=sha(__file__);rh=sha(HERE/'remote_release_ops.py')
    check(m['releaseId']==RELEASE and m['sourceGatePassed'] is True,'manifest not source ready')
    check(m['authorityCommit']=='0008eeb458a8650f2d47dfd527d51013a3c6856b','authority binding differs')
    def os_git(*parts):return run(['git','-c','core.fsmonitor=false',*parts],cwd=OS_ROOT).decode().strip()
    check(os_git('remote','get-url','origin')=='https://github.com/brinyu13/missionmed-os.git','OS origin identity differs')
    check(os_git('rev-parse','--abbrev-ref','HEAD')=='main' and os_git('rev-parse','HEAD')==m['authorityCommit'],'OS authority HEAD differs')
    check(not os_git('status','--porcelain','--untracked-files=all'),'OS authority checkout dirty')
    check(os_git('ls-remote','origin','refs/heads/main').split()[0]==m['authorityCommit'],'live canonical authority advanced; refresh review')
    check(git('rev-parse','HEAD')==m['sourceCommit'],'source HEAD differs')
    check(git('ls-remote','origin','refs/heads/codex/proof-intelligence-20260930').split()[0]==m['sourceCommit'],'remote source custody differs')
    for label,e in m['evidence'].items():check(sha(e['path'])==e['sha256'],'evidence drift: '+label)
    for row in m['files']+[m['header']]:
        check(sha(REPO/row['source'])==row['sha256'],'local candidate drift')
        check(hashlib.sha256(run(['git','show',m['sourceCommit']+':'+row['source']],cwd=REPO)).hexdigest()==row['sha256'],'candidate not in source commit')
    check(sha(m['archive']['path'])==m['archive']['sha256'] and sha(m['archive']['sourcePath'])==m['archive']['sourceSha256'],'private data drift')
    for rel,digest in m.get('courseInputHashes',{}).items():check(sha(ROOT/rel)==digest,'Founder course mapping input drift')
    source_ready(json.loads(Path(m['archive']['path']).read_text()))
    for p in [Path(__file__),HERE/'remote_release_ops.py',HERE/'seal_release.py']:
        check(hashlib.sha256(run(['git','show',m['sourceCommit']+':'+str(p.relative_to(REPO))],cwd=REPO)).hexdigest()==sha(p),'release executor not in source custody')
    check(m.get('credentialResolverSha256')==sha(ROOT/'registration-packet-r3/execute_registration.py'),'reviewed private resolver differs')
    for profile in [None,'PROOF-INTEL-1300']:
        cmd=[sys.executable,'-B',str(OS_ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git']
        if profile:cmd+=['--mission-profile',profile]
        run(cmd,cwd=OS_ROOT,timeout=30)
    single_paths=[r['target'] for r in m['files'] if not r['target'].startswith(ASSETS+'/')]
    paths=sorted(set(single_paths+[p+'.proof1300-new' for p in single_paths]+[ASSETS,'wordpress/posts/6023/post_content','private/proof-intelligence']))
    validate_writer_scope('SHARED:ROUTING',paths,shared_domains=['ROUTING'])
    if not args.execute:
        print(json.dumps({'status':'LOCAL_PACKAGE_VALIDATED_NO_PROVIDER_MUTATION','manifestSha256':mh,'executorSha256':eh,'remoteOpsSha256':rh,'leaseScope':'SHARED:ROUTING','writePaths':paths}));return
    check(args.approval is not None and sha(args.approval)==args.approval_sha256,'exact independent approval required')
    verdict=args.approval.read_text()
    for token in ['PROOF_PRODUCTION_EXECUTOR_APPROVED=YES',mh,eh,rh]:check(token in verdict,'approval does not bind exact package/executor')
    # Live runtime/private-write authority requires independent final runtime/Matrix/preflight evidence.
    for key in ['runtimeSafety','scopedPreflight','matrixNoOverlap']:check(key in m['evidence'],'missing final safety evidence: '+key)
    client=private_client();session='proof-intel-1300-release-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')
    binding=binding_sha256({'mission':'PROOF-INTEL-1300','manifest':mh,'executor':eh,'remoteOps':rh,'sourceCommit':m['sourceCommit'],'approval':args.approval_sha256,'write_paths':paths,'mode':'rollback' if args.rollback else 'deploy'})
    handle=client.acquire_writer(scope='SHARED:ROUTING',write_paths=paths,shared_domains=['ROUTING'],owner_id='codex-proof-intelligence-release',session_id=session,binding=binding)
    keeper=None;receipt={'releaseId':RELEASE,'manifestSha256':mh,'sourceCommit':m['sourceCommit'],'session':session,'fencingEpoch':handle.fencing_epoch,'scope':'SHARED:ROUTING','writePaths':paths,'status':'LEASED','operations':[],'normalRelease':False}
    remote_text=(HERE/'remote_release_ops.py').read_text();remote_manifest=json.dumps(m,indent=2)+'\n';remote_manifest_hash=hashlib.sha256(remote_manifest.encode()).hexdigest()
    def remote(op,**extra):
        payload={'manifest':m,'operation':op,'remoteManifestSha256':remote_manifest_hash,**extra}
        script=remote_text+'\nprint(json.dumps(main(json.loads('+repr(json.dumps(payload))+'))))\n'
        out=keeper.guarded(lambda:monitored_run(keeper,['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',HOST,'python3','-'],input=script.encode(),timeout=25))
        result=json.loads(out);receipt['operations'].append({'operation':op,'result':result});record(receipt);return result
    def upload(source,target):
        keeper.guarded(lambda:monitored_run(keeper,['scp','-q','-o','BatchMode=yes','-o','ConnectTimeout=10',str(source),HOST+':'+target],timeout=180))
    try:
        keeper=WriterKeeper(client,handle);record(receipt)
        if args.rollback:
            remote('rollback-header')
            for row in reversed(m['files']):
                if not row['target'].startswith(ASSETS+'/'):remote('rollback-file',row=row)
            remote('rollback-assets');remote('purge');receipt['status']='SCOPED_ROLLBACK_APPLIED_REQUIRES_LIVE_QA'
        else:
            remote('backup')
            reused=set(remote('reuse-stage')['reused'])
            check(reused <= {row['target'] for row in m['files']},'unexpected reused staging target')
            for row in m['files']:
                if row['target'] not in reused:upload(REPO/row['source'],PRIVATE+'/stage/'+row['target'])
            upload(REPO/m['header']['source'],PRIVATE+'/stage/post-6023-content.html');upload(m['archive']['path'],PRIVATE+'/stage/archive.json')
            activation={'release':RELEASE,'approved':True,'sourceGatePassed':True,'independentVerdict':args.approval_sha256,'archiveSha256':m['archive']['sha256'],'sealedManifestSha256':mh,'sourceCommit':m['sourceCommit']}
            with tempfile.TemporaryDirectory(prefix='proof-activation-') as td:
                p=Path(td)/'RELEASE_MANIFEST.json';p.write_text(json.dumps(activation,indent=2)+'\n');p.chmod(0o600);activation_hash=sha(p);upload(p,PRIVATE+'/stage/RELEASE_MANIFEST.json')
            remote('verify-stage',runtimeManifestSha256=activation_hash);remote('install-assets')
            order=sorted([r for r in m['files'] if not r['target'].startswith(ASSETS+'/')],key=lambda r:0 if r['target']==PLUGIN else 1)
            for row in order:remote('install-file',row=row)
            remote('install-header');remote('verify');remote('purge');receipt['runtimeManifestSha256']=activation_hash;receipt['status']='INSTALLED_HASH_VERIFIED_REQUIRES_LIVE_QA'
        record(receipt)
    except Exception as exc:
        receipt['status']='STOPPED_REVIEW_PARTIAL_STATE';receipt['errorType']=type(exc).__name__;receipt['keeperError']=keeper.error if keeper else None;record(receipt);raise
    finally:
        if keeper:
            try:keeper.release();receipt['normalRelease']=True
            except Exception:receipt['normalRelease']=False
        else:
            try:client.release(handle);receipt['normalRelease']=True
            except Exception:receipt['normalRelease']=False
        receipt['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();record(receipt)
    print(json.dumps({k:receipt[k] for k in ['status','session','fencingEpoch','normalRelease']}))
if __name__=='__main__':main()
