#!/usr/bin/env python3
"""Build the exact isolated USCE closure; final source must be integrated."""
import argparse, hashlib, json, pathlib, shutil
parser=argparse.ArgumentParser()
parser.add_argument('--source-root',required=True)
parser.add_argument('--output',required=True)
parser.add_argument('--candidate-qa-root',help='Qualification only: overlay the three owned QA candidate modules')
args=parser.parse_args()
source=pathlib.Path(args.source_root).resolve()
candidate=pathlib.Path(args.candidate_qa_root).resolve() if args.candidate_qa_root else None
output=pathlib.Path(args.output).resolve()
if output.exists(): raise SystemExit('Refusing to replace an existing bundle')
paths=["missionmed-hq/server.mjs","missionmed-hq/usce-gateway.mjs","missionmed-hq/usce-gateway-policy.mjs","missionmed-hq/saf_analyzer.mjs","missionmed-hq/question_selector.mjs","missionmed-hq/worker_metrics.mjs","missionmed-hq/routes/usce-public-intake.mjs","missionmed-hq/routes/usce-offer-portal.mjs","missionmed-hq/routes/usce-status-tracker.mjs","missionmed-hq/routes/gmail-metadata-proof.mjs","missionmed-hq/routes/gmail-sync-preview.mjs","missionmed-hq/routes/gmail-comms-review-write.mjs","missionmed-hq/lib/usce-session-token.mjs","missionmed-hq/lib/usce-postmark-qa-guard.mjs","missionmed-hq/package.json"]
qa_paths={'missionmed-hq/lib/usce-postmark-qa-guard.mjs','missionmed-hq/routes/usce-public-intake.mjs','missionmed-hq/routes/usce-offer-portal.mjs'}
inputs={relative:((candidate if candidate and relative in qa_paths else source)/relative) for relative in paths}
for relative,original in inputs.items():
 if not original.is_file() or original.is_symlink(): raise SystemExit('Missing or linked input: '+relative)
if 'readUsceSessionFromHeaders' not in inputs['missionmed-hq/server.mjs'].read_text():
 raise SystemExit('Integrated strict USCE session boundary is absent')
offer=inputs['missionmed-hq/routes/usce-offer-portal.mjs'].read_text()
intake=inputs['missionmed-hq/routes/usce-public-intake.mjs'].read_text()
if 'usce_claim_send' not in offer:
 raise SystemExit('Durable claims sender is absent; unsafe recovery refused')
if offer.count('validateUscePostmarkQaRecipient(')!=2 or intake.count('validateUscePostmarkQaRecipient(')!=1:
 raise SystemExit('Both USCE outbound recipient boundaries are required')
for relative,original in inputs.items():
 target=output/relative
 target.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(original,target)
package={'name':'missionmed-usce-isolated-runtime','private':True,'version':'2026.10.2','type':'module','engines':{'node':'22.x'},'scripts':{'start':'node missionmed-hq/usce-gateway.mjs'}}
(output/'package.json').write_text(json.dumps(package,indent=2)+'\n')
railway={'$schema':'https://railway.com/railway.schema.json','build':{'builder':'RAILPACK'},'deploy':{'startCommand':'node missionmed-hq/usce-gateway.mjs','healthcheckPath':'/health','healthcheckTimeout':300,'restartPolicyType':'ON_FAILURE','restartPolicyMaxRetries':10}}
(output/'railway.json').write_text(json.dumps(railway,indent=2)+'\n')
(output/'.railwayignore').write_text('.env\n.env.*\n**/.env\n**/.env.*\n.git\nnode_modules\n**/node_modules\n')
files=sorted(p for p in output.rglob('*') if p.is_file())
assert len(files)==18==len(paths)+3
assert {str(p.relative_to(output)) for p in files}==set(paths)|{'package.json','railway.json','.railwayignore'}
assert all('.env' not in p.name and not p.is_symlink() for p in files)
manifest={str(p.relative_to(output)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
print(json.dumps({
 'qualification_overlay':bool(candidate),'files':manifest,'start':'node missionmed-hq/usce-gateway.mjs',
 'upload_flags':['--no-gitignore','--path-as-root'],
 'scope':{'project':'29afe885-b9b1-425d-8fd8-8611cd275409','service':'643853a7-4a40-4418-86be-05807b5d80cc','environment':'ed3353f7-bcc7-4e25-a000-3c9fc628a9a7'},
 'safe_recovery_requires':['disable live offer sending before cutover or rollback','keep public-intake force-dry-run active through synthetic QA','retain exact controlled recipient policy during live QA','never restore the preclaim legacy sender after the safety migration','review exact closure hashes before --no-gitignore upload']
},indent=2))
