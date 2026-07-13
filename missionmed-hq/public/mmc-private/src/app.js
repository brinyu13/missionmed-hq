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
const sessionLabels = {spring2026:'Spring 2026',summer2026:'Summer 2026',fall2026:'Fall 2026',private:'Private Review'};
const statusColors = {Active:'badge-green','At Risk':'badge-red',Onboarding:'badge-cyan'};
let activePrepStudent = 'amara';
let quickCaptureType = 'Note';
let sessionItemCounter = 1;
let activeMeetingStudent = 'amara';
let activeMeetingSessionId = null;

const MMC_PIPELINE_ENDPOINT = '/api/mmc/coaching-pipeline';
const MMC_PIPELINE_DEFAULT_CATEGORY = 'Live Session';
const MMC_WEBEX_TRIGGER_KEY = 'mmc.private.webexAllowedTriggers.mentor-brian.v1';
const MMC_WEBEX_DEFAULT_TRIGGERS = '[MM-ADV]';
const pipelineAdminState = {
  initialized: false,
  loading: false,
  working: false,
  error: null,
  status: null,
  workerStatus: null,
  workerScan: null,
  webexStatus: null,
  webexInventory: null,
  webexAllowedTriggers: readLocalPreference(MMC_WEBEX_TRIGGER_KEY, MMC_WEBEX_DEFAULT_TRIGGERS),
  rosterVerificationSources: [],
  rosterVerification: null,
  resolutionReviewQueue: [],
  inventory: [],
  sourceAssets: [],
  search: '',
  selectedAssetId: null,
  selectedStudentId: '',
  manualStudentId: '',
  manualStudentName: '',
  rosterEvidenceJson: '',
  selectedSessionId: '',
  workerMinStableAgeMs: 0,
  lastResult: null
};

const MMC_DENSITY_KEY = 'mmc.private.displayDensity.mentor-brian.v1';
const MMC_PROFILE_DETAIL_KEY = 'mmc.private.profileDetails.mentor-brian.v1';
let mmcDisplayDensity = readLocalPreference(MMC_DENSITY_KEY, 'compact');
let profileDetailsExpanded = readLocalPreference(MMC_PROFILE_DETAIL_KEY, 'collapsed') === 'expanded';

function readLocalPreference(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const value = localStorage.getItem(key);
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeLocalPreference(key, value) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch (error) {
    // Preference writes are best-effort only; MMC must remain usable without localStorage.
  }
}

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
  if (student) return student.name;
  const bundle = ownershipRuntime && ownershipRuntime.getStudentBundle ? ownershipRuntime.getStudentBundle(studentId) : null;
  return bundle && bundle.student ? bundle.student.name : 'Student';
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

function applyDensityMode() {
  document.documentElement.dataset.mmcDensityMode = mmcDisplayDensity;
  document.body.classList.toggle('mmc-density-full', mmcDisplayDensity === 'full');
  document.body.classList.toggle('mmc-density-compact', mmcDisplayDensity !== 'full');
  const toggle = document.getElementById('density-mode-toggle');
  if (toggle) {
    toggle.textContent = mmcDisplayDensity === 'full' ? 'Full View' : 'Compact';
    toggle.setAttribute('aria-pressed', String(mmcDisplayDensity === 'full'));
  }
  applyProfileSecondaryState();
}

function toggleDensityMode() {
  mmcDisplayDensity = mmcDisplayDensity === 'full' ? 'compact' : 'full';
  writeLocalPreference(MMC_DENSITY_KEY, mmcDisplayDensity);
  applyDensityMode();
  showToast(mmcDisplayDensity === 'full' ? 'Full profile detail enabled.' : 'Compact mentor mode enabled.');
}

function toggleSystemStatus() {
  const popover = document.getElementById('pilot-readiness-panel');
  const toggle = document.getElementById('system-status-toggle');
  if (!popover || !toggle) return;
  const isOpen = popover.classList.toggle('open');
  popover.setAttribute('aria-hidden', String(!isOpen));
  toggle.setAttribute('aria-expanded', String(isOpen));
  renderPilotReadiness();
}

function applyProfileSecondaryState() {
  const expanded = mmcDisplayDensity === 'full' || profileDetailsExpanded;
  const detail = document.getElementById('profile-secondary-detail');
  const context = document.getElementById('profile-briefing-context-group');
  [detail, context].forEach((node) => {
    if (!node) return;
    node.classList.toggle('is-collapsed', !expanded);
    node.classList.toggle('is-expanded', expanded);
  });
  document.querySelectorAll('[data-testid="profile-secondary-toggle"], [data-testid="profile-context-toggle"]').forEach((button) => {
    button.textContent = expanded ? 'Collapse Details' : 'Expand Details';
    button.setAttribute('aria-expanded', String(expanded));
  });
}

function toggleProfileSecondarySections() {
  profileDetailsExpanded = !(mmcDisplayDensity === 'full' || profileDetailsExpanded);
  if (mmcDisplayDensity === 'full' && !profileDetailsExpanded) {
    mmcDisplayDensity = 'compact';
    writeLocalPreference(MMC_DENSITY_KEY, mmcDisplayDensity);
  }
  writeLocalPreference(MMC_PROFILE_DETAIL_KEY, profileDetailsExpanded ? 'expanded' : 'collapsed');
  applyDensityMode();
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
  renderMeetingIntelligence(activeMeetingStudent || activePrepStudent);
  filterStudents();
  updateOwnershipStats();
  renderPilotReadiness();
  applyDensityMode();
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

async function pipelineFetch(path, options) {
  const csrfToken = ownershipRuntime && ownershipRuntime.validationSummary
    ? ownershipRuntime.validationSummary().persistence.csrfToken
    : '';
  const response = await fetch(MMC_PIPELINE_ENDPOINT + path, {
    method: options && options.method ? options.method : 'GET',
    credentials: 'same-origin',
    headers: Object.assign({
      Accept: 'application/json'
    }, options && options.body ? { 'Content-Type': 'application/json' } : {},
    csrfToken ? { 'X-MMHQ-CSRF': csrfToken } : {}),
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(payload && payload.message ? payload.message : 'MMC coaching pipeline request failed.');
  }
  return payload;
}

async function refreshPipelineAdmin() {
  if (pipelineAdminState.loading) return;
  pipelineAdminState.loading = true;
  pipelineAdminState.error = null;
  renderPipelineAdmin();
  try {
    const triggerQuery = encodeURIComponent(pipelineAdminState.webexAllowedTriggers || MMC_WEBEX_DEFAULT_TRIGGERS);
    const [status, inventory, assets, workerStatus, workerScan, webexStatus, webexInventory, reviewQueue, rosterSources] = await Promise.all([
      pipelineFetch('/status'),
      pipelineFetch('/inventory?category=' + encodeURIComponent(MMC_PIPELINE_DEFAULT_CATEGORY) + '&limit=25'),
      pipelineFetch('/source-assets'),
      pipelineFetch('/worker/status'),
      pipelineFetch('/worker/scan?limit=12&include_incomplete=1&min_stable_age_ms=' + encodeURIComponent(pipelineAdminState.workerMinStableAgeMs || 0)),
      pipelineFetch('/webex/status'),
      pipelineFetch('/webex/recordings?limit=25&allowed_triggers=' + triggerQuery),
      pipelineFetch('/student-resolution/review-queue'),
      pipelineFetch('/roster-verification/sources')
    ]);
    pipelineAdminState.status = status;
    pipelineAdminState.workerStatus = workerStatus;
    pipelineAdminState.workerScan = workerScan;
    pipelineAdminState.webexStatus = webexStatus;
    pipelineAdminState.webexInventory = webexInventory;
    pipelineAdminState.rosterVerificationSources = Array.isArray(rosterSources.sources) ? rosterSources.sources : [];
    pipelineAdminState.resolutionReviewQueue = Array.isArray(reviewQueue.data) ? reviewQueue.data : [];
    pipelineAdminState.inventory = Array.isArray(inventory.candidates) ? inventory.candidates : [];
    pipelineAdminState.sourceAssets = Array.isArray(assets.data) ? assets.data : [];
    pipelineAdminState.initialized = true;
    if (!pipelineAdminState.selectedAssetId && pipelineAdminState.sourceAssets[0]) {
      pipelineAdminState.selectedAssetId = pipelineAdminState.sourceAssets[0].id;
    }
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Pipeline Admin is unavailable.';
  } finally {
    pipelineAdminState.loading = false;
    renderPipelineAdmin();
  }
}

async function importCoachingDropZoneCandidates() {
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = null;
  renderPipelineAdmin();
  try {
    const result = await pipelineFetch('/worker/import', {
      method: 'POST',
      body: {
        limit: 25,
        minStableAgeMs: pipelineAdminState.workerMinStableAgeMs || 0
      }
    });
    const imported = result.imported ? result.imported.length : 0;
    const updated = result.updated ? result.updated.length : 0;
    const review = result.reviewQueue ? result.reviewQueue.length : 0;
    pipelineAdminState.lastResult = `Coaching worker imported ${imported}, updated ${updated}, review queue ${review}.`;
    await refreshPipelineAdmin();
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Coaching drop-zone import failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

function setPipelineWebexAllowedTriggers(value) {
  const normalized = value || MMC_WEBEX_DEFAULT_TRIGGERS;
  pipelineAdminState.webexAllowedTriggers = normalized;
  writeLocalPreference(MMC_WEBEX_TRIGGER_KEY, normalized);
}

async function refreshWebexRecordings() {
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = null;
  renderPipelineAdmin();
  try {
    const triggerQuery = encodeURIComponent(pipelineAdminState.webexAllowedTriggers || MMC_WEBEX_DEFAULT_TRIGGERS);
    const result = await pipelineFetch('/webex/recordings?limit=25&allowed_triggers=' + triggerQuery);
    pipelineAdminState.webexInventory = result;
    const allowed = Array.isArray(result.allowed) ? result.allowed.length : 0;
    const ignored = Array.isArray(result.ignored) ? result.ignored.length : 0;
    pipelineAdminState.lastResult = `Webex inventory refreshed: ${allowed} allowed, ${ignored} ignored.`;
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Webex inventory refresh failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

async function pullTriggeredWebexRecordings() {
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = null;
  renderPipelineAdmin();
  try {
    const result = await pipelineFetch('/webex/pull', {
      method: 'POST',
      body: {
        allowedTriggers: pipelineAdminState.webexAllowedTriggers || MMC_WEBEX_DEFAULT_TRIGGERS,
        limit: 5
      }
    });
    const staged = Array.isArray(result.staged) ? result.staged.length : 0;
    const ignored = Array.isArray(result.ignored) ? result.ignored.length : 0;
    const imported = result.workerImport && Array.isArray(result.workerImport.imported) ? result.workerImport.imported.length : 0;
    const updated = result.workerImport && Array.isArray(result.workerImport.updated) ? result.workerImport.updated.length : 0;
    pipelineAdminState.lastResult = `Webex trigger pull staged ${staged}, ignored ${ignored}, worker imported ${imported}, updated ${updated}.`;
    await refreshPipelineAdmin();
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Webex trigger pull failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

async function importPipelineCandidates() {
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = null;
  renderPipelineAdmin();
  try {
    const result = await pipelineFetch('/source-assets/import', {
      method: 'POST',
      body: {
        category: MMC_PIPELINE_DEFAULT_CATEGORY,
        limit: 25
      }
    });
    pipelineAdminState.lastResult = `Imported ${result.imported ? result.imported.length : 0}; skipped ${result.skipped ? result.skipped.length : 0}.`;
    await refreshPipelineAdmin();
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Source asset import failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

function selectPipelineAsset(assetId) {
  pipelineAdminState.selectedAssetId = assetId;
  renderPipelineAdmin();
}

function setPipelineAssetSearch(value) {
  pipelineAdminState.search = value || '';
  renderPipelineAdmin();
}

function setPipelineStudent(value) {
  pipelineAdminState.selectedStudentId = value || '';
  if (pipelineAdminState.selectedStudentId) {
    activeMeetingStudent = pipelineAdminState.selectedStudentId;
    activePrepStudent = pipelineAdminState.selectedStudentId;
  }
  pipelineAdminState.selectedSessionId = '';
  if (pipelineAdminState.selectedStudentId) renderMeetingIntelligence(activeMeetingStudent);
  else renderPipelineAdmin();
}

function setPipelineSession(value) {
  pipelineAdminState.selectedSessionId = value || '';
  renderPipelineAdmin();
}

function setPipelineManualStudentId(value) {
  pipelineAdminState.manualStudentId = value || '';
  renderPipelineAdmin();
}

function setPipelineManualStudentName(value) {
  pipelineAdminState.manualStudentName = value || '';
  renderPipelineAdmin();
}

function setPipelineRosterEvidenceJson(value) {
  pipelineAdminState.rosterEvidenceJson = value || '';
  renderPipelineAdmin();
}

function selectedPipelineAsset() {
  return pipelineAdminState.sourceAssets.find((asset) => asset.id === pipelineAdminState.selectedAssetId) || null;
}

function pipelineAssetMatches(asset, query) {
  if (!query) return true;
  const haystack = [
    asset.asset_title,
    asset.source_id,
    asset.source_system,
    asset.media_url,
    asset.transcript_pointer,
    asset.asset_status,
    asset.review_status,
    asset.metadata && asset.metadata.student_resolution && asset.metadata.student_resolution.status,
    asset.metadata && asset.metadata.roster_verification && asset.metadata.roster_verification.status,
    asset.metadata && asset.metadata.roster_verification && asset.metadata.roster_verification.studentName,
    asset.metadata && asset.metadata.roster_verification && asset.metadata.roster_verification.studentId,
    asset.metadata && asset.metadata.student_resolution && asset.metadata.student_resolution.student && asset.metadata.student_resolution.student.suggested && asset.metadata.student_resolution.student.suggested.studentName,
    asset.metadata && asset.metadata.student_resolution && asset.metadata.student_resolution.student && asset.metadata.student_resolution.student.suggested && asset.metadata.student_resolution.student.suggested.studentId
  ].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function getPipelineSessionOptions(studentId) {
  const records = buildMeetingRecords(studentId);
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    dateLabel: record.dateLabel
  }));
}

function getAssetResolution(asset) {
  return asset && asset.metadata && asset.metadata.student_resolution ? asset.metadata.student_resolution : null;
}

function getAssetRosterVerification(asset) {
  return asset && asset.metadata && asset.metadata.roster_verification ? asset.metadata.roster_verification : null;
}

function getResolutionSuggestedStudent(asset) {
  const resolution = getAssetResolution(asset);
  return resolution && resolution.student && resolution.student.suggested ? resolution.student.suggested : null;
}

function selectedPipelineStudentTarget() {
  const manualId = (pipelineAdminState.manualStudentId || '').trim();
  const manualName = (pipelineAdminState.manualStudentName || '').trim();
  const selectedId = (pipelineAdminState.selectedStudentId || '').trim();
  if (manualId) {
    return {
      id: manualId,
      name: manualName || manualId.replace(/[_:.-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
      source: 'manual-review'
    };
  }
  if (selectedId) {
    const selected = students.find((item) => item.id === selectedId);
    return {
      id: selectedId,
      name: selected ? selected.name : selectedId,
      source: selected ? 'approved-roster-selection' : 'manual-review'
    };
  }
  return null;
}

function parsePipelineRosterEvidence() {
  const raw = (pipelineAdminState.rosterEvidenceJson || '').trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function resolveSelectedRosterVerification() {
  const asset = selectedPipelineAsset();
  const student = selectedPipelineStudentTarget();
  if (!asset || !student) {
    pipelineAdminState.error = 'Select a source asset and reviewed student target before verifying roster identity.';
    renderPipelineAdmin();
    return;
  }
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = 'Checking production-safe roster evidence...';
  renderPipelineAdmin();
  try {
    const result = await pipelineFetch('/roster-verification/resolve', {
      method: 'POST',
      body: {
        sourceAssetId: asset.id,
        studentId: student.id,
        studentName: student.name,
        sourceEvidence: parsePipelineRosterEvidence()
      }
    });
    pipelineAdminState.rosterVerification = result.verification || null;
    pipelineAdminState.lastResult = `Roster ${result.review.status || 'UNVERIFIED'} · ${Math.round(Number(result.review.confidence || 0) * 100)}% · ${result.review.strongAnchors || 0} strong anchor(s).`;
    await refreshPipelineAdmin();
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Roster verification failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

async function approveSelectedRosterBridge() {
  const asset = selectedPipelineAsset();
  const student = selectedPipelineStudentTarget();
  if (!asset || !student) {
    pipelineAdminState.error = 'Select a source asset and reviewed student target before approving roster bridge.';
    renderPipelineAdmin();
    return;
  }
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = 'Approving verified MMC roster bridge...';
  renderPipelineAdmin();
  try {
    const result = await pipelineFetch('/roster-verification/approve', {
      method: 'POST',
      body: {
        sourceAssetId: asset.id,
        studentId: student.id,
        studentName: student.name,
        sourceEvidence: parsePipelineRosterEvidence()
      }
    });
    pipelineAdminState.rosterVerification = result.verification || null;
    pipelineAdminState.manualStudentId = result.data && result.data.subject ? result.data.subject.studentId : student.id;
    pipelineAdminState.manualStudentName = result.data && result.data.subject ? result.data.subject.studentName : student.name;
    pipelineAdminState.lastResult = `Verified roster bridge approved for ${pipelineAdminState.manualStudentName}.`;
    if (ownershipRuntime && ownershipRuntime.hydratePersistence) {
      await ownershipRuntime.hydratePersistence();
      students = ownershipRuntime.hydrateDirectory(students);
      refreshOwnershipViews();
    }
    await refreshPipelineAdmin();
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Roster bridge approval failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

async function resolveSelectedPipelineAsset() {
  const asset = selectedPipelineAsset();
  if (!asset) {
    pipelineAdminState.error = 'Select a source asset before running student resolution.';
    renderPipelineAdmin();
    return;
  }
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = 'Resolving student evidence...';
  renderPipelineAdmin();
  try {
    const result = await pipelineFetch('/student-resolution/resolve', {
      method: 'POST',
      body: { sourceAssetId: asset.id }
    });
    const review = result.review || {};
    pipelineAdminState.lastResult = `Resolution ${review.status || 'UNVERIFIED'} · confidence ${Math.round(Number(review.confidence || 0) * 100)}% · ${review.suggestedStudentName || review.suggestedStudentId || 'review required'}.`;
    if (review.suggestedStudentId && !pipelineAdminState.manualStudentId) {
      pipelineAdminState.manualStudentId = review.suggestedStudentId;
      pipelineAdminState.manualStudentName = review.suggestedStudentName || review.suggestedStudentId;
    }
    await refreshPipelineAdmin();
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Student resolution failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

function useSuggestedPipelineStudent() {
  const suggestion = getResolutionSuggestedStudent(selectedPipelineAsset());
  if (!suggestion || !suggestion.studentId) {
    pipelineAdminState.error = 'No suggested student is available for the selected source asset.';
    renderPipelineAdmin();
    return;
  }
  pipelineAdminState.manualStudentId = suggestion.studentId;
  pipelineAdminState.manualStudentName = suggestion.studentName || suggestion.studentId;
  pipelineAdminState.lastResult = `Prepared reviewed target ${pipelineAdminState.manualStudentName}. Approve only after evidence review.`;
  renderPipelineAdmin();
}

async function runPipelineAnalysis() {
  const asset = selectedPipelineAsset();
  const student = selectedPipelineStudentTarget();
  if (!asset || !student) {
    pipelineAdminState.error = 'Select an imported source asset and a reviewed student target before running real analysis.';
    renderPipelineAdmin();
    return;
  }
  const sessionOptions = getPipelineSessionOptions(student.id);
  const selectedSession = sessionOptions.find((session) => session.id === pipelineAdminState.selectedSessionId) || null;
  pipelineAdminState.working = true;
  pipelineAdminState.error = null;
  pipelineAdminState.lastResult = 'Attaching source asset...';
  renderPipelineAdmin();
  try {
    const attach = await pipelineFetch('/student-resolution/approve', {
      method: 'POST',
      body: {
        sourceAssetId: asset.id,
        studentId: student.id,
        studentName: student.name,
        sessionLocalId: selectedSession ? selectedSession.id : '',
        sessionTitle: selectedSession ? selectedSession.title : asset.asset_title
      }
    });
    const analysisRunId = attach && attach.data && attach.data.analysisRun ? attach.data.analysisRun.id : null;
    if (!analysisRunId) {
      throw new Error('Pipeline attach did not return an analysis run id.');
    }
    pipelineAdminState.lastResult = 'Running real structured analysis from transcript...';
    renderPipelineAdmin();
    const analysis = await pipelineFetch('/analysis-runs/analyze', {
      method: 'POST',
      body: { analysisRunId }
    });
    pipelineAdminState.lastResult = `Real analysis persisted ${analysis.persisted ? analysis.persisted.sessionArtifacts : 0} artifact(s), ${analysis.persisted ? analysis.persisted.intelligenceSnapshots : 0} snapshot(s), and ${analysis.persisted ? analysis.persisted.mentorMemory : 0} memory item(s).`;
    if (ownershipRuntime && ownershipRuntime.hydratePersistence) {
      await ownershipRuntime.hydratePersistence();
      students = ownershipRuntime.hydrateDirectory(students);
    }
    const sessionLocalId = attach.data.session && attach.data.session.localId ? attach.data.session.localId : pipelineAdminState.selectedSessionId;
    activeMeetingStudent = student.id;
    activePrepStudent = student.id;
    activeMeetingSessionId = sessionLocalId || null;
    refreshOwnershipViews();
    renderMeetingIntelligence(student.id, activeMeetingSessionId);
    showToast('Real meeting analysis saved to Meeting Intelligence.');
  } catch (error) {
    pipelineAdminState.error = error instanceof Error ? error.message : 'Real analysis failed.';
  } finally {
    pipelineAdminState.working = false;
    renderPipelineAdmin();
  }
}

function runPipelineMockAnalysis() {
  return runPipelineAnalysis();
}

function renderPipelineAdmin() {
  const root = document.getElementById('pipeline-admin-root');
  if (!root) return;

  if (!pipelineAdminState.initialized && !pipelineAdminState.loading && !pipelineAdminState.error) {
    refreshPipelineAdmin();
  }

  const currentStudentId = pipelineAdminState.selectedStudentId || pipelineAdminState.manualStudentId || activeMeetingStudent || activePrepStudent;
  const query = pipelineAdminState.search || '';
  const filteredAssets = pipelineAdminState.sourceAssets
    .filter((asset) => pipelineAssetMatches(asset, query))
    .slice(0, 12);
  const selectedAssetRecord = selectedPipelineAsset();
  const selectedResolution = getAssetResolution(selectedAssetRecord);
  const selectedRosterVerification = getAssetRosterVerification(selectedAssetRecord) || pipelineAdminState.rosterVerification;
  const selectedReview = selectedAssetRecord && selectedAssetRecord.metadata ? selectedAssetRecord.metadata.student_resolution_review : null;
  const selectedSuggestion = getResolutionSuggestedStudent(selectedAssetRecord);
  const selectedResolutionReasons = selectedResolution && selectedResolution.review && Array.isArray(selectedResolution.review.reasons)
    ? selectedResolution.review.reasons.slice(0, 4)
    : [];
  const selectedResolutionEvidence = selectedResolution && selectedResolution.student && Array.isArray(selectedResolution.student.evidence)
    ? selectedResolution.student.evidence.slice(0, 4)
    : [];
  const selectedTarget = selectedPipelineStudentTarget();
  const sessionOptions = getPipelineSessionOptions(currentStudentId);
  const studentOptions = [
    `<option value="" ${pipelineAdminState.selectedStudentId ? '' : 'selected'}>No roster student selected</option>`,
    ...students.map((student) => `
      <option value="${escapeHtml(student.id)}" ${student.id === pipelineAdminState.selectedStudentId ? 'selected' : ''}>${escapeHtml(student.name)}</option>
    `)
  ].join('');
  const sessionOptionMarkup = [
    `<option value="" ${pipelineAdminState.selectedSessionId ? '' : 'selected'}>Create pipeline review session from selected asset</option>`,
    ...sessionOptions.map((session) => `
      <option value="${escapeHtml(session.id)}" ${session.id === pipelineAdminState.selectedSessionId ? 'selected' : ''}>${escapeHtml(session.title)} · ${escapeHtml(session.dateLabel)}</option>
    `)
  ].join('');
  const inventoryCount = pipelineAdminState.inventory.length;
  const statusBadge = pipelineAdminState.status && pipelineAdminState.status.principalRole === 'admin'
    ? '<span class="badge badge-green">Admin Private</span>'
    : '<span class="badge badge-orange">Admin Check Pending</span>';
  const resultMarkup = pipelineAdminState.error
    ? `<div class="pipeline-status-line danger">${escapeHtml(pipelineAdminState.error)}</div>`
    : pipelineAdminState.lastResult
      ? `<div class="pipeline-status-line success">${escapeHtml(pipelineAdminState.lastResult)}</div>`
      : '<div class="pipeline-status-line">No source asset attached in this browser session yet.</div>';
  const workerStatus = pipelineAdminState.workerStatus || {};
  const workerScan = pipelineAdminState.workerScan || {};
  const workerDropZone = workerStatus.dropZone || {};
  const workerPairs = Array.isArray(workerScan.candidates) ? workerScan.candidates : [];
  const workerIncomplete = Array.isArray(workerScan.incomplete) ? workerScan.incomplete : [];
  const workerBadge = workerDropZone.exists
    ? '<span class="badge badge-green">Worker Path Verified</span>'
    : '<span class="badge badge-orange">Worker Path Missing</span>';
  const workerReviewCount = workerStatus.dbQueue ? Number(workerStatus.dbQueue.reviewRequired || 0) : 0;
  const resolutionReviewCount = Array.isArray(pipelineAdminState.resolutionReviewQueue) ? pipelineAdminState.resolutionReviewQueue.length : 0;
  const rosterSourceCounts = (pipelineAdminState.rosterVerificationSources || []).reduce((acc, source) => {
    acc[source.status || 'UNVERIFIED'] = (acc[source.status || 'UNVERIFIED'] || 0) + 1;
    return acc;
  }, {});
  const rosterReview = selectedRosterVerification ? {
    status: selectedRosterVerification.status || 'UNVERIFIED',
    confidence: Number(selectedRosterVerification.confidence || 0),
    strongAnchors: Array.isArray(selectedRosterVerification.strongAnchors) ? selectedRosterVerification.strongAnchors.length : 0,
    independentStrongAnchors: Number(selectedRosterVerification.independentStrongAnchors || 0),
    reasons: Array.isArray(selectedRosterVerification.reasons) ? selectedRosterVerification.reasons.slice(0, 4) : []
  } : null;
  const workerPairMarkup = workerPairs.slice(0, 4).map((item) => `
    <div class="pipeline-worker-pair">
      <span>${escapeHtml(item.assetTitle || item.sourceId || 'Coaching asset')}</span>
      <strong>${escapeHtml(item.meetingMatchStatus || 'unverified')} · ${escapeHtml(item.subjectMatchStatus || 'unverified')}</strong>
      <em>${item.reviewRequired ? 'Review required' : 'Analysis ready'} · ${escapeHtml(item.video && item.video.relativePath ? item.video.relativePath : 'video pointer')}</em>
    </div>
  `).join('');
  const webexStatus = pipelineAdminState.webexStatus || {};
  const webexInventory = pipelineAdminState.webexInventory || {};
  const webexAllowed = Array.isArray(webexInventory.allowed) ? webexInventory.allowed : [];
  const webexIgnored = Array.isArray(webexInventory.ignored) ? webexInventory.ignored : [];
  const webexBadge = webexStatus.tokenConfigured
    ? '<span class="badge badge-green">Read Token Present</span>'
    : '<span class="badge badge-orange">Token Missing</span>';
  const webexPullBadge = webexStatus.pullEnabled
    ? '<span class="badge badge-green">Pull Gate Enabled</span>'
    : '<span class="badge badge-orange">Pull Gate Closed</span>';
  const webexRecordMarkup = [...webexAllowed.slice(0, 3), ...webexIgnored.slice(0, 2)].map((item) => `
    <div class="pipeline-worker-pair">
      <span>${escapeHtml(item.title || item.id || 'Webex recording')}</span>
      <strong>${item.trigger && item.trigger.allowed ? 'Allowed' : 'Ignored'} · ${escapeHtml(item.trigger ? item.trigger.reason : 'unknown')}</strong>
      <em>${escapeHtml((item.trigger && item.trigger.triggerCodes && item.trigger.triggerCodes.join(', ')) || 'No trigger')} · Transcript ${item.hasTranscriptUrl ? 'available' : 'missing'}</em>
    </div>
  `).join('');

  root.innerHTML = `
    <div class="pipeline-admin-panel" data-testid="pipeline-admin-panel">
      <div class="pipeline-admin-head">
        <div>
          <div class="briefing-kicker">PIPELINE ADMIN</div>
          <div class="card-title" style="color:var(--gold)">Attach Existing Coaching Asset</div>
          <div class="card-subtitle">Admin-only same-origin workflow. Source pointers only; no watcher, R2, Stream, Webex mutation, or production media mutation.</div>
        </div>
        <div class="meeting-status-stack">
          ${statusBadge}
          <span class="badge badge-cyan">${pipelineAdminState.sourceAssets.length} Imported</span>
      <span class="badge badge-gold">${inventoryCount} Candidates</span>
          <span class="badge badge-orange">${resolutionReviewCount} Resolve Review</span>
          <span class="badge badge-cyan">${rosterSourceCounts.VERIFIED || 0} Verified Source Lane</span>
        </div>
      </div>
      <div class="pipeline-worker-card" data-testid="pipeline-worker-status">
        <div class="pipeline-worker-head">
          <div>
            <div class="briefing-kicker">COACHING IMPORT WORKER</div>
            <div class="card-title" style="color:var(--gold)">MissionWebexVideos Drop Zone</div>
            <div class="card-subtitle">${escapeHtml(workerDropZone.path || 'Checking coaching drop-zone path')}</div>
          </div>
          <div class="meeting-status-stack">
            ${workerBadge}
            <span class="badge badge-cyan">${workerPairs.length} Pair(s)</span>
            <span class="badge badge-orange">${workerReviewCount} Review</span>
          </div>
        </div>
        <div class="pipeline-worker-grid">
          <div class="pipeline-status-line">
            Dedicated worker only. Daily Drills watcher is not imported, not started, and video_registry.json is not written.
            ${workerDropZone.knownTypoSiblingExists ? '<br><strong>Note:</strong> typo sibling folder detected; it is not treated as canonical.' : ''}
          </div>
          <div class="pipeline-worker-actions">
            <button class="topbar-btn" data-testid="pipeline-worker-refresh" onclick="refreshPipelineAdmin()" ${pipelineAdminState.loading ? 'disabled' : ''}>Scan Drop Zone</button>
            <button class="topbar-btn gold" data-testid="pipeline-worker-import" onclick="importCoachingDropZoneCandidates()" ${pipelineAdminState.working || !workerDropZone.exists ? 'disabled' : ''}>Import Coaching Pairs</button>
          </div>
        </div>
        <div class="pipeline-worker-pairs">
          ${workerPairMarkup || `<div class="pipeline-empty">${workerDropZone.exists ? 'No complete MP4/MOV/M4V + transcript pairs found yet.' : 'Create the canonical MissionWebexVideos folder before importing coaching assets.'}</div>`}
          ${workerIncomplete.length ? `<div class="pipeline-empty">${workerIncomplete.length} incomplete or unstable file group(s) are waiting for a paired video/transcript.</div>` : ''}
        </div>
      </div>
      <div class="pipeline-worker-card" data-testid="pipeline-webex-trigger-status">
        <div class="pipeline-worker-head">
          <div>
            <div class="briefing-kicker">WEBEX TRIGGERED PULL</div>
            <div class="card-title" style="color:var(--gold)">Strict Title Trigger Filter</div>
            <div class="card-subtitle">${escapeHtml(webexStatus.dropZonePath || 'MissionWebexVidoes staging path')}</div>
          </div>
          <div class="meeting-status-stack">
            ${webexBadge}
            ${webexPullBadge}
            <span class="badge badge-cyan">${webexAllowed.length} Allowed</span>
            <span class="badge badge-orange">${webexIgnored.length} Ignored</span>
          </div>
        </div>
        <div class="pipeline-worker-grid">
          <div class="pipeline-status-line">
            Default allow is [MM-ADV]. [MM-IGNORE] always denies. Untriggered recordings are ignored and never handed to the worker.
            <br>Trigger configuration is stored locally for Pipeline Admin review; it does not change Webex or production settings.
          </div>
          <div class="pipeline-worker-actions">
            <input class="micro-input" data-testid="pipeline-webex-triggers" value="${escapeHtml(pipelineAdminState.webexAllowedTriggers || MMC_WEBEX_DEFAULT_TRIGGERS)}" placeholder="[MM-ADV]" oninput="setPipelineWebexAllowedTriggers(this.value)">
            <button class="topbar-btn" data-testid="pipeline-webex-refresh" onclick="refreshWebexRecordings()" ${pipelineAdminState.working ? 'disabled' : ''}>Refresh Webex</button>
            <button class="topbar-btn gold" data-testid="pipeline-webex-pull" onclick="pullTriggeredWebexRecordings()" ${pipelineAdminState.working || !webexStatus.tokenConfigured || !webexStatus.pullEnabled ? 'disabled' : ''}>Pull Triggered</button>
          </div>
        </div>
        <div class="pipeline-worker-pairs">
          ${webexRecordMarkup || `<div class="pipeline-empty">${webexStatus.tokenConfigured ? 'No Webex inventory loaded yet, or no triggered recordings are available.' : 'Configure an approved read-only Webex token before inventory can be verified.'}</div>`}
        </div>
      </div>
      <div class="pipeline-admin-grid">
        <div class="pipeline-admin-column">
          <div class="pipeline-control-row">
            <input class="micro-input" data-testid="pipeline-asset-search" value="${escapeHtml(query)}" placeholder="Search imported source assets" oninput="setPipelineAssetSearch(this.value)">
            <button class="topbar-btn" data-testid="pipeline-refresh" onclick="refreshPipelineAdmin()" ${pipelineAdminState.loading ? 'disabled' : ''}>Refresh</button>
            <button class="topbar-btn gold" data-testid="pipeline-import" onclick="importPipelineCandidates()" ${pipelineAdminState.working ? 'disabled' : ''}>Import Live Sessions</button>
          </div>
          <div class="pipeline-asset-list" data-testid="pipeline-source-asset-list">
            ${filteredAssets.map((asset) => `
              <button class="pipeline-asset-item ${asset.id === pipelineAdminState.selectedAssetId ? 'active' : ''}" onclick="selectPipelineAsset('${escapeHtml(asset.id)}')">
                <span>${escapeHtml(asset.asset_title || asset.source_id || 'Untitled source asset')}</span>
                <strong>${escapeHtml(asset.asset_status || 'candidate')} · ${escapeHtml(asset.review_status || 'unreviewed')} · ${escapeHtml((asset.metadata && asset.metadata.student_resolution && (asset.metadata.student_resolution.status || (asset.metadata.student_resolution.overall && asset.metadata.student_resolution.overall.status))) || 'UNRESOLVED')}</strong>
                <em>${asset.media_url ? 'Video pointer available' : 'No video pointer'} · ${asset.transcript_pointer ? 'Transcript pointer available' : 'No transcript pointer'}</em>
              </button>
            `).join('') || `
              <div class="pipeline-empty">No imported source assets match this filter. Import Live Session candidates to create MMC-owned pointers from the existing video registry.</div>
            `}
          </div>
        </div>
        <div class="pipeline-admin-column">
          <div class="pipeline-field">
            <label>Roster Student (optional)</label>
            <select data-testid="pipeline-student-select" onchange="setPipelineStudent(this.value)">${studentOptions}</select>
          </div>
          <div class="pipeline-field">
            <label>Reviewed Student ID</label>
            <input class="micro-input" data-testid="pipeline-manual-student-id" value="${escapeHtml(pipelineAdminState.manualStudentId || '')}" placeholder="e.g. ignacio-anzola" oninput="setPipelineManualStudentId(this.value)">
          </div>
          <div class="pipeline-field">
            <label>Reviewed Student Name</label>
            <input class="micro-input" data-testid="pipeline-manual-student-name" value="${escapeHtml(pipelineAdminState.manualStudentName || '')}" placeholder="Reviewed student display name" oninput="setPipelineManualStudentName(this.value)">
          </div>
          <div class="pipeline-field">
            <label>Session</label>
            <select data-testid="pipeline-session-select" onchange="setPipelineSession(this.value)">${sessionOptionMarkup}</select>
          </div>
          <div class="pipeline-selected-card" data-testid="pipeline-selected-asset">
            <div class="briefing-label">SELECTED SOURCE</div>
            <div class="briefing-text">${selectedAssetRecord ? escapeHtml(selectedAssetRecord.asset_title || selectedAssetRecord.source_id) : 'No source asset selected yet.'}</div>
            <div class="briefing-sublist">
              <div class="briefing-row"><span>Recording pointer</span><strong>${selectedAssetRecord && selectedAssetRecord.media_url ? 'VERIFIED' : 'EMPTY'}</strong></div>
              <div class="briefing-row"><span>Transcript pointer</span><strong>${selectedAssetRecord && selectedAssetRecord.transcript_pointer ? 'VERIFIED' : 'EMPTY'}</strong></div>
              <div class="briefing-row"><span>Resolution</span><strong>${escapeHtml(selectedReview ? selectedReview.status : selectedResolution ? selectedResolution.status : 'UNRESOLVED')}</strong></div>
              <div class="briefing-row"><span>Suggested student</span><strong>${selectedSuggestion ? escapeHtml(selectedSuggestion.studentName || selectedSuggestion.studentId) : 'Review required'}</strong></div>
              <div class="briefing-row"><span>Confidence</span><strong>${selectedReview ? Math.round(Number(selectedReview.confidence || 0) * 100) + '%' : selectedResolution ? Math.round(Number(selectedResolution.confidence || 0) * 100) + '%' : '0%'}</strong></div>
              <div class="briefing-row"><span>Output mode</span><strong>OpenAI structured</strong></div>
            </div>
          </div>
          <div class="pipeline-selected-card" data-testid="pipeline-resolution-card">
            <div class="briefing-label">STUDENT RESOLUTION REVIEW</div>
            <div class="briefing-text">${selectedResolutionReasons.length ? escapeHtml(selectedResolutionReasons.join(' · ')) : 'Run resolution to collect deterministic evidence before attaching.'}</div>
            <div class="briefing-sublist mt-sm">
              ${selectedResolutionEvidence.map((item) => `
                <div class="briefing-row"><span>${escapeHtml(item.kind || 'evidence')}</span><strong>${escapeHtml(item.value || item.reference || item.assignmentId || '')}</strong></div>
              `).join('') || '<div class="briefing-row"><span>No evidence displayed yet</span><strong>Resolve first</strong></div>'}
            </div>
          </div>
          <div class="pipeline-selected-card" data-testid="pipeline-roster-verification-card">
            <div class="briefing-label">ROSTER VERIFICATION LANE</div>
            <div class="briefing-text">Production-safe bridge requires two independent strong anchors or explicit admin approval. Name, email, Calendar, and Webex title/date evidence stay supporting only.</div>
            <div class="briefing-sublist mt-sm">
              <div class="briefing-row"><span>Status</span><strong>${escapeHtml(rosterReview ? rosterReview.status : 'UNVERIFIED')}</strong></div>
              <div class="briefing-row"><span>Confidence</span><strong>${rosterReview ? Math.round(rosterReview.confidence * 100) + '%' : '0%'}</strong></div>
              <div class="briefing-row"><span>Strong anchors</span><strong>${rosterReview ? rosterReview.strongAnchors + ' / ' + rosterReview.independentStrongAnchors + ' independent' : '0 / 0 independent'}</strong></div>
              <div class="briefing-row"><span>Verified read lane</span><strong>${rosterSourceCounts.VERIFIED || 0} verified · ${rosterSourceCounts.UNVERIFIED || 0} unresolved</strong></div>
              <div class="briefing-row"><span>Reasons</span><strong>${escapeHtml(rosterReview && rosterReview.reasons.length ? rosterReview.reasons.join(' · ') : 'Evidence review pending')}</strong></div>
            </div>
            <div class="pipeline-field mt-sm">
              <label>Approved Source Evidence JSON</label>
              <textarea class="micro-input pipeline-evidence-input" data-testid="pipeline-roster-evidence-json" placeholder='[{"sourceSystem":"wordpress_user","anchorType":"wp_user_id","anchorValue":"...","studentId":"ignacio-anzola","studentName":"Ignacio Anzola","confidence":0.94}]' oninput="setPipelineRosterEvidenceJson(this.value)">${escapeHtml(pipelineAdminState.rosterEvidenceJson || '')}</textarea>
            </div>
            <div class="pipeline-worker-actions">
              <button class="topbar-btn" data-testid="pipeline-roster-resolve" onclick="resolveSelectedRosterVerification()" ${pipelineAdminState.working || !selectedAssetRecord || !selectedTarget ? 'disabled' : ''}>Verify Roster Evidence</button>
              <button class="topbar-btn gold" data-testid="pipeline-roster-approve" onclick="approveSelectedRosterBridge()" ${pipelineAdminState.working || !selectedAssetRecord || !selectedTarget ? 'disabled' : ''}>Approve Roster Bridge</button>
            </div>
          </div>
          <div class="pipeline-worker-actions">
            <button class="topbar-btn" data-testid="pipeline-resolve-student" onclick="resolveSelectedPipelineAsset()" ${pipelineAdminState.working || !selectedAssetRecord ? 'disabled' : ''}>Resolve Student</button>
            <button class="topbar-btn" data-testid="pipeline-use-suggested-student" onclick="useSuggestedPipelineStudent()" ${pipelineAdminState.working || !selectedSuggestion ? 'disabled' : ''}>Use Suggested</button>
          </div>
          <button class="topbar-btn gold pipeline-run-btn" data-testid="pipeline-run-analysis" onclick="runPipelineAnalysis()" ${pipelineAdminState.working || !selectedAssetRecord || !selectedTarget ? 'disabled' : ''}>Approve Link + Run Real Analysis</button>
          ${resultMarkup}
        </div>
      </div>
    </div>
  `;
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
    meeting: ['Meeting Intelligence', 'MMC-Owned Session Review'],
    memory: ['Mentor Memory / Call Prep', 'Memory-driven prep system'],
    sessioncmd: ['Session Command', 'Live mentor cockpit'],
    postsession: ['Post-Session Capture', 'Confirm actions and return to Today'],
    studentview: ['Student View Preview', 'What the student sees']
  };
  document.getElementById('topbar-title').textContent = titles[id][0];
  document.getElementById('topbar-sub').textContent = titles[id][1];

  if (id === 'meeting') renderMeetingIntelligence(activeMeetingStudent || activePrepStudent);
  if (id === 'profile') applyProfileSecondaryState();
  if (id === 'memory') renderFocusView(activePrepStudent);
  applyDensityMode();

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
  setHtml('profile-pre-call-briefing', `
    <div class="briefing-label">PRE-CALL BRIEFING</div>
    <div class="briefing-text">${escapeHtml(briefing.lastMeeting)}</div>
    <div class="briefing-sublist">
      ${renderBriefingRows(briefing.openLoops.slice(0, 3), 'No urgent open loops captured.', item => `
        <div class="briefing-row"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.status)}</strong></div>
      `)}
      ${renderBriefingRows(briefing.deadlines.slice(0, 2), 'No dated deadlines captured.', item => `
        <div class="briefing-row"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.date)}</strong></div>
      `)}
    </div>
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
  applyProfileSecondaryState();
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

function renderFocusView(studentId) {
  if (!ownershipRuntime) return;
  const root = document.getElementById('focus-view-root');
  if (!root) return;
  const bundle = ownershipRuntime.getStudentBundle(studentId);
  if (!bundle || !bundle.student) return;
  const student = bundle.student;
  const briefing = ownershipRuntime.getStudentBriefing(student.id);
  const insights = ownershipRuntime.getSessionInsights(student.id);
  const risk = insights.risk;
  const readiness = insights.readiness;
  const promises = (bundle.promises || []).slice(0, 3);
  const openTasks = (bundle.openTasks || []).slice(0, 4);
  const personal = (bundle.personalMemory || [])[0];
  const sensitive = (bundle.sensitiveMemory || [])[0];
  const lastSession = (bundle.sessions || [])[0];
  const nextMove = (bundle.nextMoves || [])[0] || (briefing ? briefing.nextBestMove : null);
  root.innerHTML = `
    <div class="focus-view-card mb-md" data-testid="call-prep-focus-view">
      <div class="focus-view-hero">
        <div>
          <div class="briefing-kicker">FOCUS VIEW</div>
          <div class="focus-view-title">${escapeHtml(student.name)} call prep</div>
          <div class="focus-view-subtitle">${escapeHtml(briefing ? briefing.who : 'MMC-owned call prep is ready.')}</div>
        </div>
        <div class="focus-view-actions">
          <span class="badge ${badgeClassForRisk(risk.level)}">${escapeHtml(risk.level)} Risk</span>
          <span class="badge ${badgeClassForReadiness(readiness.status)}">${escapeHtml(readiness.status)} · ${escapeHtml(readiness.score)}%</span>
          <button class="topbar-btn gold" onclick="startSessionCommand()" data-testid="focus-start-session">Start Session</button>
        </div>
      </div>
      <div class="focus-grid">
        <div class="focus-panel focus-primary">
          <div class="briefing-label">NEXT BEST MOVE</div>
          <div class="focus-big">${escapeHtml(nextMove ? (nextMove.title || nextMove.content) : 'Open the session by reviewing goals, promises, and open loops.')}</div>
          <div class="briefing-meta-line">${escapeHtml(nextMove ? (nextMove.action || nextMove.content || '') : 'No generated next move yet.')}</div>
        </div>
        <div class="focus-panel">
          <div class="briefing-label">QUICK REFERENCE</div>
          <div class="focus-list">
            <div><strong>Program:</strong> ${escapeHtml(programLabels[student.program] || student.program)}</div>
            <div><strong>Specialty:</strong> ${escapeHtml(student.specialty)}</div>
            <div><strong>Last meeting:</strong> ${escapeHtml(lastSession ? lastSession.dateLabel || lastSession.createdAt || student.lastMeeting : student.lastMeeting)}</div>
            <div><strong>Personal context:</strong> ${escapeHtml(personal ? personal.content : 'No personal context captured.')}</div>
          </div>
        </div>
        <div class="focus-panel">
          <div class="briefing-label">PROMISES / OPEN LOOPS</div>
          <div class="briefing-sublist">
            ${renderBriefingRows(promises, 'No mentor promises captured.', item => `
              <div class="briefing-row ${item.status === 'complete' ? '' : 'danger'}"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.status === 'complete' ? 'DONE' : item.dueLabel || 'OPEN')}</strong></div>
            `)}
            ${renderBriefingRows(openTasks.slice(0, 2), 'No open tasks captured.', item => `
              <div class="briefing-row"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.dueLabel)}</strong></div>
            `)}
          </div>
        </div>
        <div class="focus-panel">
          <div class="briefing-label">HANDLE WITH CARE</div>
          <div class="briefing-text">${escapeHtml(sensitive ? sensitive.content : 'No sensitive context captured for this student.')}</div>
          <div class="briefing-meta-line">${escapeHtml(risk.reasons.slice(0, 2).join(' · ') || 'No active risk reason captured.')}</div>
        </div>
      </div>
    </div>
  `;
}

function sessionDateLabel(session) {
  if (!session) return 'No date';
  if (session.dateLabel) return session.dateLabel;
  const raw = session.startedAt || session.createdAt || session.updatedAt;
  if (!raw) return 'Local MMC session';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function sessionDurationLabel(session) {
  if (!session || !session.startedAt || !session.endedAt) return 'Duration not captured';
  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Duration not captured';
  const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  return `${minutes} min`;
}

function normalizePipelineItems(value, fallbackLabel) {
  if (!Array.isArray(value) || !value.length) return [];
  return value.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `${fallbackLabel}-${index}`, title: item, detail: '', status: '' };
    }
    return {
      id: item.id || `${fallbackLabel}-${index}`,
      title: item.title || item.label || item.summary || item.action || `${fallbackLabel} ${index + 1}`,
      detail: item.detail || item.details || item.reason || item.evidence || '',
      status: item.status || item.owner_type || item.owner || ''
    };
  });
}

function findPipelineSnapshotForSession(snapshots, artifacts, sessionId) {
  const artifactRunIds = new Set(artifacts.map((item) => item.analysisRunId).filter(Boolean));
  const artifactAssetIds = new Set(artifacts.map((item) => item.sourceAssetId).filter(Boolean));
  return snapshots.find((snapshot) => {
    if (snapshot.snapshotType !== 'meeting_intelligence') return false;
    if (snapshot.sessionId && snapshot.sessionId === sessionId) return true;
    if (snapshot.analysisRunId && artifactRunIds.has(snapshot.analysisRunId)) return true;
    if (snapshot.sourceAssetId && artifactAssetIds.has(snapshot.sourceAssetId)) return true;
    return false;
  }) || snapshots.find((snapshot) => snapshot.snapshotType === 'meeting_intelligence') || null;
}

function buildMeetingRecords(studentId) {
  if (!ownershipRuntime) return [];
  const bundle = ownershipRuntime.getStudentBundle(studentId);
  if (!bundle || !bundle.student) return [];
  const briefing = ownershipRuntime.getStudentBriefing(studentId);
  const insights = ownershipRuntime.getSessionInsights(studentId);
  const sessions = bundle.sessions || [];
  const openTasks = bundle.openTasks || [];
  const tasks = bundle.tasks || [];
  const sessionArtifacts = bundle.sessionArtifacts || [];
  const intelligenceSnapshots = bundle.intelligenceSnapshots || [];
  return sessions.map((session, index) => {
    const relatedTasks = openTasks.filter(task => task.sourceSessionId === session.id).concat(
      tasks.filter(task => task.sourceSessionId === session.id && task.status === 'complete')
    );
    const fallbackTasks = relatedTasks.length ? relatedTasks : openTasks.slice(0, 3);
    const artifacts = sessionArtifacts.filter(item => item.sessionId === session.id);
    const pipelineSnapshot = findPipelineSnapshotForSession(intelligenceSnapshots, artifacts, session.id);
    const structured = pipelineSnapshot && pipelineSnapshot.summary ? pipelineSnapshot.summary : {};
    const recordingArtifact = artifacts.find(item => item.type === 'recording_reference');
    const transcriptArtifact = artifacts.find(item => item.type === 'transcript_reference');
    const summaryArtifact = artifacts.find(item => item.type === 'ai_meeting_summary' || item.type === 'summary' || item.type === 'post-session-summary');
    const structuredActions = normalizePipelineItems(structured.action_items, 'action');
    const storyInsights = normalizePipelineItems(structured.story_insights, 'story');
    const sensitiveTopics = normalizePipelineItems(structured.sensitive_topics, 'sensitive');
    const relationshipSignals = normalizePipelineItems(structured.relationship_signals, 'relationship');
    const timelineEvents = normalizePipelineItems(structured.timeline_events, 'timeline');
    const nextMove = structured.next_best_move || (briefing ? briefing.nextBestMove.action : '');
    return {
      id: session.id,
      student: bundle.student,
      session,
      artifacts,
      pipelineSnapshot,
      title: session.title || `${bundle.student.name} mentoring session`,
      dateLabel: sessionDateLabel(session),
      durationLabel: sessionDurationLabel(session),
      status: session.status || 'saved',
      summary: structured.summary || summaryArtifact?.content || summaryArtifact?.summary || session.summary || (briefing ? briefing.lastMeeting : 'No session summary captured yet.'),
      privateNotes: structured.mentor_note_draft || session.privateNotes || artifacts.find(item => item.type === 'private_note')?.content || 'No mentor-only note captured for this session.',
      actionItems: structuredActions.length ? structuredActions : fallbackTasks.slice(0, 5),
      storyInsights,
      sensitiveTopics,
      relationshipSignals,
      timelineEvents,
      nextBestMove: nextMove || 'Review open loops and confirm the next coaching commitment.',
      sourcePointers: {
        recording: recordingArtifact ? recordingArtifact.contentPointer : null,
        transcript: transcriptArtifact ? transcriptArtifact.contentPointer : null,
        sourceAssetTitle: recordingArtifact?.sourceAssetTitle || transcriptArtifact?.sourceAssetTitle || summaryArtifact?.sourceAssetTitle || ''
      },
      signals: [
        { label: 'Relationship', value: insights.relationship.trustSignal, detail: insights.relationship.communicationStyle, tone: 'gold' },
        { label: 'Risk', value: structured.risk && structured.risk.level ? `${structured.risk.level} Risk` : `${insights.risk.level} Risk`, detail: structured.risk && Array.isArray(structured.risk.reasons) && structured.risk.reasons.length ? structured.risk.reasons.slice(0, 2).join(' · ') : insights.risk.reasons.slice(0, 2).join(' · ') || 'No risk reason captured.', tone: insights.risk.level === 'High' ? 'red' : 'orange' },
        { label: 'Readiness', value: structured.readiness && structured.readiness.level ? structured.readiness.level : `${insights.readiness.score}%`, detail: structured.readiness && Array.isArray(structured.readiness.reasons) && structured.readiness.reasons.length ? structured.readiness.reasons.slice(0, 2).join(' · ') : insights.readiness.status, tone: 'cyan' },
        { label: 'Next Move', value: pipelineSnapshot ? 'Pipeline Output' : (briefing ? briefing.nextBestMove.title : 'Review open loops'), detail: nextMove || (briefing ? briefing.nextBestMove.action : 'Use MMC-owned tasks and goals.'), tone: 'green' }
      ],
      transcriptSegments: [
        recordingArtifact ? {
          speaker: 'Recording',
          time: 'Pointer',
          text: recordingArtifact.contentPointer || recordingArtifact.title || 'Recording pointer available.'
        } : null,
        transcriptArtifact ? {
          speaker: 'Transcript',
          time: 'Pointer',
          text: transcriptArtifact.contentPointer || transcriptArtifact.title || 'Transcript pointer available.'
        } : null,
        ...artifacts
        .filter(item => item.type === 'transcript_note' || item.type === 'summary' || item.type === 'private_note')
        .map((item, artifactIndex) => ({
          speaker: item.type === 'private_note' ? 'Mentor note' : 'MMC artifact',
          time: `T+${artifactIndex + 1}`,
          text: item.content || item.summary || item.title || 'Session artifact captured.'
        }))
      ].filter(Boolean),
      ordinal: index + 1
    };
  });
}

function renderMeetingIntelligence(studentId, selectedSessionId) {
  const root = document.getElementById('meeting-intelligence-root');
  if (!root || !ownershipRuntime) return;
  activeMeetingStudent = studentId || activeMeetingStudent || activePrepStudent;
  const bundleForActive = ownershipRuntime.getStudentBundle(activeMeetingStudent);
  const student = bundleForActive && bundleForActive.student
    ? bundleForActive.student
    : students.find(s => s.id === activeMeetingStudent) || students[0];
  const records = buildMeetingRecords(student.id);
  if (selectedSessionId) activeMeetingSessionId = selectedSessionId;
  if (!activeMeetingSessionId || !records.some(item => item.id === activeMeetingSessionId)) {
    activeMeetingSessionId = records[0] ? records[0].id : null;
  }
  const selected = records.find(item => item.id === activeMeetingSessionId);
  const leadingStudents = students.slice(0, 5);
  const filterStudents = leadingStudents.some((item) => item.id === student.id)
    ? leadingStudents
    : [student, ...leadingStudents.filter((item) => item.id !== student.id).slice(0, 4)];
  const studentFilters = filterStudents.map(item => `
    <button class="filter-chip ${item.id === student.id ? 'active' : ''}" onclick="selectMeetingStudent('${escapeHtml(item.id)}')">${escapeHtml(item.name)}</button>
  `).join('');

  if (!records.length) {
    root.innerHTML = `
      <div class="meeting-intelligence-shell">
        <div class="meeting-topline">
          <div>
            <div class="briefing-kicker">MEETING INTELLIGENCE</div>
            <div class="meeting-title">MMC-owned session review</div>
            <div class="card-subtitle">Dynamic renderer from coaching_sessions and session_artifacts only</div>
          </div>
          <span class="badge badge-cyan">No External Requests</span>
        </div>
        <div class="filter-bar meeting-filter-bar">${studentFilters}</div>
        <div id="pipeline-admin-root" data-testid="pipeline-admin-root"></div>
        <div class="card meeting-empty-state">
          <div class="card-title" style="color:var(--gold)">No MMC-owned sessions captured for ${escapeHtml(student.name)} yet.</div>
          <div class="briefing-text mt-sm">Run Call Prep, Session Command, and Post-Session Capture, or attach an existing coaching asset with Pipeline Admin. No watcher, R2, Stream, Webex mutation, transcript API mutation, or production media mutation is used.</div>
          <button class="topbar-btn gold mt-md" onclick="openCallPrep('${escapeHtml(student.id)}')">Prep First Call</button>
        </div>
      </div>
    `;
    renderPipelineAdmin();
    return;
  }

  root.innerHTML = `
    <div class="meeting-intelligence-shell">
      <div class="meeting-topline">
        <div>
          <div class="briefing-kicker">MEETING INTELLIGENCE</div>
          <div class="meeting-title">MMC-owned session review</div>
          <div class="card-subtitle">Rendered dynamically from local/MMC persistence and reviewed pipeline source pointers.</div>
        </div>
        <div class="meeting-status-stack">
          <span class="badge badge-gold">${records.length} Session${records.length === 1 ? '' : 's'}</span>
          <span class="badge badge-cyan">Same-Origin MMC Only</span>
        </div>
      </div>
      <div class="filter-bar meeting-filter-bar">${studentFilters}</div>
      <div id="pipeline-admin-root" data-testid="pipeline-admin-root"></div>
      <div class="meeting-layout">
        <div class="meeting-history-panel">
          <div class="card-header">
            <div class="card-title">Meeting History</div>
            <span class="badge badge-cyan">${escapeHtml(student.name)}</span>
          </div>
          <div class="meeting-history-list">
            ${records.map(item => `
              <button class="meeting-history-item ${item.id === selected.id ? 'active' : ''}" onclick="selectMeetingSession('${escapeHtml(item.id)}')">
                <span>${escapeHtml(item.title)}</span>
                <strong>${escapeHtml(item.dateLabel)}</strong>
                <em>${escapeHtml(item.durationLabel)} · ${escapeHtml(item.status)}</em>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="meeting-detail-panel">
          <div class="meeting-detail-hero">
            <div>
              <div class="briefing-kicker">SELECTED SESSION</div>
              <div class="meeting-detail-title">${escapeHtml(selected.title)}</div>
              <div class="briefing-meta-line">${escapeHtml(selected.dateLabel)} · ${escapeHtml(selected.durationLabel)} · ${escapeHtml(selected.student.name)}</div>
            </div>
            <button class="topbar-btn" onclick="openCallPrep('${escapeHtml(student.id)}')">Prep Follow-Up</button>
          </div>
          <div class="meeting-detail-grid">
            <div class="meeting-card wide">
              <div class="flex-between">
                <div class="briefing-label">RECORDING / SOURCE ASSET</div>
                <span class="badge ${selected.pipelineSnapshot ? 'badge-green' : 'badge-orange'}">${selected.pipelineSnapshot ? 'Pipeline Readback' : 'MMC Session'}</span>
              </div>
              <div class="pipeline-pointer-grid mt-sm">
                <div>
                  <div class="briefing-label">Recording</div>
                  <div class="briefing-text">${selected.sourcePointers.recording ? escapeHtml(selected.sourcePointers.recording) : 'No recording pointer attached.'}</div>
                </div>
                <div>
                  <div class="briefing-label">Transcript</div>
                  <div class="briefing-text">${selected.sourcePointers.transcript ? escapeHtml(selected.sourcePointers.transcript) : 'No transcript pointer attached.'}</div>
                </div>
              </div>
            </div>
            <div class="meeting-card wide">
              <div class="briefing-label">SUMMARY</div>
              <div class="briefing-text">${escapeHtml(selected.summary)}</div>
            </div>
            <div class="meeting-card">
              <div class="briefing-label">ACTION ITEMS</div>
              <div class="briefing-sublist">
                ${renderBriefingRows(selected.actionItems, 'No action items captured for this session.', item => `
                  <div class="briefing-row"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.dueLabel || item.status || 'OPEN')}</strong></div>
                `)}
              </div>
            </div>
            <div class="meeting-card">
              <div class="briefing-label">STORY INSIGHTS</div>
              <div class="briefing-sublist">
                ${renderBriefingRows(selected.storyInsights, 'No reviewed story insights captured in this analysis.', item => `
                  <div class="briefing-row"><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.status || 'INSIGHT')}</strong></div>
                `)}
              </div>
            </div>
            <div class="meeting-card">
              <div class="briefing-label">MENTOR-ONLY NOTES</div>
              <div class="briefing-text">${escapeHtml(selected.privateNotes)}</div>
            </div>
            <div class="meeting-card">
              <div class="briefing-label">NEXT BEST COACHING MOVE</div>
              <div class="briefing-text">${escapeHtml(selected.nextBestMove)}</div>
            </div>
            <div class="meeting-card wide">
              <div class="briefing-label">COACHING SIGNALS</div>
              <div class="meeting-signal-grid">
                ${selected.signals.map(signal => `
                  <div class="meeting-signal ${escapeHtml(signal.tone)}">
                    <span>${escapeHtml(signal.label)}</span>
                    <strong>${escapeHtml(signal.value)}</strong>
                    <em>${escapeHtml(signal.detail)}</em>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="meeting-card wide">
              <div class="flex-between">
                <div class="briefing-label">TRANSCRIPT VIEWER</div>
                <span class="badge ${selected.sourcePointers.transcript ? 'badge-green' : 'badge-orange'}">${selected.sourcePointers.transcript ? 'Pointer Available' : 'Deferred / MMC Artifacts Only'}</span>
              </div>
              <div class="briefing-text mt-sm">This area displays MMC-owned session artifacts and source pointers only. Webex remains read-only and trigger-gated.</div>
              <div class="meeting-transcript-list mt-sm">
                ${renderBriefingRows(selected.transcriptSegments, 'No transcript-like MMC artifacts captured for this session.', item => `
                  <div class="meeting-transcript-row"><strong>${escapeHtml(item.speaker)} ${escapeHtml(item.time)}</strong><span>${escapeHtml(item.text)}</span></div>
                `)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  renderPipelineAdmin();
}

function selectMeetingStudent(studentId) {
  activeMeetingStudent = studentId;
  activePrepStudent = studentId;
  activeMeetingSessionId = null;
  renderMeetingIntelligence(studentId);
}

function selectMeetingSession(sessionId) {
  activeMeetingSessionId = sessionId;
  renderMeetingIntelligence(activeMeetingStudent, sessionId);
}

function renderMemoryContent(studentId) {
  if (!ownershipRuntime) return;
  const bundle = ownershipRuntime.getStudentBundle(studentId);
  const container = document.getElementById('memory-content');
  if (!bundle || !bundle.student || !container) return;
  renderFocusView(studentId);
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
  backend: ownershipRuntime ? 'same-origin MMC persistence plus coaching pipeline only' : false,
  apiCalls: ownershipRuntime ? 'same-origin /api/mmc/persistence + /api/mmc/coaching-pipeline only' : false,
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
  apiCalls: ownershipRuntime ? 'same-origin /api/mmc/persistence + /api/mmc/coaching-pipeline only' : false,
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
      backend: ownershipRuntime ? 'same-origin MMC persistence plus coaching pipeline only' : false,
      apiCalls: ownershipRuntime ? 'same-origin /api/mmc/persistence + /api/mmc/coaching-pipeline only' : false,
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
  toggleDensityMode,
  toggleSystemStatus,
  toggleProfileSecondarySections,
  renderFocusView,
  renderMeetingIntelligence,
  selectMeetingStudent,
  selectMeetingSession,
  refreshPipelineAdmin,
  importCoachingDropZoneCandidates,
  setPipelineWebexAllowedTriggers,
  refreshWebexRecordings,
  pullTriggeredWebexRecordings,
  importPipelineCandidates,
  selectPipelineAsset,
  setPipelineAssetSearch,
  setPipelineStudent,
  setPipelineSession,
  setPipelineManualStudentId,
  setPipelineManualStudentName,
  setPipelineRosterEvidenceJson,
  resolveSelectedRosterVerification,
  approveSelectedRosterBridge,
  runPipelineAnalysis,
  runPipelineMockAnalysis,
  renderPipelineAdmin,
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
  renderMeetingIntelligence(activeMeetingStudent);
  renderSessionItems();
  renderPostSessionReview();
  renderPilotReadiness();
  applyDensityMode();
}

renderStudentTable(students);
