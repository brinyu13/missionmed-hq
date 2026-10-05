"""Focused synthetic-only acceptance fixtures; no remote source/transport calls."""
import base64
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zlib

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('fixed_loader',HERE/'bootstrap_fixed_loader_reader.py')
r=importlib.util.module_from_spec(spec);sys.modules[spec.name]=r;spec.loader.exec_module(r)
PHP=shutil.which('php')

def php(template,records):
    if not PHP:raise unittest.SkipTest('Synthetic local isolated PHP unavailable')
    code=template.replace('SOURCES_B64',base64.b64encode(json.dumps(records).encode()).decode())
    proc=subprocess.run([PHP,'-n'],input=code.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
    return proc.returncode,proc.stdout,proc.stderr

def record(raw,role='synthetic',mode='loader_init'):
    return {'role':role,'mode':mode,'source':base64.b64encode(raw).decode()}

def phar(names=None,alias=b'wp-cli.phar',compression=False,version=0x1110):
    if names is None:names=[r.PHAR_TARGETS[0],'unrelated/private.php']
    pieces=[];bodies=[]
    for name in names:
        raw=b'<?php /* SYNTHETIC_PRIVATE_CANARY */ function init() { return true; }'
        encoded=raw
        if compression:
            d=zlib.compressobj(wbits=-15);encoded=d.compress(raw)+d.flush()
        name=name.encode()
        pieces.append(struct.pack('<I',len(name))+name+struct.pack('<IIIIII',len(raw),0,len(encoded),zlib.crc32(raw)&0xffffffff,0x1000 if compression else 0,0))
        bodies.append(encoded)
    manifest=(struct.pack('<I',len(names))+struct.pack('>H',version)+struct.pack('<II',0x1000 if compression else 0,len(alias))+alias+struct.pack('<I',0)+b''.join(pieces))
    stub=b'<?php Phar::mapPhar(); include "phar://wp-cli.phar/php/boot-phar.php"; __HALT_COMPILER(); ?>\r\n'
    return stub+struct.pack('<I',len(manifest))+manifest+b''.join(bodies)

def frozen():
    facts=[]
    values=[('wp-config.php',110,r.CONFIG_TARGETS[0],'absolute','unconditional','config'),
     ('wp-config.php',113,r.CONFIG_TARGETS[1],'absolute','unconditional','config'),
     ('wp-content/mu-plugins/kinsta-mu-plugins.php',36,r.WEBROOT+'/wp-content/mu-plugins/kinsta-mu-plugins/vendor/autoload.php','PLUGIN_DIR_literal','unconditional','loader_init'),
     ('wp-content/mu-plugins/missionmed-matrix-account-entry.php',282,r.WEBROOT+'/wp-content/plugins/synthetic-reskin/init.php','WP_PLUGIN_DIR_default_candidate','file_exists','loader_init'),
     ('wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php',27,r.WEBROOT+'/wp-content/plugins/synthetic-scanner/init.php','WP_PLUGIN_DIR_default_candidate','file_exists','loader_init'),
     ('launcher:/usr/local/bin/wp',8,r.PHAR_PREFIX+r.PHAR_TARGETS[0],'fixed_phar_prefix','unconditional','loader_init')]
    for role,site,target,base,guard,mode in values:facts.append(dict(entryRole=role,site=site,target=target,base=base,guard=guard,mode=mode))
    paths={f['target']:f['mode'] for f in facts if not f['target'].startswith(r.PHAR_PREFIX)}
    paths[r.KINSTA_BOOT]='loader_init';paths.update({r.PHAR_PREFIX+x:'loader_init' for x in r.PHAR_TARGETS})
    return {'schema':'ir.bootstrap.fixed_loader_metadata.v1','classification':'FIXED_TARGET_FACTS_NOT_APPROVAL','facts':facts,
     'targets':[dict(path=p,mode=paths[p],present=False) for p in sorted(paths)],'entryBindings':r.ENTRY_BINDINGS,
     'noAutomaticAdoption':True,'rootBindingFacts':dict(standardPluginRootOverridden=False,standardContentRootOverridden=False,dynamicDefinitionUnresolved=False)}

def syntax_entries(binding="__DIR__",binding_tokens=6):
    main=('<?php '+';'*109+'require_once '+json.dumps(r.CONFIG_TARGETS[0])+';require_once '+json.dumps(r.CONFIG_TARGETS[1])+';').encode()
    suffix='/kinsta-mu-plugins/vendor/autoload.php' if binding=='__DIR__' else '/vendor/autoload.php'
    kinsta=("<?php const PLUGIN_DIR = "+binding+';'+';'*(36-binding_tokens)+"require PLUGIN_DIR . '"+suffix+"';").encode()
    result=[record(main,'wp-config.php'),record(kinsta,'wp-content/mu-plugins/kinsta-mu-plugins.php')]
    for role,offset in (('wp-content/mu-plugins/missionmed-matrix-account-entry.php',282),('wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php',27)):
        raw=("<?php $v = WP_PLUGIN_DIR . '/synthetic/init.php'; if (file_exists($v)) {"+';'*(offset-15)+'require_once $v; }').encode()
        result.append(record(raw,role))
    result.append(record(b'#!/usr/bin/env php\n<?php Phar::mapPhar(); include "phar://wp-cli.phar/php/boot-phar.php"; __halt_compiler();','launcher:/usr/local/bin/wp'))
    return result

class Fixtures(unittest.TestCase):
    def test_dynamic_variables_and_group_namespace_syntax_privacy(self):
        cases=[b'<?php $$private_name_canary="PRIVATE_VALUE_CANARY";global $$private_name_canary;$$private_name_canary=getenv("PRIVATE_ENV_CANARY");',br'<?php namespace private_namespace_canary;use private_prefix_canary\{private_segment_canary,private_other_canary};']
        template=r.render_template()
        encoded=template.split("$policy=json_decode(base64_decode('",1)[1].split("'",1)[0]
        policy=json.loads(base64.b64decode(encoded));policy['punctuation'].remove('$');policy['keywords'].pop('T_NS_SEPARATOR')
        old=template.replace(encoded,base64.b64encode(json.dumps(policy,sort_keys=True).encode()).decode(),1)
        for raw in cases:
            rc,out,err=php(old,[record(raw,'fixture','config')]);self.assertEqual(rc,1);self.assertNotIn(b'canary',out.lower());self.assertEqual(err,b'')
        metadata=self.actual_loader_metadata()
        records=[record(cases[i%2],row['path'],row['mode']) for i,row in enumerate(metadata['targets'])]
        rc,out,err=php(template,records);self.assertEqual((rc,err),(0,b''));self.assertNotIn(b'canary',out.lower())
        files=json.loads(out)['files'];self.assertEqual(len(files),13)
        for item,row in zip(files,metadata['targets']):
            source=item['redactedSource']
            if '$$' in source:self.assertIn('$$REDACTED_I',source);self.assertIn('global $$REDACTED_I',source)
            else:self.assertIn('\\{REDACTED_I',source)
            if row['mode']=='config':
                self.assertNotIn('getenv',source)
                for key in ('includeCandidates','includeSiteFacts','guardFacts','closedPublicRegistrations'):self.assertEqual(item[key],[])
        for raw,mode in ((b'<?php $$private_name_canary="PRIVATE_UNCLOSED_CANARY','config'),(b'<?php function unrelated(){global $$private_name_canary;','loader_init'),(b'<?php \x01 $$private_name_canary;','config')):
            rc,out,err=php(template,[record(raw,'fixture',mode)]);self.assertEqual((rc,err),(1,b''));self.assertNotIn(b'canary',out.lower());self.assertNotIn(b'\x01',out)
    def test_record_tokenizer_guards_full_representative_constructs(self):
        metadata=self.actual_loader_metadata()
        cases=[br'<?php define("PRIVATE_NAME_CANARY","PRIVATE_VALUE_CANARY");',br'<?php namespace Synthetic\CLI {use Synthetic\Other as Other;class Runner {function load_wordpress(){include __DIR__."/PRIVATE_PATH_CANARY.php";eval($this->opaque);}}}',br'<?php #[SyntheticAttribute("PRIVATE_VALUE_CANARY")] class Runner{function init(){return true;}}',br'<?php class Runner{function &run(&$x,...$args){$y=&$x;return $y;}}',br'<?php class Runner{function init(){echo "{$this->opaque}";echo "${opaque}";}}']
        records=[record(cases[i%len(cases)],row['path'],row['mode']) for i,row in enumerate(metadata['targets'])]
        records[7]=record(br'<?php namespace Synthetic\CLI;use Synthetic\Other\{Runner,Loader};class App{}',metadata['targets'][7]['path'],'loader_init')
        records[8]=record(b'<?php \x01 PRIVATE_INVALID_CANARY;','synthetic_invalid','config')
        records[9]=record(b'<?php function unrelated(){','synthetic_unclosed','loader_init')
        records[11]=record(b'<?php echo "PRIVATE_UNCLOSED_CANARY','synthetic_quote','loader_init')
        rc,out,err=php(r.record_tokenizer_status_template(),records);self.assertEqual((rc,err),(0,b''));self.assertNotIn(b'PRIVATE_',out)
        value=r.validate_record_tokenizer_status(json.loads(out),13);rows=value['records']
        self.assertEqual([(i,row['guardCode'],row['phaseCode']) for i,row in enumerate(rows) if not row['tokenizerPass']],[(8,4,3),(9,3,2),(11,6,3)])
        self.assertGreaterEqual(rows[8]['tokenKind'],256)
        self.assertTrue(all(row['tokenKind']==0 for row in rows if row['tokenizerPass']))
        self.assertLessEqual(len(out),2048)
    def test_record_tokenizer_preparation_preserves_ordinary_metadata(self):
        metadata=self.actual_loader_metadata();program=r.prepare_record_tokenizer_diagnostic_program(metadata);compile(program,'record_diagnostic','exec')
        self.assertEqual(r.digest(r.prepare_program('bodies',metadata).encode()),'094bab84a287cb52a615fe6801acc43540bcf3808f62c94e91fcec7194d6bd07')
        self.assertEqual(r.digest(r.prepare_program().encode()),'646094ff628eed7de3c5011e1afcbe6a9d67f93ebe81c615e6f7dccd8b3dd20e')
        self.assertEqual(r.digest(r.render_template().encode()),'f11b11033302145d6092a4f62ba9c93bef4f4b7123cd9189537e1fe31fde7628')
        self.assertIn('signal.alarm(8)',program);self.assertIn('timeout=6',program);self.assertIn('child.wait(timeout=REAP_SECONDS)',program)
        self.assertIn('for path,cap,binding in owned:require(',program)
        self.assertIn('validate_record_tokenizer_status(tokenize(RENDER_PHP,records),len(records))',program)
        self.assertNotIn('rendered=tokenize(RENDER_PHP,records)',program)
    def test_record_tokenizer_capture_closed_indices_guard_codes(self):
        metadata=self.actual_loader_metadata();program=r.prepare_record_tokenizer_diagnostic_program(metadata)
        value=dict(schema='ir.bootstrap.fixed_loader_record_tokenizer_status.v1',classification='FIXED_RECORD_TOKENIZER_STATUS_NOT_APPROVAL',records=[dict(entryIndex=i,tokenizerPass=True,guardCode=0,phaseCode=0,tokenKind=0) for i in range(13)],noSemanticApproval=True)
        calls=[]
        def capture(argv,source,budget,cap):calls.append(cap);return json.dumps(value).encode()
        self.assertEqual(r.capture_record_tokenizer_diagnostic_prepared(capture,program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata),value);self.assertEqual(calls,[2048])
        for field,replacement in (('entryIndex',True),('tokenizerPass',1),('guardCode',1001),('phaseCode',8),('tokenKind','PRIVATE_TOKEN_CANARY')):
            bad=copy.deepcopy(value);bad['records'][0][field]=replacement
            with self.assertRaises(r.Stop):r.capture_record_tokenizer_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata)
        bad=copy.deepcopy(value);bad['records'][0]['path']='PRIVATE_PATH_CANARY'
        with self.assertRaises(r.Stop):r.capture_record_tokenizer_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata)
        bad=copy.deepcopy(value);bad['records'].pop()
        with self.assertRaises(r.Stop):r.capture_record_tokenizer_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata)
        with self.assertRaises(r.Stop):r.capture_record_tokenizer_diagnostic_prepared(lambda *a,**k:b'x'*2049,program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata)
        for changed,deadline in ((program+'# drift',time.monotonic()+5),(program,float('nan')),(program,time.monotonic()+20),(program,time.monotonic()-1)):
            with self.assertRaises(r.Stop):r.capture_record_tokenizer_diagnostic_prepared(capture,changed,SimpleNamespace(deadline=deadline),frozen=metadata)
        with self.assertRaises(r.Stop):r.capture_prepared(capture,r.prepare_program('bodies',metadata),SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata)
    def actual_loader_metadata(self):
        raw=(HERE/'BOOTSTRAP_FIXED_LOADER_METADATA_READBACK_2.json').read_bytes()
        self.assertEqual(r.digest(raw),'7a9069c3d4e9d22864f64e87d8f70438b1251fb75e005c6a5ee87930be68cea3')
        return json.loads(raw)['capture']
    def synthetic_actual_loader_files(self,metadata):
        raw=b'<?php define("PRIVATE_NAME_CANARY","PRIVATE_VALUE_CANARY");class SyntheticLoader {static function init(){return true;}function unrelated(){return "PRIVATE_BODY_CANARY";}}'
        records=[record(raw,row['path'],row['mode']) for row in metadata['targets']]
        rc,out,err=php(r.render_template(),records);self.assertEqual((rc,err),(0,b''));self.assertNotIn(b'PRIVATE_VALUE_CANARY',out)
        files=json.loads(out)['files'];self.assertEqual(len(files),13)
        for item,row in zip(files,metadata['targets']):
            if row['mode']=='config':self.assertNotIn('PRIVATE_NAME_CANARY',item['redactedSource'])
            # Synthetic schema exercise only; these are not actual source claims.
            item['bytes']=row['bytes'];item['sourceSha256']=row['sha256']
        return files
    def test_body_actual_thirteen_mixed_modes_no_schema_mismatch(self):
        metadata=self.actual_loader_metadata();files=self.synthetic_actual_loader_files(metadata)
        self.assertEqual(sum(row['mode']=='config' for row in metadata['targets']),2)
        value=dict(schema='ir.bootstrap.fixed_loader_closure.v1',classification='STATIC_REDACTED_CLOSURE_NOT_APPROVAL',metadata=metadata,files=files,noSemanticApproval=True)
        program=r.prepare_program('bodies',metadata)
        self.assertEqual(r.digest(program.encode()),'094bab84a287cb52a615fe6801acc43540bcf3808f62c94e91fcec7194d6bd07')
        self.assertEqual(r.capture_prepared(lambda *a,**k:json.dumps(value).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata),value)
    def test_body_diagnostic_exact_scope_and_copied_validation_stages(self):
        metadata=self.actual_loader_metadata();files=self.synthetic_actual_loader_files(metadata);program=r.prepare_body_diagnostic_program(metadata)
        start=program.index('try:\n entries=[];launcher=None;manifest=None;configs=[]');end=program.index(" if PHASE=='bodies':\n  DIAGNOSTIC_STAGE='FROZEN_METADATA_COMPARE'",start)
        for mutation,stage,reason,count in (('good','COMPLETE','NONE',13),('schema','BODY_VALIDATE_ROW_SCHEMA','FIXED_LOADER_STOP',13),('custody','BODY_VALIDATE_ROW_CUSTODY','FIXED_LOADER_STOP',13),('privacy','BODY_VALIDATE_CONFIG_PRIVACY','FIXED_LOADER_STOP',13),('call','BODY_VALIDATE_CALL_FACTS','FIXED_LOADER_STOP',13),('count','BODY_PRODUCER_COUNT','BODY_COUNT_STOP',12),('tokenizer','BODY_TOKENIZATION','STRUCTURE_STOP',0),('read','BODY_RECORD_CAPTURE','INTERNAL_STOP',0)):
            rendered=copy.deepcopy(files)
            if mutation=='schema':rendered[0].pop('configCallFacts')
            if mutation=='custody':rendered[0]['sourceSha256']='0'*64
            if mutation=='privacy':rendered[0]['includeCandidates']=['PRIVATE_TARGET_CANARY']
            if mutation=='call':rendered[0]['configCallFacts']=[dict(tokenOffset=0,callType='PRIVATE_CALL_CANARY')]
            if mutation=='count':rendered.pop()
            # Replace only pre-body remote reads with finite fixtures. The exact
            # thirteen-target body loop and consumer AST still execute locally.
            prefix="""try:
 value=FROZEN_METADATA;targets=value['targets'];launcher=b'';manifest={name:None for name in PHAR_TARGETS}
 reads=[]
 def fixture_read(path,*args):
  reads.append(path)
  READ_ERROR
  return b'PRIVATE_SOURCE_CANARY'
 checked=fixture_read
 phar_entry=lambda *a:b'PRIVATE_PHAR_CANARY'
 def tokenize(template,records):
  require(len(records)==13 and len(reads)==6,'BODY_COUNT_STOP')
  TOKENIZER_ERROR
  return {'files':RENDERED}
""".replace('RENDERED',repr(rendered)).replace('READ_ERROR',"raise OSError('PRIVATE_ERROR_CANARY')" if mutation=='read' else 'pass').replace('TOKENIZER_ERROR',"raise json.JSONDecodeError('PRIVATE_ERROR_CANARY','PRIVATE_DATA_CANARY',0)" if mutation=='tokenizer' else 'pass')
            synthetic=program[:start]+prefix+program[end:]
            p=subprocess.run([sys.executable,'-B','-'],input=synthetic.encode(),capture_output=True,timeout=5)
            self.assertEqual((p.returncode,p.stderr),(0,b''));self.assertNotIn(b'PRIVATE_',p.stdout)
            status=json.loads(p.stdout);self.assertEqual((status['stage'],status['reason'],status['bodyCount']),(stage,reason,count))
            self.assertEqual(status['classification'],'FIXED_BODY_DIAGNOSTIC_COMPLETE' if mutation=='good' else 'FIXED_BODY_DIAGNOSTIC_STOP')
    def test_body_diagnostic_capture_closed_status_and_program_seals(self):
        metadata=self.actual_loader_metadata();program=r.prepare_body_diagnostic_program(metadata);compile(program,'body_diagnostic','exec')
        value=dict(schema='ir.bootstrap.fixed_loader_body_diagnostic.v1',classification='FIXED_BODY_DIAGNOSTIC_STOP',stage='BODY_TOKENIZATION',reason='TOKENIZER_STOP',bodyCount=0,noSemanticApproval=True)
        calls=[]
        def capture(argv,source,budget,cap):calls.append(cap);return json.dumps(value).encode()
        self.assertEqual(r.capture_body_diagnostic_prepared(capture,program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata),value);self.assertEqual(calls,[2048])
        for key,replacement in (('stage','PRIVATE_STAGE_CANARY'),('reason','PRIVATE_ERROR_CANARY'),('bodyCount',14),('bodyCount',True),('noSemanticApproval',False),('classification','STATIC_REDACTED_CLOSURE_NOT_APPROVAL')):
            bad=dict(value);bad[key]=replacement
            with self.assertRaises(r.Stop):r.capture_body_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata)
        bad=dict(value);bad['source']='PRIVATE_RAW_CANARY'
        with self.assertRaises(r.Stop):r.capture_body_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata)
        with self.assertRaises(r.Stop):r.capture_body_diagnostic_prepared(lambda *a,**k:b'x'*2049,program,SimpleNamespace(deadline=time.monotonic()+5),frozen=metadata)
        for changed,deadline in ((program+'# drift',time.monotonic()+5),(program,float('nan')),(program,time.monotonic()+20),(program,time.monotonic()-1)):
            with self.assertRaises(r.Stop):r.capture_body_diagnostic_prepared(capture,changed,SimpleNamespace(deadline=deadline),frozen=metadata)
        with self.assertRaises(r.Stop):r.capture_prepared(capture,r.prepare_program('bodies',metadata),SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata)
    def test_dormant_and_blocked_cli(self):
        for argv,expected,word in (([],0,b'DORMANT'),(['--execute'],1,b'BLOCKED')):
            p=subprocess.run([sys.executable,'-B',str(HERE/'bootstrap_fixed_loader_reader.py'),*argv],capture_output=True,timeout=20)
            self.assertEqual(p.returncode,expected);self.assertIn(word,p.stdout);self.assertEqual(p.stderr,b'')
    def test_preparation_binding_caps_and_no_execution(self):
        m=r.prepare_program();b=r.prepare_program('bodies',frozen())
        compile(m,'metadata','exec');compile(b,'bodies','exec')
        self.assertIn("signal.alarm(8)",m);self.assertIn('child.wait(timeout=REAP_SECONDS)',m)
        self.assertIn('timeout=6',m);self.assertIn("'-n'",m);self.assertIn(r.TOKENIZER_SHA,m)
        self.assertNotIn('eval(',r.FACT_PHP);self.assertNotIn('include(',r.FACT_PHP)
        self.assertEqual(r.REAP_SECONDS,2);self.assertEqual(r.IO_SECONDS,10)
        with self.assertRaises(r.Stop):r.prepare_program('bodies')
        with patch.object(r,'regular',return_value=b'drift'):
            with self.assertRaises(r.Stop):r.prepare_program()
    def test_diagnostic_additive_normal_program_frozen(self):
        normal=r.prepare_program();self.assertEqual(r.digest(normal.encode()),'646094ff628eed7de3c5011e1afcbe6a9d67f93ebe81c615e6f7dccd8b3dd20e')
        diagnostic=r.prepare_diagnostic_program();compile(diagnostic,'diagnostic','exec')
        self.assertIn('FIXED_DIAGNOSTIC_STOP',diagnostic);self.assertIn('signal.alarm(8)',diagnostic)
        self.assertIn('child.wait(timeout=REAP_SECONDS)',diagnostic);self.assertIn('timeout=6',diagnostic)
        self.assertNotIn("sys.exit(1)",diagnostic)
        self.assertIn("sys.exit(1)",normal);self.assertNotIn('diagnostic_emit',normal)
    def test_diagnostic_synthetic_only_reason_privacy_and_exit(self):
        program=r.prepare_diagnostic_program();start=program.index('try:\n entries=[];launcher=None;manifest=None;configs=[]');end=program.index('except BaseException as issue:',start)
        for statement,reason in (("raise Stop('PHAR_PREFIX_STOP')",'PHAR_PREFIX_STOP'),("raise Stop('PRIVATE_SOURCE_CANARY')",'INTERNAL_STOP'),("raise FileNotFoundError('PRIVATE_PATH_CANARY')",'READ_ABSENT_STOP'),("raise PermissionError('PRIVATE_PERMISSION_CANARY')",'READ_PERMISSION_STOP'),("raise subprocess.TimeoutExpired('PRIVATE_COMMAND_CANARY',6)",'TOKENIZER_TIMEOUT_STOP'),("raise RuntimeError('PRIVATE_ERROR_CANARY')",'INTERNAL_STOP')):
            synthetic=program[:start]+"try:\n DIAGNOSTIC_STAGE='PHAR_MANIFEST_PARSE'\n "+statement+'\n'+program[end:]
            p=subprocess.run([sys.executable,'-B','-'],input=synthetic.encode(),capture_output=True,timeout=5)
            self.assertEqual((p.returncode,p.stderr),(0,b''));self.assertNotIn(b'PRIVATE_',p.stdout)
            self.assertEqual(json.loads(p.stdout),dict(schema='ir.bootstrap.fixed_loader_diagnostic.v1',classification='FIXED_DIAGNOSTIC_STOP',stage='PHAR_MANIFEST_PARSE',reason=reason,noSemanticApproval=True))
        synthetic=program[:start]+"try:\n DIAGNOSTIC_STAGE='COMPLETE'\n diagnostic_emit('FIXED_DIAGNOSTIC_COMPLETE','NONE')\n"+program[end:]
        p=subprocess.run([sys.executable,'-B','-'],input=synthetic.encode(),capture_output=True,timeout=5)
        self.assertEqual((p.returncode,p.stderr),(0,b''));self.assertEqual(json.loads(p.stdout)['reason'],'NONE')
    def test_diagnostic_capture_closed_schema_and_not_metadata(self):
        program=r.prepare_diagnostic_program();value=dict(schema='ir.bootstrap.fixed_loader_diagnostic.v1',classification='FIXED_DIAGNOSTIC_STOP',stage='PHAR_MANIFEST_PARSE',reason='PHAR_PREFIX_STOP',noSemanticApproval=True)
        calls=[]
        def capture(argv,source,budget,cap):calls.append((argv,source,cap));return json.dumps(value).encode()
        self.assertEqual(r.capture_diagnostic_prepared(capture,program,SimpleNamespace(deadline=time.monotonic()+5)),value)
        self.assertEqual(calls[0][2],2048);self.assertEqual(calls[0][0],r.SSH_ARGV)
        for key,replacement in (('stage','PRIVATE_STAGE_CANARY'),('reason','PRIVATE_ERROR_CANARY'),('classification','FIXED_TARGET_FACTS_NOT_APPROVAL'),('noSemanticApproval',False)):
            bad=dict(value);bad[key]=replacement
            with self.assertRaises(r.Stop):r.capture_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5))
        bad=dict(value);bad['raw']='PRIVATE_VALUE_CANARY'
        with self.assertRaises(r.Stop):r.capture_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5))
        with self.assertRaises(r.Stop):r.capture_diagnostic_prepared(lambda *a,**k:b'x'*2049,program,SimpleNamespace(deadline=time.monotonic()+5))
        for changed,deadline in ((program+'# drift',time.monotonic()+5),(program,float('nan')),(program,time.monotonic()+20),(program,time.monotonic()-1)):
            with self.assertRaises(r.Stop):r.capture_diagnostic_prepared(capture,changed,SimpleNamespace(deadline=deadline))
        with self.assertRaises(r.Stop):r.capture_prepared(capture,r.prepare_program(),SimpleNamespace(deadline=time.monotonic()+5))
    def test_diagnostic_tokenizer_labels_closed_without_child_execution(self):
        program=r.prepare_diagnostic_program();start=program.index('try:\n entries=[];launcher=None;manifest=None;configs=[]');end=program.index('except BaseException as issue:',start)
        for reply,reason in ((b'{"classification":"FIXED_SYNTAX_STOP"}','FIXED_SYNTAX_STOP'),(b'{"classification":"FIXED_ROOT_BINDING_STOP"}','FIXED_ROOT_BINDING_STOP'),(b'{"classification":"PRIVATE_VALUE_CANARY"}','TOKENIZER_STOP')):
            body="""try:
 DIAGNOSTIC_STAGE='FACT_TOKENIZATION'
 class Fake:
  returncode=1
  def communicate(self,*a,**k):return REPLY,None
  def poll(self):return 1
 checked=lambda *a,**k:b''
 subprocess.Popen=lambda *a,**k:Fake()
 tokenize(FACT_PHP,[])
""".replace('REPLY',repr(reply))
            synthetic=program[:start]+body+program[end:]
            p=subprocess.run([sys.executable,'-B','-'],input=synthetic.encode(),capture_output=True,timeout=5)
            self.assertEqual((p.returncode,p.stderr),(0,b''));self.assertNotIn(b'PRIVATE_',p.stdout)
            value=json.loads(p.stdout);self.assertEqual(value['stage'],'FACT_TOKENIZATION');self.assertEqual(value['reason'],reason)
    def test_syntax_binding_shapes_with_exact_directory_correction(self):
        for binding,count,kind,passed in (("__DIR__",6,'CONST_DIR',True),("__DIR__ . '/kinsta-mu-plugins'",8,'CONST_DIR_CONCAT',True),(repr(r.WEBROOT+'/wp-content/mu-plugins/kinsta-mu-plugins'),6,'CONST_LITERAL',True),("$PRIVATE_BINDING_CANARY",6,'UNRESOLVED',False),("'/private/PRIVATE_LITERAL_CANARY'",6,'CONST_LITERAL',False)):
            rc,out,err=php(r.syntax_status_template(),syntax_entries(binding,count));self.assertEqual((rc,err),(0,b''));self.assertNotIn(b'PRIVATE_',out)
            value=r.validate_syntax_status(json.loads(out));self.assertEqual(value['kinstaBindingKind'],kind)
            self.assertEqual([row['syntaxPass'] for row in value['entries']],[True,passed,True,True,True])
            self.assertEqual([row['entryIndex'] for row in value['entries']],list(range(5)))
    def test_syntax_independent_failure_rows_and_unknown_binding(self):
        records=syntax_entries();records[0]=record(b'<?php echo "PRIVATE_CONFIG_CANARY";','wp-config.php');records[2]=record(b'<?php require "PRIVATE_MATRIX_CANARY";','wp-content/mu-plugins/missionmed-matrix-account-entry.php')
        rc,out,err=php(r.syntax_status_template(),records);self.assertEqual((rc,err),(0,b''));self.assertNotIn(b'PRIVATE_',out)
        value=r.validate_syntax_status(json.loads(out));self.assertEqual([row['syntaxPass'] for row in value['entries']],[False,True,False,True,True])
        self.assertEqual(value['kinstaBindingKind'],'CONST_DIR')
        records=syntax_entries();records[1]=record(b'<?php const PLUGIN_DIR=__DIR__;const PLUGIN_DIR="PRIVATE_AMBIGUOUS_CANARY";','wp-content/mu-plugins/kinsta-mu-plugins.php')
        rc,out,err=php(r.syntax_status_template(),records);self.assertEqual((rc,err),(0,b''));self.assertEqual(json.loads(out)['kinstaBindingKind'],'UNRESOLVED');self.assertNotIn(b'PRIVATE_',out)
    def test_syntax_program_frozen_ancestors_and_early_terminal(self):
        program=r.prepare_syntax_diagnostic_program();compile(program,'syntax','exec')
        self.assertEqual(r.digest(r.prepare_program().encode()),'646094ff628eed7de3c5011e1afcbe6a9d67f93ebe81c615e6f7dccd8b3dd20e')
        self.assertEqual(r.digest(r.prepare_diagnostic_program().encode()),'ea227c691a17488c7de8c4590895e01a5615e8eea9b6e15bf24365842ea87195')
        main=program[program.index('try:\n entries=[];launcher=None;manifest=None;configs=[]'):]
        self.assertNotIn('for fact in facts:',main);self.assertNotIn('for name in PHAR_TARGETS:',main)
        self.assertNotIn('root_binding=tokenize',main);self.assertNotIn('p=KINSTA_BOOT',main)
        self.assertIn('for path,cap,binding in owned:require(',main)
        self.assertIn('signal.alarm(8)',program);self.assertIn('timeout=6',program)
        self.assertIn('child.wait(timeout=REAP_SECONDS)',program)
        hashes=[]
        for seed in ('1','2'):
            env=dict(r.os.environ);env['PYTHONHASHSEED']=seed
            code="import importlib.util,sys;from pathlib import Path;p=Path(sys.argv[1]);s=importlib.util.spec_from_file_location('fixed',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m);print(m.digest(m.prepare_syntax_diagnostic_program().encode()))"
            p=subprocess.run([sys.executable,'-B','-c',code,str(HERE/'bootstrap_fixed_loader_reader.py')],env=env,capture_output=True,timeout=5)
            self.assertEqual((p.returncode,p.stderr),(0,b''));hashes.append(p.stdout.strip())
        self.assertEqual(hashes,[r.digest(program.encode()).encode()]*2)
    def test_syntax_capture_fixed_rows_enum_budget_and_no_metadata(self):
        program=r.prepare_syntax_diagnostic_program();value=dict(schema='ir.bootstrap.fixed_loader_syntax_status.v1',classification='FIXED_SYNTAX_STATUS_NOT_APPROVAL',entries=[dict(entryIndex=i,syntaxPass=i!=1) for i in range(5)],kinstaBindingKind='CONST_DIR',noSemanticApproval=True)
        capture=lambda *a,**k:json.dumps(value).encode()
        self.assertEqual(r.capture_syntax_diagnostic_prepared(capture,program,SimpleNamespace(deadline=time.monotonic()+5)),value)
        for key,replacement in (('kinstaBindingKind','PRIVATE_KIND_CANARY'),('noSemanticApproval',False),('classification','FIXED_TARGET_FACTS_NOT_APPROVAL'),('entries',[dict(entryIndex=0,syntaxPass=True)])):
            bad=dict(value);bad[key]=replacement
            with self.assertRaises(r.Stop):r.capture_syntax_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5))
        for field,replacement in (('entryIndex',True),('syntaxPass',1)):
            bad=copy.deepcopy(value);bad['entries'][0][field]=replacement
            with self.assertRaises(r.Stop):r.capture_syntax_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5))
        bad=dict(value);bad['raw']='PRIVATE_SOURCE_CANARY'
        with self.assertRaises(r.Stop):r.capture_syntax_diagnostic_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5))
        with self.assertRaises(r.Stop):r.capture_syntax_diagnostic_prepared(lambda *a,**k:b'x'*2049,program,SimpleNamespace(deadline=time.monotonic()+5))
        for changed,deadline in ((program+'# drift',time.monotonic()+5),(program,float('nan')),(program,time.monotonic()+20),(program,time.monotonic()-1)):
            with self.assertRaises(r.Stop):r.capture_syntax_diagnostic_prepared(capture,changed,SimpleNamespace(deadline=deadline))
        with self.assertRaises(r.Stop):r.capture_prepared(capture,r.prepare_program(),SimpleNamespace(deadline=time.monotonic()+5))
    def test_private_capture_deadline_drift_and_caps(self):
        program=r.prepare_program();data=json.dumps(frozen()).encode();calls=[]
        def capture(argv,source,budget,cap):
            calls.append((argv,source,cap));return data
        out=r.capture_prepared(capture,program,SimpleNamespace(deadline=time.monotonic()+5))
        self.assertEqual(out,frozen());self.assertEqual(calls[0][0],r.SSH_ARGV);self.assertEqual(calls[0][2],r.OUTPUT_CAP)
        for p,d in ((program+'\n# drift',time.monotonic()+5),(program,float('nan')),(program,time.monotonic()-1),(program,time.monotonic()+20)):
            with self.assertRaises(r.Stop):r.capture_prepared(capture,p,SimpleNamespace(deadline=d))
        with self.assertRaises(r.Stop):r.capture_prepared(lambda *a,**k:b'x'*(r.OUTPUT_CAP+1),program,SimpleNamespace(deadline=time.monotonic()+5))
    def test_frozen_exact_paths_and_modes(self):
        r.validate_metadata(frozen())
        for bad in ('/etc/passwd',r.WEBROOT+'/wp-content/plugins/../private.php',r.WEBROOT+'/wp-content/plugins/a//private.php','phar://evil.phar/php/boot-phar.php'):
            value=frozen();value['facts'][3]['target']=bad
            with self.assertRaises(r.Stop):r.validate_metadata(value)
        value=frozen();value['targets'][0]['raw']='CANARY'
        with self.assertRaises(r.Stop):r.validate_metadata(value)
    def test_regular_cap_symlink_drift(self):
        with tempfile.TemporaryDirectory() as t:
            path=Path(t).resolve()/'fixture.php';path.write_bytes(b'synthetic')
            self.assertEqual(r.regular(path,9),b'synthetic')
            with self.assertRaises(r.Stop):r.regular(path,8)
            link=Path(t).resolve()/'link.php';link.symlink_to(path)
            with self.assertRaises(r.Stop):r.regular(link,9)
            original=r.os.lstat
            def altered(p):
                result=original(p)
                if Path(p)==path:return SimpleNamespace(st_mode=result.st_mode,st_dev=result.st_dev,st_ino=result.st_ino,st_size=10,st_mtime_ns=result.st_mtime_ns,st_ctime_ns=result.st_ctime_ns)
                return result
            with patch.object(r.os,'lstat',side_effect=altered):
                with self.assertRaises(r.Stop):r.regular(path,9)
    def test_phar_selection_and_refusal(self):
        for compressed in (False,True):
            raw=phar(compression=compressed);stub,entries=r.phar_manifest(raw)
            self.assertEqual(list(entries),[r.PHAR_TARGETS[0]]);self.assertIn(b'__HALT_COMPILER',stub)
            self.assertIn(b'SYNTHETIC_PRIVATE_CANARY',r.phar_entry(raw,entries[r.PHAR_TARGETS[0]]))
            modified=raw[:-1]+b'X'
            # Unrelated bytes never qualify as selected provenance and are never extracted.
            self.assertEqual(r.phar_entry(modified,entries[r.PHAR_TARGETS[0]]),r.phar_entry(raw,entries[r.PHAR_TARGETS[0]]))
        for raw in (phar(version=0x1011),phar(alias=b'evil.phar'),phar(names=['../escape.php']),phar(names=['/escape.php']),phar(names=['a.php','a.php']),b'<?php include "evil";',phar()[:60],b'x'*(r.LAUNCHER_CAP+1)):
            with self.assertRaises(r.Stop):r.phar_manifest(raw)
        raw=phar(names=[r.PHAR_TARGETS[0]]);_,e=r.phar_manifest(raw)
        with self.assertRaises(r.Stop):r.phar_entry(raw[:-1]+b'X',e[r.PHAR_TARGETS[0]])
    def test_config_privacy_and_source_nonexecution(self):
        raw=b'''<?php /* COMMENT_CANARY */ define('PRIVATE_NAME_CANARY','WP_PLUGIN_DIR');
const PRIVATE_CONST_CANARY='phar://private/path.php';$PRIVATE_VAR_CANARY=314159;
function PRIVATE_FUNCTION_CANARY(){return 'FUNCTION_CANARY';}
require '/not-read/INCLUDE_CANARY.php';file_put_contents('/not-written/EXEC_CANARY','BODY_CANARY');
echo "INTERPOLATED_CANARY{$PRIVATE_VAR_CANARY}"; ?>INLINE_CANARY'''
        rc,out,err=php(r.render_template(),[record(raw,'config_fixture','config')])
        self.assertEqual((rc,err),(0,b''));v=json.loads(out);item=v['files'][0]
        for word in (b'PRIVATE_',b'COMMENT_CANARY',b'314159',b'FUNCTION_CANARY',b'INCLUDE_CANARY',b'EXEC_CANARY',b'BODY_CANARY',b'INTERPOLATED_CANARY',b'INLINE_CANARY',b'WP_PLUGIN_DIR',b'phar://private'):
            self.assertNotIn(word,out)
        for key in ('includeCandidates','includeSiteFacts','guardFacts','closedPublicRegistrations'):self.assertEqual(item[key],[])
        self.assertEqual(item['sourceSha256'],r.digest(raw));self.assertIn('require',item['redactedSource'])
    def test_loader_slice_init_only(self):
        raw=b'''<?php class PublicLoader {static function init(){add_action('init',function(){return 'INIT_SECRET_CANARY';});}
function renderer(){wp_remote_post('UNRELATED_RENDER_CANARY');}}
PublicLoader::init();require __DIR__.'/public-target.php';'''
        rc,out,err=php(r.render_template(),[record(raw)])
        self.assertEqual((rc,err),(0,b''));item=json.loads(out)['files'][0]
        self.assertEqual(item['suppressedBodies'],1);self.assertIn('add_action',item['redactedSource']);self.assertNotIn('wp_remote_post',item['redactedSource'])
        self.assertNotIn(b'INIT_SECRET_CANARY',out);self.assertNotIn(b'UNRELATED_RENDER_CANARY',out)
    def test_root_binding_first_argument_only(self):
        raw=b"<?php define('DB_PASSWORD','WP_PLUGIN_DIR');define('OTHER','WP_CONTENT_DIR');"
        rc,out,_=php(r.OVERRIDE_PHP,[record(raw)])
        self.assertEqual(rc,0);self.assertEqual(json.loads(out),dict(standardPluginRootOverridden=False,standardContentRootOverridden=False,dynamicDefinitionUnresolved=False))
        for code,field in ((b"<?php define('WP_PLUGIN_DIR',getenv('PRIVATE_ENV_CANARY'));",'standardPluginRootOverridden'),(b"<?php \\define('WP_CONTENT_DIR','SECRET_ROOT_CANARY');",'standardContentRootOverridden'),(b'<?php define($key,$value);','dynamicDefinitionUnresolved'),(br'<?php define("\x57P_PLUGIN_DIR", "ROOT_CANARY");','dynamicDefinitionUnresolved')):
            rc,out,_=php(r.OVERRIDE_PHP,[record(code)]);self.assertEqual(rc,0);self.assertTrue(json.loads(out)[field]);self.assertNotIn(b'CANARY',out)
    def test_config_names_values_and_partial_literals_opaque(self):
        raw=br'''<?php namespace PRIVATE_NAMESPACE_CANARY;
class PRIVATE_CLASS_CANARY {public function PRIVATE_METHOD_CANARY(): PRIVATE_TYPE_CANARY {return new PRIVATE_TYPE_CANARY;}}
define('PRIVATE_NAME_CANARY', 'PUBLIC_PREFIX'.'PRIVATE_SUFFIX_CANARY');
const PRIVATE_CONST_CANARY=true;$PRIVATE_VAR_CANARY=null;
if(defined('WP_CLI')){getenv('PRIVATE_ENV_CANARY');}
echo <<<PRIVATE_HEREDOC_CANARY
PRIVATE_BODY_CANARY {$PRIVATE_VAR_CANARY}
PRIVATE_HEREDOC_CANARY;
require __DIR__.'/private/PRIVATE_PATH_CANARY.php';?>PRIVATE_INLINE_CANARY'''
        rc,out,err=php(r.render_template(),[record(raw,'config2_fixture','config')]);self.assertEqual((rc,err),(0,b''))
        for word in (b'PRIVATE_',b'PUBLIC_PREFIX',b'WP_CLI',b'define',b'defined',b'getenv',b'true',b'null'):
            self.assertNotIn(word,out)
        item=json.loads(out)['files'][0];self.assertIn('namespace',item['redactedSource']);self.assertIn('require',item['redactedSource'])
        self.assertEqual(item['includeSiteFacts'],[]);self.assertEqual(item['guardFacts'],[])
    def test_suppressed_interpolated_braces_cannot_escape_slice(self):
        raw=br'''<?php class PublicLoader {function renderer(){echo "{$secret}";PRIVATE_LEAK_CANARY();if(true){PRIVATE_NESTED_CANARY();}}
static function init(){return 'PRIVATE_VALUE_CANARY';}}PublicLoader::init();'''
        rc,out,err=php(r.render_template(),[record(raw)]);self.assertEqual((rc,err),(0,b''))
        item=json.loads(out)['files'][0];self.assertEqual(item['suppressedBodies'],1)
        self.assertIn('PublicLoader',item['redactedSource']);self.assertIn('init',item['redactedSource']);self.assertNotIn(b'PRIVATE_',out)
    def test_config_call_categories_only_exact_called_contexts(self):
        raw=br'''<?php define('DB_PASSWORD','curl_exec');$v='file_put_contents';
\define('PRIVATE_NAME_CANARY',getenv('PRIVATE_ENV_CANARY'));
trim(file_get_contents('PRIVATE_FILE_CANARY'));curl_exec($opaque);
file_put_contents('PRIVATE_OUTPUT_CANARY',$opaque);proc_open($opaque,[], $opaque);
PRIVATE_PROVISION_CANARY();$opaque->define($opaque,$opaque);new PRIVATE_CLASS_CANARY();
$opaque($opaque);eval($opaque);'''
        rc,out,err=php(r.render_template(),[record(raw,'config2_fixture','config')]);self.assertEqual((rc,err),(0,b''))
        for value in (b'PRIVATE_',b'DB_PASSWORD',b'curl_exec',b'file_put_contents',b'getenv',b'define'):
            self.assertNotIn(value,out)
        facts=json.loads(out)['files'][0]['configCallFacts'];kinds=[f['callType'] for f in facts]
        self.assertEqual(kinds.count('configuration_definition_syntax'),2)
        for kind in ('environment_read_syntax','file_read_syntax','transport_syntax','filesystem_write_syntax','process_launch_syntax','unclassified_call_syntax','opaque_method_call_syntax','opaque_constructor_call_syntax','indirect_call_syntax','eval_syntax'):
            self.assertIn(kind,kinds)
        self.assertEqual(kinds.count('transport_syntax'),1)
        self.assertTrue(all(set(f)=={'tokenOffset','callType'} for f in facts))
    def test_body_capture_bound_to_frozen_config_and_no_extra_rows(self):
        metadata=frozen();row=metadata['targets'][0];raw=b'<?php $secret="VALUE_CANARY";'
        row.update(present=True,bytes=len(raw),sha256=r.digest(raw));program=r.prepare_program('bodies',metadata)
        rc,rendered,err=php(r.render_template(),[record(raw,row['path'],row['mode'])]);self.assertEqual((rc,err),(0,b''))
        value=dict(schema='ir.bootstrap.fixed_loader_closure.v1',classification='STATIC_REDACTED_CLOSURE_NOT_APPROVAL',metadata=metadata,files=json.loads(rendered)['files'],noSemanticApproval=True)
        capture=lambda *a,**k:json.dumps(value).encode()
        self.assertEqual(r.capture_prepared(capture,program,SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata),value)
        for field in ('includeCandidates','includeSiteFacts','guardFacts','closedPublicRegistrations'):
            bad=copy.deepcopy(value);bad['files'][0][field]=['VALUE_CANARY']
            with self.assertRaises(r.Stop):r.capture_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata)
        bad=copy.deepcopy(value);bad['files'].append(bad['files'][0])
        with self.assertRaises(r.Stop):r.capture_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata)
        bad=copy.deepcopy(value);bad['files'][0]['configCallFacts']=[dict(tokenOffset=0,callType='VALUE_CANARY')]
        with self.assertRaises(r.Stop):r.capture_prepared(lambda *a,**k:json.dumps(bad).encode(),program,SimpleNamespace(deadline=time.monotonic()+5),phase='bodies',frozen=metadata)
    def test_fixed_config_and_plugin_include_sites(self):
        wp=('<?php '+';'*109+'require_once '+json.dumps(r.CONFIG_TARGETS[0])+';require_once '+json.dumps(r.CONFIG_TARGETS[1])+';').encode()
        rc,out,err=php(r.FACT_PHP,[record(wp,'wp-config.php')]);self.assertEqual((rc,err),(0,b''));self.assertEqual([x['target'] for x in json.loads(out)['facts']],list(r.CONFIG_TARGETS))
        for role,offset in (('wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php',27),('wp-content/mu-plugins/missionmed-matrix-account-entry.php',282)):
            prefix="<?php $v = WP_PLUGIN_DIR . '/synthetic/init.php'; if (file_exists($v)) {"
            raw=(prefix+';'*(offset-15)+'require_once $v; }').encode()
            rc,out,err=php(r.FACT_PHP,[record(raw,role)]);self.assertEqual((rc,err),(0,b''));self.assertEqual(json.loads(out)['facts'][0]['target'],r.WEBROOT+'/wp-content/plugins/synthetic/init.php')
            rc,out,_=php(r.FACT_PHP,[record(raw.replace(b'/synthetic/init.php',b'/../private.php'),role)]);self.assertEqual(rc,1)
        for prefix,count in (("<?php const PLUGIN_DIR = '/www/theresidencyacademy_209/public/wp-content/mu-plugins/kinsta-mu-plugins';",6),("<?php const PLUGIN_DIR = __DIR__ . '/kinsta-mu-plugins';",8)):
            raw=(prefix+';'*(36-count)+"require PLUGIN_DIR . '/vendor/autoload.php';").encode()
            rc,out,err=php(r.FACT_PHP,[record(raw,'wp-content/mu-plugins/kinsta-mu-plugins.php')]);self.assertEqual((rc,err),(0,b''));self.assertEqual(json.loads(out)['facts'][0]['target'],r.WEBROOT+'/wp-content/mu-plugins/kinsta-mu-plugins/vendor/autoload.php')
    def test_exact_site_refusal_and_launcher_prefix(self):
        for target,expect in ((r.PHAR_PREFIX+r.PHAR_TARGETS[0],0),('phar://evil.phar/php/boot-phar.php',1),(r.PHAR_PREFIX+'../escape.php',1)):
            code=('#!/usr/bin/env php\n<?php Phar::mapPhar(); include '+json.dumps(target)+'; __halt_compiler();').encode()
            rc,out,_=php(r.FACT_PHP,[record(code,'launcher:/usr/local/bin/wp')]);self.assertEqual(rc,expect)
            if not expect:self.assertEqual(json.loads(out)['facts'][0]['target'],target)
        rc,out,_=php(r.FACT_PHP,[record(b'<?php require "/etc/passwd";','wp-config.php')]);self.assertEqual(rc,1);self.assertNotIn(b'/etc/passwd',out)
    def test_actual_plain_directory_binding_requires_unique_fixed_target(self):
        records=syntax_entries();entry=records[1]
        rc,out,err=php(r.FACT_PHP,[entry]);self.assertEqual((rc,err),(0,b''))
        self.assertEqual(json.loads(out)['facts'],[dict(entryRole='wp-content/mu-plugins/kinsta-mu-plugins.php',site=36,target=r.WEBROOT+'/wp-content/mu-plugins/kinsta-mu-plugins/vendor/autoload.php',base='PLUGIN_DIR_literal',guard='unconditional',mode='loader_init')])
        original=base64.b64decode(entry['source'])
        bad_sources=[
            original.replace(b'__DIR__',b'__FILE__'),
            original.replace(b'__DIR__',b'$PRIVATE_BINDING_CANARY'),
            original.replace(b"/kinsta-mu-plugins/vendor/autoload.php",b'/different/vendor/autoload.php'),
            original.replace(b"/kinsta-mu-plugins/vendor/autoload.php",b'/kinsta-mu-plugins/../PRIVATE_PATH_CANARY.php'),
            original.replace(b'require PLUGIN_DIR',b'require OTHER_PRIVATE_CANARY'),
            original.replace(b'const PLUGIN_DIR',b'const OTHER_PRIVATE_CANARY'),
            ("<?php const PLUGIN_DIR=__DIR__;const PLUGIN_DIR=getenv('PRIVATE_DUPLICATE_CANARY');"+';'*22+"require PLUGIN_DIR . '/kinsta-mu-plugins/vendor/autoload.php';").encode(),
            ("<?php const PLUGIN_DIR=__DIR__;const PLUGIN_DIR=__DIR__;"+';'*25+"require PLUGIN_DIR . '/kinsta-mu-plugins/vendor/autoload.php';").encode(),
            ("<?php const PLUGIN_DIR=__DIR__+ 'PRIVATE_OPERATOR_CANARY';"+';'*28+"require PLUGIN_DIR . '/kinsta-mu-plugins/vendor/autoload.php';").encode()]
        for raw in bad_sources:
            rc,out,err=php(r.FACT_PHP,[record(raw,entry['role'])]);self.assertEqual((rc,err),(1,b''));self.assertNotIn(b'PRIVATE_',out)
            self.assertEqual(json.loads(out),{'classification':'FIXED_SYNTAX_STOP'})

if __name__=='__main__':unittest.main(verbosity=2)
