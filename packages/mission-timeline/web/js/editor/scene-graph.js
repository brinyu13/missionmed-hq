/*
 * MissionMed Timeline presentation scene graph.
 *
 * Semantic Timeline facts deliberately do not live here.  An object may point
 * at a semantic event through semanticRef, but Advanced Studio commands only
 * change presentation geometry/style.  That separation is the product law
 * that lets a student move an arrow without changing its dates.
 */

export const TIMELINE_SCENE_SCHEMA="missionmed.timeline.presentation-scene";
export const TIMELINE_SCENE_VERSION=1;
export const TIMELINE_SCENE_BOARD=Object.freeze({width:1920,height:1080});
export const TIMELINE_SCENE_OBJECT_TYPES=Object.freeze(["media","text","element","event"]);

const LEGACY_SCENE_OBJECT_TYPES=Object.freeze(["media","text","element"]);

const COLLECTION_BY_TYPE=Object.freeze({
  media:"media",
  text:"textBlocks",
  element:"elements"
});

const PRESENTATION_FIELDS=new Set([
  "id","type","x","y","width","height","rotation","locked",
  "aspectLocked","layerIndex","zIndex","groupId","semanticRef"
]);

const SEMANTIC_FACT_FIELDS=new Set([
  "startDate","endDate","startMonth","endMonth","date","dates",
  "categoryId","category","chronology","provenance","confidence",
  "sourceEvidence","sourceSpan","sourcePage"
]);

const clone=(value)=>globalThis.structuredClone
  ?globalThis.structuredClone(value)
  :JSON.parse(JSON.stringify(value));

const finite=(value,fallback=0)=>{
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
};

const positive=(value,fallback=1)=>Math.max(1,finite(value,fallback));

const integer=(value,fallback=0)=>Math.trunc(finite(value,fallback));

function stableString(value){
  if(Array.isArray(value))return`[${value.map(stableString).join(",")}]`;
  if(value&&typeof value==="object"){
    return`{${Object.keys(value).sort().map((key)=>`${JSON.stringify(key)}:${stableString(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value){
  let hash=0x811c9dc5;
  for(let index=0;index<value.length;index+=1){
    hash^=value.charCodeAt(index);
    hash=Math.imul(hash,0x01000193);
  }
  return(hash>>>0).toString(16).padStart(8,"0");
}

function normalizedGeometry(item={}){
  return{
    x:finite(item.x,0),
    y:finite(item.y,0),
    width:positive(item.width,item.type==="text"?320:120),
    height:positive(item.height,item.type==="text"?72:96),
    rotation:finite(item.rotation,0)
  };
}

function presentationPayload(item={}){
  const payload={};
  for(const [key,value] of Object.entries(item)){
    if(PRESENTATION_FIELDS.has(key)||SEMANTIC_FACT_FIELDS.has(key))continue;
    payload[key]=clone(value);
  }
  return payload;
}

function normalizedObject(item,type,z){
  const id=String(item?.id||"").trim();
  if(!id)throw new TypeError("Every Timeline scene object requires an ID.");
  if(!TIMELINE_SCENE_OBJECT_TYPES.includes(type))throw new TypeError(`Unsupported Timeline scene object type: ${type}`);
  return{
    id,
    type,
    geometry:normalizedGeometry({...item,type}),
    locked:item?.locked===true,
    aspectLocked:item?.aspectLocked!==false,
    z:integer(item?.zIndex,item?.layerIndex??z),
    groupId:item?.groupId?String(item.groupId):null,
    semanticRef:item?.semanticRef?String(item.semanticRef):null,
    presentation:presentationPayload(item)
  };
}

function normalizedGroup(group={},knownIds=new Set()){
  const id=String(group.id||"").trim();
  if(!id)throw new TypeError("Every Timeline scene group requires an ID.");
  const childIds=[...new Set((group.childIds||group.children||[]).map((child)=>{
    if(typeof child==="string")return child.includes(":")?child.split(":").slice(1).join(":"):child;
    return String(child?.id||"");
  }).filter((childId)=>childId&&knownIds.has(childId)))];
  return{
    id,
    childIds,
    locked:group.locked===true,
    aspectLocked:group.aspectLocked!==false
  };
}

export function sceneLegacyDigest(advanced={}){
  const source={
    media:Array.isArray(advanced.media)?advanced.media:[],
    textBlocks:Array.isArray(advanced.textBlocks)?advanced.textBlocks:[],
    elements:Array.isArray(advanced.elements)?advanced.elements:[],
    groups:Array.isArray(advanced.groups)?advanced.groups:[]
  };
  return`fnv1a:${fnv1a(stableString(source))}`;
}

export function createEmptySceneGraph({revision=0,board=TIMELINE_SCENE_BOARD}={}){
  return{
    schema:TIMELINE_SCENE_SCHEMA,
    version:TIMELINE_SCENE_VERSION,
    revision:Math.max(0,integer(revision,0)),
    board:{
      width:positive(board?.width,TIMELINE_SCENE_BOARD.width),
      height:positive(board?.height,TIMELINE_SCENE_BOARD.height)
    },
    objects:[],
    groups:[],
    legacyDigest:sceneLegacyDigest({})
  };
}

export function sceneGraphFromLegacy(advanced={}, {revision=0}={}){
  const objects=[];
  for(const type of LEGACY_SCENE_OBJECT_TYPES){
    const collection=Array.isArray(advanced[COLLECTION_BY_TYPE[type]])
      ?advanced[COLLECTION_BY_TYPE[type]]
      :[];
    for(const item of collection)objects.push(normalizedObject(item,type,objects.length));
  }
  const ids=new Set(objects.map(({id})=>id));
  if(ids.size!==objects.length)throw new TypeError("Timeline scene object IDs must be unique across media, text, and elements.");
  const groups=(Array.isArray(advanced.groups)?advanced.groups:[])
    .map((group)=>normalizedGroup(group,ids))
    .filter((group)=>group.childIds.length>=2);
  const groupIds=new Set(groups.map(({id})=>id));
  if(groupIds.size!==groups.length)throw new TypeError("Timeline scene group IDs must be unique.");
  for(const object of objects){
    if(object.groupId&&!groupIds.has(object.groupId))object.groupId=null;
  }
  return{
    ...createEmptySceneGraph({revision}),
    objects,
    groups,
    legacyDigest:sceneLegacyDigest(advanced)
  };
}

/*
 * Legacy compatibility arrays still back media, text, and library elements
 * during the re-anchor. Event presentation objects have no legacy collection,
 * so rebuilding solely from those arrays would erase their freeform geometry.
 * Reconcile the current arrays with a valid stored scene and preserve only the
 * scene-native event objects; semantic event facts remain outside this module.
 */
export function reconcileAdvancedScene(advanced={}, {revision=0}={}){
  const rebuilt=sceneGraphFromLegacy(advanced,{revision});
  const stored=advanced?.scene;
  const supported=stored?.schema===TIMELINE_SCENE_SCHEMA&&Number(stored?.version)===TIMELINE_SCENE_VERSION;
  if(!supported)return rebuilt;
  const prior=normalizeStoredScene(stored);
  if(!validateSceneGraph(prior).valid)return rebuilt;
  const sceneOnly=prior.objects.filter((object)=>object.type==="event");
  if(!sceneOnly.length)return rebuilt;

  const knownIds=new Set(rebuilt.objects.map(({id})=>id));
  for(const object of sceneOnly){
    if(knownIds.has(object.id))throw new TypeError(`Timeline scene ID already exists: ${object.id}`);
    knownIds.add(object.id);
  }
  const groups=(Array.isArray(advanced.groups)?advanced.groups:[])
    .map((group)=>normalizedGroup(group,knownIds))
    .filter((group)=>group.childIds.length>=2);
  const groupIds=new Set(groups.map(({id})=>id));
  if(groupIds.size!==groups.length)throw new TypeError("Timeline scene group IDs must be unique.");
  const membership=new Map();
  for(const group of groups){
    for(const childId of group.childIds)membership.set(childId,group.id);
  }
  const objects=[...rebuilt.objects,...sceneOnly]
    .map((object,index)=>({...object,groupId:membership.get(object.id)||null,__order:index}))
    .sort((left,right)=>left.z-right.z||left.__order-right.__order)
    .map((object,z)=>{
      const next={...object,z};
      delete next.__order;
      return next;
    });
  const scene={
    ...rebuilt,
    revision:Math.max(rebuilt.revision,prior.revision),
    board:clone(prior.board),
    objects,
    groups
  };
  const validity=validateSceneGraph(scene);
  if(!validity.valid)throw new TypeError(validity.errors.join(" "));
  return scene;
}

function normalizeStoredScene(scene={}){
  const board={
    width:positive(scene.board?.width,TIMELINE_SCENE_BOARD.width),
    height:positive(scene.board?.height,TIMELINE_SCENE_BOARD.height)
  };
  const objects=(Array.isArray(scene.objects)?scene.objects:[]).map((item,index)=>({
    id:String(item?.id||"").trim(),
    type:TIMELINE_SCENE_OBJECT_TYPES.includes(item?.type)?item.type:"element",
    geometry:normalizedGeometry(item?.geometry||item),
    locked:item?.locked===true,
    aspectLocked:item?.aspectLocked!==false,
    z:integer(item?.z,index),
    groupId:item?.groupId?String(item.groupId):null,
    semanticRef:item?.semanticRef?String(item.semanticRef):null,
    presentation:item?.presentation&&typeof item.presentation==="object"
      ?clone(item.presentation)
      :{}
  })).filter(({id})=>id);
  const ids=new Set(objects.map(({id})=>id));
  const groups=(Array.isArray(scene.groups)?scene.groups:[])
    .map((group)=>normalizedGroup(group,ids))
    .filter((group)=>group.childIds.length>=2);
  return{
    schema:TIMELINE_SCENE_SCHEMA,
    version:TIMELINE_SCENE_VERSION,
    revision:Math.max(0,integer(scene.revision,0)),
    board,
    objects,
    groups,
    legacyDigest:String(scene.legacyDigest||"")
  };
}

export function validateSceneGraph(scene={}){
  const errors=[];
  if(scene.schema!==TIMELINE_SCENE_SCHEMA)errors.push("Unsupported Timeline scene schema.");
  if(Number(scene.version)!==TIMELINE_SCENE_VERSION)errors.push("Unsupported Timeline scene version.");
  if(!Array.isArray(scene.objects))errors.push("Timeline scene objects must be an array.");
  if(!Array.isArray(scene.groups))errors.push("Timeline scene groups must be an array.");
  const objects=Array.isArray(scene.objects)?scene.objects:[];
  const ids=objects.map(({id})=>String(id||""));
  if(ids.some((id)=>!id))errors.push("Timeline scene object IDs cannot be empty.");
  if(new Set(ids).size!==ids.length)errors.push("Timeline scene object IDs must be unique.");
  const groupIds=(Array.isArray(scene.groups)?scene.groups:[]).map(({id})=>String(id||""));
  if(new Set(groupIds).size!==groupIds.length)errors.push("Timeline scene group IDs must be unique.");
  const known=new Set(ids);
  const collisions=[...new Set(groupIds.filter((id)=>id&&known.has(id)))];
  if(collisions.length){
    errors.push(`Timeline scene object and group IDs must not collide: ${collisions.join(", ")}.`);
  }
  for(const object of objects){
    if(!TIMELINE_SCENE_OBJECT_TYPES.includes(object.type))errors.push(`Unsupported scene object type: ${object.type}`);
    for(const field of ["x","y","width","height","rotation"]){
      if(!Number.isFinite(Number(object.geometry?.[field])))errors.push(`Scene object ${object.id} has invalid ${field}.`);
    }
    if(Number(object.geometry?.width)<=0||Number(object.geometry?.height)<=0)errors.push(`Scene object ${object.id} has invalid bounds.`);
  }
  const groupOwnersByChild=new Map();
  for(const group of Array.isArray(scene.groups)?scene.groups:[]){
    if(!Array.isArray(group.childIds)||group.childIds.length<2)errors.push(`Scene group ${group.id} requires at least two children.`);
    if((group.childIds||[]).some((id)=>!known.has(String(id))))errors.push(`Scene group ${group.id} references a missing child.`);
    const groupId=String(group.id||"");
    for(const rawChildId of group.childIds||[]){
      const childId=String(rawChildId||"");
      if(!childId||!known.has(childId))continue;
      if(!groupOwnersByChild.has(childId))groupOwnersByChild.set(childId,new Set());
      groupOwnersByChild.get(childId).add(groupId);
    }
  }
  for(const [childId,owners] of groupOwnersByChild){
    if(owners.size>1){
      errors.push(`Scene object ${childId} cannot belong to more than one group: ${[...owners].join(", ")}.`);
    }
  }
  for(const object of objects){
    const childId=String(object.id||"");
    if(!childId)continue;
    const owners=[...(groupOwnersByChild.get(childId)||[])];
    const declaredGroupId=object.groupId?String(object.groupId):null;
    if(owners.length===0&&declaredGroupId){
      errors.push(`Scene object ${childId} declares groupId ${declaredGroupId} but is not a child of that group.`);
    }else if(owners.length===1&&declaredGroupId!==owners[0]){
      errors.push(`Scene object ${childId} groupId must match its owning group ${owners[0]}.`);
    }else if(owners.length>1&&(!declaredGroupId||!owners.includes(declaredGroupId))){
      errors.push(`Scene object ${childId} groupId does not match its group memberships.`);
    }
  }
  return{valid:errors.length===0,errors};
}

export function migrateAdvancedScene(advanced={}, {revision=0}={}){
  const legacyDigest=sceneLegacyDigest(advanced);
  const stored=advanced?.scene;
  const supported=stored?.schema===TIMELINE_SCENE_SCHEMA&&Number(stored?.version)===TIMELINE_SCENE_VERSION;
  if(supported){
    const normalized=normalizeStoredScene(stored);
    const validity=validateSceneGraph(normalized);
    if(validity.valid&&normalized.legacyDigest===legacyDigest){
      return{scene:normalized,migrated:false,sourceVersion:TIMELINE_SCENE_VERSION};
    }
  }
  return{
    scene:supported
      ?reconcileAdvancedScene(advanced,{revision})
      :sceneGraphFromLegacy(advanced,{revision}),
    migrated:true,
    sourceVersion:supported?TIMELINE_SCENE_VERSION:Number(stored?.version||0)
  };
}

function legacyItemFromScene(object,prior={}){
  const result={
    ...clone(prior),
    ...clone(object.presentation||{}),
    id:object.id,
    type:object.type,
    ...clone(object.geometry),
    locked:object.locked===true,
    aspectLocked:object.aspectLocked!==false,
    layerIndex:integer(object.z,0),
    zIndex:integer(object.z,0)
  };
  if(object.groupId)result.groupId=object.groupId;
  else delete result.groupId;
  if(object.semanticRef)result.semanticRef=object.semanticRef;
  else delete result.semanticRef;
  return result;
}

export function projectSceneGraphToLegacy(advanced={},scene={}){
  const normalized=normalizeStoredScene(scene);
  const validity=validateSceneGraph(normalized);
  if(!validity.valid)throw new TypeError(validity.errors.join(" "));
  const next=clone(advanced&&typeof advanced==="object"?advanced:{});
  for(const type of LEGACY_SCENE_OBJECT_TYPES){
    const key=COLLECTION_BY_TYPE[type];
    const priorById=new Map((Array.isArray(next[key])?next[key]:[]).map((item)=>[String(item?.id||""),item]));
    next[key]=normalized.objects
      .filter((object)=>object.type===type)
      .sort((left,right)=>left.z-right.z)
      .map((object)=>legacyItemFromScene(object,priorById.get(object.id)));
  }
  next.groups=normalized.groups.map((group)=>({
    id:group.id,
    type:"group",
    children:group.childIds.map((id)=>{
      const object=normalized.objects.find((candidate)=>candidate.id===id);
      return`${object?.type||"element"}:${id}`;
    }),
    locked:group.locked===true,
    aspectLocked:group.aspectLocked!==false
  }));
  normalized.legacyDigest=sceneLegacyDigest(next);
  next.scene=normalized;
  return next;
}

export function synchronizeAdvancedSceneDocument(document={}){
  const next=clone(document&&typeof document==="object"?document:{});
  const advanced=next.advanced&&typeof next.advanced==="object"?next.advanced:{};
  const migration=migrateAdvancedScene(advanced,{revision:next.revision});
  next.advanced={...clone(advanced),scene:migration.scene};
  return next;
}

export function sceneObjectById(scene={},id){
  return(Array.isArray(scene.objects)?scene.objects:[]).find((object)=>String(object.id)===String(id))||null;
}

export function sceneGroupById(scene={},id){
  return(Array.isArray(scene.groups)?scene.groups:[]).find((group)=>String(group.id)===String(id))||null;
}

export function sceneBoundsForIds(scene={},ids=[]){
  const selected=new Set(ids.map(String));
  const objects=(Array.isArray(scene.objects)?scene.objects:[]).filter((object)=>selected.has(String(object.id)));
  if(!objects.length)return null;
  const left=Math.min(...objects.map((object)=>finite(object.geometry.x,0)));
  const top=Math.min(...objects.map((object)=>finite(object.geometry.y,0)));
  const right=Math.max(...objects.map((object)=>finite(object.geometry.x,0)+positive(object.geometry.width,1)));
  const bottom=Math.max(...objects.map((object)=>finite(object.geometry.y,0)+positive(object.geometry.height,1)));
  return{x:left,y:top,width:right-left,height:bottom-top,rotation:0};
}

export function sceneTargetBounds(scene={},target={}){
  if(target?.type==="group"){
    const group=sceneGroupById(scene,target.id);
    return group?sceneBoundsForIds(scene,group.childIds):null;
  }
  return sceneObjectById(scene,target?.id)?.geometry||null;
}

export function sceneSelection(scene={},current=null,target=null,{add=false,toggle=false}={}){
  const validTarget=target?.type==="group"
    ?!!sceneGroupById(scene,target.id)
    :!!sceneObjectById(scene,target?.id);
  if(!target||!validTarget)return null;
  const key=(entry)=>`${entry.type}:${entry.id}`;
  const currentMembers=current?.type==="multi"
    ?current.members||[]
    :current?[current]:[];
  if(!add&&!toggle)return{type:target.type,id:String(target.id)};
  const selected=new Map(currentMembers.map((entry)=>[key(entry),{type:entry.type,id:String(entry.id)}]));
  const targetKey=key(target);
  if(toggle&&selected.has(targetKey))selected.delete(targetKey);
  else selected.set(targetKey,{type:target.type,id:String(target.id)});
  const members=[...selected.values()];
  return members.length>1?{type:"multi",members}:members[0]||null;
}

export function marqueeSceneSelection(scene={},rectangle={},{intersect=false}={}){
  const left=Math.min(finite(rectangle.x,0),finite(rectangle.x,0)+finite(rectangle.width,0));
  const right=Math.max(finite(rectangle.x,0),finite(rectangle.x,0)+finite(rectangle.width,0));
  const top=Math.min(finite(rectangle.y,0),finite(rectangle.y,0)+finite(rectangle.height,0));
  const bottom=Math.max(finite(rectangle.y,0),finite(rectangle.y,0)+finite(rectangle.height,0));
  const members=(Array.isArray(scene.objects)?scene.objects:[]).filter((object)=>{
    const box=object.geometry;
    return intersect
      ?box.x<right&&box.x+box.width>left&&box.y<bottom&&box.y+box.height>top
      :box.x>=left&&box.y>=top&&box.x+box.width<=right&&box.y+box.height<=bottom;
  }).map((object)=>({type:object.type,id:object.id}));
  return members.length>1?{type:"multi",members}:members[0]||null;
}

export function assertPresentationOnlyCommand(command={}){
  const paths=[];
  const visit=(value,path="")=>{
    if(!value||typeof value!=="object")return;
    for(const [key,child] of Object.entries(value)){
      const nextPath=path?`${path}.${key}`:key;
      if(SEMANTIC_FACT_FIELDS.has(key))paths.push(nextPath);
      visit(child,nextPath);
    }
  };
  visit(command);
  if(paths.length)throw new TypeError(`Advanced Studio commands cannot mutate semantic facts: ${paths.join(", ")}`);
  return true;
}
