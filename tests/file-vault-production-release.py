#!/usr/bin/env python3
"""DR-406/407 exact File Vault package. No credentials or application data are read.
The Foreman must approve the sealed manifest and independent review before prepare/stage/activate.
"""
import argparse,hashlib,json,os,shlex,subprocess,sys,tarfile,time,urllib.request
if sys.flags.optimize != 0:
 raise RuntimeError("Release guards require unoptimized Python")
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_PRODUCTION'
STATUS=Path('/tmp/filevault-production-lease-status.json')
APPROVED='31b61d4365948abfbadee7cb1393af4adf9db9e1'
REMOTE='/www/theresidencyacademy_209/public'
BACKUP='/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/J1-FILEVAULT-1022/20261009T001000Z-31b61d4'
PREFIX='wp-content/plugins/missionmed-hub/'
CONTROLLER=PREFIX+'includes/class-mmed-file-vault-v2.php'
JS=PREFIX+'assets/student-os-file-vault-v2.js';CSS=PREFIX+'assets/student-os-file-vault-v2.css'
NEW_JS=PREFIX+'assets/student-os-file-vault-v2.44c578a67d945dfe.js'
NEW_CSS=PREFIX+'assets/student-os-file-vault-v2.5009c86f47c85fa1.css'
OLD={CONTROLLER:'e60b2695e7bed4e04497d0122c7dc3a5b45daca2f415f5fbac55dabc9f7bb424',JS:'3f9f0152e8bfbc034ae5ede0843fb756754daf3aa99f89ddc83124b4be263582',CSS:'87c932a3b20b5e6b5351a5ee5bda08c0489bea5195df007cb0f70d6d21e9d9f2'}
SENTINELS={PREFIX+'includes/class-mmed-file-vault-v2-repository.php':'a97842553c9c1d997d80903cb367b9ffba5c80a9967b6b3a5a43c5143c0f4896','wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php':'6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a',PREFIX+'assets/student-os-file-vault.js':'f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd',PREFIX+'assets/student-os-file-vault.css':'6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990'}
def sha(b):return hashlib.sha256(b).hexdigest()
FENCES=[{'scope':'PRODUCT:FILE-VAULT','epoch':5478},{'scope':'PATH:4780ea78ceafa2d1135bb7563f85df790f2b8a250306e13ee20e18ba45c38aad','epoch':5479},{'scope':'PATH:703d921fde8cdefc2e26280425208b73ee38bb48b1659f27d426952ae1c3d2a1','epoch':5480}]
def lease():
 s=json.loads(STATUS.read_text());assert s['state']=='healthy' and 0<=time.time()-s['at_unix']<15,'Lease is not fresh/healthy'
 assert s['mission']=='J1-FILEVAULT-1022-PIXEL-FIDELITY','Mission mismatch'
 assert [{'scope':x['scope'],'epoch':x['epoch']} for x in s['scopes']]==FENCES,'Fencing identity changed'
 return s
def save(name,value):
 lease();OUT.mkdir(parents=True,exist_ok=True);(OUT/name).write_text(json.dumps(value,indent=2)+'\n')
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT).decode().strip()
def manifest():
 provenance=PREFIX+'assets/file-vault-cinematic/ASSETS.json'
 assert (ROOT/provenance).read_bytes()==subprocess.check_output(['git','show',APPROVED+':'+provenance],cwd=ROOT)
 data=json.loads((ROOT/provenance).read_text())
 media=[PREFIX+'assets/file-vault-cinematic/'+a['file'] for a in data['assets']]
 assert len(media)==len(set(media))==13 and all(p.endswith(('.webp','.png','.svg')) for p in media)
 paths=[*media,NEW_JS,NEW_CSS,JS,CSS,CONTROLLER]
 approved_hashes={JS:'44c578a67d945dfed74f4998fa72ec820c3fe6c0ca75b5043b3da69cbfa02bbe',CSS:'5009c86f47c85fa1a9d15b70c3fec17547bf00c7ced21f4ac58702b55f26d482'}
 for p,h in approved_hashes.items():assert sha((ROOT/p).read_bytes())==h
 assert (ROOT/NEW_JS).read_bytes()==(ROOT/JS).read_bytes() and (ROOT/NEW_CSS).read_bytes()==(ROOT/CSS).read_bytes()
 for p in media:assert (ROOT/p).read_bytes()==subprocess.check_output(['git','show',APPROVED+':'+p],cwd=ROOT)
 old_controller=subprocess.check_output(['git','show',APPROVED+':'+CONTROLLER],cwd=ROOT)
 expected=old_controller.replace(b'3f9f0152e8bfbc03',b'44c578a67d945dfe').replace(b'87c932a3b20b5e6b',b'5009c86f47c85fa1')
 assert (ROOT/CONTROLLER).read_bytes()==expected,'Non-mechanical controller change'
 return {'approved':APPROVED,'source_head':git('rev-parse','HEAD'),'root':REMOTE,'backup':BACKUP,'fences':FENCES,'targets':[{'path':p,'sha256':sha((ROOT/p).read_bytes()),'bytes':(ROOT/p).stat().st_size,'preimage':OLD.get(p)} for p in paths],'sentinels':SENTINELS,'excluded':['ASSETS.json','fixtures','tests','handoffs']}
REMOTE_CODE=r"""
import sys,json,hashlib,os,shutil,stat,tarfile,subprocess
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
   target=backup/'preimages'/row['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/row['path'],target);assert digest(target)==row['sha256']
 # Reconstruct each recorded preimage privately to prove rollback bytes and mode are readable.
 for row in rows:
  if row['sha256']:
   probe=backup/'rollback-rehearsal'/row['path'];probe.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(backup/'preimages'/row['path'],probe);assert digest(probe)==row['sha256'] and stat.S_IMODE(probe.stat().st_mode)==row['mode']
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
 for t in m['targets']:assert current(stage/t['path'])==t['sha256']
 lint=subprocess.run(['php','-l',str(stage/'wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php')],capture_output=True,text=True);assert lint.returncode==0,'Staged controller syntax failure'
 print(json.dumps({'status':'STAGED_PRIVATE_PACKAGE_VERIFIED','files':len(m['targets'])}));sys.exit()
def install(t,expected,source):
 p=root/t['path'];assert current(p)==expected,'Preimage drift before atomic install: '+t['path'];assert current(source)==t['sha256']
 for ancestor in p.parents:
  if ancestor==root:break
  assert not ancestor.is_symlink(),'Symlink parent'
 p.parent.mkdir(parents=True,exist_ok=True)
 temp=p.with_name(p.name+'.fv1022-staged');assert not temp.exists(),'Stale temporary target'
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
  url='https://missionmedinstitute.com/'+t['path']+'?fv1022='+t['sha256'][:16]
  with urllib.request.urlopen(url,timeout=25) as res:
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
 assert git('rev-parse','HEAD')==m['source_head'],'Sealed source HEAD drift'
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
