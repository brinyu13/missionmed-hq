<?php
/**
 * MR-WEB-0912 exact production preimage, bounded data controller, and rollback.
 *
 * Stream through authenticated production WP-CLI:
 *   wp eval-file - -- snapshot|apply-products-closed|apply-onboarding|open-inventory|verify|rollback-data
 *
 * This controller never creates orders, users, coupons, payment plans, events,
 * meetings, or acceptance options. Optional and unproved paths remain closed.
 */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

const MR0912_PRIVATE_DIR = '/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update';
const MR0912_PREIMAGE = MR0912_PRIVATE_DIR . '/object-preimage.json';
const MR0912_SOURCE_PREIMAGE = MR0912_PRIVATE_DIR . '/source-preimage';
const MR0912_BACKUP = [
    'provider' => 'MyKinsta',
    'site' => 'MissionMed Institute',
    'environment' => 'Live',
    'type' => 'manual',
    'note' => 'pre fall update',
    'created_local' => '2026-09-13 15:43:00 America/New_York',
    'expires_local' => '2026-09-27 15:43:00 America/New_York',
    'retention_days' => 14,
    'restore_control_visible' => true,
];

$mode = 'verify';
foreach (($args ?? []) as $arg) {
    if (in_array($arg, ['snapshot', 'apply-products-closed', 'apply-onboarding', 'open-inventory', 'verify', 'rollback-data'], true)) {
        $mode = $arg;
    }
}

function mr0912_json_hash(mixed $value): string {
    return hash('sha256', (string) wp_json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

function mr0912_attributes(WC_Product $product): array {
    $result = [];
    foreach ($product->get_attributes('edit') as $key => $attribute) {
        $result[(string) $key] = $attribute instanceof WC_Product_Attribute
            ? $attribute->get_data()
            : $attribute;
    }
    return $result;
}

function mr0912_product(int $id): array {
    $product = wc_get_product($id);
    if (!$product) throw new RuntimeException("Missing product {$id}");
    $from = $product->get_date_on_sale_from('edit');
    $to = $product->get_date_on_sale_to('edit');
    return [
        'id' => $id,
        'type' => $product->get_type(),
        'parent_id' => (int) $product->get_parent_id(),
        'name' => $product->get_name('edit'),
        'slug' => (string) get_post_field('post_name', $id),
        'status' => $product->get_status('edit'),
        'catalog_visibility' => $product->get_catalog_visibility('edit'),
        'regular_price' => (string) $product->get_regular_price('edit'),
        'sale_price' => (string) $product->get_sale_price('edit'),
        'runtime_price' => (string) $product->get_price(),
        'date_on_sale_from_utc' => $from ? gmdate('c', $from->getTimestamp()) : null,
        'date_on_sale_to_utc' => $to ? gmdate('c', $to->getTimestamp()) : null,
        'stock_status' => $product->get_stock_status('edit'),
        'manage_stock' => (bool) $product->get_manage_stock('edit'),
        'stock_quantity' => $product->get_stock_quantity('edit'),
        'backorders' => $product->get_backorders('edit'),
        'virtual' => (bool) $product->get_virtual('edit'),
        'sold_individually' => (bool) $product->get_sold_individually('edit'),
        'description' => $product->get_description('edit'),
        'short_description' => $product->get_short_description('edit'),
        'attributes' => mr0912_attributes($product),
        'default_attributes' => $product->get_default_attributes('edit'),
        'related_course_exists' => metadata_exists('post', $id, '_related_course'),
        'related_course' => get_post_meta($id, '_related_course', true),
        'exclude_discounts_exists' => metadata_exists('post', $id, '_wc_memberships_exclude_discounts'),
        'exclude_discounts' => get_post_meta($id, '_wc_memberships_exclude_discounts', true),
    ];
}

function mr0912_products(): array {
    $rows = [];
    foreach ([3576, 5865, 5504, 5867, 3575, 5862, 5863] as $id) {
        $rows[(string) $id] = mr0912_product($id);
    }
    return $rows;
}

function mr0912_option(string $key): array {
    $sentinel = '__MR0912_MISSING__';
    $value = get_option($key, $sentinel);
    return ['exists' => $value !== $sentinel, 'value' => $value === $sentinel ? null : $value];
}

function mr0912_course(int $id): array {
    $post = get_post($id);
    if (!$post || $post->post_type !== 'sfwd-courses') throw new RuntimeException("Missing course {$id}");
    $steps = [];
    if (function_exists('learndash_get_course_steps_list')) {
        foreach ((array) learndash_get_course_steps_list($id) as $step) {
            if (is_object($step) && isset($step->ID)) $steps[] = (int) $step->ID;
            elseif (is_array($step) && isset($step['post']->ID)) $steps[] = (int) $step['post']->ID;
            elseif (is_numeric($step)) $steps[] = (int) $step;
        }
    }
    return [
        'id' => $id,
        'raw_title' => (string) $post->post_title,
        'filtered_title' => (string) get_the_title($id),
        'slug' => (string) $post->post_name,
        'status' => (string) $post->post_status,
        'content' => (string) $post->post_content,
        'excerpt' => (string) $post->post_excerpt,
        'modified_gmt' => (string) $post->post_modified_gmt,
        'settings_exists' => metadata_exists('post', $id, '_sfwd-courses'),
        'settings' => get_post_meta($id, '_sfwd-courses', true),
        'step_ids' => array_values(array_unique($steps)),
    ];
}

function mr0912_coupon_inventory(): array {
    $rows = [];
    $ids = get_posts(['post_type' => 'shop_coupon', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids']);
    foreach ($ids as $id) {
        $coupon = new WC_Coupon((int) $id);
        $productIds = array_map('intval', (array) $coupon->get_product_ids('edit'));
        $excludedIds = array_map('intval', (array) $coupon->get_excluded_product_ids('edit'));
        $expires = $coupon->get_date_expires('edit');
        $rows[(string) $id] = [
            'id' => (int) $id,
            'status' => (string) get_post_status($id),
            'code' => $coupon->get_code(),
            'discount_type' => $coupon->get_discount_type('edit'),
            'amount' => (string) $coupon->get_amount('edit'),
            'product_ids' => $productIds,
            'excluded_product_ids' => $excludedIds,
            'individual_use' => (bool) $coupon->get_individual_use('edit'),
            'exclude_sale_items' => (bool) $coupon->get_exclude_sale_items('edit'),
            'usage_limit' => $coupon->get_usage_limit('edit'),
            'usage_limit_per_user' => $coupon->get_usage_limit_per_user('edit'),
            'date_expires_utc' => $expires ? gmdate('c', $expires->getTimestamp()) : null,
        ];
    }
    return $rows;
}

function mr0912_redact_settings(mixed $value): mixed {
    if (!is_array($value)) return $value;
    $safe = [];
    foreach ($value as $key => $item) {
        $name = (string) $key;
        if (preg_match('/secret|token|password|api.?key|account|routing|iban|bic|email/i', $name)) {
            $safe[$name] = ['redacted' => true, 'present' => $item !== '' && $item !== null, 'sha256' => mr0912_json_hash($item)];
        } else {
            $safe[$name] = mr0912_redact_settings($item);
        }
    }
    return $safe;
}

function mr0912_event_inventory(): array {
    global $wpdb;
    $likeInterview = '%' . $wpdb->esc_like('Interview') . '%';
    $likeIvPrep = '%' . $wpdb->esc_like('IV Prep') . '%';
    $ids = $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'tribe_events' AND post_status NOT IN ('trash','auto-draft') AND (post_title LIKE %s OR post_title LIKE %s OR (post_date >= %s AND post_date < %s)) ORDER BY ID",
        $likeInterview,
        $likeIvPrep,
        '2026-09-24 00:00:00',
        '2026-10-04 00:00:00'
    ));
    $rows = [];
    foreach ($ids as $id) {
        $post = get_post((int) $id);
        $rows[(string) $id] = [
            'id' => (int) $id,
            'title' => (string) $post->post_title,
            'status' => (string) $post->post_status,
            'date_gmt' => (string) $post->post_date_gmt,
            'modified_gmt' => (string) $post->post_modified_gmt,
            'content' => (string) $post->post_content,
            'meta' => get_post_meta((int) $id),
        ];
    }
    return $rows;
}

function mr0912_file_manifest(string $path): array {
    if (!file_exists($path)) return ['exists' => false];
    if (is_file($path)) return ['exists' => true, 'type' => 'file', 'sha256' => hash_file('sha256', $path), 'bytes' => filesize($path)];
    $rows = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if (!$file->isFile()) continue;
        $relative = substr($file->getPathname(), strlen($path) + 1);
        $rows[$relative] = ['sha256' => hash_file('sha256', $file->getPathname()), 'bytes' => $file->getSize()];
    }
    ksort($rows);
    return ['exists' => true, 'type' => 'directory', 'files' => $rows];
}

function mr0912_copy_tree(string $source, string $destination): void {
    if (is_file($source)) {
        if (!is_dir(dirname($destination)) && !wp_mkdir_p(dirname($destination))) throw new RuntimeException('Cannot create source-preimage parent.');
        if (!copy($source, $destination)) throw new RuntimeException('Cannot copy source preimage.');
        chmod($destination, 0600);
        return;
    }
    if (!is_dir($source)) return;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($iterator as $file) {
        $relative = substr($file->getPathname(), strlen($source) + 1);
        $target = $destination . '/' . $relative;
        if ($file->isDir()) {
            if (!is_dir($target) && !wp_mkdir_p($target)) throw new RuntimeException('Cannot create source-preimage directory.');
            chmod($target, 0700);
        } else {
            if (!is_dir(dirname($target)) && !wp_mkdir_p(dirname($target))) throw new RuntimeException('Cannot create source-preimage parent.');
            if (!copy($file->getPathname(), $target)) throw new RuntimeException('Cannot copy source-preimage file.');
            chmod($target, 0600);
        }
    }
}

function mr0912_capture(): array {
    $optionKeys = [
        'mmed_mr_p0_enabled',
        'mmed_mr_p0_verified_live_at',
        'mmed_mr_0912_interview_week_verified_live_at',
        'mmed_mr_0912_interview_week_acceptance_binding_sha256',
        'mmed_mr_0912_complete_verified_live_at',
        'mmed_mr_0912_complete_acceptance_binding_sha256',
        'woocommerce_enable_guest_checkout',
        'woocommerce_enable_signup_and_login_from_checkout',
    ];
    $options = [];
    foreach ($optionKeys as $key) $options[$key] = mr0912_option($key);
    $gateways = WC()->payment_gateways()->payment_gateways();
    $gatewayRows = [];
    foreach (['stripe', 'bacs', 'woocommerce_payments'] as $id) {
        if (!isset($gateways[$id])) continue;
        $gatewayRows[$id] = [
            'enabled' => (string) $gateways[$id]->enabled,
            'supports' => (array) $gateways[$id]->supports,
            'settings' => mr0912_redact_settings((array) $gateways[$id]->settings),
        ];
    }
    return [
        'schema' => 'missionmed.mr_web_0912.production_preimage.v1',
        'captured_at_utc' => gmdate('c'),
        'authority' => ['DR-246', 'DR-247'],
        'candidate' => '7d25221fe1136c7dfceefc49663cbe930df24094',
        'provider_backup' => MR0912_BACKUP,
        'products' => mr0912_products(),
        'courses' => ['3646' => mr0912_course(3646), '5227' => mr0912_course(5227)],
        'options' => $options,
        'gateways_sanitized' => $gatewayRows,
        'coupons' => mr0912_coupon_inventory(),
        'calendar_webex_objects' => mr0912_event_inventory(),
        'source' => [
            'wp-content/mu-plugins/missionmed-mr-p0.php' => mr0912_file_manifest(WPMU_PLUGIN_DIR . '/missionmed-mr-p0.php'),
            'wp-content/mu-plugins/missionmed-mr-p0-assets' => mr0912_file_manifest(WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets'),
            'wp-content/mu-plugins/missionmed-mr-0912-assets' => mr0912_file_manifest(WPMU_PLUGIN_DIR . '/missionmed-mr-0912-assets'),
        ],
    ];
}

function mr0912_read_preimage(): array {
    if (!is_file(MR0912_PREIMAGE)) throw new RuntimeException('Exact preimage is missing.');
    $state = json_decode((string) file_get_contents(MR0912_PREIMAGE), true);
    if (!is_array($state) || ($state['schema'] ?? '') !== 'missionmed.mr_web_0912.production_preimage.v1') throw new RuntimeException('Exact preimage is invalid.');
    return $state;
}

function mr0912_set_product(int $id, array $fields): void {
    $product = wc_get_product($id);
    if (!$product) throw new RuntimeException("Missing product {$id}");
    foreach ($fields as $field => $value) {
        $method = 'set_' . $field;
        if (!method_exists($product, $method)) throw new RuntimeException("Unsupported field {$field}");
        $product->{$method}($value);
    }
    $product->save();
    clean_post_cache($id);
    wc_delete_product_transients($id);
}

function mr0912_restore_meta(int $id, string $key, bool $exists, mixed $value): void {
    if ($exists) update_post_meta($id, $key, $value);
    else delete_post_meta($id, $key);
}

function mr0912_restore_product(array $row): void {
    $product = wc_get_product((int) $row['id']);
    if (!$product || $product->get_type() !== $row['type']) throw new RuntimeException('Rollback product type mismatch.');
    mr0912_set_product((int) $row['id'], [
        'name' => (string) $row['name'],
        'status' => (string) $row['status'],
        'catalog_visibility' => (string) $row['catalog_visibility'],
        'regular_price' => (string) $row['regular_price'],
        'sale_price' => (string) $row['sale_price'],
        'date_on_sale_from' => $row['date_on_sale_from_utc'] ? strtotime((string) $row['date_on_sale_from_utc']) : null,
        'date_on_sale_to' => $row['date_on_sale_to_utc'] ? strtotime((string) $row['date_on_sale_to_utc']) : null,
        'stock_status' => (string) $row['stock_status'],
        'manage_stock' => (bool) $row['manage_stock'],
        'stock_quantity' => $row['stock_quantity'] === null ? null : (int) $row['stock_quantity'],
        'backorders' => (string) $row['backorders'],
        'virtual' => (bool) $row['virtual'],
        'sold_individually' => (bool) $row['sold_individually'],
        'description' => (string) $row['description'],
        'short_description' => (string) $row['short_description'],
    ]);
    wp_update_post(['ID' => (int) $row['id'], 'post_name' => (string) $row['slug']]);
    mr0912_restore_meta((int) $row['id'], '_related_course', (bool) $row['related_course_exists'], $row['related_course']);
    mr0912_restore_meta((int) $row['id'], '_wc_memberships_exclude_discounts', (bool) $row['exclude_discounts_exists'], $row['exclude_discounts']);
}

function mr0912_safe_summary(array $state, string $mode): array {
    $products = [];
    foreach ($state['products'] as $id => $row) {
        $products[$id] = [
            'name' => $row['name'],
            'status' => $row['status'],
            'runtime_price' => $row['runtime_price'],
            'stock_status' => $row['stock_status'],
            'related_course' => $row['related_course'],
            'description_sha256' => hash('sha256', (string) $row['description']),
            'short_description_sha256' => hash('sha256', (string) $row['short_description']),
        ];
    }
    $courses = [];
    foreach ($state['courses'] as $id => $row) {
        $courses[$id] = [
            'raw_title' => $row['raw_title'],
            'filtered_title' => $row['filtered_title'],
            'content_sha256' => hash('sha256', (string) $row['content']),
            'step_ids' => $row['step_ids'],
        ];
    }
    $coupons = [];
    foreach ($state['coupons'] as $id => $row) {
        $coupons[$id] = ['status' => $row['status'], 'code_sha256' => hash('sha256', (string) $row['code']), 'amount' => $row['amount'], 'product_ids' => $row['product_ids']];
    }
    return [
        'schema' => 'missionmed.mr_web_0912.production_readback.v1',
        'mode' => $mode,
        'verified_at_utc' => gmdate('c'),
        'preimage_path' => MR0912_PREIMAGE,
        'preimage_mode' => is_file(MR0912_PREIMAGE) ? substr(sprintf('%o', fileperms(MR0912_PREIMAGE)), -4) : null,
        'preimage_sha256' => is_file(MR0912_PREIMAGE) ? hash_file('sha256', MR0912_PREIMAGE) : null,
        'products' => $products,
        'courses' => $courses,
        'options' => $state['options'],
        'gateway_ids' => array_keys($state['gateways_sanitized']),
        'coupons' => $coupons,
        'calendar_webex_object_count' => count($state['calendar_webex_objects']),
        'source' => $state['source'],
    ];
}

if ($mode === 'snapshot') {
    if (file_exists(MR0912_PRIVATE_DIR)) throw new RuntimeException('MR-WEB-0912 private preimage directory already exists; refusing overwrite.');
    if (!wp_mkdir_p(MR0912_SOURCE_PREIMAGE)) throw new RuntimeException('Cannot create private preimage directory.');
    chmod(MR0912_PRIVATE_DIR, 0700);
    chmod(MR0912_SOURCE_PREIMAGE, 0700);
    mr0912_copy_tree(WPMU_PLUGIN_DIR . '/missionmed-mr-p0.php', MR0912_SOURCE_PREIMAGE . '/missionmed-mr-p0.php');
    mr0912_copy_tree(WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets', MR0912_SOURCE_PREIMAGE . '/missionmed-mr-p0-assets');
    $state = mr0912_capture();
    $json = wp_json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || file_put_contents(MR0912_PREIMAGE, $json . "\n", LOCK_EX) === false) throw new RuntimeException('Cannot write exact object preimage.');
    chmod(MR0912_PREIMAGE, 0600);
    echo wp_json_encode(mr0912_safe_summary($state, $mode), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    exit(0);
}

$before = mr0912_read_preimage();

if ($mode === 'apply-products-closed') {
    $current = mr0912_products();
    if ($current['5504']['name'] !== 'IV Prep Essentials' || $current['5867']['runtime_price'] !== '1199' || array_map('intval', (array) $current['5867']['related_course']) !== [3646]) throw new RuntimeException('Interview Week precondition drift.');
    if ($current['3576']['name'] !== 'IV Prep Complete' || $current['5865']['runtime_price'] !== '2799' || array_map('intval', (array) $current['5865']['related_course']) !== [5227]) throw new RuntimeException('Complete precondition drift.');
    if ($current['3575']['stock_status'] !== 'outofstock' || $current['5862']['stock_status'] !== 'outofstock' || $current['5863']['stock_status'] !== 'outofstock') throw new RuntimeException('360 closure drift.');
    mr0912_set_product(5504, [
        'name' => 'IV Prep Essentials: Interview Week',
        'status' => 'publish',
        'catalog_visibility' => 'visible',
        'stock_status' => 'outofstock',
        'short_description' => "Mission Residency's live interview-season kickoff. $500 in one payment.",
        'description' => '<p><strong>$500 in one payment.</strong> Orientation and Match Primer plus five live online training days beginning September 24, 2026.</p><p>Interview Week provides foundational interview and communication training. It does not include an individual Signature Mock Interview. IV Prep Complete includes Interview Week.</p>',
    ]);
    mr0912_set_product(5867, [
        'name' => 'IV Prep Essentials: Interview Week - Fall 2026',
        'status' => 'publish',
        'regular_price' => '500',
        'sale_price' => '',
        'date_on_sale_from' => null,
        'date_on_sale_to' => null,
        'stock_status' => 'outofstock',
    ]);
    update_post_meta(5504, '_related_course', [3646]);
    update_post_meta(5867, '_related_course', [3646]);
    mr0912_set_product(3576, [
        'name' => 'IV Prep Complete',
        'status' => 'publish',
        'catalog_visibility' => 'visible',
        'stock_status' => 'outofstock',
        'short_description' => 'Interview Week plus the whole interview season around it.',
        'description' => '<p><strong>Standard full-season tuition: $3,499.</strong> IV Prep Complete includes Interview Week plus continued practice, personalized feedback, debrief and action-plan support, and interview-season coaching.</p>',
    ]);
    mr0912_set_product(5865, [
        'name' => 'IV Prep Complete - Fall 2026',
        'status' => 'publish',
        'regular_price' => '3499',
        'sale_price' => '3099',
        'date_on_sale_from' => null,
        'date_on_sale_to' => strtotime('2026-09-24T03:59:59Z'),
        'stock_status' => 'outofstock',
    ]);
    update_post_meta(3576, '_related_course', [5227]);
    update_post_meta(5865, '_related_course', [5227]);
    WC_Product_Variable::sync(5504);
    WC_Product_Variable::sync(3576);
}

if ($mode === 'apply-onboarding') {
    $interview = '<h2>Welcome to IV Prep Essentials: Interview Week</h2><p>Your enrollment includes Orientation and Match Primer plus five live online training days. IV Prep Complete already includes this Interview Week.</p><ul><li>Thu Sep 24: Orientation and Match Primer — Evening</li><li>Sat Sep 26: Day 1 — 11 AM–4 PM ET</li><li>Sun Sep 27: Day 2 — 11 AM–4 PM ET</li><li>Tue Sep 29: Day 3 — Evening</li><li>Thu Oct 1: Day 4 — Evening</li><li>Sat Oct 3: Day 5 — 11 AM–4 PM ET</li></ul><p>Exact evening start times and live-session links will be shared through the verified course communication path when operations confirms them.</p>';
    $complete = '<h2>Welcome to IV Prep Complete</h2><p>Your full-season enrollment includes Interview Week plus continued practice, personalized feedback, debrief and action-plan support, and interview-season coaching.</p><h3>Interview Week</h3><ul><li>Thu Sep 24: Orientation and Match Primer — Evening</li><li>Sat Sep 26: Day 1 — 11 AM–4 PM ET</li><li>Sun Sep 27: Day 2 — 11 AM–4 PM ET</li><li>Tue Sep 29: Day 3 — Evening</li><li>Thu Oct 1: Day 4 — Evening</li><li>Sat Oct 3: Day 5 — 11 AM–4 PM ET</li></ul><p>Exact evening start times and live-session links will be shared through the verified course communication path when operations confirms them.</p>';
    foreach ([[3646, 'IV Prep Essentials: Interview Week', $interview], [5227, 'IV Prep Complete', $complete]] as [$id, $title, $content]) {
        $result = wp_update_post(['ID' => $id, 'post_title' => $title, 'post_content' => $content], true);
        if (is_wp_error($result)) throw new RuntimeException($result->get_error_message());
        clean_post_cache($id);
    }
}

if ($mode === 'open-inventory') {
    if (!is_readable(WPMU_PLUGIN_DIR . '/missionmed-mr-0912-assets/config/campaign-state.json')) throw new RuntimeException('Candidate assets are not deployed.');
    if (hash_file('sha256', WPMU_PLUGIN_DIR . '/missionmed-mr-p0.php') !== '04ab7d2bbffbd692bec386ac401bf3c24eba4abb8b4289f9938273801e661235') throw new RuntimeException('Candidate plugin hash mismatch.');
    mr0912_set_product(5504, ['stock_status' => 'instock']);
    mr0912_set_product(5867, ['stock_status' => 'instock']);
    mr0912_set_product(3576, ['stock_status' => 'instock']);
    mr0912_set_product(5865, ['stock_status' => 'instock']);
    WC_Product_Variable::sync(5504);
    WC_Product_Variable::sync(3576);
}

if ($mode === 'rollback-data') {
    foreach ($before['products'] as $row) mr0912_restore_product($row);
    foreach ($before['courses'] as $id => $row) {
        $result = wp_update_post(['ID' => (int) $id, 'post_title' => $row['raw_title'], 'post_name' => $row['slug'], 'post_status' => $row['status'], 'post_content' => $row['content'], 'post_excerpt' => $row['excerpt']], true);
        if (is_wp_error($result)) throw new RuntimeException($result->get_error_message());
        mr0912_restore_meta((int) $id, '_sfwd-courses', (bool) $row['settings_exists'], $row['settings']);
    }
    foreach ($before['options'] as $key => $row) {
        if ($row['exists']) update_option($key, $row['value'], false);
        else delete_option($key);
    }
    WC_Product_Variable::sync(5504);
    WC_Product_Variable::sync(3576);
}

$state = mr0912_capture();
$p = $state['products'];
$c = $state['courses'];
$checks = [
    'interview_identity' => $p['5504']['name'] === 'IV Prep Essentials: Interview Week' && $p['5867']['parent_id'] === 5504,
    'interview_price' => (float) $p['5867']['runtime_price'] === 500.0,
    'interview_mapping' => array_map('intval', (array) $p['5504']['related_course']) === [3646] && array_map('intval', (array) $p['5867']['related_course']) === [3646],
    'complete_identity' => $p['3576']['name'] === 'IV Prep Complete' && $p['5865']['parent_id'] === 3576,
    'complete_price' => (float) $p['5865']['regular_price'] === 3499.0 && (float) $p['5865']['runtime_price'] === 3099.0 && $p['5865']['date_on_sale_to_utc'] === '2026-09-24T03:59:59+00:00',
    'complete_mapping' => array_map('intval', (array) $p['3576']['related_course']) === [5227] && array_map('intval', (array) $p['5865']['related_course']) === [5227],
    'course_titles' => $c['3646']['raw_title'] === 'IV Prep Essentials: Interview Week' && $c['5227']['raw_title'] === 'IV Prep Complete',
    'onboarding_present' => strlen($c['3646']['content']) > 100 && strlen($c['5227']['content']) > 100,
    '360_closed' => $p['3575']['stock_status'] === 'outofstock' && $p['5862']['stock_status'] === 'outofstock' && $p['5863']['stock_status'] === 'outofstock',
    'interview_acceptance_absent' => !$state['options']['mmed_mr_0912_interview_week_verified_live_at']['exists'] && !$state['options']['mmed_mr_0912_interview_week_acceptance_binding_sha256']['exists'],
    'complete_acceptance_absent' => !$state['options']['mmed_mr_0912_complete_verified_live_at']['exists'] && !$state['options']['mmed_mr_0912_complete_acceptance_binding_sha256']['exists'],
];
$checks['target_inventory_' . (in_array($mode, ['apply-products-closed', 'apply-onboarding'], true) ? 'closed' : 'open')] =
    in_array($mode, ['apply-products-closed', 'apply-onboarding'], true)
        ? $p['5504']['stock_status'] === 'outofstock' && $p['5867']['stock_status'] === 'outofstock' && $p['3576']['stock_status'] === 'outofstock' && $p['5865']['stock_status'] === 'outofstock'
        : $p['5504']['stock_status'] === 'instock' && $p['5867']['stock_status'] === 'instock' && $p['3576']['stock_status'] === 'instock' && $p['5865']['stock_status'] === 'instock';
if ($mode === 'apply-products-closed') {
    unset($checks['course_titles'], $checks['onboarding_present']);
}
$safe = mr0912_safe_summary($state, $mode);
$safe['checks'] = $checks;
$safe['passed'] = count(array_filter($checks));
$safe['total'] = count($checks);
$safe['result'] = count(array_filter($checks)) === count($checks) ? 'PASS' : 'FAIL';
echo wp_json_encode($safe, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit($safe['result'] === 'PASS' || $mode === 'rollback-data' ? 0 : 1);
