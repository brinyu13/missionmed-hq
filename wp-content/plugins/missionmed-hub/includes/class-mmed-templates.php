<?php
/**
 * MissionMed Hub — Task Templates.
 *
 * Defines hardcoded task templates for 360 Elite and USCE Onboarding.
 * Creates task sets on enrollment.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMED_Templates {

    /**
     * Get all available templates.
     *
     * @return array Template slug => template definition.
     */
    public static function get_templates() {
        return array(
            '360elite_onboarding' => self::template_360elite(),
            'usce_onboarding'     => self::template_usce(),
        );
    }

    /**
     * 360 Elite Match Mentorship — 12 tasks.
     */
    private static function template_360elite() {
        return array(
            'label'    => '360 Elite Match Mentorship',
            'division' => 'residency',
            'tier'     => '360elite',
            'tasks'    => array(
                array( 'title' => 'Upload Your Current CV',            'file' => true,  'offset' => 3,    'instructions' => 'Upload your most recent CV in PDF format. This will be reviewed by Dr. Brian and used to tailor your mentorship plan.' ),
                array( 'title' => 'Upload Personal Statement Draft 1', 'file' => true,  'offset' => 10,   'instructions' => 'Write and upload your first personal statement draft. Focus on authenticity — we will refine together.' ),
                array( 'title' => 'Book Introduction Call',            'file' => false, 'offset' => 5,    'instructions' => 'Schedule your first 1-on-1 call with Dr. Brian via Calendly. Use the "Book a Session" link in your Hub.' ),
                array( 'title' => 'Complete Interview Prep Module 1',  'file' => false, 'offset' => 14,   'instructions' => 'Complete all lessons in Interview Prep Module 1 on LearnDash. Mark this task as In Progress when you start.' ),
                array( 'title' => 'Upload Personal Statement Draft 2', 'file' => true,  'offset' => 21,   'instructions' => 'Upload your revised personal statement after incorporating feedback from Draft 1 review.' ),
                array( 'title' => 'Book Mock Interview 1',             'file' => false, 'offset' => 21,   'instructions' => 'Schedule your first mock interview via Calendly. Come prepared with your ERAS application draft.' ),
                array( 'title' => 'Complete Interview Prep Module 2',  'file' => false, 'offset' => 28,   'instructions' => 'Complete all lessons in Interview Prep Module 2.' ),
                array( 'title' => 'Book Mock Interview 2',             'file' => false, 'offset' => 35,   'instructions' => 'Schedule your second mock interview. Focus areas will be identified from Mock 1 feedback.' ),
                array( 'title' => 'Submit LOR Plan',                   'file' => true,  'offset' => 28,   'instructions' => 'Upload your Letter of Recommendation request plan. Include: target writers, specialties, timeline, and approach strategy.' ),
                array( 'title' => 'Build Rank List in RankListIQ',     'file' => false, 'offset' => 42,   'instructions' => 'Create your rank list strategy using the RankListIQ tool. Access it from your Quick Links.' ),
                array( 'title' => 'Book Final Strategy Session',       'file' => false, 'offset' => 49,   'instructions' => 'Schedule your final pre-match strategy session with Dr. Brian.' ),
                array( 'title' => 'Submit Match Confirmation',         'file' => true,  'offset' => null,  'instructions' => 'After Match Day, upload your match result letter. Congratulations — you made it!' ),
            ),
        );
    }

    /**
     * USCE Onboarding — 7 tasks.
     */
    private static function template_usce() {
        return array(
            'label'    => 'USCE Onboarding',
            'division' => 'clinicals',
            'tier'     => 'usce_onboarding',
            'tasks'    => array(
                array( 'title' => 'Upload HIPAA Training Certificate',   'file' => true, 'offset' => 7,  'instructions' => 'Complete HIPAA training and upload your certificate. Must be current within 12 months.' ),
                array( 'title' => 'Upload OSHA Training Certificate',    'file' => true, 'offset' => 7,  'instructions' => 'Complete OSHA training and upload your certificate.' ),
                array( 'title' => 'Upload ACLS Certification',           'file' => true, 'offset' => 14, 'instructions' => 'Upload your current ACLS card (front and back). Must not expire within 6 months.' ),
                array( 'title' => 'Upload BLS Certification',            'file' => true, 'offset' => 14, 'instructions' => 'Upload your current BLS card (front and back). Must not expire within 6 months.' ),
                array( 'title' => 'Upload Background Check Clearance',   'file' => true, 'offset' => 21, 'instructions' => 'Upload your background check clearance letter. Must be dated within the last 90 days.' ),
                array( 'title' => 'Upload Drug Screen Results',          'file' => true, 'offset' => 21, 'instructions' => 'Upload your drug screen results document. Must be dated within the last 30 days.' ),
                array( 'title' => 'Upload Immunization Records',         'file' => true, 'offset' => 21, 'instructions' => 'Upload your complete immunization records including: MMR, Varicella, Hepatitis B series, TB test, Tdap, and annual flu shot.' ),
            ),
        );
    }

    /**
     * Create a full task set for a user from a template.
     *
     * @param int    $user_id       WordPress user ID.
     * @param string $template_slug Template key.
     * @return int Number of tasks created.
     */
    public static function create_task_set( $user_id, $template_slug ) {
        $templates = self::get_templates();
        if ( ! isset( $templates[ $template_slug ] ) ) {
            return 0;
        }

        $tpl      = $templates[ $template_slug ];
        $division = $tpl['division'];
        $tier     = $tpl['tier'];
        $enrolled = get_user_meta( $user_id, '_mmed_enrolled_date', true ) ?: current_time( 'Y-m-d' );

        // Determine reviewer.
        $reviewer_option = 'residency' === $division ? 'mmed_reviewer_residency' : 'mmed_reviewer_clinicals';
        $reviewer_id     = absint( get_option( $reviewer_option, 1 ) );

        $count = 0;
        foreach ( $tpl['tasks'] as $i => $task ) {
            $sort = $i + 1;

            // Calculate due date.
            $due_date = '';
            if ( $task['offset'] !== null ) {
                $due_date = date( 'Y-m-d', strtotime( $enrolled . ' + ' . intval( $task['offset'] ) . ' days' ) );
            }

            $post_id = wp_insert_post( array(
                'post_type'   => 'mmed_task',
                'post_title'  => $task['title'],
                'post_status' => 'publish',
                'post_author' => $reviewer_id ?: 1,
            ) );

            if ( is_wp_error( $post_id ) ) {
                continue;
            }

            update_post_meta( $post_id, '_mmed_student_id',    $user_id );
            update_post_meta( $post_id, '_mmed_division',      $division );
            update_post_meta( $post_id, '_mmed_program_tier',  $tier );
            update_post_meta( $post_id, '_mmed_status',        'not_started' );
            update_post_meta( $post_id, '_mmed_due_date',      $due_date );
            update_post_meta( $post_id, '_mmed_sort_order',    $sort );
            update_post_meta( $post_id, '_mmed_instructions',  wp_kses_post( $task['instructions'] ) );
            update_post_meta( $post_id, '_mmed_requires_file', $task['file'] ? '1' : '0' );
            update_post_meta( $post_id, '_mmed_file_id',       '' );
            update_post_meta( $post_id, '_mmed_staff_note',    '' );
            update_post_meta( $post_id, '_mmed_reviewer_id',   $reviewer_id );
            update_post_meta( $post_id, '_mmed_template_id',   $template_slug );

            $count++;
        }

        return $count;
    }

    /**
     * Hook listener: fires on mmed_enrollment_complete action.
     *
     * @param int    $user_id       WordPress user ID.
     * @param string $template_slug Template slug (360elite or usce_onboarding).
     */
    public static function on_enrollment_complete( $user_id, $template_slug ) {
        // Map shorthand to full template slug if needed.
        $slug_map = array(
            '360elite' => '360elite_onboarding',
        );
        $template_slug = $slug_map[ $template_slug ] ?? $template_slug;

        $templates = self::get_templates();
        if ( ! isset( $templates[ $template_slug ] ) ) {
            return;
        }

        $tpl = $templates[ $template_slug ];

        // Set user meta.
        update_user_meta( $user_id, '_mmed_primary_division', $tpl['division'] );
        update_user_meta( $user_id, '_mmed_program_tier',     $tpl['tier'] );
        if ( ! get_user_meta( $user_id, '_mmed_enrolled_date', true ) ) {
            update_user_meta( $user_id, '_mmed_enrolled_date', current_time( 'Y-m-d' ) );
        }

        // Create tasks.
        self::create_task_set( $user_id, $template_slug );
    }
}
