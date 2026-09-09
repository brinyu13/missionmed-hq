import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKeynoteClassicScene} from '../web/js/uxr-002/board-renderer.js';
import {applyThemeToScene,THEME_DEFINITIONS} from '../web/js/uxr-002/themes.js';
import {locked407FMilestoneGeometry,serializeLocked407FPortableSvg} from '../web/js/uxr-002/locked-407f-export.js';
const source=()=>buildKeynoteClassicScene({studentProfile:{fullName:'Synthetic Theme Check'},events:[{id:'education-1',title:'Medical school',categoryId:'education',eventType:'duration',startDate:'2016-09',endDate:'2022-06',visibilityState:'INTERVIEWER_SAFE'}]},{currentMonth:'2026-07'});
const board=svg=>svg.match(/<(?:radialGradient|linearGradient|pattern) id="d1406-board"[\s\S]*?<\/(?:radialGradient|linearGradient|pattern)>/)[0];
test('Navy portable projection uses its accepted radial background and retains the scene facts/geometry',()=>{
 const s=applyThemeToScene(source(),'mission-navy'),before=structuredClone(s),svg=serializeLocked407FPortableSvg(s),b=board(svg),theme=THEME_DEFINITIONS.find(t=>t.id==='mission-navy');
 assert.match(b,/<radialGradient/);assert.ok(b.includes(theme.board.start));assert.ok(b.includes(theme.board.end));
 assert.doesNotMatch(b,/founder-board-template|<image/);assert.deepEqual(s,before);assert.match(svg,/Medical school/);
});
test('Navy portable board text uses the accepted light ink outside event fills',()=>{
 const s=applyThemeToScene(buildKeynoteClassicScene({studentProfile:{fullName:'Synthetic Theme Check'},events:[
  {id:'work-1',title:'A deliberately long outside label',siteName:'Synthetic Hospital',categoryId:'work',eventType:'duration',startDate:'2024-01',endDate:'2024-01',visibilityState:'INTERVIEWER_SAFE'},
  {id:'move-1',title:'Relocated to USA',categoryId:'personal',eventType:'milestone',startDate:'2023-06',visibilityState:'INTERVIEWER_SAFE'}
 ]},{currentMonth:'2026-07'}),'mission-navy');
 const svg=serializeLocked407FPortableSvg(s),ink=THEME_DEFINITIONS.find(t=>t.id==='mission-navy').ink;
 for(const role of ['caption','site','outside-arrow','flag-label','flag-date','interview-date']){
  assert.match(svg,new RegExp(`data-board-ink-role="${role}"[^>]*fill="${ink}"`));
 }
});
test('automatic milestones that cross the fixed title plaque clear the title and year ribbon',()=>{
 const s=applyThemeToScene(buildKeynoteClassicScene({studentProfile:{fullName:'Dr. Maya Chen'},events:[
  {id:'span',title:'Synthetic Research Fellowship',categoryId:'research',eventType:'duration',startDate:'2021-07',endDate:'2023-06',visibilityState:'INTERVIEWER_SAFE'},
  {id:'award',title:"Synthetic Dean's Award",categoryId:'personal',eventType:'milestone',startDate:'2024-05',visibilityState:'INTERVIEWER_SAFE'}
 ]},{currentMonth:'2026-07'}),'mission-navy');
 s.founderPresentation={...(s.founderPresentation||{}),axis:{mode:'manual',startYear:2020,endYear:2026,includeFuture:true,segmentWeights:[
  {id:'2020',weight:1},{id:'2021',weight:1.1},{id:'2022',weight:1},
  {id:'2023',weight:1},{id:'2024',weight:1.1},{id:'2025',weight:1},{id:'2026',weight:1},{id:'FUTURE',weight:.8}
 ]}};
 const placement=locked407FMilestoneGeometry(s,'award');
 assert.equal(placement.y,179,'the automatic flag starts below the axis hit area');
 assert.equal(placement.axisBottom,161,'the pole anchors to the bottom of the year ribbon');
 assert.ok(placement.y>placement.axisBottom,'the flag body does not cover a year label');
 const svg=serializeLocked407FPortableSvg(s);
 assert.match(svg,/data-event-id="award"[\s\S]*?<line[^>]*y1="179"[^>]*y2="161"/);
 assert.match(svg,/data-event-id="award"[\s\S]*?<text[^>]*data-board-ink-role="flag-label"[^>]*y="201"/);
});
test('default Founder board remains its original texture, including at zero events',()=>{
 for(const events of [undefined,[]]){
  const s=events?buildKeynoteClassicScene({studentProfile:{},events},{currentMonth:'2026-07'}):source();
  assert.match(board(serializeLocked407FPortableSvg(s)),/data-founder-board-template="true"/);
 }
});
test('explicit advanced color still takes precedence over the Navy theme',()=>{
 const s=applyThemeToScene(source(),'mission-navy');s.advancedProjection={background:{kind:'color',color:'#123456'}};
 const b=board(serializeLocked407FPortableSvg(s));assert.match(b,/#123456/);assert.doesNotMatch(b,/#1B2A4A|radialGradient/);
});
test('all other accepted portable theme backgrounds retain their distinct definitions',()=>{
 const values=THEME_DEFINITIONS.map(t=>board(serializeLocked407FPortableSvg(applyThemeToScene(source(),t.id))));
 assert.equal(new Set(values).size,THEME_DEFINITIONS.length);
});
