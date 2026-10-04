import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {photoFrameGeometry} from '../web/js/uxr-002/locked-407f-export.js';
import {createEditableFounderPptx,inspectEditablePptx} from '../web/js/presentation/editable-pptx.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {parsePresentationXml,xmlNodes} from '../web/js/presentation/presentation-xml.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';

// Numeric measurements from the 2025 native photo objects; all content is synthetic.
const reference=[
  {box:{x:607.4708862304688,y:782.659423828125,width:195.9185791015625,height:260.55804443359375,rotation:10},pixels:[408,543],paper:[9,1,400,515],aperture:[23,16,385,501]},
  {box:{x:749.3143310546875,y:888.0833740234375,width:243.38780212402344,height:166.1234588623047,rotation:6},pixels:[507,347],paper:[9,1,498,317],aperture:[23,16,483,303]},
  {box:{x:981.880615234375,y:870.6946411132812,width:253.4744873046875,height:200.90078735351562,rotation:0},pixels:[528,419],paper:[9,1,519,390],aperture:[23,16,504,376]}
];
const fixture=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-founder-reanchor-015/synthetic-founder-geometry.json',import.meta.url),'utf8'));
// Verified 160×160 synthetic color grid from the Q01 technical baseline; no personal media.
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAIAAAAErfB6AAAB80lEQVR4nO3TOxUCMRRF0fEyDSJokEONHJQgggYR2OBjYVKdZJ+VlK/a624fTd32+6/z5diL3u6357FXvAUcQAIMGDDgFhJgwIABR5AAAwYMuIUEGDBgwBEkwIABA24hAQYMGHAECTBgwCsDa+IsOLDCkVvAASTAgAEDbiEBBgwYcAQJMGDAgFtIgAEDBhxBAgwYMOAWEmDAgAFHkAADBrwysCbOggMrHLkFHEACDBgw4BYSYMCAAUeQAAMGDLiFBBgwYMARJMCAAQNuIQEGDBhwBAkwYMArA2viLDiwwpFbwAEkwIABA24hAQYMGHAECTBgwIBbSIABAwYcQQIMGDDgFhJgwIABR5AAAwa8MrAm7g/8fuzHXvT2dL8ee8VbwAEkwIABA24hAQYMGHAECTBgwIBbSIABAwYcQQIMGDDgFhJgwIABR5AAAwa8MrAmzoIDKxy5BRxAAgwYMOAWEmDAgAFHkAADBgy4hQQYMGDAESTAgAEDbiEBBgwYcAQJMGDAKwNr4iw4sMKRW8ABJMCAAQNuIQEGDBhwBAkwYMCAW0iAAQMGHEECDBgw4BYSYMCAAUeQAAMGvDKwJs6CAyscuQUcQAIMGDDgFhJgwIABR5AAAwYMuIUEGDBgwBEkwIABA24hAQYMGHAECTBgwKsCfwEIoRXljeWBmwAAAABJRU5ErkJggg==';
const render=(document,showEmptySlots=false)=>serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE',currentMonth:'2027-01',showEmptySlots});
const photo=(id,placement,crop=null)=>({id,type:'photo',...(placement?{placement}:{}),resolvedUrl:pixel,naturalAspect:1,...(crop?{crop}:{}) ,visibilityState:'INTERVIEWER_SAFE'});
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9,`${label}: ${actual} versus ${expected}`);
const frameNodes=svg=>xmlNodes(parsePresentationXml(svg),node=>node.tag==='g'&&node.attrs['data-artifact-photo-frame']);
const expectedRect=({box,pixels},rect)=>({
  x:box.x+rect[0]/pixels[0]*box.width,
  y:box.y+rect[1]/pixels[1]*box.height,
  width:(rect[2]-rect[0])/pixels[0]*box.width,
  height:(rect[3]-rect[1])/pixels[1]*box.height
});
const assertRect=(node,want,label)=>{
  for(const key of ['x','y','width','height'])close(Number(node.attrs[key]),want[key],`${label}.${key}`);
};

test('three default boxes, paper and aperture follow native reference rectangles and rotation',()=>{
  const source={...fixture,mediaItems:[photo('one','photo1'),photo('two','photo2'),photo('three','photo3')]};
  const before=JSON.stringify(source),result=render(source),frames=frameNodes(result.svg);
  assert.deepEqual(frames.map(frame=>frame.attrs['data-frame-slot']),['photo3','photo2','photo1'],'original back-to-front paint order');
  assert.deepEqual(frames.map(frame=>frame.attrs['data-media-id']),['three','two','one'],'slot assignments precede paint reversal');
  for(const [index,want] of reference.entries()){
    assert.deepEqual(photoFrameGeometry(result.scene,index),want.box);
    const frame=frames.find(node=>node.attrs['data-frame-slot']===`photo${index+1}`);
    assert.equal(frame.attrs.transform,`rotate(${want.box.rotation} ${want.box.x+want.box.width/2} ${want.box.y+want.box.height/2})`);
    const paper=xmlNodes(frame,node=>node.tag==='rect'&&node.attrs['data-photo-paper']==='true')[0];
    const aperture=xmlNodes(frame,node=>node.tag==='svg'&&node.attrs['data-photo-aperture']==='true')[0];
    assert.ok(paper&&aperture);
    assertRect(paper,expectedRect(want,want.paper),`photo${index+1}.paper`);
    assertRect(aperture,expectedRect(want,want.aperture),`photo${index+1}.aperture`);
    assert.equal(paper.attrs.filter,'url(#d1406-photo-shadow)');
  }
  assert.match(result.svg,/id="d1406-photo-shadow"[^>]*>\s*<feDropShadow[^>]*flood-opacity=".5"/);
  assert.equal(JSON.stringify(source),before,'projection retains source media and geometry');
});

test('unslotted source photos fill 1, 2, 3 before reverse paint; empty final slots stay omitted',()=>{
  const source={...fixture,mediaItems:[photo('first'),photo('second'),photo('third')]};
  assert.deepEqual(frameNodes(render(source).svg).map(frame=>[frame.attrs['data-frame-slot'],frame.attrs['data-media-id']]),[
    ['photo3','third'],['photo2','second'],['photo1','first']
  ]);
  assert.equal(frameNodes(render({...fixture,mediaItems:[]}).svg).length,0);
  assert.equal(frameNodes(render({...fixture,mediaItems:[]},true).svg).length,3,'editor retains empty slots');
  assert.deepEqual(frameNodes(render({...fixture,mediaItems:[photo('first')]}).svg).map(frame=>frame.attrs['data-frame-slot']),['photo1']);
});

test('authored frame geometry, pan/zoom and square profile portrait survive projection',()=>{
  const override={x:640,y:690,width:250,height:300,rotation:-12};
  const source={...fixture,presentationOverrides:{photoFrames:{'1':override}},mediaItems:[
    photo('authored','photo1',{x:20,y:80,zoom:2}),
    {id:'portrait',type:'profilePhoto',placement:'profile',resolvedUrl:pixel,naturalAspect:1,crop:{x:35,y:65,zoom:1.4},visibilityState:'INTERVIEWER_SAFE'}
  ]};
  const before=JSON.stringify(source),result=render(source),frame=frameNodes(result.svg)[0];
  assert.deepEqual(photoFrameGeometry(result.scene,0),override);
  assert.equal(frame.attrs['data-founder-geometry'],'640,690,250,300,-12');
  const aperture=xmlNodes(frame,node=>node.tag==='svg'&&node.attrs['data-photo-aperture']==='true')[0];
  const want={...reference[0],box:override};
  assertRect(aperture,expectedRect(want,want.aperture),'authored aperture');
  assert.equal(aperture.attrs['data-crop-x'],'20');assert.equal(aperture.attrs['data-crop-y'],'80');assert.equal(aperture.attrs['data-crop-zoom'],'2');
  const portrait=xmlNodes(parsePresentationXml(result.svg),node=>node.tag==='svg'&&node.attrs['data-profile-photo-slot']==='true')[0];
  assert.ok(portrait);assert.equal(Number(portrait.attrs.width),170);assert.equal(Number(portrait.attrs.height),170);
  assert.equal(JSON.stringify(source),before);
});

test('native photo has a separate editable cropped image and shadowed paper shape',async()=>{
  const source={...fixture,mediaItems:[photo('technical-photo','photo1',{x:20,y:80,zoom:2})]};
  const rendered=render(source);
  const resolved=resolveFounderPresentationSvg(rendered.svg);
  const paper=resolved.nodes.find(node=>node.sourceAttributes['data-photo-paper']==='true');
  const media=resolved.nodes.find(node=>node.sourceAttributes['data-photo-aperture']==='true');
  assert.equal(paper?.kind,'shape');assert.equal(media?.kind,'image');
  assert.equal(media.sourceAttributes['data-media-id'],'technical-photo');
  assert.ok(media.crop&&Object.values(media.crop).some(value=>value>0));
  const artifact=await createEditableFounderPptx({svg:rendered.svg,document:source,resolveImage:async src=>{
    const pathname=src.slice(src.indexOf('assets/'));
    return 'data:'+(pathname.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+
      (await readFile(new URL('../web/'+pathname,import.meta.url))).toString('base64');
  }});
  const inspected=await inspectEditablePptx(artifact.blob);
  assert.deepEqual(inspected.errors,[]);
  assert.ok(inspected.recovery.media.some(record=>record.objectId===media.id&&record.crop));
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  const tree=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const papers=xmlNodes(tree,node=>node.tag==='p:sp'&&xmlNodes(node,part=>part.tag==='p:cNvPr'&&part.attrs.name?.includes('furniture:photo-1')).length&&xmlNodes(node,part=>part.tag==='a:outerShdw').length);
  assert.equal(papers.length,1,'only the editable photo paper gets the photo shadow');
  const shadow=xmlNodes(papers[0],node=>node.tag==='a:outerShdw')[0];
  assert.equal(Number(shadow.attrs.blurRad),Math.round(5*.75*12700),'5 reference px become 3.75 native points');
  assert.equal(Number(shadow.attrs.dist),Math.round(9*.75*12700),'9 reference px become 6.75 native points');
  assert.equal(Number(shadow.attrs.dir),Math.round(137.2*60000));
  assert.ok(xmlNodes(shadow,node=>node.tag==='a:alpha'&&Number(node.attrs.val)===50000).length);
  assert.ok(xmlNodes(tree,node=>node.tag==='p:pic'&&xmlNodes(node,part=>part.tag==='p:cNvPr'&&part.attrs.name?.includes('furniture:photo-1')).length&&xmlNodes(node,part=>part.tag==='a:srcRect').length).length);
});
