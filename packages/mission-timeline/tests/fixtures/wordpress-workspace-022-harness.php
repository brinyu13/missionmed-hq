<?php
define('ABSPATH', __DIR__);

$GLOBALS['mmtl_options'] = array();
$GLOBALS['mmtl_user_meta'] = array();
$GLOBALS['mmtl_course_access'] = array();

class WP_User {
    public $ID;
    public $administrator;
    public $display_name;
    public $user_email;
    public function __construct($id, $administrator = false) { $this->ID = $id; $this->administrator = $administrator; $this->display_name="Synthetic user $id"; $this->user_email="synthetic$id@example.test"; }
    public function exists() { return $this->ID > 0; }
}
class WP_Error {
    private $code;
    private $message;
    private $data;
    public function __construct($code, $message, $data = array()) { $this->code = $code; $this->message = $message; $this->data = $data; }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->message; }
    public function get_error_data() { return $this->data; }
}
class WP_REST_Response {
    private $data;
    private $status;
    public function __construct($data = array(), $status = 200) { $this->data = $data; $this->status = $status; }
    public function get_data() { return $this->data; }
    public function get_status() { return $this->status; }
    public function header() {}
}
class WP_REST_Request {
    public $method;
    public $path;
    public $headers = array();
    public $params = array();
    public function __construct($method, $path) { $this->method = $method; $this->path = $path; }
    public function set_header($key, $value) { $this->headers[strtolower((string) $key)] = (string) $value; }
    public function get_header($key) { return $this->headers[strtolower((string) $key)] ?? ''; }
    public function set_param($key, $value) { $this->params[$key] = $value; }
    public function get_param($key) { return $this->params[$key] ?? null; }
}
class WP_REST_Server { const CREATABLE = 'POST'; }
class MMTL_Test_REST_Server {
    public function get_routes() { return array('/mmed/v2/file-vault/bootstrap' => array()); }
}

function add_action() {}
function add_filter() {}
function register_activation_hook() {}
function register_deactivation_hook() {}
function home_url($path = '/') { return 'https://missionmed.example' . $path; }
function get_option($key, $default = false) { return $GLOBALS['mmtl_options'][$key] ?? $default; }
function get_user_meta($id, $key) { return $GLOBALS['mmtl_user_meta'][$id][$key] ?? ''; }
function update_user_meta($id, $key, $value) { if (!empty($GLOBALS['fail_pointer'])) return false; $GLOBALS['mmtl_user_meta'][$id][$key] = $value; return true; }
function delete_user_meta($id, $key, $value = null) {
    if ($value !== null && (($GLOBALS['mmtl_user_meta'][$id][$key] ?? null) !== $value)) return false;
    unset($GLOBALS['mmtl_user_meta'][$id][$key]);
    return true;
}
function wp_parse_args($args, $defaults) { return array_merge($defaults, $args); }
function absint($value) { return abs((int) $value); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value)); }
function sanitize_text_field($value) { return trim((string) $value); }
function sanitize_file_name($value) { return basename(trim((string) $value)); }
function esc_url_raw($value) { return (string) $value; }
function untrailingslashit($value) { return rtrim((string) $value, '/'); }
function apply_filters($name, $value) { return $value; }
function user_can($user, $capability) { return $capability === 'manage_options' && $user->administrator; }
function sfwd_lms_has_access($course_id, $user_id) { return $course_id === 3893 && !empty($GLOBALS['mmtl_course_access'][$user_id]); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_generate_uuid4() { return '9d8d7a7a-c915-4d36-a657-910ad2221002'; }
function wp_json_encode($value) { return json_encode($value); }
function wp_create_nonce($action) { return $action === 'wp_rest' ? 'test-wp-rest-nonce' : 'wrong-action'; }
function rest_get_server() { return new MMTL_Test_REST_Server(); }
function rest_do_request($request) {
    $GLOBALS['mmtl_last_internal_rest_request'] = $request;
    // Mirror File Vault V2's browser-auth permission contract closely enough
    // that omission of the nonce makes this executable integration fail.
    if ($request->get_header('authorization') !== ''
        || $request->get_header('x-wp-nonce') !== wp_create_nonce('wp_rest')) {
        return new WP_REST_Response(array('code' => 'mmed_file_vault_v2_nonce_invalid'), 403);
    }
    return new WP_REST_Response(array('student' => array('id' => 101), 'documents' => array()), 200);
}


function add_user_meta($id,$key,$value,$unique=false){if(!empty($GLOBALS['fail_history']))return false;$GLOBALS['history'][$id][$key][]=$value;return count($GLOBALS['history'][$id][$key]);}
function wp_get_current_user(){return $GLOBALS['current_user'];}
function get_user_by($kind,$id){return $GLOBALS['users'][(int)$id]??false;}
function is_user_logged_in(){return wp_get_current_user()->exists();}
function wp_verify_nonce($nonce,$action){return $action==='wp_rest'&&$nonce==='test-wp-rest-nonce';}
function wp_parse_url($value,$component=-1){return parse_url($value,$component);}
function register_rest_route($namespace,$route,$settings){$GLOBALS['routes'][$route]=$settings;}
function wp_http_validate_url($url){return strpos($url,'https://timeline-api.synthetic.test')===0;}
function get_the_title($id){return 'Synthetic session '.$id;}
function learndash_get_course_groups($course,$fresh){return array(501,502);}
function learndash_get_users_group_ids($user,$fresh){return array($user===102?502:501);}
function learndash_get_users_for_course($course,$args,$include_groups){$GLOBALS['enrollment_query']=array($course,$args,$include_groups);return new class {function get_results(){return array(101,102,103,104,105,201,101);}};}
function wp_remote_post($url,$args){
 $GLOBALS['last_remote']=array('url'=>$url,'args'=>$args);$input=json_decode($args['body'],true);
 if(str_ends_with($url,'/roster')){$students=array_map(function($id){return array('wpUserId'=>$id,'status'=>$id===104?'NEVER_STARTED':'DRAFT','canOpen'=>$id!==104,'filters'=>array('never_started'=>$id===104,'draft'=>$id!==104,'recently_active'=>$id===101));},$input['wpUserIds']);if(!empty($GLOBALS['partial_roster']))array_pop($students);return array('status'=>200,'body'=>json_encode(array('students'=>$students)));}
 $principal=mmtl_principal_for_user($input['wpUserId']);$result=array('documentId'=>'synthetic-document-'.$input['wpUserId'],'studentPrincipalId'=>!empty($GLOBALS['wrong_api_principal'])?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':$principal,'canEdit'=>true);
 if(!empty($GLOBALS['revoke_during_open']))$GLOBALS['mmtl_course_access'][$input['wpUserId']]=false;
 if(!empty($GLOBALS['identity_changes_during_open']))$GLOBALS['mmtl_user_meta'][$input['wpUserId']][MMTL_PRINCIPAL_META]='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 return array('status'=>200,'body'=>json_encode($result));
}
function wp_remote_request($url,$args){$claims=json_decode(mmtl_base64url_decode(explode('.',substr($args['headers']['Authorization'],7))[1]),true);return array('status'=>200,'body'=>json_encode(array('forwarded'=>true,'subject_principal'=>$claims['timeline_admin_subject_principal_id']??null,'subject_wp'=>$claims['timeline_admin_subject_wp_user_id']??null,'admin_workspace'=>$claims['timeline_admin_workspace']??false,'ai_consent'=>$claims['timeline_ai_consent']??false,'directory_header'=>isset($args['headers']['X-Timeline-Admin-Directory']),'synthetic_header'=>isset($args['headers']['X-Timeline-Synthetic-Fixture']))));}
function wp_remote_retrieve_response_code($response){return $response['status'];}
function wp_remote_retrieve_body($response){return $response['body'];}
function wp_remote_retrieve_header($response,$header){return $header==='content-type'?'application/json':'';}
function nocache_headers(){}
function status_header($value){$GLOBALS['status_code']=$value;}
function get_query_var($key,$default=''){return $GLOBALS['query_path']??$default;}
function wp_unslash($value){return $value;}
function add_query_arg($args,$url){return $url.'?'.http_build_query($args);}
require dirname(__DIR__,4).'/wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php';

function reset_fixture(){
 $GLOBALS['mmtl_options'][MMTL_OPTION]=array('timeline_enabled'=>true,'rollout_stage'=>'eligible_360','canary_wp_user_ids'=>array(201),'eligibility_verified'=>true,'entitlement_version'=>'synthetic-course-3893','consent_version'=>'d1-500-v1','ai_processing_mode'=>'consented_students','ai_consent_version'=>'d1-022-ai-v1','founder_standard_manager_wp_user_ids'=>array(201),'active_key_id'=>'timeline-v1','api_origin'=>'https://timeline-api.synthetic.test');
 $GLOBALS['mmtl_user_meta']=array();$GLOBALS['history']=array();$GLOBALS['users']=array();$GLOBALS['routes']=array();
 foreach(array(101,102,103,104,105,201,202)as$id){$GLOBALS['users'][$id]=new WP_User($id,$id>=201);$GLOBALS['mmtl_user_meta'][$id]=array(MMTL_CONSENT_META=>'d1-500-v1',MMTL_CONSENT_AT_META=>'2026-08-04T12:00:00Z');}
 $GLOBALS['mmtl_user_meta'][101][MMTL_PRINCIPAL_META]='9d8d7a7a-c915-4d36-a657-910ad2221001';
 $GLOBALS['mmtl_course_access']=array(101=>true,102=>true,104=>true);$GLOBALS['current_user']=$GLOBALS['users'][101];
 foreach(array('fail_pointer','fail_history','wrong_api_principal','partial_roster','identity_changes_during_open','revoke_during_open')as$key)$GLOBALS[$key]=false;
 $_GET=array();$_SERVER=array('REMOTE_ADDR'=>'127.0.0.1','HTTP_ORIGIN'=>'https://missionmed.example','REQUEST_METHOD'=>'GET');
 putenv('MISSIONMED_TIMELINE_JWT_SECRET=local-test-only-jwt-key-at-least-32-bytes');putenv('MISSIONMED_TIMELINE_GATEWAY_SECRET=local-test-only-gateway-key-at-least-32-bytes');
 mmtl_register_workspace_routes_022();
}
function request($params=array(),$headers=array()){$request=new WP_REST_Request('POST','synthetic');foreach(array_merge(array('x-wp-nonce'=>'test-wp-rest-nonce','origin'=>'https://missionmed.example'),$headers)as$key=>$value)$request->set_header($key,$value);foreach($params as$key=>$value)$request->set_param($key,$value);return $request;}
function dispatch($route,$request){$registered=$GLOBALS['routes'][$route];$permission=call_user_func($registered['permission_callback'],$request);return is_wp_error($permission)?$permission:call_user_func($registered['callback'],$request);}
function code($value){return is_wp_error($value)?$value->get_error_code():null;}
function data($response){return $response instanceof WP_REST_Response?$response->get_data():array();}
function check($name,$ok){$GLOBALS['checks'][$name]=$ok===true;}
reset_fixture();$scenario=$argv[1]??'suite';
if($scenario!=='suite'){
 $admin=str_starts_with($scenario,'admin_');$GLOBALS['current_user']=$GLOBALS['users'][$admin?201:101];
 $GLOBALS['query_path']='v1/documents/synthetic-document-101';$_SERVER['HTTP_X_TIMELINE_SUBJECT_WP_USER_ID']='101';
 if($scenario==='admin_first_use'){$_SERVER['HTTP_X_TIMELINE_SUBJECT_WP_USER_ID']='102';$GLOBALS['query_path']='v1/documents/synthetic-document-102';}
 if($scenario==='admin_missing_subject')unset($_SERVER['HTTP_X_TIMELINE_SUBJECT_WP_USER_ID']);
 if($scenario==='admin_directory_forgery'||$scenario==='student_directory_forgery'){$GLOBALS['query_path']='v1/admin/roster';$_SERVER['HTTP_X_TIMELINE_ADMIN_DIRECTORY']='learndash-3893';}
 if($scenario==='admin_other_subject')$GLOBALS['query_path']='v1/documents/synthetic-document-102';
 if($scenario==='student_synthetic_forgery'){$_SERVER['HTTP_X_TIMELINE_SYNTHETIC_FIXTURE']='1';$GLOBALS['query_path']='v1/documents/synthetic-document-101/quality/analyze';}
 if($scenario==='student_stale_consent')$GLOBALS['mmtl_user_meta'][101][MMTL_AI_CONSENT_META]=array('decision'=>'grant','version'=>'d1-022-ai-v1','recorded_at'=>gmdate('c'));
 $access=mmtl_access_state($GLOBALS['current_user']);$issued=mmtl_issue_jwt($GLOBALS['current_user'],$access);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$issued['token'];
 if($scenario==='student_stale_consent')$GLOBALS['mmtl_user_meta'][101][MMTL_AI_CONSENT_META]=array('decision'=>'withdraw','version'=>'d1-022-ai-v1','recorded_at'=>gmdate('c'));
 if($scenario==='admin_revoked_subject')$GLOBALS['mmtl_course_access'][101]=false;
 if($scenario==='student_revoked')$GLOBALS['mmtl_course_access'][101]=false;
 if($scenario==='admin_revoked_capability')$GLOBALS['mmtl_options'][MMTL_OPTION]['canary_wp_user_ids']=array();
 mmtl_proxy_api_request();exit;
}
$GLOBALS['checks']=array();
$grant=array('decision'=>'grant','version'=>'d1-022-ai-v1','confirmed'=>true);
check('routes_keep_nonce_and_capability_permissions',($GLOBALS['routes']['/ai-consent']['permission_callback']??'')==='mmtl_token_permission'&&($GLOBALS['routes']['/admin/roster']['permission_callback']??'')==='mmtl_admin_permission');
check('grant_missing_nonce_denied',code(dispatch('/ai-consent',request($grant,array('x-wp-nonce'=>''))))==='csrf_failed');
check('grant_wrong_origin_denied',code(dispatch('/ai-consent',request($grant,array('origin'=>'https://attacker.example'))))==='origin_not_allowed');
check('grant_unchecked_denied',code(dispatch('/ai-consent',request(array_merge($grant,array('confirmed'=>false)))))==='ai_consent_confirmation_required');
check('grant_string_boolean_denied',code(dispatch('/ai-consent',request(array_merge($grant,array('confirmed'=>'true')))))==='ai_consent_confirmation_required');
check('grant_old_version_denied',code(dispatch('/ai-consent',request(array_merge($grant,array('version'=>'old')))))==='ai_consent_confirmation_required');
check('denied_consent_writes_nothing',empty($GLOBALS['history']));
$result=dispatch('/ai-consent',request(array_merge($grant,array('user_id'=>102))));check('grant_records_current_student_only',!is_wp_error($result)&&data($result)['consent']['granted']===true&&empty($GLOBALS['history'][102]));
$record=$GLOBALS['mmtl_user_meta'][101][MMTL_AI_CONSENT_META];check('consent_has_provider_storage_version_receipt',$record['provider']==='openai'&&$record['responses_store']===false&&$record['version']==='d1-022-ai-v1');
$access=mmtl_access_state($GLOBALS['current_user']);$issued=mmtl_issue_jwt($GLOBALS['current_user'],$access);check('issued_ai_claim_round_trip',!is_wp_error(mmtl_verify_jwt($issued['token'],$issued['principal_id'],101,$access)));
$result=dispatch('/ai-consent',request(array('decision'=>'withdraw')));check('withdraw_works_without_reconfirm_or_old_version',!is_wp_error($result)&&data($result)['consent']['granted']===false);
check('withdraw_preserves_remote_save_consent',mmtl_remote_sync_consent(101,mmtl_settings())['granted']===true);
check('grant_and_withdraw_history_retained',count($GLOBALS['history'][101][MMTL_AI_CONSENT_HISTORY_META]??array())===2);
check('old_token_denied_after_consent_withdrawal',is_wp_error(mmtl_verify_jwt($issued['token'],$issued['principal_id'],101,mmtl_access_state($GLOBALS['current_user']))));
$GLOBALS['fail_history']=true;check('history_failure_cannot_enable_consent',code(dispatch('/ai-consent',request($grant)))==='ai_consent_record_failed'&&!mmtl_ai_consent(101,mmtl_settings())['granted']);$GLOBALS['fail_history']=false;
$GLOBALS['fail_pointer']=true;check('pointer_failure_is_not_success',code(dispatch('/ai-consent',request($grant)))==='ai_consent_record_failed');$GLOBALS['fail_pointer']=false;
$GLOBALS['current_user']=$GLOBALS['users'][105];check('non360_consent_denied',code(dispatch('/ai-consent',request($grant)))==='eligibility_required');
$GLOBALS['current_user']=new WP_User(0);check('anonymous_consent_denied',code(dispatch('/ai-consent',request($grant)))==='session_required');
$GLOBALS['current_user']=$GLOBALS['users'][201];check('admin_cannot_consent_for_student',code(dispatch('/ai-consent',request(array_merge($grant,array('user_id'=>101)))))==='ai_consent_student_required');
$GLOBALS['current_user']=$GLOBALS['users'][101];check('student_role_flag_cannot_open_admin',code(dispatch('/admin/roster',request(array('admin_workspace'=>true,'role'=>'PROGRAM_ADMIN'))))==='admin_workspace_required');
$GLOBALS['current_user']=$GLOBALS['users'][202];check('unallowlisted_wp_admin_denied',code(dispatch('/admin/roster',request()))==='administrator_approval_required');
$GLOBALS['current_user']=$GLOBALS['users'][201];check('admin_roster_nonce_required',code(dispatch('/admin/roster',request(array(),array('x-wp-nonce'=>''))))==='csrf_failed');
$meta_before=$GLOBALS['mmtl_user_meta'];$students=mmtl_admin_eligible_students();check('roster_uses_authoritative_direct_and_group_enrollment',$GLOBALS['enrollment_query']===array(3893,array('fields'=>'ID','number'=>-1),true));check('roster_excludes_revoked_non360_admin_and_deduplicates',array_column($students,'wpUserId')===array(101,102,104));check('roster_read_does_not_provision_or_write_student_metadata',$meta_before===$GLOBALS['mmtl_user_meta']);
$roster=dispatch('/admin/roster',request());$payload=data($roster);check('roster_metrics_cover_full_eligible_population',!is_wp_error($roster)&&$payload['metrics']['eligible']===3&&$payload['metrics']['never_started']===1&&$payload['source']==='learndash-course-3893');
$roster=dispatch('/admin/roster',request(array('query'=>'synthetic102@example.test','session'=>'Synthetic session 502')));check('authorized_email_and_session_filter',data($roster)['total']===1&&data($roster)['students'][0]['wpUserId']===102);
$GLOBALS['partial_roster']=true;check('partial_api_status_fails_instead_of_fake_never_started',code(dispatch('/admin/roster',request()))==='roster_status_incomplete');$GLOBALS['partial_roster']=false;
$subject=mmtl_admin_subject(102);check('first_use_student_resolves_stable_readonly_principal',!is_wp_error($subject)&&$subject['principal_id']===mmtl_principal_for_user(102)&&get_user_meta(102,MMTL_PRINCIPAL_META,true)==='');
$result=mmtl_admin_open_endpoint(request(array('id'=>102)));check('open_first_use_timeline_has_obvious_exact_identity',!is_wp_error($result)&&data($result)['subject']['principalId']===mmtl_principal_for_user(102));
$GLOBALS['wrong_api_principal']=true;check('wrong_api_student_principal_is_denied',is_wp_error(mmtl_admin_open_endpoint(request(array('id'=>102)))));$GLOBALS['wrong_api_principal']=false;
$GLOBALS['identity_changes_during_open']=true;check('changed_student_identity_during_open_is_denied',is_wp_error(mmtl_admin_open_endpoint(request(array('id'=>102)))));$GLOBALS['identity_changes_during_open']=false;unset($GLOBALS['mmtl_user_meta'][102][MMTL_PRINCIPAL_META]);
$GLOBALS['revoke_during_open']=true;check('student_revoked_during_open_is_denied',code(mmtl_admin_open_endpoint(request(array('id'=>102))))==='admin_subject_unavailable');
$pass=!in_array(false,$GLOBALS['checks'],true);echo json_encode(array('pass'=>$pass,'checks'=>$GLOBALS['checks'],'synthetic_only'=>true,'production_touched'=>false))."\n";exit($pass?0:1);
