<?php
/**
 * MissionMed Hub — Course Access Audit.
 *
 * Compares WooCommerce purchases against LearnDash enrollments so admins can
 * see which users should have access, which courses are unlocked, and where
 * mismatches need intervention.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMED_Access_Audit {

    const PAGE_SLUG = 'mmed-course-access';
    const CACHE_KEY = 'mmed_access_audit_v1';

    /**
     * Register hooks for the access audit screen.
     */
    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
        add_action( 'mmed_enrollment_complete', array( __CLASS__, 'clear_cache' ), 20 );
    }

    /**
     * Register the admin submenu page.
     */
    public static function register_menu() {
        add_submenu_page(
            'options-general.php',
            'MissionMed Course Access',
            'MissionMed Access Audit',
            'manage_options',
            self::PAGE_SLUG,
            array( __CLASS__, 'render_page' )
        );
    }

    /**
     * Clear the cached audit payload.
     */
    public static function clear_cache() {
        delete_transient( self::CACHE_KEY );
    }

    /**
     * Shared program mappings used by enrollment and the audit screen.
     *
     * @return array[]
     */
    public static function get_program_mappings() {
        return array(
            'interview_prep_foundation' => self::hydrate_mapping( array(
                'slug'          => 'interview_prep_foundation',
                'label'         => 'IV Prep Complete Masterclass',
                'product_id'    => absint( get_option( 'mmed_product_foundation', mmed_hub_default_option_value( 'mmed_product_foundation' ) ) ),
                'product_ids'   => array(
                    absint( get_option( 'mmed_product_foundation', mmed_hub_default_option_value( 'mmed_product_foundation' ) ) ),
                    3577,
                    5504,
                    5513,
                ),
                'course_id'     => absint( get_option( 'mmed_course_foundation', mmed_hub_default_option_value( 'mmed_course_foundation' ) ) ),
                'group_id'      => absint( get_option( 'mmed_group_residency', mmed_hub_default_option_value( 'mmed_group_residency' ) ) ),
                'template_slug' => '',
                'division'      => 'residency',
            ) ),
            'interview_prep_complete' => self::hydrate_mapping( array(
                'slug'          => 'interview_prep_complete',
                'label'         => 'Match Prep Pro',
                'product_id'    => absint( get_option( 'mmed_product_complete', mmed_hub_default_option_value( 'mmed_product_complete' ) ) ),
                'product_ids'   => array(
                    absint( get_option( 'mmed_product_complete', mmed_hub_default_option_value( 'mmed_product_complete' ) ) ),
                    3576,
                    5512,
                ),
                'course_id'     => absint( get_option( 'mmed_course_complete', mmed_hub_default_option_value( 'mmed_course_complete' ) ) ),
                'group_id'      => absint( get_option( 'mmed_group_residency', mmed_hub_default_option_value( 'mmed_group_residency' ) ) ),
                'template_slug' => '',
                'division'      => 'residency',
            ) ),
            '360elite' => self::hydrate_mapping( array(
                'slug'          => '360elite',
                'label'         => '360 Match Mentorship',
                'product_id'    => absint( get_option( 'mmed_product_360elite', mmed_hub_default_option_value( 'mmed_product_360elite' ) ) ),
                'product_ids'   => array(
                    absint( get_option( 'mmed_product_360elite', mmed_hub_default_option_value( 'mmed_product_360elite' ) ) ),
                    3575,
                    5511,
                ),
                'course_id'     => absint( get_option( 'mmed_course_360elite', mmed_hub_default_option_value( 'mmed_course_360elite' ) ) ),
                'group_id'      => absint( get_option( 'mmed_group_residency', mmed_hub_default_option_value( 'mmed_group_residency' ) ) ),
                'template_slug' => '360elite_onboarding',
                'division'      => 'residency',
            ) ),
            'usce_onboarding' => self::hydrate_mapping( array(
                'slug'          => 'usce_onboarding',
                'label'         => 'USCE Clinical Onboarding',
                'product_id'    => absint( get_option( 'mmed_product_usce', mmed_hub_default_option_value( 'mmed_product_usce' ) ) ),
                'product_ids'   => array(
                    absint( get_option( 'mmed_product_usce', mmed_hub_default_option_value( 'mmed_product_usce' ) ) ),
                ),
                'course_id'     => absint( get_option( 'mmed_course_usce', mmed_hub_default_option_value( 'mmed_course_usce' ) ) ),
                'group_id'      => absint( get_option( 'mmed_group_clinicals', mmed_hub_default_option_value( 'mmed_group_clinicals' ) ) ),
                'template_slug' => 'usce_onboarding',
                'division'      => 'clinicals',
            ) ),
        );
    }

    /**
     * Return every WooCommerce product ID accepted for a program mapping.
     *
     * The legacy singular product_id remains the primary ID for saved Hub
     * settings while product_ids lets current public/payment-plan products map
     * to the same canonical LearnDash course.
     *
     * @param array $mapping Program mapping.
     * @return int[]
     */
    public static function get_mapping_product_ids( $mapping ) {
        $product_ids = array();

        if ( ! empty( $mapping['product_ids'] ) && is_array( $mapping['product_ids'] ) ) {
            $product_ids = array_merge( $product_ids, $mapping['product_ids'] );
        }

        if ( ! empty( $mapping['product_id'] ) ) {
            $product_ids[] = $mapping['product_id'];
        }

        return self::normalize_product_ids( $product_ids );
    }

    /**
     * Normalize product IDs while preserving first-seen order.
     *
     * @param array $product_ids Product IDs.
     * @return int[]
     */
    private static function normalize_product_ids( $product_ids ) {
        $normalized = array();

        foreach ( (array) $product_ids as $product_id ) {
            $product_id = absint( $product_id );
            if ( $product_id > 0 && ! in_array( $product_id, $normalized, true ) ) {
                $normalized[] = $product_id;
            }
        }

        return $normalized;
    }

    /**
     * Render the admin page.
     */
    public static function render_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $state        = self::get_filter_state();
        $dataset      = self::get_audit_dataset( $state['refresh'] );
        $warnings     = self::get_mapping_warnings( $dataset['mappings'] );
        $filtered     = self::filter_snapshots( $dataset['snapshots'], $state['search'], $state['status'] );
        $summary      = self::summarize_snapshots( $filtered );
        $pagination   = self::paginate_snapshots( $filtered, $state['paged'], $state['per_page'] );
        $settings_url = admin_url( 'options-general.php?page=mmed-hub-settings' );
        $refresh_url  = self::get_audit_url( array(
            'search'   => $state['search'],
            'status'   => $state['status'],
            'per_page' => $state['per_page'],
            'paged'    => $state['paged'],
            'refresh'  => 1,
        ) );
        ?>
        <div class="wrap mmed-access-wrap">
            <h1>MissionMed Course Access Audit</h1>

            <?php if ( $state['refresh'] ) : ?>
                <div class="notice notice-success inline"><p>Access audit refreshed from live WooCommerce and LearnDash data.</p></div>
            <?php endif; ?>

            <?php foreach ( $warnings as $warning ) : ?>
                <div class="notice notice-warning inline"><p><?php echo esc_html( $warning ); ?></p></div>
            <?php endforeach; ?>

            <div class="mmed-access-hero">
                <div>
                    <p class="mmed-access-kicker">Course Access + Permission Visualization</p>
                    <p class="mmed-access-intro">Track which MissionMed users purchased a program, which LearnDash courses they can reach, and where access is missing or orphaned.</p>
                </div>
                <div class="mmed-access-actions">
                    <a href="<?php echo esc_url( $refresh_url ); ?>" class="button">Refresh Audit</a>
                    <a href="<?php echo esc_url( $settings_url ); ?>" class="button button-primary">Open Access Mapping</a>
                </div>
            </div>

            <div class="mmed-access-card-grid">
                <div class="mmed-access-card">
                    <span class="mmed-access-card-label">Relevant Users</span>
                    <strong><?php echo esc_html( number_format_i18n( $summary['total'] ) ); ?></strong>
                </div>
                <div class="mmed-access-card">
                    <span class="mmed-access-card-label">Healthy Access</span>
                    <strong><?php echo esc_html( number_format_i18n( $summary['healthy'] ) ); ?></strong>
                </div>
                <div class="mmed-access-card mmed-access-card-alert">
                    <span class="mmed-access-card-label">Purchase, No Enrollment</span>
                    <strong><?php echo esc_html( number_format_i18n( $summary['purchase_gap'] ) ); ?></strong>
                </div>
                <div class="mmed-access-card mmed-access-card-warning">
                    <span class="mmed-access-card-label">Enrollment, No Product</span>
                    <strong><?php echo esc_html( number_format_i18n( $summary['orphaned_access'] ) ); ?></strong>
                </div>
            </div>

            <div class="mmed-access-system-grid">
                <div class="mmed-access-panel">
                    <h2>Logic Structure</h2>
                    <ol>
                        <li>Read paid WooCommerce orders in `processing` and `completed` for the configured MissionMed products and approved aliases.</li>
                        <li>Read each user&apos;s current LearnDash enrollments and separate mapped course access from unrelated LMS access.</li>
                        <li>Match purchase-to-course pairs using the shared MissionMed access mapping from Settings.</li>
                        <li>Flag two alert types: purchase without course access, and course access without the matching product purchase.</li>
                    </ol>
                </div>
                <div class="mmed-access-panel">
                    <h2>Integration Plan</h2>
                    <ol>
                        <li>Set the WooCommerce product IDs and LearnDash course/group IDs in <a href="<?php echo esc_url( $settings_url ); ?>">MissionMed Hub Settings</a>.</li>
                        <li>The WooCommerce fallback enrollment hook now reads the same mapping, so automation and auditing stay aligned.</li>
                        <li>Use this screen after imports, manual enrollments, refunds, or support escalations to catch mismatches before students get blocked.</li>
                    </ol>
                </div>
            </div>

            <div class="mmed-access-panel">
                <h2>Access Map</h2>
                <table class="widefat striped mmed-access-map-table">
                    <thead>
                        <tr>
                            <th>Program</th>
                            <th>WooCommerce Product</th>
                            <th>LearnDash Course</th>
                            <th>LearnDash Group</th>
                            <th>Enrollment Template</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $dataset['mappings'] as $mapping ) : ?>
                            <tr>
                                <td>
                                    <strong><?php echo esc_html( $mapping['label'] ); ?></strong>
                                    <div class="mmed-access-meta"><?php echo esc_html( ucfirst( $mapping['division'] ) ); ?></div>
                                </td>
                                <td>
                                    <?php self::render_mapping_reference( $mapping['product'] ); ?>
                                    <?php self::render_product_alias_diagnostics( $mapping ); ?>
                                </td>
                                <td><?php self::render_mapping_reference( $mapping['course'] ); ?></td>
                                <td><?php self::render_mapping_reference( $mapping['group'], 'Group' ); ?></td>
                                <td>
                                    <?php if ( ! empty( $mapping['template_slug'] ) ) : ?>
                                        <code><?php echo esc_html( $mapping['template_slug'] ); ?></code>
                                    <?php else : ?>
                                        <span class="description">Course/group only</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <form method="get" class="mmed-access-filters">
                <input type="hidden" name="page" value="<?php echo esc_attr( self::PAGE_SLUG ); ?>" />
                <label>
                    <span>Search</span>
                    <input type="search" name="search" value="<?php echo esc_attr( $state['search'] ); ?>" placeholder="Name, email, login, product, or course" />
                </label>
                <label>
                    <span>Status</span>
                    <select name="status">
                        <?php foreach ( self::get_status_filter_options() as $value => $label ) : ?>
                            <option value="<?php echo esc_attr( $value ); ?>" <?php selected( $state['status'], $value ); ?>><?php echo esc_html( $label ); ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>
                    <span>Rows</span>
                    <select name="per_page">
                        <?php foreach ( array( 10, 25, 50 ) as $size ) : ?>
                            <option value="<?php echo esc_attr( $size ); ?>" <?php selected( $state['per_page'], $size ); ?>><?php echo esc_html( $size ); ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <button type="submit" class="button button-primary">Apply</button>
            </form>

            <div class="mmed-access-panel">
                <h2>User Access Matrix</h2>

                <?php if ( empty( $pagination['items'] ) ) : ?>
                    <p class="description">No users matched the current filters.</p>
                <?php else : ?>
                    <table class="widefat striped mmed-access-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Products Purchased</th>
                                <th>Courses Unlocked</th>
                                <th>Missing Access / Alerts</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ( $pagination['items'] as $snapshot ) : ?>
                                <tr>
                                    <td>
                                        <strong><?php echo esc_html( $snapshot['display_name'] ); ?></strong>
                                        <div class="mmed-access-meta"><?php echo esc_html( $snapshot['user_email'] ); ?></div>
                                        <div class="mmed-access-meta">User ID: <?php echo esc_html( $snapshot['user_id'] ); ?></div>
                                    </td>
                                    <td><?php self::render_purchase_cell( $snapshot ); ?></td>
                                    <td><?php self::render_course_cell( $snapshot ); ?></td>
                                    <td><?php self::render_gap_cell( $snapshot ); ?></td>
                                    <td>
                                        <span class="mmed-access-status mmed-access-status-<?php echo esc_attr( $snapshot['status'] ); ?>">
                                            <?php echo esc_html( $snapshot['status_label'] ); ?>
                                        </span>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>

                    <?php if ( $pagination['total_pages'] > 1 ) : ?>
                        <div class="tablenav bottom">
                            <div class="tablenav-pages">
                                <span class="displaying-num"><?php echo esc_html( number_format_i18n( count( $filtered ) ) ); ?> users</span>
                                <?php
                                echo wp_kses_post(
                                    paginate_links( array(
                                        'base'      => add_query_arg(
                                            array(
                                                'page'     => self::PAGE_SLUG,
                                                'search'   => $state['search'],
                                                'status'   => $state['status'],
                                                'per_page' => $state['per_page'],
                                                'paged'    => '%#%',
                                            ),
                                            admin_url( 'options-general.php' )
                                        ),
                                        'format'    => '',
                                        'current'   => $pagination['current_page'],
                                        'total'     => $pagination['total_pages'],
                                        'prev_text' => '&laquo;',
                                        'next_text' => '&raquo;',
                                    ) )
                                );
                                ?>
                            </div>
                        </div>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

    /**
     * Build or fetch the cached audit dataset.
     *
     * @param bool $force_refresh Whether to bypass cache.
     * @return array
     */
    private static function get_audit_dataset( $force_refresh = false ) {
        if ( ! $force_refresh ) {
            $cached = get_transient( self::CACHE_KEY );
            if ( is_array( $cached ) ) {
                return $cached;
            }
        }

        $mappings            = self::get_program_mappings();
        $tracked_product_ids = array();
        $tracked_course_ids  = array();

        foreach ( $mappings as $mapping ) {
            foreach ( self::get_mapping_product_ids( $mapping ) as $product_id ) {
                $tracked_product_ids[] = $product_id;
            }

            if ( ! empty( $mapping['course_id'] ) ) {
                $tracked_course_ids[] = (int) $mapping['course_id'];
            }
        }

        $tracked_product_ids = array_values( array_unique( array_filter( $tracked_product_ids ) ) );
        $tracked_course_ids  = array_values( array_unique( array_filter( $tracked_course_ids ) ) );
        $order_index         = self::get_order_index( $tracked_product_ids );
        $users               = get_users( array(
            'number'  => -1,
            'orderby' => 'display_name',
            'order'   => 'ASC',
            'fields'  => array( 'ID', 'display_name', 'user_email', 'user_login' ),
        ) );
        $snapshots           = array();

        foreach ( $users as $user ) {
            $snapshot = self::build_user_snapshot( $user, $mappings, $order_index, $tracked_course_ids );
            if ( $snapshot['is_relevant'] ) {
                $snapshots[] = $snapshot;
            }
        }

        usort( $snapshots, array( __CLASS__, 'sort_snapshots' ) );

        $dataset = array(
            'generated_at' => current_time( 'mysql' ),
            'mappings'     => $mappings,
            'snapshots'    => $snapshots,
        );

        set_transient( self::CACHE_KEY, $dataset, 10 * MINUTE_IN_SECONDS );

        return $dataset;
    }

    /**
     * Create a user-level access snapshot.
     *
     * @param WP_User $user               User object.
     * @param array   $mappings           Shared program mappings.
     * @param array   $order_index        Purchase index keyed by user ID.
     * @param array   $tracked_course_ids Tracked course IDs.
     * @return array
     */
    private static function build_user_snapshot( $user, $mappings, $order_index, $tracked_course_ids ) {
        $purchase_records   = isset( $order_index[ $user->ID ] ) ? $order_index[ $user->ID ] : array();
        $all_enrolled_ids   = self::get_user_enrolled_courses( $user->ID );
        $tracked_enrolled   = array_values( array_intersect( $all_enrolled_ids, $tracked_course_ids ) );
        $other_enrollments  = array_values( array_diff( $all_enrolled_ids, $tracked_course_ids ) );
        $products_purchased = array();
        $courses_unlocked   = array();
        $missing_access     = array();
        $unexpected_access  = array();

        foreach ( $mappings as $mapping ) {
            $product_ids               = self::get_mapping_product_ids( $mapping );
            $matching_purchase_records = array();
            $course_id                 = (int) $mapping['course_id'];
            $has_course                = $course_id > 0 && in_array( $course_id, $tracked_enrolled, true );

            foreach ( $product_ids as $product_id ) {
                if ( isset( $purchase_records[ $product_id ] ) ) {
                    $matching_purchase_records[ $product_id ] = $purchase_records[ $product_id ];
                }
            }

            $has_purchase = ! empty( $matching_purchase_records );

            if ( $has_purchase ) {
                foreach ( $matching_purchase_records as $purchase_record ) {
                    $products_purchased[] = array(
                        'program_label' => $mapping['label'],
                        'product'       => $purchase_record['product'],
                        'orders'        => $purchase_record['orders'],
                    );
                }

                if ( $course_id > 0 && ! $has_course ) {
                    $missing_access[] = array(
                        'type'  => 'purchase_gap',
                        'label' => sprintf(
                            '%s purchased, but %s is not unlocked.',
                            $mapping['label'],
                            $mapping['course']['label']
                        ),
                    );
                }

                if ( $course_id <= 0 ) {
                    $missing_access[] = array(
                        'type'  => 'purchase_gap',
                        'label' => sprintf(
                            '%s purchased, but no LearnDash course is configured for this mapping.',
                            $mapping['label']
                        ),
                    );
                }
            }

            if ( $has_course ) {
                $courses_unlocked[] = array(
                    'program_label' => $mapping['label'],
                    'course'        => $mapping['course'],
                );

                if ( ! $has_purchase ) {
                    $unexpected_access[] = array(
                        'type'  => 'orphaned_access',
                        'label' => sprintf(
                            '%s is unlocked, but no tracked %s product purchase was found.',
                            $mapping['course']['label'],
                            $mapping['label']
                        ),
                    );
                }
            }
        }

        $status = 'healthy';
        if ( ! empty( $missing_access ) && ! empty( $unexpected_access ) ) {
            $status = 'mixed';
        } elseif ( ! empty( $missing_access ) ) {
            $status = 'purchase_gap';
        } elseif ( ! empty( $unexpected_access ) ) {
            $status = 'orphaned_access';
        }

        return array(
            'user_id'            => (int) $user->ID,
            'display_name'       => $user->display_name ? $user->display_name : $user->user_login,
            'user_email'         => $user->user_email,
            'user_login'         => $user->user_login,
            'products_purchased' => $products_purchased,
            'courses_unlocked'   => $courses_unlocked,
            'other_courses'      => self::get_course_references( $other_enrollments, 'Other Course' ),
            'missing_access'     => $missing_access,
            'unexpected_access'  => $unexpected_access,
            'status'             => $status,
            'status_label'       => self::get_status_labels()[ $status ],
            'alert_total'        => count( $missing_access ) + count( $unexpected_access ),
            'is_relevant'        => ! empty( $products_purchased ) || ! empty( $courses_unlocked ),
        );
    }

    /**
     * Build a purchase index keyed by user and product.
     *
     * @param array $tracked_product_ids MissionMed product IDs.
     * @return array
     */
    private static function get_order_index( $tracked_product_ids ) {
        if ( empty( $tracked_product_ids ) || ! function_exists( 'wc_get_orders' ) ) {
            return array();
        }

        $orders = wc_get_orders( array(
            'status' => array( 'processing', 'completed' ),
            'limit'  => -1,
            'return' => 'objects',
        ) );

        $product_lookup = array_fill_keys( $tracked_product_ids, true );
        $index          = array();

        foreach ( $orders as $order ) {
            $user_id = (int) $order->get_user_id();
            if ( $user_id <= 0 ) {
                continue;
            }

            foreach ( $order->get_items() as $item ) {
                $item_product_ids = self::get_order_item_product_ids( $item );

                foreach ( $item_product_ids as $product_id ) {
                    if ( ! isset( $product_lookup[ $product_id ] ) ) {
                        continue;
                    }

                    if ( ! isset( $index[ $user_id ] ) ) {
                        $index[ $user_id ] = array();
                    }

                    if ( ! isset( $index[ $user_id ][ $product_id ] ) ) {
                        $index[ $user_id ][ $product_id ] = array(
                            'product' => self::get_entity_reference( $product_id, 'Product' ),
                            'orders'  => array(),
                        );
                    }

                    $created   = $order->get_date_created();
                    $timestamp = $created ? $created->getTimestamp() : 0;
                    $date      = $created ? $created->date_i18n( get_option( 'date_format' ) ) : '';

                    $index[ $user_id ][ $product_id ]['orders'][ $order->get_id() ] = array(
                        'id'        => (int) $order->get_id(),
                        'date'      => $date,
                        'timestamp' => $timestamp,
                    );
                }
            }
        }

        foreach ( $index as $user_id => $product_records ) {
            foreach ( $product_records as $product_id => $record ) {
                $orders = array_values( $record['orders'] );
                usort( $orders, array( __CLASS__, 'sort_orders' ) );
                $index[ $user_id ][ $product_id ]['orders'] = $orders;
            }
        }

        return $index;
    }

    /**
     * Get LearnDash course IDs for a user.
     *
     * @param int $user_id WordPress user ID.
     * @return int[]
     */
    private static function get_user_enrolled_courses( $user_id ) {
        if ( ! function_exists( 'learndash_user_get_enrolled_courses' ) ) {
            return array();
        }

        $course_ids = learndash_user_get_enrolled_courses( $user_id );
        if ( ! is_array( $course_ids ) ) {
            return array();
        }

        return array_values( array_unique( array_map( 'absint', array_filter( $course_ids ) ) ) );
    }

    /**
     * Normalize the mapping with entity labels.
     *
     * @param array $mapping Raw mapping config.
     * @return array
     */
    private static function hydrate_mapping( $mapping ) {
        $mapping['product_id']         = absint( $mapping['product_id'] ?? 0 );
        $mapping['primary_product_id'] = (int) $mapping['product_id'];
        $mapping['product_ids']        = self::get_mapping_product_ids( $mapping );
        $mapping['product']            = self::get_entity_reference( $mapping['primary_product_id'], 'Product' );
        $mapping['products']           = self::get_entity_references( $mapping['product_ids'], 'Product' );
        $mapping['course']             = self::get_entity_reference( (int) $mapping['course_id'], 'Course' );
        $mapping['group']              = self::get_entity_reference( (int) $mapping['group_id'], 'Group' );
        return $mapping;
    }

    /**
     * Return parent and variation IDs from a WooCommerce order item.
     *
     * @param WC_Order_Item_Product $item Order item.
     * @return int[]
     */
    private static function get_order_item_product_ids( $item ) {
        $product_ids = array();

        if ( is_object( $item ) && method_exists( $item, 'get_product_id' ) ) {
            $product_ids[] = (int) $item->get_product_id();
        }

        if ( is_object( $item ) && method_exists( $item, 'get_variation_id' ) ) {
            $product_ids[] = (int) $item->get_variation_id();
        }

        return self::normalize_product_ids( $product_ids );
    }

    /**
     * Create a label payload for a WordPress entity.
     *
     * @param int    $post_id  Post ID.
     * @param string $fallback Fallback label.
     * @return array
     */
    private static function get_entity_reference( $post_id, $fallback ) {
        $label    = 'Not configured';
        $edit_url = '';

        if ( $post_id > 0 ) {
            $title = get_the_title( $post_id );
            $label = $title ? $title : sprintf( '%s #%d', $fallback, $post_id );

            if ( current_user_can( 'edit_post', $post_id ) ) {
                $edit_url = get_edit_post_link( $post_id, '' );
            }
        }

        return array(
            'id'       => $post_id,
            'label'    => $label,
            'edit_url' => $edit_url,
        );
    }

    /**
     * Build entity labels from a list of IDs.
     *
     * @param array  $ids      Post IDs.
     * @param string $fallback Fallback label.
     * @return array
     */
    private static function get_entity_references( $ids, $fallback ) {
        $references = array();

        foreach ( $ids as $post_id ) {
            $references[] = self::get_entity_reference( (int) $post_id, $fallback );
        }

        return $references;
    }

    /**
     * Build course labels from a list of IDs.
     *
     * @param array  $ids      Post IDs.
     * @param string $fallback Fallback label.
     * @return array
     */
    private static function get_course_references( $ids, $fallback ) {
        return self::get_entity_references( $ids, $fallback );
    }

    /**
     * Warnings for incomplete or unavailable integrations.
     *
     * @param array $mappings Program mappings.
     * @return string[]
     */
    private static function get_mapping_warnings( $mappings ) {
        $warnings = array();

        if ( ! function_exists( 'wc_get_orders' ) ) {
            $warnings[] = 'WooCommerce is not active, so purchase-side access validation is unavailable.';
        }

        if ( ! function_exists( 'learndash_user_get_enrolled_courses' ) ) {
            $warnings[] = 'LearnDash is not active, so enrollment-side access validation is unavailable.';
        }

        foreach ( $mappings as $mapping ) {
            if ( empty( self::get_mapping_product_ids( $mapping ) ) ) {
                $warnings[] = sprintf( '%s is missing its WooCommerce product ID in MissionMed Hub Settings.', $mapping['label'] );
            }

            if ( empty( $mapping['course_id'] ) ) {
                $warnings[] = sprintf( '%s is missing its LearnDash course ID in MissionMed Hub Settings.', $mapping['label'] );
            }
        }

        return array_values( array_unique( $warnings ) );
    }

    /**
     * Filter snapshots by search and status.
     *
     * @param array  $snapshots Access snapshots.
     * @param string $search    Search term.
     * @param string $status    Status filter.
     * @return array
     */
    private static function filter_snapshots( $snapshots, $search, $status ) {
        $search = trim( (string) $search );

        return array_values( array_filter( $snapshots, function( $snapshot ) use ( $search, $status ) {
            if ( 'alerts' === $status && 0 === $snapshot['alert_total'] ) {
                return false;
            }

            if ( 'all' !== $status && 'alerts' !== $status && $snapshot['status'] !== $status ) {
                return false;
            }

            if ( '' === $search ) {
                return true;
            }

            $haystack = array(
                $snapshot['display_name'],
                $snapshot['user_email'],
                $snapshot['user_login'],
                (string) $snapshot['user_id'],
            );

            foreach ( $snapshot['products_purchased'] as $purchase ) {
                $haystack[] = $purchase['program_label'];
                $haystack[] = $purchase['product']['label'];
            }

            foreach ( $snapshot['courses_unlocked'] as $course ) {
                $haystack[] = $course['program_label'];
                $haystack[] = $course['course']['label'];
            }

            foreach ( $snapshot['missing_access'] as $missing ) {
                $haystack[] = $missing['label'];
            }

            foreach ( $snapshot['unexpected_access'] as $unexpected ) {
                $haystack[] = $unexpected['label'];
            }

            return false !== stripos( implode( ' | ', $haystack ), $search );
        } ) );
    }

    /**
     * Summarize access snapshots.
     *
     * @param array $snapshots Access snapshots.
     * @return array
     */
    private static function summarize_snapshots( $snapshots ) {
        $summary = array(
            'total'           => count( $snapshots ),
            'healthy'         => 0,
            'purchase_gap'    => 0,
            'orphaned_access' => 0,
        );

        foreach ( $snapshots as $snapshot ) {
            if ( empty( $snapshot['missing_access'] ) && empty( $snapshot['unexpected_access'] ) ) {
                $summary['healthy']++;
            }

            if ( ! empty( $snapshot['missing_access'] ) ) {
                $summary['purchase_gap']++;
            }

            if ( ! empty( $snapshot['unexpected_access'] ) ) {
                $summary['orphaned_access']++;
            }
        }

        return $summary;
    }

    /**
     * Paginate a snapshot list.
     *
     * @param array $items    Items to paginate.
     * @param int   $paged    Current page.
     * @param int   $per_page Page size.
     * @return array
     */
    private static function paginate_snapshots( $items, $paged, $per_page ) {
        $total_items = count( $items );
        $total_pages = max( 1, (int) ceil( $total_items / $per_page ) );
        $paged       = min( max( 1, $paged ), $total_pages );
        $offset      = ( $paged - 1 ) * $per_page;

        return array(
            'items'        => array_slice( $items, $offset, $per_page ),
            'current_page' => $paged,
            'total_pages'  => $total_pages,
        );
    }

    /**
     * Filter state from the request.
     *
     * @return array
     */
    private static function get_filter_state() {
        $allowed_statuses = array_keys( self::get_status_filter_options() );
        $status           = isset( $_GET['status'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['status'] ) ) : 'all';
        $per_page         = isset( $_GET['per_page'] ) ? absint( wp_unslash( (string) $_GET['per_page'] ) ) : 25;

        if ( ! in_array( $status, $allowed_statuses, true ) ) {
            $status = 'all';
        }

        if ( ! in_array( $per_page, array( 10, 25, 50 ), true ) ) {
            $per_page = 25;
        }

        return array(
            'search'   => isset( $_GET['search'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['search'] ) ) : '',
            'status'   => $status,
            'per_page' => $per_page,
            'paged'    => isset( $_GET['paged'] ) ? max( 1, absint( wp_unslash( (string) $_GET['paged'] ) ) ) : 1,
            'refresh'  => ! empty( $_GET['refresh'] ),
        );
    }

    /**
     * URL helper for this page.
     *
     * @param array $args Extra query args.
     * @return string
     */
    private static function get_audit_url( $args = array() ) {
        return add_query_arg(
            array_merge(
                array(
                    'page' => self::PAGE_SLUG,
                ),
                $args
            ),
            admin_url( 'options-general.php' )
        );
    }

    /**
     * Status filter options.
     *
     * @return array
     */
    private static function get_status_filter_options() {
        return array(
            'all'             => 'All relevant users',
            'alerts'          => 'Any alert',
            'healthy'         => 'Healthy access',
            'purchase_gap'    => 'Purchase, no enrollment',
            'orphaned_access' => 'Enrollment, no product',
            'mixed'           => 'Mixed alerts',
        );
    }

    /**
     * Human labels for row status badges.
     *
     * @return array
     */
    private static function get_status_labels() {
        return array(
            'healthy'         => 'Healthy',
            'purchase_gap'    => 'Purchase Gap',
            'orphaned_access' => 'Orphaned Access',
            'mixed'           => 'Needs Review',
        );
    }

    /**
     * Sort snapshots so alerts rise to the top.
     *
     * @param array $left  Snapshot A.
     * @param array $right Snapshot B.
     * @return int
     */
    private static function sort_snapshots( $left, $right ) {
        $priority = array(
            'mixed'           => 0,
            'purchase_gap'    => 1,
            'orphaned_access' => 2,
            'healthy'         => 3,
        );

        $left_priority  = $priority[ $left['status'] ] ?? 99;
        $right_priority = $priority[ $right['status'] ] ?? 99;

        if ( $left_priority !== $right_priority ) {
            return $left_priority <=> $right_priority;
        }

        return strcasecmp( $left['display_name'], $right['display_name'] );
    }

    /**
     * Sort order references newest-first.
     *
     * @param array $left  Order A.
     * @param array $right Order B.
     * @return int
     */
    private static function sort_orders( $left, $right ) {
        $right_time = isset( $right['timestamp'] ) ? (int) $right['timestamp'] : 0;
        $left_time  = isset( $left['timestamp'] ) ? (int) $left['timestamp'] : 0;

        if ( $right_time !== $left_time ) {
            return $right_time <=> $left_time;
        }

        return (int) $right['id'] <=> (int) $left['id'];
    }

    /**
     * Render a purchase cell.
     *
     * @param array $snapshot Snapshot payload.
     */
    private static function render_purchase_cell( $snapshot ) {
        if ( empty( $snapshot['products_purchased'] ) ) {
            echo '<span class="mmed-access-empty">No tracked purchase found.</span>';
            return;
        }

        foreach ( $snapshot['products_purchased'] as $purchase ) {
            echo '<div class="mmed-access-item">';
            echo '<span class="mmed-access-chip mmed-access-chip-product">' . esc_html( $purchase['product']['label'] ) . '</span>';
            echo '<div class="mmed-access-meta">' . esc_html( $purchase['program_label'] ) . '</div>';

            if ( ! empty( $purchase['orders'] ) ) {
                $order_refs = array();
                foreach ( $purchase['orders'] as $order ) {
                    $label = '#' . $order['id'];
                    if ( ! empty( $order['date'] ) ) {
                        $label .= ' on ' . $order['date'];
                    }
                    $order_refs[] = $label;
                }
                echo '<div class="mmed-access-meta">Orders: ' . esc_html( implode( ', ', $order_refs ) ) . '</div>';
            }

            echo '</div>';
        }
    }

    /**
     * Render a course cell.
     *
     * @param array $snapshot Snapshot payload.
     */
    private static function render_course_cell( $snapshot ) {
        if ( empty( $snapshot['courses_unlocked'] ) ) {
            echo '<span class="mmed-access-empty">No tracked course unlocked.</span>';
        } else {
            foreach ( $snapshot['courses_unlocked'] as $course ) {
                echo '<div class="mmed-access-item">';
                echo '<span class="mmed-access-chip mmed-access-chip-course">' . esc_html( $course['course']['label'] ) . '</span>';
                echo '<div class="mmed-access-meta">' . esc_html( $course['program_label'] ) . '</div>';
                echo '</div>';
            }
        }

        if ( ! empty( $snapshot['other_courses'] ) ) {
            echo '<div class="mmed-access-item">';
            echo '<div class="mmed-access-meta"><strong>Other LearnDash Access</strong></div>';
            foreach ( $snapshot['other_courses'] as $course ) {
                echo '<span class="mmed-access-chip mmed-access-chip-neutral">' . esc_html( $course['label'] ) . '</span> ';
            }
            echo '</div>';
        }
    }

    /**
     * Render the gap/alert cell.
     *
     * @param array $snapshot Snapshot payload.
     */
    private static function render_gap_cell( $snapshot ) {
        if ( empty( $snapshot['missing_access'] ) && empty( $snapshot['unexpected_access'] ) ) {
            echo '<span class="mmed-access-empty">No mismatch detected.</span>';
            return;
        }

        foreach ( $snapshot['missing_access'] as $missing ) {
            echo '<div class="mmed-access-alert mmed-access-alert-danger">' . esc_html( $missing['label'] ) . '</div>';
        }

        foreach ( $snapshot['unexpected_access'] as $unexpected ) {
            echo '<div class="mmed-access-alert mmed-access-alert-warning">' . esc_html( $unexpected['label'] ) . '</div>';
        }
    }

    /**
     * Render a product/course/group reference inside the mapping table.
     *
     * @param array  $reference Entity reference.
     * @param string $fallback  Fallback entity label.
     */
    private static function render_mapping_reference( $reference, $fallback = '' ) {
        if ( empty( $reference['id'] ) ) {
            echo '<span class="mmed-access-empty">Not configured</span>';
            return;
        }

        $label = $reference['label'] . ' (ID: ' . $reference['id'] . ')';

        if ( ! empty( $reference['edit_url'] ) ) {
            echo '<a href="' . esc_url( $reference['edit_url'] ) . '">' . esc_html( $label ) . '</a>';
            return;
        }

        if ( '' !== $fallback ) {
            $label = ( $reference['label'] ? $reference['label'] : $fallback ) . ' (ID: ' . $reference['id'] . ')';
        }

        echo esc_html( $label );
    }

    /**
     * Render admin-only product alias diagnostics for a mapping row.
     *
     * @param array $mapping Program mapping.
     */
    private static function render_product_alias_diagnostics( $mapping ) {
        $product_ids        = self::get_mapping_product_ids( $mapping );
        $primary_product_id = absint( $mapping['primary_product_id'] ?? $mapping['product_id'] ?? 0 );
        $course_id          = absint( $mapping['course_id'] ?? 0 );

        if ( empty( $product_ids ) ) {
            return;
        }

        echo '<div class="mmed-access-meta">Canonical offering: ' . esc_html( $mapping['label'] ?? '' ) . '</div>';
        echo '<div class="mmed-access-meta">Course ID: ' . esc_html( (string) $course_id ) . '; primary product ID: ' . esc_html( (string) $primary_product_id ) . '</div>';
        echo '<div class="mmed-access-meta">Alias product IDs: ' . esc_html( implode( ', ', $product_ids ) ) . '</div>';
    }
}
