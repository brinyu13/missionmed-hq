import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKeynoteClassicScene} from '../web/js/uxr-002/board-renderer.js';
import {applyThemeToScene,THEME_DEFINITIONS} from '../web/js/uxr-002/themes.js';
import {serializeLocked407FPortableSvg} from '../web/js/uxr-002/locked-407f-export.js';
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
