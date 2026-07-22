import { el, formatDateTime, object, text } from './dom.js';

const STATE_COPY = Object.freeze({
  loading: {
    symbol: '◌',
    title: 'Loading this workspace',
    explanation: 'MMC is requesting the current authorized record.',
    impact: 'No fixture content is shown while authority is unresolved.',
  },
  empty: {
    symbol: '○',
    title: 'Nothing is available here yet',
    explanation: 'The current authorized query returned no records.',
    impact: 'This does not imply that every student or dependency is healthy.',
  },
  filtered: {
    symbol: '⌕',
    title: 'No records match these filters',
    explanation: 'The current list may contain records outside this filter.',
    impact: 'Clear the filters to return to the authorized result set.',
  },
  partial: {
    symbol: '◐',
    title: 'Some information is unavailable',
    explanation: 'Available sections remain visible. Missing sections are named below.',
    impact: 'MMC suppresses conclusions that require the missing information.',
  },
  stale: {
    symbol: '◷',
    title: 'This information is stale',
    explanation: 'The source is older than its approved freshness threshold.',
    impact: 'Confirm current evidence before a consequential decision.',
  },
  offline: {
    symbol: '↯',
    title: 'Offline · browser work is not saved',
    explanation: 'MMC cannot reach its authoritative service.',
    impact: 'Do not close or reload if the page contains unsent text; reconnect or discard it.',
  },
  conflict: {
    symbol: '⇄',
    title: 'A newer version exists',
    explanation: 'Another session changed this record before your command completed.',
    impact: 'Your browser text is retained. Compare, reapply, or discard it; MMC will not auto-merge.',
  },
  error: {
    symbol: '!',
    title: 'This workspace could not be loaded',
    explanation: 'MMC did not receive a trustworthy response.',
    impact: 'No fixture or cached student information has replaced the failed query.',
  },
  revoked: {
    symbol: '⊘',
    title: 'Access is no longer available',
    explanation: 'Your role, assignment, or authenticated session cannot open this record.',
    impact: 'Protected details are not displayed. Reauthenticate or contact the authorized owner.',
  },
  unavailable: {
    symbol: '—',
    title: 'This page is unavailable',
    explanation: 'The requested private route is not part of the current mentor workspace.',
    impact: 'Use a primary destination or return to Today.',
  },
});

export function statePanel(kind, options = {}) {
  const copy = STATE_COPY[kind] || STATE_COPY.error;
  const role = ['error', 'revoked', 'conflict'].includes(kind) ? 'alert' : 'status';
  const panel = el('section', {
    className: `state-panel state-panel--${kind}`,
    role,
    'aria-live': role === 'status' ? 'polite' : undefined,
    'aria-atomic': 'true',
    dataset: { testid: `state-${kind}` },
  }, [
    el('span', { className: 'state-panel__symbol', 'aria-hidden': 'true', text: options.symbol || copy.symbol }),
    el('div', { className: 'state-panel__copy' }, [
      el('h2', { text: options.title || copy.title }),
      el('p', { text: options.explanation || copy.explanation }),
      el('p', { className: 'state-panel__impact', text: options.impact || copy.impact }),
      stateDetails(options),
      actionRow(options),
    ]),
  ]);
  return panel;
}

export function stateBanner(kind, options = {}) {
  const copy = STATE_COPY[kind] || STATE_COPY.partial;
  return el('section', {
    className: `state-banner state-banner--${kind}`,
    role: kind === 'error' || kind === 'conflict' ? 'alert' : 'status',
    dataset: { testid: `state-${kind}` },
  }, [
    el('span', { className: 'state-banner__symbol', 'aria-hidden': 'true', text: options.symbol || copy.symbol }),
    el('div', {}, [
      el('strong', { text: options.title || copy.title }),
      el('span', { text: ` ${options.explanation || copy.explanation}` }),
      options.details ? el('span', { className: 'state-banner__details', text: ` ${options.details}` }) : null,
    ]),
    options.actionLabel ? el('button', {
      type: 'button',
      className: 'button button--quiet',
      dataset: { action: options.action || 'retry-route' },
      text: options.actionLabel,
    }) : null,
  ]);
}

export function loadingPanel(label = 'mentor workspace') {
  return statePanel('loading', {
    title: `Loading ${label}`,
    explanation: `MMC is requesting the current authorized ${label}.`,
  });
}

export function errorPanel(error) {
  const code = String(error?.code || 'MMC_REQUEST_FAILED').toUpperCase();
  let kind = 'error';
  if (code === 'OFFLINE') kind = 'offline';
  else if ([401, 403].includes(Number(error?.status)) || /REVOKED|FORBIDDEN|SESSION_EXPIRED/u.test(code)) kind = 'revoked';
  else if (Number(error?.status) === 409 || /CONFLICT/u.test(code)) kind = 'conflict';
  return statePanel(kind, {
    explanation: error?.message,
    diagnosticId: error?.correlationId || code,
    actionLabel: error?.retryable === false ? null : 'Retry',
    action: 'retry-route',
  });
}

export function metaBanners(metaInput) {
  const meta = object(metaInput);
  const banners = [];
  const freshness = String(meta.freshness || '').toUpperCase();
  if (freshness === 'STALE' || freshness === 'EXPIRED') {
    banners.push(stateBanner('stale', {
      details: meta.asOf ? `Source as of ${formatDateTime(meta.asOf)}.` : null,
      actionLabel: 'Refresh',
    }));
  }
  const sections = object(meta.sections);
  const unavailable = Object.entries(sections)
    .filter(([, state]) => ['PARTIAL', 'UNAVAILABLE', 'ERROR', 'DEGRADED'].includes(String(state).toUpperCase()))
    .map(([name]) => name === 'providers' ? 'external source services' : name.replaceAll('_', ' '));
  if (unavailable.length || String(meta.state || '').toUpperCase() === 'PARTIAL') {
    banners.push(stateBanner('partial', {
      details: unavailable.length ? `Affected: ${unavailable.join(', ')}.` : null,
      actionLabel: 'Retry missing',
    }));
  }
  if (String(meta.connectivity || '').toUpperCase() === 'OFFLINE') banners.push(stateBanner('offline'));
  if (String(meta.state || '').toUpperCase() === 'CONFLICT') banners.push(stateBanner('conflict'));
  if (String(meta.authorization || '').toUpperCase() === 'REVOKED') banners.push(stateBanner('revoked'));
  return banners;
}

function stateDetails(options) {
  const items = [];
  if (options.environment) items.push(['Environment', options.environment]);
  if (options.asOf) items.push(['As of', formatDateTime(options.asOf)]);
  if (options.diagnosticId) items.push(['Diagnostic ID', text(options.diagnosticId)]);
  if (!items.length) return null;
  return el('dl', { className: 'state-panel__details' }, items.map(([label, value]) => [
    el('dt', { text: label }),
    el('dd', { text: value }),
  ]));
}

function actionRow(options) {
  if (!options.actionLabel && !options.secondaryLabel) return null;
  return el('div', { className: 'button-row' }, [
    options.actionLabel ? el('button', {
      type: 'button',
      className: 'button button--primary',
      dataset: { action: options.action || 'retry-route' },
      text: options.actionLabel,
    }) : null,
    options.secondaryLabel ? el('a', {
      className: 'button button--quiet',
      href: options.secondaryHref || '/mmc-private/today',
      text: options.secondaryLabel,
    }) : null,
  ]);
}
