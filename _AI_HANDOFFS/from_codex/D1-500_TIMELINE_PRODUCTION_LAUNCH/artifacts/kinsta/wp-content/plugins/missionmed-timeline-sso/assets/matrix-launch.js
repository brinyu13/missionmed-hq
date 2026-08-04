(() => {
  "use strict";
  const config = window.MissionMedTimelineLaunch;
  if (!config?.target) return;

  const openTimeline = () => window.location.assign(config.target);
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('[data-missionmed-product="timeline"], [data-app-id="timeline"]');
    if (!trigger) return;
    event.preventDefault();
    openTimeline();
  });

  if (window.location.hash === "#timeline") openTimeline();
})();
