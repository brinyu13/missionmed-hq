<?php
defined( 'ABSPATH' ) || exit;

global $wpdb;

$find = static function ( $needle ) use ( $wpdb ) {
	$like = '%' . $wpdb->esc_like( $needle ) . '%';
	return array(
		'posts' => array_map( 'absint', $wpdb->get_col( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_content LIKE %s ORDER BY ID", $like ) ) ),
		'meta' => $wpdb->get_results( $wpdb->prepare( "SELECT post_id, meta_key FROM {$wpdb->postmeta} WHERE meta_value LIKE %s ORDER BY post_id, meta_key LIMIT 50", $like ), ARRAY_A ),
	);
};

echo wp_json_encode(
	array(
		'team_of_strangers' => $find( 'team of strangers' ),
		'team_of_experts' => $find( 'team of experts' ),
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
