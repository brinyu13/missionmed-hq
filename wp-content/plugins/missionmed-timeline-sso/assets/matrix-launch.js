(() => {
  "use strict";
  const config = window.MissionMedTimelineLaunch;
  if (!config?.target) return;
  const TIMELINE_SELECTOR =
    '[data-missionmed-product="timeline"], [data-app-id="timeline"], a.sos-nav-link[href="#timeline"]';

  const openTimeline = () => window.location.assign(config.target);
  const normalizeTimelineLink = (candidate) => {
    const link = candidate?.matches?.("a") ? candidate : candidate?.querySelector?.("a");
    if (!link) return false;
    link.href = config.target;
    link.dataset.missionmedProduct = "timeline";
    link.dataset.appId = "timeline";
    link.setAttribute("aria-label", "Timeline Builder");
    const label = link.querySelector(".sos-nav-label") || link.querySelector("span:last-child");
    // This function runs from a childList MutationObserver. Replacing an
    // already-canonical text node would trigger the observer again forever.
    if (label && label.textContent !== "Timeline") label.textContent = "Timeline";
    return true;
  };

  const ensureNavigationEntry = () => {
    const existing = [...document.querySelectorAll(TIMELINE_SELECTOR)];
    if (existing.some(normalizeTimelineLink)) return true;

    const storyForgeLink = document.querySelector('a.sos-nav-link[href="#storyforge"]');
    const storyForgeItem = storyForgeLink?.parentElement;
    const matchPrepList = storyForgeItem?.parentElement;
    if (storyForgeItem?.tagName !== "LI" || matchPrepList?.tagName !== "UL") return false;

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
    return true;
  };

  const isTimelineHash = () => window.location.hash.toLowerCase() === "#timeline";

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(TIMELINE_SELECTOR);
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openTimeline();
  }, true);

  window.addEventListener("hashchange", () => {
    ensureNavigationEntry();
    if (isTimelineHash()) openTimeline();
  });

  window.addEventListener("pageshow", ensureNavigationEntry);

  const watchForMatrixNavigation = () => {
    ensureNavigationEntry();
    if (!document.body || typeof MutationObserver !== "function") return;
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        ensureNavigationEntry();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchForMatrixNavigation, { once: true });
  } else {
    watchForMatrixNavigation();
  }

  if (isTimelineHash()) openTimeline();
})();
