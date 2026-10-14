const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const target=path.resolve(__dirname,'../../../../mu-plugins/missionmed-matrix-avatar-projection.php');
const source=fs.readFileSync(target,'utf8');
const identity=execFileSync('git',['show','c340a3a87732f7dc4afb06c01e4586239a050495:wp-content/plugins/missionmed-hub/includes/class-mmed-supabase-bridge.php'],{encoding:'utf8'}).replace(/^<\?php/,'');
const sso=execFileSync('git',['show','9333b47a5e97076fe45e983ae7e66d12f25cef75:wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php'],{encoding:'utf8'});
const projection=sso.slice(sso.indexOf('function mmsf_safe_arena_avatar_url('),sso.indexOf('function mmsf_issue_jwt('));
const dashboardCss=execFileSync('git',['show','9bd0cbc304013bcf8f9d855991f5604aee731d97:wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.css'],{encoding:'utf8'});
assert.equal(require('node:crypto').createHash('sha256').update(dashboardCss).digest('hex'),'d5bac8d5fbdbe67369d2ff54b50def51dca4a7240513ecdd6af0cf94310e46c7');
const uuid='11111111-1111-4111-8111-111111111111',avatar='22222222-2222-4222-8222-222222222222';
const full='https://cdn.missionmedinstitute.com/test/full-body.png';
function phpCase(options={}) {
  const c={subject:7,nonce:true,cache:uuid,rows:[{id:avatar,user_id:uuid,is_active:true,avatar_url:full,thumbnail_url:'https://cdn.missionmedinstitute.com/test/face.png'}],post:{action:'mmed_gx_avatar_v1',nonce:'test'},...options};
  const code=`define('ABSPATH','/');define('MMED_SUPABASE_URL','https://example.invalid');define('MMED_SUPABASE_SERVICE_KEY','synthetic-test-only');
  $c=json_decode(base64_decode('${Buffer.from(JSON.stringify(c)).toString('base64')}'),true);$calls=[];$hooks=[];
  class ResponseDone extends Exception {}
  function add_action($name,$callback,$priority=10){global $hooks;$hooks[]=$name;}
  function get_current_user_id(){global $c;return $c['subject'];}
  function check_ajax_referer(){global $c;return $c['nonce'];}
  function nocache_headers(){}
  function wp_send_json_success($data){global $calls,$hooks;echo json_encode(['success'=>true,'data'=>$data,'calls'=>$calls,'hooks'=>$hooks]);throw new ResponseDone;}
  function wp_send_json_error($data,$status){global $calls;echo json_encode(['success'=>false,'status'=>$status,'calls'=>$calls]);throw new ResponseDone;}
  function sanitize_text_field($v){return trim((string)$v);}
  function get_user_meta($subject,$key,$single){global $c,$calls;if($subject!==$c['subject'])throw new Exception('CROSS_SUBJECT');$calls[]='current-user-meta';return $c['cache'];}
  function get_user_by(){global $calls;$calls[]='FORBIDDEN_AUTH_LOOKUP';throw new Exception('AUTH_LOOKUP_FORBIDDEN');}
  function update_user_meta(){global $calls;$calls[]='FORBIDDEN_IDENTITY_WRITE';throw new Exception('IDENTITY_WRITE_FORBIDDEN');}
  function absint($v){return abs((int)$v);}
  function esc_url_raw($v,$schemes){return $v;}
  function wp_parse_url($url,$component=-1){return parse_url($url,$component);}
  function apply_filters($name,$value){return $value;}
  function untrailingslashit($v){return rtrim($v,'/');}
  function add_query_arg($q,$url){return $url.'?'.http_build_query($q);}
  function wp_remote_get($url,$args){global $c,$calls;$calls[]=['url'=>$url,'timeout'=>$args['timeout']];return ['body'=>json_encode($c['rows'])];}
  function wp_remote_retrieve_response_code(){return 200;}
  function wp_remote_retrieve_body($r){return $r['body'];}
  function is_wp_error(){return false;}
  ${identity}
  ${projection}
  $_POST=$c['post'];$_GET=[];$_SERVER['REQUEST_METHOD']='POST';include ${JSON.stringify(target)};
  try{mmed_gx_avatar_projection();}catch(ResponseDone $done){}`;
  return JSON.parse(execFileSync('php',['-r',code],{encoding:'utf8'}));
}
(async()=>{
  let r=phpCase();assert.equal(r.data.imageUrl,full);assert.equal(r.data.activeAvatarId,avatar);
  assert.equal(r.calls.filter(c=>typeof c==='object').length,1);
  assert.match(r.calls.find(c=>typeof c==='object').url,/user_id=in\.%28.*is_active=eq.true/);
  assert.equal(r.calls.find(c=>typeof c==='object').timeout,12);
  assert.deepEqual(r.hooks,['wp_ajax_mmed_gx_avatar_v1','wp_footer']);
  for(const options of [{subject:0},{nonce:false},{post:{action:'mmed_gx_avatar_v1',nonce:'test',user_id:8}}]) {
    r=phpCase(options);assert.equal(r.success,false);assert.equal(r.calls.length,0);
  }
  for(const cache of ['', 'none', 'not-a-uuid']) {
    r=phpCase({cache});assert.equal(r.data.available,false);assert.deepEqual(r.calls,['current-user-meta']);
  }
  for(const row of [null,{id:avatar,user_id:'33333333-3333-4333-8333-333333333333',is_active:true,avatar_url:full,thumbnail_url:full},
    {id:avatar,user_id:uuid,is_active:false,avatar_url:full,thumbnail_url:full},
    ...['https://evil.invalid/a.png','https://cdn.missionmedinstitute.com:443/a.png','https://user@cdn.missionmedinstitute.com/a.png','https://cdn.missionmedinstitute.com/a.png?q=x'].map(url=>({id:avatar,user_id:uuid,is_active:true,avatar_url:url,thumbnail_url:full}))]) {
    r=phpCase({rows:row?[row]:[]});assert.equal(r.data.available,false);
  }
  assert.match(source,/Cache-Control: private, no-store/);assert.doesNotMatch(source,/wp_ajax_nopriv/);
  const phpBase=`define('ABSPATH','/');function add_action(){}function is_user_logged_in(){return true;}function wp_parse_url($u,$c){return parse_url($u,$c);}function admin_url(){return 'https://matrix.test/wp-admin/admin-ajax.php';}function wp_create_nonce(){return 'synthetic';}function wp_json_encode($v,$flags){return json_encode($v,$flags);}$_SERVER['REQUEST_URI']='/member-dashboard/';include ${JSON.stringify(target)};mmed_gx_avatar_dashboard();`;
  const emitted=execFileSync('php',['-r',phpBase],{encoding:'utf8'});
  for(const alter of [s=>s.replace("return true;","return false;"),s=>s.replace("REQUEST_URI']='/member-dashboard/'","REQUEST_URI']='/arena/'")])assert.equal(execFileSync('php',['-r',alter(phpBase)],{encoding:'utf8'}),'');
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page=await browser.newPage();let requests=0;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const hero='<div class="mmdv2-hero"><h1 class="mmdv2-h1">Welcome back. <em>Where can I take you today?</em></h1><p class="mmdv2-lede">Your next step, clearly.</p><div class="mmdv2-launcher"><input aria-label="Existing search"><button>Go</button></div><div class="mmdv2-chips"><button>Existing action</button></div></div>';
  const css='<style>body{margin:0;background:#091522;color:#f4f6fa;font-family:Arial}.mmdv2-in{padding:24px;box-sizing:border-box;max-width:1050px;margin:auto}.mmdv2-h1 em{display:block}.mmdv2-launcher{display:flex}input{min-width:0;flex:1}button,input{padding:10px}</style><style>'+dashboardCss+'</style>';
  let result={success:true,data:{version:1,available:true,imageUrl:full}};
  await page.route('https://matrix.test/**',route=>{if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:css+'<div id="student-os-root"><main class="mmdv2-in">'+hero+'</main></div><script>window.mmedDashboardV2={experience:"matrix2"};window.originalSearch=document.querySelector("input");window.searchClicks=0;originalSearch.addEventListener("click",()=>searchClicks++);</script>'+emitted});requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});});
  await page.route('https://cdn.missionmedinstitute.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><rect x="50" y="10" width="60" height="300" rx="20" fill="#d5b777"/></svg>'}));
  await page.goto('https://matrix.test/member-dashboard/');
  await page.locator('.mmed-gx-avatar img').waitFor();assert.equal(requests,1);
  for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]) {
    await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('.mmed-gx-avatar img').evaluate(i=>getComputedStyle(i).objectFit),'contain');
    await page.getByRole('textbox',{name:'Existing search'}).click();
    assert.equal(await page.evaluate(()=>document.querySelector('input')===originalSearch),true);
    if(process.env.GX_EVIDENCE_DIR){fs.mkdirSync(process.env.GX_EVIDENCE_DIR,{recursive:true});await page.locator('.mmdv2-hero').screenshot({path:path.join(process.env.GX_EVIDENCE_DIR,`avatar-contract-${viewport.width}.png`)});}
  }
  assert.equal(await page.evaluate(()=>searchClicks),3);
  await page.evaluate(html=>document.querySelector('.mmdv2-in').innerHTML=html,hero);await page.locator('.mmed-gx-avatar img').waitFor();assert.equal(requests,1);
  await page.locator('.mmed-gx-avatar img').dispatchEvent('error');
  assert.equal(await page.locator('.mmed-gx-avatar,[data-gx-avatar]').count(),0);
  for(const data of [{version:1,available:false},{version:2,available:true,imageUrl:full},{version:1,available:true,imageUrl:'https://evil.invalid/a.png'}]){
    result={success:true,data};await page.reload();await page.waitForTimeout(100);assert.equal(await page.locator('.mmed-gx-avatar').count(),0);assert.equal(await page.getByRole('textbox').count(),1);
  }
  await page.unroute('https://matrix.test/**');
  await page.route('https://matrix.test/**',route=>route.fulfill({contentType:'text/html',body:css+'<div id="student-os-root"><main class="mmdv2-in">'+hero+'</main></div><script>window.mmedDashboardV2={experience:"classic"};window.fetch=()=>{throw new Error("CLASSIC_FETCH_FORBIDDEN")};</script>'+emitted}));
  await page.reload();await page.waitForTimeout(50);assert.equal(await page.locator('.mmed-gx-avatar').count(),0);
  assert.deepEqual(errors,[]);await browser.close();
  console.log('PASS: pinned real identity/helper privacy path, anonymous/nonce/subject denial, cold-cache no remote/write, active/current-subject/full-body only, safeCDN, no-store, route/Classic isolation, singlefetch, rerender, retained controls, no-avatar fallback, desktop/tablet/390x844 and reducedmotion. Synthetic imagery only; not real student acceptance.');
})().catch(e=>{console.error(e);process.exit(1);});
