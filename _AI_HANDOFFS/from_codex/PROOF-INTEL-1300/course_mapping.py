"""Projection of explicit Founder confirmation only; no default enrollment claims."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
COMPLETE='https://missionmedinstitute.com/product/match-prep-pro/'
PROGRAMS='https://missionmedinstitute.com/missionresidency/#enroll'
def apply_courses(data):
 path=ROOT/'private-classification/state.json'
 if not path.exists():return data
 state=json.loads(path.read_text())
 if not state.get('confirmed'):return data
 roster=json.loads((ROOT/'private-classification/roster.json').read_text())
 if state.get('version')!=roster['version']:return data
 aliases=json.loads((ROOT/'ingestion/roster.json').read_text())
 provenance=json.loads((ROOT/'ingestion/provenance.json').read_text())
 normal=lambda s:' '.join(s.casefold().split())
 source_by_name={normal(p['name']):p['id'] for p in roster['students']}
 confirmed={}
 for p in aliases['students']:
  ids={source_by_name[normal(a)] for a in set(p['aliases']+[p['name']]) if normal(a) in source_by_name}
  choices={state.get('courses',{}).get(i) for i in ids}
  if ids and len(choices)==1 and None not in choices:confirmed[p['personId']]=choices.pop()
 for s in data['stories']:
  pid=provenance.get('records',{}).get(s['id'],{}).get('personId')
  course=confirmed.get(pid)
  if course in ('360','IV Prep Complete'):
   s['course']=course;s['courseUrl']=COMPLETE if course=='IV Prep Complete' else PROGRAMS
 return data
