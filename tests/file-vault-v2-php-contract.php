<?php
/**
 * Standalone contract tests for File Vault V2 flag and route registration.
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED', true );
define( 'MMED_FILE_VAULT_V2_TESTING', true );

$GLOBALS['fv2_options'] = array();
$GLOBALS['fv2_caps']    = array();
$GLOBALS['fv2_routes']  = array();
$GLOBALS['fv2_user_id'] = 17;
$GLOBALS['fv2_actions'] = array();
$GLOBALS['fv2_access']  = array(
	17 => array( 'is_enrolled' => true, 'free_modules' => array( 'dashboard', 'arena' ) ),
	99 => array( 'is_enrolled' => false, 'free_modules' => array( 'dashboard', 'arena' ) ),
);

class WP_Error {
	private $code;
	private $message;
	private $data;
	public function __construct( $code, $message, $data = array() ) {
		$this->code = $code;
		$this->message = $message;
		$this->data = $data;
	}
	public function get_error_code() { return $this->code; }
	public function get_error_data() { return $this->data; }
}

class WP_REST_Response {
	public function __construct( $data = null, $status = 200 ) {}
}

class WP_REST_Server {
	const READABLE  = 'GET';
	const CREATABLE = 'POST';
	const EDITABLE  = 'POST, PUT, PATCH';
}

class FV2_Request {
	private $method;
	private $headers;
	public function __construct( $method = 'GET', $headers = array() ) {
		$this->method = $method;
		$this->headers = array_change_key_case( $headers, CASE_LOWER );
	}
	public function get_header( $name ) { return $this->headers[ strtolower( $name ) ] ?? ''; }
	public function get_method() { return $this->method; }
}

class MMED_Access_Gate {
	public static function get_access_payload( $user_id ) { return $GLOBALS['fv2_access'][ absint( $user_id ) ] ?? null; }
}

class MMED_File_Vault {
	public static function maybe_install() {}
	public static function table_name() { return 'wp_mmed_files'; }
	protected static function storage_configured() { return true; }
	protected static function sanitize_category( $value, $default ) { return $value ?: $default; }
	protected static function get_file_by_id( $id ) { return null; }
	protected static function get_owned_file( $id, $user_id ) { return null; }
	protected static function student_prefix( $user_id ) { return 'student-files/' . (int) $user_id . '/'; }
	protected static function presign_url( $method, $key, $expires ) { return 'https://example.test/signed'; }
}

function add_action( $name ) { $GLOBALS['fv2_actions'][] = $name; }
function apply_filters( $name, $value, ...$args ) { return $value; }
function get_option( $key, $default = false ) { return array_key_exists( $key, $GLOBALS['fv2_options'] ) ? $GLOBALS['fv2_options'][ $key ] : $default; }
function get_current_user_id() { return $GLOBALS['fv2_user_id']; }
function is_user_logged_in() { return $GLOBALS['fv2_user_id'] > 0; }
function user_can( $user_id, $capability ) { return ! empty( $GLOBALS['fv2_caps'][ (int) $user_id ][ $capability ] ); }
function current_user_can( $capability ) { return user_can( get_current_user_id(), $capability ); }
function sanitize_key( $value ) { return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $value ) ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_textarea_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_file_name( $value ) { return preg_replace( '/[^A-Za-z0-9._-]/', '-', (string) $value ); }
function absint( $value ) { return abs( (int) $value ); }
function rest_sanitize_boolean( $value ) { return filter_var( $value, FILTER_VALIDATE_BOOLEAN ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function register_rest_route( $namespace, $route, $args ) { $GLOBALS['fv2_routes'][ $namespace . $route ] = $args; }
function wp_generate_uuid4() { return '12345678-1234-4234-9234-123456789abc'; }
function get_users( $args = array() ) { return array(); }
function get_user_meta( $user_id, $key, $single = false ) { return ''; }
function current_time( $type ) { return 'timestamp' === $type ? time() : gmdate( 'Y-m-d H:i:s' ); }
function mysql_to_rfc3339( $value ) { return gmdate( 'c', strtotime( $value ) ); }
function has_filter() { return true; }
function home_url() { return 'https://missionmed.test/'; }
function wp_parse_url( $value ) { return parse_url( $value ); }
function wp_verify_nonce( $nonce, $action ) { return 'good-nonce' === $nonce && 'wp_rest' === $action; }

require_once dirname( __DIR__ ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2-repository.php';
require_once dirname( __DIR__ ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php';

$checks = 0;

function fv2_assert( $condition, $message ) {
	global $checks;
	++$checks;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

fv2_assert( 'off' === MMED_File_Vault_V2::get_mode(), 'mode defaults fail closed' );
$GLOBALS['fv2_options'][ MMED_File_Vault_V2::OPTION_MODE ] = 'invalid';
fv2_assert( 'off' === MMED_File_Vault_V2::get_mode(), 'unknown mode fails closed' );

$GLOBALS['fv2_options'][ MMED_File_Vault_V2::OPTION_MODE ] = 'internal';
fv2_assert( ! MMED_File_Vault_V2::is_user_eligible(), 'internal excludes ordinary users' );
$GLOBALS['fv2_caps'][17][ MMED_File_Vault_V2::CAP_MANAGE ] = true;
fv2_assert( MMED_File_Vault_V2::is_user_eligible(), 'internal includes server-authorized admins' );
fv2_assert( 'admin' === MMED_File_Vault_V2::role_for_user(), 'admin role is server-derived' );

$GLOBALS['fv2_caps'][17][ MMED_File_Vault_V2::CAP_MANAGE ] = false;
$GLOBALS['fv2_options'][ MMED_File_Vault_V2::OPTION_MODE ] = 'beta';
$GLOBALS['fv2_options'][ MMED_File_Vault_V2::OPTION_BETA_USERS ] = array( 17, 23 );
fv2_assert( MMED_File_Vault_V2::is_user_eligible(), 'beta includes explicit cohort member' );
$GLOBALS['fv2_user_id'] = 99;
fv2_assert( ! MMED_File_Vault_V2::is_user_eligible(), 'beta excludes users outside explicit cohort' );

$GLOBALS['fv2_user_id'] = 17;
$GLOBALS['fv2_options'][ MMED_File_Vault_V2::OPTION_MODE ] = 'on';
fv2_assert( MMED_File_Vault_V2::is_user_eligible(), 'on includes entitled users' );
$GLOBALS['fv2_caps'][17][ MMED_File_Vault_V2::CAP_REVIEW ] = true;
fv2_assert( 'mentor' === MMED_File_Vault_V2::role_for_user(), 'mentor capability is server-derived' );

fv2_assert( 'other' === MMED_File_Vault_V2_Repository::normalize_document_type( 'not-real' ), 'unknown document type is not trusted' );
fv2_assert( 'personal_statement' === MMED_File_Vault_V2_Repository::normalize_document_type( 'personal_statement' ), 'known document type survives normalization' );
fv2_assert( 'needs_changes' === MMED_File_Vault_V2_Repository::normalize_workflow_status( 'needs_changes' ), 'known workflow status survives normalization' );
fv2_assert( 'rejected' === MMED_File_Vault_V2_Repository::legacy_status( 'needs_changes' ), 'needs changes maps to the legacy rejected database state' );
fv2_assert( 'pending_review' === MMED_File_Vault_V2_Repository::legacy_status( 'submitted' ), 'submitted maps to the legacy pending-review database state' );
fv2_assert( 'verified' === MMED_File_Vault_V2_Repository::legacy_status( 'final' ), 'final maps to the legacy verified database state' );
fv2_assert( 26214400 === MMED_File_Vault_V2_Repository::MAX_FILE_SIZE, 'server owns the 25 MB limit' );
fv2_assert( 153600 === MMED_File_Vault_V2_Repository::APPLICATION_PHOTO_MAX_FILE_SIZE, 'server owns the IMG application photo 150 KB limit' );
fv2_assert( array( 'jpg', 'jpeg' ) === MMED_File_Vault_V2_Repository::upload_contracts()['application_photo']['extensions'], 'application photo contract is JPEG-only' );
fv2_assert( 50 === MMED_File_Vault_V2_Repository::STAFF_PAGE_SIZE && 1000 === MMED_File_Vault_V2_Repository::STAFF_DOCUMENT_LIMIT, 'staff scope has explicit roster and document bounds' );
fv2_assert( 8388608 === MMED_File_Vault_V2_Repository::STAFF_META_BYTES_LIMIT, 'staff scope has an explicit metadata byte ceiling' );
fv2_assert( 200 === MMED_File_Vault_V2_Repository::STAFF_EVENT_PAGE_SIZE && 5000 === MMED_File_Vault_V2_Repository::STAFF_EVENT_LIMIT, 'staff audit scope has explicit page and roster-event bounds' );

$controller_source = file_get_contents( dirname( __DIR__ ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php' );
$repository_source = file_get_contents( dirname( __DIR__ ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2-repository.php' );
fv2_assert( false !== strpos( $controller_source, 'wp_add_inline_script' ), 'eligible V2 users receive a pre-router Matrix access bootstrap' );
fv2_assert( false !== strpos( $controller_source, 'module_permissions.filevault=true' ), 'Matrix access bootstrap opens only the File Vault route' );
fv2_assert( false !== strpos( $controller_source, 'require_verified_current_version' ), 'review workflow rejects unverified legacy bytes' );
fv2_assert( false !== strpos( $repository_source, 'mmed_file_vault_v2_staging_lifecycle_verified' ), 'production storage readiness requires a verified staging lifecycle' );
fv2_assert( false !== strpos( $repository_source, 'release_owned_lock' ), 'confirmation uses an owner-token lock release' );
fv2_assert( false !== strpos( $repository_source, 'mmed_file_vault_v2_requirement_assignments' ), 'requirements come from explicit student assignments' );
fv2_assert( false !== strpos( $controller_source, 'MMED_File_Vault_V2_Repository::staff_scope' ), 'staff bootstrap reuses one bulk roster scope' );
fv2_assert( false !== strpos( $repository_source, 'LIMIT %d' ) && false !== strpos( $repository_source, 'mmed_file_vault_v2_staff_scope_too_large' ), 'staff scope bounds document expansion and fails closed when exceeded' );
fv2_assert( false !== strpos( $repository_source, 'mmed_file_vault_v2_staff_payload_too_large' ) && false !== strpos( $repository_source, 'mmed_file_vault_v2_audit_cursor_invalid' ), 'staff metadata and audit cursors fail closed at their server bounds' );

MMED_File_Vault_V2::register_routes();
fv2_assert( 15 === count( $GLOBALS['fv2_routes'] ), 'expected additive V2 route count' );
fv2_assert( isset( $GLOBALS['fv2_routes']['mmed/v2/file-vault/bootstrap'] ), 'bootstrap route registered' );
fv2_assert( isset( $GLOBALS['fv2_routes']['mmed/v2/file-vault/uploads'] ), 'upload route registered' );
fv2_assert( isset( $GLOBALS['fv2_routes']['mmed/v2/file-vault/review-queue'] ), 'review queue route registered' );
fv2_assert( isset( $GLOBALS['fv2_routes']['mmed/v2/file-vault/uploads/(?P<upload_id>[a-f0-9-]{36})/confirm'] ), 'confirmation route carries an upload UUID, not its one-time token' );
fv2_assert( isset( $GLOBALS['fv2_routes']['mmed/v2/file-vault/files/(?P<id>\d+)/score'] ), 'score route uses numeric legacy IDs' );
foreach ( array_keys( $GLOBALS['fv2_routes'] ) as $route ) {
	fv2_assert( false === strpos( $route, '/mmed/v1/' ), 'V2 does not shadow V1 routes' );
}

$GLOBALS['fv2_options'][ MMED_File_Vault_V2::OPTION_MODE ] = 'off';
$request = new FV2_Request( 'GET', array( 'X-WP-Nonce' => 'good-nonce' ) );
$denied = MMED_File_Vault_V2::can_use_v2( $request );
fv2_assert( is_wp_error( $denied ) && 404 === $denied->get_error_data()['status'], 'off mode hides V2 routes' );
$GLOBALS['fv2_routes'] = array();
MMED_File_Vault_V2::register_routes();
fv2_assert( array() === $GLOBALS['fv2_routes'], 'off mode does not advertise V2 routes' );

$GLOBALS['fv2_options'][ MMED_File_Vault_V2::OPTION_MODE ] = 'on';
$missing_nonce = MMED_File_Vault_V2::can_use_v2( new FV2_Request() );
fv2_assert( is_wp_error( $missing_nonce ) && 403 === $missing_nonce->get_error_data()['status'], 'header REST nonce is mandatory' );
$bad_origin = MMED_File_Vault_V2::can_use_v2( new FV2_Request( 'POST', array( 'X-WP-Nonce' => 'good-nonce', 'Origin' => 'https://evil.test' ) ) );
fv2_assert( is_wp_error( $bad_origin ) && 403 === $bad_origin->get_error_data()['status'], 'mutations require the canonical same origin' );
$GLOBALS['fv2_user_id'] = 99;
$outsider = MMED_File_Vault_V2::can_use_v2( $request );
fv2_assert( is_wp_error( $outsider ) && 404 === $outsider->get_error_data()['status'], 'authenticated but unentitled users cannot discover V2' );
$GLOBALS['fv2_user_id'] = 17;
$GLOBALS['fv2_access'][17] = null;
$unavailable = MMED_File_Vault_V2::can_use_v2( $request );
fv2_assert( is_wp_error( $unavailable ) && 503 === $unavailable->get_error_data()['status'], 'malformed Access Gate data fails closed as unavailable' );

echo "PASS: {$checks} File Vault V2 PHP contract checks\n";
