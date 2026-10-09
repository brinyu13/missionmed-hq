// Pure shared server/browser contracts. V2 framing is retained for saved-read compatibility; V3 requires a separate independent verifier.
export const PROSE_GUARD='PROSE_INDEPENDENT_CHECK_V3';
export const PROSE_SCHEMA='iiq-loi-prose-plan-v3';
export const PROSE_FRAMES=Object.freeze([
 'Dear Program Leadership,',
 'I am writing to express my interest in your program.',
 'I would like to begin with the priority that guides my interest.',
 'I would like to explain why this program interests me.',
 'The following program detail is especially relevant to my interest.',
 'I would like to connect that program detail with my own priorities.',
 'This is the priority I want to bring into my training.',
 'This is the context for my letter.',
 'I would like to share this confirmed update.',
 'I would like to reflect on my confirmed interview experience.',
 'These are the reasons behind my interest.',
 'I hope to discuss that connection further.',
 'Thank you for considering my interest.'
]);
export const PROSE_FIT_FRAME='I would like to connect that program detail with my own priorities.';
const proseFail=code=>{const e=new Error(code);e.code=code;throw e;};
const proseNeed=(v,c)=>{if(!v)proseFail(c);};
const proseKeys=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.slice().sort().join();
const concreteDetail=s=>/\b(?:clinic\w*|continuity|rotation\w*|curriculum|simulation|mentorship|mentor\w*|research|scholar\w*|fellowship\w*|inpatient|outpatient|ambulatory|rural|underserved|elective\w*|procedure\w*|protected|track\w*|certification|board|ABIM|night|ward\w*)\b/i.test(s)||/\b\d+(?:\.\d+)?\s*(?:%|(?:weeks?|months?|years?|hours?|residents?|patients?)\b)/i.test(s);
const genericReason=s=>/^(?:i (?:am interested in|like|love|want to join) (?:your |the )?program|excellent training|great program|good fit|training outcomes matter)[.! ]*$/i.test(s.trim());
export function validateLegacyProseTrace(row,refs){
 proseNeed(proseKeys(row,['approach','text','claims','fitLinks']),'loi_composition_trace');
 proseNeed(typeof row.text==='string'&&row.text.length>0&&row.text.length<=20000&&Array.isArray(refs)&&refs.length>0&&refs.length<=90,'loi_composition_output');
 proseNeed(new Set(refs.map(r=>r.ref)).size===refs.length&&refs.every(r=>typeof r.ref==='string'&&typeof r.text==='string'&&r.text.trim()===r.text&&!r.text.includes('\n\n')),'loi_composition_reference');
 proseNeed(Array.isArray(row.claims)&&row.claims.length===refs.length,'loi_composition_reference');
 const claims=row.claims.slice().sort((a,b)=>a.start-b.start),used=new Set(),paragraphs=row.text.split('\n\n');let cursor=0;const offsets=paragraphs.map(text=>{const p={text,start:cursor,end:cursor+text.length};cursor=p.end+2;return p;});
 proseNeed(paragraphs.length<=190&&paragraphs.every(Boolean),'loi_composition_output');
 for(const c of claims){proseNeed(proseKeys(c,['ref','start','end'])&&Number.isSafeInteger(c.start)&&Number.isSafeInteger(c.end)&&c.start>=0&&c.end>c.start&&c.end<=row.text.length&&!used.has(c.ref),'loi_composition_trace');const r=refs.find(r=>r.ref===c.ref);proseNeed(r&&row.text.slice(c.start,c.end)===r.text,'loi_composition_reference');const p=offsets.find(p=>p.start===c.start&&p.end===c.end);proseNeed(p&&!p.ref,'loi_composition_trace');p.ref=c.ref;p.kind=r.kind;used.add(c.ref);}
 proseNeed(refs.every(r=>used.has(r.ref)),'loi_composition_reference');
 // No untraced sentence, fragment, negation, attribution, ranking promise or invented number can survive.
 for(const p of offsets)if(!p.ref)proseNeed(PROSE_FRAMES.includes(p.text),'loi_composition_unsupported');
 proseNeed(offsets[0].text===PROSE_FRAMES[0]&&offsets.at(-1).text===PROSE_FRAMES.at(-1),'loi_composition_structure');
 proseNeed(offsets.filter(p=>!p.ref).length>=3,'loi_composition_specificity');
 proseNeed(Array.isArray(row.fitLinks)&&row.fitLinks.length>0&&row.fitLinks.length<=20,'loi_composition_specificity');
 const fitPairs=new Set();
 for(const f of row.fitLinks){proseNeed(proseKeys(f,['evidenceRef','reasonRef']),'loi_composition_trace');const ev=refs.find(r=>r.ref===f.evidenceRef&&r.kind==='evidence'),reason=refs.find(r=>r.ref===f.reasonRef&&r.kind==='reason');proseNeed(ev&&reason&&ev.field&&concreteDetail(ev.text)&&reason.text.trim().split(/\s+/).length>=5&&!genericReason(reason.text),'loi_composition_specificity');const ei=offsets.findIndex(p=>p.ref===ev.ref),ri=offsets.findIndex(p=>p.ref===reason.ref),lo=Math.min(ei,ri),hi=Math.max(ei,ri);proseNeed(hi-lo===2&&offsets[lo+1].text===PROSE_FIT_FRAME,'loi_composition_specificity');const pair=f.evidenceRef+'|'+f.reasonRef;proseNeed(!fitPairs.has(pair),'loi_composition_trace');fitPairs.add(pair);}
 // Requested approaches must actually change narrative structure, not swap adjectives.
 const first=offsets.find(p=>p.ref&&p.kind!=='identity');const wanted={WARM_PERSONAL:'reason',DIRECT_CONCISE:'context',ACADEMIC_PROGRAM:'evidence',POST_INTERVIEW:'context',UPDATE_LED:'fact',STRONG_INTEREST:'reason'}[row.approach];proseNeed(first?.kind===wanted,'loi_composition_structure');
 proseNeed(row.approach==='POST_INTERVIEW'||!paragraphs.includes('I would like to reflect on my confirmed interview experience.'),'loi_composition_structure');proseNeed(row.approach==='UPDATE_LED'||!paragraphs.includes('I would like to share this confirmed update.'),'loi_composition_structure');
 return {claims:claims.map(c=>({...c})),fitLinks:row.fitLinks.map(f=>({...f})),structure:claims.map(c=>c.ref).join('|')};
}

// Author self-traces are structural input only. A separate verifier must cover
// every deterministic clause, including prose outside these exact source spans.
export const VERIFICATION_SCHEMA='iiq-loi-independent-verification-v1';
export function proseUnits(text){
 proseNeed(typeof text==='string'&&text.length>0&&text.length<=20000,'loi_composition_output');const out=[];let start=0;
 const add=end=>{const quote=text.slice(start,end);if(quote.trim())out.push({id:'unit:'+out.length,start,end,quote});start=end;};
 for(let i=0;i<text.length;i++)if(/[.!?;\n]/.test(text[i])&&!(text[i]==='.'&&/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||'')))add(i+1);
 if(start<text.length)add(text.length);proseNeed(out.length>0&&out.length<=250,'loi_composition_output');return out;
}
export function validateProseTrace(row,refs){
 proseNeed(proseKeys(row,['approach','text','claims','fitLinks']),'loi_composition_trace');proseUnits(row.text);
 proseNeed(Array.isArray(refs)&&refs.length>0&&refs.length<=90&&new Set(refs.map(r=>r.ref)).size===refs.length&&refs.every(r=>typeof r.ref==='string'&&typeof r.text==='string'&&r.text.trim()===r.text&&r.text.length>0),'loi_composition_reference');
 proseNeed(Array.isArray(row.claims)&&row.claims.length===refs.length,'loi_composition_reference');const claims=row.claims.slice().sort((a,b)=>a.start-b.start),used=new Set();let end=0;
 for(const c of claims){const r=refs.find(r=>r.ref===c.ref);proseNeed(proseKeys(c,['ref','start','end'])&&r&&!used.has(c.ref)&&Number.isSafeInteger(c.start)&&Number.isSafeInteger(c.end)&&c.start>=end&&c.end>c.start&&c.end<=row.text.length&&row.text.slice(c.start,c.end)===r.text,'loi_composition_reference');used.add(c.ref);end=c.end;}
 proseNeed(refs.every(r=>used.has(r.ref)),'loi_composition_reference');proseNeed(Array.isArray(row.fitLinks)&&row.fitLinks.length>0&&row.fitLinks.length<=20,'loi_composition_specificity');const pairs=new Set();
 for(const f of row.fitLinks){const ev=refs.find(r=>r.ref===f.evidenceRef&&r.kind==='evidence'),reason=refs.find(r=>r.ref===f.reasonRef&&r.kind==='reason');proseNeed(proseKeys(f,['evidenceRef','reasonRef'])&&ev?.field&&reason&&concreteDetail(ev.text)&&reason.text.trim().split(/\s+/).length>=5&&!genericReason(reason.text)&&!pairs.has(f.evidenceRef+'|'+f.reasonRef),'loi_composition_specificity');pairs.add(f.evidenceRef+'|'+f.reasonRef);}
 const first=claims.map(c=>refs.find(r=>r.ref===c.ref)).find(r=>r.kind!=='identity'),wanted={WARM_PERSONAL:'reason',DIRECT_CONCISE:'context',ACADEMIC_PROGRAM:'evidence',POST_INTERVIEW:'context',UPDATE_LED:'fact',STRONG_INTEREST:'reason'}[row.approach];proseNeed(first?.kind===wanted,'loi_composition_structure');
 return {claims:claims.map(c=>({...c})),fitLinks:row.fitLinks.map(f=>({...f})),structure:claims.map(c=>c.ref).join('|')};
}
const reviewText=x=>typeof x==='string'&&x.trim().length>=12&&x.length<=800;
export function validateProseVerification(row,refs,verdict,program,index=0){
 const trace=validateProseTrace(row,refs),units=proseUnits(row.text);
 proseNeed(proseKeys(verdict,['schema','programId','registryReleaseId','candidateId','approach','units','fit','quality','variation'])&&verdict.schema===VERIFICATION_SCHEMA&&verdict.programId===program.id&&verdict.registryReleaseId===program.registryReleaseId&&verdict.candidateId==='candidate:'+index&&verdict.approach===row.approach,'loi_verifier_binding');
 proseNeed(Array.isArray(verdict.units)&&verdict.units.length===units.length,'loi_verifier_completeness');
 for(let i=0;i<units.length;i++){const expected=units[i],u=verdict.units[i];proseNeed(proseKeys(u,['id','start','end','quote','classification','refs','reason'])&&['id','start','end','quote'].every(k=>u[k]===expected[k])&&Array.isArray(u.refs)&&new Set(u.refs).size===u.refs.length&&u.refs.every(r=>refs.some(x=>x.ref===r))&&reviewText(u.reason),'loi_verifier_completeness');
  proseNeed(['SUPPORTED_FACT','NONFACTUAL'].includes(u.classification),'loi_verifier_unsupported');const covered=trace.claims.filter(c=>c.start<expected.end&&c.end>expected.start);if(u.classification==='NONFACTUAL')proseNeed(!u.refs.length&&!covered.length,'loi_verifier_support');else proseNeed(u.refs.length>0&&covered.every(c=>u.refs.includes(c.ref)),'loi_verifier_support');
 }
 const fit=verdict.fit;proseNeed(proseKeys(fit,['evidenceRef','reasonRef','supported','explanation'])&&fit.supported===true&&trace.fitLinks.some(f=>f.evidenceRef===fit.evidenceRef&&f.reasonRef===fit.reasonRef)&&reviewText(fit.explanation),'loi_verifier_fit');
 const q=verdict.quality;proseNeed(proseKeys(q,['personalized','couldSendUnchangedToOtherProgram','coherent','approachDistinct','explanation'])&&q.personalized===true&&q.couldSendUnchangedToOtherProgram===false&&q.coherent===true&&q.approachDistinct===true&&reviewText(q.explanation),'loi_verifier_quality');
 proseNeed(proseKeys(verdict.variation,['materiallyDifferent','explanation'])&&verdict.variation.materiallyDifferent===true&&reviewText(verdict.variation.explanation),'loi_verifier_variation');return verdict;
}

// Single-call authoring is distinct from saved V2/V3 contracts. Author labels
// are never evidence: server/browser reconstruct every allowed span and gap.
export const SINGLE_CALL_SCHEMA='iiq-loi-prose-plan-v4';
export const SINGLE_CALL_GUARD='PROSE_LOCAL_SPANS_V4';
export const LOCAL_FRAMING_RULES=Object.freeze([
 'I (am writing|would like to write|hope to write) (with|to express) [a/my] [clear/focused/specific/personal/genuine] (purpose/interest/perspective).',
 'I (would like|want|hope) to (explain|describe|share|connect|clarify|discuss|explore|present|express|outline) (my interest/my reasons/my priorities/this connection/this context/my perspective/this purpose/my thinking).',
 '(These|Those|My) (details|priorities|reasons|reflections) (frame|shape|guide|inform) (my interest/this letter/my thinking/this connection).',
 '(The|This|That) (connection|priority|context|purpose|focus) (is|remains) (clear|personal|specific|important to me).',
 'Thank you for (considering|reading) (my interest/this letter/my perspective).',
 'The canonical program-name span may appear in I am writing to [exact program span] with a clear/focused/specific purpose. No other factual span may be modified or negated.',
 'Transitions: First; Above all; With that context; In particular; For this reason; Taken together; To begin; In closing. No assertions, modifiers or negations may alter source spans.'
]);
const nouns='(?:my (?:interest|reasons|priorities|perspective|thinking)|this (?:connection|context|purpose|letter))';
const framing=[
 /^(?:Dear Program Leadership,|Thank you for (?:considering|reading) (?:my interest|this letter|my perspective)\.)$/,
 /^I (?:am writing|would like to write|hope to write) (?:with|to express) (?:a |my )?(?:(?:clear|focused|specific|personal|genuine) )?(?:purpose|interest|perspective)\.$/,
 new RegExp('^I (?:would like|want|hope) to (?:explain|describe|share|connect|clarify|discuss|explore|present|express|outline) '+nouns+'\\.$'),
 /^(?:These|Those|My) (?:details|priorities|reasons|reflections) (?:frame|shape|guide|inform) (?:my interest|this letter|my thinking|this connection)\.$/,
 /^(?:The|This|That) (?:connection|priority|context|purpose|focus) (?:is|remains) (?:clear|personal|specific|important to me)\.$/,
 /^I (?:hope|would welcome the opportunity) to discuss (?:this connection|my interest|my priorities) further\.$/
];
const transition=/^(?:First|Above all|With that context|In particular|For this reason|Taken together|To begin|In closing),$/;
function safeGap(text){
 // Positive whole-clause grammar, never a blacklist or author self-assessment.
 // Punctuation-only gaps cannot open a negating/attributing quotation context.
 const s=text.trim();if(!s)return {sentences:[],transition:false};
 proseNeed(!/["'`“”‘’<>\\\[\]{}:!?\d]/.test(s),'loi_composition_unsupported');
 const units=s.match(/[^.\n]+\.?/g)||[];let transitioned=false;
 for(const raw of units){const u=raw.trim();if(!u)continue;if(transition.test(u)){proseNeed(raw===units.at(-1),'loi_composition_unsupported');transitioned=true;}else proseNeed(framing.some(re=>re.test(u)),'loi_composition_unsupported');}
 return {sentences:units.map(x=>x.trim()).filter(x=>x&&!transition.test(x)),transition:transitioned};
}
const topicGroups=[['continuity','longitudinal','follow-up','follow up'],['clinic','ambulatory','outpatient'],['underserved','rural','community'],['mentor','mentorship'],['research','scholarship','scholarly'],['simulation','procedure','procedural'],['inpatient','ward'],['fellowship','subspecialty'],['elective'],['board','abim','certification']];
const topics=text=>topicGroups.map((words,i)=>words.some(w=>new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:s|ing)?\\b','i').test(text))?i:-1).filter(i=>i>=0);
export function validateLocalProseTrace(row,refs,program){
 const trace=validateProseTrace(row,refs),claims=trace.claims;
 proseNeed(program&&refs.filter(r=>r.kind==='identity').length===1&&refs.find(r=>r.kind==='identity').text===program.name,'loi_composition_reference');
 // Exact-span and independent complete-gap checks reject invented assertions,
 // negated originals, misleading attribution and appended factual modifiers.
 let cursor=0;const authored=[];for(const c of claims){const gap=row.text.slice(cursor,c.start),r=refs.find(r=>r.ref===c.ref);
  const inline=r.kind==='identity'&&gap.endsWith('I am writing to '),suffix=inline?row.text.slice(c.end).match(/^ with a (?:clear|focused|specific) purpose\./):null;
  proseNeed(!inline||suffix,'loi_composition_unsupported');const check=safeGap(inline?gap.slice(0,-'I am writing to '.length):gap);authored.push(...check.sentences);if(inline)authored.push('I am writing to '+r.text+suffix[0]);
  // A source begins a new sentence/paragraph after complete metadiscourse or
  // a permitted transition. It is never a predicate embedded under negation.
  proseNeed(c.start===0||/\s$/.test(gap)||!gap,'loi_composition_unsupported');
  const next=row.text[c.end];proseNeed(next===undefined||/\s/.test(next),'loi_composition_unsupported');cursor=c.end+(suffix?.[0].length??0);
 }
 authored.push(...safeGap(row.text.slice(cursor)).sentences);
 proseNeed(authored.length>=3&&row.text.startsWith('Dear Program Leadership,\n\n')&&/^Thank you for (?:considering|reading) (?:my interest|this letter|my perspective)\.$/.test(authored.at(-1)),'loi_composition_structure');
 proseNeed(authored.some(s=>!PROSE_FRAMES.includes(s)&&!s.startsWith('Dear ')&&!s.startsWith('Thank you')),'loi_composition_specificity');
 // Recompute concrete fit, instead of trusting author-supplied fit assertions.
 for(const f of trace.fitLinks){const ev=refs.find(r=>r.ref===f.evidenceRef),reason=refs.find(r=>r.ref===f.reasonRef),et=topics(ev.text),rt=topics(reason.text),ei=claims.findIndex(c=>c.ref===ev.ref),ri=claims.findIndex(c=>c.ref===reason.ref);proseNeed(et.some(t=>rt.includes(t))&&Math.abs(ei-ri)===1,'loi_composition_specificity');}
 // No amount of filler or changed program-name insertion can replace actual
 // exact selected detail + confirmed reason + a locally recognizable link.
 return {...trace,opening:authored.find(s=>!s.startsWith('Dear ')),cadence:row.text.split('\n\n').map(p=>p.length).join('|')};
}

// V5 is authored text with untrusted clause/source associations, not an entailment
// certificate. V2/V3/V4 validators above remain unchanged for retained proposals.
export const AUTHORED_SCHEMA='iiq-loi-authored-plan-v5';
export const AUTHORED_GUARD='PROSE_AUTHORED_REVIEW_V5';
export const AUTHORED_REVIEW='iiq-loi-authored-review-v1';
const normalizedWords=s=>s.toLowerCase().replace(/[’]/g,"'").match(/[a-z]+/g)||[];
const wordNumbers={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20'};
const quantities=s=>(s.toLowerCase().replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g,w=>wordNumbers[w]).match(/(?:\$\s*)?\b\d+(?:[.,]\d+)*(?:\s*%|\b)/g)||[]).map(x=>x.replace(/\s/g,''));
const negative=s=>/\b(?:not|never|no|without|neither|cannot|can't|haven't|hasn't|don't|doesn't|didn't)\b/i.test(s);
const sensitiveTopics=[[/\b(?:guarantee\w*|assur(?:e|ed|es)|promise\w*)\b/i,/\b(?:guarantee\w*|assur(?:e|ed|es)|promise\w*)\b/i],[/\b(?:visa|sponsor\w*|h[- ]?1b|j[- ]?1)\b/i,/\b(?:visa|sponsor\w*|h[- ]?1b|j[- ]?1)\b/i],[/\b(?:rank\w*|top[- ]?choice|number[- ]?one)\b/i,/\b(?:rank\w*|top[- ]?choice|number[- ]?one)\b/i],[/\b(?:award\w*|publication\w*|published|score\w*|step\s*[123]|board[- ]?pass|abim|pass[- ]?rate)\b/i,/\b(?:award\w*|publication\w*|published|score\w*|step\s*[123]|board[- ]?pass|abim|pass[- ]?rate)\b/i],[/\b(?:family|spouse|partner|children|hometown|grew up|lived|relocat\w*)\b/i,/\b(?:family|spouse|partner|children|hometown|grew up|lived|relocat\w*)\b/i]];
const programTopics=/\b(?:robotic\w*|surgery|cardiology|fellowship\w*|research|scholarship|elective\w*|mentorship|simulation|rural|international|visa|sponsor\w*)\b/ig;
const pastActions=/\bI (?:have |had )?(won|led|founded|published|completed|worked|volunteered|trained|interviewed|visited|met|served|earned|received|rotated|conducted)\b/ig;
const namedTokens=text=>{const tokens=[];const re=/\b[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)*\b/g;for(const m of text.matchAll(re)){const before=text.slice(0,m.index).trimEnd();if(m[0]==='I'||/^(?:Dear Program Leadership|Thank you|Program Leadership)$/.test(m[0]))continue;const sentenceInitial=!before||/[.!?;\n]$/.test(before)||/^Dear\s*$/.test(before);if(!sentenceInitial||m[0].includes(' '))tokens.push(m[0]);}return tokens;};
const unsupportedRules=['UNSUPPORTED_GUARANTEE','UNSUPPORTED_VISA','UNSUPPORTED_RANK','UNSUPPORTED_ACHIEVEMENT','UNSUPPORTED_PERSONAL_TIE'];
const programRuleCategories=[[/^robotic/i,'ROBOTICS'],[/^surgery$/i,'SURGERY'],[/^cardiology$/i,'CARDIOLOGY'],[/^fellowship/i,'FELLOWSHIP'],[/^research$/i,'RESEARCH'],[/^scholarship$/i,'SCHOLARSHIP'],[/^elective/i,'ELECTIVE'],[/^mentorship$/i,'MENTORSHIP'],[/^simulation$/i,'SIMULATION'],[/^rural$/i,'RURAL'],[/^international$/i,'INTERNATIONAL'],[/^visa$/i,'VISA'],[/^sponsor/i,'SPONSORSHIP']];
const programRule=word=>{const category=programRuleCategories.find(([pattern])=>pattern.test(word))?.[1];return category?'UNSUPPORTED_PROGRAM_'+category:'UNSUPPORTED_PROGRAM_TOPIC';};
function requireAuthoredSupport(ok,rule){if(!ok){const e=new Error('loi_composition_unsupported');e.code='loi_composition_unsupported';e.rule=rule;throw e;}}
// A plural role label is not an invented person's name. Require two distinct
// named chiefs in the SAME mapped supported leadership source; never stem names.
function supportedSectionChiefPlural(name,allowed){
 if(name!=='Section Chiefs')return false;
 return allowed.some(r=>r.kind==='evidence'&&r.field==='research.leadership'&&(!r.state||r.state==='SUPPORTED')&&
  new Set([...r.text.matchAll(/^([A-Z][^\n]*?,[ \t]*(?:MD|DO)\b[^\n]*)\nSection Chief(?:[,; \t][^\n]*)?$/gm)].map(m=>m[1].split(',')[0].trim().toLowerCase())).size>=2);
}
// Only a typed, explicitly asserted status can support an interviewed event.
// Interview-preparation motivations and unknown status are never event proof.
const interviewAssertions=text=>[...text.matchAll(/\bI (?:(?:have|had) )?(?:(?:already|recently) )?((?:not|never) )?interviewed\b/ig)].map(m=>Boolean(m[1]));
const uncertainInterviewStatus=text=>/\b(?:unknown|uncertain|unconfirmed|unclear|unsure|if|whether|would|could|might|may|assuming|suppose|hypothetical|not sure|not stated|not confirmed|not known|no interview event is asserted)\b/i.test(text);
function checkAuthoredUnit(quote,allowed){
 const support=allowed.map(r=>r.text).join('\n'),supportedWords=new Set(normalizedWords(support));
 proseNeed(quantities(quote).every(q=>quantities(support).includes(q)),'loi_composition_invented_quantity');
 proseNeed(namedTokens(quote).every(n=>normalizedWords(n).every(w=>supportedWords.has(w))||supportedSectionChiefPlural(n,allowed)),'loi_composition_invented_identity');
 for(const [index,[assertion,source]] of sensitiveTopics.entries())requireAuthoredSupport(!assertion.test(quote)||source.test(support),unsupportedRules[index]);
 if(/\b(?:your program|the program|residents|curriculum|faculty)\b/i.test(quote)||allowed.some(r=>r.kind==='identity'&&quote.includes(r.text)))for(const m of quote.matchAll(programTopics))requireAuthoredSupport(new RegExp('\\b'+m[0]+'\\b','i').test(support),programRule(m[0]));
 for(const m of quote.matchAll(pastActions))proseNeed(new RegExp('\\b'+m[1]+'\\b','i').test(support),'loi_composition_invented_event');
 // Negating a positive source, or affirming an explicitly negative status, is
 // detectable without accepting the author's claimed meaning/trace as proof.
 const relevant=allowed.filter(r=>r.kind!=='identity');
 const assertedInterview=interviewAssertions(quote);
 if(assertedInterview.length){const context=allowed.filter(r=>r.kind==='context'&&r.ref==='context:interviewState');proseNeed(context.length===1&&/^I (?:(?:have|had) )?(?:(?:already|recently) )?(?:(?:not|never) )?interviewed\b/i.test(context[0].text.trim())&&!uncertainInterviewStatus(context[0].text),'loi_composition_contradiction');const sourceAssertions=interviewAssertions(context[0].text);proseNeed(sourceAssertions.length>0&&assertedInterview.every(polarity=>sourceAssertions.every(source=>source===polarity)),'loi_composition_contradiction');}
 if(/\b(?:residents|your program|the program|curriculum|faculty)\b/i.test(quote)){const evidence=allowed.filter(r=>r.kind==='evidence'&&authoredTopics(r.text).some(t=>authoredTopics(quote).includes(t)));if(evidence.length===1)proseNeed(negative(quote)===negative(evidence[0].text),'loi_composition_contradiction');}
 if(relevant.length===1&&(/\b(?:I|program|residents|clinic|curriculum|training|faculty|interview\w*|appli\w*)\b/i.test(quote)))proseNeed(negative(quote)===negative(relevant[0].text),'loi_composition_contradiction');
 return {code:'UNRESOLVED_SEMANTIC_SUPPORT',message:'Read this authored clause against every linked original source. Trace associations and local checks do not certify meaning.'};
}
// V5 only: named leadership is concrete evidence, without implying mentorship.
const leadershipWords=/\b(?:leadership|(?:associate )?program director|section chief|chairman)\b/i;
const authoredTopics=text=>[...topics(text),...(leadershipWords.test(text)?[10]:[])];
const namedLeadership=r=>r.kind==='evidence'&&r.field==='research.leadership'&&
 /(?:^|\n)[A-Z][a-zA-Z'’-]+(?:[ \t]+[A-Z][a-zA-Z.'’-]+)+,[ \t]*(?:MD|DO)\b[^\n]*\n[^\n]*(?:Program Director|Section Chief|Chairman)[^\n]*(?:\n|$)/.test(r.text);
const leadershipPurpose=text=>leadershipWords.test(text)&&
 /\b(?:identify|identifying|understand|understanding|learn|learning|know|knowing)\b/i.test(text)&&
 /\b(?:interview|questions|prepare|preparing|preparation|decision)\b/i.test(text);
const authoredFit=(e,r)=>topics(e.text).some(t=>topics(r.text).includes(t))||
 (namedLeadership(e)&&leadershipPurpose(r.text));
export function validateAuthoredInputSpecificity(refs){
 const ev=refs.filter(r=>r.kind==='evidence'),reasons=refs.filter(r=>r.kind==='reason');
 proseNeed(ev.some(r=>concreteDetail(r.text)||namedLeadership(r))&&reasons.some(r=>r.text.split(/\s+/).length>=5&&!genericReason(r.text)),'loi_composition_specificity');
 proseNeed(ev.some(e=>reasons.some(r=>authoredFit(e,r))),'loi_composition_specificity');
}
function authoredSpecificity(text,refs,claims){
 const ev=refs.filter(r=>r.kind==='evidence'),reasons=refs.filter(r=>r.kind==='reason');
 validateAuthoredInputSpecificity(refs);
 const detailTopics=ev.flatMap(e=>authoredTopics(e.text)),reasonTopics=reasons.flatMap(e=>authoredTopics(e.text));
 proseNeed(detailTopics.some(t=>authoredTopics(text).includes(t))&&reasonTopics.some(t=>authoredTopics(text).includes(t)),'loi_composition_specificity');
 proseNeed(claims.some(c=>c.refs.some(x=>ev.some(e=>e.ref===x)))&&claims.some(c=>c.refs.some(x=>reasons.some(e=>e.ref===x))),'loi_composition_specificity');
}
export function validateAuthoredTrace(row,refs,program){
 proseNeed(proseKeys(row,['approach','text','claims','fitLinks']),'loi_composition_trace');
 const units=proseUnits(row.text);proseNeed(Array.isArray(refs)&&refs.length>0&&refs.length<=90&&new Set(refs.map(r=>r.ref)).size===refs.length,'loi_composition_reference');
 proseNeed(refs.every(r=>typeof r.text==='string'&&r.text.trim()&&typeof r.ref==='string'),'loi_composition_reference');
 proseNeed(program&&refs.filter(r=>r.kind==='identity').length===1&&refs.find(r=>r.kind==='identity').text===program.name&&row.text.includes(program.name),'loi_composition_reference');
 for(const r of refs.filter(r=>r.kind==='evidence'))requireAuthoredSupport(r.field&&(!r.state||r.state==='SUPPORTED')&&!/\b(?:unknown|conflicted|contested|disputed|uncertain|ambiguity|unverified)\b/i.test(r.text),'UNSUPPORTED_EVIDENCE_STATE');
 proseNeed(Array.isArray(row.claims)&&row.claims.length===units.length,'loi_composition_trace');const used=new Set(),claims=[];
 for(let i=0;i<units.length;i++){const u=units[i],c=row.claims[i];proseNeed(proseKeys(c,['start','end','refs'])&&c.start===u.start&&c.end===u.end&&Array.isArray(c.refs)&&new Set(c.refs).size===c.refs.length&&c.refs.every(id=>refs.some(r=>r.ref===id)),'loi_composition_trace');
  const greeting=/^\s*Dear[^.!?;\n]*[,\n]\s*$/.test(u.quote),closing=/^\s*(?:Thank you|Sincerely|Respectfully)\b/i.test(u.quote);
  proseNeed(c.refs.length>0||greeting||closing,'loi_composition_unmapped');
  checkAuthoredUnit(u.quote,c.refs.map(id=>refs.find(r=>r.ref===id)));c.refs.forEach(id=>used.add(id));claims.push({start:u.start,end:u.end,refs:[...c.refs]});
 }
 proseNeed(refs.every(r=>used.has(r.ref)),'loi_composition_reference');
 proseNeed(Array.isArray(row.fitLinks)&&row.fitLinks.length>0&&row.fitLinks.length<=20,'loi_composition_specificity');
 for(const f of row.fitLinks){const e=refs.find(r=>r.ref===f.evidenceRef&&r.kind==='evidence'),r=refs.find(r=>r.ref===f.reasonRef&&r.kind==='reason');proseNeed(proseKeys(f,['evidenceRef','reasonRef'])&&e&&r&&authoredFit(e,r),'loi_composition_specificity');}
 authoredSpecificity(row.text,refs,claims);
 const first=claims.flatMap(c=>c.refs).map(id=>refs.find(r=>r.ref===id)).find(r=>r.kind!=='identity'),wanted={WARM_PERSONAL:'reason',DIRECT_CONCISE:'context',ACADEMIC_PROGRAM:'evidence',POST_INTERVIEW:'context',UPDATE_LED:'fact',STRONG_INTEREST:'reason'}[row.approach];proseNeed(first?.kind===wanted,'loi_composition_structure');
 const substantive=units.filter((u,i)=>claims[i].refs.length),opening=substantive[0]?.quote.trim(),cadence=row.text.split(/\n\s*\n/).map(p=>proseUnits(p).length).join('|');
 proseNeed(substantive.length>=3&&row.text.split(/\n\s*\n/).length>=3,'loi_composition_structure');
 // Literal source paragraph assembly is not a successful authored proposal.
 proseNeed(substantive.filter(u=>!refs.some(r=>r.text===u.quote.trim())).length>=2,'loi_composition_specificity');
 return {claims,fitLinks:row.fitLinks.map(x=>({...x})),opening,cadence,structure:claims.map(c=>c.refs.join('+')).join('|'),review:authoredReview(row.text,refs,program,claims)};
}
export function authoredReview(text,refs,program,claims=null){
 proseNeed(typeof text==='string'&&text.length>0&&text.length<=20000&&text.includes(program.name),'loi_composition_reference');
 const units=proseUnits(text),all=refs.filter(r=>r.kind!=='identity'),reviewUnits=[];
 for(const [i,u] of units.entries()){
  const mapped=claims?.[i]?.refs??refs.map(r=>r.ref),allowed=refs.filter(r=>mapped.includes(r.ref));
  checkAuthoredUnit(u.quote,allowed);
  reviewUnits.push({start:u.start,end:u.end,quote:u.quote,refs:[...mapped],sourceTexts:allowed.map(r=>({ref:r.ref,text:r.text})),flag:'UNRESOLVED_SEMANTIC_SUPPORT'});
 }
 proseNeed(all.length>0,'loi_composition_reference');authoredSpecificity(text,refs,reviewUnits);
 return {contract:AUTHORED_REVIEW,state:'STUDENT_VERIFICATION_REQUIRED',automaticFactualCertification:false,studentVerificationRequired:true,editedTrace:claims===null,units:reviewUnits};
}

// Admission for NEW provider output only. Retained drafts and student edits keep
// their existing read/review contract. These checks reject known low-quality
// output; they are not semantic certification or a replacement for review.
export function validateGeneratedLoiQuality(row,refs,program){
 const reject=rule=>{const e=new Error('loi_composition_quality');e.code='loi_composition_quality';e.rule=rule;throw e;};
 const text=row.text;
 if(text.split(program.name).length!==2)reject('REPEATED_PROGRAM_IDENTITY');
 if(/\b(?:program identity is|reference (?:that|the) identity|evidence base|source labels?|reference IDs?|refs array|confirmed leadership|writing approach|composition strategy)\b/i.test(text))reject('COMPOSITION_METADISCOURSE');
 if(/(?:^|\n\s*\n)Lead by\b/.test(text))reject('INCOMPLETE_SENTENCE');
 // A roster establishes who holds a role, not training quality, mentorship,
 // access, or outcomes. For leadership-only selected evidence, require an
 // actual cited name AND its roster role rather than generic leadership talk.
 const evidence=refs.filter(r=>r.kind==='evidence');
 if(evidence.length&&evidence.every(r=>r.field==='research.leadership')){
  if(/\b(?:program quality|excellent training|exceptional training|world[- ]class|high[- ]quality training|superior training|outstanding training)\b/i.test(text))reject('ROSTER_IS_NOT_QUALITY_EVIDENCE');
  const norm=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const concrete=evidence.some(r=>{
   const people=[...r.text.matchAll(/^([^\n,]+),[^\n]*\n([^\n]+)$/gm)];
   return people.some(([,name,role])=>row.claims.some(c=>c.refs.includes(r.ref)&&
    norm(text.slice(c.start,c.end)).includes(norm(name))&&
    norm(text.slice(c.start,c.end)).includes(norm(role.split(/[;,]/)[0]))));
  });
  if(!concrete)reject('MISSING_CONCRETE_LEADERSHIP_DETAIL');
 }
 return {qualityGate:'GENERATED_LOI_QUALITY_V1',studentReviewRequired:true,automaticFactualCertification:false};
}
