import { createMissionAccountsAuthClient } from './missionaccounts-auth.js';
import { buildCanonicalModel } from './missionaccounts-canonical-adapter.js';
import { openPaymentActionDialog, openSecureStripeSetup } from './missionaccounts-stripe.js';

const state = {
  mode: 'initializing',
  authenticated: false,
  capabilities: {},
  user: null,
  bootstrap: null,
  error: null,
  mutating: false,
  payments: { provider: 'stripe', setupEnabled: false, mode: 'disabled', publishableKey: null },
};

const auth = createMissionAccountsAuthClient({
  onLockout(lockoutState, message) {
    state.mode = lockoutState || 'unavailable';
    state.authenticated = false;
    state.user = null;
    state.error = message || 'MissionAccounts access is unavailable.';
    document.documentElement.dataset.missionaccountsRuntime = 'unavailable';
    updateRuntimeGate(state.error);
  },
});
let canonicalModel = null;

const databaseCycleKey = Object.freeze({ june: '2026-cycle-1', july: '2026-cycle-2', august: '2026-cycle-3' });
const actionCapabilities = Object.freeze({
  'payment-setup': 'auto_billing',
  'payment-remove': 'auto_billing',
  'billing-authorization': 'auto_billing',
  'billing-authorization-revoke': 'auto_billing',
  'attendance-issue-report': 'attendance_corrections',
  'attendance-issue-review': 'attendance_corrections',
  'attendance-correction': 'attendance_corrections',
  'attendance-correction-reversal': 'attendance_corrections',
  'identity-adjudication': 'identity_review',
  'device-identity-adjudication': 'identity_review',
  'student-contact': 'student_contacts',
  'cycle-policy': 'billing_decisions',
  'billing-decision': 'billing_decisions',
  'invoice-readiness': 'billing_decisions',
  comp: 'comp_days',
  'student-exam-submit': 'exam_plans',
  'admin-exam-submit': 'exam_plans',
  'student-passed': 'exam_plans',
  'student-exam-withdraw': 'exam_plans',
  'exam-transition': 'exam_plans',
});

function notify(message) {
  if (typeof window.__XP?.toast === 'function') window.__XP.toast(message);
}

function updateRuntimeGate(message) {
  const gate = document.getElementById('missionaccountsRuntimeGate');
  if (gate) gate.textContent = message || 'MissionAccounts access is unavailable.';
}

async function refreshCanonical() {
  const initialHydration = state.bootstrap === null;
  state.bootstrap = await auth.request('/ui/bootstrap');
  canonicalModel = buildCanonicalModel(state.bootstrap);
  if (typeof window.__XP?.hydrateAuthoritative !== 'function') throw new Error('MissionAccounts canonical renderer is unavailable.');
  if (initialHydration) {
    const requestedHash = window.__MISSIONACCOUNTS_REQUESTED_HASH;
    if (requestedHash) delete window.__MISSIONACCOUNTS_REQUESTED_HASH;
    let hydrationHash = requestedHash || location.hash || '#/';
    if (state.bootstrap.scope === 'student') {
      const studentHash = String(hydrationHash).startsWith('#/me') ? hydrationHash : '#/me';
      const hasAttendance = Object.keys(canonicalModel.data.students[0]?.c || {}).length > 0;
      const routeWithoutQuery = String(studentHash).split('?')[0];
      const isReportRoute = String(studentHash).includes('report=1');
      hydrationHash = !hasAttendance && !isReportRoute && !['#/me/billing', '#/me/exam'].includes(routeWithoutQuery) ? '#/me/billing' : studentHash;
    }
    if (location.hash !== hydrationHash) history.replaceState(null, '', `${location.pathname}${location.search}${hydrationHash}`);
  }
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
    const requiredCapability = actionCapabilities[action];
    if (requiredCapability && state.capabilities[requiredCapability] !== true) {
      throw new Error('This MissionAccounts action is not enabled for this environment.');
    }
    if (action === 'payment-setup') {
      if (state.user?.role !== 'student') throw new Error('Only the signed-in student can enter or update a payment method.');
      if (!state.payments.setupEnabled || !state.payments.publishableKey) throw new Error('Secure Stripe payment setup is not enabled.');
      openSecureStripeSetup({
        publishableKey: state.payments.publishableKey,
        createSession: () => window.MissionAccountsRuntime.mutation('/me/payment-setup/session'),
        refresh: refreshCanonical,
        notify,
        returnUrl: new URL('./#/me/billing?stripe_setup=return', document.baseURI).href,
      });
      return true;
    }
    if (action === 'payment-remove') {
      if (state.user?.role !== 'student') throw new Error('Only the signed-in student can remove a payment method.');
      const decision = openPaymentActionDialog({
        title: 'Remove payment method?',
        intro: 'This removes the saved payment method from MissionAccounts and securely detaches it from your Stripe customer.',
        facts: [
          'Automatic Drills billing authorization is revoked before the payment method is detached.',
          'No attendance, invoice, or payment history is deleted.',
          'You can add another payment method later.',
        ],
        confirmLabel: 'Remove payment method',
        danger: true,
        onConfirm: () => window.MissionAccountsRuntime.mutation('/me/payment-method', { method: 'DELETE' }),
      });
      if (!await decision.result) return true;
    } else if (action === 'billing-authorization' || action === 'billing-authorization-revoke') {
      if (state.user?.role !== 'student') throw new Error('Only the signed-in student can change automatic billing authorization.');
      const current = state.bootstrap?.account?.billing_consent;
      const revoke = action === 'billing-authorization-revoke' || current?.state === 'authorized';
      if (revoke) {
        const decision = openPaymentActionDialog({
          title: 'Turn off automatic billing?',
          intro: 'Future Drills attendance will not be charged automatically after this authorization is revoked.',
          facts: [
            'Past attendance, invoices, payments, and authorization history stay intact.',
            'Your saved payment method remains on file unless you remove it separately.',
          ],
          confirmLabel: 'Turn off automatic billing',
          danger: true,
          onConfirm: () => window.MissionAccountsRuntime.mutation('/me/consent', { method: 'DELETE', body: {} }),
        });
        if (!await decision.result) return true;
      } else {
        const terms = state.bootstrap?.account?.billing_terms;
        if (!terms?.version || terms.status !== 'approved') throw new Error('The automatic-billing terms are not approved yet.');
        const decision = openPaymentActionDialog({
          title: 'Automatic Drills billing',
          intro: terms.summary || 'Review and accept the approved terms for automatic Drills billing.',
          facts: [
            '$25 maximum per student per calendar day of billable Live Drills attendance.',
            'Step 1 and Step 2/3 on the same calendar day still produce at most one $25 charge.',
            'An eligible day is charged 24–48 hours after Dr J confirms attendance.',
            'You can turn off automatic billing and remove the saved payment method from MissionAccounts.',
          ],
          consentLabel: 'I authorize MissionMed Institute to charge my saved Stripe payment method under these approved Drills terms.',
          confirmLabel: 'Enable automatic billing',
          onConfirm: () => window.MissionAccountsRuntime.mutation('/me/consent', {
            body: { terms_version: terms.version, reason: 'Student accepted approved Drills automatic-billing terms' },
          }),
        });
        if (!await decision.result) return true;
      }
    } else if (action === 'attendance-issue-report') {
      if (state.user?.role !== 'student') throw new Error('Only the signed-in student can report an attendance issue.');
      const issueText = String(payload.issueText || '').trim();
      if (issueText.length < 3 || issueText.length > 2_000) throw new Error('Tell Dr J what looks wrong in 3 to 2000 characters.');
      await window.MissionAccountsRuntime.mutation('/me/attendance-issues', {
        body: { issue_text: issueText, route: location.hash || '#/me/attendance' },
      });
    } else if (action === 'attendance-issue-review') {
      if (!['missionaccounts_admin', 'founder'].includes(state.user?.role)) throw new Error('Only Dr J can review attendance issues.');
      const issueId = String(payload.issueId || '');
      const resolutionState = String(payload.state || '');
      const resolutionNote = String(payload.resolutionNote || '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueId)) throw new Error('The attendance report identity is invalid.');
      if (!['resolved', 'dismissed'].includes(resolutionState) || resolutionNote.length < 3 || resolutionNote.length > 2_000) throw new Error('Add a 3 to 2000 character response for the student.');
      await window.MissionAccountsRuntime.mutation(`/admin/attendance-issues/${issueId}/review`, {
        body: { state: resolutionState, resolution_note: resolutionNote },
      });
    } else if (action === 'identity-adjudication') {
      if (!['missionaccounts_admin', 'founder'].includes(state.user?.role)) throw new Error('Only Dr J can adjudicate identity questions.');
      if (state.capabilities.identity_review !== true) throw new Error('Identity review is not enabled for this environment.');
      const clusterRef = String(payload.clusterRef || '');
      const decision = String(payload.decision || '');
      const note = String(payload.note || '').trim();
      if (!/^[A-Za-z0-9._:-]{1,200}$/.test(clusterRef)) throw new Error('The identity cluster reference is invalid.');
      if (!['same', 'different', 'unsure'].includes(decision)) throw new Error('Choose same student, different people, or not sure.');
      if (note.length < 3 || note.length > 2_000) throw new Error('Identity decisions require a short audit reason.');
      await window.MissionAccountsRuntime.mutation(`/admin/identity/${encodeURIComponent(clusterRef)}`, {
        body: {
          decision,
          canonical_student_id: decision === 'same' ? studentUuid(payload.canonicalSi) : null,
          note,
        },
      });
    } else if (action === 'device-identity-adjudication') {
      if (!['missionaccounts_admin', 'founder'].includes(state.user?.role)) throw new Error('Only Dr J can adjudicate unidentified attendees.');
      if (state.capabilities.identity_review !== true) throw new Error('Identity review is not enabled for this environment.');
      const aliasId = String(payload.aliasId || '');
      const decision = String(payload.decision || '');
      const note = String(payload.note || '').trim();
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuid.test(aliasId)) throw new Error('The unidentified-attendee alias is invalid.');
      if (!['match', 'not_student', 'unsure'].includes(decision)) throw new Error('Choose a student match, not a student, or decide later.');
      if (note.length < 3 || note.length > 2_000) throw new Error('Identity decisions require a short audit reason.');
      const targetStudentId = decision === 'match' ? studentUuid(payload.targetSi) : null;
      await window.MissionAccountsRuntime.mutation(`/admin/device-identity/${aliasId}`, {
        body: { decision, target_student_id: targetStudentId, note },
      });
    } else if (action === 'student-contact') {
      await window.MissionAccountsRuntime.mutation(`/admin/students/${studentUuid(payload.si)}/contact`, {
        body: {
          email: payload.email || '',
          phone: payload.phone || '',
          reason: 'Dr J updated student contact information',
        },
      });
    } else if (action === 'cycle-policy') {
      const cycle = databaseCycleKey[payload.k];
      await window.MissionAccountsRuntime.mutation(`/admin/policy/${cycle}`, {
        body: { decision: payload.value, reason: 'Dr J selected the canonical 13–15-day cycle policy' },
      });
    } else if (action === 'billing-decision') {
      const body = { cycle_key: databaseCycleKey[payload.k], treatment: payload.t };
      if (['other', 'special'].includes(payload.t)) body.requested_amount_cents = Math.round(Number(payload.amt || 0) * 100);
      if (payload.note) body.note = payload.note;
      await window.MissionAccountsRuntime.mutation(`/admin/students/${studentUuid(payload.si)}/decisions`, { body });
    } else if (action === 'invoice-readiness') {
      const studentId = studentUuid(payload.si);
      const cycleKey = databaseCycleKey[payload.k];
      if (!cycleKey) throw new Error('The MissionAccounts billing cycle is unavailable.');
      const invoices = state.bootstrap.canon.invoices.filter(item => (
        item.student_id === studentId && item.cycle_key === cycleKey && ['draft', 'ready'].includes(item.state)
      ));
      const invoice = invoices.at(-1);
      if (!invoice) throw new Error('A current draft invoice is required.');
      await window.MissionAccountsRuntime.mutation(`/admin/invoices/${invoice.id}/readiness`, {
        body: {
          ready: payload.v === true,
          reason: payload.v === true ? 'Dr J marked invoice ready to send' : 'Dr J removed invoice from ready',
        },
      });
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
    } else if (action === 'admin-exam-submit') {
      await window.MissionAccountsRuntime.mutation(`/admin/students/${studentUuid(payload.si)}/exam-plan`, {
        body: { step: payload.step, exam_on: payload.date },
      });
    } else if (action === 'student-passed') {
      await window.MissionAccountsRuntime.mutation('/me/exam-plan/passed', { body: {} });
    } else if (action === 'student-exam-withdraw') {
      const plan = state.bootstrap.canon.exam_plans.find(item => item.student_id === studentUuid(payload.si));
      if (!plan) throw new Error('The current exam plan is unavailable.');
      await window.MissionAccountsRuntime.mutation('/me/exam-plan/withdraw', { body: { plan_id: plan.id } });
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
      const eventKey = `${payload.si}:${ss}`;
      const attendanceEventGroup = ss == null
        ? []
        : (canonicalModel.ids.attendanceEventGroups?.[eventKey]
          || [canonicalModel.ids.attendanceEvents[eventKey]].filter(Boolean));
      if (['att_remove', 'step'].includes(payload.type) && attendanceEventGroup.length > 1) {
        throw new Error('Multiple preserved source attendances contribute to this logical attendance. Resolve the identity/source evidence before correcting it.');
      }
      const attendanceEventId = attendanceEventGroup[0] || null;
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
      payments: { ...state.payments, publishableKey: state.payments.publishableKey ? '[configured]' : null },
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
  state.payments = config.payments || state.payments;
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
    updateRuntimeGate(state.error);
  }
}
