/* P1-RISE-5007 additive Fable-native private-beta extension.
   This source is injected before boot by sync-fable-shell.mjs. */
{
  const INTEL_CATEGORIES = [
    'Application Requirements', 'Visa', 'USMLE', 'COMLEX', 'YOG', 'USCE', 'Interview',
    'Residents', 'Faculty / Leadership', 'Fellowships', 'Rotations', 'Curriculum', 'Research',
    'Culture', 'Salary / Benefits', 'Facilities', 'Program Update', 'Other',
  ];
  const INTEL_STATUS_LABELS = {
    STUDENT_REPORT: 'Student report', VERIFICATION_PENDING: 'Verification pending',
    VERIFIED_BY_MISSIONMED: 'Verified by MissionMed', PARTIALLY_VERIFIED: 'Partially verified',
    COULD_NOT_VERIFY: 'Could not verify', CONFLICTING: 'Conflicting', OUTDATED: 'Outdated',
    REJECTED_HIDDEN: 'Rejected / hidden',
  };
  const canContributeIntel = runtime.session.capabilities.includes('rise:contribute');
  state.intelByProgram = new Map();
  state.intelLoading = new Set();
  state.intelAdmin = { records: null, analytics: null, error: null, loading: false };
  state.intelAdminFilter = 'ALL';

  function coverageBadge(p) {
    const researched = Number(p.officialFacts || 0);
    let stateLabel = 'RESEARCH PENDING';
    if (p.depth === 'gold' || p.depth === 'enriched') stateLabel = 'DEEP RESEARCH';
    else if (researched >= 20) stateLabel = 'PARTIAL RESEARCH';
    else if (researched > 0) stateLabel = 'BASIC PROFILE';
    return `<span class="coverageBadge ${researched > 0 ? 'has-evidence' : ''}" title="RISE research coverage, not program quality">${stateLabel}${researched > 0 ? ` · ${researched} sourced field${researched === 1 ? '' : 's'}` : ''}</span>`;
  }

  function intelStatus(status) {
    return `<span class="intelStatus is-${esc(status).toLowerCase()}">${esc(INTEL_STATUS_LABELS[status] || status)}</span>`;
  }

  function intelSource(record) {
    if (!record.source) return '';
    const label = record.source.label || record.source.kind?.replaceAll('_', ' ') || 'Source';
    return record.source.url
      ? `<a class="intelSource" href="${esc(record.source.url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`
      : `<span class="intelSource">${esc(label)}</span>`;
  }

  function studentIntelPanel(p) {
    const payload = state.intelByProgram.get(p.id);
    const records = payload?.records || [];
    const loading = state.intelLoading.has(p.id);
    return `<section class="intelSection" aria-labelledby="student-intel-title">
      <div class="intelHead">
        <div><p class="eyebrow">Community evidence</p><h2 class="h2" id="student-intel-title">Student <em>Intel</em></h2></div>
        ${canContributeIntel ? `<button class="rowBtn pri" onclick="openStudentIntelForm('${p.id}')">+ Contribute Intel</button>` : ''}
      </div>
      <div class="lawBanner intelLaw"><b>Student reports are leads, not canonical program facts.</b> Check the status, source, observed date, and Sources & Freshness before relying on a claim.</div>
      ${loading ? '<div class="intelEmpty">Loading Student Intel…</div>' : payload?.error ? `<div class="intelEmpty">Student Intel could not load. <button class="rowBtn" onclick="loadProgramIntel('${p.id}',true)">Try again</button></div>` : records.length ? records.map(record => `
        <article class="intelCard ${record.featured ? 'featured' : ''}">
          <div class="intelMeta"><span class="intelCategory">${esc(record.category)}</span>${intelStatus(record.status)}${record.highPriority ? '<span class="intelPriority">High priority · waiting for research budget</span>' : ''}</div>
          <p class="intelClaim">${esc(record.claim)}</p>
          ${record.adminNotation ? `<p class="intelNotation"><b>MissionMed note:</b> ${esc(record.adminNotation)}</p>` : ''}
          <div class="intelFoot"><span>${esc(record.contributor)}</span><span>Observed ${esc(record.observedOn)}</span>${intelSource(record)}<button class="intelCorroborate" onclick="corroborateIntel('${p.id}','${record.submissionId}')">I can corroborate · ${record.corroborationCount}</button></div>
        </article>`).join('') : '<div class="intelEmpty"><b>No Student Intel published yet.</b><br>Be the first to share a source-located or firsthand observation. Unknown remains unknown until someone contributes and MissionMed verifies it.</div>'}
    </section>`;
  }

  async function loadProgramIntel(programId, force = false) {
    if (!force && (state.intelByProgram.has(programId) || state.intelLoading.has(programId))) return;
    state.intelLoading.add(programId);
    if (force) state.intelByProgram.delete(programId);
    refreshIntelPanel(programId);
    try {
      const payload = await riseFetch('/api/rise/v1/program-specialties/' + encodeURIComponent(programId) + '/student-intel');
      state.intelByProgram.set(programId, payload);
    } catch (error) {
      state.intelByProgram.set(programId, { records: [], error: error.message || 'Unavailable' });
    } finally {
      state.intelLoading.delete(programId);
      refreshIntelPanel(programId);
    }
  }
  window.loadProgramIntel = loadProgramIntel;

  function refreshIntelPanel(programId) {
    if (currentRoute() !== `program/${programId}/overview`) return;
    const program = byId.get(programId);
    const body = $('#fileBody');
    if (program && body) body.innerHTML = fileTabBody(program, 'overview');
  }

  const lockedFileTabBody = fileTabBody;
  fileTabBody = function extendedFileTabBody(program, tab) {
    const body = lockedFileTabBody(program, tab);
    return tab === 'overview' ? `${body}${studentIntelPanel(program)}` : body;
  };

  const lockedRenderFile = renderFile;
  renderFile = function extendedRenderFile(program) {
    return lockedRenderFile(program).replace(
      '<h1 class="fName"',
      `${coverageBadge(program)}<h1 class="fName"`,
    );
  };

  const lockedOpenFileFor = openFileFor;
  openFileFor = function extendedOpenFileFor(route) {
    lockedOpenFileFor(route);
    const [, programId] = route.split('/');
    void loadProgramIntel(programId);
  };
  window.openFileFor = openFileFor;

  const lockedOpenSources = window.openSources;
  window.openSources = (id, evidenceIdx) => {
    lockedOpenSources(id, evidenceIdx);
    const drawer = $('#srcPanel .drawer');
    const coverage = byId.get(id);
    if (!drawer || drawer.querySelector('.betaSourceReminder')) return;
    const reminder = document.createElement('div');
    reminder.className = 'lawBanner betaSourceReminder';
    reminder.innerHTML = `<b>BETA · VERIFY WITH PROGRAM.</b> Sources can be incomplete or outdated; residency requirements, personnel, visa policies, and deadlines can change. Confirm important application requirements directly with the program.${coverage ? ` Coverage: ${coverageBadge(coverage)}` : ''}`;
    drawer.querySelector('h3')?.insertAdjacentElement('afterend', reminder);
  };

  window.openStudentIntelForm = programId => {
    if (!canContributeIntel) { toast('Student Intel contribution is available only to the private-beta cohort.'); return; }
    const today = new Date().toISOString().slice(0, 10);
    openModal(`<div class="mKicker">Private beta · Student Intel</div><div class="mTitle">Contribute what you know</div>
      <div class="mSum">Your original submission is preserved for audit. MissionMed may edit only the student-facing display text, add notation, hide it, or verify it. Anonymous-to-students is the default; admins always retain contributor identity.</div>
      <form id="studentIntelForm" onsubmit="submitStudentIntel(event,'${programId}')">
        <div class="intelFormGrid">
          <label><span>Category</span><select name="category" required>${INTEL_CATEGORIES.map(category => `<option>${esc(category)}</option>`).join('')}</select></label>
          <label><span>Observed / source date</span><input name="observedOn" type="date" max="${today}" value="${today}" required></label>
          <label><span>Source type</span><select name="sourceKind"><option value="ONLINE">Online source</option><option value="FIRSTHAND">Firsthand observation</option><option value="DIRECT_COMMUNICATION">Direct communication</option><option value="OTHER">Other</option></select></label>
          <label><span>Student display</span><select name="displayIdentity"><option value="ANONYMOUS">Anonymous to students</option><option value="SHOW_MY_NAME">Show my name</option></select></label>
          <label class="wide"><span>What should students know?</span><textarea name="claim" maxlength="8000" required placeholder="State the claim precisely. Distinguish what you observed from what you inferred."></textarea></label>
          <label class="wide"><span>Source URL (required for online sources)</span><input name="sourceUrl" type="url" inputmode="url" placeholder="https://…"></label>
          <label class="wide"><span>Source label</span><input name="sourceLabel" maxlength="240" placeholder="Official program page, coordinator email, interview day…"></label>
          <label class="wide"><span>Context for MissionMed review</span><textarea name="contextNotes" maxlength="4000" placeholder="Optional private review context. This is not shown to students."></textarea></label>
        </div>
        <div class="mActs"><button class="mBtn pri" type="submit">Submit for verification</button><button class="mBtn sec" type="button" onclick="closeModal()">Cancel</button></div>
        <div class="mFoot">Do not include patient information, private contact details, or facts you are not authorized to share.</div>
      </form>`);
  };

  window.submitStudentIntel = async (event, programId) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await riseFetch('/api/rise/v1/program-specialties/' + encodeURIComponent(programId) + '/student-intel', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      await loadProgramIntel(programId, true);
      toast('Student Intel submitted for verification.');
    } catch (error) {
      button.disabled = false;
      toast(error.message || 'Student Intel submission failed.');
    }
  };

  window.corroborateIntel = async (programId, submissionId) => {
    if (!canContributeIntel) { toast('Corroboration is available only to the private-beta cohort.'); return; }
    try {
      await riseFetch('/api/rise/v1/student-intel/' + encodeURIComponent(submissionId) + '/corroborate', { method: 'POST', body: '{}' });
      await loadProgramIntel(programId, true);
      toast('Corroboration recorded.');
    } catch (error) { toast(error.message || 'Could not record corroboration.'); }
  };

  function adminIntelView() {
    const { records, analytics, error } = state.intelAdmin;
    const allRecords = records || [];
    const visibleRecords = allRecords.filter(record => {
      if (state.intelAdminFilter === 'PENDING') return ['VERIFICATION_PENDING', 'CONFLICTING'].includes(record.status);
      if (state.intelAdminFilter === 'HIGH') return record.highPriority;
      if (state.intelAdminFilter === 'HIDDEN') return !record.visible || record.status === 'REJECTED_HIDDEN';
      return true;
    });
    const topLists = analytics ? `<div class="intelTopLists">
      <div><span>Top programs</span><b>${(analytics.topPrograms || []).map(item => `${esc(item.programSpecialtyId)} · ${item.count}`).join('<br>') || 'No submissions'}</b></div>
      <div><span>Top categories</span><b>${(analytics.topCategories || []).map(item => `${esc(item.category)} · ${item.count}`).join('<br>') || 'No submissions'}</b></div>
    </div>` : '';
    const metrics = analytics ? `<div class="sumStrip intelMetrics">
      <div class="sumStat"><span class="n">${analytics.total}</span><span class="l">Total reports</span></div>
      <div class="sumStat"><span class="n">${analytics.newThisWeek}</span><span class="l">New this week</span></div>
      <div class="sumStat"><span class="n">${analytics.highPriority}</span><span class="l">High priority</span></div>
      <div class="sumStat"><span class="n">$${Number(analytics.verificationCost || 0).toFixed(2)}</span><span class="l">Verification spend</span></div>
    </div><div class="intelStatusCounts">
      ${[['VERIFICATION_PENDING','Pending'],['VERIFIED_BY_MISSIONMED','Verified'],['PARTIALLY_VERIFIED','Partial'],['CONFLICTING','Conflicting'],['OUTDATED','Outdated'],['REJECTED_HIDDEN','Rejected']].map(([key,label]) => `<span><b>${analytics.counts?.[key] || 0}</b>${label}</span>`).join('')}
      <span><b>${analytics.verificationYield == null ? '—' : `${Math.round(analytics.verificationYield * 100)}%`}</b>Verification yield</span>
    </div>` : '';
    const content = error ? `<div class="emptyLib"><div class="big">Student Intel is unavailable.</div>${esc(error)}</div>` : records === null ? '<div class="emptyLib"><div class="big">Loading Student Intel…</div></div>' : visibleRecords.length ? visibleRecords.map(record => `
      <article class="reviewCard intelAdminCard">
        <div class="intelMeta"><span class="intelCategory">${esc(record.category)}</span>${intelStatus(record.status)}${record.highPriority ? '<span class="intelPriority">High priority · waiting for research budget</span>' : ''}</div>
        <div class="intelAdminIdentity"><b>${esc(record.submitterDisplayName)}</b><span>${esc(record.submitterSubject)}</span><span>${record.anonymousToStudents ? 'Anonymous to students' : 'Name shown to students'}</span></div>
        <div class="rvGrid"><div class="rvBox"><div class="lbl">Original · immutable</div><div class="val">${esc(record.originalClaim)}</div></div><div class="rvBox new"><div class="lbl">Student-facing display</div><div class="val">${esc(record.claim)}</div></div></div>
        ${record.contextNotes ? `<p class="sub">Private context: ${esc(record.contextNotes)}</p>` : ''}
        <div class="intelFoot"><span>${esc(record.programSpecialtyId)}</span><span>Observed ${esc(record.observedOn)}</span>${intelSource(record)}<span>${record.corroborationCount} corroboration${record.corroborationCount === 1 ? '' : 's'}</span></div>
        <div class="rvActs">
          ${[['EDIT_DISPLAY','Edit display'],['ANNOTATE','Add notation'],['REQUEST_CLARIFICATION','Request clarification'],['FEATURE','Feature'],[record.visible ? 'HIDE' : 'UNHIDE',record.visible ? 'Hide' : 'Unhide'],['REJECT','Reject'],['DELETE','Delete'],['MARK_OUTDATED','Mark outdated'],['MARK_CONFLICTING','Mark conflicting'],['MARK_VERIFIED','Mark verified'],['MARK_PARTIAL','Mark partial'],['COULD_NOT_VERIFY','Could not verify'],['SEND_TO_VERIFICATION','Verify again'],['PROMOTE_CANONICAL','Promote verified fact']].map(([action,label]) => `<button class="rvBtn ${action === 'MARK_VERIFIED' ? 'acc' : ''}" onclick="openIntelModeration('${record.submissionId}','${action}')">${label}</button>`).join('')}
          <button class="rvBtn" onclick="openIntelAudit('${record.submissionId}')">Audit trail</button>
        </div>
      </article>`).join('') : '<div class="emptyLib"><div class="big">No Student Intel submissions yet.</div>New private-beta contributions will appear here with contributor identity and immutable original text.</div>';
    return `<div class="view"><div class="adminBanner"><b>Student Intel · Admin</b><span>Contributor identity is admin-only. Original claims and audit events remain immutable.</span></div>
      <p class="eyebrow" style="color:var(--admin)">Student Intel</p><h1 class="h1">Moderate the <em>community layer</em></h1>
      <p class="sub" style="margin:8px 0 18px">Review, annotate, verify, corroborate, hide, and explicitly promote. Paid verification remains separate from the existing IM campaign and cannot run without a server cost preview and confirmation.</p>
      ${metrics}${topLists}<div class="rvActs intelFilters" style="margin:14px 0 8px">
        ${[['ALL','All submissions'],['PENDING','Verification queue'],['HIGH','High priority'],['HIDDEN','Hidden / rejected']].map(([key,label]) => `<button class="rvBtn ${state.intelAdminFilter === key ? 'on' : ''}" onclick="setIntelAdminFilter('${key}')">${label}</button>`).join('')}
      </div><div class="rvActs" style="margin:0 0 20px"><button class="rvBtn" onclick="previewIntelVerification()">Preview verification queue</button><button class="rvBtn" disabled>Run paid verification</button><span class="intelSinkState">Verification history is retained per report. Canonical promotion remains blocked until the evidence sink is connected.</span></div>${content}</div>`;
  }

  window.setIntelAdminFilter = filter => {
    state.intelAdminFilter = filter;
    renderMain(currentRoute());
  };

  async function loadAdminIntel(force = false) {
    if (!state.canAdmin || state.intelAdmin.loading || (!force && state.intelAdmin.records !== null)) return;
    state.intelAdmin.loading = true;
    try {
      const payload = await riseFetch('/api/rise/v1/operator/student-intel');
      state.intelAdmin = { records: payload.records || [], analytics: payload.analytics || null, error: null, loading: false };
    } catch (error) {
      state.intelAdmin = { records: [], analytics: null, error: error.message || 'Unavailable', loading: false };
    }
    if (currentRoute() === 'admin/student-intel') renderMain(currentRoute());
  }

  const lockedViewAdmin = viewAdmin;
  viewAdmin = function extendedViewAdmin(sub) {
    return sub === 'student-intel' ? adminIntelView() : lockedViewAdmin(sub);
  };

  const lockedBindAdmin = bindAdmin;
  bindAdmin = function extendedBindAdmin() {
    lockedBindAdmin();
    if (currentRoute() === 'admin/student-intel') void loadAdminIntel();
  };

  const lockedRenderShell = renderShell;
  renderShell = function extendedRenderShell() {
    lockedRenderShell();
    if (state.role !== 'admin') return;
    const railFoot = $('#rail .railFoot');
    if (!railFoot || $('#rail [data-intel-admin]')) return;
    railFoot.insertAdjacentHTML('beforebegin', `<button data-intel-admin class="rtab adminTab ${currentRoute() === 'admin/student-intel' ? 'on' : ''}" onclick="nav('admin/student-intel')">${ICONS.review}<span>Student Intel</span></button>`);
  };
  window.renderShell = renderShell;

  window.openIntelModeration = (submissionId, action) => {
    const record = state.intelAdmin.records?.find(item => item.submissionId === submissionId);
    if (!record) return;
    const edit = action === 'EDIT_DISPLAY' ? `<label class="wide"><span>Student-facing display text</span><textarea name="displayClaim" maxlength="8000" required>${esc(record.claim)}</textarea></label>` : '';
    const notation = action === 'ANNOTATE' ? '<label class="wide"><span>Public MissionMed notation</span><textarea name="adminNotation" maxlength="4000" required></textarea></label>' : '';
    const promote = action === 'PROMOTE_CANONICAL' ? '<label><span>Canonical field</span><input name="canonicalField" maxlength="128" required></label><label><span>Canonical JSON value</span><textarea name="canonicalValue" required placeholder="true, 230, or &quot;text&quot;"></textarea></label>' : '';
    openModal(`<div class="mKicker">Student Intel moderation</div><div class="mTitle">${esc(action.replaceAll('_', ' '))}</div><div class="mSum">The original claim is never edited. This action and its before/after state will be added to the immutable audit trail.</div>
      <form onsubmit="submitIntelModeration(event,'${submissionId}','${action}')"><div class="intelFormGrid">${edit}${notation}${promote}<label class="wide"><span>Reason</span><textarea name="reason" maxlength="4000" required></textarea></label></div><div class="mActs"><button class="mBtn pri" type="submit">Confirm action</button><button class="mBtn sec" type="button" onclick="closeModal()">Cancel</button></div></form>`);
  };

  window.submitIntelModeration = async (event, submissionId, action) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (action === 'PROMOTE_CANONICAL') {
      try { values.canonicalValue = JSON.parse(values.canonicalValue); }
      catch { toast('Canonical value must be valid JSON.'); return; }
    }
    try {
      await riseFetch('/api/rise/v1/operator/student-intel/' + encodeURIComponent(submissionId), { method: 'PATCH', body: JSON.stringify({ action, ...values }) });
      closeModal();
      state.intelByProgram.clear();
      state.intelAdmin.records = null;
      await loadAdminIntel(true);
      toast('Moderation action recorded.');
    } catch (error) { toast(error.message || 'Moderation failed.'); }
  };

  window.openIntelAudit = async submissionId => {
    try {
      const payload = await riseFetch('/api/rise/v1/operator/student-intel/' + encodeURIComponent(submissionId) + '/audit');
      openModal(`<div class="mKicker">Immutable audit trail</div><div class="mTitle">${payload.records.length} recorded action${payload.records.length === 1 ? '' : 's'}</div><div class="intelAudit">${payload.records.length ? payload.records.map(event => `<div><b>${esc(event.action.replaceAll('_', ' '))}</b><span>${esc(event.createdAt)}</span><p>${esc(event.reason || 'No reason supplied')}</p></div>`).join('') : '<p>No moderation actions recorded.</p>'}</div><div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
    } catch (error) { toast(error.message || 'Audit trail unavailable.'); }
  };

  window.previewIntelVerification = async () => {
    try {
      const preview = await riseFetch('/api/rise/v1/operator/student-intel/verification:preview', { method: 'POST', body: '{}' });
      const programs = new Set(preview.submissions.map(item => item.programSpecialtyId));
      const categories = new Set(preview.submissions.map(item => item.category));
      const priority = preview.submissions.filter(item => item.highPriority).length;
      openModal(`<div class="mKicker">Preview before spend</div><div class="mTitle">${preview.submissions.length} verification lead${preview.submissions.length === 1 ? '' : 's'}</div><div class="mSum">${programs.size} program${programs.size === 1 ? '' : 's'} · ${categories.size} categor${categories.size === 1 ? 'y' : 'ies'} · ${priority} high priority. Task class: ${esc(preview.taskClass || 'RISE_STUDENT_INTEL_CLAIM_VERIFICATION')}. Router: ${esc(preview.routerPolicy)}. Supplied URL first: ${preview.suppliedUrlFirst ? 'yes' : 'no'}.</div><div class="lawBanner" style="margin-top:16px"><b>Paid submission is unavailable.</b> No processor is selected and cost cannot be estimated because the bounded server-side factory bridge and separate Student Intel budget are not connected. The 1st/15th schedule is staged but inactive; the existing IM campaign is untouched.</div><div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
    } catch (error) { toast(error.message || 'Verification preview unavailable.'); }
  };

  window.acknowledgeRiseBeta = async () => {
    try {
      runtime.betaNotice = await riseFetch('/api/rise/v1/me/beta-notice', { method: 'POST', body: '{}' });
      closeModal();
    } catch (error) { toast(error.message || 'Could not record beta acknowledgment.'); }
  };

  function showPrivateBetaNotice() {
    if (!runtime.session.privateBeta || runtime.betaNotice?.acknowledged) return;
    openModal(`<div class="mKicker">RISE private beta</div><div class="mTitle">Broad discovery. Honest evidence.</div><div class="mSum">RISE Beta combines MissionMed research with information from official program sources and, where labeled, reports shared by MissionMed students. Missing means unknown—not no. Student Intel is community-supplied until its status says MissionMed verified.</div><div class="lawBanner" style="margin-top:16px"><b>Use sources and dates.</b> Residency requirements, personnel, visa policies, deadlines, and other program details can change, and sources may be incomplete or outdated. Always confirm important application requirements directly with the residency program before making application decisions.</div><div class="mActs"><button class="mBtn pri" onclick="acknowledgeRiseBeta()">I understand</button></div><div class="mFoot">Your private-beta access does not add unrelated MissionMed entitlements.</div>`);
  }

  const lockedInit = init;
  init = function extendedInit() {
    lockedInit();
    setTimeout(showPrivateBetaNotice, 0);
  };
}
