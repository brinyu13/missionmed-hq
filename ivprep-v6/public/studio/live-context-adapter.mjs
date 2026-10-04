import {normalizeFollowUpRequest} from '../capabilities/interview-policy.mjs';
const GOALS = Object.freeze({
  'Full IV Simulation': 'Full interview simulation',
  'Guided Mock IV Practice': 'Coached practice',
  'Individual Question': 'Individual question',
});

const INTERVIEWERS = Object.freeze({
  'Program Director': 'Program Director · balanced',
  'Associate Program Director': 'Associate Program Director · balanced',
  Faculty: 'Faculty · conversational',
  'Chief Resident': 'Chief Resident · warm',
});

const ENVIRONMENTS = Object.freeze({
  MissionMed: 'MissionMed · interview only',
  Webex: 'MissionMed · interview only',
  Zoom: 'MissionMed · interview only',
  Teams: 'MissionMed · interview only',
});

// A practice preference is never a source receipt or permission to change policy.
export function normalizePracticeFocus(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 500 || /[\p{Cc}\p{Cf}]/u.test(value)) {
    throw new TypeError('Practice focus is invalid.');
  }
  return value.trim() || undefined;
}

export function createLiveContext({ wizard = {}, interviewSet = [], targetQuestions = 1 } = {}) {
  const practiceFocus = wizard.goal === 'Guided Mock IV Practice' ? normalizePracticeFocus(wizard.focus) : undefined;
  return Object.freeze({
    goal: GOALS[wizard.goal] || 'Residency interview practice',
    questionIds: Object.freeze(interviewSet.map((question) => question?.question_id).filter(Boolean).slice(0, 30)),
    interviewer: INTERVIEWERS[wizard.interviewer] || 'Program Director · balanced',
    ...(Object.hasOwn(wizard, 'interviewerStyle') ? { interviewerStyle: wizard.interviewerStyle } : {}),
    pressurePractice: wizard.goal !== 'Individual Question' && wizard.pressurePractice === true,
    ...(practiceFocus ? { practiceFocus } : {}),
    ...normalizeFollowUpRequest(wizard),
    program: 'General residency interview',
    environment: wizard.analyticsEnabled === true
      ? 'MissionMed · coached analytics'
      : (ENVIRONMENTS[wizard.environment] || 'MissionMed · interview only'),
    targetQuestions: Math.max(1, Math.min(30, Number(targetQuestions) || 1)),
  });
}
