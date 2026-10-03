<?php
/** Plugin Name: MissionMed Matrix InterviewIQ Entry
 * Description: Bounded IIQ-1201 launcher using the current Matrix sidebar pattern.
 */
if (!defined('ABSPATH')) { exit; }
function mmiiq_matrix_entry() {
    if (!is_user_logged_in() || !function_exists('mmiiq_enabled') || !mmiiq_enabled()) { return; }
    $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (!in_array($path, array('/member-dashboard', '/member-dashboard/'), true)) { return; }
    if (is_wp_error(mmiiq_access_for_user(wp_get_current_user()))) { return; }
    ?>
    <script id="missionmed-matrix-interviewiq-entry">
    (function () {
      'use strict';
      function install() {
        var sidebar = document.getElementById('sos-sidebar');
        if (!sidebar || sidebar.querySelector('[data-mmed-interviewiq-entry]')) return false;
        var section = document.createElement('div');
        section.className = 'sos-nav-section';
        section.setAttribute('data-mmed-interviewiq-entry', 'true');
        section.innerHTML = '<div class="sos-nav-label">INTERVIEW SEASON</div><ul class="sos-nav-list"><li><a class="sos-nav-link" href="/interviewiq/"><span class="sos-nav-icon">IQ</span><span>InterviewIQ</span></a></li></ul>';
        sidebar.insertBefore(section, sidebar.querySelector('.sos-sidebar-footer') || null);
        return true;
      }
      if (install()) return;
      var observer = new MutationObserver(function () { if (install()) observer.disconnect(); });
      observer.observe(document.documentElement, {childList:true,subtree:true});
      window.setTimeout(function () { observer.disconnect(); }, 15000);
    }());
    </script>
    <?php
}
add_action('wp_footer', 'mmiiq_matrix_entry', 41);
