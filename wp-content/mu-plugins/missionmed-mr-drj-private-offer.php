<?php
/**
 * Plugin Name: Mission Residency Private Dr J Invitation
 * Description: Isolated email/account-bound Complete invitation. DR-401/405. No entitlement grants.
 * Version: 2026.10.08.3
 */
if (!defined('ABSPATH')) { exit; }

final class MissionMed_MR_DrJ_Private_Offer {
    const CAMPAIGN = 'MR-DRJ-PRIVATE-20261008';
    const MANIFEST = '_missionmed_mr_drj_private_manifest_v2';
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

    public static function checkout_layout() {
        // Render only for this private cart. Never restyle ordinary checkout.
        if (!function_exists('is_checkout') || !is_checkout() || !self::cart_invitation()) { return; }
        echo '<style id="mr-drj-private-checkout-layout">
        form.checkout #order_review{box-sizing:border-box;padding:16px!important}
        form.checkout .woocommerce-checkout-review-order-table{table-layout:fixed;width:100%!important;max-width:100%}
        form.checkout .woocommerce-checkout-review-order-table th,form.checkout .woocommerce-checkout-review-order-table td{box-sizing:border-box;overflow-wrap:anywhere;padding:12px 8px!important}
        form.checkout .woocommerce-checkout-review-order-table .product-name{width:62%}
        form.checkout .woocommerce-checkout-review-order-table .product-total{width:38%}
        form.checkout #payment,form.checkout #payment .payment_box{box-sizing:border-box;max-width:100%}
        form.checkout #payment .payment_box{padding:12px!important}
        @media(max-width:767px){
        form.checkout{padding-left:0!important;padding-right:0!important}
        form.checkout #order_review_heading{padding:18px 12px!important}
        form.checkout #order_review{width:100%!important;padding:10px!important}
        form.checkout #payment ul.payment_methods{padding:8px!important}
        form.checkout .woocommerce-checkout-review-order-table{font-size:15px}
        }
        </style>';
    }

    public static function policy($facts) {
        foreach (['enabled','integration_ready','authenticated','identity_matches','source_audience','founder_approved','not_suppressed','not_enrolled','stock_available','product_only','one_coupon','unused','identity_snapshot_current'] as $key) {
            if (empty($facts[$key])) { return $key; }
        }
        if (($facts['now'] ?? PHP_INT_MAX) >= self::EXPIRY) { return 'expired'; }
        return '';
    }

    public static function entry_for_email($email) {
        $manifest = get_option(self::MANIFEST, []);
        return is_array($manifest) ? ($manifest['entries'][hash('sha256', strtolower(trim($email)))] ?? []) : [];
    }

    public static function entry($user_id) {
        $user = get_userdata($user_id);
        return $user ? self::entry_for_email($user->user_email) : [];
    }

    public static function suppressed($email) {
        return !class_exists('MissionMed_Global_Mail_Suppression')
            || MissionMed_Global_Mail_Suppression::suppressed($email)
            || (bool) get_option('_mmdrj_mail_suppress_'.hash('sha256', strtolower(trim($email))), false);
    }

    public static function enabled_for($entry, $coupon) {
        if (get_option(self::ENABLED, '0') === '1') { return true; }
        // Temporary internal-only nonfinancial QA. No public query/header bypass.
        return !empty($entry['internal_qa']) && $coupon->get_meta('_mr_drj_internal_qa', true) === '1'
            && (int) get_option('_mr_drj_qa_until', 0) > time();
    }

    public static function existing_program($user_id, $email, $ignore_order = 0) {
        $courses = function_exists('learndash_user_get_enrolled_courses') ? learndash_user_get_enrolled_courses($user_id) : null;
        if (!is_array($courses)) { return true; } // Missing authoritative enrollment reader fails closed.
        $active = [];
        foreach ([3646,5227,3893] as $course) {
            if (in_array($course, array_map('intval', $courses), true)
                && function_exists('sfwd_lms_has_access') && sfwd_lms_has_access($course, $user_id)
                && (!function_exists('ld_course_access_expired') || !ld_course_access_expired($course, $user_id))) { $active[] = $course; }
        }
        if (!$active) { return false; }
        // Current enrollment first. This is NOT an exclusion for any historical purchase.
        $statuses = array_keys(wc_get_order_statuses());
        $orders = wc_get_orders(['customer_id' => $user_id, 'status' => $statuses, 'limit' => -1]);
        $email_orders = wc_get_orders(['billing_email' => $email, 'status' => $statuses, 'limit' => -1]);
        $mapping = [3575=>3893,5511=>3893,3576=>5227,5512=>5227,5513=>5227,5504=>3646];
        foreach (array_merge($orders, $email_orders) as $order) {
            if ((int) $order->get_id() === (int) $ignore_order) { continue; }
            if (!$order->get_date_paid() || (float) $order->get_total() - (float) $order->get_total_refunded() <= 0) { continue; }
            foreach ($order->get_items() as $item) {
                $course = $mapping[(int) $item->get_product_id()] ?? 0;
                if ($course && in_array($course, $active, true)) { return true; }
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
            && (int) ($entry['coupon_id'] ?? 0) === (int) $coupon->get_id()
            && ($billing_email === null || strtolower(trim($billing_email)) === $email);
        return [
            'enabled' => self::enabled_for($entry, $coupon),
            'integration_ready' => self::$seam_ready,
            'authenticated' => $user_id > 0,
            'identity_matches' => $identity_matches,
            'source_audience' => ($entry['source_audience'] ?? false) === true,
            'founder_approved' => ($entry['founder_approved'] ?? false) === true,
            'not_suppressed' => !self::suppressed($email),
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
            $order->update_meta_data('_mr_drj_bound_email_sha256', $coupon->get_meta('_mr_drj_email_sha256', true));
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
            || $order->get_meta('_mr_drj_bound_email_sha256', true) !== hash('sha256', strtolower(trim($user->user_email)))
            || !hash_equals((string) ($entry['email_sha256'] ?? ''), hash('sha256', strtolower(trim($user->user_email))))
            || empty($entry['founder_approved']) || empty($entry['source_audience'])
            || self::suppressed($user->user_email)
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

/** Invitation-only identity preparation. Never creates an order or grants access. */
final class MissionMed_MR_DrJ_Invitation {
    const COOKIE = 'mr_drj_invitation';
    const PREFIX = '_mr_drj_proof_';

    public static function url() { return add_query_arg('mr_drj_invitation', '1', home_url('/')); }

    private static function session() {
        $value = isset($_COOKIE[self::COOKIE]) ? (string) $_COOKIE[self::COOKIE] : '';
        if (!preg_match('/^[a-f0-9]{64}$/D', $value)) {
            $value = bin2hex(random_bytes(32));
            setcookie(self::COOKIE, $value, ['expires'=>time()+1800,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
        }
        return hash('sha256', $value);
    }

    private static function admission($coupon, $email) {
        $class = 'MissionMed_MR_DrJ_Private_Offer';
        $entry = $class::entry_for_email($email);
        if (!$class::private_coupon($coupon) || time() >= $class::EXPIRY
            || !$class::enabled_for($entry, $coupon) || empty($entry['source_audience']) || empty($entry['founder_approved'])
            || (int) ($entry['coupon_id'] ?? 0) !== (int) $coupon->get_id()
            || (int) ($entry['valid_until'] ?? 0) !== $class::EXPIRY
            || !hash_equals((string) $coupon->get_meta('_mr_drj_email_sha256', true), hash('sha256', $email))
            || $class::suppressed($email) || $coupon->get_usage_count() !== 0
            || $coupon->get_usage_limit() !== 1 || $coupon->get_usage_limit_per_user() !== 1
            || !$coupon->get_individual_use() || $coupon->get_product_ids() !== [5865]
            || $coupon->get_discount_type() !== 'fixed_product' || (float) $coupon->get_amount() !== 1000.0
            || !$coupon->get_date_expires() || $coupon->get_date_expires()->getTimestamp() !== $class::EXPIRY
            || array_map('strtolower', $coupon->get_email_restrictions()) !== [$email]) {
            throw new Exception('This invitation is not available. Please check your invited email and personal code, or reply to MissionMed.');
        }
        $user = get_user_by('email', $email);
        if ($user && $class::existing_program($user->ID, $email)) {
            throw new Exception('Your account already has a paid enrollment in this training. Please contact MissionMed with questions.');
        }
        return $entry;
    }

    private static function mail_proof($email, $proof) {
        if (!function_exists('missionaccounts_send_email')
            || !function_exists('missionmed_protected_mail_restore_transport')
            || !empty($GLOBALS['missionmed_protected_mail_in_flight'])) { return false; }
        $subject = 'Confirm your MissionMed private invitation';
        $body = '<div style="font:17px/1.6 Arial,sans-serif;color:#142434"><p>Use this confirmation code to continue your personal MissionMed invitation:</p><p style="font-size:24px;font-weight:bold">'.esc_html($proof).'</p><p>It expires in 15 minutes. Do not share this code. Confirming your email does not enroll you or submit a payment.</p><p>If you did not request this, you can ignore this email.</p></div>';
        $snapshot = [];
        foreach (['missionaccounts_smtp_active','missionmed_system_smtp_active',
            'missionmed_protected_mail_in_flight','missionmed_protected_mail_transport_preimage'] as $key) {
            $snapshot[$key] = ['exists'=>array_key_exists($key, $GLOBALS),'value'=>$GLOBALS[$key] ?? null];
        }
        $name = static function ($m) use ($email, $subject, $body) {
            if (empty($GLOBALS['missionaccounts_smtp_active']) || $m->Subject !== $subject || $m->Body !== $body
                || array_column($m->getToAddresses(), 0) !== [$email] || $m->getCcAddresses() || $m->getBccAddresses()
                || $m->Mailer !== 'smtp' || $m->Host !== 'smtp.gmail.com' || (int) $m->Port !== 587
                || $m->SMTPSecure !== 'tls' || !$m->SMTPAuth || strtolower($m->Username) !== 'info@missionmedinstitute.com'
                || strtolower($m->From) !== 'info@missionmedinstitute.com') { throw new Exception('Private invitation mail transport unavailable.'); }
            $m->FromName = 'Michelle de la Cruz';
        };
        add_action('phpmailer_init', $name, PHP_INT_MAX);
        try {
            return (bool) missionaccounts_send_email($email, $subject, $body, ['Content-Type: text/html; charset=UTF-8','Reply-To: Michelle de la Cruz <info@missionmedinstitute.com>']);
        } finally {
            remove_action('phpmailer_init', $name, PHP_INT_MAX);
            // The envelope guard may throw outside PHPMailer's own exception
            // type. Restore this owned transport even when wp_mail's normal
            // succeeded/failed hooks were never reached. Nested sends were
            // rejected above; never clear another caller's protected state.
            if (!empty($GLOBALS['missionmed_protected_mail_in_flight'])) {
                missionmed_protected_mail_restore_transport();
            }
            foreach ($snapshot as $key=>$state) {
                if ($state['exists']) { $GLOBALS[$key] = $state['value']; } else { unset($GLOBALS[$key]); }
            }
        }
    }

    private static function claim($state) {
        $coupon = new WC_Coupon((int) $state['coupon_id']);
        $email = strtolower((string) ($coupon->get_email_restrictions()[0] ?? ''));
        self::admission($coupon, $email);
        $user = wp_get_current_user();
        if (!$user->ID || strtolower(trim($user->user_email)) !== $email) {
            throw new Exception('Please sign in to the account using your invited email before continuing.');
        }
        $lock = '_mr_drj_claim_'.(int) $coupon->get_id();
        if (!add_option($lock, time(), '', false)) { throw new Exception('Your invitation is being prepared. Please try again in a moment.'); }
        try {
            $coupon = new WC_Coupon($coupon->get_id());
            self::admission($coupon, $email);
            $bound = (int) $coupon->get_meta('_mr_drj_user_id', true);
            if ($bound && $bound !== (int) $user->ID) { throw new Exception('This personal invitation belongs to another account.'); }
            if (!$bound) {
                if (empty($state['email_verified'])) { throw new Exception('Please confirm your invited email first.'); }
                $coupon->update_meta_data('_mr_drj_user_id', (int) $user->ID);
                $coupon->update_meta_data('_mr_drj_email_verified_at', time());
                $coupon->save();
            }
            if (!WC()->cart) { wc_load_cart(); }
            foreach (WC()->cart->get_cart() as $item) {
                if ((int) $item['product_id'] !== 3576 || (int) $item['variation_id'] !== 5865 || (int) $item['quantity'] !== 1) {
                    throw new Exception('Please remove other programs from your cart before using your Complete invitation.');
                }
            }
            if (WC()->cart->is_empty() && !WC()->cart->add_to_cart(3576, 1, 5865)) { throw new Exception('Complete enrollment is not currently available.'); }
            if (WC()->cart->get_applied_coupons() && WC()->cart->get_applied_coupons() !== [$coupon->get_code()]) {
                throw new Exception('Remove other codes before using your private invitation.');
            }
            if (!WC()->cart->has_discount($coupon->get_code()) && !WC()->cart->apply_coupon($coupon->get_code())) { throw new Exception('Please check your invitation at checkout.'); }
            WC()->cart->calculate_totals();
            if ((float) WC()->cart->get_total('edit') !== 2499.0) { throw new Exception('Please contact MissionMed before paying; the invitation total needs review.'); }
        } finally { delete_option($lock); }
        wp_safe_redirect(wc_get_checkout_url());
        exit;
    }

    public static function route() {
        if (!isset($_GET['mr_drj_invitation']) || (string) $_GET['mr_drj_invitation'] !== '1') { return; }
        if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET','POST'], true)) { status_header(405); exit; }
        nocache_headers();
        header('Cache-Control: private, no-store, max-age=0');
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
        header('X-Robots-Tag: noindex, nofollow');
        $session = self::session();
        $key = self::PREFIX.$session;
        $state = get_option($key, []);
        if (!is_array($state) || (int) ($state['expires'] ?? 0) <= time()) { $state = []; delete_option($key); }
        $message = ''; $error = ''; $login = false;
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            try {
                if (!isset($_POST['_wpnonce'], $_POST['csrf']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_wpnonce'])), 'mr_drj_invitation')
                    || !hash_equals(wp_hash($session), (string) wp_unslash($_POST['csrf']))) { throw new Exception('Please refresh this page before continuing.'); }
                $action = sanitize_key($_POST['invitation_action'] ?? '');
                if ($action === 'request') {
                    $email = strtolower(trim(sanitize_email(wp_unslash($_POST['invited_email'] ?? ''))));
                    $coupon = new WC_Coupon(sanitize_text_field(wp_unslash($_POST['personal_code'] ?? '')));
                    self::admission($coupon, $email);
                    $user = get_user_by('email', $email);
                    $bound = (int) $coupon->get_meta('_mr_drj_user_id', true);
                    $state = ['coupon_id'=>$coupon->get_id(),'expires'=>time()+900,'attempts'=>0,'phase'=>$bound?'login':'verify','email_verified'=>false];
                    if ($user && get_current_user_id() === (int) $user->ID) {
                        // Existing bound invited account: native authenticated login is proof.
                        if ((int) $coupon->get_meta('_mr_drj_user_id', true) === (int) $user->ID) { self::claim($state); }
                    }
                    if ($user && $bound) { update_option($key, $state, false); $login = true; }
                    else {
                        $rate_key = '_mr_drj_rate_'.hash('sha256', $email);
                        $rate = get_option($rate_key, ['until'=>0,'count'=>0]);
                        if ((int) $rate['until'] <= time()) { $rate = ['until'=>time()+3600,'count'=>0]; }
                        if ((int) $rate['count'] >= 5) { throw new Exception('Please wait before requesting another email, or reply to MissionMed.'); }
                        $rate['count']++; update_option($rate_key, $rate, false);
                        $proof = strtoupper(bin2hex(random_bytes(6)));
                        $state['proof_hash'] = wp_hash($proof);
                        update_option($key, $state, false);
                        if (!self::mail_proof($email, $proof)) { delete_option($key); $state=[]; throw new Exception('We could not send the confirmation email. Please reply to MissionMed for help.'); }
                        $message = 'Check your invited email for a confirmation code. It expires in 15 minutes.';
                    }
                } elseif ($action === 'verify' && ($state['phase'] ?? '') === 'verify') {
                    $state['attempts'] = (int) $state['attempts']+1;
                    update_option($key, $state, false);
                    if ($state['attempts'] > 5) { delete_option($key); $state=[]; throw new Exception('Please request a new confirmation code.'); }
                    $proof = strtoupper(trim(sanitize_text_field(wp_unslash($_POST['confirmation_code'] ?? ''))));
                    if (!preg_match('/^[A-F0-9]{12}$/D', $proof) || !hash_equals($state['proof_hash'], wp_hash($proof))) { throw new Exception('The confirmation code does not match. Please check your email.'); }
                    $state['email_verified'] = true;
                    unset($state['proof_hash']);
                    $state['phase'] = 'login'; update_option($key, $state, false);
                    $coupon = new WC_Coupon((int) $state['coupon_id']);
                    $email = strtolower((string) ($coupon->get_email_restrictions()[0] ?? ''));
                    self::admission($coupon, $email);
                    $user = get_user_by('email', $email);
                    if (!$user) {
                        // Native Woo customer creation only AFTER invited-email ownership proof.
                        $id = wc_create_new_customer($email);
                        if (is_wp_error($id)) { throw new Exception('Please sign in to your invited account or reply to MissionMed.'); }
                        wp_set_current_user($id); wc_set_customer_auth_cookie($id);
                        self::claim($state);
                    } else { $login = true; }
                } elseif ($action === 'continue' && ($state['phase'] ?? '') === 'login') { self::claim($state); }
                else { throw new Exception('Please begin with your invited email and personal code.'); }
            } catch (Throwable $e) { $error = $e->getMessage(); }
        }
        $login = $login || (($state['phase'] ?? '') === 'login' && !is_user_logged_in());
        echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your MissionMed invitation</title><style>body{margin:0;background:#f5f6f7;color:#142434;font:18px/1.6 system-ui,sans-serif}main{max-width:590px;margin:7vh auto;padding:32px;background:white;border:1px solid #c8d0d5}h1{font-size:30px;line-height:1.2}label{display:block;font-weight:650;margin-top:18px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:13px;margin-top:6px}input{color:#142434;background:#fff;border:1px solid #647685}button{background:#142434;color:#fff;border:0;margin-top:24px;cursor:pointer}a{color:#164d7c}a:focus-visible,input:focus-visible,button:focus-visible{outline:3px solid #a32c24;outline-offset:3px}.error{color:#8c221b}.note{font-size:16px}@media(max-width:650px){main{margin:20px 12px;padding:24px}}</style><main><p>MISSIONMED INSTITUTE</p><h1>Your personal Complete invitation</h1><p>Use the email address and personal code from your invitation. New to MissionMed? We will help you create your account securely.</p>';
        if ($error) { echo '<p class="error" role="alert">'.esc_html($error).'</p>'; }
        if ($message) { echo '<p role="status">'.esc_html($message).'</p>'; }
        if ($login) { echo '<p><a href="'.esc_url(wp_login_url(self::url())).'">Sign in to your invited MissionMed account</a>, then return here to continue.</p>'; }
        echo '<form method="post" action="'.esc_url(self::url()).'">';
        wp_nonce_field('mr_drj_invitation');
        echo '<input type="hidden" name="csrf" value="'.esc_attr(wp_hash($session)).'">';
        if (($state['phase'] ?? '') === 'verify') {
            echo '<input type="hidden" name="invitation_action" value="verify"><label for="confirmation_code">Email confirmation code</label><input id="confirmation_code" name="confirmation_code" autocomplete="one-time-code" maxlength="12" required><button>Confirm email &amp; continue</button>';
        } elseif (($state['phase'] ?? '') === 'login' && is_user_logged_in()) {
            echo '<input type="hidden" name="invitation_action" value="continue"><button>Continue to Complete checkout</button>';
        } elseif (!$login) {
            echo '<input type="hidden" name="invitation_action" value="request"><label for="invited_email">Your invited email</label><input type="email" id="invited_email" name="invited_email" autocomplete="email" required><label for="personal_code">Your personal enrollment code</label><input id="personal_code" name="personal_code" autocomplete="off" required><button>Continue with my invitation</button>';
        }
        echo '</form><p class="note">No payment is submitted here. Your program access begins only after payment is confirmed.</p><p><a href="'.esc_url(home_url('/missionresidency/')).'">Back to program details</a></p></main></html>';
        exit;
    }
}

add_action('template_redirect', ['MissionMed_MR_DrJ_Invitation','route'], -10);
add_action('init', ['MissionMed_MR_DrJ_Private_Offer','integrate_checkout'], 1000);
add_action('wp_head', ['MissionMed_MR_DrJ_Private_Offer','checkout_layout'], 50);
add_filter('woocommerce_available_payment_gateways', ['MissionMed_MR_DrJ_Private_Offer','capture_gateways'], 998);
add_filter('woocommerce_available_payment_gateways', ['MissionMed_MR_DrJ_Private_Offer','invitation_gateways'], 1000);
add_filter('woocommerce_coupon_is_valid', ['MissionMed_MR_DrJ_Private_Offer','validate_coupon'], 1000, 3);
add_action('woocommerce_before_calculate_totals', ['MissionMed_MR_DrJ_Private_Offer','normalise_cart'], 1000);
add_action('woocommerce_after_checkout_validation', ['MissionMed_MR_DrJ_Private_Offer','checkout_validation'], 1000, 2);
add_action('woocommerce_checkout_create_order', ['MissionMed_MR_DrJ_Private_Offer','create_order'], 1000, 2);
add_action('woocommerce_before_pay_action', ['MissionMed_MR_DrJ_Private_Offer','pay_existing_order'], 1000);
add_action('woocommerce_store_api_checkout_update_order_from_request', ['MissionMed_MR_DrJ_Private_Offer','block_store_api'], 1000, 2);
