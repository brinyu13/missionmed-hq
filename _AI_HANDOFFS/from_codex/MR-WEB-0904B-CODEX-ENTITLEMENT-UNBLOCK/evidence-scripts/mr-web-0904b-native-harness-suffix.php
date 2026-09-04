<?php
function mr0904b_counter(int $user_id, int $course_id): array {
    $counter = $GLOBALS['mr0904b_user_meta'][$user_id]['_learndash_woocommerce_enrolled_courses_access_counter'] ?? [];
    return array_values($counter[$course_id] ?? []);
}

function mr0904b_has_access(int $user_id, int $course_id): bool {
    return !empty($GLOBALS['mr0904b_access'][$user_id][$course_id]);
}

$complete_item = new WC_Order_Item_Product(3576, 5865);
$essentials_item = new WC_Order_Item_Product(5504, 5867);
$GLOBALS['mr0904b_orders'][9001] = new WC_Order(9001, 101, [$complete_item]);
$GLOBALS['mr0904b_orders'][9002] = new WC_Order(9002, 102, [$essentials_item]);

Learndash_WooCommerce::add_course_access(9001);
$complete_grant_once = mr0904b_has_access(101, 5227);
Learndash_WooCommerce::add_course_access(9001);
$complete_duplicate_idempotent = mr0904b_counter(101, 5227) === [9001];
$complete_unrelated_excluded = !mr0904b_has_access(101, 3646);

Learndash_WooCommerce::add_course_access(9002);
$essentials_grant_once = mr0904b_has_access(102, 3646);
$essentials_unrelated_excluded = !mr0904b_has_access(102, 5227);

$registration_enabled = Learndash_WooCommerce::enable_registration(false);
$registration_required = Learndash_WooCommerce::require_registration(false);
$_POST = [];
Learndash_WooCommerce::force_registration_during_checkout();
$create_account_forced = isset($_POST['createaccount']) && (int) $_POST['createaccount'] === 1;

$GLOBALS['mr0904b_orders'][9001]->set_status('refunded');
$GLOBALS['mr0904b_orders'][9001]->set_refunds([new WC_Order_Refund([$complete_item])]);
Learndash_WooCommerce::remove_course_access_on_refund(9001, 9901);
$complete_refund_revoked = !mr0904b_has_access(101, 5227) && mr0904b_counter(101, 5227) === [];

$GLOBALS['mr0904b_orders'][9002]->set_status('cancelled');
Learndash_WooCommerce::remove_course_access(9002);
$essentials_cancel_revoked = !mr0904b_has_access(102, 3646) && mr0904b_counter(102, 3646) === [];

$GLOBALS['mr0904b_orders'][9003] = new WC_Order(9003, 101, [$complete_item]);
Learndash_WooCommerce::add_course_access(9001);
Learndash_WooCommerce::add_course_access(9003);
$reorder_counter_two_orders = mr0904b_counter(101, 5227) === [9001, 9003];
Learndash_WooCommerce::remove_course_access(9001);
$first_order_removed_second_preserves_access = mr0904b_has_access(101, 5227) && mr0904b_counter(101, 5227) === [9003];
Learndash_WooCommerce::remove_course_access(9003);
$last_order_removed_revokes_access = !mr0904b_has_access(101, 5227) && mr0904b_counter(101, 5227) === [];

$checks = [
    'complete_grant_once' => $complete_grant_once,
    'complete_duplicate_idempotent' => $complete_duplicate_idempotent,
    'complete_unrelated_excluded' => $complete_unrelated_excluded,
    'complete_refund_revoked' => $complete_refund_revoked,
    'essentials_grant_once' => $essentials_grant_once,
    'essentials_unrelated_excluded' => $essentials_unrelated_excluded,
    'essentials_cancel_revoked' => $essentials_cancel_revoked,
    'registration_enabled' => $registration_enabled,
    'registration_required' => $registration_required,
    'create_account_forced' => $create_account_forced,
    'reorder_counter_two_orders' => $reorder_counter_two_orders,
    'first_order_removed_second_preserves_access' => $first_order_removed_second_preserves_access,
    'last_order_removed_revokes_access' => $last_order_removed_revokes_access,
];

$failed = array_keys(array_filter($checks, static fn($value) => $value !== true));
echo json_encode([
    'schema' => 'missionmed.mr_web_0904b.native_learndash_woo_harness.v1',
    'source' => 'exact live LearnDash WooCommerce 2.0.2 class streamed over authenticated SSH',
    'checks' => $checks,
    'passed' => count($checks) - count($failed),
    'total' => count($checks),
    'result' => empty($failed) ? 'PASS' : 'FAIL',
    'failed' => $failed,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit(empty($failed) ? 0 : 1);
?>
