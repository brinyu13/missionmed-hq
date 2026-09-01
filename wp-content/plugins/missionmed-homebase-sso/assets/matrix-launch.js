(() => {
  'use strict';

  const settings = window.MissionMedStoryForgeLaunch || {};
  let target;
  try {
    target = new URL(String(settings.target || ''), window.location.origin);
  } catch {
    return;
  }
  if (target.origin !== window.location.origin || !target.pathname.startsWith('/storyforge/')) {
    return;
  }

  const matrixPath = String(settings.matrixPath || '/member-dashboard/').replace(/\/+$/, '') || '/';
  const onMatrix = () => window.location.pathname.replace(/\/+$/, '') === matrixPath;
  const storyForgeControl = (node) => {
    if (!(node instanceof Element)) return null;
    return node.closest('a[href="#storyforge"], [data-route="storyforge"]');
  };
  const launch = (replace = false) => {
    if (replace) window.location.replace(target.href);
    else window.location.assign(target.href);
  };

  document.addEventListener('click', (event) => {
    if (!onMatrix() || !storyForgeControl(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    launch(false);
  }, true);

  const launchDirectHash = () => {
    if (onMatrix() && window.location.hash.toLowerCase() === '#storyforge') {
      launch(true);
    }
  };
  window.addEventListener('hashchange', launchDirectHash);
  launchDirectHash();
})();
