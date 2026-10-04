<?php
/**
 * Plugin Name: MissionMed Interview Ready
 * Dedicated free-account gateway. DR-375/376; no enrollment or identity mutation.
 */
namespace MissionMed\InterviewReady;
use \wpdb; use \mysqli; use \WP_Error; use \WP_REST_Response; use \RuntimeException; use \Throwable;

if (!defined('ABSPATH')) { exit; }

// WP retries a failed query on a new connection. That must never bypass our lock.
class MMed_IR_Locked_DB extends wpdb {
    private $ir_handle;
    private $ir_thread;
    private $ir_lock;
    public function __construct($owner, $handle, $thread, $lock) {
        foreach (get_object_vars($owner) as $key => $value) { $this->$key = $value; }
        $this->dbh = $handle;
        $this->show_errors = false; $this->suppress_errors = true;
        $this->ir_handle = $handle; $this->ir_thread = $thread; $this->ir_lock = $lock;
    }
    public function db_connect($allow_bail = true) { return false; }
    public function check_connection($allow_bail = true) { return false; }
    public function intact() {
        if ($this->dbh !== $this->ir_handle) { return false; }
        try {
            $r = mysqli_query($this->ir_handle, "SELECT CONNECTION_ID(), IS_USED_LOCK('" . $this->ir_lock . "')");
            $v = $r ? mysqli_fetch_row($r) : null;
            if ($r) { mysqli_free_result($r); }
            return $v && (string)$v[0] === (string)$this->ir_thread && (string)$v[1] === (string)$this->ir_thread;
        } catch (Throwable $e) { return false; }
    }
    public function query($query) {
        if (!$this->intact()) { throw new RuntimeException('ir_connection_lost'); }
        return parent::query($query);
    }
}

final class MMed_IR_Gateway {
    const META = '_mmed_ir_state_v1';
    const MARKER = '/* MMED_IR_ACCOUNT_CONTEXT */ null';
    const KIT_KEYS = ['online:webcam:bc:B09NBWWP79','online:webcam:fc:B0CW1S7XP5','online:webcam:pj:B0BTTV6CT1','online:mic:bc:B07FKG8PGZ','online:mic:fc:B0CTJ7PVN1','online:mic:pj:B0002E4Z8M','online:light:bc:B097QZGRCQ','online:light:fc:B07L755X9G','online:light:pj:B07L755X9G','online:mount:bc:plan','online:mount:fc:B097376LKF','online:mount:pj:B07K3FN5MR','online:background:bc:plan','online:background:fc:plan','online:background:pj:plan','online:power:bc:B08CK9X9Z8','online:power:fc:plan','online:power:pj:plan','online:accessories:bc:B0CVY4566H','online:accessories:fc:B09738CV2G','online:accessories:pj:B0BJL8SJ59','in-person:padfolio:bc:B004HMRQF4','in-person:padfolio:fc:plan','in-person:padfolio:pj:plan','in-person:documents:bc:plan','in-person:documents:fc:plan','in-person:documents:pj:plan','in-person:packing:bc:B09KN3FMY7','in-person:packing:fc:plan','in-person:packing:pj:plan','in-person:garment:bc:plan','in-person:garment:fc:plan','in-person:garment:pj:plan','in-person:powertravel:bc:plan','in-person:powertravel:fc:plan','in-person:powertravel:pj:plan','in-person:grooming:bc:plan','in-person:grooming:fc:plan','in-person:grooming:pj:plan','in-person:emergency:bc:B0C4WC8QJR','in-person:emergency:fc:plan','in-person:emergency:pj:plan','in-person:luggage:bc:plan','in-person:luggage:fc:plan','in-person:luggage:pj:plan'];
    public static function empty_state() {
        return ['revision'=>0, 'lastCommandId'=>'', 'lastCommandDigest'=>'', 'done'=>(object)[],
                'auto'=>['cam'=>false,'mic'=>false,'env'=>false], 'kit'=>[], 'mode'=>'online'];
    }
    public static function error($code, $status) { return new WP_Error($code, 'Interview Ready request could not be completed.', ['status'=>$status]); }
    public static function origin($url) {
        $p = wp_parse_url($url);
        if (!$p || !isset($p['scheme'],$p['host']) || isset($p['user']) || isset($p['pass'])) { return null; }
        $scheme = strtolower($p['scheme']);
        if (!in_array($scheme,['https','http'],true)) { return null; }
        return $scheme.'://'.strtolower($p['host']).':'.($p['port'] ?? ($scheme==='https'?443:80));
    }
    public static function subject($uid) { return hash_hmac('sha256', 'mmed_ir_v1:'.$uid, wp_salt('auth')); }
    public static function permission($request) {
        $uid = get_current_user_id();
        if (!$uid || !is_user_logged_in()) { return self::error('ir_login_required',401); }
        $nonce = $request->get_header('x-wp-nonce');
        if (!is_string($nonce) || !wp_verify_nonce($nonce,'wp_rest')) { return self::error('ir_nonce',403); }
        $origin = $request->get_header('origin');
        $referer = $request->get_header('referer');
        // Browsers may omit Origin on a same-origin GET. Referer plus Fetch Metadata
        // then supplies browser-origin proof. Non-browser ambiguous requests fail.
        $proof = $origin ?: $referer;
        if (!$proof || self::origin($proof)!==self::origin(home_url('/')) ||
            ($origin && preg_match('~[/?#]~', substr($origin, strpos($origin,'://')+3))) ||
            !in_array($request->get_header('sec-fetch-site'),['same-origin'],true)) { return self::error('ir_origin',403); }
        if ($request->get_query_params() || $request->get_url_params()) { return self::error('ir_parameters',400); }
        if (!hash_equals(self::subject($uid), (string)$request->get_header('x-ir-subject'))) { return self::error('ir_identity_changed',401); }
        return true;
    }
    private static function exact($object, $keys) {
        if (!is_object($object) || get_class($object)!=='stdClass') { return false; }
        $actual = array_keys(get_object_vars($object)); sort($actual); sort($keys);
        return $actual === $keys;
    }
    public static function payload_valid($s) {
        if (!self::exact($s,['done','auto','kit','mode']) || !is_object($s->done) ||
            get_class($s->done)!=='stdClass' || !self::exact($s->auto,['cam','mic','env']) ||
            !is_array($s->kit) || !array_is_list($s->kit) || !in_array($s->mode,['online','in-person'],true)) { return false; }
        $counts = ['online'=>[6,3,4,4,3], 'in-person'=>[5,4,4,3,3]];
        foreach (get_object_vars($s->done) as $key=>$value) {
            if (!is_bool($value) || !preg_match('/^(online|in-person):([0-4]):([0-5])$/D',$key,$m) ||
                (int)$m[3] >= $counts[$m[1]][(int)$m[2]]) { return false; }
        }
        foreach ($s->auto as $value) { if (!is_bool($value)) { return false; } }
        if (count($s->kit)>count(self::KIT_KEYS) || count($s->kit)!==count(array_unique($s->kit,SORT_REGULAR))) { return false; }
        foreach ($s->kit as $key) { if (!is_string($key) || !in_array($key,self::KIT_KEYS,true)) { return false; } }
        return true;
    }
    public static function record_valid($value) {
        if (!is_array($value)) { return false; }
        $s = json_decode(wp_json_encode($value));
        if (!self::exact($s,['revision','lastCommandId','lastCommandDigest','done','auto','kit','mode']) ||
            !is_int($s->revision) || $s->revision<1 || $s->revision>=PHP_INT_MAX ||
            !is_string($s->lastCommandId) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D',$s->lastCommandId) ||
            !is_string($s->lastCommandDigest) || !preg_match('/^[0-9a-f]{64}$/D',$s->lastCommandDigest)) { return false; }
        unset($s->revision,$s->lastCommandId,$s->lastCommandDigest);
        return strlen(wp_json_encode($value))<=8192 && self::payload_valid($s);
    }
    public static function read($uid) {
        // Never trust an object-cache value read before another request's lock.
        wp_cache_delete($uid,'user_meta');
        global $wpdb;
        $rows = get_user_meta($uid,self::META,false);
        if (!is_array($rows) || !empty($wpdb->last_error)) { return self::error('ir_read',503); }
        if (!$rows) { return self::empty_state(); }
        if (count($rows)!==1 || !self::record_valid($rows[0])) { return self::error('ir_recovery_required',503); }
        return $rows[0];
    }
    public static function response($state, $uid) {
        $r = new WP_REST_Response(['subject'=>self::subject($uid), 'state'=>$state],200);
        $r->header('Cache-Control','private, no-store, max-age=0');
        $r->header('Vary','Cookie'); return $r;
    }
    public static function command($request) {
        if ($request->get_header('content-type') !== 'application/json' || strlen($request->get_body())>8192) { return self::error('ir_body',413); }
        $c = json_decode($request->get_body());
        if (json_last_error()!==JSON_ERROR_NONE || !self::exact($c,['expectedRevision','commandId','state']) ||
            !is_int($c->expectedRevision) || $c->expectedRevision<0 || $c->expectedRevision>=PHP_INT_MAX-1 ||
            !is_string($c->commandId) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D',$c->commandId) ||
            !self::payload_valid($c->state)) { return self::error('ir_schema',400); }
        return $c;
    }
    public static function digest($c) {
        $done = get_object_vars($c->state->done); ksort($done);
        $kit = $c->state->kit; sort($kit);
        return hash('sha256',wp_json_encode([$c->expectedRevision, (object)$done,
            [$c->state->auto->cam,$c->state->auto->mic,$c->state->auto->env],$kit,$c->state->mode]));
    }
    public static function state($request) {
        $allowed = self::permission($request); if ($allowed!==true) { return $allowed; }
        $uid = get_current_user_id();
        if ($request->get_method()==='GET') {
            if ($request->get_body()!=='') { return self::error('ir_body',400); }
            $s=self::read($uid); return is_wp_error($s)?$s:self::response($s,$uid);
        }
        if ($request->get_method()!=='POST') { return self::error('ir_method',405); }
        $c=self::command($request); if (is_wp_error($c)) { return $c; }
        global $wpdb;
        $owner=$wpdb; $handle=$owner->dbh; $thread=null; $locked=false; $db=null;
        $lock='mmed_ir_v1:'.$uid; // Server-generated integer only; never a client lock name.
        try {
            if (!($handle instanceof mysqli)) { return self::error('ir_connection',503); }
            $r=mysqli_query($handle,"SELECT CONNECTION_ID(), GET_LOCK('".$lock."', 2)");
            $v=$r?mysqli_fetch_row($r):null; if ($r) { mysqli_free_result($r); }
            if (!$v || (string)$v[1]!=='1') { return self::error('ir_lock',503); }
            $thread=$v[0]; $locked=true;
            $db=new MMed_IR_Locked_DB($owner,$handle,$thread,$lock); $wpdb=$db;
            if (!$db->intact()) { return self::error('ir_connection',503); }
            $s=self::read($uid); if (is_wp_error($s)) { return $s; }
            $digest=self::digest($c);
            if ($s['lastCommandId']===$c->commandId) {
                return hash_equals($s['lastCommandDigest'],$digest)?self::response($s,$uid):self::error('ir_command_reused',409);
            }
            if ($s['revision']!==$c->expectedRevision) { return self::error('ir_conflict',409); }
            $next=['revision'=>$s['revision']+1,'lastCommandId'=>$c->commandId,'lastCommandDigest'=>$digest,
                'done'=>$c->state->done,'auto'=>(array)$c->state->auto,'kit'=>$c->state->kit,'mode'=>$c->state->mode];
            if (!$db->intact() || get_current_user_id()!==$uid) { return self::error('ir_connection',503); }
            $ok=$s['revision']===0 ? add_user_meta($uid,self::META,$next,true) : update_user_meta($uid,self::META,$next,$s);
            if (!$ok || !$db->intact()) { return self::error('ir_write',503); }
            $saved=self::read($uid);
            if (is_wp_error($saved) || wp_json_encode($saved)!==wp_json_encode($next)) { return self::error('ir_write',503); }
            return self::response($next,$uid);
        } catch (Throwable $e) { return self::error('ir_connection',503); }
        finally {
            $wpdb=$owner;
            if ($locked) {
                // Direct original handle; never reconnect to release someone else's lock.
                try { $r=mysqli_query($handle,"SELECT RELEASE_LOCK('".$lock."')"); if ($r) { mysqli_free_result($r); } } catch (Throwable $e) {}
            }
        }
    }
    public static function private_headers() {
        if (!defined('DONOTCACHEPAGE')) { define('DONOTCACHEPAGE',true); }
        nocache_headers(); header('Cache-Control: private, no-store, max-age=0'); header('Vary: Cookie');
        header('Referrer-Policy: same-origin'); header('X-Content-Type-Options: nosniff');
    }
    public static function runtime($root=null) {
        $root=$root ?? __DIR__.'/missionmed-interview-ready-runtime';
        if (is_link($root) || is_link($root.'/releases')) { return self::error('ir_runtime',503); }
        $canonical=realpath($root);
        $releases=realpath($root.'/releases'); $current=realpath($root.'/current');
        if (!$canonical || $releases!==$canonical.'/releases' || !$current || dirname($current)!==$releases || !preg_match('/^[a-f0-9]{64}$/D',basename($current))) { return self::error('ir_runtime',503); }
        $path=$current.'/interview-ready.html';
        if (is_link($path) || !is_file($path) || filesize($path)>32*1024*1024) { return self::error('ir_runtime',503); }
        $html=file_get_contents($path);
        if ($html===false || !hash_equals(basename($current),hash('sha256',$html)) || substr_count($html,self::MARKER)!==1) { return self::error('ir_runtime',503); }
        return $html;
    }
    // Fixed new IR artifacts only; their bytes are bound inside the qualified HTML.
    public static function artifact($name,$root=null) {
        $markers=['matrix-entry.js'=>'MATRIX','account-gate.html'=>'GATE'];
        if (!isset($markers[$name])) { return self::error('ir_runtime',503); }
        $html=self::runtime($root); if (is_wp_error($html)) { return $html; }
        $root=$root ?? __DIR__.'/missionmed-interview-ready-runtime';
        $directory=realpath($root.'/current');
        // Recheck the selected HTML to fence a current-pointer change during reads.
        if (is_link($root) || is_link($root.'/releases') || !$directory || dirname($directory)!==realpath($root.'/releases') || is_link($directory.'/'.$name) || !is_file($directory.'/'.$name) ||
            !hash_equals(basename($directory),hash('sha256',$html)) || filesize($directory.'/'.$name)>2*1024*1024) { return self::error('ir_runtime',503); }
        $value=file_get_contents($directory.'/'.$name);
        $prefix='<!-- MMED_IR_'.$markers[$name].'_SHA256:';
        if ($value===false || substr_count($html,$prefix)!==1 ||
            strpos($html,$prefix.hash('sha256',$value).' -->')===false) { return self::error('ir_runtime',503); }
        return $value;
    }
    public static function matrix_footer() {
        if (!is_user_logged_in() || !is_page('member-dashboard') ||
            wp_parse_url($_SERVER['REQUEST_URI'] ?? '',PHP_URL_PATH)!=='/member-dashboard/') { return; }
        $js=self::artifact('matrix-entry.js');
        if (!is_wp_error($js) && stripos($js,'</script')===false) {
            echo '<script data-mmed-ir-matrix-addon="v1">'.$js.'</script>';
        }
    }
    public static function account_gate($html,$url) {
        return str_replace(['{{MMED_IR_ACCOUNT_URL}}','{{MMED_IR_GUIDE_URL}}'],
            [esc_url($url),esc_url(home_url('/interview-ready/'))],$html);
    }
    public static function context($uid) {
        return $uid ? ['subject'=>self::subject($uid),'nonce'=>wp_create_nonce('wp_rest'),
            'endpoint'=>home_url('/wp-json/missionmed-ir/v1/state')] : null;
    }
    public static function inject($html,$uid) {
        return str_replace(self::MARKER,wp_json_encode(self::context($uid),JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT),$html);
    }
    public static function return_target($value) {
        return is_string($value) && ($value===home_url('/interview-ready/app/') || $value==='/interview-ready/app/');
    }
    public static function requested_return() {
        foreach (['redirect_to','redirect'] as $key) {
            if (isset($_REQUEST[$key]) && self::return_target(wp_unslash($_REQUEST[$key]))) { return home_url('/interview-ready/app/'); }
        }
        return null;
    }
    public static function account_destination($url) { return self::requested_return() ?? $url; }
    public static function login_destination($url,$requested,$user) {
        return !is_wp_error($user) && self::return_target($requested) ? home_url('/interview-ready/app/') : $url;
    }
    public static function account_form_return() {
        if (self::requested_return()) { echo '<input type="hidden" name="redirect" value="'.esc_attr(home_url('/interview-ready/app/')).'">'; }
    }
    public static function route() {
        $raw=$_SERVER['REQUEST_URI'] ?? '';
        $path=wp_parse_url($raw,PHP_URL_PATH);
        if (!in_array($path,['/interview-ready/','/interview-ready/app/'],true)) { return; }
        if (!in_array($_SERVER['REQUEST_METHOD'] ?? '',['GET','HEAD'],true) || wp_parse_url($raw,PHP_URL_QUERY)) { status_header(400); exit; }
        $private=$path==='/interview-ready/app/';
        if ($private) { self::private_headers(); }
        else { header('Referrer-Policy: same-origin'); header('X-Content-Type-Options: nosniff'); }
        if ($private && !is_user_logged_in()) {
            status_header(401); header('Content-Type: text/html; charset=UTF-8');
            $url=add_query_arg(['redirect_to'=>home_url('/interview-ready/app/'),'redirect'=>home_url('/interview-ready/app/')],home_url('/my-account/'));
            $gate=self::artifact('account-gate.html');
            if (is_wp_error($gate)) { status_header(503); header('Retry-After: 60'); exit; }
            if (($_SERVER['REQUEST_METHOD'] ?? '')!=='HEAD') {
                echo self::account_gate($gate,$url);
            }
            exit;
        }
        $html=self::runtime();
        if (is_wp_error($html)) { status_header(503); header('Retry-After: 60'); exit; }
        header('Content-Type: text/html; charset=UTF-8'); status_header(200);
        if (($_SERVER['REQUEST_METHOD'] ?? '')!=='HEAD') { echo self::inject($html,$private?get_current_user_id():0); }
        exit;
    }
    public static function menu($items,$args) {
        $menu=wp_get_nav_menu_object($args->menu ?? null);
        if (!$menu && !empty($args->theme_location)) {
            $locations=get_nav_menu_locations();
            $menu=wp_get_nav_menu_object($locations[$args->theme_location] ?? null);
        }
        if (!$menu || !in_array((int)$menu->term_id,[35,57],true) || strpos($items,'data-mmed-ir-nav')!==false) { return $items; }
        $path=(int)$menu->term_id===57?'/interview-ready/app/':'/interview-ready/';
        return $items.'<li class="menu-item"><a data-mmed-ir-nav href="'.esc_url(home_url($path)).'">Interview Ready</a></li>';
    }
    public static function api_headers($response,$server,$request) {
        if ($request->get_route()==='/missionmed-ir/v1/state') {
            if (is_object($response) && method_exists($response,'header')) {
                $response->header('Cache-Control','private, no-store, max-age=0'); $response->header('Vary','Cookie');
                // WordPress's generic REST CORS must not authorize this private endpoint.
                $response->header('Access-Control-Allow-Origin',''); $response->header('Access-Control-Allow-Credentials','false');
            }
        }
        return $response;
    }
    public static function serve_headers($served,$result,$request,$server) {
        if ($request->get_route()==='/missionmed-ir/v1/state') {
            header_remove('Access-Control-Allow-Origin'); header_remove('Access-Control-Allow-Credentials');
            self::private_headers();
        }
        return $served;
    }
}
add_action('rest_api_init',function(){ register_rest_route('missionmed-ir/v1','/state',[
    'methods'=>['GET','POST'],'callback'=>[MMed_IR_Gateway::class,'state'],'permission_callback'=>[MMed_IR_Gateway::class,'permission']
]); });
add_action('template_redirect',[MMed_IR_Gateway::class,'route'],0);
add_filter('wp_nav_menu_items',[MMed_IR_Gateway::class,'menu'],10,2);
add_filter('woocommerce_login_redirect',[MMed_IR_Gateway::class,'account_destination']);
add_filter('woocommerce_registration_redirect',[MMed_IR_Gateway::class,'account_destination']);
add_filter('login_redirect',[MMed_IR_Gateway::class,'login_destination'],10,3);
add_action('woocommerce_login_form_end',[MMed_IR_Gateway::class,'account_form_return']);
add_action('woocommerce_register_form_end',[MMed_IR_Gateway::class,'account_form_return']);
add_filter('rest_post_dispatch',[MMed_IR_Gateway::class,'api_headers'],20,3);
add_filter('rest_pre_serve_request',[MMed_IR_Gateway::class,'serve_headers'],100,4);

add_action('wp_footer',[MMed_IR_Gateway::class,'matrix_footer'],100);
