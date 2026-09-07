import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {serializeFounderPresentation,serializeFounderScene} from '../web/js/presentation/founder-presentation-serializer.js';
import {FOUNDER_COLOR_KEY_ROWS} from '../web/js/presentation/founder-keynote-contract.js';
import {parsePresentationXml,xmlNodes,xmlText} from '../web/js/presentation/presentation-xml.js';
import {createEditableFounderPptx} from '../web/js/presentation/editable-pptx.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-founder-reanchor-015/synthetic-founder-geometry.json',import.meta.url),'utf8'));
const options={scope:'INTERVIEWER_SAFE',currentMonth:'2027-01'};
const education=fixture.events.find(event=>event.categoryId==='education');
const render=(events,changes={})=>serializeFounderPresentation({...structuredClone(fixture),events:structuredClone(events),...changes},options);
const treeOf=svg=>parsePresentationXml(svg);
function arrowColors(svg,id){
  const tree=treeOf(svg),event=xmlNodes(tree,node=>node.attrs['data-event-id']===id&&node.attrs['data-event-kind']==='arrow')[0];
  assert.ok(event,'a genuine duration arrow remains');
  const path=xmlNodes(event,node=>node.attrs['data-continuous-duration-arrow']==='true')[0];
  const gradientID=path.attrs.fill.match(/^url\(#(.+)\)$/)[1];
  const gradient=xmlNodes(tree,node=>node.tag==='linearGradient'&&node.attrs.id===gradientID)[0];
  return xmlNodes(gradient,node=>node.tag==='stop').slice(1).map(node=>node.attrs['stop-color']);
}
function keyRows(svg){return xmlNodes(treeOf(svg),node=>node.attrs['data-color-key-row']!==undefined);}
function rowColor(row){return xmlNodes(row,node=>node.tag==='rect')[0].attrs.fill;}

test('education-only chronology keeps its dates and own color with a truthful supplemental key',()=>{
  const doc={...structuredClone(fixture),events:[structuredClone(education)]},before=JSON.stringify(doc);
  const {svg,scene}=serializeFounderPresentation(doc,options);
  assert.deepEqual(arrowColors(svg,education.id),['#2C6E8F','#2C6E8F']);
  assert.deepEqual(scene.arrows.map(a=>[a.categoryId,a.startMonth,a.endMonth]),[['education',education.startDate,education.endDate]]);
  assert.equal(JSON.stringify(doc),before);
  const rows=keyRows(svg);assert.equal(rows.length,7);
  assert.deepEqual(rows.slice(0,6).map(row=>row.attrs['data-category-id']),FOUNDER_COLOR_KEY_ROWS.map(row=>row.id));
  assert.equal(rows[6].attrs['data-category-id'],'education');assert.equal(xmlText(rows[6]),'Education');assert.equal(rowColor(rows[6]),'#2C6E8F');
  assert.match(svg,/data-founder-geometry="20,300,284,346"/);
});

test('all supported duration categories use explicit mappings; clinical variants and canonical work retain their identity',()=>{
  const events=fixture.events.filter(event=>event.eventType!=='milestone');
  const clinic={...events.find(e=>e.categoryId==='clinical'),id:'clinic-proof',siteName:'Synthetic Outpatient Clinic'};
  const volunteer={...events.find(e=>e.categoryId==='work'),id:'volunteer-proof',title:'Volunteer',fields:{canonicalType:'VOLUNTEER'}};
  const personal={...education,id:'personal-proof',categoryId:'personal',title:'Synthetic Personal Phase'};
  const {svg}=render([...events,clinic,volunteer,personal]);
  const expected={education:'#2C6E8F',exams:'#3A78C9',clinical:'#C8641C',work:'#3F9B52',research:'#D4B636',personal:'#8A5BBF'};
  for(const event of [...events,personal])assert.deepEqual(arrowColors(svg,event.id),[expected[event.categoryId],expected[event.categoryId]]);
  assert.deepEqual(arrowColors(svg,clinic.id),['#E89B3C','#E89B3C']);
  assert.deepEqual(arrowColors(svg,volunteer.id),['#3F9B52','#3F9B52'],'the renderer never reclassifies the accepted work-category volunteer');
});

test('every unsupported category fails instead of silently painting a Work Experience arrow',()=>{
  for(const categoryId of ['volunteer','honors','certification','other','__proto__','constructor','']){
    assert.throws(()=>render([{...education,categoryId}]),/Unsupported event category/);
  }
  const {scene}=render([education]);
  for(const categoryId of ['volunteer','honors','other']){
    assert.throws(()=>serializeFounderScene({...scene,arrows:scene.arrows.map(arrow=>({...arrow,categoryId}))}),/Unsupported event category/);
  }
});

test('no visible education duration leaves the original six-row default, including private and omitted facts',()=>{
  const nonEducation=fixture.events.filter(event=>event.categoryId!=='education');
  const variants=[nonEducation,[...nonEducation,{...education,visibilityState:'ADVISOR_ONLY'}],[...nonEducation,{...education,startDate:null}],[...nonEducation,{...education,eventType:'milestone',endDate:null}]];
  for(const events of variants){
    const {svg,scene}=render(events);assert.equal(keyRows(svg).length,6);
    assert.deepEqual(scene.founderPresentation.categoryKey.map(({id,label,color})=>({id,label,color})),FOUNDER_COLOR_KEY_ROWS);
    assert.match(svg,/data-founder-geometry="20,300,284,346"/);
  }
});

test('education palette and label overrides paint the exact same arrow and legend without changing facts',()=>{
  const overrides=[{color:'#A14273',label:'Medical Education'}, {color:'invalid',label:'Education'}];
  for(const value of overrides){
    const {svg}=render([education],{presentationOverrides:{categoryKey:[{id:'education',...value}]}});
    const expected=value.color==='invalid'?'#2C6E8F':value.color;
    assert.deepEqual(arrowColors(svg,education.id),[expected,expected]);
    const row=keyRows(svg).find(row=>row.attrs['data-category-id']==='education');assert.equal(rowColor(row),expected);assert.equal(xmlText(row),value.label);
  }
  const categories=[{id:'education',color:'#226644',label:'Education and Training'}];
  const {svg}=render([education],{categories});assert.deepEqual(arrowColors(svg,education.id),['#226644','#226644']);
  assert.equal(rowColor(keyRows(svg).at(-1)),'#226644');
});

test('Education plus LOR and the original six rows fit within the unchanged card bounds',()=>{
  const {svg}=render([{...education,fields:{...education.fields,lorSubmitted:true}}]);
  const rows=keyRows(svg);assert.equal(rows.length,8);assert.equal(rows.at(-1).attrs['data-category-id'],'lor-submitted');
  let previousBottom=0;
  for(const row of rows){
    const rect=xmlNodes(row,node=>node.tag==='rect')[0].attrs,text=xmlNodes(row,node=>node.tag==='text')[0].attrs;
    assert.ok(Number(rect.y)>=previousBottom);previousBottom=Number(rect.y)+Number(rect.height);
    assert.ok(previousBottom<=346);assert.ok(Number(text.y)+5<=346);
    assert.ok(Number(text['font-size'])>=18);
  }
  assert.match(svg,/data-founder-geometry="20,300,284,346"/);
});

test('editable PPTX inherits the Education native fill and visible legend from the shared SVG',async()=>{
  const document={...structuredClone(fixture),events:[education],presentationOverrides:{categoryKey:[{id:'education',label:'Medical Education',color:'#A14273'}]}};
  const {svg}=serializeFounderPresentation(document,options);
  const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE3sAAAAASUVORK5CYII=';
  const artifact=await createEditableFounderPptx({svg,document,resolveImage:async()=>pixel});
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer()),tree=treeOf(await zip.file('ppt/slides/slide1.xml').async('string'));
  const eventGroup=xmlNodes(tree,node=>node.tag==='p:grpSp'&&xmlNodes(node,n=>n.tag==='p:cNvPr'&&n.attrs.name===`MM:group:event:${education.id}`).length)[0];
  assert.ok(eventGroup);assert.ok(xmlNodes(eventGroup,node=>node.tag==='a:srgbClr'&&node.attrs.val==='A14273').length>=2);
  assert.ok(xmlNodes(tree,node=>node.tag==='a:t'&&xmlText(node)==='Medical Education').length);
  assert.ok(xmlNodes(eventGroup,node=>node.tag==='p:sp').length>1);
});
