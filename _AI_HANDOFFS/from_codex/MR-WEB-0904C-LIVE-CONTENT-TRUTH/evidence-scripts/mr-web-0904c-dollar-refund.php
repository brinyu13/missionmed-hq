<?php
/** MR-WEB-0904C exact $1 live-card refund and entitlement revocation proof. */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

foreach (['customer_refunded_order', 'customer_note'] as $emailId) {
    add_filter('woocommerce_email_enabled_' . $emailId, '__return_false', 999);
}

$orderId = 9032;
$productId = 6319;
$courseId = 5227;
$order = wc_get_order($orderId);
if (!$order instanceof WC_Order || $order instanceof WC_Order_Refund) {
    throw new RuntimeException('Controlled order 9032 is unavailable.');
}
$userId = (int) $order->get_customer_id();
$items = array_values($order->get_items());
$item = $items[0] ?? null;
$transactionId = (string) $order->get_transaction_id();
$safe = $order->has_status(['processing', 'completed'])
    && abs((float) $order->get_total() - 1.0) < 0.001
    && $order->get_currency() === 'USD'
    && $userId === 1316
    && count($items) === 1
    && $item instanceof WC_Order_Item_Product
    && (int) $item->get_product_id() === $productId
    && (int) $item->get_quantity() === 1
    && preg_match('/^(?:pi|ch)_/', $transactionId) === 1
    && function_exists('sfwd_lms_has_access')
    && (bool) sfwd_lms_has_access($courseId, $userId)
    && abs((float) $order->get_total_refunded()) < 0.001;
if (!$safe) {
    throw new RuntimeException('Controlled refund guard failed; refusing mutation.');
}

WC_Stripe_API::set_secret_key_for_mode('live');
$charge = WC_Stripe_API::request([], 'charges/' . rawurlencode($transactionId), 'GET');
$chargeSafe = is_object($charge)
    && isset($charge->id, $charge->amount, $charge->currency, $charge->paid, $charge->refunded, $charge->amount_refunded)
    && hash_equals((string) $charge->id, $transactionId)
    && (int) $charge->amount === 100
    && (string) $charge->currency === 'usd'
    && (bool) $charge->paid === true
    && (bool) $charge->refunded === false
    && (int) $charge->amount_refunded === 0;
if (!$chargeSafe) {
    throw new RuntimeException('Official live Stripe charge guard failed; refusing mutation.');
}

add_filter('wc_stripe_idempotency_key', static function ($key, $request) {
    return 'mr-web-0904c-order-9032-dollar-refund';
}, 999, 2);
$stripeRefund = WC_Stripe_API::request([
    'charge' => $transactionId,
    'amount' => 100,
    'reason' => 'requested_by_customer',
    'metadata' => [
        'order_id' => (string) $orderId,
        'mission' => 'MR-WEB-0904C',
    ],
], 'refunds', 'POST');
if (!is_object($stripeRefund)
    || !isset($stripeRefund->id, $stripeRefund->amount, $stripeRefund->charge)
    || !str_starts_with((string) $stripeRefund->id, 're_')
    || (int) $stripeRefund->amount !== 100
    || !hash_equals((string) $stripeRefund->charge, $transactionId)) {
    throw new RuntimeException('Official live Stripe refund readback failed.');
}

$refund = wc_create_refund([
    'amount' => 1.0,
    'reason' => 'MR-WEB-0904C controlled production payment and entitlement verification',
    'order_id' => $orderId,
    'refund_payment' => false,
    'restock_items' => false,
]);
if (is_wp_error($refund)) {
    throw new RuntimeException('WooCommerce refund record failed: ' . $refund->get_error_code());
}

$order = wc_get_order($orderId);
clean_user_cache($userId);
$counter = get_user_meta($userId, '_learndash_woocommerce_enrolled_courses_access_counter', true);
$counter = is_array($counter) ? $counter : [];
$courseOrders = array_values(array_map('intval', (array) ($counter[$courseId] ?? [])));
$checks = [
    'refund_created' => $refund instanceof WC_Order_Refund && (int) $refund->get_id() > 0,
    'live_stripe_refund_created' => str_starts_with((string) $stripeRefund->id, 're_') && (int) $stripeRefund->amount === 100,
    'gateway_refund_amount' => abs((float) $order->get_total_refunded() - 1.0) < 0.001,
    'order_refunded' => $order->has_status('refunded'),
    'complete_access_revoked' => !(bool) sfwd_lms_has_access($courseId, $userId),
    'native_counter_cleared' => $courseOrders === [],
    'essentials_still_excluded' => !(bool) sfwd_lms_has_access(3646, $userId),
];

echo wp_json_encode([
    'schema' => 'missionmed.mr_web_0904c.dollar_refund.v1',
    'verified_at_utc' => gmdate('c'),
    'order_id' => $orderId,
    'refund_id' => (int) $refund->get_id(),
    'stripe_refund_created' => str_starts_with((string) $stripeRefund->id, 're_'),
    'payment_method' => $order->get_payment_method(),
    'checks' => $checks,
    'pass_count' => count(array_filter($checks)),
    'check_count' => count($checks),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit(count(array_filter($checks)) === count($checks) ? 0 : 1);
