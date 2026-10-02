<?php
// Synthetic offline fixtures only; never connects to WordPress or creates users.
define('ABSPATH', __DIR__);
define('MMHQ_HANDOFF_SECRET', 'synthetic-offline-test-secret-000000000000');
class WP_User { public $ID=77; public $roles=array('subscriber'); }
class WP_Error { public function __construct(...$args) {} }
class WP_REST_Response {
    public $data;
    public function __construct($data,$status) { $this->data=$data; }
    public function header(...$args) {}
}
if (($argv[1] ?? '') === 'no-method') {
    class MMED_Access_Gate {}
} elseif (($argv[1] ?? '') !== 'no-gate') {
class MMED_Access_Gate {
    public static $allowed=true;
    public static function user_can_access_app($id,$route) {
        if ($id!==77 || $route!=='rise') throw new Exception('wrong identity');
        return self::$allowed;
    }
}
}
function sfwd_lms_has_access(...$args) {return true;}
function add_action(...$args) {}
function get_user_by($key,$id) {return $id===77 ? new WP_User() : false;}
function user_can(...$args) {return false;}
function wp_json_encode($value) {return json_encode($value);}
require __DIR__.'/../../wp-content/mu-plugins/missionmed-rise-sso.php';
class Request {
    public $body; public $signature; public $origin='';
    public function __construct($overrides=array()) {
        $this->body=json_encode(array_merge(array('subject'=>'wp:77','audience'=>'ivoc-rise-owner-projection',
            'nonce'=>'123e4567-e89b-42d3-a456-426614174000','iat'=>time()),$overrides));
        $this->signature=hash_hmac('sha256',"mmrise-ivoc-eligibility-request-v1\n".$this->body,MMHQ_HANDOFF_SECRET);
    }
    public function get_body() {return $this->body;}
    public function get_method() {return 'POST';}
    public function get_header($name) {return $name==='origin' ? $this->origin : $this->signature;}
}
function check($condition) {if(!$condition) throw new Exception('contract failed');}
$request=new Request();
if (in_array($argv[1] ?? '',array('no-gate','no-method'),true)) {
    check(mmrise_ivoc_eligibility_permission($request)===true);
    check(mmrise_ivoc_eligibility($request) instanceof WP_Error);
    echo "PASS unavailable current owner denies despite legacy course grant\n";
    exit;
}
check(mmrise_ivoc_eligibility_permission($request)===true);
$response=mmrise_ivoc_eligibility($request)->data;
check(hash_equals(hash_hmac('sha256',"mmrise-ivoc-eligibility-response-v1\n".$response['payload'],MMHQ_HANDOFF_SECRET),$response['signature']));
$value=json_decode($response['payload'],true);
check($value['allowed']===true && $value['admin']===false && $value['subject']==='wp:77');
MMED_Access_Gate::$allowed=false;
check(json_decode(mmrise_ivoc_eligibility($request)->data['payload'],true)['allowed']===false);
foreach(array(array('subject'=>'wp:0'),array('audience'=>'hq'),array('iat'=>time()-31),array('iat'=>time()+6),array('nonce'=>'bad')) as $override) {
    check(mmrise_ivoc_eligibility_permission(new Request($override)) instanceof WP_Error);
}
$request->signature=str_repeat('0',64);
check(mmrise_ivoc_eligibility_permission($request) instanceof WP_Error);
$request=new Request(); $request->origin='https://example.test';
check(mmrise_ivoc_eligibility_permission($request) instanceof WP_Error);
check(json_decode(mmrise_ivoc_eligibility(new Request(array('subject'=>'wp:78')))->data['payload'],true)['allowed']===false);
echo "PASS current owner decision, denial, deletion, restriction, HMAC, time, audience and origin\n";
