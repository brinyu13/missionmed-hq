#!/usr/bin/env python3
"""Refresh only the stale derived WPCode6023 code field through its native cache API."""
import argparse,datetime,hashlib,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
import deploy_release as d
EXPECTED='ed86d4e2ecb1b2f256e75004e6df1c30e0554f741085602aef21c3272f4dfe46'
OLD_CODE='a757821b0d23fd61a1308f5ed98635594038a6a841a4e8c07aa3d084bb10f280'
PRIVATE='/www/theresidencyacademy_209/deployments/proof-intelligence/PROOF-INTEL-1300-20261009-r3'
def main():
    p=argparse.ArgumentParser();p.add_argument('--authority',required=True);p.add_argument('--execute',action='store_true');p.add_argument('--approval',type=Path);p.add_argument('--approval-sha256');a=p.parse_args()
    head=d.git('rev-parse','HEAD');controller=d.sha(__file__);old=json.loads((d.HERE/'SEALED_RELEASE.json').read_text());r3=json.loads((d.HERE/'PRIVATE_PATH_RELEASE.json').read_text())
    d.check(d.sha(d.HERE/'SEALED_RELEASE.json')=='20e3e87c07463aa91477b660d3098a3768dc638c83501fff6a32c690955bbb2a','R2 manifest drift')
    d.check(d.sha(d.HERE/'PRIVATE_PATH_RELEASE.json')=='b91cfef931ec700c389ce55a8242eac08d6f0e407d7c76238318e541d1ecc0f6','R3 manifest drift')
    d.check(d.git('ls-remote','origin','refs/heads/codex/proof-intelligence-20260930').split()[0]==head,'source remote custody missing')
    for source,ref in [(Path(__file__),head),(d.HERE/'deploy_release.py',old['sourceCommit']),(d.HERE/'remote_release_ops.py',old['sourceCommit'])]:
        d.check(hashlib.sha256(d.run(['git','show',ref+':'+str(source.relative_to(d.REPO))],cwd=d.REPO)).hexdigest()==d.sha(source),'controller dependency drift')
    def osg(*args):return d.run(['git','-C',str(d.OS_ROOT),*args]).decode().strip()
    d.check(osg('remote','get-url','origin')=='https://github.com/brinyu13/missionmed-os.git' and osg('branch','--show-current')=='main','authority identity drift')
    d.check(not osg('status','--porcelain','--untracked-files=no') and set(osg('ls-files','--others','--exclude-standard').splitlines())<={'.DS_Store'},'authority dirty')
    meta=d.OS_ROOT/'.DS_Store';d.check(not meta.is_symlink() and (not meta.exists() or meta.is_file()),'unexpected metadata type')
    d.check(osg('rev-parse','HEAD')==a.authority and osg('ls-remote','origin','refs/heads/main').split()[0]==a.authority,'authority custody differs')
    for profile in [None,'PROOF-INTEL-1300']:
        command=[sys.executable,'-B',str(d.OS_ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git']
        if profile:command+=['--mission-profile',profile]
        d.run(command,cwd=d.OS_ROOT,timeout=30)
    paths=['wordpress/options/wpcode_snippets','deployments']
    d.validate_writer_scope('SHARED:ROUTING',paths,shared_domains=['ROUTING'])
    if not a.execute:print(json.dumps({'validated':True,'controllerSha256':controller,'sourceCommit':head}));return
    d.check(a.approval and d.sha(a.approval)==a.approval_sha256,'exact independent approval required')
    for token in ['PROOF_HEADER_CACHE_REFRESH_APPROVED=YES',controller,a.authority,EXPECTED]:d.check(token in a.approval.read_text(),'approval binding missing')
    client=d.private_client();binding=d.binding_sha256({'controller':controller,'sourceCommit':head,'authority':a.authority,'approval':a.approval_sha256,'expectedOption':EXPECTED,'write_paths':paths})
    session='proof-intel-1300-header-cache-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')
    handle=client.acquire_writer(scope='SHARED:ROUTING',write_paths=paths,shared_domains=['ROUTING'],owner_id='codex-proof-intelligence-release',session_id=session,binding=binding)
    keeper=None;receipt={'releaseId':r3['releaseId'],'controllerCommit':head,'authorityCommit':a.authority,'controllerSha256':controller,'fencingEpoch':handle.fencing_epoch,'session':session,'status':'LEASED','normalRelease':False,'operations':[]}
    def record():(d.ROOT/'evidence/HEADER_CACHE_REFRESH.json').write_text(json.dumps(receipt,indent=2)+'\n')
    prefix=(d.HERE/'remote_release_ops.py').read_text()+'\nm=json.loads('+repr(json.dumps(old))+')\nr3=json.loads('+repr(json.dumps(r3))+')\n'
    def remote(code):return json.loads(keeper.guarded(lambda:d.monitored_run(keeper,['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',d.HOST,'python3','-'],input=(prefix+code).encode(),timeout=25)))
    try:
        keeper=d.WriterKeeper(client,handle);record()
        php='''require_once ABSPATH.'wp-content/plugins/insert-headers-and-footers/includes/class-wpcode-snippet-cache.php';
function proof_check($ok,$msg){if(!$ok){throw new Exception($msg);}}
$cache=new WPCode_Snippet_Cache();$before=$cache->get_option();
proof_check(hash('sha256',serialize($before))==='EXPECTED','Option preimage drift');
$matches=0;foreach($before as $loc=>$rows){foreach($rows as $i=>$row){if(($row['id']??null)==6023){$matches++;proof_check($loc==='site_wide_header'&&$i===6,'Cache identity drift');}}}
proof_check($matches===1,'Ambiguous cache identity');$entry=$before['site_wide_header'][6];
proof_check(hash('sha256',$entry['code'])==='OLD_CODE'&&empty($entry['compiled_code'])&&$entry['code_type']==='html','Unexpected cached code');
$post=get_post(6023);proof_check(hash('sha256',$post->post_content)==='NEW_CODE','Postimage drift');
$backup='PRIVATE/header-cache-preimage.serialized';proof_check(!file_exists($backup)&&!is_link($backup),'Backup collision');
$f=fopen($backup,'x');proof_check($f!==false,'Backup create failed');fwrite($f,serialize($before));fclose($f);chmod($backup,0600);proof_check(hash_file('sha256',$backup)==='EXPECTED','Backup integrity');
$after=$before;$after['site_wide_header'][6]['code']=$post->post_content;
proof_check(hash('sha256',serialize($cache->get_option()))==='EXPECTED','Immediate cache preimage drift');
proof_check($cache->update_option($after),'Native cache update failed');$actual=$cache->get_option();proof_check(serialize($actual)===serialize($after),'Cache readback differs');
$preserved=$actual;$preserved['site_wide_header'][6]['code']=$entry['code'];proof_check(serialize($preserved)===serialize($before),'Unrelated cache changes');
echo json_encode(array('cacheRefreshed'=>true,'postId'=>6023,'onlyCodeChanged'=>true,'preimageSha256'=>'EXPECTED','postimageSha256'=>hash('sha256',serialize($actual))));'''.replace('EXPECTED',EXPECTED).replace('OLD_CODE',OLD_CODE).replace('NEW_CODE',old['header']['sha256']).replace('PRIVATE',PRIVATE)
        code="for row in m['files']:\n expected=r3['pluginSha256'] if row['target']==PLUGIN else row['sha256']\n check(sha(target(row['target']))==expected,'Runtime file drift')\ncheck(header_hash(header())==m['header']['sha256'],'Header drift')\ncheck(header_meta()==json.loads((PRIVATE/RELEASE/'preimage/post-6023-meta.json').read_text()),'Header metadata drift')\nprint(wp('eval',"+repr(php)+").decode())\n"
        receipt['operations'].append(remote(code));record()
        receipt['operations'].append(remote("print(json.dumps(main({'manifest':m,'operation':'purge','remoteManifestSha256':'20e3e87c07463aa91477b660d3098a3768dc638c83501fff6a32c690955bbb2a'})))\n"))
        receipt['status']='HEADER_CACHE_REFRESHED_REQUIRES_BROWSER_QA'
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
