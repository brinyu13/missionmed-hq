#!/usr/bin/env python3
"""Recover complete retained source records without upgrading archival text into authenticated originals."""
from pathlib import Path
import csv, json, re, hashlib
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
FB=Path('/Users/brianb/MissionMed/04_PROOF/TESTIMONIALS/MISSIONRESIDENCY_FACEBOOK_TESTIMONIAL_ARCHIVE_MASTER.csv')
MANASA=Path('/Users/brianb/Dropbox (Personal)/SCREENSHOTS/MR_CONCEPT05_EVIDENCE_REPAIR_EARLY_TUITION_OPUS46_MASTER.md')
LEDGER=Path('/Users/brianb/MissionMed_worktrees/Claude outputs/MR_TESTIMONIAL_PRIMARY_SOURCE_LEDGER.md')
LEGACY=Path('/Users/brianb/MissionMed/07_BACKUPS/BACKUPS/MASTER_STABLE_SYSTEM/08_AI_SYSTEM/MissionMed_AI_Brain/MISSIONMED_TESTIMONIAL_DATABASE.md')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def normtext(s):return re.sub(r'\s+',' ',s).strip()
def complete(text):return bool(text) and not re.search(r'\[truncated|structured (?:review|alumni)|^\[|\.\.\.\s*$|video testimonial',text,re.I)

def reconcile():
    ap=ROOT/'public/data/archive.json';pp=ROOT/'ingestion/provenance.json'
    archive=json.loads(ap.read_text());provenance=json.loads(pp.read_text())
    fb=list(csv.DictReader(FB.open(encoding='utf-8-sig')))
    original=json.loads((ROOT.parent/'PROOF-INTEL-1201/stories.json').read_text())
    original_by_id={s['id']:s for s in original['stories']}
    records={};deltas=[]
    founder=MANASA.read_text();ledger=LEDGER.read_text()
    raw_full=re.search(r'Original detailed review: "(.*?)"\n\nConfidence answer:',founder,re.S).group(1)
    raw_additional=re.search(r'Overall: "(.*?)"',founder,re.S).group(1)
    # Existing ledger/direct source row references, not a best-name or longest-review guess.
    rows={'marian':21,'sonia':17,'gunjan':37,'krishna':34,'suman':106,'chelsey':8,'jalpa':14,'menon':39,'wahida':46,'anissa':80}
    names={'marian':'Marian Ghaly','sonia':'Sonia Jahan','gunjan':'Gunjanpreet Kaur','krishna':'Krishna Desai','suman':'Suman Susant Misra','chelsey':'Chelsey CC','jalpa':'JaLpa Kumari','menon':'PM Menon','wahida':'Wahida Rashid Rakhi','anissa':'Anissa Rahman'}
    for s in archive['stories']:
        ident=s['id'];m=provenance['records'][ident]
        s.update(fullOriginalVerified=False,originalVerification='pending',fullTextStatus='excerpt-only',sourceDisplay='Written testimonial · source reconciliation pending',source='Archived written review')
        evidence=None;text=None
        if ident=='manasa':
            text=raw_full
            evidence=dict(path=str(MANASA),sha256=sha(MANASA.read_bytes()),locator='Phase5, Original detailed review, lines138–149',sourceType='Founder-source assertion in preserved directive; original review-form export not recovered',textSha256=sha(text.encode()),rawExactSubstring=True)
            s['sourceDisplay']='Manasa Kandula · detailed review · June 2013 · preserved Founder directive'
            assert original_by_id[ident]['additional']==raw_additional
            s['additionalSource']=dict(full=raw_additional,fullTextStatus='source-matched-complete',sourceDisplay='Manasa Kandula · separate overall-assessment answer · June 2013',originalVerification='pending',fullOriginalVerified=False)
            assert s['additional'] in s['additionalSource']['full']
            m['additionalSource']=dict(path=str(MANASA),sha256=sha(MANASA.read_bytes()),locator='Phase5, Overall answer, line158',textSha256=sha(raw_additional.encode()),exactSubstring=True)
            s['fullSections']=[dict(label='Original detailed review',text=text)]
            for label,pattern in [('Confidence answer',r'Confidence answer: "(.*?)"'),('Timing answer',r'Asked whether taking it earlier would have made a difference: "(.*?)"'),('Overall assessment',r'Overall: "(.*?)"'),('Reason for review',r'Reason for review: "(.*?)"')]:
                answer=re.search(pattern,founder,re.S).group(1)
                assert answer in founder
                s['fullSections'].append(dict(label=label,text=answer))
        elif ident in rows:
            i=rows[ident];r=fb[i-2];assert r['Poster Name']==names[ident],ident
            text=r['Full Review Text']
            evidence=dict(path=str(FB),sha256=sha(FB.read_bytes()),row=i,field='Full Review Text',identity=r['Poster Name'],sourceLocatorBasis='Existing approved curated or primary-ledger explicit Facebook review locator',textSha256=sha(text.encode()),rawExactField=True)
            if ident=='krishna':assert 'FB Archive Row 34' in ledger
            if ident=='suman':
                assert original_by_id[ident]['full']==text
                evidence['sourceLocatorBasis']='Exact full-text identity match to existing approved Suman record and named FB row106.'
            s['sourceDisplay']=f"{s['name']} · archived Facebook review · {r.get('Post Date') or 'date unrecorded'}"
        elif ident=='yamini':
            # The available source explicitly describes an incomplete structured transcription.
            s['full']=None
            m['fullSourceCandidates']=[dict(path=str(FB),row=19,field='Full Review Text',reason='Structured summary; exact curated excerpt is absent.'),dict(path=str(LEGACY),locator='Review2: Yamini Arukala',reason='Explicitly says full narrative truncated in documentation and needs re-extraction.')]
        elif m.get('primary'):
            ref=m['primary'];r=list(csv.DictReader(Path(ref['path']).open(encoding='utf-8-sig')))[ref['row']-2]
            text=r[ref['field']];evidence={**ref,'rawExactField':True,'textSha256':sha(text.encode())}
            s['sourceDisplay']=f"{s['name']} · archived written review"
        if text is not None:
            old=original_by_id.get(ident,{}).get('quote',s['quote'])
            if old not in text and normtext(old) in normtext(text):
                pattern=r'\s+'.join(re.escape(x) for x in old.split())
                exact=re.search(pattern,text)
                assert exact,ident
                s['quote']=exact.group(0)
                deltas.append(dict(id=ident,before=old,after=s['quote'],reason='Restore exact preserved source line wrapping; words/spelling/punctuation unchanged.',source=evidence))
            elif ident in ('menon','wahida') and old not in text:
                stem=old[:-1];assert old.endswith('.') and text.count(stem)==1
                start=text.index(stem);end=text.find('.',start+len(stem));assert end>start
                s['quote']=text[start:end+1]
                deltas.append(dict(id=ident,before=old,after=s['quote'],reason='Remove synthetic terminal period by restoring the entire original sentence from explicit same-person FB locator.',source=evidence))
            if complete(text) and s['quote'] in text:
                s['full']=text;s['fullTextStatus']='source-matched-complete'
                m['fullSource']=evidence
            else:
                candidate=dict(source=evidence,text=text,reason='Exact displayed excerpt or complete narrative boundary not established.')
                if candidate not in m.setdefault('fullSourceCandidates',[]):m['fullSourceCandidates'].append(candidate)
                s['full']=None
        if s.get('full'):
            assert s['quote'] in s['full'],ident
            if evidence.get('rawExactField'):
                r=list(csv.DictReader(Path(evidence['path']).open(encoding='utf-8-sig')))[evidence['row']-2]
                assert s['full']==r[evidence['field']],ident
            else:assert s['full'] in Path(evidence['path']).read_text(),ident
        m['fullOriginalVerified']=False;m['originalVerification']='pending';m['fullTextStatus']=s['fullTextStatus']
        m['quoteSha256']=sha(s['quote'].encode())
        records[ident]=dict(name=s['name'],fullTextStatus=s['fullTextStatus'],fullLength=len(s.get('full') or ''),fullOriginalVerified=False,originalVerification='pending',source=evidence,excerptExactMatch=bool(s.get('full') and s['quote'] in s['full']))
    # One card per exact full source + evidenced person; keep aliases and all source provenance.
    groups={};kept=[];aliases=dict(archive.get('idAliases',{}))
    for s in archive['stories']:
        if not s.get('full'):kept.append(s);continue
        key=(provenance['records'][s['id']]['personId'],s['full'])
        if key in groups:
            canonical=groups[key];aliases[s['id']]=canonical
            provenance['records'][s['id']]['canonicalStoryId']=canonical
            provenance['records'][s['id']]['fullReconciliation']=records[s['id']]
            own=provenance['records'][canonical].setdefault('recordAliases',[])
            if s['id'] not in own:own.append(s['id'])
        else:groups[key]=s['id'];s.pop('sameFullSourceAs',None);kept.append(s)
    archive['stories']=kept;archive['idAliases']=aliases
    for alias in aliases:
        records[alias]=provenance['records'][alias]['fullReconciliation']
    summary=dict(records=len(kept),sourceRepresentations=len(records),completeRetainedRecords=sum(s['fullTextStatus']=='source-matched-complete' for s in kept),unreconciled=[s['id'] for s in kept if s['fullTextStatus']=='excerpt-only'],fullOriginalVerified=0,exactDuplicateRepresentations=len(aliases),quoteRepairs=len(deltas))
    archive['fullTextReconciliation']=summary
    archive['counts']=dict(publicStories=len(kept),publicPeople=len({provenance['records'][s['id']]['personId'] for s in kept}),publicVideoStories=sum(bool(s.get('video')) for s in kept))
    for p in [FB,MANASA,LEDGER,LEGACY]:provenance['sourceHashes'][str(p)]=sha(p.read_bytes())
    save(ap,archive);save(pp,provenance)
    counts_path=ROOT/'ingestion/counts.json';counts=json.loads(counts_path.read_text());counts['counts'].update(archive['counts']);counts['fullTextReconciliation']=summary;counts['themes']={t['id']:sum(t['id'] in s['themes'] for s in kept) for t in archive['themes']};save(counts_path,counts)
    save(ROOT/'ingestion/full_original_reconciliation.json',dict(summary=summary,records=records,quoteRepairs=deltas,sourceFiles=[dict(path=str(p),sha256=sha(p.read_bytes())) for p in [FB,MANASA,LEDGER,LEGACY]],discoveryScope=['04_PROOF current and raw CSVs','02_WEBSITES,05_DATA,07_BACKUPS,09_BACKUPS,BACKUPS,08_AI_SYSTEM','Claude outputs primary ledger/evidence','Downloads and Dropbox SCREENSHOTS testimonial directives','VIDEO_SYSTEM screenshot-review transcript'],limitations=['No original review-form export, complete Facebook capture or source-level audio authentication newly recovered.','Manasa preserved directive includes detailed review and separate answers, but its Founder-source assertion is not independent original-form custody.','Archived full-record boundary does not establish full original submission boundary.','Yamini only structured/transcribed summary found; complete original remains unreconciled.','Distinct Manasa answers are separately labeled and never spliced into one quotation.']))
    report='# Full original reconciliation — local candidate\n\n'+json.dumps(summary,indent=2)+'\n\n'
    report+='`source-matched-complete` means the complete retained narrative source record, copied exactly including whitespace. It does not authenticate the original submission or prove the archive omitted nothing. All originalVerification fields remain pending and all fullOriginalVerified fields false.\n\n'
    report+='Manasa: recovered the detailed review and separately labeled answers from a preserved directive that explicitly asserts Founder supplied the historical review. No original review form/export was found. Full source hash/locator and each exact answer are recorded. Additional overall-assessment quote has its own additionalSource object.\n\n'
    report+='Yamini: the early testimonial database explicitly says the full narrative was truncated in documentation and must be re-extracted. Neither structured CSV summary contains the curated excerpt. Full stays unavailable.\n\n'
    report+='Menon and Wahida: existing excerpts had synthetic terminal periods. Exact explicit FB rows and identity permit restoration of the whole original sentence; before/after recorded. Manasa line wrapping restored exactly. Initial12 IDs/accounts remain.\n\n'
    report+='No source narratives are combined. Exact duplicate full-review representations are removed from the card stream; aliases and all source records remain in provenance and idAliases. Distinct submissions remain separate. No production release or original-authentication gate is claimed.\n'
    (ROOT/'ingestion/FULL_ORIGINAL_RECONCILIATION.md').write_text(report)
    print(json.dumps(summary,indent=2))

if __name__=='__main__':reconcile()
