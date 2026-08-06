import {
  createMediaElement,
  deleteMediaElement,
  validateMediaUpload
} from "./advanced-studio.js";
import {escapeHtml} from "./utils.js";

export const MEDIA_LIBRARY_ACCEPT=Object.freeze([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

export function mediaKindForFile(file){
  return String(file?.type||"").toLowerCase()==="image/gif"||
    String(file?.name||"").toLowerCase().endsWith(".gif")
    ?"gif"
    :"image";
}

export function createMediaLibraryAsset({
  id,
  file,
  naturalWidth=320,
  naturalHeight=180,
  layerIndex=0
}={}){
  const kind=mediaKindForFile(file);
  const validation=validateMediaUpload(file,{kind});
  if(!validation.valid)throw new TypeError(validation.error);
  return{
    ...createMediaElement({
      id,
      kind,
      file,
      naturalWidth,
      naturalHeight,
      layerIndex
    }),
    placed:false,
    guidedVisible:true,
    libraryAsset:true,
    libraryAddedAt:new Date().toISOString()
  };
}

export function placeMediaLibraryAsset(media,id,{
  x=720,
  y=390,
  boardWidth=1920,
  boardHeight=1080
}={}){
  let changed=false;
  const items=(media||[]).map((item)=>{
    if(String(item.id)!==String(id))return item;
    const width=Math.min(Number(item.width)||480,boardWidth*.32);
    const height=width/(Number(item.naturalAspect)||16/9);
    const next={
      ...item,
      x:Math.max(0,Math.min(Number(x)-width/2,boardWidth-width)),
      y:Math.max(0,Math.min(Number(y)-height/2,boardHeight-height)),
      width,
      height,
      placed:true,
      guidedVisible:true,
      placement:"media-library-drop"
    };
    changed=JSON.stringify(next)!==JSON.stringify(item);
    return changed?next:item;
  });
  return{changed,media:items};
}

export function unplaceMediaLibraryAsset(media,id){
  let changed=false;
  const items=(media||[]).map((item)=>{
    if(String(item.id)!==String(id))return item;
    changed=true;
    return{...item,placed:false};
  });
  return{changed,media:items};
}

export function nudgeMediaLibraryAsset(media,id,direction,{
  step=8,
  boardWidth=1920,
  boardHeight=1080
}={}){
  const delta={
    left:[-step,0],
    right:[step,0],
    up:[0,-step],
    down:[0,step]
  }[direction];
  if(!delta)return{changed:false,media};
  let changed=false;
  const items=(media||[]).map((item)=>{
    if(String(item.id)!==String(id)||item.placed===false)return item;
    const next={
      ...item,
      x:Math.max(0,Math.min(
        Number(item.x||0)+delta[0],
        boardWidth-Number(item.width||0)
      )),
      y:Math.max(0,Math.min(
        Number(item.y||0)+delta[1],
        boardHeight-Number(item.height||0)
      ))
    };
    changed=next.x!==item.x||next.y!==item.y;
    return changed?next:item;
  });
  return{changed,media:items};
}

export function removeMediaLibraryAsset(media,id){
  return deleteMediaElement(media,id);
}

export function mediaLibraryMarkup(media,{
  resolveObjectUrl=()=>null,
  compact=false,
  reducedMotion=false,
  durableOnline=false
}={}){
  const helpId=compact?"media407FDrawerDragHelp":"media407FPageDragHelp";
  const items=(media||[]).filter((item)=>item?.type==="media");
  const cards=items.map((item)=>{
    const url=resolveObjectUrl(item.id,item);
    const name=item.source?.name||"Untitled image";
    const kind=item.fileType==="gif"?"GIF":String(item.fileType||"image").toUpperCase();
    const placed=item.placed!==false;
    const pausedGif=reducedMotion&&item.fileType==="gif";
    return`<article class="media407FCard" draggable="true" data-media-asset="${escapeHtml(item.id)}" aria-label="${escapeHtml(name)}, ${kind}${placed?", placed on timeline":""}" aria-describedby="${helpId}">
      <div class="media407FThumb">${url&&!pausedGif
        ?`<img src="${escapeHtml(url)}" alt="">`
        :`<span aria-hidden="true">${pausedGif?"GIF · MOTION PAUSED":"IMAGE"}</span>`}</div>
      <div class="media407FMeta">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(kind)}${placed?" · ON TIMELINE":""}</span>
      </div>
      <div class="media407FActions">
        ${placed?"":`<button type="button" data-media-place="${escapeHtml(item.id)}" aria-describedby="${helpId}">Place on timeline</button>`}
        ${placed?`<button type="button" data-media-unplace="${escapeHtml(item.id)}">Remove from timeline</button>`:""}
        ${placed?`<div class="media407FNudges" role="group" aria-label="Position ${escapeHtml(name)}">
          <button type="button" data-media-nudge="left" data-media-id="${escapeHtml(item.id)}" aria-label="Move ${escapeHtml(name)} left">←</button>
          <button type="button" data-media-nudge="up" data-media-id="${escapeHtml(item.id)}" aria-label="Move ${escapeHtml(name)} up">↑</button>
          <button type="button" data-media-nudge="down" data-media-id="${escapeHtml(item.id)}" aria-label="Move ${escapeHtml(name)} down">↓</button>
          <button type="button" data-media-nudge="right" data-media-id="${escapeHtml(item.id)}" aria-label="Move ${escapeHtml(name)} right">→</button>
        </div>`:""}
      </div>
    </article>`;
  }).join("");
  return`<div class="media407FLibrary ${compact?"isCompact":""}">
    <p class="sr-only" id="${helpId}">Drag an asset onto the timeline, or use its Place on timeline button for keyboard placement at the timeline center.</p>
    <div class="media407FToolbar">
      <div>
        <p>${durableOnline?"PRIVATE MEDIA":"LOCAL MEDIA"}</p>
        <h2>${compact?"Drag onto the timeline":"Your timeline assets"}</h2>
        <span class="media407FFormatHint">${durableOnline
          ?"PNG, JPG, WEBP, or GIF · securely synced across your authorized devices"
          :"PNG, JPG, WEBP, or GIF · stored only on this device"}</span>
      </div>
      <label class="btnD go sm media407FUpload">
        UPLOAD
        <input type="file" data-media-upload aria-label="Upload timeline media" accept="${MEDIA_LIBRARY_ACCEPT.join(",")}" multiple>
      </label>
    </div>
    ${items.length
      ?`<div class="media407FGrid">${cards}</div>`
      :`<div class="media407FEmpty">
        <strong>Add images to use on your timeline.</strong>
        <span>Upload once, then reuse the same asset reference.</span>
      </div>`}
  </div>`;
}
