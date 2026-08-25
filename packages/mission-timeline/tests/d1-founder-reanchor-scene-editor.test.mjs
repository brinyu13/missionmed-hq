import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

import {
  TIMELINE_SCENE_SCHEMA,
  TIMELINE_SCENE_VERSION,
  marqueeSceneSelection,
  migrateAdvancedScene,
  sceneGroupById,
  sceneLegacyDigest,
  sceneObjectById,
  sceneSelection,
  synchronizeAdvancedSceneDocument,
  validateSceneGraph
} from "../web/js/editor/scene-graph.js";
import {
  applySceneCommandToDocument,
  commitSceneHistory,
  createSceneHistory,
  executeSceneCommand,
  redoSceneHistory,
  undoSceneHistory
} from "../web/js/editor/scene-commands.js";
import {
  beginSceneGesture,
  buildSceneSnapTargets,
  createSceneGestureController,
  finishSceneGesture,
  previewSceneGesture,
  resizeSceneGeometry,
  snapSceneGeometry
} from "../web/js/editor/scene-interaction.js";
import {
  advancedStudioState,
  installAdvancedStudio,
  renderAdvancedAssetRail,
  updateTextBlockContent
} from "../web/js/uxr-002/advanced-studio.js";

function fixture(){
  return{
    id:"timeline-scene-proof",
    revision:11,
    mode:"advanced",
    layoutLock:false,
    categories:[{id:"research",label:"Research",color:"#C9A227"}],
    events:[{
      id:"event-1",title:"Research Assistant",categoryId:"research",
      startDate:"2021-07",endDate:"2022-12",
      provenance:{sourceFile:"synthetic-cv.pdf",page:2},confidence:.98
    }],
    advanced:{
      background:{kind:"theme",dim:20},
      media:[{
        id:"photo-1",type:"media",kind:"image",x:120,y:140,width:240,height:160,
        locked:false,aspectLocked:true,zIndex:0,layerIndex:0,
        source:{objectId:"private-object-1",name:"synthetic.jpg"}
      }],
      textBlocks:[{
        id:"text-1",type:"text",text:"Research Assistant",x:520,y:300,width:340,height:96,
        size:30,font:"Inter",weight:700,color:"#17324A",alignment:"left",
        locked:false,aspectLocked:false,zIndex:1,layerIndex:1
      }],
      elements:[{
        id:"shape-1",type:"element",kind:"rounded-rectangle",x:480,y:260,width:420,height:180,
        fill:"#F8F1E8",stroke:"#2C6E8F",locked:false,aspectLocked:true,
        zIndex:2,layerIndex:2
      }],
      groups:[],recentColors:[]
    }
  };
}

test("legacy Advanced state migrates to one valid V1 scene without touching semantic facts",()=>{
  const document=fixture();
  const semantic=structuredClone(document.events);
  const synchronized=synchronizeAdvancedSceneDocument(document);
  assert.deepEqual(document.events,semantic);
  assert.deepEqual(synchronized.events,semantic);
  assert.equal(synchronized.advanced.scene.schema,TIMELINE_SCENE_SCHEMA);
  assert.equal(synchronized.advanced.scene.version,TIMELINE_SCENE_VERSION);
  assert.equal(synchronized.advanced.scene.objects.length,3);
  assert.equal(synchronized.advanced.scene.legacyDigest,sceneLegacyDigest(synchronized.advanced));
  assert.deepEqual(validateSceneGraph(synchronized.advanced.scene),{valid:true,errors:[]});
  assert.equal(sceneObjectById(synchronized.advanced.scene,"photo-1").presentation.source.objectId,"private-object-1");
  assert.equal(advancedStudioState(synchronized).scene.version,1);

  const second=migrateAdvancedScene(synchronized.advanced,{revision:synchronized.revision});
  assert.equal(second.migrated,false,"a valid matching V1 scene must survive save/reload without remigration");
});

test("presentation commands move geometry but categorically reject dates, categories, and provenance",()=>{
  const document=fixture();
  const beforeEvents=structuredClone(document.events);
  const result=applySceneCommandToDocument(document,{
    kind:"geometry",target:{type:"element",id:"shape-1"},
    geometry:{x:700,y:410,width:420,height:180},label:"Move story card"
  });
  assert.equal(result.changed,true);
  assert.deepEqual(result.document.events,beforeEvents);
  assert.equal(result.document.advanced.elements[0].x,700);
  assert.equal(result.document.advanced.scene.revision,12);
  assert.equal(result.document.advanced.scene.legacyDigest,sceneLegacyDigest(result.document.advanced));
  const eventPresentation=applySceneCommandToDocument(result.document,{
    kind:"geometry",
    target:{type:"event",id:"event-1"},
    geometry:{x:640,y:216,width:460,height:54,rotation:0},
    create:{
      type:"event",semanticRef:"event-1",aspectLocked:false,
      presentation:{eventType:"duration"}
    },
    label:"Move Timeline event presentation"
  });
  assert.equal(eventPresentation.changed,true);
  assert.deepEqual(eventPresentation.document.events,beforeEvents);
  assert.deepEqual(
    sceneObjectById(eventPresentation.document.advanced.scene,"event-1").geometry,
    {x:640,y:216,width:460,height:54,rotation:0}
  );
  assert.equal(
    eventPresentation.document.advanced.scene.objects.filter(({type})=>type==="event").length,
    1,
    "a semantic event gets one presentation object, not a duplicate fact record"
  );
  assert.throws(()=>applySceneCommandToDocument(result.document,{
    kind:"geometry",target:{type:"element",id:"shape-1"},
    geometry:{x:10,startDate:"2030-01"}
  }),/cannot mutate semantic facts/);
  assert.throws(()=>executeSceneCommand(result.scene,{
    kind:"text",target:{type:"text",id:"text-1"},text:"Safe label",
    provenance:{sourceFile:"replacement.pdf"}
  }),/cannot mutate semantic facts/);
});

test("ordinary Advanced edits preserve event presentation geometry and semantic facts through reload",()=>{
  const original=fixture();
  original.provenance={sourceFile:"synthetic-cv.pdf",acceptedAt:"2026-08-24T12:00:00Z"};
  const semanticBefore=structuredClone({
    events:original.events,
    categories:original.categories,
    provenance:original.provenance
  });
  const positioned=applySceneCommandToDocument(original,{
    kind:"geometry",
    target:{type:"event",id:"event-1"},
    geometry:{x:684,y:196,width:512,height:58,rotation:0},
    create:{
      type:"event",semanticRef:"event-1",aspectLocked:false,
      presentation:{eventType:"duration",labelPlacement:"above"}
    },
    label:"Position event presentation"
  }).document;
  const eventBefore=structuredClone(sceneObjectById(positioned.advanced.scene,"event-1"));

  const edited=updateTextBlockContent(positioned,"text-1","Research Assistant · revised label");
  assert.deepEqual(
    {events:edited.events,categories:edited.categories,provenance:edited.provenance},
    semanticBefore,
    "presentation reconciliation must never rewrite factual Timeline history"
  );
  assert.deepEqual(
    sceneObjectById(edited.advanced.scene,"event-1"),
    eventBefore,
    "an ordinary legacy-backed edit must not erase or move a scene-native event"
  );
  assert.equal(edited.advanced.scene.legacyDigest,sceneLegacyDigest(edited.advanced));

  const reloaded=advancedStudioState(structuredClone(edited)).scene;
  assert.deepEqual(sceneObjectById(reloaded,"event-1"),eventBefore);
  assert.deepEqual(validateSceneGraph(reloaded),{valid:true,errors:[]});
});

test("scene validation rejects ID collisions, duplicate group ownership, and inconsistent membership",()=>{
  const base=synchronizeAdvancedSceneDocument(fixture()).advanced.scene;

  const colliding=structuredClone(base);
  colliding.groups=[{
    id:"shape-1",childIds:["text-1","photo-1"],locked:false,aspectLocked:true
  }];
  sceneObjectById(colliding,"text-1").groupId="shape-1";
  sceneObjectById(colliding,"photo-1").groupId="shape-1";
  const collisionValidity=validateSceneGraph(colliding);
  assert.equal(collisionValidity.valid,false);
  assert.ok(collisionValidity.errors.includes(
    "Timeline scene object and group IDs must not collide: shape-1."
  ));
  assert.throws(()=>executeSceneCommand(colliding,{
    kind:"geometry",target:{type:"text",id:"text-1"},geometry:{x:600}
  }),/object and group IDs must not collide/);

  const duplicateOwnership=structuredClone(base);
  duplicateOwnership.groups=[
    {id:"group-a",childIds:["shape-1","text-1"],locked:false,aspectLocked:true},
    {id:"group-b",childIds:["shape-1","photo-1"],locked:false,aspectLocked:true}
  ];
  sceneObjectById(duplicateOwnership,"shape-1").groupId="group-a";
  sceneObjectById(duplicateOwnership,"text-1").groupId="group-a";
  sceneObjectById(duplicateOwnership,"photo-1").groupId="group-b";
  const duplicateValidity=validateSceneGraph(duplicateOwnership);
  assert.equal(duplicateValidity.valid,false);
  assert.ok(duplicateValidity.errors.includes(
    "Scene object shape-1 cannot belong to more than one group: group-a, group-b."
  ));

  const inconsistent=structuredClone(base);
  inconsistent.groups=[{
    id:"story-group",childIds:["shape-1","text-1"],locked:false,aspectLocked:true
  }];
  sceneObjectById(inconsistent,"shape-1").groupId="story-group";
  sceneObjectById(inconsistent,"photo-1").groupId="story-group";
  const membershipValidity=validateSceneGraph(inconsistent);
  assert.equal(membershipValidity.valid,false);
  assert.ok(membershipValidity.errors.includes(
    "Scene object text-1 groupId must match its owning group story-group."
  ));
  assert.ok(membershipValidity.errors.includes(
    "Scene object photo-1 declares groupId story-group but is not a child of that group."
  ));
});

test("selection, marquee, grouping, proportional group transform, and ungroup are real scene operations",()=>{
  let scene=synchronizeAdvancedSceneDocument(fixture()).advanced.scene;
  const first=sceneSelection(scene,null,{type:"element",id:"shape-1"});
  const multi=sceneSelection(scene,first,{type:"text",id:"text-1"},{add:true});
  assert.equal(multi.type,"multi");
  assert.deepEqual(new Set(multi.members.map(({id})=>id)),new Set(["shape-1","text-1"]));
  assert.equal(marqueeSceneSelection(scene,{x:450,y:240,width:480,height:220}).type,"multi");

  let result=executeSceneCommand(scene,{
    kind:"group",id:"story-group",members:multi.members
  });
  scene=result.scene;
  assert.deepEqual(sceneGroupById(scene,"story-group").childIds,["shape-1","text-1"]);
  const layered=executeSceneCommand(scene,{
    kind:"layer",target:{type:"group",id:"story-group"},direction:"send-to-back"
  });
  scene=layered.scene;
  assert.deepEqual(
    scene.objects.slice(0,2).map(({id})=>id),
    ["text-1","shape-1"],
    "a grouped composition must move through z-order as one contiguous block"
  );
  assert.throws(()=>executeSceneCommand(scene,{
    kind:"group",id:"nested-without-ungroup",members:[
      {type:"element",id:"shape-1"},{type:"media",id:"photo-1"}
    ]
  }),/Ungroup selected objects/);
  const shapeBefore=structuredClone(sceneObjectById(scene,"shape-1").geometry);
  const textBefore=structuredClone(sceneObjectById(scene,"text-1").geometry);
  result=executeSceneCommand(scene,{
    kind:"geometry",target:{type:"group",id:"story-group"},
    geometry:{x:260,y:180,width:840,height:360}
  });
  scene=result.scene;
  const shapeAfter=sceneObjectById(scene,"shape-1").geometry;
  const textAfter=sceneObjectById(scene,"text-1").geometry;
  assert.ok(shapeAfter.width>shapeBefore.width&&textAfter.width>textBefore.width);
  assert.equal(sceneObjectById(scene,"shape-1").groupId,"story-group");

  result=executeSceneCommand(scene,{kind:"ungroup",target:{type:"group",id:"story-group"}});
  assert.equal(sceneGroupById(result.scene,"story-group"),null);
  assert.equal(sceneObjectById(result.scene,"shape-1").groupId,null);
  assert.equal(result.selection.type,"multi");
});

test("object lock, aspect lock, layer, direct text, duplicate, delete, undo, and redo share one command path",()=>{
  const initial=synchronizeAdvancedSceneDocument(fixture()).advanced.scene;
  let history=createSceneHistory(initial,{limit:8});
  let committed=commitSceneHistory(history,{
    kind:"lock",target:{type:"media",id:"photo-1"},value:true
  });
  history=committed.history;
  assert.equal(sceneObjectById(history.present,"photo-1").locked,true);
  const blocked=commitSceneHistory(history,{
    kind:"geometry",target:{type:"media",id:"photo-1"},geometry:{x:900,y:600}
  });
  assert.equal(blocked.changed,false);
  history=commitSceneHistory(history,{kind:"lock",target:{type:"media",id:"photo-1"},value:false}).history;
  history=commitSceneHistory(history,{kind:"aspect-lock",target:{type:"media",id:"photo-1"},value:false}).history;
  history=commitSceneHistory(history,{kind:"layer",target:{type:"media",id:"photo-1"},direction:"bring-to-front"}).history;
  assert.equal(sceneObjectById(history.present,"photo-1").z,history.present.objects.length-1);
  history=commitSceneHistory(history,{kind:"text",target:{type:"text",id:"text-1"},text:"Edited on canvas"}).history;
  assert.equal(sceneObjectById(history.present,"text-1").presentation.text,"Edited on canvas");
  history=commitSceneHistory(history,{kind:"duplicate",target:{type:"text",id:"text-1"},id:"text-copy"}).history;
  assert.ok(sceneObjectById(history.present,"text-copy"));
  history=commitSceneHistory(history,{kind:"delete",target:{type:"text",id:"text-copy"}}).history;
  assert.equal(sceneObjectById(history.present,"text-copy"),null);
  const undone=undoSceneHistory(history);
  assert.ok(sceneObjectById(undone.history.present,"text-copy"));
  const redone=redoSceneHistory(undone.history);
  assert.equal(sceneObjectById(redone.history.present,"text-copy"),null);
});

test("a locked group blocks every descendant manipulation path in commands and the live kernel",()=>{
  let scene=synchronizeAdvancedSceneDocument(fixture()).advanced.scene;
  scene=executeSceneCommand(scene,{
    kind:"group",id:"locked-composition",members:[
      {type:"element",id:"shape-1"},{type:"text",id:"text-1"}
    ]
  }).scene;
  scene=executeSceneCommand(scene,{
    kind:"lock",target:{type:"group",id:"locked-composition"},value:true
  }).scene;
  const attempts=[
    {kind:"geometry",target:{type:"text",id:"text-1"},geometry:{x:900,y:700}},
    {kind:"text",target:{type:"text",id:"text-1"},text:"Must not change"},
    {kind:"layer",target:{type:"text",id:"text-1"},direction:"bring-to-front"},
    {kind:"duplicate",target:{type:"text",id:"text-1"},id:"locked-copy"},
    {kind:"delete",target:{type:"text",id:"text-1"}},
    {kind:"aspect-lock",target:{type:"element",id:"shape-1"},value:false}
  ];
  for(const command of attempts){
    const result=executeSceneCommand(scene,command);
    assert.equal(result.changed,false,`${command.kind} must not bypass a locked parent group`);
    assert.equal(result.scene,scene,"a blocked command must return the untouched scene");
  }
  assert.equal(sceneObjectById(scene,"text-1").presentation.text,"Research Assistant");
  assert.equal(sceneObjectById(scene,"locked-copy"),null);

  const kernel=readFileSync(new URL("../web/js/d1-411a/kernel-host.js",import.meta.url),"utf8");
  assert.match(kernel,/const parentGroupLocked=/);
  assert.match(kernel,/node\.dataset\.locked==="true"\|\|parentGroupLocked\(node\)/);
  assert.ok((kernel.match(/parentGroupLocked\(node\)/g)||[]).length>=3,
    "text editing, modifier selection, and pointer manipulation must share the parent lock guard");
});

test("snapping covers canvas and nearby object anchors while proportion lock applies at the handles",()=>{
  const scene=synchronizeAdvancedSceneDocument(fixture()).advanced.scene;
  const targets=buildSceneSnapTargets(scene,{type:"media",id:"photo-1"});
  assert.ok(targets.x.includes(960)&&targets.y.includes(540));
  assert.ok(targets.x.includes(480)&&targets.x.includes(690)&&targets.x.includes(900));
  const snap=snapSceneGeometry({x:948,y:530,width:24,height:20},targets,{threshold:14});
  assert.equal(snap.geometry.x,948,"the object center, not its left edge, should snap to board center");
  assert.equal(snap.guides.x,960);
  assert.equal(snap.guides.y,540);

  const locked=resizeSceneGeometry({x:10,y:10,width:200,height:100},"se",100,20,{aspectLocked:true});
  assert.equal(locked.width/locked.height,2);
  const free=resizeSceneGeometry({x:10,y:10,width:200,height:100},"se",100,20,{aspectLocked:false});
  assert.notEqual(free.width/free.height,2);
});

test("the rAF interaction layer coalesces rapid pointer input and commits exactly once on release",()=>{
  const scene=synchronizeAdvancedSceneDocument(fixture()).advanced.scene;
  const frames=[];
  let commits=0;
  let previews=0;
  let receipt=null;
  const controller=createSceneGestureController({
    getScene:()=>scene,
    requestFrame:(callback)=>{frames.push(callback);return frames.length;},
    cancelFrame:()=>{},
    onPreview:()=>{previews+=1;},
    onCommit:(_command,performance)=>{commits+=1;receipt=performance;}
  });
  controller.begin({type:"element",id:"shape-1"},{point:{x:500,y:300},kind:"move",pointerId:9});
  for(let index=1;index<=60;index+=1)controller.move({x:500+index,y:300+index/2});
  assert.equal(frames.length,1,"rapid pointer moves should schedule one animation frame");
  frames[0]();
  assert.equal(previews,1);
  assert.equal(commits,0,"preview frames must not persist or enter history");
  const finished=controller.end();
  assert.equal(finished.changed,true);
  assert.equal(commits,1);
  assert.deepEqual(receipt,{
    pointerMoves:60,previewFrames:1,logicalCommits:1,
    networkRequestsDuringGesture:0,rendererRegenerationsDuringGesture:0
  });

  let direct=beginSceneGesture(scene,{type:"element",id:"shape-1"},{point:{x:0,y:0},kind:"move"});
  direct=previewSceneGesture(direct,{x:50,y:40});
  assert.equal(finishSceneGesture(direct).performance.logicalCommits,1);
});

test("asset rail tiles are real click/drag sources and emit the typed protected-canvas payload",()=>{
  const document=fixture();
  const html=renderAdvancedAssetRail(document,null,{activePanel:"shapes"});
  assert.match(html,/draggable="true"/);
  assert.match(html,/data-advanced-kind="arrow-right"/);
  const listeners=new Map();
  const root={
    addEventListener:(type,handler)=>listeners.set(type,handler),
    removeEventListener:(type)=>listeners.delete(type)
  };
  const control={dataset:{advancedAction:"asset",advancedKind:"arrow-right",advancedSymbol:""}};
  const transferred=new Map();
  installAdvancedStudio(root,{});
  listeners.get("dragstart")({
    target:{closest:(selector)=>selector==="[data-advanced-insert-asset]"?control:null},
    dataTransfer:{
      effectAllowed:"none",
      setData:(type,value)=>transferred.set(type,value)
    }
  });
  assert.deepEqual(JSON.parse(transferred.get("application/x-missionmed-timeline-asset")),{
    kind:"insert",action:"asset",assetKind:"arrow-right",symbol:""
  });
});

test("the fallback AI standard binds to Founder Re-anchor authority rather than stale D1-411A",()=>{
  const source=readFileSync(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
  assert.match(source,/standardVersion:"D1-TIMELINE-FOUNDER-REANCHOR-015\+DR-127"/);
  assert.doesNotMatch(source,/standardVersion:"D1-409H-A1\+D1-411A"/);
});
