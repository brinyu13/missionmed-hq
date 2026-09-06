<?php
/**
 * MR-WEB-0906A exact priced-hero Elementor library archive.
 *
 * Run through wp eval-file. The script is idempotent and outputs no customer data.
 */
declare(strict_types=1);

if (!defined('ABSPATH')) require '/www/theresidencyacademy_209/public/wp-load.php';

const MR0906A_ARCHIVE_TITLE = 'LEGACY_MR_WEB_0906A_CORPORATE_HERO_PRICED_20260906';
const MR0906A_SOURCE_PLUGIN_SHA256 = '48c48278e0c21c98e2edc9bf6c26e8b731b2ff7838c838561432bc3df14b1fa5';

function mr0906a_archive_markup(): string {
    return '<section class="mm-mr-p0-route" aria-label="Mission Residency Fall 2026">'
        . '<div class="mm-mr-p0-route__in"><div><span class="mm-mr-p0-route__k">Mission Residency · Fall 2026</span>'
        . '<h2>It is interview season.</h2><p>One expert. Your whole interview season. Boutique, high-touch residency interview preparation with live teaching, Signature Mock Interviews, and longitudinal support.</p>'
        . '<a href="https://missionmedinstitute.com/mission-residency/">Explore Mission Residency</a></div>'
        . '<div class="mm-mr-p0-route__card"><strong>IV Prep Complete</strong><span class="mm-mr-p0-route__price">$2,799.00</span>'
        . '<p>Launch tuition through September 12, 2026 at 11:59 PM ET. IV Prep Essentials is open at $1,199; 360 enrollment is closed.</p></div></div></section>';
}

$existing = get_page_by_title(MR0906A_ARCHIVE_TITLE, OBJECT, 'elementor_library');
if ($existing instanceof WP_Post) {
    $archiveId = (int) $existing->ID;
} else {
    $archiveId = wp_insert_post([
        'post_type' => 'elementor_library',
        'post_status' => 'draft',
        'post_title' => MR0906A_ARCHIVE_TITLE,
        'post_content' => mr0906a_archive_markup(),
        'post_excerpt' => 'Exact pre-MR-WEB-0906A priced seasonal homepage block. Archived before de-pricing; never public.',
    ], true);
    if (is_wp_error($archiveId)) {
        throw new RuntimeException('Elementor archive creation failed: ' . $archiveId->get_error_code());
    }

    $widgetId = substr(hash('sha256', MR0906A_ARCHIVE_TITLE), 0, 7);
    $elementorData = [[
        'id' => substr(hash('sha256', MR0906A_ARCHIVE_TITLE . ':container'), 0, 7),
        'elType' => 'container',
        'isInner' => false,
        'settings' => [],
        'elements' => [[
            'id' => $widgetId,
            'elType' => 'widget',
            'widgetType' => 'html',
            'isInner' => false,
            'settings' => ['html' => mr0906a_archive_markup()],
            'elements' => [],
        ]],
    ]];
    update_post_meta((int) $archiveId, '_elementor_edit_mode', 'builder');
    update_post_meta((int) $archiveId, '_elementor_template_type', 'section');
    update_post_meta((int) $archiveId, '_elementor_data', wp_slash(wp_json_encode($elementorData)));
    update_post_meta((int) $archiveId, '_mmed_archive_ticket', 'MR-WEB-0906A');
    update_post_meta((int) $archiveId, '_mmed_source_plugin_sha256', MR0906A_SOURCE_PLUGIN_SHA256);
    update_post_meta((int) $archiveId, '_mmed_source_markup_sha256', hash('sha256', mr0906a_archive_markup()));
    update_post_meta((int) $archiveId, '_mmed_archived_at_utc', gmdate('c'));
    $frontPageId = (int) get_option('page_on_front');
    update_post_meta((int) $archiveId, '_mmed_front_page_id', $frontPageId);
    update_post_meta(
        (int) $archiveId,
        '_mmed_front_page_elementor_data_sha256',
        hash('sha256', (string) get_post_meta($frontPageId, '_elementor_data', true))
    );
}

$checks = [
    'archive_exists' => get_post_type($archiveId) === 'elementor_library',
    'archive_is_draft' => get_post_status($archiveId) === 'draft',
    'archive_title_exact' => get_the_title($archiveId) === MR0906A_ARCHIVE_TITLE,
    'archive_ticket_exact' => get_post_meta($archiveId, '_mmed_archive_ticket', true) === 'MR-WEB-0906A',
    'source_plugin_hash_exact' => get_post_meta($archiveId, '_mmed_source_plugin_sha256', true) === MR0906A_SOURCE_PLUGIN_SHA256,
    'source_markup_hash_exact' => get_post_meta($archiveId, '_mmed_source_markup_sha256', true) === hash('sha256', mr0906a_archive_markup()),
    'elementor_data_present' => is_string(get_post_meta($archiveId, '_elementor_data', true))
        && get_post_meta($archiveId, '_elementor_data', true) !== '',
    'front_page_reference_present' => (int) get_post_meta($archiveId, '_mmed_front_page_id', true) > 0,
    'front_page_elementor_hash_present' => preg_match(
        '/^[0-9a-f]{64}$/',
        (string) get_post_meta($archiveId, '_mmed_front_page_elementor_data_sha256', true)
    ) === 1,
];

echo wp_json_encode([
    'schema' => 'missionmed.mr_web_0906a.elementor_archive.v1',
    'verified_at_utc' => gmdate('c'),
    'archive_id' => $archiveId,
    'archive_title' => MR0906A_ARCHIVE_TITLE,
    'source_plugin_sha256' => MR0906A_SOURCE_PLUGIN_SHA256,
    'source_markup_sha256' => hash('sha256', mr0906a_archive_markup()),
    'front_page_id' => (int) get_post_meta($archiveId, '_mmed_front_page_id', true),
    'front_page_elementor_data_sha256' => get_post_meta($archiveId, '_mmed_front_page_elementor_data_sha256', true),
    'checks' => $checks,
    'pass_count' => count(array_filter($checks)),
    'check_count' => count($checks),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";

exit(count(array_filter($checks)) === count($checks) ? 0 : 1);
