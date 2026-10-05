"""Injected fixtures and isolated local synthetic PHP; no source bootstrap/network."""
import ast
import base64
import contextlib
import io
import json
import subprocess
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import bootstrap_static_reader as reader

CANARY = 'CANARY_SECRET_PASSWORD_87123'


class ReaderTests(unittest.TestCase):
    def test_all_literal_channels_redacted_and_defined_flow_retained(self):
        tokens = [('T_OPEN_TAG', '<?php'), ('T_FUNCTION','function'), ('T_WHITESPACE',' '),
                  ('T_STRING','safe_callback'), ('CHAR','('), ('T_VARIABLE','$password'),
                  ('CHAR',')'), ('CHAR','{'), ('T_RETURN','return'), ('T_WHITESPACE',' '),
                  ('T_CONSTANT_ENCAPSED_STRING',"'"+CANARY+"'"), ('CHAR',';'), ('CHAR','}'),
                  ('T_WHITESPACE',' '), ('T_STRING','safe_callback'), ('CHAR','('), ('CHAR',')'), ('CHAR',';')]
        for kind,text in [('T_COMMENT','// '+CANARY),('T_DOC_COMMENT','/** '+CANARY+' */'),
                          ('T_INLINE_HTML','<script>'+CANARY+'</script>'),
                          ('T_CONSTANT_ENCAPSED_STRING','"'+CANARY+'\\x41"'),
                          ('T_LNUMBER','87123'), ('T_DNUMBER','8.7123e4')]:
            tokens += [(kind,text),('CHAR',';')]
        rendered = reader.redact_fixture_tokens(tokens)
        self.assertNotIn(CANARY,rendered)
        self.assertNotIn('87123',rendered)
        self.assertNotIn('password',rendered)
        self.assertEqual(rendered.count('safe_callback'),2)
        self.assertIn('function safe_callback(',rendered)
        self.assertIn('return',rendered)
        self.assertIn('REDACTED_L',rendered)

    def test_encapsed_heredoc_nowdoc_and_escape_delimiters_opaque(self):
        tokens = [('CHAR','"'),('T_ENCAPSED_AND_WHITESPACE',CANARY),('T_VARIABLE','$secret'),('CHAR','"'),
                  ('CHAR',';'),('T_START_HEREDOC','<<<SECRET_MARKER'),
                  ('T_ENCAPSED_AND_WHITESPACE',CANARY),('T_VARIABLE','$secret'),('T_END_HEREDOC','SECRET_MARKER'),
                  ('CHAR',';'),('T_START_HEREDOC',"<<<'SECRET_NOWDOC'"),
                  ('T_ENCAPSED_AND_WHITESPACE',CANARY),('T_END_HEREDOC','SECRET_NOWDOC'),('CHAR',';')]
        text = reader.redact_fixture_tokens(tokens)
        for private in (CANARY,'SECRET_MARKER','SECRET_NOWDOC','secret'):
            self.assertNotIn(private,text)
        self.assertEqual(text,"'REDACTED_L1';'REDACTED_L2';'REDACTED_L3';")
        with self.assertRaises(reader.Stop):
            reader.redact_fixture_tokens([('CHAR','"'),('T_ENCAPSED_AND_WHITESPACE',CANARY)])

    def test_constant_exceptions_closed_and_hook_classification_config_omitted(self):
        text = reader.redact_fixture_tokens([('T_STRING','WP_CLI'),('T_STRING','DB_PASSWORD'),
            ('T_CONSTANT_ENCAPSED_STRING',"'cli'"),('T_CONSTANT_ENCAPSED_STRING',"'"+CANARY+"'")])
        self.assertIn('WP_CLI',text);self.assertIn("'cli'",text)
        self.assertNotIn('DB_PASSWORD',text);self.assertNotIn(CANARY,text)
        tokens=[('T_STRING','add_action'),('CHAR','('),('T_CONSTANT_ENCAPSED_STRING',"'user_register'"),
                ('CHAR',','),('T_CONSTANT_ENCAPSED_STRING',"'"+CANARY+"'"),('CHAR',')')]
        self.assertEqual(reader.classify_hook_fixture(tokens,'mu.php'),[{'registration':'add_action','publicHook':'user_register'}])
        self.assertEqual(reader.classify_hook_fixture(tokens,'wp-config.php'),[])
        self.assertEqual(reader.classify_hook_fixture([('T_OBJECT_OPERATOR','->')]+tokens,'mu.php'),[])
        tokens[2]=('T_CONSTANT_ENCAPSED_STRING',"'"+CANARY+"'")
        self.assertEqual(reader.classify_hook_fixture(tokens,'mu.php'),[])
        # Actual installed local tokenizer, synthetic bytes only; no inspected WP source.
        tree=ast.parse(reader.prepare_program())
        php=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign)
                 and isinstance(n.targets[0],ast.Name) and n.targets[0].id=='PHP_LITERAL')
        sources=[]
        for role in reader.CONFIG_ROLES:
            for literal in reader.SAFE_CONSTANTS:
                for quote in ("'", '"'):
                    raw=("<?php if (WP_CLI) { define('DB_PASSWORD',"+quote+literal+quote+"); }").encode()
                    sources.append({'role':role,'source':base64.b64encode(raw).decode()})
                    text=reader.redact_fixture_tokens([('T_STRING','WP_CLI'),
                        ('T_CONSTANT_ENCAPSED_STRING',quote+literal+quote)],role)
                    self.assertIn('WP_CLI',text)
                    self.assertNotIn(quote+literal+quote,text)
        completed=subprocess.run(['/opt/homebrew/bin/php','-n'],
            input=php.replace('SOURCES_B64',base64.b64encode(json.dumps(sources).encode()).decode()).encode(),
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=6)
        self.assertEqual(completed.returncode,0,'LOCAL_SYNTHETIC_TOKENIZER_STOP')
        self.assertFalse(completed.stderr,'LOCAL_SYNTHETIC_TOKENIZER_STDERR')
        value=json.loads(completed.stdout)
        self.assertEqual(len(value['files']),len(sources))
        for entry in value['files']:
            rendered=entry['redactedSource']
            self.assertIn('WP_CLI',rendered)
            self.assertNotIn('DB_PASSWORD',rendered)
            self.assertEqual(entry['closedPublicRegistrations'],[])
            for literal in reader.SAFE_CONSTANTS:
                for quote in ("'", '"'):
                    self.assertNotIn(quote+literal+quote,rendered)

    def test_caps_symlinks_and_metadata_drift_stop(self):
        with tempfile.TemporaryDirectory() as directory:
            directory=str(Path(directory).resolve())
            p=Path(directory)/'plain';p.write_bytes(b'abc')
            self.assertEqual(reader.local_bytes(p,3),b'abc')
            with self.assertRaises(reader.Stop):reader.local_bytes(p,2)
            link=Path(directory)/'link';link.symlink_to(p)
            with self.assertRaises(reader.Stop):reader.local_bytes(link)
            with patch.object(reader,'HERE',Path(directory)):
                (Path(directory)/reader.SEED_FILE).write_bytes(b'{"canary":"'+CANARY.encode()+b'"}')
                with self.assertRaisesRegex(reader.Stop,'METADATA_DRIFT'):reader.metadata()
        with patch.object(reader,'REDACTED_CAP',3):
            with self.assertRaises(reader.Stop):reader.redact_fixture_tokens([('T_COMMENT',CANARY)])

    def test_closed_program_ast_and_no_active_source_include_eval(self):
        program=reader.prepare_program();tree=ast.parse(program)
        self.assertEqual(len(reader.metadata()['muEntrypoints']),61)
        self.assertEqual(len(reader.metadata()['seedFiles']),20)
        self.assertEqual(reader.TOKENIZER_ARGV,['/usr/bin/php8.2','-n','-d',
            'extension=/usr/lib/php/20220829/tokenizer.so'])
        self.assertIn('subprocess.Popen(TOKENIZER_FIXED_ARGV',program)
        self.assertEqual(program.count('\n tokenizer_check()\n'),2)
        self.assertIn('regular(Path(TOKENIZER_MODULE_PATH),TOKENIZER_MODULE_BYTES)',program)
        self.assertIn('len(raw)==TOKENIZER_MODULE_BYTES and hashlib.sha256(raw).hexdigest()==TOKENIZER_MODULE_SHA',program)
        self.assertNotIn('php.ini',program)
        for field in ('TOKENIZER_PATH','TOKENIZER_SHA','TOKENIZER_BYTES','TOKENIZER_METADATA_SHA'):
            with patch.object(reader,field,'DRIFT'):
                with self.assertRaises(reader.Stop):reader.prepare_program()
        # Exercise the exact embedded module gate with injected bytes, no module loading.
        gate=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='tokenizer_check')
        import hashlib
        raw=b'fixture-module'
        def check(v):
            if not v:raise reader.Stop('MODULE_DRIFT')
        ns={'regular':Mock(return_value=raw),'Path':Path,'TOKENIZER_MODULE_PATH':reader.TOKENIZER_PATH,
            'TOKENIZER_MODULE_BYTES':len(raw),'TOKENIZER_MODULE_SHA':hashlib.sha256(raw).hexdigest(),
            'hashlib':hashlib,'check':check}
        exec(compile(ast.Module(body=[gate],type_ignores=[]),'injected-module-gate','exec'),ns)
        ns['tokenizer_check']()
        ns['regular'].assert_called_once_with(Path(reader.TOKENIZER_PATH),len(raw))
        ns['regular'].return_value=b'drift'
        with self.assertRaises(reader.Stop):ns['tokenizer_check']()
        self.assertIn('signal.alarm(8)',program)
        self.assertIn('os.O_NOFOLLOW',program)
        self.assertNotIn('wp eval',program)
        self.assertNotIn('eval(',reader.PHP_READER)
        self.assertNotIn('require ',reader.PHP_READER)
        self.assertNotIn('include ',reader.PHP_READER)
        self.assertIn('token_get_all($raw)',reader.PHP_READER)
        self.assertIn('GLOBAL',json.dumps(reader.KEYWORDS).upper())
        self.assertNotIn(CANARY,program)
        self.assertTrue(tree.body)
        with patch.object(reader,'CAPTURE_SHA','0'*64):
            with self.assertRaisesRegex(reader.Stop,'CAPTURE_DRIFT'):reader.prepare_program()

    def test_private_capture_caps_cancellation_errors_never_raw(self):
        program=reader.prepare_program()
        for failure in (KeyboardInterrupt(),RuntimeError(CANARY)):
            capture=Mock(side_effect=failure)
            with self.assertRaisesRegex(reader.Stop,'PRIVATE_CAPTURE_STOP') as raised:
                reader.classify_fixture_capture(capture,program,SimpleNamespace(deadline=time.monotonic()+1))
            self.assertNotIn(CANARY,str(raised.exception))
        capture=Mock(return_value=b'x'*(reader.OUTPUT_CAP+1))
        with self.assertRaises(reader.Stop):reader.classify_fixture_capture(capture,program,SimpleNamespace(deadline=time.monotonic()+1))
        value={'schema':'ir.bootstrap.redacted_syntax.v1','classification':'STATIC_REDACTED_SYNTAX_NOT_SEMANTIC_APPROVAL',
            'homeWpCliConfigAbsent':True,'absentSeedRoles':[e['role'] for e in reader.metadata()['seedFiles'] if e['type']=='ABSENT'],
            'files':[{'role':role,'sourceSha256':'a'*64,'bytes':1,'redactedSource':'<?php ;',
                'regularRelativePhpIncludes':[],'dynamicIncludes':0,'closedPublicRegistrations':[]} for role in reader.expected_roles()]}
        capture=Mock(return_value=json.dumps(value).encode())
        self.assertEqual(reader.classify_fixture_capture(capture,program,SimpleNamespace(deadline=time.monotonic()+1))['schema'],'ir.bootstrap.redacted_syntax.v1')
        self.assertEqual(capture.call_args.kwargs['cap'],reader.OUTPUT_CAP)
        with self.assertRaises(reader.Stop):reader.classify_fixture_capture(Mock(),program,SimpleNamespace(deadline=time.monotonic()+11))
        with self.assertRaises(reader.Stop):reader.classify_fixture_capture(Mock(),'unknown program',SimpleNamespace(deadline=time.monotonic()+1))
        value['files'][0]['unexpectedPrivateToken']=CANARY
        with self.assertRaises(reader.Stop):reader.classify_fixture_capture(Mock(return_value=json.dumps(value).encode()),program,SimpleNamespace(deadline=time.monotonic()+1))

    def test_cli_dormant_and_execute_blocked_without_any_program_dispatch(self):
        for arguments, expected in ((['reader'],0),(['reader','--execute'],1)):
            with patch('sys.argv',arguments),patch.object(reader,'prepare_program') as prepare,contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(reader.main(),expected)
                prepare.assert_not_called()
                self.assertNotIn(CANARY,output.getvalue())


if __name__ == '__main__':
    unittest.main()
