import { el, formatDateTime, list, object, safeInternalHref, text } from '../components/dom.js';
import { evidenceInspector, trustRow } from '../components/trust.js';
import { statePanel } from '../components/state-panel.js';
import { continuityThread, emptyInline, pageIntro, recordList, vessel, workspaceGrid } from './common.js';

export function renderToday(dataInput, meta = {}) {
  const data = object(dataInput);
  const attention = list(data.attention || data.attentionItems);
  const initial = attention.slice(0, 3);
  const more = attention.slice(3, 7);
  const firstEvidence = object(initial[0]?.evidence);
  const nextCalls = data.upcomingCall ? [data.upcomingCall] : [];

  const attentionVessel = vessel('Who needs you', [
    attention.length
      ? el('ol', { className: 'attention-list', dataset: { testid: 'attention-list' } }, initial.map(renderAttention))
      : statePanel('empty', {
        title: 'No verified condition needs action now',
        explanation: `The authorized attention query returned zero conditions${meta.asOf ? ` as of ${formatDateTime(meta.asOf)}` : ''}.`,
        impact: 'This does not claim that every student is safe or that every source is current.',
        secondaryLabel: 'Review upcoming calls',
        secondaryHref: '#upcoming-calls',
      }),
    more.length ? el('details', { className: 'attention-more' }, [
      el('summary', { text: `${more.length} more verified conditions` }),
      el('ol', { start: '4', className: 'attention-list attention-list--more' }, more.map(renderAttention)),
    ]) : null,
  ], {
    className: 'attention-vessel',
    eyebrow: 'Ranked by objective consequence',
    lead: 'Priority is a transparent ordering of conditions, never a score on a person.',
    testid: 'today-vessel',
  });

  const upcoming = vessel('Upcoming calls', [
    nextCalls.length ? recordList(nextCalls) : emptyInline('No upcoming call record was returned for this query.'),
  ], { id: 'upcoming-calls', className: 'support-vessel' });

  return [
    pageIntro({
      eyebrow: 'Mentor command',
      title: 'Today',
      lead: 'See who needs attention, why now, and the next safe move—in one minute.',
      actions: [
        el('button', { type: 'button', className: 'button button--primary', dataset: { action: 'act-top-attention' }, disabled: !attention.length, text: 'Act on top item' }),
      ],
    }),
    data.resume ? resumeBanner(data.resume) : null,
    workspaceGrid([attentionVessel, continuityThread(data.continuity)], firstEvidence.id || Object.keys(firstEvidence).length ? evidenceInspector(firstEvidence) : null, upcoming),
  ];
}

function renderAttention(itemInput, index) {
  const item = object(itemInput);
  const nextAction = typeof item.nextAction === 'string' ? item.nextAction : object(item.nextAction).label;
  const href = item.subjectLinkId
    ? `/mmc-private/students/${encodeURIComponent(item.subjectLinkId)}/overview`
    : safeInternalHref(object(item.nextAction).href || item.href);
  return el('li', { className: `attention-item${index === 0 ? ' attention-item--top' : ''}` }, [
    el('article', {}, [
      el('div', { className: 'attention-item__rank', 'aria-label': `Priority ${index + 1}`, text: String(index + 1).padStart(2, '0') }),
      el('div', { className: 'attention-item__body' }, [
        el('p', { className: 'attention-item__category', text: text(item.category, 'Actionable condition') }),
        el('h3', { text: text(item.studentName, 'Student identity unavailable') }),
        el('p', { className: 'attention-item__reason', text: text(item.reason, 'Reason unavailable') }),
        el('div', { className: 'attention-item__meta' }, [
          item.dueAt ? el('time', { datetime: item.dueAt, text: `Due ${formatDateTime(item.dueAt)}` }) : el('span', { text: 'No objective due time returned' }),
          Number.isSafeInteger(item.ageDays) ? el('span', { text: `Observed ${item.ageDays} ${item.ageDays === 1 ? 'day' : 'days'} ago` }) : null,
        ]),
        trustRow(item.trustStates || [item.evidence?.origin, item.evidence?.freshness, item.evidence?.reviewState],
          item.evidence ? { ...item.evidence, id: item.id } : null),
      ]),
      el('div', { className: 'attention-item__action' }, [
        href ? el('a', {
          href,
          className: index === 0 ? 'button button--primary' : 'button button--quiet',
          text: text(nextAction, 'Open student workspace'),
        }) : el('button', {
          type: 'button',
          className: 'button button--quiet',
          dataset: { action: 'open-attention', objectId: item.id || '' },
          disabled: !item.id,
          text: text(nextAction, 'Inspect condition'),
        }),
        item.id && item.version && item.sourceVersion ? el('div', { className: 'attention-item__disposition' }, [
          el('button', {
            type: 'button',
            className: 'button button--quiet',
            dataset: {
              action: 'open-attention-decision',
              decisionKind: 'attention.defer',
              objectId: item.id,
              expectedVersion: item.version,
              sourceVersion: item.sourceVersion,
            },
            text: 'Defer',
          }),
          el('button', {
            type: 'button',
            className: 'button button--quiet',
            dataset: {
              action: 'open-attention-decision',
              decisionKind: 'attention.dismiss',
              objectId: item.id,
              expectedVersion: item.version,
              sourceVersion: item.sourceVersion,
            },
            text: 'Dismiss',
          }),
        ]) : null,
      ]),
    ]),
  ]);
}

function resumeBanner(resumeInput) {
  const resume = object(resumeInput);
  const href = safeInternalHref(resume.href);
  return el('section', { className: 'resume-banner', 'aria-labelledby': 'resume-title' }, [
    el('div', {}, [
      el('p', { className: 'eyebrow eyebrow--gold', text: 'Resume' }),
      el('h2', { id: 'resume-title', text: text(resume.title, 'Interrupted mentor work') }),
      el('p', { text: text(resume.detail, 'Review the last durable save before continuing.') }),
      resume.lastSavedAt ? el('p', { className: 'resume-banner__saved', text: `Last durable save ${formatDateTime(resume.lastSavedAt)}` }) : null,
    ]),
    href ? el('a', { className: 'button button--primary', href, text: text(resume.actionLabel, 'Resume') }) : null,
  ]);
}
