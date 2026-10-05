"""One metadata-only deployment preflight; identical qualified program/IO, new exclusive output."""
import sys,hashlib,importlib.util,json,time
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
READER=HERE.parent/'RUNTIME_METADATA_CLOSED_STAGE_DIAGNOSTIC_20261005/reader.py'
PIN='b901a65089fb54cd865d6b50eb7330a202bb8ecb940e0eb8053174cd243c0374'
def main():
 if sys.argv[1:]!=['--execute']:print('DORMANT');return
 a=json.loads((HERE/'RUNTIME_READ_APPROVAL.json').read_text())
 assert a['verdict']=='APPROVE' and a['reviewer']=='/root/inventory_exact_admission_reviewer' and a['adapterSha256']==hashlib.sha256(Path(__file__).read_bytes()).hexdigest() and time.time()<a['expiresUnix']<=time.time()+3600
 assert hashlib.sha256(READER.read_bytes()).hexdigest()==PIN
 for n in ['COMMERCE_RUNTIME_BASELINE.json','RUNTIME_READ_CONSUMED.json']:assert not (HERE/n).exists()
 with (HERE/'RUNTIME_READ_CONSUMED.json').open('x') as f:json.dump({'state':'CONSUMED','approvalSha256':hashlib.sha256((HERE/'RUNTIME_READ_APPROVAL.json').read_bytes()).hexdigest()},f)
 s=importlib.util.spec_from_file_location('ir_existing_metadata_preflight',READER);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
 def publish(value):
  with (HERE/'COMMERCE_RUNTIME_BASELINE.json').open('x') as f:json.dump(value,f,sort_keys=True,separators=(',',':'),allow_nan=False)
 facts=m.run(publish_fn=publish);print(json.dumps(facts,sort_keys=True));assert facts['result']=='PASS' and facts['reapCompleted'] is True
if __name__=='__main__':
 try:main()
 except Exception:print('COMMERCE_RUNTIME_PREFLIGHT_STOP',file=sys.stderr);sys.exit(1)
