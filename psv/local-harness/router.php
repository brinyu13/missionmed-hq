<?php
$path = parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
if ( $path !== '/' && file_exists( __DIR__ . '/../site' . $path ) && ! is_dir( __DIR__ . '/../site' . $path ) ) { return false; }
if ( $path !== '/' && is_dir( __DIR__ . '/../site' . $path ) && file_exists( __DIR__ . '/../site' . rtrim( $path, '/' ) . '/index.php' ) ) { chdir( __DIR__ . '/../site' . rtrim( $path, '/' ) ); require __DIR__ . '/../site' . rtrim( $path, '/' ) . '/index.php'; return; }
chdir( __DIR__ . '/../site' ); require __DIR__ . '/../site/index.php';
