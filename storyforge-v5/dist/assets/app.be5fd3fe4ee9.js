import { createAuthClient } from './auth.960289f115f2.js';

const app = document.querySelector('#app');
const toastNode = document.querySelector('#toast');
const fixturePersonaKey = 'storyforge_local_fixture_persona';
const fixturePersonas = new Set(['student', 'studentOther', 'mentor', 'mentorTwo', 'unassignedMentor', 'admin']);
const backgroundEnvironments = Object.freeze([
  {
    id: 'ember',
    name: 'Emberlight',
    description: 'Rising ember warmth with quiet violet and cyan depth.',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Slow curtains of northern color across the dark.',
  },
  {
    id: 'constellation',
    name: 'Night Constellation',
    description: 'A quiet star field with faint connected points.',
  },
  {
    id: 'tide',
    name: 'Deep Tide',
    description: 'Soft light currents moving through deep water.',
  },
  {
    id: 'meridian',
    name: 'Meridian',
    description: 'Restrained contour lines with a low cyan glow.',
  },
  {
    id: 'static',
    name: 'Static Dark',
    description: 'A flat, still dark background with no motion.',
  },
]);
const backgroundIds = new Set(backgroundEnvironments.map(({ id }) => id));

const state = {
  config: null,
  user: null,
  lockout: null,
  route: 'home',
  routeId: null,
  stories: [],
  questions: [],
  selectedScore: null,
  captureMode: 'text',
  libraryFilter: 'all',
  queueBucket: 'all',
  importPreview: [],
};

const auth = createAuthClient({
  onLockout(lockoutState, message) {
    state.user = null;
    state.lockout = lockoutState || 'access_unavailable';
    renderLockout(state.lockout, message);
  },
});

const icons = {
  home: '⌂',
  library: '▤',
  capture: '＋',
  notifications: '●',
  settings: '⚙',
  students: '◎',
  queue: '◫',
  prep: '◇',
  activity: '↗',
};

const routesByRole = {
  student: [
    ['home', 'Home'],
    ['library', 'Story Library'],
    ['prep', 'Interview Prep'],
    ['notifications', 'Notifications'],
    ['settings', 'Settings'],
  ],
  mentor: [
    ['home', 'Home'],
    ['students', 'Students'],
    ['queue', 'Review Queue'],
    ['activity', 'My Activity'],
    ['prep', 'Interview Prep'],
    ['settings', 'Settings'],
  ],
  admin: [
    ['home', 'Home'],
    ['students', 'Students'],
    ['prep', 'Question Governance'],
    ['activity', 'Audit'],
    ['settings', 'Settings'],
  ],
};

function matrixHref() {
  return state.config?.matrixBaseUrl
    || new URL('/member-dashboard/', window.location.origin).toString();
}

function activeBackground() {
  const preferred = state.user?.background_preference;
  return backgroundIds.has(preferred) ? preferred : 'ember';
}

function applyEnvironment() {
  document.body.dataset.background = activeBackground();
  document.body.dataset.role = state.user?.role || 'student';
}

function focusPrimaryHeading() {
  const heading = app.querySelector('h1');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function humanStatus(value) {
  return String(value || '').replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) return 'Not yet';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function notify(message) {
  toastNode.textContent = message;
  toastNode.classList.add('show');
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => toastNode.classList.remove('show'), 3200);
}

async function request(path, options = {}) {
  return auth.request(path, options);
}

function scoreControl(value, label = 'Self') {
  return `<div class="score" role="group" aria-label="${escapeHtml(label)} score">
    ${[1, 2, 3, 4, 5].map((score) => `
      <button type="button" data-score="${score}" class="${Number(value) >= score ? 'on' : ''}"
        aria-label="${escapeHtml(label)} score ${score} of 5" aria-pressed="${Number(value) === score}">${score}</button>
    `).join('')}
    <span class="score-key">${escapeHtml(label)} · ${value ? `${value}/5` : 'not scored'}</span>
  </div>`;
}

function navButton(route, label) {
  const active = state.route === route;
  return `<button type="button" data-nav="${route}" class="${active ? 'active' : ''}"
    aria-label="${escapeHtml(label)}" ${active ? 'aria-current="page"' : ''}>
    <span class="nav-icon" aria-hidden="true">${icons[route] || '·'}</span>
    <span class="nav-label">${escapeHtml(label)}</span>
  </button>`;
}

function shell(content, title = '') {
  applyEnvironment();
  const routes = routesByRole[state.user.role] || routesByRole.student;
  app.innerHTML = `<div class="app-shell">
    <aside class="rail" aria-label="StoryForge navigation">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">S</span>
        <div><strong>StoryForge</strong><small>MissionMed 360</small></div>
      </div>
      ${state.user.role === 'student' ? '<button class="rail-primary" type="button" data-nav="capture"><span aria-hidden="true">＋</span><span>Quick capture</span></button>' : ''}
      <nav class="nav">${routes.map(([route, label]) => navButton(route, label)).join('')}</nav>
      <div class="rail-foot">
        <a class="matrix-link" href="${escapeHtml(matrixHref())}">← Back to Matrix</a>
        <div class="identity">
          <strong>${escapeHtml(state.user.display_name)}</strong>
          <small>${escapeHtml(state.user.role)}${state.user.cohort ? ` · ${escapeHtml(state.user.cohort)}` : ''}</small>
          ${state.config.devAuth ? '<button class="link-button" id="sign-out">Change fixture identity</button>' : ''}
        </div>
      </div>
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <div class="breadcrumbs">StoryForge <span aria-hidden="true">/</span> <strong>${escapeHtml(title || state.route)}</strong></div>
        <div class="top-actions">
          <a class="matrix-link mobile-matrix-link" href="${escapeHtml(matrixHref())}">← Back to Matrix</a>
          ${state.config.identityMode === 'local-signed-fixture' ? '<span class="badge">Local signed fixture</span>' : '<span class="badge">MissionMed identity</span>'}
          ${state.user.role === 'student' ? '<button class="button secondary" data-nav="capture">+ Quick capture</button>' : ''}
        </div>
      </header>
      <main class="content" id="main">${content}</main>
    </div>
    <nav class="mobile-nav" aria-label="Mobile StoryForge navigation">
      ${routes.map(([route, label]) => navButton(route, label)).join('')}
    </nav>
  </div>`;
  bindGlobal();
}

function bindGlobal() {
  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.nav));
  });
  document.querySelector('#sign-out')?.addEventListener('click', signOut);
}

function signOut() {
  state.user = null;
  state.lockout = null;
  auth.clear();
  if (state.config?.devAuth) sessionStorage.removeItem(fixturePersonaKey);
  renderLogin();
}

async function enterFixturePersona(persona) {
  if (!fixturePersonas.has(persona)) throw new Error('Unknown local fixture identity.');
  const { token } = await request(`/api/dev/session/${persona}`, { method: 'POST', body: '{}' });
  auth.setToken(token);
  sessionStorage.setItem(fixturePersonaKey, persona);
  await bootstrapSession();
}

async function navigate(route, id = null) {
  state.route = route;
  state.routeId = id;
  const base = state.config.basePath;
  const suffix = route === 'home' ? '' : `${route}${id ? `/${id}` : ''}`;
  history.pushState(null, '', `${base}${suffix}`);
  try {
    await renderRoute();
    focusPrimaryHeading();
  } catch (error) {
    notify(error.message);
    if (!state.user && !state.lockout) renderLogin();
  }
}

async function loadStories() {
  state.stories = (await request('/api/stories')).stories;
  return state.stories;
}

function storyRows(stories, empty = 'No stories are in this view yet.') {
  if (!stories.length) return `<div class="card empty">${escapeHtml(empty)}</div>`;
  return `<div class="story-list">${stories.map((story) => `
    <button type="button" class="story-row" data-story="${story.id}">
      <span>
        <strong>${escapeHtml(story.title)}</strong>
        <small>${escapeHtml(story.student_name || humanStatus(story.capture_type))} · ${escapeHtml((story.current_text || '').slice(0, 100))}${story.current_text?.length > 100 ? '…' : ''}</small>
      </span>
      <span class="status ${escapeHtml(story.status)}">${escapeHtml(humanStatus(story.status))}</span>
      <time datetime="${escapeHtml(story.updated_at)}">${escapeHtml(formatDate(story.updated_at))}</time>
    </button>
  `).join('')}</div>`;
}

function bindStoryRows() {
  document.querySelectorAll('[data-story]').forEach((row) => {
    row.addEventListener('click', () => navigate('story', row.dataset.story));
  });
}

async function studentHome() {
  const stories = await loadStories();
  const privateCount = stories.filter((story) => story.status === 'private').length;
  const reviewCount = stories.filter((story) => ['submitted', 'opened', 'resubmitted'].includes(story.status)).length;
  const approvedCount = stories.filter((story) => story.status === 'approved').length;
  shell(`
    <div class="page-head">
      <div>
        <p class="eyebrow">Your story practice</p>
        <h1>Shape what only you can tell.</h1>
        <p class="lede">Capture first. Decide when it is ready. Your mentor cannot see a private story until you submit it.</p>
      </div>
      <button class="button" data-nav="capture">Capture a story</button>
    </div>
    <div class="grid four" aria-label="Story summary">
      <div class="card metric"><span><i class="metric-dot"></i>All stories</span><strong>${stories.length}</strong></div>
      <div class="card metric"><span><i class="metric-dot"></i>Private</span><strong>${privateCount}</strong></div>
      <div class="card metric"><span><i class="metric-dot"></i>With mentors</span><strong>${reviewCount}</strong></div>
      <div class="card metric"><span><i class="metric-dot"></i>Approved</span><strong>${approvedCount}</strong></div>
    </div>
    <div class="section-head"><h2>Continue shaping</h2><button class="link-button" data-nav="library">See library</button></div>
    ${storyRows(stories.slice(0, 4), 'Your first private story starts with Quick Capture.')}
    <div class="section-head"><h2>Prepare for the question after the question</h2></div>
    <div class="grid two">
      <button class="card interactive" data-nav="prep">
        <p class="eyebrow">Question workshop</p>
        <h3>Compare two interview questions</h3>
        <p>Build distinct answers and decide which story serves each one best.</p>
      </button>
      <div class="card">
        <p class="eyebrow">AI status</p>
        <h3>Suggestions are gated</h3>
        <p>StoryForge will never show canned suggestions as if a model created them. Your manual prep tools remain available.</p>
      </div>
    </div>
  `, 'Home');
  bindStoryRows();
  bindGlobal();
}

async function mentorHome() {
  const [queue, students] = await Promise.all([
    request('/api/queue'),
    request('/api/students'),
  ]);
  const awaiting = queue.stories.filter((story) => ['submitted', 'resubmitted'].includes(story.status));
  const followup = queue.stories.filter((story) => story.needs_followup);
  shell(`
    <div class="page-head">
      <div>
        <p class="eyebrow">Mentor view</p>
        <h1>Coach the story, not the student’s voice.</h1>
        <p class="lede">Your queue is derived from real submission state. Private stories never enter it.</p>
      </div>
      <button class="button" data-nav="queue">Open review queue</button>
    </div>
    <div class="grid four">
      <div class="card metric"><span>Assigned students</span><strong>${students.students.length}</strong></div>
      <div class="card metric"><span>Awaiting review</span><strong>${awaiting.length}</strong></div>
      <div class="card metric"><span>Needs follow-up</span><strong>${followup.length}</strong></div>
      <div class="card metric"><span>Approved</span><strong>${queue.stories.filter((story) => story.status === 'approved').length}</strong></div>
    </div>
    <div class="section-head"><h2>Next reviews</h2><button class="link-button" data-nav="queue">View all buckets</button></div>
    ${storyRows(awaiting.slice(0, 5), 'No submitted stories are waiting for you.')}
    <div class="section-head"><h2>Mentor tools</h2></div>
    <div class="grid three">
      <button class="card interactive" data-nav="students"><p class="eyebrow">Roster</p><h3>Students</h3><p>Open assigned workspaces and coaching history.</p></button>
      <button class="card interactive" data-nav="prep"><p class="eyebrow">Prep</p><h3>Question workshops</h3><p>Compare questions and add manual coaching notes.</p></button>
      <div class="card"><p class="eyebrow">Teaching mode</p><h3>Founder-gated integration</h3><p>Live-session actions are not represented as ready until their protected Matrix owner is integrated.</p></div>
    </div>
  `, 'Mentor Home');
  bindStoryRows();
  bindGlobal();
}

async function adminHome() {
  const [students, questions] = await Promise.all([request('/api/students'), request('/api/questions')]);
  shell(`
    <div class="page-head">
      <div><p class="eyebrow">Program administration</p><h1>Govern access without reading private stories.</h1>
      <p class="lede">Admin can inspect profiles, assignment metadata, and question governance. There is no private-story support override.</p></div>
    </div>
    <div class="grid three">
      <div class="card metric"><span>Visible student profiles</span><strong>${students.students.length}</strong></div>
      <div class="card metric"><span>Question records</span><strong>${questions.questions.length}</strong></div>
      <div class="card metric"><span>Private stories readable</span><strong>0</strong></div>
    </div>
    <div class="section-head"><h2>Founder-gated policies</h2></div>
    <div class="card callout">Retention/deletion/export/archive and emergency support access remain unresolved founder decisions. This build does not invent either policy.</div>
  `, 'Administration');
}

async function renderHome() {
  if (state.user.role === 'student') return studentHome();
  if (state.user.role === 'mentor') return mentorHome();
  return adminHome();
}

async function renderLibrary() {
  const stories = await loadStories();
  const filters = [
    ['all', 'All'],
    ['private', 'Private'],
    ['submitted', 'With mentor'],
    ['approved', 'Approved'],
  ];
  const filterStories = (filter) => {
    if (filter === 'all') return stories;
    if (filter === 'submitted') return stories.filter((story) => story.status !== 'private');
    return stories.filter((story) => story.status === filter);
  };
  const visible = filterStories(state.libraryFilter);
  shell(`
    <div class="page-head">
      <div><p class="eyebrow">Story library</p><h1>Your stories, with their history intact.</h1>
      <p class="lede">Original captures and later revisions are separate. Submitted stories are read-only until a mentor requests revision.</p></div>
      <button class="button" data-nav="capture">New story</button>
    </div>
    <div class="button-row" aria-label="Library filters">
      ${filters.map(([key, label]) => `
        <button class="button ${state.libraryFilter === key ? 'secondary' : 'ghost'}" data-filter="${key}"
          aria-pressed="${state.libraryFilter === key}">${label} ${filterStories(key).length}</button>
      `).join('')}
    </div>
    <div class="section-head"><h2 id="library-filter-title">${escapeHtml(filters.find(([key]) => key === state.libraryFilter)?.[1] || 'All')} stories</h2></div>
    <div id="library-list" aria-labelledby="library-filter-title">${storyRows(visible)}</div>
  `, 'Library');
  bindStoryRows();
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.libraryFilter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((filterButton) => {
        const selected = filterButton.dataset.filter === state.libraryFilter;
        filterButton.classList.toggle('secondary', selected);
        filterButton.classList.toggle('ghost', !selected);
        filterButton.setAttribute('aria-pressed', String(selected));
      });
      document.querySelector('#library-filter-title').textContent = `${filters.find(([key]) => key === state.libraryFilter)?.[1] || 'All'} stories`;
      document.querySelector('#library-list').innerHTML = storyRows(filterStories(state.libraryFilter));
      bindStoryRows();
    });
  });
}

function captureForm() {
  return `
    <div class="capture-hero">
      <section class="card capture-card">
        <div class="mode-tabs" aria-label="Capture mode">
          <button type="button" data-mode="text" class="${state.captureMode === 'text' ? 'active' : ''}"
            aria-pressed="${state.captureMode === 'text'}">Write</button>
          <button type="button" data-mode="audio" class="${state.captureMode === 'audio' ? 'active' : ''}"
            aria-pressed="${state.captureMode === 'audio'}">Record</button>
        </div>
        ${state.captureMode === 'audio' ? `
          <div class="field">
            <h2>Record the first telling</h2>
            <p>Audio is private and durable only when the approved StoryForge R2 store is configured.</p>
          </div>
          <div class="callout ${state.config.audioAvailable ? 'success' : ''}">
            ${state.config.audioAvailable
              ? 'Private recording storage is configured. Create a story shell before recording.'
              : 'Recording is unavailable in this environment because private StoryForge audio storage is not configured. Nothing has been recorded or uploaded.'}
          </div>
          <div class="button-row"><button class="button" type="button" id="record-start" ${state.config.audioAvailable ? '' : 'disabled'}>Start recording</button></div>
        ` : `
          <form id="capture-form">
            <div class="field"><label for="story-title">Story title</label><input id="story-title" name="title" maxlength="160" placeholder="A moment you want to understand" required></div>
            <div class="field"><label for="story-text">Tell it in your own words</label><textarea id="story-text" name="text" minlength="3" placeholder="What happened? What did you notice? What changed?" required></textarea>
            <p class="hint">This remains private until you explicitly submit it.</p></div>
            <div class="button-row"><button class="button" type="submit">Save private story</button></div>
          </form>
        `}
      </section>
      <aside class="card">
        <p class="eyebrow">Capture promise</p>
        <h3>Private really means private.</h3>
        <p>Your assigned mentor cannot read a draft—not in a list and not by guessing its direct identifier.</p>
        <hr>
        <p class="eyebrow">Start imperfectly</p>
        <p>Do not optimize the first telling. StoryForge preserves it so revision never erases where you began.</p>
      </aside>
    </div>`;
}

async function renderCapture() {
  shell(`
    <div class="page-head"><div><p class="eyebrow">Quick capture</p><h1>Catch the story before you polish it.</h1>
    <p class="lede">Write or record a real first telling. You decide when a mentor is invited in.</p></div></div>
    ${captureForm()}
  `, 'Quick Capture');
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.captureMode = button.dataset.mode;
      renderCapture();
      document.querySelector(`[data-mode="${state.captureMode}"]`)?.focus();
    });
  });
  document.querySelector('#capture-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await request('/api/stories', {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          text: form.get('text'),
          captureType: 'text',
          surface: 'quick',
        }),
      });
      notify('Private story saved.');
      navigate('story', payload.story.id);
    } catch (error) {
      notify(error.message);
    }
  });
}

async function renderStory() {
  const detail = await request(`/api/stories/${state.routeId}`);
  let story = detail.story;
  if (state.user.role === 'mentor' && ['submitted', 'resubmitted'].includes(story.status)) {
    story = (await request(`/api/stories/${story.id}/open`, {
      method: 'POST',
      body: JSON.stringify({ surface: 'quick' }),
    })).story;
  }
  const editable = state.user.role === 'student' && ['private', 'needs_revision'].includes(story.status);
  const mentor = state.user.role === 'mentor';
  const mentorReviewAvailable = story.mentor_review_available === true;
  state.selectedScore = mentor ? story.mentor_score : story.student_score;
  shell(`
    <div class="page-head">
      <div>
        <p class="eyebrow">${mentor ? escapeHtml(story.student_name) : 'Story workspace'}</p>
        <h1>${escapeHtml(story.title)}</h1>
        <div class="meta"><span class="status ${escapeHtml(story.status)}">${escapeHtml(humanStatus(story.status))}</span><span>Revision ${story.revision_no}</span><span>Updated ${escapeHtml(formatDate(story.updated_at))}</span></div>
      </div>
      <button class="button secondary" data-nav="${mentor ? 'queue' : 'library'}">Back</button>
    </div>
    <div class="grid two">
      <section class="card">
        <form id="story-form">
          <div class="field"><label for="workspace-title">Title</label><input id="workspace-title" maxlength="160" value="${escapeHtml(story.title)}" ${editable ? '' : 'readonly'}></div>
          <div class="field"><label for="workspace-text">Current telling</label><textarea id="workspace-text" ${editable ? '' : 'readonly'}>${escapeHtml(story.current_text)}</textarea></div>
          <div class="field"><label>${mentor ? 'Mentor score' : 'Self score'}</label>${scoreControl(state.selectedScore, mentor ? 'Mentor' : 'Self')}</div>
          ${editable ? `
            <div class="field"><label for="story-uses">Uses</label><input id="story-uses" value="${escapeHtml((story.uses || []).join(', '))}" placeholder="behavioral, personal-statement"></div>
            <div class="button-row">
              <button class="button secondary" type="submit">Save revision</button>
              <button class="button" type="button" id="submit-story"
                ${mentorReviewAvailable ? '' : 'disabled aria-describedby="mentor-review-gate"'}>
                ${mentorReviewAvailable
                  ? (story.status === 'needs_revision' ? 'Resubmit to mentors' : 'Submit to mentors')
                  : 'Mentor review unavailable'}
              </button>
            </div>
            ${mentorReviewAvailable ? '' : `
              <div class="callout info" id="mentor-review-gate">
                Mentor review is not enabled yet. Your private story remains editable.
              </div>
            `}
          ` : ''}
        </form>
        ${!editable && state.user.role === 'student' ? '<div class="callout info">This version is read-only while it is with your mentors.</div>' : ''}
      </section>
      <aside class="grid">
        <section class="card">
          <p class="eyebrow">Original capture</p>
          <p>This snapshot cannot be overwritten.</p>
          <div class="original">${escapeHtml(story.original_text || 'No text was captured.')}</div>
        </section>
        <section class="card">
          <p class="eyebrow">Mentor thread</p>
          <div class="feedback">
            ${detail.feedback.length ? detail.feedback.map((item) => `
              <div class="feedback-item"><strong>${escapeHtml(item.mentor_name)}</strong><p>${escapeHtml(item.body)}</p><small>${escapeHtml(formatDate(item.created_at))}</small></div>
            `).join('') : '<p class="hint">No mentor feedback yet.</p>'}
          </div>
        </section>
      </aside>
    </div>
    ${mentor && story.status !== 'approved' ? `
      <section class="card spaced">
        <p class="eyebrow">Full review</p>
        <h2>Respond without rewriting the student’s voice.</h2>
        <div class="field"><label for="mentor-feedback">Feedback or ask</label><textarea class="review-text" id="mentor-feedback" placeholder="Name what is working and the next concrete move."></textarea></div>
        <div class="grid two">
          <div class="field"><label for="classification">Classification</label><select id="classification">
            <option value="">Choose one</option><option>clinical</option><option>leadership</option><option>teamwork</option><option>challenge</option><option>growth</option><option>other</option>
          </select></div>
          <label class="field"><span>Follow-up</span><span><input type="checkbox" id="needs-followup"> Keep in follow-up queue</span></label>
        </div>
        <div class="button-row">
          <button class="button secondary" data-review-status="opened">Add feedback</button>
          <button class="button secondary" data-review-status="needs_revision">Request revision</button>
          <button class="button" data-review-status="approved">Approve</button>
        </div>
      </section>
    ` : mentor ? '<section class="card spaced callout success"><strong>Approved and in coaching history.</strong> A new review requires a new student resubmission; the completed record stays attributed to each mentor.</section>' : ''}
  `, 'Story Workspace');

  document.querySelectorAll('[data-score]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedScore = Number(button.dataset.score);
      document.querySelectorAll('[data-score]').forEach((dot) => {
        dot.classList.toggle('on', Number(dot.dataset.score) <= state.selectedScore);
        dot.setAttribute('aria-pressed', String(Number(dot.dataset.score) === state.selectedScore));
      });
      document.querySelector('.score-key').textContent = `${mentor ? 'Mentor' : 'Self'} · ${state.selectedScore}/5`;
    });
  });

  document.querySelector('#story-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!editable) return;
    try {
      await request(`/api/stories/${story.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: document.querySelector('#workspace-title').value,
          text: document.querySelector('#workspace-text').value,
          studentScore: state.selectedScore,
          uses: document.querySelector('#story-uses').value.split(',').map((item) => item.trim()).filter(Boolean),
          surface: 'workspace',
        }),
      });
      notify('Revision saved.');
      renderStory();
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelector('#submit-story')?.addEventListener('click', async () => {
    try {
      await request(`/api/stories/${story.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: document.querySelector('#workspace-title').value,
          text: document.querySelector('#workspace-text').value,
          studentScore: state.selectedScore,
          uses: document.querySelector('#story-uses').value.split(',').map((item) => item.trim()).filter(Boolean),
          surface: 'workspace',
        }),
      });
      await request(`/api/stories/${story.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ surface: 'workspace' }),
      });
      notify('Story submitted to your assigned mentors.');
      renderStory();
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelectorAll('[data-review-status]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await request(`/api/stories/${story.id}/review`, {
          method: 'POST',
          body: JSON.stringify({
            feedback: document.querySelector('#mentor-feedback').value,
            status: button.dataset.reviewStatus,
            mentorScore: state.selectedScore,
            needsFollowup: document.querySelector('#needs-followup').checked,
            classification: document.querySelector('#classification').value || null,
            surface: 'workspace',
          }),
        });
        notify(button.dataset.reviewStatus === 'approved' ? 'Story approved.' : 'Mentor action saved and student notified.');
        renderStory();
      } catch (error) {
        notify(error.message);
      }
    });
  });
}

async function renderStudents() {
  const { students } = await request('/api/students');
  shell(`
    <div class="page-head"><div><p class="eyebrow">Assigned roster</p><h1>Students</h1>
    <p class="lede">Counts include only students the signed identity may see.</p></div></div>
    <div class="grid three">${students.map((student) => `
      <div class="card student-card">
        <p class="eyebrow">Cohort ${escapeHtml(student.cohort || '—')}</p>
        <h2>${escapeHtml(student.display_name)}</h2>
        <p>${student.story_count} visible stories · ${student.awaiting_review} awaiting review</p>
        <button class="button secondary" data-nav="queue">Open workspace</button>
      </div>
    `).join('') || '<div class="card empty">No assigned students are visible.</div>'}</div>
  `, 'Students');
  bindGlobal();
}

async function renderQueue() {
  const { stories } = await request('/api/queue');
  const buckets = [
    ['all', 'All'],
    ['awaiting_review', 'Awaiting review'],
    ['in_review', 'In review'],
    ['waiting_on_student', 'Waiting on student'],
    ['approved', 'Approved'],
  ];
  const visible = state.queueBucket === 'all' ? stories : stories.filter((story) => story.bucket === state.queueBucket);
  shell(`
    <div class="page-head"><div><p class="eyebrow">Five-bucket queue</p><h1>Review Queue</h1>
    <p class="lede">Opening is separate from reviewing. Every status and notification comes from a committed action.</p></div></div>
    <div class="queue-buckets">${buckets.map(([key, label]) => `
      <button class="button ${state.queueBucket === key ? '' : 'secondary'}" data-bucket="${key}"
        aria-pressed="${state.queueBucket === key}">${label} · ${key === 'all' ? stories.length : stories.filter((story) => story.bucket === key).length}</button>
    `).join('')}</div>
    <div class="section-head"><h2>${escapeHtml(buckets.find(([key]) => key === state.queueBucket)?.[1] || 'All')}</h2></div>
    ${storyRows(visible, 'No stories are in this queue bucket.')}
  `, 'Review Queue');
  bindStoryRows();
  document.querySelectorAll('[data-bucket]').forEach((button) => {
    button.addEventListener('click', () => {
      state.queueBucket = button.dataset.bucket;
      renderQueue().then(() => {
        document.querySelector(`[data-bucket="${state.queueBucket}"]`)?.focus();
      }).catch((error) => notify(error.message));
    });
  });
}

async function renderNotifications() {
  const { notifications } = await request('/api/notifications');
  shell(`
    <div class="page-head"><div><p class="eyebrow">Real coaching events</p><h1>Notifications</h1>
    <p class="lede">A notification exists only because the mentor action and this record committed together.</p></div></div>
    <section class="card">
      ${notifications.length ? notifications.map((item) => `
        <button class="notification ${item.read_at ? 'read' : ''}" data-notification="${item.id}" data-story="${item.story_id || ''}">
          <span class="notification-dot" aria-hidden="true"></span>
          <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.actor_name || 'StoryForge')}</small><p>${escapeHtml(item.body)}</p></span>
          <time>${escapeHtml(formatDate(item.created_at))}</time>
        </button>
      `).join('') : '<div class="empty">No coaching notifications yet.</div>'}
    </section>
  `, 'Notifications');
  document.querySelectorAll('[data-notification]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await request(`/api/notifications/${button.dataset.notification}/read`, { method: 'POST', body: '{}' });
        if (button.dataset.story) navigate('story', button.dataset.story);
        else renderNotifications();
      } catch (error) {
        notify(error.message);
      }
    });
  });
}

async function renderSettings() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selectedBackground = activeBackground();
  shell(`
    <div class="page-head"><div><p class="eyebrow">Settings</p><h1>Your environment.</h1>
    <p class="lede">StoryForge stays dark by default. Your selection is saved to your authenticated profile and follows you across devices.</p></div></div>
    <section class="card">
      <div class="section-head"><div><p class="eyebrow">Background environment</p><h2>Choose the atmosphere, not the authority.</h2></div></div>
      <div class="background-grid">
        ${backgroundEnvironments.map((background) => `
          <button class="background-card ${selectedBackground === background.id ? 'active' : ''}"
            type="button" data-background="${background.id}"
            aria-pressed="${selectedBackground === background.id}">
            <span class="background-preview ${background.id}" aria-hidden="true"></span>
            <span class="background-copy">
              <strong>${escapeHtml(background.name)}</strong>
              <small>${escapeHtml(background.description)}</small>
              ${selectedBackground === background.id ? '<span class="active-environment">Active</span>' : ''}
            </span>
          </button>
        `).join('')}
      </div>
      <p class="hint motion-status">Reduced motion is ${reducedMotion
        ? 'on. Every environment is rendered as a still frame.'
        : 'off. Environments move gently and stop automatically when your system requests reduced motion.'}</p>
    </section>
    <section class="card spaced">
      <div class="setting-row">
        <div><p class="eyebrow">Signed identity</p><h3>${escapeHtml(state.user.display_name)}</h3>
        <p class="hint">${escapeHtml(state.user.role)}${state.user.cohort ? ` · cohort ${escapeHtml(state.user.cohort)}` : ''}. Role and eligibility come from the signed MissionMed session.</p></div>
      </div>
      <div class="setting-row">
        <div><p class="eyebrow">MissionMed Matrix</p><h3>Return to the platform</h3>
        <p class="hint">Leave StoryForge without creating a second sign-out path.</p></div>
        <a class="button secondary settings-matrix-link" href="${escapeHtml(matrixHref())}">← Back to Matrix</a>
      </div>
    </section>
  `, 'Settings');
  document.querySelectorAll('.background-card[data-background]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const payload = await request('/api/preferences/background', {
          method: 'PATCH',
          body: JSON.stringify({ background: button.dataset.background }),
        });
        state.user.background_preference = payload.backgroundPreference;
        applyEnvironment();
        notify(`${backgroundEnvironments.find(({ id }) => id === payload.backgroundPreference)?.name || 'Background'} applied.`);
        await renderSettings();
        document.querySelector(`.background-card[data-background="${payload.backgroundPreference}"]`)?.focus();
      } catch (error) {
        button.disabled = false;
        notify(error.message);
      }
    });
  });
}

async function renderPrep() {
  const [questionData, workshopData, nextData] = await Promise.all([
    request('/api/questions'),
    request('/api/workshops'),
    request('/api/next-questions'),
  ]);
  state.questions = questionData.questions;
  const canImport = ['mentor', 'admin'].includes(state.user.role);
  shell(`
    <div class="page-head"><div><p class="eyebrow">Interview prep</p><h1>Prepare the next natural question.</h1>
    <p class="lede">Question strength belongs to each story–question pair. Student and mentor judgments remain visibly separate.</p></div></div>
    <div class="grid three">
      ${state.questions.filter((question) => question.governance_state === 'approved').slice(0, 6).map((question) => `
        <div class="card question-card"><span class="family">${escapeHtml(question.family)}</span><h2>${escapeHtml(question.text)}</h2>
        <span class="status ${escapeHtml(question.governance_state)}">${escapeHtml(question.governance_state)} · ${escapeHtml(question.provenance)}</span></div>
      `).join('')}
    </div>
    <div class="section-head"><h2>Question Workshops</h2><button class="button secondary" id="new-workshop">New pair</button></div>
    <div class="grid">${workshopData.workshops.map((workshop) => `
      <section class="card">
        <p class="eyebrow">${escapeHtml(workshop.student_name)} · ${escapeHtml(workshop.status)}</p>
        <div class="workshop-pair">
          <div class="workshop-question"><h3>${escapeHtml(workshop.question_a)}</h3><p>Student ${workshop.student_strength_a || '—'} · Mentor ${workshop.mentor_strength_a || '—'}</p></div>
          <span class="versus">versus</span>
          <div class="workshop-question"><h3>${escapeHtml(workshop.question_b)}</h3><p>Student ${workshop.student_strength_b || '—'} · Mentor ${workshop.mentor_strength_b || '—'}</p></div>
        </div>
        ${workshop.student_why ? `<p><strong>Student’s why:</strong> ${escapeHtml(workshop.student_why)}</p>` : ''}
        ${workshop.mentor_coaching_notes ? `<p><strong>Mentor coaching:</strong> ${escapeHtml(workshop.mentor_coaching_notes)}</p>` : ''}
      </section>
    `).join('') || '<div class="card empty">No workshop pair has been created yet.</div>'}</div>
    <div class="section-head"><h2>Next Natural Questions</h2></div>
    <section class="card">
      <form id="next-question-form" class="button-row">
        <input class="grow-input" name="text" aria-label="Next natural question" placeholder="Add a manual follow-up question" required>
        <button class="button" type="submit">Add question</button>
      </form>
      <div class="story-list spaced">${nextData.questions.map((question) => `
        <div class="story-row"><span><strong>${escapeHtml(question.text)}</strong><small>${escapeHtml(question.source)} · ${question.prepared ? 'prepared' : 'working'}</small></span></div>
      `).join('') || '<p class="hint">No manual follow-ups yet.</p>'}</div>
    </section>
    <div class="section-head"><h2>AI suggestions</h2></div>
    <section class="card callout info">
      <strong>Truthful gated state.</strong> General and clinical suggestions are unavailable until their separate founder, DPA, budget, and evaluation gates pass.
      <div class="button-row spaced-sm"><button class="button secondary" id="try-ai">Check availability</button></div>
    </section>
    ${canImport ? `
      <div class="section-head"><h2>Question import</h2></div>
      <section class="card">
        <p>Paste, CSV, and XLSX enter review first. New institutional questions commit as drafts; duplicates remain unchecked.</p>
        <div class="mode-tabs"><button class="active" type="button">Paste</button></div>
        <div class="field"><label for="import-text">One question per line</label><textarea id="import-text" class="review-text"></textarea></div>
        <div class="button-row"><button class="button secondary" id="preview-import">Preview import</button><button class="button" id="commit-import" disabled>Commit selected drafts</button></div>
        <div id="import-preview"></div>
      </section>
    ` : ''}
  `, 'Prep');

  document.querySelector('#new-workshop')?.addEventListener('click', async () => {
    if (state.questions.length < 2) return notify('At least two approved questions are required.');
    const studentId = state.user.role === 'student'
      ? state.user.id
      : (await request('/api/students')).students[0]?.id;
    if (!studentId) return notify('No assigned student is available.');
    try {
      await request('/api/workshops', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          questionAId: state.questions[0].id,
          questionBId: state.questions[1].id,
        }),
      });
      notify('Question pair created.');
      renderPrep();
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelector('#next-question-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const studentId = state.user.role === 'student'
      ? state.user.id
      : (await request('/api/students')).students[0]?.id;
    try {
      await request('/api/next-questions', {
        method: 'POST',
        body: JSON.stringify({ studentId, text: new FormData(event.currentTarget).get('text') }),
      });
      notify('Manual follow-up saved.');
      renderPrep();
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelector('#try-ai')?.addEventListener('click', async () => {
    try {
      await request('/api/ai/suggest', { method: 'POST', body: JSON.stringify({ mode: 'general' }) });
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelector('#preview-import')?.addEventListener('click', async () => {
    try {
      const result = await request('/api/imports/preview', {
        method: 'POST',
        body: JSON.stringify({ format: 'paste', text: document.querySelector('#import-text').value }),
      });
      state.importPreview = result.rows;
      const target = document.querySelector('#import-preview');
      target.innerHTML = state.importPreview.map((row, index) => `
        <label class="import-row">
          <input type="checkbox" data-import-row="${index}" ${row.selected ? 'checked' : ''} ${row.error || row.exactDuplicateId || row.nearDuplicateId ? 'disabled' : ''}>
          <span>${row.rowNumber}</span>
          <span>${escapeHtml(row.text || 'Empty row')}<small class="${row.error ? 'error' : ''}">${escapeHtml(row.error || (row.exactDuplicateId ? 'Exact duplicate' : row.nearDuplicateId ? `Possible duplicate · ${row.similarity}` : 'Ready for draft review'))}</small></span>
          <span>${escapeHtml(row.family)}</span>
        </label>
      `).join('');
      document.querySelector('#commit-import').disabled = !state.importPreview.some((row) => row.selected);
      target.querySelectorAll('[data-import-row]').forEach((input) => input.addEventListener('change', () => {
        state.importPreview[Number(input.dataset.importRow)].selected = input.checked;
        document.querySelector('#commit-import').disabled = !state.importPreview.some((row) => row.selected);
      }));
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelector('#commit-import')?.addEventListener('click', async () => {
    try {
      await request('/api/imports/commit', {
        method: 'POST',
        body: JSON.stringify({
          sourceName: 'pasted-questions',
          format: 'paste',
          rows: state.importPreview,
        }),
      });
      state.importPreview = [];
      notify('Selected questions committed as drafts.');
      renderPrep();
    } catch (error) {
      notify(error.message);
    }
  });
}

async function renderActivity() {
  const stories = state.user.role === 'admin' ? [] : (await request('/api/stories')).stories;
  shell(`
    <div class="page-head"><div><p class="eyebrow">${state.user.role === 'admin' ? 'Least privilege' : 'Real actions'}</p><h1>${state.user.role === 'admin' ? 'Audit boundary' : 'My Activity'}</h1>
    <p class="lede">${state.user.role === 'admin'
      ? 'Audit access is intentionally narrow. No private-story support path is implemented.'
      : 'This view is derived from story lifecycle state and retains the real actor on every coaching action.'}</p></div></div>
    ${state.user.role === 'admin'
      ? '<div class="card callout">The founder must approve an admin support-access policy before any emergency private-story path can exist.</div>'
      : storyRows(stories)}
  `, 'Activity');
  bindStoryRows();
}

async function renderRoute() {
  const route = state.route;
  if (route === 'home') return renderHome();
  if (route === 'library') return renderLibrary();
  if (route === 'capture') return renderCapture();
  if (route === 'story') return renderStory();
  if (route === 'students') return renderStudents();
  if (route === 'queue') return renderQueue();
  if (route === 'notifications') return renderNotifications();
  if (route === 'prep') return renderPrep();
  if (route === 'activity') return renderActivity();
  if (route === 'settings') return renderSettings();
  return navigate('home');
}

function renderLogin(errorMessage = '') {
  applyEnvironment();
  app.innerHTML = `<main class="login" id="main">
    <section class="login-panel">
      <div class="login-art">
        <div class="brand"><span class="brand-mark">S</span><div><strong>StoryForge</strong><small>MissionMed 360</small></div></div>
        <blockquote>“Your story is evidence of how you notice, decide, and grow.”</blockquote>
        <small>Private by default · Original preserved · Real mentor attribution</small>
      </div>
      <div class="login-form">
        <p class="eyebrow">Identity required</p>
        <h1>Enter StoryForge</h1>
        <p>${state.config?.devAuth
          ? 'Choose a locally signed fixture identity. This is test infrastructure, not production WordPress SSO.'
          : 'Open StoryForge through your signed-in MissionMed 360 account.'}</p>
        ${errorMessage ? `<div class="callout">${escapeHtml(errorMessage)}</div>` : ''}
        ${state.config?.devAuth ? `
          <div class="fixture-grid">
            <button class="button" data-persona="student">Student · Maya</button>
            <button class="button secondary" data-persona="mentor">Mentor · Dr. Chen</button>
            <button class="button secondary" data-persona="mentorTwo">Second mentor · Dr. Rivera</button>
            <button class="button secondary" data-persona="unassignedMentor">Unassigned mentor · privacy probe</button>
            <button class="button secondary" data-persona="admin">Admin · least privilege</button>
          </div>
        ` : '<div class="callout">The production StoryForge JWT issuer has not supplied an eligible session.</div>'}
      </div>
    </section>
  </main>`;
  document.querySelectorAll('[data-persona]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await enterFixturePersona(button.dataset.persona);
      } catch (error) {
        renderLogin(error.message);
      }
    });
  });
  focusPrimaryHeading();
}

function parseRoute() {
  const fragment = location.hash.replace(/^#/, '');
  const legacy = fragment === 'main' ? '' : fragment;
  const base = state.config.basePath;
  const relative = legacy || (location.pathname.startsWith(base) ? location.pathname.slice(base.length) : '');
  const [route, id] = relative.replace(/^\/+|\/+$/g, '').split('/');
  state.route = route || 'home';
  state.routeId = id || null;
}

function renderLockout(lockoutState = 'access_unavailable', message = '') {
  applyEnvironment();
  const presentations = {
    eligibility_revoked: {
      eyebrow: 'Access changed',
      heading: 'Your 360 access has changed.',
      fallback: 'StoryForge locked as soon as WordPress reported the eligibility change.',
    },
    session_required: {
      eyebrow: 'Session unavailable',
      heading: 'Your MissionMed session ended.',
      fallback: 'Sign in through MissionMed to return to this exact StoryForge page.',
    },
    session_ended: {
      eyebrow: 'Session unavailable',
      heading: 'Your MissionMed session ended.',
      fallback: 'Sign in through MissionMed to return to this exact StoryForge page.',
    },
    user_not_enabled: {
      eyebrow: 'Access unavailable',
      heading: 'StoryForge is not enabled for this account.',
      fallback: 'Return to Matrix to continue using the tools enabled for this account.',
    },
    role_not_enabled: {
      eyebrow: 'Access unavailable',
      heading: 'StoryForge is not enabled for this account.',
      fallback: 'Return to Matrix to continue using the tools enabled for this account.',
    },
    cohort_not_enabled: {
      eyebrow: 'Access unavailable',
      heading: 'StoryForge is not enabled for this account.',
      fallback: 'Return to Matrix to continue using the tools enabled for this account.',
    },
    storyforge_disabled: {
      eyebrow: 'Pilot unavailable',
      heading: 'StoryForge is not enabled yet.',
      fallback: 'Return to Matrix while this pilot remains off.',
    },
  };
  const presentation = presentations[lockoutState] || {
    eyebrow: 'Temporarily unavailable',
    heading: 'StoryForge could not open safely.',
    fallback: 'Return to Matrix and try again in a moment.',
  };
  app.innerHTML = `<main class="login" id="main">
    <section class="login-panel">
      <div class="login-art">
        <div class="brand"><span class="brand-mark">S</span><div><strong>StoryForge</strong><small>MissionMed 360</small></div></div>
        <blockquote>“Your stories remain preserved.”</blockquote>
      </div>
      <div class="login-form">
        <div role="alert" aria-live="assertive">
          <p class="eyebrow">${presentation.eyebrow}</p>
          <h1>${presentation.heading}</h1>
          <p>${escapeHtml(message || presentation.fallback)}</p>
        </div>
        <a class="button" href="${escapeHtml(matrixHref())}">Back to Matrix</a>
      </div>
    </section>
  </main>`;
  focusPrimaryHeading();
}

function renderStartupFailure() {
  applyEnvironment();
  app.innerHTML = `<main class="login" id="main">
    <section class="login-panel">
      <div class="login-art">
        <div class="brand"><span class="brand-mark">S</span><div><strong>StoryForge</strong><small>MissionMed 360</small></div></div>
        <blockquote>“Your stories were not changed.”</blockquote>
      </div>
      <div class="login-form">
        <div role="alert" aria-live="assertive">
          <p class="eyebrow">Temporarily unavailable</p>
          <h1>StoryForge could not open safely.</h1>
          <p>We could not reach the StoryForge service. Retry, or return to Matrix and come back in a moment.</p>
        </div>
        <div class="button-row">
          <button class="button" type="button" id="retry-startup">Retry</button>
          <a class="button secondary" href="${escapeHtml(matrixHref())}">Back to Matrix</a>
        </div>
      </div>
    </section>
  </main>`;
  document.querySelector('#retry-startup')?.addEventListener('click', () => {
    init();
  });
  focusPrimaryHeading();
}

async function bootstrapSession() {
  try {
    const { user } = await request('/api/session');
    state.user = user;
    state.lockout = null;
    parseRoute();
    const allowed = new Set((routesByRole[user.role] || []).map(([route]) => route).concat('story'));
    if (!allowed.has(state.route)) state.route = 'home';
    await renderRoute();
    focusPrimaryHeading();
  } catch (error) {
    state.user = null;
    if (!error.redirecting && !state.lockout) renderLogin(error.message);
  }
}

async function init() {
  applyEnvironment();
  app.innerHTML = '<main class="boot" id="main"><div role="status" aria-live="polite"><p class="eyebrow">MissionMed 360</p><h1>StoryForge</h1><p>Opening your story workspace…</p></div></main>';
  try {
    state.config = await auth.publicRequest('api/config');
    auth.configure(state.config);
    if (state.config.devAuth) {
      const rememberedPersona = sessionStorage.getItem(fixturePersonaKey);
      if (fixturePersonas.has(rememberedPersona)) {
        await enterFixturePersona(rememberedPersona);
        return;
      }
      renderLogin();
      return;
    }
    await auth.exchange();
    await bootstrapSession();
  } catch (error) {
    if (!error.redirecting && !state.lockout) {
      renderStartupFailure();
    }
  }
}

window.addEventListener('popstate', async () => {
  if (!state.user) return;
  parseRoute();
  try {
    await renderRoute();
    focusPrimaryHeading();
  } catch (error) {
    notify(error.message);
  }
});

document.querySelector('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  const main = document.querySelector('#main');
  const heading = main?.querySelector('h1');
  if (!main || !heading) return;
  main.scrollIntoView({ block: 'start' });
  heading.setAttribute('tabindex', '-1');
  heading.focus();
});

init();
