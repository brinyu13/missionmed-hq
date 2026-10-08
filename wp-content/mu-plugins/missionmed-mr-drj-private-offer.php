<?php
/**
 * Plugin Name: Mission Residency Private Dr J Invitation
 * Description: Isolated account-bound Complete invitation. DR-401. No mail sender or entitlement grants.
 * Version: 2026.10.08.1
 */
if (!defined('ABSPATH')) { exit; }

final class MissionMed_MR_DrJ_Private_Offer {
    const CAMPAIGN = 'MR-DRJ-PRIVATE-20261008';
    const MANIFEST = '_missionmed_mr_drj_private_manifest_v1';
    const ENABLED = '_missionmed_mr_drj_private_enabled';
    const EXPIRY = 1791648000; // October 10, 2026, 12:00 America/New_York.
    const REFERENCE = 3499;
    const DISCOUNT = 1000;
    const TUITION = 2499;
    private static $seam_ready = false;
    private static $bacs = null;

    public static function cart_invitation() {
        if (!WC()->cart) { return null; }
        $codes = WC()->cart->get_applied_coupons();
        if (count($codes) !== 1) { return null; }
        $coupon = new WC_Coupon($codes[0]);
        return self::private_coupon($coupon) ? $coupon : null;
    }

    public static function private_zelle_allowed() {
        $coupon = self::cart_invitation();
        return self::$seam_ready && $coupon && self::policy(self::facts($coupon)) === ''
            && function_exists('mm_mr_0912_cart_is_checkout_safe') && mm_mr_0912_cart_is_checkout_safe()
            && mm_mr_0912_offer_checkout_allowed('complete')
            && (!mm_mr_0912_private_window_active() || mm_mr_0912_private_access_granted())
            && get_option('mmed_mr_0912_complete_zelle_enabled', 'no') === 'yes';
    }

    public static function integrate_checkout() {
        // Accepted P0/verifier files are immutable. Wrap only this exact legacy
        // no-coupon rule, retaining it verbatim for every non-invitation request.
        global $wp_filter;
        $path = WP_CONTENT_DIR.'/mu-plugins/missionmed-mr-p0.php';
        if (!is_file($path) || hash_file('sha256', $path) !== 'aa7e296ccce7d9a6812adee731bd19012a13ba02b853eac1fe1340326bfc31f5') { return; }
        $matches = [];
        foreach (($wp_filter['woocommerce_checkout_process']->callbacks[999] ?? []) as $callback) {
            if (!($callback['function'] instanceof Closure)) { continue; }
            $r = new ReflectionFunction($callback['function']);
            if (realpath($r->getFileName()) !== realpath($path)) { continue; }
            $lines = file($path);
            $body = implode('', array_slice($lines, $r->getStartLine()-1, $r->getEndLine()-$r->getStartLine()+1));
            if (strpos($body, 'Zelle is available only for one eligible paid-in-full enrollment with no coupon or other cart item.') !== false) { $matches[] = $callback['function']; }
        }
        if (count($matches) !== 1) { return; }
        $original = $matches[0];
        remove_action('woocommerce_checkout_process', $original, 999);
        add_action('woocommerce_checkout_process', static function () use ($original) {
            if (!self::private_zelle_allowed()) { $original(); }
        }, 999);
        self::$seam_ready = true;
    }

    public static function capture_gateways($gateways) {
        self::$bacs = $gateways['bacs'] ?? null;
        return $gateways;
    }

    public static function invitation_gateways($gateways) {
        if (self::$bacs && self::private_zelle_allowed()) {
            $gateway = clone self::$bacs;
            $gateway->title = 'Zelle — $2,499 total';
            $gateway->description = 'Your enrollment remains on hold until MissionMed verifies the exact Zelle payment. No access is granted by submitting a payer name.';
            $gateways['bacs'] = $gateway;
        }
        return $gateways;
    }

    public static function private_coupon($coupon) {
        return $coupon instanceof WC_Coupon && $coupon->get_meta('_mr_drj_campaign', true) === self::CAMPAIGN;
    }

    public static function policy($facts) {
        foreach (['enabled','integration_ready','authenticated','identity_matches','verified_drj','communication_eligible','not_suppressed','not_enrolled','stock_available','product_only','one_coupon','unused','identity_snapshot_current'] as $key) {
            if (empty($facts[$key])) { return $key; }
        }
        if (($facts['now'] ?? PHP_INT_MAX) >= self::EXPIRY) { return 'expired'; }
        return '';
    }

    public static function entry($user_id) {
        $manifest = get_option(self::MANIFEST, []);
        return is_array($manifest) ? ($manifest['entries'][(string) $user_id] ?? []) : [];
    }

    public static function existing_program($user_id, $email, $ignore_order = 0) {
        $courses = function_exists('learndash_user_get_enrolled_courses') ? learndash_user_get_enrolled_courses($user_id) : null;
        if (!is_array($courses)) { return true; } // Missing authoritative enrollment reader fails closed.
        if (array_intersect([3646,5227], array_map('intval', $courses))) { return true; }
        // Course 3893 also carries Dr J Drills/Matrix: never equate it alone with a 360 purchase.
        if (in_array(3893, array_map('intval', $courses), true)
            && (!function_exists('mm_drj_drills_access_user_is_restricted') || !mm_drj_drills_access_user_is_restricted($user_id))) { return true; }
        $tier = (string) get_user_meta($user_id, '_mmed_program_tier', true);
        if (in_array($tier, ['360elite','360elite_onboarding','360_match_mentorship'], true)) { return true; }
        $orders = wc_get_orders(['customer_id' => $user_id, 'status' => ['pending','on-hold','processing','completed'], 'limit' => -1]);
        $email_orders = wc_get_orders(['billing_email' => $email, 'status' => ['pending','on-hold','processing','completed'], 'limit' => -1]);
        foreach (array_merge($orders, $email_orders) as $order) {
            if ((int) $order->get_id() === (int) $ignore_order) { continue; }
            foreach ($order->get_items() as $item) {
                if (in_array((int) $item->get_product_id(), [3575,5511,3576,5513,5504], true)) { return true; }
            }
        }
        return false;
    }

    public static function facts($coupon, $billing_email = null, $ignore_order = 0) {
        $user_id = get_current_user_id();
        $user = $user_id ? get_userdata($user_id) : null;
        $email = $user ? strtolower(trim($user->user_email)) : '';
        $entry = self::entry($user_id);
        $items = WC()->cart ? WC()->cart->get_cart() : [];
        $only_complete = count($items) === 1;
        foreach ($items as $item) {
            $only_complete = $only_complete && (int) $item['product_id'] === 3576
                && (int) $item['variation_id'] === 5865 && (int) $item['quantity'] === 1;
        }
        $applied = WC()->cart ? WC()->cart->get_applied_coupons() : [];
        $one_coupon = !$applied || (count($applied) === 1 && strtolower($applied[0]) === strtolower($coupon->get_code()));
        $product = wc_get_product(5865);
        $identity_matches = $user_id > 0 && (int) $coupon->get_meta('_mr_drj_user_id', true) === $user_id
            && hash_equals((string) $coupon->get_meta('_mr_drj_email_sha256', true), hash('sha256', $email))
            && hash_equals((string) ($entry['email_sha256'] ?? ''), hash('sha256', $email))
            && ($entry['student_id'] ?? '') !== ''
            && ($entry['student_id'] ?? '') === $coupon->get_meta('_mr_drj_student_id', true)
            && ($billing_email === null || strtolower(trim($billing_email)) === $email);
        return [
            'enabled' => get_option(self::ENABLED, false) === '1',
            'integration_ready' => self::$seam_ready,
            'authenticated' => $user_id > 0,
            'identity_matches' => $identity_matches,
            'verified_drj' => ($entry['verified_drj'] ?? false) === true
                && function_exists('mm_drj_drills_access_user_is_restricted') && mm_drj_drills_access_user_is_restricted($user_id),
            'communication_eligible' => ($entry['eligible_for_invitation'] ?? false) === true,
            'not_suppressed' => class_exists('MissionMed_Global_Mail_Suppression') && !MissionMed_Global_Mail_Suppression::suppressed($email),
            'not_enrolled' => $identity_matches && !self::existing_program($user_id, $email, $ignore_order),
            'stock_available' => $product && $product->is_in_stock() && $product->is_purchasable()
                && (!$product->managing_stock() || $product->get_stock_quantity() > 0),
            'product_only' => $only_complete,
            'one_coupon' => $one_coupon,
            'unused' => $coupon->get_usage_count() === 0 && $coupon->get_usage_limit() === 1
                && $coupon->get_usage_limit_per_user() === 1 && $coupon->get_individual_use()
                && $coupon->get_discount_type() === 'fixed_product' && (float) $coupon->get_amount() === (float) self::DISCOUNT,
            'identity_snapshot_current' => (int) ($entry['valid_until'] ?? 0) === self::EXPIRY,
            'now' => time(),
        ];
    }

    public static function validate_coupon($valid, $coupon, $discounts = null) {
        if (!self::private_coupon($coupon)) {
            if (WC()->cart) {
                foreach (WC()->cart->get_applied_coupons() as $code) {
                    if (self::private_coupon(new WC_Coupon($code))) { throw new Exception('Your private invitation cannot be combined with another code.'); }
                }
            }
            return $valid;
        }
        if (!$valid || self::policy(self::facts($coupon)) !== '') {
            throw new Exception('This private invitation is not available for this account or enrollment. Please sign in to the invited account or contact MissionMed.');
        }
        return $valid;
    }

    public static function normalise_cart($cart) {
        if (!$cart || !method_exists($cart, 'get_applied_coupons')) { return; }
        $private = null;
        foreach ($cart->get_applied_coupons() as $code) {
            $coupon = new WC_Coupon($code);
            if (self::private_coupon($coupon)) { $private = $coupon; break; }
        }
        $valid = $private && self::policy(self::facts($private)) === '';
        foreach ($cart->get_cart() as $key => $item) {
            if ((int) $item['variation_id'] !== 5865) { continue; }
            // In-memory cart price only. No product save, metadata write or public price change.
            if ($valid) {
                if (!isset($item['_mr_drj_original_price'])) {
                    $cart->cart_contents[$key]['_mr_drj_original_price'] = $item['data']->get_price();
                    $cart->cart_contents[$key]['data'] = clone $item['data'];
                }
                $cart->cart_contents[$key]['data']->set_price(self::REFERENCE);
            } elseif (isset($item['_mr_drj_original_price'])) {
                $cart->cart_contents[$key]['data']->set_price($item['_mr_drj_original_price']);
                unset($cart->cart_contents[$key]['_mr_drj_original_price']);
            }
        }
    }

    public static function checkout_validation($data, $errors) {
        if (!WC()->cart) { return; }
        foreach (WC()->cart->get_applied_coupons() as $code) {
            $coupon = new WC_Coupon($code);
            if (!self::private_coupon($coupon)) { continue; }
            if (self::policy(self::facts($coupon, (string) ($data['billing_email'] ?? ''))) !== ''
                || !in_array($data['payment_method'] ?? '', ['stripe','bacs'], true)) {
                $errors->add('mr_drj_private_unavailable', 'Your private invitation requires its invited account, matching billing email and an available card or Zelle enrollment before the deadline.');
            }
        }
    }

    public static function create_order($order, $data) {
        foreach ($order->get_coupon_codes() as $code) {
            $coupon = new WC_Coupon($code);
            if (!self::private_coupon($coupon)) { continue; }
            if (self::policy(self::facts($coupon, (string) $order->get_billing_email(), $order->get_id())) !== ''
                || count($order->get_coupon_codes()) !== 1
                || (int) $order->get_customer_id() !== (int) $coupon->get_meta('_mr_drj_user_id', true)
                || (float) $order->get_total() !== (float) self::TUITION
                || !in_array($order->get_payment_method(), ['stripe','bacs'], true)) {
                throw new Exception('The private invitation could not be verified. No payment has been submitted. Please refresh checkout or contact MissionMed.');
            }
            $order->update_meta_data('_mr_drj_campaign', self::CAMPAIGN);
            $order->update_meta_data('_mr_drj_verified_creation_time', time());
            $order->update_meta_data('_mr_drj_bound_student_id', $coupon->get_meta('_mr_drj_student_id', true));
        }
    }

    public static function pay_existing_order($order) {
        if ($order->get_meta('_mr_drj_campaign', true) !== self::CAMPAIGN) { return; }
        $user = wp_get_current_user();
        $created = (int) $order->get_meta('_mr_drj_verified_creation_time', true);
        $entry = self::entry($user->ID);
        $method = isset($_POST['payment_method']) ? sanitize_key(wp_unslash($_POST['payment_method'])) : $order->get_payment_method();
        // The deadline governs order creation. Genuine pre-deadline orders retain
        // their agreed amount; later bank verification is not a fresh coupon use.
        if (!$user->ID || (int) $order->get_customer_id() !== (int) $user->ID
            || strtolower($order->get_billing_email()) !== strtolower($user->user_email)
            || $created <= 0 || $created >= self::EXPIRY
            || (float) $order->get_total() !== (float) self::TUITION
            || !in_array($method, ['stripe','bacs'], true)
            || ($entry['student_id'] ?? '') !== $order->get_meta('_mr_drj_bound_student_id', true)
            || !hash_equals((string) ($entry['email_sha256'] ?? ''), hash('sha256', strtolower(trim($user->user_email))))
            || empty($entry['eligible_for_invitation'])
            || empty($entry['verified_drj'])
            || !function_exists('mm_drj_drills_access_user_is_restricted') || !mm_drj_drills_access_user_is_restricted($user->ID)
            || !class_exists('MissionMed_Global_Mail_Suppression') || MissionMed_Global_Mail_Suppression::suppressed($user->user_email)
            || self::existing_program($user->ID, $user->user_email, $order->get_id())) {
            throw new Exception('This private enrollment requires review. Please contact MissionMed before paying.');
        }
    }

    public static function block_store_api($order, $request = null) {
        foreach ($order->get_coupon_codes() as $code) {
            if (self::private_coupon(new WC_Coupon($code))) {
                throw new Exception('Please use the standard MissionMed checkout for your private invitation.');
            }
        }
    }
}

add_action('init', ['MissionMed_MR_DrJ_Private_Offer','integrate_checkout'], 1000);
add_filter('woocommerce_available_payment_gateways', ['MissionMed_MR_DrJ_Private_Offer','capture_gateways'], 998);
add_filter('woocommerce_available_payment_gateways', ['MissionMed_MR_DrJ_Private_Offer','invitation_gateways'], 1000);
add_filter('woocommerce_coupon_is_valid', ['MissionMed_MR_DrJ_Private_Offer','validate_coupon'], 1000, 3);
add_action('woocommerce_before_calculate_totals', ['MissionMed_MR_DrJ_Private_Offer','normalise_cart'], 1000);
add_action('woocommerce_after_checkout_validation', ['MissionMed_MR_DrJ_Private_Offer','checkout_validation'], 1000, 2);
add_action('woocommerce_checkout_create_order', ['MissionMed_MR_DrJ_Private_Offer','create_order'], 1000, 2);
add_action('woocommerce_before_pay_action', ['MissionMed_MR_DrJ_Private_Offer','pay_existing_order'], 1000);
add_action('woocommerce_store_api_checkout_update_order_from_request', ['MissionMed_MR_DrJ_Private_Offer','block_store_api'], 1000, 2);
