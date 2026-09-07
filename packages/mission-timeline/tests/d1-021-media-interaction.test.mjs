import assert from "node:assert/strict";
import test from "node:test";
import {panMediaCrop} from "../web/js/uxr-002/advanced-studio.js";
import {rotateSceneGeometry} from "../web/js/editor/scene-interaction.js";
import {applySceneCommandToDocument,createSceneHistory,commitSceneHistory,undoSceneHistory,redoSceneHistory} from "../web/js/editor/scene-commands.js";
import {synchronizeAdvancedSceneDocument,sceneObjectById} from "../web/js/editor/scene-graph.js";

const geometry={width:200,height:100,imageWidth:300,imageHeight:150};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} ≈ ${expected}`);

test("crop pan follows screen distance at fit, 100%, 150%, and zoomed image sizes",()=>{
  for(const boardScale of [.45,1,1.5]){
    for(const zoom of [1,2,4]){
      const start={x:50,y:50,zoom};
      const dx=8,dy=-4;
      const next=panMediaCrop(start,{
        ...geometry,dx,dy,
        screenToImage:{a:1/(boardScale*zoom),b:0,c:0,d:1/(boardScale*zoom)}
      });
      // Project the changed image origin back to screen pixels.
      const slackX=geometry.imageWidth-geometry.width/zoom;
      const slackY=geometry.imageHeight-geometry.height/zoom;
      close(-(next.x-start.x)/100*slackX*zoom*boardScale,dx);
      close(-(next.y-start.y)/100*slackY*zoom*boardScale,dy);
      assert.deepEqual(start,{x:50,y:50,zoom});
    }
  }
});

test("crop pan tracks the pointer through a rotated photo transform",()=>{
  const angle=37*Math.PI/180,scale=.6,zoom=2;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const start={x:50,y:50,zoom};
  const next=panMediaCrop(start,{
    ...geometry,dx:12,dy:-7,
    screenToImage:{a:cos/(scale*zoom),b:-sin/(scale*zoom),c:sin/(scale*zoom),d:cos/(scale*zoom)}
  });
  const imageX=-(next.x-start.x)/100*(geometry.imageWidth-geometry.width/zoom);
  const imageY=-(next.y-start.y)/100*(geometry.imageHeight-geometry.height/zoom);
  close((cos*imageX-sin*imageY)*scale*zoom,12);
  close((sin*imageX+cos*imageY)*scale*zoom,-7);
});

test("crop stays covered at the edges and does not move an axis without slack",()=>{
  const next=panMediaCrop({x:50,y:50,zoom:1},{...geometry,imageHeight:100,dx:1e4,dy:-1e4});
  assert.deepEqual(next,{x:0,y:50,zoom:1});
  assert.deepEqual(panMediaCrop({x:50,y:50,zoom:1},{...geometry,dx:-1e4,dy:1e4}),{x:100,y:0,zoom:1});
});

test("rotation changes only angle around the original center, including wrap and snap",()=>{
  const original={x:100,y:200,width:200,height:100,rotation:25};
  const quarterTurn=rotateSceneGeometry(original,{x:200,y:150},{x:300,y:250});
  assert.deepEqual(quarterTurn,{...original,rotation:115});
  const angle=17*Math.PI/180;
  const snapped=rotateSceneGeometry({...original,rotation:0},{x:300,y:250},{x:200+Math.cos(angle)*100,y:250+Math.sin(angle)*100},{snapDegrees:15});
  assert.equal(snapped.rotation,15);
  assert.equal(rotateSceneGeometry({...original,rotation:170},{x:200,y:150},{x:300,y:250}).rotation,-100);
  assert.deepEqual(rotateSceneGeometry(original,{x:200,y:250},{x:300,y:250}),original);
  assert.equal(original.rotation,25);
});

test("one rotation command survives canonical reload and Undo/Redo without changing facts or media inventory",()=>{
  const original={mode:"advanced",layoutLock:false,events:[{id:"history-1",title:"Synthetic research",startDate:"2020-01",endDate:"2021-01"}],categories:[],advanced:{
    media:[{id:"upload-1",type:"media",kind:"image",placed:true,libraryAsset:true,x:100,y:200,width:200,height:100,rotation:0,source:{name:"synthetic.png",blobId:"asset-1"}}],textBlocks:[],elements:[],groups:[]
  }};
  const prepared=synchronizeAdvancedSceneDocument(original);
  const object=sceneObjectById(prepared.advanced.scene,"upload-1");
  const geometry=rotateSceneGeometry(object.geometry,{x:200,y:150},{x:300,y:250});
  const command={kind:"geometry",target:{type:"media",id:"upload-1"},geometry,label:"Rotate Timeline object"};
  const result=applySceneCommandToDocument(prepared,command);
  assert.equal(result.changed,true);
  const reloaded=synchronizeAdvancedSceneDocument(JSON.parse(JSON.stringify(result.document)));
  assert.equal(sceneObjectById(reloaded.advanced.scene,"upload-1").geometry.rotation,90);
  assert.equal(reloaded.advanced.media[0].rotation,90);
  assert.equal(reloaded.advanced.media.length,1);
  assert.deepEqual(reloaded.advanced.media[0].source,original.advanced.media[0].source);
  assert.deepEqual(reloaded.events,original.events);
  const committed=commitSceneHistory(createSceneHistory(prepared.advanced.scene),command).history;
  assert.equal(committed.past.length,1);
  const undone=undoSceneHistory(committed).history;
  assert.equal(sceneObjectById(undone.present,"upload-1").geometry.rotation,0);
  assert.equal(sceneObjectById(redoSceneHistory(undone).history.present,"upload-1").geometry.rotation,90);
});
