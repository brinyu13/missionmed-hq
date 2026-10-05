"""Synthetic PHP tokenizer/parser fixtures only; no installed-source or SSH reads."""
import base64
import hashlib
import json
import shutil
import subprocess
import sys
import time
import unittest
from unittest.mock import patch
import reskin_hook_facts_reader as r

SECRET='PRIVATE_SENTINEL_DO_NOT_EXPORT_92'

def fixture(callback="[self::class, 'present']", hook="'wp_head'", prefix='', extra=''):
    calls='\n'.join("add_action(%s, %s%s);"%(hook,callback,', 20, 1' if i==0 else '') for i in range(6))
    return ('<?php class MMED_LearnDash_Reskin {public static function init(){'+prefix+calls+'} public static function present(){'+"$x='"+SECRET+"'; add_filter('private_other_method', 'secret_cb');"+'} private static function hidden(){}'+extra+'}').encode()

def parse(source, *, sha=None):
    payload={'source':base64.b64encode(source).decode(),'sha':sha or hashlib.sha256(source).hexdigest(),'bytes':len(source),'hooks':r.PUBLIC_HOOKS}
    program=r.PHP_PARSER.replace('INPUT_B64',base64.b64encode(json.dumps(payload).encode()).decode()).encode()
    result=subprocess.run([shutil.which('php'),'-n'],input=program,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
    if result.returncode or result.stderr:
        raise AssertionError('LOCAL_FIXTURE_TOKENIZER_STOP')
    if len(result.stdout)>r.OUTPUT_CAP:
        raise AssertionError('LOCAL_FIXTURE_CAP_STOP')
    return result.stdout

class ParserTests(unittest.TestCase):
    def test_six_ordered_public_array_callbacks(self):
        raw=parse(fixture());v=json.loads(raw)
        self.assertEqual(len(v['registrations']),6)
        self.assertEqual(v['registrations'][0]['priority'],20)
        self.assertFalse(v['registrations'][0]['priorityDefault'])
        self.assertTrue(v['registrations'][1]['priorityDefault'])
        self.assertTrue(all(x['callbackMethod']=='present' for x in v['registrations']))
        self.assertNotIn(SECRET.encode(),raw)
        self.assertNotIn(b'private_other_method',raw)

    def test_array_constructor_and_class_constant(self):
        for cb in ("array(self::class, 'present')","[__CLASS__, 'present']","array(__CLASS__, 'present')","[MMED_LearnDash_Reskin::class, 'present']","[static::class, 'present']"):
            with self.subTest(callback=cb):
                self.assertTrue(json.loads(parse(fixture(callback=cb)))['registrations'][0]['callbackResolved'])

    def test_filters_and_double_quote_literals(self):
        raw=parse(fixture().replace(b'add_action',b'add_filter').replace(b"'wp_head'",b'"wp_footer"'))
        self.assertTrue(all(x['kind']=='add_filter' and x['hook']=='wp_footer' for x in json.loads(raw)['registrations']))

    def test_unknown_hook_hash_only(self):
        raw=parse(fixture(hook="'"+SECRET+"'"));v=json.loads(raw)
        self.assertNotIn(SECRET.encode(),raw)
        self.assertTrue(all(x['hook']=='UNKNOWN_HOOK' and len(x['hookLiteralSha256'])==64 for x in v['registrations']))

    def test_private_missing_external_string_callbacks_unresolved(self):
        for cb in ("[self::class, 'hidden']","[self::class, 'missing']","[OtherClass::class, 'present']","'"+SECRET+"'","[$this, 'present']"):
            with self.subTest(callback=cb):
                raw=parse(fixture(callback=cb));v=json.loads(raw)
                self.assertNotIn(SECRET.encode(),raw)
                self.assertTrue(all(not x['callbackResolved'] and x['callbackMethod'] is None and x['callbackClass'] is None for x in v['registrations']))

    def test_hash_drift_closed_stop(self):
        self.assertEqual(json.loads(parse(fixture(),sha='0'*64)),{'classification':'RESKIN_FACTS_STOP'})

    def test_nested_init_and_non_registration_closed_stop(self):
        for src in (fixture(prefix='if(true){').replace(b'} public static function present',b'}} public static function present'),fixture(prefix="$secret='"+SECRET+"';"),fixture().replace(b'add_action(',b'other_call(',1)):
            self.assertEqual(json.loads(parse(src)),{'classification':'RESKIN_FACTS_STOP'})

    def test_count_visibility_static_and_duplicate_stops(self):
        for src in (fixture().replace(b'public static function init',b'private static function init'),fixture().replace(b'public static function init',b'public function init'),fixture().replace(b"add_action('wp_head', [self::class, 'present']);",b'',1),fixture(extra='public static function present(){}')):
            self.assertEqual(json.loads(parse(src)),{'classification':'RESKIN_FACTS_STOP'})

    def test_callback_body_opaque_even_nested(self):
        src=fixture().replace(b"$x='",b"if(true){$x='").replace(b"'secret_cb');",b"'secret_cb');}")
        raw=parse(src)
        self.assertEqual(len(json.loads(raw)['registrations']),6)
        self.assertNotIn(SECRET.encode(),raw)

    def test_dynamic_hook_and_priority_stop(self):
        for src in (fixture(hook='$private'),fixture().replace(b', 20, 1',b', $priority, 1')):
            self.assertEqual(json.loads(parse(src)),{'classification':'RESKIN_FACTS_STOP'})

    def test_closed_capture_validation(self):
        src=fixture();raw=parse(src)
        with patch.object(r,'SOURCE_SHA',hashlib.sha256(src).hexdigest()),patch.object(r,'SOURCE_BYTES',len(src)):
            self.assertEqual(len(r.validate_capture(raw)['registrations']),6)
            v=json.loads(raw);v['private']=SECRET
            with self.assertRaises(r.Stop):r.validate_capture(json.dumps(v).encode())
            v=json.loads(raw);v['registrations'][0]['callbackMethod']=SECRET+'!'
            with self.assertRaises(r.Stop):r.validate_capture(json.dumps(v).encode())
        with self.assertRaises(r.Stop):r.validate_capture(raw)
        with self.assertRaises(r.Stop):r.validate_capture(b'x'*(r.OUTPUT_CAP+1))

    def test_preparation_dormant_deterministic_and_pins(self):
        with patch.object(subprocess,'Popen',side_effect=AssertionError('EXECUTION_FORBIDDEN')):
            program=r.prepare_program()
            self.assertEqual(program,r.prepare_program())
            compile(program,'<dormant>','exec')
        self.assertNotIn(b'WP_CLI',program)
        self.assertNotIn(b'wp-load',program)
        with patch.object(r,'PINS',{'reskin_hook_facts_reader.py':'0'*64}):
            with self.assertRaises(r.Stop):r.prepare_program()

    def test_dormant_adapter_and_bounded_synthetic_stderr(self):
        with patch.object(subprocess,'Popen',side_effect=AssertionError('EXECUTION_FORBIDDEN')):
            capture,dispatch=r.prepare_capture_adapter()
            with self.assertRaises(r.Stop):r.capture_prepared(b'unadmitted')
        argv=(sys.executable,'-c','import sys;sys.stderr.write("x"*4097)')
        with self.assertRaises(r.Stop):capture(argv,b'',dispatch(time.monotonic()+2),cap=r.OUTPUT_CAP)
        argv=(sys.executable,'-c','import sys;sys.stdout.write("x"*16385)')
        with self.assertRaises(r.Stop):capture(argv,b'',dispatch(time.monotonic()+2),cap=r.OUTPUT_CAP)

if __name__=='__main__':unittest.main()
