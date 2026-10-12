#!/usr/bin/env python3
"""Synthetic loopback HTTP acceptance. Does not access any production URL."""
import urllib.request,urllib.error,http.cookiejar,json,re,uuid
BASE='http://127.0.0.1:8766';checks=0
class Client:
 def __init__(self):self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.nonce=''
 def call(self,path,body=None,headers=None):
  h={'X-WP-Nonce':self.nonce};h.update(headers or {})
  if isinstance(body,dict):body=json.dumps(body).encode();h['Content-Type']='application/json'
  try:r=self.opener.open(urllib.request.Request(BASE+path,data=body,headers=h));return r.status,r.read().decode()
  except urllib.error.HTTPError as e:return e.code,e.read().decode()
 def login(self,role):
  status,html=self.call('/login',('role='+role).encode(),{'Content-Type':'application/x-www-form-urlencoded'})
  if role=='admin':self.nonce=json.loads(re.search(r'<script id="arena-config" type="application/json">(.*?)</script>',html).group(1))['nonce']
def ok(value,name):
 global checks
 assert value,name;checks+=1;print('PASS',name)
def uid():return str(uuid.uuid4())
c=Client();ok(c.call('/api?op=groups')[0]==403,'Anonymous read denied');c.login('student');ok(c.call('/api?op=groups')[0]==403,'Student read denied');c.login('admin')
ok(c.call('/api?op=groups',headers={'X-WP-Nonce':'wrong'})[0]==403,'Invalid nonce denied')
ok(c.call('/api?op=groups')[0]==200,'Instructor roster access')
sid=uid();status,out=c.call('/api?op=create',{'id':sid,'class_id':'1','label':'HTTP synthetic test'});s=json.loads(out);ok(status==200 and len(s['students'])==3,'Session created with roster')
def apply(t,**data):
 global s
 body={'type':t,'request_id':uid(),'version':s['version'],**data};status,out=c.call('/api?op=command&id='+sid,body);assert status==200,(status,out);s=json.loads(out);return body
apply('attendance',student_id='101',present=True);apply('select',student_id='101');a=uid();apply('start',student_id='101',attempt_id=a,question='Synthetic fixture')
apply('finish',attempt_id=a,status='finalized',bytes=55,duration=3,finalize_ms=2,sha256='a'*64);apply('review',attempt_id=a,both_voices_and_video=True)
body={'type':'award','request_id':uid(),'version':s['version'],'attempt_id':a,'points':7}
ok(c.call('/api?op=command&id='+sid,body,{'X-Test-Fail-Save':'1'})[0]==503,'Simulated save fails honestly')
status,out=c.call('/api?op=state&id='+sid);ok(json.loads(out)['students']['101']['points']==0,'Failed save persisted no score')
status,out=c.call('/api?op=command&id='+sid,body);s=json.loads(out);ok(status==200 and s['students']['101']['points']==7,'Same request retry persists score')
version=s['version'];status,out=c.call('/api?op=command&id='+sid,body);ok(json.loads(out)['version']==version,'Duplicate retry not double-awarded')
status,out=c.call('/api?op=state&id='+sid);s=json.loads(out);ok(s['students']['101']['points']==7 and s['students']['102']['points']==0,'Reload preserves independent totals')
apply('attendance',student_id='102',present=True);apply('select',student_id='102');b=uid();apply('start',student_id='102',attempt_id=b);apply('finish',attempt_id=b,status='finalized',bytes=90,duration=4,finalize_ms=1,sha256='b'*64);apply('review',attempt_id=b,both_voices_and_video=True);apply('award',attempt_id=b,points=3)
ok(s['students']['101']['points']==7 and s['students']['102']['points']==3,'Second student scored independently')
apply('undo',award_id=body['request_id']);ok(s['students']['101']['points']==0 and s['students']['102']['points']==3,'Undo isolates correct student')
status,out=c.call('/api?op=create',{'id':uid(),'class_id':'2','label':'Other class'});ok(all(x['points']==0 for x in json.loads(out)['students'].values()),'Second class session clean isolation')
ok(c.call('/api?op=command&id='+sid,{'type':'select','request_id':uid(),'version':0,'student_id':'101'})[0]==409,'Concurrent stale write rejected')
ok(c.call('/api?op=create',{'id':'../../bad','class_id':'1','label':'Bad'})[0]==422,'Traversal denied')
apply('team',student_id='102',team='blue');apply('meeting',url='https://example.webex.com/meet/test')
status,out=c.call('/api?op=state&id='+sid);saved=json.loads(out)
ok(saved['students']['102']['team']=='blue' and saved['students']['102']['points']==3 and saved['meeting_url']=='https://example.webex.com/meet/test','Team and meeting survive readback without losing scores')
status,html=c.call('/')
ok('ivprepShell' in html and 'team-challenge-panel is-blue' in html and 'team-challenge-panel is-red' in html and 'playerShell' in html,'Source-derived classroom is served')
ok('daily-drills-team-challenge.js' not in html and 'daily-drills-live-webex-embed.js' not in html,'Original state and provider controllers are not loaded')
ok(c.call('/classroom-avatars/../../arena.js')[0]==404,'Avatar path allowlist rejects traversal')
print(f'{checks} HTTP checks passed. Synthetic recording metadata is not actual media proof.')
