<?php
add_action('template_redirect', function () {

    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

    if ($path === '/arena/' || $path === '/arena') {

        // Disable canonical redirect
        remove_action('template_redirect', 'redirect_canonical');

        // Disable WooCommerce redirect logic
        if (function_exists('wc_template_redirect')) {
            remove_action('template_redirect', 'wc_template_redirect');
        }

        // Allow access even if not logged in
        if (function_exists('is_user_logged_in') && !is_user_logged_in()) {
            return;
        }
    }

}, 0);
