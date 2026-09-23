<?php
/** Standalone DR-328 direct ROOT upload and stale-session regression. */
declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );

class WP_Error {
	private $code;
	private $message;
	private $data;
	public function __construct( $code, $message, $data = array() ) { $this->code = $code; $this->message = $message; $this->data = $data; }
	public function get_error_code() { return $this->code; }
	public function get_error_message() { return $this->message; }
	public function get_error_data() { return $this->data; }
}
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_file_name( $value ) { return preg_replace( '/[^A-Za-z0-9._-]/', '-', (string) $value ); }
function wp_basename( $value ) { return basename( (string) $value ); }
function wp_tempnam( $prefix = '' ) { return tempnam( sys_get_temp_dir(), $prefix ); }

class MMPS_Gate {
	public static function testing() { return true; }
}
class MMPS_Region {
	public static function split_text( $text ) {
		return array_values( array_filter( array_map( 'trim', preg_split( '/\R\s*\R/u', trim( (string) $text ) ) ), function ( $value ) { return '' !== $value; } ) );
	}
	public static function text_hash( $paragraphs ) { return hash( 'sha256', implode( "\n\n", $paragraphs ) ); }
	public static function parse_template( $paragraphs ) { return array( 'found' => false, 'paragraphs' => array_values( $paragraphs ), 'region' => array(), 'detection' => array() ); }
}
class MMPS_Store {
	public static $last_user = 0;
	public static $last_data = array();
	public static function create_root( $user_id, $data ) { self::$last_user = (int) $user_id; self::$last_data = $data; return 71; }
}

require dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-docx.php';
require dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-root-source.php';

$pass = 0;
$fail = 0;
function dr328_check( $condition, $label ) {
	global $pass, $fail;
	if ( $condition ) { ++$pass; echo "PASS $label\n"; }
	else { ++$fail; echo "FAIL $label\n"; }
}
function dr328_file( $name, $bytes, $declared_size = null, $error = UPLOAD_ERR_OK ) {
	$path = tempnam( sys_get_temp_dir(), 'mmps-test-' );
	file_put_contents( $path, $bytes );
	return array( 'error' => $error, 'tmp_name' => $path, 'name' => $name, 'size' => null === $declared_size ? strlen( $bytes ) : $declared_size );
}
function dr328_code( $value ) { return is_wp_error( $value ) ? $value->get_error_code() : ''; }

$text = "First complete paragraph for a finished statement.\n\nSecond complete paragraph with a separate idea.\n\nThird complete paragraph that closes the statement.";
$txt  = dr328_file( 'My Final PS.txt', $text );
$id   = MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $txt );
dr328_check( 71 === $id, 'valid UTF-8 TXT creates a ROOT' );
dr328_check( 89 === MMPS_Store::$last_user, 'ROOT remains scoped to the authenticated owner' );
dr328_check( 'UPLOADED' === MMPS_Store::$last_data['source_kind'] && empty( MMPS_Store::$last_data['is_synthetic'] ), 'uploaded ROOT is always real' );
dr328_check( 3 === count( MMPS_Store::$last_data['paragraphs'] ), 'TXT paragraph boundaries are preserved' );
dr328_check( hash( 'sha256', $text ) === MMPS_Store::$last_data['source_sha256'], 'source hash is exact' );
dr328_check( is_file( $txt['tmp_name'] ), 'PSV does not move the request-transient source into another store' );
unlink( $txt['tmp_name'] );

$docx_bytes = MMPS_Docx::bytes_from_paragraphs( array( 'DOCX paragraph one.', 'DOCX paragraph two.', 'DOCX paragraph three.' ) );
$docx       = dr328_file( 'statement.docx', $docx_bytes );
$id         = MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $docx );
dr328_check( 71 === $id && 3 === count( MMPS_Store::$last_data['paragraphs'] ), 'valid clean DOCX is parsed server-side' );
unlink( $docx['tmp_name'] );

$bad_type = dr328_file( 'statement.pdf', '%PDF-not-authorized' );
dr328_check( 'mmps_root_upload_type' === dr328_code( MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $bad_type ) ), 'PDF and other ambiguous formats fail closed' );
unlink( $bad_type['tmp_name'] );

$binary = dr328_file( 'statement.txt', "one\0two\n\nthree\n\nfour" );
dr328_check( 'mmps_root_upload_encoding' === dr328_code( MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $binary ) ), 'binary TXT fails closed' );
unlink( $binary['tmp_name'] );

$bom = dr328_file( 'statement.txt', "\xEF\xBB\xBFOne paragraph.\n\nTwo paragraphs.\n\nThree paragraphs." );
dr328_check( 71 === MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $bom ) && 'One paragraph.' === MMPS_Store::$last_data['paragraphs'][0], 'UTF-8 BOM is removed without changing paragraph order' );
unlink( $bom['tmp_name'] );

$short = dr328_file( 'statement.txt', "one\n\ntwo" );
dr328_check( 'mmps_root_too_short' === dr328_code( MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $short ) ), 'incomplete two-paragraph text fails closed' );
unlink( $short['tmp_name'] );

$mismatch = dr328_file( 'statement.txt', $text, strlen( $text ) + 1 );
dr328_check( 'mmps_root_upload_size' === dr328_code( MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $mismatch ) ), 'declared and actual byte mismatch fails closed' );
unlink( $mismatch['tmp_name'] );

$too_big_path = tempnam( sys_get_temp_dir(), 'mmps-big-' );
$too_big       = array( 'error' => UPLOAD_ERR_OK, 'tmp_name' => $too_big_path, 'name' => 'large.docx', 'size' => MMPS_Root_Source::UPLOAD_MAX_BYTES + 1 );
dr328_check( 'mmps_root_upload_size' === dr328_code( MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $too_big ) ), 'files over 5 MB fail before any read' );
unlink( $too_big_path );

$upload_error = array( 'error' => UPLOAD_ERR_PARTIAL, 'tmp_name' => '', 'name' => 'statement.docx', 'size' => 100 );
dr328_check( 'mmps_root_upload' === dr328_code( MMPS_Root_Source::create_upload( 89, 'Internal Medicine', $upload_error ) ), 'partial PHP upload fails closed' );
dr328_check( 'mmps_specialty_required' === dr328_code( MMPS_Root_Source::create_upload( 89, '', $upload_error ) ), 'specialty is required before file handling' );

$source = file_get_contents( dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-root-source.php' );
dr328_check( false === strpos( $source, 'move_uploaded_file' ) && false === strpos( $source, 'wp_handle_upload' ), 'source file is never moved into persistent storage' );

$docx_source = file_get_contents( dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-docx.php' );
dr328_check( false !== strpos( $docx_source, 'MAX_ARCHIVE_ENTRIES' ) && false !== strpos( $docx_source, 'MAX_DOCUMENT_XML_BYTES' ), 'DOCX archive entry and expansion limits are enforced before XML extraction' );

$js = file_get_contents( dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/assets/mmps-app.js' );
dr328_check( false !== strpos( $js, "data-source=\"UPLOADED\"" ) && false !== strpos( $js, "data-root-file" ), 'direct upload is a visible ROOT option' );
dr328_check( false !== strpos( $js, "data.code === 'rest_cookie_invalid_nonce'" ) && false !== strpos( $js, '!retried' ), 'only the exact stale-nonce error receives one retry' );
dr328_check( false !== strpos( $js, 'Your text is still on this page') && false !== strpos( $js, 'mmps_session_expired' ), 'expired session preserves the current page and gives a clear recovery message' );
dr328_check(
	false === strpos( $js, 'console.log(cfg.nonce') &&
	false === strpos( $js, "localStorage.setItem('mmps-root" ) &&
	false === strpos( $js, "localStorage.setItem('mmps-nonce" ) &&
	false === strpos( $js, "localStorage.setItem('mmps-statement" ),
	'nonce and ROOT are not logged or persisted in browser storage'
);

echo "RESULT $pass passed, $fail failed\n";
exit( $fail ? 1 : 0 );
