<?php
/**
 * MissionMed Hub — Task Custom Post Type.
 *
 * Registers mmed_task CPT, meta fields, admin columns, filters, bulk actions.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMED_Task_CPT {

    /* ── CPT Registration ─────────────────────────────────────────── */
    public static function register_post_type() {
        register_post_type( 'mmed_task', array(
            'labels' => array(
                'name'               => 'Tasks',
                'singular_name'      => 'Task',
                'add_new_item'       => 'Add New Task',
                'edit_item'          => 'Edit Task',
                'search_items'       => 'Search Tasks',
                'not_found'          => 'No tasks found',
            ),
            'public'       => false,
            'show_ui'      => true,
            'show_in_menu' => true,
            'menu_icon'    => 'dashicons-clipboard',
            'supports'     => array( 'title' ),
            'capability_type' => 'post',
            'map_meta_cap'    => true,
        ) );
    }

    /* ── Meta Fields ──────────────────────────────────────────────── */
    public static function register_meta_fields() {
        $fields = array(
            '_mmed_student_id'    => 'integer',
            '_mmed_division'      => 'string',
            '_mmed_program_tier'  => 'string',
            '_mmed_status'        => 'string',
            '_mmed_due_date'      => 'string',
            '_mmed_sort_order'    => 'integer',
            '_mmed_instructions'  => 'string',
            '_mmed_requires_file' => 'boolean',
            '_mmed_file_id'       => 'integer',
            '_mmed_staff_note'    => 'string',
            '_mmed_reviewer_id'   => 'integer',
            '_mmed_template_id'   => 'string',
        );
        foreach ( $fields as $key => $type ) {
            register_post_meta( 'mmed_task', $key, array(
                'type'              => $type,
                'single'            => true,
                'sanitize_callback' => 'sanitize_text_field',
                'auth_callback'     => function() { return current_user_can( 'edit_posts' ); },
                'show_in_rest'      => false,
            ) );
        }
    }

    /* ── Status Helpers ───────────────────────────────────────────── */
    public static function get_statuses() {
        return array(
            'not_started'     => 'Not Started',
            'in_progress'     => 'In Progress',
            'pending_review'  => 'Under Review',
            'approved'        => 'Approved',
            'revision_needed' => 'Needs Revision',
        );
    }

    public static function status_color( $status ) {
        $colors = array(
            'not_started'     => '#9E9E9E',
            'in_progress'     => '#2196F3',
            'pending_review'  => '#FF9800',
            'approved'        => '#4CAF50',
            'revision_needed' => '#F44336',
        );
        return $colors[ $status ] ?? '#9E9E9E';
    }

    public static function status_label( $status ) {
        $labels = self::get_statuses();
        return $labels[ $status ] ?? ucwords( str_replace( '_', ' ', $status ) );
    }

    /* ── Meta Boxes ───────────────────────────────────────────────── */
    public static function add_meta_boxes() {
        add_meta_box( 'mmed_task_details',     'Task Details',    array( __CLASS__, 'meta_box_details' ),     'mmed_task', 'normal', 'high' );
        add_meta_box( 'mmed_task_instructions', 'Instructions',   array( __CLASS__, 'meta_box_instructions' ), 'mmed_task', 'normal', 'default' );
        add_meta_box( 'mmed_task_staff_note',   'Staff Note',     array( __CLASS__, 'meta_box_staff_note' ),   'mmed_task', 'normal', 'default' );
        add_meta_box( 'mmed_task_file',         'Uploaded File',  array( __CLASS__, 'meta_box_file' ),         'mmed_task', 'side',   'default' );
    }

    public static function meta_box_details( $post ) {
        wp_nonce_field( 'mmed_task_save', 'mmed_task_nonce' );
        $student_id   = get_post_meta( $post->ID, '_mmed_student_id', true );
        $division     = get_post_meta( $post->ID, '_mmed_division', true );
        $tier         = get_post_meta( $post->ID, '_mmed_program_tier', true );
        $status       = get_post_meta( $post->ID, '_mmed_status', true ) ?: 'not_started';
        $sort_order   = get_post_meta( $post->ID, '_mmed_sort_order', true ) ?: 1;
        $due_date     = get_post_meta( $post->ID, '_mmed_due_date', true );
        $requires     = get_post_meta( $post->ID, '_mmed_requires_file', true );
        $reviewer_id  = get_post_meta( $post->ID, '_mmed_reviewer_id', true );
        $template_id  = get_post_meta( $post->ID, '_mmed_template_id', true );

        $users     = get_users( array( 'orderby' => 'display_name', 'number' => 200 ) );
        $reviewers = get_users( array( 'role__in' => array( 'administrator', 'editor' ), 'orderby' => 'display_name' ) );
        ?>
        <table class="form-table">
            <tr>
                <th><label for="_mmed_student_id">Student</label></th>
                <td>
                    <select name="_mmed_student_id" id="_mmed_student_id">
                        <option value="0">— Select Student —</option>
                        <?php foreach ( $users as $u ) : ?>
                            <option value="<?php echo esc_attr( $u->ID ); ?>" <?php selected( $student_id, $u->ID ); ?>><?php echo esc_html( $u->display_name ); ?> (<?php echo esc_html( $u->user_email ); ?>)</option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="_mmed_division">Division</label></th>
                <td>
                    <select name="_mmed_division" id="_mmed_division">
                        <option value="residency" <?php selected( $division, 'residency' ); ?>>Residency</option>
                        <option value="usmle" <?php selected( $division, 'usmle' ); ?>>USMLE</option>
                        <option value="clinicals" <?php selected( $division, 'clinicals' ); ?>>Clinicals</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="_mmed_program_tier">Program Tier</label></th>
                <td>
                    <select name="_mmed_program_tier" id="_mmed_program_tier">
                        <option value="360elite" <?php selected( $tier, '360elite' ); ?>>360 Elite</option>
                        <option value="usmle_prep" <?php selected( $tier, 'usmle_prep' ); ?>>USMLE Exam Prep</option>
                        <option value="usce_onboarding" <?php selected( $tier, 'usce_onboarding' ); ?>>USCE Onboarding</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="_mmed_status">Status</label></th>
                <td>
                    <select name="_mmed_status" id="_mmed_status">
                        <?php foreach ( self::get_statuses() as $key => $label ) : ?>
                            <option value="<?php echo esc_attr( $key ); ?>" <?php selected( $status, $key ); ?>><?php echo esc_html( $label ); ?></option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="_mmed_sort_order">Sort Order</label></th>
                <td><input type="number" name="_mmed_sort_order" id="_mmed_sort_order" value="<?php echo esc_attr( $sort_order ); ?>" min="1" class="small-text" /></td>
            </tr>
            <tr>
                <th><label for="_mmed_due_date">Due Date</label></th>
                <td><input type="date" name="_mmed_due_date" id="_mmed_due_date" value="<?php echo esc_attr( $due_date ); ?>" /></td>
            </tr>
            <tr>
                <th><label for="_mmed_requires_file">Requires File Upload</label></th>
                <td><input type="checkbox" name="_mmed_requires_file" id="_mmed_requires_file" value="1" <?php checked( $requires, '1' ); ?> /></td>
            </tr>
            <tr>
                <th><label for="_mmed_reviewer_id">Reviewer</label></th>
                <td>
                    <select name="_mmed_reviewer_id" id="_mmed_reviewer_id">
                        <option value="0">— Default —</option>
                        <?php foreach ( $reviewers as $u ) : ?>
                            <option value="<?php echo esc_attr( $u->ID ); ?>" <?php selected( $reviewer_id, $u->ID ); ?>><?php echo esc_html( $u->display_name ); ?></option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th>Template ID</th>
                <td><code><?php echo esc_html( $template_id ?: '—' ); ?></code></td>
            </tr>
        </table>
        <?php
    }

    public static function meta_box_instructions( $post ) {
        $instructions = get_post_meta( $post->ID, '_mmed_instructions', true );
        wp_editor( $instructions, 'mmed_instructions_editor', array(
            'textarea_name' => '_mmed_instructions',
            'textarea_rows' => 6,
            'media_buttons' => false,
        ) );
    }

    public static function meta_box_staff_note( $post ) {
        $note = get_post_meta( $post->ID, '_mmed_staff_note', true );
        echo '<textarea name="_mmed_staff_note" rows="4" style="width:100%;">' . esc_textarea( $note ) . '</textarea>';
        echo '<p class="description">Visible to the student on their Hub dashboard.</p>';
    }

    public static function meta_box_file( $post ) {
        $file_id = get_post_meta( $post->ID, '_mmed_file_id', true );
        if ( $file_id ) {
            $url  = wp_get_attachment_url( $file_id );
            $name = basename( get_attached_file( $file_id ) );
            echo '<p><strong>File:</strong> ' . esc_html( $name ) . '</p>';
            echo '<p><a href="' . esc_url( $url ) . '" target="_blank" class="button">Download</a></p>';
        } else {
            echo '<p>No file uploaded.</p>';
        }
    }

    /* ── Save Meta ────────────────────────────────────────────────── */
    public static function save_meta( $post_id, $post ) {
        if ( ! isset( $_POST['mmed_task_nonce'] ) || ! wp_verify_nonce( $_POST['mmed_task_nonce'], 'mmed_task_save' ) ) {
            return;
        }
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        $old_status = get_post_meta( $post_id, '_mmed_status', true );

        $fields = array(
            '_mmed_student_id'    => 'absint',
            '_mmed_division'      => 'sanitize_text_field',
            '_mmed_program_tier'  => 'sanitize_text_field',
            '_mmed_status'        => 'sanitize_text_field',
            '_mmed_sort_order'    => 'absint',
            '_mmed_due_date'      => 'sanitize_text_field',
            '_mmed_instructions'  => 'wp_kses_post',
            '_mmed_staff_note'    => 'sanitize_textarea_field',
            '_mmed_reviewer_id'   => 'absint',
        );

        foreach ( $fields as $key => $sanitize ) {
            if ( isset( $_POST[ $key ] ) ) {
                update_post_meta( $post_id, $key, call_user_func( $sanitize, $_POST[ $key ] ) );
            }
        }

        // Checkbox — requires_file.
        $requires = isset( $_POST['_mmed_requires_file'] ) ? '1' : '0';
        update_post_meta( $post_id, '_mmed_requires_file', $requires );

        // Fire status change hook if status changed.
        $new_status = sanitize_text_field( $_POST['_mmed_status'] ?? '' );
        if ( $old_status && $new_status && $old_status !== $new_status ) {
            do_action( 'mmed_status_changed', $post_id, $old_status, $new_status );
        }

        // Check placement_ready after status change.
        if ( 'approved' === $new_status ) {
            MMED_User_Meta::check_placement_ready( absint( $_POST['_mmed_student_id'] ?? 0 ) );
        }
    }

    /* ── Admin Columns ────────────────────────────────────────────── */
    public static function admin_columns( $columns ) {
        $new = array(
            'cb'             => $columns['cb'],
            'title'          => 'Task Title',
            'mmed_student'   => 'Student',
            'mmed_division'  => 'Division',
            'mmed_tier'      => 'Program',
            'mmed_status'    => 'Status',
            'mmed_due'       => 'Due Date',
            'mmed_file'      => 'File',
            'date'           => 'Last Updated',
        );
        return $new;
    }

    public static function admin_column_content( $column, $post_id ) {
        switch ( $column ) {
            case 'mmed_student':
                $uid = get_post_meta( $post_id, '_mmed_student_id', true );
                $user = $uid ? get_userdata( $uid ) : null;
                echo $user ? esc_html( $user->display_name ) : '—';
                break;
            case 'mmed_division':
                $div = get_post_meta( $post_id, '_mmed_division', true );
                $labels = array(
                    'residency' => 'Residency',
                    'usmle'     => 'USMLE',
                    'clinicals' => 'Clinicals',
                );
                $colors = array(
                    'residency' => '#0F2A44',
                    'usmle'     => '#0C4A6E',
                    'clinicals' => '#C9A84C',
                );
                $badge_color = $colors[ $div ] ?? '#6B7280';
                echo '<span style="background:' . esc_attr( $badge_color ) . ';color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">' . esc_html( $labels[ $div ] ?? ucfirst( $div ) ) . '</span>';
                break;
            case 'mmed_tier':
                $tier = get_post_meta( $post_id, '_mmed_program_tier', true );
                $labels = array(
                    '360elite'        => '360 Elite',
                    'usmle_prep'      => 'USMLE Exam Prep',
                    'usce_onboarding' => 'USCE',
                );
                echo esc_html( $labels[ $tier ] ?? $tier );
                break;
            case 'mmed_status':
                $status = get_post_meta( $post_id, '_mmed_status', true ) ?: 'not_started';
                $color  = self::status_color( $status );
                $label  = self::status_label( $status );
                echo '<span class="mmed-status-badge" data-post-id="' . esc_attr( $post_id ) . '" style="background:' . esc_attr( $color ) . ';color:#fff;padding:3px 10px;border-radius:3px;font-size:11px;cursor:pointer;" title="Click to change">' . esc_html( $label ) . '</span>';
                break;
            case 'mmed_due':
                $due = get_post_meta( $post_id, '_mmed_due_date', true );
                if ( $due ) {
                    $overdue = strtotime( $due ) < time();
                    echo '<span style="' . ( $overdue ? 'color:#F44336;font-weight:bold;' : '' ) . '">' . esc_html( $due ) . '</span>';
                } else {
                    echo '—';
                }
                break;
            case 'mmed_file':
                $fid = get_post_meta( $post_id, '_mmed_file_id', true );
                echo $fid ? '<span style="font-size:16px;" title="File attached">📎</span>' : '';
                break;
        }
    }

    public static function sortable_columns( $columns ) {
        $columns['mmed_due']    = '_mmed_due_date';
        $columns['mmed_status'] = '_mmed_status';
        return $columns;
    }

    /* ── Admin Filters ────────────────────────────────────────────── */
    public static function admin_filters( $post_type ) {
        if ( 'mmed_task' !== $post_type ) {
            return;
        }

        $current_div    = $_GET['mmed_division'] ?? '';
        $current_status = $_GET['mmed_status_filter'] ?? '';
        $current_tier   = $_GET['mmed_tier'] ?? '';

        // Division filter.
        echo '<select name="mmed_division"><option value="">All Divisions</option>';
        foreach ( array( 'residency' => 'Residency', 'usmle' => 'USMLE', 'clinicals' => 'Clinicals' ) as $k => $v ) {
            echo '<option value="' . esc_attr( $k ) . '" ' . selected( $current_div, $k, false ) . '>' . esc_html( $v ) . '</option>';
        }
        echo '</select>';

        // Status filter.
        echo '<select name="mmed_status_filter"><option value="">All Statuses</option>';
        foreach ( self::get_statuses() as $k => $v ) {
            echo '<option value="' . esc_attr( $k ) . '" ' . selected( $current_status, $k, false ) . '>' . esc_html( $v ) . '</option>';
        }
        echo '</select>';

        // Tier filter.
        echo '<select name="mmed_tier"><option value="">All Programs</option>';
        foreach ( array( '360elite' => '360 Elite', 'usmle_prep' => 'USMLE Exam Prep', 'usce_onboarding' => 'USCE Onboarding' ) as $k => $v ) {
            echo '<option value="' . esc_attr( $k ) . '" ' . selected( $current_tier, $k, false ) . '>' . esc_html( $v ) . '</option>';
        }
        echo '</select>';
    }

    public static function filter_query( $query ) {
        global $pagenow;
        if ( ! is_admin() || 'edit.php' !== $pagenow || 'mmed_task' !== ( $query->get( 'post_type' ) ) ) {
            return;
        }

        $meta_query = $query->get( 'meta_query' ) ?: array();

        if ( ! empty( $_GET['mmed_division'] ) ) {
            $meta_query[] = array( 'key' => '_mmed_division', 'value' => sanitize_text_field( $_GET['mmed_division'] ) );
        }
        if ( ! empty( $_GET['mmed_status_filter'] ) ) {
            $meta_query[] = array( 'key' => '_mmed_status', 'value' => sanitize_text_field( $_GET['mmed_status_filter'] ) );
        }
        if ( ! empty( $_GET['mmed_tier'] ) ) {
            $meta_query[] = array( 'key' => '_mmed_program_tier', 'value' => sanitize_text_field( $_GET['mmed_tier'] ) );
        }

        if ( ! empty( $meta_query ) ) {
            $query->set( 'meta_query', $meta_query );
        }
    }

    /* ── Bulk Actions ─────────────────────────────────────────────── */
    public static function register_bulk_actions( $actions ) {
        $actions['mmed_approve']  = 'Set Status → Approved';
        $actions['mmed_revision'] = 'Set Status → Needs Revision';
        return $actions;
    }

    public static function handle_bulk_actions( $redirect_to, $action, $post_ids ) {
        if ( 'mmed_approve' !== $action && 'mmed_revision' !== $action ) {
            return $redirect_to;
        }

        $new_status = 'mmed_approve' === $action ? 'approved' : 'revision_needed';
        $count = 0;

        foreach ( $post_ids as $pid ) {
            $old_status = get_post_meta( $pid, '_mmed_status', true );
            update_post_meta( $pid, '_mmed_status', $new_status );
            $count++;

            if ( $old_status !== $new_status ) {
                do_action( 'mmed_status_changed', $pid, $old_status, $new_status );
            }
            if ( 'approved' === $new_status ) {
                $student_id = get_post_meta( $pid, '_mmed_student_id', true );
                MMED_User_Meta::check_placement_ready( absint( $student_id ) );
            }
        }

        return add_query_arg( 'mmed_bulk_updated', $count, $redirect_to );
    }

    public static function bulk_action_notices() {
        if ( ! empty( $_GET['mmed_bulk_updated'] ) ) {
            $count = intval( $_GET['mmed_bulk_updated'] );
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $count ) . ' task(s) updated.</p></div>';
        }
    }

    /* ── AJAX Quick Status ────────────────────────────────────────── */
    public static function ajax_quick_status() {
        check_ajax_referer( 'mmed_admin_nonce', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( 'Unauthorized', 403 );
        }

        $post_id    = absint( $_POST['post_id'] ?? 0 );
        $new_status = sanitize_text_field( $_POST['status'] ?? '' );

        if ( ! $post_id || ! array_key_exists( $new_status, self::get_statuses() ) ) {
            wp_send_json_error( 'Invalid data' );
        }

        $old_status = get_post_meta( $post_id, '_mmed_status', true );
        update_post_meta( $post_id, '_mmed_status', $new_status );

        if ( $old_status !== $new_status ) {
            do_action( 'mmed_status_changed', $post_id, $old_status, $new_status );
        }
        if ( 'approved' === $new_status ) {
            $student_id = get_post_meta( $post_id, '_mmed_student_id', true );
            MMED_User_Meta::check_placement_ready( absint( $student_id ) );
        }

        wp_send_json_success( array(
            'status' => $new_status,
            'label'  => self::status_label( $new_status ),
            'color'  => self::status_color( $new_status ),
        ) );
    }
}
