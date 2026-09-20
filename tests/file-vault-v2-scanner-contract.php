<?php
/** Focused content-scanner contracts for J1-FILEVAULT-1020. */

define( 'ABSPATH', __DIR__ . '/' );
define( 'WP_PLUGIN_DIR', __DIR__ . '/fixtures/no-plugins' );

class WP_Error {
	private $code;
	public function __construct( $code ) { $this->code = $code; }
	public function get_error_code() { return $this->code; }
}
function add_action() {}
function add_filter() {}
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }

require_once dirname( __DIR__ ) . '/wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php';

$checks = 0;
function fv2_scanner_assert( $condition, $message ) {
	global $checks;
	++$checks;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

function fv2_test_zip( $entries ) {
	$local = '';
	$central = '';
	foreach ( $entries as $name => $data ) {
		$name = (string) $name;
		$data = (string) $data;
		$offset = strlen( $local );
		$length = strlen( $data );
		$crc = crc32( $data );
		$local .= pack( 'VvvvvvVVVvv', 0x04034b50, 20, 0, 0, 0, 0, $crc, $length, $length, strlen( $name ), 0 ) . $name . $data;
		$central .= pack( 'VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, 0, 0, $crc, $length, $length, strlen( $name ), 0, 0, 0, 0, 0, $offset ) . $name;
	}
	return $local . $central . pack( 'VvvvvVVv', 0x06054b50, 0, 0, count( $entries ), count( $entries ), strlen( $central ), strlen( $local ), 0 );
}

function fv2_inspect_fixture( $body, $mime, $filename ) {
	$tmp = tempnam( sys_get_temp_dir(), 'fv2-scan-' );
	file_put_contents( $tmp, $body );
	try {
		return mmed_fv2_inspect_content( $tmp, $body, $mime, $filename );
	} finally {
		@unlink( $tmp );
	}
}

$pages = fv2_test_zip( array( 'Index/Document.iwa' => 'fixture', 'Metadata/BuildVersionHistory.plist' => 'fixture' ) );
fv2_scanner_assert( true === fv2_inspect_fixture( $pages, 'application/vnd.apple.pages', 'PS_VERSION_9.2_CleanFinal.pages' ), 'valid Pages package passes bounded structure inspection' );

$docx_macro = fv2_test_zip( array( '[Content_Types].xml' => '<Types/>', 'word/document.xml' => '<document/>', 'word/vbaProject.bin' => 'macro' ) );
$macro_result = fv2_inspect_fixture( $docx_macro, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'draft.docx' );
fv2_scanner_assert( is_wp_error( $macro_result ) && 'mmed_fv2_scan_package_active_content' === $macro_result->get_error_code(), 'macro-bearing Office package fails closed' );

$pdf_action = "%PDF-1.7\n1 0 obj <</OpenAction 2 0 R>>\n";
$pdf_result = fv2_inspect_fixture( $pdf_action, 'application/pdf', 'draft.pdf' );
fv2_scanner_assert( is_wp_error( $pdf_result ) && 'mmed_fv2_scan_pdf_action' === $pdf_result->get_error_code(), 'active PDF action fails closed' );

$text_result = fv2_inspect_fixture( "safe\x00binary", 'text/plain', 'notes.txt' );
fv2_scanner_assert( is_wp_error( $text_result ) && 'mmed_fv2_scan_text_encoding' === $text_result->get_error_code(), 'binary content disguised as text fails closed' );

$gif = 'GIF89a' . str_repeat( "\x00", 16 );
fv2_scanner_assert( true === fv2_inspect_fixture( $gif, 'image/gif', 'image.gif' ), 'valid GIF signature passes' );

$legacy_doc = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1" . str_repeat( "\x00", 32 );
fv2_scanner_assert( true === fv2_inspect_fixture( $legacy_doc, 'application/msword', 'Personal Statement.doc' ), 'legacy Word OLE signature passes' );

$zip = fv2_test_zip( array( 'notes/readme.txt' => 'safe archive content' ) );
fv2_scanner_assert( true === fv2_inspect_fixture( $zip, 'application/zip', 'application materials.zip' ), 'ordinary ZIP archive passes bounded central-directory inspection' );

$unsafe_zip = fv2_test_zip( array( '../unsafe.exe' => 'MZ' ) );
$unsafe_zip_result = fv2_inspect_fixture( $unsafe_zip, 'application/zip', 'unsafe.zip' );
fv2_scanner_assert( is_wp_error( $unsafe_zip_result ) && 'mmed_fv2_scan_zip_unsafe_entry' === $unsafe_zip_result->get_error_code(), 'ZIP archive path traversal and active entries fail closed' );

fv2_scanner_assert( true === fv2_inspect_fixture( 'ordinary statistical dataset', 'application/octet-stream', 'research-data.dta' ), 'unknown ordinary extensions pass the broad content-scanned path' );

echo "PASS: {$checks} File Vault scanner contract checks\n";
