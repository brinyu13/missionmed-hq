import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapPresentationText,fitPresentationText} from '../web/js/presentation/text-layout.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
const measureText=(text,size)=>Array.from(text).length*size;
test('long unbroken names wrap without losing a character and fit both dimensions',()=>{
  const source='W'.repeat(90),fit=fitPresentationText(source,{width:100,height:300,size:24,minSize:10,measureText});
  assert.equal(fit.lines.join(''),source);assert.ok(fit.width<=100);assert.ok(fit.height<=300);assert.equal(fit.fits,true);
});
test('fixed size and an impossible minimum preserve text while reporting overflow',()=>{
  const source='W'.repeat(90),fit=fitPresentationText(source,{width:30,height:10,size:24,minSize:20,fit:'fixed',measureText});
  assert.equal(fit.fontSize,24);assert.equal(fit.lines.join(''),source);assert.equal(fit.fits,false);
  const noWrap=fitPresentationText(source,{width:100,height:50,size:24,minSize:10,wrap:'nowrap',measureText});assert.equal(noWrap.fits,false);assert.equal(noWrap.lines[0],source);
});
test('grapheme wrapping preserves joined emoji and explicit blank paragraphs',()=>{
  const family='👨‍👩‍👧‍👦',measureText=(t)=>[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(t)].length*10;
  assert.deepEqual(wrapPresentationText(family+family+'\n\nA',{width:10,size:10,measureText}),[family,family,'','A']);
});
test('the actual SVG text container exposes overflow and no longer emits one overlong token',()=>{
  const source='W'.repeat(90),doc={id:'text',studentProfile:{fullName:'Synthetic Text'},events:[],advanced:{media:[],elements:[],groups:[],textBlocks:[{id:'long',text:source,x:10,y:10,width:100,height:300,size:24,minFontSize:10,fitMode:'auto',font:'Arial'}]}};
  const result=serializeFounderPresentation(doc);const node=resolveFounderPresentationSvg(result.svg).nodes.find(n=>n.sourceAttributes['data-advanced-text']==='long');
  assert.equal(node.text.replaceAll('\n',''),source);assert.ok(node.bounds.width<=103);assert.equal(node.sourceAttributes['data-text-overflow'],'false');
});
