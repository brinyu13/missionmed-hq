<?php
/** Real SQLite two-process proof of the shared review transaction. Synthetic metadata only. */
define('ABSPATH',__DIR__.'/'); define('ARRAY_A','ARRAY_A');
class WP_Error { public $code; public function __construct($code,$message,$data=array()) { $this->code=$code; } }
function is_wp_error($v) { return $v instanceof WP_Error; }
function absint($v) { return abs((int)$v); }
class MMPS_Install { public static function table($name) { return 'mmps_'.$name; } }
class LockDB {
 public $is_mysql=false, $pdo, $queries=array(), $insert_id=0;
 public function __construct($path) { $this->pdo=new PDO('sqlite:'.$path); $this->pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION); $this->pdo->exec('PRAGMA busy_timeout=3000'); }
 public function suppress_errors($yes) { return false; }
 public function prepare($sql,...$args) { if(count($args)===1 && is_array($args[0])) $args=$args[0]; $i=0; return preg_replace_callback('/%[ds]/',function($m)use(&$i,$args){ $v=$args[$i++]; return $m[0]==='%d'?(string)(int)$v:$this->pdo->quote($v); },$sql); }
 public function query($sql) { $this->queries[]=$sql; return $this->pdo->exec($sql==='START TRANSACTION'?'BEGIN':$sql); }
 public function get_row($sql,$mode=null) { return $this->pdo->query($sql)->fetch(PDO::FETCH_ASSOC)?:null; }
 public function get_var($sql) { $v=$this->pdo->query($sql)->fetchColumn(); return $v===false?null:$v; }
 public function insert($table,$row) { $keys=array_keys($row); $sql='INSERT INTO '.$table.' ('.implode(',',$keys).') VALUES ('.implode(',',array_fill(0,count($keys),'?')).')'; $r=$this->pdo->prepare($sql)->execute(array_values($row)); $this->insert_id=(int)$this->pdo->lastInsertId(); return $r; }
}
require dirname(__DIR__,2).'/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-store.php';
$path=tempnam(sys_get_temp_dir(),'psv-review-lock-');
$wpdb=new LockDB($path);
$wpdb->query('CREATE TABLE mmps_runs (id INTEGER PRIMARY KEY,root_id INTEGER,user_id INTEGER,run_uuid TEXT)');
$wpdb->query('CREATE TABLE mmps_roots (id INTEGER PRIMARY KEY,user_id INTEGER)');
$wpdb->query('CREATE TABLE mmps_heads (id INTEGER PRIMARY KEY,revision TEXT)');
$wpdb->query('CREATE TABLE mmps_library (id INTEGER PRIMARY KEY,revision TEXT,user_id INTEGER,created_at TEXT,updated_at TEXT)');
$wpdb->query("INSERT INTO mmps_runs VALUES (1,1,1,'fixture-run')"); $wpdb->query('INSERT INTO mmps_roots VALUES (1,1)');
$passes=0;
function lock_check($ok,$label) { global $passes; if(!$ok) { fwrite(STDERR,'FAIL: '.$label."\n"); exit(1); } $passes++; echo 'PASS: '.$label."\n"; }

// Approval owns the run before a no-head edit arrives. It must retain the lock
// even inside insert_document, which previously opened/committed independently.
$sockets=stream_socket_pair(STREAM_PF_UNIX,STREAM_SOCK_STREAM,0);
$pid=pcntl_fork();
if($pid===0) {
 fclose($sockets[0]); $wpdb=new LockDB($path); fread($sockets[1],1);
 $r=MMPS_Store::with_review_lock(1,'fixture-run',function()use($sockets) { global $wpdb; $wpdb->query("INSERT INTO mmps_heads VALUES (1,'edit-1')"); fwrite($sockets[1],'D'); return true; });
 exit(is_wp_error($r)?2:0);
}
fclose($sockets[1]);
$r=MMPS_Store::with_review_lock(1,'fixture-run',function()use($sockets) {
 global $wpdb;
 lock_check($wpdb->get_var('SELECT revision FROM mmps_heads')===null,'approval initially observes original with no edit head');
 fwrite($sockets[0],'G'); usleep(150000);
 $ready=array($sockets[0]); $w=$e=null;
 lock_check(stream_select($ready,$w,$e,0,0)===0,'concurrent edit cannot become head during original approval');
 $id=MMPS_Store::insert_document(1,array('revision'=>'ORIGINAL'));
 lock_check($id>0 && $wpdb->pdo->inTransaction(),'document insert joins review transaction and does not release lock');
 usleep(150000); $ready=array($sockets[0]);
 lock_check(stream_select($ready,$w,$e,0,0)===0,'lock remains held through document insertion');
 return true;
});
pcntl_waitpid($pid,$status); lock_check(!is_wp_error($r)&&pcntl_wexitstatus($status)===0,'approval and subsequent edit commit in serial order');
lock_check($wpdb->get_var('SELECT revision FROM mmps_library')==='ORIGINAL' && $wpdb->get_var('SELECT revision FROM mmps_heads')==='edit-1','later edit does not overwrite approved output');
fclose($sockets[0]);

// Inverse ordering: an edit owns the run first. Approval cannot validate its
// old revision until the edit commits, then must observe the new head.
$sockets=stream_socket_pair(STREAM_PF_UNIX,STREAM_SOCK_STREAM,0);
$pid=pcntl_fork();
if($pid===0) {
 fclose($sockets[0]); $wpdb=new LockDB($path);
 $r=MMPS_Store::with_review_lock(1,'fixture-run',function()use($sockets) { global $wpdb; $wpdb->query("UPDATE mmps_heads SET revision='edit-2'"); fwrite($sockets[1],'L'); usleep(250000); return true; });
 exit(is_wp_error($r)?2:0);
}
fclose($sockets[1]); fread($sockets[0],1);
$r=MMPS_Store::with_review_lock(1,'fixture-run',function() { global $wpdb; return $wpdb->get_var('SELECT revision FROM mmps_heads')!=='edit-1'?new WP_Error('stale','stale'):true; });
pcntl_waitpid($pid,$status);
lock_check(is_wp_error($r)&&$r->code==='stale'&&pcntl_wexitstatus($status)===0,'new edit commits before approval can check stale revision');
lock_check(!$wpdb->pdo->inTransaction(),'rejected approval releases transaction');
fclose($sockets[0]);
$before=$wpdb->get_var('SELECT COUNT(*) FROM mmps_library');
$r=MMPS_Store::with_review_lock(1,'fixture-run',function(){ MMPS_Store::insert_document(1,array('revision'=>'ROLLBACK')); return new WP_Error('reject','reject'); });
lock_check(is_wp_error($r)&&$wpdb->get_var('SELECT COUNT(*) FROM mmps_library')==$before,'post-insert failure rolls back document with entire review');
$called=false; $r=MMPS_Store::with_review_lock(2,'fixture-run',function()use(&$called){$called=true;return true;});
lock_check(is_wp_error($r)&&!$called,'wrong owner cannot enter mutation callback');
lock_check(!is_wp_error(MMPS_Store::with_review_lock(1,'fixture-run',function(){return true;})),'lock can be acquired again after rollback');
// Fake MySQL driver proves lock SQL/engine fail-closed route without claiming a
// live MySQL concurrency witness; deployment harness verifies native engine.
class MysqlLockDB {
 public $is_mysql=true,$queries=array(),$engineCount=7;
 public function suppress_errors($v){return false;}
 public function prepare($sql,...$args){return $sql;}
 public function query($sql){$this->queries[]=$sql;return 0;}
 public function get_var($sql){$this->queries[]=$sql;return strpos($sql,'information_schema')!==false?$this->engineCount:1;}
 public function get_row($sql,$mode){$this->queries[]=$sql;return array('id'=>1,'root_id'=>1);}
}
$wpdb=new MysqlLockDB();
lock_check(!is_wp_error(MMPS_Store::with_review_lock(1,'fixture-run',function(){return true;}))&&count(array_filter($wpdb->queries,function($q){return strpos($q,'FOR UPDATE')!==false;}))===2,'MySQL transaction locks both owner run and ROOT FOR UPDATE');
$wpdb->engineCount=6; $called=false;
lock_check(is_wp_error(MMPS_Store::with_review_lock(1,'fixture-run',function()use(&$called){$called=true;return true;}))&&!$called,'nontransactional or missing table blocks MySQL mutation');
unlink($path);
echo "PSV UX EDIT LOCK RUNTIME: PASS ({$passes} assertions)\n";
