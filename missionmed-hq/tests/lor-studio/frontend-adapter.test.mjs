import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const adapterSource = await readFile(path.resolve(testDirectory, '..', '..', 'public', 'lor-studio', 'production-adapter.js'), 'utf8');
const shell = `<!doctype html><html data-lor-runtime="gated"><body>
  <section id="lorRuntimeGate" role="status" aria-live="polite" aria-busy="true">
    <h1 id="lorRuntimeGateTitle">Checking secure access</h1>
    <p id="lorRuntimeGateMessage"></p>
    <div id="lorRuntimeGateActions"></div>
    <p id="lorRuntimeGateCode"></p>
  </section>
  <button id="dialogTrigger" type="button">Open privacy notice</button>
  <div id="modal" role="dialog"><button id="dialogClose" type="button">Understood</button></div>
  <main id="prototype">Synthetic prototype</main>
</body></html>`;

async function runAdapter({ url = 'https://hq.example.test/lor-studio/', response = null } = {}) {
  const dom = new JSDOM(shell, { runScripts: 'outside-only', url });
  dom.window.fetch = async () => response || {
    ok: false,
    status: 503,
    json: async () => ({ error: 'lor_application_unavailable' }),
  };
  dom.window.eval(adapterSource);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return dom;
}

test('production adapter keeps the prototype gated when durable runtime is unavailable', async () => {
  const dom = await runAdapter();
  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'gated');
  assert.equal(document.getElementById('prototype').inert, true);
  assert.equal(document.getElementById('prototype').getAttribute('aria-hidden'), 'true');
  assert.equal(document.getElementById('lorRuntimeGateTitle').textContent, 'LOR Studio is not ready yet');
  assert.match(document.getElementById('lorRuntimeGateCode').textContent, /lor_application_unavailable/u);
  assert.equal(dom.window.__LOR_STUDIO_RUNTIME__, undefined);
});

test('authentication response offers the same-origin MissionMed login handoff', async () => {
  const dom = await runAdapter({
    response: {
      ok: false,
      status: 401,
      json: async () => ({ error: 'session_expired' }),
    },
  });
  const link = dom.window.document.querySelector('#lorRuntimeGateActions a');
  assert.equal(dom.window.document.getElementById('lorRuntimeGateTitle').textContent, 'Sign in to continue');
  assert.equal(link.getAttribute('href'), '/api/auth/start?final=%2Flor-studio%2F');
});

test('adapter keeps frozen presentation blocked even when backend reports live without an authorized hydration adapter', async () => {
  const dom = await runAdapter({
    response: {
      ok: true,
      status: 200,
      json: async () => ({
        operational: true,
        runtimeMode: 'live',
        storageMode: 'durable',
        providersReady: true,
        csrfToken: 'csrf-value',
        capabilities: { builder: true },
      }),
    },
  });
  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'gated');
  assert.equal(document.getElementById('lorRuntimeGate').hidden, false);
  assert.equal(document.getElementById('prototype').inert, true);
  assert.equal(document.getElementById('lorRuntimeGateTitle').textContent, 'LOR Studio is not yet available');
  assert.match(document.getElementById('lorRuntimeGateMessage').textContent, /no authorized production hydration adapter/u);
  assert.doesNotMatch(document.getElementById('lorRuntimeGateMessage').textContent, /undefined/u);
  assert.equal(document.getElementById('lorRuntimeGateCode').textContent, 'Reference: frontend_hydration_unavailable');
  assert.deepEqual({ ...dom.window.__LOR_STUDIO_RUNTIME__ }, {
    mode: 'blocked_unhydrated',
    operational: false,
  });
  assert.equal('csrfToken' in dom.window.__LOR_STUDIO_RUNTIME__, false);
});

test('local fidelity mode is visibly labeled synthetic and never marked operational', async () => {
  const dom = await runAdapter({ url: 'http://localhost/lor-studio/?fidelity=1' });
  const badge = dom.window.document.querySelector('.lor-fidelity-badge');
  assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'fixture');
  assert.match(badge.textContent, /Synthetic fidelity fixture/u);
  assert.equal(dom.window.__LOR_STUDIO_RUNTIME__.operational, false);
  assert.equal(dom.window.__LOR_STUDIO_RUNTIME__.mode, 'synthetic_fixture');
});

test('localhost does not bypass the gate unless fidelity mode is explicit', async () => {
  const dom = await runAdapter({ url: 'http://localhost/lor-studio/' });
  assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'gated');
  assert.equal(dom.window.document.querySelector('.lor-fidelity-badge'), null);
});

test('dialog adapter restores focus to the invoking control after close', async () => {
  const dom = await runAdapter({ url: 'http://localhost/lor-studio/?fidelity=1' });
  const trigger = dom.window.document.getElementById('dialogTrigger');
  const close = dom.window.document.getElementById('dialogClose');
  const modal = dom.window.document.getElementById('modal');
  trigger.focus();
  trigger.click();
  modal.classList.add('open');
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  close.focus();
  modal.classList.remove('open');
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(dom.window.document.activeElement, trigger);
});
