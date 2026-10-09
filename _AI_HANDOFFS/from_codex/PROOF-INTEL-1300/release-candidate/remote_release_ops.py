"""Reviewed SSH operations; invoked one bounded operation per healthy local fence. No secrets."""
import base64,hashlib,json,os,shutil,subprocess
from pathlib import Path,PurePosixPath
PUBLIC=Path('/www/theresidencyacademy_209/public')
PRIVATE=Path('/www/theresidencyacademy_209/private/proof-intelligence')
RELEASE='PROOF-INTEL-1300-20261009-r2'
ASSETS='wp-content/mu-plugins/missionmed-proof-intelligence-assets'
PLUGIN='wp-content/mu-plugins/missionmed-proof-intelligence.php'
EXISTING={'wp-content/mu-plugins/missionmed-mr-p0.php','wp-content/mu-plugins/missionmed-mr-alternate-assets/page.php','wp-content/mu-plugins/missionmed-mr-0912-assets/premium-hero/hero.js','wp-content/mu-plugins/missionmed-mr-0912-assets/premium-hero/hero.css'}
def check(v,m):
    if not v:raise RuntimeError(m)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def target(rel):
    check(rel in EXISTING or rel==PLUGIN or rel.startswith(ASSETS+'/'),'target outside exact release scope')
    check(str(PurePosixPath(rel))==rel and '..' not in PurePosixPath(rel).parts,'invalid target')
    p=PUBLIC/rel;check(p.resolve()==p,'symlink target/ancestor denied');return p
def wp(*args):
    r=subprocess.run(['wp','--path='+str(PUBLIC),'--skip-plugins','--skip-themes',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15)
    check(r.returncode==0,'native WP operation failed');return r.stdout
def header():return json.loads(wp('post','get','6023','--format=json'))
def header_hash(h):return hashlib.sha256(h['post_content'].encode()).hexdigest()
def header_meta():
    rows=json.loads(wp('post','meta','list','6023','--format=json'))
    return sorted(rows,key=lambda r:json.dumps(r,sort_keys=True))
def atomic(source,destination,mode):
    temp=destination.with_name(destination.name+'.proof1300-new')
    check(not temp.exists(),'temporary target collision')
    with temp.open('xb') as f:f.write(source.read_bytes())
    os.chmod(temp,mode);os.replace(temp,destination)
def main(payload):
    m=payload['manifest'];check(m['releaseId']==RELEASE,'release identity differs')
    base=PRIVATE/RELEASE;check(base.resolve()==base,'private symlink denied')
    stage=base/'stage';pre=base/'preimage';op=payload['operation']
    if op=='backup':
        for row in m['files']:
            t=target(row['target']);old=row['preimageSha256']
            check((t.is_file() and sha(t)==old) if old else not t.exists(),'runtime preimage drift')
        check(not (PUBLIC/ASSETS).exists(),'new assets directory exists')
        h=header();check(header_hash(h)==m['header']['preimageSha256'] and h['post_status']==m['header']['status'] and h['post_title']==m['header']['title'],'header drift')
        PRIVATE.mkdir(mode=0o700,exist_ok=True);base.mkdir(mode=0o700);stage.mkdir(mode=0o700);pre.mkdir(mode=0o700)
        for row in m['files']:
            if row['preimageSha256']:
                p=pre/row['target'];p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target(row['target']),p);check(sha(p)==row['preimageSha256'],'backup hash differs')
        (pre/'post-6023.json').write_text(json.dumps(h,ensure_ascii=False)+'\n');(pre/'post-6023-content.html').write_text(h['post_content']);(pre/'post-6023-meta.json').write_text(json.dumps(header_meta(),sort_keys=True)+'\n')
        for row in m['files']:(stage/row['target']).parent.mkdir(parents=True,exist_ok=True)
        (base/'SEALED_RELEASE.json').write_text(json.dumps(m,indent=2)+'\n')
        return {'backup':'verified','privateDirectory':str(base)}
    check(base.is_dir() and sha(base/'SEALED_RELEASE.json')==payload['remoteManifestSha256'],'private sealed manifest drift')
    if op=='reuse-stage':
        donor=PRIVATE/'PROOF-INTEL-1300-20261009-r1'
        check(donor.resolve()==donor,'staging donor symlink denied')
        check(sha(donor/'SEALED_RELEASE.json')=='7376ebdf9dccb0f16e262c5e158ad73ec99a1b104981b3f3004b52d09c1a57e0','r1 donor manifest differs')
        reused=[]
        for row in m['files']:
            source=donor/'stage'/row['target'];destination=stage/row['target']
            check(source.resolve()==source,'staging donor path symlink denied')
            if not source.is_file() or sha(source)!=row['sha256']:continue
            check(not destination.exists(),'staging reuse destination exists')
            with destination.open('xb') as f:f.write(source.read_bytes())
            os.chmod(destination,0o600)
            check(sha(source)==row['sha256'] and sha(destination)==row['sha256'],'staging reuse hash differs')
            reused.append(row['target'])
        return {'reused':reused,'donorReadOnly':True}
    if op=='verify-stage':
        for row in m['files']:check(sha(stage/row['target'])==row['sha256'],'upload hash differs')
        check(sha(stage/'archive.json')==m['archive']['sha256'],'archive upload differs')
        check(sha(stage/'post-6023-content.html')==m['header']['sha256'],'header upload differs')
        for row in m['files']:
            if row['target'].endswith('.php'):
                r=subprocess.run(['php','-l',str(stage/row['target'])],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10);check(r.returncode==0,'PHP lint failed')
        check(sha(stage/'RELEASE_MANIFEST.json')==payload['runtimeManifestSha256'],'activation manifest differs')
        for name in ['archive.json','RELEASE_MANIFEST.json']:
            check(not (base/name).exists(),'private destination exists');os.rename(stage/name,base/name);os.chmod(base/name,0o600)
        return {'stage':'verified'}
    if op=='install-assets':
        check(not (PUBLIC/ASSETS).exists(),'assets destination drift');os.rename(stage/ASSETS,PUBLIC/ASSETS)
        for p in (PUBLIC/ASSETS).rglob('*'):os.chmod(p,0o755 if p.is_dir() else 0o644)
        os.chmod(PUBLIC/ASSETS,0o755);return {'assets':'installed'}
    if op=='install-file':
        row=payload['row'];check(row in m['files'] and not row['target'].startswith(ASSETS+'/'),'row not sealed single file')
        t=target(row['target']);old=row['preimageSha256'];check((t.is_file() and sha(t)==old) if old else not t.exists(),'preimage changed immediately before replacement')
        check(sha(stage/row['target'])==row['sha256'],'staged candidate drift');mode=(t.stat().st_mode&0o777) if old else 0o644
        atomic(stage/row['target'],t,mode);check(sha(t)==row['sha256'],'installed hash differs');return {'installed':row['target']}
    if op=='install-header':
        h=header();check(header_hash(h)==m['header']['preimageSha256'] and h['post_status']==m['header']['status'] and h['post_title']==m['header']['title'],'header preimage/identity changed')
        check(header_meta()==json.loads((pre/'post-6023-meta.json').read_text()),'header metadata changed')
        wp('post','update','6023',str(stage/'post-6023-content.html'))
        h=header();check(header_hash(h)==m['header']['sha256'] and h['post_status']==m['header']['status'] and h['post_title']==m['header']['title'],'header postimage differs')
        check(header_meta()==json.loads((pre/'post-6023-meta.json').read_text()),'header metadata changed during update')
        return {'header':'installed'}
    if op=='verify':
        for row in m['files']:check(sha(target(row['target']))==row['sha256'],'live candidate hash differs')
        check(header_hash(header())==m['header']['sha256'],'live header differs');check(sha(base/'archive.json')==m['archive']['sha256'],'private archive differs')
        return {'allPostimages':'verified'}
    if op=='purge':
        urls=['https://missionmedinstitute.com/','https://missionmedinstitute.com/missionresidency/','https://missionmedinstitute.com/testimonials/','https://missionmedinstitute.com/testimonials/api/catalog','https://missionmedinstitute.com/testimonials/api/stories','https://missionmedinstitute.com/testimonials/api/featured']
        encoded=base64.b64encode(json.dumps(urls).encode()).decode()
        code="global $kinsta_muplugin; if(!is_object($kinsta_muplugin)||!is_object($kinsta_muplugin->kinsta_cache_purge)){throw new Exception('Kinsta purge unavailable');} $urls=json_decode(base64_decode('"+encoded+"'),true); $request=$kinsta_muplugin->kinsta_cache_purge->convert_purge_list_to_request(array('single'=>$urls,'group'=>array())); $result=$kinsta_muplugin->kinsta_cache_purge->send_cache_purge_request($kinsta_muplugin->kinsta_cache->config['immediate_path'],$request); if(($result['response_code']??0)!=200||($result['error_code']??1)!=0){throw new Exception('Selective purge failed');} echo json_encode(array('selectivePurge'=>true,'urlCount'=>count($urls)));"
        return json.loads(wp('eval',code))
    if op=='rollback-file':
        row=payload['row'];check(row in m['files'] and not row['target'].startswith(ASSETS+'/'),'invalid rollback row');t=target(row['target'])
        if not t.exists() and row['preimageSha256'] is None:return {'alreadyAbsent':row['target']}
        if row['preimageSha256'] and sha(t)==row['preimageSha256']:return {'alreadyOriginal':row['target']}
        check(sha(t)==row['sha256'],'foreign live drift blocks rollback')
        if row['preimageSha256']:
            check(sha(pre/row['target'])==row['preimageSha256'],'backup drift');atomic(pre/row['target'],t,t.stat().st_mode&0o777)
        else:
            quarantine=base/'quarantine';quarantine.mkdir(exist_ok=True);os.rename(t,quarantine/t.name)
        return {'restored':row['target']}
    if op=='rollback-header':
        h=header()
        if header_hash(h)==m['header']['preimageSha256']:return {'header':'already original'}
        check(header_hash(h)==m['header']['sha256'],'foreign header drift blocks rollback');wp('post','update','6023',str(pre/'post-6023-content.html'));check(header_hash(header())==m['header']['preimageSha256'],'header restore differs');return {'header':'restored'}
    if op=='rollback-assets':
        if not (PUBLIC/ASSETS).exists():return {'assets':'already absent'}
        actual={str(p.relative_to(PUBLIC)) for p in (PUBLIC/ASSETS).rglob('*') if p.is_file()};expected={r['target'] for r in m['files'] if r['target'].startswith(ASSETS+'/')};check(actual==expected,'foreign asset paths block quarantine')
        for row in m['files']:
            if row['target'].startswith(ASSETS+'/'):check(sha(target(row['target']))==row['sha256'],'foreign asset bytes block quarantine')
        quarantine=base/'quarantine';quarantine.mkdir(exist_ok=True);os.rename(PUBLIC/ASSETS,quarantine/'assets');return {'assets':'quarantined'}
    raise RuntimeError('unsupported operation')
