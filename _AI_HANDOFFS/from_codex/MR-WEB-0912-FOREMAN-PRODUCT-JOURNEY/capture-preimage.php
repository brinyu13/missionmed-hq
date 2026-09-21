<?php

$postIds = [3576, 5865, 5504, 5867, 5513, 5873];
$optionKeys = [
    'mmed_mr_p0_enabled',
    'mmed_mr_0912_iw_zelle_enabled',
    'mmed_mr_0912_complete_zelle_enabled',
    'mmed_mr_0912_financial_test_status',
    'mmed_mr_0912_financial_test_authority',
    'mmed_mr_0912_interview_week_verified_live_at',
    'mmed_mr_0912_interview_week_acceptance_binding_sha256',
    'mmed_mr_0912_complete_verified_live_at',
    'mmed_mr_0912_complete_acceptance_binding_sha256',
];

$result = [
    'captured_at_utc' => gmdate('c'),
    'site_url' => get_site_url(),
    'posts' => [],
    'options' => [],
    'start_date_term' => null,
];

foreach ($postIds as $postId) {
    $post = get_post($postId, ARRAY_A);
    $result['posts'][(string) $postId] = [
        'post' => $post,
        'meta' => get_post_meta($postId),
    ];
}
foreach ($optionKeys as $key) {
    $result['options'][$key] = get_option($key, null);
}
$term = get_term(66, 'pa_start-date');
if ($term instanceof WP_Term) {
    $result['start_date_term'] = $term->to_array();
}

echo wp_json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
