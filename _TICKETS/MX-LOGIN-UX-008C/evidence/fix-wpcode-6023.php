<?php
/**
 * MX-LOGIN-UX-008F: repair the backslash that wp_update_post() stripped from
 * WPCode snippet 6023, and re-assert the "My Matrix" label safely.
 *
 * wp_update_post() runs wp_unslash() on its input, so content passed in raw has
 * one level of backslashes removed. That turned the regex
 *
 *     location.pathname.replace(/\/+$/,'/')
 * into
 *     location.pathname.replace(//+$/,'/')
 *
 * which is a JavaScript syntax error -- `//` opens a line comment -- and would
 * break the entire global header snippet.
 *
 * The fix is to restore the escape and pass the content through wp_slash()
 * so wp_update_post()'s unslash is cancelled out exactly.
 *
 * Run with: wp eval-file fix-wpcode-6023.php --allow-root
 */

$post = get_post( 6023 );
if ( ! $post ) {
	echo "ABORT: post 6023 not found\n";
	exit( 1 );
}

$content = $post->post_content;

$bad  = "replace(//+$/,'/')";
$good = "replace(/\\/+$/,'/')";

$bad_count = substr_count( $content, $bad );

if ( 0 === $bad_count && substr_count( $content, $good ) === 1 ) {
	echo "OK: regex already intact, nothing to repair\n";
} elseif ( 1 !== $bad_count ) {
	echo "ABORT: expected exactly 1 damaged regex, found {$bad_count}\n";
	exit( 1 );
} else {
	$content = str_replace( $bad, $good, $content );
	echo "repaired the stripped backslash\n";
}

// Re-assert the label idempotently.
if ( false !== strpos( $content, '>Members &rarr;<' ) ) {
	$content = str_replace( '>Members &rarr;<', '>My Matrix &rarr;<', $content );
	echo "applied label Members -> My Matrix\n";
}

// wp_slash() cancels the wp_unslash() inside wp_update_post().
$result = wp_update_post(
	array(
		'ID'           => 6023,
		'post_content' => wp_slash( $content ),
	),
	true
);

if ( is_wp_error( $result ) ) {
	echo 'ERROR: ' . $result->get_error_message() . "\n";
	exit( 1 );
}

$after = get_post( 6023 )->post_content;

echo "--- verification ---\n";
echo 'regex intact      : ' . ( substr_count( $after, "replace(/\\/+$/,'/')" ) === 1 ? 'YES' : 'NO' ) . "\n";
echo 'damaged regex     : ' . substr_count( $after, "replace(//+$/,'/')" ) . "\n";
echo 'My Matrix label   : ' . substr_count( $after, '>My Matrix &rarr;<' ) . "\n";
echo 'Members label     : ' . substr_count( $after, '>Members &rarr;<' ) . "\n";
echo 'href preserved    : ' . ( false !== strpos( $after, 'href="https://missionmedinstitute.com/member-dashboard/" class="mm-l5__members"' ) ? 'YES' : 'NO' ) . "\n";
echo 'content length    : ' . strlen( $after ) . "\n";
