#!/usr/bin/env python3
"""Disposable PostgreSQL two-connection regression; never accepts a remote host."""
import json,os,subprocess,sys,time,hashlib
sock=sys.argv[1]
assert sock.startswith('/tmp/mx5301p-pg.') and os.path.isdir(sock)
cmd=['psql','-h',sock,'-p','55439','-d','postgres','-Atq','-v','ON_ERROR_STOP=1']
def q(s):return "'"+s.replace("'","''")+"'"
def sql_run(sql):
 r=subprocess.run(cmd,input=sql,text=True,capture_output=True,timeout=15)
 if r.returncode:raise AssertionError(r.stderr[-3000:])
 return r.stdout.strip()
sess=[dict(cycle_key='2026-cycle-1',provider_meeting_id='5401-concurrency-meeting',provider_instance_id='5401-concurrency-instance',starts_at='2026-06-29T16:00:00Z',held_on='2026-06-29',step='s1',state='confirmed')]
rows=[dict(provider_instance_id='5401-concurrency-instance',provider_source_id='5401-concurrency-row',participant_source_id='5401-concurrency-person',display_name='Concurrent fixture',joined_at='2026-06-29T16:00:00Z',left_at='2026-06-29T17:00:00Z',duration_seconds=3600,payload_sha256='a'*64)]
def call(key):
 art=dict(source_path='zoom-api://5401-concurrency',sha256=hashlib.sha256(key.encode()).hexdigest(),byte_count=10,observed_at='2026-09-07T00:00:00Z')
 return "select missionaccounts.api_ingest_and_reconcile_zoom_batch("+','.join([q(key),"'2026-06-29'","'2026-06-30'",q(json.dumps(art))+'::jsonb',q(json.dumps(sess))+'::jsonb',q(json.dumps(rows))+'::jsonb'])+")->>'accepted';\n"
assert sql_run('set role service_role;'+call('5401-concurrency-seed'))=='true'
first=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
second=None
try:
 first.stdin.write("set role service_role; set application_name='5401-concurrency-first'; begin; set local statement_timeout='12s'; select pg_advisory_xact_lock(hashtextextended('missionaccounts:zoom-class:drills:2026-06-29:s1',0)); select 'LOCKED5401';\n");first.stdin.flush()
 while first.stdout.readline().strip()!='LOCKED5401':
  if first.poll() is not None:raise AssertionError(first.stderr.read())
 second=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 second.stdin.write("set role service_role; set application_name='5401-concurrency-second'; set statement_timeout='12s';"+call('5401-concurrency-second'));second.stdin.close()
 deadline=time.monotonic()+5
 while sql_run("select count(*) from pg_stat_activity where application_name='5401-concurrency-second' and wait_event='advisory'")!='1':
  if time.monotonic()>deadline:raise AssertionError('Second import never reached the class advisory lock')
  if second.poll() is not None:raise AssertionError(second.stderr.read())
  time.sleep(.05)
 first.stdin.write(call('5401-concurrency-first')+'commit;\n');first.stdin.close()
 first.wait(timeout=15);second.wait(timeout=15)
 assert first.returncode==0,first.stderr.read();assert second.returncode==0,second.stderr.read()
 assert 'true' in first.stdout.read();assert second.stdout.read().strip()=='true'
 controls=sql_run("select (select count(*) from missionaccounts.attendance_event e join missionaccounts.session s on s.id=e.session_id where s.provider_instance_id='5401-concurrency-instance')||'|'||(select count(*) from missionaccounts.attendance_source_row r join missionaccounts.session s on s.id=r.session_id where s.provider_instance_id='5401-concurrency-instance')||'|'||(select count(*) from missionaccounts.zoom_source_corroboration c join missionaccounts.attendance_source_row r on r.id=c.source_row_id join missionaccounts.session s on s.id=r.session_id where s.provider_instance_id='5401-concurrency-instance' and c.disposition='exact_occurrence')")
 assert controls=='1|3|2',controls
 print('PASS: two concurrent reimports preserve one event, three raw observations, two corroborations without deadlock')
finally:
 for proc in [first,second]:
  if proc is not None and proc.poll() is None:proc.kill();proc.wait()

# A dependent domain insert must observe retirement after waiting on its student.
tag=f'5401-retirement-{os.getpid()}-{time.time_ns()}'
student=sql_run("set role service_role;insert into missionaccounts.student(display_name,source_name,identity_state) values ('Retirement race fixture','Retirement race fixture','needs_review') returning id;")
retirer_name,writer_name=tag+'-retirer',tag+'-writer'
retirer=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
writer=None
try:
 retirer.stdin.write("set role service_role;set application_name="+q(retirer_name)+";begin;set local statement_timeout='12s';select 1 from missionaccounts.student where id="+q(student)+"::uuid for update;select 'RETIREMENT_LOCKED';\n");retirer.stdin.flush()
 while retirer.stdout.readline().strip()!='RETIREMENT_LOCKED':
  if retirer.poll() is not None:raise AssertionError(retirer.stderr.read())
 writer=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 writer.stdin.write("set role service_role;set application_name="+q(writer_name)+";set statement_timeout='12s';do $race$ begin insert into missionaccounts.full_cycle_ceiling(student_id,cycle_key,status,basis,request_id) values ("+q(student)+"::uuid,'2026-cycle-1','candidate','{\"fixture\":true}'::jsonb,"+q(tag+'-domain')+");raise exception 'Domain insert passed after retirement';exception when check_violation then if SQLERRM<>'student_is_retired_technical_projection' then raise;end if;end $race$;select 'RETIRED_WRITE_REJECTED';\n");writer.stdin.close()
 blocked_query="select count(*) from pg_stat_activity waiting join pg_stat_activity holding on holding.pid=any(pg_blocking_pids(waiting.pid)) where waiting.application_name="+q(writer_name)+" and holding.application_name="+q(retirer_name)+" and waiting.wait_event_type='Lock';"
 deadline=time.monotonic()+5
 while sql_run(blocked_query)!='1':
  if writer.poll() is not None:raise AssertionError('Writer finished before retirement lock release: '+writer.stderr.read())
  if time.monotonic()>deadline:raise AssertionError('Domain writer never blocked on retirement')
  time.sleep(.05)
 retirer.stdin.write("insert into missionaccounts.zoom_shadow_retirement(student_id,reason,evidence,request_id) values ("+q(student)+"::uuid,'duplicate_canonicalization_artifact','{\"fixture\":true}'::jsonb,"+q(tag+'-retirement')+");commit;\n");retirer.stdin.close()
 retirer.wait(timeout=15);writer.wait(timeout=15)
 assert retirer.returncode==0,retirer.stderr.read();assert writer.returncode==0,writer.stderr.read()
 assert writer.stdout.read().strip()=='RETIRED_WRITE_REJECTED'
 controls=sql_run("select (select count(*) from missionaccounts.zoom_shadow_retirement where student_id="+q(student)+"::uuid and superseded_by_id is null and reversed_at is null)||'|'||(select count(*) from missionaccounts.full_cycle_ceiling where request_id="+q(tag+'-domain')+");")
 assert controls=='1|0',controls
 print('PASS: concurrent domain insert waits, then rejects retired student')
finally:
 for proc in [retirer,writer]:
  if proc is not None and proc.poll() is None:proc.kill();proc.wait()
