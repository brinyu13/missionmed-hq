import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptySceneGraph,reconcileAdvancedScene,migrateAdvancedScene,synchronizeAdvancedSceneDocument} from '../web/js/editor/scene-graph.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
const document=()=>({id:'scene-synthetic',revision:1,studentProfile:{fullName:'Synthetic Scene'},events:[{id:'event',title:'Research',categoryId:'research',eventType:'duration',startDate:'2024-01',endDate:'2024-06',visibilityState:'INTERVIEWER_SAFE'}],advanced:{media:[],textBlocks:[],elements:[],groups:[],scene:{...createEmptySceneGraph(),objects:[{id:'manual',type:'event',semanticRef:'event',geometry:{x:800,y:600,width:600,height:50,rotation:0},locked:false,aspectLocked:true,z:0,groupId:null,presentation:{}}]}}});
test('valid manual geometry remains unchanged through presentation and passive migration',()=>{
 const doc=document(),before=JSON.stringify(doc);assert.deepEqual(reconcileAdvancedScene(doc.advanced).objects[0].geometry,doc.advanced.scene.objects[0].geometry);serializeFounderPresentation(doc);assert.equal(JSON.stringify(doc),before);
});
test('corrupt saved geometry is preserved for recovery and never replaced by generated lanes',()=>{
 const doc=document();doc.advanced.scene.objects.push(structuredClone(doc.advanced.scene.objects[0]));const before=JSON.stringify(doc);
 const migration=migrateAdvancedScene(doc.advanced);assert.equal(migration.recovery.code,'TIMELINE_SCENE_RECOVERY_REQUIRED');assert.deepEqual(migration.scene,doc.advanced.scene);
 assert.deepEqual(synchronizeAdvancedSceneDocument(doc).advanced.scene,doc.advanced.scene);
 assert.throws(()=>serializeFounderPresentation(doc),e=>e.code==='TIMELINE_SCENE_RECOVERY_REQUIRED');
 assert.throws(()=>applySceneCommandToDocument(doc,{kind:'move',target:{type:'event',id:'manual'},dx:10,dy:0}));assert.equal(JSON.stringify(doc),before);
});

test('unsupported scene versions, schemas, and malformed records remain available for recovery',()=>{
 for(const change of [scene=>scene.version=99,scene=>scene.schema='future.scene',scene=>scene.objects.push(null),scene=>scene.groups.push(null)]){
  const doc=document();change(doc.advanced.scene);const before=structuredClone(doc.advanced.scene);
  assert.deepEqual(migrateAdvancedScene(doc.advanced).scene,before);assert.deepEqual(synchronizeAdvancedSceneDocument(doc).advanced.scene,before);
  assert.throws(()=>serializeFounderPresentation(doc),error=>error.code==='TIMELINE_SCENE_RECOVERY_REQUIRED');
 }
});
test('a genuine legacy document with no stored scene still migrates normally',()=>{
 const doc=document();delete doc.advanced.scene;const migrated=migrateAdvancedScene(doc.advanced);assert.equal(migrated.migrated,true);assert.equal(migrated.recovery,undefined);assert.equal(migrated.scene.objects.length,0);
});

test('arbitrary persisted scene JSON cannot throw an uncoded load error or be replaced',()=>{
 const bad=[false,0,'future',[],{}, {...createEmptySceneGraph(),objects:'bad'}, {...createEmptySceneGraph(),groups:'bad'}, {...createEmptySceneGraph(),groups:[{id:'group',childIds:3}]}];
 for(const scene of bad){const doc=document();doc.advanced.scene=scene;assert.deepEqual(synchronizeAdvancedSceneDocument(doc).advanced.scene,scene);assert.throws(()=>serializeFounderPresentation(doc),error=>error.code==='TIMELINE_SCENE_RECOVERY_REQUIRED');}
});
