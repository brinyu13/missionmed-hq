/* MR coaching coupon interaction only. No Hero, commerce or provider mutation. */
(() => {
  'use strict';
  const section = document.querySelector('#private-coaching');
  const button = section?.querySelector('[data-coaching-copy]');
  const code = section?.querySelector('[data-coaching-code]');
  const status = section?.querySelector('[data-coaching-copy-status]');
  if (!button || !code || !status) return;
  button.addEventListener('click', async () => {
    const value = code.textContent.trim();
    if (value !== 'MATCHREADY2026' || button.disabled) return;
    button.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(value);
      status.textContent = 'Code copied. Your checkout will show the applicable discount.';
    } catch (_) {
      status.textContent = 'Select and copy MATCHREADY2026 above. You can also enter it at checkout.';
    } finally {
      button.disabled = false;
    }
  });
})();

/* Native, explicit three-versus-five choice. No purchase is selected for the student. */
(() => {
  'use strict';
  const section = document.querySelector('#private-coaching');
  const trigger = section?.querySelector('[data-coaching-choose]');
  const choices = section?.querySelector('#coaching-package-choices');
  if (!trigger || !choices || choices.tagName !== 'DETAILS') return;
  trigger.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    choices.open = true;
    choices.querySelector('summary')?.focus({preventScroll:true});
    // Native fragment navigation scrolls to the now-open choices, including keyboard activation.
  });
  const syncHash = () => { if (location.hash === '#coaching-package-choices') choices.open = true; };
  window.addEventListener('hashchange', syncHash);
  syncHash();
})();

/* Extend photo depth through the offering, never its text/buttons or the locked Hero.
 * The existing page Pause motion control remains the single user control. */
(() => {
  'use strict';
  const section = document.querySelector('#private-coaching');
  if (!section || !('IntersectionObserver' in window) || !('MutationObserver' in window)) return;
  const photos = [...section.querySelectorAll('[data-coaching-depth],.mm-coaching-mentor')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 1025px)');
  const root = document.documentElement;
  const visible = new Set();
  let frame = 0;
  const enabled = () => desktop.matches && !reduced.matches && !document.hidden
    && !root.classList.contains('mm-motion-paused');
  const paint = () => {
    frame = 0;
    if (!enabled()) return;
    const updates = [...visible].map(photo => {
      const bounds = photo.getBoundingClientRect();
      const distance = Math.max(-1, Math.min(1, (innerHeight / 2 - bounds.top - bounds.height / 2) / innerHeight));
      return [photo, (distance * (photo.classList.contains('mm-coaching-mentor') ? 9 : 22)).toFixed(2)];
    });
    updates.forEach(([photo, depth]) => photo.style.setProperty('--mm-coaching-depth', depth + 'px'));
  };
  const requestPaint = () => { if (!frame && enabled()) frame = requestAnimationFrame(paint); };
  const sync = () => {
    section.dataset.coachingMotion = enabled() ? 'active' : 'paused';
    if (!enabled()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      photos.forEach(photo => photo.style.setProperty('--mm-coaching-depth', '0px'));
    } else requestPaint();
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({target,isIntersecting}) => {
      if (isIntersecting) visible.add(target); else visible.delete(target);
    });
    requestPaint();
  }, {rootMargin:'60px', threshold:0});
  photos.forEach(photo => observer.observe(photo));
  new MutationObserver(sync).observe(root, {attributes:true,attributeFilter:['class']});
  reduced.addEventListener('change', sync);
  desktop.addEventListener('change', sync);
  window.addEventListener('scroll', requestPaint, {passive:true});
  window.addEventListener('resize', requestPaint, {passive:true});
  document.addEventListener('visibilitychange', sync);
  sync();
})();
