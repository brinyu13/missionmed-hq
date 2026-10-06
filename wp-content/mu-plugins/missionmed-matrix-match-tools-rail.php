<?php
/**
 * Plugin Name: MissionMed Matrix MATCH TOOLS Rail
 * Description: MX-DASH-6050A navigation grouping only; existing app owners retain access decisions.
 */
if (!defined('ABSPATH')) { exit; }

function mmed_match_tools_rail_6050a() {
    $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (!is_user_logged_in() || !in_array($path, array('/member-dashboard', '/member-dashboard/'), true)) { return; }
    ?>
    <style id="mmed-match-tools-rail-status-6050a">
    #sos-sidebar [data-mmed-rail-group] { margin: 15px 12px 7px; }
    #sos-sidebar [data-mmed-rail-group] > .sos-nav-label {
        margin: 0; padding: 10px 12px; border: 1px solid #46556a; border-left: 3px solid #d4b675;
        border-radius: 4px; background: #1c2c40; color: #f0dfb6;
        font-size: 11px; font-weight: 800; line-height: 1.35; letter-spacing: .09em;
    }
    #sos-sidebar a[data-mmed-maturity] {
        display: grid; grid-template-columns: 24px minmax(0, 1fr) auto;
        column-gap: 10px; row-gap: 3px; align-items: center;
    }
    #sos-sidebar a[data-mmed-maturity] > .sos-nav-icon { grid-column: 1; grid-row: 1 / 3; }
    #sos-sidebar a[data-mmed-maturity] > span:not(.sos-nav-icon):not(.sos-nav-badge):not(.mmed-rail-status) {
        grid-column: 2; grid-row: 1; min-width: 0;
    }
    #sos-sidebar a[data-mmed-maturity] > .sos-nav-lock-icon,
    #sos-sidebar a[data-mmed-maturity] > .sos-nav-badge { grid-column: 3; grid-row: 1 / 3; }
    #sos-sidebar .mmed-rail-status {
        grid-column: 2; grid-row: 2; justify-self: start; max-width: 100%;
        padding: 1px 5px; border: 1px solid #526376; border-radius: 3px;
        background: #132234; color: #c4d0de; font-size: 9px; font-weight: 600;
        line-height: 1.5; letter-spacing: .015em; white-space: nowrap; pointer-events: none;
    }
    #sos-sidebar .mmed-rail-status[data-status="ready"] { color: #b9dfcd; border-color: #466c61; }
    #sos-sidebar .mmed-rail-status[data-status="development"] { color: #e5d4ae; border-color: #72674e; }
    </style>
    <script id="mmed-match-tools-rail-6050a">
    (function () {
        'use strict';
        var groups = [
            ['FULL SEASON', ['HomeBase', 'RISE', 'StoryForge', 'File Vault']],
            ['APPLICATION PERIOD', ['PS Forge', 'LOR Studio']],
            ['INTERVIEW SEASON', ['Interview IQ', 'IV Prep On-Call', 'RankList IQ', 'IV Ready Gear']]
        ];
        // Founder-authoritative product maturity only; never used for access decisions.
        var maturity = {
            calendar: ['ready', '✓ Ready'], rise: ['ready', '✓ Ready'],
            storyforge: ['ready', '✓ Ready'], filevault: ['ready', '✓ Ready'],
            ivreadygear: ['ready', '✓ Ready'], interviewiq: ['preview', '◇ Preview'],
            lorstudio: ['preview', '◇ Preview'], 'ivprepon-call': ['preview', '◇ Preview'],
            ranklistiq: ['preview', '◇ Preview'], homebase: ['development', '🚧 In Development'],
            psforge: ['development', '🚧 In Development']
        };
        function key(value) { return value.replace(/\s+/g, '').toLowerCase(); }
        function labelNode(link) {
            return Array.prototype.find.call(link.children, function (node) {
                return node.tagName === 'SPAN' && !node.classList.contains('sos-nav-icon') && !node.classList.contains('sos-nav-badge') && !node.classList.contains('mmed-rail-status');
            });
        }
        function organize() {
            if (!window.mmedDashboardV2 || window.mmedDashboardV2.experience !== 'matrix2') { return; }
            var sidebar = document.getElementById('sos-sidebar');
            if (!sidebar) { return; }
            var section = Array.prototype.find.call(sidebar.querySelectorAll('.sos-nav-section'), function (node) {
                var label = node.querySelector('.sos-nav-label');
                return label && label.textContent.trim() === 'MATCH TOOLS';
            });
            var list = section && section.querySelector('.sos-nav-list');
            if (!list) { return; }
            observer.disconnect();
            try {
                var entries = {};
                Array.prototype.forEach.call(list.querySelectorAll('a.sos-nav-link'), function (link) {
                    var label = labelNode(link);
                    if (label) { entries[key(label.textContent)] = { item: link.parentElement, link: link, label: label }; }
                });
                var gear = entries.ivreadygear;
                if (!gear) {
                    var item = document.createElement('li');
                    var link = document.createElement('a');
                    link.className = 'sos-nav-link';
                    link.href = 'https://missionmedinstitute.com/interview-ready/#home';
                    link.innerHTML = '<span class="sos-nav-icon" aria-hidden="true">IG</span><span>IV Ready Gear</span>';
                    item.appendChild(link);
                    gear = { item: item, link: link, label: labelNode(link) };
                    entries.ivreadygear = gear;
                }
                var desired = [];
                groups.forEach(function (group, index) {
                    var heading = list.querySelector('[data-mmed-rail-group="' + index + '"]');
                    if (!heading) {
                        heading = document.createElement('li');
                        heading.setAttribute('data-mmed-rail-group', String(index));
                        var title = document.createElement('div');
                        title.className = 'sos-nav-label';
                        title.textContent = group[0];
                        heading.appendChild(title);
                    }
                    desired.push(heading);
                    group[1].forEach(function (name) {
                        var entry = entries[key(name)];
                        // Never synthesize an existing app omitted by its eligibility owner.
                        if (!entry) { return; }
                        if (entry.label.textContent !== name) { entry.label.textContent = name; }
                        if (entry.link.hasAttribute('aria-label') && /^(Open PSForge|InterviewIQ)$/.test(entry.link.getAttribute('aria-label'))) {
                            entry.link.setAttribute('aria-label', name);
                        }
                        if (entry.item.hidden) { entry.item.hidden = false; }
                        desired.push(entry.item);
                    });
                });
                // Retain hidden nodes so owner observers do not recreate omitted rail entries.
                var extras = Array.prototype.filter.call(list.children, function (item) { return desired.indexOf(item) === -1; });
                extras.forEach(function (item) { if (!item.hidden) { item.hidden = true; } });
                var order = desired.concat(extras);
                if (order.some(function (item, index) { return list.children[index] !== item; })) {
                    order.forEach(function (item) { list.appendChild(item); });
                }
                Array.prototype.forEach.call(sidebar.querySelectorAll('a.sos-nav-link'), function (link) {
                    var label = labelNode(link);
                    var status = label && maturity[key(label.textContent)];
                    if (!status || link.closest('[hidden]')) { return; }
                    var badge = link.querySelector('.mmed-rail-status');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'mmed-rail-status';
                        badge.title = 'Product maturity — separate from your access';
                        link.appendChild(badge);
                    }
                    if (link.getAttribute('data-mmed-maturity') !== status[0]) { link.setAttribute('data-mmed-maturity', status[0]); }
                    if (badge.getAttribute('data-status') !== status[0]) { badge.setAttribute('data-status', status[0]); }
                    if (badge.textContent !== status[1]) { badge.textContent = status[1]; }
                });
            } finally {
                observer.observe(sidebar, { childList: true, subtree: true });
            }
        }
        var observer = new MutationObserver(organize);
        var root = document.getElementById('student-os-root');
        if (root) { observer.observe(root, { childList: true, subtree: true }); }
        organize();
        window.addEventListener('pagehide', function () { observer.disconnect(); }, { once: true });
    })();
    </script>
    <?php
}
add_action('wp_footer', 'mmed_match_tools_rail_6050a', 99);
