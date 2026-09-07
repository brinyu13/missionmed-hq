import assert from 'node:assert/strict';
import test from 'node:test';
import {TIMELINE_ADMIN_METRICS_022,normalizeTimelineAdminRoster,timelineAdminStudentPresentation,renderTimelineAdminWorkspace,mountTimelineAdminWorkspace} from '../web/js/production/admin-workspace-022.js';

const student=(id=22,patch={})=>({wpUserId:id,displayName:`Synthetic Student ${id}`,email:`synthetic-${id}@example.invalid`,program:'MissionMed 360',sessions:['Synthetic Session'],eligible:true,documentId:`unit-doc-${id}`,status:'DRAFT',cvStatus:'IMPORTED',eventCount:6,lastActivity:'2026-09-07T01:00:00Z',guardianStatus:'NOT_CHECKED',guardianIssueCount:null,exportReadiness:'NOT_CHECKED',lastExport:null,canOpen:true,filters:{draft:true,cv_imported:true},...patch});
const payload=(patch={})=>({source:'learndash-course-3893',verifiedAt:'2026-09-07T02:00:00Z',metrics:Object.fromEntries(TIMELINE_ADMIN_METRICS_022.map(item=>[item.id,item.id==='eligible'?80:4])),students:[student()],sessions:['Synthetic Session'],total:1,page:1,pageSize:25,...patch});
const model=(patch={})=>({query:'',filter:'all',session:'',page:1,phase:'ready',roster:normalizeTimelineAdminRoster(payload()),error:null,opening:null,...patch});

class Host{
 constructor(){this.innerHTML='';this.listeners=new Map();this.fields={};}
 addEventListener(name,handler){this.listeners.set(name,handler);}
 removeEventListener(name,handler){if(this.listeners.get(name)===handler)this.listeners.delete(name);}
 querySelector(selector){return this.fields[selector]||null;}
 contains(){return true;}
 async click(attributes){const button={disabled:false,hasAttribute:name=>Object.hasOwn(attributes,name),getAttribute:name=>attributes[name]};await this.listeners.get('click')?.({target:{closest:()=>button}});}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('022 admin roster accepts only current server enrollment identity and complete pages',()=>{
 const valid=normalizeTimelineAdminRoster(payload());assert.equal(valid.metrics.eligible,80);assert.equal(valid.students.length,1);assert.equal(valid.total,1);assert.equal(valid.source,'learndash-course-3893');
 const bad=[payload({source:'local-fixture'}),payload({verifiedAt:'unknown'}),payload({students:[student(22,{eligible:false})]}),payload({students:[student(),student()],total:2}),payload({students:[student()],total:2}),payload({total:81}),payload({page:2}),payload({metrics:{eligible:80}})];
 for(const candidate of bad)assert.throws(()=>normalizeTimelineAdminRoster(candidate),/could not be verified/);
});

test('022 admin metrics use global server counts and never manufacture zero while loading',()=>{
 const html=renderTimelineAdminWorkspace(model());
 for(const metric of TIMELINE_ADMIN_METRICS_022)assert.ok(html.includes(`data-admin022-metric="${metric.id}"`));
 assert.match(html,/Eligible 360 students<\/span><strong>80<\/strong>/);
 const loading=renderTimelineAdminWorkspace(model({phase:'loading',roster:null}));assert.match(loading,/Checking eligible students and Timeline progress/);assert.match(loading,/<strong>—<\/strong>/);assert.doesNotMatch(loading,/Synthetic Student|<strong>0<\/strong>/);
});

test('022 admin never maps unchecked Guardian state to readiness or invents available fields',()=>{
 const item=timelineAdminStudentPresentation(student(22,{guardianStatus:'NOT_CHECKED',eventCount:undefined,cvStatus:undefined,lastExport:null}));
 assert.equal(item.guardian,'Not checked');assert.equal(item.readiness,'Not checked');assert.equal(item.eventCount,null);assert.equal(item.source,'Unavailable');
 const never=timelineAdminStudentPresentation(student(23,{status:'NEVER_STARTED',canOpen:false,documentId:null}));assert.equal(never.canOpen,false);assert.equal(never.openReason,'No Timeline yet');
 assert.equal(timelineAdminStudentPresentation(student(24,{status:'ACCESS_RESTRICTED',canOpen:true})).canOpen,false);
});

test('022 admin renders clear student identity, all status fields, and escaped server content',()=>{
 const roster=normalizeTimelineAdminRoster(payload({students:[student(22,{displayName:'<Synthetic Reviewer>',email:'<reviewer>@example.invalid',sessions:['<Session>']})]}));
 const html=renderTimelineAdminWorkspace(model({roster,query:'"<script>bad</script>'}));
 for(const name of ['Timeline','CV / source','Events','Guardian','Export','Last active','Last export:','360 eligible'])assert.ok(html.includes(name));
 assert.match(html,/&lt;Synthetic Reviewer&gt;/);assert.match(html,/&lt;reviewer&gt;@example.invalid/);assert.match(html,/&lt;Session&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/Open Timeline for &lt;Synthetic Reviewer&gt;/);
});

test('022 admin filtered empty and no-population states remain explicit and distinct',()=>{
 const roster=normalizeTimelineAdminRoster(payload({students:[],total:0}));
 assert.match(renderTimelineAdminWorkspace(model({roster,query:'nobody'})),/No students match this view/);
 assert.match(renderTimelineAdminWorkspace(model({roster})),/No eligible students are listed/);
});

test('022 roster starts one server read, preserves server totals, and requests the next page',async()=>{
 const calls=[],host=new Host();let opened=0;
 const rows=Array.from({length:25},(_,index)=>student(index+1));
 const controller=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:async options=>{calls.push(options);return payload({students:rows.map(row=>({...row,wpUserId:row.wpUserId+(options.page-1)*25})),total:51,page:options.page});},openAdminStudent:()=>{opened++;}}});
 await controller.ready;assert.equal(calls.length,1);assert.match(host.innerHTML,/1–25 of 51/);
 await host.click({'data-admin022-page':'2'});assert.deepEqual(calls[1],{query:'',filter:'all',session:'',page:2});assert.match(host.innerHTML,/26–50 of 51/);assert.equal(opened,0);controller.destroy();
});

test('022 each metric drills to the exact server filter and clears prior search/session',async()=>{
 const host=new Host(),calls=[];
 const controller=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:async options=>{calls.push(options);return payload();}}});await controller.ready;
 await controller.refresh({query:'old search',filter:'draft',session:'old session',page:1});
 await host.click({'data-admin022-metric':'guardian_issues'});assert.deepEqual(calls.at(-1),{query:'',filter:'guardian_issues',session:'',page:1});
 await host.click({'data-admin022-metric':'eligible'});assert.equal(calls.at(-1).filter,'all');controller.destroy();
});

test('022 server response ordering cannot replace a newer roster with stale students',async()=>{
 const requests=[],host=new Host();const controller=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:options=>{const request=deferred();requests.push({...request,options});return request.promise;}}});
 const newer=controller.refresh({query:'new selection'});requests[1].resolve(payload({students:[student(25,{displayName:'Latest Synthetic Student'})]}));await newer;
 requests[0].resolve(payload({students:[student(24,{displayName:'Stale Synthetic Student'})]}));await controller.ready;
 assert.match(host.innerHTML,/Latest Synthetic Student/);assert.doesNotMatch(host.innerHTML,/Stale Synthetic Student/);controller.destroy();
});

test('022 roster errors clear prior student records and show an actionable sanitized state',async()=>{
 let fail=false;const host=new Host(),errors=[];const controller=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:async()=>{if(fail)throw Object.assign(new Error('private backend detail'),{status:403});return payload();}},onError:error=>errors.push(error.message)});await controller.ready;assert.match(host.innerHTML,/Synthetic Student 22/);
 fail=true;await controller.refresh();assert.doesNotMatch(host.innerHTML,/Synthetic Student 22|private backend detail/);assert.match(host.innerHTML,/Administrator access could not be confirmed/);assert.match(host.innerHTML,/Try again/);assert.equal(errors.length,1);controller.destroy();
});

test('022 OPEN hands the actual available roster student to root without requesting a grant',async()=>{
 const host=new Host(),rows=[],apiOpens=[];const controller=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:async()=>payload({students:[student(22),student(23,{status:'NEVER_STARTED',canOpen:false,documentId:null})],total:2}),openAdminStudent:id=>apiOpens.push(id)},onOpenStudent:row=>rows.push(row)});await controller.ready;
 await host.click({'data-admin022-open':'9999'});await host.click({'data-admin022-open':'23'});assert.equal(rows.length,0);
 await host.click({'data-admin022-open':'22'});assert.equal(rows.length,1);assert.equal(rows[0].wpUserId,22);assert.equal(rows[0].displayName,'Synthetic Student 22');assert.deepEqual(apiOpens,[]);controller.destroy();
});

test('022 admin destroy removes listeners and ignores late private-data responses',async()=>{
 const request=deferred(),host=new Host();const controller=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:()=>request.promise}});controller.destroy();request.resolve(payload());await controller.ready;assert.equal(host.innerHTML,'');assert.equal(host.listeners.size,0);assert.equal(await controller.refresh(),null);
});

test('022 a search typed while a refresh is pending survives the response render',async()=>{
 const request=deferred(),host=new Host();const controller=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:()=>request.promise}});
 host.listeners.get('input')({target:{matches:()=>true,value:'newly typed search'}});request.resolve(payload());await controller.ready;assert.match(host.innerHTML,/value="newly typed search"/);controller.destroy();
});
