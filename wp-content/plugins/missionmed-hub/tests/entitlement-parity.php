<?php
/** Deterministic current-enrollment parity; no production account/enrollment writes. */
define('ABSPATH', '/');
$hooks = array(); $state = array(); $cache = array(); $assertions = 0;
function add_action($n,$cb,$p=10,$args=1){add_filter($n,$cb,$p,$args);}
function add_filter($n,$cb,$p=10,$args=1){global $hooks;$hooks[$n][]=$cb;}
function apply_filters($n,$value,...$args){global $hooks;foreach($hooks[$n]??array() as $cb){$value=$cb($value,...$args);}return $value;}
function absint($v){return abs((int)$v);}
function sanitize_key($v){return preg_replace('/[^a-z0-9_\-]/','',strtolower($v));}
function user_can($id,$cap){global $state;return $cap==='manage_options' && !empty($state[(int)$id]['admin']);}
function get_option($key,$default=''){return array('mmed_course_360elite'=>3893,'mmed_course_complete'=>5227)[$key]??$default;}
function get_transient($key){global $cache;return $cache[$key]??false;}
function set_transient($key,$value,$ttl){global $cache;$cache[$key]=$value;}
function delete_transient($key){global $cache;unset($cache[$key]);}
function learndash_user_get_enrolled_courses($id){global $state;return $state[$id]['courses']??array();}
function sfwd_lms_has_access($course,$id){global $state;return in_array($course,$state[$id]['active']??array(),true);}
function get_user_meta($id,$key,$single){return '';}
function get_the_title($id){return 'Synthetic course';}
function admin_url($p){return 'https://matrix.test/wp-admin/'.$p;}
function add_query_arg($a,$b,$c=null){return $c??$b;}
function esc_url_raw($v){return $v;}
function get_current_user_id(){return 1;}
function is_user_logged_in(){global $current_authenticated;return $current_authenticated??true;}
function is_wp_error($v){return $v instanceof WP_Error;}
class WP_Error{public $code;function __construct($code,...$args){$this->code=$code;}}
class WP_REST_Request{private $route;function __construct($route){$this->route=$route;}function get_route(){return $this->route;}function get_method(){return 'GET';}}
function mm_drj_drills_access_user_is_restricted($id){global $state;return !empty($state[$id]['drj']) && !apply_filters('missionmed_drj_drills_full_access',false,$id);}
function mm_drj_drills_access_config(){return array('locked_matrix_routes'=>array('storyforge'));}
class WP_User{public $ID;function __construct($id){$this->ID=$id;}function exists(){return $this->ID>0;}}
require dirname(__DIR__).'/includes/class-mmed-access-gate.php';
require dirname(__DIR__,3).'/mu-plugins/missionmed-matrix-entitlement-guard.php';
MMED_Access_Gate::init();
function verify($ok,$message){global $assertions;$assertions++;if(!$ok){throw new RuntimeException($message);}}
$base=array('trusted'=>true,'verified'=>true,'active'=>false,'status'=>'not_eligible');
foreach(array('360-only'=>array(3893),'complete-only'=>array(5227),'both'=>array(3893,5227)) as $persona=>$courses){
    $state[1]=array('courses'=>$courses,'active'=>$courses,'drj'=>true);
    $cache['mmed_tier_1']='free';
    $payload=MMED_Access_Gate::get_access_payload(1);
    verify($payload['full_access'] && $payload['tier']==='enrolled', $persona.' cached-free override');
    foreach($payload['apps'] as $route=>$app){verify($app['allowed']===$app['released'],$persona.' '.$route.' release boundary');}
    verify(!mm_drj_drills_access_user_is_restricted(1),$persona.' legacy DrJ role');
    verify(mmed_matrix_entitlement_user_allowed('filevault',1),$persona.' direct-route gate');
    verify(mmed_matrix_entitlement_rest_guard(null,null,new WP_REST_Request('/mmed/v1/files'))===null,$persona.' protected REST');
    $e=apply_filters('missionmed_storyforge_entitlement',$base,new WP_User(1),'student');
    verify($e['active'] && $e['source']==='matrix_current_learndash',$persona.' StoryForge parity');
    foreach(array('mentor','admin') as $role){verify(apply_filters('missionmed_storyforge_entitlement',$base,new WP_User(1),$role)===$base,'preserve '.$role);}
    $blocked=$base+array('restricted'=>true);
    verify(apply_filters('missionmed_storyforge_entitlement',$blocked,new WP_User(1),'student')===$blocked,'explicit security denial');
}
foreach(array(3893,5227) as $course){
    $state[1]=array('courses'=>array(),'active'=>array(),'drj'=>true);$cache['mmed_tier_1']='free';
    verify(!MMED_Access_Gate::user_has_full_access(1),'before enrollment');
    // LearnDash current access changes; intentionally stale list/tier proves direct check.
    $state[1]['active']=array($course);
    verify(MMED_Access_Gate::user_has_full_access(1),'new enrollment immediate');
    verify(MMED_Access_Gate::get_tier(1)==='enrolled','new enrollment tier immediate');
    $state[1]['active']=array();
    MMED_Access_Gate::clear_user_cache(1);
    verify(!MMED_Access_Gate::user_has_full_access(1),'revoked enrollment');
    verify(!MMED_Access_Gate::user_can_access_app(1,'storyforge'),'revoked DrJ overlay restored');
}
foreach(array('DrJ-only'=>true,'registered'=>false) as $persona=>$drj){
    $state[1]=array('courses'=>array(),'active'=>array(),'drj'=>$drj);$cache=array();
    verify(!MMED_Access_Gate::user_has_full_access(1),$persona.' no full access');
    verify(!MMED_Access_Gate::user_can_access_app(1,'ivprep'),$persona.' premium denied');
    verify(is_wp_error(mmed_matrix_entitlement_rest_guard(null,null,new WP_REST_Request('/mmed/v1/files'))),$persona.' protected REST denied');
    verify(MMED_Access_Gate::user_can_access_app(1,'storyforge')===!$drj,$persona.' baseline unchanged');
    verify(apply_filters('missionmed_storyforge_entitlement',$base,new WP_User(1),'student')===$base,$persona.' SSO unchanged');
}
$state[1]=array('admin'=>true);verify(MMED_Access_Gate::user_has_full_access(1),'admin preserved');
$state[1]=array('courses'=>array(3893,5227),'active'=>array(),'drj'=>true);
verify(!MMED_Access_Gate::user_has_full_access(1),'expired historical enrollment list cannot grant');
verify(MMED_Access_Gate::preserve_full_program_access(true,1),'existing stronger grant preserved');
verify(!MMED_Access_Gate::user_has_full_access(0),'anonymous no full grant');
verify(!MMED_Access_Gate::user_can_access_app(0,'storyforge'),'anonymous denied');
verify(apply_filters('missionmed_storyforge_entitlement',$base,new WP_User(0),'student')===$base,'anonymous SSO denied');
$current_authenticated=false;
verify(mmed_matrix_entitlement_rest_guard(null,null,new WP_REST_Request('/mmed/v1/files'))->code==='mmed_matrix_authentication_required','anonymous REST 401');
echo "PASS: $assertions assertions; 360/Complete/both/new enrollments/DrJ/registered/admin/anonymous, revoked access, roles, explicit security and unreleased features.\n";
