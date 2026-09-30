/* MissionMed Homepage Division Showcase V1: bounded image depth, no scroll hijack. */
(() => {
  'use strict';
  const root = document.getElementById('mm-three-divisions');
  if (!root) return;
  const scenes = [...root.querySelectorAll('.mm-dv__scene')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 767px)');
  const load = (image) => {
    if (!image || !image.dataset.src) return;
    if (image.dataset.srcset) image.srcset = image.dataset.srcset;
    image.src = image.dataset.src;
    delete image.dataset.src;
    delete image.dataset.srcset;
  };
  if ('IntersectionObserver' in window) {
    const images = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) if (entry.isIntersecting) {
        load(entry.target);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '400px 0px' });
    root.querySelectorAll('img[data-src]').forEach(image => images.observe(image));
  } else root.querySelectorAll('img[data-src]').forEach(load);
  let pending = false;
  const paint = () => {
    pending = false;
    if (reduced.matches) {
      scenes.forEach(scene => {
        scene.style.setProperty('--mm-dv-shift', '0px');
        scene.style.setProperty('--mm-dv-glow', '0px');
      });
      return;
    }
    const viewport = innerHeight;
    for (const scene of scenes) {
      const box = scene.getBoundingClientRect();
      if (box.bottom < -100 || box.top > viewport + 100) continue;
      const distance = box.top + box.height / 2 - viewport / 2;
      const maximum = mobile.matches ? 14 : 82;
      const shift = Math.max(-maximum, Math.min(maximum, -distance * (mobile.matches ? .045 : .16)));
      scene.style.setProperty('--mm-dv-shift', `${shift.toFixed(2)}px`);
      scene.style.setProperty('--mm-dv-glow', `${(shift * -.52).toFixed(2)}px`);
    }
  };
  const requestPaint = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(paint);
  };
  addEventListener('scroll', requestPaint, { passive: true });
  addEventListener('resize', requestPaint, { passive: true });
  reduced.addEventListener?.('change', requestPaint);
  mobile.addEventListener?.('change', requestPaint);
  requestPaint();
})();
