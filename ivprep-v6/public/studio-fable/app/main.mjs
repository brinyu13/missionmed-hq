// IVOC Fable 5.1 Dream Experience — app shell and goal screens.
// Routes: #/home #/practice #/mock #/prepare #/review #/devices #/room #/results/:id #/film/:id #/compare/:a/:b #/progress
import { state, commit, attemptsByRecency } from './state.mjs';
import { loadQuestions, CATEGORY_LABELS, defaultMockSet } from './questions.mjs';
import { trayMarkup, mountTray, openSelector } from './questions/selector.mjs';
import { EASY_PRESETS, ROLES, STYLES, CURIOSITY, PACING, defaultSettings, applyPreset, describe as describeSettings } from './settings/interviewer.mjs';
import { controller } from './controller/session-controller.mjs';
import { accountLabel } from './adapters/account-adapter.mjs';
import { searchPrograms } from './adapters/context-adapter.mjs';
import { mountRoom } from './room.mjs';
import { mountResults, mountFilm, mountCompare } from './results.mjs';
import { mountCalibration } from './calibration.mjs';
import { masteryState, streak } from './model/teaching.mjs';
import { projectOwnRetry } from './adapters/retry.mjs';
import { attemptSnapshot, canCompareAttempts } from '../../studio/longitudinal-model.mjs';
import { readOwnPresentation } from './adapters/own-presentation.mjs';

const main = document.getElementById('main');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (ms) => Number.isFinite(ms)?new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }):'Date unavailable';
const fmtDur = (s) => Number.isFinite(s)?`${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`:'Duration unavailable';
export const session = { questionId: null, mode: 'practice', mockSet: null, config: { targetQuestions: 5, style: 'Owl', pressure: false, durationMin: 15, maxDepth: 1 }, settings: defaultSettings(), program: null, retryOf: null, retry: null, priority: null, contextSources: [] };
let teardown = null;
let generation = 0, acceptedHash = '#/home', revertingHash = false;
const guarded = () => true;
const ownQuestions = () => loadQuestions({attempts:state.attempts,favorites:state.preferences.favoriteQuestions});
async function hydrateOwnPresentation(isCurrent) {
  try {
    const own = await readOwnPresentation(controller,{isCurrent});
    if (!own || !isCurrent()) return;
    state.mentorPriority = own.mentorPriority;
    state.preferences = {...state.preferences,...own.preferences};
  } catch {
    if (isCurrent()) state.mentorPriority = null;
  }
}

function salutation() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

function setRoute(route) {
  document.querySelectorAll('[data-route]').forEach((a) => { if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.body.dataset.mode = route === 'room' ? 'room' : 'app';
  document.getElementById('rail-nav').dataset.open = 'false';
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}
function renderIdentity(account) {
  const initials = (account?.display || 'Connecting…').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '·';
  document.getElementById('identity-initials').textContent = initials;
  document.getElementById('identity-mobile').textContent = initials;
  document.getElementById('identity-name').textContent = account?.display || 'Connecting…';
  document.getElementById('identity-sub').textContent = account?.mode === 'REAL' ? `${account.role} · account` : 'Sign in through Matrix';
  document.getElementById('identity-sub').title = account ? accountLabel(account) + (account.reasons?.length ? ` — ${account.reasons.join('; ')}` : '') : '';
}

// ---------- HOME: "What should I do now?" ----------
async function renderHome(isCurrent = guarded) {
  await Promise.all([controller.library({isCurrent}),hydrateOwnPresentation(isCurrent)]);
  const { questions } = await ownQuestions(); if (!isCurrent()) return;
  const attempts = attemptsByRecency();
  const last = attempts[0] || null;
  const daysSince = last ? Math.floor((Date.now() - last.at) / 86_400_000) : null;
  const upcoming = state.program;
  let now;
  if (!attempts.length) now = { kick: 'Start here', title: 'One answer. Five minutes.', body: 'Record "Tell me about yourself" once, privately. You get a debrief with evidence and the one thing to change next.', cta: 'Practice this question', href: '#/practice?q=CORE-01', plan: ['Pick the question (preselected)', 'Quick readiness check', 'Answer on camera', 'Debrief with evidence'] };
  else if (upcoming) now = { kick: `${esc(upcoming.name)} · ${esc(upcoming.when || 'upcoming')}`, title: 'Run a program mock.', body: `The interviewer will know what you authorized about ${esc(upcoming.name)}. Five questions, a closing question, a debrief.`, cta: 'Start program mock', href: '#/mock?program=1', plan: ['Program context loaded', 'Readiness check', 'Interview Room', 'Results and Film Room'] };
  else if (last && last.debriefLane && daysSince < 7) now = { kick: 'Your next rep', title: 'Retry and clear the priority.', body: `Last time on "${esc(last.questionText)}" the one thing to change was ${esc(last.priorityText || last.debriefLane)}. Retry the same question with that priority on screen.`, cta: 'Retry this question', href: `#/${last.mode==='mock'?'mock':'practice'}?q=${encodeURIComponent(last.questionId)}&retry=${last.id}`, plan: ['Same question', 'Priority on screen while you answer', 'Compare the two reps'] };
  else if (daysSince >= 7) now = { kick: `${daysSince} days since your last rep`, title: 'One rep keeps the plan alive.', body: 'Pick up where you left off with the Core question you have practiced least.', cta: 'Practice now', href: '#/practice', plan: ['Least-practiced Core question', 'Readiness check', 'Answer and debrief'] };
  else now = { kick: 'Your next rep', title: 'Step into a full mock.', body: 'Five questions, contextual follow-ups, and practice asking your own questions before the closing.', cta: 'Start mock interview', href: '#/mock', plan: ['Default 5 Core questions', 'Readiness check', 'Interview Room', 'Results'] };
  const core = questions.filter((q) => q.core_priority).slice(0, 10);
  const reps = attempts.length; const days = streak(attempts);
  const practiced = new Set(attempts.map((a) => a.questionId)).size;
  main.innerHTML = `
    <section class="home-hero">
      <div class="hero-copy">
        <div class="t-kick gold">${salutation()}, ${esc(controller.account.display)}</div>
        <h1 class="t-hero">Bring your story.<br><em>Find your voice.</em></h1>
        <p class="t-edit-lg">Practice one answer, run a full AI mock, prepare for a specific program, or review what to change. Four goals, nothing else to learn.</p>
        <div class="hero-actions"><a class="btn btn-primary btn-lg" href="${now.href}">${now.cta} ▸</a><a class="btn btn-quiet" href="#/devices">Check camera, mic and signals</a></div>
        <div class="hero-meta"><div><span class="t-label">Saved reps</span><b>${reps}</b></div><div><span class="t-label">Day streak</span><b>${days}</b></div><div><span class="t-label">Questions practiced</span><b>${practiced}<small style="font-size:14px;color:var(--dim)"> / ${questions.length}</small></b></div></div>
      </div>
      <aside class="now-card" aria-label="What should I do now">
        <div class="t-kick gold">What should I do now?</div>
        <h2>${now.title}</h2>
        <p>${now.body}</p>
        <ol class="plan">${now.plan.map((p, i) => `<li><i>${i + 1}</i>${p}</li>`).join('')}</ol>
        ${state.mentorPriority ? `<div class="t-kick">From your mentor</div><p class="priority">${esc(state.mentorPriority)}</p>` : ''}
        <a class="btn btn-primary" href="${now.href}">${now.cta} ▸</a>
      </aside>
    </section>
    <section class="goal-grid" aria-label="Four goals">
      <a class="goal-tile" href="#/practice"><img src="/iv-prep-on-call/assets/studio/astra-assets/iv-prep-on-call.webp" alt=""><span><strong>Practice an answer</strong><small>One question, recorded privately, debriefed with evidence.</small><b>Pick a question →</b></span></a>
      <a class="goal-tile" href="#/mock"><img src="/iv-prep-on-call/assets/studio/astra-assets/synthetic-candidate.webp" alt=""><span><strong>Mock interview</strong><small>Contextual questions, follow-ups, and practice closing the interview.</small><b>Step into the room →</b></span></a>
      <a class="goal-tile" href="#/prepare"><img src="/iv-prep-on-call/assets/studio/astra-assets/rise.webp" alt=""><span><strong>Prepare for a program</strong><small>What this program will know about you, and what to rehearse.</small><b>Choose a program →</b></span></a>
      <a class="goal-tile" href="#/review"><img src="/iv-prep-on-call/assets/studio/astra-assets/storyforge.webp" alt=""><span><strong>Review &amp; improve</strong><small>Debriefs, Film Room, compare reps, see improvement.</small><b>Open your reps →</b></span></a>
    </section>
    <section class="home-strip">
      <div class="housing strip-card"><header><span class="t-label">Recent reps</span></header>
        ${attempts.length ? attempts.slice(0, 3).map((a) => `<div class="attempt-row"><span class="when">${fmtDate(a.at)}</span><div><strong>${esc(a.questionText)}</strong><small>${a.mode === 'mock' ? 'Mock interview' : 'Practice'} · ${fmtDur(a.durationS)}${a.priorityText ? ` · change: ${esc(a.priorityText)}` : ''}</small></div><a class="btn btn-secondary" href="#/results/${a.id}">Debrief</a></div>`).join('') : '<p class="note">No saved reps yet. Your first debrief appears here.</p>'}
      </div>
      <div class="housing strip-card"><header><span class="t-label">Core 10 practice history</span><span class="t-tech">saved reps</span></header>
        <div class="table-list">${core.slice(0, 5).map((q) => { const m = masteryState(attempts, q.question_id); return `<div class="attempt-row" style="padding:7px 0"><span class="mastery-ring" aria-label="${m.state}">${[1, 2, 3, 4].map((i) => `<i class="${i <= m.segments ? 'on' : ''}"></i>`).join('')}</span><div><strong style="font-size:13px;font-weight:600">${esc(q.canonical_text)}</strong><small>${m.state}${m.reps ? ` · ${m.reps} rep${m.reps > 1 ? 's' : ''}` : ''}</small></div><a class="btn btn-quiet" style="min-height:32px;padding:0 10px;font-size:12.5px" href="#/practice?q=${q.question_id}">Rep</a></div>`; }).join('')}</div>
      </div>
    </section>`;
}

// ---------- PRACTICE: one question (selector drawer for all 193) + sticky dock ----------
async function renderPractice(params, isCurrent = guarded) {
  await Promise.all([controller.library({isCurrent}),hydrateOwnPresentation(isCurrent)]);
  const { questions, store, source, governance } = await ownQuestions(); if (!isCurrent()) return;
  const attempts = attemptsByRecency();
  let selected = params.get('q') || session.questionId || 'CORE-01';
  let retryOf=null;
  if(params.get('retry')){
    const saved=await controller.sessionDetail(params.get('retry'),{isCurrent});if(!isCurrent())return;
    const retry=projectOwnRetry(saved,questions,controller.account.subject);
    if(!retry||retry.intent.launchMode!=='practice')throw new Error('This retry is unavailable or the question changed. Choose a current question from Practice.');
    retryOf=retry.record;selected=retry.intent.question.question_id;
  }
  const draw = () => {
    if (!isCurrent()) return;
    const q = questions.find((x) => x.question_id === selected) || questions[0];
    const m = masteryState(attempts, q.question_id);
    const lastForQ = attempts.find((a) => a.questionId === q.question_id);
    const priority = retryOf?.priorityText || state.mentorPriority || lastForQ?.priorityText || null;
    const core = questions.filter((x) => x.core_priority).slice(0, 10);
    main.innerHTML = `
      <div class="setup" data-screen="practice">
        <div class="screen-head"><div><div class="t-kick gold">Practice an answer</div><h1 class="t-hero">One rep. <em>One priority.</em></h1><p class="t-edit">Pick a question, answer on camera, get a debrief with evidence and the one thing to change.</p></div><span class="t-tech">${`${questions.length} questions`}</span></div>
        <div class="setup-body">
          <section class="housing panel">
            <div class="t-label" style="margin-bottom:8px">This rep</div>
            <div class="tray-row" style="margin-bottom:10px"><span class="n">1</span><span class="txt" style="white-space:normal;font-size:16px">${esc(q.canonical_text)}<small>${(q.tags || []).slice(0, 3).map((t) => CATEGORY_LABELS[t] || t).join(' · ')} · ${m.state}${m.reps ? ` · ${m.reps} rep${m.reps > 1 ? 's' : ''}` : ''}</small></span><span class="tray-actions"><button type="button" class="btn btn-secondary" id="open-selector">Change question</button></span></div>
            <div class="t-label" style="margin:6px 0">Core 10 · quick pick</div>
            <div class="q-list scroll" role="listbox" aria-label="Core questions">${core.map((x) => { const mm = masteryState(attempts, x.question_id); return `<button type="button" class="q-row" role="option" data-q="${x.question_id}" aria-pressed="${x.question_id === q.question_id}"><div><strong>${esc(x.canonical_text)}</strong><small>${mm.state}</small></div><span class="mastery-ring">${[1, 2, 3, 4].map((i) => `<i class="${i <= mm.segments ? 'on' : ''}"></i>`).join('')}</span></button>`; }).join('')}</div>
          </section>
          <aside class="housing panel ready-card" aria-label="Priority">
            <div class="t-kick gold">Priority</div>
            <p class="priority" style="margin:0 0 14px">${priority ? esc(priority) : 'Finish the answer in under 90 seconds.'}</p>
            <ul class="checks" id="ready-checks"><li class="${state.calibration ? 'on' : 'warn'}"><i>${state.calibration ? '✓' : '!'}</i>${state.calibration ? 'Calibrated · signals resolved' : 'Not calibrated yet · instruments use global ranges'}</li><li><i>·</i>Camera and microphone connect in the room</li><li class="${controller.account?.mode === 'REAL' ? 'on' : 'warn'}"><i>${controller.account?.mode === 'REAL' ? '✓' : '!'}</i>${controller.account?.mode === 'REAL' ? 'Saved to your account (candidate-only recording)' : 'Local preview · kept in this browser only'}</li></ul>
            <p class="note">${state.calibration ? '' : '<a href="#/devices">Calibrate first</a> to get personal corridors.'}</p>
          </aside>
        </div>
        <div class="dock"><div class="dock-state"><strong>${esc(q.canonical_text)}</strong><small>${priority ? `Priority on screen: ${esc(priority)}` : m.reps ? `Practice again · ${m.reps} saved rep${m.reps===1?'':'s'}` : 'First rep on this question'}</small></div><div class="dock-actions"><a class="btn btn-quiet" href="#/home">Back</a><button class="btn btn-primary btn-lg" type="button" id="go-room">Enter the room ▸</button></div></div>
      </div>`;
    main.querySelector('.q-list').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; if(selected!==b.dataset.q)retryOf=null;selected = b.dataset.q; session.questionId = selected; draw(); });
    main.querySelector('#open-selector').addEventListener('click', () => { const one = [q]; openSelector({ questions, store, set: one, attempts, single: true, max: 1, onDone: () => { const next=one[0]?.question_id || selected;if(next!==selected)retryOf=null;selected=next;session.questionId = selected; draw(); } }); });
    main.querySelector('#go-room').addEventListener('click', () => { session.mode = 'practice'; session.questionId = q.question_id; session.retryOf = retryOf?.id || null; session.retry = retryOf || null; session.priority = priority; location.hash = '#/room'; });
  };
  draw();
}

// ---------- MOCK SETUP: Selected Question Tray + Easy/Advanced interviewer + sticky action dock ----------
async function renderMock(params, isCurrent = guarded) {
  await Promise.all([controller.library({isCurrent}),hydrateOwnPresentation(isCurrent)]);
  const { questions, store, source, governance } = await ownQuestions(); if (!isCurrent()) return;
  const attempts = attemptsByRecency();
  if(params.get('retry')){
    const saved=await controller.sessionDetail(params.get('retry'),{isCurrent});if(!isCurrent())return;
    const retry=projectOwnRetry(saved,questions,controller.account.subject);
    if(!retry||retry.intent.launchMode!=='ai')throw new Error('This retry is unavailable or the question changed. Choose current questions for a new mock.');
    session.mockSet=[retry.intent.question];session.retry=retry.record;session.retryOf=retry.record.id;
    session.contextSources=retry.intent.wizard.contextSources.slice();session.program=null;
    Object.assign(session.settings,{role:retry.intent.wizard.interviewer,style:retry.intent.wizard.interviewerStyle,
      pressure:retry.intent.wizard.pressurePractice,advanced:true,targetQuestions:1});
  }else{session.retry=null;session.retryOf=null;}
  const useProgram = params.get('program') === '1' && state.program;
  const {buildContextSources} = await import('/iv-prep-on-call/assets/studio/presentation-view-model.mjs');
  const mentor = await controller.durable.mentorPriorities().catch(() => null);
  if (!isCurrent()) return;
  const sources = buildContextSources({mentorPriorities:mentor,durableAvailable:true,contextCapabilities:controller.account.capabilities.contextSources,programVerified:Boolean(useProgram?.verified)});
  session.contextSources = session.contextSources.filter(name => sources.some(s => s.name===name && s.available));
  let storyRevealed = false, contextOpen = false;
  if (!session.mockSet) session.mockSet = defaultMockSet(questions, session.settings.targetQuestions || 5);
  const set = session.mockSet;
  const st = session.settings;
  const cfg = session.config;
  const draw = () => {
    if (!isCurrent()) return;
    contextOpen = main.querySelector('#interview-context')?.open ?? contextOpen;
    const preset = EASY_PRESETS.find((p) => p.id === st.preset) || EASY_PRESETS[0];
    main.innerHTML = `
      <div class="setup" data-screen="mock">
        <div class="screen-head"><div><div class="t-kick gold">Mock interview</div><h1 class="t-hero">Step into <em>the room.</em></h1><p class="t-edit">A spoken interview with contextual follow-ups. Choose "Wrap up" to practice asking your own questions and closing professionally.</p></div><span class="t-tech">${questions.length} questions</span></div>
        <div class="setup-body">
          <section class="housing panel">
            <div class="t-label" style="margin-bottom:8px">Your interview · ${set.length} questions</div>
            ${trayMarkup(set)}
          </section>
          <aside class="housing panel ready-card">
            <div class="t-kick gold">Interviewer</div>
            <div class="preset-row" role="group" aria-label="Easy mode">${EASY_PRESETS.map((p) => `<button type="button" class="option" data-preset="${p.id}" aria-pressed="${st.preset === p.id && !st.advanced}">${p.label}<small>${p.hint}</small></button>`).join('')}</div>
            <details class="advanced" id="advanced" ${st.advanced ? 'open' : ''}><summary><span>Advanced interviewer settings</span><span>${st.advanced ? 'on' : 'collapsed'}</span></summary>
              <div class="advanced-body">
                <div class="field"><label class="t-label" for="adv-role">Role</label><select id="adv-role">${ROLES.map((r) => `<option ${st.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
                <div class="field"><label class="t-label" for="adv-style">Style</label><select id="adv-style">${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${st.style === k ? 'selected' : ''}>${k} · ${v}</option>`).join('')}</select></div>
                <div class="field"><label class="t-label">Follow-up depth</label><div class="seg">${[0, 1, 2].map((d) => `<button type="button" data-depth="${d}" aria-pressed="${st.depth === d}">${d === 0 ? 'None' : d === 1 ? 'One' : 'Two'}</button>`).join('')}</div></div>
                <div class="field"><label class="t-label">Curiosity</label><div class="seg">${CURIOSITY.map((c) => `<button type="button" data-curiosity="${c}" aria-pressed="${st.curiosity === c}">${c}</button>`).join('')}</div></div>
                <div class="field"><label class="t-label">Pressure</label><div class="seg"><button type="button" data-pressure="0" aria-pressed="${!st.pressure}">Off</button><button type="button" data-pressure="1" aria-pressed="${st.pressure}">On</button></div></div>
                <div class="field"><label class="t-label">Interruption</label><div class="seg"><button type="button" data-interrupt="0" aria-pressed="${!st.interruption}">Never</button><button type="button" data-interrupt="1" aria-pressed="${st.interruption}">Long answers</button></div></div>
                <div class="field"><label class="t-label">Pacing</label><div class="seg">${PACING.map((c) => `<button type="button" data-pacing="${c}" aria-pressed="${st.pacing === c}">${c}</button>`).join('')}</div></div>
                <div class="field"><label class="t-label" for="adv-max">Follow-up limit</label><input id="adv-max" type="number" min="0" max="8" value="${st.maxFollowUps}"></div>
                <div class="field"><label class="t-label">Program emphasis</label><div class="seg">${['Light', 'Normal', 'Strong'].map((c) => `<button type="button" data-emphasis="${c}" aria-pressed="${st.programEmphasis === c}">${c}</button>`).join('')}</div></div>
                <div class="field" style="grid-column:1/-1"><small class="note">The interviewer is instructed to invite your questions and sign off. Choose "Wrap up" when you are ready for this part of the interview. Voice is managed by your account.</small></div>
              </div>
            </details>
<details class="advanced" id="interview-context" ${contextOpen?'open':''} style="margin-top:12px"><summary><span>Interview context</span><span>choose</span></summary><div class="advanced-body"><p class="note" style="grid-column:1/-1">Only the sources you choose are checked for this interview. Missing or unauthorized information stays unavailable.</p>${sources.filter(s=>s.name!=='RISE'&&s.name!=='StoryForge'&&s.name!=='File Vault').map(s=>`<label class="field"><span><input type="checkbox" data-context="${s.name}" ${session.contextSources.includes(s.name)?'checked':''} ${s.available?'':'disabled'}> ${esc(s.name)}</span><small class="note">${s.available?esc(s.detail):'Not connected'}</small></label>`).join('')}<div style="grid-column:1/-1"><button class="btn btn-secondary" type="button" id="story-reveal" ${sources.find(s=>s.name==='StoryForge')?.available?'':'disabled'}>Show StoryForge suggestions</button>${storyRevealed?`<p class="note">Only approved matching story summaries may be included. Showing this option does not include them.</p><label><input type="checkbox" data-context="StoryForge" ${session.contextSources.includes('StoryForge')?'checked':''}> Include authorized matching stories in this interview</label>`:''}<p class="note"><a href="/iv-prep-on-call/advanced/#newsession">Manage application facts / update CV</a></p></div></div></details>
            <div class="t-label" style="margin:12px 0 6px">Length</div>
            <div class="option-row">${[5, 15, 25].map((m) => `<button type="button" class="option" data-min="${m}" aria-pressed="${cfg.durationMin === m}">${m} min<small>approximate session length</small></button>`).join('')}</div>
            <ul class="checks" style="margin-top:12px"><li class="${state.calibration ? 'on' : 'warn'}"><i>${state.calibration ? '✓' : '!'}</i>${state.calibration ? 'Calibrated' : 'Not calibrated · global ranges'}</li><li class="${useProgram ? 'on' : ''}"><i>${useProgram ? '✓' : '·'}</i>${useProgram ? `Program: ${esc(state.program.name)}` : 'No program context (general interview)'}</li><li class="${controller.account?.mode === 'REAL' ? 'on' : 'warn'}"><i>${controller.account?.mode === 'REAL' ? '✓' : '!'}</i>${controller.account?.mode === 'REAL' ? (controller.account.liveInterviewAvailable ? 'GPT-Live interviewer · saved to your account' : 'Live interviewer unavailable · choose Self Practice') : 'Sign in through Matrix'}</li></ul>
          </aside>
        </div>
        <div class="dock" id="dock"><div class="dock-state"><strong>${set.length} questions · ${esc(describeSettings(st))}</strong><small>Camera and mic connect inside the room. "Wrap up" still asks the closing question.</small></div><div class="dock-actions"><a class="btn btn-quiet" href="#/home">Back</a><button class="btn btn-primary btn-lg" type="button" id="go-room" ${set.length && controller.account?.liveInterviewAvailable ? '' : 'disabled'}>Enter the Interview Room ▸</button></div></div>
      </div>`;
    const questionsChanged=()=>{if(session.retry&&(set.length!==1||set[0]?.question_id!==session.retry.questionId)){session.retry=null;session.retryOf=null;}draw();};
    mountTray(main.querySelector('#tray'), set, { onChange: questionsChanged });
    main.querySelector('#open-selector').addEventListener('click', () => openSelector({ questions, store, set, attempts, onDone: questionsChanged }));
    main.querySelector('#go-room').addEventListener('click', () => { session.mode = 'mock'; session.program = useProgram ? state.program : null; location.hash = '#/room'; });
    main.querySelector('#story-reveal').addEventListener('click', () => { storyRevealed = true; draw(); });
    main.querySelectorAll('[data-context]').forEach(input=>input.addEventListener('change',()=>{session.contextSources=input.checked?[...new Set([...session.contextSources,input.dataset.context])]:session.contextSources.filter(name=>name!==input.dataset.context);}));
    main.querySelector('#advanced').addEventListener('toggle', (e) => { st.advanced = e.target.open; main.querySelector('#advanced summary span:last-child').textContent = st.advanced ? 'on' : 'collapsed'; });
    main.querySelector('#adv-role').addEventListener('change', (e) => { st.role = e.target.value; });
    main.querySelector('#adv-style').addEventListener('change', (e) => { st.style = e.target.value; });
    main.querySelector('#adv-max').addEventListener('change', (e) => { st.maxFollowUps = Math.max(0, Math.min(8, Number(e.target.value) || 0)); });
    main.querySelector('.ready-card').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.id === 'go-room') return;
      if (b.dataset.preset) { Object.assign(st, applyPreset(st, b.dataset.preset)); st.advanced = false; }
      else if (b.dataset.depth != null) st.depth = Number(b.dataset.depth);
      else if (b.dataset.curiosity) st.curiosity = b.dataset.curiosity;
      else if (b.dataset.pressure != null) st.pressure = b.dataset.pressure === '1';
      else if (b.dataset.interrupt != null) st.interruption = b.dataset.interrupt === '1';
      else if (b.dataset.pacing) st.pacing = b.dataset.pacing;
      else if (b.dataset.emphasis) st.programEmphasis = b.dataset.emphasis;
      else if (b.dataset.min) cfg.durationMin = Number(b.dataset.min);
      else return;
      draw();
    });
  };
  draw();
}

// ---------- PREPARE FOR A PROGRAM ----------
async function renderPrepare(isCurrent = guarded) {
  const {questions}=await loadQuestions();if(!isCurrent())return;
  let filters={q:'',specialty:'',jurisdiction:'',programType:'',page:1},result={rows:[],total:0,page:1,totalPages:0},querySequence=0,error=null;
  const draw=()=>{
    if(!isCurrent())return;const p=state.program;
    const fit=questions.filter(q=>(q.tags||[]).some(t=>['PROGRAM_FIT','MOTIVATION','SPECIALTY'].includes(t))).slice(0,4);
    main.innerHTML=`<div class="screen-head"><div><div class="t-kick gold">Prepare for a program</div><h1 class="t-hero">Know <em>the room.</em></h1><p class="t-edit">Search RISE, select your program, and rehearse with verified interview context.</p></div><a class="btn btn-quiet" href="#/home">Back</a></div>
    <div class="two-col program-prepare"><section class="housing panel"><form id="program-form"><label class="t-label" for="program-search">Find your program</label><input class="search" id="program-search" type="search" placeholder="Program name, city or specialty" value="${esc(filters.q)}"><div class="two-col" style="margin:12px 0"><label class="field">Specialty<input type="text" name="specialty" value="${esc(filters.specialty)}" placeholder="All specialties"></label><label class="field">State<input type="text" name="jurisdiction" value="${esc(filters.jurisdiction)}" placeholder="All states"></label><label class="field">Program type<input type="text" name="programType" value="${esc(filters.programType)}" placeholder="All program types"></label></div><button type="submit" class="btn btn-primary">Search programs ▸</button></form>
    <p class="note" role="status" id="search-state">${error?esc(error):result.total+' verified results'}</p><div class="q-list" style="margin-top:12px">${result.rows.map(pr=>`<button type="button" class="q-row" data-program="${esc(pr.id)}" aria-pressed="${p?.id===pr.id}"><div><strong>${esc(pr.name)}</strong><small>${esc(pr.city)} · ${esc(pr.specialty)}</small></div><span class="chip ok">Verified identity</span></button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-secondary" id="prev-page" ${result.page>1?'':'disabled'}>Previous</button><span class="note">Page ${result.page} / ${Math.max(1,result.totalPages)}</span><button type="button" class="btn btn-secondary" id="next-page" ${result.page<result.totalPages?'':'disabled'}>Next</button></div>
    ${p?`<div class="program-card"><div class="t-label">Selected program</div><h3>${esc(p.name)}</h3><p class="note">RISE identity and release retained. Available verified intelligence is checked when your interview starts. Missing leadership or program facts are not invented.</p><a class="btn btn-secondary" target="_blank" rel="noopener" href="https://missionmedinstitute.com/member-dashboard/">Open RISE from Matrix</a></div>`:''}
    </section><aside class="housing panel ready-card"><div class="t-kick gold">Rehearse for your program</div><div class="q-list" style="margin:12px 0">${fit.map(q=>`<a class="q-row" href="#/practice?q=${q.question_id}"><strong>${esc(q.canonical_text)}</strong></a>`).join('')}</div><button class="btn btn-primary btn-lg" type="button" id="program-mock" ${p?.verified&&controller.account.liveInterviewAvailable?'':'disabled'}>Program mock ▸</button><p class="note">${p?.verified?'Your interview uses only authorized program intelligence.':'Choose a verified program first.'}</p><a class="btn btn-quiet" href="#/mock">General mock instead</a></aside></div>`;
    main.querySelector('#program-form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;filters={q:form.querySelector('#program-search').value,specialty:form.elements.specialty.value,jurisdiction:form.elements.jurisdiction.value,programType:form.elements.programType.value,page:1};state.program=null;commit();void search();};
    main.querySelectorAll('[data-program]').forEach(b=>b.onclick=()=>{const pr=result.rows.find(x=>x.id===b.dataset.program);if(!pr?.verified)return;state.program={...pr,fixture:false};commit();draw();});
    main.querySelector('#program-mock').onclick=()=>{if(state.program?.verified)location.hash='#/mock?program=1';};
    main.querySelector('#prev-page').onclick=()=>{filters.page=Math.max(1,filters.page-1);void search();};
    main.querySelector('#next-page').onclick=()=>{filters.page++;void search();};
  };
  async function search(){const ticket=++querySequence;const status=main.querySelector('#search-state');if(status)status.textContent='Searching RISE…';try{const found=await searchPrograms(controller.account,filters);if(!isCurrent()||ticket!==querySequence)return;result=found;error=null;}catch(cause){if(!isCurrent()||ticket!==querySequence)return;result={rows:[],page:1,total:0,totalPages:0};error='Verified program search is unavailable for this account right now. You can still run a general interview.';}draw();}
  draw();await search();
}
// ---------- REVIEW & IMPROVE ----------
async function renderReview(isCurrent = guarded) {
  const lib = await controller.library({isCurrent}); if (!isCurrent()) return;
  const attempts = lib.attempts.slice().sort((a, b) => b.at - a.at);
  const latest = attempts[0];
  main.innerHTML = `
    <div class="screen-head"><div><div class="t-kick gold">Review &amp; improve</div><h1 class="t-hero">What <em>changed?</em></h1><p class="t-edit">Your latest debrief first. Open the Film Room, compare two reps on the same question, and see your progress over time.</p></div><div class="review-actions"><span class="t-tech">${lib.source === 'account' ? 'Private account history' : 'History unavailable'}</span><a class="btn btn-secondary" href="#/progress">Progress</a></div></div>
    ${latest ? `<section class="housing panel latest-debrief"><div><div class="t-label">Latest debrief</div><div class="t-edit-lg" style="margin:6px 0">${esc(latest.questionText)}</div><div class="note">${latest.mode === 'mock' ? 'Mock interview' : 'Practice'} · ${fmtDate(latest.at)} · ${fmtDur(latest.durationS)}${latest.priorityText ? ` · the one thing to change: ${esc(latest.priorityText)}` : ''}</div></div><a class="btn btn-primary" href="#/results/${latest.id}">Open debrief ▸</a></section>` : '<section class="housing panel"><p class="t-edit">No saved reps yet. <a href="#/practice">Practice one answer</a> to get your first debrief.</p></section>'}
    <section class="housing panel"><div class="t-label" style="margin-bottom:8px">All reps</div>
      ${attempts.map((a) => { const same = attempts.find(x=>x.at<a.at&&canCompareAttempts(attemptSnapshot(x.remote),attemptSnapshot(a.remote))); return `<div class="attempt-row"><span class="when">${fmtDate(a.at)}</span><div><strong>${esc(a.questionText)}</strong><small>${a.mode === 'mock' ? 'Mock interview' : 'Practice'} · ${fmtDur(a.durationS)} · account${a.priorityText ? ` · change: ${esc(a.priorityText)}` : ''}</small></div><div class="attempt-actions"><a class="btn btn-secondary" href="#/results/${a.id}">Debrief</a><a class="btn btn-quiet" href="#/film/${a.id}">Film Room</a>${same ? `<a class="btn btn-quiet" href="#/compare/${same.id}/${a.id}">Compare</a>` : ''}</div></div>`; }).join('') || '<p class="note">Nothing saved yet.</p>'}
    </section>`;
}

// ---------- PROGRESS ----------
async function renderProgress(isCurrent = guarded) {
  const lib = await controller.library({isCurrent});
  const {buildLongitudinalModel} = await import("/iv-prep-on-call/assets/studio/longitudinal-model.mjs");
  const longitudinal = buildLongitudinalModel(lib.sessions.filter(row=>row.ownerSubject===controller.account.subject));
  const { questions } = await loadQuestions(); if (!isCurrent()) return;
  const attempts = attemptsByRecency();
  const core = questions.filter((q) => q.core_priority).slice(0, 10);
  const hooksTaken = attempts.reduce((n, a) => n + (a.hooks || []).filter((h) => h.taken).length, 0);
  const hooksLeft = attempts.reduce((n, a) => n + (a.hooks || []).length, 0);
  const closes = attempts.filter((a) => a.mode === 'mock'); const closed = closes.filter((a) => a.closing?.status === 'delivered' || a.closing?.status === 'local').length;
  main.innerHTML = `
    <div class="screen-head"><div><div class="t-kick gold">Progress</div><h1 class="t-hero">Earned, <em>not farmed.</em></h1><p class="t-edit">Every number here comes from a saved rep. Nothing is seeded, awarded or estimated.</p></div></div>
    <div class="progress-grid">
      <div class="housing panel"><div class="t-label">Day streak</div><div class="streak">${streak(attempts)}</div><p class="note">Consecutive days with at least one saved rep. Missing a day resets it. ${longitudinal.totals.activeDays} total active days.</p></div>
      <div class="housing panel"><div class="t-label">Reps</div><div class="streak">${attempts.length}</div><p class="note">${attempts.filter((a) => a.mode === 'mock').length} mock interviews · ${attempts.filter((a) => a.mode !== 'mock').length} practice reps</p></div>
      <div class="housing panel"><div class="t-label">Hooks taken</div><div class="streak">${hooksTaken}<span style="font-size:22px;color:var(--dim)"> / ${hooksLeft}</span></div><p class="note">Hooks you left in mocks that the interviewer followed.</p></div>
      <div class="housing panel"><div class="t-label">Closings reached</div><div class="streak">${closed}<span style="font-size:22px;color:var(--dim)"> / ${closes.length}</span></div><p class="note">Mocks that reached "Do you have any questions for me?"</p></div>
    </div>
    <section class="housing panel" style="margin-top:16px"><div class="t-label" style="margin-bottom:10px">Core 10 practice history</div>
      <div class="mastery-list">${core.map((q) => { const m = masteryState(attempts, q.question_id); return `<div class="mastery-row"><span>${esc(q.canonical_text)}</span><span class="mastery-ring">${[1, 2, 3, 4].map((i) => `<i class="${i <= m.segments ? 'on' : ''}"></i>`).join('')}</span><span class="state">${m.state}${m.reps ? ` · ${m.reps}` : ''}</span></div>`; }).join('')}</div>
      <p class="note" style="margin-top:10px">Unpracticed → Attempted (1) → Rehearsed (2+). Not recent means no saved rep in 21 days. Rings show rep coverage, not mastery, readiness, or proof that a priority was corrected.</p>
    </section>`;
}

// ---------- Router ----------
async function route() {
  if(revertingHash){revertingHash=false;return;}
  if(controller.navigationLocked && location.hash!==acceptedHash){revertingHash=true;location.hash=acceptedHash;return;}
  const ticket=++generation,isCurrent=()=>ticket===generation;
  if(teardown){teardown();teardown=null;}
  const hash=location.hash||'#/home';acceptedHash=hash;
  const [path,query]=hash.replace(/^#\/?/,'').split('?'),parts=path.split('/'),name=parts[0]||'home',params=new URLSearchParams(query||'');
  setRoute(['results','film','compare','progress'].includes(name)?'review':name);
  main.scrollTop=0;window.scrollTo(0,0);
  main.innerHTML='<section class="housing panel" role="status"><p class="t-edit">Opening your workspace…</p></section>';
  try{
    if(!controller.account)throw new Error('Sign in through Matrix to continue.');
    if(name==='home')await renderHome(isCurrent);
    else if(name==='practice')await renderPractice(params,isCurrent);
    else if(name==='mock')await renderMock(params,isCurrent);
    else if(name==='prepare')await renderPrepare(isCurrent);
    else if(name==='review')await renderReview(isCurrent);
    else if(name==='progress')await renderProgress(isCurrent);
    else if(name==='bait-lab') {
      const account=controller.account,fresh=await account.api.bootstrap();
      if(!isCurrent()||controller.account!==account)return;
      if(account.role!=='admin'||fresh.identity?.subject!==account.subject||fresh.identity.admin!==true||fresh.entitlement?.admitted!==true)throw new Error('This QA tool requires your current Admin account.');
      const {mountBaitLab}=await import('./bait-lab.mjs');
      if(isCurrent())teardown=await mountBaitLab(main,{controller,isCurrent});
    }
    else if(['devices','room','results','film','compare'].includes(name)) {
      if(name==='devices'||name==='room')await hydrateOwnPresentation(isCurrent);
      if(!isCurrent())return;
      const cleanup=await (name==='devices'?mountCalibration(main,{isCurrent}):name==='room'?mountRoom(main,{session,isCurrent}):name==='results'?mountResults(main,parts[1],{isCurrent}):name==='film'?mountFilm(main,parts[1],params,{isCurrent}):mountCompare(main,parts[1],parts[2],{isCurrent}));
      if(isCurrent())teardown=cleanup;else cleanup?.();
    }
    else location.hash='#/home';
  }catch(error){if(!isCurrent())return;main.innerHTML='<section class="housing panel"><div class="t-kick">Unable to continue</div><p class="t-edit">'+esc(error.message)+'</p><a class="btn btn-secondary" href="#/home">Back to Home</a><a class="btn btn-quiet" href="https://missionmedinstitute.com/member-dashboard/">Return to Matrix</a></section>';}
  if(!isCurrent())return;
  const target=main.querySelector('h1');if(target&&name!=='room')target.setAttribute('tabindex','-1');
}
document.getElementById('menu-toggle').addEventListener('click', (e) => { const g = document.getElementById('rail-nav'); const open = g.dataset.open !== 'true'; g.dataset.open = String(open); e.currentTarget.setAttribute('aria-expanded', String(open)); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const g = document.getElementById('rail-nav'); if (g.dataset.open === 'true') { g.dataset.open = 'false'; document.getElementById('menu-toggle').focus(); } } });
addEventListener('hashchange', route);
controller.addEventListener('account', (e) => renderIdentity(e.detail));
// A failed admission never becomes local/demo mode.
controller.connectAccount().then(account=>{
  renderIdentity(account);
  document.querySelectorAll('[data-admin-link]').forEach(link=>{link.hidden=account.role!=='admin';});
  void route();
}).catch(error=>{
  renderIdentity(null);
  document.querySelectorAll('[data-admin-link]').forEach(link=>{link.hidden=true;});
  main.innerHTML='<section class="housing panel"><h1 class="t-h2">Sign in through Matrix</h1><p class="t-edit">'+esc(error.message)+'</p><a class="btn btn-primary" href="https://missionmedinstitute.com/member-dashboard/">Open MissionMed Matrix ▸</a></section>';
});
