import { el, formatDateTime, list, object, text } from './dom.js';

const TRUST_LABELS = Object.freeze({
  SOURCE_OBSERVED: ['cyan', '◉', 'Source observed'],
  SYSTEM_DERIVED: ['cyan', '◇', 'System derived'],
  AI_PROPOSAL: ['violet', '✦', 'AI proposal'],
  MENTOR_APPROVED: ['gold', '◆', 'Mentor approved'],
  CURRENT: ['neutral', '●', 'Current'],
  STALE: ['warning', '◷', 'Stale'],
  EXPIRED: ['danger', '⊘', 'Expired'],
  MENTOR_ONLY: ['gold', '⌾', 'Mentor only'],
  SENSITIVE: ['danger', '!', 'Sensitive'],
  PUBLICATION_CANDIDATE: ['violet', '◈', 'Publication candidate'],
  PUBLISHED: ['success', '✓', 'Published'],
  WITHDRAWN: ['danger', '—', 'Withdrawn'],
  UNSAVED: ['warning', '○', 'Unsaved'],
  SAVING: ['cyan', '◌', 'Saving'],
  SAVED: ['success', '✓', 'Saved'],
  OFFLINE_NOT_SAVED: ['danger', '↯', 'Offline · not saved'],
  CONFLICT: ['danger', '⇄', 'Conflict'],
  FAILED: ['danger', '!', 'Failed'],
});

export function trustBadge(value, options = {}) {
  const key = normalize(value);
  const [tone, symbol, label] = TRUST_LABELS[key] || ['neutral', '•', titleCase(value || 'State unavailable')];
  return el(options.button ? 'button' : 'span', {
    type: options.button ? 'button' : undefined,
    className: `trust-badge trust-badge--${tone}`,
    dataset: options.evidenceId ? { action: 'open-evidence', evidenceId: options.evidenceId } : undefined,
    'aria-label': options.button ? `${label}; inspect evidence` : undefined,
  }, [
    el('span', { 'aria-hidden': 'true', text: symbol }),
    el('span', { text: label }),
  ]);
}

export function trustRow(states = [], evidence = null) {
  return el('div', { className: 'trust-row', 'aria-label': 'Trust and visibility state' }, [
    ...list(states).filter(Boolean).slice(0, 4).map((state, index) => trustBadge(state, {
      button: Boolean(evidence) && index === 0,
      evidenceId: evidence ? evidence.id || 'current' : null,
    })),
    evidence && !states.length ? trustBadge(evidence.origin || 'SOURCE_OBSERVED', {
      button: true,
      evidenceId: evidence.id || 'current',
    }) : null,
  ]);
}

export function evidenceInspector(evidenceInput = null) {
  const evidence = object(evidenceInput);
  return el('aside', {
    id: 'evidence-inspector',
    className: 'evidence-inspector',
    'aria-labelledby': 'evidence-title',
    hidden: !Object.keys(evidence).length,
    dataset: { testid: 'evidence-inspector' },
  }, [
    el('div', { className: 'inspector-header' }, [
      el('div', {}, [
        el('p', { className: 'eyebrow eyebrow--cyan', text: 'Trust inspector' }),
        el('h2', { id: 'evidence-title', tabIndex: '-1', text: 'Evidence and provenance' }),
      ]),
      el('button', {
        type: 'button',
        className: 'icon-button inspector-close',
        dataset: { action: 'close-evidence' },
        'aria-label': 'Close evidence inspector',
        text: '×',
      }),
    ]),
    el('div', { id: 'evidence-content', className: 'inspector-content' }, renderEvidence(evidence)),
  ]);
}

export function renderEvidence(evidenceInput) {
  const evidence = object(evidenceInput);
  if (!Object.keys(evidence).length) {
    return [el('p', { text: 'No evidence detail was returned for this item.' })];
  }
  const facts = [
    ['Origin', evidence.origin],
    ['Source', evidence.source || evidence.sourceName],
    ['Observed', evidence.observedAt || evidence.asOf ? formatDateTime(evidence.observedAt || evidence.asOf) : null],
    ['Freshness', evidence.freshness],
    ['Review state', evidence.reviewState],
    ['Reviewer', evidence.reviewer],
    ['Confidence basis', evidence.confidenceBasis],
    ['Model / prompt', evidence.model || evidence.promptVersion],
    ['Run', evidence.runId],
    ['Correction', evidence.correctionState],
    ['Publication', evidence.publicationState],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  return [
    evidence.label || evidence.title ? el('p', { className: 'inspector-lead', text: text(evidence.label || evidence.title) }) : null,
    evidence.excerpt || evidence.span ? el('blockquote', { text: text(evidence.excerpt || evidence.span) }) : null,
    facts.length ? el('dl', { className: 'evidence-facts' }, facts.map(([label, value]) => [
      el('dt', { text: label }),
      el('dd', { text: value }),
    ])) : null,
    evidence.pointer ? el('p', { className: 'evidence-pointer', text: `Pointer: ${text(evidence.pointer)}` }) : null,
  ];
}

export function updateEvidenceInspector(inspector, evidenceInput) {
  if (!inspector) return;
  const evidence = object(evidenceInput);
  const content = inspector.querySelector('#evidence-content');
  content?.replaceChildren(...renderEvidence(evidence).filter(Boolean));
  inspector.hidden = false;
  inspector.dataset.open = 'true';
}

function normalize(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s/-]+/gu, '_');
}

function titleCase(value) {
  return text(value).replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase());
}
