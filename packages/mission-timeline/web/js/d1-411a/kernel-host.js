import {projectTimelineDocument} from "./domain-visual-adapter.js";
import {buildImagePdf,canvasJpegPage} from "../export/pdf-writer.js";

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
      output[data-loading]{position:absolute;inset:0;display:grid;place-items:center;background:#c8d8e1;color:#19334f;font:700 12px/1.5 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      :host([data-ready="true"]) output[data-loading]{display:none}
      output[data-media-warning]{position:absolute;right:12px;bottom:12px;z-index:1100;max-width:min(420px,calc(100% - 24px));padding:8px 10px;border:1px solid rgba(25,51,79,.22);border-radius:8px;background:rgba(255,255,255,.94);color:#19334f;font:700 11px/1.35 system-ui,sans-serif;box-shadow:0 4px 16px rgba(25,51,79,.12)}
      output[data-media-warning][hidden]{display:none}
    </style><iframe title="${escapeAttribute(record.label)}" src="${escapeAttribute(MASTER_URL)}"></iframe><output data-loading role="status">Loading canonical timeline…</output><output data-media-warning role="status" hidden></output>`;
    const iframe=this.shadowRoot.querySelector("iframe");
    await new Promise((resolve,reject)=>{
      iframe.addEventListener("load",resolve,{once:true});
      iframe.addEventListener("error",()=>reject(new Error("Canonical timeline frame failed to load.")),{once:true});
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
    const rendered=await this._renderRecord(record);
    if(!this.isConnected){K.destroy?.();return;}
    this.resize();
    this._installChildInteractions(iframe);
    this.dataset.interactionsReady="true";
    this.dataset.ready="true";
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

  async _renderRecord(record=this._record){
    const K=this._kernel;
    if(!K||!record)throw new Error("D1-411A kernel projection is unavailable.");
    let kernelModel=record.projection.model;
    let response=null;
    const failSoftWarnings=[];
    let layoutRetryCount=0;
    for(let attempt=0;attempt<9;attempt+=1){
      try{
        response=await K.rerender(kernelModel,{
          renderId:record.renderId,
          reason:record.reason
        });
        break;
      }catch(error){
        if(String(error?.code||"")==="TEXT_FIT_UNRESOLVED"&&layoutRetryCount<1){
          layoutRetryCount+=1;
          K.resize({scale:1});
          const childWindow=this.shadowRoot?.querySelector("iframe")?.contentWindow;
          await new Promise((resolve)=>{
            if(childWindow?.requestAnimationFrame)childWindow.requestAnimationFrame(()=>resolve());
            else setTimeout(resolve,0);
          });
          continue;
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
    if(childDocument)this._applyPresentationOverrides(childDocument,record);
    delete this.dataset.error;
    delete this.dataset.errorMessage;
    delete this.dataset.lastFailureContext;
    if(layoutRetryCount)this.dataset.layoutRetryCount=String(layoutRetryCount);
    else delete this.dataset.layoutRetryCount;
    this.dataset.fingerprint=response.fingerprint;
    this.dataset.renderId=record.renderId;
    this.dataset.protectedKernel=K.kernelId;
    const projectionWarnings=[...(record.projection.warnings||[]),...failSoftWarnings];
    this.dataset.projectionWarnings=JSON.stringify(projectionWarnings);
    this.dataset.projectionDropped=JSON.stringify(record.projection.dropped||[]);
    if(failSoftWarnings.length){
      const warning=this.shadowRoot.querySelector("[data-media-warning]");
      warning.hidden=false;
      warning.textContent=`${failSoftWarnings.length} unavailable media asset${failSoftWarnings.length===1?" was":"s were"} omitted. Your timeline remains available; re-add the affected media to restore it.`;
    }else{
      const warning=this.shadowRoot.querySelector("[data-media-warning]");
      if(warning){warning.hidden=true;warning.textContent="";}
    }
    return{response,projectionWarnings};
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
      for(const cleanup of this._childCleanup.splice(0))cleanup();
      this.dataset.interactionsReady="false";
      this._hitLayer=null;
      this._hitSources=[];
      this._gesture=null;
      this._record=next;
      const rendered=await this._renderRecord(next);
      const iframe=this.shadowRoot.querySelector("iframe");
      this.resize();
      if(iframe)this._installChildInteractions(iframe);
      this.dataset.interactionsReady="true";
      this.dataset.ready="true";
      this._dispatchReady(rendered,next);
      return this.diagnostics();
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

    const objects=[...childDocument.querySelectorAll(INTERACTIVE_OBJECT_SELECTOR)];
    if(this._record.interactive){
      const focusStyle=childDocument.createElement("style");
      focusStyle.dataset.hostAccessibility="d1-411b";
      focusStyle.textContent='.d1411AHitLayer{position:absolute;inset:0;z-index:1000;pointer-events:none}.d1411AHit{position:absolute;z-index:1;border:0;padding:0;background:transparent;color:transparent;pointer-events:auto}.d1411AHit:focus-visible{outline:3px solid #191c21;outline-offset:2px;background:rgba(255,255,255,.08)}.d1411AHit[aria-selected="true"]{z-index:2;outline:3px solid #7c3aed;outline-offset:3px;background:rgba(124,58,237,.04)}.d1411AHandle{display:none;position:absolute;width:16px;height:16px;border:2px solid #fff;border-radius:2px;background:#7c3aed;box-shadow:0 0 0 1px #7c3aed;transform:translate(-50%,-50%);pointer-events:auto}.d1411AHit[aria-selected="true"] .d1411AHandle{display:block}.d1411AHandle[data-handle="se"]{left:calc(100% - 10px);top:calc(100% - 10px);cursor:nwse-resize}.d1411AAxisBoundary{position:absolute;top:0;bottom:0;width:16px;transform:translateX(-50%);pointer-events:auto;cursor:col-resize}.d1411AAxisBoundary::after{content:"";position:absolute;left:7px;top:7px;bottom:7px;width:2px;background:#7c3aed;box-shadow:0 0 0 1px #fff;opacity:0}.d1411AHit[aria-selected="true"] .d1411AAxisBoundary::after{opacity:1}';
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
    const kind=event.clientX-bounds.left<=edge
      ?"resize-start"
      :bounds.right-event.clientX<=edge
        ?"resize-end"
        :"move";
    this._gesture={
      pointerId:event.pointerId,
      domainId,
      visualId,
      kind,
      startX:event.clientX,
      startY:event.clientY,
      startMonth:this._pointMonth(event,childDocument),
      startLane:modelEvent.lane
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
    }
    event.preventDefault();
  }

  _endGesture(event,childDocument){
    const gesture=this._gesture;
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    this._gesture=null;
    const dx=(gesture.lastX??event.clientX)-gesture.startX;
    const dy=(gesture.lastY??event.clientY)-gesture.startY;
    if(Math.hypot(dx,dy)<5)return;
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
    return this._kernel.exportBoard(request);
  }

  _fail(error){
    this.dataset.ready="false";
    this.dataset.error=String(error?.code||error?.message||error);
    this.dataset.errorMessage=String(error?.message||error);
    if(this.shadowRoot){
      this.shadowRoot.innerHTML=`<output role="alert">Timeline could not be rendered safely: ${escapeAttribute(error?.message||error)}</output>`;
    }
    this.dispatchEvent(new CustomEvent("d1-411a:error",{
      bubbles:true,composed:true,detail:{surface:this._record?.surface,error}
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
    if(!projection.model.events.length&&!projection.model.flags.length){
      return{
        kind:"d1-411a-empty",
        html:'<div class="d1411AEmpty" role="status"><strong>No timeline events are visible for this audience.</strong><span>Add an event or change its visibility in Builder.</span></div>',
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
  const download=(blob,filename)=>{
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename;anchor.hidden=true;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
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
      let result=await element.exportBoard({
        format:format==="pdf"?"png":format,
        pixelRatio
      });
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
