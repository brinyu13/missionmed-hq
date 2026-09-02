/*!
 * MissionMed — Visual System V2 renderer
 * Ticket: MR-WEB-0902 / correction MR-WEB-0902B
 *
 * Adds to the V1 data layer (campaign-state.js is unchanged and still the only
 * source of prices/names/availability): iconography, the Match Day video wall,
 * scroll reveals, and parallax.
 *
 * ASSET POLICY
 *   Every media URL below is already published on missionmedinstitute.com and was
 *   verified reachable on 2026-09-02. No stock, no AI-generated imagery, nothing
 *   re-hosted. See VISUAL_ASSET_INVENTORY.md.
 */
(function (root) {
  'use strict';
  var C = root.MMCampaign;

  var UP = 'https://missionmedinstitute.com/wp-content/uploads/';
  var CDN = 'https://cdn.missionmedinstitute.com/other/';

  var ASSETS = {
    mrHero:    UP + '2026/06/mm-speed-mr-006/mission-residency-run-mr006-q100.webp',
    classShot: UP + '2026/03/Mission_Class_Screenshot-1-scaled.png',
    drBrian:   UP + '2026/03/DrBrian_Profile_2.png',
    logo:      UP + '2026/02/cropped-608a69b125647f6e63b56f87b823b1e60dbdaebf4916b1d5d5edcc408b8ab3fe-448x171.png'
  };

  // The eight real Match Day testimonials. Posters + quotes are exactly as
  // published on the live corporate homepage today.
  var P = UP + '2026/06/mm-speed-home-012/mm-home-012-';
  var TESTIMONIALS = [
    { tag: 'Transformation', name: 'Marian',  poster: P + '03-marian-tearful-match-call.jpg',                 video: CDN + 'emotional_marianne_overwhelming_joy_family_crying_06.mp4',   quote: 'You made me fall in love with my story.' },
    { tag: '5 Failed Cycles', name: 'Chelsey & Danny', poster: P + '04-chelsey-matched-after-5-cycles.jpg',    video: CDN + 'gratitude_chelsea_danny_thanking_dr_brian_life_cha_07.mp4',  quote: 'You change people’s life.' },
    { tag: '15-Year Gap',    name: 'Yamini',  poster: P + '05-yamini-left-medicine-15-years.jpg',              video: CDN + 'emotional_yamini_emotional_match_relief_19.mp4',            quote: 'You gave me a voice to express myself.' },
    { tag: 'Family Reaction', name: 'Gunjan', poster: P + '06-gunjan-family-finds-out.jpg',                    video: CDN + 'emotional_gunjan_emotional_crying_family_reaction_93.mp4',   quote: 'This is the best feeling right now.' },
    { tag: 'Reapplicant',    name: 'Sana',    poster: P + '07-sana-failed-last-year-matched-this-year.jpg',    video: CDN + 'best_decision_sana_everything_worth_it_208.mp4',            quote: 'Being persistent… it does pay off.' },
    { tag: 'Best Decision',  name: 'Maisha',  poster: P + '08-maisha-best-decision.jpg',                       video: CDN + 'best_decision_maisha_best_decision_testimony_10.mp4',       quote: 'One of the best decisions in my life.' },
    { tag: 'Found a Family', name: 'Maksura', poster: P + '09-maksura-found-where-she-belonged.jpg',           video: CDN + 'support_system_maksura_belonging_community_support_137.mp4', quote: 'It feels like I belong somewhere.' },
    { tag: 'Confidence',     name: 'Mahabuba',poster: P + '10-mahabuba-confidence.jpg',                        video: CDN + 'best_decision_mahbuba_best_day_emotional_reaction_45.mp4',  quote: 'You gave me the confidence.' }
  ];

  /* ------------------------------------------------------------ icons
     Inline SVG: no icon-font request, inherits currentColor, and stays crisp. */
  var I = {
    check:    '<path d="M20 6 9 17l-5-5"/>',
    x:        '<path d="M18 6 6 18M6 6l12 12"/>',
    doc:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    mic:      '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    target:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    crown:    '<path d="M3 7l4.5 4L12 4l4.5 7L21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    layers:   '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    gauge:    '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l5-3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    play:     '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
    spark:    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    menu:     '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron:  '<path d="m9 6 6 6-6 6"/>',
    shield:   '<path d="M12 3l7 3v6c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6z"/>',
    users:    '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.2"/><path d="M22 20v-2a4 4 0 0 0-3-3.9"/>'
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || I.check) + '</svg>';
  }

  var STEP_ICONS = { foundation: 'layers', practice: 'mic', assessed: 'gauge', real_prep: 'target', season: 'calendar' };
  var ROUTE_ICONS = { ps_intensive_priority: 'doc', iv_prep_essentials: 'layers', iv_prep_complete: 'target', match_mentorship_360: 'crown' };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function track(name, params) {
    root.dataLayer = root.dataLayer || [];
    root.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

  /* ------------------------------------------------------------ campaign bar */
  function campaignBar(cfg, state) {
    var bar = el('div', { class: 'v-campaign', role: 'status' });
    if (!state.showCampaignBanner) {
      bar.hidden = true;
      bar.setAttribute('data-suppressed-reason', state.reason || 'NOT_ACTIVE');
      return bar;
    }
    var closes = new Date(cfg.campaign.window.closes);
    var dt = closes.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });
    bar.innerHTML = '<strong>' + cfg.campaign.public_name + '</strong> &nbsp;·&nbsp; Fall Access tuition through ' +
      dt + ', 11:59 PM ET. Standard tuition applies from September 8.';
    track('fall_access_hero_impression', { campaign_id: cfg.campaign.id, state: state.key });
    return bar;
  }

  /* ------------------------------------------------------------ price */
  function priceBlock(cfg, key, state) {
    var wrap = el('div'), p = cfg.products[key];

    if (p.render === 'VISIBLE_BUT_CLOSED' && p.display_price) {
      wrap.appendChild(el('div', { class: 'v-price' }, [
        el('span', { class: 'v-price__now', text: C.money(p.display_price) }),
        el('span', { class: 'v-price__unit', text: 'reference tuition' })
      ]));
      return wrap;
    }
    var now = C.priceFor(cfg, key, state, 'card');
    if (now === null) return wrap;
    wrap.appendChild(el('div', { class: 'v-price' }, [el('span', { class: 'v-price__now', text: C.money(now) })]));

    if (state.priceMode === 'fall_access') {
      var std = (p.pricing && p.pricing.standard) || {};
      var stdCard = typeof std.all_rails === 'number' ? std.all_rails : std.card;
      if (typeof stdCard === 'number') {
        wrap.appendChild(el('p', { class: 'v-price__then',
          html: 'Fall Access tuition through September 7. Standard tuition <b>' + C.money(stdCard) + '</b> from September 8.' }));
      }
    } else if (C.bankAdvantage(cfg, key, state) > 0) {
      wrap.appendChild(el('p', { class: 'v-price__then',
        html: 'By card. <b>' + C.money(C.priceFor(cfg, key, state, 'bank_transfer')) + '</b> by bank transfer.' }));
    }
    return wrap;
  }

  /* ------------------------------------------------------------ program card */
  function programCard(cfg, key, state, o) {
    o = o || {};
    var p = cfg.products[key];
    if (!p) return null;
    var vis = C.visibility(cfg, key, state);
    if (vis.render === 'SUPPRESS') return null;
    var closed = vis.render !== 'OPEN';

    var card = el('article', { class: 'v-card' + (o.hero ? ' v-card--hero' : '') + (closed ? ' v-card--closed' : '') + ' js-reveal', 'data-product': key });
    if (o.flag) card.appendChild(el('span', { class: 'v-flag', text: o.flag }));

    card.appendChild(el('span', { class: 'v-status ' + (closed ? 'v-status--closed' : 'v-status--open'),
      text: closed ? (p.status_subhead || 'Enrollment closed') : 'Open now' }));
    card.appendChild(el('h3', { text: p.public_name, style: 'margin-top:12px' }));
    if (o.pitch) card.appendChild(el('p', { class: 'v-body', style: 'font-size:1.06rem', text: o.pitch }));
    if (p.status_headline) card.appendChild(el('p', { class: 'v-body', text: p.status_headline }));

    card.appendChild(priceBlock(cfg, key, state));

    if (o.features && o.features.length) {
      var ul = el('ul', { class: 'v-list' });
      o.features.forEach(function (f) {
        var absent = typeof f === 'object' && f.absent;
        var label = typeof f === 'object' ? f.text : f;
        ul.appendChild(el('li', { class: absent ? 'is-absent' : '', html: icon(absent ? 'x' : 'check') + '<span>' + label + '</span>' }));
      });
      card.appendChild(ul);
    }

    var foot = el('div', { class: 'v-card__foot' });
    if (closed) {
      if (p.future) {
        foot.appendChild(el('p', { class: 'v-meta', style: 'margin-bottom:14px', text: p.future.factual_line }));
        var b = el('a', { class: 'v-btn v-btn--glass v-btn--block', href: '#priority-interest', text: p.future.cta_label });
        b.addEventListener('click', function () { track('priority_interest_360_click', {}); });
        foot.appendChild(b);
      } else {
        foot.appendChild(el('span', { class: 'v-btn v-btn--glass v-btn--block', 'aria-disabled': 'true', text: 'Enrollment closed' }));
      }
    } else {
      var cta = el('a', {
        class: 'v-btn ' + (o.hero ? 'v-btn--gold' : (o.paper ? 'v-btn--ink' : 'v-btn--glass')) + ' v-btn--block',
        href: o.href || '#', text: o.cta || ('Enroll in ' + p.public_name)
      });
      cta.addEventListener('click', function () {
        track(key === 'iv_prep_complete' ? 'complete_cta_click' : 'essentials_cta_click',
          { price: C.priceFor(cfg, key, state, 'card'), state: state.key, placement: o.placement || 'card' });
      });
      foot.appendChild(cta);
    }
    card.appendChild(foot);
    return card;
  }

  /* ------------------------------------------------------------ video wall
     Click-to-play only. Nothing autoplays, nothing plays audio unbidden, and
     no video byte is fetched until the visitor asks (preload="none"). */
  function videoWall(limit) {
    var wrap = el('div', { class: 'v-grid v-grid--4' });
    TESTIMONIALS.slice(0, limit || TESTIMONIALS.length).forEach(function (t, i) {
      var fig = el('figure', { class: 'v-video js-reveal', style: 'margin:0' });
      fig.innerHTML =
        '<img class="v-video__poster" src="' + t.poster + '" alt="' + t.name + ' — Match Day reaction" loading="lazy" decoding="async">' +
        '<div class="v-video__grad"></div>' +
        '<button class="v-video__play" type="button" aria-label="Play ' + t.name + '’s Match Day video">' + icon('play') + '</button>' +
        '<figcaption class="v-video__cap">' +
          '<span class="v-video__tag">' + t.tag + '</span>' +
          '<p class="v-video__name">' + t.name + '</p>' +
          '<p class="v-video__quote">“' + t.quote + '”</p>' +
        '</figcaption>';

      fig.addEventListener('click', function () {
        if (fig.classList.contains('is-playing')) return;
        var v = document.createElement('video');
        v.src = t.video; v.controls = true; v.autoplay = true; v.playsInline = true;
        v.preload = 'none'; v.setAttribute('aria-label', t.name + ' Match Day video');
        fig.classList.add('is-playing');
        fig.querySelector('.v-video__poster').replaceWith(v);
        v.play().catch(function () { /* user gesture required — controls are visible */ });
        track('proof_video_play', { student: t.name });
      });
      wrap.appendChild(fig);
    });
    return wrap;
  }

  /* ------------------------------------------------------------ journey */
  function journey(cfg, productKey) {
    var cov = (cfg.journey.coverage || {})[productKey] || [];
    var wrap = el('div', { class: 'v-journey' });
    cfg.journey.stages.forEach(function (s) {
      var on = cov.indexOf(s.key) !== -1;
      wrap.appendChild(el('div', { class: 'v-step js-reveal' + (on ? ' v-step--on' : ''),
        html: icon(STEP_ICONS[s.key] || 'check', 'v-step__icon') + '<h3>' + s.title + '</h3><p>' + s.desc + '</p>' }));
    });
    return wrap;
  }

  /* ------------------------------------------------------------ router */
  function needRouter(cfg) {
    var wrap = el('div', { class: 'v-router' });
    cfg.routing.needs.forEach(function (n) {
      var target = n.route_to[0], prod = cfg.products[target] || {};
      wrap.appendChild(el('a', { class: 'v-route js-reveal', href: '#' + target,
        html: icon(ROUTE_ICONS[target] || 'spark', 'v-route__icon') +
              '<span class="v-route__need">' + n.need + '</span>' +
              '<span class="v-route__to">' + (prod.public_name || target) + ' &rarr;</span>' }));
    });
    return wrap;
  }

  /* ------------------------------------------------------------ payments */
  function paymentHierarchy(cfg, productKey, state) {
    var wrap = el('div', { class: 'v-pay' });
    var plan = cfg.payments.missionmed_payment_plan;
    var adv = C.bankAdvantage(cfg, productKey, state);

    cfg.payments.hierarchy.forEach(function (opt) {
      if (opt.available === false) return;
      var isBest = opt.rank === 1, isPlan = opt.rank === 3;
      var box = el('div', { class: 'v-pay__opt js-reveal' + (isBest ? ' v-pay__opt--best' : '') + (isPlan ? ' v-pay__opt--quiet' : '') });
      box.appendChild(el('div', { class: 'v-pay__eyebrow', text: opt.eyebrow }));
      box.appendChild(el('p', { class: 'v-pay__label', text: opt.label }));

      if (isPlan) {
        box.appendChild(el('p', { class: 'v-pay__note', text: plan.public_copy }));
        var a = el('a', { class: 'v-btn v-btn--text', href: '#admissions', text: plan.cta_label });
        a.addEventListener('click', function () { track('payment_plan_inquiry', { product: productKey }); });
        box.appendChild(a);
        if (cfg.payments.affirm.available) {
          box.appendChild(el('p', { class: 'v-pay__note', text: 'Affirm available for eligible U.S. residents.' }));
        }
      } else {
        var rail = opt.price_ref === 'bank_transfer' ? 'bank_transfer' : 'card';
        var amt = C.priceFor(cfg, productKey, state, rail);
        box.appendChild(el('div', { class: 'v-pay__amt', text: C.money(amt) }));
        if (isBest) {
          // Honest in both states: a dollar claim only when a spread exists.
          box.appendChild(el('span', { class: 'v-pay__save',
            text: adv > 0 ? C.money(adv) + ' less than paying by card.' : 'Fastest way to secure your seat this week.' }));
          box.appendChild(el('p', { class: 'v-pay__note', text: cfg.payments.bank_transfer_note }));
        }
        box.addEventListener('click', function () {
          track(isBest ? 'payment_zelle_selected' : 'payment_card_selected', { product: productKey, price: amt });
        });
      }
      wrap.appendChild(box);
    });
    return wrap;
  }

  /* ------------------------------------------------------------ motion */
  function initMotion() {
    var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in root)) return; // static experience stays complete

    var els = document.querySelectorAll('.js-reveal');
    els.forEach(function (e) { e.classList.add('is-armed'); }); // armed only once we know we can animate
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = Array.prototype.indexOf.call(en.target.parentNode.children, en.target);
        en.target.style.transitionDelay = Math.min(i, 5) * 70 + 'ms';
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (e) { io.observe(e); });

    var px = document.querySelectorAll('.js-parallax');
    if (!px.length) return;
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      root.requestAnimationFrame(function () {
        px.forEach(function (e) {
          var r = e.getBoundingClientRect();
          if (r.bottom < -200 || r.top > root.innerHeight + 200) return;
          var speed = parseFloat(e.dataset.speed || '0.14');
          e.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - root.innerHeight / 2) * -speed).toFixed(2) + 'px,0)';
        });
        ticking = false;
      });
    }
    root.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------ site chrome
     Reproduces the LIVE MissionMed header and footer so the candidate reads as
     a page of the real site, not a standalone demo. The absence of any header
     was the single biggest reason the earlier preview felt like a mockup.

     ONE deliberate departure from live: the utility bar is NOT reproduced with
     "89.1% MATCH RATE · 3,000+ TRAINED SINCE 2009". That figure is unsupported
     and contradicts the same page's own footer ("since 2015"). */
  var NAV = [
    { label: 'Home',              href: 'home-corporate.html',    key: 'home' },
    { label: 'ExamPrep',          href: 'https://missionmedinstitute.com/examprep/', key: 'examprep' },
    { label: 'Mission Residency', href: 'mission-residency.html', key: 'mr' },
    { label: 'USCE',              href: 'https://missionmedinstitute.com/usce/', key: 'usce' },
    { label: 'Arena',             href: 'https://missionmedinstitute.com/homepage-arena/', key: 'arena' }
  ];

  function siteHeader(currentKey) {
    var frag = document.createDocumentFragment();

    var util = el('div', { class: 'v-util' });
    util.innerHTML = '<span>Mission Residency &nbsp;·&nbsp; Residency interview preparation</span>' +
                     '<span>Concierge hours &nbsp;·&nbsp; Mon&ndash;Sat 9a&ndash;7p ET</span>';
    frag.appendChild(util);

    var head = el('header', { class: 'v-head' });
    head.innerHTML =
      '<a class="v-head__logo" href="home-corporate.html" aria-label="MissionMed Institute — home">' +
        '<img src="' + ASSETS.logo + '" alt="MissionMed Institute"></a>' +
      '<button class="v-head__burger" type="button" aria-expanded="false" aria-label="Open menu">' +
        icon('menu') + '</button>' +
      '<nav class="v-head__nav" aria-label="Primary">' +
        NAV.map(function (n) {
          return '<a href="' + n.href + '"' + (n.key === currentKey ? ' aria-current="page"' : '') + '>' + n.label + '</a>';
        }).join('') +
      '</nav>' +
      '<div class="v-head__act">' +
        '<a class="is-ghost" href="https://missionmedinstitute.com/my-account/">Members</a>' +
        '<a class="is-solid" href="https://missionmedinstitute.com/my-account/">Log in</a>' +
      '</div>';

    var burger = head.querySelector('.v-head__burger');
    burger.addEventListener('click', function () {
      var open = head.querySelector('.v-head__nav').classList.toggle('is-open');
      head.querySelector('.v-head__act').classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    frag.appendChild(head);
    return frag;
  }

  function siteFooter() {
    var f = el('footer', { class: 'v-foot' });
    f.innerHTML =
      '<div class="v-wrap">' +
        '<div class="v-foot__grid">' +
          '<div>' +
            '<img class="v-foot__logo" src="' + ASSETS.logo + '" alt="MissionMed Institute" loading="lazy">' +
            '<p class="v-meta" style="max-width:30ch">Residency interview preparation, exam preparation and US clinical experience for international and osteopathic applicants.</p>' +
          '</div>' +
          '<div><h4>Divisions</h4><ul>' +
            '<li><a href="mission-residency.html">Mission Residency</a></li>' +
            '<li><a href="https://missionmedinstitute.com/examprep/">Dr J&rsquo;s Exam Prep</a></li>' +
            '<li><a href="https://missionmedinstitute.com/usce/">Mission: Clinicals</a></li>' +
          '</ul></div>' +
          '<div><h4>Programs</h4><ul>' +
            '<li><a href="program-complete.html">IV Prep Complete</a></li>' +
            '<li><a href="program-essentials.html">IV Prep Essentials</a></li>' +
            '<li><a href="program-360.html">360 Match Mentorship</a></li>' +
            '<li><a href="program-ps.html">Personal Statement Intensive</a></li>' +
          '</ul></div>' +
          '<div><h4>Deciding</h4><ul>' +
            '<li><a href="compare.html">Compare programs</a></li>' +
            '<li><a href="payment.html">Ways to pay</a></li>' +
            '<li><a href="mission-residency.html#faq">FAQ</a></li>' +
          '</ul></div>' +
        '</div>' +
        '<p class="v-foot__legal">MissionMed Institute &middot; Mission Global Group LLC &middot; Concierge hours Mon&ndash;Sat 9a&ndash;7p ET' +
        '<br>Internal review candidate for MR-WEB-0902. Not published.</p>' +
      '</div>';
    return f;
  }

  /* Mounts chrome around whatever the page already rendered. */
  function mountChrome(currentKey) {
    document.body.insertBefore(siteHeader(currentKey), document.body.firstChild);
    document.body.appendChild(siteFooter());
  }

  /* ------------------------------------------------------------ FAQ
     Native <details>/<summary>: keyboard-accessible and open-by-default if JS
     or CSS fails. The pricing answer is generated from config so it can never
     go stale the way the live one did. */
  function faq(cfg, state) {
    var wrap = el('div', { class: 'v-faq' });
    (cfg.faq.items || []).forEach(function (item, i) {
      var a = item.a;
      if (a === '__PRICING__') {
        var e = C.priceFor(cfg, 'iv_prep_essentials', state, 'card');
        var c = C.priceFor(cfg, 'iv_prep_complete', state, 'card');
        var adv = C.bankAdvantage(cfg, 'iv_prep_complete', state);
        a = 'IV Prep Essentials is ' + C.money(e) + ' and IV Prep Complete is ' + C.money(c) + '. ' +
            (state.priceMode === 'fall_access'
              ? 'Those are Fall Access rates through September 7; standard tuition applies from September 8. '
              : '') +
            '360 Match Mentorship is shown at its ' + C.money(cfg.products.match_mentorship_360.display_price) +
            ' reference tuition — its 2026-27 capacity is reached. ' +
            'Paying in full by bank transfer is the best value' +
            (adv > 0 ? ', ' + C.money(adv) + ' less than paying by card' : '') +
            '. Card is available, and if you need to spread it out, Admissions will talk you through the MissionMed payment plan.';
      }
      var d = el('details', { class: 'v-faq__item' + (i === 0 ? ' is-first' : '') });
      if (i === 0) d.open = true;
      d.innerHTML = '<summary>' + item.q + icon('chevron', 'v-faq__chev') + '</summary>' +
                    '<div class="v-faq__a"><p>' + a + '</p></div>';
      d.addEventListener('toggle', function () { if (d.open) track('faq_open', { question: item.q }); });
      wrap.appendChild(d);
    });
    return wrap;
  }

  /* ------------------------------------------------------------ program pages
     One renderer drives all four program surfaces. Everything — name, price,
     availability, inclusions — comes from config, so a program page can never
     drift from the division page the way the live product pages have. */
  var PROGRAM_COPY = {
    iv_prep_essentials: {
      key: 'iv_prep_essentials',
      say: '"Teach me how to interview."',
      lede: 'A focused block that gives you the framework — how strong residency interview answers are actually built, and how to deliver them under pressure.',
      forWho: 'You want the fundamentals, and you may have an interview coming up soon.',
      includes: [
        ['layers', '5-Day IV Foundation Workshop', 'The core framework, taught live.'],
        ['mic',    'Live core sessions with Dr. Brian', 'Not recordings. You are in the room.'],
        ['target', 'Communication and question strategy', 'How to structure an answer that lands.'],
        ['users',  '1-on-1 strategy session', 'Your situation, worked through individually.']
      ],
      absent: ['No full-season mock cadence', 'No debrief after each real interview', 'No program-specific strategy through the season'],
      videos: 2
    },
    iv_prep_complete: {
      key: 'iv_prep_complete',
      say: '"Stay with me through interview season."',
      lede: 'Everything in Essentials, and then the part that actually decides your season — scored practice, a debrief after every real interview, and strategy that keeps adapting until the season ends.',
      forWho: 'You want someone in your corner from now through the end of interview season.',
      includes: [
        ['layers',   'Everything in IV Prep Essentials', 'The full foundation block is included.'],
        ['mic',      '__MOCKS__', 'Scored practice under realistic pressure.'],
        ['gauge',    'Weekly pre-interview checkups', 'Sharpen the answers that matter this week.'],
        ['calendar', 'Debrief after every real interview', 'Fix what went wrong before the next one.'],
        ['target',   'Program-specific strategy', 'Advanced communication and targeting.']
      ],
      absent: [],
      videos: 4
    },
    match_mentorship_360: {
      key: 'match_mentorship_360',
      say: '"Help me manage the entire Match."',
      lede: 'The maximum level of access to Dr. Brian — the whole Match year, one-to-one. Enrollment for 2026-27 is closed because the number of students he can personally mentor at this level has been reached.',
      forWho: 'You want the entire Match managed with you, not just interview preparation.',
      includes: [
        ['crown', 'The full Match year, one-to-one', 'Directly with Dr. Brian throughout.'],
        ['doc',   'Personal statement developed with you', 'Iteratively, not reviewed once.'],
        ['layers','ERAS review and program targeting', 'Where you apply, and why.'],
        ['gauge', 'Rank list strategy', 'Worked through together.'],
        ['mic',   'The highest level of interview practice we offer', '']
      ],
      absent: [],
      videos: 2
    },
    ps_intensive_priority: {
      key: 'ps_intensive_priority',
      say: '"Help me tell my story."',
      lede: 'A white-glove service with Dr. Brian, not proofreading. Your statement is developed with you — theme, narrative and structure — across a strategy session and follow-up meetings.',
      forWho: 'Your personal statement is the thing standing between you and a stronger application.',
      includes: [
        ['users', 'Minimum 2-hour strategy session with Dr. Brian', 'Where the narrative is found.'],
        ['doc',   'Narrative and theme development', 'What your story actually is.'],
        ['spark', 'Personally developed statement', 'Written with you, not for you.'],
        ['users', 'Minimum two follow-up meetings', 'Revision and final refinement.']
      ],
      absent: [],
      videos: 2,
      alsoShow: 'ps_intensive_emergency'
    }
  };

  function programPage(cfg, state, key) {
    var copy = PROGRAM_COPY[key], p = cfg.products[key];
    var vis = C.visibility(cfg, key, state);
    var closed = vis.render !== 'OPEN';
    var frag = document.createDocumentFragment();

    /* ---- hero */
    var hero = el('header', { class: 'v-hero v-hero--sub' });
    hero.innerHTML =
      '<div class="v-hero__media"><img src="' + (key === 'ps_intensive_priority' ? ASSETS.drBrian : ASSETS.mrHero) + '" alt="" fetchpriority="high"></div>' +
      '<div class="v-hero__scrim"></div>' +
      '<div class="v-hero__inner"><div class="v-wrap">' +
        '<span class="v-eyebrow">' + (key === 'ps_intensive_priority' ? 'Personal Statement Intensive' : 'Mission Residency') + '</span>' +
        '<h1>' + p.public_name + '</h1>' +
        '<p class="v-quote" style="margin:0 0 18px">' + copy.say + '</p>' +
        '<p class="v-lede">' + copy.lede + '</p>' +
        '<div id="pp-price"></div>' +
        '<div class="v-hero__cta" id="pp-cta"></div>' +
      '</div></div>';
    frag.appendChild(hero);

    /* ---- who it is for + inclusions */
    var inc = el('section', { class: 'v-env v-env--paper' });
    var mock = cfg.mock_entitlement;
    inc.innerHTML =
      '<div class="v-wrap">' +
        '<span class="v-eyebrow">Who it is for</span>' +
        '<h2 style="max-width:20ch">' + copy.forWho + '</h2>' +
        '<div class="v-grid v-grid--2" style="margin-top:46px">' +
          copy.includes.map(function (it) {
            var title = it[1] === '__MOCKS__' ? mock.public_label : it[1];
            return '<div class="v-inc js-reveal">' + icon(it[0], 'v-inc__icon') +
                   '<div><h3>' + title + '</h3>' + (it[2] ? '<p>' + it[2] + '</p>' : '') + '</div></div>';
          }).join('') +
        '</div>' +
        (copy.absent.length
          ? '<div class="v-note" style="margin-top:34px"><b>Not included in this program:</b> ' +
            copy.absent.join(' &middot; ') + '. Those are what IV Prep Complete adds.</div>'
          : '') +
      '</div>';
    frag.appendChild(inc);

    /* ---- where it sits in the season */
    if (cfg.journey.coverage[key]) {
      var jr = el('section', { class: 'v-env v-env--deep' });
      jr.innerHTML = '<div class="v-wrap"><span class="v-eyebrow">The season</span>' +
        '<h2>Where this program carries you.</h2>' +
        '<p class="v-lede">Gold marks the stages this program covers.</p><div id="pp-journey"></div></div>';
      frag.appendChild(jr);
    }

    /* ---- proof */
    var pr = el('section', { class: 'v-env v-env--dark' });
    pr.innerHTML = '<div class="v-wrap"><span class="v-eyebrow">Match Day</span>' +
      '<h2>Students who did this.</h2><div id="pp-videos" style="margin-top:34px"></div></div>';
    frag.appendChild(pr);

    /* ---- payment or closed state */
    var pay = el('section', { class: 'v-env v-env--paper', id: 'payment' });
    pay.innerHTML = '<div class="v-wrap"><span class="v-eyebrow">' +
      (closed ? 'Availability' : 'Ways to pay') + '</span><h2>' +
      (closed ? (p.status_headline || 'Enrollment closed') : 'How you can pay.') +
      '</h2><div id="pp-pay" style="margin-top:34px"></div></div>';
    frag.appendChild(pay);

    return frag;
  }

  root.MMVisual = {
    el: el, icon: icon, track: track, ASSETS: ASSETS, TESTIMONIALS: TESTIMONIALS,
    campaignBar: campaignBar, priceBlock: priceBlock, programCard: programCard,
    videoWall: videoWall, journey: journey, needRouter: needRouter,
    paymentHierarchy: paymentHierarchy, initMotion: initMotion,
    siteHeader: siteHeader, siteFooter: siteFooter, mountChrome: mountChrome, faq: faq, programPage: programPage, PROGRAM_COPY: PROGRAM_COPY
  };
})(window);
