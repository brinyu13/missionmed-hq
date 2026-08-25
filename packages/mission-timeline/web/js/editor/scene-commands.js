import {
  TIMELINE_SCENE_OBJECT_TYPES,
  assertPresentationOnlyCommand,
  migrateAdvancedScene,
  projectSceneGraphToLegacy,
  sceneBoundsForIds,
  sceneGroupById,
  sceneObjectById,
  sceneTargetBounds,
  synchronizeAdvancedSceneDocument,
  validateSceneGraph
} from "./scene-graph.js";

const clone=(value)=>globalThis.structuredClone
  ?globalThis.structuredClone(value)
  :JSON.parse(JSON.stringify(value));

const finite=(value,fallback=0)=>{
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
};

const positive=(value,fallback=1)=>Math.max(1,finite(value,fallback));

function targetObject(scene,target){
  if(!target||target.type==="group")return null;
  return sceneObjectById(scene,target.id);
}

function targetGroup(scene,target){
  return target?.type==="group"?sceneGroupById(scene,target.id):null;
}

function lockedParentGroup(scene,object){
  return object?.groupId?sceneGroupById(scene,object.groupId):null;
}

function normalizeBox(box={},fallback={x:0,y:0,width:1,height:1,rotation:0},board={width:1920,height:1080}){
  const width=Math.min(positive(board.width,1920),positive(box.width,fallback.width));
  const height=Math.min(positive(board.height,1080),positive(box.height,fallback.height));
  return{
    x:Math.min(Math.max(0,finite(box.x,fallback.x)),Math.max(0,board.width-width)),
    y:Math.min(Math.max(0,finite(box.y,fallback.y)),Math.max(0,board.height-height)),
    width,
    height,
    rotation:finite(box.rotation,fallback.rotation)
  };
}

function bump(scene){
  scene.revision=Math.max(0,Math.trunc(finite(scene.revision,0)))+1;
  scene.legacyDigest="";
}

function reorder(scene,target,direction){
  const ordered=[...scene.objects].sort((left,right)=>left.z-right.z);
  const index=ordered.findIndex((object)=>object.id===target.id);
  if(index<0)return false;
  let destination=index;
  if(direction==="bring-forward")destination=Math.min(ordered.length-1,index+1);
  if(direction==="send-backward")destination=Math.max(0,index-1);
  if(direction==="bring-to-front")destination=ordered.length-1;
  if(direction==="send-to-back")destination=0;
  if(destination===index)return false;
  const [object]=ordered.splice(index,1);
  ordered.splice(destination,0,object);
  ordered.forEach((item,z)=>{item.z=z;});
  scene.objects=ordered;
  return true;
}

function reorderGroup(scene,group,direction){
  const childIds=new Set(group.childIds);
  const ordered=[...scene.objects].sort((left,right)=>left.z-right.z);
  const members=ordered.filter((object)=>childIds.has(object.id));
  const others=ordered.filter((object)=>!childIds.has(object.id));
  if(!members.length||!others.length)return false;
  const firstIndex=Math.min(...members.map((member)=>ordered.indexOf(member)));
  const priorCount=ordered.slice(0,firstIndex).filter((object)=>!childIds.has(object.id)).length;
  const destination=direction==="bring-to-front"
    ?others.length
    :direction==="send-to-back"
      ?0
      :direction==="bring-forward"
        ?Math.min(others.length,priorCount+1)
        :direction==="send-backward"
          ?Math.max(0,priorCount-1)
          :priorCount;
  if(destination===priorCount)return false;
  others.splice(destination,0,...members);
  others.forEach((object,z)=>{object.z=z;});
  scene.objects=others;
  return true;
}

function groupGeometry(scene,group,geometry){
  const current=sceneBoundsForIds(scene,group.childIds);
  if(!current)return false;
  const next=normalizeBox(geometry,current,scene.board);
  if(group.aspectLocked!==false){
    const aspect=current.width/Math.max(1,current.height);
    const widthChanged=Math.abs(next.width-current.width)>=Math.abs(next.height-current.height);
    if(widthChanged)next.height=Math.min(scene.board.height,next.width/aspect);
    else next.width=Math.min(scene.board.width,next.height*aspect);
    next.x=Math.min(next.x,scene.board.width-next.width);
    next.y=Math.min(next.y,scene.board.height-next.height);
  }
  const scaleX=next.width/Math.max(1,current.width);
  const scaleY=next.height/Math.max(1,current.height);
  const childIds=new Set(group.childIds);
  for(const object of scene.objects){
    if(!childIds.has(object.id))continue;
    const original=object.geometry;
    object.geometry={
      x:next.x+(original.x-current.x)*scaleX,
      y:next.y+(original.y-current.y)*scaleY,
      width:Math.max(1,original.width*scaleX),
      height:Math.max(1,original.height*scaleY),
      rotation:original.rotation
    };
    if(object.type==="text"&&object.presentation){
      const scale=Math.min(scaleX,scaleY);
      if(Number.isFinite(Number(object.presentation.size))){
        object.presentation.size=Math.min(300,Math.max(6,Number(object.presentation.size)*scale));
      }
    }
  }
  return JSON.stringify(next)!==JSON.stringify(current);
}

function objectGeometry(scene,object,geometry){
  const current=object.geometry;
  const next=normalizeBox(geometry,current,scene.board);
  if(object.aspectLocked!==false){
    const ratio=current.width/Math.max(1,current.height);
    const suppliedWidth=Object.hasOwn(geometry,"width");
    const suppliedHeight=Object.hasOwn(geometry,"height");
    if(suppliedWidth&&suppliedHeight){
      const widthDelta=Math.abs(next.width-current.width);
      const heightDelta=Math.abs(next.height-current.height);
      if(widthDelta>=heightDelta)next.height=next.width/ratio;
      else next.width=next.height*ratio;
    }else if(suppliedWidth)next.height=next.width/ratio;
    else if(suppliedHeight)next.width=next.height*ratio;
    next.width=Math.min(scene.board.width,next.width);
    next.height=Math.min(scene.board.height,next.height);
    next.x=Math.min(next.x,scene.board.width-next.width);
    next.y=Math.min(next.y,scene.board.height-next.height);
  }
  if(JSON.stringify(next)===JSON.stringify(current))return false;
  object.geometry=next;
  return true;
}

function memberTargets(command={}){
  return(command.members||command.targets||[]).map((target)=>({
    type:String(target?.type||""),id:String(target?.id||"")
  })).filter(({type,id})=>TIMELINE_SCENE_OBJECT_TYPES.includes(type)&&id);
}

function uniqueId(scene,id){
  const normalized=String(id||"").trim();
  if(!normalized)throw new TypeError("A unique scene object ID is required.");
  if(scene.objects.some((object)=>object.id===normalized)||scene.groups.some((group)=>group.id===normalized)){
    throw new TypeError(`Timeline scene ID already exists: ${normalized}`);
  }
  return normalized;
}

function addObject(scene,command){
  const source=clone(command.object||{});
  const id=uniqueId(scene,source.id||command.id);
  const type=String(source.type||command.target?.type||"");
  if(!TIMELINE_SCENE_OBJECT_TYPES.includes(type))throw new TypeError("A supported presentation scene object is required.");
  const geometry=normalizeBox(source.geometry||source,{
    x:scene.board.width/2-80,y:scene.board.height/2-50,width:160,height:100,rotation:0
  },scene.board);
  scene.objects.push({
    id,type,geometry,
    locked:source.locked===true,
    aspectLocked:source.aspectLocked!==false,
    z:scene.objects.length,
    groupId:null,
    semanticRef:source.semanticRef?String(source.semanticRef):null,
    presentation:clone(source.presentation||{})
  });
  return{changed:true,selection:{type,id}};
}

function duplicateObject(scene,object,command){
  const id=uniqueId(scene,command.id||command.duplicateId);
  const offset=finite(command.offset,24);
  const duplicate=clone(object);
  duplicate.id=id;
  duplicate.groupId=null;
  duplicate.locked=false;
  duplicate.z=scene.objects.length;
  duplicate.geometry=normalizeBox({
    ...duplicate.geometry,
    x:duplicate.geometry.x+offset,
    y:duplicate.geometry.y+offset
  },duplicate.geometry,scene.board);
  scene.objects.push(duplicate);
  return{changed:true,selection:{type:duplicate.type,id}};
}

function duplicateGroup(scene,group,command){
  const id=uniqueId(scene,command.id||command.duplicateId);
  const offset=finite(command.offset,24);
  const children=[];
  const reserved=new Set([...scene.objects.map(({id})=>id),...scene.groups.map(({id})=>id),id]);
  group.childIds.forEach((childId,index)=>{
    const source=sceneObjectById(scene,childId);
    if(!source)return;
    const childNewId=String(command.childIds?.[index]||`${id}-${source.type}-${index}`);
    if(!childNewId||reserved.has(childNewId))throw new TypeError(`Timeline scene ID already exists: ${childNewId}`);
    reserved.add(childNewId);
    const next=clone(source);
    next.id=childNewId;
    next.groupId=id;
    next.locked=false;
    next.z=scene.objects.length;
    next.geometry=normalizeBox({
      ...next.geometry,x:next.geometry.x+offset,y:next.geometry.y+offset
    },next.geometry,scene.board);
    scene.objects.push(next);
    children.push(childNewId);
  });
  if(children.length<2)throw new TypeError("A duplicated group requires at least two children.");
  scene.groups.push({...clone(group),id,childIds:children,locked:false});
  return{changed:true,selection:{type:"group",id}};
}

export function executeSceneCommand(inputScene={},command={}){
  assertPresentationOnlyCommand(command);
  const scene=clone(inputScene);
  const validity=validateSceneGraph(scene);
  if(!validity.valid)throw new TypeError(validity.errors.join(" "));
  const kind=String(command.kind||"");
  const target=command.target||{};
  const object=targetObject(scene,target);
  const group=targetGroup(scene,target);
  const parentGroup=lockedParentGroup(scene,object);
  let changed=false;
  let selection=target?.id?{type:String(target.type),id:String(target.id)}:null;
  let label=String(command.label||"");

  // A locked group is the manipulation boundary for every descendant. Without
  // this guard a child could still be edited, layered, duplicated, or deleted
  // by addressing its object ID directly even though the group looked locked.
  if(parentGroup?.locked===true){
    return{scene:inputScene,changed:false,selection,label:null};
  }

  if(kind==="add"){
    const result=addObject(scene,command);
    changed=result.changed;selection=result.selection;label=label||"Add Timeline object";
  }else if(kind==="geometry"){
    if(!object&&!group&&command.create){
      const result=addObject(scene,{
        object:{
          ...clone(command.create),
          id:String(target.id||command.create.id||""),
          type:String(target.type||command.create.type||""),
          geometry:command.geometry||command.create.geometry
        }
      });
      changed=result.changed;selection=result.selection;
      label=label||"Place Timeline presentation object";
    }else{
    if((object?.locked||group?.locked)===true)return{scene:inputScene,changed:false,selection,label:null};
    changed=group
      ?groupGeometry(scene,group,command.geometry||{})
      :object
        ?objectGeometry(scene,object,command.geometry||{})
        :false;
    label=label||(group?"Transform Timeline group":"Transform Timeline object");
    }
  }else if(kind==="lock"||kind==="aspect-lock"){
    const item=group||object;
    if(!item)return{scene:inputScene,changed:false,selection,label:null};
    const field=kind==="lock"?"locked":"aspectLocked";
    const value=command.value===true;
    changed=item[field]!==value;
    item[field]=value;
    label=label||(kind==="lock"?"Change object lock":"Change proportion lock");
  }else if(kind==="layer"){
    if(!object&&!group)return{scene:inputScene,changed:false,selection,label:null};
    changed=group
      ?reorderGroup(scene,group,String(command.direction||""))
      :reorder(scene,target,String(command.direction||""));
    label=label||"Change Timeline layer";
  }else if(kind==="text"){
    if(!object||object.type!=="text")return{scene:inputScene,changed:false,selection,label:null};
    const text=String(command.text??"");
    changed=String(object.presentation?.text??"")!==text;
    object.presentation={...(object.presentation||{}),text};
    label=label||"Edit Timeline text";
  }else if(kind==="group"){
    const members=memberTargets(command);
    const childIds=[...new Set(members.map(({id})=>id))];
    if(childIds.length<2)throw new TypeError("Select at least two Timeline objects to group.");
    if(childIds.some((id)=>!sceneObjectById(scene,id)))throw new TypeError("A selected Timeline object is missing.");
    if(childIds.some((id)=>sceneObjectById(scene,id)?.groupId))throw new TypeError("Ungroup selected objects before creating a new group.");
    const id=uniqueId(scene,command.id);
    scene.groups.push({id,childIds,locked:false,aspectLocked:command.aspectLocked!==false});
    for(const childId of childIds)sceneObjectById(scene,childId).groupId=id;
    changed=true;selection={type:"group",id};label=label||"Group Timeline objects";
  }else if(kind==="ungroup"){
    if(!group)return{scene:inputScene,changed:false,selection:null,label:null};
    const children=new Set(group.childIds);
    scene.objects.forEach((candidate)=>{if(children.has(candidate.id))candidate.groupId=null;});
    scene.groups=scene.groups.filter((candidate)=>candidate.id!==group.id);
    changed=true;
    const members=group.childIds.map((id)=>{
      const child=sceneObjectById(scene,id);
      return child?{type:child.type,id}:null;
    }).filter(Boolean);
    selection=members.length>1?{type:"multi",members}:members[0]||null;
    label=label||"Ungroup Timeline objects";
  }else if(kind==="duplicate"){
    if(group){
      const result=duplicateGroup(scene,group,command);
      changed=result.changed;selection=result.selection;
    }else if(object){
      const result=duplicateObject(scene,object,command);
      changed=result.changed;selection=result.selection;
    }
    label=label||"Duplicate Timeline object";
  }else if(kind==="delete"){
    if(group){
      const children=new Set(group.childIds);
      scene.objects=scene.objects.filter((candidate)=>!children.has(candidate.id));
      scene.groups=scene.groups.filter((candidate)=>candidate.id!==group.id);
      changed=true;
    }else if(object){
      scene.objects=scene.objects.filter((candidate)=>candidate.id!==object.id);
      scene.groups=scene.groups.map((candidate)=>({
        ...candidate,childIds:candidate.childIds.filter((id)=>id!==object.id)
      })).filter((candidate)=>candidate.childIds.length>=2);
      changed=true;
    }
    selection=null;label=label||"Delete Timeline object";
  }else{
    throw new RangeError(`Unsupported Timeline scene command: ${kind}`);
  }

  if(!changed)return{scene:inputScene,changed:false,selection,label:null};
  bump(scene);
  const nextValidity=validateSceneGraph(scene);
  if(!nextValidity.valid)throw new TypeError(nextValidity.errors.join(" "));
  return{scene,changed:true,selection,label};
}

function semanticSnapshot(document={}){
  return JSON.stringify({
    events:document.events||[],
    categories:document.categories||[],
    provenance:document.provenance||null
  });
}

export function applySceneCommandToDocument(document={},command={}){
  const semanticBefore=semanticSnapshot(document);
  const synchronized=synchronizeAdvancedSceneDocument(document);
  const migration=migrateAdvancedScene(synchronized.advanced,{revision:synchronized.revision});
  const result=executeSceneCommand(migration.scene,command);
  if(!result.changed)return{document,changed:false,selection:result.selection,label:null,scene:migration.scene};
  const next=clone(synchronized);
  next.advanced=projectSceneGraphToLegacy(next.advanced,result.scene);
  if(semanticSnapshot(next)!==semanticBefore){
    throw new Error("Presentation command attempted to alter semantic Timeline facts.");
  }
  return{document:next,changed:true,selection:result.selection,label:result.label,scene:next.advanced.scene};
}

export function createSceneHistory(scene={}, {limit=100}={}){
  const validity=validateSceneGraph(scene);
  if(!validity.valid)throw new TypeError(validity.errors.join(" "));
  return{present:clone(scene),past:[],future:[],limit:Math.max(1,Math.trunc(finite(limit,100)))};
}

export function commitSceneHistory(history={},command={}){
  const result=executeSceneCommand(history.present,command);
  if(!result.changed)return{history,changed:false,selection:result.selection,label:null};
  const past=[...(history.past||[]),clone(history.present)].slice(-Math.max(1,history.limit||100));
  return{
    history:{...history,past,present:result.scene,future:[]},
    changed:true,selection:result.selection,label:result.label
  };
}

export function undoSceneHistory(history={}){
  if(!history.past?.length)return{history,changed:false};
  const prior=history.past.at(-1);
  return{
    history:{...history,past:history.past.slice(0,-1),present:clone(prior),future:[clone(history.present),...(history.future||[])]},
    changed:true
  };
}

export function redoSceneHistory(history={}){
  if(!history.future?.length)return{history,changed:false};
  const next=history.future[0];
  return{
    history:{...history,past:[...(history.past||[]),clone(history.present)].slice(-Math.max(1,history.limit||100)),present:clone(next),future:history.future.slice(1)},
    changed:true
  };
}

export function sceneCommandForGesture(scene={},target={},geometry={},kind="move"){
  const original=sceneTargetBounds(scene,target);
  if(!original)return null;
  return{
    kind:"geometry",
    target:{type:String(target.type),id:String(target.id)},
    geometry:clone(geometry),
    label:kind==="resize"
      ?target.type==="group"?"Resize Timeline group":"Resize Timeline object"
      :target.type==="group"?"Move Timeline group":"Move Timeline object"
  };
}
