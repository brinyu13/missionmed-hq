#!/usr/bin/env python3
"""Exact FPM-compatible private relocation and one-plugin CAS; no public corpus file."""
import argparse,datetime,hashlib,json,sys,tempfile,urllib.request,urllib.error
from pathlib import Path
sys.dont_write_bytecode=True
import deploy_release as d
RELEASE='PROOF-INTEL-1300-20261009-r3'
PRIVATE='/www/theresidencyacademy_209/deployments/proof-intelligence/'+RELEASE
R2_HASH='20e3e87c07463aa91477b660d3098a3768dc638c83501fff6a32c690955bbb2a'
CANDIDATE=d.HERE/'private-path-repair/missionmed-proof-intelligence.php'
MANIFEST=d.HERE/'PRIVATE_PATH_RELEASE.json'
def digest_bytes(b):return hashlib.sha256(b).hexdigest()
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--seal',action='store_true');ap.add_argument('--authority-commit');ap.add_argument('--execute',action='store_true');ap.add_argument('--approval',type=Path);ap.add_argument('--approval-sha256');a=ap.parse_args()
    old=json.loads((d.HERE/'SEALED_RELEASE.json').read_text());d.check(d.sha(d.HERE/'SEALED_RELEASE.json')==R2_HASH,'R2 manifest drift')
    head=d.git('rev-parse','HEAD');d.check(d.git('ls-remote','origin','refs/heads/codex/proof-intelligence-20260930').split()[0]==head,'source remote custody missing')
    for p in [Path(__file__),CANDIDATE]:d.check(digest_bytes(d.run(['git','show',head+':'+str(p.relative_to(d.REPO))],cwd=d.REPO))==d.sha(p),'repair source drift')
    for p in [d.HERE/'deploy_release.py',d.HERE/'remote_release_ops.py',d.HERE/'seal_release.py',d.ROOT/'course_mapping.py']:
        d.check(digest_bytes(d.run(['git','show',old['sourceCommit']+':'+str(p.relative_to(d.REPO))],cwd=d.REPO))==d.sha(p),'approved dependency drift')
    for row in old['files']+[old['header']]:d.check(d.sha(d.REPO/row['source'])==row['sha256'],'approved package drift')
    for e in old['evidence'].values():d.check(d.sha(e['path'])==e['sha256'],'prior evidence drift')
    d.check(d.sha(old['archive']['path'])==old['archive']['sha256'],'archive drift');d.source_ready(json.loads(Path(old['archive']['path']).read_text()))
    for rel,h in old['courseInputHashes'].items():d.check(d.sha(d.ROOT/rel)==h,'classification drift')
    d.check(d.sha(d.ROOT/'registration-packet-r3/execute_registration.py')==old['credentialResolverSha256'],'resolver drift')
    if a.seal:
        d.check(a.authority_commit and not a.execute,'exact registered authority required')
        manifest={'releaseId':RELEASE,'sourceCommit':head,'authorityCommit':a.authority_commit,'priorManifestSha256':R2_HASH,'pluginSha256':d.sha(CANDIDATE),'privateDestination':PRIVATE,'archiveSha256':old['archive']['sha256'],'controllerSha256':d.sha(__file__),'remoteOpsSha256':d.sha(d.HERE/'remote_release_ops.py')}
        MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'manifestSha256':d.sha(MANIFEST)}));return
    m=json.loads(MANIFEST.read_text());mh=d.sha(MANIFEST)
    d.check(m['releaseId']==RELEASE and m['sourceCommit']==head and m['controllerSha256']==d.sha(__file__) and m['pluginSha256']==d.sha(CANDIDATE) and m['privateDestination']==PRIVATE and m['archiveSha256']==old['archive']['sha256'] and m['remoteOpsSha256']==d.sha(d.HERE/'remote_release_ops.py'),'sealed repair drift')
    def osgit(*args):return d.run(['git','-C',str(d.OS_ROOT),*args]).decode().strip()
    d.check(osgit('remote','get-url','origin')=='https://github.com/brinyu13/missionmed-os.git' and osgit('branch','--show-current')=='main','authority origin/branch drift')
    d.check(not osgit('status','--porcelain','--untracked-files=no'),'authority tracked-content dirty')
    d.check(set(osgit('ls-files','--others','--exclude-standard').splitlines()) <= {'.DS_Store'},'unexpected authority untracked files')
    metadata=d.OS_ROOT/'.DS_Store';d.check(not metadata.is_symlink() and (not metadata.exists() or metadata.is_file()),'unexpected Finder metadata type')
    d.check(osgit('rev-parse','HEAD')==m['authorityCommit'] and osgit('ls-remote','origin','refs/heads/main').split()[0]==m['authorityCommit'],'authority custody drift')
    for profile in [None,'PROOF-INTEL-1300']:
        cmd=[sys.executable,'-B',str(d.OS_ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git']
        if profile:cmd+=['--mission-profile',profile]
        d.run(cmd,cwd=d.OS_ROOT,timeout=30)
    paths=['deployments',d.PLUGIN,d.PLUGIN+'.proof1300-new']
    d.validate_writer_scope('SHARED:ROUTING',paths,shared_domains=['ROUTING'])
    if not a.execute:print(json.dumps({'status':'PRIVATE_PATH_REPAIR_VALIDATED_NO_MUTATION','manifestSha256':mh}));return
    d.check(a.approval and d.sha(a.approval)==a.approval_sha256,'exact independent repair approval required')
    for token in ['PROOF_PRIVATE_PATH_REPAIR_APPROVED=YES',mh,m['controllerSha256'],m['authorityCommit'],m['pluginSha256']]:d.check(token in a.approval.read_text(),'approval binding missing')
    client=d.private_client();session='proof-intel-1300-storage-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S');binding=d.binding_sha256({'manifest':mh,'sourceCommit':head,'approval':a.approval_sha256,'write_paths':paths})
    handle=client.acquire_writer(scope='SHARED:ROUTING',write_paths=paths,shared_domains=['ROUTING'],owner_id='codex-proof-intelligence-release',session_id=session,binding=binding)
    keeper=None;receipt={'releaseId':RELEASE,'sourceCommit':head,'manifestSha256':mh,'fencingEpoch':handle.fencing_epoch,'session':session,'status':'LEASED','operations':[],'normalRelease':False}
    def record():(d.ROOT/'evidence/PRIVATE_PATH_REPAIR_TRANSACTION.json').write_text(json.dumps(receipt,indent=2)+'\n')
    activation={'release':RELEASE,'approved':True,'sourceGatePassed':True,'independentVerdict':a.approval_sha256,'archiveSha256':m['archiveSha256'],'sealedManifestSha256':mh,'sourceCommit':head}
    prefix=(d.HERE/'remote_release_ops.py').read_text()+'\nold=json.loads('+repr(json.dumps(old))+')\nnew=json.loads('+repr(json.dumps(m))+')\nactivation=json.loads('+repr(json.dumps(activation))+')\nbase=Path('+repr(PRIVATE)+')\n'
    prior_plugin=next(row['sha256'] for row in old['files'] if row['target']==d.PLUGIN)
    def remote(code):
        out=keeper.guarded(lambda:d.monitored_run(keeper,['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',d.HOST,'python3','-'],input=(prefix+code).encode(),timeout=25));return json.loads(out)
    try:
        keeper=d.WriterKeeper(client,handle);record()
        code="check(base.resolve()==base and PUBLIC not in base.parents,'unsafe private path')\nmain({'manifest':old,'operation':'verify','remoteManifestSha256':"+repr(R2_HASH)+"})\ncheck(not base.parent.parent.exists() and os.getuid()==1000,'unexpected deployment hierarchy or UID');base.parent.parent.mkdir(mode=0o700);base.parent.mkdir(mode=0o700);base.mkdir(mode=0o700)\nh=header();check(h['post_title']==old['header']['title'] and h['post_status']==old['header']['status'],'header identity drift');check(header_meta()==json.loads((PRIVATE/RELEASE/'preimage/post-6023-meta.json').read_text()),'header metadata drift')\n(base/'access-probe.txt').write_text('proof-private-probe-'+new['releaseId']);os.chmod(base/'access-probe.txt',0o600)\nprint(json.dumps({'privateDirectoryCreated':True}))\n"
        receipt['operations'].append(remote(code));record()
        probe='https://missionmedinstitute.com/deployments/proof-intelligence/'+RELEASE+'/access-probe.txt'
        try:
            with urllib.request.urlopen(probe,timeout=15) as response:status=response.status
        except urllib.error.HTTPError as e:status=e.code
        d.check(status in [403,404],'private directory public-denial probe failed');keeper.beat();receipt['publicProbeStatus']=status;record()
        code="source=PRIVATE/RELEASE/'archive.json'\ncheck(sha(source)==new['archiveSha256'],'source archive drift')\nwith (base/'archive.json').open('xb') as f:f.write(source.read_bytes())\nos.chmod(base/'archive.json',0o600)\ncheck(sha(base/'archive.json')==new['archiveSha256'] and sha(source)==new['archiveSha256'],'archive copy or donor differs')\nwith (base/'RELEASE_MANIFEST.json').open('x') as f:f.write(json.dumps(activation,indent=2)+'\\n')\nos.chmod(base/'RELEASE_MANIFEST.json',0o600)\nwith (base/'plugin-preimage.php').open('xb') as f:f.write(target(PLUGIN).read_bytes())\ncheck(sha(base/'plugin-preimage.php')=="+repr(prior_plugin)+",'plugin preimage drift')\nprint(json.dumps({'privateArchiveCopied':True,'backupVerified':True}))\n"
        receipt['operations'].append(remote(code));record()
        keeper.guarded(lambda:d.monitored_run(keeper,['scp','-q','-o','BatchMode=yes','-o','ConnectTimeout=10',str(CANDIDATE),d.HOST+':'+PRIVATE+'/plugin-candidate.php'],timeout=60))
        code="check(sha(base/'plugin-candidate.php')==new['pluginSha256'] and sha(target(PLUGIN))=="+repr(prior_plugin)+",'plugin CAS drift')\nr=subprocess.run(['php','-l',str(base/'plugin-candidate.php')],capture_output=True,timeout=10);check(r.returncode==0,'PHP lint failed')\natomic(base/'plugin-candidate.php',target(PLUGIN),0o644)\ncheck(sha(target(PLUGIN))==new['pluginSha256'],'plugin postimage differs')\nfor row in old['files']:\n if row['target']!=PLUGIN:check(sha(target(row['target']))==row['sha256'],'unrelated release file drift')\nh=header();check(header_hash(h)==old['header']['sha256'] and h['post_title']==old['header']['title'] and h['post_status']==old['header']['status'],'header drift');check(header_meta()==json.loads((PRIVATE/RELEASE/'preimage/post-6023-meta.json').read_text()),'header metadata drift')\nprint(json.dumps({'pluginInstalled':True,'otherPostimagesPreserved':True}))\n"
        receipt['operations'].append(remote(code));record()
        receipt['operations'].append(remote("print(json.dumps(main({'manifest':old,'operation':'purge','remoteManifestSha256':"+repr(R2_HASH)+"})))\n"));receipt['status']='PRIVATE_PATH_REPAIRED_REQUIRES_WEB_QA'
    except Exception as exc:receipt['status']='STOPPED';receipt['errorType']=type(exc).__name__;receipt['keeperError']=keeper.error if keeper else None;raise
    finally:
        try:
            if keeper:keeper.release()
            else:client.release(handle)
            receipt['normalRelease']=True
        except Exception:receipt['normalRelease']=False
        receipt['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();record()
    print(json.dumps({k:receipt[k] for k in ['status','fencingEpoch','normalRelease']}))
if __name__=='__main__':main()
