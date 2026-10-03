// Fresh actor-scoped read/merge over the existing IVOC preferences contract.
// Presentation never supplies a subject or recreates admission/mentor authority.
const writes = new WeakMap();
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function owner(controller, isCurrent) {
  const account = controller.account;
  if (account?.mode !== 'REAL' || !/^wp:[1-9][0-9]*$/.test(account.subject || '')) throw new Error('Sign in through Matrix.');
  return { account, current: () => isCurrent() && controller.account === account };
}
async function admission(account, current) {
  const fresh = await account.api.bootstrap();
  if (!current()) return false;
  if (fresh?.entitlement?.admitted !== true || fresh.identity?.subject !== account.subject
    || Boolean(fresh.identity.admin) !== (account.role === 'admin')) throw new Error('Your account access changed. Return to Matrix.');
  return true;
}
export function presentationPreferences(value) {
  const own = object(object(value?.visibility).ivocFable);
  return { density: own.density === 'interview' || own.density === 'coached' ? own.density : value?.visibility?.analyticsVisible === false ? 'interview' : 'coached',
    densityPersisted: own.density === 'interview' || own.density === 'coached',
    overlaysVisible: own.overlaysVisible === true,
    favoriteQuestions: Array.isArray(own.favoriteQuestions) ? [...new Set(own.favoriteQuestions.filter(id => typeof id === 'string' && /^[A-Z0-9][A-Z0-9._:-]{0,119}$/.test(id)))].slice(0,256) : [] };
}
export async function readOwnPresentation(controller, {isCurrent = () => true} = {}) {
  const {account,current} = owner(controller,isCurrent);
  if (!await admission(account,current)) return null;
  const [preferences,mentor] = await Promise.all([account.api.preferences(), account.api.mentorPriorities().catch(() => null)]);
  if (!current()) return null;
  if (mentor && mentor.subjectId !== account.subject) throw new Error('Mentor priority account changed.');
  const first = mentor?.priorities?.find(item => typeof item?.text === 'string' && item.text.trim());
  return {subject:account.subject, preferences:presentationPreferences(preferences), mentorPriority:first?.text || null};
}
export function saveOwnVisibility(controller, patch, {isCurrent = () => true} = {}) {
  const {account,current} = owner(controller,isCurrent);
  const previous = writes.get(account) || Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    if (!current() || !await admission(account,current)) return null;
    const fresh = await account.api.preferences();
    if (!current()) return null;
    const {densityPersisted, ...next} = presentationPreferences(fresh);
    const densityChanged = patch.density === 'coached' || patch.density === 'interview';
    const densityReset = patch.density === 'default';
    if (patch.density === 'coached' || patch.density === 'interview') next.density = patch.density;
    if (typeof patch.overlaysVisible === 'boolean') next.overlaysVisible = patch.overlaysVisible;
    if (Array.isArray(patch.favoriteQuestions)) next.favoriteQuestions = presentationPreferences({visibility:{ivocFable:{favoriteQuestions:patch.favoriteQuestions}}}).favoriteQuestions;
    const visibility = object(fresh?.visibility);
    const ownVisibility = {...object(visibility.ivocFable),...next};
    if (densityReset || !densityPersisted && !densityChanged) delete ownVisibility.density;
    const result = await account.api.savePreferences({ calibration:object(fresh?.calibration),
      visibility:{...visibility,ivocFable:ownVisibility,...(densityReset?{analyticsVisible:true}:densityChanged?{analyticsVisible:next.density==='coached'}:{})},
      coachingEnabled:fresh?.coachingEnabled !== false, recordingDefault:fresh?.recordingDefault !== false });
    return current() ? presentationPreferences(result) : null;
  });
  writes.set(account, operation);
  return operation;
}
