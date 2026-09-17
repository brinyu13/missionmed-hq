<?php
/**
 * Plugin Name: MissionMed Mission Residency P0
 * Description: Reversible MR-WEB-0912 commerce activation with the bounded MR-WEB-0914 Fable 5 customer journey.
 * Version: 1.4.0
 */
declare(strict_types=1);

if (!defined('ABSPATH')) exit;

const MM_MR_P0_ASSET_DIR = WPMU_PLUGIN_DIR . '/missionmed-mr-0912-assets';
const MM_MR_P0_ASSET_URL = WPMU_PLUGIN_URL . '/missionmed-mr-0912-assets';
const MM_MR_0912_GOOGLE_TAG_ID = 'GT-PJ7SPCWF';
const MM_MR_0912_FINANCIAL_WAIVER_AUTHORITY = 'DR-296';
const MM_MR_0912_IW_CARD_PRICE = 549.0;
const MM_MR_0912_IW_ZELLE_PRICE = 499.0;

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

function mm_mr_0912_google_tag_markup(): string {
    return '<script id="mm-mr-0912-google-tag" async src="https://www.googletagmanager.com/gtag/js?id='
        . MM_MR_0912_GOOGLE_TAG_ID . '"></script><script id="mm-mr-0912-google-tag-config">'
        . 'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
        . 'gtag("set","linker",{"domains":["missionmedinstitute.com"]});gtag("js",new Date());'
        . 'gtag("config","' . MM_MR_0912_GOOGLE_TAG_ID . '");</script>';
}

function mm_mr_0912_clean_policy_markup(string $html): string {
    return str_ireplace(
        [
            'Match Prep Pro',
            'Payments, Enrollment, And MatchFirst',
            'payment plan, MatchFirst, or another approved method',
            'MatchFirst or deferred-payment arrangements',
            'MatchFirst And Deferred Payments',
            'MatchFirst is a specific deferred-payment arrangement when offered in writing.',
            'MatchFirst enrollment terms',
            'MatchFirst',
        ],
        [
            'IV Prep Complete',
            'Payments And Enrollment',
            'payment plan or another approved method',
            'Deferred-payment arrangements',
            'Written Deferred-Payment Arrangements',
            'A deferred-payment arrangement applies only when offered in writing.',
            'written enrollment terms',
            'written deferred payment',
        ],
        $html
    );
}

function mm_mr_0912_output_boundary(string $html): string {
    if (!mm_mr_p0_enabled()) return $html;
    $path = '/' . trim((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH), '/');
    $funnel = [
        '/', '/mission-residency', '/mission-residency-courses', '/compare-programs',
        '/course-comparison', '/product/match-prep-pro', '/product/iv-prep-complete',
        '/product/iv-prep-masterclass', '/product/iv-prep-essentials', '/cart', '/checkout',
        '/mission-residency-waitlist', '/terms-of-agreement', '/refund-cancellation-policy',
        '/privacy-policy',
    ];
    if (!in_array($path, $funnel, true)) return $html;

    if (in_array($path, ['/terms-of-agreement', '/refund-cancellation-policy'], true)) {
        $html = mm_mr_0912_clean_policy_markup($html);
    }

    // Final output contains ../js/mr-0912.js?v=<content-hash> and the
    // equivalent CSS reference so caches cannot retain a prior presentation.
    $versionedAssets = [
        '../css/mr-0912.css' => MM_MR_P0_ASSET_DIR . '/css/mr-0912.css',
        '../js/mr-0912.js' => MM_MR_P0_ASSET_DIR . '/js/mr-0912.js',
    ];
    foreach ($versionedAssets as $reference => $assetPath) {
        if (!is_file($assetPath)) continue;
        $version = substr((string) hash_file('sha256', $assetPath), 0, 12);
        $html = preg_replace(
            '~' . preg_quote($reference, '~') . '(?:\?v=[0-9a-f]{12})*~',
            $reference . '?v=' . $version,
            $html
        ) ?? $html;
    }

    $analyticsPaths = [
        '/', '/mission-residency', '/mission-residency-courses', '/compare-programs',
        '/course-comparison', '/product/match-prep-pro', '/product/iv-prep-complete',
        '/product/iv-prep-masterclass', '/product/iv-prep-essentials', '/cart', '/checkout',
    ];
    $tagNeedle = 'googletagmanager.com/gtag/js?id=' . MM_MR_0912_GOOGLE_TAG_ID;
    if (in_array($path, $analyticsPaths, true) && !str_contains($html, $tagNeedle)) {
        $html = str_ireplace('</head>', mm_mr_0912_google_tag_markup() . '</head>', $html);
    }

    if (!str_contains($html, 'mm-mr-0912-output-containment')) {
        $style = '<style id="mm-mr-0912-output-containment">#mm-mobile-notice,#mm-mobile-notice-styles{display:none!important}</style>';
        $script = '<script id="mm-mr-0912-output-containment-script">(function(){'
            . 'function clean(){var n=document.getElementById("mm-mobile-notice");if(n)n.remove();'
            . 'var s=document.getElementById("mm-mobile-notice-styles");if(s)s.remove();'
            . 'if(location.pathname==="/"){document.querySelectorAll("a[href]").forEach(function(a){'
            . 'var t=(a.textContent||"").trim();if((t==="Explore Interview Week and Complete"'
            . '||t==="View Interview Week and Complete")&&(a.getAttribute("href")==="#"'
            . '||a.href.indexOf("/mission-residency-waitlist/")!==-1)){a.href="/mission-residency/";}});}}'
            . 'clean();document.addEventListener("DOMContentLoaded",clean);'
            . 'new MutationObserver(clean).observe(document.documentElement,{childList:true,subtree:true});}());</script>';
        $html = str_ireplace('</head>', $style . '</head>', $html);
        $html = str_ireplace('</body>', $script . '</body>', $html);
    }
    return $html;
}

add_action('template_redirect', static function (): void {
    if (!mm_mr_p0_enabled()) return;
    ob_start('mm_mr_0912_output_boundary');
}, PHP_INT_MIN);

function mm_mr_0912_founder_waiver_valid(): bool {
    return get_option('mmed_mr_0912_financial_test_status', '') === 'waived_by_founder_not_executed'
        && get_option('mmed_mr_0912_financial_test_authority', '') === MM_MR_0912_FINANCIAL_WAIVER_AUTHORITY;
}

function mm_mr_0912_acceptance_binding(string $offerKey, string $verifiedAt, array $runtime): string {
    if (!mm_mr_0912_founder_waiver_valid()
        || !in_array($offerKey, ['interview_week', 'complete'], true) || !isset(
        $runtime['woo_product_id'],
        $runtime['woo_variation_id'],
        $runtime['woo_price'],
        $runtime['learndash_course_id'],
        $runtime['related_course_ids'],
        $runtime['mapping_verified'],
        $runtime['parent_verified'],
        $runtime['sold_individually']
    )) {
        return '';
    }
    $facts = [
        'mission' => 'MR-WEB-0912',
        'offer' => $offerKey,
        'verified_live_at' => $verifiedAt,
        'product_id' => (int) $runtime['woo_product_id'],
        'variation_id' => (int) $runtime['woo_variation_id'],
        'price' => (float) $runtime['woo_price'],
        'course_id' => (int) $runtime['learndash_course_id'],
        'related_course_ids' => array_map('intval', (array) $runtime['related_course_ids']),
        'mapping_verified' => (bool) $runtime['mapping_verified'],
        'parent_verified' => (bool) $runtime['parent_verified'],
        'sold_individually' => (bool) $runtime['sold_individually'],
        'financial_acceptance_status' => 'waived_by_founder_not_executed',
        'financial_acceptance_authority' => MM_MR_0912_FINANCIAL_WAIVER_AUTHORITY,
    ];
    return hash('sha256', (string) wp_json_encode($facts, JSON_UNESCAPED_SLASHES));
}

function mm_mr_p0_runtime_config(): array {
    $path = MM_MR_P0_ASSET_DIR . '/config/campaign-state.json';
    $config = json_decode((string) file_get_contents($path), true);
    if (!is_array($config)) return [];

    $products = [
        'interview_week' => [
            'product_id' => 5504,
            'variation_id' => 5867,
            'course_id' => 3646,
            'expected_price' => MM_MR_0912_IW_CARD_PRICE,
        ],
        'complete' => [
            'product_id' => 3576,
            'variation_id' => 5865,
            'course_id' => 5227,
            // This is the verified-card target through Sept 23. After the
            // deadline a stale $3,099 product fails closed against $3,499.
            'expected_price' => time() <= strtotime('2026-09-24T03:59:59Z') ? 3099.0 : 3499.0,
        ],
    ];
    foreach ($products as $key => $identity) {
        $product = function_exists('wc_get_product') ? wc_get_product($identity['variation_id']) : null;
        if (!$product || !isset($config['offers'][$key])) continue;
        $relatedCourses = array_values(array_unique(array_map('intval', (array) get_post_meta($identity['variation_id'], '_related_course', true))));
        sort($relatedCourses, SORT_NUMERIC);
        $runtimePrice = (float) $product->get_price();
        $mapped = $relatedCourses === [$identity['course_id']];
        $parentVerified = method_exists($product, 'get_parent_id')
            && (int) $product->get_parent_id() === $identity['product_id'];
        $soldIndividually = $product->is_sold_individually();
        $eligible = $product->is_purchasable() && $product->is_in_stock()
            && abs($runtimePrice - $identity['expected_price']) < 0.001
            && $mapped && $parentVerified && $soldIndividually;
        $checkoutUrl = add_query_arg([
            'add-to-cart' => $identity['product_id'],
            'variation_id' => $identity['variation_id'],
            'attribute_pa_start-date' => 'session-d-start-date',
        ], wc_get_checkout_url());
        $config['offers'][$key]['runtime'] = [
            'woo_product_id' => $identity['product_id'],
            'woo_variation_id' => $identity['variation_id'],
            'woo_price' => $runtimePrice,
            'learndash_course_id' => $identity['course_id'],
            'related_course_ids' => $relatedCourses,
            'mapping_verified' => $mapped,
            'parent_verified' => $parentVerified,
            'sold_individually' => $soldIndividually,
            'product_eligible' => $eligible,
            'checkout_allowed' => false,
            'checkout_url' => null,
            'checkout_candidate_url' => $checkoutUrl,
        ];
    }
    // The prior campaign's acceptance must never activate this campaign. The
    // new timestamp is bound to exact product, variation, price, course, and
    // mapping facts so a later price change also fails closed.
    $allAccepted = true;
    foreach ($products as $key => $_identity) {
        $runtime = $config['offers'][$key]['runtime'] ?? [];
        $verifiedAt = (string) get_option('mmed_mr_0912_' . $key . '_verified_live_at', '');
        $storedBinding = (string) get_option('mmed_mr_0912_' . $key . '_acceptance_binding_sha256', '');
        $expectedBinding = $verifiedAt !== '' ? mm_mr_0912_acceptance_binding($key, $verifiedAt, $runtime) : '';
        $acceptanceBound = $expectedBinding !== ''
            && preg_match('/^[0-9a-f]{64}$/', $storedBinding) === 1
            && hash_equals($expectedBinding, $storedBinding);
        $allAccepted = $allAccepted && $acceptanceBound;
        $config['campaign']['go_live_gate']['offers'][$key] = [
            'verified_live_at' => $acceptanceBound ? $verifiedAt : null,
            'verified_by' => $acceptanceBound ? 'MR-WEB-0912 DR-296 Founder waiver plus non-financial production acceptance' : null,
        ];
        if ($acceptanceBound && !empty($runtime['product_eligible'])) {
            $config['offers'][$key]['runtime']['checkout_allowed'] = true;
            $config['offers'][$key]['runtime']['checkout_url'] = $runtime['checkout_candidate_url'];
        }
        unset($config['offers'][$key]['runtime']['checkout_candidate_url']);
    }
    $config['campaign']['go_live_gate']['verified_live_at'] = $allAccepted ? 'per-offer' : null;
    $config['campaign']['go_live_gate']['verified_by'] = $allAccepted ? 'MR-WEB-0912 DR-296 Founder waiver plus non-financial production acceptance' : null;
    $config['campaign']['go_live_gate']['financial_acceptance'] = [
        'status' => mm_mr_0912_founder_waiver_valid() ? 'waived_by_founder_not_executed' : 'not_executed',
        'authority' => mm_mr_0912_founder_waiver_valid() ? MM_MR_0912_FINANCIAL_WAIVER_AUTHORITY : null,
        'passed' => false,
    ];
    if (!empty($config['offers']['complete']['runtime']['checkout_allowed'])) {
        $verifiedPriceKey = time() <= strtotime('2026-09-24T03:59:59Z')
            ? 'early_card_paid_in_full'
            : 'standard';
        $config['payment_options'][$verifiedPriceKey]['public_verified'] = true;
    }
    if (!empty($config['offers']['interview_week']['runtime']['checkout_allowed'])) {
        $config['payment_options']['interview_week_card'] = [
            'amount' => MM_MR_0912_IW_CARD_PRICE,
            'rail' => 'stripe',
            'public_verified' => true,
        ];
        $config['payment_options']['interview_week_zelle'] = [
            'amount' => MM_MR_0912_IW_ZELLE_PRICE,
            'savings' => MM_MR_0912_IW_CARD_PRICE - MM_MR_0912_IW_ZELLE_PRICE,
            'rail' => 'bacs',
            'settlement' => 'manual_verification_required_before_access',
            'public_verified' => get_option('mmed_mr_0912_iw_zelle_enabled', 'no') === 'yes',
        ];
    }
    foreach (($config['payment_options'] ?? []) as $key => $option) {
        if (empty($option['public_verified'])) {
            $config['payment_options'][$key] = ['public_verified' => false];
        }
    }
    if (empty($config['upgrade_credit']['public_verified'])) {
        $config['upgrade_credit'] = ['public_verified' => false];
    }
    if (empty($config['alumni']['public_verified'])) {
        $config['alumni'] = ['public_verified' => false];
    }
    $config['production'] = [
        'mission' => 'MR-WEB-0912',
        'woo_price_authoritative' => true,
        'activation_fail_closed' => true,
        'acceptance_binding_valid' => $allAccepted,
        'live_stripe_financial_acceptance' => mm_mr_0912_founder_waiver_valid()
            ? 'WAIVED BY FOUNDER / NOT EXECUTED'
            : 'NOT EXECUTED',
    ];
    return $config;
}

function mm_mr_0912_offer_for_product(int $productId, int $variationId = 0): ?string {
    if ($productId === 5504 && $variationId === 5867) return 'interview_week';
    if ($productId === 3576 && $variationId === 5865) return 'complete';
    if (in_array($productId, [5504, 3576], true) || in_array($variationId, [5867, 5865], true)) {
        return 'invalid';
    }
    return null;
}

function mm_mr_0912_cart_offer_keys(): array {
    if (!function_exists('WC') || !WC()->cart) return [];
    $keys = [];
    foreach (WC()->cart->get_cart() as $item) {
        $key = mm_mr_0912_offer_for_product(
            (int) ($item['product_id'] ?? 0),
            (int) ($item['variation_id'] ?? 0)
        );
        if ($key !== null) $keys[$key] = true;
    }
    return array_keys($keys);
}

function mm_mr_0912_cart_is_checkout_safe(): bool {
    if (!function_exists('WC') || !WC()->cart) return true;
    $offerKeys = [];
    foreach (WC()->cart->get_cart() as $item) {
        $offerKey = mm_mr_0912_offer_for_product(
            (int) ($item['product_id'] ?? 0),
            (int) ($item['variation_id'] ?? 0)
        );
        if ($offerKey === null) continue;
        if ($offerKey === 'invalid' || (int) ($item['quantity'] ?? 0) !== 1) return false;
        $offerKeys[$offerKey] = true;
    }
    return count($offerKeys) <= 1;
}

function mm_mr_0912_offer_checkout_allowed(string $offerKey): bool {
    $runtime = mm_mr_p0_runtime_config()['offers'][$offerKey]['runtime'] ?? [];
    return !empty($runtime['checkout_allowed']);
}

function mm_mr_0912_validate_add_to_cart(
    $passed,
    $productId,
    $quantity = 1,
    $variationId = 0
): bool {
    if (!(bool) $passed) return false;
    $offerKey = mm_mr_0912_offer_for_product((int) $productId, (int) $variationId);
    if ($offerKey === null) return true;
    if ($offerKey === 'invalid') {
        if (function_exists('wc_add_notice')) wc_add_notice('This enrollment selection is not valid.', 'error');
        return false;
    }
    if ((int) $quantity !== 1) {
        if (function_exists('wc_add_notice')) wc_add_notice('Enrollment is limited to one seat per account.', 'error');
        return false;
    }
    if (!mm_mr_0912_offer_checkout_allowed($offerKey)) {
        if (function_exists('wc_add_notice')) wc_add_notice('Enrollment is not yet verified for checkout.', 'error');
        return false;
    }
    $otherOffer = $offerKey === 'complete' ? 'interview_week' : 'complete';
    if (in_array($otherOffer, mm_mr_0912_cart_offer_keys(), true)) {
        if (function_exists('wc_add_notice')) wc_add_notice('Choose either Interview Week or IV Prep Complete; Complete already includes Interview Week.', 'error');
        return false;
    }
    return true;
}
add_filter('woocommerce_add_to_cart_validation', 'mm_mr_0912_validate_add_to_cart', 999, 4);

function mm_mr_0912_validate_cart(): void {
    if (function_exists('WC') && WC()->cart) {
        foreach (WC()->cart->get_cart() as $item) {
            $offerKey = mm_mr_0912_offer_for_product(
                (int) ($item['product_id'] ?? 0),
                (int) ($item['variation_id'] ?? 0)
            );
            if ($offerKey !== null && (int) ($item['quantity'] ?? 0) !== 1) {
                if (function_exists('wc_add_notice')) wc_add_notice('Enrollment is limited to one seat per account.', 'error');
                return;
            }
        }
    }
    $offerKeys = mm_mr_0912_cart_offer_keys();
    foreach ($offerKeys as $offerKey) {
        if (!mm_mr_0912_offer_checkout_allowed($offerKey)) {
            if (function_exists('wc_add_notice')) wc_add_notice('Enrollment verification expired. Remove the item before checkout.', 'error');
            return;
        }
    }
    if (count($offerKeys) > 1 && function_exists('wc_add_notice')) {
        wc_add_notice('Choose either Interview Week or IV Prep Complete; Complete already includes Interview Week.', 'error');
    }
}
add_action('woocommerce_check_cart_items', 'mm_mr_0912_validate_cart', 999);

function mm_mr_0912_cart_is_zelle_eligible(): bool {
    if (!function_exists('WC') || !WC()->cart) return false;
    $items = WC()->cart->get_cart();
    if (count($items) !== 1 || count(WC()->cart->get_applied_coupons()) !== 0) return false;
    $item = reset($items);
    return is_array($item)
        && (int) ($item['product_id'] ?? 0) === 5504
        && (int) ($item['variation_id'] ?? 0) === 5867
        && (int) ($item['quantity'] ?? 0) === 1
        && mm_mr_0912_offer_checkout_allowed('interview_week')
        && get_option('mmed_mr_0912_iw_zelle_enabled', 'no') === 'yes';
}

function mm_mr_0912_selected_gateway(): string {
    if (!function_exists('WC') || !WC()->session) return '';
    return sanitize_key((string) WC()->session->get('chosen_payment_method', ''));
}

function mm_mr_0912_allowed_gateways(array $gateways): array {
    $allowed = [];
    if (isset($gateways['stripe'])) $allowed['stripe'] = $gateways['stripe'];
    if (mm_mr_0912_cart_is_zelle_eligible() && isset($gateways['bacs'])) {
        $gateways['bacs']->title = 'Zelle — $499 total (save $50)';
        $gateways['bacs']->description = 'Place the order for $499 and follow the secure Zelle instructions. Your order stays on hold and access is not granted until MissionMed verifies receipt.';
        $allowed['bacs'] = $gateways['bacs'];
    }
    return $allowed;
}

add_filter('woocommerce_available_payment_gateways', static function (array $gateways): array {
    if (!mm_mr_p0_launch_product_in_cart()) return $gateways;
    return mm_mr_0912_cart_is_checkout_safe()
        ? mm_mr_0912_allowed_gateways($gateways)
        : [];
}, 999);

add_action('woocommerce_checkout_update_order_review', static function (string $postData): void {
    if (!function_exists('WC') || !WC()->session) return;
    parse_str($postData, $fields);
    if (isset($fields['payment_method'])) {
        WC()->session->set('chosen_payment_method', sanitize_key((string) $fields['payment_method']));
    }
}, 1);

add_action('woocommerce_before_calculate_totals', static function ($cart): void {
    if (!is_object($cart) || !method_exists($cart, 'get_cart')) return;
    $zelle = mm_mr_0912_selected_gateway() === 'bacs' && mm_mr_0912_cart_is_zelle_eligible();
    foreach ($cart->get_cart() as $item) {
        if ((int) ($item['product_id'] ?? 0) !== 5504 || (int) ($item['variation_id'] ?? 0) !== 5867) continue;
        $product = $item['data'] ?? null;
        if (is_object($product) && method_exists($product, 'set_price')) {
            $product->set_price($zelle ? MM_MR_0912_IW_ZELLE_PRICE : MM_MR_0912_IW_CARD_PRICE);
        }
    }
}, 999);

add_action('woocommerce_checkout_process', static function (): void {
    $method = isset($_POST['payment_method']) ? sanitize_key(wp_unslash((string) $_POST['payment_method'])) : '';
    if ($method === 'bacs' && !mm_mr_0912_cart_is_zelle_eligible() && function_exists('wc_add_notice')) {
        wc_add_notice('Zelle savings are available only for one Interview Week enrollment with no coupon or other cart item.', 'error');
    }
}, 999);

add_filter('woocommerce_bacs_process_payment_order_status', static function (string $status, $order): string {
    if (!is_object($order) || !method_exists($order, 'get_items')) return $status;
    foreach ($order->get_items() as $item) {
        if (method_exists($item, 'get_product_id') && (int) $item->get_product_id() === 5504
            && method_exists($item, 'get_variation_id') && (int) $item->get_variation_id() === 5867) {
            return 'on-hold';
        }
    }
    return $status;
}, 999, 2);

// Presentation only: Complete already includes Interview Week. Do not recommend buying it twice.
add_filter('woocommerce_cart_crosssell_ids', static function (array $ids): array {
    if (!mm_mr_p0_enabled() || !function_exists('WC') || !WC()->cart) return $ids;
    foreach (WC()->cart->get_cart() as $item) {
        if ((int) ($item['product_id'] ?? 0) === 3576) {
            return array_values(array_diff($ids, [5504, 5867]));
        }
    }
    return $ids;
}, 999);

function mm_mr_p0_render_asset_page(string $page): never {
    $isB = $page === 'mission-residency';
    $path = MM_MR_P0_ASSET_DIR . ($isB ? '/b-immersive/index.html' : '/pages/offer.html');
    $html = is_readable($path) ? (string) file_get_contents($path) : '';
    if ($html === '') {
        status_header(503);
        nocache_headers();
        echo 'Mission Residency is temporarily unavailable.';
        exit;
    }
    $versionedAssets = [
        '../css/mr-0912.css' => MM_MR_P0_ASSET_DIR . '/css/mr-0912.css',
        '../js/mr-0912.js' => MM_MR_P0_ASSET_DIR . '/js/mr-0912.js',
    ];
    if ($isB) {
        $versionedAssets = [];
        foreach (['styles/site.css', 'styles/finalization.css', 'styles/founder-steers.css', 'styles/production.css', 'scripts/site.js', 'scripts/finalization.js'] as $asset) {
            $versionedAssets['/wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/' . $asset] = MM_MR_P0_ASSET_DIR . '/b-immersive/' . $asset;
        }
    }
    foreach ($versionedAssets as $reference => $assetPath) {
        if (!is_file($assetPath)) continue;
        $version = substr((string) hash_file('sha256', $assetPath), 0, 12);
        $html = preg_replace(
            '~' . preg_quote($reference, '~') . '(?:\?v=[0-9a-f]{12})*~',
            $reference . '?v=' . $version,
            $html
        ) ?? $html;
    }
    $head = '<head>' . "\n" . '<base href="' . esc_url($isB ? home_url('/mission-residency/') : MM_MR_P0_ASSET_URL . '/pages/') . '">' . "\n"
        . '<script>window.MM_PRODUCTION=true;window.MM_MR_PAGE=' . wp_json_encode($page) . ';window.MM_CONFIG_URL=' . wp_json_encode(rest_url('missionmed/v1/mr-0912-config')) . ';</script>'
        . mm_mr_0912_google_tag_markup()
        . '<style id="mm-mr-0912-static-containment">#mm-mobile-notice,#mm-mobile-notice-styles{display:none!important}</style>';
    $html = preg_replace('/<head>/', $head, $html, 1);
    status_header(200);
    nocache_headers();
    header('Content-Type: text/html; charset=' . get_option('blog_charset'));
    echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- reviewed static release artifact.
    exit;
}

function mm_mr_0912_render_current_policy(): void {
    if (!mm_mr_p0_enabled()) return;
    $slug = trim((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH), '/');
    if (!in_array($slug, ['terms-of-agreement', 'refund-cancellation-policy'], true)
        || !function_exists('mm_launch_sev1_policy_html')) {
        return;
    }
    $titles = [
        'terms-of-agreement' => 'Terms of Agreement',
        'refund-cancellation-policy' => 'Refund & Cancellation Policy',
    ];
    $title = $titles[$slug];
    $description = function_exists('mm_launch_sev1_current_meta_description')
        ? mm_mr_0912_clean_policy_markup((string) mm_launch_sev1_current_meta_description())
        : $title;
    $content = mm_mr_0912_clean_policy_markup((string) mm_launch_sev1_policy_html($slug));
    if ($slug === 'terms-of-agreement') {
        $guarantee = MM_MR_P0_ASSET_DIR . '/b-immersive/guarantee.html';
        if (is_readable($guarantee)) $content .= (string) file_get_contents($guarantee);
    }
    status_header(200);
    header('Content-Type: text/html; charset=' . get_option('blog_charset'));
    echo '<!doctype html><html lang="en-US"><head><meta charset="' . esc_attr(get_option('blog_charset'))
        . '"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'
        . esc_html($title) . ' - MissionMed Institute</title><meta name="description" content="'
        . esc_attr($description) . '"><meta property="og:title" content="' . esc_attr($title)
        . ' - MissionMed Institute"><meta property="og:description" content="' . esc_attr($description)
        . '"><meta property="og:type" content="article"><meta property="og:url" content="'
        . esc_url(home_url('/' . $slug . '/')) . '"><meta name="twitter:card" content="summary">';
    if (function_exists('mm_launch_sev1_policy_styles')) mm_launch_sev1_policy_styles();
    echo '</head><body class="mm-launch-policy-body"><main>' . $content . '</main></body></html>';
    exit;
}
add_action('template_redirect', 'mm_mr_0912_render_current_policy', -1);

add_action('rest_api_init', static function (): void {
    register_rest_route('missionmed/v1', '/mr-0912-config', [
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
    if ($path === '/mission-residency-waitlist') {
        wp_safe_redirect(add_query_arg('from', 'legacy-waitlist', home_url('/mission-residency/')), 302, 'MissionMed MR-WEB-0912');
        exit;
    }
    if (isset($aliases[$path])) {
        $target = get_permalink($aliases[$path]);
        if (is_string($target) && $target !== '') {
            wp_safe_redirect($target, 302, 'MissionMed MR-WEB-0904C');
            exit;
        }
    }

    if (is_page('mission-residency')) {
        mm_mr_p0_render_asset_page('mission-residency');
    }
    if (is_page(['mission-residency-courses', 'compare-programs', 'course-comparison'])) {
        mm_mr_p0_render_asset_page('compare');
    }
    if (is_singular('product')) {
        $pages = [
            3575 => 'compare', // DR-267 closed 360 informational presentation only.
            3576 => 'complete',
            5504 => 'interview-week',
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
        $html = preg_replace('~<p[^>]*>\s*1(?:42)\s+ALUMNI\s+MATCHED\s+AND\s+COUNTING\s*</p>~i', '', $html) ?? $html;
        return str_ireplace(
            [
                'Unlimited mock interviews',
                'Four Signature Mock Interviews',
                'physicians who have matched hundreds of candidates',
                '<div class="mm-mr-p0-route__card"><strong>IV Prep Essentials</strong>',
                'href="https://missionmedinstitute.com/mission-residency-waitlist/"',
                'href="/mission-residency-waitlist/"',
                'Join the Next Match Strategy Session',
                'See Upcoming Sessions',
            ],
            [
                'Signature Mock entitlement confirmed at enrollment',
                'Signature Mock entitlement confirmed at enrollment',
                'physician mentors who teach residency applicants',
                '<div class="mm-mr-p0-route__card"><strong>IV Prep Essentials: Interview Week</strong>',
                'href="https://missionmedinstitute.com/mission-residency/"',
                'href="/mission-residency/"',
                'Explore Interview Week and Complete',
                'View Interview Week and Complete',
            ],
            $html
        );
    });
}, 1);

add_action('template_redirect', static function (): void {
    if (!mm_mr_p0_enabled()) return;
    $path = '/' . trim((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH), '/');
    if (!in_array($path, ['/terms-of-agreement', '/refund-cancellation-policy'], true)) return;
    ob_start(static function (string $html): string {
        return str_ireplace(
            [
                'Match Prep Pro',
                'Payments, Enrollment, And MatchFirst',
                'payment plan, MatchFirst, or another approved method',
                'MatchFirst or deferred-payment arrangements',
                'MatchFirst And Deferred Payments',
                'MatchFirst is a specific deferred-payment arrangement when offered in writing.',
                'MatchFirst enrollment terms',
                'MatchFirst',
            ],
            [
                'IV Prep Complete',
                'Payments And Enrollment',
                'payment plan or another approved method',
                'Deferred-payment arrangements',
                'Written Deferred-Payment Arrangements',
                'A deferred-payment arrangement applies only when offered in writing.',
                'written enrollment terms',
                'written deferred payment',
            ],
            $html
        );
    });
}, 1);

add_action('wp_head', static function (): void {
    if (!mm_mr_p0_clean_commercial_chrome()) return;
    echo '<style id="mm-mr-p0-claims-cleanup">#mm-l5-header .mm-l5__top>span:first-child{display:none!important}#mm-l5-header .mm-l5__top{justify-content:flex-end!important}body.home #mm-pgm-inject,body.home .mm-pgm{display:none!important}body.home .mm-mr-p0-route{background:#081a2f;color:#f8f3e7;padding:clamp(44px,7vw,84px) 24px;font-family:Inter,system-ui,sans-serif}body.home .mm-mr-p0-route__in{max-width:1160px;margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:42px;align-items:center}body.home .mm-mr-p0-route__k,body.home .mm-mr-p0-route__card-k{color:#e5bd62;text-transform:uppercase;letter-spacing:.16em;font-size:.78rem;font-weight:800}body.home .mm-mr-p0-route h2{color:#fff;font:600 clamp(2.2rem,5vw,4.3rem)/1.02 Georgia,serif;margin:.35em 0}body.home .mm-mr-p0-route p{color:#f8f3e7;font-size:1.1rem;line-height:1.65;max-width:720px}body.home .mm-mr-p0-route__card{background:#102945;border:1px solid rgba(229,189,98,.45);padding:28px;border-radius:18px}body.home .mm-mr-p0-route__card strong{display:block;color:#fff;font:600 1.7rem/1.15 Georgia,serif;margin:.45em 0}body.home .mm-mr-p0-route a{display:inline-block;background:#e5bd62;color:#071626!important;text-decoration:none!important;font-weight:800;padding:14px 22px;border-radius:999px;margin-top:14px}@media(max-width:760px){body.home .mm-mr-p0-route__in{grid-template-columns:1fr}}</style>';
}, 99);

function mm_mr_0912_is_customer_funnel_route(): bool {
    $path = '/' . trim((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH), '/') . '/';
    return in_array($path, [
        '/', '/mission-residency/', '/mission-residency-courses/', '/compare-programs/',
        '/course-comparison/', '/product/match-prep-pro/', '/product/iv-prep-complete/',
        '/product/iv-prep-masterclass/', '/product/iv-prep-essentials/', '/cart/', '/checkout/',
        '/mission-residency-waitlist/', '/terms-of-agreement/', '/refund-cancellation-policy/',
        '/privacy-policy/',
    ], true);
}

add_action('wp_head', static function (): void {
    if (!mm_mr_p0_enabled() || !mm_mr_0912_is_customer_funnel_route()) return;
    echo '<style id="mm-mr-0912-mobile-notice-containment">#mm-mobile-notice,#mm-mobile-notice-styles{display:none!important}</style>';
}, PHP_INT_MAX);

add_action('wp_footer', static function (): void {
    if (!mm_mr_p0_enabled() || !mm_mr_0912_is_customer_funnel_route()) return;
    echo '<script id="mm-mr-0912-mobile-notice-containment-script">(function(){function remove(){var n=document.getElementById("mm-mobile-notice");if(n)n.remove();}remove();new MutationObserver(remove).observe(document.documentElement,{childList:true,subtree:true});}());</script>';
}, PHP_INT_MAX);

add_action('woocommerce_review_order_before_submit', static function (): void {
    if (!mm_mr_p0_launch_product_in_cart()) return;
    echo '<p class="mm-mr-0912-policy-links"><a href="' . esc_url(home_url('/terms-of-agreement/')) . '" target="_blank" rel="noopener">Terms of Agreement</a> · <a href="' . esc_url(home_url('/refund-cancellation-policy/')) . '" target="_blank" rel="noopener">Refund &amp; Cancellation Policy</a> · <a href="' . esc_url(home_url('/privacy-policy/')) . '" target="_blank" rel="noopener">Privacy Policy</a></p>';
}, 8);

add_action('woocommerce_review_order_before_payment', static function (): void {
    if (!mm_mr_0912_cart_is_zelle_eligible()) return;
    echo '<div class="mm-mr-0912-payment-choice"><strong>Interview Week payment choice</strong><p>Card: $549. Zelle: $499, a $50 savings. Zelle orders remain on hold and do not receive course access until payment is verified.</p></div>';
}, 8);

add_action('wp_footer', static function (): void {
    if (!mm_mr_p0_launch_product_in_cart()) return;
    echo '<script id="mm-mr-0912-payment-analytics">(function(){var last="";function emit(){var n=document.querySelector("input[name=payment_method]:checked");if(!n||n.value===last)return;last=n.value;window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:"mr_payment_method_selected",payment_method:last,offer:"interview_week",value:last==="bacs"?499:549,currency:"USD"});}document.addEventListener("change",function(e){if(!e.target||e.target.name!=="payment_method")return;emit();if(window.jQuery)jQuery(document.body).trigger("update_checkout");});document.addEventListener("DOMContentLoaded",emit);if(window.jQuery)jQuery(document.body).on("updated_checkout",emit);}());</script>';
}, 20);

function mm_mr_0914_post_enrollment_expectations(int $orderId): void {
    if (!mm_mr_p0_enabled() || !function_exists('wc_get_order')) return;
    $order = wc_get_order($orderId);
    if (!$order || !method_exists($order, 'get_items')) return;
    $offers = [];
    foreach ($order->get_items() as $item) {
        if (!is_object($item) || !method_exists($item, 'get_product_id')) continue;
        $offer = mm_mr_0912_offer_for_product(
            (int) $item->get_product_id(),
            method_exists($item, 'get_variation_id') ? (int) $item->get_variation_id() : 0
        );
        if (in_array($offer, ['interview_week', 'complete'], true)) $offers[$offer] = true;
    }
    if (!$offers) return;
    $confirmed = method_exists($order, 'is_paid') && $order->is_paid();
    echo '<section class="mm-mr-0914-next" aria-labelledby="mm-mr-0914-next-title"><h2 id="mm-mr-0914-next-title">'
        . esc_html($confirmed ? 'Enrollment confirmed. Here is what happens next.' : 'Order received. Here is what happens next.')
        . '</h2><ol><li>Keep this order confirmation for your records.</li>'
        . '<li>Use the same MissionMed account in <a href="' . esc_url(wc_get_page_permalink('myaccount')) . '">My Account</a> and My Courses.</li>'
        . '<li>Your enrollment confirmation provides the approved schedule, placement, and Signature Mock details for your program.</li>';
    if (isset($offers['complete'])) {
        echo '<li>IV Prep Complete includes Interview Week. There is no separate Interview Week charge.</li>';
    }
    echo '<li>If confirmed access does not appear as expected, <a href="' . esc_url(home_url('/contact/')) . '">contact Admissions</a>.</li>'
        . '</ol></section>';
}
add_action('woocommerce_thankyou', 'mm_mr_0914_post_enrollment_expectations', 5);

add_action('wp_footer', static function (): void {
    if (!mm_mr_p0_clean_commercial_chrome()) return;
    $script = <<<'JS'
(function(){
  var funnel=['/','/mission-residency/','/mission-residency-courses/','/compare-programs/','/course-comparison/','/product/match-prep-pro/','/product/iv-prep-complete/','/product/iv-prep-masterclass/','/product/iv-prep-essentials/','/cart/','/checkout/'];
  function cleanNotice(){
    var notice=document.getElementById("mm-mobile-notice");if(notice)notice.remove();
    var noticeStyle=document.getElementById("mm-mobile-notice-styles");if(noticeStyle)noticeStyle.remove();
  }
  function clean(){
    var el=document.querySelector("#mm-l5-header .mm-l5__top>span:first-child");if(el)el.remove();
    if(funnel.indexOf(location.pathname)!==-1)cleanNotice();
    if(document.body.classList.contains("home")){
      document.querySelectorAll("#mm-pgm-inject,.mm-pgm").forEach(function(n){n.remove();});
      document.querySelectorAll("a[href]").forEach(function(a){
        var text=(a.textContent||"").trim();
        if((text==="Explore Interview Week and Complete"||text==="View Interview Week and Complete")
          &&(a.getAttribute("href")==="#"||a.href.indexOf("/mission-residency-waitlist/")!==-1)){
          a.href="/mission-residency/";
        }
      });
      var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var n;
      while(n=w.nextNode()){if(!n.nodeValue)continue;n.nodeValue=n.nodeValue
        .replace(/Match Prep Pro/gi,"IV Prep Complete")
        .replace(/Interview Prep Foundation/gi,"IV Prep Essentials: Interview Week")
        .replace(/Interview Prep Complete/gi,"IV Prep Complete")
        .replace(/Unlimited mock interviews/gi,"Signature Mock entitlement confirmed at enrollment")
        .replace(/Four Signature Mock Interviews/gi,"Signature Mock entitlement confirmed at enrollment")
        .replace(/physicians who have matched hundreds of candidates/gi,"physician mentors who teach residency applicants");}
      if(!document.querySelector('script[src*="googletagmanager.com/gtag/js?id=GT-PJ7SPCWF"]')){
        window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};
        gtag("js",new Date());gtag("config","GT-PJ7SPCWF");
        var tag=document.createElement("script");tag.async=true;
        tag.src="https://www.googletagmanager.com/gtag/js?id=GT-PJ7SPCWF";document.head.appendChild(tag);
      }
    }
  }
  clean();document.addEventListener("DOMContentLoaded",clean);
  var fullObserver=new MutationObserver(clean);
  fullObserver.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(function(){clean();fullObserver.disconnect();},15000);
  if(funnel.indexOf(location.pathname)!==-1){
    new MutationObserver(cleanNotice).observe(document.documentElement,{childList:true,subtree:true});
  }
}());
JS;
    echo '<script id="mm-mr-p0-claims-cleanup-script">' . $script . '</script>';
}, 99);

add_filter('the_content', static function (string $content): string {
    if (!mm_mr_p0_enabled() || !is_front_page() || !in_the_loop() || !is_main_query()) return $content;
    $content = str_ireplace(
        ['Match Prep Pro', 'Interview Prep Foundation', 'Interview Prep Complete', 'Unlimited mock interviews', 'Four Signature Mock Interviews', 'physicians who have matched hundreds of candidates'],
        ['IV Prep Complete', 'IV Prep Essentials: Interview Week', 'IV Prep Complete', 'Signature Mock entitlement confirmed at enrollment', 'Signature Mock entitlement confirmed at enrollment', 'physician mentors who teach residency applicants'],
        $content
    );
    $route = '<section class="mm-mr-p0-route" aria-label="Mission Residency Fall 2026">'
        . '<style>.mm-mr-p0-route{background:#081a2f;color:#f8f3e7;padding:clamp(44px,7vw,84px) 24px;font-family:Inter,system-ui,sans-serif}.mm-mr-p0-route__in{max-width:1160px;margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:42px;align-items:center}.mm-mr-p0-route__k,.mm-mr-p0-route__card-k{color:#e5bd62;text-transform:uppercase;letter-spacing:.16em;font-size:.78rem;font-weight:800}.mm-mr-p0-route h2{color:#fff;font:600 clamp(2.2rem,5vw,4.3rem)/1.02 Georgia,serif;margin:.35em 0}.mm-mr-p0-route p{font-size:1.1rem;line-height:1.65;max-width:720px}.mm-mr-p0-route__card{background:#102945;border:1px solid rgba(229,189,98,.45);padding:28px;border-radius:18px}.mm-mr-p0-route__card strong{display:block;color:#fff;font:600 1.7rem/1.15 Georgia,serif;margin:.45em 0}.mm-mr-p0-route a{display:inline-block;background:#e5bd62;color:#071626!important;text-decoration:none!important;font-weight:800;padding:14px 22px;border-radius:999px;margin-top:14px}@media(max-width:760px){.mm-mr-p0-route__in{grid-template-columns:1fr}}</style>'
        . '<div class="mm-mr-p0-route__in"><div><span class="mm-mr-p0-route__k">Mission Residency · Fall 2026</span><h2>Don&#8217;t use your real interviews as practice.</h2><p>One expert. Your whole interview season. Learn the framework, practice under pressure, and improve with physician-led feedback before programs see you.</p><a href="' . esc_url(home_url('/mission-residency/')) . '">Explore Mission Residency</a></div>'
        . '<div class="mm-mr-p0-route__card"><span class="mm-mr-p0-route__card-k">Two clear paths</span><strong>Live kickoff or whole-season support.</strong><p>Interview Week builds the live foundation. Complete includes Interview Week and continues the coaching, practice, and feedback.</p><a href="' . esc_url(home_url('/mission-residency-courses/')) . '">Compare the two paths</a></div></div></section>';
    // DR-267 secondary directory; no product, checkout or payment mutation.
    $route .= '<section class="mm-mr-p0-route" aria-label="Other ways we can help"><div class="mm-mr-p0-route__in"><div>'
        . '<span class="mm-mr-p0-route__k">Other ways we can help</span>'
        . '<h2>Interview in the next 7 days?</h2>'
        . '<p><strong>Emergency Private Interview Intensive &middot; $3,999</strong><br>4 total private hours with Dr Brian, including 3 Signature Mock Interviews, for a real interview 7 days or less away.</p>'
        . '<p>Does not include Interview Week, Complete, its season-long pathway or Match Guarantee. If time allows, we recommend Complete instead.</p>'
        . '<a href="' . esc_url(home_url('/mission-residency/#emergency-prep')) . '">Explore emergency preparation</a></div>'
        . '<div class="mm-mr-p0-route__card"><span class="mm-mr-p0-route__card-k">SOLD OUT</span>'
        . '<strong>360 Match Mentorship &middot; $5,499</strong><p>Our highest-touch, one-to-one mentorship model. Currently unavailable for enrollment.</p></div></div></section>';
    return $route . $content;
}, 20);
