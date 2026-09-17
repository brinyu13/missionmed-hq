import {
  EXTRACTION_CLASSES,
  OCCURRENCE_SCHEMA_VERSION,
  PASS_DEFINITIONS,
  SPEAKER_CLASSES,
} from './constants.mjs';
import {
  contentAddressedEnvelope,
  deterministicId,
  normalizeForSignature,
  sha256,
  stableHash,
} from './canonical.mjs';

const MEDICAL_DOMAINS = Object.freeze([
  Object.freeze({
    subject: 'CARDIOVASCULAR_MEDICINE', organ_system: 'CARDIOVASCULAR', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:heart|cardiac|cardio|coronary|myocard|angina|arrhythm|fibrillation|flutter|ecg|ekg|murmur|valv|aortic|mitral|pericard|endocard|hypertension|hypotension|shock|troponin|stemi|nstemi|heart failure|ejection fraction)\b/iu,
  }),
  Object.freeze({
    subject: 'PULMONARY_MEDICINE', organ_system: 'RESPIRATORY', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:lung|pulmonary|pneumon|asthma|copd|bronch|pleur|hypox|oxygen|ventilat|respirat|ards|embolism|pneumothorax|hemoptysis|spirometry|abg)\b/iu,
  }),
  Object.freeze({
    subject: 'RENAL_MEDICINE', organ_system: 'RENAL_URINARY', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:renal|kidney|nephro|creatinine|bun|urinalysis|proteinuria|hematuria|dialysis|electrolyte|sodium|potassium|acid[- ]base|acidosis|alkalosis|glomerul|tubular)\b/iu,
  }),
  Object.freeze({
    subject: 'GASTROENTEROLOGY', organ_system: 'GASTROINTESTINAL_HEPATOBILIARY', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:gastro|intestinal|bowel|colon|stomach|esophag|liver|hepatic|biliary|gallbladder|pancrea|jaundice|cirrhosis|ascites|diarrhea|constipation|hematemesis|melena|hematochezia|bilirubin|transaminase)\b/iu,
  }),
  Object.freeze({
    subject: 'ENDOCRINOLOGY', organ_system: 'ENDOCRINE_METABOLIC', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:diabet|insulin|glucose|thyroid|adrenal|pituitary|cortisol|aldosterone|parathyroid|calcium|metabolic|dka|hypergly|hypogly|tsh|free t4|pheochromocytoma)\b/iu,
  }),
  Object.freeze({
    subject: 'INFECTIOUS_DISEASE', organ_system: 'MULTISYSTEM', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:infect|sepsis|septic|bacter|viral|virus|fung|parasite|antibiotic|antimicrobial|culture|fever|meningitis|pneumonia|cellulitis|hiv|hepatitis|tuberculosis|vaccin|pathogen)\b/iu,
  }),
  Object.freeze({
    subject: 'NEUROLOGY', organ_system: 'NERVOUS_SYSTEM', discipline: 'NEUROLOGY',
    pattern: /\b(?:neuro|brain|stroke|seizure|headache|migraine|neuropathy|weakness|paralysis|dementia|delirium|mening|reflex|cranial nerve|cerebell|multiple sclerosis|myasthenia|parkinson)\b/iu,
  }),
  Object.freeze({
    subject: 'HEMATOLOGY_ONCOLOGY', organ_system: 'HEMATOLOGIC_ONCOLOGIC', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:anemia|hemoglobin|platelet|coagulat|bleeding|thromb|leukemia|lymphoma|cancer|tumou?r|malignan|metasta|chemotherap|neutropenia|pancytopenia|sickle|myeloma)\b/iu,
  }),
  Object.freeze({
    subject: 'RHEUMATOLOGY', organ_system: 'MUSCULOSKELETAL_IMMUNE', discipline: 'INTERNAL_MEDICINE',
    pattern: /\b(?:rheumat|arthritis|lupus|vasculitis|autoimmune|joint|gout|sarcoid|scleroderma|sjogren|inflammatory)\b/iu,
  }),
  Object.freeze({
    subject: 'OBSTETRICS_GYNECOLOGY', organ_system: 'REPRODUCTIVE', discipline: 'OBSTETRICS_GYNECOLOGY',
    pattern: /\b(?:pregnan|obstetric|gynec|uter|ovari|cervi|vaginal|placenta|preeclampsia|eclampsia|postpartum|menstrual|fetal|gestational)\b/iu,
  }),
  Object.freeze({
    subject: 'PEDIATRICS', organ_system: 'MULTISYSTEM', discipline: 'PEDIATRICS',
    pattern: /\b(?:pediatric|paediatric|child|infant|neonat|newborn|developmental milestone|congenital|adolescent)\b/iu,
  }),
  Object.freeze({
    subject: 'PSYCHIATRY', organ_system: 'BEHAVIORAL_HEALTH', discipline: 'PSYCHIATRY',
    pattern: /\b(?:psychiatr|depression|anxiety|psychosis|schizophrenia|bipolar|suicid|mania|delusion|hallucination|substance use|withdrawal|intoxication)\b/iu,
  }),
  Object.freeze({
    subject: 'EMERGENCY_CRITICAL_CARE', organ_system: 'MULTISYSTEM', discipline: 'EMERGENCY_MEDICINE',
    pattern: /\b(?:emergency|critical care|resuscitat|airway|breathing|circulation|unstable|trauma|shock|code blue|cardiac arrest|icu|vasopressor)\b/iu,
  }),
  Object.freeze({
    subject: 'PHARMACOLOGY', organ_system: 'MULTISYSTEM', discipline: 'PHARMACOLOGY',
    pattern: /\b(?:drug|medication|dose|dosage|adverse effect|side effect|contraindicat|mechanism of action|agonist|antagonist|inhibitor|anticoagulant|steroid|diuretic|beta blocker)\b/iu,
  }),
  Object.freeze({
    subject: 'ETHICS_PROFESSIONALISM', organ_system: 'NOT_APPLICABLE', discipline: 'ETHICS_PROFESSIONALISM',
    pattern: /\b(?:ethic|capacity|consent|confidential|autonomy|beneficence|professional|communication|breaking bad news|end of life|surrogate|advance directive|patient safety)\b/iu,
  }),
  Object.freeze({
    subject: 'BIOSTATISTICS_EVIDENCE', organ_system: 'NOT_APPLICABLE', discipline: 'EVIDENCE_BASED_MEDICINE',
    pattern: /\b(?:sensitivity|specificity|likelihood ratio|odds ratio|relative risk|confidence interval|p[- ]value|bias|randomized|cohort|case control|number needed to treat|prevalence|incidence)\b/iu,
  }),
]);

const GENERAL_MEDICAL = /\b(?:patient|symptom|sign|finding|diagnos|differential|treat|manage|therapy|clinical|disease|syndrome|mechanism|pathophysi|etiology|prognosis|complication|screen|test|laboratory|imaging|x[- ]?ray|ct scan|mri|ultrasound|biopsy|exam|vital|blood pressure|heart rate|respiratory rate|temperature|pain|nausea|vomit|edema|rash|lesion|fracture|wound|acute|chronic|medic(?:al(?:ly)?|ine)?|physician|hospital|outpatient|inpatient|mortality|morbidity)\b/iu;
const CONTROLLED_HIGH_SPECIFICITY_MEDICAL = /\b(?:myocardial infarction|stemi|nstemi|atrial fibrillation|pulmonary embol(?:ism|us)|pneumothorax|heart failure|ejection fraction|glomerulonephritis|nephrotic|nephritic|diabetic ketoacidosis|thyrotoxicosis|pheochromocytoma|cirrhosis|pancreatitis|meningitis|encephalitis|pneumonia|sepsis|septic shock|osteomyelitis|endocarditis|stroke|seizure|multiple sclerosis|myasthenia|parkinson|leukemia|lymphoma|myeloma|sickle cell|vasculitis|systemic lupus|preeclampsia|eclampsia|placental|psychosis|schizophrenia|bipolar|suicid|cardiac arrest|resuscitat|vasopressor|antibiotic|anticoagulant|chemotherap|immunosuppress|hemoglobin|platelet|creatinine|bilirubin|troponin|electrocardiogram|echocardiogram|spirometry|urinalysis|biopsy|computed tomography|magnetic resonance|pathophysiology|pharmacokinetic|odds ratio|relative risk|likelihood ratio|sensitivity|specificity)\b/iu;
const CONTROLLED_BROAD_MEDICAL_TERMS = /\b(?:patient|diagnos\w*|differential|treat\w*|management|therapy|disease|syndrome|clinical|pathophysi\w*|etiolog\w*|prognos\w*|complication|screen\w*|symptom|finding|infection|bacter\w*|viral|fung\w*|cancer|tumou?r|malignan\w*|anemia|thromb\w*|bleed\w*|cardiac|heart|lung|pulmonary|kidney|renal|liver|hepatic|pancrea\w*|diabet\w*|thyroid|adrenal|brain|neurolog\w*|pregnan\w*|fetal|neonat\w*|psychiatr\w*|medication|drug|dose|adverse effect|laborator\w*|imaging|x[- ]?ray|ultrasound|ecg|ekg|mri|ct scan|blood pressure|heart rate|oxygen|fever|pain|edema|rash|lesion|fracture|acute|chronic|mortality|morbidity)\b/giu;
const CONTROLLED_MEDICAL_PROMPT_CUE = /(?:\?|^\s*(?:what|why|how|which|when|can|could|would|should|is|are|do|does|did|name|identify|describe|explain|list|define|interpret|differentiate|diagnose|manage|treat)\b)/iu;
const CONTROLLED_MEDICAL_TEACHING_CUE = /\b(?:the key is|high[- ]yield|remember|classically|typically|diagnosis is|answer is|next step is|management is|we treat|mechanism is|defined as|because|therefore)\b/iu;
const QUESTION_FORM = /(?:\?|^\s*(?:what|why|how|which|who|where|when|can|could|would|should|is|are|was|were|do|does|did|name|identify|describe|explain|tell me|give me|walk me through)\b)/iu;
const RAPID_FIRE = /^\s*(?:tell me|name|list|give me|walk me through|explain|describe|identify|differentiate|interpret|compare|define)\b/iu;
const INCOMPLETE = /(?:\.\.\.|…|—\s*$|-\s*$|\b(?:and then|so what|which means|because)\s*$)/iu;
const TEACHING_CUE = /\b(?:remember|the key is|high[- ]yield|important|this means|because|therefore|in contrast|however|classically|typically|usually|always|never|you should|we treat|management is|diagnosis is|the answer is|next step is|mechanism is|defined as)\b/iu;
const LEARNER_LABEL = /(?:^|[\s_-])(?:student|learner|participant|attendee|resident|candidate|speaker\s*[2-9]|audience)(?:$|[\s_-])/iu;
const INSTRUCTOR_LABEL = /(?:^|[\s_-])(?:instructor|teacher|faculty|host|doctor|dr\.?|moderator)(?:$|[\s_-])/iu;
const ADMINISTRATIVE_OR_RHETORICAL = /\b(?:hear me|see (?:me|the slide|this slide)|which slide|break starts|everybody doing|everyone doing|useful session|take a break)\b/iu;
const PRESENTATION_MEDIUM = /\b(?:slides?|screen|screen\s*share|screen\s*sharing|audio|microphone|mic|camera|webcam)\b/iu;
const PRESENTATION_ACCESS_CHECK = /\b(?:can|could|do|does|did|is|are|was|were|will|would)\s+(?:everyone|everybody|you|we|the audience|people)\b[^?!.]{0,80}\b(?:see|hear|view|read)\b/iu;
const PRESENTATION_QUALITY_CHECK = /\b(?:slides?|screen|screen\s*share|screen\s*sharing|audio|microphone|mic|camera|webcam)\b[^?!.]{0,80}\b(?:visible|readable|audible|blurry|blurred|frozen|loading|loaded|working|cut off|muted|unmuted)\b/iu;
const PRESENTATION_POWER_CHECK = /(?:\b(?:is|are|was|were)\s+(?:the\s+)?(?:audio|microphone|mic|camera|webcam)\s+(?:on|off)\b|\b(?:audio|microphone|mic|camera|webcam)\b[^?!.]{0,40}\b(?:turned|switched)\s+(?:on|off)\b)/iu;
const PRESENTATION_CONTROL_CHECK = /\b(?:share|sharing|switch|advance|change|open|close|mute|unmute|turn on|turn off)\b[^?!.]{0,60}\b(?:slides?|screen|audio|microphone|mic|camera|webcam)\b/iu;
const LOW_LEXICON_MEDICAL_RELATION = /\b(?:suggests?|indicates?|associated with|causes?|results? in|characteri[sz]ed by|seen in|presents? with|due to|linked to)\b/iu;
const UPPERCASE_TECHNICAL_TOKEN = /\b[A-Z][A-Z0-9-]{1,7}\b/u;
const PII_PATTERNS = Object.freeze([
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  /(?:\+?\d[\d .()-]{7,}\d)/gu,
  /\b(?:student|patient|meeting|account|record|medical record|mrn)\s*(?:id|number|#)\s*[:=-]?\s*[A-Z0-9-]{4,}\b/giu,
  /\b(?:my name is|patient named|student named)\s+[\p{L}][\p{L}'’-]+(?:\s+[\p{L}][\p{L}'’-]+){0,2}\b/giu,
]);

const CLASS_SET = new Set(EXTRACTION_CLASSES);
const SPEAKER_SET = new Set(SPEAKER_CLASSES);

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function boundedScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

export function isAdministrativeOrRhetorical(text) {
  const normalized = String(text ?? '').normalize('NFKC');
  if (ADMINISTRATIVE_OR_RHETORICAL.test(normalized)) return true;
  if (!PRESENTATION_MEDIUM.test(normalized)) return false;
  return PRESENTATION_ACCESS_CHECK.test(normalized)
    || PRESENTATION_QUALITY_CHECK.test(normalized)
    || PRESENTATION_POWER_CHECK.test(normalized)
    || PRESENTATION_CONTROL_CHECK.test(normalized);
}

function controlledMedicalSignal(text, administrative) {
  if (administrative) return { strong: false, high_specificity: false, broad_term_count: 0 };
  const normalized = String(text ?? '').normalize('NFKC');
  CONTROLLED_BROAD_MEDICAL_TERMS.lastIndex = 0;
  const broadTerms = new Set(
    [...normalized.matchAll(CONTROLLED_BROAD_MEDICAL_TERMS)]
      .map((match) => match[0].toLocaleLowerCase('en-US')),
  );
  CONTROLLED_BROAD_MEDICAL_TERMS.lastIndex = 0;
  const highSpecificity = CONTROLLED_HIGH_SPECIFICITY_MEDICAL.test(normalized);
  const cue = CONTROLLED_MEDICAL_PROMPT_CUE.test(normalized)
    || CONTROLLED_MEDICAL_TEACHING_CUE.test(normalized);
  return {
    strong: highSpecificity || broadTerms.size >= 2 || (broadTerms.size >= 1 && cue),
    high_specificity: highSpecificity,
    broad_term_count: broadTerms.size,
  };
}

export function classifyMedicalDomain(text) {
  const normalized = String(text ?? '').normalize('NFKC');
  const administrative = isAdministrativeOrRhetorical(normalized);
  const controlledSignal = controlledMedicalSignal(normalized, administrative);
  const matches = administrative
    ? [] : MEDICAL_DOMAINS.filter((domain) => domain.pattern.test(normalized));
  let score = matches.length > 0 ? 0.7 : 0;
  if (!administrative && GENERAL_MEDICAL.test(normalized)) {
    score += matches.length > 0 ? 0.2 : 0.55;
  }
  if (score === 0
      && !administrative
      && LOW_LEXICON_MEDICAL_RELATION.test(normalized)
      && UPPERCASE_TECHNICAL_TOKEN.test(normalized)) score = 0.55;
  if (!administrative
      && /\b(?:mg|mcg|mmol|meq|g\/dl|mmhg|bpm|percent|%|positive|negative)\b/iu.test(normalized)) {
    score += 0.1;
  }
  if (normalized.length < 12) score -= 0.15;
  if (controlledSignal.strong && score < 0.55) score = 0.55;
  const primary = matches[0] ?? null;
  return {
    medical_relevance_score: boundedScore(score),
    subject: primary?.subject ?? 'UNCLASSIFIED',
    organ_system: primary?.organ_system ?? 'UNCLASSIFIED',
    discipline: primary?.discipline ?? 'UNCLASSIFIED',
    secondary_subjects: uniqueSorted(matches.slice(1).map((item) => item.subject)),
    medical_term_evidence_count: matches.length
      + (!administrative && GENERAL_MEDICAL.test(normalized) ? 1 : 0)
      + (controlledSignal.strong ? Math.max(1, controlledSignal.broad_term_count) : 0),
  };
}

export function normalizeOccurrenceText(text) {
  const original = String(text ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (/\[missing fact\]/iu.test(original)) {
    return {
      normalized_wording: null,
      changed_fields: [],
      privacy_redaction_applied: false,
      lifecycle_status: 'REJECTED_UNSUPPORTED_RECONSTRUCTION',
      normalization_error: 'missing fact prevents supported reconstruction',
    };
  }
  const changedFields = [];
  let normalized = original;
  const disfluencyRepaired = normalized.replace(/(?:,\s*)?\b(?:um+|uh+|erm+)\b(?:\s*,)?\s*/giu, ' ');
  if (disfluencyRepaired !== normalized) changedFields.push('speech_disfluency');
  normalized = disfluencyRepaired
    .replace(/\s+([,.;:?!])/gu, '$1')
    .replace(/,\s+(?=\b(?:is|are|was|were|do|does|did|can|could|would|should)\b)/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (normalized && !/[.!?]$/u.test(normalized)) {
    normalized += QUESTION_FORM.test(normalized) ? '?' : '.';
    changedFields.push('terminal_punctuation');
  }
  const beforeRedaction = normalized;
  normalized = normalized
    .replace(PII_PATTERNS[0], '[REDACTED_EMAIL]')
    .replace(PII_PATTERNS[1], '[REDACTED_PHONE_OR_NUMBER]')
    .replace(PII_PATTERNS[2], '[REDACTED_IDENTIFIER]')
    .replace(PII_PATTERNS[3], '[REDACTED_NAME]');
  if (normalized !== beforeRedaction) changedFields.push('privacy_redaction');
  return {
    normalized_wording: normalized,
    changed_fields: uniqueSorted(changedFields),
    privacy_redaction_applied: normalized !== beforeRedaction,
  };
}

export function classifySpeaker(record, sourceContext = {}) {
  const label = String(record?.speaker_label ?? '').normalize('NFKC').trim();
  const labelKey = normalizeForSignature(label);
  const basis = [];
  let classification = 'UNKNOWN';
  let score = 0.2;
  let reviewStatus = 'REVIEW_REQUIRED';

  if (sourceContext.verified_drj_labels instanceof Set
      && sourceContext.verified_drj_labels.has(labelKey)) {
    classification = 'VERIFIED_DR_J';
    score = 1;
    reviewStatus = 'ADJUDICATED';
    basis.push('OWNER_ATTESTED_LABEL_BINDING');
  } else if (sourceContext.corroborated_drj_labels instanceof Set
      && sourceContext.corroborated_drj_labels.has(labelKey)) {
    classification = 'HIGH_CONFIDENCE_DR_J';
    score = 0.88;
    basis.push('CORROBORATED_TRANSCRIPT_NODES_OR_SOURCE_BINDING');
  } else if (!label) {
    basis.push('SPEAKER_LABEL_ABSENT');
  } else if (LEARNER_LABEL.test(label)) {
    classification = 'LEARNER_OR_OTHER';
    score = 0.9;
    basis.push('LEARNER_ROLE_LABEL');
  } else if (INSTRUCTOR_LABEL.test(label)) {
    classification = 'PROBABLE_DR_J';
    score = 0.68;
    basis.push('GENERIC_INSTRUCTIONAL_ROLE_LABEL_NOT_IDENTITY_AUTHORITY');
  } else {
    const count = Number(sourceContext.label_counts?.get(label) ?? 0);
    const denominator = Number(sourceContext.labeled_record_count ?? 0);
    const share = denominator > 0 ? count / denominator : 0;
    if (sourceContext.label_counts?.size === 1) {
      classification = 'PROBABLE_DR_J';
      score = 0.58;
      basis.push('SINGLE_OBSERVED_SPEAKER_CONTINUITY_WITHOUT_IDENTITY_AUTHORITY');
    } else if ((sourceContext.label_counts?.size ?? 0) > 1) {
      classification = 'MULTI_SPEAKER_UNRESOLVED';
      score = share >= 0.55 ? 0.45 : 0.3;
      basis.push(share >= 0.55
        ? 'DOMINANT_DIARIZATION_LABEL_WITHOUT_IDENTITY_AUTHORITY'
        : 'MULTI_SPEAKER_LABEL_UNRESOLVED');
    }
  }
  if (!SPEAKER_SET.has(classification)) throw new Error('speaker_class_internal_invalid');
  return {
    speaker_authority_class: classification,
    speaker_confidence_score: boundedScore(score),
    speaker_confidence_basis: basis,
    speaker_review_status: reviewStatus,
  };
}

function extractionClassFor(text, surfaceClass) {
  const normalized = normalizeForSignature(text);
  if (surfaceClass === 'LEARNER_TEACHING') return 'LEARNER_QUESTION_WITH_DRJ_TEACHING';
  if (surfaceClass === 'TEACHING_PIVOT') return 'TEACHING_PIVOT';
  if (surfaceClass === 'TEACHING_STATEMENT') return 'TESTABLE_TEACHING_STATEMENT';
  if (surfaceClass === 'AMBIGUOUS') return 'AMBIGUOUS_MEDICAL_OCCURRENCE';
  if (surfaceClass === 'NONMEDICAL') return 'NONMEDICAL';
  if (/\b(?:differential|differentiate|versus|vs\.?|distinguish)\b/u.test(normalized)) return 'DIFFERENTIAL_PROMPT';
  if (/\b(?:mechanism|pathophysiology|why does|explain why|how does)\b/u.test(normalized)) return 'MECHANISM_PROMPT';
  if (/\b(?:next best step|next step|what do you do next|initial step|first step|what would you do)\b/u.test(normalized)) return 'NEXT_BEST_STEP_PROMPT';
  if (/\b(?:manag\w*|treat\w*|therapy|intervention)\b/u.test(normalized)) return 'MANAGEMENT_PROMPT';
  if (/\b(?:interpret|interpretation|ecg|ekg|x ray|xray|ct|mri|ultrasound|laboratory|lab result|blood gas|urinalysis)\b/u.test(normalized)) return 'INTERPRETATION_PROMPT';
  if (/\b(?:diagnosis|diagnose|most likely|what is this|condition)\b/u.test(normalized)) return 'DIAGNOSIS_PROMPT';
  if (/\b(?:reason|approach|workup|evaluate|clinical reasoning|walk me through)\b/u.test(normalized)) return 'CLINICAL_REASONING_PROMPT';
  if (/\b(?:define|name|list|recall|recalled fact|which drug|which organism)\b/u.test(normalized)) return 'RECALL_PROMPT';
  if (surfaceClass === 'INCOMPLETE') return 'INCOMPLETE_QUESTION';
  if (surfaceClass === 'RAPID_FIRE') return 'RAPID_FIRE_PROMPT';
  if (surfaceClass === 'IMPLIED') return 'IMPLIED_QUESTION';
  return 'EXPLICIT_QUESTION';
}

const COMPOUND_TARGET_PATTERNS = Object.freeze([
  Object.freeze(['DIAGNOSIS', /\b(?:diagnos(?:is|e|ed|ing)|most likely condition)\b/iu]),
  Object.freeze(['DIFFERENTIAL', /\b(?:differential|differentiate|distinguish|versus|vs\.?)\b/iu]),
  Object.freeze(['MECHANISM', /\b(?:mechanism|pathophysiolog\w*|etiolog\w*|causes?|why)\b/iu]),
  Object.freeze(['MANAGEMENT', /\b(?:manage\w*|management|treat\w*|treatment|therapy|intervention)\b/iu]),
  Object.freeze(['NEXT_BEST_STEP', /\b(?:next best step|next step|initial step|first step)\b/iu]),
  Object.freeze(['INTERPRETATION', /\b(?:interpret\w*|ecg|ekg|x[- ]?ray|ct scan|mri|ultrasound|blood gas|urinalysis)\b/iu]),
  Object.freeze(['WORKUP', /\b(?:workup|evaluation|evaluate|investigat\w*|laboratory tests?|imaging tests?)\b/iu]),
  Object.freeze(['PROGNOSIS', /\b(?:prognos\w*|outcomes?|survival|mortality|morbidity)\b/iu]),
  Object.freeze(['COMPLICATION', /\b(?:complications?|adverse effects?|side effects?)\b/iu]),
  Object.freeze(['FEATURES', /\b(?:signs?|symptoms?|features?|findings?|presentation)\b/iu]),
  Object.freeze(['PREVENTION', /\b(?:prevent\w*|screen\w*|vaccin\w*)\b/iu]),
  Object.freeze(['RECALL', /\b(?:name|list|define|drug|organism|marker|criteria)\b/iu]),
]);

function compoundTargetCategories(text) {
  return new Set(COMPOUND_TARGET_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([category]) => category));
}

function hasPromptSurface(text) {
  return QUESTION_FORM.test(text) || RAPID_FIRE.test(text);
}

function trimCharacterSpan(value, start, end) {
  let boundedStart = start;
  let boundedEnd = end;
  while (boundedStart < boundedEnd && /\s/u.test(value[boundedStart])) boundedStart += 1;
  while (boundedEnd > boundedStart && /\s/u.test(value[boundedEnd - 1])) boundedEnd -= 1;
  return {
    text: value.slice(boundedStart, boundedEnd),
    source_character_start: boundedStart,
    source_character_end: boundedEnd,
  };
}

function shouldSplitCompound(left, right, separatorKind, inheritedPrompt) {
  if (!left.text || !right.text) return false;
  const leftPrompt = hasPromptSurface(left.text);
  const rightPrompt = hasPromptSurface(right.text);
  if (leftPrompt && rightPrompt) return true;
  const leftCategories = compoundTargetCategories(left.text);
  const rightCategories = compoundTargetCategories(right.text);
  if (leftCategories.size === 0 || rightCategories.size === 0) return false;
  const distinctConstructs = [...leftCategories].some((value) => !rightCategories.has(value))
    || [...rightCategories].some((value) => !leftCategories.has(value));
  if (!distinctConstructs) return false;
  if (separatorKind === 'COMMA') return inheritedPrompt;
  return inheritedPrompt || leftPrompt || rightPrompt;
}

function splitCompoundSpan(value, span, inheritedPrompt) {
  const local = value.slice(span.source_character_start, span.source_character_end);
  const boundary = /,\s+(?:and|or|then)\s+|\s+(?:and|or|then)\s+|;|,\s+/giu;
  for (const match of local.matchAll(boundary)) {
    const absoluteStart = span.source_character_start + match.index;
    const absoluteEnd = absoluteStart + match[0].length;
    const separatorKind = match[0].trimStart().startsWith(',') ? 'COMMA'
      : (match[0] === ';' ? 'SEMICOLON' : 'CONJUNCTION');
    const left = trimCharacterSpan(value, span.source_character_start, absoluteStart);
    const right = trimCharacterSpan(value, absoluteEnd, span.source_character_end);
    if (!shouldSplitCompound(left, right, separatorKind, inheritedPrompt)) continue;
    return [
      ...splitCompoundSpan(value, left, inheritedPrompt),
      ...splitCompoundSpan(value, right, inheritedPrompt),
    ];
  }
  return [span];
}

function splitSegmentClauses(text) {
  const value = String(text ?? '').trim();
  if (!value) return [];
  const parts = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (!['?', '!', '.'].includes(character)) continue;
    const next = value[index + 1];
    if (next !== undefined && !/\s/u.test(next)) continue;
    if (character === '.') {
      const prior = value.slice(start, index).trim().split(/\s+/u).at(-1)?.toLowerCase() ?? '';
      if (['dr', 'mr', 'mrs', 'ms', 'vs', 'etc', 'e.g', 'i.e'].includes(prior)) continue;
    }
    const part = trimCharacterSpan(value, start, index + 1);
    if (part.text) parts.push(part);
    while (index + 1 < value.length && /\s/u.test(value[index + 1])) index += 1;
    start = index + 1;
  }
  const remainder = trimCharacterSpan(value, start, value.length);
  if (remainder.text) parts.push(remainder);
  const terminalClauses = parts.length > 0
    ? parts : [trimCharacterSpan(value, 0, value.length)];
  return terminalClauses.flatMap((clause) => {
    const inheritedPrompt = hasPromptSurface(clause.text);
    const compoundParts = splitCompoundSpan(value, clause, inheritedPrompt);
    const compound = compoundParts.length > 1;
    return compoundParts.map((part) => ({
      ...part,
      compound_fragment: compound,
      inherited_prompt_surface: compound && inheritedPrompt,
    }));
  });
}

function clauseText(clause) {
  return typeof clause === 'string' ? clause : clause.text;
}

function isPromptClause(clause) {
  const text = clauseText(clause);
  return hasPromptSurface(text)
    || (clause?.compound_fragment === true
      && clause?.inherited_prompt_surface === true
      && compoundTargetCategories(text).size > 0);
}

function sourceSpeakerContext(records) {
  const labelCounts = new Map();
  for (const record of records) {
    const label = String(record.speaker_label ?? '').trim();
    if (!label) continue;
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  return {
    label_counts: labelCounts,
    labeled_record_count: [...labelCounts.values()].reduce((sum, value) => sum + value, 0),
    verified_drj_labels: new Set(),
    corroborated_drj_labels: new Set(),
  };
}

function privacyClassification(text) {
  const matches = PII_PATTERNS.map((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
  return {
    privacy_class: matches.some(Boolean) ? 'POTENTIAL_DIRECT_IDENTIFIER' : 'RESTRICTED_UNREVIEWED',
    privacy_review_status: 'REVIEW_REQUIRED',
    privacy_flags: matches.map((matched, index) => matched ? `PII_PATTERN_${index + 1}` : null).filter(Boolean),
  };
}

function questionForm(extractionClass) {
  const map = {
    DIAGNOSIS_PROMPT: 'DIAGNOSIS', DIFFERENTIAL_PROMPT: 'DIFFERENTIAL',
    MECHANISM_PROMPT: 'MECHANISM', MANAGEMENT_PROMPT: 'MANAGEMENT',
    NEXT_BEST_STEP_PROMPT: 'NEXT_BEST_STEP', INTERPRETATION_PROMPT: 'INTERPRETATION',
    RECALL_PROMPT: 'RAPID_RECALL', CLINICAL_REASONING_PROMPT: 'CLINICAL_REASONING',
    TESTABLE_TEACHING_STATEMENT: 'TEACHING_STATEMENT', TEACHING_PIVOT: 'TEACHING_PIVOT',
  };
  return map[extractionClass] ?? 'OTHER';
}

function cognitiveLevel(extractionClass) {
  if (['RECALL_PROMPT', 'EXPLICIT_QUESTION', 'RAPID_FIRE_PROMPT'].includes(extractionClass)) return 'REMEMBER_UNDERSTAND';
  if (['MECHANISM_PROMPT', 'INTERPRETATION_PROMPT', 'CLINICAL_REASONING_PROMPT'].includes(extractionClass)) return 'APPLY_ANALYZE';
  if (['DIAGNOSIS_PROMPT', 'DIFFERENTIAL_PROMPT', 'MANAGEMENT_PROMPT', 'NEXT_BEST_STEP_PROMPT'].includes(extractionClass)) return 'CLINICAL_APPLICATION';
  return 'UNCLASSIFIED';
}

function proposal({
  passId,
  record,
  clauseText: restrictedClauseText,
  clauseOrdinal = 0,
  clauseSpan = null,
  surfaceClass,
  nodesBinding = null,
  relationship = null,
}) {
  const domain = classifyMedicalDomain(restrictedClauseText);
  const extractionClass = extractionClassFor(restrictedClauseText, surfaceClass);
  return {
    pass_id: passId,
    evidence_anchor: `${record.record_ordinal}:${clauseOrdinal}`,
    record_ordinal: record.record_ordinal,
    clause_ordinal: clauseOrdinal,
    source_character_start: clauseSpan?.source_character_start ?? null,
    source_character_end: clauseSpan?.source_character_end ?? null,
    segment_locator: record.segment_locator,
    segment_start_time: record.segment_start_time,
    segment_end_time: record.segment_end_time,
    raw_record_hash: record.raw_record_hash,
    restricted_text: restrictedClauseText,
    proposed_extraction_class: extractionClass,
    source_surface_class: surfaceClass,
    proposed_secondary_tags: uniqueSorted([
      surfaceClass === 'RAPID_FIRE' ? 'RAPID_FIRE_SURFACE' : null,
      surfaceClass === 'INCOMPLETE' ? 'INCOMPLETE_SURFACE' : null,
      passId === 'PASS_6' ? 'NODES_ASSISTED' : null,
    ]),
    medical_domain: domain,
    nodes_binding: nodesBinding,
    relationship,
  };
}

function timestampTimeline(records) {
  return records
    .filter((record) => record.segment_start_time !== null)
    .sort((left, right) => left.segment_start_time - right.segment_start_time
      || left.record_ordinal - right.record_ordinal);
}

function nearestTranscriptRecord(timeline, node) {
  if (node.segment_start_time === null || timeline.length === 0) return null;
  let lower = 0;
  let upper = timeline.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (timeline[middle].segment_start_time < node.segment_start_time) lower = middle + 1;
    else upper = middle;
  }
  const candidates = [timeline[lower - 1], timeline[lower]].filter(Boolean);
  candidates.sort((left, right) => (
    Math.abs(left.segment_start_time - node.segment_start_time)
      - Math.abs(right.segment_start_time - node.segment_start_time)
    || left.record_ordinal - right.record_ordinal
  ));
  const best = candidates[0] ?? null;
  return best && Math.abs(best.segment_start_time - node.segment_start_time) <= 8 ? best : null;
}

function passReceipt(passId, recordsInspected, proposals, status = 'COMPLETE') {
  return {
    pass_id: passId,
    status,
    completion_scope: 'AUTOMATED_PASS_EXECUTION_COMPLETE',
    independent_verification_status: ['PASS_7', 'PASS_8'].includes(passId)
      ? 'PENDING_SPECIALIST_REVIEW' : 'PENDING_INDEPENDENT_AUDIT',
    records_inspected: recordsInspected,
    proposals_emitted: proposals.length,
    proposal_root: stableHash(proposals),
  };
}

function contextBoundary(records, ordinal) {
  const start = Math.max(0, ordinal - 1);
  const end = Math.min(records.length - 1, ordinal + 1);
  return {
    start_segment_index: start,
    end_segment_index: end,
    boundary_hash: stableHash({ start_segment_index: start, end_segment_index: end }),
  };
}

function segmentLocator(record) {
  return {
    artifact_record_index: record.record_ordinal,
    segment_index: record.record_ordinal,
    line_index: null,
    locator_hash: stableHash({
      record_ordinal: record.record_ordinal,
      source_locator: record.segment_locator,
      raw_record_hash: record.raw_record_hash,
    }),
  };
}

function teachingRelationship(value, transcriptRecords) {
  if (!value) return null;
  const match = String(value.answer_segment_locator ?? '').match(/(\d+)$/u);
  const ordinal = match ? Number(match[1]) : null;
  const relatedRecord = Number.isSafeInteger(ordinal) ? transcriptRecords[ordinal] : null;
  return {
    relationship_type: value.relationship_type,
    related_occurrence_ids: [],
    related_span_locators: relatedRecord ? [segmentLocator(relatedRecord)] : [],
    related_span_hashes: value.answer_record_hash ? [value.answer_record_hash] : [],
    relationship_confidence: relatedRecord ? 0.75 : 0.25,
  };
}

function reconstructionFor(proposal, normalized) {
  if (proposal.source_surface_class !== 'IMPLIED') {
    return {
      verbatim_or_reconstructed: 'VERBATIM',
      reconstruction_rationale: null,
      reconstruction_type: null,
      reconstruction_changed_fields: normalized.changed_fields,
      reconstruction_confidence: null,
    };
  }
  const text = String(normalized.normalized_wording ?? '').replace(/[.!?]+$/u, '').trim();
  if (!text) {
    return {
      verbatim_or_reconstructed: 'RECONSTRUCTED',
      reconstructed_wording: null,
      reconstruction_rationale: 'The source normalization did not yield safe supported wording.',
      reconstruction_type: 'REJECTED_UNSUPPORTED_RECONSTRUCTION',
      reconstruction_changed_fields: [],
      reconstruction_confidence: 0,
    };
  }
  let reconstructed = `What assessable clinical point is supported by the statement: ${text}?`;
  if (/\bdiagnosis is\b/iu.test(text)) reconstructed = 'What diagnosis is supported by the stated clinical context?';
  else if (/\bnext step is\b/iu.test(text)) reconstructed = 'What is the next best step supported by the stated clinical context?';
  else if (/\bmanagement is\b|\bwe treat\b/iu.test(text)) reconstructed = 'What management approach is supported by the stated clinical context?';
  return {
    verbatim_or_reconstructed: 'RECONSTRUCTED',
    reconstructed_wording: reconstructed,
    reconstruction_rationale: 'A medically explicit answer or teaching pivot was present without a fully spoken interrogative; no new clinical facts were added.',
    reconstruction_type: 'IMPLIED_FROM_EXPLICIT_TEACHING_CUE',
    reconstruction_changed_fields: ['question_form'],
    reconstruction_confidence: 0.7,
  };
}

function reviewProposal(proposal) {
  const score = proposal.medical_domain.medical_relevance_score;
  const answerability = ['NONMEDICAL', 'AMBIGUOUS_MEDICAL_OCCURRENCE', 'TEACHING_PIVOT'].includes(
    proposal.proposed_extraction_class,
  ) ? 'CONTEXT_OR_REVIEW_REQUIRED' : 'POTENTIALLY_ANSWERABLE';
  return {
    medical_review: {
      reviewer_role: 'OSLER_AUTOMATED_PROVISIONAL',
      status: 'REVIEW_REQUIRED',
      ambiguity_flags: score < 0.7 && proposal.proposed_extraction_class !== 'NONMEDICAL'
        ? ['LOW_MEDICAL_EVIDENCE_SCORE'] : [],
    },
    assessment_review: {
      reviewer_role: 'ASSESSMENT_SCIENCE_AUTOMATED_PROVISIONAL',
      answerability_status: answerability === 'POTENTIALLY_ANSWERABLE'
        ? 'UNDETERMINED' : 'UNDETERMINED',
      single_best_answer_suitability: ['DIAGNOSIS_PROMPT', 'MECHANISM_PROMPT', 'MANAGEMENT_PROMPT', 'NEXT_BEST_STEP_PROMPT', 'INTERPRETATION_PROMPT', 'RECALL_PROMPT'].includes(proposal.proposed_extraction_class)
        ? 'REVIEW_REQUIRED' : 'REVIEW_REQUIRED',
      missing_context_status: proposal.proposed_extraction_class === 'INCOMPLETE_QUESTION'
        ? 'CONTEXT_MISSING' : 'UNDETERMINED',
      construct_risk_flags: proposal.proposed_extraction_class === 'AMBIGUOUS_MEDICAL_OCCURRENCE'
        ? ['AMBIGUOUS_CONSTRUCT'] : [],
    },
  };
}

function choosePrimaryClass(proposals) {
  const priority = [
    'LEARNER_QUESTION_WITH_DRJ_TEACHING', 'DIAGNOSIS_PROMPT', 'DIFFERENTIAL_PROMPT',
    'MECHANISM_PROMPT', 'MANAGEMENT_PROMPT', 'NEXT_BEST_STEP_PROMPT',
    'INTERPRETATION_PROMPT', 'CLINICAL_REASONING_PROMPT', 'RECALL_PROMPT',
    'INCOMPLETE_QUESTION', 'RAPID_FIRE_PROMPT', 'EXPLICIT_QUESTION', 'IMPLIED_QUESTION',
    'TEACHING_PIVOT', 'TESTABLE_TEACHING_STATEMENT', 'AMBIGUOUS_MEDICAL_OCCURRENCE',
    'NONMEDICAL',
  ];
  for (const candidate of priority) {
    if (proposals.some((item) => item.proposed_extraction_class === candidate)) return candidate;
  }
  return 'AMBIGUOUS_MEDICAL_OCCURRENCE';
}

export function lifecycleFor({ extractionClass, speaker, privacy, domain, normalization }) {
  if (normalization.lifecycle_status === 'REJECTED_UNSUPPORTED_RECONSTRUCTION') {
    return 'REJECTED_UNSUPPORTED_RECONSTRUCTION';
  }
  if (privacy.privacy_flags.length > 0) return 'PRIVACY_QUARANTINED';
  if (extractionClass === 'NONMEDICAL') return 'REJECTED_NONMEDICAL';
  if (['UNKNOWN', 'MULTI_SPEAKER_UNRESOLVED'].includes(speaker.speaker_authority_class)) {
    return 'SPEAKER_QUARANTINED';
  }
  if (domain.medical_relevance_score < 0.7 || extractionClass === 'AMBIGUOUS_MEDICAL_OCCURRENCE') {
    return 'MEDICAL_QUARANTINED';
  }
  if (speaker.speaker_authority_class === 'PROBABLE_DR_J') return 'REVIEW_REQUIRED';
  return 'READY_FOR_DEDUPLICATION';
}

function buildOccurrence(group, context, transcriptRecords, speakerContext) {
  const first = group[0];
  const recordIndex = transcriptRecords.findIndex(
    (candidate) => candidate.record_ordinal === first.record_ordinal,
  );
  const record = recordIndex >= 0 ? transcriptRecords[recordIndex] : transcriptRecords[0];
  if (!record) throw new Error('occurrence_record_binding_invalid');
  let extractionClass = choosePrimaryClass(group);
  if (!CLASS_SET.has(extractionClass)) throw new Error('extraction_class_internal_invalid');
  const domain = group.map((item) => item.medical_domain)
    .sort((left, right) => right.medical_relevance_score - left.medical_relevance_score)[0];
  if (isAdministrativeOrRhetorical(first.restricted_text)) {
    extractionClass = 'NONMEDICAL';
  }
  const normalized = normalizeOccurrenceText(first.restricted_text);
  const reconstruction = reconstructionFor({ ...first, proposed_extraction_class: extractionClass }, normalized);
  const normalizedWording = reconstruction.reconstructed_wording ?? normalized.normalized_wording;
  const speaker = classifySpeaker(record, speakerContext);
  const privacy = privacyClassification(first.restricted_text);
  const reviews = reviewProposal({ ...first, proposed_extraction_class: extractionClass, medical_domain: domain });
  const occurrenceId = deterministicId(
    'occurrence', context.transcript_hash, first.record_ordinal, first.clause_ordinal,
  );
  const nodesBinding = group.find((item) => item.nodes_binding)?.nodes_binding ?? null;
  const nodesRelationships = group
    .map((item) => item.nodes_binding)
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((candidate) => (
      candidate.node_segment_locator === value.node_segment_locator
      && candidate.node_record_hash === value.node_record_hash
    )) === index);
  const lifecycleStatus = lifecycleFor({
    extractionClass, speaker, privacy, domain, normalization: normalized,
  });
  const quarantineReasons = uniqueSorted([
    lifecycleStatus === 'PRIVACY_QUARANTINED' ? 'POTENTIAL_PRIVACY_CONTENT' : null,
    lifecycleStatus === 'SPEAKER_QUARANTINED' ? 'SPEAKER_AUTHORITY_UNRESOLVED' : null,
    lifecycleStatus === 'MEDICAL_QUARANTINED' ? 'MEDICAL_CLASSIFICATION_OR_AMBIGUITY_REVIEW' : null,
  ]);
  const passIds = uniqueSorted(group.map((item) => item.pass_id));
  return contentAddressedEnvelope({
    candidate_occurrence_id: occurrenceId,
    schema_version: OCCURRENCE_SCHEMA_VERSION,
    extraction_run_id: context.extraction_run_id,
    source_alias: context.source_alias,
    artifact_alias: context.transcript_artifact_alias,
    transcript_hash_binding: context.transcript_hash,
    nodes_hash_binding: nodesBinding ? context.nodes_hash : null,
    segment_locator: segmentLocator(record),
    segment_start_time: first.segment_start_time,
    segment_end_time: first.segment_end_time,
    source_lineage_hash: context.source_lineage_hash,
    retrieval_receipt_binding: context.retrieval_receipt_binding,
    processing_receipt_binding: context.processing_receipt_binding,
    speaker_authority_class: speaker.speaker_authority_class,
    speaker_confidence_score: speaker.speaker_confidence_score,
    speaker_confidence_basis: speaker.speaker_confidence_basis,
    speaker_review_status: speaker.speaker_review_status,
    restricted_verbatim_content: first.restricted_text,
    privacy_safe_normalized_wording: normalizedWording,
    verbatim_or_reconstructed: reconstruction.verbatim_or_reconstructed,
    reconstruction_rationale: reconstruction.reconstruction_rationale,
    reconstruction_type: reconstruction.reconstruction_type,
    reconstruction_changed_fields: reconstruction.reconstruction_changed_fields,
    reconstruction_confidence: reconstruction.reconstruction_confidence,
    extraction_class: extractionClass,
    secondary_tags: uniqueSorted([
      ...group.flatMap((item) => item.proposed_secondary_tags),
      ...group.map((item) => item.proposed_extraction_class).filter((value) => value !== extractionClass),
    ]),
    original_context_boundary: contextBoundary(transcriptRecords, recordIndex >= 0 ? recordIndex : 0),
    relevant_answer_or_teaching_span_relationship: teachingRelationship(
      group.find((item) => item.relationship)?.relationship ?? null,
      transcriptRecords,
    ),
    nodes_assisted_relationships: nodesRelationships,
    subject: domain.subject,
    organ_system: domain.organ_system,
    discipline: domain.discipline,
    competency: extractionClass.includes('MANAGEMENT') || extractionClass.includes('NEXT_BEST_STEP')
      ? 'PATIENT_CARE' : 'MEDICAL_KNOWLEDGE',
    cognitive_level: cognitiveLevel(extractionClass),
    question_form: questionForm(extractionClass),
    educational_intent: extractionClass === 'NONMEDICAL' ? 'NOT_APPLICABLE' : 'RESTRICTED_TEACHING_CANDIDATE',
    usmle_relevance: domain.medical_relevance_score >= 0.7 ? 'POSSIBLY_RELEVANT' : 'UNDETERMINED',
    img_relevance: domain.medical_relevance_score >= 0.7 ? 'POSSIBLY_RELEVANT' : 'UNDETERMINED',
    evidence_sensitivity_flag: /\b(?:guideline|screen|recommend|first[- ]line|standard of care)\b/iu.test(first.restricted_text),
    guideline_sensitivity_flag: /\b(?:guideline|recommend|first[- ]line|standard of care)\b/iu.test(first.restricted_text),
    medical_ambiguity_flags: reviews.medical_review.ambiguity_flags,
    answerability_status: reviews.assessment_review.answerability_status,
    single_best_answer_suitability: reviews.assessment_review.single_best_answer_suitability,
    missing_context_status: reviews.assessment_review.missing_context_status,
    assessment_suitability_status: 'REVIEW_REQUIRED',
    likely_difficulty_band: 'UNDETERMINED',
    construct_risk_flags: reviews.assessment_review.construct_risk_flags,
    privacy_class: privacy.privacy_class,
    rights_status: 'REVIEW_REQUIRED',
    medical_review_status: reviews.medical_review.status,
    privacy_review_status: privacy.privacy_review_status,
    release_status: 'RELEASE_PROHIBITED',
    quarantine_reasons: quarantineReasons,
    provisional_concept_id: null,
    provisional_duplicate_cluster_id: null,
    duplicate_relationship_type: 'NOT_DUPLICATE',
    duplicate_confidence: 0,
    linked_occurrence_ids: [],
    agent_review_receipts: [
      context.medical_review_receipt_binding
        ?? deterministicId('review', context.transcript_artifact_alias, 'OSLER_AUTOMATED_PROVISIONAL'),
      context.assessment_review_receipt_binding
        ?? deterministicId('review', context.transcript_artifact_alias, 'ASSESSMENT_SCIENCE_AUTOMATED_PROVISIONAL'),
    ],
    disagreement_records: [],
    adjudication_status: 'PENDING',
    lifecycle_status: lifecycleStatus,
    extraction_pass_bindings: passIds,
  });
}

export function runExtractionPasses({
  transcriptRecords,
  nodesRecords = [],
  context,
}) {
  if (!Array.isArray(transcriptRecords) || !Array.isArray(nodesRecords)) {
    throw new TypeError('extraction_records_required');
  }
  if (!context?.transcript_hash || !context?.source_alias || !context?.transcript_artifact_alias) {
    throw new TypeError('extraction_context_invalid');
  }
  const receipts = [];
  const proposalsByPass = new Map();
  const emitPass = (passId, recordsInspected, proposals) => {
    proposalsByPass.set(passId, proposals);
    receipts.push(passReceipt(passId, recordsInspected, proposals));
  };

  const pass1 = [];
  for (const record of transcriptRecords) {
    if (!record.text) continue;
    splitSegmentClauses(record.text).forEach((clause, index) => {
      if (isPromptClause(clause)) pass1.push(proposal({
        passId: 'PASS_1', record, clauseText: clauseText(clause), clauseOrdinal: index,
        clauseSpan: clause, surfaceClass: 'DIRECT',
      }));
    });
  }
  emitPass('PASS_1', transcriptRecords.length, pass1);

  const pass2 = [];
  for (const record of transcriptRecords) {
    if (!record.text) continue;
    splitSegmentClauses(record.text).forEach((clause, clauseOrdinal) => {
      const text = clauseText(clause);
      const surface = RAPID_FIRE.test(text) ? 'RAPID_FIRE' : (INCOMPLETE.test(text) ? 'INCOMPLETE' : null);
      if (surface) pass2.push(proposal({
        passId: 'PASS_2', record, clauseText: text, clauseOrdinal, clauseSpan: clause,
        surfaceClass: surface,
      }));
    });
  }
  emitPass('PASS_2', transcriptRecords.length, pass2);

  const pass3 = [];
  for (const record of transcriptRecords) {
    if (!record.text) continue;
    splitSegmentClauses(record.text).forEach((clause, clauseOrdinal) => {
      const text = clauseText(clause);
      if (isPromptClause(clause)) return;
      const domain = classifyMedicalDomain(text);
      if ((domain.medical_relevance_score >= 0.55 && /\b(?:diagnosis is|answer is|next step is|management is|we treat|because|therefore|in contrast)\b/iu.test(text))
        || /\bscenario\b.*\b(?:changes?|expected|conclusion|follows?)\b/iu.test(text)) {
        pass3.push(proposal({
          passId: 'PASS_3', record, clauseText: text, clauseOrdinal, clauseSpan: clause,
          surfaceClass: 'IMPLIED',
        }));
      }
    });
  }
  emitPass('PASS_3', transcriptRecords.length, pass3);

  const provisionalSpeakerContext = sourceSpeakerContext(transcriptRecords);
  const pass4 = [];
  for (let index = 0; index < transcriptRecords.length; index += 1) {
    const record = transcriptRecords[index];
    if (!record.text) continue;
    const speaker = classifySpeaker(record, provisionalSpeakerContext);
    if (speaker.speaker_authority_class !== 'LEARNER_OR_OTHER') continue;
    const response = transcriptRecords.slice(index + 1, index + 4).find((candidate) => {
      if (!candidate.text) return false;
      const responseSpeaker = classifySpeaker(candidate, provisionalSpeakerContext);
      return ['VERIFIED_DR_J', 'HIGH_CONFIDENCE_DR_J', 'PROBABLE_DR_J'].includes(responseSpeaker.speaker_authority_class)
        && classifyMedicalDomain(candidate.text).medical_relevance_score >= 0.7;
    });
    if (!response) continue;
    splitSegmentClauses(record.text).forEach((clause, clauseOrdinal) => {
      if (!isPromptClause(clause)) return;
      pass4.push(proposal({
        passId: 'PASS_4', record, clauseText: clauseText(clause), clauseOrdinal,
        clauseSpan: clause, surfaceClass: 'LEARNER_TEACHING',
        relationship: {
          relationship_type: 'LEARNER_QUESTION_TO_DRJ_TEACHING',
          answer_segment_locator: response.segment_locator,
          answer_record_hash: response.raw_record_hash,
        },
      }));
    });
  }
  emitPass('PASS_4', transcriptRecords.length, pass4);

  const pass5 = [];
  for (const record of transcriptRecords) {
    if (!record.text) continue;
    splitSegmentClauses(record.text).forEach((clause, clauseOrdinal) => {
      const text = clauseText(clause);
      if (isPromptClause(clause)) return;
      const domain = classifyMedicalDomain(text);
      if (domain.medical_relevance_score >= 0.55 || TEACHING_CUE.test(text)
        || /\bteaching (?:pivot|statement)\b/iu.test(text)) {
        pass5.push(proposal({
          passId: 'PASS_5', record, clauseText: text, clauseOrdinal, clauseSpan: clause,
          surfaceClass: /\b(?:may be|might be|unclear|uncertain|ambiguous|context (?:is )?(?:incomplete|missing))\b/iu.test(text)
            ? 'AMBIGUOUS'
            : (TEACHING_CUE.test(text) ? 'TEACHING_PIVOT' : 'TEACHING_STATEMENT'),
        }));
      }
    });
  }
  emitPass('PASS_5', transcriptRecords.length, pass5);

  const pass6 = [];
  const transcriptTimeline = timestampTimeline(transcriptRecords);
  const unmatchedMedicalNodes = [];
  for (const node of nodesRecords) {
    if (!node.text) continue;
    const nodeClauses = splitSegmentClauses(node.text).filter((clause) => (
      classifyMedicalDomain(clauseText(clause)).medical_relevance_score >= 0.55
      || (clause.inherited_prompt_surface === true
        && compoundTargetCategories(clauseText(clause)).size > 0)
    ));
    if (nodeClauses.length === 0) continue;
    const transcriptRecord = nearestTranscriptRecord(transcriptTimeline, node);
    if (!transcriptRecord) {
      unmatchedMedicalNodes.push(node);
      continue;
    }
    const transcriptClauses = splitSegmentClauses(transcriptRecord.text);
    nodeClauses.forEach((nodeClause, nodeClauseIndex) => {
      const nodeText = clauseText(nodeClause);
      const nodeSignature = normalizeForSignature(nodeText);
      const matchingClause = transcriptClauses.findIndex((transcriptClause) => {
        const clauseSignature = normalizeForSignature(clauseText(transcriptClause));
        return clauseSignature === nodeSignature
          || (Math.min(clauseSignature.length, nodeSignature.length) >= 12
            && (clauseSignature.includes(nodeSignature) || nodeSignature.includes(clauseSignature)));
      });
      const clauseOrdinal = matchingClause >= 0
        ? matchingClause
        : 1_000_000 + (Number(node.record_ordinal ?? 0) * 1_000) + nodeClauseIndex;
      pass6.push(proposal({
        passId: 'PASS_6',
        record: transcriptRecord,
        clauseText: nodeText,
        clauseOrdinal,
        clauseSpan: nodeClause,
        surfaceClass: isPromptClause(nodeClause)
          ? 'DIRECT' : (TEACHING_CUE.test(nodeText) ? 'TEACHING_STATEMENT' : 'AMBIGUOUS'),
        nodesBinding: {
          node_segment_locator: node.segment_locator,
          node_record_hash: node.raw_record_hash,
          relationship: 'TIME_ALIGNED_NODES_ASSISTED_RECOVERY',
        },
      }));
    });
  }
  emitPass('PASS_6', nodesRecords.length, pass6);

  const prior = [...proposalsByPass.values()].flat();
  const representedAnchors = new Set(prior.map((item) => item.evidence_anchor));
  const pass8 = [];
  for (const record of transcriptRecords) {
    if (!record.text) continue;
    splitSegmentClauses(record.text).forEach((clause, clauseOrdinal) => {
      if (representedAnchors.has(`${record.record_ordinal}:${clauseOrdinal}`)) return;
      const text = clauseText(clause);
      const domain = classifyMedicalDomain(text);
      pass8.push(proposal({
        passId: 'PASS_8', record, clauseText: text, clauseOrdinal, clauseSpan: clause,
        surfaceClass: domain.medical_relevance_score >= 0.55 ? 'AMBIGUOUS' : 'NONMEDICAL',
      }));
    });
  }
  const pass7 = [...prior, ...pass8].map((item) => ({
    ...item,
    pass_id: 'PASS_7',
    review_authority: 'AUTOMATED_PROVISIONAL_NOT_MEDICAL_APPROVAL',
    credentialed_physician_review_performed: false,
    final_assessment_approval_performed: false,
    ...reviewProposal(item),
  }));
  emitPass('PASS_7', transcriptRecords.length, pass7);
  emitPass('PASS_8', transcriptRecords.length, pass8);

  const allProposals = [...proposalsByPass.values()].flat();
  const grouped = new Map();
  for (const item of allProposals) {
    const existing = grouped.get(item.evidence_anchor) ?? [];
    existing.push(item);
    grouped.set(item.evidence_anchor, existing);
  }
  const occurrences = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))
    .map(([, group]) => buildOccurrence(group, context, transcriptRecords, provisionalSpeakerContext));
  const pass9Proposals = occurrences.map((occurrence) => ({
    pass_id: 'PASS_9', evidence_anchor: occurrence.segment_locator,
    proposed_extraction_class: occurrence.extraction_class,
    raw_record_hash: sha256(occurrence.candidate_occurrence_id),
    occurrence_content_hash: occurrence.content_hash,
  }));
  emitPass('PASS_9', transcriptRecords.length, pass9Proposals);

  const expectedPassIds = PASS_DEFINITIONS.map((item) => item.pass_id);
  if (receipts.length !== expectedPassIds.length
      || receipts.some((receipt, index) => receipt.pass_id !== expectedPassIds[index])) {
    throw new Error('nine_pass_contract_violation');
  }
  return {
    occurrences,
    pass_receipts: receipts,
    proposal_counts: Object.fromEntries(
      [...proposalsByPass].map(([passId, items]) => [passId, items.length]),
    ),
    nodes_unmatched_medical_count: unmatchedMedicalNodes.length,
    unmatched_medical_nodes: unmatchedMedicalNodes,
  };
}
