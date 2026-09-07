import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {createEditableFounderPptx,inspectEditablePptx} from '../web/js/presentation/editable-pptx.js';
import {analyzeCollisionLayout} from '../web/js/editor/collision-engine-410.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';
import {parsePresentationXml,xmlNodes} from '../web/js/presentation/presentation-xml.js';
import {analyzeTimelineQuality,applySafeQualityFixes} from '../web/js/uxr-002/quality-guardian.js';

// Facts from the actual synthetic CV browser journey that exposed crushed
// two-month labels and a flattened medical-school name in the downloaded PNG.
const fixture=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-astra-021/golden2-guardian-milestones.json',import.meta.url),'utf8'));
const document=structuredClone(fixture.document);
const before=JSON.stringify(document);
const rendered=serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'});
const resolved=resolveFounderPresentationSvg(rendered.svg);
const durationParts=scene=>scene.nodes.filter(node=>node.sourceAttributes['data-continuous-duration-arrow']||node.sourceAttributes['data-arrow-caption']).map(node=>({eventId:node.semanticRef,kind:node.kind,text:node.text,commands:node.commands,bounds:node.bounds}));

test('short CV duration labels use readable side text while retaining date geometry and every accepted fact',()=>{
  for(const title of ['Observership','Clinical Elective','Resident Physician (PGY-1 equivalent)']){
    const label=resolved.nodes.find(node=>node.kind==='text'&&node.text===title);
    const bar=resolved.nodes.find(node=>node.semanticRef===label?.semanticRef&&node.sourceAttributes['data-continuous-duration-arrow']);
    assert.ok(label&&bar,title);
    assert.equal(label.fontSize,20);
    assert.equal(label.characterSpacing,0,'Native output must not recreate horizontal squeezing');
    assert.equal(label.sourceAttributes.textLength,undefined);
    assert.match(label.sourceAttributes['data-arrow-label-placement'],/^outside-/);
    assert.ok(label.bounds.width>bar.bounds.width,title);
    assert.ok(label.bounds.x>=32&&label.bounds.x+label.bounds.width<=1888);
    assert.ok(label.bounds.x+label.bounds.width<=bar.bounds.x-10||label.bounds.x>=bar.bounds.x+bar.bounds.width+10);
  }
  const shortTitles=structuredClone(document);
  shortTitles.events=shortTitles.events.map(event=>({...event,title:event.eventType==='duration'?'X':event.title}));
  assert.deepEqual(durationParts(resolved),durationParts(resolveFounderPresentationSvg(serializeFounderPresentation(shortTitles,{scope:'INTERVIEWER_SAFE'}).svg)),'Title length must never alter duration paths, dates, or chronology placement');
  assert.equal(JSON.stringify(document),before);
  const report=analyzeTimelineQuality(document);
  const fixed=applySafeQualityFixes(document,{...report,findings:report.findings.filter(f=>f.code==='COLLISION_RISK')});
  assert.equal(analyzeCollisionLayout(fixed.document).stats.collisionCount,0,'Readable labels must preserve the actual Guardian-repaired populated layout');
});

test('long medical-school profile values wrap at full size with separate native lines and stable remaining rows',()=>{
  const lines=resolved.nodes.filter(node=>node.sourceAttributes['data-profile-field']==='Medical school');
  assert.ok(lines.length>=3);
  assert.equal(lines.map(line=>line.text).join(' '),'Medical school: Carol Davila University of Medicine and Pharmacy');
  for(const [index,line] of lines.entries()){
    assert.equal(line.fontSize,17);assert.equal(line.characterSpacing,0);assert.equal(line.sourceAttributes.textLength,undefined);
    assert.ok(line.bounds.x+line.bounds.width<350,'School text must stay beside the fixed profile photo');
    if(index)assert.ok(line.bounds.y>=lines[index-1].bounds.y+lines[index-1].bounds.height);
  }
  const degree=resolved.nodes.find(node=>node.sourceAttributes['data-profile-field']==='Degree');
  assert.ok(degree.bounds.y>lines.at(-1).bounds.y+lines.at(-1).bounds.height);
});

test('the same readable CV labels and school lines remain editable text after PPTX serialization and reopening',async()=>{
  const artifact=await createEditableFounderPptx({svg:rendered.svg,document,resolveImage:async src=>{
    const path=src.slice(src.indexOf('assets/'));
    return 'data:'+(path.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+path,import.meta.url))).toString('base64');
  }});
  const reopened=await inspectEditablePptx(artifact.blob);
  assert.deepEqual(reopened.errors,[]);
  for(const text of ['Observership','Clinical Elective','Resident Physician (PGY-1 equivalent)','Medical school: ','Carol Davila','University of Medicine and','Pharmacy'])assert.ok(reopened.text.includes(text),text);
  for(const title of ['Observership','Clinical Elective']){
    const original=document.events.find(event=>event.title===title),fact=reopened.recovery.facts.find(event=>event.id===original.id);
    assert.deepEqual([fact.title,fact.startDate,fact.endDate],[original.title,original.startDate,original.endDate]);
  }
  assert.equal(JSON.stringify(document),before);
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  const tree=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const fonts=xmlNodes(tree,node=>node.tag==='a:latin').map(node=>node.attrs.typeface);
  assert.ok(fonts.includes('Arial'),'Manual Inter annotations use installed portable Arial');
  assert.ok(!fonts.includes('Inter'));
  for(const font of ['Baskerville','American Typewriter','Futura'])assert.ok(fonts.includes(font),'Founder font remains '+font);
  const mapped=reopened.recovery.objects.filter(object=>object.fontFamily==='Inter');
  assert.ok(mapped.length>0);assert.ok(mapped.every(object=>object.role==='annotation'&&object.nativeFontFamily==='Arial'));
  assert.ok(resolveFounderPresentationSvg(rendered.svg).nodes.some(node=>node.fontFamily==='Inter'),'Canonical SVG font is unchanged');
});


test('Guardian checks actual rendered compression instead of marking a short event list readable',()=>{
  const crowded={id:'long-manual-heading',theme:'keynote-classic',events:[],advanced:{},studentProfile:{fullName:'Alexandria Montgomery Wellington-Smythe of the Northern Clinical Research Consortium'}};
  const report=analyzeTimelineQuality(crowded);
  const finding=report.findings.find(item=>item.code==='COMPRESSED_PRESENTATION_TEXT');
  assert.ok(finding);assert.equal(finding.section,'READABILITY');
  assert.ok(finding.evidence.minimumWidthRatio<.72);
  assert.ok(finding.elementIds.includes('furniture:title'));
  assert.ok(!analyzeTimelineQuality(document).findings.some(item=>item.code==='COMPRESSED_PRESENTATION_TEXT'),'Normal exact-CV labels and mild fixed legend fitting are not severe compression');
});
