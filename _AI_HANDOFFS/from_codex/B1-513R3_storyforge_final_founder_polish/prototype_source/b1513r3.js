/* B1-513R3 — bounded presentation refinements on the accepted R2 prototype. */
const B1513R3_VERSION = 'B1-513R3';

function b1513r3HomeInspirationLink() {
  if (!isStudent() || !b1513FeatureOn('inspiration')) return '';
  const r2 = b1513r2State();
  if (!r2.homeRecs && !r2.homeRecsLoading) {
    r2.homeRecsLoading = true;
    b1513rApi.browse('').then((payload) => {
      r2.homeRecs = asArray(payload?.prompts).filter((prompt) => prompt.recommended && !prompt.answeredStoryId).slice(0, 2);
      if (!r2.homeRecs.length) r2.homeRecs = asArray(payload?.prompts).filter((prompt) => prompt.recommended).slice(0, 2);
      r2.homeRecsLoading = false;
      if (state.route === 'home') renderRoute();
    }).catch(() => { r2.homeRecs = []; r2.homeRecsLoading = false; });
  }
  const recs = asArray(r2.homeRecs);
  return `<section class="b1513r3Recommends" aria-labelledby="b1513r3RecTitle">
    <div class="b1513r3RecHeader"><div class="b1513r3RecIdentity"><span class="b1513r3RecSeal" aria-hidden="true">✦</span><div class="b1513r3RecTitle" id="b1513r3RecTitle">Dr Brian <em>Recommends</em><span class="b1513r3RecSub">Questions chosen to help this cohort uncover stories worth remembering.</span></div></div></div>
    <div class="b1513r3RecList">${recs.length ? recs.map((prompt) => `<button class="b1513r3Rec" type="button" data-b1513r2-home-rec="${attr(prompt.id)}"><span class="b1513r3RecQuestion">“${esc(prompt.text)}”</span><span class="b1513r3RecAction">Answer →</span></button>`).join('') : `<div class="stageHint">${r2.homeRecsLoading ? 'Choosing two questions for you…' : 'Your next recommended questions are being prepared.'}</div>`}</div>
    <div class="b1513r3RecFooter"><button class="rowBtn" type="button" data-nav="inspiration">Explore all questions →</button></div>
  </section>`;
}

function b1513r3HomeHud() {
  const stories = asArray(state.stories);
  const total = stories.length;
  const effectiveVisibility = (story) => story.visibility || (story.status === 'private' ? 'private' : 'mentor_visible');
  const privateCount = stories.filter((story) => effectiveVisibility(story) === 'private').length;
  const mentorVisible = stories.filter((story) => effectiveVisibility(story) === 'mentor_visible').length;
  const complete = stories.filter((story) => developmentState(story) === 'Complete').length;
  const statusCounts = Object.fromEntries(Object.keys(STATUS).map((key) => [key, 0]));
  stories.forEach((story) => { statusCounts[story.status] = (statusCounts[story.status] || 0) + 1; });
  const percent = total ? Math.round((complete / total) * 100) : 0;
  const changes = statusCounts.changes || 0;
  const awaiting = (statusCounts.awaiting || 0) + (statusCounts.in_review || 0);
  const actionText = changes ? `<strong>${changes} ${changes === 1 ? 'story needs' : 'stories need'} your response.</strong> Open the filtered Library to continue.` : awaiting ? `<strong>${awaiting} ${awaiting === 1 ? 'story is' : 'stories are'} with your mentor.</strong> You can keep developing your other stories while review continues.` : `<strong>Your forge is ready.</strong> Capture a new moment or keep shaping an unfinished story.`;
  const actionStatus = changes ? 'changes' : awaiting ? 'awaiting' : '';
  return `<section class="b1513r3Hud" aria-labelledby="b1513r3HudTitle">
    <div class="b1513r3HudHead"><div><div class="eyebrow">Your StoryForge · live status</div><h2 class="h2" id="b1513r3HudTitle">Where your stories <em>stand</em></h2><p>A clear view of progress, review, and who can see each story.</p></div><div class="b1513r3HudTotal"><strong>${total}</strong><span>${total === 1 ? 'story' : 'stories'}<br>in your forge</span></div></div>
    <div class="b1513r3HudGrid">
      <div class="b1513r3HudBlock"><span class="b1513r3HudLabel">Development progress</span><div class="b1513r3Progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="${percent}% of stories complete"><span style="width:${percent}%"></span></div><div class="b1513r3HudStatline"><span><b>${complete}</b> complete</span><span>${percent}% of your library</span></div></div>
      <div class="b1513r3HudBlock"><span class="b1513r3HudLabel">Review pipeline</span><div class="b1513r3HudChips">${Object.entries(STATUS).filter(([key]) => statusCounts[key]).map(([key, meta]) => `<button class="b1513r3HudChip ${key === 'changes' ? 'attn' : ''}" type="button" data-library-status="${attr(key)}" title="${attr(meta.hint)}"><b>${statusCounts[key]}</b> ${esc(meta.label)}</button>`).join('') || '<span class="stageHint">No stories in review yet.</span>'}</div></div>
      <div class="b1513r3HudBlock"><span class="b1513r3HudLabel">Privacy at a glance</span><div class="b1513r3PrivacySplit"><div class="b1513r3PrivacyStat"><strong>${mentorVisible}</strong><span>Mentor Visible</span></div><div class="b1513r3PrivacyStat"><strong>${privateCount}</strong><span>Private — only me</span></div></div></div>
    </div>
    <div class="b1513r3HudAction"><span>${actionText}</span><button class="rowBtn pri" type="button" ${actionStatus ? `data-library-status="${actionStatus}"` : 'data-nav="library"'}>Open Story Library →</button></div>
  </section>`;
}

const b1513r3BaseRenderHome = renderHome;
function b1513r3RenderHome() {
  b1513r3BaseRenderHome();
  const view = main.querySelector('[data-view="home"]');
  const grid = view?.querySelector('.homeGrid');
  if (!view || !grid) return;
  const oldStand = [...grid.querySelectorAll('.panel')].find((panel) => /Where your stories\s*stand/i.test(panel.textContent || ''));
  oldStand?.remove();
  grid.insertAdjacentHTML('afterend', b1513r3HomeHud());
}

function b1513r3MentorNotesMarkup(story) {
  if ((!state.capabilities?.mentorNotesRead && !canWriteMentorNotes()) || story.status === 'private' || (!canWriteMentorNotes() && !visibleMentorNotes(story).length)) return '';
  const notes = visibleMentorNotes(story);
  const published = notes.filter((note) => note.state === 'published');
  const draft = canWriteMentorNotes() ? normalizeMentorNote(state.mentorNoteDraft || notes.find((note) => note.state === 'draft') || {}) : null;
  if (draft?.id) state.mentorNoteDraft = draft;
  const recordingState = state.mentorNoteRecording?.recorder?.state || '';
  const isRecording = recordingState === 'recording';
  const isPaused = recordingState === 'paused';
  const adminWriter = canWriteMentorNotes() && canAdminReview();
  return `<section class="railCard b1511MentorNotes b1513r3Feedback" aria-labelledby="b1513r3FeedbackTitle">
    <div class="b1513r3FeedbackHeader"><div><div class="rLbl label-cy" id="b1513r3FeedbackTitle">Mentor feedback</div><p>${canWriteMentorNotes() ? 'Type feedback or speak instead of typing. Review the transcript before publishing it to the student.' : 'Your mentor’s words stay readable here, with the original voice recording whenever one was shared.'}</p></div><span class="b1513r3FeedbackBadge">Transcript + original voice</span></div>
    <div class="b1511MentorNoteList">${published.length ? published.map((note) => `<article class="b1511MentorNote b1513r3FeedbackNote ${note.internalOnly ? 'internal' : ''}">
      <div class="b1513r3FeedbackKind"><span aria-hidden="true">${note.internalOnly ? '◆' : '▤'}</span>${note.internalOnly ? 'Private admin note · never shown to student' : 'Readable transcript'}</div>
      <div class="b1513r3Transcript">${esc(note.body)}</div><div class="b1513r3FeedbackMeta">${esc(note.authorName)} · ${esc(formatDateTime(note.publishedAt || note.createdAt))}</div>
      ${!note.internalOnly && (note.hasAudio || note.audioAssetId) ? `<div class="b1513r3AudioRow"><button class="rowBtn pri" type="button" data-play-mentor-note="${attr(note.id)}">▶ Listen to original voice</button><span class="b1513r3AudioPromise"><b>Original mentor recording</b><br>Authorized playback for this student only.</span><div class="b1511MentorAudio" data-mentor-note-player="${attr(note.id)}"></div></div>` : ''}
    </article>`).join('') : '<div class="storyEmpty">No published mentor feedback yet.</div>'}</div>
    ${canWriteMentorNotes() ? `<div class="b1511MentorComposer b1513r3Composer" data-mentor-note-composer>
      <div class="b1513r3ComposerTop"><div class="b1513r3ComposerTitle">Speak instead of type<span>Your recording becomes an editable transcript; the original audio stays attached.</span></div><span class="b1513r3RecordState ${isRecording ? 'recording' : ''}" aria-live="polite"><i></i>${isRecording ? 'Recording now' : isPaused ? 'Recording paused' : draft?.hasAudio ? 'Audio captured · transcript ready' : 'Ready'}</span></div>
      <label class="fLbl" for="mentorNoteText">${draft?.id ? 'Editable transcript or typed feedback' : 'Student-facing feedback'}</label>
      <textarea id="mentorNoteText" rows="6" placeholder="Type feedback, or record and edit the transcript before publishing.">${esc(draft?.body || '')}</textarea>
      <div class="b1513r3TranscriptHint"><span aria-hidden="true">✎</span><span>Transcription is a draft. Correct names or clinical terminology here before the student sees it.</span></div>
      ${adminWriter ? `<label class="b1513r3Internal"><input id="mentorNoteInternal" type="checkbox" ${draft?.internalOnly ? 'checked' : ''} ${draft?.id ? 'disabled' : ''}><span><b>Private admin note</b>Never visible to the student and never eligible for student audio playback.</span></label>` : ''}
      <div class="inlineActions">
        <button class="rowBtn" type="button" data-save-mentor-note>${draft?.id ? 'Update draft' : 'Save draft'}</button>
        ${globalThis.MediaRecorder ? `<button class="rowBtn ${isRecording ? 'danger' : ''}" type="button" data-record-mentor-note>${isRecording || isPaused ? '■ Stop & transcribe' : '🎙 Record feedback'}</button>${isRecording ? '<button class="rowBtn" type="button" data-b1513r3-mentor-pause>Ⅱ Pause</button>' : ''}${isPaused ? '<button class="rowBtn" type="button" data-b1513r3-mentor-resume>▶ Resume</button>' : ''}` : ''}
        ${draft?.id ? `<button class="noteSend" type="button" data-publish-mentor-note ${draft.internalOnly ? 'disabled' : ''}>Publish transcript + audio</button><button class="rowBtn" type="button" data-discard-mentor-note>Discard draft</button>` : ''}
      </div><div class="b1513r3PublishLaw"><b>Publication boundary:</b> only a published, student-facing note appears for the student. Drafts remain reviewer-only. Private admin notes remain admin-only.</div>
    </div>` : ''}
  </section>`;
}

async function b1513r3ShowConsent({ review = false } = {}) {
  const payload = await b1513Api.consent().catch(() => null);
  const policy = payload?.policy;
  if (!policy) return;
  const b = b1513State();
  b.consent = payload.consent || b.consent;
  const accepted = Boolean(b.consent?.accepted);
  const node = b1513ConsentNode();
  const promises = [
    ['⌂','Your workspace','Stories begin in a protected workspace owned by you.'],
    ['◇','Your mentor','After you agree, new stories begin Mentor Visible.'],
    ['◉','Your control','Every new story can be changed to Private — only me.'],
    ['✓','Review is separate','Visibility never means submitted for formal review.'],
  ];
  const requiredFacts = [
    ...asArray(policy.facts),
    'Before you agree, new stories remain private-safe.',
    'After you agree, only new stories default to Mentor Visible.',
    'Historical V1 stories are never silently widened.',
    'Private means visible only to you — not mentors, admins, or other students.',
    'You can override each story to Private — only me.',
    'Mentor visibility and formal submission are separate choices.',
  ].filter((fact, index, all) => all.indexOf(fact) === index);
  node.className = 'b1513ConsentOpen';
  node.innerHTML = `<div class="b1513ConsentScrim"></div><div class="b1513ConsentSheet b1513r3ConsentSheet" role="dialog" aria-modal="true" aria-labelledby="b1513ConsentTitle">
    <div class="b1513r3ConsentHero"><div class="eyebrow">MissionMed mentorship · one-time choice</div><h1 class="h1" id="b1513ConsentTitle">Your stories. <em>Your choice.</em></h1><p>Choose how new stories begin. You stay in control of every story, every time.</p></div>
    <div class="b1513r3ConsentBody"><div class="b1513r3ConsentPromises" role="list">${promises.map(([icon,title,body]) => `<div class="b1513r3Promise" role="listitem"><span class="b1513r3PromiseIcon" aria-hidden="true">${icon}</span><b>${title}</b><span>${body}</span></div>`).join('')}</div>
      <div class="b1513r3ConsentPlain"><div class="b1513r3ConsentCopy"><div class="rLbl">The plain-language policy</div><h2 class="h2">${esc(policy.title)}</h2>${policy.body.map((paragraph) => `<p class="b1513ConsentPara">${esc(paragraph)}</p>`).join('')}</div><div class="b1513r3ConsentFacts">${requiredFacts.map((fact) => `<div class="b1513r3ConsentFact"><span aria-hidden="true">✓</span>${esc(fact)}</div>`).join('')}</div></div>
      <div class="b1513r3Choice">${accepted ? `<div class="inlineActions"><button class="rowBtn pri" type="button" data-b1513-consent-close>Close</button><span class="stageHint">You agreed on ${esc(formatDateTime(b.consent.acceptedAt))} · receipt ${esc(b.consent.auditId || '')}</span></div>` : `<label class="b1513ConsentCheck b1513r3ConsentCheck"><input type="checkbox" data-b1513-consent-check> <span>I understand: after I agree, <b>new stories</b> begin Mentor Visible, and I can make any story <b>Private — only me</b> at any time.</span></label><div class="b1513r3ConsentActions"><button class="noteSend" type="button" data-b1513-consent-accept disabled>Agree and continue</button><button class="rowBtn" type="button" data-b1513-consent-defer>Not now — keep everything private</button></div><p class="stageHint">“Not now” changes nothing: your work stays private until you choose otherwise. You can decide later in Settings.</p>`}<div class="b1513r3PolicyMeta">Policy ${esc(policy.version)} · updated ${esc(policy.updated)} · always available in Settings → Mentorship &amp; privacy.</div></div>
    </div></div>`;
  const heading = node.querySelector('#b1513ConsentTitle');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}

b1513HomeInspirationLink = b1513r3HomeInspirationLink;
renderHome = b1513r3RenderHome;
mentorNotesMarkup = b1513r3MentorNotesMarkup;
b1513ShowConsent = b1513r3ShowConsent;

document.addEventListener('click', (event) => {
  const pause = event.target.closest?.('[data-b1513r3-mentor-pause]');
  const resume = event.target.closest?.('[data-b1513r3-mentor-resume]');
  if (!pause && !resume) return;
  event.preventDefault();
  const recorder = state.mentorNoteRecording?.recorder;
  if (pause && recorder?.state === 'recording') { recorder.pause(); renderActiveMentorNoteSurface(); notify('Mentor recording paused.'); }
  if (resume && recorder?.state === 'paused') { recorder.resume(); renderActiveMentorNoteSurface(); notify('Mentor recording resumed.'); }
});

window.__B1513R3 = Object.freeze({
  version: B1513R3_VERSION,
  authority: Object.freeze(['DR-040','DR-041']),
  snapshot: () => ({
    persona: sessionStorage.getItem(FIXTURE_PERSONA_KEY) || '',
    route: state.route,
    storyCount: asArray(state.stories).length,
    privateCount: asArray(state.stories).filter((story) => (story.visibility || (story.status === 'private' ? 'private' : 'mentor_visible')) === 'private').length,
    mentorVisibleCount: asArray(state.stories).filter((story) => (story.visibility || (story.status === 'private' ? 'private' : 'mentor_visible')) === 'mentor_visible').length,
    consentAccepted: Boolean(b1513State().consent?.accepted),
    surfaces: {
      recommends: Boolean(document.querySelector('.b1513r3Recommends')),
      homeHud: Boolean(document.querySelector('.b1513r3Hud')),
      mentorFeedback: Boolean(document.querySelector('.b1513r3Feedback')),
      consent: Boolean(document.querySelector('.b1513r3ConsentSheet')),
    },
  }),
});
