#!/usr/bin/env python3
"""Exclude the exact unauthenticated homepage widget without changing stored content."""
import argparse,datetime,hashlib,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
import deploy_release as d
PRIVATE='/www/theresidencyacademy_209/deployments/proof-intelligence/PROOF-INTEL-1300-20261009-r3'
def main():
    p=argparse.ArgumentParser();p.add_argument('--authority',required=True);p.add_argument('--execute',action='store_true');p.add_argument('--approval',type=Path);p.add_argument('--approval-sha256');a=p.parse_args()
    head=d.git('rev-parse','HEAD');controller=d.sha(__file__);old=json.loads((d.HERE/'SEALED_RELEASE.json').read_text());r3=json.loads((d.HERE/'PRIVATE_PATH_RELEASE.json').read_text());previous_commit='0976b10d984ab5cf032199adda9103335befeca5'
    d.check(d.sha(d.HERE/'SEALED_RELEASE.json')=='20e3e87c07463aa91477b660d3098a3768dc638c83501fff6a32c690955bbb2a','R2 manifest drift')
    d.check(d.sha(d.HERE/'PRIVATE_PATH_RELEASE.json')=='b91cfef931ec700c389ce55a8242eac08d6f0e407d7c76238318e541d1ecc0f6','R3 manifest drift')
    d.check(d.git('ls-remote','origin','refs/heads/codex/proof-intelligence-20260930').split()[0]==head,'source remote custody missing')
    for source,ref in [(Path(__file__),head),(d.HERE/'homepage-source-gate/missionmed-proof-intelligence.php',head),(d.HERE/'deploy_release.py',old['sourceCommit']),(d.HERE/'remote_release_ops.py',old['sourceCommit']),(d.HERE/'seal_release.py',old['sourceCommit']),(d.ROOT/'course_mapping.py',old['sourceCommit'])]:
        d.check(hashlib.sha256(d.run(['git','show',ref+':'+str(source.relative_to(d.REPO))],cwd=d.REPO)).hexdigest()==d.sha(source),'controller dependency drift')
    d.check(d.sha(d.ROOT/'registration-packet-r3/execute_registration.py')==old['credentialResolverSha256'],'credential resolver drift')
    def osg(*args):return d.run(['git','-C',str(d.OS_ROOT),*args]).decode().strip()
    d.check(osg('remote','get-url','origin')=='https://github.com/brinyu13/missionmed-os.git' and osg('branch','--show-current')=='main','authority identity drift')
    d.check(not osg('status','--porcelain','--untracked-files=no') and set(osg('ls-files','--others','--exclude-standard').splitlines())<={'.DS_Store'},'authority dirty')
    meta=d.OS_ROOT/'.DS_Store';d.check(not meta.is_symlink() and (not meta.exists() or meta.is_file()),'unexpected metadata type')
    d.check(osg('rev-parse','HEAD')==a.authority and osg('ls-remote','origin','refs/heads/main').split()[0]==a.authority,'authority custody differs')
    for profile in [None,'PROOF-INTEL-1300']:
        command=[sys.executable,'-B',str(d.OS_ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git']
        if profile:command+=['--mission-profile',profile]
        d.run(command,cwd=d.OS_ROOT,timeout=30)
    paths=[d.PLUGIN,d.PLUGIN+'.proof1300-new','deployments']
    d.validate_writer_scope('SHARED:ROUTING',paths,shared_domains=['ROUTING'])
    if not a.execute:print(json.dumps({'validated':True,'controllerSha256':controller,'sourceCommit':head}));return
    d.check(a.approval and d.sha(a.approval)==a.approval_sha256,'exact independent approval required')
    for token in ['PROOF_HOMEPAGE_SOURCE_GATE_APPROVED=YES',controller,a.authority,d.sha(d.HERE/'homepage-source-gate/missionmed-proof-intelligence.php')]:d.check(token in a.approval.read_text(),'approval binding missing')
    client=d.private_client();binding=d.binding_sha256({'controller':controller,'sourceCommit':head,'authority':a.authority,'approval':a.approval_sha256,'plugin':d.sha(d.HERE/'homepage-source-gate/missionmed-proof-intelligence.php'),'write_paths':paths})
    session='proof-intel-1300-homepage-gate-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')
    handle=client.acquire_writer(scope='SHARED:ROUTING',write_paths=paths,shared_domains=['ROUTING'],owner_id='codex-proof-intelligence-release',session_id=session,binding=binding)
    keeper=None;receipt={'releaseId':'PROOF-INTEL-1300-20261009-r5','controllerCommit':head,'authorityCommit':a.authority,'controllerSha256':controller,'fencingEpoch':handle.fencing_epoch,'session':session,'status':'LEASED','normalRelease':False,'operations':[]}
    def record():(d.ROOT/'evidence/HOMEPAGE_SOURCE_GATE_R5_RELEASE.json').write_text(json.dumps(receipt,indent=2)+'\n')
    prefix=(d.HERE/'remote_release_ops.py').read_text()+'\nm=json.loads('+repr(json.dumps(old))+')\nr3=json.loads('+repr(json.dumps(r3))+')\n'
    def remote(code):return json.loads(keeper.guarded(lambda:d.monitored_run(keeper,['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',d.HOST,'python3','-'],input=(prefix+code).encode(),timeout=25)))
    previous_plugin=hashlib.sha256(d.run(['git','show',previous_commit+':'+str((d.HERE/'homepage-source-gate/missionmed-proof-intelligence.php').relative_to(d.REPO))],cwd=d.REPO)).hexdigest()
    candidate=d.HERE/'homepage-source-gate/missionmed-proof-intelligence.php';candidate_sha=d.sha(candidate)
    activation={'release':receipt['releaseId'],'approved':True,'sourceGatePassed':True,'independentVerdict':a.approval_sha256,'archiveSha256':r3['archiveSha256'],'sourceCommit':head,'pluginSha256':candidate_sha,'priorSealedManifestSha256':d.sha(d.HERE/'PRIVATE_PATH_RELEASE.json')}
    prefix+='\nprevious_commit='+repr(previous_commit)+'\nprevious_plugin='+repr(previous_plugin)+'\nbase=Path('+repr(PRIVATE)+')\nactivation=json.loads('+repr(json.dumps(activation))+')\n'
    before="for row in m['files']:\n expected=previous_plugin if row['target']==PLUGIN else row['sha256']\n check(sha(target(row['target']))==expected,'Runtime file drift')\nh=header();check(header_hash(h)==m['header']['sha256'] and h['post_title']==m['header']['title'] and h['post_status']==m['header']['status'],'Header drift')\ncheck(header_meta()==json.loads((PRIVATE/RELEASE/'preimage/post-6023-meta.json').read_text()),'Header metadata drift')\n"
    after=before.replace("previous_plugin","activation['pluginSha256']")
    try:
        keeper=d.WriterKeeper(client,handle);record()
        code=before+"check(base.resolve()==base,'Private symlink denied')\nprior=json.loads((base/'RELEASE_MANIFEST.json').read_text());check(prior['release']=='PROOF-INTEL-1300-20261009-r4' and prior['sourceCommit']==previous_commit and prior['pluginSha256']==previous_plugin and prior['priorSealedManifestSha256']==activation['priorSealedManifestSha256'],'Activation preimage drift')\ncheck(sha(base/'archive.json')==activation['archiveSha256'],'Archive drift')\nfor name,source in [('r5-plugin-preimage.php',target(PLUGIN)),('r5-manifest-preimage.json',base/'RELEASE_MANIFEST.json')]:\n with (base/name).open('xb') as f:f.write(source.read_bytes())\n os.chmod(base/name,0o600)\n check(sha(base/name)==sha(source),'Backup drift')\nprint(json.dumps({'preimagesVerified':True}))\n"
        receipt['operations'].append(remote(code));record()
        keeper.guarded(lambda:d.monitored_run(keeper,['scp','-q','-o','BatchMode=yes','-o','ConnectTimeout=10',str(candidate),d.HOST+':'+PRIVATE+'/r5-plugin-candidate.php'],timeout=60))
        code=before+"check(sha(base/'r5-plugin-candidate.php')==activation['pluginSha256'],'Candidate drift')\nr=subprocess.run(['php','-l',str(base/'r5-plugin-candidate.php')],capture_output=True,timeout=10);check(r.returncode==0,'PHP lint failed')\ncheck(sha(base/'RELEASE_MANIFEST.json')==sha(base/'r5-manifest-preimage.json'),'Activation CAS drift')\natomic(base/'r5-plugin-candidate.php',target(PLUGIN),0o644)\nwith (base/'r5-manifest-candidate.json').open('x') as f:f.write(json.dumps(activation,indent=2)+'\\n')\nos.chmod(base/'r5-manifest-candidate.json',0o600)\natomic(base/'r5-manifest-candidate.json',base/'RELEASE_MANIFEST.json',0o600)\n"+after+"check(json.loads((base/'RELEASE_MANIFEST.json').read_text())==activation,'Activation readback differs')\ncheck(sha(base/'archive.json')==activation['archiveSha256'],'Archive changed')\nprint(json.dumps({'pluginInstalled':True,'activationUpdated':True,'unrelatedPreserved':True}))\n"
        receipt['operations'].append(remote(code));record()
        php="global $kinsta_muplugin;$p=$kinsta_muplugin->kinsta_cache_purge;$urls=array('home_blog_page'=>'https://missionmedinstitute.com/','custom|0'=>'https://missionmedinstitute.com/missionresidency/','custom|1'=>'https://missionmedinstitute.com/testimonials/','custom|2'=>'https://missionmedinstitute.com/testimonials/api/catalog','custom|3'=>'https://missionmedinstitute.com/testimonials/api/stories','custom|4'=>'https://missionmedinstitute.com/testimonials/api/featured');$request=$p->convert_purge_list_to_request(array('single'=>$urls,'group'=>array()));$result=$p->send_cache_purge_request($kinsta_muplugin->kinsta_cache->config['immediate_path'],$request);if(($result['response_code']??0)!=200||($result['error_code']??1)!=0){throw new Exception('Native selective purge failed');}echo json_encode(array('selectivePurge'=>true,'nativeKeys'=>array_keys($request),'responseCode'=>$result['response_code'],'responseBodySha256'=>hash('sha256',$result['response_body'])));"
        receipt['operations'].append(remote("print(wp('eval',"+repr(php)+").decode())\n"))
        receipt['status']='R5_INSTALLED_REQUIRES_HOMEPAGE_QA'
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
