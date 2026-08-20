/**
 * MissionMed LOR Studio - production projection renderer.
 *
 * This is the piece the production hydration path has been missing. `assertProductionUi` in
 * lor-studio/adapters/production-hydration-adapter.mjs refuses to build a ProductionHydrationAdapter
 * without a UI that can paint durable server state, and public/lor-studio/production-adapter.js
 * keeps the Studio dark unless `window.LorProductionProjectionUi` resolves to such an object. This
 * file supplies exactly that object and nothing more.
 *
 * Three properties are load bearing and are asserted on both sides of the boundary:
 *
 *   presentationIsolation === 'production_projection_only'
 *   usesLocalStorage      === false
 *   canRevealPrototype    === false
 *
 * They are true by construction, not by declaration:
 *   - This file contains no reference to localStorage, sessionStorage, indexedDB or cookies. The
 *     rendered DOM is the only place server state ever lands, and it is rebuilt from the
 *     projection on every render.
 *   - The frozen prototype `<script type="application/x-lor-frozen-prototype">` is never read,
 *     moved, retyped or re-executed. The renderer additionally REFUSES to paint production data
 *     into a document where something else already un-quarantined it (see prototypeIsRevealed).
 *   - Nothing here issues a network request, evaluates a string, or installs an inline handler.
 *     Every node is built with createElement/textContent, so the page's strict CSP is never
 *     exercised and student data can never be interpreted as markup.
 *
 * Presentation only. Every authorization decision, every privacy allowlist and every field this
 * renderer is allowed to see was already made by the server (security/authorization-policy.js
 * projectCaseForActor, then adapters/production-hydration-adapter.mjs). The shape checks below are
 * defence in depth so a malformed payload renders nothing rather than something misleading; they
 * are never a substitute for a server gate and must never be relaxed to make a screen appear.
 *
 * Browser classic script: no import/export, no module scope. The factory is published on the
 * global the adapter looks for, and a namespaced alias is published for tests.
 */
(() => {
  'use strict';

  /** Mirrors domain/recommendation-case.js BUILDER_STEPS. The order is canonical. */
  const BUILDER_STEP_IDS = Object.freeze([
    'case_basics',
    'writer_relationship',
    'evidence_selection',
    'timeline_highlights',
    'writer_preferences',
    'consent_and_waiver',
    'review',
    'faculty_handoff',
  ]);

  const BUILDER_STEP_LABELS = Object.freeze({
    case_basics: 'Case basics',
    writer_relationship: 'Writer relationship',
    evidence_selection: 'Evidence selection',
    timeline_highlights: 'Timeline & highlights',
    writer_preferences: 'Writer preferences',
    consent_and_waiver: 'Consent & waiver',
    review: 'Review',
    faculty_handoff: 'Faculty handoff',
  });

  const STUDENT_PROJECTION_SCHEMA = 'missionmed.lor.student-projection.v1';
  const PRODUCTION_MOUNT_ID = 'lorProductionRoot';
  const FROZEN_PROTOTYPE_SCRIPT_ID = 'lorFrozenPrototypeRuntime';
  const FROZEN_PROTOTYPE_SCRIPT_TYPE = 'application/x-lor-frozen-prototype';
  const VALUE_DISPLAY_LIMIT = 240;

  /**
   * Every state this renderer can honestly express, with the words a student actually reads.
   *
   * No entry names an internal reason code, an exception, a table, a provider or a stack frame.
   * Reason codes arriving from the hydration adapter are mapped to one of these names and then
   * discarded - they are never written into the DOM. Each failure state also states, in plain
   * words, that nothing was stored, because that is the fact a student needs and the one they
   * cannot verify for themselves.
   */
  const STATE_COPY = Object.freeze({
    loading: Object.freeze({
      tone: 'info',
      label: 'Loading',
      title: 'Loading your recommendation case',
      detail: 'Opening the version saved in your MissionMed account.',
    }),
    empty: Object.freeze({
      tone: 'info',
      label: 'No case yet',
      title: 'You have not started a recommendation case',
      detail: 'Nothing has been saved to your account yet. Start a case to open the eight-step builder.',
    }),
    saving: Object.freeze({
      tone: 'info',
      label: 'Saving',
      title: 'Saving your change',
      detail: 'Sending this change to MissionMed. It is not stored until MissionMed confirms it.',
    }),
    saved: Object.freeze({
      tone: 'good',
      label: 'Saved',
      title: 'Saved to your account',
      detail: 'MissionMed accepted and stored this change.',
    }),
    save_failed: Object.freeze({
      tone: 'bad',
      label: 'Not saved',
      title: 'That change was not saved',
      detail: 'MissionMed did not accept the change, so nothing was stored. What you see is the last version MissionMed confirmed. You can try again.',
    }),
    version_conflict: Object.freeze({
      tone: 'warn',
      label: 'Out of date',
      title: 'This case changed somewhere else',
      detail: 'A newer version of this case is stored in your account, so your change was not saved. Reload the case before editing again so you are not working from an old version.',
    }),
    unauthorized: Object.freeze({
      tone: 'warn',
      label: 'Sign in again',
      title: 'Sign in again to continue',
      detail: 'Your MissionMed session is no longer valid for this case. Nothing was saved and nothing on your account was changed.',
    }),
    case_not_found: Object.freeze({
      tone: 'bad',
      label: 'Unavailable',
      title: 'We could not open this case',
      detail: 'This recommendation case is not available on your account. Nothing was saved and nothing on your account was changed.',
    }),
    durable_runtime_unavailable: Object.freeze({
      tone: 'bad',
      label: 'Unavailable',
      title: 'LOR Studio cannot open your case right now',
      detail: 'Your saved work is stored safely, but the Studio cannot reach it at the moment. Nothing was saved and nothing on your account was changed.',
    }),
    provider_unavailable: Object.freeze({
      tone: 'bad',
      label: 'Unavailable',
      title: 'A service LOR Studio depends on is offline',
      detail: 'The Studio cannot open your case until that service returns. Nothing was saved and nothing on your account was changed.',
    }),
    network_failure: Object.freeze({
      tone: 'warn',
      label: 'Offline',
      title: 'We could not reach MissionMed',
      detail: 'Check your connection and try again. Nothing was saved and nothing on your account was changed.',
    }),
    server_failure: Object.freeze({
      tone: 'bad',
      label: 'Error',
      title: 'Something went wrong on our side',
      detail: 'LOR Studio could not complete that request. Nothing was saved and nothing on your account was changed.',
    }),
  });

  const STATE_NAMES = Object.freeze(Object.keys(STATE_COPY));

  /**
   * `inline` states keep the confirmed workspace on screen and describe what happened to a write.
   * `full` states replace the workspace entirely, because the renderer can no longer vouch for
   * what is on screen. An inline state requested with nothing rendered escalates to `full`.
   */
  const STATE_SURFACE = Object.freeze({
    loading: 'full',
    empty: 'full',
    unauthorized: 'full',
    case_not_found: 'full',
    durable_runtime_unavailable: 'full',
    provider_unavailable: 'full',
    server_failure: 'full',
    saving: 'inline',
    saved: 'inline',
    save_failed: 'inline',
    version_conflict: 'inline',
    network_failure: 'inline',
  });

  /**
   * Hydration reason codes are internal. They select the words; they are never shown. Anything
   * unrecognised falls to the most conservative state rather than to a guess.
   */
  const BLOCK_REASON_STATES = Object.freeze({
    HYDRATION_PENDING: 'loading',
    HYDRATION_BLOCKED: 'durable_runtime_unavailable',
    DURABLE_RUNTIME_UNAVAILABLE: 'durable_runtime_unavailable',
    PROVIDER_UNAVAILABLE: 'provider_unavailable',
    NETWORK_FAILURE: 'network_failure',
    SERVER_FAILURE: 'server_failure',
    UNAUTHORIZED: 'unauthorized',
    CASE_NOT_FOUND: 'case_not_found',
    VERSION_CONFLICT: 'version_conflict',
    SAVE_FAILED: 'save_failed',
    NO_CASE: 'empty',
  });

  const SAVE_FAILURE_STATES = Object.freeze([
    'save_failed',
    'version_conflict',
    'network_failure',
    'server_failure',
    'unauthorized',
    'case_not_found',
    'durable_runtime_unavailable',
    'provider_unavailable',
  ]);

  const CASE_STATUS_TONES = Object.freeze({
    draft: 'info',
    faculty_invited: 'info',
    faculty_verified: 'info',
    faculty_review: 'warn',
    faculty_approved: 'good',
    delivered: 'good',
    closed: 'good',
    cancelled: 'bad',
  });

  const TONE_STAGE_CLASS = Object.freeze({
    info: 'stage info',
    good: 'stage good',
    warn: 'stage warn',
    bad: 'stage bad',
  });

  const TONE_CHIP_CLASS = Object.freeze({
    info: 'chip cy',
    good: 'chip gn',
    warn: 'chip em',
    bad: 'chip rd',
  });

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function humanize(value) {
    const text = String(value ?? '').replace(/[_-]+/gu, ' ').replace(/([a-z0-9])([A-Z])/gu, '$1 $2').trim();
    if (text === '') return 'Untitled';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Deterministic UTC rendering. Locale formatting would make the same case read differently on
   * two machines, and a timestamp a student cannot compare is worse than no timestamp.
   */
  function formatTimestamp(value) {
    if (!isNonEmptyString(value)) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    const date = new Date(parsed);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
      + ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
  }

  function truncate(text) {
    const value = String(text);
    return value.length > VALUE_DISPLAY_LIMIT ? `${value.slice(0, VALUE_DISPLAY_LIMIT)}…` : value;
  }

  /**
   * Student-authored builder data is arbitrary JSON. It is summarised, never interpreted, and it
   * always lands in the DOM as text.
   */
  function describeValue(value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value.trim() === '' ? '—' : truncate(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return 'None';
      const primitives = value.filter((item) => item === null || typeof item !== 'object');
      if (primitives.length === value.length) {
        return truncate(value.map((item) => (item === null ? '—' : String(item))).join(', '));
      }
      return `${value.length} ${value.length === 1 ? 'entry' : 'entries'}`;
    }
    if (isPlainObject(value)) {
      const keys = Object.keys(value);
      return keys.length === 0 ? 'None' : `${keys.length} ${keys.length === 1 ? 'field' : 'fields'}`;
    }
    return '—';
  }

  /**
   * The renderer's own tripwire. If anything in this document already un-quarantined the frozen
   * prototype, then whatever is on screen is synthetic, and painting durable data next to it would
   * be the exact confusion this whole boundary exists to prevent. The renderer refuses instead.
   */
  function prototypeIsRevealed(doc, win) {
    if (win && Reflect.get(win, '__LOR_FROZEN_PROTOTYPE_READY__') === true) return true;
    const runtime = win ? Reflect.get(win, '__LOR_STUDIO_RUNTIME__') : null;
    if (isPlainObject(runtime) && runtime.mode === 'synthetic_fixture') return true;
    if (doc.querySelector('script[data-lor-fixture-runtime]')) return true;
    const frozen = doc.getElementById(FROZEN_PROTOTYPE_SCRIPT_ID);
    if (frozen && String(frozen.getAttribute('type') || '') !== FROZEN_PROTOTYPE_SCRIPT_TYPE) return true;
    return false;
  }

  /**
   * Display validation. Anything that does not match refuses to render, so the failure is a
   * truthful "we could not open this case" rather than a half-painted workspace. This repeats a
   * subset of the server's checks on purpose and replaces none of them.
   */
  function assertRenderableStudentProjection(projection) {
    if (!isPlainObject(projection)) {
      throw new TypeError('A production projection object is required');
    }
    if (projection.schemaVersion !== STUDENT_PROJECTION_SCHEMA) {
      throw new TypeError('This renderer presents the student case projection only');
    }
    if (!isNonEmptyString(projection.caseId) || !isNonEmptyString(projection.status)) {
      throw new TypeError('The case projection is missing its identity or status');
    }
    if (!Number.isSafeInteger(projection.revision) || projection.revision < 0) {
      throw new TypeError('The case projection is missing a durable revision');
    }
    const builder = projection.builder;
    if (
      !isPlainObject(builder)
      || !isNonEmptyString(builder.sessionId)
      || builder.totalSteps !== BUILDER_STEP_IDS.length
      || !Array.isArray(builder.completedStepIds)
      || !isPlainObject(builder.stepData)
    ) {
      throw new TypeError('The case projection does not carry the canonical eight-step builder');
    }
    for (const field of ['studentEvidence', 'applicantOptions', 'consentReceipts', 'waiverReceipts']) {
      if (!Array.isArray(projection[field])) {
        throw new TypeError('The case projection is missing a required collection');
      }
    }
    if (!isPlainObject(projection.delivery) || !isNonEmptyString(projection.delivery.status)) {
      throw new TypeError('The case projection is missing its delivery state');
    }
    if (projection.finalDocument !== null && !isPlainObject(projection.finalDocument)) {
      throw new TypeError('The case projection carries an unreadable final document');
    }
    return projection;
  }

  /**
   * Display-side reading of the waiver chain. The server already verified the chain's integrity
   * (domain/receipts.js currentWaiverState, re-run inside the hydration adapter); this only reads
   * the decision that survived that verification so the screen can describe it.
   */
  function readWaiverState(waiverReceipts) {
    if (!Array.isArray(waiverReceipts) || waiverReceipts.length === 0) {
      return { decided: false, waived: null, receiptId: null, recordedAt: null };
    }
    const latest = waiverReceipts[waiverReceipts.length - 1];
    if (!isPlainObject(latest) || typeof latest.waived !== 'boolean') {
      return { decided: false, waived: null, receiptId: null, recordedAt: null };
    }
    return {
      decided: true,
      waived: latest.waived,
      receiptId: isNonEmptyString(latest.id) ? latest.id : null,
      recordedAt: isNonEmptyString(latest.recordedAt) ? latest.recordedAt : null,
    };
  }

  /**
   * @param {{ mount?: unknown, document?: unknown }} [options]
   */
  function createProductionProjectionUi(options) {
    const settings = isPlainObject(options) ? options : {};
    const providedMount = settings.mount;
    const doc = settings.document
      || (providedMount && providedMount.ownerDocument)
      || (typeof globalThis !== 'undefined' ? globalThis.document : null);
    if (!doc || typeof doc.createElement !== 'function' || typeof doc.getElementById !== 'function') {
      throw new TypeError('LOR Studio production projection UI requires a DOM document');
    }
    const win = doc.defaultView || (typeof globalThis !== 'undefined' ? globalThis : null);

    let mount = null;
    let currentState = 'loading';
    let renderedProjection = null;
    let selectedStepId = null;
    /** Baseline revision captured when a write left the browser; null when no write is in flight. */
    let pendingSaveBaselineRevision = null;
    let pendingSaveStepId = null;

    function resolveMount() {
      if (mount && mount.isConnected !== false) return mount;
      if (providedMount && typeof providedMount.appendChild === 'function') {
        mount = providedMount;
        return mount;
      }
      const existing = doc.getElementById(PRODUCTION_MOUNT_ID);
      if (existing) {
        mount = existing;
        return mount;
      }
      const created = doc.createElement('div');
      created.id = PRODUCTION_MOUNT_ID;
      created.className = 'lor-production-root';
      doc.body.appendChild(created);
      mount = created;
      return mount;
    }

    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function el(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    }

    function appendAll(parent, children) {
      for (const child of children) {
        if (child) parent.appendChild(child);
      }
      return parent;
    }

    function panel(headingText, children, headerExtras) {
      const section = el('section', 'panel');
      const head = el('div', 'pHead');
      head.appendChild(el('div', 'h2', headingText));
      appendAll(head, headerExtras || []);
      const body = el('div', 'pBody');
      appendAll(body, children);
      section.appendChild(head);
      section.appendChild(body);
      return section;
    }

    function row(title, subtitle, trailing) {
      const node = el('div', 'row');
      const main = el('div', 'rowMain');
      main.appendChild(el('div', 'rowT', title));
      if (subtitle !== undefined && subtitle !== null) main.appendChild(el('div', 'rowS', subtitle));
      node.appendChild(main);
      if (trailing) node.appendChild(trailing);
      return node;
    }

    function stateBanner(name) {
      const copy = STATE_COPY[name];
      const banner = el('div', 'panel lorProductionState');
      banner.id = 'lorProductionState';
      banner.dataset.state = name;
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      const head = el('div', 'pHead');
      head.appendChild(el('span', TONE_STAGE_CLASS[copy.tone] || TONE_STAGE_CLASS.info, copy.label));
      head.appendChild(el('div', 'h2', copy.title));
      const body = el('div', 'pBody');
      body.appendChild(el('p', 'sub', copy.detail));
      banner.appendChild(head);
      banner.appendChild(body);
      return banner;
    }

    function renderFullSurfaceState(name) {
      const host = resolveMount();
      clear(host);
      const view = el('section', 'live');
      view.dataset.view = 'state';
      view.appendChild(el('p', 'eyebrow', 'MissionMed LOR Studio'));
      view.appendChild(stateBanner(name));
      host.appendChild(view);
      renderedProjection = null;
      selectedStepId = null;
    }

    function renderInlineState(name) {
      const host = resolveMount();
      const view = host.querySelector('section[data-view="case"]');
      if (!view) {
        renderFullSurfaceState(name);
        return;
      }
      const existing = view.querySelector('#lorProductionState');
      const banner = stateBanner(name);
      if (existing) view.replaceChild(banner, existing);
      else view.insertBefore(banner, view.firstChild);
    }

    function applyState(name) {
      if (!Object.prototype.hasOwnProperty.call(STATE_COPY, name)) {
        // Refusing an unknown state is the point: the renderer has no vocabulary for it and will
        // not invent reassuring words for a situation it does not understand.
        throw new TypeError('Unknown LOR Studio presentation state');
      }
      currentState = name;
      if (STATE_SURFACE[name] === 'inline' && renderedProjection) renderInlineState(name);
      else renderFullSurfaceState(name);
      return name;
    }

    /**
     * Public state control. Deliberately cannot produce the saved indicator: `saved` is a claim
     * about durable server state, and markSaved is the only function allowed to make it, because
     * it is the only one that checks the server's answer.
     *
     * @param {string} name one of STATE_NAMES except 'saved'
     */
    function showState(name) {
      if (name === 'saved') {
        throw new TypeError('The saved indicator is only available through markSaved');
      }
      return applyState(name);
    }

    function buildHeader(projection) {
      const header = el('div', 'lorProductionHeader');
      header.appendChild(el('p', 'eyebrow', 'MissionMed LOR Studio · Live case'));
      const heading = el('h1', 'h1');
      heading.appendChild(doc.createTextNode('Recommendation '));
      heading.appendChild(el('em', null, 'case'));
      header.appendChild(heading);

      const strip = el('div', 'pHead');
      const tone = CASE_STATUS_TONES[projection.status] || 'info';
      strip.appendChild(el('span', TONE_STAGE_CLASS[tone], humanize(projection.status)));
      strip.appendChild(el('span', 'chip', `Case ${projection.caseId}`));
      strip.appendChild(el('span', 'chip', `Version ${projection.revision}`));
      header.appendChild(strip);
      header.appendChild(el(
        'p',
        'sub',
        'This is the version stored in your MissionMed account. Changes are only saved once MissionMed confirms them.',
      ));
      return header;
    }

    function buildStepRail(projection, completed) {
      const rail = el('div', 'stepRail');
      rail.setAttribute('role', 'tablist');
      rail.setAttribute('aria-label', 'Builder steps');
      for (const stepId of BUILDER_STEP_IDS) {
        const isDone = completed.has(stepId);
        const isCurrent = stepId === selectedStepId;
        const button = doc.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
        button.dataset.step = stepId;
        button.className = `${isCurrent ? 'on' : ''}${isDone ? ' done' : ''}`.trim();
        button.appendChild(el('span', 'dot'));
        button.appendChild(doc.createTextNode(BUILDER_STEP_LABELS[stepId]));
        // A listener, never an inline handler. It only changes which saved step is displayed:
        // no storage, no request, no mutation of the projection.
        button.addEventListener('click', () => {
          selectedStepId = stepId;
          renderCase(renderedProjection, currentState);
        });
        rail.appendChild(button);
      }
      return rail;
    }

    function buildProgressPipe(completed, currentStepId) {
      const pipe = el('div', 'pipe');
      for (const stepId of BUILDER_STEP_IDS) {
        const segment = el('i');
        if (completed.has(stepId)) segment.className = 'done';
        else if (stepId === currentStepId) segment.className = 'on';
        pipe.appendChild(segment);
      }
      return pipe;
    }

    function buildStepDetail(projection) {
      const container = el('div', 'lorProductionStepDetail');
      if (!selectedStepId) {
        container.appendChild(el('p', 'sub', 'Nothing has been saved in the builder yet.'));
        return container;
      }
      container.appendChild(el('div', 'h2', BUILDER_STEP_LABELS[selectedStepId]));
      const stepData = projection.builder.stepData[selectedStepId];
      if (!isPlainObject(stepData) || Object.keys(stepData).length === 0) {
        container.appendChild(el('p', 'sub', 'Nothing has been saved for this step yet.'));
        return container;
      }
      for (const key of Object.keys(stepData)) {
        container.appendChild(row(humanize(key), describeValue(stepData[key])));
      }
      return container;
    }

    function buildBuilderPanel(projection) {
      const completed = new Set(
        projection.builder.completedStepIds.filter((stepId) => typeof stepId === 'string'),
      );
      const completedCount = completed.size;
      const percent = Math.round((completedCount / BUILDER_STEP_IDS.length) * 100);
      const nextStepId = BUILDER_STEP_IDS[completedCount] || null;
      const autosavedAt = formatTimestamp(projection.builder.autosavedAt);

      const children = [
        buildProgressPipe(completed, projection.builder.currentStepId),
        el('p', 'sub', `${completedCount} of ${BUILDER_STEP_IDS.length} steps complete · ${percent}%`),
        buildStepRail(projection, completed),
      ];

      if (completedCount === 0 && Object.keys(projection.builder.stepData).length === 0) {
        children.push(el(
          'p',
          'sub',
          'The builder is empty. Nothing has been saved to your account for this case yet.',
        ));
      }

      for (const stepId of BUILDER_STEP_IDS) {
        const isDone = completed.has(stepId);
        const hasDraft = Object.prototype.hasOwnProperty.call(projection.builder.stepData, stepId);
        let detail;
        if (isDone) detail = 'Complete and saved.';
        else if (hasDraft) detail = 'Saved, not yet marked complete.';
        else detail = 'Not started.';
        const tone = isDone ? 'good' : (hasDraft ? 'warn' : 'info');
        const marker = el('span', TONE_CHIP_CLASS[tone], isDone ? 'Complete' : (hasDraft ? 'Saved' : 'To do'));
        children.push(row(BUILDER_STEP_LABELS[stepId], detail, marker));
      }

      children.push(buildStepDetail(projection));

      if (autosavedAt) {
        children.push(el('p', 'sub', `Last change stored by MissionMed: ${autosavedAt}.`));
      } else {
        children.push(el('p', 'sub', 'MissionMed has not stored a builder change for this case yet.'));
      }

      const extras = [
        el('span', 'chip cy', `${completedCount} of ${BUILDER_STEP_IDS.length} complete`),
      ];
      if (nextStepId) extras.push(el('span', 'chip dashed', `Next: ${BUILDER_STEP_LABELS[nextStepId]}`));
      return panel('Eight-step builder', children, extras);
    }

    function buildReceiptsPanel(projection) {
      const children = [];
      const consent = projection.consentReceipts;
      if (consent.length === 0) {
        children.push(el('p', 'sub', 'No consent has been recorded for this case yet.'));
      } else {
        for (const receipt of consent) {
          if (!isPlainObject(receipt)) continue;
          const scopes = Array.isArray(receipt.scopes) ? receipt.scopes.filter(isNonEmptyString) : [];
          const recordedAt = formatTimestamp(receipt.recordedAt);
          const parts = [];
          if (scopes.length > 0) parts.push(`Scope: ${scopes.join(', ')}`);
          if (isNonEmptyString(receipt.policyVersion)) parts.push(`Policy ${receipt.policyVersion}`);
          if (recordedAt) parts.push(recordedAt);
          children.push(row('Consent recorded', parts.join(' · ') || 'Recorded.', el('span', 'chip gn', 'On file')));
        }
      }

      const waiver = readWaiverState(projection.waiverReceipts);
      if (!waiver.decided) {
        children.push(row(
          'Waiver decision',
          'You have not recorded a waiver decision yet.',
          el('span', 'chip dashed', 'Not decided'),
        ));
      } else {
        const recordedAt = formatTimestamp(waiver.recordedAt);
        const detail = waiver.waived
          ? 'You waived your right to read the finished letter.'
          : 'You kept your right to read the finished letter.';
        children.push(row(
          'Waiver decision',
          recordedAt ? `${detail} Recorded ${recordedAt}.` : detail,
          el('span', waiver.waived ? 'chip em' : 'chip gn', waiver.waived ? 'Waived' : 'Not waived'),
        ));
      }

      const extras = [el(
        'span',
        'chip',
        `${consent.length} consent · ${projection.waiverReceipts.length} waiver`,
      )];
      return panel('Consent & waiver receipts', children, extras);
    }

    function buildFinalDocumentPanel(projection) {
      const finalDocument = projection.finalDocument;
      const waiver = readWaiverState(projection.waiverReceipts);

      // Released is asserted only from the server's own release timestamp. Absent that string this
      // panel says the letter is not available, whatever else the payload happens to contain.
      const releasedAt = isPlainObject(finalDocument)
        ? formatTimestamp(finalDocument.releasedToStudentAt)
        : null;
      const released = Boolean(finalDocument) && releasedAt !== null;

      if (!released) {
        let detail;
        if (waiver.decided && waiver.waived === true) {
          detail = 'You waived your right to read this letter, so the finished letter is not shared with you.';
        } else if (waiver.decided) {
          detail = 'No finished letter has been released to you yet.';
        } else {
          detail = 'No finished letter has been released to you. Your waiver decision has not been recorded yet.';
        }
        return panel('Final letter', [el('p', 'sub', detail)], [el('span', 'chip dashed', 'Not released')]);
      }

      const card = el('div', 'draftCard sel');
      const head = el('div', 'dHead');
      head.appendChild(el('div', 'h2', 'Released to you'));
      head.appendChild(el('span', 'stage good', `Released ${releasedAt}`));
      card.appendChild(head);

      const body = el('div', 'dBody');
      body.textContent = isNonEmptyString(finalDocument.text)
        ? finalDocument.text
        : 'MissionMed released this letter but did not include its text.';
      card.appendChild(body);

      const foot = el('div', 'dFoot');
      if (isNonEmptyString(finalDocument.mimeType)) foot.appendChild(el('span', 'chip', finalDocument.mimeType));
      if (isNonEmptyString(finalDocument.contentHash)) {
        foot.appendChild(el('span', 'chip', `Fingerprint ${finalDocument.contentHash.slice(0, 12)}`));
      }
      card.appendChild(foot);

      return panel('Final letter', [card], [el('span', 'chip gn', 'Released')]);
    }

    function buildDeliveryPanel(projection) {
      const delivery = projection.delivery;
      const deliveredAt = formatTimestamp(delivery.deliveredAt);
      const children = [
        row('Delivery status', humanize(delivery.status)),
        row(
          'Destination',
          isNonEmptyString(delivery.destinationClass) ? humanize(delivery.destinationClass) : 'Not set.',
        ),
        row('Delivered', deliveredAt || 'Not delivered yet.'),
      ];
      return panel('Delivery', children);
    }

    function buildEvidencePanel(projection) {
      const children = [];
      const evidence = projection.studentEvidence;
      const options = projection.applicantOptions;
      if (evidence.length === 0) {
        children.push(el('p', 'sub', 'You have not added any evidence to this case yet.'));
      } else {
        children.push(row(
          'Evidence items',
          `${evidence.length} ${evidence.length === 1 ? 'item' : 'items'} saved to your account.`,
          el('span', 'chip gn', String(evidence.length)),
        ));
      }
      children.push(row(
        'Applicant options',
        options.length === 0
          ? 'No applicant options saved yet.'
          : `${options.length} ${options.length === 1 ? 'option' : 'options'} saved to your account.`,
        el('span', options.length === 0 ? 'chip dashed' : 'chip gn', String(options.length)),
      ));
      return panel('Evidence', children);
    }

    function pickSelectedStep(projection) {
      const stepData = projection.builder.stepData;
      const completed = projection.builder.completedStepIds.filter((stepId) => typeof stepId === 'string');
      if (selectedStepId && BUILDER_STEP_IDS.includes(selectedStepId)) return selectedStepId;
      if (isNonEmptyString(projection.builder.currentStepId)
        && BUILDER_STEP_IDS.includes(projection.builder.currentStepId)) {
        return projection.builder.currentStepId;
      }
      const lastCompleted = completed[completed.length - 1];
      if (lastCompleted && BUILDER_STEP_IDS.includes(lastCompleted)) return lastCompleted;
      const firstWithData = BUILDER_STEP_IDS.find(
        (stepId) => Object.prototype.hasOwnProperty.call(stepData, stepId),
      );
      return firstWithData || null;
    }

    function renderCase(projection, stateName) {
      const host = resolveMount();
      selectedStepId = pickSelectedStep(projection);
      clear(host);
      const view = el('section', 'live');
      view.dataset.view = 'case';
      if (stateName && Object.prototype.hasOwnProperty.call(STATE_COPY, stateName)) {
        view.appendChild(stateBanner(stateName));
      }
      view.appendChild(buildHeader(projection));

      const grid = el('div', 'homeGrid');
      const primary = el('div');
      primary.appendChild(buildBuilderPanel(projection));
      const secondary = el('div');
      secondary.appendChild(buildReceiptsPanel(projection));
      secondary.appendChild(buildFinalDocumentPanel(projection));
      secondary.appendChild(buildEvidencePanel(projection));
      secondary.appendChild(buildDeliveryPanel(projection));
      grid.appendChild(primary);
      grid.appendChild(secondary);
      view.appendChild(grid);
      host.appendChild(view);
      renderedProjection = projection;
    }

    /**
     * Close the surface. Called by the hydration adapter before it starts and again on any
     * failure, and by production-adapter.js on every blocked path.
     *
     * @param {{ reasonCode?: string, revealPrototype?: boolean }} [request]
     */
    async function block(request) {
      const reasonCode = isPlainObject(request) ? String(request.reasonCode ?? '') : '';
      const state = Object.prototype.hasOwnProperty.call(BLOCK_REASON_STATES, reasonCode)
        ? BLOCK_REASON_STATES[reasonCode]
        : 'durable_runtime_unavailable';
      pendingSaveBaselineRevision = null;
      pendingSaveStepId = null;
      // Close first, argue second: even a caller asking for a reveal gets the closed screen before
      // the refusal is raised.
      applyState(state);
      if (!isPlainObject(request) || request.revealPrototype !== false) {
        throw new TypeError('LOR Studio production UI cannot reveal the frozen prototype');
      }
      return Object.freeze({
        blocked: true,
        state,
        prototypeRevealed: false,
        localStorageUsed: false,
      });
    }

    /**
     * Paint the durable student projection.
     *
     * Context arrives in two shapes - the server-side ProductionHydrationAdapter sends
     * `actorRole`, the browser adapter sends `caseId` - so only the fields both guarantee are
     * required, and any that is present must be correct.
     *
     * @param {unknown} projection
     * @param {Record<string, unknown>} [context]
     */
    async function renderProductionProjection(projection, context) {
      const ctx = isPlainObject(context) ? context : {};
      if (ctx.revealPrototype !== false || ctx.persistToLocalStorage !== false) {
        applyState('durable_runtime_unavailable');
        throw new TypeError('LOR Studio production rendering requires prototype and storage isolation');
      }
      if (ctx.runtimeMode !== 'live') {
        applyState('durable_runtime_unavailable');
        throw new TypeError('LOR Studio production rendering requires the live runtime');
      }
      if (ctx.actorRole !== undefined && ctx.actorRole !== 'student') {
        applyState('durable_runtime_unavailable');
        throw new TypeError('This renderer presents the student case view only');
      }
      if (prototypeIsRevealed(doc, win)) {
        applyState('durable_runtime_unavailable');
        throw new TypeError('The frozen prototype is not quarantined; production data will not be rendered');
      }
      let renderable;
      try {
        renderable = assertRenderableStudentProjection(projection);
        if (ctx.projectionSchema !== undefined && ctx.projectionSchema !== renderable.schemaVersion) {
          throw new TypeError('The case projection does not match the schema the runtime authorized');
        }
        if (ctx.caseId !== undefined && String(ctx.caseId) !== renderable.caseId) {
          throw new TypeError('The case projection does not match the case that was requested');
        }
      } catch (error) {
        applyState('case_not_found');
        throw error;
      }

      pendingSaveBaselineRevision = null;
      pendingSaveStepId = null;
      selectedStepId = null;
      currentState = 'loaded';
      renderCase(renderable, null);
      return Object.freeze({
        rendered: true,
        caseId: renderable.caseId,
        revision: renderable.revision,
        prototypeRevealed: false,
        localStorageUsed: false,
      });
    }

    /**
     * Declare that a write has left the browser. Nothing is stored client side; this only records
     * the revision the write was based on, which is what a later "saved" claim is checked against.
     *
     * @param {{ stepId?: string }} [request]
     */
    function markSaving(request) {
      if (!renderedProjection) {
        throw new TypeError('A case must be rendered before a save can be reported');
      }
      pendingSaveBaselineRevision = renderedProjection.revision;
      pendingSaveStepId = isPlainObject(request) && isNonEmptyString(request.stepId)
        ? request.stepId
        : null;
      applyState('saving');
      return Object.freeze({
        saving: true,
        baselineRevision: pendingSaveBaselineRevision,
        stepId: pendingSaveStepId,
      });
    }

    /**
     * The only path to a "Saved" indicator.
     *
     * A saved badge is a claim about the server's durable state, so it is not derived from
     * anything the browser knows. It requires, all of them: a write that this UI saw leave; an
     * accepted HTTP status; and a projection returned in that response whose revision is strictly
     * higher than the one the write was based on. Every LOR write goes through
     * mutateRecommendationCase, which increments the revision, so an unchanged revision means the
     * server did not store anything - and this refuses to say otherwise. Optimism is not evidence.
     *
     * @param {{ status?: number, projection?: unknown, body?: { case?: unknown } }} acknowledgement
     */
    function markSaved(acknowledgement) {
      const refuse = (reason, state) => {
        pendingSaveBaselineRevision = null;
        pendingSaveStepId = null;
        applyState(state || 'save_failed');
        return Object.freeze({ saved: false, reason });
      };

      if (pendingSaveBaselineRevision === null) {
        // Nothing was sent, so nothing can have been accepted. Leave the screen exactly as it is.
        return Object.freeze({ saved: false, reason: 'no_write_in_flight' });
      }
      if (!isPlainObject(acknowledgement)) return refuse('no_server_acknowledgement');

      const status = Number(acknowledgement.status);
      if (status !== 200 && status !== 201) {
        return refuse('server_did_not_accept', status === 409 ? 'version_conflict' : 'save_failed');
      }

      const acknowledged = isPlainObject(acknowledgement.projection)
        ? acknowledgement.projection
        : (isPlainObject(acknowledgement.body) ? acknowledgement.body.case : null);
      let renderable;
      try {
        renderable = assertRenderableStudentProjection(acknowledged);
      } catch {
        return refuse('acknowledgement_not_a_case_projection');
      }
      if (!renderedProjection || renderable.caseId !== renderedProjection.caseId) {
        return refuse('acknowledgement_names_another_case');
      }
      if (renderable.revision <= pendingSaveBaselineRevision) {
        // The server answered about a revision no newer than the one being edited: it did not
        // durably store this write, so no saved badge.
        return refuse('server_revision_did_not_advance', 'version_conflict');
      }

      pendingSaveBaselineRevision = null;
      pendingSaveStepId = null;
      selectedStepId = null;
      currentState = 'saved';
      renderCase(renderable, 'saved');
      return Object.freeze({
        saved: true,
        caseId: renderable.caseId,
        revision: renderable.revision,
      });
    }

    /**
     * @param {string} kind one of SAVE_FAILURE_STATES
     */
    function markSaveFailed(kind) {
      const state = SAVE_FAILURE_STATES.includes(kind) ? kind : 'save_failed';
      pendingSaveBaselineRevision = null;
      pendingSaveStepId = null;
      applyState(state);
      return Object.freeze({ saved: false, state });
    }

    function showEmptyWorkspace() {
      pendingSaveBaselineRevision = null;
      pendingSaveStepId = null;
      return applyState('empty');
    }

    const ui = {
      block,
      renderProductionProjection,
      showState,
      showEmptyWorkspace,
      markSaving,
      markSaved,
      markSaveFailed,
      get state() {
        return currentState;
      },
      get renderedCaseId() {
        return renderedProjection ? renderedProjection.caseId : null;
      },
      get renderedRevision() {
        return renderedProjection ? renderedProjection.revision : null;
      },
      get saveInFlight() {
        return pendingSaveBaselineRevision !== null;
      },
      stateNames: STATE_NAMES,
      builderStepIds: BUILDER_STEP_IDS,
    };

    // The three isolation flags are non-writable and non-configurable: assertProductionUi reads
    // them once at construction, so nothing may flip them afterwards.
    Object.defineProperties(ui, {
      presentationIsolation: { value: 'production_projection_only', enumerable: true },
      usesLocalStorage: { value: false, enumerable: true },
      canRevealPrototype: { value: false, enumerable: true },
    });
    return Object.freeze(ui);
  }

  // production-adapter.js reads this global and accepts either a factory or a built object.
  globalThis.LorProductionProjectionUi = createProductionProjectionUi;
  globalThis.MissionMedLorProductionProjectionUi = Object.freeze({
    createProductionProjectionUi,
    BUILDER_STEP_IDS,
    STATE_NAMES,
  });
})();
