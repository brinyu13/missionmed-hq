/**
 * MissionMed Matrix Calendar v4 Prototype Runtime
 * Mounts MATRIX_CALENDAR_PROTOTYPE_v4.html inside the Matrix Calendar route and wires it to MMED_OS REST data.
 */
(function () {
'use strict';

const CALENDAR_PROTOTYPE_HTML = "<canvas class=\"bg-canvas\" id=\"bgCanvas\"></canvas>\n\n<div class=\"cal-app\" id=\"app\">\n  <!-- LEFT PANEL -->\n  <div class=\"left-panel\" id=\"leftPanel\">\n    <button class=\"panel-collapse-btn\" id=\"panelCollapseBtn\" title=\"Collapse\">&#9664;</button>\n\n    <!-- Collapsed tabs -->\n    <div class=\"panel-tabs-collapsed\">\n      <div class=\"ptab\" data-section=\"categories\">\n        <div class=\"ptab-icon\">&#127912;</div>\n        <div class=\"ptab-tooltip\">Categories</div>\n      </div>\n      <div class=\"ptab\" data-section=\"todos\">\n        <div class=\"ptab-icon\">&#9745;</div>\n        <div class=\"ptab-tooltip\">To-Do List</div>\n        <div class=\"ptab-badge\" id=\"todoBadgeCollapsed\">0</div>\n      </div>\n      <div class=\"ptab\" data-section=\"notifs\">\n        <div class=\"ptab-icon\">&#128276;</div>\n        <div class=\"ptab-tooltip\">Notifications</div>\n        <div class=\"ptab-badge\" id=\"notifBadgeCollapsed\">0</div>\n      </div>\n    </div>\n\n    <!-- Expanded content -->\n    <div class=\"panel-content-expanded\" id=\"panelContent\">\n      <div class=\"panel-section\" id=\"catSection\">\n        <div class=\"panel-section-title\">Categories</div>\n        <div id=\"filterList\"></div>\n        <button class=\"add-cat-btn\" onclick=\"showAddCategoryModal()\">+ Add Category</button>\n      </div>\n      <div class=\"panel-section todo-section\" id=\"todoSection\">\n        <div class=\"panel-section-title\">\n          To-Do List <span class=\"badge-count\" id=\"todoCount\">0</span>\n        </div>\n        <div class=\"todo-list\" id=\"todoList\"></div>\n        <div class=\"todo-add-row\">\n          <input class=\"todo-add-input\" id=\"todoInput\" placeholder=\"Add a task...\" onkeydown=\"if(event.key==='Enter')addTodo()\">\n          <button class=\"todo-add-btn\" onclick=\"addTodo()\">+</button>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <!-- MAIN -->\n  <div class=\"main-area\">\n    <div class=\"cal-header\">\n      <div class=\"cal-title-row\">\n        <div class=\"cal-logo\">M</div>\n        <div class=\"cal-title\">MATRIX <span>Calendar</span></div>\n      </div>\n      <div class=\"cal-nav\">\n        <button class=\"cal-nav-btn active\" data-view=\"month\">Month</button>\n        <button class=\"cal-nav-btn\" data-view=\"week\">Week</button>\n        <button class=\"cal-nav-btn\" data-view=\"day\">Day</button>\n        <button class=\"cal-nav-btn\" data-view=\"agenda\">Agenda</button>\n      </div>\n    </div>\n    <div class=\"cal-tracker\" id=\"trackerModule\">\n      <div class=\"cal-tracker-title\">Match Cycle <span class=\"gold\">Tracker</span> &mdash; 2026-2027</div>\n      <div class=\"cal-tracker-bar\" id=\"trackerBar\"></div>\n      <div class=\"cal-tracker-labels\" id=\"trackerLabels\"></div>\n      <div class=\"cal-tracker-countdown\" id=\"trackerCountdown\"></div>\n    </div>\n    <div class=\"cal-toolbar\">\n      <div class=\"cal-toolbar-left\">\n        <button class=\"cal-arrow-btn\" id=\"prevBtn\">&larr;</button>\n        <button class=\"cal-today-btn\" id=\"todayBtn\">Today</button>\n        <button class=\"cal-arrow-btn\" id=\"nextBtn\">&rarr;</button>\n        <div class=\"cal-month-label\" id=\"monthLabel\"></div>\n      </div>\n      <div class=\"cal-toolbar-right\">\n        <button class=\"cal-icon-btn\" id=\"syncBtn\">&#128279; Sync</button>\n        <button class=\"cal-icon-btn\" id=\"adminToggle\">&#9881; Admin</button>\n        <button class=\"cal-add-btn\" id=\"addBtn\">+ New</button>\n      </div>\n    </div>\n    <div class=\"cal-admin-panel\" id=\"adminPanel\"></div>\n    <div class=\"cal-views\">\n      <div id=\"viewMonth\"></div>\n      <div id=\"viewWeek\" style=\"display:none\"></div>\n      <div id=\"viewDay\" style=\"display:none\"></div>\n      <div id=\"viewAgenda\" style=\"display:none\"></div>\n    </div>\n  </div>\n</div>\n\n<div class=\"cal-modal-overlay\" id=\"eventModal\"><div class=\"cal-modal\"><button class=\"cal-modal-close\" id=\"modalClose\">&times;</button><h3 id=\"modalTitle\">New Event</h3><div id=\"modalBody\"></div></div></div>\n<div class=\"cal-modal-overlay\" id=\"syncModal\"><div class=\"cal-modal\"><button class=\"cal-modal-close\" id=\"syncClose\">&times;</button><h3>Sync Calendar</h3><div id=\"syncBody\"></div></div></div>\n<div class=\"cal-modal-overlay\" id=\"todoModal\"><div class=\"cal-modal\"><button class=\"cal-modal-close\" id=\"todoModalClose\">&times;</button><h3 id=\"todoModalTitle\">Task Details</h3><div id=\"todoModalBody\"></div></div></div>\n<div class=\"cal-modal-overlay\" id=\"catModal\"><div class=\"cal-modal\"><button class=\"cal-modal-close\" id=\"catModalClose\">&times;</button><h3>Add Category</h3><div id=\"catModalBody\"></div></div></div>\n<div class=\"cal-sidebar\" id=\"sidebar\"><button class=\"cal-sidebar-close\" id=\"sidebarClose\">&times;</button><div id=\"sidebarContent\"></div></div>\n<div class=\"cal-toast\" id=\"toast\"></div>";

// ================================================================
// MATRIX CALENDAR v4
// ================================================================

const CATEGORIES = [
  { id:'examprep', label:'ExamPrep', color:'#0e75a8', icon:'EP', children:['drills','study'], collapsedDefault:true, defaults:{ startTime:'09:00', endTime:'10:00', description:'' }, builtin:true },
  { id:'drills', label:'Drills', color:'#17a3cf', icon:'Dr', parent:'examprep', defaults:{ startTime:'10:00', endTime:'12:00', description:'Live drill with Dr. J' }, builtin:true },
  { id:'study', label:'Study Blocks', color:'#4a6a82', icon:'St', parent:'examprep', defaults:{ startTime:'08:00', endTime:'10:00', description:'' }, builtin:true },
  { id:'mission-residency', label:'Mission Residency', color:'#d9b85b', icon:'MR', children:['mr-session-a','mr-session-b','mr-session-c','mr-session-d','mr-session-e','mock-interviews'], collapsedDefault:true, defaults:{ startTime:'18:00', endTime:'19:00', description:'Strategy session' }, builtin:true },
  { id:'mr-session-a', label:'Session A', color:'#f3d576', icon:'A', parent:'mission-residency', defaults:{ startTime:'18:00', endTime:'19:00', description:'360 session' }, builtin:true },
  { id:'mr-session-b', label:'Session B', color:'#e8c967', icon:'B', parent:'mission-residency', defaults:{ startTime:'18:00', endTime:'19:00', description:'Match Pro session' }, builtin:true },
  { id:'mr-session-c', label:'Session C', color:'#d9b85b', icon:'C', parent:'mission-residency', defaults:{ startTime:'18:00', endTime:'19:00', description:'Match Prep Pro session' }, builtin:true },
  { id:'mr-session-d', label:'Session D', color:'#c9a14f', icon:'D', parent:'mission-residency', defaults:{ startTime:'18:00', endTime:'19:00', description:'Match Prep Pro session' }, builtin:true },
  { id:'mr-session-e', label:'Session E', color:'#b98d3f', icon:'E', parent:'mission-residency', defaults:{ startTime:'18:00', endTime:'19:00', description:'IV Prep Complete session' }, builtin:true },
  { id:'mock-interviews', label:'Mock Interviews', color:'#f06b2f', icon:'MI', parent:'mission-residency', defaults:{ startTime:'15:00', endTime:'16:00', description:'Practice with feedback' }, builtin:true },
  { id:'clinicals', label:'Clinicals', color:'#36c071', icon:'Cl', defaults:{ startTime:'07:00', endTime:'17:00', description:'' }, builtin:true },
  { id:'nrmp', label:'NRMP', color:'#d95c5c', icon:'NR', defaults:{ startTime:'09:00', endTime:'10:00', description:'' }, builtin:true },
  { id:'arena', label:'Arena', color:'#8b5cf6', icon:'Ar', defaults:{ startTime:'20:00', endTime:'21:00', description:'Arena competition' }, builtin:true },
  { id:'my-appointments', label:'My Appointments', color:'#f3d576', icon:'&#9733;', defaults:{ startTime:'09:00', endTime:'10:00', description:'Scheduler appointment' }, builtin:true },
];

const CATEGORY_ALIASES = {
  'drills-1': 'drills',
  'drills-23': 'drills',
  'mr-sessions': 'mission-residency',
  rotations: 'clinicals',
  appointment: 'my-appointments'
};

// UPDATED tracker phases per Dr. Brian
const TRACKER_PHASES = [
  { id:'cv', label:'CV Building', start:'2026-01-01', end:'2026-04-30', icon:'&#128196;' },
  { id:'lors-ps', label:'LORs & PS', start:'2026-05-01', end:'2026-07-31', icon:'&#9997;' },
  { id:'eras', label:'ERAS Application', start:'2026-08-01', end:'2026-10-31', icon:'&#128233;' },
  { id:'interviews', label:'Interviews', start:'2026-11-01', end:'2027-01-31', icon:'&#127908;' },
  { id:'rank', label:'Rank List', start:'2027-02-01', end:'2027-02-28', icon:'&#128202;' },
  { id:'match', label:'Match', start:'2027-03-01', end:'2027-03-31', icon:'&#127942;' },
];

const DRILL_TOPICS = {
  'Step/Level 1': ['Cardiology','Pulmonary','Renal / GU','GIT / HEP','Endocrine','Neurology','Derm / Ophtho','Micro / Infectious Disease','Viruses / Protozoa / Parasites','Immunology','Muscle / Rheumatology','Heme / Onc','Oncology by Systems','Repro / GYN / OB','Biochem / Genetics / Vitamins','Psych / Ethics','Biostats / Public Health','ER Medicine','Mixed Review'],
  'Step/Level 2/3': ['Cardiology','Pulmonary','Renal / GU / Electrolytes','GIT / HEP','Endocrine','Neurology','Derm / Ophtho','Infectious Disease','Rheumatology','Preventative / Vaccines / Vitamins','Heme / Onc','OB','GYN','Pediatrics','Psych / Ethics','Biostats / Public Health','ER Medicine','Surgery','Mixed Review'],
};
const SPECIALTIES = ['Internal Medicine','Family Medicine','Pediatrics','OB/GYN','Surgery','Psychiatry','Neurology','Emergency Medicine','Radiology','Pathology','Anesthesiology','Dermatology','Ophthalmology','Orthopedics','Urology','PM&R','Cardiology','Pulmonology','Other'];

const NOTIFICATIONS = [
  { id:1, type:'team', from:'Dr. Brian', title:'Weekly Strategy Update', body:'Review your application timeline. ERAS opens in 4 months.', time:'2h ago', read:false },
  { id:2, type:'arena', from:'Arena', title:'Challenge from @MedWarrior42', body:'Cardiology Speed Round challenge! Accept within 24h.', time:'5h ago', read:false },
  { id:3, type:'mentor', from:'Dr. J', title:'Drill Prep Reminder', body:'Tomorrow: Pulmonary drill. Review high-yield COPD and asthma.', time:'1d ago', read:false },
  { id:4, type:'team', from:'MissionMed', title:'New Mock Interview Slots', body:'3 new slots next week. Book early.', time:'2d ago', read:true },
  { id:5, type:'arena', from:'Arena', title:'Leaderboard Update', body:'You moved up 5 spots on Neurology! Rank: #12', time:'3d ago', read:true },
  { id:6, type:'mentor', from:'Dr. J', title:'Great job on last drill!', body:'88% on Cardiology. Trending up.', time:'4d ago', read:true },
];

// Demo session config (simulates what Supabase would store)
const SESSION_CONFIG = {
  enrolled: 'Session A',
  sessions: {
    'Session A': { day: 2, startHour: 18, endHour: 19, meetingPlatform: 'Webex', meetingUrl: 'https://missionmed.webex.com/meet/sessionA', label: '360 Session A' },
    'Session B': { day: 4, startHour: 18, endHour: 19, meetingPlatform: 'Webex', meetingUrl: 'https://missionmed.webex.com/meet/sessionB', label: 'Match Pro Session B' },
    'Session C': { day: 2, startHour: 19, endHour: 20, meetingPlatform: 'Webex', meetingUrl: 'https://missionmed.webex.com/meet/sessionC', label: 'Match Prep Pro Session C' },
    'Session D': { day: 4, startHour: 19, endHour: 20, meetingPlatform: 'Webex', meetingUrl: 'https://missionmed.webex.com/meet/sessionD', label: 'Match Prep Pro Session D' },
    'Session E': { day: 6, startHour: 19, endHour: 20, meetingPlatform: 'Webex', meetingUrl: 'https://missionmed.webex.com/meet/sessionE', label: 'IV Prep Complete Session E' },
  },
  drills: { day: 1, startHourL1: 10, endHourL1: 12, startHourL23: 14, endHourL23: 16, meetingPlatform: 'Zoom', meetingUrl: 'https://zoom.us/j/missionmed-drills', label: 'Dr. J Drill Session' },
};

const state = {
  view:'month', currentDate:new Date(), selectedDate:new Date(),
  events:[], filters:{}, categoryTreeCollapsed:{}, adminOpen:false, adminTab:'Step/Level 1',
  panelCollapsed:false, dragEvent:null, selectedDrillTopic:null,
  dataSources:{ events:'loading', todos:'loading' },
  sourceLog:{},
  todos:[],
  todoNextId: 1,
};
CATEGORIES.forEach(c => {
  state.filters[c.id] = true;
  if (c.children && c.collapsedDefault) state.categoryTreeCollapsed[c.id] = true;
});
let bgAnimationFrame = 0;
let bgResizeHandler = null;

// Audio
const SFX = {
  ctx:null,
  init(){ if(!this.ctx){ try { this.ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ this.ctx = null; } } },
  play(type){
    this.init(); if(!this.ctx) return; const c=this.ctx, o=c.createOscillator(), g=c.createGain();
    o.connect(g); g.connect(c.destination); g.gain.value=0.06;
    const t=c.currentTime;
    if(type==='click'){o.frequency.value=800;o.type='sine';g.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.start();o.stop(t+0.1);}
    else if(type==='drop'){o.frequency.value=500;o.type='triangle';g.gain.exponentialRampToValueAtTime(0.001,t+0.2);o.start();o.frequency.exponentialRampToValueAtTime(900,t+0.15);o.stop(t+0.2);}
    else if(type==='add'){o.frequency.value=600;o.type='sine';g.gain.value=0.05;g.gain.exponentialRampToValueAtTime(0.001,t+0.3);o.start();o.frequency.exponentialRampToValueAtTime(1200,t+0.25);o.stop(t+0.3);}
    else if(type==='nav'){o.frequency.value=400;o.type='sine';g.gain.value=0.03;g.gain.exponentialRampToValueAtTime(0.001,t+0.08);o.start();o.stop(t+0.08);}
    else if(type==='star'){o.frequency.value=700;o.type='sine';g.gain.value=0.04;g.gain.exponentialRampToValueAtTime(0.001,t+0.15);o.start();o.frequency.exponentialRampToValueAtTime(1100,t+0.12);o.stop(t+0.15);}
    else if(type==='todo'){o.frequency.value=900;o.type='sine';g.gain.value=0.04;g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.start();o.frequency.exponentialRampToValueAtTime(1300,t+0.1);o.stop(t+0.12);}
    else if(type==='resize'){o.frequency.value=300;o.type='triangle';g.gain.value=0.03;g.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.start();o.stop(t+0.1);}
  }
};

// Background
function teardownBackground(){
  if(bgAnimationFrame){cancelAnimationFrame(bgAnimationFrame);bgAnimationFrame=0;}
  if(bgResizeHandler){window.removeEventListener('resize',bgResizeHandler);bgResizeHandler=null;}
}

function initBackground(){
  teardownBackground();
  const canvas=document.getElementById('bgCanvas'),ctx=canvas.getContext('2d');
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){canvas.hidden=true;return;}
  let w,h,particles=[];
  function resize(){w=canvas.width=window.innerWidth;h=canvas.height=window.innerHeight;}
  resize(); bgResizeHandler=resize; window.addEventListener('resize',bgResizeHandler);
  for(let i=0;i<60;i++) particles.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*2+0.5,dx:(Math.random()-0.5)*0.3,dy:(Math.random()-0.5)*0.2,alpha:Math.random()*0.3+0.05,pulse:Math.random()*Math.PI*2,pulseSpeed:Math.random()*0.02+0.005});
  (function draw(){
    ctx.clearRect(0,0,w,h);
    const g1=ctx.createRadialGradient(w*0.4,h*0.4,0,w*0.4,h*0.4,w*0.6);
    g1.addColorStop(0,'rgba(14,117,168,0.08)');g1.addColorStop(1,'transparent');ctx.fillStyle=g1;ctx.fillRect(0,0,w,h);
    const g2=ctx.createRadialGradient(w*0.7,h*0.6,0,w*0.7,h*0.6,w*0.4);
    g2.addColorStop(0,'rgba(139,92,246,0.04)');g2.addColorStop(1,'transparent');ctx.fillStyle=g2;ctx.fillRect(0,0,w,h);
    particles.forEach(p=>{p.x+=p.dx;p.y+=p.dy;p.pulse+=p.pulseSpeed;if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;const a=p.alpha*(0.5+0.5*Math.sin(p.pulse));ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(23,163,207,${a})`;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r*3,0,Math.PI*2);ctx.fillStyle=`rgba(23,163,207,${a*0.2})`;ctx.fill();});
    bgAnimationFrame=requestAnimationFrame(draw);
  })();
}

// Seed
function seedEvents(){
  const now=new Date(), y=now.getFullYear(), m=now.getMonth(); let id=1;
  function ev(cat,title,day,sh,eh,desc,meta,meetUrl){
    state.events.push({id:id++,category:cat,title,start:new Date(y,m,day,sh,0),end:new Date(y,m,day,eh,0),description:desc||'',allDay:false,meta:meta||{},important:false,meetingUrl:meetUrl||'',meetingPlatform:meetUrl?'Webex':''});
  }
  // Auto-populated from session config (simulates Supabase->Calendar pipeline)
  const sess=SESSION_CONFIG.sessions[SESSION_CONFIG.enrolled];
  // Generate 4 weeks of MR sessions with meeting link
  for(let w=0;w<4;w++){
    const d=new Date(y,m,1); d.setDate(d.getDate()+(sess.day-d.getDay()+7)%7+w*7);
    if(d.getMonth()===m) ev(missionResidencySessionCategory(sess.label,'session_group_a'),sess.label,d.getDate(),sess.startHour,sess.endHour,'Weekly strategy call',{},sess.meetingUrl);
  }
  // Drills with Zoom link
  ev('drills','Cardiology (Step/Level 1)',5,10,12,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Cardiology (Step/Level 2/3)',5,14,16,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Pulmonary (Step/Level 1)',7,10,12,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Pulmonary (Step/Level 2/3)',7,14,16,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Neurology (Step/Level 1)',12,10,12,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Neurology (Step/Level 2/3)',12,14,16,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Renal / GU (Step/Level 1)',14,10,12,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Renal / GU / Electrolytes (Step/Level 2/3)',14,14,16,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','GIT / HEP (Step/Level 1)',19,10,12,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','GIT / HEP (Step/Level 2/3)',19,14,16,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Endocrine (Step/Level 1)',21,10,12,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('drills','Endocrine (Step/Level 2/3)',21,14,16,'Live drill with Dr. J',{},SESSION_CONFIG.drills.meetingUrl);
  ev('mission-residency','Personal Statement Workshop',8,14,16,'Small group PS review',{},sess.meetingUrl);
  ev('mock-interviews','Mock Interview: IM',6,15,16,'Practice with feedback',{},'https://missionmed.webex.com/meet/mockinterview');
  ev('mock-interviews','Mock Interview: Peds',13,15,16,'Practice with feedback',{},'https://missionmed.webex.com/meet/mockinterview');
  ev('mock-interviews','Mock Interview: Surgery',20,15,16,'Practice with feedback',{},'https://missionmed.webex.com/meet/mockinterview');
  [['ERAS Opens','2026-09-01'],['MSPE Release','2026-10-01'],['Interviews Begin','2026-10-15'],['ROL Opens','2027-01-15'],['ROL Deadline','2027-02-28'],['Match Day','2027-03-15']].forEach(d=>{
    const dt=new Date(d[1]);state.events.push({id:id++,category:'nrmp',title:d[0],start:dt,end:dt,description:'',allDay:true,meta:{},important:true,meetingUrl:'',meetingPlatform:''});
  });
  ev('clinicals','IM Rotation: Week 1',1,7,17,'City Hospital',{specialty:'Internal Medicine'});
  ev('clinicals','IM Rotation: Week 2',8,7,17,'City Hospital',{specialty:'Internal Medicine'});
  ev('clinicals','Surgery Rotation Starts',15,7,17,'General Surgery',{specialty:'Surgery'});
  ev('arena','Arena: Weekly Challenge',4,20,21,'Timed case competition');
  ev('arena','Arena: Weekly Challenge',11,20,21,'Timed case competition');
  ev('arena','Arena: Monthly Tournament',25,19,22,'Grand tournament');
  ev('study','UWorld: Cardio Block',2,8,10,'40 Q timed');
  ev('study','Anki Review',9,7,8,'Morning flashcards');
  ev('study','FA Review: Renal',16,9,11,'First Aid deep review');
  state.events.find(e=>e.title.includes('Monthly Tournament')).important=true;
  state.events.find(e=>e.title.includes('Personal Statement')).important=true;
}

// Helpers
function fmt(d,t){
  const D=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const M=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const SM=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if(t==='monthYear')return M[d.getMonth()]+' '+d.getFullYear();
  if(t==='shortDay')return D[d.getDay()].slice(0,3).toUpperCase();
  if(t==='dayName')return D[d.getDay()];
  if(t==='shortMonth')return SM[d.getMonth()];
  if(t==='full')return D[d.getDay()]+', '+M[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
  if(t==='time'){let h=d.getHours(),m=d.getMinutes(),a=h>=12?'PM':'AM';h=h%12||12;return h+':'+(m<10?'0':'')+m+' '+a;}
  if(t==='agendaDate')return SM[d.getMonth()]+' '+d.getDate();
  return d.toLocaleDateString();
}
function escapeHTML(value){
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function escapeJS(value){
  return String(value == null ? '' : value).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'');
}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
function isToday(d){return sameDay(d,new Date());}
function categoryId(id){return CATEGORY_ALIASES[id]||id;}
function catColor(id){return(catObj(id)||{}).color||'#4a6a82';}
function catObj(id){const normalized=categoryId(id);return CATEGORIES.find(c=>c.id===normalized)||CATEGORIES.find(c=>c.id==='study')||CATEGORIES[CATEGORIES.length-1];}
function missionResidencySessionCategory(title, sourceId){
  const haystack=(String(title||'')+' '+String(sourceId||'')).toUpperCase();
  const match=haystack.match(/SESSION[\s_-]*([A-E])\b/)||haystack.match(/SESSION_GROUP[_-]?([A-E])\b/);
  return match ? 'mr-session-'+match[1].toLowerCase() : 'mission-residency';
}
function categoryChildren(catId){const cat=catObj(catId);return CATEGORIES.filter(c=>(cat.children||[]).indexOf(c.id)!==-1);}
function isCategoryFilterActive(cat){
  cat=typeof cat==='string'?catObj(cat):cat;
  if(!cat)return true;
  if(cat.children&&cat.children.length)return state.filters[cat.id]!==false&&categoryChildren(cat.id).every(child=>state.filters[child.id]!==false);
  return state.filters[cat.id]!==false;
}
function setCategoryFilter(catId, active){
  const cat=catObj(catId);
  if(!cat)return;
  state.filters[cat.id]=!!active;
  if(cat.children&&cat.children.length)categoryChildren(cat.id).forEach(child=>{state.filters[child.id]=!!active;});
}
function categoryEnabled(catId){
  const normalized=categoryId(catId);
  const cat=catObj(normalized);
  if(state.filters[normalized]===false)return false;
  if(cat&&cat.parent&&state.filters[cat.parent]===false)return false;
  return true;
}
function selectableCategories(){return CATEGORIES.filter(c=>!(c.children&&c.children.length));}
function categoryOptionLabel(cat){
  if(cat.parent){const parent=catObj(cat.parent);return (parent&&parent.label?parent.label+' / ':'')+cat.label;}
  return cat.label;
}
function filtered(){return state.events.filter(e=>categoryEnabled(e.category));}
function eventsOn(d){return filtered().filter(e=>sameDay(e.start,d)).sort((a,b)=>a.start-b.start);}
function showToast(m,i){const t=document.getElementById('toast');t.innerHTML=(i||'')+' '+m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function closeDaySidebar(){const sidebar=document.getElementById('sidebar');if(sidebar)sidebar.classList.remove('open');}

// Tracker
function renderTracker(){
  const barEl=document.getElementById('trackerBar'), labelsEl=document.getElementById('trackerLabels'), countdownEl=document.getElementById('trackerCountdown');
  if(!barEl||!labelsEl||!countdownEl)return;
  const now=new Date(); let bar='',labels='',activePhase=null;
  TRACKER_PHASES.forEach(p=>{
    const s=new Date(p.start),e=new Date(p.end);
    let cls=now>=s&&now<=e?'active':now>e?'completed':'future';
    if(cls==='active')activePhase=p;
    bar+=`<div class="cal-tracker-seg ${cls}" data-phase="${p.id}" title="${p.label}">${p.icon}</div>`;
    labels+=`<div class="cal-tracker-lbl ${cls==='active'?'active':''}">${p.label}</div>`;
  });
  barEl.innerHTML=bar;
  labelsEl.innerHTML=labels;
  const diff=Math.ceil((new Date('2027-03-15')-now)/(1000*60*60*24));
  countdownEl.innerHTML=diff>0?
    `<span class="num">${diff}</span> days until Match Day${activePhase?' &mdash; Currently: <strong>'+activePhase.label+'</strong>':''}`:
    '<span class="num">Match Day!</span>';
  document.querySelectorAll('.cal-tracker-seg').forEach(seg=>{
    seg.addEventListener('click',()=>{SFX.play('click');const ph=TRACKER_PHASES.find(p=>p.id===seg.dataset.phase);if(ph){state.currentDate=new Date(ph.start);state.selectedDate=new Date(ph.start);renderCurrentView();showToast('Jumped to '+ph.label,'&#128640;');}});
  });
}

// Filters
function renderFilters(){
  const list=document.getElementById('filterList'); let html='';
  CATEGORIES.forEach(c=>{
    if(c.parent&&state.categoryTreeCollapsed[c.parent])return;
    const children=categoryChildren(c.id), hasChildren=children.length>0, active=isCategoryFilterActive(c), collapsed=!!state.categoryTreeCollapsed[c.id];
    const dragAttrs=canUseCalendarWriteControls()&&!hasChildren?` draggable="true" ondragstart="handleCatDrag(event,'${c.id}')"`:'';
    html+=`<div class="cat-filter ${active?'active':''} ${c.parent?'is-subcategory':''} ${hasChildren?'is-parent':''} ${collapsed?'is-collapsed':''}" data-cat="${c.id}"${dragAttrs}>
      ${hasChildren?`<button type="button" class="cat-disclosure" data-cat-toggle="${c.id}" aria-label="${collapsed?'Expand':'Collapse'} ${escapeHTML(c.label)}">${collapsed?'&#9656;':'&#9662;'}</button>`:'<span class="cat-disclosure-spacer"></span>'}
      <span class="dot" style="background:${c.color};color:${c.color}"></span>
      <span class="cat-label">${escapeHTML(c.label)}</span>
      ${hasChildren?'': '<span class="drag-handle">&#9776;</span>'}
    </div>`;
  });
  list.innerHTML=html;
		list.querySelectorAll('.cat-filter').forEach(f=>{
		  f.addEventListener('click',e=>{
        const disclosure=e.target.closest('.cat-disclosure');
        if(disclosure){
          e.stopPropagation();SFX.play('click');
          const catId=disclosure.getAttribute('data-cat-toggle');
          state.categoryTreeCollapsed[catId]=!state.categoryTreeCollapsed[catId];
          renderFilters();
          return;
        }
        if(e.target.classList.contains('drag-handle'))return;
        SFX.play('click');
        setCategoryFilter(f.dataset.cat,!isCategoryFilterActive(f.dataset.cat));
        renderFilters();renderCurrentView();
      });
		});
	lockStudentWriteControls();
}

// Add category modal
function showAddCategoryModal(){
  if (!requireCalendarWriteControls()) return;
  SFX.play('click');
  const colors=['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e84393','#00b894','#636e72'];
  let colorPicker=colors.map(c=>`<span onclick="document.getElementById('newCatColor').value='${c}';document.querySelectorAll('.color-dot-pick').forEach(d=>d.style.outline='none');this.style.outline='2px solid #fff'" class="color-dot-pick" style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;margin:3px;transition:var(--transition);"></span>`).join('');
  document.getElementById('catModalBody').innerHTML=`
    <div class="cal-form-group"><label class="cal-form-label">Name</label><input class="cal-form-input" id="newCatName" placeholder="e.g., Research Projects"/></div>
    <div class="cal-form-group"><label class="cal-form-label">Icon (emoji)</label><input class="cal-form-input" id="newCatIcon" placeholder="e.g., &#128300;" value="&#128204;"/></div>
    <div class="cal-form-group"><label class="cal-form-label">Color</label><div style="margin-top:4px;">${colorPicker}</div><input type="hidden" id="newCatColor" value="#3498db"/></div>
    <div class="cal-form-row">
      <div class="cal-form-group"><label class="cal-form-label">Default Start</label><input class="cal-form-input" type="time" id="newCatStart" value="09:00"/></div>
      <div class="cal-form-group"><label class="cal-form-label">Default End</label><input class="cal-form-input" type="time" id="newCatEnd" value="10:00"/></div>
    </div>
    <button class="cal-form-submit" onclick="submitAddCategory()">Add Category</button>`;
  document.getElementById('catModal').classList.add('open');
}
function submitAddCategory(){
  if (!requireCalendarWriteControls()) return;
  const name=document.getElementById('newCatName').value.trim();
  if(!name){showToast('Enter a name','&#9888;');return;}
  const id='custom-'+Date.now();
  const color=document.getElementById('newCatColor').value;
  const icon=document.getElementById('newCatIcon').value||'&#128204;';
  const st=document.getElementById('newCatStart').value;
  const en=document.getElementById('newCatEnd').value;
  CATEGORIES.push({id,label:name,color,icon,defaults:{startTime:st,endTime:en,description:''},builtin:false});
  state.filters[id]=true;
  closeModal('catModal');SFX.play('add');renderFilters();showToast('Category added: '+name,'&#10024;');
}

// To-Do
function renderTodos(){
  const list=document.getElementById('todoList');
  const pending=state.todos.filter(t=>!t.done).sort((a,b)=>{const p={high:0,med:1,low:2};return(p[a.priority]||2)-(p[b.priority]||2);});
  const done=state.todos.filter(t=>t.done);
  const sorted=[...pending,...done];
  let html='';
	sorted.forEach(t=>{
	  const hasMeeting=t.meetingUrl&&!t.done;
	  const writeAttrs = canUseCalendarWriteControls() ? `onclick="showTodoDetail(${t.id})"` : '';
	  const checkHtml = canUseCalendarWriteControls() ? `<input type="checkbox" class="todo-check" ${t.done?'checked':''} onclick="event.stopPropagation()" onchange="event.stopPropagation();toggleTodo(${t.id})">` : '';
	  html+=`<div class="todo-item ${t.done?'completed':''} ${canUseCalendarWriteControls()?'':'is-readonly'}" ${writeAttrs}>
	    ${checkHtml}
	    <div style="flex:1;min-width:0;">
        <div class="todo-text">${t.text}</div>
        ${t.date?`<div class="todo-date">${t.date}</div>`:''}
        ${hasMeeting?`<a class="todo-meeting-link" href="${t.meetingUrl}" target="_blank" onclick="event.stopPropagation()">&#128247; Join ${t.meetingPlatform||'Meeting'}</a>`:''}
      </div>
      <span class="todo-priority ${t.priority}">${t.priority.toUpperCase()}</span>
    </div>`;
  });
  list.innerHTML=html||'<p style="text-align:center;opacity:0.25;padding:20px;font-size:13px;">No tasks yet</p>';
  document.getElementById('todoCount').textContent=pending.length;
  const cb=document.getElementById('todoBadgeCollapsed');
  if(cb) cb.textContent=pending.length;
  const nb=document.getElementById('notifBadgeCollapsed');
	  if(nb) nb.textContent=NOTIFICATIONS.filter(n=>!n.read).length;
	  lockStudentWriteControls();
}
function addTodo(){
  if (!requireCalendarWriteControls()) return;
  const input=document.getElementById('todoInput'), text=input.value.trim();
  if(!text)return;
  const todo={text,done:false,priority:'med',date:'',notes:'',meetingUrl:'',meetingPlatform:''};
  showToast('Saving task…','&#8987;');
  persistTodoCreate(todo).then(()=>{input.value='';SFX.play('todo');showToast('Task added','&#10004;');}).catch(()=>{showToast('Task was not saved. Nothing changed.','&#9888;');});
}
function toggleTodo(id){
  if (!requireCalendarWriteControls()) return;
  const t=state.todos.find(x=>String(x.id)===String(id));
  if(t){const candidate=Object.assign({},t,{done:!t.done});showToast('Saving task…','&#8987;');persistTodoUpdate(candidate).then(()=>{SFX.play(candidate.done?'todo':'click');showToast('Task updated','&#10004;');}).catch(()=>{showToast('Task was not updated. Nothing changed.','&#9888;');});}
}

// To-Do Detail Modal (full featured)
function showTodoDetail(id){
  if (!requireCalendarWriteControls()) return;
  SFX.play('click');
  const t=state.todos.find(x=>x.id===id);if(!t)return;
  const priorities=['high','med','low'];
  let prioOptions=priorities.map(p=>`<option value="${p}" ${t.priority===p?'selected':''}>${p.toUpperCase()}</option>`).join('');
  document.getElementById('todoModalTitle').textContent='Task Details';
  document.getElementById('todoModalBody').innerHTML=`
    <div class="cal-form-group"><label class="cal-form-label">Task</label><input class="cal-form-input" id="tdTitle" value="${t.text.replace(/"/g,'&quot;')}"/></div>
    <div class="cal-form-row">
      <div class="cal-form-group"><label class="cal-form-label">Priority</label><select class="cal-form-select" id="tdPriority">${prioOptions}</select></div>
      <div class="cal-form-group"><label class="cal-form-label">Due Date</label><input class="cal-form-input" type="date" id="tdDate" value="${t.date}"/></div>
    </div>
    <div class="cal-form-group"><label class="cal-form-label">Notes</label><textarea class="cal-form-textarea" id="tdNotes" style="min-height:100px;" placeholder="Add notes, links, details...">${t.notes||''}</textarea></div>
    <div class="cal-form-group">
      <label class="cal-form-label">Meeting Link</label>
      <div class="cal-form-row">
        <select class="cal-form-select" id="tdMeetPlatform">
          <option value="" ${!t.meetingPlatform?'selected':''}>No meeting</option>
          <option value="Webex" ${t.meetingPlatform==='Webex'?'selected':''}>Webex</option>
          <option value="Zoom" ${t.meetingPlatform==='Zoom'?'selected':''}>Zoom</option>
          <option value="Google Meet" ${t.meetingPlatform==='Google Meet'?'selected':''}>Google Meet</option>
          <option value="Teams" ${t.meetingPlatform==='Teams'?'selected':''}>Teams</option>
        </select>
        <input class="cal-form-input" id="tdMeetUrl" placeholder="https://..." value="${t.meetingUrl||''}"/>
      </div>
      ${t.meetingUrl?`
      <div class="meeting-link-field" style="margin-top:8px;">
        <div class="mlf-icon">${t.meetingPlatform==='Zoom'?'&#128247;':'&#128187;'}</div>
        <div class="mlf-info">
          <div class="mlf-label">${t.meetingPlatform||'Meeting'}</div>
          <div class="mlf-url">${t.meetingUrl}</div>
        </div>
        <a class="mlf-join" href="${t.meetingUrl}" target="_blank" onclick="event.stopPropagation()">Join</a>
      </div>`:''}
    </div>
    <div class="cal-form-group"><label class="cal-form-check"><input type="checkbox" id="tdDone" ${t.done?'checked':''}/><span>${t.done?'Completed':'Mark as complete'}</span></label></div>
    <div style="display:flex;gap:8px;">
      <button class="cal-form-submit" style="flex:2;" onclick="saveTodoDetail(${id})">Save Changes</button>
      <button class="cal-form-submit" style="flex:1;background:linear-gradient(180deg,var(--red),#b94444);" onclick="deleteTodo(${id})">Delete</button>
    </div>
    <div style="margin-top:10px;padding:10px 12px;background:rgba(14,117,168,0.08);border:1px solid rgba(14,117,168,0.15);border-radius:var(--radius);font-size:11px;color:rgba(255,255,255,0.45);">
      <strong style="color:var(--blue2);">&#128161; Tip:</strong> Tasks linked to a session will auto-populate the meeting link from your enrolled session. When your mentor schedules a session, the Webex/Zoom invite appears here automatically.
    </div>`;
  document.getElementById('todoModal').classList.add('open');
}
function saveTodoDetail(id){
  if (!requireCalendarWriteControls()) return;
  const t=state.todos.find(x=>String(x.id)===String(id));if(!t)return;
  const candidate=Object.assign({},t,{
    text:document.getElementById('tdTitle').value.trim()||t.text,
    priority:document.getElementById('tdPriority').value,
    date:document.getElementById('tdDate').value,
    notes:document.getElementById('tdNotes').value,
    meetingPlatform:document.getElementById('tdMeetPlatform').value,
    meetingUrl:document.getElementById('tdMeetUrl').value,
    done:document.getElementById('tdDone').checked
  });
  showToast('Saving task…','&#8987;');
  persistTodoUpdate(candidate).then(()=>{closeModal('todoModal');SFX.play('todo');showToast('Task updated','&#10004;');}).catch(()=>{showToast('Task was not updated. Nothing changed.','&#9888;');});
}
function deleteTodo(id){
  if (!requireCalendarWriteControls()) return;
  const todo=state.todos.find(x=>String(x.id)===String(id));
  if(!todo)return;
  showToast('Deleting task…','&#8987;');
  persistTodoDelete(id).then(()=>{closeModal('todoModal');SFX.play('click');showToast('Task deleted','&#128465;');}).catch(()=>{showToast('Task was not deleted. Nothing changed.','&#9888;');});
}

// Panel
function togglePanel(){
  state.panelCollapsed=!state.panelCollapsed;
  document.getElementById('leftPanel').classList.toggle('collapsed',state.panelCollapsed);
  document.getElementById('panelCollapseBtn').innerHTML=state.panelCollapsed?'&#9654;':'&#9664;';
}

// Month
function renderMonth(){
  const c=document.getElementById('viewMonth'), cur=state.currentDate, yr=cur.getFullYear(), mo=cur.getMonth();
  const first=new Date(yr,mo,1), start=new Date(first);
  start.setDate(start.getDate()-start.getDay());
  document.getElementById('monthLabel').textContent=fmt(cur,'monthYear');
  const statusHtml = calendarStatusHtml();
  if (statusHtml) {
    c.innerHTML = statusHtml;
    return;
  }
  let h='<div class="cal-grid-wrap"><div class="cal-weekdays">';
  ['SUN','MON','TUE','WED','THU','FRI','SAT'].forEach(d=>h+=`<div class="cal-weekday">${d}</div>`);
  h+='</div><div class="cal-days">';
  const d=new Date(start);
  for(let i=0;i<42;i++){
    const td=new Date(d), om=td.getMonth()!==mo, today=isToday(td), sel=sameDay(td,state.selectedDate);
    const evts=eventsOn(td);
    h+=`<div class="cal-day ${om?'other-month':''} ${today?'today':''} ${sel?'selected':''}" data-date="${td.toISOString()}" role="button" tabindex="0" aria-label="${attrText((state.selectedDrillTopic?'Schedule '+state.selectedDrillTopic.topic+' on ':'Open ')+fmt(td,'full'))}" onkeydown="activateCalendarDayFromKey(event,this)" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleDrop(event,this)">
      <div class="cal-day-num">${td.getDate()}</div><div class="cal-day-events">`;
	  evts.slice(0,3).forEach(ev=>{
	    const dragAttrs = canUseCalendarWriteControls() ? `draggable="true" ondragstart="handleDragStart(event,'${escapeJS(ev.id)}')"` : `draggable="false"`;
	    h+=`<div class="cal-event-chip ${eventChipClasses(ev)}" role="button" tabindex="0" title="${attrText(ev.title+' '+(ev.allDay?'All Day':fmt(ev.start,'time')+' - '+fmt(ev.end,'time')))}" style="--cat:${catColor(ev.category)};border-left-color:${catColor(ev.category)}" ${dragAttrs} data-id="${ev.id}" onclick="event.stopPropagation();showEventDetail('${escapeJS(ev.id)}')" onkeydown="activateEventFromKey(event,'${escapeJS(ev.id)}')"><span class="cal-event-title">${escapeHTML(ev.title)}</span>${ev.meetingUrl?'<a class="join-badge" href="'+escapeHTML(ev.meetingUrl)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Join</a>':''}</div>`;
	  });
    if(evts.length>3) h+=`<div class="cal-event-more" onclick="event.stopPropagation();openDaySidebar('${td.toISOString()}')">+${evts.length-3} more</div>`;
    h+='</div></div>';d.setDate(d.getDate()+1);
  }
  h+='</div></div>';c.innerHTML=h;
  c.querySelectorAll('.cal-day').forEach(cell=>{cell.addEventListener('click',()=>{SFX.play('click');state.selectedDate=new Date(cell.dataset.date);if(classicCalendarCore)classicCalendarCore.setDate(state.selectedDate);if(state.selectedDrillTopic&&canUseCalendarAdmin()){scheduleDrillTopicOnDate(state.selectedDrillTopic,cell.dataset.date);return;}openDaySidebar(cell.dataset.date);renderMonth();});});
}
function activateCalendarDayFromKey(event,cell){if(event.key==='Enter'||event.key===' '){event.preventDefault();cell.click();}}

// Week
function renderWeek(){
  const c=document.getElementById('viewWeek'), cur=state.currentDate, ws=new Date(cur);
  ws.setDate(ws.getDate()-ws.getDay());
  const days=[];for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);days.push(d);}
  document.getElementById('monthLabel').textContent=fmt(days[0],'shortMonth')+' '+days[0].getDate()+' - '+fmt(days[6],'shortMonth')+' '+days[6].getDate()+', '+days[6].getFullYear();
  const statusHtml = calendarStatusHtml();
  if (statusHtml) {
    c.innerHTML = statusHtml;
    return;
  }
  let h='<div class="cal-week-wrap"><div class="cal-week-header"><div class="cal-week-header-cell"></div>';
  days.forEach(d=>h+=`<div class="cal-week-header-cell ${isToday(d)?'today-col':''}">${fmt(d,'shortDay')}<span class="day-num">${d.getDate()}</span></div>`);
  h+='</div><div class="cal-week-body"><div class="cal-week-time-col" style="display:flex;flex-direction:column;">';
  for(let hr=6;hr<=22;hr++){const l=hr===12?'12 PM':hr>12?(hr-12)+' PM':hr+' AM';h+=`<div class="cal-week-time-label">${l}</div>`;}
  h+='</div>';
  days.forEach(d=>{
    h+=`<div class="cal-week-day-col">`;
    for(let hr=6;hr<=22;hr++) h+=`<div class="cal-week-hour-slot"></div>`;
    eventsOn(d).filter(e=>!e.allDay).forEach(ev=>{
      const sh=ev.start.getHours()+ev.start.getMinutes()/60, eh=ev.end.getHours()+ev.end.getMinutes()/60;
      const top=Math.max(0,(sh-6))*60, height=Math.max(28,(eh-sh)*60), col=catColor(ev.category);
	      h+=`<div class="cal-week-event ${ev.important?'important':''}" role="button" tabindex="0" style="--cat:${col};top:${top}px;height:${height}px;background:linear-gradient(135deg,${col}22,${col}11);border-color:${col};" data-evid="${ev.id}" onclick="showEventDetail('${escapeJS(ev.id)}')" onkeydown="activateEventFromKey(event,'${escapeJS(ev.id)}')">
	        <div class="ev-title">${escapeHTML(ev.title)}</div><div class="ev-time">${fmt(ev.start,'time')} - ${fmt(ev.end,'time')}</div>
	        ${canUseCalendarWriteControls()?`<div class="resize-handle" data-evid="${ev.id}"></div>`:''}</div>`;
    });
    h+='</div>';
  });
  h+='</div></div>';c.innerHTML=h;
  initResizeHandles(c,'cal-week-event');
}

// Day
function renderDay(){
  const c=document.getElementById('viewDay'), d=state.selectedDate;
  document.getElementById('monthLabel').textContent=fmt(d,'full');
  const statusHtml = calendarStatusHtml();
  if (statusHtml) {
    c.innerHTML = statusHtml;
    return;
  }
  let h=`<div class="cal-day-view-wrap"><div class="cal-day-view-header"><div class="day-name">${fmt(d,'dayName')}</div><div class="day-full">${fmt(d,'shortMonth')} ${d.getDate()}, ${d.getFullYear()}</div></div>
  <div class="cal-day-view-body"><div>`;
  for(let hr=6;hr<=22;hr++){const l=hr===12?'12 PM':hr>12?(hr-12)+' PM':hr+' AM';h+=`<div class="cal-day-view-time">${l}</div>`;}
  h+='</div><div class="cal-day-view-slots">';
  for(let hr=6;hr<=22;hr++) h+=`<div class="cal-day-view-slot"></div>`;
  eventsOn(d).filter(e=>!e.allDay).forEach(ev=>{
    const sh=ev.start.getHours()+ev.start.getMinutes()/60, eh=ev.end.getHours()+ev.end.getMinutes()/60;
    const top=Math.max(0,(sh-6))*60, height=Math.max(38,(eh-sh)*60);
    const col=catColor(ev.category), cat=catObj(ev.category);
    h+=`<div class="cal-day-view-event ${ev.important?'important':''}" role="button" tabindex="0" style="--cat:${col};top:${top}px;height:${height}px;background:linear-gradient(135deg,${col}28,${col}12);" data-evid="${ev.id}" onclick="showEventDetail('${escapeJS(ev.id)}')" onkeydown="activateEventFromKey(event,'${escapeJS(ev.id)}')">
	      <div class="ev-title">${cat.icon} ${escapeHTML(ev.title)}
	        ${canUseCalendarWriteControls()?`<span class="importance-star ${ev.important?'lit':''}" onclick="event.stopPropagation();toggleImportant('${escapeJS(ev.id)}')">${ev.important?'&#9733;':'&#9734;'}</span>`:''}
	        ${ev.meetingUrl?`<a class="join-badge" href="${escapeHTML(ev.meetingUrl)}" target="_blank" onclick="event.stopPropagation()">Join ${escapeHTML(ev.meetingPlatform||'')}</a>`:''}
	      </div>
	      <div class="ev-time">${fmt(ev.start,'time')} - ${fmt(ev.end,'time')}</div>
	      ${ev.description?`<div class="ev-desc">${escapeHTML(ev.description)}</div>`:''}
	      ${canUseCalendarWriteControls()?`<div class="resize-handle" data-evid="${ev.id}"></div>`:''}</div>`;
	  });
  h+='</div></div></div>';c.innerHTML=h;
  initResizeHandles(c,'cal-day-view-event');
}

// Resize
function initResizeHandles(container, cls){
  if (!canUseCalendarWriteControls()) return;
  container.querySelectorAll('.resize-handle').forEach(handle=>{
    handle.addEventListener('mousedown', e=>{
      e.stopPropagation();e.preventDefault();
      const evId=handle.dataset.evid, ev=state.events.find(x=>String(x.id)===String(evId));if(!ev)return;
      const el=handle.closest('.'+cls), startY=e.clientY, startH=el.offsetHeight;
      document.body.style.cursor='ns-resize';document.body.style.userSelect='none';
      function onMove(me){
        const nh=Math.max(28,startH+(me.clientY-startY));
        el.style.height=nh+'px';
        const dur=nh/60, ne=new Date(ev.start);ne.setMinutes(ne.getMinutes()+Math.round(dur*60/15)*15);
        const te=el.querySelector('.ev-time');if(te)te.textContent=fmt(ev.start,'time')+' - '+fmt(ne,'time');
      }
      function onUp(me){
        document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
        document.body.style.cursor='';document.body.style.userSelect='';
        const nh=Math.max(28,startH+(me.clientY-startY)), dur=nh/60;
        const ne=new Date(ev.start);ne.setMinutes(ne.getMinutes()+Math.round(dur*60/15)*15);
        if(ne>ev.start){const candidate=Object.assign({},ev,{end:ne});showToast('Saving duration…','&#8987;');persistUpdatedEvent(candidate).then(()=>{SFX.play('resize');showToast(fmt(candidate.start,'time')+' - '+fmt(candidate.end,'time'),'&#8597;');}).catch(()=>{});}
      }
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
  });
}

// Agenda
function renderAgenda(){
  const c=document.getElementById('viewAgenda');
  document.getElementById('monthLabel').textContent='Agenda & Dashboard';
  const statusHtml = calendarStatusHtml();
  if (statusHtml) {
    c.innerHTML = statusHtml;
    return;
  }
  const upcoming=filtered().filter(e=>e.start>=new Date(state.currentDate.getFullYear(),state.currentDate.getMonth(),1)).sort((a,b)=>a.start-b.start);
  const groups={};upcoming.forEach(e=>{const k=e.start.toDateString();if(!groups[k])groups[k]=[];groups[k].push(e);});
  let evH='<div class="cal-agenda-events"><div class="panel-section-title" style="margin-bottom:10px;">Upcoming Events</div>';
  const keys=Object.keys(groups).slice(0,14);
  if(!keys.length) evH+='<p style="text-align:center;opacity:0.35;padding:24px;">No upcoming events.</p>';
  keys.forEach(k=>{
    const evts=groups[k], d=evts[0].start;
    evH+=`<div class="cal-agenda-day-group"><div class="cal-agenda-date">${isToday(d)?'<span class="today-indicator"></span> Today':fmt(d,'dayName')}, ${fmt(d,'agendaDate')} <span class="badge">${evts.length}</span></div>`;
	    evts.forEach(ev=>{
	      const col=catColor(ev.category), cat=catObj(ev.category);
	      evH+=`<div class="cal-agenda-item" role="button" tabindex="0" onclick="showEventDetail('${escapeJS(ev.id)}')" onkeydown="activateEventFromKey(event,'${escapeJS(ev.id)}')">
        <div class="cal-agenda-color-bar" style="background:${col}"></div>
        <div class="cal-agenda-time">${ev.allDay?'All Day':fmt(ev.start,'time')}</div>
        <div class="cal-agenda-content"><div class="cal-agenda-title">${cat.icon} ${escapeHTML(ev.title)}${ev.important?'<span class="importance-star lit" style="width:18px;height:18px;font-size:10px;">&#9733;</span>':''}${ev.meetingUrl?'<a class="join-badge" href="'+escapeHTML(ev.meetingUrl)+'" target="_blank" onclick="event.stopPropagation()">Join</a>':''}</div>
	        <div class="cal-agenda-meta">${escapeHTML(cat.label)}${ev.description?' &middot; '+escapeHTML(ev.description):''}</div></div>
	        ${canUseCalendarWriteControls()?`<span class="importance-star ${ev.important?'lit':''}" onclick="event.stopPropagation();toggleImportant('${escapeJS(ev.id)}')">${ev.important?'&#9733;':'&#9734;'}</span>`:''}
	      </div>`;
	    });evH+='</div>';
  });evH+='</div>';
  // Sidebar
  let sbH='<div class="agenda-sidebar">';
	  sbH+='<div class="agenda-card"><div class="agenda-card-title">&#9745; To-Do List <span class="badge-count" style="background:var(--green);margin-left:auto;">'+state.todos.filter(t=>!t.done).length+'</span></div>';
	  state.todos.filter(t=>!t.done).sort((a,b)=>{const p={high:0,med:1,low:2};return(p[a.priority]||2)-(p[b.priority]||2);}).slice(0,6).forEach(t=>{
	    const todoWriteAttrs = canUseCalendarWriteControls() ? `onclick="showTodoDetail(${t.id})"` : '';
	    const todoCheck = canUseCalendarWriteControls() ? `<input type="checkbox" class="todo-check" onclick="event.stopPropagation()" onchange="event.stopPropagation();toggleTodo(${t.id})">` : '';
	    sbH+=`<div class="todo-item ${canUseCalendarWriteControls()?'':'is-readonly'}" style="margin-bottom:3px;" ${todoWriteAttrs}>
	      ${todoCheck}
	      <div style="flex:1;min-width:0;"><div class="todo-text">${t.text}</div>${t.date?`<div class="todo-date">${t.date}</div>`:''}</div>
      <span class="todo-priority ${t.priority}">${t.priority.toUpperCase()}</span></div>`;
  });sbH+='</div>';
  sbH+='<div class="agenda-card"><div class="agenda-card-title">&#128276; Notifications <span class="badge-count" style="background:var(--red);margin-left:auto;">'+NOTIFICATIONS.filter(n=>!n.read).length+'</span></div>';
  NOTIFICATIONS.forEach(n=>{
    sbH+=`<div class="notif-item ${n.read?'':'unread'}"><div class="notif-icon ${n.type}">${n.type==='arena'?'&#9889;':n.type==='mentor'?'&#127919;':'&#128172;'}</div>
    <div class="notif-content"><div class="notif-title">${n.title}</div><div class="notif-meta">${n.from} &middot; ${n.time}</div><div class="notif-body">${n.body}</div></div></div>`;
  });sbH+='</div></div>';
  c.innerHTML=`<div class="cal-agenda-wrap">${evH}${sbH}</div>`;
}

function toggleImportant(id){
  if(!requireCalendarWriteControls())return;
  const ev=state.events.find(e=>String(e.id)===String(id));
  if(!ev)return;
  const candidate=Object.assign({},ev,{important:!ev.important});
  showToast('Saving…','&#8987;');
  persistUpdatedEvent(candidate).then(()=>{SFX.play('star');showToast(candidate.important?'Marked important':'Unmarked',candidate.important?'&#11088;':'');}).catch(()=>{});
}

// Admin
function placeAdminPanelInSidebar(){
  const panel=document.getElementById('adminPanel'), catSection=document.getElementById('catSection');
  if(panel&&catSection&&panel.previousElementSibling!==catSection){
    catSection.insertAdjacentElement('afterend',panel);
  }
}
function renderAdmin(){
  placeAdminPanelInSidebar();
  if (!canUseCalendarAdmin()) {
    lockCalendarAdminControls();
    return;
  }
  const panel=document.getElementById('adminPanel'), tab=state.adminTab, topics=DRILL_TOPICS[tab]||[];
  if (!panel) return;
  panel.hidden = false;
  let h=`<div class="cal-admin-title">&#9881; Quick Schedule: Dr. J's Drills</div>
    <p style="font-size:12px;opacity:0.4;margin-bottom:8px;">Drag a topic onto any calendar day, or select one and then select a date.</p>
    <div class="cal-topic-tabs">
      <div class="cal-topic-tab ${tab==='Step/Level 1'?'active':''}" data-tab="Step/Level 1">Step/Level 1</div>
      <div class="cal-topic-tab ${tab==='Step/Level 2/3'?'active':''}" data-tab="Step/Level 2/3">Step/Level 2/3</div>
    </div><div class="cal-topic-grid">`;
  topics.forEach(t=>{
    const lvl=tab==='Step/Level 1'?'1':'2/3', cls=tab==='Step/Level 1'?'level-1':'level-23';
    const selected=state.selectedDrillTopic&&state.selectedDrillTopic.topic===t&&state.selectedDrillTopic.level===tab;
    h+=`<div class="cal-topic-chip ${cls} ${selected?'is-selected':''}" role="button" tabindex="0" aria-pressed="${selected?'true':'false'}" draggable="true" data-topic="${attrText(t)}" data-level="${attrText(tab)}"><span class="level-badge">L${lvl}</span>${t}</div>`;
  });h+='</div>';panel.innerHTML=h;
  panel.querySelectorAll('.cal-topic-tab').forEach(t=>t.addEventListener('click',()=>{SFX.play('click');state.adminTab=t.dataset.tab;renderAdmin();}));
  panel.querySelectorAll('.cal-topic-chip').forEach(chip=>{
    chip.addEventListener('click',()=>selectDrillTopic(chip.dataset.topic,chip.dataset.level));
    chip.addEventListener('keydown',event=>activateDrillTopicFromKey(event,chip.dataset.topic,chip.dataset.level));
    chip.addEventListener('dragstart',event=>handleTopicDrag(event,chip.dataset.topic,chip.dataset.level));
  });
}

// Drag & Drop
function handleDragStart(e,id){if(!canUseCalendarWriteControls()){state.dragEvent=null;if(e&&e.preventDefault)e.preventDefault();return false;}state.dragEvent={type:'event',id};e.dataTransfer.effectAllowed='move';}
function handleTopicDrag(e,topic,level){
  if (!canUseCalendarAdmin()) {
    state.dragEvent = null;
    if (e && e.preventDefault) e.preventDefault();
    return false;
  }
  state.dragEvent={type:'topic',topic,level};e.dataTransfer.effectAllowed='copy';
}
function selectDrillTopic(topic,level){
  if(!canUseCalendarAdmin())return;
  state.selectedDrillTopic={topic,level};
  renderAdmin();renderMonth();
  showToast('Select a calendar date for '+topic,'&#128197;');
}
function activateDrillTopicFromKey(event,topic,level){if(event.key==='Enter'||event.key===' '){event.preventDefault();selectDrillTopic(topic,level);}}
function scheduleDrillTopicOnDate(selection,dateValue){
  if(!selection||!canUseCalendarAdmin())return;
  const target=new Date(dateValue),catId='drills';
  const cat=catObj(catId),defs=Object.assign({},cat.defaults||{},selection.level==='Step/Level 2/3'?{startTime:'14:00',endTime:'16:00'}:{startTime:'10:00',endTime:'12:00'});
  const [sh,sm]=(defs.startTime||'10:00').split(':').map(Number),[eh,em]=(defs.endTime||'12:00').split(':').map(Number);
  const lvl=selection.level==='Step/Level 1'?'1':'2/3';
  const ev={id:Date.now(),localOnly:true,category:catId,title:`${selection.topic} (Step/Level ${lvl})`,start:new Date(target.getFullYear(),target.getMonth(),target.getDate(),sh,sm),end:new Date(target.getFullYear(),target.getMonth(),target.getDate(),eh,em),description:defs.description||'',allDay:false,meta:{drill_level:selection.level,drill_topic:selection.topic},important:false,meetingUrl:SESSION_CONFIG.drills.meetingUrl,meetingPlatform:'Zoom'};
  state.selectedDrillTopic=null;
  showToast('Scheduling drill…','&#8987;');
  persistCreatedEvent(ev).then(()=>{SFX.play('add');showToast(`Scheduled: ${selection.topic}`,'&#128293;');renderAdmin();renderMonth();}).catch(()=>{renderAdmin();renderMonth();});
}
function handleCatDrag(e,catId){const cat=catObj(catId);if(!canUseCalendarWriteControls()||(cat&&cat.children&&cat.children.length)){state.dragEvent=null;if(e&&e.preventDefault)e.preventDefault();return false;}state.dragEvent={type:'category',catId:categoryId(catId)};e.dataTransfer.effectAllowed='copy';}
function handleDrop(e,cell){
  e.preventDefault();cell.classList.remove('drag-over');
  const target=new Date(cell.dataset.date);
  if(state.dragEvent?.type==='event'){
    if(!requireCalendarWriteControls()){state.dragEvent=null;return;}
    const ev=state.events.find(x=>String(x.id)===String(state.dragEvent.id));
    if(ev){const diff=target.getTime()-new Date(ev.start.getFullYear(),ev.start.getMonth(),ev.start.getDate()).getTime();const candidate=Object.assign({},ev,{start:new Date(ev.start.getTime()+diff),end:new Date(ev.end.getTime()+diff)});showToast('Saving move…','&#8987;');persistUpdatedEvent(candidate).then(()=>{SFX.play('drop');showToast('Moved to '+fmt(target,'agendaDate'),'&#10004;');}).catch(()=>{});}
  } else if(state.dragEvent?.type==='topic' && canUseCalendarAdmin()){
    scheduleDrillTopicOnDate({topic:state.dragEvent.topic,level:state.dragEvent.level},target);
  } else if(state.dragEvent?.type==='category'){
    if(!requireCalendarWriteControls()){state.dragEvent=null;return;}
    showNewEventModal(target, state.dragEvent.catId);
  }
  state.dragEvent=null;
}

// Event Detail
function showEventDetail(id){
  SFX.play('click');const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  closeDaySidebar();
  const cat=catObj(ev.category), col=catColor(ev.category), editable=canUseCalendarWriteControls() && (ev.localOnly || ev.writable !== false);
  const recordingHtml = renderRecordingBlock(ev);
  const schedulerActionHtml = renderSchedulerActionBlock(ev);
  document.getElementById('modalTitle').textContent=ev.title;
  document.getElementById('modalBody').innerHTML=`
    <div class="cal-detail-meta-row" style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
		      <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${col};box-shadow:0 0 8px ${col};"></span>
		      <span style="font-size:13px;opacity:0.6;">${escapeHTML(cat.label)}</span>
		      ${canUseCalendarWriteControls()?`<span class="importance-star ${ev.important?'lit':''}" onclick="toggleImportant('${escapeJS(id)}');showEventDetail('${escapeJS(id)}');" style="margin-left:auto;">${ev.important?'&#9733;':'&#9734;'}</span>`:(ev.important?'<span class="importance-star lit" style="margin-left:auto;">&#9733;</span>':'')}
		    </div>
    <div class="cal-detail-section" style="margin-bottom:10px;"><div class="cal-form-label">Date & Time</div>
      <div style="font-size:14px;">${ev.allDay?'All Day':fmt(ev.start,'time')+' - '+fmt(ev.end,'time')}</div>
      <div style="font-size:13px;opacity:0.5;">${fmt(ev.start,'full')}</div>
    </div>
    ${ev.description?`<div class="cal-detail-section" style="margin-bottom:10px;"><div class="cal-form-label">Description</div><div style="font-size:13px;opacity:0.7;">${escapeHTML(ev.description)}</div></div>`:''}
    ${ev.meta?.specialty?`<div class="cal-detail-section" style="margin-bottom:10px;"><div class="cal-form-label">Specialty</div><div style="font-size:13px;">${escapeHTML(ev.meta.specialty)}</div></div>`:''}
    ${ev.meetingUrl?`
    <div class="meeting-link-field">
      <div class="mlf-icon">${ev.meetingPlatform==='Zoom'?'&#128247;':'&#128187;'}</div>
      <div class="mlf-info"><div class="mlf-label">${escapeHTML(ev.meetingPlatform||'Meeting')}</div><div class="mlf-url">${escapeHTML(ev.meetingUrl)}</div></div>
      <a class="mlf-join" href="${escapeHTML(ev.meetingUrl)}" target="_blank">Join Now</a>
	    </div>`:''}
    ${recordingHtml}
    ${schedulerActionHtml}
    ${ev.important?'<div style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:rgba(243,213,118,0.08);border:1px solid rgba(243,213,118,0.2);border-radius:8px;margin-top:10px;font-size:12px;color:var(--gold2);">&#11088; Marked as important</div>':''}
    <div class="cal-event-actions" style="display:flex;gap:8px;margin-top:16px;">
	      ${editable?`<button class="cal-form-submit" style="background:linear-gradient(180deg,var(--blue),var(--teal2));flex:1;" onclick="showEditEventModal('${escapeJS(id)}')">Edit</button>
	      <button class="cal-form-submit" style="background:linear-gradient(180deg,var(--red),#b94444);flex:1;" onclick="deleteEvent('${escapeJS(id)}')">Delete</button>`:
	      `<button class="cal-form-submit" style="background:linear-gradient(180deg,var(--blue),var(--teal2));flex:1;" onclick="closeModal('eventModal')">Close</button>
	      <span class="cal-system-lock">${canUseCalendarWriteControls()?'System event':'Read-only'}</span>`}
    </div>`;
  document.getElementById('eventModal').classList.add('open');
  wireRecordingControls(ev);
}
function activateEventFromKey(event,id){if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();showEventDetail(id);}}
function deleteEvent(id){
  if(!requireCalendarWriteControls())return;
  const ev=state.events.find(e=>String(e.id)===String(id));
  if(!ev)return;
  if(ev.writable===false){showToast('System events cannot be deleted','&#128274;');return;}
  if(!window.confirm('Delete this event? This cannot be undone.'))return;
  showToast('Deleting…','&#8987;');
  persistDeletedEvent(id).then(()=>{state.events=state.events.filter(e=>String(e.id)!==String(id));refreshCalendarDataMarkers();closeModal('eventModal');SFX.play('click');showToast('Event deleted','&#128465;');renderCurrentView();}).catch(()=>{});
}

function renderRecordingBlock(ev) {
  if (ev.recordingUrl) {
    return `<div class="meeting-link-field" data-recording-block>
      <div class="mlf-icon">&#9658;</div>
      <div class="mlf-info"><div class="mlf-label">Recording</div><div class="mlf-url">Available after Webex processing</div></div>
      <button type="button" class="mlf-join" data-watch-recording="${escapeHTML(String(ev.id))}">Watch Recording</button>
    </div>`;
  }
  if (!isSchedulerWebexEvent(ev)) return '';
  return `<div class="meeting-link-field" data-recording-block>
    <div class="mlf-icon">&#9203;</div>
    <div class="mlf-info"><div class="mlf-label">Recording</div><div class="mlf-url">Processing after the Webex session ends</div></div>
    <button type="button" class="mlf-join" data-check-recording="${escapeHTML(String(ev.id))}">Check Recording</button>
  </div>`;
}

function renderSchedulerActionBlock(ev) {
  if (!isSchedulerAppointmentEvent(ev)) return '';
  const canManage = !!(ev.meta && (ev.meta.can_cancel || ev.meta.can_reschedule));
  return `<div class="meeting-link-field scheduler-action-field">
    <div class="mlf-icon">&#9733;</div>
    <div class="mlf-info"><div class="mlf-label">My Appointments</div><div class="mlf-url">${canManage?'Manage this appointment in Scheduler':'Open Scheduler appointment details'}</div></div>
    <a class="mlf-join" href="#scheduler" onclick="closeModal('eventModal')">Open</a>
  </div>`;
}

function wireRecordingControls(ev) {
  const watch = document.querySelector('[data-watch-recording="' + cssEscape(String(ev.id)) + '"]');
  if (watch) {
    watch.addEventListener('click', function () {
      if (ev.recordingUrl) window.open(ev.recordingUrl, '_blank', 'noopener');
    });
  }
  const check = document.querySelector('[data-check-recording="' + cssEscape(String(ev.id)) + '"]');
  if (check) {
    check.addEventListener('click', function () {
      checkSchedulerRecording(ev, check);
    });
  }
}

function checkSchedulerRecording(ev, trigger) {
  if (!ev || !ev.sourceId) return;
  const original = trigger ? trigger.textContent : '';
  if (trigger) trigger.textContent = 'Checking...';
  fetch('/api/scheduler/appointments/' + encodeURIComponent(ev.sourceId) + '/recording', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' }
  }).then(resp => resp.json().then(payload => ({ ok: resp.ok, payload }))).then(result => {
    const data = result.payload && (result.payload.data || result.payload);
    const url = data && (data.recording_url || data.playback_url || (data.recording && data.recording.playback_url));
    if (result.ok && url) {
      ev.recordingUrl = textOnly(url);
      ev.hasRecording = true;
      ev.recordingStatus = 'ready';
      showToast('Recording is ready', '&#9658;');
      showEventDetail(ev.id);
      return;
    }
    showToast('Recording is still processing', '&#9203;');
    if (trigger) trigger.textContent = original || 'Check Recording';
  }).catch(() => {
    showToast('Recording check failed', '&#9888;');
    if (trigger) trigger.textContent = original || 'Check Recording';
  });
}

function isSchedulerWebexEvent(ev) {
  const platform = String((ev && (ev.meetingPlatform || ev.meta?.meeting_provider || ev.meta?.meetingPlatform)) || '').toLowerCase();
  return !!(isSchedulerAppointmentEvent(ev) && ev.sourceId && platform.indexOf('webex') !== -1);
}

function isSchedulerAppointmentEvent(ev) {
  return !!(ev && (ev.source === 'scheduler' || ev.category === 'my-appointments' || ev.eventType === 'appointment'));
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

function showEditEventModal(id){
  if (!requireCalendarWriteControls()) return;
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  const dateVal=ev.start.getFullYear()+'-'+String(ev.start.getMonth()+1).padStart(2,'0')+'-'+String(ev.start.getDate()).padStart(2,'0');
  const timeVal=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  let cats=selectableCategories().map(c=>`<option value="${c.id}" ${c.id===categoryId(ev.category)?'selected':''}>${escapeHTML(categoryOptionLabel(c))}</option>`).join('');
  let specs=SPECIALTIES.map(s=>`<option value="${escapeHTML(s)}" ${ev.meta?.specialty===s?'selected':''}>${escapeHTML(s)}</option>`).join('');
  document.getElementById('modalTitle').textContent='Edit Event';
  document.getElementById('modalBody').innerHTML=`
    <div class="cal-form-group"><label class="cal-form-label">Title</label><input class="cal-form-input" id="editTitle" value="${escapeHTML(ev.title)}"/></div>
    <div class="cal-form-group"><label class="cal-form-label">Category</label><select class="cal-form-select" id="editCat">${cats}</select></div>
    <div class="cal-form-group"><label class="cal-form-label">Date</label><input class="cal-form-input" type="date" id="editDate" value="${dateVal}"/></div>
    <div class="cal-form-row">
      <div class="cal-form-group"><label class="cal-form-label">Start</label><input class="cal-form-input" type="time" id="editStart" value="${timeVal(ev.start)}"/></div>
      <div class="cal-form-group"><label class="cal-form-label">End</label><input class="cal-form-input" type="time" id="editEnd" value="${timeVal(ev.end)}"/></div>
    </div>
    <div class="cal-form-group" id="editSpecGroup" style="display:${categoryId(ev.category)==='clinicals'?'block':'none'}"><label class="cal-form-label">Specialty</label><select class="cal-form-select" id="editSpec">${specs}</select></div>
    <div class="cal-form-group"><label class="cal-form-label">Meeting Link</label>
      <div class="cal-form-row">
        <select class="cal-form-select" id="editMeetPlatform">
          <option value="" ${!ev.meetingPlatform?'selected':''}>None</option>
          <option value="Webex" ${ev.meetingPlatform==='Webex'||ev.meetingPlatform==='webex'?'selected':''}>Webex</option>
          <option value="Zoom" ${ev.meetingPlatform==='Zoom'||ev.meetingPlatform==='zoom'?'selected':''}>Zoom</option>
          <option value="Google Meet" ${ev.meetingPlatform==='Google Meet'||ev.meetingPlatform==='google_meet'?'selected':''}>Google Meet</option>
        </select>
        <input class="cal-form-input" id="editMeetUrl" placeholder="https://..." value="${escapeHTML(ev.meetingUrl||'')}"/>
      </div>
    </div>
    <div class="cal-form-group"><label class="cal-form-label">Notes</label><textarea class="cal-form-textarea" id="editNotes">${escapeHTML(ev.description||'')}</textarea></div>
    <div class="cal-form-group"><label class="cal-form-check"><input type="checkbox" id="editImportant" ${ev.important?'checked':''}/><span>Mark as important &#11088;</span></label></div>
    <div style="display:flex;gap:8px;">
      <button class="cal-form-submit" style="flex:2;" onclick="submitEditEvent('${escapeJS(id)}')">Save Changes</button>
      <button class="cal-form-submit" style="flex:1;background:linear-gradient(180deg,var(--red),#b94444);" onclick="deleteEvent('${escapeJS(id)}')">Delete</button>
    </div>`;
  document.getElementById('editCat').addEventListener('change',function(){document.getElementById('editSpecGroup').style.display=this.value==='clinicals'?'block':'none';});
  document.getElementById('eventModal').classList.add('open');
}

function submitEditEvent(id){
  if (!requireCalendarWriteControls()) return;
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  const [sy,sm,sd]=document.getElementById('editDate').value.split('-').map(Number);
  const [sh,smin]=document.getElementById('editStart').value.split(':').map(Number);
  const [eh,emin]=document.getElementById('editEnd').value.split(':').map(Number);
  const candidate=Object.assign({},ev,{
    title:textOnly(document.getElementById('editTitle').value.trim()||ev.title),
    category:document.getElementById('editCat').value,
    start:new Date(sy,sm-1,sd,sh,smin),end:new Date(sy,sm-1,sd,eh,emin),
    description:textOnly(document.getElementById('editNotes').value),
    important:document.getElementById('editImportant').checked,
    meetingPlatform:textOnly(document.getElementById('editMeetPlatform').value),
    meetingUrl:textOnly(document.getElementById('editMeetUrl').value),
    meta:Object.assign({},ev.meta||{})
  });
  if(candidate.category==='clinicals') candidate.meta.specialty=document.getElementById('editSpec').value;
  showToast('Saving changes…','&#8987;');persistUpdatedEvent(candidate).then(()=>{closeModal('eventModal');SFX.play('add');showToast('Event updated','&#10004;');}).catch(()=>{});
}

// New Event
function showNewEventModal(prefillDate, prefillCat){
  if (!requireCalendarWriteControls()) return;
  SFX.play('click');
  closeDaySidebar();
  const sel=prefillDate||state.selectedDate;
  const cat=prefillCat?catObj(prefillCat):null;
  const defs=cat?.defaults||{};
  let cats=selectableCategories().map(c=>`<option value="${c.id}" ${c.id===categoryId(prefillCat)?'selected':''}>${escapeHTML(categoryOptionLabel(c))}</option>`).join('');
  let specs=SPECIALTIES.map(s=>`<option value="${s}">${s}</option>`).join('');
  document.getElementById('modalTitle').textContent='New Event';
  document.getElementById('modalBody').innerHTML=`
    <div class="cal-form-group"><label class="cal-form-label">Title</label><input class="cal-form-input" id="newTitle" placeholder="Event title..." value="${prefillCat&&cat?cat.label+' Session':''}"/></div>
    <div class="cal-form-group"><label class="cal-form-label">Category</label><select class="cal-form-select" id="newCat">${cats}</select></div>
    <div class="cal-form-group"><label class="cal-form-label">Date</label><input class="cal-form-input" type="date" id="newDate" value="${sel.getFullYear()}-${String(sel.getMonth()+1).padStart(2,'0')}-${String(sel.getDate()).padStart(2,'0')}"/></div>
    <div class="cal-form-row">
      <div class="cal-form-group"><label class="cal-form-label">Start</label><input class="cal-form-input" type="time" id="newStart" value="${defs.startTime||'10:00'}"/></div>
      <div class="cal-form-group"><label class="cal-form-label">End</label><input class="cal-form-input" type="time" id="newEnd" value="${defs.endTime||'11:00'}"/></div>
    </div>
    <div class="cal-form-group" id="specGroup" style="display:${categoryId(prefillCat)==='clinicals'?'block':'none'}"><label class="cal-form-label">Specialty</label><select class="cal-form-select" id="newSpec">${specs}</select></div>
    <div class="cal-form-group"><label class="cal-form-label">Meeting Link (optional)</label>
      <div class="cal-form-row">
        <select class="cal-form-select" id="newMeetPlatform"><option value="">None</option><option value="Webex">Webex</option><option value="Zoom">Zoom</option><option value="Google Meet">Google Meet</option></select>
        <input class="cal-form-input" id="newMeetUrl" placeholder="https://..."/>
      </div>
    </div>
    <div class="cal-form-group"><label class="cal-form-label">Notes</label><textarea class="cal-form-textarea" id="newNotes" placeholder="Optional...">${defs.description||''}</textarea></div>
    <div class="cal-form-group"><label class="cal-form-check"><input type="checkbox" id="newImportant"/><span>Mark as important &#11088;</span></label></div>
    <button class="cal-form-submit" onclick="submitNew()">Create Event</button>`;
  document.getElementById('newCat').addEventListener('change',function(){
    const sc=catObj(this.value);
    document.getElementById('specGroup').style.display=this.value==='clinicals'?'block':'none';
    if(sc?.defaults){document.getElementById('newStart').value=sc.defaults.startTime||'10:00';document.getElementById('newEnd').value=sc.defaults.endTime||'11:00';document.getElementById('newNotes').value=sc.defaults.description||'';}
  });
  document.getElementById('eventModal').classList.add('open');
}
function submitNew(){
  if (!requireCalendarWriteControls()) return;
  const title=document.getElementById('newTitle').value.trim();
  if(!title){showToast('Enter a title','&#9888;');return;}
  const [sy,sm,sd]=document.getElementById('newDate').value.split('-').map(Number);
  const [sh,smin]=document.getElementById('newStart').value.split(':').map(Number);
  const [eh,emin]=document.getElementById('newEnd').value.split(':').map(Number);
  const cat=document.getElementById('newCat').value, notes=document.getElementById('newNotes').value;
  const imp=document.getElementById('newImportant').checked;
  const meta=cat==='clinicals'?{specialty:document.getElementById('newSpec').value}:{};
  const meetUrl=document.getElementById('newMeetUrl').value;
  const meetPlat=document.getElementById('newMeetPlatform').value;
  const ev={id:Date.now(),localOnly:true,category:cat,title:textOnly(title),start:new Date(sy,sm-1,sd,sh,smin),end:new Date(sy,sm-1,sd,eh,emin),description:textOnly(notes),allDay:false,meta,important:imp,meetingUrl:textOnly(meetUrl),meetingPlatform:textOnly(meetPlat)};
  showToast('Creating event…','&#8987;');persistCreatedEvent(ev).then(()=>{closeModal('eventModal');SFX.play('add');showToast('Event created!','&#10024;');}).catch(()=>{});
}

// Sync
function showSync(){
  SFX.play('click');
  document.getElementById('syncBody').innerHTML=`
    <p style="font-size:13px;opacity:0.5;margin-bottom:14px;">Export the Matrix calendar to your phone, laptop, Google Calendar, or Apple Calendar.</p>
    <div style="display:flex;flex-direction:column;gap:8px;">
    ${[{icon:'G',bg:'linear-gradient(135deg,#4285f4,#34a853)',name:'Google Calendar',sub:'Download .ics, then import into Google Calendar'},{icon:'&#63743;',bg:'linear-gradient(135deg,#333,#555)',name:'Apple Calendar',sub:'Download .ics, then open on macOS or iOS'},{icon:'&#128197;',bg:'linear-gradient(135deg,var(--blue),var(--teal2))',name:'Export .ics',sub:'Download all visible Matrix events'}].map(s=>`
    <div style="display:flex;gap:12px;align-items:center;padding:12px;border-radius:var(--radius);background:rgba(255,255,255,0.03);cursor:pointer;border:1px solid rgba(255,255,255,0.05);transition:var(--transition);" onclick="downloadICS()">
      <div style="width:40px;height:40px;border-radius:8px;display:grid;place-items:center;font-size:18px;background:${s.bg};">${s.icon}</div>
      <div><div style="font-weight:600;font-size:14px;">${s.name}</div><div style="font-size:11px;opacity:0.4;">${s.sub}</div></div>
    </div>`).join('')}</div>
    <div style="margin-top:16px;padding:12px;background:rgba(14,117,168,0.08);border:1px solid rgba(14,117,168,0.15);border-radius:var(--radius);font-size:12px;color:rgba(255,255,255,0.45);">
      <strong style="color:var(--blue2);">&#128161; Live Export:</strong> This download is generated from the events currently loaded in Matrix. Two-way OAuth sync still needs a dedicated server-side connector.
    </div>`;
  document.getElementById('syncModal').classList.add('open');
}

function icsDate(d){
  const p=n=>String(n).padStart(2,'0');
  return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+'T'+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+'Z';
}
function icsText(v){
  return String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function downloadICS(){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MissionMed Matrix//Calendar v4//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  filtered().forEach(ev=>{
    lines.push('BEGIN:VEVENT');
    lines.push('UID:missionmed-matrix-'+String(ev.id)+'@missionmedinstitute.com');
    lines.push('DTSTAMP:'+icsDate(new Date()));
    if(ev.allDay){
      const p=n=>String(n).padStart(2,'0');
      lines.push('DTSTART;VALUE=DATE:'+ev.start.getFullYear()+p(ev.start.getMonth()+1)+p(ev.start.getDate()));
    } else {
      lines.push('DTSTART:'+icsDate(ev.start));
      lines.push('DTEND:'+icsDate(ev.end));
    }
    lines.push('SUMMARY:'+icsText(ev.title));
    if(ev.description) lines.push('DESCRIPTION:'+icsText(ev.description+(ev.meetingUrl?'\\n'+ev.meetingUrl:'')));
    if(ev.meetingUrl) lines.push('URL:'+icsText(ev.meetingUrl));
    lines.push('CATEGORIES:'+icsText(catObj(ev.category).label));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='missionmed-matrix-calendar.ics';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);
  showToast('Calendar export ready','&#128197;');
}

// Day Sidebar
function openDaySidebar(ds){
  const d=new Date(ds);state.selectedDate=d;const evts=eventsOn(d);
  const sc=document.getElementById('sidebarContent');
  let h=`<h3>${fmt(d,'full')}</h3>`;
  if(!evts.length) h+='<p style="opacity:0.35;margin-top:14px;">No events scheduled.</p>';
  else evts.forEach(ev=>{
    const col=catColor(ev.category),cat=catObj(ev.category);
    h+=`<div class="cal-agenda-item" role="button" tabindex="0" style="margin-top:5px;" onclick="showEventDetail('${escapeJS(ev.id)}')" onkeydown="activateEventFromKey(event,'${escapeJS(ev.id)}')">
      <div class="cal-agenda-color-bar" style="background:${col}"></div>
	      <div class="cal-agenda-content"><div class="cal-agenda-title">${cat.icon} ${escapeHTML(ev.title)}${ev.important?'<span class="importance-star lit" style="width:16px;height:16px;font-size:9px;">&#9733;</span>':''}</div>
	      <div style="font-size:12px;opacity:0.5;">${ev.allDay?'All Day':fmt(ev.start,'time')+' - '+fmt(ev.end,'time')}</div>
	      ${ev.meetingUrl?`<a class="todo-meeting-link" href="${escapeHTML(ev.meetingUrl)}" target="_blank" onclick="event.stopPropagation()">&#128247; Join ${escapeHTML(ev.meetingPlatform||'')}</a>`:''}</div>
	      ${canUseCalendarWriteControls()?`<span class="importance-star ${ev.important?'lit':''}" onclick="event.stopPropagation();toggleImportant('${escapeJS(ev.id)}');openDaySidebar('${escapeJS(ds)}');">${ev.important?'&#9733;':'&#9734;'}</span>`:''}
	    </div>`;
	  });
	  if (canUseCalendarWriteControls()) h+=`<button class="cal-add-btn" style="margin-top:14px;width:100%;justify-content:center;" onclick="showNewEventModal()">+ Add Event</button>`;
	  sc.innerHTML=h;document.getElementById('sidebar').classList.add('open');
}

// View
function setView(v){SFX.play('nav');state.view=v;document.querySelectorAll('.cal-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));['month','week','day','agenda'].forEach(x=>document.getElementById('view'+x.charAt(0).toUpperCase()+x.slice(1)).style.display=x===v?'':'none');renderCurrentView();if(classicCalendarCore)classicCalendarCore.setView(v);}
function renderCurrentView(){if(state.view==='month')renderMonth();else if(state.view==='week')renderWeek();else if(state.view==='day')renderDay();else renderAgenda();}
function navigate(dir){SFX.play('nav');const d=state.currentDate;if(state.view==='month')d.setMonth(d.getMonth()+dir);else if(state.view==='week')d.setDate(d.getDate()+dir*7);else if(state.view==='day'){state.selectedDate.setDate(state.selectedDate.getDate()+dir);state.currentDate=new Date(state.selectedDate);}else d.setMonth(d.getMonth()+dir);renderCurrentView();if(classicCalendarCore)classicCalendarCore.navigate(dir);}

// Init


// Matrix live wiring adapter
let matrixApp = null;
let liveLoadStarted = false;
let classicCalendarCore = null;
let classicCalendarUnsubscribe = null;
const MATRIX_CATEGORY_TO_PROTO = {
  drill_step1: 'drills',
  drill_step23: 'drills',
  mr_session: 'mission-residency',
  mr_class_schedule: 'mission-residency',
  mock_interview: 'mock-interviews',
  nrmp_date: 'nrmp',
  deadline: 'nrmp',
  rotation: 'clinicals',
  arena_event: 'arena',
  study_block: 'study',
  appointment: 'my-appointments',
  exam: 'study',
  milestone: 'nrmp',
  general: 'study',
  custom: 'study'
};
const PROTO_CATEGORY_TO_MATRIX = {
  examprep: 'study_block',
  drills: 'drill_step1',
  'mission-residency': 'mr_session',
  'mr-session-a': 'mr_session',
  'mr-session-b': 'mr_session',
  'mr-session-c': 'mr_session',
  'mr-session-d': 'mr_session',
  'mr-session-e': 'mr_session',
  'mock-interviews': 'mock_interview',
  nrmp: 'nrmp_date',
  clinicals: 'rotation',
  arena: 'arena_event',
  study: 'study_block',
  'my-appointments': 'appointment'
};
function textOnly(value) {
  return String(value == null ? '' : value).replace(/[<>]/g, '');
}
function attrText(value) {
  return textOnly(value).replace(/"/g, '&quot;');
}
function canUseCalendarAdmin() {
  const app = matrixApp || window.MMED_OS || {};
  const profile = (app.state && app.state.profile) || app.profile || {};
  return profile.is_admin === true || profile.is_admin === 1 || profile.is_admin === '1';
}
function lockCalendarAdminControls() {
  state.adminOpen = false;
  const toggle = document.getElementById('adminToggle');
  if (toggle) toggle.remove();
  const panel = document.getElementById('adminPanel');
  if (panel) {
    panel.classList.remove('show');
    panel.hidden = true;
	  panel.innerHTML = '';
  }
}
function canUseCalendarWriteControls() {
  return canUseCalendarAdmin();
}
function requireCalendarWriteControls() {
  if (canUseCalendarWriteControls()) return true;
  showToast('Calendar editing is available to admins only.', '&#128274;');
  return false;
}
function lockStudentWriteControls() {
  if (canUseCalendarWriteControls()) return;
  const add = document.getElementById('addBtn');
  if (add) add.remove();
  document.querySelectorAll('.add-cat-btn,.todo-add-row').forEach(el=>el.remove());
  document.querySelectorAll('.cat-filter').forEach(el=>{
    el.removeAttribute('draggable');
    el.classList.add('is-readonly');
  });
}
function localDateTime(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':00';
}
function matrixCategory(raw, title, sourceId) {
  raw = String(raw || 'general').toLowerCase();
  title = String(title || '');
  sourceId = String(sourceId || '');
  if (raw === 'appointment') return 'my-appointments';
  if ((raw === 'mr_session' || raw === 'mr_class_schedule') && (/Session\s*[A-E]\b|Class Schedule|Live group coaching/i.test(title) || sourceId.indexOf('session_group_') === 0)) return missionResidencySessionCategory(title, sourceId);
  return MATRIX_CATEGORY_TO_PROTO[raw] || 'study';
}
function explicitPrototypeCategory(raw) {
  raw = String(raw || '').toLowerCase();
  return CATEGORIES.some(c => c.id === raw) ? raw : '';
}
function eventChipClasses(ev) {
  let cls = ev.important ? 'important' : '';
  if (isSchedulerAppointmentEvent(ev)) cls += ' is-my-appointment';
  if (ev.meta && ev.meta.match_2027) cls += ' is-match-event';
  if (ev.meta && ev.meta.match_day) cls += ' is-match-day';
  return cls.trim();
}
function liveEventMeta(e) {
  if (e && typeof e.meta === 'object' && e.meta) return e.meta;
  if (e && typeof e.meta_json === 'object' && e.meta_json) return e.meta_json;
  if (e && typeof e.meta_json === 'string' && e.meta_json) {
    try { return JSON.parse(e.meta_json) || {}; } catch (err) { return {}; }
  }
  return {};
}
function normalizeLiveEvent(e) {
  e = e || {};
  const meta = liveEventMeta(e);
  const start = parseCalendarDate(e.start_at || e.start, new Date());
  let end = e.end_at || e.end ? parseCalendarDate(e.end_at || e.end, new Date(start.getTime() + 60 * 60000)) : new Date(start.getTime() + 60 * 60000);
  if (isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 60 * 60000);
  const rawCat = e.event_type || e.category || 'general';
  const rawCatKey = String(rawCat).toLowerCase();
  const explicitCategory = explicitPrototypeCategory(e.category);
  const sourceId = e.source_id || e.sourceId || e.appointment_id || e.appointmentId || '';
  const source = String(e.source || '').toLowerCase();
  const schedulerAppointment = source === 'scheduler' || rawCatKey === 'appointment';
  const normalizedSource = schedulerAppointment ? 'scheduler' : textOnly(e.source || '');
  const globalEvent = Number(e.user_id || 0) === 0;
  const systemEvent = normalizedSource === 'system';
  const meetingUrl = textOnly(e.meeting_url || e.join_url || e.joinUrl || (e.join_button && e.join_button.url) || meta.meeting_url || meta.join_url || meta.classroom_url || '');
  const meetingPlatform = textOnly(e.meeting_platform || e.meeting_provider || meta.meeting_platform || meta.meeting_provider || (meetingUrl.toLowerCase().indexOf('webex') !== -1 ? 'Webex' : ''));
  return {
    id: e.id,
    category: schedulerAppointment ? 'my-appointments' : (explicitCategory || matrixCategory(rawCat, e.title, sourceId)),
    title: textOnly(e.title || 'Untitled event'),
    start,
    end,
    description: textOnly(e.description || e.content || meta.description || ''),
    allDay: !!(e.all_day || e.allDay),
    meta,
    source: normalizedSource,
    eventType: textOnly(rawCat),
    sourceId: textOnly(sourceId),
    userId: e.user_id || e.userId || null,
    writable: schedulerAppointment ? false : (canUseCalendarAdmin() ? !systemEvent : !(globalEvent || systemEvent)),
    important: !!(schedulerAppointment || meta.important || meta.match_2027 || meta.match_day || rawCatKey === 'deadline' || /MATCH DAY|SOAP|deadline|certification/i.test(e.title || '')),
    meetingUrl,
    meetingPlatform,
    hasRecording: !!(e.has_recording || meta.has_recording),
    recordingStatus: textOnly(e.recording_status || meta.recording_status || ''),
    recordingUrl: textOnly(e.recording_url || meta.recording_url || '')
  };
}
function normalizeLiveTodo(t) {
  return {
    id: t.id,
    text: textOnly(t.title || t.text || 'Task'),
    done: !!(t.completed || t.done),
    priority: (t.priority === 'high' || t.priority === 'low') ? t.priority : (t.priority === 'medium' ? 'med' : (t.priority || 'med')),
    date: textOnly(t.due_date || t.date || ''),
    notes: textOnly(t.notes || ''),
    meetingUrl: textOnly(t.meeting_url || ''),
    meetingPlatform: textOnly(t.meeting_platform || '')
  };
}
function seedPrototypeIfNeeded() {
  if (state.seeded) return;
  state.events = [];
  seedEvents();
  state.seeded = true;
}
function calendarRoot() {
  return document.querySelector('.cal-matrix-prototype');
}
function setCalendarDataMarker(kind, source, count) {
  const root = calendarRoot();
  state.dataSources[kind] = source;
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (root) {
    root.setAttribute('data-calendar-' + kind + '-source', source);
    root.setAttribute('data-calendar-' + kind + '-count', String(normalizedCount));
  }
  logCalendarDataSource(kind, source, normalizedCount);
}
function refreshCalendarDataMarkers() {
  setCalendarDataMarker('events', state.dataSources.events || 'loading', state.events.length);
  setCalendarDataMarker('todos', state.dataSources.todos || 'loading', state.todos.length);
}
function logCalendarDataSource(kind, source, count) {
  const key = kind + ':' + source + ':' + count;
  if (state.sourceLog[kind] === key) return;
  state.sourceLog[kind] = key;
  if (window.console && typeof window.console.info === 'function') {
    window.console.info('[Matrix Calendar] ' + kind + ' source=' + source + ' count=' + count);
  }
}
function calendarEventsSource() {
  return state.dataSources.events || 'loading';
}
function calendarEventsArePending() {
  return calendarEventsSource() === 'loading';
}
function calendarEventsUnavailable() {
  return calendarEventsSource() === 'error';
}
function calendarStatusHtml() {
  if (calendarEventsArePending()) {
    return '<div class="cal-empty-state cal-live-state" data-calendar-status="loading"><strong>Loading calendar...</strong><br><span>Fetching live Matrix events.</span></div>';
  }
  if (calendarEventsUnavailable()) {
    return '<div class="cal-empty-state cal-live-state" data-calendar-status="error"><strong>Calendar unavailable.</strong><br><span>Live Matrix events could not be loaded.</span></div>';
  }
  return '';
}
function parseCalendarDate(value, fallback) {
  if (window.MMEDCalendarCore && typeof window.MMEDCalendarCore.parseDate === 'function') {
    return window.MMEDCalendarCore.parseDate(value, fallback);
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? fallback : value;
  const raw = String(value || '').trim();
  if (!raw) return fallback || new Date();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const localDateTimeOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localDateTimeOnly) {
    return new Date(
      Number(localDateTimeOnly[1]),
      Number(localDateTimeOnly[2]) - 1,
      Number(localDateTimeOnly[3]),
      Number(localDateTimeOnly[4]),
      Number(localDateTimeOnly[5]),
      Number(localDateTimeOnly[6] || 0)
    );
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? (fallback || new Date()) : parsed;
}
function coreEventToClassic(event) {
  const classic = normalizeLiveEvent({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    description: event.description,
    event_type: event.eventType,
    category: event.category,
    source: event.source,
    sourceId: event.sourceId,
    userId: event.userId,
    meta: event.meta,
    joinUrl: event.joinUrl,
    meeting_platform: event.meetingPlatform,
    recording_url: event.replayUrl,
    recording_status: event.recordingStatus
  });
  classic.writable = event.writable;
  classic.important = event.important;
  return classic;
}
function coreTodoToClassic(todo) {
  return normalizeLiveTodo({ id: todo.id, title: todo.title, completed: todo.completed, priority: todo.priority, due_date: todo.dueDate, notes: todo.notes, meeting_url: todo.meetingUrl, meeting_platform: todo.meetingPlatform });
}
function syncClassicFromCore(coreState) {
  state.events = (coreState.events || []).map(coreEventToClassic);
  state.todos = (coreState.todos || []).map(coreTodoToClassic);
  state.seeded = true;
  setCalendarDataMarker('events', coreState.wpStatus === 'error' ? 'error' : (coreState.wpStatus === 'loading' ? 'loading' : (state.events.length ? 'live' : 'live-empty')), state.events.length);
  setCalendarDataMarker('todos', coreState.todosStatus === 'error' ? 'error' : (coreState.todosStatus === 'loading' ? 'loading' : (state.todos.length ? 'live' : 'live-empty')), state.todos.length);
  if (calendarRoot()) {
    renderCurrentView();
    renderTodos();
  }
}
function ensureSharedCalendarCore() {
  if (!window.MMEDCalendarCore || typeof window.MMEDCalendarCore.create !== 'function') throw new Error('Shared Calendar core unavailable');
  if (!classicCalendarCore) {
    classicCalendarCore = window.MMEDCalendarCore.create(matrixApp);
    classicCalendarUnsubscribe = classicCalendarCore.subscribe(syncClassicFromCore);
  }
  return classicCalendarCore;
}
function loadLiveCalendarData() {
  if (liveLoadStarted) return;
  liveLoadStarted = true;
  try {
    const core = ensureSharedCalendarCore();
    core.setView(state.view);
    core.start().catch(() => { showToast('Live calendar feed unavailable.', '&#9888;'); });
  } catch (error) {
    setCalendarDataMarker('events', 'error', 0);
    setCalendarDataMarker('todos', 'error', 0);
    renderCurrentView();
  }
}
function canPersistEvent(ev) {
  return !!(ev && !ev.localOnly && ev.writable !== false && String(ev.id).indexOf('local-') !== 0);
}
function persistCreatedEvent(ev) {
  const candidate = Object.assign({}, ev, { eventType: (ev.meta && ev.meta.drill_level === 'Step/Level 2/3') ? 'drill_step23' : (PROTO_CATEGORY_TO_MATRIX[ev.category] || 'custom'), joinUrl: ev.meetingUrl || '', audience: canUseCalendarAdmin() ? 'all_students' : '' });
  return ensureSharedCalendarCore().createEvent(candidate).then(coreEventToClassic).catch(error=>{showToast('Event was not saved. Nothing changed.', '&#9888;');throw error;});
}
function persistUpdatedEvent(ev) {
  if (!canPersistEvent(ev)) return Promise.reject(new Error('Event is read-only'));
  const original = ensureSharedCalendarCore().state.events.find(item => String(item.id) === String(ev.id));
  if (!original) return Promise.reject(new Error('Event is unavailable'));
  const candidate = Object.assign({}, original, { title: ev.title, start: ev.start, end: ev.end, allDay: ev.allDay, description: ev.description, category: ev.category, joinUrl: ev.meetingUrl || '', important: !!ev.important, meta: ev.meta || {} });
  return ensureSharedCalendarCore().updateEvent(candidate).then(coreEventToClassic).catch(error=>{showToast('Event was not updated. Nothing changed.', '&#9888;');throw error;});
}
function persistDeletedEvent(id) {
  if (String(id).indexOf('local-') === 0) return Promise.resolve();
  const original = ensureSharedCalendarCore().state.events.find(item => String(item.id) === String(id));
  if (!original) return Promise.reject(new Error('Event is unavailable'));
  return ensureSharedCalendarCore().deleteEvent(original).catch(error=>{showToast('Event was not deleted. Nothing changed.', '&#9888;');throw error;});
}
function persistTodoCreate(todo) {
  return ensureSharedCalendarCore().createTodo(todo);
}
function persistTodoUpdate(todo) {
  if (todo.localOnly || String(todo.id).indexOf('local-') === 0) return Promise.resolve();
  return ensureSharedCalendarCore().updateTodo(todo);
}
function persistTodoDelete(id) {
  if (String(id).indexOf('local-') === 0) return;
  const original = ensureSharedCalendarCore().state.todos.find(todo => String(todo.id) === String(id));
  if (original) return ensureSharedCalendarCore().deleteTodo(original);
}

function activateCalendarAppMode() {
  if (window.MMEDMatrixAppMode && typeof window.MMEDMatrixAppMode.activate === 'function') {
    window.MMEDMatrixAppMode.activate('calendar');
    return;
  }

  if (document.body) {
    document.body.classList.add('matrix-app-mode', 'matrix-app-mode-calendar');
    document.body.setAttribute('data-matrix-app-mode', 'calendar');
  }
}

function deactivateCalendarAppMode() {
  if (window.MMEDMatrixAppMode && typeof window.MMEDMatrixAppMode.deactivate === 'function') {
    window.MMEDMatrixAppMode.deactivate('calendar');
    return;
  }

  if (document.body) {
    document.body.classList.remove('matrix-app-mode', 'matrix-app-mode-calendar');
    document.body.removeAttribute('data-matrix-app-mode');
  }
}

function returnToMatrixDashboard() {
  deactivateCalendarAppMode();
  if (window.location.hash !== '#dashboard') {
    window.location.hash = '#dashboard';
  }
}

function ensureDashboardReturnButton() {
  const titleRow = document.querySelector('.cal-title-row');
  if (!titleRow || titleRow.querySelector('.cal-dashboard-return')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cal-dashboard-return';
  button.setAttribute('aria-label', 'Return to Matrix Dashboard');
  button.innerHTML = '<span class="cal-dashboard-return-icon" aria-hidden="true">&#8962;</span><span>Dashboard</span>';
  button.addEventListener('click', function () {
    SFX.play('nav');
    returnToMatrixDashboard();
  });
  titleRow.insertBefore(button, titleRow.firstChild);
}



function initPrototypeCalendar() {
  liveLoadStarted = false;
  state.events = [];
  state.todos = [];
  state.todoNextId = 1;
  state.dataSources.events = 'loading';
  state.dataSources.todos = 'loading';
	initBackground();refreshCalendarDataMarkers();placeAdminPanelInSidebar();renderFilters();renderTodos();renderAdmin();renderMonth();loadLiveCalendarData();
  lockStudentWriteControls();

  document.querySelectorAll('.cal-nav-btn').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  document.getElementById('prevBtn').addEventListener('click',()=>navigate(-1));
  document.getElementById('nextBtn').addEventListener('click',()=>navigate(1));
  document.getElementById('todayBtn').addEventListener('click',()=>{SFX.play('click');state.currentDate=new Date();state.selectedDate=new Date();renderCurrentView();if(classicCalendarCore)classicCalendarCore.today();});
  const addBtn = document.getElementById('addBtn');
  if (addBtn && canUseCalendarWriteControls()) addBtn.addEventListener('click',()=>showNewEventModal());
  document.getElementById('syncBtn').addEventListener('click',showSync);
  const adminToggle = document.getElementById('adminToggle');
  if (adminToggle && canUseCalendarAdmin()) {
    adminToggle.addEventListener('click',()=>{SFX.play('click');state.adminOpen=!state.adminOpen;document.getElementById('adminPanel').classList.toggle('show',state.adminOpen);});
  } else {
    lockCalendarAdminControls();
  }
  document.getElementById('modalClose').addEventListener('click',()=>closeModal('eventModal'));
  document.getElementById('syncClose').addEventListener('click',()=>closeModal('syncModal'));
  document.getElementById('todoModalClose').addEventListener('click',()=>closeModal('todoModal'));
  document.getElementById('catModalClose').addEventListener('click',()=>closeModal('catModal'));
  document.getElementById('sidebarClose').addEventListener('click',()=>document.getElementById('sidebar').classList.remove('open'));
  ['eventModal','syncModal','todoModal','catModal'].forEach(id=>{document.getElementById(id).addEventListener('click',function(e){if(e.target===this)closeModal(id);});});
  document.getElementById('panelCollapseBtn').addEventListener('click',togglePanel);

  // Collapsed tabs
  document.querySelectorAll('.ptab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      SFX.play('click');state.panelCollapsed=false;
      document.getElementById('leftPanel').classList.remove('collapsed');
      document.getElementById('panelCollapseBtn').innerHTML='&#9664;';
      const s=tab.dataset.section;
      setTimeout(()=>{
        if(s==='todos') document.getElementById('todoSection').scrollIntoView({behavior:'smooth'});
        else if(s==='notifs') { setView('agenda'); }
        else document.getElementById('catSection').scrollIntoView({behavior:'smooth'});
      },100);
    });
  });
}

function renderCalendarPrototype(app) {
  matrixApp = app;
  const content = document.getElementById('sos-content');
  if (!content) return;
  activateCalendarAppMode();
  content.innerHTML = '<section class="sos-page cal-matrix-prototype" data-calendar-events-source="loading" data-calendar-events-count="0" data-calendar-todos-source="loading" data-calendar-todos-count="0">' + CALENDAR_PROTOTYPE_HTML + '</section>';
  ensureDashboardReturnButton();
  initPrototypeCalendar();
}

function unmountCalendarPrototype() {
  if (classicCalendarUnsubscribe) classicCalendarUnsubscribe();
  classicCalendarUnsubscribe = null;
  classicCalendarCore = null;
  liveLoadStarted = false;
  deactivateCalendarAppMode();
  teardownBackground();
  const content = document.getElementById('sos-content');
  if (content && content.querySelector('.cal-matrix-prototype')) content.innerHTML = '';
}

function bootMatrixCalendar() {
  let tries = 0;
  const timer = setInterval(function () {
    tries++;
    const app = window.MMED_OS;
    if (!app && tries < 60) return;
    clearInterval(timer);
    if (!app || !app.render) return;
    if (!app.state) app.state = {};
    if (!app.state.calendar) app.state.calendar = { month: new Date(), selectedDate: new Date() };
    app.render.calendar = function () { renderCalendarPrototype(app); };
    if (app.state.route === 'calendar' && !document.querySelector('.cal-matrix-prototype')) {
      renderCalendarPrototype(app);
    }
  }, 100);
}

window.showAddCategoryModal = showAddCategoryModal;
window.submitAddCategory = submitAddCategory;
window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.showTodoDetail = showTodoDetail;
window.saveTodoDetail = saveTodoDetail;
window.deleteTodo = deleteTodo;
window.togglePanel = togglePanel;
window.handleDragStart = handleDragStart;
window.handleTopicDrag = handleTopicDrag;
window.handleCatDrag = handleCatDrag;
window.handleDrop = handleDrop;
window.showEventDetail = showEventDetail;
window.activateEventFromKey = activateEventFromKey;
window.deleteEvent = deleteEvent;
window.showEditEventModal = showEditEventModal;
window.submitEditEvent = submitEditEvent;
window.showNewEventModal = showNewEventModal;
window.submitNew = submitNew;
window.downloadICS = downloadICS;
window.openDaySidebar = openDaySidebar;
window.toggleImportant = toggleImportant;
window.closeModal = closeModal;
window.showToast = showToast;
window.MMEDCalendarV4 = { mount: renderCalendarPrototype, unmount: unmountCalendarPrototype };

bootMatrixCalendar();


})();
