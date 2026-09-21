<?php
/**
 * MR-WEB-0912 exact live-card lifecycle controller.
 *
 * Run through authenticated production WP-CLI:
 *   wp eval-file - -- preflight
 *   wp eval-file - -- prepare
 *   wp eval-file - -- inspect interview_week|complete ORDER_ID
 *   wp eval-file - -- refund interview_week|complete ORDER_ID
 *   wp eval-file - -- final interview_week|complete ORDER_ID
 *   wp eval-file - -- cancel interview_week|complete ORDER_ID
 *   wp eval-file - -- closeout
 *
 * `prepare` creates two private 50-cent orders only. It does not change a
 * product price and cannot initiate payment. `refund` performs the exact
 * guarded Stripe + WooCommerce refund after paid inspection.
 */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

// Payment Plugins for Stripe rewrites the official `stripe` gateway ID to its
// disabled legacy `stripe_cc` ID on order reads. The controlled acceptance
// must inspect and refund the raw official Woo gateway without that migration
// compatibility filter affecting its exact guards.
if (class_exists('WC_Stripe_Gateway_Conversion')) {
    remove_filter(
        'woocommerce_order_get_payment_method',
        [WC_Stripe_Gateway_Conversion::class, 'convert_payment_method'],
        10
    );
}

const MR0912_LIVE_PRIVATE_DIR = '/www/theresidencyacademy_209/private/mr-web-0912/20260921-founder-reversal-live-card-v2';
const MR0912_LIVE_MANIFEST = MR0912_LIVE_PRIVATE_DIR . '/live-card-orders.json';
const MR0912_STRIPE_MINIMUM_USD = 0.50;

foreach (['new_order', 'customer_processing_order', 'customer_completed_order', 'customer_refunded_order', 'customer_on_hold_order', 'customer_invoice', 'customer_note', 'customer_new_account'] as $emailId) {
    add_filter('woocommerce_email_enabled_' . $emailId, '__return_false', 999);
}

$tokens = array_values(array_filter(
    array_map('strval', (array) ($args ?? [])),
    static fn(string $value): bool => !in_array($value, ['', '-', '--'], true)
));
$mode = '';
$offerKey = '';
$orderId = 0;
foreach ($tokens as $token) {
    if ($mode === '' && in_array($token, ['preflight', 'prepare', 'inspect', 'refund', 'final', 'cancel', 'closeout'], true)) {
        $mode = $token;
    } elseif ($offerKey === '' && in_array($token, ['interview_week', 'complete'], true)) {
        $offerKey = $token;
    } elseif ($orderId === 0 && ctype_digit($token)) {
        $orderId = (int) $token;
    }
}

function mr0912_live_specs(): array {
    return [
        'interview_week' => [
            'product_id' => 5504,
            'variation_id' => 5867,
            'course_id' => 3646,
            'unrelated_course_id' => 5227,
            'public_amount' => 549.0,
            'test_amount' => MR0912_STRIPE_MINIMUM_USD,
            'label' => 'Interview Week',
        ],
        'complete' => [
            'product_id' => 3576,
            'variation_id' => 5865,
            'course_id' => 5227,
            'unrelated_course_id' => 3646,
            'public_amount' => 3099.0,
            'test_amount' => MR0912_STRIPE_MINIMUM_USD,
            'label' => 'Complete early card PIF',
        ],
    ];
}

function mr0912_live_spec(string $offerKey): array {
    $spec = mr0912_live_specs()[$offerKey] ?? null;
    if (!is_array($spec)) throw new RuntimeException('Invalid offer key.');
    return $spec;
}

function mr0912_live_access(int $userId, int $courseId): bool {
    return function_exists('sfwd_lms_has_access') && (bool) sfwd_lms_has_access($courseId, $userId);
}

function mr0912_live_counter(int $userId, int $courseId): array {
    $counter = get_user_meta($userId, '_learndash_woocommerce_enrolled_courses_access_counter', true);
    $counter = is_array($counter) ? $counter : [];
    return array_values(array_map('intval', (array) ($counter[$courseId] ?? [])));
}

function mr0912_live_disable_temporary_login(int $userId): void {
    foreach (['_temporary_login', '_temporary_login_token', '_temporary_login_expiration', '_temporary_login_pointer_dismissed'] as $key) {
        delete_user_meta($userId, $key);
    }

    if (class_exists('WP_Session_Tokens')) {
        WP_Session_Tokens::get_instance($userId)->destroy_all();
    }
    if (class_exists('WC_Payment_Tokens')) {
        foreach (WC_Payment_Tokens::get_customer_tokens($userId) as $paymentToken) {
            if ($paymentToken instanceof WC_Payment_Token) $paymentToken->delete();
        }
    }
}

function mr0912_live_session_count(int $userId): int {
    return class_exists('WP_Session_Tokens')
        ? count(WP_Session_Tokens::get_instance($userId)->get_all())
        : 0;
}

function mr0912_live_payment_token_count(int $userId): int {
    return class_exists('WC_Payment_Tokens')
        ? count(WC_Payment_Tokens::get_customer_tokens($userId))
        : 0;
}

function mr0912_live_read_manifest(): array {
    if (!is_file(MR0912_LIVE_MANIFEST)) throw new RuntimeException('Private live-card manifest is unavailable.');
    $manifest = json_decode((string) file_get_contents(MR0912_LIVE_MANIFEST), true);
    if (!is_array($manifest) || ($manifest['schema'] ?? '') !== 'missionmed.mr_web_0912.live_card_orders.v2') {
        throw new RuntimeException('Private live-card manifest schema mismatch.');
    }
    return $manifest;
}

function mr0912_live_write_manifest(array $manifest): void {
    $json = wp_json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    $temporaryPath = is_string($json) ? tempnam(MR0912_LIVE_PRIVATE_DIR, '.live-card-') : false;
    if (!is_string($json) || $temporaryPath === false
        || file_put_contents($temporaryPath, $json . "\n", LOCK_EX) === false
        || !chmod($temporaryPath, 0600)
        || !rename($temporaryPath, MR0912_LIVE_MANIFEST)) {
        if (is_string($temporaryPath) && is_file($temporaryPath)) unlink($temporaryPath);
        throw new RuntimeException('Cannot write private live-card manifest.');
    }
}

function mr0912_live_manifest_row(string $offerKey, ?int $orderId = null, ?int $userId = null): array {
    $manifest = mr0912_live_read_manifest();
    $row = $manifest['orders'][$offerKey] ?? null;
    if (!is_array($row) || ($row['offer'] ?? '') !== $offerKey
        || ($orderId !== null && (int) ($row['order_id'] ?? 0) !== $orderId)
        || ($userId !== null && (int) ($row['user_id'] ?? 0) !== $userId)) {
        throw new RuntimeException('Private live-card manifest identity mismatch.');
    }
    return [$manifest, $row];
}

function mr0912_live_update_manifest_row(string $offerKey, array $changes): void {
    [$manifest] = mr0912_live_manifest_row($offerKey);
    $manifest['orders'][$offerKey] = array_merge($manifest['orders'][$offerKey], $changes);
    mr0912_live_write_manifest($manifest);
}

function mr0912_live_close_manifest(string $offerKey, int $orderId, string $state, ?int $refundId = null): void {
    [$manifest] = mr0912_live_manifest_row($offerKey, $orderId);
    unset($manifest['orders'][$offerKey]['login_url'], $manifest['orders'][$offerKey]['pay_url']);
    $manifest['orders'][$offerKey]['temporary_login_expires_utc'] = null;
    $manifest['orders'][$offerKey]['terminal_state'] = $state;
    $manifest['orders'][$offerKey]['woo_refund_id'] = $refundId;
    $manifest['orders'][$offerKey]['closed_at_utc'] = gmdate('c');
    if ($state === 'refunded') $manifest['payment_initiated'] = true;
    $closed = true;
    foreach ($manifest['orders'] as $entry) $closed = $closed && isset($entry['terminal_state']);
    $manifest['temporary_mechanism_active'] = !$closed;
    mr0912_live_write_manifest($manifest);
}

function mr0912_live_gateway(): WC_Payment_Gateway {
    $gateway = WC()->payment_gateways()->payment_gateways()['stripe'] ?? null;
    if (!$gateway instanceof WC_Payment_Gateway || $gateway->enabled !== 'yes') {
        throw new RuntimeException('Official Stripe gateway is not enabled.');
    }
    if (($gateway->settings['testmode'] ?? 'yes') !== 'no') {
        throw new RuntimeException('Official Stripe gateway is not in live mode.');
    }
    if (method_exists($gateway, 'get_upe_enabled_payment_method_ids')
        && array_values($gateway->get_upe_enabled_payment_method_ids()) !== ['card']) {
        throw new RuntimeException('Official Stripe gateway is not card-only.');
    }
    return $gateway;
}

function mr0912_live_assert_product(array $spec): WC_Product_Variation {
    $variation = wc_get_product((int) $spec['variation_id']);
    if (!$variation instanceof WC_Product_Variation
        || (int) $variation->get_parent_id() !== (int) $spec['product_id']
        || abs((float) $variation->get_price() - (float) $spec['public_amount']) > 0.001
        || array_values(array_map('intval', (array) get_post_meta((int) $spec['variation_id'], '_related_course', true))) !== [(int) $spec['course_id']]) {
        throw new RuntimeException('Exact product/variation/price/course precondition failed.');
    }
    return $variation;
}

function mr0912_live_order(string $offerKey, int $orderId): array {
    mr0912_live_manifest_row($offerKey, $orderId);
    $spec = mr0912_live_spec($offerKey);
    $order = wc_get_order($orderId);
    if (!$order instanceof WC_Order || $order instanceof WC_Order_Refund) {
        throw new RuntimeException('Controlled live order is unavailable.');
    }
    $items = array_values($order->get_items());
    $item = $items[0] ?? null;
    $userId = (int) $order->get_customer_id();
    $metaOffer = (string) $order->get_meta('_mr_web_0912_live_offer', true);
    $identity = count($items) === 1
        && $item instanceof WC_Order_Item_Product
        && (int) $item->get_product_id() === (int) $spec['product_id']
        && (int) $item->get_variation_id() === (int) $spec['variation_id']
        && (int) $item->get_quantity() === 1;
    $exact = $identity
        && $metaOffer === $offerKey
        && $order->get_created_via() === 'mr-web-0912-live-card'
        && $order->get_currency() === 'USD'
        && abs((float) $order->get_total() - (float) $spec['test_amount']) < 0.001
        && abs((float) $order->get_meta('_mr_web_0912_public_amount', true) - (float) $spec['public_amount']) < 0.001
        && abs((float) $order->get_meta('_mr_web_0912_test_amount', true) - (float) $spec['test_amount']) < 0.001
        && $userId > 0
        && abs((float) $item->get_subtotal() - (float) $spec['public_amount']) < 0.001
        && abs((float) $item->get_total() - (float) $spec['test_amount']) < 0.001
        && abs((float) $item->get_subtotal_tax()) < 0.001
        && abs((float) $item->get_total_tax()) < 0.001
        && abs((float) $order->get_total_tax()) < 0.001
        && abs((float) $order->get_shipping_total()) < 0.001
        && abs((float) $order->get_shipping_tax()) < 0.001
        && abs((float) $order->get_discount_total() - ((float) $spec['public_amount'] - (float) $spec['test_amount'])) < 0.001
        && count($order->get_items('coupon')) === 0
        && count($order->get_items('fee')) === 0
        && count($order->get_items('shipping')) === 0;
    if (!$exact) throw new RuntimeException('Controlled order identity/amount guard failed.');
    mr0912_live_manifest_row($offerKey, $orderId, $userId);
    return [$spec, $order, $userId, $item];
}

function mr0912_live_create(string $offerKey): array {
    $spec = mr0912_live_spec($offerKey);
    $variation = mr0912_live_assert_product($spec);
    $suffix = strtolower(wp_generate_password(14, false, false));
    $login = 'mr0912_live_' . $offerKey . '_' . $suffix;
    $userId = 0;
    $order = null;
    try {
        $userId = wp_insert_user([
            'user_login' => $login,
            'user_pass' => wp_generate_password(64, true, true),
            'user_email' => $login . '@example.invalid',
            'display_name' => 'MR0912 Live Acceptance ' . $spec['label'],
            'first_name' => 'MR0912',
            'last_name' => 'Acceptance',
            'role' => 'subscriber',
        ]);
        if (is_wp_error($userId)) throw new RuntimeException('Controlled subscriber creation failed: ' . $userId->get_error_code());
        mr0912_live_update_manifest_row($offerKey, ['stage' => 'user-created', 'user_id' => (int) $userId]);
        if (mr0912_live_access((int) $userId, (int) $spec['course_id'])
            || mr0912_live_access((int) $userId, (int) $spec['unrelated_course_id'])) {
            throw new RuntimeException('Fresh subscriber has unexpected pre-existing course access.');
        }

        $token = bin2hex(random_bytes(32));
        update_user_meta((int) $userId, '_temporary_login', 'yes');
        update_user_meta((int) $userId, '_temporary_login_token', $token);
        update_user_meta((int) $userId, '_temporary_login_expiration', current_time('timestamp') + 4 * HOUR_IN_SECONDS);
        update_user_meta((int) $userId, '_temporary_login_pointer_dismissed', 1);

        $order = wc_create_order(['customer_id' => (int) $userId, 'created_via' => 'mr-web-0912-live-card']);
        if (is_wp_error($order)) throw new RuntimeException('Controlled live order creation failed.');
        mr0912_live_update_manifest_row($offerKey, ['stage' => 'order-created', 'order_id' => (int) $order->get_id()]);
        $itemId = $order->add_product($variation, 1);
        $item = $order->get_item($itemId);
        if (!$item instanceof WC_Order_Item_Product) throw new RuntimeException('Controlled order item creation failed.');
        $item->set_subtotal((float) $spec['public_amount']);
        $item->set_total((float) $spec['test_amount']);
        $item->set_taxes(['subtotal' => [], 'total' => []]);
        $item->save();
        $order->set_payment_method('stripe');
        $order->set_payment_method_title('Credit / Debit Card');
        $order->set_billing_first_name('MR0912');
        $order->set_billing_last_name('Acceptance');
        $order->set_billing_email($login . '@example.invalid');
        $order->set_billing_country('US');
        $order->add_meta_data('_mr_web_0912_controlled_live', 'yes', true);
        $order->add_meta_data('_mr_web_0912_live_offer', $offerKey, true);
        $order->add_meta_data('_mr_web_0912_public_amount', (string) $spec['public_amount'], true);
        $order->add_meta_data('_mr_web_0912_test_amount', (string) $spec['test_amount'], true);
        $order->add_order_note('MR-WEB-0912 admin-only minimum-charge acceptance; public product price unchanged; charge must be Founder-confirmed and immediately refunded.', false, false);
        $order->calculate_totals(false);
        $order->set_discount_total((float) $spec['public_amount'] - (float) $spec['test_amount']);
        $order->set_total((float) $spec['test_amount']);
        $order->save();
        if (abs((float) $order->get_total() - (float) $spec['test_amount']) > 0.001
            || abs((float) $variation->get_price() - (float) $spec['public_amount']) > 0.001) {
            throw new RuntimeException('Prepared order total mismatch; order contained without payment.');
        }

        $siteToken = (string) get_option('_temporary_login_site_token', '');
        if ($siteToken === '') throw new RuntimeException('Temporary Login site token is unavailable.');
        $loginUrl = add_query_arg([
            'temp-login-token' => $token,
            'tl-site' => $siteToken,
        ], admin_url());
        $payUrl = $order->get_checkout_payment_url(true);
        return [
            'offer' => $offerKey,
            'stage' => 'prepared',
            'user_id' => (int) $userId,
            'order_id' => (int) $order->get_id(),
            'test_amount' => (float) $order->get_total(),
            'public_amount_before' => (float) $spec['public_amount'],
            'public_amount_after' => (float) wc_get_product((int) $spec['variation_id'])->get_price(),
            'currency' => $order->get_currency(),
            'status' => $order->get_status(),
            'login_url' => $loginUrl,
            'pay_url' => $payUrl,
            'temporary_login_expires_utc' => gmdate('c', time() + 4 * HOUR_IN_SECONDS),
        ];
    } catch (Throwable $error) {
        if ($order instanceof WC_Order && !$order->is_paid()) {
            $order->update_status('cancelled', 'MR-WEB-0912 preparation failed; no payment initiated.', false);
        }
        if (is_int($userId) && $userId > 0) mr0912_live_disable_temporary_login($userId);
        mr0912_live_update_manifest_row($offerKey, [
            'stage' => 'prepare-failed-contained',
            'terminal_state' => 'cancelled-unpaid',
            'prepare_error' => $error->getMessage(),
            'closed_at_utc' => gmdate('c'),
        ]);
        throw $error;
    }
}

function mr0912_live_safe(array $row): array {
    return [
        'offer' => $row['offer'],
        'user_id' => $row['user_id'],
        'order_id' => $row['order_id'],
        'test_amount' => $row['test_amount'],
        'public_amount_before' => $row['public_amount_before'],
        'public_amount_after' => $row['public_amount_after'],
        'currency' => $row['currency'],
        'status' => $row['status'],
        'login_url_present' => isset($row['login_url']) && $row['login_url'] !== '',
        'pay_url_present' => isset($row['pay_url']) && $row['pay_url'] !== '',
        'temporary_login_expires_utc' => $row['temporary_login_expires_utc'],
    ];
}

function mr0912_live_stripe_charge(string $transactionId): object {
    WC_Stripe_API::set_secret_key_for_mode('live');
    $chargeId = $transactionId;
    if (str_starts_with($transactionId, 'pi_')) {
        $intent = WC_Stripe_API::request([], 'payment_intents/' . rawurlencode($transactionId), 'GET');
        $chargeId = is_object($intent) ? (string) ($intent->latest_charge ?? '') : '';
    }
    if (!str_starts_with($chargeId, 'ch_')) throw new RuntimeException('Live Stripe charge identity is unavailable.');
    $charge = WC_Stripe_API::request([], 'charges/' . rawurlencode($chargeId), 'GET');
    if (!is_object($charge)) throw new RuntimeException('Live Stripe charge readback failed.');
    return $charge;
}

function mr0912_live_inspect(string $offerKey, int $orderId, bool $final): array {
    [$manifest, $manifestRow] = mr0912_live_manifest_row($offerKey, $orderId);
    [$spec, $order, $userId, $item] = mr0912_live_order($offerKey, $orderId);
    clean_user_cache($userId);
    $transactionId = (string) $order->get_transaction_id();
    $refunds = $order->get_refunds();
    $refundedAmount = array_sum(array_map(static fn($refund) => (float) $refund->get_amount(), $refunds));
    $paid = $order->has_status(['processing', 'completed', 'refunded'])
        && $order->get_payment_method() === 'stripe'
        && preg_match('/^(?:pi|ch)_/', $transactionId) === 1;
    $charge = $paid ? mr0912_live_stripe_charge($transactionId) : null;
    $testAmountCents = (int) round((float) $spec['test_amount'] * 100);
    $access = mr0912_live_access($userId, (int) $spec['course_id']);
    $excluded = !mr0912_live_access($userId, (int) $spec['unrelated_course_id']);
    $counter = mr0912_live_counter($userId, (int) $spec['course_id']);
    $user = get_userdata($userId);
    $checks = [
        'official_live_stripe_card_only' => mr0912_live_gateway() instanceof WC_Payment_Gateway,
        'exact_paid_order' => $paid,
        'live_stripe_amount_currency' => is_object($charge)
            && (int) ($charge->amount ?? -1) === $testAmountCents
            && (string) ($charge->currency ?? '') === 'usd'
            && (bool) ($charge->paid ?? false),
        'live_stripe_refund_state' => $final
            ? is_object($charge) && (bool) ($charge->refunded ?? false) && (int) ($charge->amount_refunded ?? -1) === $testAmountCents
            : is_object($charge) && !(bool) ($charge->refunded ?? true) && (int) ($charge->amount_refunded ?? -1) === 0,
        'public_product_price_preserved' => abs((float) mr0912_live_assert_product($spec)->get_price() - (float) $spec['public_amount']) < 0.001,
        'subscriber_account_bound' => $user instanceof WP_User && in_array('subscriber', $user->roles, true),
        'single_expected_product_no_separate_offer_charge' => count($order->get_items()) === 1,
        'order_local_override_exact_no_coupon_fee_tax' => abs((float) $item->get_subtotal() - (float) $spec['public_amount']) < 0.001
            && abs((float) $item->get_total() - (float) $spec['test_amount']) < 0.001
            && abs((float) $item->get_subtotal_tax()) < 0.001
            && abs((float) $item->get_total_tax()) < 0.001
            && abs((float) $order->get_total_tax()) < 0.001
            && abs((float) $order->get_discount_total() - ((float) $spec['public_amount'] - (float) $spec['test_amount'])) < 0.001
            && count($order->get_items('coupon')) === 0
            && count($order->get_items('fee')) === 0
            && count($order->get_items('shipping')) === 0,
        'buyer_login_session_state' => $final
            ? mr0912_live_session_count($userId) === 0
            : mr0912_live_session_count($userId) > 0,
        'no_stored_payment_token' => mr0912_live_payment_token_count($userId) === 0,
        'correct_entitlement_state' => $final ? !$access : $access,
        'unrelated_course_excluded' => $excluded,
        'native_order_counter_state' => $final ? $counter === [] : $counter === [$orderId],
        'refund_state' => $final
            ? $order->has_status('refunded') && abs($refundedAmount - (float) $spec['test_amount']) < 0.001
            : abs($refundedAmount) < 0.001,
        'course_surface_exists' => is_string(get_permalink((int) $spec['course_id']))
            && str_starts_with((string) get_permalink((int) $spec['course_id']), 'https://missionmedinstitute.com/'),
    ];
    return [
        'schema' => 'missionmed.mr_web_0912.live_card_inspection.v1',
        'verified_at_utc' => gmdate('c'),
        'offer' => $offerKey,
        'order_id' => $orderId,
        'user_id' => $userId,
        'test_amount' => (float) $order->get_total(),
        'public_amount' => (float) $spec['public_amount'],
        'currency' => $order->get_currency(),
        'order_status' => $order->get_status(),
        'payment_method' => $order->get_payment_method(),
        'transaction_id_present' => $transactionId !== '',
        'refund_count' => count($refunds),
        'checks' => $checks,
        'pass_count' => count(array_filter($checks)),
        'check_count' => count($checks),
    ];
}

function mr0912_live_refund(string $offerKey, int $orderId): array {
    [$manifest, $manifestRow] = mr0912_live_manifest_row($offerKey, $orderId);
    [$spec, $order, $userId] = mr0912_live_order($offerKey, $orderId);
    $transactionId = (string) $order->get_transaction_id();
    $charge = mr0912_live_stripe_charge($transactionId);
    $chargeId = (string) ($charge->id ?? '');
    $amountCents = (int) round((float) $spec['test_amount'] * 100);
    $chargeSafe = is_object($charge)
        && isset($charge->id, $charge->amount, $charge->currency, $charge->paid, $charge->refunded, $charge->amount_refunded)
        && str_starts_with($chargeId, 'ch_')
        && (int) $charge->amount === $amountCents
        && (string) $charge->currency === 'usd'
        && (bool) $charge->paid
        && in_array((int) $charge->amount_refunded, [0, $amountCents], true)
        && ((int) $charge->amount_refunded === 0 || (bool) $charge->refunded);
    if (!$chargeSafe) throw new RuntimeException('Official live Stripe charge guard failed; refusing refund.');

    $wooRefunded = (float) $order->get_total_refunded();
    if (abs($wooRefunded) >= 0.001 && abs($wooRefunded - (float) $spec['test_amount']) > 0.001) {
        throw new RuntimeException('Partial Woo refund state detected; manual containment required.');
    }
    if (abs($wooRefunded - (float) $spec['test_amount']) < 0.001
        && (int) $charge->amount_refunded !== $amountCents) {
        throw new RuntimeException('Woo/Stripe refund ordering or manifest evidence mismatch; manual containment required.');
    }

    $inspection = null;
    if (empty($manifestRow['paid_inspection_recorded_at_utc'])) {
        try {
            $inspection = mr0912_live_inspect($offerKey, $orderId, false);
        } catch (Throwable $inspectionError) {
            $inspection = [
                'schema' => 'missionmed.mr_web_0912.live_card_inspection_error.v1',
                'verified_at_utc' => gmdate('c'),
                'offer' => $offerKey,
                'order_id' => $orderId,
                'error' => $inspectionError->getMessage(),
            ];
        }
        $inspectionPassed = isset($inspection['pass_count'], $inspection['check_count'])
            && $inspection['pass_count'] === $inspection['check_count'];
        try {
            mr0912_live_update_manifest_row($offerKey, [
                'buyer_login_observed_at_utc' => mr0912_live_session_count($userId) > 0 ? gmdate('c') : null,
                'paid_inspection_recorded_at_utc' => gmdate('c'),
                'paid_inspection_result' => $inspectionPassed ? 'PASS' : 'FAIL',
                'paid_inspection' => $inspection,
            ]);
        } catch (Throwable $manifestEvidenceError) {
            $inspection['manifest_evidence_error'] = $manifestEvidenceError->getMessage();
        }
        [, $manifestRow] = mr0912_live_manifest_row($offerKey, $orderId, $userId);
    } else {
        $inspection = is_array($manifestRow['paid_inspection'] ?? null) ? $manifestRow['paid_inspection'] : null;
    }

    add_filter('wc_stripe_idempotency_key', static function ($key, $request) use ($orderId) {
        return 'mr-web-0912-order-' . $orderId . '-full-refund';
    }, 999, 2);
    $stripeRefund = null;
    if ((int) $charge->amount_refunded === 0) {
        mr0912_live_manifest_row($offerKey, $orderId, $userId);
        $stripeRefund = WC_Stripe_API::request([
            'charge' => $chargeId,
            'amount' => $amountCents,
            'reason' => 'requested_by_customer',
            'metadata' => ['order_id' => (string) $orderId, 'mission' => 'MR-WEB-0912', 'offer' => $offerKey],
        ], 'refunds', 'POST');
        if (!is_object($stripeRefund)
            || !isset($stripeRefund->id, $stripeRefund->amount, $stripeRefund->charge)
            || !str_starts_with((string) $stripeRefund->id, 're_')
            || (int) $stripeRefund->amount !== $amountCents
            || !hash_equals((string) $stripeRefund->charge, $chargeId)) {
            throw new RuntimeException('Official live Stripe refund readback failed.');
        }
    }
    mr0912_live_update_manifest_row($offerKey, [
        'stripe_refund_verified_at_utc' => gmdate('c'),
        'stripe_refund_id' => is_object($stripeRefund) ? (string) $stripeRefund->id : (string) ($manifestRow['stripe_refund_id'] ?? 'provider-readback'),
    ]);

    $lineItems = [];
    foreach ($order->get_items() as $itemId => $item) {
        $lineItems[$itemId] = ['qty' => (int) $item->get_quantity(), 'refund_total' => (float) $item->get_total(), 'refund_tax' => []];
    }
    $wooRefund = null;
    if (abs((float) $order->get_total_refunded()) < 0.001) {
        mr0912_live_manifest_row($offerKey, $orderId, $userId);
        $wooRefund = wc_create_refund([
            'amount' => (float) $spec['test_amount'],
            'reason' => 'MR-WEB-0912 controlled production payment and entitlement verification',
            'order_id' => $orderId,
            'line_items' => $lineItems,
            'refund_payment' => false,
            'restock_items' => false,
        ]);
        if (is_wp_error($wooRefund)) throw new RuntimeException('WooCommerce refund record failed: ' . $wooRefund->get_error_code());
    } elseif (abs((float) $order->get_total_refunded() - (float) $spec['test_amount']) > 0.001) {
        throw new RuntimeException('Partial Woo refund state detected; manual containment required.');
    }

    mr0912_live_manifest_row($offerKey, $orderId, $userId);
    mr0912_live_disable_temporary_login($userId);

    $final = mr0912_live_inspect($offerKey, $orderId, true);
    $refunds = wc_get_order($orderId)->get_refunds();
    $refundId = $wooRefund instanceof WC_Order_Refund ? (int) $wooRefund->get_id() : (int) (($refunds[0] ?? null)?->get_id() ?? 0);
    mr0912_live_close_manifest($offerKey, $orderId, 'refunded', $refundId);
    $final['stripe_refund_created_or_verified'] = true;
    $final['woo_refund_id'] = $refundId;
    $final['temporary_login_removed'] = get_user_meta($userId, '_temporary_login_token', true) === '';
    $final['paid_acceptance'] = $inspection;
    $paidAcceptancePassed = is_array($inspection)
        && isset($inspection['pass_count'], $inspection['check_count'])
        && $inspection['pass_count'] === $inspection['check_count'];
    $containmentPassed = $final['pass_count'] === $final['check_count'];
    $final['paid_acceptance_passed'] = $paidAcceptancePassed;
    $final['post_refund_containment_passed'] = $containmentPassed;
    $final['result'] = $paidAcceptancePassed && $containmentPassed ? 'PASS' : 'FAIL';
    return $final;
}

function mr0912_live_cancel_unpaid(string $offerKey, int $orderId): array {
    mr0912_live_manifest_row($offerKey, $orderId);
    [$spec, $order, $userId] = mr0912_live_order($offerKey, $orderId);
    if ($order->get_transaction_id() !== '' || $order->is_paid()) {
        throw new RuntimeException('Order has payment evidence; refusing unpaid cleanup.');
    }
    mr0912_live_manifest_row($offerKey, $orderId, $userId);
    $order->update_status('cancelled', 'MR-WEB-0912 uncharged controlled-order cleanup.', false);
    mr0912_live_manifest_row($offerKey, $orderId, $userId);
    mr0912_live_disable_temporary_login($userId);
    mr0912_live_close_manifest($offerKey, $orderId, 'cancelled-unpaid', null);
    return ['result' => 'PASS', 'offer' => $offerKey, 'order_id' => $orderId, 'payment_initiated' => false, 'temporary_login_removed' => true];
}

try {
    if ($mode === 'preflight') {
        $gateway = mr0912_live_gateway();
        if (!function_exists('is_plugin_active')) require_once ABSPATH . 'wp-admin/includes/plugin.php';
        WC_Stripe_API::set_secret_key_for_mode('live');
        $account = WC_Stripe_API::request([], 'account', 'GET');
        $runtime = function_exists('mm_mr_p0_runtime_config') ? mm_mr_p0_runtime_config() : [];
        $checks = [
            'official_live_stripe_enabled' => $gateway->enabled === 'yes',
            'official_stripe_live_mode' => ($gateway->settings['testmode'] ?? 'yes') === 'no',
            'stripe_account_usd_card_active' => is_object($account)
                && (string) ($account->country ?? '') === 'US'
                && (string) ($account->default_currency ?? '') === 'usd'
                && (bool) ($account->charges_enabled ?? false)
                && (string) ($account->capabilities->card_payments ?? '') === 'active',
            'woocommerce_currency_usd' => get_woocommerce_currency() === 'USD',
            'stripe_minimum_test_amount_exact' => abs(MR0912_STRIPE_MINIMUM_USD - 0.50) < 0.001,
            'guest_checkout_disabled' => get_option('woocommerce_enable_guest_checkout') === 'no',
            'taxes_disabled_for_exact_total' => !wc_tax_enabled(),
            'temporary_login_plugin_active' => is_plugin_active('temporary-login/temporary-login.php')
                && (string) get_option('_temporary_login_site_token', '') !== '',
            'live_order_manifest_absent' => !file_exists(MR0912_LIVE_MANIFEST),
            'current_campaign_acceptance_bound' => !empty($runtime['offers']['interview_week']['runtime']['checkout_allowed'])
                && !empty($runtime['offers']['complete']['runtime']['checkout_allowed']),
        ];
        foreach (mr0912_live_specs() as $key => $spec) {
            $variation = mr0912_live_assert_product($spec);
            $checks[$key . '_exact_price_mapping_parent'] = $variation instanceof WC_Product_Variation;
            $checks[$key . '_active_exact_binding'] = $variation->is_in_stock()
                && (string) get_option('mmed_mr_0912_' . $key . '_verified_live_at', '') !== ''
                && preg_match('/^[0-9a-f]{64}$/', (string) get_option('mmed_mr_0912_' . $key . '_acceptance_binding_sha256', '')) === 1;
        }
        $failed = array_keys(array_filter($checks, static fn($value) => $value !== true));
        echo wp_json_encode([
            'schema' => 'missionmed.mr_web_0912.live_card_preflight.v1',
            'verified_at_utc' => gmdate('c'),
            'payment_initiated' => false,
            'verified_minimum_usd' => MR0912_STRIPE_MINIMUM_USD,
            'minimum_source' => 'https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts',
            'per_offer_test_amount' => MR0912_STRIPE_MINIMUM_USD,
            'two_offer_total' => 2 * MR0912_STRIPE_MINIMUM_USD,
            'public_prices' => ['interview_week' => 549, 'complete_early_card' => 3099],
            'mechanism' => 'private authenticated WP-CLI creates exact product/variation orders with an order-local line-total override; no product price, coupon, route, or public filter changes',
            'checks' => $checks,
            'pass_count' => count($checks) - count($failed),
            'check_count' => count($checks),
            'result' => $failed ? 'FAIL' : 'PASS',
            'failed' => $failed,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
        exit($failed ? 1 : 0);
    }
    if ($mode === 'prepare') {
        if (file_exists(MR0912_LIVE_MANIFEST)) throw new RuntimeException('Live-card manifest already exists; refusing duplicate orders.');
        mr0912_live_gateway();
        $rows = [];
        $manifest = [
            'schema' => 'missionmed.mr_web_0912.live_card_orders.v2',
            'prepared_at_utc' => gmdate('c'),
            'payment_initiated' => false,
            'temporary_mechanism_active' => true,
            'verified_minimum_usd' => MR0912_STRIPE_MINIMUM_USD,
            'authorized_total_required' => 2 * MR0912_STRIPE_MINIMUM_USD,
            'orders' => [],
        ];
        foreach (array_keys(mr0912_live_specs()) as $key) {
            $manifest['orders'][$key] = ['offer' => $key, 'stage' => 'pending'];
        }
        mr0912_live_write_manifest($manifest);
        try {
            foreach (array_keys(mr0912_live_specs()) as $key) {
                $rows[$key] = mr0912_live_create($key);
                mr0912_live_update_manifest_row($key, $rows[$key]);
            }
        } catch (Throwable $error) {
            foreach ($rows as $row) {
                mr0912_live_cancel_unpaid((string) $row['offer'], (int) $row['order_id']);
            }
            $failedManifest = mr0912_live_read_manifest();
            foreach ($failedManifest['orders'] as $key => $entry) {
                if (($entry['stage'] ?? '') === 'pending') {
                    $failedManifest['orders'][$key]['stage'] = 'not-created';
                    $failedManifest['orders'][$key]['terminal_state'] = 'not-created';
                    $failedManifest['orders'][$key]['closed_at_utc'] = gmdate('c');
                }
                unset($failedManifest['orders'][$key]['login_url'], $failedManifest['orders'][$key]['pay_url']);
                $failedManifest['orders'][$key]['temporary_login_expires_utc'] = null;
            }
            $failedManifest['temporary_mechanism_active'] = false;
            $failedManifest['batch_prepare_error'] = $error->getMessage();
            mr0912_live_write_manifest($failedManifest);
            throw $error;
        }
        $manifest = mr0912_live_read_manifest();
        echo wp_json_encode([
            'schema' => $manifest['schema'],
            'prepared_at_utc' => $manifest['prepared_at_utc'],
            'payment_initiated' => false,
            'manifest_path' => MR0912_LIVE_MANIFEST,
            'manifest_sha256' => hash_file('sha256', MR0912_LIVE_MANIFEST),
            'orders' => array_map('mr0912_live_safe', $rows),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
        exit(0);
    }
    if ($mode === 'closeout') {
        $manifest = mr0912_live_read_manifest();
        if (!empty($manifest['temporary_mechanism_active'])) {
            throw new RuntimeException('Temporary controlled-order mechanism is still active.');
        }
        if (is_file(ABSPATH . 'wp-content/mu-plugins/missionmed-mr-0912-live-card-bridge.php')) {
            throw new RuntimeException('Temporary live-card bridge is still deployed.');
        }
        $inspections = [];
        foreach (['interview_week', 'complete'] as $key) {
            $row = $manifest['orders'][$key] ?? [];
            if (($row['terminal_state'] ?? '') !== 'refunded') {
                throw new RuntimeException('Both controlled orders must be refunded before closeout.');
            }
            $inspections[$key] = mr0912_live_inspect($key, (int) ($row['order_id'] ?? 0), true);
            if (($inspections[$key]['pass_count'] ?? 0) !== ($inspections[$key]['check_count'] ?? -1)) {
                throw new RuntimeException('Final controlled-order inspection failed.');
            }
        }
        $verifiedAt = gmdate('c');
        update_option('mmed_mr_0912_live_financial_acceptance_status', 'passed_two_offer_low_dollar_refunded_contained', false);
        update_option('mmed_mr_0912_live_financial_acceptance_authority', 'FOUNDER-2026-09-21-LOW-DOLLAR-LIVE-TEST', false);
        update_option('mmed_mr_0912_live_financial_acceptance_verified_at', $verifiedAt, false);
        $manifest['runtime_acceptance_recorded_at_utc'] = $verifiedAt;
        $manifest['runtime_acceptance_status'] = 'passed_two_offer_low_dollar_refunded_contained';
        mr0912_live_write_manifest($manifest);
        echo wp_json_encode([
            'result' => 'PASS',
            'verified_at_utc' => $verifiedAt,
            'status' => 'passed_two_offer_low_dollar_refunded_contained',
            'inspections' => $inspections,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
        exit(0);
    }
    if (!in_array($mode, ['inspect', 'refund', 'final', 'cancel'], true) || $orderId <= 0) {
        throw new RuntimeException('Usage: preflight|prepare|closeout OR inspect|refund|final|cancel OFFER ORDER_ID');
    }
    $result = $mode === 'refund'
        ? mr0912_live_refund($offerKey, $orderId)
        : ($mode === 'cancel'
            ? mr0912_live_cancel_unpaid($offerKey, $orderId)
            : mr0912_live_inspect($offerKey, $orderId, $mode === 'final'));
    echo wp_json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    exit(isset($result['result'])
        ? ($result['result'] === 'PASS' ? 0 : 1)
        : (isset($result['pass_count'], $result['check_count']) && $result['pass_count'] === $result['check_count'] ? 0 : 1));
} catch (Throwable $error) {
    fwrite(STDERR, wp_json_encode(['result' => 'FAIL', 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES) . "\n");
    exit(1);
}
