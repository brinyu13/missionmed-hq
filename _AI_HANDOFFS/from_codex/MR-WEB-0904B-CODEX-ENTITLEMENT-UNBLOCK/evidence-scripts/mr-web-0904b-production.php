<?php
/**
 * MR-WEB-0904B bounded production state controller.
 *
 * Stream over authenticated SSH with MR0904B_MODE=snapshot|apply|verify|rollback.
 * Outputs only product/configuration identities and never customer data or secrets.
 */
declare(strict_types=1);

const MR0904B_ROOT = '/www/theresidencyacademy_209/public';
const MR0904B_STATE_DIR = '/www/theresidencyacademy_209/private/mr-web-0904b';
const MR0904B_STATE_FILE = MR0904B_STATE_DIR . '/preimage.json';

require MR0904B_ROOT . '/wp-load.php';

if (!function_exists('wc_get_product')) {
    throw new RuntimeException('WooCommerce unavailable');
}

function mr0904b_product_state(int $id): array {
    $product = wc_get_product($id);
    if (!$product) throw new RuntimeException("missing product {$id}");
    return [
        'id' => $id,
        'type' => $product->get_type(),
        'parent_id' => (int) $product->get_parent_id(),
        'name' => $product->get_name('edit'),
        'status' => $product->get_status('edit'),
        'catalog_visibility' => $product->get_catalog_visibility('edit'),
        'regular_price' => (string) $product->get_regular_price('edit'),
        'sale_price' => (string) $product->get_sale_price('edit'),
        'price' => (string) $product->get_price('edit'),
        'stock_status' => $product->get_stock_status('edit'),
        'manage_stock' => (bool) $product->get_manage_stock('edit'),
        'stock_quantity' => $product->get_stock_quantity('edit'),
        'backorders' => $product->get_backorders('edit'),
        'sold_individually' => (bool) $product->get_sold_individually('edit'),
        'related_course' => array_values(array_filter(array_map('intval', (array) get_post_meta($id, '_related_course', true)))),
    ];
}

function mr0904b_stripe_gateway() {
    $gateways = WC()->payment_gateways()->payment_gateways();
    $gateway = $gateways['stripe'] ?? null;
    if (!$gateway || !method_exists($gateway, 'get_upe_enabled_payment_method_ids')) {
        throw new RuntimeException('Stripe gateway unavailable');
    }
    return $gateway;
}

function mr0904b_snippet_active(int $id): bool {
    global $wpdb;
    return (bool) $wpdb->get_var($wpdb->prepare("SELECT active FROM {$wpdb->prefix}snippets WHERE id = %d", $id));
}

function mr0904b_capture(): array {
    $productIds = [3575,3576,3577,5504,5511,5512,5513,5862,5863,5864,5865,5866,5867,5868,5869,5870,5871,5872,5873,6319];
    $products = [];
    foreach ($productIds as $id) $products[(string) $id] = mr0904b_product_state($id);
    $courseSettings = [];
    foreach ([3893,5227,3646] as $id) $courseSettings[(string) $id] = get_post_meta($id, '_sfwd-courses', true);
    $options = [];
    foreach (['woocommerce_enable_guest_checkout','woocommerce_enable_checkout_login_reminder','woocommerce_enable_signup_and_login_from_checkout','woocommerce_registration_generate_username','woocommerce_registration_generate_password','woocommerce_bacs_settings'] as $key) {
        $options[$key] = get_option($key, null);
    }
    $snippets = [];
    foreach ([56,71,72,73,74] as $id) $snippets[(string) $id] = mr0904b_snippet_active($id);
    $coupons = [];
    foreach ([6409,6546] as $id) $coupons[(string) $id] = get_post_status($id);
    return [
        'schema' => 'missionmed.mr_web_0904b.production_preimage.v1',
        'captured_at_utc' => gmdate('c'),
        'products' => $products,
        'course_settings' => $courseSettings,
        'options' => $options,
        'snippets' => $snippets,
        'coupons' => $coupons,
        'stripe_enabled_methods' => array_values(mr0904b_stripe_gateway()->get_upe_enabled_payment_method_ids()),
    ];
}

function mr0904b_write_preimage(array $state): void {
    if (file_exists(MR0904B_STATE_FILE)) throw new RuntimeException('preimage already exists; refusing overwrite');
    if (!is_dir(MR0904B_STATE_DIR) && !wp_mkdir_p(MR0904B_STATE_DIR)) throw new RuntimeException('cannot create private state directory');
    $json = wp_json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || file_put_contents(MR0904B_STATE_FILE, $json . "\n", LOCK_EX) === false) throw new RuntimeException('cannot write preimage');
    chmod(MR0904B_STATE_DIR, 0700);
    chmod(MR0904B_STATE_FILE, 0600);
}

function mr0904b_read_preimage(): array {
    $value = json_decode((string) file_get_contents(MR0904B_STATE_FILE), true);
    if (!is_array($value) || ($value['schema'] ?? '') !== 'missionmed.mr_web_0904b.production_preimage.v1') throw new RuntimeException('invalid preimage');
    return $value;
}

function mr0904b_set_product(int $id, array $fields): void {
    $product = wc_get_product($id);
    if (!$product) throw new RuntimeException("missing product {$id}");
    foreach ($fields as $field => $value) {
        $method = 'set_' . $field;
        if (!method_exists($product, $method)) throw new RuntimeException("unsupported product field {$field}");
        $product->{$method}($value);
    }
    $product->save();
    clean_post_cache($id);
    wc_delete_product_transients($id);
}

function mr0904b_set_snippet(int $id, bool $active): void {
    $fn = $active ? 'Code_Snippets\\activate_snippet' : 'Code_Snippets\\deactivate_snippet';
    if (!function_exists($fn)) throw new RuntimeException('Code Snippets API unavailable');
    $result = $fn($id);
    if (!$result && mr0904b_snippet_active($id) !== $active) throw new RuntimeException("snippet {$id} transition failed");
}

function mr0904b_restore(array $state): void {
    foreach ($state['products'] as $id => $prior) {
        mr0904b_set_product((int) $id, [
            'name' => $prior['name'],
            'status' => $prior['status'],
            'catalog_visibility' => $prior['catalog_visibility'],
            'regular_price' => $prior['regular_price'],
            'sale_price' => $prior['sale_price'],
            'stock_status' => $prior['stock_status'],
            'manage_stock' => $prior['manage_stock'],
            'stock_quantity' => $prior['stock_quantity'],
            'backorders' => $prior['backorders'],
            'sold_individually' => $prior['sold_individually'],
        ]);
        if (!empty($prior['related_course'])) update_post_meta((int) $id, '_related_course', array_values(array_map('intval', $prior['related_course'])));
        else delete_post_meta((int) $id, '_related_course');
    }
    foreach ($state['course_settings'] as $id => $settings) update_post_meta((int) $id, '_sfwd-courses', $settings);
    foreach ($state['options'] as $key => $value) update_option($key, $value);
    foreach ($state['snippets'] as $id => $active) mr0904b_set_snippet((int) $id, (bool) $active);
    foreach ($state['coupons'] as $id => $status) wp_update_post(['ID' => (int) $id, 'post_status' => $status]);
    mr0904b_stripe_gateway()->update_enabled_payment_methods(array_values($state['stripe_enabled_methods']));
    foreach ([3575,3576,5504,5511,5512,5513] as $parentId) WC_Product_Variable::sync($parentId);
}

function mr0904b_apply(): void {
    $before = mr0904b_capture();
    $expected = [
        3575 => ['name' => '360 Match Mentorship', 'status' => 'publish'],
        3576 => ['name' => 'Match Prep Pro', 'status' => 'publish'],
        5504 => ['name' => 'IV Prep Complete Masterclass', 'status' => 'publish'],
    ];
    foreach ($expected as $id => $check) {
        $actual = $before['products'][(string) $id];
        if ($actual['name'] !== $check['name'] || $actual['status'] !== $check['status']) throw new RuntimeException("precondition drift on product {$id}");
    }
    if ($before['products']['5865']['price'] !== '2799' || $before['products']['5867']['price'] !== '1499') throw new RuntimeException('precondition price drift');
    if (array_values($before['stripe_enabled_methods']) !== ['affirm','card','klarna']) throw new RuntimeException('precondition Stripe method drift');
    mr0904b_write_preimage($before);

    try {
        mr0904b_set_product(3576, ['name' => 'IV Prep Complete', 'status' => 'publish', 'catalog_visibility' => 'visible', 'stock_status' => 'instock']);
        mr0904b_set_product(5864, ['status' => 'draft', 'stock_status' => 'outofstock']);
        mr0904b_set_product(5865, ['status' => 'publish', 'regular_price' => '2799', 'sale_price' => '', 'stock_status' => 'instock']);

        mr0904b_set_product(5504, ['name' => 'IV Prep Essentials', 'status' => 'publish', 'catalog_visibility' => 'visible', 'stock_status' => 'instock']);
        mr0904b_set_product(5866, ['status' => 'draft', 'stock_status' => 'outofstock']);
        mr0904b_set_product(5867, ['status' => 'publish', 'regular_price' => '1199', 'sale_price' => '', 'stock_status' => 'instock']);

        mr0904b_set_product(3575, ['name' => '360 Match Mentorship', 'status' => 'publish', 'catalog_visibility' => 'visible', 'stock_status' => 'outofstock']);
        foreach ([5862,5863] as $id) mr0904b_set_product($id, ['status' => 'publish', 'regular_price' => '5499', 'sale_price' => '', 'stock_status' => 'outofstock']);

        mr0904b_set_product(3577, ['status' => 'draft', 'catalog_visibility' => 'hidden', 'stock_status' => 'outofstock']);
        foreach ([5511,5512,5513] as $id) mr0904b_set_product($id, ['status' => 'draft', 'catalog_visibility' => 'hidden', 'stock_status' => 'outofstock']);
        foreach ([5868,5869,5870,5871,5872,5873] as $id) mr0904b_set_product($id, ['status' => 'draft', 'stock_status' => 'outofstock']);
        mr0904b_set_product(6319, ['status' => 'draft', 'catalog_visibility' => 'hidden', 'stock_status' => 'outofstock']);

        $mapping = [
            3575 => 3893, 5862 => 3893, 5863 => 3893, 5511 => 3893, 5868 => 3893, 5869 => 3893,
            3576 => 5227, 5864 => 5227, 5865 => 5227, 5512 => 5227, 5870 => 5227, 5871 => 5227,
            5504 => 3646, 5866 => 3646, 5867 => 3646, 3577 => 3646, 5513 => 3646, 5872 => 3646, 5873 => 3646,
        ];
        foreach ($mapping as $productId => $courseId) update_post_meta($productId, '_related_course', [$courseId]);

        $completeCourse = get_post_meta(5227, '_sfwd-courses', true);
        if (!is_array($completeCourse)) throw new RuntimeException('Complete course settings unavailable');
        $completeCourse['sfwd-courses_course_price_type'] = 'closed';
        update_post_meta(5227, '_sfwd-courses', $completeCourse);

        update_option('woocommerce_enable_guest_checkout', 'no');
        update_option('woocommerce_enable_checkout_login_reminder', 'yes');
        update_option('woocommerce_enable_signup_and_login_from_checkout', 'yes');
        update_option('woocommerce_registration_generate_username', 'yes');
        update_option('woocommerce_registration_generate_password', 'no');

        $bacs = (array) get_option('woocommerce_bacs_settings', []);
        $bacs['enabled'] = 'no';
        update_option('woocommerce_bacs_settings', $bacs);

        foreach ([56,71,72,73,74] as $id) mr0904b_set_snippet($id, false);
        foreach ([6409,6546] as $id) wp_update_post(['ID' => $id, 'post_status' => 'draft']);
        mr0904b_stripe_gateway()->update_enabled_payment_methods(['card']);

        foreach ([3575,3576,5504,5511,5512,5513] as $parentId) WC_Product_Variable::sync($parentId);
        $verification = mr0904b_verify();
        if ($verification['result'] !== 'PASS') throw new RuntimeException('post-write verification failed: ' . implode(',', $verification['failed']));
    } catch (Throwable $error) {
        mr0904b_restore($before);
        throw new RuntimeException('apply failed and rollback was attempted: ' . $error->getMessage(), 0, $error);
    }
}

function mr0904b_sellable(int $id): bool {
    $product = wc_get_product($id);
    return $product && $product->is_purchasable() && $product->is_in_stock();
}

function mr0904b_verify(): array {
    foreach ([3575,3576,5504,5511,5512,5513] as $parentId) {
        wc_delete_product_transients($parentId);
        clean_post_cache($parentId);
    }
    $checks = [
        'complete_identity' => mr0904b_product_state(3576)['name'] === 'IV Prep Complete',
        'complete_active_variation' => mr0904b_product_state(5865)['price'] === '2799' && mr0904b_sellable(5865),
        'complete_past_variation_closed' => !mr0904b_sellable(5864),
        'complete_mapping' => mr0904b_product_state(5865)['related_course'] === [5227],
        'essentials_identity' => mr0904b_product_state(5504)['name'] === 'IV Prep Essentials',
        'essentials_active_variation' => mr0904b_product_state(5867)['price'] === '1199' && mr0904b_sellable(5867),
        'essentials_past_variation_closed' => !mr0904b_sellable(5866),
        'essentials_mapping' => mr0904b_product_state(5867)['related_course'] === [3646],
        'complete_course_closed' => (get_post_meta(5227, '_sfwd-courses', true)['sfwd-courses_course_price_type'] ?? '') === 'closed',
        'guest_checkout_disabled' => get_option('woocommerce_enable_guest_checkout') === 'no',
        'account_creation_enabled' => get_option('woocommerce_enable_signup_and_login_from_checkout') === 'yes',
        'bacs_disabled' => ((array) get_option('woocommerce_bacs_settings', []))['enabled'] === 'no',
        'stripe_card_only' => array_values(mr0904b_stripe_gateway()->get_upe_enabled_payment_method_ids()) === ['card'],
        'surcharge_and_legacy_checkout_snippets_disabled' => count(array_filter([56,71,72,73,74], 'mr0904b_snippet_active')) === 0,
        'legacy_coupons_disabled' => get_post_status(6409) === 'draft' && get_post_status(6546) === 'draft',
        '360_closed' => !mr0904b_sellable(3575) && !mr0904b_sellable(5862) && !mr0904b_sellable(5863),
        'legacy_plans_closed' => !mr0904b_sellable(5511) && !mr0904b_sellable(5512) && !mr0904b_sellable(5513),
        'legacy_variations_closed' => count(array_filter([5868,5869,5870,5871,5872,5873], 'mr0904b_sellable')) === 0,
        'standalone_foundation_closed' => !mr0904b_sellable(3577),
        'one_dollar_test_closed' => !mr0904b_sellable(6319),
    ];
    $failed = array_keys(array_filter($checks, static fn($value) => $value !== true));
    return [
        'schema' => 'missionmed.mr_web_0904b.production_state_verification.v1',
        'checked_at_utc' => gmdate('c'),
        'checks' => $checks,
        'passed' => count($checks) - count($failed),
        'total' => count($checks),
        'result' => $failed ? 'FAIL' : 'PASS',
        'failed' => $failed,
        'safe_readback' => [
            'complete' => ['product_id' => 3576, 'variation_id' => 5865, 'course_id' => 5227, 'price' => mr0904b_product_state(5865)['price']],
            'essentials' => ['product_id' => 5504, 'variation_id' => 5867, 'course_id' => 3646, 'price' => mr0904b_product_state(5867)['price']],
            'stripe_methods' => array_values(mr0904b_stripe_gateway()->get_upe_enabled_payment_method_ids()),
        ],
    ];
}

$mode = getenv('MR0904B_MODE') ?: 'verify';
try {
    if ($mode === 'snapshot') {
        $out = mr0904b_capture();
        unset($out['course_settings'], $out['options']['woocommerce_bacs_settings']);
    } elseif ($mode === 'apply') {
        mr0904b_apply();
        $out = mr0904b_verify();
    } elseif ($mode === 'rollback') {
        mr0904b_restore(mr0904b_read_preimage());
        $out = ['schema' => 'missionmed.mr_web_0904b.rollback.v1', 'result' => 'PASS', 'restored_at_utc' => gmdate('c')];
    } elseif ($mode === 'verify') {
        $out = mr0904b_verify();
    } else {
        throw new RuntimeException('invalid mode');
    }
    echo wp_json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
} catch (Throwable $error) {
    fwrite(STDERR, wp_json_encode(['result' => 'FAIL', 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES) . "\n");
    exit(1);
}
