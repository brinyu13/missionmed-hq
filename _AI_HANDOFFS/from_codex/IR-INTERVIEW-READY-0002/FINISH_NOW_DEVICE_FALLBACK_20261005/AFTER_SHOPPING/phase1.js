/* Phase 1 boundaries around the accepted application. Future code and saved data stay intact. */
const phaseOneAllowed = new Set(PHASE1.enabledRoutes);
const phaseTwoTitles = {'in-person':'In-Person Essentials',dress:'Style Studio',wardrobe:'My Wardrobe',community:'Community Looks'};
const phaseTwoScenes = {'in-person':'travel-detail.webp',dress:'style-portrait.webp',wardrobe:'style-portrait.webp',community:'interview-portrait.webp'};
function dealEventState(now = new Date()) {
  const event = PHASE1.event, start = Date.parse(event.startsISO), end = Date.parse(event.endsISO), at = +now;
  if (!event.source || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(at) || end <= start) return 'evergreen';
  return at < start ? 'upcoming' : at < end ? 'active' : 'ended';
}
function phaseTwoMoment(id) {
  return `<div class="phase-two-moment" data-parallax><img class="intro-image" src="${assetFor(phaseTwoScenes[id])||ASSET['interview-portrait.webp']}" alt="Interview preparation editorial photograph"><div><span class="eyebrow">COMING IN PHASE 2</span><h1 tabindex="-1">${phaseTwoTitles[id]}</h1><p>The next chapter is taking shape. Start with the online gear guide, test what you already own, and prepare your interview checklist.</p><a class="btn gold" href="#online">Explore online gear →</a></div></div>`;
}
const productVisualBeforePhaseOne = productVisual;
productVisual = function(i,c) {
  if (PHASE1.assetProfile === 'production' && !i.image) {
    return `<figure class="product-visual"><div class="shopping-photo-fallback"><span aria-hidden="true">↗</span><p>${i.asin?'Product photo at the original source':'Use what you already own'}</p><small>Authorized live imagery is not available for this selection.</small></div>${i.asin?shoppingLink(i.source||amazonUrl(i),'View original product photos','photo-link'):''}</figure>`;
  }
  const visual = productVisualBeforePhaseOne(i,c), credit = i.imageCredit;
  if (!credit) return visual;
  return visual.replace('</figure>',`<figcaption class="image-credit">${esc(credit.caption)}<br>${external(credit.source,esc(credit.author))} · ${external(credit.licenseUrl,esc(credit.license))}<br>Resized${credit.changes.includes('cropped')?', cropped':''} photograph.</figcaption></figure>`);
};
const renderExpertsBeforePhaseOne = renderExperts;
renderExperts = function() {
  if (['Travel','Style'].includes(expertFilter)) expertFilter='All';
  renderExpertsBeforePhaseOne();
  document.querySelectorAll('[data-expert-filter="Travel"],[data-expert-filter="Style"]').forEach(button=>button.hidden=true);
  document.querySelectorAll('.expert-feature').forEach(feature=>{
    if (feature.querySelector('.eyebrow')?.textContent.startsWith('Travel')) feature.remove();
  });
};
function applyPhaseOneNavigation() {
  document.querySelectorAll('[data-nav]').forEach(link => { link.hidden = !phaseOneAllowed.has(link.dataset.nav); });
  document.querySelectorAll('[data-nav="prime-day"]').forEach(link => {
    const label = link.querySelector('span'); if (label) label.textContent = 'Deals Worth Watching'; else link.textContent = 'Deals Worth Watching';
  });
  document.querySelectorAll('.trust-tile[href="#dress"]').forEach(link => {
    link.href = '#checklist'; link.innerHTML = '<div><p>THE FINISHING DETAILS</p><b>Your readiness journey</b><p>A clear plan for interview day.</p></div>';
  });
  document.querySelectorAll('.tile[href^="#in-person"]').forEach(link => {
    link.querySelector('.cap span').textContent = 'Coming in Phase 2';
    link.setAttribute('aria-label',link.querySelector('.cap b').textContent + ' · coming in Phase 2');
  });
  const path = document.querySelector('.path[href="#in-person"]');
  if (path) { path.href='#experts'; path.querySelector('b').textContent='Expert Reviews'; path.querySelector(':scope > span').textContent='Hear the tests. Understand the tradeoffs.'; }
  document.querySelector('.feature-bottom div:last-child p').innerHTML='Consider the buyer feedback.<br>Fixed focus needs the right distance.';
  document.getElementById('modeInPerson').hidden = true;
}
renderPrimeDay = function() {
  const state = dealEventState(), event = PHASE1.event;
  const message = state==='upcoming' ? `${event.name} is coming ${event.displayDates}. Build a shortlist now; check actual offers on Amazon when the event begins.`
    : state==='active' ? `${event.name} is underway through October 7. These are our interview shortlists, not a claim that every item is discounted. Check each current offer on Amazon.`
    : 'Shop deliberately. Compare the exact model and complete setup; current prices, stock and return terms are available on Amazon.';
  const picks = CATALOG.online.filter(c=>['webcam','mic','light','accessories'].includes(c.id)).map(c=>[c,c.items.find(i=>i.t===c.pick&&i.asin)||c.items.find(i=>i.asin)]);
  const host = document.getElementById('primeday');
  host.innerHTML = `<section class="event-note paper"><span class="eyebrow">${state==='upcoming'?'MARK YOUR CALENDAR':state==='active'?'SHOP WITH A PLAN':'DEALS WORTH WATCHING'}</span><h2>${state==='upcoming'||state==='active'?esc(event.name):'A better setup. A considered purchase.'}</h2><p>${esc(message)}</p>${state==='upcoming'||state==='active'?external(event.source,'Amazon’s official event announcement'):''}<p class="note">No product-specific discount has been verified. Amazon sets prices, eligibility and checkout terms.</p></section><div class="shopping-story">${picks.map(([c,i],n)=>`<article class="deal-feature reveal"><div class="deal-photo"><img src="${assetFor(i.image)||sceneFor(c.id)}" alt="${i.image?esc(i.name):'Interview preparation scene'}" loading="lazy"></div><div class="deal-copy"><span class="eyebrow">0${n+1} · ${esc(c.name)} · ${tierOf(i.t).name}</span><h3>${esc(i.name)}</h3><p>${esc(i.why)}</p><p><b>Count the full setup:</b> ${esc(i.setup)}</p>${reviewBlock(i)}<div class="actions">${external(amazonUrl(i),'Check current offer on Amazon','btn gold sm')}<a class="btn plain sm" href="#online/${c.id}">Compare all three tiers →</a></div></div></article>`).join('')}</div><p class="disclosure">${DISCLOSURE}</p>`;
  bindEditorial(host);
};
const routeBeforePhaseOne = route;
route = function() {
  const id = (location.hash||'#home').slice(1).split('/')[0];
  if (PHASE1.deferredRoutes.includes(id)) {
    stopCam(); stopMic();
    document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id==='page-'+id));
    const page=document.getElementById('page-'+id); page.innerHTML=phaseTwoMoment(id);
    document.querySelectorAll('[data-nav]').forEach(link=>link.removeAttribute('aria-current'));
    document.title=`${phaseTwoTitles[id]} · Coming in Phase 2 · MissionMed`;
    document.querySelector('.topbar').style.display='';
    window.scrollTo({top:0,behavior:'instant'}); page.querySelector('h1').focus({preventScroll:true}); bindEditorial(page); moveStory();
    return;
  }
  routeBeforePhaseOne();
  if (id==='experts') document.querySelectorAll('[data-expert-filter="Travel"],[data-expert-filter="Style"]').forEach(button=>button.hidden=true);
};
applyPhaseOneNavigation();
const licensedPhotos = allItems().filter(i=>i.imageCredit);
main.insertAdjacentHTML('beforeend',`<details class="photo-credits"><summary>Product photography credits</summary>${licensedPhotos.map(i=>`<p><b>${esc(i.name)}</b> — ${external(i.imageCredit.source,esc(i.imageCredit.author))} · ${external(i.imageCredit.licenseUrl,esc(i.imageCredit.license))}. ${esc(i.imageCredit.changes)}. No endorsement implied.</p>`).join('')}</details>`);
CHECKLIST.online[0][1][5][1]='Rehearse your complete outfit while seated. Check camera contrast and comfort; hang it ready for the morning.';
if (PHASE1.persistenceMode === 'device-only') {
  document.querySelectorAll('#page-checklist > .lede,#page-kit > .lede').forEach(p=>p.textContent='Your checklist and kit stay on this device. No account or cross-device sync.');
}
document.body.dataset.releaseState = PHASE1.releaseState;
route();
