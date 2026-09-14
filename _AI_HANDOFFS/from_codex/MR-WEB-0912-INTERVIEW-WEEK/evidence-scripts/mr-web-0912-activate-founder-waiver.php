<?php
/** MR-WEB-0912 DR-251 core-card activation and containment controller.
 * Usage through authenticated production WP-CLI:
 *   wp eval-file - -- activate|verify|disable
 * It never creates or submits an order, charge, refund, user, coupon or credit.
 */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

const MR0912_WAIVER_PREIMAGE = '/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update/object-preimage.json';
const MR0912_WAIVER_PREIMAGE_SHA256 = 'a13f6001117fd42b71ed7c00c0d165c292cdb9bb9768760e6749d6afe8e54f35';
const MR0912_WAIVER_PLUGIN_SHA256 = '5de4b955ec3fab04881d77683eb227bd99ad2043bb59e6abf2828b00f270a666';
const MR0912_WAIVER_STATUS = 'waived_by_founder_not_executed';
const MR0912_WAIVER_AUTHORITY = 'DR-251';

$mode = 'verify';
foreach (($args ?? []) as $arg) {
    if (in_array($arg, ['activate', 'verify', 'disable'], true)) $mode = $arg;
}

function mr0912_waiver_product(int $id): WC_Product {
    $product = wc_get_product($id);
    if (!$product) throw new RuntimeException("Missing product {$id}");
    return $product;
}

function mr0912_waiver_stock(string $status): void {
    foreach ([5504, 5867, 3576, 5865] as $id) {
        $product = mr0912_waiver_product($id);
        $product->set_stock_status($status);
        $product->save();
        clean_post_cache($id);
        wc_delete_product_transients($id);
    }
    WC_Product_Variable::sync(5504);
    WC_Product_Variable::sync(3576);
}

function mr0912_waiver_clear(): void {
    foreach ([
        'mmed_mr_0912_interview_week_verified_live_at',
        'mmed_mr_0912_interview_week_acceptance_binding_sha256',
        'mmed_mr_0912_complete_verified_live_at',
        'mmed_mr_0912_complete_acceptance_binding_sha256',
        'mmed_mr_0912_financial_test_status',
        'mmed_mr_0912_financial_test_authority',
    ] as $key) delete_option($key);
    mr0912_waiver_stock('outofstock');
}

function mr0912_waiver_preflight(): void {
    if (!is_file(MR0912_WAIVER_PREIMAGE)
        || hash_file('sha256', MR0912_WAIVER_PREIMAGE) !== MR0912_WAIVER_PREIMAGE_SHA256) {
        throw new RuntimeException('Exact production preimage is unavailable or drifted.');
    }
    $plugin = WPMU_PLUGIN_DIR . '/missionmed-mr-p0.php';
    if (!is_file($plugin) || hash_file('sha256', $plugin) !== MR0912_WAIVER_PLUGIN_SHA256) {
        throw new RuntimeException('MR-WEB-0912 source identity mismatch.');
    }
    if (!function_exists('mm_mr_0912_acceptance_binding')
        || !function_exists('mm_mr_0912_card_only_gateways')) {
        throw new RuntimeException('MR-WEB-0912 activation controls are unavailable.');
    }
    $iwParent = mr0912_waiver_product(5504);
    $iw = mr0912_waiver_product(5867);
    $completeParent = mr0912_waiver_product(3576);
    $complete = mr0912_waiver_product(5865);
    $saleEnd = $complete->get_date_on_sale_to('edit');
    $checks = [
        $iwParent->get_name('edit') === 'IV Prep Essentials: Interview Week',
        (int) $iw->get_parent_id() === 5504,
        abs((float) $iw->get_price() - 500.0) < 0.001,
        array_map('intval', (array) get_post_meta(5867, '_related_course', true)) === [3646],
        get_the_title(3646) === 'IV Prep Essentials: Interview Week',
        $completeParent->get_name('edit') === 'IV Prep Complete',
        (int) $complete->get_parent_id() === 3576,
        abs((float) $complete->get_regular_price('edit') - 3499.0) < 0.001,
        abs((float) $complete->get_price() - 3099.0) < 0.001,
        $saleEnd && gmdate('c', $saleEnd->getTimestamp()) === '2026-09-24T03:59:59+00:00',
        array_map('intval', (array) get_post_meta(5865, '_related_course', true)) === [5227],
        get_the_title(5227) === 'IV Prep Complete',
        get_option('woocommerce_enable_guest_checkout') === 'no',
        get_option('woocommerce_enable_signup_and_login_from_checkout') === 'yes',
    ];
    $gateways = WC()->payment_gateways()->payment_gateways();
    $checks[] = isset($gateways['stripe']) && (string) $gateways['stripe']->enabled === 'yes';
    foreach (get_posts(['post_type' => 'shop_coupon', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']) as $id) {
        $coupon = new WC_Coupon((int) $id);
        $targets = array_map('intval', (array) $coupon->get_product_ids('edit'));
        if (!$targets || array_intersect($targets, [5504, 5867, 3576, 5865])) $checks[] = false;
    }
    if (in_array(false, $checks, true)) throw new RuntimeException('Core-card production preflight drift.');
}

function mr0912_waiver_readback(string $mode): array {
    mr0912_waiver_preflight();
    $runtime = mm_mr_p0_runtime_config();
    $gateways = WC()->payment_gateways()->payment_gateways();
    $cardOnly = mm_mr_0912_card_only_gateways($gateways);
    $checks = [
        'waiver_status' => get_option('mmed_mr_0912_financial_test_status', '') === MR0912_WAIVER_STATUS,
        'waiver_authority' => get_option('mmed_mr_0912_financial_test_authority', '') === MR0912_WAIVER_AUTHORITY,
        'financial_acceptance_not_pass' => ($runtime['campaign']['go_live_gate']['financial_acceptance']['passed'] ?? null) === false,
        'financial_acceptance_truth' => ($runtime['production']['live_stripe_financial_acceptance'] ?? '') === 'WAIVED BY FOUNDER / NOT EXECUTED',
        'acceptance_bindings' => !empty($runtime['production']['acceptance_binding_valid']),
        'interview_checkout' => !empty($runtime['offers']['interview_week']['runtime']['checkout_allowed']),
        'complete_checkout' => !empty($runtime['offers']['complete']['runtime']['checkout_allowed']),
        'interview_stock' => mr0912_waiver_product(5867)->is_in_stock(),
        'complete_stock' => mr0912_waiver_product(5865)->is_in_stock(),
        'card_only_filter' => array_keys($cardOnly) === ['stripe'],
        'card_price_public' => ($runtime['payment_options']['early_card_paid_in_full']['amount'] ?? null) === 3099,
        'zelle_closed' => ($runtime['payment_options']['early_zelle_paid_in_full'] ?? []) === ['public_verified' => false],
        'installments_closed' => ($runtime['payment_options']['early_installments_total'] ?? []) === ['public_verified' => false],
        'upgrade_closed' => ($runtime['upgrade_credit'] ?? []) === ['public_verified' => false],
        'alumni_closed' => ($runtime['alumni'] ?? []) === ['public_verified' => false],
    ];
    return [
        'schema' => 'missionmed.mr_web_0912.founder_waiver_activation.v1',
        'mode' => $mode,
        'verified_at_utc' => gmdate('c'),
        'authority' => ['DR-246', 'DR-247', 'DR-251'],
        'live_stripe_financial_acceptance' => 'WAIVED BY FOUNDER / NOT EXECUTED',
        'products' => [
            'interview_week' => ['product' => 5504, 'variation' => 5867, 'course' => 3646, 'price' => 500],
            'complete' => ['product' => 3576, 'variation' => 5865, 'course' => 5227, 'price' => 3099, 'standard_anchor' => 3499, 'includes_interview_week' => true],
        ],
        'checks' => $checks,
        'passed' => count(array_filter($checks)),
        'total' => count($checks),
        'result' => count(array_filter($checks)) === count($checks) ? 'PASS' : 'FAIL',
    ];
}

if ($mode === 'disable') {
    mr0912_waiver_clear();
    echo wp_json_encode(['mode' => $mode, 'result' => 'PASS', 'inventory' => 'outofstock', 'acceptance' => 'cleared'], JSON_PRETTY_PRINT), "\n";
    exit(0);
}

mr0912_waiver_preflight();
if ($mode === 'activate') {
    foreach ([
        'mmed_mr_0912_interview_week_verified_live_at',
        'mmed_mr_0912_interview_week_acceptance_binding_sha256',
        'mmed_mr_0912_complete_verified_live_at',
        'mmed_mr_0912_complete_acceptance_binding_sha256',
        'mmed_mr_0912_financial_test_status',
        'mmed_mr_0912_financial_test_authority',
    ] as $key) {
        if (get_option($key, '__MR0912_MISSING__') !== '__MR0912_MISSING__') {
            throw new RuntimeException('Activation option precondition drift.');
        }
    }
    try {
        mr0912_waiver_stock('instock');
        update_option('mmed_mr_0912_financial_test_status', MR0912_WAIVER_STATUS, false);
        update_option('mmed_mr_0912_financial_test_authority', MR0912_WAIVER_AUTHORITY, false);
        $verifiedAt = gmdate('c');
        foreach (['interview_week', 'complete'] as $key) {
            $runtime = mm_mr_p0_runtime_config()['offers'][$key]['runtime'] ?? [];
            $binding = mm_mr_0912_acceptance_binding($key, $verifiedAt, $runtime);
            if (!preg_match('/^[0-9a-f]{64}$/', $binding)) throw new RuntimeException('Acceptance binding generation failed.');
            update_option('mmed_mr_0912_' . $key . '_verified_live_at', $verifiedAt, false);
            update_option('mmed_mr_0912_' . $key . '_acceptance_binding_sha256', $binding, false);
        }
    } catch (Throwable $error) {
        mr0912_waiver_clear();
        throw $error;
    }
}
$result = mr0912_waiver_readback($mode);
echo wp_json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit($result['result'] === 'PASS' ? 0 : 1);
