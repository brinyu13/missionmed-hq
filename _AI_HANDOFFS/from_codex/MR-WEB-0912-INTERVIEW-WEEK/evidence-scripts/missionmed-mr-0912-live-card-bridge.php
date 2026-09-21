<?php
/**
 * Plugin Name: MissionMed MR-WEB-0912 Controlled Live-Card Bridge
 * Description: Temporary fail-closed Stripe restoration for two exact Founder-authorized $0.50 order-pay acceptance orders.
 * Version: 2026.09.21
 */

defined('ABSPATH') || exit;

final class MissionMed_MR0912_Controlled_Live_Card_Bridge {
    private const EXPECTED = [
        9153 => ['user_id' => 1379, 'product_id' => 5504, 'variation_id' => 5867, 'offer' => 'interview_week'],
        9155 => ['user_id' => 1380, 'product_id' => 3576, 'variation_id' => 5865, 'offer' => 'complete'],
    ];

    private static $stripe = null;

    public static function capture(array $gateways): array {
        if (self::controlled_order() && isset($gateways['stripe'])) {
            self::$stripe = $gateways['stripe'];
        }
        return $gateways;
    }

    public static function restore(array $gateways): array {
        if (self::$stripe && self::controlled_order()) {
            $gateways['stripe'] = self::$stripe;
        }
        return $gateways;
    }

    private static function controlled_order(): ?WC_Order {
        if (!function_exists('is_wc_endpoint_url') || !is_wc_endpoint_url('order-pay')) {
            return null;
        }

        $orderId = absint(get_query_var('order-pay'));
        $expected = self::EXPECTED[$orderId] ?? null;
        $order = $expected && function_exists('wc_get_order') ? wc_get_order($orderId) : null;
        if (!$order instanceof WC_Order || $order instanceof WC_Order_Refund) {
            return null;
        }

        $providedKey = isset($_GET['key']) ? wc_clean(wp_unslash($_GET['key'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $items = array_values($order->get_items());
        $item = $items[0] ?? null;
        $valid = get_current_user_id() === (int) $expected['user_id']
            && (int) $order->get_customer_id() === (int) $expected['user_id']
            && hash_equals($order->get_order_key(), $providedKey)
            && $order->get_created_via() === 'mr-web-0912-live-card'
            && $order->get_status() === 'pending'
            && $order->get_currency() === 'USD'
            && abs((float) $order->get_total() - 0.50) < 0.001
            && (string) $order->get_meta('_mr_web_0912_controlled_live', true) === 'yes'
            && (string) $order->get_meta('_mr_web_0912_live_offer', true) === (string) $expected['offer']
            && count($items) === 1
            && $item instanceof WC_Order_Item_Product
            && (int) $item->get_product_id() === (int) $expected['product_id']
            && (int) $item->get_variation_id() === (int) $expected['variation_id']
            && (int) $item->get_quantity() === 1;

        return $valid ? $order : null;
    }
}

add_filter('woocommerce_available_payment_gateways', [MissionMed_MR0912_Controlled_Live_Card_Bridge::class, 'capture'], 1);
add_filter('woocommerce_available_payment_gateways', [MissionMed_MR0912_Controlled_Live_Card_Bridge::class, 'restore'], 999);
