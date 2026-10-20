/* ---------------- LETTERS OF INTEREST STUDIO (IIQ-LOI-RAPID-20261019) ----------------
   Local template gallery + guided editor. Renders without any server LOI capability, RISE
   availability or AI. Nothing here is saved to the account: drafts live in this tab only.
   Every example is fictional and labeled as such. Student words are never invented. */
'use strict';
const LOI_STUDIO_TEMPLATES=[
 {id:'initial',order:1,name:'Initial Letter of Interest',short:'Before interview',icon:'✉',timing:'After applying, before an invitation',length:'220–300 words',
  when:'You applied, have not heard back, and want the program to look at your file with a reason to. Send once, around four to six weeks after applications open, or when something changes.',
  summary:'Tells a program who you are, why them specifically, and what you bring. One page, no pleading.',
  why:['Opens with the exact position and application status so the coordinator can find the file.','Each reason names something only this program offers; nothing in it could be pasted to another program.','States what the applicant brings in the same concrete register, without ranking language.','Ends with a simple, respectful ask: a look at the file, availability to interview.'],
  personalize:['Program name and specialty exactly as the program writes them.','Two or three reasons that are true for you and specific to this program (curriculum, patient population, a track, faculty work you have actually read).','What you bring, stated as facts about your experience, not adjectives.'],
  avoid:['"Dream program", "perfect fit" and other phrases that say nothing specific.','Ranking promises before you have even interviewed.','Repeating your personal statement. This letter adds one new angle, it does not retell your story.','Attaching documents the program did not request.'],
  sampleMeta:'Fictional example · Dr. Amara Okafor applying to the Riverbend University Internal Medicine Residency (fictional program and people).',
  sample:`Dear Dr. Marchetti,

I am writing to express my strong interest in the Riverbend University Internal Medicine Residency Program. I submitted my ERAS application in September (AAMC ID 00000000) and wanted to share why Riverbend is a program I would be proud to train at.

Three things drew me to your program. First, the dedicated ambulatory block in the second year: my strongest clinical growth has come from continuity clinic, where I followed a panel of patients with poorly controlled diabetes over eight months and watched management decisions play out. Second, your hospital's role as the regional referral center for sickle cell disease. During my observership at a tertiary center I helped manage three admissions for vaso-occlusive crisis, and I want to train where that care is deliberate rather than occasional. Third, the Quality and Patient Safety pathway. My own project reduced duplicate laboratory orders on a medicine ward by standardizing the admission order set, and I would like to keep doing that kind of work with faculty mentorship.

I would bring four years of post-graduate clinical experience, including two years as a medical officer in a district hospital where I was the first physician a patient saw. I am comfortable with volume, with uncertainty, and with being the person who has to decide.

Thank you for considering my application. I would welcome the opportunity to interview and to learn more about your program.

Sincerely,
Amara Okafor, MBBS
AAMC ID 00000000 · amara.okafor@example.com · (000) 000-0000`,
  subject:'Letter of Interest – [Your name], Internal Medicine Applicant (AAMC ID [number])'},
 {id:'update',order:2,name:'Continued Interest / Update',short:'After applying or interviewing',icon:'↻',timing:'When something real has changed',length:'180–260 words',
  when:'You have a genuine update: a new publication, a completed rotation, a Step result, a new letter of recommendation, a visa change. Use it to re-open the file, not to say "still interested" with nothing new.',
  summary:'Leads with the update, then reaffirms interest in two concrete sentences.',
  why:['The update is in the first paragraph, dated and verifiable; it gives the program a reason to re-open the file.','Interest is reaffirmed with one specific reason, not a repeat of the first letter.','Short enough that a coordinator can forward it to the program director in one read.'],
  personalize:['The update itself: what, when, and where the program can verify it (ERAS upload, citation, letter sender).','One reason this program still stands out, ideally something you learned since you applied.','Whether you have interviewed. Say so plainly; it changes how the letter is read.'],
  avoid:['Sending an "update" with no update in it.','Claiming an outcome that has not happened yet (a paper "accepted" when it is under review).','Multiple updates in one month. Collect them.'],
  sampleMeta:'Fictional example · Dr. Luis Ortega writing to the Harbor Family Medicine Residency after interviewing (fictional program and people).',
  sample:`Dear Dr. Nakamura,

I interviewed with the Harbor Family Medicine Residency on November 12 and wanted to share an update to my application.

Since we spoke, my manuscript on a community pharmacist-led hypertension follow-up program was accepted by the Journal of Primary Care Practice (fictional journal) and is now in press; I have uploaded the acceptance to ERAS. The project is the one I described during my interview with Dr. Feld, and its results reinforced something I took away from that conversation: Harbor's integrated behavioral health and pharmacy model is the kind of team-based primary care I want to practice.

I also completed a four-week rural family medicine rotation at a critical access hospital in December, which included obstetrics coverage with a family physician. That experience confirmed my interest in Harbor's full-spectrum training and its rural continuity site.

My interest in Harbor remains strong, and I appreciate the time your team gave me in November. Please let me know if any further information would be helpful.

Sincerely,
Luis Ortega, MD
AAMC ID 00000000 · luis.ortega@example.com`,
  subject:'Application update – [Your name], [Specialty] Applicant (interviewed [date])'},
 {id:'intent',order:3,name:'Letter of Intent',short:'First choice only',icon:'★',timing:'After your interview, before rank lists certify',length:'200–280 words',
  when:'Only when this program is genuinely your first choice. A Letter of Intent says you intend to rank the program first. Programs remember these letters; send one to exactly one program, and only if it is true.',
  summary:'Says, once and clearly, that you intend to rank this program first, and why.',
  why:['The ranking statement is one sentence, unambiguous, and appears early.','Every reason references the interview day, so the program knows the applicant is responding to what they actually saw.','It describes fit from the program\'s side too: what the applicant will contribute to residents and patients.','It makes no request for reciprocity and no claim about how the program will rank the applicant.'],
  personalize:['Confirm to yourself first: is this truly number one? If not, send a Continued Interest letter instead.','Interview date and at least one specific moment from the day (a resident conversation, a conference, a clinic).','What you will contribute, in concrete terms.'],
  avoid:['Sending Letters of Intent to more than one program. Program directors talk.','Asking how you will be ranked or implying any commitment from the program. The Match has rules about this.','Hedged language like "one of my top choices"; that is a Continued Interest letter, not a Letter of Intent.'],
  sampleMeta:'Fictional example · Dr. Priya Raman writing to the Lakeside Pediatrics Residency after interviewing (fictional program and people).',
  sample:`Dear Dr. Whitaker,

Thank you again for the opportunity to interview with the Lakeside Pediatrics Residency on January 8. After completing my interviews, I am writing to let you know that I intend to rank Lakeside first on my rank order list.

My reasons are specific to what I saw that day. During morning report, the second-year resident presented a child with periodic fever, and the discussion that followed was led by residents, with faculty adding only where needed. That is the kind of teaching culture I want to train in. In my conversation with Dr. Osei, I learned that the refugee health clinic sees families within two weeks of arrival; as a physician who trained in a setting where I was often the first point of contact for families with no medical records, I would bring both comfort and respect to that work. And the program's four-week advocacy block fits the direction I want my career to take.

I would bring to Lakeside three years of pediatric clinical experience, including a year in a neonatal unit where I managed ventilated infants under supervision, and a habit of showing up prepared.

Thank you for your consideration. I hope to join your residents in June.

Sincerely,
Priya Raman, MBBS
AAMC ID 00000000 · priya.raman@example.com`,
  subject:'Letter of Intent – [Your name], Pediatrics Applicant (interviewed [date])'},
 {id:'thankyou',order:4,name:'Post-Interview Thank You',short:'Within 48 hours',icon:'✓',timing:'Within 24–48 hours of the interview',length:'120–180 words',
  when:'Right after an interview. A brief note to the program director or coordinator (and, separately, to any interviewer you had a real conversation with). Check first whether the program asked applicants not to send these; some do.',
  summary:'Short, warm, and anchored to one real moment from the day.',
  why:['It names the interview date and one specific exchange, which proves the note was written for this program.','It is short. Nobody re-reads a thank-you note.','It closes without asking for anything.'],
  personalize:['Interview date and the name of the person you are writing to.','One specific moment: a question an interviewer asked, a resident\'s comment, something you saw on the tour.','Whether to send separate notes to individual interviewers. If you do, make each one different.'],
  avoid:['A single generic note sent to everyone with the names swapped.','Re-arguing your application or adding new claims.','Sending to a program that explicitly asks applicants not to send thank-you notes.'],
  sampleMeta:'Fictional example · Dr. Daniel Mensah writing to the Northgate Psychiatry Residency after interviewing (fictional program and people).',
  sample:`Dear Dr. Kobayashi,

Thank you for the time you and your team gave me during my interview with the Northgate Psychiatry Residency on December 3.

I especially valued our conversation about the program's collaborative care clinic and how residents work alongside primary care teams from the first year. It connected directly to my experience coordinating psychiatric follow-up for patients discharged from a medical ward, and it clarified for me what I hope to learn at Northgate. The residents' candor during the lunch session was equally helpful.

I appreciate your consideration and would be glad to provide anything further that would be useful.

Sincerely,
Daniel Mensah, MD
AAMC ID 00000000 · daniel.mensah@example.com`,
  subject:'Thank you – [Your name], [Specialty] interview on [date]'},
 {id:'short',order:5,name:'Short and Direct LOI',short:'Three paragraphs, under 150 words',icon:'➤',timing:'Any time before rank lists; good for a second or third contact',length:'100–150 words',
  when:'When the program is known to receive hundreds of letters, when you have already sent a longer letter, or when you simply want to be read. Three paragraphs, one idea each.',
  summary:'Status, one reason, one strength. Done.',
  why:['It respects the reader\'s time, which is itself a signal about the applicant.','One reason, fully specific, lands harder than three partial ones.','Nothing is hedged, padded, or repeated.'],
  personalize:['The single reason. Pick the one that is most true and most specific to this program.','The single strength. One concrete fact about your experience.','Your application status (applied, interviewed on a date).'],
  avoid:['Trying to fit three reasons into the short format. That is a different template.','Removing the specifics to hit the word count. Remove the adjectives instead.'],
  sampleMeta:'Fictional example · Dr. Sofia Alvarez writing to the Westfield Community Internal Medicine Residency (fictional program and people).',
  sample:`Dear Dr. Patel,

I applied to the Westfield Community Internal Medicine Residency in September (AAMC ID 00000000) and am writing to express my continued interest in your program.

Westfield's community hospital setting, where residents are the primary team for most medicine admissions, is the environment I trained in for two years as a medical officer and the one in which I know I do my best work.

I would bring that experience, a strong record in inpatient medicine, and a genuine interest in your hospital's patient population. I would welcome the chance to interview.

Thank you for your time.

Sincerely,
Sofia Alvarez, MD
AAMC ID 00000000 · sofia.alvarez@example.com`,
  subject:'Letter of Interest – [Your name], [Specialty] Applicant'},
 {id:'research',order:6,name:'Research-Focused LOI',short:'Academic programs',icon:'⌬',timing:'Before or after interview, for programs with a research expectation',length:'240–320 words',
  when:'When research is a real part of your record and a real part of the program (a research track, protected time, a lab you have read about). The letter connects your work to theirs, specifically.',
  summary:'Your research, their research, and the bridge between them.',
  why:['The applicant\'s research is described by its question and result, not by a list of titles.','The program\'s research is cited by what the applicant actually read, with a named faculty member and a real topic.','The bridge is explicit: what the applicant would work on at this program and with whom.','Clinical commitment is still present; this is a residency letter, not a lab application.'],
  personalize:['Your research: the question, your role, the result, and where it was presented or published (only if that has actually happened).','Their research: read the work before you name it. One faculty member, one project, accurately described.','The connection: what you would do there.'],
  avoid:['Name-dropping faculty whose work you have not read.','Overstating your role (second author becomes "led").','Listing abstracts. Pick one project and tell it properly.'],
  sampleMeta:'Fictional example · Dr. Wei Chen writing to the Clearwater University Neurology Residency (fictional program, people and publications).',
  sample:`Dear Dr. Lindqvist,

I am writing to express my interest in the Clearwater University Neurology Residency Program, to which I applied in September (AAMC ID 00000000), and in particular in your Clinician-Investigator Track.

For the past two years I have worked as a research fellow studying early seizure recurrence after first unprovoked seizure in adults. Using a retrospective cohort of 412 patients from a single tertiary center, I built and validated a simple bedside score that identified a high-recurrence group with a 2.3-fold higher six-month recurrence rate. I was first author on the manuscript, which was published this year in a regional neurology journal (fictional), and I presented the work as a platform talk at a national epilepsy meeting.

I was drawn to Clearwater because of Dr. Adeyemi's work on outpatient EEG triage pathways, which I read closely while designing my own study; her 2024 paper on reducing time-to-EEG in first-seizure clinics addresses the same patients from the delivery side. The Clinician-Investigator Track's protected research months in the third year would let me extend my recurrence work prospectively, and I would hope to do that under her mentorship.

Research is one part of why I want to be a neurologist, not the whole of it. Two years of clinical neurology experience, including six months on an acute stroke service, are the foundation I would bring to your inpatient teams.

Thank you for considering my application. I would welcome the opportunity to interview.

Sincerely,
Wei Chen, MD
AAMC ID 00000000 · wei.chen@example.com`,
  subject:'Letter of Interest – [Your name], [Specialty] Applicant (Research Track)'},
 {id:'clinical',order:7,name:'Clinical Experience-Focused LOI',short:'Hands-on experience',icon:'⚕',timing:'Before or after interview, when experience is your strongest asset',length:'220–300 words',
  when:'When your strongest card is what you have actually done with patients: years of practice, a demanding setting, procedures, volume, responsibility. Common and effective for experienced international medical graduates.',
  summary:'Leads with responsibility and volume, then shows what that experience lets you contribute from day one.',
  why:['Experience is quantified: years, settings, patients, and the level of responsibility held.','It answers the question programs quietly ask about experienced applicants: will this person be teachable? It does so by naming what the applicant still wants to learn.','Fit is framed around the program\'s patient population and the applicant\'s readiness for it.'],
  personalize:['Your experience in numbers: years, setting, typical census, procedures you performed independently.','One case or situation that shows judgment under pressure, told briefly and without identifying the patient.','What you still want to learn at this program, said plainly.'],
  avoid:['Implying you are already a finished physician. Programs want residents who will grow.','Patient-identifying details, even changed ones.','Listing every rotation. Pick the experience that matters for this specialty.'],
  sampleMeta:'Fictional example · Dr. Fatima Haddad writing to the Summit Regional Family Medicine Residency (fictional program and people).',
  sample:`Dear Dr. Brennan,

I am writing to express my strong interest in the Summit Regional Family Medicine Residency Program, to which I applied in September (AAMC ID 00000000).

For five years I practiced as a general physician in a 120-bed district hospital where I was, on most nights, the only doctor in the building. I managed an average census of thirty medical and pediatric inpatients, ran a daily outpatient clinic of forty to fifty patients, performed deliveries including vacuum-assisted deliveries, and stabilized trauma and obstetric emergencies for transfer. During a cholera outbreak in my third year I organized the hospital's rehydration unit and supervised four clinical officers.

Since relocating, I have completed eight months of hands-on United States clinical experience in family medicine and internal medicine, including a four-month position as a clinical extern in a federally qualified health center, where I managed my own panel under supervision and documented in the electronic record.

I am drawn to Summit because your residents care for a rural and agricultural population with a high burden of untreated chronic disease, and because the program trains full-spectrum family physicians, including obstetrics. That is the medicine I have practiced, and it is the medicine I want to practice well. What I most want to learn at Summit is the structure around good care: evidence-based protocols, quality measurement, and the discipline of a team.

Thank you for considering my application. I would welcome the opportunity to interview.

Sincerely,
Fatima Haddad, MD
AAMC ID 00000000 · fatima.haddad@example.com`,
  subject:'Letter of Interest – [Your name], [Specialty] Applicant'}
];
const LOI_STUDIO_FIELDS={
 yourName:{label:'Your full name',hint:'As it appears on ERAS, with your degree (for example, MD or MBBS).',type:'text',ph:'[Your full name, degree]'},
 aamcId:{label:'AAMC ID (optional)',hint:'Helps the coordinator find your file. Leave blank to omit.',type:'text',ph:''},
 contact:{label:'Email and phone (optional)',hint:'Shown under your signature. Leave blank to omit.',type:'text',ph:''},
 programName:{label:'Program name',hint:'Write it exactly the way the program writes it.',type:'text',ph:'[Program name]'},
 specialty:{label:'Specialty',hint:'For example, Internal Medicine.',type:'text',ph:'[Specialty]'},
 pdName:{label:'Program director (optional)',hint:'For example, Dr. Jane Smith. Leave blank to use "Dear Program Director".',type:'text',ph:''},
 applied:{label:'When you applied',hint:'For example, "in September". Only state what is true.',type:'text',ph:'[when you applied]'},
 interviewDate:{label:'Interview date',hint:'For example, December 3. Leave blank if you have not interviewed.',type:'text',ph:'[interview date]'},
 moment:{label:'One specific moment from your interview day',hint:'A conversation, a conference, something on the tour. One or two sentences, in your own words.',type:'textarea',ph:'[One specific moment from your interview day, in your own words]'},
 reasons:{label:'Your genuine reasons for interest',hint:'One reason per line, up to three. Be specific to this program: a track, a patient population, a curriculum feature, faculty work you have read.',type:'textarea',ph:'[A specific, true reason this program interests you]'},
 reason:{label:'Your single strongest reason',hint:'One sentence. The most true and most specific thing you can say about this program.',type:'textarea',ph:'[Your single strongest, specific reason]'},
 strengths:{label:'What you bring',hint:'Facts about your experience, one or two sentences. Numbers help: years, settings, responsibilities.',type:'textarea',ph:'[What you bring, stated as facts about your experience]'},
 update:{label:'Your update',hint:'What changed, when, and where the program can verify it (ERAS upload, citation, letter sender).',type:'textarea',ph:'[Your update: what changed, when, and how the program can verify it]'},
 researchOwn:{label:'Your research',hint:'The question, your role, the result, and where it was presented or published (only if that has happened).',type:'textarea',ph:'[Your research: the question, your role, the result, and where it was presented or published]'},
 researchTheirs:{label:'Their research you have read',hint:'One faculty member, one project, accurately described. Read it first.',type:'textarea',ph:'[A named faculty member and a project of theirs you have actually read]'},
 researchBridge:{label:'What you would work on there',hint:'How your work connects to theirs and what you would do at this program.',type:'textarea',ph:'[What you would work on at this program, and with whom]'},
 clinicalExperience:{label:'Your clinical experience, in numbers',hint:'Years, settings, typical census, procedures you performed, level of responsibility.',type:'textarea',ph:'[Your clinical experience: years, settings, census, procedures, responsibility]'},
 clinicalCase:{label:'One situation that showed your judgment (optional)',hint:'Briefly, with no identifying details.',type:'textarea',ph:''},
 wantToLearn:{label:'What you still want to learn there',hint:'Said plainly. Programs want residents who will grow.',type:'textarea',ph:'[What you still want to learn at this program]'},
 contribute:{label:'What you will contribute',hint:'In concrete terms: experience, habits, skills.',type:'textarea',ph:'[What you will contribute to this program]'},
 firstChoice:{label:'This program is genuinely my first choice and I intend to rank it first.',hint:'The ranking sentence is included only when this is checked. Send a Letter of Intent to one program only.',type:'checkbox',ph:''}
};
const LOI_STUDIO_FIELD_SETS={
 initial:['yourName','programName','specialty','pdName','applied','reasons','strengths','aamcId','contact'],
 update:['yourName','programName','specialty','pdName','interviewDate','update','reason','aamcId','contact'],
 intent:['yourName','programName','specialty','pdName','interviewDate','firstChoice','moment','reasons','contribute','aamcId','contact'],
 thankyou:['yourName','programName','specialty','pdName','interviewDate','moment','aamcId','contact'],
 short:['yourName','programName','specialty','pdName','applied','reason','strengths','aamcId','contact'],
 research:['yourName','programName','specialty','pdName','applied','researchOwn','researchTheirs','researchBridge','strengths','aamcId','contact'],
 clinical:['yourName','programName','specialty','pdName','applied','clinicalExperience','clinicalCase','wantToLearn','aamcId','contact']
};
let loiStudio=null;
// Mirrors the WordPress gateway entitlement (student tier 360 / IV Prep Complete) and the admin Student View preview. Templates are fictional public content; private saving stays behind the server LOI capability.
function lettersStudioEnabled(){return studentPreview()||actor?.role==='student'&&['360','ivprep_complete'].includes(actor?.tier);}
function clearLettersStudioMemory(){loiStudio=null;}
function loiStudioForget(ids){if(typeof forgetDrafts==='function')forgetDrafts(ids);}
function loiStudioProgramPhrase(f){const prog=loiStudioValue(f,'programName'),spec=loiStudioValue(f,'specialty');return prog.toLowerCase().includes(spec.toLowerCase())?prog:`${prog} in ${spec}`;}
function loiStudioState(){if(!loiStudio)loiStudio={mode:'gallery',templateId:null,fields:{},text:null,edited:false,pick:''};return loiStudio;}
function loiStudioTemplate(id){return LOI_STUDIO_TEMPLATES.find(t=>t.id===id)||null;}
const loiStudioClean=v=>String(v??'').replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').trim();
function loiStudioValue(fields,key){const spec=LOI_STUDIO_FIELDS[key];if(spec.type==='checkbox')return fields[key]===true;const v=loiStudioClean(fields[key]);return v||spec.ph;}
function loiStudioLines(fields,key,max=3){const v=loiStudioClean(fields[key]);if(!v)return [LOI_STUDIO_FIELDS[key].ph];return v.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,max);}
function loiStudioSalutation(fields){const pd=loiStudioClean(fields.pdName);return 'Dear '+(pd?(/^dr\.?\s/i.test(pd)?pd:'Dr. '+pd):'Program Director')+',';}
function loiStudioSignature(fields){const lines=['Sincerely,',loiStudioValue(fields,'yourName')];const extra=[loiStudioClean(fields.aamcId)?'AAMC ID '+loiStudioClean(fields.aamcId):'',loiStudioClean(fields.contact)].filter(Boolean);if(extra.length)lines.push(extra.join(' · '));return lines.join('\n');}
function loiStudioReasonsParagraph(fields,key='reasons'){const lines=loiStudioLines(fields,key);if(lines.length===1)return lines[0];const lead=['First, ','Second, ','Third, '];return lines.map((l,k)=>lead[k]+l.charAt(0).toLowerCase()+l.slice(1)).join(' ');}
function composeLoiStudio(templateId,fields){
 const f=fields||{},v=k=>loiStudioValue(f,k),prog=loiStudioProgramPhrase(f),spec=v('specialty'),sal=loiStudioSalutation(f),sig=loiStudioSignature(f),name=v('yourName');
 const body=[];let subject='',warnings=[];
 if(templateId==='initial'){body.push(sal,`I am writing to express my strong interest in the ${prog}. I submitted my application ${v('applied')} and wanted to share why your program stands out to me.`,`Several things drew me to your program. ${loiStudioReasonsParagraph(f)}`,`${v('strengths')}`,`Thank you for considering my application. I would welcome the opportunity to interview and to learn more about your program.`,sig);subject=`Letter of Interest – ${name}, ${spec} Applicant`;}
 else if(templateId==='update'){const iv=loiStudioClean(f.interviewDate);body.push(sal,iv?`I interviewed with the ${prog} on ${iv} and wanted to share an update to my application.`:`I am writing with an update to my application to the ${prog}.`,`${v('update')}`,`${v('reason')}`,`My interest in your program remains strong${iv?', and I appreciate the time your team gave me on '+iv:''}. Please let me know if any further information would be helpful.`,sig);subject=`Application update – ${name}, ${spec} Applicant${iv?' (interviewed '+iv+')':''}`;}
 else if(templateId==='intent'){const iv=v('interviewDate');if(f.firstChoice!==true)warnings.push('The ranking sentence is left out until you confirm this program is genuinely your first choice. If it is not, use the Continued Interest template instead.');body.push(sal,`Thank you again for the opportunity to interview with the ${prog} on ${iv}.${f.firstChoice===true?` After completing my interviews, I am writing to let you know that I intend to rank your program first on my rank order list.`:''}`,`My reasons are specific to what I saw that day. ${v('moment')} ${loiStudioReasonsParagraph(f)}`,`${v('contribute')}`,`Thank you for your consideration. I hope to have the opportunity to join your residents.`,sig);subject=`Letter of Intent – ${name}, ${spec} Applicant (interviewed ${iv})`;}
 else if(templateId==='thankyou'){const iv=v('interviewDate');body.push(sal,`Thank you for the time you and your team gave me during my interview with the ${prog} on ${iv}.`,`${v('moment')}`,`I appreciate your consideration and would be glad to provide anything further that would be useful.`,sig);subject=`Thank you – ${name}, ${spec} interview on ${iv}`;}
 else if(templateId==='short'){body.push(sal,`I applied to the ${prog} ${v('applied')} and am writing to express my interest in your program.`,`${v('reason')}`,`${v('strengths')} I would welcome the chance to interview.`,`Thank you for your time.`,sig);subject=`Letter of Interest – ${name}, ${spec} Applicant`;}
 else if(templateId==='research'){body.push(sal,`I am writing to express my interest in the ${prog}, to which I applied ${v('applied')}.`,`${v('researchOwn')}`,`${v('researchTheirs')} ${v('researchBridge')}`,`Research is one part of why I want to train in ${spec}, not the whole of it. ${v('strengths')}`,`Thank you for considering my application. I would welcome the opportunity to interview.`,sig);subject=`Letter of Interest – ${name}, ${spec} Applicant (Research)`;}
 else if(templateId==='clinical'){const c=loiStudioClean(f.clinicalCase);body.push(sal,`I am writing to express my strong interest in the ${prog}, to which I applied ${v('applied')}.`,`${v('clinicalExperience')}${c?' '+c:''}`,`${v('wantToLearn')}`,`Thank you for considering my application. I would welcome the opportunity to interview.`,sig);subject=`Letter of Interest – ${name}, ${spec} Applicant`;}
 else return null;
 return {text:body.map(loiStudioClean).filter(Boolean).join('\n\n')+'\n',subject,warnings};
}
function loiStudioPlaceholders(text){return [...String(text||'').matchAll(/\[[^\]\n]{3,160}\]/g)].map(m=>m[0]);}
function loiStudioCurrentText(){const st=loiStudioState();if(st.edited&&typeof st.text==='string')return st.text;return composeLoiStudio(st.templateId,st.fields)?.text||'';}
function loiStudioSubject(){const st=loiStudioState();return composeLoiStudio(st.templateId,st.fields)?.subject||'';}
function loiStudioProgramOptions(){if(studentPreview()||typeof myInterviews!=='function')return [];const seen=new Set(),out=[];for(const i of myInterviews()){const name=(i.programName||(i.program&&typeof P==='function'?P(i.program).name:'')||'').replace('Fictional ','').trim();if(!name||seen.has(name))continue;seen.add(name);out.push({id:i.id,name,specialty:i.intake?.specialty||(i.program&&typeof P==='function'?P(i.program).specialty:'')||'',verified:Boolean(i.program)});}return out;}
function loiStudioField(key,fields){const spec=LOI_STUDIO_FIELDS[key],id='studio-f-'+key,val=fields[key];
 if(spec.type==='checkbox')return `<label class="studioCheck" for="${id}"><input type="checkbox" id="${id}" ${val===true?'checked':''}><span><b>${esc(spec.label)}</b><small>${esc(spec.hint)}</small></span></label>`;
 const control=spec.type==='textarea'?`<textarea id="${id}" rows="3" maxlength="2000">${esc(val||'')}</textarea>`:`<input type="text" id="${id}" maxlength="240" value="${esc(val||'')}" autocomplete="off">`;
 return `<label class="studioField" for="${id}"><span class="studioLabel">${esc(spec.label)}</span>${control}<small class="tiny">${esc(spec.hint)}</small></label>`;}
function loiStudioProgramPicker(st){const opts=loiStudioProgramOptions();if(!opts.length)return '';return `<label class="studioField" for="studio-program-pick"><span class="studioLabel">Pick from your saved interviews (optional)</span><select id="studio-program-pick"><option value="">Type the program manually</option>${opts.map(o=>`<option value="${esc(o.id)}" ${st.pick===o.id?'selected':''}>${esc(o.name)}${o.specialty?' · '+esc(o.specialty):''}${o.verified?' · verified program':' · as you entered it'}</option>`).join('')}</select><small class="tiny">Fills the program name and specialty below; you can still edit them. "Verified program" means the program identity was confirmed from the MissionMed registry.</small></label>`;}
function loiStudioSaveStatus(){return `<div class="studioStatus" role="status"><span class="chip warn">NOT SAVED TO YOUR ACCOUNT</span> <span>Your letter lives in this tab only. Copy or download it before you leave.${typeof loiEnabled==='function'&&loiEnabled()?' To keep a letter inside InterviewIQ, use the letter builder on a saved interview below.':''}</span></div>`;}
function loiStudioActions(st){const text=loiStudioCurrentText(),missing=loiStudioPlaceholders(text).length;return `<div class="studioActions"><button class="btn solid" type="button" data-act="studio-copy">Copy letter</button><button class="btn" type="button" data-act="studio-copy-subject">Copy email subject</button><button class="btn" type="button" data-act="studio-download">Download .txt</button><span class="studioMissing ${missing?'warn':'ok'}" aria-live="polite">${missing?missing+' detail'+(missing===1?'':'s')+' still in [brackets]':'No placeholders left'}</span></div>`;}
function loiStudioPreview(text,warnings=[]){return `<div class="studioPreview"><div class="eyebrow">Live preview</div>${warnings.map(w=>`<p class="studioWarn" role="status">${esc(w)}</p>`).join('')}<div class="studioLetter" id="studio-preview">${loiStudioMark(text)}</div></div>`;}
function loiStudioMark(text){return esc(text).replace(/\[[^\]\n]{3,160}\]/g,m=>`<mark class="studioPh">${m}</mark>`);}
function renderLettersStudio(){
 const st=loiStudioState();
 if(st.mode==='gallery')return `<section class="studio" aria-label="Letter templates"><div class="studioHead"><div><div class="eyebrow">TEMPLATE GALLERY · 7 LETTER TYPES</div><h2 class="h2">Pick the letter that fits <em>your situation</em></h2><p class="tiny">Every example is fictional and labeled. Read one, then personalize it with your own facts. Nothing is sent from here.</p></div></div><div class="studioGrid">${LOI_STUDIO_TEMPLATES.map(t=>`<article class="studioCard" data-template="${t.id}"><div class="studioCardTop"><span class="studioIcon" aria-hidden="true">${t.icon}</span><span class="studioNum">${t.order}</span></div><h3>${esc(t.name)}</h3><p class="studioWhen">${esc(t.summary)}</p><div class="studioChips"><span class="chip">${esc(t.short)}</span><span class="chip">${esc(t.length)}</span></div><div class="studioCardActions"><button class="btn solid" type="button" data-act="studio-use" data-template="${t.id}">Use this template</button><button class="btn ghost" type="button" data-act="studio-read" data-template="${t.id}">Read example</button></div></article>`).join('')}</div></section>`;
 const t=loiStudioTemplate(st.templateId);if(!t){st.mode='gallery';return renderLettersStudio();}
 if(st.mode==='read')return `<section class="studio" aria-label="${esc(t.name)} example"><div class="studioBar"><button class="btn ghost" type="button" data-act="studio-gallery">← All templates</button><div class="row"><button class="btn solid" type="button" data-act="studio-use" data-template="${t.id}">Use this template</button><button class="btn" type="button" data-act="studio-copy-sample">Copy example</button></div></div><div class="studioRead"><div class="studioReadMain"><div class="eyebrow">${esc(t.short)} · ${esc(t.length)}</div><h2 class="h2">${esc(t.name)}</h2><p class="studioWhenLead"><b>When to use it.</b> ${esc(t.when)}</p><p class="tiny studioFictional">${esc(t.sampleMeta)}</p><div class="studioLetter studioSample" id="studio-sample">${esc(t.sample)}</div></div><aside class="studioReadSide"><div class="studioNote"><h3>Why it works</h3><ul>${t.why.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="studioNote gold"><h3>What you must personalize</h3><ul>${t.personalize.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="studioNote rust"><h3>What to avoid</h3><ul>${t.avoid.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></aside></div></section>`;
 const composed=composeLoiStudio(t.id,st.fields),text=loiStudioCurrentText();
 if(st.mode==='edit'){return `<section class="studio" aria-label="Edit your ${esc(t.name)}"><div class="studioBar"><button class="btn ghost" type="button" data-act="studio-personalize">← Back to details</button><span class="studioStep"><b>${esc(t.name)}</b> · Step 2 of 2 · Edit your words</span></div>${loiStudioSaveStatus()}${loiStudioActions(st)}<div class="studioEdit"><div class="studioEditMain"><label class="studioField" for="studio-text"><span class="studioLabel">Your letter</span><textarea id="studio-text" rows="22" maxlength="12000" spellcheck="true">${esc(text)}</textarea><small class="tiny">Replace anything in [brackets] with your own facts. Only state what is true.</small></label><div class="row"><button class="btn ghost sm" type="button" data-act="studio-regenerate">Rebuild from details (discards edits)</button></div></div><div class="studioEditSide">${loiStudioPreview(text,composed?.warnings||[])}<div class="studioSubject"><span class="eyebrow">Email subject</span><div id="studio-subject">${esc(loiStudioSubject())}</div></div></div></div></section>`;}
 return `<section class="studio" aria-label="Personalize your ${esc(t.name)}"><div class="studioBar"><button class="btn ghost" type="button" data-act="studio-gallery">← All templates</button><span class="studioStep"><b>${esc(t.name)}</b> · Step 1 of 2 · Your facts</span><div class="row"><button class="btn ghost sm" type="button" data-act="studio-read" data-template="${t.id}">Read the example</button><button class="btn solid" type="button" data-act="studio-continue">Continue to editor →</button></div></div>${loiStudioSaveStatus()}<div class="studioEdit"><form class="studioForm studioEditMain" id="studio-form" autocomplete="off" onsubmit="return false">${loiStudioProgramPicker(st)}${LOI_STUDIO_FIELD_SETS[t.id].map(k=>loiStudioField(k,st.fields)).join('')}<div class="row" style="margin-top:12px"><button class="btn solid" type="button" data-act="studio-continue">Continue to editor →</button></div></form><div class="studioEditSide">${loiStudioPreview(composed?.text||'',composed?.warnings||[])}</div></div></section>`;
}
function loiStudioRefreshPreview(){const st=loiStudioState(),t=loiStudioTemplate(st.templateId);if(!t)return;const composed=composeLoiStudio(t.id,st.fields),text=loiStudioCurrentText();const pv=document.getElementById('studio-preview');if(pv)pv.innerHTML=loiStudioMark(text);const subj=document.getElementById('studio-subject');if(subj)subj.textContent=composed?.subject||'';const missing=loiStudioPlaceholders(text).length,m=document.querySelector('.studioMissing');if(m){m.className='studioMissing '+(missing?'warn':'ok');m.textContent=missing?missing+' detail'+(missing===1?'':'s')+' still in [brackets]':'No placeholders left';}const warn=document.querySelector('.studioPreview');if(warn){for(const w of warn.querySelectorAll('.studioWarn'))w.remove();for(const w of (composed?.warnings||[]))warn.querySelector('.eyebrow')?.insertAdjacentHTML('afterend',`<p class="studioWarn" role="status">${esc(w)}</p>`);}}
function loiStudioRequire(){if(!S||!lettersStudioEnabled())throw Error('Letters of Interest templates are not available for this workspace.');return loiStudioState();}
async function loiStudioCopy(text,okMessage,fallbackId){try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text);notice(okMessage);}catch{const field=document.getElementById(fallbackId);if(field&&typeof field.select==='function'){field.focus();field.select();}notice('Clipboard unavailable. Select the text and copy it yourself.');}}
function loiStudioDownload(text,filename){const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function loiStudioFilename(st){const prog=loiStudioClean(st.fields.programName).replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);return (loiStudioTemplate(st.templateId)?.name||'Letter').replace(/[^A-Za-z0-9]+/g,'-')+(prog?'-'+prog:'')+'.txt';}
Object.assign(A,{
 'studio-gallery'(){const st=loiStudioRequire();st.mode='gallery';render();document.querySelector('.studio')?.scrollIntoView({block:'start'});},
 'studio-read'(el){const st=loiStudioRequire();if(!loiStudioTemplate(el.dataset.template))throw Error('Unknown template.');st.templateId=el.dataset.template;st.mode='read';render();document.querySelector('.studio')?.scrollIntoView({block:'start'});},
 'studio-use'(el){const st=loiStudioRequire();if(!loiStudioTemplate(el.dataset.template))throw Error('Unknown template.');if(st.templateId!==el.dataset.template){st.templateId=el.dataset.template;st.text=null;st.edited=false;loiStudioForget(['studio-text']);}st.mode='personalize';render();document.querySelector('.studio')?.scrollIntoView({block:'start'});(document.getElementById('studio-program-pick')||document.getElementById('studio-f-yourName'))?.focus();},
 'studio-personalize'(){const st=loiStudioRequire();st.mode='personalize';render();document.querySelector('.studio')?.scrollIntoView({block:'start'});},
 'studio-continue'(){const st=loiStudioRequire();if(!st.edited||typeof st.text!=='string'){st.text=composeLoiStudio(st.templateId,st.fields)?.text||'';loiStudioForget(['studio-text']);}st.mode='edit';render();document.querySelector('.studio')?.scrollIntoView({block:'start'});},
 'studio-regenerate'(){const st=loiStudioRequire();st.text=composeLoiStudio(st.templateId,st.fields)?.text||'';st.edited=false;loiStudioForget(['studio-text']);render();notice('Letter rebuilt from your details.');},
 async 'studio-copy'(){const st=loiStudioRequire();const text=loiStudioCurrentText();if(!text.trim())throw Error('There is no letter to copy yet.');await loiStudioCopy(text,loiStudioPlaceholders(text).length?'Letter copied. It still contains [bracketed] placeholders to replace.':'Letter copied.','studio-text');},
 async 'studio-copy-subject'(){loiStudioRequire();const s=loiStudioSubject();if(!s)throw Error('Choose a template first.');await loiStudioCopy(s,'Email subject copied.','studio-subject');},
 async 'studio-copy-sample'(){const st=loiStudioRequire(),t=loiStudioTemplate(st.templateId);if(!t)throw Error('Open an example first.');await loiStudioCopy(t.sample,'Fictional example copied. Replace every name, program and fact with your own before using it.','studio-sample');},
 'studio-download'(){const st=loiStudioRequire();const text=loiStudioCurrentText();if(!text.trim())throw Error('There is no letter to download yet.');loiStudioDownload(text,loiStudioFilename(st));notice('Letter downloaded as a text file.');}
});
document.addEventListener('input',ev=>{const t=ev.target;if(!S||!t?.id||!t.id.startsWith('studio-')||!lettersStudioEnabled())return;const st=loiStudioState();
 if(t.id==='studio-text'){st.text=t.value;st.edited=true;loiStudioRefreshPreview();return;}
 if(t.id.startsWith('studio-f-')){const key=t.id.slice(9);if(!LOI_STUDIO_FIELDS[key])return;st.fields[key]=t.type==='checkbox'?t.checked:t.value;if(!st.edited)st.text=null;loiStudioRefreshPreview();}});
document.addEventListener('change',ev=>{const t=ev.target;if(!S||!t?.id||!lettersStudioEnabled())return;const st=loiStudioState();
 if(t.id==='studio-program-pick'){st.pick=t.value;const o=loiStudioProgramOptions().find(x=>x.id===t.value);if(o){st.fields.programName=o.name;if(o.specialty)st.fields.specialty=o.specialty;const pn=document.getElementById('studio-f-programName'),sp=document.getElementById('studio-f-specialty');if(pn)pn.value=o.name;if(sp&&o.specialty)sp.value=o.specialty;if(typeof draftValues!=='undefined'){draftValues.set(draftKey('studio-f-programName'),o.name);if(o.specialty)draftValues.set(draftKey('studio-f-specialty'),o.specialty);}}if(!st.edited)st.text=null;loiStudioRefreshPreview();return;}
 if(t.id.startsWith('studio-f-')&&t.type==='checkbox'){const key=t.id.slice(9);if(!LOI_STUDIO_FIELDS[key])return;st.fields[key]=t.checked;if(!st.edited)st.text=null;loiStudioRefreshPreview();}});
