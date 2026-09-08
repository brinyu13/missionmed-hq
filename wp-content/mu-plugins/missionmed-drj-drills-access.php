<?php
/**
 * Plugin Name: MissionMed Dr J Drills Access
 * Description: WordPress-controlled drills-only Arena access layer for Dr J student demos.
 * Version: 0.1.0-predeploy
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'MM_DRJ_DRILLS_ACCESS_ROLE' ) ) {
	define( 'MM_DRJ_DRILLS_ACCESS_ROLE', 'drj_drills_student' );
}

if ( ! defined( 'MM_DRJ_DRILLS_ACCESS_CAP' ) ) {
	define( 'MM_DRJ_DRILLS_ACCESS_CAP', 'missionmed_access_drj_drills' );
}

if ( ! defined( 'MM_DRJ_DRILLS_ACCESS_OPTION' ) ) {
	define( 'MM_DRJ_DRILLS_ACCESS_OPTION', 'missionmed_drj_drills_access' );
}

if ( ! function_exists( 'mm_drj_drills_access_defaults' ) ) {
	/**
	 * Return default access-layer configuration.
	 *
	 * @return array<string,mixed>
	 */
	function mm_drj_drills_access_defaults() {
		return array(
			'enabled'            => true,
			'role'               => MM_DRJ_DRILLS_ACCESS_ROLE,
			'capability'         => MM_DRJ_DRILLS_ACCESS_CAP,
			'label'              => 'MissionMed Drills Access',
			'matrix_course_id'   => 3893,
			'allowed_modes'      => array( 'drills', 'daily_rounds', 'drills_v3', 'legacy_drills' ),
			'locked_modes'       => array( 'stat', 'qstat', 'stat_v3', 'iv_on_call', 'career', 'compete', 'leaderboard', 'tournamed', 'showdown', 'survival', 'team_battle' ),
			'locked_routes'      => array( '/stat', '/stat-v3', '/ivoncall.html', '/dboc_interview_v1.html', '/career', '/compete', '/leaderboard', '/tournamed', '/showdown' ),
			'locked_matrix_routes' => array( 'storyforge' ),
			'locked_message'     => 'This demo account is limited to Drills.',
			'version'            => 'DRJ-ACCESS-001B-live',
		);
	}
}

if ( ! function_exists( 'mm_drj_drills_access_config' ) ) {
	/**
	 * Read and normalize access-layer configuration.
	 *
	 * @return array<string,mixed>
	 */
	function mm_drj_drills_access_config() {
		$defaults = mm_drj_drills_access_defaults();
		$stored   = get_option( MM_DRJ_DRILLS_ACCESS_OPTION, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$config = array_merge( $defaults, $stored );

		$config['enabled']          = ! empty( $config['enabled'] );
		$config['role']             = sanitize_key( $config['role'] );
		$config['capability']       = sanitize_key( $config['capability'] );
		$config['label']            = sanitize_text_field( (string) $config['label'] );
		$config['matrix_course_id'] = absint( $config['matrix_course_id'] );
		$config['allowed_modes']    = mm_drj_drills_access_normalize_mode_list( $config['allowed_modes'] );
		$config['locked_modes']     = mm_drj_drills_access_normalize_mode_list( $config['locked_modes'] );
		$config['locked_routes']    = mm_drj_drills_access_normalize_route_list( $config['locked_routes'] ?? array() );
		$config['locked_matrix_routes'] = mm_drj_drills_access_normalize_matrix_route_list( $config['locked_matrix_routes'] ?? array() );
		$config['locked_message']   = sanitize_text_field( (string) $config['locked_message'] );

		if ( '' === $config['role'] ) {
			$config['role'] = MM_DRJ_DRILLS_ACCESS_ROLE;
		}
		if ( '' === $config['capability'] ) {
			$config['capability'] = MM_DRJ_DRILLS_ACCESS_CAP;
		}
		if ( '' === $config['label'] ) {
			$config['label'] = 'MissionMed Drills Access';
		}
		if ( empty( $config['allowed_modes'] ) ) {
			$config['allowed_modes'] = $defaults['allowed_modes'];
		}

		return $config;
	}
}

if ( ! function_exists( 'mm_drj_drills_access_normalize_mode_list' ) ) {
	/**
	 * Normalize mode-list settings from array or CSV string.
	 *
	 * @param mixed $value Raw value.
	 * @return array<int,string>
	 */
	function mm_drj_drills_access_normalize_mode_list( $value ) {
		if ( is_string( $value ) ) {
			$value = explode( ',', $value );
		}
		if ( ! is_array( $value ) ) {
			return array();
		}

		$modes = array();
		foreach ( $value as $mode ) {
			$key = sanitize_key( (string) $mode );
			if ( '' !== $key ) {
				$modes[] = $key;
			}
		}

		return array_values( array_unique( $modes ) );
	}
}

if ( ! function_exists( 'mm_drj_drills_access_normalize_matrix_route_list' ) ) {
	/**
	 * Normalize Matrix hash routes blocked for the restricted role.
	 *
	 * @param mixed $value Raw value.
	 * @return array<int,string>
	 */
	function mm_drj_drills_access_normalize_matrix_route_list( $value ) {
		if ( is_string( $value ) ) {
			$value = explode( ',', $value );
		}
		if ( ! is_array( $value ) ) {
			return array();
		}

		$routes = array();
		foreach ( $value as $route ) {
			$route = trim( (string) $route );
			$route = preg_replace( '/^#\/?/', '', $route );
			$route = sanitize_key( str_replace( '-', '_', $route ) );
			if ( 'story_forge' === $route ) {
				$route = 'storyforge';
			}
			if ( 'file_vault' === $route ) {
				$route = 'filevault';
			}
			if ( '' !== $route ) {
				$routes[] = $route;
			}
		}

		return array_values( array_unique( $routes ) );
	}
}

if ( ! function_exists( 'mm_drj_drills_access_normalize_route_list' ) ) {
	/**
	 * Normalize direct routes blocked for the restricted role.
	 *
	 * @param mixed $value Raw value.
	 * @return array<int,string>
	 */
	function mm_drj_drills_access_normalize_route_list( $value ) {
		if ( is_string( $value ) ) {
			$value = explode( ',', $value );
		}
		if ( ! is_array( $value ) ) {
			return array();
		}

		$routes = array();
		foreach ( $value as $route ) {
			$route = trim( (string) $route );
			if ( '' === $route ) {
				continue;
			}

			$path = wp_parse_url( $route, PHP_URL_PATH );
			if ( ! is_string( $path ) || '' === $path ) {
				$path = $route;
			}

			$path = rawurldecode( $path );
			$path = preg_replace( '#/+#', '/', '/' . ltrim( $path, '/' ) );
			$path = rtrim( $path, '/' );
			if ( '' !== $path && '/' !== $path ) {
				$routes[] = sanitize_text_field( $path );
			}
		}

		return array_values( array_unique( $routes ) );
	}
}

if ( ! function_exists( 'mm_drj_drills_access_register_role' ) ) {
	/**
	 * Ensure the assignable role and capability exist.
	 *
	 * @return void
	 */
	function mm_drj_drills_access_register_role() {
		$config = mm_drj_drills_access_config();
		if ( empty( $config['enabled'] ) ) {
			return;
		}

		$role_slug  = (string) $config['role'];
		$capability = (string) $config['capability'];
		$label      = (string) $config['label'];
		$role       = get_role( $role_slug );

		if ( ! $role ) {
			add_role(
				$role_slug,
				$label,
				array(
					'read'       => true,
					$capability => true,
				)
			);
			return;
		}

		if ( ! $role->has_cap( 'read' ) ) {
			$role->add_cap( 'read' );
		}
		if ( ! $role->has_cap( $capability ) ) {
			$role->add_cap( $capability );
		}
	}
}

add_action( 'init', 'mm_drj_drills_access_register_role', 1 );

if ( ! function_exists( 'mm_drj_drills_access_user_is_restricted' ) ) {
	/**
	 * Determine whether the user should receive drills-only Arena restrictions.
	 *
	 * @param int $user_id WordPress user ID. Defaults to current user.
	 * @return bool
	 */
	function mm_drj_drills_access_user_is_restricted( $user_id = 0 ) {
		$config = mm_drj_drills_access_config();
		if ( empty( $config['enabled'] ) ) {
			return false;
		}

		$user_id = absint( $user_id );
		if ( 0 === $user_id ) {
			$user_id = get_current_user_id();
		}
		if ( 0 === $user_id && function_exists( 'wp_validate_auth_cookie' ) ) {
			foreach ( array( 'logged_in', 'secure_auth', 'auth' ) as $scheme ) {
				$cookie_user_id = absint( wp_validate_auth_cookie( '', $scheme ) );
				if ( $cookie_user_id > 0 ) {
					$user_id = $cookie_user_id;
					break;
				}
			}
		}
		if ( $user_id <= 0 ) {
			return false;
		}
		if ( user_can( $user_id, 'manage_options' ) ) {
			return false;
		}
		if ( user_can( $user_id, (string) $config['capability'] ) ) {
			return true;
		}

		$user = get_userdata( $user_id );
		if ( ! $user || empty( $user->roles ) || ! is_array( $user->roles ) ) {
			return false;
		}

		return in_array( (string) $config['role'], array_map( 'sanitize_key', $user->roles ), true );
	}
}

if ( ! function_exists( 'mm_drj_drills_access_request_path' ) ) {
	/**
	 * Resolve normalized request path for route guards.
	 *
	 * @return string
	 */
	function mm_drj_drills_access_request_path() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		if ( '' === $request_uri ) {
			return '';
		}

		$path = wp_parse_url( $request_uri, PHP_URL_PATH );
		if ( ! is_string( $path ) || '' === $path ) {
			return '';
		}

		$path = rawurldecode( $path );
		$path = preg_replace( '#/+#', '/', $path );

		$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		if ( is_string( $home_path ) && '' !== $home_path && '/' !== $home_path ) {
			$home_path = rtrim( $home_path, '/' );
			if ( 0 === strpos( $path, $home_path . '/' ) ) {
				$path = substr( $path, strlen( $home_path ) );
			} elseif ( $path === $home_path ) {
				$path = '/';
			}
		}

		if ( 0 === strpos( $path, '/index.php/' ) ) {
			$path = substr( $path, strlen( '/index.php' ) );
		} elseif ( '/index.php' === $path ) {
			$path = '/';
		}

		return '' !== $path ? $path : '/';
	}
}

if ( ! function_exists( 'mm_drj_drills_access_route_guard' ) ) {
	/**
	 * Block direct non-Drills Arena routes for the Dr J drills-only role.
	 *
	 * @return void
	 */
	function mm_drj_drills_access_route_guard() {
		if ( ! mm_drj_drills_access_user_is_restricted() ) {
			return;
		}

		$config = mm_drj_drills_access_config();
		$path = mm_drj_drills_access_request_path();
		$blocked = false;
		foreach ( (array) $config['locked_routes'] as $locked_route ) {
			$locked_route = rtrim( (string) $locked_route, '/' );
			if ( '' === $locked_route || '/' === $locked_route ) {
				continue;
			}
			if ( $path === $locked_route || 0 === strpos( $path, $locked_route . '/' ) ) {
				$blocked = true;
				break;
			}
		}

		if ( ! $blocked ) {
			return;
		}

		status_header( 403 );
		nocache_headers();
		header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
		header( 'X-MissionMed-Access-Layer: drj-drills-only' );
		echo '<!doctype html><html><head><meta charset="utf-8"><title>Drills Access Only</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#08111f;color:#f7fbff;min-height:100vh;display:grid;place-items:center;margin:0"><main style="max-width:560px;padding:28px"><h1 style="margin:0 0 10px;font-size:28px">Drills access only</h1><p style="line-height:1.6;color:#c9d7e6">This MissionMed account is limited to Drills for the current Dr J access window.</p><p><a style="color:#7fd8ff;font-weight:700" href="/arena">Return to Arena</a></p></main></body></html>';
		exit;
	}
}

add_action( 'parse_request', 'mm_drj_drills_access_route_guard', -50 );
add_action( 'template_redirect', 'mm_drj_drills_access_route_guard', -50 );

if ( ! function_exists( 'mm_drj_drills_access_arena_handler' ) ) {
	/**
	 * Serve a DrJ-only Arena shell before the shared proxy for restricted users.
	 *
	 * @return void
	 */
	function mm_drj_drills_access_arena_handler() {
		if ( ! mm_drj_drills_access_user_is_restricted() ) {
			return;
		}

		$path = rtrim( mm_drj_drills_access_request_path(), '/' );
		if ( '' === $path ) {
			$path = '/';
		}
		if ( '/arena' !== $path ) {
			return;
		}

		if (
			! function_exists( 'mm_arena_route_proxy_fetch_upstream_html' ) ||
			! function_exists( 'mm_arena_route_proxy_force_same_origin_auth' ) ||
			! function_exists( 'mm_arena_route_proxy_build_auth_config' ) ||
			! function_exists( 'mm_arena_route_proxy_inject_auth_config' )
		) {
			return;
		}

		$upstream_base = 'https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;
		if ( '' !== $query_string ) {
			$upstream_url .= '?' . $query_string;
		}

		$fetch_result = mm_arena_route_proxy_fetch_upstream_html( $upstream_url );
		if ( empty( $fetch_result['ok'] ) ) {
			return;
		}

		$status_code = (int) $fetch_result['status'];
		$body        = (string) $fetch_result['body'];
		if ( $status_code < 200 || $status_code >= 400 || '' === $body ) {
			return;
		}

		$body_fixed    = mm_arena_route_proxy_force_same_origin_auth( $body );
		$body_injected = mm_arena_route_proxy_inject_auth_config( $body_fixed, mm_arena_route_proxy_build_auth_config() );
		if ( '' === $body_injected ) {
			return;
		}

		$body_locked = mm_drj_drills_access_inject_arena_lock( $body_injected );
		if ( ! is_string( $body_locked ) || '' === $body_locked ) {
			return;
		}

		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		if ( ! defined( 'DONOTCACHEOBJECT' ) ) {
			define( 'DONOTCACHEOBJECT', true );
		}
		if ( ! defined( 'DONOTCACHEDB' ) ) {
			define( 'DONOTCACHEDB', true );
		}

		status_header( 200 );
		nocache_headers();
		header( 'Cache-Control: no-cache, must-revalidate, max-age=0, no-store, private' );
		header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
		header( 'X-MissionMed-Route: arena-drj-drills-proxy' );
		header( 'X-MissionMed-DrJ-Access: restricted' );
		header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
		header( 'X-MissionMed-Upstream-Transport: ' . (string) $fetch_result['transport'] );
		if ( $body_fixed !== $body ) {
			header( 'X-MissionMed-Arena-Auth-Rewrite: true' );
		}
		if ( $body_injected !== $body_fixed ) {
			header( 'X-MissionMed-Arena-Auth-Config: injected' );
		}

		echo $body_locked;
		exit;
	}
}

add_action( 'parse_request', 'mm_drj_drills_access_arena_handler', -75 );
add_action( 'template_redirect', 'mm_drj_drills_access_arena_handler', -75 );

if ( ! function_exists( 'mm_drj_drills_access_inject_arena_lock' ) ) {
	/**
	 * Inject a client lock for non-Drills Arena modes for the restricted role only.
	 *
	 * @param string $html Proxied Arena HTML.
	 * @return string
	 */
	function mm_drj_drills_access_inject_arena_lock( $html ) {
		if ( ! mm_drj_drills_access_user_is_restricted() ) {
			return $html;
		}

		$config  = mm_drj_drills_access_config();
		$payload = wp_json_encode(
			array(
				'enabled'        => true,
				'role'           => (string) $config['role'],
				'capability'     => (string) $config['capability'],
				'matrixCourseId' => absint( $config['matrix_course_id'] ),
				'allowedModes'   => array_values( (array) $config['allowed_modes'] ),
				'lockedModes'    => array_values( (array) $config['locked_modes'] ),
				'lockedRoutes'   => array_values( (array) $config['locked_routes'] ),
				'message'        => (string) $config['locked_message'],
				'version'        => (string) $config['version'],
			),
			JSON_UNESCAPED_SLASHES
		);

		if ( ! is_string( $payload ) || '' === $payload ) {
			return $html;
		}

		$style  = '<style id="mm-drj-drills-access-style">.mm-drj-lock-note{position:fixed;left:50%;bottom:24px;z-index:20000;transform:translate(-50%,16px);opacity:0;pointer-events:none;background:rgba(5,14,28,.96);color:#fff;border:1px solid rgba(127,216,255,.34);border-radius:10px;padding:12px 16px;font:700 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:.04em;text-transform:uppercase;box-shadow:0 16px 38px rgba(0,0,0,.42);transition:opacity .18s ease,transform .18s ease}.mm-drj-lock-note.visible{opacity:1;transform:translate(-50%,0)}</style>';
		$script = '<script id="mm-drj-drills-access-script">(function(){var cfg=' . $payload . ';if(!cfg||!cfg.enabled)return;window.MM_DRJ_DRILLS_ACCESS=cfg;var root=document.documentElement;if(root)root.classList.add("mm-drj-drills-access");function norm(raw){var safe=String(raw||"").trim().toLowerCase().replace(/-/g,"_");if(safe==="daily"||safe==="daily_round"||safe==="daily_rounds"||safe==="drills_v3"||safe==="legacy_drills")return"drills";if(safe==="qstat"||safe==="stat_v3")return"stat";if(safe==="iv_on_call"||safe==="ivoncall"||safe==="interview")return"iv_on_call";if(safe==="tourna_med"||safe==="tourna_med_game")return"tournamed";return safe;}var allowed=(Array.isArray(cfg.allowedModes)?cfg.allowedModes:["drills"]).map(norm);function allowedMode(raw){return allowed.indexOf(norm(raw))!==-1;}function notice(){var note=document.getElementById("mmDrjLockNote");if(!note&&document.body){note=document.createElement("div");note.id="mmDrjLockNote";note.className="mm-drj-lock-note";note.textContent=cfg.message||"This demo account is limited to Drills.";document.body.appendChild(note);}if(!note)return;note.classList.add("visible");clearTimeout(notice._t);notice._t=setTimeout(function(){note.classList.remove("visible");},1900);}function modeFromTarget(target){var card=target&&target.closest?target.closest("[data-arena-mode],[data-mode-key],[data-mode],[data-lus-mode]"):null;return card&&(card.getAttribute("data-arena-mode")||card.getAttribute("data-mode-key")||card.getAttribute("data-mode")||card.getAttribute("data-lus-mode")||"");}document.addEventListener("click",function(ev){var mode=modeFromTarget(ev.target);if(mode&&!allowedMode(mode)){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();notice();return false;}},true);})();</script>';
		$inject = $style . $script;
		$count  = 0;
		$body   = preg_replace( '/<\/body>/i', $inject . '</body>', (string) $html, 1, $count );

		return ( 0 === (int) $count ) ? (string) $html . $inject : $body;
	}
}

add_filter( 'mm_arena_route_proxy_html', 'mm_drj_drills_access_inject_arena_lock', 20 );

if ( ! function_exists( 'mm_drj_drills_access_matrix_lock_script' ) ) {
	/**
	 * Build the restricted-user Matrix lock script.
	 *
	 * @return string
	 */
	function mm_drj_drills_access_matrix_lock_script() {
		if ( ! mm_drj_drills_access_user_is_restricted() ) {
			return '';
		}

		$config = mm_drj_drills_access_config();
		$routes = array_values( (array) ( $config['locked_matrix_routes'] ?? array() ) );
		if ( empty( $routes ) ) {
			return '';
		}

		$payload = wp_json_encode(
			array(
				'enabled'      => true,
				'lockedRoutes' => $routes,
				'message'      => (string) $config['locked_message'],
				'version'      => (string) $config['version'],
			),
			JSON_UNESCAPED_SLASHES
		);

		if ( ! is_string( $payload ) || '' === $payload ) {
			return '';
		}

		return '(function(){var cfg=' . $payload . ';if(!cfg||!cfg.enabled)return;window.MM_DRJ_MATRIX_ACCESS_LOCK=cfg;function norm(route){var value=String(route||"dashboard").replace(/^#\\/?/,"").trim().toLowerCase().replace(/-/g,"_");if(value==="story_forge")return"storyforge";if(value==="file_vault")return"filevault";return value||"dashboard";}var locked={};(Array.isArray(cfg.lockedRoutes)?cfg.lockedRoutes:[]).forEach(function(route){locked[norm(route)]=true;});function isLocked(route){return !!locked[norm(route)];}function apply(){var app=window.MMED_OS||{};app.access=app.access&&typeof app.access==="object"?app.access:{};app.access.module_permissions=app.access.module_permissions&&typeof app.access.module_permissions==="object"?app.access.module_permissions:{};Object.keys(locked).forEach(function(route){app.access.module_permissions[route]=false;if(route==="storyforge"){app.access.storyforge=app.access.storyforge&&typeof app.access.storyforge==="object"?app.access.storyforge:{};app.access.storyforge.unlocked=false;app.access.storyforge.mode="locked";app.access.storyforge.enabled=false;}});window.MMED_OS=app;if(window.mmedStudentOsFeatureFlags&&window.mmedStudentOsFeatureFlags.feature_flags){if(isLocked("storyforge"))window.mmedStudentOsFeatureFlags.feature_flags.storyforge_bootstrap=false;}if(window.location&&isLocked(window.location.hash)){window.history.replaceState(null,"","#dashboard");}}apply();document.addEventListener("DOMContentLoaded",apply);window.addEventListener("hashchange",function(){if(isLocked(window.location.hash)){window.history.replaceState(null,"","#dashboard");}apply();},true);[120,400,900,1600].forEach(function(ms){window.setTimeout(apply,ms);});})();';
	}
}

if ( ! function_exists( 'mm_drj_drills_access_enqueue_matrix_lock' ) ) {
	/**
	 * Lock selected Matrix routes for the Dr J restricted role only.
	 *
	 * @return void
	 */
	function mm_drj_drills_access_enqueue_matrix_lock() {
		$script = mm_drj_drills_access_matrix_lock_script();
		if ( '' === $script ) {
			return;
		}

		if ( wp_script_is( 'mmed-student-os-js', 'enqueued' ) || wp_script_is( 'mmed-student-os-js', 'registered' ) ) {
			wp_add_inline_script( 'mmed-student-os-js', $script, 'before' );
		}
	}
}

add_action( 'wp_enqueue_scripts', 'mm_drj_drills_access_enqueue_matrix_lock', 1000 );

if ( ! function_exists( 'mm_drj_drills_access_print_matrix_lock_fallback' ) ) {
	/**
	 * Fallback for Matrix pages if the script handle is not visible during enqueue.
	 *
	 * @return void
	 */
	function mm_drj_drills_access_print_matrix_lock_fallback() {
		$script = mm_drj_drills_access_matrix_lock_script();
		if ( '' === $script ) {
			return;
		}

		echo '<script id="mm-drj-matrix-access-lock">' . $script . '</script>';
	}
}

add_action( 'wp_footer', 'mm_drj_drills_access_print_matrix_lock_fallback', 1 );

if ( ! function_exists( 'mm_drj_drills_access_register_settings_page' ) ) {
	/**
	 * Register admin settings for future expansion.
	 *
	 * @return void
	 */
	function mm_drj_drills_access_register_settings_page() {
		add_options_page(
			'MissionMed Drills Access',
			'MissionMed Drills Access',
			'manage_options',
			'missionmed-drj-drills-access',
			'mm_drj_drills_access_render_settings_page'
		);
	}
}

add_action( 'admin_menu', 'mm_drj_drills_access_register_settings_page' );

if ( ! function_exists( 'mm_drj_drills_access_render_settings_page' ) ) {
	/**
	 * Render settings page.
	 *
	 * @return void
	 */
	function mm_drj_drills_access_render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage this access layer.' ) );
		}

		$config = mm_drj_drills_access_config();

		if ( isset( $_POST['mm_drj_drills_access_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['mm_drj_drills_access_nonce'] ) ), 'mm_drj_drills_access_save' ) ) {
			$config['enabled']          = ! empty( $_POST['enabled'] );
			$config['role']             = isset( $_POST['role'] ) ? sanitize_key( wp_unslash( $_POST['role'] ) ) : MM_DRJ_DRILLS_ACCESS_ROLE;
			$config['capability']       = isset( $_POST['capability'] ) ? sanitize_key( wp_unslash( $_POST['capability'] ) ) : MM_DRJ_DRILLS_ACCESS_CAP;
			$config['matrix_course_id'] = isset( $_POST['matrix_course_id'] ) ? absint( $_POST['matrix_course_id'] ) : 3893;
			$config['allowed_modes']    = isset( $_POST['allowed_modes'] ) ? mm_drj_drills_access_normalize_mode_list( wp_unslash( $_POST['allowed_modes'] ) ) : array();
			$config['locked_modes']     = isset( $_POST['locked_modes'] ) ? mm_drj_drills_access_normalize_mode_list( wp_unslash( $_POST['locked_modes'] ) ) : array();
			$config['locked_routes']    = isset( $_POST['locked_routes'] ) ? mm_drj_drills_access_normalize_route_list( wp_unslash( $_POST['locked_routes'] ) ) : array();
			$config['locked_matrix_routes'] = isset( $_POST['locked_matrix_routes'] ) ? mm_drj_drills_access_normalize_matrix_route_list( wp_unslash( $_POST['locked_matrix_routes'] ) ) : array();
			$config['locked_message']   = isset( $_POST['locked_message'] ) ? sanitize_text_field( wp_unslash( $_POST['locked_message'] ) ) : '';
			update_option( MM_DRJ_DRILLS_ACCESS_OPTION, $config, false );
			mm_drj_drills_access_register_role();
			echo '<div class="notice notice-success"><p>MissionMed Drills Access settings saved.</p></div>';
		}

		?>
		<div class="wrap">
			<h1>MissionMed Drills Access</h1>
			<form method="post">
				<?php wp_nonce_field( 'mm_drj_drills_access_save', 'mm_drj_drills_access_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">Enabled</th>
						<td><label><input type="checkbox" name="enabled" value="1" <?php checked( ! empty( $config['enabled'] ) ); ?>> Enable Dr J drills-only access layer</label></td>
					</tr>
					<tr>
						<th scope="row"><label for="role">Role</label></th>
						<td><input id="role" name="role" class="regular-text" value="<?php echo esc_attr( (string) $config['role'] ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="capability">Capability</label></th>
						<td><input id="capability" name="capability" class="regular-text" value="<?php echo esc_attr( (string) $config['capability'] ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="matrix_course_id">Matrix course ID</label></th>
						<td><input id="matrix_course_id" name="matrix_course_id" type="number" min="0" value="<?php echo esc_attr( (string) absint( $config['matrix_course_id'] ) ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="allowed_modes">Allowed Arena modes</label></th>
						<td><input id="allowed_modes" name="allowed_modes" class="large-text" value="<?php echo esc_attr( implode( ',', (array) $config['allowed_modes'] ) ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="locked_modes">Locked Arena modes</label></th>
						<td><input id="locked_modes" name="locked_modes" class="large-text" value="<?php echo esc_attr( implode( ',', (array) $config['locked_modes'] ) ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="locked_routes">Locked direct routes</label></th>
						<td><input id="locked_routes" name="locked_routes" class="large-text" value="<?php echo esc_attr( implode( ',', (array) $config['locked_routes'] ) ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="locked_matrix_routes">Locked Matrix routes</label></th>
						<td><input id="locked_matrix_routes" name="locked_matrix_routes" class="large-text" value="<?php echo esc_attr( implode( ',', (array) $config['locked_matrix_routes'] ) ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="locked_message">Lock message</label></th>
						<td><input id="locked_message" name="locked_message" class="large-text" value="<?php echo esc_attr( (string) $config['locked_message'] ); ?>"></td>
					</tr>
				</table>
				<?php submit_button( 'Save Drills Access Settings' ); ?>
			</form>
		</div>
		<?php
	}
}
