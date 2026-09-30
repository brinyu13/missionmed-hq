/* Donor motion is native background-attachment: fixed; no new parallax engine. */
(() => {
  'use strict';
  const keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
  const source = new URLSearchParams(location.search);
  const attribution = Object.fromEntries(keys.filter(k => source.has(k)).map(k => [k, source.get(k).slice(0,200)]));
  document.querySelectorAll('a[data-offer]').forEach(link => {
    const u = new URL(link.href, location.origin);
    if (u.origin !== location.origin) return;
    Object.entries(attribution).forEach(([k,v]) => u.searchParams.set(k,v));
    link.href = u.href;
  });
  const track = (event, extra = {}) => {
    const data = {send_to:'G-B4B4E26HMW',mission:'MR-USCE-ALTERNATE-0930',page_path:location.pathname,...attribution,...extra};
    if (typeof window.gtag === 'function') window.gtag('event',event,data);
    else (window.dataLayer = window.dataLayer || []).push({event,...data});
  };
  document.querySelectorAll('a[data-offer]').forEach(a => a.addEventListener('click', () => track('mr_product_detail_intent',{offer:a.dataset.offer,destination_path:new URL(a.href).pathname,cta_location:'usce_alternate'})));
  document.querySelectorAll('.cl1403c-faq-item').forEach(d => d.addEventListener('toggle', () => {if(d.open)track('mr_faq_open',{question:d.querySelector('summary').innerText});}));
  // Preserve donor's photo loading discipline: lower background images load near viewport.
  const load = el => {el.style.backgroundImage = `url("${el.dataset.bg}")`;el.removeAttribute('data-bg');};
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(e => {if(e.isIntersecting){load(e.target);observer.unobserve(e.target);}}),{rootMargin:'400px'});
    document.querySelectorAll('[data-bg]').forEach(el => observer.observe(el));
  } else document.querySelectorAll('[data-bg]').forEach(load);
  const menu = document.querySelector('.mm-alt-menu');
  menu?.addEventListener('keydown', e => {if(e.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
})();
