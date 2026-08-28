<?php
/**
 * Plugin Name: MissionMed Matrix RISE Entry
 * Description: Adds the authenticated RISE entry to the current Matrix sidebar.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function mmrise_matrix_entry() {
    if (!is_user_logged_in()) {
        return;
    }
    $path = isset($_SERVER['REQUEST_URI']) ? (string) wp_parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
    if ($path !== '/member-dashboard/' && $path !== '/member-dashboard') {
        return;
    }
    ?>
    <script id="missionmed-matrix-rise-entry">
    (function () {
      'use strict';
      function installRiseEntry() {
        var sidebar = document.getElementById('sos-sidebar');
        if (!sidebar || sidebar.querySelector('[data-mmed-rise-entry]')) return false;
        var footer = sidebar.querySelector('.sos-sidebar-footer');
        var section = document.createElement('div');
        section.className = 'sos-nav-section';
        section.setAttribute('data-mmed-rise-entry', 'true');
        section.innerHTML = '<div class="sos-nav-label">PROGRAM INTELLIGENCE</div><ul class="sos-nav-list"><li><a class="sos-nav-link" href="/rise/"><span class="sos-nav-icon">RI</span><span>RISE</span></a></li></ul>';
        sidebar.insertBefore(section, footer || null);
        return true;
      }
      if (installRiseEntry()) return;
      var observer = new MutationObserver(function () { installRiseEntry(); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.setTimeout(function () { observer.disconnect(); }, 15000);
    }());
    </script>
    <?php
}

add_action('wp_footer', 'mmrise_matrix_entry', 40);
