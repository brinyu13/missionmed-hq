"""Dormant fixed bootstrap tokenizer preparation. CLI execution is not admitted."""
import argparse
import ast
import base64
import hashlib
import json
import math
import time
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
SEED_FILE = 'BOOTSTRAP_STATIC_SEED_METADATA_20261004.json'
SEED_SHA = '91f8956cb0d43fe7b6e82fb55bb12f92fcfcf12879a11d64b30e92f6c604f5ef'
CAPTURE_SHA = 'c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1'
WEBROOT = '/www/theresidencyacademy_209/public'
SSH_ARGV = ('ssh', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
            '-o', 'ConnectTimeout=8', 'missionmed-kinsta', 'python3', '-')
IO_SECONDS = 10
REAP_SECONDS = 2
OUTPUT_CAP = 8 * 1024 * 1024
SOURCE_CAP = 512 * 1024
LAUNCHER_CAP = 12 * 1024 * 1024
TOTAL_SOURCE_CAP = 24 * 1024 * 1024
REDACTED_CAP = 1024 * 1024
SAFE_CONSTANTS = ('WP_CLI', 'ABSPATH', 'PHP_SAPI', 'cli', 'true', 'false', 'null')
IDENTIFIER = re.compile(r'[A-Za-z_][A-Za-z0-9_]*\Z')
PUNCTUATION = frozenset('()[]{};:,.?+-*/%&|^!~=@<>\\')
KEYWORDS = {
    'T_DECLARE': 'declare', 'T_ENDDECLARE': 'enddeclare', 'T_INSTEADOF': 'insteadof',
    'T_FUNCTION': 'function', 'T_CLASS': 'class', 'T_INTERFACE': 'interface',
    'T_TRAIT': 'trait', 'T_ENUM': 'enum', 'T_NAMESPACE': 'namespace',
    'T_EXTENDS': 'extends', 'T_IMPLEMENTS': 'implements', 'T_NEW': 'new',
    'T_PUBLIC': 'public', 'T_PROTECTED': 'protected', 'T_PRIVATE': 'private',
    'T_STATIC': 'static', 'T_ABSTRACT': 'abstract', 'T_FINAL': 'final',
    'T_READONLY': 'readonly', 'T_CONST': 'const', 'T_RETURN': 'return',
    'T_IF': 'if', 'T_ELSE': 'else', 'T_ELSEIF': 'elseif', 'T_ENDIF': 'endif',
    'T_WHILE': 'while', 'T_ENDWHILE': 'endwhile', 'T_DO': 'do', 'T_FOR': 'for',
    'T_ENDFOR': 'endfor', 'T_FOREACH': 'foreach', 'T_ENDFOREACH': 'endforeach',
    'T_AS': 'as', 'T_SWITCH': 'switch', 'T_ENDSWITCH': 'endswitch',
    'T_CASE': 'case', 'T_DEFAULT': 'default', 'T_BREAK': 'break', 'T_CONTINUE': 'continue',
    'T_TRY': 'try', 'T_CATCH': 'catch', 'T_FINALLY': 'finally', 'T_THROW': 'throw',
    'T_INCLUDE': 'include', 'T_INCLUDE_ONCE': 'include_once',
    'T_REQUIRE': 'require', 'T_REQUIRE_ONCE': 'require_once', 'T_EVAL': 'eval',
    'T_ECHO': 'echo', 'T_PRINT': 'print', 'T_EXIT': 'exit', 'T_GLOBAL': 'global',
    'T_UNSET': 'unset', 'T_ISSET': 'isset', 'T_EMPTY': 'empty', 'T_LIST': 'list',
    'T_ARRAY': 'array', 'T_CALLABLE': 'callable', 'T_FN': 'fn', 'T_USE': 'use',
    'T_YIELD': 'yield', 'T_YIELD_FROM': 'yield from', 'T_MATCH': 'match',
    'T_CLONE': 'clone', 'T_INSTANCEOF': 'instanceof', 'T_GOTO': 'goto',
    'T_LOGICAL_OR': 'or', 'T_LOGICAL_AND': 'and', 'T_LOGICAL_XOR': 'xor',
    'T_BOOLEAN_OR': '||', 'T_BOOLEAN_AND': '&&', 'T_IS_EQUAL': '==',
    'T_IS_IDENTICAL': '===', 'T_IS_NOT_EQUAL': '!=', 'T_IS_NOT_IDENTICAL': '!==',
    'T_IS_SMALLER_OR_EQUAL': '<=', 'T_IS_GREATER_OR_EQUAL': '>=', 'T_SPACESHIP': '<=>',
    'T_DOUBLE_ARROW': '=>', 'T_OBJECT_OPERATOR': '->', 'T_NULLSAFE_OBJECT_OPERATOR': '?->',
    'T_DOUBLE_COLON': '::', 'T_COALESCE': '??', 'T_COALESCE_EQUAL': '??=',
    'T_INC': '++', 'T_DEC': '--', 'T_POW': '**', 'T_POW_EQUAL': '**=',
    'T_SL': '<<', 'T_SR': '>>', 'T_ELLIPSIS': '...', 'T_ATTRIBUTE': '#[',
    'T_PLUS_EQUAL': '+=', 'T_MINUS_EQUAL': '-=', 'T_MUL_EQUAL': '*=', 'T_DIV_EQUAL': '/=',
    'T_CONCAT_EQUAL': '.=', 'T_MOD_EQUAL': '%=', 'T_AND_EQUAL': '&=', 'T_OR_EQUAL': '|=',
    'T_XOR_EQUAL': '^=', 'T_SL_EQUAL': '<<=', 'T_SR_EQUAL': '>>=',
    'T_INT_CAST': '(int)', 'T_DOUBLE_CAST': '(float)', 'T_STRING_CAST': '(string)',
    'T_ARRAY_CAST': '(array)', 'T_OBJECT_CAST': '(object)', 'T_BOOL_CAST': '(bool)',
    'T_UNSET_CAST': '(unset)', 'T_HALT_COMPILER': '__halt_compiler',
    'T_AMPERSAND_FOLLOWED_BY_VAR_OR_VARARG': '&', 'T_AMPERSAND_NOT_FOLLOWED_BY_VAR_OR_VARARG': '&',
}
PUBLIC_HOOKS = ('user_register', 'wp_insert_user', 'profile_update', 'set_user_role',
    'add_user_role', 'pre_wp_mail', 'wp_mail', 'pre_http_request', 'added_user_meta',
    'updated_user_meta', 'deleted_user_meta', 'authenticate', 'wp_login',
    'muplugins_loaded', 'plugins_loaded', 'init')
CONFIG_ROLES = ('wp-config.php', 'wp-cli.yml', 'wp-cli.local.yml', 'homeWpCliConfig')
DECLARATIONS = ('T_FUNCTION', 'T_CLASS', 'T_INTERFACE', 'T_TRAIT', 'T_ENUM')
OPAQUE = ('T_COMMENT', 'T_DOC_COMMENT', 'T_INLINE_HTML', 'T_CONSTANT_ENCAPSED_STRING',
          'T_LNUMBER', 'T_DNUMBER', 'T_NUM_STRING', 'T_LINE', 'T_FILE', 'T_DIR',
          'T_CLASS_C', 'T_TRAIT_C', 'T_METHOD_C', 'T_FUNC_C', 'T_NS_C')


class Stop(Exception):
    def __init__(self, classification='READER_STOP'):
        super().__init__(classification)


def require(condition, classification='READER_STOP'):
    if not condition:
        raise Stop(classification)


def local_bytes(path, cap=65536):
    path = Path(path)
    require(not any(p.is_symlink() for p in (path, *path.parents)), 'SYMLINK_STOP')
    require(path.is_file() and path.stat().st_size <= cap, 'CAP_STOP')
    return path.read_bytes()


def metadata():
    raw = local_bytes(HERE / SEED_FILE)
    require(hashlib.sha256(raw).hexdigest() == SEED_SHA, 'METADATA_DRIFT')
    value = json.loads(raw)
    require(value['schema'] == 'ir.bootstrap.static_seed_metadata.v1')
    require(len(value['seedFiles']) == 20 and len(value['muEntrypoints']) == 61)
    require(all(e['type'] == 'FILE' and re.fullmatch(r'[A-Za-z0-9_-]+\.php', e['name']) for e in value['muEntrypoints']))
    require(value['homeWpCliConfig']['present'] is False)
    require(value['cliResolution'][0]['resolved'] == '/usr/local/bin/wp')
    require(value['cliResolution'][1]['resolved'] == '/usr/bin/php8.2')
    return value


def declared_names(tokens):
    names = set()
    pending = False
    for kind, text in tokens:
        if kind in DECLARATIONS:
            pending = True
        elif kind in ('T_WHITESPACE', 'T_COMMENT', 'T_DOC_COMMENT') or text == '&':
            continue
        elif pending:
            if kind == 'T_STRING' and IDENTIFIER.fullmatch(text):
                names.add(text)
            pending = False
    return names


def classify_hook_fixture(tokens, role):
    if role in CONFIG_ROLES:
        return []
    significant = [(kind, text) for kind, text in tokens
                   if kind not in ('T_WHITESPACE', 'T_COMMENT', 'T_DOC_COMMENT')]
    facts = []
    for i in range(len(significant)-2):
        kind, name = significant[i]
        if (kind == 'T_STRING' and name in ('add_action', 'add_filter')
                and (i == 0 or significant[i-1][0] not in ('T_OBJECT_OPERATOR', 'T_NULLSAFE_OBJECT_OPERATOR', 'T_DOUBLE_COLON'))
                and significant[i+1] == ('CHAR', '(')
                and significant[i+2][0] == 'T_CONSTANT_ENCAPSED_STRING'):
            value = significant[i+2][1]
            for hook in PUBLIC_HOOKS:
                if value in ("'"+hook+"'", '"'+hook+'"'):
                    facts.append({'registration': name, 'publicHook': hook})
    return facts


def redact_fixture_tokens(tokens, role='mu.php'):
    """Injected lexical-policy reference; no source lexer/runtime is executed."""
    names = declared_names(tokens)
    ids = {}
    result = []
    counter = 0
    quoted = None
    for kind, text in tokens:
        if quoted:
            if (quoted == 'heredoc' and kind == 'T_END_HEREDOC') or (quoted != 'heredoc' and kind == 'CHAR' and text == quoted):
                quoted = None
            continue
        if kind == 'T_START_HEREDOC' or (kind == 'CHAR' and text in ('"', '`')):
            counter += 1
            result.append("'REDACTED_L" + str(counter) + "'")
            quoted = 'heredoc' if kind == 'T_START_HEREDOC' else text
        elif kind in OPAQUE:
            # Exceptions are ONLY the literal fixed safe constants, never config values.
            if role not in CONFIG_ROLES and kind == 'T_CONSTANT_ENCAPSED_STRING' and text in tuple(repr(x) for x in SAFE_CONSTANTS) + tuple('"'+x+'"' for x in SAFE_CONSTANTS):
                result.append(text)
            else:
                counter += 1
                label = 'REDACTED_L' + str(counter)
                result.append('/* '+label+' */' if kind in ('T_COMMENT', 'T_DOC_COMMENT') else "'"+label+"'" if kind != 'T_INLINE_HTML' else '<?php /* '+label+' */ ?>')
        elif kind == 'T_WHITESPACE':
            result.append(' ')
        elif kind == 'T_OPEN_TAG':
            result.append('<?php ')
        elif kind == 'T_OPEN_TAG_WITH_ECHO':
            result.append('<?php echo ')
        elif kind == 'T_CLOSE_TAG':
            result.append('?>')
        elif kind == 'T_STRING' and (text in names or text in SAFE_CONSTANTS):
            result.append(text)
        elif kind in ('T_STRING', 'T_VARIABLE', 'T_NAME_QUALIFIED', 'T_NAME_FULLY_QUALIFIED', 'T_NAME_RELATIVE'):
            key = (kind, text)
            if key not in ids:
                ids[key] = 'REDACTED_I' + str(len(ids)+1)
            result.append(('$' if kind == 'T_VARIABLE' else '') + ids[key])
        elif kind in KEYWORDS:
            result.append(KEYWORDS[kind])
        elif kind == 'CHAR' and text in PUNCTUATION:
            result.append(text)
        else:
            raise Stop('TOKEN_POLICY_STOP')
    require(quoted is None, 'TOKEN_POLICY_STOP')
    value = ''.join(result)
    require(len(value.encode()) <= REDACTED_CAP, 'CAP_STOP')
    return value


# This closed PHP program executes only token_get_all over supplied private bytes.
# No inspected source is included, evaluated, required, autoloaded or executed.
PHP_READER = r'''<?php
error_reporting(0);
set_error_handler(function(){throw new RuntimeException('STOP');});
try {
 if (!function_exists('token_get_all')) { throw new RuntimeException('STOP'); }
 $policy=json_decode(base64_decode('POLICY_B64'),true,512,JSON_THROW_ON_ERROR);
 $sources=json_decode(base64_decode('SOURCES_B64'),true,512,JSON_THROW_ON_ERROR);
 $out=[];$globalNames=[];
 foreach($sources as $entry){
  $raw=base64_decode($entry['source'],true);if($raw===false){throw new RuntimeException('STOP');}
  $pending=false;
  foreach(token_get_all($raw) as $t){
   $kind=is_array($t)?token_name($t[0]):'CHAR';$text=is_array($t)?$t[1]:$t;
   if(in_array($kind,$policy['declarations'],true)){$pending=true;}
   elseif(in_array($kind,['T_WHITESPACE','T_COMMENT','T_DOC_COMMENT'],true)||$text==='&'){continue;}
   elseif($pending){if($kind==='T_STRING'&&preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/D',$text)){$globalNames[$text]=true;}$pending=false;}
  }
 }
 foreach($sources as $entry) {
  $raw=base64_decode($entry['source'],true);$tokens=token_get_all($raw);$names=$globalNames;
  $ids=[];$render='';$counter=0;$quoted=null;
  foreach($tokens as $t){
   $kind=is_array($t)?token_name($t[0]):'CHAR';$text=is_array($t)?$t[1]:$t;
   if($quoted!==null){
    if(($quoted==='heredoc'&&$kind==='T_END_HEREDOC')||($quoted!=='heredoc'&&$kind==='CHAR'&&$text===$quoted)){$quoted=null;}
    continue;
   }
   if($kind==='T_START_HEREDOC'||($kind==='CHAR'&&in_array($text,['"','`'],true))){
    $render.="'REDACTED_L".(++$counter)."'";$quoted=$kind==='T_START_HEREDOC'?'heredoc':$text;
   } elseif(in_array($kind,$policy['opaque'],true)){
    if(!in_array($entry['role'],$policy['configRoles'],true)&&$kind==='T_CONSTANT_ENCAPSED_STRING'&&in_array($text,$policy['safeLiterals'],true)){$render.=$text;}
    else{$label='REDACTED_L'.(++$counter);$render.=in_array($kind,['T_COMMENT','T_DOC_COMMENT'],true)?'/* '.$label.' */':($kind==='T_INLINE_HTML'?'<?php /* '.$label.' */ ?>':"'".$label."'");}
   } elseif($kind==='T_WHITESPACE'){$render.=' ';}
   elseif($kind==='T_OPEN_TAG'){$render.='<?php ';}
   elseif($kind==='T_OPEN_TAG_WITH_ECHO'){$render.='<?php echo ';}
   elseif($kind==='T_CLOSE_TAG'){$render.='?>';}
   elseif($kind==='T_STRING'&&(isset($names[$text])||in_array($text,$policy['safeConstants'],true))){$render.=$text;}
   elseif(in_array($kind,['T_STRING','T_VARIABLE','T_NAME_QUALIFIED','T_NAME_FULLY_QUALIFIED','T_NAME_RELATIVE'],true)){
    $key=$kind.'|'.$text;if(!isset($ids[$key])){$ids[$key]='REDACTED_I'.(count($ids)+1);}
    $render.=($kind==='T_VARIABLE'?'$':'').$ids[$key];
   } elseif(isset($policy['keywords'][$kind])){$render.=$policy['keywords'][$kind];}
   elseif($kind==='CHAR'&&in_array($text,$policy['punctuation'],true)){$render.=$text;}
   else{throw new RuntimeException('STOP');}
   if(strlen($render)>$policy['redactedCap']){throw new RuntimeException('STOP');}
  }
  if($quoted!==null){throw new RuntimeException('STOP');}
  // Discover only direct literal relative PHP includes. No expression resolution/adoption.
  $paths=[];$dynamic=0;
  for($i=0;$i<count($tokens);$i++){
   $t=$tokens[$i];if(!is_array($t)||!in_array(token_name($t[0]),['T_INCLUDE','T_INCLUDE_ONCE','T_REQUIRE','T_REQUIRE_ONCE'],true)){continue;}
   $parts=[];
   for($j=$i+1;$j<count($tokens);$j++){
    $u=$tokens[$j];if($u===';'){break;}
    if(is_array($u)&&in_array(token_name($u[0]),['T_WHITESPACE','T_COMMENT','T_DOC_COMMENT'],true)){continue;}
    $parts[]=$u;
   }
   if(count($parts)===1&&is_array($parts[0])&&token_name($parts[0][0])==='T_CONSTANT_ENCAPSED_STRING'){
    $lit=$parts[0][1];$path=substr($lit,1,-1);
    if(preg_match('~^(?:wp-includes/|wp-content/mu-plugins/)[A-Za-z0-9_./-]+\.php$~D',$path)&&strpos($path,'..')===false&&strpos($path,'//')===false){$paths[]=$path;continue;}
   }
   $dynamic++;
  }
  $hooks=[];
  if(!in_array($entry['role'],$policy['configRoles'],true)){
   $sig=[];foreach($tokens as $t){if(is_array($t)&&in_array(token_name($t[0]),['T_WHITESPACE','T_COMMENT','T_DOC_COMMENT'],true)){continue;}$sig[]=$t;}
   for($i=0;$i<count($sig)-2;$i++){
    $t=$sig[$i];$a=$sig[$i+2];
    if(($i===0||!is_array($sig[$i-1])||!in_array(token_name($sig[$i-1][0]),['T_OBJECT_OPERATOR','T_NULLSAFE_OBJECT_OPERATOR','T_DOUBLE_COLON'],true))&&is_array($t)&&token_name($t[0])==='T_STRING'&&in_array($t[1],['add_action','add_filter'],true)&&$sig[$i+1]==='('&&is_array($a)&&token_name($a[0])==='T_CONSTANT_ENCAPSED_STRING'){
     foreach($policy['publicHooks'] as $hook){if(in_array($a[1],["'".$hook."'",'"'.$hook.'"'],true)){$hooks[]=['registration'=>$t[1],'publicHook'=>$hook];}}
    }
   }
  }
  $out[]=['closedPublicRegistrations'=>$hooks,'role'=>$entry['role'],'sourceSha256'=>hash('sha256',$raw),'bytes'=>strlen($raw),'redactedSource'=>$render,'includeCandidates'=>array_values(array_unique($paths)),'dynamicIncludes'=>$dynamic];
 }
 $encoded=json_encode(['schema'=>'ir.bootstrap.redacted_syntax.v1','classification'=>'STATIC_REDACTED_SYNTAX_NOT_SEMANTIC_APPROVAL','files'=>$out],JSON_THROW_ON_ERROR);if(strlen($encoded)>$policy['outputCap']){throw new RuntimeException('STOP');}echo $encoded;
} catch(Throwable $e) { echo '{"classification":"TOKENIZER_STOP"}'; exit(1); }
'''


TOKENIZER_PATH = '/usr/lib/php/20220829/tokenizer.so'
TOKENIZER_BYTES = 35080
TOKENIZER_SHA = '088267fb4965e634f43151d2981b8ff60e258376684990eb0791b75b6f34878c'
TOKENIZER_METADATA_SHA = '81972c8b4fb99550f4f4ac6dde528c21a4f7f2df0bb548b56d0edc8e6e96590f'
TOKENIZER_ARGV = ['/usr/bin/php8.2', '-n', '-d', 'extension='+TOKENIZER_PATH]


def tokenizer_metadata():
    raw = local_bytes(HERE/'BOOTSTRAP_INSTALLED_TOKENIZER_METADATA_READBACK_1.json', 65536)
    require(hashlib.sha256(raw).hexdigest() == TOKENIZER_METADATA_SHA, 'TOKENIZER_METADATA_DRIFT')
    value = json.loads(raw)
    require(value['result'] == {'iniSha256': '5915e8a8256d4ba7b8b021ce1bcb9456ae86cd98e1100b6b57e098ccf169e6a9',
        'moduleBytes': TOKENIZER_BYTES, 'modulePath': TOKENIZER_PATH, 'moduleSha256': TOKENIZER_SHA,
        'singleTokenizerDirective': True, 'standardCliReference': True}, 'TOKENIZER_METADATA_DRIFT')
    return value


REMOTE_READER = r'''
import base64,hashlib,json,os,pwd,signal,stat,subprocess,sys
from pathlib import Path
def alarm(signum,frame):raise RuntimeError('STOP')
signal.signal(signal.SIGALRM,alarm)
signal.alarm(8)
child=None
try:
 seed=SEED_LITERAL
 root=Path('/www/theresidencyacademy_209/public')
 mu=root/'wp-content/mu-plugins'
 expected=sorted(x['name'] for x in seed['muEntrypoints'])
 def check(v):
  if not v:raise RuntimeError('STOP')
 def regular(path,cap):
  for p in (path,*path.parents):check(not p.is_symlink())
  fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   before=os.fstat(fd);check(stat.S_ISREG(before.st_mode) and before.st_size<=cap)
   chunks=[];total=0
   while True:
    b=os.read(fd,65536)
    if not b:break
    total+=len(b);check(total<=cap);chunks.append(b)
   after=os.fstat(fd);check((before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns))
   return b''.join(chunks)
  finally:os.close(fd)
 def entries():
  out=[]
  for p in mu.iterdir():
   if p.name.endswith('.php'):
    check(not p.is_symlink() and p.is_file());out.append(p.name)
  return sorted(out)
 check(entries()==expected)
 home=Path(pwd.getpwuid(os.getuid()).pw_dir)
 check(not os.path.lexists(home/'.wp-cli/config.yml'))
 check(os.path.realpath('/usr/local/bin/wp')=='/usr/local/bin/wp')
 check(os.path.realpath('/usr/bin/php')=='/usr/bin/php8.2')
 records=[];owned=[];total=0
 for entry in seed['seedFiles']:
  path=root/entry['role']
  if entry['type']=='ABSENT':check(not os.path.lexists(path));continue
  raw=regular(path,SOURCE_LIMIT);check(len(raw)==entry['bytes'] and hashlib.sha256(raw).hexdigest()==entry['sha256'])
  records.append({'role':entry['role'],'source':base64.b64encode(raw).decode()});owned.append((path,SOURCE_LIMIT,hashlib.sha256(raw).hexdigest()));total+=len(raw)
 for name in expected:
  path=mu/name;raw=regular(path,SOURCE_LIMIT);total+=len(raw);check(total<=TOTAL_LIMIT)
  records.append({'role':'wp-content/mu-plugins/'+name,'source':base64.b64encode(raw).decode()});owned.append((path,SOURCE_LIMIT,hashlib.sha256(raw).hexdigest()))
 path=Path('/usr/local/bin/wp');raw=regular(path,LAUNCHER_LIMIT);total+=len(raw);check(total<=TOTAL_LIMIT)
 records.append({'role':'launcher:/usr/local/bin/wp','source':base64.b64encode(raw).decode()});owned.append((path,LAUNCHER_LIMIT,hashlib.sha256(raw).hexdigest()))
 def tokenizer_check():
  raw=regular(Path(TOKENIZER_MODULE_PATH),TOKENIZER_MODULE_BYTES)
  check(len(raw)==TOKENIZER_MODULE_BYTES and hashlib.sha256(raw).hexdigest()==TOKENIZER_MODULE_SHA)
 tokenizer_check()
 code=PHP_LITERAL.replace('SOURCES_B64',base64.b64encode(json.dumps(records,separators=(',',':')).encode()).decode())
 child=subprocess.Popen(TOKENIZER_FIXED_ARGV,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 result,_=child.communicate(code.encode(),timeout=6)
 check(child.returncode==0 and len(result)<=OUTPUT_LIMIT)
 tokenizer_check()
 value=json.loads(result);check(value['schema']=='ir.bootstrap.redacted_syntax.v1' and len(value['files'])==len(records))
 for (path,cap,sha) in owned:check(hashlib.sha256(regular(path,cap)).hexdigest()==sha)
 check(entries()==expected)
 for item in value['files']:
  verified=[]
  for rel in item.pop('includeCandidates'):
   p=root/rel
   if p.is_file() and not any(x.is_symlink() for x in (p,*p.parents)):verified.append(rel)
  item['regularRelativePhpIncludes']=verified
 value['absentSeedRoles']=[x['role'] for x in seed['seedFiles'] if x['type']=='ABSENT']
 value['homeWpCliConfigAbsent']=True
 payload=json.dumps(value,separators=(',',':')).encode();check(len(payload)<=OUTPUT_LIMIT)
 sys.stdout.buffer.write(payload)
except BaseException:
 if child is not None and child.poll() is None:
  try:child.kill();child.wait(timeout=1)
  except BaseException:pass
 sys.stdout.write('{"classification":"STATIC_READER_STOP"}')
 sys.exit(1)
'''


def prepare_program():
    seed = metadata()
    tokenizer_metadata()
    require(hashlib.sha256(local_bytes(HERE/'native_account_qa.py', 131072)).hexdigest() == CAPTURE_SHA, 'CAPTURE_DRIFT')
    policy = {'keywords': KEYWORDS, 'declarations': DECLARATIONS, 'opaque': OPAQUE,
              'punctuation': sorted(PUNCTUATION), 'safeConstants': SAFE_CONSTANTS,
              'safeLiterals': [repr(x) for x in SAFE_CONSTANTS] + ['"'+x+'"' for x in SAFE_CONSTANTS],
              'redactedCap': REDACTED_CAP, 'outputCap': OUTPUT_CAP,
              'publicHooks': PUBLIC_HOOKS, 'configRoles': CONFIG_ROLES}
    php = PHP_READER.replace('POLICY_B64', base64.b64encode(json.dumps(policy).encode()).decode())
    constants = {'SOURCE_LIMIT': SOURCE_CAP, 'LAUNCHER_LIMIT': LAUNCHER_CAP,
                 'TOTAL_LIMIT': TOTAL_SOURCE_CAP, 'OUTPUT_LIMIT': OUTPUT_CAP,
                 'PHP_LITERAL': php, 'SEED_LITERAL': seed,
                 'TOKENIZER_MODULE_PATH': TOKENIZER_PATH, 'TOKENIZER_MODULE_BYTES': TOKENIZER_BYTES,
                 'TOKENIZER_MODULE_SHA': TOKENIZER_SHA, 'TOKENIZER_FIXED_ARGV': TOKENIZER_ARGV,
                 'TOKENIZER_METADATA_BINDING': TOKENIZER_METADATA_SHA}
    return '\n'.join(k+' = '+repr(v) for k,v in constants.items())+'\n'+REMOTE_READER


def expected_roles():
    seed = metadata()
    return ([entry['role'] for entry in seed['seedFiles'] if entry['type'] == 'FILE']
            + ['wp-content/mu-plugins/'+entry['name'] for entry in seed['muEntrypoints']]
            + ['launcher:/usr/local/bin/wp'])


def validate_safe_result(value):
    require(type(value) is dict and set(value) == {
        'schema', 'classification', 'files', 'absentSeedRoles', 'homeWpCliConfigAbsent'})
    require(value['schema'] == 'ir.bootstrap.redacted_syntax.v1')
    require(value['classification'] == 'STATIC_REDACTED_SYNTAX_NOT_SEMANTIC_APPROVAL')
    seed = metadata()
    require(value['absentSeedRoles'] == [e['role'] for e in seed['seedFiles'] if e['type'] == 'ABSENT'])
    require(value['homeWpCliConfigAbsent'] is True)
    require(type(value['files']) is list and [e.get('role') for e in value['files']] == expected_roles())
    for item in value['files']:
        require(type(item) is dict and set(item) == {'role','sourceSha256','bytes','redactedSource',
            'regularRelativePhpIncludes','dynamicIncludes','closedPublicRegistrations'})
        require(type(item['sourceSha256']) is str and re.fullmatch(r'[0-9a-f]{64}',item['sourceSha256']))
        require(type(item['bytes']) is int and 0 <= item['bytes'] <= (LAUNCHER_CAP if item['role'].startswith('launcher:') else SOURCE_CAP))
        require(type(item['redactedSource']) is str and len(item['redactedSource'].encode()) <= REDACTED_CAP)
        require(type(item['dynamicIncludes']) is int and 0 <= item['dynamicIncludes'] <= SOURCE_CAP)
        require(type(item['regularRelativePhpIncludes']) is list and len(item['regularRelativePhpIncludes']) <= 512)
        for path in item['regularRelativePhpIncludes']:
            require(type(path) is str and re.fullmatch(r'(?:wp-includes/|wp-content/mu-plugins/)[A-Za-z0-9_./-]+\.php',path) and '..' not in path and '//' not in path)
        require(type(item['closedPublicRegistrations']) is list and len(item['closedPublicRegistrations']) <= 4096)
        if item['role'] in CONFIG_ROLES:
            require(not item['closedPublicRegistrations'])
        for fact in item['closedPublicRegistrations']:
            require(type(fact) is dict and set(fact) == {'registration','publicHook'} and fact['registration'] in ('add_action','add_filter') and fact['publicHook'] in PUBLIC_HOOKS)
    return value


def classify_fixture_capture(capture, program, budget):
    """Injected bounded-capture wrapper only; it never loads a transport itself."""
    try:
        require(program == prepare_program(), 'PROGRAM_DRIFT')
        left = budget.deadline - time.monotonic()
        require(type(budget.deadline) in (int, float) and math.isfinite(budget.deadline) and 0 < left <= IO_SECONDS)
        raw = capture(SSH_ARGV, program.encode(), budget, cap=OUTPUT_CAP)
        require(len(raw) <= OUTPUT_CAP, 'CAP_STOP')
        value = json.loads(raw)
        return validate_safe_result(value)
    except BaseException:
        raise Stop('PRIVATE_CAPTURE_STOP') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    if args.execute:
        print('BLOCKED: separate exact reader admission packet required')
        return 1
    print('DORMANT: no source/bootstrap/tokenizer/network execution admitted')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
