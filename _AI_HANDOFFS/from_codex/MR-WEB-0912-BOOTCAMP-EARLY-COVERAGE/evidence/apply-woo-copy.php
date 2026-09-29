<?php

if (!defined('ABSPATH')) {
    fwrite(STDERR, "WordPress runtime required.\n");
    exit(1);
}

$expectedMappings = [
    5504 => 3646,
    5867 => 3646,
    3576 => 5227,
    5865 => 5227,
    5513 => 5227,
    5873 => 5227,
];

foreach ($expectedMappings as $postId => $courseId) {
    $post = get_post($postId);
    if (!$post) {
        throw new RuntimeException("Missing protected Woo object {$postId}.");
    }
    $related = get_post_meta($postId, '_related_course', true);
    $related = is_array($related) ? array_map('intval', $related) : [];
    if ($related !== [$courseId]) {
        throw new RuntimeException("Protected course mapping drift for {$postId}.");
    }
}

$updates = [
    5504 => [
        'post_title' => 'IV Prep Essentials: Interview Bootcamp Week',
        'post_excerpt' => 'Mission Residency live interview-season kickoff. $549 by card or $499 by Zelle. Orientation October 8; five live training days October 11-18, 2026. Early interview protection through October 18 is included.',
        'post_content' => '<p>Interview Bootcamp Week is Mission Residency’s live interview-season foundation: orientation on October 8, followed by five training days from October 11 through October 18, 2026.</p><p><strong>Early interview? You’re covered.</strong> If your residency interview is scheduled on or before October 18, Dr Brian will personally provide individualized emergency interview preparation before your interview, so you do not have to wait for Bootcamp Week to finish.</p><p>Tuition is $549 by card or $499 by Zelle. Zelle orders remain on hold and receive no course access until MissionMed verifies receipt. IV Prep Complete already includes Interview Bootcamp Week, so Complete students never add a separate Bootcamp charge.</p>',
    ],
    5867 => [
        'post_title' => 'IV Prep Essentials: Interview Bootcamp Week - Session D: Oct 11th, 2026',
    ],
    3576 => [
        'post_excerpt' => 'Interview Bootcamp Week included, plus early-interview protection through October 18, continued practice, personalized feedback, debriefs, Signature Mock preparation, and physician-led support through interview season.',
        'post_content' => '<p>IV Prep Complete includes Interview Bootcamp Week with no separate Bootcamp charge, then continues with physician-led practice, personalized feedback, Pre-IV Checkups, Post-IV Debriefs, Rx Replays, and interview-season support.</p><p><strong>Early interview? You’re covered.</strong> If your residency interview is scheduled on or before October 18, Dr Brian will personally provide individualized emergency interview preparation before your interview.</p><p>Paid-in-full tuition is $3,099 through October 7, 2026 and $3,499 standard tuition after the recovery period. A $3,400 installment path is also available: $1,000 today plus six monthly payments of $400.</p>',
    ],
    5513 => [
        'post_excerpt' => 'IV Prep Complete installment path: $1,000 today plus six monthly payments of $400, for a $3,400 contractual total. Interview Bootcamp Week and early-interview protection through October 18 are included.',
        'post_content' => '<p>IV Prep Complete installment path: $1,000 due today followed by six monthly payments of $400, for a $3,400 contractual total. Interview Bootcamp Week is included with no separate charge.</p><p>If your residency interview is scheduled on or before October 18, Dr Brian will personally provide individualized emergency interview preparation before your interview.</p>',
    ],
];

foreach ($updates as $postId => $fields) {
    $result = wp_update_post(['ID' => $postId] + $fields, true);
    if (is_wp_error($result) || (int) $result !== $postId) {
        throw new RuntimeException("Woo copy update failed for {$postId}.");
    }
    clean_post_cache($postId);
}

if (function_exists('wc_delete_product_transients')) {
    foreach (array_keys($expectedMappings) as $postId) {
        wc_delete_product_transients($postId);
    }
}

echo wp_json_encode([
    'updated_posts' => array_keys($updates),
    'preserved_mappings' => $expectedMappings,
    'prices_changed' => false,
    'slugs_changed' => false,
    'entitlements_changed' => false,
], JSON_PRETTY_PRINT) . "\n";
