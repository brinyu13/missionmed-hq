<?php
/**
 * LearnDash Matrix visual reskin controller.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load Matrix-aligned styling on LearnDash student pages.
 */
class MMED_LearnDash_Reskin {

	/**
	 * Cached page detection result.
	 *
	 * @var bool|null
	 */
	private static $is_learndash_page = null;

	/**
	 * 360 Match Mentorship LearnDash course ID.
	 *
	 * @var int
	 */
	private static $phase0_course_id = 3893;

	/**
	 * Launch-available course steps for Phase 0.
	 *
	 * @var int[]
	 */
	private static $phase0_step_ids = array( 6183, 6184, 6185, 6186 );

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 999 );
		add_filter( 'body_class', array( __CLASS__, 'add_phase0_body_class' ) );
		add_filter( 'the_content', array( __CLASS__, 'inject_phase0_course_entry' ), 12 );
		add_action( 'wp_footer', array( __CLASS__, 'render_phase0_entry_mount' ), 18 );
		add_action( 'wp_footer', array( __CLASS__, 'render_back_to_matrix_button' ), 20 );
		add_action( 'wp_footer', array( __CLASS__, 'render_match_training_label_normalizer' ), 40 );
	}

	/**
	 * Enqueue the LearnDash reskin assets after LearnDash and theme styles.
	 *
	 * @return void
	 */
	public static function enqueue_assets() {
		if ( ! self::is_learndash_page() ) {
			return;
		}

		$css_path = MMED_HUB_PATH . 'assets/learndash-reskin.css';
		$deps     = self::get_learndash_style_dependencies();

		wp_enqueue_style(
			'mmed-learndash-fonts',
			'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap',
			array(),
			null
		);

		$deps[] = 'mmed-learndash-fonts';

		wp_enqueue_style(
			'mmed-learndash-reskin',
			MMED_HUB_URL . 'assets/learndash-reskin.css',
			array_values( array_unique( $deps ) ),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : MMED_HUB_VERSION
		);
	}

	/**
	 * Print the persistent return link on LearnDash pages.
	 *
	 * @return void
	 */
	public static function render_back_to_matrix_button() {
		if ( ! self::is_learndash_page() ) {
			return;
		}

		printf(
			'<a href="%1$s" class="mmed-back-to-matrix" title="%2$s"><span class="mmed-btm-arrow" aria-hidden="true">&#8592;</span> %3$s</a>',
			esc_url( home_url( '/member-dashboard/#courses' ) ),
			esc_attr__( 'Return to your student dashboard', 'missionmed-hub' ),
			esc_html__( 'Back to Dashboard', 'missionmed-hub' )
		);
	}

	/**
	 * Add a scoped body class for the 360 launch experience.
	 *
	 * @param array $classes Body classes.
	 * @return array
	 */
	public static function add_phase0_body_class( $classes ) {
		if ( self::is_360_context() ) {
			$classes[] = 'mmed-ld-360-phase0';
		}

		if ( self::is_360_course_page() && isset( $_GET['mmed_phase0'] ) && 'locked' === sanitize_key( wp_unslash( $_GET['mmed_phase0'] ) ) ) {
			$classes[] = 'mmed-ld-360-locked-return';
		}

		return $classes;
	}

	/**
	 * Legacy launch redirect hook retained as a no-op for open-path Launch Phase.
	 *
	 * @return void
	 */
	public static function maybe_redirect_locked_phase0_step() {
		return;
	}

	/**
	 * Inject the premium Phase 0 entry experience on the course landing page.
	 *
	 * @param string $content Post content.
	 * @return string
	 */
	public static function inject_phase0_course_entry( $content ) {
		static $printed = false;

		if ( $printed || ! is_user_logged_in() || ! self::is_360_course_page() || ! self::current_user_can_view_phase0_entry() || ! in_the_loop() || ! is_main_query() ) {
			return $content;
		}

		$printed = true;
		return self::phase0_entry_markup() . $content;
	}

	/**
	 * Footer fallback for LearnDash layouts that do not pass through the
	 * standard content filter at the visible course-entry position.
	 *
	 * @return void
	 */
	public static function render_phase0_entry_mount() {
		if ( ! is_user_logged_in() || ! self::is_360_course_page() || ! self::current_user_can_view_phase0_entry() ) {
			return;
		}
		?>
		<div id="mmed-ld-phase0-entry-source" hidden><?php echo self::phase0_entry_markup(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></div>
		<script>
		(function () {
			var existing = document.getElementById("mmed-360-phase0-entry");
			var source = document.getElementById("mmed-ld-phase0-entry-source");
			var target = document.querySelector(".learndash-wrapper") || document.querySelector(".entry-content") || document.querySelector("main");
			function normalizeMatchTrainingLabels() {
				document.querySelectorAll('a[href*="/member-dashboard/#courses"]').forEach(function (link) {
					if (/My Match Path/i.test(link.textContent || "")) {
						link.textContent = (link.textContent || "").replace(/My Match Path/gi, "My Match Training");
					}
					if (/My Match Path/i.test(link.getAttribute("aria-label") || "")) {
						link.setAttribute("aria-label", (link.getAttribute("aria-label") || "").replace(/My Match Path/gi, "My Match Training"));
					}
					if (/My Match Path/i.test(link.getAttribute("title") || "")) {
						link.setAttribute("title", (link.getAttribute("title") || "").replace(/My Match Path/gi, "My Match Training"));
					}
				});
			}
			normalizeMatchTrainingLabels();
			window.setTimeout(normalizeMatchTrainingLabels, 300);
			window.setTimeout(normalizeMatchTrainingLabels, 1200);
			if (existing || !source || !target || !source.firstElementChild) {
				if (source) {
					source.remove();
				}
				return;
			}
			target.parentNode.insertBefore(source.firstElementChild, target);
			source.remove();
		})();
		</script>
		<?php
	}

	/**
	 * Legacy course-outline gate retained as a no-op for open-path Launch Phase.
	 *
	 * @return void
	 */
	public static function render_phase0_lock_script() {
		return;
	}

	/**
	 * Normalize legacy course-return labels without renaming dashboard routes.
	 *
	 * @return void
	 */
	public static function render_match_training_label_normalizer() {
		if ( ! is_user_logged_in() || ! self::is_360_context() ) {
			return;
		}
		?>
		<script>
		(function () {
			function normalizeMatchTrainingLabels() {
				document.querySelectorAll('a[href*="/member-dashboard/#courses"]').forEach(function (link) {
					if (/My Match Path/i.test(link.textContent || "")) {
						link.textContent = (link.textContent || "").replace(/My Match Path/gi, "My Match Training");
					}
					if (/My Match Path/i.test(link.getAttribute("aria-label") || "")) {
						link.setAttribute("aria-label", (link.getAttribute("aria-label") || "").replace(/My Match Path/gi, "My Match Training"));
					}
					if (/My Match Path/i.test(link.getAttribute("title") || "")) {
						link.setAttribute("title", (link.getAttribute("title") || "").replace(/My Match Path/gi, "My Match Training"));
					}
				});
			}
			normalizeMatchTrainingLabels();
			window.setTimeout(normalizeMatchTrainingLabels, 300);
			window.setTimeout(normalizeMatchTrainingLabels, 1200);
		})();
		</script>
		<?php
	}

	/**
	 * Return the Phase 0 course entry markup.
	 *
	 * @return string
	 */
	private static function phase0_entry_markup() {
		$locked_return = isset( $_GET['mmed_phase0'] ) && 'locked' === sanitize_key( wp_unslash( $_GET['mmed_phase0'] ) );
		$dashboard_url = home_url( '/member-dashboard/' );
		$profile_url   = home_url( '/member-dashboard/#profile' );
		$calendar_url  = home_url( '/member-dashboard/#calendar' );
		$scheduler_url = home_url( '/member-dashboard/#scheduler' );

		ob_start();
		?>
			<section class="mmed-ld-phase0-entry" id="mmed-360-phase0-entry" aria-label="<?php esc_attr_e( '360 Match Mentorship Launch Phase entry', 'missionmed-hub' ); ?>">
				<header class="mmed-ld-phase0-main">
					<div class="mmed-ld-phase0-intro">
							<div class="mmed-ld-phase0-kicker">
								<span><?php esc_html_e( 'Launch Phase', 'missionmed-hub' ); ?></span>
								<span><?php esc_html_e( 'Start Anywhere', 'missionmed-hub' ); ?></span>
								<span><?php esc_html_e( 'Guided Start', 'missionmed-hub' ); ?></span>
							</div>
							<h1><?php esc_html_e( 'Launch Phase', 'missionmed-hub' ); ?></h1>
							<p class="mmed-ld-phase0-lede"><?php esc_html_e( 'You’re in the right place. Start with any step below. Nothing has to be done in order, and you are not behind.', 'missionmed-hub' ); ?></p>
							<?php if ( $locked_return ) : ?>
								<div class="mmed-ld-phase0-notice"><?php esc_html_e( 'You can start anywhere. Pick any step below and continue from there.', 'missionmed-hub' ); ?></div>
							<?php endif; ?>
						</div>
					</header>
					<section class="mmed-ld-launch-board" aria-label="<?php esc_attr_e( 'Launch Phase plan', 'missionmed-hub' ); ?>" data-mmed-launch-tracker>
						<div class="mmed-ld-launch-board-top">
							<div class="mmed-ld-launch-board-title"><?php esc_html_e( 'Launch', 'missionmed-hub' ); ?> <span><?php esc_html_e( 'Plan', 'missionmed-hub' ); ?></span></div>
							<div class="mmed-ld-launch-board-copy"><?php esc_html_e( 'Pick the step that feels most helpful right now. We’ll keep guiding you from there.', 'missionmed-hub' ); ?></div>
						</div>
						<div class="mmed-ld-tracker-window">
							<div class="mmed-ld-bar-labels" aria-hidden="true">
								<span><?php esc_html_e( 'Complete Your Profile', 'missionmed-hub' ); ?></span>
								<span><?php esc_html_e( 'Review Your Season Plan', 'missionmed-hub' ); ?></span>
								<span><?php esc_html_e( 'Book Your First Meeting', 'missionmed-hub' ); ?></span>
								<span><?php esc_html_e( 'Create Your Identity', 'missionmed-hub' ); ?></span>
								<span><?php esc_html_e( 'Join Launch Orientation', 'missionmed-hub' ); ?></span>
							</div>
							<ol class="mmed-ld-launch-tracker" aria-label="<?php esc_attr_e( 'Launch Phase sections', 'missionmed-hub' ); ?>">
								<li class="mmed-ld-segment active" data-label="<?php esc_attr_e( 'Complete Your Profile', 'missionmed-hub' ); ?>"><button type="button" class="mmed-ld-segment-button" data-mmed-launch-step="profile" data-status-main="<?php esc_attr_e( 'Complete Your Profile', 'missionmed-hub' ); ?>" data-status-sub="<?php esc_attr_e( 'Share where you’re starting', 'missionmed-hub' ); ?>" aria-controls="mmed-ld-step-profile" aria-pressed="true"><span aria-hidden="true">1</span><span class="mmed-ld-sr-only"><?php esc_html_e( 'Complete Your Profile', 'missionmed-hub' ); ?></span></button></li>
								<li class="mmed-ld-segment waiting" data-label="<?php esc_attr_e( 'Review Your Season Plan', 'missionmed-hub' ); ?>"><button type="button" class="mmed-ld-segment-button" data-mmed-launch-step="calendar" data-status-main="<?php esc_attr_e( 'Review Your Season Plan', 'missionmed-hub' ); ?>" data-status-sub="<?php esc_attr_e( 'See what’s coming up', 'missionmed-hub' ); ?>" aria-controls="mmed-ld-step-calendar" aria-pressed="false"><span aria-hidden="true">2</span><span class="mmed-ld-sr-only"><?php esc_html_e( 'Review Your Season Plan', 'missionmed-hub' ); ?></span></button></li>
								<li class="mmed-ld-segment waiting" data-label="<?php esc_attr_e( 'Book Your First Meeting', 'missionmed-hub' ); ?>"><button type="button" class="mmed-ld-segment-button" data-mmed-launch-step="meeting" data-status-main="<?php esc_attr_e( 'Book Your First Meeting', 'missionmed-hub' ); ?>" data-status-sub="<?php esc_attr_e( 'Choose a time to meet', 'missionmed-hub' ); ?>" aria-controls="mmed-ld-step-meeting" aria-pressed="false"><span aria-hidden="true">3</span><span class="mmed-ld-sr-only"><?php esc_html_e( 'Book Your First Meeting', 'missionmed-hub' ); ?></span></button></li>
								<li class="mmed-ld-segment waiting" data-label="<?php esc_attr_e( 'Create Your Identity', 'missionmed-hub' ); ?>"><button type="button" class="mmed-ld-segment-button" data-mmed-launch-step="avatar" data-status-main="<?php esc_attr_e( 'Create Your Identity', 'missionmed-hub' ); ?>" data-status-sub="<?php esc_attr_e( 'Choose how you’ll show up', 'missionmed-hub' ); ?>" aria-controls="mmed-ld-step-avatar" aria-pressed="false"><span aria-hidden="true">4</span><span class="mmed-ld-sr-only"><?php esc_html_e( 'Create Your Identity', 'missionmed-hub' ); ?></span></button></li>
								<li class="mmed-ld-segment waiting" data-label="<?php esc_attr_e( 'Join Launch Orientation', 'missionmed-hub' ); ?>"><button type="button" class="mmed-ld-segment-button" data-mmed-launch-step="orientation" data-status-main="<?php esc_attr_e( 'Join Launch Orientation', 'missionmed-hub' ); ?>" data-status-sub="<?php esc_attr_e( 'Your live session is coming soon', 'missionmed-hub' ); ?>" aria-controls="mmed-ld-step-orientation" aria-pressed="false"><span aria-hidden="true">5</span><span class="mmed-ld-sr-only"><?php esc_html_e( 'Join Launch Orientation', 'missionmed-hub' ); ?></span></button></li>
							</ol>
							<div class="mmed-ld-status-strip"><strong data-mmed-launch-status-main><?php esc_html_e( 'Complete Your Profile', 'missionmed-hub' ); ?></strong> - <span data-mmed-launch-status-sub><?php esc_html_e( 'Share where you’re starting', 'missionmed-hub' ); ?></span></div>
							<div class="mmed-ld-step-panel">
								<article class="mmed-ld-step-detail is-active" id="mmed-ld-step-profile" data-mmed-launch-panel="profile" tabindex="-1">
									<span><?php esc_html_e( 'Complete Your Profile', 'missionmed-hub' ); ?></span>
									<h2><?php esc_html_e( 'Share where you’re starting.', 'missionmed-hub' ); ?></h2>
									<p><?php esc_html_e( 'Share the essentials your advising team needs so we can guide you with the right context from day one.', 'missionmed-hub' ); ?></p>
									<div class="mmed-ld-step-actions"><a class="mmed-ld-phase0-primary" href="<?php echo esc_url( $profile_url ); ?>"><?php esc_html_e( 'Complete My Profile', 'missionmed-hub' ); ?></a><a class="mmed-ld-phase0-secondary" href="<?php echo esc_url( $dashboard_url ); ?>"><?php esc_html_e( 'Continue To My Dashboard', 'missionmed-hub' ); ?></a></div>
								</article>
								<article class="mmed-ld-step-detail" id="mmed-ld-step-calendar" data-mmed-launch-panel="calendar" tabindex="-1">
									<span><?php esc_html_e( 'Review Your Season Plan', 'missionmed-hub' ); ?></span>
									<h2><?php esc_html_e( 'See what’s coming up.', 'missionmed-hub' ); ?></h2>
									<p><?php esc_html_e( 'Review the key dates, live sessions, and next steps ahead so the path feels clear.', 'missionmed-hub' ); ?></p>
									<div class="mmed-ld-step-actions"><a class="mmed-ld-phase0-primary" href="<?php echo esc_url( $calendar_url ); ?>"><?php esc_html_e( 'Review My Season Plan', 'missionmed-hub' ); ?></a><a class="mmed-ld-phase0-secondary" href="<?php echo esc_url( $dashboard_url ); ?>"><?php esc_html_e( 'Continue To My Dashboard', 'missionmed-hub' ); ?></a></div>
								</article>
								<article class="mmed-ld-step-detail" id="mmed-ld-step-meeting" data-mmed-launch-panel="meeting" tabindex="-1">
									<span><?php esc_html_e( 'Book Your First Meeting', 'missionmed-hub' ); ?></span>
									<h2><?php esc_html_e( 'Book your first meeting.', 'missionmed-hub' ); ?></h2>
									<p><?php esc_html_e( 'Choose a time for your first conversation so you know exactly when you’ll meet with your mentor.', 'missionmed-hub' ); ?></p>
									<div class="mmed-ld-step-actions"><a class="mmed-ld-phase0-primary" href="<?php echo esc_url( $scheduler_url ); ?>"><?php esc_html_e( 'Book My First Meeting', 'missionmed-hub' ); ?></a><a class="mmed-ld-phase0-secondary" href="<?php echo esc_url( $dashboard_url ); ?>"><?php esc_html_e( 'Continue To My Dashboard', 'missionmed-hub' ); ?></a></div>
								</article>
								<article class="mmed-ld-step-detail" id="mmed-ld-step-avatar" data-mmed-launch-panel="avatar" tabindex="-1">
									<span><?php esc_html_e( 'Create Your Identity', 'missionmed-hub' ); ?></span>
									<h2><?php esc_html_e( 'Choose how you’ll show up.', 'missionmed-hub' ); ?></h2>
									<p><?php esc_html_e( 'Create your student identity for the spaces where MissionMed recognizes you across the experience.', 'missionmed-hub' ); ?></p>
									<div class="mmed-ld-step-actions"><a class="mmed-ld-phase0-primary" href="<?php echo esc_url( $profile_url ); ?>"><?php esc_html_e( 'Create My Identity', 'missionmed-hub' ); ?></a><a class="mmed-ld-phase0-secondary" href="<?php echo esc_url( $dashboard_url ); ?>"><?php esc_html_e( 'Continue To My Dashboard', 'missionmed-hub' ); ?></a></div>
								</article>
								<article class="mmed-ld-step-detail" id="mmed-ld-step-orientation" data-mmed-launch-panel="orientation" tabindex="-1">
									<span><?php esc_html_e( 'Join Launch Orientation', 'missionmed-hub' ); ?></span>
									<h2><?php esc_html_e( 'Your live launch session is coming soon.', 'missionmed-hub' ); ?></h2>
									<p><?php esc_html_e( 'There is no video to complete right now. We’ll guide this live. For today, focus on the other steps and continue when you’re ready.', 'missionmed-hub' ); ?></p>
									<div class="mmed-ld-step-actions"><a class="mmed-ld-phase0-primary" href="<?php echo esc_url( $dashboard_url ); ?>"><?php esc_html_e( 'Continue To My Dashboard', 'missionmed-hub' ); ?></a></div>
								</article>
							</div>
						</div>
					</section>
					<script>
					(function () {
						var root = document.getElementById("mmed-360-phase0-entry");
						if (!root || root.getAttribute("data-mmed-launch-ready") === "1") {
							return;
						}
						root.setAttribute("data-mmed-launch-ready", "1");
						var buttons = Array.prototype.slice.call(root.querySelectorAll("[data-mmed-launch-step]"));
						var panels = Array.prototype.slice.call(root.querySelectorAll("[data-mmed-launch-panel]"));
						var statusMain = root.querySelector("[data-mmed-launch-status-main]");
						var statusSub = root.querySelector("[data-mmed-launch-status-sub]");
						function activate(step, selectedButton) {
							buttons.forEach(function (button) {
								var isActive = button.getAttribute("data-mmed-launch-step") === step;
								var item = button.closest(".mmed-ld-segment");
								button.setAttribute("aria-pressed", isActive ? "true" : "false");
								if (item) {
									item.classList.toggle("active", isActive);
									item.classList.toggle("waiting", !isActive);
								}
							});
							panels.forEach(function (panel) {
								panel.classList.toggle("is-active", panel.getAttribute("data-mmed-launch-panel") === step);
							});
							if (selectedButton && statusMain) {
								statusMain.textContent = selectedButton.getAttribute("data-status-main") || "";
							}
							if (selectedButton && statusSub) {
								statusSub.textContent = selectedButton.getAttribute("data-status-sub") || "";
							}
							root.setAttribute("data-mmed-launch-step", step);
						}
						buttons.forEach(function (button) {
							button.addEventListener("click", function () {
								activate(button.getAttribute("data-mmed-launch-step"), button);
							});
						});
					})();
					</script>
				</section>
		<?php
		return ob_get_clean();
	}

	/**
	 * Determine whether the current request is the 360 course landing page.
	 *
	 * @return bool
	 */
	private static function is_360_course_page() {
		return is_singular( 'sfwd-courses' ) && absint( get_queried_object_id() ) === self::$phase0_course_id;
	}

	/**
	 * Determine whether the current LearnDash singular belongs to course 3893.
	 *
	 * @return bool
	 */
	private static function is_360_context() {
		return self::$phase0_course_id === self::get_current_course_id();
	}

	/**
	 * Resolve the current LearnDash course ID without changing access state.
	 *
	 * @return int
	 */
	private static function get_current_course_id() {
		$post_id = absint( get_queried_object_id() );
		if ( ! $post_id ) {
			return 0;
		}

		if ( 'sfwd-courses' === get_post_type( $post_id ) ) {
			return $post_id;
		}

		if ( function_exists( 'learndash_get_course_id' ) ) {
			return absint( learndash_get_course_id( $post_id ) );
		}

		return absint( get_post_meta( $post_id, 'course_id', true ) );
	}

	/**
	 * Check whether a step is launch-available during Phase 0.
	 *
	 * @param int $post_id Current step post ID.
	 * @return bool
	 */
	private static function is_phase0_available_step( $post_id ) {
		$post_id = absint( $post_id );
		if ( in_array( $post_id, self::$phase0_step_ids, true ) ) {
			return true;
		}

		$lesson_id = 0;
		if ( function_exists( 'learndash_get_lesson_id' ) ) {
			$lesson_id = absint( learndash_get_lesson_id( $post_id, self::$phase0_course_id ) );
		}

		return $lesson_id && in_array( $lesson_id, self::$phase0_step_ids, true );
	}

	/**
	 * Determine whether the current user should see the Phase 0 entry.
	 *
	 * @return bool
	 */
	private static function current_user_can_view_phase0_entry() {
		if ( current_user_can( 'manage_options' ) || current_user_can( 'edit_post', self::$phase0_course_id ) ) {
			return true;
		}

		return self::current_user_is_enrolled_in_phase0_course();
	}

	/**
	 * Check current user's LearnDash enrollment for course 3893.
	 *
	 * @return bool
	 */
	private static function current_user_is_enrolled_in_phase0_course() {
		if ( ! function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			return false;
		}

		$course_ids = learndash_user_get_enrolled_courses( get_current_user_id() );
		return is_array( $course_ids ) && in_array( self::$phase0_course_id, array_map( 'absint', $course_ids ), true );
	}

	/**
	 * Detect supported LearnDash page types for logged-in users.
	 *
	 * @return bool
	 */
	private static function is_learndash_page() {
		if ( null !== self::$is_learndash_page ) {
			return self::$is_learndash_page;
		}

		if ( ! is_user_logged_in() ) {
			self::$is_learndash_page = false;
			return self::$is_learndash_page;
		}

		$post_types = array(
			'sfwd-courses',
			'sfwd-lessons',
			'sfwd-topic',
			'sfwd-quiz',
		);

		if ( is_singular( $post_types ) ) {
			self::$is_learndash_page = self::is_360_context();
			return self::$is_learndash_page;
		}

		$post_type = get_post_type();
		self::$is_learndash_page = in_array( $post_type, $post_types, true ) && self::is_360_context();

		return self::$is_learndash_page;
	}

	/**
	 * Return only registered LearnDash/Astra style handles so the reskin never
	 * depends on a missing handle.
	 *
	 * @return array
	 */
	private static function get_learndash_style_dependencies() {
		global $wp_styles;

		if ( ! $wp_styles || empty( $wp_styles->registered ) ) {
			return array();
		}

		$candidates = array(
			'learndash-front',
			'learndash-front-css',
			'learndash_style',
			'learndash',
			'learndash_quiz_front_css',
			'learndash-quiz-front-css',
			'sfwd_front_css',
			'astra-learndash',
			'astra-theme-css',
			'learndash-propanel-reports',
		);

		$deps = array();

		foreach ( $candidates as $handle ) {
			if ( isset( $wp_styles->registered[ $handle ] ) ) {
				$deps[] = $handle;
			}
		}

		return $deps;
	}
}
