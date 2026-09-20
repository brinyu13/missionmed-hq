<?php
defined( 'ABSPATH' ) || exit;

global $wpdb;

$needles = array(
	'499 total',
	'secure Zelle instructions',
);

$rows = array();
foreach ( $needles as $needle ) {
	$matches = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT ID, post_type, post_status, post_title FROM {$wpdb->posts} WHERE post_content LIKE %s ORDER BY ID",
			'%' . $wpdb->esc_like( $needle ) . '%'
		),
		ARRAY_A
	);
	foreach ( $matches as $match ) {
		$rows[ (int) $match['ID'] ] = $match;
	}
}

$options = array();
foreach ( $needles as $needle ) {
	$matches = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT option_name, autoload FROM {$wpdb->options} WHERE option_value LIKE %s ORDER BY option_name",
			'%' . $wpdb->esc_like( $needle ) . '%'
		),
		ARRAY_A
	);
	foreach ( $matches as $match ) {
		$options[ $match['option_name'] ] = $match;
	}
}

echo wp_json_encode(
	array(
		'posts'   => array_values( $rows ),
		'options' => array_values( $options ),
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
