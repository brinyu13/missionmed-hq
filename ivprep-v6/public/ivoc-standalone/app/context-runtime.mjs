import { ivocApi } from './api.mjs';
import { assertContextResult } from './context-contracts.mjs';
import { RealAnalyticsEngine } from './real-runtime.mjs';
import { AccountRecordingController } from './recording.mjs';

const API = '/api/ivoc/v1/context';

async function contextRequest(body) {
  const response = await fetch(API, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-MMHQ-CSRF': ivocApi.csrfToken,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: 'context_response_invalid' }));
  if (!response.ok) throw new Error(payload.error || `Context request failed (${response.status})`);
  return payload;
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = String(value ?? '');
}

function observationText(observation) {
  const value = Number.isFinite(Number(observation.value)) ? Number(observation.value) : observation.value;
  return `${observation.metric}: ${value} ${observation.unit || ''} · ${observation.reliability} · ${Math.round(observation.coverage * 100)}% coverage`;
}

function renderResults(root, result) {
  assertContextResult(result);
  root.querySelector('[data-context-capture]').hidden = true;
  const panel = root.querySelector('[data-context-results]');
  panel.hidden = false;
  setText(panel, '[data-result-question]', `${result.question.canonicalText} · ${result.question.questionId} r${result.question.revision} · ${result.question.source}`);
  setText(panel, '[data-result-truth]', result.transcript.truthLabel);
  setText(panel, '[data-result-transcript]', result.transcript.status === 'AVAILABLE' ? result.transcript.text : `Transcript unavailable: ${result.transcript.reason}`);
  const observations = panel.querySelector('[data-result-observations]');
  observations.replaceChildren(...result.analyticsObservations.map((entry) => {
    const item = document.createElement('li');
    item.textContent = observationText(entry);
    return item;
  }));
  setText(panel, '[data-result-derived]', result.masterDerived
    ? `${result.masterDerived.wordsPerMinute} WPM · ${result.masterDerived.basis}`
    : 'MASTER_DERIVED pace unavailable');
  const semantic = panel.querySelector('[data-result-semantic]');
  if (result.analysis.status === 'AVAILABLE' && result.analysis.semanticObservations.length) {
    semantic.replaceChildren(...result.analysis.semanticObservations.map((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.text} · evidence: ${entry.transcriptSegmentIds.join(', ')}`;
      return item;
    }));
  } else {
    const item = document.createElement('li');
    item.textContent = result.analysis.status === 'AVAILABLE'
      ? 'No supported semantic observation was returned.'
      : `Context unavailable: ${result.analysis.reason}`;
    semantic.replaceChildren(item);
  }
  setText(panel, '[data-result-cue]', result.coachCommand.cue);
  setText(panel, '[data-result-provenance]', result.analysis.status === 'AVAILABLE'
    ? `${result.analysis.provenance.provider} · ${result.analysis.provenance.model} · registry ${result.coachCommand.registryVersion}`
    : `NO_CUE · registry ${result.coachCommand.registryVersion}`);
  setText(panel, '[data-result-limitations]', (result.analysis.limitations || []).join(' · ') || 'No additional limitations reported.');
  panel.querySelector('[data-result-heading]')?.focus();
}

function fallbackResult({ sessionId, answerId, question, analyticsObservations = [], reason }) {
  return {
    schema: 'missionmed.ivoc.context.result.v1',
    sessionId,
    answerId,
    question,
    transcript: {
      status: 'UNAVAILABLE', transcriptId: null, provider: null, model: null, adapter: null,
      truthLabel: 'UNAVAILABLE', reason, text: '', segments: [], wordCount: 0,
      timestamps: 'UNAVAILABLE', provenance: { storage: 'EPHEMERAL_REQUEST_MEMORY_ONLY' },
    },
    analysis: {
      status: 'UNAVAILABLE', schema: 'missionmed.ivoc.context.analysis.v1',
      analysisId: null, reason, semanticObservations: [], contextTags: [],
      limitations: [reason], score: 0, coverage: 0,
      provenance: { provider: 'server-only', model: null, policyVersion: 'context-v1', truthLabel: 'UNAVAILABLE' },
    },
    analyticsObservations,
    masterDerived: null,
    coachCommand: {
      schema: 'missionmed.ivoc.coach-command.v1', commandId: `no-cue-${Date.now()}`,
      sessionId, answerId, cue: 'NO_CUE', source: 'AI', issuedAtMs: 0, ttlMs: 0,
      refractoryMs: 0, priority: 0,
      evidence: { analyticsEventIds: [], contextAnalysisId: null, transcriptSegmentIds: [] },
      score: 0, coverage: 0, registryVersion: '2026-09-02.1', assignmentVersion: null,
      idempotencyKey: `${sessionId}:${answerId}:NO_CUE:0`, supersedes: null, truthLabel: 'UNAVAILABLE',
    },
    persistence: { transcript: false, analysis: false, behaviorRegistry: false, coachCommand: false },
  };
}

export async function contextLabScreen(root) {
  root.innerHTML = `
    <section class="post-wrap" aria-labelledby="contextLabTitle">
      <header class="post-hero">
        <p class="eyebrow">FOUNDER CANDIDATE · CONTEXT INTELLIGENCE V1</p>
        <h1 id="contextLabTitle">One real answer. One evidence-bound cue.</h1>
        <p>Analytics observes. Context interprets the transcript. Unsupported evidence returns NO_CUE.</p>
      </header>
      <div class="settings-card" data-context-capture>
        <p class="eyebrow">REAL CORPUS QUESTION</p>
        <h2 data-context-question>Loading CORE-01 from the 193-question corpus…</h2>
        <p data-context-question-meta aria-live="polite">Checking authenticated candidate access.</p>
        <div style="position:relative;max-width:760px;aspect-ratio:16/9;background:#08131f;border-radius:18px;overflow:hidden">
          <video data-context-video autoplay muted playsinline style="width:100%;height:100%;object-fit:cover"></video>
          <canvas data-context-overlay aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
        </div>
        <p data-context-status role="status" aria-live="polite">Preparing candidate…</p>
        <div class="post-actions">
          <button class="btn btn-primary" type="button" data-context-start disabled>START REAL CAPTURE</button>
          <button class="btn btn-gold" type="button" data-context-finish hidden>END, TRANSCRIBE &amp; ANALYZE</button>
        </div>
        <p class="truth-note">Answer audio is sealed through the existing private recording path, then sent server-side to OpenAI only when the transcript flag is enabled. Transcript, semantic analysis, registry decision, and command are not persisted.</p>
      </div>
      <section class="settings-card" data-context-results hidden aria-labelledby="contextResultsTitle">
        <p class="eyebrow">SIMPLE RESULTS · SAME STORED ANALYTICS TRUTH</p>
        <h2 id="contextResultsTitle" data-result-heading tabindex="-1">Context result</h2>
        <h3>Question</h3><p data-result-question></p>
        <h3>Transcript <span class="status-pill" data-result-truth></span></h3><p data-result-transcript></p>
        <h3>Context interpretation</h3><ul data-result-semantic></ul>
        <h3>Objective Analytics observations</h3><ul data-result-observations></ul>
        <h3>Master-derived pace</h3><p data-result-derived></p>
        <h3>One coaching command</h3><p class="t-display-md" data-result-cue></p>
        <p data-result-provenance></p>
        <h3>Limitations</h3><p data-result-limitations></p>
        <a class="btn btn-secondary" href="#/home">RETURN HOME</a>
      </section>
    </section>`;

  const start = root.querySelector('[data-context-start]');
  const finish = root.querySelector('[data-context-finish]');
  const status = root.querySelector('[data-context-status]');
  const video = root.querySelector('[data-context-video]');
  const overlay = root.querySelector('[data-context-overlay]');
  let question = null;
  let engine = null;
  let recorder = null;
  let accountSession = null;
  let running = false;
  let raf = 0;
  let lastTs = performance.now();

  function loop(ts) {
    if (!running) return;
    engine?.tick(Math.min(0.1, Math.max(0, (ts - lastTs) / 1000)));
    lastTs = ts;
    raf = requestAnimationFrame(loop);
  }

  async function prepare() {
    try {
      await ivocApi.bootstrap();
      const prepared = await contextRequest({ action: 'prepare', questionId: 'CORE-01' });
      question = prepared.question;
      setText(root, '[data-context-question]', question.canonicalText);
      setText(root, '[data-context-question-meta]', `${question.questionId} · revision ${question.revision} · ${question.source} · transcript ${prepared.transcriptProvider}`);
      status.textContent = 'Ready. Camera and microphone permission will be requested when you start.';
      start.disabled = false;
    } catch (error) {
      status.textContent = `Candidate unavailable: ${error.message}`;
      start.disabled = true;
    }
  }

  async function startCapture() {
    start.disabled = true;
    status.textContent = 'Requesting real camera and microphone…';
    try {
      engine = new RealAnalyticsEngine({ video, overlayCanvas: overlay, csrfToken: ivocApi.csrfToken });
      const stream = await engine.start();
      accountSession = await ivocApi.createSession({
        title: question.canonicalText,
        sessionType: 'question',
        questionId: question.questionId,
        questionText: question.canonicalText,
        analyticsSchema: 'ivoc.analytics.v1',
        recordingEnabled: true,
        context: {},
      });
      recorder = new AccountRecordingController({
        api: ivocApi,
        stream,
        enabled: true,
        sessionId: accountSession.id,
        title: question.canonicalText,
        questionId: question.questionId,
        sessionNow: () => Math.max(0, Number(engine.frame()?.t || 0) * 1000),
      });
      if (!(await recorder.start())) throw new Error('Recording could not start in this browser.');
      running = true;
      lastTs = performance.now();
      raf = requestAnimationFrame(loop);
      finish.hidden = false;
      status.textContent = 'Recording and Analytics are live. Answer the question, then end the capture.';
    } catch (error) {
      engine?.destroy();
      status.textContent = `Capture unavailable: ${error.message}`;
      start.disabled = false;
    }
  }

  async function finishCapture() {
    finish.disabled = true;
    status.textContent = 'Sealing the existing recording and completing Analytics…';
    let runtimeResult = null;
    let recordingResult = null;
    try {
      [recordingResult, runtimeResult] = await Promise.all([recorder.stopAndSeal(), engine.finish()]);
      running = false;
      cancelAnimationFrame(raf);
      const analytics = runtimeResult?.analytics;
      if (!analytics) throw new Error('Analytics did not return an answer envelope.');
      const recordingId = recordingResult?.recording?.id || recorder?.recording?.id;
      const durationMs = Math.max(0, Math.round(Number(recordingResult?.durationMs ?? analytics.durationMs) || 0));
      await ivocApi.saveResults(accountSession.id, {
        schema: 'ivoc.analytics.v1',
        schemaVersion: 1,
        sessionDurationMs: analytics.durationMs,
        recordingDurationMs: recordingResult?.recordingDurationMs ?? null,
        playableDurationMs: durationMs,
        activeAnsweringDurationMs: analytics.durationMs,
        analyticsObservationDurationMs: analytics.durationMs,
        scores: {},
        counters: {},
        history: runtimeResult?.history || [],
        analytics,
      });
      status.textContent = 'Analytics saved. Running real server-side transcription and Context…';
      let result;
      try {
        result = await contextRequest({
          action: 'analyze',
          sessionId: accountSession.id,
          recordingId,
          answerId: analytics.answerId,
          questionId: question.questionId,
          analyticsEvents: analytics.studentEvents,
        });
      } catch (error) {
        result = fallbackResult({
          sessionId: accountSession.id,
          answerId: analytics.answerId,
          question,
          analyticsObservations: [],
          reason: `CONTEXT_UNAVAILABLE: ${error.message}`.slice(0, 120),
        });
      }
      renderResults(root, result);
    } catch (error) {
      status.textContent = `Analytics/recording save failed safely: ${error.message}`;
      finish.disabled = false;
    } finally {
      recordingResult = null;
      runtimeResult = null;
    }
  }

  start.addEventListener('click', startCapture);
  finish.addEventListener('click', finishCapture);
  void prepare();

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      recorder?.destroy();
      engine?.destroy();
    },
  };
}
