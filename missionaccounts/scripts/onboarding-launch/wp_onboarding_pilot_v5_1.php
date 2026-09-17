<?php
/** Exact v5.1 onboarding pilot over the proven WordPress wp_mail stack. */
declare(strict_types=1);

function mmdrj_v51_cohort(): array {
    return array(
        'Neidy' => array('wp_user_id'=>89,'student_id'=>'c6843e4d-f163-5f57-b1bd-61d566700444','eligibility_basis'=>'drj_drills_student_role','username_sha256'=>'8d8c2bd0285d8465f05bd1cd59c866462577b6c2fe668334803ea258a7dbaf53','email_sha256'=>'8d8c2bd0285d8465f05bd1cd59c866462577b6c2fe668334803ea258a7dbaf53'),
        'Ana Torres' => array('wp_user_id'=>353,'student_id'=>'b2a9e055-d55e-5bfc-8c0c-bd38f3b14b5c','eligibility_basis'=>'learndash_course_6357','username_sha256'=>'64f79b5d41a60ccc30cf4aade6ae7c91d089424537c6fe55e9a2fd539b50c01d','email_sha256'=>'c116bd2917a9deafea68d38367d80520354f47a562b47d7159fef096ce703916'),
        'Raghav Gupta' => array('wp_user_id'=>114,'student_id'=>'5171c2ec-5046-59e0-a22a-7362404bf9ec','eligibility_basis'=>'learndash_course_6357','username_sha256'=>'3ac36dd52c15a334e3d36de5351e74e9eb685c73b32e756e053efabf1b19b77f','email_sha256'=>'3fde4e6db365154701acb64909a87d2ab647315acc1788360d175be1406b45fc'),
        'Subani Dias' => array('wp_user_id'=>9,'student_id'=>'142b08bb-9643-550c-acac-29a8030c7e02','eligibility_basis'=>'learndash_course_6357','username_sha256'=>'54400a46e12480f7c33d1c1d1216438406b273e846a9474efdae88bc7ed7e55d','email_sha256'=>'37eec1c8bccd263894ff9d8949dda63e4067d25261048ba76280a905fdbf3184'),
    );
}
function mmdrj_v51_state(string $raw): string { $row=json_decode($raw,true); return is_array($row) ? (string)($row['state']??'uncertain') : ($raw===''?'':'uncertain'); }
function mmdrj_v51_finalize(string $claim_key, int $user_id, array $value): bool {
    $raw=wp_json_encode($value); return false!==update_option($claim_key,$raw,false) && false!==update_user_meta($user_id,'_missionmed_onboarding_launch_v5_1',$raw);
}
function mmdrj_v51_render(string $template, array $values, bool $html): string {
    $credential=$html
        ? 'Use your existing MissionMed password. If you need to set or reset it, use your <a href="'.esc_url($values['password_setup_url']).'" style="color:#e6c987;text-decoration:underline">secure account link</a>.'
        : 'Use your existing MissionMed password. If you need to set or reset it, use your secure account link: '.$values['password_setup_url'];
    return strtr($template,array(
        '{{first_name}}'=>$html?esc_html($values['first_name']):sanitize_text_field($values['first_name']),
        '{{username}}'=>$html?esc_html($values['username']):sanitize_text_field($values['username']),
        '{{credential_block}}'=>$credential,
        '{{onboarding_url}}'=>$html?esc_url($values['onboarding_url']):esc_url_raw($values['onboarding_url']),
        '{{support_email}}'=>$html?esc_html($values['support_email']):sanitize_email($values['support_email']),
    ));
}
function mmdrj_v51_process(array $payload, string $html_template, string $text_template, string $mode): array {
    $cohort=mmdrj_v51_cohort();
    if(!in_array($mode,array('dry-run','send'),true) || ($payload['schema_version']??'')!=='missionaccounts-onboarding-v5-1-pilot-v1' || ($payload['template_version']??'')!=='examprep-onboarding-email-2026-09-17-v5.1' || ($payload['subject']??'')!=='Your new Dr J ExamPrep home is ready' || ($payload['cta_url']??'')!=='https://missionmedinstitute.com/my-account/?missionmed_intent=missionaccounts_onboarding' || ($payload['provider']??'')!=='wordpress_wp_mail' || !hash_equals((string)($payload['template_html_sha256']??''),hash('sha256',$html_template)) || !hash_equals((string)($payload['template_text_sha256']??''),hash('sha256',$text_template)) || array_map(fn($v)=>(string)($v['display_name']??''),$payload['items']??array())!==array_keys($cohort)) throw new RuntimeException('onboarding_v51_manifest_invalid');
    if($mode==='send' && (true!==($payload['external_send_authorized']??false) || !preg_match('/^[0-9a-f]{40}$/',(string)($payload['authority_commit']??'')))) throw new RuntimeException('onboarding_v51_authority_required');
    $results=array();
    foreach($payload['items'] as $item){
        $name=(string)$item['display_name']; $expected=$cohort[$name];
        foreach(array('wp_user_id','student_id','eligibility_basis','username_sha256','email_sha256') as $field){$actual=$field==='wp_user_id'?(int)($item[$field]??0):strtolower((string)($item[$field]??''));$wanted=$field==='wp_user_id'?$expected[$field]:strtolower((string)$expected[$field]);if($actual!==$wanted)throw new RuntimeException('onboarding_v51_binding_mismatch');}
        if(strtoupper((string)($item['sponsor_type']??''))!=='DIRECT') throw new RuntimeException('onboarding_v51_sponsor_rejected');
        $user=get_user_by('id',$expected['wp_user_id']);
        $basis_ok=$user && (($expected['eligibility_basis']==='learndash_course_6357' && function_exists('sfwd_lms_has_access') && sfwd_lms_has_access(6357,$user->ID)) || ($expected['eligibility_basis']==='drj_drills_student_role' && in_array('drj_drills_student',(array)$user->roles,true)));
        $valid=$user && !user_can($user,'manage_options')
            && hash_equals($expected['username_sha256'],hash('sha256',(string)$user->user_login))
            && hash_equals($expected['email_sha256'],hash('sha256',strtolower(trim((string)$user->user_email))))
            && strtolower((string)get_user_meta($user->ID,'_missionmed_missionaccounts_user_id',true))===$expected['student_id']
            && $basis_ok;
        if(!$valid) throw new RuntimeException('onboarding_v51_recipient_preflight_failed');
        $historical=mmdrj_v51_state((string)get_user_meta($user->ID,'_missionmed_onboarding_launch_v1',true));
        if($historical==='sent'){ $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>'already_sent','attempted'=>false); continue; }
        if($historical!=='' && $historical!=='failed'){ $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>'uncertain_hold','attempted'=>false); continue; }
        $send_key=hash('sha256',$payload['template_version'].'|'.$user->ID.'|'.$expected['email_sha256']); $claim_key='_mmdrj_onboarding_v51_'.$send_key; $prior=mmdrj_v51_state((string)get_option($claim_key,''));
        if($prior==='sent'){ $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>'already_sent','attempted'=>false); continue; }
        if($prior!==''){ $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>'uncertain_hold','attempted'=>false); continue; }
        if($mode==='dry-run'){ $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>'ready','attempted'=>false); continue; }
        $attempted_at=gmdate('c'); $sending=array('state'=>'sending','attempted_at'=>$attempted_at,'send_key'=>$send_key,'authority_commit'=>$payload['authority_commit']);
        if(!add_option($claim_key,wp_json_encode($sending),'',false) || false===update_user_meta($user->ID,'_missionmed_onboarding_launch_v5_1',wp_json_encode($sending))){$results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>'uncertain_hold','attempted'=>false);continue;}
        $reset=get_password_reset_key($user); if(is_wp_error($reset)){mmdrj_v51_finalize($claim_key,$user->ID,array_merge($sending,array('state'=>'failed','reason'=>'password_recovery_failed')));$results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>'failed','attempted'=>false);continue;}
        $values=array('first_name'=>$user->first_name?:$name,'username'=>$user->user_login,'password_setup_url'=>network_site_url('wp-login.php?action=rp&key='.rawurlencode($reset).'&login='.rawurlencode($user->user_login),'login'),'onboarding_url'=>$payload['cta_url'],'support_email'=>get_option('admin_email'));
        $html=mmdrj_v51_render($html_template,$values,true); $plain=mmdrj_v51_render($text_template,$values,false); add_action('phpmailer_init',function($mailer)use($plain){$mailer->AltBody=$plain;});
        $admin=sanitize_email((string)get_option('admin_email')); $sent=wp_mail($user->user_email,$payload['subject'],$html,array('Content-Type: text/html; charset=UTF-8','From: Dr J via MissionMed <'.$admin.'>','Reply-To: Dr J via MissionMed <'.$admin.'>','X-MissionMed-Send-Key: '.$send_key));
        $final=array_merge($sending,array('state'=>$sent?'sent':'failed','sent_at'=>$sent?gmdate('c'):null,'reason'=>$sent?null:'wp_mail_failed')); $ok=mmdrj_v51_finalize($claim_key,$user->ID,$final); $results[]=array('wp_user_id'=>$user->ID,'email_sha256'=>$expected['email_sha256'],'status'=>$ok?($sent?'sent':'failed'):'uncertain_hold','attempted'=>true);
    }
    return array('schema_version'=>'missionaccounts-onboarding-v5-1-results-v1','mode'=>$mode,'counts'=>array_count_values(array_column($results,'status')),'results'=>$results);
}
if(!defined('MMDRJ_ONBOARDING_V51_TEST')){if(PHP_SAPI!=='cli'||count($argv)!==5)throw new RuntimeException('onboarding_v51_cli_arguments_required');require '/www/theresidencyacademy_209/public/wp-load.php';$payload=json_decode(file_get_contents($argv[1]),true,32,JSON_THROW_ON_ERROR);echo wp_json_encode(mmdrj_v51_process($payload,(string)file_get_contents($argv[2]),(string)file_get_contents($argv[3]),$argv[4]),JSON_UNESCAPED_SLASHES)."\n";}
