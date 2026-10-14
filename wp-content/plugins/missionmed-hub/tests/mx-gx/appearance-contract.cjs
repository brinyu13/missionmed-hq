'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const repo = cp.execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname }).toString().trim();
const backend = path.join(repo, 'wp-content/mu-plugins/missionmed-matrix-appearance-v1.php');
const css = fs.readFileSync(path.join(repo, 'wp-content/mu-plugins/missionmed-matrix-appearance-v1/dashboard.css'), 'utf8');
const js = fs.readFileSync(path.join(repo, 'wp-content/mu-plugins/missionmed-matrix-appearance-v1/dashboard.js'), 'utf8');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mmed-appearance-fixture-'));
// These mocks exercise actual adapter callbacks, not WP middleware or production.
const php = `<?php
define('ABSPATH','synthetic-fixture');
class WP_Error { public $code,$data; function __construct($c,$m,$d){$this->code=$c;$this->data=$d;} }
class WP_REST_Response {public $data,$status,$headers=[];function __construct($d,$s=200){$this->data=$d;$this->status=$s;}function header($k,$v){$this->headers[$k]=$v;} }
class Request { public $method,$body,$query,$nonce,$type;
 function __construct($m='GET',$b='',$q=[],$n='synthetic-valid',$t='application/json'){$this->method=$m;$this->body=$b;$this->query=$q;$this->nonce=$n;$this->type=$t;}
 function get_method(){return $this->method;}function get_body(){return $this->body;}function get_query_params(){return $this->query;}
 function get_header($k){return strtolower($k)==='x-wp-nonce'?$this->nonce:$this->type;}function get_route(){return '/mmed/v1/me/appearance';} }
function add_action(...$a){} function add_filter(...$a){} function register_rest_route($n,$p,$r){$GLOBALS['routes']=[$n,$p,$r];}
function get_current_user_id(){return $GLOBALS['uid'];}function is_user_logged_in(){return !!$GLOBALS['uid'];}
function wp_validate_auth_cookie(...$a){return $GLOBALS['cookie'];}function wp_verify_nonce($n,$a){return $n==='synthetic-valid'&&$a==='wp_rest';}
function is_wp_error($v){return $v instanceof WP_Error;}
function wp_cache_get($id,$g='',$force=false,&$found=null){$found=array_key_exists($id,$GLOBALS['cache']);return $found?$GLOBALS['cache'][$id]:false;}
function wp_cache_delete($id,$g){$GLOBALS['cache_ids'][]=$id;if($GLOBALS['delete_fail'])return false;unset($GLOBALS['cache'][$id]);return true;}
function get_user_meta($id,$k,$single){global $wpdb;$GLOBALS['reads']++;if($GLOBALS['read_fail']){$wpdb->last_error='synthetic read failure';return [];}
 if(isset($GLOBALS['cache'][$id][$k]))return $GLOBALS['cache'][$id][$k];$v=$GLOBALS['store'][$id][$k]??[];$GLOBALS['cache'][$id][$k]=$v;return $v;}
function update_user_meta($id,$k,$m){global $wpdb;$GLOBALS['writes'][]=[$id,$k,$m];if($GLOBALS['write_fail']){$wpdb->last_error='synthetic write failure';return false;}
 if($GLOBALS['after_override']!==null){$GLOBALS['store'][$id][$k]=$GLOBALS['after_override'];unset($GLOBALS['cache'][$id]);return true;}
 if(($GLOBALS['store'][$id][$k]??[])===[$m])return false;
 $count=max(1,count($GLOBALS['store'][$id][$k]??[]));$GLOBALS['store'][$id][$k]=array_fill(0,$count,$m);unset($GLOBALS['cache'][$id]);return true;}
function wp_parse_url($v,$part){return parse_url($v,$part);}function nocache_headers(){}function content_url($p){return 'https://fixture.invalid/wp-content'.$p;}
function rest_url($p){return 'file:///wp-json/'.$p;}function wp_create_nonce($a){return 'synthetic-valid';}function wp_json_encode($v,$flags=0){return json_encode($v,$flags);}
function wp_enqueue_script(...$a){$GLOBALS['enqueued']=$a;}
class MMED_Dashboard_Experience {static function resolve(){return $GLOBALS['experience'];}}
$wpdb=(object)['last_error'=>''];$count=0;
function reset_fixture($rows=[]){global $wpdb;$GLOBALS['uid']=701;$GLOBALS['cookie']=701;$GLOBALS['cache']=[];$GLOBALS['store']=[701=>['_mmed_matrix_appearance_v1'=>$rows,'first_name'=>['KEEP']],702=>['_mmed_matrix_appearance_v1'=>['auto']]];
 $GLOBALS['writes']=[];$GLOBALS['reads']=0;$GLOBALS['cache_ids']=[];$GLOBALS['delete_fail']=false;$GLOBALS['read_fail']=false;$GLOBALS['write_fail']=false;$GLOBALS['after_override']=null;$GLOBALS['experience']='matrix2';$wpdb->last_error='';$_SERVER['REQUEST_URI']='/member-dashboard/';}
function check($yes,$label){global $count;if(!$yes)throw new Exception('FAIL '.$label);$count++;}
function status($v){return $v instanceof WP_Error?$v->data['status']:$v->status;}
function post($mode){return new Request('POST',json_encode(['mode'=>$mode]));}
require ${JSON.stringify(backend)};
MMED_Matrix_Appearance_V1::routes();check($GLOBALS['routes'][0]==='mmed/v1'&&$GLOBALS['routes'][1]==='/me/appearance','exact routes');
foreach([0,702] as $fixture_cookie){reset_fixture();$GLOBALS['cookie']=$fixture_cookie;check(status(MMED_Matrix_Appearance_V1::save(post('light')))===401&&count($GLOBALS['writes'])===0,'alternate or mismatched cookie denied');}
reset_fixture();$GLOBALS['uid']=0;check(status(MMED_Matrix_Appearance_V1::get(new Request()))===401,'anonymous read denied');
foreach(['','bad'] as $nonce){reset_fixture();check(status(MMED_Matrix_Appearance_V1::save(new Request('POST','{"mode":"light"}',[],$nonce)))===403&&count($GLOBALS['writes'])===0,'nonce denied');}
foreach([new Request('GET','', ['user_id'=>702]),new Request('GET','{"account_id":702}'),new Request('POST','{"mode":"light"}', ['meta_key'=>'first_name']),new Request('POST','{"mode":"light","user_id":702}'),new Request('POST','{"mode":"light","meta_key":"first_name"}'),new Request('POST','{"mode":"light","if_revision":1}'),new Request('POST','{"mode":"light"}',[],'synthetic-valid','application/x-www-form-urlencoded'),new Request('POST','["light"]'),new Request('POST','{}')] as $r){reset_fixture();check(status(MMED_Matrix_Appearance_V1::save($r))===400&&count($GLOBALS['writes'])===0&&$GLOBALS['reads']===0,'unknown fields/body/query denied before storage');}
foreach([true,false,0,1,null,[],(object)[],'LIGHT','Light',' light','light ','system',''] as $mode){reset_fixture();check(status(MMED_Matrix_Appearance_V1::save(post($mode)))===400&&count($GLOBALS['writes'])===0,'strict enum');}
reset_fixture();$r=MMED_Matrix_Appearance_V1::get(new Request());check($r->data['state']==='absent'&&$r->data['revision']==='v1:absent'&&$r->data['mode']==='dark','absent default');
foreach(['dark','light','auto'] as $mode){reset_fixture();$r=MMED_Matrix_Appearance_V1::save(post($mode));check(status($r)===200&&$r->data['mode']===$mode&&$GLOBALS['writes']===[[701,'_mmed_matrix_appearance_v1',$mode]],'own enum only');check($GLOBALS['store'][701]['first_name']===['KEEP']&&$GLOBALS['store'][702]['_mmed_matrix_appearance_v1']===['auto'],'unrelated data preserved');}
reset_fixture(['dark']);check(status(MMED_Matrix_Appearance_V1::save(post('dark')))===200,'native false no-op confirmed');
reset_fixture(['dark']);$GLOBALS['write_fail']=true;check(status(MMED_Matrix_Appearance_V1::save(post('dark')))===503,'write error outranks matching mode');
reset_fixture();$GLOBALS['read_fail']=true;check(status(MMED_Matrix_Appearance_V1::get(new Request()))===503,'read failure not absent success');
reset_fixture(['light','light']);check(MMED_Matrix_Appearance_V1::get(new Request())->data['mode']==='light','homogeneous rows');
reset_fixture(['light','auto']);check(MMED_Matrix_Appearance_V1::get(new Request())->data['state']==='ambiguous','heterogeneous unconfirmed');$r=MMED_Matrix_Appearance_V1::save(post('dark'));check(status($r)===200&&$GLOBALS['store'][701]['_mmed_matrix_appearance_v1']===['dark','dark'],'explicit convergence preserves rows');
reset_fixture(['invalid']);check(status(MMED_Matrix_Appearance_V1::save(post('light')))===409&&count($GLOBALS['writes'])===0,'invalid preserved');
foreach([['dark'],['light','auto'],[]] as $rows){reset_fixture();$GLOBALS['after_override']=$rows;$r=MMED_Matrix_Appearance_V1::save(post('light'));check(status($r)===($rows?409:503),'superseded or absent readback not saved');}
reset_fixture(['light']);$GLOBALS['cache'][701]=['_mmed_matrix_appearance_v1'=>['dark']];$GLOBALS['delete_fail']=true;check(status(MMED_Matrix_Appearance_V1::save(post('dark')))===503&&count($GLOBALS['writes'])===0,'retained stale cache denied');
reset_fixture(['light']);$GLOBALS['delete_fail']=true;check(MMED_Matrix_Appearance_V1::get(new Request())->data['mode']==='light','cache miss false deletion is allowed');
reset_fixture(['auto']);$r=MMED_Matrix_Appearance_V1::get(new Request());check(array_keys($r->data)===['contract','version','mode','revision','auto_policy','state'],'safe snapshot keys');MMED_Matrix_Appearance_V1::response_headers($r,null,new Request());check(str_contains($r->headers['Cache-Control'],'no-store')&&$r->headers['Vary']==='Cookie','noncache response');check(array_unique($GLOBALS['cache_ids'])===[701],'only own cache invalidated');
reset_fixture();$_SERVER['REQUEST_URI']='/other-app/';check(!MMED_Matrix_Appearance_V1::page(),'other page excluded');$_SERVER['REQUEST_URI']='/member-dashboard/';$GLOBALS['experience']='classic';check(!MMED_Matrix_Appearance_V1::page(),'Classic excluded');$GLOBALS['experience']='matrix2';check(MMED_Matrix_Appearance_V1::page(),'native page admitted');
reset_fixture(['light']);ob_start();MMED_Matrix_Appearance_V1::head();$head=ob_get_clean();check(str_contains($head,'mmed-appearance-v1-critical')&&str_contains($head,'data-mmed-dashboard-appearance')&&!str_contains($head,'user_id'),'head safe critical paint');file_put_contents($argv[1],$head);
echo 'BACKEND_SYNTHETIC_PASS '.$count.' assertions; not WP middleware/live student evidence'.PHP_EOL;
`;
fs.writeFileSync(path.join(fixture, 'backend.php'), php);
const headFile = path.join(fixture, 'head.html');
process.stdout.write(cp.execFileSync('php', [path.join(fixture, 'backend.php'), headFile]).toString());
// Deliberate Light token measurements; art scenes retain their existing scrims.
function luminance(hex) { return hex.match(/[a-f0-9]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((a, x, i) => a + x * [.2126, .7152, .0722][i], 0); }
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
for (const [fg, bg, minimum] of [['142a40','f3f7fc',4.5],['3b5269','ffffff',4.5],['4d6279','eaf1f8',4.5],['ffffff','995a10',4.5],['005c7a','ffffff',3],['657e98','ffffff',3]]) assert.ok(contrast(fg, bg) >= minimum, `${fg}/${bg} contrast`);
assert.ok(!/visibility\s*:\s*hidden|filter\s*:\s*invert/i.test(css), 'no blank canvas or inversion');
assert.ok(!/localStorage|sessionStorage|postMessage|BroadcastChannel/.test(js), 'no cross-account browser store/bridge');
console.log('STATIC_CONTRAST_SCOPE_PASS 8 assertions');
// Isolated Chrome fixture: no existing profile, real login or network API.
const chrome = process.env.MM_APPEARANCE_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const basePath = process.env.MM_APPEARANCE_BASE_CSS || '/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/MX-GX-20261013-001/runtime-dependency-custody-reconciled/wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.css';
const baseCss = fs.readFileSync(basePath, 'utf8');
assert.equal(crypto.createHash('sha256').update(baseCss).digest('hex'), 'd5bac8d5fbdbe67369d2ff54b50def51dca4a7240513ecdd6af0cf94310e46c7', 'approved live Dashboard CSS fixture');
const tests = `
const check=(v,n)=>{if(!v)throw Error(n);window.results.push(n)};window.results=[];
const snap=m=>({contract:'matrix.appearance.preference.v1',version:1,mode:m,revision:'v1:'+m,auto_policy:'os-browser',state:'valid'});
let serverMode='light', posts=0, hold=null, slowGet=false, authDenied=false;
window.fetch=async(url,opts)=>{if(opts.method==='POST'){posts++;if(hold)await hold.promise;return {ok:true,status:200,json:async()=>snap(serverMode)}}if(slowGet)await new Promise(r=>setTimeout(r,100));return {ok:!authDenied,status:authDenied?403:200,json:async()=>authDenied?{code:'denied'}:snap(serverMode)}};
const media={matches:false, listeners:[],addEventListener(t,f){this.listeners.push(f)}};window.matchMedia=()=>media;
`;
const run = `(async()=>{await new Promise(r=>setTimeout(r,20));const sel=()=>document.querySelector('.mmed-appearance-v1 select'),btn=()=>document.querySelector('.mmed-appearance-v1 button'),live=()=>document.querySelector('.mmed-appearance-v1 [role=status]');
check(document.documentElement.getAttribute('data-mmed-dashboard-appearance')==='light','initial light');
check(document.querySelectorAll('.mmed-appearance-v1').length===1,'one control');
check(getComputedStyle(document.querySelector('.mmdv2-h1')).color==='rgb(20, 42, 64)','Light title readable');
check(getComputedStyle(document.querySelector('#other-owner')).color==='rgb(18, 52, 86)','other owner untouched');
check(document.documentElement.scrollWidth<=innerWidth,'viewport reflow');
check(btn().getBoundingClientRect().height>=44&&sel().getBoundingClientRect().height>=44,'touch targets');
sel().value='auto';sel().dispatchEvent(new Event('change'));document.querySelector('.mmdv2-top').appendChild(document.createElement('span'));await new Promise(r=>setTimeout(r,10));check(sel().value==='auto','ordinary observer preserves draft');
serverMode='auto';btn().click();btn().click();await new Promise(r=>setTimeout(r,20));check(posts===1,'single deliberate in-flight save');check(sel().value==='auto','confirmed chooser');media.matches=true;media.listeners.forEach(f=>f());check(document.documentElement.getAttribute('data-mmed-dashboard-appearance')==='dark','native Auto follows OS');
serverMode='light';document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,20));check(sel().value==='light','foreground chooser refreshed');media.matches=true;media.listeners.forEach(f=>f());check(document.documentElement.getAttribute('data-mmed-dashboard-appearance')==='light','explicit Light ignores OS');
slowGet=true;document.dispatchEvent(new Event('visibilitychange'));check(getComputedStyle(document.querySelector('.mmdv2')).visibility==='visible','slow foreground remains usable');await new Promise(r=>setTimeout(r,120));slowGet=false;
hold={};hold.promise=new Promise(r=>hold.resolve=r);serverMode='dark';sel().value='dark';btn().click();window.dispatchEvent(new Event('pagehide'));const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});window.dispatchEvent(restored);check(!window.mmedAppearanceV1.snapshot&&btn().disabled,'pending restore clears stale preference');check(getComputedStyle(document.querySelector('.mmdv2')).visibility==='visible','restore not blank');hold.resolve();await new Promise(r=>setTimeout(r,40));hold=null;check(sel().value==='dark'&&!btn().disabled,'deferred restore reconciles after save');
authDenied=true;window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(restored);await new Promise(r=>setTimeout(r,20));check(!window.mmedAppearanceV1.snapshot&&btn().disabled,'new auth context never seeds old preference');check(document.documentElement.getAttribute('data-mmed-dashboard-appearance')==='dark','auth denial safe dark');
document.getElementById('results').textContent=JSON.stringify({pass:true,count:window.results.length,labels:window.results,viewport:[innerWidth,innerHeight]});
})().catch(e=>{document.getElementById('results').textContent=JSON.stringify({pass:false,error:e.message,labels:window.results})});`;
const head = fs.readFileSync(headFile, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><title>Synthetic appearance test, no student account</title><style>body{margin:0}#student-os-root{padding:34px 38px 62px}#other-owner{color:#123456}</style><style>${baseCss}</style><script>${tests}</script>${head}<div id="student-os-root"><div id="sos-content"><div class="mmdv2"><div class="mmdv2-in"><div class="mmdv2-top"></div><h1 class="mmdv2-h1">Synthetic Dashboard</h1><p class="mmdv2-lede">Appearance fixture only.</p><div class="mmdv2-panel"><div class="mmdv2-pbody"><p class="mmdv2-empty">Readable native panel.</p></div></div></div></div></div></div><div id="other-owner">Independent owner fixture</div><pre id="results">PENDING</pre><script>${js}</script><script>${run}</script>`;
fs.writeFileSync(path.join(fixture, 'fixture.html'), html);
// Native macOS headless window flags impose a 500px minimum and subtract chrome.
// CDP metrics explicitly establish and verify the exact required CSS viewport.
async function browserFixture(width, height) {
  const child = cp.spawn(chrome, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${path.join(fixture, 'cdp-profile-'+width)}`,'about:blank'], { stdio:['ignore','ignore','pipe'] });
  let ws;
  try {
    const endpoint = await new Promise((resolve,reject) => {
      let stderr=''; const timer=setTimeout(()=>reject(Error('isolated Chrome startup timeout')),10000);
      child.stderr.on('data', chunk => {stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
      child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('isolated Chrome exited '+code));});
    });
    ws = new WebSocket(endpoint); await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    let sequence=0;const pending=new Map();
    ws.addEventListener('message', event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
    const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
    const target=await call('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
    await call('Page.enable',{},sessionId);
    await call('Page.navigate',{url:'file://'+path.join(fixture,'fixture.html')},sessionId);
    let value;
    for(let i=0;i<80;i++){
      const state=await call('Runtime.evaluate',{expression:'document.getElementById("results")?.textContent',returnByValue:true},sessionId);
      const output=state.result?.value;
      if(output&&output!=='PENDING'){value=JSON.parse(output);break;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(value,'browser fixture completed');assert.ok(value.pass,JSON.stringify(value));assert.deepEqual(value.viewport,[width,height]);
    console.log('NATIVE_BROWSER_FIXTURE_PASS',width,height,value.count,'assertions; not student evidence');
    await call('Browser.close');
  } finally { if(ws)ws.close();child.kill(); }
}
(async()=>{
  for(const [width,height] of [[390,844],[1440,900],[320,800]])await browserFixture(width,height);
  console.log('APPEARANCE_LOCAL_CONTRACT_PASS',crypto.createHash('sha256').update(fs.readFileSync(backend)).digest('hex'));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
