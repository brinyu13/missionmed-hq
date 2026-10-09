#!/usr/bin/env python3
"""Seal exact committed public code and private, source-verified release data. No provider writes."""
import argparse, copy, hashlib, json, subprocess, sys
from pathlib import Path
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = ROOT.parents[2]
RELEASE = 'PROOF-INTEL-1300-20261009-r2'
sys.path.insert(0, str(ROOT))
from course_mapping import apply_courses

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(value, message):
    if not value: raise RuntimeError(message)
def git(*args): return subprocess.check_output(['git', *args], cwd=REPO)
def source_ready(data):
    check(bool(data.get('stories')), 'empty release corpus')
    ids=set()
    for s in data['stories']:
        check(s['id'] not in ids, 'duplicate story ID'); ids.add(s['id'])
        check(s.get('originalVerification') == 'verified' and s.get('fullOriginalVerified') is True and s.get('fullTextStatus') == 'source-matched-complete', 'unverified full original')
        check(bool(s.get('quote')) and bool(s.get('full')) and s['quote'] in s['full'], 'quote not verbatim full-source substring')
        for section in s.get('fullSections', [])[1:]:
            check(section.get('originalVerification') == 'verified' and section.get('fullOriginalVerified') is True and bool(section.get('text')), 'unverified additional section')
        if s.get('additional'):
            a=s.get('additionalSource', {})
            check(a.get('originalVerification') == 'verified' and a.get('fullOriginalVerified') is True and s['additional'] in a.get('full',''), 'unverified additional answer')
    check(set(data.get('featuredStoryIds', [])) <= ids, 'featured story outside source-ready corpus')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--source-commit',required=True);ap.add_argument('--source-approval',type=Path,required=True);ap.add_argument('--independent-source-approval',type=Path,required=True)
    ap.add_argument('--runtime-safety',type=Path,required=True);ap.add_argument('--scoped-preflight',type=Path,required=True);ap.add_argument('--matrix-no-overlap',type=Path,required=True);a=ap.parse_args()
    check(git('rev-parse','HEAD').decode().strip()==a.source_commit,'source HEAD differs')
    check(git('ls-remote','origin','refs/heads/codex/proof-intelligence-20260930').decode().split()[0]==a.source_commit,'source remote custody missing')
    corpus=ROOT/'ingestion/archive.release.json';data=json.loads(corpus.read_text());source_ready(data)
    data=apply_courses(copy.deepcopy(data));source_ready(data)
    private=HERE/'private-package';private.mkdir(mode=0o700,exist_ok=True)
    archive=private/'archive.json';archive.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');archive.chmod(0o600)
    existing=json.loads((HERE/'PREIMAGE_SHA256.json').read_text())
    rows=[]
    for rel,pre in existing.items():
        if rel.startswith('wordpress/'):continue
        p=HERE/'candidate'/rel;check(p.is_file(),'missing integration candidate')
        rows.append({'source':str(p.relative_to(REPO)),'target':rel,'sha256':sha(p),'preimageSha256':pre})
    app=HERE/'proof-app';plugin=app/'missionmed-proof-intelligence.php'
    check('/private/proof-intelligence/'+RELEASE+'/' in plugin.read_text(),'PHP release path differs')
    rows.append({'source':str(plugin.relative_to(REPO)),'target':'wp-content/mu-plugins/missionmed-proof-intelligence.php','sha256':sha(plugin),'preimageSha256':None})
    assets=app/'missionmed-proof-intelligence-assets'
    for p in sorted(assets.rglob('*')):
        check(not p.is_symlink(),'asset symlink')
        if not p.is_file():continue
        check(p.suffix.lower() in ('.html','.css','.js','.jpg','.jpeg','.png','.webp','.svg','.mp4','.woff','.woff2','.ico'), 'unexpected public asset type')
        rows.append({'source':str(p.relative_to(REPO)),'target':'wp-content/mu-plugins/missionmed-proof-intelligence-assets/'+str(p.relative_to(assets)),'sha256':sha(p),'preimageSha256':None})
    header=HERE/'candidate/wordpress/post-6023-content.html';old=json.loads((HERE/'preimages/wordpress/post-6023.json').read_text())
    for row in rows+[{'source':str(header.relative_to(REPO)),'sha256':sha(header)}]:
        check(hashlib.sha256(git('show',a.source_commit+':'+row['source'])).hexdigest()==row['sha256'],'candidate not byte-identical to committed source')
    evidence={}
    for label,p in [('sourceApproval',a.source_approval),('independentSourceApproval',a.independent_source_approval),('runtimeSafety',a.runtime_safety),('scopedPreflight',a.scoped_preflight),('matrixNoOverlap',a.matrix_no_overlap),('stagingRecovery',ROOT/'evidence/R1_STAGING_RECOVERY.json'),('nativeBackup',ROOT/'evidence/PROVIDER_BACKUP_RECOVERY.json'),('registrationAcceptance',ROOT/'evidence/INDEPENDENT_REGISTRATION_RECOVERY_CUSTODY.md')]:
        p=p.resolve();check(p.is_file(),label+' unavailable');evidence[label]={'path':str(p),'sha256':sha(p)}
    backup=json.loads((ROOT/'evidence/PROVIDER_BACKUP_RECOVERY.json').read_text());check(backup.get('environment')=='Live' and backup.get('restoreControlAvailable') is True and 'Completed' in backup.get('status',''),'provider backup not completed')
    manifest={'schema':'missionmed.proof.release.v1','releaseId':RELEASE,'sourceCommit':a.source_commit,'authorityCommit':'0008eeb458a8650f2d47dfd527d51013a3c6856b','decisions':['DR-411','DR-412'],'sourceGatePassed':True,'independentDeploymentApprovalRequired':True,'files':rows,'header':{'source':str(header.relative_to(REPO)),'postId':6023,'sha256':sha(header),'preimageSha256':hashlib.sha256(old['post_content'].encode()).hexdigest(),'title':old['post_title'],'status':old['post_status']},'archive':{'path':str(archive),'sha256':sha(archive),'sourcePath':str(corpus),'sourceSha256':sha(corpus)},'evidence':evidence,'cacheUrls':['https://missionmedinstitute.com/','https://missionmedinstitute.com/missionresidency/','https://missionmedinstitute.com/testimonials/']}
    manifest['credentialResolverSha256']=sha(ROOT/'registration-packet-r3/execute_registration.py')
    manifest['courseInputHashes']={str(p.relative_to(ROOT)):sha(p) for p in [ROOT/'private-classification/state.json',ROOT/'private-classification/roster.json',ROOT/'ingestion/roster.json',ROOT/'ingestion/provenance.json'] if p.exists()}
    target=HERE/'SEALED_RELEASE.json';target.write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'manifest':str(target),'sha256':sha(target),'runtimeApprovalCreated':False}))
if __name__=='__main__':main()
