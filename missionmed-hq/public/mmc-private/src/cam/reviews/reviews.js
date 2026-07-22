import { el, formatDateTime, list, object, text } from '../components/dom.js';
import { evidenceInspector, trustRow } from '../components/trust.js';
import { statePanel } from '../components/state-panel.js';
import { pageIntro, publicationBoundary, vessel, workspaceGrid } from '../mentor/common.js';

export function renderReviews(route, dataInput, meta = {}) {
  const data = object(dataInput);
  const items = list(data.items || data.reviews);
  const selected = selectReview(items, route.params.reviewId, data.selected);
  const selectedEvidence = object(selected.evidence);
  return [
    pageIntro({
      eyebrow: 'Human decision inbox',
      title: 'Reviews',
      lead: 'Resolve one AI claim, identity conflict, publication boundary, or selected media exception at a time.',
    }),
    workspaceGrid([
      vessel('Decision queue', [
        reviewFilters(route, data),
        items.length ? el('ol', { className: 'review-queue' }, items.slice(0, 100).map((item) => queueItem(item, route))) : statePanel('empty', {
          title: 'No items match this review queue',
          explanation: 'The current authorized queue returned zero review decisions.',
          impact: 'This does not imply that upstream workers, providers, or sources are healthy.',
          environment: meta.environment,
          asOf: meta.asOf,
        }),
      ], { className: 'review-queue-vessel' }),
      selected.id ? decisionWorkspace(selected) : statePanel('empty', {
        title: 'Choose one review decision',
        explanation: items.length ? 'Open an item from the queue to see exact evidence and available decisions.' : 'There is no authorized item to select.',
        impact: 'MMC never bulk-approves consequential, sensitive, identity, or publication decisions.',
      }),
      String(selected.kind || '').toUpperCase().includes('PUBLICATION') ? publicationBoundary() : null,
    ], Object.keys(selectedEvidence).length ? evidenceInspector(selectedEvidence) : null),
  ];
}

function reviewFilters(route, data) {
  const currentQueue = normalizeQueue(route.params.queueKind);
  const queues = [
    { id: 'ai_claim', label: 'AI claims' },
    { id: 'identity', label: 'Identity' },
    { id: 'publication', label: 'Publication' },
    { id: 'media_exception', label: 'Media exceptions' },
  ];
  return el('nav', { className: 'queue-tabs', 'aria-label': 'Review queues' }, [
    el('a', { href: '/mmc-private/reviews', 'aria-current': !route.params.queueKind ? 'page' : undefined, text: 'All' }),
    ...queues.map((queue) => el('a', {
      href: `/mmc-private/reviews/${encodeURIComponent(queue.id)}`,
      'aria-current': currentQueue === normalizeQueue(queue.id) ? 'page' : undefined,
      text: text(queue.label),
    })),
  ]);
}

function queueItem(itemInput, route) {
  const item = object(itemInput);
  const student = object(item.student);
  const queue = normalizeQueue(item.queueKind || route.params.queueKind || 'all');
  const href = item.id ? `/mmc-private/reviews/${encodeURIComponent(queue)}/${encodeURIComponent(item.id)}` : null;
  const current = route.params.reviewId && String(item.id) === route.params.reviewId;
  return el('li', {}, [
    el('article', { className: `review-queue-item${current ? ' review-queue-item--current' : ''}` }, [
      el('div', {}, [
        el('p', { className: 'record-row__meta', text: text(item.kind, 'Review') }),
        href ? el('a', { href, 'aria-current': current ? 'true' : undefined, text: text(item.title || item.label) }) : el('strong', { text: text(item.title || item.label) }),
        el('p', { text: `${text(student.displayName, 'Student binding available by opaque ID')} · Owner: ${text(item.ownerType, 'Not assigned')} · State: ${text(item.state)}` }),
        item.firstObservedAt ? el('time', { datetime: item.firstObservedAt, text: `Waiting since ${formatDateTime(item.firstObservedAt)}` }) : null,
      ]),
      trustRow(item.trustStates || [item.origin, item.reviewState, item.sensitivity], item.evidence),
    ]),
  ]);
}

function decisionWorkspace(item) {
  const publication = String(item.queueKind || item.kind || '').toUpperCase().includes('PUBLICATION');
  const actionable = Boolean(item.policyVersionId) && !publication;
  const fieldset = el('fieldset', { disabled: !actionable }, [
    el('legend', { text: publication ? 'Publication decision unavailable' : actionable ? 'Decision' : 'Decision unavailable' }),
    el('label', { htmlFor: 'review-decision', text: 'Decision' }),
    el('select', { id: 'review-decision', name: 'decision', required: true }, [
      el('option', { value: '', text: 'Choose one' }),
      el('option', { value: 'ACCEPT', text: 'Approve' }),
      el('option', { value: 'REJECT', text: 'Reject' }),
      el('option', { value: 'DEFER', text: 'Defer' }),
      el('option', { value: 'REQUEST_EVIDENCE', text: 'Needs evidence' }),
    ]),
    el('label', { htmlFor: 'review-edited-text', text: 'Edited text (optional)' }),
    el('textarea', { id: 'review-edited-text', name: 'editedText', rows: '5', maxlength: '8000', value: item.text || '' }),
    el('label', { htmlFor: 'review-rationale', text: 'Decision reason' }),
    el('textarea', { id: 'review-rationale', name: 'rationale', rows: '3', maxlength: '2000', required: true }),
    el('button', { type: 'submit', className: 'button button--primary', text: 'Commit this decision' }),
  ]);
  return vessel(text(item.title || item.label, 'Review decision'), [
    el('p', { className: 'decision-reason', text: text(item.label, 'Decision context unavailable') }),
    item.editedText ? el('blockquote', { dir: 'auto', text: item.editedText }) : null,
    trustRow(item.trustStates || [item.origin, item.reviewState, item.sensitivity], item.evidence),
    el('form', {
      id: 'review-decision-form',
      className: 'decision-form',
      dataset: {
        testid: 'reviews-workspace',
        reviewId: item.id,
        policyVersionId: item.policyVersionId || '',
        expectedVersion: item.version || 0,
      },
      novalidate: true,
    }, [
      el('div', { id: 'review-decision-status', className: 'form-status', role: 'status', 'aria-live': 'polite' }),
      publication ? el('p', { className: 'boundary-inline', text: 'Student publication review and preview remain disabled until authorized MegaRun 008.' }) : null,
      !publication && !item.policyVersionId ? el('p', { className: 'boundary-inline', text: 'This item has no policy version and cannot be decided safely.' }) : null,
      fieldset,
    ]),
  ], { className: 'decision-vessel', eyebrow: 'One consequential decision' });
}

function selectReview(items, id, selectedInput) {
  const selected = object(selectedInput);
  if (selected.id) return selected;
  if (id) return object(items.find((item) => String(item?.id) === id));
  return object(items[0]);
}

function normalizeQueue(value) {
  return String(value || '').trim().toLocaleLowerCase();
}
