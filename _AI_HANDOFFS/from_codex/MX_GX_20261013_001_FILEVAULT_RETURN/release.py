#!/usr/bin/env python3
"""DR-426 bounded File Vault native Return package. No credentials or application data are read.
The Foreman must approve the sealed manifest and independent review before prepare/stage/activate.
"""
import argparse,hashlib,json,os,shlex,subprocess,sys,tarfile,time,urllib.request
if sys.flags.optimize != 0:
 raise RuntimeError("Release guards require unoptimized Python")
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'_AI_HANDOFFS/from_codex/MX_GX_20261013_001_FILEVAULT_RETURN'
STATUS=Path('/tmp/filevault-return-lease-status.json')
APPROVED='5fb301a224ad44483b029789fb31017cd227300c'
REMOTE='/www/theresidencyacademy_209/public'
BACKUP='/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/MX-GX-FILEVAULT-RETURN/20261014T132000Z'
PREFIX='wp-content/plugins/missionmed-hub/'
CONTROLLER=PREFIX+'includes/class-mmed-file-vault-v2.php'
JS=PREFIX+'assets/student-os-file-vault-v2.js';CSS=PREFIX+'assets/student-os-file-vault-v2.css'
NEW_JS=PREFIX+'assets/student-os-file-vault-v2.960a6069c8ea8967.js'
NEW_CSS=PREFIX+'assets/student-os-file-vault-v2.6a510a57bfbbf85e.css'
OLD={CONTROLLER:'60f4be738335859072a5c48c2e41b0dadfcec49fe369da5a42317fb941084089',JS:'44c578a67d945dfed74f4998fa72ec820c3fe6c0ca75b5043b3da69cbfa02bbe',CSS:'5009c86f47c85fa1a9d15b70c3fec17547bf00c7ced21f4ac58702b55f26d482'}
SENTINELS={PREFIX+'includes/class-mmed-file-vault-v2-repository.php':'a97842553c9c1d997d80903cb367b9ffba5c80a9967b6b3a5a43c5143c0f4896','wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php':'6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a',PREFIX+'assets/student-os-file-vault.js':'f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd',PREFIX+'assets/student-os-file-vault.css':'6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990'}
def sha(b):return hashlib.sha256(b).hexdigest()
FENCES=[{'scope': 'PRODUCT:FILE-VAULT', 'epoch': 5846}, {'scope': 'PATH:e187d0f88403910e460341a6046e0a56e8536e03d79f3ed0f1265c71a3d4bdfe', 'epoch': 5847}, {'scope': 'PATH:ba82c943dd3aa6a0752fb2f20708b4a4b4f50d971d1c1b6b2ad71fba28033a0d', 'epoch': 5848}, {'scope': 'PATH:e8a2db7f8f84aaf99e15f7ca4c9276bdebdbed82a1f6ebee4d5e9e5fb9f0bec3', 'epoch': 5849}, {'scope': 'PATH:752d95e671e782199ce2382b2fd2f93e68c9591b6d6ff23b303dbb6c0c063a60', 'epoch': 5855}, {'scope': 'PATH:0cffa4351b245b2a959190b8b36164cb92e1b49e70974e8faac27bbef27cb106', 'epoch': 5856}]
def lease():
 observed=[]
 for status in [STATUS,Path('/tmp/filevault-return-immutable-status.json')]:
  s=json.loads(status.read_text());assert s['state']=='healthy' and 0<=time.time()-s['at_unix']<15,'Lease is not fresh/healthy'
  assert s['mission']=='MX-GX-20261013-001-FILEVAULT-RETURN' and s['owner_id']=='codex-filevault-foreman','Mission/owner mismatch'
  observed.extend({'scope':x['scope'],'epoch':x['epoch']} for x in s['scopes'])
 assert observed==FENCES,'Fencing identity changed'
 return s
def save(name,value):
 lease();OUT.mkdir(parents=True,exist_ok=True);(OUT/name).write_text(json.dumps(value,indent=2)+'\n')
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT).decode().strip()
def manifest():
 baseline=json.loads((ROOT/'_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_PRODUCTION/release-manifest.json').read_text())
 sentinels=dict(SENTINELS)
 for t in baseline['targets']:
  if t['path'] not in OLD:sentinels[t['path']]=t['sha256']
 for p,h in sentinels.items():assert sha((ROOT/p).read_bytes())==h,'Preserved source changed: '+p
 hashes={JS:'960a6069c8ea8967acaf4e6d78ddae1c0ef57beb7e10b85e6900bcdbfd53af27',CSS:'6a510a57bfbbf85ed8e0961d2a102559599bb98ded9835ded3d61a8ee4e845b9'}
 for p,h in hashes.items():assert sha((ROOT/p).read_bytes())==h
 assert (ROOT/NEW_JS).read_bytes()==(ROOT/JS).read_bytes() and (ROOT/NEW_CSS).read_bytes()==(ROOT/CSS).read_bytes()
 old=subprocess.check_output(['git','show',APPROVED+':'+CONTROLLER],cwd=ROOT)
 expected=old.replace(b'44c578a67d945dfe',b'960a6069c8ea8967').replace(b'5009c86f47c85fa1',b'6a510a57bfbbf85e')
 assert (ROOT/CONTROLLER).read_bytes()==expected,'Non-mechanical controller change'
 paths=[NEW_JS,NEW_CSS,JS,CSS,CONTROLLER]
 return {'authority':'DR-426','approved':APPROVED,'source_head':git('rev-parse','HEAD'),'root':REMOTE,'backup':BACKUP,'fences':FENCES,'targets':[{'path':p,'sha256':sha((ROOT/p).read_bytes()),'bytes':(ROOT/p).stat().st_size,'preimage':OLD.get(p)} for p in paths],'sentinels':sentinels,'excluded':['media','ASSETS.json','fixtures','tests','handoffs','student data']}
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
 temp=p.with_name(p.name+'.fv-return-staged');assert not temp.exists(),'Stale temporary target'
 old=p.stat() if p.exists() else None
 if old:assert old.st_uid==os.getuid(),'Target owner mismatch'
 identity=old or p.parent.stat();mode=stat.S_IMODE(old.st_mode) if old else 0o644
 shutil.copyfile(source,temp);os.chown(temp,identity.st_uid,identity.st_gid);os.chmod(temp,mode)
 assert current(temp)==t['sha256'];os.replace(temp,p);final=p.stat()
 assert current(p)==t['sha256'] and final.st_uid==identity.st_uid and final.st_gid==identity.st_gid and stat.S_IMODE(final.st_mode)==mode,'Installed identity mismatch'
controller='wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php'
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
  url='https://missionmedinstitute.com/'+t['path']+'?fvreturn='+t['sha256'][:16]
  with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"MissionMed-FileVault-Return-Verification/1.0"}),timeout=25) as res:
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
 for t in m['targets']:assert sha((ROOT/t['path']).read_bytes())==t['sha256'],'Source drift'
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
