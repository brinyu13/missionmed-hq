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
 *
 * `prepare` creates pending orders only. It cannot initiate payment. `refund`
 * performs the exact guarded Stripe + WooCommerce refund after paid inspection.
 */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

const MR0912_LIVE_PRIVATE_DIR = '/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update';
const MR0912_LIVE_MANIFEST = MR0912_LIVE_PRIVATE_DIR . '/live-card-orders.json';

foreach (['new_order', 'customer_processing_order', 'customer_completed_order', 'customer_refunded_order', 'customer_on_hold_order', 'customer_invoice', 'customer_note', 'customer_new_account'] as $emailId) {
    add_filter('woocommerce_email_enabled_' . $emailId, '__return_false', 999);
}

$mode = (string) ($args[0] ?? '');
$offerKey = (string) ($args[1] ?? '');
$orderId = (int) ($args[2] ?? 0);

function mr0912_live_specs(): array {
    return [
        'interview_week' => [
            'product_id' => 5504,
            'variation_id' => 5867,
            'course_id' => 3646,
            'unrelated_course_id' => 5227,
            'amount' => 500.0,
            'label' => 'Interview Week',
        ],
        'complete' => [
            'product_id' => 3576,
            'variation_id' => 5865,
            'course_id' => 5227,
            'unrelated_course_id' => 3646,
            'amount' => 3099.0,
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
        || abs((float) $variation->get_price() - (float) $spec['amount']) > 0.001
        || array_values(array_map('intval', (array) get_post_meta((int) $spec['variation_id'], '_related_course', true))) !== [(int) $spec['course_id']]) {
        throw new RuntimeException('Exact product/variation/price/course precondition failed.');
    }
    return $variation;
}

function mr0912_live_order(string $offerKey, int $orderId): array {
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
    $exact = $metaOffer === $offerKey
        && $order->get_created_via() === 'mr-web-0912-live-card'
        && $order->get_currency() === 'USD'
        && abs((float) $order->get_total() - (float) $spec['amount']) < 0.001
        && $userId > 0
        && $identity;
    if (!$exact) throw new RuntimeException('Controlled order identity/amount guard failed.');
    return [$spec, $order, $userId, $item];
}

function mr0912_live_create(string $offerKey): array {
    $spec = mr0912_live_spec($offerKey);
    $variation = mr0912_live_assert_product($spec);
    $suffix = strtolower(wp_generate_password(14, false, false));
    $login = 'mr0912_live_' . $offerKey . '_' . $suffix;
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

    $token = bin2hex(random_bytes(32));
    update_user_meta((int) $userId, '_temporary_login', 'yes');
    update_user_meta((int) $userId, '_temporary_login_token', $token);
    update_user_meta((int) $userId, '_temporary_login_expiration', current_time('timestamp') + 4 * HOUR_IN_SECONDS);
    update_user_meta((int) $userId, '_temporary_login_pointer_dismissed', 1);

    $order = wc_create_order(['customer_id' => (int) $userId, 'created_via' => 'mr-web-0912-live-card']);
    if (is_wp_error($order)) throw new RuntimeException('Controlled live order creation failed.');
    $order->add_product($variation, 1);
    $order->set_payment_method('stripe');
    $order->set_payment_method_title('Credit / Debit Card');
    $order->set_billing_first_name('MR0912');
    $order->set_billing_last_name('Acceptance');
    $order->set_billing_email($login . '@example.invalid');
    $order->set_billing_country('US');
    $order->add_meta_data('_mr_web_0912_controlled_live', 'yes', true);
    $order->add_meta_data('_mr_web_0912_live_offer', $offerKey, true);
    $order->add_order_note('MR-WEB-0912 controlled live card acceptance; exact charge must be Founder-confirmed and immediately refunded after verification.', false, false);
    $order->calculate_totals();
    $order->save();
    if (abs((float) $order->get_total() - (float) $spec['amount']) > 0.001) {
        $order->update_status('cancelled', 'MR-WEB-0912 preparation amount guard failed.', false);
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
        'user_id' => (int) $userId,
        'order_id' => (int) $order->get_id(),
        'amount' => (float) $order->get_total(),
        'currency' => $order->get_currency(),
        'status' => $order->get_status(),
        'login_url' => $loginUrl,
        'pay_url' => $payUrl,
        'temporary_login_expires_utc' => gmdate('c', time() + 4 * HOUR_IN_SECONDS),
    ];
}

function mr0912_live_safe(array $row): array {
    return [
        'offer' => $row['offer'],
        'user_id' => $row['user_id'],
        'order_id' => $row['order_id'],
        'amount' => $row['amount'],
        'currency' => $row['currency'],
        'status' => $row['status'],
        'login_url_present' => isset($row['login_url']) && $row['login_url'] !== '',
        'pay_url_present' => isset($row['pay_url']) && $row['pay_url'] !== '',
        'temporary_login_expires_utc' => $row['temporary_login_expires_utc'],
    ];
}

function mr0912_live_inspect(string $offerKey, int $orderId, bool $final): array {
    [$spec, $order, $userId] = mr0912_live_order($offerKey, $orderId);
    clean_user_cache($userId);
    $transactionId = (string) $order->get_transaction_id();
    $refunds = $order->get_refunds();
    $refundedAmount = array_sum(array_map(static fn($refund) => (float) $refund->get_amount(), $refunds));
    $paid = $order->has_status(['processing', 'completed', 'refunded'])
        && $order->get_payment_method() === 'stripe'
        && preg_match('/^(?:pi|ch)_/', $transactionId) === 1;
    $access = mr0912_live_access($userId, (int) $spec['course_id']);
    $excluded = !mr0912_live_access($userId, (int) $spec['unrelated_course_id']);
    $counter = mr0912_live_counter($userId, (int) $spec['course_id']);
    $user = get_userdata($userId);
    $checks = [
        'official_live_stripe_card_only' => mr0912_live_gateway() instanceof WC_Payment_Gateway,
        'exact_paid_order' => $paid,
        'subscriber_account_bound' => $user instanceof WP_User && in_array('subscriber', $user->roles, true),
        'correct_entitlement_state' => $final ? !$access : $access,
        'unrelated_course_excluded' => $excluded,
        'native_order_counter_state' => $final ? $counter === [] : $counter === [$orderId],
        'refund_state' => $final
            ? $order->has_status('refunded') && abs($refundedAmount - (float) $spec['amount']) < 0.001
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
        'amount' => (float) $order->get_total(),
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
    [$spec, $order, $userId] = mr0912_live_order($offerKey, $orderId);
    $inspection = mr0912_live_inspect($offerKey, $orderId, false);
    if ($inspection['pass_count'] !== $inspection['check_count']) {
        throw new RuntimeException('Paid lifecycle inspection failed; refusing refund mutation.');
    }
    $transactionId = (string) $order->get_transaction_id();
    WC_Stripe_API::set_secret_key_for_mode('live');
    $charge = WC_Stripe_API::request([], 'charges/' . rawurlencode($transactionId), 'GET');
    $amountCents = (int) round((float) $spec['amount'] * 100);
    $chargeSafe = is_object($charge)
        && isset($charge->id, $charge->amount, $charge->currency, $charge->paid, $charge->refunded, $charge->amount_refunded)
        && hash_equals((string) $charge->id, $transactionId)
        && (int) $charge->amount === $amountCents
        && (string) $charge->currency === 'usd'
        && (bool) $charge->paid
        && !(bool) $charge->refunded
        && (int) $charge->amount_refunded === 0;
    if (!$chargeSafe) throw new RuntimeException('Official live Stripe charge guard failed; refusing refund.');

    add_filter('wc_stripe_idempotency_key', static function ($key, $request) use ($orderId) {
        return 'mr-web-0912-order-' . $orderId . '-full-refund';
    }, 999, 2);
    $stripeRefund = WC_Stripe_API::request([
        'charge' => $transactionId,
        'amount' => $amountCents,
        'reason' => 'requested_by_customer',
        'metadata' => ['order_id' => (string) $orderId, 'mission' => 'MR-WEB-0912', 'offer' => $offerKey],
    ], 'refunds', 'POST');
    if (!is_object($stripeRefund)
        || !isset($stripeRefund->id, $stripeRefund->amount, $stripeRefund->charge)
        || !str_starts_with((string) $stripeRefund->id, 're_')
        || (int) $stripeRefund->amount !== $amountCents
        || !hash_equals((string) $stripeRefund->charge, $transactionId)) {
        throw new RuntimeException('Official live Stripe refund readback failed.');
    }

    $lineItems = [];
    foreach ($order->get_items() as $itemId => $item) {
        $lineItems[$itemId] = ['qty' => (int) $item->get_quantity(), 'refund_total' => (float) $item->get_total(), 'refund_tax' => []];
    }
    $wooRefund = wc_create_refund([
        'amount' => (float) $spec['amount'],
        'reason' => 'MR-WEB-0912 controlled production payment and entitlement verification',
        'order_id' => $orderId,
        'line_items' => $lineItems,
        'refund_payment' => false,
        'restock_items' => false,
    ]);
    if (is_wp_error($wooRefund)) throw new RuntimeException('WooCommerce refund record failed: ' . $wooRefund->get_error_code());

    delete_user_meta($userId, '_temporary_login');
    delete_user_meta($userId, '_temporary_login_token');
    delete_user_meta($userId, '_temporary_login_expiration');
    delete_user_meta($userId, '_temporary_login_pointer_dismissed');

    $final = mr0912_live_inspect($offerKey, $orderId, true);
    $final['stripe_refund_created'] = true;
    $final['woo_refund_id'] = (int) $wooRefund->get_id();
    return $final;
}

try {
    if ($mode === 'preflight') {
        $gateway = mr0912_live_gateway();
        $runtime = function_exists('mm_mr_p0_runtime_config') ? mm_mr_p0_runtime_config() : [];
        $checks = [
            'official_live_stripe_enabled' => $gateway->enabled === 'yes',
            'official_stripe_live_mode' => ($gateway->settings['testmode'] ?? 'yes') === 'no',
            'live_order_manifest_absent' => !file_exists(MR0912_LIVE_MANIFEST),
            'legacy_acceptance_cannot_open_campaign' => ($runtime['campaign']['go_live_gate']['verified_live_at'] ?? null) === null
                && empty($runtime['production']['acceptance_binding_valid']),
        ];
        foreach (mr0912_live_specs() as $key => $spec) {
            $variation = mr0912_live_assert_product($spec);
            $checks[$key . '_exact_price_mapping_parent'] = $variation instanceof WC_Product_Variation;
            $checks[$key . '_still_fail_closed'] = !$variation->is_in_stock()
                && (string) get_option('mmed_mr_0912_' . $key . '_verified_live_at', '') === ''
                && (string) get_option('mmed_mr_0912_' . $key . '_acceptance_binding_sha256', '') === '';
        }
        $failed = array_keys(array_filter($checks, static fn($value) => $value !== true));
        echo wp_json_encode([
            'schema' => 'missionmed.mr_web_0912.live_card_preflight.v1',
            'verified_at_utc' => gmdate('c'),
            'payment_initiated' => false,
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
        $rows = [
            'interview_week' => mr0912_live_create('interview_week'),
            'complete' => mr0912_live_create('complete'),
        ];
        $manifest = [
            'schema' => 'missionmed.mr_web_0912.live_card_orders.v1',
            'prepared_at_utc' => gmdate('c'),
            'payment_initiated' => false,
            'orders' => $rows,
        ];
        $json = wp_json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (!is_string($json) || file_put_contents(MR0912_LIVE_MANIFEST, $json . "\n", LOCK_EX) === false) {
            throw new RuntimeException('Cannot write private live-card manifest.');
        }
        chmod(MR0912_LIVE_MANIFEST, 0600);
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
    if (!in_array($mode, ['inspect', 'refund', 'final'], true) || $orderId <= 0) {
        throw new RuntimeException('Usage: preflight|prepare OR inspect|refund|final OFFER ORDER_ID');
    }
    $result = $mode === 'refund'
        ? mr0912_live_refund($offerKey, $orderId)
        : mr0912_live_inspect($offerKey, $orderId, $mode === 'final');
    echo wp_json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    exit($result['pass_count'] === $result['check_count'] ? 0 : 1);
} catch (Throwable $error) {
    fwrite(STDERR, wp_json_encode(['result' => 'FAIL', 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES) . "\n");
    exit(1);
}
