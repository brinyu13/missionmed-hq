<?php
// Synthetic-only protocol tests. No WordPress config, database, network or user.
define('ABSPATH', __DIR__ . '/synthetic/');
const JOB_SECRET = 'synthetic-job-eligibility-key-never-production-123';
$options = array(); $hooks = array(); $routes = array(); $passed = 0;
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
    public $raw;public $headers;public $method='POST';public $route='/missionmed/v1/interviewiq-owner/rise/job-introspect';public $query=array();
    public function get_body(){return $this->raw;}public function get_headers(){return $this->headers;}
    public function get_method(){return $this->method;}public function get_route(){return $this->route;}
    public function get_query_params(){return $this->query;}
}
function add_action($name,$callback){global $hooks;$hooks[$name]=$callback;}
function add_filter(...$args){}
function register_rest_route($namespace,$route,$options){global $routes;$routes[$route]=array($namespace,$options);}
function is_wp_error($x){return $x instanceof WP_Error;}
function wp_json_encode($x){return json_encode($x);}
function get_option($name,$fallback=array()){global $storedSettings;return $name==='missionmed_interviewiq_settings'?$storedSettings:$fallback;}
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
        if(strpos($key,'_mmiiq_rise_job_')!==0||strlen($key)!==80||$autoload!=='no'||(int)$expiry<time()+89)throw new Exception('NONCE_CONTRACT');
        if(!$state['store'])return false;if(isset($options[$key]))return 0;$options[$key]=$expiry;return 1;
    }
}
$wpdb=new JobNonceStore();
function check($value,$name){global $passed;if(!$value){fwrite(STDERR,'FAIL '.$name."\n");exit(1);}$passed++;}
function make_job($patch=array(),$raw=null){
    static $counter=1;
    $p=array_merge(array('audience'=>'interviewiq-rise-job-proof','nonce'=>sprintf('22222222-2222-4222-8222-%012d',$counter++),
        'iat'=>time(),'subject'=>'11111111-1111-4111-8111-111111111111','wp_user_id'=>123,
        'requestId'=>'33333333-3333-4333-8333-333333333333','demandId'=>'44444444-4444-4444-8444-444444444444',
        'interviewId'=>'55555555-5555-4555-8555-555555555555','programId'=>'acgme:001.im','registryReleaseId'=>'release-2026',
        'phase'=>'reserve','request_sha256'=>str_repeat('a',64)),$patch);
    $r=new JobRequest();$r->raw=$raw??json_encode($p);
    $r->headers=array('content_type'=>array('application/json'),'content_length'=>array((string)strlen($r->raw)),
        'x_mmed_iiq_job_eligibility'=>array(hash_hmac('sha256',"iiq-job-eligibility-v1\nrequest\n".$r->raw,JOB_SECRET)));
    return $r;
}
function denied_before_nonce($request,$label){global $options;$count=count($options);check(is_wp_error(mmiiq_rise_job_introspect($request)),$label);check(count($options)===$count,$label.' no nonce side effect');}
putenv('RISE_IIQ_JOB_ELIGIBILITY_SECRET='.JOB_SECRET);
require __DIR__.'/../../infra/wordpress/missionmed-rise-interviewiq-owner.php';
if($secretCase!==''){
    putenv('RISE_IIQ_JOB_ENABLED=true');
    if($secretCase==='env-before-constant'){
        define('INTERVIEWIQ_JWT_SECRET','unused-canonical-constant-not-active-123');putenv('INTERVIEWIQ_JWT_SECRET='.JOB_SECRET);
    }elseif($secretCase==='constant-trim'){
        define('INTERVIEWIQ_JWT_SECRET','  '.JOB_SECRET.'  ');putenv('INTERVIEWIQ_JWT_SECRET');
    }else{fwrite(STDERR,"Unknown synthetic case\n");exit(1);}
    denied_before_nonce(make_job(),'effective secret '.$secretCase);echo "PASS effective secret\n";exit(0);
}
if($missing!==''){
    putenv('RISE_IIQ_JOB_ENABLED=true');denied_before_nonce(make_job(),'missing '.$missing);echo "PASS missing dependency\n";exit(0);
}
$hooks['rest_api_init']();
check(count($routes)===2,'exact two isolated routes');
check($routes['/interviewiq-owner/rise/job-introspect'][1]['callback']==='mmiiq_rise_job_introspect','job callback');
check($routes['/interviewiq-owner/rise/introspect'][1]['callback']==='mmiiq_rise_introspect','interactive callback retained');
putenv('RISE_IIQ_ENABLED=true');
denied_before_nonce(make_job(),'job default off despite interactive on');
putenv('RISE_IIQ_JOB_ENABLED=true');
foreach(array(array('student','360'),array('student','ivprep_complete'),array('admin','admin')) as [$role,$tier]){
    $state['role']=$role;$state['tier']=$tier;
    foreach(array('reserve','start','publish') as $phase){
        $request=make_job(array('phase'=>$phase));$input=json_decode($request->raw,true);$reply=mmiiq_rise_job_introspect($request);
        check($reply instanceof WP_REST_Response&&$reply->status===200,'eligible role and phase');
        check(array_keys($reply->data)===array('payload','signature'),'exact envelope');
        check(hash_equals($reply->data['signature'],hash_hmac('sha256',"iiq-job-eligibility-v1\nresponse\n".$reply->data['payload'],JOB_SECRET)),'A7 directional response bytes');
        $out=json_decode($reply->data['payload'],true);$binding=array_intersect_key($out,$input);
        check($binding===$input,'every original job binding retained');
        check($out['allowed']===true&&$out['role']===$role&&$out['tier']===$tier&&count($out)===count($input)+4,'exact permitted additions');
        check($out['exp']>$input['iat']&&$out['exp']<=$input['iat']+30&&$out['exp']>time(),'bounded lifetime');
        check($reply->headers['Cache-Control']==='no-store','no positive cache');
        ob_start();$served=mmiiq_rise_serve(false,$reply,$request,null);$wire=ob_get_clean();check(!$served&&$wire==='','interactive serve hook does not capture job envelope');
        check(is_wp_error(mmiiq_rise_job_introspect($request)),'durable replay denied');
    }
}
check($state['provisions']===0&&$state['sessionCalls']===0,'no identity provisioning or browser session use');
foreach(array(true,null,0,'false') as $restricted){
    $state['restricted']=$restricted;$count=$state['accessCalls'];check(is_wp_error(mmiiq_rise_job_introspect(make_job())),'restricted or unknown admin denied');
    check($state['accessCalls']===$count,'restriction before administrator access branch');
}
$state['restricted']=false;$state['role']='student';$state['tier']='360';
foreach(array('missingUser'=>true,'exists'=>false,'userId'=>456,'subject'=>'66666666-6666-4666-8666-666666666666','store'=>false,'throw'=>true) as $k=>$bad){
    $old=$state[$k];$state[$k]=$bad;check(is_wp_error(mmiiq_rise_job_introspect(make_job())),'current identity/store failure '.$k);$state[$k]=$old;
}
foreach(array(array('mentor','assigned_mentor'),array('student','none'),array('student','admin'),array('admin','360')) as [$role,$tier]){
    $state['role']=$role;$state['tier']=$tier;check(is_wp_error(mmiiq_rise_job_introspect(make_job())),'role tier mismatch denied');
}
$state['role']='student';$state['tier']='360';
foreach(array('RISE_IIQ_OWNER_PROOF_SECRET','RISE_IIQ_OWNER_REQUEST_SECRET','RISE_IIQ_JOB_REQUEST_SECRET','RISE_IIQ_JOB_PROOF_SECRET',
    'INTERVIEWIQ_JWT_SECRET','INTERVIEWIQ_OWNER_PROOF_SECRET','INTERVIEWIQ_GATEWAY_SECRET','MMED_JWT_SECRET') as $key){
    putenv($key.'='.JOB_SECRET);denied_before_nonce(make_job(),'reused secret '.$key);putenv($key);
}
foreach(array_keys($storedSettings) as $key){
    $old=$storedSettings[$key];$storedSettings[$key]='  '.JOB_SECRET.'  ';denied_before_nonce(make_job(),'option-backed canonical collision');
    $storedSettings[$key]='';denied_before_nonce(make_job(),'canonical key unavailable');$storedSettings[$key]=$old;
}
foreach(array('', 'short', str_repeat('s',1025)) as $bad){putenv('RISE_IIQ_JOB_ELIGIBILITY_SECRET='.$bad);denied_before_nonce(make_job(),'unqualified secret');}
putenv('RISE_IIQ_JOB_ELIGIBILITY_SECRET='.JOB_SECRET);
foreach(array('false','TRUE','yes','0') as $bad){putenv('RISE_IIQ_JOB_ENABLED='.$bad);denied_before_nonce(make_job(),'nonexplicit flag');}
putenv('RISE_IIQ_JOB_ENABLED=true');
$badFields=array('audience'=>'wrong','nonce'=>'bad','iat'=>time()-31,'subject'=>'bad','wp_user_id'=>'123','requestId'=>'bad','demandId'=>'bad',
    'interviewId'=>'bad','programId'=>'../private','registryReleaseId'=>'bad/release','phase'=>'read','request_sha256'=>'bad','session_verifier'=>str_repeat('b',64));
foreach($badFields as $key=>$value)denied_before_nonce(make_job(array($key=>$value)),'invalid field '.$key);
foreach(array(time()+31,0,'now',1.25,null,array()) as $bad)denied_before_nonce(make_job(array('iat'=>$bad)),'invalid timestamp');
foreach(array(0,-1,9007199254740992,1.5,null,array()) as $bad)denied_before_nonce(make_job(array('wp_user_id'=>$bad)),'invalid WP id');
foreach(array('programId','registryReleaseId') as $key){foreach(array('',str_repeat('x',181),null,array(),123,"x\n") as $bad)denied_before_nonce(make_job(array($key=>$bad)),'invalid canonical id');}
foreach(array('origin','cookie','cookie2','authorization','proxy_authorization','transfer_encoding','content_encoding','expect',
    'x_http_method_override','x_method_override','x_http_method','x_mmed_iiq_owner_proof','x_mmed_consumer') as $header){
    $r=make_job();$r->headers[$header]=array('forbidden');denied_before_nonce($r,'forbidden header '.$header);
}
foreach(array('content_type','content_length','x_mmed_iiq_job_eligibility') as $header){
    $r=make_job();$r->headers[strtoupper(str_replace('_','-',$header))]=$r->headers[$header];denied_before_nonce($r,'normalized duplicate');
    $r=make_job();$r->headers[$header][]=$r->headers[$header][0];denied_before_nonce($r,'multiple header values');
}
foreach(array('content_type'=>'text/plain','content_length'=>'1','x_mmed_iiq_job_eligibility'=>str_repeat('b',64),'accept'=>"application/json\r\nX:test") as $header=>$bad){
    $r=make_job();$r->headers[$header]=array($bad);denied_before_nonce($r,'bad header value');
}
$r=make_job();unset($r->headers['content_type']);denied_before_nonce($r,'missing JSON media');
$r=make_job();$r->method='GET';denied_before_nonce($r,'wrong method');
$r=make_job();$r->route='/other';denied_before_nonce($r,'wrong route');
foreach(array('_method','_jsonp','_envelope','extra') as $key){$r=make_job();$r->query=array($key=>'x');denied_before_nonce($r,'query denied');}
$r=make_job();$duplicate=str_replace('"wp_user_id":123','"wp_user_id":999,"wp_user_\\u0069d":123',$r->raw);
foreach(array($duplicate,'[]','null','{}','{"x":',str_repeat('x',16385),"\xef\xbb\xbf".$r->raw) as $raw)denied_before_nonce(make_job(array(),$raw),'malformed JSON');
$r=make_job();$p=json_decode($r->raw,true);unset($p['phase']);denied_before_nonce(make_job(array(),json_encode($p)),'missing required key');
$wpdb->options='wp_options;DROP';denied_before_nonce(make_job(),'invalid nonce table identifier');$wpdb->options='wp_options';
foreach(array('get_user_by','mmhq_cam_restricted','mmiiq_actor_uuid','mmiiq_access_for_user','mmiiq_setting') as $dependency){
    $pipes=array();$process=proc_open(array(PHP_BINARY,__FILE__,'--missing='.$dependency),array(0=>array('pipe','r'),1=>array('pipe','w'),2=>array('pipe','w')),$pipes);
    check(is_resource($process),'dependency child starts');fclose($pipes[0]);$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    check(proc_close($process)===0&&strpos($out,'PASS missing dependency')!==false&&$err==='','missing dependency fail closed');
}
foreach(array('env-before-constant','constant-trim') as $case){
    $pipes=array();$process=proc_open(array(PHP_BINARY,__FILE__,'--secret-case='.$case),array(0=>array('pipe','r'),1=>array('pipe','w'),2=>array('pipe','w')),$pipes);
    check(is_resource($process),'secret child starts');fclose($pipes[0]);$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    check(proc_close($process)===0&&strpos($out,'PASS effective secret')!==false&&$err==='','effective canonical precedence');
}
check($state['provisions']===0&&$state['sessionCalls']===0,'all paths preserve no-provision no-session rule');
echo "PASS $passed synthetic job PHP checks; no WordPress or production data used\n";
