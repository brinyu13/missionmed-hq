<?php
/**
 * In-memory File Vault V2 repository workflow tests. No network or database use.
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED', true );
define( 'MMED_FILE_VAULT_V2_TESTING', true );

class WP_Error {
	private $code;
	private $message;
	private $data;
	public function __construct( $code, $message, $data = array() ) { $this->code = $code; $this->message = $message; $this->data = $data; }
	public function get_error_code() { return $this->code; }
	public function get_error_data() { return $this->data; }
}

class FV2_Fake_DB {
	public $rows = array();
	public $options = 'wp_options';
	public $insert_id = 0;
	public $get_results_calls = 0;
	public $option_cas_race_value = null;
	public function prepare( $query, ...$args ) { return array( 'query' => $query, 'args' => $args ); }
	public function get_results( $prepared ) {
		++$this->get_results_calls;
		$args = $prepared['args'] ?? array();
		if ( 1 === count( $args ) && is_array( $args[0] ) ) { $args = $args[0]; }
		$user_ids = false !== strpos( $prepared['query'] ?? '', ' IN (' ) ? array_map( 'absint', $args ) : array( absint( $args[0] ?? 0 ) );
		$rows = array_values( array_filter( $this->rows, static function ( $row ) use ( $user_ids ) { return in_array( absint( $row->user_id ), $user_ids, true ); } ) );
		usort( $rows, static function ( $left, $right ) { return $right->id <=> $left->id; } );
		if ( false !== strpos( $prepared['query'] ?? '', 'OCTET_LENGTH(meta_json)' ) ) {
			return array_map( static function ( $row ) {
				return (object) array( 'id' => $row->id, 'user_id' => $row->user_id, 'meta_bytes' => strlen( (string) ( $row->meta_json ?? '' ) ) );
			}, $rows );
		}
		return $rows;
	}
	public function get_var( $prepared ) {
		$user_id = absint( $prepared['args'][0] ?? 0 );
		$total = 0;
		foreach ( $this->rows as $row ) {
			if ( absint( $row->user_id ) === $user_id ) { $total += absint( $row->file_size ?? 0 ); }
		}
		return $total;
	}
	public function insert( $table, $data, $formats = array() ) {
		$id = ++$this->insert_id;
		$data['id'] = $id;
		$data['tags'] = $data['tags'] ?? '';
		$data['reviewed_by'] = $data['reviewed_by'] ?? 0;
		$data['reviewed_at'] = $data['reviewed_at'] ?? null;
		$this->rows[$id] = (object) $data;
		return 1;
	}
	public function update( $table, $data, $where, $formats = array(), $where_formats = array() ) {
		if ( $this->options === $table ) {
			$key = (string) ( $where['option_name'] ?? '' );
			if ( null !== $this->option_cas_race_value ) {
				$GLOBALS['fv2_options'][ $key ] = $this->option_cas_race_value;
				$this->option_cas_race_value = null;
			}
			$current = maybe_serialize( $GLOBALS['fv2_options'][ $key ] ?? null );
			if ( ! array_key_exists( $key, $GLOBALS['fv2_options'] ) || (string) $current !== (string) ( $where['option_value'] ?? '' ) ) {
				return 0;
			}
			$GLOBALS['fv2_options'][ $key ] = maybe_unserialize( $data['option_value'] ?? null );
			return 1;
		}
		$id = absint( $where['id'] ?? 0 );
		if ( ! isset( $this->rows[$id] ) ) { return false; }
		if ( isset( $where['user_id'] ) && absint( $this->rows[$id]->user_id ) !== absint( $where['user_id'] ) ) { return 0; }
		foreach ( array( 'version', 'status', 'meta_json' ) as $key ) {
			if ( array_key_exists( $key, $where ) && (string) ( $this->rows[$id]->{$key} ?? null ) !== (string) $where[$key] ) { return 0; }
		}
		foreach ( $data as $key => $value ) { $this->rows[$id]->{$key} = $value; }
		return 1;
	}
}

$GLOBALS['wpdb'] = new FV2_Fake_DB();
$GLOBALS['fv2_transients'] = array();
$GLOBALS['fv2_users'] = array();
$GLOBALS['fv2_user_meta'] = array(
	10 => array(
		'first_name' => 'Avery',
		'last_name' => 'Rivera',
		'_mmed_primary_division' => 'Mission Residency',
		'_mmed_program_tier' => '360 Elite',
		'_mmed_session_letter' => 'A',
	),
	12 => array(
		'first_name' => 'Jordan',
		'last_name' => 'Lee',
		'_mmed_primary_division' => 'Mission Residency',
		'_mmed_program_tier' => 'Foundation',
		'_mmed_session_letter' => 'B',
	),
	13 => array(
		'first_name' => 'Taylor',
		'last_name' => 'Morgan',
		'_mmed_primary_division' => 'Mission Residency',
		'_mmed_session_letter' => 'C',
	),
);
$GLOBALS['fv2_enrolled_courses'] = array( 13 => array( 901 ) );
$GLOBALS['fv2_course_titles'] = array( 901 => 'Mission Residency: 360 Match Mentorship Student Dashboard &#038; Guidance Hub' );
$GLOBALS['fv2_admins'] = array( 20 => true );
$GLOBALS['fv2_options'] = array(
	'mmed_file_vault_v2_user_quota_bytes' => 104857600,
	'mmed_file_vault_v2_requirement_assignments' => array(
		'10' => array(
			'id'     => 'fixture-application-set',
			'label'  => 'Fixture application document set',
			'source' => 'Deterministic repository contract fixture',
			'types'  => array( 'personal_statement', 'curriculum_vitae', 'mspe' ),
		),
	),
	'mmed_file_vault_v2_rubric' => array(
		'personal_statement' => array( 'Purpose', 'Structure', 'Evidence', 'Voice' ),
	),
	'mmed_file_vault_v2_journey_gates' => array(
		array( 'key' => 'start', 'label' => 'Cycle Start', 'date' => '2026-05-01' ),
		array( 'key' => 'open', 'label' => 'ERAS Opens', 'date' => '2026-06-03' ),
		array( 'key' => 'submit', 'label' => 'Application Submit', 'date' => '2026-09-24' ),
		array( 'key' => 'interviews', 'label' => 'Interview Season', 'date' => '2026-10-15' ),
		array( 'key' => 'rank', 'label' => 'Rank Order List', 'date' => '2027-02-25' ),
		array( 'key' => 'match', 'label' => 'Match Day', 'date' => '2027-03-19' ),
	),
);
$GLOBALS['fv2_uuid'] = 0;

class MMED_File_Vault {
	public static function maybe_install() {}
	public static function table_name() { return 'wp_mmed_files'; }
	protected static function storage_configured() { return true; }
	protected static function sanitize_category( $value, $default ) {
		$allowed = array( 'documents', 'medical_records', 'letters', 'certifications', 'other', 'academic', 'clinical', 'personal', 'admin', 'general' );
		return in_array( $value, $allowed, true ) ? $value : $default;
	}
	protected static function get_file_by_id( $id ) { return $GLOBALS['wpdb']->rows[absint( $id )] ?? null; }
	protected static function get_owned_file( $id, $user_id ) {
		$row = self::get_file_by_id( $id );
		return $row && absint( $row->user_id ) === absint( $user_id ) ? $row : null;
	}
	protected static function student_prefix( $user_id ) { return 'student-files/' . absint( $user_id ) . '/'; }
	protected static function presign_url( $method, $key, $expires ) { return 'https://r2.example.test/' . rawurlencode( $key ) . '?method=' . $method . '&expires=' . absint( $expires ); }
}

function absint( $value ) { return abs( (int) $value ); }
function add_option( $key, $value ) {
	if ( array_key_exists( $key, $GLOBALS['fv2_options'] ) ) { return false; }
	$GLOBALS['fv2_options'][$key] = $value;
	return true;
}
function apply_filters( $name, $value, ...$args ) {
	if ( 'mmed_file_vault_v2_object_probe' === $name ) {
		$intent = $args[0];
		return array( 'size' => absint( $intent['declared_size'] ), 'etag' => 'fixture-etag' );
	}
	if ( 'mmed_file_vault_v2_scan_object' === $name ) {
		return array( 'clean' => true, 'sha256' => $args[0]['declared_sha256'] );
	}
	if ( 'mmed_file_vault_v2_promote_object' === $name ) {
		return array(
			'r2_key' => $args[0]['final_r2_key'],
			'size' => $args[1]['size'],
			'etag' => 'promoted-etag',
			'sha256' => $args[2]['sha256'],
			'verification_state' => 'ready_clean',
		);
	}
	return $value;
}
function current_time( $type ) { return 'timestamp' === $type ? strtotime( '2026-07-15 12:00:00 UTC' ) : '2026-07-15 12:00:00'; }
function delete_transient( $key ) { unset( $GLOBALS['fv2_transients'][$key] ); }
function delete_option( $key ) { unset( $GLOBALS['fv2_options'][$key] ); return true; }
function do_action() {}
function esc_attr( $value ) { return $value; }
function get_option( $key, $default = false ) { return $GLOBALS['fv2_options'][$key] ?? $default; }
function get_transient( $key ) { return $GLOBALS['fv2_transients'][$key] ?? false; }
function get_user_by( $field, $id ) { return (object) array( 'ID' => absint( $id ), 'display_name' => 20 === absint( $id ) ? 'MissionMed Reviewer' : 'Student Fixture' ); }
function get_users( $args = array() ) {
	$users = $GLOBALS['fv2_users'];
	if ( ! empty( $args['meta_key'] ) ) {
		$users = array_values( array_filter( $users, static function ( $user ) use ( $args ) {
			return (string) ( $GLOBALS['fv2_user_meta'][ $user->ID ][ $args['meta_key'] ] ?? '' ) === (string) ( $args['meta_value'] ?? '' );
		} ) );
	}
	$offset = absint( $args['offset'] ?? 0 );
	$number = isset( $args['number'] ) ? (int) $args['number'] : count( $users );
	return $number < 0 ? array_slice( $users, $offset ) : array_slice( $users, $offset, $number );
}
function get_user_meta( $user_id, $key, $single = false ) { return $GLOBALS['fv2_user_meta'][ absint( $user_id ) ][ $key ] ?? ''; }
function get_the_title( $course_id ) { return $GLOBALS['fv2_course_titles'][ absint( $course_id ) ] ?? ''; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function learndash_user_get_enrolled_courses( $user_id ) { return $GLOBALS['fv2_enrolled_courses'][ absint( $user_id ) ] ?? array(); }
function maybe_serialize( $value ) { return is_array( $value ) || is_object( $value ) ? serialize( $value ) : $value; }
function maybe_unserialize( $value ) { return is_string( $value ) && preg_match( '/^[aObisdN]:/', $value ) ? unserialize( $value ) : $value; }
function mysql_to_rfc3339( $value ) { return gmdate( 'c', strtotime( $value . ' UTC' ) ); }
function rest_sanitize_boolean( $value ) { return filter_var( $value, FILTER_VALIDATE_BOOLEAN ); }
function sanitize_file_name( $value ) { return preg_replace( '/[^A-Za-z0-9._-]/', '-', (string) $value ); }
function sanitize_key( $value ) { return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $value ) ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_textarea_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function set_transient( $key, $value, $ttl ) {
	if ( ! empty( $GLOBALS['fv2_fail_transient'] ) && $GLOBALS['fv2_fail_transient'] === $key ) { return false; }
	$GLOBALS['fv2_transients'][$key] = $value;
	return true;
}
function user_can( $user_id, $capability ) { return 'mmed_manage_file_vault' === $capability && ! empty( $GLOBALS['fv2_admins'][ absint( $user_id ) ] ); }
function wp_generate_uuid4() { return sprintf( '00000000-0000-4000-8000-%012d', ++$GLOBALS['fv2_uuid'] ); }
function wp_json_encode( $value ) { return json_encode( $value, JSON_UNESCAPED_SLASHES ); }

require_once dirname( __DIR__ ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2-repository.php';

$checks = 0;
function fv2_repo_assert( $condition, $message ) {
	global $checks;
	++$checks;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

$missing_checksum = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'draft.pdf', 'mime_type' => 'application/pdf', 'file_size' => 10 ) );
fv2_repo_assert( is_wp_error( $missing_checksum ) && 'mmed_file_vault_v2_checksum' === $missing_checksum->get_error_code(), 'upload requires a browser SHA-256 checksum' );
$unsafe_type = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'draft.rtf', 'mime_type' => 'application/rtf', 'file_size' => 10, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $unsafe_type ) && 'mmed_file_vault_v2_file_type' === $unsafe_type->get_error_code(), 'only the approved PDF, DOCX, and PNG types are accepted' );
$double_extension = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'draft.pdf.png', 'mime_type' => 'image/png', 'file_size' => 10, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $double_extension ) && 'mmed_file_vault_v2_file_name' === $double_extension->get_error_code(), 'double-extension filenames are rejected' );
$oversized = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'draft.pdf', 'mime_type' => 'application/pdf', 'file_size' => MMED_File_Vault_V2_Repository::MAX_FILE_SIZE + 1, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $oversized ) && 413 === $oversized->get_error_data()['status'], '25 MB limit is enforced before signing' );
$photo_png = MMED_File_Vault_V2_Repository::create_upload_intent( 12, 12, array( 'filename' => 'photo.png', 'mime_type' => 'image/png', 'file_size' => 100, 'document_type' => 'application_photo', 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $photo_png ) && 'mmed_file_vault_v2_file_type' === $photo_png->get_error_code(), 'IMG application photos reject PNG despite the default document allowlist' );
$photo_oversized = MMED_File_Vault_V2_Repository::create_upload_intent( 12, 12, array( 'filename' => 'photo.jpg', 'mime_type' => 'image/jpeg', 'file_size' => MMED_File_Vault_V2_Repository::APPLICATION_PHOTO_MAX_FILE_SIZE + 1, 'document_type' => 'application_photo', 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $photo_oversized ) && 413 === $photo_oversized->get_error_data()['status'], 'IMG application photos enforce the 150 KB cap before signing' );
$default_jpeg = MMED_File_Vault_V2_Repository::create_upload_intent( 12, 12, array( 'filename' => 'document.jpg', 'mime_type' => 'image/jpeg', 'file_size' => 100, 'document_type' => 'other', 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $default_jpeg ) && 'mmed_file_vault_v2_file_type' === $default_jpeg->get_error_code(), 'JPEG does not widen the ordinary document contract' );
$photo_intent = MMED_File_Vault_V2_Repository::create_upload_intent( 12, 12, array( 'filename' => 'photo.jpeg', 'mime_type' => 'image/jpeg', 'file_size' => 153600, 'document_type' => 'application_photo', 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( ! is_wp_error( $photo_intent ) && 153600 === $photo_intent['max_size'], 'valid IMG JPEG application photo receives its type-specific signed-upload contract' );
$long_display_name = MMED_File_Vault_V2_Repository::create_upload_intent( 12, 12, array( 'filename' => 'draft.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100, 'display_name' => str_repeat( 'x', MMED_File_Vault_V2_Repository::DISPLAY_NAME_LENGTH_LIMIT + 1 ), 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $long_display_name ) && 'mmed_file_vault_v2_display_name_invalid' === $long_display_name->get_error_code(), 'oversized display names are rejected before signing' );
$long_upload_note = MMED_File_Vault_V2_Repository::create_upload_intent( 12, 12, array( 'filename' => 'draft.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100, 'note' => str_repeat( 'x', MMED_File_Vault_V2_Repository::NOTE_LENGTH_LIMIT + 1 ), 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $long_upload_note ) && 'mmed_file_vault_v2_note_invalid' === $long_upload_note->get_error_code(), 'oversized upload notes are rejected before signing' );
$GLOBALS['fv2_transients']['mmed_fv2_pending_10'] = array_fill( 0, 5, array( 'upload_id' => 'pending', 'size' => 1, 'expires_at' => strtotime( '2026-07-15 12:10:00 UTC' ) ) );
$pending_limited = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'draft.pdf', 'mime_type' => 'application/pdf', 'file_size' => 10, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $pending_limited ) && 429 === $pending_limited->get_error_data()['status'], 'five pending uploads block further issuance' );
unset( $GLOBALS['fv2_transients']['mmed_fv2_pending_10'] );
$GLOBALS['fv2_options']['mmed_file_vault_v2_user_quota_bytes'] = 100;
$quota_limited = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'draft.pdf', 'mime_type' => 'application/pdf', 'file_size' => 101, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $quota_limited ) && 'mmed_file_vault_v2_quota_exceeded' === $quota_limited->get_error_code(), 'server-configured owner quota is enforced' );
$GLOBALS['fv2_options']['mmed_file_vault_v2_user_quota_bytes'] = 104857600;

$intent = MMED_File_Vault_V2_Repository::create_upload_intent(
	10,
	10,
	array(
		'filename' => 'personal-statement.docx',
		'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'file_size' => 123,
		'document_type' => 'personal_statement',
		'display_name' => 'Client Controlled Wrong Name',
		'note' => 'First complete draft.',
		'sha256' => str_repeat( 'a', 64 ),
	)
);
fv2_repo_assert( ! is_wp_error( $intent ), 'new upload intent created' );
fv2_repo_assert( 'Avery_Rivera_360MatchMentorship_A_PersonalStatement_Version01_' . gmdate( 'Y-m-d' ) . '.docx' === $intent['canonical_name'], 'canonical filename is deterministic and server-generated from authoritative account metadata' );
$encoded_course_context = MMED_File_Vault_V2_Repository::upload_context( 13 );
fv2_repo_assert( '360 Match Mentorship' === $encoded_course_context['program'] && MMED_File_Vault_V2_Repository::approved_programs() === $encoded_course_context['programs'], 'historical enrollment labels map to the approved upload program vocabulary' );
$encoded_course_intent = MMED_File_Vault_V2_Repository::create_upload_intent(
	13,
	13,
	array(
		'filename' => 'course-title.pdf',
		'mime_type' => 'application/pdf',
		'file_size' => 100,
		'document_type' => 'other',
		'display_name' => 'Course Title Check',
		'sha256' => str_repeat( 'b', 64 ),
	)
);
fv2_repo_assert( ! is_wp_error( $encoded_course_intent ) && false === strpos( $encoded_course_intent['canonical_name'], '038' ), 'decoded course titles cannot leak numeric entity text into canonical filenames' );
$internal_intent = $GLOBALS['fv2_transients']['mmed_fv2_intent_' . $intent['upload_id']];
fv2_repo_assert( 'Personal Statement' === $internal_intent['display_name'], 'standard document names are canonicalized server-side instead of trusting the client display name' );
fv2_repo_assert( 0 === strpos( $internal_intent['r2_key'], 'student-files/v2/staging/' ) && 0 === strpos( $internal_intent['final_r2_key'], 'student-files/v2/objects/' ), 'uploads use private V2 staging and immutable object prefixes' );

$GLOBALS['fv2_fail_transient'] = 'mmed_fv2_done_' . $intent['upload_id'];
$document = MMED_File_Vault_V2_Repository::confirm_upload_intent( $intent['upload_id'], $intent['confirm_token'], 10 );
unset( $GLOBALS['fv2_fail_transient'] );
fv2_repo_assert( ! is_wp_error( $document ) && 1 === $document['id'], 'upload finalizes a document' );
fv2_repo_assert( 'Personal Statement' === $document['name'], 'canonical standard document name persists after confirmation' );
fv2_repo_assert( 'draft' === $document['status'] && 1 === $document['version'], 'initial workflow state and version are truthful' );
fv2_repo_assert( '360 Match Mentorship' === $document['program'] && 'A' === $document['session_letter'] && 'Version01' === $document['versions'][0]['draft_label'] && false === $document['versions'][0]['is_final'], 'canonical program, session, and version metadata persist with the document' );
fv2_repo_assert( MMED_File_Vault_V2_Repository::current_version_verified( 1 ), 'confirmed V2 document has a verified current version' );
fv2_repo_assert( false === strpos( json_encode( $document ), 'r2_key' ) && false === strpos( json_encode( $document ), 'student-files/' ), 'object keys are scrubbed from public responses' );
fv2_repo_assert( 'completed' === $GLOBALS['fv2_transients']['mmed_fv2_intent_' . $intent['upload_id']]['state'], 'failed primary completion receipt falls back to a checked completed intent receipt' );

$duplicate = MMED_File_Vault_V2_Repository::confirm_upload_intent( $intent['upload_id'], $intent['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $duplicate ) && 1 === $duplicate['id'], 'upload confirmation is idempotent' );
$cross_actor_replay = MMED_File_Vault_V2_Repository::confirm_upload_intent( $intent['upload_id'], $intent['confirm_token'], 20 );
fv2_repo_assert( is_wp_error( $cross_actor_replay ) && 404 === $cross_actor_replay->get_error_data()['status'], 'completed upload replay is scoped to the issuing actor' );
$demoted_upload_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$demoted_token     = str_repeat( 'f', 64 );
$GLOBALS['fv2_transients']['mmed_fv2_done_' . $demoted_upload_id] = array(
	'file_id'    => 1,
	'actor_id'   => 20,
	'user_id'    => 10,
	'token_hash' => hash( 'sha256', $demoted_token ),
);
$GLOBALS['fv2_admins'][20] = false;
$demoted_replay = MMED_File_Vault_V2_Repository::confirm_upload_intent( $demoted_upload_id, $demoted_token, 20 );
fv2_repo_assert( is_wp_error( $demoted_replay ) && 403 === $demoted_replay->get_error_data()['status'], 'completed staff upload replay revalidates current cross-owner capability' );
$GLOBALS['fv2_admins'][20] = true;

$comment = MMED_File_Vault_V2_Repository::add_comment( 1, 10, 'student', 'Please review the new opening.' );
fv2_repo_assert( ! is_wp_error( $comment ) && 1 === $comment['version'], 'comment is bound to the current version' );
fv2_repo_assert( ! isset( $comment['author_id'] ), 'comment response does not expose internal actor IDs' );
$GLOBALS['fv2_transients']['mmed_fv2_comment_rate_1_10'] = array_fill( 0, MMED_File_Vault_V2_Repository::COMMENT_RATE_LIMIT, time() );
$comment_rate_limited = MMED_File_Vault_V2_Repository::add_comment( 1, 10, 'student', 'This comment must be rate limited.' );
fv2_repo_assert( is_wp_error( $comment_rate_limited ) && 429 === $comment_rate_limited->get_error_data()['status'], 'comment write amplification is rate limited per actor and document' );
unset( $GLOBALS['fv2_transients']['mmed_fv2_comment_rate_1_10'] );
$resolved = MMED_File_Vault_V2_Repository::resolve_comment( 1, $comment['id'], 20 );
fv2_repo_assert( ! is_wp_error( $resolved ) && true === $resolved['resolved'], 'comment resolution persists' );
$internal_note = MMED_File_Vault_V2_Repository::add_internal_note( 1, 20, 'Confirm final review ownership before approval.' );
fv2_repo_assert( ! is_wp_error( $internal_note ) && ! isset( $internal_note['author_id'] ) && 'MissionMed Reviewer' === $internal_note['author_name'], 'staff internal note persists without exposing its actor ID' );
$internal_notes = MMED_File_Vault_V2_Repository::internal_notes( 1 );
fv2_repo_assert( 1 === count( $internal_notes ) && $internal_note['id'] === $internal_notes[0]['id'], 'staff internal notes return through their dedicated collection' );
fv2_repo_assert( ! array_key_exists( 'internal_notes', MMED_File_Vault_V2_Repository::get_document( 1 ) ), 'public document responses exclude the internal-note collection' );

$submitted = MMED_File_Vault_V2_Repository::update_status( 1, 'submitted', 10 );
fv2_repo_assert( 'submitted' === $submitted['status'], 'owner submit transition persists' );
$reviewing = MMED_File_Vault_V2_Repository::update_status( 1, 'in_review', 20 );
fv2_repo_assert( 'in_review' === $reviewing['status'], 'staff review transition persists' );

$valid_rubrics = $GLOBALS['fv2_options']['mmed_file_vault_v2_rubric'];
$GLOBALS['fv2_options']['mmed_file_vault_v2_rubric']['personal_statement'] = array( 'Clarity', 'Clarity!' );
$colliding_rubric = MMED_File_Vault_V2_Repository::add_score( 1, 20, array( 'category_scores' => array( 'clarity' => 8 ) ) );
fv2_repo_assert( is_wp_error( $colliding_rubric ) && 'mmed_file_vault_v2_rubric_unavailable' === $colliding_rubric->get_error_code(), 'colliding rubric keys fail closed' );
$GLOBALS['fv2_options']['mmed_file_vault_v2_rubric'] = $valid_rubrics;

$categories = array( 'purpose' => 8, 'structure' => 8, 'evidence' => 8, 'voice' => 8 );
$long_score_note = MMED_File_Vault_V2_Repository::add_score( 1, 20, array( 'category_scores' => $categories, 'notes' => str_repeat( 'x', MMED_File_Vault_V2_Repository::NOTE_LENGTH_LIMIT + 1 ) ) );
fv2_repo_assert( is_wp_error( $long_score_note ) && 'mmed_file_vault_v2_score_note_invalid' === $long_score_note->get_error_code(), 'oversized score notes are rejected before persistence' );
$score = MMED_File_Vault_V2_Repository::add_score( 1, 20, array( 'total_score' => 82, 'category_scores' => $categories, 'notes' => 'Revision reviewed.' ) );
fv2_repo_assert( ! is_wp_error( $score ) && 1 === $score['version'], 'score is version-bound' );
fv2_repo_assert( 32 === $score['total_score'] && 40 === $score['max_score'] && 4 === count( $score['category_scores'] ) && 'Score recorded' === $score['readiness_label'], 'server computes a neutral score and denominator from the document-scoped rubric' );
$needs = MMED_File_Vault_V2_Repository::update_status( 1, 'needs_changes', 20, 'Tighten the close.' );
fv2_repo_assert( 'needs_changes' === $needs['status'], 'needs-changes verdict persists' );
$long_review_note = MMED_File_Vault_V2_Repository::update_status( 1, 'needs_changes', 20, str_repeat( 'x', MMED_File_Vault_V2_Repository::NOTE_LENGTH_LIMIT + 1 ) );
fv2_repo_assert( is_wp_error( $long_review_note ) && 'mmed_file_vault_v2_review_note_invalid' === $long_review_note->get_error_code(), 'oversized review notes are rejected before persistence' );

$invalid_program = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'invalid-program.docx', 'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file_size' => 64, 'program' => 'Unapproved Program', 'session_letter' => 'A', 'version_number' => 2, 'sha256' => str_repeat( 'e', 64 ) ), 1 );
fv2_repo_assert( is_wp_error( $invalid_program ) && 'mmed_file_vault_v2_program_invalid' === $invalid_program->get_error_code(), 'upload program metadata fails closed outside the Founder-approved vocabulary' );
$invalid_session = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'invalid-session.docx', 'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file_size' => 64, 'program' => '360 Match Mentorship', 'session_letter' => 'H', 'version_number' => 2, 'sha256' => str_repeat( 'e', 64 ) ), 1 );
fv2_repo_assert( is_wp_error( $invalid_session ) && 'mmed_file_vault_v2_session_required' === $invalid_session->get_error_code(), 'upload session metadata fails closed outside A through G' );
$invalid_version = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'invalid-version.docx', 'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file_size' => 64, 'program' => '360 Match Mentorship', 'session_letter' => 'A', 'version_number' => 9, 'sha256' => str_repeat( 'e', 64 ) ), 1 );
fv2_repo_assert( is_wp_error( $invalid_version ) && 'mmed_file_vault_v2_version_invalid' === $invalid_version->get_error_code(), 'upload cannot skip the server-assigned next immutable version' );

$version_intent = MMED_File_Vault_V2_Repository::create_upload_intent(
	10,
	10,
	array(
		'filename' => 'personal-statement-v2.docx',
		'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'file_size' => 222,
		'note' => 'Reworked closing paragraph.',
		'ready_for_review' => true,
		'draft_label' => 'Version02',
		'version_number' => 2,
		'is_final' => true,
		'program' => 'PS-Only',
		'session_letter' => 'G',
		'sha256' => str_repeat( 'b', 64 ),
	),
	1
);
$versioned = MMED_File_Vault_V2_Repository::confirm_upload_intent( $version_intent['upload_id'], $version_intent['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $versioned ) && 2 === $versioned['version'] && 2 === count( $versioned['versions'] ), 'new upload creates immutable version history' );
fv2_repo_assert( 'Avery_Rivera_PSOnly_G_PersonalStatement_Version02_' . gmdate( 'Y-m-d' ) . '.docx' === $versioned['canonical_name'] && 'Version02' === $versioned['versions'][1]['draft_label'] && true === $versioned['versions'][1]['is_final'], 'replacement upload keeps selected metadata, a numbered immutable version, and a separate Final marker' );
$invalid_draft_label = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'invalid-label.docx', 'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file_size' => 64, 'draft_label' => 'Draft99', 'sha256' => str_repeat( 'e', 64 ) ), 1 );
fv2_repo_assert( is_wp_error( $invalid_draft_label ) && 'mmed_file_vault_v2_draft_label_invalid' === $invalid_draft_label->get_error_code(), 'server rejects a draft label that does not match the next immutable version' );
fv2_repo_assert( 'submitted' === $versioned['status'], 'version can submit for review at confirmation' );
fv2_repo_assert( 32 === $versioned['versions'][0]['score'] && 40 === $versioned['versions'][0]['score_max'], 'historical score and denominator remain attached to their version' );

$GLOBALS['fv2_options']['mmed_file_vault_v2_user_quota_bytes'] = 400;
$version_quota = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'quota.pdf', 'mime_type' => 'application/pdf', 'file_size' => 60, 'sha256' => str_repeat( 'e', 64 ) ), 1 );
fv2_repo_assert( is_wp_error( $version_quota ) && 'mmed_file_vault_v2_quota_exceeded' === $version_quota->get_error_code(), 'quota counts every retained immutable version' );
$GLOBALS['fv2_options']['mmed_file_vault_v2_user_quota_bytes'] = 104857600;

$parallel_a = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'a.pdf', 'mime_type' => 'application/pdf', 'file_size' => 300, 'sha256' => str_repeat( 'c', 64 ) ), 1 );
$parallel_b = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'b.pdf', 'mime_type' => 'application/pdf', 'file_size' => 301, 'sha256' => str_repeat( 'd', 64 ) ), 1 );
fv2_repo_assert( ! is_wp_error( $parallel_a ) && 3 === $parallel_a['version'], 'first version intent reserves the next server-owned version' );
fv2_repo_assert( is_wp_error( $parallel_b ) && 'mmed_file_vault_v2_lineage_busy' === $parallel_b->get_error_code(), 'a second simultaneous intent cannot receive the same next version' );
$parallel_lock_key = 'mmed_fv2_confirm_owner_10';
$GLOBALS['fv2_options'][$parallel_lock_key] = array( 'token' => 'another-worker', 'expires' => time() + 1200 );
$parallel_busy = MMED_File_Vault_V2_Repository::confirm_upload_intent( $parallel_a['upload_id'], $parallel_a['confirm_token'], 10 );
fv2_repo_assert( is_wp_error( $parallel_busy ) && 'mmed_file_vault_v2_confirm_in_progress' === $parallel_busy->get_error_code(), 'simultaneous confirmation is rejected by a token-owned atomic lock' );
unset( $GLOBALS['fv2_options'][$parallel_lock_key] );
$parallel_first = MMED_File_Vault_V2_Repository::confirm_upload_intent( $parallel_a['upload_id'], $parallel_a['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $parallel_first ) && 3 === $parallel_first['version'], 'reserved version finalizes under the owner confirmation lock' );
$parallel_followup = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'b.pdf', 'mime_type' => 'application/pdf', 'file_size' => 301, 'sha256' => str_repeat( 'd', 64 ) ), 1 );
fv2_repo_assert( ! is_wp_error( $parallel_followup ) && 4 === $parallel_followup['version'], 'the next intent receives a new number after the prior reservation is confirmed' );
$parallel_second = MMED_File_Vault_V2_Repository::confirm_upload_intent( $parallel_followup['upload_id'], $parallel_followup['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $parallel_second ) && 4 === $parallel_second['version'] && ! isset( $GLOBALS['fv2_options'][$parallel_lock_key] ), 'sequential reservation confirms without leaving the owner lock behind' );

$GLOBALS['fv2_fail_transient'] = 'mmed_fv2_activity_download_issued_1_10';
$audit_unavailable = MMED_File_Vault_V2_Repository::download( 1, 1, 10 );
fv2_repo_assert( is_wp_error( $audit_unavailable ) && 'mmed_file_vault_v2_audit_unavailable' === $audit_unavailable->get_error_code(), 'signed downloads fail closed when their audit reservation is unavailable' );
unset( $GLOBALS['fv2_fail_transient'] );
$download = MMED_File_Vault_V2_Repository::download( 1, 1, 10 );
fv2_repo_assert( ! is_wp_error( $download ) && 1 === $download['version'] && 60 === $download['expires'], 'historical version gets a short-lived signed download' );
$activity_after_download = count( MMED_File_Vault_V2_Repository::get_document( 1 )['activity'] );
$repeat_download = MMED_File_Vault_V2_Repository::download( 1, 1, 10 );
fv2_repo_assert( ! is_wp_error( $repeat_download ) && $activity_after_download === count( MMED_File_Vault_V2_Repository::get_document( 1 )['activity'] ), 'repeated downloads inside the throttle window do not amplify metadata activity' );
$final = MMED_File_Vault_V2_Repository::get_document( 1 );
fv2_repo_assert( count( $final['activity'] ) >= 7, 'mutations produce real activity evidence' );

$bootstrap = MMED_File_Vault_V2_Repository::bootstrap( 10, 'student' );
fv2_repo_assert( 6 === count( $bootstrap['journey']['gates'] ) && 'server_configuration' === $bootstrap['journey']['gate_source'], 'Journey uses server-configured gates' );
fv2_repo_assert( 3 === $bootstrap['journey']['total_count'], 'Journey exposes only the assigned student requirement set' );
fv2_repo_assert( 'fixture-application-set' === $bootstrap['journey']['requirement_set']['id'] && 'Deterministic repository contract fixture' === $bootstrap['journey']['requirement_set']['source'], 'Journey exposes requirement-set identity and provenance' );
fv2_repo_assert( 'upload' === $bootstrap['next_action']['kind'], 'next action is computed from missing server requirements' );
fv2_repo_assert( 'CV / Resume' === $bootstrap['document_types']['curriculum_vitae'] && 'LOR-Related' === $bootstrap['document_types']['lor_related'] && 'Score Report' === $bootstrap['document_types']['score_report'] && 'Certification' === $bootstrap['document_types']['certification'], 'Founder upload vocabulary is server-owned without removing granular document types' );
fv2_repo_assert( 4 === count( $bootstrap['rubrics']['personal_statement'] ) && ! isset( $bootstrap['rubrics']['medical_school_transcript'] ), 'only valid document-scoped rubrics are exposed' );

$GLOBALS['wpdb']->insert(
	'wp_mmed_files',
	array(
		'user_id' => 11,
		'filename' => 'legacy.pdf',
		'original_name' => 'legacy.pdf',
		'r2_key' => 'student-files/11/documents/legacy.pdf',
		'mime_type' => 'application/pdf',
		'file_size' => 99,
		'category' => 'documents',
		'version' => 1,
		'status' => 'verified',
		'meta_json' => null,
		'created_at' => '2026-01-01 00:00:00',
		'updated_at' => '2026-01-02 00:00:00',
	)
);
$legacy = MMED_File_Vault_V2_Repository::get_document( 2 );
fv2_repo_assert( 'reviewed' === $legacy['status'], 'legacy status is mapped instead of being mislabeled draft' );
fv2_repo_assert( false === $legacy['download_available'], 'legacy unverified objects do not receive a V2 signed download' );
fv2_repo_assert( 'legacy.pdf' === $legacy['name'] && 'Legacy File Vault' === $legacy['versions'][0]['uploader_name'], 'legacy provenance is labeled without inventing a document type or uploader' );
fv2_repo_assert( ! MMED_File_Vault_V2_Repository::current_version_verified( 2 ), 'legacy bytes cannot enter trusted V2 workflow without a verified version' );
$unassigned = MMED_File_Vault_V2_Repository::bootstrap( 11, 'student' );
fv2_repo_assert( 0 === $unassigned['journey']['total_count'] && '' === $unassigned['journey']['requirement_set']['source'], 'unassigned students do not inherit a global requirement list' );

$GLOBALS['fv2_users'] = array(
	(object) array( 'ID' => 10, 'display_name' => 'Student Fixture' ),
	(object) array( 'ID' => 11, 'display_name' => 'Legacy Fixture' ),
);
$query_count = $GLOBALS['wpdb']->get_results_calls;
$staff_scope = MMED_File_Vault_V2_Repository::staff_scope( 'admin', 20 );
fv2_repo_assert( 2 === count( $staff_scope['students'] ) && 2 === $GLOBALS['wpdb']->get_results_calls - $query_count, 'staff roster uses one metadata-size preflight and one bounded bulk document query without per-student reads' );
$null_pagination = MMED_File_Vault_V2_Repository::staff_scope( 'admin', 20, '', null, null );
fv2_repo_assert( 50 === $null_pagination['pagination']['per_page'], 'omitted REST pagination values retain the bounded server default' );
$first_roster_page = MMED_File_Vault_V2_Repository::staff_scope( 'admin', 20, '', 1, 1 );
$second_roster_page = MMED_File_Vault_V2_Repository::staff_scope( 'admin', 20, '', 2, 1 );
fv2_repo_assert( 10 === $first_roster_page['students'][0]['id'] && true === $first_roster_page['pagination']['has_more'] && 2 === $first_roster_page['pagination']['next_page'], 'staff roster exposes an honest bounded first page' );
fv2_repo_assert( 11 === $second_roster_page['students'][0]['id'] && false === $second_roster_page['pagination']['has_more'] && true === $second_roster_page['pagination']['scope_complete'], 'staff roster reaches the final authorized page without truncation' );
$saved_rows = $GLOBALS['wpdb']->rows;
$GLOBALS['wpdb']->rows = array();
for ( $index = 1; $index <= MMED_File_Vault_V2_Repository::STAFF_DOCUMENT_LIMIT + 1; ++$index ) {
	$GLOBALS['wpdb']->rows[$index] = (object) array( 'id' => $index, 'user_id' => 10 );
}
$oversized_staff_scope = MMED_File_Vault_V2_Repository::staff_scope( 'admin', 20, '', 1, 1 );
fv2_repo_assert( is_wp_error( $oversized_staff_scope ) && 'mmed_file_vault_v2_staff_scope_too_large' === $oversized_staff_scope->get_error_code(), 'staff document expansion fails closed instead of returning a truncated queue' );

$GLOBALS['wpdb']->rows = array();
for ( $index = 1; $index <= MMED_File_Vault_V2_Repository::OWNER_DOCUMENT_LIMIT + 1; ++$index ) {
	$GLOBALS['wpdb']->rows[ $index ] = (object) array( 'id' => $index, 'user_id' => 10, 'meta_json' => '{}' );
}
$oversized_owner_scope = MMED_File_Vault_V2_Repository::list_documents( 10 );
fv2_repo_assert( is_wp_error( $oversized_owner_scope ) && 'mmed_file_vault_v2_owner_scope_too_large' === $oversized_owner_scope->get_error_code(), 'student document expansion fails closed above the per-owner document limit' );
$oversized_owner_bootstrap = MMED_File_Vault_V2_Repository::bootstrap( 10, 'student' );
fv2_repo_assert( is_wp_error( $oversized_owner_bootstrap ) && 'mmed_file_vault_v2_owner_scope_too_large' === $oversized_owner_bootstrap->get_error_code(), 'student bootstrap propagates an oversized owner scope without expanding it' );

array_pop( $GLOBALS['wpdb']->rows );
$owner_document_limited = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'limit.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $owner_document_limited ) && 'mmed_file_vault_v2_owner_document_limit' === $owner_document_limited->get_error_code(), 'new upload issuance fails before signing when an owner has reached the document limit' );
$legacy_document_limited = MMED_File_Vault_V2_Repository::begin_legacy_upload( 10 );
fv2_repo_assert( is_wp_error( $legacy_document_limited ) && 'mmed_file_vault_v2_owner_document_limit' === $legacy_document_limited->get_error_code(), 'legacy upload issuance cannot bypass the shared owner document limit' );

$GLOBALS['wpdb']->rows = array();
$aggregate_row_bytes = 220000;
for ( $index = 1; $index <= 20; ++$index ) {
	$GLOBALS['wpdb']->rows[ $index ] = (object) array( 'id' => $index, 'user_id' => 10, 'meta_json' => str_repeat( 'x', $aggregate_row_bytes ) );
}
$oversized_owner_payload = MMED_File_Vault_V2_Repository::list_documents( 10 );
fv2_repo_assert( is_wp_error( $oversized_owner_payload ) && 'mmed_file_vault_v2_owner_payload_too_large' === $oversized_owner_payload->get_error_code(), 'student reads fail before loading bodies when aggregate owner metadata exceeds four MiB' );
$owner_metadata_limited = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'aggregate.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $owner_metadata_limited ) && 'mmed_file_vault_v2_owner_metadata_limit' === $owner_metadata_limited->get_error_code(), 'new upload issuance fails before signing when aggregate owner metadata is exhausted' );

$GLOBALS['wpdb']->rows = array();
$remaining_meta_bytes = MMED_File_Vault_V2_Repository::OWNER_META_BYTES_LIMIT - 512;
for ( $index = 1; $index <= 18; ++$index ) {
	$row_bytes = 18 === $index ? $remaining_meta_bytes : intdiv( MMED_File_Vault_V2_Repository::OWNER_META_BYTES_LIMIT - 512, 18 );
	$remaining_meta_bytes -= $row_bytes;
	$GLOBALS['wpdb']->rows[ $index ] = (object) array( 'id' => $index, 'user_id' => 10, 'meta_json' => str_repeat( 'x', $row_bytes ) );
}
$projected_metadata_limited = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'projected.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100, 'sha256' => str_repeat( 'a', 64 ) ) );
fv2_repo_assert( is_wp_error( $projected_metadata_limited ) && 'mmed_file_vault_v2_owner_metadata_limit' === $projected_metadata_limited->get_error_code(), 'upload issuance projects confirmation metadata and rejects a near-limit owner before signing' );

$GLOBALS['wpdb']->rows = $saved_rows;
$bounded_owner_documents = MMED_File_Vault_V2_Repository::list_documents( 10 );
fv2_repo_assert( ! is_wp_error( $bounded_owner_documents ) && 1 === count( $bounded_owner_documents ), 'bounded owner scope still returns its complete document list' );
$GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'] = array( 'token' => 'another-owner-write', 'expires' => time() + 120 );
unset( $GLOBALS['fv2_transients']['mmed_fv2_comment_rate_1_10'] );
$parallel_owner_write = MMED_File_Vault_V2_Repository::add_comment( 1, 10, 'student', 'This write must wait for the owner lock.' );
fv2_repo_assert( is_wp_error( $parallel_owner_write ) && 'mmed_file_vault_v2_owner_write_in_progress' === $parallel_owner_write->get_error_code(), 'cross-document aggregate checks are serialized by the token-owned owner mutation lock' );
unset( $GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'], $GLOBALS['fv2_transients']['mmed_fv2_comment_rate_1_10'] );
$GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'] = array( 'token' => 'expired-owner', 'expires' => time() - 1 );
$recovered_lock_token = MMED_File_Vault_V2_Repository::begin_legacy_upload( 10 );
fv2_repo_assert( is_string( $recovered_lock_token ) && 'expired-owner' !== $GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10']['token'], 'expired owner lock is replaced by one exact atomic compare-and-swap' );
MMED_File_Vault_V2_Repository::end_legacy_upload( 10, $recovered_lock_token );
$GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'] = array( 'token' => 'expired-race', 'expires' => time() - 1 );
$GLOBALS['wpdb']->option_cas_race_value = array( 'token' => 'winning-worker', 'expires' => time() + 120 );
$lost_lock_race = MMED_File_Vault_V2_Repository::begin_legacy_upload( 10 );
fv2_repo_assert( is_wp_error( $lost_lock_race ) && 'mmed_file_vault_v2_owner_write_in_progress' === $lost_lock_race->get_error_code() && 'winning-worker' === $GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10']['token'], 'expired-lock takeover cannot delete or overwrite a competing winner' );
unset( $GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'] );
$legacy_lock_token = MMED_File_Vault_V2_Repository::begin_legacy_upload( 10 );
fv2_repo_assert( is_string( $legacy_lock_token ) && '' !== $legacy_lock_token && isset( $GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'] ), 'legacy upload reserves the shared token-owned owner mutation lock' );
$parallel_legacy_upload = MMED_File_Vault_V2_Repository::begin_legacy_upload( 10 );
fv2_repo_assert( is_wp_error( $parallel_legacy_upload ) && 'mmed_file_vault_v2_owner_write_in_progress' === $parallel_legacy_upload->get_error_code(), 'parallel legacy upload issuance cannot race the shared owner limit' );
fv2_repo_assert( MMED_File_Vault_V2_Repository::end_legacy_upload( 10, $legacy_lock_token ) && ! isset( $GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'] ), 'legacy upload releases only its owned mutation lock token' );
$GLOBALS['fv2_transients']['mmed_fv2_legacy_issue_10'] = array_fill( 0, MMED_File_Vault_V2_Repository::LEGACY_UPLOAD_RATE_LIMIT, time() );
$legacy_rate_limited = MMED_File_Vault_V2_Repository::begin_legacy_upload( 10 );
fv2_repo_assert( is_wp_error( $legacy_rate_limited ) && 'mmed_file_vault_v2_legacy_upload_rate' === $legacy_rate_limited->get_error_code() && ! isset( $GLOBALS['fv2_options']['mmed_fv2_confirm_owner_10'] ), 'legacy upload rate protection fails closed and releases its owner lock' );
unset( $GLOBALS['fv2_transients']['mmed_fv2_legacy_issue_10'] );
$saved_users = $GLOBALS['fv2_users'];
$event_row   = clone $saved_rows[1];
$event_root  = json_decode( $event_row->meta_json, true );
$event_root[ MMED_File_Vault_V2_Repository::META_KEY ]['workflow_status'] = 'submitted';
$event_root[ MMED_File_Vault_V2_Repository::META_KEY ]['activity'] = array();
for ( $index = 1; $index <= 201; ++$index ) {
	$event_root[ MMED_File_Vault_V2_Repository::META_KEY ]['activity'][] = array(
		'id'      => sprintf( 'event-%04d', $index ),
		'type'    => 'fixture_event',
		'message' => sprintf( 'Cursor fixture event %d.', $index ),
		'actor'   => 'MissionMed Reviewer',
		'at'      => 0 === $index % 2 ? '2026-07-15T12:00:00Z' : '2026-07-15T12:00:00+00:00',
	);
}
$event_row->meta_json    = wp_json_encode( $event_root );
$event_row->status       = 'pending';
$GLOBALS['wpdb']->rows   = array( 1 => $event_row );
$GLOBALS['fv2_users']    = array( (object) array( 'ID' => 10, 'display_name' => 'Student Fixture' ) );
$compact_staff_scope     = MMED_File_Vault_V2_Repository::staff_scope( 'admin', 20, '', 1, 1 );
fv2_repo_assert( 1 === count( $compact_staff_scope['review_queue'] ) && ! isset( $compact_staff_scope['review_queue'][0]['versions'], $compact_staff_scope['review_queue'][0]['comments'], $compact_staff_scope['review_queue'][0]['scores'], $compact_staff_scope['review_queue'][0]['activity'] ), 'staff list routes return compact queue projections instead of full document histories' );
$first_audit_page        = MMED_File_Vault_V2_Repository::audit_scope( 'admin', 20, 1, 1, '', '', 200 );
$first_audit_pagination  = $first_audit_page['pagination'];
fv2_repo_assert( 200 === count( $first_audit_page['events'] ) && true === $first_audit_pagination['has_more'] && 1 === $first_audit_pagination['next_page'], 'audit cursor returns a bounded 200-event first page without advancing the roster early' );
fv2_repo_assert( 'event-0002' === $first_audit_pagination['next_before_id'] && '' !== $first_audit_pagination['next_before_at'], 'audit cursor uses the stable timestamp and event-ID tie breaker' );
$second_audit_page = MMED_File_Vault_V2_Repository::audit_scope( 'admin', 20, 1, 1, $first_audit_pagination['next_before_at'], $first_audit_pagination['next_before_id'], 200 );
$all_audit_ids     = array_merge( array_column( $first_audit_page['events'], 'id' ), array_column( $second_audit_page['events'], 'id' ) );
fv2_repo_assert( 1 === count( $second_audit_page['events'] ) && 'event-0001' === $second_audit_page['events'][0]['id'] && false === $second_audit_page['pagination']['has_more'], 'audit cursor makes event 201 reachable and reports completion' );
fv2_repo_assert( 201 === count( array_unique( $all_audit_ids ) ), 'audit cursor returns all 201 events exactly once' );
$invalid_audit_cursor = MMED_File_Vault_V2_Repository::audit_scope( 'admin', 20, 1, 1, '2026-07-15T12:00:00Z', '', 200 );
fv2_repo_assert( is_wp_error( $invalid_audit_cursor ) && 'mmed_file_vault_v2_audit_cursor_invalid' === $invalid_audit_cursor->get_error_code(), 'partial audit cursors fail closed' );
$oversized_meta_row            = clone $saved_rows[1];
$oversized_meta_row->meta_json = str_repeat( 'x', MMED_File_Vault_V2_Repository::STAFF_META_BYTES_LIMIT + 1 );
$GLOBALS['wpdb']->rows         = array( 1 => $oversized_meta_row );
$oversized_meta_scope          = MMED_File_Vault_V2_Repository::staff_scope( 'admin', 20, '', 1, 1 );
fv2_repo_assert( is_wp_error( $oversized_meta_scope ) && 'mmed_file_vault_v2_staff_payload_too_large' === $oversized_meta_scope->get_error_code(), 'staff metadata expansion fails closed at the bounded page byte ceiling' );

$comment_limit_row  = clone $saved_rows[1];
$comment_limit_root = json_decode( $comment_limit_row->meta_json, true );
$comment_limit_root[ MMED_File_Vault_V2_Repository::META_KEY ]['comments'] = array_fill( 0, MMED_File_Vault_V2_Repository::MAX_COMMENTS, array( 'id' => 'bounded-comment', 'body' => 'fixture' ) );
$comment_limit_row->meta_json = wp_json_encode( $comment_limit_root );
$GLOBALS['wpdb']->rows = array( 1 => $comment_limit_row );
$comment_limited = MMED_File_Vault_V2_Repository::add_comment( 1, 10, 'student', 'One comment beyond the retained limit.' );
fv2_repo_assert( is_wp_error( $comment_limited ) && 'mmed_file_vault_v2_comment_limit' === $comment_limited->get_error_code(), 'retained comment collection limit fails closed' );

$internal_note_limit_row  = clone $saved_rows[1];
$internal_note_limit_root = json_decode( $internal_note_limit_row->meta_json, true );
$internal_note_limit_root[ MMED_File_Vault_V2_Repository::META_KEY ]['internal_notes'] = array_fill( 0, MMED_File_Vault_V2_Repository::MAX_INTERNAL_NOTES, array( 'id' => 'bounded-internal-note', 'body' => 'fixture' ) );
$internal_note_limit_row->meta_json = wp_json_encode( $internal_note_limit_root );
$GLOBALS['wpdb']->rows = array( 1 => $internal_note_limit_row );
$internal_note_limited = MMED_File_Vault_V2_Repository::add_internal_note( 1, 20, 'One internal note beyond the retained limit.' );
fv2_repo_assert( is_wp_error( $internal_note_limited ) && 'mmed_file_vault_v2_internal_note_limit' === $internal_note_limited->get_error_code(), 'retained internal-note collection limit fails closed' );

$version_limit_row  = clone $saved_rows[1];
$version_limit_root = json_decode( $version_limit_row->meta_json, true );
$existing_version   = $version_limit_root[ MMED_File_Vault_V2_Repository::META_KEY ]['versions'][0];
$version_limit_root[ MMED_File_Vault_V2_Repository::META_KEY ]['versions'] = array_fill( 0, MMED_File_Vault_V2_Repository::MAX_VERSIONS, $existing_version );
$version_limit_row->meta_json = wp_json_encode( $version_limit_root );
$GLOBALS['wpdb']->rows = array( 1 => $version_limit_row );
$version_limited = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'next.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100, 'sha256' => str_repeat( 'a', 64 ) ), 1 );
fv2_repo_assert( is_wp_error( $version_limited ) && 'mmed_file_vault_v2_version_limit' === $version_limited->get_error_code(), 'retained version collection limit fails before signing' );

$write_limit_row  = clone $saved_rows[1];
$write_limit_root = json_decode( $write_limit_row->meta_json, true );
$write_limit_root['fixture_padding'] = str_repeat( 'x', MMED_File_Vault_V2_Repository::DOCUMENT_META_BYTES_LIMIT );
$write_limit_row->meta_json = wp_json_encode( $write_limit_root );
$GLOBALS['wpdb']->rows = array( 1 => $write_limit_row );
unset( $GLOBALS['fv2_transients']['mmed_fv2_comment_rate_1_10'] );
$write_limited = MMED_File_Vault_V2_Repository::add_comment( 1, 10, 'student', 'This write must fail its serialized ceiling.' );
fv2_repo_assert( is_wp_error( $write_limited ) && 'mmed_file_vault_v2_metadata_limit' === $write_limited->get_error_code(), 'every metadata write enforces the serialized document ceiling' );
$status_write_limited = MMED_File_Vault_V2_Repository::update_status( 1, $write_limit_root[ MMED_File_Vault_V2_Repository::META_KEY ]['workflow_status'], 20 );
fv2_repo_assert( is_wp_error( $status_write_limited ) && 'mmed_file_vault_v2_metadata_limit' === $status_write_limited->get_error_code(), 'direct status persistence also enforces the serialized document ceiling' );
unset( $GLOBALS['fv2_transients']['mmed_fv2_comment_rate_1_10'] );

$headroom_row  = clone $saved_rows[1];
$headroom_root = json_decode( $headroom_row->meta_json, true );
$headroom_root[ MMED_File_Vault_V2_Repository::META_KEY ]['activity'] = array();
$headroom_root['fixture_padding'] = '';
$headroom_padding = max( 0, MMED_File_Vault_V2_Repository::DOCUMENT_META_WRITE_BYTES_LIMIT - strlen( wp_json_encode( $headroom_root ) ) - 64 );
$headroom_root['fixture_padding'] = str_repeat( 'x', $headroom_padding );
$headroom_row->meta_json = wp_json_encode( $headroom_root );
$GLOBALS['wpdb']->rows = array( 1 => $headroom_row );
unset( $GLOBALS['fv2_transients']['mmed_fv2_activity_compatibility_download_issued_1_10'] );
$headroom_activity = MMED_File_Vault_V2_Repository::record_compatibility_download( 1, 10 );
$headroom_size = strlen( (string) $GLOBALS['wpdb']->rows[1]->meta_json );
fv2_repo_assert( ! is_wp_error( $headroom_activity ) && $headroom_size > MMED_File_Vault_V2_Repository::DOCUMENT_META_WRITE_BYTES_LIMIT && $headroom_size <= MMED_File_Vault_V2_Repository::DOCUMENT_META_BYTES_LIMIT, 'reserved system headroom allows a bounded download event beyond the ordinary write ceiling' );

$activity_limit_row  = clone $saved_rows[1];
$activity_limit_root = json_decode( $activity_limit_row->meta_json, true );
$activity_limit_root[ MMED_File_Vault_V2_Repository::META_KEY ]['activity'] = array();
for ( $index = 1; $index <= MMED_File_Vault_V2_Repository::MAX_ACTIVITY_EVENTS; ++$index ) {
	$activity_limit_root[ MMED_File_Vault_V2_Repository::META_KEY ]['activity'][] = array( 'id' => sprintf( 'retained-%04d', $index ), 'type' => 'fixture', 'message' => 'Fixture event.', 'actor' => 'Fixture', 'at' => '2026-07-15T12:00:00+00:00' );
}
$activity_limit_row->meta_json = wp_json_encode( $activity_limit_root );
$GLOBALS['wpdb']->rows = array( 1 => $activity_limit_row );
unset( $GLOBALS['fv2_transients']['mmed_fv2_activity_compatibility_download_issued_1_10'] );
$bounded_activity = MMED_File_Vault_V2_Repository::record_compatibility_download( 1, 10 );
$bounded_activity_meta = json_decode( $GLOBALS['wpdb']->rows[1]->meta_json, true )[ MMED_File_Vault_V2_Repository::META_KEY ]['activity'];
fv2_repo_assert( ! is_wp_error( $bounded_activity ) && MMED_File_Vault_V2_Repository::MAX_ACTIVITY_EVENTS === count( $bounded_activity_meta ) && 'compatibility_download_issued' === end( $bounded_activity_meta )['type'], 'download activity uses bounded rolling retention at its hard ceiling' );

$GLOBALS['wpdb']->rows = $saved_rows;
$GLOBALS['fv2_users']  = $saved_users;
$GLOBALS['fv2_user_meta'][11]['_mmed_file_vault_mentor_id'] = 20;
fv2_repo_assert( MMED_File_Vault_V2_Repository::mentor_can_view( 20, 11 ) && ! MMED_File_Vault_V2_Repository::mentor_can_view( 21, 11 ) && ! MMED_File_Vault_V2_Repository::mentor_can_view( 0, 12 ), 'mentor authorization checks a valid target assignment directly without roster truncation or anonymous equality' );

$mission_intent = MMED_File_Vault_V2_Repository::create_upload_intent(
	12,
	20,
	array(
		'filename' => 'missionmed-interview-guide.pdf',
		'mime_type' => 'application/pdf',
		'file_size' => 128,
		'document_type' => 'other',
		'display_name' => 'MissionMed Interview Guide',
		'share_as_mission_file' => true,
		'sha256' => str_repeat( 'f', 64 ),
	)
);
$mission_document = MMED_File_Vault_V2_Repository::confirm_upload_intent( $mission_intent['upload_id'], $mission_intent['confirm_token'], 20 );
fv2_repo_assert( ! is_wp_error( $mission_document ) && 'admin' === $mission_document['category'] && 'MissionMed' === $mission_document['source'] && '' !== $mission_document['shared_at'], 'authorized staff upload records Mission File category and provenance' );
$mission_bootstrap = MMED_File_Vault_V2_Repository::bootstrap( 12, 'student' );
fv2_repo_assert( 1 === count( $mission_bootstrap['library'] ) && 'MissionMed Interview Guide' === $mission_bootstrap['library'][0]['name'], 'Mission File appears in the student Shared by MissionMed collection' );

$student_share_intent = MMED_File_Vault_V2_Repository::create_upload_intent(
	12,
	12,
	array(
		'filename' => 'student-document.pdf',
		'mime_type' => 'application/pdf',
		'file_size' => 64,
		'document_type' => 'other',
		'display_name' => 'Student Document',
		'share_as_mission_file' => true,
		'sha256' => str_repeat( 'e', 64 ),
	)
);
$student_share_document = MMED_File_Vault_V2_Repository::confirm_upload_intent( $student_share_intent['upload_id'], $student_share_intent['confirm_token'], 12 );
fv2_repo_assert( ! is_wp_error( $student_share_document ) && 'admin' !== $student_share_document['category'] && '' === $student_share_document['source'] && '' === $student_share_document['shared_at'], 'repository defense-in-depth ignores student attempts to self-declare Mission File provenance' );

echo "PASS: {$checks} File Vault V2 repository workflow checks\n";
