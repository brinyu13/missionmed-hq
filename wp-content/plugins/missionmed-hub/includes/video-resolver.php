<?php
/**
 * MissionMed Video Resolver — 4-Tier Resolution Chain
 *
 * Resolution priority:
 *   1. WordPress transient cache  (fastest — avoids disk/DB entirely)
 *   2. Post meta on current lesson (local DB, already stored)
 *   3. video_manifest.json         (canonical file-system source)
 *   4. Fallback placeholder        (graceful degradation)
 *
 * @package MissionMed_Hub
 * @since   1.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ── Configuration ──────────────────────────────────────────────── */

/** Transient TTL in seconds (4 hours). */
define( 'MMED_VIDEO_CACHE_TTL', 4 * HOUR_IN_SECONDS );

/** Transient key prefix. */
define( 'MMED_VIDEO_CACHE_PREFIX', 'mmed_vid_' );

if ( ! function_exists( 'mmed_video_log' ) ) {
    /**
     * Centralized logger for the MissionMed video subsystem.
     *
     * @param string $message Human-readable log message.
     * @param string $level   Log level.
     * @param array  $context Optional scalar context.
     * @return void
     */
    function mmed_video_log( $message, $level = 'info', $context = array() ) {
        if ( ! is_string( $message ) || '' === trim( $message ) ) {
            return;
        }

        $context = is_array( $context ) ? $context : array( 'value' => $context );

        /**
         * Fires whenever the video subsystem emits a log event.
         *
         * @param string $level   Log level.
         * @param string $message Log message.
         * @param array  $context Structured context.
         */
        do_action( 'mmed_video_log', $level, $message, $context );

        $should_log = (bool) apply_filters(
            'mmed_video_logging_enabled',
            defined( 'WP_DEBUG' ) && WP_DEBUG,
            $level,
            $message,
            $context
        );

        if ( ! $should_log ) {
            return;
        }

        $suffix = '';
        if ( ! empty( $context ) ) {
            $suffix = ' ' . wp_json_encode( $context );
        }

        error_log(
            sprintf(
                '[MissionMed Video][%s] %s%s',
                strtoupper( sanitize_key( $level ) ?: 'info' ),
                $message,
                $suffix
            )
        );
    }
}

if ( ! function_exists( 'mmed_get_manifest_candidate_paths' ) ) {
    /**
     * Build the list of filesystem candidates for the manifest file.
     *
     * The source tree lives at `/MissionMed/missionmed-hub`, while mirrored
     * deploy copies may live under `/MissionMed/wp-content/plugins/missionmed-hub`.
     * Walking upward keeps both layouts working without hard-coded depth.
     *
     * @return array
     */
    function mmed_get_manifest_candidate_paths() {
        $candidates = array();
        $current    = untrailingslashit( MMED_HUB_PATH );

        for ( $depth = 0; $depth < 5; $depth++ ) {
            $candidates[] = $current . '/VIDEO_SYSTEM/exports/video_manifest.json';

            $parent = dirname( $current );
            if ( $parent === $current ) {
                break;
            }

            $current = $parent;
        }

        $upload_dir = wp_upload_dir();
        if ( ! empty( $upload_dir['basedir'] ) ) {
            $candidates[] = trailingslashit( $upload_dir['basedir'] ) . 'missionmed/video_manifest.json';
        }

        return array_values( array_unique( array_filter( $candidates ) ) );
    }
}

/* ── Public API ─────────────────────────────────────────────────── */

/**
 * Resolve a video by ID through the 4-tier resolution chain.
 *
 * Returns a normalized associative array or null on complete failure.
 *
 * @param string $video_id Canonical video identifier (e.g. "mr_soliloquy_001").
 * @return array|null {
 *     @type string $id              Video ID.
 *     @type string $title           Display title.
 *     @type string $playback_url    Resolved playback URL (CDN, direct file, or embed).
 *     @type string $thumbnail       Poster/thumbnail URL.
 *     @type string $duration_label  Human-readable duration ("12:34").
 *     @type string $category_label  Category label.
 *     @type string $division        Division slug.
 *     @type float  $duration        Duration in seconds.
 * }
 */
function mmed_resolve_video( $video_id ) {
    $video_id = sanitize_title( $video_id );

    if ( empty( $video_id ) ) {
        return null;
    }

    /* ── Tier 1: Transient cache ─────────────────────────────── */
    $cached = get_transient( MMED_VIDEO_CACHE_PREFIX . $video_id );
    if ( is_array( $cached ) && ! empty( $cached['playback_url'] ) ) {
        return $cached;
    }

    /* ── Tier 2: Current post meta ───────────────────────────── */
    $post_id = get_the_ID();
    if ( $post_id ) {
        $meta_video = get_post_meta( $post_id, 'mmed_video_data_' . $video_id, true );
        if ( is_array( $meta_video ) && ! empty( $meta_video['playback_url'] ) ) {
            // Re-cache into transient for next hit.
            mmed_cache_video( $video_id, $meta_video );
            return $meta_video;
        }
    }

    /* ── Tier 3: Manifest file ───────────────────────────────── */
    $manifest_entry = mmed_resolve_from_manifest( $video_id );
    if ( is_array( $manifest_entry ) && ! empty( $manifest_entry['playback_url'] ) ) {
        // Normalize and cache.
        $normalized = mmed_normalize_video_entry( $manifest_entry );
        mmed_cache_video( $video_id, $normalized );
        return $normalized;
    }

    /* ── Tier 4: Fallback (no valid URL) ─────────────────────── */
    return null;
}

/**
 * Resolve a single video from the manifest JSON.
 *
 * Uses a static in-memory lookup to avoid repeated file reads within
 * the same PHP request.
 *
 * @param string $video_id Sanitized video ID.
 * @return array|null Raw manifest entry or null.
 */
function mmed_resolve_from_manifest( $video_id ) {
    static $lookup = null;
    static $json_error_logged = false;

    if ( null === $lookup ) {
        $lookup = array();

        $manifest_path = mmed_get_manifest_path();
        if ( $manifest_path && file_exists( $manifest_path ) ) {
            $raw = file_get_contents( $manifest_path );
            if ( $raw ) {
                $data   = json_decode( $raw, true );
                if ( null === $data && JSON_ERROR_NONE !== json_last_error() && ! $json_error_logged ) {
                    mmed_video_log(
                        'Video manifest JSON could not be decoded.',
                        'warning',
                        array(
                            'path'       => $manifest_path,
                            'json_error' => json_last_error_msg(),
                        )
                    );
                    $json_error_logged = true;
                }
                $videos = $data['videos'] ?? array();
                foreach ( $videos as $video ) {
                    if ( ! empty( $video['id'] ) ) {
                        $lookup[ sanitize_title( $video['id'] ) ] = $video;
                    }
                }
            }
        }
    }

    return $lookup[ $video_id ] ?? null;
}

/**
 * Determine the absolute path to the video manifest.
 *
 * @return string|false Absolute path or false.
 */
function mmed_get_manifest_path() {
    static $missing_logged = false;

    // Option 1: Constant override (for custom deployments).
    if ( defined( 'MMED_VIDEO_MANIFEST_PATH' ) && file_exists( MMED_VIDEO_MANIFEST_PATH ) && is_readable( MMED_VIDEO_MANIFEST_PATH ) ) {
        return MMED_VIDEO_MANIFEST_PATH;
    }

    // Option 2: Walk upward from the plugin directory and look for VIDEO_SYSTEM.
    foreach ( mmed_get_manifest_candidate_paths() as $candidate ) {
        $resolved = realpath( $candidate );
        if ( $resolved && file_exists( $resolved ) && is_readable( $resolved ) ) {
            return $resolved;
        }

        if ( file_exists( $candidate ) && is_readable( $candidate ) ) {
            return $candidate;
        }
    }

    if ( ! $missing_logged ) {
        mmed_video_log(
            'Video manifest could not be located from any known path.',
            'warning',
            array(
                'plugin_path' => MMED_HUB_PATH,
                'candidates'  => mmed_get_manifest_candidate_paths(),
            )
        );
        $missing_logged = true;
    }

    return false;
}

/* ── Caching helpers ────────────────────────────────────────────── */

/**
 * Write a resolved video entry into the transient cache.
 *
 * @param string $video_id   Sanitized video ID.
 * @param array  $video_data Normalized video data.
 */
function mmed_cache_video( $video_id, $video_data ) {
    set_transient( MMED_VIDEO_CACHE_PREFIX . $video_id, $video_data, MMED_VIDEO_CACHE_TTL );
}

/**
 * Flush cached data for a single video.
 *
 * @param string $video_id Video ID.
 */
function mmed_flush_video_cache( $video_id ) {
    delete_transient( MMED_VIDEO_CACHE_PREFIX . sanitize_title( $video_id ) );
}

/**
 * Flush ALL mmed video transient caches.
 *
 * Useful after a manifest re-publish.  Hooked to a WP-CLI command
 * or admin action when needed.
 */
function mmed_flush_all_video_caches() {
    global $wpdb;

    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            '_transient_' . MMED_VIDEO_CACHE_PREFIX . '%'
        )
    );

    // Clean timeout entries too.
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            '_transient_timeout_' . MMED_VIDEO_CACHE_PREFIX . '%'
        )
    );
}

/* ── Normalization ──────────────────────────────────────────────── */

/**
 * Normalize a raw manifest entry into the canonical video data shape.
 *
 * @param array $entry Raw manifest video entry.
 * @return array Normalized video data.
 */
function mmed_normalize_video_entry( $entry ) {
    $duration_secs = floatval( $entry['duration'] ?? 0 );

    return array(
        'id'             => sanitize_title( $entry['id'] ?? '' ),
        'title'          => sanitize_text_field( $entry['title'] ?? 'MissionMed Video' ),
        'playback_url'   => esc_url_raw( $entry['playback_url'] ?? '' ),
        'thumbnail'      => esc_url_raw( $entry['thumbnail_url'] ?? ( $entry['thumbnail'] ?? '' ) ),
        'duration_label' => mmed_format_duration( $duration_secs ),
        'duration'       => $duration_secs,
        'category_label' => sanitize_text_field( $entry['category'] ?? '' ),
        'division'       => sanitize_title( $entry['division'] ?? '' ),
    );
}

/**
 * Format seconds into a human-readable duration string (H:MM:SS or M:SS).
 *
 * @param float|int $seconds Duration in seconds.
 * @return string
 */
function mmed_format_duration( $seconds ) {
    $seconds = max( 0, intval( $seconds ) );

    if ( $seconds <= 0 ) {
        return '';
    }

    $hours   = floor( $seconds / 3600 );
    $minutes = floor( ( $seconds % 3600 ) / 60 );
    $secs    = $seconds % 60;

    if ( $hours > 0 ) {
        return sprintf( '%d:%02d:%02d', $hours, $minutes, $secs );
    }

    return sprintf( '%d:%02d', $minutes, $secs );
}

/* ── Validation ─────────────────────────────────────────────────── */

/**
 * Check whether a URL points to a directly-playable media file.
 *
 * @param string $url Media URL.
 * @return bool
 */
function mmed_is_direct_video_url( $url ) {
    if ( ! is_string( $url ) || '' === $url ) {
        return false;
    }

    $path = wp_parse_url( $url, PHP_URL_PATH );
    if ( ! is_string( $path ) || '' === $path ) {
        $path = $url;
    }

    return (bool) preg_match( '/\.(mp4|m4v|mov|webm|ogg)$/i', $path );
}
