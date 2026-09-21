<?php
/** Synthetic-only revision security tests; never sends provider traffic. */
require __DIR__ . '/m2-runtime.php';
function absint($value) { return abs((int)$value); }
function sanitize_text_field($value) { return (string)$value; }
function get_current_user_id() { return 1; }
function rest_ensure_response($value) { return $value; }
class MMPS_Tiers { public static function plan($bundle, $prefs, $tier) { return $GLOBALS['plan']; } }
class MMPS_Similarity {
 const VERSION='fixture';
 public static $status='CLEAR', $calls=0;
 public static function assess($uid, $text) { self::$calls++; return array('status'=>self::$status,'band'=>'NONE','fingerprint'=>array()); }
}
class MMPS_Store {
 public static $roots=array(), $runs=array(), $edits=array(), $audit=array(), $n=0;
 public static $lockCalls=0;
 public static function with_review_lock($uid,$run,$callback) { self::$lockCalls++; return $callback(); }
 public static function get_run($uid,$uuid) { return self::$runs[$uid][$uuid]??null; }
 public static function get_root($uid,$id) { return self::$roots[$uid][$id]??null; }
 public static function edit_head($uid,$run,$candidate) { $head=null; foreach(self::$edits[$uid]??array() as $r) { if($r['run']===$run && $r['revision']['candidateId']===$candidate) $head=$r['revision']; } return $head; }
 public static function edit_request($uid,$request) { return self::$edits[$uid][$request]??null; }
 public static function insert_edit($uid,$run,$request,$hash,$revision) { $head=self::edit_head($uid,$run,$revision['candidateId']); if(($head['id']??'')!==$revision['baseRevisionId'] || isset(self::$edits[$uid][$request])) return false; self::$edits[$uid][$request]=array('hash'=>$hash,'run'=>$run,'revision'=>$revision); return true; }
 public static function uuid() { return sprintf('00000000-0000-4000-8000-%012d',++self::$n); }
 public static function now() { return '2026-09-21 12:00:00'; }
 public static function audit($uid,$event,$ref,$detail) { self::$audit[]=array($event,$detail); }
 public static function find_document_by_run($uid,$id) { return null; }
}
require $plugin . 'class-mmps-edit.php';
require $plugin . 'class-mmps-rest.php';

$root['prefs']=array(); $root['textSha256']=MMPS_Region::text_hash($paragraphs);
$uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$run=array('id'=>1,'root_id'=>$root['id'],'run_uuid'=>$uuid,'status'=>'OK','output'=>$set,'bundle'=>$bundle,'tier_requested'=>'ESSENTIAL','strategy_key'=>'BALANCED_QUIET_SPECIFIC','validation'=>$validation+array('region'=>MMPS_Generator::region_snapshot($root)));
MMPS_Store::$runs[1][$uuid]=$run; MMPS_Store::$roots[1][$root['id']]=$root;
$original=MMPS_Generator::candidate_by_id($set,'BALANCED_QUIET_SPECIFIC');
$originalHash=hash('sha256',wp_json_encode($run));
$request=array('candidateId'=>'BALANCED_QUIET_SPECIFIC','text'=>'Lakeview Internal Medicine Residency guarantees every graduate a cardiology fellowship.','action'=>'SAVE','baseRevisionId'=>'','requestId'=>MMPS_Store::uuid());
$saved=MMPS_Edit::write(1,$uuid,$request);
check(!is_wp_error($saved),'arbitrary edit persists only as private draft');
$rev=$saved['revision'];
check($rev['validation']['status']==='NEEDS_REVIEW' && !$rev['validation']['canApprove'],'unsupported changed claim never passes grounding');
check($rev['validation']['segments']===array() && $rev['validation']['factsUsed']===array(),'changed text inherits no verified annotations');
check($rev['validation']['rootIntegrity']==='PASS','only authorized region reconstructed');
check(hash('sha256',wp_json_encode(MMPS_Store::$runs[1][$uuid]))===$originalHash,'immutable AI candidates and provenance untouched');
check(MMPS_Edit::write(1,$uuid,$request)['alreadySaved']===true,'same request idempotently returns same revision');
$collision=$request; $collision['text'].=' Changed';
check(is_wp_error(MMPS_Edit::write(1,$uuid,$collision)),'idempotency-key payload collision rejected');
$stale=$request; $stale['requestId']=MMPS_Store::uuid();
check(is_wp_error(MMPS_Edit::write(1,$uuid,$stale)),'stale parent CAS rejected');
check(is_wp_error(MMPS_Edit::read(2,$uuid)) && is_wp_error(MMPS_Edit::write(2,$uuid,$request)),'cross-student read and write fail closed');
check(is_wp_error(MMPS_Edit::for_library(1,$run,$original,'')),'omitted edited revision rejected by library resolver');
check(is_wp_error(MMPS_Edit::for_library(1,$run,$original,$rev['id'])),'unsupported exact saved revision cannot be approved');
$injected=$request; $injected['requestId']=MMPS_Store::uuid(); $injected['baseRevisionId']=$rev['id']; $injected['paragraphs']=$paragraphs;
check(is_wp_error(MMPS_Edit::write(1,$uuid,$injected)),'full ROOT injection rejected');
unset($injected['paragraphs']); $injected['text']="One paragraph\nAnother paragraph";
check(is_wp_error(MMPS_Edit::write(1,$uuid,$injected)),'multiple paragraphs rejected');
$injected['text']='<script>alert(1)</script>';
check(is_wp_error(MMPS_Edit::write(1,$uuid,$injected)),'markup rejected');
$restore=array('candidateId'=>$request['candidateId'],'action'=>'RESTORE','baseRevisionId'=>$rev['id'],'requestId'=>MMPS_Store::uuid());
$restored=MMPS_Edit::write(1,$uuid,$restore);
check(!is_wp_error($restored) && $restored['revision']['text']===$original['replacement_region'],'restore retrieves immutable original server-side');
check(count(MMPS_Store::$edits[1])===2 && $restored['revision']['baseRevisionId']===$rev['id'],'restore retains history and revision chain');
check($restored['revision']['validation']['status']==='VALIDATED','exact restored AI text freshly revalidated');
$resolved=MMPS_Edit::for_library(1,$run,$original,$restored['revision']['id']);
check(!is_wp_error($resolved) && $resolved['revisionId']===$restored['revision']['id'],'exact restored revision eligible for ordinary synthetic save');
check(is_wp_error(MMPS_Edit::for_library(1,$run,$original,$rev['id'])),'older saved revision cannot be approved');
$similarityCalls=MMPS_Similarity::$calls;
$heads=MMPS_Edit::read(1,$uuid);
check($heads['capabilities']['canEdit'] && count((array)$heads['heads'])===5,'read exposes owner scoped heads and capabilities for all five');
check(MMPS_Similarity::$calls===$similarityCalls,'GET is genuinely read only and cannot invoke similarity backfill');
MMPS_Store::$roots[1][$root['id']]['paragraphs'][0].=' drift';
check(is_wp_error(MMPS_Edit::read(1,$uuid)) && is_wp_error(MMPS_Edit::write(1,$uuid,$restore)),'protected ROOT drift blocks reads and writes');
MMPS_Store::$roots[1][$root['id']]=$root;
MMPS_Store::$roots[1][$root['id']]['region']['paragraphIndex']=0;
check(is_wp_error(MMPS_Edit::write(1,$uuid,$restore)),'changed authorized region blocks revision');
MMPS_Store::$roots[1][$root['id']]=$root;
MMPS_Store::$roots[1][$root['id']]['isSynthetic']=false;
check(is_wp_error(MMPS_Edit::read(1,$uuid)),'unapproved real ROOT cannot gain manual-edit access');
MMPS_Store::$roots[1][$root['id']]=$root;
MMPS_Similarity::$status='EXACT_BLOCKED';
check(is_wp_error(MMPS_Edit::for_library(1,$run,$original,$restored['revision']['id'])),'fresh cross-student similarity failure prevents exact-revision approval');
check(strpos(wp_json_encode(MMPS_Store::$audit),'guarantees')===false,'edit audits never include paragraph text');
MMPS_Similarity::$status='CLEAR';
// A fictional ROOT binds the same exact canary mechanism; no real-student prose fixture.
define('MMED_PS_PROTO_REAL_ROOT_CANARY_USER_ID',1);
define('MMED_PS_PROTO_REAL_ROOT_CANARY_ROOT_SHA256',$root['textSha256']);
define('MMED_PS_PROTO_REAL_ROOT_CANARY_SPECIALTY','Internal Medicine');
define('MMED_PS_PROTO_REAL_ROOT_CANARY_REGION_INDEX',2);
define('MMED_PS_PROTO_REAL_ROOT_CANARY_PROGRAM_ID','rise_ps_canary_fixture');
MMPS_Store::$roots[1][$root['id']]['isSynthetic']=false;
MMPS_Store::$runs[1][$uuid]['program_specialty_id']='rise_ps_canary_fixture';
$canaryHeads=MMPS_Edit::read(1,$uuid);
check(!is_wp_error($canaryHeads) && $canaryHeads['capabilities']['canEdit'] && !$canaryHeads['capabilities']['canApprove'],'exact canary permits private drafts but not library approval');
$canarySave=$restore; $canarySave['baseRevisionId']=$restored['revision']['id']; $canarySave['requestId']=MMPS_Store::uuid();
$canarySaved=MMPS_Edit::write(1,$uuid,$canarySave);
check(!is_wp_error($canarySaved) && !$canarySaved['revision']['validation']['canApprove'],'restored exact canary revision remains review only');
class EditTestRequest extends ArrayObject { private $params; public function __construct($params) { parent::__construct(); $this->params=$params; } public function get_json_params() { return $this->params; } }
$canaryLibrary=MMPS_Rest::save(new EditTestRequest(array('runId'=>$uuid,'candidateId'=>$original['candidate_id'],'editRevisionId'=>$canarySaved['revision']['id'],'status'=>'APPROVED')));
check(is_wp_error($canaryLibrary) && $canaryLibrary->get_error_code()==='mmps_canary_review_only','real canary library save still explicitly denied');
MMPS_Store::$runs[1][$uuid]['program_specialty_id']='rise_ps_different_fixture';
check(is_wp_error(MMPS_Edit::read(1,$uuid)),'canary second program edit access denied');
check(!defined('MMED_PS_PROTO_ALLOW_REAL_ROOT_AI'),'broad real-student AI gate remains undefined');
MMPS_Store::$roots[1][$root['id']]=$root;
$legacy=$run; $legacy['output']=$original; $legacy['validation']['blocking']=array();
MMPS_Store::$runs[1][$uuid]=$legacy;
$legacyRead=MMPS_Edit::read(1,$uuid);
check(!is_wp_error($legacyRead) && !$legacyRead['capabilities']['canEdit'] && $legacyRead['capabilities']['canApprove'],'legacy M1 original retains review/approval capability without edit capability');
check(is_wp_error(MMPS_Edit::write(1,$uuid,$request)),'legacy M1 manual edits rejected');
check(MMPS_Store::$lockCalls>0,'edit and canary library writes enter shared atomic boundary');
fwrite(STDOUT,"PSV UX EDIT RUNTIME: PASS ({$passes} total assertions including baseline)\n");
