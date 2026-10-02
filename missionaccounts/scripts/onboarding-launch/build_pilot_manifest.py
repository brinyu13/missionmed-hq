#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,hashlib,json,os,re
from pathlib import Path
COHORT=("Raghav Gupta","Subani Dias","Neshmaidy Negrón Zeda")
READY={
 "Raghav Gupta":{"wp_user_id":114,"student_id":"5171c2ec-5046-59e0-a22a-7362404bf9ec","eligibility_basis":"learndash_course_6357"},
 "Subani Dias":{"wp_user_id":9,"student_id":"142b08bb-9643-550c-acac-29a8030c7e02","eligibility_basis":"learndash_course_6357"},
 "Neshmaidy Negrón Zeda":{"wp_user_id":89,"student_id":"c6843e4d-f163-5f57-b1bd-61d566700444","eligibility_basis":"drj_drills_student_role"},
}
SHA=re.compile(r"^[0-9a-f]{40}$"); VERSION="examprep-onboarding-email-2026-09-17-v3r1"; SUBJECT="Your MyMissionMed Account is ready"; CTA="https://missionmedinstitute.com/missionaccounts/#/me/onboarding"
def fsha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def truth(v):return str(v).strip().lower() in {"1","true","yes"}
def build(rows,html,text,authority_commit,authorize_send):
 by={str(r.get('display_name','')).strip():r for r in rows}
 if tuple(by)!=COHORT or len(rows)!=3:raise ValueError('pilot_cohort_must_match_exact_three_in_order')
 if authorize_send and(not authority_commit or not SHA.fullmatch(authority_commit)):raise ValueError('exact_send_authority_commit_required')
 items=[]
 for name in COHORT:
  r=by[name]; e=READY[name]; email=str(r.get('email','')).strip().lower(); username=str(r.get('username','')).strip()
  if(str(r.get('pilot_status','')).strip().upper()!='READY' or int(str(r.get('wp_user_id','0')))!=e['wp_user_id'] or not username or str(r.get('student_id','')).strip().lower()!=e['student_id'] or str(r.get('eligibility_basis','')).strip()!=e['eligibility_basis'] or '@' not in email or str(r.get('sponsor_type','')).strip().upper()!='DIRECT' or not truth(r.get('onboarding_eligible','')) or str(r.get('prior_send_state','')).strip().lower() not in {'','not_sent'}):raise ValueError(f'pilot_recipient_not_exactly_bound:{name}')
  items.append({'display_name':name,'pilot_status':'READY',**e,'username_sha256':hashlib.sha256(username.encode()).hexdigest(),'email_sha256':hashlib.sha256(email.encode()).hexdigest()})
 return {'schema_version':'missionaccounts-onboarding-pilot-send-v1','template_version':VERSION,'template_html_sha256':fsha(html),'template_text_sha256':fsha(text),'subject':SUBJECT,'sender':'Dr J via MissionMed','credential_method':'existing-account-or-secure-password-recovery','cta_url':CTA,'completion_window_hours':48,'authority_commit':authority_commit,'external_send_authorized':authorize_send,'provider':'wordpress_wp_mail','items':items}
def main():
 p=argparse.ArgumentParser();p.add_argument('--cohort-csv',type=Path,required=True);p.add_argument('--html',type=Path,required=True);p.add_argument('--text',type=Path,required=True);p.add_argument('--authority-commit');p.add_argument('--authorize-send',action='store_true');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 with a.cohort_csv.open(newline='',encoding='utf-8') as h:rows=list(csv.DictReader(h))
 payload=build(rows,a.html,a.text,a.authority_commit,a.authorize_send);raw=(json.dumps(payload,sort_keys=True,separators=(',',':'),ensure_ascii=True)+'\n').encode();fd=os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb') as h:h.write(raw)
 print(json.dumps({'built':True,'pilot_count':len(payload['items']),'ready_count':len(payload['items']),'held_count':0,'external_send_authorized':payload['external_send_authorized'],'manifest_sha256':hashlib.sha256(raw).hexdigest()},sort_keys=True))
if __name__=='__main__':main()
