/* ============================================================================
 * B1-513 STAGE 2 EXTENSIONS — appended to the production renderer module.
 * Every function below is ADDITIVE. Small anchored patches in the production
 * code call into these functions at the documented extension seams; nothing
 * else in the production renderer is rewritten. Function declarations hoist,
 * so earlier production code can call them.
 * ========================================================================== */

/* ---------------- shared B1-513 state + API ---------------- */

function b1513State() {
  if (!state.b1513) {
    state.b1513 = {
      session: null,
      consent: null,
      consentDeferredThisSession: false,
      inspiration: {
        loaded: false, dimensions: null, saved: [], activeCount: 0,
        step: 'who', selections: { who: '', whoDetail: '', domain: '', energy: '' },
        whoDetailExpanded: false, prompt: null, seenIds: [], answer: '', changeNote: '',
        answered: false, promotedStoryId: '', sparks: [], voice: null, resume: null,
      },
      directory: { loaded: false, students: [], total: 0, query: '', filter: '', boundaries: null, profile: null, profileTab: 'overview', reviewCheckPreview: null, reviewCheckReceipt: null },
      versionRecorder: null,
      versionHistoryOpen: {},
      adminInspiration: null,
      adminInspirationFilter: '',
    };
  }
  return state.b1513;
}

const b1513Api = {
  consent: () => auth.request('/api/consent'),
  decideConsent: (decision) => auth.request('/api/consent', jsonOptions('POST', { decision })),
  setVisibility: (id, visibility, expectedVersion) => auth.request(`/api/stories/${id}/visibility`, jsonOptions('POST', { visibility, expectedVersion })),
  saveVersion: (id, versionKey, body) => auth.request(`/api/stories/${id}/versions/${versionKey}`, jsonOptions('PATCH', body)),
  restoreVersion: (id, versionKey, revisionId) => auth.request(`/api/stories/${id}/version-restore`, jsonOptions('POST', { versionKey, revisionId })),
  inspiration: () => auth.request('/api/inspiration'),
  inspirationNext: (body) => auth.request('/api/inspiration/next', jsonOptions('POST', body)),
  inspirationSaveLater: (body) => auth.request('/api/inspiration/save-later', jsonOptions('POST', body)),
  inspirationRemoveSaved: (id) => auth.request(`/api/inspiration/save-later/${id}`, { method: 'DELETE' }),
  directory: (query = '') => auth.request(`/api/admin/console/directory${query ? `?${query}` : ''}`),
  directoryStudent: (id) => auth.request(`/api/admin/console/directory/${id}`),
  reviewCheck: (body) => auth.request('/api/admin/console/review-check', jsonOptions('POST', body)),
  adminInspiration: () => auth.request('/api/admin/console/inspiration'),
  adminInspirationSave: (body) => auth.request('/api/admin/console/inspiration/save', jsonOptions('POST', body)),
};

function b1513InitFromSession(session) {
  const b = b1513State();
  b.session = session?.b1513 || null;
  b.consent = session?.b1513?.consent || null;
  return b;
}

function b1513FeatureOn(key) {
  const features = b1513State().session?.features;
  return !features || features[key] !== false;
}

/* ---------------- version registry ---------------- */

const B1513_TAB_TO_KEY = Object.freeze({ working: 'full_story', thirty: 'thirty_second', nnq: 'nnq_setup' });
const B1513_KEY_TO_TAB = Object.freeze({ full_story: 'working', thirty_second: 'thirty', nnq_setup: 'nnq' });

function b1513VersionConfig() {
  const configured = asArray(state.presentation?.b1513?.versions);
  if (configured.length) return configured.filter((v) => v.state !== 'retired').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return [
    { key: 'full_story', label: 'Full Story', state: 'active', helper: presentationSection('workingVersion').helper, target: '' },
    { key: 'thirty_second', label: '30-Second Version', state: 'active', helper: 'A concise interview-ready telling.', target: 'Aim for ~75–90 spoken words (≈30 seconds).' },
    { key: 'nnq_setup', label: 'NNQ Setup Version', state: 'active', helper: 'Shaped for Next Natural Questions.', target: '' },
  ];
}

function b1513VersionMeta(key) {
  return b1513VersionConfig().find((v) => v.key === key) || null;
}

function b1513ActiveVersionTab() {
  const tab = state.storyTab;
  if (['original', 'working', 'thirty', 'nnq'].includes(tab)) {
    if (tab === 'thirty' && !b1513VersionMeta('thirty_second')) return 'working';
    if (tab === 'nnq' && !b1513VersionMeta('nnq_setup')) return 'working';
    return tab;
  }
  return 'original';
}

function b1513ActiveVersionText(story, tab) {
  if (tab === 'original') return story.originalText;
  if (tab === 'working') return story.text;
  const version = story.versions?.[B1513_TAB_TO_KEY[tab]];
  return version?.body || '';
}

function b1513StoryVersionCount(story) {
  let count = 2; // Original telling + Full Story always exist
  if (story.versions?.thirty_second?.body) count += 1;
  if (story.versions?.nnq_setup?.body) count += 1;
  return count;
}

function b1513WordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/* The complete version surface for the Story Room left column.
 * 'original' and 'working' tabs reproduce the production markup unchanged;
 * 'thirty' and 'nnq' are the additive Stage 2 editors. */
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
    ${versionsOn ? `<p class="b1513VersionStrip">One story · ${b1513StoryVersionCount(story)} of 4 tellings. Every version belongs to “${esc(storyTitle(story))}” — the Original telling is preserved untouched.</p>` : ''}`;

  /* ----- original tab (production behavior, unchanged) ----- */
  if (originalTab) {
    return `${tabs}
          <div class="storyProse" data-empty="${text ? 'false' : 'true'}">${text ? esc(text) : '<span class="storyEmpty">No telling has been written yet.</span>'}</div>
          <div class="origNote">🔒 Preserved exactly as first told — your authentic voice, kept safe</div>
          ${presentationSectionVisible('learningLesson') ? `<div class="lessonBlock"><div class="lbl">${esc(presentationSection('learningLesson').title)}</div>
            <div class="lessonTxt">${story.lesson ? esc(story.lesson) : '<span class="storyEmpty">No lesson added yet.</span>'}</div>
          </div>` : ''}`;
  }

  /* ----- working tab = Full Story (production edit form, unchanged) ----- */
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
          <div class="inlineActions"><button class="btnSave" type="submit">Save ${esc(fullLabel.toLowerCase() === 'full story' ? 'Full Story' : fullLabel)}</button><span class="saveState">Durable only after StoryForge confirms the save.</span></div>
        </form>`;
    }
    return `${tabs}
          <div class="storyProse" data-empty="${text ? 'false' : 'true'}">${text ? esc(text) : '<span class="storyEmpty">No telling has been written yet.</span>'}</div>
          <div class="origNote">${esc(story.studentName.split(/\s+/)[0])}’s editable ${esc(fullLabel)} — the original stays untouched</div>
          ${presentationSectionVisible('learningLesson') ? `<div class="lessonBlock"><div class="lbl">${esc(presentationSection('learningLesson').title)}</div>
            <div class="lessonTxt">${story.lesson ? esc(story.lesson) : '<span class="storyEmpty">No lesson added yet.</span>'}</div>
          </div>` : ''}`;
  }

  /* ----- Stage 2 version editors (30-Second / NNQ Setup) ----- */
  const key = B1513_TAB_TO_KEY[tab];
  const meta = b1513VersionMeta(key) || {};
  const version = story.versions?.[key] || null;
  const body = version?.body || '';
  const words = b1513WordCount(body);
  const recorder = b1513State().versionRecorder;
  const recActive = recorder && recorder.storyId === story.id && recorder.versionKey === key;
  const revisions = asArray(version?.revisions);
  const historyOpen = Boolean(b1513State().versionHistoryOpen[`${story.id}:${key}`]);

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
        <div class="b1513VersionGuideText"><b>${esc(meta.label)}</b><span>${esc(meta.helper || '')}</span>${meta.target ? `<span class="b1513VersionTarget">${esc(meta.target)}</span>` : ''}</div>
        ${version ? `<div class="b1513VersionMeta">Started ${esc(formatDate(version.createdAt))} · last saved ${esc(formatDateTime(version.updatedAt))} · ${version.source === 'voice' ? '🎙 voice' : '⌨ typed'}</div>` : '<div class="b1513VersionMeta">Not started yet — type it, or tell it out loud.</div>'}
      </div>
      <form data-b1513-version-form="${attr(key)}" data-story-id="${attr(story.id)}">
        <label class="srOnly" for="b1513VersionText">${esc(meta.label)}</label>
        <textarea class="storyProse storyProseEdit b1513VersionText" id="b1513VersionText" data-b1513-version-input placeholder="${key === 'thirty_second' ? 'Say the heart of this story in about thirty seconds…' : 'Tell it so it ends on a question you want the interviewer to ask…'}">${esc(body)}</textarea>
        <div class="b1513VersionCount" data-b1513-word-count aria-live="polite">${words ? `≈ ${words} words` : ''}${key === 'thirty_second' && words ? ` · ${words <= 95 ? 'inside' : 'over'} the ~30-second target` : ''}</div>
        ${recActive ? b1513VersionRecorderMarkup(recorder) : `<div class="inlineActions b1513VersionActions">
          <button class="btnSave" type="submit">Save ${esc(meta.label)}</button>
          ${state.capabilities?.voiceCapture ? `<button class="rowBtn" type="button" data-b1513-version-voice="append">🎙 Append with voice</button>
          <button class="rowBtn" type="button" data-b1513-version-voice="retell">🎙 Retell with voice</button>` : ''}
          ${body ? '<button class="rowBtn" type="button" data-b1513-version-retell-typed>Start a fresh retelling</button>' : ''}
          <span class="saveState" data-b1513-version-save-state>Durable only after StoryForge confirms the save.</span>
        </div>`}
      </form>
      <div class="origNote">Append adds to what’s here. Retell starts fresh — your previous telling is kept in this version’s history and can be restored.</div>
      ${revisions.length ? `<div class="b1513VersionHistory">
        <button class="reflAdd" type="button" data-b1513-version-history="${attr(key)}">${historyOpen ? 'Hide' : 'Show'} earlier tellings of this version (${revisions.length})</button>
        ${historyOpen ? revisions.map((rev) => `<div class="b1513Revision">
          <div class="b1513RevisionMeta"><span>${esc(formatDateTime(rev.savedAt))}</span><span>${rev.source === 'voice' ? '🎙 voice' : '⌨ typed'}</span>
            <button class="rowBtn" type="button" data-b1513-restore-revision="${attr(rev.id)}" data-version-key="${attr(key)}">Restore this telling</button></div>
          <div class="b1513RevisionBody">${esc(rev.body.length > 400 ? `${rev.body.slice(0, 400)}…` : rev.body)}</div>
        </div>`).join('') : ''}
      </div>` : ''}`;
}

function b1513VersionRecorderMarkup(recorder) {
  return `<div class="voxDock rec b1513VersionDock" data-b1513-version-dock>
    <div class="voxRow">
      <span class="voxTimer"><span class="rdot" aria-hidden="true"></span><span data-b1513-rec-clock>0:0${Math.min(9, recorder.seconds)}</span></span>
      <span class="voxWave" aria-hidden="true">${Array.from({ length: 13 }, () => '<i></i>').join('')}</span>
      <button class="voxBtn done" type="button" data-b1513-version-rec-done>Done</button>
      <button class="voxGhost" type="button" data-b1513-version-rec-cancel>Discard</button>
    </div>
    <div class="voxState" role="status" aria-live="polite">${recorder.mode === 'append' ? 'Appending to this version' : 'Retelling this version'} — StoryForge types while you talk. Your earlier telling ${recorder.mode === 'append' ? 'stays' : 'is kept in history'}.</div>
  </div>`;
}

/* ---------------- visibility (Mentor Visible / Private) ---------------- */

function b1513VisibilityChip(story) {
  if (!b1513FeatureOn('visibility') || !story || story.visibility === undefined) return '';
  return story.visibility === 'private'
    ? '<span class="stChip b1513VisPrivate" title="Private — visible only to you. Not listed for or openable by any mentor.">🔒 Private · only you</span>'
    : '<span class="stChip b1513VisMentor" title="Your mentor can see this story for guidance. Submitting is still a separate action.">👁 Mentor visible</span>';
}

function b1513VisibilityCard(story, mentor) {
  if (!b1513FeatureOn('visibility') || !story || story.visibility === undefined) return '';
  const isPrivate = story.visibility === 'private';
  const submitted = !['private'].includes(story.status);
  if (mentor) {
    return `<div class="railCard b1513VisibilityCard"><div class="rLbl">Visibility</div>
      <div>${b1513VisibilityChip(story)}</div>
      <div class="stageHint">${isPrivate ? 'This story is private to the student.' : 'The student made this story mentor-visible for guidance.'}</div></div>`;
  }
  return `<div class="railCard b1513VisibilityCard"><div class="rLbl">Visibility</div>
    <div>${b1513VisibilityChip(story)}</div>
    <div class="statusRow b1513VisibilityRow" role="group" aria-label="Story visibility">
      <button type="button" data-b1513-set-visibility="mentor_visible" class="${!isPrivate ? 'on b1513VisMentor' : ''}" aria-pressed="${!isPrivate}">Mentor Visible</button>
      <button type="button" data-b1513-set-visibility="private" class="${isPrivate ? 'on b1513VisPrivate' : ''}" aria-pressed="${isPrivate}" ${submitted ? 'disabled title="Submitted stories stay visible to your reviewer. Use Return to Private to withdraw first."' : ''}>Private — visible only to me</button>
    </div>
    <div class="stageHint">${isPrivate
      ? 'Only you can open this story. It is never listed for your mentor and is not reviewed.'
      : 'Your mentor can see this story to guide you. “Submit for review” below is still a separate, explicit ask.'}${submitted && !isPrivate ? ' While submitted, use “Return to Private” to withdraw reviewer access first.' : ''}</div>
    <div class="stageHint b1513VisAudit">Visibility changes are logged to this story’s history.</div>
  </div>`;
}

function b1513RowBadges(story) {
  if (story.visibility === undefined) return '';
  const versions = b1513StoryVersionCount(story);
  return `${story.visibility === 'private' ? '<span class="stChip b1513VisPrivate" title="Private — visible only to you">🔒</span>' : ''}${b1513FeatureOn('versions') && versions > 2 ? `<span class="scoreTag b1513VersionTag" title="This story has ${versions} of 4 tellings">${versions} tellings</span>` : ''}${story.origin?.type === 'inspiration' ? '<span class="b1513SparkTag" title="Born in Inspiration">✧</span>' : ''}`;
}

async function b1513SetVisibility(visibility) {
  const story = state.storyDetail;
  if (!story) return;
  try {
    const result = await withBusy(() => b1513Api.setVisibility(story.id, visibility, story.rowVersion));
    state.storyDetail = unwrapStory(result);
    replaceStoryInState(state.storyDetail);
    renderStoryRoom();
    notify(visibility === 'private' ? 'This story is now Private — visible only to you. Logged.' : 'This story is now Mentor Visible. Logged.', '✓');
  } catch (error) {
    notify(error.message || 'Visibility could not be changed.');
  }
}

/* ---------------- first-use mentorship disclosure (consent) ---------------- */

function b1513ConsentNode() {
  let node = document.getElementById('b1513Consent');
  if (!node) {
    node = document.createElement('div');
    node.id = 'b1513Consent';
    document.body.appendChild(node);
  }
  return node;
}

async function b1513MaybeShowConsent() {
  const b = b1513State();
  if (!isStudent() || !b1513FeatureOn('visibility')) return;
  if (b.consent?.accepted || b.consentDeferredThisSession) return;
  await b1513ShowConsent({ review: false });
}

async function b1513ShowConsent({ review = false } = {}) {
  const payload = await b1513Api.consent().catch(() => null);
  const policy = payload?.policy;
  if (!policy) return;
  const b = b1513State();
  b.consent = payload.consent || b.consent;
  const accepted = Boolean(b.consent?.accepted);
  const node = b1513ConsentNode();
  node.className = 'b1513ConsentOpen';
  node.innerHTML = `<div class="b1513ConsentScrim"></div>
  <div class="b1513ConsentSheet" role="dialog" aria-modal="true" aria-labelledby="b1513ConsentTitle">
    <div class="eyebrow">MissionMed mentorship · one-time choice</div>
    <h1 class="h1" id="b1513ConsentTitle">${esc(policy.title)}</h1>
    ${policy.body.map((paragraph) => `<p class="b1513ConsentPara">${esc(paragraph)}</p>`).join('')}
    <div class="b1513ConsentFacts">${policy.facts.map((fact) => `<div class="b1513ConsentFact"><span aria-hidden="true">✓</span>${esc(fact)}</div>`).join('')}</div>
    <p class="stageHint">Policy version ${esc(policy.version)} · updated ${esc(policy.updated)} · you can re-read this any time in Settings → Mentorship &amp; privacy.</p>
    ${accepted || review ? `<div class="inlineActions"><button class="rowBtn pri" type="button" data-b1513-consent-close>Close</button>
      ${accepted ? `<span class="stageHint">You agreed on ${esc(formatDateTime(b.consent.acceptedAt))} · receipt ${esc(b.consent.auditId || '')}</span>` : ''}</div>`
    : `<label class="b1513ConsentCheck"><input type="checkbox" data-b1513-consent-check> I understand: new stories will be mentor-visible, and I can make any story Private at any time.</label>
    <div class="inlineActions">
      <button class="noteSend" type="button" data-b1513-consent-accept disabled>Agree and continue</button>
      <button class="rowBtn" type="button" data-b1513-consent-defer>Not now — keep everything private</button>
    </div>
    <p class="stageHint">“Not now” changes nothing: all of your work stays private until you choose otherwise, and you can agree later from Settings.</p>`}
  </div>`;
  const heading = node.querySelector('#b1513ConsentTitle');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}

function b1513CloseConsent() {
  const node = document.getElementById('b1513Consent');
  if (node) { node.className = ''; node.innerHTML = ''; }
}

async function b1513DecideConsent(decision) {
  const b = b1513State();
  try {
    const result = await withBusy(() => b1513Api.decideConsent(decision));
    b.consent = result.consent;
    if (decision === 'accept') {
      notify(`Thank you. Mentorship visibility is on — receipt ${result.receipt?.auditId || 'recorded'}.`, '✓');
    } else {
      b.consentDeferredThisSession = true;
      notify('No change made — everything stays private. You can agree later in Settings.');
    }
    b1513CloseConsent();
    await renderRoute();
  } catch (error) {
    notify(error.message || 'Your choice could not be recorded.');
  }
}

function b1513PrivacySettingsPanel() {
  if (!isStudent() || !b1513FeatureOn('visibility')) return '';
  const consent = b1513State().consent;
  const accepted = Boolean(consent?.accepted);
  return `<div class="panel panel-spaced b1513PrivacyPanel">
    <div class="pHead"><div class="h2">Mentorship &amp; <em>privacy</em></div></div>
    <div class="pBody">
      <div class="setRow"><div class="sTxt"><b>Mentorship visibility</b><span>${accepted
        ? `You agreed on ${esc(formatDateTime(consent.acceptedAt))} (policy ${esc(consent.policyVersion || '')}). New stories start Mentor Visible; any story can be made Private — visible only to me.`
        : 'You haven’t agreed yet. All of your stories are private, and mentor review happens only when you submit a story.'}</span></div>
        <span class="rolePill ${accepted ? '' : 'roleReadOnly'}">${accepted ? 'Agreed' : 'Not agreed'}</span></div>
      <div class="setRow"><div class="sTxt"><b>Policy</b><span>Re-read the plain-language mentorship visibility policy at any time.</span></div>
        <button class="rowBtn" type="button" data-b1513-review-policy>${accepted ? 'Review policy' : 'Read & decide'}</button></div>
      <div class="setRow"><div class="sTxt"><b>Per-story control</b><span>Each story’s Visibility card switches between Mentor Visible and Private — visible only to me. Changes are logged to that story’s history.</span></div></div>
    </div>
  </div>`;
}

/* ---------------- Home entry point for Inspiration ---------------- */

function b1513HomeInspirationLink() {
  if (!isStudent() || !b1513FeatureOn('inspiration')) return '';
  return `<button class="rowBtn b1513HomeInspiration" type="button" data-nav="inspiration">✧ Can’t think of a story? Open <b>Inspiration</b> ▸</button>`;
}

/* ---------------- Inspiration ---------------- */

async function b1513LoadInspiration() {
  const insp = b1513State().inspiration;
  const payload = await b1513Api.inspiration();
  insp.loaded = true;
  insp.dimensions = payload?.dimensions || null;
  insp.saved = asArray(payload?.saved);
  insp.activeCount = Number(payload?.activePromptCount || 0);
  insp.resume = payload?.session || null;
}

function b1513WizardChoice(step, entry, selected) {
  return `<button class="b1513Choice ${selected ? 'on' : ''}" type="button" data-b1513-wizard-pick="${attr(step)}" data-b1513-wizard-value="${attr(entry.id)}" aria-pressed="${selected}">
    <span class="b1513ChoiceLabel">${esc(entry.label)}</span>${entry.hint ? `<span class="b1513ChoiceHint">${esc(entry.hint)}</span>` : ''}
  </button>`;
}

function b1513WizardStepMarkup() {
  const insp = b1513State().inspiration;
  const dims = insp.dimensions;
  if (!dims) return '<div class="stageHint">Inspiration content is not available.</div>';
  const sel = insp.selections;
  const stepIndex = { who: 1, whoDetail: 2, domain: insp.step === 'whoDetail' ? 2 : (sel.who === 'you' ? 2 : 3), energy: sel.who === 'you' ? 3 : 4, question: sel.who === 'you' ? 4 : 5 }[insp.step] || 1;
  const totalSteps = sel.who === 'you' ? 4 : 5;
  const back = insp.step !== 'who' ? '<button class="backBtn" type="button" data-b1513-wizard-back>‹ Back</button>' : '';
  const progress = `<div class="eyebrow">A guided conversation · step ${stepIndex} of ${totalSteps}</div>`;

  if (insp.step === 'who') {
    return `${progress}<h2 class="h2 b1513WizardQ">Who is at the center of the story we’re looking for?</h2>
      <p class="stageHint">Good interview stories aren’t only about you. Some of your best material is about the people around you.</p>
      <div class="b1513Choices">${dims.who.map((entry) => b1513WizardChoice('who', entry, sel.who === entry.id)).join('')}</div>`;
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
  if (insp.step === 'domain') {
    return `${back}${progress}<h2 class="h2 b1513WizardQ">Where does this story live?</h2>
      <div class="b1513Choices">${dims.domain.map((entry) => b1513WizardChoice('domain', entry, sel.domain === entry.id)).join('')}</div>`;
  }
  if (insp.step === 'energy') {
    return `${back}${progress}<h2 class="h2 b1513WizardQ">What kind of story are you in the mood to find?</h2>
      <p class="stageHint">Light stories are real interview material too — they’re often where your personality lives.</p>
      <div class="b1513Choices">${dims.energy.map((entry) => b1513WizardChoice('energy', entry, sel.energy === entry.id)).join('')}</div>`;
  }
  /* question step */
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
        <div class="voxState" role="status" aria-live="polite">StoryForge types while you talk — edit anything after.</div></div>` : ''}
      <div class="b1513ConvertRow" data-b1513-convert ${insp.answer.trim() ? '' : 'hidden'}>
        ${prompt.interviewUse ? `<p class="b1513WhyWorks">💡 <b>Why this works in an interview:</b> ${esc(prompt.interviewUse)}</p>` : ''}
        <label class="fLbl" for="b1513Change">What did it change? <span>— optional, one honest sentence. It becomes this story’s Learning Lesson.</span></label>
        <input id="b1513Change" data-b1513-change placeholder="What this moment changed about you, or taught you…" maxlength="240" value="${attr(insp.changeNote || '')}">
      </div>
      <div class="inlineActions b1513AnswerActions">
        ${!recorder && state.capabilities?.voiceCapture ? '<button class="rowBtn" type="button" data-b1513-insp-voice>🎙 Talk instead</button>' : ''}
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

function renderInspiration() {
  const insp = b1513State().inspiration;
  const sparks = insp.sparks;
  main.innerHTML = `<section data-view="inspiration" class="live b1513Inspiration">
    <div class="eyebrow">Inspiration</div>
    <h1 class="h1">Find the stories you <em>forgot you had</em>.</h1>
    <p class="greetSub b1513InspirationLead">Interviews aren’t won with rehearsed “leadership stories.” They’re won with real, specific memories — a meal, a bus ride, a person who surprised you. A few gentle questions will take you there.</p>
    <div class="homeGrid b1513InspirationGrid">
      <div class="panel b1513WizardPanel"><div class="pBody" data-b1513-wizard>
        ${b1513WizardStepMarkup()}
      </div></div>
      <div>
        ${sparks.length ? `<div class="panel panel-gap"><div class="pHead"><div class="h2">Sparked <em>this visit</em></div></div><div class="pBody">
          ${sparks.map((spark) => `<div class="shortItem b1513SparkItem"><span class="si">✧ ${esc(spark.text)}</span><span class="sd">Saved for later</span></div>`).join('')}
        </div></div>` : ''}
        <div class="panel panel-gap"><div class="pHead"><div class="h2">Saved for <em>later</em></div></div><div class="pBody">
          ${insp.saved.length ? insp.saved.map((item) => `<div class="shortItem b1513SavedItem">
            <span class="si">${esc(item.promptText)}</span><span class="sd">Saved ${esc(ago(item.savedAt))}${item.draft ? ' · has a draft' : ''}</span>
            <span class="inlineActions"><button class="rowBtn pri" type="button" data-b1513-resume-saved="${attr(item.id)}">Answer now</button>
            <button class="rowBtn" type="button" data-b1513-remove-saved="${attr(item.id)}">Remove</button></span>
          </div>`).join('') : '<div class="stageHint">Questions you save land here, ready for the moment you have two minutes.</div>'}
        </div></div>
        <div class="panel"><div class="pHead"><div class="h2">How this <em>works</em></div></div><div class="pBody">
          <p class="stageHint">One question at a time, built from research on how memory actually works. Answers become ordinary StoryForge stories in <b>your Library</b> — same privacy, same review flow, no separate pile. ${insp.activeCount} questions are active.</p>
        </div></div>
      </div>
    </div>
  </section>`;
}

async function b1513WizardPick(step, value) {
  const insp = b1513State().inspiration;
  insp.selections[step] = value;
  insp.whoDetailExpanded = false;
  if (step === 'who') {
    insp.step = value === 'you' ? 'domain' : 'whoDetail';
    insp.selections.whoDetail = '';
  } else if (step === 'whoDetail') insp.step = 'domain';
  else if (step === 'domain') insp.step = 'energy';
  else if (step === 'energy') {
    insp.step = 'question';
    // Preserve an in-progress answer: only fetch a fresh prompt when there is no
    // draft to protect (verifier finding P2-6 — Back must never destroy typed work).
    if (!insp.prompt || !insp.answer.trim()) await b1513NextPrompt();
  }
  b1513RerenderWizard();
}

async function b1513NextPrompt() {
  const insp = b1513State().inspiration;
  const sel = insp.selections;
  const payload = await b1513Api.inspirationNext({ who: sel.who, whoDetail: sel.whoDetail, domain: sel.domain, energy: sel.energy, excludeIds: insp.seenIds });
  insp.prompt = payload?.prompt || null;
  if (insp.prompt) insp.seenIds.push(insp.prompt.id);
  insp.answer = '';
  insp.changeNote = '';
  insp.voice = null;
}

function b1513RerenderWizard() {
  const host = $('[data-b1513-wizard]');
  if (host) host.innerHTML = b1513WizardStepMarkup();
  else if (state.route === 'inspiration') renderInspiration();
}

function b1513WizardBack() {
  const insp = b1513State().inspiration;
  const order = insp.selections.who === 'you' ? ['who', 'domain', 'energy', 'question'] : ['who', 'whoDetail', 'domain', 'energy', 'question'];
  const index = order.indexOf(insp.step);
  if (index > 0) insp.step = order[index - 1];
  if (insp.step !== 'question') { b1513StopInspRecorder(false); }
  b1513RerenderWizard();
}

async function b1513AddToLibrary() {
  const insp = b1513State().inspiration;
  if (!insp.prompt || !insp.answer.trim()) return;
  const titleSeed = insp.answer.trim().split(/\s+/).slice(0, 6).join(' ');
  try {
    const result = await withBusy(() => auth.request('/api/stories', jsonOptions('POST', {
      title: titleSeed.length > 3 ? titleSeed : 'A story from Inspiration',
      text: insp.answer.trim(),
      lesson: insp.changeNote.trim(),
      origin: { type: 'inspiration', promptId: insp.prompt.id, promptText: insp.prompt.text },
    })));
    const story = unwrapStory(result);
    insp.promotedStoryId = story.id;
    notify('Added to your Story Library — same story, same privacy, ready to grow.', '✓');
    await loadStories().catch(() => []);
    const host = $('[data-b1513-wizard]');
    if (host) {
      host.innerHTML = `<div class="eyebrow">Saved to your Library</div>
        <h2 class="h2 b1513WizardQ">“The One Where ${esc(story.title)}” is now a StoryForge story.</h2>
        <p class="stageHint">It starts as ${story.visibility === 'private' ? 'a Private story — visible only to you' : 'a Mentor Visible story your mentor can guide'}. ${story.lesson ? 'Your one-sentence takeaway is already saved as its Learning Lesson.' : 'Open it to keep telling, add the Learning Lesson, or record it out loud.'}</p>
        <div class="inlineActions">
          <button class="noteSend" type="button" data-open-story="${attr(story.id)}">Open the story</button>
          <button class="rowBtn" type="button" data-b1513-another>Keep exploring — another question</button>
        </div>`;
    }
  } catch (error) {
    notify(error.message || 'The story could not be added.');
  }
}

async function b1513SaveForLater() {
  const insp = b1513State().inspiration;
  if (!insp.prompt) return;
  const payload = await b1513Api.inspirationSaveLater({ promptId: insp.prompt.id, promptText: insp.prompt.text, draft: insp.answer.trim() }).catch(() => null);
  if (payload) insp.saved = asArray(payload.saved);
  notify('Saved for later — it will be waiting on the Inspiration page.', '✓');
  await b1513NextPrompt();
  if (state.route === 'inspiration') renderInspiration();
}

function b1513Sparked() {
  const insp = b1513State().inspiration;
  const sparkText = window.prompt('What story did this spark? One line is enough — StoryForge will keep it.');
  if (!sparkText || !sparkText.trim()) return;
  insp.sparks.unshift({ text: sparkText.trim(), at: new Date().toISOString() });
  void b1513Api.inspirationSaveLater({ promptId: insp.prompt?.id || '', promptText: `✧ Sparked: ${sparkText.trim()}`, draft: '' })
    .then((payload) => { if (payload) insp.saved = asArray(payload.saved); })
    .catch(() => {});
  notify('Spark saved. Finish this question, or chase the new one — your call.', '✧');
  if (state.route === 'inspiration') renderInspiration();
}

/* inspiration voice simulation (prototype: production reuses the existing recorder pipeline) */
function b1513StartInspRecorder() {
  const insp = b1513State().inspiration;
  if (insp.voice) return;
  insp.voice = { seconds: 0, timer: 0, sentenceIndex: 0 };
  b1513RerenderWizard();
  insp.voice.timer = window.setInterval(() => {
    const recorder = b1513State().inspiration.voice;
    if (!recorder) return;
    recorder.seconds += 1;
    const clock = $('[data-b1513-rec-clock]');
    if (clock) clock.textContent = `${Math.floor(recorder.seconds / 60)}:${String(recorder.seconds % 60).padStart(2, '0')}`;
    if (recorder.seconds % 3 === 0) {
      const sentences = [
        'I remember exactly where I was standing when this happened. ',
        'It was smaller than it sounds, but it stayed with me. ',
        'What surprised me most was how everyone else reacted. ',
        'Looking back, that moment changed how I approach people. ',
      ];
      const box = $('[data-b1513-answer]');
      if (box) {
        box.value += sentences[recorder.sentenceIndex % sentences.length];
        b1513State().inspiration.answer = box.value;
        recorder.sentenceIndex += 1;
      }
    }
  }, 1000);
  setMotionEnergy('recording');
}

function b1513StopInspRecorder(rerender = true) {
  const insp = b1513State().inspiration;
  if (insp.voice?.timer) window.clearInterval(insp.voice.timer);
  insp.voice = null;
  setMotionEnergy('low');
  if (rerender) b1513RerenderWizard();
}

/* ---------------- version voice recorder (prototype simulation) ---------------- */

function b1513StartVersionRecorder(storyId, versionKey, mode) {
  const b = b1513State();
  if (b.versionRecorder) return;
  b.versionRecorder = { storyId, versionKey, mode, seconds: 0, timer: 0, sentenceIndex: 0, captured: '' };
  renderStoryRoom();
  b.versionRecorder.timer = window.setInterval(() => {
    const recorder = b1513State().versionRecorder;
    if (!recorder) return;
    recorder.seconds += 1;
    const clock = $('[data-b1513-rec-clock]');
    if (clock) clock.textContent = `${Math.floor(recorder.seconds / 60)}:${String(recorder.seconds % 60).padStart(2, '0')}`;
    if (recorder.seconds % 3 === 0) {
      const sentences = recorder.versionKey === 'thirty_second'
        ? ['Here is the short version of what happened. ', 'The one detail that matters is the person who taught me. ', 'And that is why this story stays with me. ']
        : ['Let me tell this so it opens a door. ', 'The part I want you to ask about is what happened next. ', 'That question is exactly the one I hope an interviewer asks. '];
      const box = $('[data-b1513-version-input]');
      if (box) {
        box.value += sentences[recorder.sentenceIndex % sentences.length];
        recorder.captured += sentences[recorder.sentenceIndex % sentences.length];
        recorder.sentenceIndex += 1;
        const counter = $('[data-b1513-word-count]');
        if (counter) counter.textContent = `≈ ${b1513WordCount(box.value)} words`;
      }
    }
  }, 1000);
  setMotionEnergy('recording');
}

async function b1513FinishVersionRecorder(save) {
  const b = b1513State();
  const recorder = b.versionRecorder;
  if (!recorder) return;
  window.clearInterval(recorder.timer);
  const story = state.storyDetail;
  const box = $('[data-b1513-version-input]');
  const value = box ? box.value : '';
  b.versionRecorder = null;
  setMotionEnergy('low');
  if (!save || !story) { renderStoryRoom(); return; }
  try {
    const result = await withBusy(() => b1513Api.saveVersion(story.id, recorder.versionKey, {
      body: recorder.mode === 'append' ? value : value,
      mode: recorder.mode === 'append' ? 'save' : 'retell',
      source: 'voice',
    }));
    state.storyDetail = unwrapStory(result);
    replaceStoryInState(state.storyDetail);
    renderStoryRoom();
    notify('Voice telling saved to this version. The original stays untouched.', '✓');
  } catch (error) {
    renderStoryRoom();
    notify(error.message || 'The voice telling could not be saved.');
  }
}

async function b1513SaveVersion(form) {
  const story = state.storyDetail;
  if (!story) return;
  const key = form.dataset.b1513VersionForm;
  const value = $('[data-b1513-version-input]', form)?.value ?? '';
  const saveState = $('[data-b1513-version-save-state]', form);
  if (saveState) saveState.textContent = 'Saving…';
  try {
    const result = await withBusy(() => b1513Api.saveVersion(story.id, key, { body: value, mode: 'save', source: 'typed' }));
    state.storyDetail = unwrapStory(result);
    replaceStoryInState(state.storyDetail);
    renderStoryRoom();
    notify('Version saved. This story now carries it alongside the others.', '✓');
  } catch (error) {
    if (saveState) saveState.textContent = 'Not saved — try again.';
    notify(error.message || 'The version could not be saved.');
  }
}

async function b1513RetellTyped() {
  const story = state.storyDetail;
  const tab = b1513ActiveVersionTab();
  const key = B1513_TAB_TO_KEY[tab];
  if (!story || !key) return;
  if (!window.confirm('Start a fresh retelling? Your current telling of this version is kept in its history and can be restored.')) return;
  try {
    const result = await withBusy(() => b1513Api.saveVersion(story.id, key, { body: '', mode: 'retell', source: 'typed' }));
    state.storyDetail = unwrapStory(result);
    replaceStoryInState(state.storyDetail);
    renderStoryRoom();
    notify('Fresh page — your earlier telling is safe in this version’s history.', '✓');
  } catch (error) {
    notify(error.message || 'The retelling could not be started.');
  }
}

async function b1513RestoreRevision(versionKey, revisionId) {
  const story = state.storyDetail;
  if (!story) return;
  try {
    const result = await withBusy(() => b1513Api.restoreVersion(story.id, versionKey, revisionId));
    state.storyDetail = unwrapStory(result);
    replaceStoryInState(state.storyDetail);
    renderStoryRoom();
    notify('Earlier telling restored. Nothing was lost — the newer telling joined the history.', '✓');
  } catch (error) {
    notify(error.message || 'The telling could not be restored.');
  }
}

/* ---------------- Founder / Admin: student directory ---------------- */

async function b1513LoadAdminDirectory() {
  const dir = b1513State().directory;
  const query = new URLSearchParams();
  if (dir.query) query.set('q', dir.query);
  if (dir.filter) query.set('filter', dir.filter);
  const payload = await b1513Api.directory(query.toString());
  dir.loaded = true;
  dir.students = asArray(payload?.students);
  dir.total = Number(payload?.total || dir.students.length);
  dir.boundaries = payload?.boundaries || null;
}

function b1513DirectoryRow(entry) {
  const counts = entry.storyCounts;
  const initials = entry.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('');
  const activity = entry.lastActivity ? `Active ${ago(entry.lastActivity)}` : 'No activity yet';
  const chips = [];
  if (counts.awaiting) chips.push(`<span class="stChip st-awaiting">${counts.awaiting} awaiting</span>`);
  if (counts.inReview) chips.push(`<span class="stChip st-in_review">${counts.inReview} in review</span>`);
  if (counts.changes) chips.push(`<span class="stChip st-changes">${counts.changes} changes</span>`);
  if (!counts.total) chips.push('<span class="stChip b1513NeverChip">No stories yet</span>');
  return `<article class="mStuRow b1513DirRow ${counts.total === 0 ? 'b1513Never' : ''}">
    <span class="stuAv">${esc(initials)}</span>
    <span class="rMain"><span class="rTitle">${esc(entry.name)}${entry.warnings.length ? `<span class="b1513WarnDot" title="${attr(entry.warnings.join(' · '))}">⚠</span>` : ''}</span>
      <span class="rSub">${esc(entry.username)} · ${esc(activity)}${entry.lastReview ? ` · last review ${esc(ago(entry.lastReview))}` : ''}</span></span>
    <span class="numPair"><span class="n">${counts.total}</span><span class="l">Stories</span></span>
    <span class="numPair"><span class="n">${counts.mentorVisible}</span><span class="l">Visible</span></span>
    <span class="numPair"><span class="n metric-ember">${counts.awaiting}</span><span class="l">Awaiting</span></span>
    <span class="b1513DirChips">${chips.join('')}</span>
    <button class="rowBtn pri" type="button" data-b1513-open-profile="${attr(entry.id)}">Open</button>
  </article>`;
}

function b1513RenderAdminDirectory() {
  const dir = b1513State().directory;
  const filters = [['', 'All students'], ['awaiting', 'Awaiting review'], ['never_active', 'Never active'], ['inactive_30', 'Quiet 30+ days'], ['warnings', 'Warnings']];
  main.innerHTML = `<section data-view="admin-students" class="live b1513Directory">
    <div class="eyebrow">Administrator · Students</div>
    <h1 class="h1">Every eligible student, <em>including the quiet ones</em>.</h1>
    <p class="stageHint">All currently trusted, verified, active StoryForge-eligible 360 students from the canonical LearnDash entitlement — students appear even if they have submitted nothing. Private story <b>content</b> is never listed here; only counts.</p>
    <form class="listBar" id="b1513DirectorySearchForm" role="search">
      <label class="srOnly" for="b1513DirQ">Search students</label>
      <input id="b1513DirQ" type="search" placeholder="Name or username…" value="${attr(dir.query)}" autocomplete="off">
      <button class="rowBtn pri" type="submit">Search</button>
      <span class="countNote">${dir.students.length} of ${dir.total} eligible students · server-authorized</span>
    </form>
    <div class="classChips b1513DirFilters" role="group" aria-label="Directory filters">
      ${filters.map(([value, label]) => `<button class="cChip ${dir.filter === value ? 'on' : ''}" type="button" data-b1513-dir-filter="${value}" aria-pressed="${dir.filter === value}">${label}</button>`).join('')}
    </div>
    <div id="b1513DirectoryRows">${dir.students.length ? dir.students.map(b1513DirectoryRow).join('') : emptyState('No students match.', 'Adjust the search or filter.')}</div>
  </section>`;
}

async function b1513OpenProfile(id, tab = 'overview') {
  const dir = b1513State().directory;
  try {
    const payload = await withBusy(() => b1513Api.directoryStudent(id));
    dir.profile = payload;
    dir.profileTab = tab;
    dir.reviewCheckPreview = null;
    dir.reviewCheckReceipt = null;
    b1513RenderProfileDrawer();
  } catch (error) {
    notify(error.message || 'The student profile could not be opened.');
  }
}

function b1513ProfileTabContent() {
  const dir = b1513State().directory;
  const profile = dir.profile;
  const entry = profile.student;
  const counts = entry.storyCounts;
  const tab = dir.profileTab;

  if (tab === 'overview') {
    return `<div class="forgeStats b1513ProfileStats">
        <div class="fstat"><div class="n">${counts.total}</div><div class="l">Stories</div></div>
        <div class="fstat"><div class="n">${counts.complete}</div><div class="l">Complete</div></div>
        <div class="fstat"><div class="n metric-ember">${counts.awaiting}</div><div class="l">Awaiting</div></div>
        <div class="fstat"><div class="n metric-green">${counts.approved}</div><div class="l">Approved</div></div>
      </div>
      <div class="setRow"><div class="sTxt"><b>Last meaningful activity</b><span>${entry.lastActivity ? esc(formatDateTime(entry.lastActivity)) : 'No StoryForge activity recorded yet.'}</span></div></div>
      <div class="setRow"><div class="sTxt"><b>Latest mentor review</b><span>${entry.lastReview ? esc(formatDateTime(entry.lastReview)) : 'No review yet.'}</span></div></div>
      <div class="setRow"><div class="sTxt"><b>Last Review Check</b><span>${entry.reviewCheck ? esc(formatDateTime(entry.reviewCheck)) : 'Never sent.'}</span></div></div>
      <div class="setRow"><div class="sTxt"><b>Visibility mix</b><span>${counts.mentorVisible} mentor-visible · ${counts.private} private (content never accessible)</span></div></div>
      ${entry.warnings.length ? entry.warnings.map((warning) => `<div class="releaseError" role="note">⚠ ${esc(warning)}</div>`).join('') : ''}`;
  }
  if (tab === 'activity') {
    const activity = profile.activity || {};
    const totals = activity.totals;
    const counters = activity.counters;
    return `<p class="stageHint b1513Truth">Engagement analytics are recorded from <b>${esc(formatDate(activity.availableFrom))}</b>, when activity tracking was enabled. Nothing before that date is shown, because it was not recorded. An open tab does not count — only foreground, interacting time.</p>
      ${totals ? `<div class="forgeStats b1513ProfileStats">
        <div class="fstat"><div class="n">${totals.sessionCount}</div><div class="l">Sessions</div></div>
        <div class="fstat"><div class="n">${totals.activeMinutes}m</div><div class="l">Active time</div></div>
        <div class="fstat"><div class="n">${totals.averageMinutes}m</div><div class="l">Avg session</div></div>
      </div>` : `<div class="setRow"><div class="sTxt"><b>No sessions recorded yet</b><span>Available from ${esc(formatDate(activity.availableFrom))} — this student has not used StoryForge since tracking was enabled.</span></div></div>`}
      ${asArray(activity.sessions).map((session) => `<div class="setRow"><div class="sTxt"><b>${esc(formatDateTime(session.startedAt))}</b><span>${session.activeMinutes} active minutes · ${esc(session.surface)}</span></div></div>`).join('')}
      ${counters ? `<div class="setRow"><div class="sTxt"><b>Since tracking began</b><span>${counters.storiesOpened} stories opened · ${counters.storiesCreated} created · ${counters.storiesAdvanced} advanced · ${counters.submissions} submissions · ${counters.versionEdits} version edits · ${counters.inspirationAnswers} Inspiration answers</span></div></div>` : ''}`;
  }
  if (tab === 'stories') {
    const stories = asArray(profile.stories);
    return `<p class="stageHint">Mentor-visible and submitted stories only. ${counts.private ? `${counts.private} private ${counts.private === 1 ? 'story' : 'stories'} exist and cannot be listed or opened.` : ''}</p>
      ${stories.length ? stories.map((story) => `<article class="mStuRow">
        <span class="rMain"><span class="rTitle">${esc(story.title)}</span><span class="rSub">Updated ${esc(ago(story.updatedAt))} · ${story.visibility === 'mentor_visible' ? '👁 mentor visible' : ''}</span></span>
        ${statusChip(normalizeStory(story))}
        <button class="rowBtn pri" type="button" data-admin-open-story="${attr(story.id)}">Open review</button>
      </article>`).join('') : '<div class="stageHint">No mentor-visible or submitted stories yet.</div>'}`;
  }
  if (tab === 'reviews') {
    const reviews = asArray(profile.reviews);
    return reviews.length ? reviews.map((review) => `<div class="setRow"><div class="sTxt"><b>${esc(review.title)}</b><span>Reviewed ${esc(formatDateTime(review.reviewedAt))} · ${esc(STATUS[review.status]?.label || review.status)} · score ${review.mentorScore || '—'}/5</span></div>
      <button class="rowBtn" type="button" data-admin-open-story="${attr(review.storyId)}">Open</button></div>`).join('') : '<div class="stageHint">No completed reviews for this student yet.</div>';
  }
  if (tab === 'notifications') {
    const notifications = asArray(profile.notifications);
    const checks = asArray(profile.reviewChecks);
    return `${checks.length ? `<div class="rLbl">Review Check history</div>${checks.map((check) => `<div class="setRow"><div class="sTxt"><b>${esc(formatDateTime(check.sentAt))} · ${esc(check.status)}</b><span>${esc(check.body)}</span></div></div>`).join('')}` : ''}
      <div class="rLbl">Student notifications</div>
      ${notifications.length ? notifications.map((item) => `<div class="setRow"><div class="sTxt"><b>${item.read ? 'Read' : 'Unread'}${item.kind === 'review_check' ? ' · Review Check' : ''}</b><span>${esc(item.text)}</span></div></div>`).join('') : '<div class="stageHint">No notifications sent to this student yet.</div>'}`;
  }
  if (tab === 'account') {
    const account = profile.account || {};
    return `<div class="setRow"><div class="sTxt"><b>Username</b><span>${esc(account.username || '')}</span></div></div>
      <div class="setRow"><div class="sTxt"><b>Entitlement</b><span>${account.entitlement === 'active' ? 'Active — canonical LearnDash 360 entitlement verified.' : 'Renewal due — entitlement expires soon.'}</span></div><span class="rolePill ${account.entitlement === 'active' ? '' : 'roleReadOnly'}">${esc(account.entitlement)}</span></div>
      <div class="setRow"><div class="sTxt"><b>Provisioned</b><span>${esc(formatDateTime(account.provisioned))}</span></div></div>
      ${asArray(account.warnings).map((warning) => `<div class="releaseError" role="note">⚠ ${esc(warning)}</div>`).join('') || '<div class="stageHint">No account warnings.</div>'}`;
  }
  return '';
}

function b1513RenderProfileDrawer() {
  const dir = b1513State().directory;
  const profile = dir.profile;
  if (!profile) { qad.classList.remove('open'); qad.innerHTML = ''; return; }
  const entry = profile.student;
  const initials = entry.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('');
  const tabs = [['overview', 'Overview'], ['activity', 'Activity'], ['stories', 'Stories'], ['reviews', 'Reviews'], ['notifications', 'Notifications'], ['account', 'Account']];
  qad.classList.add('open');
  qad.innerHTML = `<div class="drawer b1513ProfileDrawer" role="dialog" aria-modal="true" aria-labelledby="b1513ProfileName">
    <div class="drawerTop">
      <button class="backBtn" type="button" data-b1513-close-profile>‹ Student directory</button>
    </div>
    <div class="profHead"><span class="stuAv">${esc(initials)}</span><div>
      <div class="eyebrow">Administrator · student profile</div>
      <h2 class="h2" id="b1513ProfileName">${esc(entry.name)}</h2>
      <p class="stageHint">${esc(entry.username)} · entitlement ${esc(entry.entitlement)} · ${entry.lastActivity ? `active ${esc(ago(entry.lastActivity))}` : 'no activity yet'}</p>
    </div>
    <button class="noteSend b1513ReviewCheckBtn" type="button" data-b1513-review-check-preview="${attr(entry.id)}">Record Review Check</button></div>
    ${dir.reviewCheckPreview ? `<div class="b1513ReviewCheckPreview" role="region" aria-label="Review check preview">
      <div class="rLbl">Preview — nothing has been sent</div>
      <p class="b1513ReviewCheckText">${esc(dir.reviewCheckPreview.text)}</p>
      <div class="inlineActions">
        <button class="noteSend" type="button" data-b1513-review-check-send="${attr(entry.id)}">Send to ${esc(entry.name.split(/\s+/)[0])}</button>
        <button class="rowBtn" type="button" data-b1513-review-check-cancel>Cancel</button>
      </div>
      <p class="stageHint">Sending records an audited, timestamped StoryForge notification. One Review Check per student per day.</p>
    </div>` : ''}
    ${dir.reviewCheckReceipt ? `<div class="b1513ReviewCheckPreview b1513Sent" role="status">✓ Sent ${esc(formatDateTime(dir.reviewCheckReceipt.sentAt))} · delivery: ${esc(dir.reviewCheckReceipt.status)} · audited.</div>` : ''}
    <div class="voiceTabs b1513ProfileTabs" role="tablist" aria-label="Student profile sections">
      ${tabs.map(([id, label]) => `<button type="button" role="tab" class="${dir.profileTab === id ? 'on' : ''}" aria-selected="${dir.profileTab === id}" data-b1513-profile-tab="${id}">${label}</button>`).join('')}
    </div>
    <div class="b1513ProfileBody">${b1513ProfileTabContent()}</div>
  </div>`;
}

async function b1513ReviewCheckPreview(studentId) {
  const dir = b1513State().directory;
  try {
    const payload = await withBusy(() => b1513Api.reviewCheck({ studentId, preview: true }));
    dir.reviewCheckPreview = payload?.preview || null;
    dir.reviewCheckReceipt = null;
    b1513RenderProfileDrawer();
  } catch (error) {
    notify(error.message || 'The Review Check preview is unavailable.');
  }
}

async function b1513ReviewCheckSend(studentId) {
  const dir = b1513State().directory;
  try {
    const payload = await withBusy(() => b1513Api.reviewCheck({ studentId }));
    dir.reviewCheckPreview = null;
    dir.reviewCheckReceipt = payload?.receipt || null;
    await b1513OpenProfile(studentId, 'notifications');
    dir.reviewCheckReceipt = payload?.receipt || null;
    b1513RenderProfileDrawer();
    notify('Review Check sent, audited, and recorded in the student’s notifications.', '✓');
  } catch (error) {
    dir.reviewCheckPreview = null;
    b1513RenderProfileDrawer();
    notify(error.message || 'The Review Check could not be sent.');
  }
}

/* ---------------- Admin Home extras ---------------- */

function b1513AdminHomeExtras() {
  const payload = adminConsoleState().home?.b1513;
  if (!payload) return '';
  return `<div class="forgeStats adminMetrics b1513AdminExtras">
    <div class="fstat"><div class="n">${Number(payload.eligibleStudents || 0)}</div><div class="l">Eligible students</div></div>
    <div class="fstat"><div class="n metric-cyan">${Number(payload.activeThisWeek || 0)}</div><div class="l">Active this week</div></div>
    <div class="fstat"><div class="n metric-violet">${Number(payload.neverActive || 0)}</div><div class="l">Never active</div></div>
    <div class="fstat"><div class="n metric-ember">${Number(payload.warnings || 0)}</div><div class="l">Warnings</div></div>
  </div>`;
}

/* ---------------- Admin story review: direct controls ---------------- */

function b1513DirectReviewControls(story) {
  const statuses = [['in_review', 'In review'], ['changes', 'Changes'], ['reviewed', 'Reviewed'], ['approved', 'Approved']];
  return `<div class="b1513ReviewOwner"><span class="stuAv">${esc((story.studentName || 'S').split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>
      <span>Reviewing <b>${esc(story.studentName)}</b>’s story</span></div>
    <div class="fLbl" id="b1513StarsLabel">Mentor score — distinct from the student’s own priority</div>
    <div class="b1513Stars" role="radiogroup" aria-labelledby="b1513StarsLabel">
      ${[1, 2, 3, 4, 5].map((score) => `<button type="button" role="radio" class="b1513Star ${story.mentorScore >= score ? 'on' : ''}" aria-checked="${story.mentorScore === score}" data-b1513-admin-score="${score}" aria-label="Set mentor score to ${score} of 5">★</button>`).join('')}
      <span class="spv">${story.mentorScore ? `${story.mentorScore}/5` : 'not scored'}</span>
    </div>
    <div class="fLbl">Review status</div>
    <div class="statusRow b1513StatusRow" role="group" aria-label="Review status">
      ${statuses.map(([value, label]) => `<button type="button" data-b1513-admin-status="${value}" class="${story.status === value ? `on ${STATUS[value].col}` : ''}" aria-pressed="${story.status === value}">${label}</button>`).join('')}
    </div>
    <div class="fLbl">Suitability</div>
    <div class="classChips b1513SuitChips" role="group" aria-label="Story suitability">
      ${Object.entries(SUITABILITY).map(([value, label]) => `<button class="cChip ${story.reviewSuitability === value ? 'on' : ''}" type="button" data-b1513-admin-suitability="${value}" aria-pressed="${story.reviewSuitability === value}">${esc(label)}</button>`).join('')}
    </div>
    <p class="stageHint" data-b1513-review-live aria-live="polite">Each control saves immediately, version-checked and audited — no page reload.</p>`;
}

async function b1513AdminPatch(patch, announce) {
  const story = adminConsoleState().story;
  if (!story) return;
  try {
    const result = await api.adminReview(story.id, { expectedVersion: story.rowVersion, patch });
    adminConsoleState().story = normalizeStory({ ...(result?.story || {}), feedback: result?.feedback, internalNotes: result?.internalNotes });
    renderAdminStory();
    const live = $('[data-b1513-review-live]');
    if (live) live.textContent = announce;
    notify(announce, '✓');
  } catch (error) {
    notify(error.message || 'The review change could not be saved.');
    renderAdminStory();
  }
}

/* ---------------- Admin configuration: versions + Inspiration ---------------- */

function b1513VersionConfigPanel() {
  const draft = contentDisplayDraft();
  if (!draft.b1513) draft.b1513 = JSON.parse(JSON.stringify(state.presentation?.b1513 || { versions: [] }));
  const versions = asArray(draft.b1513.versions);
  return `<fieldset class="b1512ConfigGroup b1513VersionConfig"><legend>Story versions</legend>
    <p class="stageHint">Bounded labels, helper copy, and recommended targets for the story versions. The Original telling is provenance-protected and cannot be renamed, hidden, or retired.</p>
    <div class="b1512SectionRow b1513LockedRow"><strong>Original telling</strong><span class="stageHint">🔒 Protected — the historical source telling is never overwritten and always visible.</span></div>
    ${versions.map((version) => `<div class="b1512SectionRow" data-b1513-version-config="${attr(version.key)}">
      <strong>${esc(version.key === 'full_story' ? 'Full Story (the existing Working version)' : version.key === 'thirty_second' ? '30-Second Version' : 'NNQ Setup Version')}</strong>
      <label>Label<input data-b1513-vc-label value="${attr(version.label)}" maxlength="60" required></label>
      <label>Helper text<textarea data-b1513-vc-helper maxlength="400" rows="2">${esc(version.helper || '')}</textarea></label>
      <label>Recommended target<input data-b1513-vc-target value="${attr(version.target || '')}" maxlength="120" placeholder="e.g. ~75–90 spoken words (≈30 seconds)"></label>
      ${version.key === 'full_story' ? '<span class="stageHint">Always visible — this is the canonical editable telling.</span>' : `<label>Display<select data-b1513-vc-state>
        <option value="active" ${version.state === 'active' ? 'selected' : ''}>Visible</option>
        <option value="hidden" ${version.state === 'hidden' ? 'selected' : ''}>Hidden</option>
        <option value="retired" ${version.state === 'retired' ? 'selected' : ''}>Retired</option>
      </select></label>`}
    </div>`).join('')}
    <p class="stageHint">Changes publish through the same Preview → Publish → audit path as everything else on this page.</p>
  </fieldset>`;
}

function b1513SyncVersionConfigDraft(form) {
  const draft = contentDisplayDraft();
  if (!draft.b1513) return draft;
  for (const row of $$('[data-b1513-version-config]', form)) {
    const version = asArray(draft.b1513.versions).find((entry) => entry.key === row.dataset.b1513VersionConfig);
    if (!version) continue;
    version.label = $('[data-b1513-vc-label]', row)?.value || version.label;
    version.helper = $('[data-b1513-vc-helper]', row)?.value || '';
    version.target = $('[data-b1513-vc-target]', row)?.value || '';
    const stateSel = $('[data-b1513-vc-state]', row);
    if (stateSel) version.state = stateSel.value;
  }
  return draft;
}

function b1513InspirationConfigPanel() {
  const admin = b1513State().adminInspiration;
  if (!admin) {
    return `<div class="panel panel-spaced b1513InspirationAdmin"><div class="pHead"><div class="h2">Inspiration <em>content</em></div></div>
      <div class="pBody"><button class="rowBtn" type="button" data-b1513-load-insp-admin>Open the Inspiration content manager</button>
      <p class="stageHint">Structured management of the Inspiration question library — labels, wording, active/retired state, ordering, and preview. No source-code editing.</p></div></div>`;
  }
  const filter = b1513State().adminInspirationFilter;
  const prompts = asArray(admin.prompts).filter((prompt) => !filter || prompt.who?.includes(filter) || prompt.domain?.includes(filter) || prompt.energy?.includes(filter));
  const active = asArray(admin.prompts).filter((prompt) => prompt.state === 'active').length;
  return `<div class="panel panel-spaced b1513InspirationAdmin"><div class="pHead"><div class="h2">Inspiration <em>content</em></div><span class="rolePill">Version ${admin.rowVersion} · ${active} active questions</span></div>
    <div class="pBody">
      <p class="stageHint">Every question is a stable-ID record: edit wording, retire, or add — existing student answers keep their provenance. Publishing is versioned and audited.</p>
      <div class="classChips">${[['', 'All'], ['you', 'You'], ['family', 'Family'], ['someone_else', 'Someone Else'], ['personal', 'Personal'], ['academic', 'Academic'], ['medical_clinical', 'Medical/Clinical'], ['light', 'Light'], ['serious', 'Serious'], ['moving', 'Moving']].map(([value, label]) => `<button class="cChip ${filter === value ? 'on' : ''}" type="button" data-b1513-insp-filter="${value}">${label}</button>`).join('')}</div>
      <div class="b1513PromptRows">${prompts.slice(0, 12).map((prompt) => `<div class="b1512SectionRow b1513PromptRow" data-b1513-prompt-row="${attr(prompt.id)}">
        <span class="b1512StableId">${esc(prompt.id)} · ${esc((prompt.who || []).join(','))} · ${esc((prompt.energy || []).join(','))}</span>
        <label>Question<textarea data-b1513-prompt-text rows="2" maxlength="400">${esc(prompt.text)}</textarea></label>
        <div class="inlineActions">
          <select data-b1513-prompt-state><option value="active" ${prompt.state === 'active' ? 'selected' : ''}>Active</option><option value="retired" ${prompt.state === 'retired' ? 'selected' : ''}>Retired</option></select>
          <button class="rowBtn" type="button" data-b1513-prompt-save="${attr(prompt.id)}">Save</button>
        </div>
      </div>`).join('')}</div>
      ${prompts.length > 12 ? `<p class="stageHint">Showing 12 of ${prompts.length} matching questions.</p>` : ''}
      <div class="inlineActions"><button class="rowBtn" type="button" data-b1513-prompt-add>+ Add question</button>
      <button class="rowBtn" type="button" data-nav="students" hidden></button>
      <button class="rowBtn pri" type="button" data-b1513-insp-preview>Preview the student wizard</button></div>
    </div></div>`;
}

async function b1513LoadInspAdmin() {
  const payload = await withBusy(() => b1513Api.adminInspiration());
  b1513State().adminInspiration = payload?.configuration || null;
  renderAdminReleaseControls();
}

async function b1513SavePrompt(id) {
  const row = $(`[data-b1513-prompt-row="${CSS.escape(id)}"]`);
  if (!row) return;
  const text = $('[data-b1513-prompt-text]', row)?.value || '';
  const promptState = $('[data-b1513-prompt-state]', row)?.value || 'active';
  const payload = await withBusy(() => b1513Api.adminInspirationSave({ prompt: { id, text, state: promptState } }));
  b1513State().adminInspiration = payload?.configuration || b1513State().adminInspiration;
  notify('Question saved and versioned.', '✓');
  renderAdminReleaseControls();
}

/* ---------------- delegated events for all B1-513 surfaces ---------------- */

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button, [data-b1513-wizard-pick]');
  if (!button) return;
  try {
    /* consent */
    if (button.matches('[data-b1513-consent-accept]')) return void b1513DecideConsent('accept');
    if (button.matches('[data-b1513-consent-defer]')) return void b1513DecideConsent('defer');
    if (button.matches('[data-b1513-consent-close]')) return b1513CloseConsent();
    if (button.matches('[data-b1513-review-policy]')) return void b1513ShowConsent({ review: true });

    /* visibility */
    if (button.matches('[data-b1513-set-visibility]') && !button.disabled) {
      return void b1513SetVisibility(button.dataset.b1513SetVisibility);
    }

    /* versions */
    if (button.matches('[data-b1513-version-voice]')) {
      const form = button.closest('[data-b1513-version-form]');
      if (form) b1513StartVersionRecorder(form.dataset.storyId, form.dataset.b1513VersionForm, button.dataset.b1513VersionVoice);
      return;
    }
    if (button.matches('[data-b1513-version-rec-done]')) return void b1513FinishVersionRecorder(true);
    if (button.matches('[data-b1513-version-rec-cancel]')) return void b1513FinishVersionRecorder(false);
    if (button.matches('[data-b1513-version-retell-typed]')) return void b1513RetellTyped();
    if (button.matches('[data-b1513-version-history]')) {
      const story = state.storyDetail;
      if (!story) return;
      const key = `${story.id}:${button.dataset.b1513VersionHistory}`;
      b1513State().versionHistoryOpen[key] = !b1513State().versionHistoryOpen[key];
      return renderStoryRoom();
    }
    if (button.matches('[data-b1513-restore-revision]')) {
      return void b1513RestoreRevision(button.dataset.versionKey, button.dataset.b1513RestoreRevision);
    }

    /* inspiration wizard */
    if (button.matches('[data-b1513-wizard-pick]')) {
      return void b1513WizardPick(button.dataset.b1513WizardPick, button.dataset.b1513WizardValue);
    }
    if (button.matches('[data-b1513-wizard-more]')) {
      b1513State().inspiration.whoDetailExpanded = true;
      return b1513RerenderWizard();
    }
    if (button.matches('[data-b1513-wizard-back]')) return b1513WizardBack();
    if (button.matches('[data-b1513-skip]') || button.matches('[data-b1513-another]')) {
      await b1513NextPrompt();
      return b1513RerenderWizard();
    }
    if (button.matches('[data-b1513-lighter]')) {
      b1513State().inspiration.selections.energy = 'light';
      await b1513NextPrompt();
      return b1513RerenderWizard();
    }
    if (button.matches('[data-b1513-save-later]')) return void b1513SaveForLater();
    if (button.matches('[data-b1513-sparked]')) return b1513Sparked();
    if (button.matches('[data-b1513-add-library]')) return void b1513AddToLibrary();
    if (button.matches('[data-b1513-insp-voice]')) return b1513StartInspRecorder();
    if (button.matches('[data-b1513-insp-rec-done]')) return b1513StopInspRecorder(true);
    if (button.matches('[data-b1513-insp-rec-cancel]')) {
      const box = $('[data-b1513-answer]');
      if (box) { box.value = b1513State().inspiration.answer = ''; }
      return b1513StopInspRecorder(true);
    }
    if (button.matches('[data-b1513-resume-saved]')) {
      const insp = b1513State().inspiration;
      const item = insp.saved.find((saved) => saved.id === button.dataset.b1513ResumeSaved);
      if (!item) return;
      insp.step = 'question';
      insp.prompt = { id: item.promptId || `saved-${item.id}`, text: item.promptText.replace(/^✧ Sparked: /, ''), followUp: '', territory: '' };
      insp.answer = item.draft || '';
      return renderInspiration();
    }
    if (button.matches('[data-b1513-remove-saved]')) {
      const payload = await b1513Api.inspirationRemoveSaved(button.dataset.b1513RemoveSaved).catch(() => null);
      if (payload) b1513State().inspiration.saved = asArray(payload.saved);
      return renderInspiration();
    }

    /* directory */
    if (button.matches('[data-b1513-dir-filter]')) {
      b1513State().directory.filter = button.dataset.b1513DirFilter;
      await b1513LoadAdminDirectory();
      return b1513RenderAdminDirectory();
    }
    if (button.matches('[data-b1513-open-profile]')) return void b1513OpenProfile(button.dataset.b1513OpenProfile);
    if (button.matches('[data-b1513-close-profile]')) {
      b1513State().directory.profile = null;
      return b1513RenderProfileDrawer();
    }
    if (button.matches('[data-b1513-profile-tab]')) {
      b1513State().directory.profileTab = button.dataset.b1513ProfileTab;
      return b1513RenderProfileDrawer();
    }
    if (button.matches('[data-b1513-review-check-preview]')) return void b1513ReviewCheckPreview(button.dataset.b1513ReviewCheckPreview);
    if (button.matches('[data-b1513-review-check-send]')) return void b1513ReviewCheckSend(button.dataset.b1513ReviewCheckSend);
    if (button.matches('[data-b1513-review-check-cancel]')) {
      b1513State().directory.reviewCheckPreview = null;
      return b1513RenderProfileDrawer();
    }

    /* admin review direct controls */
    if (button.matches('[data-b1513-admin-score]')) {
      return void b1513AdminPatch({ mentorScore: Number(button.dataset.b1513AdminScore) }, `Mentor score set to ${button.dataset.b1513AdminScore}/5 — audited.`);
    }
    if (button.matches('[data-b1513-admin-status]')) {
      return void b1513AdminPatch({ status: button.dataset.b1513AdminStatus }, `Status set to ${STATUS[button.dataset.b1513AdminStatus]?.label} — audited.`);
    }
    if (button.matches('[data-b1513-admin-suitability]')) {
      const story = adminConsoleState().story;
      const next = story?.reviewSuitability === button.dataset.b1513AdminSuitability ? null : button.dataset.b1513AdminSuitability;
      return void b1513AdminPatch({ suitability: next }, next ? `Suitability: ${SUITABILITY[next]} — audited.` : 'Suitability cleared — audited.');
    }

    /* admin inspiration config */
    if (button.matches('[data-b1513-load-insp-admin]')) return void b1513LoadInspAdmin();
    if (button.matches('[data-b1513-insp-filter]')) {
      b1513State().adminInspirationFilter = button.dataset.b1513InspFilter;
      return renderAdminReleaseControls();
    }
    if (button.matches('[data-b1513-prompt-save]')) return void b1513SavePrompt(button.dataset.b1513PromptSave);
    if (button.matches('[data-b1513-prompt-add]')) {
      const text = window.prompt('New Inspiration question (write it as one warm, specific memory question — cue a moment, not a trait):');
      if (!text || !text.trim()) return;
      const followUp = window.prompt('Required deepening follow-up (one line that pulls toward the scene, the stakes, or what changed):');
      if (!followUp || !followUp.trim()) return notify('Not added — every question needs its follow-up before it can exist.');
      const payload = await withBusy(() => b1513Api.adminInspirationSave({ prompt: { id: `q-new-${Date.now().toString(36)}`, text: text.trim(), followUp: followUp.trim(), who: ['you'], domain: ['personal'], energy: ['light'], state: 'retired' } }));
      b1513State().adminInspiration = payload?.configuration || b1513State().adminInspiration;
      notify('Saved as Retired. Complete its dimensions and safety review, then set it Active to publish.', '✓');
      return renderAdminReleaseControls();
    }
    if (button.matches('[data-b1513-insp-preview]')) {
      if (canSwitchAdministratorView()) {
        state.activeRole = 'student';
        return void navigate('inspiration');
      }
      return notify('Switch to Student View to preview the wizard.');
    }
  } catch (error) {
    notify(error.message || 'That action could not be completed.');
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.matches?.('[data-b1513-version-form]')) {
    event.preventDefault();
    void b1513SaveVersion(form);
    return;
  }
  if (form.id === 'b1513DirectorySearchForm') {
    event.preventDefault();
    b1513State().directory.query = $('#b1513DirQ', form)?.value || '';
    void b1513LoadAdminDirectory().then(b1513RenderAdminDirectory);
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.matches?.('[data-b1513-answer]')) {
    const insp = b1513State().inspiration;
    insp.answer = target.value;
    const hasAnswer = Boolean(target.value.trim());
    const addButton = $('[data-b1513-add-library]');
    if (addButton) addButton.disabled = !hasAnswer;
    // Reveal the deepening follow-up and the interview-conversion row on first
    // typed input WITHOUT re-rendering (keeps textarea focus) — verifier P1-1/P1-2.
    const followUp = $('[data-b1513-followup]');
    if (followUp) followUp.hidden = !hasAnswer;
    const convert = $('[data-b1513-convert]');
    if (convert) convert.hidden = !hasAnswer;
    return;
  }
  if (target.matches?.('[data-b1513-change]')) {
    b1513State().inspiration.changeNote = target.value;
    return;
  }
  if (target.matches?.('[data-b1513-version-input]')) {
    const counter = $('[data-b1513-word-count]');
    if (counter) {
      const words = b1513WordCount(target.value);
      const form = target.closest('[data-b1513-version-form]');
      const isThirty = form?.dataset.b1513VersionForm === 'thirty_second';
      counter.textContent = words ? `≈ ${words} words${isThirty ? ` · ${words <= 95 ? 'inside' : 'over'} the ~30-second target` : ''}` : '';
    }
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches?.('[data-b1513-consent-check]')) {
    const accept = document.querySelector('[data-b1513-consent-accept]');
    if (accept) accept.disabled = !target.checked;
  }
});
