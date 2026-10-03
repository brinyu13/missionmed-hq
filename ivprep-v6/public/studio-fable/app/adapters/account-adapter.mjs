import { bindSubject } from '../state.mjs';
const ENGINE = '/iv-prep-on-call/assets';
let cached = null;
let inflight = null;
export function accountSnapshot() { return cached; }
export async function connectAccount({ force = false } = {}) {
  if (cached && !force) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const [{ IvocApi }, { DurableStudioSession }, apiClient] = await Promise.all([
      import(ENGINE + '/ivoc-standalone/app/api.mjs'),
      import(ENGINE + '/studio/durable-session.mjs'),
      import(ENGINE + '/aaa/api-client.mjs'),
    ]);
    const api = new IvocApi();
    const durable = new DurableStudioSession({ api });
    const [bootstrap, admission] = await Promise.all([durable.bootstrap(), apiClient.loadIvPrepSession()]);
    const subject = bootstrap.identity?.subject;
    if (!durable.ready || admission?.admitted !== true || !/^wp:[1-9][0-9]*$/.test(String(subject || ''))) throw new Error('Sign in through MissionMed Matrix to open IV Prep On-Call.');
    if (admission.identity?.subject !== subject) throw new Error('IVOC account identity changed. Return to Matrix and sign in again.');
    bindSubject(subject);
    cached = Object.freeze({ mode:'REAL', identity:bootstrap.identity, subject, role:bootstrap.identity.admin === true ? 'admin' : 'student',
      display:bootstrap.identity.displayName || admission.identity.displayName || 'Student', csrfToken:api.csrfToken || '',
      liveInterviewAvailable:admission.runtime?.liveInterviewAvailable === true,
      capabilities:bootstrap.capabilities || {}, entitlement:bootstrap.entitlement, admission, durable, api, apiClient, reasons:[] });
    return cached;
  })().finally(() => { inflight = null; });
  return inflight;
}
export function accountLabel(account) { return account ? account.display + ' · account' : 'Connecting to your account…'; }
