(() => {
  "use strict";
  const config = window.MissionMedTimelineLaunch;
  if (!config?.target) return;

  const openTimeline = () => window.location.assign(config.target);
  const ensureNavigationEntry = () => {
    if (document.querySelector('[data-missionmed-product="timeline"], [data-app-id="timeline"]')) return;

    const storyForgeLink = document.querySelector('a.sos-nav-link[href="#storyforge"]');
    const storyForgeItem = storyForgeLink?.parentElement;
    const matchPrepList = storyForgeItem?.parentElement;
    if (storyForgeItem?.tagName !== "LI" || matchPrepList?.tagName !== "UL") return;

    const item = document.createElement("li");
    const link = document.createElement("a");
    const icon = document.createElement("span");
    const label = document.createElement("span");

    link.className = storyForgeLink.className || "sos-nav-link";
    link.href = config.target;
    link.dataset.missionmedProduct = "timeline";
    link.dataset.appId = "timeline";
    link.setAttribute("aria-label", "Timeline Builder");
    icon.className = "sos-nav-icon";
    icon.textContent = "TL";
    label.textContent = "Timeline";
    link.append(icon, label);
    item.append(link);
    matchPrepList.insertBefore(item, storyForgeItem.nextSibling);
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('[data-missionmed-product="timeline"], [data-app-id="timeline"]');
    if (!trigger) return;
    event.preventDefault();
    openTimeline();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureNavigationEntry, { once: true });
  } else {
    ensureNavigationEntry();
  }

  if (window.location.hash === "#timeline") openTimeline();
})();
