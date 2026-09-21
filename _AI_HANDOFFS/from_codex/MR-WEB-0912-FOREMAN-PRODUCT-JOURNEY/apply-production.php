<?php

if (!function_exists('wc_get_product')) {
    throw new RuntimeException('WooCommerce is unavailable.');
}

$updates = [
    3576 => [
        'post_title' => 'IV Prep Complete',
        'post_excerpt' => 'Interview Week included, plus continued practice, personalized feedback, debriefs, Signature Mock preparation, and physician-led support through interview season.',
        'post_content' => '<p>IV Prep Complete includes Interview Week with no separate Interview Week charge, then continues with physician-led practice, personalized feedback, Pre-IV Checkups, Post-IV Debriefs, Rx Replays, and interview-season support.</p><p>Paid-in-full tuition is $3,099 through September 26, 2026 and $3,499 standard tuition after the early period. A $3,400 installment path is also available: $1,000 today plus six monthly payments of $400.</p>',
    ],
    5865 => [
        'post_title' => 'IV Prep Complete - Session D: Oct 4th, 2026',
        'post_name' => 'iv-prep-complete-session-d-oct-4th-2026',
        'post_excerpt' => 'Start Date: Session D: Oct 4th, 2026',
    ],
    5504 => [
        'post_title' => 'IV Prep Essentials: Interview Week',
        'post_excerpt' => 'Mission Residency live interview-season kickoff. $549 by card or $499 by Zelle. Orientation October 1; five live training days October 4-11, 2026.',
        'post_content' => '<p>Interview Week is Mission Residency’s live interview-season foundation: orientation on October 1, followed by five training days from October 4 through October 11, 2026.</p><p>Tuition is $549 by card or $499 by Zelle. Zelle orders remain on hold and receive no course access until MissionMed verifies receipt. IV Prep Complete already includes Interview Week, so Complete students never add a separate Interview Week charge.</p>',
    ],
    5867 => [
        'post_title' => 'IV Prep Essentials: Interview Week - Session D: Oct 4th, 2026',
        'post_name' => 'iv-prep-essentials-interview-week-session-d-oct-4th-2026',
        'post_excerpt' => 'Start Date: Session D: Oct 4th, 2026',
    ],
    5513 => [
        'post_title' => 'IV Prep Complete - Payment Plan',
        'post_excerpt' => 'IV Prep Complete installment path: $1,000 today plus six monthly payments of $400, for a $3,400 contractual total. Interview Week is included.',
        'post_content' => '<p>IV Prep Complete installment path: $1,000 due today followed by six monthly payments of $400, for a $3,400 contractual total. Interview Week is included with no separate charge.</p>',
    ],
    5873 => [
        'post_title' => 'IV Prep Complete - Payment Plan - Session D: Oct 4th, 2026',
        'post_name' => 'iv-prep-complete-payment-plan-session-d-oct-4th-2026',
        'post_excerpt' => 'Start Date: Session D: Oct 4th, 2026',
    ],
];

foreach ($updates as $postId => $fields) {
    $fields['ID'] = $postId;
    $result = wp_update_post(wp_slash($fields), true);
    if (is_wp_error($result)) {
        throw new RuntimeException('Post update failed for ' . $postId . ': ' . $result->get_error_message());
    }
}

$termResult = wp_update_term(66, 'pa_start-date', [
    'name' => 'Session D: Oct 4th, 2026',
    'slug' => 'session-d-start-date',
]);
if (is_wp_error($termResult)) {
    throw new RuntimeException('Start-date term update failed: ' . $termResult->get_error_message());
}

$complete = wc_get_product(5865);
if (!$complete instanceof WC_Product_Variation) {
    throw new RuntimeException('Complete variation 5865 is unavailable.');
}
$complete->set_regular_price('3499');
$complete->set_sale_price('3099');
$complete->set_date_on_sale_to(new WC_DateTime('2026-09-26 23:59:59', new DateTimeZone('America/New_York')));
$complete->set_manage_stock(false);
$complete->set_stock_status('instock');
$complete->save();
wc_delete_product_transients(3576);

update_option('mmed_mr_0912_complete_zelle_enabled', 'yes', false);

$verifiedAt = (string) get_option('mmed_mr_0912_complete_verified_live_at', '');
$runtime = mm_mr_p0_runtime_config()['offers']['complete']['runtime'] ?? [];
$binding = mm_mr_0912_acceptance_binding('complete', $verifiedAt, $runtime);
if ($verifiedAt === '' || !preg_match('/^[0-9a-f]{64}$/', $binding)) {
    throw new RuntimeException('Complete acceptance rebinding failed closed.');
}
update_option('mmed_mr_0912_complete_acceptance_binding_sha256', $binding, false);

foreach ([3576, 5504, 5513] as $productId) {
    wc_delete_product_transients($productId);
}
if (function_exists('wp_cache_flush')) {
    wp_cache_flush();
}

$final = mm_mr_p0_runtime_config();
$checks = [
    'complete_checkout_allowed' => !empty($final['offers']['complete']['runtime']['checkout_allowed']),
    'interview_week_checkout_allowed' => !empty($final['offers']['interview_week']['runtime']['checkout_allowed']),
    'installment_checkout_allowed' => !empty($final['offers']['complete_installment']['runtime']['checkout_allowed']),
    'complete_zelle_verified' => !empty($final['payment_options']['complete_zelle_paid_in_full']['public_verified']),
    'complete_price' => $final['offers']['complete']['runtime']['woo_price'] ?? null,
    'interview_week_price' => $final['offers']['interview_week']['runtime']['woo_price'] ?? null,
    'installment_recurring' => $final['offers']['complete_installment']['runtime']['woo_price'] ?? null,
    'installment_signup_fee' => $final['offers']['complete_installment']['runtime']['woo_signup_fee'] ?? null,
    'complete_course' => $final['offers']['complete']['runtime']['learndash_course_id'] ?? null,
    'interview_week_course' => $final['offers']['interview_week']['runtime']['learndash_course_id'] ?? null,
];

foreach (['complete_checkout_allowed', 'interview_week_checkout_allowed', 'installment_checkout_allowed', 'complete_zelle_verified'] as $required) {
    if ($checks[$required] !== true) {
        throw new RuntimeException('Postcondition failed: ' . $required);
    }
}
echo wp_json_encode($checks, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
