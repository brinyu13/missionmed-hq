// Session material is intentionally absent from actor properties, JSON and DB
// models. Only the exact authorized request's actor can retrieve this context.
const sessions=new WeakMap();
export function bindOwnerSession(actor,{verifier,expiresAt}) {
  if(!actor || !Object.isFrozen(actor) || !/^[a-f0-9]{64}$/.test(verifier||'') ||
    !Number.isSafeInteger(expiresAt))throw new TypeError('Invalid owner session context');
  sessions.set(actor,Object.freeze({verifier,expiresAt}));
  return actor;
}
export function readOwnerSession(actor,now=Date.now()) {
  const context=actor && sessions.get(actor);
  const admitted=actor?.eligible===true && (actor.role==='admin'&&actor.tier==='admin' ||
    actor.role==='student'&&['360','ivprep_complete'].includes(actor.tier));
  if(!admitted || !context || !Number.isFinite(now) || context.expiresAt<=now)return null;
  return context;
}
