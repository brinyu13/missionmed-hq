"""Isolated compile-boundary proof only. No transport, WP, credentials, or helper edit."""
import base64,contextlib,hashlib,importlib.util,json,shutil,subprocess,sys,time
from pathlib import Path
from types import SimpleNamespace
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('local_qa_reference',HERE.parent/'native_account_qa.py')
qa=importlib.util.module_from_spec(spec);sys.modules[spec.name]=qa;spec.loader.exec_module(qa)
class Gate:
    admission=SimpleNamespace(mode='inventory')
    def require(self,action):assert action=='creation_inventory_read'
    @contextlib.contextmanager
    def dispatch(self,action):yield qa.Dispatch(time.monotonic()+qa.IO_SECONDS,action=action)
program=[]
def capture(code,**kwargs):program.append(code);raise qa.Stop('child_exit')
try:qa.creation_inventory_read(Gate(),capture)
except qa.Stop:pass
assert len(program)==1
original=program[0]
prefix=qa.inventory_boundary_preamble();preamble=qa.php_preamble()
assert original.startswith(prefix) and prefix.endswith(preamble.removeprefix('<?php\n'))
observer=prefix.removesuffix(preamble.removeprefix('<?php\n'))
observer=observer.replace('IR_INVENTORY_BOUNDARY_V1 ENTERED','IR_INVENTORY_BOUNDARY_V2 WRAPPER_ENTERED')
observer=observer.replace('IR_INVENTORY_BOUNDARY_V1 SHUTDOWN','IR_INVENTORY_BOUNDARY_V2 SHUTDOWN')
observer=observer.replace('register_shutdown_function(function(){',"$ir_eval_parseerror=false;\nregister_shutdown_function(function() use (&$ir_eval_parseerror){")
observer=observer.replace("($ir_fatal?'FATAL '.$ir_kind:'NONFATAL UNKNOWN')","($ir_eval_parseerror?'PARSEERROR UNKNOWN':($ir_fatal?'FATAL '.$ir_kind:'NONFATAL UNKNOWN'))")
inner='<?php\nfwrite(STDERR,"IR_INVENTORY_BOUNDARY_V2 PAYLOAD_ENTERED\\n");\n'+preamble.removeprefix('<?php\n')+original[len(prefix):]
def wrapper(source):
    encoded=base64.b64encode(source.encode()).decode()
    return observer+"try{eval('?>'.base64_decode('"+encoded+"'));}catch(ParseError $ir_eval_exception){$ir_eval_parseerror=true;throw $ir_eval_exception;}\n"
stubs="<?php ini_set('display_errors','0');ini_set('log_errors','0');error_reporting(0); function add_filter(...$args){} function wp_json_encode($v){return json_encode($v);} "
method="class SyntheticEval{static function run($source){eval('?>'.$source);}} "
php=shutil.which('php');assert php
W=b'IR_INVENTORY_BOUNDARY_V2 WRAPPER_ENTERED\n'
P=b'IR_INVENTORY_BOUNDARY_V2 PAYLOAD_ENTERED\n'
S=b'IR_INVENTORY_BOUNDARY_V2 SHUTDOWN '
def run(source,setup='$wp_filter=[];'):
    code=stubs+setup+method+"SyntheticEval::run(base64_decode('"+base64.b64encode(source.encode()).decode()+"'));"
    return subprocess.run([php,'-n'],input=code.encode(),capture_output=True,timeout=2)
# Same exact actual payload semantics in method eval and nested method eval.
for setup in ('$wp_filter=[];',"$wp_filter=['synthetic'=>new stdClass];"):
    direct=run(original,setup);nested=run(wrapper(inner),setup)
    assert direct.returncode==nested.returncode and direct.stdout==nested.stdout
    assert nested.stderr==W+P+S+b'NONFATAL UNKNOWN\n'
    if 'stdClass' in setup:assert json.loads(nested.stdout)['step']=='HOOK_SHAPE'
    else:assert json.loads(nested.stdout)['count']==0
# Actual helper's global declaration collision prevents its first marker.
collision='function ir_fail(){} $wp_filter=[];'
direct=run(original,collision);nested=run(wrapper(inner),collision)
assert (direct.returncode,direct.stdout,direct.stderr)==(255,b'',b'')
assert (nested.returncode,nested.stdout,nested.stderr)==(255,b'',W+S+b'FATAL REDECLARE\n')
# ParseError is detected by type, then rethrown; no message serialization.
parse=run(wrapper(inner+' syntax ???'))
assert (parse.returncode,parse.stdout,parse.stderr)==(255,b'',W+S+b'PARSEERROR UNKNOWN\n')
# Failure before executing the outer wrapper still produces no entry evidence.
early=run(wrapper(inner),"trigger_error('SYNTHETIC',E_USER_ERROR);")
assert (early.returncode,early.stdout,early.stderr)==(255,b'',b'')
result={'schema':'ir.inventory.prepayload.local-proof.v1','result':'PASS',
    'methodScopeNormalAndHookAttributionEquivalent':True,
    'unwrappedRedeclarationHasNoEntry':True,'wrappedRedeclarationHasOuterAndFixedFatal':True,
    'typedParseErrorRethrownAndFixedObserved':True,'prewrapperAbsenceRemainsUnresolved':True,
    'fixtureProcesses':8,'actualBootstrap':False,'actualTransport':False,
    'referenceQASha256':hashlib.sha256(Path(qa.__file__).read_bytes()).hexdigest()}
(HERE/'LOCAL_PROOF.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,sort_keys=True))
