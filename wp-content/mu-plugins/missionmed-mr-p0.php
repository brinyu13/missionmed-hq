<?php
/**
 * Plugin Name: MissionMed Mission Residency P0
 * Description: Reversible MR-WEB-0904C live Mission Residency truth layer and Woo-authoritative campaign configuration.
 * Version: 1.1.0
 */
declare(strict_types=1);

if (!defined('ABSPATH')) exit;

const MM_MR_P0_ASSET_DIR = WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets';
const MM_MR_P0_ASSET_URL = WPMU_PLUGIN_URL . '/missionmed-mr-p0-assets';

function mm_mr_p0_enabled(): bool {
    return get_option('mmed_mr_p0_enabled', 'no') === 'yes';
}

function mm_mr_p0_launch_product_in_cart(): bool {
    if (!function_exists('WC') || !WC()->cart) return false;
    foreach (WC()->cart->get_cart() as $item) {
        $productId = (int) ($item['product_id'] ?? 0);
        $variationId = (int) ($item['variation_id'] ?? 0);
        if (in_array($productId, [3576, 5504], true) || in_array($variationId, [5865, 5867], true)) {
            return true;
        }
    }
    return false;
}

function mm_mr_p0_clean_commercial_chrome(): bool {
    return mm_mr_p0_enabled() || mm_mr_p0_launch_product_in_cart();
}

function mm_mr_p0_runtime_config(): array {
    $path = MM_MR_P0_ASSET_DIR . '/config/campaign-state.json';
    $config = json_decode((string) file_get_contents($path), true);
    if (!is_array($config)) return [];

    $products = [
        'iv_prep_complete' => ['product_id' => 3576, 'variation_id' => 5865],
        'iv_prep_essentials' => ['product_id' => 5504, 'variation_id' => 5867],
    ];
    foreach ($products as $key => $identity) {
        $product = function_exists('wc_get_product') ? wc_get_product($identity['variation_id']) : null;
        if (!$product) continue;
        $config['products'][$key]['woo_product_id'] = $identity['product_id'];
        $config['products'][$key]['woo_variation_id'] = $identity['variation_id'];
        $config['products'][$key]['runtime_woo_price'] = (float) $product->get_price();
        $config['products'][$key]['add_to_cart_url'] = add_query_arg([
            'add-to-cart' => $identity['product_id'],
            'variation_id' => $identity['variation_id'],
            'attribute_pa_start-date' => 'session-d-start-date',
        ], wc_get_checkout_url());
    }
    $config['production'] = ['woo_price_authoritative' => true, 'card_only' => true];
    $verifiedAt = get_option('mmed_mr_p0_verified_live_at', '');
    $config['campaign']['go_live_gate']['verified_live_at'] = $verifiedAt ?: null;
    $config['campaign']['go_live_gate']['verified_by'] = $verifiedAt ? 'MR-WEB-0904B controlled production acceptance' : null;
    return $config;
}

function mm_mr_p0_render_asset_page(string $filename): never {
    $path = MM_MR_P0_ASSET_DIR . '/pages/' . $filename;
    $html = is_readable($path) ? (string) file_get_contents($path) : '';
    if ($html === '') {
        status_header(503);
        nocache_headers();
        echo 'Mission Residency is temporarily unavailable.';
        exit;
    }
    $head = '<head>' . "\n" . '<base href="' . esc_url(MM_MR_P0_ASSET_URL . '/pages/') . '">' . "\n"
        . '<script>window.MM_PRODUCTION=true;window.MM_CONFIG_URL=' . wp_json_encode(rest_url('missionmed/v1/mr-p0-config')) . ';</script>';
    $html = preg_replace('/<head>/', $head, $html, 1);
    status_header(200);
    nocache_headers();
    header('Content-Type: text/html; charset=' . get_option('blog_charset'));
    echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- reviewed static release artifact.
    exit;
}

add_action('rest_api_init', static function (): void {
    register_rest_route('missionmed/v1', '/mr-p0-config', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => static function () {
            $response = new WP_REST_Response(mm_mr_p0_runtime_config());
            $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return $response;
        },
    ]);
});

add_action('template_redirect', static function (): void {
    if (!mm_mr_p0_enabled()) return;

    $path = '/' . trim((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH), '/');
    $aliases = [
        '/product/iv-prep-complete' => 3576,
        '/product/iv-prep-essentials' => 5504,
    ];
    if (isset($aliases[$path])) {
        $target = get_permalink($aliases[$path]);
        if (is_string($target) && $target !== '') {
            wp_safe_redirect($target, 302, 'MissionMed MR-WEB-0904C');
            exit;
        }
    }

    if (is_page('mission-residency')) {
        mm_mr_p0_render_asset_page('mission-residency.html');
    }
    if (is_page(['mission-residency-courses', 'compare-programs', 'course-comparison'])) {
        mm_mr_p0_render_asset_page('compare.html');
    }
    if (is_singular('product')) {
        $pages = [
            3576 => 'program-complete.html',
            5504 => 'program-essentials.html',
            3575 => 'program-360.html',
        ];
        $productId = (int) get_queried_object_id();
        if (isset($pages[$productId])) {
            mm_mr_p0_render_asset_page($pages[$productId]);
        }
    }
}, 0);

// A legacy homepage program grid is injected after the_content, so clean its
// remaining active claim at the final response boundary as well as in the DOM.
add_action('template_redirect', static function (): void {
    if (!mm_mr_p0_enabled() || !is_front_page()) return;
    ob_start(static function (string $html): string {
        return str_ireplace(
            [
                'Unlimited mock interviews',
                '<div class="mm-mr-p0-route__card"><strong>IV Prep Essentials</strong>',
            ],
            [
                'Four Signature Mock Interviews',
                '<div class="mm-mr-p0-route__card"><strong>IV Prep Complete</strong>',
            ],
            $html
        );
    });
}, 1);

add_action('wp_head', static function (): void {
    if (!mm_mr_p0_clean_commercial_chrome()) return;
    echo '<style id="mm-mr-p0-claims-cleanup">#mm-l5-header .mm-l5__top>span:first-child{display:none!important}#mm-l5-header .mm-l5__top{justify-content:flex-end!important}body.home #mm-pgm-inject,body.home .mm-pgm{display:none!important}body.home .mm-mr-p0-route{background:#081a2f;color:#f8f3e7;padding:clamp(44px,7vw,84px) 24px;font-family:Inter,system-ui,sans-serif}body.home .mm-mr-p0-route__in{max-width:1160px;margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:42px;align-items:center}body.home .mm-mr-p0-route__k{color:#e5bd62;text-transform:uppercase;letter-spacing:.16em;font-size:.78rem;font-weight:800}body.home .mm-mr-p0-route h2{color:#fff;font:600 clamp(2.2rem,5vw,4.3rem)/1.02 Georgia,serif;margin:.35em 0}body.home .mm-mr-p0-route p{color:#f8f3e7;font-size:1.1rem;line-height:1.65;max-width:720px}body.home .mm-mr-p0-route__card{background:#102945;border:1px solid rgba(229,189,98,.45);padding:28px;border-radius:18px}body.home .mm-mr-p0-route__card strong{color:#fff;font-size:1.15rem}body.home .mm-mr-p0-route__price{display:block;color:#fff;font-size:2rem;font-weight:800;margin:.3em 0}body.home .mm-mr-p0-route a{display:inline-block;background:#e5bd62;color:#071626!important;text-decoration:none!important;font-weight:800;padding:14px 22px;border-radius:999px;margin-top:14px}@media(max-width:760px){body.home .mm-mr-p0-route__in{grid-template-columns:1fr}}</style>';
}, 99);

add_action('wp_footer', static function (): void {
    if (!mm_mr_p0_clean_commercial_chrome()) return;
    echo '<script id="mm-mr-p0-claims-cleanup-script">(function(){function clean(){var el=document.querySelector("#mm-l5-header .mm-l5__top>span:first-child");if(el)el.remove();if(document.body.classList.contains("home")){document.querySelectorAll("#mm-pgm-inject,.mm-pgm").forEach(function(n){n.remove();});var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var n;while(n=w.nextNode()){if(!n.nodeValue)continue;n.nodeValue=n.nodeValue.replace(/Match Prep Pro/gi,"IV Prep Complete").replace(/Interview Prep Foundation/gi,"IV Prep Essentials").replace(/Interview Prep Complete/gi,"IV Prep Complete").replace(/Unlimited mock interviews/gi,"Four Signature Mock Interviews");}}}clean();document.addEventListener("DOMContentLoaded",clean);var observer=new MutationObserver(clean);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(function(){clean();observer.disconnect();},15000);}());</script>';
}, 99);

add_filter('the_content', static function (string $content): string {
    if (!mm_mr_p0_enabled() || !is_front_page() || !in_the_loop() || !is_main_query()) return $content;
    $content = str_ireplace(
        ['Match Prep Pro', 'Interview Prep Foundation', 'Interview Prep Complete', 'Unlimited mock interviews'],
        ['IV Prep Complete', 'IV Prep Essentials', 'IV Prep Complete', 'Four Signature Mock Interviews'],
        $content
    );
    $product = function_exists('wc_get_product') ? wc_get_product(5865) : null;
    $price = $product ? wp_strip_all_tags(wc_price((float) $product->get_price())) : '';
    $route = '<section class="mm-mr-p0-route" aria-label="Mission Residency Fall 2026">'
        . '<style>.mm-mr-p0-route{background:#081a2f;color:#f8f3e7;padding:clamp(44px,7vw,84px) 24px;font-family:Inter,system-ui,sans-serif}.mm-mr-p0-route__in{max-width:1160px;margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:42px;align-items:center}.mm-mr-p0-route__k{color:#e5bd62;text-transform:uppercase;letter-spacing:.16em;font-size:.78rem;font-weight:800}.mm-mr-p0-route h2{color:#fff;font:600 clamp(2.2rem,5vw,4.3rem)/1.02 Georgia,serif;margin:.35em 0}.mm-mr-p0-route p{font-size:1.1rem;line-height:1.65;max-width:720px}.mm-mr-p0-route__card{background:#102945;border:1px solid rgba(229,189,98,.45);padding:28px;border-radius:18px}.mm-mr-p0-route__price{display:block;color:#fff;font-size:2rem;font-weight:800;margin:.3em 0}.mm-mr-p0-route a{display:inline-block;background:#e5bd62;color:#071626!important;text-decoration:none!important;font-weight:800;padding:14px 22px;border-radius:999px;margin-top:14px}@media(max-width:760px){.mm-mr-p0-route__in{grid-template-columns:1fr}}</style>'
        . '<div class="mm-mr-p0-route__in"><div><span class="mm-mr-p0-route__k">Mission Residency · Fall 2026</span><h2>It is interview season.</h2><p>One expert. Your whole interview season. Boutique, high-touch residency interview preparation with live teaching, Signature Mock Interviews, and longitudinal support.</p><a href="' . esc_url(home_url('/mission-residency/')) . '">Explore Mission Residency</a></div>'
        . '<div class="mm-mr-p0-route__card"><strong>IV Prep Complete</strong><span class="mm-mr-p0-route__price">' . esc_html($price) . '</span><p>Launch tuition through September 12, 2026 at 11:59 PM ET. IV Prep Essentials is open at $1,199; 360 enrollment is closed.</p></div></div></section>';
    return $route . $content;
}, 20);
