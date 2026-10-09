#!/usr/bin/env python3
"""Complete the already-installed R2: verify exact postimages and selectively purge. No install paths."""
import argparse, datetime, hashlib, json, sys
from pathlib import Path
sys.dont_write_bytecode=True
import deploy_release as d

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--execute',action='store_true');ap.add_argument('--approval',type=Path);ap.add_argument('--approval-sha256');a=ap.parse_args()
    manifest=d.HERE/'SEALED_RELEASE.json';m=json.loads(manifest.read_text());mh=d.sha(manifest);fh=d.sha(__file__);rh=d.sha(d.HERE/'remote_release_ops.py')
    d.check(mh=='20e3e87c07463aa91477b660d3098a3768dc638c83501fff6a32c690955bbb2a' and m['releaseId']==d.RELEASE,'R2 sealed package differs')
    head=d.git('rev-parse','HEAD');d.check(d.git('ls-remote','origin','refs/heads/codex/proof-intelligence-20260930').split()[0]==head,'controller remote custody missing')
    d.run(['git','merge-base','--is-ancestor',m['sourceCommit'],head],cwd=d.REPO)
    dependencies=[(Path(__file__),head)]+[(p,m['sourceCommit']) for p in [d.HERE/'deploy_release.py',d.HERE/'remote_release_ops.py',d.HERE/'seal_release.py',d.ROOT/'course_mapping.py']]
    for p,ref in dependencies:
        d.check(hashlib.sha256(d.run(['git','show',ref+':'+str(p.relative_to(d.REPO))],cwd=d.REPO)).hexdigest()==d.sha(p),'controller or approved dependency drift')
    for row in m['files']+[m['header']]:
        d.check(d.sha(d.REPO/row['source'])==row['sha256'],'candidate drift')
        d.check(hashlib.sha256(d.run(['git','show',m['sourceCommit']+':'+row['source']],cwd=d.REPO)).hexdigest()==row['sha256'],'sealed source differs')
    for e in m['evidence'].values():d.check(d.sha(e['path'])==e['sha256'],'sealed evidence drift')
    d.check(d.sha(m['archive']['path'])==m['archive']['sha256'],'private archive drift')
    d.check(d.sha(m['archive']['sourcePath'])==m['archive']['sourceSha256'],'private source drift')
    d.check(d.sha(d.ROOT/'registration-packet-r3/execute_registration.py')==m['credentialResolverSha256'],'credential resolver drift')
    for rel,digest in m['courseInputHashes'].items():d.check(d.sha(d.ROOT/rel)==digest,'classification drift')
    d.source_ready(json.loads(Path(m['archive']['path']).read_text()))
    recovery=d.ROOT/'evidence/R2_INSTALL_STOP_READBACK.json';recovery_hash=d.sha(recovery)
    d.check(recovery_hash=='e4965da8998fd60101441e12fea0d282f5d89325d54b78297121951b974022f9','recovery proof differs')
    def osgit(*args):return d.run(['git','-C',str(d.OS_ROOT),*args]).decode().strip()
    d.check(osgit('remote','get-url','origin')=='https://github.com/brinyu13/missionmed-os.git','OS origin differs')
    d.check(osgit('branch','--show-current')=='main' and not osgit('status','--porcelain','--untracked-files=all'),'OS checkout not clean main')
    d.check(osgit('rev-parse','HEAD')==m['authorityCommit'] and osgit('ls-remote','origin','refs/heads/main').split()[0]==m['authorityCommit'],'OS authority drift')
    for profile in [None,'PROOF-INTEL-1300']:
        cmd=[sys.executable,'-B',str(d.OS_ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git']
        if profile:cmd+=['--mission-profile',profile]
        d.run(cmd,cwd=d.OS_ROOT,timeout=30)
    paths=sorted(set([row['target'] for row in m['files']]+['wordpress/posts/6023/post_content','private/proof-intelligence']))
    d.validate_writer_scope('SHARED:ROUTING',paths,shared_domains=['ROUTING'])
    if not a.execute:print(json.dumps({'status':'FINALIZATION_VALIDATED_NO_MUTATION','controllerCommit':head,'controllerSha256':fh,'manifestSha256':mh}));return
    d.check(a.approval is not None and d.sha(a.approval)==a.approval_sha256,'exact finalization approval required')
    for token in ['PROOF_FINALIZATION_APPROVED=YES',mh,fh,rh,recovery_hash]:d.check(token in a.approval.read_text(),'approval does not bind finalization')
    client=d.private_client();session='proof-intel-1300-finalize-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')
    binding=d.binding_sha256({'mission':'PROOF-INTEL-1300','manifest':mh,'controller':fh,'controllerCommit':head,'sourceCommit':m['sourceCommit'],'remoteOps':rh,'approval':a.approval_sha256,'write_paths':paths,'operations':['verify','purge']})
    handle=client.acquire_writer(scope='SHARED:ROUTING',write_paths=paths,shared_domains=['ROUTING'],owner_id='codex-proof-intelligence-release',session_id=session,binding=binding)
    keeper=None;receipt={'releaseId':d.RELEASE,'sourceCommit':m['sourceCommit'],'controllerCommit':head,'manifestSha256':mh,'fencingEpoch':handle.fencing_epoch,'session':session,'operations':[],'normalRelease':False,'status':'LEASED'}
    def record():(d.ROOT/'evidence/DEPLOYMENT_FINALIZATION.json').write_text(json.dumps(receipt,indent=2)+'\n')
    try:
        keeper=d.WriterKeeper(client,handle);record()
        for operation in ['verify','purge']:
            payload={'manifest':m,'operation':operation,'remoteManifestSha256':mh}
            script=(d.HERE/'remote_release_ops.py').read_text()+'\npayload=json.loads('+repr(json.dumps(payload))+')\n'
            if operation=='verify':
                script+="activation=json.loads((PRIVATE/RELEASE/'RELEASE_MANIFEST.json').read_text())\n"
                script+="check(activation.get('approved') is True and activation.get('sourceGatePassed') is True and activation.get('release')==RELEASE and activation.get('sealedManifestSha256')==payload['remoteManifestSha256'] and activation.get('archiveSha256')==payload['manifest']['archive']['sha256'] and activation.get('sourceCommit')==payload['manifest']['sourceCommit'],'activation manifest differs')\n"
                script+="h=header();check(h['post_title']==payload['manifest']['header']['title'] and h['post_status']==payload['manifest']['header']['status'],'header identity differs')\n"
                script+="check(header_meta()==json.loads((PRIVATE/RELEASE/'preimage/post-6023-meta.json').read_text()),'header metadata differs')\n"
            script+='print(json.dumps(main(payload)))\n'
            out=keeper.guarded(lambda:d.monitored_run(keeper,['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',d.HOST,'python3','-'],input=script.encode(),timeout=25))
            receipt['operations'].append({'operation':operation,'result':json.loads(out)});record()
        receipt['status']='INSTALLED_VERIFIED_PURGED_REQUIRES_LIVE_QA'
    except Exception as exc:
        receipt['status']='STOPPED';receipt['errorType']=type(exc).__name__;receipt['keeperError']=keeper.error if keeper else None;raise
    finally:
        try:
            if keeper:keeper.release()
            else:client.release(handle)
            receipt['normalRelease']=True
        except Exception:receipt['normalRelease']=False
        receipt['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();record()
    print(json.dumps({k:receipt[k] for k in ['status','fencingEpoch','normalRelease']}))
if __name__=='__main__':main()
