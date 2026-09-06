export const PROVIDER_STATES = Object.freeze([
  'DISABLED',
  'ELIGIBLE',
  'RESERVED',
  'ROOM_CREATED',
  'DISPATCH_CREATED',
  'AGENT_JOINING',
  'AVATAR_CREATING',
  'AVATAR_JOINED',
  'MEDIA_READY',
  'ACTIVE',
  'TERMINATING',
  'RECONCILING',
  'CLOSED',
  'FAILED_CLOSED',
]);

const FORWARD = Object.freeze({
  DISABLED: 'ELIGIBLE',
  ELIGIBLE: 'RESERVED',
  RESERVED: 'ROOM_CREATED',
  ROOM_CREATED: 'DISPATCH_CREATED',
  DISPATCH_CREATED: 'AGENT_JOINING',
  AGENT_JOINING: 'AVATAR_CREATING',
  AVATAR_CREATING: 'AVATAR_JOINED',
  AVATAR_JOINED: 'MEDIA_READY',
  MEDIA_READY: 'ACTIVE',
  ACTIVE: 'TERMINATING',
  TERMINATING: 'RECONCILING',
  RECONCILING: 'CLOSED',
});

const TERMINAL = new Set(['CLOSED', 'FAILED_CLOSED']);

export function initialProviderSessionState() {
  return Object.freeze({ state: 'DISABLED', failure: null, history: Object.freeze(['DISABLED']) });
}

export function advanceProviderSession(current, next) {
  if (!PROVIDER_STATES.includes(current?.state) || !PROVIDER_STATES.includes(next)) throw new TypeError('Unknown provider lifecycle state.');
  if (TERMINAL.has(current.state)) throw new Error('Provider lifecycle is terminal.');
  const allowed = FORWARD[current.state] === next
    || (next === 'FAILED_CLOSED' && current.state === 'ELIGIBLE')
    || (next === 'TERMINATING' && !['DISABLED', 'ELIGIBLE', 'TERMINATING', 'RECONCILING'].includes(current.state))
    || (next === 'RECONCILING' && current.state === 'TERMINATING')
    || (next === 'FAILED_CLOSED' && current.state === 'RECONCILING');
  if (!allowed) throw new Error(`Provider lifecycle cannot move from ${current.state} to ${next}.`);
  return Object.freeze({ ...current, state: next, history: Object.freeze([...current.history, next]) });
}

export function failProviderSession(current, code = 'provider_failure') {
  if (TERMINAL.has(current?.state)) return current;
  let next = current;
  if (next.state === 'ELIGIBLE') {
    next = advanceProviderSession(next, 'FAILED_CLOSED');
    return Object.freeze({ ...next, failure: String(code).slice(0, 80) });
  }
  if (!['TERMINATING', 'RECONCILING'].includes(next.state)) next = advanceProviderSession(next, 'TERMINATING');
  if (next.state === 'TERMINATING') next = advanceProviderSession(next, 'RECONCILING');
  next = advanceProviderSession(next, 'FAILED_CLOSED');
  return Object.freeze({ ...next, failure: String(code).slice(0, 80) });
}
