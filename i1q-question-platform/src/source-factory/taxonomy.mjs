import { sha256 } from '../hash.mjs';

export const TAXONOMY_VERSION = 'i1q.taxonomy.v2';
export const MISCONCEPTION_VOCABULARY_VERSION = 'i1q.misconceptions.v2';

const PRIMARY_SPECIALTIES = [
  'foundations', 'cardiology', 'dermatology', 'emergency_medicine', 'endocrinology',
  'gastroenterology', 'hematology_oncology', 'infectious_disease', 'nephrology',
  'neurology', 'obstetrics_gynecology', 'pediatrics', 'preventive_medicine',
  'psychiatry', 'pulmonology', 'rheumatology', 'surgery', 'toxicology',
];

const CLASSIFICATION_PROFILES = [
  ['emergency_medicine', 'allergy_immunology', 'anaphylaxis', 'initial_pharmacologic_management', 'concept.emergency.medicine.intramuscular.epinephrine.first'],
  ['cardiology', 'cardiovascular', 'atrial_fibrillation', 'hemodynamic_instability', 'concept.cardiology.synchronized.cardioversion.for.unstable.af'],
  ['toxicology', 'environmental_exposure', 'carbon_monoxide_poisoning', 'diagnostic_confirmation', 'concept.toxicology.carbon.monoxide.specific.assay'],
  ['neurology', 'central_nervous_system', 'convulsive_status_epilepticus', 'initial_antiseizure_therapy', 'concept.neurology.benzodiazepine.first.phase'],
  ['obstetrics_gynecology', 'maternal_fetal_infectious_disease', 'syphilis_in_pregnancy', 'penicillin_allergy', 'concept.obstetrics.gynecology.desensitize.then.treat.with.penicillin'],
  ['infectious_disease', 'central_nervous_system', 'acute_bacterial_meningitis', 'empiric_treatment_timing', 'concept.infectious.disease.treat.before.delayed.imaging.or.lp'],
  ['gastroenterology', 'hepatobiliary', 'ascites', 'initial_diagnostic_evaluation', 'concept.gastroenterology.diagnostic.paracentesis.for.new.ascites'],
  ['hematology_oncology', 'hematologic', 'immune_thrombotic_thrombocytopenic_purpura', 'emergency_initial_management', 'concept.hematology.oncology.start.tpe.and.corticosteroids.before.adamts13.result'],
  ['emergency_medicine', 'preventive_infectious_disease', 'tetanus_prevention', 'dirty_wound_unknown_immunization', 'concept.emergency.medicine.vaccine.plus.tetanus.immune.globulin'],
  ['endocrinology', 'metabolic', 'diabetic_ketoacidosis', 'potassium_management', 'concept.endocrinology.replace.low.potassium.before.insulin'],
  ['hematology_oncology', 'spine', 'metastatic_spinal_cord_compression', 'urgent_imaging', 'concept.hematology.oncology.urgent.whole.spine.mri'],
  ['nephrology', 'cardiorenal', 'severe_hyperkalemia', 'cardiac_membrane_protection', 'concept.nephrology.intravenous.calcium.for.ecg.toxicity'],
  ['obstetrics_gynecology', 'maternal_fetal', 'hypertensive_disorders_of_pregnancy', 'preeclampsia_recognition', 'concept.obstetrics.gynecology.preeclampsia.diagnostic.pattern'],
  ['pediatrics', 'infectious_exanthem', 'measles', 'clinical_recognition', 'concept.pediatrics.classic.measles.sequence'],
  ['obstetrics_gynecology', 'reproductive', 'ectopic_pregnancy', 'ultrasound_diagnosis', 'concept.obstetrics.gynecology.extrauterine.gestational.sac'],
  ['pediatrics', 'respiratory_infectious_disease', 'pertussis', 'paroxysmal_stage', 'concept.pediatrics.classic.pertussis.cough.pattern'],
  ['neurology', 'cerebrovascular', 'acute_stroke', 'syndrome_recognition', 'concept.neurology.sudden.focal.neurologic.deficit'],
  ['psychiatry', 'mental_health', 'bipolar_disorder', 'manic_episode', 'concept.psychiatry.mania.severity.pattern'],
  ['toxicology', 'environmental_exposure', 'carbon_monoxide_poisoning', 'exposure_pattern_recognition', 'concept.toxicology.carbon.monoxide.exposure.cluster'],
  ['surgery', 'gastrointestinal', 'acute_appendicitis', 'classic_presentation', 'concept.surgery.migratory.appendicitis.pain.pattern'],
  ['dermatology', 'integumentary', 'melanoma', 'suspicious_lesion_recognition', 'concept.dermatology.abcde.warning.features'],
  ['preventive_medicine', 'cardiovascular', 'hypertension_screening', 'diagnostic_confirmation', 'concept.preventive.medicine.out.of.office.bp.confirmation'],
  ['nephrology', 'renal', 'glomerular_syndromes', 'nephrotic_pattern', 'concept.nephrology.nephrotic.syndrome.definition'],
  ['rheumatology', 'vascular_inflammatory', 'giant_cell_arteritis', 'high_risk_recognition', 'concept.rheumatology.giant.cell.arteritis.pattern'],
].map(([primary_specialty, organ_system, topic, subtopic, primary_concept_id]) => ({
  primary_specialty, organ_system, topic, subtopic, primary_concept_id,
}));

const MISCONCEPTION_DEFINITIONS = {
  diagnostic_sequence_error: 'Selects a plausible diagnostic action in the wrong order.',
  epidemiology_substitution: 'Substitutes an exposure or population pattern that does not fit the case.',
  finding_disease_mismatch: 'Maps a finding to a disease that does not account for the full pattern.',
  mechanism_confusion: 'Uses an incorrect causal or physiologic mechanism.',
  management_escalation_error: 'Escalates, delays, or sequences management inappropriately.',
  management_indication_error: 'Applies a treatment or intervention without the required indication.',
  near_neighbor_diagnosis: 'Chooses a clinically adjacent diagnosis while missing a discriminating feature.',
  screening_diagnostic_confusion: 'Confuses screening, confirmation, and definitive diagnostic testing.',
  severity_threshold_error: 'Misapplies a severity, duration, or treatment threshold.',
  temporal_pattern_error: 'Misreads onset, duration, sequence, or timing.',
  treatment_diagnosis_confusion: 'Substitutes a treatment concept for the diagnosis or vice versa.',
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const TAXONOMY = deepFreeze({
  version: TAXONOMY_VERSION,
  status: 'INTERNAL_DRAFT_NOT_MEDICALLY_RATIFIED',
  primary_specialties: PRIMARY_SPECIALTIES,
  dimensions: [
    'primary_specialty',
    'organ_system',
    'topic',
    'subtopic',
    'primary_concept_id',
    'clinical_task',
    'reasoning_pattern',
    'difficulty_tier',
    'interview_competency',
    'question_mode',
  ],
  registries: {
    classification_profile_fields: [
      'primary_specialty', 'organ_system', 'topic', 'subtopic', 'primary_concept_id',
    ],
    classification_profiles: CLASSIFICATION_PROFILES,
    organ_systems: [
      'allergy_immunology', 'cardiorenal', 'cardiovascular', 'central_nervous_system',
      'cerebrovascular', 'environmental_exposure', 'gastrointestinal', 'hematologic',
      'hepatobiliary', 'infectious_exanthem', 'integumentary', 'maternal_fetal',
      'maternal_fetal_infectious_disease', 'mental_health', 'metabolic',
      'preventive_infectious_disease', 'renal', 'reproductive',
      'respiratory_infectious_disease', 'spine', 'vascular_inflammatory',
    ],
    clinical_tasks: [
      'identify_the_most_likely_diagnosis', 'select_the_best_diagnostic_test',
      'select_the_best_imaging_study', 'select_the_best_next_diagnostic_step',
      'select_the_best_next_step',
    ],
    reasoning_patterns: [
      'integrate_discriminating_clinical_features',
      'recognize_critical_pattern_then_prioritize_action',
      'recognize_misleading_pulse_oximetry_then_select_specific_assay',
    ],
    difficulty_tiers: ['editorial_uncalibrated'],
    interview_competencies: [
      'pattern_recognition_with_explicit_differential_reasoning',
      'safe_clinical_prioritization_with_concise_rationale',
    ],
    question_modes: ['clinical_scenario', 'fact_recall'],
  },
});

export const MISCONCEPTION_VOCABULARY = deepFreeze({
  version: MISCONCEPTION_VOCABULARY_VERSION,
  status: 'INTERNAL_DRAFT_NOT_MEDICALLY_RATIFIED',
  categories: Object.keys(MISCONCEPTION_DEFINITIONS),
  entries: Object.entries(MISCONCEPTION_DEFINITIONS).map(([category, definition]) => ({
    misconception_id: `misconception.${category}`,
    category,
    definition,
  })),
});

export function misconceptionIdForCategory(category) {
  return MISCONCEPTION_VOCABULARY.entries
    .find((entry) => entry.category === category)?.misconception_id || null;
}

export function taxonomyArtifact() {
  const payload = {
    schema_version: 'missionmed.i1q.taxonomy_artifact.v1',
    taxonomy: TAXONOMY,
    misconception_vocabulary: MISCONCEPTION_VOCABULARY,
  };
  return { ...payload, content_hash: sha256(payload) };
}

export function validateClassification(classification) {
  const errors = [];
  if (!classification || typeof classification !== 'object' || Array.isArray(classification)) {
    return ['classification_object_required'];
  }
  if (classification.taxonomy_version !== TAXONOMY_VERSION) errors.push('taxonomy_version_invalid');
  if (classification.misconception_vocabulary_version !== MISCONCEPTION_VOCABULARY_VERSION) {
    errors.push('misconception_vocabulary_version_invalid');
  }
  if (!TAXONOMY.primary_specialties.includes(classification.primary_specialty)) errors.push('primary_specialty_invalid');
  for (const dimension of TAXONOMY.dimensions) {
    if (typeof classification[dimension] !== 'string' || classification[dimension].trim() === '') {
      errors.push(`classification_dimension_required:${dimension}`);
    }
  }
  if (!TAXONOMY.registries.organ_systems.includes(classification.organ_system)) errors.push('organ_system_invalid');
  if (!TAXONOMY.registries.clinical_tasks.includes(classification.clinical_task)) errors.push('clinical_task_invalid');
  if (!TAXONOMY.registries.reasoning_patterns.includes(classification.reasoning_pattern)) errors.push('reasoning_pattern_invalid');
  if (!TAXONOMY.registries.difficulty_tiers.includes(classification.difficulty_tier)) errors.push('difficulty_tier_invalid');
  if (!TAXONOMY.registries.interview_competencies.includes(classification.interview_competency)) errors.push('interview_competency_invalid');
  if (!TAXONOMY.registries.question_modes.includes(classification.question_mode)) errors.push('question_mode_invalid');
  if (!/^[a-z][a-z0-9_]{2,127}$/u.test(classification.topic || '')) errors.push('topic_invalid');
  if (!/^[a-z][a-z0-9_]{2,127}$/u.test(classification.subtopic || '')) errors.push('subtopic_invalid');
  const conceptSpecialtyPrefix = String(classification.primary_specialty || '').replaceAll('_', '.');
  if (!new RegExp(`^concept\\.${conceptSpecialtyPrefix}\\.[a-z0-9.]{3,160}$`, 'u').test(classification.primary_concept_id || '')) {
    errors.push('primary_concept_id_invalid');
  }
  const registeredProfile = TAXONOMY.registries.classification_profiles.some((profile) => (
    TAXONOMY.registries.classification_profile_fields.every((field) => profile[field] === classification[field])
  ));
  if (!registeredProfile) errors.push('classification_profile_unregistered');
  return errors;
}
