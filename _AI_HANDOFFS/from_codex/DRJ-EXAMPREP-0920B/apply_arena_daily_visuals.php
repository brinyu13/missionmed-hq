<?php

defined( 'ABSPATH' ) || exit;

$ticket       = 'DRJ-EXAMPREP-0920B';
$snippet_id   = 5973;
$daily_id     = 6360;
$arena_id     = 9017;
$daily_source = '/tmp/mmdrj-daily-rounds-on-demand.png';
$arena_source = '/tmp/mmdrj-arena-lobby.png';

$assets = array(
	'daily' => array(
		'path'  => $daily_source,
		'sha'   => '453098b43f88a23cab1477388bd33b7f87bc8b1ae93605f213eb4bee22efa18e',
		'key'   => 'drj-examprep-daily-rounds-on-demand-20260921',
		'title' => 'Drills: Daily Rounds (On-Demand)',
		'alt'   => 'Preview of the Drills: Daily Rounds on-demand practice player',
	),
	'arena' => array(
		'path'  => $arena_source,
		'sha'   => 'e00bf02ccebd3e2166600f391cb8e24fd030d652f586cbaef9665602ef67438a',
		'key'   => 'drj-examprep-arena-lobby-20260921',
		'title' => 'MissionMed Arena',
		'alt'   => 'Preview of the MissionMed Arena lobby',
	),
);

foreach ( $assets as $asset ) {
	if ( ! is_readable( $asset['path'] ) || hash_file( 'sha256', $asset['path'] ) !== $asset['sha'] ) {
		throw new RuntimeException( 'Visual asset preflight failed for ' . $asset['key'] . '.' );
	}
}

$daily_product = wc_get_product( $daily_id );
$arena_product = wc_get_product( $arena_id );
if (
	! $daily_product
	|| ! $arena_product
	|| 'subscription' !== $daily_product->get_type()
	|| 'subscription' !== $arena_product->get_type()
	|| '99.99' !== number_format( (float) $daily_product->get_price(), 2, '.', '' )
	|| '149.99' !== number_format( (float) $arena_product->get_price(), 2, '.', '' )
) {
	throw new RuntimeException( 'Product identity preflight failed.' );
}

$snippet = (string) get_post_field( 'post_content', $snippet_id );
$old_daily = '<article class="mm-tier"><h3>Drills: Daily Rounds Access</h3><div class="mm-tier-price"><span class="num">$99.99</span><span class="unit">/ month</span></div><p>Daily Rounds only. STAT, TournaMed, and Arena Pro tools are not included. Active Live Drills students: $19.99/month. Approved Exam Guarantee, UCC, or MUL students: $49.99/month.</p><a class="mm-pg-cta-secondary" href="/product/dr-j-drills-on-call/">View Daily Rounds</a></article>';
$old_arena = '<article class="mm-tier" id="exam-prep-arena-pro"><h3>🔒 ExamPrep: Arena Pro</h3><div class="mm-tier-price"><span class="num">$149.99</span><span class="unit">/ month</span></div><p>Coming Soon. Premium digital ExamPrep tier; checkout and premium access are locked.</p><span class="mm-pg-cta-secondary" role="link" aria-disabled="true">Coming Soon</span></article>';

if ( 1 !== substr_count( $snippet, $old_daily ) || 1 !== substr_count( $snippet, $old_arena ) ) {
	throw new RuntimeException( 'Expected pricing-card preimage was not found exactly once.' );
}

$backup_root = dirname( rtrim( ABSPATH, '/' ) ) . '/private/codex-backups/' . $ticket;
if ( ! is_dir( $backup_root ) && ! wp_mkdir_p( $backup_root ) ) {
	throw new RuntimeException( 'Could not create the private rollback directory.' );
}
@chmod( $backup_root, 0700 );

$backup_file = $backup_root . '/visuals-preimage-' . gmdate( 'Ymd-His' ) . '.json';
$preimage    = array(
	'captured_at_utc' => gmdate( 'c' ),
	'snippet'         => array(
		'id'      => $snippet_id,
		'sha256'  => hash( 'sha256', $snippet ),
		'content' => $snippet,
	),
	'products'        => array(
		$daily_id => array( 'image_id' => $daily_product->get_image_id() ),
		$arena_id => array( 'image_id' => $arena_product->get_image_id() ),
	),
	'assets'          => array(),
);

foreach ( $assets as $name => $asset ) {
	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_mmdrj_asset_key',
			'meta_value'     => $asset['key'],
		)
	);
	$preimage['assets'][ $name ] = array(
		'asset_key'              => $asset['key'],
		'existing_attachment_id' => $existing ? (int) $existing[0] : 0,
	);
}

if ( false === file_put_contents( $backup_file, wp_json_encode( $preimage, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), LOCK_EX ) ) {
	throw new RuntimeException( 'Could not write the visual rollback preimage.' );
}
@chmod( $backup_file, 0600 );

require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

function mmdrj_0920b_import_visual( $asset ) {
	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_mmdrj_asset_key',
			'meta_value'     => $asset['key'],
		)
	);
	if ( $existing ) {
		$attachment_id = (int) $existing[0];
		if ( get_post_meta( $attachment_id, '_mmdrj_source_sha256', true ) !== $asset['sha'] ) {
			throw new RuntimeException( 'Existing visual has an unexpected source hash.' );
		}
		return array( 'id' => $attachment_id, 'created' => false );
	}

	$file_array = array(
		'name'     => sanitize_file_name( basename( $asset['path'] ) ),
		'tmp_name' => $asset['path'],
	);
	$attachment_id = media_handle_sideload(
		$file_array,
		0,
		$asset['title'],
		array(
			'post_title'  => $asset['title'],
			'post_status' => 'inherit',
		)
	);
	if ( is_wp_error( $attachment_id ) ) {
		throw new RuntimeException( 'Media import failed: ' . $attachment_id->get_error_message() );
	}
	update_post_meta( $attachment_id, '_wp_attachment_image_alt', $asset['alt'] );
	update_post_meta( $attachment_id, '_mmdrj_asset_key', $asset['key'] );
	update_post_meta( $attachment_id, '_mmdrj_source_sha256', $asset['sha'] );
	update_post_meta( $attachment_id, '_mmdrj_ticket', 'DRJ-EXAMPREP-0920B' );
	return array( 'id' => (int) $attachment_id, 'created' => true );
}

$daily_asset = mmdrj_0920b_import_visual( $assets['daily'] );
$arena_asset = mmdrj_0920b_import_visual( $assets['arena'] );

$image_attrs = array(
	'class'    => 'mm-tier-preview-image',
	'loading'  => 'lazy',
	'decoding' => 'async',
	'style'    => 'display:block;width:100%;height:100%;object-fit:cover;object-position:center;',
);
$daily_image = wp_get_attachment_image( $daily_asset['id'], 'large', false, $image_attrs );
$arena_image = wp_get_attachment_image( $arena_asset['id'], 'large', false, $image_attrs );
if ( ! $daily_image || ! $arena_image ) {
	throw new RuntimeException( 'Responsive image markup could not be generated.' );
}

$daily_figure = '<figure class="mm-tier-preview" style="margin:0 0 18px;aspect-ratio:16/10;overflow:hidden;border-radius:12px;background:#081b2d;">' . $daily_image . '</figure>';
$arena_figure = '<figure class="mm-tier-preview" style="margin:0 0 18px;aspect-ratio:16/10;overflow:hidden;border-radius:12px;background:#081b2d;">' . $arena_image . '</figure>';
$new_daily = '<article class="mm-tier">' . $daily_figure . '<h3>Drills: Daily Rounds Access</h3><p class="mm-tier-kicker" style="margin:-4px 0 10px;color:#c9952f;font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">On-Demand</p><div class="mm-tier-price"><span class="num">$99.99</span><span class="unit">/ month</span></div><p>Daily Rounds only. STAT, TournaMed, and Arena Pro tools are not included. Active Live Drills students: $19.99/month. Approved Exam Guarantee, UCC, or MUL students: $49.99/month.</p><a class="mm-pg-cta-secondary" href="/product/dr-j-drills-on-call/">View Daily Rounds</a></article>';
$new_arena = '<article class="mm-tier" id="exam-prep-arena-pro">' . $arena_figure . '<h3>🔒 ExamPrep: Arena Pro</h3><div class="mm-tier-price"><span class="num">$149.99</span><span class="unit">/ month</span></div><p>Coming Soon. Premium digital ExamPrep tier; checkout and premium access are locked.</p><span class="mm-pg-cta-secondary" role="link" aria-disabled="true">Coming Soon</span></article>';

$updated = str_replace( $old_daily, $new_daily, $snippet, $daily_count );
$updated = str_replace( $old_arena, $new_arena, $updated, $arena_count );
if ( 1 !== $daily_count || 1 !== $arena_count ) {
	throw new RuntimeException( 'Pricing-card replacement count was not exact.' );
}

$updated_post_id = wp_update_post(
	array(
		'ID'           => $snippet_id,
		'post_content' => $updated,
	),
	true
);
if ( is_wp_error( $updated_post_id ) ) {
	throw new RuntimeException( 'WPCode pricing update failed: ' . $updated_post_id->get_error_message() );
}

$daily_product->set_image_id( $daily_asset['id'] );
$daily_product->save();
$arena_product->set_image_id( $arena_asset['id'] );
$arena_product->save();

foreach ( array( $snippet_id, $daily_id, $arena_id, $daily_asset['id'], $arena_asset['id'] ) as $id ) {
	clean_post_cache( $id );
}
if ( function_exists( 'wp_cache_flush' ) ) {
	wp_cache_flush();
}
if ( function_exists( 'wpcode' ) && isset( wpcode()->cache ) ) {
	wpcode()->cache->delete_cache();
	wpcode()->cache->cache_all_loaded_snippets();
}
if ( function_exists( 'wpcode_clear_all_plugins_page_cache' ) ) {
	wpcode_clear_all_plugins_page_cache( 'DRJ-EXAMPREP-0920B-visuals' );
}

$verified_snippet = (string) get_post_field( 'post_content', $snippet_id );
$daily_full_url = wp_get_attachment_url( $daily_asset['id'] );
$arena_full_url = wp_get_attachment_url( $arena_asset['id'] );
$result = array(
	'applied'                 => true,
	'backup_file'             => $backup_file,
	'snippet_id'              => $snippet_id,
	'snippet_sha256'          => hash( 'sha256', $verified_snippet ),
	'daily_attachment_id'     => $daily_asset['id'],
	'daily_attachment_created'=> $daily_asset['created'],
	'daily_image_url'         => wp_get_attachment_image_url( $daily_asset['id'], 'large' ),
	'arena_attachment_id'     => $arena_asset['id'],
	'arena_attachment_created'=> $arena_asset['created'],
	'arena_image_url'         => wp_get_attachment_image_url( $arena_asset['id'], 'large' ),
	'daily_product_image_id'  => wc_get_product( $daily_id )->get_image_id(),
	'arena_product_image_id'  => wc_get_product( $arena_id )->get_image_id(),
	'daily_card_image_present'=> $daily_full_url && false !== strpos( $verified_snippet, wp_basename( $daily_full_url ) ),
	'arena_card_image_present'=> $arena_full_url && false !== strpos( $verified_snippet, wp_basename( $arena_full_url ) ),
	'money_moved_cents'       => 0,
);

echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
