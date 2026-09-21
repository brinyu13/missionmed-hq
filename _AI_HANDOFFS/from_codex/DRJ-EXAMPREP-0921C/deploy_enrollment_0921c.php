<?php
defined( 'ABSPATH' ) || exit;

$mu_dir          = WP_CONTENT_DIR . '/mu-plugins';
$commerce_path   = $mu_dir . '/missionmed-drj-examprep-commerce.php';
$experience_path = $mu_dir . '/missionmed-examprep-enrollment.php';
$candidate_trade = '/tmp/missionmed-drj-examprep-commerce-0921c.php';
$candidate_page  = '/tmp/missionmed-examprep-enrollment-0921c.php';
$expected_live   = 'f17dd231bd09fe474fc67bbbb36850a2cdda2572133f85ebe2597ef0d6744f20';

if ( ! is_file( $commerce_path ) || $expected_live !== hash_file( 'sha256', $commerce_path ) ) {
	throw new RuntimeException( 'Commerce preimage hash mismatch.' );
}
if ( is_file( $experience_path ) ) {
	throw new RuntimeException( 'Enrollment experience plugin already exists; refusing first-deploy overwrite.' );
}
foreach ( array( $candidate_trade, $candidate_page ) as $candidate ) {
	if ( ! is_file( $candidate ) || ! is_readable( $candidate ) ) {
		throw new RuntimeException( 'Missing deployment candidate: ' . $candidate );
	}
}
foreach ( array( 3651, 3668, 6360, 9015, 9016, 9017, 9109 ) as $product_id ) {
	if ( ! wc_get_product( $product_id ) ) {
		throw new RuntimeException( 'Required product missing: ' . $product_id );
	}
}
if ( '300.00' !== number_format( (float) wc_get_product( 3668 )->get_price(), 2, '.', '' ) ) {
	throw new RuntimeException( 'Live Drills variation price changed unexpectedly.' );
}

$backup_root = dirname( rtrim( ABSPATH, '/' ) ) . '/private/codex-backups/DRJ-EXAMPREP-0921C/' . gmdate( 'Ymd-His' ) . '-enrollment';
if ( ! wp_mkdir_p( $backup_root ) ) {
	throw new RuntimeException( 'Could not create enrollment rollback directory.' );
}
chmod( $backup_root, 0700 );
copy( $commerce_path, $backup_root . '/missionmed-drj-examprep-commerce.php' );
chmod( $backup_root . '/missionmed-drj-examprep-commerce.php', 0600 );

$preimage = array( 'created_at' => gmdate( 'c' ), 'products' => array() );
foreach ( array( 3651, 3668, 6360, 9015, 9016, 9017, 9109 ) as $product_id ) {
	$product = wc_get_product( $product_id );
	$preimage['products'][ $product_id ] = array(
		'name'         => $product->get_name(),
		'price'        => $product->get_price(),
		'image_id'     => $product->get_image_id(),
		'gallery'      => get_post_meta( $product_id, '_product_image_gallery', true ),
		'short'        => $product->get_short_description(),
		'description'  => $product->get_description(),
		'trial_length' => get_post_meta( $product_id, '_subscription_trial_length', true ),
		'trial_period' => get_post_meta( $product_id, '_subscription_trial_period', true ),
	);
}
file_put_contents( $backup_root . '/product-preimage.json', wp_json_encode( $preimage, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), LOCK_EX );
chmod( $backup_root . '/product-preimage.json', 0600 );

foreach ( array( 3651, 3668 ) as $product_id ) {
	update_post_meta( $product_id, '_subscription_trial_length', '1' );
	update_post_meta( $product_id, '_subscription_trial_period', 'week' );
}

$live = wc_get_product( 3651 );
$live->set_short_description( 'First week free: attend up to five consecutive weekday sessions. Then $300/month. Card required; cancel before the 7-day trial ends to avoid the first charge.' );
$live->save();

$variation = wc_get_product( 3668 );
$variation->set_description( 'Step 1 / Level 1 track. First week free, then $300/month. Foundational drilling focused on mechanisms, integration, and exam logic.' );
$variation->save();

$daily = wc_get_product( 6360 );
$daily->set_short_description( 'On-demand Daily Rounds inside Arena with Dr. J video prompts, answer controls, pressure modes, progress, and performance feedback.' );
$daily->set_description( '<h2>Train the pattern on demand.</h2><p>Daily Rounds is the current on-demand Drills mode inside MissionMed Arena. Work focused topic prompts with Dr. J video, mark each response Correct, Missed, or Out of Time, adjust the pressure mode, and keep performance feedback visible while you train.</p><ul><li>Focused topic rounds</li><li>Dr. J video prompts</li><li>Normal, Fast, and Extreme pressure modes</li><li>Visible scoring, timing, and round progress</li><li>Repeatable practice for pattern recognition</li></ul><p><strong>Access boundary:</strong> this subscription grants Daily Rounds only. Live Dr. J sessions, STAT, TournaMed, and Arena Pro tools are not included.</p>' );
$daily->save();

$planning = wc_get_product( 9015 );
$planning->set_image_id( 3674 );
$planning->set_short_description( 'A focused 30-minute planning session with Dr. J for priorities, sequencing, workload, and recovery—not a tutoring hour.' );
$planning->set_description( '<h2>Leave with a plan you can actually run.</h2><p>Use this focused 30-minute session to organize priorities, topics, timing, question-bank work, and recovery around your exam date and real-life constraints.</p><p>This is study planning, not a full tutoring hour.</p>' );
$planning->save();

$pack = wc_get_product( 9016 );
$pack->set_image_id( 3674 );
$pack->set_short_description( 'Ten full one-hour private tutoring sessions with Dr. J. One-time $800 purchase; no subscription.' );
$pack->set_description( '<h2>Ten sessions. One focused coaching arc.</h2><p>This one-time package includes ten full one-hour private tutoring sessions with Dr. J for students who want sustained work on reasoning gaps, topic weaknesses, and exam technique.</p><p>No subscription.</p>' );
$pack->save();

$addon = wc_get_product( 9109 );
$addon->set_image_id( 9136 );
$addon->save();

if ( ! copy( $candidate_trade, $commerce_path ) || ! copy( $candidate_page, $experience_path ) ) {
	throw new RuntimeException( 'Could not install enrollment source.' );
}
chmod( $commerce_path, 0644 );
chmod( $experience_path, 0644 );

foreach ( array( 3651, 3668, 6360, 9015, 9016, 9017, 9109, 5687 ) as $id ) {
	clean_post_cache( $id );
}
wp_cache_flush();
if ( function_exists( 'wpcode' ) && is_object( wpcode() ) && isset( wpcode()->cache ) ) {
	wpcode()->cache->cache_all_loaded_snippets();
}
if ( class_exists( '\\Elementor\\Plugin' ) && isset( \Elementor\Plugin::$instance->files_manager ) ) {
	\Elementor\Plugin::$instance->files_manager->clear_cache();
}

$live_check = wc_get_product( 3668 );
$result = array(
	'deployed'             => true,
	'backup_root'          => $backup_root,
	'commerce_sha256'      => hash_file( 'sha256', $commerce_path ),
	'experience_sha256'    => hash_file( 'sha256', $experience_path ),
	'trial_length'         => WC_Subscriptions_Product::get_trial_length( $live_check ),
	'trial_period'         => WC_Subscriptions_Product::get_trial_period( $live_check ),
	'planning_image_id'    => wc_get_product( 9015 )->get_image_id(),
	'tutor_pack_image_id'  => wc_get_product( 9016 )->get_image_id(),
	'addon_image_id'       => wc_get_product( 9109 )->get_image_id(),
	'money_moved_cents'    => 0,
);
echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
