function joined(record){return [record.title,record.experienceType,record.organization,record.location,record.specialty,record.description,record.section,record.rawText].filter(Boolean).join(" ").toLowerCase();}
function result(canonicalType,categoryId,timelineKind,rationale,extra={}){return {canonicalType,categoryId,timelineKind,rationale,siteName:extra.siteName||"",cityState:extra.cityState||"",specialty:extra.specialty||"",experienceType:extra.experienceType||"",warnings:extra.warnings||[]};}

const US_STATE_NAME=/(?:^|,\s*)(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)(?=\s*(?:,?\s*(?:usa|u\.s\.a?\.?|united states))?\s*$)/i;
const US_STATE_CODE=/(?:^|,\s*)(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?=\s*(?:\d{5}(?:-\d{4})?)?\s*(?:,?\s*(?:USA|U\.S\.A?\.?|United States))?\s*$)/i;
const US_MARKER=/\b(?:usa|united states)\b|(?:^|[\s,(])u\.s\.a?\.(?=$|[\s,.)])/i;
const ECFMG_NONFINAL=/\b(?:not|never|without|no)\s+(?:(?:yet|currently|fully)\s+)?ecfmg(?:[- ]certified|\s+(?:certification|certificate))?\b|\becfmg(?:[- ]certified|\s+(?:certification|certificate))?\s+(?:is\s+|was\s+)?(?:not|pending|incomplete|provisional|expired|lapsed|awaiting|processing|under review|in progress)\b|\b(?:pending|awaiting|provisional|expired|lapsed|incomplete)\s+ecfmg(?:\s+(?:certification|certificate))?\b|\becfmg\s+(?:application|pathway|eligibility)\b|\b(?:applied|applying|application|pathway|eligible|eligibility)\b.{0,48}\becfmg\b/;
const EXPLICIT_USCE=/\b(?:usce|united states clinical experience)\b/;
const NONFINAL_USCE=/\b(?:no|not|never|without|lack(?:s|ed|ing)?)\s+(?:\w+\s+){0,3}(?:usce|united states clinical experience)\b|\b(?:usce|united states clinical experience)\s+(?:is\s+|was\s+)?(?:not|none|absent|pending|planned|prospective|incomplete|unconfirmed)\b/;

function structuredLocation(record){return [record.location,record.cityState,record.state,record.country].filter(Boolean).join(", ").trim();}
function looksUnitedStates(value){
  const candidate=String(value||"").trim();
  if(!candidate)return false;
  return US_MARKER.test(candidate)||US_STATE_NAME.test(candidate)||US_STATE_CODE.test(candidate);
}
/*
 * Ordinary (non pipe-delimited) CV text leaves `location` empty and puts the whole
 * "Mount Sinai Hospital, New York, NY" string in `organization`, so geography-only
 * evidence used to be invisible and every US rotation was quarantined as unclassified.
 * The state regexes are anchored to the END of the string they are given, so each
 * candidate must be tested on its own - concatenating them would push a trailing
 * state code into the middle and stop it matching at all.
 */
function hasUnitedStatesContext(record){
  const country=String(record.country||"").trim();
  if(country&&!US_MARKER.test(country))return false;
  return looksUnitedStates(structuredLocation(record))||looksUnitedStates(record.organization)||looksUnitedStates(record.title);
}
function unverifiedClinical(common,reason="Clinical-experience wording was found, but a United States setting was not confirmed.",warning="Do not label this event USCE without explicit positive USCE wording or confirmed United States geography"){
  return result("UNCLASSIFIED","work","duration",reason,{...common,warnings:["Clinical experience needs human review",warning]});
}

/*
 * MyERAS CV entries carry an explicit experience type ("Education/training", "Work",
 * "Research", "Volunteer/service/advocacy", ...) next to the title and a separate
 * city/state line. Classify those from the title, the stated type and the stated
 * location. The bullet narrative is clinical duty text, not evidence of a different
 * category, so it is deliberately not consulted here. Anything this rule set cannot
 * settle falls through to the generic classifier below.
 */
const US_ROTATION_WORDS=/\b(?:observership|externship|sub[- ]?internship|clerkship|clinical\s+(?:rotation|elective|experience)|elective|rotation|preceptorship|shadowing)\b/i;
function classifyErasExperience(record,dateRange){
  const erasType=String(record.fields?.erasType||"").toLowerCase();
  if(!erasType)return null;
  const title=String(record.title||"").toLowerCase();
  const hasRange=!!dateRange?.end||dateRange?.openEnded;
  const kind=hasRange?"duration":"milestone";
  const common={siteName:record.organization||"",cityState:record.location||"",specialty:record.specialty||"",experienceType:record.experienceType||""};
  const unitedStates=hasUnitedStatesContext({...record,description:""});
  if(erasType.startsWith("volunteer"))return result("VOLUNTEER_EXPERIENCE","work",kind,"The source labels this entry Volunteer/service/advocacy.",common);
  if(/\b(?:resident|residency|registrar|fellow(?:ship)?)\b/.test(title)&&!/\belective\b/.test(title))return result("RESIDENCY_FELLOWSHIP","work",kind,"Residency or fellowship wording in the entry title.",common);
  if(/\b(?:intern(?:ship)?|house\s+officer|house\s+surgeon|rotatory internship)\b/.test(title)&&!/\bsub[- ]?internship\b/.test(title))return result("INTERNSHIP_HOUSE_OFFICER","work",kind,"Internship or house-officer wording in the entry title.",common);
  if(erasType==="research"||/\bresearch\b/.test(title))return result("RESEARCH_EXPERIENCE","res",kind,erasType==="research"?"The source labels this entry Research.":"Research wording in the entry title.",common);
  if(US_ROTATION_WORDS.test(title)){
    if(!unitedStates)return unverifiedClinical(common,"Clinical rotation wording was found, but the stated location is not in the United States.","Confirm whether this is United States clinical experience");
    const canonicalType=/\bobservership\b/.test(title)?"OBSERVERSHIP":/\bexternship\b/.test(title)?"EXTERNSHIP":/\bsub[- ]?internship\b/.test(title)?"SUB_INTERNSHIP":/\bclerkship\b/.test(title)?"CLERKSHIP":"USCE_TEACHING_HOSPITAL";
    return result(canonicalType,"th",kind,"Clinical rotation wording in the title with a stated United States location.",{...common,experienceType:/\belective\b/.test(title)?"Elective":common.experienceType});
  }
  if(erasType==="work")return result("WORK_EXPERIENCE","work",kind,"The source labels this entry Work.",common);
  if(erasType==="teaching/mentoring")return result("WORK_EXPERIENCE","work",kind,"The source labels this entry Teaching/mentoring.",common);
  if(erasType.startsWith("other extracurricular")||erasType==="leadership"||erasType==="professional organization")return result("LEADERSHIP","work",kind,`The source labels this entry ${record.experienceType}.`,common);
  if(erasType==="military service")return result("WORK_EXPERIENCE","work",kind,"The source labels this entry Military service.",common);
  return null;
}

export function classifyEvent(record,dateRange){
  const eras=classifyErasExperience(record,dateRange);
  if(eras)return eras;
  const structuredCommon={siteName:record.organization||"",cityState:record.location||"",specialty:record.specialty||"",experienceType:record.experienceType||""};
  if(record.fields?.scholarlyKind)return result(record.fields.scholarlyKind,"res","milestone","Listed under the document's scholarly work section.",structuredCommon);
  if(record.fields?.degreeMilestone)return result("MEDICAL_DEGREE","usmle","milestone","The medical education section states this degree with its completion date.",structuredCommon);
  const text=joined(record);
  const identityText=[record.title,record.experienceType].filter(Boolean).join(" ").toLowerCase();
  const hasRange=!!dateRange?.end||dateRange?.openEnded;
  const siteName=record.organization||"";
  const common={siteName,cityState:record.location||"",specialty:record.specialty||"",experienceType:record.experienceType||""};
  if(/\bstep\s*2\s*(?:ck|clinical knowledge)\b/.test(text)){
    if(/\b(prep|preparation|study|studies|dedicated)\b/.test(text)||hasRange)return result("USMLE_STUDY_PERIOD","usmle","duration","Step 2 CK study wording and a duration were detected.",common);
    return result("STEP_2_CK","usmle","milestone","Explicit Step 2 CK examination label detected.",common);
  }
  if(/\bstep\s*1\b/.test(text)){
    if(/\b(prep|preparation|study|studies|dedicated)\b/.test(text)||hasRange)return result("USMLE_STUDY_PERIOD","usmle","duration","Step 1 study wording and a duration were detected.",common);
    return result("STEP_1","usmle","milestone","Explicit Step 1 examination label detected.",common);
  }
  if(/\bstep\s*3\b/.test(text))return result("STEP_3","usmle",hasRange?"duration":"milestone","Explicit Step 3 label detected.",common);
  if(/\becfmg\b/.test(text)){
    if(ECFMG_NONFINAL.test(text))return result("UNCLASSIFIED","usmle","milestone","ECFMG wording was negated, uncertain, expired, provisional, or otherwise non-final.",{...common,warnings:["ECFMG status needs human review","Non-final ECFMG language must not be treated as certification"]});
    const certified=/\becfmg[- ]certified\b|\bcertified by (?:the )?ecfmg\b|\becfmg certification (?:is )?(?:complete|completed|issued|obtained|awarded|confirmed)\b|\b(?:completed|obtained|received) (?:my )?ecfmg certification\b|\bstandard ecfmg certificate (?:issued|received)\b/.test(text);
    if(certified)return result("ECFMG_CERTIFICATION","usmle","milestone","Explicit completed ECFMG certification wording was detected.",common);
    /* A bare "ECFMG Certification" listed under the student's own Certifications heading
       with a date is an affirmative statement that they hold it. Every negation, pending,
       expired, application and Pathway guard above still runs first, so this only rescues
       the plainly affirmative case a student should not have to reclassify by hand. */
    if(record.section==="certifications")
      return result("ECFMG_CERTIFICATION","usmle","milestone","ECFMG certification was listed under the document's certifications section without any pending or negated wording.",common);
    return result("UNCLASSIFIED","usmle","milestone","ECFMG wording was detected, but it does not establish completed certification.",{...common,warnings:["ECFMG status needs human review","Application, eligibility, Pathway, and pending language must not be treated as certification"]});
  }
  /* A dated entry listed under the document's own Certifications heading is a
     certification record whatever its wording ("HIPAA", a course certificate). */
  if(record.section==="certifications"||record.fields?.erasSection==="certifications")return result("CERTIFICATION","education","milestone","Listed under the document's certifications section.",common);
  if(/\b(application cycle|eras cycle)\b/.test(text))return result("APPLICATION_CYCLE","usmle",hasRange?"duration":"milestone","Application cycle wording detected.",common);
  if(/\binterview\b/.test(text))return result("INTERVIEW","usmle","milestone","Interview milestone wording detected.",common);
  if(/\b(move|moved|relocat).*(usa|united states)|\busa\b.*\bmove/.test(text))return result("MOVE_TO_USA","usmle","milestone","Move-to-USA wording detected.",common);
  if(/\bvisa|immigration|green card|work permit|citizenship\b/.test(text))return result("UNCLASSIFIED","personal","milestone","Sensitive immigration-status wording was detected without drawing a status or eligibility conclusion.",{...common,warnings:["Immigration context needs student confirmation and privacy review","Do not infer legal status or eligibility"]});
  if(/\bmedical degree|mbbs|md degree|graduat(?:ed|ion)\b/.test(text)){
    const type=/graduat/.test(String(record.title||"").toLowerCase())?"GRADUATION":"MEDICAL_DEGREE";
    return result(type,"usmle","milestone","Medical degree or graduation wording detected.",common);
  }
  if(
    record.section==="honors"||
    /\b(?:award|honou?r|distinction|prize|scholarship|dean'?s list|valedictorian|cum laude)\b/.test(text)
  )return result("AWARD_HONOR","education",hasRange?"duration":"milestone","Award or honor wording detected.",common);
  /* A publication under Research is still a publication, not employment in a lab.
     Source section names are context, not independent evidence of a role. */
  if(/\b(?:publications?|published|journal article)\b/.test(identityText)||record.section==="publications")return result("PUBLICATION","res","milestone","Publication wording detected.",common);
  if(record.section==="research"&&/\b(?:research|fellow|investigator|laboratory|study)\b/.test(identityText)){
    return result("RESEARCH_EXPERIENCE","res",hasRange?"duration":"milestone","Research-section context was detected and takes precedence over ambiguous fellowship wording.",common);
  }
  if(
    record.section==="education"||record.fields?.explicitCategory==="education"||/\bmedical education\b/.test(identityText)||
    /\b(?:bachelor(?:'s)?|master(?:'s)?|doctorate|ph\.?d\.?|b\.?s\.?|b\.?a\.?|m\.?s\.?)\b/.test(text)
  )return result("EDUCATION","education",hasRange?"duration":"milestone","Education wording or an education source section was detected.",common);
  const explicit=record.fields?.explicitCategory;
  if(explicit==='research')return result('RESEARCH_EXPERIENCE','res',hasRange?'duration':'milestone','The source explicitly labels this entry Research.',common);
  if(explicit==='personal')return result('PERSONAL_NOT_ON_CV','personal',hasRange?'duration':'milestone','The source explicitly labels this entry Personal.',common);
  if(/\bfellow(?:ship)?\b/.test(text))return result("RESIDENCY_FELLOWSHIP","work",hasRange?"duration":"milestone","Fellowship training wording detected.",common);
  if(/\bresiden(?:cy|t)\b/.test(text))return result("RESIDENCY_FELLOWSHIP","work",hasRange?"duration":"milestone","Residency training wording detected.",common);
  /* A sub-internship is a US clinical rotation, not a house-officer post; the substring
     "internship" inside it used to claim the entry before the rotation rule ran. */
  if(!/\bsub[- ]?internship\b/.test(text)&&(/\bintern(?:ship)?\b|\bhouse officer\b/.test(text)))return result("INTERNSHIP_HOUSE_OFFICER","work",hasRange?"duration":"milestone","Internship or house-officer wording detected.",common);
  if(/\bobservership\b|\bexternship\b|\bsub[- ]?internship\b|\bclerkship\b|\b(?:usce|united states clinical experience)\b|\bclinical (?:rotations?|electives?)\b|\brotations?\b|\bclinical assistant\b/.test(text)){
    const explicitUsce=EXPLICIT_USCE.test(text);
    if(explicitUsce&&NONFINAL_USCE.test(text))return unverifiedClinical(common,"USCE wording was negated or uncertain, so no completed United States clinical experience was inferred.","Negated or uncertain USCE wording must remain unclassified until human confirmation");
    if(!explicitUsce&&!hasUnitedStatesContext(record))return unverifiedClinical(common);
    const clinic=/\b(?:clinic|outpatient|office practice|family medicine)\b/.test(text);
    const canonicalType=/\bobservership\b/.test(text)?"OBSERVERSHIP":/\bexternship\b/.test(text)?"EXTERNSHIP":/\bsub[- ]?internship\b/.test(text)?"SUB_INTERNSHIP":/\bclerkship\b/.test(text)?"CLERKSHIP":clinic?"USCE_CLINIC":"USCE_TEACHING_HOSPITAL";
    return result(canonicalType,clinic?"cl":"th",hasRange?"duration":"milestone",explicitUsce?"Explicit USCE wording was detected.":"Clinical-experience wording and United States geography were both detected.",common);
  }
  if(/\babstract|poster|presentation|presented\b/.test(text))return result("ABSTRACT_POSTER_PRESENTATION","res","milestone","Abstract, poster, or presentation wording detected.",common);
  if(/\bvolunteer|community service\b/.test(identityText)||record.section==="volunteer"||explicit==="volunteer")return result("VOLUNTEER_EXPERIENCE",/\bclinic|clinical|hospital\b/.test(text)?"cl":"work",hasRange?"duration":"milestone","Volunteer wording detected.",common);
  if(/\bresearch\b/.test(text))return result("RESEARCH_EXPERIENCE","res",hasRange?"duration":"milestone","Research wording detected.",common);
  if(/\bleadership|president|chair|coordinator\b/.test(text))return result("LEADERSHIP","work",hasRange?"duration":"milestone","Leadership wording detected.",common);
  if(/\b(?:certification|certificate|certified)\b/.test(text))return result("CERTIFICATION","education",hasRange?"duration":"milestone","General certification wording detected.",common);
  if(/\b(?:pregnan(?:t|cy)|parental(?: leave)?|maternity|paternity|daughter|son|child(?:care)?|baby|family (?:transition|reasons?|care|caregiving|responsibilit(?:y|ies)|circumstances?)|spouse|husband|wife|caregiver|in-laws?)\b/.test(text)||record.section==="personal")return result("PERSONAL_NOT_ON_CV","personal",hasRange?"duration":"milestone","Personal or family context detected.",common);
  if(explicit==="work"||["work","experiences"].includes(record.section)||/\b(work|employment|driver|scribe|medical officer|physician|assistant)\b/.test(text))return result("WORK_EXPERIENCE","work",hasRange?"duration":"milestone","Work section or employment wording detected.",common);
  return result("UNCLASSIFIED","work",hasRange?"duration":"milestone","No canonical taxonomy rule was strong enough.",{...common,warnings:["Category needs human review"]});
}
