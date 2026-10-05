#!/usr/bin/env python3
"""Exact reviewed WordPress page5979 wrapper publish/restore; no other configuration."""
import sys,subprocess,json,hashlib,shlex
from pathlib import Path
BASE=Path(__file__).resolve().parent
SHA_PRE='58d9380730e387495cc2a0cda85ea62708bf3bd1e49b64e66454ff989af99675'
SHA_NEW='e92b89d97a2297c43d1ee4c0cc08ec48343019195849f1b5b15bda628044e63a'
if sys.argv[1:] not in (['check'],['publish'],['restore']):
    raise SystemExit('Required explicit check, publish or restore')
mode=sys.argv[1]
restore=mode=='restore'
target=BASE/('page_5979_raw_preimage.html' if restore else 'page_5979_wrapper.html')
content=target.read_bytes()
expected=SHA_NEW if restore else SHA_PRE
target_sha=SHA_PRE if restore else SHA_NEW
if hashlib.sha256(content).hexdigest()!=target_sha: raise SystemExit('Target source hash mismatch')
php=r"""
global $wpdb;
$id=5979;
$mode='__MODE__';
$transaction=false;
$fail=function($message) use($wpdb,$id,&$transaction){if($transaction){$wpdb->query('ROLLBACK');clean_post_cache($id);}WP_CLI::error($message);};
if(get_current_user_id()!==1 || !current_user_can('manage_options') || !current_user_can('unfiltered_html')) $fail('Existing brinyu administrator capability check failed');
$content=stream_get_contents(STDIN);
$expected='__EXPECTED__';
$target='__TARGET__';
$filtered=wp_unslash(sanitize_post_field('post_content',wp_slash($content),$id,'db'));
if(hash('sha256',$filtered)!==$target) $fail('WordPress content filters would alter the approved wrapper');
foreach(array($wpdb->posts,$wpdb->postmeta) as $table){
 $engine=$wpdb->get_var($wpdb->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s',$table));
 if(strtolower((string)$engine)!=='innodb') $fail('Page storage is not transactional');
}
if($mode!=='check'){if($wpdb->query('START TRANSACTION')===false) $fail('USCE wrapper transaction could not start');$transaction=true;}
$lock=$mode==='check'?'':' FOR UPDATE';
$p=$wpdb->get_row($wpdb->prepare("SELECT ID,post_name,post_status,post_type,post_content FROM $wpdb->posts WHERE ID=%d".$lock,$id));
if(!$p || $p->post_name!=='usce-admin' || $p->post_status!=='publish' || $p->post_type!=='page') $fail('Exact published USCE page identity mismatch');
if(hash('sha256',$p->post_content)!==$expected) $fail('USCE wrapper preimage changed');
if(hash('sha256',$content)!==$target) $fail('USCE wrapper target mismatch');
if($mode==='check'){echo json_encode(array('page_id'=>$id,'actor_id'=>get_current_user_id(),'preimage_sha256'=>$expected,'target_sha256'=>$target,'content_filter_exact'=>true,'transactional_storage'=>true))."\n";return;}
$result=wp_update_post(wp_slash(array('ID'=>$id,'post_content'=>$content)),true);
if(is_wp_error($result) || $result!==$id) $fail('USCE wrapper update failed');
$actual=$wpdb->get_var($wpdb->prepare("SELECT post_content FROM $wpdb->posts WHERE ID=%d",$id));
if(hash('sha256',$actual)!==$target) $fail('USCE wrapper readback mismatch; transaction rolled back');
if($wpdb->query('COMMIT')===false) $fail('USCE wrapper commit failed');
$transaction=false;clean_post_cache($id);
echo json_encode(array('page_id'=>$id,'source_sha256'=>$target,'exact_database_readback'=>true))."\n";
""".replace('__MODE__',mode).replace('__EXPECTED__',expected).replace('__TARGET__',target_sha)
remote='wp --path=/www/theresidencyacademy_209/public --user=brinyu eval '+shlex.quote(php)
p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','missionmed-kinsta',remote],input=content,capture_output=True,timeout=60)
if p.returncode:
    print(json.dumps({'page_id':5979,'operation':'restore' if restore else 'publish','exit':p.returncode,'success':False}))
    raise SystemExit(p.returncode)
try:
    result=json.loads(p.stdout.decode())
except Exception:
    raise SystemExit('Unexpected WordPress readback; do not retry blindly')
if mode=='check':
    if result.get('page_id')!=5979 or result.get('actor_id')!=1 or result.get('preimage_sha256')!=expected or result.get('target_sha256')!=target_sha or result.get('content_filter_exact') is not True or result.get('transactional_storage') is not True: raise SystemExit('Unqualified WordPress preflight')
elif result.get('page_id')!=5979 or result.get('source_sha256')!=target_sha or result.get('exact_database_readback') is not True:
    raise SystemExit('Unqualified WordPress readback; do not retry blindly')
print(json.dumps(result))
