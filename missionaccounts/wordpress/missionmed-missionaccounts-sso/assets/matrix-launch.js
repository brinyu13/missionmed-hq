(function missionAccountsMatrixLaunch() {
  "use strict";

  var config = window.MissionMedMissionAccountsLaunch || {};
  if (!config.target) return;

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
    });
  }

  function ensureModuleDefinition() {
    var os = window.MMED_OS;
    if (!os || !Array.isArray(os.modules) || os.modules.some(function (module) { return module.id === "missionaccounts"; })) return;
    os.modules.push({
      id: "missionaccounts",
      route: "missionaccounts",
      label: "MyMissionMed Account",
      icon: "MA",
      section: "Account",
      launch_url: config.target
    });
  }

  function createNavItem() {
    var item = document.createElement("li");
    item.setAttribute("data-missionaccounts-entry", "nav");
    item.innerHTML = [
      '<a class="sos-nav-link missionaccounts-nav-link" data-missionaccounts-launch href="' + escapeHTML(config.target) + '">',
      '<span class="sos-nav-icon">MA</span>',
      '<span>MyMissionMed Account</span>',
      "</a>"
    ].join("");
    return item;
  }

  function ensureNavItem() {
    if (document.querySelector('[data-missionaccounts-entry="nav"]')) return true;
    var targetList = null;
    Array.prototype.slice.call(document.querySelectorAll(".sos-nav-section")).some(function (section) {
      var label = section.querySelector(".sos-nav-label");
      if (label && /account/i.test(label.textContent || "")) {
        targetList = section.querySelector(".sos-nav-list");
        return !!targetList;
      }
      return false;
    });
    if (!targetList) targetList = document.querySelector("#sos-sidebar .sos-nav-list");
    if (!targetList) return false;
    targetList.appendChild(createNavItem());
    return true;
  }

  function mount() {
    ensureModuleDefinition();
    ensureNavItem();
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest(
      'a[href="#missionaccounts"], a[href$="/missionaccounts/"], [data-missionaccounts-launch], [data-module-id="missionaccounts"], [data-route="missionaccounts"]'
    );
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(config.target);
  }, true);

  function boot() {
    mount();
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
    window.setTimeout(mount, 250);
    window.setTimeout(mount, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
