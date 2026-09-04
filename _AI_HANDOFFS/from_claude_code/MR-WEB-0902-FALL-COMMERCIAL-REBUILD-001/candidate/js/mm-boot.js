/*!
 * MissionMed — preview boot + state time-travel
 * Ticket: MR-WEB-0904A-CODEX-P0-LAUNCH
 *
 * PRODUCTION NOTE FOR CODEX
 *   Everything in this file that renders the striped preview bar is PREVIEW-ONLY
 *   and must be dropped at productionization. The parts that matter in production
 *   are: (a) loading campaign-state.json, (b) resolving state, (c) calling the
 *   page's render(). The `?state=` / `?at=` time-travel exists so Dr. Brian can
 *   see the September 13 state today without anyone editing config.
 */
(function () {
  'use strict';

  var production = window.MM_PRODUCTION === true;
  var qs = production ? new URLSearchParams() : new URLSearchParams(location.search);

  // Preview-only overrides.
  var FORCE = {
    // ?state=A  -> Fall Access Week (simulates verified-live + inside window)
    // ?state=B  -> September 13 standard tuition
    // ?state=P  -> pre-launch / not verified live (the TRUE state today)
    state: qs.get('state'),
    at: qs.get('at')
  };

  var STATE_DATES = {
    A: '2026-09-04T10:00:00-04:00',
    B: '2026-09-13T10:00:00-04:00',
    C: '2026-09-25T10:00:00-04:00'
  };

  function applyPreviewOverrides(cfg) {
    if (production) return { cfg: cfg, at: null, forced: null };
    if (!FORCE.state) return { cfg: cfg, at: FORCE.at || null, forced: null };
    var clone = JSON.parse(JSON.stringify(cfg));
    if (FORCE.state === 'P') {
      clone.campaign.go_live_gate.verified_live_at = null;
      return { cfg: clone, at: null, forced: 'P' };
    }
    // Simulate the founder having verified a real test purchase, so the preview
    // can show what the site looks like AFTER the truth gate opens.
    clone.campaign.go_live_gate.verified_live_at = '2026-09-04T10:00:00-04:00';
    return { cfg: clone, at: FORCE.at || STATE_DATES[FORCE.state] || null, forced: FORCE.state };
  }

  /* Thin, unobtrusive preview toolbar — founder ruling MR-WEB-0902D.
     It floats at the BOTTOM so it never sits between the founder and the hero,
     and it is deliberately outside the production page design. Dismissible, and
     the dismissal sticks for the session. Removed at productionization along
     with applyPreviewOverrides() and the ?state=/?at= parameters. */
  function previewBar(state, forced) {
    if (production) return;
    try { if (sessionStorage.getItem('mm_pv_hidden') === '1') return; } catch (e) {}

    var bar = document.createElement('div');
    bar.className = 'v-pv';
    var simulated = !(forced === 'P' || !forced);

    bar.innerHTML = '<span class="v-pv__dot"></span>' +
      '<span class="v-pv__lbl">Preview &middot; ' + (simulated ? 'simulated' : 'true state') + '</span>';

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Preview campaign state');
    [['',  'Real state now'],
     ['P', 'Pre-launch'],
     ['A', 'Fall Access Week'],
     ['B', 'September 13'],
     ['C', 'Sales closed']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0]; opt.textContent = o[1];
      if (o[0] === (FORCE.state || '')) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      var u = new URL(location.href);
      if (sel.value) u.searchParams.set('state', sel.value); else u.searchParams.delete('state');
      u.searchParams.delete('at');
      location.href = u.toString();
    });
    bar.appendChild(sel);

    var rev = document.createElement('a');
    rev.href = '../review/index.html' + (FORCE.state ? '?state=' + FORCE.state : '');
    rev.textContent = 'Review notes';
    bar.appendChild(rev);

    var hide = document.createElement('button');
    hide.className = 'v-pv__hide'; hide.type = 'button';
    hide.setAttribute('aria-label', 'Hide preview toolbar');
    hide.innerHTML = '&times;';
    hide.addEventListener('click', function () {
      try { sessionStorage.setItem('mm_pv_hidden', '1'); } catch (e) {}
      bar.remove();
    });
    bar.appendChild(hide);

    document.body.appendChild(bar);
  }

  window.MMBoot = function (render) {
    fetch(window.MM_CONFIG_URL || '../config/campaign-state.json')
      .then(function (r) {
        if (!r.ok) throw new Error('config HTTP ' + r.status);
        return r.json();
      })
      .then(function (raw) {
        var o = applyPreviewOverrides(raw);
        var state = window.MMCampaign.resolveState(o.cfg, o.at);
        previewBar(state, o.forced);
        render(o.cfg, state);

        // Self-audit: banned customer-facing terms must never reach the DOM.
        var audit = window.MMCampaign.auditBannedTerms(o.cfg, document.body);
        if (!audit.clean) {
          console.error('[MM BANNED TERM LEAK]', audit.violations);
        } else {
          console.info('[MM] banned-term audit clean · state=' + state.key + ' (' + state.reason + ')');
        }
        window.__MM_AUDIT__ = { state: state.key, reason: state.reason, banned: audit };
      })
      .catch(function (e) {
        console.error('[MM] boot failed', e);
        var p = document.createElement('pre');
        p.style.cssText = 'padding:24px;color:#f0d68c;font-family:monospace;white-space:pre-wrap';
        p.textContent = 'Preview failed to load campaign-state.json.\n\n' + e.message +
          '\n\nServe this folder over HTTP (see 10_FOUNDER_REVIEW_GUIDE.md) — opening the file directly with file:// blocks fetch().';
        document.body.appendChild(p);
      });
  };
})();
