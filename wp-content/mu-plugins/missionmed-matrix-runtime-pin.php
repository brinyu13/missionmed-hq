<?php
/**
 * Pin the Matrix student runtime to the MX-DASH-6020A immutable asset.
 *
 * WHY THIS EXISTS
 * The Matrix runtime ships as an immutable, content-hashed filename with a null
 * WordPress enqueue version, and the filename is hard-coded inside
 * `missionmed-hub/includes/class-mmed-student-os.php`. That file is a
 * runtime-locked asset under `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
 * and MX-LOGIN-UX-008 was granted an override for `student_os_js` and
 * `student_os_css` only -- not for the PHP.
 *
 * Publishing a new correctly-hashed asset and repointing the enqueue from here
 * satisfies both constraints at once:
 *
 *   - the new runtime ships under a filename that genuinely matches its own
 *     content hash, so the immutable-filename contract is honoured rather than
 *     compounded (two existing production files were previously overwritten in
 *     place and their names no longer describe their contents);
 *   - no runtime-locked file is modified.
 *
 * `wp_localize_script()` binds `mmedStudentOsFeatureFlags` to the script HANDLE,
 * not to its URL, so swapping the src leaves localization, dependencies and
 * footer placement untouched.
 *
 * FAIL-SAFE: if the pinned asset is not present on disk, the original src is
 * returned unchanged. A partially completed upload therefore degrades to the
 * previous working runtime rather than a blank Matrix.
 *
 * ROLLBACK: delete this file. The hub plugin immediately resumes serving
 * whichever asset its own PHP names.
 *
 * @package MissionMed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Filename of the Matrix student runtime this ticket published.
 *
 * The basename is the first 16 hex characters of the file's own SHA-256:
 * 38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a
 */
const MMED_MATRIX_RUNTIME_PINNED_ASSET = 'student-os.38507e1ac8a555ba.js';

/**
 * Repoint the Matrix student runtime script to the pinned immutable asset.
 *
 * @param string $src    Script source URL.
 * @param string $handle Script handle.
 * @return string
 */
function mmed_matrix_runtime_pin_src( $src, $handle ) {
	if ( 'mmed-student-os-js' !== $handle || ! is_string( $src ) ) {
		return $src;
	}

	$pinned = (string) apply_filters( 'mmed_matrix_runtime_pinned_asset', MMED_MATRIX_RUNTIME_PINNED_ASSET );

	if ( '' === $pinned || false !== strpos( $src, $pinned ) ) {
		return $src;
	}

	// Fail safe: never point at an asset that is not actually on disk.
	$plugin_dir = defined( 'WP_PLUGIN_DIR' ) ? WP_PLUGIN_DIR : WP_CONTENT_DIR . '/plugins';
	if ( ! file_exists( $plugin_dir . '/missionmed-hub/assets/' . $pinned ) ) {
		return $src;
	}

	$swapped = preg_replace( '#student-os\.[0-9a-f]{16}\.js#', $pinned, $src, 1 );

	return is_string( $swapped ) && '' !== $swapped ? $swapped : $src;
}

add_filter( 'script_loader_src', 'mmed_matrix_runtime_pin_src', 20, 2 );
