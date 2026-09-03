<?php
/**
 * Admin tooling for MissionMed course-specific welcome emails.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMED_Welcome_Email_Admin {

	const PAGE_SLUG           = 'mmed-welcome-emails';
	const OPTION_AUTO_ENABLED = 'mmed_welcome_email_auto_enabled';
	const OPTION_AUTO_COURSES = 'mmed_welcome_email_auto_courses';
	const NOTICE_TRANSIENT    = 'mmed_welcome_email_notice_';
	const META_SENT_PREFIX    = '_mmed_welcome_email_sent_at_';
	const META_SENT_BY_PREFIX = '_mmed_welcome_email_sent_by_';
	const META_SUBJECT_PREFIX = '_mmed_welcome_email_subject_';
	const META_SOURCE_PREFIX  = '_mmed_welcome_email_source_';

	/**
	 * Plain-text body used as PHPMailer AltBody for the current send.
	 *
	 * @var string
	 */
	private static $current_alt_body = '';

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ), 30 );
		add_action( 'admin_post_mmed_welcome_email_send', array( __CLASS__, 'handle_send' ) );
		add_action( 'admin_post_mmed_welcome_email_save_settings', array( __CLASS__, 'handle_save_settings' ) );
		add_action( 'learndash_update_course_access', array( __CLASS__, 'maybe_auto_send_from_learndash' ), 30, 4 );
		add_action( 'woocommerce_order_status_completed', array( __CLASS__, 'maybe_auto_send_from_order' ), 50, 1 );
		add_action( 'woocommerce_order_status_processing', array( __CLASS__, 'maybe_auto_send_from_order' ), 50, 1 );
	}

	/**
	 * Register the admin page under MissionMed Hub.
	 *
	 * @return void
	 */
	public static function register_menu() {
		add_submenu_page(
			'missionmed-hub',
			'MissionMed Welcome Emails',
			'Welcome Emails',
			'manage_options',
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' )
		);

		add_submenu_page(
			'mmed-admin-matrix',
			'MissionMed Welcome Emails',
			'Welcome Emails',
			'manage_options',
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' )
		);
	}

	/**
	 * Admin page renderer.
	 *
	 * @return void
	 */
	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage MissionMed welcome emails.', 'missionmed-hub' ) );
		}

		$configs     = self::course_configs();
		$course_slug = isset( $_GET['course'] ) ? sanitize_key( wp_unslash( $_GET['course'] ) ) : '360elite'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$status      = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( $_GET['status'] ) ) : 'unsent'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$search      = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$config      = self::get_course_config( $course_slug );

		if ( ! $config ) {
			$course_slug = '360elite';
			$config      = self::get_course_config( $course_slug );
		}

		self::render_notice();

		$course_id  = self::get_course_id( $config );
		$students   = $course_id ? self::get_enrolled_students( $course_id, $search ) : array();
		$students   = self::filter_students_by_status( $students, $course_slug, $status );
		$preview_id = isset( $_GET['preview_user'] ) ? absint( $_GET['preview_user'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		?>
		<div class="wrap mmed-welcome-email-admin">
			<h1>MissionMed Welcome Emails</h1>
			<p class="description">Admin-only, course-specific welcome email sending. This page sends no email until selected rows are checked and the Send button is clicked.</p>

			<?php self::render_admin_styles(); ?>
			<?php self::render_course_nav( $configs, $course_slug ); ?>
			<?php self::render_settings_panel( $configs ); ?>

			<div class="mmed-welcome-card">
				<div class="mmed-welcome-card__header">
					<div>
						<h2><?php echo esc_html( $config['label'] ); ?></h2>
						<p><?php echo esc_html( $config['description'] ); ?></p>
					</div>
					<div class="mmed-welcome-meta">
						<span>Course ID: <?php echo esc_html( $course_id ? $course_id : 'Not configured' ); ?></span>
						<span>Sender: Michelle, MissionMed Admissions</span>
						<span>Status: <?php echo $config['enabled'] ? 'Template enabled' : 'Template pending'; ?></span>
					</div>
				</div>

				<form method="get" class="mmed-welcome-filters">
					<input type="hidden" name="page" value="<?php echo esc_attr( self::PAGE_SLUG ); ?>" />
					<input type="hidden" name="course" value="<?php echo esc_attr( $course_slug ); ?>" />
					<label>
						<span>Search students</span>
						<input type="search" name="s" value="<?php echo esc_attr( $search ); ?>" placeholder="Name or email" />
					</label>
					<label>
						<span>Email status</span>
						<select name="status">
							<option value="unsent" <?php selected( $status, 'unsent' ); ?>>Unsent</option>
							<option value="all" <?php selected( $status, 'all' ); ?>>All</option>
							<option value="sent" <?php selected( $status, 'sent' ); ?>>Sent</option>
						</select>
					</label>
					<button type="submit" class="button">Filter</button>
				</form>

				<?php if ( ! $config['enabled'] ) : ?>
					<div class="notice notice-warning inline"><p><?php echo esc_html( $config['disabled_reason'] ); ?></p></div>
				<?php elseif ( ! $course_id ) : ?>
					<div class="notice notice-error inline"><p>This course does not have a configured LearnDash course ID.</p></div>
				<?php endif; ?>

				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<?php wp_nonce_field( 'mmed_welcome_email_send', 'mmed_welcome_email_nonce' ); ?>
					<input type="hidden" name="action" value="mmed_welcome_email_send" />
					<input type="hidden" name="course" value="<?php echo esc_attr( $course_slug ); ?>" />
					<input type="hidden" name="return_status" value="<?php echo esc_attr( $status ); ?>" />
					<input type="hidden" name="return_search" value="<?php echo esc_attr( $search ); ?>" />

					<div class="mmed-welcome-send-options">
						<label>
							<span>Orientation details</span>
							<input type="text" name="orientation_details" value="<?php echo esc_attr( $config['orientation'] ); ?>" />
						</label>
						<label class="mmed-welcome-checkbox">
							<input type="checkbox" name="allow_resend" value="1" />
							<span>Allow resend to students already marked sent</span>
						</label>
					</div>

					<table class="widefat fixed striped mmed-welcome-table">
						<thead>
							<tr>
								<td class="manage-column column-cb check-column"><input type="checkbox" data-mmed-welcome-check-all /></td>
								<th>Student</th>
								<th>Username</th>
								<th>Status</th>
								<th>Temporary Password (optional)</th>
								<th>Preview</th>
							</tr>
						</thead>
						<tbody>
							<?php if ( empty( $students ) ) : ?>
								<tr><td colspan="6">No enrolled students matched this filter.</td></tr>
							<?php else : ?>
								<?php foreach ( $students as $student ) : ?>
									<?php
									$sent_at     = self::get_sent_at( $student->ID, $course_slug );
									$preview_url = self::preview_url( $student->ID, $course_slug, $status, $search );
									?>
									<tr>
										<th scope="row" class="check-column">
											<input type="checkbox" name="student_ids[]" value="<?php echo esc_attr( $student->ID ); ?>" <?php disabled( ! $config['enabled'] || ! $course_id ); ?> />
										</th>
										<td>
											<strong><?php echo esc_html( self::student_display_name( $student ) ); ?></strong>
											<div class="mmed-muted"><?php echo esc_html( $student->user_email ); ?></div>
										</td>
										<td><?php echo esc_html( $student->user_login ); ?></td>
										<td>
											<?php if ( $sent_at ) : ?>
												<span class="mmed-status mmed-status--sent">Sent</span>
												<div class="mmed-muted"><?php echo esc_html( $sent_at ); ?></div>
											<?php else : ?>
												<span class="mmed-status mmed-status--unsent">Unsent</span>
											<?php endif; ?>
										</td>
										<td>
											<input type="text" name="temporary_passwords[<?php echo esc_attr( $student->ID ); ?>]" value="" autocomplete="new-password" placeholder="Leave blank for existing-password language" <?php disabled( ! $config['enabled'] || ! $course_id ); ?> />
											<div class="mmed-muted">Passwords are sent only in the email body and are never stored in the send log.</div>
										</td>
										<td><a class="button button-small" href="<?php echo esc_url( $preview_url ); ?>">Preview</a></td>
									</tr>
								<?php endforeach; ?>
							<?php endif; ?>
						</tbody>
					</table>

					<p class="submit">
						<button type="submit" class="button button-primary" <?php disabled( ! $config['enabled'] || ! $course_id || empty( $students ) ); ?>>Send Selected Welcome Emails</button>
					</p>
				</form>
			</div>

			<?php
			if ( $preview_id ) {
				self::render_preview( $preview_id, $config, $course_slug );
			}
			?>
		</div>
		<script>
			document.addEventListener("change", function(event) {
				if (!event.target.matches("[data-mmed-welcome-check-all]")) {
					return;
				}
				document.querySelectorAll(".mmed-welcome-table tbody input[type='checkbox'][name='student_ids[]']").forEach(function(box) {
					if (!box.disabled) {
						box.checked = event.target.checked;
					}
				});
			});
		</script>
		<?php
	}

	/**
	 * Save auto-send settings.
	 *
	 * @return void
	 */
	public static function handle_save_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save MissionMed welcome email settings.', 'missionmed-hub' ) );
		}

		check_admin_referer( 'mmed_welcome_email_settings', 'mmed_welcome_email_settings_nonce' );

		$configs       = self::course_configs();
		$enabled       = ! empty( $_POST['auto_enabled'] ) ? 1 : 0;
		$posted_courses = isset( $_POST['auto_courses'] ) ? (array) wp_unslash( $_POST['auto_courses'] ) : array();
		$auto_courses  = array();

		foreach ( $posted_courses as $course_slug ) {
			$course_slug = sanitize_key( $course_slug );
			if ( isset( $configs[ $course_slug ] ) && ! empty( $configs[ $course_slug ]['enabled'] ) ) {
				$auto_courses[] = $course_slug;
			}
		}

		update_option( self::OPTION_AUTO_ENABLED, $enabled, false );
		update_option( self::OPTION_AUTO_COURSES, array_values( array_unique( $auto_courses ) ), false );

		self::set_notice( 'success', 'Welcome email settings saved.' );
		wp_safe_redirect( self::admin_url() );
		exit;
	}

	/**
	 * Send selected welcome emails.
	 *
	 * @return void
	 */
	public static function handle_send() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to send MissionMed welcome emails.', 'missionmed-hub' ) );
		}

		check_admin_referer( 'mmed_welcome_email_send', 'mmed_welcome_email_nonce' );

		$course_slug = isset( $_POST['course'] ) ? sanitize_key( wp_unslash( $_POST['course'] ) ) : '360elite';
		$status      = isset( $_POST['return_status'] ) ? sanitize_key( wp_unslash( $_POST['return_status'] ) ) : 'unsent';
		$search      = isset( $_POST['return_search'] ) ? sanitize_text_field( wp_unslash( $_POST['return_search'] ) ) : '';
		$config      = self::get_course_config( $course_slug );
		$student_ids = isset( $_POST['student_ids'] ) ? array_map( 'absint', (array) wp_unslash( $_POST['student_ids'] ) ) : array();
		$passwords   = isset( $_POST['temporary_passwords'] ) ? (array) wp_unslash( $_POST['temporary_passwords'] ) : array();
		$orientation = isset( $_POST['orientation_details'] ) ? sanitize_text_field( wp_unslash( $_POST['orientation_details'] ) ) : '';
		$allow_resend = ! empty( $_POST['allow_resend'] );

		if ( ! $config || empty( $config['enabled'] ) ) {
			self::set_notice( 'error', 'This course does not have an approved welcome email template yet.' );
			wp_safe_redirect( self::admin_url( $course_slug, $status, $search ) );
			exit;
		}

		$sent = 0;
		$skipped = 0;
		$failed = 0;

		foreach ( array_unique( array_filter( $student_ids ) ) as $student_id ) {
			$user = get_user_by( 'id', $student_id );
			if ( ! $user || ! self::is_user_enrolled( $student_id, self::get_course_id( $config ) ) ) {
				$skipped++;
				continue;
			}

			if ( self::get_sent_at( $student_id, $course_slug ) && ! $allow_resend ) {
				$skipped++;
				continue;
			}

			$temp_password = isset( $passwords[ $student_id ] ) ? sanitize_text_field( $passwords[ $student_id ] ) : '';
			$result        = self::send_course_email( $user, $config, $temp_password, $orientation, 'manual', get_current_user_id() );

			if ( is_wp_error( $result ) ) {
				$failed++;
			} else {
				$sent++;
			}
		}

		self::set_notice(
			$failed ? 'warning' : 'success',
			sprintf(
				'Welcome email run complete. Sent: %1$d. Skipped: %2$d. Failed: %3$d.',
				$sent,
				$skipped,
				$failed
			)
		);

		wp_safe_redirect( self::admin_url( $course_slug, $status, $search ) );
		exit;
	}

	/**
	 * Maybe send after a LearnDash course-access grant.
	 *
	 * @param int $user_id   User ID.
	 * @param int $course_id Course ID.
	 * @return void
	 */
	public static function maybe_auto_send_from_learndash( $user_id, $course_id, $remove = null, $context = null ) {
		$user_id   = absint( $user_id );
		$course_id = absint( $course_id );

		if ( true === $remove || 'remove' === $remove || ! $user_id || ! $course_id || ! self::is_auto_enabled() ) {
			return;
		}

		$config = self::config_for_course_id( $course_id );
		if ( ! $config || ! self::is_course_auto_enabled( $config['slug'] ) || ! self::is_user_enrolled( $user_id, $course_id ) ) {
			return;
		}

		$user = get_user_by( 'id', $user_id );
		if ( ! $user || self::get_sent_at( $user_id, $config['slug'] ) ) {
			return;
		}

		self::send_course_email( $user, $config, '', $config['orientation'], 'auto_learndash', 0 );
	}

	/**
	 * Maybe send after WooCommerce order completion/processing.
	 *
	 * @param int $order_id Order ID.
	 * @return void
	 */
	public static function maybe_auto_send_from_order( $order_id ) {
		if ( ! self::is_auto_enabled() || ! function_exists( 'wc_get_order' ) ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$user_id = absint( $order->get_user_id() );
		if ( ! $user_id ) {
			return;
		}

		foreach ( self::course_configs() as $config ) {
			if ( empty( $config['enabled'] ) || ! self::is_course_auto_enabled( $config['slug'] ) ) {
				continue;
			}

			if ( ! self::order_contains_course_product( $order, $config ) ) {
				continue;
			}

			$course_id = self::get_course_id( $config );
			if ( ! $course_id || ! self::is_user_enrolled( $user_id, $course_id ) || self::get_sent_at( $user_id, $config['slug'] ) ) {
				continue;
			}

			$user = get_user_by( 'id', $user_id );
			if ( $user ) {
				self::send_course_email( $user, $config, '', $config['orientation'], 'auto_woocommerce', 0 );
			}
		}
	}

	/**
	 * Send one course-specific welcome email.
	 *
	 * @param WP_User $user          Student user.
	 * @param array   $config        Course config.
	 * @param string  $temp_password Optional temporary password.
	 * @param string  $orientation   Orientation copy.
	 * @param string  $source        Send source.
	 * @param int     $actor_id      Admin user ID, or 0 for automated sends.
	 * @return true|WP_Error
	 */
	private static function send_course_email( $user, $config, $temp_password = '', $orientation = '', $source = 'manual', $actor_id = 0 ) {
		if ( empty( $config['enabled'] ) ) {
			return new WP_Error( 'mmed_welcome_template_disabled', 'No approved template is enabled for this course.' );
		}

		if ( ! is_email( $user->user_email ) ) {
			return new WP_Error( 'mmed_welcome_email_invalid', 'Student email is invalid.' );
		}

		$payload = self::build_email_payload( $user, $config, $temp_password, $orientation );
		$headers = array(
			'Content-Type: text/html; charset=UTF-8',
			'From: "Michelle, MissionMed Admissions" <info@missionmedinstitute.com>',
			'Reply-To: info@missionmedinstitute.com',
			'X-MissionMed-Welcome-Course: ' . $config['slug'],
		);

		self::$current_alt_body = $payload['text'];
		add_action( 'phpmailer_init', array( __CLASS__, 'set_phpmailer_alt_body' ) );
		$sent = wp_mail( $user->user_email, $payload['subject'], $payload['html'], $headers );
		remove_action( 'phpmailer_init', array( __CLASS__, 'set_phpmailer_alt_body' ) );
		self::$current_alt_body = '';

		if ( ! $sent ) {
			return new WP_Error( 'mmed_welcome_send_failed', 'wp_mail returned false.' );
		}

		$slug = $config['slug'];
		update_user_meta( $user->ID, self::META_SENT_PREFIX . $slug, current_time( 'mysql' ) );
		update_user_meta( $user->ID, self::META_SENT_BY_PREFIX . $slug, absint( $actor_id ) );
		update_user_meta( $user->ID, self::META_SUBJECT_PREFIX . $slug, sanitize_text_field( $payload['subject'] ) );
		update_user_meta( $user->ID, self::META_SOURCE_PREFIX . $slug, sanitize_key( $source ) );

		return true;
	}

	/**
	 * Add plain text fallback as PHPMailer AltBody.
	 *
	 * @param PHPMailer $phpmailer PHPMailer instance.
	 * @return void
	 */
	public static function set_phpmailer_alt_body( $phpmailer ) {
		if ( '' !== self::$current_alt_body ) {
			$phpmailer->AltBody = self::$current_alt_body;
		}
	}

	/**
	 * Build HTML/text/subject for a student.
	 *
	 * @param WP_User $user          Student user.
	 * @param array   $config        Course config.
	 * @param string  $temp_password Optional temporary password.
	 * @param string  $orientation   Orientation copy.
	 * @return array
	 */
	private static function build_email_payload( $user, $config, $temp_password = '', $orientation = '' ) {
		$first_name   = self::student_first_name( $user );
		$last_name    = self::student_last_name( $user );
		$display_name = self::student_display_name( $user );
		$orientation  = $orientation ? $orientation : $config['orientation'];
		$subject      = str_replace( '{last_name}', $last_name, $config['subject'] );
		$html         = self::load_template( $config );
		$password_copy = $temp_password ? $temp_password : 'Use existing password or reset from login page.';

		if ( '' === $temp_password ) {
			$html = str_replace( 'Temporary Password:', 'Password:', $html );
		}

		$html = str_replace(
			array(
				'[First Name]',
				'[Last Name]',
				'[Display Name]',
				'[Username]',
				'[Temporary Password]',
				'[Orientation Details]',
				'[Login URL]',
				'[Support Email]',
				'Sunday, June 7 at 12:00 PM EST',
			),
			array(
				esc_html( $first_name ),
				esc_html( $last_name ),
				esc_html( $display_name ),
				esc_html( $user->user_login ),
				esc_html( $password_copy ),
				esc_html( $orientation ),
				'https://missionmedinstitute.com/my-account/',
				'info@missionmedinstitute.com',
				esc_html( $orientation ),
			),
			$html
		);

		return array(
			'subject' => $subject,
			'html'    => $html,
			'text'    => self::build_plain_text( $user, $config, $temp_password, $orientation ),
		);
	}

	/**
	 * Plain text fallback.
	 *
	 * @param WP_User $user          Student user.
	 * @param array   $config        Course config.
	 * @param string  $temp_password Optional temporary password.
	 * @param string  $orientation   Orientation copy.
	 * @return string
	 */
	private static function build_plain_text( $user, $config, $temp_password, $orientation ) {
		if ( ! empty( $config['slug'] ) && 'drj_drills_beta' === $config['slug'] ) {
			return self::build_drj_plain_text( $user, $temp_password );
		}

		$last_name = self::student_last_name( $user );
		$password_line = $temp_password
			? 'Temporary Password: ' . $temp_password
			: 'Password: Use your current MissionMed password, or reset it from the login page.';

		$lines = array(
			'Welcome to the 360 Match Mentorship Program, Dr. ' . $last_name . '!',
			'',
			'Your journey to residency begins now.',
			'',
			'Welcome to the MissionMed family! Your 360 Match Mentorship enrollment is confirmed, and we are excited to get you started.',
			'',
			'You now have pre-start access to your MissionMed account, Matrix Dashboard, training calendar, and Scheduler so you can book your first 1-on-1. Additional Matrix and 360 course features activate as soon as you complete orientation; your personal mentorship strategy work begins after your first 1-on-1 private advising session with Dr. Brian.',
			'',
			'Login details:',
			'Username: ' . $user->user_login,
			$password_line,
			'Login URL: https://missionmedinstitute.com/my-account/',
			'',
			'What happens next:',
			'1. Log in and open your Matrix Dashboard.',
			'2. Complete your Student Profile.',
			'3. Schedule your 1-on-1 Advising Session with Dr. Brian.',
			'4. Attend 360 Orientation: ' . $orientation,
			'',
			'Dr. Brian direct mobile: 347-949-1109',
			'Support: info@missionmedinstitute.com',
			'',
			'When YOU Match, WE Match.',
			'',
			'Warmly,',
			'Michelle de la Cruz',
			'Director of Admissions',
			'MissionMed Institute',
		);

		return implode( "\n", $lines );
	}

	/**
	 * Plain-text fallback for Dr J Drills beta welcome emails.
	 *
	 * @param WP_User $user          Student user.
	 * @param string  $temp_password Optional temporary password.
	 * @return string
	 */
	private static function build_drj_plain_text( $user, $temp_password ) {
		$password_line = $temp_password
			? 'Temporary Password: ' . $temp_password
			: 'Password: Use your current MissionMed password, or reset it from the login page.';

		$lines = array(
			'Welcome to Dr J Drills LIVE & MissionMed Arena Beta',
			'',
			'Hi ' . self::student_display_name( $user ) . ',',
			'',
			'You have been invited to the MissionMed beta trial for Dr J Drills LIVE and MissionMed Arena before official launch.',
			'',
			'Your access includes:',
			'- Dr J Drills LIVE',
			'- Arena Dr J Drills',
			'- Dr J Daily Drills in Arena',
			'- Matrix Calendar',
			'',
			'Login details:',
			'Username: ' . $user->user_login,
			$password_line,
			'Login URL: https://missionmedinstitute.com/my-account/',
			'',
			'First steps:',
			'1. Log into MissionMed.',
			'2. Open your MissionMed Matrix Dashboard.',
			'3. Complete your student profile.',
			'4. Create your avatar as part of profile setup.',
			'5. Enter Dr J Drills LIVE or Arena Dr J Drills from Matrix.',
			'',
			'Please change your password after your first login.',
			'Support: info@missionmedinstitute.com',
			'',
			'Welcome in,',
			'Michelle, MissionMed Admissions',
		);

		return implode( "\n", $lines );
	}

	/**
	 * Load the HTML template for a course.
	 *
	 * @param array $config Course config.
	 * @return string
	 */
	private static function load_template( $config ) {
		$template = ! empty( $config['template'] ) ? MMED_HUB_PATH . $config['template'] : '';
		if ( ! $template || ! file_exists( $template ) ) {
			return '';
		}

		return (string) file_get_contents( $template );
	}

	/**
	 * Course registry.
	 *
	 * @return array
	 */
	private static function course_configs() {
		return array(
			'360elite' => array(
				'slug'            => '360elite',
				'label'           => '360 Match Mentorship',
				'description'     => 'Approved MR-1412 welcome email with Matrix pre-start language and 360 onboarding steps.',
				'course_option'   => 'mmed_course_360elite',
				'course_default'  => 3893,
				'product_option'  => 'mmed_product_360elite',
				'product_aliases' => array( 3575, 5511 ),
				'subject'         => 'Welcome to the 360 Match Mentorship Program, Dr. {last_name}!',
				'orientation'     => 'Sunday, June 7 at 12:00 PM EST',
				'template'        => 'templates/emails/welcome-360.html',
				'enabled'         => true,
				'disabled_reason' => '',
			),
			'drj_drills_beta' => array(
				'slug'            => 'drj_drills_beta',
				'label'           => 'Dr J Drills LIVE Beta',
				'description'     => 'Approved Dr J beta welcome email for Live Drills, Arena Dr J Drills, Daily Drills in Arena, and Matrix Calendar access.',
				'course_option'   => 'mmed_course_drills_on_call',
				'course_default'  => 6357,
				'product_option'  => '',
				'product_aliases' => array(),
				'subject'         => 'Welcome to Dr J Drills LIVE & MissionMed Arena Beta',
				'orientation'     => '',
				'template'        => 'templates/emails/welcome-drj-drills.html',
				'enabled'         => true,
				'disabled_reason' => '',
			),
			'complete' => array(
				'slug'            => 'complete',
				'label'           => 'Match Prep Pro',
				'description'     => 'Registry placeholder for a future approved Match Prep Pro welcome template.',
				'course_option'   => 'mmed_course_complete',
				'course_default'  => 5227,
				'product_option'  => 'mmed_product_complete',
				'product_aliases' => array( 3576, 5512 ),
				'subject'         => 'Welcome to Match Prep Pro, Dr. {last_name}',
				'orientation'     => '',
				'template'        => '',
				'enabled'         => false,
				'disabled_reason' => 'Match Prep Pro sending is intentionally disabled until an approved course-specific template is installed.',
			),
			'foundation' => array(
				'slug'            => 'foundation',
				'label'           => 'IV Prep Complete Masterclass',
				'description'     => 'Registry placeholder for a future approved IV Prep welcome template.',
				'course_option'   => 'mmed_course_foundation',
				'course_default'  => 3646,
				'product_option'  => 'mmed_product_foundation',
				'product_aliases' => array( 3577, 5504, 5513 ),
				'subject'         => 'Welcome to IV Prep Complete Masterclass, Dr. {last_name}',
				'orientation'     => '',
				'template'        => '',
				'enabled'         => false,
				'disabled_reason' => 'IV Prep sending is intentionally disabled until an approved course-specific template is installed.',
			),
		);
	}

	/**
	 * Get one course config.
	 *
	 * @param string $course_slug Course slug.
	 * @return array|null
	 */
	private static function get_course_config( $course_slug ) {
		$configs = self::course_configs();
		return isset( $configs[ $course_slug ] ) ? $configs[ $course_slug ] : null;
	}

	/**
	 * Find a config by LearnDash course ID.
	 *
	 * @param int $course_id Course ID.
	 * @return array|null
	 */
	private static function config_for_course_id( $course_id ) {
		foreach ( self::course_configs() as $config ) {
			if ( self::get_course_id( $config ) === absint( $course_id ) ) {
				return $config;
			}
		}

		return null;
	}

	/**
	 * Course ID from options/defaults.
	 *
	 * @param array $config Course config.
	 * @return int
	 */
	private static function get_course_id( $config ) {
		$default = isset( $config['course_default'] ) ? absint( $config['course_default'] ) : 0;
		$option  = ! empty( $config['course_option'] ) ? $config['course_option'] : '';

		if ( ! $option ) {
			return $default;
		}

		return absint( get_option( $option, $default ) );
	}

	/**
	 * Product IDs for order matching.
	 *
	 * @param array $config Course config.
	 * @return int[]
	 */
	private static function get_product_ids( $config ) {
		$ids = isset( $config['product_aliases'] ) ? (array) $config['product_aliases'] : array();
		if ( ! empty( $config['product_option'] ) ) {
			$ids[] = get_option( $config['product_option'], 0 );
		}

		return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
	}

	/**
	 * Does an order contain a product mapped to this course.
	 *
	 * @param WC_Order $order  Order.
	 * @param array    $config Course config.
	 * @return bool
	 */
	private static function order_contains_course_product( $order, $config ) {
		$product_ids = self::get_product_ids( $config );
		if ( empty( $product_ids ) ) {
			return false;
		}

		foreach ( $order->get_items() as $item ) {
			$item_ids = array();
			if ( is_object( $item ) && method_exists( $item, 'get_product_id' ) ) {
				$item_ids[] = absint( $item->get_product_id() );
			}
			if ( is_object( $item ) && method_exists( $item, 'get_variation_id' ) ) {
				$item_ids[] = absint( $item->get_variation_id() );
			}
			if ( array_intersect( $product_ids, array_filter( $item_ids ) ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Return enrolled students for a course.
	 *
	 * @param int    $course_id Course ID.
	 * @param string $search    Search query.
	 * @return WP_User[]
	 */
	private static function get_enrolled_students( $course_id, $search = '' ) {
		$args = array(
			'number'  => 500,
			'orderby' => 'display_name',
			'order'   => 'ASC',
		);

		if ( '' !== $search ) {
			$args['search'] = '*' . $search . '*';
			$args['search_columns'] = array( 'user_login', 'user_email', 'display_name' );
		}

		$users = get_users( $args );
		$enrolled = array();

		foreach ( $users as $user ) {
			if ( self::is_user_enrolled( $user->ID, $course_id ) ) {
				$enrolled[] = $user;
			}
		}

		return $enrolled;
	}

	/**
	 * Filter list by sent/unsent status.
	 *
	 * @param WP_User[] $students    Students.
	 * @param string    $course_slug Course slug.
	 * @param string    $status      Status filter.
	 * @return WP_User[]
	 */
	private static function filter_students_by_status( $students, $course_slug, $status ) {
		if ( 'all' === $status ) {
			return $students;
		}

		return array_values(
			array_filter(
				$students,
				function ( $student ) use ( $course_slug, $status ) {
					$sent = (bool) self::get_sent_at( $student->ID, $course_slug );
					return 'sent' === $status ? $sent : ! $sent;
				}
			)
		);
	}

	/**
	 * Check current LearnDash enrollment for a user/course.
	 *
	 * @param int $user_id   User ID.
	 * @param int $course_id Course ID.
	 * @return bool
	 */
	private static function is_user_enrolled( $user_id, $course_id ) {
		$user_id   = absint( $user_id );
		$course_id = absint( $course_id );

		if ( ! $user_id || ! $course_id ) {
			return false;
		}

		if ( function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			$course_ids = array_map( 'absint', (array) learndash_user_get_enrolled_courses( $user_id ) );
			return in_array( $course_id, $course_ids, true );
		}

		return '' !== (string) get_user_meta( $user_id, 'course_' . $course_id . '_access_from', true );
	}

	/**
	 * Get sent timestamp.
	 *
	 * @param int    $user_id     User ID.
	 * @param string $course_slug Course slug.
	 * @return string
	 */
	private static function get_sent_at( $user_id, $course_slug ) {
		return (string) get_user_meta( absint( $user_id ), self::META_SENT_PREFIX . sanitize_key( $course_slug ), true );
	}

	/**
	 * Admin page URL.
	 *
	 * @param string $course_slug Course slug.
	 * @param string $status      Status filter.
	 * @param string $search      Search.
	 * @return string
	 */
	private static function admin_url( $course_slug = '360elite', $status = 'unsent', $search = '' ) {
		return add_query_arg(
			array_filter(
				array(
					'page'   => self::PAGE_SLUG,
					'course' => sanitize_key( $course_slug ),
					'status' => sanitize_key( $status ),
					's'      => $search,
				)
			),
			admin_url( 'admin.php' )
		);
	}

	/**
	 * Preview URL.
	 *
	 * @param int    $user_id     User ID.
	 * @param string $course_slug Course slug.
	 * @param string $status      Status filter.
	 * @param string $search      Search.
	 * @return string
	 */
	private static function preview_url( $user_id, $course_slug, $status, $search ) {
		return add_query_arg(
			array(
				'preview_user' => absint( $user_id ),
			),
			self::admin_url( $course_slug, $status, $search )
		);
	}

	/**
	 * Render preview panel.
	 *
	 * @param int    $user_id     User ID.
	 * @param array  $config      Course config.
	 * @param string $course_slug Course slug.
	 * @return void
	 */
	private static function render_preview( $user_id, $config, $course_slug ) {
		$user = get_user_by( 'id', $user_id );
		if ( ! $user || empty( $config['enabled'] ) ) {
			return;
		}

		$payload = self::build_email_payload( $user, $config, '', $config['orientation'] );
		?>
		<div class="mmed-welcome-card">
			<h2>Email Preview: <?php echo esc_html( self::student_display_name( $user ) ); ?></h2>
			<p><strong>Subject:</strong> <?php echo esc_html( $payload['subject'] ); ?></p>
			<p><strong>From:</strong> Michelle, MissionMed Admissions &lt;info@missionmedinstitute.com&gt;</p>
			<iframe class="mmed-welcome-preview" title="Welcome email preview" srcdoc="<?php echo esc_attr( $payload['html'] ); ?>"></iframe>
			<details>
				<summary>Plain-text fallback preview</summary>
				<pre><?php echo esc_html( $payload['text'] ); ?></pre>
			</details>
		</div>
		<?php
	}

	/**
	 * Course navigation.
	 *
	 * @param array  $configs     Course configs.
	 * @param string $course_slug Active slug.
	 * @return void
	 */
	private static function render_course_nav( $configs, $course_slug ) {
		echo '<nav class="nav-tab-wrapper mmed-welcome-tabs">';
		foreach ( $configs as $slug => $config ) {
			$class = 'nav-tab';
			if ( $slug === $course_slug ) {
				$class .= ' nav-tab-active';
			}
			echo '<a class="' . esc_attr( $class ) . '" href="' . esc_url( self::admin_url( $slug ) ) . '">' . esc_html( $config['label'] ) . '</a>';
		}
		echo '</nav>';
	}

	/**
	 * Settings panel.
	 *
	 * @param array $configs Course configs.
	 * @return void
	 */
	private static function render_settings_panel( $configs ) {
		$auto_enabled = self::is_auto_enabled();
		$auto_courses = self::auto_courses();
		?>
		<div class="mmed-welcome-card mmed-welcome-card--settings">
			<h2>Automation Settings</h2>
			<p class="description">Manual batch sending is available now. Automatic sends are disabled by default and only run for courses with approved templates.</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'mmed_welcome_email_settings', 'mmed_welcome_email_settings_nonce' ); ?>
				<input type="hidden" name="action" value="mmed_welcome_email_save_settings" />
				<label class="mmed-welcome-checkbox">
					<input type="checkbox" name="auto_enabled" value="1" <?php checked( $auto_enabled ); ?> />
					<span>Enable automatic welcome emails after WooCommerce enrollment or LearnDash course access is granted</span>
				</label>
				<div class="mmed-welcome-auto-courses">
					<?php foreach ( $configs as $slug => $config ) : ?>
						<label class="mmed-welcome-checkbox">
							<input type="checkbox" name="auto_courses[]" value="<?php echo esc_attr( $slug ); ?>" <?php checked( in_array( $slug, $auto_courses, true ) ); ?> <?php disabled( empty( $config['enabled'] ) ); ?> />
							<span><?php echo esc_html( $config['label'] ); ?><?php echo empty( $config['enabled'] ) ? ' (template pending)' : ''; ?></span>
						</label>
					<?php endforeach; ?>
				</div>
				<p class="submit"><button type="submit" class="button button-secondary">Save Automation Settings</button></p>
			</form>
		</div>
		<?php
	}

	/**
	 * Minimal admin styles scoped to this page.
	 *
	 * @return void
	 */
	private static function render_admin_styles() {
		?>
		<style>
			.mmed-welcome-card{margin:18px 0;padding:18px 20px;border:1px solid #ccd0d4;border-radius:8px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04)}
			.mmed-welcome-card__header{display:flex;justify-content:space-between;gap:22px;align-items:flex-start}
			.mmed-welcome-meta{display:grid;gap:6px;min-width:260px;color:#50575e;font-size:12px}
			.mmed-welcome-filters,.mmed-welcome-send-options{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:flex-end;margin:14px 0}
			.mmed-welcome-filters label,.mmed-welcome-send-options label:not(.mmed-welcome-checkbox){display:grid;gap:5px;font-weight:600}
			.mmed-welcome-send-options input[type="text"]{min-width:320px}
			.mmed-welcome-checkbox{display:flex;gap:8px;align-items:flex-start}
			.mmed-welcome-auto-courses{display:grid;gap:8px;margin:10px 0 0}
			.mmed-muted{color:#646970;font-size:12px}
			.mmed-status{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:700}
			.mmed-status--sent{background:#e8f5e9;color:#1b5e20}
			.mmed-status--unsent{background:#f5f5f5;color:#50575e}
			.mmed-welcome-table input[type="text"]{width:100%;max-width:280px}
			.mmed-welcome-preview{width:100%;height:760px;border:1px solid #ccd0d4;border-radius:8px;background:#c7ced8}
			@media (max-width:782px){.mmed-welcome-card__header{display:block}.mmed-welcome-meta{margin-top:12px}.mmed-welcome-send-options input[type="text"]{min-width:0;width:100%}}
		</style>
		<?php
	}

	/**
	 * Store a short admin notice.
	 *
	 * @param string $type    Notice type.
	 * @param string $message Message.
	 * @return void
	 */
	private static function set_notice( $type, $message ) {
		set_transient(
			self::NOTICE_TRANSIENT . get_current_user_id(),
			array(
				'type'    => sanitize_key( $type ),
				'message' => sanitize_text_field( $message ),
			),
			60
		);
	}

	/**
	 * Render and clear a stored admin notice.
	 *
	 * @return void
	 */
	private static function render_notice() {
		$key = self::NOTICE_TRANSIENT . get_current_user_id();
		$notice = get_transient( $key );
		if ( ! is_array( $notice ) ) {
			return;
		}
		delete_transient( $key );

		$type = in_array( $notice['type'], array( 'success', 'warning', 'error' ), true ) ? $notice['type'] : 'info';
		echo '<div class="notice notice-' . esc_attr( $type ) . ' is-dismissible"><p>' . esc_html( $notice['message'] ) . '</p></div>';
	}

	/**
	 * Auto setting.
	 *
	 * @return bool
	 */
	private static function is_auto_enabled() {
		return (bool) get_option( self::OPTION_AUTO_ENABLED, 0 );
	}

	/**
	 * Auto-enabled course slugs.
	 *
	 * @return string[]
	 */
	private static function auto_courses() {
		$courses = get_option( self::OPTION_AUTO_COURSES, array() );
		return array_values( array_filter( array_map( 'sanitize_key', (array) $courses ) ) );
	}

	/**
	 * Is a course enabled for auto sends.
	 *
	 * @param string $course_slug Course slug.
	 * @return bool
	 */
	private static function is_course_auto_enabled( $course_slug ) {
		return in_array( sanitize_key( $course_slug ), self::auto_courses(), true );
	}

	/**
	 * Student display name.
	 *
	 * @param WP_User $user User.
	 * @return string
	 */
	private static function student_display_name( $user ) {
		$name = trim( $user->display_name );
		if ( '' === $name ) {
			$name = trim( get_user_meta( $user->ID, 'first_name', true ) . ' ' . get_user_meta( $user->ID, 'last_name', true ) );
		}
		return $name ? $name : $user->user_login;
	}

	/**
	 * First-name personalization fallback.
	 *
	 * @param WP_User $user User.
	 * @return string
	 */
	private static function student_first_name( $user ) {
		$first_name = trim( (string) get_user_meta( $user->ID, 'first_name', true ) );
		if ( $first_name ) {
			return $first_name;
		}

		$name_parts = preg_split( '/\s+/', self::student_display_name( $user ) );
		$name_parts = array_values( array_filter( (array) $name_parts ) );

		if ( ! empty( $name_parts ) ) {
			return reset( $name_parts );
		}

		return 'Doctor';
	}

	/**
	 * Last-name personalization fallback.
	 *
	 * @param WP_User $user User.
	 * @return string
	 */
	private static function student_last_name( $user ) {
		$last_name = trim( (string) get_user_meta( $user->ID, 'last_name', true ) );
		if ( $last_name ) {
			return $last_name;
		}

		$name_parts = preg_split( '/\s+/', self::student_display_name( $user ) );
		$name_parts = array_values( array_filter( (array) $name_parts ) );

		if ( ! empty( $name_parts ) ) {
			return end( $name_parts );
		}

		return 'Doctor';
	}
}
