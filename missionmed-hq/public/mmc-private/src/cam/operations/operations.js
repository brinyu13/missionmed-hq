import { el, list, object, text } from '../components/dom.js';
import { trustRow } from '../components/trust.js';
import { statePanel } from '../components/state-panel.js';
import { metric, pageIntro, vessel, workspaceGrid } from '../mentor/common.js';

export function renderOperations(route, dataInput, meta = {}) {
  const data = object(dataInput);
  if (data.kind !== 'MENTOR_OPERATIONS') {
    return [
      pageIntro({ eyebrow: 'Capability-gated workspace', title: 'Operations', lead: 'Operational mechanics remain separate from the mentor loop.' }),
      statePanel('revoked', {
        title: 'Operations access is unavailable',
        explanation: 'The server did not return an authorized Operations projection.',
        impact: 'Pipeline, source, provider, prompt, and audit details are not displayed.',
        environment: meta.environment,
        asOf: meta.asOf,
      }),
    ];
  }

  const health = object(data.health);
  const areas = list(data.areas);
  const currentArea = normalizeArea(route.params.area);
  const selected = object(areas.find((area) => normalizeArea(area.id) === currentArea) || areas[0]);
  return [
    pageIntro({
      eyebrow: 'Capability-gated workspace',
      title: 'Operations',
      lead: 'Capability-gated inspection of local pipeline authority, source policy, audit posture, and disabled external planes remains separate from the mentor loop.',
    }),
    operationsNav(route, areas),
    el('div', { className: 'operations-metrics', 'aria-label': 'Operations summary' }, [
      metric('Gateway', health.gateway),
      metric('Commands', health.commands),
      metric('Queries', health.queries),
      metric('External writes', health.externalWrites),
    ]),
    workspaceGrid([
      vessel('Operational areas', [
        areas.length ? el('ol', { className: 'operations-areas', dataset: { testid: 'operations-workspace' } }, areas.map((area) => areaCard(area, route))) : statePanel('empty', {
          title: 'No operational areas returned',
          explanation: 'The authorized Operations query returned no area projections.',
          impact: 'This does not imply that pipeline or provider systems are healthy.',
          environment: meta.environment,
          asOf: meta.asOf,
        }),
      ], { className: 'operations-vessel', eyebrow: 'Read-only local posture' }),
      vessel('Plane boundaries', [
        boundaryRow('Durable persistence', data.durablePersistence, 'No durable 007 adapter is enabled.'),
        boundaryRow('Provider integrations', data.providerIntegrations, 'Webex, media, and AI providers are not called.'),
        boundaryRow('Student publication', data.studentPublication, 'Publication remains disabled until authorized MegaRun 008.'),
      ], { className: 'operations-boundary-vessel' }),
    ], null, Object.keys(selected).length ? areaInspector(selected) : null),
  ];
}

function operationsNav(route, areas) {
  const currentArea = normalizeArea(route.params.area);
  return el('nav', { className: 'operations-nav', 'aria-label': 'Operations areas' }, [
    el('a', { href: '/mmc-private/operations', 'aria-current': !route.params.area ? 'page' : undefined, text: 'Overview' }),
    ...areas.map((area) => el('a', {
      href: `/mmc-private/operations/${encodeURIComponent(area.id)}`,
      'aria-current': currentArea === normalizeArea(area.id) ? 'page' : undefined,
      text: text(area.label),
    })),
  ]);
}

function areaCard(areaInput, route) {
  const area = object(areaInput);
  const current = normalizeArea(route.params.area) === normalizeArea(area.id);
  return el('li', {}, [
    el('article', { className: `operations-area${current ? ' operations-area--current' : ''}` }, [
      el('div', {}, [
        el('p', { className: 'record-row__meta', text: text(area.state, 'State unavailable') }),
        el('a', {
          href: `/mmc-private/operations/${encodeURIComponent(area.id)}`,
          'aria-current': current ? 'true' : undefined,
          text: text(area.label),
        }),
      ]),
      trustRow([area.state]),
    ]),
  ]);
}

function areaInspector(area) {
  return vessel(text(area.label, 'Operational area'), [
    el('p', { text: `Current state: ${text(area.state)}` }),
    area.selectedItemId ? el('p', { text: `Selected opaque item: ${text(area.selectedItemId)}` }) : null,
    el('p', { className: 'field-help', text: 'MegaRun 007 exposes an honest read-only local posture. Job repair, provider actions, and external effects remain disabled.' }),
    el('button', { type: 'button', className: 'button button--quiet', disabled: true, text: 'No operator mutation authorized' }),
  ], { className: 'support-vessel', eyebrow: 'Area detail' });
}

function boundaryRow(label, state, explanation) {
  return el('article', { className: 'boundary-row' }, [
    el('div', {}, [
      el('h3', { text: label }),
      el('p', { text: explanation }),
    ]),
    trustRow([state]),
  ]);
}

function normalizeArea(value) {
  return String(value || '').trim().toLocaleLowerCase();
}
