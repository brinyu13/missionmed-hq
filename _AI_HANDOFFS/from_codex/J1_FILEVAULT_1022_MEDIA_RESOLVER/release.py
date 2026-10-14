#!/usr/bin/env python3
"""DR-440 bounded File Vault cinematic media resolver repair. No credentials or application data are read.
The Foreman must approve the sealed manifest and independent review before prepare/stage/activate.
"""
import argparse,hashlib,json,os,shlex,subprocess,sys,tarfile,time,urllib.request
if sys.flags.optimize != 0:
 raise RuntimeError("Release guards require unoptimized Python")
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_MEDIA_RESOLVER'
STATUS=Path('/tmp/filevault-media-status.json')
APPROVED='20fbdc38a48b92535214c79c738b0fbc141f8c16'
REMOTE='/www/theresidencyacademy_209/public'
BACKUP='/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/J1-FILEVAULT-1022-MEDIA/20261014T143427Z'
PREFIX='wp-content/plugins/missionmed-hub/'
CONTROLLER=PREFIX+'includes/class-mmed-file-vault-v2.php'
JS=PREFIX+'assets/student-os-file-vault-v2.js';CSS=PREFIX+'assets/student-os-file-vault-v2.css'
NEW_JS=PREFIX+'assets/student-os-file-vault-v2.2248e4c648e596bc.js'
OLD={CONTROLLER:'9f3721fb0e5a6677426de715ec1e79e448fdf55c16d5a0bfe1cf26cac997713d',JS:'960a6069c8ea8967acaf4e6d78ddae1c0ef57beb7e10b85e6900bcdbfd53af27'}
SENTINELS={PREFIX+'includes/class-mmed-file-vault-v2-repository.php':'a97842553c9c1d997d80903cb367b9ffba5c80a9967b6b3a5a43c5143c0f4896','wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php':'6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a',PREFIX+'assets/student-os-file-vault.js':'f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd',PREFIX+'assets/student-os-file-vault.css':'6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990'}
def sha(b):return hashlib.sha256(b).hexdigest()
FENCES=[{'scope': 'PRODUCT:FILE-VAULT', 'epoch': 5945}, {'scope': 'PATH:c4785fad62e14454abca03e8a96505cc4df5e6df0579e303aab5db5aeea1746e', 'epoch': 5946}, {'scope': 'PATH:ba82c943dd3aa6a0752fb2f20708b4a4b4f50d971d1c1b6b2ad71fba28033a0d', 'epoch': 5947}, {'scope': 'PATH:a6a9f56f2a47ca8ed55f497d180e4ba3c5b74d36154ae74edc40b8be9ee17c5b', 'epoch': 5948}, {'scope': 'PATH:4dca78c43a480e75c1659c5497522b51ea02d102518f75da668971fbd4b6a52b', 'epoch': 5949}, {'scope': 'PATH:a4ec65d45e11b81c73ab2a802b40f5c8bfd700a2ac3773eb91fd8a553854710e', 'epoch': 5950}, {'scope': 'PATH:b78c44a61a3fe440e56b3c84ef76d90b9c79ffd39abba7903c6b7cd7b69ba166', 'epoch': 5953}]
def lease():
 observed=[]
 for status in [STATUS,Path('/tmp/filevault-media-immutable-status.json')]:
  s=json.loads(status.read_text());assert s['state']=='healthy' and 0<=time.time()-s['at_unix']<15,'Lease is not fresh/healthy'
  assert s['mission']=='J1-FILEVAULT-1022-PIXEL-FIDELITY' and s['owner_id']=='codex-filevault-foreman','Mission/owner mismatch'
  observed.extend({'scope':x['scope'],'epoch':x['epoch']} for x in s['scopes'])
 assert observed==FENCES,'Fencing identity changed'
 return s
def save(name,value):
 lease();OUT.mkdir(parents=True,exist_ok=True);(OUT/name).write_text(json.dumps(value,indent=2)+'\n')
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT).decode().strip()
def manifest():
 subprocess.run(['git','merge-base','--is-ancestor',APPROVED,'HEAD'],cwd=ROOT,check=True)
 baseline=json.loads((ROOT/'_AI_HANDOFFS/from_codex/MX_GX_20261013_001_FILEVAULT_RETURN/release-manifest.json').read_text())
 sentinels=dict(baseline['sentinels']);sentinels.update(SENTINELS)
 for t in baseline['targets']:
  if t['path'] not in OLD:sentinels[t['path']]=t['sha256']
 for p,h in sentinels.items():assert sha((ROOT/p).read_bytes())==h,'Preserved source changed: '+p
 hashes={JS:'2248e4c648e596bce984da5efafe89d5360aee1009a359e00faf11d7d4adc0e7'}
 for p,h in hashes.items():assert sha((ROOT/p).read_bytes())==h
 assert (ROOT/NEW_JS).read_bytes()==(ROOT/JS).read_bytes()
 old=subprocess.check_output(['git','show',APPROVED+':'+CONTROLLER],cwd=ROOT)
 expected=old.replace(b'student-os-file-vault-v2.960a6069c8ea8967.js',b'student-os-file-vault-v2.2248e4c648e596bc.js')
 anchor=b"\t\t\t\t'matrixUrl'   => home_url( '/member-dashboard/' ),"
 assert expected.count(anchor)==1
 expected=expected.replace(anchor,anchor+b"\n\t\t\t\t'cinematicAssetsUrl' => MMED_HUB_URL . 'assets/file-vault-cinematic/',")
 assert (ROOT/CONTROLLER).read_bytes()==expected,'Controller change exceeds config and mechanical pin'
 paths=[NEW_JS,JS,CONTROLLER]
 for p in paths:assert (ROOT/p).read_bytes()==subprocess.check_output(['git','show','HEAD:'+p],cwd=ROOT),'Uncommitted target bytes: '+p
 return {'authority':'DR-440','approved':APPROVED,'source_head':git('rev-parse','HEAD'),'root':REMOTE,'backup':BACKUP,'fences':FENCES,'targets':[{'path':p,'sha256':sha((ROOT/p).read_bytes()),'bytes':(ROOT/p).stat().st_size,'preimage':OLD.get(p)} for p in paths],'sentinels':sentinels,'excluded':['media','ASSETS.json','fixtures','tests','handoffs','student data']}
REMOTE_CODE=r"""
import sys,json,hashlib,os,shutil,stat,tarfile,subprocess
os.umask(0o077)
if sys.flags.optimize != 0:
 raise RuntimeError("Remote release guards require unoptimized Python")
from pathlib import Path
v=json.load(sys.stdin);m=v['manifest'];mode=v['mode'];root=Path(m['root']);backup=Path(m['backup'])
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def current(p):
 assert not p.is_symlink(),'Symlink target'
 assert not p.exists() or p.is_file(),'Unexpected non-regular target'
 return digest(p) if p.is_file() else None
for p,h in m['sentinels'].items():assert current(root/p)==h,'Sentinel drift: '+p
rows=[]
for t in m['targets']:
 p=root/t['path'];st=p.stat() if p.exists() else None
 rows.append({'path':t['path'],'sha256':current(p),'mode':stat.S_IMODE(st.st_mode) if st else None,'uid':st.st_uid if st else None,'gid':st.st_gid if st else None})
if mode=='inspect':print(json.dumps({'targets':rows,'sentinels':'PASS'}));sys.exit()
if mode=='prepare':
 assert not backup.exists(),'Backup identity already exists'
 for t,row in zip(m['targets'],rows):assert row['sha256']==t['preimage'],'Unexpected preimage: '+t['path']
 backup.mkdir(mode=0o700,parents=True);os.chmod(backup,0o700)
 (backup/'manifest.json').write_text(json.dumps(m,indent=2));(backup/'preimages.json').write_text(json.dumps(rows,indent=2));(backup/'fences.json').write_text(json.dumps(m['fences']))
 for row in rows:
  if row['sha256']:
   target=backup/'preimages'/row['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/row['path'],target);os.chmod(target,0o600);assert digest(target)==row['sha256']
 # Reconstruct each recorded preimage privately to prove rollback bytes and mode are readable.
 for row in rows:
  if row['sha256']:
   probe=backup/'rollback-rehearsal'/row['path'];probe.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(backup/'preimages'/row['path'],probe);os.chmod(probe,0o600);assert digest(probe)==row['sha256'] and stat.S_IMODE(probe.stat().st_mode)==0o600
 print(json.dumps({'status':'PRIVATE_PREIMAGES_AND_ROLLBACK_REHEARSAL_PASS','backup':str(backup),'targets':rows}));sys.exit()
assert json.loads((backup/'fences.json').read_text())==m['fences'],'Remote fencing identity changed'
assert json.loads((backup/'manifest.json').read_text())==m,'Sealed manifest changed'
if mode=='unpack':
 archive=backup/'candidate.tar';assert digest(archive)==v['tar_sha256'],'Tar mismatch'
 stage=backup/'candidate';assert not stage.exists();stage.mkdir(mode=0o700)
 with tarfile.open(archive) as tar:
  assert set(tar.getnames())=={t['path'] for t in m['targets']}
  for member in tar.getmembers():assert member.isfile() and '..' not in Path(member.name).parts and not member.name.startswith('/')
  tar.extractall(stage,filter='data')
 for t in m['targets']:
  os.chmod(stage/t['path'],0o600);assert current(stage/t['path'])==t['sha256']
 lint=subprocess.run(['php','-l',str(stage/'wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php')],capture_output=True,text=True);assert lint.returncode==0,'Staged controller syntax failure'
 print(json.dumps({'status':'STAGED_PRIVATE_PACKAGE_VERIFIED','files':len(m['targets'])}));sys.exit()
def install(t,expected,source):
 p=root/t['path'];assert current(p)==expected,'Preimage drift before atomic install: '+t['path'];assert current(source)==t['sha256']
 for ancestor in p.parents:
  if ancestor==root:break
  assert not ancestor.is_symlink(),'Symlink parent'
 p.parent.mkdir(parents=True,exist_ok=True)
 temp=p.with_name(p.name+'.fv-media-staged');assert not temp.exists(),'Stale temporary target'
 old=p.stat() if p.exists() else None
 if old:assert old.st_uid==os.getuid(),'Target owner mismatch'
 identity=old or p.parent.stat();mode=stat.S_IMODE(old.st_mode) if old else 0o644
 shutil.copyfile(source,temp);os.chown(temp,identity.st_uid,identity.st_gid);os.chmod(temp,mode)
 assert current(temp)==t['sha256'];os.replace(temp,p);final=p.stat()
 assert current(p)==t['sha256'] and final.st_uid==identity.st_uid and final.st_gid==identity.st_gid and stat.S_IMODE(final.st_mode)==mode,'Installed identity mismatch'
controller='wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php'
if mode=='activate':
 for t,row in zip(m['targets'],rows):assert row['sha256']==(t['preimage'] if t['path']==controller else t['sha256']),'Activation dependency drift: '+t['path']
if mode in ('stage','activate'):
 targets=[t for t in m['targets'] if (t['path']==controller)==(mode=='activate')]
 for t in targets:
  observed=current(root/t['path'])
  if observed==t['sha256']:continue
  install(t,t['preimage'],backup/'candidate'/t['path'])
 print(json.dumps({'status':mode.upper()+'_PASS','files':len(targets)}));sys.exit()
if mode=='rollback':
 ordered=sorted([t for t in m['targets'] if t['preimage']],key=lambda t:t['path']!=controller)
 for t in ordered:
  old=dict(t,sha256=t['preimage']);observed=current(root/t['path'])
  if observed==old['sha256']:continue
  install(old,t['sha256'],backup/'preimages'/t['path'])
 print(json.dumps({'status':'ROLLBACK_PASS','restored':len(ordered),'additive_assets':'preserved unreferenced; no user data deletion'}));sys.exit()
raise ValueError('Unknown mode')
"""
def remote(mode,m,**extra):
 if mode!='inspect':lease()
 payload={'mode':mode,'manifest':m,**extra}
 proc=subprocess.run(['ssh','missionmed-kinsta','python3 -c '+shlex.quote(REMOTE_CODE)],input=json.dumps(payload),text=True,capture_output=True)
 if proc.returncode:raise RuntimeError('Remote '+mode+' failed: '+proc.stderr[-1800:])
 return json.loads(proc.stdout)
def public_verify(m,include_mutable=True):
 rows=[]
 for t in m['targets']:
  if t['path']==CONTROLLER or (not include_mutable and t['path'] in (JS,CSS)):continue
  url='https://missionmedinstitute.com/'+t['path']+'?fvmedia='+t['sha256'][:16]
  with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"MissionMed-FileVault-Media-Verification/1.0"}),timeout=25) as res:
   data=res.read();kind=res.headers.get('Content-Type','').split(';')[0];assert sha(data)==t['sha256'],'Public hash mismatch '+t['path']
   expected={'.js':('application/javascript','text/javascript'),'.css':('text/css',),'.webp':('image/webp',),'.png':('image/png',),'.svg':('image/svg+xml',)}[Path(t['path']).suffix]
   assert kind in expected,'Unexpected MIME '+kind
   rows.append({'path':t['path'],'sha256':sha(data),'status':res.status,'content_type':kind})
 return rows
def main():
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['seal','inspect','prepare','stage','activate','verify','rollback']);args=p.parse_args();lease()
 if args.mode=='seal':
  m=manifest();save('release-manifest.json',m)
  with tarfile.open(OUT/'candidate.tar','w') as tar:
   for t in m['targets']:tar.add(ROOT/t['path'],arcname=t['path'],recursive=False)
  save('package.json',{'tar_sha256':sha((OUT/'candidate.tar').read_bytes()),'source_head':m['source_head'],'files':len(m['targets'])});print('SEALED',m['source_head'],len(m['targets']));return
 m=json.loads((OUT/'release-manifest.json').read_text());package=json.loads((OUT/'package.json').read_text())
 subprocess.run(['git','merge-base','--is-ancestor',m['source_head'],'HEAD'],cwd=ROOT,check=True)
 for t in m['targets']:
  assert sha((ROOT/t['path']).read_bytes())==t['sha256'],'Source drift'
  assert sha(subprocess.check_output(['git','show',m['source_head']+':'+t['path']],cwd=ROOT))==t['sha256'],'Sealed commit drift'
 if args.mode=='inspect':result=remote('inspect',m)
 elif args.mode=='prepare':
  result=remote('prepare',m);save('prepare-receipt.json',result);lease()
  # SSH transport writes only the private sealed tar; no credentials enter the package.
  with (OUT/'candidate.tar').open('rb') as src:subprocess.run(['ssh','missionmed-kinsta','umask 077; cat > '+shlex.quote(BACKUP+'/candidate.tar')],stdin=src,check=True)
  result['unpack']=remote('unpack',m,tar_sha256=package['tar_sha256'])
 elif args.mode=='stage':result=remote('stage',m);result['public']=public_verify(m)
 elif args.mode=='activate':
  # Require staged byte parity before changing the controller pin.
  r=remote('inspect',m)
  for t,row in zip(m['targets'],r['targets']):assert row['sha256']==(t['preimage'] if t['path']==CONTROLLER else t['sha256'])
  result=remote('activate',m)
 elif args.mode=='verify':
  result=remote('inspect',m)
  for t,row in zip(m['targets'],result['targets']):assert row['sha256']==t['sha256']
  result['public']=public_verify(m)
 else:result=remote('rollback',m)
 save(args.mode+'-receipt.json',result);print(args.mode.upper(),'PASS',len(m['targets']),'targets')
if __name__=='__main__':main()
