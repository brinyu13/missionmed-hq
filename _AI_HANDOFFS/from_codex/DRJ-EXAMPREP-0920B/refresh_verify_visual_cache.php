<?php

defined( 'ABSPATH' ) || exit;

$snippet_id = 5973;
$daily_id   = 9136;
$arena_id   = 9137;
$snippet    = (string) get_post_field( 'post_content', $snippet_id );

$preflight = array(
	'snippet_sha256'        => hash( 'sha256', $snippet ),
	'preview_image_count'   => substr_count( $snippet, 'mm-tier-preview-image' ),
	'on_demand_label_count' => substr_count( $snippet, '>On-Demand<' ),
	'daily_image_present'   => false !== strpos( $snippet, 'mmdrj-daily-rounds-on-demand-' ),
	'arena_image_present'   => false !== strpos( $snippet, 'mmdrj-arena-lobby-' ),
	'daily_product_image'   => (int) wc_get_product( 6360 )->get_image_id(),
	'arena_product_image'   => (int) wc_get_product( 9017 )->get_image_id(),
	'daily_source_sha256'   => get_post_meta( $daily_id, '_mmdrj_source_sha256', true ),
	'arena_source_sha256'   => get_post_meta( $arena_id, '_mmdrj_source_sha256', true ),
);

if (
	2 !== $preflight['preview_image_count']
	|| 1 !== $preflight['on_demand_label_count']
	|| ! $preflight['daily_image_present']
	|| ! $preflight['arena_image_present']
	|| $daily_id !== $preflight['daily_product_image']
	|| $arena_id !== $preflight['arena_product_image']
	|| '453098b43f88a23cab1477388bd33b7f87bc8b1ae93605f213eb4bee22efa18e' !== $preflight['daily_source_sha256']
	|| 'e00bf02ccebd3e2166600f391cb8e24fd030d652f586cbaef9665602ef67438a' !== $preflight['arena_source_sha256']
) {
	throw new RuntimeException( 'Visual provider readback failed before cache refresh.' );
}

if ( function_exists( 'wpcode' ) && isset( wpcode()->cache ) ) {
	wpcode()->cache->delete_cache();
	wpcode()->cache->cache_all_loaded_snippets();
}
if ( function_exists( 'wpcode_clear_all_plugins_page_cache' ) ) {
	wpcode_clear_all_plugins_page_cache( 'DRJ-EXAMPREP-0920B-visuals' );
}
clean_post_cache( $snippet_id );
if ( function_exists( 'wp_cache_flush' ) ) {
	wp_cache_flush();
}

$cached = get_option( 'wpcode_snippets', array() );
$cached_json = wp_json_encode( $cached, JSON_UNESCAPED_SLASHES );

echo wp_json_encode(
	array(
		'verified'                   => true,
		'preflight'                  => $preflight,
		'wpcode_cache_daily_present' => false !== strpos( $cached_json, 'mmdrj-daily-rounds-on-demand-' ),
		'wpcode_cache_arena_present' => false !== strpos( $cached_json, 'mmdrj-arena-lobby-' ),
		'daily_large_url'            => wp_get_attachment_image_url( $daily_id, 'large' ),
		'arena_large_url'            => wp_get_attachment_image_url( $arena_id, 'large' ),
		'money_moved_cents'          => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
