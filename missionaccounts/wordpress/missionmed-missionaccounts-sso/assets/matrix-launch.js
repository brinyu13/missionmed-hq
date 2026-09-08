(function missionAccountsMatrixLaunch() {
  var config = window.MissionMedMissionAccountsLaunch || {};
  if (!config.target) return;
  document.addEventListener('click', function (event) {
    var link = event.target.closest(
      'a[href="#missionaccounts"], a[href$="/missionaccounts/"], [data-missionaccounts-launch], [data-module-id="missionaccounts"], [data-route="missionaccounts"]'
    );
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(config.target);
  }, true);
})();
