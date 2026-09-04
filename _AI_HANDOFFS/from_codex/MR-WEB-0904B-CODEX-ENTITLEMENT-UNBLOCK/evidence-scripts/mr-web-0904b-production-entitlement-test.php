<?php
/** MR-WEB-0904B controlled production integration test. No payment is processed. */
declare(strict_types=1);
require '/www/theresidencyacademy_209/public/wp-load.php';

foreach (['new_order','customer_processing_order','customer_completed_order','customer_refunded_order','customer_on_hold_order','customer_invoice','customer_note','customer_new_account'] as $emailId) {
    add_filter('woocommerce_email_enabled_' . $emailId, '__return_false', 999);
}

function mr0904b_access(int $userId, int $courseId): bool {
    return function_exists('sfwd_lms_has_access') && (bool) sfwd_lms_has_access($courseId, $userId);
}

function mr0904b_counter(int $userId, int $courseId): array {
    $counter = get_user_meta($userId, '_learndash_woocommerce_enrolled_courses_access_counter', true);
    $counter = is_array($counter) ? $counter : [];
    return array_values(array_map('intval', (array) ($counter[$courseId] ?? [])));
}

function mr0904b_create_order(int $userId, int $productId, int $variationId, string $program, string $purpose): WC_Order {
    $order = wc_create_order(['customer_id' => $userId, 'created_via' => 'mr-web-0904b-controlled-test']);
    if (is_wp_error($order)) throw new RuntimeException('test order creation failed');
    $variation = wc_get_product($variationId);
    if (!$variation || (int) $variation->get_parent_id() !== $productId) throw new RuntimeException('test variation identity mismatch');
    $order->add_product($variation, 1);
    $order->set_payment_method('mr_web_0904b_no_charge');
    $order->set_payment_method_title('MR-WEB-0904B controlled entitlement test — no charge');
    $order->add_meta_data('_mr_web_0904b_controlled_test', 'yes', true);
    $order->add_meta_data('_mr_web_0904b_program', $program, true);
    $order->add_meta_data('_mr_web_0904b_purpose', $purpose, true);
    $order->calculate_totals();
    $order->save();
    return $order;
}

function mr0904b_test_program(string $key, int $productId, int $variationId, int $courseId, int $unrelatedCourseId, string $expectedTotal, string $terminalStatus): array {
    $suffix = strtolower(wp_generate_password(12, false, false));
    $login = 'mr0904b_' . $key . '_' . $suffix;
    $password = wp_generate_password(32, true, true);
    $userId = wp_insert_user([
        'user_login' => $login,
        'user_pass' => $password,
        'user_email' => $login . '@example.invalid',
        'display_name' => 'MR0904B Controlled Test ' . ucfirst($key),
        'role' => 'subscriber',
    ]);
    if (is_wp_error($userId)) throw new RuntimeException('test user creation failed: ' . $userId->get_error_code());

    $order = mr0904b_create_order((int) $userId, $productId, $variationId, $key, 'primary');
    $orderId = (int) $order->get_id();

    $item = current($order->get_items());
    $identityPass = $item && (int) $item->get_product_id() === $productId && (int) $item->get_variation_id() === $variationId;
    $pricePass = abs((float) $order->get_total() - (float) $expectedTotal) < 0.001;

    $order->update_status('processing', 'MR-WEB-0904B controlled entitlement grant; no payment processed.', true);
    clean_user_cache($userId);
    $grantPass = mr0904b_access((int) $userId, $courseId);
    $unrelatedExcluded = !mr0904b_access((int) $userId, $unrelatedCourseId);
    $surface = get_permalink($courseId);
    wp_set_current_user((int) $userId);
    $surfacePass = is_string($surface) && str_starts_with($surface, 'https://missionmedinstitute.com/') && mr0904b_access((int) $userId, $courseId);
    $auth = wp_authenticate_username_password(null, $login, $password);
    $loginPass = $auth instanceof WP_User && (int) $auth->ID === (int) $userId;

    Learndash_WooCommerce::add_course_access($orderId);
    $duplicateIdempotent = mr0904b_counter((int) $userId, $courseId) === [$orderId];

    if ($terminalStatus === 'refunded') {
        $lineItems = [];
        foreach ($order->get_items() as $itemId => $orderItem) {
            $lineItems[$itemId] = ['qty' => (int) $orderItem->get_quantity(), 'refund_total' => (float) $orderItem->get_total(), 'refund_tax' => []];
        }
        $refund = wc_create_refund([
            'amount' => (float) $order->get_total(),
            'reason' => 'MR-WEB-0904B controlled entitlement revocation test',
            'order_id' => $orderId,
            'line_items' => $lineItems,
            'refund_payment' => false,
            'restock_items' => false,
        ]);
        if (is_wp_error($refund)) throw new RuntimeException('controlled refund creation failed: ' . $refund->get_error_code());
        $order = wc_get_order($orderId);
    } else {
        $order->update_status('cancelled', 'MR-WEB-0904B controlled entitlement revocation test.', true);
    }
    clean_user_cache($userId);
    $revocationPass = !mr0904b_access((int) $userId, $courseId) && mr0904b_counter((int) $userId, $courseId) === [];

    $reorder = mr0904b_create_order((int) $userId, $productId, $variationId, $key, 'reorder');
    $reorderId = (int) $reorder->get_id();
    $reorder->update_status('processing', 'MR-WEB-0904B controlled reorder/idempotency restore.', true);
    Learndash_WooCommerce::add_course_access($reorderId);
    clean_user_cache($userId);
    $restorePass = mr0904b_access((int) $userId, $courseId) && mr0904b_counter((int) $userId, $courseId) === [$reorderId];
    $reorder->update_status('cancelled', 'MR-WEB-0904B controlled final reorder revocation.', true);
    clean_user_cache($userId);
    $finalRevocationPass = !mr0904b_access((int) $userId, $courseId) && mr0904b_counter((int) $userId, $courseId) === [];

    return [
        'program' => $key,
        'test_user_id' => (int) $userId,
        'test_order_id' => $orderId,
        'test_reorder_id' => $reorderId,
        'product_id' => $productId,
        'variation_id' => $variationId,
        'course_id' => $courseId,
        'final_order_status' => wc_get_order($orderId)->get_status(),
        'checks' => [
            'fresh_test_user' => (int) $userId > 0,
            'order_product_variation_identity' => $identityPass,
            'order_total_truth' => $pricePass,
            'processing_grants_expected_course' => $grantPass,
            'unrelated_course_excluded' => $unrelatedExcluded,
            'buyer_credentials_authenticate' => $loginPass,
            'entitled_course_surface_authorized' => $surfacePass,
            'duplicate_grant_idempotent' => $duplicateIdempotent,
            'refund_or_cancel_revokes' => $revocationPass,
            'reorder_restores_once' => $restorePass,
            'final_revocation_clean' => $finalRevocationPass,
        ],
    ];
}

try {
    $programs = [
        mr0904b_test_program('complete', 3576, 5865, 5227, 3646, '2799', 'refunded'),
        mr0904b_test_program('essentials', 5504, 5867, 3646, 5227, '1199', 'cancelled'),
    ];
    $checks = [];
    foreach ($programs as $program) foreach ($program['checks'] as $name => $pass) $checks[$program['program'] . '_' . $name] = $pass;
    $failed = array_keys(array_filter($checks, static fn($value) => $value !== true));
    echo wp_json_encode([
        'schema' => 'missionmed.mr_web_0904b.production_entitlement_test.v1',
        'tested_at_utc' => gmdate('c'),
        'payment_processed' => false,
        'programs' => $programs,
        'passed' => count($checks) - count($failed),
        'total' => count($checks),
        'result' => $failed ? 'FAIL' : 'PASS',
        'failed' => $failed,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    exit($failed ? 1 : 0);
} catch (Throwable $error) {
    fwrite(STDERR, wp_json_encode(['result' => 'FAIL', 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES) . "\n");
    exit(1);
}
