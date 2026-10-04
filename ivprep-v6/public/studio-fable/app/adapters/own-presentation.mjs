// Fresh actor-scoped read/merge over the existing IVOC preferences contract.
// Presentation never supplies a subject or recreates admission/mentor authority.
const writes = new WeakMap();
import {overlayLayers} from './overlay-view-model.mjs';
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function owner(controller, isCurrent) {
  const account = controller.account;
  if (account?.mode !== 'REAL' || !/^wp:[1-9][0-9]*$/.test(account.subject || '')) throw new Error('Sign in through Matrix.');
  const subject=account.subject,role=account.role,api=account.api;
  return { account, current: () => isCurrent() && controller.account === account
    &&account.subject===subject&&account.role===role&&account.api===api };
}
function requireOwnPreferences(value,subject) {
  if(value!==null&&value?.scopeSubject!==subject)throw new Error('Your preference account changed. Return to Matrix.');
}
function assertEffectiveActor(account){
  if(account.api.identity?.subject!==account.subject||Boolean(account.api.identity?.admin)!==(account.role==='admin'))
    throw new Error('Your account access changed. Return to Matrix.');
}
function resolveOwnPreferences(value,validatedAdmission) {
  if(value!==null)return value;
  // A null GET has no actor receipt. Resolve it only from the same response
  // that atomically proved admission, not from defaults or a cached bootstrap.
  if(!Object.hasOwn(validatedAdmission,'preferences')
    ||validatedAdmission.preferences!==null&&(!validatedAdmission.preferences||typeof validatedAdmission.preferences!=='object'||Array.isArray(validatedAdmission.preferences)))
    throw new Error('Your preference projection is unavailable. Return to Matrix.');
  return validatedAdmission.preferences;
}
async function admission(account, current) {
  const fresh = await account.api.bootstrap();
  if (!current()) return false;
  if (fresh?.entitlement?.admitted !== true || fresh.identity?.subject !== account.subject
    || Boolean(fresh.identity.admin) !== (account.role === 'admin')) throw new Error('Your account access changed. Return to Matrix.');
  return fresh;
}
export function presentationPreferences(value) {
  const own = object(object(value?.visibility).ivocFable);
  return { density: own.density === 'interview' || own.density === 'coached' ? own.density : value?.visibility?.analyticsVisible === false ? 'interview' : 'coached',
    densityPersisted: own.density === 'interview' || own.density === 'coached',
    overlaysVisible: own.overlaysVisible === true,
    overlayLayers: overlayLayers(own.overlayLayers),
    favoriteQuestions: Array.isArray(own.favoriteQuestions) ? [...new Set(own.favoriteQuestions.filter(id => typeof id === 'string' && /^[A-Z0-9][A-Z0-9._:-]{0,119}$/.test(id)))].slice(0,256) : [] };
}
export async function readOwnPresentation(controller, {isCurrent = () => true} = {}) {
  const {account,current} = owner(controller,isCurrent);
  if (!await admission(account,current)) return null;
  const [preferences,mentor] = await Promise.all([account.api.preferences(), account.api.mentorPriorities().catch(() => null)]);
  if (!current()) return null;
  requireOwnPreferences(preferences,account.subject);
  if (mentor && mentor.subjectId !== account.subject) throw new Error('Mentor priority account changed.');
  const validatedAdmission=await admission(account,current);
  if (!validatedAdmission) return null;
  assertEffectiveActor(account);
  const ownPreferences=resolveOwnPreferences(preferences,validatedAdmission);
  const first = mentor?.priorities?.find(item => typeof item?.text === 'string' && item.text.trim());
  return {subject:account.subject, preferences:presentationPreferences(ownPreferences), mentorPriority:first?.text || null};
}
export function saveOwnVisibility(controller, patch, {isCurrent = () => true} = {}) {
  const {account,current} = owner(controller,isCurrent);
  const previous = writes.get(account) || Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    if (!current() || !await admission(account,current)) return null;
    const received = await account.api.preferences();
    if (!current()) return null;
    requireOwnPreferences(received,account.subject);
    const validatedAdmission=await admission(account,current);
    if (!validatedAdmission) return null;
    const fresh=resolveOwnPreferences(received,validatedAdmission);
    const {densityPersisted, ...next} = presentationPreferences(fresh);
    const densityChanged = patch.density === 'coached' || patch.density === 'interview';
    const densityReset = patch.density === 'default';
    if (patch.density === 'coached' || patch.density === 'interview') next.density = patch.density;
    if (typeof patch.overlaysVisible === 'boolean') next.overlaysVisible = patch.overlaysVisible;
    if (patch.overlayLayers && typeof patch.overlayLayers === 'object' && !Array.isArray(patch.overlayLayers))
      next.overlayLayers = overlayLayers({...next.overlayLayers,...Object.fromEntries(Object.entries(patch.overlayLayers).filter(([key,value])=>['face','bodyHands','position'].includes(key)&&typeof value==='boolean'))});
    if (Array.isArray(patch.favoriteQuestions)) next.favoriteQuestions = presentationPreferences({visibility:{ivocFable:{favoriteQuestions:patch.favoriteQuestions}}}).favoriteQuestions;
    const visibility = object(fresh?.visibility);
    const ownVisibility = {...object(visibility.ivocFable),...next};
    if (densityReset || !densityPersisted && !densityChanged) delete ownVisibility.density;
    assertEffectiveActor(account);
    const result = await account.api.savePreferences({ calibration:object(fresh?.calibration),
      visibility:{...visibility,ivocFable:ownVisibility,...(densityReset?{analyticsVisible:true}:densityChanged?{analyticsVisible:next.density==='coached'}:{})},
      coachingEnabled:fresh?.coachingEnabled !== false, recordingDefault:fresh?.recordingDefault !== false });
    if(!current())return null;
    requireOwnPreferences(result,account.subject);
    if(!await admission(account,current))return null;
    assertEffectiveActor(account);
    return presentationPreferences(result);
  });
  writes.set(account, operation);
  return operation;
}
