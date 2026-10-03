// Current QuestionStore IDs and fresh account governance only. A load failure
// is recoverable/unavailable, never a made-up Core 10 or an ungoverned fallback.
import {accountSnapshot} from './adapters/account-adapter.mjs';
export async function loadQuestions({account=accountSnapshot(),moduleLoader=()=>import('/iv-prep-on-call/assets/questions/question-store.mjs')}={}) {
  if(account?.mode!=='REAL'||!account.api?.questions)throw new Error('Sign in through Matrix to load your question library.');
  const mod=await moduleLoader(),store=mod.createDefaultQuestionStore();
  const payload=await account.api.questions();
  if(!Array.isArray(payload?.questions))throw new Error('The current question library is unavailable. Try again from Home.');
  store.applyGovernance(payload.questions);
  const questions=store.all();
  if(!questions.length)throw new Error('No current questions are available for this account.');
  return {source:'production-corpus',governance:'current account governance',store,COLLECTIONS:mod.COLLECTIONS,questions,core:store.core()};
}

export const CATEGORY_LABELS = {
  CORE: 'Core 10', BEHAVIORAL: 'Behavioral', PROGRAM_FIT: 'Program fit', SPECIALTY: 'Specialty', PERSONAL: 'Personal', CLINICAL_EXPERIENCE: 'Clinical', RESEARCH: 'Research', COMMUNICATION: 'Communication', ETHICS: 'Ethics', FAILURE: 'Failure', LEADERSHIP: 'Leadership', TEAMWORK: 'Teamwork', CONFLICT: 'Conflict', STRENGTHS: 'Strengths', WEAKNESSES: 'Weaknesses', CAREER_GOALS: 'Career goals', MOTIVATION: 'Motivation', RED_FLAGS: 'Red flags', CREATIVE_UNUSUAL: 'Unusual', TRADITIONAL: 'Traditional', BACKGROUND: 'Background', SITUATIONAL: 'Situational', MISTAKE_SAFETY: 'Mistakes & safety', STRESS_PRESSURE: 'Stress', HOBBIES: 'Hobbies', CV_BASED: 'CV-based', PATIENT_INTERACTION: 'Patients', ADVERSITY: 'Adversity', HEALTHCARE_POLICY: 'Policy',
};

// Selector filters (Founder amendment B). Each maps to a QuestionStore query or a tag set.
export const FILTERS = [
  { id: 'recommended', label: 'Recommended', hint: 'Core 10 first, then least practiced' },
  { id: 'core', label: 'Core 10' },
  { id: 'program', label: 'Program-specific', tags: ['PROGRAM_FIT', 'MOTIVATION', 'SPECIALTY', 'CAREER_GOALS'] },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'story', label: 'Personal story', tags: ['PERSONAL', 'BACKGROUND', 'HOBBIES', 'ADVERSITY', 'TRADITIONAL'] },
  { id: 'challenging', label: 'Challenging', tags: ['RED_FLAGS', 'WEAKNESSES', 'FAILURE', 'MISTAKE_SAFETY', 'ETHICS', 'STRESS_PRESSURE', 'CONFLICT'] },
  { id: 'custom', label: 'Custom / admin', hint: 'Governance-added questions', source: ['custom', 'admin_custom', 'mentor', 'cv_generated'] },
  { id: 'all', label: 'Full library' },
];

export function queryQuestions({ questions, store, filter = 'recommended', search = '', attempts = [] }) {
  const needle = search.trim().toLowerCase();
  let rows = questions;
  const f = FILTERS.find((x) => x.id === filter) || FILTERS[0];
  if (store && (f.id === 'core' || f.id === 'behavioral')) rows = store.query({ collection: f.id === 'core' ? 'CORE' : 'BEHAVIORAL' });
  else if (f.tags) rows = rows.filter((q) => (q.tags || []).some((t) => f.tags.includes(t)));
  else if (f.source) rows = rows.filter((q) => f.source.includes(q.source));
  if (needle) rows = rows.filter((q) => q.canonical_text.toLowerCase().includes(needle) || (q.tags || []).some((t) => t.toLowerCase().includes(needle)) || q.question_id.toLowerCase().includes(needle));
  if (f.id === 'recommended' && !needle) {
    const practiced = new Map(); for (const a of attempts) practiced.set(a.questionId, (practiced.get(a.questionId) || 0) + 1);
    rows = rows.slice().sort((a, b) => (b.core_priority === true) - (a.core_priority === true) || (practiced.get(a.question_id) || 0) - (practiced.get(b.question_id) || 0));
  }
  return rows;
}

export function defaultMockSet(questions, count = 5) {
  const core = questions.filter((q) => q.core_priority === true);
  return (core.length ? core : questions).slice(0, count);
}
