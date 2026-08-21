import {projectTimelineDocument} from "./domain-visual-adapter.js";
import {buildImagePdf,canvasJpegPage} from "../export/pdf-writer.js";
import {ADVANCED_BACKGROUND_PRESETS} from "../uxr-002/advanced-studio.js";

const MASTER_URL=(globalThis.D1_TIMELINE_ASSET_URLS?.["presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html"]
  ||new URL("../../presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html",import.meta.url).href)+"?defer=1";
const INSTANCES=new Map();
let tokenSequence=0;
const HostHTMLElement=typeof HTMLElement==="undefined"?class{}:HTMLElement;

function escapeAttribute(value){
  return String(value??"").replace(/[&<>'"]/g,(character)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  })[character]);
}

const FAIL_SOFT_MEDIA_CODES=new Set(["ASSET_LOAD_FAILED","MEDIA_HASH_MISMATCH"]);
const FAIL_SOFT_LAYOUT_CODES=new Set(["OBJECT_COLLISION_UNRESOLVED"]);
const LAYOUT_RECOVERY_MESSAGE="Those items are too close together. We kept your last layout so you can move one and try again.";
const INITIAL_LAYOUT_RECOVERY_MESSAGE="Some items overlap. Your timeline is still available; move an item slightly to improve the layout.";

export function protectedCollisionPairs(value){
  const entries=Array.isArray(value)?value:[value];
  const pairs=new Set();
  for(const entry of entries){
    const text=String(entry?.message||entry||"");
    for(const marker of ["COLLISIONS_ALLOWED_BY_POLICY:","furniture collisions:"]){
      const index=text.indexOf(marker);
      if(index<0)continue;
      text.slice(index+marker.length).trim().split(",").forEach((pair)=>{
        const normalized=pair.trim();
        if(/^[^\s,~]+~[^\s,~]+$/.test(normalized))pairs.add(normalized);
      });
    }
  }
  return pairs;
}

export function isExistingCollisionRecovery(previousWarnings,nextError){
  const previous=protectedCollisionPairs(previousWarnings);
  const next=protectedCollisionPairs(nextError);
  return previous.size>0&&next.size>0&&[...next].every((pair)=>previous.has(pair));
}

function advancedBackgroundCss(background,resolveObjectUrl=()=>null){
  if(background?.kind==="color"&&/^#[0-9a-f]{6}$/i.test(String(background.color||"")))return background.color;
  if(background?.kind==="preset")return ADVANCED_BACKGROUND_PRESETS.find(({id})=>id===background.preset)?.css||null;
  if(background?.kind==="upload"){
    const url=resolveObjectUrl(background.mediaId,background);
    if(typeof url==="string"&&url)return`url("${url.replace(/["\\]/g,"\\$&")}") center / cover no-repeat`;
  }
  return null;
}

export function exportPdfPageDimensions(output={}){
  if(output?.page?.name==="A4")return Object.freeze({pageWidth:841.89,pageHeight:595.28});
  return Object.freeze({pageWidth:792,pageHeight:612});
}

async function pngBlobCanvas(blob){
  const bitmap=await createImageBitmap(blob);
  try{
    const canvas=document.createElement("canvas");
    canvas.width=bitmap.width;
    canvas.height=bitmap.height;
    const context=canvas.getContext("2d",{alpha:false});
    if(!context)throw new Error("PDF canvas rendering is unavailable.");
    context.drawImage(bitmap,0,0);
    return canvas;
  }finally{
    bitmap.close?.();
  }
}

export function omitFailedMediaFromKernelModel(model,path){
  const normalized=String(path||"");
  const photo=normalized.match(/^photos\[(\d+)\]\.media$/);
  if(photo){
    const index=Number(photo[1]);
    if(!Array.isArray(model?.photos)||index<0||index>=model.photos.length){
      return{model,omitted:false,warning:""};
    }
    const next=structuredClone(model);
    next.photos.splice(index,1);
    return{model:next,omitted:true,warning:`MEDIA_OMITTED:${normalized}`};
  }
  if(normalized==="profile.portrait"&&model?.profile?.portrait){
    const next=structuredClone(model);
    next.profile.portrait=null;
    return{model:next,omitted:true,warning:`MEDIA_OMITTED:${normalized}`};
  }
  if(normalized==="logo.media"&&model?.logo?.media){
    const next=structuredClone(model);
    next.logo.media=null;
    next.logo.visibility=next.interview?.visibility==="show"?"placeholder":"hide";
    return{model:next,omitted:true,warning:`MEDIA_OMITTED:${normalized}`};
  }
  return{model,omitted:false,warning:""};
}

export function outOfBoundsObjectIds(error){
  const text=String(error?.message||"");
  const marker="objects out of bounds:";
  const index=text.indexOf(marker);
  if(index<0)return[];
  return[...new Set(text.slice(index+marker.length).split(",").map((id)=>id.trim()).filter(Boolean))];
}

const OUT_OF_BOUNDS_LOCATION_FLOOR=14;

/*
 * The protected D1-409H kernel places an event's location label either inside the
 * arrow ("below") or to its left ("left"), and then fails the whole render if any
 * label lands outside the 1920x1080 board. A left-placed label on an event that
 * starts near the board's left edge therefore blanks the entire timeline - which a
 * student experiences as "We could not display your timeline".
 *
 * The kernel is byte-protected, so recovery belongs here. Recover progressively and
 * truthfully: first move the label inside the arrow, then shorten it, and only then
 * drop it. Each step returns a changed model so the render can be retried.
 */
export function relocateOutOfBoundsLabels(model,error){
  const ids=new Set(outOfBoundsObjectIds(error));
  if(!ids.size||!Array.isArray(model?.events))return{model,changed:false,warning:""};
  const next=structuredClone(model);
  const moved=[],shortened=[],dropped=[];
  for(const event of next.events){
    if(!ids.has(String(event?.id||"")))continue;
    if(event.lp!=="below"){event.lp="below";moved.push(event.id);continue;}
    const location=String(event.loc||"");
    if(location.length>OUT_OF_BOUNDS_LOCATION_FLOOR){
      event.loc=`${location.slice(0,OUT_OF_BOUNDS_LOCATION_FLOOR).trim()}\u2026`;
      shortened.push(event.id);
      continue;
    }
    if(location){delete event.loc;dropped.push(event.id);continue;}
    // The bounds law also measures the arrow's `.date` node, which sits above the
    // arrow and runs right. A late-axis event can therefore breach the right edge
    // with no location involved at all. `date` is a host-produced display string
    // (presentation-kernel-adapter displayDate), so trimming it to the start date
    // changes nothing the student stored.
    const date=String(event.date||"");
    if(date.includes("-")){
      const start=date.split("-")[0].trim();
      if(start&&start!==date){
        event.date=`${start}\u2026`;
        shortened.push(event.id);
        continue;
      }
    }
  }
  const changed=moved.length>0||shortened.length>0||dropped.length>0;
  if(!changed)return{model,changed:false,warning:""};
  const parts=[];
  if(moved.length)parts.push(`LABEL_MOVED_INSIDE:${moved.join(",")}`);
  if(shortened.length)parts.push(`LABEL_SHORTENED:${shortened.join(",")}`);
  if(dropped.length)parts.push(`LABEL_OMITTED:${dropped.join(",")}`);
  return{model:next,changed:true,warning:parts.join("|")};
}

/*
 * Compose the one line a student actually reads after a fail-soft render. Layout
 * adjustments the host made on the student's behalf are deliberately silent - moving
 * a location label inside its arrow loses nothing and narrating it would only make a
 * working timeline feel broken. Only real content loss is reported, in plain language.
 */
export function failSoftRenderMessage(warnings,recoveredExistingLayout){
  const list=Array.isArray(warnings)?warnings.map(String):[];
  if(recoveredExistingLayout)return INITIAL_LAYOUT_RECOVERY_MESSAGE;
  const media=list.filter((entry)=>entry.startsWith("MEDIA_OMITTED:")).length;
  const trimmed=list.filter((entry)=>/LABEL_SHORTENED:|LABEL_OMITTED:/.test(entry)).length;
  const parts=[];
  if(media)parts.push(`${media} image${media===1?" was":"s were"} unavailable and left out. Your timeline is safe \u2014 re-add ${media===1?"it":"them"} to restore ${media===1?"it":"them"}.`);
  if(trimmed)parts.push("We shortened a location label so it fits neatly on your timeline.");
  return parts.join(" ");
}

const PROFILE_TEXT_FIELDS=Object.freeze([
  "name","visaStatus","aamc","step1","step2Ck","step2Cs","step3",
  "usce","research","languages","hobbies"
]);
const PROFILE_COMPACTION_WIDTHS=Object.freeze([null,42,24]);

/*
 * The protected kernel fails the whole render with TEXT_FIT_UNRESOLVED when the profile
 * card's text cannot satisfy its in-box and photo-mat-exclusion laws even at the floor
 * font size, and its four host retries cannot change any measured input - they only
 * re-fit the container. The profile card is the ONLY thing that law measures, and every
 * one of its values is host-supplied, so compacting those values is the one lever that
 * can actually change the outcome. All eleven fields are schema-required strings, so
 * rows are never dropped: long values are folded onto one line and then shortened.
 */
const ARROW_LABEL_WIDTHS=Object.freeze([48,32,20]);

/*
 * The kernel raises TEXT_FIT_UNRESOLVED for two quite different reasons, and only its
 * message distinguishes them: the profile card cannot satisfy its mat-exclusion law, or
 * "layout did not settle" - its two-frame stability probe never saw two identical
 * measurements within 30 frames. The stability signature is built from each arrow label's
 * width, so a crowded board of same-month or heavily overlapping events can oscillate
 * forever. Shortening the labels removes the oscillation; the titles are host-produced
 * display strings, so nothing the student stored is altered.
 */
export function compactArrowLabelsForFit(model,stage){
  if(stage>=ARROW_LABEL_WIDTHS.length||!Array.isArray(model?.events))return{model,changed:false,warning:""};
  const width=ARROW_LABEL_WIDTHS[stage];
  const next=structuredClone(model);
  const shortened=[];
  for(const event of next.events){
    const label=String(event?.t||"");
    if(label.length<=width)continue;
    event.t=`${label.slice(0,width).trim()}\u2026`;
    shortened.push(event.id);
  }
  if(!shortened.length)return{model,changed:false,warning:""};
  return{model:next,changed:true,warning:`EVENT_LABEL_COMPACTED:${shortened.join(",")}`};
}

export function compactProfileForFit(model,stage){
  const profile=model?.profile;
  if(!profile||stage>=PROFILE_COMPACTION_WIDTHS.length)return{model,changed:false,warning:""};
  const width=PROFILE_COMPACTION_WIDTHS[stage];
  const next=structuredClone(model);
  let changed=false;
  for(const field of PROFILE_TEXT_FIELDS){
    const value=String(next.profile?.[field]??"");
    let folded=value.includes("\n")?value.split("\n").map((part)=>part.trim()).filter(Boolean).join(", "):value;
    if(width&&folded.length>width)folded=`${folded.slice(0,width).trim()}\u2026`;
    if(folded!==value){next.profile[field]=folded;changed=true;}
  }
  if(!changed)return{model,changed:false,warning:""};
  return{model:next,changed:true,warning:`PROFILE_TEXT_COMPACTED:${stage}`};
}

const KERNEL_LANE_MAX=6;

/*
 * Lane preference when an arrow has to move off a piece of fixed furniture.
 * The protected board keeps the Color Key at y300-622 and the profile sheet below
 * it on the left, and the logo/interview chrome on the right, so the two top lanes
 * are the only ones that clear the left-hand furniture outright. Lane position is
 * layout-only - the frozen category/colour mapping is untouched by moving an arrow.
 */
const LANE_RELOCATION_ORDER=[0,1,5,6,2,3,4];

/* Mirrors the frozen protected geometry (D1-409H_VISUAL_MASTER.js LANE_Y and
   FURNITURE_RECTS). Read-only copies: the kernel owns these values, we only need to
   reason about them to pick a lane that actually escapes the furniture. */
const LANE_Y=[196,252,316,382,448,506,564];
const LANE_TOP_OFFSET=7;
const ARROW_HEIGHT=48;
const FURNITURE_BANDS={
  "color-key":[300,622],
  "profile-sheet":[634,1062],
  "logo-mount":[238,350],
  "logo-slip":[356,382],
  "interview-ribbon":[394,450],
  "interview-date":[458,480]
};

/*
 * The collision we are recovering from is geometric, so a candidate lane is only
 * useful if it moves the arrow out of the vertical band of the furniture it actually
 * hit. Horizontal position needs no recomputation: the kernel already told us these
 * two objects overlap at the arrow's current x.
 */
function laneClearsFurniture(lane,furnitureIds){
  const top=LANE_Y[lane]-LANE_TOP_OFFSET;
  const bottom=top+ARROW_HEIGHT;
  return [...furnitureIds].every((id)=>{
    const band=FURNITURE_BANDS[id];
    if(!band)return true;
    return bottom<=band[0]||top>=band[1];
  });
}

function arrowMonthSpan(arrow){
  return{
    start:monthIndex(arrow?.sy,arrow?.sm),
    end:monthIndex(arrow?.ey ?? arrow?.sy,arrow?.em ?? arrow?.sm)
  };
}

function arrowsOverlap(a,b){
  const left=arrowMonthSpan(a),right=arrowMonthSpan(b);
  return left.start<=right.end&&right.start<=left.end;
}

/*
 * The protected kernel fails a render when an event arrow lands on fixed furniture.
 * Rather than immediately surrendering to the overlap-tolerant policy - which leaves
 * the student staring at an event hidden behind the Color Key and a banner telling
 * them to fix the layout themselves - try to place the offending arrows in a lane
 * that is genuinely free. `tried` carries state across retries so each arrow walks
 * its candidate lanes at most once.
 */
export function relocateCollidingArrows(model,error,tried=new Map()){
  const pairs=[...protectedCollisionPairs(error)];
  if(!pairs.length||!Array.isArray(model?.events))return{model,changed:false,warning:""};
  const struckFurniture=new Map();
  for(const pair of pairs){
    const [arrowId,furnitureId]=pair.split("~");
    if(!arrowId)continue;
    if(!struckFurniture.has(arrowId))struckFurniture.set(arrowId,new Set());
    if(furnitureId)struckFurniture.get(arrowId).add(furnitureId);
  }
  const offenders=[...struckFurniture.keys()];
  const next=structuredClone(model);
  const movedIds=[];
  for(const id of offenders){
    const arrow=next.events.find((event)=>String(event?.id||"")===id);
    if(!arrow)continue;
    const seen=tried.get(id)||new Set([arrow.lane]);
    const furnitureIds=struckFurniture.get(id)||new Set();
    const candidate=LANE_RELOCATION_ORDER.find((lane)=>{
      if(seen.has(lane)||lane>KERNEL_LANE_MAX)return false;
      if(!laneClearsFurniture(lane,furnitureIds))return false;
      return !next.events.some((other)=>
        other!==arrow&&other.lane===lane&&arrowsOverlap(other,arrow));
    });
    if(candidate===undefined)continue;
    seen.add(candidate);
    tried.set(id,seen);
    arrow.lane=candidate;
    movedIds.push(`${id}:${candidate}`);
  }
  if(!movedIds.length)return{model,changed:false,warning:""};
  return{model:next,changed:true,warning:`EVENT_LANE_RELOCATED:${movedIds.join(",")}`};
}

function monthIndex(year,month){return Number(year)*12+(Number(month)||1)-1;}
function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback;}
function cssNumber(value,fallback=0){const number=Number.parseFloat(String(value??""));return Number.isFinite(number)?number:fallback;}
function clamp(value,min,max){return Math.min(max,Math.max(min,value));}

const INTERACTIVE_OBJECT_SELECTOR=[
  ".arrow[data-object-id]",
  ".flag[data-object-id]",
  ".photoTile[data-object-id]",
  "#profile-photo-well[data-object-id]",
  "#logo-mount[data-object-id]",
  "#sticky-note[data-object-id]",
  "#axis[data-object-id]",
  "#key[data-object-id]",
  "#titleWrap[data-object-id]",
  "#profile[data-object-id]",
  "#ivrWrap[data-object-id]",
  "#ivdate[data-object-id]"
].join(",");

class D1411AKernelElement extends HostHTMLElement{
  constructor(){
    super();
    this._record=null;
    this._kernel=null;
    this._mountPromise=null;
    this._updatePromise=Promise.resolve();
    this._resizeObserver=null;
    this._childCleanup=[];
    this._gesture=null;
    this._hitLayer=null;
    this._hitSources=[];
    this._selectedObjectId=null;
    this._advancedOverlayCleanup=()=>{};
    this.selectAdvancedObject=()=>{};
    this.releaseAdvancedGroup=()=>false;
    this._lastGoodRecord=null;
    this._lastGoodRender=null;
    this.attachShadow({mode:"open"});
  }

  connectedCallback(){
    this.style.display="block";
    this.style.width="100%";
    this.style.aspectRatio="16 / 9";
    if(this._isRenderable()){
      this._ensureMounted().catch((error)=>this._fail(error));
      return;
    }
    this._resizeObserver=new ResizeObserver(()=>{
      if(!this._isRenderable())return;
      this._resizeObserver?.disconnect();
      this._resizeObserver=null;
      this._ensureMounted().catch((error)=>this._fail(error));
    });
    this._resizeObserver.observe(this);
  }

  _isRenderable(){
    if(!this.isConnected||this.clientWidth<=0)return false;
    const rect=this.getBoundingClientRect?.();
    return !rect||(rect.width>0&&rect.height>0);
  }

  disconnectedCallback(){
    this._resizeObserver?.disconnect();
    this._resizeObserver=null;
    for(const cleanup of this._childCleanup.splice(0))cleanup();
    this._advancedOverlayCleanup();
    this._advancedOverlayCleanup=()=>{};
    this.selectAdvancedObject=()=>{};
    this.releaseAdvancedGroup=()=>false;
    this._kernel?.destroy?.();
    this._kernel=null;
    delete this.dataset.interactionsReady;
  }

  _ensureMounted(){
    if(this._mountPromise)return this._mountPromise;
    const pending=this._mount();
    this._mountPromise=pending;
    pending.finally(()=>{
      if(this._mountPromise===pending)this._mountPromise=null;
    }).catch(()=>{});
    return pending;
  }

  async _mount(){
    const record=INSTANCES.get(this.dataset.kernelToken)||null;
    this._record=record;
    if(!record)throw new Error("D1-411A kernel projection is unavailable.");
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:#c8d8e1}
      iframe{display:block;width:100%;height:100%;border:0;background:#c8d8e1}
      /* The opaque panel is the FIRST-LOAD state only. Once a timeline has rendered
         successfully it must never be covered again: a student who has seen their
         timeline should never watch it turn back into a grey rectangle. */
      output[data-loading]{position:absolute;inset:0;display:grid;place-items:center;background:#c8d8e1;color:#19334f;font:700 13px/1.5 system-ui,sans-serif;letter-spacing:.03em}
      :host([data-has-render="true"]) output[data-loading]{display:none}
      /* Recalculation overlay: deliberately small and translucent so the previous
         timeline stays readable underneath while the next one is being built. */
      output[data-updating]{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:1200;display:flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid rgba(25,51,79,.18);border-radius:999px;background:rgba(255,255,255,.94);color:#19334f;font:700 12px/1.2 system-ui,sans-serif;box-shadow:0 4px 14px rgba(25,51,79,.14)}
      output[data-updating][hidden]{display:none}
      output[data-updating]::before{content:"";width:11px;height:11px;border-radius:50%;border:2px solid rgba(25,51,79,.25);border-top-color:#19334f;animation:d1411aSpin .8s linear infinite}
      @keyframes d1411aSpin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){output[data-updating]::before{animation:none}}
      output[data-last-good-alert]{position:absolute;left:12px;bottom:12px;z-index:1150;display:grid;gap:2px;max-width:min(460px,calc(100% - 24px));padding:10px 12px;border:1px solid rgba(180,83,9,.3);border-radius:8px;background:rgba(255,251,235,.97);color:#7c2d12;font:600 12px/1.45 system-ui,sans-serif;box-shadow:0 4px 16px rgba(25,51,79,.12)}
      output[data-last-good-alert][hidden]{display:none}
      output[data-last-good-alert] strong{font-weight:800}
      output[data-render-warning]{position:absolute;right:12px;bottom:12px;z-index:1100;max-width:min(460px,calc(100% - 24px));padding:10px 12px;border:1px solid rgba(25,51,79,.22);border-radius:8px;background:rgba(255,255,255,.96);color:#19334f;font:700 12px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(25,51,79,.12)}
      output[data-render-warning][hidden]{display:none}
    </style><iframe title="${escapeAttribute(record.label)}" src="${escapeAttribute(MASTER_URL)}"></iframe><output data-loading role="status">Building your timeline…</output><output data-updating role="status" hidden>Updating your timeline…</output><output data-last-good-alert role="status" hidden></output><output data-render-warning role="status" hidden></output>`;
    const iframe=this.shadowRoot.querySelector("iframe");
    /*
     * The protected frame can finish loading before these listeners attach - a cached
     * document, a same-origin load that completes within the same task, or a surface
     * being re-mounted. `load` does not fire again, so waiting on it alone left the
     * mount pending forever with no error, and the student sat in front of
     * "Preparing your timeline…" indefinitely. Resolve on whichever comes first: the
     * load event, or the frame having demonstrably arrived (its document is complete
     * and the protected kernel object exists - about:blank satisfies neither).
     */
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=()=>{
        if(settled)return;
        settled=true;
        clearInterval(poll);
        resolve();
      };
      const alreadyLoaded=()=>{
        try{
          return iframe.contentDocument?.readyState==="complete"&&
            Boolean(iframe.contentWindow?.D1409H);
        }catch(_){return false;}
      };
      const poll=setInterval(()=>{if(alreadyLoaded())finish();},50);
      iframe.addEventListener("load",finish,{once:true});
      iframe.addEventListener("error",()=>{
        if(settled)return;
        settled=true;
        clearInterval(poll);
        reject(new Error("Canonical timeline frame failed to load."));
      },{once:true});
      if(alreadyLoaded())finish();
    });
    const child=iframe.contentWindow;
    const K=child?.D1409H;
    if(!K||K.kernelId!=="D1-409H-A1")throw new Error("Protected D1-409H-A1 kernel was not loaded.");
    // A persistent surface can reconnect after having been fit to its former
    // container. Normalize the protected board before its invariant check;
    // the host reapplies the current fit immediately after the first render.
    K.resize({scale:1});
    await K.ready();
    this._kernel=K;
    const rendered=await this._renderRecord(record,{allowExistingLayoutRecovery:true});
    if(!this.isConnected){K.destroy?.();return;}
    this.resize();
    this._installChildInteractions(iframe);
    this.dataset.interactionsReady="true";
    this.dataset.ready="true";
    this._lastGoodRecord=record;
    this._lastGoodRender=rendered;
    this._resizeObserver=new ResizeObserver(()=>{
      if(!this._isRenderable())return;
      this.resize();
      const next=INSTANCES.get(this.dataset.kernelToken)||null;
      if(next&&this._record?.renderId!==next.renderId){
        this.updateProjection().catch((error)=>this._fail(error));
      }
    });
    this._resizeObserver.observe(this);
    this._dispatchReady(rendered,record);
  }

  async _renderRecord(record=this._record,{allowExistingLayoutRecovery=false}={}){
    const K=this._kernel;
    if(!K||!record)throw new Error("D1-411A kernel projection is unavailable.");
    let kernelModel=record.projection.model;
    let response=null;
    const failSoftWarnings=[];
    let layoutRetryCount=0;
    let boundsRecoveryCount=0;
    let laneRelocationCount=0;
    let profileCompactionStage=0;
    let labelCompactionStage=0;
    const laneRelocationState=new Map();
    let recoveredExistingLayout=false;
    // Budget covers every bounded recovery path: text-fit refits, out-of-bounds label
    // relocation, furniture lane relocation, and media omission, plus headroom.
    for(let attempt=0;attempt<26;attempt+=1){
      try{
        response=await K.rerender(kernelModel,{
          renderId:record.renderId,
          reason:record.reason
        });
        break;
      }catch(error){
        if(String(error?.code||"")==="TEXT_FIT_UNRESOLVED"&&layoutRetryCount>=4){
          const settleFailure=/did not settle/i.test(String(error?.message||""));
          if(settleFailure&&labelCompactionStage<ARROW_LABEL_WIDTHS.length){
            const compaction=compactArrowLabelsForFit(kernelModel,labelCompactionStage);
            labelCompactionStage+=1;
            if(compaction.changed){
              kernelModel=compaction.model;
              failSoftWarnings.push(compaction.warning);
              continue;
            }
          }
          if(profileCompactionStage<PROFILE_COMPACTION_WIDTHS.length){
            const compaction=compactProfileForFit(kernelModel,profileCompactionStage);
            profileCompactionStage+=1;
            if(compaction.changed){
              kernelModel=compaction.model;
              failSoftWarnings.push(compaction.warning);
              continue;
            }
          }
        }
        if(String(error?.code||"")==="TEXT_FIT_UNRESOLVED"&&layoutRetryCount<4){
          layoutRetryCount+=1;
          // The protected renderer measures its profile card against the
          // composited 1920×1080 board. Reapply the host fit before retrying:
          // a persistent canvas can receive this update while its parent is
          // still settling after a direct-manipulation gesture.
          this.resize();
          const childWindow=this.shadowRoot?.querySelector("iframe")?.contentWindow;
          await new Promise((resolve)=>{
            if(childWindow?.requestAnimationFrame){
              childWindow.requestAnimationFrame(()=>childWindow.requestAnimationFrame(resolve));
            }
            else setTimeout(resolve,0);
          });
          continue;
        }
        if(FAIL_SOFT_LAYOUT_CODES.has(String(error?.code||""))&&laneRelocationCount<5){
          const relocation=relocateCollidingArrows(kernelModel,error,laneRelocationState);
          if(relocation.changed){
            laneRelocationCount+=1;
            kernelModel=relocation.model;
            failSoftWarnings.push(relocation.warning);
            continue;
          }
        }
        if(
          FAIL_SOFT_LAYOUT_CODES.has(String(error?.code||""))&&
          allowExistingLayoutRecovery
        ){
          response=await K.rerender(kernelModel,{
            renderId:record.renderId,
            reason:"existing-layout-recovery",
            options:{collisionPolicy:"warn"}
          });
          recoveredExistingLayout=true;
          failSoftWarnings.push("EXISTING_LAYOUT_OVERLAP_RECOVERED");
          break;
        }
        if(String(error?.code||"")==="OBJECT_OUT_OF_BOUNDS"&&boundsRecoveryCount<6){
          const relocation=relocateOutOfBoundsLabels(kernelModel,error);
          if(relocation.changed){
            boundsRecoveryCount+=1;
            kernelModel=relocation.model;
            failSoftWarnings.push(relocation.warning);
            continue;
          }
        }
        if(!FAIL_SOFT_MEDIA_CODES.has(String(error?.code||""))){
          this.dataset.lastFailureContext=JSON.stringify({
            surface:record.surface,
            renderId:record.renderId,
            reason:record.reason,
            revision:record.projection.model.revision,
            axisMode:record.projection.model.axisMode,
            events:record.projection.model.events.length,
            flags:record.projection.model.flags?.length||0
          });
          throw error;
        }
        const omission=omitFailedMediaFromKernelModel(kernelModel,error?.path);
        if(!omission.omitted)throw error;
        kernelModel=omission.model;
        failSoftWarnings.push(omission.warning);
      }
    }
    if(!response)throw new Error("Timeline media recovery exceeded the safe omission limit.");
    await K.whenStable(record.renderId);
    const childDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(childDocument){
      this._applyPresentationOverrides(childDocument,record);
      this._fitProtectedFurnitureText(childDocument);
      this._applyAdvancedOverlay(childDocument,record);
      // Runs last: the overlay pass can settle the child document after the protected
      // render, and buildFlags recreates the flag row on every render.
      this._fitMilestoneFlags(childDocument);
      this._avoidFurnitureObstruction(childDocument,record);
    }
    delete this.dataset.error;
    delete this.dataset.errorMessage;
    delete this.dataset.lastFailureContext;
    if(layoutRetryCount)this.dataset.layoutRetryCount=String(layoutRetryCount);
    else delete this.dataset.layoutRetryCount;
    this.dataset.fingerprint=response.fingerprint;
    this.dataset.renderId=record.renderId;
    // From here on a real timeline exists on screen; the first-load panel must never
    // cover it again, and any later failure keeps this render rather than replacing it.
    this.dataset.hasRender="true";
    this._setUpdating(false);
    this._clearLastGoodNotice();
    // Flags are the one layer the protected renderer rebuilds wholesale and never
    // de-collides. Re-apply the host pass once the render is committed, and once more
    // on the next frame so any late settling in the child document is picked up. The
    // pass restores the protected baseline before fitting, so repeats are safe.
    if(childDocument){
      this._fitMilestoneFlags(childDocument);
      const frame=childDocument.defaultView?.requestAnimationFrame;
      if(frame)childDocument.defaultView.requestAnimationFrame(()=>{
        const current=this.shadowRoot?.querySelector("iframe")?.contentDocument;
        if(current)this._fitMilestoneFlags(current);
      });
    }
    this.dataset.protectedKernel=K.kernelId;
    const projectionWarnings=[...(record.projection.warnings||[]),...failSoftWarnings];
    this.dataset.projectionWarnings=JSON.stringify(projectionWarnings);
    this.dataset.projectionDropped=JSON.stringify(record.projection.dropped||[]);
    const studentMessage=failSoftRenderMessage(failSoftWarnings,recoveredExistingLayout);
    if(studentMessage){
      const warning=this.shadowRoot.querySelector("[data-render-warning]");
      warning.hidden=false;
      warning.textContent=studentMessage;
    }else{
      const warning=this.shadowRoot.querySelector("[data-render-warning]");
      if(warning){warning.hidden=true;warning.textContent="";}
    }
    return{response,projectionWarnings,recoveredExistingLayout};
  }

  /*
   * The governing law for this element: a timeline that has rendered once stays on
   * screen. Recalculation shows a small overlay ON TOP of the previous timeline, and a
   * failed recalculation leaves that previous timeline exactly where it was. Nothing
   * here ever returns the student to an empty rectangle.
   */
  /*
   * A failed render is not a no-op: the protected kernel builds its DOM and only then
   * runs its post-render laws, so the board is already showing the layout that failed.
   * Restoring the student's previous timeline therefore means genuinely re-rendering the
   * last good model, not merely leaving the frame alone. Collisions are tolerated here
   * because the retained render may itself have been an accepted-overlap layout.
   */
  async _restoreLastGoodRender(){
    const record=this._lastGoodRecord;
    const K=this._kernel;
    if(!record||!K)return false;
    try{
      await K.rerender(structuredClone(record.projection.model),{
        renderId:record.renderId,
        reason:"last-good-restore",
        options:{collisionPolicy:"warn"}
      });
      await K.whenStable(record.renderId);
      const childDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
      if(childDocument){
        this._applyPresentationOverrides(childDocument,record);
        this._fitProtectedFurnitureText(childDocument);
        this._applyAdvancedOverlay(childDocument,record);
        this._fitMilestoneFlags(childDocument);
      }
      this._record=record;
      this.resize();
      return true;
    }catch(_){
      return false;
    }
  }

  _setUpdating(active){
    const node=this.shadowRoot?.querySelector?.("[data-updating]");
    if(!node)return;
    if(active&&this.dataset.hasRender==="true"){node.hidden=false;this.dataset.updating="true";}
    else{node.hidden=true;delete this.dataset.updating;}
  }

  _showLastGoodNotice(message){
    const node=this.shadowRoot?.querySelector?.("[data-last-good-alert]");
    if(!node)return;
    node.hidden=false;
    node.innerHTML="";
    const title=this.ownerDocument.createElement("strong");
    title.textContent="We kept your timeline as it was.";
    const detail=this.ownerDocument.createElement("span");
    detail.textContent=message;
    node.append(title,detail);
  }

  _clearLastGoodNotice(){
    const node=this.shadowRoot?.querySelector?.("[data-last-good-alert]");
    if(!node)return;
    node.hidden=true;
    node.textContent="";
  }

  _showRenderWarning(message){
    const warning=this.shadowRoot?.querySelector?.("[data-render-warning]");
    if(!warning)return;
    warning.hidden=false;
    warning.textContent=String(message||"");
  }

  _dispatchReady({response,projectionWarnings},record=this._record){
    this.dispatchEvent(new CustomEvent("d1-411a:ready",{
      bubbles:true,
      composed:true,
      detail:{
        surface:record.surface,
        renderId:record.renderId,
        fingerprint:response.fingerprint,
        warnings:projectionWarnings,
        dropped:record.projection.dropped
      }
    }));
  }

  updateProjection(){
    const apply=async()=>{
      const queued=INSTANCES.get(this.dataset.kernelToken)||null;
      if(!queued)throw new Error("D1-411A kernel projection is unavailable.");
      if(!this._isRenderable())return this.diagnostics();
      if(this._mountPromise)await this._mountPromise;
      else if(!this._kernel)await this._ensureMounted();
      if(!this._isRenderable())return this.diagnostics();
      const next=INSTANCES.get(this.dataset.kernelToken)||null;
      if(!next)throw new Error("D1-411A kernel projection is unavailable.");
      if(this._record?.renderId===next.renderId){
        this._record=next;
        return this.diagnostics();
      }
      const previous=this._record;
      this._setUpdating(true);
      try{
        const rendered=await this._renderRecord(next);
        for(const cleanup of this._childCleanup.splice(0))cleanup();
        this.dataset.interactionsReady="false";
        this._hitLayer=null;
        this._hitSources=[];
        this._gesture=null;
        this._record=next;
        const iframe=this.shadowRoot.querySelector("iframe");
        this.resize();
        if(iframe)this._installChildInteractions(iframe);
        this.dataset.interactionsReady="true";
        this.dataset.ready="true";
        this._lastGoodRecord=next;
        this._lastGoodRender=rendered;
        this._dispatchReady(rendered,next);
        return this.diagnostics();
      }catch(error){
        if(!previous||!FAIL_SOFT_LAYOUT_CODES.has(String(error?.code||""))){
          // Put the student's previous timeline back on the board before reporting.
          if(await this._restoreLastGoodRender()){
            this._fail(error);
            return this.diagnostics();
          }
          throw error;
        }
        if(isExistingCollisionRecovery(this._lastGoodRender?.response?.warnings,error)){
          const rendered=await this._renderRecord(next,{allowExistingLayoutRecovery:true});
          for(const cleanup of this._childCleanup.splice(0))cleanup();
          this.dataset.interactionsReady="false";
          this._hitLayer=null;
          this._hitSources=[];
          this._gesture=null;
          this._record=next;
          const iframe=this.shadowRoot.querySelector("iframe");
          this.resize();
          if(iframe)this._installChildInteractions(iframe);
          this.dataset.interactionsReady="true";
          this.dataset.ready="true";
          this._lastGoodRecord=next;
          this._lastGoodRender=rendered;
          this._dispatchReady(rendered,next);
          return this.diagnostics();
        }
        for(const cleanup of this._childCleanup.splice(0))cleanup();
        this._record=previous;
        this._hitLayer=null;
        this._hitSources=[];
        this._gesture=null;
        const iframe=this.shadowRoot.querySelector("iframe");
        const childDocument=iframe?.contentDocument;
        if(childDocument){
          this._applyPresentationOverrides(childDocument,previous);
          this._fitProtectedFurnitureText(childDocument);
          this._applyAdvancedOverlay(childDocument,previous);
          this._fitMilestoneFlags(childDocument);
          this._avoidFurnitureObstruction(childDocument,previous);
        }
        this.resize();
        if(iframe)this._installChildInteractions(iframe);
        this.dataset.interactionsReady="true";
        this.dataset.ready="true";
        delete this.dataset.error;
        delete this.dataset.errorMessage;
        this._setUpdating(false);
        this._showRenderWarning(LAYOUT_RECOVERY_MESSAGE);
        this.dispatchEvent(new CustomEvent("d1-411a:rejected",{
          bubbles:true,
          composed:true,
          detail:{
            surface:next.surface,
            code:"LAYOUT_OVERLAP_REJECTED",
            revision:next.projection.model.revision,
            message:LAYOUT_RECOVERY_MESSAGE
          }
        }));
        return this.diagnostics();
      }
    };
    this._updatePromise=this._updatePromise.catch(()=>{}).then(apply);
    return this._updatePromise;
  }

  _installChildInteractions(iframe){
    const childDocument=iframe.contentDocument;
    if(!childDocument)return;
    const interaction=(event)=>{
      const detail=event.detail||{};
      const domainId=this._record.projection.visualToDomain.get(detail.objectId)||null;
      this.dispatchEvent(new CustomEvent("d1-411a:interaction",{
        bubbles:true,
        composed:true,
        detail:{...detail,domainId,surface:this._record.surface}
      }));
    };
    childDocument.addEventListener("d1-409h:interaction",interaction);
    this._childCleanup.push(()=>childDocument.removeEventListener("d1-409h:interaction",interaction));
    // A wheel over the board is delivered to the protected document, not to the host, so
    // ctrl/cmd+wheel zoom was simply dead over the one surface a student would use it on.
    const wheelZoom=(event)=>{
      if(!event.ctrlKey&&!event.metaKey)return;
      event.preventDefault();
      this.dispatchEvent(new CustomEvent("d1-411a:wheel-zoom",{
        bubbles:true,composed:true,detail:{deltaY:Number(event.deltaY||0)}
      }));
    };
    childDocument.addEventListener("wheel",wheelZoom,{passive:false});
    this._childCleanup.push(()=>childDocument.removeEventListener("wheel",wheelZoom));
    // Native rail drag events do not bubble across the protected iframe
    // boundary.  Forward just the typed Timeline asset payload, mapped to
    // board coordinates, so the host can make one durable insertion on drop.
    const advancedDrop=(event)=>{
      let payload=null;
      try{payload=JSON.parse(event.dataTransfer?.getData?.("application/x-missionmed-timeline-asset")||"");}catch{}
      if(payload?.kind!=="insert"||this._record?.editable!==true)return;
      const board=childDocument.getElementById("board");
      const bounds=board?.getBoundingClientRect?.();
      if(!bounds?.width||!bounds?.height)return;
      event.preventDefault();
      if(event.type==="dragover"){
        if(event.dataTransfer)event.dataTransfer.dropEffect="copy";
        return;
      }
      this.dispatchEvent(new CustomEvent("d1-411a:advanced-drop",{
        bubbles:true,composed:true,
        detail:{
          surface:this._record.surface,payload,
          x:clamp((event.clientX-bounds.left)*1920/bounds.width,0,1840),
          y:clamp((event.clientY-bounds.top)*1080/bounds.height,0,1000)
        }
      }));
    };
    childDocument.addEventListener("dragover",advancedDrop);
    childDocument.addEventListener("drop",advancedDrop);
    this._childCleanup.push(()=>childDocument.removeEventListener("dragover",advancedDrop));
    this._childCleanup.push(()=>childDocument.removeEventListener("drop",advancedDrop));

    const objects=[...childDocument.querySelectorAll(INTERACTIVE_OBJECT_SELECTOR)];
    if(this._record.interactive){
      const focusStyle=childDocument.createElement("style");
      focusStyle.dataset.hostAccessibility="d1-411b";
      focusStyle.textContent='.d1411AHitLayer{position:absolute;inset:0;z-index:1000;pointer-events:none}.d1411AHit{position:absolute;z-index:1;border:0;padding:0;background:transparent;color:transparent;pointer-events:auto;touch-action:none}.d1411AHit:hover{background:rgba(124,58,237,.035);outline:1px solid rgba(124,58,237,.5)}.d1411AHit:focus-visible{outline:3px solid #191c21;outline-offset:2px;background:rgba(255,255,255,.08)}.d1411AHit[aria-selected="true"]{z-index:2;outline:3px solid #7c3aed;outline-offset:3px;background:rgba(124,58,237,.04)}.d1411AHandle{display:none;position:absolute;width:16px;height:16px;border:2px solid #fff;border-radius:50%;background:#7c3aed;box-shadow:0 0 0 1px #7c3aed;transform:translate(-50%,-50%);pointer-events:auto}.d1411AHit[aria-selected="true"] .d1411AHandle{display:block}.d1411AHandle[data-handle="w"]{left:0;top:50%;cursor:ew-resize}.d1411AHandle[data-handle="e"]{left:100%;top:50%;cursor:ew-resize}.d1411AHandle[data-handle="se"]{left:100%;top:100%;cursor:nwse-resize}.d1411AInteractionGuide{position:absolute;z-index:4;pointer-events:none;background:#ff4fa3;box-shadow:0 0 0 1px rgba(255,255,255,.9)}.d1411AInteractionGuide[data-axis="x"]{top:0;bottom:0;width:2px}.d1411AInteractionGuide[data-axis="y"]{left:0;right:0;height:2px}.d1411AAxisBoundary{position:absolute;top:0;bottom:0;width:16px;transform:translateX(-50%);pointer-events:auto;cursor:col-resize}.d1411AAxisBoundary::after{content:"";position:absolute;left:7px;top:7px;bottom:7px;width:2px;background:#7c3aed;box-shadow:0 0 0 1px #fff;opacity:0}.d1411AHit[aria-selected="true"] .d1411AAxisBoundary::after{opacity:1}';
      childDocument.head.append(focusStyle);
      this._childCleanup.push(()=>focusStyle.remove());
      const board=childDocument.getElementById("board");
      this._hitLayer=childDocument.createElement("div");
      this._hitLayer.className="d1411AHitLayer";
      this._hitLayer.setAttribute("data-d1-411a-hit-layer","true");
      board.append(this._hitLayer);
      const hitLayer=this._hitLayer;
      this._childCleanup.push(()=>hitLayer.remove());
      this._hitSources=objects;
      this._refreshHits(childDocument);
      const forwardHit=(event)=>{
        if(event.type==="click"&&event.detail===0)return;
        const hit=event.target.closest?.("[data-d1-411a-hit]");
        if(!hit)return;
        this.selectObject(hit.dataset.sourceObjectId);
        const source=childDocument.querySelector(
          `[data-object-id="${CSS.escape(hit.dataset.sourceObjectId)}"]`
        );
        source?.dispatchEvent(new MouseEvent(event.type,{bubbles:true}));
      };
      hitLayer.addEventListener("click",forwardHit);
      hitLayer.addEventListener("dblclick",forwardHit);
      this._childCleanup.push(()=>hitLayer.removeEventListener("click",forwardHit));
      this._childCleanup.push(()=>hitLayer.removeEventListener("dblclick",forwardHit));
      const hits=()=>[...hitLayer.querySelectorAll("[data-d1-411a-hit]")];
      const keydown=(event)=>{
        const current=event.target.closest?.("[data-d1-411a-hit]");
        if(!current)return;
        const visualId=current.dataset.sourceObjectId;
        const domainId=this._record.projection.visualToDomain.get(visualId)||null;
        const modelEvent=this._record.projection.model.events.find(
          (item)=>item.id===visualId
        );
        if(event.key==="Escape"&&this._record.surface==="full-preview"){
          event.preventDefault();
          this.dispatchEvent(new CustomEvent("d1-411a:command",{
            bubbles:true,composed:true,
            detail:{surface:this._record.surface,domainId,command:"close-preview"}
          }));
          return;
        }
        if(this._record.editable&&domainId&&event.metaKey&&event.key.toLowerCase()==="z"){
          event.preventDefault();
          this.dispatchEvent(new CustomEvent("d1-411a:command",{
            bubbles:true,composed:true,
            detail:{surface:this._record.surface,domainId,command:event.shiftKey?"redo":"undo"}
          }));
          return;
        }
        if(this._record.editable&&domainId&&["Delete","Backspace"].includes(event.key)){
          event.preventDefault();
          this.dispatchEvent(new CustomEvent("d1-411a:command",{
            bubbles:true,composed:true,
            detail:{surface:this._record.surface,domainId,command:"delete"}
          }));
          return;
        }
        if(
          this._record.editable&&domainId&&modelEvent&&
          ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)&&
          (event.shiftKey||event.altKey)
        ){
          event.preventDefault();
          const horizontal=event.key==="ArrowLeft"||event.key==="ArrowRight";
          const direction=event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:1;
          const lane=Math.max(0,Math.min(6,Number(modelEvent.lane||0)+direction));
          this.dispatchEvent(new CustomEvent("d1-411a:gesture",{
            bubbles:true,composed:true,
            detail:{
              surface:this._record.surface,
              domainId,
              kind:event.altKey&&horizontal?"resize-end":horizontal?"move":"lane",
              monthDelta:horizontal?direction:0,
              targetLane:horizontal?null:lane
            }
          }));
          return;
        }
        const currentHits=hits();
        const index=Math.max(0,currentHits.indexOf(current));
        const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
        if(direction){
          event.preventDefault();
          const next=(index+direction+currentHits.length)%currentHits.length;
          currentHits.forEach((node,i)=>node.tabIndex=i===next?0:-1);
          currentHits[next]?.focus();
          return;
        }
        if(["Enter"," "].includes(event.key)){
          event.preventDefault();
          const source=childDocument.querySelector(
            `[data-object-id="${CSS.escape(current.dataset.sourceObjectId)}"]`
          );
          source?.dispatchEvent(new MouseEvent("dblclick",{bubbles:true}));
        }
      };
      childDocument.addEventListener("keydown",keydown);
      this._childCleanup.push(()=>childDocument.removeEventListener("keydown",keydown));
    }

    const dragover=(event)=>{
      if(!this._record.acceptsMedia)return;
      const types=[...(event.dataTransfer?.types||[])];
      if(!types.includes("application/x-missionmed-media-id"))return;
      event.preventDefault();
      event.dataTransfer.dropEffect="copy";
    };
    const drop=(event)=>{
      if(!this._record.acceptsMedia)return;
      const id=event.dataTransfer?.getData("application/x-missionmed-media-id");
      if(!id)return;
      event.preventDefault();
      const board=childDocument.getElementById("board");
      const bounds=board.getBoundingClientRect();
      const scale=bounds.width/1920;
      this.dispatchEvent(new CustomEvent("d1-411a:media-drop",{
        bubbles:true,composed:true,
        detail:{
          id,
          surface:this._record.surface,
          x:(event.clientX-bounds.left)/scale,
          y:(event.clientY-bounds.top)/scale
        }
      }));
    };
    childDocument.addEventListener("dragover",dragover);
    childDocument.addEventListener("drop",drop);
    this._childCleanup.push(()=>childDocument.removeEventListener("dragover",dragover));
    this._childCleanup.push(()=>childDocument.removeEventListener("drop",drop));

    if(this._record.editable){
      const pointerdown=(event)=>this._beginGesture(event,childDocument);
      const pointermove=(event)=>this._moveGesture(event,childDocument);
      const pointerup=(event)=>this._endGesture(event,childDocument);
      childDocument.addEventListener("pointerdown",pointerdown);
      childDocument.addEventListener("pointermove",pointermove);
      childDocument.addEventListener("pointerup",pointerup);
      childDocument.addEventListener("pointercancel",pointerup);
      this._childCleanup.push(()=>childDocument.removeEventListener("pointerdown",pointerdown));
      this._childCleanup.push(()=>childDocument.removeEventListener("pointermove",pointermove));
      this._childCleanup.push(()=>childDocument.removeEventListener("pointerup",pointerup));
      this._childCleanup.push(()=>childDocument.removeEventListener("pointercancel",pointerup));
    }
  }

  _refreshHits(childDocument){
    if(!this._hitLayer||!this._record?.interactive)return;
    const board=childDocument.getElementById("board");
    const boardBounds=board.getBoundingClientRect();
    const scale=boardBounds.width/1920||1;
    // The protected kernel may replace its event nodes during a resize-driven
    // rerender. Re-resolve those exact protected nodes instead of retaining
    // detached references; the overlay is engineering interaction chrome only.
    this._hitSources=[...childDocument.querySelectorAll(INTERACTIVE_OBJECT_SELECTOR)];
    this._hitLayer.textContent="";
    this._hitSources.forEach((source,index)=>{
      const bounds=source.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return;
      const width=Math.max(bounds.width,44)/scale;
      const height=Math.max(bounds.height,44)/scale;
      const x=(bounds.left-boardBounds.left)/scale-(width-bounds.width/scale)/2;
      const y=(bounds.top-boardBounds.top)/scale-(height-bounds.height/scale)/2;
      const hit=childDocument.createElement("button");
      hit.type="button";
      hit.className="d1411AHit";
      hit.setAttribute("data-d1-411a-hit","true");
      hit.dataset.sourceObjectId=source.dataset.objectId;
      hit.setAttribute("aria-selected",String(source.dataset.objectId===this._selectedObjectId));
      hit.tabIndex=index===0?0:-1;
      hit.setAttribute("aria-label",source.textContent?.trim()?.replace(/\s+/g," ")||"Timeline item");
      hit.style.left=`${x}px`;hit.style.top=`${y}px`;
      hit.style.width=`${width}px`;hit.style.height=`${height}px`;
      if(source.matches(".arrow[data-object-id]")){
        for(const handle of ["w","e"]){
          const marker=childDocument.createElement("span");
          marker.className="d1411AHandle";
          marker.dataset.handle=handle;
          hit.append(marker);
        }
      }else if(source.matches("#key[data-object-id]")){
        const marker=childDocument.createElement("span");
        marker.className="d1411AHandle";
        marker.dataset.handle="se";
        marker.setAttribute("aria-hidden","true");
        hit.append(marker);
      }else if(source.matches("#profile[data-object-id]")){
        const marker=childDocument.createElement("span");
        marker.className="d1411AHandle";
        marker.dataset.handle="se";
        marker.setAttribute("aria-hidden","true");
        hit.append(marker);
      }else if(source.matches("#axis[data-object-id]")){
        const segments=[...source.querySelectorAll(".yseg")];
        const sourceBounds=source.getBoundingClientRect();
        segments.slice(0,-1).forEach((segment,boundaryIndex)=>{
          const marker=childDocument.createElement("span");
          marker.className="d1411AAxisBoundary";
          marker.dataset.axisBoundaryIndex=String(boundaryIndex);
          marker.style.left=`${(segment.getBoundingClientRect().right-sourceBounds.left)/scale}px`;
          marker.setAttribute("aria-hidden","true");
          hit.append(marker);
        });
      }
      this._hitLayer.append(hit);
    });
  }

  selectObject(objectId=null){
    this._selectedObjectId=objectId==null?null:String(objectId);
    const childDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(childDocument&&this._hitLayer){
      this._hitLayer.querySelectorAll("[data-d1-411a-hit]").forEach((hit)=>{
        hit.setAttribute(
          "aria-selected",
          String(hit.dataset.sourceObjectId===this._selectedObjectId)
        );
      });
    }
    return this._selectedObjectId;
  }

  restorePresentationGeometry({colorKeyGeometry=null,profileGeometry=null}={}){
    const childDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(!childDocument)return false;
    const apply=(selector,geometry)=>{
      const node=childDocument.querySelector(selector);
      if(!node||!geometry)return;
      for(const field of ["x","y","width","height"]){
        if(!Number.isFinite(Number(geometry[field])))return;
      }
      Object.assign(node.style,{
        left:`${Number(geometry.x)}px`,
        top:`${Number(geometry.y)}px`,
        width:`${Number(geometry.width)}px`,
        height:`${Number(geometry.height)}px`
      });
    };
    apply("#key",colorKeyGeometry);
    apply("#profile",profileGeometry);
    if(this._hitLayer)this._refreshHits(childDocument);
    return true;
  }

  _axisLayout(childDocument,weights=null){
    const axis=childDocument.getElementById("axis");
    const segments=[...(axis?.querySelectorAll(".yseg")||[])];
    if(!axis||segments.length<1)return null;
    const ids=segments.map((segment)=>String(segment.textContent||"").trim());
    const existingUsable=segments.map((segment)=>Math.max(1,cssNumber(segment.style.width,0)-14));
    const total=existingUsable.reduce((sum,width)=>sum+width,0)||1904;
    const supplied=Array.isArray(weights)&&weights.length===ids.length&&weights.every((item,index)=>
      String(item?.id||"")===ids[index]&&finite(item?.weight,0)>=.25&&finite(item?.weight,0)<=8
    )?weights:null;
    const values=supplied
      ?supplied.map((item)=>finite(item.weight,1))
      :existingUsable.map((width)=>width/(total/segments.length));
    const sum=values.reduce((value,weight)=>value+weight,0)||1;
    const axisLeft=cssNumber(axis.style.left,8);
    let cursor=axisLeft;
    const positions=new Map();
    segments.forEach((segment,index)=>{
      const usable=total*values[index]/sum;
      positions.set(ids[index],{x0:cursor,width:usable});
      segment.style.width=`${usable+14}px`;
      cursor+=usable;
    });
    const timeX=(year,month)=>{
      const position=positions.get(String(year));
      return position?position.x0+(clamp(finite(month,1),1,12)-1)/12*position.width:axisLeft;
    };
    for(const modelEvent of this._record?.projection?.model?.events||[]){
      const node=childDocument.querySelector(`.arrow[data-object-id="${CSS.escape(modelEvent.id)}"]`);
      if(!node)continue;
      const x0=timeX(modelEvent.sy,modelEvent.sm);
      const x1=timeX(modelEvent.ey,modelEvent.em);
      node.style.left=`${x0}px`;
      node.style.width=`${Math.max(88,x1-x0)}px`;
    }
    for(const flag of this._record?.projection?.model?.flags||[]){
      const node=childDocument.querySelector(`.flag[data-object-id="${CSS.escape(flag.id)}"]`);
      if(node)node.style.left=`${timeX(flag.year,flag.m)}px`;
    }
    return{ids,total,values,positions};
  }

  _applyPresentationOverrides(childDocument,record=this._record){
    const overrides=record?.projection?.visualDocument?.presentation?.manualOverrides||{};
    const axis=overrides.axis;
    this._axisLayout(childDocument,axis?.segmentWeights);
    const key=childDocument.getElementById("key");
    const geometry=overrides.colorKeyGeometry;
    if(key&&geometry&&typeof geometry==="object"){
      const width=clamp(finite(geometry.width,416),300,760);
      const height=clamp(finite(geometry.height,322),240,720);
      key.style.left=`${clamp(finite(geometry.x,18),0,1920-width)}px`;
      key.style.top=`${clamp(finite(geometry.y,300),0,1080-height)}px`;
      key.style.width=`${width}px`;
      key.style.height=`${height}px`;
    }
    const profile=childDocument.getElementById("profile");
    const profileGeometry=overrides.profileGeometry;
    if(profile&&profileGeometry&&typeof profileGeometry==="object"){
      const width=clamp(finite(profileGeometry.width,566),360,900);
      const height=clamp(finite(profileGeometry.height,428),272,680);
      profile.style.left=`${clamp(finite(profileGeometry.x,18),0,1920-width)}px`;
      profile.style.top=`${clamp(finite(profileGeometry.y,634),0,1080-height)}px`;
      profile.style.width=`${width}px`;
      profile.style.height=`${height}px`;
    }
  }

  /*
   * Composition law: protected furniture and timeline events are spatial participants in
   * the same board, not independent layers. The board offers only two event lanes that
   * clear the Color Key's default band, so once three or more events overlap in time over
   * the same stretch of axis, some arrow must otherwise be drawn underneath it with its
   * label unreadable.
   *
   * Chronology is not negotiable and the arrow lanes are frozen, so the participant that
   * moves is the one whose position carries no meaning: the Color Key legend. It is
   * relocated only when it is actually obstructing, only when the student has not placed it
   * themselves, and only to the nearest position that clears every arrow, flag and other
   * piece of furniture - so the approved default survives every composition that fits.
   *
   * This is presentation-only. The student's document is never mutated, so a reload with
   * fewer events puts the legend back where the design intends.
   */
  _avoidFurnitureObstruction(childDocument,record=this._record){
    const overrides=record?.projection?.visualDocument?.presentation?.manualOverrides||{};
    // A legend the student positioned themselves is their decision, not ours to override.
    if(overrides.colorKeyGeometry&&typeof overrides.colorKeyGeometry==="object")return;
    const board=childDocument.getElementById("board");
    const key=childDocument.getElementById("key");
    if(!board||!key)return;
    const boardRect=board.getBoundingClientRect();
    if(!boardRect.width)return;
    const scale=boardRect.width/1920;
    const toBoard=(node)=>{
      const r=node.getBoundingClientRect();
      return{x:(r.left-boardRect.left)/scale,y:(r.top-boardRect.top)/scale,w:r.width/scale,h:r.height/scale};
    };
    const intersects=(a,b,pad=0)=>
      a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;

    // Everything the legend must not sit on: every arrow with its labels, every milestone
    // flag, and the other furniture whose positions are fixed by the design.
    const obstacles=[];
    childDocument.querySelectorAll("#arrowLayer .arrow").forEach((arrow)=>{
      obstacles.push(toBoard(arrow));
      arrow.querySelectorAll(".die,.date,.loc,.al").forEach((part)=>obstacles.push(toBoard(part)));
    });
    childDocument.querySelectorAll("#flagLayer .flag").forEach((flag)=>obstacles.push(toBoard(flag)));
    for(const selector of ["#profile","#titleWrap","#axis","#ivrWrap","#logoMount"]){
      const node=childDocument.querySelector(selector);
      if(node&&node.offsetParent!==null)obstacles.push(toBoard(node));
    }

    const width=key.offsetWidth||416;
    const height=key.offsetHeight||322;
    const home={x:18,y:300};
    const clear=(x,y)=>!obstacles.some((obstacle)=>intersects({x,y,w:width,h:height},obstacle,8));
    /* Write only when the value actually changes. Restyling the legend on every render is
       a layout write the renderer does not need, and a needless one inside a render
       completion path invites a settle loop. */
    const place=(x,y)=>{
      const left=`${x}px`,top=`${y}px`;
      if(key.style.left!==left)key.style.left=left;
      if(key.style.top!==top)key.style.top=top;
    };
    if(clear(home.x,home.y)){
      place(home.x,home.y);
      return;
    }
    // Nearest-first scan, so the legend lands as close to its designed home as the
    // composition allows and the result is identical for identical input.
    // Search outward from home and stop at the first position that clears, so the legend
    // still lands as close to its designed place as the composition allows without
    // evaluating the whole board every render.
    const step=32;
    const candidates=[];
    for(let y=8;y+height<=1072;y+=step){
      for(let x=8;x+width<=1912;x+=step)candidates.push({x,y,distance:Math.hypot(x-home.x,y-home.y)});
    }
    candidates.sort((left,right)=>left.distance-right.distance);
    const placed=candidates.find((candidate)=>clear(candidate.x,candidate.y));
    if(!placed)return;
    place(placed.x,placed.y);
  }

  _fitProtectedFurnitureText(childDocument){
    const title=childDocument.querySelector("#title span");
    if(title){
      title.style.whiteSpace="nowrap";
      title.style.lineHeight="1";
      let size=34;
      title.style.fontSize=`${size}px`;
      while(size>18&&title.scrollWidth>540){
        size-=1;
        title.style.fontSize=`${size}px`;
      }
    }
    // The interview ribbon sits in a fixed 232px plate and is not covered by any of the
    // kernel's fit laws, so a realistic programme name was simply clipped mid-word in the
    // top right - the second contributor to crowded, broken-looking upper-right text.
    const ribbon=childDocument.querySelector("#ivr span");
    if(ribbon){
      ribbon.style.whiteSpace="nowrap";
      let size=22;
      ribbon.style.fontSize=`${size}px`;
      while(size>13&&ribbon.scrollWidth>ribbon.clientWidth+1){
        size-=1;
        ribbon.style.fontSize=`${size}px`;
      }
      if(ribbon.scrollWidth>ribbon.clientWidth+1){
        const full=String(ribbon.dataset.d1FullLabel??ribbon.textContent??"");
        ribbon.dataset.d1FullLabel=full;
        let length=full.length;
        while(length>4&&ribbon.scrollWidth>ribbon.clientWidth+1){
          length-=1;
          ribbon.textContent=`${full.slice(0,length).trim()}\u2026`;
        }
        ribbon.title=full;
      }
    }
  }

  /*
   * Milestone flags are the one composed layer the protected kernel neither
   * bounds-checks nor de-collides: buildFlags pins every flag to a single row at
   * top:82px anchored to its date, and postRenderChecks only inspects `.arrow`
   * parts. Two milestones a few months apart therefore render their labels straight
   * through each other, and a late milestone runs off the right edge - silently, so
   * automated checks pass while the student and the export both show jumbled text.
   *
   * Fit them here using the kernel's own established remedy for crowded locations
   * (shrink, then ellipsis), which preserves each flag's chronological anchor. Flags
   * are rebuilt from scratch on every render, so no baseline restore is needed.
   */
  _fitMilestoneFlags(childDocument){
    const BOARD_WIDTH=1920;
    const RIGHT_MARGIN=10;
    const MIN_GAP=16;
    const BASE_FONT=19;
    const MIN_FONT=13;
    const MIN_LABEL_CHARS=6;
    // Stack upward from the frozen 82px row. 48 and 14 stay clear of the axis at
    // y=112 and of the arrow lanes (LANE_Y[0]=196); rows above the base may only be
    // used where the title plaque is not in the way.
    const ROW_TOPS=[82,48,14];
    const BASE_TOP=ROW_TOPS[0];
    const BASE_STEM_HEIGHT=8;
    const flags=[...childDocument.querySelectorAll("#flagLayer .flag")]
      .map((el)=>({el,left:cssNumber(el.style.left,0)}))
      .sort((a,b)=>a.left-b.left);
    // Leaves a cheap trace of how often the pass ran and over how many flags, so a
    // future regression in render ordering is visible without re-instrumenting.
    const root=childDocument.documentElement;
    root.dataset.d1FlagFitRuns=String(Number(root.dataset.d1FlagFitRuns||0)+1);
    root.dataset.d1FlagFitCount=String(flags.length);
    if(!flags.length)return;
    // Restore each flag to its protected baseline first. The pass runs on every layout
    // settle, and without this a second run would shrink an already-shortened label
    // again ("USMLE Step 1" -> "USMLE…" -> "USM…").
    for(const flag of flags){
      const label=flag.el.querySelector(".lbl");
      if(!label)continue;
      const textNode=[...label.childNodes].reverse().find((node)=>node.nodeType===3);
      if(textNode){
        if(label.dataset.d1FullLabel===undefined)label.dataset.d1FullLabel=textNode.textContent;
        else textNode.textContent=label.dataset.d1FullLabel;
      }
      label.style.fontSize="";
      flag.el.style.top=`${BASE_TOP}px`;
      const stem=flag.el.querySelector(".stem");
      if(stem)stem.style.height=`${BASE_STEM_HEIGHT}px`;
    }

    // The title plaque owns the top strip across the middle of the board. A flag may
    // only use the raised row where it clears that plaque horizontally.
    const plaque=childDocument.querySelector("#titleWrap")||childDocument.querySelector("#title");
    let plaqueLeft=Infinity,plaqueRight=-Infinity;
    if(plaque){
      const board=childDocument.getElementById("board");
      const boardRect=board?.getBoundingClientRect();
      const plaqueRect=plaque.getBoundingClientRect();
      const scale=boardRect&&boardRect.width?boardRect.width/BOARD_WIDTH:1;
      if(boardRect&&scale>0){
        plaqueLeft=(plaqueRect.left-boardRect.left)/scale;
        plaqueRight=plaqueLeft+plaqueRect.width/scale;
      }
    }

    // Pass 1 - stagger. Walk left to right keeping the last occupied right edge for
    // each row; a flag that cannot fit beside its neighbour moves to the raised row
    // when the plaque allows, which is what keeps clustered exam milestones legible.
    const lastRight=ROW_TOPS.map(()=>-Infinity);
    for(const flag of flags){
      const width=flag.el.offsetWidth;
      const clearsPlaque=flag.left+width<plaqueLeft||flag.left>plaqueRight;
      // Take the lowest row that is genuinely free. Rows above the base may only be
      // used where the title plaque is not in the way; if no row is free, fall back to
      // the emptiest one and let the fitting pass below shrink the label.
      const usable=ROW_TOPS.map((_,index)=>index).filter((index)=>index===0||clearsPlaque);
      let rowIndex=usable.find((index)=>flag.left>=lastRight[index]+MIN_GAP);
      if(rowIndex===undefined){
        rowIndex=usable.reduce((best,index)=>lastRight[index]<lastRight[best]?index:best,usable[0]);
      }
      const row=ROW_TOPS[rowIndex];
      flag.row=row;
      flag.el.style.top=`${row}px`;
      flag.el.style.zIndex=String(5+rowIndex);
      const stem=flag.el.querySelector(".stem");
      if(stem)stem.style.height=`${BASE_STEM_HEIGHT+(BASE_TOP-row)}px`;
      lastRight[rowIndex]=flag.left+width;
    }

    // Pass 2 - fit whatever still crowds its neighbour on the same row, using the
    // kernel's own remedy for crowded labels: shrink first, ellipsis only if needed.
    flags.forEach((flag,index)=>{
      const label=flag.el.querySelector(".lbl");
      if(!label)return;
      const next=flags.slice(index+1).find((candidate)=>candidate.row===flag.row);
      const available=next
        ?Math.max(0,next.left-flag.left-MIN_GAP)
        :Math.max(0,BOARD_WIDTH-RIGHT_MARGIN-flag.left);
      if(available<=0||flag.el.offsetWidth<=available)return;
      let size=BASE_FONT;
      while(size>MIN_FONT&&flag.el.offsetWidth>available){
        size-=1;
        label.style.fontSize=`${size}px`;
      }
      if(flag.el.offsetWidth<=available)return;
      const textNode=[...label.childNodes].reverse().find(
        (node)=>node.nodeType===3&&node.textContent.trim()
      );
      if(!textNode)return;
      const original=textNode.textContent.trim();
      let length=original.length;
      while(length>MIN_LABEL_CHARS&&flag.el.offsetWidth>available){
        length-=1;
        textNode.textContent=`${original.slice(0,length).trim()}\u2026`;
      }
    });
  }

  _applyAdvancedOverlay(childDocument,record=this._record){
    if(this._advancedTextEditing===true&&childDocument.activeElement?.matches?.(".d1411aAdvancedText[contenteditable=\"true\"]"))return;
    const retainedAdvancedSelection=this._advancedSelection||null;
    this._advancedOverlayCleanup();
    this._advancedOverlayCleanup=()=>{};
    this.selectAdvancedObject=()=>{};
    this.releaseAdvancedGroup=()=>false;
    childDocument.getElementById("d1411a-advanced-overlay")?.remove();
    const advanced=record?.document?.mode==="advanced"?record.document.advanced:null;
    if(!advanced)return;
    const items=[
      ...(Array.isArray(advanced.media)?advanced.media:[]).filter((item)=>item?.placed!==false).map((item)=>({type:"media",...item})),
      ...(Array.isArray(advanced.textBlocks)?advanced.textBlocks:[]).map((item)=>({type:"text",...item})),
      ...(Array.isArray(advanced.elements)?advanced.elements:[]).map((item)=>({type:"element",...item}))
    ].filter((item)=>item&&item.id);
    const groups=new Map((Array.isArray(advanced.groups)?advanced.groups:[]).map((group)=>[String(group.id),group]));
    const board=childDocument.getElementById("board");
    if(!board)return;
    const background=advancedBackgroundCss(advanced.background,record.resolveObjectUrl);
    if(background)board.style.background=background;
    else board.style.removeProperty("background");
    if(!items.length)return;
    const style=childDocument.createElement("style");
    style.textContent=`#d1411a-advanced-overlay{position:absolute;inset:0;z-index:1001;pointer-events:none}#d1411a-advanced-overlay .d1411aAdvanced{box-sizing:border-box;position:absolute;pointer-events:auto;touch-action:none;cursor:move;user-select:none}#d1411a-advanced-overlay .d1411aAdvanced[data-selected="true"]{outline:3px solid #39d6ff;outline-offset:2px;box-shadow:0 0 0 1px rgba(7,17,31,.85),0 0 14px rgba(57,214,255,.52)}#d1411a-advanced-overlay .d1411aAdvancedText{background:transparent;border:0;color:#191c21;display:flex;flex-direction:column;align-items:stretch;font:400 24px/1.2 Inter,sans-serif;min-width:32px;overflow:hidden;overflow-wrap:anywhere;white-space:pre-wrap}#d1411a-advanced-overlay .d1411aAdvancedText[data-overflow="true"]{outline:3px dashed #c03d2e}#d1411a-advanced-overlay .d1411aAdvancedText[contenteditable="true"]{cursor:text;display:block;outline:3px solid #ffad42;overflow:auto;user-select:text;white-space:pre-wrap}#d1411a-advanced-overlay .d1411aAdvancedElement{align-items:center;border:3px solid #17324a;display:flex;justify-content:center;overflow:visible}#d1411a-advanced-overlay .d1411aAdvancedMedia{background:rgba(11,19,32,.12);border:0;overflow:hidden}#d1411a-advanced-overlay .d1411aAdvancedMedia img{display:block;height:100%;max-width:none;pointer-events:none;transform-origin:center;width:100%}#d1411a-advanced-overlay .kind-circle{border-radius:50%}.d1411aHandle{appearance:none;background:radial-gradient(circle,#fff 0 5px,#18799e 6px 8px,transparent 9px);border:0;height:28px;margin:0;padding:0;position:absolute;width:28px;z-index:2}.d1411aHandle[data-handle="nw"]{left:-15px;top:-15px}.d1411aHandle[data-handle="n"]{left:calc(50% - 14px);top:-15px}.d1411aHandle[data-handle="ne"]{right:-15px;top:-15px}.d1411aHandle[data-handle="e"]{right:-15px;top:calc(50% - 14px)}.d1411aHandle[data-handle="se"]{bottom:-15px;right:-15px}.d1411aHandle[data-handle="s"]{bottom:-15px;left:calc(50% - 14px)}.d1411aHandle[data-handle="sw"]{bottom:-15px;left:-15px}.d1411aHandle[data-handle="w"]{left:-15px;top:calc(50% - 14px)}.d1411aGroupBox{box-sizing:border-box;border:3px dashed #39d6ff;pointer-events:none;position:absolute;z-index:10000}.d1411aGroupBox:focus-visible{outline:4px solid #fff;outline-offset:3px}.d1411aGroupBox .d1411aHandle{pointer-events:auto;position:absolute}.d1411aSnapGuide{background:#ff7a45;box-shadow:0 0 0 1px rgba(255,255,255,.9);pointer-events:none;position:absolute;z-index:4}.d1411aSnapGuide[data-axis="x"]{bottom:0;top:0;width:2px}.d1411aSnapGuide[data-axis="y"]{height:2px;left:0;right:0}.d1411aMarquee{background:rgba(57,214,255,.12);border:2px solid #39d6ff;box-sizing:border-box;pointer-events:none;position:absolute;z-index:5}`;
    const overlay=childDocument.createElement("div");
    overlay.id="d1411a-advanced-overlay";
    // D1-409H exports a clone of #board rather than the child document head.
    // Keep the Timeline-owned overlay rules inside the cloned boundary so
    // Advanced objects preserve absolute geometry in PNG/PDF artifacts.
    overlay.append(style);
    const makeElement=(item)=>{
      const node=childDocument.createElement(item.type==="text"?"div":"div");
      const width=Math.max(32,finite(item.width,160));
      const height=Math.max(24,finite(item.height,item.type==="text"?48:96));
      node.className=item.type==="text"
        ?"d1411aAdvanced d1411aAdvancedText"
        :item.type==="media"
          ?"d1411aAdvanced d1411aAdvancedMedia"
          :"d1411aAdvanced d1411aAdvancedElement";
      node.dataset.advancedType=item.type;
      node.dataset.advancedId=String(item.id);
      node.dataset.advancedKind=String(item.kind||"");
      node.dataset.groupId=String(item.groupId||"");
      node.dataset.aspectLocked=String(item.aspectLocked!==false);
      node.dataset.locked=String(item.locked===true);
      node.style.left=`${finite(item.x,0)}px`;
      node.style.top=`${finite(item.y,0)}px`;
      node.style.width=`${width}px`;
      node.style.height=`${height}px`;
      node.style.zIndex=String(Math.trunc(finite(item.zIndex,finite(item.layerIndex,0))));
      node.tabIndex=0;
      node.setAttribute("role","button");
      node.setAttribute("aria-label",`${item.label||item.text||item.kind||"Timeline asset"}; select to move or resize`);
      if(item.type==="text"){
        node.textContent=String(item.text||"");
        node.style.fontFamily=String(item.font||"Inter");
        node.style.fontSize=`${Math.max(10,finite(item.size,24))}px`;
        node.style.fontWeight=String(finite(item.weight,400));
        node.style.color=String(item.color||"#191c21");
        // The box is a COLUMN flex container (see the overlay stylesheet). That is what
        // makes these two lines mean what they say: the anonymous text item stretches to
        // the full width so text-align actually aligns the text, and justify-content runs
        // down the main axis so vertical alignment is genuinely vertical. As a row
        // container the alignment control did nothing and the vertical control moved text
        // sideways.
        node.style.textAlign=["left","center","right"].includes(String(item.alignment))
          ?String(item.alignment)
          :"center";
        node.style.lineHeight=String(clamp(finite(item.lineHeight,1.2),.8,2));
        /* The wrapping control persisted a field no renderer read, so "Keep on one line"
           changed nothing on the board. Overflow stays hidden either way, so the auto-fit
           pass still shrinks a single line to fit rather than clipping it. */
        node.style.whiteSpace=item.wrap==="nowrap"?"pre":"pre-wrap";
        node.style.justifyContent=item.verticalAlign==="top"?"flex-start":item.verticalAlign==="bottom"?"flex-end":"center";
        node.dataset.fitMode=item.fitMode==="fixed"?"fixed":"auto";
        node.dataset.requestedFontSize=String(Math.max(10,finite(item.size,24)));
        node.dataset.minFontSize=String(clamp(finite(item.minFontSize,10),8,72));
      }else if(item.type==="media"){
        const url=record.resolveObjectUrl?.(item.id,item)||null;
        if(url){
          const image=childDocument.createElement("img");
          image.src=url;
          image.alt=String(item.altText||item.source?.name||"");
          image.style.objectFit=item.fit==="contain"?"contain":"cover";
          image.style.objectPosition=`${clamp(finite(item.crop?.x,50),0,100)}% ${clamp(finite(item.crop?.y,50),0,100)}%`;
          image.style.transform=`scale(${clamp(finite(item.crop?.zoom,1),1,4)})`;
          node.append(image);
        }else{
          node.dataset.mediaUnavailable="true";
          node.setAttribute("aria-label",`${item.source?.name||"Media asset"}; temporarily unavailable`);
        }
      }else{
        node.style.background=String(item.fill||"#2C6E8F");
        node.style.borderColor=String(item.stroke||"#17324A");
        if(["circle","badge","pin","marker","milestone","milestone-flag"].includes(item.kind))node.classList.add("kind-circle");
        if(item.kind==="rounded-rectangle")node.style.borderRadius="18px";
        if(["line","separator"].includes(item.kind)){
          node.style.borderWidth="0";
          node.style.height="6px";
          node.style.marginTop="6px";
        }
        if(item.kind==="frame")node.style.background="transparent";
        if(item.kind==="shadow"){
          node.style.background="rgba(23,50,74,.14)";
          node.style.border="0";
          node.style.borderRadius="18px";
          node.style.boxShadow="0 18px 32px rgba(11,19,32,.28)";
        }
        const glyph={
          "arrow-right":"→","arrow-curved":"↪","arrow-thin":"⟶","arrow-thick":"➜","arrow-double":"↔",
          milestone:"◆",ribbon:"▰",pin:"●",marker:"◆",separator:"",shadow:"",
          hospital:"✚",stethoscope:"⚕",medicine:"✦",research:"⌕",microscope:"⌬",graduation:"◆",certification:"◈",award:"★",
          marriage:"♡",pregnancy:"●",baby:"●",family:"♧",home:"⌂",travel:"✈",relocation:"↔",citizenship:"◎","green-card":"▣",remembrance:"✦",
          calendar:"▦",book:"▤",interview:"◫",community:"◉",leadership:"♛",presentation:"▥",computer:"▣",heart:"♥",globe:"◎",language:"A",
          "milestone-flag":"⚑"
        };
        if(item.kind==="missionmed-wordmark"){
          node.style.background="#0B1320";
          node.style.borderColor="#2B3A50";
          node.style.borderRadius="14px";
          node.innerHTML='<strong style="color:#f5f7fa;font:italic 800 32px/1 Inter,Arial,sans-serif">MissionMed</strong><strong style="color:#ff9f36;font:italic 900 32px/1 Inter,Arial,sans-serif">//</strong>';
        }else{
          node.textContent=item.kind==="country-flag"
            ?(/^[A-Z]{2}$/.test(String(item.countryCode||""))?String.fromCodePoint(...[...String(item.countryCode).toUpperCase()].map((character)=>127397+character.charCodeAt(0))):"⚑")
            :(glyph[item.kind]||(["label","callout"].includes(item.kind)?item.label:"")||"");
        }
      }
      return node;
    };
    const fitTextNode=(node)=>{
      if(!node?.classList?.contains("d1411aAdvancedText")||node.isContentEditable)return;
      // Selection handles are appended as children of the selected node and are
      // positioned outside its box, so they add scrollable overflow. Measuring with
      // them attached made merely selecting a text object shrink it to the minimum
      // size and flag it as overflowing. Hide the chrome across the measurement.
      const chrome=[...node.querySelectorAll(".d1411aHandle")];
      for(const control of chrome)control.style.display="none";
      try{
        const requested=Math.max(10,finite(node.dataset.requestedFontSize,24));
        const minimum=clamp(finite(node.dataset.minFontSize,10),8,requested);
        let size=requested;
        node.style.fontSize=`${size}px`;
        if(node.dataset.fitMode==="auto"){
          while(size>minimum&&(node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1)){
            size=Math.max(minimum,size-1);
            node.style.fontSize=`${size}px`;
          }
        }
        const overflow=node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1;
        node.dataset.overflow=String(overflow);
        node.title=overflow?"Text does not fit. Resize the text box or choose Auto fit text.":"";
      }finally{
        for(const control of chrome)control.style.display="";
      }
    };
    for(const item of items.sort((left,right)=>finite(left.zIndex,finite(left.layerIndex))-finite(right.zIndex,finite(right.layerIndex))))overlay.append(makeElement(item));
    board.append(overlay);
    overlay.querySelectorAll(".d1411aAdvancedText").forEach(fitTextNode);
    let selected=null;
    let selectedNodes=new Set();
    let gesture=null;
    let marquee=null;
    let frame=0;
    let lastTextPointer={id:"",at:0};
    const nodeFor=(type,id)=>overlay.querySelector(`[data-advanced-type="${CSS.escape(type)}"][data-advanced-id="${CSS.escape(id)}"]`);
    const membersForGroup=(groupId)=>[...overlay.querySelectorAll(`.d1411aAdvanced[data-group-id="${CSS.escape(String(groupId))}"]`)];
    const boundsForNodes=(nodes)=>{
      if(!nodes.length)return null;
      const values=nodes.map(geometry);
      const x=Math.min(...values.map((value)=>value.x));
      const y=Math.min(...values.map((value)=>value.y));
      const right=Math.max(...values.map((value)=>value.x+value.width));
      const bottom=Math.max(...values.map((value)=>value.y+value.height));
      return{x,y,width:right-x,height:bottom-y};
    };
    const addHandles=(host)=>{
      if(!record.editable)return;
      for(const handle of ["nw","n","ne","e","se","s","sw","w"]){
        const control=childDocument.createElement("button");
        control.type="button";control.className="d1411aHandle";control.dataset.handle=handle;control.setAttribute("aria-label",`Resize ${handle}`);host.append(control);
      }
    };
    let selectedGroupId=null;
    const eventHasPoint=(event)=>Number.isFinite(event?.clientX)&&Number.isFinite(event?.clientY);
    const elementsAtEvent=(event)=>eventHasPoint(event)?childDocument.elementsFromPoint(event.clientX,event.clientY):[];
    const capturePointer=(node,event)=>{
      if(!node||!Number.isFinite(event?.pointerId))return;
      try{node.setPointerCapture?.(event.pointerId);}catch{}
    };
    const clearGroupBox=()=>overlay.querySelector(".d1411aGroupBox")?.remove();
    const showGroupBox=(groupId)=>{
      clearGroupBox();
      const nodes=membersForGroup(groupId);
      const bounds=boundsForNodes(nodes);
      if(!bounds)return null;
      const box=childDocument.createElement("div");
      box.className="d1411aGroupBox";
      box.dataset.groupId=String(groupId);
      box.tabIndex=0;
      box.setAttribute("role","group");
      box.setAttribute("aria-label","Selected Timeline group; use arrow keys to move, or Delete to remove");
      Object.assign(box.style,{left:`${bounds.x}px`,top:`${bounds.y}px`,width:`${bounds.width}px`,height:`${bounds.height}px`});
      addHandles(box);overlay.append(box);
      return box;
    };
    const markSelected=(node,{announce=true,add=false}={})=>{
      overlay.querySelectorAll(".d1411aHandle").forEach((control)=>control.remove());
      clearGroupBox();selectedGroupId=null;
      if(add&&node){
        if(selectedNodes.has(node))selectedNodes.delete(node);
        else selectedNodes.add(node);
      }else selectedNodes=new Set(node?[node]:[]);
      overlay.querySelectorAll(".d1411aAdvanced").forEach((candidate)=>candidate.dataset.selected=String(selectedNodes.has(candidate)));
      selected=selectedNodes.size===1?[...selectedNodes][0]:null;
      if(selected&&record.editable){
        for(const handle of ["nw","n","ne","e","se","s","sw","w"]){
          const control=childDocument.createElement("button");
          control.type="button";control.className="d1411aHandle";control.dataset.handle=handle;control.setAttribute("aria-label",`Resize ${handle}`);selected.append(control);
        }
      }
      const members=[...selectedNodes].map((candidate)=>({type:candidate.dataset.advancedType,id:candidate.dataset.advancedId}));
      this._advancedSelection=members.length>1?{type:"multi",members}:members[0]||null;
      if(announce){
        this.dispatchEvent(new CustomEvent("d1-411a:advanced-select",{bubbles:true,composed:true,detail:members.length>1?{surface:record.surface,type:"multi",members}:{surface:record.surface,type:selected?.dataset.advancedType||null,id:selected?.dataset.advancedId||null}}));
      }
      return selectedNodes.size>0;
    };
    const markGroup=(groupId,{announce=true}={})=>{
      overlay.querySelectorAll(".d1411aHandle").forEach((control)=>control.remove());
      selectedGroupId=String(groupId);
      selectedNodes=new Set(membersForGroup(selectedGroupId));
      overlay.querySelectorAll(".d1411aAdvanced").forEach((candidate)=>candidate.dataset.selected=String(selectedNodes.has(candidate)));
      selected=null;
      const box=showGroupBox(selectedGroupId);
      this._advancedSelection={type:"group",id:selectedGroupId};
      if(announce)this.dispatchEvent(new CustomEvent("d1-411a:advanced-select",{bubbles:true,composed:true,detail:{surface:record.surface,type:"group",id:selectedGroupId}}));
      return!!box;
    };
    const select=(node)=>markSelected(node);
    this.selectAdvancedObject=(type,id)=>type==="group"?markGroup(id,{announce:false}):markSelected(nodeFor(type,id),{announce:false});
    this.releaseAdvancedGroup=(groupId,members=[])=>{
      const normalized=(Array.isArray(members)?members:[])
        .map((member)=>nodeFor(String(member?.type||""),String(member?.id||"")))
        .filter(Boolean);
      const nodes=normalized.length?normalized:membersForGroup(groupId);
      if(!nodes.length)return false;
      overlay.querySelectorAll(".d1411aHandle").forEach((control)=>control.remove());
      clearGroupBox();
      selectedGroupId=null;
      for(const node of nodes){
        if(String(node.dataset.groupId)===String(groupId))node.dataset.groupId="";
      }
      selectedNodes=new Set(nodes);
      overlay.querySelectorAll(".d1411aAdvanced").forEach((candidate)=>candidate.dataset.selected=String(selectedNodes.has(candidate)));
      selected=selectedNodes.size===1?nodes[0]:null;
      const selection=nodes.map((node)=>({type:node.dataset.advancedType,id:node.dataset.advancedId}));
      this._advancedSelection=selection.length>1?{type:"multi",members:selection}:selection[0]||null;
      return true;
    };
    const geometry=(node)=>({x:cssNumber(node.style.left),y:cssNumber(node.style.top),width:cssNumber(node.style.width,1),height:cssNumber(node.style.height,1)});
    const clearSnapGuides=()=>overlay.querySelectorAll(".d1411aSnapGuide").forEach((guide)=>guide.remove());
    const showSnapGuides=(guides)=>{
      clearSnapGuides();
      for(const [axis,value] of Object.entries(guides)){
        if(!Number.isFinite(value))continue;
        const guide=childDocument.createElement("div");
        guide.className="d1411aSnapGuide";guide.dataset.axis=axis;
        guide.style[axis==="x"?"left":"top"]=`${value}px`;
        overlay.append(guide);
      }
    };
    const snapMove=(next,currentGesture)=>{
      if(currentGesture.snapDisabled)return{geometry:next,guides:{}};
      const xTargets=currentGesture.snapTargets?.x||[0,960,1920];
      const yTargets=currentGesture.snapTargets?.y||[0,540,1080];
      const xAnchors=[next.x,next.x+next.width/2,next.x+next.width];
      const yAnchors=[next.y,next.y+next.height/2,next.y+next.height];
      let bestX=null,bestY=null;
      for(const target of xTargets)for(const anchor of xAnchors){const distance=Math.abs(target-anchor);if(distance<=12&&(!bestX||distance<bestX.distance))bestX={distance,delta:target-anchor,target};}
      for(const target of yTargets)for(const anchor of yAnchors){const distance=Math.abs(target-anchor);if(distance<=12&&(!bestY||distance<bestY.distance))bestY={distance,delta:target-anchor,target};}
      return{geometry:{...next,x:next.x+(bestX?.delta||0),y:next.y+(bestY?.delta||0)},guides:{x:bestX?.target,y:bestY?.target}};
    };
    const cacheSnapTargets=(excludedNodes=[])=>{
      const excluded=new Set(excludedNodes);
      const others=[...overlay.querySelectorAll(".d1411aAdvanced")]
        .filter((candidate)=>!excluded.has(candidate)).map(geometry);
      return{
        x:[0,960,1920,...others.flatMap((item)=>[item.x,item.x+item.width/2,item.x+item.width])],
        y:[0,540,1080,...others.flatMap((item)=>[item.y,item.y+item.height/2,item.y+item.height])]
      };
    };
    const update=()=>{
      frame=0;
      if(!gesture)return;
      const dx=gesture.pendingX-gesture.startX,dy=gesture.pendingY-gesture.startY;
      const next={...gesture.original};
      if(gesture.kind==="move"){
        next.x=clamp(next.x+dx,0,1920-next.width);next.y=clamp(next.y+dy,0,1080-next.height);
        const snapped=snapMove(next,gesture);
        Object.assign(next,snapped.geometry);
        showSnapGuides(snapped.guides);
      }else{
        clearSnapGuides();
        const horizontal=gesture.handle.includes("w")?-1:gesture.handle.includes("e")?1:0;
        const vertical=gesture.handle.includes("n")?-1:gesture.handle.includes("s")?1:0;
        if(horizontal<0){next.x+=dx;next.width-=dx;}else if(horizontal>0)next.width+=dx;
        if(vertical<0){next.y+=dy;next.height-=dy;}else if(vertical>0)next.height+=dy;
        next.width=Math.max(32,next.width);next.height=Math.max(24,next.height);
        if(gesture.aspectLocked!==false&&horizontal&&vertical){
          const aspect=gesture.original.width/gesture.original.height||1;
          next.height=next.width/aspect;
        }
        next.x=clamp(next.x,0,1920-next.width);next.y=clamp(next.y,0,1080-next.height);
      }
      gesture.preview=next;
      if(gesture.type==="group"){
        const scaleX=next.width/Math.max(1,gesture.original.width);
        const scaleY=next.height/Math.max(1,gesture.original.height);
        for(const member of gesture.members){
          const item=member.original;
          member.node.style.left=`${next.x+(item.x-gesture.original.x)*scaleX}px`;
          member.node.style.top=`${next.y+(item.y-gesture.original.y)*scaleY}px`;
          member.node.style.width=`${Math.max(32,item.width*scaleX)}px`;
          member.node.style.height=`${Math.max(24,item.height*scaleY)}px`;
          fitTextNode(member.node);
        }
        const box=overlay.querySelector(".d1411aGroupBox");
        if(box)Object.assign(box.style,{left:`${next.x}px`,top:`${next.y}px`,width:`${next.width}px`,height:`${next.height}px`});
      }else{
        gesture.node.style.left=`${next.x}px`;gesture.node.style.top=`${next.y}px`;gesture.node.style.width=`${next.width}px`;gesture.node.style.height=`${next.height}px`;
        fitTextNode(gesture.node);
      }
    };
    const placeTextCaret=(node,event)=>{
      const selection=childDocument.defaultView.getSelection?.();
      if(!selection)return;
      let range=null;
      if(event&&childDocument.caretPositionFromPoint){
        const position=childDocument.caretPositionFromPoint(event.clientX,event.clientY);
        if(position){
          range=childDocument.createRange();
          range.setStart(position.offsetNode,position.offset);
          range.collapse(true);
        }
      }else if(event&&childDocument.caretRangeFromPoint){
        range=childDocument.caretRangeFromPoint(event.clientX,event.clientY);
      }
      if(!range){
        range=childDocument.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    };
    const beginTextEdit=(node,event=null)=>{
      if(node&&(!node.isConnected||!overlay.contains(node))){
        const id=String(node.dataset?.advancedId||"");
        const currentOverlay=childDocument.getElementById("d1411a-advanced-overlay")||overlay;
        node=[...currentOverlay.querySelectorAll(".d1411aAdvancedText")]
          .find((candidate)=>String(candidate.dataset.advancedId)===id)||null;
      }
      if(!node||!record.editable||node.dataset.locked==="true")return false;
      this._advancedTextEditing=true;
      this.dispatchEvent(new CustomEvent("d1-411a:advanced-text-editing",{
        bubbles:true,composed:true,
        detail:{surface:record.surface,id:node.dataset.advancedId}
      }));
      overlay.querySelectorAll(".d1411aHandle").forEach((control)=>control.remove());
      node.dataset.editingOriginal=node.textContent||"";
      node.contentEditable="true";
      node.setAttribute("role","textbox");
      node.setAttribute("aria-multiline","true");
      node.focus();
      placeTextCaret(node,event);
      return true;
    };
    const down=(event)=>{
      const node=event.target.closest?.(".d1411aAdvanced");
      const groupControl=event.target.closest?.(".d1411aGroupBox");
      if(!node&&!groupControl)return;
      if(node?.isContentEditable)return;
      // The group selection box sits above its children after the first
      // pointerdown. Resolve the child under the second pointer so a natural
      // double-click can still enter text editing without ungrouping.
      const textNode=node?.classList.contains("d1411aAdvancedText")
        ?node
        :groupControl
          ?elementsAtEvent(event)
            .find((candidate)=>candidate.classList?.contains("d1411aAdvancedText"))
          :null;
      const textPointer=!!textNode&&event.button===0;
      const now=childDocument.defaultView.performance.now();
      const repeatedTextPointer=textPointer&&
        lastTextPointer.id===String(textNode.dataset.advancedId)&&
        now-lastTextPointer.at<=900;
      if(textPointer)lastTextPointer={id:String(textNode.dataset.advancedId),at:now};
      else lastTextPointer={id:"",at:0};
      if(textPointer&&(event.detail>=2||repeatedTextPointer)){
        lastTextPointer={id:"",at:0};
        if(beginTextEdit(textNode,event)){
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if(groupControl){
        const groupId=groupControl.dataset.groupId;
        const group=groups.get(String(groupId));
        if(!group||!record.editable||group.locked===true||event.button!==0)return;
        markGroup(groupId);
        const boardBounds=board.getBoundingClientRect();
        const handle=event.target.closest(".d1411aHandle")?.dataset.handle||"";
        const members=membersForGroup(groupId).map((member)=>({node:member,original:geometry(member)}));
        const original=boundsForNodes(members.map((member)=>member.node));
        gesture={type:"group",id:String(groupId),kind:handle?"resize":"move",handle,original,preview:{...original},members,aspectLocked:group.aspectLocked!==false,snapTargets:cacheSnapTargets(members.map((member)=>member.node)),startX:(event.clientX-boardBounds.left)/(boardBounds.width/1920),startY:(event.clientY-boardBounds.top)/(boardBounds.height/1080),pendingX:0,pendingY:0};
        gesture.pendingX=gesture.startX;gesture.pendingY=gesture.startY;
        capturePointer(groupControl,event);event.preventDefault();return;
      }
      if(event.target.closest(".d1411aHandle"))event.stopPropagation();
      if(node.dataset.groupId&&!event.shiftKey&&!event.metaKey){
        const groupId=node.dataset.groupId;
        const group=groups.get(String(groupId));
        if(!group||!record.editable||group.locked===true||event.button!==0)return;
        markGroup(groupId);
        const boardBounds=board.getBoundingClientRect();
        const members=membersForGroup(groupId).map((member)=>({node:member,original:geometry(member)}));
        const original=boundsForNodes(members.map((member)=>member.node));
        gesture={type:"group",id:String(groupId),kind:"move",handle:"",original,preview:{...original},members,aspectLocked:group.aspectLocked!==false,snapTargets:cacheSnapTargets(members.map((member)=>member.node)),startX:(event.clientX-boardBounds.left)/(boardBounds.width/1920),startY:(event.clientY-boardBounds.top)/(boardBounds.height/1080),pendingX:0,pendingY:0};
        gesture.pendingX=gesture.startX;gesture.pendingY=gesture.startY;
        capturePointer(node,event);event.preventDefault();return;
      }
      markSelected(node,{add:!!(event.shiftKey||event.metaKey)});
      if(selectedNodes.size!==1)return;
      if(!record.editable||node.dataset.locked==="true"||event.button!==0)return;
      const boardBounds=board.getBoundingClientRect();
      const handle=event.target.closest(".d1411aHandle")?.dataset.handle||"";
      gesture={node,type:node.dataset.advancedType,id:node.dataset.advancedId,kind:handle?"resize":"move",handle,aspectLocked:node.dataset.aspectLocked==="true",original:geometry(node),preview:geometry(node),snapTargets:cacheSnapTargets([node]),startX:(event.clientX-boardBounds.left)/(boardBounds.width/1920),startY:(event.clientY-boardBounds.top)/(boardBounds.height/1080),pendingX:0,pendingY:0};
      gesture.pendingX=gesture.startX;gesture.pendingY=gesture.startY;
      capturePointer(node,event);event.preventDefault();
    };
    const move=(event)=>{
      if(!gesture)return;
      const bounds=board.getBoundingClientRect();
      gesture.pendingX=(event.clientX-bounds.left)/(bounds.width/1920);gesture.pendingY=(event.clientY-bounds.top)/(bounds.height/1080);
      const distance=Math.hypot(
        gesture.pendingX-gesture.startX,
        gesture.pendingY-gesture.startY
      );
      if(distance<3){
        event.preventDefault();
        return;
      }
      gesture.snapDisabled=!!event.altKey;
      if(!frame)frame=childDocument.defaultView.requestAnimationFrame(update);
      event.preventDefault();
    };
    const up=(event)=>{
      if(!gesture)return;
      if(frame){childDocument.defaultView.cancelAnimationFrame(frame);frame=0;update();}
      const current=gesture;gesture=null;
      clearSnapGuides();
      const changed=JSON.stringify(current.preview)!==JSON.stringify(current.original);
      if(changed)this.dispatchEvent(new CustomEvent("d1-411a:advanced-gesture",{bubbles:true,composed:true,detail:{surface:record.surface,type:current.type,id:current.id,kind:current.kind,geometry:current.preview}}));
      event.preventDefault();
    };
    const dblclick=(event)=>{
      const node=event.target.closest?.(".d1411aAdvancedText")
        ||(eventHasPoint(event)?childDocument.elementFromPoint?.(event.clientX,event.clientY)?.closest?.(".d1411aAdvancedText"):null)
        ||[...overlay.querySelectorAll(".d1411aAdvancedText")].reverse().find((candidate)=>{
          const bounds=candidate.getBoundingClientRect();
          return event.clientX>=bounds.left&&event.clientX<=bounds.right
            &&event.clientY>=bounds.top&&event.clientY<=bounds.bottom;
        });
      if(beginTextEdit(node,event)){
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const blur=(event)=>{
      const node=event.target.closest?.(".d1411aAdvancedText[contenteditable]");
      if(!node)return;
      this._advancedTextEditing=false;
      node.contentEditable="false";
      node.setAttribute("role","button");
      node.removeAttribute("aria-multiline");
      delete node.dataset.editingOriginal;
      this.dispatchEvent(new CustomEvent("d1-411a:advanced-text",{bubbles:true,composed:true,detail:{surface:record.surface,id:node.dataset.advancedId,text:node.textContent||""}}));
    };
    const input=(event)=>{
      const node=event.target.closest?.(".d1411aAdvancedText[contenteditable]");
      if(!node)return;
      const selector=`[data-advanced-text-content][data-advanced-target-id="${CSS.escape(node.dataset.advancedId)}"]`;
      const panelInput=this.ownerDocument?.querySelector?.(selector);
      if(panelInput)panelInput.value=node.textContent||"";
    };
    const keydown=(event)=>{
      const node=event.target.closest?.(".d1411aAdvancedText[contenteditable]");
      if(node&&event.key==="Escape"){
        event.preventDefault();
        node.textContent=node.dataset.editingOriginal||"";
        node.blur();
        return;
      }else if(node&&(event.metaKey||event.ctrlKey)&&event.key==="Enter"){
        event.preventDefault();
        node.blur();
        return;
      }
      if(node)return;
      const targetNode=event.target.closest?.(".d1411aAdvanced");
      const groupBox=event.target.closest?.(".d1411aGroupBox");
      if(!targetNode&&!groupBox)return;
      if(event.key==="Escape"){
        event.preventDefault();markSelected(null);return;
      }
      if(targetNode?.classList.contains("d1411aAdvancedText")&&["Enter"," "].includes(event.key)){
        event.preventDefault();beginTextEdit(targetNode);return;
      }
      const selectedTarget=groupBox
        ?{type:"group",id:groupBox.dataset.groupId}
        :{type:targetNode.dataset.advancedType,id:targetNode.dataset.advancedId};
      if(["Delete","Backspace"].includes(event.key)||((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="d")){
        event.preventDefault();
        this.dispatchEvent(new CustomEvent("d1-411a:advanced-command",{bubbles:true,composed:true,detail:{surface:record.surface,command:(event.metaKey||event.ctrlKey)?"duplicate":"delete",target:selectedTarget}}));
        return;
      }
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
      event.preventDefault();
      const amount=event.shiftKey?10:1;
      const dx=event.key==="ArrowLeft"?-amount:event.key==="ArrowRight"?amount:0;
      const dy=event.key==="ArrowUp"?-amount:event.key==="ArrowDown"?amount:0;
      const current=groupBox?geometry(groupBox):geometry(targetNode);
      const next={...current,x:clamp(current.x+dx,0,1920-current.width),y:clamp(current.y+dy,0,1080-current.height)};
      this.dispatchEvent(new CustomEvent("d1-411a:advanced-gesture",{bubbles:true,composed:true,detail:{surface:record.surface,type:selectedTarget.type,id:selectedTarget.id,kind:"move",geometry:next,input:"keyboard"}}));
    };
    const backgroundDown=(event)=>{
      if(event.button!==0||!record.editable||event.target!==board)return;
      markSelected(null);
      const bounds=board.getBoundingClientRect();
      const x=clamp((event.clientX-bounds.left)/(bounds.width/1920),0,1920);
      const y=clamp((event.clientY-bounds.top)/(bounds.height/1080),0,1080);
      const box=childDocument.createElement("div");
      box.className="d1411aMarquee";box.style.left=`${x}px`;box.style.top=`${y}px`;box.style.width="0px";box.style.height="0px";overlay.append(box);
      marquee={startX:x,startY:y,x,y,box};
    };
    const marqueeMove=(event)=>{
      if(!marquee)return;
      const bounds=board.getBoundingClientRect();
      marquee.x=clamp((event.clientX-bounds.left)/(bounds.width/1920),0,1920);
      marquee.y=clamp((event.clientY-bounds.top)/(bounds.height/1080),0,1080);
      Object.assign(marquee.box.style,{left:`${Math.min(marquee.startX,marquee.x)}px`,top:`${Math.min(marquee.startY,marquee.y)}px`,width:`${Math.abs(marquee.x-marquee.startX)}px`,height:`${Math.abs(marquee.y-marquee.startY)}px`});
      event.preventDefault();
    };
    const marqueeUp=()=>{
      if(!marquee)return;
      const left=Math.min(marquee.startX,marquee.x),right=Math.max(marquee.startX,marquee.x),top=Math.min(marquee.startY,marquee.y),bottom=Math.max(marquee.startY,marquee.y);
      const chosen=[...overlay.querySelectorAll(".d1411aAdvanced")].filter((candidate)=>{const value=geometry(candidate);return value.x>=left&&value.y>=top&&value.x+value.width<=right&&value.y+value.height<=bottom;});
      marquee.box.remove();marquee=null;
      selectedNodes=new Set(chosen);
      overlay.querySelectorAll(".d1411aAdvanced").forEach((candidate)=>candidate.dataset.selected=String(selectedNodes.has(candidate)));
      const members=chosen.map((candidate)=>({type:candidate.dataset.advancedType,id:candidate.dataset.advancedId}));
      this._advancedSelection=members.length>1?{type:"multi",members}:members[0]||null;
      this.dispatchEvent(new CustomEvent("d1-411a:advanced-select",{bubbles:true,composed:true,detail:members.length>1?{surface:record.surface,type:"multi",members}:{surface:record.surface,type:members[0]?.type||null,id:members[0]?.id||null}}));
    };
    overlay.querySelectorAll(".d1411aAdvancedText").forEach((node)=>node.addEventListener("dblclick",dblclick));
    overlay.addEventListener("pointerdown",down);childDocument.addEventListener("pointerdown",backgroundDown);childDocument.addEventListener("pointermove",move);childDocument.addEventListener("pointermove",marqueeMove);childDocument.addEventListener("pointerup",up);childDocument.addEventListener("pointerup",marqueeUp);childDocument.addEventListener("pointercancel",up);childDocument.addEventListener("pointercancel",marqueeUp);childDocument.addEventListener("dblclick",dblclick,true);overlay.addEventListener("focusout",blur);overlay.addEventListener("input",input);overlay.addEventListener("keydown",keydown);
    if(retainedAdvancedSelection?.type==="group")markGroup(retainedAdvancedSelection.id,{announce:false});
    else if(retainedAdvancedSelection?.type==="multi"){
      selectedNodes=new Set((retainedAdvancedSelection.members||[]).map((member)=>nodeFor(member.type,member.id)).filter(Boolean));
      overlay.querySelectorAll(".d1411aAdvanced").forEach((candidate)=>candidate.dataset.selected=String(selectedNodes.has(candidate)));
    }else if(retainedAdvancedSelection?.type&&retainedAdvancedSelection?.id)markSelected(nodeFor(retainedAdvancedSelection.type,retainedAdvancedSelection.id),{announce:false});
    this._advancedOverlayCleanup=()=>{if(frame)childDocument.defaultView.cancelAnimationFrame(frame);marquee?.box?.remove();overlay.removeEventListener("pointerdown",down);childDocument.removeEventListener("pointerdown",backgroundDown);childDocument.removeEventListener("pointermove",move);childDocument.removeEventListener("pointermove",marqueeMove);childDocument.removeEventListener("pointerup",up);childDocument.removeEventListener("pointerup",marqueeUp);childDocument.removeEventListener("pointercancel",up);childDocument.removeEventListener("pointercancel",marqueeUp);childDocument.removeEventListener("dblclick",dblclick,true);overlay.removeEventListener("focusout",blur);overlay.removeEventListener("input",input);overlay.removeEventListener("keydown",keydown);this.selectAdvancedObject=()=>{};this.releaseAdvancedGroup=()=>false;style.remove();overlay.remove();};
  }

  _pointMonth(event,childDocument){
    const segments=[...childDocument.querySelectorAll("#axis .yseg")];
    for(const segment of segments){
      const bounds=segment.getBoundingClientRect();
      if(event.clientX<bounds.left||event.clientX>bounds.right)continue;
      const year=Number(segment.textContent?.trim());
      const ratio=Math.max(0,Math.min(.999,(event.clientX-bounds.left)/bounds.width));
      return monthIndex(year,Math.floor(ratio*12)+1);
    }
    return null;
  }

  _beginGesture(event,childDocument){
    if(event.button!==0)return;
    const proxy=event.target.closest?.("[data-d1-411a-hit]");
    const directSource=event.target.closest?.(INTERACTIVE_OBJECT_SELECTOR);
    const sourceId=proxy?.dataset?.sourceObjectId||directSource?.dataset?.objectId;
    const board=childDocument.getElementById("board");
    const boardBounds=board.getBoundingClientRect();
    const scale=boardBounds.width/1920;
    if(scale<.4)return;
    const boundary=event.target.closest?.("[data-axis-boundary-index]");
    if(sourceId==="year-axis"&&boundary){
      const layout=this._axisLayout(childDocument);
      const boundaryIndex=Number(boundary.dataset.axisBoundaryIndex);
      if(!layout||!Number.isInteger(boundaryIndex)||boundaryIndex<0||boundaryIndex>=layout.ids.length-1)return;
      this.selectObject("year-axis");
      this._gesture={
        pointerId:event.pointerId,kind:"axis-boundary",startX:event.clientX,scale,
        boundaryIndex,ids:layout.ids,total:layout.total,
        startWidths:layout.ids.map((id)=>layout.positions.get(id).width)
      };
      proxy.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    if(sourceId==="color-key"){
      const key=childDocument.getElementById("key");
      if(!key)return;
      const keyBounds=(proxy||key).getBoundingClientRect();
      const resizeEdge=28*scale;
      const resizeFromCorner=keyBounds.right-event.clientX<=resizeEdge&&
        keyBounds.bottom-event.clientY<=resizeEdge;
      this.selectObject("color-key");
      this._gesture={
        pointerId:event.pointerId,
        kind:event.target.closest?.('[data-handle="se"]')||resizeFromCorner
          ?"color-key-resize"
          :"color-key-move",
        startX:event.clientX,startY:event.clientY,scale,
        geometry:{
          x:cssNumber(key.style.left,18),y:cssNumber(key.style.top,300),
          width:cssNumber(key.style.width,416),height:cssNumber(key.style.height,322)
        },
        key
      };
      (proxy||key).setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    if(sourceId==="profile-sheet"){
      const profile=childDocument.getElementById("profile");
      if(!profile)return;
      const bounds=profile.getBoundingClientRect();
      const geometry={
        x:(bounds.left-boardBounds.left)/scale,
        y:(bounds.top-boardBounds.top)/scale,
        width:bounds.width/scale,
        height:bounds.height/scale
      };
      const resizeEdge=28*scale;
      const resizeFromCorner=bounds.right-event.clientX<=resizeEdge&&bounds.bottom-event.clientY<=resizeEdge;
      this.selectObject("profile-sheet");
      this._gesture={
        pointerId:event.pointerId,
        kind:event.target.closest?.('[data-handle="se"]')||resizeFromCorner?"profile-card-resize":"profile-card-move",
        startX:event.clientX,startY:event.clientY,scale,geometry,profile
      };
      (proxy||profile).setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    const node=sourceId
      ?childDocument.querySelector(`.arrow[data-object-id="${CSS.escape(sourceId)}"]`)
      :event.target.closest?.(".arrow[data-object-id]");
    if(!node)return;
    const visualId=node.dataset.objectId;
    const domainId=this._record.projection.visualToDomain.get(visualId);
    const modelEvent=this._record.projection.model.events.find((item)=>item.id===visualId);
    if(!domainId||!modelEvent)return;
    const bounds=node.getBoundingClientRect();
    const edge=18*scale;
    const handle=event.target.closest?.("[data-handle]")?.dataset.handle||"";
    const kind=handle==="w"||event.clientX-bounds.left<=edge
      ?"resize-start"
      :handle==="e"||bounds.right-event.clientX<=edge
        ?"resize-end"
        :"move";
    this._gesture={
      pointerId:event.pointerId,
      domainId,
      visualId,
      kind,
      startX:event.clientX,
      startY:event.clientY,
      scale,
      startMonth:this._pointMonth(event,childDocument),
      startLane:modelEvent.lane,
      node,
      originalTransform:node.style.transform||"",
      originalLeft:node.style.left||"",
      originalWidth:node.style.width||""
    };
    (proxy||node).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  _moveGesture(event,childDocument){
    if(!this._gesture||event.pointerId!==this._gesture.pointerId)return;
    this._gesture.lastX=event.clientX;
    this._gesture.lastY=event.clientY;
    if(this._gesture.kind==="axis-boundary"){
      const gesture=this._gesture;
      const widths=[...gesture.startWidths];
      const index=gesture.boundaryIndex;
      const pairTotal=widths[index]+widths[index+1];
      const minimum=Math.max(48,gesture.total/widths.length*.25);
      widths[index]=clamp(widths[index]+(event.clientX-gesture.startX)/gesture.scale,minimum,pairTotal-minimum);
      widths[index+1]=pairTotal-widths[index];
      const average=gesture.total/widths.length;
      gesture.segmentWeights=gesture.ids.map((id,itemIndex)=>({
        id,weight:+(widths[itemIndex]/average).toFixed(4)
      }));
      this._axisLayout(childDocument,gesture.segmentWeights);
    }else if(this._gesture.kind.startsWith("color-key-")){
      const gesture=this._gesture;
      const dx=(event.clientX-gesture.startX)/gesture.scale;
      const dy=(event.clientY-gesture.startY)/gesture.scale;
      const geometry=gesture.kind==="color-key-resize"
        ?{
          ...gesture.geometry,
          width:clamp(gesture.geometry.width+dx,300,760),
          height:clamp(gesture.geometry.height+dy,240,720)
        }
        :{
          ...gesture.geometry,
          x:clamp(gesture.geometry.x+dx,0,1920-gesture.geometry.width),
          y:clamp(gesture.geometry.y+dy,0,1080-gesture.geometry.height)
        };
      geometry.x=clamp(geometry.x,0,1920-geometry.width);
      geometry.y=clamp(geometry.y,0,1080-geometry.height);
      gesture.nextGeometry=geometry;
      gesture.key.style.left=`${geometry.x}px`;
      gesture.key.style.top=`${geometry.y}px`;
      gesture.key.style.width=`${geometry.width}px`;
      gesture.key.style.height=`${geometry.height}px`;
    }else if(this._gesture.kind.startsWith("profile-card-")){
      const gesture=this._gesture;
      const dx=(event.clientX-gesture.startX)/gesture.scale;
      const dy=(event.clientY-gesture.startY)/gesture.scale;
      let geometry;
      if(gesture.kind==="profile-card-resize"){
        const aspect=gesture.geometry.width/gesture.geometry.height||1;
        const width=clamp(gesture.geometry.width+dx,360,900);
        geometry={...gesture.geometry,width,height:width/aspect};
      }else{
        geometry={...gesture.geometry,x:gesture.geometry.x+dx,y:gesture.geometry.y+dy};
      }
      geometry.width=clamp(geometry.width,360,900);
      geometry.height=clamp(geometry.height,272,680);
      geometry.x=clamp(geometry.x,0,1920-geometry.width);
      geometry.y=clamp(geometry.y,0,1080-geometry.height);
      gesture.nextGeometry=geometry;
      Object.assign(gesture.profile.style,{left:`${geometry.x}px`,top:`${geometry.y}px`,width:`${geometry.width}px`,height:`${geometry.height}px`});
    }else if(this._gesture.node){
      const gesture=this._gesture;
      const dx=(event.clientX-gesture.startX)/gesture.scale;
      const dy=(event.clientY-gesture.startY)/gesture.scale;
      gesture.previewDx=dx;
      gesture.previewDy=dy;
      this._hitLayer?.querySelectorAll?.(".d1411AInteractionGuide").forEach((guide)=>guide.remove());
      if(gesture.kind==="move"){
        gesture.node.style.transform=`translate(${dx}px, ${dy}px)`;
        const bounds=gesture.node.getBoundingClientRect();
        const board=childDocument.getElementById("board").getBoundingClientRect();
        const center=(bounds.left+bounds.right)/2;
        const boardCenter=(board.left+board.right)/2;
        if(Math.abs(center-boardCenter)<=12*gesture.scale&&this._hitLayer){
          const guide=childDocument.createElement("span");
          guide.className="d1411AInteractionGuide";
          guide.dataset.axis="x";
          guide.style.left="960px";
          this._hitLayer.append(guide);
        }
      }else{
        const baseLeft=cssNumber(gesture.originalLeft);
        const baseWidth=cssNumber(gesture.originalWidth,gesture.node.getBoundingClientRect().width/gesture.scale);
        const width=Math.max(88,baseWidth+(gesture.kind==="resize-start"?-dx:dx));
        gesture.node.style.width=`${width}px`;
        if(gesture.kind==="resize-start")gesture.node.style.left=`${baseLeft+dx}px`;
      }
    }
    event.preventDefault();
  }

  _endGesture(event,childDocument){
    const gesture=this._gesture;
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    this._gesture=null;
    this._hitLayer?.querySelectorAll?.(".d1411AInteractionGuide").forEach((guide)=>guide.remove());
    if(event.type==="pointercancel"){
      if(gesture.node){
        gesture.node.style.transform=gesture.originalTransform;
        gesture.node.style.left=gesture.originalLeft;
        gesture.node.style.width=gesture.originalWidth;
      }
      return;
    }
    const dx=(gesture.lastX??event.clientX)-gesture.startX;
    const dy=(gesture.lastY??event.clientY)-gesture.startY;
    if(Math.hypot(dx,dy)<5){
      if(gesture.node){
        gesture.node.style.transform=gesture.originalTransform;
        gesture.node.style.left=gesture.originalLeft;
        gesture.node.style.width=gesture.originalWidth;
      }
      return;
    }
    if(gesture.kind==="axis-boundary"){
      const numeric=gesture.ids.filter((id)=>/^\d{4}$/.test(id)).map(Number);
      this.dispatchEvent(new CustomEvent("d1-411a:presentation-gesture",{
        bubbles:true,composed:true,
        detail:{
          surface:this._record.surface,kind:gesture.kind,
          startYear:Math.min(...numeric),endYear:Math.max(...numeric),
          includeFuture:gesture.ids.includes("FUTURE"),
          segmentWeights:gesture.segmentWeights
        }
      }));
      this._refreshHits(childDocument);
      return;
    }
    if(gesture.kind.startsWith("color-key-")){
      this.dispatchEvent(new CustomEvent("d1-411a:presentation-gesture",{
        bubbles:true,composed:true,
        detail:{surface:this._record.surface,kind:gesture.kind,geometry:gesture.nextGeometry}
      }));
      this._refreshHits(childDocument);
      return;
    }
    if(gesture.kind.startsWith("profile-card-")){
      this.dispatchEvent(new CustomEvent("d1-411a:presentation-gesture",{
        bubbles:true,composed:true,
        detail:{surface:this._record.surface,kind:gesture.kind,geometry:gesture.nextGeometry}
      }));
      this._refreshHits(childDocument);
      return;
    }
    const endMonth=this._pointMonth(event,childDocument);
    let kind=gesture.kind;
    let targetLane=null;
    if(kind==="move"&&Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx)*.6){
      kind="lane";
      const laneY=[196,252,316,382,448,506,564];
      const board=childDocument.getElementById("board").getBoundingClientRect();
      const scale=board.width/1920;
      const y=(event.clientY-board.top)/scale;
      targetLane=laneY.reduce((best,value,index)=>
        Math.abs(value-y)<Math.abs(laneY[best]-y)?index:best,0);
    }
    this.dispatchEvent(new CustomEvent("d1-411a:gesture",{
      bubbles:true,composed:true,
      detail:{
        surface:this._record.surface,
        domainId:gesture.domainId,
        kind,
        monthDelta:gesture.startMonth!=null&&endMonth!=null?endMonth-gesture.startMonth:0,
        targetLane
      }
    }));
  }

  resize(){
    if(!this._kernel)return null;
    const width=this.clientWidth||1920;
    const height=width*9/16;
    // Preserve the protected document's invariant 1920x1080 coordinate space.
    // Fit the iframe as a single composited surface so rerenders never run the
    // protected text-fit laws against scale-dependent CSS-pixel tolerances.
    const scale=Math.min(width/1920,height/1080);
    const iframe=this.shadowRoot?.querySelector("iframe");
    if(iframe){
      iframe.style.width="1920px";
      iframe.style.height="1080px";
      iframe.style.transformOrigin="top left";
      iframe.style.transform=scale===1?"":`scale(${scale})`;
    }
    this._kernel.resize({scale:1});
    // buildFlags rebuilds the flag row on every protected render, and the render paths
    // that reuse a mounted kernel can settle after the post-render pass. Re-apply here:
    // resize() runs at mount, after each projection update, and on container changes,
    // and the pass restores the protected baseline before fitting, so it is idempotent.
    // Only the cheap per-flag fit belongs here: resize() runs on every container change,
    // and the furniture scan measures every arrow part, so running it here thrashed layout.
    // It runs on render completion and immediately before export instead.
    const flagDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(flagDocument)this._fitMilestoneFlags(flagDocument);
    const result={
      scale,
      cssWidth:1920*scale,
      cssHeight:1080*scale,
      dpr:globalThis.devicePixelRatio||1
    };
    const childDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(childDocument&&this._hitLayer)this._refreshHits(childDocument);
    return result;
  }

  diagnostics(){return this._kernel?.diagnostics?.()||null;}

  async exportBoard(request){
    if(!this._kernel)throw new Error("Timeline export is not ready.");
    await this._kernel.whenStable(this._record.renderId);
    // The protected renderer rebuilds the milestone row on every render and never
    // de-collides it, so an export could otherwise capture overlapping, clipped flag
    // text - the defect the Founder saw in the upper-right of exported artifacts.
    // Fit immediately before capture; the pass restores the baseline first, so this is
    // safe whether or not it already ran for this render.
    // Only the flag fit is needed here. The legend was already placed when this render
    // completed, and re-running the board scan at capture time added latency to the one
    // operation a student waits on without changing where anything lands.
    const childDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(childDocument)this._fitMilestoneFlags(childDocument);
    return this._kernel.exportBoard(request);
  }

  _fail(error){
    // Diagnostics stay on the element for support; they are never shown to a student.
    this.dataset.error=String(error?.code||error?.message||error);
    this._setUpdating(false);
    const hasRender=this.dataset.hasRender==="true";
    if(hasRender){
      // A timeline is already on screen. Keep it, keep the element interactive, and say
      // plainly that the change did not land - do NOT clear data-ready, because that
      // uncovers the opaque first-load panel and hides the very render we retained.
      delete this.dataset.errorMessage;
      this._showLastGoodNotice(
        "That change could not be laid out, so nothing moved. Try adjusting the item you just changed, or undo it."
      );
    }else{
      this.dataset.ready="false";
      this.dataset.errorMessage="We could not display your timeline. Your saved information is still safe.";
      if(this.shadowRoot&&!this.shadowRoot.querySelector("iframe")){
        this.shadowRoot.innerHTML='<output role="alert"><strong>We could not display your timeline.</strong><span>Your saved information is still safe. Refresh this page, or contact support if the problem continues.</span></output>';
      }
    }
    this.dispatchEvent(new CustomEvent("d1-411a:error",{
      bubbles:true,composed:true,detail:{surface:this._record?.surface,error,retainedLastGood:hasRender}
    }));
  }
}

if(typeof customElements!=="undefined"&&!customElements.get("d1-timeline-kernel")){
  customElements.define("d1-timeline-kernel",D1411AKernelElement);
}

export function createD1411AKernelManager({resolveObjectUrl=()=>null}={}){
  let generation=0;
  let current=null;
  const documentRevisions=new Map();
  const surfaceTokens=new Map();
  const pruneInactiveTokens=(currentToken)=>{
    if(surfaceTokens.size<=24)return;
    for(const [key,token] of surfaceTokens){
      if(token===currentToken)continue;
      const active=globalThis.document?.querySelector?.(
        `d1-timeline-kernel[data-kernel-token="${token}"]`
      );
      if(active?.isConnected)continue;
      surfaceTokens.delete(key);
      INSTANCES.delete(token);
      if(surfaceTokens.size<=24)break;
    }
  };

  const ensureProjection=(document,audience)=>{
    const signature=JSON.stringify(document);
    let revision=documentRevisions.get(signature);
    // updatedAt is persistence metadata, not a safe render revision. Multiple
    // canonical mutations can share one timestamp, especially during rapid
    // drag/resize and bulk palette updates. Bind the revision to the complete
    // document signature so every distinct projection reaches the live kernel.
    if(revision==null){
      revision=++generation;
      documentRevisions.set(signature,revision);
    }
    current=projectTimelineDocument(document,{
      revision,
      audience,
      resolveObjectUrl
    });
    if(documentRevisions.size>12)documentRevisions.delete(documentRevisions.keys().next().value);
    return current;
  };

  const render=(document,{
    surface="preview",
    audience="EVERYTHING",
    interactive=false,
    editable=false,
    acceptsMedia=false,
    reason="preview"
  }={})=>{
    const projection=ensureProjection(document,audience);
    // The protected D1-409H renderer requires at least one arrow event. A
    // flags-only audience projection is valid domain data, but cannot be
    // handed to that renderer without producing its fatal `events[] required`
    // schema error. Use the established empty-state boundary whenever no
    // arrow is visible.
    if(!projection.model.events.length){
      return{
        kind:"d1-411a-empty",
        html:'<div class="d1411AEmpty" role="status"><strong>Your timeline will appear here.</strong><span>Add your first event and Timeline will lay it out for you.</span></div>',
        projection,
        warnings:projection.warnings,
        dropped:projection.dropped,
        scene:{events:[],accessibility:{ariaLabel:"Timeline has no visible events"}}
      };
    }
    const tokenKey=[surface,projection.model.documentId,audience,
      interactive?"interactive":"static",editable?"editable":"readonly",
      acceptsMedia?"media":"no-media"].join(":");
    let token=surfaceTokens.get(tokenKey);
    if(!token){
      token=`d1-411a-${++tokenSequence}`;
      surfaceTokens.set(tokenKey,token);
    }
    const renderId=`${surface}-${projection.model.documentId}-${projection.model.revision}`;
    INSTANCES.set(token,{
      document:structuredClone(document),
      resolveObjectUrl,
      projection,
      surface,
      interactive:!!interactive,
      editable:!!editable,
      acceptsMedia:!!acceptsMedia,
      reason,
      renderId,
      label:`${surface} timeline preview`
    });
    pruneInactiveTokens(token);
    const html=`<d1-timeline-kernel data-kernel-token="${escapeAttribute(token)}" data-surface="${escapeAttribute(surface)}" data-interactive="${interactive}" data-editable="${editable}" data-accepts-media="${acceptsMedia}"></d1-timeline-kernel>`;
    return{
      kind:"d1-411a-kernel",
      html,
      projection,
      warnings:projection.warnings,
      dropped:projection.dropped,
      scene:{events:[],accessibility:{ariaLabel:"Canonical MissionMed timeline"}}
    };
  };

  const elements=(surface=null)=>typeof document==="undefined"?[]:[...document.querySelectorAll("d1-timeline-kernel")]
    .filter((element)=>surface==null||element.dataset.surface===surface);

  return{
    id:"D1-411A-PRESENTATION-KERNEL-HOST",
    render,
    elements,
    projection:()=>current,
    async update(surface=null){
      const targets=elements(surface);
      await Promise.all(targets.map((element)=>element.updateProjection?.()));
      return targets.map((element)=>element.diagnostics());
    },
    async whenStable(surface){
      const targets=elements(surface);
      await Promise.all(targets.map((element)=>new Promise((resolve,reject)=>{
        if(element.dataset.ready==="true")return resolve(element.diagnostics());
        if(element.dataset.error)return reject(new Error(element.dataset.error));
        const ready=()=>{cleanup();resolve(element.diagnostics());};
        const failed=(event)=>{cleanup();reject(event.detail?.error||new Error("Kernel render failed."));};
        const timeout=setTimeout(()=>{
          cleanup();
          reject(new Error(`Kernel ${surface||"surface"} did not become stable within 10 seconds.`));
        },10000);
        const cleanup=()=>{
          clearTimeout(timeout);
          element.removeEventListener("d1-411a:ready",ready);
          element.removeEventListener("d1-411a:error",failed);
        };
        element.addEventListener("d1-411a:ready",ready,{once:true});
        element.addEventListener("d1-411a:error",failed,{once:true});
      })));
      return targets.map((element)=>element.diagnostics());
    }
  };
}

export function createD1411AKernelExportAdapter({kernelManager}={}){
  if(!kernelManager)throw new TypeError("A D1-411A kernel manager is required.");
  // Native "ask where to save" dialogs pause the page while the user chooses a
  // destination. Keep the object URL alive for that bounded dialog; revoking it
  // after five seconds made Chrome disable Save for larger exports.
  const downloadUrlLifetimeMs=5*60*1000;
  const captureDeadlineMs=60*1000;
  let cachedCapture=null;
  const captureWithinDeadline=(element,request)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(
      `Timeline export capture did not finish within ${captureDeadlineMs/1000} seconds.`
    )),captureDeadlineMs);
    Promise.resolve().then(()=>element.exportBoard(request)).then(
      (value)=>{clearTimeout(timer);resolve(value);},
      (error)=>{clearTimeout(timer);reject(error);}
    );
  });
  const download=(blob,filename)=>{
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename;anchor.hidden=true;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),downloadUrlLifetimeMs);
    return{downloaded:true,verification:"browser-download-dispatched"};
  };
  return{
    id:"d1-411a-same-kernel-export",
    executionMode:"local",
    metadata:{
      executionMode:"local",
      externalApiCalls:false,
      productionWrites:false,
      renderer:"D1-409H-A1",
      contract:"D1-411A"
    },
    async generate(request){
      await kernelManager.whenStable("export");
      const element=kernelManager.elements("export")[0];
      if(!element)throw new Error("The export preview kernel is not mounted.");
      const expectedFingerprint=element.dataset.fingerprint;
      const expectedRenderId=element.dataset.renderId;
      const output=request?.renderInput?.output||{};
      const format=output.kind==="PDF"?"pdf":"png";
      const pixelRatio=format==="pdf"
        ?2
        :Number(output.width||1920)>1920?2:1;
      const captureKey=`${expectedRenderId}:${expectedFingerprint}:${pixelRatio}`;
      let result;
      if(cachedCapture?.key===captureKey){
        result={...cachedCapture.result};
      }else{
        result=await captureWithinDeadline(element,{format:"png",pixelRatio});
        cachedCapture={key:captureKey,result:{...result}};
      }
      if(format==="pdf"){
        const page=exportPdfPageDimensions(output);
        const canvas=await pngBlobCanvas(result.blob);
        const blob=await buildImagePdf([
          await canvasJpegPage(canvas,page)
        ],{
          title:String(request?.renderInput?.timeline?.title||"Mission Timeline"),
          author:"MissionMed Timeline Builder"
        });
        result={
          ...result,
          format:"pdf",
          blob,
          pageWidth:page.pageWidth,
          pageHeight:page.pageHeight
        };
      }
      if(
        result.fingerprint!==expectedFingerprint||
        result.renderId!==expectedRenderId
      ){
        throw new Error("The exported artifact does not match the mounted Export preview.");
      }
      if(
        format==="png"&&
        Number(output.width)>0&&
        Number(output.height)>0&&
        (result.width!==Number(output.width)||result.height!==Number(output.height))
      ){
        const bitmap=await createImageBitmap(result.blob);
        const canvas=document.createElement("canvas");
        canvas.width=Number(output.width);canvas.height=Number(output.height);
        canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
        bitmap.close?.();
        const blob=await new Promise((resolve)=>canvas.toBlob(resolve,"image/png"));
        if(!blob)throw new Error("The same-DOM PNG could not be resized.");
        result={...result,blob,width:canvas.width,height:canvas.height};
      }
      return{
        ...result,
        executionMode:"local",
        simulated:false,
        mimeType:result.blob.type,
        byteSize:result.blob.size,
        renderer:"D1-409H-A1",
        pdfTagged:false
      };
    },
    async download(artifact,{filename}={}){
      let blob=artifact?.blob;
      if(!(blob instanceof Blob)&&typeof blob?.arrayBuffer==="function"){
        blob=new Blob([await blob.arrayBuffer()],{type:String(blob.type||artifact?.mimeType||"")});
      }
      if(!(blob instanceof Blob))throw new TypeError("A generated Blob is required.");
      return{...download(blob,filename),filename,byteSize:blob.size};
    }
  };
}
