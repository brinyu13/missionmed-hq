import { el, formatDateTime, list, object, text } from '../components/dom.js';
import { trustRow } from '../components/trust.js';
import { statePanel } from '../components/state-panel.js';
import { pageIntro, vessel } from './common.js';

export function renderWork(dataInput, meta = {}) {
  const data = object(dataInput);
  const items = list(data.items || data.work);
  const visible = items.slice(0, 100);
  return [
    pageIntro({
      eyebrow: 'Cross-student responsibility',
      title: 'Work',
      lead: 'Follow mentor promises, student tasks awaiting help, decisions, and aged open loops by owner and consequence.',
      actions: [el('button', { type: 'button', className: 'button button--primary', dataset: { action: 'open-quick-capture' }, text: 'Capture follow-up' })],
    }),
    vessel('Responsibility queue', [
      filterBar(),
      items.length ? el('ol', { className: 'work-queue', dataset: { testid: 'work-queue' } }, visible.map(renderWorkItem)) : statePanel('empty', {
        title: 'No work items in this authorized query',
        explanation: 'The current source returned zero mentor tasks, student follow-ups, promises, decisions, or open loops.',
        impact: 'This does not imply that every source is complete or every obligation is closed.',
        environment: meta.environment,
        asOf: meta.asOf,
      }),
      el('div', { id: 'work-filter-empty', hidden: true }, statePanel('filtered', { actionLabel: 'Clear filters', action: 'clear-work-filters' })),
      items.length > visible.length ? el('p', { className: 'pagination-note', text: `Showing the first ${visible.length} of ${items.length} authorized records. Use server filters or the next cursor for the remaining work.` }) : null,
    ], { className: 'work-vessel', eyebrow: 'Owned and due' }),
  ];
}

function filterBar() {
  return el('form', { className: 'filter-bar', dataset: { action: 'work-filter-form' } }, [
    el('div', {}, [
      el('label', { htmlFor: 'work-owner', text: 'Owner' }),
      el('select', { id: 'work-owner', name: 'owner' }, [
        el('option', { value: '', text: 'All owners' }),
        el('option', { value: 'MENTOR', text: 'Mentor' }),
        el('option', { value: 'STUDENT', text: 'Student' }),
        el('option', { value: 'SHARED', text: 'Shared' }),
      ]),
    ]),
    el('div', {}, [
      el('label', { htmlFor: 'work-due', text: 'Due window' }),
      el('select', { id: 'work-due', name: 'dueWindow' }, [
        el('option', { value: '', text: 'Any due window' }),
        el('option', { value: 'OVERDUE', text: 'Overdue' }),
        el('option', { value: 'TODAY', text: 'Today' }),
        el('option', { value: 'WEEK', text: 'Next seven days' }),
        el('option', { value: 'UNDATED', text: 'No date' }),
      ]),
    ]),
    el('div', {}, [
      el('label', { htmlFor: 'work-search', text: 'Search this queue' }),
      el('input', { id: 'work-search', type: 'search', name: 'q', autocomplete: 'off' }),
    ]),
    el('button', { type: 'button', className: 'button button--quiet', dataset: { action: 'clear-work-filters' }, text: 'Clear' }),
    el('p', { id: 'work-filter-status', className: 'field-help', role: 'status', 'aria-live': 'polite' }),
  ]);
}

function renderWorkItem(itemInput) {
  const item = object(itemInput);
  const student = object(item.student);
  const status = String(item.status || '').toUpperCase();
  const canComplete = Boolean(item.id) && !['COMPLETED', 'CANCELLED'].includes(status) && item.canComplete !== false;
  return el('li', { className: 'work-item', dataset: { owner: item.ownerType || item.owner || '', dueWindow: item.dueWindow || '', objectId: item.id || '' } }, [
    el('article', {}, [
      el('div', { className: 'work-item__body' }, [
        el('p', { className: 'record-row__meta', text: `${text(item.kind, 'Work item')} · ${text(item.ownerType || item.owner, 'Owner unavailable')}` }),
        el('h3', { text: text(item.title || item.label) }),
        el('p', { text: text(student.displayName || student.name || item.studentName, 'Student context unavailable') }),
        item.details ? el('p', { text: item.details }) : null,
        el('div', { className: 'work-item__meta' }, [
          item.dueAt ? el('time', { datetime: item.dueAt, text: `Due ${formatDateTime(item.dueAt)}` }) : el('span', { text: 'No due date' }),
          el('span', { text: `State: ${text(item.status)}` }),
          item.blocker ? el('span', { text: `Blocked by: ${text(item.blocker)}` }) : null,
        ]),
        trustRow(item.trustStates || [item.origin, item.freshness, item.sensitivity], item.evidence),
      ]),
      el('div', { className: 'work-item__actions' }, [
        student.subjectLinkId ? el('a', { className: 'button button--quiet', href: `/mmc-private/students/${encodeURIComponent(student.subjectLinkId)}/plan`, text: 'Open plan' }) : null,
        canComplete ? el('button', { type: 'button', className: 'button button--primary', dataset: { action: 'complete-work-item', objectId: item.id }, text: 'Mark complete' }) : null,
      ]),
    ]),
  ]);
}
