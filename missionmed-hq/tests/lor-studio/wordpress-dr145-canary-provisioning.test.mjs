import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = new URL('../../../', import.meta.url).pathname;
const runnerPath = join(repositoryRoot, 'missionmed-hq/scripts/lor-studio/provision-dr145-wordpress-canary.php');
const runnerSource = readFileSync(runnerPath, 'utf8');
const phpAvailable = spawnSync('php', ['-v'], { stdio: 'ignore' }).status === 0;
const testAuthKey = 'test-only-auth-key-which-is-longer-than-thirty-two-bytes';
const testAuthSalt = 'test-only-auth-salt-which-is-distinct-and-long-enough';

const metaKeys = [
  '_missionmed_lor_enabled',
  '_missionmed_lor_revoked_at',
  '_missionmed_lor_canary_enabled',
  '_missionmed_lor_consent_at',
  '_missionmed_lor_consent_accepted',
  '_missionmed_lor_consent_version',
  '_missionmed_lor_consent_revoked_at',
];

function privateRoot() {
  const root = mkdtempSync(join(tmpdir(), 'f2-lor-dr145-test-'));
  chmodSync(root, 0o700);
  return root;
}

function custodyPath(root, principal) {
  return join(root, `f2-lor-1012-dr145-${principal}-custody.json`);
}

function boundIdentityPath(root) {
  return `${custodyPath(root, 'student')}.identity.bound.json`;
}

function publishedStagePath(path) {
  return `${path}.stage.${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function phpString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function harness(config = {}) {
  const encoded = Buffer.from(JSON.stringify({
    existing: true,
    login: 'brinyu',
    email: 'founder@example.test',
    userId: 987654,
    registeredAt: '2025-01-01 00:00:00',
    admin: true,
    roles: ['administrator'],
    meta: {},
    courseAccess: false,
    expectedStudentEmail: 'qa.canary@example.test',
    failAddAt: 0,
    contractFail: false,
    currentCourseIds: null,
    expiredCourseIds: [],
    historicalCourseIds: null,
    courseRevoked: false,
    courseExpiresAt: '',
    purchaseOverride: {},
    camOverride: {},
    passwordHash: 'unrelated-password-hash',
    externalObjectCache: false,
    legacyCourseAccessList: false,
    dbEngine: 'InnoDB',
    dbIndexCount: 1,
    dbIdentityIndexCount: 3,
    dbIdentityCollationCount: 3,
    dbTriggerCount: 0,
    dbForeignKeyCount: 0,
		dbRuntimeCanonical: true,
		dbServerVersion: '8.4.0',
		dbName: 'missionmed',
		dbGrants: ['GRANT ALL PRIVILEGES ON `missionmed`.* TO `missionmed`@`localhost`'],
			dbMetadataQueryFails: false,
			hposEnabled: true,
			hposOption: 'yes',
			hposSyncRows: 0,
			hposDataStoreTopologyValid: true,
			hposOptionOnTransactionBegin: null,
			dbEngineOnTransactionBegin: null,
			directCommerceAddressEmail: false,
			directCommerceOrderEmail: false,
			directCommerceCustomer: false,
			directCommerceLegacyEmail: false,
			directCommerceLegacyCustomer: false,
			wpVersion: '7.1',
    metaHookActive: false,
    blockedHook: null,
    saveQueries: false,
    emailCollision: false,
    duplicateLogin: false,
    duplicateEmail: false,
		duplicateNicename: false,
		nicenameCollision: false,
		throwOnInTransactionProducer: true,
			passwordResetOnTransactionBegin: false,
			wpHasherActive: false,
    crashAddAt: 0,
    crashDeleteAt: 0,
		crashAfterCommitAt: 0,
    ...config,
  }), 'utf8').toString('base64');
  return `<?php
define('ABSPATH', '/srv/missionmed-wordpress/');
define('WP_CLI', true);
define('MMHQ_LOR_DR145_TEST_HARNESS', true);
define('AUTH_KEY', 'test-only-auth-key-which-is-longer-than-thirty-two-bytes');
define('AUTH_SALT', 'test-only-auth-salt-which-is-distinct-and-long-enough');
define('MMHQ_LOR_DR145_PRIVATE_STATE_DIR', getenv('MMHQ_LOR_DR145_TEST_PRIVATE_STATE_DIR'));
define('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION', 'dr145-v1');
define('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN', 'brinyu');
define('LEARNDASH_VERSION', '5.0.4');
define('LEARNDASH_TRANSIENTS_DISABLED', true);
	define('WC_VERSION', '10.6.1');
class WP_Error {}
$GLOBALS['cfg'] = json_decode(base64_decode('${encoded}'), true);
	$GLOBALS['wp_version'] = $GLOBALS['cfg']['wpVersion'];
	if (true === $GLOBALS['cfg']['wpHasherActive']) $GLOBALS['wp_hasher'] = new stdClass();
class MMHQ_Test_OrderUtil {
	public static function custom_orders_table_usage_is_enabled() { return true === $GLOBALS['cfg']['hposEnabled']; }
}
class_alias('MMHQ_Test_OrderUtil', 'Automattic\\WooCommerce\\Utilities\\OrderUtil');
if ((bool) $GLOBALS['cfg']['saveQueries']) define('SAVEQUERIES', $GLOBALS['cfg']['saveQueries']);
$GLOBALS['user'] = $GLOBALS['cfg']['existing'] ? (object) array(
    'ID' => $GLOBALS['cfg']['userId'],
    'user_login' => $GLOBALS['cfg']['login'],
    'user_email' => $GLOBALS['cfg']['email'],
    'user_registered' => $GLOBALS['cfg']['registeredAt'],
    'user_pass' => $GLOBALS['cfg']['passwordHash'],
    'user_nicename' => 'brinyu_test' === $GLOBALS['cfg']['login'] ? 'brinyu-test' : $GLOBALS['cfg']['login'],
    'display_name' => $GLOBALS['cfg']['login'],
    'user_url' => '',
    'user_activation_key' => '',
    'user_status' => 0,
    'roles' => $GLOBALS['cfg']['roles'],
) : false;
$GLOBALS['meta'] = $GLOBALS['cfg']['meta'];
$GLOBALS['initial_meta'] = $GLOBALS['meta'];
$GLOBALS['course_access'] = $GLOBALS['cfg']['courseAccess'];
$GLOBALS['initial_course_access'] = $GLOBALS['course_access'];
$GLOBALS['calls'] = array('delete' => array(), 'add' => array(), 'course' => array(), 'create' => 0);
$GLOBALS['add_count'] = 0;
$GLOBALS['created_login_ok'] = false;
$GLOBALS['created_email_ok'] = false;
$GLOBALS['created_role_empty'] = false;
$GLOBALS['cam_calls'] = 0;
$GLOBALS['password_checks'] = 0;
$GLOBALS['in_tx_producer_calls'] = array();
	class MMHQ_Test_WPDB {
	    public $users = 'wp_users';
	    public $usermeta = 'wp_usermeta';
		public $posts = 'wp_posts';
		public $postmeta = 'wp_postmeta';
		public $options = 'wp_options';
	public $prefix = 'wp_';
    public $active = false;
    public $suppress_errors = false;
	public $last_error = '';
    protected $reconnect_retries = 5;
    private $snapshot = null;
	private $transaction_count = 0;
		public function mmhq_lor_dr145_native_runtime_is_canonical() { return true === $GLOBALS['cfg']['dbRuntimeCanonical']; }
		public function mmhq_lor_dr145_hpos_data_store_topology_is_canonical() {
			return true === $GLOBALS['cfg']['hposDataStoreTopologyValid']
				&& 'woocommerce_order_data_store' !== $GLOBALS['cfg']['blockedHook'];
		}
		public function mmhq_lor_dr145_native_assert_hpos_mode_locked() {
			return $this->active
				&& 'yes' === $GLOBALS['cfg']['hposOption'];
		}
		public function mmhq_lor_dr145_native_assert_no_legacy_commerce($user_id, $email) {
			return !$this->active
				&& (int) $user_id > 0
				&& is_string($email)
				&& false === $GLOBALS['cfg']['directCommerceLegacyEmail']
				&& false === $GLOBALS['cfg']['directCommerceLegacyCustomer'];
		}
		public function mmhq_lor_dr145_native_assert_no_commerce_email($email) {
			return !$this->active
				&& is_string($email)
				&& false === $GLOBALS['cfg']['directCommerceAddressEmail']
				&& false === $GLOBALS['cfg']['directCommerceOrderEmail']
				&& false === $GLOBALS['cfg']['directCommerceLegacyEmail'];
		}
		public function mmhq_lor_dr145_native_assert_no_hpos_commerce($user_id, $email) {
			return $this->active
				&& (int) $user_id > 0
				&& is_string($email)
				&& false === $GLOBALS['cfg']['directCommerceAddressEmail']
				&& false === $GLOBALS['cfg']['directCommerceOrderEmail']
				&& false === $GLOBALS['cfg']['directCommerceCustomer'];
		}
		public function mmhq_lor_dr145_native_course_meta_rows($user_id, $key) {
			if (!$this->active || (int) $user_id < 1) return null;
			return $GLOBALS['meta'][$key] ?? array();
		}
		public function mmhq_lor_dr145_native_assert_transaction_schema_locked($tables) {
			$founder = array('wp_users', 'wp_usermeta');
			$student = array(
				'wp_users', 'wp_usermeta', 'wp_options', 'wp_wc_orders', 'wp_wc_order_addresses',
				'wp_wc_order_operational_data', 'wp_wc_orders_meta', 'wp_woocommerce_order_items',
				'wp_woocommerce_order_itemmeta', 'wp_posts', 'wp_postmeta',
			);
			return $this->active
				&& ($founder === $tables || $student === $tables)
				&& 'innodb' === strtolower((string) $GLOBALS['cfg']['dbEngine'])
				&& 0 === (int) $GLOBALS['cfg']['dbTriggerCount']
				&& 0 === (int) $GLOBALS['cfg']['dbForeignKeyCount'];
		}
	public function mmhq_lor_dr145_native_scalar_for_test($query) {
		if ('SELECT VERSION()' === $query) return $GLOBALS['cfg']['dbServerVersion'];
		if (false !== strpos($query, 'performance_schema.events_transactions_current')) return $this->active ? 1 : 0;
		if (false !== strpos($query, 'CONNECTION_ID()')) return 424242;
		if (false !== strpos($query, '@@session.in_transaction')) return $this->active ? 1 : 0;
		if (false !== strpos($query, '@@session.autocommit')) return 1;
		return null;
	}
    public function reconnect_retries_for_test() { return $this->reconnect_retries; }
    public function suppress_errors($suppress = true) {
        $previous = $this->suppress_errors;
        $this->suppress_errors = (bool) $suppress;
        return $previous;
    }
    public function mmhq_lor_dr145_native_insert_student($fields) {
        if (is_object($GLOBALS['user']) || true === $GLOBALS['cfg']['emailCollision'] || true === $GLOBALS['cfg']['nicenameCollision']) return 0;
        if ('1' === getenv('MMHQ_LOR_DR145_TEST_CRASH_DURING_CREATE')) exit(85);
        $GLOBALS['calls']['create']++;
        $GLOBALS['created_login_ok'] = 'brinyu_test' === ($fields['user_login'] ?? null);
        $GLOBALS['created_email_ok'] = $GLOBALS['cfg']['expectedStudentEmail'] === ($fields['user_email'] ?? null);
        $GLOBALS['created_role_empty'] = true;
        $GLOBALS['user'] = (object) array(
            'ID' => 777777,
            'user_login' => $fields['user_login'],
            'user_email' => $fields['user_email'],
            'user_registered' => $fields['user_registered'],
            'user_pass' => $fields['user_pass'],
            'user_nicename' => $fields['user_nicename'],
            'display_name' => $fields['display_name'],
            'user_url' => $fields['user_url'],
            'user_activation_key' => $fields['user_activation_key'],
            'user_status' => $fields['user_status'],
            'roles' => array(),
        );
        $GLOBALS['cfg']['admin'] = false;
        if ('1' === getenv('MMHQ_LOR_DR145_TEST_CRASH_AFTER_CREATE')) exit(86);
        return 777777;
    }
    public function mmhq_lor_dr145_native_assert_unique_identity($principal, $user_id, $email, $nicename, $require_existing_transaction) {
        if ($require_existing_transaction && !$this->active) return false;
        if (!$require_existing_transaction && $this->active) return false;
		if (true === $GLOBALS['cfg']['duplicateLogin'] || true === $GLOBALS['cfg']['duplicateEmail'] || true === $GLOBALS['cfg']['duplicateNicename']) return false;
		if ('student' === $principal && 'brinyu-test' !== $nicename) return false;
        return is_object($GLOBALS['user']) && (int) $GLOBALS['user']->ID === (int) $user_id;
    }
	    public function prepare($query, ...$args) {
			if (!is_string($query)) return false;
			foreach ($args as $arg) {
				if (1 !== preg_match('/%[sd]/', $query, $match)) return false;
				$replacement = '%d' === $match[0]
					? (string) (int) $arg
					: "'" . str_replace("'", "''", (string) $arg) . "'";
				$query = preg_replace('/%[sd]/', $replacement, $query, 1);
			}
			return $query;
		}
	public function get_col($query) {
		return 'SHOW GRANTS FOR CURRENT_USER' === $query ? $GLOBALS['cfg']['dbGrants'] : array();
	}
	    public function get_var($query) {
			if ('SELECT DATABASE()' === $query) return $GLOBALS['cfg']['dbName'];
			if (false !== strpos($query, 'woocommerce_custom_orders_table_data_sync_enabled')) return $GLOBALS['cfg']['hposSyncRows'];
			if (false !== strpos($query, "option_name = 'woocommerce_custom_orders_table_enabled'")) return $GLOBALS['cfg']['hposOption'];
		if (true === $GLOBALS['cfg']['dbMetadataQueryFails'] && false !== strpos($query, 'information_schema.')) {
			$this->last_error = 'metadata query denied';
			return null;
		}
        if (false !== strpos($query, 'CONNECTION_ID()')) return 424242;
        if (false !== strpos($query, '@@session.in_transaction')) return $this->active ? 1 : 0;
        if (false !== strpos($query, 'information_schema.STATISTICS') && false !== strpos($query, 'COLUMN_NAME IN')) return $GLOBALS['cfg']['dbIdentityIndexCount'];
        if (false !== strpos($query, 'information_schema.STATISTICS')) return $GLOBALS['cfg']['dbIndexCount'];
	        if (false !== strpos($query, 'information_schema.COLUMNS') && (false !== strpos($query, 'wc_order') || false !== strpos($query, "'meta_value'"))) return 1;
	        if (false !== strpos($query, 'information_schema.COLUMNS')) return $GLOBALS['cfg']['dbIdentityCollationCount'];
        if (false !== strpos($query, 'information_schema.TRIGGERS')) return $GLOBALS['cfg']['dbTriggerCount'];
        if (false !== strpos($query, 'information_schema.KEY_COLUMN_USAGE')) return $GLOBALS['cfg']['dbForeignKeyCount'];
        return $GLOBALS['cfg']['dbEngine'];
    }
    public function query($query) {
        $GLOBALS['db_queries'][] = $query;
	        if ('START TRANSACTION' === $query) {
	            $this->active = true;
				$this->transaction_count++;
				if (is_string($GLOBALS['cfg']['hposOptionOnTransactionBegin'])) {
					$GLOBALS['cfg']['hposOption'] = $GLOBALS['cfg']['hposOptionOnTransactionBegin'];
				}
				if (is_string($GLOBALS['cfg']['dbEngineOnTransactionBegin'])) {
					$GLOBALS['cfg']['dbEngine'] = $GLOBALS['cfg']['dbEngineOnTransactionBegin'];
				}
            $this->snapshot = array(
                'meta' => $GLOBALS['meta'],
                'course_access' => $GLOBALS['course_access'],
            );
			if (true === $GLOBALS['cfg']['passwordResetOnTransactionBegin'] && 1 === $this->transaction_count && is_object($GLOBALS['user'])) {
				$GLOBALS['user']->user_pass = 'concurrent-password-reset';
			}
        } elseif ('COMMIT' === $query) {
            $this->active = false;
            $this->snapshot = null;
			if ((int) $GLOBALS['cfg']['crashAfterCommitAt'] === $this->transaction_count) exit(89);
        } elseif ('ROLLBACK' === $query) {
            if (is_array($this->snapshot)) {
                $GLOBALS['meta'] = $this->snapshot['meta'];
                $GLOBALS['course_access'] = $this->snapshot['course_access'];
            }
            $this->active = false;
            $this->snapshot = null;
        }
        return 0;
    }
}
$GLOBALS['db_queries'] = array();
$GLOBALS['wpdb'] = new MMHQ_Test_WPDB();
$GLOBALS['filters'] = array();
function add_filter($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['filters'][$hook][] = array($callback, $priority, $accepted_args);
    return true;
}
function mmhq_test_producer_call($name) {
    if (!is_object($GLOBALS['wpdb']) || !$GLOBALS['wpdb']->active) return;
    $GLOBALS['in_tx_producer_calls'][] = $name;
    if (true === $GLOBALS['cfg']['throwOnInTransactionProducer']) {
        throw new RuntimeException('hookful producer called inside transaction');
    }
}
function apply_filters($hook, $value, ...$args) {
    mmhq_test_producer_call('apply_filters:' . $hook);
    $callbacks = $GLOBALS['filters'][$hook] ?? array();
    usort($callbacks, function ($a, $b) { return $a[1] <=> $b[1]; });
    foreach ($callbacks as $entry) {
        $value = call_user_func_array($entry[0], array_slice(array_merge(array($value), $args), 0, $entry[2]));
    }
    return $value;
}
function has_filter($hook) {
    if (true === $GLOBALS['cfg']['metaHookActive'] && false !== strpos($hook, 'user_meta')) return 10;
    if (is_string($GLOBALS['cfg']['blockedHook']) && $GLOBALS['cfg']['blockedHook'] === $hook) return 10;
    return empty($GLOBALS['filters'][$hook]) ? false : 10;
}
function clean_user_cache($user_id) { return null; }
function wp_cache_delete($key, $group = '') { return true; }
function get_user_by($field, $value) {
    if ('login' !== $field || !is_object($GLOBALS['user']) || $GLOBALS['user']->user_login !== $value) return false;
    return $GLOBALS['user'];
}
function get_userdata($id) {
    return is_object($GLOBALS['user']) && (int) $GLOBALS['user']->ID === (int) $id ? $GLOBALS['user'] : false;
}
function user_can($id, $capability) {
    return is_object($GLOBALS['user']) && (int) $GLOBALS['user']->ID === (int) $id
        && 'manage_options' === $capability && true === $GLOBALS['cfg']['admin'];
}
function get_user_meta($id, $key = null, $single = false) {
    if (null === $key) return $GLOBALS['meta'];
    $rows = $GLOBALS['meta'][$key] ?? array();
    return $single ? (empty($rows) ? '' : $rows[0]) : $rows;
}
function delete_user_meta($id, $key) {
    if (0 !== $GLOBALS['wpdb']->reconnect_retries_for_test()) throw new RuntimeException('reconnect guard inactive');
    $GLOBALS['calls']['delete'][] = $key;
    unset($GLOBALS['meta'][$key]);
    if ('course_3893_access_from' === $key) $GLOBALS['course_access'] = false;
    if ((int) $GLOBALS['cfg']['crashDeleteAt'] === count($GLOBALS['calls']['delete'])) exit(88);
    return true;
}
function add_user_meta($id, $key, $value, $unique = false) {
    if (0 !== $GLOBALS['wpdb']->reconnect_retries_for_test()) throw new RuntimeException('reconnect guard inactive');
    $GLOBALS['add_count']++;
    $GLOBALS['calls']['add'][] = $key;
    if ((int) $GLOBALS['cfg']['failAddAt'] === $GLOBALS['add_count']) return false;
    if (!isset($GLOBALS['meta'][$key])) $GLOBALS['meta'][$key] = array();
    $GLOBALS['meta'][$key][] = $value;
    if ('course_3893_access_from' === $key) $GLOBALS['course_access'] = true;
    if ((int) $GLOBALS['cfg']['crashAddAt'] === $GLOBALS['add_count']) exit(87);
    return 1;
}
function sfwd_lms_has_access($course_id, $user_id) {
    mmhq_test_producer_call('sfwd_lms_has_access');
    return 3893 === (int) $course_id && true === $GLOBALS['course_access'];
}
function ld_update_course_access($user_id, $course_id, $remove = false) {
    $GLOBALS['calls']['course'][] = array((int) $course_id, (bool) $remove);
    $GLOBALS['course_access'] = !$remove;
    if ($remove) {
        unset($GLOBALS['meta']['course_3893_access_from']);
        unset($GLOBALS['meta']['learndash_course_3893_enrolled_at']);
    } else {
        $GLOBALS['meta']['course_3893_access_from'] = array('1700000000');
        $GLOBALS['meta']['learndash_course_3893_enrolled_at'] = array('1700000000');
    }
    return true;
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function is_email($value) { return false !== filter_var($value, FILTER_VALIDATE_EMAIL) ? $value : false; }
function wp_salt($scheme = 'auth') { return 'test-only-auth-salt-which-is-longer-than-thirty-two-bytes'; }
function wp_check_password($password, $hash, $user_id = '') {
    $GLOBALS['password_checks']++;
    return is_string($hash) && hash_equals(hash('sha256', $password), $hash);
}
function wp_hash_password($password) { return hash('sha256', $password); }
function wp_using_ext_object_cache() { return true === $GLOBALS['cfg']['externalObjectCache']; }
	function learndash_use_legacy_course_access_list() { mmhq_test_producer_call('learndash_use_legacy_course_access_list'); return true === $GLOBALS['cfg']['legacyCourseAccessList']; }
	function learndash_user_get_enrolled_courses($id) { mmhq_test_producer_call('learndash_user_get_enrolled_courses'); return $GLOBALS['course_access'] ? array(3893) : array(); }
	function learndash_get_expired_user_courses_from_meta($id) { mmhq_test_producer_call('learndash_get_expired_user_courses_from_meta'); return array(); }
	function ld_course_access_expired($course_id, $user_id) { mmhq_test_producer_call('ld_course_access_expired'); return false; }
	function ld_course_access_expires_on($course_id, $user_id) { mmhq_test_producer_call('ld_course_access_expires_on'); return 0; }
	function wc_get_orders($args) { mmhq_test_producer_call('wc_get_orders'); return array(); }
function mmhq_cam_course_state($id) {
    mmhq_test_producer_call('mmhq_cam_course_state');
    return array(
        'source_available' => true,
        'current_course_ids' => is_array($GLOBALS['cfg']['currentCourseIds'])
            ? $GLOBALS['cfg']['currentCourseIds']
            : ($GLOBALS['course_access'] ? array(3893) : array()),
        'expired_course_ids' => $GLOBALS['cfg']['expiredCourseIds'],
        'revoked' => $GLOBALS['cfg']['courseRevoked'],
        'expires_at' => $GLOBALS['cfg']['courseExpiresAt'],
    );
}
function mmhq_cam_historical_course_ids($id) {
    mmhq_test_producer_call('mmhq_cam_historical_course_ids');
    return is_array($GLOBALS['cfg']['historicalCourseIds'])
        ? $GLOBALS['cfg']['historicalCourseIds']
        : ($GLOBALS['course_access'] ? array(3893) : array());
}
function mmhq_cam_purchase_state($id) {
    mmhq_test_producer_call('mmhq_cam_purchase_state');
    return array_merge(array(
        'source_available' => true,
        'matched' => false,
        'verified' => false,
        'refunded' => false,
        'cancelled' => false,
        'pending' => false,
    ), $GLOBALS['cfg']['purchaseOverride']);
}
function mmhq_cam_build_entitlement($id) {
    mmhq_test_producer_call('mmhq_cam_build_entitlement');
    $GLOBALS['cam_calls']++;
    return array_merge(array(
        'subject' => 'wp:' . (int) $id,
        'product' => 'cam',
        'source' => 'wordpress_learndash_handoff',
        'verified' => true,
        'trusted' => true,
        'active' => $GLOBALS['course_access'],
        'status' => $GLOBALS['course_access'] ? 'active' : 'not_eligible',
        'course_ids' => $GLOBALS['course_access'] ? array('3893') : array(),
        'program_tier' => ($GLOBALS['meta']['_mmed_program_tier'][0] ?? ''),
        'restricted' => false,
        'revoked' => false,
        'current_access_verified' => true,
        'purchase_verified' => false,
        'purchase_match_found' => false,
        'enrollment_verified' => $GLOBALS['course_access'],
        'authority_mode' => $GLOBALS['course_access'] ? 'learndash_current_access' : '',
        'revocation_checked' => true,
        'expires_at' => $GLOBALS['cfg']['courseExpiresAt'],
    ), $GLOBALS['cfg']['camOverride']);
}
function mmhq_lor_studio_identity_entitlement_for_user($id) {
    mmhq_test_producer_call('mmhq_lor_studio_identity_entitlement_for_user');
    if ($GLOBALS['cfg']['contractFail']) return new WP_Error();
    foreach (array(
        '_missionmed_lor_enabled' => '1',
        '_missionmed_lor_revoked_at' => '',
        '_missionmed_lor_canary_enabled' => '1',
        '_missionmed_lor_consent_accepted' => '1',
        '_missionmed_lor_consent_version' => 'dr145-v1',
        '_missionmed_lor_consent_revoked_at' => '',
    ) as $key => $value) {
        if (($GLOBALS['meta'][$key] ?? null) !== array($value)) return new WP_Error();
    }
    if (!isset($GLOBALS['meta']['_missionmed_lor_consent_at'][0])) return new WP_Error();
    if ('brinyu_test' === $GLOBALS['user']->user_login
        && (($GLOBALS['meta']['_mmed_program_tier'] ?? null) !== array('360elite') || !$GLOBALS['course_access'])) {
        return new WP_Error();
    }
	    return array(
	        'contract' => 'missionmed.lor.wordpress-entitlement.v1',
	        'subject' => 'wp:' . (int) $id,
	        'admitted' => true,
        'canaryEnabled' => true,
        'canaryConsented' => true,
    );
}
register_shutdown_function(function () {
    $trace = getenv('MMHQ_LOR_DR145_TEST_TRACE_FILE');
    if (!is_string($trace) || '' === $trace) return;
    $keys = array_keys($GLOBALS['meta']); sort($keys);
    $current_meta = $GLOBALS['meta']; ksort($current_meta);
    $initial_meta = $GLOBALS['initial_meta']; ksort($initial_meta);
    $roles = is_object($GLOBALS['user']) && isset($GLOBALS['user']->roles) ? $GLOBALS['user']->roles : array();
    $user_inert_shape = is_object($GLOBALS['user'])
        && 'brinyu_test' === ($GLOBALS['user']->user_login ?? null)
        && 'brinyu-test' === ($GLOBALS['user']->user_nicename ?? null)
        && 'brinyu_test' === ($GLOBALS['user']->display_name ?? null)
        && '' === ($GLOBALS['user']->user_url ?? null)
        && '' === ($GLOBALS['user']->user_activation_key ?? null)
        && 0 === (int) ($GLOBALS['user']->user_status ?? -1)
        && array() === $roles;
    file_put_contents($trace, json_encode(array(
        'metaKeys' => $keys,
        'meta' => $current_meta,
        'courseAccess' => $GLOBALS['course_access'],
        'userExists' => is_object($GLOBALS['user']),
        'roles' => $roles,
        'userInertShape' => $user_inert_shape,
        'createCount' => $GLOBALS['calls']['create'],
        'createdLoginExact' => $GLOBALS['created_login_ok'],
        'createdEmailExact' => $GLOBALS['created_email_ok'],
        'createdRoleEmpty' => $GLOBALS['created_role_empty'],
        'courseCalls' => $GLOBALS['calls']['course'],
        'camCalls' => $GLOBALS['cam_calls'],
        'addCount' => count($GLOBALS['calls']['add']),
        'deleteCount' => count($GLOBALS['calls']['delete']),
        'stateEqualsInitial' => $current_meta === $initial_meta
            && $GLOBALS['course_access'] === $GLOBALS['initial_course_access'],
        'passwordCheckCount' => $GLOBALS['password_checks'],
        'dbQueries' => $GLOBALS['db_queries'],
        'dbTransactionActive' => $GLOBALS['wpdb']->active,
        'dbReconnectRetries' => $GLOBALS['wpdb']->reconnect_retries_for_test(),
        'dbErrorsSuppressed' => $GLOBALS['wpdb']->suppress_errors,
		'inTxProducerCalls' => $GLOBALS['in_tx_producer_calls'],
    )));
});
require ${phpString(runnerPath)};
`;
}

function runPhp({ config, env }) {
  const effectiveEnv = { ...env };
  if (effectiveEnv.MMHQ_LOR_DR145_CUSTODY_FILE) {
    effectiveEnv.MMHQ_LOR_DR145_TEST_PRIVATE_STATE_DIR = dirname(effectiveEnv.MMHQ_LOR_DR145_CUSTODY_FILE);
  }
  const result = spawnSync('php', ['-d', 'display_errors=0'], {
    input: harness(config),
    encoding: 'utf8',
    env: { ...process.env, ...effectiveEnv },
    maxBuffer: 1024 * 1024,
  });
  const trace = env.MMHQ_LOR_DR145_TEST_TRACE_FILE
    ? JSON.parse(readFileSync(env.MMHQ_LOR_DR145_TEST_TRACE_FILE, 'utf8'))
    : null;
  return { ...result, trace };
}

function desiredPostMeta(consentAt) {
  return {
    _missionmed_lor_enabled: ['1'],
    _missionmed_lor_revoked_at: [''],
    _missionmed_lor_canary_enabled: ['1'],
    _missionmed_lor_consent_at: [consentAt],
    _missionmed_lor_consent_accepted: ['1'],
    _missionmed_lor_consent_version: ['dr145-v1'],
    _missionmed_lor_consent_revoked_at: [''],
    _mmed_program_tier: ['360elite'],
  };
}

function desiredStudentPostMeta(consentAt) {
  const enrollmentValue = String(Math.floor(Date.parse(consentAt) / 1000));
  return {
    ...desiredPostMeta(consentAt),
    course_3893_access_from: [enrollmentValue],
    learndash_course_3893_enrolled_at: [enrollmentValue],
  };
}

test('DR-145 provisioner is an exact no-secret, no-commerce, no-delete WP-CLI surface', { skip: !phpAvailable }, () => {
  assert.equal(spawnSync('php', ['-l', runnerPath], { encoding: 'utf8' }).status, 0);
  for (const key of metaKeys) assert.match(runnerSource, new RegExp(key));
  assert.match(runnerSource, /MMHQ_LOR_DR145_COURSE_ID = 3893/);
  assert.match(runnerSource, /MMHQ_LOR_DR145_PROGRAM_TIER = '360elite'/);
	  assert.doesNotMatch(runnerSource, /\$argv|\$_SERVER|wp_delete_user\s*\(|wp_mail\s*\(|wp_update_user\s*\(|set_role\s*\(|add_role\s*\(|remove_role\s*\(|payment|subscription|grade|progress/iu);
	  assert.doesNotMatch(runnerSource, /\bwc_get_orders\s*\(/u);
  assert.doesNotMatch(runnerSource, /getenv\(['"]MMHQ_LOR_DR145_TEST_EMAIL['"]\)/u);
  assert.doesNotMatch(runnerSource, /wp_insert_user\s*\(/u);
  assert.match(runnerSource, /mysqli_query\(\$dbh, \$query\)/u);
  assert.match(runnerSource, /mysqli_prepare\(\$dbh, \$query\)/u);
  assert.match(runnerSource, /mysqli_stmt_bind_param/u);
  assert.doesNotMatch(runnerSource, /mysqli_real_escape_string/u);
  assert.match(runnerSource, /`user_login`,`user_pass`,`user_nicename`,`user_email`,`user_url`,`user_registered`,`user_activation_key`,`user_status`,`display_name`/u);
	assert.match(runnerSource, /LEARNDASH_TRANSIENTS_DISABLED/u);
	assert.match(runnerSource, /object-cache\.php/u);
	assert.match(runnerSource, /performance_schema\.events_transactions_current/u);
	assert.match(runnerSource, /@@session\.in_transaction/u);
	assert.match(runnerSource, /mmhq_lor_dr145_native_assert_table_contract\(\$dbh, array\(\$wpdb->users, \$wpdb->usermeta\)\)/u);
	assert.match(runnerSource, /`wc_orders`|wc_orders/u);
	assert.match(runnerSource, /`billing_email` = \? LIMIT 1 FOR UPDATE/u);
	assert.match(runnerSource, /'_billing_email'.*\$email/su);
	assert.match(runnerSource, /'_customer_user'.*\(string\) \$user_id/su);
	assert.match(runnerSource, /INNER JOIN `\{\$wpdb->posts\}` AS `p`/u);
	assert.doesNotMatch(runnerSource, /FROM `\{\$wpdb->postmeta\}`[^"]*FOR UPDATE/u);
	assert.ok((runnerSource.match(/WHERE `user_nicename` = \? FOR UPDATE/gu) ?? []).length >= 2);
	assert.match(runnerSource, /return \$written === \$payload_bytes && @fflush\(\$handle\)/u);
  assert.doesNotMatch(runnerSource, /MMHQ_LOR_DR145_CUSTODY_FILE/u);
  assert.match(runnerSource, /MMHQ_LOR_DR145_PRIVATE_STATE_DIR/u);
  assert.match(runnerSource, /dr145-unrelated-meta-v2\\0" \. \$principal/u);
  assert.match(runnerSource, /if \('student' === \$principal\) \{\s*\$excluded = array_merge/u);
});

test('private custody and lock I/O is fresh-stat, owner-bound, durable, and replacement-safe', { skip: !phpAvailable }, () => {
  assert.match(runnerSource, /function mmhq_lor_dr145_effective_uid\(\)[\s\S]*function_exists\('posix_geteuid'\)/u);
  assert.match(runnerSource, /function mmhq_lor_dr145_fresh_lstat\(\$path\)[\s\S]*clearstatcache\(true, \$path\)/u);
  assert.match(runnerSource, /mmhq_lor_dr145_same_inode\(\$stat, \$open_stat\)/u);
  assert.match(runnerSource, /mmhq_lor_dr145_same_inode\(\$final_stat, \$final_path_stat\)/u);
  assert.match(runnerSource, /mmhq_lor_dr145_sync_parent\(\$path\)/u);
  assert.match(runnerSource, /@fsync\(\$handle\)/u);
  assert.match(runnerSource, /\.stage\.['"]? \./u);
  assert.match(runnerSource, /@link\(\$stage_path, \$path\)/u);
  assert.match(runnerSource, /mmhq_lor_dr145_sync_parent\(\$stage_path\)[\s\S]*@link\(\$stage_path, \$path\)[\s\S]*mmhq_lor_dr145_sync_parent\(\$path\)/u);
  assert.match(runnerSource, /2 === \(int\) \$stat\['nlink'\]/u);
  assert.equal((runnerSource.match(/@unlink\(/gu) ?? []).length, 0);
});

test('transactional runtime rejects caches, unsafe tables, indexes, triggers, or write-path hooks before mutation', { skip: !phpAvailable }, () => {
  const cases = [
    { config: { externalObjectCache: true }, principal: 'founder' },
    { config: { dbEngine: 'MyISAM' }, principal: 'founder' },
    { config: { dbIndexCount: 0 }, principal: 'founder' },
	    { config: { dbIdentityIndexCount: 1 }, principal: 'founder' },
	    { config: { dbIdentityIndexCount: 2 }, principal: 'founder' },
	    { config: { dbIdentityCollationCount: 1 }, principal: 'founder' },
	    { config: { dbIdentityCollationCount: 2 }, principal: 'founder' },
    { config: { dbTriggerCount: 1 }, principal: 'founder' },
    { config: { dbForeignKeyCount: 1 }, principal: 'founder' },
		{ config: { dbRuntimeCanonical: false }, principal: 'founder' },
		{ config: { dbGrants: ['GRANT USAGE ON *.* TO `missionmed`@`localhost`'] }, principal: 'founder' },
    { config: { dbMetadataQueryFails: true }, principal: 'founder' },
		{ config: { hposEnabled: false }, principal: 'student' },
		{ config: { hposOption: 'no' }, principal: 'student' },
			{ config: { hposDataStoreTopologyValid: false }, principal: 'student' },
			{ config: { wpVersion: '7.0.9' }, principal: 'student' },
    { config: { metaHookActive: true }, principal: 'founder' },
    { config: { blockedHook: 'get_user_metadata' }, principal: 'founder' },
		{ config: { blockedHook: 'default_user_metadata' }, principal: 'founder' },
    { config: { blockedHook: 'update_user_metadata_cache' }, principal: 'founder' },
	    { config: { blockedHook: 'check_password' }, principal: 'student' },
	    { config: { blockedHook: 'wp_hash_password_algorithm' }, principal: 'student' },
	    { config: { blockedHook: 'wp_hash_password_options' }, principal: 'student' },
	    { config: { blockedHook: 'all' }, principal: 'student' },
	    { config: { wpHasherActive: true }, principal: 'student' },
    { config: { saveQueries: true }, principal: 'founder' },
    { config: { saveQueries: 1 }, principal: 'founder' },
    { config: { saveQueries: '1' }, principal: 'founder' },
    { config: { blockedHook: 'query' }, principal: 'founder' },
    { config: { blockedHook: 'clean_user_cache' }, principal: 'founder' },
		{ config: { blockedHook: 'is_email' }, principal: 'student' },
		{ config: { blockedHook: 'mmhq_cam_restricted' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_order_query_args' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_order_query' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_orders_table_query_clauses' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_order_data_store_cpt_get_orders_query' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_order_data_store' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_data_stores' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_hpos_pre_query' }, principal: 'student' },
			{ config: { blockedHook: 'woocommerce_orders_table_query_sql' }, principal: 'student' },
			{ config: { blockedHook: 'woocommerce_orders_table_query_status_union_optimization' }, principal: 'student' },
			{ config: { blockedHook: 'sanitize_email' }, principal: 'student' },
			{ config: { blockedHook: 'sanitize_key' }, principal: 'student' },
			{ config: { blockedHook: 'sfwd_lms_has_access' }, principal: 'student' },
			{ config: { blockedHook: 'learndash_use_legacy_course_access_list' }, principal: 'student' },
			{ config: { blockedHook: 'learndash_get_user_groups_courses_ids' }, principal: 'student' },
			{ config: { blockedHook: 'learndash_override_course_auto_enroll' }, principal: 'student' },
			{ config: { blockedHook: 'learndash_group_course_auto_enroll' }, principal: 'student' },
			{ config: { blockedHook: 'ld_course_access_expires_on' }, principal: 'student' },
			{ config: { blockedHook: 'learndash_process_user_course_access_expire' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_order_get_items' }, principal: 'student' },
		{ config: { blockedHook: 'woocommerce_order_item_product_get_product_id' }, principal: 'student' },
    { config: { blockedHook: 'sanitize_user_meta__missionmed_lor_enabled' }, principal: 'founder' },
	  ];
  for (const [index, item] of cases.entries()) {
    const root = privateRoot();
    try {
      const custody = custodyPath(root, item.principal);
      const trace = join(root, `trace-${index}.json`);
      const env = {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: item.principal,
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      };
      if (item.principal === 'student') {
        const emailFile = join(root, 'student-email');
        writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
        chmodSync(emailFile, 0o600);
        env.MMHQ_LOR_DR145_TEST_EMAIL_FILE = emailFile;
      }
      const result = runPhp({ config: item.config, env });
      assert.equal(result.status, 1, `case ${index}`);
      assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
      assert.equal(result.trace.createCount, 0);
      assert.equal(result.trace.addCount, 0);
      assert.equal(result.trace.deleteCount, 0);
	      assert.equal(existsSync(custody), false, `case ${index}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('Founder apply touches exactly seven LOR keys and emits no identity or raw metadata', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'founder');
    const trace = join(root, 'trace.json');
    const result = runPhp({
      config: {},
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      },
    });
    assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /^\{[^\n]+\}\n$/u);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'APPLIED');
    assert.equal(receipt.principal, 'founder');
    assert.equal(receipt.preimage.userExisted, true);
    assert.equal(receipt.preimage.lorMeta._missionmed_lor_enabled.type, 'absent');
    assert.deepEqual(result.trace.metaKeys, [...metaKeys].sort());
    assert.equal(result.trace.createCount, 0);
    assert.deepEqual(result.trace.courseCalls, []);
    assert.equal(result.trace.camCalls, 0);
    assert.equal(result.trace.dbReconnectRetries, 5);
    assert.equal(result.trace.dbTransactionActive, false);
    assert.equal(result.trace.dbErrorsSuppressed, false);
    assert.equal(statSync(custody).mode & 0o777, 0o600);
    assert.equal(receipt.custodySha256, createHash('sha256').update(readFileSync(custody)).digest('hex'));
    assert.doesNotMatch(result.stdout, /987654|founder@example\.test|"value"|userId|user_email/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rollback remains available after capability and role drift while leaving that drift untouched', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'founder');
    const first = runPhp({
      config: {},
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'apply-trace.json'),
      },
    });
    assert.equal(first.status, 0, first.stderr);
    const receipt = JSON.parse(first.stdout);
    const privateCustody = JSON.parse(readFileSync(custody, 'utf8'));
    const postMeta = desiredPostMeta(privateCustody.desiredConsentAt);
    delete postMeta._mmed_program_tier;
    const rollback = runPhp({
      config: { admin: false, roles: ['subscriber'], meta: postMeta },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'rollback',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'rollback-trace.json'),
      },
    });
    assert.equal(rollback.status, 0, `${rollback.stderr}\n${JSON.stringify(rollback.trace)}`);
    assert.equal(JSON.parse(rollback.stdout).status, 'ROLLBACK_COMPLETE');
    assert.deepEqual(rollback.trace.roles, ['subscriber']);
    assert.deepEqual(rollback.trace.metaKeys, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('student rejects history, commerce, revocation, derived expiry, or raw access-to without leaving entitlement', { skip: !phpAvailable }, () => {
	  for (const config of [
	    { historicalCourseIds: [4000] },
	    { purchaseOverride: { matched: true, verified: true } },
	    { directCommerceAddressEmail: true },
	    { directCommerceOrderEmail: true },
	    { directCommerceCustomer: true },
	    { directCommerceLegacyEmail: true },
	    { directCommerceLegacyCustomer: true },
	    { hposOptionOnTransactionBegin: 'no' },
	    { dbEngineOnTransactionBegin: 'MyISAM' },
	    { courseRevoked: true },
    { courseExpiresAt: null },
    { courseExpiresAt: '2030-01-01T00:00:00+00:00' },
    { meta: { course_3893_access_to: ['1893456000'] } },
  ]) {
    const root = privateRoot();
    try {
      const emailFile = join(root, 'student-email');
      writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
      chmodSync(emailFile, 0o600);
      const trace = join(root, 'trace.json');
      const result = runPhp({
        config: { existing: false, login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: [], ...config },
        env: {
          MMHQ_LOR_DR145_OPERATION: 'apply',
          MMHQ_LOR_DR145_PRINCIPAL: 'student',
          MMHQ_LOR_DR145_CUSTODY_FILE: custodyPath(root, 'student'),
          MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
          MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
          MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
        },
      });
      assert.equal(result.status, 1, JSON.stringify(config));
      assert.equal(result.trace.stateEqualsInitial, true);
			for (const key of metaKeys) assert.equal(result.trace.metaKeys.includes(key), false);
			assert.equal(result.trace.courseAccess, false);
      assert.deepEqual(result.trace.courseCalls, []);
			assert.deepEqual(result.trace.inTxProducerCalls, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('student commerce email preflight rejects known guest orders before custody or account creation', { skip: !phpAvailable }, () => {
  for (const config of [
    { directCommerceAddressEmail: true },
    { directCommerceOrderEmail: true },
    { directCommerceLegacyEmail: true },
  ]) {
    const root = privateRoot();
    try {
      const emailFile = join(root, 'student-email');
      writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
      chmodSync(emailFile, 0o600);
      const custody = custodyPath(root, 'student');
      const result = runPhp({
        config: { existing: false, login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: [], ...config },
        env: {
          MMHQ_LOR_DR145_OPERATION: 'apply',
          MMHQ_LOR_DR145_PRINCIPAL: 'student',
          MMHQ_LOR_DR145_CUSTODY_FILE: custody,
          MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
          MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
          MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'trace.json'),
        },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
      assert.equal(result.trace.userExists, false);
      assert.equal(result.trace.createCount, 0);
      assert.equal(result.trace.addCount, 0);
      assert.equal(result.trace.deleteCount, 0);
      assert.equal(existsSync(custody), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('protected custody fails closed on non-string legacy metadata before publication or mutation', { skip: !phpAvailable }, () => {
  const cases = [
    { _missionmed_lor_enabled: [{ unsafe: true }] },
    { _missionmed_lor_enabled: [['nested']] },
  ];
  for (const meta of cases) {
    const root = privateRoot();
    try {
      const custody = custodyPath(root, 'founder');
      const result = runPhp({
        config: { meta },
        env: {
          MMHQ_LOR_DR145_OPERATION: 'apply',
          MMHQ_LOR_DR145_PRINCIPAL: 'founder',
          MMHQ_LOR_DR145_CUSTODY_FILE: custody,
          MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
          MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'trace.json'),
        },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
      assert.equal(result.trace.addCount, 0);
      assert.equal(result.trace.deleteCount, 0);
      assert.equal(existsSync(custody), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('student postimage requires the exact direct LearnDash no-commerce CAM contract', { skip: !phpAvailable }, () => {
	  const invalidCam = [
	    { subject: 'wp:999999' },
	    { purchase_verified: true },
    { purchase_match_found: true },
    { enrollment_verified: false },
    { authority_mode: 'learndash_and_woocommerce' },
    { course_ids: ['4000'] },
    { program_tier: '360_match_mentorship' },
    { expires_at: null },
    { expires_at: '2030-01-01T00:00:00+00:00' },
  ];
  for (const camOverride of invalidCam) {
    const root = privateRoot();
    try {
      const emailFile = join(root, 'student-email');
      writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
      chmodSync(emailFile, 0o600);
      const trace = join(root, 'trace.json');
      const result = runPhp({
        config: { existing: false, login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: [], camOverride },
        env: {
          MMHQ_LOR_DR145_OPERATION: 'apply',
          MMHQ_LOR_DR145_PRINCIPAL: 'student',
          MMHQ_LOR_DR145_CUSTODY_FILE: custodyPath(root, 'student'),
          MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
          MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
          MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
        },
      });
      assert.equal(result.status, 1, JSON.stringify(camOverride));
      assert.equal(result.trace.stateEqualsInitial, true);
			assert.equal(result.trace.userExists, true);
			assert.deepEqual(result.trace.inTxProducerCalls, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('Student apply, verify, rollback, and rollback replay are exact and preserve the inert account', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    const applyTrace = join(root, 'apply-trace.json');
    const apply = runPhp({
      config: { existing: false, login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: [], hposSyncRows: 14 },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: applyTrace,
      },
    });
    assert.equal(apply.status, 0, apply.stderr);
    const applyReceipt = JSON.parse(apply.stdout);
    assert.equal(applyReceipt.status, 'APPLIED');
    assert.deepEqual(apply.trace.metaKeys, [
      ...metaKeys,
      '_mmed_program_tier',
      'course_3893_access_from',
      'learndash_course_3893_enrolled_at',
    ].sort());
    assert.equal(apply.trace.createCount, 1);
    assert.equal(apply.trace.createdLoginExact, true);
    assert.equal(apply.trace.createdEmailExact, true);
    assert.equal(apply.trace.createdRoleEmpty, true);
    assert.deepEqual(apply.trace.roles, []);
    assert.deepEqual(apply.trace.courseCalls, []);
		assert.deepEqual(apply.trace.inTxProducerCalls, []);
    assert.doesNotMatch(apply.stdout, /777777|qa\.canary@example\.test|userId|user_email|"value"/u);
    assert.equal(statSync(custody).mode & 0o777, 0o600);
    assert.equal(statSync(custody).nlink, 2);
    assert.equal(statSync(publishedStagePath(custody)).ino, statSync(custody).ino);
    assert.equal(statSync(boundIdentityPath(root)).mode & 0o777, 0o600);
    assert.equal(statSync(boundIdentityPath(root)).nlink, 2);
    assert.equal(statSync(publishedStagePath(boundIdentityPath(root))).ino, statSync(boundIdentityPath(root)).ino);
    const pendingIdentity = JSON.parse(readFileSync(custody, 'utf8')).pendingIdentity;
    const boundIdentity = JSON.parse(readFileSync(boundIdentityPath(root), 'utf8'));
    assert.equal(pendingIdentity.state, 'pending');
    assert.equal(boundIdentity.boundUserId, 777777);
    assert.equal(boundIdentity.state, 'bound');
    assert.notEqual(
      applyReceipt.custodySha256,
      createHash('sha256').update(readFileSync(custody)).digest('hex'),
    );

    const privateCustody = JSON.parse(readFileSync(custody, 'utf8'));
    const postMeta = desiredStudentPostMeta(privateCustody.desiredConsentAt);
    const verifyTrace = join(root, 'verify-trace.json');
    const verify = runPhp({
      config: { login: 'brinyu_test', email: 'qa.canary@example.test', userId: 777777, admin: false, roles: [], meta: postMeta, courseAccess: true },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'verify',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: applyReceipt.custodySha256,
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: verifyTrace,
      },
    });
    assert.equal(verify.status, 0, verify.stderr);
    assert.equal(JSON.parse(verify.stdout).status, 'VERIFIED');
    assert.deepEqual(verify.trace.courseCalls, []);
		assert.equal(verify.trace.dbQueries.includes('START TRANSACTION'), true);
		assert.equal(verify.trace.dbQueries.some((query) => query.includes('FOR UPDATE')), true);
		assert.equal(verify.trace.dbQueries.includes('COMMIT'), true);
		assert.equal(verify.trace.dbTransactionActive, false);
		assert.deepEqual(verify.trace.inTxProducerCalls, []);

    const rollbackTrace = join(root, 'rollback-trace.json');
    const rollback = runPhp({
	      config: { login: 'brinyu_test', email: 'qa.canary@example.test', userId: 777777, admin: false, roles: [], meta: postMeta, courseAccess: true },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'rollback',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: applyReceipt.custodySha256,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: rollbackTrace,
      },
    });
    assert.equal(rollback.status, 0, `${rollback.stderr}\n${JSON.stringify(rollback.trace)}`);
    assert.equal(JSON.parse(rollback.stdout).status, 'ENTITLEMENT_ROLLBACK_COMPLETE_ACCOUNT_PRESERVED');
	    assert.doesNotMatch(rollback.stdout, /qa\.canary/u);
    assert.deepEqual(rollback.trace.metaKeys, []);
    assert.equal(rollback.trace.courseAccess, false);
    assert.equal(rollback.trace.userExists, true);
    assert.deepEqual(rollback.trace.roles, []);
		assert.deepEqual(rollback.trace.inTxProducerCalls, []);

    const replayTrace = join(root, 'replay-trace.json');
    const replay = runPhp({
      config: { login: 'brinyu_test', email: 'qa.canary@example.test', userId: 777777, admin: false, roles: [], meta: {}, courseAccess: false },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'rollback',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: applyReceipt.custodySha256,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: replayTrace,
      },
    });
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).status, 'ENTITLEMENT_ROLLBACK_COMPLETE_ACCOUNT_PRESERVED');
    assert.deepEqual(replay.trace.courseCalls, []);
    assert.equal(replay.trace.stateEqualsInitial, true);
		assert.deepEqual(replay.trace.inTxProducerCalls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
	});

test('native transactional course-state classification rejects malformed or partial LearnDash rows without producer calls', { skip: !phpAvailable }, () => {
	const root = privateRoot();
	try {
		const custody = custodyPath(root, 'student');
		const emailFile = join(root, 'student-email');
		writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
		chmodSync(emailFile, 0o600);
		const apply = runPhp({
			config: { existing: false, login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: [] },
			env: {
				MMHQ_LOR_DR145_OPERATION: 'apply',
				MMHQ_LOR_DR145_PRINCIPAL: 'student',
				MMHQ_LOR_DR145_CUSTODY_FILE: custody,
				MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
				MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
				MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'apply-trace.json'),
			},
		});
		assert.equal(apply.status, 0, apply.stderr);
		const receipt = JSON.parse(apply.stdout);
		const envelope = JSON.parse(readFileSync(custody, 'utf8'));
		const exact = desiredStudentPostMeta(envelope.desiredConsentAt);
		const variants = [
			{ ...exact, course_3893_access_from: ['not-an-epoch'] },
			{ ...exact, course_3893_access_from: ['1', '2'] },
			{ ...exact, learndash_course_3893_enrolled_at: ['1'] },
			{ ...exact, course_3893_access_to: ['1893456000'] },
			Object.fromEntries(Object.entries(exact).filter(([key]) => key !== 'course_3893_access_from')),
			Object.fromEntries(Object.entries(exact).filter(([key]) => key !== 'learndash_course_3893_enrolled_at')),
		];
		for (const [index, meta] of variants.entries()) {
			const result = runPhp({
				config: { login: 'brinyu_test', email: 'qa.canary@example.test', userId: 777777, admin: false, roles: [], meta, courseAccess: true },
				env: {
					MMHQ_LOR_DR145_OPERATION: 'verify',
					MMHQ_LOR_DR145_PRINCIPAL: 'student',
					MMHQ_LOR_DR145_CUSTODY_FILE: custody,
					MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
					MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
					MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, `malformed-${index}.json`),
				},
			});
			assert.equal(result.status, 1, `variant ${index}`);
			assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
			assert.equal(result.trace.dbQueries.includes('ROLLBACK'), true);
			assert.deepEqual(result.trace.inTxProducerCalls, []);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

	test('student rollback fails closed on email drift and preserves the applied entitlement', { skip: !phpAvailable }, () => {
	  const root = privateRoot();
	  try {
	    const custody = custodyPath(root, 'student');
	    const emailFile = join(root, 'student-email');
	    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
	    chmodSync(emailFile, 0o600);
	    const apply = runPhp({
	      config: { existing: false, login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: [] },
	      env: {
	        MMHQ_LOR_DR145_OPERATION: 'apply',
	        MMHQ_LOR_DR145_PRINCIPAL: 'student',
	        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
	        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
	        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
	        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'apply-trace.json'),
	      },
	    });
	    assert.equal(apply.status, 0, apply.stderr);
	    const receipt = JSON.parse(apply.stdout);
	    const privateCustody = JSON.parse(readFileSync(custody, 'utf8'));
	    const postMeta = desiredStudentPostMeta(privateCustody.desiredConsentAt);
	    const rollback = runPhp({
	      config: {
	        login: 'brinyu_test',
	        email: 'changed-after-canary@example.test',
	        userId: 777777,
	        admin: false,
	        roles: [],
	        meta: postMeta,
	        courseAccess: true,
	      },
	      env: {
	        MMHQ_LOR_DR145_OPERATION: 'rollback',
	        MMHQ_LOR_DR145_PRINCIPAL: 'student',
	        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
	        MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
	        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'rollback-trace.json'),
	      },
	    });
	    assert.equal(rollback.status, 1);
	    assert.equal(rollback.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
	    assert.equal(rollback.trace.stateEqualsInitial, true);
	    assert.equal(rollback.trace.courseAccess, true);
	    assert.equal(rollback.trace.addCount, 0);
	    assert.equal(rollback.trace.deleteCount, 0);
	  } finally {
	    rmSync(root, { recursive: true, force: true });
	  }
	});

	test('created-student custody rejects a same-login and same-email replacement ID for every later operation', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    const apply = runPhp({
      config: { existing: false, login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: [] },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'initial-trace.json'),
      },
    });
    assert.equal(apply.status, 0, apply.stderr);
    const receipt = JSON.parse(apply.stdout);
    const privateCustody = JSON.parse(readFileSync(custody, 'utf8'));
    const postMeta = desiredStudentPostMeta(privateCustody.desiredConsentAt);
    for (const operation of ['apply', 'verify', 'rollback']) {
      const trace = join(root, `${operation}-replacement-trace.json`);
      const replacement = runPhp({
        config: {
          login: 'brinyu_test',
          email: 'qa.canary@example.test',
          userId: 888888,
          admin: false,
          roles: [],
          meta: postMeta,
          courseAccess: true,
        },
        env: {
          MMHQ_LOR_DR145_OPERATION: operation,
          MMHQ_LOR_DR145_PRINCIPAL: 'student',
          MMHQ_LOR_DR145_CUSTODY_FILE: custody,
          MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
          MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
          MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
        },
      });
      assert.equal(replacement.status, 1, operation);
      assert.equal(replacement.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
      assert.equal(replacement.trace.addCount, 0);
      assert.equal(replacement.trace.deleteCount, 0);
      assert.deepEqual(replacement.trace.courseCalls, []);
      assert.equal(replacement.trace.camCalls, 0);
      assert.equal(replacement.trace.stateEqualsInitial, true);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a stale bound-identity sidecar blocks NEW student creation before custody or user mutation', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    const trace = join(root, 'trace.json');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    writeFileSync(boundIdentityPath(root), '{}\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    chmodSync(boundIdentityPath(root), 0o600);
    const result = runPhp({
      config: { existing: false, login: 'brinyu_test', admin: false, roles: [] },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      },
    });
    assert.equal(result.status, 1);
    assert.equal(result.trace.createCount, 0);
    assert.equal(result.trace.stateEqualsInitial, true);
    assert.equal(existsSync(custody), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('student creation resumes from write-ahead pending custody after an insert-boundary crash', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    const interrupted = runPhp({
      config: { existing: false, login: 'brinyu_test', admin: false, roles: [] },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_CRASH_AFTER_CREATE: '1',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'interrupted-trace.json'),
      },
    });
    assert.equal(interrupted.status, 86);
    assert.equal(interrupted.trace.createCount, 1);
    assert.equal(interrupted.trace.userInertShape, true);
    assert.equal(existsSync(custody), true);
    assert.equal(existsSync(boundIdentityPath(root)), false);
    const envelope = JSON.parse(readFileSync(custody, 'utf8'));
    const pending = envelope.pendingIdentity;
    const baseSha = createHash('sha256').update(readFileSync(custody)).digest('hex');
    const pendingHandle = createHash('sha256')
      .update('dr145-pending-custody-handle-v2\0')
      .update(baseSha)
      .digest('hex');
    const pendingSha = createHash('sha256').update(JSON.stringify(pending)).digest('hex');
    const originPassword = createHmac('sha256', `${testAuthKey}\0${testAuthSalt}`)
      .update(`dr145-student-origin-password-v1\0${baseSha}\0${pendingSha}\0${envelope.expectedEmailSha256}`)
      .digest('hex');
    const originPasswordHash = createHash('sha256').update(originPassword).digest('hex');

    const substitution = runPhp({
      config: {
        login: 'brinyu_test',
        email: 'qa.canary@example.test',
        userId: 888888,
        registeredAt: pending.expectedRegisteredAt,
        passwordHash: 'replacement-account-password-hash',
        admin: false,
        roles: [],
      },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'substitution-trace.json'),
      },
    });
    assert.equal(substitution.status, 1);
    assert.equal(substitution.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
    assert.equal(substitution.trace.passwordCheckCount, 2);
    assert.equal(substitution.trace.addCount, 0);
    assert.equal(existsSync(boundIdentityPath(root)), false);

    const resumed = runPhp({
      config: {
        login: 'brinyu_test',
        email: 'qa.canary@example.test',
        userId: 777777,
        registeredAt: pending.expectedRegisteredAt,
        passwordHash: originPasswordHash,
        admin: false,
        roles: [],
      },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'resumed-trace.json'),
      },
    });
    assert.equal(resumed.status, 0, resumed.stderr);
    const receipt = JSON.parse(resumed.stdout);
    assert.equal(receipt.status, 'APPLIED');
    assert.notEqual(receipt.custodySha256, pendingHandle);
    assert.equal(resumed.trace.createCount, 0);
    assert.equal(resumed.trace.passwordCheckCount, 4);
    assert.equal(existsSync(boundIdentityPath(root)), true);
    assert.doesNotMatch(resumed.stdout, new RegExp(pending.expectedRegisteredAt, 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a password reset between identity binding and the entitlement lock fails before metadata grant', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    const interrupted = runPhp({
      config: { existing: false, login: 'brinyu_test', admin: false, roles: [] },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_CRASH_AFTER_CREATE: '1',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'identity-created-trace.json'),
      },
    });
    assert.equal(interrupted.status, 86);
    const envelope = JSON.parse(readFileSync(custody, 'utf8'));
    const baseSha = createHash('sha256').update(readFileSync(custody)).digest('hex');
    const pendingSha = createHash('sha256').update(JSON.stringify(envelope.pendingIdentity)).digest('hex');
    const originPassword = createHmac('sha256', `${testAuthKey}\0${testAuthSalt}`)
      .update(`dr145-student-origin-password-v1\0${baseSha}\0${pendingSha}\0${envelope.expectedEmailSha256}`)
      .digest('hex');
    const raced = runPhp({
      config: {
        login: 'brinyu_test',
        email: 'qa.canary@example.test',
        userId: 777777,
        registeredAt: envelope.pendingIdentity.expectedRegisteredAt,
        passwordHash: createHash('sha256').update(originPassword).digest('hex'),
        admin: false,
        roles: [],
        passwordResetOnTransactionBegin: true,
      },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'password-race-trace.json'),
      },
    });
    assert.equal(raced.status, 1);
    assert.equal(raced.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
    assert.equal(raced.trace.passwordCheckCount, 4);
    assert.equal(raced.trace.addCount, 0);
    assert.equal(raced.trace.deleteCount, 0);
    assert.equal(raced.trace.courseAccess, false);
    assert.equal(raced.trace.dbQueries.includes('ROLLBACK'), true);
    assert.equal(raced.trace.dbTransactionActive, false);
    assert.equal(existsSync(boundIdentityPath(root)), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a crash inside the direct inert-account transaction leaves only pending custody and replays cleanly', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    const interrupted = runPhp({
      config: { existing: false, login: 'brinyu_test', admin: false, roles: [] },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_CRASH_DURING_CREATE: '1',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'interrupted-create-trace.json'),
      },
    });
    assert.equal(interrupted.status, 85);
    assert.equal(interrupted.trace.userExists, false);
    assert.equal(interrupted.trace.createCount, 0);
    assert.equal(existsSync(custody), true);
    assert.equal(existsSync(boundIdentityPath(root)), false);

    const changedEmailFile = join(root, 'changed-student-email');
    writeFileSync(changedEmailFile, 'different.canary@example.test\n', { mode: 0o600 });
    chmodSync(changedEmailFile, 0o600);
    const changedEmailReplay = runPhp({
      config: {
        existing: false,
        login: 'brinyu_test',
        admin: false,
        roles: [],
        expectedStudentEmail: 'different.canary@example.test',
      },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: changedEmailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'changed-email-trace.json'),
      },
    });
    assert.equal(changedEmailReplay.status, 1);
    assert.equal(changedEmailReplay.trace.createCount, 0);
    assert.equal(changedEmailReplay.trace.userExists, false);
    assert.equal(existsSync(boundIdentityPath(root)), false);

    const replay = runPhp({
      config: { existing: false, login: 'brinyu_test', admin: false, roles: [] },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'replay-create-trace.json'),
      },
    });
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(replay.trace.createCount, 1);
    assert.equal(replay.trace.userInertShape, true);
    assert.equal(existsSync(boundIdentityPath(root)), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a pre-existing student email or nicename collision fails before account or entitlement mutation', { skip: !phpAvailable }, () => {
	for (const collision of ['emailCollision', 'nicenameCollision']) {
	  const root = privateRoot();
	  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    const trace = join(root, 'email-collision-trace.json');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    const result = runPhp({
      config: { existing: false, login: 'brinyu_test', admin: false, roles: [], [collision]: true },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
    assert.equal(result.trace.userExists, false);
    assert.equal(result.trace.createCount, 0);
    assert.equal(result.trace.addCount, 0);
    assert.equal(result.trace.deleteCount, 0);
	  } finally {
	    rmSync(root, { recursive: true, force: true });
	  }
	}
});

test('a closed stdout makes the committed receipt path fail closed instead of reporting success', { skip: !phpAvailable }, () => {
	const root = privateRoot();
	try {
		const custody = custodyPath(root, 'founder');
		const result = spawnSync('/bin/sh', ['-c', 'exec 1>&-; exec php -d display_errors=0 -d log_errors=0'], {
			input: harness({}),
			encoding: 'utf8',
			env: {
				...process.env,
				MMHQ_LOR_DR145_OPERATION: 'apply',
				MMHQ_LOR_DR145_PRINCIPAL: 'founder',
				MMHQ_LOR_DR145_CUSTODY_FILE: custody,
				MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
				MMHQ_LOR_DR145_TEST_PRIVATE_STATE_DIR: root,
			},
			maxBuffer: 1024 * 1024,
		});
		assert.equal(result.status, 1);
		assert.equal(result.stdout ?? '', '');
		assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('a pre-existing student is never silently adopted into a new canary custody envelope', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'student');
    const emailFile = join(root, 'student-email');
    const trace = join(root, 'pre-existing-student-trace.json');
    writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
    chmodSync(emailFile, 0o600);
    const result = runPhp({
      config: {
        login: 'brinyu_test',
        email: 'qa.canary@example.test',
        userId: 777777,
        admin: false,
        roles: [],
      },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'student',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
    assert.equal(result.trace.createCount, 0);
    assert.equal(result.trace.addCount, 0);
    assert.equal(result.trace.deleteCount, 0);
    assert.equal(result.trace.stateEqualsInitial, true);
    assert.equal(existsSync(custody), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing secure email, Founder capability loss, extra LOR metadata, and identity collision fail before mutation', { skip: !phpAvailable }, () => {
  const cases = [
    { config: { existing: false, login: 'brinyu_test', admin: false, roles: [] }, principal: 'student', email: false },
    { config: { admin: false }, principal: 'founder', email: false },
    { config: { meta: { _missionmed_lor_unlisted: ['1'] } }, principal: 'founder', email: false },
		{ config: { duplicateLogin: true }, principal: 'founder', email: false },
		{ config: { duplicateEmail: true }, principal: 'founder', email: false },
    { config: { login: 'brinyu_test', email: 'different@example.test', admin: false, roles: [] }, principal: 'student', email: true },
    { config: { login: 'brinyu_test', email: 'qa.canary@example.test', admin: false, roles: ['subscriber'] }, principal: 'student', email: true },
  ];
  for (const [index, item] of cases.entries()) {
    const root = privateRoot();
    try {
      const custody = custodyPath(root, item.principal);
      const trace = join(root, 'trace.json');
      const emailFile = join(root, 'student-email');
      if (item.email) {
        writeFileSync(emailFile, 'qa.canary@example.test\n', { mode: 0o600 });
        chmodSync(emailFile, 0o600);
      }
      const env = {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: item.principal,
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      };
      if (item.email) env.MMHQ_LOR_DR145_TEST_EMAIL_FILE = emailFile;
      const result = runPhp({ config: item.config, env });
      assert.equal(result.status, 1, `case ${index}`);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
      assert.equal(result.trace.createCount, 0);
      assert.deepEqual(result.trace.courseCalls, []);
      assert.equal(result.trace.stateEqualsInitial, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('a caught mid-apply write failure rolls back the database transaction to the exact preimage', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'founder');
    const trace = join(root, 'trace.json');
    const result = runPhp({
      config: {
        meta: { _missionmed_lor_enabled: ['legacy'], unrelated_key: ['preserve'] },
        failAddAt: 4,
      },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
    assert.equal(result.trace.stateEqualsInitial, true);
    assert.equal(statSync(custody).mode & 0o777, 0o600);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the bounded fake transaction leaves a simulated interrupted apply uncommitted and replay resumes from custody', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'founder');
    const interrupted = runPhp({
      config: { crashAddAt: 4 },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'interrupted-trace.json'),
      },
    });
    assert.equal(interrupted.status, 87);
    assert.equal(interrupted.trace.dbTransactionActive, true);
    assert.equal(interrupted.trace.dbQueries.includes('COMMIT'), false);
    assert.equal(existsSync(custody), true);
    assert.equal(statSync(custody).nlink, 2);

    const replay = runPhp({
      config: {},
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'replay-trace.json'),
      },
    });
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).status, 'APPLIED');
    assert.equal(replay.trace.dbQueries.includes('COMMIT'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the bounded fake transaction leaves a simulated interrupted rollback uncommitted and replay restores the preimage', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'founder');
    const apply = runPhp({
      config: {},
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'apply-trace.json'),
      },
    });
    assert.equal(apply.status, 0, apply.stderr);
    const receipt = JSON.parse(apply.stdout);
    const envelope = JSON.parse(readFileSync(custody, 'utf8'));
    const postMeta = desiredPostMeta(envelope.desiredConsentAt);
    delete postMeta._mmed_program_tier;

    const interrupted = runPhp({
      config: { meta: postMeta, crashDeleteAt: 4 },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'rollback',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'interrupted-rollback-trace.json'),
      },
    });
    assert.equal(interrupted.status, 88);
    assert.equal(interrupted.trace.dbTransactionActive, true);
    assert.equal(interrupted.trace.dbQueries.includes('COMMIT'), false);

    const replay = runPhp({
      config: { meta: postMeta },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'rollback',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'replay-rollback-trace.json'),
      },
    });
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).status, 'ROLLBACK_COMPLETE');
    assert.equal(replay.trace.stateEqualsInitial, false);
    assert.deepEqual(replay.trace.metaKeys, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a post-commit crash replay compensates failed live proof, including a crash after compensation commit', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'founder');
    const interrupted = runPhp({
      config: { crashAfterCommitAt: 1 },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'post-commit-crash-trace.json'),
      },
    });
    assert.equal(interrupted.status, 89);
    assert.equal(interrupted.trace.dbQueries.includes('COMMIT'), true);
    assert.equal(interrupted.trace.dbTransactionActive, false);
    assert.deepEqual(interrupted.trace.metaKeys, [...metaKeys].sort());

    const compensationCrash = runPhp({
      config: { meta: interrupted.trace.meta, contractFail: true, crashAfterCommitAt: 2 },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'compensation-commit-crash-trace.json'),
      },
    });
    assert.equal(compensationCrash.status, 89);
    assert.equal(compensationCrash.trace.dbQueries.filter((query) => query === 'COMMIT').length, 2);
    assert.deepEqual(compensationCrash.trace.metaKeys, []);
    assert.equal(compensationCrash.trace.dbTransactionActive, false);

    const replay = runPhp({
      config: { meta: compensationCrash.trace.meta, contractFail: true },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'final-replay-trace.json'),
      },
    });
    assert.equal(replay.status, 1);
    assert.equal(replay.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
    assert.deepEqual(replay.trace.metaKeys, []);
    assert.equal(replay.trace.dbQueries.filter((query) => query === 'COMMIT').length, 2);
    assert.equal(replay.trace.dbTransactionActive, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('student email and custody paths reject permissive files, symlinks, and private-parent violations', { skip: !phpAvailable }, () => {
  for (const variant of ['permissive', 'symlink', 'writable-parent']) {
    const root = privateRoot();
    try {
      const secureTarget = join(root, 'secure-target');
      writeFileSync(secureTarget, 'qa.canary@example.test\n', { mode: 0o600 });
      chmodSync(secureTarget, 0o600);
      let emailFile = secureTarget;
      if (variant === 'permissive') chmodSync(secureTarget, 0o644);
      if (variant === 'symlink') {
        emailFile = join(root, 'email-link');
        symlinkSync(secureTarget, emailFile);
      }
      if (variant === 'writable-parent') chmodSync(root, 0o770);
      const trace = join(root, 'trace.json');
      const result = runPhp({
        config: { existing: false, login: 'brinyu_test', admin: false, roles: [] },
        env: {
          MMHQ_LOR_DR145_OPERATION: 'apply',
          MMHQ_LOR_DR145_PRINCIPAL: 'student',
          MMHQ_LOR_DR145_CUSTODY_FILE: join(root, 'custody.json'),
          MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
          MMHQ_LOR_DR145_TEST_EMAIL_FILE: emailFile,
          MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
        },
      });
      assert.equal(result.status, 1, variant);
      assert.equal(result.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
      assert.equal(result.trace.createCount, 0);
      assert.equal(result.trace.stateEqualsInitial, true);
    } finally {
      chmodSync(root, 0o700);
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('custody tamper and postimage divergence fail before rollback mutation', { skip: !phpAvailable }, () => {
  for (const variant of ['tamper', 'divergence']) {
    const root = privateRoot();
    try {
      const custody = custodyPath(root, 'founder');
      const apply = runPhp({
        config: {},
        env: {
          MMHQ_LOR_DR145_OPERATION: 'apply',
          MMHQ_LOR_DR145_PRINCIPAL: 'founder',
          MMHQ_LOR_DR145_CUSTODY_FILE: custody,
          MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
          MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'apply-trace.json'),
        },
      });
      assert.equal(apply.status, 0, apply.stderr);
      const receipt = JSON.parse(apply.stdout);
      const privateCustody = JSON.parse(readFileSync(custody, 'utf8'));
      const postMeta = desiredPostMeta(privateCustody.desiredConsentAt);
      delete postMeta._mmed_program_tier;
      if (variant === 'tamper') writeFileSync(custody, `${readFileSync(custody, 'utf8')} `, { mode: 0o600 });
      if (variant === 'divergence') postMeta._missionmed_lor_enabled = ['diverged'];
      const trace = join(root, 'rollback-trace.json');
      const rollback = runPhp({
        config: { meta: postMeta },
        env: {
          MMHQ_LOR_DR145_OPERATION: 'rollback',
          MMHQ_LOR_DR145_PRINCIPAL: 'founder',
          MMHQ_LOR_DR145_CUSTODY_FILE: custody,
          MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
          MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
        },
      });
      assert.equal(rollback.status, 1, variant);
      assert.equal(rollback.stderr.trim(), 'DR145_PROVISIONING_FAILED_CLOSED');
      assert.equal(rollback.trace.addCount, 0);
      assert.equal(rollback.trace.deleteCount, 0);
      assert.equal(rollback.trace.stateEqualsInitial, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('apply replay is a mutation-free exact postimage no-op', { skip: !phpAvailable }, () => {
  const root = privateRoot();
  try {
    const custody = custodyPath(root, 'founder');
    const first = runPhp({
      config: {},
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: 'NEW',
        MMHQ_LOR_DR145_TEST_TRACE_FILE: join(root, 'first-trace.json'),
      },
    });
    assert.equal(first.status, 0, first.stderr);
    const receipt = JSON.parse(first.stdout);
    const privateCustody = JSON.parse(readFileSync(custody, 'utf8'));
    const postMeta = desiredPostMeta(privateCustody.desiredConsentAt);
    delete postMeta._mmed_program_tier;
    const trace = join(root, 'replay-trace.json');
    const replay = runPhp({
      config: { meta: postMeta },
      env: {
        MMHQ_LOR_DR145_OPERATION: 'apply',
        MMHQ_LOR_DR145_PRINCIPAL: 'founder',
        MMHQ_LOR_DR145_CUSTODY_FILE: custody,
        MMHQ_LOR_DR145_CUSTODY_SHA256: receipt.custodySha256,
        MMHQ_LOR_DR145_TEST_TRACE_FILE: trace,
      },
    });
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).status, 'ALREADY_APPLIED');
    assert.equal(replay.trace.addCount, 0);
    assert.equal(replay.trace.deleteCount, 0);
    assert.deepEqual(replay.trace.courseCalls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
