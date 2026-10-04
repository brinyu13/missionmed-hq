"""Synthetic-only privacy and spend-boundary tests. No provider/photo/credential use."""
import unittest,base64,io
from PIL import Image
from tryon_adapter import FashnAdapter,TryOnError,sanitize_image

def fixture():
    b=io.BytesIO();Image.new('RGB',(20,30),'navy').save(b,'PNG')
    return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
class AdapterTests(unittest.TestCase):
    def test_unprovisioned_has_no_transport(self):
        with self.assertRaises(TryOnError):FashnAdapter(credential='synthetic-only',transport=lambda *a:self.fail('No request'),approved_gateway=False)
    def test_external_urls_and_malformed_are_rejected(self):
        for value in ['https://example.com/private.jpg','data:image/png;base64,dGVzdA==','data:text/html;base64,abcd']:
            with self.assertRaises(TryOnError):sanitize_image(value)
    def test_requires_destination_and_spend_consent(self):
        adapter=FashnAdapter(credential='synthetic-only',transport=lambda *a:self.fail('No request'),approved_gateway=True)
        with self.assertRaises(TryOnError):adapter.visualize(fixture(),fixture())
    def test_success_is_single_credit_base64_and_metadata_free(self):
        calls=[]
        def transport(method,url,headers,body):
            calls.append((method,url,body.copy() if body else None))
            return {'id':'test-id'} if method=='POST' else {'status':'completed','output':[fixture()]}
        result=FashnAdapter(credential='synthetic-only',transport=transport,approved_gateway=True).visualize(fixture(),fixture(),consent=True,cost_acknowledged=True)
        self.assertEqual(len(calls),2);self.assertEqual(result['credits'],1);self.assertFalse(result['fitPrediction'])
        inputs=calls[0][2]['inputs'];self.assertTrue(inputs['return_base64']);self.assertEqual(inputs['num_samples'],1);self.assertEqual(inputs['moderation_level'],'conservative')
        self.assertTrue(result['image'].startswith('data:image/jpeg;base64,'))
    def test_unknown_post_failure_never_retries_or_leaks(self):
        calls=[]
        def transport(*args):calls.append(1);raise RuntimeError('sensitive body or token must not be returned')
        with self.assertRaisesRegex(TryOnError,'No automatic paid retry'):
            FashnAdapter(credential='synthetic-only',transport=transport,approved_gateway=True).visualize(fixture(),fixture(),consent=True,cost_acknowledged=True)
        self.assertEqual(len(calls),1)
    def test_polling_bounded_without_paid_retry(self):
        calls=[]
        def transport(method,*args):calls.append(method);return {'id':'test-id'} if method=='POST' else {'status':'processing'}
        with self.assertRaisesRegex(TryOnError,'timed out'):
            FashnAdapter(credential='synthetic-only',transport=transport,approved_gateway=True,sleeper=lambda _:None).visualize(fixture(),fixture(),consent=True,cost_acknowledged=True)
        self.assertEqual(calls.count('POST'),1);self.assertEqual(calls.count('GET'),30)
    def test_remote_output_is_rejected(self):
        def transport(method,*args):return {'id':'test-id'} if method=='POST' else {'status':'completed','output':['https://example.com/private.jpg']}
        with self.assertRaises(TryOnError):FashnAdapter(credential='synthetic-only',transport=transport,approved_gateway=True).visualize(fixture(),fixture(),consent=True,cost_acknowledged=True)
if __name__=='__main__':unittest.main()
