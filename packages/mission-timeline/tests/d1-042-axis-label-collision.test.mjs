import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../web/js/presentation/resolved-founder-presentation.js';
import {analyzeCollisionLayout} from '../web/js/editor/collision-engine-410.js';

const axis='<g data-layer="axis"><path fill="#182B4C" d="M0 125H1920V161H0Z"/><text x="100" y="150" font-size="23" fill="white">2023</text></g>';
function paint(content){return resolveFounderPresentationSvg(`<svg viewBox="0 0 1920 1080">${axis}<g data-event-id="synthetic-flag" data-event-kind="flag">${content}</g></svg>`);}
test('milestone text crossing the navy year ribbon is a material collision',()=>{
  const result=materialPresentationCollisions(paint('<text x="300" y="138" font-size="18">Complete synthetic institution label</text>'));
  assert.ok(result.some(item=>item.elementIds.includes('furniture:axis')));
});
test('a filled pennant crossing the ribbon is blocked even without a text overlap',()=>{
  assert.ok(materialPresentationCollisions(paint('<path fill="gray" d="M300 118H350V142H300Z"/>')).length);
});
test('a pole touching the ribbon remains an intentional connector',()=>{
  assert.equal(materialPresentationCollisions(paint('<line x1="300" y1="85" x2="300" y2="125" stroke="gray" stroke-width="3"/><text x="355" y="100" font-size="18">Synthetic milestone</text>')).length,0);
});
test('the actual canonical collision report rejects an overlong milestone painted over the ribbon',()=>{
  const document={id:'synthetic-axis-hold',theme:'keynote-classic',studentProfile:{fullName:'Synthetic Avery'},events:[{id:'synthetic-long-flag',title:'Synthetic documented milestone '.repeat(24),categoryId:'personal',eventType:'milestone',startDate:'2023-06',endDate:null,visibilityState:'INTERVIEWER_SAFE'}],exams:[],metadata:{renderCurrentMonth:'2023-06'},advanced:{background:{kind:'theme'},media:[],textBlocks:[],elements:[],groups:[]}};
  const report=analyzeCollisionLayout(document);
  assert.ok(report.warnings.some(item=>item.code==='RESERVED_REGION_COLLISION'&&item.elementIds.includes('furniture:axis')));
  assert.equal(document.events[0].startDate,'2023-06');
});


test('bounded joint packing rescues full milestone labels that greedy placement cannot finish',async()=>{
  const {serializeFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');
  const document={id:'synthetic-joint',theme:'keynote-classic',studentProfile:{fullName:'Synthetic Joint'},
    events:['2020-02','2020-08','2021-02'].map((date,index)=>({id:'f'+index,title:'Synthetic completed milestone',siteName:'Synthetic Academic Institution',categoryId:'personal',eventType:'milestone',startDate:date,visibilityState:'INTERVIEWER_SAFE'})),
    presentationOverrides:{axis:{mode:'manual',startYear:2020,endYear:2025,includeFuture:false,segmentWeights:Array.from({length:6},(_,index)=>({id:String(2020+index),weight:1}))}},
    advanced:{media:[],textBlocks:[],elements:[],groups:[]}};
  const before=JSON.stringify(document),render=()=>serializeFounderPresentation(document,{scope:'EVERYTHING',currentMonth:'2026-10'});
  const started=performance.now(),first=render(),elapsed=performance.now()-started,packing=first.scene.autoMilestonePacking;
  assert.equal(packing.strategy,'joint');assert.ok(packing.greedyPlaced<packing.total);assert.equal(packing.total,3);
  assert.ok(packing.expansions<=packing.limit);assert.equal(packing.limit,8192);assert.ok(elapsed<2000,`${elapsed} ms`);
  assert.equal(materialPresentationCollisions(resolveFounderPresentationSvg(first.svg)).length,0);
  assert.equal(render().svg,first.svg);assert.equal(JSON.stringify(document),before);
  const resolved=resolveFounderPresentationSvg(first.svg);
  for(const event of document.events){
    const nodes=resolved.nodes.filter(node=>node.groupId==='event:'+event.id);
    const pole=nodes.find(node=>node.kind==='path'&&node.lineOnly);
    const [year,month]=event.startDate.split('-').map(Number);
    const expectedX=39.36+1841.28*((year-2020)+(month-1)/12)/6+4; // native pole offset
    assert.ok(Math.abs(pole.bounds.x-expectedX)<.04);assert.equal(pole.bounds.y+pole.bounds.height,125);
    const label=nodes.filter(node=>node.kind==='text'&&!/^\d{4}/.test(node.text||''));
    const text=label.map(node=>node.text).join(' ');
    assert.ok(text.includes(event.title));assert.ok(text.includes(event.siteName));
    assert.ok(label.every(node=>Number(node.style['font-size'])===18));
    assert.ok(nodes.filter(node=>node.kind!=='path'||!node.lineOnly).every(node=>node.bounds.y+node.bounds.height<=125));
  }
});


test('a constrained upper band preserves the greedy incumbent with finite search and truthful unresolved collisions',async()=>{
  const {serializeFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');
  const document={id:'synthetic-constrained',theme:'keynote-classic',studentProfile:{fullName:'Synthetic Joint'},
    events:Array.from({length:4},(_,index)=>({id:'f'+index,title:'Synthetic completed milestone',siteName:'Synthetic Academic Institution',categoryId:'personal',eventType:'milestone',startDate:'2020-02',visibilityState:'INTERVIEWER_SAFE'})),
    presentationOverrides:{axis:{mode:'manual',startYear:2020,endYear:2025,includeFuture:false,segmentWeights:Array.from({length:6},(_,index)=>({id:String(2020+index),weight:1}))}},
    advanced:{media:[],textBlocks:[],elements:[],groups:[]}};
  const started=performance.now(),result=serializeFounderPresentation(document,{scope:'EVERYTHING',currentMonth:'2026-10'}),packing=result.scene.autoMilestonePacking;
  assert.equal(packing.strategy,'greedy');assert.ok(packing.greedyPlaced<packing.total);assert.ok(packing.expansions<=packing.limit);
  assert.ok(performance.now()-started<2000);assert.ok(materialPresentationCollisions(resolveFounderPresentationSvg(result.svg)).length>0);
});


test('selected widths and adjacent-label fallback preserve factual years and complete native milestone paint',async()=>{
  const {buildFounderPresentationScene,serializeFounderPresentation,assertCompleteFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');
  const {composeLocked407FPortableSvg,locked407FMilestoneGeometry}=await import('../web/js/uxr-002/locked-407f-export.js');
  const {applySceneCommandToDocument}=await import('../web/js/editor/scene-commands.js');
  const document={id:'synthetic-cooperation',theme:'keynote-classic',studentProfile:{fullName:'Synthetic Joint'},
    events:['2021-02','2022-07','2022-08','2022-09'].map((date,index)=>({id:'f'+index,title:'Synthetic completed milestone',siteName:'Synthetic International Academic Medical Institution',categoryId:'personal',eventType:'milestone',startDate:date,visibilityState:'INTERVIEWER_SAFE'})),
    advanced:{media:[],textBlocks:[],elements:[],groups:[]}};
  const options={scope:'EVERYTHING',currentMonth:'2026-10'},before=JSON.stringify(document),initial=buildFounderPresentationScene(document,options);
  // The bounded recovery can now finish using existing factual years and
  // label-only offsets, retaining the native pennants and selected widths.
  const baseline={...initial,autoYearWeights:undefined,composedAxis:undefined};
  const started=performance.now(),result=composeLocked407FPortableSvg(baseline);
  assert.ok(performance.now()-started<2000);
  assert.equal(result.scene.autoAxisPadding,undefined);
  assert.ok([...result.scene.autoFlagLabels.values()].some(label=>Number.isFinite(label.yOffset)&&label.yOffset!==0));
  assert.ok(result.scene.autoMilestonePacking.labelExpansions<=result.scene.autoMilestonePacking.labelLimit);
  // Boundary-demand maps omit quiet years: their implicit weight remains 1.
  assert.ok(result.scene.autoYearWeights.get(2022)>(result.scene.autoYearWeights.get(2021)||1));
  const axis=result.scene.composedAxis,segments=axis.segmentWeights;
  assert.deepEqual(segments.map(item=>item.id),['2021','2022']);
  assert.ok(segments[1].weight>segments[0].weight);
  const collisions=svg=>materialPresentationCollisions(resolveFounderPresentationSvg(svg)).length;
  assert.equal(collisions(result.svg),0);
  // Freeze each old ingredient using the actual consumer's floor and
  // normalization. Widths with adjacent labels now suffice; padding alone
  // still cannot fit the complete source. Manual axes remain exact.
  for(const kind of ['widths-only','padding-only']){
    const first=kind==='widths-only'?2021:2020,last=kind==='widths-only'?2022:2023;
    const manual={mode:'manual',startYear:first,endYear:last,includeFuture:false,
      segmentWeights:kind==='widths-only'?structuredClone(segments):Array.from({length:4},(_,index)=>({id:String(2020+index),weight:1}))};
    const isolated=composeLocked407FPortableSvg({...baseline,autoMilestoneTopDown:true,founderPresentation:{...initial.founderPresentation,axis:manual}});
    if(kind==='widths-only'){
      assert.equal(collisions(isolated.svg),0,kind);assert.doesNotThrow(()=>assertCompleteFounderPresentation(isolated));
    }else assert.ok(collisions(isolated.svg)>0,kind);
    assert.deepEqual(isolated.scene.founderPresentation.axis,manual);assert.equal(isolated.scene.autoAxisPadding,undefined);
  }
  const final=serializeFounderPresentation(document,options),resolved=resolveFounderPresentationSvg(final.svg);
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(final));
  assert.equal(collisions(final.svg),0);assert.deepEqual(final.scene.composedAxis,axis);
  assert.equal(serializeFounderPresentation(document,options).svg,final.svg);
  const total=segments.reduce((sum,item)=>sum+item.weight,0),widths=segments.map(item=>1841.28*item.weight/total);
  assert.ok(widths.every(width=>width>=80));assert.ok(Math.abs(widths.reduce((a,b)=>a+b,0)-1841.28)<.001);
  for(const event of document.events){
    const nodes=resolved.nodes.filter(node=>node.groupId==='event:'+event.id),text=nodes.filter(node=>node.kind==='text');
    const label=text.filter(node=>node.sourceAttributes['data-board-ink-role']==='flag-label');
    assert.equal(label.map(node=>node.text).join(' '),event.title+' — '+event.siteName);
    assert.ok(label.every(node=>node.fontFamily.includes('American Typewriter')));
    const native=locked407FMilestoneGeometry(final.scene,event.id);assert.equal(native.width,50);assert.equal(native.height,64);assert.equal(native.rotation,0);
    assert.ok(nodes.some(node=>node.kind==='path'&&node.style.fill==='#A6AAAE'));
    assert.equal(nodes.filter(node=>node.kind==='path').length,3,'no extra leader or label box');
    assert.equal(nodes.filter(node=>node.kind==='shape').length,1);
    assert.ok(nodes.every(node=>node.bounds.x>=8&&node.bounds.x+node.bounds.width<=1912&&node.bounds.y>=2&&node.bounds.y+node.bounds.height<=125.04),'complete paint stays on board and above ribbon');
    const words=text.map(node=>node.text).join(' ');
    const [year,month]=event.startDate.split('-').map(Number);assert.ok(words.includes(`${month}/${String(year).slice(-2)}`));
    assert.ok(text.every(node=>Number(node.style['font-size'])===18));
    const date=text.find(node=>node.sourceAttributes['data-founder-pennant-date']);assert.ok(date.fontFamily.includes('Baskerville'));assert.equal(date.fontSize,18);
    const index=segments.findIndex(segment=>Number(segment.id)===year),x=39.36+widths.slice(0,index).reduce((a,b)=>a+b,0)+widths[index]*(month-1)/12+4;
    const pole=nodes.find(node=>node.kind==='path'&&node.lineOnly);assert.ok(Math.abs(pole.bounds.x-x)<.04);assert.equal(pole.bounds.y+pole.bounds.height,125);
  }
  const manualGeometry={x:300,y:45,width:50,height:64,rotation:0};
  const authored=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'f0'},geometry:manualGeometry,create:{type:'event',semanticRef:'f0',locked:true,presentation:{eventType:'milestone'}}}).document;
  const preserved=serializeFounderPresentation(authored,options);
  for(const [key,value] of Object.entries(manualGeometry))assert.equal(locked407FMilestoneGeometry(preserved.scene,'f0')[key],value);
  assert.equal(preserved.scene.autoAxisPadding,undefined);assert.deepEqual(authored.events,document.events);assert.equal(JSON.stringify(document),before);
});

test('native date-boundary pressure separates nearby complete pennants while quiet cells retain measured year typography',async()=>{
  const {serializeFounderPresentation,assertCompleteFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');
  const {measurePresentationText}=await import('../web/js/presentation/text-layout.js');
  const document={id:'synthetic-boundary-pressure',theme:'keynote-classic',studentProfile:{fullName:'Synthetic'},
    events:[{id:'duration',categoryId:'work',eventType:'duration',title:'Synthetic work',startDate:'2012-01',endDate:'2026-01',visibilityState:'INTERVIEWER_SAFE'},
      ...['2020-06','2020-08'].map((date,index)=>({id:'publication'+index,categoryId:'research',eventType:'milestone',title:'Complete synthetic research title '+index,siteName:'Synthetic institution',startDate:date,visibilityState:'INTERVIEWER_SAFE'}))],
    advanced:{media:[],textBlocks:[],elements:[],groups:[]}};
  const snapshot=JSON.stringify(document),result=serializeFounderPresentation(document,{scope:'EVERYTHING',currentMonth:'2026-10'}),paint=resolveFounderPresentationSvg(result.svg);
  assert.equal(materialPresentationCollisions(paint).length,0);assert.doesNotThrow(()=>assertCompleteFounderPresentation(result));assert.equal(JSON.stringify(document),snapshot);
  const {parsePresentationXml,xmlNodes}=await import('../web/js/presentation/presentation-xml.js');
  const cells=xmlNodes(parsePresentationXml(result.svg),node=>Object.hasOwn(node.attrs||{},'data-axis-cell'));assert.equal(cells.length,15);
  const floor=Math.max(...result.scene.composedAxis.segmentWeights.map(item=>measurePresentationText(item.id,23,"Futura,'Trebuchet MS',Arial,sans-serif",700)))+20;
  for(const cell of cells)assert.ok(Number(cell.attrs.width)>=floor-.04);
  const weights=result.scene.composedAxis.segmentWeights;assert.ok(weights.find(item=>item.id==='2020').weight>weights.find(item=>item.id==='2019').weight);
  for(const event of document.events.filter(item=>item.eventType==='milestone')){
    const nodes=paint.nodes.filter(node=>node.semanticRef===event.id),labels=nodes.filter(node=>node.sourceAttributes['data-board-ink-role']==='flag-label'),pole=nodes.find(node=>node.lineOnly);
    assert.ok(labels.map(node=>node.text).join(' ').includes(event.title));assert.ok(labels.map(node=>node.text).join(' ').includes(event.siteName));
    assert.ok(labels.every(node=>Number(node.style['font-size'])===18));assert.equal(pole.bounds.y+pole.bounds.height,125);
    assert.ok(nodes.filter(node=>!node.lineOnly).every(node=>node.bounds.y>=0&&node.bounds.y+node.bounds.height<=125));
  }
});
