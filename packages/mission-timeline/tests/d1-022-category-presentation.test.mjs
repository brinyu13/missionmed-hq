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

test('education-only chronology keeps its completed degree flag and source-linked profile span within six rows',()=>{
  const doc={...structuredClone(fixture),events:[structuredClone(education)]},before=JSON.stringify(doc);
  const {svg,scene}=serializeFounderPresentation(doc,options);
  assert.equal(scene.arrows.some(a=>a.id===education.id),false);
  assert.equal(scene.flags.find(flag=>flag.id===education.id)?.month,education.endDate);
  assert.deepEqual(scene.profile.educationRecords.map(record=>[record.eventId,record.title,record.school,record.startDate,record.endDate]),[[education.id,education.title,education.siteName,education.startDate,education.endDate]]);
  assert.match(svg,new RegExp(`data-event-kind="flag" data-event-id="${education.id}"`));
  assert.match(svg,/data-material-field="educationSpan"/);
  assert.equal(JSON.stringify(doc),before);
  const rows=keyRows(svg);assert.equal(rows.length,6);
  assert.deepEqual(rows.map(row=>row.attrs['data-category-id']),FOUNDER_COLOR_KEY_ROWS.map(row=>row.id));
  assert.match(svg,/data-founder-geometry="20,300,284,346"/);
});

test('all supported duration categories use explicit mappings; clinical variants and canonical work retain their identity',()=>{
  const events=fixture.events.filter(event=>event.eventType!=='milestone');
  const clinic={...events.find(e=>e.categoryId==='clinical'),id:'clinic-proof',siteName:'Synthetic Outpatient Clinic'};
  const volunteer={...events.find(e=>e.categoryId==='work'),id:'volunteer-proof',title:'Volunteer',fields:{canonicalType:'VOLUNTEER'}};
  const personal={...education,id:'personal-proof',categoryId:'personal',title:'Synthetic Personal Phase'};
  const {svg}=render([...events,clinic,volunteer,personal]);
  const expected={exams:'#0565C0',clinical:'#DF6A0F',work:'#00882B',research:'#DCBE23',personal:'#763F9B'};
  for(const event of [...events.filter(event=>event.categoryId!=='education'),personal])assert.deepEqual(arrowColors(svg,event.id),[expected[event.categoryId],expected[event.categoryId]]);
  assert.match(svg,new RegExp(`data-event-kind="flag" data-event-id="${education.id}"`));
  assert.doesNotMatch(svg,new RegExp(`data-event-kind="arrow" data-event-id="${education.id}"`));
  assert.deepEqual(arrowColors(svg,clinic.id),['#F49018','#F49018']);
  assert.deepEqual(arrowColors(svg,volunteer.id),['#00882B','#00882B'],'the renderer never reclassifies the accepted work-category volunteer');
});

test('every unsupported category fails instead of silently painting a Work Experience arrow',()=>{
  for(const categoryId of ['volunteer','honors','certification','other','__proto__','constructor','']){
    assert.throws(()=>render([{...education,categoryId}]),/Unsupported event category/);
  }
  const {scene}=render([fixture.events.find(event=>event.categoryId==='work')]);
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

test('education palette and label overrides cannot create an unapproved seventh key row or duration arrow',()=>{
  const overrides=[{color:'#A14273',label:'Medical Education'}, {color:'invalid',label:'Education'}];
  for(const value of overrides){
    const {svg,scene}=render([education],{presentationOverrides:{categoryKey:[{id:'education',...value}]}});
    assert.equal(keyRows(svg).length,6);
    assert.equal(keyRows(svg).some(row=>row.attrs['data-category-id']==='education'),false);
    assert.equal(scene.arrows.some(arrow=>arrow.id===education.id),false);
    assert.equal(scene.flags.find(flag=>flag.id===education.id)?.month,education.endDate);
    assert.match(svg,/data-material-field="educationSpan"/);
  }
  const categories=[{id:'education',color:'#226644',label:'Education and Training'}];
  const {svg}=render([education],{categories});assert.equal(keyRows(svg).length,6);
  assert.match(svg,new RegExp(`data-event-kind="flag" data-event-id="${education.id}"`));
});

test('education and LOR facts do not add a seventh color-key row or overflow the unchanged card',()=>{
  const {svg}=render([{...education,fields:{...education.fields,lorSubmitted:true}}]);
  const rows=keyRows(svg);assert.equal(rows.length,6);
  assert.deepEqual(rows.map(row=>row.attrs['data-category-id']),FOUNDER_COLOR_KEY_ROWS.map(row=>row.id));
  let previousBottom=0;
  for(const row of rows){
    const rect=xmlNodes(row,node=>node.tag==='rect')[0].attrs,text=xmlNodes(row,node=>node.tag==='text')[0].attrs;
    assert.ok(Number(rect.y)>=previousBottom);previousBottom=Number(rect.y)+Number(rect.height);
    assert.ok(previousBottom<=346);assert.ok(Number(text.y)+5<=346);
    assert.ok(Number(text['font-size'])>=18);
  }
  assert.match(svg,/data-founder-geometry="20,300,284,346"/);
});

test('editable PPTX inherits the completed degree flag and source-linked profile school span',async()=>{
  const document={...structuredClone(fixture),events:[education],presentationOverrides:{categoryKey:[{id:'education',label:'Medical Education',color:'#A14273'}]}};
  const {svg}=serializeFounderPresentation(document,options);
  const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE3sAAAAASUVORK5CYII=';
  const artifact=await createEditableFounderPptx({svg,document,resolveImage:async()=>pixel});
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer()),tree=treeOf(await zip.file('ppt/slides/slide1.xml').async('string'));
  const eventGroup=xmlNodes(tree,node=>node.tag==='p:grpSp'&&xmlNodes(node,n=>n.tag==='p:cNvPr'&&n.attrs.name===`MM:group:event:${education.id}`).length)[0];
  assert.ok(eventGroup);
  assert.ok(xmlNodes(tree,node=>node.tag==='a:t'&&xmlText(node).includes('Global Medical University')).length);
  assert.ok(xmlNodes(tree,node=>node.tag==='a:t'&&xmlText(node)==='8/19 – 5/23').length,'editable profile retains the source education span');
  assert.ok(xmlNodes(eventGroup,node=>node.tag==='p:sp').length>1);
});
