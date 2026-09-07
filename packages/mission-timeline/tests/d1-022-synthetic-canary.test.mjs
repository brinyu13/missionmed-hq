import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=readFileSync(fileURLToPath(new URL('../scripts/wordpress-synthetic-022.php',import.meta.url)),'utf8');
// Execute the actual native-call orchestration function with isolated WP boundary
// stubs. Provider-native account/enrollment evidence is a separate later gate.
const operation=source.slice(source.indexOf('function tl022_canary_run('),source.indexOf("\nif (!defined('D1_022_CANARY_LIBRARY_ONLY'))"));
const harness=String.raw`
$input=json_decode(stream_get_contents(STDIN),true);$scenario=$input['scenario'];$users=[1=>['old'=>true],85=>['old'=>true],141=>['old'=>true]];$calls=[];$filters=[];$changed=false;
function tl022_canary_require($value,$code){if(!$value)throw new RuntimeException($code);}
function tl022_canary_context(){global $scenario;return ['home'=>$scenario==='wrong_site'?'https://sibling.test':'https://missionmedinstitute.com','course_type'=>'sfwd-courses','plugin_sha256'=>str_repeat('a',64),'pointer'=>'releases/timeline-wp-1111111111111111','settings_sha256'=>str_repeat('b',64),'admission_off'=>$scenario!=='enabled'];}
function tl022_canary_snapshot($exclude=[]){global $users,$changed;return ['ids'=>array_values(array_diff(array_keys($users),$exclude)),'sha256'=>$changed?'changed':'unchanged'];}
function username_exists($name){global $scenario;return $scenario==='collision_b'&&str_ends_with($name,'_b');}
function email_exists($name){return false;}
function is_wp_error($value){return false;}
function add_filter($name,$callback,$priority,$accepted=1){global $filters;$filters[$name]=$callback;}
function remove_filter($name,$callback,$priority){global $filters;unset($filters[$name]);}
function wp_insert_user($fields){global $scenario,$users,$calls,$filters;
 if(!isset($filters['pre_wp_mail'])||($filters['pre_wp_mail'])(null)!==true)throw new RuntimeException('mail not blocked');
 if($scenario==='fail_second'&&count($users)===4)throw new RuntimeException('synthetic insert failure');
 if($scenario==='returned_old_id')return 141;
 $id=6000+count($users);$users[$id]=$fields;$calls[]=['kind'=>'insert','id'=>$id,'keys'=>array_keys($fields),'role'=>$fields['role'],'email'=>$fields['user_email'],'display_name'=>$fields['display_name']];return $id;
}
function get_userdata($id){return (object)['roles'=>['subscriber']];}
function get_user_meta($id,$key,$single){global $users;return $users[$id]['meta_input'][$key]??'';}
function learndash_update_course_access($id,$course,$remove){global $calls,$changed,$scenario;$calls[]=['kind'=>'enroll','id'=>$id,'course'=>$course,'remove'=>$remove];if($scenario==='old_state_changed')$changed=true;}
function sfwd_lms_has_access($course,$id){return true;}
function mmtl_derived_principal_for_user($id){return '10000000-0000-5000-8000-'.str_pad((string)$id,12,'0',STR_PAD_LEFT);}
`;
const plan={schema_version:'d1-022-native-synthetic-canary.1',authority_sha256:'e27016edef2f722f1424a16d7246e5e1851d266b7825d832f7bbf62e84ec147c',run_id:'022-1234567890abcdef',expected_plugin_sha256:'a'.repeat(64),expected_pointer:'releases/timeline-wp-1111111111111111',expected_settings_sha256:'b'.repeat(64)};
function run(scenario='success',overrides={}){
 const php=harness+operation+String.raw`
 try{$result=tl022_canary_run($input['plan'],$input['passwords'],$input['execute']);}catch(Throwable $e){$result=['status'=>'DENIED','reason'=>$e->getMessage()];}
 echo json_encode(['result'=>$result,'calls'=>$calls,'filters_remaining'=>count($filters),'old_ids_still_present'=>isset($users[1],$users[85],$users[141])]);`;
 return JSON.parse(execFileSync('php',['-r',php],{input:JSON.stringify({scenario,plan,passwords:{a:'a'.repeat(64),b:'b'.repeat(64)},execute:true,...overrides}),encoding:'utf8'}));
}
test('Exactly two new synthetic subscribers receive only native3893 access with no mail or consent',()=>{
 const output=run();assert.equal(output.result.status,'CREATED_NATIVE_SYNTHETIC_CANARIES');assert.equal(output.result.users.length,2);assert.equal(output.result.wp_mail_calls_blocked,2);assert.equal(output.result.credentials_emitted,false);assert.equal(output.old_ids_still_present,true);assert.equal(output.filters_remaining,0);
 assert.deepEqual(output.calls.filter(x=>x.kind==='enroll').map(({id,course,remove})=>({id,course,remove})),[{id:6003,course:3893,remove:false},{id:6004,course:3893,remove:false}]);
 for(const call of output.calls.filter(x=>x.kind==='insert')){assert.equal(call.role,'subscriber');assert.match(call.email,/@example\.invalid$/);assert.match(call.display_name,/Synthetic/);assert.ok(!call.keys.includes('ID'));}
 assert.ok(output.result.users.every(x=>x.synthetic_fixture&&!x.consent_granted));assert.ok(!JSON.stringify(output).includes('a'.repeat(64)));
});
test('Missing execution, wrong authority, enabled admission and wrong site deny before native writes',()=>{
 for(const output of [run('success',{execute:false}),run('success',{plan:{...plan,authority_sha256:'x'}}),run('enabled'),run('wrong_site')]){assert.equal(output.result.status,'DENIED');assert.equal(output.calls.length,0);}
});
test('Second identity collision and invalid/reused passwords deny before creating the first user',()=>{
 for(const output of [run('collision_b'),run('success',{passwords:{a:'a'.repeat(64),b:'a'.repeat(64)}}),run('success',{passwords:{a:"bad'",b:'b'.repeat(64)}})]){assert.equal(output.result.status,'DENIED');assert.equal(output.calls.length,0);}
});
test('Partial native failure preserves only created identities and never deletes or repurposes a real ID',()=>{
 const partial=run('fail_second');assert.equal(partial.result.status,'PARTIAL_RECONCILE_BEFORE_CONTINUE');assert.equal(partial.result.created_users.length,1);assert.equal(partial.result.automatic_cleanup,false);assert.equal(partial.old_ids_still_present,true);assert.equal(partial.filters_remaining,0);
 const old=run('returned_old_id');assert.equal(old.result.status,'PARTIAL_RECONCILE_BEFORE_CONTINUE');assert.equal(old.result.created_users.length,0);assert.equal(old.calls.length,0);
});
test('Preexisting account or scoped metadata drift prevents a successful provisioning receipt',()=>{const output=run('old_state_changed');assert.equal(output.result.status,'PARTIAL_RECONCILE_BEFORE_CONTINUE');assert.equal(output.result.automatic_cleanup,false);});
