# Y1-Y2-CAM-V6-3494A — CV CONTEXT + QUESTION GENERATOR SPEC

## 1. Two-stage architecture (never keyword extraction)

**Stage 1 — CVContextProvider** → normalized applicant model: `{ education[], training[], experiences[], research[{topic, outputs, span}], publications[], leadership[], awards[], volunteering[], usce[], gaps[{span, between}], transitions[], geography[], employment[] }` each with dates, institutions, and computed relations (durations, overlaps, chronology anomalies, repeated institutions, topic concentrations).

**Stage 2 — CVQuestionGenerator** → interview-worthiness reasoning over the model. Generation heuristics (the "curious PD" test): time gaps & unusual chronology · major transitions/career changes · research concentration (N pubs on one topic) · very short vs very long experiences · US clinical experience specifics · leadership scope · awards context · specialty alignment/misalignment · geographic movement · repeated institutions · post-graduation activity · ambiguities/apparent inconsistencies · standout accomplishments. Each rule must articulate WHY a PD would ask — items generate questions because they are INTERVIEW-WORTHY, not because a word exists.

## 2. Candidate record (provenance mandatory)

```ts
interface CVQuestionCandidate {
  cv_question_id: 'CVQ-xxx';
  question: string;                       // generated interview question
  source_cv_items: CVItemRef[];           // FACT(s) FROM CV — always displayed with the question
  reason: string;                         // "substantial longitudinal research experience"
  confidence: 0..1;
  category: Tag[];                        // taxonomy tags
  suggested_followups: string[];
  selected: boolean;                      // default FALSE — never auto-enters interview
}
```

UI always renders `CV FACT → GENERATED QUESTION → WHY THIS QUESTION` as three labeled elements (fact vs generation never blurred).

## 3. Review flow

`CV QUESTIONS GENERATED · 18` → per candidate: ADD / REJECT / FAVORITE / EDIT (edit creates CUST- derivative with provenance) / bulk `ADD ALL HIGH PRIORITY` (confidence ≥ threshold [CALIBRATE]). Mentor/Admin can generate + curate a CV interview FOR a student. Accepted candidates become Question records (`source:'cv_generated'`, cv_relevance=true) usable in drawer/sets like any other.

## 4. Privacy

CV content is student-scoped; generated candidates inherit scope; CV never leaves the generation context; no CV text in logs.
