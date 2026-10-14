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
    /* Timeline's owner normalizes its text to "Timeline" from its own observer.
       Keep that source text stable; add the rail-only display suffix without
       childList mutations that would make the two owners trigger each other. */
    #sos-sidebar [data-mmed-timeline-label="short"]::after { content: " Builder"; }
    #student-os-root .mmed-arena-entry {
        display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        margin: 24px 0; overflow: hidden; border: 1px solid #52677e; border-radius: 12px;
        background: #112438; color: #f5f8fc; text-decoration: none; text-align: left;
    }
    #student-os-root .mmed-arena-entry:focus-visible { outline: 3px solid #e8c478; outline-offset: 4px; }
    #student-os-root .mmed-arena-visual { display: flex; align-items: center; background: #102033; }
    #student-os-root .mmed-arena-visual img { display: block; width: 100%; height: auto; aspect-ratio: 600 / 335; object-fit: contain; }
    #student-os-root .mmed-arena-copy { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 12px; padding: clamp(20px, 3vw, 36px); min-width: 0; }
    #student-os-root .mmed-arena-kicker { color: #e8c478; font-size: 10px; font-weight: 800; letter-spacing: .16em; }
    #student-os-root .mmed-arena-copy strong { font-size: clamp(24px, 3vw, 36px); line-height: 1.1; letter-spacing: -.02em; }
    #student-os-root .mmed-arena-promise { color: #d1dce8; font-size: 14px; line-height: 1.5; }
    #student-os-root .mmed-arena-cta { padding: 10px 15px; border-radius: 6px; background: #e8c478; color: #132234; font-size: 13px; font-weight: 800; line-height: 1.4; }
    #student-os-root .mmed-arena-lock { display: none; color: #d1dce8; font-size: 12px; }
    #student-os-root .mmed-arena-entry:is([data-locked="true"], [aria-disabled="true"]) .mmed-arena-lock { display: block; }
    #student-os-root .mmed-arena-entry[data-image-failed] { grid-template-columns: 1fr; }
    #student-os-root .mmed-arena-entry[data-image-failed] .mmed-arena-visual { display: none; }
    @media (max-width: 600px) {
        #student-os-root .mmed-arena-entry { grid-template-columns: 1fr; }
        #student-os-root .mmed-arena-copy { padding: 22px; }
    }
    </style>
    <script id="mmed-match-tools-rail-6050a">
    (function () {
        'use strict';
        var groups = [
            ['FULL SEASON', ['HomeBase', 'RISE', 'StoryForge', 'File Vault']],
            ['APPLICATION PERIOD', ['PS Forge', 'LOR Studio']],
            ['INTERVIEW SEASON', ['Interview IQ', 'IV Prep On-Call', 'RankList IQ', 'Timeline Builder', 'IV Ready Gear']],
            ['PRACTICE', ['Arena']]
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
        var catalogRecords = [];
        var observerOptions = { childList: true, subtree: true, attributes: true,
            attributeFilter: ['href', 'hidden', 'data-locked', 'aria-disabled', 'data-route', 'data-app-id'] };
        // Remove only redundant discovery UI, never an app's access/navigation owner.
        function removeCoveredCatalog(dashboard, sidebar) {
            if (!dashboard) { return; }
            var owners = Array.prototype.filter.call(sidebar.querySelectorAll('a.sos-nav-link'), function (link) {
                return !link.closest('[hidden]');
            });
            catalogRecords = catalogRecords.filter(function (record) { return record.marker.isConnected; });
            Array.prototype.forEach.call(dashboard.querySelectorAll('.mmdv2-sechead'), function (heading) {
                var title = heading.querySelector('.mmdv2-h2');
                var catalog = heading.nextElementSibling;
                if (!title || title.textContent.trim() !== 'Everything else in Matrix' ||
                    !catalog || !catalog.classList.contains('mmdv2-catalog')) { return; }
                if (catalogRecords.some(function (record) { return record.heading === heading; })) { return; }
                var marker = document.createComment('GX catalog discovery position');
                heading.before(marker);
                catalogRecords.push({ heading: heading, catalog: catalog, marker: marker });
            });
            catalogRecords.forEach(function (record) {
                var heading = record.heading;
                var catalog = record.catalog;
                var cards = Array.prototype.slice.call(catalog.querySelectorAll('a.mmdv2-acard'));
                function isLocked(link) {
                    return link.getAttribute('aria-disabled') === 'true' || link.getAttribute('data-locked') === 'true';
                }
                var covered = cards.length > 0 && cards.every(function (card) {
                    var lockedRoute = card.getAttribute('data-catalog-locked');
                    var href = card.getAttribute('href');
                    return owners.filter(function (owner) {
                        if (lockedRoute) {
                            return isLocked(card) && isLocked(owner) && owner.getAttribute('data-route') === lockedRoute;
                        }
                        if (!href || href === '#' || href === '#dashboard' || /^javascript:/i.test(href) || isLocked(owner)) { return false; }
                        // Verified native Timeline launcher replaces the legacy shell hash.
                        if (href === '#timeline' && owner.getAttribute('data-app-id') === 'timeline') {
                            return owner.getAttribute('href') === 'https://missionmedinstitute.com/timeline/';
                        }
                        return owner.getAttribute('href') === href;
                    }).length === 1;
                });
                // Missing, ambiguous or newly introduced destinations retain their discovery UI.
                if (covered) { heading.remove(); catalog.remove(); }
                else if (!heading.isConnected || !catalog.isConnected) {
                    // Restore the original nodes/listeners if an eligibility owner disappears.
                    record.marker.after(heading, catalog);
                }
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
                // The owning launcher labels its existing Timeline Builder node "Timeline".
                if (!entries.timelinebuilder && entries.timeline) { entries.timelinebuilder = entries.timeline; }
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
                        if (name === 'Timeline Builder') {
                            if (entry.label.textContent === 'Timeline') {
                                entry.label.setAttribute('data-mmed-timeline-label', 'short');
                            } else {
                                entry.label.removeAttribute('data-mmed-timeline-label');
                            }
                        } else if (entry.label.textContent !== name) { entry.label.textContent = name; }
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
                // Delegate to the eligible owner's node; never synthesize access.
                var dashboard = document.querySelector('.mmdv2-in');
                removeCoveredCatalog(dashboard, sidebar);
                var arenaEntry = document.querySelector('.mmed-arena-entry');
                if (!entries.arena && arenaEntry) { arenaEntry.remove(); }
                if (entries.arena && dashboard) {
                    if (!arenaEntry) {
                        arenaEntry = document.createElement('a');
                        arenaEntry.className = 'mmed-arena-entry';
                        arenaEntry.innerHTML = '<picture class="mmed-arena-visual"><source media="(max-width: 600px)" srcset="https://missionmedinstitute.com/wp-content/uploads/2026/04/bg_missionmed_arena_v2_blue._assets-300x167.png"><img src="https://missionmedinstitute.com/wp-content/uploads/2026/04/bg_missionmed_arena_v2_blue._assets-600x335.png" width="600" height="335" loading="lazy" decoding="async" alt=""></picture><span class="mmed-arena-copy"><span class="mmed-arena-kicker">KNOWLEDGE INTO PRACTICE</span><strong>MissionMed Arena</strong><span class="mmed-arena-promise">Put your medical knowledge to the test.</span><span class="mmed-arena-lock">🔒 Your current access applies</span><span class="mmed-arena-cta">Enter Arena →</span></span>';
                        arenaEntry.querySelector('img').addEventListener('error', function () {
                            this.closest('.mmed-arena-entry').setAttribute('data-image-failed', 'true');
                        }, { once: true });
                        arenaEntry.addEventListener('click', function (event) {
                            event.preventDefault();
                            var owner = Array.prototype.find.call(document.querySelectorAll('#sos-sidebar a.sos-nav-link'), function (link) {
                                var label = labelNode(link); return label && key(label.textContent) === 'arena';
                            });
                            if (owner) { owner.click(); }
                        });
                        dashboard.appendChild(arenaEntry);
                    }
                    ['href', 'aria-disabled', 'data-locked'].forEach(function (attribute) {
                        var value = entries.arena.link.getAttribute(attribute);
                        if (value === null) { arenaEntry.removeAttribute(attribute); }
                        else if (arenaEntry.getAttribute(attribute) !== value) { arenaEntry.setAttribute(attribute, value); }
                    });
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
                observer.observe(root || sidebar, observerOptions);
            }
        }
        var observer = new MutationObserver(organize);
        var root = document.getElementById('student-os-root');
        if (root) { observer.observe(root, observerOptions); }
        organize();
        window.addEventListener('pagehide', function () { observer.disconnect(); }, { once: true });
    })();
    </script>
    <?php
}
add_action('wp_footer', 'mmed_match_tools_rail_6050a', 99);
