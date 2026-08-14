<?php
/**
 * MissionMed Video Inserter UI — Admin-Side Video Picker Modal
 *
 * Provides the instructor-facing UI for discovering, previewing, and inserting
 * video shortcodes into LearnDash lessons. Implements LDV-007 UX specification.
 *
 * Flow:
 *   1. Instructor clicks "Add MissionMed Video" in lesson editor toolbar
 *   2. Full-screen modal opens with search, filters, and video grid
 *   3. Click video card → preview panel slides in
 *   4. Click "Insert Video" → shortcode injected at cursor position
 *   Total: ≤ 3 clicks from intent to insertion
 *
 * Integration points:
 *   - video-resolver.php  → manifest lookup for video data
 *   - video-shortcode.php → shortcode format alignment
 *   - video-player.php    → preview rendering
 *   - VIDEO_SYSTEM/exports/video_manifest.json → canonical video source
 *
 * @package MissionMed_Hub
 * @since   1.6.3
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ── Constants ─────────────────────────────────────────────────────── */

/** Number of videos per page in the inserter grid. */
if ( ! defined( 'MMED_INSERTER_PER_PAGE' ) ) {
    define( 'MMED_INSERTER_PER_PAGE', 24 );
}

/* ── Admin Hooks ───────────────────────────────────────────────────── */

/**
 * Register the video inserter assets on LearnDash editing screens.
 */
function mmed_video_inserter_enqueue( $hook ) {
    // Only load on post editing screens.
    if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
        return;
    }

    $post_type = get_post_type();
    $allowed   = array( 'sfwd-lessons', 'sfwd-topic', 'sfwd-courses', 'post', 'page' );
    if ( ! in_array( $post_type, $allowed, true ) ) {
        return;
    }

    // Capability check — only editors+ can insert videos.
    if ( ! current_user_can( 'edit_posts' ) ) {
        return;
    }

    $plugin_url = defined( 'MMED_HUB_URL' ) ? MMED_HUB_URL : plugin_dir_url( dirname( __DIR__ ) . '/missionmed-hub.php' );
    $version    = defined( 'MMED_HUB_VERSION' ) ? MMED_HUB_VERSION : '1.6.3';

    wp_enqueue_style(
        'mmed-video-inserter',
        $plugin_url . 'assets/video-inserter.css',
        array(),
        $version
    );

    wp_enqueue_script(
        'mmed-video-inserter',
        $plugin_url . 'assets/video-inserter.js',
        array( 'jquery' ),
        $version,
        true
    );

    wp_localize_script( 'mmed-video-inserter', 'mmedInserter', array(
        'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
        'nonce'      => wp_create_nonce( 'mmed_video_inserter' ),
        'perPage'    => MMED_INSERTER_PER_PAGE,
        'postId'     => get_the_ID(),
        'postType'   => $post_type,
        'divisions'  => mmed_get_available_divisions(),
        'categories' => mmed_get_available_categories(),
        'i18n'       => array(
            'modalTitle'     => 'MissionMed Video Library',
            'searchPlaceholder' => 'Search videos by title, tag, or keyword\u2026',
            'insertVideo'    => 'Insert Video',
            'replaceVideo'   => 'Replace Video',
            'insertAll'      => 'Insert All',
            'clearQueue'     => 'Clear',
            'noResults'      => 'No videos match your search. Try different keywords.',
            'loading'        => 'Loading video library\u2026',
            'videoInserted'  => 'Video inserted',
            'videosInserted' => 'videos inserted',
            'videoReplaced'  => 'Video replaced',
            'copyShortcode'  => 'Copy Shortcode',
            'copied'         => 'Copied!',
            'preview'        => 'Preview',
            'allDivisions'   => 'All',
            'published'      => 'Published',
            'notPublished'   => 'Not Published',
            'usedIn'         => 'Used in:',
            'loadMore'       => 'Load More',
            'addToQueue'     => 'Add to Queue',
            'watchFull'      => 'Watch Full Preview',
            'close'          => 'Close',
        ),
    ) );
}
add_action( 'admin_enqueue_scripts', 'mmed_video_inserter_enqueue' );

/**
 * Add the "Add MissionMed Video" button to TinyMCE (Classic Editor).
 */
function mmed_video_inserter_mce_button( $buttons ) {
    $buttons[] = 'mmed_video_insert';
    return $buttons;
}

function mmed_video_inserter_mce_plugin( $plugins ) {
    $plugin_url = defined( 'MMED_HUB_URL' ) ? MMED_HUB_URL : plugin_dir_url( dirname( __DIR__ ) . '/missionmed-hub.php' );
    $plugins['mmed_video_insert'] = $plugin_url . 'assets/video-inserter.js';
    return $plugins;
}

/**
 * Register TinyMCE integration for Classic Editor.
 */
function mmed_video_inserter_editor_init() {
    if ( ! current_user_can( 'edit_posts' ) ) {
        return;
    }

    // Classic Editor TinyMCE button.
    add_filter( 'mce_buttons', 'mmed_video_inserter_mce_button' );
    add_filter( 'mce_external_plugins', 'mmed_video_inserter_mce_plugin' );
}
add_action( 'admin_init', 'mmed_video_inserter_editor_init' );

/**
 * Print the modal HTML shell in the admin footer on relevant screens.
 */
function mmed_video_inserter_modal_html() {
    $screen = get_current_screen();
    if ( ! $screen || 'post' !== $screen->base ) {
        return;
    }

    $allowed = array( 'sfwd-lessons', 'sfwd-topic', 'sfwd-courses', 'post', 'page' );
    if ( ! in_array( $screen->post_type, $allowed, true ) ) {
        return;
    }

    if ( ! current_user_can( 'edit_posts' ) ) {
        return;
    }
    ?>
    <div id="mmed-video-inserter-modal" class="mmed-inserter-modal" style="display:none;" role="dialog" aria-modal="true" aria-label="MissionMed Video Library">
        <div class="mmed-inserter-backdrop"></div>
        <div class="mmed-inserter-container">

            <!-- Header -->
            <div class="mmed-inserter-header">
                <h2 class="mmed-inserter-title">MissionMed Video Library</h2>
                <button class="mmed-inserter-close" type="button" aria-label="Close">&times;</button>
            </div>

            <!-- Replace banner (hidden by default) -->
            <div class="mmed-inserter-replace-banner" style="display:none;">
                Replacing: <strong class="mmed-inserter-replace-title"></strong>
            </div>

            <!-- Search + Filters -->
            <div class="mmed-inserter-toolbar">
                <div class="mmed-inserter-search-wrap">
                    <input type="text"
                           id="mmed-inserter-search"
                           class="mmed-inserter-search"
                           placeholder="Search videos by title, tag, or keyword&hellip;"
                           autocomplete="off" />
                </div>
                <div class="mmed-inserter-filters">
                    <div class="mmed-inserter-filter-group" data-filter="division">
                        <label>Division:</label>
                        <div class="mmed-inserter-pills" id="mmed-division-pills">
                            <button class="mmed-pill mmed-pill--active" data-value="">All</button>
                        </div>
                    </div>
                    <div class="mmed-inserter-filter-group" data-filter="category">
                        <label>Category:</label>
                        <select id="mmed-category-filter" class="mmed-inserter-select">
                            <option value="">All Categories</option>
                        </select>
                    </div>
                    <div class="mmed-inserter-filter-group" data-filter="sort">
                        <label>Sort:</label>
                        <select id="mmed-sort-filter" class="mmed-inserter-select">
                            <option value="relevance">Relevance</option>
                            <option value="newest">Newest</option>
                            <option value="title">Title A-Z</option>
                            <option value="duration">Duration</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Tab nav -->
            <div class="mmed-inserter-tabs">
                <button class="mmed-inserter-tab mmed-inserter-tab--active" data-tab="all">All Videos</button>
                <button class="mmed-inserter-tab" data-tab="recent">Recently Used</button>
            </div>

            <!-- Body: Grid + Preview -->
            <div class="mmed-inserter-body">

                <!-- Video Grid -->
                <div class="mmed-inserter-grid-area">
                    <div class="mmed-inserter-grid" id="mmed-inserter-grid"></div>
                    <div class="mmed-inserter-loading" id="mmed-inserter-loading">
                        <div class="mmed-inserter-spinner"></div>
                        <p>Loading video library&hellip;</p>
                    </div>
                    <div class="mmed-inserter-empty" id="mmed-inserter-empty" style="display:none;">
                        <p>No videos match your search. Try different keywords.</p>
                        <button class="mmed-inserter-clear-filters" type="button">Clear Filters</button>
                    </div>
                    <div class="mmed-inserter-load-more" id="mmed-inserter-load-more" style="display:none;">
                        <button class="mmed-inserter-load-more-btn" type="button">Load More</button>
                    </div>
                </div>

                <!-- Preview Panel -->
                <div class="mmed-inserter-preview" id="mmed-inserter-preview" style="display:none;">
                    <div class="mmed-inserter-preview-inner">
                        <div class="mmed-inserter-preview-player" id="mmed-preview-player"></div>
                        <h3 class="mmed-inserter-preview-title" id="mmed-preview-title"></h3>
                        <div class="mmed-inserter-preview-meta">
                            <span class="mmed-preview-duration" id="mmed-preview-duration"></span>
                            <span class="mmed-preview-category" id="mmed-preview-category"></span>
                            <span class="mmed-preview-division" id="mmed-preview-division"></span>
                        </div>
                        <div class="mmed-inserter-preview-status" id="mmed-preview-status"></div>
                        <div class="mmed-inserter-preview-tags" id="mmed-preview-tags"></div>
                        <div class="mmed-inserter-preview-used" id="mmed-preview-used" style="display:none;">
                            <strong>Used in:</strong>
                            <ul id="mmed-preview-used-list"></ul>
                        </div>
                        <div class="mmed-inserter-preview-actions">
                            <button class="mmed-inserter-btn mmed-inserter-btn--primary" id="mmed-preview-insert" type="button">Insert Video</button>
                            <button class="mmed-inserter-btn mmed-inserter-btn--secondary" id="mmed-preview-queue" type="button">Add to Queue</button>
                            <button class="mmed-inserter-btn mmed-inserter-btn--text" id="mmed-preview-copy" type="button">Copy Shortcode</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Queue Bar -->
            <div class="mmed-inserter-queue-bar" id="mmed-inserter-queue-bar" style="display:none;">
                <span class="mmed-queue-count" id="mmed-queue-count">0 videos selected</span>
                <div class="mmed-queue-actions">
                    <button class="mmed-inserter-btn mmed-inserter-btn--primary" id="mmed-queue-insert-all" type="button">Insert All</button>
                    <button class="mmed-inserter-btn mmed-inserter-btn--text" id="mmed-queue-clear" type="button">Clear</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Gutenberg sidebar button -->
    <style>
    .mmed-gutenberg-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #1a2332;
        color: #D4AF63;
        border: 1px solid #D4AF63;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }
    .mmed-gutenberg-btn:hover {
        background: #D4AF63;
        color: #1a2332;
    }
    .mmed-gutenberg-btn svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
    }
    </style>
    <?php
}
add_action( 'admin_footer', 'mmed_video_inserter_modal_html' );

/* ── AJAX: Load Videos ─────────────────────────────────────────────── */

/**
 * AJAX handler: Return paginated video list from manifest.
 *
 * Accepts: search, division, category, sort, page, per_page.
 */
function mmed_ajax_inserter_load_videos() {
    check_ajax_referer( 'mmed_video_inserter', 'nonce' );

    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    $search   = sanitize_text_field( $_POST['search'] ?? '' );
    $division = sanitize_text_field( $_POST['division'] ?? '' );
    $category = sanitize_text_field( $_POST['category'] ?? '' );
    $sort     = sanitize_text_field( $_POST['sort'] ?? 'relevance' );
    $page     = max( 1, intval( $_POST['page'] ?? 1 ) );
    $per_page = max( 1, min( 100, intval( $_POST['per_page'] ?? MMED_INSERTER_PER_PAGE ) ) );

    // Load manifest.
    $videos = mmed_inserter_get_all_videos();

    if ( empty( $videos ) ) {
        wp_send_json_success( array(
            'videos'   => array(),
            'total'    => 0,
            'page'     => $page,
            'pages'    => 0,
            'hasMore'  => false,
        ) );
    }

    // Filter by division.
    if ( $division ) {
        $videos = array_filter( $videos, function ( $v ) use ( $division ) {
            return strtolower( $v['division'] ?? '' ) === strtolower( $division );
        } );
    }

    // Filter by category.
    if ( $category ) {
        $videos = array_filter( $videos, function ( $v ) use ( $category ) {
            return strtolower( $v['category'] ?? '' ) === strtolower( $category );
        } );
    }

    // Filter by search.
    if ( $search ) {
        $search_lower = strtolower( $search );
        $videos = array_filter( $videos, function ( $v ) use ( $search_lower ) {
            $haystack = strtolower(
                ( $v['title'] ?? '' ) . ' ' .
                ( $v['category'] ?? '' ) . ' ' .
                ( $v['division'] ?? '' ) . ' ' .
                implode( ' ', (array) ( $v['tags'] ?? array() ) )
            );
            return false !== strpos( $haystack, $search_lower );
        } );
    }

    // Sort.
    $videos = array_values( $videos );
    switch ( $sort ) {
        case 'title':
            usort( $videos, function ( $a, $b ) {
                return strcasecmp( $a['title'] ?? '', $b['title'] ?? '' );
            } );
            break;
        case 'duration':
            usort( $videos, function ( $a, $b ) {
                return ( $a['duration'] ?? 0 ) - ( $b['duration'] ?? 0 );
            } );
            break;
        case 'newest':
            $videos = array_reverse( $videos );
            break;
        // 'relevance' — default order (search-match weighted or registry order).
    }

    $total = count( $videos );
    $pages = max( 1, ceil( $total / $per_page ) );
    $offset = ( $page - 1 ) * $per_page;
    $paged  = array_slice( $videos, $offset, $per_page );

    // Normalize output for the JS grid.
    $output = array();
    foreach ( $paged as $v ) {
        $output[] = mmed_inserter_normalize_video( $v );
    }

    wp_send_json_success( array(
        'videos'  => $output,
        'total'   => $total,
        'page'    => $page,
        'pages'   => $pages,
        'hasMore' => $page < $pages,
    ) );
}
add_action( 'wp_ajax_mmed_inserter_load_videos', 'mmed_ajax_inserter_load_videos' );

/**
 * AJAX handler: Return single video details for preview panel.
 */
function mmed_ajax_inserter_video_detail() {
    check_ajax_referer( 'mmed_video_inserter', 'nonce' );

    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    $video_id = sanitize_text_field( $_POST['video_id'] ?? '' );
    if ( empty( $video_id ) ) {
        wp_send_json_error( 'Missing video ID', 400 );
    }

    $all = mmed_inserter_get_all_videos();
    $video = null;
    foreach ( $all as $v ) {
        if ( sanitize_title( $v['id'] ?? '' ) === sanitize_title( $video_id ) ) {
            $video = $v;
            break;
        }
    }

    if ( ! $video ) {
        wp_send_json_error( 'Video not found', 404 );
    }

    $detail = mmed_inserter_normalize_video( $video );

    // Find lessons using this video.
    $used_in = mmed_inserter_find_usage( $video_id );
    $detail['used_in'] = $used_in;

    wp_send_json_success( $detail );
}
add_action( 'wp_ajax_mmed_inserter_video_detail', 'mmed_ajax_inserter_video_detail' );

/* ── Data Helpers ──────────────────────────────────────────────────── */

/**
 * Load all videos from the manifest file.
 *
 * Uses a static cache to avoid repeated file reads within the same request.
 *
 * @return array Array of raw video entries.
 */
function mmed_inserter_get_all_videos() {
    static $cached = null;

    if ( null !== $cached ) {
        return $cached;
    }

    $cached = array();

    // Use the resolver's manifest path detection.
    if ( function_exists( 'mmed_get_manifest_path' ) ) {
        $path = mmed_get_manifest_path();
    } else {
        // Fallback: look relative to plugin root.
        $path = realpath( dirname( __DIR__ ) . '/../../VIDEO_SYSTEM/exports/video_manifest.json' );
    }

    if ( ! $path || ! file_exists( $path ) ) {
        return $cached;
    }

    $raw = file_get_contents( $path );
    if ( ! $raw ) {
        return $cached;
    }

    $data = json_decode( $raw, true );
    if ( ! is_array( $data ) || empty( $data['videos'] ) ) {
        return $cached;
    }

    $cached = $data['videos'];
    return $cached;
}

/**
 * Normalize a raw manifest video entry for inserter UI consumption.
 *
 * @param array $video Raw manifest entry.
 * @return array Normalized entry.
 */
function mmed_inserter_normalize_video( $video ) {
    $id       = sanitize_title( $video['id'] ?? '' );
    $duration = floatval( $video['duration'] ?? 0 );
    $has_cdn  = ! empty( $video['playback_url'] ) || ! empty( $video['cloud_video_path'] );

    return array(
        'id'             => $id,
        'title'          => sanitize_text_field( $video['title'] ?? 'Untitled Video' ),
        'thumbnail'      => esc_url_raw( $video['thumbnail_url'] ?? ( $video['thumbnail'] ?? '' ) ),
        'duration'       => $duration,
        'duration_label' => mmed_inserter_format_duration( $duration ),
        'category'       => sanitize_text_field( $video['category'] ?? '' ),
        'division'       => sanitize_text_field( $video['division'] ?? '' ),
        'tags'           => array_map( 'sanitize_text_field', (array) ( $video['tags'] ?? array() ) ),
        'cdn_status'     => $has_cdn ? 'published' : 'local',
        'shortcode'      => '[mmi_video id="' . $id . '"]',
    );
}

/**
 * Format seconds into M:SS or H:MM:SS.
 *
 * @param float $seconds Duration in seconds.
 * @return string Formatted duration.
 */
function mmed_inserter_format_duration( $seconds ) {
    $seconds = max( 0, intval( $seconds ) );
    if ( $seconds <= 0 ) {
        return '';
    }

    $h = floor( $seconds / 3600 );
    $m = floor( ( $seconds % 3600 ) / 60 );
    $s = $seconds % 60;

    return $h > 0
        ? sprintf( '%d:%02d:%02d', $h, $m, $s )
        : sprintf( '%d:%02d', $m, $s );
}

/**
 * Find lessons that use a given video ID.
 *
 * @param string $video_id Sanitized video ID.
 * @return array Array of { lesson_id, title, edit_url }.
 */
function mmed_inserter_find_usage( $video_id ) {
    global $wpdb;

    // Search post_content for shortcodes containing this video ID.
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $results = $wpdb->get_results( $wpdb->prepare(
        "SELECT ID, post_title FROM {$wpdb->posts}
         WHERE post_status IN ('publish','draft','pending')
         AND post_type IN ('sfwd-lessons','sfwd-topic','sfwd-courses')
         AND post_content LIKE %s
         LIMIT 20",
        '%' . $wpdb->esc_like( $video_id ) . '%'
    ) );

    $used = array();
    if ( $results ) {
        foreach ( $results as $row ) {
            $used[] = array(
                'lesson_id' => $row->ID,
                'title'     => $row->post_title,
                'edit_url'  => get_edit_post_link( $row->ID, 'raw' ),
            );
        }
    }

    return $used;
}

/**
 * Get available divisions from the manifest.
 *
 * @return array Unique division slugs.
 */
function mmed_get_available_divisions() {
    $videos    = mmed_inserter_get_all_videos();
    $divisions = array();

    foreach ( $videos as $v ) {
        $d = sanitize_text_field( $v['division'] ?? '' );
        if ( $d && ! in_array( $d, $divisions, true ) ) {
            $divisions[] = $d;
        }
    }

    sort( $divisions );
    return $divisions;
}

/**
 * Get available categories from the manifest.
 *
 * @return array Unique category names.
 */
function mmed_get_available_categories() {
    $videos     = mmed_inserter_get_all_videos();
    $categories = array();

    foreach ( $videos as $v ) {
        $c = sanitize_text_field( $v['category'] ?? '' );
        if ( $c && ! in_array( $c, $categories, true ) ) {
            $categories[] = $c;
        }
    }

    sort( $categories );
    return $categories;
}
