<?php
// Synthetic-only protocol tests. No WordPress config, database, network or user.
define('ABSPATH', __DIR__ . '/synthetic/');
const JOB_SECRET = 'synthetic-job-eligibility-key-never-production-123';
$options = array(); $hooks = array(); $routes = array(); $passed = 0; $riseStoredSettings = array();
$missing = isset($argv[1]) && strpos($argv[1], '--missing=') === 0 ? substr($argv[1], 10) : '';
$secretCase = isset($argv[1]) && strpos($argv[1], '--secret-case=') === 0 ? substr($argv[1], 14) : '';
$storedSettings = array('INTERVIEWIQ_JWT_SECRET'=>'synthetic-canonical-jwt-key-not-production-1',
    'INTERVIEWIQ_OWNER_PROOF_SECRET'=>'synthetic-canonical-owner-key-not-production-2',
    'INTERVIEWIQ_GATEWAY_SECRET'=>'synthetic-canonical-gateway-key-not-production-3');
$state = array('role'=>'student', 'tier'=>'360', 'restricted'=>false, 'exists'=>true, 'userId'=>123, 'missingUser'=>false,
    'subject'=>'11111111-1111-4111-8111-111111111111', 'store'=>true, 'throw'=>false, 'accessCalls'=>0, 'provisions'=>0, 'sessionCalls'=>0);
class WP_Error { public function __construct(...$args) {} }
class WP_User {
    public $ID;
    public function __construct($id) {$this->ID=$id;}
    public function exists() {global $state;return $state['exists'];}
}
class WP_REST_Response {
    public $data;public $status;public $headers;
    public function __construct($data,$status,$headers) {$this->data=$data;$this->status=$status;$this->headers=$headers;}
}
class JobRequest {
    public $raw;public $headers;public $method='POST';public $route='/missionmed/v1/interviewiq-owner/rise/mrx-introspect';public $query=array();
    public function get_body(){return $this->raw;}public function get_headers(){return $this->headers;}
    public function get_method(){return $this->method;}public function get_route(){return $this->route;}
    public function get_query_params(){return $this->query;}
}
function add_action($name,$callback){global $hooks;$hooks[$name]=$callback;}
function add_filter(...$args){}
function register_rest_route($namespace,$route,$options){global $routes;$routes[$route]=array($namespace,$options);}
function is_wp_error($x){return $x instanceof WP_Error;}
function wp_json_encode($x){return json_encode($x);}
function get_option($name,$fallback=array()){global $storedSettings,$riseStoredSettings;return $name==='missionmed_interviewiq_settings'?$storedSettings:($name==='missionmed_rise_interviewiq_settings'?$riseStoredSettings:$fallback);}
if($missing!=='mmiiq_setting') {function mmiiq_setting($name,$default=''){
    $value=getenv($name);
    if($value===false||$value===''){$stored=get_option('missionmed_interviewiq_settings',array());$value=defined($name)?constant($name):(is_array($stored)?($stored[$name]??$default):$default);}
    return is_scalar($value)?trim((string)$value):'';
}}
if($missing!=='get_user_by') {function get_user_by($field,$id){global $state;return $state['missingUser']?false:new WP_User($state['userId']);}}
if($missing!=='mmhq_cam_restricted') {function mmhq_cam_restricted($id){global $state;if($state['throw'])throw new Exception('PRIVATE_FAILURE');return $state['restricted'];}}
if($missing!=='mmiiq_actor_uuid') {function mmiiq_actor_uuid($id,$provision){global $state;if($provision!==false)$state['provisions']++;return $state['subject'];}}
if($missing!=='mmiiq_access_for_user') {function mmiiq_access_for_user($user){global $state;$state['accessCalls']++;return array('role'=>$state['role'],'tier'=>$state['tier']);}}
function mmiiq_session_active(...$args){global $state;$state['sessionCalls']++;throw new Exception('NO_BROWSER_SESSION_ALLOWED');}
class JobNonceStore {
    public $options='wp_options';
    public function prepare($query,...$values){
        if($query!=='INSERT IGNORE INTO wp_options (option_name, option_value, autoload) VALUES (%s, %s, %s)')throw new Exception('INSERT_ONLY');
        return $values;
    }
    public function query($values){global $state,$options;
        [$key,$expiry,$autoload]=$values;
        if(strpos($key,'_mmiiq_rise_mrx_')!==0||strlen($key)!==80||$autoload!=='no'||(int)$expiry<time()+89)throw new Exception('NONCE_CONTRACT');
        if(!$state['store'])return false;if(isset($options[$key]))return 0;$options[$key]=$expiry;return 1;
    }
}
$wpdb=new JobNonceStore();
function check($value,$name){global $passed;if(!$value){fwrite(STDERR,'FAIL '.$name."\n");exit(1);}$passed++;}
function make_job($patch=array(),$raw=null){
    static $counter=1;
    $p=array_merge(array('audience'=>'interviewiq-rise-mrx-proof','nonce'=>sprintf('22222222-2222-4222-8222-%012d',$counter++),
        'iat'=>time(),'subject'=>'11111111-1111-4111-8111-111111111111','wp_user_id'=>123,
        'intentId'=>'33333333-3333-4333-8333-333333333333','publicationId'=>'44444444-4444-4444-8444-444444444444',
        'operation'=>'publish','request_sha256'=>str_repeat('a',64)),$patch);
    $r=new JobRequest();$r->raw=$raw??json_encode($p);
    $r->headers=array('content_type'=>array('application/json'),'content_length'=>array((string)strlen($r->raw)),
        'x_mmed_iiq_mrx_eligibility'=>array(hash_hmac('sha256',"iiq-mrx-v1\neligibility-request\n".$r->raw,JOB_SECRET)));
    return $r;
}
function denied_before_nonce($request,$label){global $options;$count=count($options);check(is_wp_error(mmiiq_rise_mrx_introspect($request)),$label);check(count($options)===$count,$label.' no nonce side effect');}
putenv('RISE_IIQ_JOB_ELIGIBILITY_SECRET='.JOB_SECRET);
require __DIR__.'/../../infra/wordpress/missionmed-rise-interviewiq-owner.php';

$state['role']='admin';$state['tier']='admin';
check(is_wp_error(mmiiq_rise_mrx_introspect(make_job())),'default off');
putenv('RISE_IIQ_MRX_ENABLED=1');
$r=make_job();$ok=mmiiq_rise_mrx_introspect($r);check($ok instanceof WP_REST_Response,'current admin publication proof');
check(hash_equals($ok->data['signature'],hash_hmac('sha256',"iiq-mrx-v1\neligibility-response\n".$ok->data['payload'],JOB_SECRET)),'separate MRX response signature');
check(is_wp_error(mmiiq_rise_mrx_introspect($r)),'nonce replay denied');
$state['role']='student';$state['tier']='360';check(is_wp_error(mmiiq_rise_mrx_introspect(make_job())),'student cannot approve publication');
$state['role']='revoked';$state['tier']='none';$state['restricted']=true;check(mmiiq_rise_mrx_introspect(make_job(array('operation'=>'retract'))) instanceof WP_REST_Response,'removal after admin and entitlement loss');
$state['restricted']=null;check(is_wp_error(mmiiq_rise_mrx_introspect(make_job(array('operation'=>'retract')))),'unknown restriction fails closed');$state['restricted']=false;
$state['role']='admin';$state['tier']='admin';
$r=make_job();$r->route='/missionmed/v1/interviewiq-owner/rise/job-introspect';denied_before_nonce($r,'paid job route cannot be reused');
$r=make_job();$r->headers['origin']=array('https://missionmedinstitute.com');denied_before_nonce($r,'browser origin denied');
$r=make_job();$raw=substr($r->raw,0,-1).',"operation":"publish"}';denied_before_nonce(make_job(array(),$raw),'duplicate decoded key denied');
$state['subject']='99999999-9999-4999-8999-999999999999';check(is_wp_error(mmiiq_rise_mrx_introspect(make_job())),'original administrator mapping required');
check($state['provisions']===0 && $state['sessionCalls']===0,'no student provisioning or session impersonation');
echo 'PASS '.$passed." MRX WordPress synthetic assertions\n";
