<?php
/**
 * Plugin Name: MissionMed Mission Residency P0
 * Description: Reversible MR-WEB-0912 commerce activation with the bounded MR-WEB-0914 Fable 5 customer journey.
 * Version: 1.6.0
 */
declare(strict_types=1);

if (!defined('ABSPATH')) exit;

const MM_MR_P0_ASSET_DIR = WPMU_PLUGIN_DIR . '/missionmed-mr-0912-assets';
const MM_MR_P0_ASSET_URL = WPMU_PLUGIN_URL . '/missionmed-mr-0912-assets';
const MM_MR_0912_GOOGLE_TAG_ID = 'GT-PJ7SPCWF';
const MM_MR_0912_FINANCIAL_WAIVER_AUTHORITY = 'DR-296';
const MM_MR_0912_PRIVATE_ACCESS_AUTHORITY = 'DR-325';
const MM_MR_0912_FOREMAN_AUTHORITY = 'DR-325';
const MM_MR_0912_PRIVATE_ACCESS_CODE_SHA256 = 'f312b8b76ebd1840de756111e7ad8a6181dba9ee0916d15dd59723aa27838507';
const MM_MR_0912_PRIVATE_ACCESS_COOKIE = 'mm_mr_drj_access';
const MM_MR_0912_IW_CARD_PRICE = 549.0;
const MM_MR_0912_IW_ZELLE_PRICE = 499.0;

function mm_mr_p0_enabled(): bool {
    return get_option('mmed_mr_p0_enabled', 'no') === 'yes';
}

function mm_mr_0912_private_open_timestamp(): int {
    static $timestamp = null;
    if (is_int($timestamp)) return $timestamp;
    $open = new DateTimeImmutable('2026-09-22 12:00:00', new DateTimeZone('America/New_York'));
    $timestamp = $open->getTimestamp();
    return $timestamp;
}

function mm_mr_0912_complete_early_deadline_timestamp(): int {
    static $timestamp = null;
    if (is_int($timestamp)) return $timestamp;
    $deadline = new DateTimeImmutable('2026-09-26 23:59:59', new DateTimeZone('America/New_York'));
    $timestamp = $deadline->getTimestamp();
    return $timestamp;
}

function mm_mr_0912_complete_pif_price(): float {
    $now = (int) apply_filters('mm_mr_0912_complete_price_now', time());
    return $now <= mm_mr_0912_complete_early_deadline_timestamp() ? 3099.0 : 3499.0;
}

function mm_mr_0912_private_now(): int {
    return (int) apply_filters('mm_mr_0912_private_access_now', time());
}

function mm_mr_0912_private_window_active(): bool {
    return mm_mr_0912_private_now() < mm_mr_0912_private_open_timestamp();
}

function mm_mr_0912_private_access_admin_bypass(): bool {
    return is_user_logged_in() && current_user_can('manage_woocommerce');
}

function mm_mr_0912_private_access_signature(string $value): string {
    return hash_hmac('sha256', $value, wp_salt('auth'));
}

function mm_mr_0912_private_access_granted(): bool {
    if (!mm_mr_0912_private_window_active() || mm_mr_0912_private_access_admin_bypass()) return true;
    $cookie = isset($_COOKIE[MM_MR_0912_PRIVATE_ACCESS_COOKIE])
        ? sanitize_text_field(wp_unslash((string) $_COOKIE[MM_MR_0912_PRIVATE_ACCESS_COOKIE]))
        : '';
    $parts = explode('.', $cookie, 3);
    if (count($parts) !== 3 || $parts[0] !== 'v1' || !ctype_digit($parts[1])) return false;
    $expires = (int) $parts[1];
    if ($expires !== mm_mr_0912_private_open_timestamp() || mm_mr_0912_private_now() >= $expires) return false;
    return hash_equals(mm_mr_0912_private_access_signature('v1.' . $parts[1]), $parts[2]);
}

function mm_mr_0912_set_private_access_cookie(): bool {
    if (headers_sent()) return false;
    $expires = mm_mr_0912_private_open_timestamp();
    $value = 'v1.' . $expires . '.' . mm_mr_0912_private_access_signature('v1.' . $expires);
    $options = [
        'expires' => $expires,
        'path' => '/',
        'secure' => is_ssl(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    if (defined('COOKIE_DOMAIN') && is_string(COOKIE_DOMAIN) && COOKIE_DOMAIN !== '') {
        $options['domain'] = COOKIE_DOMAIN;
    }
    $stored = setcookie(MM_MR_0912_PRIVATE_ACCESS_COOKIE, $value, $options);
    if ($stored) $_COOKIE[MM_MR_0912_PRIVATE_ACCESS_COOKIE] = $value;
    return $stored;
}

function mm_mr_0912_base64url_encode(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function mm_mr_0912_base64url_decode(string $value): string {
    if ($value === '' || preg_match('/^[A-Za-z0-9_-]+$/', $value) !== 1) return '';
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    return is_string($decoded) ? $decoded : '';
}

function mm_mr_0912_private_resume_token(string $relativeUrl, string $offer): string {
    if (!in_array($offer, ['interview_week', 'complete', 'complete_installment'], true) || !str_starts_with($relativeUrl, '/')) return '';
    $payload = mm_mr_0912_base64url_encode((string) wp_json_encode([
        'url' => $relativeUrl,
        'offer' => $offer,
        'expires' => mm_mr_0912_private_open_timestamp(),
    ], JSON_UNESCAPED_SLASHES));
    return $payload . '.' . mm_mr_0912_private_access_signature('resume.' . $payload);
}

function mm_mr_0912_private_resume_from_token(string $token): ?array {
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2 || !hash_equals(mm_mr_0912_private_access_signature('resume.' . $parts[0]), $parts[1])) {
        return null;
    }
    $payload = json_decode(mm_mr_0912_base64url_decode($parts[0]), true);
    if (!is_array($payload)
        || !in_array(($payload['offer'] ?? ''), ['interview_week', 'complete', 'complete_installment'], true)
        || (int) ($payload['expires'] ?? 0) !== mm_mr_0912_private_open_timestamp()
        || !is_string($payload['url'] ?? null)
        || !str_starts_with($payload['url'], '/')
        || str_starts_with($payload['url'], '//')) {
        return null;
    }
    $absolute = home_url($payload['url']);
    if (wp_validate_redirect($absolute, '') !== $absolute) return null;
    return ['offer' => $payload['offer'], 'url' => $absolute];
}

function mm_mr_0912_private_gate_url(string $offer, string $relativeUrl): string {
    $token = mm_mr_0912_private_resume_token($relativeUrl, $offer);
    return add_query_arg([
        'mr_private_access' => '1',
        'mr_private_access_token' => $token,
    ], home_url('/mission-residency/'));
}

function mm_mr_p0_launch_product_in_cart(): bool {
    if (!function_exists('WC') || !WC()->cart) return false;
    foreach (WC()->cart->get_cart() as $item) {
        $productId = (int) ($item['product_id'] ?? 0);
        $variationId = (int) ($item['variation_id'] ?? 0);
        if (in_array($productId, [3576, 5504, 5513], true) || in_array($variationId, [5865, 5867, 5873], true)) {
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
        '/product/iv-prep-masterclass', '/product/iv-prep-essentials', '/cart', '/pre-checkout', '/checkout',
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
        '/product/iv-prep-masterclass', '/product/iv-prep-essentials', '/cart', '/pre-checkout', '/checkout',
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

function mm_mr_0912_live_financial_acceptance_passed(): bool {
    return get_option('mmed_mr_0912_live_financial_acceptance_status', '') === 'passed_two_offer_low_dollar_refunded_contained'
        && get_option('mmed_mr_0912_live_financial_acceptance_authority', '') === 'FOUNDER-2026-09-21-LOW-DOLLAR-LIVE-TEST'
        && preg_match('/^2026-09-21T[0-9]{2}:[0-9]{2}:[0-9]{2}\+00:00$/', (string) get_option('mmed_mr_0912_live_financial_acceptance_verified_at', '')) === 1;
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
    $priceFacts = $offerKey === 'complete'
        ? ['approved_price_schedule' => [
            'early_paid_in_full' => 3099.0,
            'early_through' => '2026-09-26T23:59:59-04:00',
            'standard_paid_in_full' => 3499.0,
            'authority' => MM_MR_0912_FOREMAN_AUTHORITY,
        ]]
        : ['price' => (float) $runtime['woo_price']];
    $facts = [
        'mission' => 'MR-WEB-0912',
        'offer' => $offerKey,
        'verified_live_at' => $verifiedAt,
        'product_id' => (int) $runtime['woo_product_id'],
        'variation_id' => (int) $runtime['woo_variation_id'],
        ...$priceFacts,
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
            // This is the verified-card target through Sept 26. After the
            // deadline a stale $3,099 product fails closed against $3,499.
            'expected_price' => mm_mr_0912_complete_pif_price(),
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
    // Installment enrichment: tied to Complete PIF acceptance (same founder authorization).
    $installmentIdentity = [
        'product_id' => 5513,
        'variation_id' => 5873,
        'course_id' => 5227,
        'expected_recurring' => 400.00,
        'expected_signup_fee' => 1000.0,
    ];
    $installmentProduct = function_exists('wc_get_product') ? wc_get_product($installmentIdentity['variation_id']) : null;
    if ($installmentProduct && isset($config['offers']['complete_installment'])) {
        $relatedCourses = array_values(array_unique(array_map('intval', (array) get_post_meta($installmentIdentity['variation_id'], '_related_course', true))));
        sort($relatedCourses, SORT_NUMERIC);
        $recurringPrice = (float) $installmentProduct->get_price();
        $signupFee = (float) get_post_meta($installmentIdentity['variation_id'], '_subscription_sign_up_fee', true);
        $mapped = $relatedCourses === [$installmentIdentity['course_id']];
        $parentVerified = method_exists($installmentProduct, 'get_parent_id')
            && (int) $installmentProduct->get_parent_id() === $installmentIdentity['product_id'];
        $soldIndividually = $installmentProduct->is_sold_individually();
        $installmentEligible = $installmentProduct->is_purchasable() && $installmentProduct->is_in_stock()
            && abs($recurringPrice - $installmentIdentity['expected_recurring']) < 0.01
            && abs($signupFee - $installmentIdentity['expected_signup_fee']) < 0.01
            && $mapped && $parentVerified && $soldIndividually;
        $installmentCheckoutUrl = add_query_arg([
            'add-to-cart' => $installmentIdentity['product_id'],
            'variation_id' => $installmentIdentity['variation_id'],
            'attribute_pa_start-date' => 'session-d-start-date',
        ], wc_get_checkout_url());
        $config['offers']['complete_installment']['runtime'] = [
            'woo_product_id' => $installmentIdentity['product_id'],
            'woo_variation_id' => $installmentIdentity['variation_id'],
            'woo_price' => $recurringPrice,
            'woo_signup_fee' => $signupFee,
            'learndash_course_id' => $installmentIdentity['course_id'],
            'related_course_ids' => $relatedCourses,
            'mapping_verified' => $mapped,
            'parent_verified' => $parentVerified,
            'sold_individually' => $soldIndividually,
            'product_eligible' => $installmentEligible,
            'checkout_allowed' => false,
            'checkout_url' => null,
            'checkout_candidate_url' => $installmentCheckoutUrl,
            'subscription' => true,
            'installment_count' => 6,
            'contractual_total' => round($signupFee + $recurringPrice * 6, 2),
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
    // Installment checkout activates when Complete PIF is accepted and installment product is eligible.
    if (!empty($config['offers']['complete']['runtime']['checkout_allowed'])
        && !empty($config['offers']['complete_installment']['runtime']['product_eligible'])) {
        $config['offers']['complete_installment']['runtime']['checkout_allowed'] = true;
        $config['offers']['complete_installment']['runtime']['checkout_url'] = $config['offers']['complete_installment']['runtime']['checkout_candidate_url'];
    }
    unset($config['offers']['complete_installment']['runtime']['checkout_candidate_url']);

    $liveFinancialPassed = mm_mr_0912_live_financial_acceptance_passed();
    $config['campaign']['go_live_gate']['financial_acceptance'] = $liveFinancialPassed
        ? [
            'status' => 'passed_two_offer_low_dollar_refunded_contained',
            'authority' => 'FOUNDER-2026-09-21-LOW-DOLLAR-LIVE-TEST',
            'passed' => true,
            'verified_at' => (string) get_option('mmed_mr_0912_live_financial_acceptance_verified_at', ''),
        ]
        : [
            'status' => mm_mr_0912_founder_waiver_valid() ? 'waived_by_founder_not_executed' : 'not_executed',
            'authority' => mm_mr_0912_founder_waiver_valid() ? MM_MR_0912_FINANCIAL_WAIVER_AUTHORITY : null,
            'passed' => false,
        ];
    if (!empty($config['offers']['complete']['runtime']['checkout_allowed'])) {
        $verifiedPriceKey = mm_mr_0912_complete_pif_price() === 3099.0
            ? 'early_card_paid_in_full'
            : 'standard';
        $config['payment_options'][$verifiedPriceKey]['public_verified'] = true;
        $config['payment_options']['complete_zelle_paid_in_full'] = [
            'amount' => mm_mr_0912_complete_pif_price(),
            'rail' => 'bacs',
            'settlement' => 'manual_verification_required_before_access',
            'public_verified' => get_option('mmed_mr_0912_complete_zelle_enabled', 'no') === 'yes',
        ];
        if (!empty($config['offers']['complete_installment']['runtime']['checkout_allowed'])) {
            $config['payment_options']['complete_installments'] = [
                'signup_fee' => 1000.0,
                'recurring_amount' => 400.0,
                'installment_count' => 6,
                'amount' => 3400.0,
                'public_verified' => true,
            ];
        }
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
    $privateWindow = mm_mr_0912_private_window_active();
    $privateGranted = mm_mr_0912_private_access_granted();
    $config['private_access'] = [
        'authority' => MM_MR_0912_PRIVATE_ACCESS_AUTHORITY,
        'mode' => $privateWindow ? 'private_early_access' : 'public_open',
        'required' => $privateWindow && !$privateGranted,
        'granted' => $privateGranted,
        'opens_at' => '2026-09-22T12:00:00-04:00',
        'timezone' => 'America/New_York',
        'public_code_disclosure' => false,
        'changes_price' => false,
        'backend_seat_cap' => false,
    ];
    $config['production'] = [
        'mission' => 'MR-WEB-0912',
        'woo_price_authoritative' => true,
        'activation_fail_closed' => true,
        'acceptance_binding_valid' => $allAccepted,
        'live_stripe_financial_acceptance' => $liveFinancialPassed
            ? 'PASSED - TWO $0.50 LIVE CHARGES REFUNDED AND CONTAINED'
            : (mm_mr_0912_founder_waiver_valid()
                ? 'WAIVED BY FOUNDER / NOT EXECUTED'
                : 'NOT EXECUTED'),
    ];
    return $config;
}

function mm_mr_0912_offer_for_product(int $productId, int $variationId = 0): ?string {
    if ($productId === 5504 && $variationId === 5867) return 'interview_week';
    if ($productId === 3576 && $variationId === 5865) return 'complete';
    if ($productId === 5513 && $variationId === 5873) return 'complete_installment';
    if (in_array($productId, [5504, 3576, 5513], true) || in_array($variationId, [5867, 5865, 5873], true)) {
        return 'invalid';
    }
    return null;
}

function mm_mr_0912_private_offer_for_ids(int $productId, int $variationId = 0): ?string {
    if (in_array($productId, [5504, 5867], true) || in_array($variationId, [5504, 5867], true)) {
        return 'interview_week';
    }
    if (in_array($productId, [3576, 5865], true) || in_array($variationId, [3576, 5865], true)) {
        return 'complete';
    }
    if (in_array($productId, [5513, 5873], true) || in_array($variationId, [5513, 5873], true)) {
        return 'complete_installment';
    }
    return null;
}

function mm_mr_0912_relative_request_uri(): string {
    $uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash((string) $_SERVER['REQUEST_URI']) : '/';
    if (!str_starts_with($uri, '/') || str_starts_with($uri, '//') || preg_match('/[\r\n]/', $uri) === 1) return '/';
    return $uri;
}

function mm_mr_0912_redirect_to_private_access(string $offer): never {
    nocache_headers();
    wp_safe_redirect(mm_mr_0912_private_gate_url($offer, mm_mr_0912_relative_request_uri()), 303, 'MissionMed DR-325');
    exit;
}

add_action('wp_loaded', static function (): void {
    if (!mm_mr_p0_enabled() || !mm_mr_0912_private_window_active() || mm_mr_0912_private_access_granted()
        || is_admin() || wp_doing_ajax() || strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
        return;
    }
    $productId = isset($_GET['add-to-cart']) ? absint(wp_unslash((string) $_GET['add-to-cart'])) : 0;
    $variationId = isset($_GET['variation_id']) ? absint(wp_unslash((string) $_GET['variation_id'])) : 0;
    $offer = mm_mr_0912_private_offer_for_ids($productId, $variationId);
    if ($offer !== null) mm_mr_0912_redirect_to_private_access($offer);
}, 1);

add_action('template_redirect', static function (): void {
    if (!mm_mr_p0_enabled() || !mm_mr_0912_private_window_active() || mm_mr_0912_private_access_granted()) return;
    $path = '/' . trim((string) parse_url(mm_mr_0912_relative_request_uri(), PHP_URL_PATH), '/');
    $protectedPaths = [
        '/product/iv-prep-essentials' => 'interview_week',
        '/product/iv-prep-masterclass' => 'interview_week',
        '/product/iv-prep-complete' => 'complete',
        '/product/match-prep-pro' => 'complete',
    ];
    $offer = $protectedPaths[$path] ?? null;
    if ($offer === null && is_singular('product')) {
        $offer = mm_mr_0912_private_offer_for_ids((int) get_queried_object_id());
    }
    if ($offer === null && (is_cart() || is_checkout())) {
        foreach (mm_mr_0912_cart_offer_keys() as $cartOffer) {
            if (in_array($cartOffer, ['interview_week', 'complete'], true)) {
                $offer = $cartOffer;
                break;
            }
        }
    }
    if (is_string($offer)) mm_mr_0912_redirect_to_private_access($offer);
}, -20);

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
    if (mm_mr_0912_private_window_active() && !mm_mr_0912_private_access_granted()) {
        if (function_exists('wc_add_notice')) {
            wc_add_notice('Official enrollment for the 2026–27 season opens Tuesday, September 22 at 12:00 PM ET. Dr J students with private early access may enter their enrollment code to continue.', 'error');
        }
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
    $cartKeys = mm_mr_0912_cart_offer_keys();
    $conflicts = array_values(array_diff(['interview_week', 'complete', 'complete_installment'], [$offerKey]));
    foreach ($conflicts as $conflict) {
        if (in_array($conflict, $cartKeys, true)) {
            if (function_exists('wc_add_notice')) wc_add_notice('Choose either Interview Week or IV Prep Complete; Complete already includes Interview Week.', 'error');
            return false;
        }
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
    if ($offerKeys && mm_mr_0912_private_window_active() && !mm_mr_0912_private_access_granted()) {
        if (function_exists('wc_add_notice')) {
            wc_add_notice('Private early-access authorization is required before enrollment.', 'error');
        }
        return;
    }
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

function mm_mr_0912_zelle_offer(): ?string {
    if (!function_exists('WC') || !WC()->cart) return null;
    $items = WC()->cart->get_cart();
    if (count($items) !== 1 || count(WC()->cart->get_applied_coupons()) !== 0) return null;
    $item = reset($items);
    if (!is_array($item) || (int) ($item['quantity'] ?? 0) !== 1) return null;
    if ((int) ($item['product_id'] ?? 0) === 5504
        && (int) ($item['variation_id'] ?? 0) === 5867
        && mm_mr_0912_offer_checkout_allowed('interview_week')
        && get_option('mmed_mr_0912_iw_zelle_enabled', 'no') === 'yes') {
        return 'interview_week';
    }
    if ((int) ($item['product_id'] ?? 0) === 3576
        && (int) ($item['variation_id'] ?? 0) === 5865
        && mm_mr_0912_offer_checkout_allowed('complete')
        && get_option('mmed_mr_0912_complete_zelle_enabled', 'no') === 'yes') {
        return 'complete';
    }
    return null;
}

function mm_mr_0912_cart_is_zelle_eligible(): bool {
    return mm_mr_0912_zelle_offer() !== null;
}

function mm_mr_0912_selected_gateway(): string {
    if (!function_exists('WC') || !WC()->session) return '';
    return sanitize_key((string) WC()->session->get('chosen_payment_method', ''));
}

function mm_mr_0912_allowed_gateways(array $gateways): array {
    $allowed = [];
    if (isset($gateways['stripe'])) $allowed['stripe'] = $gateways['stripe'];
    $zelleOffer = mm_mr_0912_zelle_offer();
    if ($zelleOffer !== null && isset($gateways['bacs'])) {
        $amount = $zelleOffer === 'interview_week' ? MM_MR_0912_IW_ZELLE_PRICE : mm_mr_0912_complete_pif_price();
        $gateways['bacs']->title = $zelleOffer === 'interview_week'
            ? 'Zelle — $499 total (save $50)'
            : 'Zelle — $' . number_format($amount, 0) . ' total';
        $gateways['bacs']->description = 'Place the order and follow the secure Zelle instructions. Your order stays on hold and access is not granted until MissionMed verifies receipt.';
        $allowed['bacs'] = $gateways['bacs'];
    }
    return $allowed;
}

add_filter('woocommerce_available_payment_gateways', static function (array $gateways): array {
    if (!mm_mr_p0_launch_product_in_cart()) return $gateways;
    if (mm_mr_0912_private_window_active() && !mm_mr_0912_private_access_granted()) return [];
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
    $zelleOffer = mm_mr_0912_selected_gateway() === 'bacs' ? mm_mr_0912_zelle_offer() : null;
    foreach ($cart->get_cart() as $item) {
        if ((int) ($item['product_id'] ?? 0) !== 5504 || (int) ($item['variation_id'] ?? 0) !== 5867) continue;
        $product = $item['data'] ?? null;
        if (is_object($product) && method_exists($product, 'set_price')) {
            $product->set_price($zelleOffer === 'interview_week' ? MM_MR_0912_IW_ZELLE_PRICE : MM_MR_0912_IW_CARD_PRICE);
        }
    }
}, 999);

add_action('woocommerce_checkout_process', static function (): void {
    if (mm_mr_p0_launch_product_in_cart()
        && mm_mr_0912_private_window_active()
        && !mm_mr_0912_private_access_granted()
        && function_exists('wc_add_notice')) {
        wc_add_notice('Private early-access authorization is required before enrollment.', 'error');
        return;
    }
    $method = isset($_POST['payment_method']) ? sanitize_key(wp_unslash((string) $_POST['payment_method'])) : '';
    if ($method === 'bacs' && !mm_mr_0912_cart_is_zelle_eligible() && function_exists('wc_add_notice')) {
        wc_add_notice('Zelle is available only for one eligible paid-in-full enrollment with no coupon or other cart item.', 'error');
    }
}, 999);

add_filter('woocommerce_bacs_process_payment_order_status', static function (string $status, $order): string {
    if (!is_object($order) || !method_exists($order, 'get_items')) return $status;
    foreach ($order->get_items() as $item) {
        if (!method_exists($item, 'get_product_id') || !method_exists($item, 'get_variation_id')) continue;
        $productId = (int) $item->get_product_id();
        $variationId = (int) $item->get_variation_id();
        if (($productId === 5504 && $variationId === 5867)
            || ($productId === 3576 && $variationId === 5865)) {
            return 'on-hold';
        }
    }
    return $status;
}, 999, 2);

// Presentation only: Complete already includes Interview Week. Do not recommend buying it twice.
add_filter('woocommerce_cart_crosssell_ids', static function (array $ids): array {
    if (!mm_mr_p0_enabled() || !function_exists('WC') || !WC()->cart) return $ids;
    foreach (WC()->cart->get_cart() as $item) {
        if (in_array((int) ($item['product_id'] ?? 0), [3576, 5513], true)) {
            return array_values(array_diff($ids, [5504, 5867]));
        }
    }
    return $ids;
}, 999);

function mm_mr_0912_cart_button_markup(): string {
    $cartUrl = function_exists('wc_get_cart_url') ? (string) wc_get_cart_url() : home_url('/cart/');
    $cartCount = function_exists('WC') && WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0;
    $label = $cartCount === 1 ? 'Cart, 1 item' : 'Cart, ' . $cartCount . ' items';
    return '<a id="mm-mr-0912-cart-button" href="' . esc_url($cartUrl) . '" aria-label="' . esc_attr($label) . '">'
        . '<span aria-hidden="true">CART</span><span class="mm-mr-0912-cart-count" aria-hidden="true">' . esc_html((string) $cartCount) . '</span></a>'
        . '<style id="mm-mr-0912-cart-button-style">#mm-mr-0912-cart-button{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147482000;display:inline-flex;align-items:center;justify-content:center;gap:9px;min-width:94px;min-height:48px;padding:11px 15px;border:1px solid rgba(229,189,98,.9);border-radius:999px;background:#071626;color:#fff!important;text-decoration:none!important;font:800 13px/1 Inter,system-ui,sans-serif;letter-spacing:.12em;box-shadow:0 10px 30px rgba(0,0,0,.32);transition:transform .18s ease,box-shadow .18s ease}#mm-mr-0912-cart-button:hover,#mm-mr-0912-cart-button:focus-visible{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.4);outline:3px solid #e5bd62;outline-offset:3px}.mm-mr-0912-cart-count{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:#e5bd62;color:#071626;font-size:12px;letter-spacing:0}@media(max-width:520px){#mm-mr-0912-cart-button{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));min-height:46px;padding:10px 13px}}</style>';
}

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
    $html = preg_replace('/<\/body>/i', mm_mr_0912_cart_button_markup() . '</body>', $html, 1) ?? $html;
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
    register_rest_route('missionmed/v1', '/mr-0912-private-access', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => static function (WP_REST_Request $request) {
            $offer = sanitize_key((string) $request->get_param('offer'));
            if (!in_array($offer, ['interview_week', 'complete', 'complete_installment'], true)) $offer = '';
            $token = sanitize_text_field((string) $request->get_param('resume_token'));
            $resume = $token !== '' ? mm_mr_0912_private_resume_from_token($token) : null;
            if ($token !== '' && $resume === null) {
                return new WP_REST_Response(['ok' => false, 'reason' => 'invalid_destination'], 400);
            }
            if (is_array($resume)) $offer = (string) $resume['offer'];

            $clientFingerprint = hash_hmac(
                'sha256',
                (string) ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''),
                wp_salt('nonce')
            );
            $attemptKey = 'mmed_mr_private_attempt_' . substr($clientFingerprint, 0, 24);
            $attempts = max(0, (int) get_transient($attemptKey));
            if (mm_mr_0912_private_window_active() && $attempts >= 10) {
                return new WP_REST_Response(['ok' => false, 'reason' => 'try_later'], 429);
            }

            if (mm_mr_0912_private_window_active()) {
                $code = strtoupper(trim(sanitize_text_field((string) $request->get_param('code'))));
                $valid = hash_equals(MM_MR_0912_PRIVATE_ACCESS_CODE_SHA256, hash('sha256', $code));
                if (!$valid) {
                    set_transient($attemptKey, $attempts + 1, 10 * MINUTE_IN_SECONDS);
                    $response = new WP_REST_Response(['ok' => false, 'reason' => 'invalid_code'], 403);
                    $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
                    return $response;
                }
                delete_transient($attemptKey);
                if (!mm_mr_0912_set_private_access_cookie()) {
                    return new WP_REST_Response(['ok' => false, 'reason' => 'session_unavailable'], 500);
                }
            }

            $resumeUrl = is_array($resume) ? (string) $resume['url'] : '';
            if ($resumeUrl === '' && $offer !== '') {
                $productRoutes = [
                    'interview_week' => '/product/iv-prep-masterclass/',
                    'complete' => '/product/match-prep-pro/',
                    'complete_installment' => '/product/match-prep-pro/?payment=installments#payment-choice',
                ];
                $runtime = mm_mr_p0_runtime_config()['offers'][$offer]['runtime'] ?? [];
                if (!empty($runtime['checkout_allowed']) && isset($productRoutes[$offer])) {
                    $resumeUrl = home_url($productRoutes[$offer]);
                }
            }
            if ($resumeUrl === '') {
                return new WP_REST_Response(['ok' => false, 'reason' => 'offer_unavailable'], 409);
            }
            $response = new WP_REST_Response([
                'ok' => true,
                'mode' => mm_mr_0912_private_window_active() ? 'private_early_access' : 'public_open',
                'offer' => $offer,
                'resume_url' => $resumeUrl,
                'changes_price' => false,
            ]);
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
    if (str_starts_with($path, '/checkout/')) return true;
    return in_array($path, [
        '/', '/mission-residency/', '/mission-residency-courses/', '/compare-programs/',
        '/course-comparison/', '/product/match-prep-pro/', '/product/iv-prep-complete/',
        '/product/iv-prep-masterclass/', '/product/iv-prep-essentials/', '/cart/', '/pre-checkout/', '/checkout/',
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

add_action('wp_footer', static function (): void {
    if (!mm_mr_0912_is_customer_funnel_route()) return;
    echo mm_mr_0912_cart_button_markup(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- composed from escaped local values.
}, PHP_INT_MAX - 1);

add_action('woocommerce_review_order_before_submit', static function (): void {
    if (!mm_mr_p0_launch_product_in_cart()) return;
    echo '<p class="mm-mr-0912-policy-links"><a href="' . esc_url(home_url('/terms-of-agreement/')) . '" target="_blank" rel="noopener">Terms of Agreement</a> · <a href="' . esc_url(home_url('/refund-cancellation-policy/')) . '" target="_blank" rel="noopener">Refund &amp; Cancellation Policy</a> · <a href="' . esc_url(home_url('/privacy-policy/')) . '" target="_blank" rel="noopener">Privacy Policy</a></p>';
}, 8);

add_action('woocommerce_review_order_before_payment', static function (): void {
    $offer = mm_mr_0912_zelle_offer();
    if ($offer === null) return;
    if ($offer === 'interview_week') {
        echo '<div class="mm-mr-0912-payment-choice"><strong>Interview Week payment choice</strong><p>Card: $549. Zelle: $499, a $50 savings. Zelle orders remain on hold and do not receive course access until payment is verified.</p></div>';
        return;
    }
    echo '<div class="mm-mr-0912-payment-choice"><strong>IV Prep Complete payment choice</strong><p>Card or Zelle: $'
        . esc_html(number_format(mm_mr_0912_complete_pif_price(), 0))
        . ' paid in full. Zelle has no separate discount; the order remains on hold and receives no course access until payment is verified.</p></div>';
}, 8);

add_action('wp_footer', static function (): void {
    if (!mm_mr_p0_launch_product_in_cart()) return;
    $offer = mm_mr_0912_zelle_offer();
    $cardValue = $offer === 'interview_week' ? MM_MR_0912_IW_CARD_PRICE : mm_mr_0912_complete_pif_price();
    $zelleValue = $offer === 'interview_week' ? MM_MR_0912_IW_ZELLE_PRICE : $cardValue;
    echo '<script id="mm-mr-0912-payment-analytics">(function(){var last="",requested=new URLSearchParams(location.search).get("mr_payment")==="zelle",applied=false;function choose(){if(!requested||applied)return;var n=document.querySelector("input[name=payment_method][value=bacs]");if(!n)return;applied=true;n.checked=true;n.dispatchEvent(new Event("change",{bubbles:true}));}function emit(){var n=document.querySelector("input[name=payment_method]:checked");if(!n||n.value===last)return;last=n.value;window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:"mr_payment_method_selected",payment_method:last,offer:'
        . wp_json_encode($offer ?: 'protected_offer') . ',value:last==="bacs"?'
        . wp_json_encode($zelleValue) . ':' . wp_json_encode($cardValue)
        . ',currency:"USD"});}document.addEventListener("change",function(e){if(!e.target||e.target.name!=="payment_method")return;emit();if(window.jQuery)jQuery(document.body).trigger("update_checkout");});document.addEventListener("DOMContentLoaded",function(){choose();emit();});if(window.jQuery)jQuery(document.body).on("updated_checkout",function(){choose();emit();});}());</script>';
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
        if (in_array($offer, ['interview_week', 'complete', 'complete_installment'], true)) $offers[$offer] = true;
    }
    if (!$offers) return;
    $confirmed = method_exists($order, 'is_paid') && $order->is_paid();
    echo '<section class="mm-mr-0914-next" aria-labelledby="mm-mr-0914-next-title"><h2 id="mm-mr-0914-next-title">'
        . esc_html($confirmed ? 'Enrollment confirmed. Here is what happens next.' : 'Order received. Here is what happens next.')
        . '</h2><ol><li>Keep this order confirmation for your records.</li>'
        . '<li>Use the same MissionMed account in <a href="' . esc_url(wc_get_page_permalink('myaccount')) . '">My Account</a> and My Courses.</li>'
        . '<li>Your enrollment confirmation provides the approved schedule, placement, and Signature Mock details for your program.</li>';
    if (isset($offers['complete']) || isset($offers['complete_installment'])) {
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
  var funnel=['/','/mission-residency/','/mission-residency-courses/','/compare-programs/','/course-comparison/','/product/match-prep-pro/','/product/iv-prep-complete/','/product/iv-prep-masterclass/','/product/iv-prep-essentials/','/cart/','/pre-checkout/','/checkout/'];
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
