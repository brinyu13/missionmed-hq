"""Local synthetic PHP scope/hidden-fatal examples; no WordPress/helper execution."""
import json,shutil,subprocess,sys
sys.dont_write_bytecode=True
php=shutil.which('php')
assert php is not None
cases=[
("scope_local", """<?php
function fixture_writer(){global $step;$step='FILE_DIGEST';throw new RuntimeException('FIXTURE');}
class FixtureEval { static function run($code){eval('?>'.$code);} }
FixtureEval::run('<?php $step="ENCODE";try{fixture_writer();}catch(Throwable $e){echo $step;}');
""",0,b'ENCODE',b''),
("scope_global", """<?php
function fixture_writer(){global $step;$step='FILE_DIGEST';throw new RuntimeException('FIXTURE');}
class FixtureEval { static function run($code){eval('?>'.$code);} }
FixtureEval::run('<?php global $step;$step="ENCODE";try{fixture_writer();}catch(Throwable $e){echo $step;}');
""",0,b'FILE_DIGEST',b''),
("hidden_fatal", """<?php
fwrite(STDERR,"IR_INVENTORY_BOUNDARY_V1 ENTERED\n");
register_shutdown_function(function(){
 $e=error_get_last();$type=is_array($e)&&isset($e['type'])?$e['type']:0;
 $fatal=in_array($type,[E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR,E_USER_ERROR,E_RECOVERABLE_ERROR],true);
 unset($e);fwrite(STDERR,$fatal?"IR_INVENTORY_BOUNDARY_V1 SHUTDOWN FATAL\n":"IR_INVENTORY_BOUNDARY_V1 SHUTDOWN NONFATAL\n");
});
ini_set('display_errors','0');ini_set('log_errors','0');error_reporting(0);
trigger_error('FIXTURE',E_USER_ERROR);
""",255,b'',b'IR_INVENTORY_BOUNDARY_V1 ENTERED\nIR_INVENTORY_BOUNDARY_V1 SHUTDOWN FATAL\n'),
("normal_shutdown", """<?php
fwrite(STDERR,"IR_INVENTORY_BOUNDARY_V1 ENTERED\n");
register_shutdown_function(function(){fwrite(STDERR,"IR_INVENTORY_BOUNDARY_V1 SHUTDOWN NONFATAL\n");});
echo '{"fixture":true}';
""",0,b'{"fixture":true}',b'IR_INVENTORY_BOUNDARY_V1 ENTERED\nIR_INVENTORY_BOUNDARY_V1 SHUTDOWN NONFATAL\n')]
for label,code,rc,out,err in cases:
 # -n is only this isolated fixture, never a proposed native transport change.
 r=subprocess.run([php,'-n'],input=code.encode(),capture_output=True,timeout=2)
 assert len(r.stdout)<=4096 and len(r.stderr)<=4096
 assert (r.returncode,r.stdout,r.stderr)==(rc,out,err),label
print(json.dumps({'result':'PASS','syntheticCases':len(cases),'scopeFixture':'METHOD_LOCAL_ENCODE_VS_GLOBAL_FILE_DIGEST','silentFatalFixture':'ENTERED_SHUTDOWN_FATAL_EXIT255_NO_STDOUT','actualBootstrap':False,'actualHelperExecuted':False}))
