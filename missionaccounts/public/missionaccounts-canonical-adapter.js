const cycleKeyMap = Object.freeze({
  '2026-cycle-1': 'june',
  '2026-cycle-2': 'july',
  '2026-cycle-3': 'august',
});

function mappedCycleKey(key) {
  const mapped = cycleKeyMap[key];
  if (!mapped) throw new Error(`Unsupported MissionAccounts cycle: ${key}`);
  return mapped;
}

function localTimestamp(iso, timeZone = 'America/New_York') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function safeDateMs(value) {
  const milliseconds = Date.parse(value || '');
  return Number.isFinite(milliseconds) ? milliseconds : Date.now();
}

function safeCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

function integrationHealth(bootstrap) {
  if (bootstrap?.scope !== 'admin') return null;
  const health = bootstrap.health || {};
  const stripe = health.stripe && typeof health.stripe === 'object' ? health.stripe : {};
  const sourceSync = health.latest_zoom_sync;
  const latestZoomSync = sourceSync && typeof sourceSync === 'object' ? {
    state: ['ok', 'failed', 'running'].includes(sourceSync.state) ? sourceSync.state : 'unknown',
    started_at: sourceSync.started_at || null,
    finished_at: sourceSync.finished_at || null,
    error: String(sourceSync.error || '').slice(0, 300),
    stats: {
      sessions: safeCount(sourceSync.stats?.sessions),
      source_rows: safeCount(sourceSync.stats?.source_rows),
    },
  } : null;
  return {
    zoom_sync_enabled: health.zoom_sync_enabled === true,
    zoom_provider_configured: health.zoom_provider_configured === true,
    hosted_invoices_enabled: health.hosted_invoices_enabled === true,
    auto_billing_enabled: health.auto_billing_enabled === true,
    stripe: {
      mode: ['disabled', 'test', 'live'].includes(stripe.mode) ? stripe.mode : 'disabled',
      credentials_configured: stripe.credentials_configured === true,
      webhook_configured: stripe.webhook_configured === true,
      mutations_enabled: stripe.mutations_enabled === true,
      live_mutations_enabled: stripe.live_mutations_enabled === true,
    },
    latest_zoom_sync: latestZoomSync,
    open_integration_exceptions: safeCount(health.open_integration_exceptions),
    failed_provider_events: safeCount(health.failed_provider_events),
    failed_notifications: safeCount(health.failed_notifications),
  };
}

function attendanceIssueQueue(bootstrap) {
  if (bootstrap?.scope !== 'admin') return [];
  const students = new Map((bootstrap.students || []).map(student => [student.id, student]));
  return (bootstrap.attendance_issues || []).map(issue => ({
    id: String(issue.id || ''),
    student_id: String(issue.student_id || ''),
    student_name: String(students.get(issue.student_id)?.display_name || 'Student'),
    issue_text: String(issue.issue_text || '').slice(0, 2_000),
    route: String(issue.context?.route || '').startsWith('#/') ? String(issue.context.route).slice(0, 240) : '',
    state: ['open', 'resolved', 'dismissed'].includes(issue.state) ? issue.state : 'open',
    submitted_at: issue.submitted_at || null,
    resolved_at: issue.resolved_at || null,
    resolution_note: String(issue.resolution_note || '').slice(0, 2_000),
  })).filter(issue => issue.id && issue.student_id);
}

function emptyWorking(scope) {
  return {
    v: 3,
    dec: {}, ident: {}, dev: {}, contact: {}, policy: {}, ready: {}, providerInvoices: {}, corrs: [],
    pm: {}, auth: {}, exam: {}, examHistory: {}, grace: {}, comp: {},
    rule: 'day', ruleDecision: null, log: [],
    lens: scope === 'student' ? 'student' : 'admin', ctx: 'xp', meStudent: scope === 'student' ? 0 : null,
    showMissed: false,
  };
}

export function buildCanonicalModel(bootstrap) {
  const source = bootstrap?.canon;
  if (!source || source.schema_version !== 'missionaccounts-canonical-data-v1') throw new Error('MissionAccounts canonical data is unavailable');
  if (!['student', 'admin'].includes(source.scope) || bootstrap.scope !== source.scope) throw new Error('MissionAccounts canonical data scope mismatch');

  const cycleRows = [...source.cycles].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const sessions = [...source.sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const students = [...source.students].sort((a, b) => a.display_name.localeCompare(b.display_name));
  const sessionIndex = new Map(sessions.map((session, index) => [session.id, index]));
  const studentIndex = new Map(students.map((student, index) => [student.id, index]));
  const aliasesByStudent = new Map();
  const deviceAliasesBySourceStudent = new Map();
  for (const alias of source.aliases || []) {
    if (alias.relationship_state === 'device' && alias.source_student_id && studentIndex.has(alias.source_student_id)) {
      const sourceAliases = deviceAliasesBySourceStudent.get(alias.source_student_id) || [];
      sourceAliases.push(alias);
      deviceAliasesBySourceStudent.set(alias.source_student_id, sourceAliases);
      continue;
    }
    if (alias.student_id && studentIndex.has(alias.student_id)) {
      const list = aliasesByStudent.get(alias.student_id) || [];
      list.push(alias);
      aliasesByStudent.set(alias.student_id, list);
    }
  }

  const events = (source.attendance_events || []).filter(event => (
    sessionIndex.has(event.session_id)
      && (studentIndex.has(event.student_id) || studentIndex.has(event.source_student_id))
  ));
  const eventsByStudent = new Map();
  const eventRows = [];
  const attendanceEventIds = {};
  const attendanceEventGroups = {};
  const addEventRow = (event, studentId, aliases) => {
    const si = studentIndex.get(studentId);
    const ss = sessionIndex.get(event.session_id);
    const aliasValue = event.source_display_name || students[si].display_name;
    let aliasIndex = aliases.findIndex(alias => alias.display_value === aliasValue);
    if (aliasIndex < 0) aliasIndex = 0;
    eventRows.push([si, ss, event.duration_minutes ?? null, aliasIndex, event.source_row_count || 0]);
    const eventKey = `${si}:${ss}`;
    if (!attendanceEventIds[eventKey]) attendanceEventIds[eventKey] = event.id;
    const eventGroup = attendanceEventGroups[eventKey] || [];
    eventGroup.push(event.id);
    attendanceEventGroups[eventKey] = eventGroup;
    const list = eventsByStudent.get(studentId) || [];
    list.push(event);
    eventsByStudent.set(studentId, list);
  };
  for (const event of events) {
    if (studentIndex.has(event.student_id)) addEventRow(event, event.student_id, aliasesByStudent.get(event.student_id) || []);
    if (studentIndex.has(event.source_student_id)
        && deviceAliasesBySourceStudent.has(event.source_student_id)
        && event.source_student_id !== event.student_id) {
      addEventRow(event, event.source_student_id, deviceAliasesBySourceStudent.get(event.source_student_id));
    }
  }

  const studentRows = students.map((student, index) => {
    const aliases = student.device_source === true
      ? [...(aliasesByStudent.get(student.id) || []), ...(deviceAliasesBySourceStudent.get(student.id) || [])]
      : (aliasesByStudent.get(student.id) || []);
    const aliasValues = [...new Set([student.display_name, ...aliases.map(alias => alias.display_value)].filter(Boolean))];
    const cycles = {};
    const studentEvents = eventsByStudent.get(student.id) || [];
    for (const cycle of cycleRows) {
      const key = mappedCycleKey(cycle.key);
      const indices = [...new Set(studentEvents.filter(event => event.cycle_key === cycle.key).map(event => sessionIndex.get(event.session_id)))].sort((a, b) => a - b);
      if (!indices.length) continue;
      cycles[key] = {
        att: indices.length,
        s1: indices.filter(session => sessions[session].step === 's1').length,
        s23: indices.filter(session => sessions[session].step === 's23').length,
        sess: indices,
      };
    }
    return {
      i: index,
      id: student.id,
      hk: student.id,
      n: student.display_name,
      a: aliasValues,
      ids: aliases.map(alias => alias.id),
      m: aliasValues.length > 1,
      k: student.device_source === true ? 'device' : 'person',
      c: cycles,
    };
  });

  const devices = source.scope === 'admin' ? (source.aliases || [])
    .filter(alias => alias.relationship_state === 'device' && studentIndex.has(alias.source_student_id))
    .map(alias => {
      const si = studentIndex.get(alias.source_student_id);
      const cycles = Object.keys(studentRows[si].c);
      return {
        id: alias.id,
        key: alias.source_key,
        name: alias.display_value,
        si,
        att: cycles.reduce((total, key) => total + studentRows[si].c[key].att, 0),
        cycles,
      };
    }) : [];

  const attendanceCountBySession = new Map();
  for (const event of events) attendanceCountBySession.set(event.session_id, (attendanceCountBySession.get(event.session_id) || 0) + 1);
  const sessionRows = sessions.map((session, index) => ({
    i: index,
    id: session.id,
    c: mappedCycleKey(session.cycle_key),
    d: session.held_on,
    t: localTimestamp(session.starts_at, session.time_zone),
    m: source.scope === 'admin' ? (session.provider_meeting_id || '') : '',
    st: session.step,
    n: attendanceCountBySession.get(session.id) || 0,
  }));

  const daysByStudentCycle = new Map();
  for (const day of source.attendance_days || []) {
    const key = `${day.student_id}:${day.cycle_key}`;
    const list = daysByStudentCycle.get(key) || [];
    list.push(day);
    daysByStudentCycle.set(key, list);
  }
  const ceilings = new Map((source.full_cycle_ceilings || []).map(row => [`${row.student_id}:${row.cycle_key}`, row]));
  const cycleRowsForCanon = cycleRows.map(cycle => {
    const key = mappedCycleKey(cycle.key);
    const cycleSessions = sessions.filter(session => session.cycle_key === cycle.key);
    const cycleEvents = events.filter(event => event.cycle_key === cycle.key);
    const participants = students.filter(student => (eventsByStudent.get(student.id) || []).some(event => event.cycle_key === cycle.key));
    let amount = 0;
    let full = 0;
    let per = 0;
    for (const student of participants) {
      const billable = (daysByStudentCycle.get(`${student.id}:${cycle.key}`) || []).filter(day => day.kind === 'billable').length;
      const cap = ceilings.get(`${student.id}:${cycle.key}`);
      const computed = billable >= 16 ? 300 : billable * 25;
      amount += cap?.status === 'verified' ? Math.min(computed, cap.ceiling_cents / 100) : computed;
      if (billable >= 16 || cap?.status === 'verified') full += 1;
      else per += 1;
    }
    return {
      key,
      src: cycle.label,
      label: key === 'june' ? 'June Cycle' : key === 'july' ? 'July Cycle' : 'August Cycle',
      start: cycle.starts_on,
      end: cycle.ends_on,
      sessions: cycleSessions.length,
      humans: participants.length,
      events: cycleEvents.length,
      full,
      per,
      amount,
      s1: cycleEvents.filter(event => event.step === 's1').length,
      s23: cycleEvents.filter(event => event.step === 's23').length,
      s1_sessions: cycleSessions.filter(session => session.step === 's1').length,
      s23_sessions: cycleSessions.filter(session => session.step === 's23').length,
      days: new Set(cycleSessions.map(session => session.held_on)).size,
    };
  });

  const working = emptyWorking(source.scope);
  for (const student of students) {
    const si = studentIndex.get(student.id);
    working.contact[si] = { email: student.email || '', phone: student.phone || '' };
    working.comp[si] = {
      allowance: student.comp_days_allowance || 0,
      joined: student.joined_at || null,
      locked: (source.attendance_days || []).filter(day => day.student_id === student.id && day.kind === 'comped').map(day => day.day),
    };
  }
  for (const decision of source.billing_decisions || []) {
    const si = studentIndex.get(decision.student_id);
    if (si == null) continue;
    const key = mappedCycleKey(decision.cycle_key);
    const sourceBasis = decision.basis || {};
    const cycleState = studentRows[si].c[key] || {};
    const units = Number(sourceBasis.billable ?? cycleState.billable ?? 0);
    const capPolicy = (source.cycle_policies || []).find(policy => policy.cycle_key === decision.cycle_key)?.value?.decision;
    const kind = decision.treatment === 'fullcycle' || units >= 16 || (units >= 13 && units <= 15 && capPolicy === 'cap') ? 'full' : 'per';
    working.dec[si] ||= {};
    working.dec[si][key] = {
      id: decision.id,
      t: decision.treatment,
      amt: decision.amount_cents / 100,
      note: decision.note || '',
      at: safeDateMs(decision.decided_at),
      basis: {
        rule: 'day',
        u: units,
        att: Number(sourceBasis.att ?? cycleState.att ?? 0),
        billable: units,
        comped: Number(sourceBasis.comped ?? cycleState.comped ?? 0),
        grace: Number(sourceBasis.grace ?? cycleState.grace ?? 0),
        dayCount: Number(sourceBasis.dayCount ?? cycleState.dayCount ?? units),
        kind,
      },
      state: decision.state,
    };
  }
  for (const policy of source.cycle_policies || []) working.policy[mappedCycleKey(policy.cycle_key)] = policy.value?.decision || null;
  const ruleDecision = (source.rule_decisions || []).find(row => row.rule === 'one_charge_per_calendar_day');
  if (ruleDecision) working.ruleDecision = { mode: ruleDecision.mode, at: safeDateMs(ruleDecision.decided_at), by: 'Founder', note: '' };
  const planById = new Map((source.exam_plans || []).map(plan => [plan.id, plan]));
  const examHistoryByStudent = new Map();
  for (const transition of source.exam_transitions || []) {
    const si = studentIndex.get(transition.student_id);
    if (si == null || transition.accepted === false) continue;
    const plan = planById.get(transition.exam_plan_id);
    const action = transition.to_state === 'followup' && transition.result
      ? transition.result
      : transition.from_state == null && transition.to_state === 'pending'
        ? 'submitted'
        : transition.to_state === 'approved'
          ? 'approve'
          : transition.to_state === 'denied'
            ? 'deny'
            : transition.to_state === 'pending'
              ? 'reopen'
              : transition.to_state;
    const history = examHistoryByStudent.get(transition.student_id) || [];
    history.push({
      t: safeDateMs(transition.created_at),
      by: transition.actor_role === 'student' ? 'student' : 'admin',
      action,
      from: transition.from_state,
      to: action === 'submitted' && plan ? `${String(plan.step).toUpperCase()} · ${plan.exam_on}` : transition.to_state,
      note: transition.reason === 'submitted' ? '' : (transition.reason || ''),
    });
    examHistoryByStudent.set(transition.student_id, history);
  }
  for (const [studentId, history] of examHistoryByStudent) {
    const si = studentIndex.get(studentId);
    if (si != null) working.examHistory[si] = history;
  }
  for (const plan of source.exam_plans || []) {
    if (plan.superseded_by_id || plan.withdrawn_at) continue;
    const si = studentIndex.get(plan.student_id);
    if (si == null) continue;
    working.exam[si] = {
      id: plan.id,
      step: plan.step,
      date: plan.exam_on,
      state: plan.state,
      result: plan.result,
      note: plan.note || '',
      suggested: plan.suggested_on,
      passedDate: plan.passed_on,
      submittedAt: safeDateMs(plan.submitted_at),
      decidedAt: safeDateMs(plan.decided_at),
      history: examHistoryByStudent.get(plan.student_id) || [],
    };
  }
  for (const window of source.grace_windows || []) {
    const si = studentIndex.get(window.student_id);
    if (si == null) continue;
    working.grace[si] ||= [];
    working.grace[si].push({ id: window.id, from: window.from_on, to: window.to_on, why: window.closed_reason || '', at: safeDateMs(window.created_at) });
  }
  for (const invoice of source.invoices || []) {
    const si = studentIndex.get(invoice.student_id);
    if (si == null) continue;
    const cycleKey = mappedCycleKey(invoice.cycle_key);
    working.providerInvoices[si] ||= {};
    working.providerInvoices[si][cycleKey] = {
      id: String(invoice.id || ''),
      state: String(invoice.state || 'draft'),
      providerStatus: String(invoice.provider_status || ''),
      hostedUrl: /^https:\/\/invoice[.]stripe[.]com\//.test(String(invoice.hosted_invoice_url || '')) ? invoice.hosted_invoice_url : null,
      pdfUrl: /^https:\/\/(?:invoice|pay)[.]stripe[.]com\//.test(String(invoice.invoice_pdf || '')) ? invoice.invoice_pdf : null,
      dueAt: invoice.due_at || null,
      sentAt: invoice.sent_at || null,
      paidAt: invoice.paid_at || null,
    };
    if (invoice.state === 'ready') {
      working.ready[si] ||= {};
      working.ready[si][cycleKey] = true;
    }
  }
  const correctionType = { add: 'att_add', remove: 'att_remove', step_relabel: 'step', name: 'name', note: 'note' };
  const revertedCorrectionIds = new Set((source.attendance_corrections || [])
    .map(correction => correction.reverts_id)
    .filter(Boolean));
  for (const correction of source.attendance_corrections || []) {
    if (correction.reverted_by_id || revertedCorrectionIds.has(correction.id)) continue;
    const si = studentIndex.get(correction.student_id);
    const ss = correction.session_id ? sessionIndex.get(correction.session_id) : null;
    if (si == null || (correction.session_id && ss == null)) continue;
    working.corrs.push({
      id: correction.id,
      si,
      type: correctionType[correction.type] || correction.type,
      sess: ss,
      t: safeDateMs(correction.created_at),
      from: correction.from_val?.step ?? correction.from_val,
      to: correction.to_val?.step ?? correction.to_val,
      reason: correction.reason || '',
      revertsId: correction.reverts_id || null,
    });
  }
  if (bootstrap.scope === 'student') {
    const method = bootstrap.account?.payment_method;
    const consent = bootstrap.account?.billing_consent;
    working.pm[0] = method ? {
      state: method.status,
      brand: method.brand,
      last4: method.last4,
      exp: method.exp_month && method.exp_year ? `${String(method.exp_month).padStart(2, '0')}/${String(method.exp_year).slice(-2)}` : '',
    } : { state: 'none' };
    working.auth[0] = consent || { state: 'none' };
  } else {
    for (const student of bootstrap.students || []) {
      const si = studentIndex.get(student.id);
      if (si == null) continue;
      const method = student.payment_method;
      working.pm[si] = method ? {
        state: method.status,
        brand: method.brand,
        last4: method.last4,
        exp: method.exp_month && method.exp_year ? `${String(method.exp_month).padStart(2, '0')}/${String(method.exp_year).slice(-2)}` : '',
      } : { state: 'none' };
      working.auth[si] = student.billing_consent || { state: 'none' };
    }
  }

  const clusters = source.scope === 'admin' ? (source.identity_clusters || []).map((cluster, index) => ({
    id: cluster.ref,
    tier: 'review',
    members: (cluster.members || []).filter(member => studentIndex.has(member.student_id)).map(member => {
      const si = studentIndex.get(member.student_id);
      const cycleKeys = Object.keys(studentRows[si].c);
      return {
        key: member.source_key,
        alias: member.display_value,
        raw: [member.display_value],
        si,
        att: cycleKeys.reduce((total, key) => total + studentRows[si].c[key].att, 0),
        cycles: cycleKeys,
        device: member.relationship_state === 'device',
      };
    }),
    canonical: '',
    supporting: cluster.evidence?.supporting || 'Preserved identity evidence requires Dr J review',
    temporal: cluster.evidence?.temporal || '',
    against: cluster.evidence?.against || '',
    cooccur: cluster.evidence?.cooccur || 0,
    pairs: [],
    i: index,
  })).filter(cluster => cluster.members.length > 1) : [];

  if (source.scope === 'admin') {
    for (const cluster of source.identity_clusters || []) {
      const decision = cluster.decision;
      if (!decision || !['same', 'different', 'unsure'].includes(decision.decision)) continue;
      if (decision.decision === 'unsure') continue;
      const canonicalIndex = decision.canonical_student_id == null
        ? clusters.find(item => item.id === cluster.ref)?.members?.[0]?.si
        : studentIndex.get(decision.canonical_student_id);
      if (canonicalIndex == null) continue;
      working.ident[cluster.ref] = {
        d: decision.decision,
        canon: canonicalIndex,
        at: safeDateMs(decision.decided_at),
      };
    }
    const deviceByAliasId = new Map(devices.map(device => [device.id, device]));
    for (const decision of source.device_identity_decisions || []) {
      if (decision.decision === 'unsure') continue;
      const device = deviceByAliasId.get(decision.identity_alias_id);
      if (!device) continue;
      const targetIndex = decision.decision === 'match' ? studentIndex.get(decision.target_student_id) : null;
      if (decision.decision === 'match' && targetIndex == null) continue;
      working.dev[device.key] = {
        d: decision.decision === 'match' ? 'match' : 'not',
        si: targetIndex,
        at: safeDateMs(decision.decided_at),
      };
    }
  }

  return {
    data: {
      meta: {
        ticket: 'MX-MISSIONACCOUNTS-5301P',
        source: 'authenticated-role-scoped-runtime',
        ...(source.scope === 'admin' ? {
          integration_health: integrationHealth(bootstrap),
          attendance_issues: attendanceIssueQueue(bootstrap),
        } : {}),
        controls: {
          sessions: sessionRows.length,
          humans: studentRows.length,
          events: eventRows.length,
          groups: 0,
          clusters: clusters.length,
          unresolved_nodes: clusters.reduce((total, cluster) => total + cluster.members.length, 0),
          per_cycle: Object.fromEntries(cycleRowsForCanon.map(cycle => [cycle.key, { sessions: cycle.sessions, humans: cycle.humans, events: cycle.events }])),
        },
      },
      cycles: cycleRowsForCanon,
      sessions: sessionRows,
      students: studentRows,
      events: eventRows,
      groups: [],
      clusters,
      devices,
      distinct: [],
      excluded: [],
      review_meeting: null,
    },
    working,
    ids: {
      students: Object.fromEntries([...studentIndex].map(([id, index]) => [index, id])),
      sessions: Object.fromEntries([...sessionIndex].map(([id, index]) => [index, id])),
      attendanceEvents: attendanceEventIds,
      attendanceEventGroups,
    },
  };
}
