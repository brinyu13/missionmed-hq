<?php
/** Exact-cohort onboarding pilot over the existing wp_mail stack. */
function mmdrj_launch_exact_cohort() {
    return array(
        'Raghav Gupta' => array( 'pilot_status'=>'READY', 'wp_user_id'=>114,
            'student_id'=>'5171c2ec-5046-59e0-a22a-7362404bf9ec', 'eligibility_basis'=>'learndash_course_6357',
            'username_sha256'=>'3ac36dd52c15a334e3d36de5351e74e9eb685c73b32e756e053efabf1b19b77f', 'email_sha256'=>'3fde4e6db365154701acb64909a87d2ab647315acc1788360d175be1406b45fc' ),
        'Subani Dias' => array( 'pilot_status'=>'READY', 'wp_user_id'=>9,
            'student_id'=>'142b08bb-9643-550c-acac-29a8030c7e02', 'eligibility_basis'=>'learndash_course_6357',
            'username_sha256'=>'54400a46e12480f7c33d1c1d1216438406b273e846a9474efdae88bc7ed7e55d', 'email_sha256'=>'37eec1c8bccd263894ff9d8949dda63e4067d25261048ba76280a905fdbf3184' ),
        'Neshmaidy Negrón Zeda' => array( 'pilot_status'=>'READY', 'wp_user_id'=>89,
            'student_id'=>'c6843e4d-f163-5f57-b1bd-61d566700444', 'eligibility_basis'=>'drj_drills_student_role',
            'username_sha256'=>'8d8c2bd0285d8465f05bd1cd59c866462577b6c2fe668334803ea258a7dbaf53', 'email_sha256'=>'8d8c2bd0285d8465f05bd1cd59c866462577b6c2fe668334803ea258a7dbaf53' ),
    );
}
function mmdrj_launch_merge_html( $template, $values ) {
    return strtr( $template, array(
        '{{first_name}}'=>esc_html($values['first_name']), '{{username}}'=>esc_html($values['username']),
        '{{account_url}}'=>esc_url($values['account_url']), '{{password_setup_url}}'=>esc_url($values['password_setup_url']),
        '{{support_email}}'=>esc_html($values['support_email']) ) );
}
function mmdrj_launch_merge_text( $template, $values ) {
    return strtr( $template, array(
        '{{first_name}}'=>sanitize_text_field($values['first_name']), '{{username}}'=>sanitize_text_field($values['username']),
        '{{account_url}}'=>esc_url_raw($values['account_url']), '{{password_setup_url}}'=>esc_url_raw($values['password_setup_url']),
        '{{support_email}}'=>sanitize_email($values['support_email']) ) );
}
function mmdrj_launch_claim_state( $raw ) {
    if ( ! is_string($raw) || '' === $raw ) return array('', null);
    $value=json_decode($raw,true); return is_array($value) ? array((string)($value['state']??''),$value) : array('uncertain',null);
}
function mmdrj_launch_cas_option( $key, $expected, $replacement ) {
    global $wpdb;
    $changed=$wpdb->update($wpdb->options,array('option_value'=>$replacement),array('option_name'=>$key,'option_value'=>$expected),array('%s'),array('%s','%s'));
    if ( 1 !== $changed ) return false;
    wp_cache_delete($key,'options'); return true;
}
function mmdrj_launch_mirror_ledger( $user_id, $ledger_key, $value ) {
    return false !== update_user_meta($user_id,$ledger_key,$value);
}
function mmdrj_launch_cli_arguments( $wp_cli_args, $php_argv ) {
    if ( is_array($wp_cli_args) ) return array_values($wp_cli_args);
    return is_array($php_argv) ? array_slice($php_argv,1) : array();
}
function mmdrj_launch_process( $payload, $html_template, $text_template, $mode ) {
    $cohort=mmdrj_launch_exact_cohort();
    if ( ! in_array($mode,array('dry-run','send','retry-failed'),true)
        || ! is_array($payload) || ($payload['schema_version']??'')!=='missionaccounts-onboarding-pilot-send-v1'
        || ($payload['template_version']??'')!=='examprep-onboarding-email-2026-09-17-v3r1'
        || ($payload['provider']??'')!=='wordpress_wp_mail'
        || ($payload['subject']??'')!=='Your MyMissionMed Account is ready'
        || ($payload['cta_url']??'')!=='https://missionmedinstitute.com/missionaccounts/#/me/onboarding'
        || ! hash_equals((string)($payload['template_html_sha256']??''),hash('sha256',$html_template))
        || ! hash_equals((string)($payload['template_text_sha256']??''),hash('sha256',$text_template))
        || count($payload['items']??array())!==3 ) throw new RuntimeException('onboarding_pilot_manifest_invalid');
    if ( 'dry-run'!==$mode && (true!==($payload['external_send_authorized']??false)
        || ! preg_match('/^[0-9a-f]{40}$/',(string)($payload['authority_commit']??''))) ) throw new RuntimeException('onboarding_pilot_send_authority_required');
    if ( array_map(fn($row)=>(string)($row['display_name']??''),$payload['items'])!==array_keys($cohort) ) throw new RuntimeException('onboarding_pilot_exact_cohort_required');
    $resolved=array();
    foreach($payload['items'] as $item){
        $name=(string)$item['display_name']; $expected=$cohort[$name];
        if('HELD'===$expected['pilot_status']){
            if('HELD'!==($item['pilot_status']??'') || $expected['hold_reason']!==($item['hold_reason']??'')
                || array_intersect(array('wp_user_id','username','student_id','email_sha256'),array_keys($item))) throw new RuntimeException('onboarding_pilot_held_binding_invalid');
            $resolved[]=array('HELD',$item,null); continue;
        }
        foreach(array('pilot_status','wp_user_id','student_id','eligibility_basis','username_sha256','email_sha256') as $field){
            $actual='wp_user_id'===$field?absint($item[$field]??0):strtolower((string)($item[$field]??''));
            $wanted='wp_user_id'===$field?$expected[$field]:strtolower((string)$expected[$field]);
            if($actual!==$wanted) throw new RuntimeException('onboarding_pilot_named_binding_failed');
        }
        $user=get_user_by('id',$expected['wp_user_id']);
        $has_course=$user && function_exists('sfwd_lms_has_access') && sfwd_lms_has_access(6357,$user->ID);
        $has_drills_role=$user && in_array('drj_drills_student',(array)$user->roles,true);
        $basis_ok=('learndash_course_6357'===$expected['eligibility_basis']&&$has_course)
            ||('drj_drills_student_role'===$expected['eligibility_basis']&&$has_drills_role);
        $eligible=$user && !user_can($user,'manage_options')
            && hash_equals($expected['email_sha256'],hash('sha256',strtolower(trim($user->user_email))))
            && hash_equals($expected['username_sha256'],hash('sha256',$user->user_login))
            && strtolower((string)get_user_meta($user->ID,'_missionmed_missionaccounts_user_id',true))===$expected['student_id']
            && $basis_ok;
        if(!$eligible) throw new RuntimeException('onboarding_pilot_recipient_preflight_failed');
        $resolved[]=array('READY',$item,$user);
    }
    $results=array();
    foreach($resolved as list($pilot_status,$item,$user)){
        if('HELD'===$pilot_status){$results[]=array('display_name'=>$item['display_name'],'status'=>'held','hold_reason'=>$item['hold_reason'],'attempted'=>false);continue;}
        $send_key=hash('sha256',$payload['template_version'].'|'.$user->ID.'|'.$item['email_sha256']);
        $claim_key='_mmdrj_onboarding_'.$send_key; $ledger_key='_missionmed_onboarding_launch_v1';
        $prior_raw=get_option($claim_key,''); list($prior_state)=mmdrj_launch_claim_state($prior_raw);
        if('sent'===$prior_state){$results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>'already_sent','attempted'=>false);continue;}
        if('sending'===$prior_state||'uncertain'===$prior_state){$results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>'uncertain_hold','attempted'=>false);continue;}
        if(('retry-failed'===$mode&&'failed'!==$prior_state)||('send'===$mode&&'failed'===$prior_state)){$results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>'mode_skipped','attempted'=>false);continue;}
        if('dry-run'===$mode){$results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>'ready','attempted'=>false);continue;}
        $attempted_at=gmdate('c');
        $sending_raw=wp_json_encode(array('state'=>'sending','attempted_at'=>$attempted_at,'send_key'=>$send_key,'authority_commit'=>$payload['authority_commit']));
        $claimed='retry-failed'===$mode?mmdrj_launch_cas_option($claim_key,$prior_raw,$sending_raw):add_option($claim_key,$sending_raw,'',false);
        if(!$claimed){$results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>'uncertain_hold','attempted'=>false);continue;}
        if(!mmdrj_launch_mirror_ledger($user->ID,$ledger_key,$sending_raw)){
            $failed_raw=wp_json_encode(array('state'=>'failed','attempted_at'=>$attempted_at,'send_key'=>$send_key,'authority_commit'=>$payload['authority_commit'],'reason'=>'ledger_mirror_failed'));
            mmdrj_launch_cas_option($claim_key,$sending_raw,$failed_raw);
            $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>'failed','attempted'=>false);continue;
        }
        $reset_key=get_password_reset_key($user);
        if(is_wp_error($reset_key)){
            $final_raw=wp_json_encode(array('state'=>'failed','attempted_at'=>$attempted_at,'send_key'=>$send_key,'authority_commit'=>$payload['authority_commit'],'reason'=>'password_recovery_failed'));
            $finalized=mmdrj_launch_cas_option($claim_key,$sending_raw,$final_raw)&&mmdrj_launch_mirror_ledger($user->ID,$ledger_key,$final_raw);
            $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>$finalized?'failed':'uncertain_hold','attempted'=>false);continue;
        }
        $setup_url=network_site_url('wp-login.php?action=rp&key='.rawurlencode($reset_key).'&login='.rawurlencode($user->user_login),'login');
        $values=array('first_name'=>$user->first_name?:$item['display_name'],'username'=>$user->user_login,'account_url'=>$payload['cta_url'],'password_setup_url'=>$setup_url,'support_email'=>get_option('admin_email'));
        $html=mmdrj_launch_merge_html($html_template,$values); $plain=mmdrj_launch_merge_text($text_template,$values);
        add_action('phpmailer_init',function($mailer)use($plain){$mailer->AltBody=$plain;});
        $sent=wp_mail($user->user_email,$payload['subject'],$html,array('Content-Type: text/html; charset=UTF-8','From: Dr J via MissionMed <'.sanitize_email(get_option('admin_email')).'>','Reply-To: Dr J via MissionMed <'.sanitize_email(get_option('admin_email')).'>','X-MissionMed-Send-Key: '.$send_key));
        $finished_at=gmdate('c');
        $final_raw=wp_json_encode(array('state'=>$sent?'sent':'failed','attempted_at'=>$attempted_at,'sent_at'=>$sent?$finished_at:null,'send_key'=>$send_key,'authority_commit'=>$payload['authority_commit'],'reason'=>$sent?null:'wp_mail_failed'));
        $finalized=mmdrj_launch_cas_option($claim_key,$sending_raw,$final_raw)&&mmdrj_launch_mirror_ledger($user->ID,$ledger_key,$final_raw);
        $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$item['email_sha256'],'status'=>$finalized?($sent?'sent':'failed'):'uncertain_hold','attempted'=>true);
    }
    return array('schema_version'=>'missionaccounts-onboarding-pilot-results-v1','mode'=>$mode,'population'=>count($cohort),'counts'=>array_count_values(array_column($results,'status')),'results'=>$results);
}
if(!defined('MMDRJ_ONBOARDING_LAUNCH_TEST')){
    $cli_args=mmdrj_launch_cli_arguments($args??null,$argv??null);
    if(PHP_SAPI!=='cli'||4!==count($cli_args))throw new RuntimeException('onboarding_pilot_cli_arguments_required');
    $payload=json_decode(file_get_contents($cli_args[0]),true,32,JSON_THROW_ON_ERROR);
    $result=mmdrj_launch_process($payload,file_get_contents($cli_args[1]),file_get_contents($cli_args[2]),$cli_args[3]);
    echo wp_json_encode($result,JSON_UNESCAPED_SLASHES)."\n";
}
