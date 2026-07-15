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
	public $insert_id = 0;
	public $get_results_calls = 0;
	public function prepare( $query, ...$args ) { return array( 'query' => $query, 'args' => $args ); }
	public function get_results( $prepared ) {
		++$this->get_results_calls;
		$args = $prepared['args'] ?? array();
		if ( 1 === count( $args ) && is_array( $args[0] ) ) { $args = $args[0]; }
		$user_ids = false !== strpos( $prepared['query'] ?? '', ' IN (' ) ? array_map( 'absint', $args ) : array( absint( $args[0] ?? 0 ) );
		$rows = array_values( array_filter( $this->rows, static function ( $row ) use ( $user_ids ) { return in_array( absint( $row->user_id ), $user_ids, true ); } ) );
		usort( $rows, static function ( $left, $right ) { return $right->id <=> $left->id; } );
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
		$id = absint( $where['id'] ?? 0 );
		if ( ! isset( $this->rows[$id] ) ) { return false; }
		if ( isset( $where['user_id'] ) && absint( $this->rows[$id]->user_id ) !== absint( $where['user_id'] ) ) { return 0; }
		foreach ( $data as $key => $value ) { $this->rows[$id]->{$key} = $value; }
		return 1;
	}
}

$GLOBALS['wpdb'] = new FV2_Fake_DB();
$GLOBALS['fv2_transients'] = array();
$GLOBALS['fv2_users'] = array();
$GLOBALS['fv2_user_meta'] = array();
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
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function mysql_to_rfc3339( $value ) { return gmdate( 'c', strtotime( $value . ' UTC' ) ); }
function rest_sanitize_boolean( $value ) { return filter_var( $value, FILTER_VALIDATE_BOOLEAN ); }
function sanitize_file_name( $value ) { return preg_replace( '/[^A-Za-z0-9._-]/', '-', (string) $value ); }
function sanitize_key( $value ) { return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $value ) ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_textarea_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function set_transient( $key, $value, $ttl ) { $GLOBALS['fv2_transients'][$key] = $value; return true; }
function user_can( $user_id, $capability ) { return 20 === absint( $user_id ) && 'mmed_manage_file_vault' === $capability; }
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
		'display_name' => 'Personal Statement',
		'note' => 'First complete draft.',
		'sha256' => str_repeat( 'a', 64 ),
	)
);
fv2_repo_assert( ! is_wp_error( $intent ), 'new upload intent created' );
fv2_repo_assert( preg_match( '/^MMED_personal_statement_v1_/', $intent['canonical_name'] ), 'canonical filename is server-generated' );
$internal_intent = $GLOBALS['fv2_transients']['mmed_fv2_intent_' . $intent['upload_id']];
fv2_repo_assert( 0 === strpos( $internal_intent['r2_key'], 'student-files/v2/staging/' ) && 0 === strpos( $internal_intent['final_r2_key'], 'student-files/v2/objects/' ), 'uploads use private V2 staging and immutable object prefixes' );

$document = MMED_File_Vault_V2_Repository::confirm_upload_intent( $intent['upload_id'], $intent['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $document ) && 1 === $document['id'], 'upload finalizes a document' );
fv2_repo_assert( 'draft' === $document['status'] && 1 === $document['version'], 'initial workflow state and version are truthful' );
fv2_repo_assert( MMED_File_Vault_V2_Repository::current_version_verified( 1 ), 'confirmed V2 document has a verified current version' );
fv2_repo_assert( false === strpos( json_encode( $document ), 'r2_key' ) && false === strpos( json_encode( $document ), 'student-files/' ), 'object keys are scrubbed from public responses' );

$duplicate = MMED_File_Vault_V2_Repository::confirm_upload_intent( $intent['upload_id'], $intent['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $duplicate ) && 1 === $duplicate['id'], 'upload confirmation is idempotent' );
$cross_actor_replay = MMED_File_Vault_V2_Repository::confirm_upload_intent( $intent['upload_id'], $intent['confirm_token'], 20 );
fv2_repo_assert( is_wp_error( $cross_actor_replay ) && 404 === $cross_actor_replay->get_error_data()['status'], 'completed upload replay is scoped to the issuing actor' );

$comment = MMED_File_Vault_V2_Repository::add_comment( 1, 10, 'student', 'Please review the new opening.' );
fv2_repo_assert( ! is_wp_error( $comment ) && 1 === $comment['version'], 'comment is bound to the current version' );
fv2_repo_assert( ! isset( $comment['author_id'] ), 'comment response does not expose internal actor IDs' );
$resolved = MMED_File_Vault_V2_Repository::resolve_comment( 1, $comment['id'], 20 );
fv2_repo_assert( ! is_wp_error( $resolved ) && true === $resolved['resolved'], 'comment resolution persists' );

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
$score = MMED_File_Vault_V2_Repository::add_score( 1, 20, array( 'total_score' => 82, 'category_scores' => $categories, 'notes' => 'Revision reviewed.' ) );
fv2_repo_assert( ! is_wp_error( $score ) && 1 === $score['version'], 'score is version-bound' );
fv2_repo_assert( 32 === $score['total_score'] && 40 === $score['max_score'] && 4 === count( $score['category_scores'] ) && 'Score recorded' === $score['readiness_label'], 'server computes a neutral score and denominator from the document-scoped rubric' );
$needs = MMED_File_Vault_V2_Repository::update_status( 1, 'needs_changes', 20, 'Tighten the close.' );
fv2_repo_assert( 'needs_changes' === $needs['status'], 'needs-changes verdict persists' );

$version_intent = MMED_File_Vault_V2_Repository::create_upload_intent(
	10,
	10,
	array(
		'filename' => 'personal-statement-v2.docx',
		'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'file_size' => 222,
		'note' => 'Reworked closing paragraph.',
		'ready_for_review' => true,
		'sha256' => str_repeat( 'b', 64 ),
	),
	1
);
$versioned = MMED_File_Vault_V2_Repository::confirm_upload_intent( $version_intent['upload_id'], $version_intent['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $versioned ) && 2 === $versioned['version'] && 2 === count( $versioned['versions'] ), 'new upload creates immutable version history' );
fv2_repo_assert( 'submitted' === $versioned['status'], 'version can submit for review at confirmation' );
fv2_repo_assert( 32 === $versioned['versions'][0]['score'] && 40 === $versioned['versions'][0]['score_max'], 'historical score and denominator remain attached to their version' );

$GLOBALS['fv2_options']['mmed_file_vault_v2_user_quota_bytes'] = 400;
$version_quota = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'quota.pdf', 'mime_type' => 'application/pdf', 'file_size' => 60, 'sha256' => str_repeat( 'e', 64 ) ), 1 );
fv2_repo_assert( is_wp_error( $version_quota ) && 'mmed_file_vault_v2_quota_exceeded' === $version_quota->get_error_code(), 'quota counts every retained immutable version' );
$GLOBALS['fv2_options']['mmed_file_vault_v2_user_quota_bytes'] = 104857600;

$parallel_a = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'a.pdf', 'mime_type' => 'application/pdf', 'file_size' => 300, 'sha256' => str_repeat( 'c', 64 ) ), 1 );
$parallel_b = MMED_File_Vault_V2_Repository::create_upload_intent( 10, 10, array( 'filename' => 'b.pdf', 'mime_type' => 'application/pdf', 'file_size' => 301, 'sha256' => str_repeat( 'd', 64 ) ), 1 );
$parallel_lock_key = 'mmed_fv2_confirm_owner_10';
$GLOBALS['fv2_options'][$parallel_lock_key] = array( 'token' => 'another-worker', 'expires' => time() + 1200 );
$parallel_busy = MMED_File_Vault_V2_Repository::confirm_upload_intent( $parallel_a['upload_id'], $parallel_a['confirm_token'], 10 );
fv2_repo_assert( is_wp_error( $parallel_busy ) && 'mmed_file_vault_v2_confirm_in_progress' === $parallel_busy->get_error_code(), 'simultaneous confirmation is rejected by a token-owned atomic lock' );
unset( $GLOBALS['fv2_options'][$parallel_lock_key] );
$parallel_first = MMED_File_Vault_V2_Repository::confirm_upload_intent( $parallel_a['upload_id'], $parallel_a['confirm_token'], 10 );
$parallel_stale = MMED_File_Vault_V2_Repository::confirm_upload_intent( $parallel_b['upload_id'], $parallel_b['confirm_token'], 10 );
fv2_repo_assert( ! is_wp_error( $parallel_first ) && 3 === $parallel_first['version'], 'first concurrent version finalizes' );
fv2_repo_assert( is_wp_error( $parallel_stale ) && 'mmed_file_vault_v2_version_conflict' === $parallel_stale->get_error_code(), 'stale concurrent version fails with conflict' );
fv2_repo_assert( ! isset( $GLOBALS['fv2_transients']['mmed_fv2_intent_' . $parallel_b['upload_id']] ) && ! isset( $GLOBALS['fv2_options'][$parallel_lock_key] ), 'terminal conflict abandons staging intent and releases only the owned confirmation lock' );

$download = MMED_File_Vault_V2_Repository::download( 1, 1, 10 );
fv2_repo_assert( ! is_wp_error( $download ) && 1 === $download['version'] && 60 === $download['expires'], 'historical version gets a short-lived signed download' );
$final = MMED_File_Vault_V2_Repository::get_document( 1 );
fv2_repo_assert( count( $final['activity'] ) >= 7, 'mutations produce real activity evidence' );

$bootstrap = MMED_File_Vault_V2_Repository::bootstrap( 10, 'student' );
fv2_repo_assert( 6 === count( $bootstrap['journey']['gates'] ) && 'server_configuration' === $bootstrap['journey']['gate_source'], 'Journey uses server-configured gates' );
fv2_repo_assert( 3 === $bootstrap['journey']['total_count'], 'Journey exposes only the assigned student requirement set' );
fv2_repo_assert( 'fixture-application-set' === $bootstrap['journey']['requirement_set']['id'] && 'Deterministic repository contract fixture' === $bootstrap['journey']['requirement_set']['source'], 'Journey exposes requirement-set identity and provenance' );
fv2_repo_assert( 'upload' === $bootstrap['next_action']['kind'], 'next action is computed from missing server requirements' );
fv2_repo_assert( 'Curriculum Vitae' === $bootstrap['document_types']['curriculum_vitae'], 'upload vocabulary is server-owned without making every type a requirement' );
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
fv2_repo_assert( 2 === count( $staff_scope['students'] ) && 1 === $GLOBALS['wpdb']->get_results_calls - $query_count, 'staff roster, review queue, and audit feed share one bulk document query' );
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
$GLOBALS['wpdb']->rows = $saved_rows;
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
$GLOBALS['wpdb']->rows = $saved_rows;
$GLOBALS['fv2_users']  = $saved_users;
$GLOBALS['fv2_user_meta'][11]['_mmed_file_vault_mentor_id'] = 20;
fv2_repo_assert( MMED_File_Vault_V2_Repository::mentor_can_view( 20, 11 ) && ! MMED_File_Vault_V2_Repository::mentor_can_view( 21, 11 ) && ! MMED_File_Vault_V2_Repository::mentor_can_view( 0, 12 ), 'mentor authorization checks a valid target assignment directly without roster truncation or anonymous equality' );

echo "PASS: {$checks} File Vault V2 repository workflow checks\n";
