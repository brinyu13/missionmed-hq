"""Dormant exact-source hook facts preparation. No transport or execution on import."""
import ast
import base64
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
SOURCE_PATH = '/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-learndash-reskin.php'
SOURCE_SHA = '727b8d94518e05a63f798cf69608f7b0a3fa07f0880f084b4453e88b6a8fb54e'
SOURCE_BYTES = 22883
MODULE_PATH = '/usr/lib/php/20220829/tokenizer.so'
MODULE_SHA = '088267fb4965e634f43151d2981b8ff60e258376684990eb0791b75b6f34878c'
MODULE_BYTES = 35080
IO_SECONDS, REAP_SECONDS, OUTPUT_CAP, STDERR_CAP = 10, 2, 16384, 4096
PUBLIC_HOOKS = ('wp_enqueue_scripts','admin_enqueue_scripts','body_class','template_redirect','template_include','wp_head','wp_footer','the_content','show_admin_bar','after_setup_theme','setup_theme','wp_loaded','init','plugins_loaded','muplugins_loaded')
PINS = {
 'bootstrap_fixed_loader_reader.py':'91e409e5f6d27652a5215a169593852b9c3398b6791ebc396d41e6823ef67b91',
 'native_account_qa.py':'c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1',
 'BOOTSTRAP_FIXED_LOADER_BODY_READBACK_3.json':'d857cd182f16a7c4ce9a2a44688dd656298ced37aae38c38625e1c72dacd1ada',
 'BOOTSTRAP_FIXED_LOADER_METADATA_READBACK_2.json':'7a9069c3d4e9d22864f64e87d8f70438b1251fb75e005c6a5ee87930be68cea3',
 'BOOTSTRAP_ACTUAL_FIXED_LOADER_SEMANTIC_REVIEW_4.md':'ac9ef249b3e58e54d5d3ea9cc330ced0f4c1b26ad0002f5c84df3732213483c4',
 'BOOTSTRAP_INSTALLED_TOKENIZER_METADATA_READBACK_1.json':'81972c8b4fb99550f4f4ac6dde528c21a4f7f2df0bb548b56d0edc8e6e96590f'}

class Stop(Exception):
    pass

def require(ok):
    if not ok:
        raise Stop('RESKIN_FACTS_STOP')

PHP_PARSER = r'''<?php
function need($ok){if(!$ok)throw new RuntimeException();}
function endpair($t,$i,$open,$close){need($t[$i][1]===$open);$d=1;for($j=$i+1;$j<count($t);$j++){if($t[$j][1]===$open)$d++;if($t[$j][1]===$close&&--$d===0)return $j;}throw new RuntimeException();}
function lit($x){need(count($x)===1&&$x[0][0]===T_CONSTANT_ENCAPSED_STRING);$v=$x[0][1];need(strlen($v)>=2&&in_array($v[0],["'",'"'],true)&&substr($v,-1)===$v[0]&&strpos($v,'\\')===false);return substr($v,1,-1);}
function facts($source,$sha,$bytes,$hooks){
 need(strlen($source)===$bytes&&hash('sha256',$source)===$sha);
 $t=[];foreach(token_get_all($source,TOKEN_PARSE) as $v){if(is_array($v)){if(in_array($v[0],[T_WHITESPACE,T_COMMENT,T_DOC_COMMENT],true))continue;$t[]=[$v[0],$v[1]];}else{$t[]=[0,$v];}}
 $classes=[];for($i=0;$i<count($t);$i++)if($t[$i][0]===T_CLASS&&($t[$i+1][1]??'')==='MMED_LearnDash_Reskin')$classes[]=$i;
 need(count($classes)===1);$i=$classes[0]+2;need($t[$i][1]==='{');$ce=endpair($t,$i,'{','}');$methods=[];$init=null;$mods=[];
 for($j=$i+1;$j<$ce;$j++){
  if(in_array($t[$j][0],[T_PUBLIC,T_PROTECTED,T_PRIVATE,T_STATIC,T_FINAL,T_ABSTRACT],true)){$mods[]=$t[$j][0];continue;}
  if($t[$j][0]===T_FUNCTION){$name=$t[$j+1][1]??'';need($t[$j+1][0]===T_STRING);$p=$j+2;need($t[$p][1]==='(');$pe=endpair($t,$p,'(',')');$b=$pe+1;need($t[$b][1]==='{');$be=endpair($t,$b,'{','}');need(!isset($methods[$name]));$public=!in_array(T_PRIVATE,$mods,true)&&!in_array(T_PROTECTED,$mods,true);$methods[$name]=$public;
   if($name==='init'){need($public&&in_array(T_STATIC,$mods,true)&&$pe===$p+1);$init=[$b+1,$be];}$j=$be;$mods=[];continue;}
  if(in_array($t[$j][1],['=',';'],true))$mods=[];
  if($t[$j][1]==='{'){$j=endpair($t,$j,'{','}');$mods=[];}
 }
 need($init!==null);$rows=[];
 for($j=$init[0];$j<$init[1];){
  $kind=$t[$j][1];need($t[$j][0]===T_STRING&&in_array($kind,['add_action','add_filter'],true));$p=$j+1;$pe=endpair($t,$p,'(',')');need($t[$pe+1][1]===';');$args=[];$arg=[];
  for($k=$p+1;$k<$pe;$k++){if(in_array($t[$k][1],['[','('],true)){$e=endpair($t,$k,$t[$k][1],$t[$k][1]==='['?']':')');for(;$k<=$e;$k++)$arg[]=$t[$k];$k--;continue;}if($t[$k][1]===','){$args[]=$arg;$arg=[];}else{$arg[]=$t[$k];}}$args[]=$arg;need(count($args)>=2&&count($args)<=4);
  $hook=lit($args[0]);$cb=$args[1];$resolved=false;$method=null;
  if(count($cb)===7&&$cb[0][1]==='['&&in_array(strtolower($cb[1][1]),['self','static','mmed_learndash_reskin'],true)&&$cb[2][0]===T_DOUBLE_COLON&&in_array($cb[3][0],[T_CLASS,T_STRING],true)&&strtolower($cb[3][1])==='class'&&$cb[4][1]===','&&$cb[6][1]===']'){$candidate=lit([$cb[5]]);if(isset($methods[$candidate])&&$methods[$candidate]){$resolved=true;$method=$candidate;}}
  if(count($cb)===8&&strtolower($cb[0][1])==='array'&&$cb[1][1]==='('&&in_array(strtolower($cb[2][1]),['self','static','mmed_learndash_reskin'],true)&&$cb[3][0]===T_DOUBLE_COLON&&in_array($cb[4][0],[T_CLASS,T_STRING],true)&&strtolower($cb[4][1])==='class'&&$cb[5][1]===','&&$cb[7][1]===')'){$candidate=lit([$cb[6]]);if(isset($methods[$candidate])&&$methods[$candidate]){$resolved=true;$method=$candidate;}}
  if((count($cb)===5&&$cb[0][1]==='['&&$cb[1][0]===T_CLASS_C&&$cb[2][1]===','&&$cb[4][1]===']')||(count($cb)===6&&strtolower($cb[0][1])==='array'&&$cb[1][1]==='('&&$cb[2][0]===T_CLASS_C&&$cb[3][1]===','&&$cb[5][1]===')')){$candidate=lit([$cb[count($cb)-2]]);if(isset($methods[$candidate])&&$methods[$candidate]){$resolved=true;$method=$candidate;}}
  $priority=10;$default=true;if(isset($args[2])){need(count($args[2])===1&&$args[2][0][0]===T_LNUMBER&&preg_match('/^[0-9]{1,7}$/D',$args[2][0][1]));$priority=(int)$args[2][0][1];$default=false;}
  if(isset($args[3]))need(count($args[3])===1&&$args[3][0][0]===T_LNUMBER&&preg_match('/^[0-9]{1,3}$/D',$args[3][0][1]));
  $known=in_array($hook,$hooks,true);$rows[]=['kind'=>$kind,'hook'=>$known?$hook:'UNKNOWN_HOOK','hookLiteralSha256'=>$known?null:hash('sha256',$args[0][0][1]),'callbackClass'=>$resolved?'MMED_LearnDash_Reskin':null,'callbackMethod'=>$method,'callbackResolved'=>$resolved,'priority'=>$priority,'priorityDefault'=>$default];$j=$pe+2;
 }
 need(count($rows)===6);return ['schema'=>'ir.reskin_hook_facts.v1','sourceSha256'=>$sha,'sourceBytes'=>$bytes,'class'=>'MMED_LearnDash_Reskin','publicStaticMethod'=>'init','registrations'=>$rows];
}
try{$input=json_decode(base64_decode('INPUT_B64'),true,512,JSON_THROW_ON_ERROR);$result=facts(base64_decode($input['source']),$input['sha'],$input['bytes'],$input['hooks']);echo json_encode($result,JSON_THROW_ON_ERROR);}catch(Throwable $ignored){echo '{"classification":"RESKIN_FACTS_STOP"}';}
'''

def validate_capture(raw):
    require(type(raw) is bytes and len(raw)<=OUTPUT_CAP)
    try:
        value=json.loads(raw)
    except Exception:
        raise Stop('RESKIN_FACTS_STOP') from None
    require(type(value) is dict and set(value)=={'schema','sourceSha256','sourceBytes','class','publicStaticMethod','registrations'})
    require(value['schema']=='ir.reskin_hook_facts.v1' and value['sourceSha256']==SOURCE_SHA and value['sourceBytes']==SOURCE_BYTES and value['class']=='MMED_LearnDash_Reskin' and value['publicStaticMethod']=='init')
    require(type(value['registrations']) is list and len(value['registrations'])==6)
    keys={'kind','hook','hookLiteralSha256','callbackClass','callbackMethod','callbackResolved','priority','priorityDefault'}
    for r in value['registrations']:
        require(type(r) is dict and set(r)==keys and r['kind'] in ('add_action','add_filter'))
        require(r['hook'] in PUBLIC_HOOKS+('UNKNOWN_HOOK',))
        require((r['hookLiteralSha256'] is None) if r['hook']!='UNKNOWN_HOOK' else (type(r['hookLiteralSha256']) is str and re.fullmatch('[a-f0-9]{64}',r['hookLiteralSha256']) is not None))
        require(type(r['callbackResolved']) is bool and type(r['priorityDefault']) is bool and type(r['priority']) is int and 0<=r['priority']<=9999999)
        require(not r['priorityDefault'] or r['priority']==10)
        require((r['callbackClass']=='MMED_LearnDash_Reskin' and type(r['callbackMethod']) is str and re.fullmatch('[A-Za-z_][A-Za-z0-9_]{0,79}',r['callbackMethod']) is not None) if r['callbackResolved'] else (r['callbackClass'] is None and r['callbackMethod'] is None))
    return value

REMOTE = r'''
import base64,hashlib,json,os,signal,stat,subprocess,sys,select,time
class Stop(Exception):pass
def need(v):
 if not v:raise Stop()
def checked(path,size,sha):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);need(stat.S_ISREG(before.st_mode) and before.st_size==size)
  raw=os.read(fd,size+1);after=os.fstat(fd)
  need(before==after and len(raw)==size and hashlib.sha256(raw).hexdigest()==sha)
 finally:os.close(fd)
 return raw
def alarm(a,b):raise Stop()
child=None
try:
 signal.signal(signal.SIGALRM,alarm);signal.alarm(10)
 checked(MODULE_PATH,MODULE_BYTES,MODULE_SHA)
 source=checked(SOURCE_PATH,SOURCE_BYTES,SOURCE_SHA)
 payload={'source':base64.b64encode(source).decode(),'sha':SOURCE_SHA,'bytes':SOURCE_BYTES,'hooks':PUBLIC_HOOKS}
 code=PHP_PARSER.replace('INPUT_B64',base64.b64encode(json.dumps(payload).encode()).decode()).encode()
 child=subprocess.Popen(['/usr/bin/php8.2','-n','-d','extension='+MODULE_PATH],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 streams={child.stdout:bytearray(),child.stderr:bytearray()};readers=list(streams);pending=memoryview(code);deadline=time.monotonic()+8
 for stream in (*readers,child.stdin):os.set_blocking(stream.fileno(),False)
 while readers or pending:
  left=deadline-time.monotonic();need(left>0)
  readable,writable,_=select.select(readers,[child.stdin] if pending else [],[],min(left,.1))
  if writable:
   n=os.write(child.stdin.fileno(),pending[:8192]);pending=pending[n:]
   if not pending:child.stdin.close()
  for stream in readable:
   block=os.read(stream.fileno(),4096)
   if not block:readers.remove(stream);continue
   streams[stream].extend(block);need(len(streams[stream])<=(OUTPUT_CAP if stream is child.stdout else STDERR_CAP))
 child.wait(timeout=max(.001,deadline-time.monotonic()));need(child.returncode==0 and not streams[child.stderr])
 checked(SOURCE_PATH,SOURCE_BYTES,SOURCE_SHA);checked(MODULE_PATH,MODULE_BYTES,MODULE_SHA)
 raw=bytes(streams[child.stdout]);validate_capture(raw);sys.stdout.buffer.write(raw)
except BaseException:sys.stdout.write('{"classification":"RESKIN_FACTS_STOP"}')
finally:
 signal.alarm(0)
 if child:
  if child.poll() is None:
   try:child.kill();child.wait(timeout=2)
   except BaseException:pass
  for stream in (child.stdin,child.stdout,child.stderr):
   if stream:stream.close()
'''

def prepare_program():
    for name,sha in PINS.items():
        require(hashlib.sha256((HERE/name).read_bytes()).hexdigest()==sha)
    own=Path(__file__).read_text()
    names=('SOURCE_PATH','SOURCE_SHA','SOURCE_BYTES','MODULE_PATH','MODULE_SHA','MODULE_BYTES','OUTPUT_CAP','STDERR_CAP','PUBLIC_HOOKS','PHP_PARSER')
    constants='\n'.join(n+' = '+repr(globals()[n]) for n in names)
    funcs=[]
    for node in ast.parse(own).body:
        if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ('Stop','require','validate_capture'):
            funcs.append(ast.get_source_segment(own,node))
    return ('import json,re\n'+constants+'\n'+'\n'.join(funcs)+'\n'+REMOTE).encode()

SSH_ARGV = ('ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
            '-o','ConnectTimeout=8','missionmed-kinsta','python3','-')

def prepare_capture_adapter():
    """Derive only the pinned finite capture and Dispatch definitions, dormant."""
    raw=(HERE/'native_account_qa.py').read_bytes()
    require(hashlib.sha256(raw).hexdigest()==PINS['native_account_qa.py'])
    source=raw.decode();tree=ast.parse(source)
    selected={n.name:n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in ('Dispatch','private_capture')}
    require(set(selected)=={'Dispatch','private_capture'})
    capture=ast.get_source_segment(source,selected['private_capture'])
    marker='cap if stream is child.stdout else 65536'
    require(capture.count(marker)==1)
    capture=capture.replace(marker,'cap if stream is child.stdout else 4096',1)
    import dataclasses,os,select,subprocess,time
    namespace={'__name__':__name__,'dataclasses':dataclasses,'os':os,'select':select,
               'subprocess':subprocess,'time':time,'re':re,'Stop':Stop,'require':require,
               'REAP_SECONDS':REAP_SECONDS,'PRIVATE_ENV':{'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C'}}
    definitions='@dataclasses.dataclass(repr=False)\n'+ast.get_source_segment(source,selected['Dispatch'])+'\n'+capture
    exec(compile(definitions,'<pinned-private-capture-adapter>','exec'),namespace)
    return namespace['private_capture'],namespace['Dispatch']

def capture_prepared(program, *, admitted=False):
    """Explicit independent-admission seam; default refuses before transport."""
    require(admitted is True and type(program) is bytes and program==prepare_program())
    capture,dispatch=prepare_capture_adapter()
    import time
    try:
        return validate_capture(capture(SSH_ARGV,program,dispatch(time.monotonic()+IO_SECONDS),cap=OUTPUT_CAP))
    except Exception:
        raise Stop('RESKIN_FACTS_STOP') from None

if __name__=='__main__':
    print('DORMANT: no source, provider, tokenizer, bootstrap or transport execution')
