import { createMissionAccountsAuthClient } from './missionaccounts-auth.js';
import { buildCanonicalModel } from './missionaccounts-canonical-adapter.js';

const state = {
  mode: 'initializing',
  authenticated: false,
  capabilities: {},
  user: null,
  bootstrap: null,
  error: null,
  mutating: false,
};

const auth = createMissionAccountsAuthClient({
  onLockout(lockoutState, message) {
    state.mode = lockoutState || 'unavailable';
    state.authenticated = false;
    state.user = null;
    state.error = message || 'MissionAccounts access is unavailable.';
    document.documentElement.dataset.missionaccountsRuntime = 'unavailable';
  },
});
let canonicalModel = null;

const databaseCycleKey = Object.freeze({ june: '2026-cycle-1', july: '2026-cycle-2', august: '2026-cycle-3' });

function notify(message) {
  if (typeof window.__XP?.toast === 'function') window.__XP.toast(message);
}

async function refreshCanonical() {
  state.bootstrap = await auth.request('/ui/bootstrap');
  canonicalModel = buildCanonicalModel(state.bootstrap);
  if (typeof window.__XP?.hydrateAuthoritative !== 'function') throw new Error('MissionAccounts canonical renderer is unavailable.');
  window.__XP.hydrateAuthoritative(canonicalModel.data, canonicalModel.working, canonicalModel.ids);
  return canonicalModel;
}

function studentUuid(si) {
  const id = canonicalModel?.ids?.students?.[si];
  if (!id) throw new Error('MissionAccounts student identity is unavailable.');
  return id;
}

function sessionUuid(ss) {
  const id = canonicalModel?.ids?.sessions?.[ss];
  if (!id) throw new Error('MissionAccounts class identity is unavailable.');
  return id;
}

async function dispatch(action, payload = {}) {
  if (!canonicalModel || state.mutating) return false;
  state.mutating = true;
  try {
    if (action === 'unsupported') throw new Error(payload.message || 'This control is not enabled in the production build yet.');
    if (action === 'cycle-policy') {
      const cycle = databaseCycleKey[payload.k];
      await window.MissionAccountsRuntime.mutation(`/admin/policy/${cycle}`, {
        body: { decision: payload.value, reason: 'Dr J selected the canonical 13–15-day cycle policy' },
      });
    } else if (action === 'billing-decision') {
      const body = { cycle_key: databaseCycleKey[payload.k], treatment: payload.t };
      if (['other', 'special'].includes(payload.t)) body.requested_amount_cents = Math.round(Number(payload.amt || 0) * 100);
      if (payload.note) body.note = payload.note;
      await window.MissionAccountsRuntime.mutation(`/admin/students/${studentUuid(payload.si)}/decisions`, { body });
    } else if (action === 'comp') {
      await window.MissionAccountsRuntime.mutation(`/admin/students/${studentUuid(payload.si)}/comp`, {
        body: {
          allowance: Number(payload.allowance),
          joined_on: payload.joined || null,
          reason: payload.reason,
          apply_retroactively: payload.retro === true,
        },
      });
    } else if (action === 'student-exam-submit') {
      await window.MissionAccountsRuntime.mutation('/me/exam-plan', { body: { step: payload.step, exam_on: payload.date } });
    } else if (action === 'student-passed') {
      await window.MissionAccountsRuntime.mutation('/me/exam-plan/passed', { body: {} });
    } else if (action === 'exam-transition') {
      const plan = state.bootstrap.canon.exam_plans.find(item => item.student_id === studentUuid(payload.si));
      if (!plan) throw new Error('The current exam plan is unavailable.');
      const resultAction = ['passed', 'not_passed', 'no_result'].includes(payload.action);
      const routeAction = resultAction ? 'result' : payload.action;
      await window.MissionAccountsRuntime.mutation(`/admin/exam-plans/${plan.id}/${routeAction}`, {
        body: { note: payload.note || '', result: resultAction ? payload.action : null, suggested_on: payload.newDate || null },
      });
    } else if (action === 'attendance-correction') {
      const ss = payload.fields?.sess;
      const sessionId = ss == null ? null : sessionUuid(ss);
      const attendanceEventId = ss == null ? null : canonicalModel.ids.attendanceEvents[`${payload.si}:${ss}`] || null;
      const type = { att_add: 'add', att_remove: 'remove', step: 'step_relabel', name: 'name', note: 'note' }[payload.type];
      await window.MissionAccountsRuntime.mutation(`/admin/students/${studentUuid(payload.si)}/corrections`, {
        body: {
          type,
          session_id: sessionId,
          attendance_event_id: attendanceEventId,
          from_val: payload.fields?.from == null ? null : (payload.type === 'step' ? { step: payload.fields.from } : payload.fields.from),
          to_val: payload.fields?.to == null ? null : (payload.type === 'step' ? { step: payload.fields.to } : payload.fields.to),
          reason: payload.fields?.reason || 'Dr J recorded a canonical attendance correction',
        },
      });
    } else if (action === 'attendance-correction-reversal') {
      const correction = state.bootstrap.canon.attendance_corrections.find(item => item.id === payload.id);
      if (!correction) throw new Error('The correction to reverse is unavailable.');
      const reverseType = { add: 'remove', remove: 'add', step_relabel: 'step_relabel', name: 'name', note: 'note' }[correction.type];
      await window.MissionAccountsRuntime.mutation(`/admin/students/${correction.student_id}/corrections`, {
        body: {
          type: reverseType,
          session_id: correction.session_id,
          attendance_event_id: correction.attendance_event_id,
          from_val: correction.to_val,
          to_val: correction.from_val,
          reason: 'Dr J reversed the prior correction',
          reverts_id: correction.id,
        },
      });
    } else {
      throw new Error('This MissionAccounts action is not connected.');
    }
    await refreshCanonical();
    notify('Saved to MissionAccounts.');
    return true;
  } catch (error) {
    notify(error instanceof Error ? error.message : 'MissionAccounts could not save that change.');
    return false;
  } finally {
    state.mutating = false;
  }
}

function requestId(prefix = 'missionaccounts') {
  return `${prefix}:${crypto.randomUUID()}`;
}

window.MissionAccountsRuntime = Object.freeze({
  get state() {
    return {
      ...state,
      capabilities: { ...state.capabilities },
      user: state.user ? { ...state.user } : null,
      bootstrap: state.bootstrap,
    };
  },
  request(path, options = {}) { return auth.request(path, options); },
  mutation(path, { method = 'POST', body, idempotencyKey = requestId('ui') } = {}) {
    return auth.request(path, {
      method,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: body == null ? undefined : JSON.stringify(body),
    });
  },
  dispatch,
  getCanonicalModel() { return canonicalModel; },
});

try {
  const configResponse = await fetch(new URL('./api/config', document.baseURI), {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const config = await configResponse.json();
  if (!configResponse.ok) throw new Error(config.message || 'MissionAccounts configuration is unavailable.');
  auth.configure(config);
  if (!config.localAuth) await auth.exchange();
  const session = await auth.request('/session');
  state.mode = session.mode;
  state.authenticated = session.authenticated === true;
  state.capabilities = session.capabilities || {};
  state.user = session.user || null;
  if (state.authenticated) await refreshCanonical();
  document.documentElement.dataset.missionaccountsRuntime = state.bootstrap ? 'authenticated-readonly' : 'preview';
} catch (error) {
  if (!error.redirecting) {
    state.mode = 'unavailable';
    state.error = error instanceof Error ? error.message : String(error);
    document.documentElement.dataset.missionaccountsRuntime = 'unavailable';
  }
}
