/* Dedicated IR discovery only. DR-375/376. No shared renderer or routing changes. */
(() => {
  'use strict';
  if (location.pathname !== '/member-dashboard/') return;
  const key = Symbol.for('missionmed.interview-ready.discovery.v1');
  if (window[key]) return;
  const marker = 'data-mmed-ir-matrix-entry';
  let observer = null, frame = null, active = false;
  const makeLink = () => {
    const link = document.createElement('a');
    link.setAttribute(marker, 'v1');
    link.href = '/interview-ready/app/';
    link.textContent = 'Interview Ready';
    // An ordinary anchor: destination WP session enforces access.
    return link;
  };
  function reconcile() {
    frame = null;
    if (!active || !document.body) return;
    const label = [...document.querySelectorAll('.sos-nav-label')]
      .find(node => node.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'MATCH TOOLS');
    const list = label?.closest('.sos-nav-section')?.querySelector('.sos-nav-list');
    const own = [...document.querySelectorAll('[' + marker + ']')];
    if (list) {
      const existing = own.find(node => node.parentElement === list);
      own.filter(node => node !== existing).forEach(node => node.remove());
      if (!existing) {
        const link = makeLink();
        link.className = 'mmed-ir-matrix-link';
        list.appendChild(link);
      }
    } else if (!own.some(node => node.id === 'mmed-ir-matrix-fallback')) {
      own.forEach(node => node.remove());
      const link = makeLink();
      link.id = 'mmed-ir-matrix-fallback';
      link.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:50;padding:10px 16px;border:1px solid #b99a58;border-radius:6px;background:#fffaf0;color:#142338;font:600 14px Georgia,serif;text-decoration:underline;box-shadow:0 2px 10px #14233822';
      document.body.appendChild(link);
    }
  }
  function schedule() {
    if (active && frame === null) frame = requestAnimationFrame(reconcile);
  }
  function stop() {
    active = false;
    observer?.disconnect(); observer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    document.removeEventListener('DOMContentLoaded', start);
    window.removeEventListener('pagehide', stop);
    // One pageshow listener survives solely to resume after BFCache restoration.
  }
  function start() {
    stop();
    window.removeEventListener('pageshow', start);
    window.addEventListener('pageshow', start, {once: true});
    window.addEventListener('pagehide', stop, {once: true});
    active = true;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', start, {once: true});
      return;
    }
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {childList: true, subtree: true});
    schedule();
  }
  window[key] = {start};
  start();
})();
