(function missionAccountsMatrixLaunch() {
  const config = window.MissionMedMissionAccountsLaunch || {};
  if (!config.target) return;
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#missionaccounts"], [data-missionaccounts-launch]');
    if (!link) return;
    event.preventDefault();
    window.location.assign(config.target);
  });
})();
