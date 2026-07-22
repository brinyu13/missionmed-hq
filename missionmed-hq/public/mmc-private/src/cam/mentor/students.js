import { el, list, object, text } from '../components/dom.js';
import { trustRow } from '../components/trust.js';
import { statePanel } from '../components/state-panel.js';
import { pageIntro, vessel } from './common.js';

export function renderStudents(dataInput, meta = {}) {
  const data = object(dataInput);
  const students = list(data.students || data.items);
  return [
    pageIntro({
      eyebrow: 'Verified assignments',
      title: 'Students',
      lead: 'Open one route-owned student workspace. Filters organize authorized records; they never grant access.',
      actions: [
        el('button', { type: 'button', className: 'button button--quiet', dataset: { action: 'open-quick-capture' }, text: 'Quick capture' }),
      ],
    }),
    vessel('Student directory', [
      el('form', { className: 'directory-search', role: 'search', dataset: { action: 'student-search-form' } }, [
        el('label', { htmlFor: 'student-search', text: 'Search this authorized directory' }),
        el('div', { className: 'search-row' }, [
          el('input', { id: 'student-search', type: 'search', autocomplete: 'off', placeholder: 'Name, program, or assignment' }),
          el('button', { type: 'button', className: 'button button--quiet', dataset: { action: 'clear-student-search' }, text: 'Clear' }),
        ]),
        el('p', { id: 'student-search-status', className: 'field-help', role: 'status', 'aria-live': 'polite', text: `${students.length} authorized ${students.length === 1 ? 'student' : 'students'}` }),
      ]),
      students.length ? directoryTable(students) : statePanel('empty', {
        title: 'No authorized student assignments',
        explanation: 'The current mentor directory query returned zero active, visible assignments.',
        impact: 'MMC does not manufacture a fixture roster or reveal inaccessible student identities.',
        environment: meta.environment,
        asOf: meta.asOf,
      }),
      el('div', { id: 'student-filter-empty', hidden: true }, statePanel('filtered', {
        actionLabel: 'Clear filters',
        action: 'clear-student-search',
      })),
    ], { testid: 'student-directory', className: 'directory-vessel', eyebrow: 'Route-owned selection' }),
  ];
}

function directoryTable(students) {
  return el('div', { className: 'directory-table-wrap' }, [
    el('table', { className: 'directory-table' }, [
      el('caption', { className: 'visually-hidden', text: 'Authorized student assignments' }),
      el('thead', {}, [
        el('tr', {}, [
          el('th', { scope: 'col', text: 'Student' }),
          el('th', { scope: 'col', text: 'Program' }),
          el('th', { scope: 'col', text: 'Assignment' }),
          el('th', { scope: 'col', text: 'Next checkpoint' }),
          el('th', { scope: 'col', text: 'Trust state' }),
          el('th', { scope: 'col', text: 'Workspace' }),
        ]),
      ]),
      el('tbody', {}, students.map((studentInput) => {
        const student = object(studentInput);
        const href = student.subjectLinkId ? `/mmc-private/students/${encodeURIComponent(student.subjectLinkId)}/overview` : null;
        return el('tr', { className: 'directory-row' }, [
          el('th', { scope: 'row', dataset: { label: 'Student' }, text: text(student.name || student.displayName, 'Identity unavailable') }),
          el('td', { dataset: { label: 'Program' }, text: text([student.program, student.cohort].filter(Boolean).join(' · ')) }),
          el('td', { dataset: { label: 'Assignment' }, text: text(student.assignmentState) }),
          el('td', { dataset: { label: 'Next checkpoint' }, text: text(student.nextAction) }),
          el('td', { dataset: { label: 'Trust state' } }, trustRow(student.trustStates || [student.origin, student.freshness], student.evidence)),
          el('td', { dataset: { label: 'Workspace' } }, href
            ? el('a', { className: 'button button--quiet', href, text: 'Open workspace' })
            : el('span', { text: 'Unavailable' })),
        ]);
      })),
    ]),
  ]);
}
