#!/usr/bin/env python3
"""Guarded Clinicals-only CDN publisher. Credentials stay in private process memory."""
import argparse,hashlib,json,os,shlex,subprocess,tempfile,urllib.request
from pathlib import Path
ROOT=Path('/Users/brianb/MissionMed_worktrees/usce-phil-first-renovation-20261002')
BASE='html-system/BACKUPS/usce_clinicals_v3_followup_20261009/'
LIVE=None
DIR=ROOT/'_AI_HANDOFFS/from_codex/USCE_CLINICALS_HQ_V3_20261009/FOLLOWUP_20261009/release'
def fence():
 import time
 f=json.loads((DIR/'WRITER_FENCE.json').read_text());assert f['healthy'] and f['valid_until']>time.time(),'Writer fence stale'
PREIMAGE='f673584d90414f1577eee3ec8c031c0c79dc7d78fd67bbccb8b7fe26abee2c97'
def sha(b):return hashlib.sha256(b).hexdigest()
def config():
 d={}
 for line in Path('/Users/brianb/MissionMed/_SYSTEM/r2.env').read_text().splitlines():
  line=line.strip()
  if not line or line.startswith('#'):continue
  if line.startswith('export '):line=line[7:]
  k,sep,v=line.partition('=')
  if sep:d[k.strip()]=shlex.split(v,comments=True)[0] if shlex.split(v,comments=True) else ''
 assert all(d.get(k) for k in ['R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_ENDPOINT_URL','R2_BUCKET'])
 return d
def main():
 global LIVE
 ap=argparse.ArgumentParser();ap.add_argument('--asset',required=True,choices=['usce_admin.html','usce_offer.html']);ap.add_argument('mode',choices=['candidate','publish','restore']);ap.add_argument('--expected-live',required=True);ap.add_argument('--expected-source');a=ap.parse_args()
 LIVE='html-system/LIVE/'+a.asset
 fence()
 d=config();env=os.environ.copy();env.update(AWS_ACCESS_KEY_ID=d['R2_ACCESS_KEY_ID'],AWS_SECRET_ACCESS_KEY=d['R2_SECRET_ACCESS_KEY'],AWS_DEFAULT_REGION=d.get('R2_REGION') or 'auto',AWS_EC2_METADATA_DISABLED='true')
 def aws(args):
  p=subprocess.run(['/opt/homebrew/bin/aws','--endpoint-url',d['R2_ENDPOINT_URL'],'s3api',*args],env=env,capture_output=True)
  if p.returncode:raise RuntimeError('Scoped R2 operation rejected; no blind retry.')
  return json.loads(p.stdout or b'{}')
 def get(key):
  with tempfile.TemporaryDirectory(prefix='usce-r2-read-') as t:
   p=Path(t)/'object';meta=aws(['get-object','--bucket',d['R2_BUCKET'],'--key',key,str(p)]);return p.read_bytes(),meta['ETag']
 def put(key,path,etag=None):
  assert key==LIVE or key.startswith(BASE)
  fence()
  return aws(['put-object','--bucket',d['R2_BUCKET'],'--key',key,'--body',str(path),'--content-type','text/html; charset=utf-8','--cache-control','no-store, no-cache, max-age=0',*(['--if-match',etag] if etag else ['--if-none-match','*'])])
 source=ROOT/'LIVE'/a.asset;data=source.read_bytes();candidate=sha(data)
 if a.mode!='restore':assert a.expected_source==candidate,'Reviewed candidate hash required'
 snapshot=tempfile.NamedTemporaryFile(prefix='usce-reviewed-',suffix='.html')
 snapshot.write(data);snapshot.flush();immutable=Path(snapshot.name)
 if a.mode=='candidate':
  key=BASE+a.asset.removesuffix('.html')+'_candidate_'+candidate[:16]+'.html';put(key,immutable)
 else:
  before,etag=get(LIVE);assert sha(before)==a.expected_live,'Live preimage changed'
  if a.mode=='publish':
   backup=DIR/('rollback_'+a.expected_live+'_'+a.asset)
   if not backup.exists():backup=DIR/('rollback_'+a.asset)
   if backup.exists():assert backup.read_bytes()==before
   else:raise RuntimeError('Exact pre-captured rollback required')
   # Local exact rollback preimage is required before replacing serving bytes.
   assert sha(backup.read_bytes())==a.expected_live
   put(LIVE,immutable,etag);key=LIVE
  else:
   source=DIR/('rollback_'+a.asset)
   data=source.read_bytes();assert sha(data)==a.expected_source,'Unexpected rollback lineage'
   snapshot.seek(0);snapshot.truncate();snapshot.write(data);snapshot.flush()
   put(LIVE,immutable,etag);key=LIVE
 after,_=get(key);assert after==data,'Provider readback mismatch'
 url='https://cdn.missionmedinstitute.com/'+key
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Cache-Control':'no-cache'})
 public=urllib.request.urlopen(req,timeout=20).read();assert public==data,'Public readback mismatch'
 print(json.dumps({'mode':a.mode,'url':url,'sha256':sha(data),'bytes':len(data),'provider_readback':True,'public_readback':True}))
if __name__=='__main__':main()
