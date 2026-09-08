<?php
/**
 * MissionMed Video Shortcode System
 *
 * Registers and handles video shortcodes for LearnDash integration:
 *   [mmi_video id="VIDEO_ID"]           — New primary shortcode (LDV-008)
 *   [mm_video id="VIDEO_ID"]            — Backward-compatible alias
 *   [mmed_video id="VIDEO_ID"]          — Backward-compatible alias
 *
 * Extended attributes:
 *   [mmi_video id="VIDEO_ID" size="compact" title="false" autoplay="false" resume="true"]
 *
 * Orchestrates: video-resolver.php (resolution) + video-player.php (rendering)
 *
 * @package MissionMed_Hub
 * @since   1.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ── Shortcode Registration ─────────────────────────────────────── */

/**
 * Register all MissionMed video shortcodes.
 *
 * Called on `init` at priority 10 so shortcodes are available for
 * LearnDash lesson rendering and the block editor preview.
 */
function mmed_register_video_shortcodes() {
    static $registered = false;

    if ( $registered ) {
        return;
    }

    $shortcode_tags = array( 'mmi_video', 'mm_video', 'mmed_video' );

    foreach ( $shortcode_tags as $shortcode_tag ) {
        if (
            shortcode_exists( $shortcode_tag ) &&
            isset( $GLOBALS['shortcode_tags'][ $shortcode_tag ] ) &&
            'mmed_video_shortcode_handler' !== $GLOBALS['shortcode_tags'][ $shortcode_tag ]
        ) {
            mmed_video_log(
                'Overriding an existing shortcode registration with the MissionMed video handler.',
                'warning',
                array( 'tag' => $shortcode_tag )
            );
        }

        add_shortcode( $shortcode_tag, 'mmed_video_shortcode_handler' );
    }

    $registered = true;

    mmed_video_log(
        'MissionMed video shortcodes registered.',
        'debug',
        array( 'tags' => $shortcode_tags )
    );
}
add_action( 'init', 'mmed_register_video_shortcodes', 10 );

// Register on file load as a fallback for custom bootstraps that may include this module late.
if ( function_exists( 'add_shortcode' ) ) {
    mmed_register_video_shortcodes();
}

/**
 * Render MissionMed video shortcodes inside builder-generated widget content.
 *
 * Elementor HTML widgets can bypass the standard post-content shortcode flow,
 * which leaves raw `[mmi_video]` text visible even when the shortcode exists.
 *
 * @param string $content Widget content.
 * @return string
 */
function mmed_render_video_shortcodes_in_widget_content( $content ) {
    if ( ! is_string( $content ) || '' === $content ) {
        return $content;
    }

    if (
        false === strpos( $content, '[mmi_video' ) &&
        false === strpos( $content, '[mm_video' ) &&
        false === strpos( $content, '[mmed_video' )
    ) {
        return $content;
    }

    mmed_register_video_shortcodes();

    return do_shortcode( shortcode_unautop( $content ) );
}
add_filter( 'elementor/widget/render_content', 'mmed_render_video_shortcodes_in_widget_content', 20 );

/* ── Shortcode Handler ──────────────────────────────────────────── */

/**
 * Unified shortcode handler for all MissionMed video shortcode tags.
 *
 * Flow:
 *   1. Parse & sanitize attributes
 *   2. Validate video_id
 *   3. Resolve video via 4-tier chain (video-resolver.php)
 *   4. Render player output (video-player.php)
 *   5. Append lazy-load/resume script (once per page)
 *
 * @param array  $atts    Shortcode attributes.
 * @param string $content Shortcode inner content (unused).
 * @param string $tag     Which shortcode tag was used.
 * @return string HTML output.
 */
function mmed_video_shortcode_handler( $atts, $content = '', $tag = '' ) {
    $atts = shortcode_atts(
        array(
            'id'       => '',
            'size'     => 'standard',
            'lazy'     => 'true',
            'title'    => 'true',
            'autoplay' => 'false',
            'resume'   => 'true',
        ),
        (array) $atts,
        $tag ? $tag : 'mmi_video'
    );

    // Sanitize the video ID.
    $video_id = mmed_sanitize_video_id( $atts['id'] );

    if ( empty( $video_id ) ) {
        return mmed_render_video_error(
            'No video specified.',
            ''
        );
    }

    // Resolve video through 4-tier chain.
    $video_data = mmed_resolve_video( $video_id );

    if ( ! $video_data || empty( $video_data['playback_url'] ) ) {
        return mmed_render_video_error(
            'This video is temporarily unavailable.',
            $video_id
        );
    }

    // Build render options from shortcode attributes.
    $options = array(
        'size'     => mmed_sanitize_size( $atts['size'] ),
        'lazy'     => mmed_atts_bool( $atts['lazy'] ),
        'title'    => mmed_atts_bool( $atts['title'] ),
        'autoplay' => mmed_atts_bool( $atts['autoplay'] ),
        'resume'   => mmed_atts_bool( $atts['resume'] ),
    );

    // Render.
    $output  = mmed_render_video_player( $video_data, $options );
    $output .= mmed_player_inline_script();

    return $output;
}

/* ── Lesson Meta Sync ───────────────────────────────────────────── */

/**
 * On lesson save, extract all MissionMed video IDs from the content
 * and persist them as an ordered array in post meta.
 *
 * This powers:
 *   - Hub progress tracking (which videos in which lesson)
 *   - Admin video audit (find lessons using a given video)
 *   - Tier 2 resolver (post meta → video data)
 *
 * @param int     $post_id Post ID.
 * @param WP_Post $post    Post object.
 */
function mmed_sync_lesson_video_meta( $post_id, $post ) {
    // Only process LearnDash lessons and topics.
    $allowed_types = array( 'sfwd-lessons', 'sfwd-topic', 'sfwd-courses' );
    if ( ! in_array( $post->post_type, $allowed_types, true ) ) {
        return;
    }

    // Skip revisions and autosaves.
    if ( wp_is_post_revision( $post_id ) || ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) ) {
        return;
    }

    // Extract all video IDs from shortcodes in the content.
    $video_ids = mmed_extract_video_ids( $post->post_content );

    if ( ! empty( $video_ids ) ) {
        update_post_meta( $post_id, 'mmed_video_ids', $video_ids );

        // Also cache individual video data into post meta for Tier 2 resolver.
        foreach ( $video_ids as $vid ) {
            $resolved = mmed_resolve_from_manifest( $vid );
            if ( $resolved ) {
                $normalized = mmed_normalize_video_entry( $resolved );
                update_post_meta( $post_id, 'mmed_video_data_' . $vid, $normalized );
            }
        }
    } else {
        delete_post_meta( $post_id, 'mmed_video_ids' );
    }
}
add_action( 'save_post', 'mmed_sync_lesson_video_meta', 20, 2 );

/**
 * Extract ordered unique video IDs from post content shortcodes.
 *
 * @param string $content Post content.
 * @return array Ordered array of sanitized video IDs.
 */
function mmed_extract_video_ids( $content ) {
    if ( ! is_string( $content ) || '' === $content ) {
        return array();
    }

    $pattern = get_shortcode_regex( array( 'mmi_video', 'mm_video', 'mmed_video' ) );
    if ( ! preg_match_all( '/' . $pattern . '/', $content, $matches, PREG_SET_ORDER ) ) {
        return array();
    }

    $ids = array();
    foreach ( $matches as $match ) {
        if ( empty( $match[3] ) ) {
            continue;
        }

        $parsed = shortcode_parse_atts( $match[3] );
        if ( empty( $parsed['id'] ) ) {
            continue;
        }

        $vid = mmed_sanitize_video_id( $parsed['id'] );
        if ( $vid && ! in_array( $vid, $ids, true ) ) {
            $ids[] = $vid;
        }
    }

    return $ids;
}

/* ── AJAX: Save Video Progress ──────────────────────────────────── */

/**
 * Save the current watch position for a video.
 *
 * Called via sendBeacon from the frontend player script.
 */
function mmed_ajax_save_video_progress() {
    check_ajax_referer( 'mmed_video_progress', 'nonce' );

    if ( ! is_user_logged_in() ) {
        wp_send_json_error( 'Not logged in', 401 );
    }

    $user_id   = get_current_user_id();
    $video_id  = mmed_sanitize_video_id( $_POST['video_id'] ?? '' );
    $lesson_id = absint( $_POST['lesson_id'] ?? 0 );
    $position  = floatval( $_POST['position'] ?? 0 );
    $duration  = floatval( $_POST['duration'] ?? 0 );

    if ( empty( $video_id ) ) {
        wp_send_json_error( 'Invalid video ID', 400 );
    }

    $progress = array(
        'position'   => $position,
        'duration'   => $duration,
        'lesson_id'  => $lesson_id,
        'updated_at' => current_time( 'mysql' ),
    );

    update_user_meta( $user_id, 'mmed_video_progress_' . $video_id, $progress );

    // If watched >= 90%, consider complete.
    if ( $duration > 0 && ( $position / $duration ) >= 0.90 ) {
        update_user_meta( $user_id, 'mmed_video_complete_' . $video_id, array(
            'completed_at' => current_time( 'mysql' ),
            'lesson_id'    => $lesson_id,
        ) );
    }

    wp_send_json_success();
}
add_action( 'wp_ajax_mmed_save_video_progress', 'mmed_ajax_save_video_progress' );

/**
 * Enqueue the AJAX config for the progress heartbeat on frontend.
 *
 * Only loads on singular LearnDash lesson / topic pages.
 */
function mmed_enqueue_video_progress_ajax() {
    if ( ! is_singular( array( 'sfwd-lessons', 'sfwd-topic', 'sfwd-courses' ) ) ) {
        return;
    }

    $handle = 'mmed-video-progress-bootstrap';

    if ( ! wp_script_is( $handle, 'registered' ) ) {
        wp_register_script( $handle, '', array(), MMED_HUB_VERSION, true );
    }

    wp_enqueue_script( $handle );

    wp_add_inline_script(
        $handle,
        'window.mmedVideoAjax = ' . wp_json_encode( array(
            'ajaxurl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'mmed_video_progress' ),
        ) ) . ';',
        'before'
    );
}
add_action( 'wp_enqueue_scripts', 'mmed_enqueue_video_progress_ajax' );

/* ── Sanitization Helpers ───────────────────────────────────────── */

/**
 * Sanitize a video ID — allows alphanumeric, hyphens, underscores only.
 *
 * @param string $id Raw video ID.
 * @return string Sanitized video ID.
 */
function mmed_sanitize_video_id( $id ) {
    $id = trim( (string) $id );

    // Remove anything that isn't alphanumeric, hyphen, or underscore.
    $id = preg_replace( '/[^a-zA-Z0-9_-]/', '', $id );

    return strtolower( $id );
}

/**
 * Sanitize the size attribute to an allowed value.
 *
 * @param string $size Raw size value.
 * @return string Validated size.
 */
function mmed_sanitize_size( $size ) {
    $allowed = array( 'standard', 'compact', 'small' );
    $size    = strtolower( trim( $size ) );

    return in_array( $size, $allowed, true ) ? $size : 'standard';
}

/**
 * Parse a shortcode boolean attribute ("true"/"false"/1/0).
 *
 * @param mixed $value Attribute value.
 * @return bool
 */
function mmed_atts_bool( $value ) {
    if ( is_bool( $value ) ) {
        return $value;
    }
    $value = strtolower( trim( (string) $value ) );
    return in_array( $value, array( 'true', '1', 'yes' ), true );
}

/* ── Cache Flush on Manifest Update ─────────────────────────────── */

/**
 * Provide a WP-CLI command to flush all video caches after a
 * manifest re-publish.
 *
 * Usage: wp mmed flush-video-cache
 */
function mmed_register_cli_commands() {
    if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
        return;
    }

    WP_CLI::add_command( 'mmed flush-video-cache', function () {
        mmed_flush_all_video_caches();
        WP_CLI::success( 'All MissionMed video caches flushed.' );
    } );
}
add_action( 'cli_init', 'mmed_register_cli_commands' );
