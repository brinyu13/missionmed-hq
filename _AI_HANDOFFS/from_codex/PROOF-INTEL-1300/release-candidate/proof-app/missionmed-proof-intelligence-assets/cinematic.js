/* Genuine scroll-linked, compositor-transform parallax. No fixed-background substitute. */
(() => {
  const host = document.querySelector('#theme-sections');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let panels = [], geometry = [], pending = 0, measureNeeded = true, focusUntil = 0;
  const speed = .18;
  function schedule(measure = false) {
    measureNeeded ||= measure;
    if (!pending) pending = requestAnimationFrame(render);
  }
  function render(now) {
    pending = 0;
    const scroll = scrollY, viewport = innerHeight;
    if (measureNeeded) {
      // Read geometry as a batch. Transform writes never change document flow.
      geometry = panels.filter(p => p.details.open).map(p => {
        const rect = p.film.getBoundingClientRect();
        return {...p, top: rect.top + scroll, height: rect.height,
          bleed: Math.ceil((rect.height + viewport) * speed / 2) + 4};
      });
      geometry.forEach(p => {
        p.photo.style.top = `${-p.bleed}px`;
        p.photo.style.bottom = `${-p.bleed}px`;
      });
      measureNeeded = false;
    }
    let closest = null, distance = Infinity;
    for (const p of geometry) {
      const top = p.top - scroll;
      const visible = top < viewport && top + p.height > 0;
      p.photo.style.willChange = visible && !motion.matches ? 'transform' : 'auto';
      if (visible || motion.matches) {
        const offset = motion.matches ? 0 : Math.max(-p.bleed, Math.min(p.bleed,
          (viewport / 2 - top - p.height / 2) * speed));
        p.photo.style.transform = `translate3d(0,${offset.toFixed(2)}px,0)`;
      }
      if (visible && top + p.height > 240) {
        const d = Math.abs(top - Math.min(300, viewport * .35));
        if (d < distance) { closest = p; distance = d; }
      }
    }
    if (closest && now > focusUntil) setTheme(closest.index);
  }
  function mount() {
    const sections = [...host.querySelectorAll('.fold-section')];
    if (!sections.length) return false;
    panels = sections.map((section, index) => {
      const details = section.querySelector('details');
      const summary = details.querySelector('summary');
      const film = document.createElement('div'); film.className = 'f-film';
      const photo = document.createElement('div'); photo.className = 'f-photo';
      photo.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div'); content.className = 'f-film-content';
      [...details.children].filter(el => el !== summary).forEach(el => content.append(el));
      film.append(photo, content); details.append(film);
      const panel = {section, details, film, photo, index};
      let wasOpen = details.open;
      details.addEventListener('toggle', () => {
        // Initial open-state events must not select the last accordion.
        if (details.open && !wasOpen) { setTheme(index); focusUntil = performance.now() + 900; }
        else if (!details.open) {
          details.querySelectorAll('video').forEach(video => video.pause());
          photo.style.transform = 'translate3d(0,0,0)'; photo.style.willChange = 'auto';
        }
        wasOpen = details.open;
        schedule(true);
      });
      return panel;
    });
    const observer = new ResizeObserver(() => schedule(true));
    observer.observe(document.body);
    panels.forEach(p => observer.observe(p.film));
    addEventListener('scroll', () => schedule(), {passive:true});
    addEventListener('resize', () => schedule(true), {passive:true});
    document.addEventListener('click', event => {
      if (event.target.closest('[data-jump]')) focusUntil = performance.now() + 900;
    });
    motion.addEventListener('change', () => schedule(true));
    document.fonts.ready.then(() => schedule(true));
    schedule(true);
    return true;
  }
  if (!mount()) {
    const ready = new MutationObserver(() => { if (mount()) ready.disconnect(); });
    ready.observe(host, {childList:true});
  }
})();
/* Founder photo uses scroll-linked transforms; original accordion engine above is unchanged. */
(() => {
  const hero = document.querySelector('#top');
  const photo = hero?.querySelector('.proof-hero-photo');
  const navigation = document.querySelector('.proof-secondary');
  if (!photo || !navigation) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = 0;
  function schedule() { if (!pending) pending = requestAnimationFrame(draw); }
  function draw() {
    pending = 0;
    const rect = hero.getBoundingClientRect();
    const bleed = Math.ceil((rect.height + innerHeight) * .18 / 2) + 4;
    const visible = rect.top < innerHeight && rect.bottom > 0;
    const offset = motion.matches ? 0 : Math.max(-bleed, Math.min(bleed, (innerHeight / 2 - rect.top - rect.height / 2) * .18));
    photo.style.top = `${-bleed}px`;
    photo.style.bottom = `${-bleed}px`;
    photo.style.willChange = visible && !motion.matches ? 'transform' : 'auto';
    if (visible || motion.matches) photo.style.transform = `translate3d(0,${offset.toFixed(2)}px,0)`;
  }
  function layout() {
    const root = document.querySelector('#mm-l5-header');
    const header = root?.querySelector('header');
    const height = header?.getBoundingClientRect().height || 0;
    const position = header ? getComputedStyle(header).position : '';
    document.documentElement.style.setProperty('--proof-global-offset', ['fixed', 'sticky'].includes(position) ? `${height}px` : '0px');
    document.documentElement.style.setProperty('--proof-global-reserve', root && root.getBoundingClientRect().height < 1 ? `${height}px` : '0px');
    document.documentElement.style.setProperty('--proof-secondary-height', `${navigation.getBoundingClientRect().height}px`);
    const menu = root?.querySelector('.mm-proof-mobile-nav summary');
    const menuShift = menu ? Math.max(0, 14 - (menu.getBoundingClientRect().right - Math.min(260, innerWidth - 28))) : 0;
    document.documentElement.style.setProperty('--proof-mobile-menu-shift', `${menuShift}px`);
    schedule();
  }
  const resize = new ResizeObserver(layout);
  resize.observe(hero); resize.observe(navigation);
  function headerReady() {
    const header = document.querySelector('#mm-l5-header header');
    if (!header) return false;
    resize.observe(header); layout(); return true;
  }
  if (!headerReady()) {
    const ready = new MutationObserver(() => { if (headerReady()) ready.disconnect(); });
    ready.observe(document.body, {childList:true});
  }
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', layout, {passive:true});
  motion.addEventListener('change', schedule);
  document.fonts.ready.then(layout);
  layout();
})();
