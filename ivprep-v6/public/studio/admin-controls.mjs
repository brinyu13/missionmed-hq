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

export function buildMentorPriorityWrite(snapshot, { priorities, mentorNotes }) {
  if (!/^wp:[1-9][0-9]{0,19}$/u.test(snapshot?.subjectId || '') || !Number.isSafeInteger(snapshot.version) || snapshot.version < 0) throw new Error('Refresh the selected student before saving.');
  if (!Array.isArray(priorities) || priorities.length > 3 || !Array.isArray(mentorNotes) || mentorNotes.length > 12) throw new Error('Use at most three priorities and twelve notes.');
  const normalize = (item) => {
    const text = String(item.text || '').trim();
    if (!text) return null;
    if (text.length < 3 || text.length > 500 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/u.test(item.id || '')) throw new Error('Each populated item needs 3–500 characters and a valid identity.');
    return { id: item.id, text };
  };
  return {
    subjectId: snapshot.subjectId, expectedVersion: snapshot.version,
    priorities: priorities.map(normalize).filter(Boolean),
    mentorNotes: mentorNotes.map((item) => {
      const normalized = normalize(item); if (!normalized) return null;
      if (!['shared', 'mentor_only'].includes(item.visibility)) throw new Error('Choose Shared or Admin/mentor-only note visibility.');
      return { ...normalized, visibility: item.visibility };
    }).filter(Boolean),
  };
}

export function mountAdminMentorControls({ host, durable, isCurrent, onOwnSaved, actorSubject }) {
  let alive = true; let generation = 0;
  const active = (ticket) => alive && ticket === generation && isCurrent();
  const node = (tag, text = '', className = '') => { const element = document.createElement(tag); element.textContent = text; element.className = className; return element; };
  async function selectSubject(subjectId, displayName = subjectId) {
    const ticket = ++generation;
    if (!active(ticket)) return;
    host.replaceChildren(node('p', `Loading mentor priorities for ${displayName}…`));
    try {
      const snapshot = await durable.adminMentorPriorities(subjectId);
      if (!active(ticket)) return;
      if (snapshot.subjectId !== subjectId) throw new Error('Mentor priority subject does not match the selected student.');
      host.replaceChildren(node('h3', `Mentor Top 3 · ${displayName}`), node('p', `${subjectId} · v${snapshot.version} · Set by ${snapshot.setBy || 'not set'}${snapshot.setAt ? ` · ${new Date(snapshot.setAt).toLocaleString()}` : ''}`, 'microcap'));
      const details = node('details'); details.append(node('summary', 'Manage selected student priorities'));
      const form = node('form'); details.append(form); host.append(details);
      form.append(node('p', 'Priorities are shared with this student and may guide future interviews. Admin/mentor-only notes are never given to the student or interviewer. Clearing an item removes it in the next version.'));
      const field = (label, text) => {
        const wrapper = node('label', label, 'canon-field'); const input = node('input');
        input.type = 'text'; input.value = text || ''; input.maxLength = 500; input.setAttribute('aria-label', label);
        wrapper.append(input); form.append(wrapper); return input;
      };
      const priorities = Array.from({ length: 3 }, (_, index) => ({ id: snapshot.priorities[index]?.id || crypto.randomUUID(), input: field(`Priority ${index + 1}`, snapshot.priorities[index]?.text) }));
      const notes = [];
      function addNote(note = {}) {
        const index = notes.length + 1;
        const input = field(`Mentor note ${index}`, note.text);
        const wrapper = node('label', `Note ${index} visibility`, 'canon-field'); const visibility = node('select'); visibility.setAttribute('aria-label', `Note ${index} visibility`);
        for (const [value, text] of [['mentor_only', 'Admin / mentor only'], ['shared', 'Shared with student and interviewer']]) { const option = node('option', text); option.value = value; visibility.append(option); }
        visibility.value = note.visibility || 'mentor_only'; wrapper.append(visibility); form.append(wrapper);
        notes.push({ id: note.id || crypto.randomUUID(), input, visibility });
      }
      for (const note of snapshot.mentorNotes) addNote(note);
      const add = node('button', '', 'btn btn-quiet'); add.type = 'button'; add.append(node('span', 'Add mentor note')); form.append(add);
      add.disabled = notes.length >= 12;
      add.addEventListener('click', () => { if (!active(ticket) || notes.length >= 12) return; addNote(); add.disabled = notes.length >= 12; });
      const save = node('button', '', 'btn btn-quiet'); save.type = 'submit'; save.append(node('span', 'Save selected student priorities')); form.append(save);
      const status = node('p', '', 'microcap'); status.setAttribute('role', 'status'); form.append(status);
      let busy = false;
      form.addEventListener('submit', async (event) => {
        event.preventDefault(); if (!active(ticket) || busy) return;
        try {
          const input = buildMentorPriorityWrite(snapshot, {
            priorities: priorities.map(({ id, input: control }) => ({ id, text: control.value })),
            mentorNotes: notes.map(({ id, input: control, visibility }) => ({ id, text: control.value, visibility: visibility.value })),
          });
          busy = true; save.disabled = true;
          await durable.saveAdminMentorPriorities(input);
          if (!active(ticket)) return;
          if (subjectId === actorSubject) void onOwnSaved(); // Re-read owner-filtered projection, never Admin private notes.
          const refreshed = await selectSubject(subjectId, displayName);
          if (active(ticket + 1)) host.append(node('p', refreshed ? 'Mentor priorities saved and refreshed.' : 'Mentor priorities saved; refresh unavailable. Reselect the student to retry the read.', 'microcap'));
        } catch (error) {
          if (!active(ticket)) return;
          status.textContent = error.status === 409
            ? 'Not saved: priorities changed elsewhere. Reselect the student to load the current version and reconcile your edits.'
            : `Not saved: ${error.message}`;
          if (error.status === 409) save.disabled = true;
        } finally {
          busy = false;
          if (active(ticket) && !status.textContent.startsWith('Not saved: priorities changed elsewhere')) save.disabled = false;
        }
      });
      return true;
    } catch (error) {
      if (active(ticket)) host.replaceChildren(node('p', `Mentor priorities unavailable: ${error.message}`));
      return false;
    }
  }
  return { selectSubject, destroy() { alive = false; ++generation; host.replaceChildren(); } };
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
          const refreshed = await selectSubject(subjectId, displayName);
          if (active() && ticket + 1 === creditTicket) creditHost.append(node('p', refreshed ? 'Credit change saved and current balance refreshed.' : 'Credit change saved; balance refresh unavailable. Reselect the student to retry the read.', 'microcap'));
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
      return true;
    } catch (error) {
      if (active() && ticket === creditTicket) creditHost.replaceChildren(node('p', `Credits unavailable: ${error.message}`));
      return false;
    }
  }
  void selectSubject(initialSubject.subject, initialSubject.displayName);
  return { selectSubject, destroy() { alive = false; ++creditTicket; policyForm.remove(); creditHost.replaceChildren(); } };
}
