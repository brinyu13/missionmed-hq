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

    private static array $stripeGateways = [];
    private static bool $logged = false;

    public static function capture(array $gateways): array {
        if (self::controlled_order()) {
            foreach ($gateways as $gatewayId => $gateway) {
                if (str_contains((string) $gatewayId, 'stripe')) {
                    self::$stripeGateways[(string) $gatewayId] = $gateway;
                }
            }
        }
        return $gateways;
    }

    public static function restore(array $gateways): array {
        $order = self::controlled_order();
        if (!self::$logged) {
            error_log('[MR0912-LIVE-BRIDGE] order=' . (int) get_query_var('order-pay')
                . ' user=' . get_current_user_id()
                . ' controlled=' . ($order ? 'yes' : 'no')
                . ' stripe_gateway_count=' . count(self::$stripeGateways));
            self::$logged = true;
        }
        if ($order) {
            foreach (self::$stripeGateways as $gatewayId => $gateway) {
                $gateways[$gatewayId] = $gateway;
            }
        }
        return $gateways;
    }

    public static function clear_stale_router_notice(): void {
        if (!self::controlled_order() || !function_exists('WC') || !WC() || !WC()->session) {
            return;
        }

        $notices = WC()->session->get('wc_notices', []);
        $routerNotice = 'This cart needs payment routing review before Stripe checkout can be used. Please contact MissionMed support.';
        foreach ($notices as $type => $entries) {
            $notices[$type] = array_values(array_filter((array) $entries, static function ($entry) use ($routerNotice): bool {
                $message = is_array($entry) ? (string) ($entry['notice'] ?? '') : (string) $entry;
                return trim(wp_strip_all_tags($message)) !== $routerNotice;
            }));
        }
        WC()->session->set('wc_notices', array_filter($notices));
    }

    public static function prepare_request(): void {
        if (!self::controlled_order()) {
            return;
        }

        if (class_exists('MissionMed_WC_Stripe_Division_Router')) {
            remove_filter(
                'woocommerce_available_payment_gateways',
                [MissionMed_WC_Stripe_Division_Router::class, 'filter_payment_gateways'],
                20
            );
        }

        if (class_exists('WC_Stripe_Gateway_Conversion')) {
            remove_filter(
                'woocommerce_order_get_payment_method',
                [WC_Stripe_Gateway_Conversion::class, 'convert_payment_method'],
                10
            );
        }

        if (function_exists('WC') && WC() && WC()->session && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
            WC()->session->set('chosen_payment_method', 'stripe');
        }

        error_log('[MR0912-LIVE-BRIDGE] prepared request method=' . sanitize_key($_SERVER['REQUEST_METHOD'] ?? 'GET')
            . ' order=' . (int) get_query_var('order-pay')
            . ' posted_gateway=' . sanitize_key((string) ($_POST['payment_method'] ?? ''))); // phpcs:ignore WordPress.Security.NonceVerification.Missing
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
add_action('wp', [MissionMed_MR0912_Controlled_Live_Card_Bridge::class, 'prepare_request'], 1);
add_action('template_redirect', [MissionMed_MR0912_Controlled_Live_Card_Bridge::class, 'clear_stale_router_notice'], 50);
