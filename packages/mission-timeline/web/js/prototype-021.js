/* D1-TIMELINE-ASTRA6-AAA-FINAL-021: local presentation over the preserved engine.
 * The semantic document, scene, intake, storage, Guardian, and export remain owned
 * by D1_407F_ENGINEERING. This module never creates an alternative document. */

const isLocal = () => typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const el = (selector) => document.querySelector(selector);
const text = (selector, value) => { const node = el(selector); if (node) node.textContent = value; };
const make = (tag, attributes = {}, content = '') => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.textContent = content;
  return node;
};

export function installPrototype021(api = window.D1_407F_ENGINEERING, bridge = api?.bridge, {family = false} = {}) {
  if ((!isLocal() && !family) || !api?.store || !bridge?.go) return null;
  if (window.D1_PROTOTYPE_021) return window.D1_PROTOTYPE_021;
  const home = el('section[data-view="command"]');
  const homeActions = el('.homeActions');
  if (!home || !homeActions) return null;

  document.body.classList.add('prototype021');
  const syntheticAI = isLocal() && new URLSearchParams(location.search).get('ai') === 'synthetic';
  document.title = family ? 'Timeline Builder · MissionMed' : 'Timeline Builder · Local Founder Prototype';
  if (!el('link[data-prototype-021]')) {
    const stylesheet = make('link', {rel: 'stylesheet', href: new URL('../styles/prototype-021.css', import.meta.url).href, 'data-prototype-021': ''});
    document.head.append(stylesheet);
  }

  text('.brandLong', 'Timeline Builder');
  text('.brandShort', 'Timeline');
  text('.logoSub', 'MISSIONMED · MISSION RESIDENCY');
  text('.homeMicro', 'YOUR CHRONOLOGY, CLEARLY TOLD');
  const heading = el('#homeTitle');
  heading.replaceChildren(document.createTextNode('Your journey.'), make('br'), make('em', {}, 'Interview ready.'));
  text('.homeSubline', 'Start with your CV. Verify what matters. Your Timeline takes shape as you go.');
  text('#homeTimelineTitle', 'Your Timeline');
  text('#homeCanvasLink span', 'Open Advanced Studio');
  text('#homeEmptyOverlay h3', 'Your Founder template is ready.');
  text('#homeEmptyOverlay p', 'Your verified experiences will fill this board. The design is already here.');
  el('#homeEmptyOverlay .btnD')?.remove();

  // Move existing nodes: their IDs, consent machinery, and installed listeners survive.
  const cv = el('#homeIntake');
  cv.className = 'btnD go prototype021Primary';
  cv.textContent = 'Build from my CV';
  cv.setAttribute('aria-label', 'Build my Timeline from a CV');
  homeActions.prepend(cv);
  const continueButton = el('#homeBuild');
  continueButton.className = 'prototype021Continue';
  text('.homeJourneyStrip', '1  Read your CV     →     2  Verify your history     →     3  Make it interview ready');
  el('.homeJourneyStrip')?.setAttribute('aria-label', 'Read your CV, verify your history, make it interview ready');

  const intakePanel = el('.homeIntakeRegion .pi');
  text('#homeIntakeTitle', 'A different starting point?');
  text('.homeIntakeRegion .homeMicro', 'PICK UP WHERE YOU ARE');
  text('.homeIntakeRegion .homeBody', 'Bring a saved document or an existing Timeline. Keep the work you have already done.');
  text('#homeFileVault', 'Choose from File Vault');
  el('#homeFileVault')?.classList.remove('go');
  el('#homeFileVault')?.classList.add('alt');
  text('.homeAssurance', 'Review and approve extracted facts before adding them to your Timeline.');
  el('.homeSourceDivider')?.remove();

  const rescueRoute = make('section', {'data-view': 'rescue', 'class': 'prototype021RescuePage', 'aria-labelledby': 'prototype021RescueTitle'});
  rescueRoute.innerHTML = '<div class="prototype021PageIntro"><p class="prototype021Eyebrow">TIMELINE RESCUE</p><h1 id="prototype021RescueTitle">Keep the work you have already done.</h1><p>Bring your existing Timeline into an editable MissionMed workspace. Review its history and resolve conflicts before accepting a rebuilt version.</p></div><div class="prototype021RescueGrid"><div class="panelD prototype021RescueUpload"><h2>I already have a Timeline</h2><p>Start with PowerPoint, PDF, PNG or JPEG. Your original stays intact. Photos, notes and original object positions are not restored; add photos or notes in Advanced Studio after rebuilding.</p><div data-prototype-rescue-control></div><p class="prototype021Boundary">Reconstruction requires the MissionMed server. This local prototype can open your file and explain the next step; it does not claim a completed reconstruction.</p></div><div class="panelD prototype021RescueSteps"><h2>A reviewable recovery</h2><ol><li><strong>Read the original</strong><span>Read event details and dates from your Timeline for review.</span></li><li><strong>Check the history</strong><span>Check recovered details against your source documents and resolve uncertainty.</span></li><li><strong>Rebuild and review</strong><span>Preview accepted facts in the MissionMed layout, then run Quality Guardian before exporting.</span></li></ol><details><summary>Using a Keynote file?</summary><p>In Keynote choose File → Export To → PowerPoint. Upload the exported .pptx. You can also export a PDF. Native .key files cannot be read directly. Keep the original for continued editing; Rescue does not restore photos, notes or original positions.</p></details></div></div>';
  if(family)rescueRoute.querySelector('.prototype021Boundary').textContent='Review recovered history and any conflicts before rebuilding. Your original file stays intact.';
  if(syntheticAI)rescueRoute.querySelector('.prototype021Boundary').textContent='Synthetic review accepts only registered test fixtures. After consent, Rescue sends the registered source content to the approved AI provider. Reconstruction remains reviewable before any facts enter your local draft.';
  el('main').append(rescueRoute);
  const originalRescue = el('#homeRescue');
  rescueRoute.querySelector('[data-prototype-rescue-control]').append(originalRescue);
  originalRescue.setAttribute('role', 'button');
  originalRescue.setAttribute('tabindex', '0');
  originalRescue.setAttribute('aria-label', 'Upload my existing Timeline');
  originalRescue.querySelector('strong').textContent = 'Upload my existing Timeline';
  originalRescue.querySelector('small').textContent = 'PowerPoint · PDF · PNG · JPEG';
  originalRescue.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    originalRescue.querySelector('input[type="file"]')?.click();
  });
  const rescueHome = make('button', {type: 'button', class: 'prototype021RescueLink'}, 'I Already Have a Timeline');
  rescueHome.addEventListener('click', () => bridge.go('rescue'));
  el('#homeFileVault').after(rescueHome);

  // Existing navigation stays bound to the same router. Guardian remains its
  // existing modal, including factual review and undoable fixes.
  const rail = el('#rail');
  const labels = {command: 'Overview', builder: 'Build', canvas: 'Advanced Studio', media: 'Media library', export: 'Export'};
  for (const button of rail.querySelectorAll('[data-v]')) button.textContent = labels[button.dataset.v] || button.textContent;
  for(const button of [rail.querySelector('[data-v="canvas"]'),el('#homeCanvasLink')]){
    button?.addEventListener('click',(event)=>{
      if(!api.openAdvancedStudio)return;
      event.preventDefault();event.stopImmediatePropagation();api.openAdvancedStudio();
    },true);
  }
  const guardian = make('button', {type: 'button', class: 'rtab', 'data-quality-guardian-open': 'true', 'data-prototype-guardian': ''}, 'Guardian');
  rail.querySelector('[data-v="export"]').before(guardian);
  const rescueNav = make('button', {type: 'button', class: 'rtab', 'data-v': 'rescue'}, 'Rescue');
  rescueNav.addEventListener('click', () => bridge.go('rescue'));
  rail.querySelector('[data-v="export"]').after(rescueNav);
  rail.append(rail.querySelector('[data-v="media"]'));
  if (!family) {
  const railFoot = make('div', {class: 'prototype021RailFoot'});
  railFoot.innerHTML = '<span class="prototype021StatusDot" aria-hidden="true"></span><strong>Local prototype</strong><p>Saved on this device.<br>Use synthetic documents for review.</p>';
  if(syntheticAI){
    railFoot.querySelector('strong').textContent='Synthetic AI review';
    railFoot.querySelector('p').textContent='Registered test fixtures only. Extracted text goes to the approved AI provider after consent and Read. Drafts stay local.';
    el('main').prepend(make('p',{class:'prototype021ProviderNotice',role:'note'},'Synthetic AI review · Registered test fixtures only. After consent, Read sends extracted text to the approved AI provider. Your draft stays local.'));
  }
  rail.append(railFoot);

  const status = make('div', {class: 'prototype021Status', role: 'note'}, syntheticAI?'SYNTHETIC AI REVIEW · LOCAL DRAFT':'LOCAL PROTOTYPE · DEVICE ONLY');
  el('.brandBlock').after(status);
  const lens = make('label', {class: 'prototype021Lens'});
  lens.innerHTML = '<span>Preview as</span><select aria-label="Local presentation lens"><option value="student">Student</option><option value="founder">Founder / Admin</option></select>';
  el('.d1404Header .headerSpacer').after(lens);
  const lensNotice = make('div', {class: 'prototype021LensNotice', role: 'status', hidden: ''}, 'Founder / Admin presentation preview · Working on this local document. Account permissions are unchanged.');
  el('main').prepend(lensNotice);
  lens.querySelector('select').addEventListener('change', (event) => {
    const founder = event.target.value === 'founder';
    document.body.dataset.prototypeLens = founder ? 'founder' : 'student';
    lensNotice.hidden = !founder;
    document.body.classList.toggle('prototype021FounderLens', founder);
  });

  }

  const builder = el('section[data-view="builder"]');
  const buildIntro = make('div', {class: 'prototype021BuildIntro'});
  buildIntro.innerHTML = '<div><p class="prototype021Eyebrow">VERIFY, THEN REFINE</p><h1>Build your Timeline</h1><p>Your accepted CV facts live here. Review uncertainty and fill the genuine blanks.</p></div>';
  const buildCV = make('button', {type: 'button', class: 'btnD alt', 'data-nav': 'intake'}, 'Read a CV');
  buildIntro.append(buildCV);
  builder.prepend(buildIntro);
  const specialty = el('#builderVariantBar');
  const specialtyDetails = make('details', {class: 'prototype021SpecialtyDetails'});
  specialtyDetails.append(make('summary', {}, 'Specialty versions and presentation settings'));
  specialty.before(specialtyDetails);
  specialtyDetails.append(specialty);

  // Watch the existing render lifecycle, not every DOM mutation. The renderer
  // owns the board and may replace only the content inside its current host.
  function refresh() {
    const current = bridge.state?.view || 'command';
    document.body.dataset.prototypeView = current;
    const count = Array.isArray(api.store.document?.events) ? api.store.document.events.length : 0;
    continueButton.textContent = 'Continue my Timeline';
    continueButton.hidden = count === 0;
    el('#homeCompletion407F')?.classList.toggle('prototype021HasProgress', count > 0);
    const completionAction = el('#homeCompletion407F [data-home-resume-builder]');
    if (completionAction) completionAction.className = 'homeTertiary';
    text('#homeCanvasLink span', 'Open Advanced Studio');
    text('#homeEmptyOverlay h3', 'Your Founder template is ready.');
    text('#homeEmptyOverlay p', 'Your verified experiences will fill this board. The design is already here.');
    const live = el('section[data-view].live');
    if (live) live.dataset.prototypeSurface = current;
    rail.querySelector('[data-v="builder"]')?.classList.toggle('on', ['builder', 'intake'].includes(current));
    if (['builder', 'intake'].includes(current)) rail.querySelector('[data-v="builder"]')?.setAttribute('aria-current', 'page');
  }
  document.addEventListener('d1:407f-rendered', refresh);
  refresh();
  const controller = Object.freeze({version: '021.1', api, bridge, refresh, openRescue: () => bridge.go('rescue'), openCV: () => bridge.go('intake')});
  window.D1_PROTOTYPE_021 = controller;
  document.dispatchEvent(new CustomEvent('d1:prototype-021-ready'));
  return controller;
}

if (isLocal() && new URLSearchParams(location.search).get('prototype') === '021') {
  if (window.D1_407F_ENGINEERING) installPrototype021();
  else document.addEventListener('d1:407f-engineering-ready', () => installPrototype021(), {once: true});
}
