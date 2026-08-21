# Specialist Lane Findings — D1-TIMELINE-CLAUDE-TAKEOVER-008

Six read-only specialist lanes investigated the codebase in parallel; every BLOCKER/MAJOR
finding was then handed to an independent adversarial verifier instructed to refute it.
Total findings: 69. Verdicts returned: 35; upheld as real: 30.

Full machine-readable detail (evidence, proposed fixes, verifier reasoning) is in
`evidence/LANE_FINDINGS_RAW.json`.

## LANE C — CV + AI INTELLIGENCE

WHAT I READ (all under /Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001/packages/mission-timeline): every file in web/js/ingestion/ in full (cv-parser, event-classifier, date-normalizer, section-detector, confidence-engine, provenance, candidate-builder, eras-parser, privacy-detector, duplicate-detector, pdf-text-extractor, pdf-page-model, docx-text-extractor, index); web/js/uxr-002/intake-d1-408-adapter.js in full; web/js/uxr-002/intake.js (lines 1-360, 540-1120); web/js/uxr-002/constants.js; web/js/407f-engineering-adapter.js:6100-6330; src/intelligence/* in full; src/medical-education/reviewer.ts (head + finding codes); src/server/production-server.ts:81-90; src/api/http-api.ts routing.

HOW I VERIFIED: I executed the real ES modules with node --input-type=module against the actual files — the classifier, the date normalizer, the section detector, and a full end-to-end run of detectSections -> parseCvBlocks -> buildCandidates -> mapD1408CandidateToUxr on a realistic 5-entry IMG CV. Every quoted output above is real program output, not inference. For C-02 and C-03 I applied the proposed edits to a scratch copy at /private/tmp/claude-501/-Users-brianb-MissionMed-worktrees/21c524a9-ce71-4cc9-b7f4-ab0b96d34387/scratchpad/ec.js and re-ran both the failing cases and the fixtures from tests/cv-fallback-classifier.test.mjs and tests/medical-privacy-staging.test.mjs — the fixes hold and nothing regresses. Baseline `node --test tests/cv-fallback-classifier.test.mjs tests/medical-privacy-staging.test.mjs` = 9/9 pass. I edited NOTHING in the repo.

ARCHITECTURE FACTS THE LEAD MUST KNOW:

1. THE LIVE PATH IS NOT THE DOCUMENTED PATH. web/js/ingestion/index.js `install408Ingestion` has ZERO call sites anywhere in the repo — IngestionController (377 lines), ingestion-ui.js (248 lines), the OCR adapter, detectDuplicates and detectConflicts are all dead in the shipping app. The real flow is: 407f-engineering-adapter.js:6116 -> createD1408PdfIntakeAdapter (intake-d1-408-adapter.js:394) -> extract() at line 415 -> detectSections/parseRecords/buildCandidates/mapD1408CandidateToUxr -> IntakeStateMachine (intake.js:733) -> renderIntake. Any fix must land in intake-d1-408-adapter.js or the pure ingestion modules it imports, never in ingestion-controller.js/ingestion-ui.js.

2. ANSWER TO PRIORITY QUESTION 7 (production with no AI provider). src/server/production-server.ts:81-90 builds CvIntelligenceService with `provider: aiProviderName === "openai" ? ... : null`. With no TIMELINE_AI_* vars the provider is null, so cv-intelligence-service.ts:61 returns mode:"LOCAL_LIMITED" with zero candidates and fallbackReason:"UNCONFIGURED". intake-d1-408-adapter.js:563 then discards the analysis and returns the local candidates. Net effect: in production today the LOCAL parser is 100% of the product, and findings C-01, C-02, C-03, C-05 are what every student hits. Worse, the client still performs the full round-trip first — signObjectUpload, uploadSignedObject, confirmObjectUpload (lines 530-542) — then deletes the object again at line 564. That is an upload, a confirm, an analyze and a delete per CV for zero benefit; gating the whole block behind a cheap capability probe would remove four network calls from the critical path.

3. ANSWER TO PRIORITY QUESTION 1 (what is auto-populated). Auto-filled today: title, categoryId, startDate/endDate, eventType (milestone vs duration), openEnded, confidence, sourceSnippet, provenance, and a per-category `fields` block from categoryFields (intake-d1-408-adapter.js:188-280). Left blank for the student in EVERY import, regardless of what the CV said: education -> medicalSchoolCountry (hardcoded ""), degree unless the title is literally "MD"/"DO"/"MBBS" (exactDegree, line 180 does an exact whole-string match so "MBBS, Doctor of Medicine" yields ""); exams -> result, score (both hardcoded ""); clinical -> specialty (only populated if classification.specialty was set, which the local classifier never does — re

| ID | Sev | Finding | Location |
|---|---|---|---|
| C-01 | BLOCKER | Date ranges without spaces around the dash yield NO dates at all — student must retype both | `web/js/ingestion/date-normalizer.js:50` |
| C-02 | BLOCKER | Every research entry at a university/college is misclassified as EDUCATION, not research | `web/js/ingestion/event-classifier.js:54` |
| C-03 | BLOCKER | Every US clinical rotation on a normal CV is quarantined as UNCLASSIFIED and dumped into Work | `web/js/ingestion/event-classifier.js:11` |
| C-04 | MAJOR | Extracted employer / medical school never reaches the timeline event's siteName | `web/js/uxr-002/intake.js:583` |
| C-05 | MAJOR | Title and organization are swapped for education-style CV blocks (school becomes the title, degree becomes the school) | `web/js/ingestion/cv-parser.js:55` |
| C-06 | MAJOR | The §9 AI quality-review layer is computed on the server and then thrown away by the client | `web/js/uxr-002/intake-d1-408-adapter.js:567` |
| C-07 | MAJOR | Title-case section headings that are not exact aliases are never recognised | `web/js/ingestion/section-detector.js:31` |
| C-08 | MAJOR | Section context resets to "unknown" at every page boundary | `web/js/ingestion/section-detector.js:42` |
| C-09 | MAJOR | HIGH/MEDIUM/LOW confidence is computed everywhere but drives no differentiated UI behaviour | `web/js/uxr-002/intake.js:1048` |
| C-10 | MINOR | Internal adapter flag "mappingReviewRequired" leaks into the student's editable field list | `web/js/uxr-002/intake.js:943` |
| C-11 | MINOR | Abbreviated months written with a period ("Sept. 2019") are unparseable | `web/js/ingestion/date-normalizer.js:21` |
| C-12 | MINOR | Within-document duplicate and conflict detection never runs in the shipping app | `web/js/uxr-002/intake-d1-408-adapter.js:468` |

### C-01 — Date ranges without spaces around the dash yield NO dates at all — student must retype both
**Severity:** BLOCKER · **Location:** `web/js/ingestion/date-normalizer.js:50`

**Evidence:** normalizeDateRange splits on `const separator=/\s+(?:-|–|—|to|through|until)\s+/i;` (requires whitespace on BOTH sides), but cv-parser.js:3 builds DATE_RANGE with `\\s*` around the dash, so it happily captures "07/2021-12/2022" as the dates string. The two regexes disagree. Verified by executing the real module:
  "01/2023-06/2024"   -> start=null end=undefined warn=Unrecognized date format
  "Jan 2023-Jun 2024" -> start=null
  "2021-2023"         -> start=null
  "March 2020-Present"-> start=null
  "06/2021-Present"   -> start=null
And in the full pipeline (detectSections -> parseCvBlocks -> buildCandidates -> mapD1408CandidateToUxr) the CV line 'Medical Officer / Civil Hospital, Karachi / 07/2021-12/2022' produced: start="" end=null conf=low NEEDS_REVIEW 35 warnings=["Unrecognized date format"].

**Student impact:** This is the Founder's §7 complaint, literally. Any CV using the extremely common no-space dash form ("07/2021-12/2022", "Jan 2023-Jun 2024", "2021-2023") gets every affected entry with BOTH dates blank. validateCandidateForApproval (web/js/uxr-002/intake.js:617) then refuses approval with "Enter a month and year, like 'Jun 2023'" until the student hand-types every start and end date. Production has no AI provider, so this local parser IS the product.

**Proposed fix:** In web/js/ingestion/date-normalizer.js, insert a pre-normalisation step in normalizeDateRange before the split. Replace line 49 `const value=String(raw||"").trim();` with:

```js
const RANGE_JOIN=/((?:19|20)\d{2})\s*[-–—]\s*(?=(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}|spring|summer|fall|autumn|winter|early|mid|late|present|current|ongoing|now|\d{1,2}\/(?:19|20)\d{2}|(?:19|20)\d{2}\b)/gi;
// ...
const value=String(raw||"").trim().replace(RANGE_JOIN,"$1 - ");
```

The lookahead only fires when the dash is followed by another date token, so ISO values are untouched. Verified by execution: "01/2023-06/2024"->"01/2023 - 06/2024", "Jan 2023-Jun 2024"->"Jan 2023 - Jun 2024", "2021-2023"->"2021 - 2023", "March 2020-Present"->"March 2020 - Present", while "2023-01"->"2023-01" and "2023-01-15"->"2023-01-15" are left intact and "2023-01 to 2024-06" still splits on " to ".

### C-02 — Every research entry at a university/college is misclassified as EDUCATION, not research
**Severity:** BLOCKER · **Location:** `web/js/ingestion/event-classifier.js:54`

**Evidence:** joined() (line 1) concatenates record.organization into the matched text. The education rule at lines 54-57 tests `/\b(?:bachelor...|university|college|secondary school)\b/` against that joined text and runs BEFORE the research-section rule at lines 58-60. Executed against the real module:
  {title:'Research Assistant', organization:'Johns Hopkins University', section:'research'} -> EDUCATION / education
  {title:'Research Fellow', organization:'Baylor College of Medicine', section:'research'} -> EDUCATION / education
  {title:'Research Assistant', organization:'Mass General Hospital', section:'research'} -> RESEARCH_EXPERIENCE / res
The Codex regression test tests/cv-fallback-classifier.test.mjs:18 only passes because its fixture record has NO organization field.

**Student impact:** Directly answers priority question 2: NO. "Research Assistant — Johns Hopkins University — January 2023 to June 2024" does NOT yield category=research. It lands in the Education category (the same swim lane as medical school), and the expanded review card then demands 'Medical school', 'Medical school country' and 'Degree' for a research job. The student must re-pick the category by hand on essentially every research entry, because research assistants overwhelmingly work at universities.

**Proposed fix:** In web/js/ingestion/event-classifier.js, hoist the research-section rule above the education rule and stop letting an employer name imply education. Replace lines 54-60 with:

```js
  if(record.section==="research"&&/\b(?:research|fellow|investigator|laboratory|study)\b/.test(text)){
    return result("RESEARCH_EXPERIENCE","res",hasRange?"duration":"milestone","Research-section context was detected and takes precedence over ambiguous fellowship wording.",common);
  }
  if(
    record.section==="education"||
    /\b(?:bachelor(?:'s)?|master(?:'s)?|doctorate|ph\.?d\.?|b\.?s\.?|b\.?a\.?|m\.?s\.?)\b/.test(text)||
    /\b(?:university|college|secondary school)\b/.test(String(record.title||"").toLowerCase())
  )return result("EDUCATION","education",hasRange?"duration":"milestone","Education wording or an education source section was detected.",common);
```

I applied exactly this to a scratch copy and re-ran: all three research cases now return RESEARCH_EXPERIENCE/res, and all four existing assertions in tests/cv-fallback-classifier.test.mjs plus tests/medical-privacy-staging.test.mjs still hold (9/9 pass on the unpatched baseline; the patched classifier returns the same values for every fixture in those files).

### C-03 — Every US clinical rotation on a normal CV is quarantined as UNCLASSIFIED and dumped into Work
**Severity:** BLOCKER · **Location:** `web/js/ingestion/event-classifier.js:11`

**Evidence:** `function structuredLocation(record){return [record.location,record.cityState,record.state,record.country].filter(Boolean).join(", ").trim();}` — it never looks at record.organization. Meanwhile cv-parser.js chronologyRecord (the only parser that fires for ordinary non-pipe-delimited CV text) hardcodes `location:""` at line 62 and puts the whole "Mount Sinai Hospital, New York, NY" string into `organization`. So hasUnitedStatesContext() is false for every ordinary CV, line 67 fires `if(!explicitUsce&&!hasUnitedStatesContext(record))return unverifiedClinical(common);` and the rotation becomes UNCLASSIFIED/"work". Executed against the real module:
  {title:'Observership, Internal Medicine', organization:'Mount Sinai Hospital, New York, NY', section:'experiences'} -> UNCLASSIFIED / work
  {title:'Observership, Internal Medicine', location:'New York, NY', ...}                              -> OBSERVERSHIP / th
Full-pipeline run on a realistic CV reproduced it: cat=work type=UNCLASSIFIED conf=low, warnings=["Clinical experience needs human review","Do not label this event USCE without explicit positive USCE wording or confirmed United States geography"].

**Student impact:** USCE is the single most important thing on an IMG's timeline. Every observership/externship/clerkship parsed from a normal CV arrives in the Work Experience category with a low-confidence badge and an alarming warning, so the student re-classifies each rotation by hand and loses the rotationType/city/state prefill that categoryFields() would have supplied for the clinical category (intake-d1-408-adapter.js:227-239).

**Proposed fix:** In web/js/ingestion/event-classifier.js line 11, add the organization to the geography evidence:

```js
function structuredLocation(record){return [record.location,record.cityState,record.state,record.country,record.organization].filter(Boolean).join(", ").trim();}
```

The US_STATE_CODE / US_STATE_NAME regexes (lines 4-5) are anchored to the END of the joined string, so appending organization last is what makes "Mount Sinai Hospital, New York, NY" match. Verified on a patched scratch copy: the Mount Sinai case now returns OBSERVERSHIP/th, while 'Civil Hospital, Karachi, Pakistan' and 'Mount Sinai Hospital' (no geography) both correctly remain UNCLASSIFIED — the conservative non-US quarantine in tests/medical-privacy-staging.test.mjs is preserved.

### C-04 — Extracted employer / medical school never reaches the timeline event's siteName
**Severity:** MAJOR · **Location:** `web/js/uxr-002/intake.js:583`

**Evidence:** candidateEvent() builds the event that is written to the document:
`siteName:String(candidate.fields?.institution||candidate.fields?.employer||candidate.fields?.siteName||""),`
But web/js/uxr-002/intake-d1-408-adapter.js categoryFields() writes the organization under different keys per category: education -> `medicalSchool:organization` (line 211), work -> `organization` (line 246). Only clinical (line 231) and research (line 258) use `institution`. No branch ever writes `employer` or `siteName`. Confirmed in the full-pipeline run: the work candidate had fields.organization="Civil Hospital, Karachi" and fields.institution=undefined; the education candidate had fields.medicalSchool set and fields.institution=undefined.

**Student impact:** Every imported work-experience and education event lands on the board with a blank institution. board-renderer.js:678 (`siteName:String(event.siteName||event.location||"")`) and d1-411a/domain-visual-adapter.js:232 (`location:clean(event?.siteName||...)`) then render no site label, so the student re-types the hospital/university they already had on their CV — exactly the re-entry the commission forbids.

**Proposed fix:** One-line widening in web/js/uxr-002/intake.js:583:

```js
    siteName:String(candidate.fields?.institution||candidate.fields?.organization||candidate.fields?.medicalSchool||candidate.fields?.employer||candidate.fields?.siteName||""),
```

No adapter change needed; builder.js:683 already reads `fields.organization||event.siteName`, so the two stay consistent.

### C-05 — Title and organization are swapped for education-style CV blocks (school becomes the title, degree becomes the school)
**Severity:** MAJOR · **Location:** `web/js/ingestion/cv-parser.js:55`

**Evidence:** chronologyRecord, when the date line has no leftover text, assigns positionally:
```
  if(!title){
    title=preceding.length>1?preceding.at(-2).text:preceding.at(-1).text;
    organization=preceding.length>1?preceding.at(-1).text:"";
  }
```
It assumes the CV always lists role-first, organization-second. Education sections almost universally list the school first. Full-pipeline run on 'Aga Khan University, Karachi, Pakistan' / 'MBBS, Doctor of Medicine' / 'September 2016 - June 2021' produced: title="Aga Khan University, Karachi, Pakistan", organization="MBBS, Doctor of Medicine", fields.medicalSchool="MBBS, Doctor of Medicine".

**Student impact:** The student's medical-school entry shows the school name as the event title and the words "MBBS, Doctor of Medicine" in the 'Medical school' field. It is visibly, embarrassingly wrong on the first and most important event of the timeline, and both fields must be retyped.

**Proposed fix:** In web/js/ingestion/cv-parser.js, pick the organization by shape rather than by position. Add near the top:

```js
const ORG_HINT=/\b(?:university|college|school|hospital|institute|institution|centre|center|clinic|academy|foundation|laborator(?:y|ies)|inc\.?|llc|ltd)\b/i;
```

and replace lines 54-59 with:

```js
  if(!title){
    if(preceding.length>1){
      const [first,second]=[preceding.at(-2).text,preceding.at(-1).text];
      const orgFirst=ORG_HINT.test(first)&&!ORG_HINT.test(second);
      title=orgFirst?second:first;
      organization=orgFirst?first:second;
    }else{
      title=preceding.at(-1).text;
      organization="";
    }
  }else if(preceding.length){
    organization=preceding.at(-1).text;
  }
```

When neither or both lines look like an organization the existing order is preserved, so the research case ('Research Assistant' then 'Johns Hopkins University') is unchanged.

### C-06 — The §9 AI quality-review layer is computed on the server and then thrown away by the client
**Severity:** MAJOR · **Location:** `web/js/uxr-002/intake-d1-408-adapter.js:567`

**Evidence:** The LOCAL_LIMITED branch keeps only two scalars and drops the payload entirely:
`parser:{...local.parser,intelligenceMode:"LOCAL_LIMITED",fallbackReason:analysis?.fallbackReason||"AI_EMPTY"}`
The SERVER_AI branch does carry them (lines 586-587: `qualitySuggestions`, `unresolvedQuestions`) but `grep -rn "qualitySuggestions\|unresolvedQuestions" web/js` returns hits ONLY inside this file — no renderer reads them. `grep -n "suggestion\|finding" web/js/uxr-002/advisor.js web/js/uxr-002/review.js` returns nothing at all. Server side, src/intelligence/cv-intelligence-service.ts:108 computes them even on the unconfigured fallback (`buildCvQualitySuggestions(document, [], [], [], new Map())`), and src/intelligence/quality-assistant.ts:39 sources them from reviewMedicalEducationTimeline, whose findings include EMPTY_TIMELINE, USCE_SITE_MISSING, USMLE_DATE_REVIEW, CHRONOLOGY_GAP_REVIEW, INTERVIEWER_SAFE_SENSITIVE_CONTEXT and DENSE_OVERLAP_REVIEW (src/medical-education/reviewer.ts:39-128).

**Student impact:** Answers priority question 6: the layer exists and is fully implemented server-side, but it is unreachable in the UI. The student never sees 'you have a 14-month gap here', 'this USCE has no site', 'these two look like duplicates' or the honest 'Server semantic analysis is unavailable — review the limited local parser's suggestions before accepting' message that cv-intelligence-service.ts:109 already generates. In production (no AI vars) the client uploads the source, calls /intake/analyze, receives these deterministic findings, deletes the object and discards the findings.

**Proposed fix:** Two surgical steps. (1) In web/js/uxr-002/intake-d1-408-adapter.js:567, carry the payload through the fallback exactly as the SERVER_AI branch does:

```js
            parser:{...local.parser,intelligenceMode:"LOCAL_LIMITED",fallbackReason:analysis?.fallbackReason||"AI_EMPTY",
              qualitySuggestions:Array.isArray(analysis?.qualitySuggestions)?analysis.qualitySuggestions:[],
              unresolvedQuestions:Array.isArray(analysis?.unresolvedQuestions)?analysis.unresolvedQuestions:[]}
```

(2) In web/js/uxr-002/intake.js reviewMarkup (line 1077 onward), render `state.extraction.parser?.qualitySuggestions` and `?.unresolvedQuestions` as a read-only advisory list above `.intake-review-toolbar` — the state already stores `parser` (EXTRACTION_SUCCEEDED passes `parser:response?.parser`, intake.js:819), so no state plumbing is required.

### C-07 — Title-case section headings that are not exact aliases are never recognised
**Severity:** MAJOR · **Location:** `web/js/ingestion/section-detector.js:31`

**Evidence:** `const looksLikeHeading=words.length<=7&&String(line).trim()===String(line).trim().toUpperCase()&&!/[|,]/.test(line);` gates the fuzzy substring fallback (lines 32-34) behind an ALL-CAPS requirement, so a Title-Case heading only works if it is an exact SECTION_ALIASES entry. Executed against the real module:
  'Honors and Awards'          -> null   (alias list only has 'awards and honors')
  'Awards & Honors'            -> null
  'Clinical Rotations'         -> null
  'US Clinical Experience'     -> null
  'Observerships'              -> null
  'Certifications & Licensure' -> null
  'AWARDS & HONORS'            -> honors (uppercase path works)

**Student impact:** Section is the single strongest classification signal — it drives the honors rule (event-classifier.js:51), the education rule (line 55), the research rule (line 58), the work rule (line 79) and a +14 confidence factor (confidence-engine.js:5). A CV that writes 'Honors and Awards' in Title Case loses its entire awards section to section='unknown', so awards fall through to whatever generic keyword happens to match and arrive low-confidence for manual re-categorisation.

**Proposed fix:** In web/js/ingestion/section-detector.js line 31, accept Title Case as heading-shaped as well as ALL CAPS:

```js
  const trimmed=String(line).trim();
  const titleCase=/^[A-Z][^a-z]*[a-z]/.test(trimmed)&&words.every((word)=>word.length<3||/^[a-z]+$/.test(word)||/^[A-Z]/.test(trimmed.split(/\s+/)[words.indexOf(word)]||""));
  const looksLikeHeading=words.length<=7&&(trimmed===trimmed.toUpperCase()||/^[A-Z]/.test(trimmed))&&!/[|]/.test(line)&&!/\d/.test(trimmed);
```

Simplest low-risk form: keep the word-count cap, replace the all-caps test with `(trimmed===trimmed.toUpperCase()||/^[A-Z]/.test(trimmed))`, drop `,` from the exclusion but add `&&!/\d/.test(trimmed)` so date-bearing content lines can never be mistaken for headings. Additionally add the missing aliases to SECTION_ALIASES: honors gets "honors and awards", "awards & honors", "honors & awards"; experiences gets "clinical rotations", "us clinical experience", "usce", "observerships", "electives"; certifications gets "certifications & licensure".

### C-08 — Section context resets to "unknown" at every page boundary
**Severity:** MAJOR · **Location:** `web/js/ingestion/section-detector.js:42`

**Evidence:** detectSections declares the tracker inside the per-page loop:
```
  (pages||[]).forEach((page)=>{
    let currentSection="unknown";
```
Executed against the real module with a heading on page 1 and its continuation entries on page 2:
  1:research:Research Assistant
  1:research:Jan 2023 - Jun 2024
  2:unknown:Research Coordinator
  2:unknown:Feb 2021 - Dec 2022

**Student impact:** On the standard two-page CV, every entry that continues past the page break loses its section. Combined with C-02/C-07 that means the second page of a CV is classified almost entirely by loose keyword matching, and the -14 'Recognized source section' confidence factor is lost, pushing those candidates out of the 'Accept all high-confidence' bulk action.

**Proposed fix:** In web/js/ingestion/section-detector.js, hoist the tracker out of the page loop so it carries across pages:

```js
export function detectSections(pages){
  const blocks=[];
  const sectionCounts={};
  let currentSection="unknown";
  (pages||[]).forEach((page)=>{
    page.lines.forEach((line,index)=>{
```

Delete the `let currentSection="unknown";` on line 42. Nothing else in the function needs to change.

### C-09 — HIGH/MEDIUM/LOW confidence is computed everywhere but drives no differentiated UI behaviour
**Severity:** MAJOR · **Location:** `web/js/uxr-002/intake.js:1048`

**Evidence:** The thresholds exist in three places — web/js/ingestion/confidence-engine.js:20 (`score>=80?"HIGH":score>=60?"MEDIUM":score>=40?"LOW":"NEEDS_REVIEW"`), src/intelligence/cv-post-validator.ts:186 (`score>=85?"HIGH":score>=65?"MEDIUM":score>=40?"LOW"`), and the collapse to three UI levels in web/js/uxr-002/intake-d1-408-adapter.js:116-126. But the UI consumes the level in only two places: `const confidenceClass=candidate.confidence==="high"?"success":candidate.confidence==="medium"?"gold":"tertiary";` (a badge colour) and the 'Accept all high-confidence' button at line 1087 driven by highConfidenceCount (line 343). candidateMarkup renders byte-identical markup for medium and low. There is no auto-prefill path, no prefill+confirm path, and no minimal targeted question for LOW.
Separately, confidence-engine.js:19-22 computes the score and THEN overrides only the level, so a quarantined candidate can carry score=100 with level=NEEDS_REVIEW — reproduced in the full-pipeline run: 'Observership' -> conf=low (NEEDS_REVIEW 100).

**Student impact:** Answers priority question 4: the policy is implemented as data but not as behaviour. A LOW-confidence candidate with a missing date and a HIGH-confidence fully-populated one present the same card with the same four buttons, so the student manually inspects all 15-40 suggestions instead of confirming a handful. The score/level mismatch also makes the 'Why low confidence?' disclosure (intake.js:1019) inconsistent with the stored score.

**Proposed fix:** Two surgical edits, no architecture change. (1) In web/js/ingestion/confidence-engine.js, clamp the score whenever the level is forced down, so score and level agree — after line 22 add `if(level==="NEEDS_REVIEW")score=Math.min(score,39);`. (2) In web/js/uxr-002/intake.js candidateMarkup (line ~1049), branch on the level to set the default expansion and the primary action: pass `candidate.expanded||candidate.confidence!=="high"` into the `${candidate.expanded?expandedFields(candidate):""}` slot so medium/low cards open their field panel by default, and for `candidate.confidence==="low"` prepend a single targeted prompt for the first blank required field (`!candidate.startDate?"When did this start?":!candidate.title?"What should this be called?":""`) above the field grid.

### C-10 — Internal adapter flag "mappingReviewRequired" leaks into the student's editable field list
**Severity:** MINOR · **Location:** `web/js/uxr-002/intake.js:943`

**Evidence:** INTERNAL_CANDIDATE_FIELDS lists only canonicalType, sourceLocation, sourceProvenance, extractionConfidence, datePrecision, mappingRationale, extractionWarnings, privacy. But intake-d1-408-adapter.js categoryFields() `common` (lines 191-206) also emits `mappingReviewRequired` (a boolean), `duplicateGroupIds` and `conflictIds` (arrays). expandedFields (line 967) renders every leftover field whose typeof is in `["string","number","boolean"]` (line 975), so the arrays are filtered out but the boolean is not — it renders as `<label>Mapping Review Required <input type="text" value="false" ...>`.

**Student impact:** Every expanded suggestion card shows a junk free-text field labelled "Mapping Review Required" containing the word "false", directly under the real Organization/Country/City inputs. It looks like a bug to the student and typing in it silently corrupts the flag.

**Proposed fix:** Add the three keys to the set at web/js/uxr-002/intake.js:943:

```js
const INTERNAL_CANDIDATE_FIELDS=new Set([
  "canonicalType",
  "sourceLocation",
  "sourceProvenance",
  "extractionConfidence",
  "datePrecision",
  "mappingRationale",
  "mappingReviewRequired",
  "extractionWarnings",
  "privacy",
  "duplicateGroupIds",
  "conflictIds",
  "inferredFields"
]);
```

### C-11 — Abbreviated months written with a period ("Sept. 2019") are unparseable
**Severity:** MINOR · **Location:** `web/js/ingestion/date-normalizer.js:21`

**Evidence:** `match=value.match(/^([A-Za-z]+)\s+(\d{4})$/);` — line 9 strips only commas (`value.replace(/[,]/g,"")`), so a trailing period breaks the `[A-Za-z]+` anchor. Executed against the real module:
  "Jan. 2023 - Jun. 2024" -> start=null end=null, warnings=["Unrecognized date format","Unrecognized date format"]
  "Sept. 2019 – May 2023" -> start=null end=2023-05, warnings=["Unrecognized date format"]

**Student impact:** CVs that abbreviate months with periods — a very common house style — lose the start date on every entry, so the student retypes it and the candidate drops to NEEDS_REVIEW (confidence-engine.js:14 applies -28 for a missing start date and line 21 hard-caps the level).

**Proposed fix:** Make the period optional in web/js/ingestion/date-normalizer.js:21:

```js
  match=value.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
```

Verified by execution: "Sept. 2019"->month 9, "Jun. 2024"->month 6, "January 2023"->month 1 (unchanged). The MONTHS table at line 1 already contains the `sept` key.

### C-12 — Within-document duplicate and conflict detection never runs in the shipping app
**Severity:** MINOR · **Location:** `web/js/uxr-002/intake-d1-408-adapter.js:468`

**Evidence:** The live extract() pipeline is `detectSections -> parseRecords -> buildCandidates -> mapD1408CandidateToUxr` (lines 466-469). It never calls detectDuplicates or detectConflicts. Those are invoked only at web/js/ingestion/ingestion-controller.js:155-156, inside IngestionController, which is reachable only through install408Ingestion (web/js/ingestion/index.js:19) — and `grep -rn "install408Ingestion"` across the whole repo returns exactly one hit: its own definition. The only duplicate check that does run is intake.js findDuplicate (line 159), which compares each candidate against `existingEvents` only, never against the other candidates from the same import.

**Student impact:** A CV that lists the same rotation twice (e.g. once under 'Clinical Experience' and again under 'Electives'), or a student who uploads their CV and then their MyERAS export, gets both copies silently imported as separate timeline events. The duplicate then shows up as a visible collision on the board rather than as a merge prompt. The candidate objects still carry the empty duplicateGroupIds/conflictIds arrays the UI reads (intake.js:1010 `candidate.fields?.conflictIds?.length`), so the 'Source conflict review required' banner is permanently dead code.

**Proposed fix:** Reuse the existing detector instead of writing a new one. In web/js/uxr-002/intake-d1-408-adapter.js add `import {detectDuplicates} from "../ingestion/duplicate-detector.js";` and, between lines 468 and 469, insert:

```js
      detectDuplicates(legacyCandidates);
      const candidates=legacyCandidates.map(mapD1408CandidateToUxr);
```

detectDuplicates mutates duplicateGroupIds/candidateKind/safeToBulkAccept in place (duplicate-detector.js:46-51), which mapD1408CandidateToUxr already copies through (line 204) and normalizedConfidence already honours via safeToBulkAccept (line 121). Note duplicate-detector.js:24 short-circuits on `a.sourceDocumentId===b.sourceDocumentId`, so for same-document detection that guard must be dropped or made conditional — otherwise only cross-document duplicates are found.

## E — UX / Human Acceptance / Terminology

HOW I VERIFIED: read the shipping shell and every user-facing string path in it. Entry point is web/index.html (3320 lines, long-line, 478KB) → single module `<script type=\"module\" src=\"./js/407f-engineering-adapter.js\">` at index.html:3318. Files read in full or in the relevant ranges: web/index.html (head/CSS 1-60, shell markup 495-745, render functions 1140-1300, modals 1358-1460, legacy intake 3000-3290), web/js/407f-engineering-adapter.js (entitlement 1580-1700, preview mount 3340-3470, kernel event wiring 3898-3950, raw-error toast sites, media 2273-2330, intake host 6114-6220, responsive 6465-6500, boot/recovery 6480-6553), web/js/d1-411a/kernel-host.js (1-300, 295-470, 1700-1730), web/js/uxr-002/{canvas.js,home.js,constants.js,intake.js,export-screen.js,entitlement.js,media-library.js,preview.js,responsive.js,builder.js}, web/styles/{407f-upgrade.css,uxr-002.css}.

IMPORTANT — CONCURRENT EDITS: web/js/d1-411a/kernel-host.js and scripts/serve.mjs are dirty in the worktree and kernel-host.js grew from 1889 to 1961 lines DURING this investigation (another lane added `failSoftRenderMessage` at :153 and label-fitting helpers at :140). Every kernel-host line number in my findings was re-derived against the CURRENT file after that change; re-grep the anchor strings before applying, not the line numbers.

ARCHITECTURE FACTS THE LEAD NEEDS:
1. Only ONE toast surface exists app-wide: index.html:3286 `toast()` writing to `<div id="toast">` (index.html:741). `bridge` IS `window.D1_407F_TEST` (407f-engineering-adapter.js:1257), so every `bridge.toast(...)` in the 6553-line adapter lands in that one div. Fixing E-05 and E-07 is therefore two functions, not 24 sites of bespoke copy.
2. There are TWO parallel UI implementations. The `uxr-002/` shell (app.js renderHome/responsiveFrame, home.js, uxr-002.css) is SUPERSEDED and not loaded — constants.js:17-20 says so explicitly. The shipping UI is index.html + 407f-engineering-adapter.js + 407f-upgrade.css, which imports individual uxr-002 modules (intake.js, canvas.js, export-screen.js, media-library.js, entitlement.js, responsive.js) but NOT their screen-level renderers. Several good UX behaviours therefore ship dead: the ghost example board (preview.js:51/93, used only by the dead home.js:59), the responsive banner (responsive.js:424-425), and the small-pill export spinner (uxr-002.css:386, overridden full-bleed by 407f-upgrade.css:6066). E-09 and E-10 are both "wire up what already exists", which is why they are cheap.
3. `dataset.errorMessage` is a dead channel. Both kernel-host.js:1711 and canvas.js:1683 write good student copy into it; nothing anywhere reads it — no CSS `attr(data-error…)` rule exists in web/styles, and no JS reads it. Same for `dataset.lastFailureContext` and `dataset.projectionWarnings`. Any fix must actively render, not just set attributes.
4. `d1-411a:rejected` has a handler (adapter:3898, toasts + undoes) but `d1-411a:error` has none. That asymmetry is the whole of E-02.

TERMINOLOGY SWEEP — PRECISION NOTE. I checked every term on the brief's list against actual reachability. GENUINELY STUDENT-VISIBLE and reported above: WordPress role / cohort / promotion / override (E-04), D1-411A / D1-409H / kernel / TimelineArtifact / projection via raw toasts (E-05), D1-408 / pdfExtractor / "object ID" via the intake field error (E-06), "asset reference" (E-12), "local timeline" (E-11). NOT DEFECTS — do not chase these: (a) `canonical` appears ~30x in index.html but only as identifiers (`canonicalSchoolId`, `canonicalExactDate404`, `canonicalCategory`) and in CSS comments; (b) the "PROVENANCE ▸" button (index.html:1092, 3112), "FIXTURE EXTRACTION · REAL PARSING IS THE 408 ENGINEERING TRACK" (3120), "OCR fixture path" (3017, 3032) and the stress-fixture modal (1450-1459) are all DEAD — their hosts `#candList`, `#ctlFixtures` and `#histList` do not exist in the current shell (verified by id count), and the intake view is `<div id="intake407F">` (index.html:643-645) rend

| ID | Sev | Finding | Location |
|---|---|---|---|
| E-01 | BLOCKER | Kernel _fail() hides the retained last-good render behind the opaque "Preparing your timeline…" panel, and the recovery alert it appends is unstyled and clipped out of view | `web/js/d1-411a/kernel-host.js:1708` |
| E-02 | BLOCKER | A failed Edit-Timeline projection update is completely silent to the student — the message is written to a data-attribute and the console only, and nothing listens for d1-411a:error | `web/js/uxr-002/canvas.js:1682` |
| E-03 | MAJOR | D-04 overlap banner fires on the FIRST successful render of a routine timeline and tells the student to "move an item" on the Home preview, which is deliberately non-interactive | `web/js/d1-411a/kernel-host.js:20` |
| E-04 | MAJOR | Entitlement denial reasons are internal WordPress/config strings and are rendered verbatim into the student-facing banner, header tooltip and toasts | `web/js/uxr-002/entitlement.js:221` |
| E-05 | MAJOR | 24 adapter call sites toast the raw JavaScript error.message, exposing internal codenames like "D1-411A kernel projection is unavailable." and "Protected D1-409H-A1 kernel was not loaded." | `web/js/407f-engineering-adapter.js:6198` |
| E-06 | MAJOR | Intake writes the raw adapter error.message into state.fileError, which is rendered as a red field error under the CV dropzone | `web/js/uxr-002/intake.js:826` |
| E-07 | MAJOR | The global toast is not a live region — every confirmation and every error message is silent for screen-reader users and auto-dismisses in 2.6s with no dismiss control | `web/index.html:741` |
| E-08 | MAJOR | §12 last-good-render retention is not implemented: no "Updating your timeline…" class of copy exists anywhere, and both refresh overlays are full-bleed opaque wipes | `web/js/d1-411a/kernel-host.js:256` |
| E-09 | MAJOR | Zero-event Edit Timeline shows a dark abstract box, and zero-event Home shows three grey bars — neither resembles the artifact the student is building, though a ghost example board already exists and is unused | `web/js/uxr-002/canvas.js:1368` |
| E-10 | MAJOR | RESPONSIVE_BANNER is defined and never rendered by the shipping shell — on a phone the Edit Timeline toolbar is display:none with no explanation | `web/js/uxr-002/responsive.js:42` |
| E-11 | MINOR | Boot gate says "Loading local timeline…" (developer wording) and has no timeout or global error fallback, so a module that never executes leaves a permanent full-screen dead gate | `web/index.html:503` |
| E-12 | MINOR | Media library empty state and action buttons use asset-management vocabulary ("asset reference", "Replace asset", "Delete asset") instead of the student's word, image | `web/js/uxr-002/media-library.js:207` |

### E-01 — Kernel _fail() hides the retained last-good render behind the opaque "Preparing your timeline…" panel, and the recovery alert it appends is unstyled and clipped out of view
**Severity:** BLOCKER · **Location:** `web/js/d1-411a/kernel-host.js:1708`

**Evidence:** _fail (1708-1721):
  _fail(error){
    this.dataset.ready="false";
    this.dataset.error=String(error?.code||error?.message||error);
    this.dataset.errorMessage="We could not display your timeline. Your saved information is still safe.";
    if(this.shadowRoot){
      const retained=this.shadowRoot.querySelector("iframe");
      if(retained){
        let alert=this.shadowRoot.querySelector("[data-last-good-alert]");
        if(!alert){alert=this.ownerDocument.createElement("output");alert.dataset.lastGoodAlert="true";alert.setAttribute("role","alert");this.shadowRoot.append(alert);}
        alert.innerHTML='<strong>We kept your last working timeline visible.</strong>…';

Shadow style block written in _mount (254-260):
  :host{display:block;position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:#c8d8e1}
  iframe{display:block;width:100%;height:100%;border:0;background:#c8d8e1}
  output[data-loading]{position:absolute;inset:0;display:grid;place-items:center;background:#c8d8e1;color:#19334f;…}
  :host([data-ready="true"]) output[data-loading]{display:none}
  output[data-render-warning]{position:absolute;right:12px;bottom:12px;…}
…<output data-loading role="status">Preparing your timeline…</output>

There is NO rule for [data-last-good-alert] in that style block. `dataset.errorMessage` is never rendered by any CSS or JS — `grep -rn "attr(data-error" web/styles/*.css` returns nothing.

**Student impact:** Any kernel failure (the D-03 TEXT_FIT_UNRESOLVED home case, an iframe load failure, a rethrown core ASSET_LOAD_FAILED from D-02) flips data-ready to "false", which un-hides the fully opaque #c8d8e1 loading panel over the whole 16:9 box. The student stares at a flat grey-blue box reading "Preparing your timeline…" forever, with no error, no retry and no explanation. The two sentences the code wrote for exactly this moment ("We kept your last working timeline visible." / "We could not display your timeline.") are both unreachable: the appended <output> is statically positioned after a 100%-height iframe inside `:host{aspect-ratio:16/9;overflow:hidden}`, so it is clipped below the visible box.

**Proposed fix:** Two-line-scope edit in kernel-host.js, host layer only.
(1) In the _mount shadow style block, after the `output[data-render-warning][hidden]{display:none}` rule add:
  output[data-last-good-alert]{position:absolute;left:12px;right:12px;bottom:12px;z-index:1200;display:grid;gap:2px;padding:10px 12px;border:1px solid rgba(25,51,79,.22);border-radius:8px;background:rgba(255,255,255,.98);color:#19334f;font:600 12px/1.45 system-ui,sans-serif;box-shadow:0 4px 16px rgba(25,51,79,.12)}
  output[data-last-good-alert] strong{display:block;font-weight:800}
(2) In _fail, replace `this.dataset.ready="false";` with:
  const retainedFrame=this.shadowRoot?.querySelector("iframe");
  this.dataset.ready=retainedFrame?"true":"false";
  this.dataset.degraded="true";
so a surface that already painted keeps its last-good pixels (data-ready stays "true" → the opaque loading panel stays hidden) and only gains the alert strip. A surface that never painted keeps data-ready="false", and its `else` branch already replaces the whole shadow root — give that branch its own inline style so it is legible: `'<style>output{display:grid;gap:4px;place-content:center;height:100%;padding:24px;background:#c8d8e1;color:#19334f;font:600 13px/1.5 system-ui,sans-serif;text-align:center}output strong{font-weight:800}</style><output role="alert">…'`.

### E-02 — A failed Edit-Timeline projection update is completely silent to the student — the message is written to a data-attribute and the console only, and nothing listens for d1-411a:error
**Severity:** BLOCKER · **Location:** `web/js/uxr-002/canvas.js:1682`

**Evidence:** canvas.js:1682-1695:
    Promise.resolve(currentKernel.updateProjection?.()).catch((error)=>{
      currentKernel.dataset.error=String(error?.code||error?.message||error);
      currentKernel.dataset.errorMessage="We could not apply that layout change. Your last working timeline is still available.";
      currentKernel.dispatchEvent?.(new CustomEvent("d1-411a:error",{
        bubbles:true, composed:true,
        detail:{surface:currentKernel.dataset.surface,error}
      }));
      console.error("Timeline canvas update unavailable",{
        surface:currentKernel.dataset.surface,
        code:String(error?.code||"RENDER_UNAVAILABLE")
      });
    });

The adapter registers listeners for every other kernel event (407f-engineering-adapter.js:3936-3947: d1-411a:interaction, :gesture, :presentation-gesture, :advanced-select, :advanced-gesture, :advanced-text-editing, :advanced-text, :advanced-drop, :advanced-command, :rejected, :command, :media-drop) but there is no `d1-411a:error` listener anywhere: `grep -rn "d1-411a:error" web/js/407f-engineering-adapter.js` returns nothing. `dataset.errorMessage` is never rendered (no CSS attr() rule, no JS reader).

**Student impact:** The student drags an event, changes a category or switches specialty timeline; the projection update throws; the board silently does not change. No toast, no banner, no screen-reader announcement — only a console line. The student assumes the app ignored them and repeats the action, or assumes their edit was saved when it was not. Contrast with the collision path, which correctly toasts via onKernelRejected (adapter:3898-3907).

**Proposed fix:** In web/js/407f-engineering-adapter.js, alongside the existing registrations at line 3945, add:
  const onKernelError=(event)=>{
    const node=event.target;
    const message=String(node?.dataset?.errorMessage||"We could not update your timeline. Your last working version is still here.");
    canvasController?.setUiState((state)=>({...state,liveAnnouncement:message}));
    bridge.toast(message);
    announceGlobal(message);
  };
  document.addEventListener("d1-411a:error",onKernelError);
and mirror the teardown next to line 1884: `document.removeEventListener("d1-411a:error",onKernelError);` (declare `let onKernelError=()=>{};` beside `let onKernelRejected=()=>{};` at line 1533). This reuses the student-safe copy already written at canvas.js:1683 and kernel-host.js:1711 and never surfaces `error.code`.

### E-03 — D-04 overlap banner fires on the FIRST successful render of a routine timeline and tells the student to "move an item" on the Home preview, which is deliberately non-interactive
**Severity:** MAJOR · **Location:** `web/js/d1-411a/kernel-host.js:20`

**Evidence:** kernel-host.js:20:
  const INITIAL_LAYOUT_RECOVERY_MESSAGE="Some items overlap. Your timeline is still available; move an item slightly to improve the layout.";
kernel-host.js:153-155:
  export function failSoftRenderMessage(warnings,recoveredExistingLayout){
    const list=…;
    if(recoveredExistingLayout)return INITIAL_LAYOUT_RECOVERY_MESSAGE;
kernel-host.js:275 (inside _mount, i.e. first paint):
  const rendered=await this._renderRecord(record,{allowExistingLayoutRecovery:true});
kernel-host.js:337 sets recoveredExistingLayout=true whenever that recovery path is taken, and 387-391 unhides the banner:
  const studentMessage=failSoftRenderMessage(failSoftWarnings,recoveredExistingLayout);
  if(studentMessage){ warning.hidden=false; warning.textContent=studentMessage; }

Home is explicitly non-interactive — 407f-engineering-adapter.js:3390:
  const interactive=surface!=="home"&&store.entitlement.canMutate===true;
and the surface is chosen at 3368 (`… : "home"`), mounted by renderHomePreview at 3420.

**Student impact:** Per D-04 a routine 15-event timeline renders only via EXISTING_LAYOUT_OVERLAP_RECOVERED. So the very first thing a student sees after finishing the builder is a white banner pinned over the bottom-right of their finished timeline saying their work overlaps and telling them to fix it — on Home, where nothing is draggable, so the instruction is impossible to follow. It has no dismiss control and no auto-hide, so it sits on top of the board on every visit. It reads as "your timeline is broken" at the exact moment the product should feel finished.

**Proposed fix:** Two surgical changes, host layer only.
(1) kernel-host.js:275 — do not narrate a recovery the student did not cause. Pass a flag through so first-paint recovery is silent:
  const rendered=await this._renderRecord(record,{allowExistingLayoutRecovery:true,announceRecovery:false});
and in _renderRecord's signature add `announceRecovery=true`, then at line 387 use:
  const studentMessage=failSoftRenderMessage(failSoftWarnings,recoveredExistingLayout&&announceRecovery);
The update path (line 455, `_renderRecord(next,{allowExistingLayoutRecovery:true})`) keeps the default and still tells the student when THEIR change caused it.
(2) If the message must remain on first paint, gate it on interactivity and reword: in _renderRecord, `if(studentMessage&&(this._record?.interactive===true))` and change line 20 to "We nudged a few items apart so every label stays readable." — a statement of what the product did, not a chore for the student.

### E-04 — Entitlement denial reasons are internal WordPress/config strings and are rendered verbatim into the student-facing banner, header tooltip and toasts
**Severity:** MAJOR · **Location:** `web/js/uxr-002/entitlement.js:221`

**Evidence:** entitlement.js reason strings:
  146: reason:rule.reason||"Individual Timeline entitlement override.",
  163: label:`Eligible WordPress role: ${id}.`,   (becomes `reason` via line 205: reason:rule.reason||selected.label)
  221: reason:"No eligible WordPress role, 360 membership, override, cohort, or promotion."
  286: reason="Timeline entitlement could not be verified.";
entitlementStatusMarkup (457-477) passes it straight through: `reason:access.reason`.

407f-engineering-adapter.js:1619-1626 puts it in the header badge tooltip:
  const status=entitlementStatusMarkup(access);
  badge.innerHTML=`<span>${escapeMarkup(status.label)}</span><small>${escapeMarkup(status.allowance)}</small>`;
  badge.title=status.reason;
and :1646 renders it as body copy in a persistent banner prepended to <main>:
  const bannerMarkup=`<strong>${escapeMarkup(status.label)}</strong><span>${escapeMarkup(status.reason)} ${escapeMarkup(consequence)}</span>`;
It is also toasted at adapter lines 1744, 3523, 3580, 6348: `bridge.toast(store.entitlement.reason);`

**Student impact:** A student without access sees, across the top of every screen: "Access unavailable — No eligible WordPress role, 360 membership, override, cohort, or promotion. Timeline creation and export are disabled." That is admin configuration vocabulary (WordPress role, cohort, promotion, override), it blames the student for a provisioning state they cannot see, and it offers no next step. An eligible student's header tooltip reads "Eligible WordPress role: subscriber." Every blocked click also toasts the same sentence.

**Proposed fix:** Keep `reason` as the diagnostic field and add a separate student-facing sentence. In entitlement.js, extend entitlementStatusMarkup (line 457) to return a `studentReason` derived from `access.denialCode`, not from `reason`:
  const STUDENT_REASONS={NO_MATCHING_ENTITLEMENT:"Timeline Builder is part of Mission:Residency 360.",ENTITLEMENT_EXPIRED:"Your Timeline Builder access has ended.",ENTITLEMENT_DISABLED:"Timeline Builder is turned off for your account.",ENTITLEMENT_GLOBALLY_DISABLED:"Timeline Builder is temporarily unavailable.",PRODUCTION_ENTITLEMENT_UNVERIFIED:"We could not confirm your access just now.",PRODUCTION_ENTITLEMENT_MALFORMED:"We could not confirm your access just now."};
  studentReason:STUDENT_REASONS[access.denialCode]||"We could not confirm your Timeline Builder access."
Then in 407f-engineering-adapter.js use `status.studentReason` at line 1646 and at line 1624 (`badge.title`), and replace the four `bridge.toast(store.entitlement.reason)` calls (1744, 3523, 3580, 6348) with `bridge.toast(entitlementStatusMarkup(store.entitlement).studentReason)`. Append a route out to the banner copy ("Contact support or view membership options") since `consequence` currently ends the sentence with a dead end.

### E-05 — 24 adapter call sites toast the raw JavaScript error.message, exposing internal codenames like "D1-411A kernel projection is unavailable." and "Protected D1-409H-A1 kernel was not loaded."
**Severity:** MAJOR · **Location:** `web/js/407f-engineering-adapter.js:6198`

**Evidence:** `grep -c "bridge.toast(String(error?.message||error))" web/js/407f-engineering-adapter.js` → 24, at lines 2946, 2960, 3396, 3700, 4045, 4057, 4063, 4129, 4341, 4372, 4455, 4475, 4485, 4502, 4507, 4528, 4545, 4690, 4821, 4847, 6109, 6198, 6296, 6311. Line 6198 is the intake host: `onError:(error)=>bridge.toast(String(error?.message||error)),` — the first-run CV upload path. Line 3396 is inside mountBuilderPreview's catch, which wraps the kernel projection.

bridge.toast is index.html:3286 `function toast(msg){const t=$('#toast');t.textContent=msg;…}` — the raw string goes straight into the visible toast.

Messages reachable through those catches, read verbatim from source:
  kernel-host.js:252 and :359/:365  throw new Error("D1-411A kernel projection is unavailable.");
  kernel-host.js:267  throw new Error("Protected D1-409H-A1 kernel was not loaded.");
  kernel-host.js:263  new Error("Canonical timeline frame failed to load.")
  kernel-host.js  "Timeline media recovery exceeded the safe omission limit.", "The export preview kernel is not mounted.", "The exported artifact does not match the mounted Export preview.", "The same-DOM PNG could not be resized."
  advanced-studio.js:607  throw new Error("A mode-switch plan is required.");
  export-engine.js:90  throw new Error("TimelineArtifact not found.");

**Student impact:** When anything goes wrong the student gets a 2.6-second toast reading "D1-411A kernel projection is unavailable." or "Protected D1-409H-A1 kernel was not loaded." or "TimelineArtifact not found." They cannot act on any of it, it looks like the product broke at a level they should never see, and it destroys confidence in a tool they are trusting with their residency application.

**Proposed fix:** Add one translator next to `announceGlobal` in 407f-engineering-adapter.js and route all 24 sites through it — a mechanical find/replace of `bridge.toast(String(error?.message||error))` with `toastError(error)`:
  const STUDENT_ERROR_COPY={
    RENDER:"We could not update your timeline just now. Your saved work is safe — try that change again.",
    EXPORT:"That export could not be produced. Your timeline is unchanged; please try again.",
    MEDIA:"That image could not be added. Try a PNG, JPG, WEBP or GIF under the size limit."
  };
  const toastError=(error,kind="RENDER")=>{
    console.error("Timeline action failed",{code:String(error?.code||error?.name||"UNKNOWN"),message:String(error?.message||error)});
    const message=STUDENT_ERROR_COPY[kind];
    bridge.toast(message);
    announceGlobal(message);
  };
Pass kind:"EXPORT" at the export sites (4821, 4847, 6296, 6311) and kind:"MEDIA" at the media sites (4455, 4475, 4485, 4502, 4507, 4528). The raw message stays in console.error for support.

### E-06 — Intake writes the raw adapter error.message into state.fileError, which is rendered as a red field error under the CV dropzone
**Severity:** MAJOR · **Location:** `web/js/uxr-002/intake.js:826`

**Evidence:** intake.js:826 (IntakeStateMachine.read catch):
  this.dispatch({type:"EXTRACTION_ABORTED",errorCode:String(error?.code||"ADAPTER_ERROR"),errorMessage:String(error?.message||"The document could not be read safely.")});
intake.js:426-431 (reducer) puts the student back on the upload stage and stores that raw text as the field error:
  case"EXTRACTION_ABORTED":
    state.stage=INTAKE_STAGES.UPLOAD;
    state.progressIndex=0;
    state.failure=null;
    state.fileError=action.errorMessage||null;
intake.js:906 (uploadMarkup) renders it verbatim:
  ${state.fileError?`<p class="field-error" role="alert">${escapeHtml(state.fileError)}</p>`:""}

The messages that land there come from intake-d1-408-adapter.js and are internal:
  :284  new TypeError("A D1-408 extraction candidate is required.")
  :315  throw new TypeError("A CV intelligence candidate is required.")
  :398  throw new TypeError("pdfExtractor must be a function.")
  :504  throw new TypeError("A local intake adapter is required.")
  :537  throw new Error("Timeline source authorization did not return an object ID.")
  :541  throw new Error("Timeline source upload could not be confirmed.")
The same error is then rethrown (intake.js:827) and toasted raw by adapter:6198.

**Student impact:** A first-time student uploads their CV — the single highest-intent action in the product. If the upload/authorization path fails they are bounced back to the dropzone with a red error reading "Timeline source authorization did not return an object ID." or "pdfExtractor must be a function.", plus a duplicate toast of the same text. Note the good copy already exists two constants away (INTAKE_COPY.unreadable, INTAKE_COPY.empty) and is bypassed for this branch.

**Proposed fix:** Never let an internal message reach `state.fileError`. In intake.js:826 replace the message with a mapped, student-safe line and keep the code for diagnostics:
  const code=String(error?.code||"ADAPTER_ERROR");
  const STUDENT_INTAKE_ERRORS={NO_FILE:"Choose a PDF or DOCX to continue.",UNSUPPORTED_FILE:"That file type is not supported. Upload a PDF or DOCX.",FILE_TOO_LARGE:"That file is larger than 20MB. Export a smaller PDF and try again."};
  this.dispatch({type:"EXTRACTION_ABORTED",errorCode:code,errorMessage:STUDENT_INTAKE_ERRORS[code]||"We could not read that document. Try uploading it again, or use the guided builder."});
(`errorCode` is already stored separately at line 431, so support diagnostics are unaffected.) Also add a "Use the guided builder instead" button beside the error in uploadMarkup:906 so the student is never stranded — failureMarkup at intake.js:913-925 already offers exactly that pair of buttons for the unreadable/empty branches.

### E-07 — The global toast is not a live region — every confirmation and every error message is silent for screen-reader users and auto-dismisses in 2.6s with no dismiss control
**Severity:** MAJOR · **Location:** `web/index.html:741`

**Evidence:** index.html:741:
  <div id="toast"></div>
No role, no aria-live, no aria-atomic.
index.html:3286:
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600)}
index.html:280-282 confirms it is a real visible surface: `#toast{position:fixed;bottom:36px;left:50%;…}` / `#toast.on{transform:translate(-50%,0);opacity:1}`.

The shell does have working live regions elsewhere — index.html:739 `<div id="globalLive407F" class="sr-only" role="status" aria-live="polite" aria-atomic="true">` driven by announceGlobal (407f-engineering-adapter.js:6221-6226) — but `bridge.toast` never calls it. Toast-only messages (adapter 2347 "Media placed on timeline", 2536 "Media removed from timeline", 2941 "Progress saved. Resume anytime from Home.", 2997/3027/3037 explanation add/update/delete, 3086, 3113, 3182, 3729, 3782, and all 24 raw-error sites) are announced nowhere.

**Student impact:** A blind or low-vision IMG gets no feedback at all for most actions: media placed, explanation saved, progress saved, and every failure. WCAG 2.2 4.1.3 Status Messages fails. Sighted keyboard users also lose errors after 2.6 seconds with no way to re-read or dismiss them (WCAG 2.2.1).

**Proposed fix:** Two edits.
(1) index.html:741 → `<div id="toast" role="status" aria-live="polite" aria-atomic="true"></div>`.
(2) index.html:3286 — clear before writing so repeated identical messages re-announce, and hold errors longer:
  function toast(msg,opts){const t=$('#toast');t.textContent='';clearTimeout(toastT);requestAnimationFrame(()=>{t.textContent=msg;t.classList.add('on');toastT=setTimeout(()=>t.classList.remove('on'),(opts&&opts.error)?6000:2600)})}
Then pass `{error:true}` from the `toastError` helper proposed in E-05. If a role change on #toast risks double-announcement with globalLive407F, the alternative one-liner is to leave the markup alone and have `toastError` call `announceGlobal(message)` as well (it already exists at adapter:6221) — but the plain confirmations still need (1).

### E-08 — §12 last-good-render retention is not implemented: no "Updating your timeline…" class of copy exists anywhere, and both refresh overlays are full-bleed opaque wipes
**Severity:** MAJOR · **Location:** `web/js/d1-411a/kernel-host.js:256`

**Evidence:** `grep -rn "Updating your timeline\|Organizing your events\|Refreshing the layout" web/` returns nothing — none of the required §12 strings exist in the tree.

The only kernel loading state is a full-cover opaque panel, kernel-host.js:256-260:
  output[data-loading]{position:absolute;inset:0;display:grid;place-items:center;background:#c8d8e1;color:#19334f;font:700 13px/1.5 system-ui,sans-serif;letter-spacing:.03em}
  :host([data-ready="true"]) output[data-loading]{display:none}
  …<output data-loading role="status">Preparing your timeline…</output>
It is bound to data-ready, so anything that clears data-ready (see E-01) wipes the board rather than dimming it.

Export repeats the pattern. export-screen.js:691-693:
  <div class="export-preview-loading" role="status" data-export-preview-loading …>
    <span class="spinner" aria-hidden="true"></span><span>Rendering preview…</span>
and 407f-upgrade.css:6066-6077 makes it a full-bleed wash over the retained preview:
  .export407FHost .export-preview-loading{align-items:center;background:rgba(239,237,232,.9);…inset:0;justify-content:center;position:absolute;z-index:5}
(the inactive uxr-002.css:386 version is a small pill — the 407F override is what ships.)

**Student impact:** Every audience switch, theme change or specialty-variant switch flashes the student's finished timeline out behind a near-opaque wash captioned "Rendering preview…" — engine vocabulary, and visually a wipe rather than a refresh. On the kernel surfaces the same class of overlay is what strands the student in E-01. The product never says, in the student's language, "your timeline is still here, we're just re-laying it out."

**Proposed fix:** Three small edits, no architecture change.
(1) kernel-host.js:260 — change the first-paint copy to "Organizing your events…" and add a second, subtle state used for re-renders. Add to the style block:
  output[data-loading][data-mode="refresh"]{background:rgba(200,216,225,.42);backdrop-filter:blur(1px);align-content:end;padding-bottom:16px}
and in updateProjection, before awaiting _renderRecord, set `const l=this.shadowRoot.querySelector("[data-loading]");if(l){l.dataset.mode="refresh";l.textContent="Updating your timeline…";}` and clear `delete l.dataset.mode` on completion — while leaving `data-ready="true"` so the last-good render stays visible underneath.
(2) export-screen.js:692 — "Rendering preview…" → "Updating your timeline…".
(3) 407f-upgrade.css:6068 — `background:rgba(239,237,232,.9)` → `background:rgba(239,237,232,.35)` and add `backdrop-filter:blur(1px)`, so the preview stays readable through the 400ms (EXPORT_PREVIEW_LOADING_MAX_MS, export-screen.js:18) refresh.

### E-09 — Zero-event Edit Timeline shows a dark abstract box, and zero-event Home shows three grey bars — neither resembles the artifact the student is building, though a ghost example board already exists and is unused
**Severity:** MAJOR · **Location:** `web/js/uxr-002/canvas.js:1368`

**Evidence:** canvas.js:1368-1380 (used whenever events.length===0 — canvas.js:1455 `let board = emptyBoardMarkup(viewState);`, only replaced at 1458 `if ((document?.events || []).length)`):
  function emptyBoardMarkup(state) {
    …<div class="canvas-empty-board" role=…>
      <div class="canvas-axis-placeholder" aria-hidden="true"></div>
      <div class="canvas-empty-message">
        <p>No events yet — add one below or use the Builder.</p>
        <button type="button" data-canvas-action="open-builder">Open Builder</button>
Styled dark by the shipping stylesheet, 407f-upgrade.css:3504-3527:
  .canvas407FHost .canvas-empty-board{…background:radial-gradient(ellipse at 50% 30%,#1c2946 0%,#131c31 55%,#0d1424 100%);…}
  .canvas407FHost .canvas-axis-placeholder{border-top:2px solid var(--cy);…}

Home's zero-event state is index.html:1192:
  if(homeBoard)homeBoard.innerHTML='<div class="homePreviewPlaceholder" aria-hidden="true"><span></span><i></i><i></i><i></i></div>';
(three grey bars on a dark grid — 407f-upgrade.css:490-529) and renderHomePreview bails before the kernel ever mounts, 407f-engineering-adapter.js:3420-3421:
  const renderHomePreview=({force=false}={})=>{
    if(!(store.document?.events||[]).length)return false;

A real, light, Keynote-styled example board already exists and is already exported: web/js/uxr-002/preview.js:51 canonicalBoardPreview(document,{ghost:true}) renders exampleDocument() (preview.js:9-49: Medical school / US clinical rotations / Research / Step 2 CK) through the real board renderer; preview.js:93 aliases it as simpleBoardPreview. The superseded uxr-002 Home uses it correctly (home.js:59-60) with the copy "This is what you're building." The shipping 407F shell uses neither.

**Student impact:** D-05 confirmed and extended. A brand-new student's first two screens both show abstract dark rectangles that look like a failed render rather than an empty document. Nothing on either screen shows what a finished timeline looks like, so the guided builder has no visible payoff. The moment the first event lands, Edit Timeline flips from a dark box to the light protected board — the student reads that as the app changing under them.

**Proposed fix:** Reuse the ghost board that already exists; no new rendering code.
(1) canvas.js — add `import {canonicalBoardPreview} from "./preview.js";` beside the existing `./board-renderer.js` import (line 2), and in emptyBoardMarkup (1368) replace `<div class="canvas-axis-placeholder" aria-hidden="true"></div>` with `<div class="canvas-empty-ghost" aria-hidden="true">${canonicalBoardPreview(null,{ghost:true,label:"Example timeline"})}</div>`, and change the copy to "Your timeline starts here. Add your first event, or let the Builder do it for you."
(2) 407f-upgrade.css:3504 — drop the dark radial gradient for the light artifact ground (`background:linear-gradient(165deg,#F5F7FB,#E9EEF6)`) so the empty state and the real board share one visual identity, and add `.canvas407FHost .canvas-empty-ghost{position:absolute;inset:0;opacity:.28;pointer-events:none}` with `position:relative` on `.canvas-empty-board`.
(3) index.html:1192 — replace the homePreviewPlaceholder bars with the same ghost markup so Home and Edit Timeline agree.

### E-10 — RESPONSIVE_BANNER is defined and never rendered by the shipping shell — on a phone the Edit Timeline toolbar is display:none with no explanation
**Severity:** MAJOR · **Location:** `web/js/uxr-002/responsive.js:42`

**Evidence:** responsive.js:42:
  export const RESPONSIVE_BANNER = "Editing needs a larger screen.";
attached to the tablet and phone contracts at :273 and :285 (`banner:RESPONSIVE_BANNER`), and rendered by :424-425:
  if (!contract.banner) return "";
  return `<div class="responsive-accessibility-banner" role="status" data-responsive-banner>${escapeHtml(contract.banner)}</div>`;

But `grep -rn "responsive-accessibility-banner\|data-responsive-banner" web/js web/index.html web/styles` (excluding tests) matches only that one line in responsive.js plus one style rule in the inactive uxr-002.css:51 — the 407F adapter never calls it. Its onChange handler only writes attributes, 407f-engineering-adapter.js:6478-6486:
      const active=document.querySelector("section[data-view].live");
      if(active){
        active.dataset.responsiveScreen=screen;
        active.dataset.responsiveTier=model.tier.id;
        active.dataset.responsiveMode=model.screens[screen]?.contentMode||"full";
      }
Meanwhile the phone tier silently removes the controls, 407f-upgrade.css:7135-7137:
  html[data-responsive-tier="phone"] .canvas407FHost .canvas-toolbar{
    display:none;
  }
The rail button is never gated (index.html:527 `<button class="rtab" data-v="canvas">Edit Timeline</button>`).

**Student impact:** An IMG on a phone — a very common device for this audience — taps "Edit Timeline" and lands on a board with no toolbar, no zoom, no theme, no mode switch, and no sentence telling them why or what to do instead. It reads as a broken page, not as a desktop-only feature. Nothing tells them their work is safe or that Home/Builder/Export still work.

**Proposed fix:** Render the banner the module already produces. In 407f-engineering-adapter.js, inside the responsive onChange at line 6478, after setting the dataset attributes:
  const contract=model.screens[screen]||{};
  let notice=active.querySelector(":scope > [data-responsive-banner]");
  if(contract.banner){
    if(!notice){notice=document.createElement("div");notice.className="responsive-accessibility-banner";notice.setAttribute("role","status");notice.dataset.responsiveBanner="true";active.prepend(notice);}
    notice.textContent=contract.banner;
  }else notice?.remove();
and add the missing rule to web/styles/407f-upgrade.css (uxr-002.css:51 is not loaded by the shell):
  .responsive-accessibility-banner{padding:10px 16px;border-bottom:1px solid var(--edge2);background:rgba(255,179,64,.12);color:var(--em);font:700 12px/1.4 var(--num);letter-spacing:.06em;text-align:center}
Also reword responsive.js:42 so it tells the student what still works: "Editing your timeline needs a larger screen. You can still view it here, and add events in Builder."

### E-11 — Boot gate says "Loading local timeline…" (developer wording) and has no timeout or global error fallback, so a module that never executes leaves a permanent full-screen dead gate
**Severity:** MINOR · **Location:** `web/index.html:503`

**Evidence:** index.html:5 (synchronous, in <head>):
  <script>document.documentElement.classList.add('d1-hydrating')</script>
index.html:28-35:
  html.d1-hydrating body>*{visibility:hidden}
  #d1HydrationGate{display:none}
  html.d1-hydrating #d1HydrationGate{visibility:visible;display:grid;position:fixed;inset:0;z-index:1000;place-items:center;background:#05070d;color:#a9b7d0;font:700 12px/1.5 'Rajdhani',sans-serif;letter-spacing:.2em;text-transform:uppercase}
index.html:503:
  <div id="d1HydrationGate" role="status" aria-live="polite">Loading local timeline…</div>
The class is removed only on the success path — 407f-engineering-adapter.js:6506 `document.documentElement.classList.remove("d1-hydrating");` — and the good recovery panel at 6519-6547 runs only if `boot407FEngineeringAdapter()` REJECTS. `grep -rn "onerror\|unhandledrejection" web/index.html` finds only an <img> handler at 3289; there is no timeout anywhere (`grep -n "d1HydrationGate" web/js/*.js` → adapter:6521 only), and the sole entry point is a bare module tag, index.html:3318:
  <script type="module" src="./js/407f-engineering-adapter.js"></script>

**Student impact:** Every student reads "LOADING LOCAL TIMELINE…" on every boot — "local" is the storage-adapter name and reads as though their work is trapped on one machine. Worse, if the module 404s, is blocked by CSP (directly plausible given D-01/D-02) or fails to parse, the rejection handler never runs: the page stays hidden behind an all-caps grey line forever, with no Retry and no Return to Matrix. The excellent recovery panel that already exists ("Your Timeline needs a fresh connection.", Retry + Return to Matrix) is unreachable in exactly the failure mode most likely to hit production.

**Proposed fix:** Two edits.
(1) index.html:503 → `<div id="d1HydrationGate" role="status" aria-live="polite">Opening your timeline…</div>`.
(2) Make the existing recovery panel reachable. Extract the panel builder from 407f-engineering-adapter.js:6519-6547 into an exported `renderTimelineRecoveryGate(error)` and call it from a watchdog added in index.html just before the module tag at 3318:
  <script>window.__d1BootTimer=setTimeout(function(){if(document.documentElement.classList.contains('d1-hydrating')&&!document.getElementById('d1HydrationGate').classList.contains('d1Recovery'))document.dispatchEvent(new CustomEvent('d1:407f-engineering-error',{detail:{message:'BOOT_TIMEOUT'}}))},12000);
  window.addEventListener('error',function(e){if(e.target&&e.target.tagName==='SCRIPT')document.dispatchEvent(new CustomEvent('d1:407f-engineering-error',{detail:{message:'BOOT_SCRIPT_FAILED'}}))},true);</script>
and have the adapter clear `window.__d1BootTimer` at line 6506 next to the class removal, plus a `d1:407f-engineering-error` listener that paints the same panel. Same copy, same buttons, now reachable.

### E-12 — Media library empty state and action buttons use asset-management vocabulary ("asset reference", "Replace asset", "Delete asset") instead of the student's word, image
**Severity:** MINOR · **Location:** `web/js/uxr-002/media-library.js:207`

**Evidence:** media-library.js:203-208 (the empty state a first-time student sees on the Media tab, rendered into #media407F by 407f-engineering-adapter.js:2288-2292):
    ${items.length
      ?`<div class="media407FGrid">${cards}</div>`
      :`<div class="media407FEmpty">
        <strong>Add images to use on your timeline.</strong>
        <span>Upload once, then reuse the same asset reference.</span>
      </div>`}
and the per-card actions, media-library.js:177-178:
        <button type="button" data-media-replace="${escapeHtml(item.id)}">Replace asset</button>
        <button type="button" data-media-delete="${escapeHtml(item.id)}">Delete asset</button>
Also media-library.js:193 heading "Your timeline assets" and the badge text at 407f-engineering-adapter.js:2282-2284 ("PRIVATE · SECURELY SYNCED" / "LOCAL DEVICE ONLY").

**Student impact:** The Media tab is one of five top-level destinations and its empty state is the first thing a new student reads there. "Reuse the same asset reference" is a content-management concept, not a student concept, and it does not actually explain the useful behaviour (one upload can be placed on more than one timeline). "Delete asset" next to "Remove from timeline" is genuinely ambiguous about whether the file is being destroyed.

**Proposed fix:** Pure copy edits in web/js/uxr-002/media-library.js:
  :207  "Upload once, then reuse the same asset reference." → "Upload once — you can place the same image on any of your timelines."
  :193  "Your timeline assets" → "Your images"
  :177  "Replace asset" → "Replace image"
  :178  "Delete asset" → "Delete from library"  (disambiguates it from "Remove from timeline" on line 176)
  :192  `${durableOnline?"PRIVATE MEDIA":"LOCAL MEDIA"}` → `${durableOnline?"YOUR IMAGES · PRIVATE":"YOUR IMAGES · THIS DEVICE"}`
and at 407f-engineering-adapter.js:2283 change "LOCAL DEVICE ONLY" → "SAVED ON THIS DEVICE ONLY". No logic changes; the delete confirmation dialog at adapter:2454 should carry the same wording.

## LANE A — EDITOR INTERACTION ENGINE

SCOPE READ (all line references verified by opening the files at branch HEAD in /Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001/packages/mission-timeline):
- web/js/uxr-002/canvas.js (full installCanvas 1611-2494, renderCanvas 1455-1533, zoom model 236-270, keyboard 962-1080)
- web/js/d1-411a/kernel-host.js (element lifecycle 121-240, updateProjection 348-435, _installChildInteractions 436-635, _refreshHits 636-700, _applyAdvancedOverlay 767-1320, _beginGesture/_moveGesture/_endGesture 1472-1600, resize() 1600-1626, manager 1660-1790)
- web/js/uxr-002/advanced-studio.js (createMediaElement 925-980, group/aspect/layer model 1080-1500, rail 1694-1780, selection controls 1780-1850, installAdvancedStudioControls 1965-2207)
- web/js/407f-engineering-adapter.js (kernel event handlers 3731-3950, advancedHooks 4212-4520, canvas install 5398-5480, rail pointer/native drag 5843-6095, media library drag 2631-2670)
- web/styles/407f-upgrade.css (rail 5017-5085, responsive 5418-5445, RC1 direct-editor block 5518-5600), web/styles/uxr-002.css (289-291)

ARCHITECTURE FACTS THE LEAD MUST KNOW (they shape every Lane A fix):

1. THE EDIT CANVAS IS A CROSS-DOCUMENT IFRAME, SO MOST OF canvas.js's INTERACTION LAYER IS INERT.
renderResponsiveAdvancedBoard (407f-engineering-adapter.js:1484) always routes through kernelManager.render(), which emits `<d1-timeline-kernel>` (kernel-host.js:1742) hosting the protected master in a shadow-root iframe. Consequently, in the shipping path:
  - canvas.js onPointerDown/onPointerMove/onPointerUp (2340-2445) never fire — they target `[data-canvas-event]`, which only exists in the legacy `interactiveBoardSvg` path (canvas.js:1485).
  - renderSelectionHandles / renderContextualToolbar are fed `selectedSceneEvent`, which is always null because the manager returns `scene:{events:[]}` (kernel-host.js:1749).
  - installEffectiveHitTargets (canvas.js:1694-1808) finds no targets; the 44px hit-proxy machinery is dead.
  - onWheel, onDoubleClick, onContextMenu and the middle-button pan never see events over the board.
ALL real direct manipulation lives in kernel-host.js (`_beginGesture` for protected furniture, `_applyAdvancedOverlay` for student-added objects). Any Lane A fix must go there, not into canvas.js's drag code.

2. patchPersistentCanvas IS THE SINGLE ROOT CAUSE BEHIND A2 AND A8.
canvas.js:1630-1694 keeps `.canvas-screen` > `.canvas-stage` > `.canvas-application` > `<d1-timeline-kernel>` alive (kernelToken is stable per surface/document/audience — kernel-host.js:1722-1728), which is why zoom does NOT remount the kernel. But it deletes and re-creates EVERY other child of the screen and of the application on every single render (1667, 1675). That destroys the toolbar (zoom %), the Advanced sidebar (text/typography inputs), the add-event popover and the inline editors. The codebase already contains two mitigations that prove the team knew: the onInput branches at canvas.js:2174-2189 that update `state` without rendering, and the explicit refocus in onAssetSearch (407f-engineering-adapter.js:4278). The fix pattern for any focus-losing control is one of those two, not a rewrite of patchPersistentCanvas.

3. WHAT IS GENUINELY IMPLEMENTED (do not rebuild these):
Grouping/ungrouping with group bounding box and proportional child scaling (kernel-host.js:1150-1220 + advanced-studio.js:1307-1340), marquee multi-select (kernel-host.js:1285-1310), snapping to board centre/edges and to other objects' edges/centres with visible guides and alt-to-disable (kernel-host.js:1130-1150), 8-handle resize with aspect lock on corners, keyboard nudge 1px/10px with shift (kernel-host.js:1272-1282), Delete/Cmd-D duplicate, layer bring-forward/send-backward (advanced-studio.js:1435-1490, surfaced via MEDIA_CONTEXT_ACTIONS), double-click-to-edit contenteditable text with Escape-revert and Cmd-Enter-commit, click-to-add from the rail (advancedHooks().onAction), ghost-based drag-to-canvas with correct drop coordinates (407f-e

| ID | Sev | Finding | Location |
|---|---|---|---|
| A1 | BLOCKER | Selecting a text object collapses its font to the minimum size and flags it as overflowing — resize handles are counted as text content | `packages/mission-timeline/web/js/d1-411a/kernel-host.js:1051` |
| A2 | BLOCKER | The editable zoom percentage field is unusable — every keystroke destroys and rebuilds the toolbar node | `packages/mission-timeline/web/js/uxr-002/canvas.js:2167` |
| A3 | BLOCKER | Uploaded media tiles in the left asset rail have no thumbnail size constraint and render at image aspect/natural size | `packages/mission-timeline/web/styles/407f-upgrade.css:5565` |
| A4 | MAJOR | Text alignment left/center/right does nothing, and the vertical-alignment control moves text horizontally instead | `packages/mission-timeline/web/js/d1-411a/kernel-host.js:950` |
| A5 | MAJOR | Milestone flags, the title plaque, photo tiles, the logo mount and the sticky note are selectable but cannot be dragged — _beginGesture only implements arrows, axis, colour key and profile card | `packages/mission-timeline/web/js/d1-411a/kernel-host.js:1542` |
| A6 | MAJOR | All direct manipulation of protected objects is silently switched off whenever the board renders below 40% scale | `packages/mission-timeline/web/js/d1-411a/kernel-host.js:1480` |
| A7 | MAJOR | Zoom has no keyboard shortcuts, and ctrl/cmd+wheel zoom is dead over the board because the listener is on the parent document, not the kernel iframe | `packages/mission-timeline/web/js/uxr-002/canvas.js:2335` |
| A8 | MAJOR | Typing in the Advanced Studio Text field loses focus after every character — the inspector panel is rebuilt on each keystroke | `packages/mission-timeline/web/js/407f-engineering-adapter.js:4487` |
| A9 | MAJOR | Uploaded images are placed on the board with an unbounded height, so tall photos overflow the 1080px board and land at a negative Y | `packages/mission-timeline/web/js/uxr-002/advanced-studio.js:940` |
| A10 | MINOR | Uploaded/text/shape tiles in the rail advertise drag-to-canvas but every drop handler rejects their payload | `packages/mission-timeline/web/js/uxr-002/advanced-studio.js:1768` |

### A1 — Selecting a text object collapses its font to the minimum size and flags it as overflowing — resize handles are counted as text content
**Severity:** BLOCKER · **Location:** `packages/mission-timeline/web/js/d1-411a/kernel-host.js:1051`

**Evidence:** markSelected() appends the 8 resize handles as CHILDREN of the selected node (kernel-host.js:1119-1124):
      if(selected&&record.editable){
        for(const handle of ["nw","n","ne","e","se","s","sw","w"]){
          const control=childDocument.createElement("button");
          control.type="button";control.className="d1411aHandle";...;selected.append(control);

The overlay stylesheet (kernel-host.js:950) positions those handles OUTSIDE the node box:
  .d1411aHandle{...position:absolute;width:28px;height:28px;...}
  .d1411aHandle[data-handle="se"]{bottom:-15px;right:-15px}
  .d1411aHandle[data-handle="e"]{right:-15px;top:calc(50% - 14px)}
and `.d1411aAdvancedText` is `position:absolute; overflow:hidden`, so it is the handles' containing block AND a scroll container — the handles add ~15px of scrollable overflow on the right and bottom.

fitTextNode() then measures exactly that (kernel-host.js:1044-1059):
      if(node.dataset.fitMode==="auto"){
        while(size>minimum&&(node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1)){
          size=Math.max(minimum,size-1);
          node.style.fontSize=`${size}px`;
        }
      }
      const overflow=node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1;
      node.dataset.overflow=String(overflow);

fitTextNode is re-run on every gesture frame for the selected node (kernel-host.js:1216 `fitTextNode(gesture.node);`). Default fitMode is "auto" (kernel-host.js:989) and default minFontSize is 10 (kernel-host.js:991).

**Student impact:** The student clicks a text box and nudges it one pixel. The text instantly shrinks from 24px to 10px and gets a red dashed 'Text does not fit' outline that never clears, because the outline condition is permanently true while the object is selected. Resizing the box larger does not fix it. This makes every text object in Advanced Studio look broken the moment it is touched.

**Proposed fix:** In kernel-host.js, make fitTextNode ignore the selection chrome. Replace the body of `const fitTextNode=(node)=>{` (line 1044) with a version that hides handles across the measurement:

    const fitTextNode=(node)=>{
      if(!node?.classList?.contains("d1411aAdvancedText")||node.isContentEditable)return;
      const chrome=[...node.querySelectorAll(".d1411aHandle")];
      for(const control of chrome)control.style.display="none";
      try{
        const requested=Math.max(10,finite(node.dataset.requestedFontSize,24));
        const minimum=clamp(finite(node.dataset.minFontSize,10),8,requested);
        let size=requested;
        node.style.fontSize=`${size}px`;
        if(node.dataset.fitMode==="auto"){
          while(size>minimum&&(node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1)){
            size=Math.max(minimum,size-1);
            node.style.fontSize=`${size}px`;
          }
        }
        const overflow=node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1;
        node.dataset.overflow=String(overflow);
        node.title=overflow?"Text does not fit. Resize the text box or choose Auto fit text.":"";
      }finally{
        for(const control of chrome)control.style.display="";
      }
    };

No protected-kernel bytes touched; this is entirely host overlay code.

### A2 — The editable zoom percentage field is unusable — every keystroke destroys and rebuilds the toolbar node
**Severity:** BLOCKER · **Location:** `packages/mission-timeline/web/js/uxr-002/canvas.js:2167`

**Evidence:** canvas.js:2167-2170 handles typing in the zoom box by doing a full canvas re-render:
    if(event.target.matches?.("[data-canvas-zoom-percent]")){
      const value=Number(event.target.value);
      if(Number.isFinite(value))setState({...state,zoom:updateCanvasZoom(state.zoom,{kind:"direct",percent:value}),liveAnnouncement:`Zoom ${Math.min(400,Math.max(25,Math.round(value)))} percent`});
      return;
    }

setState -> render() -> patchPersistentCanvas(markup), which deletes and re-creates every child of `.canvas-screen` other than `.canvas-stage` (canvas.js:1673-1681):
    const nextStageIndex=[...nextScreen.children].indexOf(nextStage);
    for(const child of [...currentScreen.children]){
      if(child!==currentStage)child.remove();
    }
The zoom input lives in `renderCanvasToolbar(...)`, which renderCanvas emits as a direct child of `.canvas-screen` (canvas.js:1518), so the live <input type="number" data-canvas-zoom-percent> (canvas.js:1181) is detached mid-keystroke.

updateCanvasZoom also clamps immediately: `const percent = Math.min(400,Math.max(25,Math.round(requested)));` (canvas.js:262).

Contrast with the very next branches in the same onInput handler (canvas.js:2174-2189), which deliberately mutate `state` WITHOUT re-rendering for `[data-inline-label-input]`, `[data-advanced-inline-text-input]` and `versionName` — the pattern exists, the zoom field just does not use it.

**Student impact:** To type "150" the student presses "1": the value is clamped to 25, the input node is destroyed and replaced with a fresh one showing 25, focus is lost, and the board jumps to 25%. The second and third keystrokes go nowhere. The 'editable percentage' zoom control required by the ticket cannot be used at all — only the −/+/Fit buttons work.

**Proposed fix:** 1) In canvas.js replace the onInput zoom branch (line 2167) with an in-place update that does not re-render:

    if(event.target.matches?.("[data-canvas-zoom-percent]")){
      const value=Number(event.target.value);
      if(!Number.isFinite(value)||value<25||value>400)return;
      state={...state,zoom:updateCanvasZoom(state.zoom,{kind:"direct",percent:value})};
      const application=root.querySelector?.(".canvas-application");
      if(application){
        application.style.width=`${1920*state.zoom.percent/100}px`;
        application.style.maxWidth="none";
        application.dataset.zoomMode="percent";
        application.dataset.zoomPercent=String(state.zoom.percent);
      }
      onStateChange(state);
      return;
    }

(The inline width/data attributes mirror exactly what renderCanvas writes at canvas.js:1472-1487, so the kernel's own ResizeObserver re-fits the iframe without a projection re-render.)

2) Add a commit-on-blur listener so the toolbar re-syncs to the clamped value. Next to the other registrations at canvas.js:2450-2459 add:
    const onChange=(event)=>{
      if(!event.target.matches?.("[data-canvas-zoom-percent]"))return;
      setState({...state,zoom:updateCanvasZoom(state.zoom,{kind:"direct",percent:Number(event.target.value)})});
    };
    root.addEventListener("change",onChange);
and the matching `root.removeEventListener("change",onChange);` in destroy() (canvas.js:2487).

### A3 — Uploaded media tiles in the left asset rail have no thumbnail size constraint and render at image aspect/natural size
**Severity:** BLOCKER · **Location:** `packages/mission-timeline/web/styles/407f-upgrade.css:5565`

**Evidence:** The rail renders uploaded media as a plain <button> with a raw <img>, and gives it NO class (advanced-studio.js:1765-1772):
        const preview=url
          ?`<img src="${escapeHtml(url)}" alt="">`
          :`<span class="advanced-visual-asset-preview" aria-hidden="true">...`;
        ...
        return`<button type="button"${dragAttributes}${mediaAttributes} data-advanced-select-object ...>${preview}<span>...</span><small>...</small></button>`;

The only rule that sizes a thumbnail is scoped to `.advanced-visual-asset` (407f-upgrade.css:5565-5577):
  .canvas407FHost .advanced-visual-asset img,
  .canvas407FHost .advanced-visual-asset-preview{
    ...height:62px;...object-fit:cover;width:100%;
  }

`.advanced-visual-asset` is only emitted by insertAssetTile (advanced-studio.js:1725-1728) for the BUILT-IN shape/icon/flag tiles. The uploaded-media buttons match only `.canvas407FHost .advanced-asset-rail-list.advanced-visual-asset-grid button` (407f-upgrade.css:5550-5562), which sets `min-height:104px;overflow:hidden` but no img sizing, and there is no global `img{max-width:100%}` reset in web/styles/ (grep over 407f-upgrade.css, uxr-002.css, shell.css, components.css finds none).

**Student impact:** After uploading a photo, its rail tile has no height cap: the tile grows to whatever the image's aspect (or natural pixel height) dictates. A portrait phone photo produces a very tall tile that pushes every other asset off-screen, which is precisely the 'enormous vertical previews' symptom in the ticket. `overflow:hidden` on the button clips nothing useful because the button itself is the box that grew.

**Proposed fix:** One-selector CSS addition in web/styles/407f-upgrade.css at line 5565 — add the rail-list image to the existing thumbnail rule:

  .canvas407FHost .advanced-visual-asset img,
  .canvas407FHost .advanced-asset-rail-list.advanced-visual-asset-grid button img,
  .canvas407FHost .advanced-visual-asset-preview{
    align-items:center;
    background:linear-gradient(145deg,#19263a,#0b111d);
    border-radius:5px;
    color:var(--em);
    display:flex;
    font:800 21px/1 var(--num);
    height:62px;
    justify-content:center;
    object-fit:cover;
    width:100%;
  }

Optionally also add `max-height:132px` to `.canvas407FHost .advanced-asset-rail-list.advanced-visual-asset-grid button` (line 5550) as a belt-and-braces cap.

### A4 — Text alignment left/center/right does nothing, and the vertical-alignment control moves text horizontally instead
**Severity:** MAJOR · **Location:** `packages/mission-timeline/web/js/d1-411a/kernel-host.js:950`

**Evidence:** The advanced text node is a ROW flex container (kernel-host.js:950):
  #d1411a-advanced-overlay .d1411aAdvancedText{background:transparent;border:0;color:#191c21;display:flex;font:400 24px/1.2 Inter,sans-serif;min-width:32px;overflow:hidden;overflow-wrap:anywhere;white-space:pre-wrap}

makeElement then writes both alignment axes onto it (kernel-host.js:986-988):
        node.style.textAlign=String(item.alignment||"left");
        node.style.lineHeight=String(clamp(finite(item.lineHeight,1.2),.8,2));
        node.style.justifyContent=item.verticalAlign==="top"?"flex-start":item.verticalAlign==="bottom"?"flex-end":"center";

In a row flex container the main axis is HORIZONTAL, so `justify-content` (fed from verticalAlign) is what actually positions the text left/centre/right, while the anonymous text flex item shrink-wraps to its content so `text-align` has no free space to act in. `align-items` is never set, so the item stretches to full height and the text always sits at the top — vertical alignment has no vertical effect at all.

The controls themselves are correctly wired: the Left/Center/Right buttons (advanced-studio.js:1813) dispatch through advanced-studio.js:2032-2038 -> `hooks.onTypography({alignment})` -> applyTypographyChange (407f-engineering-adapter.js:4145), so the value is stored and re-emitted — it simply has no rendered effect.

Corroborating: the contenteditable variant in the same stylesheet overrides to `display:block`, so the text visibly jumps position when the student double-clicks to edit and jumps back on blur.

**Student impact:** The student clicks Center or Right on a text box and nothing moves. Meanwhile choosing 'Vertical alignment: Bottom' shoves the text to the right-hand edge of its box. Text also refuses to sit vertically centred in a container it has been grouped with, and it visibly jumps every time they enter and leave edit mode.

**Proposed fix:** Single declaration added to the `.d1411aAdvancedText` rule inside the overlay style string at kernel-host.js:950 — change
  ...#d1411a-advanced-overlay .d1411aAdvancedText{background:transparent;border:0;color:#191c21;display:flex;font:400 24px/1.2 Inter,sans-serif;...}
to
  ...#d1411a-advanced-overlay .d1411aAdvancedText{background:transparent;border:0;color:#191c21;display:flex;flex-direction:column;font:400 24px/1.2 Inter,sans-serif;...}

With `flex-direction:column` the main axis becomes vertical, so the existing `justifyContent` assignment at line 988 correctly performs top/middle/bottom, and the cross axis (horizontal) defaults to `align-items:stretch`, giving the anonymous text item the full box width so `text-align:left|center|right` from line 986 finally applies. Also add `text-align:inherit` handling for the editing state by appending `text-align:inherit` is unnecessary — the inline style on the node already survives the `[contenteditable="true"]` rule; only `display:block` changes, which keeps text-align working.

### A5 — Milestone flags, the title plaque, photo tiles, the logo mount and the sticky note are selectable but cannot be dragged — _beginGesture only implements arrows, axis, colour key and profile card
**Severity:** MAJOR · **Location:** `packages/mission-timeline/web/js/d1-411a/kernel-host.js:1542`

**Evidence:** Every one of these objects gets a hit proxy, hover outline, focus ring and aria-selected state — INTERACTIVE_OBJECT_SELECTOR (kernel-host.js:225-238) covers `.arrow`, `.flag`, `.photoTile`, `#profile-photo-well`, `#logo-mount`, `#sticky-note`, `#axis`, `#key`, `#titleWrap`, `#profile`, `#ivrWrap`, `#ivdate`, and _refreshHits() builds a `.d1411AHit` button for each.

But _beginGesture (kernel-host.js:1472) only branches on `sourceId==="year-axis"` (axis boundary), `sourceId==="color-key"`, `sourceId==="profile-sheet"` and then falls through to (kernel-host.js:1542-1545):
    const node=sourceId
      ?childDocument.querySelector(`.arrow[data-object-id="${CSS.escape(sourceId)}"]`)
      :event.target.closest?.(".arrow[data-object-id]");
    if(!node)return;

For a flag/title/photo/logo/sticky hit, `.arrow[data-object-id=<that id>]` does not exist, so the function returns silently. There is no other pointer path: the host-side canvas.js drag layer (onPointerDown at canvas.js:2340) only targets `[data-canvas-event]` nodes, which do not exist in the protected path (renderCanvas uses `rendered.html` for `d1-411a-*` kinds at canvas.js:1485 and the kernel manager returns `scene:{events:[]}` at kernel-host.js:1749).

**Student impact:** The student clicks a milestone flag: it lights up with a purple selection outline, so it clearly looks draggable. They drag — nothing happens, ever. Same for the timeline title plaque and every photo tile. Only event arrows respond, which reads as the app being half-broken. The ticket explicitly names 'milestone flags' and 'title plaque' as objects that must be directly manipulable.

**Proposed fix:** Add a flag branch to _beginGesture immediately before the `.arrow` lookup at kernel-host.js:1542. Flags carry a domain id and a month, so the existing move pipeline already works end to end (_moveGesture's `gesture.node` branch translates the node; _endGesture computes `monthDelta` from _pointMonth and dispatches `d1-411a:gesture`, which onKernelGesture in 407f-engineering-adapter.js:3695 turns into beginCanvasDrag/commitCanvasDrag):

    const flagNode=sourceId?childDocument.querySelector(`.flag[data-object-id="${CSS.escape(sourceId)}"]`):null;
    if(flagNode){
      const flagDomainId=this._record.projection.visualToDomain.get(sourceId);
      if(!flagDomainId)return;
      this.selectObject(sourceId);
      this._gesture={
        pointerId:event.pointerId,domainId:flagDomainId,visualId:sourceId,
        kind:"move",lockAxis:"x",
        startX:event.clientX,startY:event.clientY,scale,
        startMonth:this._pointMonth(event,childDocument),startLane:null,
        node:flagNode,
        originalTransform:flagNode.style.transform||"",
        originalLeft:flagNode.style.left||"",
        originalWidth:flagNode.style.width||""
      };
      (proxy||flagNode).setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

and guard the lane-promotion branch in _endGesture so a flag never becomes a lane change — change
    if(kind==="move"&&Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx)*.6){
to
    if(kind==="move"&&gesture.lockAxis!=="x"&&Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx)*.6){

For the remaining protected objects (title plaque, photo tiles, logo, sticky) that have no geometry override contract yet, at minimum change the silent `return` into a `this.selectObject(sourceId)` plus a one-line non-destructive hint so they do not feel dead.

### A6 — All direct manipulation of protected objects is silently switched off whenever the board renders below 40% scale
**Severity:** MAJOR · **Location:** `packages/mission-timeline/web/js/d1-411a/kernel-host.js:1480`

**Evidence:** _beginGesture bails before any branch runs (kernel-host.js:1476-1480):
    const board=childDocument.getElementById("board");
    const boardBounds=board.getBoundingClientRect();
    const scale=boardBounds.width/1920;
    if(scale<.4)return;

The board width is driven directly by the zoom control: renderCanvas writes `width:${1920*Number(viewState.zoom.percent||100)/100}px;max-width:none` onto `.canvas-application` (canvas.js:1472-1474) and the zoom control allows 25% (canvas.js:1181 `min="25"`, canvas.js:262 clamps to 25). Any zoom below 40% therefore puts scale under the threshold.

It also trips at Fit on smaller viewports: `.canvas-application{width:min(100%,1440px)}` (uxr-002.css:290) inside `.canvas-stage{padding:24px}` (uxr-002.css:289), and in Advanced Studio the screen is `grid-template-columns:minmax(300px,352px) minmax(0,1fr)` (407f-upgrade.css:5524-5529). A ~1150px-wide window gives a board around 750px, i.e. scale ≈ 0.39.

Every gesture computation already divides by `scale` (e.g. `const dx=(event.clientX-gesture.startX)/gesture.scale;` at kernel-host.js:1580), so small scale is mathematically fine — the guard is a hit-precision heuristic, not a correctness requirement.

**Student impact:** The student zooms out to 30% to see the whole timeline, then tries to drag an event arrow or the colour key. Nothing responds and there is no message. On a smaller laptop the same dead state happens at the default Fit zoom in Advanced Studio, so the editor appears to be entirely non-interactive.

**Proposed fix:** Replace the arbitrary threshold at kernel-host.js:1480 with a guard that only refuses when the board is genuinely unmeasurable:

    if(!(scale>0)||!(boardBounds.width>0)||!(boardBounds.height>0))return;

If a floor is still wanted for touch precision, use a much lower one tied to the actual zoom minimum (25% -> scale 0.25), e.g. `if(!(scale>=.2))return;`, and pair it with a `d1-411a:command` toast so the refusal is never silent.

### A7 — Zoom has no keyboard shortcuts, and ctrl/cmd+wheel zoom is dead over the board because the listener is on the parent document, not the kernel iframe
**Severity:** MAJOR · **Location:** `packages/mission-timeline/web/js/uxr-002/canvas.js:2335`

**Evidence:** canvasKeyboardIntent (canvas.js:962-980) enumerates every keyboard intent the canvas understands — undo/redo, Escape, Tab, F2, Enter, Delete, arrows — and contains no zoom case at all. There is therefore no cmd/ctrl+plus, cmd/ctrl+minus or cmd/ctrl+0 anywhere in the editor.

The only pointer-driven zoom is the wheel handler (canvas.js:2335-2340):
  const onWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 5 : -5;
    setState({...state,zoom:updateCanvasZoom(state.zoom,{kind:"trackpad",delta})});
  };
registered as `root.addEventListener("wheel",onWheel,{passive:false})` (canvas.js:2457) where `root` is the parent-document canvas host. In the shipping path the board is a cross-document iframe: renderResponsiveAdvancedBoard (407f-engineering-adapter.js:1484) returns `kernelManager.render(...)`, which emits `<d1-timeline-kernel>` (kernel-host.js:1742) whose shadow root hosts `<iframe src=MASTER_URL>` (kernel-host.js:197). Wheel and key events raised inside that child document never reach `root`. kernel-host.js has no wheel listener at all (grep for `wheel` returns only `crop?.zoom` at line 931).

The same boundary kills the middle-button pan at canvas.js:2341-2347 (`if(stage&&event.button===1)`), which is also only bound on the parent document.

**Student impact:** Ctrl/cmd + scroll over the timeline zooms the whole BROWSER page instead of the canvas, because the child document never calls preventDefault. Keyboard zoom does not exist. Middle-drag panning does nothing over the board. The student's only zoom affordances are the three toolbar buttons and the percentage field, which is itself broken (see A2).

**Proposed fix:** Forward the two input classes across the frame boundary from the host side. In kernel-host.js `_installChildInteractions` (line 436), alongside the existing childDocument listeners, add:

    const zoomWheel=(wheelEvent)=>{
      if(!wheelEvent.ctrlKey&&!wheelEvent.metaKey)return;
      wheelEvent.preventDefault();
      this.dispatchEvent(new CustomEvent("d1-411a:command",{bubbles:true,composed:true,
        detail:{surface:this._record.surface,command:wheelEvent.deltaY<0?"zoom-in":"zoom-out"}}));
    };
    childDocument.addEventListener("wheel",zoomWheel,{passive:false});
    this._childCleanup.push(()=>childDocument.removeEventListener("wheel",zoomWheel));

    const zoomKeys=(keyEvent)=>{
      if(!(keyEvent.metaKey||keyEvent.ctrlKey))return;
      const command={"=":"zoom-in","+":"zoom-in","-":"zoom-out","_":"zoom-out","0":"zoom-fit"}[keyEvent.key];
      if(!command)return;
      keyEvent.preventDefault();
      this.dispatchEvent(new CustomEvent("d1-411a:command",{bubbles:true,composed:true,
        detail:{surface:this._record.surface,command}}));
    };
    childDocument.addEventListener("keydown",zoomKeys);
    this._childCleanup.push(()=>childDocument.removeEventListener("keydown",zoomKeys));

Then extend onKernelCommand in 407f-engineering-adapter.js (line 3902, which already handles "undo"/"redo"/"delete") with:

    else if(detail.command==="zoom-in"||detail.command==="zoom-out"||detail.command==="zoom-fit"){
      canvasController?.setUiState((s)=>({...s,zoom:updateCanvasZoom(s.zoom,
        detail.command==="zoom-fit"?{kind:"preset",value:"fit"}:{kind:"step",delta:detail.command==="zoom-in"?10:-10})}));
      return;
    }

Add the same three shortcuts to canvasKeyboardIntent (canvas.js:962) so they also work when focus is in the parent toolbar. updateCanvasZoom is already imported by the adapter (it is used for builderPreviewZoom at 407f-engineering-adapter.js:3955).

### A8 — Typing in the Advanced Studio Text field loses focus after every character — the inspector panel is rebuilt on each keystroke
**Severity:** MAJOR · **Location:** `packages/mission-timeline/web/js/407f-engineering-adapter.js:4487`

**Evidence:** The inspector textarea fires on every `input` event (advanced-studio.js:2166-2170 -> `hooks.onTextContent(...)`), and the handler unconditionally re-renders (407f-engineering-adapter.js:4487-4492):
    onTextContent:(text,target)=>{
      const result=updateTextBlockContent(store.document,target,text);
      store.replace(result,{label:"Edit Advanced text"});
      syncBridgeStateFromStore();
      canvasController?.setUiState({advancedSelection:target});
    },

`setUiState` -> `setState` -> `render()` -> patchPersistentCanvas, which removes and re-creates every non-stage child of `.canvas-screen` (canvas.js:1673-1681). The Advanced Studio sidebar containing `<textarea data-advanced-text-content>` (advanced-studio.js:1808) is emitted as exactly such a child (`${advancedMarkup}` at canvas.js:1520), so the live textarea is detached mid-input.

The team already hit this for the sibling search box and worked around it explicitly (407f-engineering-adapter.js:4278-4285):
    onAssetSearch:(advancedAssetQuery)=>{
      canvasController?.setUiState({advancedAssetQuery});
      queueMicrotask(()=>{
        const field=canvasHost?.querySelector?.("[data-advanced-asset-search]");
        field?.focus?.();
        field?.setSelectionRange?.(field.value.length,field.value.length);
      });
    },
onTextContent has no equivalent. The same defect applies to the Size number input (onTypography -> applyTypographyChange -> setUiState at 407f-engineering-adapter.js:4165) and the Minimum-readable-size input (onTextLayout at 4478).

**Student impact:** The student types a caption into the Text box in the right-hand inspector. After the first character the field loses focus and the caret disappears; every further character has to be preceded by clicking back into the box. Editing any text through the panel is effectively impossible; the same happens when typing a font size.

**Proposed fix:** Mirror the onAssetSearch pattern and preserve the caret. In 407f-engineering-adapter.js replace onTextContent (line 4487) with:

    onTextContent:(text,target)=>{
      const escaped=globalThis.CSS?.escape?CSS.escape(String(target.id)):String(target.id);
      const selector=`[data-advanced-text-content][data-advanced-target-id="${escaped}"]`;
      const caret=canvasHost?.querySelector?.(selector)?.selectionStart??text.length;
      const result=updateTextBlockContent(store.document,target,text);
      store.replace(result,{label:"Edit Advanced text"});
      syncBridgeStateFromStore();
      canvasController?.setUiState({advancedSelection:target});
      queueMicrotask(()=>{
        const field=canvasHost?.querySelector?.(selector);
        field?.focus?.();
        field?.setSelectionRange?.(caret,caret);
      });
    },

Apply the identical caret-restoring queueMicrotask to applyTypographyChange (line 4145, selector `[data-advanced-typography-field="size"][data-advanced-target-id="..."]`) and to onTextLayout (line 4478).

### A9 — Uploaded images are placed on the board with an unbounded height, so tall photos overflow the 1080px board and land at a negative Y
**Severity:** MAJOR · **Location:** `packages/mission-timeline/web/js/uxr-002/advanced-studio.js:940`

**Evidence:** createMediaElement constrains only the width (advanced-studio.js:938-946):
  const naturalAspect=positive(naturalWidth,320)/positive(naturalHeight,180);
  const isLogo=kind==="logo";
  const width=isLogo?120:Math.min(480,positive(naturalWidth,320));
  const height=width/naturalAspect;
  const x=isLogo?finite(boardWidth,1920)-finite(boardMargin,64)-width:
    (finite(boardWidth,1920)-width)/2;
  const y=isLogo?finite(boardMargin,64):
    (finite(boardHeight,1080)-height)/2;

naturalWidth/naturalHeight come straight from the file (407f-engineering-adapter.js:4075-4083 `const metrics=await imageMetrics(file,{kind}); createMediaElement({...naturalWidth:metrics.width,naturalHeight:metrics.height})`). For a 1000x5000 upload: width=480, height=2400, y=(1080-2400)/2=-660.

Nothing downstream repairs it: _applyAdvancedOverlay writes the raw values (kernel-host.js:964-967 `node.style.left=...;node.style.top=`${finite(item.y,0)}px`;...`), and the gesture clamp `clamp(v,0,1080-next.height)` (kernel-host.js:1176) resolves to a negative maximum when height>1080 because `clamp` is `Math.min(max,Math.max(min,value))`.

**Student impact:** A student uploads a tall screenshot or a stitched panorama and the image is inserted mostly off the top and bottom of the board with its top edge above the canvas. It cannot be dragged back into view because the drag clamp is inverted at that size — the only escape is delete and re-upload.

**Proposed fix:** Constrain both axes in createMediaElement (advanced-studio.js:940-941) so the placement is a genuine aspect-fit into a safe box:

  const maxWidth=isLogo?120:480;
  const maxHeight=isLogo?120/naturalAspect:360;
  const width=isLogo?120:Math.min(maxWidth,positive(naturalWidth,320),maxHeight*naturalAspect);
  const height=width/naturalAspect;

Additionally harden the runtime clamp in kernel-host.js update() (line 1176) so an already-saved oversized object can still be dragged: change
    next.x=clamp(next.x+dx,0,1920-next.width);next.y=clamp(next.y+dy,0,1080-next.height);
to
    next.x=clamp(next.x+dx,Math.min(0,1920-next.width),Math.max(0,1920-next.width));
    next.y=clamp(next.y+dy,Math.min(0,1080-next.height),Math.max(0,1080-next.height));

### A10 — Uploaded/text/shape tiles in the rail advertise drag-to-canvas but every drop handler rejects their payload
**Severity:** MINOR · **Location:** `packages/mission-timeline/web/js/uxr-002/advanced-studio.js:1768`

**Evidence:** Every existing-object tile in the rail is marked draggable (advanced-studio.js:1768):
        const dragAttributes=` draggable="true" data-advanced-drag-object`;

and the dragstart handler emits a payload whose kind is "object" (advanced-studio.js:2188-2196):
    const object=closest(event.target,"[data-advanced-drag-object]");
    if(object){
      const target=delegatedTarget(object);
      if(!target)return;
      event.dataTransfer?.setData?.("application/x-missionmed-timeline-asset",JSON.stringify({kind:"object",target}));

All three consumers require kind==="insert" and drop anything else:
  - kernel-host.js advancedDrop: `if(payload?.kind!=="insert"||this._record?.editable!==true)return;` (line 453)
  - 407f-engineering-adapter.js onAdvancedRailDragOver/onAdvancedRailDrop: `if(payload?.kind!=="insert"...)return;` (lines 6043, 6050)
  - advancedHooks().onAssetDrop: `if(payload?.kind!=="insert")return;` (line 4381)

Media tiles happen to survive only because they also carry `data-media-asset` (advanced-studio.js:1769-1771) and the separate document-level onMediaLibraryDragStart sets `application/x-missionmed-media-id` (407f-engineering-adapter.js:2631-2640), which kernel-host's acceptsMedia drop path does handle. Text and shape/element tiles have no such fallback.

**Student impact:** The student grabs a text or shape entry from the rail list and drags it onto the board. The cursor shows a drag, nothing is inserted, and no message explains why. It reads as an intermittent bug rather than an unsupported action.

**Proposed fix:** For RC1, either remove the dead affordance or make it functional; removal is the smaller blast radius. In advanced-studio.js:1768 restrict the attribute to media tiles that actually have a working transport:

        const dragAttributes=item.type==="media"?` draggable="true" data-advanced-drag-object`:"";

If the reposition-by-drag behaviour is wanted instead, accept the payload in advancedHooks().onAssetDrop (407f-engineering-adapter.js:4380) by adding, before the existing `if(payload?.kind!=="insert")return;`:

      if(payload?.kind==="object"&&payload.target?.type&&payload.target?.id){
        const collection=payload.target.type==="text"?"textBlocks":payload.target.type==="element"?"elements":"media";
        store.mutate("Move Timeline object",(document)=>{
          const item=(document.advanced[collection]||[]).find((candidate)=>String(candidate.id)===String(payload.target.id));
          if(item){item.x=x;item.y=y;}
        });
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:payload.target});
        return;
      }

and relax the same kind check in kernel-host.js:453 to `if((payload?.kind!=="insert"&&payload?.kind!=="object")||this._record?.editable!==true)return;`.

## LANE D — FILE VAULT / STORAGE / SAVE-SYNC / AUTH

WHAT I READ (all at HEAD e0c87ce, read-only, no edits made):\nweb/js/uxr-002/filevault-source.js (full 184), web/js/filevault/*.js (all 6), web/js/persistence/{indexeddb,memory}-adapter.js, web/js/uxr-002/store.js (280-760), web/js/media/ (only media-manager.js — unused by the 407F path), web/js/production/timeline-auth-client.js (full 268), web/js/production/timeline-production-runtime.js (full 81), matrix/hybrid-indexeddb-adapter.js (1-110, 210-375), web/js/407f-engineering-adapter.js (880-1060, 1240-1560, 2180-2200, 2360-2470, 2596-2640, 5250-5400, 6085-6340, 6440-6480, 6519+), web/js/uxr-002/intake.js (240-310, 360-535, 650-900, 1098-1225), web/js/uxr-002/intake-d1-408-adapter.js (480-610), web/index.html (515-530, 655-670, 1195-1300, 3315), src/api/http-api.ts (full 306), src/security/authorization.ts, src/filevault/filevault.ts, src/storage/private-object-store.ts (full 210), src/storage/production/r2-private-object-store.ts (full 655), src/server/production-server.ts (1-90), src/identity/wordpress-timeline-jwt.ts (105-137), src/persistence/postgres/types.ts, database/migrations/202607150001_timeline_v1.sql (RLS helpers 336-382, media policies 584-595), database/migrations/202607150002_timeline_v1_413_hardening.sql (policies 137-290, force RLS 410), wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php (520-760), tests/d1-405-filevault-source.test.mjs, tests/d1-500-rc1-r2-private-storage.test.ts (260-300), git show 6faf34f.\n\nANSWERS TO THE FIVE PRIORITY QUESTIONS\n\n1. FILE VAULT SEAM — Codex's claim is OUT OF DATE at HEAD, but the seam is broken for a different reason. 6faf34f did wire real byte streaming end to end: chooser → adapter.select(id,{timelineDocumentId,versionId}) → POST /file-vault/sources/{id}/ingestions (WP) → WP downloads the exact confirmed version, verifies owner + mime + size + sha256, POSTs raw bytes to POST /v1/documents/{id}/file-vault/ingestions with X-Content-Sha256 / X-File-Vault-Id / X-File-Vault-Version, gets back a private SOURCE objectId, and returns {document, source, contentBase64}. The browser rebuilds a real File, stamps a non-enumerable `timelineSourceObject` on it, and intake.js:769-772 preserves that exact File object through to createProductionCvIntakeAdapter.extract, which honours the handed-off objectId and skips a duplicate upload. I verified the sha256 domains match (web/js/ingestion/file-inspector.js:26 hashes the raw arrayBuffer; WP hashes the same bytes at :685). The signed File Vault URL genuinely never reaches the browser. So the plumbing is real — but see D-LANE-D-01: the Timeline-server end of it cannot write under production RLS, so the feature has never worked outside the in-memory test store.\n\n2. SAVE/SYNC VOCABULARY (§11) — The intended vocabulary is correct and human: remoteSyncPresentation (407f:960-972) yields SAVED LOCALLY / SAVED LOCALLY — SYNC PENDING / SYNCING… / SAVED & SYNCED / SAVED LOCALLY — OFFLINE / SYNC CONFLICT — REVIEW, and the consent card copy (407f:749-765) and boot recovery panel (407f:6532-6534) are exemplary. I found NO leaked dev nouns in deliberate UI copy — no \"canonical\", \"principal\", \"RLS\", \"revision UUID\", \"object key\", \"signed URL\" in any user-visible string (the only hits for those words are data-* attributes and CSS class names, e.g. canvas.js:1487 data-presentation-kernel). The leaks are all on ERROR paths (D-LANE-D-09) and via a competing writer (D-LANE-D-02). One dead-code note not filed as a finding: the <section data-view=\"versions\"> block in index.html:660-663 ships copy reading \"IN-MEMORY SNAPSHOTS · … · RESETS ON REFRESH\" and a SAVE DRAFT button toasting \"Draft saved · in-memory only\" (index.html:1338), backed by an in-memory array rather than store.saveVersion. It is unreachable — the rail only exposes command/builder/canvas/media/export (index.html:523-529) and store.navigate whitelists the same set plus intake/advisor (store.js:~349) — but if any nav path ever reaches it, that copy is a §1

| ID | Sev | Finding | Location |
|---|---|---|---|
| D-LANE-D-01 | BLOCKER | File Vault → Smart Fill ingestion is dead in production: student context is forged into a SERVICE principal that no RLS policy accepts | `src/api/http-api.ts:161` |
| D-LANE-D-02 | BLOCKER | The legacy shell repaints the save badge as "ALL CHANGES SAVED" on every render, overwriting the real sync state — including OFFLINE and SYNC CONFLICT | `web/index.html:1217` |
| D-LANE-D-03 | MAJOR | File Vault handoff reports success even when the imported file is rejected, and the 20 MB client limit is below the 25 MB ingestion limit | `web/js/407f-engineering-adapter.js:6290` |
| D-LANE-D-04 | MAJOR | File-Vault-ingested CV bytes are never deleted: the AI-fallback cleanup and the student's "Delete the document" button both no-op | `web/js/uxr-002/intake-d1-408-adapter.js:525` |
| D-LANE-D-05 | MAJOR | Production signDownload drops the owner check the reference implementation enforces — any principal who can read the document can mint a presigned URL for the student's private CV | `src/storage/production/r2-private-object-store.ts:362` |
| D-LANE-D-06 | MAJOR | The private R2 object key is returned to the browser in the upload-confirm response | `src/api/http-api.ts:265` |
| D-LANE-D-07 | MAJOR | Media uploaded before secure saving is turned on never reaches private storage, and disappears silently on any other device | `web/js/407f-engineering-adapter.js:920` |
| D-LANE-D-08 | MAJOR | File Vault import decodes up to 25 MB of base64 one character at a time on the main thread | `web/js/uxr-002/filevault-source.js:71` |
| D-LANE-D-09 | MAJOR | Engine error text is toasted verbatim to students — IndexedDB codes, authorization reasons, and object-store internals | `web/js/407f-engineering-adapter.js:6198` |
| D-LANE-D-10 | MINOR | The File Vault chooser lists documents that the very next click provably rejects | `wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php:607` |
| D-LANE-D-11 | MINOR | Turning on secure saving leaves the badge reading "SAVED LOCALLY" because REMOTE_SYNC_CONSENTED is not an observable state | `matrix/hybrid-indexeddb-adapter.js:365` |
| D-LANE-D-12 | MINOR | File Vault selection makes two round trips for a versionId the chooser already has | `web/js/407f-engineering-adapter.js:6285` |

### D-LANE-D-01 — File Vault → Smart Fill ingestion is dead in production: student context is forged into a SERVICE principal that no RLS policy accepts
**Severity:** BLOCKER · **Location:** `src/api/http-api.ts:161`

**Evidence:** src/api/http-api.ts:161-168 —
  const sourceObject = await this.objectStore.putServiceObject(
    { ...context, role: "SERVICE" },
    { documentId: record.document.id, ownerPrincipalId: context.principalId, objectClass: "SOURCE", mimeType, byteSize, sha256: expectedSha256 },
    bytes,
  );

That `context` is the STUDENT context minted by src/identity/wordpress-timeline-jwt.ts:128, which hard-codes `serviceScopes: []` and carries the student's own principalId. Spreading it and overwriting only `role` produces claims of {timeline_role:"SERVICE", service_scopes:[], sub:<student principal>} (src/persistence/postgres/types.ts:102-104).

Production storage is R2 + Postgres RLS (src/server/production-server.ts:76-80 wires createR2PrivateObjectStoreFromEnvironment; r2-private-object-store.ts:279 calls repository.insertPending, which runs SET LOCAL ROLE timeline_authenticated + set_config('request.jwt.claims', …) at r2-private-object-store.ts:185-210).

Both candidate write policies reject those claims (database/migrations/202607150001_timeline_v1.sql:586-595):
  create policy media_owner_write on timeline.media_objects
    for all using (timeline.current_principal_is_active('STUDENT') and owner_principal_id = timeline.current_principal_id()) …
  create policy media_service_write on timeline.media_objects
    for all using (timeline.service_has_scope('artifact:create'))
    with check (timeline.service_has_scope('artifact:create'));

- media_owner_write fails: current_principal_is_active('STUDENT') (…:336-350) requires `p.role = timeline.current_role()`, and current_role() is now 'SERVICE' while the principals row is 'STUDENT'.
- media_service_write fails: service_has_scope (…:371-382) requires current_principal_is_active('SERVICE') AND 'artifact:create' ∈ service_scopes — the array is empty and there is no SERVICE principals row for this id.

timeline.media_objects also has `force row level security` (202607150002_timeline_v1_413_hardening.sql:410), so the table owner cannot bypass it either. The insert raises an RLS violation (or returns 0 rows → OBJECT_CUSTODY_WRITE_FAILED, r2-private-object-store.ts:145). The tests pass only because they use InMemoryPrivateObjectStore, which has no RLS.

The correct SERVICE shape is visible in tests/d1-500-rc1-r2-private-storage.test.ts:31,283 — a distinct principalId ("timeline-export-service") with serviceScopes:["artifact:create"], exactly what src/export/export-orchestrator.ts:104-105 is handed.

**Student impact:** Every File Vault selection fails. The student picks their CV from the vault chooser, waits through the download, and gets the generic fallback toast "Timeline could not safely import that File Vault document. You can still upload it from this device." (missionmed-timeline-sso.php:711). The entire "faster start from File Vault" feature never works once, on any account, in production — while it passes CI.

**Proposed fix:** Do not forge a SERVICE principal; the student already owns the document and media_owner_write already permits them. Add an owner-scoped byte write and call it here.

1) src/storage/private-object-store.ts — add to the interface (after line 33):
     putOwnedObject(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): Promise<ObjectRecord>;

2) src/storage/production/r2-private-object-store.ts — add beside putServiceObject (line 383), reusing its body but asserting owner instead of SERVICE:
     async putOwnedObject(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): Promise<ObjectRecord> {
       if (context.role !== "STUDENT") throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403);
       if (request.ownerPrincipalId && request.ownerPrincipalId !== context.principalId) throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403);
       if (bytes.byteLength !== request.byteSize || sha256(bytes) !== request.sha256.toLowerCase()) throw new TimelineError("OBJECT_SERVICE_BYTES_INVALID", "Object integrity is invalid.", 400);
       const signed = await this.signUpload(context, { ...request, ownerPrincipalId: undefined });
       const pending = await this.requireAuthorizedRecord(context, signed.objectId);
       … identical PutObjectCommand block as lines 391-403 …
       return this.confirmUpload(context, signed.objectId, signed.uploadToken);
     }
   (signUpload already allows STUDENT at line 269 and stamps ownerPrincipalId = context.principalId at 272-274; confirmUpload's assertMutableBy at 456-461 passes for the owning STUDENT; insertPending then satisfies media_owner_write.)

3) Mirror the same method in src/storage/private-object-store.ts (InMemoryPrivateObjectStore, beside line 157), src/storage/staging/staging-private-object-store.ts (beside line 469), and src/server/production-server.ts:41 (UnconfiguredPrivateObjectStore → return this.unavailable()).

4) src/api/http-api.ts:161-162 — replace:
       const sourceObject = await this.objectStore.putServiceObject(
         { ...context, role: "SERVICE" },
   with:
       const sourceObject = await this.objectStore.putOwnedObject(
         context,
   leaving the rest of the request object unchanged (drop the now-redundant `ownerPrincipalId: context.principalId` or keep it — putOwnedObject validates it matches).

### D-LANE-D-02 — The legacy shell repaints the save badge as "ALL CHANGES SAVED" on every render, overwriting the real sync state — including OFFLINE and SYNC CONFLICT
**Severity:** BLOCKER · **Location:** `web/index.html:1217`

**Evidence:** web/index.html:1216-1219 (inside function renderHud):
  const save=$('#hudSave');
  if(save){
    save.textContent=state.saved?'ALL CHANGES SAVED':'SAVING…';
    save.className='saveState '+(state.saved?'isSaved':'isSaving');
  }

renderHud() is called unconditionally by renderAll() (web/index.html:1269), and `renderAll` is exported on the bridge as window.D1_407F_TEST.renderAll (web/index.html:3315). `state.saved` is the 2021-era shell flag, set only by legacy shell handlers (web/index.html:903, 1029, 1099, 1173, 1338…) — none of which the D1-407F adapter uses, so it stays true.

The truthful writer is web/js/407f-engineering-adapter.js:5323-5341:
  reflectStoreStatus=()=>{ const save=document.getElementById("hudSave"); …
    }else if(productionRuntime&&remotePresentation){
      save.textContent=remotePresentation.text;   // "SAVED LOCALLY — OFFLINE", "SYNC CONFLICT — REVIEW", "SAVED & SYNCED" (…:960-972)

The adapter always loses the race. store.mutate() → emit() → subscribe() → reflectStoreStatus() (…:5364) writes the true text; then the same handlers call syncBridgeFromStore() (…:2182-2191) whose line 2185 is `bridge.renderAll();` → renderHud() → badge reverted. Every media add (…:2623-2624), every intake change (…:6190-6194), every specialty/builder mutation goes through this path.

reflectStoreStatus also leaves save.onclick wired for conflict recovery (…:5343-5355) while renderHud has already rewritten the label to a green "ALL CHANGES SAVED".

**Student impact:** A student working offline, or one whose device is in an unresolved SYNC CONFLICT with a newer server copy, sees a green "ALL CHANGES SAVED" chip in the header. They close the tab believing their work is durable. It is not: HybridIndexedDbAdapter still holds SYNC_PENDING/CONFLICT records (matrix/hybrid-indexeddb-adapter.js:317-323) and the conflict-recovery dialog is never surfaced because the only affordance advertising it has been relabelled.

**Proposed fix:** Give the adapter ownership of the badge and make the shell yield.

web/index.html:1216-1219 — change to:
  const save=$('#hudSave');
  if(save&&save.dataset.d1407fOwned!=='1'){
    save.textContent=state.saved?'ALL CHANGES SAVED':'SAVING…';
    save.className='saveState '+(state.saved?'isSaved':'isSaving');
  }

web/js/407f-engineering-adapter.js:5324-5325 — right after the `if(!save)return;` guard, add:
  save.dataset.d1407fOwned="1";

That is two edits, no behaviour change for the standalone legacy shell (which never sets the flag), and the adapter's vocabulary from remoteSyncPresentation (…:960-972) becomes the only thing a student ever reads.

### D-LANE-D-03 — File Vault handoff reports success even when the imported file is rejected, and the 20 MB client limit is below the 25 MB ingestion limit
**Severity:** MAJOR · **Location:** `web/js/407f-engineering-adapter.js:6290`

**Evidence:** web/js/407f-engineering-adapter.js:6284-6294:
  const selectedDescriptor=await fileVaultSource.select(selected.value);
  const imported=await selectFileVaultSourceDocument(fileVaultSource,selected.value,{
    timelineDocumentId:store.document.id,
    versionId:String(selectedDescriptor?.versionId||"")
  });
  if(!imported.file||!intakeMachine)throw new Error("Timeline could not open that File Vault document for Smart Fill.");
  intakeMachine.receiveFile(imported.file);
  closeOwnedModal();
  bridge.go("intake");
  bridge.toast("File Vault document ready for your review");

receiveFile's return value is discarded. web/js/uxr-002/intake.js:769-772:
  receiveFile(file){ const result=this.dispatch({type:"RECEIVE_FILE",file}); this.sourceFile=result.file?file:null; return result; }
and the RECEIVE_FILE reducer (intake.js:363-376) sets `state.file=null; state.fileError=validation.error;` on rejection — it does not throw.

The limits genuinely disagree:
- web/js/uxr-002/intake.js:20  export const MAX_DOCUMENT_BYTES=20*1024*1024;  (enforced at intake.js:258)
- wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php:676  limit_response_size => 25*1024*1024+1, and :681 rejects only `$byte_size > 25*1024*1024`
- src/api/http-api.ts:149  `byteSize > 25 * 1024 * 1024` → FILE_VAULT_INGEST_SIZE_DENIED
- src/storage/production/r2-private-object-store.ts:54  SOURCE: 25 * 1024 * 1024

So a 20–25 MB File Vault PDF is downloaded by WordPress, written into Timeline private R2 custody as a SOURCE object, base64'd back to the browser — and then silently rejected by validateIntakeFile.

**Student impact:** The student picks a large CV from File Vault, waits through the whole transfer, gets the toast "File Vault document ready for your review", is routed to the Intake screen — and finds an empty upload box with the generic file-error copy and no explanation of what happened or how big is too big. Their CV bytes are already sitting in Timeline private storage with nothing referencing them.

**Proposed fix:** Two surgical edits.

1) web/js/407f-engineering-adapter.js:6290-6294 — honour the reducer result:
     if(!imported.file||!intakeMachine)throw new Error("Timeline could not open that File Vault document for Smart Fill.");
     const received=intakeMachine.receiveFile(imported.file);
     closeOwnedModal();
     bridge.go("intake");
     bridge.toast(received?.file
       ?"File Vault document ready for your review"
       :String(received?.fileError||"That File Vault document can’t be read for Smart Fill."));

2) Refuse over-size documents before any bytes move. In web/js/uxr-002/filevault-source.js, import MAX_DOCUMENT_BYTES from "./intake.js" and gate on the descriptor the chooser already carries (normalizeFileVaultSourceDocument keeps `sizeBytes`, filevault-source.js:99-101). At the top of the `if(timelineDocumentId&&versionId)` branch (filevault-source.js:63):
     if(Number.isFinite(Number(record?.sizeBytes))&&Number(record.sizeBytes)>MAX_DOCUMENT_BYTES){
       throw stableUnavailableError("That document is larger than 20 MB. Choose a smaller PDF or DOCX.");
     }
   (or, equivalently and with zero new imports, clamp the WP/server ceilings at missionmed-timeline-sso.php:681 and src/api/http-api.ts:149 from 25 MB down to 20 MB so all four limits agree).

### D-LANE-D-04 — File-Vault-ingested CV bytes are never deleted: the AI-fallback cleanup and the student's "Delete the document" button both no-op
**Severity:** MAJOR · **Location:** `web/js/uxr-002/intake-d1-408-adapter.js:525`

**Evidence:** web/js/uxr-002/intake-d1-408-adapter.js:524-526:
  const handedOffSource=file?.timelineSourceObject;
  let objectId=(String(handedOffSource?.sha256||"").toLowerCase()===sha256&&String(handedOffSource?.objectId||""))||confirmedSources.get(sha256)||"";
  let created=false;

When the file came from File Vault, the objectId is supplied by the handoff (set at web/js/uxr-002/filevault-source.js:77), so the `if(!objectId){…}` block at :529-543 is skipped — `created` stays false and `confirmedSources` never records sha256→objectId.

Both cleanup paths are gated on `created`:
  :563-565  if(analysis?.mode!=="SERVER_AI"||…){ if(created){await deleteObject(objectId);confirmedSources.delete(sha256);} return {…intelligenceMode:"LOCAL_LIMITED"…}; }
  :590-592  catch(error){ if(created){await deleteObject(objectId);confirmedSources.delete(sha256);} … }

And `activeSourceObjectId=objectId;` is only reached on the SERVER_AI success path (:567). So on any fallback the module-level `activeSourceObjectId` stays "", and deleteSource (:598-603) calls deleteObject("") which is a no-op by its own guard (:508: `if(objectId && typeof apiClient.deleteObject==="function")`).

The student-facing button is wired straight to it: web/js/uxr-002/intake.js:1111 renders `data-intake-action="delete-document"`, :1203-1205 calls machine.deleteDocument(deleteSource) and toasts on `result.deleted`, and deleteDocument (:880-886) returns `{deleted:!!file}` — true whenever a file descriptor exists, regardless of what the adapter actually removed. web/js/407f-engineering-adapter.js:6209-6212 is the deleteSource passthrough.

**Student impact:** Student imports their CV from File Vault, the AI provider is unavailable or returns no candidates, and Timeline falls back to local-limited parsing. Their full CV PDF stays in Timeline's private R2 bucket indefinitely with no document field referencing it, so nothing will ever clean it up. If they then press "Delete the document", they are told "Document deleted" and nothing is deleted.

**Proposed fix:** Track the handed-off object the same way as a self-created one, so both cleanup paths cover it.

web/js/uxr-002/intake-d1-408-adapter.js:524-526 — replace with:
  const handedOffSource=file?.timelineSourceObject;
  const handedOffObjectId=(String(handedOffSource?.sha256||"").toLowerCase()===sha256&&String(handedOffSource?.objectId||""))||"";
  let objectId=handedOffObjectId||confirmedSources.get(sha256)||"";
  let created=Boolean(handedOffObjectId);
  if(handedOffObjectId)confirmedSources.set(sha256,handedOffObjectId);

`created=true` makes the existing `if(created){await deleteObject(objectId);…}` at :564 and :591 retire the File-Vault-ingested SOURCE object on fallback, and the confirmedSources entry lets deleteSource's reverse lookup (:601) find it. Also set the handle before the try so an abandoned session is recoverable: add `activeSourceObjectId=objectId;` immediately after the assignment above (it is already cleared by deleteSource at :599).

Separately, stop the false confirmation: web/js/uxr-002/intake.js:880-886 — return what was actually removed:
  async deleteDocument(deleteSource=async()=>{}){
    const file=this.state.file?clone(this.state.file):null;
    let removed=false;
    if(file)removed=(await deleteSource(file))!==false;
    …
    return{deleted:!!file&&removed};
  }
and have createProductionCvIntakeAdapter.deleteSource (:598-603) `return Boolean(objectId);`.

### D-LANE-D-05 — Production signDownload drops the owner check the reference implementation enforces — any principal who can read the document can mint a presigned URL for the student's private CV
**Severity:** MAJOR · **Location:** `src/storage/production/r2-private-object-store.ts:362`

**Evidence:** src/storage/production/r2-private-object-store.ts:362-381:
  async signDownload(context: PrincipalContext, objectId: string): Promise<SignedDownload> {
    this.assertAuthenticated(context);
    const record = await this.requireAuthorizedRecord(context, objectId);
    if (record.status !== "CONFIRMED") throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
    …presign GetObjectCommand on record.storageKey…
  }
There is no assertMutableBy and no ownerPrincipalId comparison — unlike confirmUpload (:331-332) and deleteObject (:425-426), which both call this.assertMutableBy(context, record) (:456-461).

The reference implementation does enforce it. src/storage/private-object-store.ts:142-149:
  async signDownload(context, objectId) {
    const pending = this.objects.get(objectId);
    if (!pending || pending.record.status !== "CONFIRMED") throw new TimelineError("OBJECT_NOT_FOUND", …);
    if (pending.record.ownerPrincipalId !== context.principalId && context.role !== "SERVICE") {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403);
    }

requireAuthorizedRecord (:463-467) delegates entirely to RLS, and the read policy is document-scoped, not owner-scoped — database/migrations/202607150002_timeline_v1_413_hardening.sql:274-276:
  create policy media_read on timeline.media_objects
    for select using (exists (select 1 from timeline.documents d where d.id = document_id));
(the underlying documents_read policy admits assigned ADVISOR, same-program PROGRAM_ADMIN and FACULTY grant holders — …:137-160).

The route is unguarded too: src/api/http-api.ts:265-268 —
  const downloadMatch = url.pathname.match(/^\/v1\/objects\/([^/]+)\/download$/);
  if (downloadMatch && request.method === "POST") { return json(await this.objectStore.signDownload(context, downloadMatch[1]!)); }

SOURCE objects (the raw CV/MyERAS PDF) are stored against the same document id — src/api/http-api.ts:163-170 sets documentId: record.document.id, objectClass: "SOURCE".

**Student impact:** An advisor assigned to a student's timeline (or a program admin in the same program) can POST /v1/objects/{id}/download for that student's uploaded CV SOURCE object and receive a presigned R2 URL for the original PDF — a document the student uploaded only for parsing, never to share. Sharing a timeline for review is not consent to hand over the underlying CV file.

**Proposed fix:** Restore the owner check the in-memory store already has, scoped so document-shared MEDIA keeps working.

src/storage/production/r2-private-object-store.ts:364 — insert immediately after `const record = await this.requireAuthorizedRecord(context, objectId);`:
    if (record.objectClass === "SOURCE") this.assertMutableBy(context, record);

assertMutableBy (:456-461) already returns early for SERVICE and otherwise requires role STUDENT with record.ownerPrincipalId === context.principalId, which is exactly the semantics of private-object-store.ts:147. Nothing in the shipped client is affected: web/js/production/timeline-auth-client.js:255-264 only calls downloadPrivateObject for MEDIA objectIds resolved out of the document (web/js/407f-engineering-adapter.js:6098-6099, 4439-4441), and the timeline web app only runs for role STUDENT (web/js/production/timeline-production-runtime.js:28-30).

### D-LANE-D-06 — The private R2 object key is returned to the browser in the upload-confirm response
**Severity:** MAJOR · **Location:** `src/api/http-api.ts:265`

**Evidence:** src/api/http-api.ts:262-266:
  const confirmMatch = url.pathname.match(/^\/v1\/objects\/([^/]+)\/confirm$/);
  if (confirmMatch && request.method === "POST") {
    const input = await body(request);
    return json(await this.objectStore.confirmUpload(context, confirmMatch[1]!, String(input.uploadToken ?? "")));
  }

confirmUpload returns the full ObjectRecord — src/storage/production/r2-private-object-store.ts:357-359 returns clone(confirmed) from repository.transition, whose row projection includes storage_key (src/storage/production/r2-private-object-store.ts:99-113: `storageKey: row.storage_key`, and the RETURNING clause at :177 explicitly selects storage_key).

That storageKey is the live private bucket path built at :469-487:
  return ["timeline","private",this.environment,"users",this.scopeHash(ownerPrincipalId),"documents",this.scopeHash(documentId),objectClass.toLowerCase(),this.scopeHash(objectId),randomBytes(32).toString("hex")].join("/");

This directly contradicts the invariant the gateway documents for itself — wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php:557-559: "The signed File Vault URL is consumed only inside WordPress and is never returned to the browser, persisted, logged, or copied into Timeline state" — and :558 on the descriptor: "Signed URLs, object keys … are never copied."

No client reads it. web/js/407f-engineering-adapter.js:1394-1409 uses only `confirmed?.status` and `confirmed.confirmedAt`; web/js/uxr-002/intake-d1-408-adapter.js:540 uses only `confirmed?.status`. The document itself is clean — productionMediaSource (web/js/407f-engineering-adapter.js:947-957) persists only objectId, contentSha256, localOnly:false, url:null.

**Student impact:** Not directly exploitable by a student (the bucket is private and the key path is HMAC-scoped), but the exact private-storage path for every media and CV object a student uploads is handed to browser JavaScript and lands in the network log, in memory, and in any browser extension with page access — an invariant the codebase states in writing that it upholds.

**Proposed fix:** Project the confirm response to the fields the client actually consumes.

src/api/http-api.ts:265 — replace the single return line with:
      const confirmed = await this.objectStore.confirmUpload(context, confirmMatch[1]!, String(input.uploadToken ?? ""));
      return json({
        id: confirmed.id,
        objectClass: confirmed.objectClass,
        mimeType: confirmed.mimeType,
        byteSize: confirmed.expectedBytes,
        status: confirmed.status,
        ...(confirmed.confirmedAt ? { confirmedAt: confirmed.confirmedAt } : {}),
      });

Both call sites keep working unchanged (`status` and `confirmedAt` are preserved). Leave confirmUpload's internal return type alone — src/export/export-orchestrator.ts:105-116 consumes it server-side and only reads `object.id`.

### D-LANE-D-07 — Media uploaded before secure saving is turned on never reaches private storage, and disappears silently on any other device
**Severity:** MAJOR · **Location:** `web/js/407f-engineering-adapter.js:920`

**Evidence:** web/js/407f-engineering-adapter.js:920-936 (createObjectUrlRegistry.hydrate):
  for(const {id,blobKey,objectId} of objects){
    if(urls.has(String(id)))continue;
    try{
      let blob=await store.adapter.getBlob(String(blobKey||id));
      if(!blob&&objectId&&typeof remoteLoader==="function"){ blob=await remoteLoader(String(objectId)); … }
      if(blob){this.set(id,blob);changed=true;}
    }catch(error){ onError(error,{id:String(id),objectId:String(objectId||"")}); }
  }
When there is no local blob and no objectId, nothing throws — the loop just falls through. onError is never called, so the "One media asset could not be loaded…" announcement wired at :6100-6103 never fires.

That state is reachable and permanent. web/js/407f-engineering-adapter.js:1362-1379: when privateMediaStorageEnabled is false, prepareMediaPersistence returns `source:{name,type,size,blobKey:id,contentSha256,localOnly:true,url:null}` — no objectId, bytes only in IndexedDB. privateMediaStorageEnabled comes from productionRuntime.privateMediaStorageEnabled (:1274), which is productionRemotePersistenceAllowed = `role==="STUDENT" && remoteSyncAllowed===true` (web/js/production/timeline-production-runtime.js:28-30, 79).

Nothing back-fills them afterwards. `hydrate` is the only reader (single call site, :6097) and there is no upload path that walks `document.advanced.media` for `source.localOnly===true`. But once the student turns on secure saving via the consent card (web/js/407f-engineering-adapter.js:749-765), the document — including those localOnly media entries — starts syncing to the server (matrix/hybrid-indexeddb-adapter.js:361-367 → scheduleFlush → syncRecord → createVersion).

**Student impact:** A student adds photos/logos to their timeline, later turns on "secure saving", then opens Timeline on their laptop. The timeline arrives with the media objects laid out but every image blank — no toast, no announcement, no explanation. From their side the app silently ate their images.

**Proposed fix:** Two changes; the first is one line and makes the failure honest, the second closes the hole.

1) web/js/407f-engineering-adapter.js:933 — replace `if(blob){this.set(id,blob);changed=true;}` with:
     if(blob){this.set(id,blob);changed=true;}
     else onError(new Error("MEDIA_BYTES_UNAVAILABLE_ON_THIS_DEVICE"),{id:String(id),objectId:String(objectId||"")});
   The existing handler at :6100-6103 then announces "One media asset could not be loaded. The rest of your timeline remains available."

2) Back-fill on the first synced session. In the boot block right after the hydrate call (:6097), add:
     if(privateMediaStorageEnabled){
       const pending=(store.document.advanced?.media||[]).filter((item)=>item.source?.localOnly===true&&item.source?.contentSha256);
       for(const item of pending){
         const blob=await store.adapter.getBlob(String(item.source.blobKey||item.id));
         if(!blob)continue;
         const persistence=await prepareMediaPersistence(new File([blob],String(item.source.name||item.id),{type:String(item.source.type||blob.type)}),{id:item.id,kind:"media-library",contentSha256:String(item.source.contentSha256)});
         await store.mutateWithBlobs("Secure existing media",(document)=>{
           const target=document.advanced.media.find((entry)=>entry.id===item.id);
           if(target)target.source={...target.source,...persistence.source};
         },{blobs:[persistence.blob],history:false,material:false,reason:"BACKFILL_PRIVATE_MEDIA"});
       }
     }
   prepareMediaPersistence (:1355-1419) already performs sign → upload → confirm and rolls back on failure, so this reuses the exact production path with no new upload code.

### D-LANE-D-08 — File Vault import decodes up to 25 MB of base64 one character at a time on the main thread
**Severity:** MAJOR · **Location:** `web/js/uxr-002/filevault-source.js:71`

**Evidence:** web/js/uxr-002/filevault-source.js:71-73:
  const binary=atob(encoded);
  const bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);

`encoded` is the whole document body base64'd by WordPress — wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php:722: `'contentBase64' => base64_encode($bytes)` — with the body capped at 25 MB (:676, :681). So this is a JS-level loop of up to 25 million iterations, on top of holding a ~33 MB base64 string, a ~25 MB binary string and a 25 MB Uint8Array simultaneously.

It runs on the click handler's microtask, synchronously with the chooser modal still open: web/js/407f-engineering-adapter.js:6286-6289 awaits selectFileVaultSourceDocument, and the modal is only closed at :6292.

**Student impact:** On a typical CV (2–5 MB) this is a visible hitch; on a larger MyERAS export it locks the tab for several seconds with the File Vault dialog frozen mid-click and no progress indication, which reads as a crash. Peak memory ~3× the file size on top of the copy in the response body.

**Proposed fix:** web/js/uxr-002/filevault-source.js:71-73 — replace the three lines with a single native conversion:
  const binary=atob(encoded);
  const bytes=Uint8Array.from(binary,(character)=>character.charCodeAt(0));

Uint8Array.from with a mapper runs in native code rather than per-iteration JS and removes the separate allocate-then-fill pass. If the lead wants it fully off the main thread, the equivalent one-liner is:
  const bytes=new Uint8Array(await (await fetch(`data:${encodeURIComponent(String(document.mimeType||source.mimeType||"application/octet-stream"))};base64,${encoded}`)).arrayBuffer());
but the Uint8Array.from edit is the minimal, no-new-API change.

### D-LANE-D-09 — Engine error text is toasted verbatim to students — IndexedDB codes, authorization reasons, and object-store internals
**Severity:** MAJOR · **Location:** `web/js/407f-engineering-adapter.js:6198`

**Evidence:** There are 24 sites of the form `bridge.toast(String(error?.message||error))` in web/js/407f-engineering-adapter.js (2946, 2960, 3396, 3700, 4045, 4057, 4063, 4129, 4341, 4372, 4455, 4475, 4485, 4502, 4507, 4528, 4545, 4690, 4821, 4847, 6109, 6198, 6296, 6311), plus web/js/407f-engineering-adapter.js:2604-2606 and :2617-2619 which additionally push the raw text into the live region:
  const message=String(error?.message||error);
  bridge.toast(message);
  announceGlobal(`${file.name} could not be added: ${message}`);

Strings that reach those toasts, each read in situ:
- web/js/persistence/indexeddb-adapter.js:15  throw new Error("INDEXED_DB_UNAVAILABLE")  — plus :4 "IndexedDB request failed." and :8 "IndexedDB transaction failed." / "IndexedDB transaction aborted.", surfaced through store.mutateWithBlobs's rethrow (web/js/uxr-002/store.js:540-545).
- src/security/authorization.ts:115  new TimelineError("FORBIDDEN", `Timeline action denied: ${decision.reason}`, 403) — with reasons like STUDENT_NOT_OWNER_OR_ACTION_DENIED (:62), ADVISOR_NOT_ASSIGNED_OR_ACTION_DENIED (:76), DENY_BY_DEFAULT (:104). src/api/http-api.ts:92 sends the raw message for any status < 500, and web/js/production/timeline-auth-client.js:156 rethrows it as TimelineProductionAuthError(message = payload.error.message).
- src/storage/production/r2-private-object-store.ts:333 "Pending object not found.", :355 "Object integrity does not match the signed request.", :358 "Upload confirmation was already consumed.", :573 "Private object storage is unavailable."
- web/js/407f-engineering-adapter.js:951-952  "A durable private-media object ID is required." / "A private-media SHA-256 checksum is required."

The already-humanised strings prove the intended register: web/js/production/timeline-auth-client.js:242 "Timeline media could not reach private storage. Your timeline was not changed." and :182 "File Vault is temporarily unavailable. You can still upload a CV from this device."

**Student impact:** A student in Safari private browsing, or with site storage blocked, gets a toast reading exactly "INDEXED_DB_UNAVAILABLE". A student who hits a stale entitlement gets "Timeline action denied: STUDENT_NOT_OWNER_OR_ACTION_DENIED". A retried media upload gets "Upload confirmation was already consumed." None of these tell the student what happened or what to do, and all of them are §11 vocabulary leaks.

**Proposed fix:** Add one mapper next to escapeMarkup in web/js/407f-engineering-adapter.js (near line 735) and route the toast sites through it:

  const STUDENT_SAFE_MESSAGES=Object.freeze({
    INDEXED_DB_UNAVAILABLE:"This browser is blocking Timeline from saving on this device. Turn off private browsing or allow site storage, then reload.",
    FORBIDDEN:"Your MissionMed access to this Timeline has changed. Reload Timeline Builder to continue.",
    OBJECT_UPLOAD_NOT_PENDING:"That upload already finished. Try adding the file again.",
    OBJECT_UPLOAD_REPLAYED:"That upload already finished. Try adding the file again.",
    PRIVATE_OBJECT_STORAGE_UNAVAILABLE:"Secure media storage is temporarily unavailable. Your timeline was not changed.",
    OBJECT_SIZE_MISMATCH:"That file could not be verified after upload. Try adding it again.",
    OBJECT_HASH_MISMATCH:"That file could not be verified after upload. Try adding it again.",
    OBJECT_MIME_MISMATCH:"That file type could not be verified. Try adding it again."
  });
  const GENERIC_TROUBLE="Something went wrong. Your saved information is still safe — try that again.";
  function studentSafeMessage(error){
    const code=String(error?.code||"").toUpperCase();
    if(STUDENT_SAFE_MESSAGES[code])return STUDENT_SAFE_MESSAGES[code];
    const raw=String(error?.message||error||"");
    if(STUDENT_SAFE_MESSAGES[raw.toUpperCase()])return STUDENT_SAFE_MESSAGES[raw.toUpperCase()];
    return /^[A-Z0-9_]{4,}$/.test(raw)||/^Timeline action denied/.test(raw)||/IndexedDB/.test(raw)
      ?GENERIC_TROUBLE
      :raw||GENERIC_TROUBLE;
  }

Then sed the 24 sites: `bridge.toast(String(error?.message||error))` → `bridge.toast(studentSafeMessage(error))`, and at :2605/:2618 `const message=studentSafeMessage(error);`. Messages the team already wrote in student voice pass through untouched, because they contain lowercase prose and no code shape.

### D-LANE-D-10 — The File Vault chooser lists documents that the very next click provably rejects
**Severity:** MINOR · **Location:** `wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php:607`

**Evidence:** The list endpoint builds descriptors with $require_version = false, while both endpoints that act on a selection demand true:
  :607  $descriptor = mmtl_filevault_source_descriptor($record, $owner_id, false);      // list
  :628  $descriptor = mmtl_filevault_source_descriptor($upstream['file'] ?? $upstream, get_current_user_id(), true);   // detail GET
  :653  $descriptor = mmtl_filevault_source_descriptor($detail['file'] ?? $detail, get_current_user_id(), true);       // ingestion POST

The gate that only fires when true is at :577-579:
  if ($require_version && ($version_id === '' || !is_array($version) || empty($version['upload_confirmed']))) { return null; }

So a vault file whose current version is missing or not upload-confirmed is listed and selectable, then 404s on the detail call with "That File Vault document is not available." (:626).

The list is also unfiltered by type. mmtl_filevault_source_allowed_type (:546-554) admits cv, personal_statement, certificate, application and other, but the ingestion endpoint accepts only PDF and DOCX (:655-661) and otherwise returns "Choose a PDF or DOCX document for Smart Fill." (415).

The browser passes all of this through unchanged: web/js/uxr-002/filevault-source.js:116-131 renders whatever the endpoint returns, and web/js/407f-engineering-adapter.js:6295-6297 just toasts the resulting error.

**Student impact:** A student opens "Choose a document", sees their scanned certificate JPG or a half-uploaded file listed alongside their CV, selects it, presses USE THIS DOCUMENT, and gets "That File Vault document is not available." on a row the app itself just offered them. It reads as the app being broken rather than as a wrong choice.

**Proposed fix:** One-character change plus a type filter, both in the Timeline SSO gateway (this is the Timeline plugin, not unrelated WordPress).

missionmed-timeline-sso.php:607 — require a confirmed version at list time so the chooser and the ingestion agree:
  $descriptor = mmtl_filevault_source_descriptor($record, $owner_id, true);

And immediately below, extend the existing skip condition (:608-610) to drop anything Smart Fill cannot read:
  if ($descriptor === null
      || !in_array((string) $descriptor['mimeType'], array('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'), true)
      || ($query !== '' && stripos($descriptor['name'], $query) === false)) {
      continue;
  }

If the upstream /mmed/v1/files list payload turns out not to carry a `versions` array (in which case mimeType is '' for every row and the filter would empty the list), apply the equivalent client-side guard instead — web/js/uxr-002/filevault-source.js:119-122, filter the mapped documents on `!document.mimeType || PDF/DOCX` before the `.slice(0,20)`.

### D-LANE-D-11 — Turning on secure saving leaves the badge reading "SAVED LOCALLY" because REMOTE_SYNC_CONSENTED is not an observable state
**Severity:** MINOR · **Location:** `matrix/hybrid-indexeddb-adapter.js:365`

**Evidence:** matrix/hybrid-indexeddb-adapter.js:361-368:
  setRemoteSyncConsent(consent) {
    this.remoteSyncConsent = consent === true;
    if (!this.remoteSyncConsent) { … this.report("REMOTE_CONSENT_REQUIRED", { pending: 0 }); return false; }
    this.report("REMOTE_SYNC_CONSENTED", {});
    this.scheduleFlush(100);
    return true;
  }

observableSyncState (:25-30) has no case for "REMOTE_SYNC_CONSENTED" (nor for "LOCAL_READY", reported at :72), and OBJECT/OBSERVABLE_SYNC_STATES (:6-15) does not contain it, so it falls through to `return currentState`.

For a first-time student the current state at that moment is still the constructor default "LOCAL_ONLY" (:61-66) — open() reported LOCAL_READY (no-op) then REMOTE_CONSENT_REQUIRED → LOCAL_ONLY (:72-74), and there is no server document to trigger the SERVER_HYDRATED path (web/js/production/timeline-production-runtime.js:60-67 is skipped when `active` is null). setRemoteSyncConsent(true) is called at timeline-production-runtime.js:68, after open().

remoteSyncPresentation maps LOCAL_ONLY to ["SAVED LOCALLY","isSaved"] (web/js/407f-engineering-adapter.js:969), and reflectStoreStatus renders it verbatim (…:5335-5337).

**Student impact:** A student who has just switched on "secure saving" — the whole point of which is cross-device durability — watches the header still say "SAVED LOCALLY" until the first flush lands. Combined with the fact that consent triggers a full page reload (web/js/407f-engineering-adapter.js:805), this is the first thing they see after opting in, and it says the opposite of what they were promised.

**Proposed fix:** matrix/hybrid-indexeddb-adapter.js:29 — add the two missing translations alongside the existing REMOTE_CONSENT_REQUIRED case in observableSyncState:
  if (eventState === "REMOTE_CONSENT_REQUIRED") return "LOCAL_ONLY";
  if (eventState === "REMOTE_SYNC_CONSENTED") return "SYNCING";
  if (eventState === "LOCAL_READY") return Number(detail.pending ?? 0) > 0 ? "SYNC_PENDING" : currentState;

"SYNCING" maps to ["SYNCING…","isSaving"] (web/js/407f-engineering-adapter.js:964) and is truthful for the ~100 ms until scheduleFlush(100) fires flushPending, which then reports the real terminal state (SYNCED / SYNC_PENDING / OFFLINE / CONFLICT, :317-329).

### D-LANE-D-12 — File Vault selection makes two round trips for a versionId the chooser already has
**Severity:** MINOR · **Location:** `web/js/407f-engineering-adapter.js:6285`

**Evidence:** web/js/407f-engineering-adapter.js:6284-6289:
  const selectedDescriptor=await fileVaultSource.select(selected.value);
  const imported=await selectFileVaultSourceDocument(fileVaultSource,selected.value,{
    timelineDocumentId:store.document.id,
    versionId:String(selectedDescriptor?.versionId||"")
  });

The first call takes the no-options branch of the adapter (web/js/uxr-002/filevault-source.js:80-81: `const payload=await request(`/${encodeURIComponent(id)}`); return payload?.document||null;`) purely to read versionId. But the chooser model already carries it for every row — normalizeFileVaultSourceDocument keeps `versionId:String(record?.versionId||"")` (filevault-source.js:95) and queryFileVaultSource returns those normalized documents (:119-122). The renderer simply drops it: renderFileVaultSourceChooser emits only `value="${escapeHtml(document.id)}"` on each radio (:149).

Each of those GETs is a WordPress REST hop that internally does rest_do_request('/mmed/v1/files/{id}') against File Vault (missionmed-timeline-sso.php:624-631), so the detour is a full extra upstream fetch. It also creates a failure mode with no recovery: if the descriptor GET succeeds but returns an empty versionId, the `if(timelineDocumentId&&versionId)` branch (filevault-source.js:63) is skipped, the plain GET returns a descriptor with no `.file`, and the handler dead-ends on the generic throw at :6290.

**Student impact:** Noticeable added latency between pressing USE THIS DOCUMENT and anything happening, on top of the byte transfer — with the modal still open and no progress state. In the empty-versionId case the student gets "Timeline could not open that File Vault document for Smart Fill." for a document the chooser presented as usable.

**Proposed fix:** Carry the versionId on the radio and drop the extra request.

1) web/js/uxr-002/filevault-source.js:149 — add the attribute:
  <input type="radio" name="file-vault-source" value="${escapeHtml(document.id)}" data-version-id="${escapeHtml(document.versionId)}">

2) web/js/407f-engineering-adapter.js:6284-6289 — replace the two calls with one:
  const versionId=String(selected.dataset.versionId||"");
  if(!versionId)throw new Error("That File Vault document has no finished version yet. Choose another document.");
  const imported=await selectFileVaultSourceDocument(fileVaultSource,selected.value,{
    timelineDocumentId:store.document.id,
    versionId
  });

The WordPress ingestion endpoint independently re-fetches and re-verifies the version anyway (missionmed-timeline-sso.php:650-655 dispatches /mmed/v1/files/{id} and hash_equals-checks the supplied versionId against the owner-scoped descriptor), so nothing is trusted from the client that was not already re-validated server-side.

## B — Renderer / Layout / Export

SCOPE READ (all opened and read, not inferred): web/presentation/d1-409h-a1/D1-409H_VISUAL_MASTER.js (all 901 lines), D1-409H_VISUAL_MASTER.css (geometry/type sections), D1-409H_FINAL_VISUAL_MASTER.html, PROTECTED_HASHES.sha256; web/js/d1-411a/domain-visual-adapter.js (all 419), presentation-kernel-adapter.js (all 209), export-adapter.js (all 59), kernel-host.js (mount, _renderRecord, updateProjection, _axisLayout, _applyPresentationOverrides, _fitProtectedFurnitureText, _applyAdvancedOverlay, _refreshHits, resize, _fail, manager, export adapter); web/js/export/pdf-writer.js (all 67); web/js/layout-engine.js (all 81); web/js/uxr-002/adaptive-layout.js (assignStableLanes + interval helpers); web/js/uxr-002/canvas.js (empty state, patchPersistentCanvas, lane drop); web/js/407f-engineering-adapter.js (autoArrange, renderResponsiveAdvancedBoard, builderPreviewKernel/mountBuilderPreview, renderExportPreview, advisor/intake preview); web/js/uxr-002/export-screen.js (render-input boundary); scripts/serve.mjs, scripts/build-static.mjs; web/styles/407f-upgrade.css + uxr-002.css empty-state rules.

IMPORTANT — CONCURRENT EDIT WARNING: web/js/d1-411a/kernel-host.js is being modified live by another agent. HEAD is e0c87ce but the file has uncommitted changes (mtime 15:25, file now 2030 lines / 101792 bytes vs 95392 at session start). Another lane has ALREADY landed `relocateOutOfBoundsLabels` (line 122), `failSoftRenderMessage` (line 157), `relocateCollidingArrows` (line 195), an enlarged 26-attempt recovery budget (line 361) and new recovery branches at lines 388 and 408. scripts/serve.mjs is also modified (D-01). All kernel-host line numbers in my findings are against the CURRENT WORKING TREE, not e0c87ce — re-verify before applying. Findings B-05 and B-11 are defects IN that new code, not in the committed baseline.

ARCHITECTURE FACTS THE LEAD NEEDS:
1. There is exactly ONE canonical renderer for the board: the protected D1-409H kernel, mounted per-surface as a separate `<d1-timeline-kernel>` custom element wrapping its own iframe of D1-409H_FINAL_VISUAL_MASTER.html?defer=1. Export uses the SAME kernel instance on the "export" surface (kernel-host.js createD1411AKernelExportAdapter → `element.exportBoard`), so export fidelity == the export-surface preview. web/js/uxr-002/board-renderer.js is a legacy SVG renderer still imported by canvas.js/preview.js/theme-picker.js/advanced-board.js but the canvas takes the protected branch whenever `rendered.kind` starts with "d1-411a-". web/js/layout-engine.js is dead relative to the canonical board (only interactions.js imports it).
2. Surfaces differ ONLY in `surface` name, `interactive`, and `audience`: 407f:3366-3371 sends home/builder/lightbox with audience "INTERVIEWER_SAFE"; 407f:1484-1494 defaults everything else (edit, advisor, intake, export) to "EVERYTHING". Home and Edit therefore feed the SAME profile object to the SAME fitProfile code — which is why I could not attribute D-03 to a surface-specific input by static reading. That is exactly what B-12 unblocks (one-line diagnostic), and B-03 fixes both candidate causes regardless.
3. The host scales the IFRAME ELEMENT, not the protected board (kernel-host.js resize(): iframe forced to 1920x1080 + CSS transform, then `K.resize({scale:1})`). All kernel measurements are therefore scale-independent — the TEXT_FIT retry loop's `this.resize()` cannot change any measured quantity, which is the core of B-03.
4. The kernel's post-render laws cover ONLY `.arrow` descendants (.die/.date/.loc) against six frozen FURNITURE_RECTS. Milestone flags, the sticky note, the interview ribbon and the year axis are entirely unpoliced — B-04, B-08 and B-09 all live in that blind spot, and together they are the most likely explanation for the Founder's "jumbled text in the upper-right corner" of exports (flags are pinned at a single y=82 row across the full axis width with nowrap labels, and the axis end plus the logo/ribbon chrome all occupy x>1500).
5. D-02 is 

| ID | Sev | Finding | Location |
|---|---|---|---|
| B-01 | BLOCKER | D-02 full extent: 9 protected runtime assets are absent from web/, the core-asset gate is unreachable by the host fail-soft path, and its rejection is permanently memoised | `web/js/d1-411a/kernel-host.js:329` |
| B-02 | BLOCKER | D-04 root cause: autoArrange() overwrites every event.lane with unbounded interval-packing lanes, which are then silently clamped to 6 and honoured by the kernel adapter with no overlap check | `web/js/407f-engineering-adapter.js:876` |
| B-03 | BLOCKER | D-03: TEXT_FIT_UNRESOLVED has no fail-soft path, the four host retries provably cannot change any measured input, and the kernel's mat-exclusion gate hard-fails before it ever attempts to shrink | `web/js/d1-411a/kernel-host.js:372` |
| B-04 | BLOCKER | Milestone flags get no de-collision at all: every flag is pinned at top:82px with a nowrap label and is excluded from the kernel's bounds/collision law — this is the Founder's 'jumbled text in the upper-right corner' | `web/presentation/d1-409h-a1/D1-409H_VISUAL_MASTER.js:302` |
| B-05 | MAJOR | A right-edge OBJECT_OUT_OF_BOUNDS caused by the arrow's .date label is unrecoverable — relocateOutOfBoundsLabels only edits loc/lp, so the budget burns and the board goes dead | `web/js/d1-411a/kernel-host.js:122` |
| B-06 | MAJOR | The Lane Assignment Law's overlap test uses month intervals only and ignores the kernel's frozen 88px minimum arrow width, so short near-adjacent events are packed into one lane and then draw on top of each other | `web/js/d1-411a/presentation-kernel-adapter.js:131` |
| B-07 | MAJOR | D-05: a zero-event canvas renders a dark gradient placeholder with none of the board's furniture, and the protected kernel cannot render an empty model at all | `web/js/uxr-002/canvas.js:1455` |
| B-08 | MAJOR | The explanation callout (sticky note) is silently discarded for essentially every real timeline because the frozen sticky-endpoint window only accepts a target ending at x 1040-1200 | `web/presentation/d1-409h-a1/D1-409H_VISUAL_MASTER.js:591` |
| B-09 | MAJOR | The interview ribbon label is clipped mid-word and the interview date is emitted raw, with no host fit pass — the second contributor to the upper-right jumble | `web/js/d1-411a/kernel-host.js:917` |
| B-10 | MAJOR | EVENT_LANE_AUTOASSIGNED fires for every work / clinical / personal event even when it lands in its canonical lane with zero contention, so a clean board reports 8 fake layout warnings | `web/js/d1-411a/presentation-kernel-adapter.js:152` |
| B-11 | MINOR | relocateCollidingArrows picks a replacement lane by month-overlap alone and never checks the furniture geometry it exists to escape, so it can spend its whole budget moving an arrow between lanes that all still sit on the Color Key | `web/js/d1-411a/kernel-host.js:205` |
| B-12 | MINOR | The host discards error.message on render failure, so the two entirely different causes of TEXT_FIT_UNRESOLVED are indistinguishable from the diagnostics the lead is triaging with | `web/js/d1-411a/kernel-host.js:420` |

### B-01 — D-02 full extent: 9 protected runtime assets are absent from web/, the core-asset gate is unreachable by the host fail-soft path, and its rejection is permanently memoised
**Severity:** BLOCKER · **Location:** `web/js/d1-411a/kernel-host.js:329`

**Evidence:** `ls web/presentation/d1-409h-a1/assets` returns ONLY `fonts`. `ls dist/presentation/d1-409h-a1/assets` returns `fonts photos tex` and `shasum -a 256` on those 9 files (8 x assets/tex/*, assets/photos/us_flag.png) matches web/presentation/d1-409h-a1/PROTECTED_HASHES.sha256 byte for byte. The protected gate is D1-409H_VISUAL_MASTER.js:662-666 `const core=['assets/tex/board_denim.jpg','assets/tex/paper_bond.png','assets/tex/leather_pebble.png']; ... if(oks.some(o=>!o))throw err('ASSET_LOAD_FAILED','core protected asset failed to load');` — note err() is called with NO `extra`, so the thrown error has no `.path`. kernel-host.js:329 `await K.ready();` is executed in `_mount()` OUTSIDE `_renderRecord`, so the FAIL_SOFT_MEDIA_CODES loop (kernel-host.js:17 and 435-445) never sees it at all; `_mount` rejects straight into `_fail(error)`. D1-409H_VISUAL_MASTER.js:678 `ready(){ if(!K.readyPromise)K.readyPromise=assetReady(); return K.readyPromise; }` memoises the rejected promise, so that iframe can never recover even after the files appear. Export dies too: exportBoard inlines every CSS `url('assets/...')` and every `<img src>` via `toDataURL`, which throws `err('EXPORT_FAILED','asset fetch failed: '+url)` on a 404 — so assets/photos/us_flag.png alone breaks PNG/PDF export for any timeline containing a 'Moved > USA' milestone (buildFlags, D1-409H_VISUAL_MASTER.js:307).

**Student impact:** Every timeline surface (Home preview, Builder preview, Edit canvas, Export preview) is a dead blue-grey box with 'We could not display your timeline.' Even after the server is fixed, the surface stays dead until the page is fully reloaded, because the rejected readyPromise is cached. If only us_flag.png is missing, the board renders but PNG/PDF export fails outright for anyone who added a 'Moved to USA' milestone.

**Proposed fix:** 1) Restore the assets (no kernel bytes touched, hash-verified): `mkdir -p web/presentation/d1-409h-a1/assets/tex web/presentation/d1-409h-a1/assets/photos && cp dist/presentation/d1-409h-a1/assets/tex/*.{jpg,png} web/presentation/d1-409h-a1/assets/tex/ && cp dist/presentation/d1-409h-a1/assets/photos/us_flag.png web/presentation/d1-409h-a1/assets/photos/`. Then verify with `cd web/presentation/d1-409h-a1 && shasum -a 256 -c PROTECTED_HASHES.sha256`. scripts/build-static.mjs:101-111 `acceptedAsset()` reads `join(web,path)` first and still re-verifies sha256 against the accepted manifest, so the build stays fail-closed. 2) Host hardening in kernel-host.js:329 — wrap the gate so the failure is honest and recoverable:
```js
try{ await K.ready(); }
catch(error){
  if(String(error?.code||"")==="ASSET_LOAD_FAILED"){
    this.dataset.lastFailureContext=JSON.stringify({surface:record.surface,stage:"core-asset-gate",message:String(error?.message||"")});
    // K.readyPromise is memoised on rejection; the only recovery is a fresh frame.
    iframe.remove();
    this._kernel=null;
  }
  throw error;
}
```
so a retry re-creates the iframe instead of re-awaiting a permanently rejected promise.

### B-02 — D-04 root cause: autoArrange() overwrites every event.lane with unbounded interval-packing lanes, which are then silently clamped to 6 and honoured by the kernel adapter with no overlap check
**Severity:** BLOCKER · **Location:** `web/js/407f-engineering-adapter.js:876`

**Evidence:** 407f-engineering-adapter.js:876-882 `function autoArrange(document){ const lanes=assignStableLanes(document.events||[]).laneById; for(const event of document.events||[]){ event.lane=lanes[event.id]; delete event.manualY; } return document; }` — re-run on many mutations (407f:4032 and 407f:4551 `if(result.effects?.rerunAutoArrange)autoArrange(result.document)`), and also from canvas.js:828 on every lane drag. web/js/uxr-002/adaptive-layout.js:399 `const laneIndex=(affinity[0]??legal[0]??existingLaneCount); place(item,laneIndex);` is UNBOUNDED — it will happily emit lane 7, 8, 9…; adaptive-layout.js:330-332 makes an open-ended event occupy `Number.MAX_SAFE_INTEGER`, so a single 'Active/ongoing' item blocks its lane for every later event and drives the lane count up fast; adaptive-layout.js:336-337 `intervalsHaveClearMonth` additionally demands a whole clear month between neighbours. That lane value is then read by web/js/d1-411a/domain-visual-adapter.js:140 `if(Number.isInteger(event?.lane))result.lane=Math.max(0,Math.min(6,event.lane));` — 7, 8, 9 all silently become 6 — and web/js/d1-411a/presentation-kernel-adapter.js:134-136 `if(a._ovr!==null){ a.lane=a._ovr; laneOcc[a.lane].push(a); return; }` accepts the override with NO overlap test and NO warning, bypassing the entire Lane Assignment Law. LANE_Y[6]=564 (D1-409H_VISUAL_MASTER.js:81), so every clamped event is drawn at the same y with fully overlapping .al labels.

**Student impact:** A routine 15-event timeline with two or three 'Active' items ends up with three or more arrows drawn on top of each other in the bottom research row, labels unreadable, and (because those arrows also sit over the Color Key) the 'Some items overlap…' banner. The student cannot fix it by dragging, because the next autoArrange run re-derives the same clamped lanes.

**Proposed fix:** Two surgical edits. (a) domain-visual-adapter.js:140 — stop silently clamping a machine-generated lane into a legal one; only honour genuinely in-range lanes:
```js
if(Number.isInteger(event?.lane)&&event.lane>=0&&event.lane<=6)result.lane=event.lane;
```
(b) presentation-kernel-adapter.js:134-136 — verify the override before trusting it, and fall through to the band law when it collides:
```js
if(a._ovr!==null&&!laneOcc[a._ovr].some(o=>overlap(o,a))){ a.lane=a._ovr; laneOcc[a.lane].push(a); return; }
if(a._ovr!==null) warnings.push('EVENT_LANE_OVERRIDE_REJECTED:'+a.id+':'+a._ovr);
```
(c) Optional follow-up, same file adaptive-layout.js:399: clamp the generator itself with `const laneIndex=Math.min(6,(affinity[0]??legal[0]??existingLaneCount));` so it can never emit a lane the kernel rejects.

### B-03 — D-03: TEXT_FIT_UNRESOLVED has no fail-soft path, the four host retries provably cannot change any measured input, and the kernel's mat-exclusion gate hard-fails before it ever attempts to shrink
**Severity:** BLOCKER · **Location:** `web/js/d1-411a/kernel-host.js:372`

**Evidence:** kernel-host.js:372-386 retries on TEXT_FIT_UNRESOLVED up to 4 times, and the only thing it does between attempts is `this.resize()` + two child rAFs. resize() (kernel-host.js:~1780) sets `iframe.style.width='1920px'; iframe.style.height='1080px'` and scales the IFRAME ELEMENT, then calls `this._kernel.resize({scale:1})`. Everything the fit engine measures lives inside `#board{position:relative;width:1920px;height:1080px}` (D1-409H_VISUAL_MASTER.css:59-60) with `#profile{position:absolute;left:18px;top:634px;width:566px;height:428px}` and `#profile .txt{max-width:352px}` (CSS:241-247) — all absolute px, so the child viewport size cannot alter a single measured quantity. The retries are therefore identical no-ops. When they are exhausted, TEXT_FIT_UNRESOLVED is in neither FAIL_SOFT_LAYOUT_CODES (kernel-host.js:18) nor FAIL_SOFT_MEDIA_CODES (kernel-host.js:17), so kernel-host.js:435 `if(!FAIL_SOFT_MEDIA_CODES.has(...)){...throw error;}` blanks the surface. Two distinct kernel paths raise the code: D1-409H_VISUAL_MASTER.js:547 `if(wrappedInBand())return 'TEXT_FIT_UNRESOLVED';` — a HARD fail taken BEFORE the shrink loop on line 548, triggered whenever any profile line whose rect falls in the photo-mat band reaches `r.width>=maxW-8` (maxW = 352); and D1-409H_VISUAL_MASTER.js:518 `const maxH=card.clientHeight-...` combined with kernel-host.js `_applyPresentationOverrides` which sets `profile.style.height=clamp(finite(profileGeometry.height,428),272,680)` — a student-shrunk profile card (down to 272px) leaves maxH=220 against ~334px of text, unfixable at the 11px floor.

**Student impact:** The Home preview is a dead grey box with 'We could not display your timeline. Your saved information is still safe.' even though 15 events are present and saved. Any student whose Visa Status / USCE / Research / Languages line wraps to a full 352px column inside the portrait-well band (y 658-864) hits the hard gate with zero degradation attempted.

**Proposed fix:** (a) Pre-empt the hard gate in the host projection, which already owns this exact trick for one field. domain-visual-adapter.js:77-88 has `profileVisaDisplay(value)` that inserts a soft `\n` past 18 chars; the kernel renders `\n` as `<br>` (D1-409H_VISUAL_MASTER.js `line()` in hydrateFurniture). Generalise it and apply it to every long field, so no line can reach full column width:
```js
function wrapProfileValue(value,limit=30){
  const display=clean(value); if(display.length<=limit)return display;
  const out=[]; let line='';
  for(const word of display.split(/\s+/)){
    const next=[line,word].filter(Boolean).join(' ');
    if(line&&next.length>limit){out.push(line);line=word;} else line=next;
  }
  if(line)out.push(line); return out.join('\n');
}
```
and use it at domain-visual-adapter.js:346-360 for `visaStatus`, `usceSummary`, `researchSummary`, `languages`, `hobbies` (keep profileVisaDisplay's 18-char budget for visaStatus). (b) Make the code fail soft in kernel-host.js: add `const FAIL_SOFT_TEXT_CODES=new Set(["TEXT_FIT_UNRESOLVED"]);` and, after the 4 refit retries are spent, retry once with a compacted profile (`kernelModel=structuredClone(kernelModel); for(const k of ['usce','research','languages','hobbies']) kernelModel.profile[k]=wrapProfileValue(kernelModel.profile[k]);`) before ever throwing.

### B-04 — Milestone flags get no de-collision at all: every flag is pinned at top:82px with a nowrap label and is excluded from the kernel's bounds/collision law — this is the Founder's 'jumbled text in the upper-right corner'
**Severity:** BLOCKER · **Location:** `web/presentation/d1-409h-a1/D1-409H_VISUAL_MASTER.js:302`

**Evidence:** buildFlags (D1-409H_VISUAL_MASTER.js:298-309) positions EVERY flag with `el.style.left=timeX(f.year,f.m)+'px'; el.style.top='82px';` — one fixed row, x from the axis only, no stacking and no horizontal separation. The label is `.flag .lbl{font-family:var(--f-serif);font-size:19px;margin-left:8px;white-space:nowrap;display:flex}` (D1-409H_VISUAL_MASTER.css:107-108) so it never wraps and never shrinks. postRenderChecks (D1-409H_VISUAL_MASTER.js:604-611) iterates `document.querySelectorAll('.arrow')` ONLY and inspects `.die`, `.date`, `.loc` — flags are never bounds-checked and never collision-checked, so neither the kernel nor the host ever notices. `#board{overflow:hidden}` (CSS:59) then clips whatever runs past x=1920. The host does not help either: kernel-host.js `_axisLayout` only rewrites `node.style.left` for flags, preserving the stack.

**Student impact:** A real applicant clusters milestones ('ECFMG Certified!', 'Match Day', 'Green Card', 'Interview Invitation') in the most recent 12-24 months, which the adaptive axis places at the right end. Their labels print on top of one another and the last one is sliced in half by the board edge — in the preview AND in the exported PNG/PDF, since export serialises the same committed #board.

**Proposed fix:** Add a host-side flag de-conflict pass, called from `_renderRecord` immediately after `await K.whenStable(record.renderId)` (right beside the existing `_applyPresentationOverrides` / `_fitProtectedFurnitureText` calls, kernel-host.js ~line 452). It only sets inline styles on host-created positions, touching no protected bytes:
```js
_deconflictFlags(childDocument){
  const flags=[...childDocument.querySelectorAll('.flag[data-object-id]')]
    .map((el)=>({el,left:cssNumber(el.style.left,0)}))
    .sort((a,b)=>a.left-b.left);
  const rows=[];                       // right-most occupied x per stacked row
  for(const flag of flags){
    const width=flag.el.getBoundingClientRect().width;
    // keep the whole pennant + label inside the 1920 board
    if(flag.left+width>1912){flag.el.style.left=`${Math.max(8,1912-width)}px`;flag.left=cssNumber(flag.el.style.left,0);}
    let row=0;
    while(rows[row]!=null&&flag.left<rows[row]+12)row+=1;
    rows[row]=flag.left+width;
    flag.el.style.top=`${82-row*30}px`;   // stack upward; row 0 keeps the frozen 82px
    flag.el.style.zIndex=String(5+row);
  }
}
```
Stacking upward (82, 52, 22) stays clear of the axis at y=112 and of the arrow lanes (LANE_Y[0]=196).

### B-05 — A right-edge OBJECT_OUT_OF_BOUNDS caused by the arrow's .date label is unrecoverable — relocateOutOfBoundsLabels only edits loc/lp, so the budget burns and the board goes dead
**Severity:** MAJOR · **Location:** `web/js/d1-411a/kernel-host.js:122`

**Evidence:** The kernel's bounds law checks three nodes per arrow: D1-409H_VISUAL_MASTER.js:605 `const parts=[a.querySelector('.die'),a.querySelector('.date'),a.querySelector('.loc')]` against `r.x<-2||r.y<70||r.x+r.w>1922||r.y+r.h>1082` (line 608-609). `.arrow .date{position:absolute;left:6px;top:-18px;...;white-space:nowrap}` (D1-409H_VISUAL_MASTER.css:153-154) so a late-axis arrow at x≈1850 with a date string like '11/18-2/20' extends past 1922. The new host recovery, kernel-host.js:122-146 `relocateOutOfBoundsLabels`, only ever mutates `event.lp` and `event.loc` — it never touches the date string or the arrow's x. If lp is already 'below' and there is no `loc`, it returns `changed:false` and the code falls straight through to kernel-host.js:435 `throw error`. If lp is 'left' it returns changed:true, retries, still fails on `.date`, and repeats until boundsRecoveryCount hits 6, then throws anyway.

**Student impact:** A student whose most recent rotation runs to the right-hand end of the axis gets a completely blank timeline with the generic failure message, and no amount of retrying helps. Because the same code runs on the export surface, they also cannot export.

**Proposed fix:** In kernel-host.js:122 `relocateOutOfBoundsLabels`, add a date-shortening step before giving up, and a final left-nudge. Insert after the `event.loc` handling inside the loop:
```js
    const date=String(event.date||"");
    if(date.includes('-')){                 // '11/18-2/20' -> '11/18' keeps the start, drops the tail
      event.date=date.split('-')[0].trim()+'…';
      shortened.push(event.id);
      continue;
    }
```
and extend the `parts` reporting with `LABEL_SHORTENED`. Note the date is a pure display string produced by the host at presentation-kernel-adapter.js:45-49 `displayDate()`, so shortening it is host-owned and does not alter any stored date.

### B-06 — The Lane Assignment Law's overlap test uses month intervals only and ignores the kernel's frozen 88px minimum arrow width, so short near-adjacent events are packed into one lane and then draw on top of each other
**Severity:** MAJOR · **Location:** `web/js/d1-411a/presentation-kernel-adapter.js:131`

**Evidence:** presentation-kernel-adapter.js:129-131 `const monthsX=e=>e.sy*12+e.sm; const monthsE=e=>e.ey*12+e.em; const overlap=(a,b)=> monthsX(a)<=monthsE(b) && monthsX(b)<=monthsE(a);` — purely temporal. The renderer, however, applies a pixel floor: D1-409H_VISUAL_MASTER.js:316 `const w=Math.max(88,x1-x0); /* frozen floor: founder short-arrow width */`. With the adaptive axis (D1-409H_VISUAL_MASTER.js:139-151, `base=92,k=36,total=1904`), a 10-year board gives roughly 190px per year, i.e. ~16px per month — so the 88px floor is worth about 5.5 months of axis. Two 2-month events three months apart do not 'overlap' by the adapter's test, land in the same lane, and are then drawn as two 88px arrows that physically overlap, with `.arrow .al` labels (CSS:145-151) sitting on top of each other.

**Student impact:** Students with short items — 'Step 2 CS', a 4-week observership, a 6-week externship — see two arrows fused into one blob with unreadable overlapping titles, even when the adapter reports no lane conflict at all.

**Proposed fix:** Give the adapter's overlap test the same pixel floor the renderer uses. In presentation-kernel-adapter.js, replace the `overlap` definition at line 131 with a version that pads short spans by the axis-equivalent of 88px + a gap. The axis math is deterministic and already replicated host-side, so compute it once before the lane pass:
```js
  // axisFor() in the protected kernel: base 92 + 36*max(n,0.6), normalised to 1904px.
  const spanYears=Math.max(1,(Math.max(...arrows.map(a=>a.ey))-Math.min(...arrows.map(a=>a.sy))+2));
  const pxPerMonth=(1904/spanYears)/12;
  const MIN_MONTHS=Math.ceil(96/Math.max(pxPerMonth,1));      // 88px arrow floor + 8px gap
  const paddedEnd=e=>Math.max(monthsE(e),monthsX(e)+MIN_MONTHS);
  const overlap=(a,b)=> monthsX(a)<=paddedEnd(b) && monthsX(b)<=paddedEnd(a);
```
This is layout-only; it never changes an event's dates, colour, or category.

### B-07 — D-05: a zero-event canvas renders a dark gradient placeholder with none of the board's furniture, and the protected kernel cannot render an empty model at all
**Severity:** MAJOR · **Location:** `web/js/uxr-002/canvas.js:1455`

**Evidence:** canvas.js:1455 `let board = emptyBoardMarkup(viewState);` and canvas.js:1462 `if ((document?.events || []).length) { ... }` — the protected kernel is only mounted when at least one event exists. canvas.js:1368-1380 `emptyBoardMarkup` returns just `<div class="canvas-empty-board">` + `<div class="canvas-axis-placeholder">` + a message. web/styles/407f-upgrade.css:3505-3519 styles that as `background:radial-gradient(ellipse at 50% 30%,#1c2946 0%,#131c31 55%,#0d1424 100%)` with a single 2px cyan rule — no denim board, no year axis, no title plaque, no Color Key, no profile sheet. The kernel genuinely cannot take an empty model: D1-409H_VISUAL_MASTER.js:189 `if(!Array.isArray(m.events)||m.events.length<1)fail('INVALID_SCHEMA','events[] required','events');`.

**Student impact:** On first entry — the single highest-drop-off moment — the student sees a dark blue rectangle bearing no resemblance to the artifact they were sold. There is no sense of 'this is the poster I am filling in', and after adding the first event the whole surface changes identity.

**Proposed fix:** Keep the empty state in the host (do not fabricate events for the kernel), but dress it as the real board. In canvas.js:1368 `emptyBoardMarkup`, emit the canonical 16:9 furniture skeleton and give it the protected board's own texture and axis geometry:
```js
function emptyBoardMarkup(state){
  const editable=isEditable(state);
  const years=Array.from({length:6},(_,i)=>new Date().getFullYear()-4+i);
  return `<div class="canvas-empty-board" data-logical-width="1920" data-logical-height="1080" role="${editable?"application":"region"}" aria-label="Timeline visualization, 0 events">
    <div class="canvas-empty-axis" aria-hidden="true">${years.map((y)=>`<span>${y}</span>`).join("")}<span>FUTURE</span></div>
    <div class="canvas-empty-key" aria-hidden="true"><b>COLOR KEY</b><i data-cat="work"></i><i data-cat="personal"></i><i data-cat="usmle"></i><i data-cat="usce"></i><i data-cat="res"></i></div>
    <div class="canvas-empty-profile" aria-hidden="true"></div>
    <div class="canvas-empty-message"><p>Your timeline poster starts here — add your first event.</p>
      <button type="button" data-canvas-action="open-builder">Open Builder</button></div>
  </div>`;
}
```
and in web/styles/407f-upgrade.css:3505 swap the radial gradient for the board's own chambray (`background:url('/timeline/presentation/d1-409h-a1/assets/tex/board_denim.jpg') 0 0/520px, linear-gradient(160deg,#3d5a80,#2d4160)`), with the axis strip at 5.8% top and the key/profile ghosts at the frozen 18px left column. Depends on B-01 restoring board_denim.jpg.

### B-08 — The explanation callout (sticky note) is silently discarded for essentially every real timeline because the frozen sticky-endpoint window only accepts a target ending at x 1040-1200
**Severity:** MAJOR · **Location:** `web/presentation/d1-409h-a1/D1-409H_VISUAL_MASTER.js:591`

**Evidence:** D1-409H_VISUAL_MASTER.js:84 `const STICKY_ENDPOINT={x0:1040,x1:1200,y0:236,y1:322};` and stickyEndpointLaw at D1-409H_VISUAL_MASTER.js:578-593: it resolves the target node, computes `hx=r.x+r.w, hy=r.y+r.h/2`, and unless that point lies inside that 160x86px window it does `document.getElementById('sticky').style.display='none'; document.getElementById('redptr').style.display='none'; warns.push('STICKY_HIDDEN_TARGET_OUT_OF_WINDOW');`. The sticky itself is nailed to `#sticky{position:absolute;left:1180px;top:214px}` (D1-409H_VISUAL_MASTER.css:272-273) and the pointer to `#redptr{left:1104px;top:246px}` (CSS:290). The window corresponds to an arrow ending roughly two-thirds along the axis in lane 1 or 2 only — the coordinates of the frozen sample fixture's `ev-2cs`. Meanwhile the host builds callouts for real explanation events (domain-visual-adapter.js:309-331) and maps them to the single sticky at presentation-kernel-adapter.js:169-175.

**Student impact:** A student uses the Builder's 'explain this gap' feature, writes 'Failed, then passed CS' or 'Maternity leave', and it simply never appears on their timeline or in their export — with no error and no explanation. They only find out at the interview.

**Proposed fix:** Re-place the sticky host-side after the render settles. Add to kernel-host.js `_renderRecord`, immediately after `await K.whenStable(record.renderId)` and the existing childDocument block:
```js
_restoreCallout(childDocument,record,warnings){
  if(!(warnings||[]).some((w)=>String(w).includes('STICKY_HIDDEN_TARGET_OUT_OF_WINDOW')))return;
  const sticky=childDocument.getElementById('sticky');
  const pointer=childDocument.getElementById('redptr');
  const targetId=record.projection.model.sticky?.targetObjectId;
  const target=targetId&&childDocument.querySelector(`[data-object-id="${CSS.escape(targetId)}"]`);
  if(!sticky||!pointer||!target)return;
  const board=childDocument.getElementById('board').getBoundingClientRect();
  const r=target.getBoundingClientRect();
  const hx=r.right-board.left, hy=r.top-board.top+r.height/2;
  // park the note above-right of its target, clamped inside the board and clear of
  // the right-hand logo/ribbon chrome (FURNITURE_RECTS start at x=1528)
  const x=clamp(hx+96,600,1380), y=clamp(hy-140,180,900);
  sticky.style.display='';sticky.style.left=`${x}px`;sticky.style.top=`${y}px`;
  pointer.style.display='';pointer.style.left=`${x-76}px`;pointer.style.top=`${y+32}px`;
}
```
The sticky and pointer are not in FURNITURE_RECTS and are not part of postRenderChecks, so repositioning them cannot re-trigger the collision law.

### B-09 — The interview ribbon label is clipped mid-word and the interview date is emitted raw, with no host fit pass — the second contributor to the upper-right jumble
**Severity:** MAJOR · **Location:** `web/js/d1-411a/kernel-host.js:917`

**Evidence:** kernel-host.js:917-928 `_fitProtectedFurnitureText` fits ONLY `#title span` (`while(size>18&&title.scrollWidth>540)`). Nothing fits the upper-right chrome. `#ivr{position:absolute;left:14px;right:14px;...;overflow:hidden}` inside `#ivrWrap{left:1548px;width:232px}` gives a 204px text box, and `#ivr span{font-size:22px;white-space:nowrap;padding:0 10px}` (D1-409H_VISUAL_MASTER.css:335,343,352) — so anything past roughly 13 characters at 22px PT Serif is hard-clipped with no ellipsis. The host feeds it arbitrary text: presentation-kernel-adapter.js:180 `const interview={ label: iv.ribbonText||'My Big Interview!', date: iv.interviewDateDisplay||iv.interviewDate||'' ...}` and domain-visual-adapter.js:381 `ribbonText:clean(interview.label)||"My Big Interview!"`. `#ivdate{left:1548px;width:232px;text-align:center;font-size:20px}` (CSS:357) has no nowrap, so a raw `interviewDate` such as '2026-01-14' or 'Wednesday, January 14, 2026' wraps into 2-3 ragged centred lines directly beneath the clipped ribbon.

**Student impact:** A student who names their interview ('Mount Sinai Categorical IM') sees 'Mount Sinai Categ' amputated at the ribbon edge, with a wrapped date stack under it — in the preview and in the exported PDF they hand to a program.

**Proposed fix:** Extend kernel-host.js:917 `_fitProtectedFurnitureText` to cover the two upper-right nodes, using the same shrink-then-truncate shape the kernel uses for arrow labels:
```js
  const ribbon=childDocument.querySelector('#ivr span');
  if(ribbon){
    let size=22;ribbon.style.fontSize=`${size}px`;
    while(size>14&&ribbon.scrollWidth>184){size-=1;ribbon.style.fontSize=`${size}px`;}
    let text=ribbon.textContent||"";
    while(ribbon.scrollWidth>184&&text.length>6){text=text.slice(0,-2).trim();ribbon.textContent=`${text}…`;}
  }
  const date=childDocument.getElementById('ivdate');
  if(date){date.style.whiteSpace='nowrap';date.style.overflow='hidden';date.style.textOverflow='ellipsis';}
```
Also normalise the fallback at presentation-kernel-adapter.js:181 so a bare ISO date is never shown raw: `date: iv.interviewDateDisplay || (iv.interviewDate ? new Date(`${iv.interviewDate}T00:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}) : '')`.

### B-10 — EVENT_LANE_AUTOASSIGNED fires for every work / clinical / personal event even when it lands in its canonical lane with zero contention, so a clean board reports 8 fake layout warnings
**Severity:** MAJOR · **Location:** `web/js/d1-411a/presentation-kernel-adapter.js:152`

**Evidence:** presentation-kernel-adapter.js:138-152: `for(const l of band){ if(!laneOcc[l].some(o=>overlap(o,a))){ a.lane=l; laneOcc[l].push(a); placed=true; break; } } ... else if(band.length>1) warnings.push('EVENT_LANE_AUTOASSIGNED:'+a.id+':'+a.lane);` — the warning is keyed on `band.length>1`, not on whether the event was actually displaced. BANDS (line 21) are `work:[0,5], usmle:[1], usce:[2,3,4], res:[6], personal:[6,5,3,2]`, so every single work, usce and personal event warns even when it takes the band's FIRST lane with no overlap at all. Those warnings are surfaced verbatim by the host at kernel-host.js `this.dataset.projectionWarnings=JSON.stringify(projectionWarnings)` and dispatched on `d1-411a:ready`.

**Student impact:** Indirect but expensive: the '8 EVENT_LANE_AUTOASSIGNED warnings' in D-04 are almost entirely noise, which has been masking the two warnings that matter (EVENT_LANE_OVERFLOW / EVENT_LANE_SATURATED) and sends triage after phantom lane exhaustion. Any UI or QA gate keyed on warning count treats a perfectly laid-out board as degraded.

**Proposed fix:** Only warn when the event was actually displaced from its canonical lane. presentation-kernel-adapter.js:136-152 — capture the band head and compare:
```js
    const band=BANDS[a.cat]||[6];
    const canonical=band[0];
    let placed=false;
    for(const l of band){ ... }
    ...
    else if(a.lane!==canonical) warnings.push('EVENT_LANE_AUTOASSIGNED:'+a.id+':'+a.lane);
```

### B-11 — relocateCollidingArrows picks a replacement lane by month-overlap alone and never checks the furniture geometry it exists to escape, so it can spend its whole budget moving an arrow between lanes that all still sit on the Color Key
**Severity:** MINOR · **Location:** `web/js/d1-411a/kernel-host.js:205`

**Evidence:** kernel-host.js:173 `const LANE_RELOCATION_ORDER=[0,1,2,3,4,5,6];` and kernel-host.js:205-208 `const candidate=LANE_RELOCATION_ORDER.find((lane)=>{ if(seen.has(lane)||lane>KERNEL_LANE_MAX)return false; return !next.events.some((other)=> other!==arrow&&other.lane===lane&&arrowsOverlap(other,arrow)); });` — the only criterion is temporal freedom. But the collision the function is recovering from is geometric: FURNITURE_RECTS (D1-409H_VISUAL_MASTER.js:86-93) put `color-key` at y300 h322 (300-622) and `profile-sheet` at y634 h428, while LANE_Y=[196,252,316,382,448,506,564] (line 81) with `--arrow-h:48px`. Lanes 2,3,4,5,6 (y 316-612) ALL intersect the Color Key band, so an arrow whose x0 is left of x≈434 collides in every one of them. The function's own comment concedes this ('the two top lanes are the only ones that clear the left-hand furniture outright') but the implementation does not encode it: when lanes 0 and 1 are temporally busy it walks 2→3→4→5→6, each of which fails again, exhausting laneRelocationCount<5 (kernel-host.js:388) and falling through to EXISTING_LAYOUT_OVERLAP_RECOVERED anyway.

**Student impact:** Early-career events (medical school, internship in the first two axis years) still end up hidden behind the Color Key with the 'Some items overlap…' banner, after five wasted rerenders that visibly delay the board.

**Proposed fix:** Make the candidate test furniture-aware. kernel-host.js, next to LANE_RELOCATION_ORDER at line 173:
```js
const LANE_Y=[196,252,316,382,448,506,564];   // mirrors D1-409H_VISUAL_MASTER.js:81 (read-only)
const ARROW_H=48;
const LEFT_FURNITURE=[{x:434,y0:300,y1:622},{x:584,y0:634,y1:1062}]; // Color Key, profile sheet
function laneClearsFurniture(lane,x0){
  const top=LANE_Y[lane]-7,bottom=top+ARROW_H;
  return LEFT_FURNITURE.every((f)=>x0>=f.x||bottom<=f.y0||top>=f.y1);
}
```
then in the candidate predicate at line 205 add `if(!laneClearsFurniture(lane,arrowX0))return false;`, where arrowX0 is derived from the same adaptive-axis math used in B-06. Also reorder LANE_RELOCATION_ORDER to `[0,1,5,6,2,3,4]` so the two clear lanes and the two lowest-conflict lanes are tried first.

### B-12 — The host discards error.message on render failure, so the two entirely different causes of TEXT_FIT_UNRESOLVED are indistinguishable from the diagnostics the lead is triaging with
**Severity:** MINOR · **Location:** `web/js/d1-411a/kernel-host.js:420`

**Evidence:** kernel-host.js:420-431 records `this.dataset.lastFailureContext=JSON.stringify({surface,renderId,reason,revision,axisMode,events,flags})` — no message — and kernel-host.js:1831 `this.dataset.error=String(error?.code||error?.message||error);` keeps only the code because the code is always present. The protected kernel raises the SAME code from two unrelated places with two distinct messages: D1-409H_VISUAL_MASTER.js:652 `throw err('TEXT_FIT_UNRESOLVED','profile text cannot satisfy in-box + mat-exclusion law at floor size')` (the profile/mat gate) and D1-409H_VISUAL_MASTER.js:640 `rej(err('TEXT_FIT_UNRESOLVED','layout did not settle'))` inside twoFrameStable (a measurement-stability failure). The remedies for the two are completely different, and D1409H.diagnostics() does expose `lastError:{code,message,renderId}` (D1-409H_VISUAL_MASTER.js:757-758) — the host simply throws it away.

**Student impact:** No direct student impact, but it is why D-03 is still unresolved: the observed `error:"TEXT_FIT_UNRESOLVED"` cannot be attributed, so the fix cannot be targeted, and the dead Home preview persists.

**Proposed fix:** One-line change at kernel-host.js:420 — add the message and the kernel's own last error to the context block:
```js
          this.dataset.lastFailureContext=JSON.stringify({
            surface:record.surface,
            renderId:record.renderId,
            reason:record.reason,
            message:String(error?.message||""),
            kernelLastError:K.diagnostics?.()?.lastError||null,
            revision:record.projection.model.revision,
            axisMode:record.projection.model.axisMode,
            events:record.projection.model.events.length,
            flags:record.projection.model.flags?.length||0
          });
```
Apply once and reload Home: 'profile text cannot satisfy in-box + mat-exclusion law at floor size' confirms B-03(a) (fix by wrapping profile values); 'layout did not settle' points instead at twoFrameStable and the measureSig loop.

## F — Production / Console / Release Engineering

WHAT I READ (all absolute paths under /Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001):
- packages/mission-timeline/scripts/: build-static.mjs, build-wordpress-runtime.mjs, build-api.mjs, check-release.mjs, check-api-only-build.mjs, manage-d1-411c-release.mjs, serve.mjs (all in full)
- packages/mission-timeline/package.json, railway.json, README.md, release/{rollback-plan.md,feature-flags.json,manifest.json}
- packages/mission-timeline/infra/wordpress/missionmed-timeline-route.php (full, 500.0.8)
- wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php (enqueue/rewrite/proxy/bootstrap sections) + assets/matrix-launch.js (full)
- All 15 wp-content/mu-plugins/*.php grepped for script emission and enqueue ordering
- packages/mission-timeline/web/presentation/d1-409h-a1/{D1-409H_VISUAL_MASTER.js (asset gate + exportBoard), .css (url() inventory), D1-409H_FINAL_VISUAL_MASTER.html, PROTECTED_HASHES.sha256}
- packages/mission-timeline/web/js/d1-411a/kernel-host.js (head + fail-soft gate), web/js/production/*, web/js/uxr-002/board-renderer.js asset resolver, web/index.html head + ASSETS/SPR402 blocks
- packages/mission-timeline/src/storage/production/r2-private-object-store.ts, src/server/*
- _AI_HANDOFFS/from_codex/{D1-500_TIMELINE_PRODUCTION_LAUNCH, TIMELINE-RC1-STABILIZATION-001} reports + the in-git Kinsta artifact tree

HOW I VERIFIED
I decoded the actual shipped WordPress bundle (packages/mission-timeline/dist-wordpress/release.php, 10,424,176 bytes, built release-mode at HEAD e0c87ce) with a Python parser and read the rewritten bytes. That is how I can state as fact rather than inference that the protected kernel's core-texture probe IS correctly rewritten in production (`const core=['/timeline/_asset/9ac898468cf2',...]` at kernel line 664) and that us_flag is rewritten at line 307. I cross-checked every alias against PROTECTED_HASHES.sha256 (alias = first 12 hex of the sha256) — they match.

ARCHITECTURE FACTS THE LEAD MUST KNOW

1. PRODUCTION ASSET RESOLUTION CHAIN (answers Q2 and Q3). Railway serves API only — scripts/check-api-only-build.mjs hard-fails on `express.static`/`serve-static`/`web/index.html` and requires `path === "/healthz"` and `path.startsWith("/v1/")`. Every byte a student loads comes from WordPress. `/timeline/*` is handled by the mu-plugin route at template_redirect -20, which `include`s `missionmed-timeline-runtime/current/release.php` and echoes base64-decoded, sha256-verified bytes, then `exit`s. Assets are content-addressed: `/timeline/_asset/<first-12-hex-of-sha256>`. The route 404s ANY path containing a dot (line 335), so there is no filesystem fallback whatsoever — an unrewritten relative URL is an unconditional 404. `/timeline/api/v1/*` bypasses the route (early return) and is proxied to Railway by the SSO plugin via an `init` rewrite rule (activation/deactivation both flush — verified, not a defect).

2. D-02 IS TWO DIFFERENT PROBLEMS. In production it is currently FIXED-BY-CONSTRUCTION (the build-wordpress-runtime JS/CSS rewriters replace every texture reference with an authenticated `_asset` alias — I confirmed this in the shipped bytes). In `web/` it is REAL AND ACTIVE: 38 assets (8 tex, us_flag.png, 29 keynote PNGs) are absent from the tree and from git entirely, so every local/QA run blanks the board and breaks export. The two fixes are unrelated: F-01 fixes the dev surface (serve.mjs one-liner), F-02/F-08 add the guard rails that keep production from silently regressing. Do not "fix" D-02 by copying textures into web/ — they are intentionally git-ignored and their sha256 authority lives in PROTECTED_HASHES.sha256.

3. THE MOMENT/WP BUG IS NOT IN THIS PACKAGE. Exhaustive grep across all .php/.js/.mjs/.html in the worktree: zero references to moment, wp.date, wp-i18n, wp.hooks, wp.apiFetch, window.wp, or wpApiSettings. Structurally impossible on /timeline/ because mmtlr_serve exits before wp_head. The app gets its WP nonce over the wire from admin-ajax rather 

| ID | Sev | Finding | Location |
|---|---|---|---|
| F-01 | BLOCKER | D-02 root cause: web/ is missing 38 runtime binary assets (8 tex + us_flag + 29 keynote PNGs); serve.mjs only recovers them from an env var nobody sets | `packages/mission-timeline/scripts/serve.mjs:94` |
| F-02 | BLOCKER | build-wordpress-runtime.mjs silently leaves unresolvable JS asset literals relative (CSS and HTML rewriters throw) — a single miss blanks every student's canvas in production | `packages/mission-timeline/scripts/build-wordpress-runtime.mjs:67` |
| F-03 | MAJOR | The 9 protected binary assets exist in no git object and no in-repo manifest — only their sha256 authority is in-repo; a lost accepted-asset root makes the release permanently unbuildable | `packages/mission-timeline/scripts/build-static.mjs:113` |
| F-04 | MAJOR | THE MOMENT/WP BUG: no `moment` or `wp.*` consumer exists anywhere in the Timeline package or its two WordPress plugins — /timeline/ never renders wp_head, so the errors cannot originate there | `packages/mission-timeline/infra/wordpress/missionmed-timeline-route.php:363` |
| F-05 | MAJOR | matrix-launch.js is injected twice on the Matrix page with two different ?ver values, so the browser downloads and executes two separate copies | `packages/mission-timeline/infra/wordpress/missionmed-timeline-route.php:65` |
| F-06 | MAJOR | R2 presigned URLs are virtual-hosted (bucket subdomain) but the production CSP pins only the bare account host, so browser media upload/download is blocked by connect-src | `packages/mission-timeline/src/storage/production/r2-private-object-store.ts:638` |
| F-07 | MAJOR | The rollback tool cannot roll back the artifact students actually load: manage-d1-411c-release.mjs demands release-manifest.json, but WordPress runtime releases contain only release.php | `packages/mission-timeline/scripts/manage-d1-411c-release.mjs:40` |
| F-08 | MAJOR | build:release has no post-check on the WordPress bundle — check-release runs before build-wordpress-runtime and never inspects release.php | `packages/mission-timeline/package.json:15` |
| F-09 | MINOR | The release MIME allowlist and the PHP serving allowlist have drifted: build-static approves image/svg+xml and application/pdf-adjacent types the route will 404 | `packages/mission-timeline/infra/wordpress/missionmed-timeline-route.php:170` |
| F-10 | MINOR | Every student release ships the protected-asset hash inventory, which publicly names the founder's private family photo fixtures that check-release deliberately excludes | `packages/mission-timeline/scripts/build-static.mjs:100` |
| F-11 | MINOR | The release build refuses to run whenever any untracked file exists under packages/mission-timeline, which will block the cut while parallel agents are working | `packages/mission-timeline/scripts/build-static.mjs:37` |

### F-01 — D-02 root cause: web/ is missing 38 runtime binary assets (8 tex + us_flag + 29 keynote PNGs); serve.mjs only recovers them from an env var nobody sets
**Severity:** BLOCKER · **Location:** `packages/mission-timeline/scripts/serve.mjs:94`

**Evidence:** Filesystem check I ran: `web/presentation/d1-409h-a1/assets/` contains ONLY `fonts/` — no `tex/`, no `photos/`. `web/assets/keynote_classic_402a/` contains only `arrows/*.svg` (6 files), not the 29 accepted PNGs. `git ls-tree -r HEAD packages/mission-timeline/web/presentation/d1-409h-a1/` returns 15 paths, all fonts + the kernel files; `git log --all -- .../assets/tex` returns NOTHING. dist/ (built release-mode at HEAD e0c87ce) has all 38.

serve.mjs:94-98:
```
  if (
    (!target || !existsSync(target) || !statSync(target).isFile()) &&
    acceptedWebAssetRoot &&
    ["/web/", "/timeline/"].includes(mount.prefix)
  ) target = safeFile(acceptedWebAssetRoot, relativePath);
```
and serve.mjs:7 `const acceptedWebAssetRoot = String(process.env.TIMELINE_ACCEPTED_WEB_ASSET_ROOT || "").trim();` — empty by default, so the fallback is dead and all 38 assets 404.

The protected kernel then hard-fails: D1-409H_VISUAL_MASTER.js:664-666
```
  const core=['assets/tex/board_denim.jpg','assets/tex/paper_bond.png','assets/tex/leather_pebble.png'];
  const oks=await Promise.all(core.map(probe));
  if(oks.some(o=>!o))throw err('ASSET_LOAD_FAILED','core protected asset failed to load');
```
Export is broken by the same cause — D1-409H_VISUAL_MASTER.js:770-777 fetches the stylesheet then `toDataURL(u)` for every `url('assets/...')` it finds and throws `EXPORT_FAILED','asset fetch failed: '+url` on the first 404.

**Student impact:** Every local/QA/dev run of the app (and any static serve out of web/) shows a blank grey protected canvas plus 38 red 404s in the console, and PNG/PDF export throws EXPORT_FAILED. This is the surface the whole team is currently testing against, so every other visual defect is being judged on a broken board. Production (WordPress) is NOT affected — see F-02 for why.

**Proposed fix:** One-line, zero-blast-radius: default the accepted-asset fallback root to the already-built dist/ tree, which has an identical relative layout (dist/presentation/d1-409h-a1/assets/tex/..., dist/assets/keynote_classic_402a/...). Edit scripts/serve.mjs:7 from
`const acceptedWebAssetRoot = String(process.env.TIMELINE_ACCEPTED_WEB_ASSET_ROOT || "").trim();`
to
`const acceptedWebAssetRoot = String(process.env.TIMELINE_ACCEPTED_WEB_ASSET_ROOT || "").trim() || (existsSync(join(packageRoot, "dist", "presentation", "d1-409h-a1", "assets", "tex")) ? join(packageRoot, "dist") : "");`
(`join`/`existsSync` are already imported at lines 1 and 3; `packageRoot` is defined at line 6). The absolute-path guard at lines 8-10 still passes because join(packageRoot,...) is absolute. The fallback at line 94 only fires when web/ misses the file, so it can never shadow index.html or the unbundled ./js/ modules. Do NOT copy the bytes into web/ — they are deliberately git-ignored (see F-03).

### F-02 — build-wordpress-runtime.mjs silently leaves unresolvable JS asset literals relative (CSS and HTML rewriters throw) — a single miss blanks every student's canvas in production
**Severity:** BLOCKER · **Location:** `packages/mission-timeline/scripts/build-wordpress-runtime.mjs:67`

**Evidence:** The JS rewriter is the ONLY one of the three that fails open.

JS (lines 62-68):
```
for(const entry of raw.values()){
  if(!entry.path.endsWith(".js"))continue;
  let rewritten=entry.bytes.toString("utf8").replace(/(["'])(assets\/[A-Za-z0-9._\/-]+)\1/g,(match,quote,value)=>{
    const target=posix.normalize(posix.join(posix.dirname(entry.path),value));
    const asset=byPath.get(target);
    return asset?`${quote}/timeline/_asset/${asset.alias}${quote}`:match;   // <-- line 67: silent no-op
  });
```
CSS (line 46): `if(!asset)throw new Error(\`TIMELINE_RUNTIME_CSS_ASSET_MISSING:...\`)`.
HTML (line 91): `if(!asset)throw new Error(\`TIMELINE_RUNTIME_HTML_ASSET_MISSING:...\`)`.

I decoded the shipped dist-wordpress/release.php and confirmed the rewrite currently WORKS — kernel line 664 in the bundle reads `const core=['/timeline/_asset/9ac898468cf2','/timeline/_asset/19911fcac1fc','/timeline/_asset/7e0a6b400b02'];` and line 307 reads `im.src='/timeline/_asset/0a0853de3f10';`. So D-02 does not currently reproduce in production. But there is no guard.

The blast radius if it ever misses: infra/wordpress/missionmed-timeline-route.php:335 rejects any surviving relative path outright —
```
    if ($relative !== '' && (strlen($relative) > 2048 || preg_match('/[\x00-\x1F\x7F]/', $relative) || str_contains($relative, '.'))) {
        mmtlr_error(404, 'timeline_route_not_found', 'Timeline route was not found.');
```
so `/timeline/assets/tex/board_denim.jpg` 404s -> ASSET_LOAD_FAILED -> kernel-host.js:277 rethrows because a core-asset failure has no resolvable error.path.

Proof the regex is brittle: the same file's private-fixture literals at kernel lines 75-79 (`src:'assets/photos/ski.jpg'` etc.) are silently left relative today, because those paths are correctly absent from dist. Any future kernel edit to a template literal or a `assets/tex/${name}` form would be silently dropped the same way.

**Student impact:** If a kernel or bundler change ever moves one texture literal out of the exact `'assets/...'` single/double-quoted form, `npm run build:release` still exits 0, check-release still passes, and every student who opens /timeline/ gets a blank grey board with 'We could not display your timeline.' There is no build-time or release-time signal.

**Proposed fix:** Add a fail-closed assertion immediately after the JS loop closes (after line 82 of scripts/build-wordpress-runtime.mjs), before the HTML loop at line 84:
```
for(const entry of raw.values()){
  if(!entry.path.endsWith(".js"))continue;
  const text=byPath.get(entry.path).bytes.toString("utf8");
  for(const match of text.matchAll(/(["'])(assets\/[A-Za-z0-9._\/-]+)\1/g)){
    const target=posix.normalize(posix.join(posix.dirname(entry.path),match[2]));
    if(raw.has(target))throw new Error(`TIMELINE_RUNTIME_JS_ASSET_UNRESOLVED:${entry.path}:${target}`);
  }
}
```
This throws only when the referenced file IS in the release but was not rewritten — i.e. exactly the failure mode above. It deliberately stays silent for the excluded private fixtures (ski.jpg etc.), which are not in `raw`. No protected bytes are touched; this is host/build layer only.

### F-03 — The 9 protected binary assets exist in no git object and no in-repo manifest — only their sha256 authority is in-repo; a lost accepted-asset root makes the release permanently unbuildable
**Severity:** MAJOR · **Location:** `packages/mission-timeline/scripts/build-static.mjs:113`

**Evidence:** build-static.mjs:113-123 requires them at runtime:
```
const acceptedRuntimeAssets=[
  ...
  ...["board_denim.jpg","leather_pebble.png","paper_bond.png","paper_hotpress.png","paper_rc.png","print_grain.png","satin.png","sticky_pulp.jpg"].map((name)=>`presentation/d1-409h-a1/assets/tex/${name}`),
  "presentation/d1-409h-a1/assets/photos/us_flag.png"
];
for(const asset of acceptedRuntimeAssets)await acceptedAsset(asset);
```
and acceptedAsset (lines 101-107) can only source them from `web/` or `$TIMELINE_ACCEPTED_WEB_ASSET_ROOT`:
```
  const candidates=[join(web,path),...(externalWebRoot?[join(externalWebRoot,path)]:[])];
  ...
  if(!bytes)throw new Error(`TIMELINE_ACCEPTED_ASSET_MISSING:${path}`);
```
with line 19 making the external root mandatory in release mode:
`if(mode==="release"&&(!externalWebRoot||!externalManifestPath))throw new Error("TIMELINE_ACCEPTED_ASSET_AUTHORITY_REQUIRED");`

Verified they are nowhere in git: `git log --all -- packages/mission-timeline/web/presentation/d1-409h-a1/assets/tex` is empty. README.md:37-44 documents only placeholders (`<absolute-accepted-web-root>`, `<absolute-accepted-manifest>`) — the real paths are recorded nowhere in the repo.

Good news I confirmed: the sha256 AUTHORITY is in git. web/presentation/d1-409h-a1/PROTECTED_HASHES.sha256 lists all 9, e.g. `9ac898468cf2844247d1c4285565f95341a1c62b45d244d8ffd753e30b87ae75  assets/tex/board_denim.jpg` and `0a0853de3f10cd263705add297d9798eb767194f190d357911bb2f3372e8a933  assets/photos/us_flag.png` — and build-static.mjs:26-30 folds that file into `acceptedFiles`. Those hashes match the aliases in the shipped bundle (9ac898468cf2, 0a0853de3f10).

**Student impact:** Indirect but existential: if the out-of-band accepted-asset directory is not present on whichever machine runs the release inside the 24h window, `npm run build:release` dies with TIMELINE_ACCEPTED_ASSET_MISSING and no student-facing release can be cut at all. The bytes are unrecoverable from git.

**Proposed fix:** No script change. Two operational steps, ~10 minutes: (1) Pin a durable accepted-asset root now by copying the verified bytes out of the existing release-mode build — `mkdir -p <ROOT>/presentation/d1-409h-a1/assets && cp -R packages/mission-timeline/dist/presentation/d1-409h-a1/assets/tex packages/mission-timeline/dist/presentation/d1-409h-a1/assets/photos <ROOT>/presentation/d1-409h-a1/assets/` then verify with `shasum -a 256 -c` against web/presentation/d1-409h-a1/PROTECTED_HASHES.sha256. (2) Commit a new file `packages/mission-timeline/release/ACCEPTED_ASSET_SOURCE.md` recording the absolute ROOT path, the manifest path, the expected `asset_authority_manifest_sha256` (`0a49773ce353cb48cb9337214f2060eb934921db2d5396779d48565424a4e325`, read from dist/release-manifest.json), and the disaster-recovery path: the bytes are also embedded base64 in the in-git files `_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/artifacts/kinsta/wp-content/mu-plugins/missionmed-timeline-runtime/releases/timeline-wp-0fc51f8906decb8e/release.php` and can be extracted and verified against PROTECTED_HASHES.sha256.

### F-04 — THE MOMENT/WP BUG: no `moment` or `wp.*` consumer exists anywhere in the Timeline package or its two WordPress plugins — /timeline/ never renders wp_head, so the errors cannot originate there
**Severity:** MAJOR · **Location:** `packages/mission-timeline/infra/wordpress/missionmed-timeline-route.php:363`

**Evidence:** Exhaustive greps I ran over the whole worktree with `--include='*.php' --include='*.js' --include='*.mjs' --include='*.html'` for `\bmoment\b`, `wp\.date`, `wp-i18n`, `wp\.i18n`, `wp\.hooks`, `wp-hooks`, `wp-element`, `wp\.apiFetch`, `window\.wp`, `typeof wp`, `wpApiSettings`: ZERO hits in packages/mission-timeline/**, wp-content/mu-plugins/**, or wp-content/plugins/missionmed-timeline-sso/**. The only `moment` hits in the entire tree are English prose ('try again in a moment') at 407f-engineering-adapter.js:1244 and in StoryForge/USCE copy.

Structural proof the Timeline route cannot emit them: mmtlr_serve echoes the bundle and terminates before the theme renders —
```
    status_header(200);
    mmtlr_headers($bundle, (string) $entry['content_type'], false);
    header('Content-Length: ' . strlen($bytes), true);
    if ($method !== 'HEAD') echo $bytes;
    exit;
}
add_action('template_redirect', 'mmtlr_serve', -20);
```
`wp_head`/`wp_footer` never fire on /timeline/, so no WordPress-registered script (moment, wp-date, jquery, jquery-migrate) is ever enqueued on that page. The Timeline app also does not depend on any `wp` global: it fetches its nonce over the wire (web/js/production/timeline-auth-client.js:52-56, `/wp-admin/admin-ajax.php?action=missionmed_timeline_bootstrap`) rather than reading `window.wpApiSettings`.

The ONLY script this package contributes to a WordPress-rendered page is matrix-launch.js on the Matrix page (see F-05), and it references neither moment nor wp.

**Student impact:** Not student-facing itself, but it is currently mis-scoped work: any time spent hunting `moment` inside the Timeline package or adding suppression to the bundle is wasted, and a cosmetic suppression would mask a real defect on the Matrix/member-dashboard page where students actually see it.

**Proposed fix:** Do not change any Timeline file. Redirect the hunt: reproduce with DevTools open on `https://missionmedinstitute.com/member-dashboard/` and the Matrix page (NOT /timeline/), then run `wp` CLI or view-source and grep the emitted `<script id="...-js">` handles for `moment-js`, `wp-date-js`, `jquery-migrate-js`. The emitter is the active theme or a third-party plugin outside this repo (nothing in wp-content/mu-plugins/** enqueues any script — verified: the only wp_enqueue_script calls in wp-content are missionmed-timeline-sso.php:971 and missionmed-storyforge-sso.php:596). If the report turns out to be about script ordering on the Matrix page rather than a literal `moment` symbol, F-05 is the in-repo defect that matches.

### F-05 — matrix-launch.js is injected twice on the Matrix page with two different ?ver values, so the browser downloads and executes two separate copies
**Severity:** MAJOR · **Location:** `packages/mission-timeline/infra/wordpress/missionmed-timeline-route.php:65`

**Evidence:** Path 1 — SSO plugin, head, versioned by the constant (wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php:966-977):
```
function mmtl_enqueue_matrix_launch_adapter() {
    if (!mmtl_is_matrix_request() || !mmtl_user_can_enter()) { return; }
    $handle = 'missionmed-timeline-matrix-launch';
    wp_enqueue_script($handle, plugins_url('assets/matrix-launch.js', __FILE__), array(), MMTL_VERSION, false);
    wp_add_inline_script($handle, 'window.MissionMedTimelineLaunch=' . wp_json_encode(...) . ';', 'before');
}
add_action('wp_enqueue_scripts', 'mmtl_enqueue_matrix_launch_adapter', 30);
```
(MMTL_VERSION = '500.0.4', line 24; `$in_footer` = false.)

Path 2 — route mu-plugin, body_open, version HARDCODED and stale (infra/wordpress/missionmed-timeline-route.php:50-66, 68-80):
```
    $source = plugins_url('missionmed-timeline-sso/assets/matrix-launch.js');
    return '<script>window.MissionMedTimelineLaunch=' . $config . ';</script>'
        . '<script src="' . esc_url($source) . '?ver=500.0.7"></script>';
}
function mmtlr_render_matrix_launch_adapter() {
    static $rendered = false;
    if ($rendered) { return; }
    ...
}
add_action('wp_body_open', 'mmtlr_render_matrix_launch_adapter', 20);
```
The `static $rendered` guard only dedupes path 2 against itself. It does NOT consult `wp_script_is('missionmed-timeline-matrix-launch', ...)`. By contrast both sibling guards DO check: the SSO footer fallback at missionmed-timeline-sso.php:981 uses `wp_script_is($handle, 'done')`, and the route's own ob_start filter at missionmed-timeline-route.php:82 uses `str_contains($html, 'missionmed-timeline-sso/assets/matrix-launch.js')`. Because `?ver=500.0.4` and `?ver=500.0.7` are different URLs, the browser will not dedupe either — two network fetches, two IIFE executions.

Runtime effect, from wp-content/plugins/missionmed-timeline-sso/assets/matrix-launch.js: two `document.addEventListener("click", ...)` delegates that each call `event.preventDefault(); window.location.assign(config.target);`, and `if (window.location.hash === "#timeline") openTimeline();` evaluated twice.

**Student impact:** On the Matrix dashboard a student clicking Timeline triggers two navigation assigns in the same tick and two competing preventDefault handlers; the duplicate <script> is an extra uncached round-trip on every Matrix page load. This is the only script-ordering/duplication defect this package puts on a WordPress-rendered page, and it is the concrete candidate behind the Founder's 'repeated console errors / dependency timing' report.

**Proposed fix:** Two surgical edits, both host-layer.
(1) infra/wordpress/missionmed-timeline-route.php — insert at the top of mmtlr_matrix_launch_markup(), immediately after line 50's opening brace:
```
    if (wp_script_is('missionmed-timeline-matrix-launch', 'enqueued')
        || wp_script_is('missionmed-timeline-matrix-launch', 'done')
        || wp_script_is('missionmed-timeline-matrix-launch', 'registered')) {
        return '';
    }
```
This makes the mu-plugin a true fallback for the case where the SSO plugin is deactivated, which is clearly its intent.
(2) Same file, line 65: replace the hardcoded `'?ver=500.0.7'` with `'?ver=' . (defined('MMTL_VERSION') ? rawurlencode(MMTL_VERSION) : '500.0.8')` so the fallback can never carry a stale cache key.

### F-06 — R2 presigned URLs are virtual-hosted (bucket subdomain) but the production CSP pins only the bare account host, so browser media upload/download is blocked by connect-src
**Severity:** MAJOR · **Location:** `packages/mission-timeline/src/storage/production/r2-private-object-store.ts:638`

**Evidence:** The S3 client is constructed with a custom endpoint and no path-style flag (src/storage/production/r2-private-object-store.ts:638-644):
```
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
```
and `config.endpoint` is validated to be the account host only (lines 611-620): `!endpoint.hostname.endsWith(".r2.cloudflarestorage.com")` -> throw; `endpoint: endpoint.toString().replace(/\/$/,"")`. AWS SDK v3 defaults `forcePathStyle:false`, so `getSignedUrl` (line 256 `this.presign = options.presign ?? getSignedUrl`, used at line 305) emits `https://<bucket>.<account>.r2.cloudflarestorage.com/<key>`.

The production CSP allows only the bare account host — infra/wordpress/missionmed-timeline-route.php:185:
```
    header('Content-Security-Policy: default-src \'self\'; ... connect-src \'self\' blob: https://eeaaf73d1670b47a162d251ca67e7cfa.r2.cloudflarestorage.com; ...', true);
```
A CSP host-source with no wildcard matches that host and no subdomain of it.

The client-side validator is looser than the CSP and therefore will not catch it — web/js/production/timeline-auth-client.js:21-27:
```
function signedPrivateObjectUrl(value){
  const url=new URL(String(value||""));
  if(url.protocol!=="https:" || !url.hostname.endsWith(".r2.cloudflarestorage.com"))throw ...
```
And no test pins the real host: tests/d1-500-rc1-r2-private-storage.test.ts:214 asserts only `assert.match(signed.uploadUrl, /^https:\/\/private-signed\.invalid\//)` against an injected fake presigner; there is no `forcePathStyle` or `bucketEndpoint` anywhere in src/ or tests/.

**Student impact:** Every student who adds a photo to their timeline: the signed PUT is blocked before it leaves the browser with 'Refused to connect to https://<bucket>.eeaaf73d....r2.cloudflarestorage.com because it violates the Content-Security-Policy directive connect-src' in the console, the upload fails, and the media never appears. Confirm against a real presigned URL before shipping — the D1-500 receipt records a server-side R2 canary, not a browser-origin one.

**Proposed fix:** One-line, keeps the tight CSP intact. src/storage/production/r2-private-object-store.ts:638 — add `forcePathStyle: true` to the S3Client options:
```
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
```
R2 supports path-style addressing, and this keeps every signed URL on `https://eeaaf73d1670b47a162d251ca67e7cfa.r2.cloudflarestorage.com/<bucket>/<key>` — already allowed by the existing connect-src. Verify by printing one real `signObjectUpload` response host in staging before release. (The alternative — widening connect-src to a wildcard subdomain — relaxes a security header on the student route and should not be preferred.)

### F-07 — The rollback tool cannot roll back the artifact students actually load: manage-d1-411c-release.mjs demands release-manifest.json, but WordPress runtime releases contain only release.php
**Severity:** MAJOR · **Location:** `packages/mission-timeline/scripts/manage-d1-411c-release.mjs:40`

**Evidence:** The tool's verifier requires a static manifest inside every release directory (lines 38-53):
```
async function verifyRelease(directory) {
  const root = await realpath(directory);
  const manifest = JSON.parse(await readFile(join(root, "release-manifest.json"), "utf8"));
  if (manifest.schema_version !== "d1-500-release-manifest.1" || !/^timeline-[a-f0-9]{16}$/.test(manifest.release_id)) {
    throw new Error("RELEASE_MANIFEST_INVALID");
  }
```
and the rollback branch calls it on the prior pointer (line 96 `const verified = await verifyRelease(target);`) after only a prefix check at line 94 `if (typeof prior !== "string" || !prior.startsWith("releases/timeline-")) throw new Error("ROLLBACK_TARGET_UNAVAILABLE");`.

But the deployed WordPress runtime layout has no such file. I listed the in-git production artifact:
`_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/artifacts/kinsta/wp-content/mu-plugins/missionmed-timeline-runtime/releases/timeline-wp-0fc51f8906decb8e/` contains exactly one file, `release.php` (7,404,245 bytes). Same for `timeline-wp-c228658bc70bc395/`. There is no `current` symlink in the artifact either — the operator must create it by hand.

And that is the directory the live route reads (infra/wordpress/missionmed-timeline-route.php:126-137): `$selected = realpath($runtime . DIRECTORY_SEPARATOR . 'current'); ... $bundle_file = $selected . DIRECTORY_SEPARATOR . 'release.php';`.

So `node scripts/manage-d1-411c-release.mjs --action rollback ...` against the WordPress runtime root throws ENOENT on release-manifest.json before it ever re-points the symlink. Rollback today is entirely the manual procedure in _AI_HANDOFFS/.../TIMELINE-RC1-STABILIZATION-001/09_ROLLBACK_PROCEDURE.md ('Atomically point missionmed-timeline-runtime/current to ... releases/timeline-wp-ee40c1abc5eabe06').

**Student impact:** If a bad release blanks the board for students, the only tested recovery is the WordPress feature kill switch (timeline_enabled=false), which turns Timeline OFF for everyone. Restoring the previous working release is an untested, hand-typed symlink+PHP-restart+cache-purge sequence on a live Kinsta host — exactly the operation you do not want to improvise at 3am inside a 24h window.

**Proposed fix:** Do not rewrite the tool inside the deadline. Two steps: (1) Before cutting the release, pre-stage and verify the rollback target on the host: `ls -la .../missionmed-timeline-runtime/current` and `shasum -a 256 .../releases/<prior-id>/release.php`, and record both in the runbook. (2) Add the exact four commands to 09_ROLLBACK_PROCEDURE.md so they are copy-pasteable:
```
cd <runtime>
ln -sfn releases/<PRIOR_ID> .current-rollback && mv -Tf .current-rollback current
# Kinsta: restart PHP, purge cache
curl -sI https://missionmedinstitute.com/timeline/ | grep -i x-missionmed-timeline-release
```
The last line verifies the swap because mmtlr_headers() already emits `X-MissionMed-Timeline-Release: <release_id>` (infra/wordpress/missionmed-timeline-route.php:191). Post-deadline, add a `--kind=wordpress` branch to manage-d1-411c-release.mjs that verifies `release.php` against a sidecar sha256 instead of release-manifest.json.

### F-08 — build:release has no post-check on the WordPress bundle — check-release runs before build-wordpress-runtime and never inspects release.php
**Severity:** MAJOR · **Location:** `packages/mission-timeline/package.json:15`

**Evidence:** package.json:15:
```
"build:release": "node scripts/build-static.mjs --mode=release && node scripts/check-release.mjs && node scripts/build-wordpress-runtime.mjs",
```
The gate runs in the middle. scripts/check-release.mjs is 18 lines and reads only `dist/` — line 7 `const manifest=JSON.parse(await readFile(join(dist,"release-manifest.json"),"utf8"));`, line 12 the file-set equality check, line 13 the per-file hash loop, lines 14-15 the forbidden-path and private-fixture checks, lines 16-17 the two index.html string assertions. Nothing after `build-wordpress-runtime.mjs` re-opens `dist-wordpress/release.php`.

So the only artifact students ever load — a 10,424,176-byte PHP file containing 63 base64 assets plus a rewritten index — is emitted with zero verification. Combined with the silent JS fallback at build-wordpress-runtime.mjs:67 (F-02), a bundle whose protected-kernel texture URLs were never rewritten ships with a green build log.

checks that are also absent: nothing asserts the 8 tex aliases + us_flag alias are present in the emitted asset table; nothing asserts every emitted content_type is in the PHP allowlist (see F-09).

**Student impact:** A release that blanks every student's canvas can pass the full `npm run build:release` pipeline with exit code 0 and no warning. The failure is only discoverable by a human opening /timeline/ in production.

**Proposed fix:** Append the verification to the end of scripts/build-wordpress-runtime.mjs (after the `await writeFile(output, ...)` at the bottom), so no new npm script or pipeline change is needed:
```
const REQUIRED_RUNTIME_PATHS=[
  ...["board_denim.jpg","leather_pebble.png","paper_bond.png","paper_hotpress.png","paper_rc.png","print_grain.png","satin.png","sticky_pulp.jpg"].map((n)=>`presentation/d1-409h-a1/assets/tex/${n}`),
  "presentation/d1-409h-a1/assets/photos/us_flag.png",
  "presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html",
];
for(const path of REQUIRED_RUNTIME_PATHS){
  if(!byPath.has(path))throw new Error(`TIMELINE_RUNTIME_REQUIRED_ASSET_MISSING:${path}`);
}
const ALLOWED_PHP_CONTENT_TYPES=new Set(["text/html; charset=utf-8","text/css; charset=utf-8","text/javascript; charset=utf-8","application/json","text/plain; charset=utf-8","font/woff2","image/png","image/jpeg","image/webp"]);
for(const entry of assetList){
  if(!ALLOWED_PHP_CONTENT_TYPES.has(entry.contentType))throw new Error(`TIMELINE_RUNTIME_CONTENT_TYPE_UNSERVABLE:${entry.path}:${entry.contentType}`);
}
```
Pair this with the F-02 assertion and the WordPress bundle becomes fail-closed.

### F-09 — The release MIME allowlist and the PHP serving allowlist have drifted: build-static approves image/svg+xml and application/pdf-adjacent types the route will 404
**Severity:** MINOR · **Location:** `packages/mission-timeline/infra/wordpress/missionmed-timeline-route.php:170`

**Evidence:** The PHP serving gate rejects anything outside a hardcoded list (infra/wordpress/missionmed-timeline-route.php:170, inside mmtlr_decode_entry):
```
    $allowed = array('text/html; charset=utf-8', 'text/css; charset=utf-8', 'text/javascript; charset=utf-8', 'application/json', 'text/plain; charset=utf-8', 'font/woff2', 'image/png', 'image/jpeg', 'image/webp');
    return in_array((string) $entry['content_type'], $allowed, true) ? $bytes : null;
```
and a null return becomes `mmtlr_error(404, 'timeline_asset_not_found', ...)` for assets, or `mmtlr_error(503, 'timeline_release_integrity_failed', ...)` for the index.

The build-time MIME map is strictly larger — scripts/build-static.mjs `types` Map includes `[".svg","image/svg+xml"]` and `[".sha256","text/plain; charset=utf-8"]`. `image/svg+xml` is NOT in the PHP list. Today no .svg reaches dist (the six `web/assets/keynote_classic_402a/arrows/*_template_402a.svg` files are not referenced by index.html or 407f-upgrade.css and so are not picked up by the assetRefs scan at build-static.mjs:79-88), but nothing enforces that.

check-release.mjs performs no content-type validation at all (verified: 18 lines, no reference to content_type).

**Student impact:** Latent. The first time anyone adds an SVG icon to the shell, check-release passes, the WordPress bundle builds, and the asset 404s in production only — a missing icon plus a console 404 that reproduces on no local environment.

**Proposed fix:** Add one guard to scripts/check-release.mjs, after the hash loop at line 13:
```
const SERVABLE_CONTENT_TYPES=new Set(["text/html; charset=utf-8","text/css; charset=utf-8","text/javascript; charset=utf-8","application/json","text/plain; charset=utf-8","font/woff2","image/png","image/jpeg","image/webp"]);
for(const path of expected){const ct=manifest.files[path].content_type;if(!SERVABLE_CONTENT_TYPES.has(ct))throw new Error(`RELEASE_CONTENT_TYPE_UNSERVABLE:${path}:${ct}`);}
```
This is the same set as missionmed-timeline-route.php:170; add a comment on both sides naming the other file so the pair stays in sync.

### F-10 — Every student release ships the protected-asset hash inventory, which publicly names the founder's private family photo fixtures that check-release deliberately excludes
**Severity:** MINOR · **Location:** `packages/mission-timeline/scripts/build-static.mjs:100`

**Evidence:** build-static.mjs:100 copies the whole protected directory verbatim:
```
await cp(join(web,"presentation","d1-409h-a1"),join(dist,"presentation","d1-409h-a1"),{recursive:true});
```
So dist/ (and therefore the WordPress bundle) contains `presentation/d1-409h-a1/PROTECTED_HASHES.sha256` (2,635 B), `presentation/d1-409h-a1/D1-411A_PROTECTED_HASH_MANIFEST.json` (4,564 B) and `presentation/d1-409h-a1/D1-409H_VISUAL_MASTER.original.js` (19,053 B) — all confirmed present in dist/release-manifest.json and in the decoded dist-wordpress/release.php asset table.

PROTECTED_HASHES.sha256 contains, in plain text, lines naming private fixtures:
```
0de79263988fb5c6745370cd25d2c09ccd5d433546bd8ce1142954dcbd2aa407  assets/photos/karaoke.jpg
17502c23f158a321a2a220d854c676f43e2964ad93ab1271b5e3edcb070315e8  assets/photos/newborn.jpg
6e92a8d75cd06796eac153a0424bc553a5008b155f6de2ab04f470bfb8ffc7ab  assets/photos/nicu.jpg
7bc78caa50452e2303cff624c990b41188ae968ab8625d376ec7b150ad9f08a7  assets/photos/profile_sample.jpg
b6ef8e82df2e732a89e92d054bf1367f1a5b5b94455edbe5d5e27626114ca3d2  assets/photos/ski.jpg
f9de95f98036a4e387a0197467126bfc9595a2f78c1825d1990c82e2baa3e4a9  assets/photos/wedding.jpg
```
which is precisely the list check-release.mjs:15 goes out of its way to keep out of the release:
`for(const privateFixture of ["karaoke.jpg","newborn.jpg","nicu.jpg","profile_sample.jpg","ski.jpg","wedding.jpg"]){if(expected.some((path)=>path.endsWith(`/assets/photos/${privateFixture}`)))throw new Error(...)}`

None of these three files is fetched at runtime: the release's own runtime map (window.D1_TIMELINE_ASSET_URLS, 32 keys, decoded from the bundle) does not list them, and nothing in web/js/** references them.

**Student impact:** A student who opens DevTools can read `/timeline/_asset/<alias>` for PROTECTED_HASHES.sha256 and see filenames like `newborn.jpg`, `nicu.jpg`, `wedding.jpg` from the founder's family album, plus 26 KB of dead payload in a bundle already flagged as too large. It also undercuts the private-fixture guard the release gate exists to enforce.

**Proposed fix:** Replace build-static.mjs:100 with a filtered copy that keeps only what the kernel actually loads:
```
await cp(join(web,"presentation","d1-409h-a1"),join(dist,"presentation","d1-409h-a1"),{
  recursive:true,
  filter:(source)=>!/(?:PROTECTED_HASHES\.sha256|D1-411A_PROTECTED_HASH_MANIFEST\.json|D1-409H_VISUAL_MASTER\.original\.js)$/.test(source)
});
```
This touches no protected byte — those three files are metadata about the kernel, not the kernel. Note the hash-authority read at build-static.mjs:23-30 uses `join(web, ...)`, i.e. the source tree, so it is unaffected. Re-run check-release; the file-set/manifest are regenerated together so it stays consistent.

### F-11 — The release build refuses to run whenever any untracked file exists under packages/mission-timeline, which will block the cut while parallel agents are working
**Severity:** MINOR · **Location:** `packages/mission-timeline/scripts/build-static.mjs:37`

**Evidence:** build-static.mjs:35-39:
```
if(mode==="release"){
  const expected=String(process.env.TIMELINE_EXPECTED_COMMIT||"").trim();
  if(!/^[a-f0-9]{40}$/.test(expected)||expected!==head)throw new Error("TIMELINE_EXPECTED_COMMIT_MISMATCH");
  const status=execFileSync("git",["status","--porcelain=v1","--untracked-files=all","--","packages/mission-timeline","wp-content/plugins/missionmed-timeline-sso"],{cwd:resolve(root,"../.."),encoding:"utf8"}).trim();
  if(status)throw new Error("TIMELINE_RELEASE_SOURCE_NOT_CLEAN");
}
```
`--untracked-files=all` means a single stray scratch file, screenshot, or agent note anywhere under packages/mission-timeline aborts the build — not just modified tracked files.

I ran the exact command against the current worktree: it returns
```
 M packages/mission-timeline/scripts/serve.mjs
 M packages/mission-timeline/web/js/d1-411a/kernel-host.js
```
so `npm run build:release` throws TIMELINE_RELEASE_SOURCE_NOT_CLEAN right now. Expected mid-work, but it means the release cut is a hard serialization point that several lanes will collide on.

**Student impact:** No direct student impact, but on a 24h clock this is the most likely way the release cut stalls: a forgotten untracked file produces an opaque `TIMELINE_RELEASE_SOURCE_NOT_CLEAN` with no indication of which file is at fault.

**Proposed fix:** Keep the gate (it is the integrity guarantee), but make it self-diagnosing. build-static.mjs:38 — replace
`if(status)throw new Error("TIMELINE_RELEASE_SOURCE_NOT_CLEAN");`
with
`if(status)throw new Error(`TIMELINE_RELEASE_SOURCE_NOT_CLEAN:\n${status}`);`
and add one line to the release runbook before the cut: `git status --porcelain=v1 --untracked-files=all -- packages/mission-timeline wp-content/plugins/missionmed-timeline-sso` must print nothing (use `git clean -nxd packages/mission-timeline` to preview strays first — never `-f` without reviewing, since dist/ holds the only local copy of the accepted binary assets per F-03).
