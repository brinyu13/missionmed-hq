<?php
/**
 * MissionMed Hub Video Dashboard — Student-Facing Video Aggregation
 *
 * Provides the "Continue Watching" and video progress aggregation
 * system for the MissionMed Member Dashboard (Hub). Implements
 * LDV-007 §2.4 course-level video management and student resume.
 *
 * Features:
 *   - Continue Watching: ordered by last-watched timestamp
 *   - Resume: picks up from exact position via user meta
 *   - Course Aggregation: video map per course/lesson
 *   - Progress Stats: watch percentage, completed count
 *
 * Integration points:
 *   - video-resolver.php  → manifest lookup for video metadata
 *   - video-player.php    → render player output (reused, no duplication)
 *   - video-shortcode.php → progress save (AJAX heartbeat already exists)
 *   - class-mmed-hub-page.php → Hub page rendering
 *
 * @package MissionMed_Hub
 * @since   1.6.3
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ── Constants ─────────────────────────────────────────────────── */

/** Maximum videos in the "Continue Watching" row. */
if ( ! defined( 'MMED_CONTINUE_WATCHING_LIMIT' ) ) {
    define( 'MMED_CONTINUE_WATCHING_LIMIT', 8 );
}

/* ── Public API ────────────────────────────────────────────────── */

/**
 * Render the Continue Watching section for the current user.
 *
 * Returns HTML for the Hub dashboard. Shows videos the student has
 * partially watched (position > 0, not completed), ordered by most
 * recently watched.
 *
 * @param int|null $user_id Optional user ID (defaults to current user).
 * @return string HTML output.
 */
function mmed_render_continue_watching( $user_id = null ) {
    if ( ! $user_id ) {
        $user_id = get_current_user_id();
    }

    if ( ! $user_id ) {
        return '';
    }

    $in_progress = mmed_get_user_video_progress( $user_id );

    if ( empty( $in_progress ) ) {
        return '';
    }

    // Sort by most recently watched.
    usort( $in_progress, function( $a, $b ) {
        return strtotime( $b['updated_at'] ?? '1970-01-01' ) - strtotime( $a['updated_at'] ?? '1970-01-01' );
    });

    // Limit to configured max.
    $in_progress = array_slice( $in_progress, 0, MMED_CONTINUE_WATCHING_LIMIT );

    // Build output.
    $style_html = mmed_dashboard_inline_styles();

    $html  = $style_html;
    $html .= '<div class="mmed-continue-watching">';
    $html .= '<div class="mmed-cw-header">';
    $html .= '<h3 class="mmed-cw-title">Continue Watching</h3>';
    $html .= '<span class="mmed-cw-count">' . count( $in_progress ) . ' in progress</span>';
    $html .= '</div>';
    $html .= '<div class="mmed-cw-grid">';

    foreach ( $in_progress as $item ) {
        $html .= mmed_render_cw_card( $item );
    }

    $html .= '</div>';
    $html .= '</div>';

    return $html;
}

/**
 * Render the full video dashboard for a course.
 *
 * Shows all videos across lessons in a course with CDN status,
 * engagement stats, and quick actions.
 *
 * @param int      $course_id Course post ID.
 * @param int|null $user_id   Optional user ID.
 * @return string HTML output.
 */
function mmed_render_course_video_dashboard( $course_id, $user_id = null ) {
    if ( ! $user_id ) {
        $user_id = get_current_user_id();
    }

    $lessons = mmed_get_course_lesson_videos( $course_id );

    if ( empty( $lessons ) ) {
        return '<div class="mmed-vd-empty">'
             . '<p>No videos have been assigned to lessons in this course yet.</p>'
             . '</div>';
    }

    $style_html = mmed_dashboard_inline_styles();
    $user_progress = $user_id ? mmed_get_user_video_progress( $user_id ) : array();
    $progress_map  = array();
    foreach ( $user_progress as $p ) {
        $progress_map[ $p['video_id'] ] = $p;
    }

    $total_videos    = 0;
    $completed_count = 0;

    $html  = $style_html;
    $html .= '<div class="mmed-video-dashboard">';
    $html .= '<div class="mmed-vd-header">';
    $html .= '<h3 class="mmed-vd-title">Course Videos</h3>';
    $html .= '</div>';
    $html .= '<div class="mmed-vd-table-wrap">';
    $html .= '<table class="mmed-vd-table">';
    $html .= '<thead><tr>';
    $html .= '<th>Lesson</th>';
    $html .= '<th>Video</th>';
    $html .= '<th>Duration</th>';
    $html .= '<th>Progress</th>';
    $html .= '<th>Status</th>';
    $html .= '</tr></thead>';
    $html .= '<tbody>';

    foreach ( $lessons as $lesson ) {
        if ( empty( $lesson['videos'] ) ) {
            $html .= '<tr class="mmed-vd-row mmed-vd-row--empty">';
            $html .= '<td>' . esc_html( $lesson['title'] ) . '</td>';
            $html .= '<td colspan="4" class="mmed-vd-no-video">No video assigned</td>';
            $html .= '</tr>';
            continue;
        }

        foreach ( $lesson['videos'] as $idx => $video ) {
            $total_videos++;
            $vid = $video['id'] ?? '';
            $prog = $progress_map[ $vid ] ?? null;

            $watch_pct = 0;
            $is_complete = false;
            if ( $prog ) {
                $dur = floatval( $prog['duration'] ?? $video['duration'] ?? 0 );
                $pos = floatval( $prog['position'] ?? 0 );
                if ( $dur > 0 ) {
                    $watch_pct = min( 100, round( ( $pos / $dur ) * 100 ) );
                }
                $is_complete = $watch_pct >= 90;
                if ( $is_complete ) {
                    $completed_count++;
                }
            }

            $has_cdn = ! empty( $video['playback_url'] ) || ! empty( $video['cloud_video_path'] );
            $cdn_class = $has_cdn ? 'mmed-cdn-dot--green' : 'mmed-cdn-dot--orange';

            $html .= '<tr class="mmed-vd-row">';

            // Lesson cell (only on first video per lesson).
            if ( $idx === 0 ) {
                $rowspan = count( $lesson['videos'] );
                $html .= '<td' . ( $rowspan > 1 ? ' rowspan="' . $rowspan . '"' : '' ) . '>';
                $html .= esc_html( $lesson['title'] );
                $html .= '</td>';
            }

            // Video cell.
            $html .= '<td>';
            $html .= '<div class="mmed-vd-video-cell">';
            if ( ! empty( $video['thumbnail'] ) ) {
                $html .= '<img class="mmed-vd-thumb" src="' . esc_url( $video['thumbnail'] ) . '" alt="" loading="lazy" />';
            }
            $html .= '<span class="mmed-vd-video-title">' . esc_html( $video['title'] ?? 'Untitled' ) . '</span>';
            $html .= '</div>';
            $html .= '</td>';

            // Duration.
            $html .= '<td>' . esc_html( $video['duration_label'] ?? '' ) . '</td>';

            // Progress.
            $html .= '<td>';
            if ( $is_complete ) {
                $html .= '<span class="mmed-vd-complete-badge">Complete</span>';
            } elseif ( $watch_pct > 0 ) {
                $html .= '<div class="mmed-vd-progress-bar">';
                $html .= '<div class="mmed-vd-progress-fill" style="width:' . $watch_pct . '%"></div>';
                $html .= '</div>';
                $html .= '<span class="mmed-vd-progress-label">' . $watch_pct . '%</span>';
            } else {
                $html .= '<span class="mmed-vd-not-started">Not started</span>';
            }
            $html .= '</td>';

            // CDN status.
            $html .= '<td><span class="mmed-cdn-dot ' . $cdn_class . '"></span></td>';

            $html .= '</tr>';
        }
    }

    $html .= '</tbody></table>';
    $html .= '</div>';

    // Summary stats.
    $html .= '<div class="mmed-vd-summary">';
    $html .= '<span>' . $total_videos . ' videos</span>';
    $html .= '<span>' . $completed_count . ' / ' . $total_videos . ' watched</span>';
    if ( $total_videos > 0 ) {
        $pct = round( ( $completed_count / $total_videos ) * 100 );
        $html .= '<span>' . $pct . '% complete</span>';
    }
    $html .= '</div>';

    $html .= '</div>';

    return $html;
}

/**
 * Get aggregated video stats for a user.
 *
 * @param int $user_id WordPress user ID.
 * @return array {
 *     @type int   $total_watched      Number of unique videos watched.
 *     @type int   $total_completed    Number of videos watched >= 90%.
 *     @type float $total_watch_time   Total seconds watched across all videos.
 *     @type array $recent             Last 5 videos watched (for quick display).
 * }
 */
function mmed_get_user_video_stats( $user_id ) {
    $progress = mmed_get_user_video_progress( $user_id );

    $total_watched    = count( $progress );
    $total_completed  = 0;
    $total_watch_time = 0;

    foreach ( $progress as $p ) {
        $total_watch_time += floatval( $p['position'] ?? 0 );

        $dur = floatval( $p['duration'] ?? 0 );
        $pos = floatval( $p['position'] ?? 0 );
        if ( $dur > 0 && ( $pos / $dur ) >= 0.90 ) {
            $total_completed++;
        }
    }

    // Sort by most recent.
    usort( $progress, function( $a, $b ) {
        return strtotime( $b['updated_at'] ?? '1970-01-01' ) - strtotime( $a['updated_at'] ?? '1970-01-01' );
    });

    return array(
        'total_watched'    => $total_watched,
        'total_completed'  => $total_completed,
        'total_watch_time' => $total_watch_time,
        'recent'           => array_slice( $progress, 0, 5 ),
    );
}

/* ── Data Retrieval ────────────────────────────────────────────── */

/**
 * Get all in-progress video entries for a user.
 *
 * Reads user meta keys matching 'mmed_video_progress_*' and enriches
 * with manifest video data.
 *
 * @param int $user_id WordPress user ID.
 * @return array Array of progress entries with video metadata.
 */
function mmed_get_user_video_progress( $user_id ) {
    global $wpdb;

    // Fetch all video progress meta for this user.
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT meta_key, meta_value FROM {$wpdb->usermeta}
         WHERE user_id = %d AND meta_key LIKE %s",
        $user_id,
        'mmed_video_progress_%'
    ) );

    if ( ! $rows ) {
        return array();
    }

    $results = array();

    foreach ( $rows as $row ) {
        $video_id = str_replace( 'mmed_video_progress_', '', $row->meta_key );
        $progress = maybe_unserialize( $row->meta_value );

        if ( ! is_array( $progress ) || empty( $progress['position'] ) ) {
            continue;
        }

        // Skip completed videos (position >= 90% of duration).
        $dur = floatval( $progress['duration'] ?? 0 );
        $pos = floatval( $progress['position'] ?? 0 );
        if ( $dur > 0 && ( $pos / $dur ) >= 0.90 ) {
            // Include in stats but mark as complete.
            $progress['is_complete'] = true;
        } else {
            $progress['is_complete'] = false;
        }

        // Enrich with manifest data.
        $video_data = null;
        if ( function_exists( 'mmed_resolve_video' ) ) {
            $video_data = mmed_resolve_video( $video_id );
        }

        $results[] = array(
            'video_id'     => $video_id,
            'position'     => $pos,
            'duration'     => $dur,
            'updated_at'   => $progress['updated_at'] ?? '',
            'lesson_id'    => $progress['lesson_id'] ?? 0,
            'is_complete'  => $progress['is_complete'],
            'title'        => $video_data['title'] ?? 'MissionMed Video',
            'thumbnail'    => $video_data['thumbnail'] ?? '',
            'playback_url' => $video_data['playback_url'] ?? '',
            'category'     => $video_data['category_label'] ?? '',
            'division'     => $video_data['division'] ?? '',
            'duration_label' => $video_data['duration_label'] ?? '',
        );
    }

    return $results;
}

/**
 * Get all videos embedded in lessons for a given course.
 *
 * @param int $course_id LearnDash course post ID.
 * @return array Array of { lesson_id, title, videos[] }.
 */
function mmed_get_course_lesson_videos( $course_id ) {
    // Get lessons for this course.
    $lessons = get_posts( array(
        'post_type'      => 'sfwd-lessons',
        'posts_per_page' => 200,
        'orderby'        => 'menu_order',
        'order'          => 'ASC',
        'meta_query'     => array(
            array(
                'key'   => 'course_id',
                'value' => $course_id,
            ),
        ),
        'suppress_filters' => true,
    ) );

    if ( empty( $lessons ) ) {
        return array();
    }

    $result = array();

    foreach ( $lessons as $lesson ) {
        $video_ids = get_post_meta( $lesson->ID, 'mmed_video_ids', true );
        $videos    = array();

        if ( is_array( $video_ids ) && ! empty( $video_ids ) ) {
            foreach ( $video_ids as $vid ) {
                $vdata = null;
                if ( function_exists( 'mmed_resolve_video' ) ) {
                    $vdata = mmed_resolve_video( $vid );
                }

                $videos[] = array(
                    'id'             => $vid,
                    'title'          => $vdata ? $vdata['title'] : $vid,
                    'thumbnail'      => $vdata ? $vdata['thumbnail'] : '',
                    'playback_url'   => $vdata ? $vdata['playback_url'] : '',
                    'duration'       => $vdata ? $vdata['duration'] : 0,
                    'duration_label' => $vdata ? $vdata['duration_label'] : '',
                    'cloud_video_path' => $vdata ? ( $vdata['cloud_video_path'] ?? '' ) : '',
                );
            }
        }

        $result[] = array(
            'lesson_id' => $lesson->ID,
            'title'     => $lesson->post_title,
            'videos'    => $videos,
        );
    }

    return $result;
}

/* ── Rendering Helpers ─────────────────────────────────────────── */

/**
 * Render a single Continue Watching card.
 *
 * @param array $item Progress item with video metadata.
 * @return string HTML.
 */
function mmed_render_cw_card( $item ) {
    $vid          = esc_attr( $item['video_id'] );
    $title        = esc_html( $item['title'] );
    $thumb        = esc_url( $item['thumbnail'] );
    $dur_label    = esc_html( $item['duration_label'] );
    $lesson_id    = intval( $item['lesson_id'] );
    $position     = floatval( $item['position'] );
    $duration     = floatval( $item['duration'] );
    $watch_pct    = $duration > 0 ? min( 100, round( ( $position / $duration ) * 100 ) ) : 0;

    // Link to lesson where the video lives.
    $lesson_url = $lesson_id ? get_permalink( $lesson_id ) : '#';
    $lesson_title = $lesson_id ? get_the_title( $lesson_id ) : '';

    $thumb_style = $thumb ? 'background-image:url(' . $thumb . ')' : 'background:#1a2332';

    $html  = '<a class="mmed-cw-card" href="' . esc_url( $lesson_url ) . '" title="Continue watching: ' . $title . '">';
    $html .= '<div class="mmed-cw-thumb" style="' . $thumb_style . '">';
    $html .= '<span class="mmed-cw-duration">' . $dur_label . '</span>';
    $html .= '<div class="mmed-cw-progress-bar"><div class="mmed-cw-progress-fill" style="width:' . $watch_pct . '%"></div></div>';
    $html .= '</div>';
    $html .= '<div class="mmed-cw-info">';
    $html .= '<p class="mmed-cw-video-title">' . $title . '</p>';
    if ( $lesson_title ) {
        $html .= '<p class="mmed-cw-lesson">' . esc_html( $lesson_title ) . '</p>';
    }
    $html .= '</div>';
    $html .= '</a>';

    return $html;
}

/* ── AJAX: Get User Video Stats ────────────────────────────────── */

/**
 * AJAX handler for fetching user video stats (used by Hub JS).
 */
function mmed_ajax_get_video_stats() {
    if ( ! is_user_logged_in() ) {
        wp_send_json_error( 'Not logged in', 401 );
    }

    $user_id = get_current_user_id();
    $stats = mmed_get_user_video_stats( $user_id );

    wp_send_json_success( $stats );
}
add_action( 'wp_ajax_mmed_get_video_stats', 'mmed_ajax_get_video_stats' );

/**
 * AJAX handler for fetching Continue Watching HTML.
 */
function mmed_ajax_continue_watching() {
    if ( ! is_user_logged_in() ) {
        wp_send_json_error( 'Not logged in', 401 );
    }

    $html = mmed_render_continue_watching();
    wp_send_json_success( array( 'html' => $html ) );
}
add_action( 'wp_ajax_mmed_continue_watching', 'mmed_ajax_continue_watching' );

/* ── Inline Styles (Dashboard) ─────────────────────────────────── */

/**
 * Output dashboard-specific styles once per page.
 *
 * @return string <style> tag or empty.
 */
function mmed_dashboard_inline_styles() {
    static $printed = false;
    if ( $printed ) return '';
    $printed = true;

    return '<style id="mmed-video-dashboard-css">
/* ── Continue Watching ─────────────────── */
.mmed-continue-watching{margin:0 0 2em;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.mmed-cw-header{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 12px}
.mmed-cw-title{margin:0;font-size:1.1em;font-weight:600;color:#1a2332}
.mmed-cw-count{font-size:.8em;color:#6b7b8d}
.mmed-cw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:900px){.mmed-cw-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.mmed-cw-grid{grid-template-columns:1fr}}

.mmed-cw-card{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e2e6ea;border-radius:8px;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.mmed-cw-card:hover{border-color:#D4AF63;box-shadow:0 2px 8px rgba(0,0,0,.08)}

.mmed-cw-thumb{position:relative;width:100%;padding-bottom:56.25%;background-size:cover;background-position:center;background-color:#f0f2f5}
.mmed-cw-duration{position:absolute;bottom:8px;right:8px;padding:2px 8px;background:rgba(0,0,0,.75);color:#fff;font-size:11px;font-weight:600;border-radius:4px}
.mmed-cw-progress-bar{position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(0,0,0,.3)}
.mmed-cw-progress-fill{height:100%;background:#D4AF63;border-radius:0 2px 0 0;transition:width .3s}

.mmed-cw-info{padding:10px 12px}
.mmed-cw-video-title{margin:0 0 3px;font-size:13px;font-weight:500;color:#1a2332;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mmed-cw-lesson{margin:0;font-size:11px;color:#6b7b8d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ── Course Video Dashboard ────────────── */
.mmed-video-dashboard{margin:0 0 2em;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.mmed-vd-header{margin:0 0 12px}
.mmed-vd-title{margin:0;font-size:1.1em;font-weight:600;color:#1a2332}
.mmed-vd-table-wrap{overflow-x:auto}
.mmed-vd-table{width:100%;border-collapse:collapse;font-size:13px}
.mmed-vd-table th{text-align:left;padding:10px 12px;background:#f8f9fa;border-bottom:2px solid #e2e6ea;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#6b7b8d;font-weight:600}
.mmed-vd-table td{padding:10px 12px;border-bottom:1px solid #f0f2f5;vertical-align:middle}
.mmed-vd-row--empty td{background:#fffbeb}
.mmed-vd-no-video{color:#b45309;font-style:italic}

.mmed-vd-video-cell{display:flex;align-items:center;gap:10px}
.mmed-vd-thumb{width:48px;height:27px;object-fit:cover;border-radius:4px;flex-shrink:0}
.mmed-vd-video-title{font-weight:500;color:#1a2332}

.mmed-vd-progress-bar{display:inline-block;width:60px;height:6px;background:#e5e7eb;border-radius:3px;vertical-align:middle;margin-right:6px}
.mmed-vd-progress-fill{height:100%;background:#D4AF63;border-radius:3px}
.mmed-vd-progress-label{font-size:11px;color:#6b7b8d}
.mmed-vd-complete-badge{display:inline-block;padding:2px 8px;background:rgba(16,185,129,.12);color:#059669;font-size:11px;font-weight:600;border-radius:3px;text-transform:uppercase;letter-spacing:.5px}
.mmed-vd-not-started{font-size:11px;color:#9ca3af}

.mmed-cdn-dot{display:inline-block;width:8px;height:8px;border-radius:50%}
.mmed-cdn-dot--green{background:#10b981}
.mmed-cdn-dot--orange{background:#f59e0b}
.mmed-cdn-dot--red{background:#ef4444}

.mmed-vd-summary{display:flex;gap:20px;padding:12px 0;font-size:12px;color:#6b7b8d;border-top:1px solid #e2e6ea;margin-top:4px}
.mmed-vd-empty{padding:40px 20px;text-align:center;color:#6b7b8d;background:#f8f9fa;border-radius:8px}
</style>';
}
