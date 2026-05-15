<?php
/**
 * Plugin Name: MissionMed Hub
 * Plugin URI:  https://missionmedinstitute.com
 * Description: Multi-division student command center for MissionMed Institute with LearnDash dashboards for Mission Residency, USMLE Exam Prep, and Clinicals.
 * Version:     1.5.1
 * Author:      MissionMed Institute
 * Author URI:  https://missionmedinstitute.com
 * Text Domain: missionmed-hub
 * License:     GPL-2.0+
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ── Constants ────────────────────────────────────────────────────── */
define( 'MMED_HUB_VERSION', '1.5.1' );
define( 'MMED_HUB_PATH',    plugin_dir_path( __FILE__ ) );
define( 'MMED_HUB_URL',     plugin_dir_url( __FILE__ ) );

/**
 * Read a named CSS block from assets/hub.css.
 *
 * Blocks are wrapped in comment markers:
 * `/* BLOCK_NAME_START *\/` ... `/* BLOCK_NAME_END *\/`
 *
 * @param string $block_name CSS block identifier.
 * @return string
 */
function mmed_hub_get_css_block( $block_name ) {
    static $css_source = null;

    if ( null === $css_source ) {
        $css_source = file_exists( MMED_HUB_PATH . 'assets/hub.css' )
            ? (string) file_get_contents( MMED_HUB_PATH . 'assets/hub.css' )
            : '';
    }

    if ( '' === $css_source || '' === $block_name ) {
        return '';
    }

    $pattern = sprintf(
        '/\/\*\s*%1$s_START\s*\*\/(.*?)\/\*\s*%1$s_END\s*\*\//s',
        preg_quote( $block_name, '/' )
    );

    if ( preg_match( $pattern, $css_source, $matches ) ) {
        return trim( $matches[1] );
    }

    return '';
}

/**
 * Canonical defaults for MissionMed Hub options.
 *
 * These values are used when an option has not been saved yet so enrollment,
 * auditing, and dashboard classification can still resolve the live mappings.
 *
 * @param string $key Option name.
 * @return mixed
 */
function mmed_hub_default_option_value( $key ) {
    $defaults = array(
        'mmed_calendly_url'             => 'https://calendly.com/d/cxmf-p2r-4sg',
        'mmed_support_email_residency'  => 'info@missionmedinstitute.com',
        'mmed_support_email_clinicals'  => 'clinicals@missionmedinstitute.com',
        'mmed_support_email_usmle'      => 'info@missionmedinstitute.com',
        'mmed_reviewer_residency'       => 1,
        'mmed_reviewer_clinicals'       => 0,
        'mmed_reviewer_usmle'           => 1,
        'mmed_product_360elite'         => 3575,
        'mmed_product_complete'         => 3576,
        'mmed_product_foundation'       => 3577,
        'mmed_product_usce'             => 3784,
        'mmed_course_360elite'          => 3893,
        'mmed_course_complete'          => 5227,
        'mmed_course_foundation'        => 3646,
        'mmed_course_usmle'             => 0,
        'mmed_course_usce'              => 0,
        'mmed_group_residency'          => 0,
        'mmed_group_usmle'              => 0,
        'mmed_group_clinicals'          => 0,
        'mmed_student_os_enabled'       => 0,
        'mmed_ssa_sync_enabled'         => 0,
    );

    return $defaults[ $key ] ?? 0;
}

/**
 * Determine whether MissionMed Matrix is enabled.
 *
 * @return bool
 */
function mmed_hub_is_student_os_enabled() {
    return (bool) get_option( 'mmed_student_os_enabled', false );
}

/* ── Includes ─────────────────────────────────────────────────────── */
require_once MMED_HUB_PATH . 'includes/class-mmed-task-cpt.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-templates.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-hub-page.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-lifecycle.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-priority-engine.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-file-upload.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-user-meta.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-notifications.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-access-audit.php';

if ( mmed_hub_is_student_os_enabled() ) {
    require_once MMED_HUB_PATH . 'includes/class-mmed-student-os.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-rest-api.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-calendar-engine.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-file-vault.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-study-schedule.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-supabase-bridge.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-ranklist.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-lor-writer.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-arena.php';
    require_once MMED_HUB_PATH . 'includes/class-mmed-ssa-adapter.php';
}

MMED_Access_Audit::init();

/* ── Activation ───────────────────────────────────────────────────── */
register_activation_hook( __FILE__, 'mmed_hub_activate' );
function mmed_hub_activate() {
    // Register CPT so rewrite rules can be flushed.
    MMED_Task_CPT::register_post_type();
    flush_rewrite_rules();

    // Set default options if not already present.
    $default_keys = array(
        'mmed_calendly_url',
        'mmed_support_email_residency',
        'mmed_support_email_clinicals',
        'mmed_support_email_usmle',
        'mmed_reviewer_residency',
        'mmed_reviewer_clinicals',
        'mmed_reviewer_usmle',
        'mmed_product_360elite',
        'mmed_product_complete',
        'mmed_product_foundation',
        'mmed_product_usce',
        'mmed_course_360elite',
        'mmed_course_complete',
        'mmed_course_foundation',
        'mmed_course_usmle',
        'mmed_group_usmle',
        'mmed_student_os_enabled',
        'mmed_ssa_sync_enabled',
    );

    foreach ( $default_keys as $option_key ) {
        if ( false === get_option( $option_key ) ) {
            update_option( $option_key, mmed_hub_default_option_value( $option_key ) );
        }
    }
}

/* ── Deactivation ─────────────────────────────────────────────────── */
register_deactivation_hook( __FILE__, 'mmed_hub_deactivate' );
function mmed_hub_deactivate() {
    if ( file_exists( MMED_HUB_PATH . 'includes/class-mmed-ssa-adapter.php' ) ) {
        require_once MMED_HUB_PATH . 'includes/class-mmed-ssa-adapter.php';
    }

    if ( class_exists( 'MMED_SSA_Adapter' ) ) {
        MMED_SSA_Adapter::cleanup();
    }

    flush_rewrite_rules();
}

/* ── Init Hooks ───────────────────────────────────────────────────── */
add_action( 'init', array( 'MMED_Task_CPT', 'register_post_type' ) );
add_action( 'init', array( 'MMED_Hub_Page', 'init' ) );
if ( class_exists( 'MMED_Student_OS' ) ) {
    add_action( 'init', array( 'MMED_Student_OS', 'init' ) );
}
if ( class_exists( 'MMED_Calendar_Engine' ) ) {
    add_action( 'init', array( 'MMED_Calendar_Engine', 'init' ) );
}
if ( class_exists( 'MMED_File_Vault' ) ) {
    add_action( 'init', array( 'MMED_File_Vault', 'init' ) );
}
if ( class_exists( 'MMED_Study_Schedule' ) ) {
    add_action( 'init', array( 'MMED_Study_Schedule', 'init' ) );
}
if ( class_exists( 'MMED_Supabase_Bridge' ) ) {
    add_action( 'init', array( 'MMED_Supabase_Bridge', 'init' ) );
}
if ( class_exists( 'MMED_Ranklist' ) ) {
    add_action( 'init', array( 'MMED_Ranklist', 'init' ) );
}
if ( class_exists( 'MMED_LOR_Writer' ) ) {
    add_action( 'init', array( 'MMED_LOR_Writer', 'init' ) );
}
if ( class_exists( 'MMED_Arena' ) ) {
    add_action( 'init', array( 'MMED_Arena', 'init' ) );
}
if ( class_exists( 'MMED_SSA_Adapter' ) ) {
    add_action( 'init', array( 'MMED_SSA_Adapter', 'init' ) );
}
if ( class_exists( 'MMED_REST_API' ) ) {
    MMED_REST_API::init();
}

/* Admin hooks */
add_action( 'admin_init',           array( 'MMED_Task_CPT',    'register_meta_fields' ) );
add_action( 'add_meta_boxes',       array( 'MMED_Task_CPT',    'add_meta_boxes' ) );
add_action( 'save_post_mmed_task',  array( 'MMED_Task_CPT',    'save_meta' ), 10, 2 );
add_action( 'admin_menu',           'mmed_hub_admin_menu' );

/* Admin columns & filters */
add_filter( 'manage_mmed_task_posts_columns',         array( 'MMED_Task_CPT', 'admin_columns' ) );
add_action( 'manage_mmed_task_posts_custom_column',   array( 'MMED_Task_CPT', 'admin_column_content' ), 10, 2 );
add_filter( 'manage_edit-mmed_task_sortable_columns',  array( 'MMED_Task_CPT', 'sortable_columns' ) );
add_action( 'restrict_manage_posts',                   array( 'MMED_Task_CPT', 'admin_filters' ) );
add_action( 'pre_get_posts',                           array( 'MMED_Task_CPT', 'filter_query' ) );

/* Bulk actions */
add_filter( 'bulk_actions-edit-mmed_task',        array( 'MMED_Task_CPT', 'register_bulk_actions' ) );
add_filter( 'handle_bulk_actions-edit-mmed_task', array( 'MMED_Task_CPT', 'handle_bulk_actions' ), 10, 3 );
add_action( 'admin_notices',                      array( 'MMED_Task_CPT', 'bulk_action_notices' ) );

/* AJAX handlers */
add_action( 'wp_ajax_mmed_upload_file',   array( 'MMED_File_Upload', 'handle_upload' ) );
add_action( 'wp_ajax_mmed_download_file', array( 'MMED_File_Upload', 'handle_download' ) );
add_action( 'wp_ajax_mmed_quick_status',  array( 'MMED_Task_CPT',    'ajax_quick_status' ) );

/* Enrollment automation hook */
add_action( 'mmed_enrollment_complete', array( 'MMED_Templates', 'on_enrollment_complete' ), 10, 2 );

/* WooCommerce order hook — fallback if Automator not available */
add_action( 'woocommerce_order_status_completed',  'mmed_woo_order_complete' );
add_action( 'woocommerce_order_status_processing', 'mmed_woo_order_complete' );

/* User profile hooks */
add_action( 'show_user_profile',         array( 'MMED_User_Meta', 'user_profile_section' ) );
add_action( 'edit_user_profile',         array( 'MMED_User_Meta', 'user_profile_section' ) );
add_action( 'wp_ajax_mmed_rerun_enroll', array( 'MMED_User_Meta', 'ajax_rerun_enrollment' ) );

/* User list columns */
add_filter( 'manage_users_columns',        array( 'MMED_User_Meta', 'user_columns' ) );
add_filter( 'manage_users_custom_column',  array( 'MMED_User_Meta', 'user_column_content' ), 10, 3 );

/* LearnDash course meta box for session card */
add_action( 'add_meta_boxes', 'mmed_session_meta_box' );
add_action( 'save_post',      'mmed_save_session_meta', 10, 2 );
add_action( 'save_post_sfwd-lessons', array( 'MMED_Hub_Page', 'sync_lesson_video_meta' ), 20, 2 );
add_action( 'media_buttons', 'mmed_hub_render_video_insert_button', 20 );
add_action( 'admin_footer-post.php', 'mmed_hub_render_video_inserter_modal' );
add_action( 'admin_footer-post-new.php', 'mmed_hub_render_video_inserter_modal' );

/* Notification hooks */
add_action( 'mmed_file_uploaded',   array( 'MMED_Notifications', 'on_file_uploaded' ), 10, 2 );
add_action( 'mmed_status_changed',  array( 'MMED_Notifications', 'on_status_changed' ), 10, 3 );
add_action( 'mmed_placement_ready', array( 'MMED_Notifications', 'on_placement_ready' ), 10, 1 );

/* ── Asset Enqueue ────────────────────────────────────────────────── */
add_action( 'wp_enqueue_scripts', 'mmed_hub_enqueue_frontend' );
function mmed_hub_enqueue_frontend() {
    if ( ! MMED_Hub_Page::is_hub_page() ) {
        return;
    }

    if ( mmed_hub_is_student_os_enabled() && class_exists( 'MMED_Student_OS' ) ) {
        MMED_Student_OS::enqueue_assets();
        return;
    }

    wp_enqueue_style(
        'mmed-hub-css',
        MMED_HUB_URL . 'assets/hub.css',
        array(),
        MMED_HUB_VERSION
    );
    wp_enqueue_script(
        'mmed-hub-js',
        MMED_HUB_URL . 'assets/hub.js',
        array(),
        MMED_HUB_VERSION,
        true
    );
    wp_localize_script( 'mmed-hub-js', 'mmedHub', array(
        'ajax_url' => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'mmed_hub_nonce' ),
    ) );
}

/* Admin assets (quick-edit JS) */
add_action( 'admin_enqueue_scripts', 'mmed_hub_enqueue_admin' );
function mmed_hub_enqueue_admin( $hook ) {
    $screen = get_current_screen();
    $screen_id = $screen ? $screen->id : '';

    if ( $screen && 'mmed_task' === $screen->post_type ) {
        wp_enqueue_script(
            'mmed-admin-js',
            MMED_HUB_URL . 'assets/admin.js',
            array( 'jquery' ),
            MMED_HUB_VERSION,
            true
        );
        wp_localize_script( 'mmed-admin-js', 'mmedAdmin', array(
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'mmed_admin_nonce' ),
        ) );
        wp_enqueue_style(
            'mmed-admin-css',
            MMED_HUB_URL . 'assets/admin.css',
            array(),
            MMED_HUB_VERSION
        );
    }

    if ( in_array( $screen_id, array( 'settings_page_mmed-hub-settings', 'settings_page_' . MMED_Access_Audit::PAGE_SLUG ), true ) ) {
        wp_enqueue_style(
            'mmed-admin-css',
            MMED_HUB_URL . 'assets/admin.css',
            array(),
            MMED_HUB_VERSION
        );
    }

    if ( mmed_hub_is_video_editor_screen( $screen ) ) {
        $post_id        = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $post           = $post_id ? get_post( $post_id ) : null;
        $bootstrap      = MMED_Hub_Page::get_video_editor_bootstrap( $post_id );
        $inline_css     = mmed_hub_get_css_block( 'MMED_VIDEO_INSERTER_ADMIN' );
        $is_block_editor = false;

        if ( $post && function_exists( 'use_block_editor_for_post' ) ) {
            $is_block_editor = (bool) use_block_editor_for_post( $post );
        } elseif ( function_exists( 'use_block_editor_for_post_type' ) ) {
            $is_block_editor = (bool) use_block_editor_for_post_type( 'sfwd-lessons' );
        }

        wp_enqueue_script(
            'mmed-hub-js',
            MMED_HUB_URL . 'assets/hub.js',
            array(),
            MMED_HUB_VERSION,
            true
        );

        wp_localize_script(
            'mmed-hub-js',
            'mmedHub',
            array(
                'ajax_url'      => admin_url( 'admin-ajax.php' ),
                'nonce'         => wp_create_nonce( 'mmed_hub_nonce' ),
                'videoInserter' => array(
                    'enabled'          => true,
                    'postId'           => $post_id,
                    'postType'         => 'sfwd-lessons',
                    'isBlockEditor'    => $is_block_editor,
                    'manifest'         => $bootstrap['videos'],
                    'categories'       => $bootstrap['categories'],
                    'generatedAt'      => $bootstrap['generated_at'],
                    'statusMessage'    => $bootstrap['status_message'],
                    'currentVideoIds'  => $bootstrap['post_video_ids'],
                    'insertLabel'      => 'Insert Video',
                    'replaceLabel'     => 'Replace Video',
                    'buttonLabel'      => 'Insert Video',
                    'searchPlaceholder'=> 'Search videos by title, ID, or topic...',
                ),
            )
        );

        if ( $inline_css ) {
            wp_register_style( 'mmed-video-inserter-inline', false, array(), MMED_HUB_VERSION );
            wp_enqueue_style( 'mmed-video-inserter-inline' );
            wp_add_inline_style( 'mmed-video-inserter-inline', $inline_css );
        }
    }
}

/**
 * Whether the current admin screen is a LearnDash lesson editor.
 *
 * @param WP_Screen|null $screen Screen object.
 * @return bool
 */
function mmed_hub_is_video_editor_screen( $screen = null ) {
    if ( ! $screen ) {
        $screen = get_current_screen();
    }

    if ( ! $screen ) {
        return false;
    }

    return 'sfwd-lessons' === $screen->post_type && in_array( $screen->base, array( 'post', 'post-new' ), true );
}

/**
 * Classic editor button for launching the lesson video picker.
 *
 * @return void
 */
function mmed_hub_render_video_insert_button() {
    if ( ! mmed_hub_is_video_editor_screen() ) {
        return;
    }
    ?>
    <button
        type="button"
        class="button button-secondary mmed-video-launch-button"
        data-mmed-video-launch
        aria-haspopup="dialog"
    >
        <span class="dashicons dashicons-video-alt3" aria-hidden="true"></span>
        Insert Video
    </button>
    <?php
}

/**
 * Shared modal shell for the LearnDash lesson video inserter.
 *
 * @return void
 */
function mmed_hub_render_video_inserter_modal() {
    if ( ! mmed_hub_is_video_editor_screen() ) {
        return;
    }
    ?>
    <div class="mmed-video-inserter-app" id="mmed-video-inserter-app" hidden aria-hidden="true">
        <div class="mmed-video-inserter-backdrop" data-mmed-video-close></div>
        <div class="mmed-video-inserter-dialog" role="dialog" aria-modal="true" aria-labelledby="mmed-video-inserter-title">
            <button type="button" class="mmed-video-inserter-close" data-mmed-video-close aria-label="Close video library">
                <span class="dashicons dashicons-no-alt" aria-hidden="true"></span>
            </button>

            <div class="mmed-video-inserter-shell">
                <section class="mmed-video-inserter-main" aria-label="MissionMed video library">
                    <div class="mmed-video-inserter-topbar">
                        <div class="mmed-video-inserter-copy">
                            <span class="mmed-video-inserter-kicker" data-mmed-video-mode>MissionMed Lesson Editor</span>
                            <h2 class="mmed-video-inserter-title" id="mmed-video-inserter-title">Video Library</h2>
                            <p class="mmed-video-inserter-description">Search the manifest-backed library, preview a video, and insert or replace a shortcode inside this lesson.</p>
                        </div>
                        <div class="mmed-video-inserter-context" data-mmed-video-context hidden></div>
                    </div>

                    <div class="mmed-video-inserter-toolbar">
                        <label class="mmed-video-inserter-search">
                            <span class="screen-reader-text">Search videos</span>
                            <input type="search" data-mmed-video-search placeholder="Search videos..." autocomplete="off" />
                        </label>

                        <label class="mmed-video-inserter-filter">
                            <span class="screen-reader-text">Filter by category</span>
                            <select data-mmed-video-category>
                                <option value="all">All categories</option>
                            </select>
                        </label>
                    </div>

                    <p class="mmed-video-inserter-summary" data-mmed-video-summary>Loading videos...</p>
                    <div class="mmed-video-inserter-grid" data-mmed-video-grid></div>
                    <div class="mmed-video-inserter-empty" data-mmed-video-empty hidden>No videos match the current filters.</div>
                </section>

                <aside class="mmed-video-inserter-preview" aria-label="Selected video preview">
                    <div class="mmed-video-inserter-preview-empty" data-mmed-video-preview-empty>Select a video to preview it here.</div>

                    <div class="mmed-video-inserter-preview-card" data-mmed-video-preview hidden>
                        <div class="mmed-video-inserter-preview-media">
                            <video class="mmed-video-inserter-preview-player" data-mmed-video-player controls preload="metadata" playsinline hidden></video>
                            <iframe class="mmed-video-inserter-preview-embed" data-mmed-video-embed title="MissionMed video preview" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen hidden></iframe>
                        </div>

                        <div class="mmed-video-inserter-preview-copy">
                            <p class="mmed-video-inserter-preview-overline" data-mmed-video-preview-division></p>
                            <h3 class="mmed-video-inserter-preview-title" data-mmed-video-preview-title>Video title</h3>
                            <div class="mmed-video-inserter-preview-meta">
                                <span data-mmed-video-preview-duration></span>
                                <span data-mmed-video-preview-category></span>
                            </div>
                        </div>

                        <div class="mmed-video-inserter-actions">
                            <button type="button" class="button button-primary mmed-video-inserter-primary" data-mmed-video-insert disabled>Insert Video</button>
                            <button type="button" class="button button-secondary" data-mmed-video-close>Cancel</button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    </div>
    <?php
}

/* ── WooCommerce Order Fallback ───────────────────────────────────── */
/**
 * Fallback enrollment trigger when Uncanny Automator is not handling it.
 * Fires on order completed/processing. Checks for known product IDs.
 */
function mmed_woo_order_complete( $order_id ) {
    MMED_Access_Audit::clear_cache();

    if ( ! function_exists( 'wc_get_order' ) ) {
        return;
    }

    $order = wc_get_order( $order_id );
    if ( ! $order ) {
        return;
    }

    $user_id = $order->get_user_id();
    if ( ! $user_id ) {
        return;
    }

    $product_map = array();
    foreach ( MMED_Access_Audit::get_program_mappings() as $mapping ) {
        if ( ! empty( $mapping['product_id'] ) ) {
            $product_map[ (int) $mapping['product_id'] ] = $mapping;
        }
    }

    if ( empty( $product_map ) ) {
        return;
    }

    foreach ( $order->get_items() as $item ) {
        $product_id = (int) $item->get_product_id();
        if ( ! isset( $product_map[ $product_id ] ) ) {
            continue;
        }

        $mapping       = $product_map[ $product_id ];
        $template_slug = $mapping['template_slug'];
        $should_fire_template = ! empty( $template_slug );

        if ( $should_fire_template ) {
            $existing = get_posts( array(
                'post_type'   => 'mmed_task',
                'numberposts' => 1,
                'fields'      => 'ids',
                'meta_query'  => array(
                    array(
                        'key'   => '_mmed_student_id',
                        'value' => $user_id,
                    ),
                    array(
                        'key'   => '_mmed_template_id',
                        'value' => $template_slug,
                    ),
                ),
            ) );

            if ( ! empty( $existing ) ) {
                $should_fire_template = false;
            }
        }

        if ( function_exists( 'ld_update_course_access' ) && ! empty( $mapping['course_id'] ) ) {
            ld_update_course_access( $user_id, (int) $mapping['course_id'] );
        }

        if ( function_exists( 'ld_update_group_access' ) && ! empty( $mapping['group_id'] ) ) {
            ld_update_group_access( $user_id, (int) $mapping['group_id'] );
        }

        if ( $should_fire_template ) {
            do_action( 'mmed_enrollment_complete', $user_id, $template_slug );
        }
    }
}

/* ── Settings Page ────────────────────────────────────────────────── */
function mmed_hub_admin_menu() {
    add_options_page(
        'MissionMed Hub Settings',
        'MissionMed Hub',
        'manage_options',
        'mmed-hub-settings',
        'mmed_hub_settings_page'
    );
}

function mmed_hub_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $supabase_sync_result = null;

    // Run Matrix Supabase account linking without touching other Hub settings.
    if ( isset( $_POST['mmed_supabase_sync_nonce'] ) && wp_verify_nonce( $_POST['mmed_supabase_sync_nonce'], 'mmed_supabase_sync_users' ) ) {
        if ( class_exists( 'MMED_Supabase_Bridge' ) ) {
            $supabase_sync_result = MMED_Supabase_Bridge::sync_all_users();
            echo '<div class="notice notice-success"><p>' . esc_html( $supabase_sync_result['message'] ?? 'Supabase account sync complete.' ) . '</p></div>';
        } else {
            $supabase_sync_result = array(
                'message' => 'Enable Matrix and reload this settings page before running Supabase account linking.',
            );
            echo '<div class="notice notice-warning"><p>' . esc_html( $supabase_sync_result['message'] ) . '</p></div>';
        }
    }

    // Save settings.
    if ( isset( $_POST['mmed_settings_nonce'] ) && wp_verify_nonce( $_POST['mmed_settings_nonce'], 'mmed_save_settings' ) ) {
        update_option( 'mmed_calendly_url',             sanitize_url( $_POST['mmed_calendly_url'] ?? '' ) );
        update_option( 'mmed_support_email_residency', sanitize_email( $_POST['mmed_support_email_residency'] ?? '' ) );
        update_option( 'mmed_support_email_usmle',      sanitize_email( $_POST['mmed_support_email_usmle'] ?? '' ) );
        update_option( 'mmed_support_email_clinicals',  sanitize_email( $_POST['mmed_support_email_clinicals'] ?? '' ) );
        update_option( 'mmed_reviewer_residency',       absint( $_POST['mmed_reviewer_residency'] ?? 1 ) );
        update_option( 'mmed_reviewer_usmle',           absint( $_POST['mmed_reviewer_usmle'] ?? 1 ) );
        update_option( 'mmed_reviewer_clinicals',       absint( $_POST['mmed_reviewer_clinicals'] ?? 0 ) );
        update_option( 'mmed_product_360elite',         absint( $_POST['mmed_product_360elite'] ?? mmed_hub_default_option_value( 'mmed_product_360elite' ) ) );
        update_option( 'mmed_product_complete',         absint( $_POST['mmed_product_complete'] ?? mmed_hub_default_option_value( 'mmed_product_complete' ) ) );
        update_option( 'mmed_product_foundation',       absint( $_POST['mmed_product_foundation'] ?? mmed_hub_default_option_value( 'mmed_product_foundation' ) ) );
        update_option( 'mmed_product_usce',             absint( $_POST['mmed_product_usce'] ?? mmed_hub_default_option_value( 'mmed_product_usce' ) ) );
        update_option( 'mmed_course_360elite',          absint( $_POST['mmed_course_360elite'] ?? mmed_hub_default_option_value( 'mmed_course_360elite' ) ) );
        update_option( 'mmed_course_complete',          absint( $_POST['mmed_course_complete'] ?? mmed_hub_default_option_value( 'mmed_course_complete' ) ) );
        update_option( 'mmed_course_foundation',        absint( $_POST['mmed_course_foundation'] ?? mmed_hub_default_option_value( 'mmed_course_foundation' ) ) );
        update_option( 'mmed_course_usmle',             absint( $_POST['mmed_course_usmle'] ?? mmed_hub_default_option_value( 'mmed_course_usmle' ) ) );
        update_option( 'mmed_course_usce',              absint( $_POST['mmed_course_usce'] ?? mmed_hub_default_option_value( 'mmed_course_usce' ) ) );
        update_option( 'mmed_group_residency',          absint( $_POST['mmed_group_residency'] ?? mmed_hub_default_option_value( 'mmed_group_residency' ) ) );
        update_option( 'mmed_group_usmle',              absint( $_POST['mmed_group_usmle'] ?? mmed_hub_default_option_value( 'mmed_group_usmle' ) ) );
        update_option( 'mmed_group_clinicals',          absint( $_POST['mmed_group_clinicals'] ?? mmed_hub_default_option_value( 'mmed_group_clinicals' ) ) );
        update_option( 'mmed_student_os_enabled',       ! empty( $_POST['mmed_student_os_enabled'] ) ? 1 : 0 );
        update_option( 'mmed_ssa_sync_enabled',         ! empty( $_POST['mmed_ssa_sync_enabled'] ) ? 1 : 0 );
        if ( class_exists( 'MMED_SSA_Adapter' ) ) {
            MMED_SSA_Adapter::maybe_schedule();
        }
        MMED_Access_Audit::clear_cache();
        echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
    }

    $calendly           = get_option( 'mmed_calendly_url', '' );
    $email_res          = get_option( 'mmed_support_email_residency', '' );
    $email_usmle        = get_option( 'mmed_support_email_usmle', '' );
    $email_clin         = get_option( 'mmed_support_email_clinicals', '' );
    $rev_res            = get_option( 'mmed_reviewer_residency', 1 );
    $rev_usmle          = get_option( 'mmed_reviewer_usmle', 1 );
    $rev_clin           = get_option( 'mmed_reviewer_clinicals', 0 );
    $p_360              = get_option( 'mmed_product_360elite', mmed_hub_default_option_value( 'mmed_product_360elite' ) );
    $p_complete         = get_option( 'mmed_product_complete', mmed_hub_default_option_value( 'mmed_product_complete' ) );
    $p_found            = get_option( 'mmed_product_foundation', mmed_hub_default_option_value( 'mmed_product_foundation' ) );
    $p_usce             = get_option( 'mmed_product_usce', mmed_hub_default_option_value( 'mmed_product_usce' ) );
    $c_360              = get_option( 'mmed_course_360elite', mmed_hub_default_option_value( 'mmed_course_360elite' ) );
    $c_complete         = get_option( 'mmed_course_complete', mmed_hub_default_option_value( 'mmed_course_complete' ) );
    $c_found            = get_option( 'mmed_course_foundation', mmed_hub_default_option_value( 'mmed_course_foundation' ) );
    $c_usmle            = get_option( 'mmed_course_usmle', mmed_hub_default_option_value( 'mmed_course_usmle' ) );
    $c_usce             = get_option( 'mmed_course_usce', mmed_hub_default_option_value( 'mmed_course_usce' ) );
    $g_res              = get_option( 'mmed_group_residency', mmed_hub_default_option_value( 'mmed_group_residency' ) );
    $g_usmle            = get_option( 'mmed_group_usmle', mmed_hub_default_option_value( 'mmed_group_usmle' ) );
    $g_clin             = get_option( 'mmed_group_clinicals', mmed_hub_default_option_value( 'mmed_group_clinicals' ) );
    $student_os_enabled = (int) get_option( 'mmed_student_os_enabled', 0 );
    $ssa_sync_enabled   = (int) get_option( 'mmed_ssa_sync_enabled', 0 );
    $ssa_status         = class_exists( 'MMED_SSA_Adapter' ) ? MMED_SSA_Adapter::status() : array(
        'active'  => false,
        'message' => 'Matrix must be enabled before the SSA adapter can load.',
    );
    $supabase_rows      = class_exists( 'MMED_Supabase_Bridge' ) ? MMED_Supabase_Bridge::get_admin_link_rows() : array();
    $supabase_counts    = class_exists( 'MMED_Supabase_Bridge' ) ? MMED_Supabase_Bridge::get_admin_link_counts( $supabase_rows ) : array(
        'linked' => 0,
        'total'  => 0,
    );

    // Get admin/editor users for reviewer dropdowns.
    $reviewers = get_users( array( 'role__in' => array( 'administrator', 'editor' ), 'orderby' => 'display_name' ) );
    ?>
    <div class="wrap">
        <h1>MissionMed Hub Settings</h1>
        <p><a href="<?php echo esc_url( admin_url( 'options-general.php?page=' . MMED_Access_Audit::PAGE_SLUG ) ); ?>" class="button button-secondary">Open MissionMed Access Audit</a></p>
        <form method="post">
            <?php wp_nonce_field( 'mmed_save_settings', 'mmed_settings_nonce' ); ?>
            <table class="form-table">
                <tr>
                    <th><label for="mmed_student_os_enabled">MissionMed Matrix</label></th>
                    <td>
                        <label>
                            <input type="checkbox" id="mmed_student_os_enabled" name="mmed_student_os_enabled" value="1" <?php checked( $student_os_enabled, 1 ); ?> />
                            Enable Matrix on the member dashboard
                        </label>
                        <p class="description">When enabled, authenticated students on the Hub route see the feature-flagged Matrix shell. When disabled, the legacy Hub renders unchanged.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="mmed_ssa_sync_enabled">SSA Calendar Sync</label></th>
                    <td>
                        <label>
                            <input type="checkbox" id="mmed_ssa_sync_enabled" name="mmed_ssa_sync_enabled" value="1" <?php checked( $ssa_sync_enabled, 1 ); ?> />
                            Enable Simply Schedule Appointments sync into Matrix Calendar
                        </label>
                        <p class="description"><?php echo esc_html( $ssa_status['message'] ?? '' ); ?> Sync remains dormant unless SSA is installed and this option is checked.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="mmed_calendly_url">Calendly Booking URL</label></th>
                    <td><input type="url" id="mmed_calendly_url" name="mmed_calendly_url" value="<?php echo esc_attr( $calendly ); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th><label for="mmed_support_email_residency">Support Email (Residency)</label></th>
                    <td><input type="email" id="mmed_support_email_residency" name="mmed_support_email_residency" value="<?php echo esc_attr( $email_res ); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th><label for="mmed_support_email_clinicals">Support Email (Clinicals)</label></th>
                    <td><input type="email" id="mmed_support_email_clinicals" name="mmed_support_email_clinicals" value="<?php echo esc_attr( $email_clin ); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th><label for="mmed_support_email_usmle">Support Email (USMLE)</label></th>
                    <td><input type="email" id="mmed_support_email_usmle" name="mmed_support_email_usmle" value="<?php echo esc_attr( $email_usmle ); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th><label for="mmed_reviewer_residency">Default Reviewer (Residency)</label></th>
                    <td>
                        <select id="mmed_reviewer_residency" name="mmed_reviewer_residency">
                            <option value="0">— Select —</option>
                            <?php foreach ( $reviewers as $u ) : ?>
                                <option value="<?php echo esc_attr( $u->ID ); ?>" <?php selected( $rev_res, $u->ID ); ?>><?php echo esc_html( $u->display_name ); ?> (ID: <?php echo esc_html( $u->ID ); ?>)</option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th><label for="mmed_reviewer_clinicals">Default Reviewer (Clinicals)</label></th>
                    <td>
                        <select id="mmed_reviewer_clinicals" name="mmed_reviewer_clinicals">
                            <option value="0">— Select —</option>
                            <?php foreach ( $reviewers as $u ) : ?>
                                <option value="<?php echo esc_attr( $u->ID ); ?>" <?php selected( $rev_clin, $u->ID ); ?>><?php echo esc_html( $u->display_name ); ?> (ID: <?php echo esc_html( $u->ID ); ?>)</option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th><label for="mmed_reviewer_usmle">Default Reviewer (USMLE)</label></th>
                    <td>
                        <select id="mmed_reviewer_usmle" name="mmed_reviewer_usmle">
                            <option value="0">— Select —</option>
                            <?php foreach ( $reviewers as $u ) : ?>
                                <option value="<?php echo esc_attr( $u->ID ); ?>" <?php selected( $rev_usmle, $u->ID ); ?>><?php echo esc_html( $u->display_name ); ?> (ID: <?php echo esc_html( $u->ID ); ?>)</option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th colspan="2">
                        <hr>
                        <h2>Course Access Mapping</h2>
                        <p class="description">These IDs power both the WooCommerce enrollment fallback and the MissionMed access audit screen. Residency auditing now tracks Foundation, Complete, and 360 alongside the USCE mapping below.</p>
                    </th>
                </tr>
                <tr>
                    <th><label for="mmed_product_foundation">WooCommerce Product ID: Interview Prep Foundation</label></th>
                    <td><input type="number" id="mmed_product_foundation" name="mmed_product_foundation" value="<?php echo esc_attr( $p_found ); ?>" class="small-text" /> <span class="description">Default: 3577</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_course_foundation">LearnDash Course ID: Interview Prep Foundation</label></th>
                    <td><input type="number" id="mmed_course_foundation" name="mmed_course_foundation" value="<?php echo esc_attr( $c_found ); ?>" class="small-text" /> <span class="description">Default: 3646</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_product_complete">WooCommerce Product ID: Interview Prep Complete</label></th>
                    <td><input type="number" id="mmed_product_complete" name="mmed_product_complete" value="<?php echo esc_attr( $p_complete ); ?>" class="small-text" /> <span class="description">Default: 3576</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_course_complete">LearnDash Course ID: Interview Prep Complete</label></th>
                    <td><input type="number" id="mmed_course_complete" name="mmed_course_complete" value="<?php echo esc_attr( $c_complete ); ?>" class="small-text" /> <span class="description">Default: 5227</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_product_360elite">WooCommerce Product ID: 360 Elite</label></th>
                    <td><input type="number" id="mmed_product_360elite" name="mmed_product_360elite" value="<?php echo esc_attr( $p_360 ); ?>" class="small-text" /> <span class="description">Default: 3575</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_course_360elite">LearnDash Course ID: 360 Elite</label></th>
                    <td><input type="number" id="mmed_course_360elite" name="mmed_course_360elite" value="<?php echo esc_attr( $c_360 ); ?>" class="small-text" /> <span class="description">Default: 3893</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_course_usmle">LearnDash Course ID: USMLE Exam Prep</label></th>
                    <td><input type="number" id="mmed_course_usmle" name="mmed_course_usmle" value="<?php echo esc_attr( $c_usmle ); ?>" class="small-text" /></td>
                </tr>
                <tr>
                    <th><label for="mmed_product_usce">WooCommerce Product ID: USCE</label></th>
                    <td><input type="number" id="mmed_product_usce" name="mmed_product_usce" value="<?php echo esc_attr( $p_usce ); ?>" class="small-text" /> <span class="description">Default: 3784</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_course_usce">LearnDash Course ID: USCE</label></th>
                    <td><input type="number" id="mmed_course_usce" name="mmed_course_usce" value="<?php echo esc_attr( $c_usce ); ?>" class="small-text" /></td>
                </tr>
                <tr>
                    <th><label for="mmed_group_residency">LearnDash Group ID: Mission Residency</label></th>
                    <td><input type="number" id="mmed_group_residency" name="mmed_group_residency" value="<?php echo esc_attr( $g_res ); ?>" class="small-text" /> <span class="description">Applied to Foundation, Complete, and 360 if a residency group is configured.</span></td>
                </tr>
                <tr>
                    <th><label for="mmed_group_usmle">LearnDash Group ID: USMLE Exam Prep</label></th>
                    <td><input type="number" id="mmed_group_usmle" name="mmed_group_usmle" value="<?php echo esc_attr( $g_usmle ); ?>" class="small-text" /></td>
                </tr>
                <tr>
                    <th><label for="mmed_group_clinicals">LearnDash Group ID: Mission Med Clinicals</label></th>
                    <td><input type="number" id="mmed_group_clinicals" name="mmed_group_clinicals" value="<?php echo esc_attr( $g_clin ); ?>" class="small-text" /></td>
                </tr>
            </table>
            <?php submit_button( 'Save Settings' ); ?>
        </form>
        <?php mmed_hub_render_supabase_linking_section( $student_os_enabled, $supabase_rows, $supabase_counts, $supabase_sync_result ); ?>
    </div>
    <?php
}

function mmed_hub_render_supabase_linking_section( $student_os_enabled, $rows, $counts, $sync_result = null ) {
    ?>
    <hr>
    <h2>Supabase Account Linking</h2>
    <p class="description">Matrix links WordPress users to Supabase Auth users by email. The service key stays server-side; this table only reads Auth user identities and stores the matched Supabase UUID in WordPress user meta.</p>
    <?php if ( ! $student_os_enabled || ! class_exists( 'MMED_Supabase_Bridge' ) ) : ?>
        <p><strong>Matrix must be enabled and this page reloaded before Supabase account linking can run.</strong></p>
    <?php else : ?>
        <p><strong><?php echo esc_html( (int) ( $counts['linked'] ?? 0 ) ); ?> of <?php echo esc_html( (int) ( $counts['total'] ?? 0 ) ); ?> users linked.</strong></p>
        <?php if ( is_array( $sync_result ) && isset( $sync_result['not_found'] ) ) : ?>
            <p class="description"><?php echo esc_html( (int) $sync_result['not_found'] ); ?> not found, <?php echo esc_html( (int) $sync_result['pending'] ); ?> pending.</p>
        <?php endif; ?>
        <form method="post" style="margin: 1em 0;">
            <?php wp_nonce_field( 'mmed_supabase_sync_users', 'mmed_supabase_sync_nonce' ); ?>
            <?php submit_button( 'Sync All Users', 'secondary', 'mmed_supabase_sync_submit', false ); ?>
        </form>
        <table class="widefat striped">
            <thead>
                <tr>
                    <th>WordPress user</th>
                    <th>Email</th>
                    <th>Supabase UUID</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <?php if ( empty( $rows ) ) : ?>
                    <tr>
                        <td colspan="4">No subscriber/student users found.</td>
                    </tr>
                <?php else : ?>
                    <?php foreach ( $rows as $row ) : ?>
                        <tr>
                            <td><?php echo esc_html( $row['display_name'] ?? '' ); ?> (ID: <?php echo esc_html( (int) ( $row['id'] ?? 0 ) ); ?>)</td>
                            <td><?php echo esc_html( $row['email'] ?? '' ); ?></td>
                            <td><code><?php echo esc_html( $row['uuid'] ?? '' ); ?></code></td>
                            <td><?php echo esc_html( $row['status'] ?? 'pending' ); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    <?php endif; ?>
    <?php
}

/* ── Session Card Meta Box ────────────────────────────────────────── */
function mmed_session_meta_box() {
    if ( ! post_type_exists( 'sfwd-courses' ) ) {
        return;
    }
    add_meta_box(
        'mmed_next_session',
        'Next Session (MissionMed Hub)',
        'mmed_session_meta_box_html',
        'sfwd-courses',
        'side',
        'default'
    );
}

function mmed_session_meta_box_html( $post ) {
    wp_nonce_field( 'mmed_session_meta', 'mmed_session_nonce' );
    $json = get_post_meta( $post->ID, '_mmed_next_session', true );
    $data = $json ? json_decode( $json, true ) : array();
    $title    = $data['title'] ?? '';
    $datetime = $data['datetime'] ?? '';
    $zoom     = $data['zoom_link'] ?? '';
    $type     = $data['type'] ?? 'group';
    ?>
    <p><label>Session Title:<br>
        <input type="text" name="mmed_session_title" value="<?php echo esc_attr( $title ); ?>" style="width:100%;" />
    </label></p>
    <p><label>Date/Time (ISO 8601):<br>
        <input type="datetime-local" name="mmed_session_datetime" value="<?php echo esc_attr( str_replace( 'T', 'T', substr( $datetime, 0, 16 ) ) ); ?>" style="width:100%;" />
    </label></p>
    <p><label>Zoom Link:<br>
        <input type="url" name="mmed_session_zoom" value="<?php echo esc_attr( $zoom ); ?>" style="width:100%;" />
    </label></p>
    <p><label>Type:<br>
        <select name="mmed_session_type" style="width:100%;">
            <option value="group" <?php selected( $type, 'group' ); ?>>Group Session</option>
            <option value="one_on_one" <?php selected( $type, 'one_on_one' ); ?>>1-on-1</option>
            <option value="mock_interview" <?php selected( $type, 'mock_interview' ); ?>>Mock Interview</option>
        </select>
    </label></p>
    <?php
}

function mmed_save_session_meta( $post_id, $post ) {
    if ( ! isset( $_POST['mmed_session_nonce'] ) || ! wp_verify_nonce( $_POST['mmed_session_nonce'], 'mmed_session_meta' ) ) {
        return;
    }
    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
        return;
    }
    if ( 'sfwd-courses' !== $post->post_type ) {
        return;
    }
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return;
    }

    $title    = sanitize_text_field( $_POST['mmed_session_title'] ?? '' );
    $datetime = sanitize_text_field( $_POST['mmed_session_datetime'] ?? '' );
    $zoom     = esc_url_raw( $_POST['mmed_session_zoom'] ?? '' );
    $type     = sanitize_text_field( $_POST['mmed_session_type'] ?? 'group' );

    if ( empty( $title ) && empty( $datetime ) ) {
        delete_post_meta( $post_id, '_mmed_next_session' );
        return;
    }

    // Append timezone offset if not present.
    if ( $datetime && false === strpos( $datetime, '+' ) && false === strpos( $datetime, 'Z' ) ) {
        $datetime .= ':00-04:00'; // Default to Eastern.
    }

    $json = wp_json_encode( array(
        'title'     => $title,
        'datetime'  => $datetime,
        'zoom_link' => $zoom,
        'type'      => $type,
    ) );
    update_post_meta( $post_id, '_mmed_next_session', $json );
}
