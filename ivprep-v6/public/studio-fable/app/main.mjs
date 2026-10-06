// IVOC Fable 5.1 Dream Experience — app shell and goal screens.
// Routes: #/home #/practice #/mock #/prepare #/review #/devices #/room #/results/:id #/film/:id #/compare/:a/:b #/progress
import { state, commit, attemptsByRecency } from './state.mjs';
import { loadQuestions, CATEGORY_LABELS, defaultMockSet } from './questions.mjs';
import { trayMarkup, mountTray, openSelector } from './questions/selector.mjs';
import { EASY_PRESETS, PRACTICE_GOALS, ROLES, STYLES, CURIOSITY, PACING, defaultSettings, applyPreset, normalizeMockPracticeFocus, normalizeManualInterviewerName, resolveMockQuestionTarget, resolveFollowUpPreferences, describe as describeSettings } from './settings/interviewer.mjs';
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
import { filterOwnAttempts, ownHistoryProgress, formatHistoryEvidence } from './adapters/history-view-model.mjs';
import {readOwnCalendar,calendarHomeAction} from './adapters/calendar-view-model.mjs';
import {ENVIRONMENTS,normalizeEnvironment,selectedEnvironment,environmentChoicesMarkup} from './adapters/environment-profile.mjs';
import {legacyPresentationEntry} from './adapters/product-entry.mjs';

const main = document.getElementById('main');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (ms) => Number.isFinite(ms)?new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }):'Date unavailable';
const fmtDur = (s) => Number.isFinite(s)?`${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`:'Duration unavailable';
export const session = { questionId: null, mode: null, mockSet: null, config: { targetQuestions: null, style: 'Owl', pressure: false, durationMin: 15, maxDepth: 1 }, settings: defaultSettings(), program: null, retryOf: null, retry: null, priority: null, contextSources: [] };
let teardown = null;
let generation = 0, acceptedHash = '#/home', revertingHash = false;
const guarded = () => true;
const ownQuestions = (account=controller.account) => loadQuestions({account,attempts:state.attempts,favorites:state.preferences.favoriteQuestions});
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
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  const current=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&account?.subject===subject;
  const calendarPending=readOwnCalendar(controller,{isCurrent:current});
  await Promise.all([controller.library({isCurrent:current}),hydrateOwnPresentation(current)]);
  if(!current())return;
  const { questions } = await ownQuestions(account); if (!current()) return;
  const attempts = attemptsByRecency();
  const last = attempts[0] || null;
  const daysSince = last ? Math.floor((Date.now() - last.at) / 86_400_000) : null;
  const selectedProgram=state.program;
  let now;
  if (!attempts.length) now = { kick: 'Start here', title: 'One answer. Five minutes.', body: 'Record "Tell me about yourself" once, privately. You get a debrief with evidence and the one thing to change next.', cta: 'Practice this question', href: '#/practice?q=CORE-01', plan: ['Pick the question (preselected)', 'Quick readiness check', 'Answer on camera', 'Debrief with evidence'] };
  else if (selectedProgram?.verified) now = { title: 'Run a program mock.', body: `Rehearse for your selected program, ${esc(selectedProgram.name)}. Authorized intelligence is checked when you start.`, cta: 'Start program mock', href: '#/mock?program=1', plan: ['Selected program retained', 'Readiness check', 'Interview Room', 'Results and Film Room'] };
  else if (last && last.debriefLane && daysSince < 7) now = { kick: 'Your next rep', title: 'Retry and clear the priority.', body: `Last time on "${esc(last.questionText)}" the one thing to change was ${esc(String(last.priorityText || last.debriefLane).replace(/[.\s]+$/, ''))}. Retry the same question with that priority on screen.`, cta: 'Retry this question', href: `#/${last.mode==='mock'?'mock':'practice'}?q=${encodeURIComponent(last.questionId)}&retry=${last.id}`, plan: ['Same question', 'Priority on screen while you answer', 'Compare the two reps'] };
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
  // Optional owner timing never holds Home or the core launch actions hostage.
  void calendarPending.then(calendar=>{
    if(!current())return;const next=calendarHomeAction(calendar);if(!next)return;
    const card=main.querySelector('.now-card');if(!card)return;
    card.querySelector('h2').textContent=next.title;card.querySelector('p').textContent=next.body;
    card.querySelector('ol').innerHTML=next.plan.map((text,index)=>'<li><i>'+(index+1)+'</i>'+esc(text)+'</li>').join('');
    for(const link of [card.querySelector('.btn-primary'),main.querySelector('.hero-actions .btn-primary')]){link.href=next.href;link.textContent=next.cta+' ▸';}
  });
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
    main.querySelector('#go-room').addEventListener('click', () => { session.mode = 'practice'; session.questionId = q.question_id; session.retryOf = retryOf?.id || null; session.retry = retryOf || null; session.priority = priority; location.hash = '#/room?mode=practice'; });
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
    session.config.targetQuestions=null; // single-question Retry follows its pool; a later pool edit is a new mock
    Object.assign(session.settings,{goal:retry.intent.wizard.goal,practiceFocus:'',role:retry.intent.wizard.interviewer,style:retry.intent.wizard.interviewerStyle,
      pressure:retry.intent.wizard.pressurePractice,environment:normalizeEnvironment(retry.intent.wizard.environment),advanced:true,targetQuestions:1});
  }else{session.retry=null;session.retryOf=null;}
  session.priority = session.retry?.priorityText || state.mentorPriority || null;
  const useProgram = params.get('program') === '1' && state.program;
  const {buildContextSources} = await import('/iv-prep-on-call/assets/studio/presentation-view-model.mjs');
  const mentor = await controller.durable.mentorPriorities().catch(() => null);
  if (!isCurrent()) return;
  const sources = buildContextSources({mentorPriorities:mentor,durableAvailable:true,contextCapabilities:controller.account.capabilities.contextSources,programVerified:Boolean(useProgram?.verified)});
  session.contextSources = session.contextSources.filter(name => sources.some(s => s.name===name && s.available));
  let storyRevealed = false, contextOpen = false, environmentOpen = false;
  if (!session.mockSet) session.mockSet = defaultMockSet(questions, session.settings.targetQuestions || 5);
  const set = session.mockSet;
  const st = session.settings;
  const cfg = session.config;
  const draw = () => {
    if (!isCurrent()) return;
    const policy=controller.interviewPolicy;
    if(policy&&st.policyVersion==null){st.depth=policy.defaultFollowUpDepth;st.pressure=st.goal!=='Individual Question'&&policy.defaultPressureEnabled;}
    if(policy)st.policyVersion=policy.version;
    Object.assign(st,resolveFollowUpPreferences(st,policy));
    const targetQuestions = resolveMockQuestionTarget(cfg.targetQuestions, set.length, {goal:st.goal});
    st.targetQuestions = targetQuestions;
    contextOpen = main.querySelector('#interview-context')?.open ?? contextOpen;
    environmentOpen = main.querySelector('#interview-environment')?.open ?? environmentOpen;
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
            <div class="preset-row" role="group" aria-label="Easy mode">${EASY_PRESETS.map((p) => `<button type="button" class="option" data-preset="${p.id}" aria-pressed="${st.preset === p.id && !st.advanced}">${p.label}<small>${policy?esc(describeSettings({...applyPreset(st,p.id,{interviewPolicy:policy}),advanced:false},{interviewPolicy:policy})):p.hint}</small></button>`).join('')}</div>
            <details class="advanced" id="advanced" ${st.advanced ? 'open' : ''}><summary><span>Advanced interviewer settings</span><span>${st.advanced ? 'on' : 'collapsed'}</span></summary>
              <div class="advanced-body">
                <div class="field"><label class="t-label" for="adv-goal">Practice goal</label><select id="adv-goal">${PRACTICE_GOALS.map(goal => `<option ${st.goal === goal ? 'selected' : ''}>${goal}</option>`).join('')}</select></div>
                <div class="field"><label class="t-label" for="adv-focus">Coaching focus</label><input id="adv-focus" type="text" maxlength="200" ${st.goal === 'Guided Mock IV Practice' ? '' : 'disabled'} placeholder="One thing you want to practice" value="${esc(st.practiceFocus || '')}"><small class="note">${st.goal === 'Guided Mock IV Practice' && !st.practiceFocus && session.priority ? `Current priority: ${esc(session.priority.slice(0,200))}. Add your own focus to replace it.` : 'Optional for Guided Practice. Full Simulation and Individual Question do not use a coaching focus.'}</small></div>
                <div class="field"><label class="t-label" for="adv-role">Role</label><select id="adv-role">${ROLES.map((r) => `<option ${st.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
                <div class="field"><label class="t-label" for="adv-name">Interviewer name (optional)</label><input id="adv-name" type="text" maxlength="100" value="${esc(st.interviewerName || '')}" placeholder="A name you want to practice using" aria-describedby="name-note"><small class="note" id="name-note">Manually supplied for practice, not verified faculty identity.</small></div>
                <label class="field"><span><input id="adv-name-use" type="checkbox" ${st.nameUseCoaching===true?'checked':''}> Observe possible name mentions</span><small class="note">Off by default. Uses verified saved candidate transcript when available, not a rapport score. Requires the optional name above.</small></label>
                <div class="field"><label class="t-label" for="adv-style">Style</label><select id="adv-style">${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${st.style === k ? 'selected' : ''}>${k} · ${v}</option>`).join('')}</select></div>
                <div class="field"><label class="t-label">Follow-up depth</label><div class="seg">${[0, 1, 2].map((d) => `<button type="button" data-depth="${d}" aria-pressed="${st.depth === d}" ${policy&&d>policy.maxFollowUpsPerAnswer?'disabled':''}>${d === 0 ? 'None' : d === 1 ? 'One' : 'Two'}</button>`).join('')}</div>${policy?`<small class="note">Your account allows up to ${policy.maxFollowUpsPerAnswer} follow-up${policy.maxFollowUpsPerAnswer === 1 ? '' : 's'} per answer.</small>`:''}</div>
                <div class="field"><label class="t-label">Curiosity</label><div class="seg">${CURIOSITY.map((c) => `<button type="button" data-curiosity="${c}" aria-pressed="${st.curiosity === c}">${c}</button>`).join('')}</div></div>
                <div class="field"><label class="t-label">Pressure</label><div class="seg"><button type="button" data-pressure="0" aria-pressed="${!st.pressure}">Off</button><button type="button" data-pressure="1" aria-pressed="${st.pressure}" ${st.goal === 'Individual Question' ? 'disabled' : ''}>On</button></div></div>
                <div class="field"><label class="t-label">Interruption</label><div class="seg"><button type="button" data-interrupt="0" aria-pressed="${!st.interruption}">Never</button><button type="button" data-interrupt="1" aria-pressed="${st.interruption}">Long answers</button></div></div>
                <div class="field"><label class="t-label">Pacing</label><div class="seg">${PACING.map((c) => `<button type="button" data-pacing="${c}" aria-pressed="${st.pacing === c}">${c}</button>`).join('')}</div></div>
                <div class="field"><label class="t-label" for="adv-max">Follow-up limit</label><input id="adv-max" type="number" min="0" max="8" value="${st.maxFollowUps}" ${policy?.maxFollowUpsPerAnswer===0?'disabled':''}></div>
                <div class="field"><label class="t-label" for="adv-target">Target questions</label><input id="adv-target" type="number" min="1" max="30" step="1" value="${targetQuestions}" ${st.goal === 'Individual Question' ? 'disabled' : ''} aria-describedby="target-note"><small class="note" id="target-note">${st.goal === 'Individual Question' ? 'One selected question, without pressure practice.' : '1–30 main questions. Your selected pool guides the interview; follow-ups and closing questions are additional.'}</small></div>
                <div class="field"><label class="t-label">Program emphasis</label><div class="seg">${['Light', 'Normal', 'Strong'].map((c) => `<button type="button" data-emphasis="${c}" aria-pressed="${st.programEmphasis === c}">${c}</button>`).join('')}</div></div>
                <div class="field" style="grid-column:1/-1"><small class="note">The interviewer is instructed to invite your questions and sign off. Choose "Wrap up" when you are ready for this part of the interview. Voice is managed by your account.</small></div>
              </div>
            </details>
<details class="advanced" id="interview-context" ${contextOpen?'open':''} style="margin-top:12px"><summary><span>Interview context</span><span>choose</span></summary><div class="advanced-body"><p class="note" style="grid-column:1/-1">Only the sources you choose are checked for this interview. Missing or unauthorized information stays unavailable.</p>${sources.filter(s=>s.name!=='RISE'&&s.name!=='StoryForge'&&s.name!=='File Vault').map(s=>`<label class="field"><span><input type="checkbox" data-context="${s.name}" ${session.contextSources.includes(s.name)?'checked':''} ${s.available?'':'disabled'}> ${esc(s.name)}</span><small class="note">${s.available?esc(s.detail):'Not connected'}</small></label>`).join('')}<div style="grid-column:1/-1"><button class="btn btn-secondary" type="button" id="story-reveal" ${sources.find(s=>s.name==='StoryForge')?.available?'':'disabled'}>Show StoryForge suggestions</button>${storyRevealed?`<p class="note">Only approved matching story summaries may be included. Showing this option does not include them.</p><label><input type="checkbox" data-context="StoryForge" ${session.contextSources.includes('StoryForge')?'checked':''}> Include authorized matching stories in this interview</label>`:''}<p class="note"><a href="/iv-prep-on-call/advanced/#newsession">Manage application facts / update CV</a></p></div></div></details>
            <details class="advanced" id="interview-environment" ${environmentOpen?'open':''} style="margin-top:12px"><summary><span>Interview environment</span><span>${selectedEnvironment(st,session.retry)}</span></summary><div class="advanced-body">${environmentChoicesMarkup(selectedEnvironment(st,session.retry))}<p class="note" style="grid-column:1/-1">Practice in a familiar meeting layout. These are MissionMed training simulations, not connections to Webex, Zoom, or Teams. Your interviewer and private recording stay the same.</p></div></details>
            <div class="t-label" style="margin:12px 0 6px">Length</div>
            <div class="option-row">${[5, 10, 15, 25].map((m) => `<button type="button" class="option" data-min="${m}" aria-pressed="${cfg.durationMin === m}">${m} min<small>approximate session length</small></button>`).join('')}</div>
            <ul class="checks" style="margin-top:12px"><li class="${state.calibration ? 'on' : 'warn'}"><i>${state.calibration ? '✓' : '!'}</i>${state.calibration ? 'Calibrated' : 'Not calibrated · global ranges'}</li><li class="${useProgram ? 'on' : ''}"><i>${useProgram ? '✓' : '·'}</i>${useProgram ? `Program: ${esc(state.program.name)}` : 'No program context (general interview)'}</li><li class="${controller.account?.mode === 'REAL' ? 'on' : 'warn'}"><i>${controller.account?.mode === 'REAL' ? '✓' : '!'}</i>${controller.account?.mode === 'REAL' ? (controller.account.liveInterviewAvailable ? 'GPT-Live interviewer · saved to your account' : 'Live interviewer unavailable · choose Self Practice') : 'Sign in through Matrix'}</li></ul>
          </aside>
        </div>
        <div class="dock" id="dock"><div class="dock-state"><strong>${targetQuestions === set.length ? `${targetQuestions} questions` : `Target ${targetQuestions} · ${set.length} selected`} · ${esc(describeSettings(st,{interviewPolicy:policy}))}</strong><small>${selectedEnvironment(st,session.retry)}${selectedEnvironment(st,session.retry)==='MissionMed'?'':' simulation'} · Camera and mic connect inside the room. "Wrap up" still asks the closing question.</small></div><div class="dock-actions"><a class="btn btn-quiet" href="#/home">Back</a><button class="btn btn-primary btn-lg" type="button" id="go-room" ${set.length && controller.account?.liveInterviewAvailable ? '' : 'disabled'}>Enter the Interview Room ▸</button></div></div>
      </div>`;
    const questionsChanged=()=>{if(session.retry&&(set.length!==1||set[0]?.question_id!==session.retry.questionId)){session.retry=null;session.retryOf=null;}draw();};
    mountTray(main.querySelector('#tray'), set, { onChange: questionsChanged });
    main.querySelector('#open-selector').addEventListener('click', () => openSelector({ questions, store, set, attempts, onDone: questionsChanged }));
    main.querySelector('#go-room').addEventListener('click', () => { session.mode = 'mock'; session.program = useProgram ? state.program : null; location.hash = '#/room?mode=mock'; });
    main.querySelector('#story-reveal').addEventListener('click', () => { storyRevealed = true; draw(); });
    main.querySelectorAll('[data-context]').forEach(input=>input.addEventListener('change',()=>{session.contextSources=input.checked?[...new Set([...session.contextSources,input.dataset.context])]:session.contextSources.filter(name=>name!==input.dataset.context);}));
    main.querySelector('#advanced').addEventListener('toggle', (e) => { st.advanced = e.target.open; main.querySelector('#advanced summary span:last-child').textContent = st.advanced ? 'on' : 'collapsed'; });
    main.querySelector('#adv-goal').addEventListener('change', (e) => {
      if (!isCurrent() || !PRACTICE_GOALS.includes(e.target.value)) return;
      if (session.retry && session.retry.wizard?.goal !== e.target.value) { session.retry = null; session.retryOf = null; }
      st.goal = e.target.value;
      if (st.goal === 'Individual Question') st.pressure = false;
      draw();
    });
    main.querySelector('#adv-focus').addEventListener('change', (e) => {
      if (!isCurrent() || st.goal !== 'Guided Mock IV Practice') return;
      try {
        const focus = normalizeMockPracticeFocus(e.target.value);
        e.target.setCustomValidity(''); st.practiceFocus = focus; draw();
      } catch {
        e.target.setCustomValidity('Use a single-line practice focus of 200 characters or fewer.'); e.target.reportValidity();
        main.querySelector('#go-room').disabled = true;
      }
    });
    main.querySelector('#adv-role').addEventListener('change', (e) => { st.role = e.target.value; });
    main.querySelector('#adv-name').addEventListener('change', (e) => {
      if(!isCurrent())return;
      try {st.interviewerName=normalizeManualInterviewerName(e.target.value);if(!st.interviewerName)st.nameUseCoaching=false;e.target.setCustomValidity('');draw();}
      catch(error){e.target.setCustomValidity(error.message);e.target.reportValidity();main.querySelector('#go-room').disabled=true;}
    });
    main.querySelector('#adv-name-use').addEventListener('change', (e) => {
      if(!isCurrent())return;
      const input=main.querySelector('#adv-name');
      try {const name=normalizeManualInterviewerName(input.value);if(e.target.checked&&!name)throw new TypeError('Enter the optional name first.');st.interviewerName=name;st.nameUseCoaching=e.target.checked===true;input.setCustomValidity('');draw();}
      catch(error){e.target.checked=false;input.setCustomValidity(error.message);input.reportValidity();}
    });
    main.querySelector('#adv-style').addEventListener('change', (e) => { st.style = e.target.value; });
    main.querySelector('#adv-max').addEventListener('change', (e) => { if(!isCurrent())return;Object.assign(st,resolveFollowUpPreferences({...st,maxFollowUps:e.target.value},policy));draw(); });
    main.querySelector('#adv-target').addEventListener('change', (e) => {
      if (!isCurrent() || st.goal === 'Individual Question') return;
      const target = Number(e.target.value);
      if (!Number.isInteger(target) || target < 1 || target > 30) {
        e.target.value = String(resolveMockQuestionTarget(cfg.targetQuestions, set.length, {goal:st.goal}));
        return;
      }
      if (target !== 1 && session.retry) { session.retry = null; session.retryOf = null; }
      cfg.targetQuestions = target; st.targetQuestions = target; draw();
    });
    main.querySelector('.ready-card').addEventListener('click', (e) => {
      if (!isCurrent()) return;
      const b = e.target.closest('button'); if (!b || b.id === 'go-room') return;
      if (b.dataset.environment) {
        if (!ENVIRONMENTS.includes(b.dataset.environment)) return;
        st.environment = b.dataset.environment;
        if(session.retry && selectedEnvironment(st,session.retry)!==st.environment){session.retry=null;session.retryOf=null;}
      }
      else if (b.dataset.preset) { Object.assign(st, applyPreset(st, b.dataset.preset,{interviewPolicy:policy})); st.advanced = false; }
      else if (b.dataset.depth != null) st.depth = Number(b.dataset.depth);
      else if (b.dataset.curiosity) st.curiosity = b.dataset.curiosity;
      else if (b.dataset.pressure != null) st.pressure = st.goal !== 'Individual Question' && b.dataset.pressure === '1';
      else if (b.dataset.interrupt != null) st.interruption = b.dataset.interrupt === '1';
      else if (b.dataset.pacing) st.pacing = b.dataset.pacing;
      else if (b.dataset.emphasis) st.programEmphasis = b.dataset.emphasis;
      else if (b.dataset.min) {
        const minutes = Number(b.dataset.min);
        if (![5,10,15,25].includes(minutes)) return;
        cfg.durationMin = minutes; st.durationMin = minutes;
      }
      else return;
      draw();
    });
  };
  draw();
}

// ---------- PREPARE FOR A PROGRAM ----------
function calendarMarkup(value){
  if(value?.state==='loading')return '<h3 class="t-h3">Interview calendar</h3><p class="note">Checking your authorized schedule…</p>';
  if(value?.state!=='ready')return '<h3 class="t-h3">Interview calendar unavailable</h3><p class="note">No interview timing was inferred. You can continue preparing for a program.</p>';
  const {projection}=value,next=projection.nextEvent;
  return '<h3 class="t-h3">'+esc(next?next.title:'Calendar connected')+'</h3><p class="note">'+esc(next?new Date(next.startsAt).toLocaleString()+' · '+next.provider.toUpperCase()+' · '+next.status.toUpperCase():projection.eventCount+' authorized appointments · none upcoming.')+'</p>'+(next?'<p class="note">Join details '+(next.joinAvailable?'are available in your connected calendar.':'are not available yet.')+' Select your verified program separately.</p>':'');
}
async function renderPrepare(isCurrent = guarded) {
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  const current=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&account?.subject===subject;
  const {questions}=await loadQuestions({account});if(!current())return;
  let calendar={state:'loading'};
  let filters={q:'',specialty:'',jurisdiction:'',programType:'',page:1},result={rows:[],total:0,page:1,totalPages:0},querySequence=0,error=null,loading=false;
  const draw=()=>{
    if(!current())return;const p=state.program;
    const fit=questions.filter(q=>(q.tags||[]).some(t=>['PROGRAM_FIT','MOTIVATION','SPECIALTY'].includes(t))).slice(0,4);
    main.innerHTML=`<div class="screen-head"><div><div class="t-kick gold">Prepare for a program</div><h1 class="t-hero">Know <em>the room.</em></h1><p class="t-edit">Search RISE, select your program, and rehearse with verified interview context.</p></div><a class="btn btn-quiet" href="#/home">Back</a></div>
    <div class="two-col program-prepare"><section class="housing panel"><form id="program-form"><label class="t-label" for="program-search">Find your program</label><input class="search" id="program-search" type="search" placeholder="Program name, city or specialty" value="${esc(filters.q)}"><div class="two-col" style="margin:12px 0"><label class="field">Specialty<input type="text" name="specialty" value="${esc(filters.specialty)}" placeholder="All specialties"></label><label class="field">State<input type="text" name="jurisdiction" value="${esc(filters.jurisdiction)}" placeholder="All states"></label><label class="field">Program type<input type="text" name="programType" value="${esc(filters.programType)}" placeholder="All program types"></label></div><button type="submit" class="btn btn-primary">Search programs ▸</button></form>
    <p class="note" role="status" id="search-state">${loading?'Searching RISE…':error?esc(error):result.total+' verified results'}</p><div class="q-list" style="margin-top:12px">${result.rows.map(pr=>`<button type="button" class="q-row" data-program="${esc(pr.id)}" aria-pressed="${p?.id===pr.id}"><div><strong>${esc(pr.name)}</strong><small>${esc(pr.city)} · ${esc(pr.specialty)}</small></div><span class="chip ok">Verified identity</span></button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-secondary" id="prev-page" ${!loading&&result.page>1?'':'disabled'}>Previous</button><span class="note">Page ${result.page} / ${Math.max(1,result.totalPages)}</span><button type="button" class="btn btn-secondary" id="next-page" ${!loading&&result.page<result.totalPages?'':'disabled'}>Next</button></div>
    ${p?`<div class="program-card"><div class="t-label">Selected program</div><h3>${esc(p.name)}</h3><p class="note">RISE identity and release retained. Available verified intelligence is checked when your interview starts. Missing leadership or program facts are not invented.</p><a class="btn btn-secondary" target="_blank" rel="noopener" href="https://missionmedinstitute.com/member-dashboard/">Open RISE from Matrix</a></div>`:''}
    </section><aside class="housing panel ready-card"><div class="t-kick gold">Rehearse for your program</div><div class="q-list" style="margin:12px 0">${fit.map(q=>`<a class="q-row" href="#/practice?q=${q.question_id}"><strong>${esc(q.canonical_text)}</strong></a>`).join('')}</div><button class="btn btn-primary btn-lg" type="button" id="program-mock" ${!loading&&p?.verified&&account.liveInterviewAvailable?'':'disabled'}>Program mock ▸</button><p class="note">${p?.verified?'Your interview uses only authorized program intelligence.':'Choose a verified program first.'}</p><a class="btn btn-quiet" href="#/mock">General mock instead</a><section data-interview-calendar style="margin-top:20px">${calendarMarkup(calendar)}</section></aside></div>`;
    main.querySelector('#program-form').onsubmit=e=>{e.preventDefault();if(!current())return;const form=e.currentTarget;filters={q:form.querySelector('#program-search').value,specialty:form.elements.specialty.value,jurisdiction:form.elements.jurisdiction.value,programType:form.elements.programType.value,page:1};state.program=null;commit();void search();};
    main.querySelectorAll('[data-program]').forEach(b=>b.onclick=()=>{if(!current()||loading)return;const pr=result.rows.find(x=>x.id===b.dataset.program);if(!pr?.verified)return;state.program={...pr,fixture:false};commit();draw();});
    main.querySelector('#program-mock').onclick=()=>{if(current()&&!loading&&state.program?.verified)location.hash='#/mock?program=1';};
    main.querySelector('#prev-page').onclick=()=>{if(!current()||loading)return;filters.page=Math.max(1,filters.page-1);void search();};
    main.querySelector('#next-page').onclick=()=>{if(!current()||loading)return;filters.page++;void search();};
  };
  async function search(){if(!current())return;const ticket=++querySequence;loading=true;result={rows:[],page:filters.page,total:0,totalPages:0};error=null;draw();try{const found=await searchPrograms(account,filters);if(!current()||ticket!==querySequence)return;result=found;}catch(cause){if(!current()||ticket!==querySequence)return;result={rows:[],page:1,total:0,totalPages:0};error='Verified program search is unavailable for this account right now. You can still run a general interview.';}loading=false;draw();}
  draw();await Promise.all([search(),readOwnCalendar(controller,{isCurrent:current}).then(value=>{if(!current()||!value)return;calendar=value;const host=main.querySelector('[data-interview-calendar]');if(host)host.innerHTML=calendarMarkup(calendar);})]);
}
// ---------- REVIEW & IMPROVE ----------
async function renderReview(isCurrent = guarded) {
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  const current=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&controller.account?.subject===subject;
  const lib = await controller.library({isCurrent:current}); if (!current()) return;
  const attempts=filterOwnAttempts(lib,subject);
  const unfinished=ownHistoryProgress(lib,subject).unfinished;
  const rowsMarkup=filtered=>filtered.map((a) => { const same = attempts.find(x=>x.at<a.at&&canCompareAttempts(attemptSnapshot(x.remote),attemptSnapshot(a.remote))); return `<div class="attempt-row"><span class="when">${fmtDate(a.at)}</span><div><strong>${esc(a.questionText)}</strong><small>${a.mode === 'mock' ? 'Mock interview' : 'Practice'} · ${fmtDur(a.durationS)} · account${a.priorityText ? ` · change: ${esc(a.priorityText)}` : ''}</small></div><div class="attempt-actions"><a class="btn btn-secondary" href="#/results/${a.id}">Debrief</a><a class="btn btn-quiet" href="#/film/${a.id}">Film Room</a>${same ? `<a class="btn btn-quiet" href="#/compare/${same.id}/${a.id}">Compare</a>` : ''}</div></div>`; }).join('') || (attempts.length?'<p class="note">No matching saved reps. Change the question or evidence filter.</p>':'<p class="note">Nothing saved yet.</p>');
  const latest = attempts[0];
  main.innerHTML = `
    <div class="screen-head"><div><div class="t-kick gold">Review &amp; improve</div><h1 class="t-hero">What <em>changed?</em></h1><p class="t-edit">Your latest debrief first. Open the Film Room, compare two reps on the same question, and see your progress over time.</p></div><div class="review-actions"><span class="t-tech">${lib.source === 'account' ? 'Private account history' : 'History unavailable'}</span><a class="btn btn-secondary" href="#/progress">Progress</a></div></div>
    ${latest ? `<section class="housing panel latest-debrief"><div><div class="t-label">Latest debrief</div><div class="t-edit-lg" style="margin:6px 0">${esc(latest.questionText)}</div><div class="note">${latest.mode === 'mock' ? 'Mock interview' : 'Practice'} · ${fmtDate(latest.at)} · ${fmtDur(latest.durationS)}${latest.priorityText ? ` · the one thing to change: ${esc(latest.priorityText)}` : ''}</div></div><a class="btn btn-primary" href="#/results/${latest.id}">Open debrief ▸</a></section>` : '<section class="housing panel"><p class="t-edit">No saved reps yet. <a href="#/practice">Practice one answer</a> to get your first debrief.</p></section>'}
    <section class="housing panel"><div class="t-label" style="margin-bottom:8px">All reps</div>
      <div class="option-row"><label class="field">Question<input class="search" id="history-query" type="search" placeholder="Question or ID"></label><label class="field">Evidence<select id="history-evidence"><option value="all">All evidence states</option><option value="semantic">Supported semantic evidence</option><option value="transcript">Transcript available</option><option value="pending">Evidence pending</option></select></label><label class="field">Mode<select id="history-mode"><option value="all">Practice and Mock</option><option value="practice">Practice</option><option value="mock">Mock interview</option></select></label></div><p class="note" role="status" id="history-count"></p><div id="history-rows"></div>
    </section>
    ${unfinished.length?'<details class="housing panel expert" style="margin-top:16px"><summary>Unfinished sessions · '+unfinished.length+'</summary><p class="note">These are not completed saved reps. Use your account library to inspect or end an interrupted session; retained unsaved media still requires its original page.</p>'+unfinished.map(row=>'<div class="attempt-row"><span class="when">'+fmtDate(Date.parse(row.startedAt||row.createdAt))+'</span><div><strong>'+esc(row.questionText||row.title||'Interview session')+'</strong><small>Not completed</small></div></div>').join('')+'<a class="btn btn-secondary" href="/iv-prep-on-call/advanced/#vault">Manage unfinished sessions</a></details>':''}`;
  const paint=()=>{if(!current())return;const filters={query:main.querySelector('#history-query').value,evidence:main.querySelector('#history-evidence').value,mode:main.querySelector('#history-mode').value},filtered=filterOwnAttempts(lib,subject,filters);main.querySelector('#history-rows').innerHTML=rowsMarkup(filtered);main.querySelector('#history-count').textContent=filtered.length+' of '+attempts.length+' saved reps';};
  main.querySelector('#history-query').oninput=paint;main.querySelector('#history-evidence').onchange=paint;main.querySelector('#history-mode').onchange=paint;paint();
}

// ---------- PROGRESS ----------
async function renderProgress(isCurrent = guarded) {
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  const current=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&controller.account?.subject===subject;
  const lib = await controller.library({isCurrent:current});
  if(!current())return;
  const progress=ownHistoryProgress(lib,subject),longitudinal=progress.model;
  const { questions } = await loadQuestions({account}); if (!current()) return;
  const attempts = filterOwnAttempts(lib,subject);
  const core = questions.filter((q) => q.core_priority).slice(0, 10);
  const hooksTaken = attempts.reduce((n, a) => n + (a.hooks || []).filter((h) => h.taken).length, 0);
  const hooksLeft = attempts.reduce((n, a) => n + (a.hooks || []).length, 0);
  main.innerHTML = `
    <div class="screen-head"><div><div class="t-kick gold">Progress</div><h1 class="t-hero">Earned, <em>not farmed.</em></h1><p class="t-edit">Every number here comes from a saved rep. Nothing is seeded, awarded or estimated.</p></div></div>
    <div class="progress-grid">
      <div class="housing panel"><div class="t-label">Day streak</div><div class="streak">${streak(attempts)}</div><p class="note">Consecutive days with at least one saved rep. Missing a day resets it. ${longitudinal.totals.activeDays} total active days.</p></div>
      <div class="housing panel"><div class="t-label">Reps</div><div class="streak">${attempts.length}</div><p class="note">${attempts.filter((a) => a.mode === 'mock').length} mock interviews · ${attempts.filter((a) => a.mode !== 'mock').length} practice reps</p></div>
      <div class="housing panel"><div class="t-label">Observed hooks followed</div><div class="streak">${hooksTaken}<span style="font-size:22px;color:var(--dim)"> / ${hooksLeft}</span></div><p class="note">Saved qualifying hook observations only. Missing turn boundaries do not prove no contextual follow-up occurred.</p></div>
      <div class="housing panel"><div class="t-label">Closing text observed</div><div class="streak">${progress.closing.observed?progress.closing.reached:'—'}<span style="font-size:22px;color:var(--dim)"> / ${progress.closing.observed}</span></div><p class="note">${progress.closing.unverified} mocks have no verified closing observation. Confirm what was heard in replay.</p></div>
      <div class="housing panel"><div class="t-label">Recorded practice</div><div class="streak">${progress.durationAvailable?fmtDur(longitudinal.totals.recordedMs/1000):'Unavailable'}</div><p class="note">Measured duration of private saved media. Attempts without a duration do not add time.</p></div>
      <div class="housing panel"><div class="t-label">Question breadth</div><div class="streak">${longitudinal.totals.uniqueQuestions}</div><p class="note">Distinct saved question IDs or historical titles; not inferred coverage of every question inside a mock.</p></div>
    </div>
    <section class="housing panel" style="margin-top:16px"><div class="t-label" style="margin-bottom:10px">Core 10 practice history</div>
      <div class="mastery-list">${core.map((q) => { const m = masteryState(attempts, q.question_id); return `<div class="mastery-row"><span>${esc(q.canonical_text)}</span><span class="mastery-ring">${[1, 2, 3, 4].map((i) => `<i class="${i <= m.segments ? 'on' : ''}"></i>`).join('')}</span><span class="state">${m.state}${m.reps ? ` · ${m.reps}` : ''}</span></div>`; }).join('')}</div>
      <p class="note" style="margin-top:10px">Unpracticed → Attempted (1) → Rehearsed (2+). Not recent means no saved rep in 21 days. Rings show rep coverage, not mastery, readiness, or proof that a priority was corrected.</p>
    </section>
    <section class="full-analytics"><div class="screen-head"><div><div class="t-kick gold">Evidence over time</div><h2 class="t-h2">Your saved observations.</h2><p class="note">Validated student-safe evidence only. Unavailable means no supported measurement; these are not readiness or population rankings.</p></div></div><div class="analytics-grid">${longitudinal.attempts.slice(0,6).map(a=>`<section class="housing verdict"><div class="t-kick">${fmtDate(a.at)}</div><h3>${esc(a.title)}</h3><dl class="analytics-readouts"><div><dt>Answer duration</dt><dd>${formatHistoryEvidence(a.metrics.answerDurationMs,'ms')}</dd></div><div><dt>Captured mic level</dt><dd>${formatHistoryEvidence(a.metrics.capturedLevelDbfs,'dBFS')}</dd></div><div><dt>Digital clipping</dt><dd>${formatHistoryEvidence(a.metrics.digitalClippingFraction,'fraction')}</dd></div><div><dt>Microphone coverage</dt><dd>${formatHistoryEvidence(a.metrics.microphoneCoverage,'fraction')}</dd></div><div><dt>Camera coverage</dt><dd>${formatHistoryEvidence(a.metrics.cameraCoverage,'fraction')}</dd></div></dl><a class="btn btn-secondary" href="#/results/${esc(a.id)}">Open this debrief</a></section>`).join('')||'<p class="note">No saved evidence yet.</p>'}</div></section>`;
}

// ---------- Router ----------
async function route() {
  if(revertingHash){revertingHash=false;return;}
  if(controller.navigationLocked && location.hash!==acceptedHash){revertingHash=true;location.hash=acceptedHash;return;}
  const legacyRoute=legacyPresentationEntry(location.pathname,location.hash);
  if(legacyRoute){location.replace(legacyRoute);return;}
  // Readiness setup is intentionally ephemeral, not a second private context
  // store. A cold room cannot silently choose Practice or restart a provider.
  const [entryPath,entryQuery]=(location.hash||'#/home').replace(/^#\/?/,'').split('?');
  if(entryPath==='room'&&!['mock','practice'].includes(session.mode)){
    const requestedMode=new URLSearchParams(entryQuery||'').get('mode');
    location.hash=requestedMode==='mock'?'#/mock?recover=room':requestedMode==='practice'?'#/practice?recover=room':'#/home';
    return;
  }
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
    else if(name==='practice'||name==='mock'){
      await (name==='mock'?renderMock(params,isCurrent):renderPractice(params,isCurrent));
      if(isCurrent()&&params.get('recover')==='room')main.insertAdjacentHTML('afterbegin','<p class="note" role="status">This page was refreshed. Review your setup before entering the room again. No interview has restarted.</p>');
    }
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
const legacyEntry=legacyPresentationEntry(location.pathname,location.hash);
if(legacyEntry)location.replace(legacyEntry);
else controller.connectAccount().then(account=>{
  renderIdentity(account);
  document.querySelectorAll('[data-admin-link]').forEach(link=>{link.hidden=account.role!=='admin';});
  void route();
}).catch(error=>{
  renderIdentity(null);
  document.querySelectorAll('[data-admin-link]').forEach(link=>{link.hidden=true;});
  main.innerHTML='<section class="housing panel"><h1 class="t-h2">Sign in through Matrix</h1><p class="t-edit">'+esc(error.message)+'</p><a class="btn btn-primary" href="https://missionmedinstitute.com/member-dashboard/">Open MissionMed Matrix ▸</a></section>';
});
