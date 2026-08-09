(() => {
  'use strict';

  const root = document.documentElement;
  const gate = document.getElementById('lorRuntimeGate');
  const title = document.getElementById('lorRuntimeGateTitle');
  const message = document.getElementById('lorRuntimeGateMessage');
  const actions = document.getElementById('lorRuntimeGateActions');
  const code = document.getElementById('lorRuntimeGateCode');
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const fixtureRequested = new URLSearchParams(window.location.search).get('fidelity') === '1';
  const isLocalFixture = window.location.protocol === 'file:' || (localHosts.has(window.location.hostname) && fixtureRequested);

  function setUnderlyingState(blocked) {
    for (const element of document.body.children) {
      if (element === gate || element.tagName === 'SCRIPT') continue;
      if (blocked) {
        element.setAttribute('aria-hidden', 'true');
        element.inert = true;
      } else {
        element.removeAttribute('aria-hidden');
        element.inert = false;
      }
    }
  }

  function clearActions() {
    while (actions?.firstChild) actions.removeChild(actions.firstChild);
  }

  function addAction(label, handler, { href = '' } = {}) {
    if (!actions) return;
    const control = href ? document.createElement('a') : document.createElement('button');
    control.textContent = label;
    if (href) {
      control.href = href;
    } else {
      control.type = 'button';
      control.addEventListener('click', handler);
    }
    actions.appendChild(control);
  }

  function showState({ heading, detail, reason = '', login = false, retry = false }) {
    root.dataset.lorRuntime = 'gated';
    setUnderlyingState(true);
    if (gate) {
      gate.hidden = false;
      gate.style.removeProperty('display');
      gate.setAttribute('aria-busy', 'false');
    }
    if (title) title.textContent = heading;
    if (message) message.textContent = detail;
    if (code) code.textContent = reason ? `Reference: ${reason}` : '';
    clearActions();
    if (login) addAction('Sign in through MissionMed', null, { href: '/api/auth/start?final=%2Flor-studio%2F' });
    if (retry) addAction('Try again', checkRuntime);
  }

  function revealFixture() {
    root.dataset.lorRuntime = 'fixture';
    setUnderlyingState(false);
    if (gate) {
      gate.hidden = true;
      gate.style.display = 'none';
    }
    const badge = document.createElement('div');
    badge.className = 'lor-fidelity-badge';
    badge.textContent = 'Synthetic fidelity fixture — not live data';
    document.body.appendChild(badge);
    window.__LOR_STUDIO_RUNTIME__ = Object.freeze({ mode: 'synthetic_fixture', operational: false });
  }

  function blockUnhydratedLiveRuntime() {
    window.__LOR_STUDIO_RUNTIME__ = Object.freeze({
      mode: 'blocked_unhydrated',
      operational: false,
    });
    showState({
      heading: 'LOR Studio is not yet available',
      detail: 'The protected data runtime reported ready, but the frozen prototype has no authorized production hydration adapter. Access remains closed.',
      reason: 'frontend_hydration_unavailable',
      retry: false,
    });
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function checkRuntime() {
    root.dataset.lorRuntime = 'checking';
    setUnderlyingState(true);
    if (gate) {
      gate.hidden = false;
      gate.style.removeProperty('display');
      gate.setAttribute('aria-busy', 'true');
    }
    if (title) title.textContent = 'Checking secure access';
    if (message) message.textContent = 'Confirming your session, LOR entitlement, and runtime readiness.';
    if (code) code.textContent = '';
    clearActions();

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await window.fetch('/api/lor-studio/bootstrap', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await readJsonSafe(response);

      if (response.ok && payload?.operational === true && payload?.runtimeMode === 'live') {
        blockUnhydratedLiveRuntime();
        return;
      }

      const reason = String(payload?.error || `http_${response.status}`);
      if (response.status === 401) {
        showState({
          heading: 'Sign in to continue',
          detail: 'LOR Studio requires a fresh MissionMed session.',
          reason,
          login: true,
        });
      } else if (response.status === 403) {
        showState({
          heading: 'LOR Studio is not enabled for this account',
          detail: 'Access requires an active 360 entitlement plus explicit LOR Studio enablement.',
          reason,
        });
      } else if (response.status === 423) {
        showState({
          heading: 'LOR Studio is temporarily paused',
          detail: 'The release kill switch is active. No data was changed.',
          reason,
          retry: true,
        });
      } else {
        showState({
          heading: 'LOR Studio is not ready yet',
          detail: 'The protected application runtime is unavailable. The prototype beneath this screen remains synthetic and is not being presented as production.',
          reason,
          retry: true,
        });
      }
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'bootstrap_timeout' : 'bootstrap_unreachable';
      showState({
        heading: 'We could not reach LOR Studio',
        detail: 'Check your connection and try again. No draft or account data was changed.',
        reason,
        retry: true,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function installDialogAccessibility() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    modal.tabIndex = -1;
    let returnFocus = null;
    let wasOpen = modal.classList.contains('open');

    function labelDialog() {
      if (modal.getAttribute('aria-label') || modal.getAttribute('aria-labelledby')) return;
      const heading = modal.querySelector('h1, h2, .h1, .h2');
      if (!heading) return;
      heading.id ||= 'lorRuntimeDialogTitle';
      heading.setAttribute('role', 'heading');
      heading.setAttribute('aria-level', heading.matches('h1, .h1') ? '1' : '2');
      modal.setAttribute('aria-labelledby', heading.id);
    }

    document.addEventListener('click', (event) => {
      const trigger = event.target?.closest?.('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (trigger && !modal.contains(trigger) && !modal.classList.contains('open')) returnFocus = trigger;
    }, true);

    modal.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || !modal.classList.contains('open')) return;
      const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.inert && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    const observer = new MutationObserver(() => {
      const isOpen = modal.classList.contains('open');
      if (isOpen && !wasOpen) labelDialog();
      if (isOpen && !wasOpen && !modal.contains(document.activeElement)) {
        const first = modal.querySelector('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        (first || modal).focus();
      }
      if (!isOpen && wasOpen && returnFocus?.isConnected) {
        queueMicrotask(() => returnFocus?.focus());
      }
      wasOpen = isOpen;
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (wasOpen) labelDialog();
  }

  installDialogAccessibility();
  setUnderlyingState(true);
  if (isLocalFixture) {
    revealFixture();
  } else {
    checkRuntime();
  }
})();
