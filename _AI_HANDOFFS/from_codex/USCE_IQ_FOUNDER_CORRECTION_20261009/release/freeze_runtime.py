from pathlib import Path
import json,time,hashlib,shutil,subprocess
root=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
here=root/'_AI_HANDOFFS/from_codex/USCE_IQ_FOUNDER_CORRECTION_20261009/release'
old=root/'_AI_HANDOFFS/from_codex/USCE_CLINICALS_HQ_V3_20261009/FOLLOWUP_20261009/release'
base=old/'candidate_runtime_html_final'
def fence():
 f=json.loads((here/'WRITER_FENCE.json').read_text());assert f['healthy'] and f['valid_until']>time.time()
def sha(b):return hashlib.sha256(b).hexdigest()
baseline=json.loads((old/'RUNTIME_HTML_LIVE.json').read_text())
out=here/'candidate_runtime'
assert not out.exists(),'Candidate already frozen'
fence();out.mkdir()
changed={'missionmed-hq/routes/usce-offer-portal.mjs','missionmed-hq/lib/usce-mail-sync.mjs'}
for rel,expected in baseline['files'].items():
 before=(base/rel).read_bytes();assert sha(before)==expected,rel
 src=(root/rel).read_bytes() if rel in changed else before
 dest=out/rel;fence();dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(src)
m={'authority':'DR413','source_head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'previous_deployment':baseline['deployment'],'previous_image':baseline['image'],'files':{r:sha((out/r).read_bytes()) for r in baseline['files']}}
fence();(here/'CANDIDATE_MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n')
assert len(m['files'])==21
assert {r for r in m['files'] if m['files'][r]!=baseline['files'][r]}==changed
print(json.dumps({'files':21,'changed':sorted(changed),'source_head':m['source_head']}))
