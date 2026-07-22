import { el, formatDateTime, labelledValue, list, object, safeInternalHref, text } from '../components/dom.js';
import { trustRow } from '../components/trust.js';

export function pageIntro({ eyebrow, title, lead, actions = [], testid = null }) {
  return el('header', { className: 'page-intro', dataset: testid ? { testid } : undefined }, [
    el('div', { className: 'page-intro__copy' }, [
      eyebrow ? el('p', { className: 'eyebrow', text: eyebrow }) : null,
      el('h1', { id: 'route-heading', tabIndex: '-1', dataset: { testid: 'route-heading' }, text: title }),
      lead ? el('p', { className: 'page-intro__lead', text: lead }) : null,
    ]),
    actions.length ? el('div', { className: 'page-intro__actions' }, actions) : null,
  ]);
}

export function workspaceGrid(primary, inspector = null, supporting = null) {
  return el('div', { className: `workspace-grid${inspector ? ' workspace-grid--inspector' : ''}` }, [
    el('div', { className: 'workspace-grid__primary' }, primary),
    supporting ? el('div', { className: 'workspace-grid__supporting' }, supporting) : null,
    inspector,
  ]);
}

export function vessel(title, children = [], options = {}) {
  const titleId = `vessel-${slug(options.id || title)}`;
  return el(options.tag || 'section', {
    id: options.id || undefined,
    className: `vessel ${options.className || ''}`.trim(),
    'aria-labelledby': titleId,
    dataset: options.testid ? { testid: options.testid } : undefined,
  }, [
    options.eyebrow ? el('p', { className: `eyebrow ${options.eyebrowTone || ''}`.trim(), text: options.eyebrow }) : null,
    el('h2', { id: titleId, text: title }),
    options.lead ? el('p', { className: 'vessel__lead', text: options.lead }) : null,
    children,
  ]);
}

export function studentContext(studentInput, meta = {}) {
  const student = object(studentInput);
  const assignment = object(student.assignment);
  return el('section', {
    className: 'student-context',
    'aria-label': 'Pinned student and assignment context',
  }, [
    el('div', {}, [
      el('p', { className: 'eyebrow eyebrow--gold', text: 'Verified subject workspace' }),
      el('h2', { text: text(student.name || student.displayName, 'Student identity unavailable') }),
    ]),
    el('div', { className: 'student-context__facts' }, [
      labelledValue('Program', student.program || assignment.program),
      labelledValue('Assignment', assignment.label || assignment.state || student.assignmentState),
      labelledValue('Freshness', student.freshness || meta.freshness),
    ]),
    trustRow(student.trustStates || [student.origin, student.freshness], student.evidence),
  ]);
}

export function studentTabs(studentId, current) {
  const id = encodeURIComponent(studentId);
  const tabs = [
    ['overview', 'Overview'],
    ['plan', 'Plan'],
    ['history', 'History'],
    ['files', 'Files'],
  ];
  return el('nav', { className: 'student-tabs', 'aria-label': 'Student workspace' }, tabs.map(([key, label]) => el('a', {
    href: `/mmc-private/students/${id}/${key}`,
    'aria-current': current === key ? 'page' : undefined,
    text: label,
  })));
}

export function continuityThread(nodesInput) {
  const nodes = list(nodesInput);
  if (!nodes.length) return null;
  return vessel('Continuity thread', [
    el('ol', { className: 'continuity-thread', dataset: { testid: 'continuity-thread' } }, nodes.map((nodeInput, index) => {
      const node = object(nodeInput);
      const href = safeInternalHref(node.href);
      return el('li', { className: 'continuity-node' }, [
        el('span', { className: 'continuity-node__index', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') }),
        el('div', {}, [
          el('p', { className: 'continuity-node__kind', text: text(node.kind || node.state, 'Continuity event') }),
          href
            ? el('a', { href, className: 'continuity-node__title', text: text(node.title || node.label) })
            : el('strong', { className: 'continuity-node__title', text: text(node.title || node.label) }),
          node.detail ? el('p', { text: node.detail }) : null,
          node.at ? el('time', { datetime: node.at, text: formatDateTime(node.at) }) : null,
          trustRow(node.trustStates || [node.origin, node.freshness], node.evidence),
        ]),
      ]);
    })),
  ], { className: 'continuity-vessel', eyebrow: 'From promise to checkpoint', eyebrowTone: 'eyebrow--cyan' });
}

export function recordList(recordsInput, options = {}) {
  const records = list(recordsInput);
  return el('ul', { className: `record-list ${options.className || ''}`.trim() }, records.map((recordInput) => {
    const record = object(recordInput);
    const href = safeInternalHref(record.href);
    return el('li', { className: 'record-row' }, [
      el('div', { className: 'record-row__copy' }, [
        el('p', { className: 'record-row__meta', text: text(record.kind || record.captureKind || record.ownerType || record.owner || record.status || record.state || record.objectKind, options.metaFallback || 'Record') }),
        href
          ? el('a', { className: 'record-row__title', href, text: text(record.title || record.label || record.name || record.objective || record.text || record.sourceLabel) })
          : el('strong', { className: 'record-row__title', text: text(record.title || record.label || record.name || record.objective || record.text || record.sourceLabel) }),
        record.detail || record.details || record.description ? el('p', { text: record.detail || record.details || record.description }) : null,
        record.dueAt || record.at || record.changedAt || record.occurredAt || record.startedAt || record.targetDate ? el('time', {
          datetime: record.dueAt || record.at || record.changedAt || record.occurredAt || record.startedAt || record.targetDate,
          text: `${record.dueAt || record.targetDate ? 'Due' : 'Recorded'} ${formatDateTime(record.dueAt || record.at || record.changedAt || record.occurredAt || record.startedAt || record.targetDate, { dateOnly: Boolean(record.targetDate && !record.dueAt) })}`,
        }) : null,
      ]),
      trustRow(record.trustStates || [record.origin, record.freshness, record.visibility], record.evidence),
    ]);
  }));
}

export function metric(label, value, detail = null) {
  return el('div', { className: 'metric' }, [
    el('span', { className: 'metric__label', text: label }),
    el('strong', { className: 'metric__value', text: text(value) }),
    detail ? el('span', { className: 'metric__detail', text: detail }) : null,
  ]);
}

export function publicationBoundary() {
  return el('section', { className: 'publication-boundary', 'aria-labelledby': 'publication-boundary-title' }, [
    el('p', { className: 'eyebrow eyebrow--violet', text: 'Separate authorization boundary' }),
    el('h2', { id: 'publication-boundary-title', text: 'Student publication is disabled' }),
    el('p', { text: 'Mentor work cannot publish or preview student-facing content in MegaRun 007. Exact-student authentication, projection, preview, correction, and withdrawal arrive only through authorized MegaRun 008.' }),
    el('button', { type: 'button', className: 'button button--quiet', disabled: true, text: 'Student preview unavailable' }),
  ]);
}

export function emptyInline(message) {
  return el('p', { className: 'empty-inline', text: message });
}

export function displayName(studentInput) {
  const student = object(studentInput);
  return text(student.name || student.displayName, 'Student identity unavailable');
}

function slug(value) {
  return String(value).toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || crypto.randomUUID();
}
