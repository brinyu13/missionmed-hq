// Presentation over existing versioned Admin contracts. No provider, entitlement,
// consumption, or database authority lives in these controls.
const integer = (value, max) => {
  const number = typeof value === 'string' && !value.trim() ? NaN : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) throw new Error('Enter a whole number within the displayed range.');
  return number;
};
const reason = (value) => {
  const text = String(value || '').trim();
  if (text.length < 3 || text.length > 400) throw new Error('Provide a reason between 3 and 400 characters.');
  return text;
};

export function buildAdminPolicyWrite(config, values) {
  if (!Number.isInteger(config?.version) || config.version < 1) throw new Error('Refresh the policy before saving.');
  return {
    expectedVersion: config.version,
    analyticsConfigVersion: config.analyticsConfigVersion,
    brainPackVersion: config.brainPackVersion,
    aisRulesVersion: config.aisRulesVersion,
    pressureDefaults: {
      ...config.pressureDefaults,
      defaultFollowUpIntensity: integer(values.intensity, 3),
      defaultPressureEnabled: values.pressure === true,
      maxFollowUpsPerAnswer: integer(values.followUps, 5),
    },
    proactiveBudgetOverrides: {
      ...config.proactiveBudgetOverrides,
      maxProactivePerSession: integer(values.proactive, 20),
      maxReactivePerAnswer: integer(values.reactive, 5),
      maxApplicationProbesPerAnswer: integer(values.application, 1),
    },
    credits: { ...config.credits },
    changeReason: reason(values.reason),
  };
}

export function buildAdminCreditWrite(account, values, idempotencyKey) {
  if (!/^wp:[1-9][0-9]{0,19}$/u.test(account?.subjectId || '') || !Number.isInteger(account?.version) || account.version < 0) {
    throw new Error('Refresh the selected account before saving.');
  }
  if (!['set_allowance', 'set_override', 'reset'].includes(values.action)) throw new Error('Select an available credit action.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(idempotencyKey || '')) throw new Error('A valid transaction identity is required.');
  return {
    subjectId: account.subjectId, expectedVersion: account.version,
    action: values.action, amountSeconds: values.action === 'reset' ? 0 : integer(values.seconds, 10_000_000),
    idempotencyKey, reason: reason(values.reason),
  };
}

export function createCreditAttemptKeys(uuid = () => crypto.randomUUID()) {
  let previous = null;
  return {
    forInput(input) {
      const signature = JSON.stringify(input);
      if (previous?.signature !== signature) previous = { signature, key: uuid() };
      return previous.key;
    },
    clear() { previous = null; },
  };
}

export function mountAdminControls({ configHost, creditHost, config, durable, initialSubject, isCurrent, onConfigSaved, onConfigConflict }) {
  let alive = true;
  let creditTicket = 0;
  const active = () => alive && isCurrent();
  const attempts = createCreditAttemptKeys();
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const actionButton = (text) => {
    const button = node('button', '', 'btn btn-quiet');
    button.type = 'submit'; button.append(node('span', text)); return button;
  };
  const inputField = (form, label, value, max, { checkbox = false } = {}) => {
    const wrapper = node('label', label, 'canon-field');
    const input = document.createElement('input');
    input.type = checkbox ? 'checkbox' : max ? 'number' : 'text';
    input.setAttribute('aria-label', label);
    if (checkbox) input.checked = value === true;
    else input.value = String(value ?? '');
    if (max) { input.min = '0'; input.max = String(max); input.step = '1'; }
    else if (!checkbox) { input.maxLength = 400; input.required = true; }
    wrapper.append(input); form.append(wrapper); return input;
  };
  const message = (form) => {
    const status = node('p', '', 'microcap'); status.setAttribute('role', 'status'); form.append(status); return status;
  };
  const editor = (host, label) => {
    const disclosure = node('details'); disclosure.append(node('summary', label));
    const form = node('form'); disclosure.append(form); host.append(disclosure); return form;
  };

  const policyForm = editor(configHost, 'Manage interview policy');
  policyForm.append(node('p', 'Changes apply to new sessions. Existing sessions retain their pinned policy. Provider and Analytics versions stay unchanged.'));
  const policyFields = {
    intensity: inputField(policyForm, 'Follow-up intensity (0–3)', config.pressureDefaults.defaultFollowUpIntensity, 3),
    pressure: inputField(policyForm, 'Pressure enabled by default', config.pressureDefaults.defaultPressureEnabled, null, { checkbox: true }),
    followUps: inputField(policyForm, 'Follow-ups per answer (0–5)', config.pressureDefaults.maxFollowUpsPerAnswer, 5),
    proactive: inputField(policyForm, 'Proactive probes per session (0–20)', config.proactiveBudgetOverrides.maxProactivePerSession, 20),
    reactive: inputField(policyForm, 'Reactive probes per answer (0–5)', config.proactiveBudgetOverrides.maxReactivePerAnswer, 5),
    application: inputField(policyForm, 'Application probes per answer (0–1)', config.proactiveBudgetOverrides.maxApplicationProbesPerAnswer, 1),
    reason: inputField(policyForm, 'Policy change reason', ''),
  };
  const policySave = actionButton('Save interview policy'); policyForm.append(policySave);
  const policyStatus = message(policyForm);
  let policyBusy = false;
  policyForm.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!active() || policyBusy) return;
    try {
      const values = Object.fromEntries(Object.entries(policyFields).map(([key, field]) => [key, key === 'pressure' ? field.checked : field.value]));
      const input = buildAdminPolicyWrite(config, values);
      policyBusy = true; policySave.disabled = true;
      const saved = await durable.saveAdminConfig(input);
      if (!active()) return;
      config = saved; onConfigSaved(saved);
      policyStatus.textContent = `Saved policy v${saved.version}. Applies to new sessions.`;
    } catch (error) {
      if (!active()) return;
      policyStatus.textContent = error.status === 409
        ? 'Policy changed elsewhere. Reopen Admin to load the latest version before retrying.'
        : `Not saved: ${error.message}`;
      if (error.status === 409) { policySave.disabled = true; onConfigConflict(); }
    } finally {
      policyBusy = false;
      if (active() && !policyStatus.textContent.startsWith('Policy changed elsewhere')) policySave.disabled = false;
    }
  });

  async function selectSubject(subjectId, displayName = subjectId) {
    if (!active()) return;
    const ticket = ++creditTicket;
    creditHost.replaceChildren(node('p', `Loading credits for ${displayName}…`));
    try {
      const snapshot = await durable.adminCredits(subjectId);
      if (!active() || ticket !== creditTicket) return;
      const account = snapshot.account;
      if (account?.subjectId !== subjectId) throw new Error('Credit subject does not match the selected student.');
      creditHost.replaceChildren(node('p', `${displayName} · ${subjectId} · v${account.version}`),
        node('p', `${account.balanceSeconds} seconds remaining · ${account.consumedSeconds} seconds used`));
      const form = editor(creditHost, 'Manage selected account credits');
      form.append(node('p', 'Allowance replaces the base allowance; override replaces the adjustment. Reset begins a new usage period. No entitlement is granted by this control.'));
      const label = node('label', 'Credit action', 'canon-field');
      const action = node('select'); action.setAttribute('aria-label', 'Credit action');
      for (const [value, text] of [['set_allowance', 'Set allowance'], ['set_override', 'Set override'], ['reset', 'Reset usage period']]) {
        const option = node('option', text); option.value = value; action.append(option);
      }
      label.append(action); form.append(label);
      const seconds = inputField(form, 'Credit amount in seconds', account.allowanceSeconds, 10_000_000);
      const why = inputField(form, 'Credit change reason', '');
      action.addEventListener('change', () => {
        seconds.disabled = action.value === 'reset';
        seconds.value = action.value === 'set_override' ? account.overrideSeconds : action.value === 'reset' ? 0 : account.allowanceSeconds;
      });
      const save = actionButton('Save selected account credits'); form.append(save);
      const status = message(form);
      let busy = false;
      form.addEventListener('submit', async (event) => {
        event.preventDefault(); if (!active() || ticket !== creditTicket || busy) return;
        try {
          const values = { action: action.value, seconds: seconds.value, reason: why.value };
          const key = attempts.forInput({ subjectId, version: account.version, ...values });
          const input = buildAdminCreditWrite(account, values, key);
          busy = true; save.disabled = true;
          await durable.saveAdminCredits(input);
          if (!active() || ticket !== creditTicket) return;
          attempts.clear();
          await selectSubject(subjectId, displayName);
          if (active() && ticket + 1 === creditTicket) creditHost.append(node('p', 'Credit change saved and current balance refreshed.', 'microcap'));
        } catch (error) {
          if (!active() || ticket !== creditTicket) return;
          status.textContent = error.status === 409
            ? 'Not saved: account version or credit limit conflict. Reselect the student to refresh before retrying.'
            : `Not saved: ${error.message}. An unchanged retry keeps the same transaction identity.`;
          if (error.status === 409) { attempts.clear(); save.disabled = true; }
        } finally {
          busy = false;
          if (active() && ticket === creditTicket && !status.textContent.includes('credit limit conflict')) save.disabled = false;
        }
      });
    } catch (error) {
      if (active() && ticket === creditTicket) creditHost.replaceChildren(node('p', `Credits unavailable: ${error.message}`));
    }
  }
  void selectSubject(initialSubject.subject, initialSubject.displayName);
  return { selectSubject, destroy() { alive = false; ++creditTicket; policyForm.remove(); creditHost.replaceChildren(); } };
}
