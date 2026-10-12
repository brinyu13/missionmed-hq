<?php
/** Plugin Name: MissionMed IV Prep Live Arena (isolated extension) */
if(!defined('ABSPATH'))exit;
require_once __DIR__.'/missionmed-ivprep-live-arena/state.php';
final class MMED_IVPrep_Arena {
    const NS='mmed-ivprep-arena/v1';
    const PREFIX='mmed_ivprep_arena_session_';
    public static function permission($request){return current_user_can('manage_options')&&wp_verify_nonce($request->get_header('X-WP-Nonce'),'wp_rest');}
    public static function groups(){
        global $wpdb;
        // Existing verified table only. No maybe_install or seed/setup helper.
        $rows=$wpdb->get_results("SELECT id,group_name,enrollment_template FROM {$wpdb->prefix}mmed_session_groups WHERE is_active=1 AND event_type='mr_session' ORDER BY id",ARRAY_A);
        if($wpdb->last_error)throw new RuntimeException('Class roster source is unavailable.',503);
        return $rows?:[];
    }
    public static function roster($group){
        global $wpdb;
        // Verified live helper now writes a transient. Use only explicit SELECTs here.
        if(!in_array($group['enrollment_template'],['360elite','360elite_onboarding'],true))throw new RuntimeException('Class enrollment template requires review.',422);
        $course=(int)get_option('mmed_course_360elite',0);
        if(!$course)throw new RuntimeException('Class course mapping is unavailable.',503);
        $sql="SELECT DISTINCT u.ID AS id,u.display_name AS name FROM {$wpdb->users} u WHERE u.ID IN (SELECT user_id FROM {$wpdb->usermeta} WHERE (meta_key='_mmed_program_tier' AND meta_value IN (%s,%s)) OR (meta_key=%s AND meta_value!='')) OR u.ID IN (SELECT CAST(s.meta_value AS UNSIGNED) FROM {$wpdb->posts} p JOIN {$wpdb->postmeta} t ON p.ID=t.post_id AND t.meta_key='_mmed_template_id' JOIN {$wpdb->postmeta} s ON p.ID=s.post_id AND s.meta_key='_mmed_student_id' WHERE p.post_type='mmed_task' AND p.post_status NOT IN ('trash','auto-draft') AND t.meta_value IN (%s,%s)) ORDER BY u.display_name,u.ID LIMIT 501";
        $rows=$wpdb->get_results($wpdb->prepare($sql,'360elite','360elite_onboarding','course_'.$course.'_access_from','360elite','360elite_onboarding'),ARRAY_A);
        if($wpdb->last_error)throw new RuntimeException('Enrollment roster is unavailable.',503);
        if(count($rows?:[])>=501)throw new RuntimeException('Enrollment roster exceeds the safe review limit; no truncated roster was loaded.',422);
        $roster=[];foreach($rows?:[] as $row)if(!user_can((int)$row['id'],'manage_options'))$roster[]=['id'=>(string)$row['id'],'name'=>$row['name']];
        return $roster;
    }
    public static function read($id){
        if(!MMED_IVPrep_Arena_State::uuid($id))throw new RuntimeException('Invalid session ID.',422);
        global $wpdb;$raw=$wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name=%s",self::PREFIX.$id));
        if(!$raw)throw new RuntimeException('Session not found.',404);$s=json_decode($raw,true);if(!is_array($s))throw new RuntimeException('Session data cannot be read.',500);return [$raw,$s];
    }
    public static function dispatch($r){try{
        global $wpdb;$op=$r->get_param('op');$id=$r->get_param('id');
        if($r->get_method()==='GET'){
            if($op==='groups')return ['groups'=>self::groups()];
            if($op==='sessions'){
                $raw=$wpdb->get_col($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name LIKE %s ORDER BY option_id DESC LIMIT 50",$wpdb->esc_like(self::PREFIX).'%'));
                return ['sessions'=>array_map(function($v){$s=json_decode($v,true);return ['id'=>$s['id'],'label'=>$s['label'],'class_id'=>$s['class_id']];},$raw?:[])];
            }
            return MMED_IVPrep_Arena_State::public_state(self::read($id)[1]);
        }
        $body=$r->get_json_params();if(!is_array($body)||strlen($r->get_body())>16000)throw new RuntimeException('Invalid request.',422);
        if($op==='create'){
            if(!MMED_IVPrep_Arena_State::uuid($body['id']??null))throw new RuntimeException('Invalid session ID.',422);
            $group=null;foreach(self::groups() as $g)if((string)$g['id']===(string)($body['class_id']??''))$group=$g;
            if(!$group)throw new RuntimeException('Verified class roster unavailable.',422);
            $roster=self::roster($group);
            $state=MMED_IVPrep_Arena_State::create($body['id'],$group['id'],$roster,get_current_user_id(),$body['label']??'');
            $key=self::PREFIX.$state['id'];if(!add_option($key,wp_json_encode($state),'',false)){
                $existing=self::read($state['id'])[1];if($existing['created_by']!==get_current_user_id()||$existing['class_id']!==$state['class_id']||$existing['label']!==$state['label'])throw new RuntimeException('Session ID conflict.',409);$state=$existing;
            }return MMED_IVPrep_Arena_State::public_state($state);
        }
        [$old,$state]=self::read($id);$next=MMED_IVPrep_Arena_State::apply($state,$body,get_current_user_id());
        if($next['version']!==$state['version']){
            $ok=$wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value=%s WHERE option_name=%s AND BINARY option_value=BINARY %s",wp_json_encode($next),self::PREFIX.$id,$old));
            if($ok!==1)throw new RuntimeException($ok===false?'Save failed. Retry the same request.':'Session changed. Reload and review before retrying.',$ok===false?503:409);
            wp_cache_delete(self::PREFIX.$id,'options');
        }return MMED_IVPrep_Arena_State::public_state($next);
    }catch(Throwable $e){$code=(int)$e->getCode();return new WP_Error('ivprep_error',$e->getMessage(),['status'=>($code>=400&&$code<=599)?$code:500]);}}
    public static function route(){
        if(rtrim(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH),'/')!=='/ivprep-live-arena')return;
        if(!current_user_can('manage_options')){status_header(403);nocache_headers();echo 'Instructor access required.';exit;}
        nocache_headers();header('X-Robots-Tag: noindex, nofollow');header('X-Frame-Options: DENY');
        $config=['api'=>rest_url(self::NS.'/state'),'nonce'=>wp_create_nonce('wp_rest'),'assets'=>plugins_url('missionmed-ivprep-live-arena/',__FILE__),'local'=>false,'avatarBase'=>plugins_url('missionmed-hub/assets/team-challenge-avatars/')];
        require __DIR__.'/missionmed-ivprep-live-arena/view.php';exit;
    }
}
add_action('rest_api_init',function(){register_rest_route(MMED_IVPrep_Arena::NS,'/state',['methods'=>['GET','POST'],'callback'=>['MMED_IVPrep_Arena','dispatch'],'permission_callback'=>['MMED_IVPrep_Arena','permission']]);});
add_action('template_redirect',['MMED_IVPrep_Arena','route'],1);
