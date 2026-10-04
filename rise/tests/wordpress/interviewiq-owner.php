<?php
// Entirely synthetic WordPress harness; never loads wp-config or a database.
define('ABSPATH', __DIR__ . '/synthetic/');
$options = array(); $hooks = array(); $passed = 0;
$state = array('role' => 'student', 'tier' => '360', 'restricted' => false, 'session' => true,
    'subject' => '11111111-1111-4111-8111-111111111111', 'throw' => false, 'store' => true);
class WP_Error { public function __construct(...$args) {} }
class WP_REST_Response {
    public $data; public $status; public $headers;
    public function __construct($data, $status, $headers) { $this->data=$data; $this->status=$status; $this->headers=$headers; }
}
class SyntheticRequest {
    public $raw; public $headers; public $method = 'POST'; public $route = '/missionmed/v1/interviewiq-owner/rise/introspect'; public $query = array();
    public function get_body() { return $this->raw; } public function get_headers() { return $this->headers; }
    public function get_method() { return $this->method; } public function get_route() { return $this->route; }
    public function get_query_params() { return $this->query; }
}
function add_action($name, $callback) { global $hooks; $hooks[$name]=$callback; }
function add_filter(...$args) {}
function register_rest_route($namespace, $route, $options) {
    check($namespace === 'missionmed/v1' && in_array($route, array('/interviewiq-owner/rise/introspect', '/interviewiq-owner/rise/job-introspect'), true) && $options['methods'] === 'POST', 'isolated route');
}
function is_wp_error($x) { return $x instanceof WP_Error; }
function wp_json_encode($x) { return json_encode($x); }
function get_user_by($field, $id) { return $id; }
function mmhq_cam_restricted($id) { global $state; if ($state['throw']) { throw new Exception('PRIVATE_FAILURE'); } return $state['restricted']; }
function mmiiq_session_active($id, $verifier) { global $state; return $state['session'] && $id === 123 && $verifier === str_repeat('a',64); }
function mmiiq_actor_uuid($id, $provision) { global $state; if ($provision !== false) { throw new Exception('PROVISIONING_FORBIDDEN'); } return $state['subject']; }
function mmiiq_access_for_user($user) { global $state; return array('role'=>$state['role'], 'tier'=>$state['tier']); }
class SyntheticInsertOnlyDatabase {
    public $options = 'wp_options';
    public function prepare($query, ...$values) {
        if ($query !== 'INSERT IGNORE INTO wp_options (option_name, option_value, autoload) VALUES (%s, %s, %s)') { throw new Exception('INSERT_ONLY_REQUIRED'); }
        return $values;
    }
    public function query($values) {
        global $options,$state;
        [$key,$value,$autoload]=$values;
        if ($autoload !== 'no' || strpos($key, '_mmiiq_rise_proof_') !== 0 || strlen($key) !== 82 || (int)$value < time()+89) { throw new Exception('NONCE_CONTRACT'); }
        if (!$state['store']) { return false; }
        if (isset($options[$key])) { return 0; }
        $options[$key]=$value; return 1;
    }
}
$wpdb = new SyntheticInsertOnlyDatabase();
function check($condition, $label) { global $passed; if (!$condition) { fwrite(STDERR, 'FAIL '.$label."\n"); exit(1); } $passed++; }
function make_request($patch=array(), $raw=null) {
    static $n=1;
    $body=array_merge(array('audience'=>'interviewiq-rise-owner-proof', 'nonce'=>sprintf('22222222-2222-4222-8222-%012d',$n++),
        'subject'=>'11111111-1111-4111-8111-111111111111','wp_user_id'=>123,'session_verifier'=>str_repeat('a',64),
        'action'=>'GET /api/rise/v1/interviewiq/programs?q=&page=1&pageSize=20', 'request_sha256'=>str_repeat('b',64)),$patch);
    $r=new SyntheticRequest(); $r->raw=$raw ?? json_encode($body);
    $r->headers=array('content_type'=>array('application/json'),'x_mmed_iiq_owner_proof'=>array(hash_hmac('sha256',"iiq-owner-proof-v1\nrequest\n".$r->raw,getenv('RISE_IIQ_OWNER_PROOF_SECRET'))));
    return $r;
}
putenv('RISE_IIQ_OWNER_PROOF_SECRET=synthetic-proof-key-not-for-production-456');
require __DIR__.'/../../infra/wordpress/missionmed-rise-interviewiq-owner.php';
$hooks['rest_api_init']();
check(is_wp_error(mmiiq_rise_introspect(make_request())), 'default off');
putenv('RISE_IIQ_ENABLED=true');
foreach (array(array('student','360'),array('student','ivprep_complete'),array('admin','admin')) as $role) {
    $state['role']=$role[0]; $state['tier']=$role[1]; $r=make_request(); $result=mmiiq_rise_introspect($r);
    check($result instanceof MMIIQ_Rise_Proof_Response, 'current eligible '.$role[1]);
    check($result->data['role']===$role[0] && $result->data['tier']===$role[1] && $result->data['allowed']===true, 'exact own role');
    check($result->data['exp']-$result->data['iat']===30, 'short proof lifetime');
    check(hash_equals($result->headers['X-MMED-IIQ-Owner-Proof'], hash_hmac('sha256',"iiq-owner-proof-v1\nresponse\n".$result->wire(),getenv('RISE_IIQ_OWNER_PROOF_SECRET'))), 'exact signed bytes');
    ob_start();$served=mmiiq_rise_serve(false,$result,$r,null);$wire=ob_get_clean();check($served && $wire===$result->wire(), 'REST exact byte serving');
    ob_start();$served=mmiiq_rise_serve(true,$result,$r,null);$wire=ob_get_clean();check($served && $wire==='', 'already served remains untouched');
    check(is_wp_error(mmiiq_rise_introspect($r)), 'durable nonce replay denial');
    $r->route='/other';ob_start();$served=mmiiq_rise_serve(false,$result,$r,null);$wire=ob_get_clean();check(!$served && $wire==='', 'no sibling response effect');
}
$state['role']='admin';$state['tier']='admin';$state['restricted']=true;
check(is_wp_error(mmiiq_rise_introspect(make_request())), 'restricted administrator denied before role');$state['restricted']=false;
foreach (array(array('mentor','assigned_mentor'),array('student','admin'),array('admin','360'),array('student','none')) as $role) {
    $state['role']=$role[0];$state['tier']=$role[1];check(is_wp_error(mmiiq_rise_introspect(make_request())), 'denied role '.$role[0].'/'.$role[1]);
}
$state['role']='student';$state['tier']='360';
foreach (array('session','store') as $key) {$state[$key]=false;check(is_wp_error(mmiiq_rise_introspect(make_request())), 'denied '.$key);$state[$key]=true;}
$state['throw']=true;check(is_wp_error(mmiiq_rise_introspect(make_request())), 'dependency outage');$state['throw']=false;
foreach (array('subject'=>'22222222-2222-4222-8222-222222222222','wp_user_id'=>456,'session_verifier'=>str_repeat('c',64),
    'audience'=>'wrong','request_sha256'=>'bad','nonce'=>'bad','action'=>'GET https://evil.invalid/','extra'=>true) as $key=>$value) {
    check(is_wp_error(mmiiq_rise_introspect(make_request(array($key=>$value)))), 'binding '.$key);
}
foreach (array('origin','cookie','authorization','x_mmed_consumer') as $header) {
    $r=make_request();$r->headers[$header]=array('browser');$before=count($options);
    check(is_wp_error(mmiiq_rise_introspect($r)) && count($options)===$before,'browser header before nonce '.$header);
}
$r=make_request();$r->method='GET';check(is_wp_error(mmiiq_rise_introspect($r)), 'wrong method');
$r=make_request();$r->headers['X-MMED-IIQ-Owner-Proof']=$r->headers['x_mmed_iiq_owner_proof'];check(is_wp_error(mmiiq_rise_introspect($r)), 'case duplicate header');
$r=make_request();$r->headers['x_mmed_iiq_owner_proof'][]=$r->headers['x_mmed_iiq_owner_proof'][0];check(is_wp_error(mmiiq_rise_introspect($r)), 'duplicate values');
$r=make_request();$r->headers['x_mmed_iiq_owner_proof']=array(str_repeat('c',64));$before=count($options);
check(is_wp_error(mmiiq_rise_introspect($r)) && count($options)===$before, 'bad HMAC before persistence');
$r=make_request();$raw=str_replace('"wp_user_id":123','"wp_user_id":999,"wp_user_\\u0069d":123',$r->raw);
check(is_wp_error(mmiiq_rise_introspect(make_request(array(),$raw))), 'escaped duplicate JSON key');
check(mmiiq_rise_flat_json('{"key":"a:b"}',array('key'))===array('key'=>'a:b'), 'string colon is not duplicate');
foreach(array('/..','/acgme:123','/abc%2fdef','?q=x&page=01&pageSize=20','?q=%00&page=1&pageSize=20','?q=&page=1&pageSize=20&x=1') as $suffix) {
    check(!mmiiq_rise_action('GET /api/rise/v1/interviewiq/programs'.$suffix), 'invalid canonical action');
}
check(mmiiq_rise_action('GET /api/rise/v1/interviewiq/programs/acgme%3A001.im'), 'detail action');
check(mmiiq_rise_action('GET /api/rise/v1/interviewiq/programs?q=Montr%C3%A9al+%26+IM&page=1&pageSize=20'), 'Unicode action');
check(mmiiq_rise_action('GET /api/rise/v1/interviewiq/programs?q=*&page=1&pageSize=20'), 'URLSearchParams star encoding');
check(mmiiq_rise_action('GET /api/rise/v1/interviewiq/programs?q='.urlencode(str_repeat('界',256)).'&page=1&pageSize=20'), 'maximum Unicode action');
$key='_mmiiq_rise_proof_'.str_repeat('d',64);$first=(string)(time()+90);$later=(string)(time()+100);
check($wpdb->query(array($key,$first,'no'))===1 && $wpdb->query(array($key,$later,'no'))===0 && $options[$key]===$first, 'duplicate with changed expiry never overwrites');
foreach (array('_method','_jsonp','_envelope','extra') as $key) {
    $r=make_request();$r->query=array($key=>'x');$before=count($options);
    check(is_wp_error(mmiiq_rise_introspect($r)) && count($options)===$before,'query before nonce '.$key);
}
foreach (array('x-http-method-override','x-method-override') as $header) {
    $r=make_request();$r->headers[$header]=array('POST');$before=count($options);
    check(is_wp_error(mmiiq_rise_introspect($r)) && count($options)===$before,'override before nonce '.$header);
}
$r=make_request();$r->route='/other';check(is_wp_error(mmiiq_rise_introspect($r)), 'exact callback route');
$r=make_request();unset($r->headers['content_type']);check(is_wp_error(mmiiq_rise_introspect($r)), 'missing media');
$r=make_request();$r->headers['content_type']=array('text/plain');check(is_wp_error(mmiiq_rise_introspect($r)), 'wrong media');
check(is_wp_error(mmiiq_rise_introspect(make_request(array(),str_repeat('x',16385)))), 'oversized JSON');
echo "PASS $passed synthetic PHP checks; no WordPress or production data used\n";
