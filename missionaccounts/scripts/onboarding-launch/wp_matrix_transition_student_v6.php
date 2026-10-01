<?php
/** DR-354: exact Round 5 student campaign. Private CLI only; no browser entry. */
declare(strict_types=1);
$mode = $argv[1] ?? '';
if (PHP_SAPI !== 'cli' || $argc !== 2 || !in_array($mode, ['dry-run','send-canary','confirm-canary','send-batch','ledger'], true)) {
    throw new RuntimeException('campaign_cli_mode_required');
}
require '/www/theresidencyacademy_209/public/wp-load.php';
const MXV6_CAMPAIGN = 'matrix-live-transition-v6-student-2026-10-01';
const MXV6_SUBJECT = 'Dr J ExamPrep: Complete onboarding to continue Live Drills';
const MXV6_AUTHORITY = 'DR-355';
const MXV6_AUTHORITY_HEAD = '4912460e8a6da4079bfafed3d4a24ce9f3c24546';
const MXV6_MANIFEST = '/www/theresidencyacademy_209/private/mmdrj-matrix-v6-manifest.json';
const MXV6_MANIFEST_SHA = '3c68f28f5590d3642fea8a4e68bdfa7ca84788cdfd9a7bdac946730f665be9bd';
const MXV6_HTML = '/www/theresidencyacademy_209/private/matrix-live-transition-v6-student.html';
const MXV6_HTML_SHA = '7ddcbf9d8f4153582849e0b146993dc2ec25e86cd8e8c59234fe55e5fcbddc06';
const MXV6_TEXT = '/www/theresidencyacademy_209/private/matrix-live-transition-v6-student.txt';
const MXV6_TEXT_SHA = '185062ecdec21d507d52d856997eec99c5661abba103e4b3c8e176834debd517';
const MXV6_PREFLIGHT = '/www/theresidencyacademy_209/private/mmdrj-matrix-v6-preflight.json';
const MXV6_CAPTURE = '/www/theresidencyacademy_209/private/mmdrj-matrix-v6-capture.json';
const MXV6_GATE = '_mmdrj_matrix_v6_canary_gate';
const MXV6_CANARY_EVIDENCE = '/www/theresidencyacademy_209/private/mmdrj-matrix-v6-canary-verification.json';
function mxv6_json_file(string $path, string $hash = ''): array {
    if (!is_file($path) || !is_readable($path) || ($hash !== '' && !hash_equals($hash, hash_file('sha256', $path)))) throw new RuntimeException('protected_artifact_missing_or_changed');
    return json_decode((string)file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
}
function mxv6_manifest(): array {
    $m=mxv6_json_file(MXV6_MANIFEST,MXV6_MANIFEST_SHA);
    if (($m['schema']??'')!=='missionmed.matrix-transition-student-v6.manifest.v1' || ($m['campaign']??'')!==MXV6_CAMPAIGN || ($m['subject']??'')!==MXV6_SUBJECT || (int)($m['source_course_id']??0)!==6357 || count($m['records']??[])!==133 || ($m['student_template_html_sha256']??'')!==MXV6_HTML_SHA || ($m['student_template_text_sha256']??'')!==MXV6_TEXT_SHA) throw new RuntimeException('manifest_contract_changed');
    $seen=[];$eligible=[];
    foreach ($m['records'] as $r) {
        $id=(int)($r['wp_user_id']??0);if($id<1 || isset($seen[$id]))throw new RuntimeException('manifest_duplicate_id');$seen[$id]=true;
        if (($r['send_disposition']??'')==='SEND') {if(isset($seen['email:'.$r['email']]))throw new RuntimeException('manifest_duplicate_email');$seen['email:'.$r['email']]=true;$eligible[]=$r;}
    }
    if(count($eligible)!==122 || count($m['canary_selection']['wp_user_ids']??[])!==5 || ($m['canary_selection']['executed']??true)!==false)throw new RuntimeException('manifest_count_or_canary_changed');
    usort($eligible,static function($a,$b):int { $ka=hash('sha256',MXV6_CAMPAIGN.'|'.$a['wp_user_id'].'|'.$a['student_uuid']);$kb=hash('sha256',MXV6_CAMPAIGN.'|'.$b['wp_user_id'].'|'.$b['student_uuid']);return strcmp($ka,$kb)?:($a['wp_user_id']<=>$b['wp_user_id']); });
    if(array_map(static fn($r)=>(int)$r['wp_user_id'],array_slice($eligible,0,5))!==$m['canary_selection']['wp_user_ids'])throw new RuntimeException('canary_not_deterministic');
    return $m;
}
function mxv6_by_id(array $m,int $id):array {foreach($m['records'] as $r)if((int)$r['wp_user_id']===$id)return $r;throw new RuntimeException('id_not_in_manifest');}
function mxv6_ledger_key(array $r):string{return '_mmdrj_matrix_v6_'.hash('sha256',$r['wp_user_id'].'|'.$r['email_sha256']);}
function mxv6_read_ledger(array $r):?array { $v=get_option(mxv6_ledger_key($r),false);return $v===false?null:json_decode((string)$v,true); }
function mxv6_preflight(array $m,string $mode):array {
    $p=mxv6_json_file(MXV6_PREFLIGHT);$capture=mxv6_json_file(MXV6_CAPTURE);
    if(($p['schema']??'')!=='missionmed.matrix-transition-v6.preflight.v1' || ($p['manifest_sha256']??'')!==MXV6_MANIFEST_SHA || ($p['capture_sha256']??'')!==hash_file('sha256',MXV6_CAPTURE) || ($capture['project_id']??'')!=='dwwsahpzblgrgducxtzw' || ($capture['source_course_id']??0)!==6357 || ($capture['query']??'')!==($p['query']??'') || ($capture['rows']??[])!==($p['rows']??[])) throw new RuntimeException('live_preflight_provenance_changed');
    $ids=$p['wp_user_ids']??[];if(!is_array($ids)||count($ids)<1||count($ids)>10||count($ids)!==count(array_unique($ids)))throw new RuntimeException('preflight_ids_invalid');
    $canary=$m['canary_selection']['wp_user_ids'];
    if($mode==='send-canary' && $ids!==$canary)throw new RuntimeException('canary_batch_mismatch');
    $gate=json_decode((string)get_option(MXV6_GATE,''),true);
    if($mode==='send-batch' && (array_intersect($ids,$canary) || !is_array($gate) || ($gate['state']??'')!=='passed' || ($gate['manifest_sha256']??'')!==MXV6_MANIFEST_SHA))throw new RuntimeException('canary_gate_missing_or_batch_invalid');
    $rows=[];foreach($p['rows'] as $row){$sid=(string)($row['student_id']??'');if($sid===''||isset($rows[$sid]))throw new RuntimeException('preflight_duplicate_student');$rows[$sid]=$row;}
    if(count($rows)!==count($ids))throw new RuntimeException('preflight_row_count_changed');
    foreach($ids as $id){$r=mxv6_by_id($m,(int)$id);if(($r['send_disposition']??'')!=='SEND'||!isset($rows[$r['student_uuid']]))throw new RuntimeException('preflight_recipient_out_of_scope');}
    return [$ids,$rows];
}
function mxv6_current_wp(array $r):WP_User {
    $id=(int)$r['wp_user_id'];$u=get_user_by('id',$id);
    if(!$u||user_can($u,'manage_options')||!function_exists('sfwd_lms_has_access')||!sfwd_lms_has_access(6357,$id))throw new RuntimeException('course_or_role_changed');
    $roles=(array)$u->roles;if(!array_intersect(['subscriber','customer'],$roles)||array_diff($roles,['subscriber','customer','drj_drills_student']))throw new RuntimeException('student_role_scope_changed');
    $email=strtolower(trim((string)$u->user_email));if(!is_email($email)||$email!==$r['email']||!hash_equals($r['email_sha256'],hash('sha256',$email))||$u->user_login!==$r['username']||!hash_equals($r['username_sha256'],hash('sha256',(string)$u->user_login))||strtolower((string)get_user_meta($id,'_missionmed_missionaccounts_user_id',true))!==$r['student_uuid'])throw new RuntimeException('wordpress_identity_or_address_changed');
    if(get_option('_mmdrj_mail_suppress_'.$r['email_sha256'],false)!==false)throw new RuntimeException('bounce_or_deferral_suppression');
    if(get_option('_mmdrj_matrix_v3_'.hash('sha256',$id.'|'.$r['email_sha256']),false)!==false)throw new RuntimeException('prior_equivalent_claim');
    return $u;
}
function mxv6_current_db(array $r,array $row):void {
    $age=time()-strtotime((string)($row['fetched_at']??'').' UTC');
    if($age<0||$age>120)throw new RuntimeException('live_authority_stale');
    if(($row['student_id']??'')!==$r['student_uuid']||($row['identity_state']??'')!=='verified'||($row['canonical_student_id']??'')!==$r['student_uuid']||($row['absorbed']??true)!==false||($row['excluded']??true)!==false||($row['workspace_resolved']??false)!==true||($row['sponsor_type']??'')!==$r['sponsor_class']||!in_array($row['onboarding_status']??'',['NOT_STARTED','IN_PROGRESS'],true))throw new RuntimeException('live_authority_changed');
    $expected=$r['sponsor_class']==='DIRECT'?'REQUIRED':'NOT_APPLICABLE';if(($row['payment_requirement']??'')!==$expected)throw new RuntimeException('payment_contract_changed');
}
function mxv6_render(array $r,WP_User $u):array {
    if(!hash_equals(MXV6_HTML_SHA,hash_file('sha256',MXV6_HTML))||!hash_equals(MXV6_TEXT_SHA,hash_file('sha256',MXV6_TEXT)))throw new RuntimeException('body_bytes_changed');
    $html=(string)file_get_contents(MXV6_HTML);$text=(string)file_get_contents(MXV6_TEXT);
    $first=(string)($u->first_name?:$u->display_name);if($first===''||$first!==$r['first_name'])throw new RuntimeException('first_name_changed');
    $onboarding=add_query_arg('missionmed_intent','missionaccounts_onboarding',home_url('/my-account/'));$reset=wc_lostpassword_url();
    $html=strtr($html,['{{first_name}}'=>esc_html($first),'{{username}}'=>esc_html($u->user_login),'{{credential_block}}'=>'Use your existing MissionMed password. Need to change it? <a href="'.esc_url($reset).'" style="color:#e6c987;text-decoration:underline">Reset password →</a>','{{onboarding_url}}'=>esc_url($onboarding)]);
    $text=strtr($text,['{{first_name}}'=>sanitize_text_field($first),'{{username}}'=>sanitize_text_field($u->user_login),'{{credential_block}}'=>'Use your existing MissionMed password. Reset it if needed: '.esc_url_raw($reset),'{{onboarding_url}}'=>esc_url_raw($onboarding)]);
    if(preg_match('/\{\{[^}]+\}\}/',$html.$text)||substr_count($html,'COMPLETE MY SETUP')!==2||substr_count($text,'COMPLETE MY SETUP')!==1)throw new RuntimeException('render_or_cta_contract_changed');
    return [$html,$text];
}
$m=mxv6_manifest();
if($mode==='ledger'){ $counts=[];foreach($m['records'] as $r){$s=mxv6_read_ledger($r)['state']??'none';$counts[$s]=($counts[$s]??0)+1;}echo wp_json_encode(['campaign'=>MXV6_CAMPAIGN,'counts'=>$counts,'canary_gate'=>get_option(MXV6_GATE,false)!==false])."\n";exit; }
if($mode==='confirm-canary'){
    foreach($m['canary_selection']['wp_user_ids'] as $id){$r=mxv6_by_id($m,(int)$id);$v=mxv6_read_ledger($r);if(($v['state']??'')!=='provider_accepted'||get_option('_mmdrj_mail_suppress_'.$r['email_sha256'],false)!==false)throw new RuntimeException('canary_not_accepted_or_suppressed');}
    $proof=mxv6_json_file(MXV6_CANARY_EVIDENCE);
    $ids=[];foreach($m['canary_selection']['wp_user_ids'] as $id){$ids[]=mxv6_read_ledger(mxv6_by_id($m,(int)$id))['message_id'];}sort($ids);
    $provided=$proof['message_ids']??[];sort($provided);
    if(($proof['schema']??'')!=='missionmed.matrix-v6.canary-provider-verification.v1'||($proof['manifest_sha256']??'')!==MXV6_MANIFEST_SHA||($proof['authority_head']??'')!==MXV6_AUTHORITY_HEAD||($proof['google_workspace_sent_count']??0)!==5||($proof['bounce_count']??-1)!==0||($proof['transport']??'')!=='GOOGLE_WORKSPACE'||$provided!==$ids||!preg_match('/^[0-9a-f]{64}$/',(string)($proof['evidence_sha256']??''))||abs(time()-strtotime((string)($proof['verified_at']??'')))>3600)throw new RuntimeException('independent_canary_provider_evidence_missing');
    if(!add_option(MXV6_GATE,wp_json_encode(['state'=>'passed','manifest_sha256'=>MXV6_MANIFEST_SHA,'provider_evidence_sha256'=>hash_file('sha256',MXV6_CANARY_EVIDENCE),'at'=>gmdate('c')]),'',false))throw new RuntimeException('canary_gate_already_exists');
    echo wp_json_encode(['canary'=>'passed','count'=>5])."\n";exit;
}
if($mode==='dry-run'){ $ready=0;foreach($m['records'] as $r)if(($r['send_disposition']??'')==='SEND'){$ready++;}echo wp_json_encode(['campaign'=>MXV6_CAMPAIGN,'subject'=>MXV6_SUBJECT,'manifest_sha256'=>MXV6_MANIFEST_SHA,'eligible'=>$ready,'canary_count'=>5,'attempted'=>false])."\n";exit; }
if(!function_exists('missionaccounts_send_email')||!function_exists('missionmed_protected_mail_restore_transport')||!get_option('_missionmed_gws_smtp_credential'))throw new RuntimeException('google_transport_unavailable');
[$ids,$rows]=mxv6_preflight($m,$mode);$results=[];
foreach($ids as $id){
    $r=mxv6_by_id($m,(int)$id);$prior=mxv6_read_ledger($r);
    if($prior!==null){$results[]=['wp_user_id'=>$id,'status'=>'prior_claim_hold','prior_state'=>$prior['state']??'ambiguous'];continue;}
    try{$u=mxv6_current_wp($r);mxv6_current_db($r,$rows[$r['student_uuid']]);[$html,$text]=mxv6_render($r,$u);}catch(Throwable $e){$results[]=['wp_user_id'=>$id,'status'=>'hold','reason'=>$e->getMessage()];continue;}
    $claim=['state'=>'sending','authority'=>MXV6_AUTHORITY,'authority_head'=>MXV6_AUTHORITY_HEAD,'campaign'=>MXV6_CAMPAIGN,'manifest_sha256'=>MXV6_MANIFEST_SHA,'subject_sha256'=>hash('sha256',MXV6_SUBJECT),'html_sha256'=>MXV6_HTML_SHA,'text_sha256'=>MXV6_TEXT_SHA,'email_sha256'=>$r['email_sha256'],'wp_user_id'=>$id,'attempted_at'=>gmdate('c'),'message_id'=>'<mx5404e-v6-'.bin2hex(random_bytes(12)).'@missionmedinstitute.com>'];
    $key=mxv6_ledger_key($r);if(!add_option($key,wp_json_encode($claim),'',false)){$results[]=['wp_user_id'=>$id,'status'=>'ambiguous_claim_hold'];continue;}
    $hook=static function($mail)use($u,$text,$claim):void{
        $to=$mail->getToAddresses();if($mail->Mailer!=='smtp'||$mail->Host!=='smtp.gmail.com'||!$mail->SMTPAuth||$mail->Username!=='info@missionmedinstitute.com'||$mail->From!=='info@missionmedinstitute.com'||count($to)!==1||strtolower((string)$to[0][0])!==strtolower((string)$u->user_email)||count($mail->getCcAddresses())!==0||count($mail->getBccAddresses())!==0)throw new RuntimeException('google_only_single_recipient_guard_failed');
        $mail->AltBody=$text;$mail->MessageID=$claim['message_id'];
    };
    add_action('phpmailer_init',$hook,100000);
    try{$sent=missionaccounts_send_email($u->user_email,MXV6_SUBJECT,$html,['Content-Type: text/html; charset=UTF-8','From: Dr J via MissionMed <info@missionmedinstitute.com>','Reply-To: Dr J via MissionMed <info@missionmedinstitute.com>']);}
    catch(Throwable $e){$sent=false;}
    finally{remove_action('phpmailer_init',$hook,100000);}
    $final=array_merge($claim,['state'=>$sent?'provider_accepted':'ambiguous_hold','finished_at'=>gmdate('c')]);$recorded=update_option($key,wp_json_encode($final),false);
    $results[]=['wp_user_id'=>$id,'status'=>$recorded?$final['state']:'ambiguous_hold'];
    if(!$sent||!$recorded)break;
}
echo wp_json_encode(['campaign'=>MXV6_CAMPAIGN,'mode'=>$mode,'results'=>$results])."\n";
