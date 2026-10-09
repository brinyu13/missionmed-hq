#!/usr/bin/env python3
"""Bind source-ready stories to exact first-party Elementor library entries, without executing JS."""
import copy,hashlib,json,re
from pathlib import Path
from read_js_literal import LiteralReader
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'ingestion'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def authenticate():
    from build_corpus import person
    raw=P/'wp-5465-elementor.json';tree=json.loads(raw.read_text())
    widget=tree[0]['elements'][0];assert widget['id']=='c815377'
    html=widget['settings']['html'];needle='var T = ';start=html.index(needle)+len(needle)
    entries=LiteralReader(html[start:]).value();assert len(entries)==102
    byid={t['id']:t for t in entries}
    a=json.loads((ROOT/'public/data/archive.json').read_text());p=json.loads((P/'provenance.json').read_text())
    if 'sourceAuthentication' in a:
        a=json.loads((P/'archive.reconciled.private.json').read_text())
    else:
        save(P/'archive.reconciled.private.json',a)
    # Identity + corresponding complete primary source explicitly reviewed; never same-person-only substitution.
    replacements={'krishna':'krishnadesai9','chelsey':'chelseycc11','jalpa':'jalpakumari4',
      'review-4f182d99e30a77':'jess0','review-684fbe2a822173':'akhilavarun1',
      'review-4e56a3d8ac3517':'manishakanumuri2','review-b930d5b1b3500d':'salinianoop3'}
    duplicate_sources={'review-af19784debc3b4':'review-684fbe2a822173','review-df7ad194890cd4':'review-4e56a3d8ac3517'}
    explicit_exclusions={'yamini':'Original full narrative unavailable; primary entry is structured questionnaire only and does not contain displayed narrative.',
      'review-75c5f2e011b9ef':'Primary full field explicitly truncated; archived narrative is inconsistent and complete original unavailable.'}
    # Complete original short announcements are eligible; no minimum text-length cap.
    for entry_id in ['hardeepkour80','priyarimal94']:
        t=byid[entry_id];ident='original-'+sha(entry_id.encode())[:14]
        if not any(x['id']==ident for x in a['stories']):
            a['stories'].append(dict(id=ident,name=t['name'],quote=t['full'],full=t['full'],specialty=None,program=None,course=None,facts=[],themes=[],kind='written'))
        p['records'][ident]=dict(personId=person(t['name']),primaryEntryId=entry_id)
    fact_spans={
      'marianghaly13':{'cycles':'two Match cycles'},
      'chelseycc11':{'cycles':'After 5 residency cycles'},
      'jalpakumari4':{'cycles':'Unmatched → IV Prep with Dr. B → Matched','visa':'Visa Denied (2017)'},
      'pmmenon47':{'img':'us IMGs','scores':'lower CK score','yog':'an older YOG'},
      'wahidarashidrak51':{'cycles':'I did not match in my first cycle'},
      'anissarahman74':{'yog':'I am a 2007 graduate. I applied for the 2013 Match'},
      'jess0':{'yog':'older graduate (YOG>10)','scores':'below average Step 2 score'},
      'akhilavarun1':{'interview':"felt uncertain about how to present myself in interviews"},
      'manishakanumuri2':{'img':'As an IMG'},
      'salinianoop3':{'cycles':'Last year, I received three interviews but unfortunately went unmatched.','yog':'12-year YOG candidate'},
      'shamsunnaharmit10':{'img':'As IMGs, we share','yog':'yog 8 years','cycles':'repeat applicant'},
      'monishas39':{'yog':'9 years since my year of graduation','cycles':'five-match attempts'},
      'sanoberyasmeen48':{'img':'we IMG need this'},
      'babalolamartins52':{'yog':'old YOG 2011','attempts':'multiple attempts on step 1 and step 2','cycles':'gone through Match twice unmatched'}
    }
    for fact in [dict(id='attempts',label='USMLE attempts'),dict(id='visa',label='Visa challenges')]:
        if not any(x['id']==fact['id'] for x in a['facts']):a['facts'].append(fact)
    proofs={};deltas=[];pending={};eligible=[];seen={};metadata=[]
    original_ids=[s['id'] for s in json.loads((ROOT.parent/'PROOF-INTEL-1201/stories.json').read_text())['stories']]
    for s in a['stories']:
        ident=s['id'];same=[t for t in entries if person(t['name'])==person(s['name'])]
        exact=[t for t in same if s.get('full')==t['full'] and s['quote'] in t['full']]
        t=exact[0] if len(exact)==1 else byid.get(replacements.get(ident))
        if ident in explicit_exclusions:pending[ident]=explicit_exclusions[ident];continue
        if ident in duplicate_sources:
            pending[ident]='Alternative derivative representation of selected primary entry; preserved privately, not duplicated in source-ready stream.';continue
        if not t:
            pending[ident]='No complete corresponding first-party full entry established. Same-person distinct submissions are not substituted.';continue
        assert person(t['name'])==person(s['name']),ident
        assert not re.search(r'\[truncated|\[Graphic|^Name:.*How Would You Rate',t['full'],re.I),ident
        old=copy.deepcopy(s)
        if s['quote'] not in t['full']:
            # Use the actual complete first sentence; no invented punctuation or quoted composite.
            full=t['full'];end=re.search(r'(?<=[.!?])\s+(?=[A-Z])',full)
            quote=full[:end.start()] if end else full
            if len(quote)<45:
                end=re.search(r'(?<=[.!?])\s+(?=[A-Z])',full[len(quote)+1:])
                if end:quote=full[:len(quote)+1+end.start()]
            s['quote']=quote
        s['full']=t['full'];assert s['quote'] in s['full'],ident
        if old['full']!=s['full'] or old['quote']!=s['quote']:
            deltas.append(dict(id=ident,entryId=t['id'],beforeFull=old['full'],afterFull=s['full'],beforeQuote=old['quote'],afterQuote=s['quote'],reason='Replace derivative representation with complete corresponding named first-party full entry; preserve exact original characters.'))
        # Published first-party metadata must be concrete, not placeholders or probabilistic assertions.
        specialty=t.get('specialty') or '';program=t.get('program') or ''
        if re.search(r'probable|matched|unknown',specialty,re.I):specialty=''
        if re.search(r'probable|confirmed|^match\b|unknown',program,re.I):program=''
        if t['id']=='shamsunnaharmit10':
            specialty='';program=''
            metadata.append(dict(id=ident,reason='Primary metadata says Psychiatry, full review says Internal Medicine; specialty and placement withheld due to conflict.'))
        s['specialty']=specialty or None;s['program']=program or None
        # Every application circumstance has a literal self-report evidence span.
        evidence_facts=fact_spans.get(t['id'],{})
        for fact,span in evidence_facts.items():assert span in s['full'],(ident,fact,span)
        s['facts']=list(evidence_facts)
        s.update(originalVerification='verified',fullOriginalVerified=True,fullTextStatus='source-matched-complete',verification='first-party-full-entry',source='Original written review',sourceDisplay=f"{s['name']} · MissionMed original testimonial library")
        for k in ['additional','additionalSource','fullSections']:
            if k in s:
                metadata.append(dict(id=ident,field=k,reason='Separate quote/answer lacks independently matched primary entry; omitted.'));s.pop(k)
        proof=dict(pageId=5465,field='_elementor_data',widgetId=widget['id'],widgetPath='[0].elements[0].settings.html',array='T',entryId=t['id'],sourceName=t['name'],displayName=s['name'],identityMethod='Exact normalized name or preserved Founder Chelsey/Chi Chia alias',sourceSnapshotSha256=sha(raw.read_bytes()),fullSha256=sha(s['full'].encode()),quoteSha256=sha(s['quote'].encode()),fullExactPrimaryField=True,quoteExactSubstring=True,metadataPrimaryFields=dict(specialty=s['specialty'],program=s['program']),factEvidence=evidence_facts,sourceBoundary='Entire full field of complete named first-party entry; excludes marked truncations/questionnaire-only summaries.')
        proofs[ident]=proof
        p['records'][ident].update(primaryOriginVerified=True,fullOriginalVerified=True,originalVerification='verified',primaryAuthentication=proof,releaseEligibility='Source-authenticated; other release gates managed separately.')
        assert t['id'] not in seen,(ident,seen.get(t['id']))
        seen[t['id']]=ident;eligible.append(copy.deepcopy(s))
    a['stories']=[s for s in a['stories'] if s['id'] not in explicit_exclusions]
    a['featuredStoryIds']=[i for i in original_ids if i not in explicit_exclusions]
    a['counts'].update(publicStories=len(a['stories']),publicPeople=len({p['records'][s['id']]['personId'] for s in a['stories']}),publicVideoStories=sum(bool(s.get('video')) for s in a['stories']))
    a['sourceAuthentication']=dict(verifiedStories=len(eligible),pendingStories=len(a['stories'])-len(eligible),excludedIncompleteIds=list(explicit_exclusions))
    a['collectionLabel']='Review candidate · source verification shown per story';a['releaseStatus']='mixed-authentication-candidate-only'
    release=copy.deepcopy(a);release['stories']=eligible;release['featuredStoryIds']=[i for i in original_ids if i in proofs]
    release['idAliases']={k:v for k,v in a.get('idAliases',{}).items() if v in proofs}
    leads={'confidence':'Read how students describe confidence in their own words.','communication':'From approaching a question to expressing yourself: students share their experiences.','value':'Students describe the value of their training in their own words.'}
    for theme in release['themes']:
        if theme['id'] in leads:theme['text']=leads[theme['id']]
    release['collectionLabel']='Authentic student testimonials';release['releaseStatus']='source-authenticated-awaiting-other-release-gates'
    release['counts']=dict(publicStories=len(eligible),publicPeople=len({p['records'][s['id']]['personId'] for s in eligible}),publicVideoStories=sum(bool(s.get('video')) for s in eligible))
    release['sourceAuthentication']=dict(verifiedStories=len(eligible),pendingStories=0)
    release['fullTextReconciliation']=dict(records=len(eligible),completeRetainedRecords=len(eligible),unreconciled=[],fullOriginalVerified=len(eligible))
    for s in release['stories']:
        t=byid[proofs[s['id']]['entryId']];assert s['full']==t['full'] and s['quote'] in t['full']
        assert not any(k in s for k in ['additional','additionalSource','fullSections'])
    p['sourceHashes'][str(raw)]=sha(raw.read_bytes())
    save(ROOT/'public/data/archive.json',a);save(P/'archive.release.json',release);save(P/'provenance.json',p)
    coverage=[]
    for t in entries:
        if t['id'] in seen: reason='Included: complete corresponding primary full field.'
        elif re.search(r'\[truncated',t['full'],re.I):reason='Excluded: explicitly truncated primary field; full original not recovered.'
        elif re.search(r'structured|^Name:.*How Would You Rate|^Full Name:|^A Quick Review|Post-Training Survey',t['full'],re.I):reason='Excluded: structured questionnaire/transcription or summary; original verbatim answer boundaries not established.'
        elif re.search(r'video testimonial|\[Graphic',t['full'],re.I):reason='Excluded: media description or editorial annotation; complete original written narrative/spoken transcript not established.'
        else:raise AssertionError(('Unaccounted primary entry',t['id']))
        coverage.append(dict(entryId=t['id'],name=t['name'],publicId=seen.get(t['id']),reason=reason))
    result=dict(primaryEntryCoverage=coverage,source=dict(path=str(raw),sha256=sha(raw.read_bytes()),readOnlyCommand="ssh missionmed-kinsta 'cd /www/theresidencyacademy_209/public && wp --skip-plugins --skip-themes post meta get 5465 _elementor_data'",widgetId=widget['id'],primaryEntries=len(entries),custody='Read-only WP CLI extraction from first-party MissionMed production page metadata. JS literal decoded without code execution. JSON/JS escape decoding restores the strings consumed by the original page; no text normalization.'),releaseCounts=release['counts'],candidateCounts=a['counts'],featuredStoryIds=release['featuredStoryIds'],proofs=proofs,pending=pending,explicitExclusions=explicit_exclusions,primaryTextReplacements=deltas,metadataOmissions=metadata,releaseArchiveSha256=sha((P/'archive.release.json').read_bytes()),candidateArchiveSha256=sha((ROOT/'public/data/archive.json').read_bytes()))
    save(P/'elementor_primary_authentication.json',result)
    counts=json.loads((P/'counts.json').read_text());counts['counts'].update(a['counts']);counts['sourceReadyCounts']=release['counts'];counts['sourceAuthentication']=a['sourceAuthentication'];save(P/'counts.json',counts)
    report='# First-party original source authentication\n\n'+json.dumps({k:result[k] for k in ['releaseCounts','candidateCounts','featuredStoryIds','releaseArchiveSha256','candidateArchiveSha256']},indent=2)+'\n\n'
    report+='Source: live first-party WP page5465 `_elementor_data`, HTML widget `c815377`, literal array `T` (102 identity-keyed entries). Exact read command, private source hash and per-entry locators in `elementor_primary_authentication.json`. The earlier post_content-only zero-match gate inspected the wrong storage surface and is superseded. Every release `full` equals its complete corresponding entry field byte-for-byte after standard JSON/JS literal decoding; every displayed quote is a contiguous substring. No punctuation/spelling normalization. This authenticates MissionMed’s own archived original library, not an independently fetched original Facebook post or audio recording.\n\n'
    report+='Release uses one card per selected primary entry. Named complete fields may replace derivative CSV text with explicit before/after evidence; distinct same-person submissions are not substituted. Seven replacements are explicitly mapped. Every one of the 102 primary entries has an included/excluded decision. Two short complete match announcements are included without a minimum-length threshold. Concern tags carry exact self-report spans privately; broader relevance is not asserted as personal circumstances. Truncated or structured-only records are not full reviews. Separate unverified source answers are omitted. Specialty/program values marked probable, generic Matched/Match-year, or conflicting are omitted. Course values remain for Founder classification overlay by the release builder.\n\n'
    report+='Private `archive.release.json` is the source-ready projection. Public local candidate remains available with pending labels for the remaining records; it is not the production payload. The two expressly unresolved Yamini and truncated Renu cards are excluded from public candidate, but retained in private reconciliation. Other unmatched records are excluded from strict release only. No arbitrary record cap; exclusions are source-specific. Other production gates remain owned by Foreman.\n\n## Pending/excluded\n'+json.dumps(pending,indent=2)+'\n'
    (P/'PRIMARY_SOURCE_AUTHENTICATION.md').write_text(report)
    print(json.dumps({k:result[k] for k in ['releaseCounts','candidateCounts','featuredStoryIds','releaseArchiveSha256','candidateArchiveSha256']},indent=2))
if __name__=='__main__':authenticate()
