<?php
/**
 * MR-WEB-0904B temporary one-dollar live-card verification product.
 *
 * Usage: wp eval-file mr-web-0904b-dollar-test-product.php -- apply|verify|rollback
 * Product 6319 is an existing dormant verification product. Apply makes it a
 * hidden, direct-link-only $1 product mapped through the native LearnDash Woo
 * path to IV Prep Complete course 5227. Rollback restores the exact preimage.
 */

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

$mode = in_array('apply', $args ?? [], true) ? 'apply'
    : (in_array('rollback', $args ?? [], true) ? 'rollback' : 'verify');
$productId = 6319;
$courseId = 5227;
$privateDir = '/www/theresidencyacademy_209/private/mr-web-0904b';
$preimagePath = $privateDir . '/dollar-test-product-preimage.json';

function mr0904b_dollar_snapshot(int $productId): array {
    $product = wc_get_product($productId);
    if (!$product) throw new RuntimeException('Verification product is missing.');
    return [
        'timestamp_utc' => gmdate('c'),
        'product_id' => $productId,
        'type' => $product->get_type(),
        'name' => $product->get_name('edit'),
        'status' => $product->get_status('edit'),
        'catalog_visibility' => $product->get_catalog_visibility('edit'),
        'regular_price' => $product->get_regular_price('edit'),
        'sale_price' => $product->get_sale_price('edit'),
        'stock_status' => $product->get_stock_status('edit'),
        'manage_stock' => $product->get_manage_stock('edit'),
        'stock_quantity' => $product->get_stock_quantity('edit'),
        'backorders' => $product->get_backorders('edit'),
        'virtual' => $product->get_virtual('edit'),
        'sold_individually' => $product->get_sold_individually('edit'),
        'related_course_exists' => metadata_exists('post', $productId, '_related_course'),
        'related_course' => get_post_meta($productId, '_related_course', true),
        'exclude_discounts_exists' => metadata_exists('post', $productId, '_wc_memberships_exclude_discounts'),
        'exclude_discounts' => get_post_meta($productId, '_wc_memberships_exclude_discounts', true),
    ];
}

function mr0904b_dollar_restore_meta(int $productId, string $key, bool $exists, mixed $value): void {
    if ($exists) update_post_meta($productId, $key, $value);
    else delete_post_meta($productId, $key);
}

if ($mode === 'apply') {
    if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
        throw new RuntimeException('Unable to create private preimage directory.');
    }
    if (file_exists($preimagePath)) {
        throw new RuntimeException('Preimage already exists; refusing to overwrite it.');
    }
    $before = mr0904b_dollar_snapshot($productId);
    if ($before['type'] !== 'simple') {
        throw new RuntimeException('Verification product must remain a simple product.');
    }
    if (file_put_contents($preimagePath, wp_json_encode($before, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) === false) {
        throw new RuntimeException('Unable to write private preimage.');
    }
    chmod($preimagePath, 0600);

    $product = wc_get_product($productId);
    $product->set_name('IV Prep Complete - $1 Production Verification');
    $product->set_status('publish');
    $product->set_catalog_visibility('hidden');
    $product->set_regular_price('1');
    $product->set_sale_price('');
    $product->set_stock_status('instock');
    $product->set_manage_stock(false);
    $product->set_backorders('no');
    $product->set_virtual(true);
    $product->set_sold_individually(true);
    $product->save();
    update_post_meta($productId, '_related_course', [$courseId]);
    update_post_meta($productId, '_wc_memberships_exclude_discounts', 'yes');
    clean_post_cache($productId);
    wc_delete_product_transients($productId);
}

if ($mode === 'rollback') {
    if (!file_exists($preimagePath)) {
        throw new RuntimeException('Private preimage is missing.');
    }
    $before = json_decode((string) file_get_contents($preimagePath), true);
    if (!is_array($before) || (int) ($before['product_id'] ?? 0) !== $productId || ($before['type'] ?? '') !== 'simple') {
        throw new RuntimeException('Private preimage is invalid.');
    }
    $product = wc_get_product($productId);
    $product->set_name((string) $before['name']);
    $product->set_status((string) $before['status']);
    $product->set_catalog_visibility((string) $before['catalog_visibility']);
    $product->set_regular_price((string) $before['regular_price']);
    $product->set_sale_price((string) $before['sale_price']);
    $product->set_stock_status((string) $before['stock_status']);
    $product->set_manage_stock((bool) $before['manage_stock']);
    $product->set_stock_quantity($before['stock_quantity'] === null ? null : (int) $before['stock_quantity']);
    $product->set_backorders((string) $before['backorders']);
    $product->set_virtual((bool) $before['virtual']);
    $product->set_sold_individually((bool) $before['sold_individually']);
    $product->save();
    mr0904b_dollar_restore_meta($productId, '_related_course', (bool) $before['related_course_exists'], $before['related_course']);
    mr0904b_dollar_restore_meta($productId, '_wc_memberships_exclude_discounts', (bool) $before['exclude_discounts_exists'], $before['exclude_discounts']);
    clean_post_cache($productId);
    wc_delete_product_transients($productId);
}

$after = mr0904b_dollar_snapshot($productId);
$checks = [
    'simple_product' => $after['type'] === 'simple',
    'hidden_direct_link_only' => $after['catalog_visibility'] === 'hidden',
    'published_and_in_stock' => $after['status'] === 'publish' && $after['stock_status'] === 'instock',
    'exact_one_dollar' => (float) $after['regular_price'] === 1.0 && $after['sale_price'] === '',
    'complete_course_mapping' => array_map('intval', (array) $after['related_course']) === [$courseId],
    'discounts_excluded' => $after['exclude_discounts'] === 'yes',
    'single_virtual_item' => $after['virtual'] === true && $after['sold_individually'] === true,
];

echo wp_json_encode([
    'schema' => 'missionmed.mr_web_0904b.dollar_test_product.v1',
    'mode' => $mode,
    'verified_at_utc' => gmdate('c'),
    'preimage_path' => $preimagePath,
    'preimage_mode' => file_exists($preimagePath) ? substr(sprintf('%o', fileperms($preimagePath)), -4) : null,
    'product' => $after,
    'checks' => $checks,
    'pass_count' => count(array_filter($checks)),
    'check_count' => count($checks),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";

if ($mode === 'rollback') exit(0);
exit(count(array_filter($checks)) === count($checks) ? 0 : 1);
