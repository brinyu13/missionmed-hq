<?php
/**
 * Plugin Name: MissionMed Global Auth UI
 * Description: Header auth UI layer for canonical Login/Profile/Logout with legacy account-icon cleanup.
 * Author: MissionMed
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'mm_global_auth_ui_is_frontend' ) ) {
	function mm_global_auth_ui_is_frontend() {
		return ! is_admin() && ! wp_doing_ajax();
	}
}

if ( ! function_exists( 'mm_global_auth_ui_current_request_url' ) ) {
	function mm_global_auth_ui_current_request_url() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
		$request_uri = '' !== trim( $request_uri ) ? $request_uri : '/';
		if ( 0 !== strpos( $request_uri, '/' ) ) {
			$request_uri = '/' . ltrim( $request_uri, '/' );
		}
		return home_url( $request_uri );
	}
}

if ( ! function_exists( 'mm_global_auth_ui_build_login_url' ) ) {
	function mm_global_auth_ui_build_login_url( $target = '' ) {
		$target_url = is_string( $target ) && '' !== trim( $target ) ? trim( $target ) : mm_global_auth_ui_current_request_url();
		return add_query_arg( 'redirect_to', $target_url, home_url( '/my-account/' ) );
	}
}

if ( ! function_exists( 'mm_global_auth_ui_build_logout_url' ) ) {
	function mm_global_auth_ui_build_logout_url() {
		return add_query_arg( 'action', 'logout', home_url( '/wp-login.php' ) );
	}
}

if ( ! function_exists( 'mm_global_auth_ui_menu_signature' ) ) {
	function mm_global_auth_ui_menu_signature( $args ) {
		$location = isset( $args->theme_location ) ? (string) $args->theme_location : '';
		$menu     = isset( $args->menu ) ? $args->menu : '';
		$menu_id  = '';

		if ( is_object( $menu ) && isset( $menu->term_id ) ) {
			$menu_id = (string) $menu->term_id;
		} elseif ( is_numeric( $menu ) || is_string( $menu ) ) {
			$menu_id = (string) $menu;
		}

		return strtolower( $location . '|' . $menu_id );
	}
}

if ( ! function_exists( 'mm_global_auth_ui_is_target_menu' ) ) {
	function mm_global_auth_ui_is_target_menu( $args ) {
		static $selected_signature = null;

		$location = isset( $args->theme_location ) ? strtolower( (string) $args->theme_location ) : '';
		$signature = mm_global_auth_ui_menu_signature( $args );

		if ( null !== $selected_signature ) {
			return $selected_signature === $signature;
		}

		if ( '' !== $location && false !== strpos( $location, 'footer' ) ) {
			return false;
		}

		if ( '' !== $location && preg_match( '/(primary|main|header|top|menu-1|ast)/', $location ) ) {
			$selected_signature = $signature;
			return true;
		}

		if ( '' === $location ) {
			$selected_signature = $signature;
			return true;
		}

		return false;
	}
}

if ( ! function_exists( 'mm_global_auth_ui_is_legacy_account_item' ) ) {
	function mm_global_auth_ui_is_legacy_account_item( $item ) {
		if ( ! isset( $item->url ) ) {
			return false;
		}

		$url = trim( (string) $item->url );
		if ( '' === $url ) {
			return false;
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );
		if ( ! is_string( $path ) || '' === $path ) {
			return false;
		}

		$normalized_path = '/' . trim( $path, '/' );
		if ( '/my-account' !== $normalized_path && 0 !== strpos( $normalized_path, '/my-account/' ) ) {
			return false;
		}

		$title      = strtolower( trim( wp_strip_all_tags( (string) $item->title ) ) );
		$attr_title = strtolower( trim( (string) $item->attr_title ) );
		$classes    = array_map( 'strtolower', array_filter( (array) $item->classes ) );

		$looks_like_icon = false;

		if ( '' === $title || preg_match( '/^[^a-z0-9]+$/', $title ) ) {
			$looks_like_icon = true;
		}

		foreach ( $classes as $class_name ) {
			if (
				false !== strpos( $class_name, 'icon' ) ||
				false !== strpos( $class_name, 'account' ) ||
				false !== strpos( $class_name, 'user' ) ||
				false !== strpos( $class_name, 'login' )
			) {
				$looks_like_icon = true;
				break;
			}
		}

		if ( ! $looks_like_icon && in_array( $title, array( 'account', 'my account', 'profile', 'login', 'user' ), true ) ) {
			$looks_like_icon = true;
		}

		if ( ! $looks_like_icon && '' !== $attr_title && preg_match( '/(account|login|profile|user)/', $attr_title ) ) {
			$looks_like_icon = true;
		}

		return $looks_like_icon;
	}
}

if ( ! function_exists( 'mm_global_auth_ui_prune_legacy_account_icons' ) ) {
	function mm_global_auth_ui_prune_legacy_account_icons( $items, $args ) {
		if ( ! mm_global_auth_ui_is_frontend() || ! mm_global_auth_ui_is_target_menu( $args ) ) {
			return $items;
		}

		$filtered = array();
		foreach ( (array) $items as $item ) {
			if ( mm_global_auth_ui_is_legacy_account_item( $item ) ) {
				continue;
			}

			$item_url = isset( $item->url ) ? trim( (string) $item->url ) : '';
			if ( '' !== $item_url ) {
				$item_path  = wp_parse_url( $item_url, PHP_URL_PATH );
				$item_query = wp_parse_url( $item_url, PHP_URL_QUERY );
				$path       = is_string( $item_path ) ? '/' . trim( $item_path, '/' ) : '';
				$query_args = array();
				if ( is_string( $item_query ) && '' !== $item_query ) {
					wp_parse_str( $item_query, $query_args );
				}

				// Remove legacy/non-canonical auth endpoints so one canonical auth slot owns the header.
				if (
					'/my-account/customer-logout' === $path ||
					'/wp-login.php' === $path ||
					( isset( $query_args['action'] ) && 'logout' === (string) $query_args['action'] )
				) {
					continue;
				}
			}

			$filtered[] = $item;
		}

		return $filtered;
	}
}

if ( ! function_exists( 'mm_global_auth_ui_slot_markup' ) ) {
	function mm_global_auth_ui_slot_markup() {
		$login_url    = mm_global_auth_ui_build_login_url();
		$register_url = add_query_arg( 'action', 'register', home_url( '/my-account/' ) );
		$dashboard    = home_url( '/my-account/' );
		$logout_url   = mm_global_auth_ui_build_logout_url();

		if ( is_user_logged_in() ) {
			$user      = wp_get_current_user();
			$seed      = '';
			$seed      = ! empty( $user->display_name ) ? (string) $user->display_name : $seed;
			$seed      = '' === $seed && ! empty( $user->user_login ) ? (string) $user->user_login : $seed;
			$seed      = '' === $seed ? 'U' : $seed;
			$initial   = strtoupper( substr( trim( $seed ), 0, 1 ) );
			$initial   = preg_match( '/[A-Z0-9]/', $initial ) ? $initial : 'U';

			return sprintf(
				'<li class="menu-item mm-global-auth-slot"><details class="mm-global-auth-profile"><summary class="mm-global-auth-profile-toggle" aria-label="Profile menu"><span class="mm-global-auth-circle">%1$s</span></summary><div class="mm-global-auth-dropdown"><a href="%2$s">Dashboard</a><a href="%3$s">Logout</a></div></details></li>',
				esc_html( $initial ),
				esc_url( $dashboard ),
				esc_url( $logout_url )
			);
		}

		return sprintf(
			'<li class="menu-item mm-global-auth-slot"><div class="mm-global-auth-guest"><a class="mm-global-auth-link mm-global-auth-login" href="%1$s">Login</a><a class="mm-global-auth-link mm-global-auth-register" href="%2$s">Register</a></div></li>',
			esc_url( $login_url ),
			esc_url( $register_url )
		);
	}
}

if ( ! function_exists( 'mm_global_auth_ui_append_menu_item' ) ) {
	function mm_global_auth_ui_append_menu_item( $items, $args ) {
		static $injected = false;

		if (
			$injected ||
			! mm_global_auth_ui_is_frontend() ||
			! mm_global_auth_ui_is_target_menu( $args )
		) {
			return $items;
		}

		$injected = true;

		return $items . "\n" . mm_global_auth_ui_slot_markup();
	}
}

if ( ! function_exists( 'mm_global_auth_ui_render_styles' ) ) {
	function mm_global_auth_ui_render_styles() {
		if ( ! mm_global_auth_ui_is_frontend() ) {
			return;
		}
		?>
		<!-- START H4-GLOBAL-AUTH-UI-SAFE-IMPLEMENTATION-605 :: MAIN SITE HEADER -->
		<style id="mm-global-auth-ui">
			.mm-global-auth-slot { margin-left: 12px; list-style: none; }
			.mm-global-auth-slot a { text-decoration: none; }
			.mm-global-auth-guest {
				display: inline-flex;
				align-items: center;
				gap: 8px;
			}
			.mm-global-auth-link {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 36px;
				padding: 0 14px;
				border-radius: 999px;
				font-size: 12px;
				font-weight: 700;
				letter-spacing: 0.06em;
				text-transform: uppercase;
				border: 1px solid rgba(15, 42, 68, 0.2);
				color: #0f2a44;
				background: #ffffff;
				transition: all 0.2s ease;
			}
			.mm-global-auth-link:hover {
				color: #0f2a44;
				border-color: rgba(15, 42, 68, 0.45);
				box-shadow: 0 8px 20px rgba(15, 42, 68, 0.14);
				transform: translateY(-1px);
			}
			.mm-global-auth-register {
				background: linear-gradient(180deg, #ffe066 0%, #f5c518 78%, #d79f00 100%);
				border-color: rgba(245, 197, 24, 0.8);
				color: #121212;
			}
			.mm-global-auth-profile {
				position: relative;
				display: inline-flex;
				align-items: center;
			}
			.mm-global-auth-profile summary {
				list-style: none;
				cursor: pointer;
			}
			.mm-global-auth-profile summary::-webkit-details-marker { display: none; }
			.mm-global-auth-profile-toggle {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 0;
				border: 0;
				background: transparent;
			}
			.mm-global-auth-circle {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 38px;
				height: 38px;
				border-radius: 50%;
				background: linear-gradient(180deg, #1b2f4a 0%, #0f2a44 100%);
				border: 1px solid rgba(255, 255, 255, 0.28);
				color: #f6f8fb;
				font-size: 13px;
				font-weight: 700;
				box-shadow: 0 8px 20px rgba(15, 42, 68, 0.3);
			}
			.mm-global-auth-dropdown {
				position: absolute;
				right: 0;
				top: calc(100% + 10px);
				min-width: 176px;
				background: #ffffff;
				border: 1px solid rgba(15, 42, 68, 0.15);
				border-radius: 10px;
				box-shadow: 0 16px 38px rgba(4, 20, 36, 0.2);
				padding: 6px;
				z-index: 9999;
			}
			.mm-global-auth-dropdown a {
				display: block;
				padding: 10px 12px;
				border-radius: 8px;
				color: #0f2a44;
				font-size: 13px;
				font-weight: 600;
			}
			.mm-global-auth-dropdown a:hover {
				background: rgba(15, 42, 68, 0.08);
			}
			.mm-global-auth-profile:not([open]) .mm-global-auth-dropdown {
				display: none;
			}
		</style>
		<!-- END H4-GLOBAL-AUTH-UI-SAFE-IMPLEMENTATION-605 :: MAIN SITE HEADER -->
		<?php
	}
}

add_filter( 'wp_nav_menu_objects', 'mm_global_auth_ui_prune_legacy_account_icons', 60, 2 );
add_filter( 'wp_nav_menu_items', 'mm_global_auth_ui_append_menu_item', 60, 2 );
add_action( 'wp_head', 'mm_global_auth_ui_render_styles', 99 );
