/* ============================================================================
 * B1-513R2 FINAL REFINEMENT LAYER — appended after the B1-513R module.
 * Same layering law as before: function declarations hoist and the build
 * renames superseded earlier declarations, so this layer REDEFINES a bounded
 * set of R-layer functions and adds the R2 modules:
 *   · Inspiration list-first + LIST|GRID + MY PINNED QUESTIONS + Dr Brian
 *     Recommends (student-owned pin order, drag + accessible reorder)
 *   · Request a Story process strip, preview-before-send, truthful lifecycle
 *   · Relationship-aware guest journeys (parent / friend / faculty-mentor)
 *   · Admin at 100+ scale: directory + queue search/filter/sort/session/
 *     saved views/pagination; above-the-fold Admin Home
 *   · Content Studio tabs (+ Inspiration single-add & safe bulk import)
 *   · DARK / LIGHT / AUTO themes, richer brand header, page introductions
 * Everything else — the production renderer, B1-513 and B1-513R layers —
 * is inherited unchanged.
 * ========================================================================== */

function b1513r2State() {
  const base = b1513State();
  if (!base.r2) {
    base.r2 = {
      layout: '',
      pendingOpen: '',
      homeRecs: null,
      homeRecsLoading: false,
      dragPin: '',
      dir: { session: '', sort: 'attention', page: 1, pages: 1, totalFiltered: 0, sessions: [], moreFilters: false, lastKey: '', activeView: '', savedViews: [
        { key: 'spring-review', label: 'Spring 2026 · Needs Review', state: { filter: 'needs_review', session: '360 Spring 2026', sort: 'attention' } },
        { key: 'summer-quiet', label: 'Summer 2026 · Never Started', state: { filter: 'never_active', session: '360 Summer 2026', sort: 'name' } },
        { key: 'all-inactive', label: 'All · Quiet 30+ days', state: { filter: 'inactive_30', session: '', sort: 'quiet' } },
      ] },
      queue: { loaded: false, list: [], q: '', session: '', sort: 'oldest', page: 1, pages: 1, totalFiltered: 0, sessions: [], lastKey: '' },
      adminHome: null,
      content: { tab: 'categories', addOpen: false, importOpen: false, csv: '', parsed: null, committed: 0 },
      invitePreview: null,
      editingInviteId: '',
    };
  }
  return base.r2;
}

const b1513r2Api = {
  theme: (theme) => auth.request('/api/preferences/theme', jsonOptions('POST', { theme })),
  layout: (layout) => auth.request('/api/preferences/inspiration-layout', jsonOptions('POST', { layout })),
  pin: (id) => auth.request(`/api/inspiration/pin/${id}`, jsonOptions('POST', {})),
  pinOrder: (ids) => auth.request('/api/inspiration/pin-order', jsonOptions('POST', { ids })),
  guestStarted: (token) => auth.publicRequest(`api/requests/guest/${token}/started`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }),
  updateInvite: (id, body) => auth.request(`/api/requests/${id}/update`, jsonOptions('POST', body)),
  bulkParse: (csv) => auth.request('/api/admin/console/inspiration/bulk-parse', jsonOptions('POST', { csv })),
  bulkCommit: (rows) => auth.request('/api/admin/console/inspiration/bulk-commit', jsonOptions('POST', { rows })),
};

/* ---------------- DARK / LIGHT / AUTO theme ---------------- */

function b1513r2ThemePref() {
  const saved = state.user?.theme_preference;
  return ['dark', 'light', 'auto'].includes(saved) ? saved : 'dark';
}

function b1513r2SyncTheme() {
  const pref = b1513r2ThemePref();
  const resolved = pref === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : pref;
  document.body.dataset.themePref = pref;
  document.body.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f4efe6' : '#0a0d14');
}

/* ---------------- universal page introductions (§26) ---------------- */

function b1513r2PageIntro(key) {
  const map = {
    library: ['Every story you have ever captured — safe, private, and ready to work.', 'Set a Story Priority, watch review status, and open any story to keep telling it.'],
    notifications: ['Everything your mentor does on your stories lands here the moment it happens.', ''],
    settings: ['Your appearance, privacy, notification, and invitation choices — all real, all yours.', ''],
    adminHome: ['Who needs you, what to do next, and what changed — before you scroll.', ''],
    students: ['The whole roster, live from the canonical entitlement — at any cohort size.', 'Search, filter by attention or session, sort, or jump straight in from a saved view.'],
    queue: ['The longest-waiting student is always on top — no submission gets lost.', 'Search, session, and status narrow it in one click. Reviews open in the same Story Room the student uses.'],
    content: ['Everything students read, in one governed place — with preview before publish.', 'Pick a tab, make the change, preview it in this browser, then publish. Every publish is versioned and audited.'],
    system: ['Authorization and runtime state only — deliberately harder to change by accident.', ''],
  };
  const [value, how] = map[key] || ['', ''];
  if (!value) return '';
  return `<p class="b1513r2Intro">${esc(value)}${how ? ` <span class="b1513r2IntroHow">${esc(how)}</span>` : ''}</p>`;
}

/* ---------------- Inspiration: LIST-first + pins + recommendations ---------------- */

async function b1513rLoadBrowse() {
  const browse = b1513rState().browse;
  const query = new URLSearchParams();
  if (browse.q) query.set('q', browse.q);
  if (browse.who) query.set('who', browse.who);
  if (browse.domain) query.set('domain', browse.domain);
  if (browse.energy) query.set('energy', browse.energy);
  if (browse.fav) query.set('fav', '1');
  const payload = await b1513rApi.browse(query.toString());
  browse.prompts = asArray(payload?.prompts);
  browse.favoriteCount = Number(payload?.favoriteCount || 0);
  browse.pinnedList = asArray(payload?.pinned);
  browse.loaded = true;
}

function b1513r2PromptMarks(prompt) {
  return `${prompt.recommended ? '<span class="b1513r2Rec" title="Recommended by Dr Brian">✪ Dr Brian recommends</span>' : ''}
    ${prompt.answeredStoryId ? `<button class="b1513r2Answered" type="button" data-open-story="${attr(prompt.answeredStoryId)}" title="You answered this — open the story">✓ In your Library</button>` : ''}`;
}

function b1513r2PromptControls(prompt) {
  return `<span class="b1513r2PromptCtl">
    <button class="starBtn b1513rFav ${prompt.favorite ? 'on' : ''}" type="button" data-b1513r-fav="${attr(prompt.id)}" aria-pressed="${prompt.favorite}" aria-label="${prompt.favorite ? 'Remove from favorites' : 'Add to favorites'}" title="Favorite — save it because you like it">★</button>
    <button class="b1513r2PinBtn ${prompt.pinned ? 'on' : ''}" type="button" data-b1513r2-pin="${attr(prompt.id)}" aria-pressed="${prompt.pinned}" aria-label="${prompt.pinned ? 'Unpin question' : 'Pin question to work on'}" title="Pin — you intend to work on this">📌</button>
  </span>`;
}

function b1513r2AnswerEditor(prompt) {
  const browse = b1513rState().browse;
  return `<div class="b1513rPromptAnswer">
    ${prompt.followUp ? `<p class="b1513FollowUp" data-b1513-followup ${browse.answer.trim() ? '' : 'hidden'}>↳ ${esc(prompt.followUp)}</p>` : ''}
    <label class="srOnly" for="b1513rBrowseAnswer">Your answer</label>
    <textarea id="b1513rBrowseAnswer" class="storyProse storyProseEdit b1513AnswerBox" data-b1513-answer placeholder="${state.capabilities?.voiceCapture ? 'Type here — or tap the mic and just talk…' : 'Type what this brings back…'}">${esc(browse.answer)}</textarea>
    ${browse.voice ? `<div class="voxDock rec b1513VersionDock"><div class="voxRow"><span class="voxTimer"><span class="rdot" aria-hidden="true"></span><span data-b1513-rec-clock>0:0${Math.min(9, browse.voice.seconds)}</span></span>
      <span class="voxWave" aria-hidden="true">${Array.from({ length: 13 }, () => '<i></i>').join('')}</span>
      <button class="voxBtn done" type="button" data-b1513r-browse-rec-done>Done</button><button class="voxGhost" type="button" data-b1513r-browse-rec-cancel>Discard</button></div>
      <div class="voxState" role="status" aria-live="polite">🎤 StoryForge types while you talk — edit anything after.</div></div>` : ''}
    <div class="b1513ConvertRow" data-b1513-convert ${browse.answer.trim() ? '' : 'hidden'}>
      ${prompt.interviewUse ? `<p class="b1513WhyWorks">💡 <b>Why this works in an interview:</b> ${esc(prompt.interviewUse)}</p>` : ''}
      <label class="fLbl" for="b1513Change">What did it change? <span>— optional, one honest sentence. It becomes this story’s Learning Lesson.</span></label>
      <input id="b1513Change" data-b1513-change placeholder="What this moment changed about you, or taught you…" maxlength="240" value="${attr(browse.changeNote)}">
    </div>
    <div class="inlineActions">
      ${!browse.voice && state.capabilities?.voiceCapture ? '<button class="rowBtn" type="button" data-b1513r-browse-voice>🎤 Talk instead</button>' : ''}
      <button class="noteSend" type="button" data-b1513r-browse-add ${browse.answer.trim() ? '' : 'disabled'}>Add to StoryForge Library</button>
      <button class="rowBtn" type="button" data-b1513-save-later>Save for later</button>
      <button class="rowBtn" type="button" data-b1513r-close-prompt>Close</button>
    </div>
  </div>`;
}

function b1513r2PromptListRow(prompt) {
  const browse = b1513rState().browse;
  const open = browse.openPromptId === prompt.id;
  return `<article class="b1513r2QRow ${open ? 'open' : ''}" data-b1513r-prompt-card="${attr(prompt.id)}">
    <div class="b1513r2QRowMain">
      <div class="b1513r2QText">
        <p class="b1513rPromptText">${esc(prompt.text)}</p>
        <div class="b1513r2QMeta"><span class="b1513r2QTag">${esc(String(prompt.territory || '').replaceAll('_', ' '))}</span>${b1513r2PromptMarks(prompt)}</div>
      </div>
      ${b1513r2PromptControls(prompt)}
      <button class="rowBtn pri" type="button" data-b1513r-answer-now="${attr(prompt.id)}">${open ? 'Answering…' : 'Answer'}</button>
    </div>
    ${open ? b1513r2AnswerEditor(prompt) : ''}
  </article>`;
}

function b1513rBrowseCard(prompt) {
  const browse = b1513rState().browse;
  const open = browse.openPromptId === prompt.id;
  return `<article class="b1513rPromptCard ${open ? 'open' : ''}" data-b1513r-prompt-card="${attr(prompt.id)}">
    <div class="b1513rPromptTop">
      <p class="b1513rPromptText">${esc(prompt.text)}</p>
      ${b1513r2PromptControls(prompt)}
    </div>
    <div class="b1513rPromptMeta"><span>${esc(String(prompt.territory || '').replaceAll('_', ' '))}</span>${b1513r2PromptMarks(prompt)}</div>
    ${open ? b1513r2AnswerEditor(prompt) : `<div class="inlineActions b1513rPromptActions">
      <button class="rowBtn pri" type="button" data-b1513r-answer-now="${attr(prompt.id)}">Answer now</button>
      <button class="rowBtn" type="button" data-b1513r-save-later-id="${attr(prompt.id)}">Save for later</button>
    </div>`}
  </article>`;
}

function b1513r2PinnedSection() {
  const browse = b1513rState().browse;
  const pinned = asArray(browse.pinnedList);
  return `<div class="panel b1513r2Pinned"><div class="pHead"><div class="h2">My pinned <em>questions</em></div>
    <span class="stageHint">${pinned.length ? `${pinned.length} pinned · ` : ''}Questions you intend to work on — in your order. Drag, or use ↑ ↓.</span></div>
    <div class="pBody" data-b1513r2-pin-list>
    ${pinned.length ? pinned.map((prompt, index) => `<div class="b1513r2PinItem ${b1513r2State().dragPin === prompt.id ? 'dragging' : ''}" draggable="true" data-b1513r2-pin-item="${attr(prompt.id)}">
      <span class="b1513r2PinHandle" aria-hidden="true" title="Drag to reorder">⠿</span>
      <span class="b1513r2PinNo">${index + 1}</span>
      <span class="b1513r2PinText">${esc(prompt.text)}
        <span class="b1513r2QMeta">${prompt.recommended ? '<span class="b1513r2Rec">✪ Dr Brian recommends</span>' : ''}${prompt.answeredStoryId ? `<button class="b1513r2Answered" type="button" data-open-story="${attr(prompt.answeredStoryId)}">✓ Answered — open the story</button>` : ''}</span>
      </span>
      <span class="b1513r2PinActions">
        <button class="rowBtn" type="button" data-b1513r2-pin-move="-1" data-pin-id="${attr(prompt.id)}" ${index === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="rowBtn" type="button" data-b1513r2-pin-move="1" data-pin-id="${attr(prompt.id)}" ${index === pinned.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        ${prompt.answeredStoryId ? '' : `<button class="rowBtn pri" type="button" data-b1513r-answer-now="${attr(prompt.id)}">Answer</button>`}
        <button class="rowBtn" type="button" data-b1513r2-pin="${attr(prompt.id)}" aria-label="Unpin">Unpin</button>
      </span>
    </div>`).join('') : '<div class="stageHint">Nothing pinned yet. 📌 a question below and it waits for you here, in your order — separate from ★ favorites, which are simply questions you like.</div>'}
    </div></div>`;
}

function renderInspiration() {
  const insp = b1513State().inspiration;
  const browse = b1513rState().browse;
  const r2 = b1513r2State();
  if (!r2.layout) r2.layout = ['list', 'grid'].includes(state.user?.inspiration_layout) ? state.user.inspiration_layout : 'list';
  if (r2.pendingOpen) {
    browse.openPromptId = r2.pendingOpen;
    browse.answer = '';
    browse.changeNote = '';
    b1513State().inspiration.prompt = browse.prompts.find((item) => item.id === r2.pendingOpen) || null;
    b1513State().inspiration.answer = '';
    r2.pendingOpen = '';
  }
  const mode = browse.mode;
  const filters = (items, key, current) => items.map((item) => `<button class="cChip ${current === item.id ? 'on' : ''}" type="button" data-b1513r-browse-filter="${attr(key)}" data-b1513r-filter-value="${attr(current === item.id ? '' : item.id)}" aria-pressed="${current === item.id}">${esc(item.label)}</button>`).join('');
  const dims = insp.dimensions || { who: [], domain: [], energy: [] };
  const searching = Boolean(browse.q || browse.fav || browse.who || browse.domain || browse.energy);
  const list = browse.prompts;

  main.innerHTML = `<section data-view="inspiration" class="live b1513Inspiration">
    <div class="b1513rInspHero">
      ${b1513rFullBody(state.user?.id, 'b1513rInspBody')}
      <div>
        <div class="eyebrow">Inspiration</div>
        <h1 class="h1">Find the stories you <em>forgot you had</em>.</h1>
        <p class="b1513r2Intro">Real memory questions, built from research on how memory actually works.
          <span class="b1513r2IntroHow">Answer any that spark something — typing or just talking (🎤). Good answers become ordinary stories in <b>your Library</b>: same privacy, same review flow. ★ favorite what you like, 📌 pin what you intend to answer, and let <b>Guide Me</b> walk you there when you’re unsure where to start.</span></p>
      </div>
    </div>
    <div class="voiceTabs b1513rInspModes" role="tablist" aria-label="Inspiration modes">
      <button type="button" role="tab" class="${mode === 'browse' ? 'on' : ''}" aria-selected="${mode === 'browse'}" data-b1513r-insp-mode="browse">Browse questions</button>
      <button type="button" role="tab" class="${mode === 'guide' ? 'on' : ''}" aria-selected="${mode === 'guide'}" data-b1513r-insp-mode="guide">✨ Guide Me</button>
      <button type="button" role="tab" class="${mode === 'saved' ? 'on' : ''}" aria-selected="${mode === 'saved'}" data-b1513r-insp-mode="saved">Saved &amp; unfinished (${insp.saved.length})</button>
    </div>

    ${mode === 'browse' ? `
    ${searching ? '' : b1513r2PinnedSection()}
    <form class="listBar b1513rBrowseBar" id="b1513rBrowseSearch" role="search">
      <label class="srOnly" for="b1513rBrowseQ">Search questions</label>
      <input id="b1513rBrowseQ" type="search" placeholder="Search questions… (food, travel, first job…)" value="${attr(browse.q)}" autocomplete="off">
      <button class="rowBtn pri" type="submit">Search</button>
      <button class="cChip b1513rFavFilter ${browse.fav ? 'on' : ''}" type="button" data-b1513r-browse-fav aria-pressed="${browse.fav}">★ Favorites${browse.favoriteCount ? ` (${browse.favoriteCount})` : ''}</button>
      <span class="b1513r2LayoutSeg" role="group" aria-label="Layout">
        <button class="${r2.layout === 'list' ? 'on' : ''}" type="button" data-b1513r2-layout="list" aria-pressed="${r2.layout === 'list'}">☰ LIST</button>
        <button class="${r2.layout === 'grid' ? 'on' : ''}" type="button" data-b1513r2-layout="grid" aria-pressed="${r2.layout === 'grid'}">▦ GRID</button>
      </span>
      <span class="countNote">${list.length} questions</span>
    </form>
    <div class="classChips b1513rBrowseFilters" role="group" aria-label="Filters">
      ${filters(dims.who, 'who', browse.who)}<span class="b1513rFilterSep" aria-hidden="true">·</span>
      ${filters(dims.domain, 'domain', browse.domain)}<span class="b1513rFilterSep" aria-hidden="true">·</span>
      ${filters(dims.energy, 'energy', browse.energy)}
    </div>
    ${r2.layout === 'grid'
      ? `<div class="b1513rPromptGrid">${list.length ? list.map(b1513rBrowseCard).join('') : emptyState('No questions match.', 'Clear a filter or search for something else.')}</div>`
      : `<div class="b1513r2QList">${list.length ? list.map(b1513r2PromptListRow).join('') : emptyState('No questions match.', 'Clear a filter or search for something else.')}</div>`}` : ''}

    ${mode === 'guide' ? `<div class="homeGrid b1513InspirationGrid">
      <div class="panel b1513WizardPanel"><div class="pBody" data-b1513-wizard>${b1513WizardStepMarkup()}</div></div>
      <div><div class="panel"><div class="pHead"><div class="h2">Why <em>Guide Me</em></div></div><div class="pBody"><p class="stageHint">A few gentle choices, then one question at a time. Skip anything, stop any time — your progress is saved.</p></div></div></div>
    </div>` : ''}

    ${mode === 'saved' ? `<div class="panel"><div class="pBody">
      ${insp.saved.length ? insp.saved.map((item) => `<div class="shortItem b1513SavedItem">
        <span class="si">${esc(item.promptText)}</span><span class="sd">Saved ${esc(ago(item.savedAt))}${item.draft ? ' · has a draft' : ''}</span>
        <span class="inlineActions"><button class="rowBtn pri" type="button" data-b1513-resume-saved="${attr(item.id)}">Answer now</button>
        <button class="rowBtn" type="button" data-b1513-remove-saved="${attr(item.id)}">Remove</button></span>
      </div>`).join('') : '<div class="stageHint">Questions you save — and answers you haven’t finished — land here, ready for the moment you have two minutes.</div>'}
    </div></div>` : ''}
  </section>`;
}

/* Home: compact Dr Brian Recommends strip (override of the base link) */
function b1513HomeInspirationLink() {
  if (!isStudent() || !b1513FeatureOn('inspiration')) return '';
  const r2 = b1513r2State();
  if (!r2.homeRecs && !r2.homeRecsLoading) {
    r2.homeRecsLoading = true;
    b1513rApi.browse('').then((payload) => {
      r2.homeRecs = asArray(payload?.prompts).filter((prompt) => prompt.recommended && !prompt.answeredStoryId).slice(0, 2);
      if (!r2.homeRecs.length) r2.homeRecs = asArray(payload?.prompts).filter((prompt) => prompt.recommended).slice(0, 2);
      if (state.route === 'home') renderRoute();
    }).catch(() => { r2.homeRecs = []; });
  }
  const recs = asArray(r2.homeRecs);
  return `<div class="b1513r2HomeRecs">
    ${recs.length ? `<div class="b1513r2HomeRecHead">✪ <b>Dr Brian recommends</b> <span>questions picked for this cohort</span></div>
    ${recs.map((prompt) => `<button class="b1513r2HomeRec" type="button" data-b1513r2-home-rec="${attr(prompt.id)}">“${esc(prompt.text)}”<span>Answer it ▸</span></button>`).join('')}` : ''}
    <button class="rowBtn b1513HomeInspiration" type="button" data-nav="inspiration">✧ Can’t think of a story? Open <b>Inspiration</b> ▸</button>
  </div>`;
}

/* ---------------- Request a Story: process, truthful lifecycle, preview-before-send ---------------- */

function b1513rInviteStatusChip(invitation) {
  const map = {
    draft: ['Draft — not sent', 'st-private', 'Nothing has been sent. Preview it, then send when it feels right.'],
    sent: ['Sent', 'st-awaiting', 'Handed to the email service — waiting for delivery confirmation.'],
    delivered: ['Delivered ✓', 'st-awaiting', 'The email service confirmed delivery to their inbox.'],
    opened: ['Opened (approximate)', 'st-awaiting', 'Email-open signals are approximate — never treated as “read”.'],
    link_visited: ['Link visited', 'st-in_review', 'They opened their private page. The strongest signal before a story arrives.'],
    started: ['Started telling', 'st-in_review', 'They began recording or typing a story.'],
    story_shared: ['Story shared ✓', 'st-approved', 'A story arrived. It’s in your candidates.'],
    expired: ['Expired', 'st-changes', 'The link stopped working after 30 days. You can send a fresh invitation.'],
    revoked: ['Revoked', 'st-changes', 'You cancelled this link. It stopped working immediately.'],
    bounced: ['Bounced — check address', 'st-changes', 'The email could not be delivered. Check the address and re-send.'],
  };
  const [label, cls, hint] = map[invitation.status] || [invitation.status, '', ''];
  return `<span class="stChip ${cls}" title="${attr(hint)}">${esc(label)}</span>`;
}

function b1513r2InviteLastEvent(invitation) {
  const events = [
    [invitation.contributedAt, 'story shared'],
    [invitation.startedAt, 'started telling'],
    [invitation.linkVisitedAt, 'visited their link'],
    [invitation.bouncedAt, 'bounced'],
    [invitation.deliveredAt, 'delivered'],
    [invitation.sentAt, 'sent'],
  ].filter(([at]) => at);
  if (!events.length) return 'not sent yet';
  events.sort((a, b) => new Date(b[0]) - new Date(a[0]));
  return `${events[0][1]} ${ago(events[0][0])}`;
}

function b1513r2ProcessStrip() {
  const steps = [
    ['1', 'Choose someone', 'A parent, a mentor, an old friend — anyone who tells your stories better than you do.'],
    ['2', 'Personalize your request', 'Your name, your note, your face. You preview the exact email before anything sends.'],
    ['3', 'They share a memory', 'One private link. No account, no app — they just talk, and StoryForge writes it down.'],
    ['4', 'You receive their story', 'It arrives as a private candidate: keep it, use it as inspiration, or promote it into your Library.'],
  ];
  return `<div class="b1513r2Process" role="list" aria-label="How Request a Story works">
    ${steps.map(([n, title, body]) => `<div class="b1513r2Step" role="listitem"><span class="b1513r2StepNo">${n}</span><b>${esc(title)}</b><span>${esc(body)}</span></div>`).join('<span class="b1513r2StepArrow" aria-hidden="true">→</span>')}
  </div>`;
}

function renderRequests() {
  const requests = b1513rState().requests;
  const r2 = b1513r2State();
  const view = requests.view;
  const newCount = requests.contributions.filter((item) => item.state === 'new').length;
  const contributedCount = (invitation) => requests.contributions.filter((item) => item.invitationId === invitation.id).length;

  if (view === 'new') return b1513rRenderNewInvite();
  if (view === 'preview' && r2.invitePreview) return b1513r2RenderSendPreview();

  main.innerHTML = `<section data-view="requests" class="live b1513rRequests">
    <div class="b1513rInspHero">
      ${b1513rFullBody(state.user?.id, 'b1513rInspBody')}
      <div>
        <div class="eyebrow">Request a Story</div>
        <h1 class="h1">The people who know you <em>remember stories you can’t</em>.</h1>
        <p class="b1513r2Intro">Invite the people who know you best to tell stories <i>about</i> you — in their own voice.
          <span class="b1513r2IntroHow">Inspiration helps <i>you</i> remember. Request a Story asks <i>them</i>. Whatever they share arrives privately, only to you.</span></p>
      </div>
    </div>
    ${b1513r2ProcessStrip()}

    <div class="homeGrid b1513rReqGrid">
      <div class="panel"><div class="pHead"><div class="h2">Story <em>candidates</em>${newCount ? `<span class="newEmber">${newCount} new</span>` : ''}</div></div><div class="pBody">
        ${requests.contributions.length ? requests.contributions.filter((item) => item.state !== 'archived').map((item) => `<article class="b1513rCandidate ${item.state}">
          <div class="b1513rCandTop">
            ${b1513rHeadshot('guest-rosa', { withName: false, size: 'sm' })}
            <div class="b1513rCandWho"><b>${esc(item.contributorFirstName)}</b> <span class="dim">· ${esc((requests.relationships.find((rel) => rel.id === item.relationship)?.label || item.relationship))}</span>
              <small>${item.kind === 'voice' ? `🎤 spoken · ${formatDuration(item.durationMs)}` : '⌨ written'} · ${esc(ago(item.submittedAt))}${item.state === 'promoted' ? ' · ✓ promoted to your Library' : ''}</small></div>
            <button class="starBtn ${item.state === 'favorite' ? 'on' : ''}" type="button" data-b1513r-cand-fav="${attr(item.id)}" aria-pressed="${item.state === 'favorite'}" aria-label="Favorite this candidate">★</button>
          </div>
          <div class="b1513rCandPrompt">They answered: “${esc(item.promptText.replaceAll('{name}', firstName()))}”</div>
          <div class="b1513rCandBody">“${esc(item.transcript.length > 260 ? `${item.transcript.slice(0, 260)}…` : item.transcript)}”</div>
          <div class="inlineActions">
            ${item.kind === 'voice' ? `<button class="rowBtn" type="button" data-play-audio="aud-101" aria-label="Play ${attr(item.contributorFirstName)}’s recording">▶ Listen</button>` : ''}
            ${item.state !== 'promoted' ? `<button class="noteSend" type="button" data-b1513r-cand-promote="${attr(item.id)}">Promote to StoryForge Library</button>
            <button class="rowBtn" type="button" data-b1513r-cand-archive="${attr(item.id)}">Dismiss</button>` : `<button class="rowBtn" type="button" data-open-story="${attr(item.promotedStoryId)}">Open the story ▸</button>`}
          </div>
        </article>`).join('') : '<div class="storyEmpty">When someone answers your invitation, their story lands here — private, just for you.</div>'}
      </div></div>

      <div class="panel"><div class="pHead"><div class="h2">Your <em>invitations</em></div><button class="pMore noteSend b1513rNewInviteBtn" type="button" data-b1513r-new-invite>＋ Ask someone</button></div><div class="pBody">
        ${requests.invitations.length ? requests.invitations.map((invitation) => `<div class="b1513rInviteRow">
          <div class="rMain"><span class="rTitle">${esc(invitation.contributorName)} <span class="dim">· ${esc((requests.relationships.find((rel) => rel.id === invitation.relationship)?.label || invitation.relationship))}</span></span>
            <span class="rSub">${esc(invitation.emailMasked)} · ${esc(b1513r2InviteLastEvent(invitation))}${contributedCount(invitation) ? ` · <b>${contributedCount(invitation)} ${contributedCount(invitation) === 1 ? 'story' : 'stories'} shared</b>` : ''} · expires ${esc(formatDate(invitation.expiresAt))}${invitation.videoGreeting ? ' · 🎬 video greeting' : ''}</span></div>
          ${b1513rInviteStatusChip(invitation)}
          <div class="inlineActions">
            ${invitation.status === 'draft' ? `<button class="noteSend" type="button" data-b1513r2-inv-preview-send="${attr(invitation.id)}">Preview &amp; send</button>` : `<button class="rowBtn" type="button" data-b1513r-invite-preview="${attr(invitation.id)}">Email sent</button>`}
            <button class="rowBtn" type="button" data-b1513r-guest-preview="${attr(invitation.token)}">See their view</button>
            ${['sent', 'delivered', 'link_visited', 'started'].includes(invitation.status) ? `<button class="rowBtn" type="button" data-b1513r-invite-resend="${attr(invitation.id)}">Gentle reminder</button>` : ''}
            ${invitation.status === 'bounced' ? `<button class="rowBtn" type="button" data-b1513r2-reinvite="${attr(invitation.id)}" title="A bounced address is dead — start fresh with a corrected one">Re-invite with a new address</button>` : ''}
            ${invitation.status !== 'revoked' ? `<button class="rowBtn danger" type="button" data-b1513r-invite-revoke="${attr(invitation.id)}">Revoke</button>` : ''}
          </div>
        </div>`).join('') : '<div class="stageHint">No invitations yet. Ask a parent, a mentor, an old friend — the people who tell your stories better than you do.</div>'}
        ${requests.emailPreview ? `<div class="b1513ReviewCheckPreview" role="region" aria-label="Email preview">
          <div class="rLbl">Email preview — exactly what was assembled for sending</div>
          <p class="b1513ReviewCheckText"><b>Subject:</b> ${esc(requests.emailPreview.subject)}</p>
          <pre class="b1513rEmailBody">${esc(requests.emailPreview.body)}</pre>
          <p class="stageHint">${esc(requests.emailPreview.note)}</p>
          <button class="rowBtn" type="button" data-b1513r-preview-close>Close preview</button>
        </div>` : ''}
      </div></div>
    </div>
  </section>`;
}

function b1513rRenderNewInvite() {
  const requests = b1513rState().requests;
  const r2 = b1513r2State();
  const draft = requests.draft;
  const relationships = requests.relationships;
  const primary = relationships.filter((rel) => ['parent', 'sibling', 'best_friend'].includes(rel.id));
  const rest = relationships.filter((rel) => !['parent', 'sibling', 'best_friend'].includes(rel.id));
  main.innerHTML = `<section data-view="requests" class="live b1513rRequests">
    <button class="backBtn" type="button" data-b1513r-req-back>‹ Request a Story</button>
    <div class="eyebrow">Step 1 of 2 · Choose &amp; personalize</div>
    <h1 class="h1">Who knows this <em>story of you</em>?</h1>
    <form id="b1513rInviteForm" class="panel b1513rInviteForm"><div class="pBody">
      <div class="fLbl">They are your…</div>
      <div class="b1513Choices">
        ${primary.map((rel) => `<button type="button" class="b1513Choice ${draft.relationship === rel.id ? 'on' : ''}" data-b1513r-rel="${attr(rel.id)}" aria-pressed="${draft.relationship === rel.id}"><span class="b1513ChoiceLabel">${esc(rel.label)}</span></button>`).join('')}
        ${!requests.relMore ? '<button type="button" class="b1513Choice b1513More" data-b1513r-rel-more><span class="b1513ChoiceLabel">More…</span><span class="b1513ChoiceHint">Grandparent, mentor, coworker…</span></button>' : ''}
      </div>
      ${requests.relMore ? `<div class="classChips b1513rRelMore">${rest.map((rel) => `<button type="button" class="cChip ${draft.relationship === rel.id ? 'on' : ''}" data-b1513r-rel="${attr(rel.id)}" aria-pressed="${draft.relationship === rel.id}">${esc(rel.label)}</button>`).join('')}</div>` : ''}
      <p class="stageHint b1513r2RelHint">The questions they see are shaped by who they are to you — a parent gets childhood and family; a friend gets your life outside medicine; a mentor gets how you learn and grow.</p>
      <label class="fLbl" for="b1513rInvName">Their first name <span>— how they’ll be greeted</span></label>
      <input id="b1513rInvName" maxlength="40" placeholder="Mom, Dr. Ito, Sam…" value="${attr(draft.contributorName)}" required>
      <label class="fLbl" for="b1513rInvEmail">Their email</label>
      <input id="b1513rInvEmail" type="email" placeholder="name@example.com" value="${attr(draft.email)}" required>
      <label class="fLbl" for="b1513rInvMsg">A personal note <span>— optional, shown in the invitation</span></label>
      <textarea id="b1513rInvMsg" rows="2" maxlength="280" placeholder="Mom — I’m collecting stories for my applications. Anything you remember counts.">${esc(draft.personalMessage)}</textarea>
      <div class="setRow"><div class="sTxt"><b>🎬 Personal video greeting</b><span>Optional: record a short private video that plays when they open your invitation. Stored through StoryForge’s private media design (currently deferred — shown as a state demo).</span></div>
        <button class="rowBtn" type="button" data-b1513r-video-demo>Record after sending</button></div>
      <p class="stageHint">They get one private link — no account, no app, no access to anything of yours. It expires in 30 days, you can revoke it any time, and whatever they share goes only to you.</p>
      <div class="inlineActions"><button class="noteSend" type="submit">${r2.editingInviteId ? 'Update & preview' : 'Continue — preview before sending'} ▸</button><button class="rowBtn" type="button" data-b1513r-req-back>Cancel</button></div>
      <p class="stageHint">Nothing sends yet. Next you’ll see the exact email — you send it from there.</p>
    </div></form>
  </section>`;
}

function b1513r2RenderSendPreview() {
  const requests = b1513rState().requests;
  const r2 = b1513r2State();
  const { invitation, preview } = r2.invitePreview;
  const relationshipLabel = requests.relationships.find((rel) => rel.id === invitation.relationship)?.label || invitation.relationship;
  main.innerHTML = `<section data-view="requests" class="live b1513rRequests">
    <button class="backBtn" type="button" data-b1513r2-edit-invite="${attr(invitation.id)}">‹ Edit the request</button>
    <div class="eyebrow">Step 2 of 2 · Preview, then send</div>
    <h1 class="h1">Exactly what <em>${esc(invitation.contributorName)}</em> will receive.</h1>
    <div class="homeGrid b1513r2PreviewGrid">
      <div class="panel b1513r2EmailCard"><div class="pBody">
        <div class="b1513r2EmailMetaRow"><span class="fLbl">To</span><span>${esc(invitation.contributorName)} <span class="dim">· ${esc(relationshipLabel)} · ${esc(invitation.emailMasked)}</span></span></div>
        <div class="b1513r2EmailMetaRow"><span class="fLbl">From</span><span class="dim">${esc(preview.from)}</span></div>
        <div class="b1513r2EmailMetaRow"><span class="fLbl">Subject</span><b>${esc(preview.subject)}</b></div>
        <div class="b1513r2EmailPaper">
          <div class="b1513r2EmailIdentity">${b1513rHeadshot(state.user, { size: 'lg', sub: 'MissionMed StoryForge' })}</div>
          <pre class="b1513rEmailBody">${esc(preview.body)}</pre>
          ${invitation.videoGreeting ? '<p class="stageHint">🎬 Your video greeting plays on their private page after they open the link.</p>' : ''}
        </div>
        <p class="stageHint">${esc(preview.note)}</p>
      </div></div>
      <div>
        <div class="panel"><div class="pHead"><div class="h2">Before it <em>goes</em></div></div><div class="pBody">
          <div class="setRow"><div class="sTxt"><b>Their questions</b><span>Shaped for a ${esc(relationshipLabel.toLowerCase())} — see the exact experience first if you like.</span></div>
            <button class="rowBtn" type="button" data-b1513r-guest-preview="${attr(invitation.token)}">See their view</button></div>
          <div class="setRow"><div class="sTxt"><b>Your note</b><span>${invitation.personalMessage ? `“${esc(invitation.personalMessage)}”` : 'No personal note — you can add one.'}</span></div>
            <button class="rowBtn" type="button" data-b1513r2-edit-invite="${attr(invitation.id)}">Edit</button></div>
          <div class="setRow"><div class="sTxt"><b>What they’re told</b><span>Honestly: their story goes to your private workspace, may be used in residency preparation, and may be shared with your MissionMed mentor.</span></div></div>
          <div class="inlineActions b1513r2ConfirmRow">
            <button class="noteSend b1513r2ConfirmSend" type="button" data-b1513r2-confirm-send="${attr(invitation.id)}">CONFIRM &amp; SEND ➤</button>
            <button class="rowBtn" type="button" data-b1513r2-send-later>Keep as draft</button>
          </div>
          <p class="stageHint">Sending uses MissionMed’s proven transactional email service. You’ll see truthful status — Sent, Delivered, Link visited, Started, Story shared — never guesses.</p>
        </div></div>
      </div>
    </div>
  </section>`;
}

/* ---------------- Guest experience: relationship-aware journey ---------------- */

function b1513rRenderGuest() {
  const guest = b1513rState().guest;
  const payload = guest.payload;
  if (!payload || payload.error) {
    teaching.classList.add('open');
    teaching.innerHTML = `<div class="b1513rGuestPage"><div class="b1513rGuestCard"><p>${esc(payload?.error || 'This invitation is not available.')}</p><button class="rowBtn" type="button" data-b1513r-guest-close>Close preview</button></div></div>`;
    return;
  }
  const student = payload.student;
  const prompt = payload.prompts[guest.promptIndex % payload.prompts.length];
  const previewBar = `<div class="b1513rGuestPreviewBar">You are previewing exactly what ${esc(student.first)}’s invitee will see. <button class="rowBtn" type="button" data-b1513r-guest-close>Exit preview</button></div>`;

  let body = '';
  if (guest.sent) {
    body = `<div class="b1513rGuestCard b1513rGuestThanks">
      ${student.headshot ? `<img class="b1513rHead b1513rHead-xl" src="${attr(student.headshot)}" alt="">` : ''}
      <h1>Thank you. ❤</h1>
      <p>Your story is on its way to ${esc(student.first)} — and only to ${esc(student.first)}.</p>
      <p class="b1513rGuestSmall">You can close this page now, or tell one more if something else came to mind.</p>
      <button class="b1513rGuestPrimary" type="button" data-b1513r-guest-another>Tell another story</button>
    </div>`;
  } else if (guest.mode === 'landing') {
    body = `<div class="b1513rGuestCard">
      ${student.headshot ? `<img class="b1513rHead b1513rHead-xl" src="${attr(student.headshot)}" alt="">` : ''}
      <h1>${esc(student.first)} asked for your help.</h1>
      ${payload.invitation.personalMessage ? `<p class="b1513rGuestNote">“${esc(payload.invitation.personalMessage)}”</p>` : ''}
      ${payload.invitation.videoGreeting ? `<button class="rowBtn b1513rGuestVideo" type="button" data-b1513r-guest-video>▶ Play ${esc(student.first)}’s video message (${formatDuration(payload.invitation.videoGreeting.durationMs)})</button>` : ''}
      <p>${esc(student.first)} is collecting real stories from the people who know them best — for the next step in their medical career.</p>
      ${payload.journeyLine ? `<p class="b1513r2JourneyLine">${esc(payload.journeyLine)}</p>` : ''}
      <div class="b1513r2GuestHow" role="list">
        <span role="listitem"><b>1</b> Pick any memory below</span>
        <span role="listitem"><b>2</b> Just talk — it’s written down for you</span>
        <span role="listitem"><b>3</b> It goes only to ${esc(student.first)}</span>
      </div>
      <p class="b1513rGuestBig">You do not need to write perfectly.<br>You can simply talk.</p>
      <button class="b1513rGuestPrimary" type="button" data-b1513r2-guest-start="voice">🎤 TELL A STORY</button>
      <button class="b1513rGuestSecondary" type="button" data-b1513r2-guest-start="type">TYPE INSTEAD</button>
      <p class="b1513rGuestSmall">${esc(payload.disclosure)}</p>
    </div>`;
  } else {
    const isVoice = guest.mode === 'voice';
    body = `<div class="b1513rGuestCard b1513rGuestAsk">
      <div class="b1513rGuestQTag">${esc(student.first)} would love to hear…</div>
      <h2 class="b1513rGuestQ">${esc(prompt.text)}</h2>
      ${prompt.hint ? `<p class="b1513rGuestHint">${esc(prompt.hint)}</p>` : ''}
      <button class="b1513rGuestAnotherQ" type="button" data-b1513r-guest-next-q>↻ A different question</button>
      ${isVoice ? (guest.voice ? `<div class="b1513rGuestRec">
          <div class="b1513rGuestRecLight"><span class="rdot"></span> Recording — just talk. <b data-b1513-rec-clock>0:0${Math.min(9, guest.voice.seconds)}</b></div>
          <div class="b1513rGuestTranscript">${esc(guest.text)}<span class="b1513rCaret"></span></div>
          <button class="b1513rGuestPrimary" type="button" data-b1513r-guest-rec-done>■ I’m finished</button>
          <button class="b1513rGuestSecondary" type="button" data-b1513r-guest-rec-cancel>Start over</button>
        </div>` : `<button class="b1513rGuestPrimary" type="button" data-b1513r-guest-rec-start>🎤 START TALKING</button>
        <p class="b1513rGuestSmall">When you press the button, just tell the story like you’d tell it at the kitchen table. StoryForge writes it down for you.</p>`)
      : `<label class="srOnly" for="b1513rGuestText">Your story</label>
        <textarea id="b1513rGuestText" class="b1513rGuestTextarea" placeholder="Just tell it the way you remember it…">${esc(guest.text)}</textarea>`}
      ${guest.text.trim() && !guest.voice ? `<div class="b1513rGuestReview">
        <p class="b1513rGuestSmall">Here’s what ${esc(student.first)} will receive. You can fix anything before sending.</p>
        ${isVoice ? `<textarea class="b1513rGuestTextarea" data-b1513r-guest-edit>${esc(guest.text)}</textarea>` : ''}
        <button class="b1513rGuestPrimary" type="button" data-b1513r-guest-send>SEND TO ${esc(student.first.toUpperCase())} ➤</button>
      </div>` : ''}
      <button class="b1513rGuestBack" type="button" data-b1513r-guest-back>‹ Back</button>
    </div>`;
  }
  teaching.classList.add('open');
  teaching.innerHTML = `<div class="b1513rGuestPage">${previewBar}${body}<div class="b1513rGuestFoot">MissionMed StoryForge · private invitation · nothing is public</div></div>`;
}

/* ---------------- Admin at scale: directory ---------------- */

async function b1513LoadAdminDirectory() {
  const dir = b1513State().directory;
  const r2dir = b1513r2State().dir;
  const key = `${dir.query}|${dir.filter}|${r2dir.session}|${r2dir.sort}`;
  if (key !== r2dir.lastKey) { r2dir.page = 1; r2dir.lastKey = key; }
  const query = new URLSearchParams();
  if (dir.query) query.set('q', dir.query);
  if (dir.filter) query.set('filter', dir.filter);
  if (r2dir.session) query.set('session', r2dir.session);
  query.set('sort', r2dir.sort);
  query.set('page', String(r2dir.page));
  query.set('pageSize', '25');
  const payload = await b1513Api.directory(query.toString());
  dir.loaded = true;
  dir.students = asArray(payload?.students);
  dir.total = Number(payload?.total || dir.students.length);
  dir.boundaries = payload?.boundaries || null;
  r2dir.totalFiltered = Number(payload?.totalFiltered || dir.students.length);
  r2dir.pages = Number(payload?.pages || 1);
  r2dir.sessions = asArray(payload?.sessions);
}

function b1513rStudentCard(entry, { compact = false } = {}) {
  const counts = entry.storyCounts;
  const reviewBit = entry.lastReview ? `Last review ${ago(entry.lastReview)}` : 'Last review none';
  return `<article class="sRow b1513rRow b1513rStudentCard ${compact ? 'b1513r2Compact' : ''}">
    <div class="b1513rRowMain">
      ${b1513rHeadshot({ id: entry.id, name: entry.name }, { withName: false, size: 'md' })}
      <div class="rMain">
        <div class="rTitle">${esc(entry.name)}${entry.warnings.length ? `<span class="b1513WarnDot" title="${attr(entry.warnings.join(' · '))}">⚠</span>` : ''}
          ${entry.session ? `<span class="cohortChip b1513r2SessionChip">${esc(entry.session)}</span>` : ''}</div>
        <div class="rSub b1513rRowFacts">
          <span class="b1513rFact dim">${entry.lastActivity ? `Active ${esc(ago(entry.lastActivity))}` : 'No activity yet'}</span>
          <span class="b1513rFact">${counts.total} ${counts.total === 1 ? 'story' : 'stories'}</span>
          ${counts.awaiting ? `<span class="stChip st-awaiting">${counts.awaiting} awaiting review</span>` : ''}
          ${counts.changes ? `<span class="stChip st-changes">${counts.changes} changes</span>` : ''}
          ${compact ? '' : `<span class="b1513rFact dim">${esc(reviewBit)}</span>`}
        </div>
      </div>
      <button class="rowBtn pri" type="button" data-b1513r-open-workspace="${attr(entry.id)}">OPEN WORKSPACE</button>
    </div>
  </article>`;
}

function b1513r2Pagination(kind, page, pages, totalFiltered, unit) {
  if (pages <= 1) return `<div class="b1513r2Pager"><span class="countNote">${totalFiltered} ${unit}</span></div>`;
  return `<div class="b1513r2Pager">
    <button class="rowBtn" type="button" data-b1513r2-page="${kind}:${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ Prev</button>
    <span class="countNote">Page ${page} of ${pages} · ${totalFiltered} ${unit}</span>
    <button class="rowBtn" type="button" data-b1513r2-page="${kind}:${page + 1}" ${page >= pages ? 'disabled' : ''}>Next ›</button>
  </div>`;
}

function b1513RenderAdminDirectory() {
  const dir = b1513State().directory;
  const r2dir = b1513r2State().dir;
  const filter = dir.filter;
  const primaryFilters = [['', 'All'], ['needs_review', 'Needs Review'], ['needs_nudge', 'Needs a Nudge'], ['changes', 'Changes Returned'], ['never_active', 'Never Started']];
  const moreFilters = [['progressing', 'Active This Week'], ['inactive_7', 'Quiet 7+ days'], ['inactive_30', 'Quiet 30+ days'], ['warnings', 'Provisioning Warnings']];
  const chip = ([value, label]) => `<button class="cChip ${filter === value ? 'on' : ''}" type="button" data-b1513-dir-filter="${value}" aria-pressed="${filter === value}">${label}</button>`;
  main.innerHTML = `<section data-view="admin-students" class="live b1513rAdminMirror">
    <div class="eyebrow">Students</div>
    <h1 class="h1">Every eligible student, <em>including the quiet ones</em>.</h1>
    ${b1513r2PageIntro('students')}
    <div class="b1513r2SavedViews" role="group" aria-label="Saved views">
      <span class="fLbl">Saved views</span>
      ${r2dir.savedViews.map((view) => `<button class="cChip ${r2dir.activeView === view.key ? 'on' : ''}" type="button" data-b1513r2-view="${attr(view.key)}">${esc(view.label)}</button>`).join('')}
      <button class="rowBtn" type="button" data-b1513r2-view-save title="Keeps the current search, filter, session, and sort as a view (saved for you, not for students)">+ Save current view</button>
    </div>
    <form class="listBar b1513r2DirBar" id="b1513DirectorySearchForm" role="search">
      <label class="srOnly" for="b1513DirQ">Search students</label>
      <input id="b1513DirQ" type="search" placeholder="Name or username…" value="${attr(dir.query)}" autocomplete="off">
      <button class="rowBtn pri" type="submit">Search</button>
      <label class="srOnly" for="b1513r2DirSession">Session</label>
      <select id="b1513r2DirSession" class="releaseSelect">
        <option value="">All sessions</option>
        ${r2dir.sessions.map((session) => `<option value="${attr(session)}" ${r2dir.session === session ? 'selected' : ''}>${esc(session)}</option>`).join('')}
      </select>
      <label class="srOnly" for="b1513r2DirSort">Sort</label>
      <select id="b1513r2DirSort" class="releaseSelect">
        ${[['attention', 'Sort: needs attention'], ['name', 'Name A–Z'], ['recent', 'Most recently active'], ['quiet', 'Quiet the longest'], ['stories', 'Most stories']].map(([value, label]) => `<option value="${value}" ${r2dir.sort === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <span class="countNote">${r2dir.totalFiltered} of ${dir.total} eligible</span>
    </form>
    <div class="classChips b1513rDirFilters" role="group" aria-label="Attention filters">
      ${primaryFilters.map(chip).join('')}
      ${r2dir.moreFilters ? moreFilters.map(chip).join('') : `<button class="cChip" type="button" data-b1513r2-dir-more>More filters…</button>`}
    </div>
    <div id="b1513DirectoryRows">${dir.students.length ? dir.students.map((entry) => b1513rStudentCard(entry)).join('') : emptyState('No students match.', 'Adjust the search, session, or filter.')}</div>
    ${b1513r2Pagination('dir', r2dir.page, r2dir.pages, r2dir.totalFiltered, 'students match')}
    <p class="stageHint">Roster truth: the canonical LearnDash entitlement · session labels from the MissionMed 360 cohort (consumed, never duplicated). Private story <b>content</b> is never listed — only counts.</p>
  </section>`;
}

/* ---------------- Admin at scale: review queue ---------------- */

async function b1513r2LoadQueue() {
  const queue = b1513r2State().queue;
  const admin = adminConsoleState();
  const key = `${queue.q}|${admin.queueStatus || ''}|${queue.session}|${queue.sort}`;
  if (key !== queue.lastKey) { queue.page = 1; queue.lastKey = key; }
  const query = new URLSearchParams();
  if (admin.queueStatus) query.set('status', admin.queueStatus);
  if (queue.q) query.set('q', queue.q);
  if (queue.session) query.set('session', queue.session);
  query.set('sort', queue.sort);
  query.set('page', String(queue.page));
  query.set('pageSize', '20');
  const payload = await auth.request(`/api/admin/console/queue?${query.toString()}`);
  queue.list = asArray(payload?.stories).map((raw) => ({ ...normalizeStory(raw), session: raw.session || '' }));
  queue.totalFiltered = Number(payload?.totalFiltered || queue.list.length);
  queue.pages = Number(payload?.pages || 1);
  queue.sessions = asArray(payload?.sessions);
  queue.loaded = true;
}

function b1513r2QueueRow(story) {
  const waitingDays = story.submittedAt ? Math.max(0, Math.round((Date.now() - new Date(story.submittedAt).getTime()) / 86400000)) : null;
  return `<article class="sRow b1513rRow b1513r2QueueRow">
    <div class="b1513rRowMain">
      ${b1513rHeadshot({ id: story.studentId, name: story.studentName }, { withName: false, size: 'md' })}
      <div class="rMain">
        <div class="rTitle">${story.prefixEnabled ? '<span class="pre">The One Where</span>' : ''}${esc(story.title)}</div>
        <div class="rSub b1513rRowFacts">
          <span class="b1513rFact">${esc(story.studentName)}</span>
          ${story.session ? `<span class="cohortChip b1513r2SessionChip">${esc(story.session)}</span>` : ''}
          ${statusChip(story)}
          ${story.mentorScore ? `<span class="b1513rFact">★ ${story.mentorScore}/5</span>` : '<span class="b1513rFact dim">unscored</span>'}
          ${waitingDays !== null ? `<span class="b1513rFact ${waitingDays > 7 ? 'b1513r2Overdue' : 'dim'}">waiting ${waitingDays}d</span>` : ''}
        </div>
      </div>
      <button class="rowBtn pri" type="button" data-admin-open-story="${attr(story.id)}">Review</button>
    </div>
  </article>`;
}

function b1513r2RenderQueue() {
  const queue = b1513r2State().queue;
  const admin = adminConsoleState();
  main.innerHTML = `<section data-view="admin-queue" class="live b1513rAdminMirror">
    <div class="eyebrow">Review Queue</div>
    <h1 class="h1">What should you review <em>next</em>?</h1>
    ${b1513r2PageIntro('queue')}
    <form class="listBar b1513r2DirBar" id="b1513r2QueueSearch" role="search">
      <label class="srOnly" for="b1513r2QueueQ">Search queue</label>
      <input id="b1513r2QueueQ" type="search" placeholder="Story title or student…" value="${attr(queue.q)}" autocomplete="off">
      <button class="rowBtn pri" type="submit">Search</button>
      <label class="srOnly" for="b1513r2QueueStatus">Review status</label>
      <select id="b1513r2QueueStatus" class="releaseSelect">
        <option value="">All submitted</option>
        ${['awaiting', 'in_review', 'changes', 'reviewed', 'approved', 'unscored'].map((status) => `<option value="${status}" ${admin.queueStatus === status ? 'selected' : ''}>${esc(status === 'unscored' ? 'Unscored' : STATUS[status].label)}</option>`).join('')}
      </select>
      <label class="srOnly" for="b1513r2QueueSession">Session</label>
      <select id="b1513r2QueueSession" class="releaseSelect">
        <option value="">All sessions</option>
        ${queue.sessions.map((session) => `<option value="${attr(session)}" ${queue.session === session ? 'selected' : ''}>${esc(session)}</option>`).join('')}
      </select>
      <label class="srOnly" for="b1513r2QueueSort">Sort</label>
      <select id="b1513r2QueueSort" class="releaseSelect">
        ${[['oldest', 'Oldest submission first'], ['newest', 'Newest submission first'], ['updated', 'Recently updated'], ['student', 'Student A–Z']].map(([value, label]) => `<option value="${value}" ${queue.sort === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <span class="countNote">${queue.totalFiltered} in queue</span>
    </form>
    <div>${queue.list.length ? queue.list.map(b1513r2QueueRow).join('') : emptyState('Nothing in this queue.', 'Choose another state, session, or search.')}</div>
    ${b1513r2Pagination('queue', queue.page, queue.pages, queue.totalFiltered, 'submitted stories')}
    <p class="stageHint">Oldest first by default — the student who has waited longest is always on top. Private stories are structurally excluded.</p>
  </section>`;
}

/* ---------------- Admin Home: above the fold ---------------- */

async function b1513r2LoadAdminHome() {
  const r2 = b1513r2State();
  const countOf = async (filter) => {
    const payload = await b1513Api.directory(`filter=${filter}&page=1&pageSize=1`).catch(() => null);
    return Number(payload?.totalFiltered || 0);
  };
  const [home, needsReview, needsNudge, changes, neverStarted, attention, oldestQueue] = await Promise.all([
    api.adminHome(),
    countOf('needs_review'), countOf('needs_nudge'), countOf('changes'), countOf('never_active'),
    b1513Api.directory('sort=attention&page=1&pageSize=25').catch(() => null),
    auth.request('/api/admin/console/queue?sort=oldest&page=1&pageSize=20').catch(() => null),
  ]);
  adminConsoleState().home = home;
  const newThisWeek = asArray(oldestQueue?.stories).length
    ? (await auth.request('/api/admin/console/queue?sort=newest&page=1&pageSize=20').catch(() => null))
    : null;
  r2.adminHome = {
    counts: { needsReview, needsNudge, changes, neverStarted },
    attention: asArray(attention?.students),
    totalStudents: Number(attention?.total || 0),
    /* TODAY = what still needs a decision: awaiting/in_review only, oldest first */
    oldestQueue: asArray(oldestQueue?.stories).filter((story) => ['awaiting', 'in_review'].includes(story.status)).slice(0, 5),
    queueTotal: Number(oldestQueue?.totalFiltered || 0),
    newThisWeek: asArray(newThisWeek?.stories).filter((story) => story.submittedAt && (Date.now() - new Date(story.submittedAt).getTime()) < 7 * 86400000).length,
  };
}

function b1513rRenderAdminHome() {
  const r2 = b1513r2State();
  const payload = adminConsoleState().home || {};
  const metrics = payload.metrics || {};
  const home = r2.adminHome || { counts: {}, attention: [], oldestQueue: [], queueTotal: 0, newThisWeek: 0, totalStudents: 0 };
  const counts = home.counts;
  const nudgeCandidates = home.attention.filter((entry) => entry.storyCounts.total > 0 && !entry.storyCounts.awaiting).slice(0, 2);
  main.innerHTML = `<section data-view="admin-home" class="live b1513rAdminMirror">
    <div class="homeHero">
      <div class="greet">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, <em>${esc(firstName())}</em>.</div>
      <div class="greetSub">Who needs your attention today?</div>
    </div>
    <div class="b1513r2HomeCounts" role="group" aria-label="Attention summary">
      <button class="b1513r2Count accent" type="button" data-b1513r2-home-filter="needs_review"><span class="n">${counts.needsReview || 0}</span><span class="l">Need your review</span></button>
      <button class="b1513r2Count" type="button" data-b1513r2-home-filter="needs_nudge"><span class="n">${counts.needsNudge || 0}</span><span class="l">Need a nudge</span></button>
      <button class="b1513r2Count" type="button" data-b1513r2-home-filter="changes"><span class="n">${counts.changes || 0}</span><span class="l">Changes returned</span></button>
      <button class="b1513r2Count" type="button" data-b1513r2-home-queue><span class="n">${home.newThisWeek}</span><span class="l">New this week</span></button>
    </div>
    <div class="panel panel-gap b1513rBucket"><div class="pHead"><div class="h2">Today, <em>in order</em></div><span class="stageHint">Longest-waiting submissions first — straight into the same Story Room the student uses.</span></div>
      <div class="pBody">
        ${home.oldestQueue.length ? home.oldestQueue.map((raw) => b1513r2QueueRow({ ...normalizeStory(raw), session: raw.session || '' })).join('') : '<div class="stageHint">Nothing is waiting on you. The queue is clear.</div>'}
        ${home.queueTotal > home.oldestQueue.length ? `<button class="pMore" type="button" data-nav="queue">All ${home.queueTotal} in the queue ▸</button>` : ''}
        ${nudgeCandidates.length ? `<div class="b1513r2NudgeRow"><span class="fLbl">Worth a nudge</span>${nudgeCandidates.map((entry) => `<button class="rowBtn" type="button" data-b1513r-open-workspace="${attr(entry.id)}">${esc(entry.name.split(/\s+/)[0])} · quiet ${esc(ago(entry.lastActivity))}</button>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="b1513rQuietStats">
      <span>${Number(metrics.submittedStories || 0)} submitted</span><span>·</span>
      <span>${Number(metrics.awaitingReview || 0)} awaiting</span><span>·</span>
      <span>${Number(metrics.approved || 0)} approved</span><span>·</span>
      <span>${home.totalStudents || b1513State().directory.total || 0} eligible students</span><span>·</span>
      <span>${counts.neverStarted || 0} never started</span>
    </div>
  </section>`;
}

/* ---------------- Content Studio: tabs + Inspiration single-add & bulk import ---------------- */

function b1513r2ContentActions() {
  const config = state.adminContentDisplay?.configuration || null;
  return `<div class="b1512ConfigActions">
      <button class="rowBtn" type="button" data-config-preview>Preview in this signed browser</button>
      <button class="rowBtn pri" type="submit">Publish configuration</button>
      <button class="rowBtn" type="button" data-config-cancel-preview ${state.adminContentPreviewing ? '' : 'disabled'}>Cancel preview</button>
      <button class="rowBtn danger" type="button" data-config-restore-defaults>Restore defaults</button>
    </div>
    <p class="stageHint" aria-live="polite">${state.adminContentPreviewing ? 'Preview is active only in this signed browser. Nothing has been published.' : config ? `Published ${esc(formatDateTime(config.updatedAt))}.` : ''}</p>`;
}

function b1513r2InspAdminPanel() {
  const admin = b1513State().adminInspiration;
  const content = b1513r2State().content;
  if (!admin) {
    return `<div class="panel panel-spaced"><div class="pBody"><button class="rowBtn" type="button" data-b1513-load-insp-admin>Open the Inspiration content manager</button></div></div>`;
  }
  const filter = b1513State().adminInspirationFilter;
  const prompts = asArray(admin.prompts).filter((prompt) => !filter || prompt.who?.includes(filter) || prompt.domain?.includes(filter) || prompt.energy?.includes(filter));
  const active = asArray(admin.prompts).filter((prompt) => prompt.state === 'active').length;
  const imported = asArray(admin.prompts).filter((prompt) => prompt.imported && prompt.state === 'retired').length;
  const parsed = content.parsed;
  return `<div class="panel panel-spaced b1513InspirationAdmin"><div class="pHead"><div class="h2">Inspiration <em>questions</em></div><span class="rolePill">Version ${admin.rowVersion} · ${active} active</span></div>
    <div class="pBody">
      <p class="stageHint">Every question is a stable-ID record: edit, retire, restore, reorder, recommend — existing student answers keep their provenance forever. Publishing is versioned and audited.</p>
      <div class="inlineActions">
        <button class="rowBtn pri" type="button" data-b1513r2-add-open>${content.addOpen ? 'Close' : '＋ Add one question'}</button>
        <button class="rowBtn" type="button" data-b1513r2-bulk-open>${content.importOpen ? 'Close import' : '⇪ Bulk import (CSV)'}</button>
        <button class="rowBtn" type="button" data-b1513-insp-preview>Preview as a student ▸</button>
      </div>

      ${content.addOpen ? `<form id="b1513r2AddForm" class="b1513r2AddForm">
        <label class="fLbl" for="b1513r2AddText">Question</label>
        <textarea id="b1513r2AddText" rows="2" maxlength="400" required placeholder="What smell instantly takes you back to being a kid?"></textarea>
        <label class="fLbl" for="b1513r2AddFollow">Follow-up (required — the gentle second beat)</label>
        <input id="b1513r2AddFollow" maxlength="240" required placeholder="Who was usually there when you smelled it?">
        <div class="b1513r2AddDims">
          <label>Who <select id="b1513r2AddWho">${['you', 'family', 'someone_else'].map((value) => `<option value="${value}">${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
          <label>Domain <select id="b1513r2AddDomain">${['personal', 'academic', 'medical_clinical'].map((value) => `<option value="${value}">${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
          <label>Energy <select id="b1513r2AddEnergy">${['light', 'serious', 'moving'].map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label>
          <label>Territory <input id="b1513r2AddTerritory" maxlength="40" placeholder="sensory_memory"></label>
          <label class="b1513r2RecCheck"><input type="checkbox" id="b1513r2AddRec"> ✪ Dr Brian recommends</label>
        </div>
        <div class="inlineActions"><button class="noteSend" type="submit">Save as draft (Retired)</button><span class="stageHint">New questions start Retired — publish after you preview.</span></div>
      </form>` : ''}

      ${content.importOpen ? `<div class="b1513r2Import">
        <div class="fLbl">Bulk import — UPLOAD → PARSE → REVIEW → SAVE DRAFTS → PREVIEW → PUBLISH</div>
        <p class="stageHint">CSV columns: <code>text, who, domain, energy, territory, followUp, interviewUse</code> (multi-values with <code>|</code>). Nothing is ever published directly from an upload: valid rows are saved as <b>Retired drafts</b> for preview first.</p>
        <div class="inlineActions">
          <label class="rowBtn b1513r2FileBtn">Choose CSV file… <input type="file" id="b1513r2CsvFile" accept=".csv,text/csv" hidden></label>
          <button class="rowBtn" type="button" data-b1513r2-bulk-sample>Paste a sample</button>
        </div>
        <label class="srOnly" for="b1513r2Csv">CSV content</label>
        <textarea id="b1513r2Csv" rows="5" placeholder="text,who,domain,energy,territory,followUp,interviewUse&#10;What smell takes you back?,you,personal,light,sensory_memory,Who was there?,Shows reflective self-knowledge">${esc(content.csv)}</textarea>
        <div class="inlineActions"><button class="rowBtn pri" type="button" data-b1513r2-bulk-parse>Parse &amp; validate</button>
        ${parsed ? `<button class="noteSend" type="button" data-b1513r2-bulk-commit ${parsed.summary.ok ? '' : 'disabled'}>Save ${parsed.summary.ok} valid ${parsed.summary.ok === 1 ? 'row' : 'rows'} as drafts</button>` : ''}
        <button class="rowBtn" type="button" data-b1513r2-bulk-cancel>Cancel</button></div>
        ${parsed ? `<div class="b1513r2ImportSummary" role="status">
          <span class="stChip st-approved">${parsed.summary.ok} valid</span>
          <span class="stChip st-changes">${parsed.summary.duplicates} duplicate${parsed.summary.duplicates === 1 ? '' : 's'}</span>
          <span class="stChip st-changes">${parsed.summary.errors} with errors</span>
          <span class="dim">of ${parsed.summary.total} rows</span>
        </div>
        <div class="b1513r2ImportRows">${parsed.rows.map((row) => `<div class="b1513r2ImportRow ${row.ok ? 'ok' : 'bad'}">
          <span class="b1513r2ImportLine">line ${row.line}</span>
          <span class="b1513r2ImportText">${esc(row.prompt.text || '(no text)')}</span>
          ${row.ok ? '<span class="stChip st-approved">✓ ready</span>' : row.duplicate ? '<span class="stChip st-changes">duplicate — will be skipped</span>' : `<span class="stChip st-changes">${esc(row.errors.join(' · '))}</span>`}
        </div>`).join('')}</div>` : ''}
        ${content.committed ? `<p class="stageHint" role="status">✓ ${content.committed} saved as Retired drafts — find them below marked <b>imported</b>, preview each, then publish.</p>` : ''}
      </div>` : ''}

      ${imported ? `<p class="stageHint">📦 ${imported} imported ${imported === 1 ? 'draft' : 'drafts'} awaiting preview &amp; publish (marked below).</p>` : ''}
      <div class="classChips">${[['', 'All'], ['you', 'You'], ['family', 'Family'], ['someone_else', 'Someone Else'], ['personal', 'Personal'], ['academic', 'Academic'], ['medical_clinical', 'Medical/Clinical'], ['light', 'Light'], ['serious', 'Serious'], ['moving', 'Moving']].map(([value, label]) => `<button class="cChip ${filter === value ? 'on' : ''}" type="button" data-b1513-insp-filter="${value}">${label}</button>`).join('')}</div>
      <div class="b1513PromptRows">${prompts.slice(0, 10).map((prompt, index) => `<div class="b1512SectionRow b1513PromptRow ${prompt.imported && prompt.state === 'retired' ? 'b1513r2Imported' : ''}" data-b1513r2-q-row="${attr(prompt.id)}">
        <span class="b1512StableId">${esc(prompt.id)} · ${esc((prompt.who || []).join(','))} · ${esc((prompt.energy || []).join(','))}${prompt.imported ? ' · 📦 imported' : ''}${prompt.recommended ? ' · ✪ recommended' : ''}</span>
        <label>Question<textarea data-b1513r2-q-text rows="2" maxlength="400">${esc(prompt.text)}</textarea></label>
        <div class="inlineActions">
          <select data-b1513r2-q-state><option value="active" ${prompt.state === 'active' ? 'selected' : ''}>Active (published)</option><option value="retired" ${prompt.state === 'retired' ? 'selected' : ''}>Retired (draft/hidden)</option></select>
          <label class="b1513r2RecCheck"><input type="checkbox" data-b1513r2-q-rec ${prompt.recommended ? 'checked' : ''}> ✪ Recommend</label>
          <button class="rowBtn" type="button" data-b1513r2-q-move="-1" data-q-id="${attr(prompt.id)}" ${index === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="rowBtn" type="button" data-b1513r2-q-move="1" data-q-id="${attr(prompt.id)}" ${index === Math.min(prompts.length, 10) - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button class="rowBtn pri" type="button" data-b1513r2-q-save="${attr(prompt.id)}">Save</button>
        </div>
      </div>`).join('')}</div>
      ${prompts.length > 10 ? `<p class="stageHint">Showing 10 of ${prompts.length} matching questions.</p>` : ''}
    </div></div>`;
}

function b1513rRenderContentStudio() {
  const content = b1513r2State().content;
  const tab = content.tab;
  const tabs = [['categories', 'Story Categories'], ['uses', 'Intended Uses'], ['versions', 'Story Versions'], ['inspiration', 'Inspiration'], ['requests', 'Request a Story'], ['navigation', 'Navigation & Copy']];
  const unavailable = !state.adminContentDisplay?.configuration;
  const formWrap = (inner) => unavailable
    ? '<div class="panel panel-spaced"><div class="pBody"><div class="setRow"><div class="sTxt"><b>Configuration unavailable</b><span>No change can be previewed or published.</span></div><button class="rowBtn" type="button" data-admin-release-reload>Retry</button></div></div></div>'
    : `<div class="panel panel-spaced b1512ContentDisplay" data-content-display-admin><div class="pBody">
        ${state.adminContentError ? `<div class="releaseError" role="alert">${esc(state.adminContentError)}</div>` : ''}
        <form id="contentDisplayForm">${inner}${b1513r2ContentActions()}</form>
      </div></div>`;

  let body = '';
  if (tab === 'categories') body = formWrap(renderTaxonomyConfiguration('categories', 'Story categories'));
  else if (tab === 'uses') body = formWrap(renderTaxonomyConfiguration('intendedUses', 'Intended uses'));
  else if (tab === 'versions') body = formWrap(`${renderSectionConfiguration()}${b1513VersionConfigPanel()}`);
  else if (tab === 'inspiration') body = b1513r2InspAdminPanel();
  else if (tab === 'requests') {
    body = `<div class="panel panel-spaced"><div class="pHead"><div class="h2">Request-a-Story <em>prompts</em></div><span class="rolePill">${(window.__B1513R?.CONTRIB_LIBRARY?.prompts || []).length} prompts · 13 relationships</span></div>
      <div class="pBody"><p class="stageHint">Contributor questions are governed exactly like Inspiration questions: stable IDs, per-relationship journeys, retire/restore, preview, audited publish. Each relationship walks a different path:</p>
      <div class="setRow"><div class="sTxt"><b>Parent / family</b><span>Childhood, kindness, persistence, family humor, responsibility, formative moments.</span></div><button class="rowBtn" type="button" data-b1513r-guest-preview="rs-demo-rosa">Preview journey</button></div>
      <div class="setRow"><div class="sTxt"><b>Best / longtime friend</b><span>Life outside medicine, adventures, mistakes, loyalty, humor, growth.</span></div><button class="rowBtn" type="button" data-b1513r-guest-preview="rs-demo-sam">Preview journey</button></div>
      <div class="setRow"><div class="sTxt"><b>Faculty / mentor</b><span>Feedback, professionalism, learning, clinical growth, teamwork, initiative.</span></div><button class="rowBtn" type="button" data-b1513r-guest-preview="rs-demo-ken">Preview journey</button></div>
      <p class="stageHint">Full per-prompt editor arrives with the R4 content-manager depth; the library ships Founder-reviewed.</p></div>
    </div>`;
  } else if (tab === 'navigation') {
    body = formWrap(`<fieldset class="b1512ConfigGroup"><legend>Navigation</legend><label class="b1512Check"><input type="checkbox" data-config-interview-prep ${contentDisplayDraft().navigation?.interviewPrepVisible ? 'checked' : ''}> Show Interview Prep to eligible students</label></fieldset>
      <p class="stageHint">Student-facing helper copy lives with each section under <b>Story Versions</b>. This surface cannot accept HTML, CSS, or scripts.</p>`);
  }

  main.innerHTML = `<section data-view="settings" class="live settingsPage b1513rAdminMirror">
    <div class="eyebrow">Administration</div>
    <h1 class="h1">Content <em>Studio</em></h1>
    ${b1513r2PageIntro('content')}
    <p class="stageHint">Feature scopes and kill switches live separately in <button class="pMore" type="button" data-nav="settings">System Controls ▸</button></p>
    <div class="voiceTabs b1513ProfileTabs b1513r2CsTabs" role="tablist" aria-label="Content Studio sections">
      ${tabs.map(([id, label]) => `<button type="button" role="tab" class="${tab === id ? 'on' : ''}" aria-selected="${tab === id}" data-b1513r2-cs-tab="${id}">${label}</button>`).join('')}
    </div>
    ${body}
  </section>`;
}

/* ---------------- Settings: Appearance (theme) panel ---------------- */

function b1513r2AppearancePanel() {
  const pref = b1513r2ThemePref();
  const seg = (value, label, hint) => `<button class="b1513r2ThemeCard ${pref === value ? 'on' : ''}" type="button" data-b1513r2-theme="${value}" aria-pressed="${pref === value}"><b>${label}</b><span>${hint}</span></button>`;
  return `<div class="panel panel-spaced"><div class="pHead"><div class="h2">Dark / <em>Light</em></div></div>
    <div class="pBody">
      <div class="b1513r2ThemeRow" role="group" aria-label="Theme">
        ${seg('dark', '🌙 Dark', 'The StoryForge night studio — default.')}
        ${seg('light', '☀ Light', 'Warm paper &amp; ink. A real StoryForge design, not a white flip.')}
        ${seg('auto', '⚙ Auto', 'Follows your device — light by day, dark by night.')}
      </div>
      <p class="stageHint">Your environment, text size, and reduced-motion choices apply in both themes.</p>
    </div></div>`;
}

/* ---------------- R2 delegated events ---------------- */

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    /* theme */
    if (button.matches('[data-b1513r2-theme]')) {
      const theme = button.dataset.b1513r2Theme;
      await b1513r2Api.theme(theme).catch(() => null);
      if (state.user) state.user.theme_preference = theme;
      b1513r2SyncTheme();
      renderSettings();
      notify(theme === 'auto' ? 'Auto theme on — StoryForge follows your device.' : `${theme === 'light' ? 'Light' : 'Dark'} theme saved.`, '✓');
      return;
    }
    /* inspiration layout */
    if (button.matches('[data-b1513r2-layout]')) {
      const layout = button.dataset.b1513r2Layout;
      b1513r2State().layout = layout;
      if (state.user) state.user.inspiration_layout = layout;
      b1513r2Api.layout(layout).catch(() => null);
      return renderInspiration();
    }
    /* pin / unpin */
    if (button.matches('[data-b1513r2-pin]')) {
      const payload = await b1513r2Api.pin(button.dataset.b1513r2Pin);
      await b1513rLoadBrowse();
      renderInspiration();
      return notify(payload?.pinned ? '📌 Pinned — find it in My Pinned Questions, in your order.' : 'Unpinned.', '✓');
    }
    /* accessible pin reorder */
    if (button.matches('[data-b1513r2-pin-move]')) {
      const browse = b1513rState().browse;
      const ids = asArray(browse.pinnedList).map((prompt) => prompt.id);
      const index = ids.indexOf(button.dataset.pinId);
      const target = index + Number(button.dataset.b1513r2PinMove);
      if (index < 0 || target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await b1513r2Api.pinOrder(ids);
      await b1513rLoadBrowse();
      return renderInspiration();
    }
    /* home recommend → open in Inspiration */
    if (button.matches('[data-b1513r2-home-rec]')) {
      b1513r2State().pendingOpen = button.dataset.b1513r2HomeRec;
      await navigate('inspiration');
      window.requestAnimationFrame(() => $('#b1513rBrowseAnswer')?.focus());
      return;
    }
    /* invitations: preview-before-send */
    if (button.matches('[data-b1513r2-inv-preview-send]')) {
      const id = button.dataset.b1513r2InvPreviewSend;
      const invitation = b1513rState().requests.invitations.find((inv) => inv.id === id);
      const payload = await b1513rApi.emailPreview(id);
      b1513r2State().invitePreview = { invitation, preview: payload?.preview };
      b1513rState().requests.view = 'preview';
      return renderRequests();
    }
    if (button.matches('[data-b1513r2-reinvite]')) {
      const invitation = b1513rState().requests.invitations.find((inv) => inv.id === button.dataset.b1513r2Reinvite);
      if (invitation) {
        b1513rState().requests.draft = { relationship: invitation.relationship, contributorName: invitation.contributorName, email: '', personalMessage: invitation.personalMessage };
        b1513r2State().editingInviteId = '';
      }
      b1513rState().requests.view = 'new';
      notify('Fresh invitation — same person, corrected address. The bounced link stays dead.');
      return renderRequests();
    }
    if (button.matches('[data-b1513r2-edit-invite]')) {
      const invitation = b1513rState().requests.invitations.find((inv) => inv.id === button.dataset.b1513r2EditInvite);
      if (invitation) {
        b1513rState().requests.draft = { relationship: invitation.relationship, contributorName: invitation.contributorName, email: '', personalMessage: invitation.personalMessage };
        b1513r2State().editingInviteId = invitation.id;
      }
      b1513rState().requests.view = 'new';
      return renderRequests();
    }
    if (button.matches('[data-b1513r2-confirm-send]')) {
      await b1513rApi.inviteOp(button.dataset.b1513r2ConfirmSend, 'send');
      await b1513rLoadRequests();
      b1513rState().requests.view = 'home';
      b1513r2State().invitePreview = null;
      notify('Handed to the email service. You’ll see Delivered when it confirms — then Link visited, Started, Story shared. All truthful, never guessed.', '✓');
      return renderRequests();
    }
    if (button.matches('[data-b1513r2-send-later]')) {
      b1513rState().requests.view = 'home';
      b1513r2State().invitePreview = null;
      notify('Kept as a draft. Nothing was sent.', '✓');
      return renderRequests();
    }
    /* guest start (records the truthful "started" signal) */
    if (button.matches('[data-b1513r2-guest-start]')) {
      const guest = b1513rState().guest;
      guest.mode = button.dataset.b1513r2GuestStart;
      guest.text = '';
      b1513r2Api.guestStarted(guest.token).catch(() => null);
      return b1513rRenderGuest();
    }
    /* directory: more filters, saved views, pagination */
    if (button.matches('[data-b1513r2-dir-more]')) {
      b1513r2State().dir.moreFilters = true;
      return b1513RenderAdminDirectory();
    }
    if (button.matches('[data-b1513r2-view]')) {
      const r2dir = b1513r2State().dir;
      const view = r2dir.savedViews.find((entry) => entry.key === button.dataset.b1513r2View);
      if (!view) return;
      r2dir.activeView = view.key;
      b1513State().directory.filter = view.state.filter;
      b1513State().directory.query = '';
      r2dir.session = view.state.session;
      r2dir.sort = view.state.sort;
      r2dir.page = 1;
      await b1513LoadAdminDirectory();
      return b1513RenderAdminDirectory();
    }
    if (button.matches('[data-b1513r2-view-save]')) {
      const r2dir = b1513r2State().dir;
      const dir = b1513State().directory;
      const label = window.prompt('Name this view (its search, filter, session, and sort are saved):', `${r2dir.session || 'All'} · ${dir.filter || 'everyone'}`);
      if (!label) return;
      const key = `custom-${r2dir.savedViews.length + 1}`;
      r2dir.savedViews.push({ key, label, state: { filter: dir.filter, session: r2dir.session, sort: r2dir.sort } });
      r2dir.activeView = key;
      notify('View saved — filter and sort state only, saved for you.', '✓');
      return b1513RenderAdminDirectory();
    }
    if (button.matches('[data-b1513r2-page]')) {
      const [kind, pageValue] = button.dataset.b1513r2Page.split(':');
      const page = Math.max(1, Number(pageValue));
      if (kind === 'dir') {
        b1513r2State().dir.page = page;
        await b1513LoadAdminDirectory();
        return b1513RenderAdminDirectory();
      }
      if (kind === 'queue') {
        b1513r2State().queue.page = page;
        await b1513r2LoadQueue();
        return b1513r2RenderQueue();
      }
      return;
    }
    /* admin home count chips */
    if (button.matches('[data-b1513r2-home-filter]')) {
      b1513State().directory.filter = button.dataset.b1513r2HomeFilter;
      b1513r2State().dir.activeView = '';
      return void navigate('students');
    }
    if (button.matches('[data-b1513r2-home-queue]')) return void navigate('queue');
    /* content studio */
    if (button.matches('[data-b1513r2-cs-tab]')) {
      b1513r2State().content.tab = button.dataset.b1513r2CsTab;
      return b1513rRenderContentStudio();
    }
    if (button.matches('[data-b1513r2-add-open]')) {
      b1513r2State().content.addOpen = !b1513r2State().content.addOpen;
      return b1513rRenderContentStudio();
    }
    if (button.matches('[data-b1513r2-bulk-open]')) {
      b1513r2State().content.importOpen = !b1513r2State().content.importOpen;
      return b1513rRenderContentStudio();
    }
    if (button.matches('[data-b1513r2-bulk-sample]')) {
      b1513r2State().content.csv = [
        'text,who,domain,energy,territory,followUp,interviewUse',
        '"What is the strangest job you ever had, even for a day?",you,personal,light,work_life,"What did it teach you about people?","Unexpected range and humility read as authenticity"',
        '"Who in your family tells the best stories — and what is their favorite one about you?",family,personal,light,family_lore,"How do you tell it differently than they do?","Shows self-awareness and warmth"',
        '"What smell instantly takes you back to being a kid?",you,personal,light,sensory_memory,"Who was usually there when you smelled it?","Sensory anchors unlock vivid detail"',
      ].join('\n');
      const box = $('#b1513r2Csv');
      if (box) box.value = b1513r2State().content.csv;
      return;
    }
    if (button.matches('[data-b1513r2-bulk-parse]')) {
      const csv = $('#b1513r2Csv')?.value || '';
      b1513r2State().content.csv = csv;
      if (!csv.trim()) return notify('Paste or choose a CSV first.');
      const payload = await withBusy(() => b1513r2Api.bulkParse(csv));
      b1513r2State().content.parsed = payload;
      b1513r2State().content.committed = 0;
      return b1513rRenderContentStudio();
    }
    if (button.matches('[data-b1513r2-bulk-commit]')) {
      const parsed = b1513r2State().content.parsed;
      if (!parsed?.summary?.ok) return;
      const payload = await withBusy(() => b1513r2Api.bulkCommit(parsed.rows));
      b1513State().adminInspiration = payload?.configuration || b1513State().adminInspiration;
      b1513r2State().content.committed = Number(payload?.committed || 0);
      b1513r2State().content.parsed = null;
      b1513r2State().content.csv = '';
      notify(`✓ ${payload?.committed || 0} saved as Retired drafts — nothing published from the upload. Preview each, then publish.`, '✓');
      return b1513rRenderContentStudio();
    }
    if (button.matches('[data-b1513r2-bulk-cancel]')) {
      b1513r2State().content.importOpen = false;
      b1513r2State().content.parsed = null;
      b1513r2State().content.committed = 0;
      return b1513rRenderContentStudio();
    }
    if (button.matches('[data-b1513r2-q-save]')) {
      const row = $(`[data-b1513r2-q-row="${CSS.escape(button.dataset.b1513r2QSave)}"]`);
      if (!row) return;
      const payload = await withBusy(() => b1513Api.adminInspirationSave({ prompt: {
        id: button.dataset.b1513r2QSave,
        text: $('[data-b1513r2-q-text]', row)?.value || '',
        state: $('[data-b1513r2-q-state]', row)?.value || 'active',
        recommended: Boolean($('[data-b1513r2-q-rec]', row)?.checked),
      } }));
      b1513State().adminInspiration = payload?.configuration || b1513State().adminInspiration;
      notify('Question saved and versioned.', '✓');
      return b1513rRenderContentStudio();
    }
    if (button.matches('[data-b1513r2-q-move]')) {
      const admin = b1513State().adminInspiration;
      if (!admin) return;
      const prompts = admin.prompts;
      const index = prompts.findIndex((prompt) => prompt.id === button.dataset.qId);
      const target = index + Number(button.dataset.b1513r2QMove);
      if (index < 0 || target < 0 || target >= prompts.length) return;
      [prompts[index], prompts[target]] = [prompts[target], prompts[index]];
      prompts.forEach((prompt, order) => { prompt.sortOrder = (order + 1) * 10; });
      await b1513Api.adminInspirationSave({ prompt: { id: prompts[target].id, sortOrder: prompts[target].sortOrder } }).catch(() => null);
      return b1513rRenderContentStudio();
    }
  } catch (error) {
    notify(error.message || 'That action could not be completed.');
  }
});

/* R2 change events (selects) */
document.addEventListener('change', async (event) => {
  const target = event.target;
  try {
    if (target.matches?.('#b1513r2DirSession') || target.matches?.('#b1513r2DirSort')) {
      const r2dir = b1513r2State().dir;
      if (target.id === 'b1513r2DirSession') r2dir.session = target.value;
      else r2dir.sort = target.value;
      r2dir.activeView = '';
      await b1513LoadAdminDirectory();
      return b1513RenderAdminDirectory();
    }
    if (target.matches?.('#b1513r2QueueStatus') || target.matches?.('#b1513r2QueueSession') || target.matches?.('#b1513r2QueueSort')) {
      const queue = b1513r2State().queue;
      if (target.id === 'b1513r2QueueStatus') adminConsoleState().queueStatus = target.value;
      else if (target.id === 'b1513r2QueueSession') queue.session = target.value;
      else queue.sort = target.value;
      await b1513r2LoadQueue();
      return b1513r2RenderQueue();
    }
    if (target.matches?.('#b1513r2CsvFile')) {
      const file = target.files?.[0];
      if (!file) return;
      const text = await file.text();
      b1513r2State().content.csv = text;
      const box = $('#b1513r2Csv');
      if (box) box.value = text;
      return;
    }
  } catch (error) {
    notify(error.message || 'That change could not be applied.');
  }
});

/* R2 submits */
document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id === 'b1513r2QueueSearch') {
    event.preventDefault();
    b1513r2State().queue.q = $('#b1513r2QueueQ', form)?.value || '';
    await b1513r2LoadQueue();
    return b1513r2RenderQueue();
  }
  if (form.id === 'b1513r2AddForm') {
    event.preventDefault();
    const prompt = {
      id: `q-new-${Date.now().toString(36)}`,
      text: $('#b1513r2AddText', form)?.value || '',
      followUp: $('#b1513r2AddFollow', form)?.value || '',
      who: [$('#b1513r2AddWho', form)?.value || 'you'],
      domain: [$('#b1513r2AddDomain', form)?.value || 'personal'],
      energy: [$('#b1513r2AddEnergy', form)?.value || 'light'],
      territory: $('#b1513r2AddTerritory', form)?.value || '',
      recommended: Boolean($('#b1513r2AddRec', form)?.checked),
      state: 'retired',
    };
    if (!prompt.text.trim() || !prompt.followUp.trim()) return notify('A question and its follow-up are both required.');
    const payload = await withBusy(() => b1513Api.adminInspirationSave({ prompt }));
    b1513State().adminInspiration = payload?.configuration || b1513State().adminInspiration;
    b1513r2State().content.addOpen = false;
    notify('Saved as a Retired draft — publish it after preview.', '✓');
    return b1513rRenderContentStudio();
  }
});

/* The R-layer invite form now continues to PREVIEW, never sends. The build
 * patches the ext2 submit listener to delegate here (RB1-invite-submit). */
async function b1513r2HandleInviteSubmit(form) {
  const requests = b1513rState().requests;
  const r2 = b1513r2State();
  requests.draft.contributorName = $('#b1513rInvName', form)?.value || '';
  requests.draft.email = $('#b1513rInvEmail', form)?.value || '';
  requests.draft.personalMessage = $('#b1513rInvMsg', form)?.value || '';
  if (!requests.draft.relationship) { notify('Choose who they are to you first.'); return; }
  try {
    let invitation = null;
    if (r2.editingInviteId) {
      const payload = await b1513r2Api.updateInvite(r2.editingInviteId, requests.draft);
      invitation = payload?.invitation;
      r2.editingInviteId = '';
    } else {
      const payload = await b1513rApi.createInvite(requests.draft);
      invitation = payload?.invitation;
    }
    await b1513rLoadRequests();
    invitation = requests.invitations.find((inv) => inv.id === invitation?.id) || invitation;
    requests.draft = { relationship: '', contributorName: '', email: '', personalMessage: '' };
    requests.relMore = false;
    if (!invitation) { requests.view = 'home'; return renderRequests(); }
    const preview = await b1513rApi.emailPreview(invitation.id);
    r2.invitePreview = { invitation, preview: preview?.preview };
    requests.view = 'preview';
    renderRequests();
  } catch (error) {
    notify(error.message || 'The invitation could not be prepared.');
  }
}

/* Pin drag reorder (HTML5 DnD with graceful keyboard fallback above) */
document.addEventListener('dragstart', (event) => {
  const item = event.target.closest?.('[data-b1513r2-pin-item]');
  if (!item) return;
  b1513r2State().dragPin = item.dataset.b1513r2PinItem;
  event.dataTransfer.effectAllowed = 'move';
  try { event.dataTransfer.setData('text/plain', item.dataset.b1513r2PinItem); } catch { /* older engines */ }
  item.classList.add('dragging');
});
document.addEventListener('dragover', (event) => {
  const item = event.target.closest?.('[data-b1513r2-pin-item]');
  if (!item || !b1513r2State().dragPin) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  item.classList.add('b1513r2DropTarget');
});
document.addEventListener('dragleave', (event) => {
  event.target.closest?.('[data-b1513r2-pin-item]')?.classList.remove('b1513r2DropTarget');
});
document.addEventListener('drop', async (event) => {
  const item = event.target.closest?.('[data-b1513r2-pin-item]');
  const dragged = b1513r2State().dragPin;
  if (!item || !dragged || item.dataset.b1513r2PinItem === dragged) { b1513r2State().dragPin = ''; return; }
  event.preventDefault();
  const browse = b1513rState().browse;
  const ids = asArray(browse.pinnedList).map((prompt) => prompt.id);
  const from = ids.indexOf(dragged);
  const to = ids.indexOf(item.dataset.b1513r2PinItem);
  if (from < 0 || to < 0) { b1513r2State().dragPin = ''; return; }
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  b1513r2State().dragPin = '';
  await b1513r2Api.pinOrder(ids);
  await b1513rLoadBrowse();
  renderInspiration();
});
document.addEventListener('dragend', () => {
  b1513r2State().dragPin = '';
  document.querySelectorAll('.b1513r2DropTarget, .b1513r2PinItem.dragging').forEach((node) => node.classList.remove('b1513r2DropTarget', 'dragging'));
});

/* ---------------- boot glue ---------------- */

try {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (b1513r2ThemePref() === 'auto') b1513r2SyncTheme();
  });
} catch { /* older engines: AUTO simply resolves once per render */ }

/* Theme applies as soon as the session lands (applyEnvironment is patched to
 * call b1513r2SyncTheme on every shell render; this covers the boot gap). */
const b1513r2BootTheme = window.setInterval(() => {
  if (state.user) {
    b1513r2SyncTheme();
    window.clearInterval(b1513r2BootTheme);
  }
}, 120);
