<?php
/**
 * MissionMed Hub — File Upload System.
 *
 * AJAX upload handler, download handler, rate limiting, security checks.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMED_File_Upload {

    /** Max uploads per hour per user. */
    const RATE_LIMIT = 5;

    /** Max file size in bytes (10 MB). */
    const MAX_SIZE = 10485760;

    /** Allowed MIME types. */
    const ALLOWED_MIMES = array(
        'pdf'  => 'application/pdf',
        'doc'  => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
    );

    /* ── Upload Handler ───────────────────────────────────────────── */

    /**
     * AJAX: mmed_upload_file
     * Student uploads a file to a task.
     */
    public static function handle_upload() {
        // 1. Verify nonce.
        check_ajax_referer( 'mmed_hub_nonce', '_mmed_nonce' );

        // 2. Verify logged in.
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( array( 'message' => 'You must be logged in.' ), 403 );
        }

        $user_id = get_current_user_id();
        $task_id = absint( $_POST['task_id'] ?? 0 );

        // 3. Verify task exists and belongs to user.
        if ( ! $task_id || 'mmed_task' !== get_post_type( $task_id ) ) {
            wp_send_json_error( array( 'message' => 'Invalid task.' ), 400 );
        }

        $task_student = absint( get_post_meta( $task_id, '_mmed_student_id', true ) );
        if ( $task_student !== $user_id ) {
            wp_send_json_error( array( 'message' => 'Unauthorized.' ), 403 );
        }

        // 4. Verify task requires a file.
        $requires_file = get_post_meta( $task_id, '_mmed_requires_file', true );
        if ( '1' !== $requires_file ) {
            wp_send_json_error( array( 'message' => 'This task does not accept file uploads.' ), 400 );
        }

        // 5. Rate limit check.
        if ( ! self::check_rate_limit( $user_id ) ) {
            wp_send_json_error( array( 'message' => 'Too many uploads. Try again later.' ), 429 );
        }

        // 6. Verify file was sent.
        if ( empty( $_FILES['file'] ) ) {
            wp_send_json_error( array( 'message' => 'No file received.' ), 400 );
        }

        $file = $_FILES['file'];

        // 7. Check file size.
        if ( $file['size'] > self::MAX_SIZE ) {
            wp_send_json_error( array( 'message' => 'File too large. Maximum 10 MB.' ), 400 );
        }

        // 8. Server-side MIME validation.
        $filetype = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
        $ext      = strtolower( $filetype['ext'] ?? '' );
        if ( ! $ext || ! array_key_exists( $ext, self::ALLOWED_MIMES ) ) {
            wp_send_json_error( array( 'message' => 'File type not allowed. Accepted: PDF, DOC, DOCX, JPG, PNG.' ), 400 );
        }

        // 9. Enforce allowed MIME types on upload.
        add_filter( 'upload_mimes', array( __CLASS__, 'restrict_mimes' ) );

        // Temporarily raise size limit for this upload context.
        add_filter( 'upload_size_limit', function() { return self::MAX_SIZE; } );

        $upload = wp_handle_upload( $file, array( 'test_form' => false ) );

        remove_filter( 'upload_mimes', array( __CLASS__, 'restrict_mimes' ) );

        if ( isset( $upload['error'] ) ) {
            wp_send_json_error( array( 'message' => $upload['error'] ), 500 );
        }

        // 10. Delete old attachment if re-uploading.
        $old_file_id = get_post_meta( $task_id, '_mmed_file_id', true );
        if ( $old_file_id ) {
            wp_delete_attachment( $old_file_id, true );
        }

        // 11. Create attachment.
        $attachment_id = wp_insert_attachment( array(
            'post_title'     => sanitize_file_name( $file['name'] ),
            'post_content'   => '',
            'post_status'    => 'inherit',
            'post_mime_type' => $upload['type'],
            'post_parent'    => $task_id,
        ), $upload['file'], $task_id );

        if ( is_wp_error( $attachment_id ) ) {
            wp_send_json_error( array( 'message' => 'Failed to create attachment.' ), 500 );
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        $meta = wp_generate_attachment_metadata( $attachment_id, $upload['file'] );
        wp_update_attachment_metadata( $attachment_id, $meta );

        // 12. Update task meta.
        update_post_meta( $task_id, '_mmed_file_id', $attachment_id );

        // 13. Auto-set status to pending_review.
        $old_status = get_post_meta( $task_id, '_mmed_status', true );
        if ( in_array( $old_status, array( 'not_started', 'revision_needed', 'in_progress' ), true ) ) {
            update_post_meta( $task_id, '_mmed_status', 'pending_review' );
            do_action( 'mmed_status_changed', $task_id, $old_status, 'pending_review' );
        }

        // 14. Increment rate limit.
        self::increment_rate_limit( $user_id );

        // 15. Fire upload hook for notifications.
        do_action( 'mmed_file_uploaded', $task_id, $user_id );

        // 16. Return success.
        wp_send_json_success( array(
            'message'   => 'File uploaded successfully.',
            'file_name' => basename( $upload['file'] ),
            'status'    => 'pending_review',
            'label'     => 'Under Review',
        ) );
    }

    /* ── Download Handler ─────────────────────────────────────────── */

    /**
     * AJAX: mmed_download_file
     * Secure file download with capability check.
     */
    public static function handle_download() {
        // Verify nonce.
        check_ajax_referer( 'mmed_hub_nonce', '_mmed_nonce' );

        $task_id = absint( $_GET['task_id'] ?? 0 );
        if ( ! $task_id ) {
            wp_die( 'Invalid request.', 'Error', array( 'response' => 400 ) );
        }

        $file_id = absint( get_post_meta( $task_id, '_mmed_file_id', true ) );
        if ( ! $file_id ) {
            wp_die( 'No file found.', 'Error', array( 'response' => 404 ) );
        }

        // Authorization check.
        $user_id      = get_current_user_id();
        $task_student = absint( get_post_meta( $task_id, '_mmed_student_id', true ) );
        $reviewer_id  = absint( get_post_meta( $task_id, '_mmed_reviewer_id', true ) );

        $authorized = (
            $user_id === $task_student ||
            $user_id === $reviewer_id ||
            current_user_can( 'manage_options' )
        );

        if ( ! $authorized ) {
            wp_die( 'Unauthorized.', 'Error', array( 'response' => 403 ) );
        }

        // Serve the file.
        $file_path = get_attached_file( $file_id );
        if ( ! $file_path || ! file_exists( $file_path ) ) {
            wp_die( 'File not found.', 'Error', array( 'response' => 404 ) );
        }

        $mime = get_post_mime_type( $file_id );
        $name = basename( $file_path );

        header( 'Content-Type: ' . $mime );
        header( 'Content-Disposition: attachment; filename="' . $name . '"' );
        header( 'Content-Length: ' . filesize( $file_path ) );
        header( 'Cache-Control: no-cache, must-revalidate' );

        readfile( $file_path );
        exit;
    }

    /* ── MIME Restriction ─────────────────────────────────────────── */

    /**
     * Filter: restrict MIME types during Hub upload.
     */
    public static function restrict_mimes( $mimes ) {
        return self::ALLOWED_MIMES;
    }

    /* ── Rate Limiting ────────────────────────────────────────────── */

    /**
     * Check if user has uploads remaining this hour.
     *
     * @param int $user_id WordPress user ID.
     * @return bool True if under limit.
     */
    private static function check_rate_limit( $user_id ) {
        $key       = 'mmed_upload_' . $user_id;
        $timestamps = get_transient( $key );
        if ( ! is_array( $timestamps ) ) {
            return true;
        }

        // Prune timestamps older than 1 hour.
        $one_hour_ago = time() - 3600;
        $timestamps   = array_filter( $timestamps, function( $ts ) use ( $one_hour_ago ) {
            return $ts > $one_hour_ago;
        } );

        return count( $timestamps ) < self::RATE_LIMIT;
    }

    /**
     * Record an upload timestamp.
     *
     * @param int $user_id WordPress user ID.
     */
    private static function increment_rate_limit( $user_id ) {
        $key       = 'mmed_upload_' . $user_id;
        $timestamps = get_transient( $key );
        if ( ! is_array( $timestamps ) ) {
            $timestamps = array();
        }

        $timestamps[] = time();

        // Keep only last hour.
        $one_hour_ago = time() - 3600;
        $timestamps   = array_filter( $timestamps, function( $ts ) use ( $one_hour_ago ) {
            return $ts > $one_hour_ago;
        } );

        set_transient( $key, $timestamps, 3600 );
    }
}
