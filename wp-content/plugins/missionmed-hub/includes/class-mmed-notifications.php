<?php
/**
 * MissionMed Hub — Notification System.
 *
 * Email notifications for file uploads, status changes,
 * and placement readiness.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMED_Notifications {

    /** From email for all Hub notifications. */
    const FROM_EMAIL = 'noreply@missionmedinstitute.com';
    const FROM_NAME  = 'MissionMed Institute';

    /* ── File Uploaded → Notify Reviewer ─────────────────────────── */

    /**
     * Fires on mmed_file_uploaded action.
     *
     * @param int $task_id Task post ID.
     * @param int $user_id Student user ID.
     */
    public static function on_file_uploaded( $task_id, $user_id ) {
        $reviewer_id = absint( get_post_meta( $task_id, '_mmed_reviewer_id', true ) );
        if ( ! $reviewer_id ) {
            return;
        }

        $reviewer = get_userdata( $reviewer_id );
        if ( ! $reviewer || ! $reviewer->user_email ) {
            return;
        }

        $student   = get_userdata( $user_id );
        $task_title = get_the_title( $task_id );
        $student_name = $student ? $student->display_name : 'Unknown Student';

        $subject = "[MissionMed Hub] File Uploaded: {$task_title}";
        $message = "Hi {$reviewer->display_name},\n\n"
            . "{$student_name} has uploaded a file for the following task:\n\n"
            . "Task: {$task_title}\n"
            . "Status: Under Review\n\n"
            . "Please log in to the WordPress admin to review the submission.\n\n"
            . admin_url( "post.php?post={$task_id}&action=edit" ) . "\n\n"
            . "— MissionMed Hub";

        self::send( $reviewer->user_email, $subject, $message );
    }

    /* ── Status Changed → Notify Student ─────────────────────────── */

    /**
     * Fires on mmed_status_changed action.
     *
     * @param int    $task_id    Task post ID.
     * @param string $old_status Previous status.
     * @param string $new_status New status.
     */
    public static function on_status_changed( $task_id, $old_status, $new_status ) {
        // Only notify student for approved and revision_needed.
        if ( ! in_array( $new_status, array( 'approved', 'revision_needed' ), true ) ) {
            return;
        }

        $student_id = absint( get_post_meta( $task_id, '_mmed_student_id', true ) );
        if ( ! $student_id ) {
            return;
        }

        $student = get_userdata( $student_id );
        if ( ! $student || ! $student->user_email ) {
            return;
        }

        $task_title = get_the_title( $task_id );
        $staff_note = get_post_meta( $task_id, '_mmed_staff_note', true );

        if ( 'approved' === $new_status ) {
            $subject = "[MissionMed Hub] Task Approved: {$task_title}";
            $message = "Hi {$student->display_name},\n\n"
                . "Great news! Your task has been approved:\n\n"
                . "Task: {$task_title}\n"
                . "Status: Approved\n";
        } else {
            $subject = "[MissionMed Hub] Revision Needed: {$task_title}";
            $message = "Hi {$student->display_name},\n\n"
                . "Your task needs a revision:\n\n"
                . "Task: {$task_title}\n"
                . "Status: Revision Needed\n";
        }

        if ( $staff_note ) {
            $message .= "\nReviewer Note:\n{$staff_note}\n";
        }

        $message .= "\nLog in to your MissionMed Hub to view details and take action.\n\n"
            . site_url() . "\n\n"
            . "— MissionMed Hub";

        self::send( $student->user_email, $subject, $message );

        // If approved, check placement_ready for USCE students.
        if ( 'approved' === $new_status ) {
            MMED_User_Meta::check_placement_ready( $student_id );
        }
    }

    /* ── Placement Ready → Notify Phil ───────────────────────────── */

    /**
     * Fires on mmed_placement_ready action.
     *
     * @param int $user_id Student user ID.
     */
    public static function on_placement_ready( $user_id ) {
        $email = get_option( 'mmed_support_email_clinicals', '' );
        if ( ! $email ) {
            return;
        }

        $student = get_userdata( $user_id );
        $student_name = $student ? $student->display_name : 'User #' . $user_id;
        $student_email = $student ? $student->user_email : 'N/A';

        $subject = "[MissionMed Hub] Student Placement Ready: {$student_name}";
        $message = "Hi,\n\n"
            . "A student has completed all USCE onboarding tasks and is now placement-ready.\n\n"
            . "Student: {$student_name}\n"
            . "Email: {$student_email}\n"
            . "User ID: {$user_id}\n\n"
            . "All required documents have been uploaded and approved.\n\n"
            . "View student profile: " . admin_url( "user-edit.php?user_id={$user_id}" ) . "\n\n"
            . "— MissionMed Hub";

        self::send( $email, $subject, $message );
    }

    /* ── Send Helper ─────────────────────────────────────────────── */

    /**
     * Send a plain-text email with proper from headers.
     *
     * @param string $to      Recipient email.
     * @param string $subject Email subject.
     * @param string $message Email body (plain text).
     * @return bool Whether the email was sent.
     */
    private static function send( $to, $subject, $message ) {
        $headers = array(
            'From: ' . self::FROM_NAME . ' <' . self::FROM_EMAIL . '>',
            'Content-Type: text/plain; charset=UTF-8',
        );

        return wp_mail( $to, $subject, $message, $headers );
    }
}
