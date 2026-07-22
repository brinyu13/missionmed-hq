import { el, formatDateTime, list, object, text } from '../components/dom.js';
import { evidenceInspector, trustBadge, trustRow } from '../components/trust.js';
import { statePanel } from '../components/state-panel.js';
import { emptyInline, pageIntro, publicationBoundary, recordList, vessel, workspaceGrid } from './common.js';

export function renderSession(route, dataInput, meta = {}) {
  return route.params.mode === 'review'
    ? renderReview(route, dataInput, meta)
    : renderLive(route, dataInput, meta);
}

function renderLive(route, dataInput, meta) {
  const data = object(dataInput);
  const session = object(data.session || data);
  const subjectLink = object(data.studentContext?.subjectLink);
  const student = object(data.student || (subjectLink.id ? {
    id: subjectLink.id,
    displayName: subjectLink.displayName,
    assignment: data.studentContext?.assignment,
  } : null));
  if (!session.id) {
    return [
      pageIntro({ eyebrow: 'Pinned session', title: 'Live session', lead: 'A session must be authorized and pinned before capture.' }),
      statePanel('partial', {
        title: 'Pinned session unavailable',
        explanation: 'The live-session response did not include an authorized session identity.',
        impact: 'Capture is disabled to prevent attaching notes to an uncertain subject.',
        environment: meta.environment,
        asOf: meta.asOf,
      }),
    ];
  }
  const paused = String(session.status || '').toUpperCase() === 'PAUSED';
  const captures = list(data.captures || session.captures);
  const prior = list(data.priorCommitments || session.priorCommitments);
  const evidence = object(session.evidence);
  return [
    pageIntro({
      eyebrow: 'Session command',
      title: paused ? 'Session paused' : 'Live session',
      lead: 'The subject and assignment are pinned. Capture creates typed drafts; nothing publishes or approves AI.',
      actions: [
        el('button', {
          type: 'button',
          className: 'button button--quiet',
          dataset: { action: paused ? 'resume-session' : 'pause-session', targetId: session.id },
          text: paused ? 'Resume session' : 'Pause session',
        }),
        el('button', {
          type: 'button',
          className: 'button button--primary',
          dataset: { action: 'end-session-review', targetId: session.id },
          text: 'End capture and review',
        }),
      ],
    }),
    pinnedBanner(student, { ...session, saveState: data.saveState }, meta),
    workspaceGrid([
      vessel('Capture stage', [
        el('div', { className: 'session-objective' }, [
          el('p', { className: 'eyebrow eyebrow--gold', text: 'Call objective' }),
          el('h3', { text: text(data.objective || session.objective, 'No approved objective was returned') }),
          session.startedAt ? el('p', { text: `Started ${formatDateTime(session.startedAt)}` }) : null,
          trustRow(session.trustStates || [session.origin, session.freshness], evidence),
        ]),
        paused ? statePanel('partial', {
          title: 'Capture is paused',
          explanation: 'The pinned subject remains fixed; resume before adding another draft.',
          impact: 'Existing durable captures remain visible.',
        }) : captureForm(session),
        el('section', { className: 'capture-stream', 'aria-labelledby': 'capture-stream-title' }, [
          el('div', { className: 'section-heading' }, [
            el('h3', { id: 'capture-stream-title', text: 'Typed draft stream' }),
            el('span', { text: `${captures.length} ${captures.length === 1 ? 'capture' : 'captures'}` }),
          ]),
          captures.length ? el('ol', {}, captures.map(renderCapture)) : emptyInline('No typed capture has been durably acknowledged yet.'),
        ]),
      ], { className: 'live-session-vessel', testid: 'live-session' }),
    ], Object.keys(evidence).length ? evidenceInspector(evidence) : null, vessel('Reference', [
      el('details', {}, [
        el('summary', { text: `Prior commitments (${prior.length})` }),
        prior.length ? recordList(prior) : emptyInline('No prior commitment was returned.'),
      ]),
      el('p', { className: 'privacy-note', text: 'Student switching is unavailable while this session is active. Pause or enter review before navigating to another subject.' }),
    ], { className: 'support-vessel' })),
  ];
}

function renderReview(route, dataInput, meta) {
  const data = object(dataInput);
  const session = object(data.session || data);
  const subjectLink = object(data.studentContext?.subjectLink);
  const student = object(data.student || (subjectLink.id ? {
    id: subjectLink.id,
    displayName: subjectLink.displayName,
    assignment: data.studentContext?.assignment,
  } : null));
  const items = list(data.items || data.proposals || session.reviewItems);
  const band = text(data.complexityBand || session.complexityBand, items.length <= 3 ? 'Small manual review' : items.length <= 10 ? 'Bounded review' : 'Complex review');
  const evidence = object(items[0]?.evidence || session.evidence);
  if (!session.id) {
    return [
      pageIntro({ eyebrow: 'Human decision', title: 'Post-session review', lead: 'Review cannot proceed without a pinned authorized session.' }),
      statePanel('partial', {
        title: 'Review session unavailable',
        explanation: 'The response did not include an authorized session identity.',
        impact: 'No proposal or browser draft is committed.',
        environment: meta.environment,
        asOf: meta.asOf,
      }),
    ];
  }
  return [
    pageIntro({
      eyebrow: 'Human decision',
      title: 'Post-session review',
      lead: 'Decide each item independently. Commit operational objects now; publication remains a separate, disabled boundary.',
      actions: [],
    }),
    pinnedBanner(student, session, meta),
    el('section', { className: 'complexity-band', 'aria-label': 'Review complexity' }, [
      el('strong', { text: band }),
      el('span', { text: items.length <= 3 ? 'Target: thoughtful review in about 90 seconds.' : items.length <= 10 ? 'Target: thoughtful review in three to five minutes.' : 'Defer sections without speed penalty when evidence or sensitivity requires it.' }),
    ]),
    workspaceGrid([
      vessel('Object decisions', [
        el('div', { id: 'session-review-list', dataset: { testid: 'review-form', sessionId: session.id } }, [
          el('div', { id: 'review-form-status', className: 'form-status', role: 'status', 'aria-live': 'polite' }),
          items.length ? items.map((item, index) => reviewItem(item, index)) : statePanel('empty', {
            title: 'No review items',
            explanation: 'The authorized session review returned zero draft or proposal items.',
            impact: 'MMC does not create generic actions or auto-copy raw notes.',
          }),
        ]),
      ], { className: 'review-vessel', testid: 'review-workspace' }),
      publicationBoundary(),
    ], Object.keys(evidence).length ? evidenceInspector(evidence) : null),
  ];
}

function pinnedBanner(student, session, meta) {
  return el('section', { className: 'pinned-banner', 'aria-label': 'Pinned session subject' }, [
    el('div', {}, [
      el('span', { className: 'pinned-banner__mark', 'aria-hidden': 'true', text: '⌾' }),
      el('div', {}, [
        el('p', { className: 'eyebrow eyebrow--gold', text: 'Subject pinned' }),
        el('strong', { text: text(student.name || student.displayName, 'Student identity unavailable') }),
      ]),
    ]),
    el('div', { className: 'pinned-banner__facts' }, [
      el('span', { text: text(student.assignment?.label || session.assignmentLabel, 'Assignment unavailable') }),
      el('span', { text: text(meta.environment, 'Environment unconfirmed') }),
      trustBadge(session.saveState || meta.saveState || 'SAVED'),
    ]),
  ]);
}

function captureForm(session) {
  return el('form', { id: 'session-capture-form', className: 'capture-form', dataset: { testid: 'session-capture-form', sessionId: session.id } }, [
    el('div', { id: 'capture-form-status', className: 'form-status', role: 'status', 'aria-live': 'polite' }),
    el('div', { className: 'capture-form__fields' }, [
      el('div', {}, [
        el('label', { htmlFor: 'capture-type', text: 'Capture type' }),
        el('select', { id: 'capture-type', name: 'captureType', required: true }, [
          el('option', { value: '', text: 'Choose a type' }),
          el('option', { value: 'STUDENT_TASK', text: 'Student task' }),
          el('option', { value: 'MENTOR_TASK', text: 'Mentor task' }),
          el('option', { value: 'MUTUAL_COMMITMENT', text: 'Mutual commitment' }),
          el('option', { value: 'PRIVATE_MEMORY', text: 'Private mentor memory' }),
          el('option', { value: 'QUESTION', text: 'Question' }),
          el('option', { value: 'FLAG', text: 'Review flag' }),
          el('option', { value: 'PUBLICATION_CANDIDATE', text: 'Publication candidate (review only)' }),
        ]),
      ]),
      el('div', { className: 'capture-form__text' }, [
        el('label', { htmlFor: 'capture-text', text: 'Typed draft' }),
        el('textarea', { id: 'capture-text', name: 'text', rows: '3', maxlength: '4000', required: true }),
      ]),
    ]),
    el('label', { className: 'checkbox-row' }, [
      el('input', { type: 'checkbox', name: 'includeTimestamp', value: 'true' }),
      el('span', { text: 'Attach the current session timestamp' }),
    ]),
    el('div', { className: 'capture-form__footer' }, [
      el('p', { className: 'field-help', text: 'Unsent text stays only in memory and may be lost on close or reload.' }),
      el('button', { type: 'submit', className: 'button button--primary', text: 'Add typed draft' }),
    ]),
  ]);
}

function renderCapture(captureInput) {
  const capture = object(captureInput);
  return el('li', {}, [
    el('article', { className: 'capture-record' }, [
      el('div', {}, [
        el('p', { className: 'record-row__meta', text: text(capture.captureKind || capture.kind, 'Typed draft') }),
        el('p', { dir: 'auto', text: text(capture.text, 'Draft text unavailable') }),
        capture.occurredAt ? el('time', { datetime: capture.occurredAt, text: formatDateTime(capture.occurredAt) }) : null,
      ]),
      trustRow([capture.visibility, capture.reviewState, capture.publicationState], capture.evidence),
    ]),
  ]);
}

function reviewItem(itemInput, index) {
  const item = object(itemInput);
  const id = String(item.id || item.proposalId || `item-${index}`);
  const fieldId = `review-item-${index}`;
  const publication = String(item.queueKind || item.kind || '').toUpperCase().includes('PUBLICATION');
  const actionable = Boolean(item.policyVersionId) && !publication;
  return el('form', {
    className: `review-item${publication ? ' review-item--publication' : ''}`,
    dataset: {
      sessionReviewItem: 'true',
      reviewId: id,
      policyVersionId: item.policyVersionId || '',
      expectedVersion: item.version || 0,
    },
    novalidate: true,
  }, [
    el('div', { className: 'form-status', role: 'status', 'aria-live': 'polite' }),
    el('fieldset', { disabled: !actionable }, [
      el('legend', { text: `Item ${index + 1} · ${text(item.kind, 'Proposal')}` }),
      publication ? el('p', { className: 'boundary-inline', text: 'Publication review is disabled until authorized MegaRun 008.' }) : null,
      !item.policyVersionId && !publication ? el('p', { className: 'boundary-inline', text: 'This item has no policy version and cannot be decided safely.' }) : null,
      el('blockquote', { dir: 'auto', text: text(item.editedText || item.label || item.text || item.title, 'Proposal text unavailable') }),
      trustRow(item.trustStates || [item.origin, item.reviewState, item.sensitivity], item.evidence),
      el('div', { className: 'review-item__facts' }, [
        el('span', { text: `Owner: ${text(item.ownerType || item.owner, 'Not assigned')}` }),
        el('span', { text: item.dueAt ? `Due: ${formatDateTime(item.dueAt)}` : 'Due date: not set' }),
        el('span', { text: `Review state: ${text(item.reviewState || item.state)}` }),
      ]),
      el('div', { className: 'review-item__fields review-item__fields--decision' }, [
        el('div', {}, [
          el('label', { htmlFor: `${fieldId}-decision`, text: 'Decision' }),
          el('select', { id: `${fieldId}-decision`, name: 'decision', required: true }, [
            el('option', { value: '', text: 'Choose one' }),
            el('option', { value: 'ACCEPT', text: 'Approve' }),
            el('option', { value: 'REJECT', text: 'Reject' }),
            el('option', { value: 'DEFER', text: 'Defer' }),
            el('option', { value: 'REQUEST_EVIDENCE', text: 'Needs evidence' }),
          ]),
        ]),
      ]),
      el('label', { htmlFor: `${fieldId}-text`, text: 'Edit proposed text (optional)' }),
      el('textarea', { id: `${fieldId}-text`, name: 'editedText', rows: '3', maxlength: '8000', value: item.editedText || '' }),
      el('label', { htmlFor: `${fieldId}-rationale`, text: 'Decision reason' }),
      el('textarea', { id: `${fieldId}-rationale`, name: 'rationale', rows: '2', maxlength: '2000', required: true }),
      el('button', { type: 'submit', className: 'button button--primary', text: 'Commit this decision' }),
    ]),
  ]);
}
