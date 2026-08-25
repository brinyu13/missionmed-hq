import {
  sceneGroupById,
  sceneObjectById,
  sceneTargetBounds
} from "./scene-graph.js";

const clone=(value)=>globalThis.structuredClone
  ?globalThis.structuredClone(value)
  :JSON.parse(JSON.stringify(value));

const finite=(value,fallback=0)=>{
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
};

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

const HANDLES=new Set(["n","ne","e","se","s","sw","w","nw"]);

function selectionIds(scene,target){
  if(target?.type!=="group")return new Set([String(target?.id||"")]);
  return new Set(sceneGroupById(scene,target.id)?.childIds||[]);
}

function targetLock(scene,target){
  return target?.type==="group"
    ?sceneGroupById(scene,target.id)?.locked===true
    :sceneObjectById(scene,target?.id)?.locked===true;
}

function targetAspectLock(scene,target){
  return target?.type==="group"
    ?sceneGroupById(scene,target.id)?.aspectLocked!==false
    :sceneObjectById(scene,target?.id)?.aspectLocked!==false;
}

export function buildSceneSnapTargets(scene={},target={}){
  const excluded=selectionIds(scene,target);
  const x=[0,finite(scene.board?.width,1920)/2,finite(scene.board?.width,1920)];
  const y=[0,finite(scene.board?.height,1080)/2,finite(scene.board?.height,1080)];
  for(const object of scene.objects||[]){
    if(excluded.has(String(object.id)))continue;
    const box=object.geometry;
    x.push(box.x,box.x+box.width/2,box.x+box.width);
    y.push(box.y,box.y+box.height/2,box.y+box.height);
  }
  return{x:[...new Set(x)],y:[...new Set(y)]};
}

export function snapSceneGeometry(geometry={},targets={x:[],y:[]},{threshold=12}={}){
  const next={...geometry};
  const xAnchors=[next.x,next.x+next.width/2,next.x+next.width];
  const yAnchors=[next.y,next.y+next.height/2,next.y+next.height];
  let bestX=null,bestY=null;
  for(const target of targets.x||[]){
    for(const anchor of xAnchors){
      const distance=Math.abs(target-anchor);
      if(distance<=threshold&&(!bestX||distance<bestX.distance))bestX={target,delta:target-anchor,distance};
    }
  }
  for(const target of targets.y||[]){
    for(const anchor of yAnchors){
      const distance=Math.abs(target-anchor);
      if(distance<=threshold&&(!bestY||distance<bestY.distance))bestY={target,delta:target-anchor,distance};
    }
  }
  if(bestX)next.x+=bestX.delta;
  if(bestY)next.y+=bestY.delta;
  return{
    geometry:next,
    guides:{x:bestX?.target??null,y:bestY?.target??null}
  };
}

export function resizeSceneGeometry(original={},handle="se",dx=0,dy=0,{
  aspectLocked=true,
  minimumWidth=32,
  minimumHeight=24
}={}){
  const edge=HANDLES.has(handle)?handle:"se";
  const next={...original};
  const west=edge.includes("w"),east=edge.includes("e");
  const north=edge.includes("n"),south=edge.includes("s");
  if(west){next.x=original.x+dx;next.width=original.width-dx;}
  if(east)next.width=original.width+dx;
  if(north){next.y=original.y+dy;next.height=original.height-dy;}
  if(south)next.height=original.height+dy;
  if(next.width<minimumWidth){
    if(west)next.x-=minimumWidth-next.width;
    next.width=minimumWidth;
  }
  if(next.height<minimumHeight){
    if(north)next.y-=minimumHeight-next.height;
    next.height=minimumHeight;
  }
  if(aspectLocked&&(west||east)&&(north||south)){
    const ratio=original.width/Math.max(1,original.height);
    const widthDriven=Math.abs(next.width-original.width)>=Math.abs(next.height-original.height)*ratio;
    if(widthDriven){
      const targetHeight=next.width/ratio;
      if(north)next.y=original.y+original.height-targetHeight;
      next.height=targetHeight;
    }else{
      const targetWidth=next.height*ratio;
      if(west)next.x=original.x+original.width-targetWidth;
      next.width=targetWidth;
    }
  }
  return next;
}

function constrain(box,board){
  const width=Math.min(board.width,Math.max(1,box.width));
  const height=Math.min(board.height,Math.max(1,box.height));
  return{
    ...box,width,height,
    x:clamp(box.x,0,Math.max(0,board.width-width)),
    y:clamp(box.y,0,Math.max(0,board.height-height))
  };
}

export function beginSceneGesture(scene={},target={}, {
  kind="move",
  handle="",
  pointerId=null,
  point={x:0,y:0},
  threshold=12
}={}){
  const original=sceneTargetBounds(scene,target);
  if(!original)throw new Error("The selected Timeline object is no longer available.");
  if(targetLock(scene,target))throw new Error("Unlock this Timeline object before moving or resizing it.");
  return{
    active:true,
    sceneRevision:Number(scene.revision||0),
    target:{type:String(target.type),id:String(target.id)},
    kind:kind==="resize"?"resize":"move",
    handle:kind==="resize"&&HANDLES.has(handle)?handle:"se",
    pointerId,
    start:{x:finite(point.x,0),y:finite(point.y,0)},
    point:{x:finite(point.x,0),y:finite(point.y,0)},
    original:clone(original),
    preview:clone(original),
    aspectLocked:targetAspectLock(scene,target),
    snapTargets:buildSceneSnapTargets(scene,target),
    threshold:Math.max(0,finite(threshold,12)),
    guides:{x:null,y:null},
    pointerMoves:0,
    previewFrames:0
  };
}

export function previewSceneGesture(transaction={},point={}, {
  snapDisabled=false,
  freeAspect=false,
  countPointerMove=true,
  board={width:1920,height:1080}
}={}){
  if(!transaction.active)throw new Error("Timeline scene gesture is not active.");
  const next=clone(transaction);
  next.point={x:finite(point.x,next.point.x),y:finite(point.y,next.point.y)};
  if(countPointerMove)next.pointerMoves+=1;
  const dx=next.point.x-next.start.x;
  const dy=next.point.y-next.start.y;
  let geometry;
  if(next.kind==="resize"){
    geometry=resizeSceneGeometry(next.original,next.handle,dx,dy,{
      aspectLocked:next.aspectLocked&&!freeAspect
    });
    geometry=constrain(geometry,board);
    next.guides={x:null,y:null};
  }else{
    geometry=constrain({...next.original,x:next.original.x+dx,y:next.original.y+dy},board);
    if(!snapDisabled){
      const snapped=snapSceneGeometry(geometry,next.snapTargets,{threshold:next.threshold});
      geometry=constrain(snapped.geometry,board);
      next.guides=snapped.guides;
    }else next.guides={x:null,y:null};
  }
  next.preview=geometry;
  next.previewFrames+=1;
  return next;
}

export function finishSceneGesture(transaction={}){
  if(!transaction.active)return{changed:false,transaction,command:null};
  const changed=JSON.stringify(transaction.preview)!==JSON.stringify(transaction.original);
  const finished={...clone(transaction),active:false};
  return{
    changed,
    transaction:finished,
    command:changed?{
      kind:"geometry",
      target:clone(transaction.target),
      geometry:clone(transaction.preview),
      label:transaction.kind==="resize"
        ?transaction.target.type==="group"?"Resize Timeline group":"Resize Timeline object"
        :transaction.target.type==="group"?"Move Timeline group":"Move Timeline object"
    }:null,
    performance:{
      pointerMoves:transaction.pointerMoves,
      previewFrames:transaction.previewFrames,
      logicalCommits:changed?1:0,
      networkRequestsDuringGesture:0,
      rendererRegenerationsDuringGesture:0
    }
  };
}

/*
 * High-frequency pointer coordinator.  onPreview updates only local DOM/CSS.
 * onCommit is invoked at most once, after pointer-up.  It intentionally knows
 * nothing about fetch, autosave, or the protected renderer.
 */
export function createSceneGestureController({
  getScene,
  onPreview=()=>{},
  onCommit=()=>{},
  onCancel=()=>{},
  requestFrame=(callback)=>globalThis.requestAnimationFrame(callback),
  cancelFrame=(id)=>globalThis.cancelAnimationFrame(id),
  board={width:1920,height:1080}
}={}){
  if(typeof getScene!=="function")throw new TypeError("A Timeline scene reader is required.");
  let transaction=null;
  let pending=null;
  let frame=0;
  let modifiers={};

  const flush=()=>{
    frame=0;
    if(!transaction||!pending)return transaction;
    transaction=previewSceneGesture(transaction,pending,{
      ...modifiers,board,countPointerMove:false
    });
    pending=null;
    onPreview(clone(transaction.preview),clone(transaction.guides),clone(transaction));
    return transaction;
  };

  const begin=(target,options={})=>{
    if(transaction)throw new Error("A Timeline scene gesture is already active.");
    transaction=beginSceneGesture(getScene(),target,options);
    pending=null;modifiers={};
    return clone(transaction);
  };

  const move=(point,options={})=>{
    if(!transaction)return false;
    transaction.pointerMoves+=1;
    pending={x:finite(point?.x,0),y:finite(point?.y,0)};
    modifiers={snapDisabled:options.snapDisabled===true,freeAspect:options.freeAspect===true};
    if(!frame)frame=requestFrame(flush);
    return true;
  };

  const end=()=>{
    if(!transaction)return{changed:false,command:null};
    if(frame){cancelFrame(frame);frame=0;}
    flush();
    const result=finishSceneGesture(transaction);
    transaction=null;pending=null;modifiers={};
    if(result.changed)onCommit(clone(result.command),clone(result.performance));
    return result;
  };

  const cancel=()=>{
    if(!transaction)return false;
    if(frame){cancelFrame(frame);frame=0;}
    const original=clone(transaction.original);
    transaction=null;pending=null;modifiers={};
    onCancel(original);
    return true;
  };

  return{
    begin,move,end,cancel,flush,
    get active(){return!!transaction;},
    get transaction(){return transaction?clone(transaction):null;}
  };
}
