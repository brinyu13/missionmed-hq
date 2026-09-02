/*!
 * MissionMed — Campaign State Engine
 * Ticket: MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001
 *
 * PURPOSE
 *   Resolve the active campaign state and expose every price / name / availability
 *   decision to the page. No page may hard-code a price, a date, a program name,
 *   or an availability state.
 *
 * THE ANTI-STALE GUARANTEE
 *   State is derived from the clock on every render. When the Fall Access window
 *   closes at 2026-09-07T23:59:59-04:00, the site falls to STATE_B_STANDARD by
 *   itself. Nobody has to remember to change anything. That is the whole point of
 *   this file: the July-deadline problem must not happen again.
 *
 * TRUTH GATE
 *   The campaign will NOT render as live until campaign.go_live_gate.verified_live_at
 *   is a real timestamp. A null there means "not verified live" and the engine
 *   returns STATE_PRELAUNCH with standard prices. This is what stops the site from
 *   ever making a backdated claim.
 */
(function (root) {
  'use strict';

  var SITE_TZ_OFFSET = '-04:00'; // America/New_York, EDT. See note in resolveNow().

  function parse(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * The current instant. Overridable so the founder preview can time-travel to the
   * Sept 8 state without editing config, and so QA can assert state transitions.
   */
  function resolveNow(override) {
    if (override) {
      var d = parse(override);
      if (d) return d;
    }
    return new Date();
  }

  /**
   * Resolve which state is active.
   *
   * Order matters. The gates are checked most-restrictive first so that a failure
   * anywhere upstream can never leak a campaign price onto the page.
   */
  function resolveState(cfg, nowOverride) {
    var now = resolveNow(nowOverride);
    var camp = cfg.campaign || {};
    var gate = camp.go_live_gate || {};
    var win = camp.window || {};

    // GATE 1 — truth gate. Not verified live => nothing campaign-flavoured renders.
    var verified = parse(gate.verified_live_at);
    if (gate.blocks_campaign_render !== false && !verified) {
      return decorate(cfg, 'STATE_PRELAUNCH', now, {
        reason: 'NOT_VERIFIED_LIVE',
        detail: 'campaign.go_live_gate.verified_live_at is null. A human must set this only after a real end-to-end test purchase has cleared. Until then the site shows standard tuition and no campaign.'
      });
    }

    // GATE 2 — no-flip floor. Missed the verification deadline => nothing publishes.
    var floor = gate.no_flip_floor || {};
    var floorDeadline = parse(floor.deadline);
    if (floorDeadline && verified && verified > floorDeadline) {
      return decorate(cfg, floor.on_miss || 'STATE_PRELAUNCH', now, {
        reason: 'NO_FLIP_FLOOR_MISSED',
        detail: 'Checkout was not verified by ' + floor.deadline + ', so no new prices publish.'
      });
    }

    // GATE 3 — hard sales close.
    var closeState = (cfg.states || {}).STATE_C_ENROLLMENT_CLOSED || {};
    var closeAt = parse(closeState.activates);
    if (closeAt && now >= closeAt) {
      return decorate(cfg, 'STATE_C_ENROLLMENT_CLOSED', now, { reason: 'SALES_CLOSED' });
    }

    // GATE 4 — the Fall Access window itself.
    var opens = parse(win.opens);
    var closes = parse(win.closes);
    if (opens && closes && now >= opens && now <= closes) {
      return decorate(cfg, 'STATE_A_FALL_ACCESS', now, { reason: 'IN_WINDOW' });
    }

    // Window has passed (or has not opened yet but we are verified live) => standard.
    return decorate(cfg, 'STATE_B_STANDARD', now, {
      reason: closes && now > closes ? 'WINDOW_CLOSED' : 'OUTSIDE_WINDOW'
    });
  }

  function decorate(cfg, stateKey, now, meta) {
    var def = (cfg.states || {})[stateKey] || {};
    return {
      key: stateKey,
      label: def.label || stateKey,
      now: now,
      priceMode: def.prices || 'standard',
      showCampaignBanner: def.campaign_banner === true,
      showEnrollCtas: def.enroll_ctas !== false,
      fallbackCta: def.fallback_cta || null,
      reason: meta && meta.reason,
      detail: meta && meta.detail,
      config: cfg
    };
  }

  /**
   * Price for a product under the active state.
   * `rail` is 'card' | 'bank_transfer' | 'all_rails'. Falls back gracefully so a
   * product priced one-price-all-rails answers correctly for any rail asked.
   */
  function priceFor(cfg, productKey, state, rail) {
    var p = (cfg.products || {})[productKey];
    if (!p) return null;

    // Flat-priced products (PS tiers) carry `price`, not a pricing table.
    if (typeof p.price === 'number') return p.price;
    if (!p.pricing) return null;

    var mode = state.priceMode === 'fall_access' ? 'fall_access' : 'standard';
    var band = p.pricing[mode];
    if (!band) return null;

    if (typeof band.all_rails === 'number') return band.all_rails;
    if (rail && typeof band[rail] === 'number') return band[rail];
    // Default display price is the card price — the number we post publicly.
    if (typeof band.card === 'number') return band.card;
    var first = Object.keys(band).filter(function (k) { return k.charAt(0) !== '_'; })[0];
    return first ? band[first] : null;
  }

  /** Does this product have a genuinely cheaper bank/Zelle rail right now? */
  function bankAdvantage(cfg, productKey, state) {
    var card = priceFor(cfg, productKey, state, 'card');
    var bank = priceFor(cfg, productKey, state, 'bank_transfer');
    if (typeof card !== 'number' || typeof bank !== 'number') return 0;
    return Math.max(0, card - bank);
  }

  function money(n) {
    if (typeof n !== 'number') return '';
    return '$' + n.toLocaleString('en-US');
  }

  /** Is a product renderable at all, and how? */
  function visibility(cfg, productKey, state) {
    var p = (cfg.products || {})[productKey];
    if (!p) return { render: 'SUPPRESS' };
    if (p.render === 'SUPPRESS' || p.available === false && p.render !== 'VISIBLE_BUT_CLOSED') {
      return { render: p.render === 'VISIBLE_BUT_CLOSED' ? 'VISIBLE_BUT_CLOSED' : 'SUPPRESS' };
    }
    if (p.render === 'VISIBLE_BUT_CLOSED') return { render: 'VISIBLE_BUT_CLOSED' };

    // A product past its own sales_close is closed even if the state is still open.
    var sc = parse(p.sales_close);
    if (sc && state.now > sc) return { render: 'VISIBLE_BUT_CLOSED', reason: 'PRODUCT_SALES_CLOSED' };

    return { render: state.showEnrollCtas ? 'OPEN' : 'VISIBLE_BUT_CLOSED' };
  }

  /**
   * Guard: assert no banned term reaches the DOM. Cheap insurance against the
   * "flex mock" / "unlimited mocks" class of leak, which is a founder-level ban.
   */
  function auditBannedTerms(cfg, rootEl) {
    var banned = ((cfg.mock_entitlement || {}).banned_terms || []).slice();
    var m360 = (cfg.products || {}).match_mentorship_360 || {};
    banned = banned.concat(m360.banned_wording || []);
    var text = (rootEl || document.body).innerText || '';
    var hay = text.toLowerCase();
    var hits = banned.filter(function (t) { return hay.indexOf(String(t).toLowerCase()) !== -1; });
    return { clean: hits.length === 0, violations: hits };
  }

  var API = {
    resolveState: resolveState,
    priceFor: priceFor,
    bankAdvantage: bankAdvantage,
    visibility: visibility,
    money: money,
    auditBannedTerms: auditBannedTerms
  };

  if (typeof module === 'object' && module.exports) module.exports = API;
  root.MMCampaign = API;
})(typeof window !== 'undefined' ? window : globalThis);
