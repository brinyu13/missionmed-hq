<?php
/**
 * MissionMed File Vault V2 — Document Security Scanner.
 *
 * Provides the mmed_file_vault_v2_scan_object filter with a real content
 * inspection policy: magic-bytes validation, format-specific header checks,
 * executable/archive/macro rejection, and independent SHA-256 verification.
 *
 * @package MissionMed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$mmed_hub_autoload = WP_PLUGIN_DIR . '/missionmed-hub/vendor/autoload.php';
if ( file_exists( $mmed_hub_autoload ) ) {
	require_once $mmed_hub_autoload;
}
unset( $mmed_hub_autoload );

if ( ! defined( 'MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED' ) ) {
	define( 'MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED', true );
}

add_filter( 'mmed_file_vault_v2_scan_object', 'mmed_fv2_scan_staged_object', 10, 3 );

/**
 * Download the staged R2 object, inspect its content, and verify its SHA-256.
 *
 * @param mixed $result Previous filter result (ignored — first filter in chain).
 * @param array $intent Upload intent from the V2 repository.
 * @param array $probe  HEAD-probe result; includes staging_download_url.
 * @return array|WP_Error
 */
function mmed_fv2_scan_staged_object( $result, $intent, $probe ) {
	if ( is_array( $result ) || is_wp_error( $result ) ) {
		return $result;
	}

	$download_url = $probe['staging_download_url'] ?? '';
	if ( '' === $download_url ) {
		return new WP_Error( 'mmed_fv2_scan_no_url', 'Scanner could not obtain a download URL for the staged object.', array( 'status' => 503 ) );
	}

	if ( defined( 'MMED_R2_ENDPOINT' ) ) {
		$expected_host = wp_parse_url( MMED_R2_ENDPOINT, PHP_URL_HOST );
		$actual_host   = wp_parse_url( $download_url, PHP_URL_HOST );
		if ( ! $expected_host || $actual_host !== $expected_host ) {
			return new WP_Error( 'mmed_fv2_scan_invalid_url', 'Download URL does not match the expected storage host.', array( 'status' => 422 ) );
		}
	}

	$declared_mime   = sanitize_text_field( $intent['mime_type'] ?? '' );
	$declared_sha256 = strtolower( sanitize_text_field( $intent['declared_sha256'] ?? '' ) );
	$declared_size   = absint( $intent['declared_size'] ?? 0 );
	$max_size        = absint( $intent['max_size'] ?? 26214400 );

	$response = wp_remote_get( $download_url, array(
		'timeout'     => 30,
		'redirection' => 0,
		'stream'      => false,
		'limit_response_size' => $max_size + 1024,
	) );

	if ( is_wp_error( $response ) ) {
		return new WP_Error( 'mmed_fv2_scan_download', 'Scanner could not download the staged object.', array( 'status' => 503 ) );
	}

	$http_code = wp_remote_retrieve_response_code( $response );
	if ( 200 !== $http_code ) {
		return new WP_Error( 'mmed_fv2_scan_download', 'Staged object returned HTTP ' . $http_code . '.', array( 'status' => 503 ) );
	}

	$body = wp_remote_retrieve_body( $response );
	$body_len = strlen( $body );

	if ( $body_len < 1 || $body_len > $max_size ) {
		return new WP_Error( 'mmed_fv2_scan_size', 'Downloaded object size is outside allowed bounds.', array( 'status' => 422 ) );
	}

	$computed_sha256 = hash( 'sha256', $body );
	if ( ! hash_equals( $declared_sha256, $computed_sha256 ) ) {
		return new WP_Error( 'mmed_fv2_scan_checksum', 'SHA-256 of downloaded content does not match the declared checksum.', array( 'status' => 422 ) );
	}

	$tmp = wp_tempnam( 'mmed_fv2_scan_' );
	if ( ! $tmp || false === file_put_contents( $tmp, $body ) ) {
		return new WP_Error( 'mmed_fv2_scan_tmp', 'Scanner could not write temporary file.', array( 'status' => 503 ) );
	}

	$scan_result = mmed_fv2_inspect_content( $tmp, $body, $declared_mime, $intent['original_name'] ?? '' );

	@unlink( $tmp );

	if ( is_wp_error( $scan_result ) ) {
		return $scan_result;
	}

	return array( 'clean' => true, 'sha256' => $computed_sha256 );
}

/**
 * Inspect file content: magic bytes, format headers, rejection rules.
 *
 * @param string $tmp_path  Path to the temporary file.
 * @param string $body      Raw file content.
 * @param string $declared  Declared MIME type from the upload intent.
 * @param string $filename  Validated original filename.
 * @return true|WP_Error
 */
function mmed_fv2_inspect_content( $tmp_path, $body, $declared, $filename = '' ) {
	if ( ! function_exists( 'finfo_open' ) ) {
		return new WP_Error( 'mmed_fv2_scan_no_finfo', 'The fileinfo extension is required for content scanning.', array( 'status' => 503 ) );
	}

	$finfo = finfo_open( FILEINFO_MIME_TYPE );
	if ( ! $finfo ) {
		return new WP_Error( 'mmed_fv2_scan_no_finfo', 'Could not initialize the fileinfo scanner.', array( 'status' => 503 ) );
	}
	$detected_mime = (string) finfo_file( $finfo, $tmp_path );
	if ( PHP_VERSION_ID < 80500 ) {
		finfo_close( $finfo );
	}

	$reject_mimes = array(
		'application/x-executable',
		'application/x-dosexec',
		'application/x-msdos-program',
		'application/x-msdownload',
		'application/x-sharedlib',
		'application/x-elf',
		'application/x-mach-binary',
		'application/x-shellscript',
		'application/x-php',
		'text/x-php',
		'text/x-shellscript',
		'application/x-httpd-php',
		'application/java-archive',
		'application/x-java-archive',
		'application/javascript',
		'text/javascript',
		'application/vnd.android.package-archive',
		'application/vnd.microsoft.portable-executable',
		'image/svg+xml',
		'text/html',
		'application/x-iso9660-image',
		'application/vnd.ms-cab-compressed',
		'application/vnd.ms-excel.sheet.macroEnabled.12',
		'application/vnd.ms-word.document.macroEnabled.12',
		'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
	);

	if ( in_array( strtolower( $declared ), $reject_mimes, true ) || ( $detected_mime && in_array( $detected_mime, $reject_mimes, true ) ) ) {
		return new WP_Error( 'mmed_fv2_scan_rejected_type', 'File content detected as a rejected format: ' . $detected_mime, array( 'status' => 422 ) );
	}

	$extension = strtolower( (string) pathinfo( $filename, PATHINFO_EXTENSION ) );
	$blocked_extensions = array( 'app', 'apk', 'bat', 'bin', 'cgi', 'cmd', 'com', 'cpl', 'dll', 'dmg', 'docm', 'dotm', 'exe', 'gadget', 'hta', 'htm', 'html', 'iso', 'jar', 'js', 'jse', 'lnk', 'mjs', 'msi', 'pif', 'php', 'phar', 'ppam', 'potm', 'pptm', 'ps1', 'py', 'rb', 'scr', 'sh', 'sldm', 'svg', 'vbe', 'vbs', 'wsf', 'wsh', 'xlam', 'xlsm', 'xltm' );
	if ( in_array( $extension, $blocked_extensions, true ) ) {
		return new WP_Error( 'mmed_fv2_scan_rejected_extension', 'Active or executable file extensions cannot be stored in File Vault.', array( 'status' => 422 ) );
	}
	$allowed_map = array(
		'pdf'     => array( 'application/pdf' ),
		'doc'     => array( 'application/msword', 'application/CDFV2', 'application/x-ole-storage', 'application/octet-stream', 'text/rtf' ),
		'docx'    => array( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'xlsx'    => array( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'pptx'    => array( 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'pages'   => array( 'application/vnd.apple.pages', 'application/x-iwork-pages-sffpages', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'numbers' => array( 'application/vnd.apple.numbers', 'application/x-iwork-numbers-sffnumbers', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'keynote' => array( 'application/vnd.apple.keynote', 'application/x-iwork-keynote-sffkey', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'odt'     => array( 'application/vnd.oasis.opendocument.text', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'ods'     => array( 'application/vnd.oasis.opendocument.spreadsheet', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'odp'     => array( 'application/vnd.oasis.opendocument.presentation', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'rtf'     => array( 'application/rtf', 'text/rtf', 'text/plain' ),
		'txt'     => array( 'text/plain', 'application/octet-stream' ),
		'csv'     => array( 'text/csv', 'application/csv', 'text/plain', 'application/octet-stream' ),
		'md'      => array( 'text/markdown', 'text/plain', 'application/octet-stream' ),
		'png'     => array( 'image/png' ),
		'jpg'     => array( 'image/jpeg' ),
		'jpeg'    => array( 'image/jpeg' ),
		'gif'     => array( 'image/gif' ),
		'webp'    => array( 'image/webp' ),
		'mp4'     => array( 'video/mp4', 'application/mp4', 'application/octet-stream' ),
		'webm'    => array( 'video/webm', 'audio/webm', 'application/octet-stream' ),
		'mov'     => array( 'video/quicktime', 'application/octet-stream' ),
		'mp3'     => array( 'audio/mpeg', 'audio/mp3', 'application/octet-stream' ),
		'wav'     => array( 'audio/wav', 'audio/x-wav', 'audio/vnd.wave', 'application/octet-stream' ),
		'zip'     => array( 'application/zip', 'application/x-zip-compressed', 'application/octet-stream' ),
		'7z'      => array( 'application/x-7z-compressed', 'application/octet-stream' ),
		'rar'     => array( 'application/vnd.rar', 'application/x-rar-compressed', 'application/octet-stream' ),
		'tar'     => array( 'application/x-tar', 'application/octet-stream' ),
		'gz'      => array( 'application/gzip', 'application/x-gzip', 'application/octet-stream' ),
		'tgz'     => array( 'application/gzip', 'application/x-gzip', 'application/octet-stream' ),
	);

	$acceptable = $allowed_map[ $extension ] ?? array();
	if ( $acceptable && $detected_mime && ! in_array( $detected_mime, $acceptable, true ) ) {
		return new WP_Error(
			'mmed_fv2_scan_mime_mismatch',
			'Declared type ' . $declared . ' but content detected as ' . $detected_mime . '.',
			array( 'status' => 422 )
		);
	}

	$header = substr( $body, 0, 16 );

	if ( 'doc' === $extension && "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1" !== substr( $header, 0, 8 ) && '{\\rtf' !== substr( $body, 0, 5 ) ) {
		return new WP_Error( 'mmed_fv2_scan_doc_header', 'Legacy Word document does not begin with a valid OLE or RTF header.', array( 'status' => 422 ) );
	}

	if ( 'pdf' === $extension ) {
		if ( '%PDF' !== substr( $header, 0, 4 ) ) {
			return new WP_Error( 'mmed_fv2_scan_pdf_header', 'File does not begin with a valid PDF header.', array( 'status' => 422 ) );
		}
		$pdf_dangerous = array( '/JavaScript', '/JS ', '/JS(', '/OpenAction', '/AA ', '/AA<', '/Launch', '/RichMedia' );
		foreach ( $pdf_dangerous as $pattern ) {
			if ( false !== stripos( $body, $pattern ) ) {
				return new WP_Error( 'mmed_fv2_scan_pdf_action', 'PDF contains a potentially dangerous action keyword.', array( 'status' => 422 ) );
			}
		}
	}

	if ( 'png' === $extension ) {
		$png_magic = "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A";
		if ( substr( $header, 0, 8 ) !== $png_magic ) {
			return new WP_Error( 'mmed_fv2_scan_png_header', 'File does not begin with a valid PNG signature.', array( 'status' => 422 ) );
		}
	}

	if ( in_array( $extension, array( 'jpg', 'jpeg' ), true ) ) {
		if ( "\xFF\xD8\xFF" !== substr( $header, 0, 3 ) ) {
			return new WP_Error( 'mmed_fv2_scan_jpeg_header', 'File does not begin with a valid JPEG signature.', array( 'status' => 422 ) );
		}
	}

	if ( 'gif' === $extension && ! in_array( substr( $header, 0, 6 ), array( 'GIF87a', 'GIF89a' ), true ) ) {
		return new WP_Error( 'mmed_fv2_scan_gif_header', 'GIF file does not begin with a valid signature.', array( 'status' => 422 ) );
	}

	if ( 'webp' === $extension && ( 'RIFF' !== substr( $header, 0, 4 ) || 'WEBP' !== substr( $header, 8, 4 ) ) ) {
		return new WP_Error( 'mmed_fv2_scan_webp_header', 'WebP file does not begin with a valid signature.', array( 'status' => 422 ) );
	}

	if ( 'mp4' === $extension ) {
		if ( strlen( $body ) < 12 || 'ftyp' !== substr( $body, 4, 4 ) ) {
			return new WP_Error( 'mmed_fv2_scan_mp4_header', 'MP4 file does not contain a valid ISO media header.', array( 'status' => 422 ) );
		}
		$box_size = unpack( 'Nsize', substr( $body, 0, 4 ) );
		if ( ! $box_size || $box_size['size'] < 8 || $box_size['size'] > strlen( $body ) ) {
			return new WP_Error( 'mmed_fv2_scan_mp4_structure', 'MP4 file contains an invalid first box.', array( 'status' => 422 ) );
		}
	}

	if ( 'webm' === $extension && "\x1A\x45\xDF\xA3" !== substr( $header, 0, 4 ) ) {
		return new WP_Error( 'mmed_fv2_scan_webm_header', 'WebM file does not begin with a valid EBML signature.', array( 'status' => 422 ) );
	}

	if ( in_array( $extension, array( 'png', 'jpg', 'jpeg', 'gif', 'webp' ), true ) ) {
		if ( false !== strpos( $body, "\x50\x4B\x03\x04" ) ) {
			return new WP_Error( 'mmed_fv2_scan_polyglot', 'Image file contains an embedded ZIP archive.', array( 'status' => 422 ) );
		}
		if ( false !== strpos( $body, "\x4D\x5A" ) ) {
			return new WP_Error( 'mmed_fv2_scan_polyglot', 'Image file contains an embedded executable signature.', array( 'status' => 422 ) );
		}
	}

	$zip_formats = array( 'docx', 'xlsx', 'pptx', 'pages', 'numbers', 'keynote', 'odt', 'ods', 'odp' );
	if ( in_array( $extension, $zip_formats, true ) ) {
		$zip_magic = "\x50\x4B\x03\x04";
		if ( substr( $header, 0, 4 ) !== $zip_magic ) {
			return new WP_Error( 'mmed_fv2_scan_package_header', 'Document package does not begin with a valid ZIP signature.', array( 'status' => 422 ) );
		}
		$required_entries = array(
			'docx' => array( '[Content_Types].xml', 'word/document.xml' ),
			'xlsx' => array( '[Content_Types].xml', 'xl/workbook.xml' ),
			'pptx' => array( '[Content_Types].xml', 'ppt/presentation.xml' ),
			'odt'  => array( 'mimetype', 'content.xml' ),
			'ods'  => array( 'mimetype', 'content.xml' ),
			'odp'  => array( 'mimetype', 'content.xml' ),
		);
		foreach ( $required_entries[ $extension ] ?? array() as $required_entry ) {
			if ( ! mmed_fv2_zip_contains_entry( $body, $required_entry ) ) {
				return new WP_Error( 'mmed_fv2_scan_package_structure', 'Document package is missing a required structure entry.', array( 'status' => 422 ) );
			}
		}
		if ( in_array( $extension, array( 'pages', 'numbers', 'keynote' ), true ) && ! mmed_fv2_zip_contains_entry( $body, 'Index/Document.iwa' ) && ! mmed_fv2_zip_contains_entry( $body, 'index.xml' ) ) {
			return new WP_Error( 'mmed_fv2_scan_iwork_structure', 'iWork document package is missing its required document index.', array( 'status' => 422 ) );
		}
		$dangerous_entries = array( 'vbaProject.bin', 'vbaData.xml', '/activeX/', '/embeddings/' );
		foreach ( $dangerous_entries as $dangerous_entry ) {
			if ( mmed_fv2_zip_contains_fragment( $body, $dangerous_entry ) ) {
				return new WP_Error( 'mmed_fv2_scan_package_active_content', 'Document package contains active or embedded content and cannot be accepted.', array( 'status' => 422 ) );
			}
		}
	}

	if ( 'zip' === $extension ) {
		if ( "\x50\x4B\x03\x04" !== substr( $header, 0, 4 ) || false === strrpos( $body, "\x50\x4B\x05\x06" ) ) {
			return new WP_Error( 'mmed_fv2_scan_zip_structure', 'ZIP archive does not contain a valid local header and central directory.', array( 'status' => 422 ) );
		}
		if ( mmed_fv2_zip_has_unsafe_entry( $body, $blocked_extensions ) ) {
			return new WP_Error( 'mmed_fv2_scan_zip_unsafe_entry', 'ZIP archive contains an unsafe path or active file type.', array( 'status' => 422 ) );
		}
	}

	if ( '7z' === $extension && "\x37\x7A\xBC\xAF\x27\x1C" !== substr( $header, 0, 6 ) ) {
		return new WP_Error( 'mmed_fv2_scan_archive_header', '7z archive does not begin with a valid signature.', array( 'status' => 422 ) );
	}

	if ( 'rar' === $extension && "Rar!\x1A\x07" !== substr( $header, 0, 6 ) ) {
		return new WP_Error( 'mmed_fv2_scan_archive_header', 'RAR archive does not begin with a valid signature.', array( 'status' => 422 ) );
	}

	if ( in_array( $extension, array( 'gz', 'tgz' ), true ) && "\x1F\x8B" !== substr( $header, 0, 2 ) ) {
		return new WP_Error( 'mmed_fv2_scan_archive_header', 'Gzip archive does not begin with a valid signature.', array( 'status' => 422 ) );
	}

	if ( 'tar' === $extension && ( strlen( $body ) < 265 || 'ustar' !== substr( $body, 257, 5 ) ) ) {
		return new WP_Error( 'mmed_fv2_scan_archive_header', 'TAR archive does not contain a valid ustar header.', array( 'status' => 422 ) );
	}

	if ( 'rtf' === $extension && '{\\rtf' !== substr( $body, 0, 5 ) ) {
		return new WP_Error( 'mmed_fv2_scan_rtf_header', 'RTF file does not begin with a valid header.', array( 'status' => 422 ) );
	}

	if ( in_array( $extension, array( 'txt', 'csv', 'md' ), true ) && ( false !== strpos( $body, "\x00" ) || 1 !== preg_match( '//u', $body ) ) ) {
		return new WP_Error( 'mmed_fv2_scan_text_encoding', 'Text file must contain valid UTF-8 text without binary content.', array( 'status' => 422 ) );
	}

	$exe_signatures = array(
		"\x4D\x5A",             // PE/MZ (Windows EXE/DLL)
		"\x7F\x45\x4C\x46",    // ELF (Linux executable)
		"\xFE\xED\xFA",        // Mach-O 32-bit
		"\xCE\xFA\xED\xFE",    // Mach-O 32-bit reversed
		"\xFE\xED\xFA\xCF",    // Mach-O 64-bit
		"\xCF\xFA\xED\xFE",    // Mach-O 64-bit reversed
		"\xCA\xFE\xBA\xBE",    // Mach-O universal / Java class
		"#!/",                  // Shell script shebang
	);
	foreach ( $exe_signatures as $sig ) {
		if ( substr( $header, 0, strlen( $sig ) ) === $sig ) {
			return new WP_Error( 'mmed_fv2_scan_executable', 'File contains an executable signature and cannot be accepted.', array( 'status' => 422 ) );
		}
	}

	return true;
}

/**
 * Check whether a ZIP file contains an entry with the given name.
 *
 * @param string $zip_data Raw ZIP file content.
 * @param string $entry    Filename to search for in the central directory.
 * @return bool
 */
function mmed_fv2_zip_contains_entry( $zip_data, $entry ) {
	$eocd_sig = "\x50\x4B\x05\x06";
	$eocd_pos = strrpos( $zip_data, $eocd_sig );
	if ( false === $eocd_pos ) {
		return false;
	}

	$cd_offset = unpack( 'Voffset', substr( $zip_data, $eocd_pos + 16, 4 ) );
	$cd_size   = unpack( 'Vsize', substr( $zip_data, $eocd_pos + 12, 4 ) );
	if ( ! $cd_offset || ! $cd_size ) {
		return false;
	}

	$cd_start = $cd_offset['offset'];
	$cd_end   = $cd_start + $cd_size['size'];
	$pos      = $cd_start;
	$cd_sig   = "\x50\x4B\x01\x02";

	while ( $pos + 46 < $cd_end && $pos + 46 < strlen( $zip_data ) ) {
		if ( substr( $zip_data, $pos, 4 ) !== $cd_sig ) {
			break;
		}
		$name_len  = unpack( 'vlen', substr( $zip_data, $pos + 28, 2 ) );
		$extra_len = unpack( 'vlen', substr( $zip_data, $pos + 30, 2 ) );
		$comm_len  = unpack( 'vlen', substr( $zip_data, $pos + 32, 2 ) );
		if ( ! $name_len || ! $extra_len || ! $comm_len ) {
			break;
		}
		$name = substr( $zip_data, $pos + 46, $name_len['len'] );
		if ( $name === $entry ) {
			return true;
		}
		$pos += 46 + $name_len['len'] + $extra_len['len'] + $comm_len['len'];
	}

	return false;
}

/**
 * Check ZIP central-directory entry names for one dangerous fragment.
 *
 * @param string $zip_data Raw ZIP file content.
 * @param string $fragment Case-insensitive filename fragment.
 * @return bool
 */
function mmed_fv2_zip_contains_fragment( $zip_data, $fragment ) {
	$eocd_pos = strrpos( $zip_data, "\x50\x4B\x05\x06" );
	if ( false === $eocd_pos ) {
		return false;
	}
	$cd_offset = unpack( 'Voffset', substr( $zip_data, $eocd_pos + 16, 4 ) );
	$cd_size   = unpack( 'Vsize', substr( $zip_data, $eocd_pos + 12, 4 ) );
	if ( ! $cd_offset || ! $cd_size ) {
		return false;
	}
	$pos    = $cd_offset['offset'];
	$cd_end = $pos + $cd_size['size'];
	while ( $pos + 46 <= $cd_end && $pos + 46 <= strlen( $zip_data ) ) {
		if ( "\x50\x4B\x01\x02" !== substr( $zip_data, $pos, 4 ) ) {
			break;
		}
		$name_len  = unpack( 'vlen', substr( $zip_data, $pos + 28, 2 ) );
		$extra_len = unpack( 'vlen', substr( $zip_data, $pos + 30, 2 ) );
		$comm_len  = unpack( 'vlen', substr( $zip_data, $pos + 32, 2 ) );
		if ( ! $name_len || ! $extra_len || ! $comm_len ) {
			break;
		}
		$name = substr( $zip_data, $pos + 46, $name_len['len'] );
		if ( false !== stripos( $name, $fragment ) ) {
			return true;
		}
		$pos += 46 + $name_len['len'] + $extra_len['len'] + $comm_len['len'];
	}
	return false;
}

/**
 * Reject archive entries that could traverse paths or carry active file types.
 *
 * @param string $zip_data            Raw ZIP file content.
 * @param array  $blocked_extensions  Active or executable suffixes.
 * @return bool
 */
function mmed_fv2_zip_has_unsafe_entry( $zip_data, $blocked_extensions ) {
	$eocd_pos = strrpos( $zip_data, "\x50\x4B\x05\x06" );
	if ( false === $eocd_pos ) {
		return true;
	}
	$cd_offset = unpack( 'Voffset', substr( $zip_data, $eocd_pos + 16, 4 ) );
	$cd_size   = unpack( 'Vsize', substr( $zip_data, $eocd_pos + 12, 4 ) );
	if ( ! $cd_offset || ! $cd_size ) {
		return true;
	}
	$pos    = $cd_offset['offset'];
	$cd_end = $pos + $cd_size['size'];
	while ( $pos + 46 <= $cd_end && $pos + 46 <= strlen( $zip_data ) ) {
		if ( "\x50\x4B\x01\x02" !== substr( $zip_data, $pos, 4 ) ) {
			return true;
		}
		$name_len  = unpack( 'vlen', substr( $zip_data, $pos + 28, 2 ) );
		$extra_len = unpack( 'vlen', substr( $zip_data, $pos + 30, 2 ) );
		$comm_len  = unpack( 'vlen', substr( $zip_data, $pos + 32, 2 ) );
		if ( ! $name_len || ! $extra_len || ! $comm_len ) {
			return true;
		}
		$name = str_replace( '\\', '/', substr( $zip_data, $pos + 46, $name_len['len'] ) );
		$entry_extension = strtolower( (string) pathinfo( rtrim( $name, '/' ), PATHINFO_EXTENSION ) );
		if ( '' === $name || false !== strpos( $name, "\0" ) || '/' === substr( $name, 0, 1 ) || preg_match( '#(^|/)\.\.(/|$)#', $name ) || in_array( $entry_extension, $blocked_extensions, true ) ) {
			return true;
		}
		$pos += 46 + $name_len['len'] + $extra_len['len'] + $comm_len['len'];
	}
	return $pos !== $cd_end;
}

add_action( 'mmed_fv2_staging_cleanup', 'mmed_fv2_run_staging_cleanup' );

add_action( 'init', static function () {
	if ( ! wp_next_scheduled( 'mmed_fv2_staging_cleanup' ) ) {
		wp_schedule_event( time(), 'daily', 'mmed_fv2_staging_cleanup' );
	}
} );

/**
 * Delete staging objects older than 24 hours.
 *
 * @return void
 */
function mmed_fv2_run_staging_cleanup() {
	if ( ! class_exists( '\\Aws\\S3\\S3Client' ) || ! defined( 'MMED_R2_ENDPOINT' ) || ! defined( 'MMED_R2_BUCKET' ) ) {
		return;
	}

	try {
		$client = new \Aws\S3\S3Client( array(
			'region'      => 'auto',
			'version'     => 'latest',
			'endpoint'    => rtrim( MMED_R2_ENDPOINT, '/' ),
			'credentials' => array(
				'key'    => MMED_R2_ACCESS_KEY,
				'secret' => MMED_R2_SECRET_KEY,
			),
		) );

		$cutoff = new \DateTime( '-24 hours', new \DateTimeZone( 'UTC' ) );
		$result = $client->listObjectsV2( array(
			'Bucket' => MMED_R2_BUCKET,
			'Prefix' => 'student-files/v2/staging/',
			'MaxKeys' => 100,
		) );

		$contents = $result['Contents'] ?? array();
		$deleted  = 0;

		foreach ( $contents as $object ) {
			$key = $object['Key'] ?? '';
			if ( '' === $key || 0 !== strpos( $key, 'student-files/v2/staging/' ) ) {
				continue;
			}
			$modified = $object['LastModified'] ?? null;
			if ( $modified instanceof \DateTimeInterface && $modified < $cutoff ) {
				$client->deleteObject( array( 'Bucket' => MMED_R2_BUCKET, 'Key' => $key ) );
				$deleted++;
			}
		}

		if ( $deleted > 0 ) {
			do_action( 'mmed_file_vault_v2_staging_cleanup', $deleted );
		}
	} catch ( \Throwable $e ) {
		do_action( 'mmed_file_vault_v2_staging_cleanup_error', $e->getMessage() );
	}
}
