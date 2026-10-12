<?php
// Loopback-only synthetic harness. Never include this file in production.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'], true) || !preg_match('/^(127\.0\.0\.1|localhost)(:\d+)?$/', $_SERVER['HTTP_HOST']??'')) {http_response_code(403);exit;}
$base=dirname(__DIR__,2).'/wp-content/mu-plugins/missionmed-ivprep-live-arena/';
if(preg_match('#^/classroom-avatars/(doctor-female-0[1-6]|doctor-male-0[12]|superhero-female-0[12])\.webp$#',$path,$m)){header('Content-Type: image/webp');readfile(dirname(__DIR__,2).'/wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/'.$m[1].'.webp');exit;}
if ($path==='/recorder.js') {header('Content-Type: text/javascript');readfile($base.'recorder.js');exit;}
if ($path==='/capture-proof') {
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src blob:; connect-src 'self'; frame-ancestors 'none'");
echo <<<'HTML'
<!doctype html><html><meta charset="utf-8"><title>Arena • local capture proof</title><style>body{font:18px system-ui;background:#101b2e;color:#e8edf6;max-width:900px;margin:50px auto}button,a{padding:14px;margin:6px}video{width:100%;background:#000}pre{white-space:pre-wrap}meter{width:250px}label{display:block;padding:8px}</style>
<h1>IV Prep Arena · capture proof</h1><p>Local test only. Select the Webex window and its audio. No media leaves this browser. Use headphones.</p>
<p>Test session: synthetic proof · Student: Test Student A</p><button id="start">Start Interview</button><button id="end" disabled>End Interview</button>
<label>Incoming capture audio <meter id="incoming" max="0.2"></meter></label><label>Instructor microphone <meter id="mic" max="0.2"></meter></label>
<pre id="status">Ready. Both voices require actual playback verification.</pre><video id="video" controls playsinline></video><p><a id="save" hidden>Save recording locally</a></p>
<p>Do not close this tab until the file is saved. A browser playback URL does not survive reload.</p>
<script type="module">
import {ArenaRecorder} from '/recorder.js';
let recorder,url,unsaved=false;
const $=id=>document.getElementById(id);const status=s=>$('status').textContent=s;
async function show(result){if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(result.blob);$('video').src=url;$('save').href=url;$('save').download='arena-proof-test-student-a-'+new Date().toISOString().replaceAll(':','-')+'.webm';$('save').hidden=false;unsaved=true;status(`Finalized ${result.bytes} bytes in ${result.finalizeMs} ms. ${result.interrupted?'INTERRUPTED: '+result.reason:'Play and verify video and BOTH voices.'}`);$('end').disabled=true;$('start').disabled=false;}
$('start').onclick=async()=>{if(unsaved){status('Save the existing clip and reload before another recording.');return;}$('start').disabled=true;recorder=new ArenaRecorder(status,levels=>{$('incoming').value=levels[0];$('mic').value=levels[1];});recorder.onInterrupted=show;try{const evidence=await recorder.prepare();recorder.start();status('Recording locally. '+JSON.stringify(evidence));$('end').disabled=false;}catch(e){status(e.message);$('start').disabled=false;}};
$('end').onclick=async()=>{try{$('end').disabled=true;await show(await recorder.stop());}catch(e){status(e.message);}};
$('save').onclick=()=>{unsaved=false;};window.onbeforeunload=e=>{if(unsaved||['permission','ready','recording','finalizing','closing'].includes(recorder?.phase)){e.preventDefault();e.returnValue='';}};
</script></html>
HTML;
exit;
}

if(preg_match('#^/(arena\.js|arena\.css)$#',$path,$m)){header('Content-Type: '.(str_ends_with($path,'.js')?'text/javascript':'text/css'));readfile($base.$m[1]);exit;}
$store=sys_get_temp_dir().'/ivprep-arena-local-'.getmyuid();if(!is_dir($store))mkdir($store,0700,true);
ini_set('session.save_path',$store);session_name('ivprep_fixture');session_set_cookie_params(['httponly'=>true,'samesite'=>'Strict']);session_start();
header('Cache-Control: no-store');header('X-Frame-Options: DENY');
if($_SERVER['REQUEST_METHOD']==='POST'&&isset($_SERVER['HTTP_ORIGIN'])&&!in_array($_SERVER['HTTP_ORIGIN'],['http://127.0.0.1:8766','http://localhost:8766'],true)){http_response_code(403);exit;}
if($path==='/login'&&$_SERVER['REQUEST_METHOD']==='POST'){
 session_regenerate_id(true);$_SESSION['role']=($_POST['role']??'')==='admin'?'admin':'student';$_SESSION['nonce']=bin2hex(random_bytes(24));header('Location: /');exit;
}
if($path==='/'&&($_SESSION['role']??'')!=='admin'){
 echo '<!doctype html><title>Arena local test access</title><h1>IV Prep Arena · local synthetic harness</h1><p>This test login grants no production access.</p><form method="post" action="/login"><button name="role" value="admin">Enter as test instructor</button><button name="role" value="student">Enter as test student</button></form>';exit;
}
if($path==='/'){$config=['api'=>'/api','nonce'=>$_SESSION['nonce'],'assets'=>'/','local'=>true];require $base.'view.php';exit;}
if($path!=='/api'){http_response_code(404);exit;}
header('Content-Type: application/json');
if(($_SESSION['role']??'')!=='admin'||!hash_equals($_SESSION['nonce']??'',$_SERVER['HTTP_X_WP_NONCE']??'-')){http_response_code(403);echo json_encode(['message'=>'Instructor access and valid nonce required.']);exit;}
session_write_close();
require_once $base.'state.php';
try{
 $op=$_GET['op']??'';$id=$_GET['id']??'';$body=json_decode(file_get_contents('php://input'),true);
 $groups=[['id'=>'1','group_name'=>'TEST · Session A'],['id'=>'2','group_name'=>'TEST · Session B']];
 if($_SERVER['REQUEST_METHOD']==='GET'&&$op==='groups'){$result=['groups'=>$groups];}
 elseif($_SERVER['REQUEST_METHOD']==='GET'&&$op==='sessions'){$items=[];foreach(glob($store.'/arena-*.json') as $f){$x=json_decode(file_get_contents($f),true);if(is_array($x))$items[]=['id'=>$x['id'],'label'=>$x['label'],'class_id'=>$x['class_id']];}$result=['sessions'=>array_slice(array_reverse($items),0,50)];}
 else{
  if($op==='create')$id=$body['id']??'';if(!MMED_IVPrep_Arena_State::uuid($id))throw new RuntimeException('Invalid session ID.',422);
  $file=$store.'/arena-'.$id.'.json';$lock=fopen($file.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Storage lock unavailable.',503);
  try{
   $state=is_file($file)?json_decode(file_get_contents($file),true):null;
   if($_SERVER['REQUEST_METHOD']==='GET'){if(!$state)throw new RuntimeException('Session not found.',404);$next=$state;}
   elseif($op==='create'){
    if(!in_array($body['class_id']??'',['1','2'],true))throw new RuntimeException('Invalid class.',422);
    if($state){if($state['class_id']!==$body['class_id']||$state['label']!==$body['label'])throw new RuntimeException('Session ID conflict.',409);$next=$state;}
    else $next=MMED_IVPrep_Arena_State::create($id,$body['class_id'],[['id'=>'101','name'=>'Test Student A'],['id'=>'102','name'=>'Test Student B'],['id'=>'103','name'=>'Test Student C']],1,$body['label']??'');
   }else{if(!$state)throw new RuntimeException('Session not found.',404);$next=MMED_IVPrep_Arena_State::apply($state,$body,1);}
   if($_SERVER['REQUEST_METHOD']==='POST'){
    if(($_SERVER['HTTP_X_TEST_FAIL_SAVE']??'')==='1')throw new RuntimeException('Simulated failed persistence.',503);
    $temp=$file.'.tmp';$encoded=json_encode($next,JSON_THROW_ON_ERROR);if(file_put_contents($temp,$encoded)!==strlen($encoded)||!rename($temp,$file))throw new RuntimeException('Save failed.',503);chmod($file,0600);
   }
   $result=MMED_IVPrep_Arena_State::public_state($next);
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 echo json_encode($result,JSON_THROW_ON_ERROR);
}catch(Throwable $e){$code=$e->getCode();http_response_code($code>=400&&$code<=599?$code:500);echo json_encode(['message'=>$e->getMessage()]);}
