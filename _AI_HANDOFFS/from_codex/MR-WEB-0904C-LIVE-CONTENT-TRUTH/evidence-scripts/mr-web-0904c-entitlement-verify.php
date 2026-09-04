<?php
/** MR-WEB-0904C read-only final verification of the controlled $1 lifecycle. */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

$order = wc_get_order(9032);
$refund = wc_get_order(9034);
if (!$order instanceof WC_Order || $order instanceof WC_Order_Refund || !$refund instanceof WC_Order_Refund) {
    throw new RuntimeException('Controlled order/refund records unavailable.');
}
$userId = (int) $order->get_customer_id();
$transactionId = (string) $order->get_transaction_id();
$product = wc_get_product(6319);
$counter = get_user_meta($userId, '_learndash_woocommerce_enrolled_courses_access_counter', true);
$counter = is_array($counter) ? $counter : [];

WC_Stripe_API::set_secret_key_for_mode('live');
$charge = WC_Stripe_API::request([], 'charges/' . rawurlencode($transactionId), 'GET');

$checks = [
    'order_is_refunded' => $order->has_status('refunded'),
    'order_total_is_one_usd' => abs((float) $order->get_total() - 1.0) < 0.001 && $order->get_currency() === 'USD',
    'woo_refund_is_one_usd' => abs((float) $refund->get_amount() - 1.0) < 0.001,
    'live_stripe_charge_was_paid' => is_object($charge) && isset($charge->paid, $charge->amount, $charge->currency) && (bool) $charge->paid && (int) $charge->amount === 100 && (string) $charge->currency === 'usd',
    'live_stripe_charge_is_fully_refunded' => is_object($charge) && isset($charge->refunded, $charge->amount_refunded) && (bool) $charge->refunded && (int) $charge->amount_refunded === 100,
    'complete_access_revoked' => function_exists('sfwd_lms_has_access') && !(bool) sfwd_lms_has_access(5227, $userId),
    'native_complete_counter_cleared' => array_values(array_map('intval', (array) ($counter[5227] ?? []))) === [],
    'essentials_access_excluded' => function_exists('sfwd_lms_has_access') && !(bool) sfwd_lms_has_access(3646, $userId),
    'temporary_product_not_public' => $product instanceof WC_Product && $product->get_status() === 'draft' && $product->get_catalog_visibility() === 'hidden' && !$product->is_in_stock(),
    'temporary_product_mapping_removed' => $product instanceof WC_Product && get_post_meta(6319, '_related_course', false) === [],
];

echo wp_json_encode([
    'schema' => 'missionmed.mr_web_0904c.entitlement_verify.v1',
    'verified_at_utc' => gmdate('c'),
    'order_id' => 9032,
    'refund_id' => 9034,
    'checks' => $checks,
    'pass_count' => count(array_filter($checks)),
    'check_count' => count($checks),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit(count(array_filter($checks)) === count($checks) ? 0 : 1);
