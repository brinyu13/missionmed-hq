import { el, formatDateTime, list, object, text } from '../components/dom.js';
import { evidenceInspector, trustRow } from '../components/trust.js';
import { statePanel } from '../components/state-panel.js';
import {
  continuityThread,
  emptyInline,
  pageIntro,
  publicationBoundary,
  recordList,
  studentContext,
  studentTabs,
  vessel,
  workspaceGrid,
} from './common.js';

export function renderStudentWorkspace(route, dataInput, meta = {}) {
  const data = object(dataInput);
  const subjectLink = object(data.subjectLink || data.studentContext?.subjectLink);
  const assignment = object(data.assignment || data.studentContext?.assignment);
  const student = object(data.student || (subjectLink.id ? {
    id: subjectLink.id,
    displayName: subjectLink.displayName,
    freshness: meta.freshness,
    assignment,
    trustStates: [subjectLink.identityState, meta.freshness],
  } : null));
  const studentId = route.params.studentId;
  if (!Object.keys(student).length) {
    return [
      pageIntro({ eyebrow: 'Student workspace', title: route.title, lead: 'No protected student detail is shown without a current authorized record.' }),
      statePanel('partial', {
        title: 'Student context is unavailable',
        explanation: 'The route is valid, but the response did not include an authorized student identity projection.',
        impact: 'Commands and cross-route assumptions are disabled.',
        environment: meta.environment,
        asOf: meta.asOf,
      }),
    ];
  }
  const view = route.params.view || 'overview';
  const title = route.name === 'student-session-detail' ? 'Session detail' : viewTitle(view);
  const primaryAction = view === 'overview'
    ? el('a', { className: 'button button--primary', href: `/mmc-private/students/${encodeURIComponent(studentId)}/prep`, text: 'Prepare call' })
    : null;
  return [
    pageIntro({
      eyebrow: 'Student workspace',
      title,
      lead: viewLead(view, route.name),
      actions: primaryAction ? [primaryAction] : [],
      testid: 'student-workspace',
    }),
    studentContext(student, meta),
    studentTabs(studentId, view),
    ...renderView(route, data, meta),
  ];
}

function renderView(route, data, meta) {
  if (route.name === 'student-session-detail') return renderSessionDetail(route, data, meta);
  if (route.params.view === 'plan') return renderPlan(data);
  if (route.params.view === 'history') return renderHistory(route, data);
  if (route.params.view === 'files') return renderFiles(data, meta);
  if (route.params.view === 'prep') return renderPrep(route, data, meta);
  return renderOverview(data, meta);
}

function renderOverview(data, meta) {
  const changed = list(data.changed || data.changes);
  const commitments = list(data.commitments);
  const gaps = list(data.dataSufficiency);
  const firstEvidence = object(changed[0]?.evidence || data.nextSafeMove?.evidence);
  const nextMove = object(data.nextSafeMove);
  const upcomingCall = object(data.upcomingCall);
  const brief = vessel('One-minute brief', [
    nextMove.title || nextMove.label || nextMove.nextAction ? el('article', { className: 'next-move' }, [
      el('p', { className: 'eyebrow eyebrow--gold', text: 'Next safe move' }),
      el('h3', { text: text(nextMove.title || nextMove.label || nextMove.nextAction) }),
      nextMove.reason ? el('p', { text: nextMove.reason }) : null,
      trustRow(nextMove.trustStates || [nextMove.origin, nextMove.freshness], nextMove.evidence),
    ]) : emptyInline('No evidence-backed next move was returned.'),
    sectionList('What changed', changed, 'No approved change was returned since the last meaningful interaction.'),
    sectionList('Commitments', commitments, 'No current commitment record was returned.'),
    upcomingCall.objective || upcomingCall.scheduledAt ? el('section', { className: 'brief-section' }, [
      el('h3', { text: 'Next call' }),
      el('strong', { text: text(upcomingCall.objective, 'Scheduled mentor call') }),
      upcomingCall.scheduledAt ? el('time', { datetime: upcomingCall.scheduledAt, text: formatDateTime(upcomingCall.scheduledAt) }) : null,
      upcomingCall.objective ? el('p', { text: upcomingCall.objective }) : null,
    ]) : null,
  ], { className: 'brief-vessel', eyebrow: 'Decision first' });
  const support = [
    vessel('Data sufficiency', [
      gaps.length ? recordList(gaps) : emptyInline('No explicit data gap was returned. This is not a completeness guarantee.'),
    ], { className: 'support-vessel' }),
    list(data.handlingContext).length ? vessel('Handle with care', [
      el('p', { text: text(data.handlingContext[0].text || data.handlingContext[0].label) }),
      data.handlingContext[0].purpose ? el('p', { className: 'field-help', text: `Purpose: ${text(data.handlingContext[0].purpose)}` }) : null,
      trustRow(['MENTOR_ONLY', meta.freshness]),
    ], { className: 'support-vessel support-vessel--gold' }) : null,
  ];
  return [
    workspaceGrid([brief, continuityThread(overviewContinuity(changed, commitments, upcomingCall, nextMove)), publicationBoundary()], Object.keys(firstEvidence).length ? evidenceInspector(firstEvidence) : null, support),
  ];
}

function overviewContinuity(changes, commitments, upcomingCall, nextMove) {
  const nodes = [];
  const seen = new Set();
  const add = (identity, node) => {
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    nodes.push(node);
  };
  changes.forEach((changeInput) => {
    const change = object(changeInput);
    add(String(change.objectId || change.id || ''), {
      kind: change.objectKind || 'CHANGE',
      title: change.label,
      at: change.changedAt,
      trustStates: [change.origin, change.freshness],
      evidence: change.evidence,
    });
  });
  commitments.forEach((commitmentInput) => {
    const commitment = object(commitmentInput);
    add(String(commitment.id || ''), {
      kind: `${text(commitment.ownerType, 'Shared')} commitment`,
      title: commitment.title,
      detail: commitment.status ? `Current state: ${commitment.status}` : null,
      at: commitment.dueAt || commitment.updatedAt,
      trustStates: [commitment.status, commitment.sensitivity],
      evidence: commitment.evidence,
    });
  });
  if (Object.keys(upcomingCall).length) {
    add(String(upcomingCall.id || 'upcoming-call'), {
      kind: 'Upcoming call',
      title: upcomingCall.objective,
      at: upcomingCall.scheduledAt || upcomingCall.startedAt,
      trustStates: [upcomingCall.status, upcomingCall.persistence],
      evidence: upcomingCall.evidence,
    });
  }
  if (Object.keys(nextMove).length && String(nextMove.state || '').toUpperCase() !== 'NONE') {
    add(String(nextMove.id || 'next-safe-move'), {
      kind: 'Next safe move',
      title: nextMove.nextAction || nextMove.label,
      detail: nextMove.reason,
      at: nextMove.dueAt,
      trustStates: [nextMove.origin, nextMove.freshness, nextMove.disposition],
      evidence: nextMove.evidence,
    });
  }
  return nodes.slice(0, 8);
}

function renderPlan(data) {
  const goals = list(data.goals);
  const milestones = list(data.milestones);
  const commitments = list(data.commitments);
  const loops = list(data.openLoops);
  return [
    workspaceGrid([
      vessel('Agreed plan', [
        sectionList('Current goals', goals, 'No agreed goal evidence yet. Create or import an agreed goal through an authorized command.'),
        sectionList('Next checkpoints', milestones, 'No objective milestone checkpoint was returned.'),
        sectionList('Commitments by owner', commitments, 'No current commitment record was returned.'),
      ], { className: 'plan-vessel', eyebrow: 'Goal to evidence' }),
      continuityThread(data.continuity),
    ], null, vessel('Open loops', [
      loops.length ? recordList(loops) : emptyInline('No unresolved loop was returned for this student.'),
    ], { className: 'support-vessel' })),
  ];
}

function renderHistory(route, data) {
  const sessions = list(data.sessions);
  const observations = list(data.observations || data.timeline);
  return [
    workspaceGrid([
      vessel('Session history', [
        sessions.length ? el('ol', { className: 'session-history' }, sessions.map((sessionInput) => {
          const session = object(sessionInput);
          const href = session.id ? `/mmc-private/students/${encodeURIComponent(route.params.studentId)}/history/sessions/${encodeURIComponent(session.id)}` : null;
          return el('li', {}, [
            el('article', { className: 'history-entry' }, [
              el('div', {}, [
                el('p', { className: 'record-row__meta', text: text(session.status, 'Session') }),
                href ? el('a', { className: 'record-row__title', href, text: text(session.objective, 'Mentor session') }) : el('strong', { text: text(session.objective, 'Mentor session') }),
                session.startedAt ? el('time', { datetime: session.startedAt, text: formatDateTime(session.startedAt) }) : null,
              ]),
              trustRow(session.trustStates || [session.origin, session.reviewState], session.evidence),
            ]),
          ]);
        })) : statePanel('empty', {
          title: 'No approved session history',
          explanation: 'The authorized history query returned zero session records.',
          impact: 'MMC does not substitute fixture meetings or infer that no interaction occurred elsewhere.',
        }),
      ], { className: 'history-vessel' }),
    ], null, vessel('Approved timeline', [
      observations.length ? recordList(observations) : emptyInline('No approved observation was returned.'),
    ], { className: 'support-vessel' })),
  ];
}

function renderSessionDetail(route, data) {
  const session = object(data.session);
  if (!Object.keys(session).length) {
    return [statePanel('unavailable', {
      title: 'Session detail is unavailable',
      explanation: 'The authorized history response did not include this session.',
      impact: 'No protected existence or transcript detail is inferred.',
      secondaryLabel: 'Return to history',
      secondaryHref: `/mmc-private/students/${encodeURIComponent(route.params.studentId)}/history`,
    })];
  }
  const captures = list(data.captures);
  const proposals = list(data.proposals);
  const evidenceList = list(data.evidence);
  const evidence = object(evidenceList[0]);
  return [
    workspaceGrid([
      vessel(text(session.title, 'Session intelligence'), [
        el('div', { className: 'session-summary' }, [
          session.startedAt ? el('time', { datetime: session.startedAt, text: formatDateTime(session.startedAt) }) : null,
          session.summary ? el('p', { text: session.summary }) : emptyInline('No approved summary was returned.'),
          trustRow(session.trustStates || [session.origin, session.reviewState], evidence),
        ]),
        captures.length ? sectionList('Approved and draft captures', captures, 'No capture was returned.') : statePanel('empty', {
          title: 'No typed captures',
          explanation: 'The authorized session detail returned zero capture records.',
          impact: 'MMC does not manufacture a transcript or summary.',
        }),
        proposals.length ? sectionList('Review proposals', proposals, 'No proposal was returned.') : null,
        evidenceList.length ? sectionList('Evidence records', evidenceList, 'No evidence was returned.') : statePanel('partial', {
          title: 'Evidence unavailable',
          explanation: 'No authorized evidence pointer was returned with this session detail.',
          impact: 'Evidence-dependent conclusions remain constrained.',
        }),
      ], { className: 'session-detail-vessel' }),
    ], Object.keys(evidence).length ? evidenceInspector(evidence) : null),
  ];
}

function renderFiles(data, meta) {
  const files = list(data.files || data.items);
  return [
    vessel('Authorized files', [
      files.length ? el('ul', { className: 'file-list' }, files.map((fileInput) => {
        const file = object(fileInput);
        return el('li', {}, [
          el('article', { className: 'file-record' }, [
            el('div', {}, [
              el('h3', { text: text(file.label, 'File name unavailable') }),
              el('p', { text: text(file.kind || file.mediaType, 'File type unavailable') }),
              file.observedAt ? el('time', { datetime: file.observedAt, text: `Observed ${formatDateTime(file.observedAt)}` }) : null,
            ]),
            el('div', {}, [
              trustRow([file.sourceAuthority, file.reviewState, file.freshness], file.evidence),
              el('button', { type: 'button', className: 'button button--quiet', disabled: true, text: 'Source-owned file access' }),
            ]),
          ]),
        ]);
      })) : statePanel('empty', {
        title: 'No authorized files',
        explanation: 'The current file manifest returned zero records.',
        impact: 'External systems remain source owners; MMC does not invent or browser-cache a file list.',
        environment: meta.environment,
        asOf: meta.asOf,
      }),
    ], { className: 'files-vessel' }),
  ];
}

function renderPrep(route, data, meta) {
  const prep = data;
  const changes = list(prep.changes || data.changes);
  const commitments = list(prep.commitments || data.commitments);
  const questions = prep.nextQuestion ? [{ kind: 'NEXT QUESTION', title: prep.nextQuestion }] : [];
  const gaps = list(prep.dataGaps || data.dataGaps);
  const canStart = Boolean(prep.subjectLinkId) && String(meta.authorization || '').toUpperCase() !== 'REVOKED';
  return [
    el('section', { className: 'prep-focus', dataset: { testid: 'call-prep' } }, [
      vessel('Call brief', [
        el('section', { className: 'prep-objective' }, [
          el('p', { className: 'eyebrow eyebrow--gold', text: 'Objective' }),
          el('h3', { text: text(prep.objective, 'No approved call objective was returned') }),
          prep.reason ? el('p', { text: prep.reason }) : null,
          trustRow(prep.trustStates || [prep.origin, prep.freshness], prep.evidence),
        ]),
        sectionList('Changes since last approved interaction', changes, 'No approved material change was returned.'),
        sectionList('Unresolved commitments', commitments, 'No unresolved commitment was returned.'),
        sectionList('Pinned questions', questions.slice(0, 3), 'No question is pinned yet.'),
        gaps.length ? sectionList('Advice constraints', gaps, 'No explicit data gap was returned.') : null,
        list(prep.handlingContext).length ? sectionList('Private handling context', prep.handlingContext, 'No private handling context was returned.') : null,
        el('div', { className: 'prep-actions' }, [
          el('button', {
            type: 'button',
            className: 'button button--primary',
            dataset: { action: 'start-session', studentId: route.params.studentId },
            disabled: !canStart,
            text: canStart ? 'Start pinned session' : 'Session start unavailable',
          }),
          el('button', { type: 'button', className: 'button button--quiet', dataset: { action: 'toggle-focus' }, text: 'Focus on this brief' }),
        ]),
      ], { className: 'prep-vessel', eyebrow: 'Two-minute preparation' }),
      prep.milestone ? sectionList('Upcoming milestone', [prep.milestone], 'No milestone was returned.') : null,
    ]),
  ];
}

function sectionList(title, records, emptyMessage) {
  return el('section', { className: 'brief-section' }, [
    el('h3', { text: title }),
    records.length ? recordList(records) : emptyInline(emptyMessage),
  ]);
}

function transcriptRegion(segments, totalInput) {
  const visible = segments.slice(0, 100);
  const total = Number.isFinite(Number(totalInput)) ? Number(totalInput) : segments.length;
  return el('section', { className: 'transcript-region', 'aria-labelledby': 'transcript-title', tabIndex: '0' }, [
    el('div', { className: 'transcript-region__header' }, [
      el('h3', { id: 'transcript-title', text: 'Transcript evidence' }),
      el('span', { text: `Showing ${visible.length} of ${total} segments` }),
    ]),
    el('ol', {}, visible.map((segmentInput) => {
      const segment = object(segmentInput);
      return el('li', {}, [
        el('p', { className: 'transcript-speaker', text: text(segment.speaker, 'Speaker unavailable') }),
        segment.at || segment.timestamp ? el('time', { datetime: segment.at || undefined, text: text(segment.timestamp || formatDateTime(segment.at)) }) : null,
        el('p', { dir: 'auto', lang: segment.language || undefined, text: text(segment.text, 'Transcript text unavailable') }),
      ]);
    })),
    total > visible.length ? el('p', { className: 'field-help', text: 'Additional segments require the next authorized server page; this view does not hide a browser-only full transcript.' }) : null,
  ]);
}

function viewTitle(view) {
  return ({ overview: 'Overview', plan: 'Plan', history: 'History', files: 'Files', prep: 'Call prep' })[view] || 'Overview';
}

function viewLead(view, name) {
  if (name === 'student-session-detail') return 'Review approved session intelligence and exact evidence without changing the selected subject.';
  return ({
    overview: 'What changed, what matters next, and what evidence constrains the advice.',
    plan: 'Agreed goals, objective milestones, commitments, and unresolved loops.',
    history: 'Approved sessions, observations, corrections, and supersession—not a manufactured activity score.',
    files: 'Authorized artifact metadata and review state. External systems remain source owners.',
    prep: 'One objective, material changes, promises, questions, and advice constraints before the call.',
  })[view];
}
