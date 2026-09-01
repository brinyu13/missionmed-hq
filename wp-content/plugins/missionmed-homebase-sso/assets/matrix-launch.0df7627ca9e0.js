(() => {
  'use strict';

  const settings = window.MissionMedHomeBaseLaunch || {};
  let target;
  try {
    target = new URL(String(settings.target || ''), window.location.origin);
  } catch {
    return;
  }
  if (target.origin !== window.location.origin || !target.pathname.startsWith('/homebase/')) {
    return;
  }

  const matrixPath = String(settings.matrixPath || '/member-dashboard/').replace(/\/+$/, '') || '/';
  const onMatrix = () => window.location.pathname.replace(/\/+$/, '') === matrixPath;
  const homeBaseControl = (node) => {
    if (!(node instanceof Element)) return null;
    return node.closest('a[href="#homebase"], [data-route="homebase"]');
  };
  const launch = (replace = false) => {
    if (replace) window.location.replace(target.href);
    else window.location.assign(target.href);
  };

  const ensureMatrixEntry = () => {
    if (!onMatrix()) return false;
    if (document.querySelector('a[href="#homebase"], [data-route="homebase"]')) return true;
    const nextControl = document.querySelector('.sos-nav-list > li > a[href="#arena"]');
    const nextRow = nextControl?.closest('li');
    if (!nextControl || !nextRow?.parentElement) return false;

    const row = document.createElement('li');
    const link = document.createElement('a');
    const icon = document.createElement('span');
    const label = document.createElement('span');
    link.className = nextControl.className;
    link.href = '#homebase';
    link.setAttribute('aria-label', 'HomeBase');
    icon.className = nextControl.querySelector('span')?.className || 'sos-nav-icon';
    icon.textContent = 'HB';
    label.textContent = 'HomeBase';
    link.append(icon, label);
    row.append(link);
    nextRow.insertAdjacentElement('beforebegin', row);
    return true;
  };

  document.addEventListener('click', (event) => {
    if (!onMatrix() || !homeBaseControl(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    launch(false);
  }, true);

  const launchDirectHash = () => {
    if (onMatrix() && window.location.hash.toLowerCase() === '#homebase') {
      launch(true);
    }
  };
  window.addEventListener('hashchange', launchDirectHash);
  let observer;
  const renderMatrixEntry = () => {
    if (ensureMatrixEntry()) observer?.disconnect();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMatrixEntry, { once: true });
  }
  observer = new MutationObserver(renderMatrixEntry);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  renderMatrixEntry();
  launchDirectHash();
})();
