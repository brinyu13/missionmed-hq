/* ============================================================================
 * B1-513R REFINEMENT LAYER — appended after the B1-513 extension module.
 * Function declarations hoist and later declarations win, so this layer
 * REDEFINES a small set of B1-513 functions (renderInspiration,
 * b1513VersionSurface, b1513RenderAdminDirectory, b1513AdminPatch) and adds
 * the V2 modules: Request a Story, mirrored Admin, Content Studio, Avatar
 * identity frames, refined Library rows, Settings IA. Everything else from
 * the production renderer and the B1-513 layer is inherited unchanged.
 * ========================================================================== */

function b1513rState() {
  const b = b1513State();
  if (!b.r) {
    b.r = {
      rowOpen: {},
      saveFlash: { key: '', state: '' },
      browse: { loaded: false, prompts: [], q: '', who: '', domain: '', energy: '', fav: false, favoriteCount: 0, openPromptId: '', answer: '', changeNote: '', voice: null, mode: 'browse' },
      requests: { loaded: false, invitations: [], contributions: [], relationships: [], view: 'home', draft: { relationship: '', contributorName: '', email: '', personalMessage: '' }, relMore: false, emailPreview: null, activeInvite: null },
      guest: { open: false, token: '', payload: null, promptIndex: 0, mode: 'landing', text: '', voice: null, sent: false },
      adminHome: null,
      contentStudio: false,
      timeMe: null,
    };
  }
  return b.r;
}

const b1513rApi = {
  requests: () => auth.request('/api/requests'),
  createInvite: (body) => auth.request('/api/requests', jsonOptions('POST', body)),
  inviteOp: (id, op, body) => auth.request(`/api/requests/${id}/${op}`, jsonOptions('POST', body || {})),
  emailPreview: (id) => auth.request(`/api/requests/${id}/email-preview`, jsonOptions('POST', {})),
  guest: (token) => auth.publicRequest(`api/requests/guest/${token}`),
  guestContribute: (token, body) => auth.publicRequest(`api/requests/guest/${token}/contribution`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  contributionState: (id, value) => auth.request(`/api/contributions/${id}/state`, jsonOptions('PATCH', { state: value })),
  promoteContribution: (id, body) => auth.request(`/api/contributions/${id}/promote`, jsonOptions('POST', body || {})),
  browse: (query) => auth.request(`/api/inspiration/browse${query ? `?${query}` : ''}`),
  favorite: (id) => auth.request(`/api/inspiration/favorite/${id}`, jsonOptions('POST', {})),
};

/* ---------------- Avatar Studio identity frames ---------------- */

function b1513rAvatar(userId) {
  return (window.__B1513R?.avatarFor?.(userId)) || null;
}

function b1513rHeadshot(person, { size = 'md', withName = true, nameOverride = '', sub = '' } = {}) {
  const id = typeof person === 'string' ? person : person?.id;
  const name = nameOverride || (typeof person === 'object' ? (person.first || person.first_name || String(person.name || person.display_name || '').split(/\s+/)[0]) : '');
  const fullName = typeof person === 'object' ? String(person.name || person.display_name || name) : name;
  const avatar = b1513rAvatar(id);
  const img = avatar
    ? `<img class="b1513rHead b1513rHead-${size}" src="${attr(avatar.headshot)}" alt="">`
    : `<span class="stuAv b1513rHeadFallback b1513rHead-${size}" aria-hidden="true">${esc(String(fullName || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>`;
  if (!withName) return img;
  return `<span class="b1513rIdentity">${img}<span class="b1513rIdName"><b>${esc(name || fullName)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></span>`;
}

function b1513rFullBody(userId, cls = '') {
  const avatar = b1513rAvatar(userId);
  return avatar ? `<img class="b1513rFullBody ${cls}" src="${attr(avatar.fullBody)}" alt="">` : '';
}

function b1513rOwnAvatarRow() {
  const avatar = b1513rAvatar(state.user?.id);
  return `<div class="setRow"><div class="sTxt"><b>Your avatar</b><span>${avatar
    ? 'Your MissionMed Avatar Studio headshot appears wherever your identity does in StoryForge.'
    : 'You don’t have a MissionMed avatar yet. StoryForge works fine without one — a neutral placeholder is shown.'}</span></div>
    <button class="rowBtn" type="button" data-b1513r-avatar-studio>${avatar ? 'UPDATE MY AVATAR' : 'CREATE MY AVATAR'}</button></div>`;
}

/* ---------------- refined Library row (progressive disclosure) ---------------- */

function b1513rPriorityControl(story) {
  const value = Number(story.studentScore) || 0;
  const labels = { 1: '1 · Low', 2: '2', 3: '3', 4: '4', 5: '5 · Highest' };
  return `<div class="b1513rPriority" data-priority-story="${attr(story.id)}">
    <span class="b1513rPriorityLbl" id="prio-${attr(story.id)}">Story Priority</span>
    <span class="b1513rPriorityBtns" role="group" aria-labelledby="prio-${attr(story.id)}">
      ${[1, 2, 3, 4, 5].map((priority) => `<button type="button" data-library-priority="${priority}" data-story-id="${attr(story.id)}"
        class="${priority <= value ? 'on' : ''}" aria-pressed="${priority === value}" aria-label="Set Story Priority to ${priority} of 5${priority === 1 ? ' (Low)' : priority === 5 ? ' (Highest)' : ''}" title="${labels[priority]}">${priority}</button>`).join('')}
    </span>
    <span class="b1513rPriorityHint">${value ? `${value}/5${value === 5 ? ' · Highest' : value === 1 ? ' · Low' : ''}` : '1 Low … 5 Highest'}</span>
  </div>`;
}

function b1513rStoryRow(story, options = {}) {
  const open = Boolean(b1513rState().rowOpen[story.id]);
  const unread = storyHasUnreadMentorActivity(story);
  const audio = story.captureType === 'audio' || story.audioAssetId;
  const tellings = b1513StoryVersionCount(story);
  const dev = developmentState(story);
  return `<article class="sRow b1513rRow ${open ? 'b1513rOpen' : ''}" data-story-row="${attr(story.id)}">
    <div class="b1513rRowMain">
      <button class="starBtn ${isMentor() ? 'mentor' : ''} ${(isMentor() ? story.mentorStar : story.studentStar) ? 'on' : ''}" type="button"
        data-toggle-star="${attr(story.id)}" aria-label="${isMentor() ? 'Toggle mentor star' : 'Toggle story star'}" aria-pressed="${isMentor() ? story.mentorStar : story.studentStar}">★</button>
      <div class="rMain">
        <div class="rTitle">${story.prefixEnabled ? '<span class="pre">The One Where</span>' : ''}${esc(story.title)}
          ${unread ? '<span class="emberDot" title="New mentor feedback"></span>' : ''}
        </div>
        <div class="rSub b1513rRowFacts">
          <span class="b1513rFact ${dev === 'Complete' ? 'ok' : ''}">${esc(dev)}</span>
          ${statusChip(story)}
          ${story.status === 'private' && story.visibility === 'mentor_visible' ? '<span class="stChip b1513VisMentor" title="Your mentor can see this story for guidance. Submitting is still separate.">👁 Mentor visible</span>' : ''}
          ${b1513FeatureOn('versions') && tellings > 2 ? `<span class="b1513rFact">${tellings} tellings</span>` : ''}
          ${audio ? `<span class="b1513rFact">🎙</span>` : ''}
          <span class="b1513rFact dim">updated ${esc(ago(story.updatedAt || story.createdAt))}</span>
        </div>
      </div>
      <div class="b1513rRowActions">
        ${options.inlinePriority && isStudent() && state.capabilities?.inlinePriority ? b1513rPriorityControl(story) : ''}
        <button class="rowBtn" type="button" data-b1513r-row-more="${attr(story.id)}" aria-expanded="${open}">${open ? 'Less' : 'More'}</button>
        <button class="rowBtn pri" type="button" data-open-story="${attr(story.id)}">${isMentor() ? 'Full review' : 'Open Story'}</button>
      </div>
    </div>
    ${open ? `<div class="b1513rRowMoreArea">
      ${excerpt(story) ? `<span class="exc">“${esc(excerpt(story))}”</span>` : '<span class="exc">No telling yet — add it when you have two minutes.</span>'}
      <div class="b1513rRowSecondary">
        ${story.lesson ? `<span><b>Lesson</b> ${esc(story.lesson)}</span>` : '<span class="dim"><b>Lesson</b> not written yet</span>'}
        ${story.status !== 'private' && story.mentorScore ? `<span class="b1513rMentorScore"><b>Mentor Score</b> ${'★'.repeat(story.mentorScore)}${'☆'.repeat(5 - story.mentorScore)} ${story.mentorScore}/5</span>` : ''}
        ${story.categories.length ? `<span><b>Categories</b> ${story.categories.map((id) => presentationTaxonomyLabel('categories', id)).join(', ')}</span>` : ''}
        ${story.questionCount ? `<span><b>Questions</b> ${story.questionCount}</span>` : ''}
        ${birdMini(story)}
        <button class="rowBtn" type="button" data-open-quick="${attr(story.id)}">${isMentor() ? 'Quick review' : 'Quick Look'}</button>
      </div>
    </div>` : ''}
  </article>`;
}

/* ---------------- Story Room refinements (override) ---------------- */

function b1513rSaveStateSpan(key) {
  const flash = b1513rState().saveFlash;
  const text = flash.key === key ? (flash.state === 'saving' ? 'Saving…' : flash.state === 'saved' ? 'Saved ✓' : flash.state === 'error' ? 'Couldn’t save — try again' : '') : '';
  return `<span class="saveState b1513rSaveState ${flash.key === key ? flash.state : ''}" data-b1513r-save-state="${attr(key)}" role="status" aria-live="polite">${text}</span>`;
}

function b1513rFlashSave(key, saveStateValue) {
  const flash = b1513rState().saveFlash;
  flash.key = key;
  flash.state = saveStateValue;
  const span = document.querySelector(`[data-b1513r-save-state="${CSS.escape(key)}"]`);
  if (span) {
    span.textContent = saveStateValue === 'saving' ? 'Saving…' : saveStateValue === 'saved' ? 'Saved ✓' : saveStateValue === 'error' ? 'Couldn’t save — try again' : '';
    span.className = `saveState b1513rSaveState ${saveStateValue}`;
  }
}

function b1513rSpokenSeconds(words) {
  return Math.round(words / 2.3); // ≈140 wpm easy speaking pace; guidance, not a quota
}

function b1513rThirtyGuidance(text) {
  const words = b1513WordCount(text);
  if (!words) return '';
  const seconds = b1513rSpokenSeconds(words);
  const tone = seconds <= 24 ? 'You have room to breathe.' : seconds <= 34 ? 'Right in the pocket.' : seconds <= 45 ? 'A touch long — trim what you can spare.' : 'Well past thirty seconds — keep only the heart of it.';
  return `≈ ${seconds}s spoken at an easy pace (${words} words) · ${tone}`;
}

/* OVERRIDE of the B1-513 version surface: single title hierarchy, save triad,
 * elapsed-time 30-second guidance, "Previous Tellings" language. */
function b1513VersionSurface(story, mentor) {
  const tab = b1513ActiveVersionTab();
  const originalTab = tab === 'original';
  const text = b1513ActiveVersionText(story, tab);
  const completionMissing = state.storyCompletionIntent
    ? storyCompletionMissing(story, state.storyCompletionIntent)
    : [];
  const incompleteText = completionMissing.some((item) => item.id === 'text');
  const incompleteLesson = completionMissing.some((item) => item.id === 'lesson');
  const versionsOn = b1513FeatureOn('versions');
  const thirtyMeta = b1513VersionMeta('thirty_second');
  const nnqMeta = b1513VersionMeta('nnq_setup');
  const fullMeta = b1513VersionMeta('full_story');
  const fullLabel = fullMeta?.label || presentationSection('workingVersion').title || 'Full Story';

  const tabButton = (key, label, exists) => `<button type="button" role="tab" class="${tab === key ? 'on' : ''} ${exists === false ? 'b1513TabEmpty' : ''}" aria-selected="${tab === key}" data-story-tab="${key}">${esc(label)}${exists === false ? '<span class="b1513TabAdd" aria-hidden="true">+</span>' : ''}</button>`;
  const tabs = `<div class="voiceTabs b1513VersionTabs" role="tablist" aria-label="Story versions">
      ${tabButton('original', 'Original telling', true)}
      ${tabButton('working', fullLabel, true)}
      ${versionsOn && thirtyMeta ? tabButton('thirty', thirtyMeta.label, Boolean(story.versions?.thirty_second?.body)) : ''}
      ${versionsOn && nnqMeta ? tabButton('nnq', nnqMeta.label, Boolean(story.versions?.nnq_setup?.body)) : ''}
    </div>
    ${versionsOn ? `<p class="b1513VersionStrip">One story · ${b1513StoryVersionCount(story)} of 4 tellings. The Original telling is preserved untouched, always.</p>` : ''}`;

  if (originalTab) {
    return `${tabs}
          <div class="storyProse" data-empty="${text ? 'false' : 'true'}">${text ? esc(text) : '<span class="storyEmpty">No telling has been written yet.</span>'}</div>
          <div class="origNote">🔒 Preserved exactly as first told — your authentic voice, kept safe</div>
          ${presentationSectionVisible('learningLesson') ? `<div class="lessonBlock"><div class="lbl">${esc(presentationSection('learningLesson').title)}</div>
            <div class="lessonTxt">${story.lesson ? esc(story.lesson) : '<span class="storyEmpty">No lesson added yet.</span>'}</div>
          </div>` : ''}`;
  }

  if (tab === 'working') {
    if (!mentor) {
      return `${tabs}<form id="storyEditForm">
          <label class="srOnly" for="storyEditTitle">Story title</label>
          <input class="roomTitle roomTitleInput" id="storyEditTitle" value="${attr(story.title)}" required>
          ${presentationSectionVisible('workingVersion') ? `<div class="b1512CompletionField ${incompleteText ? 'b1512Incomplete' : ''}" data-completion-field="text">
            <label class="lbl" for="storyEditText">${esc(presentationSection('workingVersion').title)}</label>
            <textarea class="storyProse storyProseEdit" id="storyEditText" data-empty="${text ? 'false' : 'true'}" ${incompleteText ? `${state.storyCompletionIntent === 'submit' ? 'aria-invalid="true" ' : ''}aria-describedby="completion-help-text"` : ''} placeholder="Tell it like you’d tell a trusted friend. Don’t polish it — just get it down.">${esc(text)}</textarea>
            <p class="b1512IncompleteHelp" id="completion-help-text" data-completion-help="text" ${incompleteText ? '' : 'hidden'}>${esc(completionMissing.find((item) => item.id === 'text')?.message || '')}</p>
          </div>
          <div class="origNote">${esc(presentationSection('workingVersion').helper)}</div>` : `<input type="hidden" id="storyEditText" value="${attr(text)}">`}
          ${presentationSectionVisible('learningLesson') ? `<div class="lessonBlock b1512CompletionField ${incompleteLesson ? 'b1512Incomplete' : ''}" data-completion-field="lesson"><label class="lbl" for="storyLesson">${esc(presentationSection('learningLesson').title)}</label>
            <p class="stageHint">${esc(presentationSection('learningLesson').helper)}</p>
            <textarea class="lessonTxt lessonEdit" id="storyLesson" ${incompleteLesson ? 'aria-describedby="completion-help-lesson"' : ''} placeholder="One or two honest sentences. What did this leave you with?">${esc(story.lesson)}</textarea>
            <p class="b1512IncompleteHelp" id="completion-help-lesson" data-completion-help="lesson" ${incompleteLesson ? '' : 'hidden'}>${esc(completionMissing.find((item) => item.id === 'lesson')?.message || '')}</p>
          </div>` : '<input type="hidden" id="storyLesson" value="">'}
          <div class="inlineActions"><button class="btnSave" type="submit">Save ${esc(fullLabel)}</button>
          ${state.capabilities?.voiceCapture ? `<button class="rowBtn" type="button" data-b1513r-full-voice="append" title="Speak instead of type — StoryForge types while you talk">🎤 Add with voice</button>` : ''}
          ${b1513rSaveStateSpan(`full:${story.id}`)}</div>
        </form>`;
    }
    return `${tabs}
          <div class="storyProse" data-empty="${text ? 'false' : 'true'}">${text ? esc(text) : '<span class="storyEmpty">No telling has been written yet.</span>'}</div>
          <div class="origNote">${esc(story.studentName.split(/\s+/)[0])}’s editable ${esc(fullLabel)} — the original stays untouched</div>
          ${presentationSectionVisible('learningLesson') ? `<div class="lessonBlock"><div class="lbl">${esc(presentationSection('learningLesson').title)}</div>
            <div class="lessonTxt">${story.lesson ? esc(story.lesson) : '<span class="storyEmpty">No lesson added yet.</span>'}</div>
          </div>` : ''}`;
  }

  const key = B1513_TAB_TO_KEY[tab];
  const meta = b1513VersionMeta(key) || {};
  const version = story.versions?.[key] || null;
  const body = version?.body || '';
  const recorder = b1513State().versionRecorder;
  const recActive = recorder && recorder.storyId === story.id && recorder.versionKey === key;
  const revisions = asArray(version?.revisions);
  const historyOpen = Boolean(b1513State().versionHistoryOpen[`${story.id}:${key}`]);
  const timeMe = b1513rState().timeMe;

  if (mentor && !body) {
    return `${tabs}<div class="storyProse" data-empty="true"><span class="storyEmpty">${esc(story.studentName.split(/\s+/)[0])} hasn’t written a ${esc(meta.label)} yet.</span></div>`;
  }
  if (mentor) {
    return `${tabs}
        <div class="b1513VersionGuide"><span class="b1513VersionTarget">${esc(meta.helper || '')}</span></div>
        <div class="storyProse">${esc(body)}</div>
        <div class="origNote">${esc(story.studentName.split(/\s+/)[0])}’s ${esc(meta.label)} · last edited ${esc(formatDateTime(version?.updatedAt))}</div>`;
  }

  return `${tabs}
      <div class="b1513VersionGuide">
        <div class="b1513VersionGuideText"><b>${esc(meta.label)}</b><span>${esc(meta.helper || '')}</span>${key === 'thirty_second' ? '<span class="b1513VersionTarget">Aim for about thirty seconds out loud — your pace, your accent, your rhythm. The timer below is a guide, never a quota.</span>' : meta.target ? `<span class="b1513VersionTarget">${esc(meta.target)}</span>` : ''}</div>
        ${version ? `<div class="b1513VersionMeta">Started ${esc(formatDate(version.createdAt))} · last saved ${esc(formatDateTime(version.updatedAt))} · ${version.source === 'voice' ? '🎤 voice' : '⌨ typed'}</div>` : '<div class="b1513VersionMeta">Not started yet — type it, or tell it out loud.</div>'}
      </div>
      <form data-b1513-version-form="${attr(key)}" data-story-id="${attr(story.id)}">
        <label class="srOnly" for="b1513VersionText">${esc(meta.label)}</label>
        <textarea class="storyProse storyProseEdit b1513VersionText" id="b1513VersionText" data-b1513-version-input placeholder="${key === 'thirty_second' ? 'Say the heart of this story in about thirty seconds…' : 'Tell it so it ends on a question you want the interviewer to ask…'}">${esc(body)}</textarea>
        <div class="b1513VersionCount" data-b1513-word-count aria-live="polite">${key === 'thirty_second' ? b1513rThirtyGuidance(body) : (body ? `≈ ${b1513WordCount(body)} words` : '')}</div>
        ${key === 'thirty_second' ? `<div class="b1513rTimeMe">${timeMe && timeMe.key === key
          ? `<button class="rowBtn" type="button" data-b1513r-time-stop>⏱ <span data-b1513r-time-clock>0:00</span> — Stop</button><span class="stageHint">Read it out loud at your natural pace. Stop when you finish.</span>`
          : '<button class="rowBtn" type="button" data-b1513r-time-start>⏱ Time me reading this</button>'}</div>` : ''}
        ${recActive ? b1513VersionRecorderMarkup(recorder) : `<div class="inlineActions b1513VersionActions">
          <button class="btnSave" type="submit">Save ${esc(meta.label)}</button>
          ${state.capabilities?.voiceCapture ? `<button class="rowBtn" type="button" data-b1513-version-voice="append" title="Speak instead of type">🎤 Add with voice</button>
          <button class="rowBtn" type="button" data-b1513-version-voice="retell" title="Speak a fresh telling — the current one is kept in Previous Tellings">🎤 Retell with voice</button>` : ''}
          ${body ? '<button class="rowBtn" type="button" data-b1513-version-retell-typed>Start a fresh retelling</button>' : ''}
          ${b1513rSaveStateSpan(`${key}:${story.id}`)}
        </div>`}
      </form>
      <div class="origNote">Add appends to what’s here. Retell starts fresh — your current telling moves to <b>Previous Tellings</b> and can always be restored.</div>
      ${revisions.length ? `<div class="b1513VersionHistory">
        <button class="reflAdd" type="button" data-b1513-version-history="${attr(key)}" aria-expanded="${historyOpen}">🕘 Previous Tellings (${revisions.length}) ${historyOpen ? '▴' : '▾'}</button>
        ${historyOpen ? revisions.map((rev) => `<div class="b1513Revision">
          <div class="b1513RevisionMeta"><span>${esc(formatDateTime(rev.savedAt))}</span><span>${rev.source === 'voice' ? '🎤 voice' : '⌨ typed'}</span>
            <button class="rowBtn" type="button" data-b1513-restore-revision="${attr(rev.id)}" data-version-key="${attr(key)}">Restore this telling</button></div>
          <div class="b1513RevisionBody">${esc(rev.body.length > 400 ? `${rev.body.slice(0, 400)}…` : rev.body)}</div>
        </div>`).join('') : ''}
      </div>` : ''}`;
}

/* ---------------- Inspiration: Browse-first (override) + Guide Me ---------------- */

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
  browse.loaded = true;
}

function b1513rBrowseCard(prompt) {
  const browse = b1513rState().browse;
  const open = browse.openPromptId === prompt.id;
  return `<article class="b1513rPromptCard ${open ? 'open' : ''}" data-b1513r-prompt-card="${attr(prompt.id)}">
    <div class="b1513rPromptTop">
      <p class="b1513rPromptText">${esc(prompt.text)}</p>
      <button class="starBtn b1513rFav ${prompt.favorite ? 'on' : ''}" type="button" data-b1513r-fav="${attr(prompt.id)}" aria-pressed="${prompt.favorite}" aria-label="${prompt.favorite ? 'Remove from favorites' : 'Add to favorites'}">★</button>
    </div>
    <div class="b1513rPromptMeta"><span>${esc(String(prompt.territory || '').replaceAll('_', ' '))}</span></div>
    ${open ? `<div class="b1513rPromptAnswer">
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
    </div>` : `<div class="inlineActions b1513rPromptActions">
      <button class="rowBtn pri" type="button" data-b1513r-answer-now="${attr(prompt.id)}">Answer now</button>
      <button class="rowBtn" type="button" data-b1513r-save-later-id="${attr(prompt.id)}">Save for later</button>
    </div>`}
  </article>`;
}

function renderInspiration() {
  const insp = b1513State().inspiration;
  const browse = b1513rState().browse;
  const mode = browse.mode;
  const filters = (items, key, current) => items.map((item) => `<button class="cChip ${current === item.id ? 'on' : ''}" type="button" data-b1513r-browse-filter="${attr(key)}" data-b1513r-filter-value="${attr(current === item.id ? '' : item.id)}" aria-pressed="${current === item.id}">${esc(item.label)}</button>`).join('');
  const dims = insp.dimensions || { who: [], domain: [], energy: [] };

  main.innerHTML = `<section data-view="inspiration" class="live b1513Inspiration">
    <div class="b1513rInspHero">
      ${b1513rFullBody(state.user?.id, 'b1513rInspBody')}
      <div>
        <div class="eyebrow">Inspiration</div>
        <h1 class="h1">Find the stories you <em>forgot you had</em>.</h1>
        <div class="panel b1513rHowPanel"><div class="pBody">
          <p class="stageHint"><b>How this works.</b> Browse real memory questions — built from research on how memory actually works — and answer any that spark something, by typing or just talking (🎤). Good answers become ordinary StoryForge stories in <b>your Library</b>: same privacy, same review flow, no separate pile. Not sure where to start? <b>Guide Me</b> will walk you there one question at a time.</p>
        </div></div>
      </div>
    </div>
    <div class="voiceTabs b1513rInspModes" role="tablist" aria-label="Inspiration modes">
      <button type="button" role="tab" class="${mode === 'browse' ? 'on' : ''}" aria-selected="${mode === 'browse'}" data-b1513r-insp-mode="browse">Browse questions</button>
      <button type="button" role="tab" class="${mode === 'guide' ? 'on' : ''}" aria-selected="${mode === 'guide'}" data-b1513r-insp-mode="guide">✨ Guide Me</button>
      <button type="button" role="tab" class="${mode === 'saved' ? 'on' : ''}" aria-selected="${mode === 'saved'}" data-b1513r-insp-mode="saved">Saved &amp; unfinished (${insp.saved.length})</button>
    </div>

    ${mode === 'browse' ? `
    <form class="listBar b1513rBrowseBar" id="b1513rBrowseSearch" role="search">
      <label class="srOnly" for="b1513rBrowseQ">Search questions</label>
      <input id="b1513rBrowseQ" type="search" placeholder="Search questions… (food, travel, first job…)" value="${attr(browse.q)}" autocomplete="off">
      <button class="rowBtn pri" type="submit">Search</button>
      <button class="cChip b1513rFavFilter ${browse.fav ? 'on' : ''}" type="button" data-b1513r-browse-fav aria-pressed="${browse.fav}">★ Favorites${browse.favoriteCount ? ` (${browse.favoriteCount})` : ''}</button>
      <span class="countNote">${browse.prompts.length} questions</span>
    </form>
    <div class="classChips b1513rBrowseFilters" role="group" aria-label="Filters">
      ${filters(dims.who, 'who', browse.who)}<span class="b1513rFilterSep" aria-hidden="true">·</span>
      ${filters(dims.domain, 'domain', browse.domain)}<span class="b1513rFilterSep" aria-hidden="true">·</span>
      ${filters(dims.energy, 'energy', browse.energy)}
    </div>
    <div class="b1513rPromptGrid">${browse.prompts.length ? browse.prompts.map(b1513rBrowseCard).join('') : emptyState('No questions match.', 'Clear a filter or search for something else.')}</div>` : ''}

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

/* Guide Me without the who-is-center step when the subject is the student:
 * the guide starts at DOMAIN with subject defaulted to You; "about someone
 * else" is a compact switch, not a wizard gate. */
function b1513WizardStepMarkup() {
  const insp = b1513State().inspiration;
  const dims = insp.dimensions;
  if (!dims) return '<div class="stageHint">Inspiration content is not available.</div>';
  const sel = insp.selections;
  if (!sel.who) sel.who = 'you';
  if (insp.step === 'who') insp.step = 'domain';
  const subjectLabel = dims.who.find((entry) => entry.id === sel.who)?.label || 'You';
  const subjectSwitch = `<div class="b1513rSubjectRow">This story is about: <b>${esc(subjectLabel)}</b>
    <span class="classChips">${dims.who.map((entry) => `<button class="cChip ${sel.who === entry.id ? 'on' : ''}" type="button" data-b1513r-guide-subject="${attr(entry.id)}" aria-pressed="${sel.who === entry.id}">${esc(entry.label)}</button>`).join('')}</span></div>`;
  const back = insp.step !== 'domain' ? '<button class="backBtn" type="button" data-b1513-wizard-back>‹ Back</button>' : '';
  const stepIndex = { domain: 1, whoDetail: 2, energy: sel.who === 'you' ? 2 : 3, question: sel.who === 'you' ? 3 : 4 }[insp.step] || 1;
  const totalSteps = sel.who === 'you' ? 3 : 4;
  const progress = `<div class="eyebrow">Guide me · step ${stepIndex} of ${totalSteps}</div>`;

  if (insp.step === 'domain') {
    return `${progress}<h2 class="h2 b1513WizardQ">Where should we look?</h2>
      ${subjectSwitch}
      <div class="b1513Choices">${dims.domain.map((entry) => b1513WizardChoice('domain', entry, sel.domain === entry.id)).join('')}</div>`;
  }
  if (insp.step === 'whoDetail') {
    const pool = dims.whoDetail.filter((entry) => entry.parent === sel.who);
    const primary = pool.slice(0, 2);
    const rest = pool.slice(2);
    const expanded = insp.whoDetailExpanded;
    return `${back}${progress}<h2 class="h2 b1513WizardQ">${sel.who === 'family' ? 'Which part of your family?' : 'Who, more specifically?'}</h2>
      <div class="b1513Choices">
        ${primary.map((entry) => b1513WizardChoice('whoDetail', entry, sel.whoDetail === entry.id)).join('')}
        ${!expanded && rest.length ? '<button class="b1513Choice b1513More" type="button" data-b1513-wizard-more><span class="b1513ChoiceLabel">More…</span><span class="b1513ChoiceHint">See other relationships</span></button>' : ''}
      </div>
      ${expanded ? `<div class="b1513Choices b1513ChoicesMore">${rest.map((entry) => b1513WizardChoice('whoDetail', entry, sel.whoDetail === entry.id)).join('')}</div>` : ''}
      <button class="rowBtn b1513SkipStep" type="button" data-b1513-wizard-pick="whoDetail" data-b1513-wizard-value="">It doesn’t matter — surprise me</button>`;
  }
  if (insp.step === 'energy') {
    return `${back}${progress}<h2 class="h2 b1513WizardQ">What kind of story are you in the mood to find?</h2>
      <p class="stageHint">Light stories are real interview material too — they’re often where your personality lives.</p>
      <div class="b1513Choices">${dims.energy.map((entry) => b1513WizardChoice('energy', entry, sel.energy === entry.id)).join('')}</div>`;
  }
  const prompt = insp.prompt;
  if (!prompt) return `${back}<div class="stageHint">No more questions match this path — try another combination.</div>`;
  const recorder = insp.voice;
  return `${back}${progress}
    <article class="b1513QuestionCard" aria-live="polite">
      <div class="b1513QuestionTag"><span class="tag">Memory prompt</span>${prompt.territory ? `<span class="b1513Territory">${esc(String(prompt.territory).replaceAll('_', ' '))}</span>` : ''}</div>
      <h2 class="b1513Question">${esc(prompt.text)}</h2>
      ${prompt.followUp ? `<p class="b1513FollowUp" data-b1513-followup ${insp.answer.trim() ? '' : 'hidden'}>↳ ${esc(prompt.followUp)}</p>` : ''}
      <label class="srOnly" for="b1513Answer">Your answer</label>
      <textarea id="b1513Answer" class="storyProse storyProseEdit b1513AnswerBox" data-b1513-answer placeholder="${state.capabilities?.voiceCapture ? 'Type here — or tap the mic and just talk…' : 'Type what this brings back…'}">${esc(insp.answer)}</textarea>
      ${recorder ? `<div class="voxDock rec b1513VersionDock"><div class="voxRow"><span class="voxTimer"><span class="rdot" aria-hidden="true"></span><span data-b1513-rec-clock>0:0${Math.min(9, recorder.seconds)}</span></span>
        <span class="voxWave" aria-hidden="true">${Array.from({ length: 13 }, () => '<i></i>').join('')}</span>
        <button class="voxBtn done" type="button" data-b1513-insp-rec-done>Done</button><button class="voxGhost" type="button" data-b1513-insp-rec-cancel>Discard</button></div>
        <div class="voxState" role="status" aria-live="polite">🎤 StoryForge types while you talk — edit anything after.</div></div>` : ''}
      <div class="b1513ConvertRow" data-b1513-convert ${insp.answer.trim() ? '' : 'hidden'}>
        ${prompt.interviewUse ? `<p class="b1513WhyWorks">💡 <b>Why this works in an interview:</b> ${esc(prompt.interviewUse)}</p>` : ''}
        <label class="fLbl" for="b1513Change">What did it change? <span>— optional, one honest sentence. It becomes this story’s Learning Lesson.</span></label>
        <input id="b1513Change" data-b1513-change placeholder="What this moment changed about you, or taught you…" maxlength="240" value="${attr(insp.changeNote || '')}">
      </div>
      <div class="inlineActions b1513AnswerActions">
        ${!recorder && state.capabilities?.voiceCapture ? '<button class="rowBtn" type="button" data-b1513-insp-voice>🎤 Talk instead</button>' : ''}
        <button class="noteSend" type="button" data-b1513-add-library ${insp.answer.trim() ? '' : 'disabled'}>Add to StoryForge Library</button>
        <button class="rowBtn" type="button" data-b1513-save-later>Save for later</button>
      </div>
      <div class="inlineActions b1513AgencyRow">
        <button class="rowBtn" type="button" data-b1513-skip>Skip</button>
        <button class="rowBtn" type="button" data-b1513-another>Give me another</button>
        <button class="rowBtn" type="button" data-b1513-sparked>✧ This sparked another story</button>
        ${insp.selections.energy !== 'light' ? '<button class="rowBtn" type="button" data-b1513-lighter>Prefer lighter questions</button>' : ''}
      </div>
      <p class="stageHint b1513Agency">You’re in charge here. Skip anything, stop any time — your progress is saved, and nothing is shared unless you add it to your Library.</p>
    </article>`;
}

async function b1513rGuideSubject(value) {
  const insp = b1513State().inspiration;
  insp.selections.who = value;
  insp.selections.whoDetail = '';
  if (value !== 'you' && insp.step === 'domain') { /* relationship step comes after domain */ }
  b1513RerenderWizard();
}

/* guide-me step order override: domain → (whoDetail if not you) → energy → question */
async function b1513WizardPick(step, value) {
  const insp = b1513State().inspiration;
  insp.selections[step] = value;
  insp.whoDetailExpanded = false;
  if (step === 'domain') insp.step = insp.selections.who === 'you' ? 'energy' : 'whoDetail';
  else if (step === 'whoDetail') insp.step = 'energy';
  else if (step === 'energy') {
    insp.step = 'question';
    if (!insp.prompt || !insp.answer.trim()) await b1513NextPrompt();
  }
  b1513RerenderWizard();
}

function b1513WizardBack() {
  const insp = b1513State().inspiration;
  const order = insp.selections.who === 'you' ? ['domain', 'energy', 'question'] : ['domain', 'whoDetail', 'energy', 'question'];
  const index = order.indexOf(insp.step);
  if (index > 0) insp.step = order[index - 1];
  if (insp.step !== 'question') b1513StopInspRecorder(false);
  b1513RerenderWizard();
}

/* ---------------- Request a Story ---------------- */

async function b1513rLoadRequests() {
  const requests = b1513rState().requests;
  const payload = await b1513rApi.requests();
  requests.invitations = asArray(payload?.invitations);
  requests.contributions = asArray(payload?.contributions);
  requests.relationships = asArray(payload?.relationships);
  requests.loaded = true;
}

function b1513rInviteStatusChip(invitation) {
  const map = {
    draft: ['Draft — not sent', 'st-private'], sent: ['Sent', 'st-awaiting'], opened: ['Opened', 'st-in_review'],
    contributed: ['Story received ✓', 'st-approved'], expired: ['Expired', 'st-changes'], revoked: ['Revoked', 'st-changes'],
  };
  const [label, cls] = map[invitation.status] || [invitation.status, ''];
  return `<span class="stChip ${cls}">${esc(label)}</span>`;
}

function renderRequests() {
  const requests = b1513rState().requests;
  const view = requests.view;
  const newCount = requests.contributions.filter((item) => item.state === 'new').length;

  if (view === 'new') { return b1513rRenderNewInvite(); }

  main.innerHTML = `<section data-view="requests" class="live b1513rRequests">
    <div class="b1513rInspHero">
      ${b1513rFullBody(state.user?.id, 'b1513rInspBody')}
      <div>
        <div class="eyebrow">Request a Story</div>
        <h1 class="h1">The people who know you <em>remember stories you can’t</em>.</h1>
        <div class="panel b1513rHowPanel"><div class="pBody"><p class="stageHint"><b>How this works.</b> Inspiration helps <i>you</i> remember your stories. Request a Story invites the people who know you best — a parent, a mentor, an old friend — to tell stories <i>about</i> you. They get one private link, no account, no app: they just talk (🎤) and StoryForge writes it down. What they share arrives here as a <b>story candidate</b> — yours to keep, use as inspiration, or promote into your Library.</p></div></div>
      </div>
    </div>

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
            <span class="rSub">${esc(invitation.emailMasked)} · ${invitation.sentAt ? `sent ${esc(ago(invitation.sentAt))}` : 'not sent yet'} · expires ${esc(formatDate(invitation.expiresAt))}${invitation.videoGreeting ? ' · 🎬 video greeting attached' : ''}</span></div>
          ${b1513rInviteStatusChip(invitation)}
          <div class="inlineActions">
            <button class="rowBtn" type="button" data-b1513r-invite-preview="${attr(invitation.id)}">Preview email</button>
            <button class="rowBtn" type="button" data-b1513r-guest-preview="${attr(invitation.token)}">See their view</button>
            ${['draft'].includes(invitation.status) ? `<button class="noteSend" type="button" data-b1513r-invite-send="${attr(invitation.id)}">Send</button>` : ''}
            ${['sent', 'opened'].includes(invitation.status) ? `<button class="rowBtn" type="button" data-b1513r-invite-resend="${attr(invitation.id)}">Gentle reminder</button>` : ''}
            ${invitation.status !== 'revoked' ? `<button class="rowBtn danger" type="button" data-b1513r-invite-revoke="${attr(invitation.id)}">Revoke</button>` : ''}
          </div>
        </div>`).join('') : '<div class="stageHint">No invitations yet. Ask a parent, a mentor, an old friend — the people who tell your stories better than you do.</div>'}
        ${requests.emailPreview ? `<div class="b1513ReviewCheckPreview" role="region" aria-label="Email preview">
          <div class="rLbl">Email preview — nothing has been sent</div>
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
  const draft = requests.draft;
  const groups = [['family', 'Family'], ['friends', 'Friends'], ['professional', 'Teachers & Colleagues']];
  const relationships = requests.relationships;
  const primary = relationships.filter((rel) => ['parent', 'sibling', 'best_friend'].includes(rel.id));
  const rest = relationships.filter((rel) => !['parent', 'sibling', 'best_friend'].includes(rel.id));
  main.innerHTML = `<section data-view="requests" class="live b1513rRequests">
    <button class="backBtn" type="button" data-b1513r-req-back>‹ Request a Story</button>
    <div class="eyebrow">Ask someone for a story</div>
    <h1 class="h1">Who knows this <em>story of you</em>?</h1>
    <form id="b1513rInviteForm" class="panel b1513rInviteForm"><div class="pBody">
      <div class="fLbl">They are your…</div>
      <div class="b1513Choices">
        ${primary.map((rel) => `<button type="button" class="b1513Choice ${draft.relationship === rel.id ? 'on' : ''}" data-b1513r-rel="${attr(rel.id)}" aria-pressed="${draft.relationship === rel.id}"><span class="b1513ChoiceLabel">${esc(rel.label)}</span></button>`).join('')}
        ${!requests.relMore ? '<button type="button" class="b1513Choice b1513More" data-b1513r-rel-more><span class="b1513ChoiceLabel">More…</span><span class="b1513ChoiceHint">Grandparent, mentor, coworker…</span></button>' : ''}
      </div>
      ${requests.relMore ? `<div class="classChips b1513rRelMore">${rest.map((rel) => `<button type="button" class="cChip ${draft.relationship === rel.id ? 'on' : ''}" data-b1513r-rel="${attr(rel.id)}" aria-pressed="${draft.relationship === rel.id}">${esc(rel.label)}</button>`).join('')}</div>` : ''}
      <label class="fLbl" for="b1513rInvName">Their first name <span>— how they’ll be greeted</span></label>
      <input id="b1513rInvName" maxlength="40" placeholder="Mom, Dr. Ito, Sam…" value="${attr(draft.contributorName)}" required>
      <label class="fLbl" for="b1513rInvEmail">Their email</label>
      <input id="b1513rInvEmail" type="email" placeholder="name@example.com" value="${attr(draft.email)}" required>
      <label class="fLbl" for="b1513rInvMsg">A personal note <span>— optional, shown in the invitation</span></label>
      <textarea id="b1513rInvMsg" rows="2" maxlength="280" placeholder="Mom — I’m collecting stories for my applications. Anything you remember counts.">${esc(draft.personalMessage)}</textarea>
      <div class="setRow"><div class="sTxt"><b>🎬 Personal video greeting</b><span>Optional: record a short private video that plays when they open your invitation. Stored through StoryForge’s private media design (currently deferred — shown as a state demo).</span></div>
        <button class="rowBtn" type="button" data-b1513r-video-demo>Record after sending</button></div>
      <p class="stageHint">They get one private link — no account, no app, no access to anything of yours. It expires in 30 days, you can revoke it any time, and whatever they share goes only to you.</p>
      <div class="inlineActions"><button class="noteSend" type="submit">Create invitation</button><button class="rowBtn" type="button" data-b1513r-req-back>Cancel</button></div>
    </div></form>
  </section>`;
}

/* ---------------- Guest contributor experience (magic-link preview) ---------------- */

async function b1513rOpenGuest(token) {
  const guest = b1513rState().guest;
  const payload = await b1513rApi.guest(token).catch((error) => ({ error: error.message }));
  guest.open = true;
  guest.token = token;
  guest.payload = payload;
  guest.mode = 'landing';
  guest.promptIndex = 0;
  guest.text = '';
  guest.sent = false;
  document.body.classList.add('b1513rGuestMode');
  b1513rRenderGuest();
}

function b1513rCloseGuest() {
  const guest = b1513rState().guest;
  guest.open = false;
  if (guest.voice?.timer) window.clearInterval(guest.voice.timer);
  guest.voice = null;
  document.body.classList.remove('b1513rGuestMode');
  teaching.classList.remove('open');
  teaching.innerHTML = '';
}

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
      <p class="b1513rGuestBig">You do not need to write perfectly.<br>You can simply talk.</p>
      <button class="b1513rGuestPrimary" type="button" data-b1513r-guest-start="voice">🎤 TELL A STORY</button>
      <button class="b1513rGuestSecondary" type="button" data-b1513r-guest-start="type">TYPE INSTEAD</button>
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

function b1513rGuestRecorderTick() {
  const guest = b1513rState().guest;
  const recorder = guest.voice;
  if (!recorder) return;
  recorder.seconds += 1;
  const clock = teaching.querySelector('[data-b1513-rec-clock]');
  if (clock) clock.textContent = `${Math.floor(recorder.seconds / 60)}:${String(recorder.seconds % 60).padStart(2, '0')}`;
  if (recorder.seconds % 3 === 0) {
    const sentences = [
      'When Brian was little, he would line up his toys like patients in a waiting room. ',
      'One winter our whole street lost power, and he was the one who checked on every neighbor. ',
      'I remember the day he decided — he came home and said, I know what I want to do. ',
      'He has always been the one people call first. ',
    ];
    guest.text += sentences[recorder.sentenceIndex % sentences.length];
    recorder.sentenceIndex += 1;
    const transcript = teaching.querySelector('.b1513rGuestTranscript');
    if (transcript) { transcript.innerHTML = `${esc(guest.text)}<span class="b1513rCaret"></span>`; transcript.scrollTop = transcript.scrollHeight; }
  }
}

/* ---------------- Admin: mirrored StoryForge ---------------- */

function b1513rAttentionBuckets() {
  const dir = b1513State().directory;
  const students = dir.students;
  const daysSince = (value) => value ? (Date.now() - new Date(value).getTime()) / 86400000 : Infinity;
  return [
    { key: 'needs_review', label: 'Needs Review', hint: 'Submitted work waiting on you', list: students.filter((s) => s.storyCounts.awaiting > 0 || s.storyCounts.inReview > 0) },
    { key: 'needs_nudge', label: 'Needs a Nudge', hint: 'Quiet for 14+ days with work in flight', list: students.filter((s) => s.storyCounts.total > 0 && s.storyCounts.awaiting === 0 && daysSince(s.lastActivity) > 14) },
    { key: 'changes_returned', label: 'Changes Returned', hint: 'Waiting on the student’s revision', list: students.filter((s) => s.storyCounts.changes > 0) },
    { key: 'never_started', label: 'Never Started / Quiet', hint: 'Eligible but no stories yet', list: students.filter((s) => s.storyCounts.total === 0) },
    { key: 'progressing', label: 'Making Progress', hint: 'Active this week', list: students.filter((s) => s.storyCounts.total > 0 && daysSince(s.lastActivity) <= 7 && !s.storyCounts.awaiting) },
  ];
}

function b1513rStudentCard(entry, { compact = false } = {}) {
  const counts = entry.storyCounts;
  const reviewBit = entry.lastReview ? `Last review ${ago(entry.lastReview)}` : 'Last review none';
  return `<article class="sRow b1513rRow b1513rStudentCard">
    <div class="b1513rRowMain">
      ${b1513rHeadshot({ id: entry.id, name: entry.name }, { withName: false, size: 'md' })}
      <div class="rMain">
        <div class="rTitle">${esc(entry.name)}${entry.warnings.length ? `<span class="b1513WarnDot" title="${attr(entry.warnings.join(' · '))}">⚠</span>` : ''}</div>
        <div class="rSub b1513rRowFacts">
          <span class="b1513rFact dim">${entry.lastActivity ? `Active ${esc(ago(entry.lastActivity))}` : 'No activity yet'}</span>
          <span class="b1513rFact">${counts.total} ${counts.total === 1 ? 'story' : 'stories'}</span>
          ${counts.awaiting ? `<span class="stChip st-awaiting">${counts.awaiting} awaiting review</span>` : ''}
          ${counts.changes ? `<span class="stChip st-changes">${counts.changes} changes</span>` : ''}
          <span class="b1513rFact dim">${esc(reviewBit)}</span>
        </div>
      </div>
      <button class="rowBtn pri" type="button" data-b1513r-open-workspace="${attr(entry.id)}">OPEN WORKSPACE</button>
    </div>
  </article>`;
}

function b1513rRenderAdminHome() {
  const buckets = b1513rAttentionBuckets().filter((bucket) => bucket.list.length);
  const payload = adminConsoleState().home || {};
  const metrics = payload.metrics || {};
  main.innerHTML = `<section data-view="admin-home" class="live b1513rAdminMirror">
    <div class="homeHero">
      <div class="greet">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, <em>${esc(firstName())}</em>.</div>
      <div class="greetSub">Who needs your attention today?</div>
    </div>
    ${buckets.map((bucket) => `<div class="panel panel-gap b1513rBucket"><div class="pHead"><div class="h2">${esc(bucket.label)} <em>${bucket.list.length}</em></div><span class="stageHint">${esc(bucket.hint)}</span></div>
      <div class="pBody">${bucket.list.slice(0, 4).map((entry) => b1513rStudentCard(entry)).join('')}${bucket.list.length > 4 ? `<button class="pMore" type="button" data-nav="students">All ${bucket.list.length} ▸</button>` : ''}</div>
    </div>`).join('')}
    <div class="b1513rQuietStats">
      <span>${Number(metrics.submittedStories || 0)} submitted</span><span>·</span>
      <span>${Number(metrics.awaitingReview || 0)} awaiting</span><span>·</span>
      <span>${Number(metrics.approved || 0)} approved</span><span>·</span>
      <span>${b1513State().directory.total || b1513State().directory.students.length} eligible students</span>
    </div>
  </section>`;
}

/* OVERRIDE: directory as StoryForge-style cards with attention filters */
function b1513RenderAdminDirectory() {
  const dir = b1513State().directory;
  const requestsFilter = dir.filter;
  const daysSince = (value) => value ? (Date.now() - new Date(value).getTime()) / 86400000 : Infinity;
  let list = dir.students;
  if (requestsFilter === 'needs_review') list = list.filter((s) => s.storyCounts.awaiting > 0 || s.storyCounts.inReview > 0);
  else if (requestsFilter === 'needs_nudge') list = list.filter((s) => s.storyCounts.total > 0 && s.storyCounts.awaiting === 0 && daysSince(s.lastActivity) > 14);
  else if (requestsFilter === 'progressing') list = list.filter((s) => s.storyCounts.total > 0 && daysSince(s.lastActivity) <= 7);
  else if (requestsFilter === 'never_active') list = list.filter((s) => s.storyCounts.total === 0);
  const filters = [['', 'All Students'], ['needs_review', 'Needs Review'], ['needs_nudge', 'Needs a Nudge'], ['progressing', 'Making Progress'], ['never_active', 'Never Started']];
  main.innerHTML = `<section data-view="admin-students" class="live b1513rAdminMirror">
    <div class="eyebrow">Students</div>
    <h1 class="h1">Every eligible student, <em>including the quiet ones</em>.</h1>
    <form class="listBar" id="b1513DirectorySearchForm" role="search">
      <label class="srOnly" for="b1513DirQ">Search students</label>
      <input id="b1513DirQ" type="search" placeholder="Name or username…" value="${attr(dir.query)}" autocomplete="off">
      <button class="rowBtn pri" type="submit">Search</button>
      <span class="countNote">${list.length} of ${dir.total} eligible students</span>
    </form>
    <div class="classChips b1513rDirFilters" role="group" aria-label="Attention filters">
      ${filters.map(([value, label]) => `<button class="cChip ${requestsFilter === value ? 'on' : ''}" type="button" data-b1513-dir-filter="${value}" aria-pressed="${requestsFilter === value}">${label}</button>`).join('')}
    </div>
    <div id="b1513DirectoryRows">${list.length ? list.map((entry) => b1513rStudentCard(entry)).join('') : emptyState('No students match.', 'Adjust the search or filter.')}</div>
    <p class="stageHint">From the canonical LearnDash entitlement. Private story <b>content</b> is never listed — only counts.</p>
  </section>`;
}

/* Mirrored student workspace — “Maya’s StoryForge” */
async function b1513rOpenStudentWorkspace(id, tab = 'stories') {
  const dir = b1513State().directory;
  const payload = await withBusy(() => b1513Api.directoryStudent(id));
  dir.profile = payload;
  dir.profileTab = tab;
  state.route = 'student';
  state.routeId = id;
  pushPath('student', id, false);
  b1513rRenderStudentWorkspace();
}

function b1513rRenderStudentWorkspace() {
  const dir = b1513State().directory;
  const profile = dir.profile;
  if (!profile) { void navigate('students'); return; }
  const entry = profile.student;
  const first = entry.name.split(/\s+/)[0];
  const tab = dir.profileTab || 'stories';
  const tabs = [['stories', 'Stories'], ['overview', 'Overview'], ['activity', 'Activity'], ['reviews', 'Reviews'], ['notifications', 'Notifications'], ['account', 'Account']];
  const stories = asArray(profile.stories).map(normalizeStory);
  main.innerHTML = `<section data-view="admin-student" class="live b1513rAdminMirror b1513rStudentWorkspace">
    <button class="backBtn" type="button" data-nav="students">‹ Students</button>
    <div class="b1513rWorkspaceHead">
      ${b1513rHeadshot({ id: entry.id, name: entry.name }, { withName: false, size: 'lg' })}
      <div>
        <div class="eyebrow">${esc(first)}’s StoryForge <span class="b1513rAdminBadge">mentor view</span></div>
        <h1 class="h1">${esc(first)} <em>${esc(entry.name.split(/\s+/).slice(1).join(' '))}</em></h1>
        <p class="stageHint">${entry.lastActivity ? `Active ${esc(ago(entry.lastActivity))}` : 'No activity yet'} · ${entry.storyCounts.total} stories · ${entry.storyCounts.mentorVisible} mentor-visible · ${entry.storyCounts.private} private (never listed)</p>
      </div>
      <button class="noteSend b1513ReviewCheckBtn" type="button" data-b1513-review-check-preview="${attr(entry.id)}">Record Review Check</button>
    </div>
    ${dir.reviewCheckPreview ? `<div class="b1513ReviewCheckPreview" role="region" aria-label="Review check preview">
      <div class="rLbl">Preview — nothing has been sent</div>
      <p class="b1513ReviewCheckText">${esc(dir.reviewCheckPreview.text)}</p>
      <div class="inlineActions"><button class="noteSend" type="button" data-b1513-review-check-send="${attr(entry.id)}">Send to ${esc(first)}</button>
      <button class="rowBtn" type="button" data-b1513-review-check-cancel>Cancel</button></div></div>` : ''}
    ${dir.reviewCheckReceipt ? `<div class="b1513ReviewCheckPreview b1513Sent" role="status">✓ Sent ${esc(formatDateTime(dir.reviewCheckReceipt.sentAt))} · delivery: ${esc(dir.reviewCheckReceipt.status)} · audited.</div>` : ''}
    <div class="voiceTabs b1513ProfileTabs" role="tablist" aria-label="${attr(first)}’s StoryForge sections">
      ${tabs.map(([id, label]) => `<button type="button" role="tab" class="${tab === id ? 'on' : ''}" aria-selected="${tab === id}" data-b1513-profile-tab="${id}">${label}</button>`).join('')}
    </div>
    <div class="b1513ProfileBody">
      ${tab === 'stories' ? (stories.length
        ? stories.map((story) => b1513rStoryRow({ ...story, studentName: entry.name })).join('')
        : '<div class="storyEmpty">No mentor-visible or submitted stories yet.</div>') + (entry.storyCounts.private ? `<p class="stageHint">${entry.storyCounts.private} private ${entry.storyCounts.private === 1 ? 'story' : 'stories'} exist and cannot be listed or opened.</p>` : '')
      : b1513ProfileTabContent()}
    </div>
  </section>`;
}

/* Mirrored admin story review: the SAME Story Room + a Mentor Review rail */
function b1513rMentorReviewRail(story) {
  return `<div class="railCard b1513rMentorRail">
    <div class="rLbl">Mentor Review <span class="b1513rAdminBadge">admin</span></div>
    ${b1513DirectReviewControls(story)}
    <label class="fLbl" for="b1513rRailFeedback">Student-visible feedback</label>
    <textarea id="b1513rRailFeedback" rows="4" placeholder="${esc(story.studentName.split(/\s+/)[0])} will see this, with your attribution."></textarea>
    <label class="fLbl" for="b1513rRailInternal">Private admin note</label>
    <textarea id="b1513rRailInternal" class="internalNoteField" rows="3" placeholder="Visible only to StoryForge administrators."></textarea>
    <div class="inlineActions"><button class="noteSend" type="button" data-b1513r-rail-save>Save review</button>${b1513rSaveStateSpan(`review:${story.id}`)}</div>
    <p class="stageHint">Mentor voice notes live in the Mentor notes card below — same recorder, same rules.</p>
  </div>`;
}

async function b1513rOpenAdminStoryRoom(id) {
  await loadAdminStory(id);
  const story = adminConsoleState().story;
  if (!story) return;
  state.storyDetail = story;
  state.storyTab = 'original';
  room.classList.add('open');
  renderStoryRoom();
}

/* Override: admin review patches operate on the mirrored room when open */
async function b1513AdminPatch(patch, announce) {
  const inRoom = room.classList.contains('open') && canAdminReview();
  const story = inRoom ? state.storyDetail : adminConsoleState().story;
  if (!story) return;
  try {
    const result = await api.adminReview(story.id, { expectedVersion: story.rowVersion, patch });
    const next = normalizeStory({ ...(result?.story || {}), feedback: result?.feedback, internalNotes: result?.internalNotes });
    adminConsoleState().story = next;
    if (inRoom) { state.storyDetail = next; renderStoryRoom(); } else { renderAdminStory(); }
    const live = $('[data-b1513-review-live]');
    if (live) live.textContent = announce;
    notify(announce, '✓');
  } catch (error) {
    notify(error.message || 'The review change could not be saved.');
    if (inRoom) renderStoryRoom(); else renderAdminStory();
  }
}

/* ---------------- Content Studio + System Controls split ---------------- */

async function b1513rLoadContentStudio() {
  await loadAdminReleaseControls();
  if (!b1513State().adminInspiration) {
    const payload = await b1513Api.adminInspiration().catch(() => null);
    b1513State().adminInspiration = payload?.configuration || null;
  }
}

function b1513rRenderContentStudio() {
  main.innerHTML = `<section data-view="settings" class="live settingsPage b1513rAdminMirror">
    <div class="eyebrow">Administration</div>
    <h1 class="h1">Content <em>Studio</em></h1>
    <p class="stageHint">Everything students read — labels, taxonomy, versions, Inspiration questions, Request-a-Story prompts — with stable IDs, preview, and audited publish. No HTML, CSS, or scripts. Feature scopes and kill switches live separately in <button class="pMore" type="button" data-nav="settings">System Controls ▸</button></p>
    ${renderContentDisplayControls()}
    ${b1513InspirationConfigPanel()}
    <div class="panel panel-spaced"><div class="pHead"><div class="h2">Request-a-Story <em>prompts</em></div><span class="rolePill">${(window.__B1513R?.CONTRIB_LIBRARY?.prompts || []).length} prompts · 13 relationships</span></div>
      <div class="pBody"><p class="stageHint">Contributor questions are governed exactly like Inspiration questions: stable IDs, per-relationship targeting, retire/restore, preview, audited publish. Full editor arrives with the R4 content-manager depth; the library ships Founder-reviewed.</p>
      <div class="inlineActions"><button class="rowBtn" type="button" data-b1513r-guest-preview="rs-demo-rosa">Preview the contributor experience</button></div></div>
    </div>
    <div class="panel panel-spaced"><div class="pHead"><div class="h2">Question <em>Library</em></div></div>
      <div class="pBody"><p class="stageHint">The Interview Prep question bank remains intact (currently hidden from students by configuration).</p>
      <button class="rowBtn" type="button" data-nav="qlib">Open Question Library ▸</button></div>
    </div>
  </section>`;
}

/* ---------------- Settings IA ---------------- */

function b1513rSettingsExtraPanels() {
  const requests = b1513rState().requests;
  const invitations = requests.invitations;
  const unread = state.notifications.filter((item) => !notificationRead(item)).length;
  return `
    <div class="b1513rSettingsGroup" role="heading" aria-level="2">Story preferences</div>
    <div class="panel panel-spaced"><div class="pBody pbody-top">
      <div class="setRow"><div class="sTxt"><b>New stories start as</b><span>${b1513State().consent?.accepted ? 'Mentor Visible — from your mentorship choice. Change any story to Private any time.' : 'Private — you haven’t turned on mentorship visibility.'}</span></div><span class="rolePill roleReadOnly">${b1513State().consent?.accepted ? 'Mentor Visible' : 'Private'}</span></div>
      <div class="setRow"><div class="sTxt"><b>Spoken-time guidance</b><span>The 30-Second Version shows an estimated speaking time instead of a word quota.</span></div><span class="rolePill">On</span></div>
    </div></div>
    ${b1513PrivacySettingsPanel()}
    <div class="b1513rSettingsGroup" role="heading" aria-level="2">Notifications</div>
    <div class="panel panel-spaced"><div class="pBody pbody-top">
      <div class="setRow"><div class="sTxt"><b>In StoryForge</b><span>Mentor reviews, feedback, and Review Checks land in Notifications. ${unread ? `${unread} unread now.` : 'Nothing unread.'}</span></div>
        <button class="rowBtn" type="button" data-nav="notifications">Open</button></div>
    </div></div>
    <div class="b1513rSettingsGroup" role="heading" aria-level="2">Invitations</div>
    <div class="panel panel-spaced"><div class="pBody pbody-top">
      ${invitations.length ? invitations.map((invitation) => `<div class="setRow"><div class="sTxt"><b>${esc(invitation.contributorName)}</b><span>${esc(invitation.emailMasked)} · expires ${esc(formatDate(invitation.expiresAt))}</span></div>
        ${b1513rInviteStatusChip(invitation)}
        <span class="inlineActions">${['sent', 'opened'].includes(invitation.status) ? `<button class="rowBtn" type="button" data-b1513r-invite-resend="${attr(invitation.id)}">Resend</button>` : ''}
        ${invitation.status !== 'revoked' ? `<button class="rowBtn danger" type="button" data-b1513r-invite-revoke="${attr(invitation.id)}">Revoke</button>` : ''}</span>
      </div>`).join('') : '<div class="setRow"><div class="sTxt"><b>No active invitations</b><span>Request-a-Story invitations you send appear here with status, resend, and revoke.</span></div><button class="rowBtn" type="button" data-nav="requests">Open Request a Story</button></div>'}
    </div></div>
    <div class="b1513rSettingsGroup" role="heading" aria-level="2">Identity</div>
    <div class="panel panel-spaced"><div class="pBody pbody-top">${b1513rOwnAvatarRow()}</div></div>
    <div class="b1513rSettingsGroup" role="heading" aria-level="2">Account</div>`;
}

/* ---------------- R-layer delegated events ---------------- */

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    /* library rows */
    if (button.matches('[data-b1513r-row-more]')) {
      const id = button.dataset.b1513rRowMore;
      b1513rState().rowOpen[id] = !b1513rState().rowOpen[id];
      if (typeof renderLibraryRowsOnly === 'function' && state.route === 'library') renderLibraryRowsOnly();
      else if (state.route === 'student' && canAdminReview()) b1513rRenderStudentWorkspace();
      else renderRoute();
      return;
    }
    /* time-me */
    if (button.matches('[data-b1513r-time-start]')) {
      const timer = { key: 'thirty_second', seconds: 0, timer: 0 };
      b1513rState().timeMe = timer;
      renderStoryRoom();
      timer.timer = window.setInterval(() => {
        timer.seconds += 1;
        const clock = $('[data-b1513r-time-clock]');
        if (clock) clock.textContent = `${Math.floor(timer.seconds / 60)}:${String(timer.seconds % 60).padStart(2, '0')}`;
      }, 1000);
      return;
    }
    if (button.matches('[data-b1513r-time-stop]')) {
      const timer = b1513rState().timeMe;
      if (timer) {
        window.clearInterval(timer.timer);
        notify(timer.seconds <= 36 ? `⏱ ${timer.seconds}s — beautifully inside thirty seconds at your pace.` : `⏱ ${timer.seconds}s — a little long; trim what you can spare.`, '✓');
      }
      b1513rState().timeMe = null;
      renderStoryRoom();
      return;
    }
    /* full-story voice add (universal mic on Full Story) */
    if (button.matches('[data-b1513r-full-voice]')) {
      const box = $('#storyEditText');
      if (box) b1513rSimulatedDictation(box, ['Let me add what I remember next. ', 'There is one more detail that matters here. ', 'And that is the part I always forget to tell. ']);
      return;
    }
    /* inspiration modes + browse */
    if (button.matches('[data-b1513r-insp-mode]')) {
      b1513rState().browse.mode = button.dataset.b1513rInspMode;
      if (b1513rState().browse.mode === 'browse' && !b1513rState().browse.loaded) await b1513rLoadBrowse();
      return renderInspiration();
    }
    if (button.matches('[data-b1513r-browse-filter]')) {
      const browse = b1513rState().browse;
      browse[button.dataset.b1513rBrowseFilter] = button.dataset.b1513rFilterValue;
      await b1513rLoadBrowse();
      return renderInspiration();
    }
    if (button.matches('[data-b1513r-browse-fav]')) {
      const browse = b1513rState().browse;
      browse.fav = !browse.fav;
      await b1513rLoadBrowse();
      return renderInspiration();
    }
    if (button.matches('[data-b1513r-fav]')) {
      await b1513rApi.favorite(button.dataset.b1513rFav);
      await b1513rLoadBrowse();
      return renderInspiration();
    }
    if (button.matches('[data-b1513r-answer-now]')) {
      const browse = b1513rState().browse;
      browse.openPromptId = button.dataset.b1513rAnswerNow;
      browse.answer = '';
      browse.changeNote = '';
      const prompt = browse.prompts.find((item) => item.id === browse.openPromptId);
      b1513State().inspiration.prompt = prompt || null;
      b1513State().inspiration.answer = '';
      renderInspiration();
      window.requestAnimationFrame(() => $('#b1513rBrowseAnswer')?.focus());
      return;
    }
    if (button.matches('[data-b1513r-close-prompt]')) {
      b1513rState().browse.openPromptId = '';
      b1513rState().browse.voice = null;
      return renderInspiration();
    }
    if (button.matches('[data-b1513r-save-later-id]')) {
      const prompt = b1513rState().browse.prompts.find((item) => item.id === button.dataset.b1513rSaveLaterId);
      if (!prompt) return;
      const payload = await b1513Api.inspirationSaveLater({ promptId: prompt.id, promptText: prompt.text, draft: '' }).catch(() => null);
      if (payload) b1513State().inspiration.saved = asArray(payload.saved);
      return notify('Saved for later — find it under Saved & unfinished.', '✓');
    }
    if (button.matches('[data-b1513r-browse-voice]')) {
      const browse = b1513rState().browse;
      browse.voice = { seconds: 0, timer: 0, sentenceIndex: 0 };
      renderInspiration();
      browse.voice.timer = window.setInterval(() => {
        const recorder = b1513rState().browse.voice;
        if (!recorder) return;
        recorder.seconds += 1;
        const clock = $('[data-b1513-rec-clock]');
        if (clock) clock.textContent = `${Math.floor(recorder.seconds / 60)}:${String(recorder.seconds % 60).padStart(2, '0')}`;
        if (recorder.seconds % 3 === 0) {
          const box = $('#b1513rBrowseAnswer');
          const sentences = ['I remember exactly where I was standing. ', 'It was smaller than it sounds, but it stayed with me. ', 'Looking back, that moment changed how I approach people. '];
          if (box) { box.value += sentences[recorder.sentenceIndex % sentences.length]; b1513rState().browse.answer = box.value; recorder.sentenceIndex += 1; }
        }
      }, 1000);
      setMotionEnergy('recording');
      return;
    }
    if (button.matches('[data-b1513r-browse-rec-done]') || button.matches('[data-b1513r-browse-rec-cancel]')) {
      const browse = b1513rState().browse;
      if (browse.voice?.timer) window.clearInterval(browse.voice.timer);
      if (button.matches('[data-b1513r-browse-rec-cancel]')) { browse.answer = ''; }
      browse.voice = null;
      setMotionEnergy('low');
      return renderInspiration();
    }
    if (button.matches('[data-b1513r-browse-add]')) {
      const browse = b1513rState().browse;
      const insp = b1513State().inspiration;
      insp.answer = browse.answer;
      insp.changeNote = browse.changeNote;
      insp.prompt = browse.prompts.find((item) => item.id === browse.openPromptId) || insp.prompt;
      await b1513AddToLibrary();
      browse.openPromptId = '';
      browse.answer = '';
      browse.changeNote = '';
      return;
    }
    if (button.matches('[data-b1513r-guide-subject]')) return void b1513rGuideSubject(button.dataset.b1513rGuideSubject);

    /* requests */
    if (button.matches('[data-b1513r-new-invite]')) { b1513rState().requests.view = 'new'; return renderRequests(); }
    if (button.matches('[data-b1513r-req-back]')) { b1513rState().requests.view = 'home'; return renderRequests(); }
    if (button.matches('[data-b1513r-rel]')) {
      b1513rState().requests.draft.relationship = button.dataset.b1513rRel;
      const form = $('#b1513rInviteForm');
      if (form) { b1513rState().requests.draft.contributorName = $('#b1513rInvName', form)?.value || ''; b1513rState().requests.draft.email = $('#b1513rInvEmail', form)?.value || ''; b1513rState().requests.draft.personalMessage = $('#b1513rInvMsg', form)?.value || ''; }
      return b1513rRenderNewInvite();
    }
    if (button.matches('[data-b1513r-rel-more]')) {
      const form = $('#b1513rInviteForm');
      if (form) { b1513rState().requests.draft.contributorName = $('#b1513rInvName', form)?.value || ''; b1513rState().requests.draft.email = $('#b1513rInvEmail', form)?.value || ''; b1513rState().requests.draft.personalMessage = $('#b1513rInvMsg', form)?.value || ''; }
      b1513rState().requests.relMore = true;
      return b1513rRenderNewInvite();
    }
    if (button.matches('[data-b1513r-video-demo]')) {
      return notify('🎬 After sending, you can record a short private greeting from the invitation row. (Media stays force-off in production until its own gates clear.)');
    }
    if (button.matches('[data-b1513r-invite-preview]')) {
      const payload = await b1513rApi.emailPreview(button.dataset.b1513rInvitePreview);
      b1513rState().requests.emailPreview = payload?.preview || null;
      return renderRequests();
    }
    if (button.matches('[data-b1513r-preview-close]')) { b1513rState().requests.emailPreview = null; return renderRequests(); }
    if (button.matches('[data-b1513r-invite-send]')) {
      await b1513rApi.inviteOp(button.dataset.b1513rInviteSend, 'send');
      await b1513rLoadRequests();
      notify('Invitation sent (simulated delivery). You’ll see when it’s opened.', '✓');
      return renderRequests();
    }
    if (button.matches('[data-b1513r-invite-resend]')) {
      await b1513rApi.inviteOp(button.dataset.b1513rInviteResend, 'resend');
      await b1513rLoadRequests();
      notify('Gentle reminder sent. StoryForge keeps reminders restrained — this counts toward the limit.', '✓');
      if (state.route === 'settings') return renderSettings();
      return renderRequests();
    }
    if (button.matches('[data-b1513r-invite-revoke]')) {
      if (!window.confirm('Revoke this invitation? Their link stops working immediately.')) return;
      await b1513rApi.inviteOp(button.dataset.b1513rInviteRevoke, 'revoke');
      await b1513rLoadRequests();
      notify('Invitation revoked and logged.', '✓');
      if (state.route === 'settings') return renderSettings();
      return renderRequests();
    }
    if (button.matches('[data-b1513r-cand-fav]')) {
      const contribution = b1513rState().requests.contributions.find((item) => item.id === button.dataset.b1513rCandFav);
      await b1513rApi.contributionState(contribution.id, contribution.state === 'favorite' ? 'new' : 'favorite');
      await b1513rLoadRequests();
      return renderRequests();
    }
    if (button.matches('[data-b1513r-cand-archive]')) {
      await b1513rApi.contributionState(button.dataset.b1513rCandArchive, 'archived');
      await b1513rLoadRequests();
      notify('Dismissed. It stays in your archive — nothing a contributor gave you is deleted.');
      return renderRequests();
    }
    if (button.matches('[data-b1513r-cand-promote]')) {
      const payload = await withBusy(() => b1513rApi.promoteContribution(button.dataset.b1513rCandPromote, {}));
      await b1513rLoadRequests();
      await loadStories().catch(() => []);
      notify(`Promoted to your Library as “The One Where ${payload?.story?.title || ''}” — starts Private, as promised to your contributor. Provenance kept.`, '✓');
      return renderRequests();
    }

    /* guest preview */
    if (button.matches('[data-b1513r-guest-preview]')) return void b1513rOpenGuest(button.dataset.b1513rGuestPreview);
    if (button.matches('[data-b1513r-guest-close]')) return b1513rCloseGuest();
    if (button.matches('[data-b1513r-guest-video]')) return notify('🎬 (Prototype) The private video greeting plays here via a short-lived signed URL — never a public link.');
    if (button.matches('[data-b1513r-guest-start]')) {
      const guest = b1513rState().guest;
      guest.mode = button.dataset.b1513rGuestStart;
      guest.text = '';
      return b1513rRenderGuest();
    }
    if (button.matches('[data-b1513r-guest-back]')) {
      const guest = b1513rState().guest;
      if (guest.voice?.timer) window.clearInterval(guest.voice.timer);
      guest.voice = null;
      guest.mode = 'landing';
      return b1513rRenderGuest();
    }
    if (button.matches('[data-b1513r-guest-next-q]')) {
      const guest = b1513rState().guest;
      guest.promptIndex += 1;
      guest.text = guest.voice ? guest.text : '';
      return b1513rRenderGuest();
    }
    if (button.matches('[data-b1513r-guest-rec-start]')) {
      const guest = b1513rState().guest;
      guest.voice = { seconds: 0, timer: 0, sentenceIndex: 0 };
      guest.voice.timer = window.setInterval(b1513rGuestRecorderTick, 1000);
      return b1513rRenderGuest();
    }
    if (button.matches('[data-b1513r-guest-rec-done]')) {
      const guest = b1513rState().guest;
      if (guest.voice?.timer) window.clearInterval(guest.voice.timer);
      guest.voice = null;
      return b1513rRenderGuest();
    }
    if (button.matches('[data-b1513r-guest-rec-cancel]')) {
      const guest = b1513rState().guest;
      if (guest.voice?.timer) window.clearInterval(guest.voice.timer);
      guest.voice = null;
      guest.text = '';
      return b1513rRenderGuest();
    }
    if (button.matches('[data-b1513r-guest-send]')) {
      const guest = b1513rState().guest;
      const edited = teaching.querySelector('[data-b1513r-guest-edit]');
      const text = (edited ? edited.value : guest.text).trim();
      if (!text) return;
      const prompt = guest.payload.prompts[guest.promptIndex % guest.payload.prompts.length];
      await b1513rApi.guestContribute(guest.token, { kind: guest.mode === 'voice' ? 'voice' : 'text', transcript: text, durationMs: guest.mode === 'voice' ? 60000 : 0, promptId: prompt.id, promptText: prompt.text });
      guest.sent = true;
      return b1513rRenderGuest();
    }
    if (button.matches('[data-b1513r-guest-another]')) {
      const guest = b1513rState().guest;
      guest.sent = false;
      guest.text = '';
      guest.promptIndex += 1;
      guest.mode = 'landing';
      return b1513rRenderGuest();
    }

    /* admin mirror */
    if (button.matches('[data-b1513r-open-workspace]')) return void b1513rOpenStudentWorkspace(button.dataset.b1513rOpenWorkspace);
    if (button.matches('[data-b1513r-rail-save]')) {
      const story = state.storyDetail;
      if (!story) return;
      b1513rFlashSave(`review:${story.id}`, 'saving');
      const patch = {};
      const feedback = $('#b1513rRailFeedback')?.value.trim();
      const internal = $('#b1513rRailInternal')?.value.trim();
      if (feedback) patch.studentFeedback = feedback;
      if (internal) patch.internalNote = internal;
      await b1513AdminPatch(patch, 'Review saved and audited.');
      b1513rFlashSave(`review:${story.id}`, 'saved');
      return;
    }
    if (button.matches('[data-b1513r-avatar-studio]')) {
      return notify('Opens MissionMed Avatar Studio (separate application). StoryForge only consumes the finished headshot — it never generates avatars.');
    }
  } catch (error) {
    notify(error.message || 'That action could not be completed.');
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id === 'b1513rBrowseSearch') {
    event.preventDefault();
    b1513rState().browse.q = $('#b1513rBrowseQ', form)?.value || '';
    await b1513rLoadBrowse();
    renderInspiration();
    return;
  }
  if (form.id === 'b1513rInviteForm') {
    event.preventDefault();
    const requests = b1513rState().requests;
    requests.draft.contributorName = $('#b1513rInvName', form)?.value || '';
    requests.draft.email = $('#b1513rInvEmail', form)?.value || '';
    requests.draft.personalMessage = $('#b1513rInvMsg', form)?.value || '';
    if (!requests.draft.relationship) { notify('Choose who they are to you first.'); return; }
    await b1513rApi.createInvite(requests.draft);
    await b1513rLoadRequests();
    requests.view = 'home';
    requests.draft = { relationship: '', contributorName: '', email: '', personalMessage: '' };
    requests.relMore = false;
    notify('Invitation created. Preview the email, then send it when it feels right.', '✓');
    renderRequests();
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.matches?.('#b1513rBrowseAnswer')) {
    const browse = b1513rState().browse;
    browse.answer = target.value;
    const hasAnswer = Boolean(target.value.trim());
    const addButton = $('[data-b1513r-browse-add]');
    if (addButton) addButton.disabled = !hasAnswer;
    const followUp = $('[data-b1513-followup]');
    if (followUp) followUp.hidden = !hasAnswer;
    const convert = $('[data-b1513-convert]');
    if (convert) convert.hidden = !hasAnswer;
    return;
  }
  if (target.matches?.('[data-b1513-change]') && state.route === 'inspiration') {
    b1513rState().browse.changeNote = target.value;
    b1513State().inspiration.changeNote = target.value;
    return;
  }
  if (target.matches?.('#b1513rGuestText')) {
    b1513rState().guest.text = target.value;
    const guest = b1513rState().guest;
    const hadReview = Boolean(teaching.querySelector('.b1513rGuestReview'));
    if (Boolean(target.value.trim()) !== hadReview) b1513rRenderGuest();
    return;
  }
  if (target.matches?.('#storyEditText') || target.matches?.('#storyLesson') || target.matches?.('#storyEditTitle')) {
    b1513rFlashSave(`full:${state.storyDetail?.id}`, '');
  }
});

/* save-state triad for the Full Story form (production save path unchanged) */
document.addEventListener('submit', (event) => {
  if (event.target.id === 'storyEditForm' && state.storyDetail) {
    b1513rFlashSave(`full:${state.storyDetail.id}`, 'saving');
    window.setTimeout(() => {
      if (b1513rState().saveFlash.state === 'saving') b1513rFlashSave(`full:${state.storyDetail?.id}`, 'saved');
    }, 900);
  }
}, true);

function b1513rSimulatedDictation(box, sentences) {
  let index = 0;
  notify('🎤 Talk — StoryForge types while you speak. (Prototype simulation of the production recorder.)');
  const timer = window.setInterval(() => {
    box.value += sentences[index % sentences.length];
    box.dispatchEvent(new Event('input', { bubbles: true }));
    index += 1;
    if (index >= 3) window.clearInterval(timer);
  }, 1500);
}

/* version save/restore hooks: reuse B1-513 handlers but flash the triad */
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.matches?.('[data-b1513-version-form]') && state.storyDetail) {
    b1513rFlashSave(`${form.dataset.b1513VersionForm}:${state.storyDetail.id}`, 'saving');
  }
}, true);
