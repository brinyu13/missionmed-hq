import { el, iconText, list, object, replaceChildren, text } from './dom.js';

const PRIMARY_NAV = Object.freeze([
  { key: 'today', label: 'Today', href: '/mmc-private/today', symbol: '01' },
  { key: 'students', label: 'Students', href: '/mmc-private/students', symbol: '02' },
  { key: 'work', label: 'Work', href: '/mmc-private/work', symbol: '03' },
  { key: 'reviews', label: 'Reviews', href: '/mmc-private/reviews', symbol: '04' },
]);

export function createShell(root) {
  const railNav = navList('rail-nav', PRIMARY_NAV);
  const operationsLink = navLink({
    key: 'operations',
    label: 'Operations',
    href: '/mmc-private/operations',
    symbol: 'OP',
  }, 'rail-nav__operations');
  operationsLink.hidden = true;

  const rail = el('aside', {
    className: 'cam-rail',
    dataset: { testid: 'cam-rail' },
    'aria-label': 'Mentor workspace rail',
  }, [
    el('div', { className: 'brand-lockup' }, [
      el('span', { className: 'brand-mark', 'aria-hidden': 'true', text: 'MM' }),
      el('div', { className: 'brand-copy' }, [
        el('strong', { text: 'Matrix Mentor' }),
        el('span', { text: 'Continuity studio' }),
      ]),
    ]),
    railNav,
    el('div', { className: 'rail-nav__lower' }, [operationsLink]),
  ]);

  const environmentBadge = el('span', {
    className: 'environment-badge environment-badge--unknown',
    dataset: { testid: 'environment-badge' },
    text: 'Environment unconfirmed',
  });
  const connectionStatus = el('span', {
    className: 'chrome-status',
    id: 'connection-status',
    text: navigator.onLine === false ? 'Offline' : 'Connected',
  });
  const saveStatus = el('span', {
    className: 'chrome-status',
    id: 'save-status',
    text: 'No unsaved work',
  });

  const contextHeader = el('header', { className: 'context-header' }, [
    el('div', { className: 'context-header__status', 'aria-label': 'Workspace state' }, [
      environmentBadge,
      connectionStatus,
      saveStatus,
    ]),
    el('div', { className: 'context-header__commands' }, [
      el('button', {
        type: 'button',
        className: 'command-button',
        dataset: { action: 'open-palette' },
        'aria-keyshortcuts': 'Meta+K Control+K',
        'aria-label': 'Open search and command palette',
      }, [el('span', { text: 'Search' }), el('kbd', { text: '⌘K' })]),
      el('button', {
        type: 'button',
        className: 'button button--quiet header-quick-capture',
        dataset: { action: 'open-quick-capture' },
        text: 'Quick capture',
      }),
      el('button', {
        type: 'button',
        className: 'icon-button focus-toggle',
        dataset: { action: 'toggle-focus' },
        'aria-pressed': 'false',
        'aria-label': 'Enter focus mode',
        title: 'Focus mode',
        text: '⌗',
      }),
    ]),
  ]);

  const routeAnnouncer = el('div', {
    id: 'route-announcer',
    className: 'visually-hidden',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  const actionAnnouncer = el('div', {
    id: 'action-announcer',
    className: 'visually-hidden',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });

  const main = el('main', {
    id: 'main-content',
    className: 'cam-main',
    tabIndex: '-1',
  });
  const mobileNav = navList('mobile-nav', PRIMARY_NAV, true);
  mobileNav.dataset.testid = 'mobile-nav';
  mobileNav.append(el('button', {
    type: 'button',
    className: 'mobile-nav__link',
    dataset: { action: 'open-more' },
    'aria-label': 'More destinations and commands',
  }, iconText('•••', 'More')));

  const shell = el('div', { className: 'cam-shell', dataset: { testid: 'cam-shell' } }, [
    rail,
    el('div', { className: 'cam-workspace' }, [contextHeader, routeAnnouncer, actionAnnouncer, main]),
    mobileNav,
    commandPalette(),
    quickCaptureDialog(),
    attentionDecisionDialog(),
    moreDialog(),
    unsavedDialog(),
  ]);

  replaceChildren(root, shell);
  return Object.freeze({
    shell,
    main,
    rail,
    railNav,
    operationsLink,
    mobileNav,
    environmentBadge,
    connectionStatus,
    saveStatus,
    routeAnnouncer,
    actionAnnouncer,
    palette: shell.querySelector('#command-palette'),
    quickCapture: shell.querySelector('#quick-capture-dialog'),
    attentionDecision: shell.querySelector('#attention-decision-dialog'),
    more: shell.querySelector('#more-dialog'),
    unsaved: shell.querySelector('#unsaved-dialog'),
  });
}

export function updateShell(refs, route, metaInput, appState = {}) {
  const meta = object(metaInput);
  const environment = String(meta.environment || '').trim().toUpperCase();
  if (environment) {
    refs.environmentBadge.className = `environment-badge environment-badge--${environment.toLowerCase()}`;
    refs.environmentBadge.textContent = environment === 'FIXTURE'
      ? 'Fixture · synthetic data'
      : `${titleCase(environment)} environment`;
    refs.environmentBadge.dataset.environment = environment;
  }
  const canOperate = hasOperationsCapability(meta, appState);
  refs.operationsLink.hidden = !canOperate;
  const mobileMore = refs.more.querySelector('[data-operations-link]');
  if (mobileMore) mobileMore.hidden = !canOperate;

  refs.shell.querySelectorAll('[data-nav-key]').forEach((node) => {
    const current = node.dataset.navKey === route.navKey;
    if (current) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  refs.connectionStatus.textContent = navigator.onLine === false ? 'Offline' : text(meta.connectivity || 'Connected');
}

export function setSaveState(refs, state) {
  const normalized = String(state || 'UNSAVED').toUpperCase();
  const copy = {
    SAVED: 'Saved',
    SAVING: 'Saving…',
    UNSAVED: 'Unsaved',
    OFFLINE_NOT_SAVED: 'Offline · not saved',
    CONFLICT: 'Conflict · not saved',
    FAILED: 'Save failed',
    UNAVAILABLE: 'Commands unavailable',
    NONE: 'No unsaved work',
  }[normalized] || titleCase(normalized);
  refs.saveStatus.textContent = copy;
  refs.saveStatus.dataset.state = normalized;
}

export function openDialog(dialog, opener) {
  document.querySelectorAll('dialog[open]').forEach((current) => current.close());
  const inspector = document.querySelector('#evidence-inspector[data-open="true"]');
  if (inspector) {
    inspector.dataset.open = 'false';
    inspector.hidden = true;
  }
  dialog.dataset.returnFocusId = ensureFocusId(opener);
  dialog.showModal();
  const initial = dialog.querySelector('[autofocus]') || dialog.querySelector('input, select, textarea, button, a[href]');
  initial?.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    if (dialog.open && !dialog.contains(document.activeElement)) initial?.focus({ preventScroll: true });
  });
}

export function closeDialog(dialog) {
  if (!dialog?.open) return;
  const returnId = dialog.dataset.returnFocusId;
  dialog.close();
  if (returnId) requestAnimationFrame(() => document.getElementById(returnId)?.focus());
}

export function populatePalette(dialog, students = []) {
  const resultList = dialog.querySelector('#palette-results');
  const query = String(dialog.querySelector('#palette-search')?.value || '').trim().toLocaleLowerCase();
  const destinations = [
    ...PRIMARY_NAV,
    { key: 'operations', label: 'Operations', href: '/mmc-private/operations', symbol: 'OP' },
  ];
  const results = [
    ...destinations.map((entry) => ({ label: entry.label, meta: 'Destination', href: entry.href })),
    ...list(students).map((student) => ({
      label: text(student.name || student.displayName),
      meta: text(student.program || student.assignment || 'Student workspace'),
      href: student.subjectLinkId || student.id ? `/mmc-private/students/${encodeURIComponent(student.subjectLinkId || student.id)}/overview` : null,
    })),
  ].filter((entry) => entry.href && (!query || `${entry.label} ${entry.meta}`.toLocaleLowerCase().includes(query))).slice(0, 12);
  replaceChildren(resultList, results.length ? results.map((entry) => el('li', {}, [
    el('a', { href: entry.href, className: 'palette-result' }, [
      el('strong', { text: entry.label }),
      el('span', { text: entry.meta }),
    ]),
  ])) : el('li', { className: 'empty-inline', text: 'No authorized result matches this search.' }));
}

export function populateQuickCaptureStudents(dialog, students = []) {
  const select = dialog.querySelector('#quick-student');
  const current = select.value;
  replaceChildren(select, [
    el('option', { value: '', text: 'Choose an authorized student' }),
    ...list(students).filter((student) => student?.subjectLinkId || student?.id).map((student) => el('option', {
      value: student.subjectLinkId || student.id,
      text: text(student.name || student.displayName),
    })),
  ]);
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function navList(className, items, mobile = false) {
  const nav = el('nav', { className, 'aria-label': mobile ? 'Mobile primary' : 'Primary' });
  for (const item of items) nav.append(navLink(item, `${className}__link`));
  return nav;
}

function navLink(item, className) {
  return el('a', {
    href: item.href,
    className,
    dataset: { navKey: item.key },
  }, iconText(item.symbol, item.label));
}

function commandPalette() {
  return el('dialog', {
    id: 'command-palette',
    className: 'dialog dialog--palette',
    'aria-labelledby': 'palette-title',
    dataset: { testid: 'command-palette' },
  }, [
    el('form', { method: 'dialog', className: 'dialog__close-form' }, [
      el('button', { type: 'submit', className: 'icon-button', 'aria-label': 'Close command palette', text: '×' }),
    ]),
    el('p', { className: 'eyebrow eyebrow--cyan', text: 'Search and commands' }),
    el('h2', { id: 'palette-title', text: 'Go where the work is' }),
    el('label', { htmlFor: 'palette-search', text: 'Search students and destinations' }),
    el('input', {
      id: 'palette-search',
      type: 'search',
      autocomplete: 'off',
      placeholder: 'Student or destination',
      autofocus: true,
    }),
    el('ul', { id: 'palette-results', className: 'palette-results', 'aria-label': 'Search results' }),
    el('p', { className: 'dialog-hint', text: 'Press Escape to return to your prior control.' }),
  ]);
}

function quickCaptureDialog() {
  return el('dialog', {
    id: 'quick-capture-dialog',
    className: 'dialog dialog--form',
    'aria-labelledby': 'quick-capture-title',
    'aria-describedby': 'quick-capture-description',
    dataset: { testid: 'quick-capture-dialog' },
  }, [
    el('form', { id: 'quick-capture-form' }, [
      el('div', { className: 'dialog__header' }, [
        el('div', {}, [
          el('p', { className: 'eyebrow eyebrow--gold', text: 'Mentor-authored draft' }),
          el('h2', { id: 'quick-capture-title', text: 'Quick capture' }),
        ]),
        el('button', { type: 'button', className: 'icon-button', dataset: { action: 'close-dialog' }, 'aria-label': 'Close quick capture', text: '×' }),
      ]),
      el('p', {
        id: 'quick-capture-description',
        text: 'Choose the authorized student and exact object type before writing. Nothing publishes from this form.',
      }),
      el('div', { id: 'quick-capture-errors', className: 'form-status', role: 'status', 'aria-live': 'polite' }),
      el('label', { htmlFor: 'quick-student', text: 'Student' }),
      el('select', { id: 'quick-student', name: 'studentId', required: true }, [
        el('option', { value: '', text: 'Load authorized students to choose' }),
      ]),
      el('label', { htmlFor: 'quick-type', text: 'Capture type' }),
      el('select', { id: 'quick-type', name: 'captureType', required: true }, [
        el('option', { value: '', text: 'Choose a type' }),
        el('option', { value: 'STUDENT_TASK', text: 'Student task' }),
        el('option', { value: 'MENTOR_TASK', text: 'Mentor task' }),
        el('option', { value: 'MUTUAL_COMMITMENT', text: 'Mutual commitment' }),
      ]),
      el('label', { htmlFor: 'quick-text', text: 'Capture' }),
      el('textarea', { id: 'quick-text', name: 'text', rows: '4', maxlength: '300', required: true }),
      el('p', { className: 'field-help', text: 'Browser-only text is not saved until the server acknowledges the command.' }),
      el('div', { className: 'button-row' }, [
        el('button', { type: 'submit', className: 'button button--primary', text: 'Save mentor draft' }),
        el('button', { type: 'button', className: 'button button--quiet', dataset: { action: 'close-dialog' }, text: 'Cancel' }),
      ]),
    ]),
  ]);
}

function moreDialog() {
  return el('dialog', {
    id: 'more-dialog',
    className: 'dialog dialog--sheet',
    'aria-labelledby': 'more-title',
  }, [
    el('div', { className: 'dialog__header' }, [
      el('h2', { id: 'more-title', text: 'More' }),
      el('button', { type: 'button', className: 'icon-button', dataset: { action: 'close-dialog' }, 'aria-label': 'Close more menu', text: '×' }),
    ]),
    el('nav', { className: 'more-nav', 'aria-label': 'More destinations' }, [
      el('a', { href: '/mmc-private/operations', dataset: { operationsLink: 'true', navKey: 'operations' } }, iconText('OP', 'Operations')),
      el('button', { type: 'button', dataset: { action: 'open-palette' } }, iconText('⌕', 'Search and commands')),
      el('button', { type: 'button', dataset: { action: 'open-quick-capture' } }, iconText('+', 'Quick capture')),
      el('button', { type: 'button', dataset: { action: 'toggle-focus' } }, iconText('⌗', 'Focus mode')),
    ]),
  ]);
}

function attentionDecisionDialog() {
  return el('dialog', {
    id: 'attention-decision-dialog',
    className: 'dialog dialog--form',
    'aria-labelledby': 'attention-decision-title',
    'aria-describedby': 'attention-decision-description',
  }, [
    el('form', { id: 'attention-decision-form' }, [
      el('div', { className: 'dialog__header' }, [
        el('div', {}, [
          el('p', { className: 'eyebrow eyebrow--gold', text: 'Attention disposition' }),
          el('h2', { id: 'attention-decision-title', text: 'Defer this condition' }),
        ]),
        el('button', { type: 'button', className: 'icon-button', dataset: { action: 'close-dialog' }, 'aria-label': 'Close attention decision', text: '×' }),
      ]),
      el('p', {
        id: 'attention-decision-description',
        text: 'Name why this condition can leave the active queue and when it should return. A material source-version change can surface it sooner.',
      }),
      el('div', { id: 'attention-decision-status', className: 'form-status', role: 'status', 'aria-live': 'polite' }),
      el('input', { type: 'hidden', name: 'kind' }),
      el('input', { type: 'hidden', name: 'targetId' }),
      el('input', { type: 'hidden', name: 'expectedVersion' }),
      el('input', { type: 'hidden', name: 'sourceVersion' }),
      el('label', { htmlFor: 'attention-reason', text: 'Reason' }),
      el('textarea', { id: 'attention-reason', name: 'reason', rows: '3', minlength: '3', maxlength: '1000', required: true }),
      el('label', { htmlFor: 'attention-expiry', text: 'Return to the queue after' }),
      el('select', { id: 'attention-expiry', name: 'expiryHours', required: true }, [
        el('option', { value: '24', text: 'One day' }),
        el('option', { value: '72', text: 'Three days' }),
        el('option', { value: '168', text: 'Seven days' }),
        el('option', { value: '720', text: 'Thirty days' }),
      ]),
      el('div', { className: 'button-row' }, [
        el('button', { type: 'submit', className: 'button button--primary', text: 'Apply queue decision' }),
        el('button', { type: 'button', className: 'button button--quiet', dataset: { action: 'close-dialog' }, text: 'Cancel' }),
      ]),
    ]),
  ]);
}

function unsavedDialog() {
  return el('dialog', {
    id: 'unsaved-dialog',
    className: 'dialog dialog--form',
    'aria-labelledby': 'unsaved-title',
    'aria-describedby': 'unsaved-description',
  }, [
    el('h2', { id: 'unsaved-title', text: 'This browser text is not saved' }),
    el('p', {
      id: 'unsaved-description',
      text: 'Save the current typed capture, discard it, or stay here. Closing or reloading can lose unsaved text.',
    }),
    el('div', { id: 'unsaved-dialog-status', className: 'form-status', role: 'status', 'aria-live': 'polite' }),
    el('div', { className: 'button-row' }, [
      el('button', { type: 'button', className: 'button button--primary', dataset: { action: 'save-before-navigation' }, text: 'Save capture' }),
      el('button', { type: 'button', className: 'button button--danger', dataset: { action: 'discard-navigation' }, text: 'Discard and leave' }),
      el('button', { type: 'button', className: 'button button--quiet', dataset: { action: 'stay-on-page' }, text: 'Stay' }),
    ]),
  ]);
}

function hasOperationsCapability(meta, appState) {
  const capabilities = new Set([
    ...list(meta.capabilities),
    ...list(object(meta.principal).capabilities),
    ...list(appState.capabilities),
  ].map((value) => String(value).toLowerCase()));
  const role = String(meta.principalRole || object(meta.principal).role || appState.role || '').toLowerCase();
  return capabilities.has('operations.read') || capabilities.has('mmc.operations.read') || ['admin', 'operator'].includes(role);
}

function ensureFocusId(node) {
  if (!node) return '';
  if (!node.id) node.id = `cam-focus-${crypto.randomUUID()}`;
  return node.id;
}

function titleCase(value) {
  return text(value).replaceAll('_', ' ').toLocaleLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}
