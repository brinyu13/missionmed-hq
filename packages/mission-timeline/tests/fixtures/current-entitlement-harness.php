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
function sfwd_lms_has_access($course_id, $user_id) { $GLOBALS['access_queries'][]=array($course_id,$user_id); return !empty($GLOBALS['mmtl_course_access'][$course_id][$user_id]); }
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
function learndash_get_users_for_course($course,$args,$include_groups){$GLOBALS['enrollment_queries'][]=array($course,$args,$include_groups);return new class {function get_results(){return $GLOBALS['enrolled_ids'];}};}
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

// Synthetic identities and course only; no production roster or configuration.
$GLOBALS['mmtl_options'][MMTL_OPTION]=array('timeline_enabled'=>true,'rollout_stage'=>'eligible_360','canary_wp_user_ids'=>array(201),'eligibility_verified'=>true,'entitlement_version'=>'synthetic-current','consent_version'=>'d1-500-v1','active_key_id'=>'timeline-v1','founder_authorized_wp_user_ids'=>array(101,103,201,9999,101),'iv_prep_complete_course_id'=>7777,'api_origin'=>'https://timeline-api.synthetic.test');
$GLOBALS['users']=array();$GLOBALS['enrolled_ids']=array(102,103,105,201,102);$GLOBALS['enrollment_queries']=array();$GLOBALS['access_queries']=array();
foreach(array(101,102,103,104,105,108,201,202)as$id){$GLOBALS['users'][$id]=new WP_User($id,$id>=201);$GLOBALS['mmtl_user_meta'][$id]=array(MMTL_CONSENT_META=>'d1-500-v1',MMTL_CONSENT_AT_META=>gmdate('c'));}
$GLOBALS['mmtl_course_access']=array(3893=>array(108=>true),7777=>array(102=>true,103=>true,104=>true,201=>true));
$GLOBALS['current_user']=$GLOBALS['users'][101];$_SERVER=array('HTTP_ORIGIN'=>'https://missionmed.example');
putenv('MISSIONMED_TIMELINE_JWT_SECRET=synthetic-entitlement-harness-secret-at-least-32-bytes');
putenv('MISSIONMED_TIMELINE_GATEWAY_SECRET=synthetic-entitlement-gateway-secret-at-least-32-bytes');
function check($name,$ok){$GLOBALS['checks'][$name]=$ok===true;}
function code($value){return is_wp_error($value)?$value->get_error_code():null;}
function request($headers=array()){$request=new WP_REST_Request('GET','synthetic');foreach(array_merge(array('x-wp-nonce'=>'test-wp-rest-nonce','origin'=>'https://missionmed.example'),$headers)as$key=>$value)$request->set_header($key,$value);return $request;}
$GLOBALS['checks']=array();
check('default_off_and_no_new_entitlements',mmtl_defaults()['founder_authorized_wp_user_ids']===array()&&mmtl_defaults()['iv_prep_complete_course_id']===0);
check('unknown_identity_denied',!mmtl_has_course_access(9999)&&!mmtl_has_course_access(0));
check('old_broad_course_access_denied',!mmtl_has_course_access(108)&&code(mmtl_eligibility_state($GLOBALS['users'][108]))==='eligibility_required');
check('direct_iv_permission_without_membership_denied',!mmtl_has_course_access(104));
check('founder_authorized_allowed',mmtl_current_timeline_entitlement(101)['reason']==='founder_authorized'&&mmtl_has_course_access(101));
check('iv_membership_and_access_allowed',mmtl_current_timeline_entitlement(102)['reason']==='iv_prep_enrolled'&&mmtl_has_course_access(102));
check('both_sources_deduplicated',mmtl_current_timeline_entitlement(103)['reason']==='both');
check('expired_iv_denied',!mmtl_has_course_access(105));
$roster=mmtl_admin_eligible_students();check('roster_is_exact_current_student_union',array_column($roster,'wpUserId')===array(101,102,103));
check('roster_reason_matches_shared_decision',count(array_filter($roster,function($row){return $row['entitlementReason']!==mmtl_current_timeline_entitlement($row['wpUserId'])['reason'];}))===0);
check('admin_not_a_student_even_in_both_sources',!mmtl_has_course_access(201)&&code(mmtl_admin_subject(201))==='admin_subject_unavailable');
check('admin_subject_uses_current_entitlement',!is_wp_error(mmtl_admin_subject(101))&&!is_wp_error(mmtl_admin_subject(102))&&code(mmtl_admin_subject(108))==='admin_subject_unavailable');
$GLOBALS['current_user']=$GLOBALS['users'][201];$roster_response=mmtl_admin_roster_endpoint(request());$endpoint_roster=$roster_response instanceof WP_REST_Response?$roster_response->get_data():array();
check('roster_endpoint_uses_current_source',($endpoint_roster['source']??'')==='timeline-current-entitlement'&&array_column($endpoint_roster['students']??array(),'wpUserId')===array(101,102,103));
check('directory_gateway_header_compatible',($GLOBALS['last_remote']['args']['headers']['X-Timeline-Admin-Directory']??'')==='learndash-3893');
foreach(array(101,102,103)as$id){$access=mmtl_access_state($GLOBALS['users'][$id]);$issued=mmtl_issue_jwt($GLOBALS['users'][$id],$access);$claims=mmtl_verify_jwt($issued['token'],$issued['principal_id'],$id,$access);check('token_round_trip_'.$id,is_array($claims)&&$claims['has_learndash_3893_access']===true&&$claims['timeline_entitlement_reason']===mmtl_current_timeline_entitlement($id)['reason']);if($id===102){$iv_token=$issued;$iv_access=$access;}if($id===101)$founder_token=$claims;}
$GLOBALS['current_user']=$GLOBALS['users'][108];check('old_course_direct_token_permission_denied',code(mmtl_token_permission(request()))==='eligibility_required');
$GLOBALS['current_user']=new WP_User(0);check('unauthenticated_permission_denied',code(mmtl_token_permission(request()))==='session_required');
$GLOBALS['current_user']=$GLOBALS['users'][102];check('nonce_and_origin_still_required',code(mmtl_token_permission(request(array('x-wp-nonce'=>''))))==='csrf_failed'&&code(mmtl_token_permission(request(array('origin'=>'https://attacker.example'))))==='origin_not_allowed');
$GLOBALS['current_user']=$GLOBALS['users'][201];check('approved_admin_policy_unchanged',!is_wp_error(mmtl_eligibility_state($GLOBALS['current_user']))&&mmtl_admin_permission(request())===true);
$GLOBALS['current_user']=$GLOBALS['users'][202];check('unapproved_admin_still_denied',code(mmtl_eligibility_state($GLOBALS['current_user']))==='administrator_approval_required');
$GLOBALS['mmtl_course_access'][7777][102]=false;
check('revoked_iv_denied_fresh_and_cached_token',code(mmtl_access_state($GLOBALS['users'][102]))==='eligibility_required'&&is_wp_error(mmtl_verify_jwt($iv_token['token'],$iv_token['principal_id'],102,$iv_access))&&code(mmtl_admin_subject(102))==='admin_subject_unavailable');
$GLOBALS['mmtl_course_access'][7777][102]=true;$GLOBALS['enrolled_ids']=array_values(array_diff($GLOBALS['enrolled_ids'],array(102)));
check('membership_removal_denies_even_with_direct_access',!mmtl_has_course_access(102)&&is_wp_error(mmtl_verify_jwt($iv_token['token'],$iv_token['principal_id'],102,$iv_access)));
check('only_configured_iv_course_queried',count(array_filter($GLOBALS['enrollment_queries'],function($query){return $query!==array(7777,array('fields'=>'ID','number'=>-1),true);}))===0);
check('legacy_course_not_used_as_permission',count(array_filter($GLOBALS['access_queries'],function($query){return $query[0]!==7777;}))===0);
echo json_encode(array('checks'=>$GLOBALS['checks'],'roster'=>$roster,'endpointRoster'=>$endpoint_roster,'founderClaims'=>$founder_token),JSON_PRETTY_PRINT);echo "\n";
exit(in_array(false,$GLOBALS['checks'],true)?1:0);
