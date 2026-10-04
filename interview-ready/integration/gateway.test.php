<?php
/** Focused local fixtures. Run php gateway.test.php; native functions are mocked only in the test namespace. */
namespace {
define('ABSPATH',__DIR__);
class WP_Error { public function __construct(public $code,public $message,public $data) {} }
class WP_REST_Response {
    public $headers=[];
    public function __construct(public $data, public $status=200) {}
    public function header($key,$value) { $this->headers[$key]=$value; }
}
class wpdb {
    public $dbh,$ready=true,$sentinel='original-properties', $queries=0,$show_errors=false,$suppress_errors=false,$last_error='';
    public function __construct() { $this->dbh=new \MissionMed\InterviewReady\FixtureMysqli; }
    public function db_connect($allow_bail=true) { $GLOBALS['newConnections']++; $this->dbh=new \MissionMed\InterviewReady\FixtureMysqli; return true; }
    public function check_connection($allow_bail=true) { return $this->db_connect($allow_bail); }
    public function query($sql) {
        $this->queries++; $this->last_error='';
        if ($this->dbh->failQuery) {
            $this->dbh->alive=false; $this->last_error='fixture failure';
            if ($this->check_connection()) { $GLOBALS['retryWrites']++; return 1; }
            return false;
        }
        return 1;
    }
}
}
namespace MissionMed\InterviewReady {
use \WP_Error; use \WP_REST_Response; use \wpdb; use \RuntimeException;
function is_wp_error($x) { return $x instanceof WP_Error; }
function wp_parse_url($url,$part=-1) { return parse_url($url,$part); }
function wp_json_encode($v,$flags=0) { return json_encode($v,$flags); }
function wp_salt($scheme) { return 'local-fixture-only'; }
function home_url($p='/') { return 'https://missionmedinstitute.com'.$p; }
function get_current_user_id() { return $GLOBALS['uid']; }
function is_user_logged_in() { return $GLOBALS['uid']>0; }
function wp_verify_nonce($n,$a) { return $n==='fixture-nonce' && $a==='wp_rest'; }
function wp_create_nonce($a) { return 'fixture-nonce'; }
function wp_cache_delete($id,$group) { $GLOBALS['cacheDeletes']++; }
function add_action(...$args) {} function add_filter(...$args) {}
function wp_unslash($v) { return stripslashes($v); }
function wp_get_nav_menu_object($menu) { return $menu ? (object)['term_id'=>$menu] : false; }
function get_nav_menu_locations() { return ['primary'=>35,'member'=>57]; }
function esc_url($v) { return htmlspecialchars($v,ENT_QUOTES); }
class FixtureMysqli extends \mysqli {
    public function __construct() {}
    public $thread=7,$alive=true,$failQuery=false;
}
class FixtureResult { public function __construct(public $row) {} }
function mysqli_query($h,$sql) {
    if (!$h->alive) throw new RuntimeException('fixture disconnected');
    if (strpos($sql,'GET_LOCK')!==false) {
        if ($GLOBALS['denyLock'] || $GLOBALS['lockOwner']!==null) return new FixtureResult([$h->thread,0]);
        $GLOBALS['lockOwner']=$h->thread; return new FixtureResult([$h->thread,1]);
    }
    if (strpos($sql,'IS_USED_LOCK')!==false) return new FixtureResult([$h->thread,$GLOBALS['lockOwner']]);
    if (strpos($sql,'RELEASE_LOCK')!==false) { $GLOBALS['lockOwner']=null; $GLOBALS['releases']++; return new FixtureResult([1]); }
    throw new RuntimeException('Unexpected fixture SQL');
}
function mysqli_fetch_row($r) { return $r->row; } function mysqli_free_result($r) {}
// Minimal real wpdb retry branch, as independently read from the owner's live source.
function get_user_meta($uid,$key,$single=false) {
    global $wpdb;
    if ($key!=='_mmed_ir_state_v1') throw new RuntimeException('wrong owner key');
    if (!$wpdb->query('fixture metadata read')) return [];
    if ($GLOBALS['readHook']) { $f=$GLOBALS['readHook']; $GLOBALS['readHook']=null; $f(); }
    return unserialize(serialize($GLOBALS['records'][$uid] ?? [])); // Real metadata unserializes a fresh object map.
}
function add_user_meta($uid,$key,$value,$unique=false) {
    global $wpdb;
    if ($key!=='_mmed_ir_state_v1' || !$unique || !($wpdb instanceof MMed_IR_Locked_DB)) throw new RuntimeException('unscoped write');
    if (!$wpdb->query('fixture metadata insert')) return false;
    if (!empty($GLOBALS['records'][$uid])) return false;
    $GLOBALS['records'][$uid]=[$value]; $GLOBALS['writes']++; return 1;
}
function update_user_meta($uid,$key,$value,$before) {
    global $wpdb;
    if ($key!=='_mmed_ir_state_v1' || !($wpdb instanceof MMed_IR_Locked_DB)) throw new RuntimeException('unscoped write');
    if (!$wpdb->query('fixture metadata update')) return false;
    if (serialize($GLOBALS['records'][$uid][0] ?? null)!==serialize($before)) return false;
    $GLOBALS['records'][$uid]=[$value]; $GLOBALS['writes']++; return 1;
}
class Request {
    public $headers=[],$query=[],$url=[],$body='',$method='GET';
    public function __construct($method='GET',$command=null) {
        $this->method=$method;
        $this->headers=['x-wp-nonce'=>'fixture-nonce','origin'=>home_url(''),'referer'=>home_url('/interview-ready/app/'),
            'sec-fetch-site'=>'same-origin','x-ir-subject'=>MMed_IR_Gateway::subject(get_current_user_id()),'content-type'=>'application/json'];
        if ($command!==null) $this->body=json_encode($command);
    }
    public function get_header($k) { return $this->headers[$k] ?? ''; }
    public function get_query_params() { return $this->query; } public function get_url_params() { return $this->url; }
    public function get_method() { return $this->method; } public function get_body() { return $this->body; }
}
foreach (['uid'=>10,'records'=>[],'lockOwner'=>null,'denyLock'=>false,'releases'=>0,'writes'=>0,
    'newConnections'=>0,'retryWrites'=>0,'readHook'=>null,'cacheDeletes'=>0] as $key=>$value) { $GLOBALS[$key]=$value; }
$wpdb=new wpdb;
require __DIR__.'/missionmed-interview-ready.php';
$n=0;
function expect($ok,$name) { global $n; if (!$ok) { fwrite(STDERR,'FAIL '.$name."\n"); exit(1); } $n++; }
function code($r,$c) { return is_wp_error($r) && $r->code===$c; }
function command($rev=0,$id='11111111-1111-4111-8111-111111111111') {
    return (object)['expectedRevision'=>$rev,'commandId'=>$id,'state'=>(object)['done'=>(object)['online:0:1'=>true],
        'auto'=>(object)['cam'=>false,'mic'=>false,'env'=>false], 'kit'=>[MMed_IR_Gateway::KIT_KEYS[0]],'mode'=>'online']];
}
$r=new Request; expect(MMed_IR_Gateway::permission($r)===true,'normal free-account admission');
$GLOBALS['uid']=0; expect(code(MMed_IR_Gateway::permission($r),'ir_login_required'),'anonymous rejected'); $GLOBALS['uid']=10;
foreach (['x-wp-nonce'=>'','origin'=>'https://example.invalid','sec-fetch-site'=>'cross-site','x-ir-subject'=>'another-account'] as $key=>$v) {
    $bad=clone $r; $bad->headers[$key]=$v; expect(is_wp_error(MMed_IR_Gateway::permission($bad)),'reject '.$key);
}
$bad=clone $r; $bad->headers['origin']=''; expect(MMed_IR_Gateway::permission($bad)===true,'same-origin GET referer fallback');
$bad->headers['referer']=''; expect(code(MMed_IR_Gateway::permission($bad),'ir_origin'),'ambiguous request rejected');
$bad=clone $r; $bad->headers['origin']=home_url('/evil'); expect(code(MMed_IR_Gateway::permission($bad),'ir_origin'),'origin path rejected');
$bad=clone $r; $bad->query=['owner'=>11]; expect(code(MMed_IR_Gateway::permission($bad),'ir_parameters'),'owner query rejected');
$s=MMed_IR_Gateway::state($r); expect($s->data['state']['revision']===0 && !$GLOBALS['writes'],'read-only empty GET');
$first=command(); $post=new Request('POST',$first);
expect(!is_wp_error(MMed_IR_Gateway::command($post)),'valid command');
foreach (['owner','arbitrary'] as $key) { $c=command(); $c->$key=11; expect(code(MMed_IR_Gateway::command(new Request('POST',$c)),'ir_schema'),'unknown '.$key); }
foreach (['online:0:6','online:9:0','in-person:4:3','unknown:0:0'] as $id) {
    $c=command(); $c->state->done=(object)[$id=>true]; expect(code(MMed_IR_Gateway::command(new Request('POST',$c)),'ir_schema'),'unknown checklist '.$id);
}
$c=command(); $c->state->done=(object)['online:0:0'=>'true']; expect(code(MMed_IR_Gateway::command(new Request('POST',$c)),'ir_schema'),'strict boolean');
$c=command(); $c->state->auto->setup=true; expect(code(MMed_IR_Gateway::command(new Request('POST',$c)),'ir_schema'),'no extra automatic fields');
$c=command(); $c->state->kit=['unlisted']; expect(code(MMed_IR_Gateway::command(new Request('POST',$c)),'ir_schema'),'kit whitelist');
$c=command(); $c->state->kit=array_fill(0,2,MMed_IR_Gateway::KIT_KEYS[0]); expect(code(MMed_IR_Gateway::command(new Request('POST',$c)),'ir_schema'),'kit unique');
$c=command(); $c->state->done=[]; expect(code(MMed_IR_Gateway::command(new Request('POST',$c)),'ir_schema'),'done requires map');
$c=command(); $c->expectedRevision=0.0; $q=new Request('POST'); $q->body=json_encode($c,JSON_PRESERVE_ZERO_FRACTION); expect(code(MMed_IR_Gateway::command($q),'ir_schema'),'integer revision');
$q=clone $post; $q->body=str_repeat(' ',8193); expect(code(MMed_IR_Gateway::command($q),'ir_body'),'8KiB cap');
$GLOBALS['denyLock']=true; expect(code(MMed_IR_Gateway::state($post),'ir_lock') && !$GLOBALS['writes'],'lock failure preserves empty state'); $GLOBALS['denyLock']=false;
$original=$wpdb; $handle=$wpdb->dbh;
$interleaved=null;
$GLOBALS['readHook']=function() use (&$interleaved) { $interleaved=MMed_IR_Gateway::state(new Request('POST',command(0,'22222222-2222-4222-8222-222222222222'))); };
$s=MMed_IR_Gateway::state($post); expect($s instanceof WP_REST_Response && $s->data['state']['revision']===1,'first write commits');
expect(code($interleaved,'ir_lock') && count($GLOBALS['records'][10])===1,'interleaved first writer cannot duplicate');
expect($wpdb===$original && $wpdb->dbh===$handle && $wpdb->sentinel==='original-properties' && $GLOBALS['lockOwner']===null,'exact DB owner restored and lock released');
$writes=$GLOBALS['writes']; $retry=MMed_IR_Gateway::state($post); expect($retry->data['state']['revision']===1 && $GLOBALS['writes']===$writes,'UUID and digest retry idempotent');
$c=command(); $c->state->done->{'online:0:1'}=false; expect(code(MMed_IR_Gateway::state(new Request('POST',$c)),'ir_command_reused'),'same UUID changed payload rejects');
expect(code(MMed_IR_Gateway::state(new Request('POST',command(0,'22222222-2222-4222-8222-222222222222'))),'ir_conflict'),'stale first write CAS409');
$c=command(1,'33333333-3333-4333-8333-333333333333'); $c->state->auto->cam=true;
$s=MMed_IR_Gateway::state(new Request('POST',$c)); expect($s->data['state']['revision']===2,'next revision saves');
$GLOBALS['uid']=11; $s=MMed_IR_Gateway::state(new Request); expect($s->data['state']['revision']===0,'other account isolated');
expect(code(MMed_IR_Gateway::state($r),'ir_identity_changed'),'old subject rejects changed session');
$GLOBALS['uid']=10; $before=$GLOBALS['records'][10]; $writes=$GLOBALS['writes'];
$GLOBALS['readHook']=function() { $GLOBALS['wpdb']->dbh->failQuery=true; };
$s=MMed_IR_Gateway::state(new Request('POST',command(2,'44444444-4444-4444-8444-444444444444')));
expect(code($s,'ir_write') || code($s,'ir_connection'),'connection loss fails closed during metadata query');
expect($GLOBALS['records'][10]===$before && $GLOBALS['writes']===$writes && $GLOBALS['newConnections']===0 && $GLOBALS['retryWrites']===0,'no reconnect or retry write');
expect($wpdb===$original,'original DB restored on connection failure');
$wpdb->dbh=new FixtureMysqli; $GLOBALS['lockOwner']=null;
$before=$GLOBALS['records'][10]; $writes=$GLOBALS['writes'];
$GLOBALS['readHook']=function() { $GLOBALS['wpdb']->dbh->thread++; };
$s=MMed_IR_Gateway::state(new Request('POST',command(2,'55555555-5555-4555-8555-555555555555')));
expect(code($s,'ir_connection') && $GLOBALS['records'][10]===$before && $GLOBALS['writes']===$writes,'connection ID drift prevents mutation');
$wpdb->dbh=new FixtureMysqli; $GLOBALS['lockOwner']=null;
$GLOBALS['readHook']=function() { $GLOBALS['uid']=11; };
$s=MMed_IR_Gateway::state(new Request('POST',command(2,'66666666-6666-4666-8666-666666666666')));
expect(code($s,'ir_connection') && $GLOBALS['records'][10]===$before,'identity change under lock prevents mutation');
$GLOBALS['uid']=10;
$savedRows=$GLOBALS['records'][10]; $GLOBALS['records'][10][]=$savedRows[0];
expect(code(MMed_IR_Gateway::state(new Request),'ir_recovery_required'),'duplicate records fail closed');
$GLOBALS['records'][10]=[['revision'=>5]]; expect(code(MMed_IR_Gateway::state(new Request('POST',command(0))),'ir_recovery_required'),'malformed state preserved');
$GLOBALS['records'][10]=$savedRows;
expect(MMed_IR_Gateway::return_target(home_url('/interview-ready/app/')) && MMed_IR_Gateway::return_target('/interview-ready/app/'),'exact account return');
foreach (['https://example.invalid/interview-ready/app/','//missionmedinstitute.com/interview-ready/app/','/interview-ready/%61pp/','/interview-ready/app/?next=evil','/interview-ready/app/#kit'] as $bad) expect(!MMed_IR_Gateway::return_target($bad),'unsafe return rejected');
$html='<script>const context = '.MMed_IR_Gateway::MARKER.';</script>';
expect(strpos(MMed_IR_Gateway::inject($html,0),'fixture-nonce')===false && strpos(MMed_IR_Gateway::inject($html,0),'subject')===false,'public response has no identity or nonce');
expect(strpos(MMed_IR_Gateway::inject($html,10),'fixture-nonce')!==false,'private context injection');
expect(strpos(MMed_IR_Gateway::menu('',(object)['menu'=>35]),'data-mmed-ir-nav')!==false,'Primary additive discovery');
expect(strpos(MMed_IR_Gateway::menu('',(object)['menu'=>null,'theme_location'=>'primary']),'data-mmed-ir-nav')!==false,'resolved theme location discovery');
expect(MMed_IR_Gateway::menu('unchanged',(object)['menu'=>99])==='unchanged','unrelated menu untouched');
$root=sys_get_temp_dir().'/ir-runtime-fixture-'.getmypid(); mkdir($root); mkdir($root.'/releases');
$digest=hash('sha256',$html); mkdir($root.'/releases/'.$digest); file_put_contents($root.'/releases/'.$digest.'/interview-ready.html',$html); symlink($root.'/releases/'.$digest,$root.'/current');
expect(MMed_IR_Gateway::runtime($root)===$html,'qualified immutable release');
file_put_contents($root.'/releases/'.$digest.'/interview-ready.html',$html.'changed'); expect(code(MMed_IR_Gateway::runtime($root),'ir_runtime'),'digest drift rejects');
unlink($root.'/current'); symlink(sys_get_temp_dir(),$root.'/current'); expect(code(MMed_IR_Gateway::runtime($root),'ir_runtime'),'outside pointer rejects');
unlink($root.'/current'); unlink($root.'/releases/'.$digest.'/interview-ready.html'); rmdir($root.'/releases/'.$digest); rmdir($root.'/releases'); rmdir($root);
echo json_encode(['builderFixture'=>'PASS','assertions'=>$n,'liveWordPressOrDatabase'=>false])."\n";

}
