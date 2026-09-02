/*!
 * MissionMed — preview boot + state time-travel
 * Ticket: MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001
 *
 * PRODUCTION NOTE FOR CODEX
 *   Everything in this file that renders the striped preview bar is PREVIEW-ONLY
 *   and must be dropped at productionization. The parts that matter in production
 *   are: (a) loading campaign-state.json, (b) resolving state, (c) calling the
 *   page's render(). The `?state=` / `?at=` time-travel exists so Dr. Brian can
 *   see the September 8 state today without anyone editing config.
 */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);

  // Preview-only overrides.
  var FORCE = {
    // ?state=A  -> Fall Access Week (simulates verified-live + inside window)
    // ?state=B  -> September 8 standard tuition
    // ?state=P  -> pre-launch / not verified live (the TRUE state today)
    state: qs.get('state'),
    at: qs.get('at')
  };

  var STATE_DATES = {
    A: '2026-09-03T10:00:00-04:00',
    B: '2026-09-09T10:00:00-04:00',
    C: '2026-09-25T10:00:00-04:00'
  };

  function applyPreviewOverrides(cfg) {
    if (!FORCE.state) return { cfg: cfg, at: FORCE.at || null, forced: null };
    var clone = JSON.parse(JSON.stringify(cfg));
    if (FORCE.state === 'P') {
      clone.campaign.go_live_gate.verified_live_at = null;
      return { cfg: clone, at: null, forced: 'P' };
    }
    // Simulate the founder having verified a real test purchase, so the preview
    // can show what the site looks like AFTER the truth gate opens.
    clone.campaign.go_live_gate.verified_live_at = '2026-09-02T12:00:00-04:00';
    return { cfg: clone, at: FORCE.at || STATE_DATES[FORCE.state] || null, forced: FORCE.state };
  }

  function previewBar(state, forced) {
    var bar = document.createElement('div');
    bar.className = 'mmc-previewbar';
    var truth = forced === 'P' || !forced
      ? 'TRUE state today (campaign not yet verified live)'
      : 'SIMULATED for review';
    bar.innerHTML =
      '<b>FOUNDER PREVIEW</b> — not production. ' +
      '<span>State: <b>' + state.key + '</b> (' + state.label + ') · ' + truth + '</span>';

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Preview campaign state');
    [['', 'Real state (as configured)'],
     ['P', 'Pre-launch — not verified live'],
     ['A', 'Fall Access Week (Sept 2–7)'],
     ['B', 'September 8 — standard tuition'],
     ['C', 'Sales closed (Sept 22+)']].forEach(function (o) {
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

    var home = document.createElement('a');
    home.href = 'index.html' + (FORCE.state ? '?state=' + FORCE.state : '');
    home.textContent = '← All preview pages';
    bar.appendChild(home);

    document.body.insertBefore(bar, document.body.firstChild);
  }

  window.MMBoot = function (render) {
    fetch('../config/campaign-state.json')
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
