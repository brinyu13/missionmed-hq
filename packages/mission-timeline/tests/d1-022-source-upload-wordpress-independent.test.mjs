import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const plugin=readFileSync(new URL('../../../wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php',import.meta.url),'utf8');
const start=plugin.indexOf('function mmtl_release_ai_proxy_session_lock($is_ai_route) {');
const end=plugin.indexOf("\nadd_action('template_redirect', 'mmtl_proxy_api_request', 0);",start);
assert.ok(start>0&&end>start,'Exercise the actual complete PHP gateway function');
const actual=plugin.slice(start,end);
const harness=String.raw`
$input=json_decode(stream_get_contents(STDIN),true); $scenario=$input['scenario']??'';
class WP_Error { function get_error_code(){return 'access_revoked';} function get_error_message(){return 'Denied';} function get_error_data(){return ['status'=>403];} }
function get_query_var($name,$default=''){global $input;return $input['path']??'v1/objects/upload';}
function is_user_logged_in(){global $scenario;return $scenario!=='anonymous';}
function mmtl_verify_origin_header($origin){global $scenario;return $scenario!=='foreign_origin';}
function wp_get_current_user(){return (object)['ID'=>1317];}
function mmtl_access_state($user){global $scenario;return $scenario==='revoked'?new WP_Error():['role'=>'STUDENT','admin_workspace'=>false];}
function is_wp_error($v){return $v instanceof WP_Error;}
function mmtl_principal_for_user($id){return 'synthetic-owner';}
function mmtl_gateway_authorization(){return 'synthetic.test.token';}
function mmtl_verify_jwt(){global $scenario;return $scenario==='invalid_token'?new WP_Error():[];}
function mmtl_settings(){return ['api_origin'=>'https://fixed-api.invalid'];}
function wp_http_validate_url($url){return $url==='https://fixed-api.invalid';}
function mmtl_gateway_secret(){return str_repeat('x',32);}
function sanitize_text_field($v){return trim((string)$v);}
function sanitize_key($v){return preg_replace('/[^a-z0-9_-]/','',strtolower((string)$v));}
function absint($v){return abs((int)$v);}
function wp_unslash($v){return $v;}
function wp_generate_uuid4(){return 'request-source-test';}
function add_query_arg($q,$url){return $url.'?'.http_build_query($q);}
function mmtl_gateway_error($code,$message,$status){throw new RuntimeException(json_encode(['kind'=>'denied','code'=>$code,'status'=>$status]));}
function wp_remote_request($target,$args){
 $headers=$args['headers']; unset($headers['Authorization'],$headers['X-MissionMed-Timeline-Gateway-Secret']);
 throw new RuntimeException(json_encode(['kind'=>'forwarded','target'=>$target,'headers'=>$headers,'redirection'=>$args['redirection'],'reject_unsafe_urls'=>$args['reject_unsafe_urls']]));
}
$_GET=$input['query']??[];
$_SERVER=array_merge(['REQUEST_METHOD'=>'POST','HTTP_ORIGIN'=>'https://missionmed.example','CONTENT_LENGTH'=>'100','CONTENT_TYPE'=>'application/pdf','HTTP_X_TIMELINE_DOCUMENT_ID'=>'timeline_test','HTTP_X_TIMELINE_OBJECT_CLASS'=>'SOURCE','HTTP_X_CONTENT_SHA256'=>str_repeat('a',64)],$input['server']??[]);
`;
function run(input={}){
 const script=harness+actual+String.raw`try { mmtl_proxy_api_request(); echo json_encode(['kind'=>'returned']); } catch (RuntimeException $e) { echo $e->getMessage(); }`;
 return JSON.parse(execFileSync('php',['-r',script],{input:JSON.stringify(input),encoding:'utf8',timeout:10000}));
}
for(const mime of ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg'])test(`independent actual WP SOURCE gateway accepts ${mime}`,()=>{
 const r=run({server:{CONTENT_TYPE:mime,CONTENT_LENGTH:String(25*1024*1024)}}); assert.equal(r.kind,'forwarded'); assert.equal(r.headers['Content-Type'],mime); assert.equal(r.headers['X-Timeline-Object-Class'],'SOURCE'); assert.equal(r.headers['X-Timeline-Document-Id'],'timeline_test'); assert.equal(r.headers['X-Content-Sha256'],'a'.repeat(64)); assert.equal(r.redirection,0); assert.equal(r.reject_unsafe_urls,true); assert.equal(r.target,'https://fixed-api.invalid/v1/objects/upload');
});
for(const [name,input,status,code] of [
 ['anonymous',{scenario:'anonymous'},401,'session_required'],
 ['foreign origin',{scenario:'foreign_origin'},403,'origin_not_allowed'],
 ['revoked access',{scenario:'revoked'},403,'access_revoked'],
 ['invalid token',{scenario:'invalid_token'},401,'timeline_token_invalid'],
 ['SOURCE 25 MB plus one',{server:{CONTENT_LENGTH:String(25*1024*1024+1)}},413,'request_too_large'],
 ['MEDIA 15 MB plus one',{server:{HTTP_X_TIMELINE_OBJECT_CLASS:'MEDIA',CONTENT_TYPE:'image/png',CONTENT_LENGTH:String(15*1024*1024+1)}},413,'request_too_large'],
 ['SOURCE HTML',{server:{CONTENT_TYPE:'text/html'}},415,'object_upload_type_denied'],
 ['SOURCE GIF',{server:{CONTENT_TYPE:'image/gif'}},415,'object_upload_type_denied'],
 ['MEDIA PDF',{server:{HTTP_X_TIMELINE_OBJECT_CLASS:'MEDIA'}},415,'object_upload_type_denied'],
 ['EXPORT',{server:{HTTP_X_TIMELINE_OBJECT_CLASS:'EXPORT',CONTENT_TYPE:'image/png'}},400,'object_upload_metadata_invalid'],
 ['URL as document',{server:{HTTP_X_TIMELINE_DOCUMENT_ID:'https://arbitrary.invalid/test'}},400,'object_upload_metadata_invalid'],
 ['bad checksum',{server:{HTTP_X_CONTENT_SHA256:'not-checksum'}},400,'object_upload_metadata_invalid'],
 ['arbitrary route',{path:'https://arbitrary.invalid/test'},404,'route_invalid'],
 ['path traversal',{path:'v1/objects/../../upload'},404,'route_invalid'],
 ['single dot segment',{path:'v1/./objects/upload'},404,'route_invalid'],
 ['trailing double dot',{path:'v1/objects/..'},404,'route_invalid'],
 ['trailing single dot',{path:'v1/objects/.'},404,'route_invalid'],
 ['encoded traversal',{path:'v1/objects/%2e%2e/upload'},404,'route_invalid'],
 ['encoded separator',{path:'v1/objects%2fupload'},404,'route_invalid'],
 ['generic admin proxy',{path:'v1/admin/roster'},403,'admin_directory_route_required'],
 ['large ordinary JSON',{path:'v1/documents',server:{CONTENT_LENGTH:String(2*1024*1024+1)}},413,'request_too_large'],
])test(`independent actual WP SOURCE gateway denies ${name} before forwarding`,()=>{
 const r=run(input); assert.deepEqual(r,{kind:'denied',status,code});
});
test('independent actual WP gateway strips role, owner, subject, and synthetic client headers',()=>{
 const r=run({server:{HTTP_X_TIMELINE_ROLE:'PROGRAM_ADMIN',HTTP_X_TIMELINE_SUBJECT_WP_USER_ID:'1',HTTP_X_TIMELINE_OWNER_ID:'other',HTTP_X_TIMELINE_SYNTHETIC_FIXTURE:'1',HTTP_X_UPLOAD_URL:'https://arbitrary.invalid'},query:{url:'https://arbitrary.invalid'}});
 assert.equal(r.kind,'forwarded'); assert.equal(new URL(r.target).origin,'https://fixed-api.invalid');
 assert.deepEqual(Object.keys(r.headers).sort(),['Content-Type','X-Content-Sha256','X-MissionMed-Timeline-Gateway','X-Request-Id','X-Timeline-Document-Id','X-Timeline-Object-Class']);
});
