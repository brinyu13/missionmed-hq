export const MIN_AVATAR_ENDURANCE_SECONDS = 600;
export const MAX_AVATAR_ENDURANCE_SECONDS = 900;

export function createAvatarEndurancePlan(durationSeconds = MIN_AVATAR_ENDURANCE_SECONDS) {
  const duration = Number(durationSeconds);
  if (!Number.isInteger(duration) || duration < MIN_AVATAR_ENDURANCE_SECONDS || duration > MAX_AVATAR_ENDURANCE_SECONDS) {
    throw new TypeError('Avatar endurance duration must be an integer from 600 through 900 seconds.');
  }
  const utterances = [
    'Welcome. Tell me what first drew you toward residency training in the United States.',
    'You mentioned an important transition. What did you learn about yourself during that period?',
    'Describe a difficult team interaction and the specific part you owned.',
    'If I asked your most recent supervisor where you still need to grow, what would they say?',
    'What are you looking for in a residency program beyond geography and reputation?',
    'Before we close, what question would help you decide whether this program fits you?',
  ];
  const intervalSeconds = Math.max(60, Math.floor((duration - 30) / utterances.length));
  return Object.freeze({
    durationSeconds: duration,
    mode: 'single-authorized-production-avatar-transport-endurance',
    finalAcceptance: false,
    checkpoints: Object.freeze({
      interruptAtSeconds: Math.floor(duration / 3),
      reconnectAtSeconds: Math.floor(duration / 2),
      stopAtSeconds: duration,
    }),
    utterances: Object.freeze(utterances.map((text, index) => Object.freeze({
      atSeconds: Math.min(duration - 20, index * intervalSeconds),
      text,
    }))),
  });
}
