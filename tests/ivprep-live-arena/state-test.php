<?php
require dirname(__DIR__,2).'/wp-content/mu-plugins/missionmed-ivprep-live-arena/state.php';
$n=0;function ok($v,$name){global $n;if(!$v)throw new Exception('FAIL '.$name);$n++;echo "PASS $name\n";}
function id(){return sprintf('%08x-0000-4000-8000-%012x',random_int(1,2147483647),random_int(1,2147483647));}
function cmd($s,$type,$data=[],$rid=null){return ['type'=>$type,'request_id'=>$rid??id(),'version'=>$s['version']]+$data;}
function fail($fn,$name,$code=422){try{$fn();}catch(RuntimeException $e){ok($e->getCode()===$code,$name);return;}throw new Exception('Expected failure '.$name);}
$s=MMED_IVPrep_Arena_State::create(id(),'1',[['id'=>'101','name'=>'A'],['id'=>'102','name'=>'B']],1,'Test');
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'select',['student_id'=>'101']),1),'Absent cannot be selected');
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'attendance',['student_id'=>'999','present'=>true]),1),'Foreign student rejected');
$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'attendance',['student_id'=>'101','present'=>true]),1);
$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'select',['student_id'=>'101']),1);$a=id();$start=cmd($s,'start',['student_id'=>'101','attempt_id'=>$a,'question'=>'Q']);$s=MMED_IVPrep_Arena_State::apply($s,$start,1);
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'select',['student_id'=>'102']),1),'Cannot switch student mid interview',409);
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'award',['attempt_id'=>$a,'points'=>2]),1),'Active interview cannot score',409);
$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'finish',['attempt_id'=>$a,'status'=>'finalized','bytes'=>123,'duration'=>5,'finalize_ms'=>3,'sha256'=>str_repeat('a',64)]),1);
$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'review',['attempt_id'=>$a,'both_voices_and_video'=>true]),1);
$award=cmd($s,'award',['attempt_id'=>$a,'points'=>5]);$s=MMED_IVPrep_Arena_State::apply($s,$award,1);$version=$s['version'];
$replay=MMED_IVPrep_Arena_State::apply($s,$award,1);ok($replay===$s,'Exact replay unchanged');
$altered=$award;$altered['points']=6;fail(fn()=>MMED_IVPrep_Arena_State::apply($s,$altered,1),'Request collision rejected',409);
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,$award,2),'Actor collision rejected',409);
$stale=cmd($s,'select',['student_id'=>'101']);$stale['version']=0;fail(fn()=>MMED_IVPrep_Arena_State::apply($s,$stale,1),'Stale version rejected',409);
ok($s['students']['101']['points']===5&&$s['students']['102']['points']===0,'Independent student totals');
$undo=cmd($s,'undo',['award_id'=>$award['request_id']]);$s=MMED_IVPrep_Arena_State::apply($s,$undo,1);ok($s['students']['101']['points']===0&&count($s['events'])===$version+1,'Undo keeps compensating history');
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'undo',['award_id'=>$award['request_id']]),1),'Double undo rejected',409);
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'award',['attempt_id'=>$a,'points'=>11]),1),'Bounded points');
$b=id();$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'start',['student_id'=>'101','attempt_id'=>$b]),1);$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'finish',['attempt_id'=>$b,'status'=>'failed','bytes'=>0,'duration'=>0,'finalize_ms'=>0,'sha256'=>'']),1);
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'review',['attempt_id'=>$b,'both_voices_and_video'=>true]),1),'Failed recording cannot be reviewed');
ok(!isset(MMED_IVPrep_Arena_State::public_state($s)['requests']),'Request fingerprints private');
echo "$n assertions passed\n";

// Classroom adaptation boundaries: isolated team assignment and passive meeting selection.
ok($s['students']['101']['team']==='blue'&&$s['students']['102']['team']==='red','Stable initial teams');
$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'team',['student_id'=>'101','team'=>'red']),1);
ok($s['students']['101']['team']==='red'&&$s['students']['101']['points']===0,'Team move preserves individual score');
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'team',['student_id'=>'999','team'=>'red']),1),'Foreign team assignment rejected');
foreach(['https://webex.com.evil.example/','javascript:alert(1)','http://site.webex.com/','https://user:secret@site.webex.com/'] as $url)fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'meeting',['url'=>$url]),1),'Unsafe meeting URL rejected');
$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'meeting',['url'=>'https://example.webex.com/meet/class']),1);
ok($s['meeting_url']==='https://example.webex.com/meet/class','Meeting link stored in isolated session only');
$c=id();$s=MMED_IVPrep_Arena_State::apply($s,cmd($s,'start',['student_id'=>'101','attempt_id'=>$c]),1);
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'team',['student_id'=>'101','team'=>'blue']),1),'Team move blocked during interview',409);
fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,'meeting',['url'=>'https://example.webex.com/meet/other']),1),'Meeting switch blocked during interview',409);

forEach(['review','award','undo'] as $action)fail(fn()=>MMED_IVPrep_Arena_State::apply($s,cmd($s,$action,['attempt_id'=>$a,'points'=>1,'award_id'=>$award['request_id']]),1),'Historical '.$action.' blocked during recording',409);

// WordPress adapter boundaries with narrow stubs; not a live WordPress test.
define('ABSPATH',__DIR__);function add_action(...$a){}function current_user_can($c){return $GLOBALS['test_admin']??false;}function wp_verify_nonce($n,$action){return $n==='good';}function user_can($id,$c){return $id===1;}function get_option($key,$fallback=0){return 3893;}
class ArenaWpFixture {public $prefix='wp_',$users='wp_users',$usermeta='wp_usermeta',$posts='wp_posts',$postmeta='wp_postmeta',$last_error='';public $rows=[];function prepare($sql,...$args){return $sql;}function get_results($sql,$kind){if(!str_starts_with($sql,'SELECT'))throw new Exception('Unexpected write');return $this->rows;}}
define('ARRAY_A','ARRAY_A');require dirname(__DIR__,2).'/wp-content/mu-plugins/missionmed-ivprep-live-arena.php';
$request=new class{function get_header($name){return 'good';}};
ok(!MMED_IVPrep_Arena::permission($request),'WP adapter denies non-admin');$GLOBALS['test_admin']=true;ok((bool)MMED_IVPrep_Arena::permission($request),'WP adapter requires admin and nonce');
$bad=new class{function get_header($name){return 'bad';}};ok(!MMED_IVPrep_Arena::permission($bad),'WP adapter rejects invalid nonce');
$wpdb=new ArenaWpFixture();for($i=1;$i<=501;$i++)$wpdb->rows[]=['id'=>(string)$i,'name'=>'Fixture'];
fail(fn()=>MMED_IVPrep_Arena::roster(['enrollment_template'=>'360elite']),'Raw roster limit rejects before admin filtering');
$wpdb->rows=[['id'=>'1','name'=>'Admin'],['id'=>'101','name'=>'Student']];$rows=MMED_IVPrep_Arena::roster(['enrollment_template'=>'360elite']);ok(count($rows)===1&&$rows[0]['id']==='101','Roster excludes administrator');
echo "$n total state and adapter assertions passed\n";
