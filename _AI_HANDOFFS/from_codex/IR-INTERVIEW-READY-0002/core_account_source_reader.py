"""Dormant, fixed ordinary-account source reader. Preparation is not admission."""
import argparse
import ast
import base64
import hashlib
import types
import json
import math
import os
from pathlib import Path
import re
import stat
import time

HERE = Path(__file__).resolve().parent
FIXED_DONOR_SHA = 'a0d65fc35a412a9662ea9065a19a4b9453cf31ce810facf223534093d77d5c92'
FIXED_TEST_SHA = '8e5d79d40a5b2f7623978ca0b192753d2140cdc20d136db51e9db56c9b3b95cc'
DONOR_REVIEW_SHA = '5468847efb185a4f091381dfa6cccf0217be798185dea54c3e487ef08b5f14d6'
DONOR_RENDER_SHA = 'f4a8679e18dbab3a07ea3b1d753f2433ab9e036f243e69f5b4d589d49279f270'
SOURCE_CAP, OUTPUT_CAP, IO_SECONDS, REAP_SECONDS = 512*1024, 8*1024*1024, 10, 2
WEBROOT = '/www/theresidencyacademy_209/public'
SSH_ARGV = ('ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8','missionmed-kinsta','python3','-')
TARGETS = {
 'wp-includes/pluggable.php': ('wp_authenticate','wp_signon','wp_set_current_user','wp_get_current_user','wp_set_auth_cookie','wp_clear_auth_cookie','wp_generate_auth_cookie','wp_validate_auth_cookie','wp_parse_auth_cookie','wp_check_password','wp_hash_password','wp_set_password','wp_generate_password','wp_create_nonce','wp_verify_nonce','wp_nonce_tick','wp_salt','wp_hash'),
 'wp-includes/formatting.php': ('sanitize_title','sanitize_key','sanitize_meta'),
 'wp-includes/class-wp-user.php': ('set_role',),
 'wp-includes/class-wp-session-tokens.php': ('get_instance','create','destroy'),
 'wp-includes/class-wp-user-meta-session-tokens.php': ('get_sessions','update_sessions','destroy_all_sessions','get_session','update_session'),
 'wp-includes/rest-api.php': ('rest_cookie_check_errors',),
 'wp-includes/rest-api/class-wp-rest-request.php': ('has_valid_params','sanitize_params'),
 'wp-includes/rest-api/class-wp-rest-server.php': ('dispatch','respond_to_request','response_to_data','error_to_response'),
 'wp-content/plugins/woocommerce/includes/class-wc-form-handler.php': ('process_login',),
 'wp-content/plugins/woocommerce/includes/wc-template-functions.php': ('wc_template_redirect',),
 'wp-content/plugins/woocommerce/includes/wc-account-functions.php': ('wc_get_logout_redirect_url','wc_logout_url'),
}

class Stop(Exception):
    pass

def require(ok, label='CORE_ACCOUNT_STOP'):
    if not ok:raise Stop(label)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def regular(path, cap):
    """Frozen donor descriptor custody, copied without policy changes."""
    path=Path(path)
    for parent in (path,*path.parents):require(not parent.is_symlink(),'SYMLINK_STOP')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and 0<=before.st_size<=cap,'CAP_STOP')
        chunks=[];total=0
        while True:
            chunk=os.read(fd,min(65536,cap-total+1))
            if not chunk:break
            total+=len(chunk);require(total<=cap,'CAP_STOP');chunks.append(chunk)
        after=os.fstat(fd);current=os.lstat(path)
        fields=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
        require(fields(before)==fields(after)==fields(current) and total==before.st_size,'SOURCE_DRIFT')
        for parent in (path,*path.parents):require(not parent.is_symlink(),'SYMLINK_STOP')
        return b''.join(chunks)
    finally:os.close(fd)

def donor():
    """Hash-bound dormant Python donor; never import the capture owner."""
    require(digest(regular(HERE/'BOOTSTRAP_FIXED_LOADER_DIAGNOSTIC_REVIEW.md',32768))==DONOR_REVIEW_SHA,'DONOR_REVIEW_DRIFT')
    path=HERE/'bootstrap_fixed_loader_reader.py'
    raw=regular(path,65536)
    require(digest(raw)==FIXED_DONOR_SHA,'DONOR_DRIFT')
    require(digest(regular(HERE/'bootstrap_fixed_loader_reader_tests.py',65536))==FIXED_TEST_SHA,'TEST_DONOR_DRIFT')
    module=types.ModuleType('_ir_fixed_account_donor');module.__file__=str(path)
    exec(compile(raw,str(path),'exec'),module.__dict__)
    module.dependencies()
    return module

def render_template(d=None):
    """Reuse the approved token slicer/redactor, with public code identities and opaque data.

    Requested names are also emitted as closed declaration facts. Retained bodies
    sit in a redacted file scaffold; top-level context is not effect approval.
    """
    d=donor() if d is None else d
    php=d.render_template()
    require(digest(php.encode())==DONOR_RENDER_SHA,'DONOR_RENDER_DRIFT')
    # Change only the frozen slicer's exact selection points, not its algorithm.
    old="if(($entry['mode']??'')==='loader_init'){"
    new="$selected=[];$wanted=$entry['regions'];\n  if(($entry['mode']??'')==='config'){"
    require(php.count(old)==1,'SLICE_POLICY_DRIFT');php=php.replace(old,new,1)
    start="['init','bootstrap','get_autoloader','__invoke','load_wordpress','start','run_command','run_command_and_exit','run','load_command','load_early_command']"
    require(php.count(start)==1,'SLICE_POLICY_DRIFT');php=php.replace(start,'$wanted',1)
    point="if($n!==null&&!in_array(strtolower($n),$wanted,true)){"
    require(php.count(point)==1,'SLICE_POLICY_DRIFT')
    php=php.replace(point,"if($n!==null&&in_array(strtolower($n),$wanted,true)){$selected[]=$n;}\n     "+point,1)
    # These eleven fixed public core/Woo roles are not configuration files.
    # Reuse donor contextual code names while removing generic data constants.
    old="$isConfig=($entry['mode']??'')==='config';if($isConfig){$names=[];}"
    require(php.count(old)==1,'PUBLIC_POLICY_DRIFT')
    php=php.replace(old,"$isConfig=false;",1)
    old="||preg_match('/^[A-Z_][A-Z0-9_]*$/D',$text)"
    require(php.count(old)==1,'PUBLIC_POLICY_DRIFT');php=php.replace(old,'',1)
    old="if($isConfig){$paths=[];$includeFacts=[];$guardFacts=[];$hooks=[];}"
    require(php.count(old)==1,'LITERAL_POLICY_DRIFT')
    php=php.replace(old,"$paths=[];$includeFacts=[];$guardFacts=[];$hooks=[];",1)
    point="$out[]=['configCallFacts'"
    require(php.count(point)==1,'RENDER_POLICY_DRIFT')
    return php.replace(point,"$out[]=['namedRegions'=>array_values(array_unique($selected)),'configCallFacts'",1)

REMOTE_MAIN = r'''
import signal,subprocess,sys
child=None;owned=[];absent=[]
def alarm(signum,frame):raise Stop('DEADLINE_STOP')
signal.signal(signal.SIGALRM,alarm);signal.alarm(8)
def checked(path,cap,binding=None):
 raw=regular(path,cap)
 if binding is not None:require([len(raw),digest(raw)]==binding,'SOURCE_DRIFT')
 owned.append((path,cap,[len(raw),digest(raw)]));return raw
def absence(path):
 # Parent symlinks and a missing/broken-link final target are distinct outcomes.
 for parent in (Path(path),*Path(path).parents):require(not parent.is_symlink(),'SYMLINK_STOP')
 require(not os.path.lexists(path),'ABSENCE_DRIFT')
try:
 rows=[];records=[]
 for role in sorted(TARGETS):
  path=WEBROOT+'/'+role;present=os.path.lexists(path)
  row={'path':role,'present':present}
  if present:
   raw=checked(path,SOURCE_CAP);row.update(bytes=len(raw),sha256=digest(raw))
   if PHASE=='bodies':records.append({'role':role,'mode':'config','regions':TARGETS[role],'source':base64.b64encode(raw).decode()})
  else:absence(path);absent.append(path)
  rows.append(row)
 metadata={'schema':'ir.account.fixed_source_metadata.v1','classification':'FIXED_SOURCE_FACTS_NOT_APPROVAL','targets':rows,'noAutomaticAdoption':True}
 value=metadata
 if PHASE=='bodies':
  require(metadata==FROZEN_METADATA,'TARGET_METADATA_DRIFT')
  checked(TOKENIZER_PATH,TOKENIZER_BYTES,[TOKENIZER_BYTES,TOKENIZER_SHA])
  program=RENDER_PHP.replace('SOURCES_B64',base64.b64encode(json.dumps(records,separators=(',',':')).encode()).decode())
  child=subprocess.Popen(TOKENIZER_ARGV,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
  result,_=child.communicate(program.encode(),timeout=6)
  require(child.returncode==0 and len(result)<=OUTPUT_CAP,'TOKENIZER_STOP')
  checked(TOKENIZER_PATH,TOKENIZER_BYTES,[TOKENIZER_BYTES,TOKENIZER_SHA])
  rendered=json.loads(result)
  require(len(rendered['files'])==len(records),'BODY_COUNT_STOP')
  value={'schema':'ir.account.fixed_source_closure.v1','classification':'STATIC_ACCOUNT_SOURCE_NOT_APPROVAL','metadata':metadata,'files':rendered['files'],'noSemanticApproval':True}
 for path,cap,binding in owned:require([len(raw:=regular(path,cap)),digest(raw)]==binding,'SOURCE_DRIFT')
 for path in absent:absence(path)
 payload=json.dumps(value,separators=(',',':')).encode();require(len(payload)<=OUTPUT_CAP,'OUTPUT_CAP_STOP');sys.stdout.buffer.write(payload)
except BaseException:
 if child is not None and child.poll() is None:
  try:child.kill();child.wait(timeout=REAP_SECONDS)
  except BaseException:pass
 sys.stdout.write('{"classification":"CORE_ACCOUNT_STOP"}');sys.exit(1)
finally:signal.alarm(0)
'''

def validate_metadata(value):
    require(type(value) is dict and set(value)=={'schema','classification','targets','noAutomaticAdoption'})
    require(value['schema']=='ir.account.fixed_source_metadata.v1' and value['classification']=='FIXED_SOURCE_FACTS_NOT_APPROVAL' and value['noAutomaticAdoption'] is True)
    require(type(value['targets']) is list and [r.get('path') for r in value['targets']]==sorted(TARGETS))
    for row in value['targets']:
        require(type(row) is dict and type(row.get('present')) is bool)
        require(set(row)==({'path','present','bytes','sha256'} if row['present'] else {'path','present'}))
        if row['present']:require(type(row['bytes']) is int and 0<=row['bytes']<=SOURCE_CAP and type(row['sha256']) is str and re.fullmatch('[0-9a-f]{64}',row['sha256']))
    return value

def prepare_program(phase='metadata', frozen=None):
    """Return prospective finite SSH stdin. Never execute it or adopt an edge."""
    require(phase in ('metadata','bodies'),'PHASE_STOP')
    require((phase=='metadata' and frozen is None) or (phase=='bodies' and frozen is not None),'FROZEN_REQUIRED')
    if frozen is not None:validate_metadata(frozen)
    d=donor()
    constants={k:globals()[k] for k in ('WEBROOT','SOURCE_CAP','OUTPUT_CAP','REAP_SECONDS','TARGETS')}
    constants.update({k:getattr(d,k) for k in ('TOKENIZER_PATH','TOKENIZER_BYTES','TOKENIZER_SHA','TOKENIZER_ARGV')})
    constants.update(PHASE=phase,FROZEN_METADATA=frozen,RENDER_PHP=render_template(d) if phase=='bodies' else None)
    own=regular(HERE/'core_account_source_reader.py',65536).decode();names={'Stop','require','digest','regular'}
    source='\n'.join(ast.get_source_segment(own,n) for n in ast.parse(own).body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in names)
    return 'import base64,hashlib,json,os,re,stat\nfrom pathlib import Path\n'+'\n'.join(k+' = '+repr(v) for k,v in constants.items())+'\n'+source+'\n'+REMOTE_MAIN

def validate_closure(value, frozen, d):
    require(type(value) is dict and set(value)=={'schema','classification','metadata','files','noSemanticApproval'})
    require(value['schema']=='ir.account.fixed_source_closure.v1' and value['classification']=='STATIC_ACCOUNT_SOURCE_NOT_APPROVAL' and value['noSemanticApproval'] is True and value['metadata']==frozen)
    validate_metadata(value['metadata']);present=[r for r in frozen['targets'] if r['present']]
    require(type(value['files']) is list and len(value['files'])==len(present))
    for item,row in zip(value['files'],present):
        require(type(item) is dict and set(item)=={'namedRegions','configCallFacts','suppressedBodies','guardFacts','includeSiteFacts','closedPublicRegistrations','role','sourceSha256','bytes','redactedSource','includeCandidates','dynamicIncludes'})
        require([item['role'],item['bytes'],item['sourceSha256']]==[row['path'],row['bytes'],row['sha256']])
        require(type(item['redactedSource']) is str and len(item['redactedSource'].encode())<=1024*1024)
        require(type(item['namedRegions']) is list and len(item['namedRegions'])==len(set(item['namedRegions'])) and all(type(n) is str and n in TARGETS[row['path']] for n in item['namedRegions']))
        require(type(item['suppressedBodies']) is int and 0<=item['suppressedBodies']<=SOURCE_CAP)
        require(type(item['dynamicIncludes']) is int and 0<=item['dynamicIncludes']<=SOURCE_CAP)
        require(not any(item[k] for k in ('guardFacts','includeSiteFacts','closedPublicRegistrations','includeCandidates')))
        require(type(item['configCallFacts']) is list and len(item['configCallFacts'])<=SOURCE_CAP)
        for f in item['configCallFacts']:require(type(f) is dict and set(f)=={'tokenOffset','callType'} and type(f['tokenOffset']) is int and 0<=f['tokenOffset']<=SOURCE_CAP and f['callType'] in d.CONFIG_CALL_TYPES)
    return value

def capture_prepared(capture, program, budget, *, phase='metadata', frozen=None):
    """Injected frozen native private_capture only; Root must own admission."""
    try:
        require(program==prepare_program(phase,frozen),'PROGRAM_DRIFT')
        deadline=budget.deadline
        require(type(deadline) in (int,float) and math.isfinite(deadline) and 0<deadline-time.monotonic()<=IO_SECONDS,'DEADLINE_STOP')
        raw=capture(SSH_ARGV,program.encode(),budget,cap=OUTPUT_CAP)
        require(type(raw) is bytes and len(raw)<=OUTPUT_CAP,'CAP_STOP');value=json.loads(raw)
        return validate_metadata(value) if phase=='metadata' else validate_closure(value,frozen,donor())
    except BaseException:raise Stop('PRIVATE_CAPTURE_STOP') from None

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if args.execute:print('BLOCKED: Root exact independent read admission required');return 1
    print('DORMANT: no remote/source/tokenizer/bootstrap execution');return 0

if __name__=='__main__':raise SystemExit(main())
