<?php
/**
 * Plugin Name: MissionMed Matrix Selected Avatar Projection
 * Description: Dashboard-native, read-only Arena selected-avatar contract v1 (DR-425).
 */
if (!defined('ABSPATH')) { exit; }

function mmed_gx_avatar_projection() {
    nocache_headers();
    header('Cache-Control: private, no-store, max-age=0');
    header('Vary: Cookie', false);
    $subject = get_current_user_id();
    if (!$subject || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' ||
        !check_ajax_referer('mmed_gx_avatar_v1', 'nonce', false)) {
        wp_send_json_error(array('code' => 'not_authorized'), 403);
        return;
    }
    // Identity is exclusively the authenticated subject; no proxy/subject parameters.
    if (array_diff(array_keys($_POST), array('action', 'nonce')) ||
        array_diff(array_keys($_GET), array())) {
        wp_send_json_error(array('code' => 'invalid_request'), 400);
        return;
    }
    $empty = array('version' => 1, 'available' => false);
    if (!class_exists('MMED_Supabase_Bridge') || !function_exists('mmsf_arena_avatar_for_user')) {
        wp_send_json_success($empty);
        return;
    }
    // Never allow the existing bridge's cold Auth lookup / metadata-write branch.
    $cached = sanitize_text_field(get_user_meta($subject, MMED_Supabase_Bridge::USER_META_UUID, true));
    if (!MMED_Supabase_Bridge::is_valid_uuid($cached)) {
        wp_send_json_success($empty);
        return;
    }
    try {
        $avatar = mmsf_arena_avatar_for_user($subject);
    } catch (Throwable $error) {
        wp_send_json_success($empty);
        return;
    }
    $url = is_array($avatar) ? (string) ($avatar['avatar_url'] ?? '') : '';
    $parts = wp_parse_url($url);
    if (!is_array($avatar) || ($avatar['source'] ?? '') !== 'arena_lobby' ||
        !MMED_Supabase_Bridge::is_valid_uuid($avatar['active_avatar_id'] ?? '') ||
        !is_array($parts) || ($parts['scheme'] ?? '') !== 'https' ||
        ($parts['host'] ?? '') !== 'cdn.missionmedinstitute.com' ||
        isset($parts['user']) || isset($parts['pass']) || isset($parts['port']) ||
        isset($parts['query']) || isset($parts['fragment']) || empty($parts['path'])) {
        wp_send_json_success($empty);
        return;
    }
    wp_send_json_success(array('version' => 1, 'available' => true,
        'activeAvatarId' => $avatar['active_avatar_id'], 'imageUrl' => $url));
}
add_action('wp_ajax_mmed_gx_avatar_v1', 'mmed_gx_avatar_projection');

function mmed_gx_avatar_dashboard() {
    $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (!is_user_logged_in() || !in_array($path, array('/member-dashboard', '/member-dashboard/'), true)) { return; }
    $config = array('url' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce('mmed_gx_avatar_v1'));
    ?>
    <style id="mmed-gx-avatar-style-v1">
    #student-os-root .mmdv2-hero[data-gx-avatar] { display:grid; grid-template-columns:minmax(0,1fr) clamp(160px,20vw,240px); column-gap:24px; align-items:center; max-width:1080px; }
    .mmdv2-hero[data-gx-avatar] > .mmdv2-h1 { grid-column:1; grid-row:1; }
    .mmdv2-hero[data-gx-avatar] > .mmdv2-lede { grid-column:1; grid-row:2; }
    .mmdv2-hero[data-gx-avatar] > .mmdv2-launcher { grid-column:1; grid-row:3; min-width:0; width:100%; box-sizing:border-box; }
    .mmdv2-hero[data-gx-avatar] > .mmdv2-chips { grid-column:1; grid-row:4; }
    .mmdv2-hero > .mmed-gx-avatar { grid-column:2; grid-row:1 / 5; margin:0; width:100%; min-width:0; align-self:center; }
    .mmed-gx-avatar img { display:block; width:100%; height:320px; object-fit:contain; object-position:center; }
    @media(max-width:600px) {
        #student-os-root .mmdv2-hero[data-gx-avatar] { grid-template-columns:minmax(0,1fr) 100px; column-gap:10px; }
        #student-os-root .mmdv2-hero[data-gx-avatar] > .mmdv2-h1 { font-size:clamp(26px,7vw,34px); }
        .mmdv2-hero[data-gx-avatar] > .mmdv2-lede,
        .mmdv2-hero[data-gx-avatar] > .mmdv2-launcher,
        .mmdv2-hero[data-gx-avatar] > .mmdv2-chips { grid-column:1 / -1; }
        .mmdv2-hero > .mmed-gx-avatar { grid-row:1; }
        .mmed-gx-avatar img { height:190px; }
    }
    </style>
    <script id="mmed-gx-avatar-v1">
    (function (config) {
        'use strict';
        var requested = false, selected = null, ended = false, requestController = null;
        var pendingHeroes = new WeakSet();
        var root = document.getElementById('student-os-root');
        if (!root) { return; }
        function mount() {
            if (ended || !window.mmedDashboardV2 || window.mmedDashboardV2.experience !== 'matrix2') { return; }
            var hero = root.querySelector('.mmdv2-in .mmdv2-hero');
            if (!hero) { return; }
            if (!requested) {
                requested = true;
                // Yield a paint; this request is never a prerequisite for Dashboard readiness.
                requestAnimationFrame(function () { setTimeout(load, 0); });
            }
            if (!selected || hero.querySelector('.mmed-gx-avatar') || pendingHeroes.has(hero)) { return; }
            pendingHeroes.add(hero);
            var figure = document.createElement('figure');
            figure.className = 'mmed-gx-avatar';
            var image = document.createElement('img');
            image.alt = 'Your selected Arena avatar';
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            image.addEventListener('load', function () {
                if (ended || !hero.isConnected || hero.querySelector('.mmed-gx-avatar')) { return; }
                hero.setAttribute('data-gx-avatar', 'v1');
                hero.appendChild(figure);
            }, { once:true });
            image.addEventListener('error', function () {
                selected = null;
                figure.remove();
                hero.removeAttribute('data-gx-avatar');
            }, { once:true });
            figure.appendChild(image);
            image.src = selected;
        }
        function load() {
            if (ended) { return; }
            if (new URL(config.url, location.href).origin !== location.origin) { return; }
            var controller = requestController = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, 13000);
            var body = new URLSearchParams({action:'mmed_gx_avatar_v1', nonce:config.nonce});
            fetch(config.url, {method:'POST', credentials:'same-origin', cache:'no-store', body:body, signal:controller.signal})
                .then(function (response) { if (!response.ok) { throw new Error('unavailable'); } return response.json(); })
                .then(function (response) {
                    var data = response && response.success && response.data;
                    if (!data || data.version !== 1 || !data.available || typeof data.imageUrl !== 'string') { return; }
                    var url = new URL(data.imageUrl);
                    if (url.protocol !== 'https:' || url.hostname !== 'cdn.missionmedinstitute.com' ||
                        url.username || url.password || url.port || url.search || url.hash) { return; }
                    selected = url.href;
                    mount();
                }).catch(function () { /* Existing welcome remains the neutral fallback. */ })
                .finally(function () { clearTimeout(timeout); });
        }
        var observer = new MutationObserver(mount);
        observer.observe(root, {childList:true, subtree:true});
        mount();
        window.addEventListener('pagehide', function () {
            ended=true; selected=null; observer.disconnect();
            if (requestController) { requestController.abort(); }
        }, {once:true});
    })(<?php echo wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>);
    </script>
    <?php
}
add_action('wp_footer', 'mmed_gx_avatar_dashboard', 100);
