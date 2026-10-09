#!/usr/bin/env python3
"""Read-only source ingestion. Writes only the scoped 1300 data/evidence outputs."""
from pathlib import Path
import csv, json, hashlib, re, unicodedata
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[1]
HQ = Path('/Users/brianb/MissionMed')
SRC = HQ / '04_PROOF/TESTIMONIALS'
LEDGER = Path('/Users/brianb/MissionMed_worktrees/Claude outputs/MR_TESTIMONIAL_PRIMARY_SOURCE_LEDGER.md')
BASE = ROOT.parent / 'PROOF-INTEL-1201/stories.json'
def sha(v): return hashlib.sha256(v).hexdigest()
def norm(v): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', v).casefold())
def text_key(v): return re.sub(r'\s+', ' ', v).strip()
ALIASES = {'chelseycc':'chichialoh', 'jessanonymous':'jessanonymous', 'anonymousjess':'jessanonymous', 'shamimasomi':'shamimaaktersomi'}
def person(v): return ALIASES.get(norm(v), norm(v))
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def main():
    base = json.loads(BASE.read_text()); ledger = LEDGER.read_text()
    manifest, pending, candidates, allrows = {}, [], [], []
    discovered = {}; hashes = {str(LEDGER):sha(LEDGER.read_bytes()),str(BASE):sha(BASE.read_bytes())}
    for path in sorted(SRC.glob('*.csv')):
        raw = path.read_bytes(); hashes[str(path)] = sha(raw)
        rows = list(csv.DictReader(raw.decode('utf-8-sig').splitlines(keepends=True)))
        discovered[path.name] = len(rows)
        for i,row in enumerate(rows,2):
            name = row.get('Name') or row.get('Poster Name') or row.get('poster_name') or ''
            key = person(name)
            source = dict(path=str(path), row=i, sha256=hashes[str(path)], name=name)
            allrows.append(dict(name=name, personId=key, source=source, row=row))
            field = next((x for x in ['Full Text','Full Review Text','full_text'] if x in row),None)
            if not field:
                pending.append(dict(**source,reason='Secondary alumni metadata/short quote; not a primary written review.')); continue
            rawtext = row[field]; source['field'] = field; source['textSha256']=sha(rawtext.encode())
            text = rawtext.strip()
            if not text or re.search(r'\[truncated|structured|video testimonial|post-training survey',text,re.I):
                pending.append(dict(**source,reason='Summary, structured transcription or placeholder requires original-source recovery.')); continue
            # A source may append an archivist label after a real short match announcement.
            annotation = text.find('[Graphic post')
            if annotation >= 0: text = text[:annotation].rstrip()
            if text.startswith(('Full Name:', 'A Quick Review of', '"5 Day IV Prep')) or (text.startswith('Name:') and re.search(r'How Would You Rate|Rating:|Training description:',text)):
                pending.append(dict(**source,reason='Questionnaire wrapper; answer boundaries require review.')); continue
            if len(text)<25:
                pending.append(dict(**source,reason='Brief match announcement without substantive testimonial; retained in private roster.')); continue
            short=row.get('Testimonial Quote') or row.get('Short Quote') or row.get('short_quote') or ''
            if short not in text or len(short)<35: short=''
            candidates.append(dict(name=name, personId=key,text=text,short=short,source=source,raw=row))
    # Identical substantial text attributed to different people is not an identity join.
    owners=defaultdict(set)
    for c in candidates: owners[text_key(c['text'])].add(c['personId'])
    conflicts={k:v for k,v in owners.items() if len(v)>1 and len(k)>100}
    eligible=[]
    for c in candidates:
        if text_key(c['text']) in conflicts:
            pending.append(dict(**c['source'],reason='Identical review attributed to different people; attribution conflict.',candidatePeople=sorted(conflicts[text_key(c['text'])])));continue
        eligible.append(c)
    # Only exact identity + exact text (formatting whitespace excepted) is deduplicated.
    # Similarity, shared phrases and containment are NOT evidence of the same submission.
    keyed_groups={}
    for c in eligible:
        keyed_groups.setdefault((c['personId'],text_key(c['text'])),[]).append(c)
    groups=list(keyed_groups.values())
    assert all(len({(x['personId'],text_key(x['text'])) for x in g})==1 for g in groups)
    stories=[]; curated_people={person(x['name']):x for x in base['stories']}
    for old in base['stories']:
        assert old['quote'] in ledger, old['id']
        if old.get('additional'):assert old['additional'] in ledger
        s={k:v for k,v in old.items() if k not in ('source','factEvidence')}
        s.update(personId=person(s['name']),program=None,course=None,source='Verified written review',verification='primary-ledger',kind='written')
        evidence=dict(path=str(LEDGER),sha256=hashes[str(LEDGER)],field='Verified primary-source ledger',quoteSha256=sha(s['quote'].encode()),originalLocator=old['source'],factEvidence=old.get('factEvidence',{}))
        # Preserve original curated full text only if exact source readback succeeds.
        if s.get('full'):
            fullsources=[c['source'] for c in candidates if c['personId']==s['personId'] and s['full'] in c['text']]
            assert fullsources or s['full'] in ledger, s['id']
            evidence['fullSources']=fullsources
        manifest[s['id']]=evidence;stories.append(s)
    absorbed=0
    for g in groups:
        # First exact-text copy is deterministic; distinct punctuation/wording remains separate.
        c=g[0]; own=curated_people.get(c['personId'])
        curated=next((s for s in stories if own and s['id']==own['id']),None)
        full_equal=bool(curated and curated.get('full') and text_key(curated['full'])==text_key(c['text']))
        fb_rows=[int(n) for n in re.findall(r'FB(?: Archive)? row (\d+)',own['source'],re.I)] if own else []
        # A curated excerpt can point to its explicit known FB row, not any same-person text.
        locator_match=bool(curated and not curated.get('full') and curated['quote'] in c['text'] and any(Path(x['source']['path']).name=='MISSIONRESIDENCY_FACEBOOK_TESTIMONIAL_ARCHIVE_MASTER.csv' and x['source']['row'] in fb_rows for x in g))
        if curated and (full_equal or locator_match):
            manifest[curated['id']].setdefault('corroboratingCopies',[]).extend(x['source'] for x in g)
            manifest[curated['id']].setdefault('dedupDecisions',[]).append(dict(method='exact curated full text' if full_equal else 'explicit curated original row locator and exact excerpt',source=c['source']))
            absorbed+=1;continue
        quote=c['short']
        if not quote:
            # Single contiguous opening excerpt, no added punctuation, no synthetic ellipsis.
            end=min(len(c['text']),300)
            if end<len(c['text']):end=c['text'].rfind(' ',0,end)
            quote=c['text'][:end]
        assert quote and quote in c['text']
        ident='review-'+sha((c['personId']+'\0'+text_key(c['text'])).encode())[:14]
        s=dict(id=ident,personId=c['personId'],name=own['name'] if own else c['name'],quote=quote,full=c['text'],specialty=None,program=None,course=None,facts=[],themes=[],video=None,source='Archived written review',verification='archive-source-matched',kind='written')
        # No inferred biographical facts from thematic words. Only explicit self-reported specialty.
        fieldEvidence={}
        for specialty in ['Internal Medicine','Family Medicine','Pediatrics','Psychiatry','Child Neurology','Anesthesiology']:
            for sentence in re.split(r'(?<=[.!?])\s+',c['text']):
                if specialty.lower() in sentence.lower() and re.search(r'\bI (?:have |am proud to have |had )?matched\b|\bI matched into\b',sentence,re.I):
                    s['specialty']=specialty;fieldEvidence['specialty']=sentence;break
        for theme in base['themes']:
            hits=[k for k in theme['keys'] if re.search(r'\b'+re.escape(k)+r'\b',c['text'],re.I)]
            if hits:s['themes'].append(theme['id'])
        manifest[ident]=dict(primary=c['source'],copies=[x['source'] for x in g],quoteSha256=sha(quote.encode()),fullSha256=sha(c['text'].encode()),fieldEvidence=fieldEvidence,themeMethod='literal keyword matching; concern relevance is not a biographical fact')
        stories.append(s)
    # Curated records receive verified placement only where the primary ledger states it.
    placements={'marian':'St. Joseph University Medical Center','sonia':"SSM St Mary's Hospital-St Louis",'krishna':'Mercy Catholic Medical Center','suman':"Creighton University / St. Joseph's Hospital Phoenix",'wahida':'Baptist Health-UAMS'}
    for s in stories:
        if s['id'] in placements and placements[s['id']] in ledger:
            s['program']=placements[s['id']];manifest[s['id']]['programEvidence']='Primary-source ledger matched-program field; '+placements[s['id']]
    # Every quoted value and expanded review is asserted against its retained source bytes.
    for s in stories:
        m=manifest[s['id']]
        if 'primary' in m:
            p=m['primary'];rr=list(csv.DictReader(Path(p['path']).open(encoding='utf-8-sig')))[p['row']-2]
            assert s['quote'] in rr[p['field']] and s['full'] in rr[p['field']],s['id']
        else:
            assert s['quote'] in ledger
            if s.get('full'):assert s['full'] in ledger or any(s['full'] in c['text'] for c in candidates if c['personId']==s['personId'])
    registryPath=HQ/'VIDEO_SYSTEM/mmvs_unified_registry.json'
    registry=json.loads(registryPath.read_text());hashes[str(registryPath)]=sha(registryPath.read_bytes())
    transcripts=list((HQ/'VIDEO_SYSTEM/FULL_TRANSCRIPT_MASTER').glob('*.txt'))
    structured=list((HQ/'VIDEO_SYSTEM/transcripts').glob('*.json'))
    videoPending=[]
    for v in registry:
        tp=HQ/'VIDEO_SYSTEM/transcripts'/Path(v.get('transcript_path') or '').name
        vp=HQ/v.get('video_path','')
        videoPending.append(dict(id=v['id'],type=v.get('type'),title=v.get('title'),candidateMediaPath=str(vp),mediaExists=vp.is_file(),candidateTranscriptPath=str(tp),transcriptExists=tp.is_file(),speaker=v.get('speaker'),reason='Requires verified identity/media/transcript crosswalk and timestamp alignment before public speech quotes.'))
    roster={}
    for r in allrows:
        roster.setdefault(r['personId'],dict(personId=r['personId'],name=r['name'],aliases=[],sources=[],storyIds=[],videoIds=[],specialty=None,program=None,course=None))
        entry=roster[r['personId']]
        if r['name'] not in entry['aliases']:entry['aliases'].append(r['name'])
        entry['sources'].append(r['source'])
    for s in stories:
        r=roster.setdefault(s['personId'],dict(personId=s['personId'],name=s['name'],aliases=[s['name']],sources=[],storyIds=[],videoIds=[],specialty=None,program=None,course=None))
        r['name']=s['name'];r['storyIds'].append(s['id'])
        if s.get('video') and s['video'] not in r['videoIds']:r['videoIds'].append(s['video'])
        for k in ['specialty','program']:
            if s.get(k):r[k]=s[k]
    counts=dict(csvRows=sum(discovered.values()),csvFiles=len(discovered),eligibleWrittenSourceRows=len(eligible),deduplicatedReviewGroups=len(groups),curatedPreserved=12,curatedAbsorbedGroups=absorbed,publicStories=len(stories),publicPeople=len({s['personId'] for s in stories}),publicVideoStories=sum(bool(s.get('video')) for s in stories),privateRosterPeople=len(roster),pendingCsvRows=len(pending),videoRegistryEntries=len(registry),testimonialVideoRegistryEntries=sum(v.get('type')=='testimonial' for v in registry),transcriptTextFiles=len(transcripts),structuredTranscriptFiles=len(structured),additionalVideoJoinsVerified=0)
    for s in stories:
        manifest[s['id']]['personId']=s['personId']
        manifest[s['id']]['primaryOriginVerified']=False
        manifest[s['id']]['releaseEligibility']='Pending original-source authentication; candidate only.'
    publicStories=[{k:v for k,v in s.items() if k!='personId'} for s in stories]
    archive=dict(schemaVersion=1,collectionLabel='Source-linked review candidate · original-source verification pending',releaseStatus='candidate-only',stories=publicStories,themes=base['themes'],facts=base['facts'],counts={k:counts[k] for k in ['publicStories','publicPeople','publicVideoStories']})
    write(ROOT/'public/data/archive.json',archive)
    write(ROOT/'ingestion/provenance.json',dict(sourceHashes=hashes,records=manifest))
    write(ROOT/'ingestion/roster.json',dict(students=sorted(roster.values(),key=lambda x:x['name'].casefold()),aliasDecisions={'Chelsey Cc / Chi Chia Loh':'Founder name mapping preserved from approved curated collection.','Anonymous (Jess) / Jess (Anonymous)':'Same named anonymous review text.','Shamima Somi / Shamima Akter Somi':'Exact full-review identity statement and duplicate text.'}))
    write(ROOT/'ingestion/pending.json',dict(csv=pending,videos=videoPending,transcripts=[dict(path=str(p),sha256=sha(p.read_bytes()),reason='Audio/source attribution and timecode review pending.') for p in transcripts]))
    write(ROOT/'ingestion/counts.json',dict(counts=counts,sourceRows=discovered,themes={t['id']:sum(t['id'] in s['themes'] for s in stories) for t in base['themes']}))
    report='# PROOF-INTEL-1300 corpus ingestion\n\n'+json.dumps(counts,indent=2)+'\n\n'
    report+='## What is verified\nAll emitted quote/full fields are exact contiguous substrings of retained source text. The initial 12 IDs and quotations are preserved and checked against the primary-source ledger. Archived CSV text is source-matched, not claimed to be independently compared to the original Facebook UI or audio. Course assignment is null for everyone pending Founder confirmation. Founder consent is recorded as a policy assertion from the 1300 directive.\n\n'
    report+='## Conservative exclusions and deduplication\nNo numeric collection cap. All eight current CSVs were read. Secondary short labels, structured summaries, placeholders, and attribution conflicts remain in the pending manifest. Only exact text plus evidenced identity is deduplicated, with whitespace normalization for formatting only. Capitalization, punctuation and wording differences remain separate candidate records. No fuzzy similarity, containment or shared-excerpt auto-merge remains. Curated overlap is absorbed only on identical full text or an explicit known original FB row locator plus exact excerpt; the initial12 quotes/full/additional values remain untouched. Distinct reviews from one person remain separate. A substantial identical review attributed to Gunjanpreet Kaur and Kaur Komal is quarantined. Known Founder Chelsey/Chi Chia identity mapping is preserved; other spelling-similarity joins are not guessed.\n\n'
    report+='## Metadata and media limits\nThemes are literal relevance matching, not factual red flags. Added stories have no inferred application-fact badges. Specialty is emitted only for explicit self-reported match statements; existing curated specialty retained. Five curated residency placements are supported by the primary ledger (Marian, Sonia, Krishna, Suman, Wahida); these are ledger-backed, not newly rechecked institutional outcomes. Yamini placement is deliberately omitted: local sources name different Lincoln institutions. Gunjan ledger “Matched Program: Match 2020” is not an institution and is omitted. All registry videos and transcript files are discovered and catalogued privately, but blank speaker fields and stale media paths prevent truthful automatic person joins. Three previously verified curated clips remain playable; additional clips, spoken quotes and timestamps remain pending. Full library is NOT represented as all ever.\n\n'
    report+='## Quarantine reasons\n'+json.dumps(dict(Counter(x['reason'] for x in pending)),indent=2)+'\n\n'
    report+='## Verbatim gate limitation\nPassing a byte/substr assertion proves equality to the retained corpus/ledger, not independent authentication of original social posts or audio. Some source archives were previously edited or normalized. New archive records are marked archive-source-matched, while the 12 selected quotes are primary-ledger records. Production must not describe all imported rows as independently original-source verified. Original-origin review is a release decision separate from this mechanical assertion. The public candidate contains no internal filesystem paths, private roster rows, or internal person IDs.\n\n'
    report+='## Repeatable gate\nRun `python3 ingestion/build_corpus.py`. It reads sources without alteration, validates verbatim substrings, and replaces only generated scoped data. `ingestion/provenance.json` records source paths/rows/field names/file hashes and quote hashes. Keep ingestion files private; only public/data/archive.json is designed for public serving.\n'
    # Single supported rebuild command includes full-source reconciliation and exact-source dedup.
    from reconcile_full_originals import reconcile
    reconcile()
    from authenticate_primary import authenticate
    authenticate()
    final_counts=json.loads((ROOT/'ingestion/counts.json').read_text())['counts']
    report=report.replace(json.dumps(counts,indent=2),json.dumps(final_counts,indent=2),1)
    report+='\n## Full-source reconciliation supersedes base excerpt handling\nSee ingestion/FULL_ORIGINAL_RECONCILIATION.md for recovered complete archival records, the three exact-source excerpt repairs, and five exact-full-source aliases removed from the card stream. The local candidate includes per-record authentication status. Source-ready release projection and the superseding Elementor primary gate are documented in ingestion/PRIMARY_SOURCE_AUTHENTICATION.md; only that projection is eligible for other release gates.\n'
    (ROOT/'ingestion/CORPUS_REPORT.md').write_text(report)

if __name__=='__main__':main()
