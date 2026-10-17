<?php
/**
 * MissionMed Hub Page Handler — Multi-Division LearnDash Command Center.
 *
 * @package MissionMed_Hub
 */

class MMED_Hub_Page {

	/**
	 * Phase definitions for structured task journeys.
	 */
	private static $phase_map = array(
		'360elite' => array(
			array(
				'id'          => 'foundation',
				'name'        => 'Phase 1: Foundation',
				'short'       => 'Foundation',
				'description' => 'Build your base with your CV, statement, and kickoff strategy call.',
				'tasks'       => array( 1, 2, 3 ),
			),
			array(
				'id'          => 'applications',
				'name'        => 'Phase 2: Applications',
				'short'       => 'Applications',
				'description' => 'Refine your materials and move into targeted interview preparation.',
				'tasks'       => array( 4, 5, 6 ),
			),
			array(
				'id'          => 'interviews',
				'name'        => 'Phase 3: Interviews',
				'short'       => 'Interviews',
				'description' => 'Sharpen interview performance with mock sessions and advisor feedback.',
				'tasks'       => array( 7, 8, 9 ),
			),
			array(
				'id'          => 'match_strategy',
				'name'        => 'Phase 4: Match Strategy',
				'short'       => 'Match Strategy',
				'description' => 'Finalize rank strategy, locking in your match execution plan.',
				'tasks'       => array( 10, 11, 12 ),
			),
		),
		'usce_onboarding' => array(
			array(
				'id'          => 'compliance',
				'name'        => 'Phase 1: Compliance',
				'short'       => 'Compliance',
				'description' => 'Complete all required onboarding and safety certifications.',
				'tasks'       => array( 1, 2 ),
			),
			array(
				'id'          => 'certifications',
				'name'        => 'Phase 2: Certifications',
				'short'       => 'Certifications',
				'description' => 'Submit the certifications required for clinical placement review.',
				'tasks'       => array( 3, 4 ),
			),
			array(
				'id'          => 'clearance',
				'name'        => 'Phase 3: Clearance',
				'short'       => 'Clearance',
				'description' => 'Finish background, drug screen, and immunization clearance.',
				'tasks'       => array( 5, 6, 7 ),
			),
		),
	);

	/**
	 * Initialize Hub page functionality.
	 */
	public static function init() {
		add_filter( 'theme_page_templates', array( __CLASS__, 'register_page_template' ) );
		add_shortcode( 'mmed_hub', array( __CLASS__, 'render_shortcode' ) );
		add_shortcode( 'mmed_command_center', array( __CLASS__, 'render_shortcode' ) );
		add_shortcode( 'mm_video', array( __CLASS__, 'render_video_shortcode' ) );
		add_shortcode( 'mmed_video', array( __CLASS__, 'render_video_shortcode' ) );
		add_filter( 'template_include', array( __CLASS__, 'template_include' ) );
	}

	/**
	 * Register the Hub page template.
	 *
	 * @param array $templates Page templates.
	 * @return array
	 */
	public static function register_page_template( $templates ) {
		$templates['template-hub.php'] = 'MissionMed Hub';
		return $templates;
	}

	/**
	 * Determine whether the current request is for the Hub page.
	 *
	 * @return bool
	 */
	public static function is_hub_page() {
		$page_template = get_page_template_slug();
		if ( 'template-hub.php' === $page_template ) {
			return true;
		}

		if ( is_page() ) {
			$post = get_queried_object();
			if ( $post ) {
				foreach ( self::get_shortcode_tags() as $tag ) {
					if ( has_shortcode( $post->post_content, $tag ) ) {
						return true;
					}
				}
			}
		}

		return false;
	}

	/**
	 * Load the plugin template when appropriate.
	 *
	 * @param string $template Theme template path.
	 * @return string
	 */
	public static function template_include( $template ) {
		if ( self::is_hub_page() ) {
			$custom_template = dirname( __DIR__ ) . '/templates/template-hub.php';
			if ( file_exists( $custom_template ) ) {
				return $custom_template;
			}
		}

		return $template;
	}

	/**
	 * Render shortcode output, including a safe asset fallback for Elementor.
	 *
	 * @return string
	 */
	public static function render_shortcode() {
		if ( function_exists( 'mmed_hub_is_student_os_enabled' ) && mmed_hub_is_student_os_enabled() && class_exists( 'MMED_Student_OS' ) ) {
			return MMED_Student_OS::render_shell();
		}

		ob_start();

		if ( ! wp_style_is( 'mmed-hub-css', 'done' ) && ! wp_style_is( 'mmed-hub-css', 'enqueued' ) ) {
			$css_url = MMED_HUB_URL . 'assets/hub.css?ver=' . MMED_HUB_VERSION;
			echo '<link rel="stylesheet" id="mmed-hub-css-inline" href="' . esc_url( $css_url ) . '" type="text/css" media="all" />' . "\n";
		}

		echo '<div class="mmed-command-center mmed-shortcode-shell">';
		self::render_hub();
		echo '</div>';

		if ( ! wp_script_is( 'mmed-hub-js', 'done' ) && ! wp_script_is( 'mmed-hub-js', 'enqueued' ) ) {
			$js_url    = MMED_HUB_URL . 'assets/hub.js?ver=' . MMED_HUB_VERSION;
			$ajax_data = array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'mmed_hub_nonce' ),
			);
			echo '<script>window.mmedHub = ' . wp_json_encode( $ajax_data ) . ';</script>' . "\n";
			echo '<script src="' . esc_url( $js_url ) . '"></script>' . "\n";
		}

		return ob_get_clean();
	}

	/**
	 * Main Hub rendering method.
	 *
	 * @return void
	 */
	public static function render_hub() {
		if ( function_exists( 'mmed_hub_is_student_os_enabled' ) && mmed_hub_is_student_os_enabled() && class_exists( 'MMED_Student_OS' ) ) {
			echo MMED_Student_OS::render_shell();
			return;
		}

		if ( ! is_user_logged_in() ) {
			wp_redirect( wp_login_url( get_permalink() ) );
			exit;
		}

		$current_user      = wp_get_current_user();
		$user_id           = $current_user->ID;
		$first_name        = $current_user->first_name ?: $current_user->display_name;
		$program_tier      = get_user_meta( $user_id, '_mmed_program_tier', true ) ?: 'student';
		$primary_division  = get_user_meta( $user_id, '_mmed_primary_division', true ) ?: self::division_from_program_tier( $program_tier );
		$tasks             = self::get_user_tasks( $user_id );
		$enrolled_courses  = function_exists( 'learndash_user_get_enrolled_courses' ) ? learndash_user_get_enrolled_courses( $user_id ) : array();
		$course_data       = self::filter_courses( self::get_course_progress_data( $user_id, $enrolled_courses ) );
		$division_hubs     = self::get_division_hubs( $user_id, $primary_division, $program_tier, $tasks, $course_data );
		$default_division  = self::get_default_division_id( $division_hubs, $primary_division, $program_tier );
		$lifecycle         = MMED_Lifecycle::detect_stage( $user_id );
		$lifecycle_stage   = $lifecycle['stage'];
		$lifecycle_label   = $lifecycle['label'];
		$priority_actions  = MMED_Priority_Engine::get_priority_actions( $user_id, $tasks, $course_data, $division_hubs, $lifecycle_stage );
		$primary_action    = ! empty( $priority_actions[0] ) ? $priority_actions[0] : null;
		$quick_action_count = count( $priority_actions ) > 1 ? min( 3, count( $priority_actions ) - 1 ) : 0;
		$master_hud        = self::get_master_hud( $division_hubs, $tasks, $course_data );
		$overall_summary   = self::get_task_summary( $tasks );
		$status_maps       = self::get_status_maps();
		$status_colors     = $status_maps['colors'];
		$status_labels     = $status_maps['labels'];
		$status_health     = self::get_status_health( $tasks );
		$video_library     = self::get_video_library_data();
		$available_count   = count( array_filter( $division_hubs, function ( $division ) {
			return ! empty( $division['available'] );
		} ) );
		$command_label     = ! empty( $division_hubs[ $default_division ]['active_phase']['name'] )
			? $division_hubs[ $default_division ]['active_phase']['name']
			: ( $available_count > 1 ? $available_count . ' Active Divisions' : 'MissionMed Hub' );
		$sidebar_program   = $available_count > 1
			? $available_count . ' Active Divisions'
			: ( ! empty( $division_hubs[ $default_division ]['label'] ) ? $division_hubs[ $default_division ]['label'] : 'MissionMed Student' );
		$overall_progress  = $master_hud['overall_progress'];
		$initials_source   = function_exists( 'mb_substr' ) ? mb_substr( $first_name, 0, 1 ) : substr( $first_name, 0, 1 );
		$initials          = strtoupper( $initials_source );
		?>
		<aside class="mmed-sidebar" id="mmed-sidebar">
			<div class="mmed-sidebar-brand">
				<div class="mmed-brand-icon">
					<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
						<rect width="28" height="28" rx="6" fill="#C9A84C"/>
						<path d="M7 14L12 19L21 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
				<span class="mmed-brand-text">MissionMed</span>
			</div>

			<nav class="mmed-sidebar-nav" aria-label="Hub navigation">
				<div class="mmed-nav-section">
					<span class="mmed-nav-label">Main</span>
					<a href="#dashboard" class="mmed-nav-item active" data-view="dashboard">
						<svg class="mmed-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
						<span>Dashboard</span>
					</a>
					<a href="#tasks" class="mmed-nav-item" data-view="tasks">
						<svg class="mmed-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
						<span>Milestones</span>
					</a>
					<a href="#sessions" class="mmed-nav-item" data-view="sessions">
						<svg class="mmed-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
						<span>Sessions</span>
					</a>
				</div>

				<div class="mmed-nav-section">
					<span class="mmed-nav-label">Learning</span>
					<a href="#courses" class="mmed-nav-item" data-view="courses">
						<svg class="mmed-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V15a1 1 0 11-2 0V4.804z"/></svg>
						<span>Courses</span>
					</a>
					<a href="#videos" class="mmed-nav-item" data-view="videos">
						<svg class="mmed-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 5a2 2 0 012-2h6a2 2 0 012 2v1.382l3.447-1.724A1 1 0 0119 5.553v8.894a1 1 0 01-1.553.894L14 13.618V15a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"/></svg>
						<span>Videos</span>
					</a>
					<a href="#documents" class="mmed-nav-item" data-view="documents">
						<svg class="mmed-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
						<span>Documents</span>
					</a>
				</div>

				<div class="mmed-nav-section">
					<span class="mmed-nav-label">Support</span>
					<a href="<?php echo esc_url( get_option( 'mmed_calendly_url' ) ); ?>" class="mmed-nav-item" target="_blank" rel="noopener">
						<svg class="mmed-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-2 0c0 .993-.241 1.929-.668 2.754l-1.524-1.525a3.997 3.997 0 00.078-2.183l1.562-1.562C15.802 8.249 16 9.1 16 10zm-5.165 3.913l1.58 1.58A5.98 5.98 0 0110 16a5.976 5.976 0 01-2.516-.552l1.562-1.562a4.006 4.006 0 001.789.027zm-4.677-2.796a4.002 4.002 0 01-.078-2.183L2.752 7.37A5.98 5.98 0 004 10c0 .993.241 1.929.668 2.754l1.49-1.637zm7.159-6.074l-1.58-1.58A5.98 5.98 0 0010 4c-.993 0-1.929.241-2.754.668l1.524 1.525a3.997 3.997 0 012.183-.078l1.562-1.562z" clip-rule="evenodd"/></svg>
						<span>Support</span>
					</a>
				</div>
			</nav>

			<div class="mmed-sidebar-user">
				<div class="mmed-user-avatar"><?php echo esc_html( $initials ); ?></div>
				<div class="mmed-user-info">
					<span class="mmed-user-name"><?php echo esc_html( $first_name ); ?></span>
					<span class="mmed-user-tier"><?php echo esc_html( $sidebar_program ); ?></span>
				</div>
			</div>
		</aside>

		<header class="mmed-mobile-header" id="mmed-mobile-header">
			<button class="mmed-hamburger" id="mmed-hamburger" aria-label="Toggle navigation">
				<span></span><span></span><span></span>
			</button>
			<span class="mmed-mobile-brand">MissionMed</span>
			<div class="mmed-mobile-progress">
				<span class="mmed-mobile-pct"><?php echo esc_html( $overall_progress ); ?>%</span>
			</div>
		</header>

		<main class="mmed-main" id="mmed-main">
			<div class="mmed-command-bar">
				<div class="mmed-command-left">
					<h1 class="mmed-command-title"><?php echo esc_html( $first_name ); ?>'s Command Center</h1>
				</div>
				<div class="mmed-command-center-phase">
					<span class="mmed-phase-label"><?php echo esc_html( $command_label ); ?></span>
					<span class="mmed-stage-badge mmed-stage-<?php echo esc_attr( strtolower( $lifecycle_stage ) ); ?>">
						<?php echo esc_html( $lifecycle_label ); ?>
					</span>
				</div>
				<div class="mmed-command-right">
					<div class="mmed-progress-ring" data-progress="<?php echo esc_attr( $overall_progress ); ?>">
						<svg viewBox="0 0 44 44" aria-hidden="true">
							<circle class="mmed-ring-bg" cx="22" cy="22" r="18" />
							<circle class="mmed-ring-fill" cx="22" cy="22" r="18"
								stroke-dasharray="<?php echo esc_attr( round( 2 * M_PI * 18 * $overall_progress / 100, 1 ) ); ?> <?php echo esc_attr( round( 2 * M_PI * 18, 1 ) ); ?>"
								stroke-dashoffset="0" />
							<text x="22" y="22" class="mmed-ring-text"><?php echo esc_html( $overall_progress ); ?>%</text>
						</svg>
					</div>
					<div class="mmed-command-stats">
						<span class="mmed-stat-count"><?php echo esc_html( $overall_summary['approved'] . ' / ' . $overall_summary['total'] ); ?> milestones</span>
						<span class="mmed-stat-health mmed-health-<?php echo esc_attr( $status_health['key'] ); ?>">
							<?php echo esc_html( $status_health['icon'] . ' ' . $status_health['label'] ); ?>
						</span>
					</div>
				</div>
			</div>

			<div class="mmed-view mmed-view-dashboard active" id="view-dashboard">
				<?php if ( $primary_action ) : ?>
					<section class="mmed-priority-hero mmed-urgency-<?php echo esc_attr( $primary_action['urgency'] ); ?>"
							 aria-label="Your top priority">
						<div class="mmed-hero-content">
							<span class="mmed-hero-division-badge"><?php echo esc_html( $primary_action['division_label'] ); ?></span>
							<h2 class="mmed-hero-title"><?php echo esc_html( $primary_action['title'] ); ?></h2>
							<p class="mmed-hero-description"><?php echo esc_html( $primary_action['description'] ); ?></p>
						</div>
						<a href="<?php echo esc_url( $primary_action['action_url'] ); ?>"
						   class="mmed-hero-cta">
							<?php echo esc_html( $primary_action['action_label'] ); ?>
						</a>
					</section>
				<?php endif; ?>

				<section class="mmed-quick-actions" aria-label="Quick actions">
					<?php for ( $i = 1; $i <= $quick_action_count; $i++ ) : ?>
						<a href="<?php echo esc_url( $priority_actions[ $i ]['action_url'] ); ?>"
						   class="mmed-quick-action-card">
							<span class="mmed-qa-division"><?php echo esc_html( $priority_actions[ $i ]['division_label'] ); ?></span>
							<span class="mmed-qa-title"><?php echo esc_html( $priority_actions[ $i ]['title'] ); ?></span>
							<span class="mmed-qa-label"><?php echo esc_html( $priority_actions[ $i ]['action_label'] ); ?></span>
						</a>
					<?php endfor; ?>
				</section>

				<?php if ( $available_count > 1 ) : ?>
					<section class="mmed-division-switcher-wrap" aria-label="Division switcher">
						<div class="mmed-division-switcher-head">
							<div>
								<span class="mmed-section-kicker">Division Switcher</span>
								<h2 class="mmed-section-title">Move between Mission Residency, USMLE Exam Prep, and Clinicals from one cockpit.</h2>
							</div>
							<div class="mmed-division-switcher-summary">
								<span data-active-division-label><?php echo esc_html( $division_hubs[ $default_division ]['label'] ); ?></span>
								<span><?php echo esc_html( $available_count ); ?> active</span>
							</div>
						</div>

						<div class="mmed-division-tabs" role="tablist" aria-label="MissionMed divisions">
							<?php foreach ( $division_hubs as $division_id => $division ) : ?>
								<?php $is_active = $division_id === $default_division; ?>
								<button
									type="button"
									class="mmed-division-tab<?php echo $is_active ? ' active' : ''; ?><?php echo ! $division['available'] ? ' is-inactive' : ''; ?>"
									role="tab"
									aria-selected="<?php echo $is_active ? 'true' : 'false'; ?>"
									aria-controls="mmed-division-panel-<?php echo esc_attr( $division_id ); ?>"
									data-division="<?php echo esc_attr( $division_id ); ?>"
								>
									<span class="mmed-division-tab-icon" style="--mmed-division-accent: <?php echo esc_attr( $division['accent'] ); ?>;"><?php echo esc_html( $division['icon'] ); ?></span>
									<span class="mmed-division-tab-copy">
										<span class="mmed-division-tab-label"><?php echo esc_html( $division['label'] ); ?></span>
										<span class="mmed-division-tab-meta"><?php echo esc_html( $division['tab_meta'] ); ?></span>
									</span>
									<span class="mmed-division-tab-pill"><?php echo esc_html( $division['tab_pill'] ); ?></span>
								</button>
							<?php endforeach; ?>
						</div>
					</section>
				<?php endif; ?>

				<div class="mmed-division-panels">
					<?php foreach ( $division_hubs as $division_id => $division ) : ?>
						<?php
						$is_active      = $division_id === $default_division;
						$hero_status    = $division['available'] ? 'Active Division' : 'Available Division';
						$progress_value = $division['progress_pct'];
						?>
						<section
							class="mmed-division-panel<?php echo $is_active ? ' active' : ''; ?>"
							id="mmed-division-panel-<?php echo esc_attr( $division_id ); ?>"
							data-division-panel="<?php echo esc_attr( $division_id ); ?>"
							aria-hidden="<?php echo $is_active ? 'false' : 'true'; ?>"
						>
							<div class="mmed-division-hero" style="--mmed-division-accent: <?php echo esc_attr( $division['accent'] ); ?>; --mmed-division-soft: <?php echo esc_attr( $division['accent_soft'] ); ?>;">
								<div class="mmed-division-hero-copy">
									<span class="mmed-division-hero-kicker"><?php echo esc_html( $hero_status ); ?></span>
									<h3 class="mmed-division-hero-title"><?php echo esc_html( $division['label'] ); ?></h3>
									<p class="mmed-division-hero-desc"><?php echo esc_html( $division['description'] ); ?></p>
									<div class="mmed-division-hero-meta">
										<span><?php echo esc_html( $division['task_summary']['open'] ); ?> open milestones</span>
										<span><?php echo esc_html( $division['course_summary']['count'] ); ?> courses</span>
										<?php if ( ! empty( $division['active_phase']['short'] ) ) : ?>
											<span><?php echo esc_html( $division['active_phase']['short'] ); ?></span>
										<?php endif; ?>
									</div>
								</div>
								<div class="mmed-division-hero-aside">
									<div class="mmed-division-progress-meter">
										<span class="mmed-division-progress-value"><?php echo esc_html( $progress_value ); ?>%</span>
										<span class="mmed-division-progress-label">Division Progress</span>
									</div>
									<?php if ( ! empty( $division['next_session'] ) ) : ?>
										<a href="<?php echo esc_url( ! empty( $division['next_session']['zoom_link'] ) ? $division['next_session']['zoom_link'] : $division['booking_url'] ); ?>" class="mmed-btn mmed-btn-secondary" target="_blank" rel="noopener">
											<?php echo esc_html( ! empty( $division['next_session']['zoom_link'] ) ? 'Join Upcoming Session' : 'Book Session' ); ?>
										</a>
									<?php else : ?>
										<a href="<?php echo esc_url( $division['booking_url'] ); ?>" class="mmed-btn mmed-btn-secondary" target="_blank" rel="noopener">Book Session</a>
									<?php endif; ?>
								</div>
							</div>

							<?php if ( $division['available'] ) : ?>
								<div class="mmed-division-grid">
									<article class="mmed-panel">
										<h4 class="mmed-panel-title">Phase Progress</h4>
										<?php if ( ! empty( $division['phases'] ) ) : ?>
											<div class="mmed-phase-list mmed-phase-list-compact">
												<?php foreach ( $division['phases'] as $phase ) : ?>
													<div class="mmed-phase-block mmed-phase-<?php echo esc_attr( $phase['state'] ); ?>">
														<div class="mmed-phase-header">
															<span class="mmed-phase-dot"></span>
															<span class="mmed-phase-name"><?php echo esc_html( $phase['name'] ); ?></span>
															<span class="mmed-phase-status-tag"><?php echo esc_html( ucfirst( $phase['state'] ) ); ?></span>
														</div>
														<p class="mmed-phase-desc"><?php echo esc_html( $phase['description'] ); ?></p>
														<div class="mmed-phase-progress">
															<div class="mmed-phase-bar">
																<div class="mmed-phase-fill" style="width: <?php echo esc_attr( $phase['progress'] ); ?>%;"></div>
															</div>
															<span class="mmed-phase-pct"><?php echo esc_html( $phase['approved'] . '/' . $phase['total'] ); ?></span>
														</div>
													</div>
												<?php endforeach; ?>
											</div>
										<?php else : ?>
											<div class="mmed-summary-metrics">
												<div class="mmed-summary-metric">
													<span class="mmed-summary-metric-value"><?php echo esc_html( $division['task_summary']['approved'] ); ?></span>
													<span class="mmed-summary-metric-label">Approved</span>
												</div>
												<div class="mmed-summary-metric">
													<span class="mmed-summary-metric-value"><?php echo esc_html( $division['task_summary']['open'] ); ?></span>
													<span class="mmed-summary-metric-label">Open</span>
												</div>
												<div class="mmed-summary-metric">
													<span class="mmed-summary-metric-value"><?php echo esc_html( $division['course_summary']['avg_progress'] ); ?>%</span>
													<span class="mmed-summary-metric-label">Course Avg</span>
												</div>
											</div>
										<?php endif; ?>
									</article>

									<article class="mmed-panel">
										<h4 class="mmed-panel-title">Courses + Sessions</h4>
										<?php if ( ! empty( $division['next_session'] ) ) : ?>
											<div class="mmed-session-card mmed-division-session-card">
												<?php if ( ! empty( $division['next_session']['type'] ) ) : ?>
													<span class="mmed-session-type"><?php echo esc_html( ucfirst( str_replace( '_', ' ', $division['next_session']['type'] ) ) ); ?></span>
												<?php endif; ?>
												<h5 class="mmed-session-name"><?php echo esc_html( $division['next_session']['title'] ); ?></h5>
												<p class="mmed-session-datetime" data-timestamp="<?php echo esc_attr( $division['next_session']['timestamp'] ); ?>">
													<?php echo esc_html( $division['next_session']['display_date'] ); ?>
												</p>
												<a href="<?php echo esc_url( ! empty( $division['next_session']['zoom_link'] ) ? $division['next_session']['zoom_link'] : $division['booking_url'] ); ?>" class="mmed-btn mmed-btn-secondary" target="_blank" rel="noopener">
													<?php echo esc_html( ! empty( $division['next_session']['zoom_link'] ) ? 'Join Session' : 'Book Session' ); ?>
												</a>
											</div>
										<?php endif; ?>
										<?php if ( ! empty( $division['courses'] ) ) : ?>
											<div class="mmed-division-course-list">
												<?php foreach ( array_slice( $division['courses'], 0, 3 ) as $course ) : ?>
													<a href="<?php echo esc_url( $course['url'] ); ?>" class="mmed-division-course-card">
														<div class="mmed-division-course-head">
															<span class="mmed-division-course-name"><?php echo esc_html( $course['title'] ); ?></span>
															<span class="mmed-division-course-pct"><?php echo esc_html( $course['progress_pct'] ); ?>%</span>
														</div>
														<div class="mmed-phase-bar">
															<div class="mmed-phase-fill" style="width: <?php echo esc_attr( $course['progress_pct'] ); ?>%;"></div>
														</div>
														<span class="mmed-division-course-meta"><?php echo esc_html( $course['completed'] . ' of ' . $course['total'] . ' lessons complete' ); ?></span>
													</a>
												<?php endforeach; ?>
											</div>
										<?php elseif ( empty( $division['next_session'] ) ) : ?>
											<div class="mmed-empty-panel">
												<p><?php echo esc_html( $division['empty_state'] ); ?></p>
											</div>
										<?php endif; ?>
									</article>

									<article class="mmed-panel">
										<h4 class="mmed-panel-title">Alerts &amp; Deadlines</h4>
										<?php if ( ! empty( $division['alerts'] ) ) : ?>
											<ul class="mmed-alert-list">
												<?php foreach ( $division['alerts'] as $alert ) : ?>
													<li class="mmed-alert-item severity-<?php echo esc_attr( $alert['severity_class'] ); ?>">
														<strong><?php echo esc_html( $alert['title'] ); ?></strong>
														<span><?php echo esc_html( $alert['context'] ); ?></span>
													</li>
												<?php endforeach; ?>
											</ul>
										<?php else : ?>
											<div class="mmed-empty-panel">
												<p>No immediate deadlines in this division right now.</p>
											</div>
										<?php endif; ?>
									</article>
								</div>
							<?php else : ?>
								<div class="mmed-panel mmed-division-empty-panel">
									<h4 class="mmed-panel-title"><?php echo esc_html( $division['label'] ); ?> Not Yet Active</h4>
									<p class="mmed-empty-state"><?php echo esc_html( $division['empty_state'] ); ?></p>
									<div class="mmed-actions-grid">
										<a href="<?php echo esc_url( $division['booking_url'] ); ?>" class="mmed-action-btn" target="_blank" rel="noopener">
											<span>Book Session</span>
										</a>
										<a href="mailto:<?php echo esc_attr( $division['support_email'] ); ?>" class="mmed-action-btn">
											<span>Email Support</span>
										</a>
										<a href="<?php echo esc_url( $division['account_url'] ); ?>" class="mmed-action-btn">
											<span>Account Settings</span>
										</a>
									</div>
								</div>
							<?php endif; ?>
						</section>
					<?php endforeach; ?>
				</div>
			</div>

			<div class="mmed-view mmed-view-tasks" id="view-tasks">
				<div class="mmed-view-header">
					<h2 class="mmed-view-title">Milestones</h2>
					<div class="mmed-view-meta">
						<span class="mmed-tasks-count" data-active-division-label><?php echo esc_html( $division_hubs[ $default_division ]['label'] ); ?></span>
					</div>
				</div>

				<?php foreach ( $division_hubs as $division_id => $division ) : ?>
					<?php $is_active = $division_id === $default_division; ?>
					<section
						class="mmed-division-scoped<?php echo $is_active ? ' is-active' : ''; ?>"
						data-division-scope="<?php echo esc_attr( $division_id ); ?>"
						<?php echo $is_active ? '' : 'hidden'; ?>
					>
						<div class="mmed-view-section-head">
							<span class="mmed-view-section-kicker"><?php echo esc_html( $division['label'] ); ?></span>
							<p class="mmed-view-section-copy"><?php echo esc_html( $division['description'] ); ?></p>
						</div>

						<?php if ( ! empty( $division['tasks'] ) ) : ?>
							<?php foreach ( $division['phases'] as $phase ) : ?>
								<div class="mmed-task-phase-block mmed-phase-<?php echo esc_attr( $phase['state'] ); ?>" id="phase-<?php echo esc_attr( $division_id . '-' . $phase['id'] ); ?>">
									<div class="mmed-task-phase-header">
										<div class="mmed-task-phase-info">
											<span class="mmed-phase-dot"></span>
											<h3 class="mmed-task-phase-name"><?php echo esc_html( $phase['name'] ); ?></h3>
											<span class="mmed-phase-status-tag"><?php echo esc_html( ucfirst( $phase['state'] ) ); ?></span>
										</div>
										<div class="mmed-task-phase-bar">
											<div class="mmed-phase-fill" style="width: <?php echo esc_attr( $phase['progress'] ); ?>%;"></div>
										</div>
									</div>
									<p class="mmed-task-phase-desc"><?php echo esc_html( $phase['description'] ); ?></p>

									<div class="mmed-task-list">
										<?php foreach ( $phase['task_objects'] as $task ) : ?>
											<?php
											$task_state       = $task['status'];
											$task_state_color = $status_colors[ $task_state ] ?? '#6B7280';
											$task_state_label = $status_labels[ $task_state ] ?? 'Open';
											$staff_note       = $task['staff_note'];
											?>
											<div class="mmed-task-item mmed-collapsible-task mmed-task-status-<?php echo esc_attr( $task_state ); ?>" data-task-id="<?php echo esc_attr( $task['ID'] ); ?>">
												<button class="mmed-task-header" aria-expanded="false">
													<span class="mmed-task-dot" style="background-color: <?php echo esc_attr( $task_state_color ); ?>;"></span>
													<span class="mmed-task-title"><?php echo esc_html( $task['post_title'] ); ?></span>
													<span class="mmed-status-badge" style="background-color: <?php echo esc_attr( $task_state_color ); ?>;">
														<?php echo esc_html( $task_state_label ); ?>
													</span>
													<span class="mmed-expand-icon">
														<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
													</span>
												</button>
												<div class="mmed-task-expanded" style="display: none;">
													<?php if ( ! empty( $task['description'] ) ) : ?>
														<div class="mmed-task-context">
															<span class="mmed-context-label">Advisor context</span>
															<div class="mmed-task-description"><?php echo wp_kses_post( wpautop( $task['description'] ) ); ?></div>
														</div>
													<?php endif; ?>

													<?php if ( ! empty( $staff_note ) ) : ?>
														<div class="mmed-staff-note">
															<span class="mmed-context-label">Feedback</span>
															<p><?php echo wp_kses_post( $staff_note ); ?></p>
														</div>
													<?php endif; ?>

													<?php if ( ! empty( $task['due_label'] ) ) : ?>
														<div class="mmed-task-meta-row">
															<span class="mmed-meta-label">Target Date</span>
															<span class="mmed-meta-value"><?php echo esc_html( $task['due_label'] ); ?></span>
														</div>
													<?php endif; ?>

													<?php if ( $task['requires_file'] ) : ?>
														<div class="mmed-file-upload-area">
															<div class="mmed-upload-zone">
																<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
																<label for="mmed-file-<?php echo esc_attr( $task['ID'] ); ?>" class="mmed-file-label">
																	Drop your file here or <strong>click to upload</strong>
																</label>
																<span class="mmed-file-types">PDF, DOC, DOCX, JPG, PNG (max 10MB)</span>
															</div>
															<input type="file" id="mmed-file-<?php echo esc_attr( $task['ID'] ); ?>" class="mmed-file-input" data-task-id="<?php echo esc_attr( $task['ID'] ); ?>" />
															<div class="mmed-upload-progress" style="display: none;"><p>Uploading...</p></div>
															<div class="mmed-upload-error" style="display: none;"></div>
														</div>
													<?php endif; ?>

													<?php if ( ! empty( $task['file_url'] ) ) : ?>
														<div class="mmed-task-file">
															<a href="<?php echo esc_url( $task['file_url'] ); ?>" class="mmed-file-link" download>
																<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
																View Your Submission
															</a>
														</div>
													<?php endif; ?>

													<div class="mmed-task-what-next">
														<span class="mmed-context-label">What happens next</span>
														<p><?php echo esc_html( self::task_next_step_copy( $task ) ); ?></p>
													</div>
												</div>
											</div>
										<?php endforeach; ?>
									</div>
								</div>
							<?php endforeach; ?>
						<?php elseif ( $division['available'] ) : ?>
							<div class="mmed-panel">
								<p class="mmed-empty-state">No advisor milestones are assigned in this division yet. Course progress and sessions will still sync here as they become available.</p>
							</div>
						<?php else : ?>
							<div class="mmed-panel">
								<p class="mmed-empty-state"><?php echo esc_html( $division['empty_state'] ); ?></p>
							</div>
						<?php endif; ?>
					</section>
				<?php endforeach; ?>
			</div>

			<div class="mmed-view mmed-view-sessions" id="view-sessions">
				<div class="mmed-view-header">
					<h2 class="mmed-view-title">Sessions</h2>
					<div class="mmed-view-meta">
						<span data-active-division-label><?php echo esc_html( $division_hubs[ $default_division ]['label'] ); ?></span>
					</div>
				</div>

				<?php foreach ( $division_hubs as $division_id => $division ) : ?>
					<?php $is_active = $division_id === $default_division; ?>
					<section class="mmed-division-scoped<?php echo $is_active ? ' is-active' : ''; ?>" data-division-scope="<?php echo esc_attr( $division_id ); ?>" <?php echo $is_active ? '' : 'hidden'; ?>>
						<?php if ( ! empty( $division['next_session'] ) ) : ?>
							<div class="mmed-panel">
								<div class="mmed-session-card mmed-session-large">
									<?php if ( ! empty( $division['next_session']['type'] ) ) : ?>
										<span class="mmed-session-type"><?php echo esc_html( ucfirst( str_replace( '_', ' ', $division['next_session']['type'] ) ) ); ?></span>
									<?php endif; ?>
									<h3 class="mmed-session-name"><?php echo esc_html( $division['next_session']['title'] ); ?></h3>
									<p class="mmed-session-datetime" data-timestamp="<?php echo esc_attr( $division['next_session']['timestamp'] ); ?>">
										<?php echo esc_html( $division['next_session']['display_date'] ); ?>
									</p>
									<?php if ( ! empty( $division['next_session']['zoom_link'] ) ) : ?>
										<a href="<?php echo esc_url( $division['next_session']['zoom_link'] ); ?>" class="mmed-btn mmed-btn-primary" target="_blank" rel="noopener">Join Session</a>
									<?php endif; ?>
								</div>
							</div>
						<?php endif; ?>

						<div class="mmed-panel">
							<h3 class="mmed-panel-title"><?php echo esc_html( $division['booking_label'] ); ?></h3>
							<p class="mmed-empty-state">Schedule time with your advisor to review progress, answer questions, and plan the next move inside <?php echo esc_html( $division['label'] ); ?>.</p>
							<a href="<?php echo esc_url( $division['booking_url'] ); ?>" class="mmed-btn mmed-btn-primary" target="_blank" rel="noopener">Book a Session</a>
						</div>
					</section>
				<?php endforeach; ?>
			</div>

			<div class="mmed-view mmed-view-courses" id="view-courses">
				<div class="mmed-view-header">
					<h2 class="mmed-view-title">Courses</h2>
					<div class="mmed-view-meta">
						<span data-active-division-label><?php echo esc_html( $division_hubs[ $default_division ]['label'] ); ?></span>
					</div>
				</div>

				<?php foreach ( $division_hubs as $division_id => $division ) : ?>
					<?php $is_active = $division_id === $default_division; ?>
					<section class="mmed-division-scoped<?php echo $is_active ? ' is-active' : ''; ?>" data-division-scope="<?php echo esc_attr( $division_id ); ?>" <?php echo $is_active ? '' : 'hidden'; ?>>
						<?php if ( ! empty( $division['courses'] ) ) : ?>
							<?php foreach ( $division['courses'] as $course ) : ?>
								<?php
								if ( $course['progress_pct'] >= 100 ) {
									$course_cta   = 'Review Materials';
									$course_state = 'complete';
								} elseif ( $course['progress_pct'] > 0 ) {
									$course_cta   = 'Continue Where You Left Off';
									$course_state = 'in-progress';
								} else {
									$course_cta   = 'Start This Course';
									$course_state = 'not-started';
								}
								?>
								<div class="mmed-panel mmed-course-card mmed-course-<?php echo esc_attr( $course_state ); ?>">
									<div class="mmed-course-header">
										<h3 class="mmed-course-name"><?php echo esc_html( $course['title'] ); ?></h3>
										<span class="mmed-course-pct"><?php echo esc_html( $course['progress_pct'] ); ?>%</span>
									</div>
									<div class="mmed-phase-bar">
										<div class="mmed-phase-fill" style="width: <?php echo esc_attr( $course['progress_pct'] ); ?>%;"></div>
									</div>
									<p class="mmed-course-meta"><?php echo esc_html( $course['completed'] . ' of ' . $course['total'] . ' lessons completed' ); ?></p>
									<a href="<?php echo esc_url( $course['url'] ); ?>" class="mmed-btn mmed-btn-primary"><?php echo esc_html( $course_cta ); ?></a>
								</div>
							<?php endforeach; ?>
						<?php else : ?>
							<div class="mmed-panel">
								<p class="mmed-empty-state"><?php echo esc_html( $division['empty_state'] ); ?></p>
							</div>
						<?php endif; ?>
					</section>
				<?php endforeach; ?>
			</div>

			<div class="mmed-view mmed-view-videos" id="view-videos">
				<div class="mmed-view-header">
					<h2 class="mmed-view-title">Videos</h2>
					<div class="mmed-view-meta">
						<span class="mmed-tasks-count"><?php echo esc_html( count( $video_library['videos'] ) ); ?> ready to stream</span>
					</div>
				</div>

				<?php if ( ! empty( $video_library['videos'] ) ) : ?>
					<section class="mmed-panel mmed-video-library-shell" aria-label="Hub video library">
						<div class="mmed-video-library-head">
							<div class="mmed-video-library-copy">
								<span class="mmed-view-section-kicker">Manifest Library</span>
								<h3 class="mmed-video-library-title">On-demand playback sourced directly from the current video manifest.</h3>
								<p class="mmed-video-library-desc">Filter by division or category, then open any card to play the original playback URL from the manifest without proxying or URL rewrites.</p>
							</div>
							<div class="mmed-video-library-stats" aria-label="Video library summary">
								<div class="mmed-video-stat">
									<span class="mmed-video-stat-value"><?php echo esc_html( count( $video_library['videos'] ) ); ?></span>
									<span class="mmed-video-stat-label">Playable videos</span>
								</div>
								<div class="mmed-video-stat">
									<span class="mmed-video-stat-value"><?php echo esc_html( count( $video_library['divisions'] ) ); ?></span>
									<span class="mmed-video-stat-label">Divisions</span>
								</div>
								<div class="mmed-video-stat">
									<span class="mmed-video-stat-value"><?php echo esc_html( count( $video_library['categories'] ) ); ?></span>
									<span class="mmed-video-stat-label">Categories</span>
								</div>
							</div>
						</div>

						<div class="mmed-video-filters" aria-label="Video filters">
							<label class="mmed-video-filter">
								<span class="mmed-video-filter-label">Division</span>
								<select class="mmed-video-filter-select" data-video-filter="division">
									<option value="all">All divisions</option>
									<?php foreach ( $video_library['divisions'] as $division_option ) : ?>
										<option value="<?php echo esc_attr( $division_option['value'] ); ?>">
											<?php echo esc_html( $division_option['label'] . ' (' . $division_option['count'] . ')' ); ?>
										</option>
									<?php endforeach; ?>
								</select>
							</label>

							<label class="mmed-video-filter">
								<span class="mmed-video-filter-label">Category</span>
								<select class="mmed-video-filter-select" data-video-filter="category">
									<option value="all">All categories</option>
									<?php foreach ( $video_library['categories'] as $category_option ) : ?>
										<option value="<?php echo esc_attr( $category_option['value'] ); ?>">
											<?php echo esc_html( $category_option['label'] . ' (' . $category_option['count'] . ')' ); ?>
										</option>
									<?php endforeach; ?>
								</select>
							</label>
						</div>

						<p class="mmed-video-results-summary" data-video-results-summary>
							Showing <?php echo esc_html( count( $video_library['videos'] ) ); ?> of <?php echo esc_html( count( $video_library['videos'] ) ); ?> videos
						</p>

						<div class="mmed-video-grid" data-video-grid>
							<?php foreach ( $video_library['videos'] as $video ) : ?>
								<?php
								$video_meta_parts = array(
									$video['division_label'],
									$video['category_label'],
									$video['duration_label'],
								);
								$video_meta       = implode( ' | ', array_filter( $video_meta_parts ) );
								?>
								<article
									class="mmed-video-card"
									data-video-card
									data-video-division="<?php echo esc_attr( $video['division'] ); ?>"
									data-video-category="<?php echo esc_attr( $video['category'] ); ?>"
								>
									<button
										type="button"
										class="mmed-video-card-button"
										data-video-trigger
										data-playback-url="<?php echo esc_url( $video['playback_url'] ); ?>"
										data-video-title="<?php echo esc_attr( $video['title'] ); ?>"
										data-video-meta="<?php echo esc_attr( $video_meta ); ?>"
									>
										<div class="mmed-video-thumb<?php echo empty( $video['thumbnail'] ) ? ' mmed-video-thumb-placeholder' : ''; ?>">
											<?php if ( ! empty( $video['thumbnail'] ) ) : ?>
												<img src="<?php echo esc_url( $video['thumbnail'] ); ?>" alt="<?php echo esc_attr( $video['title'] ); ?>" loading="lazy" />
											<?php else : ?>
												<div class="mmed-video-thumb-copy">
													<span class="mmed-video-thumb-badge"><?php echo esc_html( $video['division_label'] ); ?></span>
													<span class="mmed-video-thumb-text"><?php echo esc_html( $video['category_label'] ); ?></span>
												</div>
											<?php endif; ?>
											<span class="mmed-video-play-chip" aria-hidden="true">
												<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 5.5v9l7-4.5-7-4.5z" fill="currentColor"/></svg>
												Play
											</span>
										</div>

										<div class="mmed-video-card-body">
											<div class="mmed-video-card-pills">
												<span class="mmed-video-pill"><?php echo esc_html( $video['division_label'] ); ?></span>
												<span class="mmed-video-pill mmed-video-pill-secondary"><?php echo esc_html( $video['category_label'] ); ?></span>
											</div>
											<h3 class="mmed-video-card-title"><?php echo esc_html( $video['title'] ); ?></h3>
											<div class="mmed-video-card-meta">
												<span><?php echo esc_html( $video['duration_label'] ); ?></span>
												<?php if ( ! empty( $video['segment_count'] ) ) : ?>
													<span><?php echo esc_html( number_format_i18n( $video['segment_count'] ) ); ?> segments</span>
												<?php endif; ?>
											</div>
										</div>
									</button>
								</article>
							<?php endforeach; ?>
						</div>

						<p class="mmed-empty-state mmed-video-empty-state" data-video-empty hidden>No videos match the current filters.</p>
					</section>
				<?php else : ?>
					<div class="mmed-panel">
						<p class="mmed-empty-state"><?php echo esc_html( $video_library['status_message'] ); ?></p>
					</div>
				<?php endif; ?>
			</div>

			<div class="mmed-view mmed-view-documents" id="view-documents">
				<div class="mmed-view-header">
					<h2 class="mmed-view-title">Documents</h2>
					<div class="mmed-view-meta">
						<span data-active-division-label><?php echo esc_html( $division_hubs[ $default_division ]['label'] ); ?></span>
					</div>
				</div>

				<?php foreach ( $division_hubs as $division_id => $division ) : ?>
					<?php $is_active = $division_id === $default_division; ?>
					<section class="mmed-division-scoped<?php echo $is_active ? ' is-active' : ''; ?>" data-division-scope="<?php echo esc_attr( $division_id ); ?>" <?php echo $is_active ? '' : 'hidden'; ?>>
						<?php if ( ! empty( $division['docs'] ) ) : ?>
							<div class="mmed-panel">
								<p class="mmed-docs-intro">Submitted files for <?php echo esc_html( $division['label'] ); ?> are stored here for quick access.</p>
								<div class="mmed-doc-list">
									<?php foreach ( $division['docs'] as $doc ) : ?>
										<?php
										$doc_state_label = $status_labels[ $doc['status'] ] ?? '';
										$doc_state_color = $status_colors[ $doc['status'] ] ?? '#6B7280';
										?>
										<div class="mmed-doc-item">
											<svg class="mmed-doc-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
											<span class="mmed-doc-name"><?php echo esc_html( $doc['post_title'] ); ?></span>
											<?php if ( $doc_state_label ) : ?>
												<span class="mmed-doc-status" style="color: <?php echo esc_attr( $doc_state_color ); ?>;"><?php echo esc_html( $doc_state_label ); ?></span>
											<?php endif; ?>
											<a href="<?php echo esc_url( $doc['file_url'] ); ?>" class="mmed-doc-download" download>Download</a>
										</div>
									<?php endforeach; ?>
								</div>
							</div>
						<?php else : ?>
							<div class="mmed-panel">
								<p class="mmed-empty-state">Uploaded files for <?php echo esc_html( $division['label'] ); ?> will appear here once milestones start receiving submissions.</p>
							</div>
						<?php endif; ?>
					</section>
				<?php endforeach; ?>
			</div>
		</main>

		<div class="mmed-video-modal" id="mmed-video-modal" hidden aria-hidden="true">
			<div class="mmed-video-modal-backdrop" data-video-close></div>
			<div class="mmed-video-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="mmed-video-modal-title">
				<button type="button" class="mmed-video-modal-close" data-video-close aria-label="Close video player">
					<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
				</button>
				<div class="mmed-video-player-shell">
					<video id="mmed-video-player" class="mmed-video-player" controls preload="metadata" playsinline hidden></video>
					<iframe id="mmed-video-embed" class="mmed-video-embed" title="MissionMed video playback" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen hidden></iframe>
				</div>
				<div class="mmed-video-modal-body">
					<span class="mmed-video-modal-kicker" id="mmed-video-modal-meta">MissionMed Video Library</span>
					<h3 class="mmed-video-modal-title" id="mmed-video-modal-title">Video playback</h3>
					<a id="mmed-video-modal-link" class="mmed-video-modal-link" href="#" target="_blank" rel="noopener">Open original playback URL</a>
				</div>
			</div>
		</div>

		<div class="mmed-overlay" id="mmed-overlay"></div>
		<?php
	}

	/**
	 * Shortcode tags supported by the renderer.
	 *
	 * @return array
	 */
	private static function get_shortcode_tags() {
		return array( 'mmed_hub', 'mmed_command_center' );
	}

	/**
	 * Division definitions.
	 *
	 * @return array
	 */
	private static function get_division_definitions() {
		return array(
			'residency' => array(
				'label'                => 'Mission Residency',
				'short'                => 'Residency',
				'icon'                 => 'MR',
				'description'          => 'Applications, interview prep, advisor milestones, and match strategy in one command lane.',
				'accent'               => '#C9A84C',
				'accent_soft'          => 'rgba(201, 168, 76, 0.16)',
				'task_divisions'       => array( 'residency' ),
				'task_tiers'           => array( '360elite', '360elite_onboarding', 'interview_prep_complete', 'interview_prep_foundation' ),
				'course_option_keys'   => array( 'mmed_course_360elite', 'mmed_course_complete', 'mmed_course_foundation' ),
				'group_option_keys'    => array( 'mmed_group_residency' ),
				'keywords'             => array( 'mission residency', 'residency', 'match', 'eras', 'interview' ),
				'support_email_option' => 'mmed_support_email_residency',
				'fallback_support'     => 'info@missionmedinstitute.com',
				'booking_label'        => 'Book Residency Session',
				'empty_state'          => 'Residency materials and advisor milestones will appear here once your LearnDash enrollment is connected.',
			),
			'usmle' => array(
				'label'                => 'USMLE Exam Prep',
				'short'                => 'USMLE',
				'icon'                 => 'US',
				'description'          => 'Study pacing, exam readiness, score-focused review, and next-step preparation across Step content.',
				'accent'               => '#2C7BE5',
				'accent_soft'          => 'rgba(44, 123, 229, 0.16)',
				'task_divisions'       => array( 'usmle' ),
				'task_tiers'           => array( 'usmle_prep', 'usmle_exam_prep' ),
				'course_option_keys'   => array( 'mmed_course_usmle' ),
				'group_option_keys'    => array( 'mmed_group_usmle' ),
				'keywords'             => array( 'usmle', 'step 1', 'step 2', 'exam prep', 'qbank', 'question bank' ),
				'support_email_option' => 'mmed_support_email_usmle',
				'fallback_support'     => 'info@missionmedinstitute.com',
				'booking_label'        => 'Book USMLE Review Session',
				'empty_state'          => 'USMLE dashboard content will populate here once the exam prep course or group is assigned to this user.',
			),
			'clinicals' => array(
				'label'                => 'Clinicals',
				'short'                => 'Clinicals',
				'icon'                 => 'CL',
				'description'          => 'Compliance, clearance, documents, and clinical placement readiness in one operating view.',
				'accent'               => '#0F9D8A',
				'accent_soft'          => 'rgba(15, 157, 138, 0.16)',
				'task_divisions'       => array( 'clinicals' ),
				'task_tiers'           => array( 'usce_onboarding' ),
				'course_option_keys'   => array( 'mmed_course_usce' ),
				'group_option_keys'    => array( 'mmed_group_clinicals' ),
				'keywords'             => array( 'usce', 'clinical', 'clinicals', 'rotation', 'observership', 'onboarding' ),
				'support_email_option' => 'mmed_support_email_clinicals',
				'fallback_support'     => 'clinicals@missionmedinstitute.com',
				'booking_label'        => 'Book Clinicals Session',
				'empty_state'          => 'Clinical onboarding documents, sessions, and placement tasks will appear here after activation.',
			),
		);
	}

	/**
	 * Status colors and labels.
	 *
	 * @return array
	 */
	private static function get_status_maps() {
		return array(
			'colors' => array(
				'not_started'     => '#9E9E9E',
				'in_progress'     => '#2196F3',
				'pending_review'  => '#FF9800',
				'approved'        => '#4CAF50',
				'revision_needed' => '#F44336',
			),
			'labels' => array(
				'not_started'     => 'Not Started',
				'in_progress'     => 'In Progress',
				'pending_review'  => 'Under Review',
				'approved'        => 'Approved',
				'revision_needed' => 'Needs Revision',
			),
		);
	}

	/**
	 * Load task data for the current user.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	private static function get_user_tasks( $user_id ) {
		$posts = get_posts(
			array(
				'post_type'   => 'mmed_task',
				'numberposts' => -1,
				'meta_query'  => array(
					array(
						'key'   => '_mmed_student_id',
						'value' => $user_id,
						'type'  => 'NUMERIC',
					),
				),
				'orderby'     => 'meta_value_num',
				'meta_key'    => '_mmed_sort_order',
				'order'       => 'ASC',
			)
		);

		$tasks = array();
		foreach ( $posts as $post ) {
			$due_date   = get_post_meta( $post->ID, '_mmed_due_date', true );
			$updated_ts = (int) get_post_modified_time( 'U', true, $post );
			if ( ! $updated_ts ) {
				$updated_ts = strtotime( $post->post_date_gmt ?: $post->post_date );
			}

			$tasks[] = array(
				'ID'            => $post->ID,
				'post_title'    => $post->post_title,
				'description'   => get_post_meta( $post->ID, '_mmed_instructions', true ) ?: $post->post_content,
				'status'        => get_post_meta( $post->ID, '_mmed_status', true ) ?: 'not_started',
				'due_date'      => $due_date,
				'due_label'     => self::format_due_label( $due_date ),
				'requires_file' => (bool) get_post_meta( $post->ID, '_mmed_requires_file', true ),
				'file_url'      => get_post_meta( $post->ID, '_mmed_file_url', true ),
				'file_id'       => get_post_meta( $post->ID, '_mmed_file_id', true ),
				'sort_order'    => (int) get_post_meta( $post->ID, '_mmed_sort_order', true ),
				'division'      => get_post_meta( $post->ID, '_mmed_division', true ),
				'program_tier'  => get_post_meta( $post->ID, '_mmed_program_tier', true ),
				'staff_note'    => get_post_meta( $post->ID, '_mmed_staff_note', true ),
				'updated_ts'    => $updated_ts,
			);
		}

		return $tasks;
	}

	/**
	 * Course progress data from LearnDash.
	 *
	 * @param int   $user_id          User ID.
	 * @param array $enrolled_courses Course IDs.
	 * @return array
	 */
	private static function get_course_progress_data( $user_id, $enrolled_courses ) {
		if ( empty( $enrolled_courses ) || ! function_exists( 'learndash_user_get_course_progress' ) ) {
			return array();
		}

		$data = array();
		foreach ( $enrolled_courses as $course_id ) {
			$course_progress = learndash_user_get_course_progress( $user_id, $course_id );
			$total_lessons   = function_exists( 'learndash_get_course_steps' ) ? count( learndash_get_course_steps( $course_id, array( 'sfwd-lessons' ) ) ) : 0;
			$completed       = (int) ( $course_progress['completed'] ?? 0 );
			$progress_pct    = $total_lessons > 0 ? round( ( $completed / $total_lessons ) * 100 ) : 0;
			$title           = get_the_title( $course_id );

			$data[] = array(
				'id'             => $course_id,
				'title'          => $title,
				'total'          => $total_lessons,
				'completed'      => $completed,
				'progress_pct'   => $progress_pct,
				'url'            => get_permalink( $course_id ),
				'division_guess' => self::infer_course_division( $course_id, $title ),
			);
		}

		return $data;
	}

	/**
	 * Remove duplicate course titles and sort by relevance.
	 *
	 * @param array $courses Courses.
	 * @return array
	 */
	private static function filter_courses( $courses ) {
		if ( empty( $courses ) ) {
			return array();
		}

		$seen = array();
		foreach ( $courses as $course ) {
			$key = strtolower( trim( $course['title'] ) );
			if ( ! isset( $seen[ $key ] ) || $course['progress_pct'] > $seen[ $key ]['progress_pct'] ) {
				$seen[ $key ] = $course;
			}
		}

		$unique = array_values( $seen );
		usort(
			$unique,
			function ( $a, $b ) {
				$order_a = self::course_sort_priority( $a['progress_pct'] );
				$order_b = self::course_sort_priority( $b['progress_pct'] );
				if ( $order_a !== $order_b ) {
					return $order_a - $order_b;
				}

				return $b['progress_pct'] - $a['progress_pct'];
			}
		);

		return $unique;
	}

	/**
	 * Sort priority for course cards.
	 *
	 * @param int $pct Progress percent.
	 * @return int
	 */
	private static function course_sort_priority( $pct ) {
		if ( $pct > 0 && $pct < 100 ) {
			return 1;
		}
		if ( 0 === (int) $pct ) {
			return 2;
		}

		return 3;
	}

	/**
	 * Infer course division from configured IDs or course title keywords.
	 *
	 * @param int    $course_id Course ID.
	 * @param string $title     Course title.
	 * @return string
	 */
	private static function infer_course_division( $course_id, $title ) {
		$definitions = self::get_division_definitions();
		$title_lc    = strtolower( $title );

		foreach ( $definitions as $division_id => $definition ) {
			if ( in_array( (int) $course_id, self::get_option_ids( $definition['course_option_keys'] ), true ) ) {
				return $division_id;
			}
		}

		foreach ( $definitions as $division_id => $definition ) {
			foreach ( $definition['keywords'] as $keyword ) {
				if ( false !== strpos( $title_lc, strtolower( $keyword ) ) ) {
					return $division_id;
				}
			}
		}

		return '';
	}

	/**
	 * Build per-division dashboard datasets.
	 *
	 * @param int    $user_id          User ID.
	 * @param string $primary_division Primary division.
	 * @param string $program_tier     Program tier.
	 * @param array  $tasks            Tasks.
	 * @param array  $course_data      Courses.
	 * @return array
	 */
	private static function get_division_hubs( $user_id, $primary_division, $program_tier, $tasks, $course_data ) {
		$definitions   = self::get_division_definitions();
		$user_groups   = self::get_user_group_ids( $user_id );
		$account_url   = self::get_account_url( $user_id );
		$booking_url   = get_option( 'mmed_calendly_url' );
		$primary_guess = $primary_division ?: self::division_from_program_tier( $program_tier );
		$divisions     = array();

		foreach ( $definitions as $division_id => $definition ) {
			$division_tasks = array_values(
				array_filter(
					$tasks,
					function ( $task ) use ( $division_id, $definition ) {
						return self::task_matches_division( $task, $division_id, $definition );
					}
				)
			);

			$division_courses = array_values(
				array_filter(
					$course_data,
					function ( $course ) use ( $division_id ) {
						return $division_id === ( $course['division_guess'] ?? '' );
					}
				)
			);

			$phase_tier       = self::get_division_phase_tier( $division_id, $division_tasks, $program_tier );
			$phases           = self::get_phases_for_user( $phase_tier, $division_tasks );
			$task_summary     = self::get_task_summary( $division_tasks );
			$course_summary   = self::get_course_summary( $division_courses );
			$progress_pct     = self::get_combined_progress( $task_summary['progress_pct'], $course_summary['avg_progress'], ! empty( $division_tasks ), ! empty( $division_courses ) );
			$next_action      = self::get_next_action( $division_tasks );
			$next_session     = self::get_next_session( array_column( $division_courses, 'id' ) );
			$docs             = array_values(
				array_filter(
					$division_tasks,
					function ( $task ) {
						return ! empty( $task['file_url'] );
					}
				)
			);
			$available        = ! empty( $division_tasks ) || ! empty( $division_courses ) || self::division_has_group_access( $definition, $user_groups ) || $primary_guess === $division_id;
			$support_email    = self::get_division_support_email( $definition );
			$resume_course    = self::get_resume_course( $division_courses );
			$alerts           = self::get_alerts_for_division( $division_tasks, $next_session, $definition['label'] );
			$recent_activity  = self::get_recent_activity_for_division( $division_tasks, $next_session, $definition['label'] );
			$tab_meta         = $available
				? trim( $course_summary['count'] . ' courses • ' . $task_summary['open'] . ' open milestones' )
				: 'Ready when this division is enrolled';
			$tab_pill         = $available ? ( $progress_pct > 0 ? $progress_pct . '% synced' : 'Active' ) : 'Inactive';

			$divisions[ $division_id ] = array(
				'id'             => $division_id,
				'label'          => $definition['label'],
				'short'          => $definition['short'],
				'icon'           => $definition['icon'],
				'description'    => $definition['description'],
				'accent'         => $definition['accent'],
				'accent_soft'    => $definition['accent_soft'],
				'available'      => $available,
				'booking_url'    => $booking_url,
				'booking_label'  => $definition['booking_label'],
				'empty_state'    => $definition['empty_state'],
				'support_email'  => $support_email,
				'account_url'    => $account_url,
				'tasks'          => $division_tasks,
				'courses'        => $division_courses,
				'docs'           => $docs,
				'phases'         => $phases,
				'active_phase'   => self::get_active_phase( $phases ),
				'task_summary'   => $task_summary,
				'course_summary' => $course_summary,
				'progress_pct'   => $progress_pct,
				'next_action'    => $next_action,
				'next_session'   => $next_session,
				'resume_course'  => $resume_course,
				'alerts'         => $alerts,
				'recent_activity'=> $recent_activity,
				'tab_meta'       => $tab_meta,
				'tab_pill'       => $tab_pill,
				'tools'          => self::get_division_tools( $division_id, $definition['label'], $support_email, $account_url, $booking_url, $resume_course ),
			);
		}

		return $divisions;
	}

	/**
	 * Master HUD data across all divisions.
	 *
	 * @param array $division_hubs Division data.
	 * @param array $tasks         Tasks.
	 * @param array $course_data   Course data.
	 * @return array
	 */
	private static function get_master_hud( $division_hubs, $tasks, $course_data ) {
		$active_divisions = array_values(
			array_filter(
				$division_hubs,
				function ( $division ) {
					return ! empty( $division['available'] );
				}
			)
		);

		$task_summary    = self::get_task_summary( $tasks );
		$course_summary  = self::get_course_summary( $course_data );
		$overall_progress = self::get_combined_progress( $task_summary['progress_pct'], $course_summary['avg_progress'], ! empty( $tasks ), ! empty( $course_data ) );
		$alerts          = self::flatten_division_entries( $division_hubs, 'alerts', 3, 'alert_rank' );
		$activity        = self::flatten_division_entries( $division_hubs, 'recent_activity', 4, 'timestamp', true );
		$labels          = array_map(
			function ( $division ) {
				return $division['label'];
			},
			$active_divisions
		);

		return array(
			'available_count' => count( $active_divisions ),
			'active_labels'   => ! empty( $labels ) ? $labels : array( 'No active divisions yet' ),
			'course_count'    => $course_summary['count'],
			'approved_tasks'  => $task_summary['approved'],
			'overall_progress'=> $overall_progress,
			'alerts'          => $alerts,
			'alert_count'     => count( $alerts ),
			'recent_activity' => $activity,
			'enrollment_copy' => count( $active_divisions ) > 0
				? count( $active_divisions ) . ' division' . ( count( $active_divisions ) === 1 ? '' : 's' ) . ' connected with ' . $course_summary['count'] . ' LearnDash course' . ( 1 === $course_summary['count'] ? '' : 's' ) . '.'
				: 'No active LearnDash division has been connected for this user yet.',
			'progress_copy'   => $task_summary['approved'] . ' of ' . $task_summary['total'] . ' milestones approved and an average course completion of ' . $course_summary['avg_progress'] . '%.',
		);
	}

	/**
	 * Build cached manifest-driven video library data.
	 *
	 * @return array
	 */
	public static function get_video_library_data() {
		static $library = null;

		if ( null !== $library ) {
			return $library;
		}

		$default = array(
			'videos'         => array(),
			'divisions'      => array(),
			'categories'     => array(),
			'summary'        => array(),
			'status_message' => 'Video library is not available right now.',
		);
		$manifest_path = dirname( MMED_HUB_PATH ) . '/VIDEO_SYSTEM/exports/video_manifest.json';

		if ( ! file_exists( $manifest_path ) || ! is_readable( $manifest_path ) ) {
			$default['status_message'] = 'The video manifest could not be found from the Hub plugin path.';
			$library                   = $default;
			return $library;
		}

		$file_mtime = (int) filemtime( $manifest_path );
		$cache_key  = 'mmed_hub_video_manifest_v1';
		$cached     = get_transient( $cache_key );

		if ( is_array( $cached ) && (int) ( $cached['file_mtime'] ?? 0 ) === $file_mtime && ! empty( $cached['payload'] ) ) {
			$library = $cached['payload'];
			return $library;
		}

		$raw_manifest = file_get_contents( $manifest_path );
		if ( false === $raw_manifest ) {
			$default['status_message'] = 'The video manifest exists but could not be read.';
			$library                   = $default;
			return $library;
		}

		$manifest = json_decode( $raw_manifest, true );
		if ( ! is_array( $manifest ) ) {
			$default['status_message'] = 'The video manifest JSON is invalid and could not be rendered.';
			$library                   = $default;
			return $library;
		}

		$videos           = array();
		$division_counts  = array();
		$category_counts  = array();
		$manifest_videos  = isset( $manifest['videos'] ) && is_array( $manifest['videos'] ) ? $manifest['videos'] : array();

		foreach ( $manifest_videos as $index => $video ) {
			if ( ! is_array( $video ) ) {
				continue;
			}

			$playback_url = ! empty( $video['playback_url'] ) ? esc_url_raw( $video['playback_url'] ) : '';
			if ( empty( $playback_url ) ) {
				continue;
			}

			$title          = ! empty( $video['title'] ) ? sanitize_text_field( $video['title'] ) : 'Untitled Video';
			$division_value = ! empty( $video['division'] ) ? sanitize_title( $video['division'] ) : 'general';
			$category_label = ! empty( $video['category'] ) ? sanitize_text_field( $video['category'] ) : 'General';
			$category_value = sanitize_title( $category_label );
			$thumbnail      = ! empty( $video['thumbnail'] ) ? esc_url_raw( $video['thumbnail'] ) : '';
			$segment_count  = isset( $video['segment_count'] ) ? absint( $video['segment_count'] ) : 0;
			$duration       = isset( $video['duration'] ) ? (float) $video['duration'] : 0;
			$video_id       = ! empty( $video['id'] ) ? sanitize_title( $video['id'] ) : 'video-' . ( $index + 1 );
			$topics         = array();
			$collections    = array();

			if ( ! empty( $video['topics'] ) && is_array( $video['topics'] ) ) {
				$topics = array_values(
					array_filter(
						array_map( 'sanitize_text_field', $video['topics'] )
					)
				);
			}

			if ( ! empty( $video['collection_ids'] ) && is_array( $video['collection_ids'] ) ) {
				$collections = array_values(
					array_filter(
						array_map( 'sanitize_text_field', $video['collection_ids'] )
					)
				);
			}

			$videos[] = array(
				'id'             => $video_id,
				'title'          => $title,
				'division'       => $division_value,
				'division_label' => self::get_video_division_label( $division_value ),
				'category'       => $category_value,
				'category_label' => $category_label,
				'duration'       => $duration,
				'duration_label' => self::format_video_duration( $duration ),
				'thumbnail'      => $thumbnail,
				'playback_url'   => $playback_url,
				'segment_count'  => $segment_count,
				'topics'         => $topics,
				'collection_ids' => $collections,
			);

			$division_counts[ $division_value ] = ( $division_counts[ $division_value ] ?? 0 ) + 1;
			$category_counts[ $category_value ] = array(
				'label' => $category_label,
				'count' => ( $category_counts[ $category_value ]['count'] ?? 0 ) + 1,
			);
		}

		$library = array(
			'videos'         => $videos,
			'divisions'      => self::build_video_division_filters( $division_counts ),
			'categories'     => self::build_video_category_filters( $category_counts ),
			'summary'        => is_array( $manifest['summary'] ?? null ) ? $manifest['summary'] : array(),
			'status_message' => ! empty( $videos ) ? '' : 'No playable videos are currently included in the manifest.',
		);

		set_transient(
			$cache_key,
			array(
				'file_mtime' => $file_mtime,
				'payload'    => $library,
			),
			5 * MINUTE_IN_SECONDS
		);

		return $library;
	}

	/**
	 * Bootstrap payload for the LearnDash lesson video inserter.
	 *
	 * @param int $post_id Lesson post ID.
	 * @return array
	 */
	public static function get_video_editor_bootstrap( $post_id = 0 ) {
		$library      = self::get_video_library_data();
		$current_ids  = array_values( array_filter( array_map( 'sanitize_title', (array) get_post_meta( $post_id, 'mmed_video_ids', true ) ) ) );
		$library_data = array(
			'generated_at'   => sanitize_text_field( $library['summary']['generated_at'] ?? '' ),
			'status_message' => sanitize_text_field( $library['status_message'] ?? '' ),
			'videos'         => array(),
			'categories'     => array(),
			'post_video_ids' => $current_ids,
		);

		if ( ! empty( $library['categories'] ) && is_array( $library['categories'] ) ) {
			foreach ( $library['categories'] as $category ) {
				if ( empty( $category['value'] ) || empty( $category['label'] ) ) {
					continue;
				}

				$library_data['categories'][] = array(
					'value' => sanitize_title( $category['value'] ),
					'label' => sanitize_text_field( $category['label'] ),
					'count' => absint( $category['count'] ?? 0 ),
				);
			}
		}

		if ( ! empty( $library['videos'] ) && is_array( $library['videos'] ) ) {
			foreach ( $library['videos'] as $video ) {
				if ( empty( $video['id'] ) || empty( $video['playback_url'] ) ) {
					continue;
				}

				$topics      = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $video['topics'] ?? array() ) ) ) );
				$search_blob = implode(
					' ',
					array_filter(
						array(
							sanitize_text_field( $video['id'] ),
							sanitize_text_field( $video['title'] ?? '' ),
							sanitize_text_field( $video['division_label'] ?? '' ),
							sanitize_text_field( $video['category_label'] ?? '' ),
							implode( ' ', $topics ),
						)
					)
				);

				$library_data['videos'][] = array(
					'id'             => sanitize_title( $video['id'] ),
					'title'          => sanitize_text_field( $video['title'] ?? '' ),
					'division'       => sanitize_title( $video['division'] ?? '' ),
					'division_label' => sanitize_text_field( $video['division_label'] ?? '' ),
					'category'       => sanitize_title( $video['category'] ?? '' ),
					'category_label' => sanitize_text_field( $video['category_label'] ?? '' ),
					'duration'       => (float) ( $video['duration'] ?? 0 ),
					'duration_label' => sanitize_text_field( $video['duration_label'] ?? '' ),
					'thumbnail'      => esc_url_raw( $video['thumbnail'] ?? '' ),
					'playback_url'   => esc_url_raw( $video['playback_url'] ?? '' ),
					'segment_count'  => absint( $video['segment_count'] ?? 0 ),
					'topics'         => $topics,
					'search_blob'    => strtolower( $search_blob ),
				);
			}
		}

		return $library_data;
	}

	/**
	 * Render the LearnDash video shortcode.
	 *
	 * @param array  $atts    Shortcode attributes.
	 * @param string $content Shortcode content (unused).
	 * @param string $tag     Shortcode tag used.
	 * @return string
	 */
	public static function render_video_shortcode( $atts, $content = '', $tag = '' ) {
		$atts     = shortcode_atts(
			array(
				'id' => '',
			),
			(array) $atts,
			$tag ? $tag : 'mm_video'
		);
		$video_id = sanitize_title( $atts['id'] );

		if ( empty( $video_id ) ) {
			return '';
		}

		$video = self::get_video_manifest_entry( $video_id );
		if ( empty( $video['playback_url'] ) ) {
			$message = current_user_can( 'edit_post', get_the_ID() )
				? 'MissionMed video "' . $video_id . '" is not available in the current manifest.'
				: 'This video is temporarily unavailable.';

			return '<div class="mmed-lesson-video-unavailable">' . esc_html( $message ) . '</div>';
		}

		static $styles_printed = false;
		$style_html = '';
		if ( ! $styles_printed && function_exists( 'mmed_hub_get_css_block' ) ) {
			$inline_css = mmed_hub_get_css_block( 'MMED_VIDEO_SHORTCODE' );
			if ( $inline_css ) {
				$style_html = '<style id="mmed-video-shortcode-inline">' . $inline_css . '</style>';
			}
			$styles_printed = true;
		}

		$title         = $video['title'] ?? 'MissionMed Video';
		$duration      = $video['duration_label'] ?? '';
		$category      = $video['category_label'] ?? '';
		$poster        = ! empty( $video['thumbnail'] ) ? $video['thumbnail'] : '';
		$player_markup = '';

		if ( self::is_direct_video_file( $video['playback_url'] ) ) {
			$poster_attr   = $poster ? ' poster="' . esc_url( $poster ) . '"' : '';
			$player_markup = '<video class="mmed-lesson-video-player" controls preload="metadata" playsinline' . $poster_attr . '><source src="' . esc_url( $video['playback_url'] ) . '" type="video/mp4"></video>';
		} else {
			$player_markup = '<iframe class="mmed-lesson-video-embed" src="' . esc_url( $video['playback_url'] ) . '" title="' . esc_attr( $title ) . '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
		}

		$meta_parts = array_filter( array( $category, $duration ) );
		$meta_copy  = ! empty( $meta_parts ) ? implode( ' | ', $meta_parts ) : 'MissionMed Library';

		return $style_html .
			'<div class="mmed-lesson-video-shell" data-mmed-video-id="' . esc_attr( $video_id ) . '">' .
				'<div class="mmed-lesson-video-header">' .
					'<div class="mmed-lesson-video-copy">' .
						'<span class="mmed-lesson-video-kicker">MissionMed Video</span>' .
						'<h3 class="mmed-lesson-video-title">' . esc_html( $title ) . '</h3>' .
						'<p class="mmed-lesson-video-meta">' . esc_html( $meta_copy ) . '</p>' .
					'</div>' .
				'</div>' .
				'<div class="mmed-lesson-video-frame">' . $player_markup . '</div>' .
			'</div>';
	}

	/**
	 * Sync the canonical lesson video ID array based on shortcode content.
	 *
	 * @param int     $post_id Post ID.
	 * @param WP_Post $post    Post object.
	 * @return void
	 */
	public static function sync_lesson_video_meta( $post_id, $post ) {
		if ( empty( $post_id ) || empty( $post ) || 'sfwd-lessons' !== $post->post_type ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) || ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) ) {
			return;
		}

		$video_ids = self::extract_video_ids_from_content( $post->post_content );
		if ( ! empty( $video_ids ) ) {
			update_post_meta( $post_id, 'mmed_video_ids', $video_ids );
		} else {
			delete_post_meta( $post_id, 'mmed_video_ids' );
		}
	}

	/**
	 * Resolve a normalized manifest video entry by ID.
	 *
	 * @param string $video_id Video ID.
	 * @return array|null
	 */
	private static function get_video_manifest_entry( $video_id ) {
		static $lookup = null;

		if ( null === $lookup ) {
			$lookup = array();
			$videos = self::get_video_library_data()['videos'] ?? array();
			foreach ( $videos as $video ) {
				if ( empty( $video['id'] ) ) {
					continue;
				}
				$lookup[ sanitize_title( $video['id'] ) ] = $video;
			}
		}

		$normalized_id = sanitize_title( $video_id );
		return $lookup[ $normalized_id ] ?? null;
	}

	/**
	 * Extract ordered unique MissionMed video IDs from lesson content.
	 *
	 * @param string $content Post content.
	 * @return array
	 */
	private static function extract_video_ids_from_content( $content ) {
		if ( ! is_string( $content ) || '' === $content ) {
			return array();
		}

		$pattern = get_shortcode_regex( array( 'mm_video', 'mmed_video' ) );
		if ( ! preg_match_all( '/' . $pattern . '/', $content, $matches, PREG_SET_ORDER ) ) {
			return array();
		}

		$video_ids = array();
		foreach ( $matches as $match ) {
			if ( empty( $match[3] ) ) {
				continue;
			}

			$atts = shortcode_parse_atts( $match[3] );
			if ( empty( $atts['id'] ) ) {
				continue;
			}

			$video_id = sanitize_title( $atts['id'] );
			if ( $video_id && ! in_array( $video_id, $video_ids, true ) ) {
				$video_ids[] = $video_id;
			}
		}

		return $video_ids;
	}

	/**
	 * Determine whether a URL can render in a native HTML5 video element.
	 *
	 * @param string $url Media URL.
	 * @return bool
	 */
	private static function is_direct_video_file( $url ) {
		if ( ! is_string( $url ) || '' === $url ) {
			return false;
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );
		if ( ! is_string( $path ) || '' === $path ) {
			$path = $url;
		}

		return (bool) preg_match( '/\.(mp4|m4v|mov|webm|ogg)$/i', $path );
	}

	/**
	 * Division filter options for the video library.
	 *
	 * @param array $division_counts Division counts keyed by slug.
	 * @return array
	 */
	private static function build_video_division_filters( $division_counts ) {
		if ( empty( $division_counts ) ) {
			return array();
		}

		ksort( $division_counts );
		$options = array();
		foreach ( $division_counts as $division_value => $count ) {
			$options[] = array(
				'value' => $division_value,
				'label' => self::get_video_division_label( $division_value ),
				'count' => $count,
			);
		}

		return $options;
	}

	/**
	 * Category filter options for the video library.
	 *
	 * @param array $category_counts Category counts keyed by slug.
	 * @return array
	 */
	private static function build_video_category_filters( $category_counts ) {
		if ( empty( $category_counts ) ) {
			return array();
		}

		uasort(
			$category_counts,
			function ( $left, $right ) {
				return strcasecmp( $left['label'], $right['label'] );
			}
		);

		$options = array();
		foreach ( $category_counts as $category_value => $category_data ) {
			$options[] = array(
				'value' => $category_value,
				'label' => $category_data['label'],
				'count' => $category_data['count'],
			);
		}

		return $options;
	}

	/**
	 * Human-readable video division label.
	 *
	 * @param string $division Division slug.
	 * @return string
	 */
	private static function get_video_division_label( $division ) {
		$aliases = array(
			'usce'      => 'Clinicals',
			'clinicals' => 'Clinicals',
		);

		if ( ! empty( $aliases[ $division ] ) ) {
			return $aliases[ $division ];
		}

		$definitions = self::get_division_definitions();
		if ( ! empty( $definitions[ $division ]['label'] ) ) {
			return $definitions[ $division ]['label'];
		}

		$division = str_replace( array( '-', '_' ), ' ', (string) $division );
		$division = trim( $division );
		return $division ? ucwords( $division ) : 'MissionMed';
	}

	/**
	 * Human-friendly duration label for video cards.
	 *
	 * @param float $duration_seconds Duration in seconds.
	 * @return string
	 */
	private static function format_video_duration( $duration_seconds ) {
		$seconds = (int) round( (float) $duration_seconds );
		if ( $seconds <= 0 ) {
			return 'Duration unavailable';
		}

		$hours   = (int) floor( $seconds / HOUR_IN_SECONDS );
		$minutes = (int) floor( ( $seconds % HOUR_IN_SECONDS ) / MINUTE_IN_SECONDS );
		$secs    = (int) ( $seconds % MINUTE_IN_SECONDS );

		if ( $hours > 0 ) {
			return $hours . 'h ' . str_pad( (string) $minutes, 2, '0', STR_PAD_LEFT ) . 'm';
		}
		if ( $minutes > 0 ) {
			return $minutes . 'm ' . str_pad( (string) $secs, 2, '0', STR_PAD_LEFT ) . 's';
		}

		return $secs . 's';
	}

	/**
	 * Flatten division list entries into one ranked list.
	 *
	 * @param array  $division_hubs Division hubs.
	 * @param string $key           Entry key.
	 * @param int    $limit         Result count.
	 * @param string $sort_key      Sort key.
	 * @param bool   $desc          Descending sort.
	 * @return array
	 */
	private static function flatten_division_entries( $division_hubs, $key, $limit, $sort_key, $desc = false ) {
		$entries = array();
		foreach ( $division_hubs as $division ) {
			if ( empty( $division[ $key ] ) ) {
				continue;
			}
			foreach ( $division[ $key ] as $entry ) {
				$entries[] = $entry;
			}
		}

		usort(
			$entries,
			function ( $a, $b ) use ( $sort_key, $desc ) {
				$value_a = $a[ $sort_key ] ?? 0;
				$value_b = $b[ $sort_key ] ?? 0;
				if ( $value_a === $value_b ) {
					return 0;
				}
				if ( $desc ) {
					return ( $value_a > $value_b ) ? -1 : 1;
				}

				return ( $value_a < $value_b ) ? -1 : 1;
			}
		);

		return array_slice( $entries, 0, $limit );
	}

	/**
	 * Determine the default active division.
	 *
	 * @param array  $division_hubs Division hubs.
	 * @param string $primary       Primary division.
	 * @param string $program_tier  Program tier.
	 * @return string
	 */
	private static function get_default_division_id( $division_hubs, $primary, $program_tier ) {
		$primary = $primary ?: self::division_from_program_tier( $program_tier );
		if ( ! empty( $division_hubs[ $primary ] ) ) {
			return $primary;
		}

		foreach ( $division_hubs as $division_id => $division ) {
			if ( ! empty( $division['available'] ) ) {
				return $division_id;
			}
		}

		$keys = array_keys( $division_hubs );
		return ! empty( $keys ) ? $keys[0] : 'residency';
	}

	/**
	 * Next actionable task for a given task list.
	 *
	 * @param array $tasks Tasks.
	 * @return array|null
	 */
	private static function get_next_action( $tasks ) {
		foreach ( $tasks as $task ) {
			if ( 'revision_needed' === $task['status'] ) {
				return $task;
			}
		}
		foreach ( $tasks as $task ) {
			if ( 'approved' !== $task['status'] ) {
				return $task;
			}
		}

		return null;
	}

	/**
	 * Determine if all tasks are approved.
	 *
	 * @param array $tasks Tasks.
	 * @return bool
	 */
	private static function all_tasks_approved( $tasks ) {
		if ( empty( $tasks ) ) {
			return false;
		}

		foreach ( $tasks as $task ) {
			if ( 'approved' !== $task['status'] ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Next session from one or more courses.
	 *
	 * @param array $course_ids Course IDs.
	 * @return array|null
	 */
	private static function get_next_session( $course_ids ) {
		if ( empty( $course_ids ) ) {
			return null;
		}

		$now             = time();
		$soonest_session = null;
		$soonest_time    = PHP_INT_MAX;

		foreach ( $course_ids as $course_id ) {
			$sessions_json = get_post_meta( $course_id, '_mmed_next_session', true );
			if ( empty( $sessions_json ) ) {
				continue;
			}

			$sessions = json_decode( $sessions_json, true );
			if ( empty( $sessions ) ) {
				continue;
			}

			if ( isset( $sessions['datetime'] ) ) {
				$sessions = array( $sessions );
			}

			foreach ( $sessions as $session ) {
				if ( ! is_array( $session ) ) {
					continue;
				}

				$timestamp = strtotime( $session['datetime'] ?? '' );
				if ( false === $timestamp || $timestamp < $now ) {
					continue;
				}

				if ( $timestamp < $soonest_time ) {
					$soonest_time    = $timestamp;
					$soonest_session = array(
						'title'        => $session['title'] ?? 'Upcoming Session',
						'datetime'     => $session['datetime'] ?? '',
						'timestamp'    => $timestamp,
						'display_date' => wp_date( 'M d, Y \a\t g:i A', $timestamp ),
						'zoom_link'    => $session['zoom_link'] ?? '',
						'type'         => $session['type'] ?? 'session',
					);
				}
			}
		}

		return $soonest_session;
	}

	/**
	 * Build phases for a program.
	 *
	 * @param string $program_tier Program tier.
	 * @param array  $tasks        Tasks.
	 * @return array
	 */
	public static function get_phases_for_user( $program_tier, $tasks ) {
		if ( empty( $tasks ) ) {
			return array();
		}

		$map = self::$phase_map[ $program_tier ] ?? null;
		if ( ! $map ) {
			$approved = count(
				array_filter(
					$tasks,
					function ( $task ) {
						return 'approved' === $task['status'];
					}
				)
			);
			$total    = count( $tasks );

			return array(
				array(
					'id'           => 'all',
					'name'         => 'All Milestones',
					'short'        => 'Milestones',
					'description'  => 'Track every assigned milestone in this division from one place.',
					'state'        => $total > 0 && $approved === $total ? 'complete' : 'active',
					'progress'     => $total > 0 ? round( ( $approved / $total ) * 100 ) : 0,
					'approved'     => $approved,
					'total'        => $total,
					'task_objects' => $tasks,
				),
			);
		}

		$phases        = array();
		$prev_complete = true;

		foreach ( $map as $phase_def ) {
			$phase_tasks = array_values(
				array_filter(
					$tasks,
					function ( $task ) use ( $phase_def ) {
						return in_array( $task['sort_order'], $phase_def['tasks'], true );
					}
				)
			);

			if ( empty( $phase_tasks ) ) {
				continue;
			}

			$approved    = count(
				array_filter(
					$phase_tasks,
					function ( $task ) {
						return 'approved' === $task['status'];
					}
				)
			);
			$total       = count( $phase_tasks );
			$is_complete = $total > 0 && $approved === $total;

			if ( $is_complete ) {
				$state = 'complete';
			} elseif ( $prev_complete ) {
				$state = 'active';
			} else {
				$state = 'locked';
			}

			$phases[] = array(
				'id'           => $phase_def['id'],
				'name'         => $phase_def['name'],
				'short'        => $phase_def['short'],
				'description'  => $phase_def['description'],
				'state'        => $state,
				'progress'     => $total > 0 ? round( ( $approved / $total ) * 100 ) : 0,
				'approved'     => $approved,
				'total'        => $total,
				'task_objects' => $phase_tasks,
			);

			$prev_complete = $is_complete;
		}

		return $phases;
	}

	/**
	 * Active phase in a phase list.
	 *
	 * @param array $phases Phases.
	 * @return array|null
	 */
	private static function get_active_phase( $phases ) {
		foreach ( $phases as $phase ) {
			if ( 'active' === $phase['state'] ) {
				return $phase;
			}
		}

		return ! empty( $phases ) ? $phases[0] : null;
	}

	/**
	 * Overall task status health.
	 *
	 * @param array $tasks Tasks.
	 * @return array
	 */
	private static function get_status_health( $tasks ) {
		if ( empty( $tasks ) ) {
			return array(
				'key'   => 'green',
				'icon'  => "\xF0\x9F\x9F\xA2",
				'label' => 'On Track',
			);
		}

		$has_overdue  = false;
		$has_revision = false;
		$now          = time();

		foreach ( $tasks as $task ) {
			if ( 'approved' === $task['status'] ) {
				continue;
			}

			if ( 'revision_needed' === $task['status'] ) {
				$has_revision = true;
			}

			if ( ! empty( $task['due_date'] ) && strtotime( $task['due_date'] ) < $now ) {
				$has_overdue = true;
			}
		}

		if ( $has_overdue || $has_revision ) {
			return array(
				'key'   => 'red',
				'icon'  => "\xF0\x9F\x94\xB4",
				'label' => 'Behind',
			);
		}

		foreach ( $tasks as $task ) {
			if ( 'approved' === $task['status'] || empty( $task['due_date'] ) ) {
				continue;
			}

			$days = floor( ( strtotime( $task['due_date'] ) - $now ) / DAY_IN_SECONDS );
			if ( $days <= 3 && $days >= 0 ) {
				return array(
					'key'   => 'yellow',
					'icon'  => "\xF0\x9F\x9F\xA1",
					'label' => 'Needs Attention',
				);
			}
		}

		return array(
			'key'   => 'green',
			'icon'  => "\xF0\x9F\x9F\xA2",
			'label' => 'On Track',
		);
	}

	/**
	 * Task progress summary.
	 *
	 * @param array $tasks Tasks.
	 * @return array
	 */
	private static function get_task_summary( $tasks ) {
		$summary = array(
			'total'           => count( $tasks ),
			'approved'        => 0,
			'open'            => 0,
			'pending_review'  => 0,
			'in_progress'     => 0,
			'not_started'     => 0,
			'revision_needed' => 0,
			'progress_pct'    => 0,
		);

		foreach ( $tasks as $task ) {
			$status = $task['status'];
			if ( isset( $summary[ $status ] ) ) {
				$summary[ $status ]++;
			}
		}

		$summary['open']         = max( 0, $summary['total'] - $summary['approved'] );
		$summary['progress_pct'] = $summary['total'] > 0 ? round( ( $summary['approved'] / $summary['total'] ) * 100 ) : 0;

		return $summary;
	}

	/**
	 * Course progress summary.
	 *
	 * @param array $courses Courses.
	 * @return array
	 */
	private static function get_course_summary( $courses ) {
		$summary = array(
			'count'        => count( $courses ),
			'avg_progress' => 0,
			'in_progress'  => 0,
			'completed'    => 0,
			'not_started'  => 0,
		);

		if ( empty( $courses ) ) {
			return $summary;
		}

		$total_pct = 0;
		foreach ( $courses as $course ) {
			$total_pct += (int) $course['progress_pct'];
			if ( $course['progress_pct'] >= 100 ) {
				$summary['completed']++;
			} elseif ( $course['progress_pct'] > 0 ) {
				$summary['in_progress']++;
			} else {
				$summary['not_started']++;
			}
		}

		$summary['avg_progress'] = round( $total_pct / count( $courses ) );
		return $summary;
	}

	/**
	 * Combined task + course progress.
	 *
	 * @param int  $task_progress  Task progress.
	 * @param int  $course_progress Course progress.
	 * @param bool $has_tasks      Has tasks.
	 * @param bool $has_courses    Has courses.
	 * @return int
	 */
	private static function get_combined_progress( $task_progress, $course_progress, $has_tasks, $has_courses ) {
		if ( $has_tasks && $has_courses ) {
			return (int) round( ( $task_progress + $course_progress ) / 2 );
		}
		if ( $has_tasks ) {
			return (int) $task_progress;
		}
		if ( $has_courses ) {
			return (int) $course_progress;
		}

		return 0;
	}

	/**
	 * Get the next course to resume.
	 *
	 * @param array $courses Courses.
	 * @return array|null
	 */
	private static function get_resume_course( $courses ) {
		foreach ( $courses as $course ) {
			if ( $course['progress_pct'] > 0 && $course['progress_pct'] < 100 ) {
				return $course;
			}
		}
		foreach ( $courses as $course ) {
			if ( 0 === (int) $course['progress_pct'] ) {
				return $course;
			}
		}

		return ! empty( $courses ) ? $courses[0] : null;
	}

	/**
	 * Alerts for a division.
	 *
	 * @param array       $tasks          Tasks.
	 * @param array|null  $next_session   Session.
	 * @param string      $division_label Division label.
	 * @return array
	 */
	private static function get_alerts_for_division( $tasks, $next_session, $division_label ) {
		$alerts = array();
		$now    = time();

		foreach ( $tasks as $task ) {
			$timestamp = ! empty( $task['due_date'] ) ? strtotime( $task['due_date'] ) : ( $task['updated_ts'] ?? $now );

			if ( 'revision_needed' === $task['status'] ) {
				$alerts[] = array(
					'title'          => $task['post_title'],
					'context'        => 'Revision requested by your advisor.',
					'division_label' => $division_label,
					'severity_class' => 'critical',
					'alert_rank'     => 1,
					'timestamp'      => $timestamp,
				);
				continue;
			}

			if ( empty( $task['due_date'] ) || 'approved' === $task['status'] ) {
				continue;
			}

			$days_left = floor( ( $timestamp - $now ) / DAY_IN_SECONDS );
			if ( $days_left < 0 ) {
				$alerts[] = array(
					'title'          => $task['post_title'],
					'context'        => 'Overdue by ' . abs( $days_left ) . ' day' . ( abs( $days_left ) === 1 ? '' : 's' ) . '.',
					'division_label' => $division_label,
					'severity_class' => 'high',
					'alert_rank'     => 2,
					'timestamp'      => $timestamp,
				);
			} elseif ( $days_left <= 5 ) {
				$alerts[] = array(
					'title'          => $task['post_title'],
					'context'        => 0 === $days_left ? 'Due today.' : 'Due in ' . $days_left . ' day' . ( 1 === $days_left ? '' : 's' ) . '.',
					'division_label' => $division_label,
					'severity_class' => 'medium',
					'alert_rank'     => 3,
					'timestamp'      => $timestamp,
				);
			}
		}

		if ( ! empty( $next_session['timestamp'] ) ) {
			$days_until_session = floor( ( $next_session['timestamp'] - $now ) / DAY_IN_SECONDS );
			if ( $days_until_session >= 0 && $days_until_session <= 3 ) {
				$alerts[] = array(
					'title'          => $next_session['title'],
					'context'        => 0 === $days_until_session ? 'Session starts today.' : 'Session is in ' . $days_until_session . ' day' . ( 1 === $days_until_session ? '' : 's' ) . '.',
					'division_label' => $division_label,
					'severity_class' => 'low',
					'alert_rank'     => 4,
					'timestamp'      => $next_session['timestamp'],
				);
			}
		}

		usort(
			$alerts,
			function ( $a, $b ) {
				if ( $a['alert_rank'] === $b['alert_rank'] ) {
					return $a['timestamp'] <=> $b['timestamp'];
				}
				return $a['alert_rank'] <=> $b['alert_rank'];
			}
		);

		return array_slice( $alerts, 0, 4 );
	}

	/**
	 * Recent activity feed for a division.
	 *
	 * @param array      $tasks          Tasks.
	 * @param array|null $next_session   Session.
	 * @param string     $division_label Division label.
	 * @return array
	 */
	private static function get_recent_activity_for_division( $tasks, $next_session, $division_label ) {
		$activity = array();

		foreach ( $tasks as $task ) {
			if ( 'not_started' === $task['status'] && empty( $task['file_url'] ) ) {
				continue;
			}

			$activity[] = array(
				'title'          => $task['post_title'],
				'context'        => self::activity_copy_for_task( $task ),
				'division_label' => $division_label,
				'timestamp'      => (int) ( $task['updated_ts'] ?? time() ),
			);
		}

		if ( ! empty( $next_session['timestamp'] ) ) {
			$activity[] = array(
				'title'          => $next_session['title'],
				'context'        => 'Upcoming ' . str_replace( '_', ' ', $next_session['type'] ?? 'session' ) . ' is scheduled.',
				'division_label' => $division_label,
				'timestamp'      => (int) $next_session['timestamp'],
			);
		}

		usort(
			$activity,
			function ( $a, $b ) {
				return $b['timestamp'] <=> $a['timestamp'];
			}
		);

		return array_slice( $activity, 0, 4 );
	}

	/**
	 * Tool links for a division.
	 *
	 * @param string     $division_id    Division ID.
	 * @param string     $label          Division label.
	 * @param string     $support_email  Support email.
	 * @param string     $account_url    Account URL.
	 * @param string     $booking_url    Booking URL.
	 * @param array|null $resume_course  Resume course.
	 * @return array
	 */
	private static function get_division_tools( $division_id, $label, $support_email, $account_url, $booking_url, $resume_course ) {
		$course_url = ! empty( $resume_course['url'] ) ? $resume_course['url'] : '#courses';

		return array(
			array(
				'label'    => 'Open Course',
				'meta'     => 'Jump into ' . $label . ' content.',
				'url'      => $course_url,
				'external' => false,
			),
			array(
				'label'    => 'View Milestones',
				'meta'     => 'Open advisor tasks for this division.',
				'url'      => '#tasks',
				'external' => false,
			),
			array(
				'label'    => 'Book Session',
				'meta'     => 'Reserve advisor time in Calendly.',
				'url'      => $booking_url,
				'external' => true,
			),
			array(
				'label'    => 'Email Support',
				'meta'     => $support_email,
				'url'      => 'mailto:' . $support_email,
				'external' => false,
			),
			array(
				'label'    => 'Documents',
				'meta'     => 'Review submitted files.',
				'url'      => '#documents',
				'external' => false,
			),
			array(
				'label'    => 'Account Settings',
				'meta'     => 'Open profile and account access.',
				'url'      => $account_url,
				'external' => false,
			),
		);
	}

	/**
	 * Build account URL with WooCommerce fallback.
	 *
	 * @param int $user_id User ID.
	 * @return string
	 */
	private static function get_account_url( $user_id ) {
		if ( function_exists( 'wc_get_page_permalink' ) ) {
			$my_account = wc_get_page_permalink( 'myaccount' );
			if ( ! empty( $my_account ) ) {
				return $my_account;
			}
		}

		return get_edit_profile_url( $user_id );
	}

	/**
	 * Option ID helper.
	 *
	 * @param array $keys Option keys.
	 * @return array
	 */
	private static function get_option_ids( $keys ) {
		$ids = array();
		foreach ( $keys as $key ) {
			$value = absint( get_option( $key, mmed_hub_default_option_value( $key ) ) );
			if ( $value > 0 ) {
				$ids[] = $value;
			}
		}

		return array_values( array_unique( $ids ) );
	}

	/**
	 * Support email for a division.
	 *
	 * @param array $definition Division definition.
	 * @return string
	 */
	private static function get_division_support_email( $definition ) {
		$email = get_option( $definition['support_email_option'], '' );
		return $email ?: $definition['fallback_support'];
	}

	/**
	 * User LearnDash groups.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	private static function get_user_group_ids( $user_id ) {
		if ( function_exists( 'learndash_get_users_group_ids' ) ) {
			return array_map( 'absint', (array) learndash_get_users_group_ids( $user_id ) );
		}

		return array();
	}

	/**
	 * Does a division have group access.
	 *
	 * @param array $definition Division definition.
	 * @param array $user_groups User groups.
	 * @return bool
	 */
	private static function division_has_group_access( $definition, $user_groups ) {
		$mapped_groups = self::get_option_ids( $definition['group_option_keys'] );
		foreach ( $mapped_groups as $group_id ) {
			if ( in_array( $group_id, $user_groups, true ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Match a task to a division.
	 *
	 * @param array  $task        Task.
	 * @param string $division_id Division ID.
	 * @param array  $definition  Division definition.
	 * @return bool
	 */
	private static function task_matches_division( $task, $division_id, $definition ) {
		if ( in_array( $task['division'], $definition['task_divisions'], true ) ) {
			return true;
		}
		if ( in_array( $task['program_tier'], $definition['task_tiers'], true ) ) {
			return true;
		}
		return $division_id === self::division_from_program_tier( $task['program_tier'] );
	}

	/**
	 * Phase tier to use for a division.
	 *
	 * @param string $division_id Division ID.
	 * @param array  $tasks       Tasks.
	 * @param string $program_tier Program tier.
	 * @return string
	 */
	private static function get_division_phase_tier( $division_id, $tasks, $program_tier ) {
		foreach ( $tasks as $task ) {
			if ( ! empty( $task['program_tier'] ) ) {
				return $task['program_tier'];
			}
		}

		if ( 'residency' === $division_id ) {
			return '360elite';
		}
		if ( 'clinicals' === $division_id ) {
			return 'usce_onboarding';
		}

		return $program_tier;
	}

	/**
	 * Determine division from stored program tier.
	 *
	 * @param string $program_tier Program tier.
	 * @return string
	 */
	private static function division_from_program_tier( $program_tier ) {
		$map = array(
			'360elite'            => 'residency',
			'360elite_onboarding' => 'residency',
			'interview_prep_complete'   => 'residency',
			'interview_prep_foundation' => 'residency',
			'usmle_prep'          => 'usmle',
			'usmle_exam_prep'     => 'usmle',
			'usce_onboarding'     => 'clinicals',
		);

		return $map[ $program_tier ] ?? '';
	}

	/**
	 * Format due dates for UI.
	 *
	 * @param string $due_date Due date.
	 * @return string
	 */
	private static function format_due_label( $due_date ) {
		if ( empty( $due_date ) ) {
			return '';
		}

		$timestamp = strtotime( $due_date );
		if ( ! $timestamp ) {
			return '';
		}

		$days_left = floor( ( $timestamp - time() ) / DAY_IN_SECONDS );
		$base      = wp_date( 'M d, Y', $timestamp );

		if ( $days_left < 0 ) {
			return $base . ' — overdue by ' . abs( $days_left ) . ' day' . ( abs( $days_left ) === 1 ? '' : 's' );
		}
		if ( 0 === $days_left ) {
			return $base . ' — due today';
		}
		if ( $days_left <= 5 ) {
			return $base . ' — due in ' . $days_left . ' day' . ( 1 === $days_left ? '' : 's' );
		}

		return $base;
	}

	/**
	 * Copy used in task expansion.
	 *
	 * @param array $task Task.
	 * @return string
	 */
	private static function task_next_step_copy( $task ) {
		if ( 'approved' === $task['status'] ) {
			return 'Your advisor approved this milestone. You are clear to move forward.';
		}
		if ( 'pending_review' === $task['status'] ) {
			return 'Your submission is currently with the advisory team. Feedback usually returns within 1 to 2 business days.';
		}
		if ( 'revision_needed' === $task['status'] ) {
			return 'Review the advisor notes above, make the requested changes, and resubmit when ready.';
		}
		if ( $task['requires_file'] ) {
			return 'Upload the requested file to move this milestone into advisor review.';
		}
		return 'Complete this step to unlock the next move in your program journey.';
	}

	/**
	 * CTA label for a task.
	 *
	 * @param array $task Task.
	 * @return string
	 */
	private static function task_cta_label( $task ) {
		if ( 'revision_needed' === $task['status'] ) {
			return 'Review Feedback & Resubmit';
		}
		if ( $task['requires_file'] && 'not_started' === $task['status'] ) {
			return 'Upload & Submit';
		}
		if ( 'in_progress' === $task['status'] ) {
			return 'Continue This Milestone';
		}
		return 'Open Milestone';
	}

	/**
	 * Human-readable activity line for a task.
	 *
	 * @param array $task Task.
	 * @return string
	 */
	private static function activity_copy_for_task( $task ) {
		switch ( $task['status'] ) {
			case 'approved':
				return 'Approved by your advisor.';
			case 'pending_review':
				return 'Submission is under review.';
			case 'revision_needed':
				return 'Feedback is waiting for revision.';
			case 'in_progress':
				return 'Work has started on this milestone.';
			default:
				return ! empty( $task['file_url'] ) ? 'A file was submitted for this milestone.' : 'Milestone updated.';
		}
	}
}
