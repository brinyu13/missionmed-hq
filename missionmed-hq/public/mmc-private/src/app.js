// Ported from _AI_HANDOFFS/from_codex/MMC-005A_OS_PATCHED_FROM_003.html for MMC-008B demo parity.
// =============================================
// MOCK DATA
// =============================================
let students = [
  {id:'amara',name:'Amara Okafor',initials:'AO',country:'Nigeria',school:'University of Lagos',program:'usce',session:'spring2026',specialty:'Internal Medicine',risk:'medium',status:'Active',lastMeeting:'Jun 22, 2026',step1:'Pass',step2:'241',oet:'B+',riskLabel:'Medium Risk',riskClass:'badge-orange'},
  {id:'raj',name:'Raj Patel',initials:'RP',country:'India',school:'Gujarat Medical University',program:'match',session:'spring2026',specialty:'Family Medicine',risk:'low',status:'Active',lastMeeting:'Jun 20, 2026',step1:'Pass',step2:'235',oet:'B',riskLabel:'Low Risk',riskClass:'badge-green'},
  {id:'mei',name:'Mei-Ling Chen',initials:'MC',country:'Taiwan',school:'National Taiwan University',program:'interview',session:'spring2026',specialty:'Pediatrics',risk:'high',status:'At Risk',lastMeeting:'Jun 18, 2026',step1:'Pass',step2:'228',oet:'B+',riskLabel:'High Risk',riskClass:'badge-red'},
  {id:'diego',name:'Diego Ramirez',initials:'DR',country:'Mexico',school:'UNAM School of Medicine',program:'usce',session:'summer2026',specialty:'Surgery',risk:'medium',status:'Active',lastMeeting:'Jun 19, 2026',step1:'Pass',step2:'248',oet:'A',riskLabel:'Medium Risk',riskClass:'badge-orange'},
  {id:'yuki',name:'Yuki Tanaka',initials:'YT',country:'Japan',school:'University of Tokyo',program:'interview',session:'summer2026',specialty:'Psychiatry',risk:'low',status:'Active',lastMeeting:'Jun 17, 2026',step1:'Pass',step2:'238',oet:'B+',riskLabel:'Low Risk',riskClass:'badge-green'},
  {id:'fatima',name:'Fatima Al-Hassan',initials:'FA',country:'Egypt',school:'Cairo University',program:'match',session:'spring2026',specialty:'Internal Medicine',risk:'low',status:'Active',lastMeeting:'Jun 16, 2026',step1:'Pass',step2:'252',oet:'A',riskLabel:'Low Risk',riskClass:'badge-green'},
  {id:'ahmed',name:'Ahmed Khan',initials:'AK',country:'Pakistan',school:'Aga Khan University',program:'usce',session:'summer2026',specialty:'Neurology',risk:'medium',status:'Active',lastMeeting:'Jun 15, 2026',step1:'Pass',step2:'240',oet:'B',riskLabel:'Medium Risk',riskClass:'badge-orange'},
  {id:'priya',name:'Priya Sharma',initials:'PS',country:'India',school:'AIIMS New Delhi',program:'match',session:'fall2026',specialty:'OB/GYN',risk:'low',status:'Onboarding',lastMeeting:'Jun 14, 2026',step1:'Pass',step2:'245',oet:'B+',riskLabel:'Low Risk',riskClass:'badge-green'},
  {id:'carlos',name:'Carlos Mendez',initials:'CM',country:'Colombia',school:'Universidad Nacional',program:'usce',session:'fall2026',specialty:'Emergency Medicine',risk:'high',status:'At Risk',lastMeeting:'Jun 10, 2026',step1:'Pass',step2:'220',oet:'B',riskLabel:'High Risk',riskClass:'badge-red'},
  {id:'olga',name:'Olga Petrov',initials:'OP',country:'Russia',school:'Moscow State Medical',program:'usce',session:'spring2026',specialty:'Radiology',risk:'medium',status:'Active',lastMeeting:'Jun 12, 2026',step1:'Pass',step2:'243',oet:'B',riskLabel:'Medium Risk',riskClass:'badge-orange'},
  {id:'jin',name:'Jin-Soo Park',initials:'JP',country:'South Korea',school:'Seoul National University',program:'match',session:'summer2026',specialty:'Anesthesiology',risk:'low',status:'Active',lastMeeting:'Jun 11, 2026',step1:'Pass',step2:'250',oet:'A',riskLabel:'Low Risk',riskClass:'badge-green'},
  {id:'sarah',name:'Sarah Mensah',initials:'SM',country:'Ghana',school:'University of Ghana',program:'usce',session:'fall2026',specialty:'Pediatrics',risk:'medium',status:'Onboarding',lastMeeting:'Jun 8, 2026',step1:'Pass',step2:'232',oet:'B+',riskLabel:'Medium Risk',riskClass:'badge-orange'}
];

const mmcRuntime = window.MMCDataAdapters
  ? window.MMCDataAdapters.createRuntime({ demoStudents: students })
  : null;
if (mmcRuntime) {
  students = mmcRuntime.hydrateStudents();
  window.MMC_REALITY_RUNTIME = mmcRuntime;
  document.documentElement.dataset.mmcAdapterMode = mmcRuntime.mode;
  document.documentElement.dataset.mmcAdapterStatus = mmcRuntime.status;
  document.documentElement.dataset.mmcProtectedPayloadsLoaded = 'false';
  document.documentElement.dataset.mmcExternalRequestsEnabled = 'false';
  document.documentElement.dataset.mmcWritesEnabled = 'false';
  document.documentElement.dataset.mmcLiveDataReviewStatus = mmcRuntime.realityGate.liveDataReviewStatus;
  document.documentElement.dataset.mmcRealDataReplacements = String(mmcRuntime.realityGate.realDataReplacements);
}

const ownershipRuntime = window.MMCOwnershipLayer
  ? window.MMCOwnershipLayer.createRuntime({ demoStudents: students, activeMentorId: 'mentor-brian' })
  : null;
let ownershipHydrationPromise = Promise.resolve(false);
if (ownershipRuntime) {
  students = ownershipRuntime.hydrateDirectory(students);
  window.MMC_OWNERSHIP_RUNTIME = ownershipRuntime;
  document.documentElement.dataset.mmcOwnershipVersion = ownershipRuntime.gate.version;
  document.documentElement.dataset.mmcOwnershipStatus = ownershipRuntime.status;
  document.documentElement.dataset.mmcOwnershipMode = ownershipRuntime.mode;
  document.documentElement.dataset.mmcLocalOwnedWritesEnabled = String(ownershipRuntime.gate.localOwnedWritesEnabled);
  document.documentElement.dataset.mmcLocalStorageEnabled = String(ownershipRuntime.validationSummary().localStorageEnabled);
  document.documentElement.dataset.mmcSchemaPersistenceEnabled = String(ownershipRuntime.validationSummary().schemaPersistenceEnabled);
  document.documentElement.dataset.mmcSchemaPersistenceStatus = ownershipRuntime.validationSummary().persistence.status;
  document.documentElement.dataset.mmcExternalWritesEnabled = String(ownershipRuntime.gate.externalWritesEnabled);
  document.documentElement.dataset.mmcMentorIntelligenceStatus = 'MENTOR_INTELLIGENCE_READY';
  document.documentElement.dataset.mmcBriefingSource = 'mmc-owned-schema-with-fixture-fallback';
  document.documentElement.dataset.mmcProfilePhotoStatus = 'local-internal-pilot-only';
  ownershipHydrationPromise = ownershipRuntime.hydratePersistence()
    .then((loaded) => {
      students = ownershipRuntime.hydrateDirectory(students);
      document.documentElement.dataset.mmcSchemaPersistenceStatus = ownershipRuntime.validationSummary().persistence.status;
      document.documentElement.dataset.mmcSchemaPersistenceLoaded = String(Boolean(loaded));
      refreshOwnershipViews();
      return loaded;
    })
    .catch(() => {
      document.documentElement.dataset.mmcSchemaPersistenceStatus = ownershipRuntime.validationSummary().persistence.status;
      refreshOwnershipViews();
      return false;
    });
}

const programLabels = {usce:'USCE Navigator',match:'Match Ready',interview:'Interview Forge'};
const sessionLabels = {spring2026:'Spring 2026',summer2026:'Summer 2026',fall2026:'Fall 2026'};
const statusColors = {Active:'badge-green','At Risk':'badge-red',Onboarding:'badge-cyan'};
let activePrepStudent = 'amara';
let quickCaptureType = 'Note';
let sessionItemCounter = 1;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function studentName(studentId) {
  const student = students.find(s => s.id === studentId);
  return student ? student.name : 'Student';
}

function badgeClassForTask(task) {
  if (task.status === 'complete') return 'badge-green';
  if (task.priority === 'critical' || task.dueLabel === 'Overdue') return 'badge-red';
  if (task.priority === 'high' || task.dueLabel === 'Due Today') return 'badge-orange';
  if (task.owner === 'student') return 'badge-cyan';
  return 'badge-gold';
}

function surfaceForTask(task) {
  if (task.priority === 'critical' || task.dueLabel === 'Overdue') return ['var(--red-dim)', 'var(--red)'];
  if (task.priority === 'high' || task.dueLabel === 'Due Today') return ['var(--orange-dim)', 'var(--orange)'];
  if (task.owner === 'student') return ['rgba(0,212,255,0.06)', 'var(--cyan)'];
  return ['rgba(232,164,28,0.06)', 'var(--gold)'];
}

function badgeClassForRisk(level) {
  if (level === 'High') return 'badge-red';
  if (level === 'Medium') return 'badge-orange';
  return 'badge-green';
}

function badgeClassForReadiness(status) {
  if (status === 'Strong') return 'badge-green';
  if (status === 'Stable') return 'badge-cyan';
  if (status === 'Needs attention') return 'badge-orange';
  return 'badge-red';
}

function timelineDotClass(tone) {
  if (tone === 'green') return 'green';
  if (tone === 'red') return 'red';
  if (tone === 'gold') return 'gold';
  return 'cyan';
}

function getProfilePhoto(studentId) {
  return ownershipRuntime && ownershipRuntime.getProfilePhoto
    ? ownershipRuntime.getProfilePhoto(studentId)
    : null;
}

function photoAvatarMarkup(student, className) {
  const photo = getProfilePhoto(student.id);
  const classNames = className || 'avatar';
  if (photo && photo.hasPhoto && photo.dataUrl) {
    return `<div class="${classNames} has-photo"><img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(student.name)} profile photo"></div>`;
  }
  return `<div class="${classNames}">${escapeHtml(student.initials)}</div>`;
}

function updatePhotoAvatar(node, student, className) {
  if (!node || !student) return;
  const photo = getProfilePhoto(student.id);
  node.className = className || 'avatar';
  if (photo && photo.hasPhoto && photo.dataUrl) {
    node.classList.add('has-photo');
    node.innerHTML = `<img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(student.name)} profile photo">`;
  } else {
    node.classList.remove('has-photo');
    node.textContent = student.initials;
  }
}

function updateOwnershipStats() {
  if (!ownershipRuntime) return;
  const stats = ownershipRuntime.getStats();
  const openActions = document.getElementById('open-actions-count');
  const promises = document.getElementById('mentor-promises-count');
  const reviews = document.getElementById('document-reviews-count');
  const dueToday = document.getElementById('due-today-count');
  const actionBadge = document.querySelector('.nav-item[data-screen="actions"] .nav-badge');
  if (openActions) openActions.textContent = String(stats.openActions);
  if (promises) promises.textContent = String(stats.mentorPromises);
  if (reviews) reviews.textContent = String(stats.documentReviews);
  if (dueToday) dueToday.textContent = String(stats.dueToday);
  if (actionBadge) actionBadge.textContent = String(stats.openActions);
}

function refreshOwnershipViews() {
  if (!ownershipRuntime) return;
  renderOwnedActions();
  renderOwnedProfile(activePrepStudent);
  renderMemoryContent(activePrepStudent);
  renderMemorySearchResults();
  renderSessionItems();
  renderPostSessionReview();
  renderSessionCommand(activePrepStudent);
  filterStudents();
  updateOwnershipStats();
  renderPilotReadiness();
}

function updateSchemaPersistenceStatus() {
  if (!ownershipRuntime) return;
  const summary = ownershipRuntime.validationSummary();
  document.documentElement.dataset.mmcSchemaPersistenceStatus = summary.persistence.status;
  document.documentElement.dataset.mmcSchemaPersistenceLastSavedAt = summary.persistence.lastSavedAt || '';
  document.documentElement.dataset.mmcSchemaPersistenceError = summary.persistence.error || '';
  const indicator = document.getElementById('persistence-indicator');
  const label = document.getElementById('persistence-status-label');
  const dot = document.getElementById('persistence-status-dot');
  const status = summary.persistence.status || 'initializing';
  const display = status === 'connected'
    ? 'Schema Connected'
    : status === 'saving'
      ? 'Saving'
      : status === 'error'
        ? 'Persistence Attention'
        : 'Fixture Fallback';
  if (label) label.textContent = display;
  if (indicator) indicator.className = 'sync-indicator ' + status;
  if (dot) dot.className = 'sync-dot ' + status;
}

function flushOwnershipPersistence() {
  if (!ownershipRuntime || !ownershipRuntime.flushPersistence) return Promise.resolve(null);
  return ownershipRuntime.flushPersistence().then((result) => {
    updateSchemaPersistenceStatus();
    renderPilotReadiness();
    return result;
  });
}

function formatTimestamp(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderPilotReadiness() {
  if (!ownershipRuntime || !ownershipRuntime.getLaunchReadiness) return;
  const readiness = ownershipRuntime.getLaunchReadiness();
  const summary = ownershipRuntime.validationSummary();
  updateSchemaPersistenceStatus();
  const setText = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };
  const stateClass = readiness.status === 'PRIVATE_ALPHA_LAUNCH_READY' ? 'badge-green' : 'badge-orange';
  const state = document.getElementById('pilot-readiness-state');
  if (state) {
    state.className = 'badge ' + stateClass;
    state.textContent = readiness.status === 'PRIVATE_ALPHA_LAUNCH_READY' ? 'Launch Ready' : 'Needs Review';
  }
  setText('pilot-persistence-state', `${summary.persistence.status} · writes ${summary.persistence.lastWriteCount || 0} · last save ${formatTimestamp(summary.persistence.lastSavedAt)}`);
  setText('pilot-assignment-state', `${readiness.assignmentCount} assigned students · ${summary.stats.memoryItems} memory items · ${summary.stats.goals} goals`);
  setText('pilot-session-recovery-state', readiness.activeSession
    ? `Recoverable ${readiness.activeSession.status} session for ${studentName(readiness.activeSession.studentId)}`
    : 'No active session to recover');
  setText('pilot-export-state', readiness.exportReady ? 'Snapshot export ready' : 'Snapshot export unavailable');
  const blockers = document.getElementById('pilot-blockers');
  if (blockers) {
    blockers.innerHTML = readiness.blockers.length
      ? readiness.blockers.map(item => `<span class="badge badge-orange">${escapeHtml(item)}</span>`).join('')
      : '<span class="badge badge-green">No alpha blockers detected</span>';
  }
}

function exportPilotSnapshot() {
  if (!ownershipRuntime || !ownershipRuntime.exportPilotSnapshot) return null;
  const snapshot = ownershipRuntime.exportPilotSnapshot();
  const state = document.getElementById('pilot-export-state');
  const fileName = `mmc-private-alpha-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const serialized = JSON.stringify(snapshot, null, 2);
  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL && typeof document !== 'undefined') {
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (state) state.textContent = `Snapshot prepared: ${fileName}`;
  renderPilotReadiness();
  showToast('Private alpha snapshot prepared.');
  return snapshot;
}

function recoverSession() {
  if (!ownershipRuntime || !ownershipRuntime.recoverLatestSession) {
    showToast('No recoverable session found.');
    return null;
  }
  const session = ownershipRuntime.recoverLatestSession(activePrepStudent);
  if (!session) {
    showToast('No recoverable session found.');
    renderPilotReadiness();
    return null;
  }
  activePrepStudent = session.studentId;
  const notes = document.getElementById('session-notes');
  if (notes) notes.value = session.privateNotes || session.summary || '';
  renderSessionCommand(activePrepStudent);
  renderSessionItems();
  renderPilotReadiness();
  showToast('Recovered active session for ' + studentName(activePrepStudent) + '.');
  switchScreen('sessioncmd');
  return session;
}

// =============================================
// NAVIGATION
// =============================================
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector('.nav-item[data-screen="' + id + '"]');
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: ['Today', 'Monday, June 22, 2026'],
    actions: ['Actions', 'Promises, reviews, follow-ups, and decisions'],
    directory: ['Attention-Ranked Directory', '24 students prioritized by mentor attention'],
    profile: ['Student Intelligence Profile', 'Admin View'],
    meeting: ['Meeting Intelligence', 'Webex Recording + AI Analysis'],
    memory: ['Mentor Memory / Call Prep', 'Memory-driven prep system'],
    sessioncmd: ['Session Command', 'Live mentor cockpit'],
    postsession: ['Post-Session Capture', 'Confirm actions and return to Today'],
    studentview: ['Student View Preview', 'What the student sees']
  };
  document.getElementById('topbar-title').textContent = titles[id][0];
  document.getElementById('topbar-sub').textContent = titles[id][1];

  document.getElementById('content-area').scrollTop = 0;
}

// =============================================
// STUDENT DIRECTORY
// =============================================
let currentProgramFilter = 'all';

function attentionScore(s) {
  const riskScore = s.risk === 'high' ? 30 : s.risk === 'medium' ? 18 : 6;
  const statusScore = s.status === 'At Risk' ? 18 : s.status === 'Onboarding' ? 10 : 4;
  const oldMeetingScore = s.lastMeeting.includes('Jun 8') || s.lastMeeting.includes('Jun 10') ? 18 : s.lastMeeting.includes('Jun 12') || s.lastMeeting.includes('Jun 14') ? 10 : 5;
  return riskScore + statusScore + oldMeetingScore;
}

function renderStudentTable(data) {
  const tbody = document.getElementById('student-tbody');
  const sorted = data.slice().sort((a,b) => attentionScore(b) - attentionScore(a));
  tbody.innerHTML = sorted.map((s, index) => `
    <tr class="clickable" onclick="openProfile('${s.id}')"${index === 0 ? ' data-testid="directory-row"' : ''}>
      <td>
        <div class="flex-row">
          ${photoAvatarMarkup(s, 'avatar directory-avatar')}
          <div>
            <div style="font-weight:500">${s.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">${s.school}</div>
          </div>
        </div>
      </td>
      <td>${s.country}</td>
      <td><span class="badge badge-${s.program==='usce'?'gold':s.program==='match'?'cyan':'green'}">${programLabels[s.program]}</span></td>
      <td>${sessionLabels[s.session]}</td>
      <td>${s.specialty}</td>
      <td><span class="badge ${s.riskClass}">${s.riskLabel}</span></td>
      <td><span class="badge ${statusColors[s.status]}">${s.status}</span></td>
      <td style="font-size:12px;color:var(--text-dim)">${s.lastMeeting}</td>
      <td><span class="badge ${attentionScore(s) > 55 ? 'badge-red' : attentionScore(s) > 38 ? 'badge-orange' : 'badge-cyan'}">${attentionScore(s)}</span></td>
    </tr>
  `).join('');
}

function setFilter(el, filter) {
  document.querySelectorAll('.filter-bar .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  currentProgramFilter = filter;
  filterStudents();
}

function filterStudents() {
  const search = (document.getElementById('student-search').value || '').toLowerCase();
  const risk = document.getElementById('risk-filter').value;
  const session = document.getElementById('session-filter').value;
  let filtered = students.filter(s => {
    if (currentProgramFilter !== 'all' && s.program !== currentProgramFilter) return false;
    if (risk && s.risk !== risk) return false;
    if (session && s.session !== session) return false;
    if (search && !s.name.toLowerCase().includes(search) && !s.country.toLowerCase().includes(search) && !s.specialty.toLowerCase().includes(search)) return false;
    return true;
  });
  renderStudentTable(filtered);
}

function renderOwnedActions() {
  if (!ownershipRuntime) return;
  const list = document.getElementById('actions-list');
  if (!list) return;
  const actions = ownershipRuntime.getTasks().slice(0, 8);
  list.innerHTML = actions.map((task, index) => {
    const surface = surfaceForTask(task);
    const checked = task.status === 'complete' ? ' checked' : '';
    const completedClass = task.status === 'complete' ? ' completed' : '';
    const testId = index === 0 ? ' data-testid="action-checkbox"' : '';
    return `
      <div class="flex-between action-row${completedClass}" data-task-id="${escapeHtml(task.id)}" style="padding:10px;border-radius:var(--radius);background:${surface[0]};border-left:3px solid ${surface[1]}">
        <div class="flex-row" style="flex:1">
          <input class="action-checkbox" type="checkbox" onchange="completeAction(this)"${checked}${testId}>
          <div class="action-text" style="font-size:13px"><strong>${escapeHtml(task.type)}:</strong> ${escapeHtml(task.title)} <span style="color:var(--text-dim)">for ${escapeHtml(studentName(task.studentId))}</span></div>
        </div>
        <span class="badge ${badgeClassForTask(task)}">${escapeHtml(task.dueLabel)}</span>
      </div>
    `;
  }).join('');
  updateOwnershipStats();
}

function renderOwnedProfile(studentId) {
  if (!ownershipRuntime) return;
  const bundle = ownershipRuntime.getStudentBundle(studentId);
  if (!bundle || !bundle.student) return;
  const photo = bundle.profilePhoto || getProfilePhoto(studentId);
  const profilePhotoState = document.getElementById('profile-photo-state');
  const fallbackGoal = {
    title: `Create active coaching goal for ${bundle.student.name}`,
    milestone: 'No formal MMC-owned milestone has been captured yet',
    targetDate: 'TBD',
    progress: 0,
    velocity: 'Needs mentor definition',
    readinessInputs: ['goal capture needed', 'milestones pending', 'next session should define target']
  };
  const goal = bundle.goals[0] || fallbackGoal;
  const readiness = ownershipRuntime.getReadiness(studentId);
  const risk = ownershipRuntime.getRisk(studentId);
  const timeline = ownershipRuntime.getStudentTimeline(studentId).slice(0, 6);
  const strategy = document.getElementById('profile-current-strategy');
  const mentor = document.getElementById('profile-mentor');
  const readinessPanel = document.getElementById('profile-readiness-framework');
  const timelinePanel = document.getElementById('profile-journey-timeline');
  if (mentor) {
    mentor.textContent = `Mentor: Brian Biruk · MMC-owned tasks ${bundle.openTasks.length} · Memory ${bundle.memory.length}`;
  }
  updatePhotoAvatar(document.getElementById('profile-avatar'), bundle.student, 'avatar profile-header-avatar');
  if (profilePhotoState) {
    profilePhotoState.textContent = photo && photo.hasPhoto
      ? `Local profile photo saved · ${photo.visibility} · production storage ${photo.productionStorage}`
      : `Initials fallback active · source ${photo ? photo.source : 'local MMC profile photo'} · production storage future unresolved`;
  }
  if (strategy) {
    strategy.innerHTML = `
      <div>
        <div style="font-size:11px;color:var(--text-dim)">Primary Goal</div>
        <div style="font-size:13px;font-weight:500;margin-top:2px">${escapeHtml(goal.title)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-dim)">Current Milestone</div>
        <div style="font-size:13px;margin-top:2px">${escapeHtml(goal.milestone)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-dim)">Current Focus</div>
        <div style="font-size:13px;margin-top:2px">${escapeHtml(goal.readinessInputs.join(' · '))}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-dim)">Progress / Velocity</div>
        <div style="font-size:13px;margin-top:2px;color:var(--orange)">${escapeHtml(goal.progress)}% · ${escapeHtml(goal.velocity)} · Target ${escapeHtml(goal.targetDate)}</div>
      </div>
    `;
  }
  if (readinessPanel) {
    const missing = readiness.missingInputs.length
      ? readiness.missingInputs.map(item => `<span class="badge badge-orange">${escapeHtml(item)}</span>`).join('')
      : '<span class="badge badge-green">Core inputs captured</span>';
    readinessPanel.innerHTML = `
      <div class="flex-between">
        <div>
          <div style="font-size:11px;color:var(--text-dim)">Readiness</div>
          <div style="font-size:24px;font-weight:700;color:var(--cyan);margin-top:2px">${escapeHtml(readiness.score)}%</div>
        </div>
        <span class="badge ${badgeClassForReadiness(readiness.status)}">${escapeHtml(readiness.status)}</span>
      </div>
      <div class="progress-bar mt-sm"><div class="progress-fill cyan" style="width:${escapeHtml(readiness.score)}%"></div></div>
      <div class="grid-2 gap-md mt-md">
        <div>
          <div style="font-size:11px;color:var(--text-dim)">Follow-through Risk</div>
          <div style="font-size:18px;font-weight:700;margin-top:2px;color:var(--orange)">${escapeHtml(risk.score)}%</div>
          <span class="badge ${badgeClassForRisk(risk.level)}">${escapeHtml(risk.level)} Risk</span>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-dim)">Open Loops</div>
          <div style="font-size:18px;font-weight:700;margin-top:2px">${escapeHtml(readiness.openActions)}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:4px">${escapeHtml(readiness.openPromises)} mentor promise(s)</div>
        </div>
      </div>
      <div class="mt-md" style="display:flex;flex-wrap:wrap;gap:6px">${missing}</div>
    `;
  }
  if (timelinePanel) {
    timelinePanel.innerHTML = timeline.map(item => `
      <div class="timeline-item">
        <div class="timeline-dot ${timelineDotClass(item.tone)}"></div>
        <div class="timeline-content">
          <div class="timeline-title">${escapeHtml(item.title)}</div>
          <div class="timeline-meta">${escapeHtml(item.date)} · ${escapeHtml(item.kind)} · ${escapeHtml(item.status)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escapeHtml(item.detail)}</div>
        </div>
      </div>
    `).join('') || '<div style="font-size:12px;color:var(--text-dim)">No MMC-owned timeline records yet.</div>';
  }
  renderStudentBriefing(studentId);
}

function renderBriefingRows(items, emptyText, renderItem) {
  if (!items || !items.length) {
    return `<div class="briefing-empty">${escapeHtml(emptyText)}</div>`;
  }
  return items.map(renderItem).join('');
}

function renderStudentBriefing(studentId) {
  if (!ownershipRuntime || !ownershipRuntime.getStudentBriefing) return;
  const briefing = ownershipRuntime.getStudentBriefing(studentId);
  if (!briefing) return;
  const setHtml = (id, html) => {
    const node = document.getElementById(id);
    if (node) node.innerHTML = html;
  };
  const setText = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };
  const riskClass = badgeClassForRisk(briefing.riskSummary.level);
  const readinessClass = badgeClassForReadiness(briefing.riskSummary.readinessStatus);
  const photo = briefing.profilePhoto || getProfilePhoto(studentId);
  const student = students.find(s => s.id === briefing.studentId) || students[0];
  setText('briefing-student-name', briefing.studentName);
  setText('briefing-confidence', briefing.confidence);
  updatePhotoAvatar(document.getElementById('briefing-profile-photo'), student, 'avatar briefing-profile-photo');
  setHtml('briefing-photo-metadata', `
    <div><strong>source:</strong> ${escapeHtml(photo.source)}</div>
    <div><strong>visibility:</strong> ${escapeHtml(photo.visibility)}</div>
    <div><strong>production storage:</strong> ${escapeHtml(photo.productionStorage)}</div>
    <div><strong>student upload:</strong> ${escapeHtml(photo.studentUploadStatus)}</div>
  `);
  setHtml('briefing-who', `
    <div class="briefing-kicker">WHO IS THIS PERSON?</div>
    <div class="briefing-lead">${escapeHtml(briefing.who)}</div>
    <div class="briefing-meta-line">${escapeHtml(briefing.primaryGoal)}</div>
  `);
  setHtml('briefing-next-best-move', `
    <div class="briefing-kicker">NEXT BEST MOVE</div>
    <div class="briefing-lead" style="color:var(--gold)">${escapeHtml(briefing.nextBestMove.title)}</div>
    <div class="briefing-meta-line">${escapeHtml(briefing.nextBestMove.action)}</div>
    <div class="briefing-why">${briefing.nextBestMove.why.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
  `);
  setHtml('briefing-personal-context', `
    <div class="briefing-label">PERSONAL CONTEXT</div>
    <div class="briefing-text">${escapeHtml(briefing.personalContext)}</div>
  `);
  setHtml('briefing-professional-context', `
    <div class="briefing-label">PROFESSIONAL CONTEXT</div>
    <div class="briefing-text">${escapeHtml(briefing.professionalContext)}</div>
  `);
  setHtml('briefing-last-meeting', `
    <div class="briefing-label">LAST MEETING</div>
    <div class="briefing-text">${escapeHtml(briefing.lastMeeting)}</div>
  `);
  setHtml('briefing-advice-history', `
    <div class="briefing-label">LAST ADVICE</div>
    <div class="briefing-text">${escapeHtml(briefing.lastAdvice)}</div>
    <div class="briefing-sublist">
      ${renderBriefingRows(briefing.adviceHistory.notActedUpon.slice(0, 3), 'No unresolved advice loop detected.', item => `
        <div class="briefing-row"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.status)}</strong></div>
      `)}
    </div>
  `);
  setHtml('briefing-promises', `
    <div class="briefing-label">PROMISES MADE</div>
    ${renderBriefingRows(briefing.promises.made.slice(0, 4), 'No promises captured yet.', item => `
      <div class="briefing-row">
        <span>${escapeHtml(item.title)}</span>
        <strong>${escapeHtml(item.status === 'complete' ? 'DONE' : item.dueLabel)}</strong>
      </div>
    `)}
  `);
  setHtml('briefing-promises-overdue', `
    <div class="briefing-label">PROMISES OVERDUE</div>
    ${renderBriefingRows(briefing.promises.overdue.slice(0, 3), 'No overdue promises.', item => `
      <div class="briefing-row danger">
        <span>${escapeHtml(item.title)}</span>
        <strong>${escapeHtml(item.dueLabel)}</strong>
      </div>
    `)}
  `);
  setHtml('briefing-open-loops', `
    <div class="briefing-label">OPEN LOOPS</div>
    ${renderBriefingRows(briefing.openLoops.slice(0, 5), 'No open loops captured yet.', item => `
      <div class="briefing-row">
        <span>${escapeHtml(item.title)}</span>
        <strong>${escapeHtml(item.status)}</strong>
      </div>
    `)}
  `);
  setHtml('briefing-deadlines', `
    <div class="briefing-label">DEADLINES</div>
    ${renderBriefingRows(briefing.deadlines.slice(0, 4), 'No dated deadlines captured.', item => `
      <div class="briefing-row">
        <span>${escapeHtml(item.title)}</span>
        <strong>${escapeHtml(item.date)}</strong>
      </div>
    `)}
  `);
  setHtml('briefing-risk-summary', `
    <div class="briefing-label">RISK</div>
    <div class="briefing-scoreline">
      <span class="badge ${riskClass}">${escapeHtml(briefing.riskSummary.level)} Risk</span>
      <span class="badge ${readinessClass}">${escapeHtml(briefing.riskSummary.readinessStatus)}</span>
    </div>
    <div class="briefing-text">${escapeHtml(briefing.riskSummary.summary)}</div>
  `);
  setHtml('briefing-relationship-context', `
    <div class="briefing-label">RELATIONSHIP CONTEXT</div>
    <div class="briefing-scoreline"><span class="badge badge-gold">${escapeHtml(briefing.relationship.trustSignal)}</span></div>
    <div class="briefing-text">${escapeHtml(briefing.relationship.communicationStyle)}</div>
  `);
  setHtml('briefing-timeline-summary', `
    <div class="briefing-label">TIMELINE SUMMARY</div>
    <div class="briefing-text">${escapeHtml(briefing.timelineSummary.summary)}</div>
    <div class="briefing-sublist">
      ${renderBriefingRows(briefing.timelineSummary.recent.slice(0, 3), 'No timeline records captured.', item => `
        <div class="briefing-row"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.kind)}</strong></div>
      `)}
    </div>
  `);
}

function handleProfilePhotoUpload(input) {
  if (!ownershipRuntime || !ownershipRuntime.setProfilePhoto || !input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  const state = document.getElementById('profile-photo-state');
  if (!file.type || !file.type.startsWith('image/')) {
    if (state) state.textContent = 'Profile photo not saved: image file required.';
    return;
  }
  if (file.size > 1600000) {
    if (state) state.textContent = 'Profile photo not saved: local pilot limit is 1.6 MB.';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const record = ownershipRuntime.setProfilePhoto({
      studentId: activePrepStudent,
      dataUrl: reader.result,
      fileName: file.name,
      mimeType: file.type,
      size: file.size
    });
    if (record) {
      renderOwnedProfile(activePrepStudent);
      filterStudents();
      if (state) state.textContent = `Local profile photo saved for ${studentName(activePrepStudent)} · mentor/admin review only.`;
      showToast('Local profile photo saved.');
      renderPilotReadiness();
    }
  };
  reader.onerror = () => {
    if (state) state.textContent = 'Profile photo not saved: local file could not be read.';
  };
  reader.readAsDataURL(file);
}

function renderMemoryContent(studentId) {
  if (!ownershipRuntime) return;
  const bundle = ownershipRuntime.getStudentBundle(studentId);
  const container = document.getElementById('memory-content');
  if (!bundle || !bundle.student || !container) return;
  const student = bundle.student;
  const personal = bundle.personalMemory[0];
  const sensitive = bundle.sensitiveMemory[0];
  const advice = bundle.adviceMemory[0];
  const nextMove = bundle.nextMoves[0];
  const insights = ownershipRuntime.getSessionInsights(studentId);
  const relationship = insights.relationship;
  const readiness = insights.readiness;
  const risk = insights.risk;
  const promiseRows = bundle.promises.slice(0, 4).map((promise) => {
    const cls = promise.status === 'complete' ? 'badge-green' : 'badge-red';
    const bg = promise.status === 'complete' ? 'var(--green-dim)' : 'var(--red-dim)';
    return `
      <div class="flex-between" style="padding:8px 10px;border-radius:6px;background:${bg}">
        <div style="font-size:12px"><strong>${escapeHtml(promise.title)}</strong> - promised ${escapeHtml(promise.madeAt)}</div>
        <span class="badge ${cls}">${promise.status === 'complete' ? 'DONE' : 'PENDING'}</span>
      </div>
    `;
  }).join('');
  const taskRows = bundle.openTasks.slice(0, 3).map((task) => `
    <li>${escapeHtml(task.type)}: ${escapeHtml(task.title)} <strong style="color:var(--orange)">(${escapeHtml(task.dueLabel)})</strong></li>
  `).join('');
  const timeline = ownershipRuntime.getStudentTimeline(studentId).slice(0, 5).map((item) => `
    <div class="timeline-item">
      <div class="timeline-dot ${timelineDotClass(item.tone)}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${escapeHtml(item.title)}</div>
        <div class="timeline-meta">${escapeHtml(item.date)} · ${escapeHtml(item.kind)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escapeHtml(item.detail)}</div>
      </div>
    </div>
  `).join('');
  container.innerHTML = `
    <div class="card mb-md" style="border-color:rgba(232,164,28,0.3);background:linear-gradient(135deg,rgba(232,164,28,0.08),rgba(0,212,255,0.04))">
      <div class="card-header">
        <div class="card-title" style="font-size:15px;color:var(--gold)">Pre-Call Briefing: ${escapeHtml(student.name)}</div>
        <span class="badge badge-gold">MMC-Owned Memory</span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);line-height:1.7;padding:4px 0">
        <strong style="color:var(--white)">What I need to remember before this call:</strong>
        <ul style="margin:8px 0 0 18px;display:flex;flex-direction:column;gap:6px">
          ${taskRows || '<li>No open ownership tasks for this student.</li>'}
          <li>${escapeHtml(nextMove ? nextMove.content : 'Use the latest goal and task state to steer the call.')}</li>
        </ul>
      </div>
    </div>

    <div class="grid-2 gap-lg">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-header"><div class="card-title">Personal Details</div></div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-muted)">
            <div>${escapeHtml(personal ? personal.content : 'No personal context captured yet.')}</div>
          </div>
        </div>
        <div class="card" style="border-color:rgba(231,76,60,0.15)">
          <div class="card-header">
            <div class="card-title">Sensitive Context</div>
            <span class="private-marker">SENSITIVE</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-muted)">
            <div style="color:var(--orange)">${escapeHtml(sensitive ? sensitive.content : 'No sensitive context captured.')}</div>
          </div>
        </div>
        <div class="card" style="border-color:rgba(231,76,60,0.2)">
          <div class="card-header"><div class="card-title" style="color:var(--red)">Promises Made</div></div>
          <div style="display:flex;flex-direction:column;gap:8px">${promiseRows || '<div style="font-size:12px;color:var(--text-dim)">No promises captured yet.</div>'}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Last Advice Given</div>
            <span style="font-size:11px;color:var(--text-dim)">${escapeHtml(advice ? advice.createdAt : 'Local')}</span>
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.7">${escapeHtml(advice ? advice.content : 'No advice captured yet.')}</div>
        </div>
        <div class="card" style="border-color:rgba(0,212,255,0.25);background:linear-gradient(135deg,rgba(0,212,255,0.06),rgba(232,164,28,0.04))">
          <div class="card-header">
            <div class="card-title" style="color:var(--cyan)">Next Best Coaching Move</div>
            <span class="badge badge-cyan">MMC-Owned</span>
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.7">${escapeHtml(nextMove ? nextMove.content : 'Review goals, promises, and open actions before starting.')}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Relationship Context</div>
            <span class="badge badge-gold">${escapeHtml(relationship.trustSignal)}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--text-muted);line-height:1.6">
            <div><strong style="color:var(--white)">Style:</strong> ${escapeHtml(relationship.communicationStyle)}</div>
            <div><strong style="color:var(--white)">Sensitive:</strong> <span style="color:var(--orange)">${escapeHtml(relationship.sensitiveContext)}</span></div>
            <div><strong style="color:var(--white)">Open loops:</strong> ${relationship.openLoops.length ? escapeHtml(relationship.openLoops.join(' · ')) : 'No open loops captured.'}</div>
          </div>
        </div>
        <div class="card" style="border-color:rgba(232,164,28,0.25)">
          <div class="card-header">
            <div class="card-title">Readiness / Risk</div>
            <span class="badge ${badgeClassForRisk(risk.level)}">${escapeHtml(risk.level)} Risk</span>
          </div>
          <div class="grid-2 gap-md">
            <div>
              <div class="stat-label">Readiness</div>
              <div class="stat-value" style="font-size:22px;color:var(--cyan)">${escapeHtml(readiness.score)}%</div>
              <span class="badge ${badgeClassForReadiness(readiness.status)}">${escapeHtml(readiness.status)}</span>
            </div>
            <div>
              <div class="stat-label">Risk</div>
              <div class="stat-value" style="font-size:22px;color:var(--orange)">${escapeHtml(risk.score)}%</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:4px">${escapeHtml(risk.reasons.slice(0, 2).join(' · '))}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Memory Timeline</div>
            <span class="badge badge-gold">${bundle.memory.length} Items</span>
          </div>
          <div>${timeline || '<div style="font-size:12px;color:var(--text-dim)">No MMC-owned sessions captured yet.</div>'}</div>
        </div>
      </div>
    </div>
  `;
  renderMemorySearchResults();
}

function renderMemorySearchResults() {
  if (!ownershipRuntime) return;
  const input = document.getElementById('memory-search-input');
  const results = document.getElementById('memory-search-results');
  if (!results) return;
  const query = input ? input.value : '';
  const matches = ownershipRuntime.searchMemory(query, activePrepStudent).slice(0, 6);
  results.innerHTML = matches.map((item) => `
    <div class="flex-between" style="padding:8px 10px;border-radius:6px;background:rgba(255,255,255,0.03);border-left:3px solid ${item.sensitive ? 'var(--red)' : 'var(--cyan)'}">
      <div>
        <div style="font-size:12px;font-weight:600">${escapeHtml(item.type)}: ${escapeHtml(item.title)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${escapeHtml(item.detail || item.studentName)}</div>
      </div>
      <span class="badge ${item.sensitive ? 'badge-red' : 'badge-cyan'}">${escapeHtml(item.date)}</span>
    </div>
  `).join('') || '<div style="font-size:12px;color:var(--text-dim)">No local MMC-owned memory matches yet.</div>';
}

function runMemorySearch() {
  renderMemorySearchResults();
}

function renderSessionCommand(studentId) {
  if (!ownershipRuntime) return;
  const bundle = ownershipRuntime.getStudentBundle(studentId);
  if (!bundle || !bundle.student) return;
  const student = bundle.student;
  const briefing = ownershipRuntime.getStudentBriefing(student.id);
  const risk = ownershipRuntime.getRisk(student.id);
  const readiness = ownershipRuntime.getReadiness(student.id);
  const openTasks = bundle.openTasks.slice(0, 3);
  const setText = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };
  setText('session-student-name', student.name);
  setText('session-step2', student.step2 || 'TBD');
  setText('session-program', programLabels[student.program] || student.program || 'Program');
  setText('session-readiness', `${readiness.score}%`);
  setText('session-current-focus', briefing ? briefing.nextBestMove.action : 'Use MMC-owned memory and open loops to steer the call.');
  const riskBadge = document.getElementById('session-risk');
  if (riskBadge) {
    riskBadge.className = 'badge ' + badgeClassForRisk(risk.level);
    riskBadge.textContent = risk.level + ' Risk';
  }
  const sensitive = bundle.sensitiveMemory[0];
  setText('session-sensitive-context', sensitive ? sensitive.content : 'No sensitive context captured for this student.');
  const followThrough = document.getElementById('session-follow-through');
  if (followThrough) {
    followThrough.innerHTML = openTasks.map((task) => {
      const surface = surfaceForTask(task);
      const owner = task.owner === 'mentor' ? 'Brian' : student.name.split(' ')[0];
      return `<div style="padding:8px 10px;border-radius:6px;background:${surface[0]};border-left:3px solid ${surface[1]};font-size:12px"><strong>${escapeHtml(owner)}:</strong> ${escapeHtml(task.title)}</div>`;
    }).join('') || '<div style="font-size:12px;color:var(--text-dim)">No open follow-through items.</div>';
  }
}

function renderSessionItems() {
  if (!ownershipRuntime) return;
  const bundle = ownershipRuntime.getStudentBundle(activePrepStudent);
  const list = document.getElementById('session-items');
  const count = document.getElementById('session-item-count');
  if (!list || !count || !bundle) return;
  const sessionTasks = bundle.openTasks.filter(task => task.sourceSessionId).slice(0, 5);
  list.innerHTML = sessionTasks.map((task) => {
    const surface = surfaceForTask(task);
    return `<div style="padding:8px 10px;border-radius:6px;background:${surface[0]};border-left:3px solid ${surface[1]};font-size:12px"><strong>${escapeHtml(task.type)}:</strong> ${escapeHtml(task.title)}</div>`;
  }).join('') || '<div style="font-size:12px;color:var(--text-dim)">No session items captured yet.</div>';
  count.textContent = `${sessionTasks.length} Items`;
}

function renderPostSessionReview() {
  if (!ownershipRuntime) return;
  const bundle = ownershipRuntime.getStudentBundle(activePrepStudent);
  const review = document.getElementById('post-session-action-review');
  if (!bundle || !review) return;
  const actions = bundle.openTasks.slice(0, 4);
  review.innerHTML = actions.map((task) => {
    const surface = surfaceForTask(task);
    const badge = task.owner === 'student' ? 'badge-cyan' : 'badge-gold';
    return `
      <div class="flex-between" style="padding:8px 10px;border-radius:6px;background:${surface[0]};border-left:3px solid ${surface[1]}">
        <div class="flex-row" style="flex:1">
          <input class="action-checkbox" type="checkbox" checked>
          <input class="micro-input" value="${escapeHtml(task.title)}">
        </div>
        <span class="badge ${badge}">${escapeHtml(task.owner === 'student' ? 'Student' : 'Mentor')}</span>
      </div>
    `;
  }).join('');
}

function openProfile(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  activePrepStudent = id;
  document.getElementById('profile-avatar').textContent = s.initials;
  document.getElementById('profile-name').textContent = s.name;
  document.getElementById('profile-school').textContent = s.school + ' · ' + s.country;
  document.getElementById('profile-risk').textContent = s.riskLabel;
  document.getElementById('profile-risk').className = 'badge ' + s.riskClass;
  document.getElementById('profile-risk').style.cssText = 'font-size:12px;padding:6px 14px';
  document.getElementById('profile-badges').innerHTML =
    '<span class="badge badge-' + (s.program==='usce'?'gold':s.program==='match'?'cyan':'green') + '">' + programLabels[s.program] + '</span>' +
    '<span class="badge badge-cyan">' + sessionLabels[s.session] + '</span>' +
    '<span class="badge badge-green">' + s.specialty + '</span>';
  renderOwnedProfile(id);
  switchScreen('profile');
}

function openCallPrep(id) {
  activePrepStudent = id || activePrepStudent || 'amara';
  renderMemoryContent(activePrepStudent);
  renderMemorySearchResults();
  switchScreen('memory');
}

function startSessionCommand() {
  if (ownershipRuntime) {
    ownershipRuntime.startSession(activePrepStudent);
    renderSessionCommand(activePrepStudent);
    renderSessionItems();
    renderPilotReadiness();
  }
  switchScreen('sessioncmd');
}

function endSessionCommand() {
  const notes = document.getElementById('session-notes');
  const summary = document.getElementById('post-session-summary');
  if (notes && summary) summary.value = notes.value;
  if (ownershipRuntime) {
    ownershipRuntime.endSession(notes ? notes.value : '');
    renderPostSessionReview();
    renderPilotReadiness();
  }
  switchScreen('postsession');
}

function savePostSession() {
  if (ownershipRuntime) {
    const summary = document.getElementById('post-session-summary');
    const visibility = document.getElementById('student-visibility-toggle');
    const privateNotes = document.getElementById('post-session-private-notes');
    ownershipRuntime.savePostSession({
      summary: summary ? summary.value : '',
      privateNotes: privateNotes ? privateNotes.value.trim() : '',
      studentVisible: visibility ? visibility.checked : false
    });
    renderOwnedActions();
    renderMemoryContent(activePrepStudent);
    renderPilotReadiness();
  }
  showToast('Post-session capture saved. Returning to Today.');
  switchScreen('dashboard');
  const alerts = document.querySelector('#screen-dashboard .card[style*="rgba(232,164,28,0.3)"]');
  if (alerts) {
    alerts.style.borderColor = 'rgba(46,204,113,0.35)';
  }
}

function completeAction(checkbox) {
  const row = checkbox.closest('.action-row');
  if (!row) return;
  if (ownershipRuntime && row.dataset.taskId) {
    ownershipRuntime.completeTask(row.dataset.taskId, checkbox.checked);
  }
  row.classList.toggle('completed', checkbox.checked);
  const state = document.getElementById('action-save-state');
  if (state) state.textContent = checkbox.checked ? 'Action completed in MMC ownership layer.' : 'Action reopened in MMC ownership layer.';
  updateOwnershipStats();
  renderPilotReadiness();
}

function addSessionItem(type) {
  if (ownershipRuntime) {
    ownershipRuntime.addSessionItem({
      studentId: activePrepStudent,
      type,
      content: type + ' captured during the live session'
    });
    renderSessionItems();
    renderOwnedActions();
    renderMemoryContent(activePrepStudent);
    renderSessionCommand(activePrepStudent);
  } else {
    sessionItemCounter += 1;
    const list = document.getElementById('session-items');
    const count = document.getElementById('session-item-count');
    if (!list || !count) return;
    const color = type === 'Promise' ? 'gold' : type === 'Flag' ? 'red' : type === 'Memory' ? 'orange' : 'cyan';
    const div = document.createElement('div');
    div.setAttribute('style','padding:8px 10px;border-radius:6px;background:var(--' + color + '-dim);border-left:3px solid var(--' + color + ');font-size:12px');
    div.innerHTML = '<strong>' + type + ':</strong> Captured during the live session';
    list.appendChild(div);
    count.textContent = sessionItemCounter + ' Items';
  }
  const saveState = document.getElementById('session-save-state');
  if (saveState) saveState.textContent = ownershipRuntime ? 'Saved to MMC ownership' : 'Saved in demo';
  renderPilotReadiness();
}

function setQuickCaptureType(el, type) {
  document.querySelectorAll('#quick-capture-overlay .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  quickCaptureType = type;
}

function openQuickCapture() {
  const overlay = document.getElementById('quick-capture-overlay');
  if (overlay) overlay.classList.add('open');
  const textarea = document.getElementById('quick-capture-content');
  if (textarea) textarea.focus();
}

function closeQuickCapture() {
  const overlay = document.getElementById('quick-capture-overlay');
  if (overlay) overlay.classList.remove('open');
}

function saveQuickCapture() {
  const studentSelect = document.getElementById('quick-capture-student');
  const content = document.getElementById('quick-capture-content');
  const state = document.getElementById('quick-capture-state');
  const student = students.find(s => s.id === (studentSelect ? studentSelect.value : activePrepStudent)) || students[0];
  const text = content && content.value.trim() ? content.value.trim() : 'Prototype capture saved';
  if (ownershipRuntime) {
    ownershipRuntime.quickCapture({
      studentId: student.id,
      type: quickCaptureType,
      content: text
    });
    renderOwnedActions();
    if (student.id === activePrepStudent) {
      renderOwnedProfile(activePrepStudent);
      renderMemoryContent(activePrepStudent);
      renderSessionItems();
      renderMemorySearchResults();
    }
    renderPilotReadiness();
  }
  if (state) state.textContent = quickCaptureType + ' saved for ' + student.name + '.';
  closeQuickCapture();
  showToast('Quick Capture saved for ' + student.name + '.');
  if (content) content.value = '';
}

function saveProfileCapture() {
  const input = document.getElementById('profile-workflow-input');
  const state = document.getElementById('profile-capture-state');
  const text = input && input.value.trim() ? input.value.trim() : 'Profile note saved';
  if (ownershipRuntime) {
    ownershipRuntime.quickCapture({
      studentId: activePrepStudent,
      type: 'Note',
      content: text
    });
    renderOwnedProfile(activePrepStudent);
    renderMemoryContent(activePrepStudent);
    renderMemorySearchResults();
    renderPilotReadiness();
  }
  if (state) state.textContent = 'Saved: ' + text;
  showToast('Profile capture saved.');
  if (input) input.value = '';
}

function saveProfileGoal() {
  const input = document.getElementById('profile-workflow-input');
  const state = document.getElementById('profile-capture-state');
  const text = input && input.value.trim() ? input.value.trim() : 'New coaching goal captured';
  if (ownershipRuntime && ownershipRuntime.createGoal) {
    ownershipRuntime.createGoal({
      studentId: activePrepStudent,
      title: text,
      milestone: 'Captured from Student Intelligence Profile workflow',
      progress: 0,
      velocity: 'Needs mentor definition',
      readinessInputs: ['mentor-defined goal', 'follow-up milestone needed', 'MMC-owned goal']
    });
    renderOwnedProfile(activePrepStudent);
    renderMemoryContent(activePrepStudent);
    renderMemorySearchResults();
    renderPilotReadiness();
  }
  if (state) state.textContent = 'Goal saved: ' + text;
  showToast('Goal saved to MMC ownership.');
  if (input) input.value = '';
}

function showToast(message) {
  const toast = document.getElementById('saved-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

// =============================================
// MEMORY ENGINE STUDENT SELECT
// =============================================
function selectMemoryStudent(el, id) {
  document.querySelectorAll('#screen-memory .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activePrepStudent = id;
  renderMemoryContent(id);
  renderMemorySearchResults();
}

// =============================================
// INIT
// =============================================
window.MMC_DEMO_PARITY = {
  authority: 'MMC-005A_OS_PATCHED_FROM_003.html',
  source: 'ported-from-approved-demo',
  approvedBaseline: 'MMC-008B',
  integrationLayer: 'MMC-010 reality hydration guard',
  ownershipLayer: ownershipRuntime ? 'MMC-021 mmc.* persistence ownership intelligence' : 'not-loaded',
  mentorIntelligenceLayer: ownershipRuntime ? 'MMC-016 Student Briefing Engine backed by MMC-021 persistence' : 'not-loaded',
  productionDependencies: false,
  backend: ownershipRuntime ? 'same-origin MMC persistence only' : false,
  apiCalls: ownershipRuntime ? 'same-origin /api/mmc/persistence only' : false,
  adapterMode: mmcRuntime ? mmcRuntime.mode : 'not-loaded'
};

window.MMC_MENTOR_INTELLIGENCE = {
  authority: 'MMC-016',
  status: ownershipRuntime ? 'MENTOR_INTELLIGENCE_READY' : 'not-loaded',
  source: 'mmc-owned-local-only',
  engines: [
    'Student Briefing Engine',
    'Open Loop Detector',
    'Promise Engine',
    'Advice History Engine',
    'Relationship Context Engine',
    'Timeline Summarizer',
    'Risk Summary Engine',
    'Next Best Move Engine'
  ],
  profilePhotoSupport: 'local-internal-pilot-only',
  profilePhotoSource: 'local MMC profile photo',
  profilePhotoVisibility: 'mentor/admin review only for now',
  productionPhotoUpload: false,
  productionPhotoStorage: 'future unresolved',
  studentPhotoUploadPublic: false,
  productionDependencies: false,
  apiCalls: ownershipRuntime ? 'same-origin /api/mmc/persistence only' : false,
  externalRequestsEnabled: false,
  externalWritesEnabled: false
};

window.MMC_PRIVATE_ALPHA = {
  authority: 'MMC-MEGARUN-100',
  status: ownershipRuntime ? 'PRIVATE_ALPHA_LAUNCH_READY_CANDIDATE' : 'not-loaded',
  persistence: ownershipRuntime ? 'same-origin /api/mmc/persistence' : false,
  localStorageFallback: false,
  productionHydration: false,
  sessionRecovery: true,
  snapshotExport: true,
  mentorBootstrap: true,
  assignmentManagement: 'MMC-owned assignment model only',
  forbiddenIntegrations: ['Webex', 'transcripts', 'StoryForge', 'Drills', 'Arena', 'private object storage', 'Scheduler mutation', 'Calendar mutation', 'privileged DB runtime keys']
};

window.MMCApp = {
  switchScreen,
  openProfile,
  openCallPrep,
  startSessionCommand,
  endSessionCommand,
  savePostSession,
  openQuickCapture,
  closeQuickCapture,
  saveQuickCapture,
  runMemorySearch,
  recoverSession,
  exportPilotSnapshot,
  renderPilotReadiness,
  validateNoExternalIntegrations() {
    return {
      productionDependencies: false,
      backend: ownershipRuntime ? 'same-origin MMC persistence only' : false,
      apiCalls: ownershipRuntime ? 'same-origin /api/mmc/persistence only' : false,
      productionHydration: false,
      externalProductionRequests: false,
      capturedRequests: [],
      adapter: mmcRuntime ? mmcRuntime.validationSummary() : null,
      ownership: ownershipRuntime ? ownershipRuntime.validationSummary() : null
    };
  },
  hydratePersistence() {
    return ownershipHydrationPromise;
  },
  flushPersistence: flushOwnershipPersistence,
  getRealityRuntime() {
    return mmcRuntime ? mmcRuntime.validationSummary() : null;
  },
  getOwnershipRuntime() {
    return ownershipRuntime ? ownershipRuntime.validationSummary() : null;
  },
  validatePrivateAlphaLaunch() {
    const requiredScreens = [
      'screen-dashboard',
      'screen-actions',
      'screen-directory',
      'screen-profile',
      'screen-memory',
      'screen-sessioncmd',
      'screen-postsession',
      'screen-studentview'
    ];
    const requiredHooks = [
      'pilot-readiness-panel',
      'pilot-persistence-state',
      'pilot-assignment-state',
      'pilot-session-recovery-state',
      'pilot-export-state',
      'actions-list',
      'student-briefing-card',
      'session-items',
      'post-session-action-review'
    ];
    const summary = ownershipRuntime ? ownershipRuntime.validationSummary() : null;
    return {
      status: summary && summary.launchReadiness ? summary.launchReadiness.status : 'not-loaded',
      requiredScreensPresent: requiredScreens.every(id => Boolean(document.getElementById(id))),
      requiredHooksPresent: requiredHooks.every(id => Boolean(document.getElementById(id))),
      persistenceStatus: summary ? summary.persistence.status : 'not-loaded',
      localStorageFallbackEnabled: summary ? summary.localStorageFallbackEnabled : null,
      assignedStudents: summary ? summary.stats.assignedStudents : 0,
      externalRequestsEnabled: false,
      productionHydration: false,
      snapshotExport: Boolean(ownershipRuntime && ownershipRuntime.exportPilotSnapshot),
      sessionRecovery: Boolean(ownershipRuntime && ownershipRuntime.recoverLatestSession)
    };
  },
  getStudentBriefing(studentId) {
    return ownershipRuntime ? ownershipRuntime.getStudentBriefing(studentId || activePrepStudent) : null;
  },
  getProfilePhoto(studentId) {
    return getProfilePhoto(studentId || activePrepStudent);
  },
  handleProfilePhotoUpload,
  saveProfileGoal,
  renderOwnedActions,
  renderMemoryContent,
  renderMemorySearchResults,
  renderOwnedProfile,
  renderSessionCommand,
  renderStudentBriefing
};

if (ownershipRuntime) {
  renderOwnedActions();
  renderOwnedProfile(activePrepStudent);
  renderMemoryContent(activePrepStudent);
  renderMemorySearchResults();
  renderSessionItems();
  renderPostSessionReview();
  renderPilotReadiness();
}

renderStudentTable(students);
