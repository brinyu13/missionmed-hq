/*!
 * MissionMed — commercial component renderer
 * Ticket: MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001
 *
 * Renders every price / name / availability element from campaign-state.json via
 * MMCampaign. Pages contain structure and prose; they never contain a number.
 *
 * Analytics: emits a framework-agnostic dataLayer contract. The live site runs
 * Google Site Kit, so Codex binds these to the EXISTING GA4 property. Do not add
 * a second analytics system (ticket S29).
 */
(function (root) {
  'use strict';
  var C = root.MMCampaign;

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

  function bindTrack(node, name, params) {
    node.addEventListener('click', function () { track(name, params); });
    return node;
  }

  /* ---------------------------------------------------------- campaign bar */
  function campaignBar(cfg, state) {
    var bar = el('div', { class: 'mmc-campaign', role: 'status' });

    if (!state.showCampaignBanner) {
      bar.hidden = true;
      // Leave a machine-readable trace so QA can prove WHY it is hidden.
      bar.setAttribute('data-suppressed-reason', state.reason || 'NOT_ACTIVE');
      return bar;
    }
    var win = cfg.campaign.window;
    var closes = new Date(win.closes);
    var dt = closes.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });
    bar.innerHTML = '<strong>' + cfg.campaign.public_name + '</strong> &nbsp;·&nbsp; ' +
      'Fall Access tuition through ' + dt + ', 11:59 PM ET. Standard tuition applies from September 8.';
    track('fall_access_hero_impression', { campaign_id: cfg.campaign.id, state: state.key });
    return bar;
  }

  /* ---------------------------------------------------------- price block */
  function priceBlock(cfg, key, state) {
    var wrap = el('div');
    var p = cfg.products[key];

    // Display-only products (360) carry `display_price`, not a pricing table, so
    // this branch must come BEFORE the null-price bail-out below.
    if (p.render === 'VISIBLE_BUT_CLOSED' && p.display_price) {
      wrap.appendChild(el('div', { class: 'mmc-price' }, [
        el('span', { class: 'mmc-price__now', text: C.money(p.display_price) }),
        el('span', { class: 'mmc-price__unit', text: 'reference tuition' })
      ]));
      return wrap;
    }

    var now = C.priceFor(cfg, key, state, 'card');
    if (now === null) return wrap;

    wrap.appendChild(el('div', { class: 'mmc-price' }, [
      el('span', { class: 'mmc-price__now', text: C.money(now) })
    ]));

    // Factual two-number frame. Never a %, never a strikethrough, never "save".
    if (state.priceMode === 'fall_access') {
      var std = (p.pricing && p.pricing.standard) || {};
      var stdCard = typeof std.all_rails === 'number' ? std.all_rails : std.card;
      if (typeof stdCard === 'number') {
        wrap.appendChild(el('p', {
          class: 'mmc-price__then',
          html: 'Fall Access tuition through September 7. Standard tuition <b>' + C.money(stdCard) + '</b> from September 8.'
        }));
      }
    } else {
      var adv = C.bankAdvantage(cfg, key, state);
      if (adv > 0) {
        wrap.appendChild(el('p', {
          class: 'mmc-price__then',
          html: 'By card. <b>' + C.money(C.priceFor(cfg, key, state, 'bank_transfer')) + '</b> by bank transfer.'
        }));
      }
    }
    return wrap;
  }

  /* ---------------------------------------------------------- program card */
  function programCard(cfg, key, state, opts) {
    opts = opts || {};
    var p = cfg.products[key];
    if (!p) return null;
    var vis = C.visibility(cfg, key, state);
    if (vis.render === 'SUPPRESS') return null;

    var closed = vis.render !== 'OPEN';
    var card = el('article', {
      class: 'mmc-card' + (opts.flagship ? ' mmc-card--flagship' : '') + (closed ? ' mmc-card--closed' : ''),
      'data-product': key
    });

    if (opts.flag) card.appendChild(el('span', { class: 'mmc-card__flag', text: opts.flag }));
    if (p.cold_subtitle) card.appendChild(el('span', { class: 'mmc-card__sub', text: p.cold_subtitle }));
    card.appendChild(el('h3', { class: 'mmc-card__name', text: p.public_name }));

    card.appendChild(el('span', {
      class: 'mmc-status ' + (closed ? 'mmc-status--closed' : 'mmc-status--open'),
      text: closed ? (p.status_subhead || 'Enrollment closed') : 'Open now'
    }));

    if (p.for_whom) card.appendChild(el('p', { class: 'mmc-card__for', text: p.for_whom }));
    if (p.status_headline) card.appendChild(el('p', { class: 'mmc-card__for', text: p.status_headline }));

    card.appendChild(priceBlock(cfg, key, state));

    if (opts.features && opts.features.length) {
      var ul = el('ul', { class: 'mmc-card__list' });
      opts.features.forEach(function (f) {
        var absent = typeof f === 'object' && f.absent;
        var label = typeof f === 'object' ? f.text : f;
        ul.appendChild(el('li', { class: absent ? 'is-absent' : '', text: label }));
      });
      card.appendChild(ul);
    }

    var ctaWrap = el('div', { class: 'mmc-card__cta' });
    if (closed) {
      if (p.future) {
        ctaWrap.appendChild(el('p', { class: 'mmc-fine', text: p.future.factual_line }));
        ctaWrap.appendChild(bindTrack(
          el('a', { class: 'mmc-btn mmc-btn--ghost mmc-btn--block', href: '#priority-interest', text: p.future.cta_label }),
          'priority_interest_360_click', {}
        ));
      } else {
        ctaWrap.appendChild(el('span', { class: 'mmc-btn mmc-btn--ghost mmc-btn--block', 'aria-disabled': 'true', text: 'Enrollment closed' }));
      }
    } else {
      ctaWrap.appendChild(bindTrack(
        el('a', {
          class: 'mmc-btn ' + (opts.flagship ? 'mmc-btn--primary' : 'mmc-btn--ghost') + ' mmc-btn--block',
          href: opts.href || '#checkout-boundary',
          text: opts.cta || ('Enroll in ' + p.public_name)
        }),
        key === 'iv_prep_complete' ? 'complete_cta_click' : 'essentials_cta_click',
        { price: C.priceFor(cfg, key, state, 'card'), state: state.key, placement: opts.placement || 'card' }
      ));
    }
    card.appendChild(ctaWrap);
    return card;
  }

  /* ---------------------------------------------------------- payments */
  function paymentHierarchy(cfg, productKey, state) {
    var wrap = el('div', { class: 'mmc-pay' });
    var plan = cfg.payments.missionmed_payment_plan;
    var adv = C.bankAdvantage(cfg, productKey, state);

    cfg.payments.hierarchy.forEach(function (opt) {
      if (opt.available === false) return;
      var isBest = opt.rank === 1, isPlan = opt.rank === 3;
      var cls = 'mmc-pay__opt' + (isBest ? ' mmc-pay__opt--best' : '') + (isPlan ? ' mmc-pay__opt--quiet' : '');
      var box = el('div', { class: cls });
      box.appendChild(el('div', { class: 'mmc-pay__eyebrow', text: opt.eyebrow }));
      box.appendChild(el('p', { class: 'mmc-pay__label', text: opt.label }));

      if (isPlan) {
        box.appendChild(el('p', { class: 'mmc-pay__note', text: plan.public_copy }));
        box.appendChild(bindTrack(
          el('a', { class: 'mmc-btn mmc-btn--quiet', href: '#admissions', text: plan.cta_label }),
          'payment_plan_inquiry', { product: productKey }
        ));
        // Affirm placement exists structurally but renders nothing while unavailable.
        if (cfg.payments.affirm.available) {
          box.appendChild(el('p', { class: 'mmc-pay__note', text: 'Affirm available for eligible U.S. residents.' }));
        }
      } else {
        var rail = opt.price_ref === 'bank_transfer' ? 'bank_transfer' : 'card';
        var amt = C.priceFor(cfg, productKey, state, rail);
        box.appendChild(el('div', { class: 'mmc-pay__amt', text: C.money(amt) }));
        if (isBest && adv > 0) {
          box.appendChild(el('span', { class: 'mmc-pay__save', text: C.money(adv) + ' less than paying by card.' }));
        } else if (isBest && adv === 0) {
          // Honest during Fall Access Week: one price on all rails, so the
          // advantage is speed, not dollars. Never imply a discount that is absent.
          box.appendChild(el('span', { class: 'mmc-pay__save', text: 'Fastest way to secure your seat this week.' }));
        }
        if (isBest) box.appendChild(el('p', { class: 'mmc-pay__note', text: cfg.payments.bank_transfer_note }));
        bindTrack(box, isBest ? 'payment_zelle_selected' : 'payment_card_selected', { product: productKey, price: amt });
      }
      wrap.appendChild(box);
    });
    return wrap;
  }

  /* ---------------------------------------------------------- journey */
  function journey(cfg, productKey) {
    var cov = (cfg.journey.coverage || {})[productKey] || [];
    var wrap = el('div', { class: 'mmc-journey' });
    cfg.journey.stages.forEach(function (s, i) {
      var on = cov.indexOf(s.key) !== -1;
      wrap.appendChild(el('div', { class: 'mmc-journey__step' + (on ? ' mmc-journey__step--on' : '') }, [
        el('div', { class: 'mmc-journey__num', text: '0' + (i + 1) }),
        el('div', { class: 'mmc-journey__t', text: s.title }),
        el('p', { class: 'mmc-journey__d', text: s.desc })
      ]));
    });
    return wrap;
  }

  /* ---------------------------------------------------------- need router */
  function needRouter(cfg) {
    var wrap = el('div', { class: 'mmc-router' });
    cfg.routing.needs.forEach(function (n) {
      var target = n.route_to[0];
      var prod = cfg.products[target] || {};
      wrap.appendChild(el('a', { class: 'mmc-router__item', href: '#' + target }, [
        el('span', { class: 'mmc-router__need', text: n.need }),
        el('span', { class: 'mmc-router__to', text: '→ ' + (prod.public_name || target) })
      ]));
    });
    return wrap;
  }

  root.MMRender = {
    el: el, track: track,
    campaignBar: campaignBar,
    priceBlock: priceBlock,
    programCard: programCard,
    paymentHierarchy: paymentHierarchy,
    journey: journey,
    needRouter: needRouter
  };
})(window);
