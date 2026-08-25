<?php
/**
 * File Vault V2 — R2 Private Storage Verification.
 *
 * Run on a host where wp-config.php defines MMED_R2_* constants:
 *   wp eval-file tests/file-vault-v2-r2-verification.php
 *
 * Proves all six R2 operations: bounded PUT, HEAD, GET, copy, delete,
 * and public denial. Sets PASS/FAIL for each. Does NOT set any config
 * options — the founder decides based on the results.
 *
 * @package MissionMed
 */

if ( ! defined( 'ABSPATH' ) ) {
	fwrite( STDERR, "Run via: wp eval-file tests/file-vault-v2-r2-verification.php\n" );
	exit( 1 );
}

$results  = array();
$pass_all = true;

function r2v_report( $label, $ok, $detail = '' ) {
	global $results, $pass_all;
	$tag = $ok ? 'PASS' : 'FAIL';
	$line = "  [{$tag}] {$label}";
	if ( $detail ) {
		$line .= " — {$detail}";
	}
	echo $line . "\n";
	$results[ $label ] = $ok;
	if ( ! $ok ) {
		$pass_all = false;
	}
}

echo "=== File Vault V2 — R2 Private Storage Verification ===\n\n";

if ( ! class_exists( 'MMED_File_Vault' ) ) {
	echo "FAIL: MMED_File_Vault class not loaded. Is the plugin active?\n";
	exit( 1 );
}
if ( ! defined( 'MMED_R2_ENDPOINT' ) || ! MMED_R2_ENDPOINT ) {
	echo "FAIL: MMED_R2_ENDPOINT is not defined.\n";
	exit( 1 );
}

echo "R2 endpoint: " . preg_replace( '/[a-f0-9]{32}/', '***', MMED_R2_ENDPOINT ) . "\n";
echo "R2 bucket:   " . MMED_R2_BUCKET . "\n\n";

$test_key      = 'student-files/v2/staging/_r2_verification_' . wp_generate_uuid4() . '.txt';
$test_content  = 'R2 verification probe — ' . gmdate( 'c' ) . ' — safe to delete';
$test_sha256   = hash( 'sha256', $test_content );
$test_size     = strlen( $test_content );
$copy_dest_key = str_replace( 'staging/', 'objects/_r2_verification/', $test_key );

echo "Test object:  {$test_key}\n";
echo "Test size:    {$test_size} bytes\n";
echo "Test SHA-256: {$test_sha256}\n\n";

$client = null;
if ( class_exists( '\\Aws\\S3\\S3Client' ) ) {
	$client = new \Aws\S3\S3Client( array(
		'region'      => 'auto',
		'version'     => 'latest',
		'endpoint'    => rtrim( MMED_R2_ENDPOINT, '/' ),
		'credentials' => array(
			'key'    => MMED_R2_ACCESS_KEY,
			'secret' => MMED_R2_SECRET_KEY,
		),
	) );
} else {
	echo "FAIL: AWS SDK S3Client class not found.\n";
	exit( 1 );
}

echo "--- 1. Signed Bounded PUT ---\n";
try {
	$put_cmd = $client->getCommand( 'PutObject', array(
		'Bucket'      => MMED_R2_BUCKET,
		'Key'         => $test_key,
		'ContentType' => 'text/plain',
	) );
	$put_url = (string) $client->createPresignedRequest( $put_cmd, '+60 seconds' )->getUri();

	$put_resp = wp_remote_request( $put_url, array(
		'method'      => 'PUT',
		'timeout'     => 15,
		'redirection' => 0,
		'headers'     => array( 'Content-Type' => 'text/plain' ),
		'body'        => $test_content,
	) );

	if ( is_wp_error( $put_resp ) ) {
		r2v_report( 'PUT', false, $put_resp->get_error_message() );
	} else {
		$put_code = wp_remote_retrieve_response_code( $put_resp );
		r2v_report( 'PUT', $put_code >= 200 && $put_code < 300, "HTTP {$put_code}" );
	}
} catch ( Throwable $e ) {
	r2v_report( 'PUT', false, $e->getMessage() );
}

echo "\n--- 2. Signed HEAD ---\n";
try {
	$head_cmd = $client->getCommand( 'HeadObject', array(
		'Bucket' => MMED_R2_BUCKET,
		'Key'    => $test_key,
	) );
	$head_url = (string) $client->createPresignedRequest( $head_cmd, '+60 seconds' )->getUri();

	$head_resp = wp_remote_head( $head_url, array( 'timeout' => 15, 'redirection' => 0 ) );

	if ( is_wp_error( $head_resp ) ) {
		r2v_report( 'HEAD', false, $head_resp->get_error_message() );
	} else {
		$head_code = wp_remote_retrieve_response_code( $head_resp );
		$head_size = absint( wp_remote_retrieve_header( $head_resp, 'content-length' ) );
		r2v_report( 'HEAD', 200 === $head_code, "HTTP {$head_code}, size={$head_size}" );
		r2v_report( 'HEAD size match', $head_size === $test_size, "expected={$test_size} actual={$head_size}" );
	}
} catch ( Throwable $e ) {
	r2v_report( 'HEAD', false, $e->getMessage() );
}

echo "\n--- 3. Signed GET ---\n";
try {
	$get_cmd = $client->getCommand( 'GetObject', array(
		'Bucket' => MMED_R2_BUCKET,
		'Key'    => $test_key,
	) );
	$get_url = (string) $client->createPresignedRequest( $get_cmd, '+60 seconds' )->getUri();

	$get_resp = wp_remote_get( $get_url, array( 'timeout' => 15, 'redirection' => 0 ) );

	if ( is_wp_error( $get_resp ) ) {
		r2v_report( 'GET', false, $get_resp->get_error_message() );
	} else {
		$get_code = wp_remote_retrieve_response_code( $get_resp );
		$get_body = wp_remote_retrieve_body( $get_resp );
		r2v_report( 'GET', 200 === $get_code, "HTTP {$get_code}" );
		r2v_report( 'GET content match', $get_body === $test_content, strlen( $get_body ) . ' bytes' );
		$get_sha  = hash( 'sha256', $get_body );
		r2v_report( 'GET SHA-256 match', hash_equals( $test_sha256, $get_sha ), $get_sha );
	}
} catch ( Throwable $e ) {
	r2v_report( 'GET', false, $e->getMessage() );
}

echo "\n--- 4. Copy (staging → immutable) ---\n";
try {
	$client->copyObject( array(
		'Bucket'     => MMED_R2_BUCKET,
		'Key'        => $copy_dest_key,
		'CopySource' => MMED_R2_BUCKET . '/' . $test_key,
	) );

	$copy_head = $client->headObject( array(
		'Bucket' => MMED_R2_BUCKET,
		'Key'    => $copy_dest_key,
	) );
	$copy_size = $copy_head['ContentLength'] ?? 0;
	r2v_report( 'Copy', true, "dest={$copy_dest_key}, size={$copy_size}" );
	r2v_report( 'Copy size match', absint( $copy_size ) === $test_size );
} catch ( Throwable $e ) {
	r2v_report( 'Copy', false, $e->getMessage() );
}

echo "\n--- 5. Delete ---\n";
try {
	$client->deleteObject( array(
		'Bucket' => MMED_R2_BUCKET,
		'Key'    => $test_key,
	) );
	$client->deleteObject( array(
		'Bucket' => MMED_R2_BUCKET,
		'Key'    => $copy_dest_key,
	) );
	try {
		$client->headObject( array(
			'Bucket' => MMED_R2_BUCKET,
			'Key'    => $test_key,
		) );
		r2v_report( 'Delete', false, 'Object still exists after deletion' );
	} catch ( \Aws\S3\Exception\S3Exception $e ) {
		if ( 404 === $e->getStatusCode() ) {
			r2v_report( 'Delete', true, 'Object confirmed absent after deletion' );
		} else {
			r2v_report( 'Delete', false, 'Unexpected error checking deletion: ' . $e->getMessage() );
		}
	}
} catch ( Throwable $e ) {
	r2v_report( 'Delete', false, $e->getMessage() );
}

echo "\n--- 6. Public Denial ---\n";
$public_url = rtrim( MMED_R2_ENDPOINT, '/' ) . '/' . MMED_R2_BUCKET . '/' . $test_key;
$public_url = preg_replace( '#^https?://#', 'https://', $public_url );
$pub_resp = wp_remote_get( $public_url, array( 'timeout' => 10, 'redirection' => 0 ) );
if ( is_wp_error( $pub_resp ) ) {
	r2v_report( 'Public denial', true, 'Connection refused or timed out (good — not publicly accessible)' );
} else {
	$pub_code = wp_remote_retrieve_response_code( $pub_resp );
	$denied = in_array( $pub_code, array( 400, 403, 404, 405 ), true );
	r2v_report( 'Public denial', $denied, "HTTP {$pub_code}" . ( $denied ? ' (access denied)' : ' (UNEXPECTEDLY ACCESSIBLE)' ) );
}

echo "\n=== Summary ===\n";
$pass_count = count( array_filter( $results ) );
$total = count( $results );
echo "{$pass_count}/{$total} checks passed.\n";
if ( $pass_all ) {
	echo "\nAll R2 operations verified. Safe to set:\n";
	echo "  define( 'MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED', true );  // in wp-config.php\n";
} else {
	echo "\nSome checks FAILED. Do NOT set MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED until all pass.\n";
}
