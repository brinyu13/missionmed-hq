// Results (debrief), Film Room (synchronized recorder) and Compare.

import { deriveDebrief } from './model/teaching.mjs';
import { renderFilmLanes } from './instruments/flight-recorder.mjs';
import { projectSavedAttempt, nearestComparable, validReplaySeek, privatePlaybackUrl } from './adapters/saved-review.mjs';
import { buildRetryIntent,debriefConfidenceCopy } from '../../studio/presentation-view-model.mjs';
import { compareAttempts } from '../../studio/longitudinal-model.mjs';
import { DI_GROUPS, resultLaneReadouts } from '../../analytics/di-groups-ui.mjs';
import { buildLiveTranscriptReview, renderLiveTranscriptReview } from '../../studio/live-transcript-review.mjs';
import { renderMeasurementTimeline } from '../../studio/flight-recorder-view.mjs';
import { loadQuestions } from './questions.mjs';
import { controller } from './controller/session-controller.mjs';
import { replayOverlays } from './adapters/replay-overlays.mjs';
import {readOwnComparison,freshTeachingReplay} from './adapters/comparison-view-model.mjs';
import {nameUseViewMarkup} from './adapters/name-use-view.mjs';
import {savedInterviewerIdentity} from './adapters/interviewer-review.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (s) => Number.isFinite(s)?`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`:'Unavailable';
const fmtDate = (ms) => Number.isFinite(ms)?new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }):'Date unavailable';
const noop = () => {};
function unavailable(main) { main.innerHTML='<section class="housing panel"><h1 class="t-h2">Recording unavailable</h1><p class="t-edit">This answer is not available in your current account. No other student’s work is substituted.</p><a class="btn btn-secondary" href="#/review">Back to Review</a></section>'; }
function transcriptMarkup(a,seek=false) {
  return a.turns.map(t=>{
    const at=validReplaySeek(t.t,a.durationS),approx=t.timing==='message-receipt'?'≈ ':'';
    const time=at===null?'':seek&&a.recordingId?'<button type="button" data-seek="'+at+'">'+approx+fmt(at)+'</button>':approx+fmt(at);
    return '<div class="turn '+t.speaker+'"><b>'+(t.speaker==='interviewer'?'Interviewer':'You')+' '+time+'</b><span>'+esc(t.text)+'</span></div>';
  }).join('')||'<p class="note">No attributed transcript is available.</p>';
}
function appendFullReport(main,a) {
  const readouts=resultLaneReadouts(a.analytics),section=document.createElement('section');
  section.id='full-analytics';section.className='full-analytics';section.tabIndex=-1;
  section.innerHTML='<div class="screen-head"><div><div class="t-kick gold">Full Analytics</div><h2 class="t-h2">Your supported evidence.</h2><p class="note">Unavailable means no supported evidence was saved. Head orientation is not eye gaze; expression and movement are not emotion or personality.</p></div><div class="review-actions"><a class="btn btn-secondary" href="/iv-prep-on-call/advanced/#postanswer?session='+a.id+'">Transcript &amp; answer coaching</a><a class="btn btn-quiet" href="/iv-prep-on-call/advanced/#lab">Analytics instruments</a></div></div><div class="analytics-grid">'+DI_GROUPS.map(g=>'<section class="housing panel"><h3 class="t-h3">'+esc(g.label)+'</h3><dl class="analytics-readouts">'+g.lanes.map(l=>'<div><dt>'+esc(l.label)+'</dt><dd>'+esc(readouts[l.id]||'Unavailable')+'</dd></div>').join('')+'</dl></section>').join('')+'</div>';
  main.append(section);
  if(a.traceDecimated){const note=document.createElement('p');note.className='note';note.textContent='The saved Flight Recorder is a bounded sample of the measured session, not a frame-by-frame trace. Percentages describe retained samples; recording playback remains authoritative.';section.prepend(note);}
  const button=document.createElement('button');button.type='button';button.className='btn btn-primary';button.textContent='Full Analytics ↓';
  const click=()=>{section.scrollIntoView({behavior:'smooth',block:'start'});section.focus({preventScroll:true});};
  button.addEventListener('click',click);main.querySelector('.screen-head .review-actions')?.append(button);
  return ()=>button.removeEventListener('click',click);
}
function renderProviderTranscript(main,a) {
  const model=buildLiveTranscriptReview(a.detail);if(!model)return;
  const host=document.createElement('div');host.className='housing panel';main.append(host);
  renderLiveTranscriptReview(host,model,{document:main.ownerDocument,speakerLabel:s=>s==='student'?'You':'Interviewer'});
}

function evidenceButton(item, attemptId) {
  if (item.at === null || item.at === undefined) return `<div class="evidence"><button type="button" disabled style="opacity:.7"><span class="at">—</span><span>${esc(item.text)}</span><span class="lane">${esc(item.lane)}</span></button></div>`;
  return `<div class="evidence"><a class="btn" href="#/film/${attemptId}?t=${Math.max(0, item.at - 2)}" style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;text-align:left;padding:10px 12px;border-radius:10px;background:#ffffff06;border:1px solid #ffffff0c;font-size:13.5px;min-height:0"><span class="at">${fmt(item.at)}</span><span>${esc(item.text)}</span><span class="lane">${esc(item.lane)} · replay</span></a></div>`;
}
function hookReplayLink(h,a) {
  return h.replay&&a.recordingId?'<a class="btn btn-quiet" href="#/film/'+a.id+'?t='+Math.max(0,h.replay.at-2)+'">≈ '+fmt(h.replay.at)+' · replay referenced text</a>':'<small>Exact replay reference unavailable</small>';
}

// Always resolve membership and detail from the current signed-in account.
async function resolveAttempt(id,isCurrent=()=>true) {
  const saved=await controller.sessionDetail(id,{isCurrent});
  return isCurrent()?projectSavedAttempt(saved,controller.account?.subject):null;
}

export async function mountResults(main, id, {isCurrent=()=>true}={}) {
  const routeCurrent=isCurrent,account=controller.account,durable=controller.durable;
  isCurrent=()=>routeCurrent()&&controller.account===account&&controller.durable===durable;
  const a=await resolveAttempt(id,isCurrent);if(!isCurrent())return noop;
  if(!a){unavailable(main);return noop;}
  const {questions}=await loadQuestions();if(!isCurrent())return noop;
  const own=await controller.library({isCurrent});if(!isCurrent())return noop;
  const retry=buildRetryIntent({detail:a.detail,reviewScope:'own',catalog:questions});
  const retryHref=retry.available?'#/'+(retry.launchMode==='ai'?'mock':'practice')+'?q='+encodeURIComponent(retry.question.question_id)+'&retry='+a.id:null;
  const d = deriveDebrief(a);
  const earlier = nearestComparable(a,own.sessions);
  const hooks = a.hooks || [];
  const closing = a.closing || { status: 'n/a', label: '' };
  const nextQ = a.mode === 'mock' ? (a.hooks?.some((h) => h.attempted && !h.taken) ? 'Practice ending an answer on the hook, not after it.' : 'Retry the question where the one thing to change happened.') : 'Retry the same question with the priority on screen.';
  const taken = hooks.filter((h) => h.taken).length;
  main.innerHTML = `
    <div class="screen-head"><div><div class="t-kick gold">Debrief · ${a.mode === 'mock' ? 'Mock interview' : 'Practice rep'} · ${fmtDate(a.at)}</div><h1 class="t-hero">What <em>worked.</em> What to <em>change.</em></h1><p class="t-edit">${esc(a.questionText)} · ${fmt(a.durationS)}</p>${a.mode==='mock'&&savedInterviewerIdentity(a)?`<p class="note" data-saved-interviewer>${esc(savedInterviewerIdentity(a))}</p>`:''}</div><div class="review-actions"><a class="btn btn-secondary" href="#/film/${a.id}">Film Room</a>${earlier ? `<a class="btn btn-quiet" href="#/compare/${earlier.id}/${a.id}">Compare with ${fmtDate(earlier.at).split(',')[0]}</a>` : ''}</div></div>
    <div class="results-grid">
      <div class="debrief">
        <section class="housing verdict"><div class="t-kick"><span>What worked</span><span>evidence · click to replay</span></div>
          ${d.worked.length ? d.worked.map((w) => evidenceButton(w, a.id)).join('') : '<p>Not enough measured speech to name a strength yet. Longer answers give the instruments more to work with.</p>'}
        </section>
        <section class="housing verdict" style="border-color:#ffa92844"><div class="t-kick"><span style="color:var(--warn)">The one thing to change</span><span>priority for your next rep</span></div>
          ${d.change.length ? `<h3>${esc(d.change[0].text)}</h3>${evidenceButton(d.change[0], a.id)}` : '<h3>No measured correction identified.</h3><p>This is not an overall readiness or performance score.</p>'}
          ${d.allChange.length > 1 ? `<details class="expert"><summary>Other things measured (${d.allChange.length - 1})</summary>${d.allChange.slice(1).map((c) => evidenceButton(c, a.id)).join('')}</details>` : ''}
        </section>
        ${a.mode === 'mock' ? `
        <section class="housing verdict"><div class="t-kick"><span>Hooks · bottom lining</span><span>${taken} of ${hooks.filter((h) => h.attempted).length} followed</span></div>
          ${hooks.length ? `<div class="hook-ledger">${hooks.map((h) => `<div class="hook-row"><span class="chip ${h.taken ? 'ok' : h.attempted ? 'warn' : ''}">${h.taken ? 'Taken' : h.attempted ? 'Sent' : h.category === 'VC' ? 'Vague' : 'Logged'}</span><div><q>${esc(h.span)}</q><small>${esc(h.verdict)}${h.followUp ? ` · "${esc(h.followUp)}"` : ''}</small>${hookReplayLink(h,a)}</div><span class="t-tech">${esc(h.questionId)}</span></div>`).join('')}</div>` : '<p>No qualifying hook was logged; that does not mean no contextual follow-up occurred.</p>'}
        </section>
        <section class="housing verdict"><div class="t-kick"><span>Closing</span><span>${esc(closing.label)}</span></div>
          <p>${closing.status === 'observed' ? `Closing invitation text appeared in live captions${closing.closeDelivered ? ', followed by sign-off text' : ''}. Confirm what was actually heard in Film Room.` : closing.status === 'delivered' ? `Closing text was observed in the saved conversation. Confirm audible delivery in replay. You asked ${closing.candidateQuestions || 0} question${closing.candidateQuestions === 1 ? '' : 's'}${closing.closeDelivered ? ' and sign-off text was observed.' : '.'}` : closing.status === 'skipped' ? 'The interview ended without a close. Next time choose "Wrap up" so you practice the ending too.' : closing.status==='unverified'?'Live captions do not confirm complete turn boundaries. Use the recording to review your closing.':'The closing phase was not reached.'}</p>
        </section>` : ''}
        <section class="housing verdict next-rep"><div class="t-kick"><span>Next rep</span><span>one question · one priority</span></div><h3>${esc(retry.available ? retry.question.canonical_text : a.questionText)}</h3><p>${esc(d.change[0] ? `Priority: ${d.change[0].text}` : nextQ)}</p><div style="display:flex;gap:10px;margin-top:6px">${retryHref ? `<a class="btn btn-primary" href="${retryHref}">Retry this question ▸</a>` : `<p class="note">${esc(retry.reason)}</p>`}<a class="btn btn-quiet" href="#/mock">Run a mock</a></div></section>
      </div>
      <aside class="side-stack">
        <section class="housing panel"><div class="t-label" style="margin-bottom:8px">Measured</div><div class="stat-row">
          <div class="stat"><b>${d.facts.find((f) => f.lane === 'pace') ? Math.round(d.facts.find((f) => f.lane === 'pace').value * 100) + '%' : '—'}</b><small>pace in range</small></div>
          <div class="stat"><b>${d.facts.find((f) => f.lane === 'volume') ? Math.round(d.facts.find((f) => f.lane === 'volume').value * 100) + '%' : '—'}</b><small>volume in corridor</small></div>
          <div class="stat"><b>${d.facts.find((f) => f.lane === 'smiles') ? d.facts.find((f) => f.lane === 'smiles').value : '—'}</b><small>smile patterns</small></div>
        </div>
        <ul class="attention" style="padding:0;margin:12px 0 0">${d.facts.map((f) => `<li><i>·</i>${esc(f.text)}</li>`).join('') || '<li><i>·</i>No measured facts yet.</li>'}</ul>
        <details class="expert"><summary>Expert · raw evidence</summary><table><tr><td>Samples</td><td>${a.samples?.length ?? 0}</td></tr><tr><td>Events</td><td>${a.events?.length ?? 0}</td></tr><tr><td>Engine</td><td>${esc(a.engineMode)}</td></tr><tr><td>Calibration used</td><td>${a.calibrationUsed ? 'yes' : 'no'}</td></tr>${a.sealed ? `<tr><td>Sealed envelope</td><td>${esc(a.sealed.schema)}</td></tr>` : ''}<tr><td>Reducer</td><td>ivoc.trace-reducer.v1</td></tr></table></details></section>
        <section class="housing panel"><div class="t-label" style="margin-bottom:8px">Transcript</div><div class="transcript" style="max-height:260px;grid-column:auto">${transcriptMarkup(a)}<p class="note">≈ means text arrival, not a measured speech boundary. Interrupted interviewer text may include words you did not hear; confirm in the recording.</p></div></section>
      </aside>
    </div>`;
  renderProviderTranscript(main,a);
  const disposeReport=appendFullReport(main,a);let disposed=false;
  const nameReview=document.createElement('section');nameReview.innerHTML=nameUseViewMarkup(a);
  main.querySelector('#full-analytics').append(nameReview);
  if(controller.candidateAudioRetryAvailable(a.id)){
    const panel=document.createElement('section');panel.className='housing panel';
    panel.innerHTML='<h2 class="t-h3">Your full recording is saved.</h2><p>The separate microphone upload for answer analysis needs a retry. Keep this page open until it saves.</p><button type="button" class="btn btn-secondary">Retry microphone audio save</button><p class="note" role="status"></p>';
    main.querySelector('#full-analytics')?.before(panel);
    const button=panel.querySelector('button'),status=panel.querySelector('[role="status"]');
    button.onclick=async()=>{button.disabled=true;try{const result=await controller.retryCandidateAudio(a.id,{isCurrent:()=>!disposed&&isCurrent()});if(disposed||!isCurrent())return;if(result?.retried){status.textContent='Microphone audio saved. Reopen Results for fresh answer analysis.';button.textContent='Microphone audio saved';}else{status.textContent='The microphone upload is still unavailable. Your full recording is unchanged.';button.disabled=false;}}catch(error){if(!disposed&&isCurrent()){status.textContent=error.message;button.disabled=false;}}};
  }
  return ()=>{disposed=true;disposeReport();};
}

export async function mountFilm(main,id,params=new URLSearchParams(),{isCurrent=()=>true}={}) {
  const account=controller.account,durable=controller.durable;
  let disposed=false;
  const current=()=>!disposed&&isCurrent()&&controller.account===account&&controller.durable===durable;
  const a=await resolveAttempt(id,current);if(!current())return noop;
  if(!a){unavailable(main);return noop;}
  let url=null;
  if(a.recordingId)try{
    const signed=await controller.playbackUrl(a,{isCurrent:current});if(!current())return noop;
    url=privatePlaybackUrl(signed,a.recordingId,main.ownerDocument.location.href);
  }catch{if(!current())return noop;}
  const d=deriveDebrief(a);
  main.innerHTML='<div class="screen-head"><div><div class="t-kick gold">Film Room · '+fmtDate(a.at)+'</div><h1 class="t-hero">Every claim is <em>evidence.</em></h1><p class="t-edit">'+esc(a.questionText)+'</p></div><div class="review-actions"><a class="btn btn-secondary" href="#/results/'+a.id+'">← Debrief</a><a class="btn btn-quiet" href="#/review">Your recordings</a></div></div><div class="film"><div><div class="stage" id="film-stage">'+(url?'<video id="playback" controls playsinline preload="metadata" src="'+esc(url)+'"></video>':'<div class="playback-unavailable"><h2 class="t-h3">Playback unavailable</h2><p>Your answer is retained. Reopen Film Room for a fresh private playback link.</p><a class="btn btn-secondary" href="#/review">Back to recordings</a></div>')+'</div><div class="recorder" id="film-recorder" data-mode="film"></div></div><aside class="film-side"><section class="housing moment"><div class="t-label">Moments</div><div class="evidence moments">'+([...d.worked,...d.allChange].filter(m=>validReplaySeek(m.at,a.durationS)!==null).map(m=>'<button type="button" data-seek="'+Math.max(0,m.at-2)+'" '+(url?'':'disabled')+'><span class="at">'+fmt(m.at)+'</span><span class="lane">'+esc(m.lane)+'</span><span>'+esc(m.text)+'</span></button>').join('')||'<p class="note">No bounded teaching moment was saved.</p>')+'</div></section><section class="housing moment"><div class="t-label">Conversation</div><div class="transcript" style="max-height:300px;grid-column:auto;margin-top:8px">'+transcriptMarkup(a,Boolean(url))+'</div><p class="note">≈ means text arrival, not a measured speech boundary. Replay is authoritative for what was actually heard.</p></section></aside></div>';
  renderProviderTranscript(main,a);
  const video=main.querySelector('#playback'),host=main.querySelector('#film-recorder');
  let overlay=null;
  if(video){
    const panel=document.createElement('details');panel.className='expert replay-overlay-options';
    panel.innerHTML='<summary>Video overlays</summary><p class="note">Optional landmarks are redrawn locally from this saved video, not the original live detector output. They never change your saved measurements. Eye gaze is not measured.</p><button type="button" class="btn btn-quiet" aria-pressed="false">Show replay overlays</button><p class="note" role="status">Overlays are off.</p>';
    main.querySelector('#film-stage').after(panel);
    const button=panel.querySelector('button'),status=panel.querySelector('[role="status"]');
    overlay=replayOverlays({video,isCurrent:current,onStatus:value=>{
      if(!current())return;
      status.textContent={off:'Overlays are off.',loading:'Loading local video overlays…',ready:'Play your recording to redraw supported face and body/hand landmarks.',drawn:'Overlay drawn from saved video. Use Face and Body / Hands to choose layers.',waiting:'Waiting for fresh landmarks. Your recording and saved Analytics are unchanged.',unavailable:'Replay overlays are unavailable. Your recording and saved Analytics are unchanged.'}[value];
    }});
    button.onclick=async()=>{if(!current())return;button.disabled=true;const enabled=await overlay.setEnabled(button.getAttribute('aria-pressed')!=='true');if(current()){button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'Hide replay overlays':'Show replay overlays';button.disabled=false;}};
  }
  if(a.hooks.length){
    const section=document.createElement('section');section.className='housing moment';
    section.innerHTML='<div class="t-label">Referenced hooks</div>'+a.hooks.map(h=>'<q>'+esc(h.span)+'</q>'+(h.replay?'<button type="button" class="btn btn-quiet" data-seek="'+Math.max(0,h.replay.at-2)+'" '+(video?'':'disabled')+'>≈ '+fmt(h.replay.at)+' · replay referenced text</button>':'<p class="note">Exact replay reference unavailable</p>')).join('')+'<p class="note">Text receipt timing is approximate. References are not proof of semantic answer boundaries or audible follow-up.</p>';
    main.querySelector('.film-side')?.append(section);
  }
  if(a.traceDecimated){const note=document.createElement('p');note.className='note';note.textContent='Flight Recorder is sampled for durable storage. Not every measured instant is retained; the full recording is unchanged.';host.before(note);}
  const seek=value=>{const t=validReplaySeek(value,a.durationS);if(current()&&video&&t!==null){video.pause();video.currentTime=t;}};
  let lanes=null;
  if(a.samples.length)lanes=renderFilmLanes(host,{samples:a.samples,events:a.events,durationS:a.durationS,onSeek:seek,playback:video,label:'Flight Recorder · replay'});
  else renderMeasurementTimeline(host,a.measurementTimeline,{playback:video});
  const click=e=>{const b=e.target.closest('[data-seek]');if(b&&!b.closest('#film-recorder'))seek(b.dataset.seek);};
  main.addEventListener('click',click);
  const start=validReplaySeek(params.get('t'),a.durationS),loaded=()=>{if(start!==null)seek(start);};
  video?.addEventListener('loadedmetadata',loaded,{once:true});
  return ()=>{disposed=true;main.removeEventListener('click',click);lanes?.destroy?.();
    overlay?.destroy();
    if(!lanes)renderMeasurementTimeline(host,null,{playback:null});
    if(video){video.removeEventListener('loadedmetadata',loaded);video.pause();video.removeAttribute('src');video.load();}
  };
}

export async function mountCompare(main,idA,idB,{isCurrent=()=>true}={}) {
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  let disposed=false;
  const current=()=>!disposed&&isCurrent()&&controller.account===account&&controller.durable===durable&&account?.subject===subject;
  const pair=await readOwnComparison(controller,{baselineId:idA,currentId:idB,isCurrent:current});if(!current())return noop;
  const {a,b,selection,teaching}=pair||{};
  if(!selection?.current){unavailable(main);return noop;}
  const selector=document.createElement('section');selector.className='housing panel review-filters';
  const selectMarkup=(values,id,label)=>'<label>'+label+'<select aria-label="'+label+'">'+(values.length?(!id?'<option value="" selected>Choose an earlier attempt</option>':'')+values.map(value=>'<option value="'+esc(value.id)+'" '+(value.id===id?'selected':'')+'>'+esc(value.title)+' · '+fmtDate(value.at)+'</option>').join(''):'<option value="">No earlier comparable attempt</option>')+'</select></label>';
  selector.innerHTML=selectMarkup(selection.eligible,selection.baseline?.id,'Earlier attempt')+selectMarkup(selection.attempts,selection.current.id,'Selected attempt');
  const [earlierSelect,selectedSelect]=selector.querySelectorAll('select');earlierSelect.disabled=!selection.eligible.length;
  const chooseEarlier=()=>{if(current()&&earlierSelect.value)location.hash='#/compare/'+encodeURIComponent(earlierSelect.value)+'/'+encodeURIComponent(selection.current.id);};
  const chooseSelected=()=>{if(!current())return;
    // Eligibility comes from the already fresh protected snapshots, not reconstructed evidence.
    const chosen=selection.attempts.find(value=>value.id===selectedSelect.value);
    const eligible=selection.attempts.filter(value=>chosen&&compareAttempts(value,chosen)&&value.at!==null&&chosen.at!==null&&value.at<=chosen.at);
    location.hash='#/compare/'+encodeURIComponent(eligible[0]?.id||'none')+'/'+encodeURIComponent(chosen?.id||selection.current.id);};
  earlierSelect.addEventListener('change',chooseEarlier);selectedSelect.addEventListener('change',chooseSelected);
  const disposeSelectors=()=>{disposed=true;earlierSelect.removeEventListener('change',chooseEarlier);selectedSelect.removeEventListener('change',chooseSelected);};
  const c=a&&b?compareAttempts(a.comparison,b.comparison):null;
  if(!c){main.innerHTML='<section class="housing panel"><h1 class="t-h2">Choose comparable answers</h1><p class="t-edit">Compare your own saved attempts with the same canonical question, wording, mode, interviewer provider and evidence version.</p><a class="btn btn-secondary" href="#/review">Back to Review</a></section>';main.prepend(selector);return disposeSelectors;}
  main.innerHTML='<div class="screen-head"><div><div class="t-kick gold">Compare · '+esc(a.questionText)+'</div><h1 class="t-hero">Your own <em>measured change.</em></h1><p class="t-edit">'+fmtDate(a.at)+' → '+fmtDate(b.at)+'</p></div><a class="btn btn-secondary" href="#/results/'+b.id+'">Selected debrief</a></div><div class="compare-grid">'+[[a,'Earlier'],[b,'Selected']].map(([attempt,label])=>{const d=deriveDebrief(attempt);return '<section class="housing verdict"><div class="t-kick"><span>'+label+'</span><span>'+fmtDate(attempt.at)+'</span></div><h3>'+esc(d.change[0]?.text||'No measured correction identified')+'</h3>'+d.worked.map(w=>evidenceButton(w,attempt.id)).join('')+'<a class="btn btn-secondary" href="#/film/'+attempt.id+'">Replay answer</a></section>';}).join('')+'</div><section class="housing panel" style="margin-top:16px"><div class="t-label">Measured change</div>'+c.metrics.map(r=>'<div class="attempt-row"><span class="t-tech">'+esc(r.label)+'</span><div>'+esc(r.left===null?'Unavailable':r.left.toFixed(2)+' '+r.unit)+' → '+esc(r.right===null?'Unavailable':r.right.toFixed(2)+' '+r.unit)+'</div><span class="t-tech">'+esc(r.delta===null?'Not comparable':(r.delta>=0?'+':'')+r.delta.toFixed(2))+'</span></div>').join('')+'<p class="note">Changes are observations, not improvement grades or readiness scores. Captured mic level depends on your device and distance.</p></section>';
  main.querySelector('.screen-head').after(selector);
  const coaching=document.createElement('section');coaching.className='housing panel';coaching.style.marginTop='16px';
  coaching.innerHTML='<h2 class="t-h3">What changed in your answer?</h2>';
  main.append(coaching);
  if(!teaching.available){const note=document.createElement('p');note.className='note';note.textContent=teaching.reason==='SELF_PRACTICE_MODE_MISMATCH'?'Saved coaching comparison is available for Self Practice answers. These interview recordings still have the measured comparison above.':teaching.reason==='PROMPT_MISMATCH'?'These answers use different saved question versions. Review their coaching individually in Results.':'Both answers need supported transcript-based coaching for the same Self Practice question. Review each answer in Results; measured comparison remains available.';coaching.append(note);return disposeSelectors;}
  coaching.insertAdjacentHTML('beforeend','<p class="note">Compare saved, cited coaching—not a grade or proof of improvement. Each cited replay opens paused.</p><div class="compare-grid"></div><p class="note">'+esc(teaching.limitation)+'</p><p class="note" role="status"></p>');
  const grid=coaching.querySelector('.compare-grid'),status=coaching.querySelector('[role="status"]');let replay=null,opening=false,replayGeneration=0,seekLoaded=null;
  const clearReplay=()=>{if(replay){if(seekLoaded)replay.removeEventListener('loadedmetadata',seekLoaded);replay.pause();replay.removeAttribute('src');replay.load();replay.remove();replay=null;}seekLoaded=null;};
  for(const [sideKey,label]of [['baseline','Earlier answer'],['current','Selected answer']]){
    const side=teaching[sideKey],card=document.createElement('article');card.className='housing panel';card.innerHTML='<h3>'+label+'</h3>';
    for(const [key,title]of [['strongest','Strongest supported moment'],['improvement','Practice priority'],['drill','Next drill']]){
      const claim=side.coaching[key];card.insertAdjacentHTML('beforeend','<strong>'+title+'</strong><p>'+esc(claim?.text||'No supported coaching saved for this part.')+'</p>');
      if(!claim)continue;
      for(const moment of side.moments.filter(value=>claim.refs.includes(value.ref))){
        const button=document.createElement('button');button.type='button';button.className='btn btn-quiet';button.textContent=moment.label;button.disabled=!moment.available;
        button.onclick=async()=>{if(!current()||opening)return;opening=true;button.disabled=true;const request=++replayGeneration;status.textContent='Checking this saved citation…';
          try{const result=await freshTeachingReplay(controller,{baselineId:a.id,currentId:b.id,sideKey,side,moment,pageUrl:main.ownerDocument.location.href,isCurrent:()=>current()&&request===replayGeneration});if(!current()||request!==replayGeneration)return;if(!result)throw new Error('citation_changed');
            clearReplay();replay=document.createElement('video');replay.controls=true;replay.playsInline=true;replay.preload='metadata';replay.setAttribute('aria-label',label+' cited recording');replay.style.width='100%';
            const exactVideo=replay;seekLoaded=()=>{if(current()&&request===replayGeneration&&replay===exactVideo){exactVideo.pause();exactVideo.currentTime=result.at;}};
            replay.addEventListener('loadedmetadata',seekLoaded,{once:true});replay.src=result.url;coaching.append(replay);status.textContent=label+' · private replay paused at the cited moment.';
          }catch{if(current())status.textContent='This saved citation is unavailable or changed. Reopen the comparison before replaying it.';}finally{opening=false;if(current())button.disabled=!moment.available;}
        };card.append(button);
      }
    }
    card.insertAdjacentHTML('beforeend','<p class="note">'+esc(debriefConfidenceCopy(side.coaching.confidence))+'</p>');grid.append(card);
  }
  return()=>{disposeSelectors();replayGeneration++;clearReplay();};
}
