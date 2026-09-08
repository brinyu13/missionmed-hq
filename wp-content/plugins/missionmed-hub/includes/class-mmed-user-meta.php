<?php
/**
 * MissionMed Hub — User Meta & Admin Columns.
 *
 * Custom user meta fields, placement_ready auto-flag,
 * admin user list columns, re-run enrollment button.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMED_User_Meta {

    /**
     * Custom user meta keys used by the Hub.
     */
    const META_KEYS = array(
        '_mmed_primary_division',  // residency | usmle | clinicals
        '_mmed_program_tier',      // 360elite | usmle_prep | usce_onboarding
        '_mmed_enrolled_date',     // Y-m-d
        '_mmed_placement_ready',   // 1 | ''
        '_mmed_last_login',        // Unix timestamp or ISO-8601 string
        '_mmed_lifecycle_stage',   // Manual lifecycle override
    );

    /* ── User Profile Section ────────────────────────────────────── */

    /**
     * Display MissionMed info on the user profile edit screen.
     *
     * @param WP_User $user The user being edited.
     */
    public static function user_profile_section( $user ) {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $division  = get_user_meta( $user->ID, '_mmed_primary_division', true );
        $tier      = get_user_meta( $user->ID, '_mmed_program_tier', true );
        $enrolled  = get_user_meta( $user->ID, '_mmed_enrolled_date', true );
        $ready     = get_user_meta( $user->ID, '_mmed_placement_ready', true );
        $last_login = get_user_meta( $user->ID, '_mmed_last_login', true );
        $lifecycle_override = get_user_meta( $user->ID, '_mmed_lifecycle_stage', true );

        // Task counts.
        $tasks       = self::get_task_counts( $user->ID );
        $total       = $tasks['total'];
        $approved    = $tasks['approved'];
        ?>
        <h2>MissionMed Hub</h2>
        <table class="form-table">
            <tr>
                <th>Division</th>
                <td><?php echo esc_html( $division ? ucfirst( $division ) : '—' ); ?></td>
            </tr>
            <tr>
                <th>Program Tier</th>
                <td><?php echo esc_html( $tier ?: '—' ); ?></td>
            </tr>
            <tr>
                <th>Enrolled Date</th>
                <td><?php echo esc_html( $enrolled ?: '—' ); ?></td>
            </tr>
            <tr>
                <th>Tasks</th>
                <td><?php echo esc_html( "{$approved}/{$total} approved" ); ?></td>
            </tr>
            <tr>
                <th>Last Login</th>
                <td><?php echo esc_html( self::format_meta_datetime( $last_login ) ); ?></td>
            </tr>
            <tr>
                <th>Lifecycle Override</th>
                <td><?php echo esc_html( $lifecycle_override ?: '—' ); ?></td>
            </tr>
            <tr>
                <th>Placement Ready</th>
                <td>
                    <?php if ( '1' === $ready ) : ?>
                        <span style="color:green;font-weight:bold;">Yes</span>
                    <?php else : ?>
                        <span style="color:#999;">No</span>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <th>Re-run Enrollment</th>
                <td>
                    <select id="mmed-rerun-template">
                        <option value="">— Select Template —</option>
                        <option value="360elite_onboarding">360 Elite Match Mentorship</option>
                        <option value="usce_onboarding">USCE Onboarding</option>
                    </select>
                    <button type="button" class="button" id="mmed-rerun-btn" data-user="<?php echo esc_attr( $user->ID ); ?>">Re-run</button>
                    <span id="mmed-rerun-status" style="margin-left:8px;"></span>
                    <script>
                    (function(){
                        var btn = document.getElementById('mmed-rerun-btn');
                        if (!btn) return;
                        btn.addEventListener('click', function(){
                            var tpl = document.getElementById('mmed-rerun-template').value;
                            if (!tpl) { alert('Select a template first.'); return; }
                            if (!confirm('This will create a new task set for this user. Continue?')) return;
                            var uid = btn.getAttribute('data-user');
                            var status = document.getElementById('mmed-rerun-status');
                            status.textContent = 'Running…';
                            var xhr = new XMLHttpRequest();
                            xhr.open('POST', ajaxurl);
                            xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
                            xhr.onload = function(){
                                try {
                                    var r = JSON.parse(xhr.responseText);
                                    status.textContent = r.success ? r.data.message : (r.data.message || 'Error');
                                } catch(e) { status.textContent = 'Error'; }
                            };
                            xhr.send('action=mmed_rerun_enroll&user_id='+uid+'&template='+encodeURIComponent(tpl)+'&_mmed_nonce=<?php echo esc_js( wp_create_nonce( 'mmed_rerun_nonce' ) ); ?>');
                        });
                    })();
                    </script>
                </td>
            </tr>
        </table>
        <?php
    }

    /* ── AJAX: Re-run Enrollment ─────────────────────────────────── */

    /**
     * AJAX: mmed_rerun_enroll
     * Admin manually triggers enrollment for a user.
     */
    public static function ajax_rerun_enrollment() {
        check_ajax_referer( 'mmed_rerun_nonce', '_mmed_nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( array( 'message' => 'Unauthorized.' ), 403 );
        }

        $user_id  = absint( $_POST['user_id'] ?? 0 );
        $template = sanitize_text_field( $_POST['template'] ?? '' );

        if ( ! $user_id || ! get_userdata( $user_id ) ) {
            wp_send_json_error( array( 'message' => 'Invalid user.' ), 400 );
        }

        $templates = MMED_Templates::get_templates();
        if ( ! isset( $templates[ $template ] ) ) {
            wp_send_json_error( array( 'message' => 'Invalid template.' ), 400 );
        }

        // Fire the enrollment action (sets user meta + creates tasks).
        do_action( 'mmed_enrollment_complete', $user_id, $template );

        $count = self::get_task_counts( $user_id )['total'];
        wp_send_json_success( array( 'message' => "Enrollment complete. {$count} total tasks now." ) );
    }

    /* ── Admin User List Columns ─────────────────────────────────── */

    /**
     * Add custom columns to the Users admin list.
     *
     * @param array $columns Existing columns.
     * @return array Modified columns.
     */
    public static function user_columns( $columns ) {
        $columns['mmed_program']   = 'Program';
        $columns['mmed_tasks']     = 'Tasks';
        $columns['mmed_placement'] = 'Placement';
        return $columns;
    }

    /**
     * Render content for custom user columns.
     *
     * @param string $output      Existing column output.
     * @param string $column_name Column key.
     * @param int    $user_id     User ID.
     * @return string Column HTML.
     */
    public static function user_column_content( $output, $column_name, $user_id ) {
        switch ( $column_name ) {
            case 'mmed_program':
                $division = get_user_meta( $user_id, '_mmed_primary_division', true );
                $tier     = get_user_meta( $user_id, '_mmed_program_tier', true );
                if ( ! $division && ! $tier ) {
                    return '—';
                }
                $label = $tier ?: $division;
                $colors = array(
                    'residency' => '#0F2A44',
                    'usmle'     => '#0C4A6E',
                    'clinicals' => '#4a6fa5',
                );
                $color = $colors[ $division ] ?? '#4a6fa5';
                return sprintf( '<span style="background:%s;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">%s</span>', esc_attr( $color ), esc_html( $label ) );

            case 'mmed_tasks':
                $counts = self::get_task_counts( $user_id );
                if ( 0 === $counts['total'] ) {
                    return '—';
                }
                $color = $counts['approved'] === $counts['total'] ? 'green' : '#666';
                return sprintf( '<span style="color:%s;">%d/%d</span>', esc_attr( $color ), $counts['approved'], $counts['total'] );

            case 'mmed_placement':
                $ready = get_user_meta( $user_id, '_mmed_placement_ready', true );
                if ( '1' === $ready ) {
                    return '<span style="color:green;font-weight:bold;">Ready</span>';
                }
                $division = get_user_meta( $user_id, '_mmed_primary_division', true );
                if ( 'clinicals' === $division ) {
                    return '<span style="color:#999;">Pending</span>';
                }
                return '—';
        }
        return $output;
    }

    /* ── Placement Ready Check ───────────────────────────────────── */

    /**
     * Check if a user's USCE tasks are all approved → set placement_ready.
     * Called from MMED_Task_CPT::save_meta() when status changes to approved.
     *
     * @param int $user_id WordPress user ID.
     */
    public static function check_placement_ready( $user_id ) {
        $division = get_user_meta( $user_id, '_mmed_primary_division', true );
        if ( 'clinicals' !== $division ) {
            return;
        }

        // Already flagged?
        if ( '1' === get_user_meta( $user_id, '_mmed_placement_ready', true ) ) {
            return;
        }

        // Get all tasks for this user.
        $tasks = get_posts( array(
            'post_type'   => 'mmed_task',
            'meta_key'    => '_mmed_student_id',
            'meta_value'  => $user_id,
            'numberposts' => -1,
            'fields'      => 'ids',
        ) );

        if ( empty( $tasks ) ) {
            return;
        }

        // Check if ALL tasks are approved.
        foreach ( $tasks as $task_id ) {
            $status = get_post_meta( $task_id, '_mmed_status', true );
            if ( 'approved' !== $status ) {
                return; // At least one not approved — bail.
            }
        }

        // All approved — flag placement ready.
        update_user_meta( $user_id, '_mmed_placement_ready', '1' );

        /**
         * Fires when a USCE student becomes placement-ready.
         *
         * @param int $user_id WordPress user ID.
         */
        do_action( 'mmed_placement_ready', $user_id );
    }

    /* ── Helpers ──────────────────────────────────────────────────── */

    /**
     * Get task counts for a user.
     *
     * @param int $user_id WordPress user ID.
     * @return array { total: int, approved: int }
     */
    private static function get_task_counts( $user_id ) {
        $tasks = get_posts( array(
            'post_type'   => 'mmed_task',
            'meta_key'    => '_mmed_student_id',
            'meta_value'  => $user_id,
            'numberposts' => -1,
            'fields'      => 'ids',
        ) );

        $total    = count( $tasks );
        $approved = 0;

        foreach ( $tasks as $task_id ) {
            if ( 'approved' === get_post_meta( $task_id, '_mmed_status', true ) ) {
                $approved++;
            }
        }

        return array( 'total' => $total, 'approved' => $approved );
    }

    /**
     * Format a user meta datetime value for admin display.
     *
     * @param mixed $value Stored meta value.
     * @return string
     */
    private static function format_meta_datetime( $value ) {
        if ( empty( $value ) ) {
            return '—';
        }

        if ( is_numeric( $value ) ) {
            $timestamp = (int) $value;
        } else {
            $timestamp = strtotime( (string) $value );
        }

        if ( ! $timestamp ) {
            return (string) $value;
        }

        return wp_date( 'M d, Y g:i A', $timestamp );
    }
}
