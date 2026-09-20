const GOALS = Object.freeze({
  'Full IV Simulation': 'Full interview simulation',
  'Guided Mock IV Practice': 'Coached practice',
  'Individual Question': 'Individual question',
});

const INTERVIEWERS = Object.freeze({
  'Program Director': 'Program Director · balanced',
  Faculty: 'Faculty · conversational',
  'Chief Resident': 'Chief Resident · warm',
});

const ENVIRONMENTS = Object.freeze({
  MissionMed: 'MissionMed · interview only',
  Webex: 'MissionMed · interview only',
  Zoom: 'MissionMed · interview only',
  Teams: 'MissionMed · interview only',
});

export function createLiveContext({ wizard = {}, interviewSet = [], targetQuestions = 1 } = {}) {
  return Object.freeze({
    goal: GOALS[wizard.goal] || 'Residency interview practice',
    questionIds: Object.freeze(interviewSet.map((question) => question?.question_id).filter(Boolean).slice(0, 30)),
    interviewer: INTERVIEWERS[wizard.interviewer] || 'Program Director · balanced',
    pressurePractice: wizard.pressurePractice === true,
    program: 'General residency interview',
    environment: wizard.analyticsEnabled === true
      ? 'MissionMed · coached analytics'
      : (ENVIRONMENTS[wizard.environment] || 'MissionMed · interview only'),
    targetQuestions: Math.max(1, Math.min(30, Number(targetQuestions) || 1)),
  });
}
