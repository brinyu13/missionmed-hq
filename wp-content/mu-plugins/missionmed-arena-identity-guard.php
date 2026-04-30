<?php
/**
 * Plugin Name: MissionMed Arena Identity Guard
 * Description: Prevents Arena identity contamination by clearing stale Supabase localStorage and the handoff once-keys whenever the WordPress user has changed between /arena visits. Injects a tiny same-origin guard script into the /arena response via output buffering. Pairs with the runtime exchange/bootstrap path; does not change auth decisions.
 * Author: MissionMed
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('mmag_arena_path_matches')) {
    /**
     * Match /arena route and its sub-paths (preserving query strings).
     */
    function mmag_arena_path_matches() {
        $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';
        if ($request_uri === '') {
            return false;
        }
        $path = (string) wp_parse_url($request_uri, PHP_URL_PATH);
        if ($path === '') {
            return false;
        }
        return (bool) preg_match('#^/arena(?:/|$)#', $path);
    }
}

if (!function_exists('mmag_build_guard_script')) {
    /**
     * Build the identity-guard <script> tag.
     *
     * The guard:
     *   - Reads a server-rendered current WordPress user email.
     *   - Reads the email of the previously-seen WP user from localStorage.
     *   - If the two differ, clears all sb-* / supabase.* localStorage keys
     *     and the Arena handoff once-keys in sessionStorage. This forces the
     *     existing arena.html boot path to run a fresh exchange + handoff
     *     for the current user, instead of hydrating from the prior user's
     *     cached Supabase session.
     *   - Updates the last-seen email so the next visit can detect a future
     *     change.
     *
     * The guard never makes auth decisions on its own. Authority remains with
     * the Railway exchange/bootstrap path.
     *
     * @return string
     */
    function mmag_build_guard_script() {
        $email = '';
        if (is_user_logged_in()) {
            $current_user = wp_get_current_user();
            if ($current_user instanceof WP_User && $current_user->ID) {
                $email = strtolower((string) $current_user->user_email);
            }
        }
        $email_json = wp_json_encode($email);
        if (!is_string($email_json) || $email_json === '') {
            $email_json = '""';
        }
        $script_body = '(function(){try{'
            . 'var WP_EMAIL=' . $email_json . ';'
            . 'var LAST_KEY="mm_arena_last_wp_email";'
            . 'var lastSeen=localStorage.getItem(LAST_KEY)||"";'
            . 'var changed=WP_EMAIL&&lastSeen&&WP_EMAIL!==lastSeen;'
            . 'var loggedOutNow=!WP_EMAIL&&lastSeen;'
            . 'var cachedSbEmail="";'
            . 'try{'
            . '  var sbKey=Object.keys(localStorage).find(function(k){return /^sb-[a-z0-9]+-auth-token$/.test(k);});'
            . '  if(sbKey){var p=JSON.parse(localStorage.getItem(sbKey)||"null");if(p&&p.user&&p.user.email){cachedSbEmail=String(p.user.email).toLowerCase();}}'
            . '}catch(_sbReadErr){}'
            . 'var sbMismatch=WP_EMAIL&&cachedSbEmail&&WP_EMAIL!==cachedSbEmail;'
            . 'if(changed||loggedOutNow||sbMismatch){'
            . '  Object.keys(localStorage).forEach(function(k){'
            . '    if(/^sb-/.test(k)||/^supabase\\./.test(k)||/^mm_auth_/.test(k)){try{localStorage.removeItem(k);}catch(_e){}}'
            . '  });'
            . '  try{sessionStorage.removeItem("mm_arena_auth_handoff_attempted");}catch(_e){}'
            . '  try{sessionStorage.removeItem("mm_arena_auth_handoff_cycle_reset");}catch(_e){}'
            . '  try{document.documentElement.setAttribute("data-mm-arena-identity-guard","cleared");}catch(_e){}'
            . '}'
            . 'if(WP_EMAIL){localStorage.setItem(LAST_KEY,WP_EMAIL);}'
            . 'else{try{localStorage.removeItem(LAST_KEY);}catch(_e){}}'
            . '}catch(_outerErr){}})();';
        return '<script id="mm-arena-identity-guard">' . $script_body . '</script>';
    }
}

if (!function_exists('mmag_inject_into_buffer')) {
    /**
     * Inject the guard script into the /arena HTML body.
     *
     * Inserted as the first thing inside <head> so it runs before any other
     * script (including the bundled Supabase client). If <head> is missing
     * (atypical), prepend the script to the buffer.
     *
     * @param string $buffer
     * @return string
     */
    function mmag_inject_into_buffer($buffer) {
        if (!is_string($buffer) || $buffer === '') {
            return $buffer;
        }
        $script = mmag_build_guard_script();
        if ($script === '') {
            return $buffer;
        }
        $count = 0;
        $modified = preg_replace('#<head([^>]*)>#i', '<head$1>' . $script, (string) $buffer, 1, $count);
        if (is_string($modified) && (int) $count > 0) {
            return $modified;
        }
        // Fallback for atypical responses
        return $script . (string) $buffer;
    }
}

if (!function_exists('mmag_register_buffer')) {
    /**
     * Start an output buffer for /arena requests so we can inject the guard
     * script into whatever HTML is ultimately sent (including HTML produced
     * by arena-route-proxy.php at the same parse_request priority).
     */
    function mmag_register_buffer() {
        if (!mmag_arena_path_matches()) {
            return;
        }
        ob_start('mmag_inject_into_buffer');
    }
}

// Priority -1: run BEFORE arena-route-proxy.php (priority 0) so the buffer is
// in place when that handler echoes the proxied HTML and calls exit. Output
// buffering is automatically flushed through our callback during exit, so the
// guard script lands in the response sent to the browser.
add_action('parse_request', 'mmag_register_buffer', -1);
add_action('template_redirect', 'mmag_register_buffer', -1);
