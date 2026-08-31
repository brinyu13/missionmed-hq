/**
 * MissionMed LOR Studio - production projection renderer.
 *
 * This is the piece the production hydration path has been missing. `assertProductionUi` in
 * lor-studio/adapters/production-hydration-adapter.mjs refuses to build a ProductionHydrationAdapter
 * without a UI that can paint durable server state, and public/lor-studio/production-adapter.js
 * keeps the Studio dark unless `window.LorProductionProjectionUi` resolves to such an object. This
 * file supplies that object through the Founder-approved LOR Studio shell. The visual shell is
 * preserved from the frozen prototype, while every case fact and every write comes from the
 * production projection/command boundary below. No synthetic person, writer, program, score, or
 * letter is ever revived.
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
    case_basics: 'Letter context',
    writer_relationship: 'Choose your writer',
    evidence_selection: 'Evidence portfolio',
    timeline_highlights: 'Clinical story',
    writer_preferences: 'Letter direction',
    consent_and_waiver: 'Privacy & access',
    review: 'Review packet',
    faculty_handoff: 'Writer handoff',
  });

  const STUDENT_PROJECTION_SCHEMA = 'missionmed.lor.student-projection.v1';
  const FACULTY_PROJECTION_SCHEMA = 'missionmed.lor.faculty-projection.v1';
  const MENTOR_PROJECTION_SCHEMA = 'missionmed.lor.mentor-projection.v1';
  const PRODUCTION_MOUNT_ID = 'lorProductionRoot';
  const MATRIX_DASHBOARD_URL = 'https://missionmedinstitute.com/member-dashboard/#dashboard';
  const FROZEN_PROTOTYPE_SCRIPT_ID = 'lorFrozenPrototypeRuntime';
  const FROZEN_PROTOTYPE_SCRIPT_TYPE = 'application/x-lor-frozen-prototype';
  const VALUE_DISPLAY_LIMIT = 240;

  /**
   * Autosave settle window. Long enough that ordinary typing is one write rather than one write
   * per keystroke, short enough that a student who stops typing learns the outcome immediately.
   */
  const AUTOSAVE_DEBOUNCE_MS = 700;

  /**
   * The two client-supplied receipt facts this build asserts, and nothing else. Receipt identity,
   * the recorded timestamp, the acting principal and the integrity hash are all minted by the
   * server (services/recommendation-case-service.js #mintReceipt); the request body carries only
   * the decision itself, and the server's field allowlist rejects anything more.
   */
  const CONSENT_POLICY_VERSION = 'dr-133-identified-education-record-v1';
  const CONSENT_WITHDRAWN_SCOPE = 'consent_withdrawn';
  const CONSENT_SCOPES = Object.freeze([
    'builder_autosave',
    'faculty_handoff',
    'ai_drafting',
    'evidence_grounding',
  ]);

  /**
   * The editable shape of each builder step.
   *
   * The domain stores step data as free-form JSON (domain/recommendation-case.js validateStepData),
   * so this table is a PRESENTATION choice about which fields the Studio offers. It is never a
   * validation boundary and never an authorization one. Anything already stored under a key that
   * is not listed here is preserved verbatim on every write (composeStepPayload): a builder PATCH
   * replaces the whole step object, so dropping unknown keys would silently delete saved work.
   */
  const STEP_FIELDS = Object.freeze({
    case_basics: Object.freeze([
      Object.freeze({ key: 'intentPath', label: 'How you want MissionMed to help', control: 'text' }),
      Object.freeze({ key: 'programType', label: 'Program you are applying to', control: 'text' }),
      Object.freeze({ key: 'applicationCycle', label: 'Application cycle', control: 'text' }),
      Object.freeze({ key: 'summary', label: 'What this letter needs to prove', control: 'textarea' }),
    ]),
    writer_relationship: Object.freeze([
      Object.freeze({ key: 'writerName', label: 'Faculty writer name', control: 'text' }),
      Object.freeze({ key: 'writerRole', label: 'Role and specialty', control: 'text' }),
      Object.freeze({ key: 'institution', label: 'Institution or rotation', control: 'text' }),
      Object.freeze({ key: 'relationshipLength', label: 'How long they observed your work', control: 'text' }),
      Object.freeze({ key: 'relationshipSummary', label: 'What they have seen you do', control: 'textarea' }),
    ]),
    evidence_selection: Object.freeze([
      Object.freeze({ key: 'priorityEvidence', label: 'The evidence that matters most', control: 'text' }),
      Object.freeze({ key: 'evidenceSummary', label: 'Why that evidence matters', control: 'textarea' }),
      Object.freeze({ key: 'competencyEvidence', label: 'Competencies this evidence demonstrates', control: 'textarea' }),
    ]),
    timeline_highlights: Object.freeze([
      Object.freeze({ key: 'standoutMoment', label: 'The moment you want named', control: 'text' }),
      Object.freeze({ key: 'timelineSummary', label: 'How that moment unfolded', control: 'textarea' }),
      Object.freeze({ key: 'outcome', label: 'What changed because of your actions', control: 'textarea' }),
    ]),
    writer_preferences: Object.freeze([
      Object.freeze({ key: 'tonePreference', label: 'Tone you are asking for', control: 'text' }),
      Object.freeze({ key: 'writingRequest', label: 'What the writer asked you to prepare', control: 'text' }),
      Object.freeze({ key: 'notesForWriter', label: 'Anything else the writer should know', control: 'textarea' }),
    ]),
    consent_and_waiver: Object.freeze([
      Object.freeze({ key: 'understanding', label: 'What you understand this letter will be used for', control: 'textarea' }),
    ]),
    review: Object.freeze([
      Object.freeze({ key: 'reviewNotes', label: 'Anything you still want to change', control: 'textarea' }),
    ]),
    faculty_handoff: Object.freeze([
      Object.freeze({ key: 'deadline', label: 'Date you need this by', control: 'text' }),
      Object.freeze({ key: 'handoffMessage', label: 'Message to your writer', control: 'textarea' }),
    ]),
  });

  /**
   * Transport outcomes and HTTP statuses, mapped to the presentation vocabulary above.
   *
   * Nothing in this table is a reason code, and no branch of it falls through to a raw status: an
   * unrecognised status lands on `server_failure`, which is the most conservative honest thing the
   * renderer can say about a request it does not understand.
   */
  const STATUS_STATES = Object.freeze({
    400: 'save_failed',
    401: 'unauthorized',
    403: 'unauthorized',
    404: 'case_not_found',
    409: 'version_conflict',
    413: 'save_failed',
    422: 'save_failed',
    423: 'durable_runtime_unavailable',
    500: 'server_failure',
    502: 'provider_unavailable',
    503: 'provider_unavailable',
    504: 'network_failure',
  });

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

  /**
   * Founder-approved information architecture. These are presentation routes inside the already
   * authorized projection; changing a route never fetches, stores, or broadens a field.
   */
  const ROLE_VIEWS = Object.freeze({
    student: Object.freeze([
      Object.freeze(['build', '✦ Build My LOR']),
      Object.freeze(['library', 'Examples & Templates']),
      Object.freeze(['depot', 'Writer Depot']),
      Object.freeze(['letters', 'My Letters']),
      Object.freeze(['intel', 'Intelligence']),
      Object.freeze(['settings', 'Settings']),
    ]),
    mentor: Object.freeze([
      Object.freeze(['overview', 'Overview']),
      Object.freeze(['coverage', 'Coverage']),
      Object.freeze(['deadlines', 'Deadlines']),
      Object.freeze(['settings', 'Settings']),
    ]),
    faculty: Object.freeze([
      Object.freeze(['request', 'Request']),
      Object.freeze(['evidence', 'Evidence']),
      Object.freeze(['assess', 'Assess']),
      Object.freeze(['draft', 'Draft']),
      Object.freeze(['review', 'Review']),
      Object.freeze(['approval', 'Approval']),
      Object.freeze(['release', 'Release']),
      Object.freeze(['delivery', 'Delivery']),
    ]),
  });

  const DEFAULT_ROLE_VIEW = Object.freeze({
    student: 'build',
    mentor: 'overview',
    faculty: 'draft',
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
   * The faculty writer's surface has its own, much smaller shape check.
   *
   * Reaching this at all means the SERVER chose to answer this actor with a faculty projection,
   * and security/authorization-policy.js only does that after `read_faculty_projection` has
   * proven the actor is the recipient-bound, verified faculty writer for this exact case. The
   * renderer therefore never decides who the writer is; it refuses to paint a writer surface
   * unless the server already answered that question by sending one.
   */
  function assertRenderableFacultyProjection(projection) {
    if (!isPlainObject(projection)) {
      throw new TypeError('A production projection object is required');
    }
    if (projection.schemaVersion !== FACULTY_PROJECTION_SCHEMA) {
      throw new TypeError('This surface presents the faculty case projection only');
    }
    if (!isNonEmptyString(projection.caseId) || !isNonEmptyString(projection.status)) {
      throw new TypeError('The case projection is missing its identity or status');
    }
    if (!Number.isSafeInteger(projection.revision) || projection.revision < 0) {
      throw new TypeError('The case projection is missing a durable revision');
    }
    if (!isPlainObject(projection.studentShared) || !isPlainObject(projection.facultyPrivate)) {
      throw new TypeError('The faculty projection is missing its authorized sections');
    }
    if (!isPlainObject(projection.delivery) || !isNonEmptyString(projection.delivery.status)) {
      throw new TypeError('The case projection is missing its delivery state');
    }
    return projection;
  }

  /**
   * The mentor surface is intentionally the database's exact five-field safe projection plus its
   * schema discriminator. It has no revision and no private/student-authoring structures, so it is
   * always rendered read only.
   */
  function assertRenderableMentorProjection(projection) {
    if (!isPlainObject(projection)) {
      throw new TypeError('A production projection object is required');
    }
    const exactFields = [
      'schemaVersion',
      'caseId',
      'status',
      'strategyStatus',
      'nextMilestone',
      'deliveryStatus',
    ];
    const actualFields = Object.keys(projection).sort();
    if (
      actualFields.length !== exactFields.length
      || exactFields.some((field) => !actualFields.includes(field))
    ) {
      throw new TypeError('The mentor projection is outside its exact safe allowlist');
    }
    if (projection.schemaVersion !== MENTOR_PROJECTION_SCHEMA) {
      throw new TypeError('This surface presents the mentor case projection only');
    }
    if (!isNonEmptyString(projection.caseId) || !isNonEmptyString(projection.status)) {
      throw new TypeError('The case projection is missing its identity or status');
    }
    for (const field of ['strategyStatus', 'nextMilestone', 'deliveryStatus']) {
      if (projection[field] !== null && typeof projection[field] !== 'string') {
        throw new TypeError(`The mentor projection carries an unreadable ${field}`);
      }
    }
    return projection;
  }

  /** @param {unknown} projection */
  function projectionKind(projection) {
    if (!isPlainObject(projection)) return null;
    if (projection.schemaVersion === STUDENT_PROJECTION_SCHEMA) return 'student';
    if (projection.schemaVersion === FACULTY_PROJECTION_SCHEMA) return 'faculty';
    if (projection.schemaVersion === MENTOR_PROJECTION_SCHEMA) return 'mentor';
    return null;
  }

  /** @param {unknown} projection @param {'student' | 'faculty' | 'mentor'} kind */
  function assertRenderableProjection(projection, kind) {
    if (kind === 'faculty') return assertRenderableFacultyProjection(projection);
    if (kind === 'mentor') return assertRenderableMentorProjection(projection);
    return assertRenderableStudentProjection(projection);
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
   * Consent is append-only, so the latest receipt is the complete current decision. An older
   * grant never survives a later withdrawal and an older policy never silently authorizes the
   * current provider path.
   */
  function readConsentState(consentReceipts) {
    if (!Array.isArray(consentReceipts) || consentReceipts.length === 0) {
      return { recorded: false, active: false, withdrawn: false, latest: null };
    }
    const latest = consentReceipts[consentReceipts.length - 1];
    if (!isPlainObject(latest) || !Array.isArray(latest.scopes)) {
      return { recorded: false, active: false, withdrawn: false, latest: null };
    }
    const withdrawn = latest.scopes.length === 1
      && latest.scopes[0] === CONSENT_WITHDRAWN_SCOPE;
    const active = !withdrawn
      && latest.policyVersion === CONSENT_POLICY_VERSION
      && CONSENT_SCOPES.every((scope) => latest.scopes.includes(scope));
    return { recorded: true, active, withdrawn, latest };
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
    let renderedKind = 'student';
    let selectedStepId = null;
    let selectedAppView = null;
    let selectedBuildSurface = 'home';
    let pendingIntentPath = null;
    let pendingTemplateSelection = null;
    let emptyStartCase = null;
    /** Baseline revision captured when a write left the browser; null when no write is in flight. */
    let pendingSaveBaselineRevision = null;
    let pendingSaveStepId = null;

    /**
     * Transport handed in by public/lor-studio/production-adapter.js.
     *
     * This file issues no requests of its own - it has no reference to any network API, and a test
     * asserts that. Commands are how an edit becomes an HTTP write: the renderer decides WHAT to
     * ask for and what the answer entitles it to say, the adapter decides HOW to ask. Absent
     * commands the surface renders exactly as it did before: durable state, read only.
     */
    let commands = null;

    /**
     * Typed-but-unconfirmed field values, keyed by step then field.
     *
     * This is the only place a student's in-progress wording exists on the client, it lives in a
     * closure for the lifetime of the page and nowhere else, and it is cleared only when the
     * SERVER has confirmed the exact values that were sent. It is deliberately not cleared by a
     * re-render, a conflict, or a reload: losing typed content silently is the failure this whole
     * editing path is written to prevent.
     */
    const draftEdits = new Map();
    /** Bumped on every keystroke, so an acknowledgement can tell "still current" from "stale". */
    let editSequence = 0;
    let debounceHandle = null;
    let debounceStepId = null;
    let writeInFlight = false;
    /** null | 'detected' | 'reloaded' - drives the conflict recovery copy and its controls. */
    let conflictPhase = null;
    let conflictStepId = null;
    /** Safe, non-technical sentence about the last export attempt. Never a reason code. */
    let exportNotice = null;
    /** Ephemeral form state only. It is never written to browser storage. */
    let facultyInvitationEmail = '';
    let facultyDraftText = null;
    let facultyFinalText = null;
    let facultyApproved = false;
    let facultySignatureAttested = false;
    let aiProposal = null;
    let aiEditedText = '';
    let aiNotice = null;
    let librarySearch = '';
    let librarySpecialty = 'all';
    let libraryContext = 'all';
    let libraryRole = 'all';
    let libraryDuration = 'all';
    let libraryTone = 'all';
    let libraryLength = 'all';
    let libraryStructure = 'all';
    let libraryStrength = 'all';
    let libraryFavoritesOnly = false;
    const libraryFavorites = new Set();
    let libraryCompare = [];
    let libraryOpenSampleId = null;

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

    function buildMatrixReturnLink() {
      const link = el('a', 'matrixBtn lorMatrixReturnLink', 'Return to Matrix');
      link.setAttribute('href', MATRIX_DASHBOARD_URL);
      link.setAttribute('referrerpolicy', 'no-referrer');
      link.setAttribute('data-lor-return-matrix', '');
      link.setAttribute('aria-label', 'Return to MissionMed Matrix');
      return link;
    }

    function appendAll(parent, children) {
      for (const child of children) {
        if (child) parent.appendChild(child);
      }
      return parent;
    }

    function availableViews(kind) {
      return ROLE_VIEWS[kind] || ROLE_VIEWS.student;
    }

    function ensureAppView(kind) {
      const ids = availableViews(kind).map(([id]) => id);
      if (!ids.includes(selectedAppView)) selectedAppView = DEFAULT_ROLE_VIEW[kind];
      return selectedAppView;
    }

    function buildRoleIdentity(kind) {
      const pill = el('div', 'rolePill lorRoleIdentity');
      const item = el('div', 'pp on');
      const initials = kind === 'faculty' ? 'FW' : (kind === 'mentor' ? 'M' : 'S');
      item.appendChild(el('span', `avc ${kind === 'mentor' ? 'men' : 'stu'}`, initials));
      item.appendChild(el('span', 'plbl', kind === 'faculty' ? 'Faculty writer' : humanize(kind)));
      pill.appendChild(item);
      return pill;
    }

    /**
     * Rebuild the approved global shell from DOM primitives. The original frozen document remains
     * inert; this is its production presentation contract, not its fixture runtime.
     */
    function buildApprovedShell(projection, kind, stateName) {
      const host = resolveMount();
      host.dataset.actor = kind;
      const active = ensureAppView(kind);

      host.appendChild(el('div', 'aur a'));
      host.appendChild(el('div', 'aur b'));
      host.appendChild(el('div', 'vg'));

      const header = doc.createElement('header');
      header.className = 'lorApprovedHeader';
      header.appendChild(buildMatrixReturnLink());

      const logo = button('', 'logo', () => {
        selectedAppView = DEFAULT_ROLE_VIEW[kind];
        if (kind === 'student') selectedBuildSurface = 'home';
        if (renderedProjection) renderCase(renderedProjection, currentState);
        else showEmptyWorkspace({ startCase: emptyStartCase });
      });
      logo.id = 'lorApprovedLogo';
      logo.setAttribute('aria-label', 'LOR Studio home');
      logo.appendChild(doc.createTextNode('LOR '));
      logo.appendChild(el('b', null, 'Studio'));
      logo.appendChild(el('div', 'logoSub', 'Recommendation Intelligence'));
      header.appendChild(logo);

      const nav = doc.createElement('nav');
      nav.className = 'top';
      nav.setAttribute('aria-label', kind === 'faculty' ? 'Faculty workspace stages' : 'Main navigation');
      for (const [viewId, label] of availableViews(kind)) {
        const control = button(label, `ntab${viewId === active ? ' on' : ''}`, () => {
          selectedAppView = viewId;
          if (kind === 'student' && viewId === 'build') selectedBuildSurface = 'home';
          if (kind === 'student' && viewId === 'library') libraryFavoritesOnly = false;
          if (renderedProjection) renderCase(renderedProjection, currentState);
          else showEmptyWorkspace({ startCase: emptyStartCase });
        });
        control.dataset.lorNav = viewId;
        if (viewId === active) control.setAttribute('aria-current', 'page');
        nav.appendChild(control);
      }
      header.appendChild(nav);

      const right = el('div', 'hRight');
      right.appendChild(el('span', 'chip gn lorLiveDataChip', 'Live data'));
      right.appendChild(buildRoleIdentity(kind));
      header.appendChild(right);
      host.appendChild(header);

      if (kind === 'mentor') {
        const banner = el('div', 'lorMentorBanner');
        banner.appendChild(el('b', null, 'Mentor View'));
        banner.appendChild(doc.createTextNode(' — strategy and milestones only. Faculty-private content and letter wording are never included.'));
        host.appendChild(banner);
      }

      const main = doc.createElement('main');
      main.id = 'lorApprovedMain';
      const view = el('section', 'live');
      view.dataset.view = 'case';
      view.dataset.actor = kind;
      view.dataset.appView = active;
      if (stateName && Object.prototype.hasOwnProperty.call(STATE_COPY, stateName)) {
        view.appendChild(stateBanner(stateName));
      }
      main.appendChild(view);
      host.appendChild(main);
      return view;
    }

    function appendViewHeading(view, eyebrow, lead, accent, detail) {
      view.appendChild(el('div', 'eyebrow', eyebrow));
      const heading = el('h1', 'h1 lorViewTitle');
      heading.appendChild(doc.createTextNode(`${lead} `));
      heading.appendChild(el('em', null, accent));
      view.appendChild(heading);
      if (detail) view.appendChild(el('p', 'sub lorViewIntro', detail));
    }

    function metricCard(label, value, detail, tone = 'cy') {
      const card = el('div', 'panel lorMetricCard');
      const body = el('div', 'pBody');
      body.appendChild(el('div', `chip ${tone}`, label));
      body.appendChild(el('div', 'lorMetricValue', value));
      body.appendChild(el('p', 'sub', detail));
      card.appendChild(body);
      return card;
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

    /**
     * A control, never an inline handler and never a link the browser can follow on its own.
     * Every button this renderer creates goes through here, so "no onclick attribute anywhere in
     * the production surface" is a property of the construction rather than of a review.
     */
    function button(label, className, handler, { disabled = false, describedBy = '' } = {}) {
      const control = doc.createElement('button');
      control.type = 'button';
      control.className = className;
      control.textContent = label;
      if (disabled) control.disabled = true;
      if (describedBy) control.setAttribute('aria-describedby', describedBy);
      control.addEventListener('click', handler);
      return control;
    }

    function field(stepId, spec, value, { disabled = false } = {}) {
      const wrapper = el('div', 'fld');
      const control = doc.createElement(spec.control === 'textarea' ? 'textarea' : 'input');
      const id = `lorField-${stepId}-${spec.key}`;
      const label = el('label', null, spec.label);
      label.setAttribute('for', id);
      control.id = id;
      if (spec.control !== 'textarea') control.type = 'text';
      control.dataset.step = stepId;
      control.dataset.field = spec.key;
      // .value, not a text node: student wording is data the control holds, never markup the
      // document parses.
      control.value = value === undefined || value === null ? '' : String(value);
      if (disabled) control.disabled = true;
      control.addEventListener('input', () => {
        recordEdit(stepId, spec.key, control.value);
      });
      wrapper.appendChild(label);
      wrapper.appendChild(control);
      return wrapper;
    }

    /* -------------------------------------------------------------- edit buffer */

    function editsFor(stepId) {
      return draftEdits.get(stepId) || null;
    }

    function hasEdits(stepId) {
      const edits = editsFor(stepId);
      return Boolean(edits) && Object.keys(edits).length > 0;
    }

    /**
     * The step object the SERVER holds. During a render the projection being painted is passed in
     * explicitly, because `renderedProjection` is not adopted until that render has succeeded.
     */
    function savedStepData(stepId, projection = renderedProjection) {
      const stored = projection?.builder?.stepData?.[stepId];
      return isPlainObject(stored) ? stored : {};
    }

    /**
     * What a builder PATCH must carry.
     *
     * autosaveBuilderStep replaces `builder.stepData[stepId]` wholesale, so the payload is the
     * stored object with the edited fields laid over it. Sending only the edited fields would
     * delete every other field the student had already saved for that step.
     */
    function composeStepPayload(stepId) {
      // Null-prototype for the same reason as recordEdit: a `__proto__` key must merge as data,
      // never as a prototype mutation. Spread creates own properties so this is belt and braces,
      // but the whole edit path is now uniformly prototype-free rather than relying on that.
      return Object.assign(Object.create(null), savedStepData(stepId), editsFor(stepId) || {});
    }

    function stageEdit(stepId, key, value) {
      // Object.create(null), not {}. On a normal object literal `edits['__proto__'] = value`
      // does not create an own property - it hits the prototype setter and the edit vanishes.
      // The student would then type into a field, see "Up to date", and lose the content
      // silently. A null-prototype buffer has no such setter, so every key is stored as data.
      const edits = editsFor(stepId) || Object.create(null);
      Object.defineProperty(edits, key, {
        value, writable: true, enumerable: true, configurable: true,
      });
      draftEdits.set(stepId, edits);
      editSequence += 1;
    }

    function recordEdit(stepId, key, value) {
      stageEdit(stepId, key, value);
      scheduleAutosave(stepId);
      markUnsavedIndicator();
    }

    /** The unsaved marker is a DOM touch-up, not a re-render: re-rendering would drop the caret. */
    function markUnsavedIndicator() {
      const host = resolveMount();
      const unsaved = hasEdits(selectedStepId);
      const marker = host.querySelector('#lorUnsavedMarker');
      if (marker) marker.textContent = unsaved ? 'Not saved yet' : 'Up to date';
      const saveControl = host.querySelector('#lorSaveNow');
      if (saveControl) saveControl.disabled = !unsaved;
    }

    function clearDebounce() {
      if (debounceHandle !== null && win && typeof win.clearTimeout === 'function') {
        win.clearTimeout(debounceHandle);
      }
      debounceHandle = null;
      debounceStepId = null;
    }

    function scheduleAutosave(stepId) {
      if (!commands || typeof commands.autosaveBuilderStep !== 'function') return;
      clearDebounce();
      debounceStepId = stepId;
      if (!win || typeof win.setTimeout !== 'function') return;
      debounceHandle = win.setTimeout(() => {
        debounceHandle = null;
        debounceStepId = null;
        void autosaveStep(stepId);
      }, AUTOSAVE_DEBOUNCE_MS);
    }

    /* ------------------------------------------------------------- write plumbing */

    /**
     * Turn one command outcome into one presentation state.
     *
     * A 2xx is handed to markSaved, which is the ONLY function permitted to conclude "Saved" and
     * which re-checks the server's revision before it does. Everything else - a rejection, a
     * timeout, an unreachable network - goes to markSaveFailed. There is no path from here to a
     * saved badge that skips the server's answer.
     */
    function settleWrite(outcome) {
      if (!isPlainObject(outcome) || outcome.reached !== true) {
        // The request never produced a server answer. Whatever the cause, the honest statement is
        // the same one: MissionMed was not reached, so nothing was stored.
        return markSaveFailed('network_failure');
      }
      const status = Number(outcome.status);
      if (status === 200 || status === 201) {
        return markSaved({ status, body: outcome.body });
      }
      const state = Object.prototype.hasOwnProperty.call(STATUS_STATES, status)
        ? STATUS_STATES[status]
        : 'server_failure';
      // The server's own body is never read for display. Only its status selects the words.
      return markSaveFailed(state);
    }

    /**
     * Run one durable write end to end.
     *
     * Serialised on purpose: two builder writes in flight against the same revision would make one
     * of them a guaranteed stale-revision rejection, and the student would read a conflict that
     * their own interface caused.
     */
    async function runWrite({ stepId = null, invoke, conflictStep = null }) {
      if (!renderedProjection || !commands) return Object.freeze({ ran: false });
      if (writeInFlight) return Object.freeze({ ran: false });
      writeInFlight = true;
      const sequenceAtSend = editSequence;
      const expectedRevision = renderedProjection.revision;
      const caseId = renderedProjection.caseId;
      let outcome;
      try {
        markSaving(stepId ? { stepId } : {});
        outcome = await invoke({ expectedRevision, caseId });
      } catch {
        // A command that throws is a transport that failed. Nothing left the browser that the
        // server acknowledged, so this is reported exactly like an unreachable network.
        outcome = { reached: false };
      } finally {
        writeInFlight = false;
      }
      const result = settleWrite(outcome);
      const saved = result?.saved === true;
      if (saved) {
        conflictPhase = null;
        conflictStepId = null;
        // Only the values the server actually confirmed are dropped. Anything typed while the
        // write was in flight stays, and is written on the next pass.
        if (stepId && editSequence === sequenceAtSend) draftEdits.delete(stepId);
        else if (stepId) scheduleAutosave(stepId);
      } else {
        if (currentState === 'version_conflict') {
          conflictPhase = 'detected';
          conflictStepId = conflictStep || stepId;
        }
        // The durable truth may still have come back on a rejected write (a replayed release, for
        // instance). Adopting it keeps the screen honest; the failure banner above it stands.
        const adopted = adoptAcknowledgedProjection(outcome, caseId);
        // A full-surface failure state has already torn the workspace down, and renderedProjection
        // is null there; only an inline failure still has a workspace to re-draw with its recovery
        // controls, and it must be re-drawn or the student is told to act with no way to act.
        if (!adopted && renderedProjection) renderCase(renderedProjection, currentState);
      }
      return Object.freeze({ ran: true, saved });
    }

    /**
     * Re-paint from a projection the server returned alongside a rejection, when it is genuinely
     * this case and genuinely the shape being displayed. Never claims anything was saved.
     */
    function adoptAcknowledgedProjection(outcome, caseId) {
      const body = isPlainObject(outcome) ? outcome.body : null;
      const candidate = isPlainObject(body) ? body.case : null;
      if (projectionKind(candidate) !== renderedKind) return false;
      let renderable;
      try {
        renderable = assertRenderableProjection(candidate, renderedKind);
      } catch {
        return false;
      }
      if (renderable.caseId !== caseId) return false;
      renderCase(renderable, currentState);
      return true;
    }

    async function autosaveStep(stepId) {
      if (!hasEdits(stepId)) return;
      await runWrite({
        stepId,
        conflictStep: stepId,
        invoke: ({ expectedRevision, caseId }) => commands.autosaveBuilderStep({
          caseId,
          expectedRevision,
          stepId,
          stepData: composeStepPayload(stepId),
        }),
      });
    }

    /** Flush a pending debounce immediately - used by the explicit "save now" controls. */
    async function saveNow(stepId) {
      clearDebounce();
      await autosaveStep(stepId);
    }

    async function completeStep(stepId) {
      clearDebounce();
      if (hasEdits(stepId)) {
        const first = await runWrite({
          stepId,
          conflictStep: stepId,
          invoke: ({ expectedRevision, caseId }) => commands.autosaveBuilderStep({
            caseId,
            expectedRevision,
            stepId,
            stepData: composeStepPayload(stepId),
          }),
        });
        // Completing a step whose wording was not stored would mark it done on the server while
        // the student's latest words existed only on their screen.
        if (!first.saved) return;
      }
      await runWrite({
        stepId,
        invoke: ({ expectedRevision, caseId }) => commands.completeBuilderStep({
          caseId,
          expectedRevision,
          stepId,
        }),
      });
    }

    async function recordConsent() {
      await runWrite({
        invoke: ({ expectedRevision, caseId }) => commands.recordReceipt({
          caseId,
          expectedRevision,
          receiptType: 'consent',
          receiptData: { policyVersion: CONSENT_POLICY_VERSION, scopes: [...CONSENT_SCOPES] },
        }),
      });
    }

    async function withdrawConsent() {
      await runWrite({
        invoke: ({ expectedRevision, caseId }) => commands.recordReceipt({
          caseId,
          expectedRevision,
          receiptType: 'consent',
          receiptData: {
            policyVersion: CONSENT_POLICY_VERSION,
            scopes: [CONSENT_WITHDRAWN_SCOPE],
          },
        }),
      });
    }

    async function recordWaiverDecision(waived) {
      const waiver = readWaiverState(renderedProjection?.waiverReceipts);
      const receiptData = {
        waived,
        policyVersion: CONSENT_POLICY_VERSION,
        acknowledgment: waived
          ? 'I waive my right to read the finished letter.'
          : 'I keep my right to read the finished letter.',
        // The supersession chain is the server's rule; this only names the receipt the student can
        // see they are superseding. A first decision supersedes nothing.
        priorReceiptId: waiver.receiptId,
      };
      await runWrite({
        invoke: ({ expectedRevision, caseId }) => commands.recordReceipt({
          caseId,
          expectedRevision,
          receiptType: 'waiver',
          receiptData,
        }),
      });
    }

    async function publishStudentEvidence() {
      if (!commands || typeof commands.publishStudentEvidence !== 'function') return;
      await runWrite({
        invoke: ({ caseId, expectedRevision }) => commands.publishStudentEvidence({
          caseId,
          expectedRevision,
        }),
      });
    }

    async function inviteFacultyWriter(recipientEmail) {
      const email = String(recipientEmail || '').trim();
      if (!email || !commands || typeof commands.inviteFaculty !== 'function') return;
      const result = await runWrite({
        invoke: ({ caseId, expectedRevision }) => commands.inviteFaculty({
          caseId,
          expectedRevision,
          recipientEmail: email,
        }),
      });
      if (result.saved) facultyInvitationEmail = '';
    }

    async function resendFacultyWriterOtp(recipientEmail) {
      const email = String(recipientEmail || '').trim();
      if (!email || !commands || typeof commands.resendFacultyOtp !== 'function') return;
      await runWrite({
        invoke: ({ caseId }) => commands.resendFacultyOtp({ caseId, recipientEmail: email }),
      });
    }

    async function revokeFacultyWriterInvitation() {
      if (!commands || typeof commands.revokeFacultyInvitation !== 'function') return;
      await runWrite({
        invoke: ({ caseId }) => commands.revokeFacultyInvitation({ caseId }),
      });
    }

    async function saveFacultyPrivateWork() {
      if (!commands || typeof commands.saveFacultyPrivateContent !== 'function') return;
      const privateState = renderedProjection?.facultyPrivate;
      if (!isPlainObject(privateState)) return;
      const storedDocument = isPlainObject(privateState.finalDocument)
        ? privateState.finalDocument
        : null;
      const draftText = String(
        facultyDraftText === null ? (privateState.draftText ?? '') : facultyDraftText,
      );
      const finalText = String(
        facultyFinalText === null ? (storedDocument?.text ?? '') : facultyFinalText,
      );
      const trimmedFinalText = finalText.trim();
      const approved = facultyApproved === true && facultySignatureAttested === true;
      const finalDocument = trimmedFinalText
        ? {
          contentHash: storedDocument?.text === finalText ? (storedDocument.contentHash ?? null) : null,
          id: storedDocument?.id ?? null,
          mimeType: storedDocument?.mimeType ?? 'text/plain',
          text: finalText,
        }
        : null;
      const result = await runWrite({
        invoke: ({ expectedRevision, caseId }) => commands.saveFacultyPrivateContent({
          caseId,
          expectedRevision,
          answers: [...privateState.answers],
          notes: [...privateState.notes],
          draftText: draftText.trim() ? draftText : null,
          finalDocument,
          documentState: approved ? 'faculty_final' : null,
          // The server mints faculty identity and approval time from the authenticated actor.
          facultyApproval: approved
            ? { approved: true, signatureAttested: true }
            : null,
        }),
      });
      if (result.saved) {
        facultyDraftText = null;
        facultyFinalText = null;
        facultyApproved = false;
        facultySignatureAttested = false;
      }
    }

    function readableAiProposal(outcome) {
      if (!isPlainObject(outcome) || outcome.reached !== true) return null;
      if (![200, 201].includes(Number(outcome.status))) return null;
      const proposal = isPlainObject(outcome.body) && isPlainObject(outcome.body.proposal)
        ? outcome.body.proposal
        : null;
      if (
        !proposal
        || !isNonEmptyString(proposal.id)
        || !['proposal', 'decided'].includes(proposal.state)
        || !isNonEmptyString(proposal.text)
        || !isPlainObject(proposal.provenance)
        || proposal.provenance.caseId !== renderedProjection?.caseId
      ) {
        return null;
      }
      return proposal;
    }

    async function runAiCommand(invoke, successNotice) {
      if (!renderedProjection || renderedKind !== 'faculty' || writeInFlight) return;
      writeInFlight = true;
      let outcome;
      try {
        outcome = await invoke({ caseId: renderedProjection.caseId });
      } catch {
        outcome = { reached: false };
      } finally {
        writeInFlight = false;
      }
      const proposal = readableAiProposal(outcome);
      if (proposal) {
        aiProposal = proposal;
        aiEditedText = proposal.state === 'proposal' ? proposal.text : '';
        aiNotice = successNotice;
      } else if (!isPlainObject(outcome) || outcome.reached !== true) {
        aiNotice = 'MissionMed could not be reached. No AI proposal action was recorded.';
      } else {
        aiNotice = 'MissionMed did not accept that AI proposal action. Nothing was finalized or released.';
      }
      renderCase(renderedProjection, null);
    }

    async function requestAiProposal() {
      if (!commands || typeof commands.requestAiProposal !== 'function') return;
      await runAiCommand(
        ({ caseId }) => commands.requestAiProposal({ caseId, factIds: null }),
        'AI proposal received for faculty review. It is not final wording.',
      );
    }

    async function refreshAiProposal() {
      if (!commands || typeof commands.readAiProposal !== 'function' || !isNonEmptyString(aiProposal?.id)) return;
      await runAiCommand(
        ({ caseId }) => commands.readAiProposal({ caseId, proposalId: aiProposal.id }),
        'The server proposal record is up to date.',
      );
    }

    async function decideAiProposal(action) {
      if (
        !commands
        || typeof commands.decideAiProposal !== 'function'
        || !isNonEmptyString(aiProposal?.id)
      ) return;
      const resultingText = action === 'edited' ? aiEditedText : undefined;
      if (action === 'edited' && !String(resultingText || '').trim()) return;
      await runAiCommand(
        ({ caseId }) => commands.decideAiProposal({
          caseId,
          proposalId: aiProposal.id,
          action,
          resultingText,
        }),
        'Your human decision was recorded. This did not finalize, approve, release, or export the letter.',
      );
    }

    /**
     * Release, from the verified faculty writer's surface.
     *
     * Exactly two facts leave the browser: the revision this screen was reasoning about, and the
     * document that revision names. There is deliberately no release timestamp here and no field
     * that could carry one - the aggregate mints `releasedToStudentAt` itself, and the student's
     * screen reads it back out of the server's projection. A UI-asserted release time would be a
     * client claim about durable state, which is the one thing this whole file refuses to make.
     */
    async function releaseFinalDocumentToStudent(documentId) {
      if (!isNonEmptyString(documentId)) return;
      await runWrite({
        invoke: ({ expectedRevision, caseId }) => commands.releaseFinalDocument({
          caseId,
          expectedRevision,
          documentId,
        }),
      });
    }

    /**
     * Reload the durable case and keep every typed character.
     *
     * This is the recovery half of conflict handling. It replaces what is on screen with what the
     * server actually holds and then lays the student's unsaved wording back over it, so nothing
     * is lost and nothing is written. The re-save is a separate, explicit press: an automatic
     * re-PATCH here would be exactly the silent overwrite the conflict state exists to prevent.
     */
    async function reloadAndReapply() {
      if (!commands || typeof commands.reloadCase !== 'function' || !renderedProjection) return;
      clearDebounce();
      const caseId = renderedProjection.caseId;
      let outcome;
      try {
        outcome = await commands.reloadCase({ caseId });
      } catch {
        outcome = { reached: false };
      }
      if (!isPlainObject(outcome) || outcome.reached !== true) {
        applyState('network_failure');
        return;
      }
      const status = Number(outcome.status);
      if (status !== 200) {
        applyState(
          Object.prototype.hasOwnProperty.call(STATUS_STATES, status)
            ? STATUS_STATES[status]
            : 'server_failure',
        );
        return;
      }
      if (!adoptAcknowledgedProjection(outcome, caseId)) {
        applyState('server_failure');
        return;
      }
      conflictPhase = 'reloaded';
      renderCase(renderedProjection, 'version_conflict');
    }

    /**
     * Ask the adapter to fetch the export route and hand the browser a file.
     *
     * No grant, purpose, destination or privacy class is constructed here or sent: the export
     * route accepts no query parameters at all and resolves every one of those from the stored
     * case against the authenticated actor. This control can only ask; the server decides.
     */
    async function exportFinalDocument() {
      if (!commands || typeof commands.exportFinalDocument !== 'function' || !renderedProjection) return;
      const caseId = renderedProjection.caseId;
      exportNotice = 'Preparing your download.';
      renderCase(renderedProjection, currentState);
      let outcome;
      try {
        outcome = await commands.exportFinalDocument({ caseId });
      } catch {
        outcome = { reached: false };
      }
      if (isPlainObject(outcome) && outcome.reached === true && Number(outcome.status) === 200) {
        exportNotice = outcome.downloadStarted === true
          ? 'Your download has started. Nothing on your account changed.'
          : 'MissionMed prepared the file, but this browser did not start the download.';
        renderCase(renderedProjection, currentState);
        return;
      }
      exportNotice = null;
      if (!isPlainObject(outcome) || outcome.reached !== true) {
        applyState('network_failure');
        return;
      }
      const status = Number(outcome.status);
      // 400/409 here mean the server refused to build a letter this control believed existed.
      // That is a server-side condition, not something the student did, so it reads as one.
      const state = status === 400 || status === 409
        ? 'server_failure'
        : (Object.prototype.hasOwnProperty.call(STATUS_STATES, status) ? STATUS_STATES[status] : 'server_failure');
      applyState(state);
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
      const header = el('div', 'lorCaseBand');
      const strip = el('div', 'lorCaseBandInner');
      const tone = CASE_STATUS_TONES[projection.status] || 'info';
      strip.appendChild(el('span', TONE_STAGE_CLASS[tone], humanize(projection.status)));
      strip.appendChild(el('span', 'chip', `Case ${projection.caseId}`));
      strip.appendChild(el('span', 'chip', `Version ${projection.revision}`));
      header.appendChild(strip);
      header.appendChild(el(
        'p',
        'micNote',
        'Live MissionMed record · changes count only after the server confirms them.',
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

    /**
     * Which of a step's keys the student can type into.
     *
     * Declared fields always appear. A stored key that is not declared appears too, but only when
     * its stored value is a string: turning a number or a boolean into a text box would send back
     * a different JSON type than the one the server stored. Everything else is shown read only and
     * carried through every write untouched.
     */
    function editableFieldSpecs(stepId, projection) {
      const declared = STEP_FIELDS[stepId] || [];
      const specs = [...declared];
      const declaredKeys = new Set(declared.map((spec) => spec.key));
      const stored = savedStepData(stepId, projection);
      for (const key of Object.keys(stored)) {
        if (declaredKeys.has(key)) continue;
        if (typeof stored[key] !== 'string') continue;
        specs.push({
          key,
          label: humanize(key),
          control: stored[key].length > 90 ? 'textarea' : 'text',
        });
      }
      return specs;
    }

    /**
     * Why a step is read only, in the student's words, or null when it is editable.
     *
     * Every reason here restates a rule the SERVER enforces (status must be draft; steps cannot be
     * skipped). Hiding a control the server would refuse is courtesy. It is not the gate, and the
     * write path does not consult this function.
     */
    function readOnlyReason(projection, stepId, completedCount) {
      if (!commands || typeof commands.autosaveBuilderStep !== 'function') {
        return 'This case is open for reading only.';
      }
      if (projection.status !== 'draft') {
        return 'Your case is with your faculty writer now, so the builder is locked. Nothing you saved was lost.';
      }
      if (BUILDER_STEP_IDS.indexOf(stepId) > completedCount) {
        return 'Finish the earlier steps first. MissionMed keeps the builder in order.';
      }
      return null;
    }

    function buildConflictRecovery(stepId) {
      const box = el('div', 'warnBox');
      box.id = 'lorConflictRecovery';
      box.appendChild(el(
        'p',
        'sub',
        conflictPhase === 'reloaded'
          ? 'This is the version MissionMed has stored. Your unsaved wording is still in the boxes above — check it, then save it.'
          : 'Your wording is still here and has not been thrown away. MissionMed did not store it because this case was updated somewhere else. Load the stored version first so you do not overwrite it by accident.',
      ));
      const actions = el('div', 'lorProductionActions');
      if (conflictPhase !== 'reloaded' && commands && typeof commands.reloadCase === 'function') {
        actions.appendChild(button('Load the stored version', 'btn alt sm', () => { void reloadAndReapply(); }));
      }
      actions.appendChild(button('Save my wording again', 'btn pri sm', () => { void saveNow(stepId); }));
      box.appendChild(actions);
      return box;
    }

    function buildStepDetail(projection, completedCount) {
      const container = el('div', 'lorProductionStepDetail');
      if (!selectedStepId) {
        container.appendChild(el('p', 'sub', 'Nothing has been saved in the builder yet.'));
        return container;
      }
      const stepId = selectedStepId;
      const head = el('div', 'pHead');
      head.appendChild(el('div', 'h2', BUILDER_STEP_LABELS[stepId]));
      const marker = el('span', 'chip dashed', hasEdits(stepId) ? 'Not saved yet' : 'Up to date');
      marker.id = 'lorUnsavedMarker';
      head.appendChild(marker);
      container.appendChild(head);

      const stored = savedStepData(stepId, projection);
      const locked = readOnlyReason(projection, stepId, completedCount);
      const edits = editsFor(stepId) || {};

      if (locked) {
        container.appendChild(el('p', 'sub', locked));
        if (Object.keys(stored).length === 0) {
          container.appendChild(el('p', 'sub', 'Nothing has been saved for this step yet.'));
        }
        for (const key of Object.keys(stored)) {
          container.appendChild(row(humanize(key), describeValue(stored[key])));
        }
        return container;
      }

      const specs = editableFieldSpecs(stepId, projection);
      const form = el('div', 'lorProductionStepForm');
      for (const spec of specs) {
        const value = Object.prototype.hasOwnProperty.call(edits, spec.key)
          ? edits[spec.key]
          : stored[spec.key];
        form.appendChild(field(stepId, spec, value));
      }
      container.appendChild(form);

      const editableKeys = new Set(specs.map((spec) => spec.key));
      for (const key of Object.keys(stored)) {
        if (editableKeys.has(key)) continue;
        container.appendChild(row(humanize(key), describeValue(stored[key])));
      }

      container.appendChild(el(
        'p',
        'micNote',
        'Your typing is sent to MissionMed a moment after you stop. It is only stored once MissionMed confirms it.',
      ));

      const actions = el('div', 'lorProductionActions');
      const saveControl = button('Save now', 'btn alt sm', () => { void saveNow(stepId); }, {
        disabled: !hasEdits(stepId),
      });
      saveControl.id = 'lorSaveNow';
      actions.appendChild(saveControl);
      const nextStepId = BUILDER_STEP_IDS[completedCount] || null;
      if (nextStepId === stepId && typeof commands.completeBuilderStep === 'function') {
        actions.appendChild(button('Save and mark this step complete', 'btn pri sm', () => {
          void completeStep(stepId);
        }));
      }
      container.appendChild(actions);

      if (conflictPhase && conflictStepId === stepId) {
        container.appendChild(buildConflictRecovery(stepId));
      }
      return container;
    }

    /**
     * The compact save indicator.
     *
     * It reads `currentState` and nothing else, so the word "Saved" appears here for exactly one
     * reason: markSaved - the only function that checks the server's answer - set that state. No
     * other caller can reach it, because showState refuses the name outright.
     */
    function buildSaveStateChip() {
      const labels = Object.freeze({
        saving: ['chip cy', 'Saving…'],
        saved: ['chip gn', 'Saved'],
        save_failed: ['chip rd', 'Not saved'],
        version_conflict: ['chip em', 'Not saved — out of date'],
        network_failure: ['chip em', 'Not saved — offline'],
      });
      const entry = labels[currentState];
      if (!entry) return null;
      const chip = el('span', entry[0], entry[1]);
      chip.id = 'lorSaveIndicator';
      chip.dataset.saveState = currentState;
      return chip;
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
          'Your writer-ready packet is ready to begin. Nothing has been saved to this case yet.',
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

      children.push(buildStepDetail(projection, completedCount));

      if (autosavedAt) {
        children.push(el('p', 'sub', `Last change stored by MissionMed: ${autosavedAt}.`));
      } else {
        children.push(el('p', 'sub', 'MissionMed has not stored a builder change for this case yet.'));
      }

      const extras = [
        el('span', 'chip cy', `${completedCount} of ${BUILDER_STEP_IDS.length} complete`),
      ];
      if (nextStepId) extras.push(el('span', 'chip dashed', `Next: ${BUILDER_STEP_LABELS[nextStepId]}`));
      const saveChip = buildSaveStateChip();
      if (saveChip) extras.push(saveChip);
      return panel('Evidence-first LOR Builder', children, extras);
    }

    function buildReceiptsPanel(projection) {
      const children = [];
      const consent = projection.consentReceipts;
      const consentState = readConsentState(consent);
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
          const withdrawn = scopes.length === 1 && scopes[0] === CONSENT_WITHDRAWN_SCOPE;
          children.push(row(
            withdrawn ? 'Consent withdrawn' : 'Consent recorded',
            parts.join(' · ') || 'Recorded.',
            el('span', withdrawn ? 'chip em' : 'chip gn', withdrawn ? 'Withdrawn' : 'On file'),
          ));
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

      const canRecord = Boolean(commands) && typeof commands.recordReceipt === 'function';
      if (canRecord) {
        const actions = el('div', 'lorProductionActions');
        actions.id = 'lorReceiptActions';
        if (!consentState.active) {
          const disclosure = el('div', 'lorConsentDisclosure');
          disclosure.id = 'lorConsentDisclosure';
          disclosure.appendChild(el(
            'p',
            'micNote',
            'Consent version dr-133-identified-education-record-v1: I authorize MissionMed to store the information I enter, share selected evidence with my invited and verified faculty writer, and send that selected evidence to the configured AI provider solely to generate a non-final draft. Automated redaction removes some direct account identifiers but is not a guarantee of de-identification; my evidence may still contain identifiable education or clinical information. I may withdraw future AI use and prevent new sharing at any time. Previously delivered material is not recalled, a pending invitation must be revoked separately, and audit or legal records required for security and compliance remain append-only.',
          ));
          const acknowledgment = doc.createElement('input');
          acknowledgment.type = 'checkbox';
          acknowledgment.id = 'lorConsentAcknowledgment';
          const acknowledgmentLabel = el(
            'label',
            'micNote',
            'I have read this disclosure and explicitly agree to these uses.',
          );
          acknowledgmentLabel.setAttribute('for', acknowledgment.id);
          const consentButton = button(
            consentState.withdrawn ? 'Consent again under the current policy' : 'Record my explicit consent',
            'btn pri sm',
            () => { void recordConsent(); },
            { disabled: true, describedBy: disclosure.id },
          );
          acknowledgment.addEventListener('change', () => {
            consentButton.disabled = acknowledgment.checked !== true;
          });
          disclosure.appendChild(acknowledgment);
          disclosure.appendChild(acknowledgmentLabel);
          actions.appendChild(disclosure);
          actions.appendChild(consentButton);
        } else {
          actions.appendChild(button(
            'Withdraw future sharing and AI consent',
            'btn alt sm',
            () => { void withdrawConsent(); },
          ));
        }
        actions.appendChild(button(
          waiver.decided && waiver.waived === true ? 'Change to: keep my access' : 'Keep my access to the letter',
          'btn alt sm',
          () => { void recordWaiverDecision(false); },
          { disabled: waiver.decided && waiver.waived === false },
        ));
        actions.appendChild(button(
          waiver.decided && waiver.waived === false ? 'Change to: waive my access' : 'Waive my access to the letter',
          'btn alt sm',
          () => { void recordWaiverDecision(true); },
          { disabled: waiver.decided && waiver.waived === true },
        ));
        children.push(actions);
        children.push(el(
          'p',
          'micNote',
          'Waiving means you will not be shown the finished letter. MissionMed records the decision and the time; this screen does not.',
        ));
      }

      const extras = [el(
        'span',
        'chip',
        `${consent.length} consent · ${projection.waiverReceipts.length} waiver`,
      )];
      return panel('Consent & waiver receipts', children, extras);
    }

    function buildFacultyInvitationPanel(projection) {
      if (!['draft', 'faculty_invited'].includes(projection.status)) return null;
      const complete = projection.builder.completedStepIds.length === BUILDER_STEP_IDS.length;
      const consentActive = readConsentState(projection.consentReceipts).active;
      const canSend = complete && consentActive;
      const pending = projection.status === 'faculty_invited';
      const children = [
        el(
          'p',
          'sub',
          pending
            ? 'An invitation is pending. You may resend its one-time code, revoke it, or revoke first and then send a replacement.'
            : complete && !consentActive
            ? 'Record the current explicit sharing and AI consent before inviting your faculty writer.'
            : complete
            ? 'Send the invitation to the faculty writer who agreed to write this letter.'
            : 'Finish all eight builder steps before inviting your faculty writer.',
        ),
      ];
      if (commands && typeof commands.inviteFaculty === 'function') {
        const wrapper = el('div', 'fld');
        const label = el('label', null, 'Faculty writer email');
        label.setAttribute('for', 'lorFacultyInvitationEmail');
        const input = doc.createElement('input');
        input.id = 'lorFacultyInvitationEmail';
        input.type = 'email';
        input.autocomplete = 'email';
        input.value = facultyInvitationEmail;
        input.disabled = !canSend;
        input.addEventListener('input', () => { facultyInvitationEmail = input.value; });
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        children.push(wrapper);
        const actions = el('div', 'lorProductionActions');
        actions.id = 'lorFacultyInvitationActions';
        actions.appendChild(button(
          pending ? 'Send replacement invitation' : 'Invite faculty writer',
          'btn pri sm',
          () => { void inviteFacultyWriter(input.value); },
          { disabled: !canSend },
        ));
        if (pending && typeof commands.resendFacultyOtp === 'function') {
          actions.appendChild(button(
            'Resend one-time code',
            'btn sm',
            () => { void resendFacultyWriterOtp(input.value); },
            { disabled: !canSend },
          ));
        }
        if (pending && typeof commands.revokeFacultyInvitation === 'function') {
          actions.appendChild(button(
            'Revoke current invitation',
            'btn sm',
            () => { void revokeFacultyWriterInvitation(); },
          ));
        }
        children.push(actions);
        children.push(el(
          'p',
          'micNote',
          'MissionMed binds the invitation to this case. This screen sends only the recipient email.',
        ));
      }
      return panel(
        'Faculty invitation',
        children,
        [el(
          'span',
          canSend ? 'chip cy' : 'chip dashed',
          pending ? 'Invitation pending' : (canSend ? 'Ready' : (complete ? 'Consent required' : 'Builder incomplete')),
        )],
      );
    }

    function buildExportControl() {
      if (!commands || typeof commands.exportFinalDocument !== 'function') return null;
      const wrapper = el('div', 'lorProductionActions');
      wrapper.id = 'lorExportActions';
      wrapper.appendChild(button('Download a copy', 'btn alt sm', () => { void exportFinalDocument(); }));
      if (exportNotice) wrapper.appendChild(el('p', 'micNote', exportNotice));
      return wrapper;
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

      const children = [card, buildExportControl()].filter(Boolean);
      return panel('Final letter', children, [el('span', 'chip gn', 'Released')]);
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
      const requiredSteps = ['evidence_selection', 'timeline_highlights', 'consent_and_waiver'];
      const stepsReady = requiredSteps.every((stepId) => (
        projection.builder.completedStepIds.includes(stepId)
      ));
      const consentReady = readConsentState(projection.consentReceipts).active;
      const evidenceSourcePresent = [
        ['evidence_selection', 'priorityEvidence'],
        ['evidence_selection', 'evidenceSummary'],
        ['timeline_highlights', 'standoutMoment'],
        ['timeline_highlights', 'timelineSummary'],
      ].some(([stepId, fieldName]) => {
        const value = projection.builder.stepData?.[stepId]?.[fieldName];
        return typeof value === 'string' && value.trim().length > 0;
      });
      const canRequestPublication = projection.status === 'draft'
        && stepsReady
        && consentReady
        && evidenceSourcePresent
        && commands
        && typeof commands.publishStudentEvidence === 'function';
      children.push(el(
        'p',
        'sub',
        canRequestPublication
          ? 'Publish the eligible evidence already saved in your builder for your faculty writer. MissionMed applies limited direct-identifier redaction and seals the consent and source hashes in the database; this is not a guarantee of de-identification.'
          : 'Complete the evidence, timeline, and consent steps, save at least one evidence detail, and record drafting and grounding consent before publishing evidence.',
      ));
      const actions = el('div', 'lorProductionActions');
      actions.appendChild(button(
        evidence.length === 0 ? 'Publish evidence for my writer' : 'Update published evidence',
        'btn pri sm',
        () => { void publishStudentEvidence(); },
        { disabled: !canRequestPublication },
      ));
      children.push(actions);
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

    function facultyTextControl({ id, labelText, value, onInput, disabled = false }) {
      const wrapper = el('div', 'fld');
      const label = el('label', null, labelText);
      label.setAttribute('for', id);
      const control = doc.createElement('textarea');
      control.id = id;
      control.dataset.step = 'faculty_private';
      control.dataset.field = id;
      control.value = String(value ?? '');
      control.disabled = disabled;
      control.addEventListener('input', () => onInput(control.value));
      wrapper.appendChild(label);
      wrapper.appendChild(control);
      return wrapper;
    }

    function facultyApprovalControl(id, labelText, checked, onChange, disabled) {
      const wrapper = el('label', 'row');
      wrapper.setAttribute('for', id);
      const input = doc.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.checked = checked;
      input.disabled = disabled;
      input.addEventListener('change', () => onChange(input.checked));
      wrapper.appendChild(input);
      wrapper.appendChild(el('span', 'rowT', labelText));
      return wrapper;
    }

    function buildFacultyAuthoring(projection) {
      const privateState = projection.facultyPrivate;
      const storedDocument = isPlainObject(privateState.finalDocument)
        ? privateState.finalDocument
        : null;
      const released = Boolean(formatTimestamp(storedDocument?.releasedToStudentAt));
      const canSave = Boolean(commands) && typeof commands.saveFacultyPrivateContent === 'function';
      const disabled = released || !canSave;
      const draftValue = facultyDraftText === null ? (privateState.draftText ?? '') : facultyDraftText;
      const finalValue = facultyFinalText === null ? (storedDocument?.text ?? '') : facultyFinalText;
      const children = [
        el(
          'p',
          'sub',
          released
            ? 'This released wording is immutable.'
            : 'Your notes and letter remain faculty-private until you explicitly release an approved final document.',
        ),
      ];
      if (canSave || isNonEmptyString(draftValue) || isNonEmptyString(finalValue)) {
        children.push(facultyTextControl({
          id: 'lorFacultyDraft',
          labelText: 'Private working draft',
          value: draftValue,
          disabled,
          onInput: (value) => { facultyDraftText = value; },
        }));
        children.push(facultyTextControl({
          id: 'lorFacultyFinal',
          labelText: 'Final letter wording',
          value: finalValue,
          disabled,
          onInput: (value) => { facultyFinalText = value; },
        }));
      }
      if (canSave) {
        children.push(facultyApprovalControl(
          'lorFacultyApproval',
          'I reviewed and approve this exact wording.',
          facultyApproved,
          (checked) => { facultyApproved = checked; },
          released,
        ));
        children.push(facultyApprovalControl(
          'lorFacultySignatureAttestation',
          'I attest that this is my final letter.',
          facultySignatureAttested,
          (checked) => { facultySignatureAttested = checked; },
          released,
        ));
        const actions = el('div', 'lorProductionActions');
        actions.id = 'lorFacultyPrivateActions';
        actions.appendChild(button(
          'Save private faculty work',
          'btn pri sm',
          () => { void saveFacultyPrivateWork(); },
          { disabled: released },
        ));
        children.push(actions);
      }
      children.push(el(
        'p',
        'micNote',
        'AI proposals are never final letters. Only your explicit review and attestation can mark wording faculty-final.',
      ));
      return panel(
        'Private faculty workspace',
        children,
        [el('span', released ? 'chip gn' : 'chip cy', released ? 'Released' : 'Faculty private')],
      );
    }

    function buildAiProposalPanel() {
      const canRequest = Boolean(commands) && typeof commands.requestAiProposal === 'function';
      if (!canRequest && !aiProposal) return null;
      const children = [
        el(
          'p',
          'sub',
          'AI can propose grounded wording only. It cannot approve, finalize, release, or export a letter. A faculty writer must review every proposal.',
        ),
      ];
      const actions = el('div', 'lorProductionActions');
      actions.id = 'lorAiProposalActions';
      if (canRequest) {
        actions.appendChild(button(
          'Generate an AI proposal',
          'btn alt sm',
          () => { void requestAiProposal(); },
        ));
      }
      if (aiProposal) {
        const card = el('div', 'draftCard sel');
        const head = el('div', 'dHead');
        head.appendChild(el('div', 'h2', 'AI proposal — human review required'));
        head.appendChild(el(
          'span',
          aiProposal.state === 'proposal' ? 'chip cy' : 'chip gn',
          aiProposal.state === 'proposal' ? 'Proposal only' : 'Decision recorded',
        ));
        card.appendChild(head);
        card.appendChild(el('div', 'dBody', aiProposal.text));
        children.push(card);
        if (commands && typeof commands.readAiProposal === 'function') {
          actions.appendChild(button(
            'Refresh this proposal',
            'btn alt sm',
            () => { void refreshAiProposal(); },
          ));
        }
        if (aiProposal.state === 'proposal' && commands && typeof commands.decideAiProposal === 'function') {
          children.push(facultyTextControl({
            id: 'lorAiEditedWording',
            labelText: 'Faculty-edited wording (optional)',
            value: aiEditedText || aiProposal.text,
            onInput: (value) => { aiEditedText = value; },
          }));
          actions.appendChild(button(
            'Accept proposal verbatim',
            'btn alt sm',
            () => { void decideAiProposal('accepted'); },
          ));
          actions.appendChild(button(
            'Record my edited wording',
            'btn pri sm',
            () => { void decideAiProposal('edited'); },
          ));
          actions.appendChild(button(
            'Reject this proposal',
            'btn alt sm',
            () => { void decideAiProposal('rejected'); },
          ));
        }
      }
      if (actions.childElementCount > 0) children.push(actions);
      if (aiNotice) children.push(el('p', 'micNote', aiNotice));
      children.push(el(
        'p',
        'micNote',
        'Recording a human proposal decision does not save it as the final document. Use the private faculty workspace to review and finalize wording.',
      ));
      return panel('AI drafting assistant', children, [el('span', 'chip cy', 'Proposal only')]);
    }

    /**
     * The writer's release surface.
     *
     * Reaching this means the server answered this actor with a faculty projection, which
     * security/authorization-policy.js only does for the recipient-bound, verified faculty writer
     * of this case. Nothing here decides that; nothing here can.
     */
    function buildFacultyRelease(projection) {
      const finalDocument = isPlainObject(projection.facultyPrivate?.finalDocument)
        ? projection.facultyPrivate.finalDocument
        : null;
      const releasedAt = finalDocument ? formatTimestamp(finalDocument.releasedToStudentAt) : null;
      const waiverState = isPlainObject(projection.studentShared?.waiverState)
        ? projection.studentShared.waiverState
        : { decided: false, waived: null };
      const children = [];

      children.push(row(
        'Student access decision',
        waiverState.decided === true
          ? (waiverState.waived === true
            ? 'The student waived access, so a release will not show them the letter.'
            : 'The student kept access to the finished letter.')
          : 'The student has not recorded a decision yet.',
        el(
          'span',
          waiverState.decided === true ? (waiverState.waived === true ? 'chip em' : 'chip gn') : 'chip dashed',
          waiverState.decided === true ? (waiverState.waived === true ? 'Waived' : 'Not waived') : 'Not decided',
        ),
      ));

      if (!finalDocument) {
        children.push(el('p', 'sub', 'There is no finished letter on this case yet, so there is nothing to release.'));
        return panel('Release to the student', children, [el('span', 'chip dashed', 'Nothing to release')]);
      }

      children.push(row(
        'Finished letter',
        releasedAt
          ? `Released to the student ${releasedAt}. MissionMed recorded that time.`
          : 'Ready. The student cannot see it until you release it.',
        el('span', releasedAt ? 'chip gn' : 'chip dashed', releasedAt ? 'Released' : 'Held'),
      ));

      if (commands && typeof commands.releaseFinalDocument === 'function') {
        const actions = el('div', 'lorProductionActions');
        actions.id = 'lorReleaseActions';
        actions.appendChild(button(
          'Release this letter to the student',
          'btn pri sm',
          () => { void releaseFinalDocumentToStudent(finalDocument.id); },
          { disabled: Boolean(releasedAt) || !isNonEmptyString(finalDocument.id) },
        ));
        children.push(actions);
        children.push(el(
          'p',
          'micNote',
          'MissionMed records the release and its time. This screen never sets or sends a release time.',
        ));
      }
      const exportControl = buildExportControl();
      if (exportControl) children.push(exportControl);

      return panel(
        'Release to the student',
        children,
        [el('span', releasedAt ? 'chip gn' : 'chip cy', releasedAt ? 'Released' : 'Held')],
      );
    }

    function buildStatusPanel(projection, title = 'Current recommendation case') {
      const completed = projection.builder
        ? projection.builder.completedStepIds.length
        : null;
      const children = [
        row('Case stage', humanize(projection.status)),
      ];
      if (completed !== null) {
        children.push(row('Builder progress', `${completed} of ${BUILDER_STEP_IDS.length} steps complete`));
      }
      if (projection.delivery) {
        children.push(row('Delivery', humanize(projection.delivery.status)));
      }
      return panel(title, children, [el('span', 'chip gn', 'Live record')]);
    }

    function storedBuilderText(projection, stepId, key) {
      const staged = editsFor(stepId);
      if (staged && Object.prototype.hasOwnProperty.call(staged, key) && isNonEmptyString(staged[key])) {
        return staged[key].trim();
      }
      const value = projection?.builder?.stepData?.[stepId]?.[key];
      return isNonEmptyString(value) ? value.trim() : null;
    }

    function buildPathCard(icon, title, detail, activate) {
      const card = button('', 'lorPathCard', activate);
      card.appendChild(el('span', 'lorPathIcon', icon));
      const copy = el('span', 'lorPathCopy');
      copy.appendChild(el('strong', null, title));
      copy.appendChild(el('span', null, detail));
      card.appendChild(copy);
      return card;
    }

    /**
     * The Founder-approved product home, backed only by the current authorized case. The three
     * pathways are presentation choices into the same durable builder; they do not invent a writer,
     * a Timeline rotation, or a synthetic portfolio. Starting a case remains an explicit command.
     */
    function buildApprovedStudentHome(view, projection) {
      view.classList.add('lorApprovedHome');
      appendViewHeading(
        view,
        '',
        'Build the letter',
        'they asked you to write.',
        'LOR Builder turns your real rotations, clinical stories, and verified accomplishments into complete letter materials — your faculty writer reviews, edits, signs, and owns the final.',
      );

      const hasCase = Boolean(projection);
      const completed = hasCase ? projection.builder.completedStepIds.length : 0;
      const enterPath = (intentPath, surface = 'builder', stepId = null) => {
        selectedBuildSurface = surface;
        if (stepId) selectedStepId = stepId;
        if (intentPath) {
          if (hasCase) stageEdit('case_basics', 'intentPath', intentPath);
          else pendingIntentPath = intentPath;
        }
        if (hasCase) renderCase(renderedProjection, currentState);
        else if (emptyStartCase) void emptyStartCase();
      };
      const openLibrary = (favoritesOnly = false) => {
        libraryFavoritesOnly = favoritesOnly;
        selectedAppView = 'library';
        if (hasCase) renderCase(renderedProjection, currentState);
        else showEmptyWorkspace({ startCase: emptyStartCase });
      };

      const hero = el('section', 'lorApprovedHero');
      hero.appendChild(el('div', 'h2', 'Did your preceptor ask you to write the letter?'));
      hero.appendChild(el(
        'p',
        'sub',
        'Build a complete, evidence-grounded option, refine the handoff, and give your writer a professional starting point they can freely revise or replace.',
      ));
      const heroButton = button(
        hasCase ? '✦ Continue Build My LOR' : '✦ Build My LOR',
        'btn pri hero lorHeroAction',
        () => enterPath(null),
      );
      heroButton.id = hasCase ? 'lorContinueBuilder' : 'lorStartCase';
      hero.appendChild(heroButton);
      view.appendChild(hero);

      const secondaryActions = el('div', 'lorHomeSecondaryActions');
      secondaryActions.appendChild(button('Browse Examples & Templates', 'btn alt sm', () => openLibrary(false)));
      secondaryActions.appendChild(button('Build from a Favorite Template', 'btn alt sm', () => openLibrary(true)));
      view.appendChild(secondaryActions);

      const paths = el('div', 'lorPathGrid');
      paths.appendChild(buildPathCard(
        '✍️',
        'My preceptor asked me to write the letter',
        'The guided Builder creates an evidence packet, applicant-prepared option, and polished handoff for their review and signature.',
        () => enterPath('My preceptor asked me to write the letter', 'builder', 'case_basics'),
      ));
      paths.appendChild(buildPathCard(
        '🧭',
        'I want to prepare before I ask',
        'Use the same Builder to organize the request, evidence, deadlines, and writer strategy before an invitation is sent.',
        () => enterPath('I want to prepare before I ask', 'builder', 'case_basics'),
      ));
      paths.appendChild(buildPathCard(
        '🩺',
        'My preceptor wants MissionMed to help them draft it',
        'Prepare the student-owned evidence packet, then invite them into the recipient-bound faculty-private workspace.',
        () => enterPath('My preceptor wants MissionMed to help them draft it', 'faculty_assist', 'writer_relationship'),
      ));
      const continueDetail = hasCase
        ? `${completed} of ${BUILDER_STEP_IDS.length} sections complete · ${humanize(projection.status)} · Version ${projection.revision}`
        : 'No case yet — your in-progress recommendation will appear here after you start.';
      paths.appendChild(buildPathCard(
        '↩',
        'Continue a letter',
        continueDetail,
        () => enterPath(null, 'builder', projection?.builder?.currentStepId || 'case_basics'),
      ));
      view.appendChild(paths);

      if (hasCase) {
        const progress = el('div', 'lorHomeProgress');
        progress.appendChild(buildProgressPipe(new Set(projection.builder.completedStepIds), projection.builder.currentStepId));
        progress.appendChild(el('strong', null, `${completed} of ${BUILDER_STEP_IDS.length} steps complete`));
        progress.appendChild(el('span', 'sub', ` · ${humanize(projection.status)} · changes are live only after MissionMed confirms them.`));
        view.appendChild(progress);
      }
      view.appendChild(el(
        'p',
        'lorFounderPrinciple',
        'Your preceptor always reviews, edits, approves, and signs the final letter — LOR Builder prepares; it never impersonates.',
      ));
    }

    function buildFacultyAssistStart(view, projection) {
      appendViewHeading(
        view,
        'Faculty-assisted path · writer-owned from the start',
        'Prepare the private handoff.',
        'Your writer owns the letter.',
        'Name the writer, publish only the evidence you select, and invite them into a recipient-bound workspace for review, judgment, approval, and release.',
      );
      view.appendChild(buildHeader(projection));
      const grid = el('div', 'grid2 lorViewGrid');
      grid.appendChild(panel('What you prepare', [
        row('Writer identity', storedBuilderText(projection, 'writer_relationship', 'writerName') || 'Name the faculty writer and their role.'),
        row('Observation context', storedBuilderText(projection, 'writer_relationship', 'relationshipSummary') || 'Describe only what they directly observed.'),
        row('Selected evidence', `${projection.studentEvidence.length} published item(s)`),
        row('Applicant-prepared material', `${projection.applicantOptions.length} proposal(s), never a faculty endorsement.`),
      ], [el('span', 'chip cy', 'Student controlled')]));
      grid.appendChild(panel('What the writer controls', [
        row('Secure entry', 'Recipient-bound invitation and one-time verification'),
        row('Private assessment', 'Never returned to the student or mentor projection'),
        row('Letter wording', 'Writer reviews, edits, replaces, and owns the final'),
        row('Release', 'Requires explicit faculty approval and signature attestation'),
      ], [el('span', 'chip gn', 'Faculty owned')]));
      view.appendChild(grid);
      const actions = el('div', 'lorProductionActions lorFacultyAssistActions');
      actions.appendChild(button('Set up this writer', 'btn pri', () => {
        selectedBuildSurface = 'builder';
        selectedStepId = 'writer_relationship';
        renderCase(renderedProjection, currentState);
      }));
      actions.appendChild(button('Preview Writer Depot', 'btn alt', () => {
        selectedAppView = 'depot';
        renderCase(renderedProjection, currentState);
      }));
      view.appendChild(actions);
      view.appendChild(el(
        'p',
        'lorFounderPrinciple',
        'MissionMed can organize evidence and propose grounded wording. It never impersonates the faculty writer or supplies their judgment.',
      ));
    }

    function buildStudentBuilderExperience(view, projection) {
      appendViewHeading(
        view,
        'Build My LOR · evidence-first drafting',
        'Turn witnessed moments into',
        'a writer-ready case.',
        'Move from writer context to grounded evidence, story, privacy, and handoff. Every change stays pending until MissionMed confirms the durable revision.',
      );
      const back = button('‹ LOR Studio home', 'btn alt sm lorBuilderBack', () => {
        selectedBuildSurface = 'home';
        renderCase(renderedProjection, currentState);
      });
      view.appendChild(back);
      view.appendChild(buildHeader(projection));

      const templateLabel = storedBuilderText(projection, 'case_basics', 'templateLabel');
      if (templateLabel) {
        view.appendChild(panel('Template selected', [
          row('Educational structure', templateLabel, el('span', 'chip em', 'Synthetic source')),
          row('Tone', storedBuilderText(projection, 'case_basics', 'templateTone') || 'Not set'),
          row('Structure', storedBuilderText(projection, 'case_basics', 'templateStructure') || 'Not set'),
          row('Length', storedBuilderText(projection, 'case_basics', 'templateLength') || 'Not set'),
          el('p', 'micNote', 'Only this educational structure metadata carries into the case. No sample claim, person, event, or endorsement is copied.'),
        ], [el('span', hasEdits('case_basics') ? 'chip em' : 'chip gn', hasEdits('case_basics') ? 'Save Letter context' : 'Stored in case')]));
      }

      const writerName = storedBuilderText(projection, 'writer_relationship', 'writerName');
      const writerRole = storedBuilderText(projection, 'writer_relationship', 'writerRole');
      const deadline = storedBuilderText(projection, 'faculty_handoff', 'deadline');
      const overview = el('div', 'lorBuilderOverview');
      overview.appendChild(metricCard(
        'Writer',
        writerName || 'Choose',
        writerRole || 'Name the person whose direct observation gives this letter credibility.',
        writerName ? 'gn' : 'em',
      ));
      overview.appendChild(metricCard(
        'Evidence',
        String(projection.studentEvidence.length),
        projection.studentEvidence.length > 0 ? 'Published into the protected writer packet.' : 'Build and publish the evidence your writer may use.',
        projection.studentEvidence.length > 0 ? 'gn' : 'em',
      ));
      overview.appendChild(metricCard(
        'Deadline',
        deadline || 'Set it',
        'Kept with your writer handoff so the request remains actionable.',
        deadline ? 'cy' : 'em',
      ));
      view.appendChild(overview);

      const grid = el('div', 'homeGrid lorViewGrid lorBuilderWorkspace');
      const primary = el('div');
      primary.appendChild(buildBuilderPanel(projection));
      const secondary = el('div');
      secondary.appendChild(panel('Writer-readiness checklist', [
        row('Relationship', writerName || writerRole ? 'Writer context is taking shape.' : 'Name the writer and what they directly observed.', el('span', writerName || writerRole ? 'chip gn' : 'chip em', writerName || writerRole ? 'In progress' : 'Next')),
        row('Evidence packet', `${projection.studentEvidence.length} published item(s)`, el('span', projection.studentEvidence.length > 0 ? 'chip gn' : 'chip em', projection.studentEvidence.length > 0 ? 'Grounded' : 'Needed')),
        row('Consent', readConsentState(projection.consentReceipts).active ? 'Current sharing and AI consent is active.' : 'Review and record the current disclosure.', el('span', readConsentState(projection.consentReceipts).active ? 'chip gn' : 'chip em', readConsentState(projection.consentReceipts).active ? 'Active' : 'Required')),
      ], [el('span', 'chip cy', 'Evidence first')]));
      secondary.appendChild(buildReceiptsPanel(projection));
      const invitationPanel = buildFacultyInvitationPanel(projection);
      if (invitationPanel) secondary.appendChild(invitationPanel);
      secondary.appendChild(buildEvidencePanel(projection));
      grid.appendChild(primary);
      grid.appendChild(secondary);
      view.appendChild(grid);
    }

    function buildStudentGuidanceLibrary(projection = null) {
      const specialties = [
        'Anesthesiology', 'Dermatology', 'Emergency Medicine', 'Family Medicine',
        'Internal Medicine', 'Medicine-Pediatrics', 'Neurology', 'Neurological Surgery',
        'Obstetrics & Gynecology', 'Ophthalmology', 'Orthopaedic Surgery', 'Otolaryngology',
        'Pathology', 'Pediatrics', 'Physical Medicine & Rehabilitation', 'Plastic Surgery',
        'Psychiatry', 'Diagnostic Radiology', 'Interventional Radiology', 'Radiation Oncology',
        'General Surgery', 'Urology', 'Preliminary / Transitional Year',
      ];
      const contexts = [
        'Core / elective clerkship',
        'Hands-on externship',
        'Observership — teaching hospital',
        'Observership — community hospital',
        'Private clinic experience',
        'Private practice experience',
      ];
      const roles = ['Attending physician', 'Program director', 'Department chair', 'Community preceptor', 'Associate professor', 'Clinic medical director'];
      const structures = ['traditional', 'story-led', 'clinical'];
      const tones = ['warm', 'balanced', 'formal'];
      const durations = ['four weeks', 'six weeks', 'eight weeks', 'three months'];
      const lengths = ['concise', 'standard', 'detailed'];
      const strengths = ['Clinical reasoning', 'Communication', 'Work ethic', 'Teamwork', 'Professionalism', 'Teaching', 'Growth mindset'];
      const guides = [];
      specialties.forEach((specialty, specialtyIndex) => {
        for (let variant = 0; variant < 2; variant += 1) {
          const context = contexts[(specialtyIndex * 2 + variant) % contexts.length];
          const structure = structures[(specialtyIndex + variant) % structures.length];
          const tone = tones[(specialtyIndex * 2 + variant) % tones.length];
          const duration = durations[(specialtyIndex + variant) % durations.length];
          const length = lengths[(specialtyIndex + variant) % lengths.length];
          guides.push({
            specialty,
            context,
            role: roles[(specialtyIndex + variant) % roles.length],
            structure,
            tone,
            duration,
            length,
            strengths: [
              strengths[specialtyIndex % strengths.length],
              strengths[(specialtyIndex + 2 + variant) % strengths.length],
              strengths[(specialtyIndex + 4) % strengths.length],
            ],
            title: `${specialty} · ${context}`,
            detail: structure === 'story-led'
              ? 'Open on one directly witnessed moment, show the consequence, then earn the broader assessment.'
              : structure === 'clinical'
                ? 'Lead with observation scope, move through evidence efficiently, and keep every evaluative claim bounded.'
                : 'Use the classic relationship → evidence → qualities → endorsement structure without generic praise.',
            sequence: structure === 'story-led'
              ? 'Observed moment → action → consequence → pattern → writer-owned endorsement'
              : structure === 'clinical'
                ? 'Scope → observed performance → consequence → competency → bounded assessment'
                : 'Relationship → evidence → qualities → program fit → endorsement',
          });
        }
      });
      for (const extra of [
        ['Internal Medicine', 'Observership — teaching hospital', 'story-led', 'warm'],
        ['Family Medicine', 'Private clinic experience', 'traditional', 'warm'],
        ['General Surgery', 'Hands-on externship', 'clinical', 'formal'],
        ['Psychiatry', 'Core / elective clerkship', 'story-led', 'balanced'],
      ]) {
        guides.push({
          specialty: extra[0],
          context: extra[1],
          role: roles[guides.length % roles.length],
          structure: extra[2],
          tone: extra[3],
          duration: durations[guides.length % durations.length],
          length: lengths[guides.length % lengths.length],
          strengths: [
            strengths[guides.length % strengths.length],
            strengths[(guides.length + 2) % strengths.length],
            strengths[(guides.length + 4) % strengths.length],
          ],
          title: `${extra[0]} · ${extra[1]}`,
          detail: extra[2] === 'story-led'
            ? 'Open on one directly witnessed moment, show the consequence, then earn the broader assessment.'
            : extra[2] === 'clinical'
              ? 'Lead with observation scope, move through evidence efficiently, and keep every evaluative claim bounded.'
              : 'Use the classic relationship → evidence → qualities → endorsement structure without generic praise.',
          sequence: 'Observation scope → specific evidence → consequence → writer-owned endorsement',
        });
      }

      guides.forEach((guide, index) => {
        guide.id = `approved-synthetic-${String(index + 1).padStart(2, '0')}`;
        const observation = guide.context.toLowerCase();
        const emphasis = guide.strengths.map((strength) => strength.toLowerCase()).join(', ');
        guide.letter = [
          `Dear ${guide.specialty} Residency Selection Committee:`,
          `This clearly synthetic teaching sample demonstrates a ${guide.structure} recommendation structure. In a real letter, the faculty writer would first identify their role, institution, and the exact scope of direct observation.`,
          `For ${guide.duration} in a ${observation}, [Faculty writer] directly observed [Applicant] prepare carefully, communicate clearly, and follow through on feedback. This paragraph deliberately stays inside the relationship the writer could truthfully verify.`,
          guide.structure === 'story-led'
            ? 'One specific witnessed moment would open the letter here: the applicant notices a meaningful problem, takes an appropriate action, and the writer explains what changed because of it.'
            : guide.structure === 'clinical'
              ? 'A bounded clinical performance example would appear here, moving from observed action to consequence before the writer names the competency it demonstrates.'
              : 'The body would move from relationship to one directly observed example, its consequence, and the broader pattern the writer can honestly support.',
          `Across the relationship, the writer could ground discussion of ${emphasis}. These are teaching categories only; a production letter must replace them with the writer's own evidence and judgment.`,
          `I recommend [Applicant] for ${guide.specialty} training only to the degree supported by my direct observations above. [Faculty writer] would review, edit, approve, sign, and own every word of the final letter.`,
          'Sincerely,\n[Faculty writer]\n[Verified role and institution]',
        ].join('\n\n');
      });

      const rerender = () => {
        if (renderedProjection) renderCase(renderedProjection, currentState);
        else showEmptyWorkspace({ startCase: emptyStartCase });
      };

      const useTemplate = (guide) => {
        const selection = {
          templateId: guide.id,
          templateLabel: guide.title,
          templateTone: guide.tone,
          templateStructure: guide.structure,
          templateLength: guide.length,
          templateGuidance: `Educational starting point: ${guide.sequence}. Replace every sample claim with case-specific evidence and faculty-owned judgment.`,
        };
        selectedAppView = 'build';
        selectedBuildSurface = 'builder';
        selectedStepId = 'case_basics';
        if (projection) {
          for (const [key, value] of Object.entries(selection)) stageEdit('case_basics', key, value);
          renderCase(renderedProjection, currentState);
        } else {
          pendingTemplateSelection = selection;
          if (emptyStartCase) void emptyStartCase();
        }
      };

      const container = el('div', 'lorLibrary');
      if (libraryFavoritesOnly) {
        const favoriteNotice = panel('Favorite templates', [
          el(
            'p',
            'sub',
            libraryFavorites.size === 0
              ? 'You have not starred a template in this browser session yet. Show all samples, open one, and use its ☆ control to add it here.'
              : `${libraryFavorites.size} starred template(s) are available in this browser session. Your live case changes only when you explicitly use a template and save it.`,
          ),
          button('Show all samples', 'btn alt sm', () => {
            libraryFavoritesOnly = false;
            rerender();
          }),
        ], [el('span', 'chip em', 'Session favorites')]);
        container.appendChild(favoriteNotice);
      }
      const filters = el('div', 'lorLibraryFilters');
      const search = doc.createElement('input');
      search.type = 'search';
      search.value = librarySearch;
      search.placeholder = 'Search 50 samples';
      search.setAttribute('aria-label', 'Search samples');
      search.dataset.step = 'library';
      search.dataset.field = 'search';
      search.addEventListener('input', () => {
        librarySearch = search.value;
        rerender();
      });
      filters.appendChild(search);
      const selectFilter = (label, value, options, update) => {
        const select = doc.createElement('select');
        select.setAttribute('aria-label', label);
        const all = doc.createElement('option');
        all.value = 'all';
        all.textContent = `${label}: all`;
        select.appendChild(all);
        for (const optionValue of options) {
          const option = doc.createElement('option');
          option.value = optionValue;
          option.textContent = optionValue;
          select.appendChild(option);
        }
        select.value = value;
        select.addEventListener('change', () => {
          update(select.value);
          rerender();
        });
        return select;
      };
      filters.appendChild(selectFilter('Specialty', librarySpecialty, specialties, (value) => { librarySpecialty = value; }));
      filters.appendChild(selectFilter('USCE', libraryContext, contexts, (value) => { libraryContext = value; }));
      filters.appendChild(selectFilter('Writer role', libraryRole, roles, (value) => { libraryRole = value; }));
      filters.appendChild(selectFilter('Duration', libraryDuration, durations, (value) => { libraryDuration = value; }));
      filters.appendChild(selectFilter('Tone', libraryTone, tones, (value) => { libraryTone = value; }));
      filters.appendChild(selectFilter('Length', libraryLength, lengths, (value) => { libraryLength = value; }));
      filters.appendChild(selectFilter('Structure', libraryStructure, structures, (value) => { libraryStructure = value; }));
      filters.appendChild(selectFilter('Strength', libraryStrength, strengths, (value) => { libraryStrength = value; }));

      const query = librarySearch.trim().toLowerCase();
      const visibleGuides = guides.filter((guide) => (
        (!libraryFavoritesOnly || libraryFavorites.has(guide.id))
        && (librarySpecialty === 'all' || guide.specialty === librarySpecialty)
        && (libraryContext === 'all' || guide.context === libraryContext)
        && (libraryRole === 'all' || guide.role === libraryRole)
        && (libraryDuration === 'all' || guide.duration === libraryDuration)
        && (libraryTone === 'all' || guide.tone === libraryTone)
        && (libraryLength === 'all' || guide.length === libraryLength)
        && (libraryStructure === 'all' || guide.structure === libraryStructure)
        && (libraryStrength === 'all' || guide.strengths.includes(libraryStrength))
        && (query === '' || `${guide.title} ${guide.role} ${guide.duration} ${guide.structure} ${guide.tone} ${guide.length} ${guide.strengths.join(' ')} ${guide.letter}`.toLowerCase().includes(query))
      ));
      const hasFilter = query !== ''
        || librarySpecialty !== 'all'
        || libraryContext !== 'all'
        || libraryRole !== 'all'
        || libraryDuration !== 'all'
        || libraryTone !== 'all'
        || libraryLength !== 'all'
        || libraryStructure !== 'all'
        || libraryStrength !== 'all';
      if (hasFilter) {
        filters.appendChild(button('Clear filters', 'btn alt sm', () => {
          librarySearch = '';
          librarySpecialty = 'all';
          libraryContext = 'all';
          libraryRole = 'all';
          libraryDuration = 'all';
          libraryTone = 'all';
          libraryLength = 'all';
          libraryStructure = 'all';
          libraryStrength = 'all';
          rerender();
        }));
      }
      filters.appendChild(el('span', 'chip cy lorLibraryCount', `${visibleGuides.length} of ${guides.length}`));
      container.appendChild(filters);

      if (libraryCompare.length === 2) {
        const compared = libraryCompare.map((id) => guides.find((guide) => guide.id === id)).filter(Boolean);
        if (compared.length === 2) {
          container.appendChild(panel('Compare two structures', [
            row(compared[0].title, `${compared[0].structure} · ${compared[0].tone} · ${compared[0].length}`),
            row(compared[1].title, `${compared[1].structure} · ${compared[1].tone} · ${compared[1].length}`),
            row('Key difference', `${compared[0].sequence}  /  ${compared[1].sequence}`),
            button('Clear comparison', 'btn alt sm', () => {
              libraryCompare = [];
              rerender();
            }),
          ], [el('span', 'chip cy', '2 selected')]));
        }
      }

      const openGuide = guides.find((guide) => guide.id === libraryOpenSampleId);
      if (openGuide) {
        const letter = el('pre', 'lorSampleLetter', openGuide.letter);
        const actions = el('div', 'lorProductionActions');
        actions.appendChild(button(projection ? 'Use this structure in Builder' : 'Start a case with this structure', 'btn pri sm', () => useTemplate(openGuide)));
        actions.appendChild(button('Close sample', 'btn alt sm', () => {
          libraryOpenSampleId = null;
          rerender();
        }));
        container.appendChild(panel(openGuide.title, [
          el('p', 'sub', `${openGuide.role} · ${openGuide.duration} · ${openGuide.tone} · ${openGuide.structure} · ${openGuide.length}`),
          letter,
          row('Why it works', openGuide.detail),
          row('Teaching sequence', openGuide.sequence),
          actions,
          el('p', 'micNote', 'Synthetic — every name placeholder, event, and endorsement is instructional. Only structure, tone, and length may carry into the Builder.'),
        ], [el('span', 'chip em', 'Synthetic example')]));
      }

      const grid = el('div', 'grid2 lorTemplateGrid');
      for (const guide of visibleGuides) {
        const card = el('article', 'draftCard');
        const head = el('div', 'dHead');
        head.appendChild(el('div', 'h2', guide.title));
        const favorite = button(libraryFavorites.has(guide.id) ? '★' : '☆', 'lorFavoriteButton', () => {
          if (libraryFavorites.has(guide.id)) libraryFavorites.delete(guide.id);
          else libraryFavorites.add(guide.id);
          rerender();
        });
        favorite.setAttribute('aria-label', libraryFavorites.has(guide.id) ? `Remove ${guide.title} from favorites` : `Add ${guide.title} to favorites`);
        favorite.setAttribute('aria-pressed', libraryFavorites.has(guide.id) ? 'true' : 'false');
        head.appendChild(favorite);
        card.appendChild(head);
        card.appendChild(el('span', 'chip em lorSyntheticChip', 'Synthetic example'));
        card.appendChild(el('p', 'sub lorTemplateDetail', guide.detail));
        const body = el('div', 'dBody', guide.sequence);
        card.appendChild(body);
        const foot = el('div', 'dFoot');
        foot.appendChild(el('span', 'chip', guide.role));
        foot.appendChild(el('span', 'chip', guide.duration));
        foot.appendChild(el('span', 'chip', guide.tone));
        foot.appendChild(el('span', 'chip', guide.structure));
        foot.appendChild(el('span', 'chip', guide.length));
        card.appendChild(foot);
        const actions = el('div', 'lorTemplateActions');
        actions.appendChild(button('Open complete sample', 'btn alt sm', () => {
          libraryOpenSampleId = guide.id;
          rerender();
        }));
        actions.appendChild(button(libraryCompare.includes(guide.id) ? '✓ Comparing' : '+ Compare', 'btn alt sm', () => {
          if (libraryCompare.includes(guide.id)) libraryCompare = libraryCompare.filter((id) => id !== guide.id);
          else libraryCompare = [...libraryCompare.slice(-1), guide.id];
          rerender();
        }));
        card.appendChild(actions);
        grid.appendChild(card);
      }
      if (visibleGuides.length === 0) {
        grid.appendChild(panel('No examples match those filters', [
          el('p', 'sub', libraryFavoritesOnly && libraryFavorites.size === 0
            ? 'Show all samples and star the structures you want to revisit in this browser session.'
            : 'Clear or broaden the search to return to the full educational library.'),
        ]));
      }
      container.appendChild(grid);
      container.appendChild(el(
        'p',
        'micNote lorLibraryDisclosure',
        'All 50 samples are de-identified synthetic educational structures. Starting from one carries only structure, tone, and length — never its claims or people — into your live case.',
      ));
      return container;
    }

    function buildStudentIntelligence(projection) {
      const completed = projection.builder.completedStepIds.length;
      const consent = readConsentState(projection.consentReceipts);
      const evidence = projection.studentEvidence.length;
      const options = projection.applicantOptions.length;
      const readyForHandoff = completed === BUILDER_STEP_IDS.length && consent.active && evidence > 0;
      const grid = el('div', 'lorMetricsGrid');
      grid.appendChild(metricCard(
        'Builder coverage',
        `${completed}/${BUILDER_STEP_IDS.length}`,
        completed === BUILDER_STEP_IDS.length ? 'The evidence packet is structurally complete.' : 'Complete the remaining evidence-first steps.',
        completed === BUILDER_STEP_IDS.length ? 'gn' : 'em',
      ));
      grid.appendChild(metricCard(
        'Grounded evidence',
        String(evidence),
        evidence === 1 ? 'One published evidence item is available to the verified writer.' : `${evidence} published evidence items are available to the verified writer.`,
        evidence > 0 ? 'gn' : 'em',
      ));
      grid.appendChild(metricCard(
        'Applicant options',
        String(options),
        options === 0 ? 'No applicant-prepared option is stored yet.' : 'Options remain proposals until the writer reviews them.',
        options > 0 ? 'cy' : 'em',
      ));
      grid.appendChild(metricCard(
        'Writer readiness',
        readyForHandoff ? 'Ready' : 'Building',
        readyForHandoff
          ? 'Builder, consent, and grounded evidence gates are satisfied.'
          : 'Readiness is based only on visible completion, consent, and evidence — never a hidden score.',
        readyForHandoff ? 'gn' : 'em',
      ));
      return grid;
    }

    function nextCaseAction(projection) {
      const completed = projection.builder.completedStepIds.length;
      if (projection.status === 'draft' && completed < BUILDER_STEP_IDS.length) {
        return `Complete ${BUILDER_STEP_LABELS[projection.builder.currentStepId] || 'the next Builder step'}.`;
      }
      if (projection.status === 'draft' && projection.studentEvidence.length === 0) {
        return 'Publish the evidence packet you want the verified writer to receive.';
      }
      if (projection.status === 'draft') return 'Preview the Writer Depot, then send the recipient-bound invitation.';
      if (projection.status === 'faculty_invited') return 'The invitation is pending; use the existing resend or replacement controls only if needed.';
      if (projection.status === 'faculty_verified') return 'The writer is verified and can begin their private review.';
      if (projection.status === 'faculty_review') return 'The writer owns the next step: private review, editing, approval, and signature.';
      if (projection.status === 'faculty_approved') return 'The approved letter is held until the writer releases it under your access decision.';
      if (projection.status === 'delivered') return 'Confirm the recorded destination and retain the permitted export for your records.';
      return 'Review the live case stage and delivery record.';
    }

    function buildLetterPlanCard(projection) {
      const writerName = storedBuilderText(projection, 'writer_relationship', 'writerName');
      const writerRole = storedBuilderText(projection, 'writer_relationship', 'writerRole');
      const institution = storedBuilderText(projection, 'writer_relationship', 'institution');
      const programType = storedBuilderText(projection, 'case_basics', 'programType');
      const deadline = storedBuilderText(projection, 'faculty_handoff', 'deadline');
      const waiver = readWaiverState(projection.waiverReceipts);
      const invitationActive = projection.status !== 'draft';
      const released = isPlainObject(projection.finalDocument)
        && isNonEmptyString(projection.finalDocument.releasedToStudentAt);
      return panel(writerName || 'Current recommendation plan', [
        row('Writer', [writerRole, institution].filter(Boolean).join(' · ') || 'Complete Choose your writer.'),
        row('Target', programType || 'Add the target program or training path in Letter context.'),
        row('Deadline', deadline || 'Set a deadline in Writer handoff.'),
        row('Access decision', waiver.decided ? (waiver.waived ? 'Waived' : 'Keep access') : 'Not decided'),
        row('Request status', invitationActive ? humanize(projection.status) : 'Not sent'),
        row('Letter status', released ? 'Released to the student under the recorded access decision' : 'Not released'),
        row('Next recommended action', nextCaseAction(projection), el('span', 'chip cy', 'Next')),
        el('p', 'micNote', 'This card contains only the recommendation case authorized in your current MissionMed route. It does not invent other writers or letters.'),
      ], [el('span', 'chip gn', 'Live portfolio card')]);
    }

    function buildRecommendationInsights(projection) {
      const completed = new Set(projection.builder.completedStepIds);
      const writer = storedBuilderText(projection, 'writer_relationship', 'writerName');
      const rotation = storedBuilderText(projection, 'writer_relationship', 'institution');
      const observedFor = storedBuilderText(projection, 'writer_relationship', 'relationshipLength');
      const program = storedBuilderText(projection, 'case_basics', 'programType');
      const missing = [];
      if (!writer) missing.push('writer identity');
      if (!rotation) missing.push('rotation or institution');
      if (!observedFor) missing.push('observation duration');
      if (projection.studentEvidence.length === 0) missing.push('published evidence');
      if (!readConsentState(projection.consentReceipts).active) missing.push('current consent');
      if (!completed.has('faculty_handoff')) missing.push('writer handoff');
      const grid = el('div', 'grid2 lorViewGrid');
      grid.appendChild(panel('Writer readiness explained', [
        row('Writer', writer || 'Not named'),
        row('Observed relationship', observedFor || 'Not described'),
        row('Rotation context', rotation || 'Not connected in this case'),
        row('Evidence available', `${projection.studentEvidence.length} published item(s)`),
        row('What is still missing', missing.length === 0 ? 'No visible readiness gap.' : missing.join(', ')),
      ], [el('span', missing.length === 0 ? 'chip gn' : 'chip em', missing.length === 0 ? 'Writer ready' : `${missing.length} gap(s)`) ]));
      grid.appendChild(panel('Program & assignment context', [
        row('Target training path', program || 'Not set in Letter context'),
        row('Current case stage', humanize(projection.status)),
        row('Deadline', storedBuilderText(projection, 'faculty_handoff', 'deadline') || 'Not set'),
        row('Recommended next action', nextCaseAction(projection)),
        el('p', 'micNote', 'No program requirement, assignment, or Timeline fact is invented when the authorized case projection does not contain it.'),
      ], [el('span', 'chip cy', 'Explainable') ]));
      return grid;
    }

    function buildWriterPacketPreview(projection) {
      const writerName = storedBuilderText(projection, 'writer_relationship', 'writerName');
      const writerRole = storedBuilderText(projection, 'writer_relationship', 'writerRole');
      const relationship = storedBuilderText(projection, 'writer_relationship', 'relationshipSummary');
      const evidence = storedBuilderText(projection, 'evidence_selection', 'priorityEvidence');
      const story = storedBuilderText(projection, 'timeline_highlights', 'standoutMoment');
      const deadline = storedBuilderText(projection, 'faculty_handoff', 'deadline');
      const rows = [
        row('Faculty writer', writerName || writerRole || 'Add your writer in the Builder.', el('span', writerName || writerRole ? 'chip gn' : 'chip em', writerName || writerRole ? 'Named' : 'Needed')),
        row('Observation scope', relationship || 'Describe what this writer directly observed.'),
        row('Priority evidence', evidence || 'Choose the evidence that carries the recommendation.'),
        row('Signature story', story || 'Add the witnessed moment that makes the evidence memorable.'),
        row('Requested by', deadline || 'Set a deadline in Writer handoff.'),
        row('Published evidence', `${projection.studentEvidence.length} item(s) available to the verified writer.`),
        row('Applicant-prepared options', `${projection.applicantOptions.length} proposal(s), always subject to faculty review.`),
      ];
      rows.push(el(
        'p',
        'micNote',
        'This preview is assembled from your live case. Faculty-private assessment and letter wording never appear here.',
      ));
      return panel('Writer-ready package preview', rows, [el('span', 'chip cy', 'Live case')]);
    }

    function buildWriterPrivatePagePreview(projection) {
      const writerName = storedBuilderText(projection, 'writer_relationship', 'writerName');
      const relationship = storedBuilderText(projection, 'writer_relationship', 'relationshipSummary');
      const institution = storedBuilderText(projection, 'writer_relationship', 'institution');
      const invitationStarted = projection.status !== 'draft';
      return panel(writerName ? `Welcome, ${writerName}` : 'Writer-specific private page', [
        el('p', 'sub', writerName
          ? 'This professional preview is the exact student-controlled packet for this writer.'
          : 'Name the writer in Build My LOR to personalize this private-page preview.'),
        row('Relationship context', relationship || 'Not described yet'),
        row('Rotation or institution', institution || 'Not set'),
        row('Selected evidence only', `${projection.studentEvidence.length} published item(s)`),
        row('Applicant-prepared proposals', `${projection.applicantOptions.length} option(s), never a faculty endorsement`),
        row('Secure access', invitationStarted ? `${humanize(projection.status)} · recipient-bound verification` : 'Created only when you send the production invitation'),
        row('Faculty-private work', 'Assessment, notes, edits, approval, signature, and final wording stay private'),
        el('p', 'micNote', 'MissionMed never exposes the invite token or one-time code in this student preview.'),
      ], [el('span', invitationStarted ? 'chip gn' : 'chip dashed', invitationStarted ? 'Active handoff' : 'Preview')]);
    }

    function buildLetterTimeline(projection) {
      const completed = projection.builder.completedStepIds.length;
      const percent = Math.round((completed / BUILDER_STEP_IDS.length) * 100);
      const consent = readConsentState(projection.consentReceipts).active;
      const waiver = readWaiverState(projection.waiverReceipts);
      const released = isPlainObject(projection.finalDocument)
        && isNonEmptyString(projection.finalDocument.releasedToStudentAt);
      return panel('Recommendation journey', [
        row('1 · Prepare', `${completed} of ${BUILDER_STEP_IDS.length} steps complete · ${percent}%`, el('span', completed === BUILDER_STEP_IDS.length ? 'chip gn' : 'chip cy', completed === BUILDER_STEP_IDS.length ? 'Complete' : 'In progress')),
        row('2 · Protect', consent ? 'Current consent is recorded.' : 'Current consent still needs your decision.', el('span', consent ? 'chip gn' : 'chip em', consent ? 'Recorded' : 'Action needed')),
        row('Access decision', waiver.decided ? (waiver.waived ? 'You waived your right to read the finished letter.' : 'You kept your right to read the finished letter.') : 'You have not recorded a waiver decision yet.'),
        row('3 · Invite', ['faculty_invited', 'faculty_verified', 'faculty_review', 'faculty_approved', 'delivered', 'closed'].includes(projection.status) ? 'Faculty handoff has begun.' : 'Invitation has not been sent.', el('span', projection.status === 'draft' ? 'chip dashed' : 'chip cy', projection.status === 'draft' ? 'Not sent' : 'Active')),
        row('4 · Faculty owns final', ['faculty_review', 'faculty_approved', 'delivered', 'closed'].includes(projection.status) ? 'The recipient-bound faculty workspace is active.' : 'Begins after recipient verification.'),
        row('5 · Release & delivery', released ? 'A finished letter was released under the recorded access decision.' : humanize(projection.delivery.status), el('span', released ? 'chip gn' : 'chip dashed', released ? 'Released' : 'Pending')),
      ], [el('span', 'chip gn', 'Server-confirmed state')]);
    }

    function buildStudentAppView(view, projection) {
      const current = ensureAppView('student');
      if (current === 'library') {
        appendViewHeading(
          view,
          'Examples & Templates · evidence-first structures',
          'Study the structure,',
          'keep every claim honest.',
          'Reusable patterns for common recommendation situations. These are guidance structures, not case records or finished letters.',
        );
        view.appendChild(buildStudentGuidanceLibrary(projection));
        return;
      }

      if (current === 'depot') {
        appendViewHeading(
          view,
          'Writer Depot · one protected handoff per case',
          'Look exceptionally',
          'prepared.',
          'Publish only the evidence you selected, then invite the faculty writer into their recipient-bound private workspace.',
        );
        view.appendChild(buildHeader(projection));
        const grid = el('div', 'grid2 lorViewGrid');
        const left = el('div');
        left.appendChild(buildWriterPrivatePagePreview(projection));
        left.appendChild(buildWriterPacketPreview(projection));
        left.appendChild(buildEvidencePanel(projection));
        const right = el('div');
        const invitation = buildFacultyInvitationPanel(projection);
        if (invitation) right.appendChild(invitation);
        right.appendChild(panel('Exactly what the writer receives', [
          row('Published evidence', `${projection.studentEvidence.length} item(s)`),
          row('Applicant options', `${projection.applicantOptions.length} option(s)`),
          row('Case access', 'Recipient-bound invitation and one-time verification'),
          el('p', 'micNote', 'The writer does not receive your full MissionMed profile. Faculty-private work never returns to the student or mentor projection.'),
        ], [el('span', 'chip gn', 'Least privilege')]));
        grid.appendChild(left);
        grid.appendChild(right);
        view.appendChild(grid);
        return;
      }

      if (current === 'letters') {
        appendViewHeading(
          view,
          'My letters & tracking',
          'Every stage,',
          'one honest timeline.',
          'This view follows the recommendation case authorized in your current MissionMed route.',
        );
        view.appendChild(buildHeader(projection));
        const grid = el('div', 'grid2 lorViewGrid');
        const left = el('div');
        left.appendChild(buildLetterPlanCard(projection));
        left.appendChild(buildLetterTimeline(projection));
        left.appendChild(buildDeliveryPanel(projection));
        const right = el('div');
        right.appendChild(buildStatusPanel(projection, storedBuilderText(projection, 'writer_relationship', 'writerName') || 'Your current letter plan'));
        right.appendChild(buildFinalDocumentPanel(projection));
        const invitation = buildFacultyInvitationPanel(projection);
        if (invitation) right.appendChild(invitation);
        grid.appendChild(left);
        grid.appendChild(right);
        view.appendChild(grid);
        return;
      }

      if (current === 'intel') {
        appendViewHeading(
          view,
          'Recommendation intelligence · explainable readiness',
          'Know what is grounded,',
          'and what is still missing.',
          'Every indicator below is derived from this live case. There is no hidden score and no fixture portfolio.',
        );
        view.appendChild(buildHeader(projection));
        view.appendChild(buildStudentIntelligence(projection));
        view.appendChild(buildRecommendationInsights(projection));
        view.appendChild(panel('Provenance & grounding visibility', [
          row('Student-supplied evidence', `${projection.studentEvidence.length} published item(s)`, el('span', 'prov stu', 'Student')),
          row('Applicant-prepared options', `${projection.applicantOptions.length} stored option(s)`, el('span', 'prov ai', 'Proposal only')),
          row('Explicit consent', readConsentState(projection.consentReceipts).active ? 'Current policy consent is active.' : 'Current policy consent is not active.', el('span', readConsentState(projection.consentReceipts).active ? 'chip gn' : 'chip em', readConsentState(projection.consentReceipts).active ? 'Active' : 'Required')),
          el('p', 'micNote', 'Faculty evaluation and final endorsement remain faculty-owned even when AI proposes grounded wording.'),
        ]));
        return;
      }

      if (current === 'settings') {
        appendViewHeading(
          view,
          'Settings · privacy and access',
          'Your choices stay',
          'visible and reversible.',
          'Consent and waiver records are durable, append-only decisions tied to this recommendation case.',
        );
        view.appendChild(buildHeader(projection));
        const grid = el('div', 'grid2 lorViewGrid');
        const left = el('div');
        left.appendChild(panel('LOR Studio preferences', [
          row('Current workspace', 'Student recommendation case'),
          row('Target training path', storedBuilderText(projection, 'case_basics', 'programType') || 'Set in Letter context'),
          row('Selected template', storedBuilderText(projection, 'case_basics', 'templateLabel') || 'None selected'),
          row('Matrix return', 'Always available from the fixed header control'),
          row('Case continuity', `Case ${projection.caseId} · Version ${projection.revision}`),
        ], [el('span', 'chip gn', 'Live account') ]));
        left.appendChild(buildReceiptsPanel(projection));
        const right = el('div');
        right.appendChild(panel('Role boundaries', [
          row('Student', 'Builder, selected evidence, invitations, status, and permitted released letter.'),
          row('Mentor', 'Strategy and milestone projection only.'),
          row('Faculty writer', 'Recipient-bound private workspace and final release authority.'),
          el('p', 'micNote', 'Return to Matrix from the fixed control in the LOR Studio header. Authentication and entitlement remain server-owned.'),
        ], [el('span', 'chip gn', 'Server enforced')]));
        right.appendChild(panel('Privacy controls', [
          row('Future AI and sharing', readConsentState(projection.consentReceipts).active ? 'Current consent is active and can be withdrawn below.' : 'No current consent is active.'),
          row('Final-letter access', readWaiverState(projection.waiverReceipts).decided ? (readWaiverState(projection.waiverReceipts).waived ? 'Waived' : 'Keep access') : 'Not decided'),
          row('Invitation access', projection.status === 'draft' ? 'No verified faculty writer yet' : humanize(projection.status)),
        ], [el('span', 'chip cy', 'Case scoped')]));
        grid.appendChild(left);
        grid.appendChild(right);
        view.appendChild(grid);
        return;
      }

      if (selectedBuildSurface === 'builder') {
        buildStudentBuilderExperience(view, projection);
      } else if (selectedBuildSurface === 'faculty_assist') {
        buildFacultyAssistStart(view, projection);
      } else {
        buildApprovedStudentHome(view, projection);
      }
    }

    function readableSharedItem(item, index, fallback) {
      if (!isPlainObject(item)) return `${fallback} ${index + 1}`;
      for (const key of ['title', 'label', 'name', 'summary', 'type']) {
        if (isNonEmptyString(item[key])) return truncate(item[key]);
      }
      return `${fallback} ${index + 1}`;
    }

    function buildFacultySharedEvidence(projection) {
      const evidence = projection.studentShared.evidence;
      const options = projection.studentShared.applicantOptions;
      const children = [];
      if (evidence.length === 0) children.push(el('p', 'sub', 'No student evidence has been published to this writer workspace.'));
      evidence.forEach((item, index) => {
        children.push(row(readableSharedItem(item, index, 'Evidence item'), describeValue(item), el('span', 'prov stu', 'Student supplied')));
      });
      options.forEach((item, index) => {
        children.push(row(readableSharedItem(item, index, 'Applicant option'), describeValue(item), el('span', 'prov ai', 'Proposal only')));
      });
      children.push(el('p', 'micNote', 'Everything in this panel was deliberately published into this recipient-bound case. Your private notes and final wording remain separate.'));
      return panel('Evidence packet', children, [el('span', 'chip cy', `${evidence.length} evidence · ${options.length} option`)]);
    }

    function buildFacultyRequestPanel(projection) {
      const waiver = projection.studentShared.waiverState;
      return panel('Request at a glance', [
        row('Case stage', humanize(projection.status)),
        row('Student access decision', waiver.decided ? (waiver.waived ? 'Student waived access.' : 'Student kept access.') : 'No decision recorded.'),
        row('Shared evidence', `${projection.studentShared.evidence.length} published item(s)`),
        row('Applicant options', `${projection.studentShared.applicantOptions.length} proposal(s)`),
        el('p', 'micNote', 'Applicant-prepared wording and AI output are evidence or proposals only. The faculty writer owns evaluation, endorsement, approval, signature attestation, and release.'),
      ], [el('span', 'chip gn', 'Verified writer')]);
    }

    function renderFacultyCase(projection, stateName) {
      const host = resolveMount();
      clear(host);
      const view = buildApprovedShell(projection, 'faculty', stateName);
      appendViewHeading(
        view,
        'Faculty secure workspace · private by design',
        'Review the evidence.',
        'Own the final.',
        'The student can see status, not your private work. Release happens only after your explicit review and attestation.',
      );
      const strip = el('div', 'lorCaseBand');
      const band = el('div', 'lorCaseBandInner');
      band.appendChild(el('span', TONE_STAGE_CLASS[CASE_STATUS_TONES[projection.status] || 'info'], humanize(projection.status)));
      band.appendChild(el('span', 'chip', `Case ${projection.caseId}`));
      band.appendChild(el('span', 'chip', `Version ${projection.revision}`));
      const saveChip = buildSaveStateChip();
      if (saveChip) band.appendChild(saveChip);
      strip.appendChild(band);
      view.appendChild(strip);

      const active = ensureAppView('faculty');
      if (active === 'request') {
        view.appendChild(buildFacultyRequestPanel(projection));
      } else if (active === 'evidence') {
        view.appendChild(buildFacultySharedEvidence(projection));
      } else if (active === 'assess') {
        view.appendChild(buildFacultySharedEvidence(projection));
        view.appendChild(panel('Private assessment record', [
          row('Private answers', `${projection.facultyPrivate.answers.length} recorded`),
          row('Private notes', `${projection.facultyPrivate.notes.length} recorded`),
          el('p', 'micNote', 'These counts come from your faculty-private record. No student or mentor projection contains their content.'),
        ], [el('span', 'chip cy', 'Faculty private')]));
      } else if (active === 'release') {
        view.appendChild(buildFacultyRelease(projection));
      } else if (active === 'delivery') {
        view.appendChild(buildDeliveryPanel(projection));
      } else {
        view.appendChild(buildFacultyRequestPanel(projection));
        view.appendChild(buildFacultySharedEvidence(projection));
        view.appendChild(buildFacultyAuthoring(projection));
        const aiPanel = buildAiProposalPanel();
        if (aiPanel) view.appendChild(aiPanel);
        view.appendChild(buildFacultyRelease(projection));
        view.appendChild(buildDeliveryPanel(projection));
      }
      renderedProjection = projection;
    }

    function renderMentorCase(projection, stateName) {
      const host = resolveMount();
      clear(host);
      const view = buildApprovedShell(projection, 'mentor', stateName);
      const active = ensureAppView('mentor');
      if (active === 'coverage') {
        appendViewHeading(
          view,
          'Mentor · portfolio coverage',
          'Coach the gaps,',
          'never read the letter.',
          'Coverage here means the real case, strategy, milestone, and delivery signals the mentor-safe projection permits.',
        );
        const grid = el('div', 'lorMetricsGrid');
        grid.appendChild(metricCard('Case', humanize(projection.status), 'Current case progression.', 'cy'));
        grid.appendChild(metricCard('Strategy', projection.strategyStatus === null ? 'Not set' : humanize(projection.strategyStatus), 'Student strategy signal.', projection.strategyStatus === null ? 'em' : 'gn'));
        grid.appendChild(metricCard('Milestone', projection.nextMilestone === null ? 'Not set' : humanize(projection.nextMilestone), 'Next coaching milestone.', projection.nextMilestone === null ? 'em' : 'gn'));
        grid.appendChild(metricCard('Delivery', projection.deliveryStatus === null ? 'Not set' : humanize(projection.deliveryStatus), 'Delivery progression only.', projection.deliveryStatus === null ? 'em' : 'cy'));
        view.appendChild(grid);
        view.appendChild(panel('Privacy boundary', [
          row('Faculty-private answers', 'Not included'),
          row('Draft and final wording', 'Not included'),
          row('Student evidence content', 'Not included'),
          el('p', 'micNote', 'The mentor can coach strategy from approved signals without receiving the education-record content or waived letter.'),
        ], [el('span', 'chip gn', 'Least privilege')]));
      } else if (active === 'deadlines') {
        appendViewHeading(
          view,
          'Mentor · deadlines & exceptions',
          'Know what moves next,',
          'and what needs attention.',
          'The mentor-safe contract exposes a next milestone and delivery state without disclosing private case content.',
        );
        view.appendChild(panel('Milestone watch', [
          row('Case stage', humanize(projection.status), el('span', 'chip cy', 'Live')),
          row('Next milestone', projection.nextMilestone === null ? 'Not set.' : humanize(projection.nextMilestone), el('span', projection.nextMilestone === null ? 'chip em' : 'chip gn', projection.nextMilestone === null ? 'Needs plan' : 'Tracked')),
          row('Delivery state', projection.deliveryStatus === null ? 'Not set.' : humanize(projection.deliveryStatus)),
          el('p', 'micNote', 'No date is invented when the authorized mentor projection does not contain one.'),
        ], [el('span', 'chip', 'Read only')]));
      } else if (active === 'settings') {
        appendViewHeading(
          view,
          'Mentor · settings',
          'Strategy access,',
          'bounded by role.',
          'Your current MissionMed identity determines the cases and fields available here.',
        );
        view.appendChild(panel('Mentor access', [
          row('Assigned case', projection.caseId),
          row('Mode', 'Read-only strategy projection'),
          row('Faculty-private workspace', 'No access'),
          row('Letter export or release', 'No access'),
          el('p', 'micNote', 'Return to Matrix from the fixed header control. This interface cannot become a student or faculty workspace.'),
        ], [el('span', 'chip gn', 'Server enforced')]));
      } else {
        appendViewHeading(
          view,
          'Mentor · letter strategy',
          'Recommendation',
          'portfolio overview.',
          'See enough to coach readiness and progression. Faculty-private answers and letter wording stay behind a separate authorization boundary.',
        );
        view.appendChild(panel('Mentor case status', [
          row('Case stage', humanize(projection.status)),
          row('Strategy status', projection.strategyStatus === null ? 'Not set.' : humanize(projection.strategyStatus)),
          row('Next milestone', projection.nextMilestone === null ? 'Not set.' : humanize(projection.nextMilestone)),
          row('Delivery status', projection.deliveryStatus === null ? 'Not set.' : humanize(projection.deliveryStatus)),
          el('p', 'micNote', 'This is the exact read-only mentor projection. Student and faculty-private content is not included.'),
        ], [el('span', 'chip', 'Read only')]));
      }
      renderedProjection = projection;
    }

    /**
     * Re-rendering from server truth is how this renderer stays honest, but a rebuild during
     * autosave would rip the caret out of the box the student is typing in. The focused field and
     * its selection are therefore restored afterwards - purely a DOM courtesy, and only ever onto
     * the same step and field it came from.
     */
    function captureFocus() {
      const active = doc.activeElement;
      if (!active || !active.dataset || !active.dataset.field) return null;
      return {
        step: active.dataset.step || '',
        field: active.dataset.field,
        start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
        end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
      };
    }

    function restoreFocus(snapshot) {
      if (!snapshot) return;
      const host = resolveMount();
      const selector = `[data-step="${snapshot.step}"][data-field="${snapshot.field}"]`;
      const target = host.querySelector(selector);
      if (!target || typeof target.focus !== 'function') return;
      target.focus();
      if (snapshot.start !== null && typeof target.setSelectionRange === 'function') {
        const limit = String(target.value ?? '').length;
        try {
          target.setSelectionRange(Math.min(snapshot.start, limit), Math.min(snapshot.end ?? snapshot.start, limit));
        } catch {
          /* selection restoration is a nicety; never let it break a render */
        }
      }
    }

    function renderCase(projection, stateName) {
      const focus = captureFocus();
      if (renderedKind === 'mentor') {
        renderMentorCase(projection, stateName);
        return;
      }
      if (renderedKind === 'faculty') {
        renderFacultyCase(projection, stateName);
        restoreFocus(focus);
        return;
      }
      const host = resolveMount();
      if (pendingIntentPath) {
        stageEdit('case_basics', 'intentPath', pendingIntentPath);
        pendingIntentPath = null;
      }
      if (pendingTemplateSelection) {
        for (const [key, value] of Object.entries(pendingTemplateSelection)) {
          stageEdit('case_basics', key, value);
        }
        pendingTemplateSelection = null;
        selectedAppView = 'build';
        selectedBuildSurface = 'builder';
        selectedStepId = 'case_basics';
      }
      selectedStepId = pickSelectedStep(projection);
      clear(host);
      const view = buildApprovedShell(projection, 'student', stateName);
      buildStudentAppView(view, projection);
      renderedProjection = projection;
      restoreFocus(focus);
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
      // A closed surface must not keep a timer alive that would fire a write into it.
      clearDebounce();
      exportNotice = null;
      facultyInvitationEmail = '';
      facultyDraftText = null;
      facultyFinalText = null;
      facultyApproved = false;
      facultySignatureAttested = false;
      aiProposal = null;
      aiEditedText = '';
      aiNotice = null;
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
      // The server-selected schema and role must agree. An unstated role retains the original
      // student default for the server-side adapter, while the browser adapter always supplies it.
      const kind = ctx.actorRole === 'faculty'
        ? 'faculty'
        : (ctx.actorRole === 'mentor' ? 'mentor' : 'student');
      if (
        ctx.actorRole !== undefined
        && ctx.actorRole !== 'student'
        && ctx.actorRole !== 'faculty'
        && ctx.actorRole !== 'mentor'
      ) {
        applyState('durable_runtime_unavailable');
        throw new TypeError('This renderer cannot present the authorized actor role');
      }
      if (prototypeIsRevealed(doc, win)) {
        applyState('durable_runtime_unavailable');
        throw new TypeError('The frozen prototype is not quarantined; production data will not be rendered');
      }
      let renderable;
      try {
        renderable = assertRenderableProjection(projection, kind);
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
      conflictPhase = null;
      conflictStepId = null;
      exportNotice = null;
      // A projection for a different case cannot inherit another case's unsaved wording.
      if (
        renderedProjection
        && (renderedProjection.caseId !== renderable.caseId || renderedKind !== kind)
      ) {
        draftEdits.clear();
        facultyInvitationEmail = '';
        facultyDraftText = null;
        facultyFinalText = null;
        facultyApproved = false;
        facultySignatureAttested = false;
        aiProposal = null;
        aiEditedText = '';
        aiNotice = null;
      }
      renderedKind = kind;
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
        renderable = assertRenderableProjection(acknowledged, renderedKind);
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
      // The step the student is working in is deliberately NOT reset here: jumping them to the
      // server's idea of the current step in the middle of an autosave would move the page under
      // their cursor. Which step is displayed is presentation; what is displayed is the server's.
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

    function showEmptyWorkspace(request) {
      pendingSaveBaselineRevision = null;
      pendingSaveStepId = null;
      clearDebounce();
      renderedProjection = null;
      renderedKind = 'student';
      selectedStepId = null;
      currentState = 'empty';
      emptyStartCase = isPlainObject(request) && typeof request.startCase === 'function'
        ? request.startCase
        : null;

      const host = resolveMount();
      clear(host);
      const view = buildApprovedShell(null, 'student', null);
      const active = ensureAppView('student');

      if (active === 'build') {
        buildApprovedStudentHome(view, null);
      } else if (active === 'library') {
        appendViewHeading(
          view,
          'Examples & Templates · evidence-first structures',
          'Study the structure,',
          'keep every claim honest.',
          'Reusable patterns for common recommendation situations. These are guidance structures, not case records or finished letters.',
        );
        view.appendChild(buildStudentGuidanceLibrary());
      } else {
        const emptyViewCopy = Object.freeze({
          depot: Object.freeze(['Writer Depot · protected faculty handoff', 'Prepare the evidence.', 'Invite the right writer.']),
          letters: Object.freeze(['My letters & tracking', 'Every stage,', 'one honest timeline.']),
          intel: Object.freeze(['Recommendation intelligence', 'Know what is grounded,', 'and what comes next.']),
          settings: Object.freeze(['Settings · privacy and access', 'Your choices stay', 'visible and reversible.']),
        });
        const copy = emptyViewCopy[active] || emptyViewCopy.build;
        appendViewHeading(
          view,
          copy[0],
          copy[1],
          copy[2],
          'Start one live recommendation case to connect this approved workspace to your durable MissionMed record.',
        );
        if (active === 'depot') {
          view.appendChild(panel('Your writer package starts in Build My LOR', [
            row('Relationship brief', 'Who the writer is and what they directly observed.'),
            row('Evidence portfolio', 'Only evidence you deliberately publish into the case.'),
            row('Protected invitation', 'A recipient-bound link and one-time verification code.'),
            row('Private faculty workspace', 'Assessment, draft, approval, and final wording stay faculty-private.'),
          ], [el('span', 'chip gn', 'Least privilege')]));
        } else if (active === 'letters') {
          view.appendChild(panel('Your recommendation portfolio', [
            row('No active letter yet', 'Start a case to create a live, durable tracking timeline.'),
            row('What will appear here', 'Writer, deadline, stage, delivery, release, and permitted export.'),
          ], [el('span', 'chip dashed', 'No case yet')]));
        } else if (active === 'intel') {
          view.appendChild(panel('Explainable recommendation intelligence', [
            row('Coverage', 'Builder completion and grounded evidence — no hidden score.'),
            row('Readiness', 'Consent, evidence, writer handoff, and delivery gates.'),
            row('Provenance', 'Student evidence, AI proposals, and faculty decisions remain visibly distinct.'),
          ], [el('span', 'chip cy', 'Evidence first')]));
        } else {
          view.appendChild(panel('LOR Studio preferences', [
            row('MissionMed Matrix', 'Return from the fixed control in the header.'),
            row('Consent and access', 'Visible and reversible after a recommendation case exists.'),
            row('Role separation', 'Student, mentor, and faculty views remain server-authorized.'),
          ], [el('span', 'chip gn', 'Privacy by design')]));
        }
        if (emptyStartCase) {
          const callout = el('div', 'lorBuildCallout lorCompactStart');
          callout.appendChild(el('div', 'h2', 'Ready to begin?'));
          const start = button('✦ Build My LOR', 'btn pri hero', () => {
            selectedBuildSurface = 'builder';
            void emptyStartCase();
          });
          start.id = 'lorStartCase';
          callout.appendChild(start);
          view.appendChild(callout);
        }
      }

      return Object.freeze({ rendered: true, surface: 'empty' });
    }

    const COMMAND_NAMES = Object.freeze([
      'autosaveBuilderStep',
      'completeBuilderStep',
      'recordReceipt',
      'publishStudentEvidence',
      'inviteFaculty',
      'resendFacultyOtp',
      'revokeFacultyInvitation',
      'saveFacultyPrivateContent',
      'requestAiProposal',
      'readAiProposal',
      'decideAiProposal',
      'releaseFinalDocument',
      'exportFinalDocument',
      'reloadCase',
    ]);

    /**
     * Hand the renderer its transport.
     *
     * Only the named commands are kept, and only if they are functions, so an object carrying
     * anything else - a token, a grant, a projection, a storage handle - contributes nothing. The
     * renderer still issues no requests itself; it decides what to ask for and what the answer
     * permits it to say. Every control this unlocks is additive: without commands the surface
     * renders precisely the read-only screen it rendered before, which is also what happens if a
     * caller attaches an empty object.
     *
     * @param {Record<string, unknown>} [request]
     */
    function attachCommands(request) {
      if (!isPlainObject(request)) {
        commands = null;
        clearDebounce();
        if (renderedProjection) renderCase(renderedProjection, null);
        return Object.freeze({ attached: Object.freeze([]) });
      }
      const next = {};
      const attached = [];
      for (const name of COMMAND_NAMES) {
        if (typeof request[name] === 'function') {
          next[name] = request[name];
          attached.push(name);
        }
      }
      commands = attached.length > 0 ? Object.freeze(next) : null;
      if (renderedProjection) renderCase(renderedProjection, null);
      return Object.freeze({ attached: Object.freeze(attached) });
    }

    const ui = {
      attachCommands,
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
        return Number.isSafeInteger(renderedProjection?.revision) ? renderedProjection.revision : null;
      },
      get saveInFlight() {
        return pendingSaveBaselineRevision !== null;
      },
      get renderedSurface() {
        return renderedProjection ? renderedKind : null;
      },
      /** True while a student has typed something the server has not confirmed. */
      get hasUnsavedEdits() {
        for (const edits of draftEdits.values()) {
          if (Object.keys(edits).length > 0) return true;
        }
        return false;
      },
      get conflictRecoveryPhase() {
        return conflictPhase;
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
