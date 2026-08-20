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
  // The concurrent projection-UI lane had not landed public/lor-studio/production-projection-ui.js
  // when this adapter was written, so the handshake is this global. It accepts either a factory
  // (called with { mount, document }) or an already-constructed UI object; either way the object
  // must satisfy the same isolation contract the server-side adapter enforces in
  // adapters/production-hydration-adapter.mjs assertProductionUi.
  const PRODUCTION_UI_GLOBAL = 'LorProductionProjectionUi';
  const PROTOTYPE_MARKER_KEYS = /^(?:demo|fixture|fixtureData|localStorage|prototypeState|synthetic|syntheticData)$/u;
  const PRODUCTION_MOUNT_ID = 'lorProductionRoot';

  /**
   * The only two projections this page knows how to present, and the actor role each one implies.
   *
   * The role is READ OFF THE SERVER'S ANSWER, never off anything the browser decides.
   * security/authorization-policy.js chooses which projection to emit from the authenticated
   * actor's role, and it emits the faculty projection only to the recipient-bound, verified
   * faculty writer of that case. So "the server sent a faculty projection" is the server saying
   * "this actor is that writer"; the adapter merely relays which surface to paint. Every write the
   * resulting surface can issue is authorized again, server side, on its own route.
   */
  const PROJECTION_ACTOR_ROLES = new Map([
    ['missionmed.lor.student-projection.v1', 'student'],
    ['missionmed.lor.faculty-projection.v1', 'faculty'],
  ]);

  const EXPORT_FILENAME_FALLBACK = 'recommendation-letter.docx';

  /** Live binding for the authorized case. Commands refuse to address anything else. */
  let activeCaseId = '';
  let activeCsrfToken = '';

  function setUnderlyingState(blocked) {
    for (const element of document.body.children) {
      if (element === gate || element.tagName === 'SCRIPT') continue;
      if (element.id === PRODUCTION_MOUNT_ID) continue;
      if (blocked) {
        element.setAttribute('aria-hidden', 'true');
        if (element instanceof HTMLElement) element.inert = true;
      } else {
        element.removeAttribute('aria-hidden');
        if (element instanceof HTMLElement) element.inert = false;
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
    if (control instanceof HTMLAnchorElement) {
      control.href = href;
    } else if (control instanceof HTMLButtonElement) {
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
    // Defence in depth: the only caller is the isLocalFixture branch, and this guard keeps it
    // that way even if a future edit adds a second caller.
    if (!isLocalFixture) return;
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
    Object.assign(window, {
      __LOR_STUDIO_RUNTIME__: Object.freeze({ mode: 'synthetic_fixture', operational: false }),
    });
  }

  function activateFrozenFixtureRuntime() {
    // Un-quarantining the frozen prototype script is a fixture-only capability. Production must
    // never reach this, so the refusal lives here rather than only at the call site.
    if (!isLocalFixture) return false;
    const frozenRuntime = document.getElementById('lorFrozenPrototypeRuntime');
    if (!frozenRuntime) return false;
    if (
      !(frozenRuntime instanceof HTMLScriptElement)
      || frozenRuntime.type !== 'application/x-lor-frozen-prototype'
    ) {
      return false;
    }
    const executable = document.createElement('script');
    executable.dataset.lorFixtureRuntime = 'active';
    executable.textContent = `${frozenRuntime.textContent || ''}\n;window.__LOR_FROZEN_PROTOTYPE_READY__=true;`;
    frozenRuntime.replaceWith(executable);
    return Reflect.get(window, '__LOR_FROZEN_PROTOTYPE_READY__') === true;
  }

  function blockUnhydratedLiveRuntime() {
    Object.assign(window, {
      __LOR_STUDIO_RUNTIME__: Object.freeze({
        mode: 'blocked_unhydrated',
        operational: false,
      }),
    });
    showState({
      heading: 'LOR Studio is not yet available',
      detail: 'The protected data runtime reported ready, but the frozen prototype has no authorized production hydration adapter. Access remains closed.',
      reason: 'frontend_hydration_unavailable',
      retry: false,
    });
  }

  /**
   * Mirrors adapters/production-hydration-adapter.mjs assertProductionUi. The browser cannot
   * import that module, so the same five conditions are re-checked here before any authoritative
   * projection is handed over. Anything that fails returns null and the caller fails closed.
   */
  function assertProductionUiContract(ui) {
    if (!ui || typeof ui !== 'object') return null;
    if (typeof ui.block !== 'function') return null;
    if (typeof ui.renderProductionProjection !== 'function') return null;
    if (ui.presentationIsolation !== 'production_projection_only') return null;
    if (ui.usesLocalStorage !== false) return null;
    if (ui.canRevealPrototype !== false) return null;
    return ui;
  }

  function productionMount() {
    let mount = document.getElementById(PRODUCTION_MOUNT_ID);
    if (!mount) {
      mount = document.createElement('div');
      mount.id = PRODUCTION_MOUNT_ID;
      mount.className = 'lor-production-root';
      document.body.appendChild(mount);
    }
    return mount;
  }

  function resolveProductionProjectionUi() {
    const exported = Reflect.get(window, PRODUCTION_UI_GLOBAL);
    if (!exported) return null;
    try {
      const candidate = typeof exported === 'function'
        ? exported({ mount: productionMount(), document })
        : exported;
      return assertProductionUiContract(candidate);
    } catch {
      return null;
    }
  }

  function containsPrototypeMarker(value, depth = 0) {
    if (depth > 20) return true;
    if (Array.isArray(value)) return value.some((item) => containsPrototypeMarker(item, depth + 1));
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(
      ([key, child]) => PROTOTYPE_MARKER_KEYS.test(key) || containsPrototypeMarker(child, depth + 1),
    );
  }

  function acceptProjection(payload, caseId) {
    const projection = payload?.case;
    if (!projection || typeof projection !== 'object') return null;
    if (typeof projection.schemaVersion !== 'string' || !PROJECTION_ACTOR_ROLES.has(projection.schemaVersion)) return null;
    if (String(projection.caseId ?? '') !== String(caseId)) return null;
    if (containsPrototypeMarker(projection)) return null;
    return projection;
  }

  function projectionActorRole(projection) {
    return PROJECTION_ACTOR_ROLES.get(String(projection?.schemaVersion ?? '')) || 'student';
  }

  function requestedCaseId() {
    const value = String(new URLSearchParams(window.location.search).get('case') || '').trim();
    return /^[A-Za-z0-9_-]{1,200}$/u.test(value) ? value : '';
  }

  function newIdempotencyKey() {
    const uuid = window.crypto?.randomUUID?.();
    if (typeof uuid === 'string' && uuid) return uuid;
    return `lor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  async function requestApi(path, { method = 'GET', csrfToken = '', body = null } = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const headers = { Accept: 'application/json' };
      if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        headers['X-MMHQ-CSRF'] = csrfToken;
        headers['Idempotency-Key'] = newIdempotencyKey();
      }
      const response = await window.fetch(path, {
        credentials: 'same-origin',
        headers,
        method,
        cache: 'no-store',
        signal: controller.signal,
        ...(body === null ? {} : { body: JSON.stringify(body) }),
      });
      return { response, payload: await readJsonSafe(response) };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  /**
   * One request, one outcome object, never a thrown error.
   *
   * The projection UI has no network API of its own and cannot inspect a Response; it reasons
   * about `{ reached, status, body }` and nothing else. Collapsing every transport failure into
   * `reached: false` is what lets it say "MissionMed was not reached, so nothing was stored"
   * without ever seeing an exception, a URL or a reason code.
   */
  async function commandRequest(path, options) {
    try {
      const { response, payload } = await requestApi(path, options);
      return { reached: true, status: Number(response.status), body: payload };
    } catch (error) {
      return { reached: false, status: 0, body: null, timedOut: error?.name === 'AbortError' };
    }
  }

  /**
   * A download filename is server-supplied text. It is reduced to a bounded, separator-free name
   * before it is ever used as `a.download`, so a hostile or malformed Content-Disposition cannot
   * steer where the browser writes.
   */
  function safeDownloadName(value) {
    const raw = String(value || '').split(/[\\/]/u).pop() || '';
    const cleaned = raw.replace(/[^A-Za-z0-9._-]/gu, '_').replace(/^[._]+/u, '').slice(0, 120);
    return cleaned || EXPORT_FILENAME_FALLBACK;
  }

  function filenameFromResponse(response) {
    const disposition = String(response?.headers?.get?.('content-disposition') || '');
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/iu);
    if (encoded) {
      try {
        return safeDownloadName(decodeURIComponent(encoded[1].trim()));
      } catch {
        /* fall through to the quoted form */
      }
    }
    const quoted = disposition.match(/filename="([^"]*)"/iu);
    return safeDownloadName(quoted ? quoted[1] : EXPORT_FILENAME_FALLBACK);
  }

  /** Hand the bytes to the browser as a file. Returns whether the handoff actually happened. */
  function startDownload(blob, filename) {
    const urlApi = window.URL || window.webkitURL;
    if (!blob || !urlApi || typeof urlApi.createObjectURL !== 'function') return false;
    const href = urlApi.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.hidden = true;
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } catch {
      anchor.remove();
      urlApi.revokeObjectURL?.(href);
      return false;
    }
    anchor.remove();
    window.setTimeout(() => urlApi.revokeObjectURL?.(href), 30_000);
    return true;
  }

  /**
   * The final-document export.
   *
   * GET with an empty query string, by contract: the route rejects any query parameter precisely
   * so that `?privacyGrant=`, `?privacyClass=` or `?actor=` can never become inputs. Nothing is
   * constructed client side except the case path; purpose, destination, privacy class, entitlement
   * and release state are all resolved server side from the stored case.
   */
  async function exportFinalDocument(caseId) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await window.fetch(
        `/api/lor-studio/cases/${encodeURIComponent(caseId)}/final-document/export`,
        {
          credentials: 'same-origin',
          headers: { Accept: 'application/octet-stream' },
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const status = Number(response.status);
      if (status !== 200) {
        return { reached: true, status, body: await readJsonSafe(response), downloadStarted: false };
      }
      const blob = typeof response.blob === 'function' ? await response.blob() : null;
      return {
        reached: true,
        status,
        body: null,
        downloadStarted: startDownload(blob, filenameFromResponse(response)),
      };
    } catch (error) {
      return { reached: false, status: 0, body: null, timedOut: error?.name === 'AbortError' };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function casePath(caseId) {
    return `/api/lor-studio/cases/${encodeURIComponent(caseId)}`;
  }

  /**
   * The write transport handed to the projection UI.
   *
   * Every command is bound to the one case this page was authorized for: a request naming any
   * other case is refused here rather than sent. That is defence in depth, not the boundary - the
   * server re-authorizes the actor against the case on every route - but it means a bug in the
   * renderer cannot turn into a cross-case request.
   *
   * Two things are deliberately absent. There is no command that asserts a release timestamp, and
   * no command that carries a grant, a purpose or a privacy class: those are server-minted, and a
   * field for them here would be the first step to a client that decides them.
   */
  function buildCommands() {
    const bound = (caseId) => (String(caseId ?? '') === activeCaseId && activeCaseId !== '' ? activeCaseId : null);
    const refused = { reached: false, status: 0, body: null };
    return {
      autosaveBuilderStep: async ({ caseId, expectedRevision, stepId, stepData }) => {
        const id = bound(caseId);
        if (!id) return refused;
        return commandRequest(`${casePath(id)}/builder`, {
          method: 'PATCH',
          csrfToken: activeCsrfToken,
          body: { expectedRevision, stepId, stepData },
        });
      },
      completeBuilderStep: async ({ caseId, expectedRevision, stepId }) => {
        const id = bound(caseId);
        if (!id) return refused;
        return commandRequest(`${casePath(id)}/builder/complete`, {
          method: 'POST',
          csrfToken: activeCsrfToken,
          body: { expectedRevision, stepId },
        });
      },
      recordReceipt: async ({ caseId, expectedRevision, receiptType, receiptData }) => {
        const id = bound(caseId);
        if (!id) return refused;
        return commandRequest(`${casePath(id)}/receipts`, {
          method: 'POST',
          csrfToken: activeCsrfToken,
          body: { expectedRevision, receiptType, receiptData },
        });
      },
      releaseFinalDocument: async ({ caseId, expectedRevision, documentId }) => {
        const id = bound(caseId);
        if (!id) return refused;
        // expectedRevision and documentId only. The aggregate mints releasedToStudentAt.
        return commandRequest(`${casePath(id)}/final-document/release`, {
          method: 'POST',
          csrfToken: activeCsrfToken,
          body: { expectedRevision, documentId },
        });
      },
      exportFinalDocument: async ({ caseId }) => {
        const id = bound(caseId);
        if (!id) return refused;
        return exportFinalDocument(id);
      },
      reloadCase: async ({ caseId }) => {
        const id = bound(caseId);
        if (!id) return refused;
        return commandRequest(casePath(id));
      },
    };
  }

  function attachCommands(ui) {
    if (!ui || typeof ui.attachCommands !== 'function') return false;
    try {
      ui.attachCommands(buildCommands());
      return true;
    } catch {
      // A UI that cannot take a transport stays exactly as capable as it was: read only.
      return false;
    }
  }

  function revealProductionRuntime() {
    root.dataset.lorRuntime = 'live';
    // Deliberately still `true`: only the production mount and the gate are exempt from the
    // inert sweep, so the frozen prototype markup underneath stays inert and aria-hidden even
    // once the real projection is on screen. Production shows the projection, nothing else.
    setUnderlyingState(true);
    if (gate) {
      gate.hidden = true;
      gate.style.display = 'none';
    }
    Object.assign(window, {
      __LOR_STUDIO_RUNTIME__: Object.freeze({ mode: 'live', operational: true }),
    });
  }

  async function blockHydration(ui, reason, detail) {
    try {
      await ui.block({ reasonCode: 'HYDRATION_BLOCKED', revealPrototype: false });
    } catch {
      /* the gate below is the authoritative closure; a failing UI must not open anything */
    }
    Object.assign(window, {
      __LOR_STUDIO_RUNTIME__: Object.freeze({ mode: 'blocked_unhydrated', operational: false }),
    });
    showState({
      heading: 'LOR Studio could not load your case',
      detail,
      reason,
      retry: true,
    });
  }

  async function renderProjection(ui, projection, caseId) {
    // Bind the transport to this case BEFORE the surface that can use it exists, so there is never
    // a moment where a control is on screen and the command layer is pointed somewhere else.
    activeCaseId = String(caseId);
    attachCommands(ui);
    try {
      await ui.renderProductionProjection(projection, {
        runtimeMode: 'live',
        caseId,
        actorRole: projectionActorRole(projection),
        projectionSchema: projection.schemaVersion,
        revealPrototype: false,
        persistToLocalStorage: false,
      });
    } catch {
      await blockHydration(
        ui,
        'projection_render_failed',
        'The authorized case projection could not be presented. Nothing was changed.',
      );
      return false;
    }
    revealProductionRuntime();
    return true;
  }

  async function loadAndRenderCase(ui, caseId) {
    let result;
    try {
      result = await requestApi(`/api/lor-studio/cases/${encodeURIComponent(caseId)}`);
    } catch (error) {
      await blockHydration(
        ui,
        error?.name === 'AbortError' ? 'projection_timeout' : 'projection_unreachable',
        'We could not reach your recommendation case. No draft or account data was changed.',
      );
      return;
    }
    const projection = result.response.ok ? acceptProjection(result.payload, caseId) : null;
    if (!projection) {
      await blockHydration(
        ui,
        String(result.payload?.error || `projection_http_${result.response.status}`),
        'The authorized case projection was unavailable or did not match this case. Access remains closed.',
      );
      return;
    }
    await renderProjection(ui, projection, caseId);
  }

  async function startProductionCase(ui, csrfToken) {
    let result;
    try {
      result = await requestApi('/api/lor-studio/cases', { method: 'POST', csrfToken, body: {} });
    } catch (error) {
      await blockHydration(
        ui,
        error?.name === 'AbortError' ? 'case_create_timeout' : 'case_create_unreachable',
        'We could not start a recommendation case. Nothing was created.',
      );
      return;
    }
    const caseId = result.response.ok ? String(result.payload?.case?.caseId || '') : '';
    const projection = caseId ? acceptProjection(result.payload, caseId) : null;
    if (!projection) {
      await blockHydration(
        ui,
        String(result.payload?.error || `case_create_http_${result.response.status}`),
        'The recommendation case could not be started. Access remains closed.',
      );
      return;
    }
    try {
      const next = new URL(window.location.href);
      next.searchParams.set('case', caseId);
      window.history?.replaceState?.(null, '', next.toString());
    } catch {
      /* deep-linking is a convenience; hydration does not depend on it */
    }
    await renderProjection(ui, projection, caseId);
  }

  /**
   * The live path. The server has already proven session freshness, entitlement, kill switch and
   * durable-runtime readiness before it will report operational===true; this reads the
   * authoritative projection and hands it to the isolated production UI. It never touches the
   * quarantined prototype and never publishes the CSRF token onto the runtime global.
   */
  async function hydrateProductionRuntime(bootstrap) {
    if (
      bootstrap?.storageMode !== 'durable'
      || bootstrap?.providersReady !== true
      || bootstrap?.fixtureBacked === true
    ) {
      blockUnhydratedLiveRuntime();
      return;
    }

    const ui = resolveProductionProjectionUi();
    if (!ui) {
      blockUnhydratedLiveRuntime();
      return;
    }

    // Held in the adapter closure, never published on the runtime global and never handed to the
    // projection UI: the renderer issues no requests, so it has no use for a CSRF token and is
    // therefore never given one to leak.
    activeCsrfToken = String(bootstrap?.csrfToken || '');

    try {
      await ui.block({ reasonCode: 'HYDRATION_PENDING', revealPrototype: false });
    } catch {
      blockUnhydratedLiveRuntime();
      return;
    }

    const caseId = requestedCaseId();
    if (caseId) {
      await loadAndRenderCase(ui, caseId);
      return;
    }

    showState({
      heading: 'Start your recommendation case',
      detail: 'You are signed in and entitled. Open an existing case link, or start a new case to continue.',
      reason: 'case_not_selected',
    });
    if (activeCsrfToken) {
      addAction('Start a recommendation case', () => { void startProductionCase(ui, activeCsrfToken); });
    }
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
        await hydrateProductionRuntime(payload);
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
    /** @type {HTMLElement | null} */
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
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (trigger instanceof HTMLElement && !modal.contains(trigger) && !modal.classList.contains('open')) {
        returnFocus = trigger;
      }
    }, true);

    modal.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || !modal.classList.contains('open')) return;
      const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element instanceof HTMLElement)
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
        if (first instanceof HTMLElement) first.focus();
        else modal.focus();
      }
      if (!isOpen && wasOpen && returnFocus?.isConnected) {
        queueMicrotask(() => returnFocus?.focus());
      }
      wasOpen = isOpen;
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (wasOpen) labelDialog();
  }

  setUnderlyingState(true);
  if (isLocalFixture) {
    if (activateFrozenFixtureRuntime()) {
      installDialogAccessibility();
      revealFixture();
    } else {
      showState({
        heading: 'The fidelity fixture could not start',
        detail: 'The frozen local-only presentation remained blocked and no application data was loaded.',
        reason: 'fidelity_runtime_invalid',
      });
    }
  } else {
    installDialogAccessibility();
    checkRuntime();
  }
})();
