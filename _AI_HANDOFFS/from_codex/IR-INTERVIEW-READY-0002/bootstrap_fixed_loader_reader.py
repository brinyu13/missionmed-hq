"""Dormant two-phase fixed loader closure. Root owns each exact read admission."""
import argparse
import ast
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import struct
import time
import zlib

HERE = Path(__file__).resolve().parent
WEBROOT = '/www/theresidencyacademy_209/public'
SSH_ARGV = ('ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
            '-o','ConnectTimeout=8','missionmed-kinsta','python3','-')
IO_SECONDS, REAP_SECONDS, OUTPUT_CAP = 10, 2, 8*1024*1024
SOURCE_CAP, LAUNCHER_CAP, MANIFEST_CAP = 512*1024, 12*1024*1024, 2*1024*1024
READBACK_SHA = '72b6a68db28989a40658fe856e59b007e67670caf70ca48f24fafb83768c2c30'
REVIEW_SHA = '6257bfb4cad0e998741e3989f9736e2f000fdcb6c85fd67eb5dbce4a668e2b51'
DONOR_SHA = 'fa2e47448d759407380ba2a4b15371624e4f7d0d61510d42cd295f2ede23c916'
PRIVACY_SHA = '130b61b2ca3b446e1f864fd57c30505aac68e7848fe794b2aa5550f59d14175d'
CAPTURE_SHA = 'c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1'
TOKENIZER_METADATA_SHA = '81972c8b4fb99550f4f4ac6dde528c21a4f7f2df0bb548b56d0edc8e6e96590f'
TOKENIZER_PATH = '/usr/lib/php/20220829/tokenizer.so'
TOKENIZER_SHA = '088267fb4965e634f43151d2981b8ff60e258376684990eb0791b75b6f34878c'
TOKENIZER_BYTES = 35080
TOKENIZER_ARGV = ['/usr/bin/php8.2','-n','-d','extension='+TOKENIZER_PATH]
ENTRY_BINDINGS = {
 'wp-config.php': [10233,'a131ee7751a7779991f82a9df724efbd19dcbe58840baff913ec20af7701537f'],
 'wp-content/mu-plugins/kinsta-mu-plugins.php': [2394,'fac0c7361bdc6c02e150b60aaf02c82044141ef1276afbfd73684d37f8491e13'],
 'wp-content/mu-plugins/missionmed-matrix-account-entry.php': [33099,'9bf94300ce6a42325cfa65317a44da15c0018ad25ad295016b630e428578626a'],
 'wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php': [23426,'6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a'],
 'launcher:/usr/local/bin/wp': [7142777,'ce34ddd838f7351d6759068d09793f26755463b4a4610a5a5c0a97b68220d85c'],
}
CONFIG_TARGETS = (
 '/www/theresidencyacademy_209/deployment/d1-500-runtime/timeline-secrets.php',
 '/www/theresidencyacademy_209/deployment/missionaccounts-runtime/missionaccounts-secrets.php')
# Manifest lookup only: no other name or archive entry is emitted/decompressed.
PHAR_PREFIX = 'phar://wp-cli.phar/'
PHAR_TARGETS = ('php/boot-phar.php','vendor/autoload.php',
 'vendor/composer/autoload_real.php','vendor/composer/autoload_static.php',
 'vendor/wp-cli/eval-command/src/EvalFile_Command.php',
 'vendor/wp-cli/wp-cli/php/bootstrap.php',
 'vendor/wp-cli/wp-cli/php/WP_CLI/Runner.php')
KINSTA_BOOT = WEBROOT+'/wp-content/mu-plugins/kinsta-mu-plugins/bootstrap.php'

class Stop(Exception):
    pass

def require(ok, label='FIXED_LOADER_STOP'):
    if not ok:
        raise Stop(label)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def safe_relative(path):
    return (type(path) is str and len(path)<=256 and
            re.fullmatch(r'(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.php',path) is not None
            and all(x not in ('','.', '..') for x in path.split('/')) and '..' not in path)

def safe_public(path):
    return (type(path) is str and path.startswith(WEBROOT+'/wp-content/')
            and safe_relative(path[len(WEBROOT)+1:]))

def regular(path, cap):
    """No-symlink, finite descriptor read with inode/time/size and path custody."""
    path=Path(path)
    for parent in (path,*path.parents):
        require(not parent.is_symlink(), 'SYMLINK_STOP')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and 0<=before.st_size<=cap,'CAP_STOP')
        chunks=[]; total=0
        while True:
            chunk=os.read(fd,min(65536,cap-total+1))
            if not chunk:break
            total+=len(chunk); require(total<=cap,'CAP_STOP'); chunks.append(chunk)
        after=os.fstat(fd); current=os.lstat(path)
        fields=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
        require(fields(before)==fields(after)==fields(current) and total==before.st_size,'SOURCE_DRIFT')
        for parent in (path,*path.parents):require(not parent.is_symlink(),'SYMLINK_STOP')
        return b''.join(chunks)
    finally:os.close(fd)

def phar_manifest(raw):
    """Parse bounded PHAR binary data; never unserialize metadata or execute PHP."""
    require(len(raw)<=LAUNCHER_CAP,'PHAR_CAP_STOP')
    # Literal stub grammar is subsequently bound to PHP token offset 8.
    marker=b'__HALT_COMPILER();'
    pos=raw[:4096].upper().find(marker)
    require(pos>=0 and raw[:4096].upper().count(marker)==1,'PHAR_STUB_STOP')
    end=pos+len(marker)
    tail=raw[end:end+5]
    if tail.startswith(b' ?>\r\n'):end+=5
    elif tail.startswith(b' ?>\n'):end+=4
    elif tail.startswith(b'?>\r\n'):end+=4
    elif tail.startswith(b'?>\n'):end+=3
    elif tail.startswith(b'\r\n'):end+=2
    elif tail.startswith(b'\n'):end+=1
    cursor=end
    def take(n):
        nonlocal cursor
        require(type(n) is int and 0<=n<=MANIFEST_CAP and cursor+n<=len(raw),'PHAR_BOUNDS_STOP')
        value=raw[cursor:cursor+n];cursor+=n;return value
    def u32():return struct.unpack('<I',take(4))[0]
    length=u32();require(18<=length<=MANIFEST_CAP,'PHAR_MANIFEST_STOP')
    manifest_end=cursor+length;require(manifest_end<=len(raw),'PHAR_BOUNDS_STOP')
    count=u32();require(0<count<=10000,'PHAR_COUNT_STOP')
    # PHP's x.y.z manifest API is stored as 0xyz0 in big-endian order.
    version=struct.unpack('>H',take(2))[0];require(version in (0x1000,0x1010,0x1100,0x1110), 'PHAR_VERSION_STOP')
    flags=u32();alias=take(u32())
    require(alias in (b'',b'wp-cli.phar'),'PHAR_PREFIX_STOP')
    take(u32()) # opaque global metadata, never decoded/unserialized
    records=[];seen=set()
    for _ in range(count):
        name=take(u32())
        require(len(name)<=512 and b'\x00' not in name,'PHAR_PATH_STOP')
        try:name=name.decode('ascii')
        except UnicodeError:raise Stop('PHAR_PATH_STOP') from None
        require(not name.startswith('/') and '\\' not in name and ':' not in name
                and all(x not in ('','.', '..') for x in name.rstrip('/').split('/')),'PHAR_PATH_STOP')
        require(name not in seen,'PHAR_DUPLICATE_STOP');seen.add(name)
        size=u32(); timestamp=u32();compressed=u32();crc=u32();entry_flags=u32();take(u32())
        records.append((name,size,compressed,crc,entry_flags))
        require(cursor<=manifest_end,'PHAR_MANIFEST_STOP')
    require(cursor==manifest_end,'PHAR_MANIFEST_STOP')
    selected={};offset=manifest_end
    for name,size,compressed,crc,entry_flags in records:
        require(offset+compressed<=len(raw),'PHAR_BOUNDS_STOP')
        if name in PHAR_TARGETS:
            require(size<=SOURCE_CAP and compressed<=SOURCE_CAP,'PHAR_ENTRY_CAP_STOP')
            require(entry_flags & 0x3000 in (0,0x1000),'PHAR_COMPRESSION_STOP')
            selected[name]=(offset,size,compressed,crc,entry_flags & 0x3000)
        offset+=compressed
    # An actual unsupported signature/trailer is a bounded gap, never PHP fallback.
    require(flags & ~0x00013000 == 0,'PHAR_FLAGS_STOP')
    return raw[:end],selected

def phar_entry(raw, entry):
    offset,size,compressed,crc,compression=entry
    payload=raw[offset:offset+compressed]
    if compression:
        decoder=zlib.decompressobj(-15)
        payload=decoder.decompress(payload,SOURCE_CAP+1)
        require(decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail,'PHAR_DEFLATE_STOP')
    require(len(payload)==size and len(payload)<=SOURCE_CAP and zlib.crc32(payload)&0xffffffff==crc,'PHAR_ENTRY_DRIFT')
    return payload

# Fixed recognizers emit only public loader-path facts from five hash-bound entries.
# A dynamic/noncanonical grammar yields a closed stop, with no guessed path.
FACT_PHP = r'''<?php
error_reporting(0);set_error_handler(function(){throw new RuntimeException('STOP');});
try{
 $entries=json_decode(base64_decode('SOURCES_B64'),true,512,JSON_THROW_ON_ERROR);$facts=[];
 $root='/www/theresidencyacademy_209/public';
 $check=function($v){if(!$v){throw new RuntimeException('STOP');}};
 $literal=function($t)use($check){$check(is_array($t)&&token_name($t[0])==='T_CONSTANT_ENCAPSED_STRING');$v=substr($t[1],1,-1);$check(strpos($v,'\\')===false&&strpos($v,'$')===false);return $v;};
 $kind=function($t,$k,$v=null){return is_array($t)&&token_name($t[0])===$k&&($v===null||$t[1]===$v);};
 $public=function($v)use($root){return strpos($v,$root.'/wp-content/')===0&&strlen($v)<=512&&preg_match('~^/[A-Za-z0-9_./-]+\.php$~D',$v)&&strpos($v,'..')===false&&strpos($v,'//')===false;};
 foreach($entries as $e){
  $raw=base64_decode($e['source'],true);$check($raw!==false);$sig=[];
  foreach(token_get_all($raw) as $t){if(is_array($t)&&in_array(token_name($t[0]),['T_WHITESPACE','T_COMMENT','T_DOC_COMMENT'],true)){continue;}$sig[]=$t;}
  $role=$e['role'];$sites=[];
  if($role==='wp-config.php'){
   foreach([110,113] as $i){$check($kind($sig[$i]??null,'T_REQUIRE_ONCE')&&($sig[$i+2]??null)===';');$p=$literal($sig[$i+1]);$allowed=['/www/theresidencyacademy_209/deployment/d1-500-runtime/timeline-secrets.php','/www/theresidencyacademy_209/deployment/missionaccounts-runtime/missionaccounts-secrets.php'];$check($p===$allowed[count($sites)]);$sites[]=['site'=>$i,'target'=>$p,'base'=>'absolute','guard'=>'unconditional','mode'=>'config'];}
  }elseif($role==='wp-content/mu-plugins/kinsta-mu-plugins.php'){
   $i=36;$check($kind($sig[$i]??null,'T_REQUIRE')&&$kind($sig[$i+1]??null,'T_STRING','PLUGIN_DIR')&&($sig[$i+2]??null)==='.'&&($sig[$i+4]??null)===';');
   $binding=[];$plainDir=false;$declarations=0;for($j=0;$j<$i-4;$j++){
    if($kind($sig[$j],'T_CONST')&&$kind($sig[$j+1],'T_STRING','PLUGIN_DIR')){$declarations++;}
    if($kind($sig[$j],'T_CONST')&&$kind($sig[$j+1],'T_STRING','PLUGIN_DIR')&&$sig[$j+2]==='='&&$kind($sig[$j+3],'T_DIR')&&$sig[$j+4]===';'){$binding[]=$root.'/wp-content/mu-plugins';$plainDir=true;}
    elseif($kind($sig[$j],'T_CONST')&&$kind($sig[$j+1],'T_STRING','PLUGIN_DIR')&&$sig[$j+2]==='='&&$sig[$j+4]===';'){$binding[]=$literal($sig[$j+3]);}
    elseif($kind($sig[$j],'T_CONST')&&$kind($sig[$j+1],'T_STRING','PLUGIN_DIR')&&$sig[$j+2]==='='&&$kind($sig[$j+3],'T_DIR')&&$sig[$j+4]==='.'&&($sig[$j+6]??null)===';'){$binding[]=$root.'/wp-content/mu-plugins'.$literal($sig[$j+5]);}}
   $check(count($binding)===1&&(!$plainDir||$declarations===1));$b=$binding[0];$suffix=$literal($sig[$i+3]);
   // Only literal absolute public PLUGIN_DIR; relative/stream/env binding is refused.
   $p=$b.$suffix;$check($public($p));
   if($plainDir){$check($p===$root.'/wp-content/mu-plugins/kinsta-mu-plugins/vendor/autoload.php');}
   $sites[]=['site'=>$i,'target'=>$p,'base'=>'PLUGIN_DIR_literal','guard'=>'unconditional','mode'=>'loader_init'];
  }elseif(in_array($role,['wp-content/mu-plugins/missionmed-matrix-account-entry.php','wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php'],true)){
   $i=$role==='wp-content/mu-plugins/missionmed-matrix-account-entry.php'?282:27;
   $check($kind($sig[$i]??null,'T_REQUIRE_ONCE')&&$kind($sig[$i+1]??null,'T_VARIABLE')&&($sig[$i+2]??null)===';');$var=$sig[$i+1][1];$binding=[];$guard=false;
   for($j=0;$j<$i-4;$j++){
    if($kind($sig[$j],'T_VARIABLE',$var)&&$sig[$j+1]==='='&&$kind($sig[$j+2],'T_STRING','WP_PLUGIN_DIR')&&$sig[$j+3]==='.'&&($sig[$j+5]??null)===';'){$binding[]=$literal($sig[$j+4]);}
    if($kind($sig[$j],'T_STRING','file_exists')&&$sig[$j+1]==='('&&$kind($sig[$j+2],'T_VARIABLE',$var)&&$sig[$j+3]===')'){$guard=true;}
   }
   $check(count($binding)===1&&$guard);$suffix=$binding[0];$check(strpos($suffix,'/')===0);$p=$root.'/wp-content/plugins'.$suffix;$check($public($p));
   $sites[]=['site'=>$i,'target'=>$p,'base'=>'WP_PLUGIN_DIR_default_candidate','guard'=>'file_exists','mode'=>'loader_init'];
  }elseif($role==='launcher:/usr/local/bin/wp'){
   $i=8;$check($kind($sig[$i]??null,'T_INCLUDE')&&($sig[$i+2]??null)===';');$p=$literal($sig[$i+1]);$check($p==='phar://wp-cli.phar/php/boot-phar.php');
   $check($kind($sig[2]??null,'T_STRING','Phar')&&$kind($sig[3]??null,'T_DOUBLE_COLON')&&$kind($sig[4]??null,'T_STRING','mapPhar'));
   $sites[]=['site'=>$i,'target'=>$p,'base'=>'fixed_phar_prefix','guard'=>'unconditional','mode'=>'loader_init'];
  }else{throw new RuntimeException('STOP');}
  foreach($sites as $s){$s['entryRole']=$role;$facts[]=$s;}
 }
 echo json_encode(['facts'=>$facts],JSON_THROW_ON_ERROR);
}catch(Throwable $e){echo '{"classification":"FIXED_SYNTAX_STOP"}';exit(1);}
'''

OVERRIDE_PHP = r'''<?php
error_reporting(0);set_error_handler(function(){throw new RuntimeException('STOP');});
try{
 $entries=json_decode(base64_decode('SOURCES_B64'),true,512,JSON_THROW_ON_ERROR);
 $plugin=false;$content=false;$unknown=false;
 foreach($entries as $e){
  $sig=[];foreach(token_get_all(base64_decode($e['source'],true)) as $t){if(is_array($t)&&in_array(token_name($t[0]),['T_WHITESPACE','T_COMMENT','T_DOC_COMMENT'],true)){continue;}$sig[]=$t;}
  for($i=0;$i<count($sig);$i++){
   $t=$sig[$i];if(!is_array($t)){continue;}$kind=token_name($t[0]);
   if($kind==='T_EVAL'){$unknown=true;}
   if($kind==='T_CONST'&&is_array($sig[$i+1]??null)){$name=$sig[$i+1][1];if($name==='WP_PLUGIN_DIR'){$plugin=true;}if($name==='WP_CONTENT_DIR'){$content=true;}}
   if(!in_array($kind,['T_STRING','T_NAME_FULLY_QUALIFIED'],true)||!in_array(strtolower($t[1]),['define','\\define'],true)||($sig[$i+1]??null)!=='('){continue;}
   $prev=$sig[$i-1]??null;
   if(is_array($prev)&&in_array(token_name($prev[0]),['T_OBJECT_OPERATOR','T_NULLSAFE_OBJECT_OPERATOR','T_DOUBLE_COLON'],true)){continue;}
   $arg=$sig[$i+2]??null;
   if(!is_array($arg)||token_name($arg[0])!=='T_CONSTANT_ENCAPSED_STRING'||($sig[$i+3]??null)!==','){$unknown=true;continue;}
   $name=substr($arg[1],1,-1);
   // Escaped/interpolated first arguments are not literal bindings.
   if(strpos($name,'\\')!==false||strpos($name,'$')!==false){$unknown=true;continue;}
   if($name==='WP_PLUGIN_DIR'){$plugin=true;}if($name==='WP_CONTENT_DIR'){$content=true;}
  }
 }
 echo json_encode(['standardPluginRootOverridden'=>$plugin,'standardContentRootOverridden'=>$content,'dynamicDefinitionUnresolved'=>$unknown],JSON_THROW_ON_ERROR);
}catch(Throwable $e){echo '{"classification":"FIXED_ROOT_BINDING_STOP"}';exit(1);}
'''

# Slicer acts on tokens only. Preserve file top level and only named init/bootstrap
# methods; hidden methods are explicit gaps, never treated as qualified effects.
SLICE_PHP = r'''
  if(($entry['mode']??'')==='loader_init'){
   $sliced=[];$suppressed=0;
   for($si=0;$si<count($tokens);$si++){
    $t=$tokens[$si];$sliced[]=$t;
    if(is_array($t)&&token_name($t[0])==='T_FUNCTION'){
     $j=$si+1;while($j<count($tokens)&&(is_array($tokens[$j])&&in_array(token_name($tokens[$j][0]),['T_WHITESPACE','T_COMMENT','T_DOC_COMMENT'],true)||$tokens[$j]==='&')){$j++;}
     $n=(is_array($tokens[$j]??null)&&token_name($tokens[$j][0])==='T_STRING')?$tokens[$j][1]:null;
     if($n!==null&&!in_array(strtolower($n),['init','bootstrap','get_autoloader','__invoke','load_wordpress','start','run_command','run_command_and_exit','run','load_command','load_early_command'],true)){
      while($si+1<count($tokens)){$sliced[]=$tokens[++$si];if($tokens[$si]===';'||$tokens[$si]==='{'){break;}}
      if($tokens[$si]==='{'){$depth=1;while($depth&&$si+1<count($tokens)){$u=$tokens[++$si];if($u==='{'||(is_array($u)&&in_array(token_name($u[0]),['T_CURLY_OPEN','T_DOLLAR_OPEN_CURLY_BRACES'],true))){$depth++;}elseif($u==='}'){$depth--;}}if($depth!==0){throw new RuntimeException('STOP');}$sliced[]=[T_COMMENT,'/* REDACTED_SUPPRESSED_BODY */'];$sliced[]='}';$suppressed++;}
     }
    }
   }
   $tokens=$sliced;
  }else{$suppressed=0;}
'''

# Closed contextual call categories only; no config callable spelling or operand
# leaves the tokenizer. These are syntax facts, never function-resolution proof.
CONFIG_CALL_PHP = r'''
  $configCalls=[];
  if($isConfig){
   $calltypes=[
    'define'=>'configuration_definition_syntax','defined'=>'configuration_guard_syntax',
    'getenv'=>'environment_read_syntax','file_get_contents'=>'file_read_syntax',
    'trim'=>'scalar_transform_syntax','ini_set'=>'runtime_setting_syntax',
    'curl_init'=>'transport_syntax','curl_exec'=>'transport_syntax','curl_multi_exec'=>'transport_syntax',
    'file_put_contents'=>'filesystem_write_syntax','unlink'=>'filesystem_write_syntax',
    'rename'=>'filesystem_write_syntax','mkdir'=>'filesystem_write_syntax','copy'=>'filesystem_write_syntax',
    'chmod'=>'filesystem_write_syntax','chown'=>'filesystem_write_syntax',
    'exec'=>'process_launch_syntax','shell_exec'=>'process_launch_syntax','system'=>'process_launch_syntax',
    'passthru'=>'process_launch_syntax','proc_open'=>'process_launch_syntax','popen'=>'process_launch_syntax',
    'mysqli_connect'=>'database_syntax','mysqli_query'=>'database_syntax','mysqli_multi_query'=>'database_syntax',
    'pg_connect'=>'database_syntax','pg_query'=>'database_syntax',
    'call_user_func'=>'indirect_call_syntax','call_user_func_array'=>'indirect_call_syntax'];
   for($ci=0;$ci<count($sig);$ci++){
    $ct=$sig[$ci];if(!is_array($ct)||($sig[$ci+1]??null)!=='('){continue;}
    $ck=token_name($ct[0]);$prev=$sig[$ci-1]??null;
    $pk=is_array($prev)?token_name($prev[0]):null;
    if(in_array($pk,['T_FUNCTION','T_FN'],true)){continue;}
    $category=null;
    if(in_array($ck,['T_STRING','T_NAME_QUALIFIED','T_NAME_FULLY_QUALIFIED','T_NAME_RELATIVE'],true)){
     if(in_array($pk,['T_OBJECT_OPERATOR','T_NULLSAFE_OBJECT_OPERATOR','T_DOUBLE_COLON'],true)){$category='opaque_method_call_syntax';}
     elseif($pk==='T_NEW'){$category='opaque_constructor_call_syntax';}
     else{$name=strtolower($ct[1]);if($ck==='T_NAME_FULLY_QUALIFIED'){$name=substr($name,1);}$category=$calltypes[$name]??'unclassified_call_syntax';}
    }elseif($ck==='T_VARIABLE'){$category='indirect_call_syntax';}
    elseif($ck==='T_EVAL'){$category='eval_syntax';}
    if($category!==null){$configCalls[]=['tokenOffset'=>$ci,'callType'=>$category];}
   }
  }
'''

CONFIG_CALL_TYPES = frozenset((
 'configuration_definition_syntax','configuration_guard_syntax','environment_read_syntax',
 'file_read_syntax','scalar_transform_syntax','runtime_setting_syntax','transport_syntax',
 'filesystem_write_syntax','process_launch_syntax','database_syntax','indirect_call_syntax',
 'opaque_method_call_syntax','opaque_constructor_call_syntax','unclassified_call_syntax','eval_syntax'))

def donor_constants():
    raw=regular(HERE/'bootstrap_static_reader.py',65536)
    require(digest(raw)==DONOR_SHA,'DONOR_DRIFT')
    wanted={'KEYWORDS','DECLARATIONS','OPAQUE','PUNCTUATION','SAFE_CONSTANTS','PUBLIC_HOOKS','PHP_READER'}
    values={}
    for node in ast.parse(raw).body:
        if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name):
            name=node.targets[0].id
            if name in wanted:
                if name=='PUNCTUATION':values[name]=sorted(ast.literal_eval(node.value.args[0]))
                else:values[name]=ast.literal_eval(node.value)
    require(set(values)==wanted,'DONOR_POLICY_STOP')
    return values

def render_template():
    values=donor_constants();php=values.pop('PHP_READER')
    # Fixed PHP syntax only; variable/name tokens keep the existing masking.
    values['PUNCTUATION']=sorted(set(values['PUNCTUATION'])|{'$'})
    values['KEYWORDS']['T_NS_SEPARATOR']='\\'
    # Config has no literal facts and no source identifiers, including constants,
    # declaration names, magic names, custom callable/type/variable names.
    php=php.replace("$sig=[];foreach($tokens as $t)",SLICE_PHP+"\n  $sig=[];foreach($tokens as $t)",1)
    php=php.replace("$ids=[];$render='';", "$isConfig=($entry['mode']??'')==='config';if($isConfig){$names=[];}\n  $ids=[];$render='';")
    php=php.replace("isset($names[$text])||in_array($text,$policy['safeConstants'],true)||preg_match('/^[A-Z_][A-Z0-9_]*$/D',$text)","(!$isConfig&&(isset($names[$text])||in_array($text,$policy['safeConstants'],true)||preg_match('/^[A-Z_][A-Z0-9_]*$/D',$text)))")
    php=php.replace("&&isset($names[$text]))", "&&!$isConfig&&isset($names[$text]))")
    # No secondary secret paths, names, guard/hook/include facts leave config.
    php=php.replace("$out[]=['guardFacts'", CONFIG_CALL_PHP+"\n if($isConfig){$paths=[];$includeFacts=[];$guardFacts=[];$hooks=[];}\n  $out[]=['configCallFacts'=>$configCalls,'suppressedBodies'=>$suppressed,'guardFacts'")
    policy={'keywords':values['KEYWORDS'],'declarations':values['DECLARATIONS'],
      'opaque':values['OPAQUE'],'punctuation':values['PUNCTUATION'],
      'safeConstants':values['SAFE_CONSTANTS'],'publicHooks':values['PUBLIC_HOOKS'],
      'configRoles':[],'redactedCap':1024*1024,'outputCap':OUTPUT_CAP}
    return php.replace('POLICY_B64',base64.b64encode(json.dumps(policy,sort_keys=True).encode()).decode())

def dependencies():
    for name,sha,cap in (
      ('BOOTSTRAP_STATIC_SOURCE_READBACK_3.json',READBACK_SHA,OUTPUT_CAP),
      ('BOOTSTRAP_ACTUAL_SOURCE_SEMANTIC_REVIEW_3.md',REVIEW_SHA,32768),
      ('BOOTSTRAP_SEMANTIC_READER_DELTA_REVIEW.md',PRIVACY_SHA,16384),
      ('native_account_qa.py',CAPTURE_SHA,65536),
      ('BOOTSTRAP_INSTALLED_TOKENIZER_METADATA_READBACK_1.json',TOKENIZER_METADATA_SHA,4096)):
        raw=regular(HERE/name,cap);require(digest(raw)==sha,'DEPENDENCY_DRIFT')
        if name=='BOOTSTRAP_STATIC_SOURCE_READBACK_3.json':
            files={f['role']:[f['bytes'],f['sourceSha256']] for f in json.loads(raw)['capture']['files']}
            require(all(files.get(k)==v for k,v in ENTRY_BINDINGS.items()),'ENTRY_BINDING_DRIFT')
    donor_constants()

REMOTE_MAIN = r'''
import signal,subprocess,sys
child=None
owned=[]
def alarm(signum,frame):raise Stop('DEADLINE_STOP')
signal.signal(signal.SIGALRM,alarm);signal.alarm(8)
def checked(path,cap,binding=None):
 raw=regular(path,cap)
 if binding is not None:require([len(raw),digest(raw)]==binding,'SOURCE_DRIFT')
 owned.append((path,cap,[len(raw),digest(raw)]));return raw
def tokenize(template,records):
 global child
 checked(TOKENIZER_PATH,TOKENIZER_BYTES,[TOKENIZER_BYTES,TOKENIZER_SHA])
 program=template.replace('SOURCES_B64',base64.b64encode(json.dumps(records,separators=(',',':')).encode()).decode())
 child=subprocess.Popen(TOKENIZER_ARGV,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 result,_=child.communicate(program.encode(),timeout=6)
 require(child.returncode==0 and len(result)<=OUTPUT_CAP,'TOKENIZER_STOP')
 checked(TOKENIZER_PATH,TOKENIZER_BYTES,[TOKENIZER_BYTES,TOKENIZER_SHA])
 return json.loads(result)
try:
 entries=[];launcher=None;manifest=None;configs=[]
 for role,binding in ENTRY_BINDINGS.items():
  path='/usr/local/bin/wp' if role.startswith('launcher:') else WEBROOT+'/'+role
  raw=checked(path,LAUNCHER_CAP if role.startswith('launcher:') else SOURCE_CAP,binding)
  if role.startswith('launcher:'):
   launcher=raw;raw,manifest=phar_manifest(raw)
  entries.append({'role':role,'source':base64.b64encode(raw).decode()})
  if role=='wp-config.php':configs.append(entries[-1])
 facts=tokenize(FACT_PHP,entries)['facts']
 targets=[]
 for fact in facts:
  if fact['target'].startswith(PHAR_PREFIX):continue
  p=fact['target'];row={'path':p,'mode':fact['mode'],'present':os.path.lexists(p)}
  if row['present']:
   raw=checked(p,SOURCE_CAP);row.update(bytes=len(raw),sha256=digest(raw))
  targets.append(row)
  if fact['mode']=='config' and row['present']:configs.append({'role':p,'source':base64.b64encode(raw).decode()})
 root_binding=tokenize(OVERRIDE_PHP,configs)
 if any(not r['present'] for r in targets if r['mode']=='config'):root_binding['dynamicDefinitionUnresolved']=True
 # Qualified provider bootstrap path: fixed nine-edge provenance, metadata only.
 p=KINSTA_BOOT;row={'path':p,'mode':'loader_init','present':os.path.lexists(p)}
 if row['present']:
  raw=checked(p,SOURCE_CAP);row.update(bytes=len(raw),sha256=digest(raw))
 targets.append(row)
 # Selected PHAR entry data only, no directory dump or recursive adoption.
 for name in PHAR_TARGETS:
  row={'path':PHAR_PREFIX+name,'mode':'loader_init','present':name in manifest}
  if row['present']:
   raw=phar_entry(launcher,manifest[name]);row.update(bytes=len(raw),sha256=digest(raw))
  targets.append(row)
 targets=sorted(targets,key=lambda x:x['path'])
 value={'schema':'ir.bootstrap.fixed_loader_metadata.v1','classification':'FIXED_TARGET_FACTS_NOT_APPROVAL',
        'facts':facts,'targets':targets,'entryBindings':ENTRY_BINDINGS,
        'noAutomaticAdoption':True,'rootBindingFacts':root_binding}
 if PHASE=='bodies':
  require(value==FROZEN_METADATA,'TARGET_METADATA_DRIFT')
  records=[]
  for row in targets:
   if not row['present']:continue
   path=row['path']
   raw=phar_entry(launcher,manifest[path[len(PHAR_PREFIX):]]) if path.startswith(PHAR_PREFIX) else checked(path,SOURCE_CAP,[row['bytes'],row['sha256']])
   records.append({'role':path,'mode':row['mode'],'source':base64.b64encode(raw).decode()})
  rendered=tokenize(RENDER_PHP,records)
  require(len(rendered['files'])==len(records),'BODY_COUNT_STOP')
  value={'schema':'ir.bootstrap.fixed_loader_closure.v1','classification':'STATIC_REDACTED_CLOSURE_NOT_APPROVAL',
         'metadata':value,'files':rendered['files'],'noSemanticApproval':True}
 for path,cap,binding in owned:require([len(raw:=regular(path,cap)),digest(raw)]==binding,'SOURCE_DRIFT')
 payload=json.dumps(value,separators=(',',':')).encode();require(len(payload)<=OUTPUT_CAP,'OUTPUT_CAP_STOP')
 sys.stdout.buffer.write(payload)
except BaseException:
 if child is not None and child.poll() is None:
  try:child.kill();child.wait(timeout=REAP_SECONDS)
  except BaseException:pass
 sys.stdout.write('{"classification":"FIXED_LOADER_STOP"}');sys.exit(1)
finally:
 signal.alarm(0)
'''

def validate_metadata(value):
    require(type(value) is dict and set(value)=={'schema','classification','facts','targets','entryBindings','noAutomaticAdoption','rootBindingFacts'})
    require(value['schema']=='ir.bootstrap.fixed_loader_metadata.v1' and value['classification']=='FIXED_TARGET_FACTS_NOT_APPROVAL')
    require(value['entryBindings']==ENTRY_BINDINGS and value['noAutomaticAdoption'] is True)
    require(type(value['rootBindingFacts']) is dict and set(value['rootBindingFacts'])=={'standardPluginRootOverridden','standardContentRootOverridden','dynamicDefinitionUnresolved'} and all(type(x) is bool for x in value['rootBindingFacts'].values()))
    expected=[('wp-config.php',110),('wp-config.php',113),
       ('wp-content/mu-plugins/kinsta-mu-plugins.php',36),
       ('wp-content/mu-plugins/missionmed-matrix-account-entry.php',282),
       ('wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php',27),
       ('launcher:/usr/local/bin/wp',8)]
    require(type(value['facts']) is list and [(f.get('entryRole'),f.get('site')) for f in value['facts']]==expected)
    paths={}
    for f in value['facts']:
        require(set(f)=={'entryRole','site','target','base','guard','mode'})
        role=f['entryRole'];p=f['target']
        if role=='wp-config.php':require(p==CONFIG_TARGETS[0 if f['site']==110 else 1] and (f['base'],f['guard'],f['mode'])==('absolute','unconditional','config'))
        elif role.startswith('launcher:'):require(p==PHAR_PREFIX+'php/boot-phar.php' and (f['base'],f['guard'],f['mode'])==('fixed_phar_prefix','unconditional','loader_init'))
        else:
            require(safe_public(p) and f['mode']=='loader_init')
            if 'kinsta' in role:require(f['base']=='PLUGIN_DIR_literal' and f['guard']=='unconditional' and p.startswith(WEBROOT+'/wp-content/mu-plugins/'))
            else:require(f['base']=='WP_PLUGIN_DIR_default_candidate' and f['guard']=='file_exists' and p.startswith(WEBROOT+'/wp-content/plugins/'))
        if not p.startswith(PHAR_PREFIX):require(p not in paths,'DUPLICATE_TARGET');paths[p]=f['mode']
    paths[KINSTA_BOOT]='loader_init'
    paths.update({PHAR_PREFIX+x:'loader_init' for x in PHAR_TARGETS})
    require(type(value['targets']) is list and [r.get('path') for r in value['targets']]==sorted(paths))
    for row in value['targets']:
        require(type(row) is dict and type(row.get('present')) is bool and row.get('mode')==paths[row['path']])
        require(set(row)==({'path','mode','present','bytes','sha256'} if row['present'] else {'path','mode','present'}))
        if row['present']:require(type(row['bytes']) is int and 0<=row['bytes']<=SOURCE_CAP and type(row['sha256']) is str and re.fullmatch('[0-9a-f]{64}',row['sha256']))
    return value

def prepare_program(phase='metadata', frozen=None):
    """Prepare only. `bodies` needs exact separately reviewed metadata, no adoption."""
    dependencies();require(phase in ('metadata','bodies'),'PHASE_STOP')
    require((phase=='metadata' and frozen is None) or (phase=='bodies' and frozen is not None),'FROZEN_REQUIRED')
    if frozen is not None:validate_metadata(frozen)
    constants={k:globals()[k] for k in ('WEBROOT','SOURCE_CAP','LAUNCHER_CAP','MANIFEST_CAP','OUTPUT_CAP','REAP_SECONDS','ENTRY_BINDINGS','CONFIG_TARGETS','PHAR_PREFIX','PHAR_TARGETS','KINSTA_BOOT','TOKENIZER_PATH','TOKENIZER_SHA','TOKENIZER_BYTES','TOKENIZER_ARGV','FACT_PHP','OVERRIDE_PHP')}
    constants.update(PHASE=phase,FROZEN_METADATA=frozen,RENDER_PHP=render_template() if phase=='bodies' else None)
    headers='import base64,hashlib,json,os,re,stat,struct,zlib\nfrom pathlib import Path\n'
    own=regular(HERE/'bootstrap_fixed_loader_reader.py',65536).decode()
    names={'Stop','require','digest','safe_relative','safe_public','regular','phar_manifest','phar_entry'}
    source='\n'.join(ast.get_source_segment(own,n) for n in ast.parse(own).body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in names)
    return headers+'\n'.join(k+' = '+repr(v) for k,v in constants.items())+'\n'+source+'\n'+REMOTE_MAIN

def capture_prepared(capture,program,budget,*,phase='metadata',frozen=None):
    """Injected existing private_capture seam. No transport is loaded automatically."""
    try:
        require(program==prepare_program(phase,frozen),'PROGRAM_DRIFT')
        deadline=budget.deadline
        require(type(deadline) in (int,float) and math.isfinite(deadline) and 0<deadline-time.monotonic()<=IO_SECONDS,'DEADLINE_STOP')
        raw=capture(SSH_ARGV,program.encode(),budget,cap=OUTPUT_CAP)
        require(type(raw) is bytes and len(raw)<=OUTPUT_CAP,'CAP_STOP');value=json.loads(raw)
        if phase=='metadata':return validate_metadata(value)
        require(type(value) is dict and set(value)=={'schema','classification','metadata','files','noSemanticApproval'})
        require(value['schema']=='ir.bootstrap.fixed_loader_closure.v1' and value['classification']=='STATIC_REDACTED_CLOSURE_NOT_APPROVAL' and value['noSemanticApproval'] is True and value['metadata']==frozen)
        validate_metadata(value['metadata'])
        present=[r for r in frozen['targets'] if r['present']]
        require(type(value['files']) is list and len(value['files'])==len(present))
        for item,row in zip(value['files'],present):
            require(set(item)=={'configCallFacts','suppressedBodies','guardFacts','includeSiteFacts','closedPublicRegistrations','role','sourceSha256','bytes','redactedSource','includeCandidates','dynamicIncludes'})
            require([item['role'],item['bytes'],item['sourceSha256']]==[row['path'],row['bytes'],row['sha256']])
            require(type(item['redactedSource']) is str and len(item['redactedSource'].encode())<=1024*1024)
            require(type(item['suppressedBodies']) is int and 0<=item['suppressedBodies']<=SOURCE_CAP)
            require(type(item['configCallFacts']) is list and len(item['configCallFacts'])<=SOURCE_CAP)
            for fact in item['configCallFacts']:
                require(type(fact) is dict and set(fact)=={'tokenOffset','callType'} and type(fact['tokenOffset']) is int and 0<=fact['tokenOffset']<=SOURCE_CAP and fact['callType'] in CONFIG_CALL_TYPES)
            if row['mode']=='config':require(not any(item[k] for k in ('guardFacts','includeSiteFacts','closedPublicRegistrations','includeCandidates')))
            else:require(not item['configCallFacts'])
        return value
    except BaseException:raise Stop('PRIVATE_CAPTURE_STOP') from None

DIAGNOSTIC_CAP = 2048
DIAGNOSTIC_STAGES = frozenset((
 'START','READ_MAIN_CONFIG','READ_KINSTA_ENTRY','READ_MATRIX_ENTRY','READ_SCANNER_ENTRY',
 'READ_CLI_LAUNCHER','PHAR_MANIFEST_PARSE','FACT_TOKENIZATION','FIXED_TARGET_METADATA',
 'ROOT_BINDING_TOKENIZATION','KINSTA_BOOT_METADATA','SELECTED_PHAR_METADATA',
 'FINAL_SOURCE_RECHECK','COMPLETE'))
DIAGNOSTIC_REASONS = frozenset((
 'NONE','FIXED_LOADER_STOP','SYMLINK_STOP','CAP_STOP','SOURCE_DRIFT','PHAR_CAP_STOP',
 'PHAR_STUB_STOP','PHAR_BOUNDS_STOP','PHAR_MANIFEST_STOP','PHAR_COUNT_STOP',
 'PHAR_VERSION_STOP','PHAR_PREFIX_STOP','PHAR_PATH_STOP','PHAR_DUPLICATE_STOP',
 'PHAR_ENTRY_CAP_STOP','PHAR_COMPRESSION_STOP','PHAR_FLAGS_STOP','PHAR_DEFLATE_STOP',
 'PHAR_ENTRY_DRIFT','TOKENIZER_STOP','FIXED_SYNTAX_STOP','FIXED_ROOT_BINDING_STOP',
 'DEADLINE_STOP','OUTPUT_CAP_STOP','READ_ABSENT_STOP','READ_PERMISSION_STOP',
 'TOKENIZER_TIMEOUT_STOP','STRUCTURE_STOP','INTERNAL_STOP'))

def prepare_diagnostic_program():
    """Prepare status only; normal metadata bytes and its failed-exit rule stay intact."""
    program=prepare_program()
    prefix=("DIAGNOSTIC_STAGE='START'\nDIAGNOSTIC_STAGES="+repr(sorted(DIAGNOSTIC_STAGES))+
      "\nDIAGNOSTIC_REASONS="+repr(sorted(DIAGNOSTIC_REASONS))+r'''
def diagnostic_reason(issue):
 if type(issue) is Stop and len(issue.args)==1:
  for reason in DIAGNOSTIC_REASONS:
   if reason!='NONE' and issue.args==(reason,):return reason
 if isinstance(issue,FileNotFoundError):return 'READ_ABSENT_STOP'
 if isinstance(issue,PermissionError):return 'READ_PERMISSION_STOP'
 if isinstance(issue,subprocess.TimeoutExpired):return 'TOKENIZER_TIMEOUT_STOP'
 if isinstance(issue,json.JSONDecodeError):return 'STRUCTURE_STOP'
 if isinstance(issue,zlib.error):return 'PHAR_DEFLATE_STOP'
 return 'INTERNAL_STOP'
def diagnostic_emit(classification,reason):
 # Select constants; no raw exception, source, path, stdout or stderr is copied.
 stage=next((x for x in DIAGNOSTIC_STAGES if x==DIAGNOSTIC_STAGE),'START')
 value={'schema':'ir.bootstrap.fixed_loader_diagnostic.v1','classification':classification,
        'stage':stage,'reason':reason,'noSemanticApproval':True}
 payload=json.dumps(value,separators=(',',':')).encode()
 if len(payload)>2048:raise Stop('OUTPUT_CAP_STOP')
 sys.stdout.buffer.write(payload)
''')
    # Each exact replacement is applied once or preparation stops. No arbitrary
    # rewriting of source operands or new target/reader dependency is allowed.
    replacements=[
     ('try:\n entries=[];launcher=None;manifest=None;configs=[]',prefix+'\ntry:\n entries=[];launcher=None;manifest=None;configs=[]'),
     ("  path='/usr/local/bin/wp' if role.startswith('launcher:') else WEBROOT+'/'+role",
      "  DIAGNOSTIC_STAGE={'wp-config.php':'READ_MAIN_CONFIG','wp-content/mu-plugins/kinsta-mu-plugins.php':'READ_KINSTA_ENTRY','wp-content/mu-plugins/missionmed-matrix-account-entry.php':'READ_MATRIX_ENTRY','wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php':'READ_SCANNER_ENTRY','launcher:/usr/local/bin/wp':'READ_CLI_LAUNCHER'}[role]\n  path='/usr/local/bin/wp' if role.startswith('launcher:') else WEBROOT+'/'+role"),
     ('   launcher=raw;raw,manifest=phar_manifest(raw)',"   DIAGNOSTIC_STAGE='PHAR_MANIFEST_PARSE'\n   launcher=raw;raw,manifest=phar_manifest(raw)"),
     (" facts=tokenize(FACT_PHP,entries)['facts']"," DIAGNOSTIC_STAGE='FACT_TOKENIZATION'\n facts=tokenize(FACT_PHP,entries)['facts']"),
     (' targets=[]\n for fact in facts:'," DIAGNOSTIC_STAGE='FIXED_TARGET_METADATA'\n targets=[]\n for fact in facts:"),
     (' root_binding=tokenize(OVERRIDE_PHP,configs)'," DIAGNOSTIC_STAGE='ROOT_BINDING_TOKENIZATION'\n root_binding=tokenize(OVERRIDE_PHP,configs)"),
     (" p=KINSTA_BOOT;row={'path':p,'mode':'loader_init','present':os.path.lexists(p)}",
      " DIAGNOSTIC_STAGE='KINSTA_BOOT_METADATA'\n p=KINSTA_BOOT;row={'path':p,'mode':'loader_init','present':os.path.lexists(p)}"),
     (' for name in PHAR_TARGETS:\n'," DIAGNOSTIC_STAGE='SELECTED_PHAR_METADATA'\n for name in PHAR_TARGETS:\n"),
     (' for path,cap,binding in owned:require('," DIAGNOSTIC_STAGE='FINAL_SOURCE_RECHECK'\n for path,cap,binding in owned:require("),
     (' sys.stdout.buffer.write(payload)\nexcept BaseException:',
      " DIAGNOSTIC_STAGE='COMPLETE'\n diagnostic_emit('FIXED_DIAGNOSTIC_COMPLETE','NONE')\nexcept BaseException as issue:"),
     (" sys.stdout.write('{\"classification\":\"FIXED_LOADER_STOP\"}');sys.exit(1)",
      " diagnostic_emit('FIXED_DIAGNOSTIC_STOP',diagnostic_reason(issue))\n # Exit0 conveys a validated STOP status through unchanged private_capture.\n # It never conveys metadata, source bodies, approval or retry permission."),
     (" require(child.returncode==0 and len(result)<=OUTPUT_CAP,'TOKENIZER_STOP')",
      " if child.returncode!=0:\n  for label in ('FIXED_SYNTAX_STOP','FIXED_ROOT_BINDING_STOP'):\n   if result==json.dumps({'classification':label},separators=(',',':')).encode():raise Stop(label)\n require(child.returncode==0 and len(result)<=OUTPUT_CAP,'TOKENIZER_STOP')")]
    for old,new in replacements:
        require(program.count(old)==1,'DIAGNOSTIC_PREPARATION_STOP');program=program.replace(old,new,1)
    compile(program,'fixed_loader_diagnostic','exec')
    return program

def capture_diagnostic_prepared(capture,program,budget):
    """Distinct admitted diagnostic status; cannot qualify metadata or bodies."""
    try:
        require(program==prepare_diagnostic_program(),'PROGRAM_DRIFT')
        deadline=budget.deadline
        require(type(deadline) in (int,float) and math.isfinite(deadline) and 0<deadline-time.monotonic()<=IO_SECONDS,'DEADLINE_STOP')
        raw=capture(SSH_ARGV,program.encode(),budget,cap=DIAGNOSTIC_CAP)
        require(type(raw) is bytes and len(raw)<=DIAGNOSTIC_CAP,'CAP_STOP');value=json.loads(raw)
        require(type(value) is dict and set(value)=={'schema','classification','stage','reason','noSemanticApproval'})
        require(value['schema']=='ir.bootstrap.fixed_loader_diagnostic.v1' and value['noSemanticApproval'] is True)
        require(type(value['stage']) is str and value['stage'] in DIAGNOSTIC_STAGES)
        require(type(value['reason']) is str and value['reason'] in DIAGNOSTIC_REASONS)
        if value['classification']=='FIXED_DIAGNOSTIC_COMPLETE':require(value['stage']=='COMPLETE' and value['reason']=='NONE')
        else:require(value['classification']=='FIXED_DIAGNOSTIC_STOP' and value['stage']!='COMPLETE' and value['reason']!='NONE')
        return value
    except BaseException:raise Stop('PRIVATE_DIAGNOSTIC_STOP') from None

SYNTAX_BINDING_KINDS = frozenset(('CONST_DIR','CONST_DIR_CONCAT','CONST_LITERAL','UNRESOLVED'))

def syntax_status_template():
    """Observe each unchanged recognizer; no source token/operand is exported."""
    binding=r'''
  if($role==='wp-content/mu-plugins/kinsta-mu-plugins.php'){
   $bindings=[];
   for($bj=0;$bj<36;$bj++){
    if(!$kind($sig[$bj]??null,'T_CONST')||!$kind($sig[$bj+1]??null,'T_STRING','PLUGIN_DIR')||($sig[$bj+2]??null)!=='='){continue;}
    $form='UNRESOLVED';
    if($kind($sig[$bj+3]??null,'T_DIR')&&($sig[$bj+4]??null)===';'){$form='CONST_DIR';}
    elseif($kind($sig[$bj+3]??null,'T_DIR')&&($sig[$bj+4]??null)==='.'&&$kind($sig[$bj+5]??null,'T_CONSTANT_ENCAPSED_STRING')&&($sig[$bj+6]??null)===';'){$form='CONST_DIR_CONCAT';}
    elseif($kind($sig[$bj+3]??null,'T_CONSTANT_ENCAPSED_STRING')&&($sig[$bj+4]??null)===';'){$form='CONST_LITERAL';}
    $bindings[]=$form;
   }
   if(count($bindings)===1){$bindingKind=$bindings[0];}
  }
'''
    changes=[
      ('$facts=[];',"$results=[];$bindingKind='UNRESOLVED';"),
      ('foreach($entries as $e){',"$entryIndex=0;foreach($entries as $e){\n  try{"),
      ("$role=$e['role'];$sites=[];","$role=$e['role'];$sites=[];"+binding),
      ("foreach($sites as $s){$s['entryRole']=$role;$facts[]=$s;}","$results[]=['entryIndex'=>$entryIndex,'syntaxPass'=>true];"),
      (" }\n echo json_encode(['facts'=>$facts],JSON_THROW_ON_ERROR);",
       "  }catch(Throwable $ignored){$results[]=['entryIndex'=>$entryIndex,'syntaxPass'=>false];}\n  $entryIndex++;\n }\n echo json_encode(['schema'=>'ir.bootstrap.fixed_loader_syntax_status.v1','classification'=>'FIXED_SYNTAX_STATUS_NOT_APPROVAL','entries'=>$results,'kinstaBindingKind'=>$bindingKind,'noSemanticApproval'=>true],JSON_THROW_ON_ERROR);")]
    php=FACT_PHP
    for old,new in changes:
        require(php.count(old)==1,'SYNTAX_PREPARATION_STOP');php=php.replace(old,new,1)
    return php

def validate_syntax_status(value):
    require(type(value) is dict and set(value)=={'schema','classification','entries','kinstaBindingKind','noSemanticApproval'})
    require(value['schema']=='ir.bootstrap.fixed_loader_syntax_status.v1' and value['classification']=='FIXED_SYNTAX_STATUS_NOT_APPROVAL' and value['noSemanticApproval'] is True)
    require(type(value['kinstaBindingKind']) is str and value['kinstaBindingKind'] in SYNTAX_BINDING_KINDS)
    rows=value['entries'];require(type(rows) is list and len(rows)==5)
    for index,row in enumerate(rows):
        require(type(row) is dict and set(row)=={'entryIndex','syntaxPass'} and type(row['entryIndex']) is int and row['entryIndex']==index and type(row['syntaxPass']) is bool)
    return value

def prepare_syntax_diagnostic_program():
    """Status-only five-entry grammar observation; no target recognizer correction."""
    program=prepare_diagnostic_program()
    old='FACT_PHP = '+repr(FACT_PHP)
    require(program.count(old)==1,'SYNTAX_PREPARATION_STOP');program=program.replace(old,'FACT_PHP = '+repr(syntax_status_template()),1)
    own=regular(HERE/'bootstrap_fixed_loader_reader.py',65536).decode()
    nodes=[n for n in ast.parse(own).body if isinstance(n,ast.FunctionDef) and n.name=='validate_syntax_status']
    require(len(nodes)==1,'SYNTAX_PREPARATION_STOP')
    validator='SYNTAX_BINDING_KINDS = '+repr(tuple(sorted(SYNTAX_BINDING_KINDS)))+'\n'+ast.get_source_segment(own,nodes[0])+'\n'
    anchor='try:\n entries=[];launcher=None;manifest=None;configs=[]'
    require(program.count(anchor)==1,'SYNTAX_PREPARATION_STOP');program=program.replace(anchor,validator+anchor,1)
    start=program.index(" facts=tokenize(FACT_PHP,entries)['facts']")
    end=program.index('except BaseException as issue:',start)
    # Stop after one tokenizer invocation, before any loader/config2 target read.
    terminal=""" status=validate_syntax_status(tokenize(FACT_PHP,entries))
 for path,cap,binding in owned:require([len(raw:=regular(path,cap)),digest(raw)]==binding,'SOURCE_DRIFT')
 payload=json.dumps(status,separators=(',',':')).encode();require(len(payload)<=2048,'OUTPUT_CAP_STOP')
 sys.stdout.buffer.write(payload)
"""
    program=program[:start]+terminal+program[end:]
    compile(program,'fixed_loader_syntax_diagnostic','exec')
    return program

def capture_syntax_diagnostic_prepared(capture,program,budget):
    """Only closed grammar status; never metadata, body, target or approval output."""
    try:
        require(program==prepare_syntax_diagnostic_program(),'PROGRAM_DRIFT')
        deadline=budget.deadline
        require(type(deadline) in (int,float) and math.isfinite(deadline) and 0<deadline-time.monotonic()<=IO_SECONDS,'DEADLINE_STOP')
        raw=capture(SSH_ARGV,program.encode(),budget,cap=DIAGNOSTIC_CAP)
        require(type(raw) is bytes and len(raw)<=DIAGNOSTIC_CAP,'CAP_STOP')
        return validate_syntax_status(json.loads(raw))
    except BaseException:raise Stop('PRIVATE_SYNTAX_DIAGNOSTIC_STOP') from None

BODY_DIAGNOSTIC_STAGES = frozenset(DIAGNOSTIC_STAGES | {
 'FROZEN_METADATA_COMPARE','BODY_RECORD_CAPTURE','BODY_TOKENIZATION','BODY_PRODUCER_COUNT',
 'BODY_VALIDATE_SCHEMA','BODY_VALIDATE_FROZEN','BODY_VALIDATE_METADATA','BODY_VALIDATE_COUNT',
 'BODY_VALIDATE_ROW_SCHEMA','BODY_VALIDATE_ROW_CUSTODY','BODY_VALIDATE_ROW_LIMITS',
 'BODY_VALIDATE_CALL_FACTS','BODY_VALIDATE_CONFIG_PRIVACY'})

def prepare_body_diagnostic_program(frozen):
    """Exact frozen body scope, closed stages/count only; normal capture unchanged."""
    validate_metadata(frozen);program=prepare_diagnostic_program()
    own=regular(HERE/'bootstrap_fixed_loader_reader.py',65536).decode();tree=ast.parse(own)
    capture=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='capture_prepared')
    checks=capture.body[1].body
    # Copy the unchanged consumer AST from its closure-schema guard to its return.
    start=next(i for i,n in enumerate(checks) if isinstance(n,ast.Expr) and ast.get_source_segment(own,n).startswith("require(type(value) is dict and set(value)=={'schema','classification','metadata','files','noSemanticApproval'})"))
    checks=checks[start:]
    require(len(checks)==7 and isinstance(checks[5],ast.For) and isinstance(checks[-1],ast.Return),'BODY_DIAGNOSTIC_PREPARATION_STOP')
    stages={0:'BODY_VALIDATE_SCHEMA',1:'BODY_VALIDATE_FROZEN',2:'BODY_VALIDATE_METADATA',4:'BODY_VALIDATE_COUNT'}
    wrapped=[]
    for i,node in enumerate(checks):
        if i in stages:wrapped.append(ast.parse('DIAGNOSTIC_STAGE = '+repr(stages[i])).body[0])
        if i==5:
            require(len(node.body)==7,'BODY_DIAGNOSTIC_PREPARATION_STOP')
            rowstages=('BODY_VALIDATE_ROW_SCHEMA','BODY_VALIDATE_ROW_CUSTODY','BODY_VALIDATE_ROW_LIMITS','BODY_VALIDATE_ROW_LIMITS','BODY_VALIDATE_CALL_FACTS','BODY_VALIDATE_CALL_FACTS','BODY_VALIDATE_CONFIG_PRIVACY')
            rowbody=[]
            for child,stage in zip(node.body,rowstages):
                rowbody.extend([ast.parse('DIAGNOSTIC_STAGE = '+repr(stage)).body[0],child])
            node.body=rowbody
        wrapped.append(node)
    function=ast.parse('def diagnostic_validate_body(value, frozen):\n global DIAGNOSTIC_STAGE\n pass').body[0]
    function.body=function.body[:1]+wrapped;ast.fix_missing_locations(function)
    metadata=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='validate_metadata')
    validators='CONFIG_CALL_TYPES = '+repr(tuple(sorted(CONFIG_CALL_TYPES)))+'\n'+ast.unparse(metadata)+'\n'+ast.unparse(function)+'\n'
    changes=[
      ("PHASE = 'metadata'","PHASE = 'bodies'"),('FROZEN_METADATA = None','FROZEN_METADATA = '+repr(frozen)),
      ('RENDER_PHP = None','RENDER_PHP = '+repr(render_template())),
      ('DIAGNOSTIC_STAGES='+repr(sorted(DIAGNOSTIC_STAGES)),'DIAGNOSTIC_STAGES='+repr(sorted(BODY_DIAGNOSTIC_STAGES))),
      ("DIAGNOSTIC_STAGE='START'","DIAGNOSTIC_STAGE='START'\nbody_count=0"),
      ("'schema':'ir.bootstrap.fixed_loader_diagnostic.v1'","'schema':'ir.bootstrap.fixed_loader_body_diagnostic.v1'"),
      ("'stage':stage,'reason':reason,'noSemanticApproval':True","'stage':stage,'reason':reason,'bodyCount':body_count,'noSemanticApproval':True"),
      ("'FIXED_DIAGNOSTIC_COMPLETE'","'FIXED_BODY_DIAGNOSTIC_COMPLETE'"),("'FIXED_DIAGNOSTIC_STOP'","'FIXED_BODY_DIAGNOSTIC_STOP'"),
      ('try:\n entries=[];launcher=None;manifest=None;configs=[]',validators+'try:\n entries=[];launcher=None;manifest=None;configs=[]'),
      (" if PHASE=='bodies':\n  require(value==FROZEN_METADATA", " if PHASE=='bodies':\n  DIAGNOSTIC_STAGE='FROZEN_METADATA_COMPARE'\n  require(value==FROZEN_METADATA"),
      ('  records=[]\n  for row in targets:',"  DIAGNOSTIC_STAGE='BODY_RECORD_CAPTURE'\n  records=[]\n  for row in targets:"),
      ('  rendered=tokenize(RENDER_PHP,records)',"  DIAGNOSTIC_STAGE='BODY_TOKENIZATION'\n  rendered=tokenize(RENDER_PHP,records)\n  body_count=len(rendered['files']) if type(rendered.get('files')) is list and len(rendered['files'])<=len(targets) else 0\n  DIAGNOSTIC_STAGE='BODY_PRODUCER_COUNT'"),
      (" DIAGNOSTIC_STAGE='FINAL_SOURCE_RECHECK'", " if PHASE=='bodies':diagnostic_validate_body(value,FROZEN_METADATA)\n DIAGNOSTIC_STAGE='FINAL_SOURCE_RECHECK'")]
    for old,new in changes:
        require(program.count(old)==1,'BODY_DIAGNOSTIC_PREPARATION_STOP');program=program.replace(old,new,1)
    # Target drift/count failures retain explicit closed reasons.
    marker='DIAGNOSTIC_REASONS='+repr(sorted(DIAGNOSTIC_REASONS))
    reasons=DIAGNOSTIC_REASONS|{'TARGET_METADATA_DRIFT','BODY_COUNT_STOP'}
    require(program.count(marker)==1,'BODY_DIAGNOSTIC_PREPARATION_STOP');program=program.replace(marker,'DIAGNOSTIC_REASONS='+repr(sorted(reasons)),1)
    compile(program,'fixed_loader_body_diagnostic','exec');return program

def capture_body_diagnostic_prepared(capture,program,budget,*,frozen):
    """Status-only distinct admission; no body output, target adoption or approval."""
    try:
        require(program==prepare_body_diagnostic_program(frozen),'PROGRAM_DRIFT')
        deadline=budget.deadline
        require(type(deadline) in (int,float) and math.isfinite(deadline) and 0<deadline-time.monotonic()<=IO_SECONDS,'DEADLINE_STOP')
        raw=capture(SSH_ARGV,program.encode(),budget,cap=DIAGNOSTIC_CAP)
        require(type(raw) is bytes and len(raw)<=DIAGNOSTIC_CAP,'CAP_STOP');value=json.loads(raw)
        require(type(value) is dict and set(value)=={'schema','classification','stage','reason','bodyCount','noSemanticApproval'})
        require(value['schema']=='ir.bootstrap.fixed_loader_body_diagnostic.v1' and value['noSemanticApproval'] is True)
        require(type(value['stage']) is str and value['stage'] in BODY_DIAGNOSTIC_STAGES)
        require(type(value['reason']) is str and value['reason'] in DIAGNOSTIC_REASONS|{'TARGET_METADATA_DRIFT','BODY_COUNT_STOP'})
        require(type(value['bodyCount']) is int and 0<=value['bodyCount']<=sum(row['present'] for row in frozen['targets']))
        if value['classification']=='FIXED_BODY_DIAGNOSTIC_COMPLETE':require(value['stage']=='COMPLETE' and value['reason']=='NONE' and value['bodyCount']==sum(row['present'] for row in frozen['targets']))
        else:require(value['classification']=='FIXED_BODY_DIAGNOSTIC_STOP' and value['stage']!='COMPLETE' and value['reason']!='NONE')
        return value
    except BaseException:raise Stop('PRIVATE_BODY_DIAGNOSTIC_STOP') from None

def record_tokenizer_status_template():
    """Exact renderer guards, independently caught per record; no rendered output."""
    php=render_template()
    warning="set_error_handler(function(){throw new RuntimeException('STOP');});"
    require(php.count(warning)==1,'RECORD_DIAGNOSTIC_PREPARATION_STOP')
    php=php.replace(warning,"set_error_handler(function(){throw new RuntimeException('STOP',900);});",1)
    marker="throw new RuntimeException('STOP');"
    require(php.count(marker)==7,'RECORD_DIAGNOSTIC_PREPARATION_STOP')
    for guard in range(1,8):php=php.replace(marker,"throw new RuntimeException('STOP',"+str(guard)+');',1)
    changes=[
      ('$out=[];$globalNames=[];','$out=[];$globalNames=[];$statuses=[];'),
      ('foreach($sources as $entry) {',"$recordIndex=0;foreach($sources as $entry) {\n  $phaseCode=1;$tokenKind=0;try{"),
      ("if(($entry['mode']??'')==='loader_init'){","$phaseCode=2;\n  if(($entry['mode']??'')==='loader_init'){"),
      ("$ids=[];$render='';", "$phaseCode=3;$ids=[];$render='';"),
      ("$paths=[];$dynamic=0;$includeFacts=[];$guardFacts=[];","$phaseCode=4;$paths=[];$dynamic=0;$includeFacts=[];$guardFacts=[];"),
      ("$hooks=[];\n  if(!in_array", "$phaseCode=5;$hooks=[];\n  if(!in_array"),
      ('$configCalls=[];', '$phaseCode=6;$configCalls=[];'),
      ("$out[]=['configCallFacts'","$phaseCode=7;$out[]=['configCallFacts'"),
      (" }\n $encoded=json_encode(['schema'=>'ir.bootstrap.redacted_syntax.v1','classification'=>'STATIC_REDACTED_SYNTAX_NOT_SEMANTIC_APPROVAL','files'=>$out],JSON_THROW_ON_ERROR);",
       "  $statuses[]=['entryIndex'=>$recordIndex,'tokenizerPass'=>true,'guardCode'=>0,'phaseCode'=>0,'tokenKind'=>0];\n  }catch(Throwable $ignored){$code=$ignored instanceof RuntimeException&&in_array($ignored->getCode(),[1,2,3,4,5,6,7,900],true)?$ignored->getCode():100;$statuses[]=['entryIndex'=>$recordIndex,'tokenizerPass'=>false,'guardCode'=>$code,'phaseCode'=>$phaseCode,'tokenKind'=>$tokenKind];}\n  $recordIndex++;\n }\n $encoded=json_encode(['schema'=>'ir.bootstrap.fixed_loader_record_tokenizer_status.v1','classification'=>'FIXED_RECORD_TOKENIZER_STATUS_NOT_APPROVAL','records'=>$statuses,'noSemanticApproval'=>true],JSON_THROW_ON_ERROR);")]
    for old,new in changes:
        require(php.count(old)==1,'RECORD_DIAGNOSTIC_PREPARATION_STOP');php=php.replace(old,new,1)
    # Public engine token IDs only; never the associated source text or CHAR.
    engine="$kind=is_array($t)?token_name($t[0]):'CHAR';$text=is_array($t)?$t[1]:$t;"
    require(php.count(engine)==2,'RECORD_DIAGNOSTIC_PREPARATION_STOP')
    php=php.replace(engine,engine+"$tokenKind=is_array($t)&&is_int($t[0])&&$t[0]>=256&&$t[0]<1024?$t[0]:0;")
    return php

def validate_record_tokenizer_status(value,count):
    require(type(count) is int and 0<=count<=13)
    require(type(value) is dict and set(value)=={'schema','classification','records','noSemanticApproval'})
    require(value['schema']=='ir.bootstrap.fixed_loader_record_tokenizer_status.v1' and value['classification']=='FIXED_RECORD_TOKENIZER_STATUS_NOT_APPROVAL' and value['noSemanticApproval'] is True)
    rows=value['records'];require(type(rows) is list and len(rows)==count)
    for index,row in enumerate(rows):
        require(type(row) is dict and set(row)=={'entryIndex','tokenizerPass','guardCode','phaseCode','tokenKind'})
        require(type(row['entryIndex']) is int and row['entryIndex']==index and type(row['tokenizerPass']) is bool)
        require(all(type(row[key]) is int for key in ('guardCode','phaseCode','tokenKind')))
        if row['tokenizerPass']:require((row['guardCode'],row['phaseCode'],row['tokenKind'])==(0,0,0))
        else:require(row['guardCode'] in (1,2,3,4,5,6,7,100,900) and 1<=row['phaseCode']<=7 and (row['tokenKind']==0 or 256<=row['tokenKind']<1024))
    return value

def prepare_record_tokenizer_diagnostic_program(frozen):
    """Same exact body reads; one tokenizer child yields closed per-record status."""
    require(sum(row['present'] for row in validate_metadata(frozen)['targets'])==13,'RECORD_DIAGNOSTIC_PREPARATION_STOP')
    program=prepare_body_diagnostic_program(frozen)
    marker='RENDER_PHP = '+repr(render_template())
    require(program.count(marker)==1,'RECORD_DIAGNOSTIC_PREPARATION_STOP');program=program.replace(marker,'RENDER_PHP = '+repr(record_tokenizer_status_template()),1)
    own=regular(HERE/'bootstrap_fixed_loader_reader.py',65536).decode()
    node=next(n for n in ast.parse(own).body if isinstance(n,ast.FunctionDef) and n.name=='validate_record_tokenizer_status')
    anchor='try:\n entries=[];launcher=None;manifest=None;configs=[]'
    require(program.count(anchor)==1,'RECORD_DIAGNOSTIC_PREPARATION_STOP');program=program.replace(anchor,ast.unparse(node)+'\n'+anchor,1)
    start=program.index('  rendered=tokenize(RENDER_PHP,records)');end=program.index('except BaseException as issue:',start)
    terminal="""  status=validate_record_tokenizer_status(tokenize(RENDER_PHP,records),len(records))
 DIAGNOSTIC_STAGE='FINAL_SOURCE_RECHECK'
 for path,cap,binding in owned:require([len(raw:=regular(path,cap)),digest(raw)]==binding,'SOURCE_DRIFT')
 payload=json.dumps(status,separators=(',',':')).encode();require(len(payload)<=2048,'OUTPUT_CAP_STOP')
 sys.stdout.buffer.write(payload)
"""
    program=program[:start]+terminal+program[end:];compile(program,'fixed_loader_record_diagnostic','exec');return program

def capture_record_tokenizer_diagnostic_prepared(capture,program,budget,*,frozen):
    """Distinct closed-index/guard status; no source/body/metadata acceptance."""
    try:
        require(program==prepare_record_tokenizer_diagnostic_program(frozen),'PROGRAM_DRIFT')
        deadline=budget.deadline
        require(type(deadline) in (int,float) and math.isfinite(deadline) and 0<deadline-time.monotonic()<=IO_SECONDS,'DEADLINE_STOP')
        raw=capture(SSH_ARGV,program.encode(),budget,cap=DIAGNOSTIC_CAP)
        require(type(raw) is bytes and len(raw)<=DIAGNOSTIC_CAP,'CAP_STOP')
        return validate_record_tokenizer_status(json.loads(raw),13)
    except BaseException:raise Stop('PRIVATE_RECORD_DIAGNOSTIC_STOP') from None

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if args.execute:print('BLOCKED: Root exact independent read admission required');return 1
    print('DORMANT: no remote/source/tokenizer/bootstrap execution');return 0

if __name__=='__main__':raise SystemExit(main())
