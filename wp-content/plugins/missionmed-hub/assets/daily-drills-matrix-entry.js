(function () {
  "use strict";

  var config = window.MMEDLiveDrillsMatrixEntry || {};
  if (!config.targetUrl) {
    return;
  }

  var mounted = false;
  var observer = null;

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function injectStyles() {
    if (document.getElementById("mmed-live-drills-matrix-entry-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "mmed-live-drills-matrix-entry-style";
    style.textContent = [
      ".mmed-live-drills-nav .sos-nav-icon{background:linear-gradient(135deg,#facc15,#38bdf8);color:#07111f;box-shadow:0 0 18px rgba(56,189,248,.25)}",
      ".mmed-live-drills-card{border-color:rgba(250,204,21,.42)!important;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(7,18,38,.96) 48%,rgba(18,35,69,.94))!important;box-shadow:0 18px 48px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.08)}",
      ".mmed-live-drills-card .mmed-live-drills-chip{display:inline-flex;align-items:center;width:max-content;margin-bottom:10px;padding:4px 8px;border:1px solid rgba(250,204,21,.36);border-radius:999px;background:rgba(250,204,21,.1);color:#fde68a;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}",
      ".mmed-live-drills-card p{margin:0;color:#b9c5e4;font-size:13px;line-height:1.45}",
      ".mmed-live-drills-card .sos-overview-cta{margin-top:14px}"
    ].join("");
    document.head.appendChild(style);
  }

  function createNavItem() {
    var li = document.createElement("li");
    li.setAttribute("data-mmed-live-drills-entry", "nav");
    li.innerHTML = [
      '<a class="sos-nav-link mmed-live-drills-nav" href="' + escapeAttr(config.targetUrl) + '">',
      '<span class="sos-nav-icon">JD</span>',
      '<span>' + escapeHTML(config.label || "Dr J Live Drills") + "</span>",
      '<span class="sos-nav-badge">Live</span>',
      "</a>"
    ].join("");
    return li;
  }

  function mountNav() {
    if (document.querySelector('[data-mmed-live-drills-entry="nav"]')) {
      return true;
    }

    var sections = Array.prototype.slice.call(document.querySelectorAll(".sos-nav-section"));
    var targetList = null;
    sections.some(function (section) {
      var label = section.querySelector(".sos-nav-label");
      if (label && /learning|planning|command/i.test(label.textContent || "")) {
        targetList = section.querySelector(".sos-nav-list");
        return !!targetList;
      }
      return false;
    });

    if (!targetList) {
      targetList = document.querySelector(".sos-nav-list");
    }
    if (!targetList) {
      return false;
    }

    targetList.appendChild(createNavItem());
    return true;
  }

  function mountDashboardCard() {
    if (document.getElementById("mmed-live-drills-entrypoint-card")) {
      return true;
    }

    var grid = document.querySelector(".sos-dashboard-overview .sos-overview-grid");
    if (!grid) {
      return false;
    }

    var card = document.createElement("article");
    card.id = "mmed-live-drills-entrypoint-card";
    card.className = "sos-card sos-overview-card mmed-live-drills-card";
    card.innerHTML = [
      '<div class="sos-overview-card-head">',
      '<h2>' + escapeHTML(config.label || "Dr J Live Drills") + "</h2>",
      "</div>",
      '<span class="mmed-live-drills-chip">' + escapeHTML(config.isAdmin ? "Control Mode" : "Student Mode") + "</span>",
      "<p>" + escapeHTML(config.description || "Join the live Team Challenge room in the Daily Drills shell.") + "</p>",
      '<a class="sos-overview-cta" href="' + escapeAttr(config.targetUrl) + '">' + escapeHTML(config.isAdmin ? (config.adminCta || "Open Control Room") : (config.studentCta || "Open Live Drills")) + "</a>"
    ].join("");

    grid.insertBefore(card, grid.firstChild);
    return true;
  }

  function mount() {
    injectStyles();
    var navReady = mountNav();
    var cardReady = mountDashboardCard();
    mounted = navReady && cardReady;
    return mounted;
  }

  function startObserver() {
    if (observer) {
      return;
    }

    observer = new MutationObserver(function () {
      mount();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function boot() {
    mount();
    startObserver();
    window.setTimeout(mount, 250);
    window.setTimeout(mount, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
